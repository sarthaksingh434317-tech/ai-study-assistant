import unittest
import json
from unittest.mock import patch, MagicMock
from app import app


class AIStudyAssistantTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_index_route(self):
        """Test home page renders successfully with proper templates and assets."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        self.assertIn("AI Study Assistant", html)
        self.assertIn("StudyGenie", html)
        self.assertIn("style.css", html)
        self.assertIn("script.js", html)
        # Verify all 6 feature panels exist in DOM
        self.assertIn("panel-chat", html)
        self.assertIn("panel-notes", html)
        self.assertIn("panel-summarize", html)
        self.assertIn("panel-mcq", html)
        self.assertIn("panel-quiz", html)
        self.assertIn("panel-explain", html)

    def test_status_endpoint(self):
        """Test API status endpoint returns valid JSON."""
        response = self.client.get("/api/status")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get("status"), "online")
        self.assertIn("hasApiKey", data)

    def test_endpoints_without_api_key_return_clean_error(self):
        """Test all 6 endpoints return clean, friendly error messages when API key is missing."""
        endpoints = [
            ("/api/chat", {"message": "What is gravity?"}),
            ("/api/notes", {"topic": "Photosynthesis"}),
            ("/api/summarize", {"content": "Long academic text..."}),
            ("/api/mcq", {"topic": "World War 2", "count": 3}),
            ("/api/quiz", {"topic": "Cell Biology", "count": 3}),
            ("/api/explain", {"topic": "Quantum Computing"}),
            ("/api/generate", {"feature": "notes", "topic": "Calculus"}),
        ]

        with patch("app.get_gemini_api_key", return_value=None):
            for url, payload in endpoints:
                with self.subTest(url=url):
                    response = self.client.post(
                        url,
                        data=json.dumps(payload),
                        content_type="application/json",
                    )
                    self.assertIn(response.status_code, [400, 500])
                    data = response.get_json()
                    self.assertFalse(data.get("success"))
                    self.assertIn("GEMINI_API_KEY", data.get("error", ""))

    def test_validation_empty_inputs(self):
        """Test endpoints validate empty input parameters correctly."""
        with patch("app.get_gemini_api_key", return_value="dummy_api_key"):
            # Empty chat message
            res = self.client.post("/api/chat", json={"message": ""})
            self.assertEqual(res.status_code, 400)
            self.assertFalse(res.get_json()["success"])

            # Empty notes topic
            res = self.client.post("/api/notes", json={"topic": ""})
            self.assertEqual(res.status_code, 400)

            # Empty summarize text
            res = self.client.post("/api/summarize", json={"content": ""})
            self.assertEqual(res.status_code, 400)

            # Empty MCQ topic
            res = self.client.post("/api/mcq", json={"topic": ""})
            self.assertEqual(res.status_code, 400)

            # Empty quiz topic
            res = self.client.post("/api/quiz", json={"topic": ""})
            self.assertEqual(res.status_code, 400)

            # Empty explain topic
            res = self.client.post("/api/explain", json={"topic": ""})
            self.assertEqual(res.status_code, 400)

    @patch("app.call_gemini")
    @patch("app.get_gemini_api_key", return_value="test_mock_api_key")
    def test_mock_chat_generation(self, mock_key, mock_call):
        """Test chat returns successful reply when Gemini responds."""
        mock_call.return_value = "Gravity is a fundamental interaction which causes mutual attraction between all things that have mass."
        response = self.client.post(
            "/api/chat",
            json={"message": "What is gravity?", "history": []}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertIn("Gravity", data["reply"])

    @patch("app.call_gemini")
    @patch("app.get_gemini_api_key", return_value="test_mock_api_key")
    def test_mock_notes_generation(self, mock_key, mock_call):
        """Test notes generation returns structured markdown."""
        mock_call.return_value = "# Photosynthesis Notes\n\n## 1. Overview\nProcess of converting light to sugar."
        response = self.client.post(
            "/api/notes",
            json={"topic": "Photosynthesis", "subject": "Biology", "level": "High School", "style": "Comprehensive"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertIn("Photosynthesis", data["notes"])

    @patch("app.call_gemini")
    @patch("app.get_gemini_api_key", return_value="test_mock_api_key")
    def test_mock_summarize_generation(self, mock_key, mock_call):
        """Test topic summarizer returns summary."""
        mock_call.return_value = "Key points: 1. Main idea\n2. Secondary evidence"
        response = self.client.post(
            "/api/summarize",
            json={"content": "Detailed article...", "length": "Short", "format": "Bullet Points"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertIn("Key points", data["summary"])

    @patch("app.call_gemini")
    @patch("app.get_gemini_api_key", return_value="test_mock_api_key")
    def test_mock_mcq_generation(self, mock_key, mock_call):
        """Test MCQ generator returns questions with options."""
        mock_call.return_value = "### Question 1: What is H2O?\n- A) Hydrogen peroxide\n- B) Water\n- C) Helium\n- D) Carbon\n**Correct Answer:** B) Water"
        response = self.client.post(
            "/api/mcq",
            json={"topic": "Water Chemistry", "count": 1, "difficulty": "Easy"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertIn("Water", data["mcqs"])

    @patch("app.call_gemini")
    @patch("app.get_gemini_api_key", return_value="test_mock_api_key")
    def test_mock_quiz_generation(self, mock_key, mock_call):
        """Test practice quiz returns structured JSON quiz object."""
        mock_quiz = {
            "title": "Cell Biology Quiz",
            "difficulty": "Medium",
            "questions": [
                {
                    "id": 1,
                    "question": "What is the powerhouse of the cell?",
                    "options": ["Ribosome", "Nucleus", "Mitochondria", "Chloroplast"],
                    "correct_index": 2,
                    "explanation": "Mitochondria produce ATP through cellular respiration."
                }
            ]
        }
        mock_call.return_value = mock_quiz
        response = self.client.post(
            "/api/quiz",
            json={"topic": "Cell Biology", "count": 1, "difficulty": "Medium"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["quiz"]["questions"][0]["correct_index"], 2)

    @patch("app.call_gemini")
    @patch("app.get_gemini_api_key", return_value="test_mock_api_key")
    def test_mock_explain_generation(self, mock_key, mock_call):
        """Test simple explanation returns analogy-based explanation."""
        mock_call.return_value = "Think of a CPU like the head chef in a busy restaurant kitchen..."
        response = self.client.post(
            "/api/explain",
            json={"topic": "Central Processing Unit", "audience": "10-year-old child", "theme": "Cooking"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertIn("chef", data["explanation"])

    @patch("app.call_gemini")
    @patch("app.get_gemini_api_key", return_value="test_mock_api_key")
    def test_unified_generate_endpoint(self, mock_key, mock_call):
        """Test unified /api/generate endpoint routes properly."""
        mock_call.return_value = "Unified test notes output."
        response = self.client.post(
            "/api/generate",
            json={"feature": "notes", "topic": "Newtonian Physics"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])


if __name__ == "__main__":
    unittest.main()
