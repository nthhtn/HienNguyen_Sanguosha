// Bequeathed Strategy (Guo Jia, Wei): he suffers 1 damage, looks at the top 2 cards of the Draw Pile, gives one to a player, then the other to a player.
// The text of scene-demo.js. The two card faces, the HP, the hand sizes and who gets each card are made up and are listed as such in the hand-over.
const { seg, eo, eio, lerp } = kit;
const T = {"owner": "Quách Gia", "other": "Người chơi 2", "hp": "Sinh lực", "skill": "Di kế", "pile": "Chồng bài rút", "hand": "Bài trên tay", "c1": "Quách Gia chịu 1 sát thương", "c2": "Xem 2 lá trên cùng của chồng bài rút", "c3": "Đưa một lá cho một người chơi bất kỳ", "c4": "Lá còn lại cũng đưa cho một người chơi", "whoSize": 56};
const place = (st, x, y, s, r, sx) => { st.transform = 'translate(' + (x - 65) + 'px,' + (y - 91) + 'px) rotate(' + r + 'deg) scale(' + s * (sx === undefined ? 1 : sx) + ',' + s + ')'; };
const PIP = '<span class="pip"><i></i></span>';
const CARD = (cls, glyph, rank, red) => '<div class="sha ' + cls + '"><b' + (red ? ' class="red"' : '') + ' style="font-size:96px">' + glyph + '</b><span>' + rank + '</span></div>';
const PILE = { x: 960, y: 590 }, A_REST = 860, B_REST = 1060, OWN_SLOT = { x: 560, y: 631 }, SEAT2_SLOT = { x: 1688, y: 461 };
kit.scene('demo', {
  init(kit) {
    let own = '', other = '';
    for (let i = 0; i < 3; i++) own += '<div class="cback" style="left:' + (36 + i * 112) + 'px;top:346px"></div>';
    for (let i = 0; i < 2; i++) other += '<div class="cback" style="left:' + (300 + i * 70) + 'px;top:96px"></div>';
    kit.stage.append(kit.h('<div class="ground">' +
      '<div class="seat demo-s1" style="left:140px;top:220px;width:560px;height:500px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + T.owner + '</p>' +
      '<p class="lbl" style="left:36px;top:124px">' + T.hp + '</p><div class="pips" style="left:36px;top:164px">' + PIP + PIP + '<span class="pip"><i class="demo-p3"></i></span></div>' +
      '<div class="chip" style="left:36px;top:236px">' + T.skill + '</div><div class="chip lit demo-lit" style="left:36px;top:236px">' + T.skill + '</div>' +
      '<p class="lbl demo-h1" style="left:36px;top:306px"></p>' + own + '</div>' +
      '<div class="seat" style="left:1200px;top:300px;width:560px;height:260px"><p class="who" style="left:36px;top:30px;font-size:' + T.whoSize + 'px">' + T.other + '</p>' +
      '<p class="lbl" style="left:36px;top:124px">' + T.hp + '</p><div class="pips" style="left:36px;top:164px">' + PIP + PIP + PIP + PIP + '</div>' +
      '<p class="lbl demo-h2" style="left:36px;top:216px"></p>' + other + '</div>' +
      '<p class="lbl" style="position:absolute;margin:0;left:' + (PILE.x - 140) + 'px;top:462px;width:280px;text-align:center">' + T.pile + '</p>' +
      '<div class="sha bk demo-pile"></div>' +
      '<div class="sha bk demo-ab"></div>' + CARD('demo-af', '♣', '8', false) +
      '<div class="sha bk demo-bb"></div>' + CARD('demo-bf', '♥', '3', true) +
      '<p class="demo-dmg" style="position:absolute;margin:0;left:440px;top:330px;font-family:var(--display);font-size:84px;font-weight:700;color:var(--accent)">-1</p>' +
      '<p class="cap demo-c1">' + T.c1 + '</p><p class="cap demo-c2">' + T.c2 + '</p><p class="cap demo-c3">' + T.c3 + '</p><p class="cap demo-c4">' + T.c4 + '</p></div>'));
    const q = s => kit.stage.querySelector(s);
    this.s1 = q('.demo-s1').style; this.p3 = q('.demo-p3').style; this.lit = q('.demo-lit').style; this.dmg = q('.demo-dmg').style;
    this.h1 = q('.demo-h1'); this.h2 = q('.demo-h2'); this.pile = q('.demo-pile').style;
    this.ab = q('.demo-ab').style; this.af = q('.demo-af').style; this.bb = q('.demo-bb').style; this.bf = q('.demo-bf').style;
    this.cap = ['.demo-c1', '.demo-c2', '.demo-c3', '.demo-c4'].map(s => q(s).style);
  },
  render(t) {
    place(this.pile, PILE.x, PILE.y, 0.8, 0);
    const t0 = 0.4;                                                  // beat 1: the damage, a shake, a number, one pip empties
    this.s1.transform = 'translateX(' + (t > t0 ? Math.sin((t - t0) * 55) * 14 * (1 - seg(t, t0, t0 + 0.6)) : 0) + 'px)';
    this.p3.opacity = 1 - eo(seg(t, t0 + 0.1, t0 + 0.3));
    this.dmg.opacity = eo(seg(t, t0, t0 + 0.2)) * (1 - eio(seg(t, t0 + 0.9, t0 + 1.3)));
    this.dmg.transform = 'translateY(' + lerp(0, -50, eo(seg(t, t0, t0 + 1.2))) + 'px)';
    this.lit.opacity = eo(seg(t, 1.6, 2.0));                         // beat 2: the skill lights, the top 2 cards slide out and flip
    const shown = t >= 1.6;
    const slide = eio(seg(t, 1.8, 2.4)), flip = seg(t, 2.4, 2.9), up = flip >= 0.5;
    // Card A: out of the pile, face up, then to Seat 2 (beat 3), turning face down on the way (the others do not see it).
    const pA = eio(seg(t, 3.8, 4.7)), fA = seg(t, 4.3, 4.7), faceA = up && fA < 0.5;
    place(this.ab, lerp(lerp(PILE.x, A_REST, slide), SEAT2_SLOT.x, pA), lerp(PILE.y, SEAT2_SLOT.y, pA) - Math.sin(Math.PI * pA) * 90, lerp(0.8, 0.74, pA), lerp(0, 5, pA), Math.abs(1 - 2 * flip) * Math.abs(1 - 2 * fA));
    place(this.af, lerp(lerp(PILE.x, A_REST, slide), SEAT2_SLOT.x, pA), lerp(PILE.y, SEAT2_SLOT.y, pA) - Math.sin(Math.PI * pA) * 90, lerp(0.8, 0.74, pA), lerp(0, 5, pA), Math.abs(1 - 2 * flip) * Math.abs(1 - 2 * fA));
    this.ab.opacity = shown && !faceA ? 1 : 0; this.af.opacity = shown && faceA ? 1 : 0;
    // Card B: out of the pile, face up, then into Guo Jia's own hand (beat 4).
    const pB = eio(seg(t, 5.6, 6.5));
    const bx = lerp(lerp(PILE.x, B_REST, slide), OWN_SLOT.x, pB), by = lerp(PILE.y, OWN_SLOT.y, pB) - Math.sin(Math.PI * pB) * 90, bs = lerp(0.8, 0.74, pB), br = lerp(0, -5, pB), bsx = Math.abs(1 - 2 * flip);
    place(this.bb, bx, by, bs, br, bsx); place(this.bf, bx, by, bs, br, bsx);
    this.bb.opacity = shown && !up ? 1 : 0; this.bf.opacity = shown && up ? 1 : 0;
    this.h1.textContent = T.hand + (t < 6.5 ? ' 3' : ' 4');
    this.h2.textContent = T.hand + (t < 4.7 ? ' 2' : ' 3');
    const win = [[0.0, 0.4, 1.4, 1.7], [1.6, 2.0, 3.4, 3.7], [3.6, 4.0, 5.2, 5.5], [5.4, 5.8, 99, 100]];   // captions, one window per beat
    win.forEach((w, i) => { const a = eo(seg(t, w[0], w[1])); this.cap[i].opacity = a * (1 - eio(seg(t, w[2], w[3]))); this.cap[i].transform = 'translateY(' + lerp(18, 0, a) + 'px)'; });
  },
});
