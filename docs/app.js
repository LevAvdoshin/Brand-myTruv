import { marked } from "https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js";

// Load Markdown from GitHub raw (source of truth) with cache-bust, fallback to same-origin if needed.
const rawBase = "https://raw.githubusercontent.com/Globalgenerations/Brand-myTruv/main";
const localBase = ".";

const docs = [
  {
    id: "brand",
    title: "Brand guide",
    file: "brand.md",
    description: "Essence, promise, feelings, and how we show up.",
    badge: "Core",
  },
  {
    id: "positioning",
    title: "Positioning",
    file: "positioning.md",
    description: "Market frame, differentiation, and promises.",
    badge: "Framing",
  },
  {
    id: "messaging",
    title: "Messaging",
    file: "messaging.md",
    description: "Language, one-liners, and stories for real surfaces.",
    badge: "Voice",
  },
  {
    id: "personas",
    title: "Personas",
    file: "personas.md",
    description: "Audience patterns, motivations, and tone shifts.",
    badge: "Audience",
  },
  {
    id: "seo",
    title: "SEO & content",
    file: "seo.md",
    description: "Keyword clusters, angles, and IA for discovery.",
    badge: "Growth",
  },
  {
    id: "overview",
    title: "Overview",
    file: "README.md",
    description: "How to navigate the brand system and update rules.",
    badge: "Index",
  },
];

const docsMap = docs.reduce((acc, doc) => {
  acc[doc.id] = doc;
  return acc;
}, {});

const docEmojis = {
  brand: "✨",
  positioning: "🧭",
  messaging: "✍️",
  personas: "",
  seo: "🔍",
  overview: "📑",
};

const categories = [
  {
    id: "brand-story",
    title: "Brand & Story",
    description: "Essence, positioning, and how we speak.",
    docs: ["brand", "positioning", "messaging"],
  },
  {
    id: "audience-growth",
    title: "Audience & Growth",
    description: "People we speak to and how they discover us.",
    docs: ["personas", "seo"],
  },
];

const docList = document.getElementById("doc-list");
const docRoot = document.getElementById("doc-root");
const docTitle = document.getElementById("doc-title");
const docDesc = document.getElementById("doc-desc");
const heroButtons = document.querySelectorAll("[data-doc]");
const footerLinks = document.querySelectorAll(".footer-link[data-doc]");
const sectionMenu = document.getElementById("section-menu");
const flowDiagram = document.getElementById("flow-diagram");
const contentPanel = document.querySelector(".content");
const aiKeyInput = document.getElementById("ai-key");
const aiQuestionInput = document.getElementById("ai-question");
const aiSubmitButton = document.getElementById("ai-submit");
const aiStatus = document.getElementById("ai-status");
const aiAnswer = document.getElementById("ai-answer");
const aiSuggestionButtons = document.querySelectorAll("#ai-suggestions .chip");
const aiModeToggle = document.getElementById("ai-mode-toggle");

let activeDoc = null;
let activeTopId;
let headingObserver;
let activeAiMode = "fast";
const FALLBACK_MODE = "fast";

const aiConfig = {
  endpoint: "https://api.openai.com/v1/responses",
  model: "gpt-5-pro-2025-10-06",
  system:
    "You are an assistant for myTruv brand documentation. Answer concisely and focus on brand, messaging, personas, SEO, and product positioning based only on provided context. If unsure, say you are unsure.",
  maxTokens: 600,
  poll: {
    attempts: 24,
    intervalMs: 5000,
  },
};

const aiModes = {
  deep: { model: "gpt-5-pro-2025-10-06", label: "Deep (GPT-5 Pro)" },
  fast: { model: "gpt-5.1", label: "Fast (GPT-5.1)" },
};

function buildResponseInput(question, context) {
  const userText = `${question}\n\nContext (from current doc):\n${context || "No context loaded."}`;
  return [
    { role: "system", content: [{ type: "input_text", text: aiConfig.system }] },
    { role: "user", content: [{ type: "input_text", text: userText }] },
  ];
}

function extractResponseText(data) {
  if (!data) return "";
  if (typeof data.output_text === "string") return data.output_text.trim();
  const outputs = Array.isArray(data.output) ? data.output : [];
  const texts = outputs
    .map((item) => {
      if (!Array.isArray(item?.content)) return "";
      return item.content
        .map((part) => {
          if (part.type === "output_text") return part.text || "";
          if (part.type === "refusal") return part.text || "";
          return "";
        })
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean);
  return texts.join("\n\n").trim();
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stringifyPreview(obj, fallback = "") {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return fallback || "";
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollResponseStatus(responseId, key, attempts = aiConfig.poll.attempts, interval = aiConfig.poll.intervalMs) {
  let last = null;
  const url = `${aiConfig.endpoint.replace(/\/$/, "")}/${responseId}`;

  for (let i = 0; i < attempts; i += 1) {
    await delay(interval);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });
      const raw = await res.text();
      const parsed = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
      last = { res, parsed, raw };
      if (!res.ok) {
        return last;
      }
      const status = parsed?.status;
      if (status && status !== "incomplete" && status !== "in_progress") {
        return last;
      }
    } catch (err) {
      last = { res: null, parsed: null, raw: String(err || "poll error") };
      return last;
    }
  }
  return last;
}

function setAiStatus(message, type = "") {
  if (!aiStatus) return;
  // Keep status hidden to avoid cluttering the UI.
  aiStatus.classList.add("hidden");
  aiStatus.textContent = message;
  aiStatus.classList.remove("error", "success");
  if (type) aiStatus.classList.add(type);
}

function loadStoredApiKey() {
  if (!aiKeyInput) return "";
  try {
    const stored = localStorage.getItem("truv_ai_api_key");
    if (stored) aiKeyInput.value = stored;
    return stored || "";
  } catch {
    return "";
  }
}

function saveApiKey(key) {
  try {
    localStorage.setItem("truv_ai_api_key", key);
  } catch {
    // ignore storage issues
  }
}

function renderDocList() {
  docList.innerHTML = "";

  const makeDocButton = (docId) => {
    const doc = docsMap[docId];
    if (!doc) return null;
    const button = document.createElement("button");
    const isActive = activeDoc && doc.id === activeDoc.id;
    button.className = `doc-card${isActive ? " active" : ""}`;
    button.dataset.docId = doc.id;
    button.innerHTML = `
      <p class="title">${stripEmojis(doc.title)}</p>
      <p class="desc">${doc.description}</p>
      <span class="badge">${doc.badge}</span>
    `;
    button.addEventListener("click", () => loadDoc(doc.id, { fromUser: true }));
    return button;
  };

  categories.forEach((cat) => {
    const card = document.createElement("div");
    card.className = `category-card${cat.featured ? " featured" : ""}`;
    card.innerHTML = `
      <div class="category-header">
        <h3>${cat.title}</h3>
        <p>${cat.description}</p>
      </div>
      <div class="category-docs"></div>
      ${cat.featured && cat.quickLinks ? '<div class="quick-links"></div>' : ""}
    `;

    const docsContainer = card.querySelector(".category-docs");
    cat.docs.forEach((docId) => {
      const btn = makeDocButton(docId);
      if (btn) docsContainer.appendChild(btn);
    });

    if (cat.featured && cat.quickLinks) {
      const quick = card.querySelector(".quick-links");
      cat.quickLinks.forEach((docId) => {
        const doc = docsMap[docId];
        if (!doc) return;
        const chip = document.createElement("button");
        chip.className = "doc-chip";
        chip.textContent = doc.title;
        chip.addEventListener("click", () => loadDoc(doc.id, { fromUser: true }));
        quick.appendChild(chip);
      });
    }

    docList.appendChild(card);
  });
}

function setHeader(doc) {
  const baseTitle = stripEmojis(doc.title);
  const emoji = docEmojis[doc.id];
  docTitle.textContent = emoji ? `${emoji} ${baseTitle}` : baseTitle;
  docDesc.textContent = doc.description;
}

function setFlowVisibility(docId) {
  if (!flowDiagram) return;
  const show = docId === "seo";
  flowDiagram.classList.toggle("hidden", !show);
}

function setLoading(message) {
  docRoot.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function normalizeHeading(text) {
  const emojiMatch = text.match(/[\p{Emoji}\p{Extended_Pictographic}]/gu) || [];
  const withoutEmoji = text.replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, "");
  const stripped = withoutEmoji
    .replace(/^[\s\.\-–—•·]+/, "")
    .replace(/^[0-9]+\s*[.)-]?\s*/, "")
    .trimStart()
    .replace(/^[\.\-–—•·\s]+/, "")
    .trim();
  const finalText = stripped || "Section";
  const emojiPart = emojiMatch.join(" ");
  if (emojiPart) return `${finalText} ${emojiPart}`;
  const topDocEmoji = docEmojis[activeDoc.id];
  return topDocEmoji ? `${finalText} ${topDocEmoji}` : finalText;
}

function stripEmojis(text) {
  return text.replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, "").trim();
}

function setAiMode(mode) {
  if (!aiModes[mode]) return;
  activeAiMode = mode;
  if (aiModeToggle) {
    aiModeToggle.checked = mode === "deep";
  }
}

function buildSectionMenu() {
  if (!sectionMenu) return;

  const headings = Array.from(docRoot.querySelectorAll("h2"));

  if (!headings.length) {
    sectionMenu.innerHTML = "";
    return;
  }

  const seenIds = new Set();
  const items = headings.map((el) => {
    let id = el.id || slugify(el.textContent || "section");
    if (seenIds.has(id)) {
      let i = 2;
      while (seenIds.has(`${id}-${i}`)) i += 1;
      id = `${id}-${i}`;
    }
    el.id = id;
    seenIds.add(id);

    const normalizedText = normalizeHeading(el.textContent || "Section");

    return {
      id,
      text: normalizedText,
      node: el,
    };
  });

  activeTopId = activeTopId || (items[0] ? items[0].id : null);

  sectionMenu.innerHTML = `
    <div class="section-menu-header">
      <p class="eyebrow">Sections</p>
      <h3>Jump within this doc</h3>
    </div>
    <div class="items level2">
      ${items
        .map(
          (item) => `
            <button class="item level-2" data-target="${item.id}">
              ${item.text}
            </button>
          `
        )
        .join("")}
    </div>
  `;

  const buttonsLevel2 = Array.from(sectionMenu.querySelectorAll(".items.level2 .item"));

  buttonsLevel2.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      const targetEl = document.getElementById(targetId);
      activeTopId = targetId;
      buttonsLevel2.forEach((b) => b.classList.toggle("active", b === button));
      if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if (buttonsLevel2.length) {
    buttonsLevel2.forEach((btn) => btn.classList.toggle("active", btn.getAttribute("data-target") === activeTopId));
  }

  if (headingObserver) headingObserver.disconnect();

  headingObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          activeTopId = id;
          buttonsLevel2.forEach((btn) => btn.classList.toggle("active", btn.getAttribute("data-target") === id));
        }
      });
    },
    { rootMargin: "0px 0px -60% 0px", threshold: 0.1 }
  );

  items.forEach((item) => {
    headingObserver.observe(item.node);
  });
}

async function runAiRequest(modeKey, question, context, key) {
  const modeConfig = aiModes[modeKey] || aiModes.deep;
  const response = await fetch(aiConfig.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: modeConfig.model,
      input: buildResponseInput(question, context),
      max_output_tokens: aiConfig.maxTokens,
    }),
  });

  const raw = await response.text();
  const parsed = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;

  if (!response.ok) {
    const reason =
      parsed?.error?.message ||
      parsed?.message ||
      raw?.slice(0, 500) ||
      `Unexpected ${response.status} from AI API`;
    console.error("AI request failed", {
      status: response.status,
      statusText: response.statusText,
      body: raw,
      mode: modeConfig.label,
    });
    throw new Error(`API error ${response.status}: ${reason}`);
  }

  let data = parsed;
  console.log("AI response", { status: response.status, body: data, raw, mode: modeConfig.label });

  const statusField = data?.status;
  const responseId = data?.id || data?.response_id || data?.response?.id;
  const outputIds = Array.isArray(data?.output)
    ? data.output.map((item) => item?.id).filter(Boolean)
    : [];

  if (responseId && (statusField === "incomplete" || statusField === "in_progress")) {
    setAiStatus("Model is still thinking… waiting for completion.", "error");
    const polled = await pollResponseStatus(responseId, key);
    if (polled?.parsed) {
      data = polled.parsed;
      console.log("AI poll response", { body: data, raw: polled.raw, mode: modeConfig.label });
    }
  }

  const text = extractResponseText(data);
  const statusValue = data?.status || "unknown";

  return { text, data, raw, statusValue, outputIds, modeLabel: modeConfig.label };
}

async function loadDoc(docId, opts = {}) {
  const doc = docs.find((item) => item.id === docId);
  if (!doc) return;

  activeDoc = doc;
  activeTopId = null;
  setHeader(doc);
  setFlowVisibility(doc.id);
  renderDocList();
  if (opts.fromUser && contentPanel) {
    contentPanel.classList.remove("hidden");
  }

  setLoading("Loading the latest Markdown…");
  const cacheBust = opts.cacheBust ? `?t=${Date.now()}` : "";
  const remoteUrl = `${rawBase}/${doc.file}${cacheBust}`;
  const localUrl = `${localBase}/${doc.file}${cacheBust}`;

  try {
    let response = await fetch(remoteUrl);
    if (!response.ok) {
      response = await fetch(localUrl);
    }
    if (!response.ok) throw new Error(`Fetch error ${response.status}`);

    const markdown = await response.text();
    const html = marked.parse(markdown);
    docRoot.innerHTML = html;
    buildSectionMenu();
  } catch (error) {
    docRoot.innerHTML = `
      <div class="error">
        <strong>Could not load ${doc.title}.</strong><br />
        ${error.message}. The markdown files should be available locally on this site.
      </div>
    `;
  }
}

async function askAi() {
  if (!aiQuestionInput || !aiSubmitButton) return;
  const key = (aiKeyInput?.value || "").trim();
  const question = aiQuestionInput.value.trim();

  if (!key) {
    setAiStatus("Add your OpenAI API key to ask questions.", "error");
    aiKeyInput?.focus();
    return;
  }

  if (!question) {
    setAiStatus("Type a question to ask the model.", "error");
    aiQuestionInput.focus();
    return;
  }

  const context = (docRoot?.textContent || "").trim().slice(0, 8000);

  aiSubmitButton.disabled = true;
  aiSubmitButton.textContent = "Asking…";
  const modeConfig = aiModes[activeAiMode] || aiModes.deep;
  setAiStatus(`Thinking… ${modeConfig.label}`);
  aiAnswer.classList.remove("hidden");
  aiAnswer.innerHTML = `<p class="note">Working on it…</p>`;

  try {
    const first = await runAiRequest(activeAiMode, question, context, key);
    if (first.text) {
      aiAnswer.innerHTML = marked.parse(first.text);
      setAiStatus("Done.", "success");
    } else if ((first.statusValue === "incomplete" || first.statusValue === "in_progress") && activeAiMode === "deep") {
      setAiStatus("Deep is slow; switching to Fast answer (GPT-5.1).", "error");
      const fallback = await runAiRequest(FALLBACK_MODE, question, context, key);
      if (fallback.text) {
        aiAnswer.innerHTML = marked.parse(fallback.text);
        setAiStatus("Done (fast fallback).", "success");
      } else {
        const preview = stringifyPreview(
          {
            status: fallback.statusValue,
            output: fallback.data?.output,
            error: fallback.data?.error,
            message: fallback.data?.message,
            mode: fallback.modeLabel,
            output_ids: fallback.outputIds,
          },
          fallback.raw?.slice(0, 800)
        );
        aiAnswer.innerHTML = `
          <p class="note">No answer returned, even after fast fallback. Status: ${fallback.statusValue}. Debug below:</p>
          <pre class="note">${escapeHtml(preview).slice(0, 2000)}</pre>
        `;
        setAiStatus("No answer from deep or fast (see debug).", "error");
      }
    } else {
      const preview = stringifyPreview(
        {
          status: first.statusValue,
          output: first.data?.output,
          error: first.data?.error,
          message: first.data?.message,
          mode: first.modeLabel,
          output_ids: first.outputIds,
        },
        first.raw?.slice(0, 800)
      );
      aiAnswer.innerHTML = `
        <p class="note">No answer returned. Status: ${first.statusValue}. Debug below:</p>
        <pre class="note">${escapeHtml(preview).slice(0, 2000)}</pre>
      `;
      setAiStatus("No answer returned (see debug).", "error");
    }
  } catch (error) {
    const message = error?.message || "Request failed.";
    setAiStatus(message, "error");
    aiAnswer.innerHTML = `<p class="note">Error: ${message}</p>`;
  } finally {
    aiSubmitButton.disabled = false;
    aiSubmitButton.textContent = "Ask";
  }
}

heroButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.doc;
    if (target) {
      loadDoc(target, { fromUser: true }).then(() => {
        window.scrollTo({ top: document.querySelector(".content")?.offsetTop || 0, behavior: "smooth" });
      });
    }
  });
});

if (aiKeyInput) {
  loadStoredApiKey();
  aiKeyInput.addEventListener("blur", () => saveApiKey(aiKeyInput.value.trim()));
}

if (aiSubmitButton) {
  aiSubmitButton.addEventListener("click", askAi);
}

if (aiQuestionInput) {
  aiQuestionInput.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      askAi();
    }
  });
}

aiSuggestionButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!aiQuestionInput) return;
    aiQuestionInput.value = btn.dataset.suggest || btn.textContent || "";
    aiQuestionInput.focus();
  });
});

if (aiModeToggle) {
  aiModeToggle.addEventListener("change", () => setAiMode(aiModeToggle.checked ? "deep" : "fast"));
  setAiMode(activeAiMode);
}

footerLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const target = link.dataset.doc;
    if (target) {
      loadDoc(target, { fromUser: true }).then(() => {
        window.scrollTo({ top: document.querySelector(".content")?.offsetTop || 0, behavior: "smooth" });
      });
    }
  });
});

renderDocList();

// Back to top
const backToTop = document.getElementById("back-to-top");
if (backToTop) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 120) {
      backToTop.classList.add("visible");
    } else {
      backToTop.classList.remove("visible");
    }
  });
  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
