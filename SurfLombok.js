// Variables used by Scriptable.
// icon-color: deep-blue; icon-glyph: water;
// Surf Lombok Sud — widget Scriptable
const DATA_URL = "https://jeanglt.github.io/surf-lombok/surf.json"; // <- à configurer
const REPORT_URL = "https://jeanglt.github.io/surf-lombok/";        // <- ouvert au tap

const C = { bg1:"#03132b", bg2:"#0a3d62", text:"#e8f4ff", sub:"#8fb8d8", accent:"#4fd1c5",
  go:"#2ecc71", moyen:"#f1c40f", skip:"#e74c3c" };
const family = config.widgetFamily || "large";

async function load() {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.cacheDirectory(), "surf-lombok.json");
  try {
    const r = new Request(DATA_URL + (DATA_URL.includes("?") ? "&" : "?") + "t=" + Date.now());
    r.timeoutInterval = 15;
    const d = await r.loadJSON();
    if (!d || !d.top) throw new Error("format");
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
const stars = n => "★".repeat(Math.round(n||0)) + "☆".repeat(5 - Math.round(n||0));
const hhmm = iso => { const d = new Date(iso); return isNaN(d) ? "--:--" :
  String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); };

function nextRefresh() {
  const now = new Date(), n = new Date(now);
  if (now.getHours() < 6) n.setHours(6, 0, 0, 0);
  else if (now.getHours() < 8 || (now.getHours() === 8 && now.getMinutes() < 30))
    n.setTime(now.getTime() + 30 * 60 * 1000);      // fenêtre 6:00–8:30 : toutes les 30 min
  else { n.setDate(n.getDate() + 1); n.setHours(6, 0, 0, 0); }
  return n;
}

function spotRow(w, s, size, withNote) {
  const r = w.addStack(); r.centerAlignContent();
  t(r, "●", size, C[s.verdict] || C.sub);
  r.addSpacer(4);
  t(r, s.name, size, C.text, true);
  r.addSpacer(4);
  t(r, stars(s.rating), size - 2, C.accent);
  if (withNote && s.note) { r.addSpacer(6); t(r, s.note, size - 2, C.sub); }
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
    t(w, "Hors ligne / données indisponibles", 12, C.moyen);
    t(w, "Nouvel essai bientôt", 11, C.sub);
    return w;
  }
  const head = w.addStack(); head.centerAlignContent();
  t(head, "🌊 " + (family === "small" ? "Lombok" : "Surf Lombok Sud"), 12, C.accent, true);
  head.addSpacer();
  if (family !== "small") t(head, d.date || "", 10, C.sub);
  w.addSpacer(4);

  t(w, d.top.spot, family === "small" ? 16 : 18, C.text, true);
  t(w, "⏱ " + d.top.window + "  " + stars(d.top.rating), 11, C.accent);
  t(w, `〰 ${d.swell.m} m · ${d.swell.s} s · ${d.swell.dir || ""}`, 12, C.text);
  if (family !== "small") {
    t(w, `💨 ${d.wind.dir} ${d.wind.kt} nds`, 12, C.text);
    w.addSpacer(4);
    (d.spots || []).slice(0, family === "medium" ? 3 : 8)
      .forEach(s => spotRow(w, s, family === "medium" ? 11 : 12, family === "large"));
  }
  if (family === "large") {
    w.addSpacer(4);
    if (d.tide) {
      t(w, "🔻 Basse : " + [].concat(d.tide.low || []).join(", "), 11, C.sub);
      t(w, "🔺 Haute : " + [].concat(d.tide.high || []).join(", "), 11, C.sub);
    }
    if (d.headline) { w.addSpacer(4); const h = t(w, d.headline, 11, C.text); h.lineLimit = 2; }
  }
  w.addSpacer();
  t(w, (offline ? "⚠︎ hors ligne · " : "") + "mis à jour " + hhmm(d.updated), 9, offline ? C.moyen : C.sub);
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else if (config.runsInApp) await widget.presentLarge();
Script.complete();
