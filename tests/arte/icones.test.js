// Testes do pacote A9 (arte/icones.js): glifos de interface, habilidades e ofícios. Rode só estes com
//   node tests/logica.test.js arte/icones
"use strict";
const fs = require("fs");
const path = require("path");

module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual, RAIZ }) {
  const nova = () => {
    const j = carregarJogo();
    const Arte = carregarArte(j.ctx);
    return { Arte, PP: j.ctx.PIXEL_PATTERNS, ctx: j.ctx };
  };
  // as chaves vêm das chamadas glifo("…") legadas de sprites.js: nenhuma pode ficar sem desenho novo
  const chavesLegadas = () => [...fs.readFileSync(path.join(RAIZ, "sprites.js"), "utf8").matchAll(/glifo\("((?:ui|hb|of)_[a-z_0-9]+)"/g)].map((m) => m[1]);
  const cheios = (px) => px.data.reduce((n, c) => n + (c ? 1 : 0), 0);
  const cores = (px) => new Set(px.data.filter(Boolean)).size;

  teste("arte/icones: as 80 chaves (35 ui_, 39 hb_, 6 of_) existem em res 2 com o tamanho declarado", () => {
    const { Arte, PP } = nova();
    const chaves = chavesLegadas();
    igual(chaves.length, 80, "glifos em sprites.js");
    igual(new Set(chaves).size, 80, "glifos sem repetição");
    igual(chaves.filter((k) => k.startsWith("ui_")).length, 35, "ui_");
    igual(chaves.filter((k) => k.startsWith("hb_")).length, 39, "hb_");
    igual(chaves.filter((k) => k.startsWith("of_")).length, 6, "of_");
    igual(JSON.stringify(Arte.TAM_ICONE), JSON.stringify({ ui: 16, hb: 32, of: 32, rosa: 32 }), "Arte.TAM_ICONE");
    for (const k of chaves) {
      const def = PP[k];
      assert(def && typeof def.desenhar === "function", `${k}: sem desenhar() novo`);
      assert(!def.linhas && !def.quadrosLinhas, `${k}: ainda leva o mapa legado`);
      igual(def.res, 2, `${k}: res`);
      igual(def.quadros || 1, 1, `${k}: quadros`);
      igual(JSON.stringify(def.origem), "[0.5,0.5]", `${k}: origem`);
      const lado = k === "ui_rosa" ? Arte.TAM_ICONE.rosa : Arte.TAM_ICONE[k.slice(0, 2)];
      const px = Arte.pixels(k);
      igual(px.w, lado, `${k}: largura em px`);
      igual(px.h, lado, `${k}: altura em px`);
      igual(px.res, 2, `${k}: res dos pixels`);
    }
  });

  teste("arte/icones: nenhum ícone vazio, todos com tons e contorno, dentro do limite de cores", () => {
    const { Arte } = nova();
    for (const k of chavesLegadas()) {
      const px = Arte.pixels(k), n = cheios(px), c = cores(px), area = px.w * px.h;
      const ui = k.startsWith("ui_") && k !== "ui_rosa";
      assert(n >= area * (ui ? 0.18 : k === "ui_rosa" ? 0.45 : 0.6), `${k}: só ${n} px pintados de ${area}`);
      assert(c >= 3, `${k}: só ${c} cores (figura sem tons)`);
      assert(c <= (ui ? 16 : k === "ui_rosa" ? 32 : 48), `${k}: ${c} cores`);
      for (const cor of px.data) assert(cor === null || /^#[0-9a-f]{6}$/i.test(cor), `${k}: cor inválida ${cor}`);
      if (ui) {
        // contorno de tinta para ler sobre couro escuro e sobre pergaminho
        assert(px.data.includes("#1c100c"), `${k}: sem contorno de tinta`);
      } else if (k !== "ui_rosa") {
        // placa e selo: o centro é sempre pintado e os quatro cantos de fora ficam vazios (cantos arredondados)
        assert(px.data[16 * 32 + 16], `${k}: centro vazio`);
        for (const i of [0, 31, 31 * 32, 31 * 32 + 31]) assert(!px.data[i], `${k}: canto ${i} pintado`);
      }
    }
  });

  teste("arte/icones: cada ícone é um desenho diferente e a geração é estável", () => {
    const a = nova(), b = nova();
    const vistos = new Map();
    for (const k of chavesLegadas()) {
      const d = a.Arte.pixels(k).data.join(",");
      igual(d, b.Arte.pixels(k).data.join(","), `${k}: desenho muda entre duas gerações`);
      assert(!vistos.has(d), `${k}: desenho igual ao de ${vistos.get(d)}`);
      vistos.set(d, k);
    }
  });

  teste("arte/icones: todo ícone citado nos dados (habilidades e ofícios) tem glifo", () => {
    const { PP } = nova();
    const txt = fs.readFileSync(path.join(RAIZ, "dados", "vocacoes.js"), "utf8") + fs.readFileSync(path.join(RAIZ, "dados", "oficios.js"), "utf8");
    const icones = new Set([...txt.matchAll(/icone:\s*"([a-z_0-9]+)"/g)].map((m) => m[1]));
    assert(icones.size >= 40, "ícones lidos dos dados");
    for (const i of icones) assert(PP["hb_" + i] || PP["of_" + i] || PP[i], `ícone "${i}" dos dados sem glifo`);
  });
};
