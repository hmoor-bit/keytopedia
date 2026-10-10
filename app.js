/* ============================================================
   КЕЙТОПЕДИЯ — логика
   Фильтры по разделам, слово дня, случайная запись, модалка
   ============================================================ */

"use strict";

const $ = (sel) => document.querySelector(sel);

const state = {
  section: "definitions", // стартовый раздел
};

/* ---------- Добавленные пользователем записи ---------- */

const LS_KEY = "keito-custom-entries";

function loadCustomEntries() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

function saveCustomEntries(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* на file:// хранилище может быть недоступно */ }
}

const customEntries = loadCustomEntries();

// Вживляем сохранённые записи в базу ДО создания кэшированной копии entries
customEntries.forEach((e) => {
  const copy = Object.assign({}, e);
  delete copy.id;
  const secs = KEITO_DATA.entries.map((x) => x.section);
  KEITO_DATA.entries.splice(secs.lastIndexOf(e.section) + 1, 0, copy);
});

/* ---------- Подготовка данных ---------- */

const entries = KEITO_DATA.entries.map((e, i) => ({
  ...e,
  num: e.num != null ? String(e.num) : String(i + 1),
  id: "e" + (i + 1),
}));

let sectionById = new Map(KEITO_DATA.sections.map((s) => [s.id, s]));

// Оттенок бейджа раздела: тёплая янтарно-кремовая гамма
let sectionHue = (() => {
  const map = new Map();
  const warm = [34, 20, 42, 12, 38, 26, 16, 44, 30, 46];
  KEITO_DATA.sections.forEach((s, i) => map.set(s.id, warm[i % warm.length]));
  return map;
})();

// Пересобрать производные структуры после подгрузки свежих данных с GitHub
function rebuildDerivedData() {
  entries.length = 0;
  KEITO_DATA.entries.forEach((e, i) => {
    entries.push({
      ...e,
      num: e.num != null ? String(e.num) : String(i + 1),
      id: "e" + (i + 1),
    });
  });
  sectionById = new Map(KEITO_DATA.sections.map((s) => [s.id, s]));
  sectionHue = (() => {
    const map = new Map();
    const warm = [34, 20, 42, 12, 38, 26, 16, 44, 30, 46];
    KEITO_DATA.sections.forEach((s, i) => map.set(s.id, warm[i % warm.length]));
    return map;
  })();
}

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

/* Плашка на человека: все его штуки в одной карточке */
function stukiGroupHtml(list) {
  // группируем по автору в порядке первого появления в данных
  const byAuthor = new Map();
  list.forEach((e) => {
    const author = e.author || "Без автора";
    if (!byAuthor.has(author)) byAuthor.set(author, []);
    byAuthor.get(author).push(e);
  });

  return [...byAuthor.entries()].map(([author, items], i) => `
    <article class="card stuki-card reveal" style="transition-delay:${Math.min(i, 8) * 35}ms">
      <div class="card-top">
        <span class="badge" style="--h:${sectionHue.get("stuki")}">🎭 Штуки</span>
        <span class="num">${items.length} ${plural(items.length, "штука", "штуки", "штук")}</span>
      </div>
      <h3 class="card-term">${escapeHtml(author)}</h3>
      <div class="stuki-tags">
        ${items.map((e) => `<button class="stuki-tag" data-id="${e.id}" title="${escapeHtml(e.num)}">${escapeHtml(e.num)} · ${escapeHtml(e.term)}</button>`).join("")}
      </div>
    </article>
  `).join("");
}

function renderCards() {
  const box = $("#cards");
  const list = entries.filter(matches);
  const grouped = state.section === "stuki";

  box.innerHTML = grouped ? stukiGroupHtml(list) : list.map((e, i) => cardHtml(e, i)).join("");

  if (grouped) {
    const byAuthor = new Map();
    list.forEach((e) => {
      const author = e.author || "Без автора";
      if (!byAuthor.has(author)) byAuthor.set(author, []);
      byAuthor.get(author).push(e);
    });
    const groups = [...byAuthor.entries()];
    box.querySelectorAll(".stuki-card").forEach((card, i) => {
      const [author, items] = groups[i];
      card.addEventListener("click", () => openStukiModal(author, items));
    });
    box.querySelectorAll(".stuki-tag").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation(); // не открывать модалку всей плашки
        const entry = entries.find((e) => e.id === btn.dataset.id);
        if (entry) openModal(entry);
      });
    });
  } else {
    box.querySelectorAll(".card").forEach((card, i) => {
      card.addEventListener("click", () => openModal(list[i]));
    });
  }

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

/* ---------- Графики: кольцевые диаграммы по данным записи ---------- */

// Парсинг текста вида "Имя: А-30%, Б-70%"
function parseCharts(text) {
  return text.split("\n").map((line) => {
    const idx = line.indexOf(":");
    if (idx < 0) return null;
    const name = line.slice(0, idx).trim();
    if (!name) return null;
    const items = line.slice(idx + 1)
      .split(",")
      .map((chunk) => {
        chunk = chunk.trim();
        const m = chunk.match(/(\d+)\s*%/);
        if (!m) return null;
        let label = chunk.slice(0, chunk.indexOf(m[0]));
        label = label.replace(/[-–—]\s*$/, "").trim();
        label = label.charAt(0).toUpperCase() + label.slice(1);
        return { label, value: Number(m[1]) || 0 };
      })
      .filter(Boolean);
    if (!items.length) return null;
    return { name, items };
  }).filter(Boolean);
}

// Палитра диаграмм: приглушённые «книжные» тона
const CHART_COLORS = ["#c9821e", "#b05a3a", "#8a8a3e", "#3e7a74", "#8a5a86", "#5a6b8a", "#d3a53a", "#a8625a"];

function donutSVG(person) {
  const r = 42, C = 2 * Math.PI * r;
  let offset = 0;
  const slices = person.items.map((it, i) => {
    const len = (it.value / 100) * C;
    const seg = `<circle cx="60" cy="60" r="${r}" fill="none"
      stroke="${CHART_COLORS[i % CHART_COLORS.length]}"
      stroke-width="16"
      stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}"
      transform="rotate(-90 60 60)"></circle>`;
    offset += len;
    return seg;
  }).join("");
  return `<svg class="donut" viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(person.name)}">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(120,96,60,0.1)" stroke-width="16"></circle>
    ${slices}
    <text x="60" y="57" text-anchor="middle" class="donut-name">${escapeHtml(person.name)}</text>
    <text x="60" y="72" text-anchor="middle" class="donut-sub">${person.items.length} ${plural(person.items.length, "качество", "качества", "качеств")}</text>
  </svg>`;
}

function chartsHTML(entry) {
  const people = parseCharts(entry.text);

  // общие качества: повторяются у нескольких людей
  const freq = new Map();
  people.forEach((p) => p.items.forEach((it) => {
    const k = it.label.toLowerCase();
    freq.set(k, (freq.get(k) || 0) + 1);
  }));

  let sharedTotal = 0;
  const html = people.map((p) => {
    const items = [...p.items].sort((a, b) => b.value - a.value);
    sharedTotal += items.filter((it) => (freq.get(it.label.toLowerCase()) || 0) > 1).length;
    return `
    <div class="chart-card">
      ${donutSVG({ ...p, items })}
      <ul class="legend">
        ${items.map((it, i) => {
          const isShared = (freq.get(it.label.toLowerCase()) || 0) > 1;
          return `
          <li class="${isShared ? "shared" : ""}" title="${isShared ? "Общая тема: есть и у других" : "Только у тебя"}">
            <span class="dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></span>
            <span class="legend-label">${isShared ? "✨ " : ""}${escapeHtml(it.label)}</span>
            <span class="legend-val">${it.value}%</span>
          </li>`;
        }).join("")}
      </ul>
    </div>`;
  }).join("");

  return `
    ${sharedTotal ? `<p class="assoc-note"><b>✨ — качества, повторяющиеся у нескольких людей.</b></p>` : ""}
    <div class="charts-grid">${html}</div>`;
}

/* ---------- Графики: шкала мразотности ---------- */

// Парсинг строк вида "Имя: 1/13", "Имя: 1 день из 13-ти", "мразь 2 через 2 дня", "мразь в високосный год"
function parseMraz(text) {
  return text.split("\n").map((line) => {
    const idx = line.indexOf(":");
    if (idx < 0) return null;
    const name = line.slice(0, idx).trim();
    const body = line.slice(idx + 1);
    if (!name) return null;

    let days = null, note = "";
    let m = body.match(/1\s*\/\s*(\d+)/);
    if (m) { days = Number(m[1]); }
    else if ((m = body.match(/из\s*(\d+)\s*-?\s*т[иi]/)) || (m = body.match(/из\s*(\d+)/))) { days = Number(m[1]); }
    else if (/високосн/.test(body)) { days = 1461; note = "1 раз в високосный год"; }
    else if ((m = body.match(/(\d+)\D*(?:дн[ья]|через)/))) { days = Number(m[1]); }

    if (!days || days < 1) return null;
    const share = 100 / days;
    const label = note || (days === 1 ? "постоянно" : `1 из ${days} дней`);
    return { name, days, share, label, leap: !!note };
  }).filter(Boolean).sort((a, b) => b.share - a.share);
}

function mrazHTML(entry) {
  const people = parseMraz(entry.text);
  const max = Math.max(...people.map((p) => p.share));
  const least = people[people.length - 1];
  const leader = people[0];
  return `
    <div class="mraz-list">
      ${people.map((p) => `
        <div class="mraz-row" title="Доля мразотности: ${p.share.toFixed(1)}%">
          <span class="mraz-name">${escapeHtml(p.name)}${p === least ? " 👑" : ""}</span>
          <div class="mraz-track">
            <div class="mraz-fill ${p.leap ? "mraz-leap" : ""}" style="width:${Math.max((p.share / max) * 100, 1.6).toFixed(1)}%"></div>
          </div>
          <span class="mraz-val">${escapeHtml(p.label)}</span>
        </div>`).join("")}
      <p class="mraz-note">📊 Шкала: доля дней, когда человек официально мразь. 👑 — абсолютно чистый рекорд (${least.name}: ${least.label}). 🏅 ${leader.name} — лидер чести (${leader.label}).</p>
    </div>`;
}

/* ---------- Графики: ассоциации с собой ---------- */

function assocHTML(entry) {
  const WARM_HUES = [34, 20, 42, 12, 38, 28, 16];
  const people = entry.text.split("\n").map((line, i) => {
    const idx = line.indexOf(":");
    if (idx < 0) return null;
    const name = line.slice(0, idx).trim();
    if (!name) return null;
    const items = line.slice(idx + 1)
      .split(",")
      .map((s) => s.trim().replace(/[.!?]+$/, ""))
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    return { name, items, hue: WARM_HUES[i % WARM_HUES.length] };
  }).filter(Boolean);

  // общие темы: повторяются у нескольких людей
  const freq = new Map();
  people.forEach((p) => p.items.forEach((t) => {
    const k = t.toLowerCase();
    freq.set(k, (freq.get(k) || 0) + 1);
  }));

  let sharedTotal = 0;
  const html = people.map((p) => {
    sharedTotal += p.items.filter((t) => (freq.get(t.toLowerCase()) || 0) > 1).length;
    return `
      <div class="chart-card assoc-card">
        <div class="assoc-name" style="color:hsl(${p.hue}, 62%, 30%)">${escapeHtml(p.name)}</div>
        <div class="chips-wrap">
          ${p.items.map((t) => {
            const isShared = (freq.get(t.toLowerCase()) || 0) > 1;
            return `<span class="assoc-chip ${isShared ? "shared" : ""}" style="--h:${p.hue}" title="${isShared ? "Общая тема не только у тебя" : "Уникальная ассоциация"}">${isShared ? "✨ " : ""}${escapeHtml(t)}</span>`;
          }).join("")}
        </div>
      </div>`;
  }).join("");

  return `
    <div class="assoc-note">${sharedTotal ? `<b>✨ — ответы, которые повторяются у нескольких людей.</b>` : ""}</div>
    <div class="charts-grid">${html}</div>`;
}

/* ---------- Модалка «Штуки человека»: список всех штук ---------- */

let lastModalList = null;

function openStukiModal(author, items) {
  lastModalEntry = null;
  lastModalList = items;
  const s = sectionById.get("stuki");
  $("#modalContent").innerHTML = `
    <div class="card-top">
      <span class="badge" style="--h:${sectionHue.get("stuki")}">${s ? s.icon + " " + escapeHtml(s.name) : "Штуки"}</span>
      <span class="num">${items.length} ${plural(items.length, "штука", "штуки", "штук")}</span>
    </div>
    <h2 class="modal-term">${escapeHtml(author)}</h2>
    <ul class="stuki-modal-list">
      ${items.map((e) => `
        <li>
          <button class="stuki-modal-item" data-id="${e.id}">
            <span class="stuki-modal-num">${escapeHtml(e.num)}</span>
            <span class="stuki-modal-text">${escapeHtml(e.term)}</span>
          </button>
        </li>`).join("")}
    </ul>
  `;
  $("#modalContent").querySelectorAll(".stuki-modal-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const entry = entries.find((e) => e.id === btn.dataset.id);
      if (entry) openModal(entry);
    });
  });
  $("#modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}

/* ---------- Модалка ---------- */

let lastModalEntry = null;

function openModal(entry) {
  lastModalEntry = entry;
  lastModalList = null;
  const s = sectionById.get(entry.section);
  $("#modalContent").innerHTML = `
    <div class="card-top">
      <span class="badge" style="--h:${sectionHue.get(entry.section)}">${s ? s.icon + " " + escapeHtml(s.name) : "Записи"}</span>
      <span class="num">№ ${escapeHtml(entry.num)}</span>
    </div>
    <h2 class="modal-term">${escapeHtml(entry.term)}</h2>
    ${entry.charts && entry.text ? chartsHTML(entry) : ""}
    ${entry.mraz && entry.text ? mrazHTML(entry) : ""}
    ${entry.assoc && entry.text ? assocHTML(entry) : ""}
    ${!entry.charts && !entry.mraz && !entry.assoc && cardText(entry) ? `<p class="modal-text">${escapeHtml(cardText(entry))}</p>` : ""}
    ${entry.charts && entry.example ? `<p class="modal-text card-author">Пример: ${escapeHtml(entry.example)}</p>` : ""}
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
  let text;
  if (lastModalList) {
    // копируем весь список штук человека
    text = lastModalList.map((e) => `${e.num}. ${e.term}`).join("\n") + "\n\n· Кейтопедия";
  } else if (lastModalEntry) {
    const e = lastModalEntry;
    text = [e.term, cardText(e), e.author ? "Автор - " + e.author : null]
      .filter(Boolean).join("\n") + "\n\n· Кейтопедия";
  } else {
    return;
  }
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
  toastTimer = setTimeout(() => (el.hidden = true), 3000);
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

/* ---------- Добавление записи и экспорт data.js ---------- */

function nextNumFor(section, author) {
  const same = KEITO_DATA.entries.filter((e) => e.section === section);

  // В разделах с префиксной нумерацией (К1, Э2, Мр7…) продолжаем префикс автора
  if (author) {
    const own = same.filter((e) => e.author === author);
    if (own.length) {
      const found = own.map((e) => e.num.match(/^(\D+)(\d+)$/)).reverse().find(Boolean);
      if (found) return found[1].trim() + (Number(found[2]) + 1);
    }
  }

  const nums = same
    .map((e) => Number(e.num))
    .filter((n) => Number.isFinite(n) && n > 0);
  return String(nums.length ? Math.max(...nums) + 1 : 1);
}

function openAddDialog() {
  const inp = $("#addSection");
  const list = $("#keitoSectionList");
  // список существующих разделов обновляем каждый раз (мог появиться новый)
  if (list) {
    list.innerHTML = KEITO_DATA.sections
      .map((s) => `<option value="${escapeHtml(s.name)}"></option>`)
      .join("");
  }
  inp.value = state.section !== "all"
    ? (sectionById.get(state.section) || KEITO_DATA.sections[0]).name
    : KEITO_DATA.sections[0].name;
  $("#addTerm").value = "";
  $("#addText").value = "";
  $("#addAuthor").value = "";
  $("#addBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  $("#addTerm").focus();
}

function closeAddDialog() {
  $("#addBackdrop").hidden = true;
  document.body.style.overflow = "";
}

/* Красивое подтверждение по центру экрана. Promise<boolean> */
function showConfirm(text) {
  return new Promise((resolve) => {
    const bd = $("#confirmBackdrop");
    const ok = $("#confirmOk");
    const cancel = $("#confirmCancel");
    $("#confirmText").textContent = text;
    bd.hidden = false;

    const finish = (value) => {
      bd.hidden = true;
      ok.onclick = null;
      cancel.onclick = null;
      bd.onclick = null;
      resolve(value);
    };

    ok.onclick = () => finish(true);
    cancel.onclick = () => finish(false);
    bd.onclick = (ev) => { if (ev.target === bd) finish(false); };
  });
}

function handleAddSubmit(ev) {
  ev.preventDefault();
  (async () => {
    const raw = { term: $("#addTerm").value.trim() };
    if (!raw.term) return;
    const inputName = $("#addSection").value.trim();
    if (!inputName) return;
    const text = $("#addText").value.trim();
    const author = $("#addAuthor").value.trim();
    if (text) raw.text = text;
    if (author) raw.author = author;

    const ok = await showConfirm("Добавить новую запись?");
    if (!ok) return;

    // Раздел: существующий по названию или новый
    const byName = new Map(KEITO_DATA.sections.map((s) => [s.name.toLowerCase(), s]));
    const existing = byName.get(inputName.toLowerCase());
    if (existing) {
      raw.section = existing.id;
    } else {
      // новый раздел — в конец списка
      const icon = "🗂️";
      const section = {
        id: "s" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36),
        name: inputName,
        icon: icon,
      };
      KEITO_DATA.sections.push(section);
      raw.section = section.id;
    }

    rebuildDerivedData(); // после возможного создания раздела

    raw.num = nextNumFor(raw.section, raw.author);

    // вставляем сразу после последней записи этого раздела
    const secs = KEITO_DATA.entries.map((x) => x.section);
    KEITO_DATA.entries.splice(secs.lastIndexOf(raw.section) + 1, 0, raw);

    // запоминаем для перезагрузок (localStorage) и экспорта data.js
    customEntries.push(raw);
    saveCustomEntries(customEntries);

    // добавляем в кэш-копию для рендера
    entries.push(Object.assign(Object.assign({}, raw), { id: "e" + (entries.length + 1) }));

    closeAddDialog();
    toast("✅ Запись добавлена");
    state.section = raw.section; // показать раздел с новой записью
    renderAll();
    lastSavedNote = raw.term;
    persistData();               // авто-сохранение в data.js + GitHub
  })();
}

function dataFileContent() {
  const pretty = JSON.stringify({
    meta: KEITO_DATA.meta,
    sections: KEITO_DATA.sections,
    entries: KEITO_DATA.entries,
  }, null, 2);
  return "/* ============================================================\n"
    + "   КЕЙТОПЕДИЯ — данные\n"
    + "   ============================================================ */\n\n"
    + "const KEITO_DATA = " + pretty + ";\n";
}

var lastSavedNote = ""; // попадёт в комментарий коммита GitHub

/* ---------- Отправка данных: GitHub API (работает с любого устройства) ---------- */

function githubCfg() {
  const c = window.KEITO_GITHUB_CONFIG;
  return (c && c.repo && c.token) ? c : null;
}

function b64encodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64decodeUtf8(b64) {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/* Коммит одного файла в репозиторий. Если на GitHub уже такое же содержимое — не создаёт коммит. */
async function pushDirectToGitHub(cfg, content, message) {
  const filePath = cfg.path || "data.js";
  const api = "https://api.github.com/repos/" + cfg.repo + "/contents/" + filePath
    + (cfg.branch ? "?ref=" + encodeURIComponent(cfg.branch) : "");
  const headers = {
    Authorization: "Bearer " + cfg.token,
    Accept: "application/vnd.github+json",
    "User-Agent": "keitopedia-site",
  };

  let sha = null;
  const res = await fetch(api, { headers, cache: "no-store" });
  if (res.ok) {
    const info = await res.json();
    sha = info.sha;
    if (info.content && b64decodeUtf8(info.content) === content) {
      return { pushed: true, same: true }; // на GitHub уже актуально
    }
  } else if (res.status !== 404) {
    throw new Error("HTTP " + res.status);
  }

  const body = {
    message: message,
    content: b64encodeUtf8(content),
    branch: cfg.branch || "main",
  };
  if (sha) body.sha = sha;

  const put = await fetch("https://api.github.com/repos/" + cfg.repo + "/contents/" + filePath, {
    method: "PUT",
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, headers),
    body: JSON.stringify(body),
  });
  if (!put.ok) throw new Error("HTTP " + put.status);
  return { pushed: true };
}

/* Локальный сервер пригоден, когда сайт открыт через него */
function serverSaveAvailable() {
  return location.protocol === "http:" && (location.hostname === "localhost" || location.hostname === "127.0.0.1");
}

async function saveViaServer(content, note) {
  const res = await fetch("/api/save-data", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
      "X-Keito-Note": note ? encodeURIComponent(note) : "auto-save",
    },
    body: content,
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function markSavedInFile() {
  // записи теперь в файле — чтобы не задвоились при следующей загрузке
  customEntries.length = 0;
  saveCustomEntries(customEntries);
}

async function persistData() {
  const content = dataFileContent();
  const note = lastSavedNote;

  // 1) Локальный сервер, если сайт открыт через него: бэкапы на диске
  if (serverSaveAvailable()) {
    try {
      const info = await saveViaServer(content, note);
      markSavedInFile();
      if (info.pushed) toast("💾 Сохранено в data.js и отправлено на GitHub");
      else if (info.reason === "не настроен") toast("💾 Сохранено в data.js (бэкап — в data-backups)");
      else toast("💾 Записано в data.js, но GitHub не принял: " + info.reason);
      return;
    } catch { /* сервер недоступен — попробуем напрямую ниже */ }
  }

  // 2) Напрямую GitHub — работает с сайта, открытого с любого устройства
  const cfg = githubCfg();
  if (cfg) {
    try {
      const message = note ? "Кейтопедия: " + note : "Кейтопедия: обновление данных";
      const push = await pushDirectToGitHub(cfg, content, message);
      markSavedInFile();
      toast(push.same ? "💾 Данные на GitHub уже актуальны" : "💾 Записано в GitHub (data.js обновлён)");
      return;
    } catch { /* ниже — последний резерв */ }
  }

  // 3) Ничего не сработало — запись остаётся в браузере до следующего раза
  toast("⚠️ Нет связи с GitHub. Запись временно хранится в браузере");
}

/* ---------- Свежие данные с GitHub при загрузке ---------- */

/* data.js генерируется в строгом формате «шапка + const KEITO_DATA = {...};» */
function parseKeitoDataText(text) {
  const m = text.match(/^\/\*[\s\S]*?\*\/\s*\n\nconst KEITO_DATA = ([\s\S]*);\s*$/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function applyKeitoData(data) {
  if (!data || !Array.isArray(data.entries)) return false;
  KEITO_DATA.meta = data.meta || KEITO_DATA.meta;
  if (Array.isArray(data.sections)) KEITO_DATA.sections = data.sections;
  KEITO_DATA.entries.length = 0;
  KEITO_DATA.entries.push(...data.entries);
  rebuildDerivedData();
  renderAll();
  return true;
}

let lastRefreshAt = 0;

async function refreshFromGitHub(silent) {
  const cfg = githubCfg();
  if (!cfg || Date.now() - lastRefreshAt < 30000) return; // не чаще раза в 30 секунд
  try {
    const url = "https://raw.githubusercontent.com/" + cfg.repo + "/" + (cfg.branch || "main")
      + "/" + (cfg.path || "data.js") + "?t=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const data = parseKeitoDataText(await res.text());
    if (applyKeitoData(data)) lastRefreshAt = Date.now();
  } catch { /* нет связи — остаёмся на загруженной версии */ }
}

/* ---------- Сборка ---------- */

function renderAll() {
  renderSectionChips();
  renderCards();
}

function bindEvents() {
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (!$("#confirmBackdrop").hidden) { $("#confirmCancel").click(); return; }
      if (!$("#modalBackdrop").hidden) closeModal();
      if (!$("#addBackdrop").hidden) closeAddDialog();
    }
  });

  $("#modalCopy").onclick = copyCurrent;
  $("#modalClose").onclick = closeModal;

  $("#modalBackdrop").addEventListener("click", (ev) => {
    if (ev.target === $("#modalBackdrop")) closeModal();
  });

  $("#addBtn").onclick = openAddDialog;
  $("#addClose").onclick = closeAddDialog;
  $("#addBackdrop").addEventListener("click", (ev) => {
    if (ev.target === $("#addBackdrop")) closeAddDialog();
  });
  $("#addForm").addEventListener("submit", handleAddSubmit);

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

  // если накопились неотправленные записи — дожимаем на GitHub
  if (customEntries.length) { lastSavedNote = ""; persistData(); }

  // свежие данные с GitHub, чтобы видеть записи, добавленные с других устройств
  refreshFromGitHub().then(() => {
    if (githubCfg()) {
      window.addEventListener("focus", () => {
        if (Date.now() - lastRefreshAt > 60000) refreshFromGitHub(true); // при возврате на вкладку
      });
    }
  });

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
