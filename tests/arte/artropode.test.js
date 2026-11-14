// Testes do pacote A3 (arte/artropode.js): escorpião, caranguejo, rã e os enxames de gafanhotos e de
// vespas no contrato novo de 3 vistas × 8 quadros. Rode só estes com
//   node tests/logica.test.js arte/artropode
"use strict";
const fs = require("fs");
const path = require("path");

module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual, RAIZ }) {
  const VOLUMES = { in_escorpiao: 40, in_caranguejo: 40, in_ra: 40 };
  const ENXAMES = { in_gafanhotos: 48, in_vespas: 48 };
  const TODAS = Object.assign({}, VOLUMES, ENXAMES);
  const nova = () => {
    const j = carregarJogo();
    const Arte = carregarArte(j.ctx);
    return { Arte, PP: j.ctx.PIXEL_PATTERNS };
  };
  // A camada de sombra chega como "#rrggbbaa" de cor fixa; asa translúcida também tem alfa, mas é clara.
  const ehSombra = (c) => !!c && c.length > 7 && c.slice(0, 7) === "#1c1210";
  const corpo = (c) => !!c && !ehSombra(c);
  function caixa(px) {
    let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1, n = 0;
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
      const i = y * px.w + x;
      if (!corpo(px.data[i]) || px.borda[i]) continue;
      n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, x1, y0, y1, n, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  const diferenca = (a, b) => { let d = 0; for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) d++; return d; };
  // centro de massa do desenho (para o viés do enxame)
  function massa(px) {
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (corpo(px.data[y * px.w + x])) { sx += x; sy += y; n++; }
    return { x: sx / n, y: sy / n, n };
  }
  // blocos soltos (4-vizinhança) do desenho: no enxame, cada bloco é um inseto ou um grupinho
  function blocos(px) {
    const visto = new Uint8Array(px.w * px.h), tam = [];
    for (let i = 0; i < visto.length; i++) {
      if (visto[i] || !corpo(px.data[i])) continue;
      let n = 0; const pilha = [i]; visto[i] = 1;
      while (pilha.length) {
        const k = pilha.pop(), x = k % px.w, y = (k / px.w) | 0; n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy, m = Y * px.w + X;
          if (X < 0 || Y < 0 || X >= px.w || Y >= px.h || visto[m] || !corpo(px.data[m])) continue;
          visto[m] = 1; pilha.push(m);
        }
      }
      tam.push(n);
    }
    return tam;
  }

  teste("arte/artropode: as cinco chaves seguem o contrato de 3 vistas x 8 quadros, com sombra, altura e variante", () => {
    const { Arte, PP } = nova();
    for (const [chave, lado] of Object.entries(TODAS)) {
      const def = PP[chave], enx = chave in ENXAMES;
      assert.ok(def, `${chave} registrado`);
      igual([def.direcoes, def.quadrosPorVista, def.quadros], [3, 8, 24], `${chave}: vistas e quadros`);
      igual([def.ciclo, def.quadroAcao], [[2, 3, 4, 5], [6, 7]], `${chave}: ciclo e ação`);
      igual([def.w * def.res, def.h * def.res], [lado, lado], `${chave}: célula`);
      igual([def.contorno, def.origem], [enx ? null : "hostil", [0.5, 1]], `${chave}: contorno e origem`);
      assert.ok(!def.humano, `${chave}: criatura não é humano`);
      assert.ok(def.sombra && def.sombra.w > 0 && def.sombra.h > 0 && def.sombra.w <= lado, `${chave}: sombra declarada`);
      assert.ok(def.alturaCabeca >= 18 && def.alturaCabeca <= lado, `${chave}: alturaCabeca`);
      igual(typeof def.variante, "function", `${chave}: variante`);
      assert.ok(def.acabamento === false, `${chave}: sombreado próprio, sem acabamento automático`);
      for (let q = 0; q < 24; q++) {
        const px = Arte.pixels(chave, { quadro: q });
        igual([px.w, px.h], [lado, lado], `${chave}#${q}: px`);
        const c = caixa(px);
        assert.ok(c.n >= (enx ? 90 : 110), `${chave}#${q}: desenho vazio ou miúdo (${c.n} px)`);
        // 1 px livre em volta: o contorno não é cortado e o enxame não é decepado pela célula
        assert.ok(c.x0 >= 1 && c.y0 >= 1 && c.x1 <= px.w - 2 && c.y1 <= px.h - 2, `${chave}#${q}: desenho encosta na borda [${c.x0},${c.y0},${c.x1},${c.y1}]`);
        const cores = new Set();
        for (let i = 0; i < px.data.length; i++) if (corpo(px.data[i]) && !px.borda[i]) cores.add(px.data[i]);
        assert.ok(cores.size >= (enx ? 6 : 10) && cores.size <= 64, `${chave}#${q}: ${cores.size} cores no miolo`);
        igual(px.borda.some(Boolean), !enx, `${chave}#${q}: contorno`);
      }
    }
    igual(Arte.validar().filter((p) => Object.keys(TODAS).some((k) => p.startsWith(k))), [], "validar");
  });

  teste("arte/artropode: as três vistas são desenhos diferentes, o ciclo alterna e o golpe muda de quadro para quadro", () => {
    const { Arte } = nova();
    for (const chave of Object.keys(TODAS)) {
      const q = (n) => Arte.pixels(chave, { quadro: n });
      for (const [a, b] of [[0, 8], [0, 16], [8, 16]]) assert.ok(diferenca(q(a), q(b)) > 150, `${chave}: vistas ${a / 8} e ${b / 8} iguais`);
      for (let v = 0; v < 3; v++) {
        const b = v * 8;
        for (let i = 2; i <= 5; i++) for (let k = i + 1; k <= 5; k++) assert.ok(diferenca(q(b + i), q(b + k)) > 30, `${chave} vista ${v}: fases ${i} e ${k} iguais`);
        assert.ok(diferenca(q(b), q(b + 1)) > 8, `${chave} vista ${v}: respirar igual ao parado`);
        assert.ok(diferenca(q(b), q(b + 6)) > 60 && diferenca(q(b), q(b + 7)) > 60 && diferenca(q(b + 6), q(b + 7)) > 60, `${chave} vista ${v}: golpe`);
      }
      const antes = q(3).data.join();
      Arte.motor.limparCaches(chave);
      igual(q(3).data.join() === antes, true, `${chave}: geração determinística`);
    }
    // frente e costas de escorpião, caranguejo e rã parados são (quase) simétricas; o lado não é.
    // No escorpião a cauda se enrola para um lado (lê como gancho, e não como poste): o limite é mais frouxo.
    for (const chave of Object.keys(VOLUMES)) for (const b of [8, 16]) {
      const px = q0(Arte, chave, b);
      let iguais = 0, total = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
        const a = corpo(px.data[y * px.w + x]), e = corpo(px.data[y * px.w + px.w - 1 - x]);
        if (a || e) { total++; if (a && e) iguais++; }
      }
      assert.ok(iguais / total > (chave === "in_escorpiao" ? 0.7 : 0.85), `${chave}#${b}: silhueta assimétrica (${(iguais / total).toFixed(2)})`);
    }
  });
  const q0 = (Arte, chave, n) => Arte.pixels(chave, { quadro: n });

  teste("arte/artropode: escorpião com cauda erguida e ferroada por cima, caranguejo largo, rã que salta e põe a língua", () => {
    const { Arte } = nova();
    const cx = (k, n) => caixa(Arte.pixels(k, { quadro: n }));
    // escorpião de lado: comprido, e a ferroada leva o desenho para a frente (direita)
    const e0 = cx("in_escorpiao", 0), e7 = cx("in_escorpiao", 7);
    assert.ok(e0.x1 - e0.x0 >= 28 && e0.x1 - e0.x0 > (e0.y1 - e0.y0) * 1.4, "escorpião de lado é comprido");
    assert.ok(e7.x0 > e0.x0, "na ferroada a cauda sai de trás e vem por cima");
    // de frente a cauda sobe atrás do corpo: mais alto que largo ou quase
    const ef = cx("in_escorpiao", 8);
    assert.ok(ef.y1 - ef.y0 >= 24, "escorpião de frente com a cauda erguida");
    // o ferrão vermelho aparece nas três vistas
    for (const n of [0, 8, 16]) {
      const px = Arte.pixels("in_escorpiao", { quadro: n });
      const verm = px.data.filter((c) => corpo(c) && parseInt(c.slice(1, 3), 16) > parseInt(c.slice(3, 5), 16) * 2.2 && parseInt(c.slice(1, 3), 16) > 110).length;
      assert.ok(verm >= 2, `escorpião#${n}: ferrão (${verm} px)`);
    }
    // caranguejo: bem mais largo que alto nas três vistas
    for (const n of [0, 8, 16]) { const c = cx("in_caranguejo", n); assert.ok(c.x1 - c.x0 >= 26 && c.x1 - c.x0 > (c.y1 - c.y0) * 1.25, `caranguejo#${n} largo`); }
    // de lado ele anda de lado: as patas abrem e fecham (a largura muda ao longo do ciclo)
    const larg = [2, 3, 4, 5].map((n) => { const c = cx("in_caranguejo", n); return c.x1 - c.x0; });
    assert.ok(Math.max(...larg) - Math.min(...larg) >= 1 || new Set([2, 3, 4, 5].map((n) => cx("in_caranguejo", n).x0)).size > 1, "caranguejo de lado estica e encolhe as patas");
    // rã: no ar (fase 4) o corpo fica acima do chão; agachada (fase 2) fica mais baixa que parada
    for (let v = 0; v < 3; v++) {
      const parada = cx("in_ra", v * 8), agach = cx("in_ra", v * 8 + 2), ar = cx("in_ra", v * 8 + 4);
      assert.ok(ar.cy < parada.cy - 3, `rã vista ${v}: salto (${parada.cy} → ${ar.cy})`);
      assert.ok(agach.y0 >= parada.y0, `rã vista ${v}: agacha`);
    }
    // língua rosada só no golpe; de lado ela alonga o desenho para a frente
    const rosa = (n) => Arte.pixels("in_ra", { quadro: n }).data.filter((c) => corpo(c) && parseInt(c.slice(1, 3), 16) > 170 && parseInt(c.slice(3, 5), 16) < 150 && parseInt(c.slice(5, 7), 16) > 90).length;
    for (let v = 0; v < 3; v++) assert.ok(rosa(v * 8 + 7) >= 6 && rosa(v * 8) === 0, `rã vista ${v}: língua`);
    assert.ok(cx("in_ra", 7).x1 > cx("in_ra", 0).x1 + 5, "rã de lado: a língua vai para a frente");
  });

  teste("arte/artropode: enxame é feito de insetos soltos (sem nuvem), com sombra salpicada e viés por vista", () => {
    const { Arte } = nova();
    for (const [chave, lado] of Object.entries(ENXAMES)) {
      for (let v = 0; v < 3; v++) for (const i of [0, 2, 3, 4, 5]) {
        const px = Arte.pixels(chave, { quadro: v * 8 + i });
        const b = blocos(px), c = caixa(px);
        // muitos blocos pequenos, nenhum bloco grande: insetos, não mancha
        assert.ok(b.length >= 8, `${chave}#${v * 8 + i}: ${b.length} blocos soltos`);
        assert.ok(Math.max(...b) <= 150, `${chave}#${v * 8 + i}: mancha de ${Math.max(...b)} px`);
        // o enxame não é chapado: ocupa menos de 40% da própria caixa
        assert.ok(c.n / ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1)) < 0.4, `${chave}#${v * 8 + i}: denso demais`);
        // sombra salpicada no chão, embaixo do enxame
        const som = []; px.data.forEach((cor, k) => { if (ehSombra(cor)) som.push((k / px.w) | 0); });
        assert.ok(som.length >= 12 && som.length <= 110, `${chave}#${v * 8 + i}: ${som.length} px de sombra`);
        assert.ok(Math.min(...som) > massa(px).y, `${chave}#${v * 8 + i}: sombra abaixo do enxame`);
      }
      // viés: de lado adensa à direita; de frente, embaixo; de costas, em cima
      const m = [0, 8, 16].map((n) => massa(Arte.pixels(chave, { quadro: n })));
      assert.ok(m[0].x > lado / 2, `${chave}: de lado adensa na frente (${m[0].x.toFixed(1)})`);
      assert.ok(m[1].y > m[2].y + 1.5, `${chave}: frente adensa embaixo, costas em cima (${m[1].y.toFixed(1)} × ${m[2].y.toFixed(1)})`);
      // o bote adensa na direção da vista: a caixa encolhe e o centro avança
      const c0 = caixa(Arte.pixels(chave, { quadro: 0 })), c7 = caixa(Arte.pixels(chave, { quadro: 7 }));
      assert.ok((c7.x1 - c7.x0) * (c7.y1 - c7.y0) < (c0.x1 - c0.x0) * (c0.y1 - c0.y0) * 0.75, `${chave}: bote adensa`);
      assert.ok(massa(Arte.pixels(chave, { quadro: 7 })).x > m[0].x + 2, `${chave}: bote de lado avança`);
      assert.ok(massa(Arte.pixels(chave, { quadro: 15 })).y > massa(Arte.pixels(chave, { quadro: 23 })).y, `${chave}: bote de frente desce, de costas sobe`);
    }
  });

  teste("arte/artropode: variante de raro nomeado redesenha no porte e na cor, e o arquivo só usa primitivas em px", () => {
    const { Arte, PP } = nova();
    for (const [chave, lado] of Object.entries(TODAS)) {
      const enx = chave in ENXAMES;
      const v = Arte.garantirVariante(chave, { escala: 1.4, tinta: "#9088b0" });
      igual(v, `${chave}~v:9088b0.140`, `${chave}: chave da variante`);
      const def = PP[v];
      igual([def.direcoes, def.quadrosPorVista, def.quadros], [3, 8, 24], `${v}: contrato`);
      const L = def.w * def.res;
      assert.ok(L >= Math.floor(lado * 1.4) && L <= Math.ceil(lado * 1.4) + 2 && L === def.h * def.res, `${v}: célula de ${L} px`);
      assert.ok(def.alturaCabeca > PP[chave].alturaCabeca && (enx || def.sombra.w > PP[chave].sombra.w), `${v}: sombra e altura crescem`);
      const base = caixa(Arte.pixels(chave, { quadro: 8 })), gr = caixa(Arte.pixels(v, { quadro: 8 }));
      assert.ok(gr.n > base.n * 1.5, `${v}: desenho maior (${base.n} → ${gr.n} px)`);
      const cores = (k) => new Set(Arte.pixels(k, { quadro: 8 }).data.filter(corpo));
      const cb = cores(chave), cv = cores(v);
      assert.ok([...cv].filter((c) => !cb.has(c)).length >= 6, `${v}: paleta tingida`);
      igual(Arte.garantirVariante(chave, { escala: 1.35 }), `${chave}~v:.135`);
      for (let q = 0; q < 24; q++) {
        const c = caixa(Arte.pixels(v, { quadro: q }));
        assert.ok(c.x0 >= 1 && c.y0 >= 1 && c.x1 <= L - 2 && c.y1 <= L - 2, `${v}#${q}: encosta na borda [${c.x0},${c.y0},${c.x1},${c.y1}]`);
      }
      // o inseto do enxame maior não é ampliado: há mais insetos
      if (enx) assert.ok(blocos(Arte.pixels(v, { quadro: 8 })).length > blocos(Arte.pixels(chave, { quadro: 8 })).length, `${v}: mais insetos`);
    }
    igual(Arte.validar().filter((p) => /in_(escorpiao|caranguejo|ra|gafanhotos|vespas)/.test(p)), [], "validar com as variantes");
    const codigo = fs.readFileSync(path.join(RAIZ, "arte/artropode.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(codigo, /\bg\.(p|ret|lin|elip|carimbar)\(/, "bloco de unidade (2 × 2 px)");
    assert.doesNotMatch(codigo, /Math\.random|document|canvas/, "acaso ou DOM na arte");
  });
};
