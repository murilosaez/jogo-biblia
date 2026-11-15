"use strict";
// Pacote A6 — arte/terreno.js: pintores do tileset em px (água, costa, borda, muralha, chão, caminho,
// decoração rasteira, moldura). O formato do tileset (8 × 15 casas, Arte.ID_TILE) não muda.
const fs = require("fs"), path = require("path"), vm = require("vm");

module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual, RAIZ }) {
  const AREAS = ["canaan", "deserto", "mar", "egito", "marVermelho", "sinai", "galileia"];
  const L = 32;

  function canvasFalso(ctx) {
    ctx.OffscreenCanvas = class {
      constructor(w, h) { this.width = w; this.height = h; }
      getContext() {
        return { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, fillRect() {}, clearRect() {}, drawImage() {} };
      }
    };
  }
  // Arte com o pincel de cada tileset à mão (o pintor de sombras é o último dos fixos e recebe o pincel)
  function preparar(legado) {
    const j = carregarJogo();
    canvasFalso(j.ctx);
    let Arte;
    if (legado) { vm.runInContext(fs.readFileSync(path.join(RAIZ, "sprites.js"), "utf8"), j.ctx, { filename: "sprites.js" }); Arte = j.ctx.Arte; } else Arte = carregarArte(j.ctx);
    const M = Arte.motor, sombras = M.pintores.sombras;
    let pin = null;
    M.pintores.sombras = (p, bio) => { pin = p; return sombras(p, bio); };
    Arte.limparTilesets();
    const gerar = (area) => { Arte.limparTilesets(area); const ts = Arte.gerarTileset(area); return { ts, pin }; };
    return { j, Arte, M, ID: M.ID_TILE, gerar };
  }
  const casa = (pin, i) => {
    const sx = (i % 8) * L, sy = Math.floor(i / 8) * L, v = new Uint8Array(L * L * 4);
    for (let Y = 0; Y < L; Y++) v.set(pin.buf.subarray(((sy + Y) * pin.w + sx) * 4, ((sy + Y) * pin.w + sx + L) * 4), Y * L * 4);
    return v;
  };
  const iguais = (a, b) => { for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return false; return true; };
  const opacos = (v) => { let n = 0; for (let k = 3; k < v.length; k += 4) if (v[k] === 255) n++; return n; };
  const media = (v) => { const s = [0, 0, 0]; let n = 0; for (let k = 0; k < v.length; k += 4) if (v[k + 3]) { s[0] += v[k]; s[1] += v[k + 1]; s[2] += v[k + 2]; n++; } return s.map((x) => x / Math.max(1, n)); };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // fração dos blocos 2 × 2 alinhados à unidade que são de uma cor só (1 = desenho em blocos de unidade)
  const blocos = (v) => {
    let ig = 0;
    for (let Y = 0; Y < L; Y += 2) for (let X = 0; X < L; X += 2) {
      const o = (Y * L + X) * 4;
      let um = true;
      for (const d of [4, L * 4, L * 4 + 4]) for (let c = 0; c < 3; c++) if (v[o + c] !== v[o + d + c]) um = false;
      if (um) ig++;
    }
    return ig / 256;
  };
  const cores = (v) => { const s = new Set(); for (let k = 0; k < v.length; k += 4) if (v[k + 3]) s.add((v[k] << 16) | (v[k + 1] << 8) | v[k + 2]); return s.size; };

  teste("arte/terreno: mesmo tamanho de canvas e mesmos índices do tileset legado nas 7 áreas", () => {
    const novo = preparar(false), velho = preparar(true);
    igual(JSON.stringify(novo.ID), JSON.stringify(velho.ID), "Arte.ID_TILE não foi renumerado");
    igual([novo.M.TS_COLS, novo.M.TS_LINHAS], [8, 15]);
    const COLS = novo.j.g("COLS"), ROWS = novo.j.g("ROWS");
    for (const area of AREAS) {
      const a = novo.gerar(area), b = velho.gerar(area);
      igual([a.ts.canvas.width, a.ts.canvas.height, a.ts.largura, a.ts.altura, a.ts.desloc], [b.ts.canvas.width, b.ts.canvas.height, b.ts.largura, b.ts.altura, b.ts.desloc], area);
      igual([a.ts.canvas.width, a.ts.canvas.height, a.pin.w, a.pin.h], [256, 480, 256, 480], area);
      let dif = 0;
      for (let y = -3; y < ROWS + 3; y++) for (let x = -3; x < COLS + 3; x++) {
        if (a.ts.indice(x, y) !== b.ts.indice(x, y)) dif++;
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS && (a.ts.indiceDeco(x, y) !== b.ts.indiceDeco(x, y) || a.ts.indiceSombra(x, y) !== b.ts.indiceSombra(x, y))) dif++;
      }
      igual(dif, 0, `${area}: índices iguais aos do legado`);
      igual(JSON.stringify(novo.Arte.minimapaCores(area)), JSON.stringify(velho.Arte.minimapaCores(area)), `${area}: minimapaCores`);
    }
  });

  teste("arte/terreno: toda casa usada pelo mapa está pintada e as casas cheias não têm buraco", () => {
    const { j, ID, gerar } = preparar(false);
    const COLS = j.g("COLS"), ROWS = j.g("ROWS");
    for (const area of AREAS) {
      const { ts, pin } = gerar(area);
      const usados = new Set(), deco = new Set();
      for (let y = -3; y < ROWS + 3; y++) for (let x = -3; x < COLS + 3; x++) {
        usados.add(ts.indice(x, y));
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS) { const d = ts.indiceDeco(x, y), s = ts.indiceSombra(x, y); if (d >= 0) deco.add(d); if (s >= 0) deco.add(s); }
      }
      for (const i of usados) igual(opacos(casa(pin, i)), L * L, `${area}: casa ${i} inteira e opaca`);
      for (const i of deco) {
        const n = opacos(casa(pin, i)), v = casa(pin, i);
        let algum = 0;
        for (let k = 3; k < v.length; k += 4) if (v[k]) algum++;
        assert.ok(algum >= 8 && n < L * L, `${area}: decoração/sombra ${i} tem desenho (${algum} px) e fundo transparente`);
      }
      // decoração rasteira: 3 tons ou mais em cada variante desenhada (flores, tufos, pedras, conchas)
      // (marcas no chão — ondulação de areia, pegadas, cardume — ficam em 2 tons de propósito)
      let ricas = 0;
      for (let k = 0; k < 16; k++) { const n = cores(casa(pin, ID.DECO + k)); assert.ok(n >= 2, `${area}: decoração ${k} com ${n} tons`); if (n >= 3) ricas++; }
      assert.ok(ricas >= 8, `${area}: ${ricas}/16 decorações com 3+ tons`);
    }
  });

  teste("arte/terreno: água, costa e chão em px (sem blocos de unidade), com variantes diferentes", () => {
    const { ID, gerar, Arte } = preparar(false);
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    for (const area of AREAS) {
      const { pin } = gerar(area), bio = Arte.BIOMAS[area], agua = bio.agua || Arte.BIOMAS.mar.agua;
      const medir = (ini, n) => { let m = 0; for (let k = 0; k < n; k++) m = Math.max(m, blocos(casa(pin, ini + k))); return m; };
      assert.ok(medir(ID.AGUA, 4) < 0.8, `${area}: água sem blocos 2 × 2 (${medir(ID.AGUA, 4).toFixed(2)})`);
      assert.ok(medir(ID.ROTA, 4) < 0.8, `${area}: rota sem blocos 2 × 2`);
      assert.ok(medir(ID.COSTA, bio.borda.norte === "muralha" ? 4 : 16) < 0.8, `${area}: costa/muralha sem blocos 2 × 2`);
      assert.ok(medir(ID.BORDA, 16) < 0.85, `${area}: borda sem blocos 2 × 2 (${medir(ID.BORDA, 16).toFixed(2)})`);
      assert.ok(medir(ID.CHAO, 8) < 0.85 && medir(ID.CAMINHO, 16) < 0.85, `${area}: chão e caminho sem blocos 2 × 2`);
      // 8 variantes de água por região (4 de água + 4 da rota), todas diferentes entre si
      const vs = [];
      for (let k = 0; k < 4; k++) vs.push(casa(pin, ID.AGUA + k), casa(pin, ID.ROTA + k));
      for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) assert.ok(!iguais(vs[a], vs[b]), `${area}: variantes de água ${a} e ${b} diferem`);
      // gradiente: pelo menos 4 tons na água; a rota é mais clara que a água; a cor média fica perto da
      // cor que o minimapa usa (bio.agua.base)
      assert.ok(cores(vs[0]) >= 4, `${area}: água com ${cores(vs[0])} tons`);
      const lum = (v) => { const m = media(v); return m[0] + m[1] + m[2]; };
      assert.ok(lum(vs[1]) > lum(vs[0]), `${area}: rota mais clara que a água`);
      assert.ok(dist(media(vs[0]), hex(agua.base)) < 40, `${area}: água perto de agua.base (${dist(media(vs[0]), hex(agua.base)).toFixed(0)})`);
      if (area !== "mar") {
        assert.ok(dist(media(casa(pin, ID.CHAO)), hex(bio.chao.base)) < 40, `${area}: chão perto de chao.base`);
        assert.ok(dist(media(casa(pin, ID.CAMINHO + 15)), hex(bio.caminho.base)) < 48, `${area}: caminho perto de caminho.base`);
      }
      // costa: a casa com terra nos 4 lados tem espuma clara e é mais clara que a água aberta
      if (bio.borda.norte !== "muralha") assert.ok(lum(casa(pin, ID.COSTA + 15)) > lum(vs[0]) + 20, `${area}: costa com faixa rasa e espuma`);
    }
  });

  teste("arte/terreno: as 4 fases da água diferem e a animação só repinta as casas animadas", () => {
    const { ID, gerar } = preparar(false);
    for (const area of ["canaan", "mar", "marVermelho"]) {
      const { ts, pin } = gerar(area);
      const fixas = [];
      for (let i = 0; i < 120; i++) if (i < ID.COSTA || i >= ID.BORDA) fixas.push(i);
      const antes = fixas.map((i) => casa(pin, i));
      const fases = [];
      for (let t = 0; t < 4; t++) { ts.animar(t); fases.push({ agua: casa(pin, ID.AGUA), rota: casa(pin, ID.ROTA + 1), costa: casa(pin, ID.COSTA + 1) }); }
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) for (const k of ["agua", "rota", "costa"]) assert.ok(!iguais(fases[a][k], fases[b][k]), `${area}: ${k} muda entre as fases ${a} e ${b}`);
      for (const f of fases) igual([opacos(f.agua), opacos(f.rota), opacos(f.costa)], [L * L, L * L, L * L], `${area}: fase inteira e opaca`);
      fixas.forEach((i, k) => assert.ok(iguais(antes[k], casa(pin, i)), `${area}: casa fixa ${i} não é repintada pela animação`));
      // a fase volta ao mesmo desenho quando o tempo se repete (mesma entrada, mesma saída)
      ts.animar(2);
      assert.ok(iguais(casa(pin, ID.AGUA), fases[2].agua), `${area}: fase determinística`);
    }
  });

  teste("arte/terreno: desenho determinístico e as bordas das variantes de chão e de água emendam", () => {
    const { ID, gerar } = preparar(false);
    const a = gerar("canaan").pin.buf.slice(), b = gerar("canaan").pin.buf;
    assert.ok(iguais(a, b), "duas gerações dão o mesmo tileset");
    // emenda: a diferença média entre a última coluna de uma variante e a primeira de outra não passa
    // muito da diferença entre colunas vizinhas dentro da própria casa
    for (const area of ["canaan", "deserto", "mar"]) {
      const { pin } = gerar(area);
      for (const ini of area === "mar" ? [ID.AGUA] : [ID.CHAO, ID.AGUA]) {
        const vs = [0, 1, 2, 3].map((k) => casa(pin, ini + k));
        const difCol = (va, xa, vb, xb) => { let s = 0; for (let Y = 0; Y < L; Y++) for (let c = 0; c < 3; c++) s += Math.abs(va[(Y * L + xa) * 4 + c] - vb[(Y * L + xb) * 4 + c]); return s / L; };
        let dentro = 0, emenda = 0;
        for (let k = 0; k < 4; k++) { dentro += difCol(vs[k], 15, vs[k], 16) / 4; emenda += difCol(vs[k], 31, vs[(k + 1) % 4], 0) / 4; }
        assert.ok(emenda < dentro * 2 + 12, `${area} (${ini}): emenda ${emenda.toFixed(1)} × miolo ${dentro.toFixed(1)}`);
      }
    }
  });

  teste("arte/terreno: o arquivo só usa o pincel em px e não toca o DOM", () => {
    const texto = fs.readFileSync(path.join(RAIZ, "arte", "terreno.js"), "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n"); // sem os comentários
    assert.ok(!/pin\.(set|encher)\(/.test(texto), "sem pin.set nem pin.encher");
    assert.ok(/pin\.fino\(/.test(texto), "pinta com pin.fino");
    assert.ok(!/\b(document|window\.|Math\.random)\b/.test(texto.replace(/typeof window[^;]*;/g, "")), "sem document, window ou Math.random");
    assert.ok(/limparTilesets\(\)/.test(texto), "limpa os tilesets ao trocar os pintores");
  });
};
