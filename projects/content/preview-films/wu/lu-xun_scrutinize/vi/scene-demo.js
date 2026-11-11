// Scrutinize (Lu Xun, Wu), Kingdom Wars: in the Play Phase a red hand card is used as an Amass; each seat of his Kingdom draws 2 then discards 2, from him in turn order. The text of scene-demo.js. The card (♥ 5), the hands of 4 and 3, HP and Seats 2 and 3 as his Kingdom are made up; cards drawn and discarded show as hand counts only, and the Wuxie Kingdom check is left out.
const { seg, eo, eio, lerp } = kit;
const T = {"owner":"Lục Tốn","skill":"Độ thế","hand":"Bài trên tay","hp":"Sinh lực","s2":"Người chơi 2","s3":"Người chơi 3","whoSize":50,"caps":["Giai đoạn ra bài","5♥ thành Dĩ Dật Đãi Lao","Rút 2, bỏ 2","Cùng thế lực làm tương tự"]};
const CFG = {"capStarts":[0,1.5,3,4.5],"hands":[[[0,4],[1.5,3],[3,5],[3.7,3]],[[0,3],[4.5,5],[5.1,3]],[[0,3],[5.9,5],[6.5,3]]],"pops":[[3,"+2",440,480],[3.7,"−2",560,480],[4.5,"+2",1530,330],[5.1,"−2",1630,330],[5.9,"+2",1530,610],[6.5,"−2",1630,610]],"rings":[[3,4.4,130,210,580,520],[4.5,5.8,1190,210,580,260],[5.9,7.2,1190,490,580,260]]};
const FACES = ["<div class=\"sha \"><b class=\"red\" style=\"font-size:96px\">♥</b><span>5</span></div>","<div class=\"sha \"><span style=\"font-size:24px;line-height:1.05;text-align:center;padding:0 6px;font-weight:700\">Dĩ Dật Đãi Lao</span><span class=\"red\" style=\"font-size:28px\">♥ 5</span></div>"];
const place = (st, x, y, s, r, sx) => { st.transform = 'translate(' + (x - 65) + 'px,' + (y - 91) + 'px) rotate(' + r + 'deg) scale(' + s * (sx === undefined ? 1 : sx) + ',' + s + ')'; };
const grab = (kit, sel) => kit.stage.querySelector(sel);
const PIPS = (n, tag) => { let h = ''; for (let i = 0; i < n; i++) h += '<span class="pip"><i class="demo-' + tag + i + '"></i></span>'; return h; };
const showCaps = (caps, t, win) => win.forEach((w, i) => { const a = eo(seg(t, w[0], w[1])); caps[i].opacity = a * (1 - eio(seg(t, w[2], w[3]))); caps[i].transform = 'translateY(' + lerp(18, 0, a) + 'px)'; });
const WIN = CFG.capStarts.map((s, i) => [s, s + 0.4, i + 1 < CFG.capStarts.length ? CFG.capStarts[i + 1] - 0.1 : 99, i + 1 < CFG.capStarts.length ? CFG.capStarts[i + 1] + 0.2 : 100]);
const PANELS = [{ left: 140, top: 220, h: 500, who: T.owner }, { left: 1200, top: 220, h: 240, who: T.s2 }, { left: 1200, top: 500, h: 240, who: T.s3 }];
kit.scene('demo', {
  init(kit) {
    let h = '<div class="ground">';
    PANELS.forEach((p, i) => {
      h += '<div class="seat" style="left:' + p.left + 'px;top:' + p.top + 'px;width:560px;height:' + p.h + 'px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + p.who + '</p>';
      if (i === 0) h += '<p class="lbl" style="left:36px;top:124px">' + T.hp + '</p><div class="pips" style="left:36px;top:164px">' + PIPS(3, 'op') + '</div><div class="chip" style="left:36px;top:236px">' + T.skill + '</div><div class="chip lit demo-lit" style="left:36px;top:236px">' + T.skill + '</div><p class="lbl demo-h0" style="left:36px;top:306px"></p>';
      else h += '<p class="lbl demo-h' + i + '" style="left:36px;top:100px"></p><div class="pips" style="left:36px;top:146px">' + PIPS(4, 'sp' + i) + '</div>';
      h += '</div>';
    });
    CFG.rings.forEach((r, i) => { h += '<div class="ring demo-ring' + i + '" style="left:' + r[2] + 'px;top:' + r[3] + 'px;width:' + r[4] + 'px;height:' + r[5] + 'px"></div>'; });
    CFG.pops.forEach((m, i) => { h += '<p class="demo-pop' + i + '" style="position:absolute;margin:0;left:' + m[2] + 'px;top:' + m[3] + 'px;font-family:var(--display);font-size:84px;font-weight:700;color:var(--accent)">' + m[1] + '</p>'; });
    [224, 448, 560].forEach((x, i) => { h += '<div class="sha bk demo-st' + i + '"></div>'; });
    FACES.forEach((f, k) => { h += f.replace('class="sha', 'class="sha demo-cf' + k); });
    CFG.capStarts.forEach((_, i) => { h += '<p class="cap demo-cap' + i + '">' + T.caps[i] + '</p>'; });
    kit.stage.append(kit.h(h + '</div>'));
    this.lit = grab(kit, '.demo-lit').style;
    this.h = [0, 1, 2].map((i) => grab(kit, '.demo-h' + i));
    this.ring = CFG.rings.map((_, i) => grab(kit, '.demo-ring' + i).style);
    this.pop = CFG.pops.map((_, i) => grab(kit, '.demo-pop' + i).style);
    this.st = [0, 1, 2].map((i) => grab(kit, '.demo-st' + i).style);
    this.cf = FACES.map((_, k) => grab(kit, '.demo-cf' + k).style);
    this.cap = CFG.capStarts.map((_, i) => grab(kit, '.demo-cap' + i).style);
  },
  render(t) {
    this.lit.opacity = eo(seg(t, 1.5, 1.9));
    CFG.hands.forEach((tl, i) => { let n = tl[0][1]; tl.forEach((e) => { if (t >= e[0]) n = e[1]; }); this.h[i].textContent = T.hand + ' ' + n; });
    [224, 448, 560].forEach((x, i) => place(this.st[i], x, 631, 0.74, 0));
    const p = eio(seg(t, 1.5, 2.2)), f = seg(t, 2.2, 2.6), sx = Math.abs(1 - 2 * f), vis = 1 - eio(seg(t, 3, 3.3));
    this.cf.forEach((st, k) => { place(st, lerp(336, 960, p), lerp(631, 430, p) - Math.sin(Math.PI * p) * 60, lerp(0.74, 1, p), 0, sx); st.opacity = (k === (f >= 0.5 ? 1 : 0)) ? vis : 0; });
    CFG.rings.forEach((r, i) => { this.ring[i].opacity = eo(seg(t, r[0], r[0] + 0.4)) * (1 - eio(seg(t, r[1], r[1] + 0.3))); });
    CFG.pops.forEach((m, i) => { const t0 = m[0]; this.pop[i].opacity = eo(seg(t, t0, t0 + 0.2)) * (1 - eio(seg(t, t0 + 0.9, t0 + 1.3))); this.pop[i].transform = 'translateY(' + lerp(0, -50, eo(seg(t, t0, t0 + 1.2))) + 'px)'; });
    showCaps(this.cap, t, WIN);
  },
});
