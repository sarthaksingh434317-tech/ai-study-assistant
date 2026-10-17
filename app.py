import os
import json
import logging
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Preferred Gemini models in priority order
MODELS_TO_TRY = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-1.5-flash"]

# In-memory runtime override for API key (useful if user sets via web UI session)
_runtime_api_key = None


def get_gemini_api_key():
    """Retrieve Gemini API key from runtime override or environment variables."""
    global _runtime_api_key
    if _runtime_api_key:
        return _runtime_api_key
    key = os.getenv("GEMINI_API_KEY", "").strip()
    # Filter out empty or placeholder keys
    if key and key != "your_gemini_api_key_here":
        return key
    return None


def call_gemini(contents, system_instruction=None, json_mode=False, temperature=0.7):
    """
    Call the Google Gemini API using google-genai SDK with automatic model fallback.
    Returns the string text or parsed JSON dictionary.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is not configured. Please add your Gemini API key to a .env file "
            "or set it in your environment variables. You can get a free key at https://aistudio.google.com/app/apikey"
        )

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise RuntimeError("google-genai package is not installed. Please run `pip install -r requirements.txt`.")

    client = genai.Client(api_key=api_key)

    config_args = {
        "temperature": temperature,
    }
    if system_instruction:
        config_args["system_instruction"] = system_instruction
    if json_mode:
        config_args["response_mime_type"] = "application/json"

    config = types.GenerateContentConfig(**config_args)

    last_error = None
    for model_name in MODELS_TO_TRY:
        try:
            logger.info("Calling Gemini API with model: %s", model_name)
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )

            text = response.text
            if not text:
                raise ValueError("Received empty response from Gemini API.")

            if json_mode:
                # Clean potential markdown wrapping if returned
                cleaned_text = text.strip()
                if cleaned_text.startswith("```json"):
                    cleaned_text = cleaned_text[7:]
                if cleaned_text.startswith("```"):
                    cleaned_text = cleaned_text[3:]
                if cleaned_text.endswith("```"):
                    cleaned_text = cleaned_text[:-3]
                cleaned_text = cleaned_text.strip()
                return json.loads(cleaned_text)

            return text
        except Exception as e:
            last_error = e
            err_msg = str(e)
            logger.warning("Model %s failed with: %s", model_name, err_msg)
            # If it's an invalid key or permission error, no need to retry other models
            if any(k in err_msg for k in ["API_KEY_INVALID", "API key not valid", "PERMISSION_DENIED", "403"]):
                raise ValueError("Invalid Gemini API Key. Please verify your key at https://aistudio.google.com/app/apikey")
            # Continue to next model if available

    # If all models failed
    err_str = str(last_error)
    if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str:
        raise ValueError("Gemini API rate limit or quota exceeded. Please wait a moment and try again.")
    raise RuntimeError(f"Gemini API request failed: {err_str}")


@app.route("/")
def index():
    """Render the main single-page dashboard."""
    return render_template("index.html")


@app.route("/api/status", methods=["GET"])
def check_status():
    """Return backend status and whether Gemini API key is configured."""
    key = get_gemini_api_key()
    return jsonify({
        "status": "online",
        "hasApiKey": bool(key),
        "activeModel": MODELS_TO_TRY[0]
    })


@app.route("/api/set-key", methods=["POST"])
def set_runtime_key():
    """Optionally configure or test an API key from the frontend without file editing."""
    global _runtime_api_key
    data = request.get_json() or {}
    key = data.get("apiKey", "").strip()
    if not key:
        return jsonify({"success": False, "error": "API key cannot be empty"}), 400

    # Test key with a lightweight prompt
    try:
        from google import genai
        client = genai.Client(api_key=key)
        response = client.models.generate_content(
            model=MODELS_TO_TRY[0],
            contents="Say 'OK' in one word."
        )
        _runtime_api_key = key
        logger.info("Successfully validated and configured new runtime Gemini API key.")
        return jsonify({
            "success": True,
            "message": "Gemini API key verified and connected successfully!"
        })
    except Exception as e:
        logger.error("Failed to validate supplied API key: %s", e)
        return jsonify({
            "success": False,
            "error": f"API key validation failed: {str(e)}"
        }), 400


@app.route("/api/chat", methods=["POST"])
def api_chat():
    """Feature 1: AI Study Chat - Interactive question answering with conversational memory."""
    try:
        data = request.get_json() or {}
        user_message = data.get("message", "").strip()
        history = data.get("history", [])

        if not user_message:
            return jsonify({"success": False, "error": "Message cannot be empty."}), 400

        system_instruction = (
            "You are an expert, encouraging, and empathetic AI Study Assistant for students. "
            "Your mission is to make learning engaging, clear, and easy to understand. "
            "Structure your answers cleanly with markdown headings, bullet points, concise explanations, "
            "and code/formula blocks whenever relevant. Always encourage curiosity and critical thinking."
        )

        # Build prompt incorporating history
        contents = []
        for msg in history[-8:]:  # keep last 8 messages for context
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if content:
                contents.append(f"{role.capitalize()}: {content}")
        contents.append(f"Student: {user_message}")
        full_prompt = "\n\n".join(contents)

        reply = call_gemini(full_prompt, system_instruction=system_instruction)
        return jsonify({"success": True, "reply": reply})

    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        logger.exception("Error in /api/chat: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/notes", methods=["POST"])
def api_notes():
    """Feature 2: Notes Generator - Generate comprehensive, well-structured study notes."""
    try:
        data = request.get_json() or {}
        topic = data.get("topic", "").strip()
        subject = data.get("subject", "General").strip()
        level = data.get("level", "High School / College").strip()
        style = data.get("style", "Comprehensive").strip()

        if not topic:
            return jsonify({"success": False, "error": "Please provide a study topic."}), 400

        system_instruction = (
            "You are a master academic educator and notes specialist. "
            "Create high-yield, beautifully structured revision study notes optimized for students. "
            "Use clear Markdown formatting with rich headers, bullet points, callout boxes, bold terms, "
            "practical examples, and quick memory aids."
        )

        prompt = f"""
Please generate professional study notes for the following:
- Topic: {topic}
- Subject/Field: {subject}
- Academic Level: {level}
- Note Style: {style}

Structure the study notes using this standard framework:
1. 🎯 Overview & Learning Objectives (High-level summary in 2-3 sentences)
2. 🔑 Core Concepts & Key Terminology (Precise definitions and principles)
3. 🔬 Deep-Dive Explanation & Mechanics (Detailed breakdown with bullet points)
4. 💡 Practical Examples / Real-World Applications
5. ⚡ Memory Mnemonics, Rules of Thumb & Common Pitfalls to Avoid
6. 📝 Quick Self-Check Review Questions (3 questions to test comprehension)

Ensure the notes are comprehensive, precise, engaging, and easy to review before exams.
"""
        notes = call_gemini(prompt, system_instruction=system_instruction)
        return jsonify({"success": True, "notes": notes, "topic": topic})

    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        logger.exception("Error in /api/notes: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/summarize", methods=["POST"])
def api_summarize():
    """Feature 3: Topic Summarizer - Summarize difficult topics or long study texts."""
    try:
        data = request.get_json() or {}
        content = data.get("content", "").strip()
        length = data.get("length", "Medium").strip()
        format_type = data.get("format", "Bullet Points").strip()

        if not content:
            return jsonify({"success": False, "error": "Please provide text or a topic to summarize."}), 400

        system_instruction = (
            "You are an expert executive summarizer and educational condenser. "
            "Your job is to distill dense academic material or complex topics into clear, concise, "
            "high-retention summaries without losing critical meaning."
        )

        prompt = f"""
Summarize the following topic or educational text:
---
{content}
---

Specifications:
- Length: {length} (e.g. Short = ~100 words, Medium = ~250 words, Detailed = ~450 words)
- Preferred Format: {format_type} (e.g. Bullet Points, Executive Paragraph, Key Takeaways + Outline)

Include:
- 📌 The Core Thesis / Big Idea (1 sentence)
- 📋 Main Points & Key Arguments
- 💡 Crucial Takeaways & Implications
- ⚠️ Important Nuances or Exceptions (if any)
"""
        summary = call_gemini(prompt, system_instruction=system_instruction)
        return jsonify({"success": True, "summary": summary})

    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        logger.exception("Error in /api/summarize: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/mcq", methods=["POST"])
def api_mcq():
    """Feature 4: MCQ Generator - Create multiple-choice questions with answers & explanations."""
    try:
        data = request.get_json() or {}
        topic = data.get("topic", "").strip()
        count = int(data.get("count", 5))
        difficulty = data.get("difficulty", "Medium").strip()

        if not topic:
            return jsonify({"success": False, "error": "Please provide a topic for MCQ generation."}), 400

        count = max(1, min(count, 15))  # Keep between 1 and 15

        system_instruction = (
            "You are an expert exam question creator and professor. "
            "Create high-quality, unambiguous multiple-choice questions with 4 distinct options (A, B, C, D), "
            "clearly marked correct answers, and thorough pedagogical explanations."
        )

        prompt = f"""
Generate {count} Multiple-Choice Questions (MCQs) on the topic: '{topic}'.
Difficulty Level: {difficulty}

Format each question strictly in markdown as follows:
### Question [N]: [Question text]
- A) [Option A]
- B) [Option B]
- C) [Option C]
- D) [Option D]

**Correct Answer:** [Option Letter and text]
**Explanation:** [Detailed explanation of why this answer is correct and why other options are incorrect]

---
"""
        mcqs = call_gemini(prompt, system_instruction=system_instruction)
        return jsonify({"success": True, "mcqs": mcqs, "topic": topic, "count": count})

    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        logger.exception("Error in /api/mcq: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/quiz", methods=["POST"])
def api_quiz():
    """Feature 5: Practice Quiz - Generates an interactive structured quiz in JSON."""
    try:
        data = request.get_json() or {}
        topic = data.get("topic", "").strip()
        count = int(data.get("count", 5))
        difficulty = data.get("difficulty", "Medium").strip()

        if not topic:
            return jsonify({"success": False, "error": "Please provide a quiz topic."}), 400

        count = max(1, min(count, 10))

        system_instruction = (
            "You are an assessment engine. You must output strictly valid JSON matching the exact schema requested. "
            "Do not include any conversational text outside the JSON structure."
        )

        prompt = f"""
Create an interactive practice quiz with {count} questions for students on: '{topic}'.
Difficulty Level: {difficulty}.

Respond ONLY with a single valid JSON object following this exact structure:
{{
  "title": "{topic} Practice Quiz",
  "difficulty": "{difficulty}",
  "questions": [
    {{
      "id": 1,
      "question": "Question text here?",
      "options": [
        "First option",
        "Second option",
        "Third option",
        "Fourth option"
      ],
      "correct_index": 0,
      "explanation": "Clear explanation of why option 0 is correct."
    }}
  ]
}}

Requirements:
- options MUST be an array of exactly 4 strings.
- correct_index MUST be an integer (0, 1, 2, or 3) corresponding to the index in options.
- explanation MUST be thorough and educational.
"""
        quiz_data = call_gemini(prompt, system_instruction=system_instruction, json_mode=True)
        return jsonify({"success": True, "quiz": quiz_data})

    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        logger.exception("Error in /api/quiz: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/explain", methods=["POST"])
def api_explain():
    """Feature 6: Simple Explanation - Explain difficult concepts in easy-to-understand language (ELI5)."""
    try:
        data = request.get_json() or {}
        topic = data.get("topic", "").strip()
        target_audience = data.get("audience", "10-year-old child").strip()
        analogy_theme = data.get("theme", "Everyday Life & Food").strip()

        if not topic:
            return jsonify({"success": False, "error": "Please provide a concept to explain."}), 400

        system_instruction = (
            "You are a gifted science and academic communicator, celebrated for making the most complex, "
            "intimidating concepts crystal clear to anyone using delightful analogies, vivid metaphors, "
            "and simple, friendly language without dumbing down the core truth."
        )

        prompt = f"""
Explain the concept of '{topic}' in simple, intuitive terms.
Target Audience: {target_audience}
Analogy Style/Theme: {analogy_theme}

Please format the response nicely in Markdown with these sections:
1. 💡 The Big Idea in One Simple Sentence
2. 🍕 The "Imagine This" Analogy (Use the requested {analogy_theme} theme)
3. ⚙️ How It Works (Step-by-step, zero confusing jargon)
4. 🌟 Why It Actually Matters in Real Life
5. 🚫 Common Misconceptions Busted!
"""
        explanation = call_gemini(prompt, system_instruction=system_instruction)
        return jsonify({"success": True, "explanation": explanation, "topic": topic})

    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        logger.exception("Error in /api/explain: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/generate", methods=["POST"])
def api_generate():
    """
    Unified router endpoint supporting 'Generate Answer' POST requests.
    Dispatches to the appropriate feature logic based on 'feature' parameter.
    """
    data = request.get_json() or {}
    feature = data.get("feature", "chat").lower()

    if feature == "notes":
        return api_notes()
    elif feature == "summarize" or feature == "summarizer":
        return api_summarize()
    elif feature == "mcq":
        return api_mcq()
    elif feature == "quiz":
        return api_quiz()
    elif feature == "explain":
        return api_explain()
    else:
        # Default to chat or general prompt
        user_message = data.get("prompt") or data.get("message") or data.get("topic") or ""
        if not user_message:
            return jsonify({"success": False, "error": "Prompt or topic is required."}), 400
        try:
            result = call_gemini(user_message)
            return jsonify({"success": True, "result": result, "reply": result})
        except ValueError as ve:
            return jsonify({"success": False, "error": str(ve)}), 400
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500


@app.errorhandler(404)
def not_found(e):
    return jsonify({"success": False, "error": "Route not found"}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"success": False, "error": "Internal server error"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("FLASK_ENV", "development").lower() == "development"
    print(f"Starting AI Study Assistant server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
