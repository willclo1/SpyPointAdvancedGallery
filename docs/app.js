// app.js - Enhanced version with smooth interactions
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

// ========================================
// SPECIES NORMALIZATION
// ========================================
const SPECIES_SYNONYMS = new Map([
  // DEER / UNGULATES
  ["ungulate", "White-tailed Deer"],
  ["ungulates", "White-tailed Deer"],
  ["artiodactyla", "White-tailed Deer"],
  ["artiodactyla order", "White-tailed Deer"],
  ["cervidae", "White-tailed Deer"],
  ["cervidae family", "White-tailed Deer"],
  ["odocoileus", "White-tailed Deer"],
  ["odocoileus virginianus", "White-tailed Deer"],
  ["white tailed deer", "White-tailed Deer"],
  ["whitetail", "White-tailed Deer"],
  ["whitetail deer", "White-tailed Deer"],
  ["white-tail deer", "White-tailed Deer"],
  ["buck", "White-tailed Deer"],
  ["doe", "White-tailed Deer"],
  ["fawn", "White-tailed Deer"],
  ["deer", "White-tailed Deer"],

  // HOGS
  ["hog", "Feral Hog"],
  ["hogs", "Feral Hog"],
  ["wild hog", "Feral Hog"],
  ["feral hog", "Feral Hog"],
  ["boar", "Feral Hog"],
  ["sow", "Feral Hog"],
  ["pig", "Feral Hog"],
  ["wild pig", "Feral Hog"],
  ["sus scrofa", "Feral Hog"],
  ["swine", "Feral Hog"],

  // COYOTE / PREDATORS
  ["canid", "Coyote"],
  ["canidae", "Coyote"],
  ["canis", "Coyote"],
  ["canis latrans", "Coyote"],
  ["coyote", "Coyote"],

  ["fox", "Fox"],
  ["vulpes", "Fox"],
  ["vulpes vulpes", "Fox"],

  ["bobcat", "Bobcat"],
  ["lynx rufus", "Bobcat"],

  ["mountain lion", "Mountain Lion"],
  ["cougar", "Mountain Lion"],
  ["puma", "Mountain Lion"],
  ["felid", "Mountain Lion"],
  ["felidae", "Mountain Lion"],

  // SMALL MAMMALS
  ["raccoon", "Raccoon"],
  ["procyon lotor", "Raccoon"],
  ["racoon", "Raccoon"],

  ["opossum", "Opossum"],
  ["possum", "Opossum"],
  ["didelphis", "Opossum"],

  ["armadillo", "Armadillo"],
  ["dasypus", "Armadillo"],

  ["skunk", "Skunk"],
  ["mephitis", "Skunk"],

  ["rabbit", "Rabbit"],
  ["cottontail", "Rabbit"],
  ["hare", "Rabbit"],

  ["squirrel", "Squirrel"],
  ["rodent", "Squirrel"],
  ["rodentia", "Squirrel"],

  // BIRDS
  ["corvus", "Raven"],
  ["corvus corax", "Raven"],
  ["raven", "Raven"],

  ["crow", "Crow"],
  ["american crow", "Crow"],

  ["vulture", "Vulture"],
  ["turkey vulture", "Vulture"],
  ["black vulture", "Vulture"],

  ["hawk", "Hawk"],
  ["buteo", "Hawk"],

  ["owl", "Owl"],
  ["strix", "Owl"],

  ["wild turkey", "Wild Turkey"],
  ["turkey", "Wild Turkey"],
  ["meleagris", "Wild Turkey"],

  ["dove", "Dove"],
  ["mourning dove", "Dove"],

  ["roadrunner", "Roadrunner"],

  // LIVESTOCK
  ["bos taurus", "Cattle"],
  ["cattle", "Cattle"],
  ["cow", "Cattle"],
  ["bull", "Cattle"],

  ["horse", "Horse"],
  ["equus", "Horse"],

  ["goat", "Goat"],
  ["sheep", "Sheep"],

  // THROWAWAYS → Other
  ["animal", "Other"],
  ["mammal", "Other"],
  ["wildlife", "Other"],
  ["species", "Other"],
  ["unknown", "Other"],
  ["none", "Other"]
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

// ========================================
// HELPER FUNCTIONS
// ========================================
function extractDriveFileId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (!raw.includes("/") && !raw.includes("?") && raw.length >= 10) {
    return raw;
  }

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[1];
  }

  return "";
}

function driveThumbCandidates(fileId, size = 900, directUrl = "") {
  const id = extractDriveFileId(fileId || directUrl);
  const urls = [];

  if (directUrl && /^https?:\/\//i.test(directUrl)) {
    urls.push(directUrl);
  }

  if (id) {
    urls.push(
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size}`,
      `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w${size}`,
      `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`
    );
  }

  return [...new Set(urls)];
}

function driveView(fileId) {
  const id = extractDriveFileId(fileId);
  return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/view` : "#";
}

function imageHTML({ fileId = "", directUrl = "", alt = "Wildlife photo", eager = false }) {
  const candidates = driveThumbCandidates(fileId, 900, directUrl);
  if (!candidates.length) return `<div class="photo-unavailable">Photo unavailable</div>`;

  const encodedCandidates = escapeHtml(JSON.stringify(candidates));
  return `<img
    src="${escapeHtml(candidates[0])}"
    data-sources='${encodedCandidates}'
    data-source-index="0"
    alt="${escapeHtml(alt)}"
    loading="${eager ? "eager" : "lazy"}"
    decoding="async"
    ${eager ? 'fetchpriority="high"' : ''}
  >`;
}

function installImageFallbacks(root = document) {
  root.querySelectorAll("img[data-sources]").forEach((img) => {
    if (img.dataset.fallbackBound === "true") return;
    img.dataset.fallbackBound = "true";

    img.addEventListener("error", () => {
      let sources = [];
      try {
        sources = JSON.parse(img.dataset.sources || "[]");
      } catch (_) {
        sources = [];
      }

      const current = Number(img.dataset.sourceIndex || 0);
      const next = current + 1;
      if (next < sources.length) {
        img.dataset.sourceIndex = String(next);
        img.src = sources[next];
        return;
      }

      const fallback = document.createElement("div");
      fallback.className = "photo-unavailable";
      fallback.textContent = "Photo unavailable";
      img.replaceWith(fallback);
    });
  });
}

function fmtRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const optsT = { hour: "numeric", minute: "2-digit" };
  const optsD = { month: "short", day: "numeric", year: "numeric" };
  
  if (sameDay) {
    return `${s.toLocaleDateString(undefined, optsD)} • ${s.toLocaleTimeString(undefined, optsT)}–${e.toLocaleTimeString(undefined, optsT)}`;
  }
  return `${s.toLocaleDateString(undefined, optsD)} ${s.toLocaleTimeString(undefined, optsT)} – ${e.toLocaleDateString(undefined, optsD)} ${e.toLocaleTimeString(undefined, optsT)}`;
}

function dayKeyLocal(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatDayDisplay(dayKey) {
  const [year, month, day] = dayKey.split('-');
  const date = new Date(year, month - 1, day);
  const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString(undefined, options);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getArrayFromEventsJson(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.sessions)) return data.sessions;
  if (Array.isArray(data?.data?.events)) return data.data.events;
  if (Array.isArray(data?.data?.sessions)) return data.data.sessions;
  return [];
}

// ========================================
// DATA LOADING & PROCESSING
// ========================================
let ALL = [];

async function load() {
  try {
    const res = await fetch("events.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch events.json (${res.status})`);
    const data = await res.json();
    const raw = getArrayFromEventsJson(data);

    ALL = raw
      .map((x) => {
        const items = Array.isArray(x.items) ? x.items : [];
        const camera = String(x.camera ?? x.cam ?? "").trim();
        const rawLabel = x.species ?? x.label ?? "Unknown";
        const label = canonicalSpecies(rawLabel);
        const start = x.start ?? x.start_time ?? x.begin ?? "";
        const end = x.end ?? x.end_time ?? x.finish ?? start;
        const id = x.event_id ?? x.session_id ?? x.id ?? `${camera}|${label}|${start}`;
        const firstItem = items.length ? items[0] : {};
        const thumbId = extractDriveFileId(
          x.thumbnail_file_id || x.thumb_file_id || x.file_id || x.fileId || x.drive_file_id ||
          firstItem.file_id || firstItem.fileId || firstItem.drive_file_id || firstItem.drive_url || ""
        );
        const thumbUrl = x.thumbnail_url || x.thumb_url || x.image_url || firstItem.thumbnail_url || firstItem.thumb_url || "";

        return {
          id: String(id),
          camera,
          label,
          start,
          end,
          count: Number.isFinite(x.count) ? x.count : items.length,
          thumb_file_id: thumbId,
          thumb_url: thumbUrl,
          items: items.map((p) => ({
            file_id: extractDriveFileId(p.file_id || p.fileId || p.drive_file_id || p.drive_url || p.url || ""),
            thumbnail_url: p.thumbnail_url || p.thumb_url || p.image_url || "",
            datetime: p.datetime,
            filename: p.filename,
            drive_url: p.drive_url || p.url || "",
          })),
        };
      })
      .filter((e) => e.start);

    ALL = mergeSimilarEvents(ALL, 10 * 60 * 1000);
    render(ALL);
  } catch (err) {
    app.innerHTML = `<div class="loading">Unable to load events.json<small>${escapeHtml(err.message)}</small></div>`;
  }
}

function mergeSimilarEvents(events, gapMs) {
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
        cur.start = new Date(Math.min(new Date(cur.start).getTime(), s)).toISOString();
        cur.end = new Date(Math.max(curEnd, en)).toISOString();
        cur.items = [...(cur.items || []), ...(e.items || [])]
          .filter(x => x && x.file_id)
          .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        cur.count = cur.items.length || (cur.count || 0) + (e.count || 0);

        if (!cur.thumb_file_id && e.thumb_file_id) cur.thumb_file_id = e.thumb_file_id;
        if (!cur.thumb_url && e.thumb_url) cur.thumb_url = e.thumb_url;
        if (!cur.thumb_file_id && cur.items.length) cur.thumb_file_id = cur.items[0].file_id;
        if (!cur.thumb_url && cur.items.length) cur.thumb_url = cur.items[0].thumbnail_url || "";
      } else {
        merged.push(cur);
        cur = cloneEvent(e);
      }
    }

    if (cur) merged.push(cur);
  }

  merged.sort((a, b) => new Date(b.start) - new Date(a.start));
  return merged;
}

function cloneEvent(e) {
  return {
    ...e,
    items: Array.isArray(e.items) ? [...e.items] : [],
  };
}

// ========================================
// RENDERING
// ========================================
function render(events) {
  const photoTotal = events.reduce((acc, x) => acc + (x.count || (x.items ? x.items.length : 0)), 0);
  const dayCount = new Set(events.map(e => dayKeyLocal(e.start))).size;

  statEvents.textContent = events.length.toLocaleString();
  statPhotos.textContent = photoTotal.toLocaleString();
  statDays.textContent = dayCount.toLocaleString();

  meta.textContent = `Showing ${events.length} events across ${dayCount} days with ${photoTotal} total photos`;

  renderByDay(events);
}

function renderByDay(events) {
  app.innerHTML = "";

  if (!events.length) {
    app.innerHTML = `<div class="empty-state">No events found for the current data set.</div>`;
    return;
  }

  const map = new Map();
  for (const e of events) {
    const k = dayKeyLocal(e.start);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }

  const days = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  for (const [day, items] of days) {
    items.sort((a, b) => new Date(b.start) - new Date(a.start));

    const section = document.createElement("section");
    section.className = "row";

    const head = document.createElement("div");
    head.className = "row-title";
    head.innerHTML = `
      <h2>${escapeHtml(formatDayDisplay(day))}</h2>
      <div class="small">${items.length} event${items.length !== 1 ? 's' : ''}</div>
    `;

    const scroller = document.createElement("div");
    scroller.className = "scroller";
    scroller.innerHTML = items.map(cardHTML).join("");

    section.appendChild(head);
    section.appendChild(scroller);
    app.appendChild(section);
    installImageFallbacks(scroller);

    scroller.querySelectorAll("[data-event]").forEach((el) => {
      const open = () => {
        const id = el.getAttribute("data-event");
        const evt = items.find((x) => x.id === id);
        if (evt) openModal(evt);
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
  }
}

function cardHTML(e) {
  const firstItem = e.items?.length ? e.items[0] : {};
  const thumbId = e.thumb_file_id || firstItem.file_id || "";
  const thumbUrl = e.thumb_url || firstItem.thumbnail_url || "";
  const title = e.label;
  const sub = fmtRange(e.start, e.end);
  const camera = e.camera || "Unknown camera";
  const photoCount = e.count || (e.items ? e.items.length : 0);

  return `
    <article class="card" data-event="${escapeHtml(e.id)}" tabindex="0" role="button" aria-label="Open ${escapeHtml(title)} event from ${escapeHtml(camera)}">
      <div class="card-media">
        <div class="thumb">
          ${imageHTML({
            fileId: thumbId,
            directUrl: thumbUrl,
            alt: `${title} captured by ${camera}`,
          })}
        </div>
        <div class="card-status">${escapeHtml(camera)}</div>
      </div>
      <div class="body">
        <div class="card-primary">
          <div class="ctitle">${escapeHtml(title)}</div>
          <div class="card-count">${photoCount} photo${photoCount !== 1 ? "s" : ""}</div>
        </div>
        <div class="card-time">${escapeHtml(sub)}</div>
        <div class="card-footer">
          <div class="card-camera">${escapeHtml(formatDayDisplay(dayKeyLocal(e.start)))}</div>
          <div class="card-open">View event</div>
        </div>
      </div>
    </article>
  `;
}

// ========================================
// MODAL
// ========================================
function openModal(e) {
  modalTitle.textContent = `${e.label} • ${e.camera}`;
  const photoCount = e.count || (e.items ? e.items.length : 0);
  modalSub.textContent = `${fmtRange(e.start, e.end)} • ${photoCount} photo${photoCount !== 1 ? 's' : ''}`;

  const items = e.items || [];
  modalGrid.innerHTML = items
    .map((p) => {
      const fileId = p.file_id;
      const view = p.drive_url || (fileId ? driveView(fileId) : "#");
      const dt = p.datetime ? new Date(p.datetime).toLocaleString() : "";

      return `
        <div class="pcell">
          <a href="${escapeHtml(view)}" target="_blank" rel="noopener noreferrer">
            ${imageHTML({
              fileId,
              directUrl: p.thumbnail_url,
              alt: p.filename || "Wildlife photo",
            })}
          </a>
          <div class="pmeta">${escapeHtml(dt || p.filename || "")}</div>
        </div>
      `;
    })
    .join("");

  modal.classList.remove("hidden");
  installImageFallbacks(modalGrid);
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.add("hidden");
  modalGrid.innerHTML = "";
  document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !modal.classList.contains("hidden")) {
    closeModal();
  }
});

// ========================================
// THEME
// ========================================
const themeToggle = document.getElementById("themeToggle");
const themeToggleValue = document.getElementById("themeToggleValue");
const THEME_KEY = "ranch-events-theme";
const THEME_ORDER = ["auto", "dark", "light"];

function applyTheme(theme) {
  if (theme === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  themeToggleValue.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
  localStorage.setItem(THEME_KEY, theme);
}

const savedTheme = localStorage.getItem(THEME_KEY);
applyTheme(THEME_ORDER.includes(savedTheme) ? savedTheme : "auto");

themeToggle.addEventListener("click", () => {
  const current = localStorage.getItem(THEME_KEY) || "auto";
  const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
  applyTheme(next);
});

// ========================================
// START
// ========================================
load();
