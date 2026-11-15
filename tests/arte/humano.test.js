// Testes do pacote A4 (arte/humano.js): esqueleto humano novo em prévia (pv_humano_*) e o contrato
// de Arte.motor.novoHumano que o H2 (arte/humano-equip.js) e o M1 (arte/montado.js) usam. Rode só estes com
//   node tests/logica.test.js arte/humano
"use strict";

module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual }) {
  const nova = () => {
    const j = carregarJogo();
    const Arte = carregarArte(j.ctx);
    return { Arte, PP: j.ctx.PIXEL_PATTERNS, M: Arte.motor };
  };
  const PREVIAS = ["pv_humano_manto", "pv_humano_curta", "pv_humano_veu", "pv_humano_grande"];
  // caixa do desenho (com o contorno)
  function caixa(px) {
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    px.data.forEach((c, i) => { if (!c) return; const x = i % px.w, y = (i / px.w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
    return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  // grade falsa que só anota os px pintados
  function gradeFalsa() {
    const m = new Map();
    return { m, fino(X, Y, c) { if (c) m.set(Y * 1024 + X, c); else m.delete(Y * 1024 + X); }, gf(X, Y) { return m.get(Y * 1024 + X) || null; } };
  }

  teste("arte/humano: prévias pv_humano_* no contrato de 3 vistas × 8 quadros, célula 48 × 64 e proporção adulta", () => {
    const { Arte, PP, M } = nova();
    for (const k of PREVIAS) {
      const def = PP[k];
      assert.ok(def, `${k} registrado`);
      igual([def.direcoes, def.quadrosPorVista, def.quadros], [3, 8, 24], `${k}: vistas e quadros`);
      igual([def.ciclo, def.quadroAcao], [[2, 3, 4, 5], [6, 7]], `${k}: ciclo e ação`);
      igual([def.w, def.h], [24, 32], `${k}: célula em unidades`);
      assert.ok(!def.humano, `${k}: prévia sem humano: true`);
      assert.ok(def.sombra && def.sombra.w % 2 === 0 && def.sombra.h % 2 === 0, `${k}: sombra`);
      igual(def.contorno, k === "pv_humano_grande" ? "hostil" : "amigo", `${k}: contorno`);
      for (let q = 0; q < 24; q++) {
        const px = Arte.pixels(k, { quadro: q }), cx = caixa(px);
        igual([px.w, px.h], [48, 64], `${k}#${q}: célula`);
        // corpo de 50 a 58 px de altura (com o contorno), pés na linha 61 (+1 de contorno)
        assert.ok(cx.h >= 50 && cx.h <= 58, `${k}#${q}: altura ${cx.h}`);
        assert.ok(cx.y1 === 62, `${k}#${q}: base do desenho na linha ${cx.y1}`);
        // 1 px livre para o contorno: nada de miolo cortado na borda da célula
        assert.ok(cx.x0 >= 0 && cx.x1 <= 47 && cx.y0 >= 1, `${k}#${q}: dentro da célula`);
        for (let x = 0; x < px.w; x++) for (const y of [0, px.h - 1]) assert.ok(!px.data[y * px.w + x], `${k}#${q}: px na borda (${x}, ${y})`);
        for (let y = 0; y < px.h; y++) for (const x of [0, px.w - 1]) assert.ok(!px.data[y * px.w + x] || px.borda[y * px.w + x], `${k}#${q}: miolo na borda (${x}, ${y})`);
      }
      // de frente, parado: mais alto que largo, na proporção de adulto (largura até metade da altura)
      const fr = caixa(Arte.pixels(k, { quadro: 8 }));
      assert.ok(fr.w >= 18 && fr.w <= fr.h * 0.52, `${k}: largura ${fr.w} para altura ${fr.h}`);
    }
    igual(Arte.validar(), []);
    // nada de chave real assumida nesta onda: os humanos do jogo só mudam no H2 (definirHumano)
    assert.ok(M.HUMANOS.pj_eliabe && !M.HUMANOS.pv_humano_manto, "prévias fora de HUMANOS");
  });

  teste("arte/humano: vistas diferentes, passo de 4 fases com braços em contrafase e golpe em 2 tempos", () => {
    const { Arte } = nova();
    for (const k of PREVIAS) {
      const q = Array.from({ length: 24 }, (_, i) => Arte.pixels(k, { quadro: i }));
      const txt = q.map((p) => p.data.join());
      assert.ok(txt[0] !== txt[8] && txt[0] !== txt[16] && txt[8] !== txt[16], `${k}: vistas diferentes`);
      for (let v = 0; v < 3; v++) {
        const b = v * 8;
        igual(new Set([0, 2, 3, 4, 5, 6, 7].map((i) => txt[b + i])).size, 7, `${k}: vista ${v}, quadros 0 e 2 a 7 distintos`);
        assert.notStrictEqual(txt[b + 1], txt[b], `${k}: vista ${v}, respirar`);
      }
      // de lado o golpe estende o braço para a frente (direita) e a antecipação recua
      const parado = caixa(q[0]), ante = caixa(q[6]), golpe = caixa(q[7]);
      assert.ok(golpe.x1 >= parado.x1 + 5, `${k}: golpe de lado avança (${parado.x1} → ${golpe.x1})`);
      assert.ok(ante.x0 <= parado.x0 - 1, `${k}: antecipação de lado recua (${parado.x0} → ${ante.x0})`);
      // o contato abre as pernas: de lado, mais largo que a passagem
      assert.ok(caixa(q[2]).w > caixa(q[3]).w && caixa(q[4]).w > caixa(q[5]).w, `${k}: contato mais aberto que a passagem`);
    }
  });

  teste("arte/humano: Arte.motor.novoHumano entrega spec, pose com âncoras e camadas para o equipamento", () => {
    const { M } = nova();
    const N = M.novoHumano;
    assert.ok(N, "novoHumano exposto");
    igual([N.w, N.h, N.quadrosPorVista, N.ciclo, N.quadroAcao, N.retratoQuadro, N.alturaCabeca], [24, 32, 8, [2, 3, 4, 5], [6, 7], 8, 56]);
    igual(N.busto.length, 4);
    assert.ok(N.sombra.w >= 16 && N.sombra.h >= 6);
    for (const f of ["pose", "desenhar", "inferiorMontado", "cores"]) igual(typeof N[f], "function", f);
    for (const f of ["corpo", "cabeca", "bracos", "membro", "mao"]) igual(typeof N.partes[f], "function", `partes.${f}`);
    // a spec serve a definirHumano tal como está (w, h, desenhar)
    assert.ok(N.w && N.h && typeof N.desenhar === "function");
    for (const vista of ["lado", "frente", "costas"]) {
      for (let q = 0; q < 8; q++) {
        const P = N.pose(vista, q, {});
        for (const a of ["T", "yT", "yC", "yR", "dy", "passo"]) igual(typeof P[a], "number", `${vista}#${q}: ${a}`);
        for (const a of ["maoArma", "maoEscudo", "ombroE", "ombroD", "quadril"]) assert.ok(Array.isArray(P[a]) && P[a].length === 2 && P[a].every(Number.isFinite), `${vista}#${q}: ${a}`);
        assert.ok(P.T < P.yT && P.yT < P.yC && P.yC < P.yR && P.yR < N.PES, `${vista}#${q}: ordem das âncoras`);
        for (const a of ["maoArma", "maoEscudo"]) assert.ok(P[a][0] >= 3 && P[a][0] <= 44 && P[a][1] >= 3 && P[a][1] <= 60, `${vista}#${q}: ${a} dentro da célula (${P[a]})`);
      }
      igual([N.pose(vista, 2, {}).passo, N.pose(vista, 4, {}).passo, N.pose(vista, 0, {}).passo], [1, -1, 0], `${vista}: passo`);
      // tronco sobe e desce no andar
      assert.ok(N.pose(vista, 2, {}).dy > N.pose(vista, 3, {}).dy, `${vista}: contato mais baixo que a passagem`);
    }
    // de lado, o tronco avança 2 px no golpe e a mão da arma vai à frente; na antecipação recua
    igual(N.pose("lado", 7, {}).dx, 2);
    assert.ok(N.pose("lado", 7, {}).maoArma[0] > N.pose("lado", 0, {}).maoArma[0] + 6 && N.pose("lado", 6, {}).maoArma[0] < N.pose("lado", 0, {}).maoArma[0]);
    // braços em contrafase: no contato A a mão de perto vai para trás e a de longe para a frente
    const A = N.pose("lado", 2, {}), B = N.pose("lado", 4, {});
    assert.ok(A.maoArma[0] < A.cx && A.maoLonge[0] > A.cx && B.maoArma[0] > B.cx && B.maoLonge[0] < B.cx, "contrafase de lado");
    assert.ok(N.pose("lado", 0, {}).maoLonge === null, "parado de lado: braço de longe escondido");
    // porte grande: 2 px mais alto
    igual(N.pose("frente", 0, { porte: "grande" }).T, N.pose("frente", 0, {}).T - 2);

    // camadas na ordem do legado e deslocamento (montado): mesmo desenho, transladado
    const cfg = { molde: "curta", cores: { R: "#b04a36" } };
    const g0 = gradeFalsa(), g1 = gradeFalsa(), ordem = [];
    const P = N.desenhar(g0, cfg, 9, { camada: (nome) => { ordem.push(nome); return nome === "frente"; } });
    igual(ordem, ["fundo", "armadura", "meio", "ombros", "frente", "fim"]);
    igual(P.vista, "frente");
    N.desenhar(g1, cfg, 9, { ox: 7, oy: 5 });
    igual(g1.m.size, g0.m.size);
    for (const [k, c] of g0.m) { const X = k % 1024, Y = (k - X) / 1024; if (g1.gf(X + 7, Y + 5) !== c) assert.fail(`px (${X}, ${Y}) não transladou`); }
    // montado: pernas abertas sobre a sela, sem passar da linha dos pés
    const g2 = gradeFalsa();
    N.desenhar(g2, cfg, 0, { montado: true });
    assert.ok(g2.m.size > 300 && Math.max(...[...g2.m.keys()].map((k) => Math.floor(k / 1024))) <= N.PES, "montado dentro da célula");
    // a armadura troca as cores da veste (a spec recebe a cfg original)
    const arm = Object.keys(M.ARMADURAS).find((a) => M.ARMADURAS[a].veste);
    if (arm) igual(N.cores({ molde: "curta", cores: {}, armadura: arm }).R, M.ARMADURAS[arm].veste.R);
  });

  teste("arte/humano: a spec nova serve a definirHumano e os humanos do jogo cabem na célula", () => {
    const { Arte, PP, M } = nova();
    // o H2 (arte/humano-equip.js) já ativou o boneco novo na carga: mede o legado desligando o gancho
    M.definirHumano(null);
    const antes = PP.pj_eliabe.w;
    assert.ok(antes < 24, "legado menor que a célula nova");
    const n = M.definirHumano(M.novoHumano);
    assert.ok(n >= 39, `${n} humanos re-registrados`);
    for (const k of ["pj_eliabe", "pj_noemi", "pj_josue", "in_chefe", "in_salteador"]) {
      const def = PP[k];
      igual([def.w, def.h, def.quadros, def.humano], [24, 32, 24, true], k);
      for (const q of [0, 8, 16, 7, 15, 23]) {
        const cx = caixa(Arte.pixels(k, { quadro: q }));
        // com os acessórios legados (ainda nas coordenadas do boneco antigo, até o H2) só se confere o corpo
        assert.ok(cx.h >= 50 && cx.h <= 62 && cx.y1 === 62, `${k}#${q}: altura ${cx.h}, base ${cx.y1}`);
      }
    }
    M.definirHumano(null);
    igual(PP.pj_eliabe.w, antes, "volta ao legado");
    if (M.humanoEquipado) { M.definirHumano(M.humanoEquipado.spec); igual(PP.pj_eliabe.w, 24, "reativa o boneco equipado"); }
  });
};
