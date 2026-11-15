// Testes do pacote A2 (arte/ave-serpente.js): abutre, águia, corvo, víbora e naja no contrato novo de
// 3 vistas × 8 quadros. Rode só estes com
//   node tests/logica.test.js arte/ave-serpente
"use strict";

module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual }) {
  const AVES = { in_abutre: 48, in_aguia: 48, in_corvo: 40 };
  const SERPENTES = { in_vibora: 48, in_naja: 48 };
  const TODAS = Object.assign({}, AVES, SERPENTES);
  const nova = () => {
    const j = carregarJogo();
    const Arte = carregarArte(j.ctx);
    return { Arte, PP: j.ctx.PIXEL_PATTERNS };
  };
  const solido = (c) => !!c && c.length < 8; // px da camada principal (a sombra projetada traz alfa)
  // caixa da silhueta (miolo, sem contorno e sem sombra) de um quadro
  function caixa(px) {
    let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1, n = 0;
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
      const i = y * px.w + x;
      if (!solido(px.data[i]) || px.borda[i]) continue;
      n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, x1, y0, y1, n };
  }
  const diferenca = (a, b) => { let d = 0; for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) d++; return d; };

  teste("arte/ave-serpente: as cinco chaves seguem o contrato de 3 vistas x 8 quadros, com sombra, altura e contorno hostil", () => {
    const { Arte, PP } = nova();
    for (const [chave, lado] of Object.entries(TODAS)) {
      const def = PP[chave];
      assert.ok(def, `${chave} registrado`);
      igual([def.direcoes, def.quadrosPorVista, def.quadros], [3, 8, 24], `${chave}: vistas e quadros`);
      igual([def.ciclo, def.quadroAcao], [[2, 3, 4, 5], [6, 7]], `${chave}: ciclo e ação`);
      igual([def.w * def.res, def.h * def.res], [lado, lado], `${chave}: célula`);
      igual([def.contorno, def.origem], ["hostil", [0.5, 1]], `${chave}: contorno e origem`);
      assert.ok(!def.humano, `${chave}: criatura não é humano`);
      assert.ok(def.sombra && def.sombra.w >= 12 && def.sombra.h >= 4 && def.sombra.w <= lado, `${chave}: sombra do chão declarada`);
      assert.ok(def.alturaCabeca >= 20 && def.alturaCabeca <= lado, `${chave}: alturaCabeca`);
      igual(typeof def.variante, "function", `${chave}: variante`);
      assert.ok(def.acabamento === false, `${chave}: sombreado próprio, sem acabamento automático`);
      for (let q = 0; q < 24; q++) {
        const px = Arte.pixels(chave, { quadro: q });
        igual([px.w, px.h], [lado, lado], `${chave}#${q}: px`);
        const c = caixa(px);
        assert.ok(c.n >= 120, `${chave}#${q}: desenho vazio ou miúdo (${c.n} px)`);
        // 1 px livre em volta para o contorno não ser cortado
        assert.ok(c.x0 >= 1 && c.y0 >= 1 && c.x1 <= px.w - 2 && c.y1 <= px.h - 2, `${chave}#${q}: silhueta encosta na borda [${c.x0},${c.y0},${c.x1},${c.y1}]`);
        const cores = new Set();
        for (let i = 0; i < px.data.length; i++) if (solido(px.data[i]) && !px.borda[i]) cores.add(px.data[i]);
        assert.ok(cores.size >= 8 && cores.size <= 64, `${chave}#${q}: ${cores.size} cores no miolo`);
        assert.ok(px.borda.some(Boolean), `${chave}#${q}: sem contorno`);
      }
    }
    igual(Arte.validar().filter((p) => Object.keys(TODAS).some((k) => p.startsWith(k))), [], "validar");
  });

  teste("arte/ave-serpente: as três vistas são desenhos diferentes e o ciclo e o golpe mudam de quadro para quadro", () => {
    const { Arte } = nova();
    for (const chave of Object.keys(TODAS)) {
      const q = (n) => Arte.pixels(chave, { quadro: n });
      // vistas: lado, frente e costas não se repetem
      for (const [a, b] of [[0, 8], [0, 16], [8, 16]]) assert.ok(diferenca(q(a), q(b)) > 150, `${chave}: vistas ${a / 8} e ${b / 8} iguais`);
      for (let v = 0; v < 3; v++) {
        const b = v * 8;
        // as 4 fases do ciclo são distintas entre si, e a respiração difere do parado
        for (let i = 2; i <= 5; i++) for (let k = i + 1; k <= 5; k++) assert.ok(diferenca(q(b + i), q(b + k)) > 40, `${chave} vista ${v}: fases ${i} e ${k} iguais`);
        assert.ok(diferenca(q(b), q(b + 1)) > 8, `${chave} vista ${v}: respirar igual ao parado`);
        // antecipação e golpe diferem do parado e um do outro
        assert.ok(diferenca(q(b), q(b + 6)) > 60 && diferenca(q(b), q(b + 7)) > 60 && diferenca(q(b + 6), q(b + 7)) > 60, `${chave} vista ${v}: golpe`);
      }
      // o desenho é o mesmo a cada geração (nada de acaso)
      const antes = q(3).data.join();
      Arte.motor.limparCaches(chave);
      igual(q(3).data.join() === antes, true, `${chave}: geração determinística`);
    }
  });

  teste("arte/ave-serpente: ave voa acima do chão sem sombra colada; serpente rasteja junto ao chão", () => {
    const { Arte } = nova();
    for (const [chave, lado] of Object.entries(AVES)) {
      for (let v = 0; v < 3; v++) {
        // parado e ciclo: o ponto mais baixo fica pelo menos 5 px acima da linha dos pés
        for (const i of [0, 1, 2, 3, 4, 5]) {
          const px = Arte.pixels(chave, { quadro: v * 8 + i });
          const c = caixa(px);
          assert.ok(lado - 1 - c.y1 >= 5, `${chave}#${v * 8 + i}: corpo a ${lado - 1 - c.y1} px do chão`);
          // a sombra de chão é do jogo (def.sombra): nada na camada de sombra
          assert.ok(!px.data.some((cor) => cor && cor.length > 7), `${chave}#${v * 8 + i}: sombra desenhada no sprite`);
        }
      }
      // frente e costas simétricas: a silhueta espelhada coincide em quase tudo
      for (const b of [8, 16]) {
        const px = Arte.pixels(chave, { quadro: b + 3 });
        let igualE = 0, total = 0;
        for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
          const a = solido(px.data[y * px.w + x]), e = solido(px.data[y * px.w + px.w - 1 - x]);
          if (a || e) { total++; if (a && e) igualE++; }
        }
        assert.ok(igualE / total > 0.9, `${chave}#${b + 3}: asas assimétricas (${(igualE / total).toFixed(2)})`);
      }
      // de lado a batida muda a altura da asa: a silhueta no alto (fase 2) sobe mais que embaixo (fase 4)
      assert.ok(caixa(Arte.pixels(chave, { quadro: 2 })).y0 < caixa(Arte.pixels(chave, { quadro: 4 })).y0 - 2, `${chave}: batida de lado`);
    }
    for (const [chave, lado] of Object.entries(SERPENTES)) {
      for (let v = 0; v < 3; v++) for (const i of [0, 2, 3, 4, 5]) {
        const c = caixa(Arte.pixels(chave, { quadro: v * 8 + i }));
        assert.ok(lado - 1 - c.y1 <= 8, `${chave}#${v * 8 + i}: corpo longe do chão (${lado - 1 - c.y1} px)`);
      }
      // de frente e de costas o corpo corre no eixo vertical; de lado, no horizontal
      const l = caixa(Arte.pixels(chave, { quadro: 0 }));
      assert.ok(l.x1 - l.x0 > 30, `${chave}: de lado o corpo é comprido na horizontal`);
      for (const b of [8, 16]) {
        const c = caixa(Arte.pixels(chave, { quadro: b }));
        assert.ok(c.y1 - c.y0 > 26 && c.y1 - c.y0 > c.x1 - c.x0 - 6, `${chave}#${b}: de frente/costas o corpo corre na vertical`);
      }
    }
    // a naja ergue o capuz: de lado é bem mais alta que a víbora
    const alt = (k) => { const c = caixa(Arte.pixels(k, { quadro: 0 })); return c.y1 - c.y0; };
    assert.ok(alt("in_naja") > alt("in_vibora") + 8, "naja erguida");
  });

  teste("arte/ave-serpente: variante de raro nomeado redesenha no porte e na cor, sem escala fracionária", () => {
    const { Arte, PP } = nova();
    for (const [chave, lado] of Object.entries(TODAS)) {
      const v = Arte.garantirVariante(chave, { escala: 1.4, tinta: "#9088b0" });
      igual(v, `${chave}~v:9088b0.140`, `${chave}: chave da variante`);
      const def = PP[v];
      igual([def.direcoes, def.quadrosPorVista, def.quadros], [3, 8, 24], `${v}: contrato`);
      const L = def.w * def.res;
      assert.ok(L >= Math.floor(lado * 1.4) && L <= Math.ceil(lado * 1.4) + 2 && L === def.h * def.res, `${v}: célula de ${L} px`);
      assert.ok(def.sombra.w > PP[chave].sombra.w && def.alturaCabeca > PP[chave].alturaCabeca, `${v}: sombra e altura crescem`);
      const base = caixa(Arte.pixels(chave, { quadro: 8 })), gr = caixa(Arte.pixels(v, { quadro: 8 }));
      assert.ok(gr.n > base.n * 1.6, `${v}: desenho maior (${base.n} → ${gr.n} px)`);
      assert.ok(gr.x0 >= 1 && gr.y0 >= 1 && gr.x1 <= L - 2 && gr.y1 <= L - 2, `${v}: cabe na célula`);
      // a tinta entra na paleta: as cores mudam
      const cores = (k) => new Set(Arte.pixels(k, { quadro: 8 }).data.filter(solido));
      const cb = cores(chave), cv = cores(v);
      assert.ok([...cv].filter((c) => !cb.has(c)).length >= 6, `${v}: paleta tingida`);
      // só o porte, sem tinta: mesma paleta do corpo
      const so = Arte.garantirVariante(chave, { escala: 1.35 });
      igual(so, `${chave}~v:.135`);
      for (let q = 0; q < 24; q++) {
        const c = caixa(Arte.pixels(v, { quadro: q }));
        assert.ok(c.x0 >= 1 && c.y0 >= 1 && c.x1 <= L - 2 && c.y1 <= L - 2, `${v}#${q}: encosta na borda`);
      }
    }
    igual(Arte.validar().filter((p) => /in_(abutre|aguia|corvo|vibora|naja)/.test(p)), [], "validar com as variantes");
  });
};
