// Testes do pacote A5 (arte/flora.js): obstáculos ob_<area>_<tipo>, estruturas es_* e decoração dc_*.
// Rode só estes com
//   node tests/logica.test.js arte/flora
"use strict";
const vm = require("vm");

module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual }) {
  const nova = () => {
    const j = carregarJogo();
    const Arte = carregarArte(j.ctx);
    return { Arte, PP: j.ctx.PIXEL_PATTERNS, ctx: j.ctx };
  };
  // variantes (quadros) de cada chave no desenho legado de sprites.js
  const VARIANTES = {
    ob_canaan_oliveira: 3, ob_canaan_muro: 2, ob_canaan_rocha: 2,
    ob_deserto_rocha: 3, ob_deserto_acacia: 2, ob_deserto_retama: 2, ob_deserto_tenda: 1,
    ob_mar_ilhota: 2, ob_mar_rochedo: 2, ob_mar_recife: 2,
    ob_egito_tamareira: 2, ob_egito_coluna: 1, ob_egito_tijolos: 2, ob_egito_jarros: 2,
    ob_marVermelho_granito: 2, ob_marVermelho_coral: 2, ob_marVermelho_destrocos: 2,
    ob_sinai_penedo: 2, ob_sinai_arbusto: 1, ob_sinai_marco: 1, ob_sinai_acacia: 1, ob_sinai_estandarte: 1,
    ob_galileia_figueira: 2, ob_galileia_basalto_muro: 2, ob_galileia_basalto: 2, ob_galileia_barco: 1,
    es_casa: 4, es_tenda: 4, es_banca: 2, es_poco: 1,
    dc_tapete: 1, dc_esteira: 1, dc_rede: 1, dc_fogo_apagado: 1,
  };
  const CELULA_ES = { es_casa: [104, 104], es_tenda: [104, 88], es_banca: [104, 92], es_poco: [40, 56] };
  const OBS = Object.keys(VARIANTES).filter((k) => k.startsWith("ob_"));
  const opaco = (c) => c && c.length === 7;
  // linha mais alta com px opaco (o desenho; a sombra projetada é translúcida)
  function topo(px) {
    for (let i = 0; i < px.data.length; i++) if (opaco(px.data[i])) return (i / px.w) | 0;
    return px.h;
  }

  teste("arte/flora: as 26 chaves ob_, os 4 es_ e os 4 dc_ existem com as variantes de antes; os obstáculos dos mapas têm desenho", () => {
    const { Arte, PP, ctx } = nova();
    for (const [k, n] of Object.entries(VARIANTES)) {
      assert.ok(PP[k], `${k} registrado`);
      igual(PP[k].quadros, n, `${k}: variantes`);
      igual(PP[k].semEspelho, true, `${k}: semEspelho`);
      igual(typeof PP[k].alto, "boolean", `${k}: alto`);
      assert.ok(PP[k].alturaVisual >= 0, `${k}: alturaVisual`);
    }
    // props das vilas (vieram da revisão do mundo da main): 7 por área, menos os jarros do Egito, que já são obstáculo
    const props = Object.keys(PP).filter((k) => PP[k].prop);
    igual(props.length, 41, "41 props de vila");
    for (const k of props) {
      assert.ok(/^ob_[A-Za-z]+_(barril|caixotes|carroca|jarros|lenha|cocho|cerca)$/.test(k), `${k}: prop conhecido`);
      const cerca = k.endsWith("_cerca");
      igual([PP[k].quadros, PP[k].fecho || 0, PP[k].semEspelho], [cerca ? 4 : 2, cerca ? 2 : 0, true], `${k}: quadros, fecho e semEspelho`);
      for (let q = 0; q < PP[k].quadros; q++) assert.ok(Arte.pixels(k, { quadro: q }).data.filter(opaco).length > 40, `${k}#${q}: tem desenho`);
    }
    igual(Object.keys(PP).filter((k) => /^(ob_|es_|dc_)/.test(k)).sort(), Object.keys(VARIANTES).concat(props).sort(), "nenhuma chave a mais nem a menos");
    // mesmo critério de tests/logica.test.js: regiões, muros de vila e marcos citados em dados/mapas.js
    const MAPAS = vm.runInContext("DADOS_MAPAS", ctx), BIOMAS = Arte.BIOMAS;
    for (const [area, d] of Object.entries(MAPAS)) {
      const tipos = [...d.regioes.map((r) => r.tipo), ...d.vilas.map((v) => v.muro), ...d.marcos.map((m) => m.tipo)].filter(Boolean);
      for (const tipo of tipos) assert.ok(PP[`ob_${area}_${tipo}`] || ["fogueira", "estandarte", "tenda"].includes(tipo), `${area}: obstáculo "${tipo}" sem desenho`);
      for (const dc of d.decoracoes || []) assert.ok(PP[dc.chave], `${area}: ${dc.chave}`);
      for (const e of d.estruturas || []) assert.ok(PP[`es_${e.tipo}`] || e.tipo === "loja", `${area}: es_${e.tipo}`);
    }
    // todo obstáculo sorteável de cada bioma tem desenho, e o alto do bioma bate com a def
    for (const [area, bio] of Object.entries(BIOMAS)) for (const o of bio.obstaculos) {
      const def = PP[`ob_${area}_${o.tipo}`];
      assert.ok(def, `ob_${area}_${o.tipo}`);
      if (o.alto) igual(def.alto, true, `ob_${area}_${o.tipo}: alto no bioma`);
    }
    igual(Arte.validar(), []);
  });

  teste("arte/flora: células, âncora na base, altura declarada e altos com pelo menos 56 px desenhados", () => {
    const { Arte, PP } = nova(), F = [];
    const ok = (c, m) => { if (!c) F.push(m); };
    const ig = (x, y, m) => { try { igual(x, y, m); } catch (e) { F.push(`${m} (${JSON.stringify(x)} x ${JSON.stringify(y)})`); } };
    for (const k of OBS) {
      const def = PP[k];
      ig(def.origem, [0.5, 1], `${k}: origem`);
      ig(def.obstaculo, true, `${k}: obstaculo`);
      ig(def.acabamento, false, `${k}: acabamento desligado (rampa6)`);
      let maior = 0;
      for (let q = 0; q < def.quadros; q++) {
        const px = Arte.pixels(k, { quadro: q });
        ig([px.w, px.h], [def.w * 2, def.h * 2], `${k}#${q}: célula`);
        const alt = px.h - def.pe - topo(px);
        maior = Math.max(maior, alt);
        if (def.alto) ok(alt >= 56 || !/oliveira|figueira|tamareira|acacia|ilhota|coluna|estandarte|tenda/.test(k), `${k}#${q}: alto com ${alt} px`);
        // o pé do desenho fica no meio da célula: há px opaco na coluna central perto da linha do pé
        let noPe = false;
        for (let y = px.h - def.pe - 8; y < px.h; y++) for (let x = (px.w >> 1) - 6; x <= (px.w >> 1) + 6; x++) if (opaco(px.data[y * px.w + x])) noPe = true;
        ok(noPe, `${k}#${q}: pé no meio da célula`);
      }
      ok(Math.abs(maior - def.alturaVisual) <= 6, `${k}: alturaVisual ${def.alturaVisual} x ${maior} px medidos`);
      ig(def.alto, def.alturaVisual > 36, `${k}: alto = passa de 1 casa`);
    }
    // os que o jogo trata como altos (bioma e marcos) passam de 56 px; árvores têm de 2 a 3 casas
    for (const k of ["ob_canaan_oliveira", "ob_galileia_figueira", "ob_egito_tamareira", "ob_deserto_acacia", "ob_sinai_acacia", "ob_mar_ilhota", "ob_egito_coluna", "ob_sinai_estandarte", "ob_deserto_tenda"]) {
      const def = PP[k];
      ig(def.alto, true, `${k}: alto`);
      for (let q = 0; q < def.quadros; q++) {
        const px = Arte.pixels(k, { quadro: q }), alt = px.h - def.pe - topo(px);
        ok(alt >= 56 && alt <= 96, `${k}#${q}: ${alt} px de altura`);
      }
    }
    for (const k of ["ob_canaan_oliveira", "ob_galileia_figueira", "ob_egito_tamareira", "ob_deserto_acacia"]) {
      ig([PP[k].w, PP[k].h], [32, 48], `${k}: célula de 64 × 96 px`);
      ok(PP[k].alturaVisual >= 64, `${k}: pelo menos 2 casas`);
    }
    // estruturas e decoração: célula, origem e pegada de antes
    for (const [k, [w, h]] of Object.entries(CELULA_ES)) {
      const px = Arte.pixels(k, { quadro: 0 });
      ig([px.w, px.h], [w, h], `${k}: célula`);
      ig([PP[k].origem, PP[k].estrutura], [[0.5, 1], true], `${k}: origem e estrutura`);
    }
    // casa: fachada de pelo menos 56 px sob o terraço (da linha do terraço ao chão)
    ig(Arte.pixels("es_casa").h - 4 - 42 >= 56, true, "es_casa: fachada");
    for (const k of Object.keys(VARIANTES).filter((c) => c.startsWith("dc_"))) {
      const px = Arte.pixels(k);
      ig([px.w, px.h, PP[k].origem], [32, 32, [0.5, 0.5]], `${k}: célula e origem`);
    }
    assert.ok(!F.length, `${F.length} falhas:\n` + F.join("\n"));
  });

  teste("arte/flora: variantes diferentes, nada cortado na borda e sombra projetada para a direita e para baixo", () => {
    const { Arte, PP } = nova(), F = [];
    const ok = (c, m) => { if (!c) F.push(m); };
    const ig = (x, y, m) => { try { igual(x, y, m); } catch (e) { F.push(`${m} (${JSON.stringify(x)} x ${JSON.stringify(y)})`); } };
    for (const k of Object.keys(VARIANTES)) {
      const def = PP[k], q = Array.from({ length: def.quadros }, (_, i) => Arte.pixels(k, { quadro: i }));
      ig(new Set(q.map((p) => p.data.join())).size, def.quadros, `${k}: variantes distintas`);
      q.forEach((p, i) => {
        // miolo opaco só por dentro: na borda da célula, só contorno, sombra ou nada
        let cortados = 0;
        for (let x = 0; x < p.w; x++) for (const y of [0, p.h - 1]) if (opaco(p.data[y * p.w + x]) && !p.borda[y * p.w + x]) cortados++;
        for (let y = 0; y < p.h; y++) for (const x of [0, p.w - 1]) if (opaco(p.data[y * p.w + x]) && !p.borda[y * p.w + x]) cortados++;
        ig(cortados, 0, `${k}#${i}: miolo cortado na borda da célula`);
        ok(p.data.filter(opaco).length > 60, `${k}#${i}: tem desenho`);
      });
    }
    // sombra: px translúcidos da cor de sombra, mais à direita do pé do que à esquerda, e abaixo dele
    for (const k of OBS.filter((c) => !c.startsWith("ob_mar_"))) {
      const def = PP[k], cor = (Arte.BIOMAS[k.split("_")[1]].sombra || "#1c1210").toLowerCase();
      for (let i = 0; i < def.quadros; i++) {
        const p = Arte.pixels(k, { quadro: i }), cx = p.w >> 1, yPe = p.h - def.pe;
        let dir = 0, esq = 0, abaixo = 0;
        p.data.forEach((c, n) => {
          if (!c || c.length !== 9 || c.slice(0, 7).toLowerCase() !== cor) return;
          const x = n % p.w, y = (n / p.w) | 0;
          if (x > cx) dir++; else if (x < cx) esq++;
          if (y >= yPe) abaixo++;
          assert.ok(!F.length, `${F.length} falhas:\n` + F.join("\n"));
  });
        ok(dir > 20, `${k}#${i}: tem sombra projetada (${dir} px à direita)`);
        ok(dir > esq * 1.25, `${k}#${i}: sombra para a direita (${dir} x ${esq})`);
        ok(abaixo > 10, `${k}#${i}: sombra abaixo do pé (${abaixo})`);
      }
    }
    // a sombra vive na camada de sombra: nenhum px translúcido ganha contorno
    for (const k of Object.keys(VARIANTES)) {
      const p = Arte.pixels(k);
      p.data.forEach((c, n) => ok(!(c && c.length === 9 && p.borda[n]), `${k}: contorno translúcido`));
    }
    assert.ok(!F.length, `${F.length} falhas:\n` + F.join("\n"));
    assert.ok(!F.length, `${F.length} falhas:\n` + F.join("\n"));
  });
};
