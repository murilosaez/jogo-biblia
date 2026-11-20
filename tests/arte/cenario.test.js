"use strict";
// Pacote C1 — cenario.js: chão contínuo texturizado (relva, terra, calçada, margem da água), pintura fatiada,
// muros de 34 px e fachadas parametrizadas pela altura da parede. Nada aqui usa o DOM: as pinturas devolvem
// uma Tela (buffer RGBA) e só Tela.canvas() toca em document.
const fs = require("fs"), path = require("path"), vm = require("vm");

module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual, RAIZ }) {
  const FONTE = fs.readFileSync(path.join(RAIZ, "cenario.js"), "utf8");
  const AREAS = ["canaan", "deserto", "egito", "marVermelho", "sinai", "galileia"]; // as 6 áreas com orla
  function preparar() {
    const j = carregarJogo();
    carregarArte(j.ctx);
    vm.runInContext(FONTE, j.ctx, { filename: "cenario.js" }); // sem document: a carga não pode tocar no DOM
    return { j, C: j.ctx.Cenario, Arte: j.ctx.Arte, g: j.g };
  }
  const opacos = (t) => { let n = 0; for (let i = 3; i < t.buf.length; i += 4) if (t.buf[i] === 255) n++; return n; };
  const cores = (t, x0 = 0, y0 = 0, w = t.w, h = t.h) => {
    const s = new Set();
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const o = (y * t.w + x) * 4; if (t.buf[o + 3]) s.add((t.buf[o] << 16) | (t.buf[o + 1] << 8) | t.buf[o + 2]); }
    return s;
  };
  const iguais = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };

  teste("arte/cenario: carrega sem DOM e mantém as chaves de materiais, muros e a interface que game.js usa", () => {
    const { C } = preparar();
    igual(C.MATERIAIS_PREDIO.map((m) => m.id), ["adobe", "pedra", "basalto", "tijolo", "tenda"]);
    for (const m of C.MATERIAIS_PREDIO) {
      igual(Object.keys(m).filter((k) => k !== "listra").sort(), ["dentro", "face", "id", "piso", "telhado", "textura", "topo"], `material ${m.id}`);
      igual([m.face.length, m.topo.length, m.dentro.length], [4, 4, 3], `rampas de ${m.id}`);
    }
    igual(Object.keys(C.MUROS).sort(), ["muro", "tijolos", "tumba"]);
    for (const f of ["nomeMuro", "esquecerArea", "pintarBloco"]) assert.strictEqual(typeof C[f], "function", `Cenario.${f}`);
    for (const f of ["texturasPredio", "texturaMovel", "texturaPorta", "texturaPedacoChao", "classesDaArea", "texturaMuro", "obstaculosDaOrla", "naOrla", "temOrla", "material",
      "pintarPredio", "pintarMovel", "pintarPedacoChao", "iniciarPedaco", "pintarFatia", "texturaPedacoChaoFatiada"]) assert.strictEqual(typeof C[f], "function", `Cenario.${f}`);
    igual([C.LADO_PEDACO, C.MOLDURA_CASAS, C.ALTURA_MURO, C.ALTURA_PAREDE], [16, 4, 34, 64]);
    // document só aparece dentro de Tela.canvas()
    const usos = FONTE.split("\n").filter((l) => /\bdocument\b/.test(l) && !/^\s*\/\//.test(l));
    igual(usos.length, 1, "um único uso de document");
    assert.match(usos[0], /createElement\("canvas"\)/);
  });

  teste("arte/cenario: classesDaArea devolve as mesmas classes e o mesmo chão pisado de antes nas 6 áreas com orla", () => {
    const { C, g } = preparar();
    const [COLS, ROWS, PISO, pisos, DADOS_MAPAS, estruturasPorArea, npcs] = ["COLS", "ROWS", "PISO", "pisos", "DADOS_MAPAS", "estruturasPorArea", "npcs"].map(g);
    for (const area of AREAS) {
      assert.ok(C.temOrla(area), `${area} tem orla`);
      // a regra de antes do pacote, reescrita aqui: 0 não pinta, 1 chão, 2 terra, 3 rua, 4 prédio
      const piso = pisos[area], vilas = (DADOS_MAPAS[area] && DADOS_MAPAS[area].vilas) || [];
      const naVila = (x, y) => vilas.some((v) => x >= v.x && y >= v.y && x < v.x + v.largura && y < v.y + v.altura);
      const cls = new Uint8Array(COLS * ROWS), gasto = new Float32Array(COLS * ROWS);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x, p = piso[y][x];
        if (p === PISO.AGUA) cls[i] = 0;
        else if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) cls[i] = C.naOrla(area, x, y) ? 1 : 0;
        else if (p === PISO.CAMINHO) cls[i] = naVila(x, y) ? 3 : 2;
        else if (p >= PISO.PAREDE) cls[i] = 4;
        else cls[i] = 1;
        if (naVila(x, y)) gasto[i] = 0.32;
      }
      const pisar = (cx, cy, r, f) => {
        for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
          const d = Math.hypot(x - cx, y - cy) / (r + 0.5);
          if (d < 1) gasto[y * COLS + x] = Math.max(gasto[y * COLS + x], f * (1 - d * d));
        }
      };
      for (const e of estruturasPorArea[area] || []) {
        if (e.entrar) pisar(e.porta.x, e.porta.y + 1, 2, 1);
        else pisar(e.x + (e.largura >> 1), e.y + e.altura, e.tipo === "poco" ? 2 : 1, 0.9);
        if (e.tipo === "poco") pisar(e.x, e.y, 2, 0.9);
      }
      for (const n of Object.values(npcs)) if (n.area === area) pisar(n.x, n.y, 1, 0.7);
      const r = C.classesDaArea(area);
      igual(Object.keys(r).sort(), ["cls", "gasto"]);
      assert.ok(iguais(r.cls, cls), `${area}: classes das casas`);
      assert.ok(iguais(r.gasto, gasto), `${area}: chão pisado`);
      assert.strictEqual(C.classesDaArea(area), r, `${area}: resultado guardado`);
      assert.ok(cls.includes(1) && cls.includes(2), `${area}: tem chão e estrada`);
    }
  });

  teste("arte/cenario: o chão é igual pintado de uma vez ou em fatias, não tem buracos e a relva tem vários verdes", () => {
    const { C, g } = preparar();
    const areas = g("areas"), COLS = g("COLS"), ROWS = g("ROWS"), pisos = g("pisos"), PISO = g("PISO");
    for (const area of AREAS) {
      const c = areas[area].inicio || areas[area].chegadaViagem || { x: 24, y: 24 };
      const bx = Math.floor(c.x / 16), by = Math.floor(c.y / 16);
      const inteiro = C.pintarPedacoChao(area, bx, by);
      igual([inteiro.w, inteiro.h], [512, 512]);
      // fatias: orçamento 0 = um passo por chamada; outra pintura no meio não muda o resultado (matiz por passo)
      const est = C.iniciarPedaco(area, bx, by);
      let passos = 0;
      while (!C.pintarFatia(est, 0)) { passos++; if (passos === 5) C.pintarMuro("tijolos", 10, 0); assert.ok(passos < 400, "a pintura termina"); }
      assert.ok(passos >= 12, `${area}: a pintura tem vários passos (${passos})`);
      assert.ok(est.pronto && C.pintarFatia(est, 0) === true);
      igual(est.chave, `chao_${area}_${bx}_${by}`);
      assert.ok(iguais(est.tela.buf, inteiro.buf), `${area}: fatiado = inteiro`);
      // toda casa de terra do pedaço está pintada por inteiro; só casas de água ficam com pixels vazios
      const { cls } = C.classesDaArea(area);
      for (let y = by * 16; y < by * 16 + 16; y++) for (let x = bx * 16; x < bx * 16 + 16; x++) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS || !cls[y * COLS + x]) continue;
        for (let py = 0; py < 32; py += 5) for (let px = 0; px < 32; px += 5) {
          const o = (((y - by * 16) * 32 + py) * 512 + (x - bx * 16) * 32 + px) * 4;
          assert.strictEqual(inteiro.buf[o + 3], 255, `${area}: casa ${x},${y} pintada`);
        }
      }
      assert.ok(cores(inteiro).size >= 20, `${area}: chão com textura (${cores(inteiro).size} cores)`);
    }
    // relva: pelo menos 5 verdes numa casa de chão comum e nada de xadrez (pontilhado ordenado)
    const { cls } = C.classesDaArea("canaan");
    const t = C.pintarPedacoChao("canaan", 4, 4);
    let medidas = 0;
    for (let y = 64; y < 80 && medidas < 6; y++) for (let x = 64; x < 80 && medidas < 6; x++) {
      let soChao = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (cls[(y + dy) * COLS + x + dx] !== 1) soChao = false;
      if (!soChao) continue;
      medidas++;
      const X = (x - 64) * 32, Y = (y - 64) * 32;
      const verdes = [...cores(t, X, Y, 32, 32)].filter((c) => ((c >> 8) & 255) > (c >> 16) && ((c >> 8) & 255) > (c & 255));
      assert.ok(verdes.length >= 5, `casa ${x},${y}: ${verdes.length} verdes`);
      // xadrez: pixel igual aos dois vizinhos em diagonal e diferente dos quatro vizinhos de lado
      let xadrez = 0;
      const px = (i, k) => { const o = ((Y + k) * 512 + X + i) * 4; return (t.buf[o] << 16) | (t.buf[o + 1] << 8) | t.buf[o + 2]; };
      for (let k = 1; k < 31; k++) for (let i = 1; i < 31; i++) {
        const c = px(i, k);
        if (px(i + 1, k + 1) === c && px(i - 1, k - 1) === c && px(i + 1, k - 1) === c && px(i - 1, k + 1) === c && px(i + 1, k) !== c && px(i - 1, k) !== c && px(i, k + 1) !== c && px(i, k - 1) !== c) xadrez++;
      }
      assert.ok(xadrez < 30, `casa ${x},${y}: ${xadrez} pixels em xadrez`);
    }
    assert.ok(medidas >= 3, "há casas de relva para medir");
    assert.ok(pisos && PISO);
  });

  teste("arte/cenario: a margem da água invade a casa de água (terra opaca e faixa rasa translúcida)", () => {
    const { C, g } = preparar();
    const COLS = g("COLS"), ROWS = g("ROWS"), pisos = g("pisos"), PISO = g("PISO");
    let vistas = 0;
    for (const area of ["canaan", "galileia"]) {
      const piso = pisos[area];
      // primeira casa de água do interior com terra logo abaixo
      let achou = null;
      for (let y = 2; y < ROWS - 2 && !achou; y++) for (let x = 2; x < COLS - 2 && !achou; x++)
        if (piso[y][x] === PISO.AGUA && piso[y + 1][x] === PISO.CHAO && piso[y - 1][x] === PISO.AGUA && piso[y][x - 1] === PISO.AGUA && piso[y][x + 1] === PISO.AGUA) achou = { x, y };
      if (!achou) continue;
      vistas++;
      const bx = achou.x >> 4, by = achou.y >> 4, t = C.pintarPedacoChao(area, bx, by);
      const X = (achou.x - bx * 16) * 32, Y = (achou.y - by * 16) * 32;
      const alfa = (i, k) => t.buf[((Y + k) * 512 + X + i) * 4 + 3];
      let terra = 0, rasa = 0, maxInvade = 0;
      for (let i = 0; i < 32; i++) {
        let inv = 0;
        for (let k = 31; k >= 0 && alfa(i, k) === 255; k--) inv++;
        terra += inv; maxInvade = Math.max(maxInvade, inv);
        for (let k = 0; k < 32; k++) if (alfa(i, k) > 0 && alfa(i, k) < 255) rasa++;
        assert.strictEqual(alfa(i, 0), 0, `${area}: o meio da água fica livre para o Tilemap`);
      }
      assert.ok(terra >= 32 && maxInvade <= 12, `${area}: a terra invade de 2 a 12 px (${terra} px, máx. ${maxInvade})`);
      assert.ok(rasa >= 64, `${area}: faixa rasa translúcida (${rasa} px)`);
    }
    assert.ok(vistas >= 1, "há margem de água para medir");
  });

  teste("arte/cenario: muros de 34 px, fachadas pela altura da parede (32 e 64) e móveis na célula de 32 × 48", () => {
    const { C, g } = preparar();
    for (const tipo of Object.keys(C.MUROS).filter((t) => !C.MUROS[t].cheio)) for (const mask of [1, 2, 4, 5, 6, 8, 10, 15]) {
      const t = C.pintarMuro(tipo, mask, 0);
      igual([t.w, t.h], [32, 32 + C.ALTURA_MURO], `muro ${tipo} ${mask}`);
      assert.ok(cores(t).size >= 8, `muro ${tipo} ${mask}: ${cores(t).size} cores`);
      // a face aparece onde o muro não continua para o sul, com a altura inteira
      const temFace = t.buf[((22 + C.ALTURA_MURO) * 32 + 16) * 4 + 3] === 255;
      igual(temFace, !(mask & 4), `muro ${tipo} ${mask}: face ao sul`);
    }
    // os dois lados de um muro leste–oeste emendam: mesma coluna de borda em variantes diferentes
    const a = C.pintarMuro("muro", 10, 0), b = C.pintarMuro("muro", 10, 2);
    for (let y = 0; y < a.h; y++) igual(a.buf[(y * 32 + 31) * 4 + 3], b.buf[(y * 32) * 4 + 3], `emenda na linha ${y}`);
    const cena = () => { const m = new Map(); return { m, textures: { exists: (k) => m.has(k), addCanvas: (k) => m.set(k, 1) } }; };
    const estruturas = g("estruturasPorArea");
    const medidas = {};
    const TelaReal = C.Tela.prototype.canvas;
    C.Tela.prototype.canvas = function () { return { width: this.w, height: this.h }; }; // sem DOM
    try {
      for (const AP of [32, 64]) {
        C.ALTURA_PAREDE = AP;
        for (const area of ["canaan", "egito", "deserto", "galileia"]) for (const e of estruturas[area].filter((e) => e.entrar).slice(0, 2)) {
          const W = e.largura * 32, H = e.altura * 32, p = C.pintarPredio(e);
          igual([p.chao.w, p.chao.h], [W, H]);
          igual([p.dentro.w, p.dentro.h], [W, H + AP], `dentro com parede de ${AP}`);
          igual([p.fora.w, p.fora.h], [W, H + AP], `fora com parede de ${AP}`);
          igual([p.sombra.w, p.sombra.h], [W + Math.round(AP * 0.5), H + Math.round(AP * 0.25)]);
          // a fachada ocupa a faixa de baixo inteira e o vão da porta é escuro
          const px = (e.porta.x - e.x) * 32 + 16, o = ((H + AP - 6) * W + px) * 4;
          assert.ok(p.fora.buf[o + 3] === 255 && p.fora.buf[o] < 110, `${area}: vão da porta`);
          assert.ok(opacos(p.fora) > W * (H + AP) * 0.97, `${area}: lado de fora sem buracos`);
          assert.ok(cores(p.fora, 0, H, W, AP).size >= 14, `${area}: fachada com textura`);
          const c = cena(), k = C.texturasPredio(c, e);
          for (const v of Object.values(k)) assert.ok(v.includes(`_h${AP}_`) && c.m.has(v), `chave com a altura: ${v}`);
          medidas[AP] = (medidas[AP] || 0) + 1;
        }
        for (let v = 0; v < C.MATERIAIS_PREDIO.length; v++) for (const aberta of [false, true]) {
          const t = C.pintarPorta(C.material(v), aberta);
          igual([t.w, t.h], [32, AP], `porta v${v}`);
          assert.ok(opacos(t) > (aberta ? 20 : AP * 9), `porta v${v} ${aberta ? "aberta" : "fechada"}`);
          const c = cena();
          assert.ok(C.texturaPorta(c, v, aberta).endsWith(`_h${AP}`));
        }
        const c = cena();
        assert.ok(C.texturaMuro(c, "muro", 10, 1).endsWith(`_h${C.ALTURA_MURO}`));
      }
    } finally { C.ALTURA_PAREDE = 64; C.Tela.prototype.canvas = TelaReal; }
    assert.ok(medidas[32] >= 4 && medidas[64] >= 4);
    for (const tipo of ["balcao", "barris", "caixotes", "sacos", "cama", "jarros", "mesa"]) {
      const t = C.pintarMovel(tipo, C.material(0), {}, 0);
      igual([t.w, t.h], [32, 48], tipo);
      assert.ok(opacos(t) > 250 && cores(t).size >= 8, `${tipo}: ${opacos(t)} px, ${cores(t).size} cores`);
      // base no fim da célula (o jogo ancora o móvel pela base)
      let base = 0;
      for (let y = 47; y >= 0 && !base; y--) for (let x = 0; x < 32; x++) if (t.buf[(y * 32 + x) * 4 + 3] === 255) { base = y; break; }
      assert.ok(base >= 45, `${tipo}: base na linha ${base}`);
    }
  });
  teste("arte/cenario: galerias da tumba (Pirâmides): lajes no chão, paredes de blocos cheios no labirinto e caches esquecidos a cada entrada", () => {
    const { C, Arte, g, j } = preparar();
    const bio = Arte.bioDaArea("piramides");
    assert.ok(bio.lajes && bio.escuroFixo > 0.4 && bio.luzJogador, "clima tumba: lajes, escuro fixo e a luz do jogador");
    igual(bio.pintarComo, "piramides", "ramos neutros (sem as leiras do Egito)");
    igual(Arte.SUBTITULOS.piramides.length > 0, true, "subtítulo do cartão");
    // os tijolos do labirinto viram a parede de blocos só na tumba; a fornalha (mesma arte) segue com os tijolos soltos
    igual(C.nomeMuro("piramides", "ob_egito_tijolos"), "tumba");
    igual(C.nomeMuro("fornalha", "ob_egito_tijolos"), null);
    igual(C.nomeMuro("egito", "ob_egito_tijolos"), "tijolos");
    igual(C.nomeMuro("piramides", "ob_egito_coluna"), null);
    // bloco cheio: a casa inteira; face ao sul só sem vizinho ao sul, tocha (v = 3) com a chama
    for (const mask of [0, 1, 2, 4, 5, 10, 15]) {
      const t = C.pintarBloco("tumba", mask, 0);
      igual([t.w, t.h], [32, 32], `bloco ${mask}`);
      igual(opacos(t), 32 * 32, `bloco ${mask}: cheio`);
      assert.ok(cores(t).size >= 5, `bloco ${mask}: ${cores(t).size} cores`);
      const face = cores(t, 0, 24, 32, 6), topo = cores(t, 0, 4, 32, 6);
      const lum = (s) => [...s].reduce((a, c) => a + (c >> 16) + ((c >> 8) & 255) + (c & 255), 0) / s.size;
      igual(lum(face) > lum(topo) + 40, !(mask & 4), `bloco ${mask}: face clara embaixo só sem parede ao sul`);
    }
    const chama = cores(C.pintarBloco("tumba", 0, 3));
    assert.ok([...chama].some((c) => c === 0xffd060), "a tocha tem chama");
    // o labirinto: escava no mapa, o muro é lido, esquecerArea limpa o que foi guardado e o labirinto novo aparece
    const mapas = g("mapas"), tipos = g("tiposObstaculo"), lab = vm.runInContext("DADOS_MASMORRAS", j.ctx).piramides.labirinto;
    const casa = { x: lab.x + 2, y: lab.y + 1 };
    mapas.piramides[casa.y][casa.x] = 1; tipos.piramides[`${casa.x},${casa.y}`] = "tijolos";
    igual(C.mascaraMuro("piramides", casa.x, casa.y) >= 0 && Arte.tipoObstaculo("piramides", casa.x, casa.y).chave, "ob_egito_tijolos");
    const antes = C.pintarPedacoChao("piramides", 0, 0);
    mapas.piramides[casa.y][casa.x] = 0; delete tipos.piramides[`${casa.x},${casa.y}`];
    C.esquecerArea("piramides");
    const depois = C.pintarPedacoChao("piramides", 0, 0);
    assert.ok(!iguais(antes.buf, depois.buf), "sem a parede, a sombra dela some do chão (cache esquecido)");
    // o chão das galerias: lajes (juntas escuras em fiadas), sem buracos na sala
    const sala = cores(depois, 6 * 32, 6 * 32, 64, 64);
    assert.ok(sala.size >= 10, `lajes com vários tons (${sala.size})`);
  });
};
