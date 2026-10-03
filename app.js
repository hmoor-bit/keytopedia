/* ============================================================
   КЕЙТОПЕДИЯ — логика
   Фильтры по разделам, слово дня, случайная запись, модалка
   ============================================================ */

"use strict";

const $ = (sel) => document.querySelector(sel);

const state = {
  section: "definitions", // стартовый раздел
};

/* ---------- Подготовка данных ---------- */

const entries = KEITO_DATA.entries.map((e, i) => ({
  ...e,
  num: e.num != null ? String(e.num) : String(i + 1),
  id: "e" + (i + 1),
}));

const sectionById = new Map(KEITO_DATA.sections.map((s) => [s.id, s]));

// Оттенок бейджа раздела: тёплая янтарно-кремовая гамма
const sectionHue = (() => {
  const map = new Map();
  const warm = [34, 20, 42, 12, 38, 26, 16, 44, 30, 46];
  KEITO_DATA.sections.forEach((s, i) => map.set(s.id, warm[i % warm.length]));
  return map;
})();

// Пул для «Мне повезёт»: только кейторизмы и мудрости // удалено

/* ---------- Утилиты ---------- */

function escapeHtml(str) {
  // Символ & собираем из кода, чтобы экранирование не зависело от обработки файла
  const A = String.fromCharCode(38); // "&"
  return String(str ?? "")
    .replaceAll("&", A + "amp;")
    .replaceAll("<", A + "lt;")
    .replaceAll(">", A + "gt;")
    .replaceAll('"', A + "quot;");
}

function matches(entry) {
  if (state.section !== "all" && entry.section !== state.section) return false;
  return true;
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/* ---------- Рендер ---------- */

function renderStats(total, shown) {
  const sectionsCount = new Set(entries.map((e) => e.section)).size;
  $("#stats").innerHTML = [
    `<span class="stat">Всего <b>${total}</b> ${plural(total, "запись", "записи", "записей")}</span>`,
    `<span class="stat"><b>${sectionsCount}</b> ${plural(sectionsCount, "раздел", "раздела", "разделов")}</span>`,
    `<span class="stat">Показано <b>${shown}</b></span>`,
  ].join("");
}

function renderWotd() {} // слово дня удалено

function renderSectionChips() {
  const counts = new Map();
  entries.forEach((e) => counts.set(e.section, (counts.get(e.section) || 0) + 1));

  // Только тематические разделы, без «Всё-всё»
  $("#segWrap").innerHTML = '<div class="seg-pill" id="segPill" aria-hidden="true"></div>' + KEITO_DATA.sections.map((s) => {
    const c = counts.get(s.id) || 0;
    return `<button class="seg-item ${state.section === s.id ? "active" : ""} ${c === 0 ? "dim" : ""}" data-section="${s.id}">
      <span>${s.icon} ${escapeHtml(s.name)}</span><span class="cnt">${c}</span>
    </button>`;
  }).join("");

  // Клик по активному разделу снова показывает весь словарь
  $("#segWrap").querySelectorAll(".seg-item").forEach((b) =>
    b.addEventListener("click", () => {
      state.section = state.section === b.dataset.section ? "all" : b.dataset.section;
      centerSegItem(b);
      renderAll();
    })
  );

  updateSegPill();
}

/* скользящая «таблетка» под активным сегментом */
function updateSegPill() {
  const wrap = $("#segWrap");
  const pill = $("#segPill");
  if (!wrap || !pill) return;
  const active = wrap.querySelector(".seg-item.active");
  if (!active) {
    pill.classList.remove("show");
    return;
  }
  pill.classList.add("show");
  pill.style.left = active.offsetLeft + "px";
  pill.style.width = active.offsetWidth + "px";
}

/* мягкий автоподвод сегмента к центру ленты (для телефонов) */
function centerSegItem(btn) {
  const wrap = $("#segWrap");
  if (!wrap) return;
  const target = btn.offsetLeft - (wrap.clientWidth - btn.offsetWidth) / 2;
  wrap.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
}

/* ---------- Рендер карточек ---------- */

function cardText(e) {
  return e.text || (e.example ? "Пример: " + e.example : "");
}

function cardHtml(e, i) {
  const s = sectionById.get(e.section);
  return `
    <article class="card reveal" style="transition-delay:${Math.min(i, 8) * 35}ms" data-id="${e.id}">
      <div class="card-top">
        <span class="badge" style="--h:${sectionHue.get(e.section)}">${s ? s.icon + " " + escapeHtml(s.name) : "Записи"}</span>
        <span class="num">№ ${escapeHtml(e.num)}</span>
      </div>
      <h3 class="card-term">${escapeHtml(e.term)}</h3>
      ${cardText(e) ? `<p class="card-text">${escapeHtml(cardText(e))}</p>` : ""}
      ${e.author ? `<div class="card-author">Автор - ${escapeHtml(e.author)}</div>` : ""}
    </article>
  `;
}

function renderCards() {
  const box = $("#cards");
  const list = entries.filter(matches);

  box.innerHTML = list.map((e, i) => cardHtml(e, i)).join("");

  box.querySelectorAll(".card").forEach((card, i) => {
    card.addEventListener("click", () => openModal(list[i]));
  });

  // плавное появление
  const io = new IntersectionObserver(
    (obs) => obs.forEach((o) => {
      if (o.isIntersecting) {
        o.target.classList.add("in");
        io.unobserve(o.target);
      }
    }),
    { rootMargin: "300px 0px" }
  );
  box.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  $("#emptyState").hidden = list.length > 0;
  renderStats(entries.length, list.length);

  return list;
}

/* ---------- Модалка ---------- */

let lastModalEntry = null;

function openModal(entry) {
  lastModalEntry = entry;
  const s = sectionById.get(entry.section);
  $("#modalContent").innerHTML = `
    <div class="card-top">
      <span class="badge" style="--h:${sectionHue.get(entry.section)}">${s ? s.icon + " " + escapeHtml(s.name) : "Записи"}</span>
      <span class="num">№ ${escapeHtml(entry.num)}</span>
    </div>
    <h2 class="modal-term">${escapeHtml(entry.term)}</h2>
    ${cardText(entry) ? `<p class="modal-text">${escapeHtml(cardText(entry))}</p>` : ""}
    ${entry.example && entry.text ? `<p class="modal-text card-author">Пример: ${escapeHtml(entry.example)}</p>` : ""}
    ${entry.author ? `<p class="modal-author">Автор - ${escapeHtml(entry.author)}</p>` : ""}
  `;
  $("#modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("#modalBackdrop").hidden = true;
  document.body.style.overflow = "";
}

function copyCurrent() {
  if (!lastModalEntry) return;
  const e = lastModalEntry;
  const parts = [e.term, cardText(e), e.author ? "Автор - " + e.author : null].filter(Boolean);
  const text = parts.join("\n") + "\n\n· Кейтопедия";
  copyToClipboard(text).then(() => toast("📋 Скопировано"));
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 1900);
}

/* ---------- Эффект печатной машинки ---------- */

function typeEffect(el, text, speed = 24) {
  let i = 0;
  el.innerHTML = '<span class="caret"></span>';
  const caret = el.querySelector(".caret");
  (function tick() {
    if (i <= text.length) {
      el.insertBefore(document.createTextNode(text.charAt(i)), caret);
      i++;
      setTimeout(tick, speed);
    } else {
      caret.remove();
    }
  })();
}

/* ---------- Реакция фото-сцены на курсор ---------- */

function pointerGlow() {
  const card = document.querySelector(".hero-card");
  const img = document.querySelector(".hero-bg img");
  const fine = window.matchMedia("(pointer: fine)").matches;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!card || !img || !fine || calm) return;

  let tx = 0, ty = 0, x = 0, y = 0, raf = null;

  const loop = () => {
    x += (tx - x) * 0.06;
    y += (ty - y) * 0.06;
    img.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    if (Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = null;
    }
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 18;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 14;
    kick();
  });

  card.addEventListener("pointerleave", () => { tx = 0; ty = 0; kick(); });
}

/* ---------- Сборка ---------- */

function renderAll() {
  renderSectionChips();
  renderCards();
}

function bindEvents() {
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !$("#modalBackdrop").hidden) {
      closeModal();
    }
  });

  $("#modalCopy").onclick = copyCurrent;
  $("#modalClose").onclick = closeModal;

  $("#modalBackdrop").addEventListener("click", (ev) => {
    if (ev.target === $("#modalBackdrop")) closeModal();
  });

  const reset = () => {
    state.section = "all";
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  $("#resetBtn").onclick = reset;
  $("#logoBtn").onclick = reset;
}

function init() {
  $("#year").textContent = new Date().getFullYear();
  bindEvents();
  pointerGlow();
  renderAll();

  // ширины сегментов меняются после загрузки шрифтов — пересчитываем таблетку
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateSegPill);
  }
  window.addEventListener("resize", updateSegPill);

  const sub = $("#typed");
  const text = sub.dataset.text;
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    typeEffect(sub, text);
  } else {
    sub.textContent = text;
  }
}

init();
