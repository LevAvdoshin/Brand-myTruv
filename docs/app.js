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
const sectionMenu = document.getElementById("section-menu");
const flowDiagram = document.getElementById("flow-diagram");
const aiKeyInput = document.getElementById("ai-key");
const aiQuestionInput = document.getElementById("ai-question");
const aiSubmitButton = document.getElementById("ai-submit");
const aiStatus = document.getElementById("ai-status");
const aiAnswer = document.getElementById("ai-answer");
const aiSuggestionButtons = document.querySelectorAll("#ai-suggestions .chip");

let activeDoc = docs[0];
let activeTopId;
let headingObserver;

const aiConfig = {
  endpoint: "https://api.openai.com/v1/responses",
  model: "gpt-5-pro-2025-10-06",
  system:
    "You are an assistant for myTruv brand documentation. Answer concisely and focus on brand, messaging, personas, SEO, and product positioning based only on provided context. If unsure, say you are unsure.",
  maxTokens: 600,
};

function extractResponseText(data) {
  if (!data) return "";
  if (typeof data.output_text === "string") return data.output_text.trim();
  const outputs = Array.isArray(data.output) ? data.output : [];
  const texts = outputs
    .map((item) => {
      if (!Array.isArray(item?.content)) return "";
      return item.content
        .map((part) => (part.type === "text" ? part.text : ""))
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean);
  return texts.join("\n\n").trim();
}

function setAiStatus(message, type = "") {
  if (!aiStatus) return;
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
    button.className = `doc-card${doc.id === activeDoc.id ? " active" : ""}`;
    button.dataset.docId = doc.id;
    button.innerHTML = `
      <p class="title">${stripEmojis(doc.title)}</p>
      <p class="desc">${doc.description}</p>
      <span class="badge">${doc.badge}</span>
    `;
    button.addEventListener("click", () => loadDoc(doc.id));
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
        chip.addEventListener("click", () => loadDoc(doc.id));
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

async function loadDoc(docId, opts = {}) {
  const doc = docs.find((item) => item.id === docId);
  if (!doc) return;

  activeDoc = doc;
  activeTopId = null;
  setHeader(doc);
  setFlowVisibility(doc.id);
  renderDocList();

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
  setAiStatus("Thinking…");
  aiAnswer.innerHTML = `<p class="note">Working on it…</p>`;

  try {
    const response = await fetch(aiConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: aiConfig.model,
        input: [
          { role: "system", content: aiConfig.system },
          {
            role: "user",
            content: `${question}\n\nContext (from current doc):\n${context || "No context loaded."}`,
          },
        ],
        max_output_tokens: aiConfig.maxTokens,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const data = await response.json();
    const text = extractResponseText(data);
    if (text) {
      aiAnswer.innerHTML = marked.parse(text);
      setAiStatus("Done.", "success");
    } else {
      aiAnswer.innerHTML = `<p class="note">No answer returned.</p>`;
      setAiStatus("No answer returned.", "error");
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
      loadDoc(target).then(() => {
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

renderDocList();
loadDoc(activeDoc.id);

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
