// Testes do pacote A7 (arte/efeitos.js): tiras de efeito e projéteis, e a tabela Arte.FX. Rode só estes com
//   node tests/logica.test.js arte/efeitos
"use strict";
const fs = require("fs");
const path = require("path");

module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual, RAIZ }) {
  // chave: [largura px, altura px, quadros, laço]
  const TIRAS = {
    fx_corte: [32, 32, 5, false], fx_impacto: [48, 48, 5, false], fx_faisca: [32, 32, 5, false],
    fx_sangue: [32, 32, 5, false], fx_poca: [32, 32, 3, false],
    fx_fogo: [32, 48, 8, true], fx_fogueira: [32, 40, 6, true],
    fx_fumaca: [32, 32, 6, false], fx_poeira: [32, 32, 4, false],
    fx_cura: [32, 48, 6, false], fx_luz_fe: [32, 48, 6, false], fx_veneno: [32, 32, 5, false],
    fx_morte: [48, 48, 6, false], fx_restos_p: [32, 32, 1, false], fx_restos_g: [48, 40, 1, false],
    fx_respingo_agua: [32, 32, 4, false],
    fx_flecha: [32, 32, 3, false], fx_pedra: [32, 32, 3, false], fx_orbe: [32, 32, 3, false],
    fx_anel: [40, 20, 6, true], fx_anel_amigo: [40, 20, 6, true],
    fx_brilho: [10, 10, 3, true], fx_borboleta: [10, 8, 2, true],
  };
  // contagens fixas que game.js ainda toca até o G2 (o novo nunca pode ter menos)
  const MINIMO_LEGADO = { fx_corte: 2, fx_faisca: 3, fx_fogueira: 3, fx_anel: 4, fx_brilho: 3, fx_borboleta: 2 };
  // chaves fx_ que o jogo usa e que precisam continuar existindo
  const USADAS = ["fx_sombra", "fx_sombra_g", "fx_sombra_lobo", "fx_aura", "fx_pilar", "fx_pixel", "fx_luz_quente", "fx_bolha", "fx_faixa"];
  const nova = () => {
    const j = carregarJogo();
    const Arte = carregarArte(j.ctx);
    return { Arte, PP: j.ctx.PIXEL_PATTERNS };
  };
  const cheios = (px) => px.data.reduce((n, c) => n + (c ? 1 : 0), 0);
  const diferenca = (a, b) => { let d = 0; for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) d++; return d; };

  teste("arte/efeitos: cada chave existe com a célula e os quadros declarados em Arte.FX, sem contorno", () => {
    const { Arte, PP } = nova();
    for (const [k, [w, h, n, laco]] of Object.entries(TIRAS)) {
      const def = PP[k], fx = Arte.FX[k];
      assert.ok(def, `${k} registrado`);
      assert.ok(fx, `Arte.FX.${k}`);
      igual([def.quadros, fx.quadros, fx.laco], [n, n, laco], `${k}: quadros e laço`);
      assert.ok(fx.ms >= 0 && (n === 1 || k.startsWith("fx_restos") || /flecha|pedra|orbe/.test(k) || fx.ms >= 40), `${k}: ms`);
      igual(def.contorno, null, `${k}: contorno null`);
      assert.ok(!def.direcoes && !def.humano, `${k}: tira simples`);
      const px = Arte.pixels(k, { quadro: 0 });
      igual([px.w, px.h], [w, h], `${k}: célula`);
      if (MINIMO_LEGADO[k]) assert.ok(n >= MINIMO_LEGADO[k], `${k}: não tem menos quadros que o jogo toca`);
    }
    for (const k of USADAS) assert.ok(PP[k], `${k} continua existindo`);
    for (const k of Object.keys(Arte.FX)) { assert.ok(PP[k], `Arte.FX.${k} aponta para um sprite`); igual(Arte.FX[k].quadros, PP[k].quadros, `Arte.FX.${k}.quadros`); }
    // os projéteis declaram as 3 orientações desenhadas
    for (const k of ["fx_flecha", "fx_pedra", "fx_orbe"]) igual(Arte.FX[k].direcoes, ["horizontal", "diagonal", "vertical"], k);
    igual(Arte.validar(), []);
  });

  teste("arte/efeitos: nenhum quadro vazio, quadros consecutivos diferem e a geração é determinística", () => {
    const { Arte, PP } = nova();
    const outra = nova();
    for (const k of Object.keys(TIRAS)) {
      const n = PP[k].quadros, q = Array.from({ length: n }, (_, i) => Arte.pixels(k, { quadro: i }));
      q.forEach((p, i) => assert.ok(cheios(p) >= 4, `${k}#${i}: quadro vazio`));
      for (let i = 1; i < n; i++) assert.ok(diferenca(q[i - 1], q[i]) >= 3, `${k}: quadros ${i - 1} e ${i} iguais`);
      if (Arte.FX[k].laco && n > 2) assert.ok(diferenca(q[n - 1], q[0]) >= 3, `${k}: o laço fecha em quadro diferente`);
      igual(outra.Arte.pixels(k, { quadro: n - 1 }).data.join(), q[n - 1].data.join(), `${k}: mesma arte a cada geração`);
    }
  });

  teste("arte/efeitos: desenho px a px (sem blocos 2 × 2), alfa em poucos níveis e arquivo só com primitivas finas", () => {
    const { Arte, PP } = nova();
    for (const k of Object.keys(TIRAS)) {
      const n = PP[k].quadros, alfas = new Set();
      let fino = 0;
      for (let i = 0; i < n; i++) {
        const p = Arte.pixels(k, { quadro: i });
        // células 2 × 2 alinhadas à unidade com conteúdo misto = traço de 1 px de arte
        for (let y = 0; y + 1 < p.h; y += 2) for (let x = 0; x + 1 < p.w; x += 2) {
          const a = p.data[y * p.w + x], b = p.data[y * p.w + x + 1], c = p.data[(y + 1) * p.w + x], d = p.data[(y + 1) * p.w + x + 1];
          if (a !== b || a !== c || a !== d) fino++;
        }
        for (const c of p.data) if (c && c.length > 7 && c.slice(0, 7) !== "#1c1210") alfas.add(c.slice(7));
      }
      assert.ok(fino >= (p0(k) ? 3 : 8), `${k}: ${fino} células finas (desenho em blocos 2 × 2?)`);
      // a Tela despeja só dois níveis de translúcido (2/3 e 1/3) além do cheio
      for (const a of alfas) assert.ok(a === "a8" || a === "54", `${k}: alfa ${a}`);
    }
    function p0(k) { return k === "fx_brilho" || k === "fx_borboleta"; }
    // efeitos de luz e de fumaça têm borda translúcida
    for (const k of ["fx_corte", "fx_impacto", "fx_fogo", "fx_fumaca", "fx_cura", "fx_luz_fe", "fx_morte", "fx_orbe", "fx_poca"]) {
      let trans = 0;
      for (let i = 0; i < PP[k].quadros; i++) for (const c of Arte.pixels(k, { quadro: i }).data) if (c && c.length > 7) trans++;
      assert.ok(trans >= 6, `${k}: borda translúcida`);
    }
    const txt = fs.readFileSync(path.join(RAIZ, "arte/efeitos.js"), "utf8");
    assert.ok(txt.includes("(function (global) {"), "IIFE");
    assert.ok(!/\bg\.(p|ret|lin|elip|carimbar)\(/.test(txt) && !/\bpin\.(set|encher)\(/.test(txt), "sem primitivas de bloco");
    assert.ok(!/Math\.random|document\.|window\./.test(txt.replace(/typeof window[^\n]*/g, "")), "sem acaso nem DOM na carga");
  });

  teste("arte/efeitos: projéteis têm 3 orientações de verdade e os efeitos de chão nascem na base", () => {
    const { Arte } = nova();
    const caixa = (px) => {
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      px.data.forEach((c, i) => { if (!c || c.length > 7) return; const x = i % px.w, y = (i / px.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
      return { w: x1 - x0 + 1, h: y1 - y0 + 1, y1 };
    };
    for (const k of ["fx_flecha", "fx_pedra"]) {
      const h = caixa(Arte.pixels(k, { quadro: 0 })), d = caixa(Arte.pixels(k, { quadro: 1 })), v = caixa(Arte.pixels(k, { quadro: 2 }));
      assert.ok(h.w > h.h, `${k}: horizontal mais largo que alto (${h.w}×${h.h})`);
      assert.ok(v.h > v.w, `${k}: vertical mais alto que largo (${v.w}×${v.h})`);
      assert.ok(Math.abs(d.w - d.h) <= 3, `${k}: diagonal quase quadrada (${d.w}×${d.h})`);
    }
    const f = caixa(Arte.pixels("fx_flecha", { quadro: 0 }));
    assert.ok(f.w >= 22 && f.h <= 9, `flecha longa e fina (${f.w}×${f.h})`);
    // fogo, fogueira e restos assentam perto da base da célula (origem na base)
    for (const [k, alt] of [["fx_fogo", 48], ["fx_fogueira", 40]]) {
      igual(Arte.motor.PIXEL_PATTERNS[k].origem, [0.5, 1], `${k}: origem`);
      for (let i = 0; i < Arte.motor.PIXEL_PATTERNS[k].quadros; i++) assert.ok(caixa(Arte.pixels(k, { quadro: i })).y1 >= alt - 5, `${k}#${i}: assenta na base`);
    }
    // a chama do fogo é alta: passa de 60% da célula em todo quadro
    for (let i = 0; i < 8; i++) assert.ok(caixa(Arte.pixels("fx_fogo", { quadro: i })).h >= 28, `fx_fogo#${i}: chama alta`);
  });
};
