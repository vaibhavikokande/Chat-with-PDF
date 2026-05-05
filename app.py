import os
import uuid
import time
import tempfile
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from pypdf import PdfReader
import anthropic
import groq as groq_module
from dotenv import load_dotenv

# override=True forces .env values to win even if the OS already exported the
# variable (e.g. a blank ANTHROPIC_API_KEY exported by the shell).
load_dotenv(override=True)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", os.urandom(32).hex())
CORS(app)

# In-memory store: {session_id: {filename, page_count, text, history, created_at}}
sessions: dict = {}
MAX_HISTORY = 20   # rolling window of messages kept per session

# ---------------------------------------------------------------------------
# Provider detection
# ---------------------------------------------------------------------------

PROVIDERS = {
    # Groq is checked first — it's free and needs no credits.
    # Add credits to Anthropic and flip this order if you prefer Claude.
    "groq": {
        "label": "Llama 3.3 · Groq (free)",
        "model":  "llama-3.3-70b-versatile",
        "env":    "GROQ_API_KEY",
    },
    "anthropic": {
        "label": "Claude (Anthropic)",
        "model":  "claude-opus-4-5",
        "env":    "ANTHROPIC_API_KEY",
    },
}

SYSTEM_TEMPLATE = (
    "You are a precise document assistant. "
    "Answer ONLY from the document provided below. "
    "If the answer cannot be found in the document, say exactly: "
    "\"I couldn't find that information in the document.\" "
    "Be concise and accurate. Cite page numbers where helpful.\n\n"
    "=== DOCUMENT START ===\n{text}\n=== DOCUMENT END ==="
)


def detect_provider() -> tuple[str | None, str]:
    """
    Return (provider_name, api_key).
    Priority: Anthropic first (paid, higher quality), then Groq (free).
    Returns (None, '') if neither key is configured.
    """
    for name, cfg in PROVIDERS.items():
        key = os.getenv(cfg["env"], "").strip()
        if key and key not in ("your_api_key_here", "your_groq_key_here"):
            return name, key
    return None, ""


# ---------------------------------------------------------------------------
# AI call (abstracted over both providers)
# ---------------------------------------------------------------------------

def call_ai(session_text: str, history: list, question: str) -> str:
    provider, api_key = detect_provider()

    if provider is None:
        raise ValueError(
            "No AI provider configured. "
            "Set ANTHROPIC_API_KEY (Anthropic) or GROQ_API_KEY (Groq — free) "
            "in your .env file, then restart the server."
        )

    system = SYSTEM_TEMPLATE.format(text=session_text)

    # Build alternating user/assistant history
    messages = [
        {"role": m["role"], "content": m["content"]}
        for m in history
    ]
    messages.append({"role": "user", "content": question})

    if provider == "anthropic":
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model=PROVIDERS["anthropic"]["model"],
            max_tokens=2048,
            system=system,
            messages=messages,
        )
        return resp.content[0].text

    # ── Groq (free) ──────────────────────────────────────────────────────────
    client = groq_module.Groq(api_key=api_key)
    # Groq uses the OpenAI chat format: system goes inside messages[]
    groq_messages = [{"role": "system", "content": system}] + messages
    resp = client.chat.completions.create(
        model=PROVIDERS["groq"]["model"],
        messages=groq_messages,
        max_tokens=2048,
    )
    return resp.choices[0].message.content


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_pdf_text(path: str) -> tuple[str, int]:
    """Return (full_text, page_count). Raises ValueError on empty extraction."""
    reader = PdfReader(path)
    page_count = len(reader.pages)
    parts = []
    for i, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        if page_text.strip():
            parts.append(f"[Page {i}]\n{page_text.strip()}")
    text = "\n\n".join(parts)
    if not text.strip():
        raise ValueError(
            "No readable text found in this PDF. "
            "It may be a scanned or image-based document."
        )
    return text, page_count


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/health")
def health():
    provider, _ = detect_provider()
    return jsonify({"status": "ok", "provider": provider or "none"})


@app.route("/api/provider")
def api_provider():
    """Tell the frontend which AI provider is active."""
    provider, _ = detect_provider()
    if provider:
        return jsonify({
            "provider": provider,
            "label":    PROVIDERS[provider]["label"],
            "model":    PROVIDERS[provider]["model"],
        })
    return jsonify({"provider": None, "label": "No provider configured", "model": ""})


@app.route("/upload", methods=["POST"])
def upload_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file field in request."}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported."}), 400

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        text, page_count = extract_pdf_text(tmp_path)

    except ValueError as exc:
        return jsonify({"error": str(exc)}), 422
    except Exception as exc:
        return jsonify({"error": f"Failed to read PDF: {exc}"}), 500
    finally:
        # Always delete the temp file from disk immediately
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "filename":   file.filename,
        "page_count": page_count,
        "text":       text,
        "history":    [],
        "created_at": time.time(),
    }

    return jsonify({
        "session_id": session_id,
        "filename":   file.filename,
        "page_count": page_count,
        "char_count": len(text),
    })


@app.route("/ask", methods=["POST"])
def ask():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON."}), 400

    session_id = (body.get("session_id") or "").strip()
    question   = (body.get("question")   or "").strip()

    if not session_id or session_id not in sessions:
        return jsonify({
            "error": "Session not found or expired. Please upload your PDF again."
        }), 404

    if not question:
        return jsonify({"error": "Question cannot be empty."}), 400

    session = sessions[session_id]

    try:
        answer = call_ai(session["text"], session["history"], question)

    # ── Anthropic errors ──────────────────────────────────────────────────
    except anthropic.AuthenticationError:
        return jsonify({
            "error": "Invalid Anthropic API key. Check ANTHROPIC_API_KEY in .env."
        }), 401
    except anthropic.RateLimitError:
        return jsonify({
            "error": "Anthropic rate limit reached. Please wait a moment and try again."
        }), 429
    except anthropic.APIStatusError as exc:
        return jsonify({
            "error": f"Anthropic API error ({exc.status_code}): {exc.message}"
        }), 502

    # ── Groq errors ───────────────────────────────────────────────────────
    except groq_module.AuthenticationError:
        return jsonify({
            "error": "Invalid Groq API key. Check GROQ_API_KEY in .env."
        }), 401
    except groq_module.RateLimitError:
        return jsonify({
            "error": "Groq rate limit reached. Please wait a moment and try again."
        }), 429
    except groq_module.APIStatusError as exc:
        return jsonify({
            "error": f"Groq API error: {exc.message}"
        }), 502

    # ── Generic ───────────────────────────────────────────────────────────
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception as exc:
        return jsonify({"error": f"Unexpected error: {exc}"}), 500

    # Persist to rolling history window
    session["history"].append({"role": "user",      "content": question})
    session["history"].append({"role": "assistant",  "content": answer})
    if len(session["history"]) > MAX_HISTORY:
        session["history"] = session["history"][-MAX_HISTORY:]

    return jsonify({"answer": answer})


@app.route("/reset", methods=["POST"])
def reset_chat():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON."}), 400

    session_id = (body.get("session_id") or "").strip()
    if not session_id or session_id not in sessions:
        return jsonify({"error": "Session not found."}), 404

    sessions[session_id]["history"] = []
    return jsonify({"success": True})


@app.route("/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
        return jsonify({"success": True})
    return jsonify({"error": "Session not found."}), 404


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "development") != "production"
    app.run(debug=debug, port=port, host="0.0.0.0")
