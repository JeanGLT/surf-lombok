// Variables used by Scriptable.
// icon-color: deep-blue; icon-glyph: water;
// Surf South Lombok — Scriptable widget (schema 2, legacy schema 1 fallback)
const DATA_URL = "https://jeanglt.github.io/surf-lombok/surf.json";
const REPORT_URL = "https://jeanglt.github.io/surf-lombok/";

const C = { bg1:"#03132b", bg2:"#0a3d62", text:"#e8f4ff", sub:"#8fb8d8", accent:"#4fd1c5",
  go:"#2ecc71", fair:"#f1c40f", moyen:"#f1c40f", skip:"#e74c3c", warn:"#f1c40f" };
const family = config.widgetFamily || "large";

async function load() {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.cacheDirectory(), "surf-lombok.json");
  try {
    const r = new Request(DATA_URL + (DATA_URL.includes("?") ? "&" : "?") + "t=" + Date.now());
    r.timeoutInterval = 15;
    const d = await r.loadJSON();
    if (!d || !(d.picks || d.top)) throw new Error("format");
    fm.writeString(cache, JSON.stringify(d));
    return { d, offline: false };
  } catch (e) {
    if (fm.fileExists(cache)) return { d: JSON.parse(fm.readString(cache)), offline: true };
    return { d: null, offline: true };
  }
}

function t(stack, s, size, color, bold) {
  const x = stack.addText(String(s));
  x.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  x.textColor = new Color(color || C.text);
  x.lineLimit = 1; x.minimumScaleFactor = 0.6;
  return x;
}
const stars = n => { const k = Math.max(0, Math.min(5, Math.round(n || 0))); return "★".repeat(k) + "☆".repeat(5 - k); };
const hhmm = iso => { const d = new Date(iso); return isNaN(d) ? "--:--" :
  String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); };
const sw = s => s ? `${s.m} m · ${s.s} s${s.dir ? " · " + s.dir : ""}` : "";
const wd = w => w ? `${w.dir} ${w.kt} kt` : "";

// Data runs at 06:00, 10:00, 14:00 -> ask for a refresh shortly after the next one.
function nextRefresh() {
  const now = new Date();
  for (const [h, m] of [[6,5],[10,5],[14,5]]) {
    const n = new Date(now); n.setHours(h, m, 0, 0);
    if (n > now) return n;
  }
  const n = new Date(now); n.setDate(n.getDate() + 1); n.setHours(6, 5, 0, 0);
  return n;
}

// Normalize schema 2 / legacy schema 1
function picksOf(d) {
  if (Array.isArray(d.picks) && d.picks.length) return d.picks;
  const sp = (d.spots || []).map(s => ({ name: s.name, rating: s.rating, verdict: s.verdict }));
  if (d.top) {
    const i = sp.findIndex(s => s.name === d.top.spot);
    const top = { name: d.top.spot, rating: d.top.rating, window: d.top.window,
      verdict: i >= 0 ? sp[i].verdict : "go", swell: d.swell, wind: d.wind };
    if (i >= 0) sp.splice(i, 1);
    sp.unshift(top);
  }
  return sp;
}

function pickRow(w, p, size, full) {
  const r = w.addStack(); r.centerAlignContent();
  t(r, "●", size, C[p.verdict] || C.sub);
  r.addSpacer(4);
  t(r, p.name, size, C.text, true);
  if (p.window) { r.addSpacer(4); t(r, p.window, size - 2, C.sub); }
  if (full && p.scooter != null) { r.addSpacer(4); t(r, "🛵" + p.scooter + "′", size - 2, C.sub); }
  r.addSpacer(4);
  t(r, stars(p.rating), size - 2, C.accent);
  r.addSpacer();
}

async function build() {
  const { d, offline } = await load();
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [new Color(C.bg1), new Color(C.bg2)]; g.locations = [0, 1];
  w.backgroundGradient = g;
  w.setPadding(12, 12, 12, 12);
  w.url = (d && d.reportUrl) || REPORT_URL;
  w.refreshAfterDate = nextRefresh();

  if (!d) {
    t(w, "🌊 Surf Lombok", 14, C.accent, true);
    w.addSpacer(6);
    t(w, "Offline / no data", 12, C.warn);
    t(w, "Retrying soon", 11, C.sub);
    return w;
  }
  const picks = picksOf(d);
  const top = picks[0] || {};
  const head = w.addStack(); head.centerAlignContent();
  t(head, "🌊 " + (family === "small" ? "Lombok" : "Surf South Lombok"), 12, C.accent, true);
  head.addSpacer();
  if (family !== "small") t(head, d.date || "", 10, C.sub);
  w.addSpacer(4);

  if (family === "small") {
    t(w, top.name || "—", 16, C[top.verdict] ? C.text : C.text, true);
    t(w, "⏱ " + (top.window || "—"), 11, C.accent);
    t(w, stars(top.rating), 11, C.accent);
    t(w, "〰 " + sw(top.swell || d.swell), 11, C.text);
  } else if (family === "medium") {
    t(w, "〰 " + sw(top.swell || d.swell) + "   💨 " + wd(top.wind || d.wind), 11, C.text);
    w.addSpacer(4);
    picks.slice(0, 3).forEach(p => pickRow(w, p, 12, false));
  } else {
    t(w, "〰 " + sw(top.swell || d.swell) + "   💨 " + wd(top.wind || d.wind), 11, C.text);
    w.addSpacer(4);
    picks.forEach(p => pickRow(w, p, 12, true));
    if (Array.isArray(d.skip) && d.skip.length) {
      w.addSpacer(2);
      const s = t(w, "✕ Skip: " + d.skip.map(x => x.name).join(", "), 10, C.skip); s.lineLimit = 2;
    }
    w.addSpacer(4);
    const parts = [];
    if (d.tide) {
      parts.push("🔻 " + [].concat(d.tide.low || []).join(", "));
      parts.push("🔺 " + [].concat(d.tide.high || []).join(", "));
    }
    if (d.water != null) parts.push("🌡 " + d.water + "°C");
    if (parts.length) t(w, parts.join("   "), 10, C.sub);
    if (d.tomorrow) {
      const tm = d.tomorrow;
      const x = t(w, "Tomorrow: " + [tm.best, sw(tm.swell), wd(tm.wind), tm.outlook].filter(Boolean).join(" · "), 10, C.text);
      x.lineLimit = 2;
    }
    if (d.headline) { w.addSpacer(3); const h = t(w, d.headline, 10, C.sub); h.lineLimit = 2; }
  }
  w.addSpacer();
  t(w, (offline ? "⚠︎ offline · " : "") + "updated " + hhmm(d.updated), 9, offline ? C.warn : C.sub);
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else if (config.runsInApp) await widget.presentLarge();
Script.complete();
