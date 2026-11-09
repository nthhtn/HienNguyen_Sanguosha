// Rouse the Tiger (Xun Yu, Wei): he competes with a seat that has more HP; if he wins, that seat deals 1 damage to a seat within its range
// that he picks. The text of scene-demo.js. The two cards (♠ 9 against ♥ 5), the HP and the seat picked are made up.
const { seg, eo, eio, lerp } = kit;
const T = {"owner": "Tuân Úc", "other": "Người chơi 2", "other3": "Người chơi 3", "hp": "Sinh lực", "skill": "Khu hổ", "c1": "Tuân Úc đấu điểm với người nhiều Sinh lực hơn", "c2": "Lá của ông cao hơn: Tuân Úc thắng", "c3": "Chọn Người chơi 3, trong tầm của Người chơi 2", "c4": "Người chơi 2 gây 1 sát thương cho Người chơi 3", "whoSize": 56};
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

const L = { x: 850, y: 330 }, R = { x: 1030, y: 330 };
kit.scene('demo', {
  init(kit) {
    kit.stage.append(kit.h('<div class="ground">' +
      OWNER({ pips: PIPS(3, [], 'p') }) +
      OTHER_AT({ n: 2, top: 110, height: 300, name: T.other, pips: PIPS(4, [], 'o') }) +
      OTHER_AT({ n: 3, top: 440, height: 300, name: T.other3, pips: PIPS(4, [], 'q') }) +
      '<div class="ring demo-r2" style="left:1190px;top:100px;width:580px;height:320px"></div><div class="ring demo-r3" style="left:1190px;top:430px;width:580px;height:320px"></div>' +
      ARROW('M1160 330 L1160 560', 'M1136 536 L1160 584 L1184 536') +
      '<div class="sha bk demo-lb"></div>' + CARD('demo-lf', '♠', '9', false) + '<div class="sha bk demo-rb"></div>' + CARD('demo-rf', '♥', '5', true) + DMGT(1640, 450, '-1') + CAPS(4) + '</div>'));
    this.lit = grab(kit, '.demo-lit').style; this.r2 = grab(kit, '.demo-r2').style; this.r3 = grab(kit, '.demo-r3').style; this.s3 = grab(kit, '.demo-s3').style;
    this.lb = grab(kit, '.demo-lb').style; this.lf = grab(kit, '.demo-lf').style; this.rb = grab(kit, '.demo-rb').style; this.rf = grab(kit, '.demo-rf').style;
    this.sh = grab(kit, '.demo-sh').style; this.hd = grab(kit, '.demo-hd').style; this.pip = grab(kit, '.demo-q3').style; this.dmg = grab(kit, '.demo-dmg').style; this.cap = grabCaps(kit, 4);
  },
  render(t) {
    this.lit.opacity = eo(seg(t, 0.3, 0.7));                          // beat 1: Compete with a seat that has more HP
    this.r2.opacity = eo(seg(t, 0.8, 1.2)) * (1 - eio(seg(t, 4.8, 5.2)));
    const inn = eo(seg(t, 1.3, 1.7)), fl = seg(t, 2.8, 3.3), sx = Math.abs(1 - 2 * fl);   // beat 2: both cards turn up, his is higher
    const rise = lerp(24, 0, inn);
    place(this.lb, L.x, L.y + rise, 0.9, 0, sx); place(this.lf, L.x, L.y + rise, 0.9, 0, sx);
    place(this.rb, R.x, R.y + rise, 0.9, 0, sx); place(this.rf, R.x, R.y + rise, 0.9, 0, sx);
    const fade = lerp(1, 0.4, eo(seg(t, 3.7, 4.1)));
    this.lb.opacity = fl < 0.5 ? inn : 0; this.rb.opacity = fl < 0.5 ? inn : 0; this.lf.opacity = fl >= 0.5 ? 1 : 0; this.rf.opacity = fl >= 0.5 ? fade : 0;
    this.r3.opacity = eo(seg(t, 5.0, 5.4)) * (1 - eio(seg(t, 7.2, 7.6)));   // beat 3: he picks a seat within its range
    drawArrow(this.sh, this.hd, t, 5.0, 99);
    const t0 = 6.6;                                                   // beat 4: that seat deals 1 damage to it
    this.s3.transform = 'translateX(' + shake(t, t0) + 'px)'; this.pip.opacity = 1 - eo(seg(t, t0 + 0.1, t0 + 0.3)); popAt(this.dmg, t, t0);
    showCaps(this.cap, t, [[0.0, 0.4, 2.4, 2.7], [2.6, 3.0, 4.7, 5.0], [4.8, 5.2, 6.4, 6.7], [6.6, 7.0, 99, 100]]);
  },
});
