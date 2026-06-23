const data = window.GUIDE_DATA;
const app = document.querySelector("#app");
const searchOverlay = document.querySelector("#searchOverlay");
const searchInput = document.querySelector("#searchInput");
const searchResults = document.querySelector("#searchResults");
const savedKey = "cloud-watchers-saved-posts";

let currentView = "home";
let currentSection = null;
let currentCollection = null;
let currentFilter = "Все";

function normalizePostId(value) {
  const id = String(value);
  return id.startsWith("post-") ? id : `post-${id}`;
}

function parseSavedPosts(value) {
  try {
    return new Set(JSON.parse(value || "[]").map(normalizePostId));
  } catch {
    return new Set();
  }
}

let savedPosts = parseSavedPosts(localStorage.getItem(savedKey));

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  if (tg.isVersionAtLeast?.("6.1")) {
    tg.setHeaderColor("#e9eefc");
    tg.setBackgroundColor("#e9eefc");
  }
}

// --- актуальность контента (ТЗ, раздел 7.4 и 6.4) ---------------------
const STALE_DAYS = 270; // после этого срока без проверки — предупреждаем
const FRESH_DAYS = 30; // если проверяли совсем недавно — отметка "обновлено"

function daysSince(dateString) {
  return (Date.now() - new Date(dateString).getTime()) / 86400000;
}

function isPostVisible(post) {
  if (post.expiresAt && new Date(post.expiresAt).getTime() < Date.now()) return false;
  return true;
}

function freshnessBadge(post) {
  if (!post.lastVerifiedAt) return null;
  const days = daysSince(post.lastVerifiedAt);
  if (days > STALE_DAYS) return { type: "stale", label: "Может быть неактуально" };
  if (days <= FRESH_DAYS) return { type: "fresh", label: "Обновлено" };
  return null;
}

function visiblePosts() {
  return data.posts.filter(isPostVisible);
}

// --- аналитика: приватная заглушка, без персональных данных -----------
// Подключите сюда Plausible/Umami или собственный счётчик без cookies.
function track(eventName, params) {
  try {
    console.log("[track]", eventName, params || {});
  } catch {
    /* аналитика не должна ронять приложение */
  }
}

function sectionById(id) {
  return data.sections.find((section) => section.id === id);
}

function postInSection(post, sectionId) {
  return (post.sections || [post.section]).includes(sectionId);
}

function postInCountry(post, country) {
  return post.country === country || (post.countries || []).includes(country);
}

function postCard(post) {
  const section = sectionById(post.section);
  const isSaved = savedPosts.has(post.id);
  const badge = freshnessBadge(post);
  return `
    <article class="post-card ${post.image ? "has-image" : ""}" data-post-id="${post.id}">
      <div class="post-visual">
        ${
          post.image
            ? `<img src="${post.image}" alt="" onerror="this.outerHTML='<span>${post.flag}</span>'" />`
            : `<span>${post.flag}</span>`
        }
      </div>
      <div class="post-content" role="link" tabindex="0" data-open-post="${post.id}">
        <div class="post-meta">
          <span>${post.flag} ${post.country} · ${section.title}</span>
          ${badge ? `<span class="freshness-badge ${badge.type}">${badge.label}</span>` : ""}
        </div>
        <div class="post-title">${post.title}</div>
        <p class="post-description">${post.description}</p>
      </div>
      <button
        class="bookmark-button ${isSaved ? "is-saved" : ""}"
        data-save-post="${post.id}"
        aria-label="${isSaved ? "Убрать из сохранённых" : "Сохранить материал"}"
        title="${isSaved ? "Убрать из сохранённых" : "Сохранить"}"
      >
        <i data-lucide="bookmark"></i>
      </button>
    </article>
  `;
}

function emptyState(title, text) {
  return `
    <div class="empty-state">
      <i data-lucide="map-pinned"></i>
      <h3>${title}</h3>
      <p>${text}</p>
    </div>
  `;
}

function renderHome() {
  currentView = "home";
  currentSection = null;
  currentCollection = null;
  const posts = visiblePosts();
  const featuredPosts = posts.filter((post) => post.featured);
  app.innerHTML = `
    <p class="intro-line">Личные маршруты, визовый опыт и находки из поездок.</p>
    <div class="home-heading">По темам</div>
    <section class="section-grid" aria-label="Разделы путеводителя">
      ${data.sections
        .map((section) => {
          const count = posts.filter((post) => postInSection(post, section.id)).length;
          return `
            <button class="section-card" data-section="${section.id}" data-color="${section.color}">
              <span class="section-count">${count}</span>
              <span class="section-icon"><i data-lucide="${section.icon}"></i></span>
              <strong>${section.title}</strong>
              <small>${section.subtitle}</small>
            </button>
          `;
        })
        .join("")}
    </section>
    ${
      featuredPosts.length
        ? `
      <section class="featured-section">
        <div class="heading-row">
          <h2>Начать отсюда</h2>
        </div>
        <div class="featured-rail">${featuredPosts.map(postCard).join("")}</div>
      </section>
    `
        : ""
    }
    <section class="collection-section">
      <div class="heading-row">
        <h2>Поездки и подборки</h2>
      </div>
      <div class="collection-row">
        ${data.collections
          .map(
            (collection) => `
              <button class="collection-card" data-collection="${collection.id}">
                <span class="collection-flag">${collection.flag}</span>
                <span>
                  <strong>${collection.title}</strong>
                  <small>${collection.subtitle}</small>
                </span>
                <i data-lucide="chevron-right"></i>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
  updateNavigation("home");
  finishRender();
}

function renderSection(sectionId) {
  currentView = "section";
  currentSection = sectionId;
  currentCollection = null;
  currentFilter = "Все";
  const section = sectionById(sectionId);
  const posts = visiblePosts().filter((post) => postInSection(post, sectionId));
  track("section_opened", { section_id: sectionId });
  const rawCountries = [...new Set(posts.flatMap((post) => [post.country, ...(post.countries || [])]).filter(Boolean))];
  const pinnedCountry = "Полезное";
  const countries = [
    "Все",
    ...(rawCountries.includes(pinnedCountry)
      ? [pinnedCountry, ...rawCountries.filter((country) => country !== pinnedCountry)]
      : rawCountries),
  ];

  app.innerHTML = `
    <header class="page-header">
      <button class="back-button" data-view="home"><i data-lucide="arrow-left"></i> На главную</button>
      <h2>${section.title}</h2>
      <p>${section.subtitle}</p>
    </header>
    <div class="filter-row" id="filterRow">
      ${countries
        .map(
          (country) =>
            `<button class="filter-chip ${country === "Все" ? "is-active" : ""}" data-filter="${country}">${country}</button>`,
        )
        .join("")}
    </div>
    <div class="post-list" id="sectionPosts">${posts.map(postCard).join("")}</div>
  `;
  updateNavigation("home");
  finishRender();
}

function renderCollection(collectionId) {
  currentView = "collection";
  currentSection = null;
  currentCollection = collectionId;
  const collection = data.collections.find((item) => item.id === collectionId);
  track("collection_opened", { collection_id: collectionId });
  const visible = visiblePosts();
  const posts = collection.postIds
    .map((postId) => visible.find((post) => post.id === postId))
    .filter(Boolean);

  app.innerHTML = `
    <header class="page-header collection-page-header">
      <button class="back-button" data-view="home"><i data-lucide="arrow-left"></i> На главную</button>
      <div class="collection-title-line">
        <span>${collection.flag}</span>
        <div>
          <h2>${collection.title}</h2>
          <p>${collection.subtitle}</p>
        </div>
      </div>
    </header>
    <div class="post-list">${posts.map(postCard).join("")}</div>
  `;
  updateNavigation("home");
  finishRender();
}

function renderSaved() {
  currentView = "saved";
  currentSection = null;
  currentCollection = null;
  const posts = data.posts.filter((post) => savedPosts.has(post.id));
  app.innerHTML = `
    <header class="page-header">
      <h2>Сохранённые</h2>
      <p>Материалы, к которым хочется вернуться</p>
    </header>
    ${
      posts.length
        ? `<div class="post-list">${posts.map(postCard).join("")}</div>`
        : emptyState("Здесь пока пусто", "Нажмите на закладку возле поста, чтобы сохранить его на потом.")
    }
  `;
  updateNavigation("saved");
  finishRender();
}

function finishRender() {
  lucide.createIcons();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function updateNavigation(active) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.nav === active);
  });
}

function saveBookmarks() {
  const value = JSON.stringify([...savedPosts]);
  localStorage.setItem(savedKey, value);

  if (tg?.CloudStorage && tg.isVersionAtLeast?.("6.9")) {
    tg.CloudStorage.setItem(savedKey, value);
  }
}

function loadBookmarks() {
  if (!tg?.CloudStorage || !tg.isVersionAtLeast?.("6.9")) return;

  tg.CloudStorage.getItem(savedKey, (error, value) => {
    if (error || !value) return;
    savedPosts = parseSavedPosts(value);
    localStorage.setItem(savedKey, value);
    if (currentView === "saved") renderSaved();
  });
}

function toggleSaved(postId) {
  postId = normalizePostId(postId);
  if (savedPosts.has(postId)) {
    savedPosts.delete(postId);
    track("post_unsaved", { post_id: postId });
  } else {
    savedPosts.add(postId);
    track("post_saved", { post_id: postId });
  }
  saveBookmarks();

  if (currentView === "saved") renderSaved();
  else if (currentView === "section") renderSectionWithFilter(currentSection, currentFilter);
  else if (currentView === "collection") renderCollection(currentCollection);
  else renderHome();
}

function openPost(postId) {
  postId = normalizePostId(postId);
  const post = data.posts.find((item) => item.id === postId);
  if (!post) return;
  track("post_opened", { post_id: postId, section_id: post.section, source_screen: currentView });
  if (tg?.openTelegramLink) tg.openTelegramLink(post.url);
  else window.open(post.url, "_blank", "noopener,noreferrer");
}

function renderSectionWithFilter(sectionId, filter) {
  renderSection(sectionId);
  if (filter !== "Все") {
    currentFilter = filter;
    const posts = visiblePosts().filter((post) => postInSection(post, sectionId) && postInCountry(post, filter));
    document.querySelector("#sectionPosts").innerHTML = posts.map(postCard).join("");
    document.querySelectorAll("[data-filter]").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.filter === filter);
    });
    lucide.createIcons();
  }
}

function openSearch() {
  searchOverlay.hidden = false;
  document.body.style.overflow = "hidden";
  searchInput.value = "";
  renderSearch("");
  window.setTimeout(() => searchInput.focus(), 50);
}

function closeSearch() {
  searchOverlay.hidden = true;
  document.body.style.overflow = "";
}

function renderSearch(query) {
  const normalized = query.trim().toLocaleLowerCase("ru");
  const pool = visiblePosts();
  const matches = normalized
    ? pool.filter((post) =>
        [
          post.title,
          post.description,
          post.country,
          ...(post.countries || []),
          ...(post.cities || []),
          ...(post.collections || []).map(
            (id) => data.collections.find((collection) => collection.id === id)?.title || id,
          ),
          ...post.tags,
        ]
          .join(" ")
          .toLocaleLowerCase("ru")
          .includes(normalized),
      )
    : pool.filter((post) => post.featured);

  if (normalized) {
    track("search_submitted", { query: normalized, result_count: matches.length });
    if (!matches.length) track("empty_search", { query: normalized });
  }

  searchResults.innerHTML = `
    <p class="search-hint">${normalized ? `Найдено: ${matches.length}` : "Популярные материалы"}</p>
    ${
      matches.length
        ? `<div class="post-list">${matches.map(postCard).join("")}</div>`
        : emptyState("Ничего не нашлось", "Попробуйте название страны или более короткий запрос.")
    }
  `;
  lucide.createIcons();
}

document.addEventListener("click", (event) => {
  const sectionButton = event.target.closest("[data-section]");
  const collectionButton = event.target.closest("[data-collection]");
  const viewButton = event.target.closest("[data-view]");
  const navButton = event.target.closest("[data-nav]");
  const saveButton = event.target.closest("[data-save-post]");
  const postButton = event.target.closest("[data-open-post]");
  const filterButton = event.target.closest("[data-filter]");

  if (saveButton) return toggleSaved(saveButton.dataset.savePost);
  if (postButton) return openPost(postButton.dataset.openPost);
  if (collectionButton) return renderCollection(collectionButton.dataset.collection);
  if (sectionButton) return renderSection(sectionButton.dataset.section);
  if (viewButton) return renderHome();
  if (navButton) {
    if (navButton.dataset.nav === "home") renderHome();
    if (navButton.dataset.nav === "saved") renderSaved();
  }
  if (filterButton && currentSection) {
    currentFilter = filterButton.dataset.filter;
    track("filter_applied", { filter_type: "country", filter_id: currentFilter });
    const posts = visiblePosts().filter(
      (post) => postInSection(post, currentSection) && (currentFilter === "Все" || postInCountry(post, currentFilter)),
    );
    document.querySelector("#sectionPosts").innerHTML = posts.map(postCard).join("");
    document.querySelectorAll("[data-filter]").forEach((chip) => {
      chip.classList.toggle("is-active", chip === filterButton);
    });
    lucide.createIcons();
  }
});

document.addEventListener("keydown", (event) => {
  const postButton = event.target.closest?.("[data-open-post]");
  if (postButton && (event.key === "Enter" || event.key === " ")) openPost(postButton.dataset.openPost);
  if (event.key === "Escape" && !searchOverlay.hidden) closeSearch();
});

document.querySelector("#openSearch").addEventListener("click", openSearch);
document.querySelector("#closeSearch").addEventListener("click", closeSearch);
searchInput.addEventListener("input", (event) => renderSearch(event.target.value));

track("app_opened", {
  source: tg ? "telegram" : "browser",
  telegram_user_present: Boolean(tg?.initDataUnsafe?.user),
});
renderHome();
loadBookmarks();
