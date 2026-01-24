// app.js
const app = document.getElementById("app");
const meta = document.getElementById("meta");

const statEvents = document.getElementById("statEvents");
const statPhotos = document.getElementById("statPhotos");
const statDays = document.getElementById("statDays");

const modal = document.getElementById("modal");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalTitle = document.getElementById("modalTitle");
const modalSub = document.getElementById("modalSub");
const modalGrid = document.getElementById("modalGrid");

// ---- Species normalization / merging ----
// Edit this list as you encounter new "scientific-ish" labels you want to fold into a common name.
// Key = incoming label (case-insensitive match after cleanup), Value = canonical label to use.
const SPECIES_SYNONYMS = new Map([
  ["artiodactyla order", "Ungulates"], // generic grouping bucket (safe)
  ["cervidae family", "Deer"],
  ["odocoileus virginianus", "White-tailed Deer"],
  ["bos taurus", "Cattle"],
  // Add more here as needed
]);

function cleanLabel(s) {
  return String(s ?? "").trim();
}
function labelKey(s) {
  return cleanLabel(s).toLowerCase().replace(/\s+/g, " ");
}
function canonicalSpecies(label) {
  const k = labelKey(label);
  return SPECIES_SYNONYMS.get(k) || cleanLabel(label) || "Unknown";
}

// ---- Helpers ----
function driveThumb(fileId, size = 800) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
}
function driveView(fileId) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}
function fmtRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const optsT = { hour: "numeric", minute: "2-digit" };
  const optsD = { month: "short", day: "numeric" };
  return sameDay
    ? `${s.toLocaleDateString(undefined, optsD)} • ${s.toLocaleTimeString(undefined, optsT)}–${e.toLocaleTimeString(undefined, optsT)}`
    : `${s.toLocaleString()} – ${e.toLocaleString()}`;
}
function dayKeyLocal(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Accept multiple possible JSON shapes
function getArrayFromEventsJson(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.sessions)) return data.sessions;
  if (Array.isArray(data?.data?.events)) return data.data.events;
  if (Array.isArray(data?.data?.sessions)) return data.data.sessions;
  return [];
}

// ---- Data ----
let ALL = []; // normalized events

async function load() {
  const res = await fetch("events.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch events.json (${res.status})`);
  const data = await res.json();
  const raw = getArrayFromEventsJson(data);

  // Normalize to internal shape
  ALL = raw
    .map((x) => {
      const items = Array.isArray(x.items) ? x.items : [];

      const camera = String(x.camera ?? x.cam ?? "").trim();
      const rawLabel = x.species ?? x.label ?? "Unknown";
      const label = canonicalSpecies(rawLabel);

      const start = x.start ?? x.start_time ?? x.begin ?? "";
      const end = x.end ?? x.end_time ?? x.finish ?? start;

      const id =
        x.event_id ??
        x.session_id ??
        x.id ??
        `${camera}|${label}|${start}`;

      const thumbId =
        x.thumbnail_file_id ||
        x.thumb_file_id ||
        x.file_id ||
        (items.length ? items[0].file_id : "");

      return {
        id: String(id),
        camera,
        label,
        start,
        end,
        count: Number.isFinite(x.count) ? x.count : items.length,
        thumb_file_id: thumbId,
        items: items.map((p) => ({
          file_id: p.file_id,
          datetime: p.datetime,
          filename: p.filename,
          drive_url: p.drive_url,
        })),
      };
    })
    .filter((e) => e.start);

  // Merge events that became the same label after canonicalization IF their time ranges overlap/are near
  // (so we don't incorrectly combine unrelated things).
  ALL = mergeSimilarEvents(ALL, 10 * 60 * 1000); // 10 min gap tolerance

  render(ALL);
}

function mergeSimilarEvents(events, gapMs) {
  // Group candidates by day + camera + label
  const groups = new Map();
  for (const e of events) {
    const day = dayKeyLocal(e.start);
    const k = `${day}||${e.camera}||${labelKey(e.label)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }

  const merged = [];
  for (const [, arr] of groups.entries()) {
    arr.sort((a, b) => new Date(a.start) - new Date(b.start));
    let cur = null;

    for (const e of arr) {
      const s = new Date(e.start).getTime();
      const en = new Date(e.end ?? e.start).getTime();

      if (!cur) {
        cur = cloneEvent(e);
        continue;
      }

      const curEnd = new Date(cur.end ?? cur.start).getTime();
      const overlapsOrClose = s <= (curEnd + gapMs);

      if (overlapsOrClose) {
        // merge into cur
        cur.start = new Date(Math.min(new Date(cur.start).getTime(), s)).toISOString();
        cur.end = new Date(Math.max(curEnd, en)).toISOString();
        cur.items = [...(cur.items || []), ...(e.items || [])]
          .filter(x => x && x.file_id)
          .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        cur.count = cur.items.length || (cur.count || 0) + (e.count || 0);

        // keep a thumb
        if (!cur.thumb_file_id && e.thumb_file_id) cur.thumb_file_id = e.thumb_file_id;
        if (!cur.thumb_file_id && cur.items.length) cur.thumb_file_id = cur.items[0].file_id;

      } else {
        merged.push(cur);
        cur = cloneEvent(e);
      }
    }

    if (cur) merged.push(cur);
  }

  // Stable-ish ordering: newest first overall
  merged.sort((a, b) => new Date(b.start) - new Date(a.start));
  return merged;
}

function cloneEvent(e) {
  return {
    ...e,
    items: Array.isArray(e.items) ? [...e.items] : [],
  };
}

function render(events) {
  // Stats
  const photoTotal = events.reduce((acc, x) => acc + (x.count || (x.items ? x.items.length : 0)), 0);
  const dayCount = new Set(events.map(e => dayKeyLocal(e.start))).size;

  statEvents.textContent = String(events.length);
  statPhotos.textContent = String(photoTotal);
  statDays.textContent = String(dayCount);

  meta.textContent = `${events.length} events • ${photoTotal} photos`;

  renderByDay(events);
}

function renderByDay(events) {
  app.innerHTML = "";

  const map = new Map();
  for (const e of events) {
    const k = dayKeyLocal(e.start);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }

  const days = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  for (const [day, items] of days) {
    // row by day, and within the day show newest first
    items.sort((a, b) => new Date(b.start) - new Date(a.start));

    const section = document.createElement("section");
    section.className = "row";

    const head = document.createElement("div");
    head.className = "row-title";
    head.innerHTML = `
      <h2>${escapeHtml(day)}</h2>
      <div class="small">${items.length} events</div>
    `;

    const scroller = document.createElement("div");
    scroller.className = "scroller";
    scroller.innerHTML = items.map(cardHTML).join("");

    section.appendChild(head);
    section.appendChild(scroller);
    app.appendChild(section);

    scroller.querySelectorAll("[data-event]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-event");
        const evt = items.find((x) => x.id === id);
        if (evt) openModal(evt);
      });
    });
  }

  if (!days.length) {
    app.innerHTML = `<div class="loading">No events found.</div>`;
  }
}

function cardHTML(e) {
  const thumbId = e.thumb_file_id || (e.items?.length ? e.items[0].file_id : "");
  const thumb = thumbId ? driveThumb(thumbId, 900) : "";

  const title = `${e.label}`;
  const sub = `${fmtRange(e.start, e.end)} • ${escapeHtml(e.camera)}`;
  const metaLine = `${e.count || (e.items ? e.items.length : 0)} photos`;

  return `
    <div class="card" data-event="${escapeHtml(e.id)}">
      <div class="thumb">
        ${thumb ? `<img src="${escapeHtml(thumb)}" alt="">` : `📷`}
      </div>
      <div class="body">
        <div class="ctitle">${escapeHtml(title)}</div>
        <div class="sub">${escapeHtml(sub)}</div>
        <div class="sub">${escapeHtml(metaLine)}</div>
      </div>
    </div>
  `;
}

// ---- Modal ----
function openModal(e) {
  modalTitle.textContent = `${e.label} • ${e.camera}`;
  modalSub.textContent = `${fmtRange(e.start, e.end)} • ${e.count || (e.items ? e.items.length : 0)} photos`;

  const items = e.items || [];
  modalGrid.innerHTML = items
    .map((p) => {
      const fileId = p.file_id;
      const thumb = fileId ? driveThumb(fileId, 900) : "";
      const view = p.drive_url || (fileId ? driveView(fileId) : "#");
      const dt = p.datetime ? new Date(p.datetime).toLocaleString() : "";

      return `
        <div class="pcell">
          <a href="${escapeHtml(view)}" target="_blank" rel="noreferrer">
            ${thumb ? `<img src="${escapeHtml(thumb)}" alt="">` : "📷"}
          </a>
          <div class="pmeta">${escapeHtml(dt || p.filename || "")}</div>
        </div>
      `;
    })
    .join("");

  modal.classList.remove("hidden");
}
function closeModal() {
  modal.classList.add("hidden");
  modalGrid.innerHTML = "";
}
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
});

// ---- Start ----
load().catch((err) => {
  app.innerHTML = `<div class="loading">Failed to load events.json. ${escapeHtml(err.message)}</div>`;
});
