// Variables used by Scriptable.
// icon-color: deep-blue; icon-glyph: water;
// EasySurf — widget Scriptable (Lombok Sud)
const DATA_URL = "https://jeanglt.github.io/surf-lombok/surf.json";
const REPORT_URL = "https://jeanglt.github.io/surf-lombok/";

const C = {
  bg1: [2, 20, 40], bg2: [7, 90, 128],
  text: "#ffffff", soft: "#e6f4ff", sub: "#bfdcec", accent: "#5eead4", wave: "#22d3ee",
  go: "#2ecc71", moyen: "#f1c40f", skip: "#e74c3c"
};
const family = config.widgetFamily || "large";

// ---------- Data ----------
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

// New format: d.picks = [{name, verdict, rating, window, swell:{m,s,dir}, wind:{dir,kt}}]
// Old format still works: d.top + d.spots + global d.swell / d.wind.
function getPicks(d) {
  if (Array.isArray(d.picks) && d.picks.length) {
    return d.picks.map(p => Object.assign({ swell: d.swell, wind: d.wind }, p));
  }
  const out = [];
  const topName = d.top && d.top.spot;
  if (d.top) out.push({ name: d.top.spot, verdict: d.top.verdict || "go", rating: d.top.rating,
    window: d.top.window, swell: d.swell, wind: d.wind });
  (d.spots || []).forEach(s => {
    if (s.name !== topName) out.push({ name: s.name, verdict: s.verdict, rating: s.rating,
      swell: d.swell, wind: d.wind });
  });
  return out;
}

// ---------- Helpers ----------
function font(weight, size) {
  const names = { heavy: "AvenirNext-Heavy", bold: "AvenirNext-Bold", demi: "AvenirNext-DemiBold" };
  try { return new Font(names[weight] || names.demi, size); }
  catch (e) { return weight === "heavy" ? Font.heavyRoundedSystemFont(size) : Font.boldRoundedSystemFont(size); }
}
function t(stack, s, size, color, weight) {
  const x = stack.addText(String(s));
  x.font = font(weight || "demi", size);
  x.textColor = new Color(color || C.text);
  x.lineLimit = 1; x.minimumScaleFactor = 0.6;
  return x;
}
function icon(stack, name, size, color) {
  try {
    const s = SFSymbol.named(name);
    if (!s) return false;
    s.applyFont(Font.systemFont(size));
    const im = stack.addImage(s.image);
    im.imageSize = new Size(size, size);
    im.tintColor = new Color(color || C.accent);
    return true;
  } catch (e) { return false; }
}
const stars = n => "★".repeat(Math.round(n || 0)) + "☆".repeat(5 - Math.round(n || 0));
const hhmm = iso => { const d = new Date(iso); return isNaN(d) ? "--:--" :
  String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const list = a => [].concat(a || []).join(" · ");

const swellTxt = s => s ? `${s.m} m · ${s.s} s${s.dir ? " · " + s.dir : ""}` : null;
const windTxt = w => w ? `${w.dir || ""} ${w.kt} nds`.trim() : null;

function nextRefresh() {
  const now = new Date(), n = new Date(now);
  if (now.getHours() < 6) n.setHours(6, 0, 0, 0);
  else if (now.getHours() < 8 || (now.getHours() === 8 && now.getMinutes() < 30))
    n.setTime(now.getTime() + 30 * 60 * 1000);
  else { n.setDate(n.getDate() + 1); n.setHours(6, 0, 0, 0); }
  return n;
}

// ---------- Background: gradient + waves ----------
function mix(a, b, k) {
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
function background(w, h) {
  const dc = new DrawContext();
  dc.size = new Size(w, h);
  dc.opaque = true;
  dc.respectScreenScale = true;
  for (let y = 0; y < h; y += 2) {
    dc.setFillColor(new Color(mix(C.bg1, C.bg2, Math.pow(y / h, 1.1))));
    dc.fillRect(new Rect(0, y, w, 3));
  }
  const wave = (base, amp, len, phase, alpha) => {
    const p = new Path();
    p.move(new Point(0, base + amp * Math.sin(phase)));
    for (let x = 4; x <= w; x += 4) p.addLine(new Point(x, base + amp * Math.sin(2 * Math.PI * x / len + phase)));
    p.addLine(new Point(w, h)); p.addLine(new Point(0, h)); p.closeSubpath();
    dc.addPath(p);
    dc.setFillColor(new Color(C.wave, alpha));
    dc.fillPath();
  };
  wave(h * 0.74, h * 0.035, w * 0.55, 0.4, 0.10);
  wave(h * 0.83, h * 0.035, w * 0.45, 2.1, 0.13);
  wave(h * 0.92, h * 0.030, w * 0.60, 4.0, 0.17);
  return dc.getImage();
}

// ---------- Blocks ----------
function dataItem(parent, symbol, text, size) {
  const s = parent.addStack(); s.centerAlignContent();
  icon(s, symbol, size + 1);
  s.addSpacer(3);
  t(s, text, size, C.soft, "demi");
}
function dataRow(w, p, size, indent) {
  const r = w.addStack(); r.centerAlignContent();
  if (indent) r.addSpacer(indent);
  const items = [["clock", p.window], ["water.waves", swellTxt(p.swell)], ["wind", windTxt(p.wind)]]
    .filter(i => i[1]);
  items.forEach((it, i) => { if (i) r.addSpacer(10); dataItem(r, it[0], it[1], size); });
  r.addSpacer();
}
function nameRow(w, p, size, withStars) {
  const r = w.addStack(); r.centerAlignContent();
  t(r, "●", size - 5, C[p.verdict] || C.sub);
  r.addSpacer(6);
  t(r, p.name, size, C.text, "heavy");
  r.addSpacer();
  if (withStars) t(r, stars(p.rating), size - 5, C.accent, "bold");
}
function headerRow(w, right) {
  const h = w.addStack(); h.centerAlignContent();
  t(h, "EasySurf", 12, C.accent, "heavy");
  h.addSpacer();
  if (right) t(h, right, 10, C.sub, "demi");
}
function titleRow(w, s) {
  w.addSpacer(4);
  t(w, s.toUpperCase(), 10, C.sub, "bold");
  w.addSpacer(4);
}
function updatedTxt(d, offline) { return (offline ? "⚠︎ hors ligne · " : "") + "mis à jour " + hhmm(d.updated); }

// ---------- Build ----------
async function build() {
  const { d, offline } = await load();
  const w = new ListWidget();
  const dims = { small: [400, 400], medium: [850, 400], large: [850, 890] }[family] || [850, 890];
  w.backgroundImage = background(dims[0], dims[1]);
  w.setPadding(12, 14, 12, 14);
  w.url = (d && d.reportUrl) || REPORT_URL;
  w.refreshAfterDate = nextRefresh();

  if (!d) {
    headerRow(w);
    w.addSpacer(8);
    t(w, "Hors ligne / données indisponibles", 12, C.moyen, "bold");
    t(w, "Nouvel essai bientôt", 11, C.sub, "demi");
    return w;
  }

  const picks = getPicks(d);
  const tide = d.tide || {};

  if (family === "small") {
    headerRow(w, "TOP PICK");
    w.addSpacer(5);
    const p = picks[0];
    if (p) {
      nameRow(w, p, 17, false);
      w.addSpacer(3);
      [["clock", p.window], ["water.waves", swellTxt(p.swell)], ["wind", windTxt(p.wind)]]
        .filter(i => i[1]).forEach(i => { dataItem(w, i[0], i[1], 10); w.addSpacer(1); });
    }
    w.addSpacer();
    t(w, "▼ " + list(tide.low), 9, C.soft, "demi");
    t(w, "▲ " + list(tide.high), 9, C.soft, "demi");
    w.addSpacer(2);
    t(w, updatedTxt(d, offline), 8, offline ? C.moyen : C.sub, "demi");
    return w;
  }

  if (family === "medium") {
    headerRow(w, d.date || "");
    titleRow(w, "Top picks");
    picks.slice(0, 2).forEach(p => {
      nameRow(w, p, 16, true);
      dataRow(w, p, 10.5, 15);
      w.addSpacer(5);
    });
    w.addSpacer();
    const f = w.addStack(); f.centerAlignContent();
    t(f, updatedTxt(d, offline), 8, offline ? C.moyen : C.sub, "demi");
    f.addSpacer();
    t(f, "▼ " + list(tide.low) + "   ▲ " + list(tide.high), 9, C.soft, "bold");
    return w;
  }

  // large
  headerRow(w, d.date || "");
  titleRow(w, "Top picks");
  picks.slice(0, 5).forEach(p => {
    nameRow(w, p, 17, true);
    dataRow(w, p, 11, 15);
    w.addSpacer(8);
  });
  w.addSpacer();
  if (d.headline) { const h = t(w, d.headline, 11, C.text, "demi"); h.lineLimit = 2; w.addSpacer(6); }
  const tr = w.addStack(); tr.centerAlignContent();
  t(tr, "▼ Basse  " + list(tide.low), 10.5, C.soft, "bold");
  tr.addSpacer();
  t(tr, "▲ Haute  " + list(tide.high), 10.5, C.soft, "bold");
  w.addSpacer(3);
  t(w, updatedTxt(d, offline), 8, offline ? C.moyen : C.sub, "demi");
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else if (config.runsInApp) await widget.presentMedium();
Script.complete();
