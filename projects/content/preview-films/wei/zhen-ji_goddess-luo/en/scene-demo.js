// Goddess Luo (Zhen Ji, Wei), Kingdom Wars: at the start of her turn she judges; on black she judges again, until a red card, which is discarded;
// the black cards wait aside until then and she takes them all. The text of scene-demo.js. The three cards (♠ 3, ♣ 9, ♥ 2) and the hand of 2 are made up.
const { seg, eo, eio, lerp } = kit;
const T = {"owner": "Zhen Ji", "hp": "HP", "skill": "Goddess Luo", "hand": "Hand", "discard": "Discard Pile", "judgment": "Judgment", "aside": "Set Aside", "c1": "Start of turn: Zhen Ji judges", "c2": "Black: she judges again, and again", "c3": "A red card ends it and is discarded", "c4": "She takes all the black cards", "whoSize": 64};
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

const JUDGE = { x: 1480, y: 180 }, A1 = { x: 1400, y: 600 }, A2 = { x: 1540, y: 600 }, RED = { x: 960, y: 604 }, S2 = { x: 448, y: 631 }, S3 = { x: 560, y: 631 };
const JS = [
  { g: '♠', r: '3', red: false, tin: 0.5, tf: 0.9, ts: 1.7, te: 2.4, dest: A1, rot: -4 },
  { g: '♣', r: '9', red: false, tin: 2.0, tf: 2.5, ts: 3.3, te: 4.0, dest: A2, rot: 4 },
  { g: '♥', r: '2', red: true, tin: 3.6, tf: 4.1, ts: 5.0, te: 5.7, dest: RED, rot: -3 },
];
kit.scene('demo', {
  init(kit) {
    let cards = '';
    JS.forEach((j, i) => { cards += '<div class="sha bk demo-jb' + i + '"></div>' + CARD('demo-jf' + i, j.g, j.r, j.red); });
    kit.stage.append(kit.h('<div class="ground">' +
      OWNER({ pips: PIPS(3, [], 'p'), hand: 2, backs: OWN_BACKS(2) }) + ZONE(T.discard) +
      '<div class="zone" style="left:1300px;top:470px;width:400px;height:240px"><p>' + T.aside + '</p></div>' +
      '<p class="lbl" style="position:absolute;margin:0;left:1380px;top:34px;width:200px;text-align:center">' + T.judgment + '</p>' + cards + CAPS(4) + '</div>'));
    this.lit = grab(kit, '.demo-lit').style; this.h1 = grab(kit, '.demo-h1');
    this.b = JS.map((_, i) => grab(kit, '.demo-jb' + i).style); this.f = JS.map((_, i) => grab(kit, '.demo-jf' + i).style); this.cap = grabCaps(kit, 4);
  },
  render(t) {
    this.lit.opacity = eo(seg(t, 0.3, 0.7));                          // beat 1: the first judgment
    JS.forEach((j, i) => {
      const inn = eo(seg(t, j.tin, j.tin + 0.3)), fl = seg(t, j.tf, j.tf + 0.4), sx = Math.abs(1 - 2 * fl), s = eio(seg(t, j.ts, j.te));
      const p = flight(JUDGE, j.dest, s, 40);
      place(this.b[i], JUDGE.x, JUDGE.y, 0.9, 0, sx); this.b[i].opacity = fl < 0.5 ? inn : 0;
      place(this.f[i], p.x, p.y, lerp(0.9, 0.74, s), lerp(0, j.rot, s), sx); this.f[i].opacity = fl >= 0.5 ? 1 : 0;
    });
    const e1 = eio(seg(t, 6.2, 7.0)), e2 = eio(seg(t, 6.4, 7.2));     // beat 4: both black cards go to her hand
    if (t >= 6.2) {
      const p1 = flight(A1, S2, e1, 70), p2 = flight(A2, S3, e2, 70);
      place(this.f[0], p1.x, p1.y, 0.74, lerp(-4, -5, e1)); place(this.f[1], p2.x, p2.y, 0.74, lerp(4, 5, e2));
    }
    this.h1.textContent = T.hand + (t < 7.0 ? ' 2' : t < 7.2 ? ' 3' : ' 4');
    showCaps(this.cap, t, [[0.0, 0.4, 1.5, 1.8], [1.6, 2.0, 3.9, 4.2], [4.0, 4.4, 5.9, 6.2], [6.0, 6.4, 99, 100]]);
  },
});
