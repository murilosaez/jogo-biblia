// Testes do pacote A1 (arte/quadrupede.js): quadrúpedes em 3 vistas, crocodilo, variantes dos raros e o
// esqueleto exposto para as montarias. Rode só estes com
//   node tests/logica.test.js arte/quadrupede
"use strict";

module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual }) {
  const nova = () => {
    const j = carregarJogo();
    const Arte = carregarArte(j.ctx);
    return { Arte, PP: j.ctx.PIXEL_PATTERNS, M: Arte.motor };
  };
  const MEDIOS = ["al_cao", "al_ovelha", "in_lobo", "in_chacal", "in_hiena", "in_cabra", "in_javali"];
  const GRANDES = ["in_leao", "in_urso", "in_leopardo", "in_crocodilo"];
  const TODOS = MEDIOS.concat(GRANDES);
  // caixa do desenho (com o contorno)
  function caixa(px) {
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    px.data.forEach((c, i) => { if (!c) return; const x = i % px.w, y = (i / px.w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
    return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  teste("arte/quadrupede: 11 espécies no contrato de 3 vistas × 8 quadros, células e campos da def", () => {
    const { Arte, PP, M } = nova();
    for (const k of TODOS) {
      const def = PP[k];
      assert.ok(def, `${k} registrado`);
      igual([def.direcoes, def.quadrosPorVista, def.quadros], [3, 8, 24], `${k}: vistas e quadros`);
      igual([def.ciclo, def.quadroAcao], [[2, 3, 4, 5], [6, 7]], `${k}: ciclo e ação`);
      igual(def.contorno, k.startsWith("al_") ? "amigo" : "hostil", `${k}: contorno`);
      assert.ok(!def.humano, `${k}: criatura sem humano: true`);
      assert.ok(def.sombra && def.sombra.w >= 24 && def.sombra.h >= 8 && def.sombra.w % 2 === 0 && def.sombra.h % 2 === 0, `${k}: sombra`);
      assert.ok(def.alturaCabeca >= 20 && def.alturaCabeca <= def.h * 2, `${k}: alturaCabeca`);
      igual(typeof def.variante, "function", `${k}: variante`);
      const lado = GRANDES.includes(k) ? 64 : 48;
      const px = Arte.pixels(k, { quadro: 0 });
      igual([px.w, px.h], [lado, lado], `${k}: célula`);
      igual(px.w, def.w * 2, `${k}: px.w = def.w × 2`);
    }
    igual(typeof M.animal, "function");
    for (const n of ["jumento", "cavalo", "camelo", "lobo", "leao"]) assert.ok(M.ANATOMIAS[n], `anatomia ${n}`);
    igual(Arte.validar(), []);
  });

  teste("arte/quadrupede: vistas diferentes, passo de 4 fases, golpe, nada cortado na borda e desenho px a px", () => {
    const { Arte, PP } = nova();
    for (const k of TODOS) {
      const q = Array.from({ length: 24 }, (_, i) => Arte.pixels(k, { quadro: i }));
      const txt = q.map((p) => p.data.join());
      // as três vistas são desenhos diferentes
      assert.ok(txt[0] !== txt[8] && txt[0] !== txt[16] && txt[8] !== txt[16], `${k}: vistas diferentes`);
      for (let v = 0; v < 3; v++) {
        const b = v * 8;
        // os 4 quadros do passo diferem do parado e entre si; antecipação e golpe diferem de tudo
        igual(new Set([0, 2, 3, 4, 5, 6, 7].map((i) => txt[b + i])).size, 7, `${k}: vista ${v}, quadros 0 e 2 a 7 distintos`);
        assert.notStrictEqual(txt[b + 1], txt[b], `${k}: vista ${v}, respirar`);
      }
      for (let i = 0; i < 24; i++) {
        const p = q[i];
        // 1 px livre para o contorno: na borda da célula só pode haver contorno (nada de miolo cortado)
        for (let x = 0; x < p.w; x++) for (const y of [0, p.h - 1]) assert.ok(!p.data[y * p.w + x] || p.borda[y * p.w + x], `${k}#${i}: miolo na borda (${x}, ${y})`);
        for (let y = 0; y < p.h; y++) for (const x of [0, p.w - 1]) assert.ok(!p.data[y * p.w + x] || p.borda[y * p.w + x], `${k}#${i}: miolo na borda (${x}, ${y})`);
        // os pés ficam no pé da célula (o jogo ancora pela base); o recuo e o bote saem do lugar de propósito
        if (i % 8 < 6) assert.ok(caixa(p).y1 >= p.h - 8, `${k}#${i}: base do desenho em ${caixa(p).y1}`);
      }
      // desenho px a px: há blocos de unidade (2 × 2) com mais de uma cor por toda parte
      const p0 = q[0];
      let mistos = 0, cheios = 0;
      for (let y = 0; y < p0.h; y += 2) for (let x = 0; x < p0.w; x += 2) {
        const c = [p0.data[y * p0.w + x], p0.data[y * p0.w + x + 1], p0.data[(y + 1) * p0.w + x], p0.data[(y + 1) * p0.w + x + 1]];
        if (c.some(Boolean)) { cheios++; if (new Set(c).size > 1) mistos++; }
      }
      assert.ok(mistos / cheios > 0.4, `${k}: ${mistos} de ${cheios} blocos com mais de uma cor`);
      // rampa de verdade: pelo menos 12 cores no miolo e não mais que o limite
      const cores = new Set(p0.data.filter((c, i) => c && !p0.borda[i])).size;
      assert.ok(cores >= 12 && cores <= 64, `${k}: ${cores} cores`);
      assert.ok(!PP[k].humano);
    }
  });

  teste("arte/quadrupede: porte do lobo e do leão, variante dos raros e esqueleto para as montarias", () => {
    const { Arte, PP, M } = nova();
    const alt = (k, v) => caixa(Arte.pixels(k, { quadro: v * 8 })).h;
    // lobo: de lado tem pelo menos 26 px da orelha à pata
    assert.ok(alt("in_lobo", 0) >= 26, `lobo de lado: ${alt("in_lobo", 0)} px`);
    // leão: maior que o lobo em tudo; de lado o corpo é comprido (a célula de 64 limita a altura a ~30 px)
    // e de frente/costas, em escorço, passa de 36 e de 40 px
    assert.ok(alt("in_leao", 0) >= 28 && alt("in_leao", 0) > alt("in_lobo", 0), `leão de lado: ${alt("in_leao", 0)} px`);
    assert.ok(alt("in_leao", 1) >= 34, `leão de frente: ${alt("in_leao", 1)} px`);
    assert.ok(alt("in_leao", 2) >= 40, `leão de costas: ${alt("in_leao", 2)} px`);
    assert.ok(caixa(Arte.pixels("in_leao", { quadro: 0 })).w >= 48, "leão transborda a casa de 32 px");
    assert.ok(caixa(Arte.pixels("in_lobo", { quadro: 0 })).w >= 36, "lobo transborda a casa de 32 px");
    // o crocodilo é rasteiro: bem mais comprido que alto
    const cr = caixa(Arte.pixels("in_crocodilo", { quadro: 0 }));
    assert.ok(cr.w >= 48 && cr.h <= 22, `crocodilo ${cr.w} × ${cr.h}`);
    // variante: raro nomeado redesenhado no porte e na cor (sem escala fracionária nem tinta por cima)
    const v = Arte.garantirVariante("in_lobo", { escala: 1.35, tinta: "#d8d4cc" });
    igual(v, "in_lobo~v:d8d4cc.135");
    const pv = Arte.pixels(v, { quadro: 0 }), pb = Arte.pixels("in_lobo", { quadro: 0 });
    igual([PP[v].quadros, PP[v].direcoes, pv.w, pv.h], [24, 3, 66, 66]);
    assert.ok(caixa(pv).w > caixa(pb).w * 1.25, "variante maior, desenhada no porte");
    assert.ok(PP[v].sombra.w > PP.in_lobo.sombra.w && PP[v].alturaCabeca > PP.in_lobo.alturaCabeca, "sombra e altura acompanham o porte");
    const soMiolo = (p) => new Set(p.data.filter((c, i) => c && !p.borda[i]));
    assert.ok([...soMiolo(pv)].some((c) => !soMiolo(pb).has(c)), "pelagem tingida");
    for (let i = 0; i < 24; i++) { const p = Arte.pixels(v, { quadro: i }); for (let x = 0; x < p.w; x++) assert.ok(!p.data[x] || p.borda[x], `variante#${i}: cortada em cima`); }
    // esqueleto para o montado: desenha numa grade qualquer, devolve as âncoras e parte em fundo + frente
    for (const nome of ["jumento", "cavalo", "camelo"]) {
      for (let vista = 0; vista < 3; vista++) {
        const g = new M.Grade(36, 40);
        const r = M.animal(g, vista, 0, nome, {});
        assert.ok(Array.isArray(r.sela) && r.sela[0] > 4 && r.sela[0] < 68 && r.sela[1] > 4 && r.sela[1] < 76, `${nome}: sela em ${r.sela}`);
        assert.ok(Array.isArray(r.cabeca) && typeof r.tela === "function", `${nome}: âncoras`);
        const cheio = g.final();
        const n = cheio.filter(Boolean).length;
        assert.ok(n > 500, `${nome} vista ${vista}: ${n} px`);
        const gf = new M.Grade(36, 40), gt = new M.Grade(36, 40);
        M.animal(gf, vista, 0, nome, { parte: "fundo" });
        M.animal(gt, vista, 0, nome, { parte: "frente" });
        const a = gf.final(), b = gt.final();
        let soma = 0, ambos = 0;
        for (let i = 0; i < cheio.length; i++) { if (a[i] || b[i]) soma++; if (a[i] && b[i]) ambos++; }
        igual([soma, ambos], [n, 0], `${nome} vista ${vista}: fundo + frente = inteiro`);
        assert.ok(a.some(Boolean) && b.some(Boolean), `${nome} vista ${vista}: as duas partes existem`);
      }
      assert.ok(PP["pv_animal_" + nome] && PP["pv_animal_" + nome].quadros === 24, `prévia pv_animal_${nome}`);
    }
  });
};
