// Altruism (Lu Su, Wu), Kingdom Wars: in his Draw Phase he may draw 2 more; holding more than 5 he gives half (rounded down) to the other seat with the fewest hand cards. The text of scene-demo.js. The hands of 3, 1 and 3, HP 3 and the 3 cards given are made up; ties and the may-prompt are left out.
const { seg, eo, eio, lerp } = kit;
const T = {"hand":"Hand","hp":"HP","whoSize":60,"owner":"Lu Su","skill":"Altruism","caps":["Draw Phase","Draw 2 cards","Altruism: draw 2 more","Over 5: give half to the seat with fewest"]};
const CFG = {"capStarts":[0,1.2,2.8,4.6],"litAt":2.8,"panels":[{"left":140,"top":220,"h":500,"who":"Lu Su","pips":3,"hand":[[0,3],[1.9,4],[2.1,5],[3.5,6],[3.7,7],[4.6,4]]},{"left":1200,"top":220,"h":240,"who":"Seat 2","hand":[[0,1],[5.4,4]]},{"left":1200,"top":500,"h":240,"who":"Seat 3","hand":[[0,3]]}],"zones":[{"l":780,"t":300,"w":360,"h":190,"label":"Draw Pile"}],"rings":[[4.6,99,1190,210,580,260]],"cards":[{"flips":[],"moves":[{"a":0,"b":0.01,"from":[224,631,0.74,0],"to":[224,631,0.74,0]}]},{"flips":[],"moves":[{"a":0,"b":0.01,"from":[448,631,0.74,0],"to":[448,631,0.74,0]}]},{"flips":[],"show":[1.0999999999999999],"hideAt":1.9,"moves":[{"a":1.2,"b":1.9,"from":[960,425,0.74,0],"to":[560,631,0.74,0],"lift":60}]},{"flips":[],"show":[1.2999999999999998],"hideAt":2.0999999999999996,"moves":[{"a":1.4,"b":2.0999999999999996,"from":[960,425,0.74,0],"to":[560,631,0.74,0],"lift":60}]},{"flips":[],"show":[2.6999999999999997],"hideAt":3.5,"moves":[{"a":2.8,"b":3.5,"from":[960,425,0.74,0],"to":[560,631,0.74,0],"lift":60}]},{"flips":[],"show":[2.9],"hideAt":3.7,"moves":[{"a":3,"b":3.7,"from":[960,425,0.74,0],"to":[560,631,0.74,0],"lift":60}]},{"flips":[],"show":[4.55],"hideAt":5.449999999999999,"moves":[{"a":4.6,"b":5.3999999999999995,"from":[336,631,0.74,0],"to":[1690,340,0.74,0],"lift":60}]},{"flips":[],"show":[4.7],"hideAt":5.6,"moves":[{"a":4.75,"b":5.55,"from":[336,631,0.74,0],"to":[1690,340,0.74,0],"lift":60}]},{"flips":[],"show":[4.8500000000000005],"hideAt":5.75,"moves":[{"a":4.9,"b":5.7,"from":[336,631,0.74,0],"to":[1690,340,0.74,0],"lift":60}]}]};
const FACES = [["<div class=\"sha bk\"></div>"],["<div class=\"sha bk\"></div>"],["<div class=\"sha bk\"></div>"],["<div class=\"sha bk\"></div>"],["<div class=\"sha bk\"></div>"],["<div class=\"sha bk\"></div>"],["<div class=\"sha bk\"></div>"],["<div class=\"sha bk\"></div>"],["<div class=\"sha bk\"></div>"]];
const place = (st, x, y, s, r, sx) => { st.transform = 'translate(' + (x - 65) + 'px,' + (y - 91) + 'px) rotate(' + r + 'deg) scale(' + s * (sx === undefined ? 1 : sx) + ',' + s + ')'; };
const grab = (kit, sel) => kit.stage.querySelector(sel);
const PIPS = (n, tag) => { let h = ''; for (let i = 0; i < n; i++) h += '<span class="pip"><i class="demo-' + tag + i + '"></i></span>'; return h; };
const showCaps = (caps, t, win) => win.forEach((w, i) => { const a = eo(seg(t, w[0], w[1])); caps[i].opacity = a * (1 - eio(seg(t, w[2], w[3]))); caps[i].transform = 'translateY(' + lerp(18, 0, a) + 'px)'; });
const WIN = CFG.capStarts.map((s, i) => [s, s + 0.4, i + 1 < CFG.capStarts.length ? CFG.capStarts[i + 1] - 0.1 : 99, i + 1 < CFG.capStarts.length ? CFG.capStarts[i + 1] + 0.2 : 100]);
kit.scene('demo', {
  init(kit) {
    let h = '<div class="ground">';
    (CFG.zones || []).forEach((z) => { h += '<div class="zone" style="left:' + z.l + 'px;top:' + z.t + 'px;width:' + z.w + 'px;height:' + z.h + 'px"><p>' + z.label + '</p></div>'; });
    CFG.panels.forEach((p, i) => {
      h += '<div class="seat" style="left:' + p.left + 'px;top:' + p.top + 'px;width:560px;height:' + p.h + 'px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + p.who + '</p>';
      if (i === 0) h += '<p class="lbl" style="left:36px;top:124px">' + T.hp + '</p><div class="pips" style="left:36px;top:164px">' + PIPS(p.pips, 'op0') + '</div><div class="chip" style="left:36px;top:236px">' + T.skill + '</div><div class="chip lit demo-lit" style="left:36px;top:236px">' + T.skill + '</div><p class="lbl demo-h0" style="left:36px;top:306px"></p>';
      else h += '<p class="lbl demo-h' + i + '" style="left:36px;top:100px"></p><div class="pips" style="left:36px;top:146px">' + PIPS(4, 'op' + i) + '</div>';
      h += '</div>';
    });
    CFG.rings.forEach((r, i) => { h += '<div class="ring demo-ring' + i + '" style="left:' + r[2] + 'px;top:' + r[3] + 'px;width:' + r[4] + 'px;height:' + r[5] + 'px"></div>'; });
    (CFG.pops || []).forEach((m, i) => { h += '<p class="demo-pop' + i + '" style="position:absolute;margin:0;left:' + m[2] + 'px;top:' + m[3] + 'px;font-family:var(--display);font-size:84px;font-weight:700;color:var(--accent)">' + m[1] + '</p>'; });
    CFG.cards.forEach((c, i) => { FACES[i].forEach((f, k) => { h += f.replace('class="sha', 'class="sha demo-c' + i + 'f' + k); }); });
    CFG.capStarts.forEach((_, i) => { h += '<p class="cap demo-cap' + i + '">' + T.caps[i] + '</p>'; });
    kit.stage.append(kit.h(h + '</div>'));
    this.lit = grab(kit, '.demo-lit').style;
    this.h = CFG.panels.map((p, i) => grab(kit, '.demo-h' + i));
    this.f = CFG.cards.map((c, i) => FACES[i].map((_, k) => grab(kit, '.demo-c' + i + 'f' + k).style));
    this.ring = CFG.rings.map((_, i) => grab(kit, '.demo-ring' + i).style);
    this.pop = (CFG.pops || []).map((_, i) => grab(kit, '.demo-pop' + i).style);
    this.pip = (CFG.pipGain || []).map((g) => grab(kit, '.demo-op' + g[0] + g[1]).style);
    this.cap = CFG.capStarts.map((_, i) => grab(kit, '.demo-cap' + i).style);
  },
  render(t) {
    this.lit.opacity = eo(seg(t, CFG.litAt, CFG.litAt + 0.4));
    CFG.panels.forEach((p, i) => { if (!p.hand) return; let n = p.hand[0][1]; p.hand.forEach((e) => { if (t >= e[0]) n = e[1]; }); this.h[i].textContent = T.hand + ' ' + n; });
    CFG.cards.forEach((c, i) => {
      let pos = c.moves[0].from;
      c.moves.forEach((m) => { if (t >= m.a) { const p = eio(seg(t, m.a, m.b)); pos = [lerp(m.from[0], m.to[0], p), lerp(m.from[1], m.to[1], p) - Math.sin(Math.PI * p) * (m.lift || 0), lerp(m.from[2], m.to[2], p), lerp(m.from[3], m.to[3], p)]; } });
      const vis = (c.show ? eo(seg(t, c.show[0], c.show[0] + 0.2)) : 1) * (c.hideAt ? 1 - eio(seg(t, c.hideAt, c.hideAt + 0.25)) : 1);
      this.f[i].forEach((st, k) => { place(st, pos[0], pos[1], pos[2], pos[3], 1); st.opacity = k === 0 ? vis : 0; });
    });
    CFG.rings.forEach((r, i) => { this.ring[i].opacity = eo(seg(t, r[0], r[0] + 0.4)) * (r[1] < 90 ? 1 - eio(seg(t, r[1], r[1] + 0.3)) : 1); });
    (CFG.pops || []).forEach((m, i) => { const t0 = m[0]; this.pop[i].opacity = eo(seg(t, t0, t0 + 0.2)) * (1 - eio(seg(t, t0 + 0.9, t0 + 1.3))); this.pop[i].transform = 'translateY(' + lerp(0, -50, eo(seg(t, t0, t0 + 1.2))) + 'px)'; });
    (CFG.pipGain || []).forEach((g, i) => { this.pip[i].opacity = t >= g[2] ? 1 : 0; });
    showCaps(this.cap, t, WIN);
  },
});
