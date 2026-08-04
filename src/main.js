/* Emissary — frontend. Plain ES module, no framework.
   Data flows one way: Rust `load_dataset` → compact() → state → render*(). */

const T = window.__TAURI__ ?? null;
const invoke = T?.core?.invoke;

const DIRS = [
  { k: "normal",        lbl: "Normal",        v: "--c-nor" },
  { k: "directional",   lbl: "Directional",   v: "--c-dir" },
  { k: "hemispherical", lbl: "Hemispherical", v: "--c-hem" },
  { k: null,            lbl: "Unspecified",   v: "--c-uns" },
];
const FAMS = ["FTIR", "Monochromator", "Radiometer", "IR camera", "Fiber-optic", "Other"];
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const dirColor = d => css((DIRS.find(x => x.k === d) || DIRS[3]).v);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = id => document.getElementById(id);

// scales shared by fingerprint, list sparks and the plane
const LMIN = 0.15, LMAX = 1200, TMIN = 0, TMAX = 3100;
const lx = (v, w) => (Math.log10(v) - Math.log10(LMIN)) / (Math.log10(LMAX) - Math.log10(LMIN)) * w;
const ty = (v, h) => h - (v - TMIN) / (TMAX - TMIN) * h;

function famOf(det) {
  const s = det.join(" ").toLowerCase();
  if (/ftir|bruker|nicolet|jasco|bomem|vertex|invenio|is50|ifs/.test(s)) return "FTIR";
  if (/camera/.test(s)) return "IR camera";
  if (/fiber|nirquest|ocean/.test(s)) return "Fiber-optic";
  if (/monochromator|grating|scanning spectrometer|prism/.test(s)) return "Monochromator";
  if (/pyrometer|radiometer|thermopile|photodiode|golay|cell/.test(s)) return "Radiometer";
  return "Other";
}

function compact(rec) {
  const b = rec.bibliographic || {}, i = rec.instrument || {}, c = rec.citations || {}, loc = rec.location || {};
  const au = b.authors || [];
  const first = au[0] ? au[0].trim().split(/\s+/).pop() : "?";
  const sr = i.spectral_range_um || [null, null], tr = i.temperature_range_K || [null, null];
  const affs = loc.affiliations || [];
  let city = null;
  for (const af of affs) if (af.author_position === "corresponding" && af.city) { city = af.city; break; }
  if (!city && affs[0]) city = affs[0].city || null;
  return {
    id: rec.id, doi: b.doi || null, t: b.title || "(untitled)", y: b.year ?? null, v: b.venue || "",
    a: au, lbl: `${first} ${b.year ?? ""}`.trim(), cc: loc.corresponding_country || null, city,
    d: i.direction ?? null, sp: i.spectral ?? null,
    l0: sr[0] ?? null, l1: sr[1] ?? null, t0: tr[0] ?? null, t1: tr[1] ?? null,
    det: i.detection_method || [], fam: famOf(i.detection_method || []),
    tm: i.temperature_measurement_method || [], tc: i.temperature_control_method || [],
    cit: c.total ?? null, citU: c.total_updated || null,
    cin: c.cites || [], cout: c.cited_by || [],
    chg: rec.meta?.changelog || [], metaU: rec.meta?.updated || null,
  };
}

// ---------------- state ----------------
let P = [];            // compact papers
let byId = new Map();
let GRAPH = null;
let DEN = null;        // corpus density bins
const state = {
  q: "", sort: "year-desc", view: "library", sel: null, special: null,
  dirs: new Set(DIRS.map(d => d.k)), fams: new Set(FAMS),
  planeDirs: new Set(DIRS.map(d => d.k)),
};

// ---------------- settings ----------------
const DEFAULTS = {
  theme: "system",        // system | light | dark
  tempUnit: "K",          // K | C
  wavenumber: false,      // show cm⁻¹ alongside µm
  wien: true,             // Wien displacement check in tooltips
  shadow: true,           // corpus-coverage shadow in fingerprints
  verboseTips: true,      // technical detail in tooltips
  defaultView: "library",
};
const SETTINGS = { ...DEFAULTS, ...JSON.parse(localStorage.getItem("emissary.settings") || "{}") };
function saveSettings() { localStorage.setItem("emissary.settings", JSON.stringify(SETTINGS)); }
function applyTheme() {
  const r = document.documentElement;
  if (SETTINGS.theme === "system") r.removeAttribute("data-theme");
  else r.setAttribute("data-theme", SETTINGS.theme);
}
const isDark = () =>
  (document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";

// ---------------- physics helpers ----------------
const IR_BANDS = [[0.001, 0.38, "UV"], [0.38, 0.7, "VIS"], [0.7, 1.4, "NIR"], [1.4, 3, "SWIR"], [3, 8, "MWIR"], [8, 15, "LWIR"], [15, 1001, "FIR"]];
function bandName(l0, l1) {
  const hit = IR_BANDS.filter(([a, b]) => l1 > a && l0 < b).map(([, , n]) => n);
  return hit.length ? (hit.length > 1 ? hit[0] + "–" + hit[hit.length - 1] : hit[0]) : "";
}
const kToC = k => k - 273.15;
function fmtT1(k) {
  return SETTINGS.tempUnit === "C" ? `${Math.round(kToC(k))} °C` : `${k} K`;
}
function fmtTRange(t0, t1) {
  return SETTINGS.tempUnit === "C"
    ? `${Math.round(kToC(t0))}–${Math.round(kToC(t1))} °C`
    : `${t0}–${t1} K`;
}
const wienPeak = tK => 2897.77 / tK; // µm — Wien displacement law λ_max = b/T
function wienNote(p) {
  if (p.t0 == null || p.t1 == null) return "";
  const pk1 = wienPeak(p.t1), pk2 = wienPeak(p.t0); // hotter → shorter λ
  const s = `Wien peak ${pk1.toFixed(1)}–${pk2.toFixed(1)} µm`;
  if (p.l0 == null || p.l1 == null) return s;
  const inBand = pk1 <= p.l1 && pk2 >= p.l0;
  return s + (inBand ? " · in band ✓" : " · outside band ✗");
}
const wn = um => Math.round(10000 / um); // wavenumber cm⁻¹
function fmtLambda(p) {
  if (p.l0 == null || p.l1 == null) return p.sp === false ? "total (non-spectral)" : "λ not reported";
  let s = `λ ${p.l0}–${p.l1} µm`;
  const b = bandName(p.l0, p.l1);
  if (b) s += ` (${b})`;
  if (SETTINGS.wavenumber) s += ` · ${wn(p.l1)}–${wn(p.l0)} cm⁻¹`;
  return s;
}
function fmtTemp(p) {
  if (p.t0 == null || p.t1 == null) return "T not reported";
  return `T ${fmtTRange(p.t0, p.t1)}`;
}

function matches(p) {
  if (!state.dirs.has(p.d)) return false;
  if (!state.fams.has(p.fam)) return false;
  if (state.special === "nogeom" && p.d !== null) return false;
  if (state.special === "incomplete" && p.l0 != null && p.t0 != null) return false;
  if (state.special === "mojibake" && !p.a.some(a => /\S\?|\?\S/.test(a))) return false;
  if (state.q) {
    const h = (p.t + " " + p.lbl + " " + p.v + " " + p.a.join(" ") + " " + p.det.join(" ") + " " + (p.cc || "") + " " + (p.city || "")).toLowerCase();
    if (!h.includes(state.q)) return false;
  }
  return true;
}
const sorted = list => list.slice().sort((a, b) =>
  state.sort === "year-desc" ? (b.y || 0) - (a.y || 0) :
  state.sort === "year-asc"  ? (a.y || 0) - (b.y || 0) :
  state.sort === "cit-desc"  ? (b.cit || 0) - (a.cit || 0) :
  a.lbl.localeCompare(b.lbl));

// ---------------- densities / fingerprint ----------------
function computeDensities() {
  const NB = 60, lb = new Array(NB).fill(0), tb = new Array(NB).fill(0);
  P.forEach(p => {
    if (p.l0 != null && p.l1 != null) for (let i = 0; i < NB; i++) {
      const v = Math.pow(10, Math.log10(LMIN) + (i + .5) / NB * (Math.log10(LMAX) - Math.log10(LMIN)));
      if (v >= p.l0 && v <= p.l1) lb[i]++;
    }
    if (p.t0 != null && p.t1 != null) for (let i = 0; i < NB; i++) {
      const v = TMIN + (i + .5) / NB * (TMAX - TMIN);
      if (v >= p.t0 && v <= p.t1) tb[i]++;
    }
  });
  DEN = { lb, tb, max: Math.max(...lb, ...tb, 1) };
}

function dirGlyph(d, x, y, s, c) {
  if (d === "normal") return `<g transform="translate(${x},${y})"><line x1="0" y1="${s}" x2="0" y2="${-s * .2}" stroke="${c}" stroke-width="2"/><path d="M-3.5 ${-s * .2 + 4} L0 ${-s * .2} L3.5 ${-s * .2 + 4}" fill="none" stroke="${c}" stroke-width="2"/><line x1="${-s}" y1="${s}" x2="${s}" y2="${s}" stroke="${c}" stroke-width="2" opacity=".45"/></g>`;
  if (d === "directional") return `<g transform="translate(${x},${y})">${[-40, -20, 0, 20, 40].map(a => `<line x1="0" y1="${s}" x2="${(Math.sin(a * Math.PI / 180) * s * 1.15).toFixed(1)}" y2="${(s - Math.cos(a * Math.PI / 180) * s * 1.15).toFixed(1)}" stroke="${c}" stroke-width="1.6"/>`).join("")}<line x1="${-s}" y1="${s}" x2="${s}" y2="${s}" stroke="${c}" stroke-width="2" opacity=".45"/></g>`;
  if (d === "hemispherical") return `<g transform="translate(${x},${y})"><path d="M${-s} ${s} A ${s} ${s} 0 0 1 ${s} ${s}" fill="${c}" opacity=".25" stroke="${c}" stroke-width="1.6"/><line x1="${-s}" y1="${s}" x2="${s}" y2="${s}" stroke="${c}" stroke-width="2" opacity=".45"/></g>`;
  return `<g transform="translate(${x},${y})"><circle r="${(s * .55).toFixed(1)}" cy="${(s * .4).toFixed(1)}" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="3 3"/></g>`;
}

function fingerprintSVG(p, W) {
  const AX = W - 140, X0 = 96, rowL = 34, rowT = 78, H = 112;
  const den = (bins, y) => !SETTINGS.shadow ? "" : bins.map((n, i) => {
    const x0 = i / bins.length * AX, x1 = (i + 1) / bins.length * AX;
    return `<rect class="ctx" x="${(X0 + x0).toFixed(1)}" y="${y - 9}" width="${Math.max(x1 - x0, .5).toFixed(1)}" height="18" opacity="${(.05 + .25 * n / DEN.max).toFixed(2)}"/>`;
  }).join("");
  const c = dirColor(p.d);
  let s = `<svg class="fp" viewBox="0 0 ${W} ${H}" role="img" aria-label="Instrument fingerprint">`;
  s += `<text x="0" y="${rowL + 3}">λ  µm</text>` + den(DEN.lb, rowL);
  s += `<line class="axline" x1="${X0}" y1="${rowL + 11}" x2="${X0 + AX}" y2="${rowL + 11}"/>`;
  [0.2, 1, 5, 20, 100, 1000].forEach(v => { const x = X0 + lx(v, AX); s += `<line class="axline" x1="${x.toFixed(1)}" y1="${rowL + 11}" x2="${x.toFixed(1)}" y2="${rowL + 14}"/><text x="${x.toFixed(1)}" y="${rowL + 25}" text-anchor="middle">${v}</text>`; });
  if (p.l0 != null && p.l1 != null) {
    const a = X0 + lx(Math.max(p.l0, LMIN), AX), b = X0 + lx(Math.min(p.l1, LMAX), AX);
    s += `<rect x="${a.toFixed(1)}" y="${rowL - 7}" width="${Math.max(b - a, 3).toFixed(1)}" height="14" rx="4" fill="${c}" opacity=".85"/>`;
    s += `<text x="${a.toFixed(1)}" y="${rowL - 12}" text-anchor="middle" style="fill:${c};font-weight:600">${p.l0}</text><text x="${b.toFixed(1)}" y="${rowL - 12}" text-anchor="middle" style="fill:${c};font-weight:600">${p.l1}</text>`;
  } else s += `<text x="${X0 + 4}" y="${rowL + 3}" style="font-style:italic">not reported${p.sp === false ? " — total (non-spectral)" : ""}</text>`;
  const tval = k => SETTINGS.tempUnit === "C" ? Math.round(kToC(k)) : k;
  s += `<text x="0" y="${rowT + 3}">T  ${SETTINGS.tempUnit === "C" ? "°C" : "K"}</text>` + den(DEN.tb, rowT);
  s += `<line class="axline" x1="${X0}" y1="${rowT + 11}" x2="${X0 + AX}" y2="${rowT + 11}"/>`;
  [300, 1000, 2000, 3000].forEach(v => { const x = X0 + (v - TMIN) / (TMAX - TMIN) * AX; s += `<line class="axline" x1="${x.toFixed(1)}" y1="${rowT + 11}" x2="${x.toFixed(1)}" y2="${rowT + 14}"/><text x="${x.toFixed(1)}" y="${rowT + 25}" text-anchor="middle">${tval(v)}</text>`; });
  if (p.t0 != null && p.t1 != null) {
    const a = X0 + (p.t0 - TMIN) / (TMAX - TMIN) * AX, b = X0 + (p.t1 - TMIN) / (TMAX - TMIN) * AX;
    s += `<rect x="${a.toFixed(1)}" y="${rowT - 7}" width="${Math.max(b - a, 3).toFixed(1)}" height="14" rx="4" fill="${c}" opacity=".55"/>`;
    s += `<text x="${a.toFixed(1)}" y="${rowT - 12}" text-anchor="middle" style="fill:${c};font-weight:600">${tval(p.t0)}</text><text x="${b.toFixed(1)}" y="${rowT - 12}" text-anchor="middle" style="fill:${c};font-weight:600">${tval(p.t1)}</text>`;
  } else s += `<text x="${X0 + 4}" y="${rowT + 3}" style="font-style:italic">not reported</text>`;
  s += dirGlyph(p.d, W - 42, 24, 18, c);
  s += `<text x="${W - 42}" y="72" text-anchor="middle" style="fill:${c};font-weight:600">${p.d || "unspec."}</text>`;
  return s + `</svg>`;
}

// ---------------- chips + facets ----------------
function chipEl(label, color, pressed, extra, tip) {
  const b = document.createElement("button");
  b.className = "chip"; b.setAttribute("aria-pressed", pressed);
  b.title = tip || `Toggle ${label} (${extra ?? 0} records)`;
  b.innerHTML = (color ? `<span class="dot" style="background:${color}"></span>` : "") + esc(label) +
    (extra != null ? ` <span style="font-family:var(--mono);font-size:10px">${extra}</span>` : "");
  return b;
}
function renderChips() {
  const dc = $("dirChips"); dc.innerHTML = "";
  DIRS.forEach(d => {
    const n = P.filter(p => p.d === d.k).length;
    const b = chipEl(d.lbl, css(d.v), state.dirs.has(d.k), n);
    b.onclick = () => { state.dirs.has(d.k) ? state.dirs.delete(d.k) : state.dirs.add(d.k); renderAll(); };
    dc.appendChild(b);
  });
  const fc = $("famChips"); fc.innerHTML = "";
  FAMS.forEach(f => {
    const n = P.filter(p => p.fam === f).length;
    const b = chipEl(f, null, state.fams.has(f), n);
    b.onclick = () => { state.fams.has(f) ? state.fams.delete(f) : state.fams.add(f); renderAll(); };
    fc.appendChild(b);
  });
  const sc = $("specialChip"); sc.innerHTML = "";
  if (state.special) {
    const names = { nogeom: "missing geometry", incomplete: "incomplete ranges", mojibake: "encoding damage" };
    const b = chipEl(`✕ ${names[state.special]}`, null, "true");
    b.classList.add("dismiss");
    b.onclick = () => { recordNav(); state.special = null; renderAll(); };
    sc.appendChild(b);
  }
}

// ---------------- list ----------------
function sparkPair(p) {
  const l = p.l0 != null && p.l1 != null
    ? `<div class="spark"><i style="left:${lx(Math.max(p.l0, LMIN), 100).toFixed(1)}%;right:${(100 - lx(Math.min(p.l1, LMAX), 100)).toFixed(1)}%;background:${dirColor(p.d)}"></i></div>`
    : `<div class="spark"></div>`;
  const t = p.t0 != null && p.t1 != null
    ? `<div class="spark"><i style="left:${(100 - ty(p.t0, 100)).toFixed(1)}%;right:${ty(p.t1, 100).toFixed(1)}%;background:${dirColor(p.d)};opacity:.55"></i></div>`
    : `<div class="spark"></div>`;
  return `<div class="rspark">${l}${t}</div>`;
}
function renderList() {
  const list = sorted(P.filter(matches));
  const rows = $("view-library"); rows.innerHTML = "";
  const frag = document.createDocumentFragment();
  list.forEach(p => {
    const r = document.createElement("button");
    r.className = "row" + (state.sel && state.sel.id === p.id ? " sel" : "");
    r.setAttribute("role", "option"); r.setAttribute("aria-selected", !!(state.sel && state.sel.id === p.id));
    const unc = p.d == null;
    r.title = `${p.t}\n${fmtLambda(p)} · ${fmtTemp(p)} · ${p.d || "geometry unspecified"}` +
      (SETTINGS.wien && SETTINGS.verboseTips ? `\n${wienNote(p)}` : "");
    r.innerHTML = `<span class="gdot${unc ? " uns" : ""}" style="${unc ? "" : `background:${dirColor(p.d)}`}"></span>
      <span class="rlbl">${esc(p.lbl)} <span class="rv">· ${esc(p.v)}</span></span>
      ${sparkPair(p)}
      <span class="rttl">${esc(p.t)}</span>`;
    r.onclick = () => goSelect(p);
    frag.appendChild(r);
  });
  rows.appendChild(frag);
  $("countLine").textContent = `${list.length} of ${P.length} records — ${list.filter(p => p.l0 != null && p.t0 != null).length} with full λ+T coverage`;
}

// ---------------- inspector ----------------
function renderInspector() {
  const p = state.sel, el = $("inspector");
  if (!p) { el.innerHTML = ""; return; }
  const tags = (arr, cls) => (arr.length ? arr : ["—"]).map(x => `<span class="tag ${cls}">${esc(x)}</span>`).join("");
  const linkTags = ids => ids.slice(0, 6).map(id => {
    const q = byId.get(id);
    return `<button class="tag link" data-goto="${esc(id)}">${esc(q ? q.lbl : id)}</button>`;
  }).join("") + (ids.length > 6 ? `<span class="tag">+${ids.length - 6}</span>` : "");
  const stale = p.citU && p.metaU && p.citU < p.metaU;
  el.innerHTML = `
    <div class="ins-eyebrow">${esc(p.fam)} · ${esc(p.cc || "—")} · ${p.y ?? "—"}</div>
    <div class="ins-title">${esc(p.t)}</div>
    <div class="ins-doi">${esc(p.id)}</div>
    ${fingerprintSVG(p, 304)}
    <dl class="ins-kv">
      <dt>Authors</dt><dd>${esc(p.a.slice(0, 3).join(", "))}${p.a.length > 3 ? ` +${p.a.length - 3}` : ""}</dd>
      <dt>Venue</dt><dd>${esc(p.v || "—")}</dd>
      <dt>Citations</dt><dd>${p.cit ?? "—"} total <span class="tag ${stale ? "stale" : "fresh"}" style="margin-left:4px">${stale ? "stale" : "fresh"}${p.citU ? " · " + esc(p.citU) : ""}</span></dd>
      <dt>Spectral</dt><dd>${p.sp === true ? "yes" : p.sp === false ? "no — total measurement" : "not stated"}</dd>
    </dl>
    ${p.doi ? `<button class="tbtn openbtn" id="openDoi">Open paper ↗</button>` : ""}
    <div class="divider"></div>
    <div class="ins-eyebrow">Detection — raw → normalized</div>
    <div class="tagrow">${tags(p.det, "raw")}<span class="tag norm">${esc(p.fam)}</span></div>
    <div class="ins-eyebrow" style="margin-top:10px">Temperature — measurement · control</div>
    <div class="tagrow">${tags(p.tm, "raw")}${tags(p.tc, "raw")}</div>
    <div class="divider"></div>
    <div class="ins-eyebrow">In-corpus citations</div>
    <div class="ins-kv"><dt>Cites</dt><dd>${p.cin.length ? "" : "none"}</dd></div>
    <div class="tagrow">${linkTags(p.cin)}</div>
    <div class="ins-kv"><dt>Cited by</dt><dd>${p.cout.length ? "" : "none"}</dd></div>
    <div class="tagrow">${linkTags(p.cout)}</div>
    <div class="divider"></div>
    <div class="ins-eyebrow">History — append-only</div>
    <ul class="changelog">${p.chg.map(c => `<li><b>${esc(c.date || "")}</b> ${esc(c.change || "")}</li>`).join("") || "<li>no changelog</li>"}</ul>`;
  el.querySelectorAll("[data-goto]").forEach(b => b.onclick = () => {
    const q = byId.get(b.dataset.goto);
    if (q) goSelect(q);
  });
  const ob = $("openDoi");
  if (ob) ob.onclick = () => T?.opener?.openUrl?.("https://doi.org/" + p.doi);
}

// ---------------- tooltip ----------------
const tip = () => $("tip");
function showTipAt(e, html) {
  const t = tip(); t.style.display = "block"; t.innerHTML = html;
  t.style.left = Math.min(e.clientX + 14, innerWidth - 330) + "px";
  t.style.top = Math.min(e.clientY + 14, innerHeight - 96) + "px";
}
const hideTip = () => { tip().style.display = "none"; };
function paperTip(p) {
  let tech = `${fmtLambda(p)} · ${fmtTemp(p)}`;
  if (SETTINGS.verboseTips) {
    const bits = [];
    if (SETTINGS.wien) { const w = wienNote(p); if (w) bits.push(w); }
    if (p.det.length) bits.push(esc(p.det.join(", ")));
    if (p.tm.length || p.tc.length) bits.push(`T-metrology: ${esc([...p.tm, ...p.tc].join(", "))}`);
    tech += bits.length ? "<br>" + bits.join("<br>") : "";
  }
  return `<b>${esc(p.lbl)} — ${esc(p.d || "geometry unspecified")}, ${esc(p.fam)}</b>${esc(p.t)}<br>
    <span class="tmono">${tech}<br>${p.cit ?? 0} citations · ${esc(p.cc || "country n/r")}</span>`;
}

// ---------------- capability plane ----------------
function renderPlane() {
  const svg = $("plane"); const W = 1000, H = 560, M = { l: 64, r: 16, t: 24, b: 44 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const X = v => M.l + lx(v, iw), Y = v => M.t + ty(v, ih);
  let g = `<g class="axis">`;
  [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000].forEach(v => { g += `<line x1="${X(v).toFixed(1)}" y1="${M.t}" x2="${X(v).toFixed(1)}" y2="${H - M.b}"/><text x="${X(v).toFixed(1)}" y="${H - M.b + 16}" text-anchor="middle">${v}</text>`; });
  [500, 1000, 1500, 2000, 2500, 3000].forEach(v => { g += `<line x1="${M.l}" y1="${Y(v).toFixed(1)}" x2="${W - M.r}" y2="${Y(v).toFixed(1)}"/><text x="${M.l - 8}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${v}</text>`; });
  g += `<text x="${M.l + iw / 2}" y="${H - 6}" text-anchor="middle">wavelength λ (µm, log)</text>`;
  g += `<text x="14" y="${M.t + ih / 2}" text-anchor="middle" transform="rotate(-90 14 ${M.t + ih / 2})">temperature (K)</text></g>`;
  let full = 0, lonly = 0, tonly = 0, none = 0, marks = "";
  P.forEach((p, i) => {
    const on = state.planeDirs.has(p.d);
    const c = dirColor(p.d);
    if (p.l0 != null && p.l1 != null && p.t0 != null && p.t1 != null) {
      full++;
      const x0 = X(Math.max(p.l0, LMIN)), x1 = X(Math.min(p.l1, LMAX));
      const y1 = Y(Math.max(p.t0, 1)), y0 = Y(Math.min(p.t1, TMAX));
      marks += `<rect class="pm" data-i="${i}" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${Math.max(x1 - x0, 2.5).toFixed(1)}" height="${Math.max(y1 - y0, 2.5).toFixed(1)}" rx="3" fill="${c}" fill-opacity="${on ? .13 : .02}" stroke="${c}" stroke-opacity="${on ? .9 : .12}" stroke-width="${state.sel && state.sel.id === p.id ? 3 : 1.4}" ${p.d == null ? 'stroke-dasharray="4 3"' : ""} style="cursor:pointer"/>`;
    } else if (p.l0 != null && p.l1 != null) {
      lonly++;
      marks += `<line class="pm" data-i="${i}" x1="${X(Math.max(p.l0, LMIN)).toFixed(1)}" y1="${H - M.b + 23}" x2="${X(Math.min(p.l1, LMAX)).toFixed(1)}" y2="${H - M.b + 23}" stroke="${c}" stroke-opacity="${on ? .75 : .1}" stroke-width="3" stroke-linecap="round" style="cursor:pointer"/>`;
    } else if (p.t0 != null && p.t1 != null) {
      tonly++;
      marks += `<line class="pm" data-i="${i}" x1="${M.l - 34}" y1="${Y(p.t0).toFixed(1)}" x2="${M.l - 34}" y2="${Y(p.t1).toFixed(1)}" stroke="${c}" stroke-opacity="${on ? .75 : .1}" stroke-width="3" stroke-linecap="round" style="cursor:pointer"/>`;
    } else none++;
  });
  svg.innerHTML = g + marks +
    `<text x="${W - M.r - 6}" y="${M.t - 8}" text-anchor="end" class="axis" style="font-size:10px;fill:var(--ink3);font-family:var(--mono)">${full} full · ${lonly} λ-only (strip below axis) · ${tonly} T-only (strip left) · ${none} with neither</text>`;
  svg.querySelectorAll(".pm").forEach(el => {
    const p = P[+el.dataset.i];
    el.addEventListener("mousemove", e => showTipAt(e, paperTip(p)));
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("click", () => goSelect(p));
  });
  const lg = $("planeLegend"); lg.innerHTML = "";
  DIRS.forEach(d => {
    const n = P.filter(p => p.d === d.k).length;
    const b = chipEl(d.lbl, css(d.v), state.planeDirs.has(d.k), n);
    b.onclick = () => { state.planeDirs.has(d.k) ? state.planeDirs.delete(d.k) : state.planeDirs.add(d.k); renderPlane(); };
    lg.appendChild(b);
  });
}

// ---------------- timeline ----------------
function renderTimeline() {
  const svg = $("timeline"); const W = 1000, H = 300, M = { l: 34, r: 10, t: 12, b: 30 };
  const years = P.map(p => p.y).filter(Boolean);
  const y0 = Math.min(...years), y1 = Math.max(...years);
  const iw = W - M.l - M.r, ih = H - M.t - M.b, bw = iw / (y1 - y0 + 1);
  const by = {}; P.forEach(p => { if (p.y) (by[p.y] = by[p.y] || []).push(p); });
  const maxN = Math.max(...Object.values(by).map(v => v.length));
  let g = `<g class="axis">`;
  for (let v = Math.ceil(y0 / 20) * 20; v <= y1; v += 20) {
    const x = M.l + (v - y0 + .5) * bw;
    g += `<line x1="${x.toFixed(1)}" y1="${M.t}" x2="${x.toFixed(1)}" y2="${H - M.b}"/><text x="${x.toFixed(1)}" y="${H - M.b + 16}" text-anchor="middle">${v}</text>`;
  }
  for (let v = 2; v <= maxN; v += 2) {
    const y = M.t + ih - v / maxN * ih;
    g += `<text x="${M.l - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${v}</text>`;
  }
  g += `</g>`;
  let marks = "";
  const order = ["normal", "directional", "hemispherical", null];
  for (let yy = y0; yy <= y1; yy++) {
    const list = by[yy] || []; if (!list.length) continue;
    let acc = 0;
    order.forEach(k => {
      const sub = list.filter(p => p.d === k); if (!sub.length) return;
      const h = sub.length / maxN * ih;
      const x = M.l + (yy - y0) * bw + .7, y = M.t + ih - acc - h;
      marks += `<rect data-y="${yy}" x="${x.toFixed(1)}" y="${(y + 1).toFixed(1)}" width="${(bw - 1.4).toFixed(1)}" height="${Math.max(h - 2, 1.2).toFixed(1)}" rx="1.5" fill="${dirColor(k)}" style="cursor:pointer"/>`;
      acc += h;
    });
  }
  svg.innerHTML = g + marks;
  svg.querySelectorAll("rect[data-y]").forEach(el => {
    const yy = +el.dataset.y, list = by[yy];
    el.addEventListener("mousemove", e => showTipAt(e, `<b>${yy} — ${list.length} instrument${list.length > 1 ? "s" : ""}</b>` + list.map(p => esc(p.lbl)).join(" · ")));
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("click", () => goSelect(list[0]));
  });
  const lg = $("timeLegend"); lg.innerHTML = "";
  DIRS.forEach(d => { const b = chipEl(d.lbl, css(d.v), "true"); b.style.cursor = "default"; lg.appendChild(b); });
}

// ---------------- atlas ----------------
// Equirectangular projection, Antarctica dropped: lon −180…180 → x, lat 84…−60 → y.
const MAPW = 1000, MAPH = 480;
const prj = (lon, lat) => [(lon + 180) / 360 * MAPW, (84 - lat) / 144 * MAPH];
// Sequential ramp (violet — deliberately outside the categorical geometry trio).
const RAMP = { light: [[237, 233, 246], [74, 46, 134]], dark: [[46, 38, 64], [185, 165, 232]] };
function rampColor(t) {
  const [a, b] = RAMP[isDark() ? "dark" : "light"];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}
// map zoom/pan state — viewBox in map coordinates
const MZ = { k: 1, x: 0, y: 0 };
function mapApplyView() {
  $("worldmap").setAttribute("viewBox", `${MZ.x.toFixed(1)} ${MZ.y.toFixed(1)} ${(MAPW / MZ.k).toFixed(1)} ${(MAPH / MZ.k).toFixed(1)}`);
  // keep dot size constant on screen
  const maxPn = Math.max(...(window.PLACES || []).map(pl => pl.n), 1);
  $("worldmap").querySelectorAll("circle.place").forEach(el => {
    const pl = window.PLACES[+el.dataset.pi];
    el.setAttribute("r", ((2.2 + 3.2 * Math.sqrt(pl.n / maxPn)) / MZ.k).toFixed(2));
    el.setAttribute("stroke-width", (1.2 / MZ.k).toFixed(2));
  });
}
function mapZoom(factor, cx, cy) {
  // cx,cy = zoom center in map coords; defaults to current view center
  const w = MAPW / MZ.k, h = MAPH / MZ.k;
  cx = cx ?? MZ.x + w / 2; cy = cy ?? MZ.y + h / 2;
  const k2 = Math.min(14, Math.max(1, MZ.k * factor));
  const w2 = MAPW / k2, h2 = MAPH / k2;
  MZ.x = cx - (cx - MZ.x) * (w2 / w);
  MZ.y = cy - (cy - MZ.y) * (h2 / h);
  MZ.k = k2;
  if (MZ.k === 1) { MZ.x = 0; MZ.y = 0; }
  MZ.x = Math.max(0, Math.min(MAPW - MAPW / MZ.k, MZ.x));
  MZ.y = Math.max(0, Math.min(MAPH - MAPH / MZ.k, MZ.y));
  mapApplyView();
}
function mapPoint(e) {
  const svg = $("worldmap"), rect = svg.getBoundingClientRect();
  return [MZ.x + (e.clientX - rect.left) / rect.width * MAPW / MZ.k,
          MZ.y + (e.clientY - rect.top) / rect.height * MAPH / MZ.k];
}
let mapWired = false, mapDidPan = false;
function wireMap() {
  if (mapWired) return; mapWired = true;
  const svg = $("worldmap");
  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const [cx, cy] = mapPoint(e);
    mapZoom(e.deltaY < 0 ? 1.25 : 0.8, cx, cy);
  }, { passive: false });
  svg.addEventListener("dblclick", () => { MZ.k = 1; MZ.x = 0; MZ.y = 0; mapApplyView(); });
  let drag = null;
  svg.addEventListener("click", e => { if (mapDidPan) { e.stopPropagation(); mapDidPan = false; } }, true);
  svg.addEventListener("pointerdown", e => {
    mapDidPan = false;
    drag = { x: e.clientX, y: e.clientY, vx: MZ.x, vy: MZ.y };
    svg.classList.add("panning"); svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", e => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) mapDidPan = true;
    const rect = svg.getBoundingClientRect();
    MZ.x = drag.vx - (e.clientX - drag.x) / rect.width * MAPW / MZ.k;
    MZ.y = drag.vy - (e.clientY - drag.y) / rect.height * MAPH / MZ.k;
    MZ.x = Math.max(0, Math.min(MAPW - MAPW / MZ.k, MZ.x));
    MZ.y = Math.max(0, Math.min(MAPH - MAPH / MZ.k, MZ.y));
    mapApplyView();
  });
  const endDrag = () => { drag = null; svg.classList.remove("panning"); };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  $("zin").onclick = () => mapZoom(1.5);
  $("zout").onclick = () => mapZoom(1 / 1.5);
  $("zreset").onclick = () => { MZ.k = 1; MZ.x = 0; MZ.y = 0; mapApplyView(); };
}

function renderAtlas() {
  wireMap();
  const cc = {}; let unresolved = 0;
  P.forEach(p => { if (p.cc) cc[p.cc] = (cc[p.cc] || 0) + 1; else unresolved++; });
  const all = Object.entries(cc).sort((a, b) => b[1] - a[1]);
  const max = all.length ? all[0][1] : 1;
  // map
  const famsIn = iso => {
    const f = {}; P.filter(p => p.cc === iso).forEach(p => f[p.fam] = (f[p.fam] || 0) + 1);
    return Object.entries(f).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ");
  };
  const paths = (window.WORLD || []).map((cty, ci) => {
    const n = cc[cty.i] || 0;
    const t = n ? Math.sqrt(n / max) : 0; // sqrt scale — CN would otherwise crush Europe
    const d = cty.r.map(ring => "M" + ring.map(([lo, la]) => prj(lo, la).map(v => v.toFixed(1)).join(",")).join("L") + "Z").join("");
    const fill = n ? rampColor(0.15 + 0.85 * t) : "var(--panel2)";
    return `<path class="country${n ? " hit" : ""}" data-ci="${ci}" d="${d}" fill="${fill}"/>`;
  }).join("");
  // instrument locations — one dot per affiliation city, sized by record count
  const maxPn = Math.max(...(window.PLACES || []).map(pl => pl.n), 1);
  const dots = (window.PLACES || []).map((pl, pi) => {
    const [x, y] = prj(pl.lo, pl.la);
    const r = (2.2 + 3.2 * Math.sqrt(pl.n / maxPn)) / MZ.k;
    return `<circle class="place" data-pi="${pi}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" stroke-width="${(1.2 / MZ.k).toFixed(2)}"/>`;
  }).join("");
  $("worldmap").innerHTML = paths + dots;
  mapApplyView();
  $("worldmap").querySelectorAll("circle.place").forEach(el => {
    const pl = window.PLACES[+el.dataset.pi];
    el.addEventListener("mousemove", e => showTipAt(e,
      `<b>${esc(pl.c)}, ${esc(pl.i)} — ${pl.n} instrument${pl.n > 1 ? "s" : ""}</b>` +
      `<span class="tmono">${pl.ids.slice(0, 5).map(id => esc(byId.get(id)?.lbl || id)).join(" · ")}${pl.ids.length > 5 ? " · +" + (pl.ids.length - 5) : ""}<br>click to open</span>`));
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("click", e => {
      e.stopPropagation();
      const first = pl.ids.map(id => byId.get(id)).filter(Boolean)[0];
      if (pl.n > 1) { state.q = pl.c.toLowerCase(); $("q").value = pl.c; }
      if (first) goSelect(first, "library"); else goView("library");
      renderAll();
    });
  });
  $("worldmap").querySelectorAll("path.country").forEach(el => {
    const cty = window.WORLD[+el.dataset.ci];
    const n = cc[cty.i] || 0;
    el.addEventListener("mousemove", e => showTipAt(e,
      `<b>${esc(cty.n)}${n ? ` — ${n} instrument${n > 1 ? "s" : ""}` : ""}</b>` +
      (n ? `<span class="tmono">${esc(famsIn(cty.i))}</span>` : `<span class="tmono">no instruments in corpus</span>`)));
    el.addEventListener("mouseleave", hideTip);
    if (n) el.addEventListener("click", () => {
      state.q = ""; $("q").value = "";
      state.sel = sorted(P.filter(p => p.cc === cty.i))[0];
      switchView("library"); renderAll();
    });
  });
  $("mapLegend").innerHTML = `<span>1</span><div class="ramp" style="background:linear-gradient(90deg,${rampColor(0.15)},${rampColor(1)})"></div><span>${max}</span><span style="margin-left:12px">records per corresponding country · √ scale · ● instrument locations (affiliation cities) · scroll to zoom, drag to pan · ${unresolved} unresolved</span>`;
  // bars (kept below the map)
  $("countries").innerHTML = all.map(([k, n]) =>
    `<div class="countrybar"><span style="font-family:var(--mono);color:var(--ink2)">${esc(k)}</span><div class="cb" style="width:${(n / max * 100).toFixed(0)}%"></div><span style="text-align:right;color:var(--ink2)">${n}</span></div>`).join("");
}

// ---------------- health ----------------
function renderHealth() {
  const years = P.map(p => p.y).filter(Boolean);
  const rawStrings = new Set(P.flatMap(p => p.det));
  const incomplete = P.filter(p => p.l0 == null || p.t0 == null).length;
  const nogeom = P.filter(p => p.d == null).length;
  const mojibake = P.filter(p => p.a.some(a => /\S\?|\?\S/.test(a))).length;
  const edges = GRAPH?.links?.length ?? "—";
  const tiles = [
    { n: P.length, l: `records · ${Math.min(...years)}–${Math.max(...years)}`, cls: "good" },
    { n: edges, l: "citation edges in corpus", cls: "good" },
    { n: rawStrings.size, l: "raw detection strings to normalize", cls: "warn", go: () => goView("vocab") },
    { n: incomplete, l: "records missing λ- or T-range", cls: "warn", special: "incomplete" },
    { n: nogeom, l: "records without geometry", cls: "warn", special: "nogeom" },
    { n: mojibake, l: "author names with encoding damage", cls: mojibake ? "crit" : "good", special: "mojibake" },
  ];
  const host = $("healthTiles"); host.innerHTML = "";
  tiles.forEach(t => {
    const el = document.createElement(t.special || t.go ? "button" : "div");
    el.className = `tile ${t.cls}` + (t.special || t.go ? " click" : "");
    el.innerHTML = `<div class="n">${t.n}</div><div class="l">${esc(t.l)}</div>`;
    if (t.special) el.onclick = () => { recordNav(); state.special = t.special; switchView("library"); renderAll(); };
    else if (t.go) el.onclick = t.go;
    host.appendChild(el);
  });
  $("cntHealth").textContent = String((incomplete ? 1 : 0) + (nogeom ? 1 : 0) + (mojibake ? 1 : 0) + 1);
}

// ---------------- vocabulary ----------------
function renderVocab() {
  const collect = (field, name) => {
    const m = new Map();
    P.forEach(p => p[field].forEach(s => {
      const key = s.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (!m.has(key)) m.set(key, { name, variants: new Map() });
      const g = m.get(key);
      g.variants.set(s, (g.variants.get(s) || 0) + 1);
    }));
    return [...m.values()];
  };
  const groups = [...collect("det", "detection"), ...collect("tm", "temp-meas"), ...collect("tc", "temp-ctrl")]
    .sort((a, b) => [...b.variants.values()].reduce((x, y) => x + y, 0) - [...a.variants.values()].reduce((x, y) => x + y, 0));
  $("vocabList").innerHTML = groups.map(g => {
    const total = [...g.variants.values()].reduce((x, y) => x + y, 0);
    const vs = [...g.variants.entries()].sort((a, b) => b[1] - a[1])
      .map(([s, n], i) => `<span class="${i ? "variant" : ""}">"${esc(s)}" ×${n}</span>`).join(" · ");
    return `<div class="vocabrow"><span class="field">${g.name}</span><span class="raws">${vs}</span><span class="ct">${total}</span></div>`;
  }).join("");
  $("cntVocab").textContent = String(groups.length);
}

// ---------------- settings ----------------
const SETTING_DEFS = [
  { grp: "Appearance" },
  { key: "theme", label: "Theme", desc: "Follow macOS, or force light / dark", type: "seg", options: ["system", "light", "dark"] },
  { grp: "Units & physics" },
  { key: "tempUnit", label: "Temperature unit", desc: "Kelvin or Celsius, everywhere temperatures appear", type: "seg", options: ["K", "C"] },
  { key: "wavenumber", label: "Wavenumbers", desc: "Show spectral ranges also as cm⁻¹ (FTIR convention)", type: "bool" },
  { key: "wien", label: "Wien-peak check", desc: "Tooltips state whether the blackbody emission peak (λ = 2898 µm·K / T) falls inside the instrument's spectral band", type: "bool" },
  { grp: "Tooltips & plots" },
  { key: "verboseTips", label: "Technical tooltips", desc: "Include methods, metrology and physics in hover tooltips", type: "bool" },
  { key: "shadow", label: "Corpus-coverage shadow", desc: "Gray density strip behind fingerprint spans", type: "bool" },
  { grp: "Behavior" },
  { key: "defaultView", label: "View on launch", desc: "Which view opens when the app starts", type: "select", options: ["library", "plane", "timeline", "atlas", "health", "vocab"] },
];
function settingsChanged() {
  saveSettings(); applyTheme();
  renderAll(); renderTimeline(); renderAtlas(); renderSettings();
}
function renderSettings() {
  const host = $("settingsHost");
  host.innerHTML = `<h2>Settings</h2><div class="shint">Stored locally; applied immediately.</div>`;
  SETTING_DEFS.forEach(def => {
    if (def.grp) {
      const g = document.createElement("div"); g.className = "setgrp"; g.textContent = def.grp;
      host.appendChild(g); return;
    }
    const row = document.createElement("div"); row.className = "setrow";
    row.innerHTML = `<div><div class="sl">${esc(def.label)}</div><div class="sd">${esc(def.desc)}</div></div>`;
    let ctl;
    if (def.type === "bool") {
      ctl = document.createElement("button");
      ctl.className = "switch"; ctl.setAttribute("role", "switch");
      ctl.setAttribute("aria-checked", SETTINGS[def.key]);
      ctl.title = def.label;
      ctl.onclick = () => { SETTINGS[def.key] = !SETTINGS[def.key]; settingsChanged(); };
    } else if (def.type === "seg") {
      ctl = document.createElement("div"); ctl.className = "seg";
      def.options.forEach(o => {
        const b = document.createElement("button");
        b.textContent = o === "C" ? "°C" : o;
        b.setAttribute("aria-pressed", SETTINGS[def.key] === o);
        b.onclick = () => { SETTINGS[def.key] = o; settingsChanged(); };
        ctl.appendChild(b);
      });
    } else {
      ctl = document.createElement("select");
      def.options.forEach(o => {
        const op = document.createElement("option"); op.value = o; op.textContent = o;
        if (SETTINGS[def.key] === o) op.selected = true;
        ctl.appendChild(op);
      });
      ctl.onchange = () => { SETTINGS[def.key] = ctl.value; settingsChanged(); };
    }
    row.appendChild(ctl); host.appendChild(row);
  });
}

// ---------------- views ----------------
function switchView(v) {
  state.view = v;
  document.querySelectorAll(".navitem[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === v));
  document.querySelectorAll(".view").forEach(el => { el.hidden = el.id !== "view-" + v; });
  hideTip();
}

// ---------------- navigation history ----------------
// "Go back to the previous place" — a snapshot is (view, selected record, special filter).
const HIST = { back: [], fwd: [] };
let navLock = false;
const snap = () => ({ view: state.view, sel: state.sel ? state.sel.id : null, special: state.special });
const sameSnap = (a, b) => a.view === b.view && a.sel === b.sel && a.special === b.special;
function updateNavBtns() {
  $("navBack").disabled = !HIST.back.length;
  $("navFwd").disabled = !HIST.fwd.length;
}
// Call BEFORE mutating navigation state; clears the forward stack like a browser.
function recordNav() {
  if (navLock) return;
  const s = snap();
  const last = HIST.back[HIST.back.length - 1];
  if (last && sameSnap(last, s)) return;
  HIST.back.push(s);
  if (HIST.back.length > 200) HIST.back.shift();
  HIST.fwd.length = 0;
  updateNavBtns();
}
function restoreSnap(s) {
  navLock = true;
  if (s.sel && byId.has(s.sel)) state.sel = byId.get(s.sel);
  state.special = s.special ?? null;
  switchView(s.view);
  renderAll();
  navLock = false;
  updateNavBtns();
}
function navBack() {
  if (!HIST.back.length) return;
  HIST.fwd.push(snap());
  restoreSnap(HIST.back.pop());
}
function navFwd() {
  if (!HIST.fwd.length) return;
  HIST.back.push(snap());
  restoreSnap(HIST.fwd.pop());
}
// The two navigation verbs the whole app routes through:
function goView(v) { if (v !== state.view) recordNav(); switchView(v); }
function goSelect(p, view) {
  recordNav();
  state.sel = p;
  if (view && view !== state.view) switchView(view);
  renderAll();
}

// ---------------- command palette ----------------
let palHot = 0;
function palItems(q) {
  const views = ["library", "plane", "timeline", "atlas", "health", "vocab"]
    .filter(v => !q || v.includes(q))
    .map(v => ({ kind: "view", v, txt: `View: ${v}` }));
  const recs = q ? P.filter(p => (p.lbl + " " + p.t).toLowerCase().includes(q)).slice(0, 12)
    : sorted(P).slice(0, 12);
  return [...views.slice(0, 3), ...recs.map(p => ({ kind: "rec", p, txt: p.lbl, sub: p.t }))];
}
function renderPalette() {
  const q = $("palq").value.toLowerCase().trim();
  const items = palItems(q);
  palHot = Math.min(palHot, Math.max(items.length - 1, 0));
  $("palrows").innerHTML = items.map((it, i) =>
    `<div class="palrow${i === palHot ? " hot" : ""}" data-i="${i}"><span>${esc(it.txt)}</span>${it.sub ? `<span class="k">${esc(it.sub.slice(0, 60))}</span>` : ""}</div>`).join("");
  $("palrows").querySelectorAll(".palrow").forEach(el => el.onclick = () => { palHot = +el.dataset.i; palGo(items); });
  return items;
}
function palGo(items) {
  const it = items[palHot]; if (!it) return;
  if (it.kind === "view") goView(it.v);
  else goSelect(it.p, "library");
  $("palette").hidden = true;
}

// ---------------- render root ----------------
function renderAll() {
  renderChips(); renderList(); renderInspector(); renderPlane();
  $("cntLibrary").textContent = String(P.length);
}

// ---------------- boot ----------------
async function loadData(path) {
  const boot = $("boot");
  boot.classList.remove("err"); boot.style.display = "flex"; boot.textContent = "Loading dataset…";
  try {
    if (!invoke) throw new Error("Tauri bridge unavailable");
    const ds = await invoke("load_dataset", { path: path ?? null });
    P = ds.papers.map(compact);
    byId = new Map(P.map(p => [p.id, p]));
    GRAPH = ds.graph;
    computeDensities();
    state.sel = byId.get("10.1063/1.2393157") || P[0];
    $("dsPath").textContent = ds.bundled ? "bundled copy (read-only)" : ds.path;
    $("dsPath").title = ds.path;
    if (path) localStorage.setItem("emissary.dataset", path);
    renderAll(); renderTimeline(); renderAtlas(); renderHealth(); renderVocab(); renderSettings();
    boot.style.display = "none";
  } catch (e) {
    if (path) { // stored path went stale — fall back to the bundled copy
      localStorage.removeItem("emissary.dataset");
      return loadData(null);
    }
    boot.classList.add("err");
    boot.textContent = "Could not load dataset: " + e + " — use “Open dataset…” to pick the radiometric-emissometers-db checkout.";
  }
}

$("q").addEventListener("input", e => { state.q = e.target.value.toLowerCase(); renderList(); });
$("sortSel").addEventListener("change", e => { state.sort = e.target.value; renderList(); });
document.querySelectorAll(".navitem[data-view]").forEach(b => b.onclick = () => goView(b.dataset.view));
$("openDs").onclick = async () => {
  const dir = await T?.dialog?.open?.({ directory: true, title: "Pick the radiometric-emissometers-db folder" });
  if (dir) loadData(dir);
};
$("navBack").onclick = navBack;
$("navFwd").onclick = navFwd;
const VIEW_KEYS = ["library", "plane", "timeline", "atlas", "health", "vocab"];
window.addEventListener("keydown", e => {
  const pal = $("palette");
  if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "6") {
    e.preventDefault(); goView(VIEW_KEYS[+e.key - 1]); return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === ",") {
    e.preventDefault(); goView("settings"); return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "[") { e.preventDefault(); navBack(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key === "]") { e.preventDefault(); navFwd(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault(); pal.hidden = false; $("palq").value = ""; palHot = 0; renderPalette(); $("palq").focus();
  } else if (!pal.hidden) {
    if (e.key === "Escape") pal.hidden = true;
    else if (e.key === "ArrowDown") { e.preventDefault(); palHot++; renderPalette(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); palHot = Math.max(0, palHot - 1); renderPalette(); }
    else if (e.key === "Enter") { e.preventDefault(); palGo(renderPalette()); }
  }
});
$("palq").addEventListener("input", () => { palHot = 0; renderPalette(); });
$("palette").addEventListener("click", e => { if (e.target === $("palette")) $("palette").hidden = true; });
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => { renderAll(); renderTimeline(); renderAtlas(); });

applyTheme();
switchView(SETTINGS.defaultView);
loadData(localStorage.getItem("emissary.dataset") || null);
