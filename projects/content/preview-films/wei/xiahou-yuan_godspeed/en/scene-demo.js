// Godspeed (Xiahou Yuan, Wei): he skips his Judgment and Draw Phases and counts as using a Sha on a seat at any distance, then skips
// his Play Phase, discards an Equipment card and counts as using a Sha again. The text of scene-demo.js. The weapon and the two seats are made up.
const { seg, eo, eio, lerp } = kit;
const T = {"owner": "Xiahou Yuan", "other": "Seat 2", "other3": "Seat 3", "hp": "HP", "skill": "Godspeed", "discard": "Discard Pile", "weapon": "Weapon", "sha": "Sha", "judgmentPhase": "Judgment Phase", "drawPhase": "Draw Phase", "playPhase": "Play Phase", "c1": "Start of turn: Xiahou Yuan skips two phases", "c2": "It counts as a Sha on Seat 2, at any distance", "c3": "Play Phase: discard Equipment to skip it", "c4": "Another Sha, this time on Seat 3", "whoSize": 64};
const place = (st, x, y, s, r, sx) => { st.transform = 'translate(' + (x - 65) + 'px,' + (y - 91) + 'px) rotate(' + r + 'deg) scale(' + s * (sx === undefined ? 1 : sx) + ',' + s + ')'; };
const CARD = (cls, glyph, rank, red) => '<div class="sha ' + cls + '"><b' + (red ? ' class="red"' : '') + ' style="font-size:96px">' + glyph + '</b><span>' + rank + '</span></div>';
const WEAPON = (cls) => '<div class="sha ' + cls + '"><span style="font-size:26px">' + T.weapon + '</span></div>';
// n pips, those listed in `lost` already empty; each inner dot has a class so a scene can empty one later.
const PIPS = (n, lost, tag) => { let h = ''; for (let i = 0; i < n; i++) h += '<span class="pip"><i class="demo-' + tag + i + '"' + (lost.indexOf(i) >= 0 ? ' style="opacity:0"' : '') + '></i></span>'; return h; };
const OWN_BACKS = (n) => { let h = ''; for (let i = 0; i < n; i++) h += '<div class="cback" style="left:' + (36 + i * 112) + 'px;top:346px"></div>'; return h; };
const THEIR_BACKS = (n, step) => { let h = ''; for (let i = 0; i < n; i++) h += '<div class="cback" style="left:' + (300 + i * step) + 'px;top:96px"></div>'; return h; };
const OWNER = (o) => '<div class="seat demo-s1" style="left:140px;top:220px;width:560px;height:' + (o.hand === undefined ? 340 : 500) + 'px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + T.owner + '</p>' +
  '<p class="lbl" style="left:36px;top:124px">' + T.hp + '</p><div class="pips" style="left:36px;top:164px">' + o.pips + '</div>' +
  '<div class="chip" style="left:36px;top:236px">' + T.skill + '</div><div class="chip lit demo-lit" style="left:36px;top:236px">' + T.skill + '</div>' +
  (o.hand === undefined ? '' : '<p class="lbl demo-h1" style="left:36px;top:306px"></p>' + o.backs) + '</div>';
const OTHER = (o) => '<div class="seat demo-s2" style="left:1200px;top:300px;width:560px;height:260px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + T.other + '</p>' +
  '<p class="lbl" style="left:36px;top:124px">' + T.hp + '</p><div class="pips" style="left:36px;top:164px">' + o.pips + '</div>' +
  (o.hand ? '<p class="lbl demo-h2" style="left:36px;top:216px"></p>' : '') + (o.backs || '') + '</div>';
const ZONE = (label) => '<div class="zone" style="left:780px;top:470px;width:360px;height:240px"><p>' + label + '</p></div>';
const DMG = (left, top) => '<p class="demo-dmg" style="position:absolute;margin:0;left:' + left + 'px;top:' + top + 'px;font-family:var(--display);font-size:84px;font-weight:700;color:var(--accent)">-1</p>';
const ARROW_STYLE = 'fill:none;stroke:var(--accent);stroke-width:8;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1 1;stroke-dashoffset:1';
const ARROW = (shaft, head) => '<svg style="position:absolute;left:0;top:0" width="1920" height="1080"><path class="demo-sh" pathLength="1" d="' + shaft + '" style="' + ARROW_STYLE + '"/><path class="demo-hd" pathLength="1" d="' + head + '" style="' + ARROW_STYLE + '"/></svg>';
const TO_OWNER = ARROW('M1190 430 L730 430', 'M758 404 L712 430 L758 456');     // from Seat 2 to the owner
const TO_OTHER = ARROW('M712 430 L1170 430', 'M1142 404 L1188 430 L1142 456');   // from the owner to Seat 2
const CAPS = (n) => { let h = ''; for (let i = 1; i <= n; i++) h += '<p class="cap demo-c' + i + '">' + T['c' + i] + '</p>'; return h; };
const grab = (kit, sel) => kit.stage.querySelector(sel);
const grabCaps = (kit, n) => Array.from({ length: n }, (_, i) => grab(kit, '.demo-c' + (i + 1)).style);
const shake = (t, t0) => (t > t0 ? Math.sin((t - t0) * 55) * 14 * (1 - seg(t, t0, t0 + 0.6)) : 0);
const popAt = (st, t, t0) => { st.opacity = eo(seg(t, t0, t0 + 0.2)) * (1 - eio(seg(t, t0 + 0.9, t0 + 1.3))); st.transform = 'translateY(' + lerp(0, -50, eo(seg(t, t0, t0 + 1.2))) + 'px)'; };
const flight = (a, b, p, lift) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) - Math.sin(Math.PI * p) * (lift === undefined ? 90 : lift) });
const showCaps = (caps, t, win) => win.forEach((w, i) => { const a = eo(seg(t, w[0], w[1])); caps[i].opacity = a * (1 - eio(seg(t, w[2], w[3]))); caps[i].transform = 'translateY(' + lerp(18, 0, a) + 'px)'; });
const drawArrow = (sh, hd, t, a, fadeAt) => { sh.strokeDashoffset = 1 - eo(seg(t, a, a + 0.4)); hd.strokeDashoffset = 1 - eo(seg(t, a + 0.35, a + 0.55)); const o = 1 - eio(seg(t, fadeAt, fadeAt + 0.4)); sh.opacity = o; hd.opacity = o; };

const NAMED = (cls, glyph, name, size) => '<div class="sha ' + cls + '"><b style="font-size:60px">' + glyph + '</b><span style="font-size:' + (size || 36) + 'px;line-height:1.05;text-align:center;padding:0 6px">' + name + '</span></div>';
const OTHER_AT = (o) => '<div class="seat demo-s' + o.n + '" style="left:1200px;top:' + o.top + 'px;width:560px;height:' + (o.height || 260) + 'px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + o.name + '</p>' +
  '<p class="lbl" style="left:36px;top:124px">' + T.hp + '</p><div class="pips" style="left:36px;top:164px">' + o.pips + '</div>' +
  (o.hand ? '<p class="lbl demo-h' + o.n + '" style="left:36px;top:216px"></p>' : '') + (o.backs || '') + '</div>';
const TAG = (cls, left, top, text) => '<div class="chip demo-' + cls + '" style="left:' + left + 'px;top:' + top + 'px">' + text + '</div>';
const DMGT = (left, top, text) => '<p class="demo-dmg" style="position:absolute;margin:0;left:' + left + 'px;top:' + top + 'px;font-family:var(--display);font-size:84px;font-weight:700;color:var(--accent)">' + text + '</p>';
const TRAY = '<div class="tray" style="left:300px;top:96px"></div>';

const OUT = { x: 700, y: 430 }, S2 = { x: 1480, y: 260 }, S3 = { x: 1480, y: 590 }, W0 = { x: 590, y: 450 }, W1 = { x: 960, y: 604 };
kit.scene('demo', {
  init(kit) {
    kit.stage.append(kit.h('<div class="ground">' +
      OWNER({ pips: PIPS(4, [], 'p') }) +
      OTHER_AT({ n: 2, top: 110, height: 300, name: T.other, pips: PIPS(4, [], 'o') }) +
      OTHER_AT({ n: 3, top: 440, height: 300, name: T.other3, pips: PIPS(4, [], 'q') }) + ZONE(T.discard) +
      TAG('t1', 140, 150, T.judgmentPhase) + TAG('t2', 500, 150, T.drawPhase) + TAG('t3', 140, 150, T.playPhase) +
      WEAPON('demo-w') + NAMED('demo-a', '', T.sha, 44) + NAMED('demo-b', '', T.sha, 44) + CAPS(4) + '</div>'));
    this.lit = grab(kit, '.demo-lit').style; this.t1 = grab(kit, '.demo-t1').style; this.t2 = grab(kit, '.demo-t2').style; this.t3 = grab(kit, '.demo-t3').style;
    this.w = grab(kit, '.demo-w').style; this.a = grab(kit, '.demo-a').style; this.b = grab(kit, '.demo-b').style; this.cap = grabCaps(kit, 4);
  },
  render(t) {
    this.lit.opacity = eo(seg(t, 0.3, 0.7));                          // beat 1: two phases skipped
    const tg = eo(seg(t, 0.3, 0.6)) * (1 - eio(seg(t, 4.3, 4.7)));
    this.t1.opacity = tg; this.t2.opacity = tg; this.t1.textDecoration = this.t2.textDecoration = t >= 1.8 ? 'line-through' : 'none';
    const a = eio(seg(t, 2.6, 3.6)), fa = flight(OUT, S2, a, 70);     // beat 2: a Sha at any distance
    place(this.a, fa.x, fa.y, 0.74, lerp(0, 6, a)); this.a.opacity = t < 2.6 ? 0 : 1 - eio(seg(t, 3.9, 4.3));
    this.t3.opacity = eo(seg(t, 4.9, 5.2)); this.t3.textDecoration = t >= 6.3 ? 'line-through' : 'none';   // beat 3: Play Phase skipped, Equipment discarded
    const w = eio(seg(t, 5.3, 6.2)), fw = flight(W0, W1, w, 60);
    place(this.w, fw.x, fw.y, 0.74, lerp(0, -5, w));
    const b = eio(seg(t, 7.3, 8.3)), fb = flight(OUT, S3, b, 70);     // beat 4: a second Sha
    place(this.b, fb.x, fb.y, 0.74, lerp(0, -6, b)); this.b.opacity = t < 7.3 ? 0 : 1;
    showCaps(this.cap, t, [[0.0, 0.4, 2.2, 2.5], [2.4, 2.8, 4.6, 4.9], [4.8, 5.2, 6.9, 7.2], [7.2, 7.6, 99, 100]]);
  },
});
