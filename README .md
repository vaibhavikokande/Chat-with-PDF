# 📄 Chat with your PDF

> Upload any PDF and have a real conversation with it — powered by Claude AI.

![Python](https://img.shields.io/badge/Python-3.8+-blue?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/Flask-3.x-black?style=flat-square&logo=flask)
![Anthropic](https://img.shields.io/badge/Claude-AI-orange?style=flat-square)
![Live](https://img.shields.io/badge/Live-Render-brightgreen?style=flat-square&logo=render)

🔗 **[Try the Live App →](https://chat-with-pdf-49dh.onrender.com)**

---

## ✨ What is this?

**Chat with your PDF** is a RAG (Retrieval-Augmented Generation) web app that lets you upload any PDF document and ask questions about it in a chat interface. Claude AI reads your document and answers questions **only from the content inside it** — no hallucinations, no made-up facts.

Whether it's a textbook, a research paper, a contract, or a report — just upload and start chatting.

---

## 🖥️ Live Demo

**👉 [https://chat-with-pdf-49dh.onrender.com](https://chat-with-pdf-49dh.onrender.com)**

```
Upload a PDF  →  Ask questions  →  Get grounded answers
```

**Example questions you can ask:**
- *"Summarize this document"*
- *"What are the key conclusions?"*
- *"List all the main topics covered"*
- *"What does the author say about X?"*

---

## 🚀 Features

- 📁 **Drag & drop or click** to upload any PDF
- 💬 **Multi-turn chat** — ask follow-up questions with conversation memory
- 🤖 **Powered by Claude AI** — accurate, grounded answers from your document
- 🌗 **Light & dark mode** — automatically matches your system theme
- ⚡ **Suggestion chips** — quick-start buttons for common questions
- 🔄 **Upload new PDF** anytime without restarting
- 🛡️ **No hallucinations** — Claude answers only from your document
- 🗑️ **Privacy-first** — PDF files are deleted from disk after text extraction

---

## 🧠 How RAG Works Here

```
Your PDF  +  Your Question  →  Claude AI  →  Grounded Answer
```

1. **Upload** — Your PDF is sent to the Flask backend
2. **Extract** — `pypdf` pulls all the text out of every page
3. **Store** — The extracted text is kept in memory (server-side session)
4. **Ask** — Your question + the PDF text are sent to Claude together
5. **Answer** — Claude answers *only* from the document — no outside knowledge
6. **Remember** — The last 10 exchanges are kept for follow-up questions

---

## 🗂️ Project Structure

```
Chat-with-PDF/
├── app.py                  ← Flask backend (API routes & Claude integration)
├── requirements.txt        ← Python dependencies
├── .env.example            ← Copy this to .env and add your API key
├── .gitignore              ← Keeps secrets out of Git
├── setup.bat               ← Windows: double-click to install everything
├── run.bat                 ← Windows: double-click to start the app
├── templates/
│   └── index.html          ← Main web page (upload zone + chat UI)
└── static/
    ├── css/
    │   └── style.css       ← Styling with light/dark mode
    └── js/
        └── app.js          ← Frontend logic (upload, chat, UI)
```

---

## ⚙️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | Python + Flask | Web server, API routes |
| AI | Anthropic Claude API | Reading PDF & answering questions |
| PDF Parsing | pypdf | Extracting text from PDF files |
| Frontend | HTML + CSS + Vanilla JS | User interface |
| Config | python-dotenv | Loading API key securely from `.env` |
| Networking | flask-cors | Allowing frontend ↔ backend communication |

---

## 📦 Installation

### Prerequisites

- Python 3.8 or higher → [Download](https://python.org)
- An Anthropic API key → [Get one here](https://console.anthropic.com)

---

### 🪟 Windows — One Click Setup

1. **Download or clone this repository**

```bash
git clone https://github.com/vaibhavikokande/Chat-with-PDF.git
cd Chat-with-PDF
```

2. **Double-click `setup.bat`**

The script will automatically:
- ✅ Check Python is installed
- ✅ Create a virtual environment
- ✅ Install all dependencies
- ✅ Open Notepad so you can paste your API key
- ✅ Launch the app and open your browser

3. **When Notepad opens**, replace `your-api-key-here` with your actual key:

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxx
```

Save and close Notepad. The app opens at **http://localhost:5000** automatically!

---

### 🐧 Mac / Linux — Manual Setup

```bash
# 1. Clone the repo
git clone https://github.com/vaibhavikokande/Chat-with-PDF.git
cd Chat-with-PDF

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Add your API key
cp .env.example .env
nano .env   # or open in any text editor

# 5. Run the app
python app.py
```

Open your browser at **http://localhost:5000**

---

### Running Again (after first setup)

**Windows:** Double-click `run.bat`

**Mac/Linux:**
```bash
source venv/bin/activate
python app.py
```

---

## 🔑 Environment Variables

Create a `.env` file in the root folder (copy from `.env.example`):

```env
ANTHROPIC_API_KEY=your-api-key-here
```

Get your API key at [console.anthropic.com](https://console.anthropic.com)

> ⚠️ Never commit your `.env` file — it's already in `.gitignore`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload a PDF, returns `session_id` |
| `POST` | `/ask` | Ask a question, returns Claude's answer |
| `POST` | `/reset` | Clear chat history for a session |
| `DELETE` | `/sessions/<id>` | Delete a session and free memory |

---

## 🛠️ Troubleshooting

**"Could not extract text from this PDF"**
> The PDF may be scanned (image-based). Try a text-based PDF instead.

**"Invalid API key"**
> Check your `.env` file. The key should start with `sk-ant-`.

**"Network error. Make sure Flask is running"**
> Make sure `python app.py` is still running in your terminal.

**Port 5000 already in use**
> Change the port in `app.py`: `app.run(debug=True, port=5001)`

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

- 🐛 Open an issue for bugs
- 💡 Suggest new features
- 🔀 Submit a pull request

---

## 📚 What I Learned Building This

This project covers these key concepts:

- **RAG (Retrieval-Augmented Generation)** — injecting documents into LLM context
- **Flask REST API** — building backend routes in Python
- **PDF text extraction** — using pypdf to parse documents
- **Prompt engineering** — writing system prompts that ground AI responses
- **Conversation history** — maintaining multi-turn chat with Claude
- **Frontend ↔ Backend** — connecting HTML/JS to a Python server via fetch API

---


