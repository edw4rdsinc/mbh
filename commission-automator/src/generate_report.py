#!/usr/bin/env python3
"""
Commission Statement Bank Reconciliation & Reporting
Matches commission statement totals against bank deposits and emails report
"""

import pdfplumber
import csv
import re
from pathlib import Path
from collections import defaultdict
from datetime import datetime
import logging
import requests
import json

# Configuration
PDF_DIR = "/home/sam/commission_automator/data/mbh"
OUTPUT_DIR = "/home/sam/chatbot-platform/mbh/commission-automator/output"
LOG_DIR = "/home/sam/chatbot-platform/mbh/commission-automator/logs"

# Input files
COMMISSION_CSV = Path(OUTPUT_DIR) / "commission_output.csv"
STATE_SUMMARY_CSV = Path(OUTPUT_DIR) / "state_summary.csv"
NEEDS_REVIEW_CSV = Path(OUTPUT_DIR) / "needs_review.csv"

# Output files
RECONCILIATION_CSV = Path(OUTPUT_DIR) / "reconciliation.csv"

# Email configuration
RESEND_API_KEY = "re_JgqiiJdh_5SBPNDVZEmK5acfWdp2kLm8M"
FROM_EMAIL = "reports@updates.edw4rds.com"
TO_EMAIL = "sam@edw4rds.com"  # Changed for testing
RESEND_API_URL = "https://api.resend.com/emails"

# Carrier mapping: Bank deposit name -> Commission statement carrier name
CARRIER_MAPPING = {
    'Guardian Life In': 'Guardian',
    'AMERICAN HERITAG': 'American Heritage Life Insurance Co',
    'AHL INS CO': 'American Heritage Life Insurance Co',
    'BeamInsAdmin': 'Beam',
    'Beam Dental': 'Beam',
    'CHOICE ADMINISTR': 'Cal Choice',  # Note: Could also be Choice Builder
    'Ameritas Life In': 'Choice Builder',  # Ameritas underwrites Choice Builder
}


class ReportGenerator:
    """Generates bank reconciliation report and emails results"""

    def __init__(self):
        # Setup logging
        log_file = Path(LOG_DIR) / f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        Path(LOG_DIR).mkdir(parents=True, exist_ok=True)

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)

        self.commission_data = []
        self.bank_deposits = []
        self.state_summary = []
        self.needs_review = []
        self.reconciliation = []

    def load_commission_data(self):
        """Load commission output CSV"""
        self.logger.info(f"Loading commission data from {COMMISSION_CSV}")

        with open(COMMISSION_CSV, 'r') as f:
            reader = csv.DictReader(f)
            self.commission_data = list(reader)

        self.logger.info(f"Loaded {len(self.commission_data)} commission entries")

    def load_state_summary(self):
        """Load state summary CSV"""
        self.logger.info(f"Loading state summary from {STATE_SUMMARY_CSV}")

        with open(STATE_SUMMARY_CSV, 'r') as f:
            reader = csv.DictReader(f)
            # Filter out empty states and GRAND TOTAL row
            self.state_summary = [
                row for row in reader
                if row.get('State') and row['State'] not in ['', 'GRAND TOTAL']
            ]

        self.logger.info(f"Loaded {len(self.state_summary)} state entries")

    def load_needs_review(self):
        """Load needs review CSV"""
        self.logger.info(f"Loading needs review from {NEEDS_REVIEW_CSV}")

        if not NEEDS_REVIEW_CSV.exists():
            self.logger.warning("No needs_review.csv file found")
            return

        with open(NEEDS_REVIEW_CSV, 'r') as f:
            reader = csv.DictReader(f)
            self.needs_review = list(reader)

        self.logger.info(f"Loaded {len(self.needs_review)} items needing review")

    def extract_bank_deposits(self, bank_statement_path: Path) -> dict:
        """
        Extract electronic deposits from US Bank statement PDF

        Returns:
            dict: {carrier_name: [amounts]}
        """
        self.logger.info(f"Extracting bank deposits from {bank_statement_path.name}")

        deposits = defaultdict(list)

        with pdfplumber.open(bank_statement_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                lines = text.split('\n')

                for line in lines:
                    if 'Electronic Deposit From' in line:
                        # Extract carrier name and amount
                        match = re.search(r'Electronic Deposit From (.+?)\s+([\d,]+\.\d+)', line)
                        if match:
                            carrier = match.group(1).strip()
                            amount = float(match.group(2).replace(',', ''))
                            deposits[carrier].append(amount)

        # Log extracted deposits
        total_deposits = sum(sum(amounts) for amounts in deposits.values())
        total_count = sum(len(amounts) for amounts in deposits.values())

        self.logger.info(f"Extracted {total_count} deposits totaling ${total_deposits:,.2f}")

        # Store for later use
        self.bank_deposits = deposits

        return deposits

    def reconcile_commissions(self):
        """
        Reconcile commission totals against bank deposits

        Creates reconciliation data showing:
        - Matched carriers with totals
        - Unmatched bank deposits
        - Unmatched commission carriers
        - Variances
        """
        self.logger.info("Starting reconciliation")

        # Sum commissions by carrier
        commission_totals = defaultdict(float)
        for entry in self.commission_data:
            carrier = entry['carrier']
            commission = float(entry['commission'])
            commission_totals[carrier] += commission

        # Sum bank deposits by normalized carrier name
        bank_totals = defaultdict(float)
        for bank_name, amounts in self.bank_deposits.items():
            # Map bank name to commission carrier name if possible
            commission_carrier = CARRIER_MAPPING.get(bank_name)

            if commission_carrier:
                bank_totals[commission_carrier] += sum(amounts)
            else:
                # Keep unmapped deposits with original bank name
                bank_totals[bank_name] += sum(amounts)

        # Create reconciliation records
        all_carriers = set(commission_totals.keys()) | set(bank_totals.keys())

        for carrier in sorted(all_carriers):
            commission_total = commission_totals.get(carrier, 0.0)
            bank_total = bank_totals.get(carrier, 0.0)
            variance = bank_total - commission_total

            status = "MATCHED" if abs(variance) < 0.01 else "VARIANCE"

            if commission_total == 0:
                status = "BANK ONLY"
            elif bank_total == 0:
                status = "COMMISSION ONLY"

            self.reconciliation.append({
                'carrier': carrier,
                'commission_total': f"{commission_total:.2f}",
                'bank_total': f"{bank_total:.2f}",
                'variance': f"{variance:.2f}",
                'status': status
            })

            # Log variances and unmatched items
            if status == "VARIANCE":
                self.logger.warning(f"Variance detected: {carrier} - Commission: ${commission_total:.2f}, Bank: ${bank_total:.2f}, Diff: ${variance:.2f}")
            elif status == "BANK ONLY":
                self.logger.warning(f"Bank deposit with no matching commission: {carrier} - ${bank_total:.2f}")
            elif status == "COMMISSION ONLY":
                self.logger.warning(f"Commission with no matching bank deposit: {carrier} - ${commission_total:.2f}")

        self.logger.info(f"Reconciliation complete: {len(self.reconciliation)} carriers")

    def save_reconciliation_csv(self):
        """Save reconciliation results to CSV"""
        self.logger.info(f"Saving reconciliation to {RECONCILIATION_CSV}")

        Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

        with open(RECONCILIATION_CSV, 'w', newline='') as f:
            fieldnames = ['carrier', 'commission_total', 'bank_total', 'variance', 'status']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(self.reconciliation)

        self.logger.info(f"Saved {len(self.reconciliation)} reconciliation records")

    def generate_html_report(self) -> str:
        """
        Generate professional HTML email report

        Returns:
            str: HTML content for email body
        """
        self.logger.info("Generating HTML report")

        # Calculate summary statistics
        total_commission = sum(float(r['commission_total']) for r in self.reconciliation)
        total_bank = sum(float(r['bank_total']) for r in self.reconciliation)
        total_variance = total_bank - total_commission

        matched_count = sum(1 for r in self.reconciliation if r['status'] == 'MATCHED')
        variance_count = sum(1 for r in self.reconciliation if r['status'] == 'VARIANCE')
        bank_only_count = sum(1 for r in self.reconciliation if r['status'] == 'BANK ONLY')
        commission_only_count = sum(1 for r in self.reconciliation if r['status'] == 'COMMISSION ONLY')

        # Build HTML
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #34495e;
            margin-top: 30px;
            border-bottom: 2px solid #95a5a6;
            padding-bottom: 5px;
        }}
        .summary {{
            background: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }}
        .summary-stat {{
            display: inline-block;
            margin: 10px 20px 10px 0;
        }}
        .summary-stat .label {{
            font-weight: bold;
            color: #7f8c8d;
        }}
        .summary-stat .value {{
            font-size: 1.3em;
            color: #2c3e50;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th {{
            background: #3498db;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
        }}
        td {{
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
        }}
        tr:hover {{
            background: #f5f5f5;
        }}
        .status-matched {{
            color: #27ae60;
            font-weight: bold;
        }}
        .status-variance {{
            color: #e67e22;
            font-weight: bold;
        }}
        .status-unmatched {{
            color: #e74c3c;
            font-weight: bold;
        }}
        .amount {{
            text-align: right;
            font-family: 'Courier New', monospace;
        }}
        .positive {{
            color: #27ae60;
        }}
        .negative {{
            color: #e74c3c;
        }}
        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #95a5a6;
            color: #7f8c8d;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <h1>Commission Statement Reconciliation Report</h1>
    <p><strong>Report Date:</strong> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>

    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="summary-stat">
            <div class="label">Total Commission Statements</div>
            <div class="value">${total_commission:,.2f}</div>
        </div>
        <div class="summary-stat">
            <div class="label">Total Bank Deposits</div>
            <div class="value">${total_bank:,.2f}</div>
        </div>
        <div class="summary-stat">
            <div class="label">Variance</div>
            <div class="value {'positive' if total_variance >= 0 else 'negative'}">${total_variance:,.2f}</div>
        </div>
        <div style="clear:both; margin-top: 20px;">
            <div class="summary-stat">
                <div class="label">Matched Carriers</div>
                <div class="value">{matched_count}</div>
            </div>
            <div class="summary-stat">
                <div class="label">Variances</div>
                <div class="value">{variance_count}</div>
            </div>
            <div class="summary-stat">
                <div class="label">Bank Only</div>
                <div class="value">{bank_only_count}</div>
            </div>
            <div class="summary-stat">
                <div class="label">Commission Only</div>
                <div class="value">{commission_only_count}</div>
            </div>
        </div>
    </div>

    <h2>State Summary</h2>
    <table>
        <tr>
            <th>State</th>
            <th style="text-align: right;">Total Commission</th>
            <th style="text-align: right;">Percentage</th>
        </tr>
"""

        # Add state summary rows
        for state in self.state_summary:
            html += f"""
        <tr>
            <td>{state['State']}</td>
            <td class="amount">${float(state['Total Commission']):,.2f}</td>
            <td class="amount">{state['Percentage of Total']}</td>
        </tr>
"""

        html += """
    </table>

    <h2>Carrier Reconciliation</h2>
    <table>
        <tr>
            <th>Carrier</th>
            <th style="text-align: right;">Commission Total</th>
            <th style="text-align: right;">Bank Total</th>
            <th style="text-align: right;">Variance</th>
            <th>Status</th>
        </tr>
"""

        # Add reconciliation rows
        for rec in self.reconciliation:
            status_class = 'status-matched'
            if rec['status'] in ['VARIANCE']:
                status_class = 'status-variance'
            elif rec['status'] in ['BANK ONLY', 'COMMISSION ONLY']:
                status_class = 'status-unmatched'

            variance_class = 'positive' if float(rec['variance']) >= 0 else 'negative'

            html += f"""
        <tr>
            <td>{rec['carrier']}</td>
            <td class="amount">${float(rec['commission_total']):,.2f}</td>
            <td class="amount">${float(rec['bank_total']):,.2f}</td>
            <td class="amount {variance_class}">${float(rec['variance']):,.2f}</td>
            <td class="{status_class}">{rec['status']}</td>
        </tr>
"""

        html += """
    </table>
"""

        # Add items needing review if any
        if self.needs_review:
            html += f"""
    <h2>Items Needing Review ({len(self.needs_review)} entries)</h2>
    <p>The following entries have low-confidence state matches (60-79%) and should be verified:</p>
    <table>
        <tr>
            <th>Carrier</th>
            <th>Group Name</th>
            <th style="text-align: right;">Commission</th>
            <th>State</th>
            <th style="text-align: right;">Match Confidence</th>
        </tr>
"""

            for item in self.needs_review[:20]:  # Show first 20
                html += f"""
        <tr>
            <td>{item['carrier']}</td>
            <td>{item['group_name']}</td>
            <td class="amount">${float(item['commission']):,.2f}</td>
            <td>{item['state']}</td>
            <td class="amount">{item.get('match_confidence', 'N/A')}%</td>
        </tr>
"""

            if len(self.needs_review) > 20:
                html += f"""
        <tr>
            <td colspan="5" style="text-align: center; font-style: italic;">
                ... and {len(self.needs_review) - 20} more entries (see attached needs_review.csv)
            </td>
        </tr>
"""

            html += """
    </table>
"""

        html += """
    <div class="footer">
        <p><strong>Attached Files:</strong></p>
        <ul>
            <li><strong>commission_output.csv</strong> - All commission entries with state assignments</li>
            <li><strong>reconciliation.csv</strong> - Complete carrier reconciliation details</li>
            <li><strong>state_summary.csv</strong> - State totals and percentages</li>
        </ul>
        <p>This report was automatically generated by the Commission Statement Automator.</p>
    </div>
</body>
</html>
"""

        return html

    def send_email_report(self, html_body: str):
        """
        Send email report via Resend API with CSV attachments

        Args:
            html_body: HTML content for email body
        """
        self.logger.info(f"Sending email report to {TO_EMAIL}")

        # Prepare attachments
        attachments = []

        # Read and encode CSV files
        csv_files = [
            (COMMISSION_CSV, 'commission_output.csv'),
            (RECONCILIATION_CSV, 'reconciliation.csv'),
            (STATE_SUMMARY_CSV, 'state_summary.csv'),
        ]

        for file_path, filename in csv_files:
            if file_path.exists():
                with open(file_path, 'r') as f:
                    content = f.read()
                    import base64
                    encoded = base64.b64encode(content.encode()).decode()

                    attachments.append({
                        'filename': filename,
                        'content': encoded
                    })
                self.logger.info(f"Attached {filename}")

        # Prepare email payload
        payload = {
            'from': FROM_EMAIL,
            'to': [TO_EMAIL],
            'subject': f'Commission Reconciliation Report - {datetime.now().strftime("%B %Y")}',
            'html': html_body,
            'attachments': attachments
        }

        # Send via Resend API
        headers = {
            'Authorization': f'Bearer {RESEND_API_KEY}',
            'Content-Type': 'application/json'
        }

        try:
            response = requests.post(RESEND_API_URL, json=payload, headers=headers)
            response.raise_for_status()

            result = response.json()
            self.logger.info(f"Email sent successfully! ID: {result.get('id')}")

        except requests.exceptions.RequestException as e:
            self.logger.error(f"Failed to send email: {e}")
            if hasattr(e.response, 'text'):
                self.logger.error(f"Response: {e.response.text}")
            raise

    def run(self, bank_statement_path: str):
        """
        Execute complete reporting workflow

        Args:
            bank_statement_path: Path to US Bank statement PDF
        """
        self.logger.info("=== Commission Reconciliation Report Started ===")

        try:
            # Load all data
            self.load_commission_data()
            self.load_state_summary()
            self.load_needs_review()

            # Extract bank deposits
            self.extract_bank_deposits(Path(bank_statement_path))

            # Reconcile
            self.reconcile_commissions()

            # Save reconciliation CSV
            self.save_reconciliation_csv()

            # Generate HTML report
            html_report = self.generate_html_report()

            # Send email
            self.send_email_report(html_report)

            self.logger.info("=== Commission Reconciliation Report Completed Successfully ===")

        except Exception as e:
            self.logger.error(f"Report generation failed: {e}", exc_info=True)
            raise


def main():
    """Main entry point"""
    import argparse

    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Generate commission reconciliation report')
    parser.add_argument('--month', type=str, help='Month to process in YYYY-MM format (e.g., 2025-08)',
                       default=datetime.now().strftime('%Y-%m'))
    args = parser.parse_args()

    # Validate month format
    try:
        datetime.strptime(args.month, '%Y-%m')
    except ValueError:
        print(f"ERROR: Invalid month format '{args.month}'. Use YYYY-MM (e.g., 2025-08)")
        exit(1)

    # Update paths for the specified month
    global COMMISSION_CSV, STATE_SUMMARY_CSV, NEEDS_REVIEW_CSV, RECONCILIATION_CSV

    BASE_OUTPUT_DIR = "/home/sam/chatbot-platform/mbh/commission-automator/output"
    month_output_dir = f"{BASE_OUTPUT_DIR}/{args.month}"

    COMMISSION_CSV = Path(month_output_dir) / "commission_output.csv"
    STATE_SUMMARY_CSV = Path(month_output_dir) / "state_summary.csv"
    NEEDS_REVIEW_CSV = Path(month_output_dir) / "needs_review.csv"
    RECONCILIATION_CSV = Path(month_output_dir) / "reconciliation.csv"

    # Find bank statement PDF
    BASE_DATA_DIR = "/home/sam/commission_automator/data/mbh"
    bank_statement_dir = Path(f"{BASE_DATA_DIR}/{args.month}/bank_statement")

    if not bank_statement_dir.exists():
        print(f"ERROR: Bank statement directory not found: {bank_statement_dir}")
        print(f"Please create the directory and add bank statement PDF for {args.month}")
        exit(1)

    # Look for bank statement file
    bank_statement = None
    for pdf_file in bank_statement_dir.glob("*.pdf"):
        bank_statement = pdf_file
        break

    if not bank_statement:
        print(f"ERROR: No bank statement PDF found in {bank_statement_dir}")
        print("Please add the US Bank statement PDF to this directory")
        exit(1)

    # Verify commission data exists
    if not COMMISSION_CSV.exists():
        print(f"ERROR: Commission data not found: {COMMISSION_CSV}")
        print(f"Please run extract_commissions.py --month {args.month} first")
        exit(1)

    print(f"Generating reconciliation report for {args.month}")
    print(f"Commission data: {COMMISSION_CSV}")
    print(f"Bank statement: {bank_statement.name}")
    print()

    # Generate and send report
    generator = ReportGenerator()
    generator.run(str(bank_statement))


if __name__ == "__main__":
    main()
