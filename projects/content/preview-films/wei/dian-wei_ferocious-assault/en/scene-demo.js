// Ferocious Assault (Dian Wei, Wei): in his Play Phase he pays by discarding a weapon from his hand, picks a seat in attack
// range, and deals it 1 damage. The text of scene-demo.js. The weapon card, HP and hand sizes are made up and are listed as
// such in the hand-over.
const { seg, eo, eio, lerp } = kit;
const T = {"owner": "Dian Wei", "other": "Seat 2", "hp": "HP", "skill": "Ferocious Assault", "hand": "Hand", "discard": "Discard Pile", "weapon": "Weapon", "c1": "Play Phase: Dian Wei uses Ferocious Assault", "c2": "Dian Wei discards a weapon from the hand", "c3": "Dian Wei picks Seat 2 in attack range", "c4": "Seat 2 suffers 1 damage", "whoSize": 64};
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

const W_AT = { x: 448, y: 631 }, PILE = { x: 960, y: 590 };
kit.scene('demo', {
  init(kit) {
    kit.stage.append(kit.h('<div class="ground">' +
      OWNER({ pips: PIPS(4, [], 'p'), hand: 3, backs: OWN_BACKS(2) }) + OTHER({ pips: PIPS(4, [], 'o') }) + ZONE(T.discard) +
      TO_OTHER + WEAPON('demo-w') + DMG(1440, 340) + CAPS(4) + '</div>'));
    this.lit = grab(kit, '.demo-lit').style; this.h1 = grab(kit, '.demo-h1'); this.s2 = grab(kit, '.demo-s2').style;
    this.pip = grab(kit, '.demo-o3').style; this.dmg = grab(kit, '.demo-dmg').style; this.w = grab(kit, '.demo-w').style;
    this.sh = grab(kit, '.demo-sh').style; this.hd = grab(kit, '.demo-hd').style; this.cap = grabCaps(kit, 4);
  },
  render(t) {
    this.lit.opacity = eo(seg(t, 0.4, 0.8));                          // beat 1: the skill is used in the Play Phase
    const p = eio(seg(t, 2.4, 3.3)), f = flight(W_AT, PILE, p, 70);   // beat 2: the weapon card in his hand is the price
    place(this.w, f.x, f.y, 0.74, lerp(0, -5, p));
    this.h1.textContent = T.hand + (t < 3.3 ? ' 3' : ' 2');
    drawArrow(this.sh, this.hd, t, 4.0, 5.3);                         // beat 3: he picks Seat 2, in attack range
    const t0 = 5.6;                                                   // beat 4: Seat 2 takes 1 damage
    this.s2.transform = 'translateX(' + shake(t, t0) + 'px)';
    this.pip.opacity = 1 - eo(seg(t, t0 + 0.1, t0 + 0.3));
    popAt(this.dmg, t, t0);
    showCaps(this.cap, t, [[0.0, 0.4, 1.8, 2.1], [2.0, 2.4, 3.6, 3.9], [3.8, 4.2, 5.2, 5.5], [5.4, 5.8, 99, 100]]);
  },
});
