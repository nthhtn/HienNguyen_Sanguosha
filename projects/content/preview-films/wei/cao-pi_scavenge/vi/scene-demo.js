// Scavenge (Cao Pi, Wei): another seat is eliminated, and he takes all of its cards. The text of scene-demo.js.
// Seat 2's cards (one hand card and a weapon), HP and Cao Pi's hand of 2 are made up and are listed as such in the hand-over.
const { seg, eo, eio, lerp } = kit;
const T = {"owner": "Tào Phi", "other": "Người chơi 2", "hp": "Sinh lực", "skill": "Hành thương", "hand": "Bài trên tay", "weapon": "Vũ khí", "c1": "Người chơi 2 trận vong", "c2": "Hành thương: Tào Phi lấy hết bài của Người chơi 2", "whoSize": 56};
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

const H_FROM = { x: 1548, y: 461 }, W_FROM = { x: 1618, y: 461 }, SLOT2 = { x: 448, y: 631 }, SLOT3 = { x: 560, y: 631 };
kit.scene('demo', {
  init(kit) {
    kit.stage.append(kit.h('<div class="ground">' +
      OWNER({ pips: PIPS(3, [], 'p'), hand: 2, backs: OWN_BACKS(2) }) +
      OTHER({ pips: PIPS(3, [1, 2], 'o'), hand: true }) +
      '<svg style="position:absolute;left:0;top:0" width="1920" height="1080"><path class="demo-x1" pathLength="1" d="M1230 322 L1730 538" style="fill:none;stroke:var(--second);stroke-width:10;stroke-linecap:round;stroke-dasharray:1 1;stroke-dashoffset:1"/>' +
      '<path class="demo-x2" pathLength="1" d="M1730 322 L1230 538" style="fill:none;stroke:var(--second);stroke-width:10;stroke-linecap:round;stroke-dasharray:1 1;stroke-dashoffset:1"/></svg>' +
      '<div class="sha bk demo-hc"></div>' + WEAPON('demo-wc') + CAPS(2) + '</div>'));
    this.lit = grab(kit, '.demo-lit').style; this.h1 = grab(kit, '.demo-h1'); this.h2 = grab(kit, '.demo-h2'); this.s2 = grab(kit, '.demo-s2').style;
    this.pip = grab(kit, '.demo-o0').style; this.hc = grab(kit, '.demo-hc').style; this.wc = grab(kit, '.demo-wc').style;
    this.x1 = grab(kit, '.demo-x1').style; this.x2 = grab(kit, '.demo-x2').style; this.cap = grabCaps(kit, 2);
  },
  render(t) {
    this.pip.opacity = 1 - eo(seg(t, 0.3, 0.5));                      // beat 1: Seat 2 is eliminated
    this.s2.opacity = 1 - 0.55 * eo(seg(t, 0.5, 1.0));
    this.x1.strokeDashoffset = 1 - eo(seg(t, 0.6, 0.95)); this.x2.strokeDashoffset = 1 - eo(seg(t, 0.8, 1.15));
    this.lit.opacity = eo(seg(t, 1.8, 2.2));                          // beat 2: the skill lights, its cards come across
    const a = eio(seg(t, 2.4, 3.4)), b = eio(seg(t, 2.7, 3.7)), fa = flight(H_FROM, SLOT2, a), fb = flight(W_FROM, SLOT3, b);
    place(this.hc, fa.x, fa.y, 0.74, lerp(0, -5, a)); place(this.wc, fb.x, fb.y, 0.74, lerp(0, 5, b));
    this.h2.textContent = T.hand + (t < 2.4 ? ' 1' : ' 0');
    this.h1.textContent = T.hand + (t < 3.4 ? ' 2' : t < 3.7 ? ' 3' : ' 4');
    showCaps(this.cap, t, [[0.0, 0.4, 1.5, 1.8], [1.8, 2.2, 99, 100]]);
  },
});
