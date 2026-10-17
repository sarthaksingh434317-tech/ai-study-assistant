# 🎓 AI Study Assistant (StudyGenie)

A complete, modern, and professional web application designed to help students master any academic subject with the power of the **Google Gemini API** and **Python Flask**.

---

## 🌟 Key Features

1. **💬 AI Study Chat**  
   Interactive study tutor that clarifies concepts, solves step-by-step homework problems, and preserves conversational context.
2. **📝 Notes Generator**  
   Produces high-yield, structured study notes (Cornell style, comprehensive summaries, cheat sheets, and formula sheets) with one-click Markdown export (`.md`) and print support.
3. **📑 Topic Summarizer**  
   Distills dense textbooks, research papers, and complex topics into bulleted highlights and executive takeaways.
4. **❓ MCQ Generator**  
   Generates multiple-choice practice questions with customizable difficulty, 4 distinct options, verified answer keys, and pedagogical explanations.
5. **🎯 Practice Quiz (Interactive)**  
   An interactive test engine where students answer multiple-choice questions with real-time feedback, progress tracking, final score calculation, and in-depth question-by-question review.
6. **💡 Simple Explanation (ELI5)**  
   Explains intimidating, jargon-heavy concepts using delightful real-world analogies (food, sports, everyday life) tailored for beginners.

---

## 🛠️ Tech Stack

- **Backend:** Python 3, Flask, `google-genai` SDK, `python-dotenv`, `gunicorn`
- **Frontend:** HTML5, Modern CSS3 (CSS Variables, Flexbox/Grid, Responsive Mobile Drawer, Dark/Light Mode), Vanilla JavaScript (ES6+)
- **Libraries:** [Marked.js](https://marked.js.org/) for Markdown rendering, [Highlight.js](https://highlightjs.org/) for syntax highlighting, [Font Awesome 6](https://fontawesome.com/) for icons.
- **AI Engine:** Google Gemini API (`gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-3.8-flash` with automatic fallback).

---

## 📁 Project Structure

```
ai-study-assistant/
│
├── app.py                  # Flask application backend & Gemini API endpoints
├── requirements.txt        # Python package dependencies
├── .env.example            # Environment variables template
├── .gitignore              # Files excluded from git tracking
├── Procfile                # Gunicorn process definition for Render / Heroku
├── render.yaml             # Render Blueprint configuration
├── README.md               # Documentation and setup instructions
│
├── templates/
│   └── index.html          # Responsive single-page student dashboard
│
└── static/
    ├── style.css           # Modern styles, animations, dark/light themes
    └── script.js           # Interactive frontend & quiz engine
```

---

## 🚀 Local Setup Instructions

### 1. Clone or Open the Project
Ensure you are in the project folder:
```bash
cd ai-study-assistant
```

### 2. Create and Activate a Virtual Environment (Recommended)
On Windows (PowerShell):
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```
On macOS / Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Your Gemini API Key
1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   *(On Windows PowerShell: `Copy-Item .env.example .env`)*
3. Open `.env` and set your key:
   ```env
   GEMINI_API_KEY=AIzaSyYourActualGeminiApiKeyHere
   PORT=5000
   FLASK_ENV=development
   ```
> **Note:** You can also enter and verify your API key directly via the **Key Settings** button in the web application sidebar without restarting the server.

### 5. Run the Application
```bash
python app.py
```
Or with `py`:
```bash
py app.py
```

Open your browser and navigate to:
```
http://localhost:5000
```

---

## ☁️ Deployment Guide (Render)

This project is pre-configured for seamless deployment on [Render](https://render.com/) using **Gunicorn**.

### Method 1: Render Web Service via Git
1. Push this repository to GitHub or GitLab.
2. Log into [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
3. Connect your repository.
4. Configure the settings:
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
5. In the **Environment Variables** section, add:
   - `GEMINI_API_KEY`: *(Your Google AI Studio API Key)*
   - `PYTHON_VERSION`: `3.11.9` (or `3.12.0`)
6. Click **Deploy Web Service**.

### Method 2: Render Blueprint (`render.yaml`)
1. In Render, select **New +** -> **Blueprint**.
2. Connect your repository. Render will automatically read `render.yaml`.
3. Provide your `GEMINI_API_KEY` when prompted and click **Apply**.

---

## 📡 API Endpoints Reference

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/` | `GET` | Main student web dashboard |
| `/api/status` | `GET` | Health check and Gemini API connection status |
| `/api/set-key` | `POST` | Safely verify and configure API key at runtime |
| `/api/chat` | `POST` | AI Study Chat with context history |
| `/api/notes` | `POST` | Generate formatted study notes (supports subject, level, style) |
| `/api/summarize` | `POST` | Summarize long text or topic into key points |
| `/api/mcq` | `POST` | Generate practice MCQs with explanations |
| `/api/quiz` | `POST` | Generates structured JSON for the interactive quiz engine |
| `/api/explain` | `POST` | Simple ELI5 explanations with real-world metaphors |
| `/api/generate`| `POST` | Universal router endpoint accepting any feature |

---

## 🔒 Security Best Practices
- **No Hardcoded Keys:** Your `GEMINI_API_KEY` is loaded securely via environment variables and is never leaked or bundled into client-side HTML, CSS, or JS.
- **Git Protection:** `.env` is listed in `.gitignore` to prevent accidental commits of confidential API keys.
- **Graceful Error Handling:** Provides user-friendly alerts in the UI if quota is exceeded or if an API key is missing.

---

## 📄 License
MIT License. Built for students, educators, and lifelong learners everywhere!
