#!/usr/bin/env python3
"""
Interactive Commission Processor
Processes commissions with real-time user review for fuzzy matches
"""

import json
import asyncio
from pathlib import Path
from typing import Dict, List, Optional
import logging
from dataclasses import dataclass
from datetime import datetime

@dataclass
class ReviewItem:
    """Item requiring user review"""
    id: str
    carrier: str
    group_name: str
    commission: float
    best_match: Dict
    confidence: float
    alternatives: List[Dict]

class InteractiveProcessor:
    """Process commissions with user review pause points"""

    def __init__(self, month: str, websocket=None):
        self.month = month
        self.websocket = websocket
        self.review_queue = []
        self.corrections = {}
        self.learning_db = self._load_learning_db()

    def _load_learning_db(self) -> Dict:
        """Load previous user corrections for learning"""
        db_path = Path.home() / '.commission_learning.json'
        if db_path.exists():
            with open(db_path) as f:
                return json.load(f)
        return {}

    def _save_learning(self, original: str, corrected_state: str):
        """Save user corrections for future use"""
        self.learning_db[original] = corrected_state
        db_path = Path.home() / '.commission_learning.json'
        with open(db_path, 'w') as f:
            json.dump(self.learning_db, f, indent=2)

    async def process_with_review(self, pdf_files: List[Path]):
        """Process PDFs with pause for user review"""

        # Phase 1: Initial extraction
        await self._send_status("Extracting commission data...", phase="extraction", progress=0)

        all_entries = []
        for i, pdf in enumerate(pdf_files):
            entries = await self._extract_pdf(pdf)
            all_entries.extend(entries)

            progress = (i + 1) / len(pdf_files) * 100
            await self._send_status(
                f"Processed {pdf.name}",
                phase="extraction",
                progress=progress,
                current=i+1,
                total=len(pdf_files)
            )

        # Phase 2: State matching with review queue
        await self._send_status("Matching states...", phase="matching", progress=0)

        high_confidence = []
        needs_review = []

        for entry in all_entries:
            # Check if we've learned this before
            if entry['group_name'] in self.learning_db:
                entry['state'] = self.learning_db[entry['group_name']]
                entry['confidence'] = 100
                high_confidence.append(entry)
                continue

            # Try to match state
            match_result = self._fuzzy_match_state(entry['group_name'])

            if match_result['confidence'] >= 80:
                # High confidence - auto-assign
                entry['state'] = match_result['state']
                entry['confidence'] = match_result['confidence']
                high_confidence.append(entry)
            else:
                # Needs review
                review_item = ReviewItem(
                    id=f"{entry['carrier']}_{entry['group_name']}_{entry['commission']}",
                    carrier=entry['carrier'],
                    group_name=entry['group_name'],
                    commission=entry['commission'],
                    best_match=match_result,
                    confidence=match_result['confidence'],
                    alternatives=self._get_alternatives(entry['group_name'])
                )
                needs_review.append(review_item)

        await self._send_status(
            f"Found {len(high_confidence)} auto-matches, {len(needs_review)} need review",
            phase="review_needed",
            high_confidence=len(high_confidence),
            needs_review=len(needs_review)
        )

        # Phase 3: Interactive review
        if needs_review:
            reviewed = await self._interactive_review(needs_review)
            all_entries = high_confidence + reviewed
        else:
            all_entries = high_confidence

        # Phase 4: Generate report
        await self._send_status("Generating final report...", phase="report", progress=90)

        report_path = await self._generate_report(all_entries)

        await self._send_status(
            "Processing complete!",
            phase="complete",
            progress=100,
            report_path=str(report_path)
        )

        return report_path

    async def _interactive_review(self, items: List[ReviewItem]) -> List[Dict]:
        """Handle interactive review with user"""
        reviewed_entries = []

        for i, item in enumerate(items):
            # Send review request to frontend
            await self._send_review_request(item, i, len(items))

            # Wait for user response
            response = await self._wait_for_response(item.id)

            # Process response
            if response['action'] == 'confirm':
                state = item.best_match['state']
            elif response['action'] == 'change':
                state = response['new_state']
            elif response['action'] == 'skip':
                state = item.best_match['state']
            else:  # auto-approve all
                # Process remaining items with best matches
                for remaining in items[i:]:
                    reviewed_entries.append({
                        'carrier': remaining.carrier,
                        'group_name': remaining.group_name,
                        'commission': remaining.commission,
                        'state': remaining.best_match['state'],
                        'confidence': remaining.confidence,
                        'user_verified': False
                    })
                break

            # Save learning if requested
            if response.get('remember'):
                self._save_learning(item.group_name, state)

            # Add to reviewed entries
            reviewed_entries.append({
                'carrier': item.carrier,
                'group_name': item.group_name,
                'commission': item.commission,
                'state': state,
                'confidence': 100,  # User verified
                'user_verified': True
            })

            # Update progress
            progress = (i + 1) / len(items) * 100
            await self._send_status(
                f"Reviewed {i+1} of {len(items)}",
                phase="reviewing",
                progress=progress
            )

        return reviewed_entries

    async def _send_review_request(self, item: ReviewItem, current: int, total: int):
        """Send review request to frontend"""
        if self.websocket:
            await self.websocket.send(json.dumps({
                'type': 'review_request',
                'item': {
                    'id': item.id,
                    'carrier': item.carrier,
                    'group_name': item.group_name,
                    'commission': item.commission,
                    'best_match': item.best_match,
                    'confidence': item.confidence,
                    'alternatives': item.alternatives
                },
                'progress': {
                    'current': current + 1,
                    'total': total
                }
            }))

    async def _wait_for_response(self, item_id: str) -> Dict:
        """Wait for user response via websocket"""
        if self.websocket:
            while True:
                message = await self.websocket.recv()
                data = json.loads(message)
                if data['type'] == 'review_response' and data['item_id'] == item_id:
                    return data
        else:
            # Mock response for testing
            return {'action': 'confirm', 'remember': True}

    async def _send_status(self, message: str, **kwargs):
        """Send status update to frontend"""
        if self.websocket:
            await self.websocket.send(json.dumps({
                'type': 'status',
                'message': message,
                **kwargs
            }))
        else:
            print(f"Status: {message}", kwargs)

    async def _extract_pdf(self, pdf_path: Path) -> List[Dict]:
        """Extract commission data from PDF"""
        # This would call your existing extraction logic
        # For now, return mock data
        await asyncio.sleep(0.1)  # Simulate processing
        return []

    def _fuzzy_match_state(self, group_name: str) -> Dict:
        """Fuzzy match to find state"""
        # This would call your existing fuzzy matching
        # For now, return mock data
        return {
            'state': 'CA',
            'confidence': 75,
            'matched_name': 'Similar Company Inc'
        }

    def _get_alternatives(self, group_name: str) -> List[Dict]:
        """Get alternative state matches"""
        # Return top 3 alternatives
        return [
            {'state': 'WA', 'confidence': 65, 'name': 'Other Match'},
            {'state': 'OR', 'confidence': 60, 'name': 'Another Match'}
        ]

    async def _generate_report(self, entries: List[Dict]) -> Path:
        """Generate final report with all corrections"""
        # Your existing report generation
        report_path = Path(f"report_{self.month}.csv")
        return report_path


# WebSocket handler for real-time communication
async def handle_processing(websocket, month: str, files: List[str]):
    """Handle WebSocket connection for processing"""
    processor = InteractiveProcessor(month, websocket)
    pdf_files = [Path(f) for f in files]

    try:
        report_path = await processor.process_with_review(pdf_files)
        await websocket.send(json.dumps({
            'type': 'complete',
            'report_path': str(report_path)
        }))
    except Exception as e:
        await websocket.send(json.dumps({
            'type': 'error',
            'message': str(e)
        }))


if __name__ == "__main__":
    # Test without websocket
    processor = InteractiveProcessor("2025-10")
    asyncio.run(processor.process_with_review([]))