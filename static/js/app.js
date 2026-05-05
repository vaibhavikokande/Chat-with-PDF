/* ════════════════════════════════════════════════════════════
   Chat-with-PDF — frontend logic
════════════════════════════════════════════════════════════ */

"use strict";

// ── State ────────────────────────────────────────────────────
let sessionId    = null;
let isBusy       = false;   // true while a request is in-flight
let providerInfo = null;    // cached result from /api/provider

// ── DOM references ───────────────────────────────────────────
const uploadSection  = document.getElementById("upload-section");
const chatSection    = document.getElementById("chat-section");
const loadingOverlay = document.getElementById("loading-overlay");
const loaderText     = document.getElementById("loader-text");
const dropZone       = document.getElementById("drop-zone");
const fileInput      = document.getElementById("file-input");
const browseBtn      = document.getElementById("browse-btn");
const uploadError    = document.getElementById("upload-error");
const chatMessages   = document.getElementById("chat-messages");
const welcomeMsg     = document.getElementById("welcome-msg");
const suggestions    = document.getElementById("suggestions");
const messageInput   = document.getElementById("message-input");
const sendBtn        = document.getElementById("send-btn");
const clearChatBtn   = document.getElementById("clear-chat-btn");
const newPdfBtn      = document.getElementById("new-pdf-btn");
const pdfNameEl      = document.getElementById("pdf-name");
const pdfMetaEl      = document.getElementById("pdf-meta");
const providerBadge  = document.getElementById("provider-badge");
const providerLabel  = document.getElementById("provider-label");

// ════════════════════════════════════════════════════════════
// PROVIDER — fetch once on page load
// ════════════════════════════════════════════════════════════

(async () => {
  try {
    const res  = await fetch("/api/provider");
    providerInfo = await res.json();
  } catch (_) {
    providerInfo = { provider: null, label: "Unknown", model: "" };
  }
})();

function showProviderBadge() {
  if (!providerInfo || !providerInfo.provider) return;
  providerLabel.textContent = providerInfo.label;
  providerBadge.classList.remove("hidden");
}

// ════════════════════════════════════════════════════════════
// FILE UPLOAD — drag-and-drop + click
// ════════════════════════════════════════════════════════════

browseBtn.addEventListener("click", (e) => {
  e.stopPropagation();   // don't bubble to drop-zone
  fileInput.click();
});

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", (e) => {
  // Only remove the class when the cursor truly leaves the zone
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove("drag-over");
  }
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// ── Upload pipeline ──────────────────────────────────────────

async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    showUploadError("Only PDF files are supported. Please choose a .pdf file.");
    return;
  }

  hideUploadError();
  showLoader("Processing PDF…");

  const form = new FormData();
  form.append("file", file);

  try {
    const res  = await fetch("/upload", { method: "POST", body: form });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);

    sessionId = data.session_id;
    activateChatView(data);

  } catch (err) {
    showUploadError(err.message);
  } finally {
    hideLoader();
    fileInput.value = "";   // allow re-selecting same file
  }
}

function activateChatView(data) {
  // Populate sidebar metadata
  pdfNameEl.textContent = data.filename;
  pdfNameEl.title       = data.filename;
  pdfMetaEl.textContent =
    `${data.page_count} page${data.page_count !== 1 ? "s" : ""} · ${fmt(data.char_count)} chars`;

  // Reset chat UI
  chatMessages.innerHTML = "";
  chatMessages.appendChild(welcomeMsg);
  welcomeMsg.classList.remove("hidden");
  suggestions.classList.remove("hidden");

  messageInput.value = "";
  autoResize(messageInput);
  sendBtn.disabled = true;

  showProviderBadge();
  uploadSection.classList.add("hidden");
  chatSection.classList.remove("hidden");
  messageInput.focus();
}

// ════════════════════════════════════════════════════════════
// CHAT INTERACTIONS
// ════════════════════════════════════════════════════════════

// Auto-resize textarea
messageInput.addEventListener("input", () => {
  autoResize(messageInput);
  sendBtn.disabled = messageInput.value.trim() === "" || isBusy;
});

// Enter = send, Shift+Enter = newline
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener("click", () => sendMessage());

// Suggestion chips
suggestions.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const text = chip.dataset.text;
    if (text && !isBusy) sendMessage(text);
  });
});

// Clear chat
clearChatBtn.addEventListener("click", async () => {
  if (!sessionId || isBusy) return;

  try {
    await fetch("/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
  } catch (_) { /* non-critical */ }

  chatMessages.innerHTML = "";
  chatMessages.appendChild(welcomeMsg);
  welcomeMsg.classList.remove("hidden");
  suggestions.classList.remove("hidden");
  messageInput.focus();
});

// Upload new PDF
newPdfBtn.addEventListener("click", async () => {
  if (sessionId) {
    try {
      await fetch(`/sessions/${sessionId}`, { method: "DELETE" });
    } catch (_) { /* non-critical */ }
    sessionId = null;
  }

  chatSection.classList.add("hidden");
  uploadSection.classList.remove("hidden");
  hideUploadError();
});

// ── Core send function ───────────────────────────────────────

async function sendMessage(overrideText) {
  const text = (overrideText ?? messageInput.value).trim();
  if (!text || isBusy || !sessionId) return;

  isBusy = true;
  sendBtn.disabled = true;

  // Clear input only when it came from the textarea
  if (!overrideText) {
    messageInput.value = "";
    autoResize(messageInput);
  }

  // Hide the welcome / chips after the first real exchange
  welcomeMsg.classList.add("hidden");
  suggestions.classList.add("hidden");

  appendBubble("user", text);
  const typingEl = appendTyping();

  try {
    const res  = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, question: text }),
    });
    const data = await res.json();

    typingEl.remove();

    if (!res.ok) {
      appendBubble("assistant", data.error || "Something went wrong.", true);
    } else {
      appendBubble("assistant", data.answer);
    }

  } catch (err) {
    typingEl.remove();
    appendBubble(
      "assistant",
      "Network error — please check your connection and try again.",
      true
    );
  } finally {
    isBusy = false;
    sendBtn.disabled = messageInput.value.trim() === "";
    scrollBottom();
  }
}

// ════════════════════════════════════════════════════════════
// DOM BUILDERS
// ════════════════════════════════════════════════════════════

function appendBubble(role, content, isError = false) {
  const wrap   = document.createElement("div");
  wrap.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "You" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble" + (isError ? " is-error" : "");

  if (isError) {
    bubble.textContent = content;
  } else {
    bubble.innerHTML = renderMarkdown(content);
  }

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  scrollBottom();
  return wrap;
}

function appendTyping() {
  const wrap   = document.createElement("div");
  wrap.className = "msg assistant";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "AI";

  const bubble = document.createElement("div");
  bubble.className = "typing-bubble";
  bubble.innerHTML =
    `<span class="typing-dot"></span>
     <span class="typing-dot"></span>
     <span class="typing-dot"></span>`;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  scrollBottom();
  return wrap;
}

// ════════════════════════════════════════════════════════════
// MARKDOWN RENDERER
// Handles the most common Claude output patterns safely.
// Escapes HTML first, then injects only trusted tags.
// ════════════════════════════════════════════════════════════

function renderMarkdown(raw) {
  // 1. Escape HTML characters
  let s = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // 2. Stash fenced code blocks so inner content isn't processed
  const codeBlocks = [];
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(`<pre><code>${code.trimEnd()}</code></pre>`);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  // 3. Stash inline code
  const inlines = [];
  s = s.replace(/`([^`]+)`/g, (_, code) => {
    inlines.push(`<code>${code}</code>`);
    return `\x00IC${inlines.length - 1}\x00`;
  });

  // 4. Bold / italic
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g,         "<em>$1</em>");

  // 5. Headings (lines starting with #)
  s = s.replace(/^#{3} (.+)$/gm, "<h4>$1</h4>");
  s = s.replace(/^#{2} (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^# (.+)$/gm,    "<h2>$1</h2>");

  // 6. Unordered list items (- or *)
  s = s.replace(/^[ \t]*[-*] (.+)$/gm, "<li>$1</li>");
  s = s.replace(/(<li>[\s\S]*?<\/li>)(\n<li>[\s\S]*?<\/li>)*/g,
    (match) => `<ul>${match}</ul>`);

  // 7. Ordered list items
  s = s.replace(/^[ \t]*\d+\. (.+)$/gm, "<li>$1</li>");

  // 8. Paragraphs (blank-line-separated blocks)
  //    Split on double newlines, wrap each chunk in <p> unless already a block element
  const blockRe = /^<(h[2-4]|ul|ol|pre|li)/;
  s = s
    .split(/\n{2,}/)
    .map((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return "";
      if (blockRe.test(trimmed)) return trimmed;
      // Single newlines inside a paragraph → <br>
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  // 9. Restore stashed blocks
  codeBlocks.forEach((block, i) => {
    s = s.replace(`\x00CB${i}\x00`, block);
  });
  inlines.forEach((code, i) => {
    s = s.replace(`\x00IC${i}\x00`, code);
  });

  return s;
}

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

function scrollBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

function showLoader(msg = "Processing…") {
  loaderText.textContent = msg;
  loadingOverlay.classList.remove("hidden");
}
function hideLoader() {
  loadingOverlay.classList.add("hidden");
}

function showUploadError(msg) {
  uploadError.textContent = msg;
  uploadError.classList.remove("hidden");
}
function hideUploadError() {
  uploadError.classList.add("hidden");
}

function fmt(n) {
  return Number(n).toLocaleString();
}
