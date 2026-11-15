// Testes do pacote H2 (arte/humano-equip.js): equipamento do humano novo e ativação nas chaves reais
// (25 NPCs pj_*, 14 inimigos humanos in_* e o jogador paramétrico). Rode só estes com
//   node tests/logica.test.js arte/humano-equip
"use strict";

module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual }) {
  const nova = () => {
    const j = carregarJogo();
    const Arte = carregarArte(j.ctx);
    return { Arte, PP: j.ctx.PIXEL_PATTERNS, M: Arte.motor, ctx: j.ctx };
  };
  const W = 48, H = 64;
  function caixa(px) {
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    px.data.forEach((c, i) => { if (!c) return; const x = i % px.w, y = (i / px.w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
    return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  const opaco = (c) => !!c && (c.length < 9 || parseInt(c.slice(7, 9), 16) > 200);
  // ilhas de px opacos (vizinhança de 8): devolve os tamanhos, da maior para a menor
  function ilhas(px) {
    const visto = new Uint8Array(px.w * px.h), tam = [];
    for (let i = 0; i < visto.length; i++) {
      if (visto[i] || !opaco(px.data[i])) continue;
      let n = 0; const pilha = [i]; visto[i] = 1;
      while (pilha.length) {
        const k = pilha.pop(), x = k % px.w, y = (k / px.w) | 0; n++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy, m = Y * px.w + X;
          if (X < 0 || Y < 0 || X >= px.w || Y >= px.h || visto[m] || !opaco(px.data[m])) continue;
          visto[m] = 1; pilha.push(m);
        }
      }
      tam.push(n);
    }
    return tam.sort((a, b) => b - a);
  }
  const difere = (a, b) => { let n = 0; for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) n++; return n; };
  const VISTAS = [0, 8, 16];

  teste("arte/humano-equip: os 36 acessórios e as armaduras têm desenho novo, com as camadas do legado", () => {
    const { M } = nova();
    const E = M.humanoEquipado;
    assert.ok(E && E.spec && typeof E.desenhar === "function", "humanoEquipado exposto (o M1 usa)");
    const legado = Object.keys(M.ACESSORIOS);
    igual(legado.length, 36, "36 acessórios no legado");
    for (const nome of legado) {
      const a = E.ACESSORIOS[nome];
      assert.ok(a, `${nome}: desenho novo`);
      assert.ok(["fundo", "meio", "frente"].some((c) => typeof a[c] === "function"), `${nome}: alguma camada`);
      assert.notStrictEqual(a, E.RESERVA, `${nome}: não é a reserva`);
    }
    for (const [nome, arm] of Object.entries(M.ARMADURAS)) {
      if (arm.veste) continue; // só cor (aplicada por novoHumano.cores)
      assert.ok(E.ARMADURAS[nome] && typeof E.ARMADURAS[nome].f === "function", `${nome}: armadura nova`);
    }
    // acessório desconhecido não some nem quebra: nome fora das tabelas é ignorado; nome só do legado cai na reserva
    assert.ok(typeof E.RESERVA.frente === "function");
  });

  teste("arte/humano-equip: os 39 humanos e o jogador no contrato novo, dentro da célula, pés no chão e nada flutuando", () => {
    const { Arte, PP, M } = nova();
    const chaves = Object.keys(M.HUMANOS).filter((k) => !k.includes("|"));
    const npcs = chaves.filter((k) => k.startsWith("pj_") && k !== "pj_jogador"), inimigos = chaves.filter((k) => k.startsWith("in_"));
    igual([npcs.length, inimigos.length], [25, 14], "25 NPCs e 14 inimigos humanos");
    chaves.push(Arte.garantirJogador({ arma: "espada_ferro", escudo: "escudo_bronze", armadura: "couraca_escamas", arco: "arco_composto" }, {}));
    for (const k of chaves) {
      const def = PP[k];
      igual([def.w, def.h, def.direcoes, def.quadrosPorVista, def.quadros, def.humano], [24, 32, 3, 8, 24, true], k);
      igual([def.ciclo, def.quadroAcao], [[2, 3, 4, 5], [6, 7]], `${k}: ciclo e ação`);
      igual(def.contorno, k.startsWith("in_") ? "hostil" : "amigo", `${k}: contorno`);
      assert.ok(def.sombra && def.alturaCabeca >= 50 && def.busto && def.retratoQuadro === 8, `${k}: sombra, altura da cabeça, busto e retrato`);
      const centelha = (M.HUMANOS[k].acessorios || []).some(([n]) => n === "brilho");
      const funda = (M.HUMANOS[k].acessorios || []).some(([n]) => n === "funda");
      for (let q = 0; q < 24; q++) {
        const px = Arte.pixels(k, { quadro: q }), cx = caixa(px);
        igual([px.w, px.h], [W, H], `${k}#${q}: célula`);
        igual(cx.y1, 62, `${k}#${q}: pés na linha 61 (+1 de contorno)`);
        assert.ok(cx.h >= 50 && cx.h <= 63, `${k}#${q}: altura ${cx.h}`);
        // miolo nunca encosta na borda da célula (o contorno de 1 px cabe)
        for (let x = 0; x < W; x++) for (const y of [0, H - 1]) assert.ok(!px.data[y * W + x] || px.borda[y * W + x], `${k}#${q}: miolo na borda (${x}, ${y})`);
        for (let y = 0; y < H; y++) for (const x of [0, W - 1]) assert.ok(!px.data[y * W + x] || px.borda[y * W + x], `${k}#${q}: miolo na borda (${x}, ${y})`);
        // nada flutuando: tudo ligado ao corpo (fora as centelhas do brilho e a pedra que sai da funda)
        const t = ilhas(px);
        if (!centelha && !(funda && q % 8 === 7)) igual(t.length, 1, `${k}#${q}: ${t.length} ilhas (${t.join(", ")})`);
        else assert.ok(t.slice(1).every((n) => n <= 16), `${k}#${q}: ilha grande solta (${t.join(", ")})`);
      }
      const txt = Array.from({ length: 24 }, (_, q) => Arte.pixels(k, { quadro: q }).data.join());
      igual(new Set(txt).size, 24, `${k}: 24 quadros distintos`);
    }
    igual(Arte.validar(), []);
  });

  teste("arte/humano-equip: corpo do jogador entre 50 e 58 px e cada arma, escudo, arco, armadura e traje muda o desenho nas 3 vistas", () => {
    const { Arte, M, ctx } = nova();
    const px = (eq, vis, q) => Arte.pixels(Arte.garantirJogador(eq, vis || {}), { quadro: q });
    for (let q = 0; q < 24; q++) { const c = caixa(px({}, {}, q)); assert.ok(c.h >= 50 && c.h <= 58, `jogador sem equipamento #${q}: ${c.h} px`); }
    const variar = (rotulo, lista, eqDe, minimo) => {
      for (const v of VISTAS) {
        const nu = px({}, {}, v), vistos = [];
        for (const id of lista) {
          const p = px(eqDe(id), {}, v), d = difere(nu, p);
          assert.ok(d >= minimo, `${rotulo} ${id}, vista ${v / 8}: só ${d} px mudam`);
          vistos.push(p.data.join());
        }
        igual(new Set(vistos).size, lista.length, `${rotulo}: cada um com o seu desenho na vista ${v / 8}`);
      }
    };
    variar("arma", Object.keys(M.LAMINAS), (id) => ({ arma: id }), 20);
    variar("escudo", Object.keys(M.CORES_ESCUDO), (id) => ({ escudo: id }), 40);
    variar("arco", Object.keys(M.ARCOS), (id) => ({ arco: id }), 14);
    variar("armadura", Object.keys(M.ARMADURAS), (id) => ({ armadura: id }), 60);
    // a funda (no espaço do arco) pendura o shofar
    for (const v of VISTAS) assert.ok(difere(px({}, {}, v), px({ arco: "funda" }, {}, v)) >= 8, `funda na vista ${v / 8}`);
    // arma e escudo saem da silhueta e acompanham o golpe: a caixa cresce no quadro 7 e a arma muda de lugar entre 6 e 7
    for (const v of VISTAS) {
      const nu7 = px({}, {}, v + 7), arm7 = px({ arma: "espada_ferro" }, {}, v + 7), arm6 = px({ arma: "espada_ferro" }, {}, v + 6), arm0 = px({ arma: "espada_ferro" }, {}, v);
      const a = caixa(nu7), b = caixa(arm7);
      assert.ok(b.w * b.h > a.w * a.h, `vista ${v / 8}: a espada sai da silhueta no golpe`);
      assert.ok(difere(arm6, arm7) > 80 && difere(arm0, arm7) > 80, `vista ${v / 8}: a espada acompanha a antecipação e o golpe`);
    }
    // trajes: cada um muda o boneco nas 3 vistas e são todos diferentes entre si
    const vm = require("vm"), TRAJES = vm.runInContext("TRAJES", ctx), CORES_VISUAL = vm.runInContext("CORES_VISUAL", ctx);
    const TR = Object.keys(TRAJES);
    assert.ok(TR.length >= 6, "trajes de dados/cosmeticos.js");
    for (const v of VISTAS) {
      const nu = px({}, {}, v), vistos = TR.map((t) => { const p = px({}, { traje: t }, v); assert.ok(difere(nu, p) >= 120, `traje ${t}, vista ${v / 8}`); return p.data.join(); });
      igual(new Set(vistos).size, TR.length, `trajes distintos na vista ${v / 8}`);
    }
    // cores do visual: cabeça, tronco, pernas e detalhe mudam o QUADRO 5 (passagem B de lado) e a frente
    const P = CORES_VISUAL.map((c) => c.id);
    for (const parte of ["cabeca", "tronco", "pernas", "detalhe"]) for (const q of [5, 8, 16]) {
      const d = difere(px({}, {}, q), px({}, { cores: { [parte]: P[7] } }, q));
      assert.ok(d >= (parte === "detalhe" ? 6 : 20), `cor de ${parte} no quadro ${q}: ${d} px`);
    }
  });

  teste("arte/humano-equip: retratos e bustos não vazios, com o rosto dentro do busto", () => {
    const { Arte, PP, M } = nova();
    for (const k of Object.keys(M.HUMANOS).filter((c) => !c.includes("|"))) {
      const def = PP[k], [bx, by, bw, bh] = def.busto.map((u) => u * 2), px = Arte.pixels(k, { quadro: def.retratoQuadro });
      let cheios = 0, cores = new Set();
      for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) { const c = px.data[y * W + x]; if (c) { cheios++; cores.add(c); } }
      assert.ok(bx >= 0 && by >= 0 && bx + bw <= W && by + bh <= H, `${k}: busto dentro da célula`);
      assert.ok(cheios >= bw * bh * 0.4 && cores.size >= 8, `${k}: busto com ${cheios} px e ${cores.size} cores`);
      // a cabeça (topo do desenho, fora hastes) fica dentro do busto: há miolo nas linhas de cima e de baixo dele
      const linha = (y) => { let n = 0; for (let x = bx; x < bx + bw; x++) if (px.data[y * W + x]) n++; return n; };
      assert.ok(linha(by + 8) >= 6 && linha(by + bh - 2) >= 8, `${k}: cabeça e ombros no busto`);
    }
  });
};
