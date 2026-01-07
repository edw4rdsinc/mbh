#!/usr/bin/env python3
"""
State Summary Report Generator
Reads commission_output.csv and generates state-level subtotals
"""

import csv
import os
from pathlib import Path
from datetime import datetime
from collections import defaultdict


def generate_state_summary(input_csv: str, output_csv: str):
    """
    Generate state subtotals from commission output

    Args:
        input_csv: Path to commission_output.csv
        output_csv: Path to save state_summary.csv
    """
    input_path = Path(input_csv)
    output_path = Path(output_csv)

    if not input_path.exists():
        print(f"Error: Input file not found: {input_csv}")
        return False

    # Read commission data and calculate state totals
    state_totals = defaultdict(float)
    total_entries = 0
    total_commission = 0.0

    print(f"Reading commission data from: {input_csv}")

    with open(input_path, 'r') as f:
        reader = csv.DictReader(f)

        for row in reader:
            state = row.get('state', '').strip()
            commission = float(row.get('commission', 0))

            # Handle empty states (like Guardian totals)
            if not state:
                state = 'NO STATE'

            state_totals[state] += commission
            total_commission += commission
            total_entries += 1

    print(f"\nProcessed {total_entries} commission entries")
    print(f"Found {len(state_totals)} unique states")

    # Sort states by total commission (descending)
    sorted_states = sorted(state_totals.items(), key=lambda x: x[1], reverse=True)

    # Write state summary
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['State', 'Total Commission', 'Percentage of Total'])

        for state, total in sorted_states:
            percentage = (total / total_commission * 100) if total_commission > 0 else 0
            writer.writerow([state, f"{total:.2f}", f"{percentage:.2f}%"])

        # Add grand total row
        writer.writerow([''])
        writer.writerow(['GRAND TOTAL', f"{total_commission:.2f}", '100.00%'])

    print(f"\n✓ State summary saved to: {output_csv}")

    # Print summary to console
    print("\n" + "=" * 60)
    print("STATE COMMISSION SUMMARY")
    print("=" * 60)
    print(f"{'State':<20} {'Total Commission':>20} {'% of Total':>15}")
    print("-" * 60)

    for state, total in sorted_states:
        percentage = (total / total_commission * 100) if total_commission > 0 else 0
        print(f"{state:<20} ${total:>19,.2f} {percentage:>14.2f}%")

    print("-" * 60)
    print(f"{'GRAND TOTAL':<20} ${total_commission:>19,.2f} {'100.00%':>15}")
    print("=" * 60)

    return True


if __name__ == "__main__":
    import argparse

    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Generate state summary report')
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
    BASE_OUTPUT_DIR = "/home/sam/chatbot-platform/mbh/commission-automator/output"
    month_output_dir = f"{BASE_OUTPUT_DIR}/{args.month}"

    INPUT_CSV = f"{month_output_dir}/commission_output.csv"
    OUTPUT_CSV = f"{month_output_dir}/state_summary.csv"

    print("=" * 60)
    print("State Summary Report Generator")
    print(f"Processing: {args.month}")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    success = generate_state_summary(INPUT_CSV, OUTPUT_CSV)

    if success:
        print("\n✓ State summary generation completed successfully!")
    else:
        print("\n✗ State summary generation failed")
        exit(1)
