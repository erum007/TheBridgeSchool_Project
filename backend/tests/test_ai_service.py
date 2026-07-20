import unittest

from backend.services.ai_service import parse_ai_response


class AIServiceParsingTests(unittest.TestCase):
    def test_parse_ai_response_extracts_summary_decisions_and_actions(self):
        raw_response = '''{
            "summary": "The team aligned on the term launch plan.",
            "key_decisions": [
                "Launch the parent outreach campaign next week.",
                "Approve the revised attendance intervention plan."
            ],
            "action_items": [
                {
                    "task": "Send the outreach email",
                    "owner": "Head Teacher",
                    "due_date": "2026-07-15"
                }
            ]
        }'''

        result = parse_ai_response(raw_response)

        self.assertEqual(result['summary'], 'The team aligned on the term launch plan.')
        self.assertEqual(result['key_decisions'][0], 'Launch the parent outreach campaign next week.')
        self.assertEqual(result['action_items'][0]['task'], 'Send the outreach email')
        self.assertEqual(result['action_items'][0]['owner'], 'Head Teacher')


if __name__ == '__main__':
    unittest.main()
