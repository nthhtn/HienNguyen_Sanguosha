// Displacement (Da Qiao, Wu), Kingdom Wars: when a Sha targets her she may discard a card to move it to another seat within her attack range, not the Sha's user. The text of scene-demo.js. The Sha (♠ 7), the discard (♣ 4), the hands of 4 and 3, HP 3 and Seats 2 and 3 are made up; the attack-range check is left out.
const { seg, eo, eio, lerp } = kit;
const T = {"hand":"Bài trên tay","hp":"Sinh lực","seat2":"Người chơi 2","whoSize":50,"owner":"Đại Kiều","skill":"Lưu ly","caps":["Người chơi 3 dùng Sát lên Đại Kiều","Bỏ một lá bài","Sát chuyển sang Người chơi 2","Người chơi 2 giờ là mục tiêu"]};
const CFG = {"capStarts":[0,1.8,3.2,5],"litAt":1.8,"panels":[{"left":140,"top":220,"h":500,"who":"Đại Kiều","pips":3,"hand":[[0,4],[1.8,3]]},{"left":1200,"top":220,"h":240,"who":"Người chơi 3"},{"left":1200,"top":500,"h":240,"who":"Người chơi 2"}],"zones":[{"l":780,"t":560,"w":360,"h":190,"label":"Chồng bài bỏ"}],"rings":[[0.9,1.8,130,210,580,520],[5,99,1190,490,580,260]],"cards":[{"flips":[],"moves":[{"a":0.2,"b":1,"from":[1480,330,0.74,0],"to":[820,430,1,0],"lift":50},{"a":3.2,"b":4.4,"from":[820,430,1,0],"to":[1690,640,0.74,0],"lift":120}]},{"flips":[],"moves":[{"a":1.8,"b":2.6,"from":[448,631,0.74,0],"to":[960,685,0.74,0],"lift":60}]},{"flips":[],"moves":[{"a":0,"b":0.01,"from":[224,631,0.74,0],"to":[224,631,0.74,0]}]},{"flips":[],"moves":[{"a":0,"b":0.01,"from":[336,631,0.74,0],"to":[336,631,0.74,0]}]},{"flips":[],"moves":[{"a":0,"b":0.01,"from":[560,631,0.74,0],"to":[560,631,0.74,0]}]}]};
const FACES = [["<div class=\"sha \"><span style=\"font-size:34px;line-height:1.05;text-align:center;padding:0 6px;font-weight:700\">Sát</span><span style=\"font-size:28px\">♠ 7</span></div>"],["<div class=\"sha \"><b style=\"font-size:96px\">♣</b><span>4</span></div>"],["<div class=\"sha bk\"></div>"],["<div class=\"sha bk\"></div>"],["<div class=\"sha bk\"></div>"]];
const place = (st, x, y, s, r, sx) => { st.transform = 'translate(' + (x - 65) + 'px,' + (y - 91) + 'px) rotate(' + r + 'deg) scale(' + s * (sx === undefined ? 1 : sx) + ',' + s + ')'; };
const grab = (kit, sel) => kit.stage.querySelector(sel);
const PIPS = (n, tag) => { let h = ''; for (let i = 0; i < n; i++) h += '<span class="pip"><i class="demo-' + tag + i + '"></i></span>'; return h; };
const showCaps = (caps, t, win) => win.forEach((w, i) => { const a = eo(seg(t, w[0], w[1])); caps[i].opacity = a * (1 - eio(seg(t, w[2], w[3]))); caps[i].transform = 'translateY(' + lerp(18, 0, a) + 'px)'; });
const WIN = CFG.capStarts.map((s, i) => [s, s + 0.4, i + 1 < CFG.capStarts.length ? CFG.capStarts[i + 1] - 0.1 : 99, i + 1 < CFG.capStarts.length ? CFG.capStarts[i + 1] + 0.2 : 100]);
kit.scene('demo', {
  init(kit) {
    let h = '<div class="ground">';
    (CFG.zones || []).forEach((z) => { h += '<div class="zone" style="left:' + z.l + 'px;top:' + z.t + 'px;width:' + z.w + 'px;height:' + z.h + 'px"><p>' + z.label + '</p></div>'; });
    (CFG.labels || []).forEach((l) => { h += '<p class="lbl" style="position:absolute;margin:0;left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px;text-align:center">' + l.text + '</p>'; });
    CFG.panels.forEach((p, i) => {
      h += '<div class="seat" style="left:' + p.left + 'px;top:' + p.top + 'px;width:560px;height:' + p.h + 'px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + p.who + '</p>';
      if (i === 0) h += '<p class="lbl" style="left:36px;top:124px">' + T.hp + '</p><div class="pips" style="left:36px;top:164px">' + PIPS(p.pips, 'op') + '</div><div class="chip" style="left:36px;top:236px">' + T.skill + '</div><div class="chip lit demo-lit" style="left:36px;top:236px">' + T.skill + '</div>' + (p.hand ? '<p class="lbl demo-h0" style="left:36px;top:306px"></p>' : '');
      else h += (p.hand ? '<p class="lbl demo-h' + i + '" style="left:36px;top:100px"></p>' : '') + '<div class="pips" style="left:36px;top:146px">' + PIPS(4, 'sp' + i) + '</div>';
      h += '</div>';
    });
    CFG.rings.forEach((r, i) => { h += '<div class="ring demo-ring' + i + '" style="left:' + r[2] + 'px;top:' + r[3] + 'px;width:' + r[4] + 'px;height:' + r[5] + 'px"></div>'; });
    (CFG.tags || []).forEach((g, i) => { h += '<div class="chip demo-tag' + i + '" style="left:' + g.x + 'px;top:' + g.y + 'px">' + g.text + '</div>'; });
    (CFG.marks || []).forEach((m, i) => { h += '<p class="demo-mark' + i + '" style="position:absolute;margin:0;left:' + (m.x - 60) + 'px;top:' + (m.y - 80) + 'px;width:120px;text-align:center;font-family:var(--display);font-size:' + m.size + 'px;font-weight:700;line-height:1;color:var(--accent)">' + m.text + '</p>'; });
    CFG.cards.forEach((c, i) => { FACES[i].forEach((f, k) => { h += f.replace('class="sha', 'class="sha demo-c' + i + 'f' + k); }); });
    CFG.capStarts.forEach((_, i) => { h += '<p class="cap demo-cap' + i + '">' + T.caps[i] + '</p>'; });
    kit.stage.append(kit.h(h + '</div>'));
    this.lit = grab(kit, '.demo-lit').style;
    this.h = CFG.panels.map((p, i) => grab(kit, '.demo-h' + i));
    this.f = CFG.cards.map((c, i) => FACES[i].map((_, k) => grab(kit, '.demo-c' + i + 'f' + k).style));
    this.ring = CFG.rings.map((_, i) => grab(kit, '.demo-ring' + i).style);
    this.tagEl = (CFG.tags || []).map((_, i) => grab(kit, '.demo-tag' + i));
    this.mark = (CFG.marks || []).map((_, i) => grab(kit, '.demo-mark' + i).style);
    this.cap = CFG.capStarts.map((_, i) => grab(kit, '.demo-cap' + i).style);
  },
  render(t) {
    this.lit.opacity = CFG.litAt === 0 ? 1 : eo(seg(t, CFG.litAt, CFG.litAt + 0.4));
    CFG.panels.forEach((p, i) => { if (!p.hand || !this.h[i]) return; let n = p.hand[0][1]; p.hand.forEach((e) => { if (t >= e[0]) n = e[1]; }); this.h[i].textContent = T.hand + ' ' + n; });
    CFG.cards.forEach((c, i) => {
      let pos = c.moves[0].from;
      c.moves.forEach((m) => { if (t >= m.a) { const p = eio(seg(t, m.a, m.b)); pos = [lerp(m.from[0], m.to[0], p), lerp(m.from[1], m.to[1], p) - Math.sin(Math.PI * p) * (m.lift || 0), lerp(m.from[2], m.to[2], p), lerp(m.from[3], m.to[3], p)]; } });
      let fc = 0, sx = 1;
      c.flips.forEach((f, k) => { const q = seg(t, f, f + 0.4); if (q > 0) { sx = q < 1 ? Math.abs(1 - 2 * q) : 1; fc = q >= 0.5 ? k + 1 : fc; } });
      const vis = (c.show ? eo(seg(t, c.show[0], c.show[0] + 0.3)) : 1) * (c.hideAt ? 1 - eio(seg(t, c.hideAt, c.hideAt + 0.3)) : 1);
      this.f[i].forEach((st, k) => { place(st, pos[0], pos[1], pos[2], pos[3], sx); st.opacity = k === fc ? vis : 0; });
    });
    CFG.rings.forEach((r, i) => { this.ring[i].opacity = eo(seg(t, r[0], r[0] + 0.4)) * (r[1] < 90 ? 1 - eio(seg(t, r[1], r[1] + 0.3)) : 1); });
    (CFG.tags || []).forEach((g, i) => {
      const el = this.tagEl[i]; let text = g.text; (g.swaps || []).forEach((s) => { if (t >= s[0]) text = s[1]; });
      if (el.textContent !== text) el.textContent = text;
      el.style.opacity = eo(seg(t, g.a, g.a + 0.4));
      if (g.lit !== undefined) { const k = eo(seg(t, g.lit, g.lit + 0.3)); el.style.background = k > 0.5 ? 'var(--accent)' : 'transparent'; el.style.color = k > 0.5 ? 'var(--ground)' : 'inherit'; el.style.borderColor = k > 0.5 ? 'var(--accent)' : ''; }
    });
    (CFG.marks || []).forEach((m, i) => { this.mark[i].opacity = eo(seg(t, m.a, m.a + 0.2)); this.mark[i].transform = 'scale(' + lerp(1.4, 1, eo(seg(t, m.a, m.a + 0.3))) + ')'; });
    showCaps(this.cap, t, WIN);
  },
});
