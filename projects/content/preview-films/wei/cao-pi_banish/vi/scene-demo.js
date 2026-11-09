// Banish (Cao Pi, Wei), in the deck's order: he suffers damage, picks another seat, that seat draws as many cards as the HP
// he has lost, then it turns over. The text of scene-demo.js. HP, the draw of 2 and Seat 2's hand are made up and are listed
// as such in the hand-over.
const { seg, eo, eio, lerp } = kit;
const T = {"owner": "Tào Phi", "other": "Người chơi 2", "hp": "Sinh lực", "skill": "Phóng trục", "hand": "Bài trên tay", "pile": "Chồng bài rút", "tag": "Úp", "c1": "Tào Phi chịu 1 sát thương", "c2": "Tào Phi chọn Người chơi 2", "c3": "Người chơi 2 rút 2 lá: Sinh lực Tào Phi đã mất", "c4": "Rồi Người chơi 2 lật mặt", "whoSize": 56};
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

const PILE = { x: 960, y: 590 }, SLOT_A = { x: 1652, y: 461 }, SLOT_B = { x: 1704, y: 461 };
kit.scene('demo', {
  init(kit) {
    kit.stage.append(kit.h('<div class="ground">' +
      OWNER({ pips: PIPS(3, [2], 'p') }) +
      OTHER({ pips: PIPS(4, [], 'o'), hand: true, backs: THEIR_BACKS(2, 52) }) +
      '<div class="ring demo-ring" style="left:1190px;top:290px;width:580px;height:280px"></div>' +
      '<p class="lbl" style="position:absolute;margin:0;left:820px;top:462px;width:280px;text-align:center">' + T.pile + '</p>' +
      '<div class="sha bk demo-pile"></div><div class="sha bk demo-ca"></div><div class="sha bk demo-cb"></div>' +
      '<div class="chip demo-tag" style="left:1200px;top:578px">' + T.tag + '</div>' + DMG(430, 330) + CAPS(4) + '</div>'));
    this.s1 = grab(kit, '.demo-s1').style; this.s2 = grab(kit, '.demo-s2').style; this.lit = grab(kit, '.demo-lit').style; this.h2 = grab(kit, '.demo-h2');
    this.pip = grab(kit, '.demo-p1').style; this.dmg = grab(kit, '.demo-dmg').style; this.ring = grab(kit, '.demo-ring').style; this.tag = grab(kit, '.demo-tag').style;
    this.pile = grab(kit, '.demo-pile').style; this.ca = grab(kit, '.demo-ca').style; this.cb = grab(kit, '.demo-cb').style; this.cap = grabCaps(kit, 4);
  },
  render(t) {
    const t0 = 0.4;                                                   // beat 1: the damage
    this.s1.transform = 'translateX(' + shake(t, t0) + 'px)';
    this.pip.opacity = 1 - eo(seg(t, t0 + 0.1, t0 + 0.3));
    popAt(this.dmg, t, t0);
    this.lit.opacity = eo(seg(t, 1.6, 2.0));                          // beat 2: the skill lights and picks Seat 2
    this.ring.opacity = eo(seg(t, 1.6, 2.0)) * (1 - eio(seg(t, 3.0, 3.4)));
    this.ring.transform = 'scale(' + lerp(0.94, 1, eo(seg(t, 1.6, 2.2))) + ')';
    place(this.pile, PILE.x, PILE.y, 0.8, 0);                         // beat 3: Seat 2 draws 2 cards
    const a = eio(seg(t, 3.4, 4.3)), b = eio(seg(t, 3.7, 4.6)), fa = flight(PILE, SLOT_A, a, 70), fb = flight(PILE, SLOT_B, b, 70);
    const fl = seg(t, 5.4, 6.0), sx = Math.abs(1 - 2 * fl);           // beat 4: Seat 2 turns over (the panel and its cards flip)
    place(this.ca, fa.x, fa.y, lerp(0.8, 0.74, a), lerp(0, -4, a), sx); place(this.cb, fb.x, fb.y, lerp(0.8, 0.74, b), lerp(0, 4, b), sx);
    this.ca.opacity = t < 3.4 ? 0 : 1; this.cb.opacity = t < 3.7 ? 0 : 1;
    this.s2.transform = 'scaleX(' + sx + ')';
    this.s2.opacity = fl < 0.5 ? 1 : 0.55;
    this.tag.opacity = eo(seg(t, 5.9, 6.2));
    this.h2.textContent = T.hand + (t < 4.3 ? ' 2' : t < 4.6 ? ' 3' : ' 4');
    showCaps(this.cap, t, [[0.0, 0.4, 1.4, 1.7], [1.6, 2.0, 3.0, 3.3], [3.2, 3.6, 5.0, 5.3], [5.2, 5.6, 99, 100]]);
  },
});
