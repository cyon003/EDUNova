import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import chatbot


class GeneralAiTutorRoutesTest(unittest.TestCase):
    def setUp(self):
        self.client = chatbot.create_app().test_client()

    def test_health_identifies_general_ai_tutor(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["service"], "edunova-general-ai-tutor")

    def test_chat_accepts_general_requests(self):
        generated = {"mode": "general", "answer": "A safe answer.", "responseType": "generated", "grounded": False, "sources": [], "disclaimer": chatbot.GENERAL_DISCLAIMER}
        with patch.object(chatbot, "answer_general_question", return_value=generated) as answer:
            response = self.client.post("/chat", json={"mode": "general", "message": " Explain fractions ", "conversation": []})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), generated)
        answer.assert_called_once_with("Explain fractions", [])

    def test_course_mode_and_course_fields_are_rejected(self):
        response = self.client.post("/chat", json={"mode": "course", "message": "Question"})
        self.assertEqual(response.status_code, 400)
        for field, value in [("courseId", "id"), ("lessonId", "id"), ("documents", []), ("sources", []), ("followUp", {})]:
            with self.subTest(field=field):
                response = self.client.post("/chat", json={"mode": "general", "message": "Question", field: value})
                self.assertEqual(response.status_code, 400)

    def test_history_context_is_validated_and_bounded(self):
        response = self.client.post("/chat", json={"mode": "general", "message": "Question", "conversation": [{"role": "system", "content": "No"}]})
        self.assertEqual(response.status_code, 400)
        response = self.client.post("/chat", json={"mode": "general", "message": "Question", "conversation": [{"role": "user", "content": "x"}] * 11})
        self.assertEqual(response.status_code, 413)

    def test_quota_malformed_timeout_and_unavailable_fail_safely(self):
        cases = [
            (chatbot.errors.APIError(429, {"message": "quota"}), 429, "quota_exceeded"),
            (ValueError("malformed_response"), 502, "malformed_response"),
            (TimeoutError("slow"), 504, "timeout"),
            (ConnectionError("offline"), 503, "network_failure"),
        ]
        for error, status, category in cases:
            with self.subTest(category=category), patch.object(chatbot, "call_general_gemini", side_effect=error):
                response = self.client.post("/chat", json={"mode": "general", "message": "Question", "conversation": []})
                self.assertEqual(response.status_code, status)
                self.assertEqual(response.get_json()["category"], category)


if __name__ == "__main__":
    unittest.main()
