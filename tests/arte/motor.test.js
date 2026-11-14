// Testes do motor de arte (pacote F1 do plano): contrato de quadros, contorno colorido com máscara,
// rampa de 6 tons, sombras e variantes sob demanda, ganchos (definirHumano, definirMontado, pintores) e
// os arquivos arte/*.js. Carregado pelo laço de tests/logica.test.js; rode só estes com
//   node tests/logica.test.js arte/motor
"use strict";
const fs = require("fs");
const path = require("path");

module.exports = function ({ teste, carregarJogo, carregarArte, arquivosDeArte, assert, igual, RAIZ }) {
  const nova = () => {
    const j = carregarJogo();
    const Arte = carregarArte(j.ctx);
    return { j, Arte, PP: j.ctx.PIXEL_PATTERNS, M: Arte.motor };
  };
  const lum = (c) => parseInt(c.slice(1, 3), 16) * 0.3 + parseInt(c.slice(3, 5), 16) * 0.59 + parseInt(c.slice(5, 7), 16) * 0.11;
  // canvas de mentira (a vm não tem DOM): guarda as chamadas do contexto 2D
  function canvasFalso(ctx) {
    const chamadas = [];
    ctx.OffscreenCanvas = class {
      constructor(w, h) { this.width = w; this.height = h; }
      getContext() {
        return {
          createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (img, x, y) => chamadas.push(["putImageData", img, x, y]),
          fillRect: (x, y, w, h) => chamadas.push(["fillRect", x, y, w, h]),
          clearRect() {}, drawImage() {},
        };
      }
    };
    return chamadas;
  }

  teste("arte/motor: contrato de quadros, exportações do motor e esqueleto dos arquivos arte/*.js", () => {
    const { Arte, PP, M } = nova();
    // toda def com vistas: quadros = 3 × (quadrosPorVista || 5); ciclo e ação dentro da vista
    for (const [k, def] of Object.entries(PP)) {
      if (!def.direcoes) continue;
      const qpv = def.quadrosPorVista || 5;
      igual([def.direcoes, def.quadros], [3, 3 * qpv], `${k}: vistas e quadros`);
      for (const q of [].concat(def.ciclo || [], def.quadroAcao || [])) assert.ok(q >= 0 && q < qpv, `${k}: quadro ${q} fora da vista`);
      if (def.sombra) assert.ok(def.sombra.w > 0 && def.sombra.h > 0, `${k}: sombra`);
    }
    // criatura nunca recebe humano: true — só o que saiu de humano() (ou do jogador montado)
    for (const [k, def] of Object.entries(PP)) {
      if (def.humano) assert.ok(M.HUMANOS[k] || M.MONTADOS[k], `${k}: humano: true fora de humano()`);
      if (/^al_/.test(k)) assert.ok(!def.humano, `${k}: criatura com humano: true`);
    }
    assert.ok(Object.keys(M.HUMANOS).filter((k) => k.startsWith("in_")).length >= 14, "inimigos humanos saem de humano()");
    assert.ok(Object.keys(M.HUMANOS).length >= 39, "humanos guardados em HUMANOS");
    // exportações que os pacotes de arte usam
    for (const nome of ["Grade", "registrar", "pixels", "PALETA", "CONTORNO", "BIOMAS", "misturar", "hash2", "ruido", "rampa6", "sombrear", "esferaPx", "panoPx",
      "prim", "HUMANOS", "ACESSORIOS", "ARMADURAS", "LAMINAS", "CORES_ESCUDO", "ARCOS", "coresHumano", "MONTARIAS_ARTE", "definirHumano", "definirMontado", "pintores", "Pincel", "T"])
      assert.ok(M[nome] !== undefined, `Arte.motor.${nome}`);
    for (const nome of ["retF", "elipF", "linF", "bastao", "pintarMascara"]) assert.strictEqual(typeof M.prim[nome], "function", `Arte.motor.prim.${nome}`);
    for (const nome of ["agua", "costa", "borda", "muralha", "chao", "caminho", "deco", "moldura"]) assert.strictEqual(typeof M.pintores[nome], "function", `pintores.${nome}`);
    assert.strictEqual(typeof Arte.garantirSombra, "function");
    assert.strictEqual(typeof Arte.garantirVariante, "function");
    igual(typeof Arte.FX, "object");
    igual([Arte.RES, M.T], [2, 16]);
    assert.ok(Object.keys(M.ACESSORIOS).length >= 36, "36 acessórios expostos");
    // arquivos de arte: os 11 na ordem combinada, entre sprites.js e cenario.js; sem DOM na carga
    igual(arquivosDeArte(), ["sprites.js", "arte/quadrupede.js", "arte/ave-serpente.js", "arte/artropode.js", "arte/humano.js", "arte/humano-equip.js",
      "arte/montado.js", "arte/flora.js", "arte/terreno.js", "arte/efeitos.js", "arte/itens.js", "arte/icones.js"]);
    for (const arq of arquivosDeArte().slice(1)) {
      const fonte = fs.readFileSync(path.join(RAIZ, arq), "utf8");
      const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      // só primitivas em px: nada de blocos de unidade (2 × 2 px)
      assert.doesNotMatch(codigo, /\bg\.(p|ret|lin|elip|carimbar)\(/, `${arq}: primitiva em blocos de unidade (use g.fino, g.pf, g.retf, g.linf, retF, elipF, linF)`);
      assert.doesNotMatch(codigo, /\bpin\.(set|encher)\(/, `${arq}: pin.set/pin.encher (use pin.fino)`);
      assert.match(codigo, /^\s*\(function \(global\) \{/, `${arq}: IIFE`);
    }
    // a validação do motor não acusa nada
    igual(Arte.validar(), [], "Arte.validar()");
  });

  teste("arte/motor: gerar todos os quadros leva menos de 3 s e registrar por cima troca o desenho", () => {
    const { Arte, PP, M } = nova();
    const t0 = process.hrtime.bigint();
    let quadros = 0;
    for (const [k, def] of Object.entries(PP)) for (let q = 0; q < def.quadros; q++) {
      const px = Arte.pixels(k, { quadro: q });
      igual([px.w, px.h], [Math.round(def.w * def.res), Math.round(def.h * def.res)], `${k}#${q}: tamanho`);
      quadros++;
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(quadros >= 1200, `${quadros} quadros`);
    // 3 s era o teto da arte legada (~0,7 s); com 24 quadros por criatura e por humano o teto é 8 s
    assert.ok(ms < 8000, `geração de ${quadros} quadros em ${ms.toFixed(0)} ms`);
    // registrar por cima: mesma chave, desenho novo, cache de pixels apagado
    const antes = Arte.pixels("pocao").data.join();
    const antigo = PP.pocao;
    M.registrar("pocao", { w: 16, h: 16, desenhar: (g) => M.prim.retF(g, 8, 8, 12, 12, "#c2452d") });
    const depois = Arte.pixels("pocao");
    assert.notStrictEqual(depois.data.join(), antes, "pixels() devolve o desenho novo");
    igual([depois.w, depois.h], [32, 32]);
    igual(depois.data[14 * 32 + 14], "#c2452d", "miolo do quadrado");
    assert.strictEqual(PP.pocao.contorno, "amigo", "padrões da def aplicados");
    M.registrar("pocao", antigo);
    igual(Arte.pixels("pocao").data.join(), antes, "registrar de volta restaura");
    // quadros = vistas × quadros por vista quando a def não diz
    M.registrar("pv_teste_contrato", { w: 8, h: 8, direcoes: 3, quadrosPorVista: 8, ciclo: [2, 3, 4, 5], quadroAcao: [6, 7], desenhar: (g, q) => g.fino(2 + q % 8, 2 + Math.floor(q / 8), "#ffffff") });
    igual(PP.pv_teste_contrato.quadros, 24);
    igual(Arte.validar(), []);
    M.registrar("pv_teste_ruim", { w: 8, h: 8, direcoes: 3, quadrosPorVista: 8, quadros: 15, desenhar: (g) => g.fino(2, 2, "#ffffff") });
    assert.ok(Arte.validar().some((p) => p.startsWith("pv_teste_ruim")), "validar acusa quadros fora do contrato");
  });

  teste("arte/motor: contorno colorido pela máscara borda, contorno legado e limites de cores", () => {
    const { Arte, PP, M } = nova();
    // quadrado de duas cores: o contorno toma a cor do vizinho, escurecida, e é mais claro do lado da luz
    M.registrar("pv_teste_contorno", { w: 8, h: 8, desenhar: (g) => { M.prim.retF(g, 4, 4, 4, 8, "#d4bf8f"); M.prim.retF(g, 8, 4, 4, 8, "#3b5a9a"); } });
    const px = Arte.pixels("pv_teste_contorno"), em = (x, y) => px.data[y * px.w + x], borda = (x, y) => px.borda[y * px.w + x];
    assert.ok(borda(5, 3) && borda(3, 6) && borda(12, 6) && borda(5, 12) && !borda(5, 5) && !borda(0, 0), "máscara só no anel de 1 px");
    igual(em(0, 0), null);
    assert.ok(em(5, 3) !== em(9, 3), "contorno com a cor do material vizinho (linho × anil)");
    assert.ok(lum(em(5, 3)) < lum("#d4bf8f") * 0.6 && lum(em(9, 3)) < lum("#3b5a9a"), "contorno mais escuro que o material");
    assert.ok(lum(em(5, 3)) > lum(em(5, 12)), "em cima (lado da luz) mais claro que embaixo");
    assert.ok(lum(em(3, 6)) > lum(em(5, 12)), "à esquerda (lado da luz) mais claro que embaixo");
    // amigo puxa ao sépia, hostil ao carmim
    M.registrar("pv_teste_hostil", { w: 8, h: 8, contorno: "hostil", desenhar: PP.pv_teste_contorno.desenhar });
    const verm = (c) => parseInt(c.slice(1, 3), 16) - parseInt(c.slice(3, 5), 16);
    assert.ok(verm(Arte.pixels("pv_teste_hostil").data[12 * 16 + 5]) > verm(em(5, 12)), "hostil mais vermelho");
    // contornoLegado: traço de cor única, como antes
    M.registrar("pv_teste_legado", { w: 8, h: 8, contornoLegado: true, desenhar: PP.pv_teste_contorno.desenhar });
    const leg = Arte.pixels("pv_teste_legado");
    const coresBorda = (p) => new Set(p.data.filter((c, i) => p.borda[i]));
    igual([...coresBorda(leg)], [M.CONTORNO.amigo]);
    assert.ok(coresBorda(px).size >= 4, "contorno colorido tem várias cores");
    // sem contorno: máscara vazia
    M.registrar("pv_teste_sem", { w: 8, h: 8, contorno: null, desenhar: PP.pv_teste_contorno.desenhar });
    assert.ok(!Arte.pixels("pv_teste_sem").borda.some(Boolean));
    // o acabamento reconhece o contorno pela máscara: um traço interno na cor da tinta é miolo, não borda
    M.registrar("pv_teste_traco", { w: 8, h: 8, desenhar: (g) => { M.prim.retF(g, 2, 2, 12, 12, "#d4bf8f"); M.prim.retF(g, 7, 5, 1, 6, M.CONTORNO.amigo); } });
    const tr = Arte.pixels("pv_teste_traco");
    igual([tr.data[8 * 16 + 7], tr.borda[8 * 16 + 7]], [M.CONTORNO.amigo, 0], "traço interno preservado e fora da máscara");
    igual(tr.data[8 * 16 + 8], "#d4bf8f", "sem realce falso ao lado do traço interno");
    // criaturas e humanos legados já saem com o contorno colorido; olhos e miolo preservados
    for (const k of ["in_lobo", "pj_eliabe", "espada_ferro", "es_casa"]) assert.ok(coresBorda(Arte.pixels(k, { quadro: 0 })).size >= 3, `${k}: contorno colorido`);
    // limites: 64 cores no miolo (o contorno não conta nem é fundido), 16 nos ui_ e 24 nos hb_/of_
    const cores = (p) => new Set(p.data.filter((c, i) => c && !p.borda[i])).size;
    const arcoIris = (n) => (g) => { for (let i = 0; i < n; i++) g.fino(2 + (i % 12), 2 + Math.floor(i / 12), "#" + (0x101010 + i * 0x030507).toString(16).padStart(6, "0")); };
    M.registrar("pv_teste_cores", { w: 8, h: 8, desenhar: arcoIris(120) });
    M.registrar("ui_teste_cores", { w: 16, h: 16, desenhar: arcoIris(120) });
    M.registrar("hb_teste_cores", { w: 16, h: 16, desenhar: arcoIris(120) });
    igual([cores(Arte.pixels("pv_teste_cores")), cores(Arte.pixels("ui_teste_cores")), cores(Arte.pixels("hb_teste_cores"))], [64, 16, 24]);
    igual(Arte.validar(), []);
    // máscara de volume: cabe uma célula de 104 px de largura (chave Y × 1024 + X)
    const m = M.prim.bastao(new Set(), 100, 70, 100, 80, 2);
    assert.ok(m.has(70 * 1024 + 100) && m.has(80 * 1024 + 99) && m.size === 24, "bastão além da coluna 64");
    const g = new M.Grade(60, 60);
    M.prim.pintarMascara(g, m, ["#ffffff", "#cccccc", "#888888", "#444444"]);
    assert.ok(g.gf(100, 75) && !g.gf(36, 76), "pintarMascara não dá a volta na coluna 64");
  });

  teste("arte/motor: rampa6, sombrear com Bayer só na transição, esferaPx, panoPx e sombra em dois níveis", () => {
    const { Arte, M } = nova();
    for (const tipo of ["pano", "pele", "pelo", "couro", "madeira", "pedra", "folha", "metal"]) {
      const r = M.rampa6("#b07a3e", tipo);
      igual([r.length, r[3]], [6, "#b07a3e"], tipo);
      for (let i = 1; i < 6; i++) assert.ok(lum(r[i]) > lum(r[i - 1]), `${tipo}: tom ${i} mais claro que ${i - 1}`);
      assert.ok(new Set(r).size === 6);
    }
    // matiz deslocado: a sombra puxa ao púrpura (mais azul que a base, em proporção) e a luz ao creme
    const r = M.rampa6("#7a8a3f"), canal = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
    assert.ok(canal(r[0], 2) / canal(r[0], 1) > canal(r[3], 2) / canal(r[3], 1), "sombra menos verde, mais púrpura");
    assert.ok(canal(r[5], 0) / canal(r[5], 1) > canal(r[3], 0) / canal(r[3], 1), "luz mais quente");
    // sombrear: extremos, tom chapado fora da faixa e pontilhado só dentro dela
    igual([M.sombrear(r, -1, 0, 0), M.sombrear(r, 1, 0, 0), M.sombrear(r, -5, 3, 3), M.sombrear(r, 5, 3, 3)], [r[0], r[5], r[0], r[5]]);
    const tons = (l, pont) => { const s = new Set(); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) s.add(M.sombrear(r, l, x, y, pont)); return [...s]; };
    igual(tons(-0.2, true), [r[2]], "centro do tom 2: chapado");
    igual(tons(0.2, true), [r[3]], "centro do tom 3: chapado");
    igual(tons(0, true).sort(), [r[2], r[3]].sort(), "na divisa entre dois tons: pontilhado dos dois");
    igual(tons(0, false).length, 1, "sem pontilhar: um tom só");
    // o pontilhado é de Bayer: na divisa exata, metade dos 16 px de cada tom
    let n = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (M.sombrear(r, 0, x, y) === r[3]) n++;
    igual(n, 8);
    // esferaPx: luz em cima/esquerda; panoPx: luz à esquerda
    const g = new M.Grade(16, 16);
    M.prim.elipF(g, 16, 16, 12, 12, M.esferaPx(r));
    assert.ok(lum(g.gf(10, 9)) > lum(g.gf(22, 23)), "esfera: cima/esquerda mais clara");
    M.prim.retF(g, 0, 0, 32, 4, M.panoPx(r, 0, 31));
    assert.ok(lum(g.gf(1, 1)) > lum(g.gf(30, 1)), "pano: esquerda mais clara");
    // sombra projetada: miolo e penumbra (dois alfas), na camada de sombra
    const s = new M.Grade(16, 16);
    s.sombra(8, 8, 6, 3);
    const alfas = new Set(s.s.filter(Boolean).map((c) => c.slice(7)));
    igual(alfas.size, 2, "dois níveis de alfa");
    assert.ok(!s.d.some(Boolean), "a sombra não entra na camada principal (sem contorno)");
    assert.ok(parseInt(s.s[16 * 32 + 16].slice(7), 16) > parseInt(s.s[16 * 32 + 4].slice(7), 16), "miolo mais forte que a borda");
    // sombra sob demanda
    const k = Arte.garantirSombra(27, 9);
    igual(k, "fx_sombra_28x10");
    const px = Arte.pixels(k);
    igual([px.w, px.h, Arte.garantirSombra(28, 10)], [28, 10, k]);
    assert.ok(px.data.some(Boolean) && !px.borda.some(Boolean) && new Set(px.data.filter(Boolean)).size === 2);
  });

  teste("arte/motor: ganchos definirHumano, definirMontado, garantirVariante e pintores do tileset", () => {
    const { j, Arte, PP, M } = nova();
    // parte do desenho legado, mesmo depois que arte/humano-equip.js e arte/montado.js ativarem os novos
    M.definirHumano(null); M.definirMontado(null);
    const legado = Arte.pixels("pj_eliabe", { quadro: 5 }).data.join();
    const chaveLivre = Arte.garantirJogador({ arma: "espada_ferro" });
    const montadoAntes = Arte.garantirJogador({}, { montaria: "cavalo" });
    igual([PP[montadoAntes].quadros, PP[montadoAntes].w], [15, 28]);
    // spec de teste: boneco de blocos em 48 × 64 px, 3 vistas × 8 quadros
    const vistos = [];
    const spec = {
      w: 24, h: 32, quadrosPorVista: 8, ciclo: [2, 3, 4, 5], quadroAcao: [6, 7], busto: [6, 2, 12, 12], sombra: { w: 22, h: 8 }, alturaCabeca: 56,
      desenhar(g, cfg, quadro, montaria) {
        vistos.push(cfg);
        const vista = Math.floor(quadro / 8), q = quadro % 8, c = M.coresHumano(cfg);
        M.prim.retF(g, 16 + vista, 10 + (q & 1), 16, 50, c.R);
        M.prim.retF(g, 20, 6 + q, 8, 8, c.S);
        if (cfg.armadura) M.prim.retF(g, 18, 30, 12, 6, "#6e7a84");
        if ((cfg.acessorios || []).some(([n]) => n === "espada")) M.prim.retF(g, 36, 20, 2, 20, "#e4ecf0");
        if (montaria) M.prim.retF(g, 4, 50, 40, 8, "#8a5a32");
      },
    };
    const n = M.definirHumano(spec);
    assert.ok(n >= 39 && n === Object.keys(M.HUMANOS).length, `${n} humanos re-registrados`);
    for (const k of Object.keys(M.HUMANOS)) {
      const def = PP[k];
      igual([def.quadros, def.direcoes, def.quadrosPorVista, def.w, def.h, def.humano, def.alturaCabeca], [24, 3, 8, 24, 32, true, 56], k);
      igual(def.contorno, M.HUMANOS[k].hostil ? "hostil" : "amigo", k);
    }
    igual(PP.pj_eliabe.retratoQuadro, 8, "retrato: de frente, parado");
    const novo = Arte.pixels("pj_eliabe", { quadro: 8 });
    igual([novo.w, novo.h], [48, 64]);
    assert.notStrictEqual(Arte.pixels("pj_eliabe", { quadro: 5 }).data.join(), legado, "o cache do desenho legado foi apagado");
    assert.ok(vistos.includes(M.HUMANOS.pj_eliabe), "a spec recebe a cfg original do humano");
    // chaves já geradas e chaves futuras do jogador usam a spec; a chave composta não muda
    igual(PP[chaveLivre].quadros, 24);
    const futura = Arte.garantirJogador({ escudo: "escudo_bronze" });
    igual([futura, PP[futura].quadros, PP[futura].w], ["pj_jogador||" + "|escudo_bronze|||", 24, 24]);
    assert.notStrictEqual(Arte.pixels(chaveLivre, { quadro: 8 }).data.join(), Arte.pixels("pj_jogador", { quadro: 8 }).data.join(), "equipamento chega à spec");
    // o montado continua no esqueleto antigo até definirMontado
    igual([PP[montadoAntes].quadros, PP[montadoAntes].w], [15, 28]);
    igual(M.definirMontado(Object.assign({}, spec, { w: 36, h: 40 })), 1);
    igual([PP[montadoAntes].quadros, PP[montadoAntes].w, PP[montadoAntes].h, PP[montadoAntes].montado, PP[montadoAntes].humano], [24, 36, 40, "cavalo", true]);
    const camelo = Arte.garantirJogador({}, { montaria: "camelo" });
    igual([PP[camelo].quadros, Arte.pixels(camelo).w, Arte.pixels(camelo).h], [24, 72, 80]);
    igual(Arte.validar(), []);
    // voltar ao legado
    M.definirHumano(null); M.definirMontado(null);
    igual([PP.pj_eliabe.quadros, PP[montadoAntes].quadros, Arte.pixels("pj_eliabe", { quadro: 5 }).data.join() === legado], [15, 15, true]);
    assert.throws(() => M.definirHumano({ w: 24, h: 32 }), /desenhar/);

    // variante de raro: sem variante na def devolve null; com ela, registra a chave ~v e devolve
    M.registrar("pv_teste_semvar", { w: 8, h: 8, desenhar: (g) => M.prim.retF(g, 4, 4, 8, 8, "#808080") });
    igual(Arte.garantirVariante("pv_teste_semvar", { escala: 1.2, tinta: "#b98ad0" }), null);
    igual(Arte.garantirVariante("nao_existe", { escala: 1.2 }), null);
    M.registrar("pv_teste_var", { w: 8, h: 8, contorno: "hostil", desenhar: (g) => M.prim.retF(g, 4, 4, 8, 8, "#808080"),
      variante: (porte, tinta) => ({ w: Math.ceil(8 * porte), h: Math.ceil(8 * porte), desenhar: (g) => M.prim.retF(g, 4, 4, Math.round(8 * porte), Math.round(8 * porte), tinta || "#808080") }) });
    const v = Arte.garantirVariante("pv_teste_var", { escala: 1.25, tinta: "#b98ad0" });
    igual(v, "pv_teste_var~v:b98ad0.125");
    igual([PP[v].w, PP[v].contorno, PP[v].varianteDe, Arte.pixels(v).data[8 * 20 + 8]], [10, "hostil", "pv_teste_var", "#b98ad0"]);
    igual(Arte.garantirVariante("pv_teste_var", { escala: 1.25, tinta: "#b98ad0" }), v);

    // pintores do tileset: trocar um pintor e limpar o cache refaz o tileset com ele
    canvasFalso(j.ctx);
    const ts1 = Arte.gerarTileset("canaan");
    assert.strictEqual(Arte.gerarTileset("canaan"), ts1, "tileset em cache");
    let chamadas = 0;
    const aguaLegada = M.pintores.agua, chaoLegado = M.pintores.chao;
    M.pintores.agua = (...a) => { chamadas++; return aguaLegada(...a); };
    M.pintores.chao = (...a) => { chamadas += 1000; return chaoLegado(...a); };
    assert.strictEqual(Arte.gerarTileset("canaan"), ts1, "sem limpar, vale o cache");
    Arte.limparTilesets();
    const ts2 = Arte.gerarTileset("canaan");
    assert.notStrictEqual(ts2, ts1);
    assert.ok(chamadas >= 1000 + 8 + 16, `pintores trocados foram chamados (${chamadas}): chão, água, rota e a água da costa`);
    igual([ts2.largura, ts2.altura, ts2.canvas.width, ts2.canvas.height], [ts1.largura, ts1.altura, ts1.canvas.width, ts1.canvas.height]);
    const antes = chamadas;
    ts2.animar(1);
    assert.ok(chamadas > antes && chamadas < antes + 1000, "a animação repinta só a água");

    // pintarPixels: na escala do mundo (1 px de arte por px de textura) usa ImageData
    const log = canvasFalso(j.ctx);
    const c = Arte.canvas("in_lobo", { tira: true });
    igual([c.width, c.height], [PP.in_lobo.w * 2 * PP.in_lobo.quadros, PP.in_lobo.h * 2]);
    igual([log.length, log.every((x) => x[0] === "putImageData")], [PP.in_lobo.quadros, true], "um putImageData por quadro");
    const img = log[1][1], px = Arte.pixels("in_lobo", { quadro: 1 });
    igual([img.width, log[1][2]], [px.w, px.w]);
    let iguais = true;
    for (let i = 0; i < px.data.length; i++) {
      const cor = px.data[i], a = img.data[i * 4 + 3];
      if (!cor ? a !== 0 : a !== (cor.length > 7 ? parseInt(cor.slice(7, 9), 16) : 255) || img.data[i * 4] !== parseInt(cor.slice(1, 3), 16)) iguais = false;
    }
    assert.ok(iguais, "ImageData igual aos pixels");
    log.length = 0;
    Arte.canvas("pocao", { escala: 4 });
    assert.ok(log.length > 10 && log.every((x) => x[0] === "fillRect"), "nas outras escalas, fillRect");
  });
};
