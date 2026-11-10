// Arson (Younger Zhuge Liang, Shu), Kingdom Wars: in the Play Phase a red hand card may be played as Blaze. The text of scene-demo.js. The cards (♥ 5, ♣ 2), the hand of 2 and Seat 2 are made up.
const { seg, eo, eio, lerp } = kit;
const T = {"owner":"Younger Zhuge Liang","skill":"Arson","hand":"Hand","seat2":"Seat 2","whoSize":48,"caps":["Play Phase: a red card in hand","Arson: a red card can be played as Blaze","Blaze is played on Seat 2","Seat 2 must show a hand card"]};
const CFG = {"capStarts":[0,1.4,3,4.6],"litAt":1.4,"hand":[[0,2],[3,1]],"ownerH":500,"tags":[{"text":"Play Phase","x":140,"y":150,"a":0.1}],"cards":[{"flips":[1.5],"moves":[{"a":1.4,"b":1.9,"from":[224,631,0.74,0],"to":[224,631,0.74,0]},{"a":3,"b":3.8,"from":[224,631,0.74,0],"to":[1680,390,1,6],"lift":90}]},{"flips":[],"moves":[{"a":0,"b":0.01,"from":[336,631,0.74,0],"to":[336,631,0.74,0]}]}],"rings":[[4.6]]};
const place = (st, x, y, s, r, sx) => { st.transform = 'translate(' + (x - 65) + 'px,' + (y - 91) + 'px) rotate(' + r + 'deg) scale(' + s * (sx === undefined ? 1 : sx) + ',' + s + ')'; };
const grab = (kit, sel) => kit.stage.querySelector(sel);
const FACES = [["<div class=\"sha \"><b class=\"red\" style=\"font-size:96px\">♥</b><span>5</span></div>","<div class=\"sha \"><span style=\"font-size:34px;line-height:1.05;text-align:center;padding:0 6px;font-weight:700\">Blaze</span><span style=\"font-size:28px\"><i style=\"font-style:normal;color:var(--red)\">♥</i> 5</span></div>"],["<div class=\"sha \"><b style=\"font-size:96px\">♣</b><span>2</span></div>"]];
const showCaps = (caps, t, win) => win.forEach((w, i) => { const a = eo(seg(t, w[0], w[1])); caps[i].opacity = a * (1 - eio(seg(t, w[2], w[3]))); caps[i].transform = 'translateY(' + lerp(18, 0, a) + 'px)'; });
const WIN = CFG.capStarts.map((s, i) => [s, s + 0.4, i + 1 < CFG.capStarts.length ? CFG.capStarts[i + 1] - 0.1 : 99, i + 1 < CFG.capStarts.length ? CFG.capStarts[i + 1] + 0.2 : 100]);
kit.scene('demo', {
  init(kit) {
    let h = '<div class="ground">';
    (CFG.zones || []).forEach((z) => { h += '<div class="zone" style="left:' + z.l + 'px;top:' + z.t + 'px;width:' + z.w + 'px;height:' + z.h + 'px"><p>' + z.label + '</p></div>'; });
    (CFG.labels || []).forEach((l) => { h += '<p class="lbl" style="position:absolute;margin:0;left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px;text-align:center">' + l.text + '</p>'; });
    h += '<div class="seat demo-s1" style="left:140px;top:220px;width:560px;height:' + CFG.ownerH + 'px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + T.owner + '</p>' +
      '<div class="chip" style="left:36px;top:124px">' + T.skill + '</div><div class="chip lit demo-lit" style="left:36px;top:124px">' + T.skill + '</div>' +
      (CFG.hand ? '<p class="lbl demo-h1" style="left:36px;top:306px"></p>' : '') + '</div>';
    h += '<div class="seat demo-s2" style="left:1200px;top:300px;width:560px;height:180px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + T.seat2 + '</p></div>';
    (CFG.rings || []).forEach((r, i) => { h += '<div class="ring demo-ring' + i + '" style="left:1190px;top:290px;width:580px;height:200px"></div>'; });
    (CFG.tags || []).forEach((g, i) => { h += '<div class="chip demo-tag' + i + '" style="left:' + g.x + 'px;top:' + g.y + 'px">' + g.text + '</div>'; });
    (CFG.marks || []).forEach((m, i) => { h += '<p class="demo-mark' + i + '" style="position:absolute;margin:0;left:' + (m.x - 60) + 'px;top:' + (m.y - 80) + 'px;width:120px;text-align:center;font-family:var(--display);font-size:' + m.size + 'px;font-weight:700;line-height:1;color:var(--accent)">' + m.text + '</p>'; });
    CFG.cards.forEach((c, i) => { FACES[i].forEach((f, k) => { h += f.replace('class="sha', 'class="sha demo-c' + i + 'f' + k); }); });
    CFG.capStarts.forEach((_, i) => { h += '<p class="cap demo-cap' + i + '">' + T.caps[i] + '</p>'; });
    kit.stage.append(kit.h(h + '</div>'));
    this.lit = grab(kit, '.demo-lit').style; this.h1 = grab(kit, '.demo-h1');
    this.f = CFG.cards.map((c, i) => FACES[i].map((_, k) => grab(kit, '.demo-c' + i + 'f' + k).style));
    this.ring = (CFG.rings || []).map((_, i) => grab(kit, '.demo-ring' + i).style);
    this.tag = (CFG.tags || []).map((_, i) => grab(kit, '.demo-tag' + i).style);
    this.mark = (CFG.marks || []).map((_, i) => grab(kit, '.demo-mark' + i).style);
    this.cap = CFG.capStarts.map((_, i) => grab(kit, '.demo-cap' + i).style);
  },
  render(t) {
    this.lit.opacity = CFG.litAt === 0 ? 1 : eo(seg(t, CFG.litAt, CFG.litAt + 0.4));
    if (this.h1) { let n = CFG.hand[0][1]; CFG.hand.forEach((e) => { if (t >= e[0]) n = e[1]; }); this.h1.textContent = T.hand + ' ' + n; }
    CFG.cards.forEach((c, i) => {
      let pos = c.moves[0].from, rot = 0;
      c.moves.forEach((m) => {
        if (t >= m.a) { const p = eio(seg(t, m.a, m.b)); pos = [lerp(m.from[0], m.to[0], p), lerp(m.from[1], m.to[1], p) - Math.sin(Math.PI * p) * (m.lift || 0), lerp(m.from[2], m.to[2], p), lerp(m.from[3], m.to[3], p)]; }
      });
      let face = 0, sx = 1;
      c.flips.forEach((f, k) => { const q = seg(t, f, f + 0.4); if (q > 0) { sx = q < 1 ? Math.abs(1 - 2 * q) : 1; face = q >= 0.5 ? k + 1 : face; } });
      const vis = (c.show ? eo(seg(t, c.show[0], c.show[0] + 0.3)) : 1) * (c.hideAt ? 1 - eio(seg(t, c.hideAt, c.hideAt + 0.3)) : 1);
      this.f[i].forEach((st, k) => { place(st, pos[0], pos[1], pos[2], pos[3], sx); st.opacity = k === face ? vis : 0; });
    });
    (CFG.rings || []).forEach((r, i) => { this.ring[i].opacity = eo(seg(t, r[0], r[0] + 0.4)); });
    (CFG.tags || []).forEach((g, i) => { this.tag[i].opacity = eo(seg(t, g.a, g.a + 0.4)); });
    (CFG.marks || []).forEach((m, i) => { this.mark[i].opacity = eo(seg(t, m.a, m.a + 0.2)) * (1 - eio(seg(t, m.b - 0.4, m.b))); this.mark[i].transform = 'scale(' + lerp(1.4, 1, eo(seg(t, m.a, m.a + 0.3))) + ')'; });
    showCaps(this.cap, t, WIN);
  },
});
