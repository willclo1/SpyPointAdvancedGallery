const app = document.getElementById("app");
const meta = document.getElementById("meta");

const q = document.getElementById("q");
const cat = document.getElementById("cat");
const cam = document.getElementById("cam");
const sort = document.getElementById("sort");

const modal = document.getElementById("modal");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalTitle = document.getElementById("modalTitle");
const modalSub = document.getElementById("modalSub");
const modalGrid = document.getElementById("modalGrid");

// ---- Helpers ----
function driveThumb(fileId, size=600){
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
}
function driveView(fileId){
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}
function fmtRange(start, end){
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const optsT = {hour:"numeric", minute:"2-digit"};
  const optsD = {month:"short", day:"numeric"};
  return sameDay
    ? `${s.toLocaleDateString(undefined, optsD)} • ${s.toLocaleTimeString(undefined, optsT)}–${e.toLocaleTimeString(undefined, optsT)}`
    : `${s.toLocaleString()} – ${e.toLocaleString()}`;
}
function dayKey(iso){
  // YYYY-MM-DD
  return new Date(iso).toISOString().slice(0,10);
}
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ---- Data ----
let ALL = []; // sessions

// Expected events.json shape:
// { "sessions": [ { session_id, camera, category, label, start, end, count, items:[{file_id, datetime, drive_url?}] } ] }
async function load(){
  const res = await fetch("./events.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch events.json (${res.status})`);
  const data = await res.json();
  ALL = data.sessions || [];

  // Populate camera dropdown
  const cams = [...new Set(ALL.map(s => s.camera).filter(Boolean))].sort();
  for (const c of cams){
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    cam.appendChild(opt);
  }

  apply();
}

function apply(){
  const query = (q.value || "").trim().toLowerCase();
  const c = cat.value;
  const m = cam.value;
  const srt = sort.value;

  let filtered = ALL.filter(s => {
    if (c && s.category !== c) return false;
    if (m && s.camera !== m) return false;
    if (!query) return true;

    const hay = `${s.camera} ${s.category} ${s.label}`.toLowerCase();
    return hay.includes(query);
  });

  if (srt === "new") filtered.sort((a,b)=> new Date(b.start) - new Date(a.start));
  if (srt === "old") filtered.sort((a,b)=> new Date(a.start) - new Date(b.start));
  if (srt === "count") filtered.sort((a,b)=> (b.count||0) - (a.count||0));

  meta.textContent = `${filtered.length} events • ${filtered.reduce((acc,x)=>acc+(x.count||0),0)} photos`;

  renderByDay(filtered);
}

function renderByDay(sessions){
  app.innerHTML = "";

  // group by day (newest day first)
  const map = new Map();
  for (const s of sessions){
    const k = dayKey(s.start);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s);
  }
  const days = [...map.entries()].sort((a,b)=> b[0].localeCompare(a[0]));

  for (const [day, items] of days){
    const section = document.createElement("section");
    section.className = "row";

    const head = document.createElement("div");
    head.className = "row-title";
    head.innerHTML = `<h2>${escapeHtml(day)}</h2><div class="small">${items.length} events</div>`;

    const scroller = document.createElement("div");
    scroller.className = "scroller";
    scroller.innerHTML = items.map(cardHTML).join("");

    // attach click handlers
    section.appendChild(head);
    section.appendChild(scroller);
    app.appendChild(section);

    // delegate clicks
    scroller.querySelectorAll("[data-session]").forEach(el => {
      el.addEventListener("click", () => {
        const sid = el.getAttribute("data-session");
        const sess = items.find(x => x.session_id === sid);
        if (sess) openModal(sess);
      });
    });
  }

  if (!days.length){
    app.innerHTML = `<div class="loading">No matching events.</div>`;
  }
}

function cardHTML(s){
  const thumbFile = (s.items && s.items.length ? s.items[0].file_id : null) || s.thumb_file_id || s.file_id || "";
  const thumb = thumbFile ? driveThumb(thumbFile, 600) : "";
  const title = `${s.label} • ${s.camera}`;
  const sub = fmtRange(s.start, s.end);
  const meta = `${s.count || (s.items ? s.items.length : 0)} photos`;

  return `
    <div class="card" data-session="${escapeHtml(s.session_id)}">
      <div class="thumb">
        ${thumb ? `<img src="${thumb}" alt="">` : `📷`}
      </div>
      <div class="body">
        <div class="ctitle">${escapeHtml(title)}</div>
        <div class="sub">${escapeHtml(sub)}</div>
        <div class="sub">${escapeHtml(meta)}</div>
        <div class="badge">${escapeHtml(s.category || "")}</div>
      </div>
    </div>
  `;
}

// ---- Modal ----
function openModal(s){
  modalTitle.textContent = `${s.label} • ${s.camera}`;
  modalSub.textContent = `${fmtRange(s.start, s.end)} • ${s.count || (s.items ? s.items.length : 0)} photos`;

  const items = s.items || [];
  modalGrid.innerHTML = items.map(p => {
    const fileId = p.file_id;
    const thumb = driveThumb(fileId, 600);
    const view = p.drive_url || driveView(fileId);
    const dt = p.datetime ? new Date(p.datetime).toLocaleString() : "";

    return `
      <div class="pcell">
        <a href="${escapeHtml(view)}" target="_blank" rel="noreferrer">
          <img src="${escapeHtml(thumb)}" alt="">
        </a>
        <div class="pmeta">${escapeHtml(dt || p.filename || "")}</div>
      </div>
    `;
  }).join("");

  modal.classList.remove("hidden");
}
function closeModal(){
  modal.classList.add("hidden");
  modalGrid.innerHTML = "";
}
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
});

// ---- Wire filters ----
q.addEventListener("input", apply);
cat.addEventListener("change", apply);
cam.addEventListener("change", apply);
sort.addEventListener("change", apply);

// ---- Start ----
load().catch(err => {
  app.innerHTML = `<div class="loading">Failed to load events.json. ${escapeHtml(err.message)}</div>`;
});
