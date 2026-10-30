// Dark Sorcery (Zhang Jiao, Qun): a judgment shows a heart, Zhang Jiao swaps in a black card and takes the old one.
// The text of modules/scene-demo.js. Rank and suit values are made up and are listed as such in the hand-over.
const { seg, eo, eio, lerp } = kit;
const place = (st, x, y, s, r, sx) => { st.transform = 'translate(' + (x - 65) + 'px,' + (y - 91) + 'px) rotate(' + r + 'deg) scale(' + s * (sx === undefined ? 1 : sx) + ',' + s + ')'; };
const PIP = '<span class="pip"><i></i></span>';
const CARD = (cls, glyph, rank, red) => '<div class="sha ' + cls + '"><b' + (red ? ' class="red"' : '') + ' style="font-size:96px">' + glyph + '</b><span>' + rank + '</span></div>';
kit.scene('demo', {
  init(kit) {
    let backs = '';
    for (let i = 0; i < 2; i++) backs += '<div class="cback" style="left:' + (36 + i * 112) + 'px;top:346px"></div>';
    kit.stage.append(kit.h('<div class="ground">' +
      '<div class="seat" style="left:140px;top:220px;width:560px;height:500px"><p class="who" style="left:36px;top:30px;font-size:64px">Zhang Jiao</p>' +
      '<p class="lbl" style="left:36px;top:124px">HP</p><div class="pips" style="left:36px;top:164px">' + PIP + PIP + PIP + '</div>' +
      '<div class="chip" style="left:36px;top:236px">Dark Sorcery</div><div class="chip lit demo-lit" style="left:36px;top:236px">Dark Sorcery</div>' +
      '<p class="lbl" style="left:36px;top:306px">Hand 3</p>' + backs + '</div>' +
      '<div class="seat" style="left:1200px;top:300px;width:560px;height:260px"><p class="who" style="left:36px;top:30px;font-size:64px">Seat 2</p>' +
      '<p class="lbl" style="left:36px;top:124px">HP</p><div class="pips" style="left:36px;top:164px">' + PIP + PIP + PIP + PIP + '</div></div>' +
      '<p class="lbl" style="position:absolute;margin:0;left:1380px;top:60px;width:200px;text-align:center">Judgment</p>' +
      '<div class="sha bk demo-jb"></div>' + CARD('demo-jf', '♥', '7', true) + CARD('demo-kc', '♣', 'K', false) +
      '<p class="cap demo-c1">Before the judgment takes effect, swap it</p><p class="cap demo-c2">The old card goes into the hand</p></div>'));
    const q = s => kit.stage.querySelector(s);
    this.lit = q('.demo-lit').style; this.jb = q('.demo-jb').style; this.jf = q('.demo-jf').style; this.kc = q('.demo-kc').style;
    this.c1 = q('.demo-c1').style; this.c2 = q('.demo-c2').style;
  },
  render(t) {
    const f = seg(t, 0.4, 0.9), sx = Math.abs(1 - 2 * f);   // the judgment flips over
    this.jb.opacity = f < 0.5 ? 1 : 0;
    this.jf.opacity = f < 0.5 ? 0 : 1;
    place(this.jb, 1480, 180, 0.9, 0, sx);
    const p = eio(seg(t, 1.8, 2.6));                          // the swap: two cards cross
    place(this.jf, lerp(1480, 448, p), lerp(180, 631, p) + Math.sin(Math.PI * p) * 50, lerp(0.9, 0.74, p), lerp(0, -6, p), sx);
    place(this.kc, lerp(448, 1480, p), lerp(631, 180, p) - Math.sin(Math.PI * p) * 90, lerp(0.74, 0.9, p), lerp(0, 5, p));
    this.lit.opacity = eo(seg(t, 1.0, 1.4));
    const a = eo(seg(t, 1.0, 1.4));                           // captions, one window per beat
    this.c1.opacity = a * (1 - eio(seg(t, 2.7, 3.0)));
    this.c1.transform = 'translateY(' + lerp(18, 0, a) + 'px)';
    const b = eo(seg(t, 3.0, 3.4));
    this.c2.opacity = b;
    this.c2.transform = 'translateY(' + lerp(18, 0, b) + 'px)';
  },
});
