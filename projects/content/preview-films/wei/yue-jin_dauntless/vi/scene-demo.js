// Dauntless (Yue Jin, Wei): at the end of another seat's turn he discards a Basic card, and that seat discards an Equipment card or takes
// 1 damage from him. This film shows the discard. The text of scene-demo.js. The Sha, the weapon and the hands are made up.
const { seg, eo, eio, lerp } = kit;
const T = {"owner": "Nhạc Tiến", "other": "Người chơi 2", "hp": "Sinh lực", "skill": "Kiêu quả", "hand": "Bài trên tay", "discard": "Chồng bài bỏ", "weapon": "Vũ khí", "sha": "Sát", "endPhase": "Giai đoạn kết thúc", "optA": "Bỏ trang bị", "optB": "Chịu 1 sát thương", "c1": "Giai đoạn kết thúc lượt của người khác", "c2": "Nhạc Tiến bỏ một lá bài cơ bản", "c3": "Người chơi 2 bỏ trang bị hoặc chịu 1 sát thương", "c4": "Người chơi 2 bỏ vũ khí: không chịu sát thương", "whoSize": 56};
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

const SLOT2 = { x: 448, y: 631 }, GONE = { x: 960, y: 604 }, W0 = { x: 1650, y: 430 }, W1 = { x: 1040, y: 604 };
kit.scene('demo', {
  init(kit) {
    kit.stage.append(kit.h('<div class="ground">' +
      OWNER({ pips: PIPS(4, [], 'p'), hand: 3, backs: OWN_BACKS(2) }) + OTHER({ pips: PIPS(4, [], 'o') }) + ZONE(T.discard) +
      TAG('end', 1200, 236, T.endPhase) + WEAPON('demo-w') +
      '<div class="sha bk demo-bb"></div>' + NAMED('demo-bf', '♣', T.sha, 40) +
      '<div class="chip demo-oa" style="left:1200px;top:604px">' + T.optA + '</div><div class="chip lit demo-oal" style="left:1200px;top:604px">' + T.optA + '</div>' +
      '<div class="chip demo-ob" style="left:1200px;top:664px">' + T.optB + '</div>' + CAPS(4) + '</div>'));
    this.lit = grab(kit, '.demo-lit').style; this.h1 = grab(kit, '.demo-h1'); this.end = grab(kit, '.demo-end').style; this.w = grab(kit, '.demo-w').style;
    this.bb = grab(kit, '.demo-bb').style; this.bf = grab(kit, '.demo-bf').style;
    this.oa = grab(kit, '.demo-oa').style; this.oal = grab(kit, '.demo-oal').style; this.ob = grab(kit, '.demo-ob').style; this.cap = grabCaps(kit, 4);
  },
  render(t) {
    this.end.opacity = eo(seg(t, 0.3, 0.6));                          // beat 1: the End Phase of another seat
    place(this.w, t < 5.8 ? W0.x : lerp(W0.x, W1.x, eio(seg(t, 5.8, 6.7))), t < 5.8 ? W0.y : flight(W0, W1, eio(seg(t, 5.8, 6.7)), 60).y, 0.74, lerp(0, 4, eio(seg(t, 5.8, 6.7))));
    this.lit.opacity = eo(seg(t, 1.8, 2.2));                          // beat 2: he discards a Basic card
    const f = seg(t, 2.0, 2.5), sx = Math.abs(1 - 2 * f), g = eio(seg(t, 2.8, 3.7)), p = flight(SLOT2, GONE, g, 60);
    place(this.bb, p.x, p.y, 0.74, lerp(0, -4, g), sx); place(this.bf, p.x, p.y, 0.74, lerp(0, -4, g), sx);
    this.bb.opacity = f < 0.5 ? 1 : 0; this.bf.opacity = f >= 0.5 ? 1 : 0;
    this.h1.textContent = T.hand + (t < 2.8 ? ' 3' : ' 2');
    const oc = eo(seg(t, 4.0, 4.4)), pick = eo(seg(t, 5.4, 5.8));     // beat 3: Seat 2 chooses; beat 4: it discards the weapon
    this.oa.opacity = oc; this.oal.opacity = pick; this.ob.opacity = oc * lerp(1, 0.3, pick);
    showCaps(this.cap, t, [[0.0, 0.4, 1.6, 1.9], [1.8, 2.2, 3.8, 4.1], [4.0, 4.4, 5.3, 5.6], [5.4, 5.8, 99, 100]]);
  },
});
