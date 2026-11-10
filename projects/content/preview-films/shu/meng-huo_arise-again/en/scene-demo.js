// Arise Again (Meng Huo, Shu), Kingdom Wars: in the Draw Phase, if hurt, he may forfeit drawing and reveal as many cards as the HP he has lost; each heart regains 1 HP and is discarded, the rest go to his hand. The text of scene-demo.js. HP 2 of 4, the revealed cards (♥ 4, ♠ 9) and the hand of 1 are made up; a reveal with no heart is not shown.
const { seg, eo, eio, lerp } = kit;
const T = {"owner":"Meng Huo","skill":"Arise Again","hand":"Hand","hp":"HP","seat2":"Seat 2","whoSize":64,"caps":["Draw Phase: Meng Huo has 2 of 4 HP","Arise Again: reveal 2 cards instead of drawing","♥4 is a heart: Meng Huo regains 1 HP","♠9 goes to Meng Huo's hand"]};
const CFG = {"capStarts":[0,1.6,3.4,5.2],"litAt":1.6,"noS2":true,"hand":[[0,1],[6,2]],"ownerH":500,"ownerPips":4,"ownerEmpty":[{"i":2,"until":3.9},{"i":3,"until":99}],"tags":[{"text":"Draw Phase","x":140,"y":150,"a":0.1}],"zones":[{"l":1300,"t":560,"w":360,"h":240,"label":"Draw Pile"},{"l":1300,"t":230,"w":360,"h":240,"label":"Discard Pile"}],"pops":[{"text":"+1","x":450,"y":395,"a":3.9}],"cards":[{"flips":[],"moves":[{"a":0,"b":0.01,"from":[224,631,0.74,0],"to":[224,631,0.74,0]}]},{"flips":[2.5],"moves":[{"a":1.6,"b":2.4,"from":[1480,700,0.74,0],"to":[860,420,1,-3],"lift":80},{"a":3.4,"b":4.2,"from":[860,420,1,-3],"to":[1480,350,0.9,4],"lift":60}],"show":[1.6]},{"flips":[2.6],"moves":[{"a":1.7,"b":2.5,"from":[1480,700,0.74,0],"to":[1040,420,1,3],"lift":80},{"a":5.2,"b":6,"from":[1040,420,1,3],"to":[336,631,0.74,0],"lift":80}],"show":[1.7]}]};
const FACES = [["<div class=\"sha bk \"></div>"],["<div class=\"sha bk \"></div>","<div class=\"sha \"><b class=\"red\" style=\"font-size:96px\">♥</b><span>4</span></div>"],["<div class=\"sha bk \"></div>","<div class=\"sha \"><b style=\"font-size:96px\">♠</b><span>9</span></div>"]];
const place = (st, x, y, s, r, sx) => { st.transform = 'translate(' + (x - 65) + 'px,' + (y - 91) + 'px) rotate(' + r + 'deg) scale(' + s * (sx === undefined ? 1 : sx) + ',' + s + ')'; };
const grab = (kit, sel) => kit.stage.querySelector(sel);
const PIPS = (n, tag) => { let h = ''; for (let i = 0; i < n; i++) h += '<span class="pip"><i class="demo-' + tag + i + '"></i></span>'; return h; };
const showCaps = (caps, t, win) => win.forEach((w, i) => { const a = eo(seg(t, w[0], w[1])); caps[i].opacity = a * (1 - eio(seg(t, w[2], w[3]))); caps[i].transform = 'translateY(' + lerp(18, 0, a) + 'px)'; });
const WIN = CFG.capStarts.map((s, i) => [s, s + 0.4, i + 1 < CFG.capStarts.length ? CFG.capStarts[i + 1] - 0.1 : 99, i + 1 < CFG.capStarts.length ? CFG.capStarts[i + 1] + 0.2 : 100]);
const S2 = CFG.s2 || {};
const S2_LBL = S2.pips ? 188 : S2.noHp ? 96 : 96, S2_BACK = S2_LBL + 32;
const S2_H = S2.hand ? S2_BACK + 130 + 24 : (S2.pips ? 190 : 180);
kit.scene('demo', {
  init(kit) {
    let h = '<div class="ground">';
    (CFG.zones || []).forEach((z) => { h += '<div class="zone" style="left:' + z.l + 'px;top:' + z.t + 'px;width:' + z.w + 'px;height:' + z.h + 'px"><p>' + z.label + '</p></div>'; });
    (CFG.labels || []).forEach((l) => { h += '<p class="lbl" style="position:absolute;margin:0;left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px;text-align:center">' + l.text + '</p>'; });
    const chipTop = CFG.ownerPips ? 236 : 124;
    h += '<div class="seat demo-s1" style="left:140px;top:220px;width:560px;height:' + CFG.ownerH + 'px"><p class="who" style="left:36px;top:30px;font-size:' + (CFG.ownerNameSize || T.whoSize) + 'px">' + T.owner + '</p>' +
      (CFG.ownerPips ? '<p class="lbl" style="left:36px;top:124px">' + T.hp + '</p><div class="pips" style="left:36px;top:164px">' + PIPS(CFG.ownerPips, 'op') + '</div>' : '') +
      '<div class="chip" style="left:36px;top:' + chipTop + 'px">' + T.skill + '</div><div class="chip lit demo-lit" style="left:36px;top:' + chipTop + 'px">' + T.skill + '</div>' +
      (CFG.hand ? '<p class="lbl demo-h1" style="left:36px;top:306px"></p>' : '') + '</div>';
    if (!CFG.noS2) h += '<div class="seat demo-s2" style="left:1200px;top:300px;width:560px;height:' + S2_H + 'px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + T.seat2 + '</p>' +
      (S2.pips ? '<p class="lbl" style="left:36px;top:92px">' + T.hp + '</p><div class="pips" style="left:36px;top:126px">' + PIPS(S2.pips, 'sp') + '</div>' : '') +
      (S2.hand ? '<p class="lbl demo-h2" style="left:36px;top:' + S2_LBL + 'px"></p>' + Array.from({ length: S2.hand }, (_, i) => '<div class="cback demo-sb' + i + '" style="left:' + (36 + i * 112) + 'px;top:' + S2_BACK + 'px"></div>').join('') : '') + '</div>';
    if (CFG.s3) h += '<div class="seat demo-s3" style="left:1200px;top:560px;width:560px;height:190px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + CFG.s3.name + '</p><p class="lbl" style="left:36px;top:92px">' + T.hp + '</p><div class="pips" style="left:36px;top:126px">' + PIPS(CFG.s3.pips, 'tp') + '</div></div>';
    (CFG.rings || []).forEach((r, i) => { h += '<div class="ring demo-ring' + i + '" style="left:1190px;top:290px;width:580px;height:' + (S2_H + 20) + 'px"></div>'; });
    (CFG.tags || []).forEach((g, i) => { h += '<div class="chip demo-tag' + i + '" style="left:' + g.x + 'px;top:' + g.y + 'px">' + g.text + '</div>'; });
    (CFG.marks || []).forEach((m, i) => { h += '<p class="demo-mark' + i + '" style="position:absolute;margin:0;left:' + (m.x - 60) + 'px;top:' + (m.y - 80) + 'px;width:120px;text-align:center;font-family:var(--display);font-size:' + m.size + 'px;font-weight:700;line-height:1;color:var(--accent)">' + m.text + '</p>'; });
    (CFG.pops || []).forEach((m, i) => { h += '<p class="demo-pop' + i + '" style="position:absolute;margin:0;left:' + m.x + 'px;top:' + m.y + 'px;font-family:var(--display);font-size:84px;font-weight:700;color:var(--accent)">' + m.text + '</p>'; });
    CFG.cards.forEach((c, i) => { FACES[i].forEach((f, k) => { h += f.replace('class="sha', 'class="sha demo-c' + i + 'f' + k); }); });
    CFG.capStarts.forEach((_, i) => { h += '<p class="cap demo-cap' + i + '">' + T.caps[i] + '</p>'; });
    kit.stage.append(kit.h(h + '</div>'));
    this.lit = grab(kit, '.demo-lit').style; this.h1 = grab(kit, '.demo-h1'); this.h2 = grab(kit, '.demo-h2'); this.s2 = CFG.noS2 ? {} : grab(kit, '.demo-s2').style;
    this.f = CFG.cards.map((c, i) => FACES[i].map((_, k) => grab(kit, '.demo-c' + i + 'f' + k).style));
    this.ring = (CFG.rings || []).map((_, i) => grab(kit, '.demo-ring' + i).style);
    this.tagEl = (CFG.tags || []).map((_, i) => grab(kit, '.demo-tag' + i));
    this.mark = (CFG.marks || []).map((_, i) => grab(kit, '.demo-mark' + i).style);
    this.pop = (CFG.pops || []).map((_, i) => grab(kit, '.demo-pop' + i).style);
    this.op = Array.from({ length: CFG.ownerPips || 0 }, (_, i) => grab(kit, '.demo-op' + i).style);
    this.s3 = CFG.s3 ? grab(kit, '.demo-s3').style : null;
    this.tp = Array.from({ length: (CFG.s3 && CFG.s3.pips) || 0 }, (_, i) => grab(kit, '.demo-tp' + i).style);
    this.sp = Array.from({ length: S2.pips || 0 }, (_, i) => grab(kit, '.demo-sp' + i).style);
    this.sb = Array.from({ length: S2.hand || 0 }, (_, i) => grab(kit, '.demo-sb' + i).style);
    this.cap = CFG.capStarts.map((_, i) => grab(kit, '.demo-cap' + i).style);
  },
  render(t) {
    this.lit.opacity = CFG.litAt === 0 ? 1 : eo(seg(t, CFG.litAt, CFG.litAt + 0.4));
    if (this.h1) { let n = CFG.hand[0][1]; CFG.hand.forEach((e) => { if (t >= e[0]) n = e[1]; }); this.h1.textContent = T.hand + ' ' + n; }
    let n2 = S2.hand || 0;
    if (S2.handTL) { n2 = S2.handTL[0][1]; S2.handTL.forEach((e) => { if (t >= e[0]) n2 = e[1]; }); }
    if (this.h2) this.h2.textContent = T.hand + ' ' + n2;
    this.sb.forEach((st, i) => { st.opacity = i < n2 ? 1 : 0; });
    this.op.forEach((st, i) => { let e = 1; (CFG.ownerEmpty || []).forEach((q) => { if (q.i === i && t < q.until) e = 0; }); st.opacity = e; });
    this.sp.forEach((st, i) => { let lost = false; (S2.loseAt || []).forEach((l) => { if (l[0] === i && t >= l[1]) lost = true; }); st.opacity = lost ? 0 : 1; });
    CFG.cards.forEach((c, i) => {
      let pos = c.moves[0].from;
      c.moves.forEach((m) => {
        if (t >= m.a) { const p = eio(seg(t, m.a, m.b)); pos = [lerp(m.from[0], m.to[0], p), lerp(m.from[1], m.to[1], p) - Math.sin(Math.PI * p) * (m.lift || 0), lerp(m.from[2], m.to[2], p), lerp(m.from[3], m.to[3], p)]; }
      });
      let face = 0, sx = 1;
      c.flips.forEach((f, k) => { const q = seg(t, f, f + 0.4); if (q > 0) { sx = q < 1 ? Math.abs(1 - 2 * q) : 1; face = q >= 0.5 ? k + 1 : face; } });
      const vis = (c.show ? eo(seg(t, c.show[0], c.show[0] + 0.3)) : 1) * (c.hideAt ? 1 - eio(seg(t, c.hideAt, c.hideAt + 0.3)) : 1);
      this.f[i].forEach((st, k) => { place(st, pos[0], pos[1], pos[2], pos[3], sx); st.opacity = k === face ? vis : 0; });
    });
    (CFG.rings || []).forEach((r, i) => { this.ring[i].opacity = eo(seg(t, r[0], r[0] + 0.4)) * (r[1] ? 1 - eio(seg(t, r[1], r[1] + 0.3)) : 1); });
    (CFG.tags || []).forEach((g, i) => {
      const el = this.tagEl[i]; let text = g.text; (g.swaps || []).forEach((s) => { if (t >= s[0]) text = s[1]; });
      if (el.textContent !== text) el.textContent = text;
      el.style.opacity = eo(seg(t, g.a, g.a + 0.4)) * (g.outAt ? 1 - eio(seg(t, g.outAt, g.outAt + 0.4)) : 1) * (g.strikeAt ? 1 - 0.45 * eo(seg(t, g.strikeAt, g.strikeAt + 0.3)) : 1);
      el.style.textDecoration = g.strikeAt && t >= g.strikeAt ? 'line-through' : 'none';
      if (g.red) { el.style.background = 'var(--red)'; el.style.borderColor = 'var(--red)'; el.style.color = '#fff'; }
      if (g.lit !== undefined) { const k = eo(seg(t, g.lit, g.lit + 0.3)); el.style.background = k > 0.5 ? 'var(--accent)' : 'transparent'; el.style.color = k > 0.5 ? 'var(--ground)' : 'inherit'; el.style.borderColor = k > 0.5 ? 'var(--accent)' : ''; }
    });
    (CFG.marks || []).forEach((m, i) => { this.mark[i].opacity = eo(seg(t, m.a, m.a + 0.2)) * (m.b < 90 ? 1 - eio(seg(t, m.b - 0.4, m.b)) : 1); this.mark[i].transform = 'scale(' + lerp(1.4, 1, eo(seg(t, m.a, m.a + 0.3))) + ')'; });
    (CFG.pops || []).forEach((m, i) => { const t0 = m.a; this.pop[i].opacity = eo(seg(t, t0, t0 + 0.2)) * (1 - eio(seg(t, t0 + 0.9, t0 + 1.3))); this.pop[i].transform = 'translateY(' + lerp(0, -50, eo(seg(t, t0, t0 + 1.2))) + 'px)'; });
    let sh = 0; (CFG.shakes || []).forEach((t0) => { if (t > t0) sh = Math.sin((t - t0) * 55) * 14 * (1 - seg(t, t0, t0 + 0.6)); });
    this.s2.transform = 'translateX(' + sh + 'px)';
    if (this.s3) { let sh3 = 0; (CFG.shakes3 || []).forEach((t0) => { if (t > t0) sh3 = Math.sin((t - t0) * 55) * 14 * (1 - seg(t, t0, t0 + 0.6)); }); this.s3.transform = 'translateX(' + sh3 + 'px)'; }
    this.tp.forEach((st, i) => { let lost = false; ((CFG.s3 && CFG.s3.loseAt) || []).forEach((l) => { if (l[0] === i && t >= l[1]) lost = true; }); st.opacity = lost ? 0 : 1; });
    showCaps(this.cap, t, WIN);
  },
});
