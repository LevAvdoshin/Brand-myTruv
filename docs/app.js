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

const docsMap = docs.reduce((acc, doc) => {
  acc[doc.id] = doc;
  return acc;
}, {});

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
const refreshButton = document.getElementById("refresh-doc");
const heroButtons = document.querySelectorAll("[data-doc]");
const sectionMenu = document.getElementById("section-menu");

let activeDoc = docs[0];
let headingObserver;
let headingObserverH2;
let activeTopId;

function renderDocList() {
  docList.innerHTML = "";

  const makeDocButton = (docId) => {
    const doc = docsMap[docId];
    if (!doc) return null;
    const button = document.createElement("button");
    button.className = `doc-card${doc.id === activeDoc.id ? " active" : ""}`;
    button.dataset.docId = doc.id;
    button.innerHTML = `
      <p class="title">${doc.title}</p>
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
  docTitle.textContent = doc.title;
  docDesc.textContent = doc.description;
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

function buildSectionMenu() {
  if (!sectionMenu) return;

  const headings = Array.from(docRoot.querySelectorAll("h2, h3"));

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

    return {
      id,
      text: el.textContent || "Section",
      level: el.tagName.toLowerCase(),
      node: el,
    };
  });

  const groups = [];
  let currentGroup = null;

  items.forEach((item) => {
    if (item.level === "h2") {
      currentGroup = { ...item, children: [] };
      groups.push(currentGroup);
    } else if (item.level === "h3" && currentGroup) {
      currentGroup.children.push(item);
    } else if (item.level === "h3" && !currentGroup) {
      // If doc starts with h3, create a placeholder group
      const placeholder = {
        id: "section",
        text: "Sections",
        level: "h2",
        children: [item],
      };
      groups.push(placeholder);
      currentGroup = placeholder;
    }
  });

  activeTopId = activeTopId || (groups[0] ? groups[0].id : null);

  const hasSubsections = groups.some((g) => g.children && g.children.length);

  sectionMenu.innerHTML = `
    <div class="section-menu-header">
      <p class="eyebrow">Sections</p>
      <h3>Jump within this doc</h3>
    </div>
    <div class="items level2">
      ${groups
        .map(
          (item) => `
            <button class="item level-2" data-target="${item.id}">
              ${item.text}
            </button>
          `
        )
        .join("")}
    </div>
    ${hasSubsections ? '<div class="items level3 hidden" id="section-submenu"></div>' : ""}
  `;

  const buttonsLevel2 = Array.from(sectionMenu.querySelectorAll(".items.level2 .item"));

  function renderSubmenu(parentId) {
    const subContainer = sectionMenu.querySelector("#section-submenu");
    if (!subContainer) return;
    const parent = groups.find((g) => g.id === parentId);
    if (!subContainer || !parent) return;

    if (parent.children.length === 0) {
      subContainer.classList.add("hidden");
      subContainer.innerHTML = "";
      return;
    }

    subContainer.classList.remove("hidden");
    subContainer.innerHTML = parent.children
      .map(
        (child) => `
        <button class="item level-3" data-target="${child.id}">
          ${child.text}
        </button>
      `
      )
      .join("");

    const buttonsLevel3 = Array.from(subContainer.querySelectorAll(".item.level-3"));
    buttonsLevel3.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  buttonsLevel2.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      const targetEl = document.getElementById(targetId);
      activeTopId = targetId;
      buttonsLevel2.forEach((b) => b.classList.toggle("active", b === button));
      renderSubmenu(targetId);
      if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if (buttonsLevel2.length) {
    buttonsLevel2.forEach((btn) => btn.classList.toggle("active", btn.getAttribute("data-target") === activeTopId));
    renderSubmenu(activeTopId);
  }

  if (headingObserver) headingObserver.disconnect();
  if (headingObserverH2) headingObserverH2.disconnect();

  headingObserverH2 = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          activeTopId = id;
          buttonsLevel2.forEach((btn) => btn.classList.toggle("active", btn.getAttribute("data-target") === id));
          renderSubmenu(id);
        }
      });
    },
    { rootMargin: "0px 0px -60% 0px", threshold: 0.1 }
  );

  headingObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          const subButtons = Array.from(sectionMenu.querySelectorAll(".items.level3 .item"));
          subButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.getAttribute("data-target") === id);
          });
        }
      });
    },
    { rootMargin: "0px 0px -60% 0px", threshold: 0.1 }
  );

  items.forEach((item) => {
    if (item.level === "h2") headingObserverH2.observe(item.node);
    if (item.level === "h3") headingObserver.observe(item.node);
  });
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
    buildSectionMenu();
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
