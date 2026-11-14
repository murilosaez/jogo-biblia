// Testes do pacote A8 (arte/itens.js): os ícones de item redesenhados em 32 × 32 px, pixel a pixel.
// Rode só estes com
//   node tests/logica.test.js arte/itens
"use strict";
const fs = require("fs");
const path = require("path");

module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual, RAIZ }) {
  const nova = () => {
    const j = carregarJogo();
    const Arte = carregarArte(j.ctx);
    return { j, Arte, PP: j.ctx.PIXEL_PATTERNS };
  };
  const textoSprites = fs.readFileSync(path.join(RAIZ, "sprites.js"), "utf8");
  // o código de arte/itens.js sem as linhas de comentário
  const textoItens = fs.readFileSync(path.join(RAIZ, "arte", "itens.js"), "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  // as chaves de item do legado: as chamadas item("…") de sprites.js mais as pedras do peitoral (dados/itens.js)
  const chavesLegado = (j) => {
    const lista = [...textoSprites.matchAll(/^\s*item\("([a-z_0-9]+)"/gm)].map((m) => m[1]);
    for (const [k, d] of Object.entries(j.g("ITENS"))) if (d.pedra) lista.push(k);
    return [...new Set(lista)];
  };
  const ehSombra = (c) => !!c && c.length > 7; // a camada de sombra e a fumaça chegam como "#rrggbbaa"
  const miolo = (px) => px.data.filter((c, i) => c && !ehSombra(c) && !px.borda[i]);

  teste("arte/itens: toda chave de item do legado foi redesenhada em 32 x 32 px, com a mesma origem", () => {
    const { j, Arte, PP } = nova();
    const chaves = chavesLegado(j);
    assert.ok(chaves.length >= 56, `pelo menos 56 chaves de item (${chaves.length})`);
    const novos = new Set(Arte.ITENS_NOVOS);
    for (const k of chaves) {
      const def = PP[k];
      assert.ok(def, `${k} registrado`);
      assert.ok(novos.has(k), `${k} redesenhado em arte/itens.js`);
      igual([def.w, def.h, def.res], [16, 16, 2], `${k}: célula`);
      igual(def.origem, [0.5, 0.75], `${k}: origem`);
      assert.strictEqual(def.acabamento, false, `${k}: sombreado próprio, sem o acabamento automático`);
      assert.notStrictEqual(def.contornoLegado, true, `${k}: contorno colorido do motor`);
      const px = Arte.pixels(k);
      igual([px.w, px.h], [32, 32], `${k}: 32 x 32 px`);
    }
    // todo sprite sem prefixo de família é um item e está na lista
    const semPrefixo = Object.keys(PP).filter((k) => !/^[a-z]{2}_/.test(k));
    igual(semPrefixo.slice().sort(), chaves.slice().sort(), "itens = sprites sem prefixo");
    // todo item de dados/itens.js tem ícone (direto ou por apelido)
    for (const id of Object.keys(j.g("ITENS"))) assert.ok(PP[Arte.aliasItem(id)], `ícone de ${id}`);
    for (const id of ["odre", "flechas", "moedas", "espada_ferro@raro.dano2"]) assert.ok(novos.has(Arte.aliasItem(id)), `apelido ${id}`);
    igual(PP.moeda.quadros, 4, "a moeda continua girando em 4 quadros");
    igual(Arte.validar().filter((p) => chaves.some((k) => String(p).includes(k))), [], "validar() sem problemas nos itens");
  });

  teste("arte/itens: nenhum ícone vazio, 8 cores ou mais, desenho fino (sem blocos 2 x 2) e dentro da célula", () => {
    const { j, Arte, PP } = nova();
    for (const k of chavesLegado(j)) {
      for (let q = 0; q < (PP[k].quadros || 1); q++) {
        const px = Arte.pixels(k, { quadro: q }), nome = `${k}#${q}`;
        const m = miolo(px), perfil = k === "moeda" && q === 2; // a moeda de perfil é só a serrilha
        assert.ok(m.length >= (perfil ? 30 : 80), `${nome}: desenho preenchido (${m.length} px)`);
        const cores = new Set(m);
        assert.ok(cores.size >= 8, `${nome}: pelo menos 8 cores no miolo (${cores.size})`);
        assert.ok(cores.size <= 64, `${nome}: até 64 cores (${cores.size})`);
        // ocupa a célula: o legado cabia em 24 px; o novo usa pelo menos 20 px num dos eixos
        let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
        for (let i = 0; i < px.data.length; i++) {
          if (!px.data[i] || ehSombra(px.data[i])) continue;
          const x = i % 32, y = (i / 32) | 0;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        if (k !== "moeda") assert.ok(Math.max(x1 - x0, y1 - y0) + 1 >= 20, `${nome}: tamanho (${x1 - x0 + 1} x ${y1 - y0 + 1})`);
        // o contorno precisa de 1 px livre: o miolo não encosta na borda da célula
        for (let i = 0; i < px.data.length; i++) {
          if (!px.data[i] || ehSombra(px.data[i]) || px.borda[i]) continue;
          const x = i % 32, y = (i / 32) | 0;
          assert.ok(x > 0 && x < 31 && y > 0 && y < 31, `${nome}: miolo encosta na borda em ${x},${y}`);
        }
        // desenho por px: num desenho em blocos de unidade, todo bloco 2 x 2 alinhado é de uma cor só
        let mistos = 0, cheios = 0;
        for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) {
          const c = [0, 1, 32, 33].map((d) => px.data[by * 64 + bx * 2 + d]);
          if (c.some((v) => !v || ehSombra(v))) continue;
          cheios++;
          if (new Set(c).size > 1) mistos++;
        }
        assert.ok(cheios === 0 || mistos / cheios >= 0.3, `${nome}: desenho fino (${mistos} de ${cheios} blocos 2 x 2 com mais de uma cor)`);
        // contorno colorido: existe e não é uma cor única
        const bordas = new Set(px.data.filter((c, i) => c && px.borda[i]));
        assert.ok(bordas.size >= 2, `${nome}: contorno colorido (${bordas.size} cores)`);
        // sombra de apoio na camada de sombra
        assert.ok(px.data.some((c) => ehSombra(c) && c.startsWith("#1c1210")), `${nome}: sombra de apoio`);
      }
    }
  });

  teste("arte/itens: ícones diferentes entre si, moeda animada, pedras na cor de cada uma e desenho estável", () => {
    const { j, Arte, PP } = nova();
    const chaves = chavesLegado(j);
    const assin = new Map();
    for (const k of chaves) {
      const s = Arte.pixels(k).data.join(",");
      assert.ok(!assin.has(s), `${k} igual a ${assin.get(s)}`);
      assin.set(s, k);
    }
    const moeda = [0, 1, 2, 3].map((q) => Arte.pixels("moeda", { quadro: q }).data.join(","));
    igual(new Set(moeda).size, 4, "os 4 quadros da moeda são diferentes");
    // a pedra carrega a cor de dados/itens.js (campo pedra)
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    for (const [k, d] of Object.entries(j.g("ITENS"))) {
      if (!d.pedra) continue;
      assert.ok(miolo(Arte.pixels(k)).includes(d.pedra.toLowerCase()), `${k}: usa a cor ${d.pedra}`);
      const [r, g, b] = rgb(d.pedra);
      assert.ok(r + g + b > 0);
    }
    // mesmo desenho numa segunda carga (nada de Math.random)
    const outra = nova();
    for (const k of chaves) igual(outra.Arte.pixels(k).data.join(","), Arte.pixels(k).data.join(","), `${k} estável`);
  });

  teste("arte/itens: o arquivo só usa primitivas em px e não repete as chamadas legadas", () => {
    for (const proibida of ["g.p(", "g.ret(", "g.lin(", "g.elip(", "g.carimbar(", "Math.random", "document", "canvas"]) assert.ok(!textoItens.includes(proibida), `arte/itens.js não usa ${proibida}`);
    assert.ok(textoItens.includes("(function (global) {"), "IIFE");
    // as chamadas item("…") continuam em sprites.js (outros testes as procuram lá)
    for (const k of ["pocao", "espada_ferro", "escudo_bronze", "moeda", "peixe", "anfora"]) assert.ok(textoSprites.includes(`item("${k}"`), `sprites.js mantém item("${k}")`);
  });
};
