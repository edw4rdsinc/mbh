#!/usr/bin/env python3
"""
Commission Statement Extractor
Extracts commission data from various carrier PDF statements
"""

import pdfplumber
import csv
import re
import os
import logging
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from fuzzywuzzy import fuzz
from fuzzywuzzy import process
import anthropic


class CommissionExtractor:
    def __init__(self, pdf_dir: str, master_csv: str, output_dir: str, log_dir: str, claude_api_key: Optional[str] = None):
        self.pdf_dir = Path(pdf_dir)
        self.master_csv = Path(master_csv)
        self.output_dir = Path(output_dir)
        self.log_dir = Path(log_dir)

        # Setup Claude API client
        self.claude_client = None
        if claude_api_key:
            self.claude_client = anthropic.Anthropic(api_key=claude_api_key)

        # Setup logging
        self.setup_logging()

        # Load master contacts
        self.master_contacts = self.load_master_contacts()

        # Results storage
        self.results = []
        self.review_items = []

    def setup_logging(self):
        """Setup logging to file and console"""
        self.log_dir.mkdir(parents=True, exist_ok=True)
        log_file = self.log_dir / f"extraction_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)

    def load_master_contacts(self) -> Dict[str, str]:
        """Load master contacts CSV and create lookup dict"""
        self.logger.info(f"Loading master contacts from {self.master_csv}")
        contacts = {}

        with open(self.master_csv, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                card_name = row.get('Card Name', '').strip()
                state = row.get('State', '').strip()
                if card_name:
                    contacts[card_name] = state

        self.logger.info(f"Loaded {len(contacts)} contacts from master list")
        return contacts

    def fuzzy_match_state(self, group_name: str) -> tuple[str, int]:
        """
        Fuzzy match group name to card name and return state
        Returns: (state, confidence_score)
        """
        if not group_name:
            return "", 0

        # Get best match
        result = process.extractOne(group_name, self.master_contacts.keys(), scorer=fuzz.token_sort_ratio)

        if result:
            matched_name, score = result[0], result[1]
            state = self.master_contacts[matched_name]
            self.logger.debug(f"Matched '{group_name}' to '{matched_name}' (score: {score}) -> {state}")
            return state, score

        return "UNKNOWN", 0

    def extract_allied(self, pdf_path: Path) -> List[Dict]:
        """Extract commissions from Allied PDF"""
        self.logger.info(f"Extracting Allied: {pdf_path.name}")
        results = []

        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()

                # Look for group entries with regex
                # Pattern: Group number, group name, dates, amounts
                pattern = r'([A-Z]\d+)\s+(.+?)\s+\d+/\d+/\d+\s+\d+/\d+/\d+\s+\$[\d,]+\.\d+\s+\$[\d,]+\.\d+\s+[\d.]+%.*?\s+\d+\s+\$([0-9,]+\.\d+)'

                matches = re.finditer(pattern, text)
                for match in matches:
                    group_num = match.group(1)
                    group_name = match.group(2).strip()
                    commission = match.group(3).replace(',', '')

                    results.append({
                        'carrier': 'Allied',
                        'group_name': group_name,
                        'commission': float(commission)
                    })

        self.logger.info(f"Allied: Extracted {len(results)} entries")
        return results

    def extract_beam(self, pdf_path: Path) -> List[Dict]:
        """Extract commissions from Beam PDF"""
        self.logger.info(f"Extracting Beam: {pdf_path.name}")
        results = {}

        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                lines = text.split('\n')

                # In Beam PDFs, there are two patterns:
                # Pattern 1 (most common):
                #   Line N: "Company Name Product_Description ..."
                #   Line N+1: "POLICY_CODE $amount date"
                #
                # Pattern 2 (some entries like Runvalet):
                #   Line N: "Company Name Product_Description ..."
                #   Line N+1: "Location $amount date"
                #   Line N+2: "POLICY_CODE"

                for i in range(len(lines) - 2):
                    line = lines[i]
                    next_line = lines[i + 1] if i + 1 < len(lines) else ''
                    third_line = lines[i + 2] if i + 2 < len(lines) else ''

                    # Skip header and summary lines
                    if any(skip in line for skip in ['Company name', 'Commission statement', 'BEAM SUPPORT', 'Commission summary', 'You get', 'Group business']):
                        continue

                    # Check Pattern 1: next line has policy code
                    policy_match = re.search(r'^([A-Z]{2}\d{5})\s', next_line)

                    if policy_match:
                        # Extract company name from current line
                        company_name = re.sub(r'\s*(SmartPremium|VSP Choice Plan).*$', '', line).strip()

                        # Extract commission from next line
                        amounts = re.findall(r'\$([0-9,]+\.\d+)', next_line)
                        if amounts and company_name:
                            commission = float(amounts[0].replace(',', ''))

                            if company_name in results:
                                results[company_name] += commission
                            else:
                                results[company_name] = commission

                    # Check Pattern 2: third line has policy code, second line has location + amount
                    elif re.match(r'^[A-Z]{2}\d{5}$', third_line.strip()):
                        # Check if second line has location and amount
                        amounts = re.findall(r'\$([0-9,]+\.\d+)', next_line)
                        if amounts:
                            # Extract company name from current line
                            # Remove product descriptions and everything after
                            company_name = re.sub(r'\s*(SmartPremium|VSP Choice Plan|25k Shelf-Rated|MAC|OON|Select|Plus|Choice).*$', '', line).strip()

                            if company_name:
                                commission = float(amounts[0].replace(',', ''))

                                if company_name in results:
                                    results[company_name] += commission
                                else:
                                    results[company_name] = commission

        # Convert to list format
        result_list = [
            {'carrier': 'Beam', 'group_name': name, 'commission': comm}
            for name, comm in results.items()
        ]

        self.logger.info(f"Beam: Extracted {len(result_list)} entries")
        return result_list

    def extract_guardian(self, pdf_path: Path) -> List[Dict]:
        """Extract commissions from Guardian PDF"""
        self.logger.info(f"Extracting Guardian: {pdf_path.name}")

        with pdfplumber.open(pdf_path) as pdf:
            text = pdf.pages[0].extract_text()

            # Find the total commission amount
            # Look for "Guardian Life Total" line
            match = re.search(r'Guardian Life Total\s+\$[\d,]+\.\d+\s+\$[\d,]+\.\d+\s+\$([0-9,]+\.\d+)', text)

            if match:
                total_commission = match.group(1).replace(',', '')
                self.logger.info(f"Guardian: Total commission ${total_commission}")

                return [{
                    'carrier': 'Guardian',
                    'group_name': '',
                    'commission': float(total_commission)
                }]

        self.logger.warning(f"Guardian: Could not extract total commission")
        return []

    def extract_american_heritage(self, pdf_path: Path) -> List[Dict]:
        """
        Extract commissions from American Heritage Life Insurance PDF

        American Heritage statements have:
        - Group workplace plans with "Case XXXXX GROUP_NAME" summary lines
        - Personal/individual plans with NO group names

        Strategy: Extract group names from "Case" lines, then add a blank-group entry
        for any remaining commission (personal/individual plans).
        """
        self.logger.info(f"Extracting American Heritage: {pdf_path.name}")
        results = {}
        group_commissions_total = 0

        with pdfplumber.open(pdf_path) as pdf:
            # Extract group commissions from "Case" lines
            for page in pdf.pages:
                text = page.extract_text()
                lines = text.split('\n')

                for line in lines:
                    # Look for "Case XXXXX GROUP_NAME" lines
                    # Must have a number after the group name (to avoid header lines)
                    case_match = re.match(r'Case\s+([A-Z0-9]+)\s+(.+?)\s+([\d,]+\.\d+)', line)

                    if case_match:
                        case_num = case_match.group(1)
                        group_name = case_match.group(2).strip()

                        # Skip header lines (group_name would be "Name" or similar)
                        if group_name.lower() in ['name', 'case name']:
                            continue

                        # Remove trailing comma if present
                        if group_name.endswith(','):
                            group_name = group_name[:-1].strip()

                        # Extract all amounts from the line (including .XX format like .85)
                        amounts = re.findall(r'(\d[\d,]*\.\d+|\.\d+)', line)

                        # Commission is the last number on the line
                        if amounts:
                            commission = float(amounts[-1].replace(',', ''))

                            # Add to results (sum if group appears multiple times)
                            if group_name in results:
                                results[group_name] += commission
                            else:
                                results[group_name] = commission

                            group_commissions_total += commission
                            self.logger.debug(f"American Heritage: {group_name} -> ${commission:.2f}")

            # Get total commission from PDF bottom
            last_page = pdf.pages[-1]
            last_text = last_page.extract_text()

            total_commission = 0
            # Try "Commissions Due" first
            match = re.search(r'Commissions Due\s+([\d,]*\.?\d+)', last_text)
            if match:
                total_commission = float(match.group(1).replace(',', ''))

            # If 0, check for "Total Commissions Earned"
            if total_commission == 0:
                earned_match = re.search(r'Total Commissions Earned\s+([\d,]+\.\d+)CR', last_text)
                if earned_match:
                    total_commission = float(earned_match.group(1).replace(',', ''))

            # Calculate remainder (individual/personal plans without group names)
            individual_commissions = total_commission - group_commissions_total

            # Add blank-group entry for individual commissions if any
            if individual_commissions > 0.01:  # Use 0.01 to handle floating point rounding
                results[''] = individual_commissions
                self.logger.info(f"American Heritage: ${individual_commissions:.2f} in personal/individual plans (no group name)")

        # Convert to list format
        result_list = [
            {'carrier': 'American Heritage Life Insurance Co', 'group_name': name, 'commission': comm}
            for name, comm in results.items()
        ]

        self.logger.info(f"American Heritage: Extracted {len(result_list)} entries ({len([r for r in result_list if r['group_name']])} groups + {len([r for r in result_list if not r['group_name']])} blank)")
        return result_list

    def extract_choice_builder(self, pdf_path: Path) -> List[Dict]:
        """Extract commissions from Choice Builder PDF"""
        self.logger.info(f"Extracting Choice Builder: {pdf_path.name}")
        results = {}

        # Track company across pages
        current_company = None
        looking_for_company = False

        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                lines = text.split('\n')

                for i, line in enumerate(lines):
                    # Look for policy numbers (e.g., "Policy Number: B14838")
                    if re.match(r'Policy Number:\s+[A-Z]\d+', line):
                        looking_for_company = True
                        current_company = None
                        continue

                    # Look for commission amounts on product lines
                    # Pattern 1: Positive amount - "Month Year Product $Amount"
                    # Pattern 2: Negative amount - "Month Year Product ($Amount)"
                    # e.g., "Aug 2025 Dental $2.41" or "Jul 2025 Dental ($0.65)"

                    # Try positive amount first
                    comm_match = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+(Dental|Vision|Life|Chiropractic|Medical)\s+\$([0-9,]+\.\d+)', line)

                    if comm_match:
                        commission = float(comm_match.group(3).replace(',', ''))
                    else:
                        # Try negative amount format: ($X.XX)
                        comm_match = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+(Dental|Vision|Life|Chiropractic|Medical)\s+\(\$([0-9,]+\.\d+)\)', line)
                        if comm_match:
                            commission = -float(comm_match.group(3).replace(',', ''))

                    if comm_match:
                        # Check if company name is on the same line (before the date)
                        if looking_for_company:
                            # Extract company name from before the date pattern
                            company_part = line[:comm_match.start()].strip()
                            if company_part:
                                current_company = company_part
                                looking_for_company = False
                                self.logger.debug(f"Choice Builder: Found company '{current_company}' on commission line")

                        # Add commission to current company
                        if current_company:
                            if current_company in results:
                                results[current_company] += commission
                            else:
                                results[current_company] = commission

                    elif looking_for_company:
                        # Company name on separate line (no commission data on this line)
                        # Skip column headers and empty lines
                        if line.strip() and not re.search(r'(CompanyName|PaidMonth|Product|Comm Amount|ADJCD|Page \d)', line):
                            # This might be part of the company name or the full company name
                            current_company = line.strip()
                            looking_for_company = False
                            self.logger.debug(f"Choice Builder: Found company '{current_company}' on separate line")

        # Convert to list format
        result_list = [
            {'carrier': 'Choice Builder', 'group_name': name, 'commission': comm}
            for name, comm in results.items()
        ]

        self.logger.info(f"Choice Builder: Extracted {len(result_list)} entries")
        return result_list

    def extract_cal_choice(self, pdf_path: Path) -> List[Dict]:
        """Extract commissions from Cal Choice PDF"""
        self.logger.info(f"Extracting Cal Choice: {pdf_path.name}")
        results = {}
        current_company = None

        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                lines = text.split('\n')

                for line in lines:
                    # Pattern 1: Full line with group number, company name, and commission
                    # e.g., "73684 4KS INVESTMENTS L L C 25-Sep Medical 6602.31 1 66.02"
                    match = re.search(r'^(\d+)\s+(.+?)\s+\d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(Medical|Dental|Vision|Life)\s+[\d,.-]+\s+[\d.]+\s+([-\d,]+\.\d+)', line)

                    if match:
                        current_company = match.group(2).strip()
                        commission = float(match.group(5).replace(',', ''))

                        if current_company in results:
                            results[current_company] += commission
                        else:
                            results[current_company] = commission
                    else:
                        # Pattern 2: Continuation line (no group number, just date onward)
                        # e.g., "25-Jul Medical 2475.13 1.5 37.13"
                        cont_match = re.search(r'^\d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(Medical|Dental|Vision|Life)\s+[\d,.-]+\s+[\d.]+\s+([-\d,]+\.\d+)', line)

                        if cont_match and current_company:
                            commission = float(cont_match.group(3).replace(',', ''))
                            results[current_company] += commission

        # Convert to list format
        result_list = [
            {'carrier': 'Cal Choice', 'group_name': name, 'commission': comm}
            for name, comm in results.items()
        ]

        self.logger.info(f"Cal Choice: Extracted {len(result_list)} entries, total: ${sum(r['commission'] for r in result_list):.2f}")
        return result_list

    def extract_vsp_vision(self, pdf_path: Path) -> List[Dict]:
        """Extract commissions from VSP Vision PDF (lump sum format)"""
        self.logger.info(f"Extracting VSP Vision: {pdf_path.name}")

        with pdfplumber.open(pdf_path) as pdf:
            text = pdf.pages[0].extract_text()

            # Look for "Sum total" line with amount
            match = re.search(r'Sum total\s+([\d,]+\.\d+)', text)
            if match:
                commission = float(match.group(1).replace(',', ''))
                self.logger.info(f"VSP Vision: Extracted total ${commission:.2f}")
                return [{'carrier': 'VSP Vision', 'group_name': 'VSP Vision Total', 'commission': commission}]

            # Fallback: look for Net Amount
            match = re.search(r'Net Amount[^\d]*([\d,]+\.\d+)', text)
            if match:
                commission = float(match.group(1).replace(',', ''))
                self.logger.info(f"VSP Vision: Extracted net amount ${commission:.2f}")
                return [{'carrier': 'VSP Vision', 'group_name': 'VSP Vision Total', 'commission': commission}]

        self.logger.warning(f"VSP Vision: Could not extract commission from {pdf_path.name}")
        return []

    def extract_generic(self, pdf_path: Path, carrier_name: str) -> List[Dict]:
        """Generic extraction for unknown formats using Claude API"""
        self.logger.warning(f"Using Claude API extraction for {carrier_name}: {pdf_path.name}")

        if not self.claude_client:
            self.logger.error(f"Claude API not configured - skipping {pdf_path.name}")
            return []

        # Extract text from PDF
        full_text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"

        if not full_text.strip():
            self.logger.error(f"No text extracted from {pdf_path.name}")
            return []

        # Truncate if too long (Claude has token limits)
        if len(full_text) > 50000:
            self.logger.warning(f"PDF text too long ({len(full_text)} chars), truncating to first 50000 chars")
            full_text = full_text[:50000]

        # Call Claude API to extract structured data
        try:
            self.logger.info(f"Calling Claude API to extract data from {pdf_path.name}")

            prompt = f"""You are analyzing a commission statement PDF. Extract the following information:

1. Carrier Name: The insurance carrier or company that issued this statement
2. Group Names: All customer/group names that received commissions
3. Commission Amounts: The commission amount for each group

Here is the text from the PDF:

{full_text}

Please respond with a JSON object in this exact format:
{{
  "carrier": "Carrier Name",
  "entries": [
    {{"group_name": "Company Name 1", "commission": 123.45}},
    {{"group_name": "Company Name 2", "commission": 678.90}}
  ]
}}

Important:
- If the carrier name is not obvious, use the PDF filename or best guess
- Extract ALL group names and their corresponding commission amounts
- Commission amounts should be numbers (floats), not strings
- If a statement shows a total only with no group breakdown, use an empty string for group_name
- Return ONLY the JSON object, no other text"""

            response = self.claude_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=4000,
                messages=[{"role": "user", "content": prompt}]
            )

            # Parse Claude's response
            response_text = response.content[0].text.strip()

            # Try to extract JSON from response
            # Sometimes Claude wraps JSON in markdown code blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            data = json.loads(response_text)

            # Convert to our standard format
            carrier = data.get('carrier', 'Unknown')
            entries = data.get('entries', [])

            results = []
            for entry in entries:
                results.append({
                    'carrier': carrier,
                    'group_name': entry.get('group_name', ''),
                    'commission': float(entry.get('commission', 0))
                })

            self.logger.info(f"Claude API extracted {len(results)} entries from {pdf_path.name}")
            return results

        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse Claude API response as JSON: {e}")
            self.logger.error(f"Response was: {response_text[:500]}")
            return []
        except Exception as e:
            self.logger.error(f"Error calling Claude API for {pdf_path.name}: {str(e)}")
            return []

    def process_pdf(self, pdf_path: Path) -> List[Dict]:
        """Route PDF to appropriate extractor based on filename or content"""
        filename = pdf_path.stem.lower()

        try:
            if 'allied' in filename:
                return self.extract_allied(pdf_path)
            elif 'beam' in filename:
                return self.extract_beam(pdf_path)
            elif 'guardian' in filename:
                return self.extract_guardian(pdf_path)
            elif 'cal choice' in filename or 'calchoice' in filename:
                return self.extract_cal_choice(pdf_path)
            elif 'choice' in filename:
                return self.extract_choice_builder(pdf_path)
            elif 'vsp' in filename or 'vision' in filename:
                return self.extract_vsp_vision(pdf_path)
            else:
                # Try to detect carrier from PDF content
                with pdfplumber.open(pdf_path) as pdf:
                    first_page = pdf.pages[0].extract_text().lower()

                    if 'allied' in first_page:
                        return self.extract_allied(pdf_path)
                    elif 'beam' in first_page:
                        return self.extract_beam(pdf_path)
                    elif 'guardian' in first_page:
                        return self.extract_guardian(pdf_path)
                    elif 'choice builder' in first_page:
                        return self.extract_choice_builder(pdf_path)
                    elif 'american heritage' in first_page or 'earned commission statement' in first_page:
                        return self.extract_american_heritage(pdf_path)
                    else:
                        self.logger.warning(f"Unknown carrier format: {pdf_path.name}")
                        return self.extract_generic(pdf_path, 'Unknown')

        except Exception as e:
            self.logger.error(f"Error processing {pdf_path.name}: {str(e)}")
            return []

    def process_all_pdfs(self):
        """Process all PDFs in the directory"""
        self.logger.info(f"Scanning for PDFs in {self.pdf_dir}")

        # Get all PDFs recursively (case-insensitive)
        pdf_files = list(self.pdf_dir.rglob('*.pdf')) + list(self.pdf_dir.rglob('*.PDF'))
        self.logger.info(f"Found {len(pdf_files)} PDF files")

        for pdf_path in pdf_files:
            self.logger.info(f"Processing: {pdf_path.name}")
            extracted = self.process_pdf(pdf_path)

            # Add state matching
            for item in extracted:
                if item['group_name']:  # Only match if group name exists
                    state, confidence = self.fuzzy_match_state(item['group_name'])
                    item['state'] = state
                    item['match_confidence'] = confidence

                    # If matched state is blank/empty, assign to WA
                    if not state or state == 'UNKNOWN':
                        item['state'] = 'WA'
                        self.logger.debug(f"Blank/unknown state assigned to WA: {item['group_name']} ${item['commission']:.2f}")

                    # Flag for review if confidence is low
                    if 60 <= confidence < 80:
                        self.review_items.append(item)
                        self.logger.warning(f"Low confidence match ({confidence}%): {item['group_name']} -> {item['state']}")
                else:
                    # Blank group names (Guardian, American Heritage personal plans) -> WA
                    item['state'] = 'WA'
                    item['match_confidence'] = 100
                    self.logger.debug(f"Blank group name assigned to WA: {item['carrier']} ${item['commission']:.2f}")

                self.results.append(item)

        self.logger.info(f"Total extracted: {len(self.results)} commission entries")

    def save_results(self):
        """Save results to CSV and JSON files"""
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Build a set of review item identifiers to avoid duplicates
        review_keys = set()
        for item in self.review_items:
            key = (item['carrier'], item['group_name'], item['commission'])
            review_keys.add(key)

        # Save all data as JSON for interactive processor
        all_data = []
        for item in self.results:
            key = (item['carrier'], item['group_name'], item['commission'])
            needs_review = key in review_keys
            all_data.append({
                **item,
                'confidence': item.get('match_confidence', 100),
                'needs_review': needs_review
            })

        json_file = self.output_dir / 'all_commission_data.json'
        with open(json_file, 'w') as f:
            json.dump(all_data, f, indent=2, default=str)
        self.logger.info(f"Saved JSON data to {json_file}")

        # Main output file
        output_file = self.output_dir / 'commission_output.csv'
        with open(output_file, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['carrier', 'group_name', 'commission', 'state'])
            writer.writeheader()

            for item in self.results:
                writer.writerow({
                    'carrier': item['carrier'],
                    'group_name': item['group_name'],
                    'commission': f"{item['commission']:.2f}",
                    'state': item['state']
                })

        self.logger.info(f"Saved main results to {output_file}")

        # Review file (low confidence matches)
        if self.review_items:
            review_file = self.output_dir / 'needs_review.csv'
            with open(review_file, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=['carrier', 'group_name', 'commission', 'state', 'match_confidence'])
                writer.writeheader()

                for item in self.review_items:
                    writer.writerow({
                        'carrier': item['carrier'],
                        'group_name': item['group_name'],
                        'commission': f"{item['commission']:.2f}",
                        'state': item['state'],
                        'match_confidence': item['match_confidence']
                    })

            self.logger.info(f"Saved {len(self.review_items)} items needing review to {review_file}")

    def run(self):
        """Main execution method"""
        self.logger.info("=" * 60)
        self.logger.info("Commission Extraction Started")
        self.logger.info("=" * 60)

        self.process_all_pdfs()
        self.save_results()

        self.logger.info("=" * 60)
        self.logger.info("Commission Extraction Completed")
        self.logger.info(f"Total entries: {len(self.results)}")
        self.logger.info(f"Needs review: {len(self.review_items)}")
        self.logger.info("=" * 60)


if __name__ == "__main__":
    import argparse

    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Extract commission data from PDF statements')
    parser.add_argument('--month', type=str, help='Month to process in YYYY-MM format (e.g., 2025-08)',
                       default=datetime.now().strftime('%Y-%m'))
    args = parser.parse_args()

    # Validate month format
    try:
        datetime.strptime(args.month, '%Y-%m')
    except ValueError:
        print(f"ERROR: Invalid month format '{args.month}'. Use YYYY-MM (e.g., 2025-08)")
        exit(1)

    # Configuration with month-based paths
    BASE_DATA_DIR = "/home/sam/commission_automator/data/mbh"
    PDF_DIR = f"{BASE_DATA_DIR}/{args.month}/commission_statements"
    MASTER_CSV = f"{BASE_DATA_DIR}/master_data/mbh master contacts list.csv"
    OUTPUT_DIR = f"/home/sam/chatbot-platform/mbh/commission-automator/output/{args.month}"
    LOG_DIR = "/home/sam/chatbot-platform/mbh/commission-automator/logs"

    # Verify directories exist
    if not os.path.exists(PDF_DIR):
        print(f"ERROR: Commission statements directory not found: {PDF_DIR}")
        print(f"Please create the directory and add PDF files for {args.month}")
        exit(1)

    if not os.path.exists(MASTER_CSV):
        print(f"ERROR: Master contacts CSV not found: {MASTER_CSV}")
        exit(1)

    print(f"Processing commission statements for {args.month}")
    print(f"PDF Directory: {PDF_DIR}")
    print(f"Output Directory: {OUTPUT_DIR}")
    print()

    # Get Claude API key from environment variable
    CLAUDE_API_KEY = os.getenv('ANTHROPIC_API_KEY')

    # Run extractor
    extractor = CommissionExtractor(PDF_DIR, MASTER_CSV, OUTPUT_DIR, LOG_DIR, claude_api_key=CLAUDE_API_KEY)
    extractor.run()
