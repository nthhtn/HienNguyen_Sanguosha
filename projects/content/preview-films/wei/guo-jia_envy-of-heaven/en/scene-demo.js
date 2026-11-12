// Envy of Heaven (Guo Jia, Wei): a judgment of his own is turned up, takes effect, and he takes the judgment card into his hand.
// The text of scene-demo.js. The judgment card (♠ 5), the hand of 3 and the HP are made up and are listed as such in the hand-over.
const { seg, eo, eio, lerp } = kit;
const T = {"owner": "Guo Jia", "hp": "HP", "skill": "Envy of Heaven", "judgment": "Judgment", "hand": "Hand", "c1": "Guo Jia's judgment card is turned up", "c2": "The judgment takes effect", "c3": "Envy of Heaven: Guo Jia takes the card", "whoSize": 64};
const place = (st, x, y, s, r, sx) => { st.transform = 'translate(' + (x - 65) + 'px,' + (y - 91) + 'px) rotate(' + r + 'deg) scale(' + s * (sx === undefined ? 1 : sx) + ',' + s + ')'; };
const PIP = '<span class="pip"><i></i></span>';
const CARD = (cls, glyph, rank, red) => '<div class="sha ' + cls + '"><b' + (red ? ' class="red"' : '') + ' style="font-size:96px">' + glyph + '</b><span>' + rank + '</span></div>';
kit.scene('demo', {
  init(kit) {
    let backs = '';
    for (let i = 0; i < 3; i++) backs += '<div class="cback" style="left:' + (36 + i * 112) + 'px;top:346px"></div>';
    kit.stage.append(kit.h('<div class="ground">' +
      '<div class="seat" style="left:140px;top:220px;width:560px;height:500px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + T.owner + '</p>' +
      '<p class="lbl" style="left:36px;top:124px">' + T.hp + '</p><div class="pips" style="left:36px;top:164px">' + PIP + PIP + PIP + '</div>' +
      '<div class="chip" style="left:36px;top:236px">' + T.skill + '</div><div class="chip lit demo-lit" style="left:36px;top:236px">' + T.skill + '</div>' +
      '<p class="lbl demo-hand" style="left:36px;top:306px"></p>' + backs + '</div>' +
      '<p class="lbl" style="position:absolute;margin:0;left:1380px;top:34px;width:200px;text-align:center">' + T.judgment + '</p>' +
      '<div class="ring demo-ring" style="left:1407px;top:84px;width:146px;height:192px"></div>' +
      '<div class="sha bk demo-jb"></div>' + CARD('demo-jf', '♠', '5', false) +
      '<p class="cap demo-c1">' + T.c1 + '</p><p class="cap demo-c2">' + T.c2 + '</p><p class="cap demo-c3">' + T.c3 + '</p></div>'));
    const q = s => kit.stage.querySelector(s);
    this.lit = q('.demo-lit').style; this.hand = q('.demo-hand'); this.ring = q('.demo-ring').style;
    this.jb = q('.demo-jb').style; this.jf = q('.demo-jf').style;
    this.cap = [q('.demo-c1').style, q('.demo-c2').style, q('.demo-c3').style];
  },
  render(t) {
    const f = seg(t, 0.4, 0.9), sx = Math.abs(1 - 2 * f);       // beat 1: the judgment card flips over
    this.jb.opacity = f < 0.5 ? 1 : 0;
    this.jf.opacity = f < 0.5 ? 0 : 1;
    place(this.jb, 1480, 180, 0.9, 0, sx);
    const r = eo(seg(t, 1.6, 2.3));                               // beat 2: it takes effect, a ring pulses
    this.ring.opacity = eo(seg(t, 1.6, 1.9)) * (1 - eio(seg(t, 2.3, 2.8)));
    this.ring.transform = 'scale(' + lerp(0.9, 1.0, r) + ')';
    this.lit.opacity = eo(seg(t, 3.0, 3.4));                      // beat 3: the skill lights and the card is taken
    const p = eio(seg(t, 3.4, 4.4));
    place(this.jf, lerp(1480, 560, p), lerp(180, 631, p) - Math.sin(Math.PI * p) * 90, lerp(0.9, 0.74, p), lerp(0, -5, p), sx);
    this.hand.textContent = T.hand + (t < 4.4 ? ' 3' : ' 4');
    const win = [[0.0, 0.4, 1.3, 1.6], [1.6, 2.0, 2.9, 3.2], [3.0, 3.4, 99, 100]];   // captions, one window per beat
    win.forEach((w, i) => { const a = eo(seg(t, w[0], w[1])); this.cap[i].opacity = a * (1 - eio(seg(t, w[2], w[3]))); this.cap[i].transform = 'translateY(' + lerp(18, 0, a) + 'px)'; });
  },
});
