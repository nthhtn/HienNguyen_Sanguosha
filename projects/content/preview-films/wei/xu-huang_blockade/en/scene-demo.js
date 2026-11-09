// Blockade (Xu Huang, Wei): a black card in his hand is used as Starvation, and he can put it on a player at distance 2.
// The text of scene-demo.js. The ♠ 4, Seat 3 at distance 2 and the hand are made up and are listed as such in the hand-over.
const { seg, eo, eio, lerp } = kit;
const T = {"owner": "Xu Huang", "other": "Seat 3", "hp": "HP", "skill": "Blockade", "hand": "Hand", "judgment": "Judgment", "distance": "Distance 2", "starvation": "Starvation", "c1": "Xu Huang uses a black card as Starvation", "c2": "The card goes to a player at distance 2", "c3": "Starvation waits in the Judgment Area", "whoSize": 64};
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

const SLOT2 = { x: 448, y: 631 }, TRAYPT = { x: 1548, y: 461 };
kit.scene('demo', {
  init(kit) {
    kit.stage.append(kit.h('<div class="ground">' +
      OWNER({ pips: PIPS(4, [], 'p'), hand: 3, backs: OWN_BACKS(2) }) +
      OTHER({ pips: PIPS(4, [], 'o'), backs: '<div class="tray" style="left:300px;top:96px"></div><p class="lbl" style="left:300px;top:232px">' + T.judgment + '</p>' }) +
      '<div class="chip demo-dist" style="left:1200px;top:580px">' + T.distance + '</div>' +
      CARD('demo-bf', '♠', '4', false) + '<div class="sha demo-sf"><b style="font-size:60px">♠</b><span style="font-size:22px;line-height:1.05;text-align:center;padding:0 6px">' + T.starvation + '</span></div>' + CAPS(3) + '</div>'));
    this.lit = grab(kit, '.demo-lit').style; this.h1 = grab(kit, '.demo-h1'); this.dist = grab(kit, '.demo-dist').style; this.bf = grab(kit, '.demo-bf').style; this.sf = grab(kit, '.demo-sf').style; this.cap = grabCaps(kit, 3);
  },
  render(t) {
    this.lit.opacity = eo(seg(t, 0.4, 0.8));                          // beat 1: the black card becomes Starvation
    const f = seg(t, 1.0, 1.6), sx = Math.abs(1 - 2 * f);
    this.bf.opacity = f < 0.5 ? 1 : 0; this.sf.opacity = f < 0.5 ? 0 : 1;
    const p = eio(seg(t, 2.8, 3.8)), q = flight(SLOT2, TRAYPT, p, 80);  // beat 2: it goes to a player at distance 2
    place(this.bf, q.x, q.y, 0.74, lerp(0, -4, p), sx); place(this.sf, q.x, q.y, 0.74, lerp(0, -4, p), sx);
    this.dist.opacity = eo(seg(t, 3.6, 4.0));
    this.h1.textContent = T.hand + (t < 2.8 ? ' 3' : ' 2');
    showCaps(this.cap, t, [[0.0, 0.4, 2.2, 2.5], [2.4, 2.8, 4.4, 4.7], [4.6, 5.0, 99, 100]]);   // beat 3: it waits in the Judgment Area
  },
});
