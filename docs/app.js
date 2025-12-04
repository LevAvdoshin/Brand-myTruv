const repo = "levavdoshin-max/Truv-Lev-Tests";
const branch = "main";
const rawBase = `https://raw.githubusercontent.com/${repo}/${branch}`;

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

const docList = document.getElementById("doc-list");
const docRoot = document.getElementById("doc-root");
const docTitle = document.getElementById("doc-title");
const docDesc = document.getElementById("doc-desc");
const openGithub = document.getElementById("open-github");
const refreshButton = document.getElementById("refresh-doc");
const heroButtons = document.querySelectorAll("[data-doc]");

let activeDoc = docs[0];

function renderDocList() {
  docList.innerHTML = "";

  docs.forEach((doc) => {
    const card = document.createElement("div");
    card.className = `doc-card${doc.id === activeDoc.id ? " active" : ""}`;
    card.dataset.docId = doc.id;

    card.innerHTML = `
      <p class="title">${doc.title}</p>
      <p class="desc">${doc.description}</p>
      <span class="badge">${doc.badge}</span>
    `;

    card.addEventListener("click", () => loadDoc(doc.id));
    docList.appendChild(card);
  });
}

function setHeader(doc) {
  docTitle.textContent = doc.title;
  docDesc.textContent = doc.description;
  openGithub.href = `https://github.com/${repo}/blob/${branch}/${doc.file}`;
}

function setLoading(message) {
  docRoot.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

async function loadDoc(docId, opts = {}) {
  const doc = docs.find((item) => item.id === docId);
  if (!doc) return;

  activeDoc = doc;
  setHeader(doc);
  renderDocList();

  setLoading("Loading the latest Markdown…");
  const url = `${rawBase}/${doc.file}${opts.cacheBust ? `?t=${Date.now()}` : ""}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    const markdown = await response.text();
    const html = marked.parse(markdown);
    docRoot.innerHTML = html;
  } catch (error) {
    docRoot.innerHTML = `
      <div class="error">
        <strong>Could not load ${doc.title}.</strong><br />
        ${error.message}. You can still open it on GitHub.
      </div>
    `;
  }
}

refreshButton.addEventListener("click", () => {
  loadDoc(activeDoc.id, { cacheBust: true });
});

heroButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.doc;
    if (target) {
      loadDoc(target);
    }
  });
});

renderDocList();
loadDoc(activeDoc.id);
