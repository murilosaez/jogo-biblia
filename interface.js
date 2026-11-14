// =====================================================================
// interface.js — INTERFACE (DOM): painéis, barras, mochila, equipamento,
// atalhos, lista de batalha, missão, avisos, registro, diálogo, modais
// (loja, viagem, oração, mural de caçadas, ajuda), minimapa (posição),
// controles de toque.
//
// Guia de estilo §9 ("Iluminura viva"). Toda imagem vem de sprites.js
// (window.Arte / window.iconeItemURL). Nenhum emoji: sem Arte, os
// espaços mostram as duas primeiras letras do nome.
//
// Contrato:
//   consome  window.Jogo (game.js), Mundo/ITENS/... (logica.js, dados/*.js)
//   expõe    window.UI + apelidos antigos (atualizarInterface, mostrarMensagem,
//            abrirLoja, abrirViagem, orar, abrirMural, alternarMinimapa)
//   caçadas  só lê p.tarefas, p.pontosTarefa e p.trocas pelas funções puras
//            (tarefasDoMural, tarefasDoJogador, tarefasDoInimigo, ofertasDeTroca,
//            textoEspera); aceitar, guardar e trocar passam por executar().
// =====================================================================

// ---------------------------------------------------------------------
// Dígitos legíveis em pixel art.
// A Pixelify Sans (fonte dos números, guia §1) desenha o "2" como um Z e
// o "5" igual ao "S": "210" parece "810", "12" parece "18". Em vez de
// trocar de fonte, este bloco gera uma fonte TrueType mínima só com 0–9
// (grade 5×7, um quadrado por pixel) e a registra com o MESMO nome de
// família, restrita a U+0030–0039. O navegador passa a usar estes dígitos
// em toda a Pixelify Sans: na interface e nos textos do Phaser.
// ---------------------------------------------------------------------
(function fonteDigitos() {
  "use strict";
  if (typeof FontFace !== "function" || !document.fonts) return;

  const GRADES = {
    0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    1: ["..#..", ".##..", "#.#..", "..#..", "..#..", "..#..", "#####"],
    2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    3: ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
    7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    9: [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  };
  const UPM = 1000, U = 100, LARG = 5, ALT = 7, MARGEM = 50, AVANCO = LARG * U + 2 * MARGEM;
  const ASC = 800, DESC = 200;

  // Matriz de pixels de um dígito. No negrito cada coluna vale meio pixel
  // e todo traço ganha meio pixel à direita (traços verticais mais grossos).
  function matriz(grade, negrito) {
    if (!negrito) return { m: grade.map((l) => [...l].map((c) => c === "#")), ux: U };
    const m = grade.map((l) => {
      const linha = new Array(LARG * 2 + 1).fill(false);
      [...l].forEach((c, x) => { if (c === "#") linha[2 * x] = linha[2 * x + 1] = linha[2 * x + 2] = true; });
      return linha;
    });
    return { m, ux: U / 2 };
  }

  // Contorno: arestas de borda orientadas no sentido horário (eixo y para
  // cima), encadeadas em laços, sem pontos colineares.
  function contornos({ m, ux }) {
    const alt = m.length, larg = m[0].length;
    const cheio = (x, y) => y >= 0 && y < alt && x >= 0 && x < larg && m[y][x];
    const saidas = new Map();
    const aresta = (x0, y0, x1, y1) => {
      const k = x0 + "," + y0;
      if (!saidas.has(k)) saidas.set(k, []);
      saidas.get(k).push([x1, y1]);
    };
    for (let y = 0; y < alt; y++) for (let x = 0; x < larg; x++) {
      if (!cheio(x, y)) continue;
      const b = alt - 1 - y; // base do pixel, com y para cima
      if (!cheio(x, y - 1)) aresta(x, b + 1, x + 1, b + 1);
      if (!cheio(x + 1, y)) aresta(x + 1, b + 1, x + 1, b);
      if (!cheio(x, y + 1)) aresta(x + 1, b, x, b);
      if (!cheio(x - 1, y)) aresta(x, b, x, b + 1);
    }
    const lacos = [];
    while (saidas.size) {
      const inicio = saidas.keys().next().value;
      const pts = [inicio.split(",").map(Number)];
      let atual = inicio;
      for (;;) {
        const lista = saidas.get(atual);
        const prox = lista.pop();
        if (!lista.length) saidas.delete(atual);
        atual = prox.join(",");
        if (atual === inicio) break;
        pts.push(prox);
      }
      const limpo = pts.filter((p, i) => {
        const a = pts[(i + pts.length - 1) % pts.length], c = pts[(i + 1) % pts.length];
        return !((a[0] === p[0] && p[0] === c[0]) || (a[1] === p[1] && p[1] === c[1]));
      });
      lacos.push(limpo.map(([x, y]) => [MARGEM + x * ux, y * U]));
    }
    return lacos;
  }

  function Bytes() {
    const b = [];
    return {
      b,
      u8: (v) => b.push(v & 255),
      u16(v) { b.push((v >> 8) & 255, v & 255); },
      i16(v) { this.u16(v < 0 ? v + 65536 : v); },
      u32(v) { b.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); },
      tag(t) { for (const c of t) b.push(c.charCodeAt(0)); },
      pad() { while (b.length % 4) b.push(0); },
    };
  }

  function construir(negrito) {
    // glifo 0 = .notdef (vazio); glifos 1–10 = "0"–"9"
    const glifos = [null, ...Object.keys(GRADES).map((d) => contornos(matriz(GRADES[d], negrito)))];
    const glyf = Bytes(), loca = [];
    let maxPts = 0, maxCont = 0;
    for (const lacos of glifos) {
      loca.push(glyf.b.length);
      if (!lacos) continue;
      const todos = lacos.flat();
      const xs = todos.map((p) => p[0]), ys = todos.map((p) => p[1]);
      maxPts = Math.max(maxPts, todos.length);
      maxCont = Math.max(maxCont, lacos.length);
      glyf.i16(lacos.length);
      glyf.i16(Math.min(...xs)); glyf.i16(Math.min(...ys)); glyf.i16(Math.max(...xs)); glyf.i16(Math.max(...ys));
      let fim = -1;
      for (const l of lacos) { fim += l.length; glyf.u16(fim); }
      glyf.u16(0); // sem instruções
      for (let i = 0; i < todos.length; i++) glyf.u8(1); // todos os pontos na curva
      let px = 0, py = 0;
      for (const [x] of todos) { glyf.i16(x - px); px = x; }
      for (const [, y] of todos) { glyf.i16(y - py); py = y; }
      glyf.pad();
    }
    loca.push(glyf.b.length);
    const n = glifos.length;

    const head = Bytes();
    head.u32(0x00010000); head.u32(0x00010000); head.u32(0); head.u32(0x5f0f3cf5);
    head.u16(0x000b); head.u16(UPM);
    head.u32(0); head.u32(0); head.u32(0); head.u32(0); // datas
    head.i16(MARGEM); head.i16(0); head.i16(MARGEM + LARG * U + (negrito ? U / 2 : 0)); head.i16(ALT * U);
    head.u16(0); head.u16(8); head.i16(2); head.i16(1); head.i16(0);

    const hhea = Bytes();
    hhea.u32(0x00010000); hhea.i16(ASC); hhea.i16(-DESC); hhea.i16(0); hhea.u16(AVANCO);
    hhea.i16(0); hhea.i16(0); hhea.i16(MARGEM + LARG * U);
    hhea.i16(1); hhea.i16(0); hhea.i16(0);
    for (let i = 0; i < 4; i++) hhea.i16(0);
    hhea.i16(0); hhea.u16(n);

    const hmtx = Bytes();
    hmtx.u16(AVANCO); hmtx.i16(0);
    for (let i = 1; i < n; i++) { hmtx.u16(AVANCO); hmtx.i16(MARGEM); }

    const maxp = Bytes();
    maxp.u32(0x00010000); maxp.u16(n); maxp.u16(maxPts); maxp.u16(maxCont);
    maxp.u16(0); maxp.u16(0); maxp.u16(2);
    for (let i = 0; i < 8; i++) maxp.u16(0);

    const os2 = Bytes();
    os2.u16(4); os2.i16(AVANCO); os2.u16(400); os2.u16(5); os2.u16(0);
    for (const v of [650, 600, 0, 75, 650, 600, 0, 350, 50, 300]) os2.i16(v);
    os2.i16(0);
    for (let i = 0; i < 10; i++) os2.u8(0);
    os2.u32(1); os2.u32(0); os2.u32(0); os2.u32(0);
    os2.tag("JRND"); os2.u16(0x0040); os2.u16(0x30); os2.u16(0x39);
    os2.i16(ASC); os2.i16(-DESC); os2.i16(0); os2.u16(ASC); os2.u16(DESC);
    os2.u32(1); os2.u32(0);
    os2.i16(500); os2.i16(ALT * U); os2.u16(0); os2.u16(0x20); os2.u16(0);

    const cmap = Bytes();
    cmap.u16(0); cmap.u16(1); cmap.u16(3); cmap.u16(1); cmap.u32(12);
    cmap.u16(4); cmap.u16(32); cmap.u16(0); cmap.u16(4); cmap.u16(4); cmap.u16(1); cmap.u16(0);
    cmap.u16(0x39); cmap.u16(0xffff); cmap.u16(0);
    cmap.u16(0x30); cmap.u16(0xffff);
    cmap.i16(1 - 0x30); cmap.i16(1);
    cmap.u16(0); cmap.u16(0);

    const textos = { 1: "Jornada Digitos", 2: "Regular", 4: "Jornada Digitos", 6: "JornadaDigitos" };
    const name = Bytes();
    const ids = Object.keys(textos);
    name.u16(0); name.u16(ids.length); name.u16(6 + ids.length * 12);
    let desloc = 0;
    for (const id of ids) {
      name.u16(3); name.u16(1); name.u16(0x409); name.u16(+id); name.u16(textos[id].length * 2); name.u16(desloc);
      desloc += textos[id].length * 2;
    }
    for (const id of ids) for (const c of textos[id]) name.u16(c.charCodeAt(0));

    const post = Bytes();
    post.u32(0x00030000); post.u32(0); post.i16(-100); post.i16(50); post.u32(1);
    post.u32(0); post.u32(0); post.u32(0); post.u32(0);

    const locaB = Bytes();
    for (const o of loca) locaB.u32(o);

    const tabelas = { "OS/2": os2, cmap, glyf, head, hhea, hmtx, loca: locaB, maxp, name, post };
    const tags = Object.keys(tabelas).sort();
    const soma = (arr) => {
      let s = 0;
      for (let i = 0; i < arr.length; i += 4) s = (s + ((arr[i] << 24) | (arr[i + 1] << 16) | (arr[i + 2] << 8) | arr[i + 3])) >>> 0;
      return s;
    };
    const fonte = Bytes();
    const nt = tags.length, ent = Math.floor(Math.log2(nt)), sr = 16 * 2 ** ent;
    fonte.u32(0x00010000); fonte.u16(nt); fonte.u16(sr); fonte.u16(ent); fonte.u16(nt * 16 - sr);
    let pos = 12 + nt * 16;
    const corpos = [];
    for (const t of tags) {
      const dados = tabelas[t].b.slice();
      const tam = dados.length;
      while (dados.length % 4) dados.push(0);
      fonte.tag(t); fonte.u32(soma(dados)); fonte.u32(pos); fonte.u32(tam);
      corpos.push({ t, dados });
      pos += dados.length;
    }
    let posHead = 0;
    for (const c of corpos) {
      if (c.t === "head") posHead = fonte.b.length;
      fonte.b.push(...c.dados);
    }
    const ajuste = (0xb1b0afba - soma(fonte.b)) >>> 0;
    fonte.b.splice(posHead + 8, 4, (ajuste >>> 24) & 255, (ajuste >>> 16) & 255, (ajuste >>> 8) & 255, ajuste & 255);
    return new Uint8Array(fonte.b).buffer;
  }

  try {
    const regular = construir(false), negrito = construir(true);
    for (const peso of ["400", "600", "700"]) {
      const face = new FontFace("Pixelify Sans", peso === "400" ? regular : negrito, { weight: peso, unicodeRange: "U+0030-0039" });
      document.fonts.add(face);
      face.load().catch((e) => console.warn("[interface] fonte de dígitos recusada:", e && e.message));
    }
  } catch (e) {
    console.warn("[interface] fonte de dígitos indisponível:", e && e.message);
  }
})();

(function () {
  "use strict";

  const ID = typeof MEU_ID !== "undefined" ? MEU_ID : "jogador1";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mm = (q) => typeof matchMedia === "function" && matchMedia(q).matches;
  const reduzMovimento = () => mm("(prefers-reduced-motion: reduce)");
  const jogador = () => (typeof Mundo !== "undefined" && Mundo.jogadores ? Mundo.jogadores[ID] : null) || null;
  const temArte = () => typeof Arte !== "undefined" && !!Arte;
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ------------------------------------------------------------------
  // Arte (com proteção: a UI funciona sem sprites.js, sem emoji)
  // ------------------------------------------------------------------
  function glifoURL(chave, escala = 2) {
    try { return temArte() ? Arte.iconeURL(chave, escala) || "" : ""; } catch (e) { return ""; }
  }
  function itemURL(id, escala = 2) {
    try { return typeof window.iconeItemURL === "function" ? window.iconeItemURL(id, escala) || "" : ""; } catch (e) { return ""; }
  }
  function silhuetaURL(id) {
    try { return temArte() ? Arte.silhuetaURL(id, "#2a1a14", 2) || "" : ""; } catch (e) { return ""; }
  }
  function retratoURL(chave, opcoes) {
    try { return temArte() && chave ? Arte.retratoURL(chave, opcoes) || "" : ""; } catch (e) { return ""; }
  }
  function visualDe(id) {
    try { return temArte() ? Arte.visualDe(id) : ""; } catch (e) { return ""; }
  }
  function nomeCurto(nome) {
    if (temArte() && Arte.nomeCurto) return Arte.nomeCurto(nome || "");
    return String(nome || "").split(/[,·]/)[0].trim();
  }
  const imgGlifo = (chave, cls = "px g16", alt = "") => {
    const url = glifoURL(chave, 2);
    return url ? `<img class="${cls}" src="${url}" alt="${esc(alt)}">` : "";
  };
  // Ícone de item: <img> pixelado, ou duas letras do nome (nunca emoji).
  function htmlItem(id, tam = 32) {
    const url = itemURL(id, 2);
    const nome = nomeDoItem(id);
    if (url) return `<img class="px" src="${url}" width="${tam}" height="${tam}" alt="${esc(nome)}">`;
    return `<span class="letras" aria-label="${esc(nome)}">${esc(nome.slice(0, 2))}</span>`;
  }
  function nomeDoItem(id) {
    if (id === "flechas") return `${typeof FLECHAS_POR_PACOTE !== "undefined" ? FLECHAS_POR_PACOTE : 5} flechas`;
    return typeof nomeItem === "function" ? nomeItem(id) : id;
  }

  function preencherGlifos(raiz = document) {
    for (const img of $$("img[data-glifo]", raiz)) {
      if (img.dataset.ok) continue;
      const url = glifoURL(img.dataset.glifo, Number(img.dataset.escala || 2));
      if (url) { img.src = url; img.dataset.ok = "1"; }
      if (img.dataset.rot) img.style.transform = `rotate(${img.dataset.rot}deg)`;
    }
    for (const img of $$("img[data-item]", raiz)) {
      if (img.dataset.ok) continue;
      const url = itemURL(img.dataset.item, 2);
      if (url) { img.src = url; img.dataset.ok = "1"; }
    }
  }

  function aplicarTexturas() {
    if (!temArte()) return;
    const raiz = document.documentElement.style;
    try {
      raiz.setProperty("--tex-couro", `url(${Arte.texturaURL("couro")})`);
      raiz.setProperty("--tex-perg", `url(${Arte.texturaURL("pergaminho")})`);
      raiz.setProperty("--moldura-bronze", `url(${Arte.molduraURL("bronze")})`);
    } catch (e) { /* mantém as cores sólidas de reserva */ }
  }

  // ------------------------------------------------------------------
  // Descrição de itens (dica, loja)
  // ------------------------------------------------------------------
  const NOME_TIPO = {
    consumivel: "Consumível", recurso: "Recurso", arma: "Arma corpo a corpo", arma_distancia: "Arma à distância",
    escudo: "Escudo", armadura: "Armadura", cabeca: "Cabeça", colar: "Colar", pernas: "Pernas", pes: "Pés", anel: "Anel",
    municao: "Munição",
  };
  // Espaços do boneco (dados/itens.js: nome, lugar e silhueta) e o espaço de cada item (logica.js).
  const ESPACOS = typeof ESPACOS_BONECO !== "undefined" ? ESPACOS_BONECO : {};
  const nomeEspaco = (slot) => ESPACOS[slot]?.nome || slot;
  const slotDe = (id) => (typeof slotDoItem === "function" ? slotDoItem(id) : null);

  // Item com raridade e atributos (logica.js); a loja usa "flechas", que não é item.
  const info = (id) => (typeof infoItem === "function" ? infoItem(id) : typeof ITENS !== "undefined" ? ITENS[id] : null);
  const raridadeDe = (id) => info(id)?.raridade || "comum";
  const corRaridade = (r) => (typeof RARIDADES !== "undefined" && RARIDADES[r]?.cor) || "";
  // Classe e cor da borda do espaço (só acima de comum).
  function attrRaridade(id) {
    const r = raridadeDe(id);
    return r === "comum" ? "" : ` data-raridade="${r}" style="--rar:${corRaridade(r)}"`;
  }

  function atributoItem(id, p = jogador()) {
    if (id === "flechas") return "munição para o arco";
    const d = info(id);
    if (!d) return "";
    if (d.bonus) return `+${d.bonus} de dano`;
    if (d.defesa) return `+${d.defesa} de defesa`;
    // Peça do boneco só com atributos (colar de contas, anel de selo): o primeiro deles.
    const fixo = slotDe(id) && typeof efeitosDoItem === "function" ? efeitosDoItem(id)[0] : "";
    if (fixo) return fixo;
    if (id === "pocao") return `cura ${p && typeof curaPocao === "function" ? curaPocao(p) : 30} de vida`;
    if (id === "pocao_fe") return `+${typeof CURA_POCAO_FE !== "undefined" ? CURA_POCAO_FE : 40} de fé`;
    if (d.tipo === "municao") return "munição para o arco";
    if (typeof VALORES_VENDA !== "undefined" && VALORES_VENDA[id]) return `os mercadores pagam ${VALORES_VENDA[id]}`;
    return NOME_TIPO[d.tipo] || "";
  }

  // Onde a peça vai no boneco (e a regra das duas mãos); no espaço de munição, quantas há na pilha.
  function linhaBoneco(id, origem) {
    const slot = slotDe(id);
    if (!slot) return "";
    const p = jogador();
    if (origem === "equip" && slot === "municao" && p) {
      const n = typeof municaoNoEspaco === "function" ? municaoNoEspaco(p) : 0;
      const kg = String(Math.round(n * (typeof pesoItem === "function" ? pesoItem(id) : 0) * 10) / 10).replace(".", ",");
      return `${n} no espaço de munição (${kg} kg)`;
    }
    const duas = typeof maosDoItem === "function" && maosDoItem(id) === 2 ? " · usa as duas mãos (sem escudo)" : "";
    return `Vai ${ESPACOS[slot]?.lugar || "no boneco"}${duas}`;
  }

  function htmlDica(id, origem) {
    const d = info(id);
    if (!d) return "";
    // Peso em kg com vírgula; na mochila, com o total da pilha.
    const pesoUm = typeof pesoItem === "function" ? pesoItem(id) : d.peso;
    const naPilha = origem === "mochila" ? contarNaMochila(id) : 0;
    const pesoTxt = naPilha > 1 ? `${kg(pesoUm)} kg cada (${kg(pesoUm * naPilha)} kg)` : `${kg(pesoUm)} kg`;
    const partes = [NOME_TIPO[d.tipo] || "Item", atributoItem(id), pesoTxt].filter(Boolean);
    const r = raridadeDe(id);
    const nomeR = typeof RARIDADES !== "undefined" ? RARIDADES[r]?.nome : "";
    const linhaRaridade = r !== "comum" && nomeR ? `<p class="raridade" style="--rar:${corRaridade(r)}">${esc(nomeR)}</p>` : "";
    const principal = atributoItem(id);
    const atributos = (typeof textoAtributos === "function" ? textoAtributos(id) : []).filter((t) => t !== principal);
    const linhaAtributos = atributos.length ? `<ul class="atr-item">${atributos.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
    const boneco = linhaBoneco(id, origem);
    let acao = boneco ? `${boneco}. ` : "";
    if (origem === "equip") acao += "Arraste para a mochila, ou dê duplo clique, para guardar.";
    else if (slotDe(id)) acao += "Duplo clique equipa. Também pode arrastar ou tocar e escolher o espaço.";
    else if (d.tipo === "consumivel") acao = "Duplo clique bebe (mesmo sem precisar, para liberar espaço). Arraste para uma tecla de atalho.";
    else if (typeof VALORES_VENDA !== "undefined" && VALORES_VENDA[id]) acao = "Venda a qualquer mercador (há um em cada cidade).";
    if (origem === "mochila") acao += " Botão direito ou toque longo: jogar no chão.";
    const titulo = r !== "comum" ? ` class="rar" style="--rar:${corRaridade(r)}"` : "";
    return `<h4${titulo}>${esc(nomeDoItem(id))}</h4>${linhaRaridade}<p>${esc([...new Set(partes)].join(" · "))}</p>${linhaAtributos}${acao ? `<p class="acao">${esc(acao)}</p>` : ""}`;
  }

  // ------------------------------------------------------------------
  // Barras
  // ------------------------------------------------------------------
  function definirBarra(el, atual, max, texto, extra) {
    if (!el) return;
    const pct = max > 0 ? Math.max(0, Math.min(100, (100 * atual) / max)) : 0;
    const i = el.firstElementChild, b = el.querySelector("b");
    if (i) i.style.width = pct.toFixed(1) + "%";
    if (b && b.textContent !== texto) b.textContent = texto;
    el.setAttribute("aria-valuenow", String(Math.round(atual)));
    el.setAttribute("aria-valuemax", String(max));
    el.setAttribute("aria-valuetext", texto);
    if (extra) for (const [k, v] of Object.entries(extra)) el.classList.toggle(k, !!v);
  }

  function xpDoNivel(p) {
    const nivel = p.nivel || 1;
    if (typeof limiarNivel !== "function") return { atual: 0, total: 1 };
    const base = nivel > 1 ? limiarNivel(nivel - 1) : 0;
    const topo = limiarNivel(nivel);
    return { atual: Math.max(0, (p.xp || 0) - base), total: Math.max(1, topo - base) };
  }

  let xpEmNumeros = false; // um clique na barra de XP troca o % pelos números
  function atualizarBarras(p) {
    const max = typeof vidaMaxima === "function" ? vidaMaxima(p) : 100;
    const baixa = p.vida / max < 0.25;
    const feMax = typeof FE_MAXIMA !== "undefined" ? FE_MAXIMA : 100;
    const xp = xpDoNivel(p);
    const travada = !p.oracaoDesbloqueada;
    const vidaTxt = `${p.vida}/${max}`;
    const feTxt = travada ? "aprenda na Galileia" : `${p.fe || 0}/${feMax}`;
    // XP em % até o próximo nível (para baixo, como na janela de habilidades); os números ficam na dica e,
    // com um clique na barra, no lugar do %.
    const maximo = typeof NIVEL_MAXIMO !== "undefined" && p.nivel >= NIVEL_MAXIMO;
    const pctXp = maximo ? 100 : Math.min(99, Math.floor((100 * xp.atual) / xp.total));
    const numerosXp = `${fmt(xp.atual)}/${fmt(xp.total)} XP`;
    const xpTxt = maximo ? "nível máximo" : xpEmNumeros ? numerosXp : `${pctXp}%`;
    definirBarra($("#barraVida"), p.vida, max, vidaTxt, { baixa });
    definirBarra($("#barraFe"), travada ? 0 : p.fe || 0, feMax, feTxt, { travada });
    // Reserva de descanso do Sábado: a barra ganha contorno azul e o título explica o XP em dobro.
    const descanso = Math.floor(p.descanso?.xp || 0);
    const tituloXp = (maximo ? "Nível máximo." : `${numerosXp}: faltam ${fmt(xp.total - xp.atual)} para o nível ${p.nivel + 1}.`) +
      (descanso ? ` Reserva de descanso: ${fmt(descanso)} XP (abates com XP em dobro).` : "");
    for (const id of ["#barraXp", "#hudXp"]) if ($(id) && $(id).title !== tituloXp) $(id).title = tituloXp;
    definirBarra($("#barraXp"), xp.atual, xp.total, xpTxt, { descanso });
    $("#barraXp")?.setAttribute("aria-valuetext", `${pctXp}%, ${numerosXp}`);
    definirBarra($("#hudVida"), p.vida, max, vidaTxt, { baixa });
    definirBarra($("#hudFe"), travada ? 0 : p.fe || 0, feMax, feTxt, { travada });
    definirBarra($("#hudXp"), xp.atual, xp.total, xpTxt, { descanso });
    $("#hudVidaTxt").textContent = vidaTxt;
    $("#hudFeTxt").textContent = travada ? "—" : `${p.fe || 0}`;
    $("#hudXpTxt").textContent = `Nv ${p.nivel}`;
    const env = (p.status?.veneno?.ate || 0) > Date.now();
    document.body.classList.toggle("envenenado", env);
    atualizarStatus(p);
  }

  // Status ativos do jogador (JGB-16), na ficha e no HUD do celular. Só lê, por visaoStatus.
  let htmlStatus = "";
  function atualizarStatus(p) {
    if (typeof visaoStatus !== "function") return;
    const html = visaoStatus(p, Date.now())
      .map((s) => {
        const seg = Math.ceil(s.restanteMs / 1000);
        const pilhas = s.pilhas > 1 ? ` ${s.pilhas}×` : "";
        return `<span class="status-chip" data-status="${esc(s.tipo)}" title="${esc(s.nome)}: ${seg} s">${esc(s.nome)}${pilhas} ${seg}s</span>`;
      })
      .join("");
    if (html === htmlStatus) return;
    htmlStatus = html;
    for (const id of ["#statusFicha", "#statusHud"]) if ($(id)) $(id).innerHTML = html;
    // No celular, os selos aumentam o HUD: os avisos descem a mesma altura.
    const hud = $("#statusHud");
    const altura = hud && hud.offsetParent && html ? hud.offsetHeight + 4 : 0;
    $("#palco")?.style.setProperty("--status-hud", `${altura}px`);
    posicionarAvisos();
  }

  // ------------------------------------------------------------------
  // Personagem
  // ------------------------------------------------------------------
  let assinaturaRetrato = "", urlBoneco = "";
  function atualizarPersonagem(p) {
    $("#seloNivel").textContent = p.nivel;
    $("#fichaNivel").textContent = `Nível ${p.nivel}`;
    const eq = p.equipamento || {};
    const visualPj = typeof visualDoJogador === "function" ? visualDoJogador(p) : {};
    const ass = JSON.stringify([eq, visualPj]);
    if (ass !== assinaturaRetrato && temArte()) {
      assinaturaRetrato = ass;
      let chave = "pj_jogador";
      try { chave = Arte.garantirJogador ? Arte.garantirJogador(eq, { traje: visualPj.traje, cores: visualPj.cores }) : chave; } catch (e) { chave = "pj_jogador"; }
      const url = retratoURL(chave, { escala: 3, recorte: "busto" }) || retratoURL("pj_jogador", { escala: 3 });
      if (url) $("#retratoJogador").src = url;
      // Boneco do painel Equipamento: o corpo inteiro, de frente, com o que está vestido.
      urlBoneco = retratoURL(chave, { escala: 4, recorte: "inteiro" }) || retratoURL("pj_jogador", { escala: 4, recorte: "inteiro" });
      const fig = $("#gradeEquip .boneco-figura");
      if (fig && urlBoneco) fig.innerHTML = `<img class="px" src="${urlBoneco}" alt="">`;
    }
    atualizarFicha(p);
    if (typeof estatisticasCombate !== "function") return;
    const s = estatisticasCombate(p);
    // Carga (linha Capacidade), flechas (espaço Munição do Equipamento) e pontos de tarefa (topo) já aparecem em
    // outro lugar: aqui ficam os números do combate.
    const linhas = [
      ["Dano corpo", s.danoCorpo],
      ["Dano arco", s.temArco ? s.danoDistancia : "—"],
      ["Defesa", `${s.defesa} (−${s.reducaoDano}%)`],
      ["Crítico", `${String(s.critico).replace(".", ",")}%`],
    ];
    const html = linhas.map(([k, v, cls]) => `<div${cls ? ` class="${cls}"` : ""}><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    const dl = $("#atributos");
    if (dl.innerHTML !== html) dl.innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Janela de habilidades (painel Personagem). Só lê fichaDeHabilidades(p, agora) (logica.js). As linhas são
  // criadas uma vez e depois só mudam texto, largura e classe (a 4 Hz, para o vigor correr): o foco, o hover e
  // o destaque de quem subiu não se perdem. Habilidades e Ofícios recolhem; a escolha fica neste navegador.
  // ------------------------------------------------------------------
  const CHAVE_FICHA = "jornada_ficha";
  let prefFicha = {};
  try { prefFicha = JSON.parse(localStorage.getItem(CHAVE_FICHA) || "{}") || {}; } catch (e) { prefFicha = {}; }
  const salvarFicha = () => { try { localStorage.setItem(CHAVE_FICHA, JSON.stringify(prefFicha)); } catch (e) { /* sem armazenamento */ } };
  let niveisFicha = null; // último nível visto de cada linha (para o destaque e o aviso de avanço)

  function linhasDa(ul, chaves) {
    if (ul.dataset.chaves === chaves.join(" ")) return;
    ul.dataset.chaves = chaves.join(" ");
    ul.innerHTML = chaves.map((k) => `<li><button type="button" class="hab-linha" data-linha="${esc(k)}" aria-expanded="false"><span class="nome"></span><b class="valor"></b>` +
      `<span class="fio" aria-hidden="true"><i></i></span><span class="hab-dica"></span></button></li>`).join("");
  }
  // l: { nome (HTML), valor, pct, dica, classes: { classe: ligada }, dados: { atributo: valor } }
  function preencherLinha(ul, chave, l) {
    const b = ul.querySelector(`[data-linha="${chave}"]`);
    if (!b) return;
    const nome = b.querySelector(".nome"), valor = b.querySelector(".valor"), fio = b.querySelector(".fio i"), dica = b.querySelector(".hab-dica");
    if (nome.innerHTML !== l.nome) nome.innerHTML = l.nome;
    if (valor.textContent !== l.valor) valor.textContent = l.valor;
    const w = `${Math.max(0, Math.min(100, l.pct)).toFixed(1)}%`;
    if (fio.style.width !== w) fio.style.width = w;
    if (dica.textContent !== l.dica) dica.textContent = l.dica;
    if (b.title !== l.dica) b.title = l.dica;
    const rotulo = `${l.rotulo || nome.textContent}: ${l.valor}. ${l.dica}`;
    if (b.getAttribute("aria-label") !== rotulo) b.setAttribute("aria-label", rotulo);
    for (const [k, v] of Object.entries(l.classes || {})) b.classList.toggle(k, !!v);
    for (const [k, v] of Object.entries(l.dados || {})) if (b.dataset[k] !== v) b.dataset[k] = v;
  }
  function destacarLinha(ul, chave) {
    const b = ul?.querySelector(`[data-linha="${chave}"]`);
    if (!b) return;
    b.classList.remove("ganhou");
    void b.offsetWidth; // recomeça a animação
    b.classList.add("ganhou");
    clearTimeout(b._ganhou);
    b._ganhou = setTimeout(() => b.classList.remove("ganhou"), 1500);
  }

  function atualizarFicha(p) {
    if (typeof fichaDeHabilidades !== "function") return;
    const f = fichaDeHabilidades(p, Date.now());
    // Capacidade e vigor (sempre à vista).
    const med = $("#listaMedidas");
    if (med) {
      linhasDa(med, ["carga", "vigor"]);
      const c = f.carga, v = f.vigor;
      const livre = Math.max(0, c.maximo - c.atual);
      preencherLinha(med, "carga", {
        nome: "Capacidade", valor: c.texto, pct: c.pct,
        dica: c.pct >= 100 ? "Mochila cheia: venda, largue ou guarde algo para pegar mais." : `Livre: ${kg(livre)} kg. Sobe ${kg(typeof CARGA_POR_NIVEL !== "undefined" ? CARGA_POR_NIVEL : 3)} kg por nível e com os alforjes.`,
        classes: { quase: c.pct >= 90 && c.pct < 100, cheia: c.pct >= 100 },
      });
      const cair = v.proxima ? ` Cai para ${v.proxima.nome.toLowerCase()} (${v.proxima.texto}) em ${typeof textoVigor === "function" ? textoVigor(v.ateCair) : ""} de caçada.` : "";
      preencherLinha(med, "vigor", {
        nome: `Vigor <small>${esc(v.faixa.nome.toLowerCase())}</small>`, rotulo: `Vigor, ${v.faixa.nome.toLowerCase()}`,
        valor: v.texto, pct: v.pct,
        dica: `${v.faixa.nome}: ${v.faixa.texto}.${cair} Gasta só caçando; volta longe do jogo (1 minuto a cada ${typeof REGRAS_VIGOR !== "undefined" ? REGRAS_VIGOR.regenCadaMinutos : 3}) e enche no descanso do Sábado.`,
        dados: { faixa: v.faixa.id },
      });
    }
    // Habilidades de combate.
    const ul = $("#listaHabilidades");
    if (ul) {
      linhasDa(ul, f.combate.map((h) => h.chave));
      for (const h of f.combate) {
        preencherLinha(ul, h.chave, {
          nome: esc(h.nome), valor: String(h.nivel), pct: h.bloqueada ? 0 : h.pct,
          dica: h.bloqueada ? h.dica : `${h.pct}% · ${h.dica} Agora: ${h.efeito}.`,
          classes: { bloqueada: h.bloqueada },
        });
      }
    }
    const curto = { corpo: "Corpo", distancia: "Distância", defesa: "Defesa", oracao: "Oração" };
    const resumo = f.combate.map((h) => `${curto[h.chave] || h.nome} ${h.nivel}`).join(" · ");
    const el = $("#habilidades");
    if (el && el.textContent !== resumo) el.textContent = resumo;
    // Ofícios.
    const uo = $("#listaOficiosFicha");
    if (uo) {
      linhasDa(uo, f.oficios.map((o) => o.id));
      for (const o of f.oficios) {
        preencherLinha(uo, o.id, { nome: esc(o.nome), valor: String(o.nivel), pct: o.pct, dica: `${o.pct}% · ${o.dica} Janela Ofícios: tecla O.` });
      }
      const melhor = f.oficios.reduce((a, o) => (o.nivel > a.nivel ? o : a), f.oficios[0]);
      const r = melhor && melhor.nivel > 1 ? `${melhor.nome} ${melhor.nivel}` : "todos no 1";
      const ro = $("#resumoOficios");
      if (ro && ro.textContent !== r) ro.textContent = r;
    }
    // Quem subiu pisca; as habilidades de combate avisam no console (aba Servidor).
    const agoraNiveis = {};
    for (const h of f.combate) agoraNiveis[h.chave] = h.nivel;
    for (const o of f.oficios) agoraNiveis[`of:${o.id}`] = o.nivel;
    if (niveisFicha && niveisFicha._id === p.id) {
      for (const h of f.combate) {
        if (h.nivel > (niveisFicha[h.chave] ?? h.nivel)) {
          destacarLinha(ul, h.chave);
          registrar(`Você avançou em ${h.nome}: nível ${h.nivel}.`, "avanco");
        }
      }
      for (const o of f.oficios) if (o.nivel > (niveisFicha[`of:${o.id}`] ?? o.nivel)) destacarLinha(uo, o.id);
    }
    niveisFicha = { ...agoraNiveis, _id: p.id };
  }

  function abrirSecaoFicha(qual, aberta) {
    const botao = qual === "oficios" ? $("#btnOficiosFicha") : $("#btnHabilidades");
    const corpo = qual === "oficios" ? $("#listaOficiosFicha") : $("#corpoHabilidades");
    if (!botao || !corpo) return;
    botao.setAttribute("aria-expanded", String(aberta));
    corpo.hidden = !aberta;
  }
  function ligarFicha() {
    // Sem escolha guardada, as habilidades começam abertas, menos no largo com a tela baixa (até 1000 px), onde
    // a coluna direita não teria espaço para a Batalha; no médio e no celular o painel tem aba ou folha própria.
    // No largo, habilidadesPeloEspaco revê a escolha pelo espaço da coluna depois do 1º desenho (dock de baixo).
    const padrao = !(calcModo() === "largo" && innerHeight < 1000);
    abrirSecaoFicha("habilidades", typeof prefFicha.habilidades === "boolean" ? prefFicha.habilidades : padrao);
    abrirSecaoFicha("oficios", prefFicha.oficios === true);
    for (const [id, qual] of [["#btnHabilidades", "habilidades"], ["#btnOficiosFicha", "oficios"]]) {
      $(id)?.addEventListener("click", () => {
        const aberta = $(id).getAttribute("aria-expanded") !== "true";
        abrirSecaoFicha(qual, aberta);
        prefFicha[qual] = aberta;
        salvarFicha();
      });
    }
    // Uma linha abre (ou fecha) a dica do que falta: no toque não há o title do mouse.
    $("#pPersonagem")?.addEventListener("click", (e) => {
      const b = e.target.closest(".hab-linha");
      if (!b) return;
      const aberta = !b.classList.contains("aberta");
      b.classList.toggle("aberta", aberta);
      b.setAttribute("aria-expanded", String(aberta));
    });
    // XP em % (o costume do gênero); um clique na barra mostra os números, outro volta.
    $("#barraXp")?.addEventListener("click", () => { xpEmNumeros = !xpEmNumeros; const p = jogador(); if (p) atualizarBarras(p); });
  }

  // ------------------------------------------------------------------
  // Missão
  // ------------------------------------------------------------------
  function atualizarMissao(p) {
    const texto = typeof textoMissaoAtual === "function" ? textoMissaoAtual(p) : "";
    const i = texto.indexOf(" · ");
    const area = i >= 0 ? texto.slice(0, i) : (typeof areas !== "undefined" && areas[p.area]?.nome) || "";
    const objetivo = i >= 0 ? texto.slice(i + 3) : texto;
    let titulo = area;
    if (typeof CAPITULOS !== "undefined" && CAPITULOS[p.area] && typeof ORDEM_CAPITULOS !== "undefined") {
      titulo = `${CAPITULOS[p.area].nome} · capítulo ${ORDEM_CAPITULOS.indexOf(p.area) + 1} de ${ORDEM_CAPITULOS.length}`;
    }
    const prog = objetivo.match(/(\d+)\s*\/\s*(\d+)(?!.*\d+\s*\/\s*\d+)/);
    $("#missaoCapitulo").textContent = titulo;
    $("#missaoObjetivo").textContent = objetivo;
    const pr = $("#missaoProgresso");
    pr.hidden = !prog;
    if (prog) pr.textContent = `${prog[1]}/${prog[2]}`;
    $("#missaoLinhaTxt").textContent = objetivo;
    $("#missaoLinhaProg").textContent = prog ? `${prog[1]}/${prog[2]}` : "";
  }

  // ------------------------------------------------------------------
  // Caçadas: linhas no painel Missão e saldo de pontos no topo
  // ------------------------------------------------------------------
  const temCacadas = () => typeof tarefasDoJogador === "function" && typeof tarefasDoMural === "function";
  const limiteCacadas = () => (typeof REGRAS_TAREFAS !== "undefined" ? REGRAS_TAREFAS.limiteAtivas : 3);
  const textoPts = (n) => (n === 1 ? "1 ponto de tarefa" : `${n} pontos de tarefa`);
  // Ativas e cumpridas (as que ocupam vaga), na ordem em que foram aceitas.
  const cacadasAtivas = (p) => (temCacadas() ? tarefasDoJogador(p).filter((t) => t.estado !== "guardada") : []);

  let assinaturaCacadas = "";
  function atualizarCacadas(p) {
    const lista = $("#missaoCacadas");
    if (!lista) return;
    const ativas = cacadasAtivas(p);
    const ass = JSON.stringify(ativas.map((t) => [t.id, t.progresso, t.meta, t.estado]));
    if (ass === assinaturaCacadas) return;
    assinaturaCacadas = ass;
    lista.hidden = !ativas.length;
    lista.innerHTML = ativas.map((t) => {
      const cumprida = t.estado === "cumprida";
      const pct = t.meta > 0 ? Math.min(100, (100 * t.progresso) / t.meta) : 0;
      const estado = cumprida ? "cumprida: entregue a qualquer atalaia" : `${t.progresso} de ${t.meta}`;
      const valor = cumprida ? '<b class="feita">Cumprida</b>' : `<span class="mini-barra"><i style="width:${pct}%"></i></span><b>${t.progresso}/${t.meta}</b>`;
      return `<li${cumprida ? ' class="cumprida"' : ""}><button type="button" data-abrir-cacadas title="${esc(t.nome)} · ${esc(t.nomeArea)}"
        aria-label="Caçada ${esc(t.nome)}, ${estado}. Abre suas caçadas.">${imgGlifo("ui_cacada")}<span class="nome">${esc(t.curto)}</span>${valor}</button></li>`;
    }).join("");
  }

  // O saldo aparece no topo quando as caçadas entram no jogo do jogador: um mural aberto,
  // uma caçada já tocada ou pontos já ganhos (personagem novo não vê um "0" sem explicação).
  function cacadasConhecidas(p) {
    if ((p.pontosTarefaTotal || 0) > 0 || Object.keys(p.tarefas || {}).length) return true;
    if (typeof npcs === "undefined" || typeof estadoMissaoNpc !== "function") return false;
    return Object.values(npcs).some((n) => n.papel === "mural" && estadoMissaoNpc(p, n.id) !== null);
  }
  function atualizarPontos(p) {
    const b = $("#pontos");
    if (!b) return;
    b.hidden = !temCacadas() || !cacadasConhecidas(p);
    const v = String(p.pontosTarefa || 0);
    if ($("#pontosValor").textContent !== v) $("#pontosValor").textContent = v;
  }

  // ------------------------------------------------------------------
  // Mochila, bolsa, equipamento e atalhos (redesenha só quando muda)
  // ------------------------------------------------------------------
  let selecao = null; // {origem:"item", id} | {origem:"equip", slot}
  let assinaturaItens = "";
  const ehMochila = (tipo) => ["arma", "arma_distancia", "escudo", "armadura", "cabeca", "colar", "pernas", "pes", "anel", "municao"].includes(tipo);

  // ------------------------------------------------------------------
  // Boneco do painel Equipamento (como nos MMORPGs clássicos): colar, cabeça e mochila; mão da arma,
  // armadura e mão do escudo; anel, pernas e munição; pés. Cada espaço vazio mostra a silhueta do que vai
  // nele; o da mochila abre o painel Mochila (e recebe o que for guardado). Ao lado, a figura com o que está
  // vestido e o ataque da mão. Arrastar, duplo clique e tocar-e-escolher usam data-equip-slot.
  // ------------------------------------------------------------------
  const ORDEM_BONECO = ["colar", "cabeca", "mochila", "arma", "armadura", "escudo", "anel", "pernas", "municao", "pes"];
  // O que vai num espaço, pela 1ª palavra dos itens dele: "espada, arco ou funda", "turbante, capacete ou elmo".
  const exemplosDoEspaco = (slot) => {
    const tipos = typeof tiposDoSlot === "function" ? tiposDoSlot(slot) : [];
    const todos = typeof ITENS !== "undefined" ? Object.values(ITENS) : [];
    const nomes = [...new Set(todos.filter((d) => tipos.includes(d.tipo)).map((d) => d.nome.split(" ")[0].toLowerCase()))];
    return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} ou ${nomes[nomes.length - 1]}` : nomes[0] || "";
  };
  const imgSilhueta = (chave) => {
    const s = silhuetaURL(chave);
    return s ? `<img class="px silhueta" src="${s}" width="32" height="32" alt="">` : "";
  };
  function htmlEspacoBoneco(p, slot) {
    const eq = p.equipamento || {};
    const nome = nomeEspaco(slot);
    const sel = selecao && selecao.origem === "equip" && selecao.slot === slot ? " selecionado" : "";
    const id = eq[slot];
    if (id && info(id)) {
      const n = slot === "municao" && typeof municaoNoEspaco === "function" ? municaoNoEspaco(p) : 0;
      const efeito = typeof efeitosDoItem === "function" ? efeitosDoItem(id).join(", ") : "";
      const rotulo = slot === "municao" ? `${nome}: ${n} ${n === 1 ? "unidade" : "unidades"} de ${nomeDoItem(id)}` : `${nome}: ${nomeDoItem(id)}${efeito ? `, ${efeito}` : ""}`;
      return `<button type="button" class="equip e-${slot} cheio${sel}" draggable="true" data-equip-slot="${slot}" data-dica="${esc(id)}" data-dica-origem="equip" aria-label="${esc(rotulo)}">
        <span class="slot"${attrRaridade(id)}>${htmlItem(id)}${n ? `<span class="qtd">${n}</span>` : ""}</span></button>`;
    }
    // Mão do escudo presa por uma arma de duas mãos: mostra o arco apagado e diz por quê.
    const naMao = eq.arma;
    if (slot === "escudo" && naMao && typeof maosDoItem === "function" && maosDoItem(naMao) === 2) {
      const motivo = typeof textoDuasMaos === "function" ? textoDuasMaos(naMao) : "Arma de duas mãos.";
      return `<button type="button" class="equip e-escudo vazio bloqueado${sel}" data-equip-slot="escudo" aria-label="${esc(`${nome}: ocupada. ${motivo}`)}" title="${esc(motivo)}">
        <span class="slot">${htmlItem(naMao)}</span></button>`;
    }
    const semMunicao = slot === "municao" && eq.arma && info(eq.arma)?.semMunicao;
    const exemplos = exemplosDoEspaco(slot);
    const dica = semMunicao ? `${nome}: vazio (a ${nomeDoItem(eq.arma).toLowerCase()} não usa munição)` : `${nome}: vazio${exemplos ? ` (${exemplos})` : ""}`;
    return `<button type="button" class="equip e-${slot} vazio${sel}" data-equip-slot="${slot}" aria-label="${esc(dica)}" title="${esc(dica)}">
      <span class="slot">${imgSilhueta(ESPACOS[slot]?.silhueta)}</span></button>`;
  }
  function htmlMochilaBoneco(peso, cap) {
    const pct = cap > 0 ? Math.max(0, Math.min(100, (100 * peso) / cap)) : 0;
    const kg = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
    const rotulo = `Mochila: ${kg(peso)} de ${kg(cap)} kg. Abre o painel Mochila; solte aqui um equipamento para guardá-lo.`;
    const url = itemURL("mochila", 2);
    return `<button type="button" class="equip e-mochila zona-soltar" data-abrir-mochila data-zona="mochila" aria-label="${esc(rotulo)}" title="${esc(rotulo)}">
      <span class="slot">${url ? `<img class="px" src="${url}" width="32" height="32" alt="">` : ""}<span class="carga${pct >= 90 ? " cheia" : ""}" aria-hidden="true"><i style="width:${pct.toFixed(0)}%"></i></span></span></button>`;
  }
  function htmlLadoBoneco(p) {
    const s = typeof estatisticasCombate === "function" ? estatisticasCombate(p) : null;
    const dados = s
      ? `<p class="boneco-modo">${s.modoAtaque === "distancia" ? "À distância" : "Corpo a corpo"}</p>
          <dl class="boneco-dados"><dt>Ataque</dt><dd>${esc(s.danoAtaque)}</dd><dt>Defesa</dt><dd>${esc(s.defesa)}</dd></dl>`
      : "";
    return `<div class="boneco-lado"><div class="boneco-figura" aria-hidden="true">${urlBoneco ? `<img class="px" src="${urlBoneco}" alt="">` : ""}</div>${dados}</div>`;
  }
  function atualizarBoneco(p, peso, cap) {
    $("#gradeEquip").innerHTML = ORDEM_BONECO.map((slot) => (slot === "mochila" ? htmlMochilaBoneco(peso, cap) : htmlEspacoBoneco(p, slot))).join("") + htmlLadoBoneco(p);
  }
  // O espaço da mochila no boneco: mostra o painel Mochila (no largo e no médio, reabre ou restaura a janela,
  // mesmo fechada pela tecla I; no celular, na folha Mochila) e o destaca por um instante.
  function abrirMochila() {
    if (modo === "estreito" && folhaAtual !== "mochila") abrirFolha("mochila");
    // Largo e médio: a janela Mochila reabre (fechada) ou volta a crescer (minimizada); "Janelas laterais".
    else if (modo !== "estreito" && (janelaFechada("pMochila") || janelaMinimizada("pMochila"))) mostrarJanela("pMochila");
    const m = $("#pMochila");
    if (!m) return;
    m.scrollIntoView?.({ block: "nearest", behavior: reduzMovimento() ? "auto" : "smooth" });
    m.classList.remove("destaque-mochila");
    void m.offsetWidth;
    m.classList.add("destaque-mochila");
    setTimeout(() => m.classList.remove("destaque-mochila"), 1200);
  }

  function contar(lista) {
    const g = new Map();
    for (const id of lista || []) g.set(id, (g.get(id) || 0) + 1);
    return g;
  }

  function htmlSlotItem(id, qtd) {
    const nome = nomeDoItem(id);
    const sel = selecao && selecao.origem === "item" && selecao.id === id ? " selecionado" : "";
    return `<button type="button" class="slot cheio${sel}" role="listitem" draggable="true" data-item="${esc(id)}" data-dica="${esc(id)}" data-dica-origem="mochila"${attrRaridade(id)} aria-label="${esc(nome)}${qtd > 1 ? `, ${qtd} unidades` : ""}">${htmlItem(id)}${qtd > 1 ? `<span class="qtd">${qtd}</span>` : ""}</button>`;
  }

  function atualizarItens(p, forcar) {
    // A seleção não entra na assinatura: marcá-la só troca a classe
    // .selecionado (marcarSelecao), sem recriar os botões. Recriá-los entre
    // os dois cliques impedia o navegador de reconhecer o duplo clique.
    // A capacidade entra: um alforje da troca muda o "x / 170 kg" sem mexer na mochila.
    const cap = typeof capacidadeCarga === "function" ? capacidadeCarga(p) : 0;
    // O boneco mostra também a pilha de munição e o ataque e a defesa (que sobem com o nível e as habilidades).
    const s = typeof estatisticasCombate === "function" ? estatisticasCombate(p) : {};
    const ass = JSON.stringify([p.inventario, p.equipamento, p.hotkeys, cap, p.quantidadeMunicao, s.danoAtaque, s.defesa]);
    if (!forcar && ass === assinaturaItens) return;
    assinaturaItens = ass;
    const g = contar(p.inventario);
    const mochila = [], bolsa = [];
    for (const [id, qtd] of g) {
      const d = info(id);
      if (!d) continue;
      (ehMochila(d.tipo) ? mochila : bolsa).push(htmlSlotItem(id, qtd));
    }
    const vazio = '<span class="slot vazio" role="listitem" aria-hidden="true"></span>';
    const encher = (arr, n) => { while (arr.length < n) arr.push(vazio); return arr.join(""); };
    $("#gradeMochila").innerHTML = encher(mochila, 15);
    $("#gradeBolsa").innerHTML = encher(bolsa, 15);
    const peso = typeof pesoCarregado === "function" ? pesoCarregado(p) : 0;
    // Carga em kg com vírgula; acima de 90% fica âmbar e, cheia, vermelha (é hora de vender ou jogar no chão).
    const pesoEl = $("#pesoTexto");
    pesoEl.textContent = `${kg(peso)} / ${kg(cap)} kg`;
    pesoEl.classList.toggle("quase-cheia", cap > 0 && peso >= cap * 0.9 && peso < cap);
    pesoEl.classList.toggle("cheia", cap > 0 && peso >= cap);
    pesoEl.title = `Carga: ${kg(peso)} de ${kg(cap)} kg${cap > peso ? ` (livres: ${kg(cap - peso)} kg)` : ""}`;

    atualizarBoneco(p, peso, cap);

    // Atalhos (com vocação, as teclas 1 a 8 são das habilidades e os itens ficam em Shift + 1 a 6)
    const hk = p.hotkeys || [];
    const shift = temVocacao(p) ? "⇧" : "";
    let html = "";
    for (let i = 0; i < 6; i++) {
      const id = hk[i];
      const qtd = id ? g.get(id) || 0 : 0;
      const nome = id ? nomeDoItem(id) : "";
      html += `<button type="button" class="atalho${id && !qtd ? " esgotado" : ""}" data-atalho="${i}" ${id ? `data-dica="${esc(id)}"` : ""}
        aria-label="Atalho ${shift ? "Shift + " : ""}${i + 1}: ${id ? `${esc(nome)}, ${qtd} restantes` : "vazio"}" title="${id ? `${esc(nome)} · tecla ${shift ? "Shift + " : ""}${i + 1} · botão direito limpa` : `Solte um consumível · tecla ${shift ? "Shift + " : ""}${i + 1}`}">
        <span class="tecla-n">${shift}${i + 1}</span>${id ? htmlItem(id) : ""}${id ? `<span class="qtd">${qtd}</span>` : ""}</button>`;
    }
    $("#atalhos").innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Lista de batalha e quadro de alvo
  // ------------------------------------------------------------------
  let assinaturaBatalha = "";
  const ehChefe = (id) => temArte() && Arte.CHEFES && Arte.CHEFES.has && Arte.CHEFES.has(id);
  // Ficha da criatura (nome de campeão, tier, comportamento e status) e a vida máxima efetiva.
  const ficha = (id) => (typeof Mundo !== "undefined" && Mundo.fichaInimigo ? Mundo.fichaInimigo(ID, id) : null);
  const vidaMax = (e) => (typeof Mundo !== "undefined" && Mundo.vidaMaximaInimigo ? Mundo.vidaMaximaInimigo(ID, e.id) : e.vidaMaxima);
  const nomeDaCriatura = (e) => ficha(e.id)?.nome || nomeCurto(e.nome);
  function textoFicha(f) {
    if (!f) return "";
    const tier = f.campeao ? `Campeão (${f.modificadores.length} modificador${f.modificadores.length > 1 ? "es" : ""})` : f.tier !== "normal" && typeof TIERS_CRIATURAS !== "undefined" ? TIERS_CRIATURAS[f.tier].nome : "";
    const amuleto = f.amuleto ? `Amuleto +${Math.round(f.amuleto * 100)}% de dano` : "";
    return [tier, f.titulo, `Nível ${f.nivel}`, f.familia, ...f.comportamentos, f.status ? `Causa ${f.status.toLowerCase()}` : "", amuleto].filter(Boolean).join(" · ");
  }
  function marcasDaCriatura(f) {
    if (!f) return "";
    const cura = f.curandeiro ? '<span class="marca-tier cura" title="Curandeiro: cura as outras criaturas. Prioridade de alvo!">CURA</span>' : "";
    return marcaTier(f) + cura;
  }
  function marcaTier(f) {
    if (f.campeao) return '<span class="marca-tier campeao" title="Campeão">CAMPEÃO</span>';
    if (f.nomeado) return '<span class="marca-tier raro" title="Raro nomeado">RARO</span>';
    if (f.tier === "elite") return '<span class="marca-tier elite" title="Elite">ELITE</span>';
    return "";
  }
  const alvoAtual = () => (window.Jogo && typeof Jogo.alvoAtual === "function" ? Jogo.alvoAtual() : window.gameScene?.alvoId) || null;

  function inimigosVivos(p) {
    if (typeof inimigos === "undefined" || typeof Mundo === "undefined") return [];
    return Object.values(inimigos).filter((e) => e.area === p.area && Mundo.obterVidaInimigo(ID, e.id) > 0);
  }

  function atualizarBatalha(p) {
    const alvo = alvoAtual();
    // Prioridade de alvo: curandeiros primeiro na lista, depois a ordem de sempre.
    const vivos = inimigosVivos(p).sort((a, b) => (ficha(b.id)?.curandeiro ? 1 : 0) - (ficha(a.id)?.curandeiro ? 1 : 0));
    const cacadas = cacadasAtivas(p).map((t) => [t.id, t.progresso, t.estado]);
    const ass = JSON.stringify([alvo, vivos.map((e) => [e.id, Mundo.obterVidaInimigo(ID, e.id), ficha(e.id)?.nome]), cacadas]);
    if (ass === assinaturaBatalha) return;
    assinaturaBatalha = ass;
    const caixa = $("#linhasBatalha");
    if (!vivos.length) {
      caixa.innerHTML = '<p class="vazio-txt">Nenhum inimigo por perto nesta região.</p>';
    } else {
      caixa.innerHTML = vivos.map((e) => {
        const vida = Mundo.obterVidaInimigo(ID, e.id);
        const max = vidaMax(e);
        const pct = Math.max(0, Math.min(100, (100 * vida) / max));
        const f = ficha(e.id);
        const curto = nomeDaCriatura(e);
        const mini = retratoURL(visualDe(e.id), { escala: 2, recorte: "busto" });
        // Caçadas para as quais este abate conta: glifo de contagem, com uma linha por caçada no title.
        const conta = typeof tarefasDoInimigo === "function" ? tarefasDoInimigo(p, e.id) : [];
        const titulo = conta.map((t) => `Conta para: ${t.nome} (${t.progresso}/${t.meta})`).join("\n");
        const marcaCacada = conta.length ? `<span class="marca-cacada" title="${esc(titulo)}">${imgGlifo("ui_cacada", "px g16", "conta para caçada")}</span>` : "";
        const marcas = marcasDaCriatura(f) + (ehChefe(e.id) ? imgGlifo("ui_estrela_chefe", "px g16", "chefe") : "") + (e.veneno ? imgGlifo("ui_gota", "px g16", "venenoso") : "") + marcaCacada;
        const rotulo = `${curto}, vida ${vida} de ${max}${ehChefe(e.id) ? ", chefe" : ""}${f?.campeao ? ", campeão" : ""}${conta.length ? `, conta para ${conta.map((t) => t.nome).join(" e ")}` : ""}`;
        const classe = f?.campeao ? " campeao" : f?.nomeado ? " nomeado" : "";
        return `<button type="button" role="listitem" class="linha-inimigo${classe}${alvo === e.id ? " selecionada" : ""}" data-alvo="${esc(e.id)}" aria-pressed="${alvo === e.id}" aria-label="${esc(rotulo)}" title="${esc(textoFicha(f))}">
          <span class="mini">${mini ? `<img class="px" src="${mini}" alt="">` : ""}</span>
          <span class="nome"><span class="nome-txt">${esc(curto)}</span>${marcas}</span>
          <span class="vida"><span class="mini-barra"><i style="width:${pct}%"></i></span><b>${vida}/${max}</b></span></button>`;
      }).join("");
    }
    desenharQuadroAlvo(alvo);
  }

  let alvoDesenhado = undefined;
  function desenharQuadroAlvo(alvo) {
    const caixas = [$("#quadroAlvo"), $("#hudAlvo")];
    const e = alvo && typeof inimigos !== "undefined" ? inimigos[alvo] : null;
    if (alvo !== alvoDesenhado) {
      alvoDesenhado = alvo;
      for (const c of caixas) {
        if (!c) continue;
        if (!e) { c.innerHTML = ""; c.classList.remove("ativo"); continue; }
        const mini = retratoURL(visualDe(e.id), { escala: 2, recorte: "busto" });
        c.innerHTML = `<span class="mini">${mini ? `<img class="px" src="${mini}" alt="">` : ""}</span>
          <span class="alvo-info"><strong title="${esc(textoFicha(ficha(e.id)))}">${ehChefe(e.id) ? imgGlifo("ui_estrela_chefe", "px g16") : ""}${marcasDaCriatura(ficha(e.id))}${esc(nomeDaCriatura(e))}</strong>
          <span class="alvo-barra"><i></i></span><span class="alvo-recarga" title="Recarga do autoataque"><i></i></span></span>
          <span class="alvo-vida"></span>`;
        c.classList.add("ativo");
        c.setAttribute("aria-label", `Alvo: ${nomeDaCriatura(e)}. ${textoFicha(ficha(e.id))}`);
      }
    }
    document.body.classList.toggle("com-alvo", !!e);
    if (e) atualizarVidaAlvo(e);
  }

  function atualizarVidaAlvo(e) {
    const vida = Mundo.obterVidaInimigo(ID, e.id);
    for (const c of [$("#quadroAlvo"), $("#hudAlvo")]) {
      if (!c || !c.classList.contains("ativo")) continue;
      const i = c.querySelector(".alvo-barra i"), t = c.querySelector(".alvo-vida");
      if (i) i.style.width = `${Math.max(0, Math.min(100, (100 * vida) / vidaMax(e)))}%`;
      if (t) t.textContent = `${vida}/${vidaMax(e)}`;
    }
  }

  // Arco de recarga do autoataque (barrinha que enche em 2 s).
  function laçoRecarga() {
    const alvo = alvoDesenhado;
    if (alvo) {
      const s = window.gameScene;
      const intervalo = typeof INTERVALO_AUTO_ATAQUE !== "undefined" ? INTERVALO_AUTO_ATAQUE : 2000;
      let f = 1;
      if (s && s.proximoAutoAtaque) f = 1 - Math.max(0, s.proximoAutoAtaque - Date.now()) / intervalo;
      const w = `${Math.max(0, Math.min(1, f)) * 100}%`;
      for (const i of $$(".alvo-recarga i")) i.style.width = w;
    }
    requestAnimationFrame(laçoRecarga);
  }

  // ------------------------------------------------------------------
  // Avisos (toasts), registro e classificação (§9.8)
  // ------------------------------------------------------------------
  const TIPOS = {
    perigo: { cor: "var(--vida-2)", glifo: "ui_coracao", nome: "perigo" },
    combate: { cor: "var(--vida-2)", glifo: "ui_espadas", nome: "combate" },
    saque: { cor: "var(--moeda)", glifo: "ui_moeda", nome: "saque" },
    missao: { cor: "var(--fe-2)", glifo: "ui_pergaminho", nome: "missão" },
    sistema: { cor: "var(--tinta-suave)", glifo: "ui_losango", nome: "sistema" },
    fala: { cor: "var(--bronze-500)", glifo: "ui_falar", nome: "fala" },
    anuncio: { cor: "#b46be0", glifo: "ui_louro", nome: "saque raro" },
    avanco: { cor: "var(--xp-2)", glifo: "ui_louro", nome: "avanço" },
  };
  // "Nome: fala" só é fala quando o nome é de um personagem conhecido.
  function ehFala(t) {
    const m = t.match(/^([A-ZÀ-Ú][^:]{1,30}):/);
    if (!m || typeof npcs === "undefined") return false;
    return Object.values(npcs).some((n) => n.nome === m[1] || nomeCurto(n.nome) === nomeCurto(m[1]));
  }
  function classificar(t) {
    if (ehFala(t)) return "fala";
    if (/envenen|derrotad[oa] você|caiu|morreu|sem flechas|sem poç/i.test(t)) return "perigo";
    if (/dano|golpe|ataca|derrot|crític/i.test(t)) return "combate";
    if (/caçada|pontos de tarefa/i.test(t)) return "missao"; // antes de "moedas": "Ganhe XP, moedas e pontos…"
    if (/pegou|coletou|recebeu|moedas|\+\d/i.test(t)) return "saque";
    if (/missão|capítulo|recompensa|tarefa|rota/i.test(t)) return "missao";
    return "sistema";
  }
  // Caçadas e troca de pontos ganham o glifo próprio (contagem e selo) no Registro e nos avisos.
  function glifoDoTipo(tipo, texto) {
    if (tipo === "perigo" && /veneno|envenen/i.test(texto)) return "ui_gota";
    if (tipo !== "fala" && /^Troca feita/.test(texto)) return "ui_selo";
    if (tipo !== "fala" && /caçada/i.test(texto)) return "ui_cacada";
    return (TIPOS[tipo] || TIPOS.sistema).glifo;
  }

  // ------------------------------------------------------------------
  // Console (conversa e registro): abas Geral (tudo), NPCs (falas, o que o
  // jogador disse e as palavras-chave) e Servidor (saque, XP, níveis, avisos).
  // Cada linha tem a hora (HH:MM) e a cor do tipo; a mais nova fica embaixo.
  // ------------------------------------------------------------------
  const registro = [];
  const MAX_LINHAS = 200;
  const canalDoTipo = (tipo) => (tipo === "fala" || tipo === "voce" || tipo === "dica" ? "npcs" : "servidor");
  const horaAgora = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  function htmlPalavras(npcId, palavras) {
    return palavras.map((k) => `<button type="button" class="palavra" data-palavra="${esc(k.palavra)}" data-npc="${esc(npcId)}" title="Dizer “${esc(k.palavra)}”">${esc(k.palavra)}</button>`).join("");
  }
  // extra: { quem, npc, palavras } — fala com o nome de quem fala em destaque e as palavras-chave clicáveis.
  function registrar(texto, tipo, extra = {}) {
    const hora = horaAgora();
    const canal = canalDoTipo(tipo);
    registro.push({ texto, tipo, hora, canal });
    if (registro.length > MAX_LINHAS) registro.shift();
    const ol = $("#listaRegistro");
    if (!ol) return;
    // Só acompanha a mensagem nova se o jogador não subiu a lista para ler as antigas.
    const noFim = ol.scrollHeight - ol.scrollTop - ol.clientHeight < 32;
    let quem = extra.quem || "";
    if (!quem && tipo === "fala") quem = (String(texto).match(/^([^:]{1,40}):\s+/) || [])[1] || "";
    const corpo = quem ? textoSemPrefixo(quem, texto) : texto;
    const li = document.createElement("li");
    li.className = `c-${canal} t-${TIPOS[tipo] || ["voce", "dica"].includes(tipo) ? tipo : "sistema"}`;
    li.innerHTML = `<time datetime="${hora}">${hora}</time>${quem ? `<b class="quem">${esc(quem)}:</b> ` : ""}<span class="msg">${esc(corpo)}</span>${
      extra.palavras?.length ? ` <span class="palavras" role="group" aria-label="Palavras-chave">${htmlPalavras(extra.npc, extra.palavras)}</span>` : ""}`;
    ol.appendChild(li);
    while (ol.children.length > MAX_LINHAS) ol.firstElementChild.remove();
    if (noFim) ol.scrollTop = ol.scrollHeight;
    marcarNaoLida(canal);
  }

  function aviso(texto, tipo) {
    const caixa = $("#avisos");
    const ultimo = caixa.lastElementChild;
    if (ultimo && ultimo.dataset.texto === texto && !ultimo.classList.contains("saindo")) {
      const n = Number(ultimo.dataset.rep || 1) + 1;
      ultimo.dataset.rep = n;
      let r = ultimo.querySelector(".rep");
      if (!r) { r = document.createElement("span"); r.className = "rep"; ultimo.appendChild(r); }
      r.textContent = `x${n}`;
      agendarSaida(ultimo);
      return;
    }
    const t = TIPOS[tipo] || TIPOS.sistema;
    const el = document.createElement("div");
    el.className = tipo === "anuncio" ? "aviso anuncio" : "aviso";
    el.dataset.texto = texto;
    el.style.setProperty("--cor", t.cor);
    el.innerHTML = `${imgGlifo(glifoDoTipo(tipo, texto), "px", t.nome)}<span>${esc(texto)}</span>`;
    el.addEventListener("mouseenter", () => { clearTimeout(el._t); });
    el.addEventListener("mouseleave", () => agendarSaida(el));
    caixa.appendChild(el);
    while (caixa.children.length > 3) caixa.firstElementChild.remove();
    posicionarAvisos();
    agendarSaida(el);
  }
  // Folha inferior aberta (celular): o aviso fica entre o HUD (e a linha da
  // missão e o minimapa) e a borda da folha. Se não couber ali, como com a
  // Mochila aberta, ele fica oculto em vez de cobrir o HUD; o texto continua
  // no Registro.
  // Mundo estreito (largo ou médio com as duas colunas de janelas): entre o HUD e o minimapa não cabe um
  // aviso legível; os avisos descem para baixo dos dois, na largura do mundo (#palco.avisos-abaixo).
  const LARGURA_MIN_AVISO = 240;
  function posicionarAvisos() {
    const caixa = $("#avisos"), palco = $("#palco");
    if (!caixa || !palco) return;
    const pr = palco.getBoundingClientRect();
    const fundoDe = (sels) => sels.reduce((t, sel) => {
      const el = $(sel);
      return el && el.offsetParent && el.offsetHeight ? Math.max(t, el.getBoundingClientRect().bottom - pr.top) : t;
    }, 0);
    if (!document.body.classList.contains("folha-aberta")) {
      caixa.classList.remove("sem-espaco");
      let abaixo = false;
      if (modo && modo !== "estreito" && pr.width) {
        const hud = $("#hud"), mapa = $("#mapaSobre");
        const esq = hud?.offsetParent ? hud.getBoundingClientRect().right - pr.left : 0;
        const dir = mapa?.offsetParent && mapa.offsetHeight ? pr.right - mapa.getBoundingClientRect().left : 0;
        abaixo = pr.width - esq - dir - 16 < LARGURA_MIN_AVISO;
        if (abaixo) palco.style.setProperty("--avisos-topo", `${Math.round(fundoDe(["#hud", "#quadroAlvo", "#mapaSobre"]) + 8)}px`);
      }
      palco.classList.toggle("avisos-abaixo", abaixo);
      return;
    }
    palco.classList.remove("avisos-abaixo");
    const topo = fundoDe(["#hud", "#missaoLinha", "#mapaSobre"]);
    palco.style.setProperty("--avisos-topo", `${Math.round(topo + 8)}px`);
    const ultimo = caixa.lastElementChild;
    caixa.classList.toggle("sem-espaco", !!ultimo && ultimo.offsetHeight > caixa.clientHeight);
  }
  function agendarSaida(el) {
    clearTimeout(el._t);
    const dur = Math.min(8000, 3000 + 35 * (el.dataset.texto || "").length);
    el._t = setTimeout(() => {
      el.classList.add("saindo");
      setTimeout(() => el.remove(), reduzMovimento() ? 0 : 300);
    }, dur);
  }

  let falaPendente = null;
  function mensagem(texto, tipo) {
    if (!texto) return;
    texto = String(texto);
    // No toque não há arrastar com mouse: adapta a dica de boas-vindas da cena.
    if (mm("(pointer: coarse)") && /^Bem-vindo! Arraste os itens/.test(texto))
      texto = "Bem-vindo! Toque num item da mochila e depois no espaço de equipamento.";
    tipo = TIPOS[tipo] ? tipo : classificar(texto);
    if (tipo === "fala") {
      // O MUNDO chama UI.dialogo logo depois de uma fala (que a registra com o NPC e as
      // palavras-chave); se não chamar, ela entra no console assim e vira aviso.
      falaPendente = texto;
      setTimeout(() => {
        if (falaPendente !== texto) return;
        falaPendente = null;
        registrar(texto, "fala");
        if (!consoleVisivel()) aviso(texto, "fala");
      }, 0);
      return;
    }
    registrar(texto, tipo);
    aviso(texto, tipo);
  }

  // ------------------------------------------------------------------
  // Falas dos NPCs: entram no console (aba NPCs) com as palavras-chave.
  // A caixa de diálogo com retrato (máquina de escrever a 40 caracteres/s)
  // só abre quando o console não está à vista: no celular (folha fechada)
  // ou com o console recolhido. Assim a mesma fala nunca aparece em dois lugares.
  // ------------------------------------------------------------------
  const PAPEIS = {
    viajante1: "pastor", guia_canaa: "guia de caravanas", guia_deserto: "guia de caravanas", mercador1: "mercador",
    noemi1: "do acampamento", moisesEgito: "líder do povo", aaronEgito: "irmão de Moisés", araoMar: "irmão de Moisés",
    josueSinai: "comandante", pedroGalileia: "pescador", jesusGalileia: "Médico dos médicos",
  };
  const dlg = { id: null, texto: "", mostrado: 0, timer: null, fechar: null, npc: null };
  // Última fala de cada conversa: as janelas do mercador, do guia e do barqueiro a repetem no topo.
  let ultimaFala = { id: null, texto: "", quando: 0 };
  const falaRecente = (id) => (id && ultimaFala.id === id && Date.now() - ultimaFala.quando < 20000 ? ultimaFala.texto : "");

  function textoSemPrefixo(nome, texto) {
    const m = String(texto).match(/^([^:]{1,40}):\s+/);
    if (!m) return texto;
    const curto = nomeCurto(nome);
    if (nome.startsWith(m[1]) || m[1].startsWith(curto)) return texto.slice(m[0].length);
    return texto;
  }

  // palavras: as palavras-chave a oferecer (sem o campo, as do NPC agora, por palavrasChaveDoNpc).
  function dialogo({ id, nome, papel, texto, palavras }) {
    if (falaPendente === texto) falaPendente = null;
    const npc = typeof npcs !== "undefined" ? npcs[id] : null;
    nome = nome || npc?.nome || "";
    const corpo = textoSemPrefixo(nome, texto || "");
    const lista = palavras ?? (typeof palavrasChaveDoNpc === "function" ? palavrasChaveDoNpc(jogador(), id) : []);
    ultimaFala = { id, texto: corpo, quando: Date.now() };
    conversaCom = id;
    registrar(texto || "", "fala", { quem: nomeCurto(nome), npc: id, palavras: lista });
    if (consoleVisivel()) {
      if (canalAtual === "servidor") escolherCanal("npcs");
      if (dlg.id) fecharDialogo();
      return;
    }
    const caixa = $("#dialogo");
    dlg.id = id;
    dlg.texto = corpo;
    dlg.npc = npc;
    $("#dlgNome").textContent = nomeCurto(nome);
    const reserva = papel === "loja" ? "mercador" : papel === "guia" ? "guia de caravanas" : papel === "mural" ? "vigia · mural de caçadas"
      : papel === "barqueiro" ? "barqueiro" : papel === "ambiente" ? String(nome).split(",").slice(1).join(",").trim() : "";
    $("#dlgPapel").textContent = PAPEIS[id] || reserva;
    const url = retratoURL(visualDe(id), { escala: 3, recorte: "busto" });
    const img = $("#dlgRetrato");
    if (url) img.src = url; else img.removeAttribute("src");
    img.alt = `Retrato de ${nomeCurto(nome)}`;
    $("#dlgPalavras").innerHTML = htmlPalavras(id, lista);
    caixa.classList.add("aberto");
    document.body.classList.add("dialogo-aberto");
    clearInterval(dlg.timer);
    clearTimeout(dlg.fechar);
    if (reduzMovimento()) completarDialogo();
    else {
      dlg.mostrado = 0;
      $("#dlgTexto").textContent = "";
      dlg.timer = setInterval(() => {
        dlg.mostrado = Math.min(corpo.length, dlg.mostrado + 2);
        $("#dlgTexto").textContent = corpo.slice(0, dlg.mostrado);
        if (dlg.mostrado >= corpo.length) completarDialogo();
      }, 50);
    }
    // Com palavras para escolher, a caixa espera mais antes de fechar sozinha.
    dlg.fechar = setTimeout(fecharDialogo, (lista.length > 2 ? 16000 : 9000) + corpo.length * 45);
  }
  // F ou clique no NPC com a fala dele aberta: completa o texto e, se já
  // estiver completo, fecha. Retorna false se não há fala aberta desse NPC.
  function avancarDialogo(id) {
    if (!$("#dialogo").classList.contains("aberto") || dlg.id !== id) return false;
    if (dlg.mostrado < dlg.texto.length) completarDialogo();
    else fecharDialogo();
    return true;
  }
  function completarDialogo() {
    clearInterval(dlg.timer);
    dlg.mostrado = dlg.texto.length;
    $("#dlgTexto").textContent = dlg.texto;
  }
  function fecharDialogo() {
    clearInterval(dlg.timer);
    clearTimeout(dlg.fechar);
    $("#dialogo").classList.remove("aberto");
    document.body.classList.remove("dialogo-aberto");
    dlg.id = null;
  }

  // ------------------------------------------------------------------
  // Conversa por palavras-chave (as palavras de cada NPC vêm de
  // palavrasChaveDoNpc, em logica.js; cada uma usa uma ação que já existe)
  // ------------------------------------------------------------------
  let conversaCom = null; // último NPC com quem se falou (tem a vez se ainda estiver perto)
  const historicoFala = [];
  let posHistorico = 0;
  const perto = (p, id) => !!(p && id && Mundo.npcProximo?.(p, (n) => n.id === id));

  // O jogador disse algo (digitado no console ou palavra clicada; npcId: de quem era a palavra).
  function falarNoConsole(texto, npcId) {
    texto = String(texto || "").trim().slice(0, 80);
    if (!texto) return;
    registrar(texto, "voce", { quem: "Você" });
    const p = jogador();
    if (!p || typeof palavrasChaveDoNpc !== "function") return;
    const npc = npcId && perto(p, npcId) ? npcs[npcId] : !npcId && perto(p, conversaCom) ? npcs[conversaCom] : !npcId ? Mundo.npcProximo?.(p) : null;
    if (!npc) {
      const longe = npcId && npcs[npcId];
      mensagem(longe && longe.area === p.area ? `Chegue mais perto de ${nomeCurto(longe.nome)} para conversar.` : "Não há ninguém por perto para conversar.", "sistema");
      return;
    }
    const lista = palavrasChaveDoNpc(p, npc.id);
    const k = palavraChaveDoTexto(lista, texto);
    if (!k) {
      registrar(`${nomeCurto(npc.nome)} não entendeu. Diga:`, "dica", { npc: npc.id, palavras: lista });
      return;
    }
    dizerPalavra(npc, k);
  }
  function dizerPalavra(npc, k) {
    conversaCom = npc.id;
    if (k.acao === "interagir") {
      // A mesma conversa do clique e do F (missão, morador, mural, vocação), com a caixa já fechada.
      if (dlg.id === npc.id) fecharDialogo();
      executar({ tipo: "interagir", alvoId: npc.id });
      return;
    }
    const p = jogador();
    dialogo({ id: npc.id, papel: npc.papel, texto: k.fala, palavras: k.acao === "fala" ? palavrasChaveDoNpc(p, npc.id) : [] });
    if (k.acao === "despedir") conversaCom = null;
    else if (k.acao === "loja") abrirLoja(npc.id, k.aba);
    else if (k.acao === "viagem") abrirViagem(npc.id);
    else if (k.acao === "barco") abrirBarco(npc.id);
  }

  // Estado do console: canal, recolhido e altura (largo e médio). Fica neste navegador.
  const CHAVE_CONSOLE = "jornada_console";
  let canalAtual = "geral";
  let prefConsole = {};
  try { prefConsole = JSON.parse(localStorage.getItem(CHAVE_CONSOLE) || "{}") || {}; } catch (e) { prefConsole = {}; }
  const salvarConsole = () => { try { localStorage.setItem(CHAVE_CONSOLE, JSON.stringify(prefConsole)); } catch (e) { /* sem armazenamento */ } };

  function consoleVisivel() {
    const c = painel("pRegistro");
    if (!c) return false;
    if (modo === "estreito") return folhaAtual === "registro";
    return c.dataset.aberto === "true" && (c.parentElement?.id === "rodape" || c.parentElement?.id === "mundo");
  }
  function marcarNaoLida(canal) {
    if (consoleVisivel() && (canalAtual === "geral" || canalAtual === canal)) return;
    $(`.console-abas [data-canal="${canal}"]`)?.classList.add("nao-lido");
    if (canal === "npcs" && modo === "estreito") $("#naoLidaCel").hidden = false;
  }
  function limparNaoLidas() {
    if (!consoleVisivel()) return;
    for (const b of $$(".console-abas [data-canal]")) if (canalAtual === "geral" || b.dataset.canal === canalAtual) b.classList.remove("nao-lido");
    if (modo === "estreito") $("#naoLidaCel").hidden = true;
  }
  function rolarConsole() {
    const ol = $("#listaRegistro");
    if (ol) ol.scrollTop = ol.scrollHeight;
  }
  function escolherCanal(c) {
    canalAtual = ["geral", "npcs", "servidor"].includes(c) ? c : "geral";
    painel("pRegistro").dataset.canal = canalAtual;
    for (const b of $$(".console-abas [data-canal]")) b.setAttribute("aria-selected", String(b.dataset.canal === canalAtual));
    limparNaoLidas();
    rolarConsole();
    prefConsole.canal = canalAtual;
    salvarConsole();
  }
  function abrirConsole(aberto, salvar = true) {
    const c = painel("pRegistro");
    const antes = c.dataset.aberto === "true";
    c.dataset.aberto = String(aberto);
    const b = $("#btnRegistro");
    const rot = aberto ? "Recolher o console" : "Abrir o console";
    b.setAttribute("aria-expanded", String(aberto));
    b.setAttribute("aria-label", rot);
    b.title = rot;
    $("#rodape")?.classList.toggle("recolhido", !aberto && modo !== "estreito");
    if (salvar) { prefConsole.aberto = aberto; salvarConsole(); }
    if (aberto && modo !== "estreito") definirAlturaConsole(prefConsole.altura || ALTURA_CONSOLE.padrao);
    // Só ao abrir: mudar a altura (janela, layout) não tira o jogador do ponto do histórico em que está lendo.
    if (aberto && !antes) { limparNaoLidas(); rolarConsole(); }
  }
  // ----- Altura do console (dock de baixo) -----
  // O zoom do mundo (game.js, pixelsPorPixelDeArte) é um número inteiro de pixels de tela por pixel de arte,
  // arredondado a partir do tamanho do palco: com o palco baixo demais ele cai de 2 para 1 (tudo pela
  // metade). O console fica sempre preso (nada flutua sobre o mundo) e a altura dele não derruba o zoom: o
  // padrão é ALTURA_CONSOLE.padrao, encolhido até o mundo caber em 2× (quando 2× cabe com o console mínimo), e
  // a alça vai do mínimo até a maior altura que ainda mantém esse zoom (no máximo metade da janela).
  // 1366 × 768: dock de ~170 px (6 linhas) e o mundo em 2×, ~12 × 8 casas à vista.
  // 1920 × 1080: dock de 176 px e o mundo em 2×, ~20 × 13 casas; com o dock em ~130 px ou menos (ou com a
  // tecla +) o mundo vai a 3×, ~14 × 9 casas.
  // Opção "Conversa sob o mundo" (menu Janelas): o console fica embaixo do mundo, entre as colunas, e o
  // dock é só a faixa dos atalhos (como antes); a altura segue a mesma regra.
  // minSobMundo: sob o mundo a barra dos atalhos já tira altura do palco; com 2 linhas o mundo ainda fica em
  // 2× em 1366 × 768.
  const ALTURA_CONSOLE = { min: 112, minSobMundo: 88, padrao: 176, fracaoMax: 0.5 };
  const chatSobMundo = () => prefConsole.lugar === "mundo";
  // O que encolhe o palco quando o console cresce: o dock inteiro ou só o console (sob o mundo).
  const caixaDoConsole = () => (chatSobMundo() ? painel("pRegistro") : $("#rodape"));
  // Pixels de tela por pixel de arte que o mundo teria num palco de w × h px de CSS (sem o ajuste + e −).
  function zoomDoPalco(w, h) {
    const dpr = typeof dprAtual === "function" ? dprAtual() : window.devicePixelRatio || 1;
    const s = window.gameScene;
    if (s?.pixelsPorPixelDeArte) return s.pixelsPorPixelDeArte(Math.round(w * dpr), Math.round(h * dpr), 0);
    const [cw, ch] = h > w * 1.15 ? [9, 13] : [15, 11];
    return Math.max(Math.ceil(dpr), Math.round(Math.min((w * dpr) / (cw * 32), (h * dpr) / (ch * 32))));
  }
  // Altura mínima do dock: a pilha dos atalhos (e a barra de habilidades, com vocação) tem de caber.
  function minimoDoDock() {
    const f = $("#rodape .atalhos-faixa");
    if (!f || chatSobMundo()) return 0;
    const filhos = Array.from(f.children).filter((el) => el.offsetParent !== null);
    const gap = parseFloat(getComputedStyle(f).rowGap) || 0;
    const cs = getComputedStyle(f), borda = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + 4;
    return Math.ceil(filhos.reduce((t, el) => t + el.offsetHeight, 0) + gap * Math.max(0, filhos.length - 1) + borda);
  }
  function limitesDoConsole() {
    const caixa = caixaDoConsole(), palco = $("#palco");
    const min = Math.max(chatSobMundo() ? ALTURA_CONSOLE.minSobMundo : ALTURA_CONSOLE.min, minimoDoDock());
    if (!caixa || !palco || !palco.clientWidth) return { min, max: Math.max(min, ALTURA_CONSOLE.padrao) };
    const w = palco.clientWidth, total = palco.clientHeight + caixa.offsetHeight; // o palco mais a caixa
    const teto = Math.max(min, Math.round(innerHeight * ALTURA_CONSOLE.fracaoMax));
    const dpr = typeof dprAtual === "function" ? dprAtual() : window.devicePixelRatio || 1;
    const alvo = Math.min(zoomDoPalco(w, total - min), Math.ceil(2 * dpr));
    let max = teto;
    while (max > min && zoomDoPalco(w, total - max) < alvo) max--;
    return { min, max };
  }
  function definirAlturaConsole(h) {
    const { min, max } = limitesDoConsole();
    h = Math.max(min, Math.min(max, Math.round(h)));
    if (chatSobMundo()) painel("pRegistro").style.setProperty("--altura-console", `${h}px`);
    else document.documentElement.style.setProperty("--altura-dock", `${h}px`);
    return h;
  }
  // Põe o console no lugar escolhido (dock ou sob o mundo) e acerta a altura. Chamado ao montar o layout,
  // ao mudar o tamanho da janela, ao mover janelas (o mundo muda de largura) e ao mudar a barra de habilidades.
  function ajustarConsole() {
    const c = painel("pRegistro");
    if (!c) return;
    document.body.classList.toggle("chat-sob-mundo", modo !== "estreito" && chatSobMundo());
    if (modo === "estreito") { $("#rodape")?.classList.remove("recolhido"); abrirConsole(true, false); return; }
    if (chatSobMundo()) { if (c.parentElement?.id !== "mundo") $("#mundo").appendChild(c); }
    else if (c.parentElement?.id !== "rodape") $("#rodape").insertBefore(c, $("#rodape .atalhos-faixa"));
    abrirConsole(prefConsole.aberto !== false, false);
  }
  function focarConsole() {
    if (modo === "estreito" && folhaAtual !== "registro") abrirFolha("registro");
    $("#entradaConversa")?.focus();
  }
  function ligarConsole() {
    const c = painel("pRegistro"), entrada = $("#entradaConversa");
    escolherCanal(prefConsole.canal || "geral");
    $(".console-abas").addEventListener("click", (e) => {
      const b = e.target.closest("[data-canal]");
      if (b) escolherCanal(b.dataset.canal);
    });
    $("#btnRegistro").addEventListener("click", () => abrirConsole(c.dataset.aberto !== "true"));
    $("#formConversa").addEventListener("submit", (e) => {
      e.preventDefault();
      const t = entrada.value.trim();
      entrada.value = "";
      if (!t) { entrada.blur(); return; }
      if (historicoFala[historicoFala.length - 1] !== t) historicoFala.push(t);
      if (historicoFala.length > 20) historicoFala.shift();
      posHistorico = historicoFala.length;
      falarNoConsole(t);
    });
    // Escrevendo, as teclas não andam nem atacam; ↑ e ↓ trazem as últimas falas; Esc volta ao jogo.
    entrada.addEventListener("focus", () => { teclado(false); if (window.Jogo) Jogo.entrada = { dx: 0, dy: 0 }; });
    entrada.addEventListener("blur", () => { if (!modalAberto) teclado(true); });
    entrada.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); entrada.blur(); return; }
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && historicoFala.length) {
        e.preventDefault();
        posHistorico = Math.max(0, Math.min(historicoFala.length, posHistorico + (e.key === "ArrowUp" ? -1 : 1)));
        entrada.value = historicoFala[posHistorico] || "";
      }
    });
    // Palavras-chave clicáveis (console e caixa de diálogo)
    document.addEventListener("click", (e) => {
      const b = e.target.closest?.("[data-palavra]");
      if (!b) return;
      e.preventDefault();
      falarNoConsole(b.dataset.palavra, b.dataset.npc);
    });
    // Alça (na borda de cima do dock): arrastar (ou ↑ e ↓ com o foco nela) muda a altura, que fica salva.
    const alca = $("#consoleAlca");
    alca.tabIndex = 0;
    let y0 = null, h0 = 0;
    alca.addEventListener("pointerdown", (e) => {
      y0 = e.clientY;
      h0 = caixaDoConsole().offsetHeight;
      alca.classList.add("arrastando");
      try { alca.setPointerCapture(e.pointerId); } catch (erro) { /* ignora */ }
      e.preventDefault();
    });
    alca.addEventListener("pointermove", (e) => { if (y0 !== null) definirAlturaConsole(h0 + y0 - e.clientY); });
    const soltar = () => {
      if (y0 === null) return;
      y0 = null;
      alca.classList.remove("arrastando");
      prefConsole.altura = caixaDoConsole().offsetHeight;
      prefConsole.aberto = true;
      salvarConsole();
    };
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);
    alca.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      prefConsole.altura = definirAlturaConsole(caixaDoConsole().offsetHeight + (e.key === "ArrowUp" ? 16 : -16));
      prefConsole.aberto = true;
      salvarConsole();
    });
  }

  // ------------------------------------------------------------------
  // Modais (componente único, foco preso, Esc/véu/fechar)
  // ------------------------------------------------------------------
  let modalAberto = null, focoOrigem = null;
  function teclado(ligado) {
    const kb = window.gameScene?.input?.keyboard;
    if (!kb) return;
    try {
      kb.enabled = ligado;
      if (!ligado && kb.resetKeys) kb.resetKeys();
      // O gerenciador de teclado do Phaser chama preventDefault nas teclas
      // capturadas (Espaço, setas, letras) mesmo com kb.enabled = false; sem
      // isto, Espaço não ativaria o botão focado nos modais.
      if (ligado) kb.enableGlobalCapture?.();
      else kb.disableGlobalCapture?.();
    } catch (e) { /* cena trocando */ }
  }
  function abrirModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    if (modalAberto && modalAberto !== m) fecharModal(false);
    if (!modalAberto) focoOrigem = document.activeElement;
    modalAberto = m;
    m.classList.add("aberto");
    m.setAttribute("aria-hidden", "false");
    esconderDica();
    teclado(false);
    if (window.Jogo) Jogo.entrada = { dx: 0, dy: 0 };
    preencherGlifos(m);
    const foco = m.querySelector("[data-foco-inicial]") || m.querySelector(".modal-corpo button:not([disabled]), .btn-fechar");
    const corpo = m.querySelector(".modal-corpo");
    setTimeout(() => { foco?.focus({ preventScroll: true }); if (corpo) corpo.scrollTop = 0; }, 0);
  }
  function fecharModal(devolverFoco = true) {
    if (!modalAberto) return;
    modalAberto.classList.remove("aberto");
    modalAberto.setAttribute("aria-hidden", "true");
    modalAberto = null;
    teclado(true);
    if (devolverFoco && focoOrigem && document.contains(focoOrigem)) focoOrigem.focus?.();
    else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
  }
  function prenderFoco(e) {
    if (!modalAberto || e.key !== "Tab") return;
    const foc = $$('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])', modalAberto).filter((x) => x.offsetParent !== null);
    if (!foc.length) return;
    const pri = foc[0], ult = foc[foc.length - 1];
    if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
    else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
  }

  // Comandos que afetam o mundo passam por Jogo.executar (efeitos + mensagem).
  function executar(comando) {
    if (window.Jogo && window.gameScene) return Jogo.executar(comando);
    const r = Mundo.executar(ID, comando);
    if (r && r.mensagem) mensagem(r.mensagem);
    atualizar();
    return r;
  }

  // ----- Loja -----
  let abaLoja = "comprar", falaLoja = "";
  let lojaAtual = null;
  // aba: "comprar" ou "vender" (palavras-chave do console); sem ela, a última aba usada.
  function abrirLoja(mercId, aba) {
    const p = jogador();
    const merc = typeof npcs !== "undefined"
      ? (typeof mercId === "string" && npcs[mercId]) || (p && Mundo.mercadorProximo?.(p)) || Object.values(npcs).find((n) => n.papel === "loja" && n.area === p?.area)
      : null;
    lojaAtual = merc?.id || null;
    $("#lojaTitulo").textContent = nomeCurto(merc?.nome || "Mercador");
    const url = retratoURL(visualDe(merc?.id || "mercador1"), { escala: 3, recorte: "busto" });
    if (url) $("#lojaRetrato").src = url;
    falaLoja = falaRecente(merc?.id);
    if (aba === "comprar" || aba === "vender") abaLoja = aba;
    if (dlg.id === merc?.id) fecharDialogo();
    desenharLoja(true);
    abrirModal("modalLoja");
  }
  // Redesenha só quando o que a loja mostra muda (moedas, mochila, carga, aba): a interface se atualiza a cada
  // passo de criatura, e redesenhar apagaria o número que o jogador está digitando no seletor de quantidade.
  let assinaturaLoja = "";
  function desenharLoja(forcar = false) {
    const p = jogador();
    if (!p) return;
    const corpo = $("#lojaCorpo");
    const g = contar(p.inventario);
    const cap = typeof capacidadeCarga === "function" ? capacidadeCarga(p) : 0;
    const peso = typeof pesoCarregado === "function" ? pesoCarregado(p) : 0;
    const vendaveis = Object.entries(typeof VALORES_VENDA !== "undefined" ? VALORES_VENDA : {}).filter(([id]) => g.get(id));
    const livres = vendaveis.map(([id]) => Math.min(g.get(id), livreParaSair(id)));
    const ass = JSON.stringify([abaLoja, lojaAtual, falaLoja, p.moedas, p.inventario.length, vendaveis.map(([id]) => g.get(id)), livres, peso, cap]);
    if (!forcar && ass === assinaturaLoja && corpo.innerHTML) return;
    assinaturaLoja = ass;
    // Foco: o mesmo botão (ou seletor) depois de redesenhar.
    const ativo = document.activeElement;
    const focoAntes = corpo.contains(ativo)
      ? ativo.closest(".qtd-sel")?.dataset.qtd ? `.qtd-sel[data-qtd="${ativo.closest(".qtd-sel").dataset.qtd}"] input`
        : ativo.dataset.qtdAcao ? `[data-qtd-acao="${ativo.dataset.qtdAcao}"]`
          : ativo.dataset.comprar ? `[data-comprar="${ativo.dataset.comprar}"]:not([data-qtd-acao])`
            : ativo.dataset.vender ? `[data-vender="${ativo.dataset.vender}"][data-quantidade="${ativo.dataset.quantidade}"]` : null
      : null;
    const moeda = imgGlifo("ui_moeda", "px g16");
    let lista = "";
    if (abaLoja === "comprar") {
      const catalogo = typeof catalogoDaLoja === "function" && lojaAtual ? catalogoDaLoja(lojaAtual) : [];
      const maxCompra = typeof QUANTIDADE_MAXIMA_COMPRA !== "undefined" ? QUANTIDADE_MAXIMA_COMPRA : 100;
      for (const { item: id, preco } of catalogo) {
        const falta = preco - p.moedas;
        // Provisões (poções e lotes de flechas): seletor de quantidade até o que as moedas e a carga permitem.
        const flechas = id === "flechas";
        const porLote = flechas ? (typeof FLECHAS_POR_PACOTE !== "undefined" ? FLECHAS_POR_PACOTE : 5) : 1;
        const pesoLote = (typeof pesoItem === "function" ? pesoItem(flechas ? "flecha" : id) : 0) * porLote;
        const empilha = flechas || ["consumivel", "municao"].includes(info(id)?.tipo);
        const max = Math.min(maxCompra, Math.floor(p.moedas / preco), pesoLote > 0 ? Math.floor((cap - peso + 0.0001) / pesoLote) : maxCompra);
        const chave = `comprar:${id}`;
        const x = qtdEscolhida(chave, Math.max(1, max), Math.min(5, max));
        const linhaQtd = empilha && max >= 2
          ? `<div class="linha-qtd">${htmlQtd(chave, x, max, flechas ? "Lotes de 5 flechas a comprar" : `Quantidade a comprar: ${nomeDoItem(id)}`)}${htmlAcaoQtd(chave, x, "", ` data-comprar="${esc(id)}"`)}</div>`
          : "";
        const pesoTxt = pesoLote ? ` · ${kg(pesoLote)} kg${flechas ? " o lote" : ""}` : "";
        const efeitos = slotDe(id) && typeof efeitosDoItem === "function" ? efeitosDoItem(id).join(", ") : "";
        lista += `<li class="item-loja${linhaQtd ? " com-qtd" : ""}"><span class="icone">${htmlItem(id)}</span><span><strong>${esc(nomeDoItem(id))}</strong><span>${esc((efeitos || atributoItem(id, p)) + pesoTxt)}</span></span>
          <button type="button" class="btn primario" data-comprar="${esc(id)}" ${falta > 0 ? `disabled title="Faltam ${falta} moedas"` : ""} aria-label="Comprar ${esc(nomeDoItem(id))} por ${preco} moedas${falta > 0 ? `; faltam ${falta}` : ""}">${falta > 0 ? `faltam ${falta}` : `${preco} ${moeda}`}</button>${linhaQtd}</li>`;
      }
    } else {
      vendaveis.forEach(([id, valor], i) => {
        const n = g.get(id);
        const livre = livres[i];
        const reserva = n - livre;
        const nome = esc(nomeDoItem(id));
        const temTxt = `Você tem ${n}${reserva ? ` (${reserva} para a missão)` : ""} · ${valor} cada`;
        let botao, linhaQtd = "";
        if (!livre) {
          const res = Mundo.reservaDeMissao?.(p, id);
          botao = `<button type="button" class="btn primario" disabled title="A missão “${esc(res?.missao || "")}” pede este item">Guardado</button>`;
        } else if (livre === 1) {
          botao = `<button type="button" class="btn primario" data-vender="${esc(id)}" data-quantidade="1" aria-label="Vender um ${nome} por ${valor} moedas">+${valor} ${moeda}</button>`;
        } else {
          // Vender 1, Vender X (seletor até o que se pode vender) ou Vender tudo; o total aparece no botão.
          botao = `<button type="button" class="btn primario" data-vender="${esc(id)}" data-quantidade="1" aria-label="Vender um ${nome} por ${valor} moedas">Vender 1 · +${valor} ${moeda}</button>`;
          const chave = `vender:${id}`;
          const x = qtdEscolhida(chave, livre, Math.max(2, Math.floor(livre / 2)));
          const tudo = reserva ? `Vender as livres (${livre})` : `Vender tudo (${livre})`;
          linhaQtd = `<div class="linha-qtd">${livre > 2 ? htmlQtd(chave, x, livre, `Quantidade a vender: ${nomeDoItem(id)}`) + htmlAcaoQtd(chave, x, "secundario", ` data-vender="${esc(id)}"`) : ""}`
            + `<button type="button" class="btn secundario" data-vender="${esc(id)}" data-quantidade="${livre}" aria-label="${esc(tudo)}: ${nome} por ${valor * livre} moedas">${tudo} · +${valor * livre} ${moeda}</button></div>`;
        }
        lista += `<li class="item-loja${linhaQtd ? " com-qtd" : ""}"><span class="icone">${htmlItem(id)}</span><span><strong>${nome}</strong><span>${esc(temTxt)}</span></span>
          ${botao}${linhaQtd}</li>`;
      });
      if (!lista) lista = '<li class="vazio-txt" style="color:var(--tinta-suave)">Você não tem nada que o mercador compre. Ele aceita recursos: peles, presas, ferrões, linho, ervas, odres, peixe e as pedras preciosas.</li>';
    }
    corpo.innerHTML = `${falaLoja ? `<p class="fala-modal">${esc(falaLoja)}</p>` : ""}
      <div class="saldo">${moeda}<span>${p.moedas} moedas</span></div>
      <div class="abas-modal" role="tablist">
        <button type="button" class="aba-modal" role="tab" data-aba-loja="comprar" aria-selected="${abaLoja === "comprar"}">Comprar</button>
        <button type="button" class="aba-modal" role="tab" data-aba-loja="vender" aria-selected="${abaLoja === "vender"}">Vender</button>
      </div>
      <ul class="lista-loja" role="tabpanel">${lista}</ul>
      <p class="nota" style="color:var(--tinta-suave)">Carga: ${kg(peso)} / ${kg(cap)} kg. Flechas são vendidas em lotes de ${typeof FLECHAS_POR_PACOTE !== "undefined" ? FLECHAS_POR_PACOTE : 5}. Fique ao lado do mercador para negociar.</p>`;
    if (focoAntes) (corpo.querySelector(focoAntes) || corpo.querySelector(`[data-aba-loja=${abaLoja}]`))?.focus({ preventScroll: true });
  }

  // ----- Mural de caçadas (atalaia) -----
  // muralNpc: o atalaia ao lado (aceitar, retomar e trocar valem) ou null (consulta pela tecla T,
  // pelo saldo no topo ou pelo painel Missão: ver, guardar e saber quando cada caçada volta).
  // A entrega acontece ao falar com o atalaia (antes de o mural abrir); a fala dele vem no topo.
  // retornoMural: resposta da última ação feita no mural (os avisos ficam atrás do véu do modal;
  // sem isto, "Libere espaço para receber…" passaria despercebido).
  // confirmaTroca: oferta repetível cujo item o jogador já tem, esperando "Trocar de novo" ou "Cancelar".
  let muralNpc = null, abaMural = "cacadas", falaMural = "", htmlMural = "", retornoMural = null, confirmaTroca = null;
  function abrirMural(npcId) {
    const p = jogador();
    if (!p || !temCacadas()) return;
    const npc = npcId && typeof npcs !== "undefined" ? npcs[npcId] : null;
    muralNpc = npc?.papel === "mural" ? npcId : null;
    falaMural = falaRecente(muralNpc);
    if (muralNpc && dlg.id === muralNpc) fecharDialogo();
    const img = $("#muralRetrato");
    let url;
    if (muralNpc) {
      const area = (typeof areas !== "undefined" && areas[npc.area]?.nome) || "";
      $("#muralTitulo").textContent = area ? `Caçadas · ${area}` : "Caçadas";
      $("#muralSub").textContent = "Atalaia · mural de caçadas";
      url = retratoURL(visualDe(muralNpc), { escala: 3, recorte: "busto" });
      img.className = "px";
    } else {
      $("#muralTitulo").textContent = "Suas caçadas";
      $("#muralSub").textContent = "Consulta · aceitar e trocar só ao lado de um atalaia";
      url = glifoURL("ui_cacada", 4);
      img.className = "px g32";
    }
    if (url) img.src = url; else img.removeAttribute("src");
    abaMural = "cacadas";
    retornoMural = null;
    confirmaTroca = null;
    desenharMural(true);
    abrirModal("modalMural");
  }

  // Redesenha só quando o HTML muda (atualizar() roda a cada passo de inimigo; o tique, a cada
  // minuto da espera). Recriar os botões entre o mousedown e o mouseup perderia o clique.
  // focar: seletor que recebe o foco depois de uma ação (o retorno, ou um botão da confirmação).
  const ATRIBUTOS_BOTAO_MURAL = ["data-aceitar-tarefa", "data-guardar-tarefa", "data-trocar", "data-confirmar-troca", "data-cancelar-troca", "data-aba-mural"];
  function desenharMural(forcar, focar) {
    const p = jogador();
    const corpo = $("#muralCorpo");
    if (!p || !corpo || !temCacadas()) return;
    const html = montarMural(p);
    if (!forcar && html === htmlMural) return;
    htmlMural = html;
    // Sem ação, o foco volta para onde estava: o mesmo botão; se ele sumiu, o mesmo cartão, a aba ou
    // o retorno. "Trocar de novo" nunca recebe o foco por tabela. A rolagem fica.
    const ativo = document.activeElement;
    const foco = ativo && corpo.contains(ativo) ? ativo.closest("[data-tarefa], [data-oferta], [data-aba-mural], [data-retorno]") : null;
    const attr = foco ? ATRIBUTOS_BOTAO_MURAL.find((a) => ativo.hasAttribute(a)) : null;
    const mesmo = attr ? `[${attr}="${ativo.getAttribute(attr)}"]` : null;
    const d = foco?.dataset || {};
    const seletor = focar || (d.tarefa ? `[data-tarefa="${d.tarefa}"]` : d.oferta ? `[data-oferta="${d.oferta}"]`
      : d.abaMural ? `[data-aba-mural="${d.abaMural}"]` : foco ? "[data-retorno]" : null);
    const rolagem = corpo.scrollTop;
    corpo.innerHTML = html;
    corpo.scrollTop = rolagem;
    const mesmoBotao = !focar && mesmo ? $(mesmo, corpo) : null;
    if (mesmoBotao && !mesmoBotao.disabled) {
      mesmoBotao.focus({ preventScroll: true });
      return;
    }
    if (!seletor) return;
    const alvo = $(seletor, corpo);
    if (alvo?.matches("[data-retorno]")) {
      alvo.focus({ preventScroll: true });
      // Depois de uma ação, a resposta (no topo) precisa ficar à vista, mesmo com a lista rolada.
      const acima = alvo.getBoundingClientRect().top - corpo.getBoundingClientRect().top - 8;
      if (focar && acima < 0) corpo.scrollTop += acima;
      return;
    }
    const botao = alvo?.matches("button") ? alvo : alvo?.querySelector("button:not([disabled]):not([data-confirmar-troca])");
    (botao && !botao.disabled ? botao : $(`[data-aba-mural="${abaMural}"]`, corpo))?.focus({ preventScroll: true });
  }

  // Ações do mural (aceitar, retomar, guardar, trocar). Um comando logo depois de outro é ignorado: o
  // 2º clique de um duplo clique (e.detail > 1) e qualquer ação a menos de 500 ms da anterior (Enter
  // repetido, toque duplo). Sem isto, Aceitar virava Guardar no mesmo lugar e a troca repetível saía
  // duas vezes. Depois do comando o foco vai para o retorno, nunca para o botão que nasce no lugar.
  let ultimaAcaoMural = -Infinity;
  function acaoMural(e, botao) {
    const agora = performance.now();
    if (e.detail > 1 || agora - ultimaAcaoMural < 500) return;
    ultimaAcaoMural = agora;
    const d = botao.dataset;
    if (d.cancelarTroca) {
      confirmaTroca = null;
      desenharMural(true, `[data-trocar="${d.cancelarTroca}"]`);
      return;
    }
    // Item repetível que o jogador já tem (na mochila ou equipado): pergunta antes de trocar outro.
    const oferta = d.trocar ? ofertasDeTroca(jogador()).find((o) => o.id === d.trocar) : null;
    if (oferta?.possui > 0) {
      confirmaTroca = oferta.id;
      desenharMural(true, "[data-cancelar-troca]");
      return;
    }
    let comando = null;
    if (d.aceitarTarefa) comando = { tipo: "aceitarTarefa", tarefaId: d.aceitarTarefa };
    else if (d.guardarTarefa) comando = { tipo: "guardarTarefa", tarefaId: d.guardarTarefa };
    else if (d.trocar || d.confirmarTroca) comando = { tipo: "trocarPontos", ofertaId: d.trocar || d.confirmarTroca };
    if (!comando) return;
    confirmaTroca = null;
    const r = executar(comando);
    retornoMural = r?.mensagem ? { ok: !!r.ok, mensagem: r.mensagem } : null;
    desenharMural(true, "[data-retorno]");
  }

  function montarMural(p) {
    const limite = limiteCacadas();
    const acompanhando = cacadasAtivas(p).length;
    const abas = [["cacadas", "ui_cacada", "Caçadas"], ["troca", "ui_selo", "Troca de pontos"]];
    const painel = abaMural === "troca" ? montarTroca(p) : montarCacadas(p, acompanhando < limite);
    const r = retornoMural;
    const retorno = r ? `<p class="retorno${r.ok ? "" : " erro"}" role="status" tabindex="-1" data-retorno>${esc(r.mensagem)}</p>` : "";
    return `${falaMural ? `<p class="fala-modal">${esc(falaMural)}</p>` : ""}${retorno}
      <div class="saldo">${imgGlifo("ui_selo", "px g16")}<span>${textoPts(p.pontosTarefa || 0)} · acompanhando ${acompanhando} de ${limite}</span></div>
      <div class="abas-modal" role="tablist" aria-label="Mural">${abas.map(([k, g, rot]) => `<button type="button" class="aba-modal" role="tab"
        id="abaMural-${k}" data-aba-mural="${k}" aria-selected="${abaMural === k}" aria-controls="painelMural">${imgGlifo(g)}${rot}</button>`).join("")}</div>
      <div id="painelMural" role="tabpanel" aria-labelledby="abaMural-${abaMural}">${painel}</div>`;
  }

  function montarCacadas(p, haVaga) {
    const lista = (ts) => `<ul class="lista-loja">${ts.map((t) => htmlCacada(t, haVaga)).join("")}</ul>`;
    if (muralNpc) {
      const doMural = tarefasDoMural(p, muralNpc);
      const outras = tarefasDoJogador(p).filter((t) => t.mural !== muralNpc);
      const livre = doMural.some((t) => t.estado === "disponivel" || t.estado === "guardada");
      const cheio = !haVaga && livre
        ? `<p class="nota">${imgGlifo("ui_cadeado")} Você já acompanha ${limiteCacadas()} caçadas. Guarde uma para aceitar outra.</p>` : "";
      return `${cheio}${lista(doMural)}${outras.length ? `<h3>Suas caçadas de outras regiões</h3>${lista(outras)}` : ""}`;
    }
    const minhas = tarefasDoJogador(p);
    let html = minhas.length
      ? lista(minhas)
      : '<p class="vazio-txt">Você não acompanha nenhuma caçada. Os atalaias oferecem caçadas depois da missão principal de cada região.</p>';
    // Quando cada caçada já entregue volta ao mural (a espera corre com o jogo fechado).
    const voltam = typeof visaoTarefa === "function"
      ? Object.keys(p.tarefas || {}).map((id) => visaoTarefa(p, id)).filter((t) => t && t.estado === "espera").sort((a, b) => a.esperaMs - b.esperaMs)
      : [];
    if (voltam.length) {
      html += `<h3>Voltam ao mural</h3><ul class="voltam">${voltam.map((t) => `<li><span>${esc(t.nome)} · ${esc(t.nomeArea)}</span>
        <b>em ${esc(textoEspera(t.esperaMs))}</b></li>`).join("")}</ul>`;
    }
    return html;
  }

  // Botão do cartão conforme o estado; nota = motivo visível quando aceitar/retomar não vale aqui.
  function acaoCacada(t, haVaga) {
    const btn = (attrs, rot, cls = "primario") => `<button type="button" class="btn ${cls}" ${attrs}>${rot}</button>`;
    if (t.estado === "disponivel" || t.estado === "guardada") {
      const rot = t.estado === "guardada" ? "Retomar" : "Aceitar";
      const longe = muralNpc === null || muralNpc !== t.mural;
      const motivo = longe ? `Fale com o atalaia (${t.nomeArea})` : !haVaga ? `Limite de ${limiteCacadas()} caçadas: guarde uma` : "";
      const attrs = `data-aceitar-tarefa="${esc(t.id)}"${motivo ? ` disabled title="${esc(motivo)}"` : ""} aria-label="${rot} ${esc(t.nome)}${motivo ? `. ${esc(motivo)}` : ""}"`;
      return { botao: btn(attrs, rot), nota: longe ? `${motivo} para ${rot.toLowerCase()}.` : "" };
    }
    if (t.estado === "ativa") {
      const attrs = `data-guardar-tarefa="${esc(t.id)}" title="Guarda sem perder o progresso e libera a vaga" aria-label="Guardar ${esc(t.nome)} (o progresso fica)"`;
      return { botao: btn(attrs, "Guardar", "secundario"), nota: "" };
    }
    if (t.estado === "cumprida") return { botao: btn("disabled", "Cumprida · entregue a um atalaia"), nota: "" };
    if (t.estado === "espera") return { botao: btn("disabled", `Volta em ${esc(textoEspera(t.esperaMs))}`), nota: "" };
    return { botao: btn("disabled", `${imgGlifo("ui_cadeado")}Bloqueada`), nota: `Requer: ${t.motivo}.` };
  }

  function htmlCacada(t, haVaga) {
    const retrato = t.retrato ? retratoURL(visualDe(t.retrato), { escala: 2, recorte: "busto" }) : "";
    const acompanhada = ["ativa", "cumprida", "guardada"].includes(t.estado);
    const pct = t.meta > 0 ? Math.min(100, (100 * t.progresso) / t.meta) : 0;
    const barra = acompanhada
      ? `<div class="barra xp" role="progressbar" aria-label="Progresso de ${esc(t.nome)}" aria-valuemin="0" aria-valuenow="${t.progresso}"
          aria-valuemax="${t.meta}"><i style="width:${pct.toFixed(1)}%"></i><b>${t.progresso}/${t.meta}</b></div>`
      : "";
    const { botao, nota } = acaoCacada(t, haVaga);
    const outraRegiao = muralNpc !== t.mural ? `<span class="regiao">${esc(t.nomeArea)}</span>` : "";
    const guardada = t.estado === "guardada" ? '<em class="etiqueta-tipo estado">Guardada</em>' : "";
    const premio = `+${t.recompensa.xp} XP · ${t.recompensa.moedas} moedas · ${imgGlifo("ui_selo", "px g16")}${t.pontosNaEntrega} pts${t.primeiraVez ? " (1ª vez)" : ""}`;
    return `<li class="item-loja cacada${t.estado === "espera" ? " em-espera" : ""}" data-tarefa="${esc(t.id)}">
      <span class="icone">${retrato ? `<img class="px" src="${retrato}" alt="">` : ""}</span>
      <div class="cacada-info">
        <div class="cacada-nome"><strong>${esc(t.nome)}</strong><em class="etiqueta-tipo${t.tipo === "grande" ? " grande" : ""}">${esc(t.tipoNome)}</em>${guardada}${outraRegiao}</div>
        <p class="cacada-desc">${esc(t.descricao)}</p>
        <p>Valem: ${esc(t.valem.join(", "))}</p>${barra}
        <p class="cacada-premio">${premio}</p>${nota ? `<p class="cacada-nota">${esc(nota)}</p>` : ""}
      </div>
      <div class="cacada-acao">${botao}</div></li>`;
  }

  function montarTroca(p) {
    const selo = imgGlifo("ui_selo", "px g16");
    const aqui = muralNpc !== null;
    const linhas = ofertasDeTroca(p).map((o) => {
      const icone = o.item ? htmlItem(o.item) : imgGlifo(o.icone || "ui_alforje", "px g32", o.nome);
      const confirmando = aqui && o.estado === "disponivel" && confirmaTroca === o.id;
      let rot = `${o.preco} ${selo}`, attrs = "", estado = "";
      if (o.estado === "comprada") { rot = "Já é seu"; attrs = "disabled"; estado = "já é seu"; }
      else if (o.estado === "bloqueada") { rot = `${imgGlifo("ui_cadeado")}Bloqueada`; attrs = "disabled"; estado = `requer ${o.motivo}`; }
      else if (o.estado === "semPontos") { rot = `faltam ${o.falta}`; attrs = `disabled title="Faltam ${o.falta} pontos de tarefa"`; estado = `faltam ${o.falta}`; }
      else if (!aqui) { attrs = 'disabled title="Fale com um atalaia"'; estado = "fale com um atalaia"; }
      else if (confirmando) { attrs = "disabled"; estado = "confirme abaixo"; }
      const rotulo = `Trocar ${o.preco} pontos de tarefa por ${o.nome}${estado ? `; ${estado}` : ""}`;
      // A confirmação nasce abaixo da linha e o foco vai para "Cancelar", à direita: no celular o modal
      // cresce para cima, e um 2º toque no mesmo ponto cai em "Cancelar", não em "Trocar de novo".
      const confirmacao = confirmando
        ? `<div class="confirma-troca" role="group" aria-label="Confirmar troca"><p>Você já tem ${esc(o.nome)}. Trocar de novo por ${o.preco} pontos?</p>
          <button type="button" class="btn primario" data-confirmar-troca="${esc(o.id)}">Trocar de novo</button>
          <button type="button" class="btn secundario" data-cancelar-troca="${esc(o.id)}">Cancelar</button></div>`
        : "";
      return `<li class="item-loja" data-oferta="${esc(o.id)}"><span class="icone">${icone}</span>
        <span><strong>${esc(o.nome)}</strong><span>${esc(o.efeito)} · ${o.preco} pontos</span>${o.estado === "bloqueada" ? `<span class="motivo">Requer: ${esc(o.motivo)}.</span>` : ""}</span>
        <button type="button" class="btn primario" data-trocar="${esc(o.id)}" ${attrs} aria-label="${esc(rotulo)}">${rot}</button>${confirmacao}</li>`;
    }).join("");
    const consulta = aqui ? "" : '<p class="nota">Para trocar, fale com um atalaia de mural aberto. Aqui você vê os preços e o que falta.</p>';
    return `${consulta}<ul class="lista-loja">${linhas}</ul>
      <p class="nota">Pontos de tarefa não expiram nem se perdem na morte. Os mercadores não compram itens da troca.</p>`;
  }


  const fmt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString("pt-BR") : "—");
  // ----- Vocações e barra de habilidades (JGB-20) -----
  // Só lê a vocação pelas funções puras (barraHabilidades, visaoVocacao); escolher e usar são comandos.
  const temVocacao = (p) => typeof barraHabilidades === "function" && !!p?.vocacao?.id;
  let htmlBarraHab = "", vocacaoNpc = null, confirmaVocacao = null, htmlVocacao = "";
  // Talentos (JGB-21): aba da janela Vocação; aprender e refazer são comandos, a árvore vem de visaoTalentos.
  let abaVocacao = "vocacao", retornoTalento = null;
  const temTalentos = () => typeof visaoTalentos === "function";
  function atualizarBarraHab(p) {
    const caixa = $("#barraHab");
    if (!caixa) return;
    const barra = temVocacao(p) ? barraHabilidades(p, Date.now()) : [];
    if (caixa.hidden !== !barra.length) {
      caixa.hidden = !barra.length;
      if (modo && modo !== "estreito") ajustarConsole(); // a pilha de atalhos do dock mudou de altura
    }
    const html = barra.map((h, i) => {
      const seg = Math.ceil(h.restanteMs / 1000);
      const r = h.recarga ? Math.min(1, h.restanteMs / h.recarga) : 0;
      const estado = !h.aberta ? `Abre no nível ${h.nivel}` : seg ? `pronta em ${seg} s` : "pronta";
      return `<button type="button" class="hab${h.aberta ? "" : " bloqueada"}" data-hab="${i}" style="--r:${h.aberta ? r.toFixed(2) : 0}"
        aria-label="${esc(h.nome)}, tecla ${i + 1}: ${estado}" title="${esc(h.nome)} (tecla ${i + 1}) — ${esc(h.descricao)} Recarga ${Math.round(h.recarga / 1000)} s. ${estado}.">
        <span class="tecla-n">${i + 1}</span>${imgGlifo("hb_" + h.icone, "px")}<span class="recarga"></span>
        ${!h.aberta ? `<span class="seg">Nv ${h.nivel}</span>` : seg ? `<span class="seg">${seg}</span>` : ""}</button>`;
    }).join("");
    if (html === htmlBarraHab) return;
    htmlBarraHab = html;
    caixa.innerHTML = html;
  }
  function atualizarBotaoVocacao(p) {
    const b = $("#btnVocacao");
    if (!b || typeof visaoVocacao !== "function") return;
    const v = visaoVocacao(p);
    const livres = temTalentos() && v.atual ? visaoTalentos(p).livres : 0;
    b.classList.toggle("escolher", (!v.atual && v.podeEscolher) || v.podeEspecializar || livres > 0);
    const rotulo = `Vocação, habilidades e talentos (V)${livres ? ` · ${livres} ponto${livres > 1 ? "s" : ""} de talento livre${livres > 1 ? "s" : ""}` : ""}`;
    if (b.title !== rotulo) { b.title = rotulo; b.setAttribute("aria-label", rotulo); }
  }
  function abrirVocacao(npcId, aba) {
    if (!jogador() || typeof visaoVocacao !== "function") return;
    vocacaoNpc = typeof npcId === "string" ? npcId : null;
    confirmaVocacao = null;
    retornoTalento = null;
    // Com o mestre, abre na vocação; com pontos livres (e sem escolha pendente), nos talentos.
    if (aba === "talentos" || aba === "vocacao") abaVocacao = aba;
    else if (vocacaoNpc) abaVocacao = "vocacao";
    else if (temTalentos() && jogador().vocacao?.id && visaoTalentos(jogador()).livres > 0 && !visaoVocacao(jogador()).podeEspecializar) abaVocacao = "talentos";
    desenharVocacao(true);
    abrirModal("modalVocacao");
  }
  function desenharVocacao(forcar) {
    const p = jogador();
    const corpo = $("#vocacaoCorpo");
    if (!p || !corpo || typeof visaoVocacao !== "function") return;
    const html = montarVocacao(p);
    if (!forcar && html === htmlVocacao) return;
    htmlVocacao = html;
    const ativo = document.activeElement && corpo.contains(document.activeElement) ? document.activeElement : null;
    const chaves = ["vocacao", "especializacao", "talento", "abaVocacao", "resetTalentos"];
    const chave = ativo ? chaves.find((k) => ativo.dataset[k] !== undefined) : null;
    const rolagem = corpo.scrollTop;
    corpo.innerHTML = html;
    preencherGlifos(corpo);
    corpo.scrollTop = rolagem;
    if (chave) {
      const attr = chave.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
      const alvo = $(`[data-${attr}="${ativo.dataset[chave]}"]`, corpo);
      // Talento que acabou de completar some o botão: o foco vai para o retorno.
      (alvo && !alvo.disabled ? alvo : $("[data-retorno]", corpo))?.focus({ preventScroll: true });
    }
  }
  function montarVocacao(p) {
    const v = visaoVocacao(p);
    if (!v.atual || !temTalentos()) return montarVocacaoPrincipal(p);
    const t = visaoTalentos(p);
    const abas = [["vocacao", "hb_escudo", "Vocação"], ["talentos", "ui_talentos", `Talentos${t.livres ? ` (${t.livres})` : ""}`]];
    const painel = abaVocacao === "talentos" ? montarTalentos(t) : montarVocacaoPrincipal(p);
    return `<div class="abas-modal" role="tablist" aria-label="Vocação">${abas.map(([k, g, rot]) => `<button type="button" class="aba-modal" role="tab"
        id="abaVocacao-${k}" data-aba-vocacao="${k}" aria-selected="${abaVocacao === k}" aria-controls="painelVocacao">${imgGlifo(g)}${rot}</button>`).join("")}</div>
      <div id="painelVocacao" role="tabpanel" aria-labelledby="abaVocacao-${abaVocacao}">${painel}</div>`;
  }
  function montarTalentos(t) {
    const r = retornoTalento;
    const retorno = r ? `<p class="retorno${r.ok ? "" : " erro"}" role="status" tabindex="-1" data-retorno>${esc(r.mensagem)}</p>` : "";
    const pts = (n) => `${n} ponto${n === 1 ? "" : "s"}`;
    const topo = `<p class="tal-topo"><strong>${t.livres ? `${pts(t.livres)} livre${t.livres === 1 ? "" : "s"}` : "Nenhum ponto livre"}</strong> · ${t.gastos} de ${t.totais} gastos.
      Você ganha 1 ponto por nível desde o ${t.nivelInicial}. Cada fileira abre com pontos no ramo; o último talento de cada ramo é um ápice, e só ${t.apicesPorPersonagem === 1 ? "um ápice" : `${t.apicesPorPersonagem} ápices`} vale${t.apicesPorPersonagem === 1 ? "" : "m"} por vez.</p>`;
    const resumo = t.resumo ? `<p class="tal-resumo"><strong>Seus talentos somam:</strong> ${esc(t.resumo)}.</p>` : "";
    const reset = t.gastos
      ? `<div class="acoes-modal tal-reset"><button type="button" class="btn ${confirmaVocacao === "reset" ? "primario" : "secundario"}" data-reset-talentos="1">${confirmaVocacao === "reset" ? `Confirmar: refazer por ${t.precoReset} moedas` : `Refazer talentos (${t.precoReset} moedas)`}</button></div>`
      : "";
    const ramos = t.ramos.map((ramo) => {
      const fileiras = [1, 2, 3, 4].map((tier) => {
        const ts = ramo.talentos.filter((x) => x.tier === tier);
        if (!ts.length) return "";
        const aberta = ramo.pontos >= ts[0].precisa;
        return `<div class="tal-fileira${aberta ? "" : " fechada"}"><p class="tal-req">Fileira ${tier}${ts[0].precisa ? ` · ${ts[0].precisa} pontos no ramo` : ""}</p>${ts.map(htmlTalento).join("")}</div>`;
      }).join("");
      return `<section class="tal-ramo" aria-label="Ramo ${esc(ramo.nome)}"><h3>${esc(ramo.nome)} <small>${esc(ramo.foco)} · ${pts(ramo.pontos)}</small></h3>${fileiras}</section>`;
    }).join("");
    return `${retorno}${topo}${resumo}<div class="tal-ramos">${ramos}</div>${reset}`;
  }
  function htmlTalento(x) {
    const cheio = x.graus >= x.maximo;
    const classes = ["tal", x.graus ? "tem" : "", cheio ? "cheio" : "", x.apice ? "apice" : ""].filter(Boolean).join(" ");
    const efeito = x.maximo > 1 ? `<p class="tal-ef">Cada ponto: ${esc(x.porGrau)}.</p>` : `<p class="tal-ef">${esc(x.porGrau)}.</p>`;
    const agora = x.graus && x.maximo > 1 ? `<p class="tal-agora">Agora: ${esc(x.atual)}.</p>` : "";
    const sabor = x.texto ? `<p class="tal-sabor">${esc(x.texto)}</p>` : "";
    const requer = x.requer ? `<p class="tal-req-t">Requer ${esc(x.requer)} completo.</p>` : "";
    let acao = "";
    if (!cheio && x.pode) {
      const confirmar = confirmaVocacao === "tal:" + x.id;
      const rot = x.apice ? (confirmar ? `Confirmar ápice: ${esc(x.nome)}` : "Aprender ápice") : x.graus ? `+1 ponto (${x.graus + 1}/${x.maximo})` : "Aprender (1 ponto)";
      acao = `<button type="button" class="btn ${confirmar ? "primario" : "secundario"} tal-btn" data-talento="${x.id}" aria-label="${esc(x.nome)}: ${rot}">${rot}</button>`;
    } else if (!cheio) acao = `<p class="tal-motivo">${esc(x.motivo)}</p>`;
    return `<div class="${classes}"><div class="tal-cab"><strong>${x.apice ? "Ápice · " : ""}${esc(x.nome)}</strong><span class="tal-graus" aria-label="${x.graus} de ${x.maximo} pontos">${x.graus}/${x.maximo}</span></div>
      ${efeito}${agora}${sabor}${requer}${acao}</div>`;
  }
  function acaoTalento(botao) {
    if (botao.dataset.abaVocacao) {
      abaVocacao = botao.dataset.abaVocacao;
      confirmaVocacao = null;
      retornoTalento = null;
      desenharVocacao(true);
      $(`#vocacaoCorpo [data-aba-vocacao="${abaVocacao}"]`)?.focus();
      return;
    }
    const talento = botao.dataset.talento;
    const chave = talento ? "tal:" + talento : "reset";
    const apice = talento && /Ápice|ápice/.test(botao.textContent);
    if ((!talento || apice) && confirmaVocacao !== chave) {
      confirmaVocacao = chave;
      desenharVocacao(true);
      return;
    }
    confirmaVocacao = null;
    retornoTalento = talento ? executar({ tipo: "aprenderTalento", talento }) : executar({ tipo: "resetarTalentos" });
    desenharVocacao(true);
    atualizar();
  }
  function montarVocacaoPrincipal(p) {
    const v = visaoVocacao(p);
    const nivel = p.nivel || 1;
    const atual = v.vocacoes.find((x) => x.id === v.atual);
    const listaHabs = (habs) => `<ul class="voc-habs">${habs.map((h) => `<li class="${nivel >= h.nivel ? "" : "fechada"}" title="${esc(h.descricao)}">${imgGlifo("hb_" + h.icone, "px")}${esc(h.nome)} <small>Nv ${h.nivel}</small></li>`).join("")}</ul>`;
    const noMestre = !!vocacaoNpc;
    const cartao = (x) => {
      const ehAtual = x.id === v.atual;
      let botao = "";
      if (!ehAtual && v.podeEscolher && (!v.atual || noMestre)) {
        const custo = v.atual ? (v.precoTroca ? ` (${v.precoTroca} moedas)` : " (grátis)") : "";
        const confirmar = confirmaVocacao === x.id;
        botao = `<div class="acoes-modal"><button type="button" class="btn ${confirmar ? "primario" : "secundario"}" data-vocacao="${x.id}">${confirmar ? `Confirmar: ser ${esc(x.nome)}${custo}` : `${v.atual ? "Trocar para" : "Escolher"} ${esc(x.nome)}${custo}`}</button></div>`;
      }
      return `<li class="voc-card${ehAtual ? " atual" : ""}"><h3>${esc(x.nome)} · ${esc(x.titulo)}${ehAtual ? " (você)" : ""}</h3>
        <p class="papel">${esc(x.papel)}</p><p>${esc(x.descricao)} <strong>${esc(x.textoPassivo)}</strong></p>${listaHabs(x.habilidades)}${botao}</li>`;
    };
    let topo;
    if (!v.atual && !v.podeEscolher) topo = `<p>Você escolhe a sua vocação no nível ${v.nivelEscolha} (agora: ${nivel}). Conheça os caminhos:</p>`;
    else if (!v.atual) topo = `<p>Escolha a sua vocação. Ela define as suas habilidades (teclas 1 a 8; os itens passam para Shift + 1 a 6). Você pode trocar depois com Jetro, o mestre de vocações, em Canaã: ${v.trocasGratis ? "a primeira troca é grátis" : `custa ${v.precoTroca} moedas`}.</p>`;
    else topo = `<p>Você é <strong>${esc(atual.nome)}</strong> (${esc(atual.titulo)}). ${noMestre ? (v.precoTroca ? `Trocar custa ${v.precoTroca} moedas e recomeça a especialização.` : "A próxima troca é grátis (a especialização recomeça).") : "Para trocar de vocação, fale com Jetro, o mestre de vocações, na vila de Canaã."}</p>`;
    let esp = "";
    if (atual) {
      const escolhida = atual.especializacoes.find((e) => e.id === v.especializacao);
      if (escolhida) esp = `<h3>Especialização: ${esc(escolhida.nome)}</h3><p>${esc(escolhida.textoPassivo)} Habilidade: ${esc(escolhida.habilidade.nome)} — ${esc(escolhida.habilidade.descricao)}</p>`;
      else esp = `<h3>Especialização (nível ${v.nivelEspecializacao})</h3><ul class="voc-lista">${atual.especializacoes.map((e) => `<li class="voc-card"><h3>${esc(e.nome)}</h3><p>${esc(e.textoPassivo)} Habilidade: <strong>${esc(e.habilidade.nome)}</strong> — ${esc(e.habilidade.descricao)}</p>${v.podeEspecializar ? `<div class="acoes-modal"><button type="button" class="btn ${confirmaVocacao === "esp:" + e.id ? "primario" : "secundario"}" data-especializacao="${e.id}">${confirmaVocacao === "esp:" + e.id ? `Confirmar: ${esc(e.nome)} (definitivo até trocar de vocação)` : `Escolher ${esc(e.nome)}`}</button></div>` : ""}</li>`).join("")}</ul>`;
    }
    const outras = v.vocacoes.filter((x) => x.id !== v.atual);
    return `${topo}<ul class="voc-lista">${atual ? cartao(atual) : ""}</ul>${esp}${outras.length ? `<h3>${v.atual ? "Outras vocações" : "Vocações"}</h3><ul class="voc-lista">${outras.map(cartao).join("")}</ul>` : ""}`;
  }
  function acaoVocacao(botao) {
    const voc = botao.dataset.vocacao;
    const esp = botao.dataset.especializacao;
    const chave = voc || "esp:" + esp;
    if (confirmaVocacao !== chave) {
      confirmaVocacao = chave;
      desenharVocacao(true);
      $(`#vocacaoCorpo [data-${voc ? "vocacao" : "especializacao"}="${voc || esp}"]`)?.focus();
      return;
    }
    confirmaVocacao = null;
    const r = voc ? executar({ tipo: "escolherVocacao", vocacao: voc }) : executar({ tipo: "escolherEspecializacao", especializacao: esp });
    desenharVocacao(true);
    if (r?.ok) { fecharModal(); atualizar(); }
  }

  // ----- Ofícios (JGB-24) -----
  // A janela só lê visaoOficios; fabricar é o comando { tipo: "fabricar", receita, quantidade }.
  const temOficios = () => typeof visaoOficios === "function";
  let abaOficio = "pescador", retornoOficio = null, htmlOficios = "";
  function abrirOficios(aba) {
    if (!jogador() || !temOficios()) return;
    if (typeof aba === "string" && typeof OFICIOS !== "undefined" && OFICIOS[aba]) abaOficio = aba;
    retornoOficio = null;
    desenharOficios(true);
    abrirModal("modalOficios");
  }
  function desenharOficios(forcar) {
    const p = jogador();
    const corpo = $("#oficiosCorpo");
    if (!p || !corpo || !temOficios()) return;
    const html = montarOficios(p);
    if (!forcar && html === htmlOficios) return;
    htmlOficios = html;
    const ativo = document.activeElement && corpo.contains(document.activeElement) ? document.activeElement : null;
    const chave = ativo?.dataset.fabricar ? `[data-fabricar="${ativo.dataset.fabricar}"][data-qtd="${ativo.dataset.qtd}"]` : ativo?.dataset.abaOficio ? `[data-aba-oficio="${ativo.dataset.abaOficio}"]` : null;
    const rolagem = corpo.scrollTop;
    corpo.innerHTML = html;
    preencherGlifos(corpo);
    corpo.scrollTop = rolagem;
    if (chave) ($(chave, corpo) || $("[data-retorno]", corpo))?.focus({ preventScroll: true });
  }
  const pct = (x) => `${String(Math.round(x * 1000) / 10).replace(".", ",")}%`;
  function montarOficios(p) {
    const lista = visaoOficios(p);
    const o = lista.find((x) => x.id === abaOficio) || lista[0];
    const abas = `<div class="abas-modal abas-oficios" role="tablist" aria-label="Ofícios">${lista.map((x) => `<button type="button" class="aba-modal" role="tab"
      id="abaOficio-${x.id}" data-aba-oficio="${x.id}" aria-selected="${x.id === o.id}" aria-controls="painelOficio">${imgGlifo("of_" + x.icone)}<span>${esc(x.nome)}</span><small>${x.nivel}</small></button>`).join("")}</div>`;
    const r = retornoOficio;
    const retorno = r ? `<p class="retorno${r.ok ? "" : " erro"}" role="status" tabindex="-1" data-retorno>${esc(r.mensagem)}</p>` : "";
    const barra = o.maximo ? "Nível máximo" : `${o.xpNoNivel}/${o.xpParaProximo} XP`;
    const largura = o.maximo ? 100 : (o.xpNoNivel / o.xpParaProximo) * 100;
    const bonus = [];
    if (o.coleta.length) bonus.push(`Colher: ${o.coleta.map((c) => `${esc(c.nome.toLowerCase())} +${c.xp} XP`).join(", ")}.`);
    if (o.extra > 0) bonus.push(`Chance de colher 1 a mais: ${pct(o.extra)}.`);
    if (o.id === "pescador") bonus.push(o.peixeGrande > 0 ? `Peixe grande: ${pct(o.peixeGrande)} por pesca.` : `Peixe grande a partir do nível ${typeof REGRAS_OFICIOS !== "undefined" ? REGRAS_OFICIOS.peixeGrande.nivel : 5}.`);
    const cab = `<div class="oficio-cab"><div><h3>${esc(o.nome)} · nível ${o.nivel}</h3><p>${esc(o.descricao)}</p></div>
      <div class="oficio-xp" title="${barra}"><span class="mini-barra xp"><i style="width:${largura.toFixed(1)}%"></i></span><b>${barra}</b></div></div>
      <p class="oficio-onde">${esc(o.onde)}${bonus.length ? ` ${bonus.join(" ")}` : ""}</p>`;
    const receitas = `<ul class="lista-loja receitas">${o.receitas.map(htmlReceita).join("")}</ul>`;
    return `${abas}<div id="painelOficio" role="tabpanel" aria-labelledby="abaOficio-${o.id}">${retorno}${cab}${receitas}
      <p class="oficio-pe">Fabrique em qualquer lugar, com os materiais da mochila (o equipamento vestido não conta).</p></div>`;
  }
  function htmlReceita(x) {
    const prod = x.produto;
    const nome = `${prod.quantidade > 1 ? `${prod.quantidade}× ` : ""}${esc(prod.nome)}`;
    const mats = x.materiais.map((m) => `<span class="${m.tem >= m.precisa ? "tem" : "falta"}">${esc(m.nome)} ${Math.min(m.tem, 99)}/${m.precisa}</span>`).join(" · ");
    const extras = [`+${x.xp} XP`];
    if (prod.valor) extras.push(`vende por ${prod.valor}`);
    if (x.qualidade > 0) extras.push(`${pct(x.qualidade)} de sair incomum ou melhor`);
    let acao;
    if (!x.aberta) acao = `<span class="receita-nivel">Nível ${x.nivel}</span>`;
    else if (!x.pode) acao = `<button type="button" class="btn secundario" disabled title="${esc(x.motivo)}">Fazer</button>`;
    else acao = `<span class="receita-acoes"><button type="button" class="btn primario" data-fabricar="${x.id}" data-qtd="1">Fazer</button>${x.vezes > 1 ? `<button type="button" class="btn secundario" data-fabricar="${x.id}" data-qtd="todos">Todos (${x.vezes})</button>` : ""}</span>`;
    return `<li class="item-loja receita${x.aberta ? "" : " fechada"}"><span class="icone">${htmlItem(prod.item)}</span>
      <span><strong>${nome} <small>nível ${x.nivel}</small></strong><span class="materiais">${mats}</span><span>${extras.join(" · ")}</span>${x.aberta && !x.pode ? `<span class="motivo">${esc(x.motivo)}</span>` : ""}</span>${acao}</li>`;
  }
  function acaoOficio(botao) {
    if (botao.dataset.abaOficio) {
      abaOficio = botao.dataset.abaOficio;
      retornoOficio = null;
      desenharOficios(true);
      $(`#oficiosCorpo [data-aba-oficio="${abaOficio}"]`)?.focus();
      return;
    }
    retornoOficio = executar({ tipo: "fabricar", receita: botao.dataset.fabricar, quantidade: botao.dataset.qtd === "todos" ? "todos" : 1 });
    desenharOficios(true);
    atualizar();
  }

  // ----- Visual: cores, trajes e montarias (JGB-27, cores na JGB-49) -----
  // Só lê cosmeticosDoJogador e visualDoJogador (funções puras); pintar, vestir, montar e comprar são
  // comandos. Nada aqui muda combate.
  const temVisual = () => typeof cosmeticosDoJogador === "function";
  const temCores = () => typeof CORES_VISUAL !== "undefined" && typeof PARTES_COR_VISUAL !== "undefined" && typeof visualDoJogador === "function";
  let abaVisual = "cores", retornoVisual = null, htmlVisual = "";
  // Prévia do boneco (de frente, de lado e de costas) com as cores escolhidas: 3 px de tela por px de arte.
  const cachePreviaCores = new Map();
  function previaBoneco(chave, quadro) {
    const id = chave + "#" + quadro;
    if (!cachePreviaCores.has(id)) {
      let url = "";
      try { url = Arte.canvas(chave, { quadro, escala: 6 })?.toDataURL("image/png") || ""; } catch (e) { url = ""; }
      if (cachePreviaCores.size > 120) cachePreviaCores.clear();
      cachePreviaCores.set(id, url);
    }
    return cachePreviaCores.get(id);
  }
  function montarCores(p) {
    const visual = visualDoJogador(p);
    const cores = visual.cores || {};
    let previa = "";
    if (temArte() && Arte.garantirJogador) {
      try {
        const chave = Arte.garantirJogador(p.equipamento || {}, { traje: visual.traje, cores });
        previa = [[5, "De frente"], [0, "De lado"], [10, "De costas"]].map(([q, nome]) => {
          const url = previaBoneco(chave, q);
          return url ? `<figure><img class="px" src="${url}" alt="Seu personagem ${nome.toLowerCase()}"><figcaption>${nome}</figcaption></figure>` : "";
        }).join("");
      } catch (e) { previa = ""; }
    }
    const nomeCor = (id) => CORES_VISUAL.find((c) => c.id === id)?.nome || "Cor do traje";
    const partes = Object.entries(PARTES_COR_VISUAL).map(([parte, nome]) => {
      const atual = cores[parte] || null;
      const amostras = [{ id: "", nome: "Cor do traje", cor: "" }].concat(CORES_VISUAL).map((c) => {
        const marcada = (c.id || null) === atual;
        return `<button type="button" class="amostra-cor${c.id ? "" : " padrao"}" data-cor-parte="${parte}" data-cor="${esc(c.id)}" aria-pressed="${marcada}" title="${esc(c.nome)}" aria-label="${esc(nome)}: ${esc(c.nome)}"${c.cor ? ` style="--cor:${c.cor}"` : ""}></button>`;
      }).join("");
      return `<fieldset class="parte-cor"><legend>${esc(nome)} <small>${esc(nomeCor(atual))}</small></legend><div class="amostras">${amostras}</div></fieldset>`;
    }).join("");
    const traje = visual.traje && typeof TRAJES !== "undefined" ? TRAJES[visual.traje]?.nome : null;
    return `<div class="cores-visual"><div class="previa-cores" aria-live="polite">${previa}</div><div class="partes-cores">${partes}
      <p class="oficio-pe">${traje ? `Pintando o traje ${esc(traje)}. ` : ""}Cabeça: cabelo ou pano da cabeça · Tronco: veste de cima · Pernas: parte de baixo · Detalhe: cinto, gola e barra. Grátis e só aparência.</p>
      <button type="button" class="btn secundario" data-cores-padrao>Voltar às cores do traje</button></div></div>`;
  }
  function abrirVisual() {
    if (!jogador() || !temVisual()) return;
    retornoVisual = null;
    desenharVisual(true);
    abrirModal("modalVisual");
  }
  function previaCosmetico(x) {
    if (!temArte()) return "";
    try {
      if (x.tipo === "montaria") return Arte.iconeURL("mt_" + x.id, 2);
      const chave = Arte.garantirJogador({}, { traje: x.id });
      return Arte.retratoURL(chave, { escala: 2, recorte: "inteiro" });
    } catch (e) { return ""; }
  }
  function desenharVisual(forcar) {
    const p = jogador();
    const corpo = $("#visualCorpo");
    if (!p || !corpo || !temVisual()) return;
    const lista = cosmeticosDoJogador(p);
    if (abaVisual === "cores" && !temCores()) abaVisual = "traje";
    const itens = lista.filter((x) => x.tipo === abaVisual);
    const abas = `<div class="abas-modal" role="tablist" aria-label="Visual">${(temCores() ? [["cores", "Cores"]] : []).concat([["traje", "Trajes"], ["montaria", "Montarias"]]).map(([id, nome]) =>
      `<button type="button" class="aba-modal" role="tab" data-aba-visual="${id}" aria-selected="${id === abaVisual}">${nome}${id === "cores" ? "" : `<small>${lista.filter((x) => x.tipo === id && x.possui).length}/${lista.filter((x) => x.tipo === id).length}</small>`}</button>`).join("")}</div>`;
    const r = retornoVisual;
    const retorno = r && r.mensagem ? `<p class="retorno${r.ok ? "" : " erro"}" role="status" tabindex="-1" data-retorno>${esc(r.mensagem || "")}</p>` : "";
    if (abaVisual === "cores") {
      const html = `${abas}${retorno}${montarCores(p)}`;
      if (!forcar && html === htmlVisual) return;
      htmlVisual = html;
      const foco = document.activeElement && corpo.contains(document.activeElement) && document.activeElement.dataset.corParte
        ? `[data-cor-parte="${document.activeElement.dataset.corParte}"][data-cor="${document.activeElement.dataset.cor}"]` : null;
      corpo.innerHTML = html;
      preencherGlifos(corpo);
      if (foco) $(foco, corpo)?.focus({ preventScroll: true });
      return;
    }
    const nomeVoc = (v) => (typeof VOCACOES !== "undefined" && VOCACOES[v]?.nome) || v;
    const linhas = itens.map((x) => {
      const url = previaCosmetico(x);
      const tags = [x.gratuito ? "Gratuito" : x.possui ? "Seu" : x.preco == null ? "Preço a definir" : `R$ ${String(x.preco.toFixed(2)).replace(".", ",")}`];
      if (x.vocacao) tags.push(`Vocação: ${esc(nomeVoc(x.vocacao))}`);
      let acao;
      if (x.emUso) acao = `<button type="button" class="btn secundario" data-cosmetico-tirar="${x.tipo}">${x.tipo === "traje" ? "Tirar" : "Descer"}</button>`;
      else if (x.podeUsar) acao = `<button type="button" class="btn primario" data-cosmetico-usar="${x.id}" data-tipo="${x.tipo}">${x.tipo === "traje" ? "Vestir" : "Montar"}</button>`;
      else if (x.possui) acao = `<button type="button" class="btn secundario" disabled title="${esc(x.motivo || "")}">${x.tipo === "traje" ? "Vestir" : "Montar"}</button>`;
      else acao = `<button type="button" class="btn secundario" data-cosmetico-comprar="${x.id}"${x.aVenda ? "" : ` title="${esc(typeof REGRAS_COSMETICOS !== "undefined" ? REGRAS_COSMETICOS.textoSemPagamento : "")}"`}>${x.aVenda ? "Comprar" : "Em breve"}</button>`;
      return `<li class="item-loja cosmetico${x.emUso ? " em-uso" : ""}"><span class="icone">${url ? `<img class="px" src="${url}" alt="">` : ""}</span>
        <span><strong>${esc(x.nome)}${x.emUso ? " <small>em uso</small>" : ""}</strong><span>${esc(x.descricao || "")}</span><span class="preco">${tags.join(" · ")}</span>${x.possui && x.motivo ? `<span class="motivo">${esc(x.motivo)}</span>` : ""}</span>${acao}</li>`;
    }).join("");
    const html = `${abas}${retorno}<ul class="lista-loja">${linhas}</ul><p class="oficio-pe">Compra única, sem assinatura. Cosméticos não mudam dano, defesa, vida, carga nem velocidade.</p>`;
    if (!forcar && html === htmlVisual) return;
    htmlVisual = html;
    corpo.innerHTML = html;
    preencherGlifos(corpo);
  }
  function acaoVisual(botao) {
    const d = botao.dataset;
    if (d.abaVisual) { abaVisual = d.abaVisual; retornoVisual = null; desenharVisual(true); $(`#visualCorpo [data-aba-visual="${abaVisual}"]`)?.focus(); return; }
    if (d.corParte) {
      const r = executar({ tipo: "definirCores", cores: { [d.corParte]: d.cor || null } });
      retornoVisual = r && !r.ok ? r : null;
    } else if ("coresPadrao" in d) {
      const r = executar({ tipo: "definirCores", cores: Object.fromEntries(Object.keys(PARTES_COR_VISUAL).map((k) => [k, null])) });
      retornoVisual = r && !r.ok ? r : null;
    } else if (d.cosmeticoTirar) retornoVisual = executar(d.cosmeticoTirar === "traje" ? { tipo: "vestirTraje", traje: null } : { tipo: "usarMontaria", montaria: null });
    else if (d.cosmeticoUsar) retornoVisual = executar(d.tipo === "traje" ? { tipo: "vestirTraje", traje: d.cosmeticoUsar } : { tipo: "usarMontaria", montaria: d.cosmeticoUsar });
    else if (d.cosmeticoComprar) retornoVisual = executar({ tipo: "comprarCosmetico", cosmetico: d.cosmeticoComprar });
    desenharVisual(true);
    atualizar();
  }

  // ----- Maná diário e descanso do Sábado (JGB-11) -----
  // Só lê p.mana e p.descanso pelas funções puras (estadoMana, estadoDescanso); colher e comer são comandos.
  const temMana = () => typeof estadoMana === "function" && typeof estadoDescanso === "function";
  let htmlMana = "";
  function abrirMana() {
    if (!jogador() || !temMana()) return;
    desenharMana(true);
    abrirModal("modalMana");
  }
  function atualizarBotaoMana(p) {
    const b = $("#btnMana");
    if (!b || !temMana()) return;
    const m = estadoMana(p, Date.now());
    b.classList.toggle("caiu", m.disponivel);
    const qtd = $("#manaQtd");
    qtd.hidden = !m.guardado;
    if (qtd.textContent !== String(m.guardado)) qtd.textContent = String(m.guardado);
    const rotulo = m.disponivel
      ? `Maná: ${m.porcaoHoje} porções para colher (N)`
      : m.guardado ? `Maná: ${m.guardado} no jarro (N)` : "Maná e descanso (N)";
    if (b.getAttribute("aria-label") !== rotulo) { b.setAttribute("aria-label", rotulo); b.title = rotulo; }
  }
  function desenharMana(forcar) {
    const p = jogador();
    const corpo = $("#manaCorpo");
    if (!p || !corpo || !temMana()) return;
    const html = montarMana(p, Date.now());
    if (!forcar && html === htmlMana) return;
    htmlMana = html;
    const focado = document.activeElement && corpo.contains(document.activeElement) ? document.activeElement.dataset.acaoMana : null;
    corpo.innerHTML = html;
    preencherGlifos(corpo);
    if (focado) $(`[data-acao-mana="${focado}"]:not([disabled])`, corpo)?.focus({ preventScroll: true });
  }
  function montarMana(p, agora) {
    const m = estadoMana(p, agora);
    const d = estadoDescanso(p, agora);
    const R = typeof REGRAS_MANA !== "undefined" ? REGRAS_MANA : { cura: { vida: 0.5, fe: 30 } };
    const espera = (ms) => (typeof textoEspera === "function" ? textoEspera(ms) : "");
    const porcoes = (n) => (n === 1 ? "1 porção" : `${n} porções`);
    let hoje;
    if (m.disponivel) hoje = m.dobrado
      ? `Sexta-feira: caiu porção dobrada, ${porcoes(m.porcaoHoje)}. O de hoje dura o Sábado inteiro (Êx 16:22-24).`
      : `O maná caiu ao redor do arraial: ${porcoes(m.porcaoHoje)} para colher até o próximo amanhecer.`;
    else if (m.sabado) hoje = `Hoje é Sábado: o maná não cai (Êx 16:26). O próximo cai em ${espera(m.proximoEm - agora)}.`;
    else hoje = `Você já colheu o maná de hoje. O próximo cai em ${espera(m.proximoEm - agora)}.`;
    const jarro = m.guardado
      ? `No jarro: ${porcoes(m.guardado)}. Estraga em ${espera(m.estragaEm - agora)} (Êx 16:20).`
      : "O jarro está vazio.";
    const cura = `+${Math.round(R.cura.vida * 100)}% da vida${p.oracaoDesbloqueada ? ` e +${R.cura.fe} de fé` : ""}`;
    const colher = `<button type="button" class="btn primario" data-acao-mana="colher" ${m.disponivel ? "data-foco-inicial" : "disabled"}>Colher ${m.disponivel ? porcoes(m.porcaoHoje) : "o maná"}</button>`;
    const comer = `<button type="button" class="btn secundario" data-acao-mana="comer" ${m.guardado ? (m.disponivel ? "" : "data-foco-inicial") : "disabled"}>Comer 1 porção (${esc(cura)})</button>`;
    const descanso = d.xp
      ? `Reserva: ${fmt(d.xp)} XP. Os abates rendem XP × ${d.multiplicador} até ela acabar (o extra sai da reserva).`
      : "Sem reserva agora.";
    const agoraSabado = d.sabado ? " Agora é Sábado: o tempo longe do jogo vira reserva." : "";
    return `<section class="mana-bloco" aria-label="Maná de hoje"><h3>Maná de hoje</h3>
        <p>${esc(hoje)}</p><p>${esc(jarro)}</p>
        <div class="acoes-modal">${colher}${comer}</div></section>
      <section class="mana-bloco" aria-label="Descanso do Sábado"><h3>Descanso do Sábado</h3>
        <div class="barra xp${d.xp ? " descanso" : ""}" role="meter" aria-label="Reserva de descanso" aria-valuenow="${d.xp}" aria-valuemax="${d.limite}"><i style="width:${d.limite ? Math.min(100, (100 * d.xp) / d.limite).toFixed(1) : 0}%"></i><b>${fmt(d.xp)}/${fmt(d.limite)} XP</b></div>
        <p>${esc(descanso + agoraSabado)}</p></section>
      <p class="nota">O maná cai todo dia ao amanhecer (dobrado na sexta, nada no sábado); colha uma vez e coma quando
        precisar. O que sobra estraga no amanhecer seguinte, e perder um dia não tira nada. O tempo em que você fica longe do jogo
        de sexta às 18 h a sábado às 18 h vira reserva de XP (um Sábado inteiro vale o XP de um nível; ela não expira); uma hora
        dele já enche o vigor.</p>`;
  }
  function acaoMana(botao) {
    const tipo = botao.dataset.acaoMana === "colher" ? "colherMana" : "comerMana";
    executar({ tipo });
    desenharMana(true);
  }

  // ----- Bestiário (JGB-9) -----
  // Só lê o bestiário pelas funções puras de logica.js (bestiarioPorFamilia, resumoBestiario): o abate é
  // que conta, na lógica. especieAberta: a espécie com a ficha expandida (uma por vez).
  const temBestiario = () => typeof bestiarioPorFamilia === "function" && typeof resumoBestiario === "function";
  let especieAberta = null, htmlBestiario = "";
  function abrirBestiario() {
    if (!jogador() || !temBestiario()) return;
    especieAberta = null;
    desenharBestiario(true);
    abrirModal("modalBestiario");
  }
  function desenharBestiario(forcar) {
    const p = jogador();
    const corpo = $("#bestiarioCorpo");
    if (!p || !corpo || !temBestiario()) return;
    const html = montarBestiario(p);
    if (!forcar && html === htmlBestiario) return;
    htmlBestiario = html;
    // Mantém a rolagem e o foco na mesma espécie (a lista se redesenha a cada abate).
    const ativo = document.activeElement;
    const focada = ativo && corpo.contains(ativo) ? ativo.closest("[data-ver-especie]")?.dataset.verEspecie : null;
    const rolagem = corpo.scrollTop;
    corpo.innerHTML = html;
    corpo.scrollTop = rolagem;
    if (focada) $(`[data-ver-especie="${focada}"]`, corpo)?.focus({ preventScroll: true });
  }
  function montarBestiario(p) {
    const r = resumoBestiario(p);
    const estagios = typeof ESTAGIOS_BESTIARIO !== "undefined" ? ESTAGIOS_BESTIARIO : [];
    const legenda = estagios.map((e, i) => `<span><b>${i + 1}</b> ${esc(e.nome)}: ${fmt(e.abates)} abates · revela ${esc(e.texto)}</span>`).join("");
    const regra = typeof REGRAS_BESTIARIO !== "undefined" ? REGRAS_BESTIARIO.amuleto : null;
    const textoAmuleto = regra
      ? `Amuleto: com todas as espécies de uma família no estágio ${regra.estagio} (${esc(estagios[regra.estagio - 1]?.nome || "")}), você ganha +${Math.round(regra.bonusDano * 100)}% de dano contra ela, para sempre. Os raros nomeados não entram na conta.`
      : "";
    const familias = bestiarioPorFamilia(p).map((f) => htmlFamilia(f)).join("");
    return `<div class="saldo">${imgGlifo("ui_bestiario", "px g16")}<span>${r.conhecidas} de ${r.especies} espécies · ${imgGlifo("ui_amuleto", "px g16")}${r.amuletos} de ${r.familias} amuletos</span></div>
      <p class="legenda-estagios">${legenda}</p>
      <p class="nota">${textoAmuleto}</p>${familias}`;
  }
  function htmlFamilia(f) {
    const a = f.amuleto;
    const pct = a.total ? (100 * a.cumpridas) / a.total : 0;
    const amuleto = a.ativo
      ? `<span class="amuleto-fam ativo">${imgGlifo("ui_amuleto", "px g16")}Amuleto: +${Math.round(a.bonus * 100)}% de dano</span>`
      : a.total
        ? `<span class="amuleto-fam" title="Espécies no estágio ${a.estagio} (${esc(a.nomeEstagio)}) para o amuleto">${imgGlifo("ui_amuleto", "px g16")}<span class="mini-barra"><i style="width:${pct.toFixed(1)}%"></i></span>${a.cumpridas}/${a.total}</span>`
        : "";
    return `<section class="familia-bestiario" aria-label="${esc(f.nome)}"><div class="familia-cab"><h3>${esc(f.nome)}</h3>${amuleto}</div>
      <ul class="lista-especies">${f.especies.map((v) => htmlEspecie(v)).join("")}</ul></section>`;
  }
  function htmlEspecie(v) {
    const aberta = especieAberta === v.especie;
    const conhecida = v.abates > 0;
    const url = retratoURL(visualDe(v.inimigoId), { escala: 2, recorte: "busto" });
    const img = url ? `<img class="px${conhecida ? "" : " silhueta"}" src="${url}" alt="">` : "";
    const nome = conhecida ? v.nome : "???";
    const sub = [v.nomeArea, conhecida && v.ficha?.nivel ? `nível ${v.ficha.nivel}` : "", v.nomeado && conhecida ? "raro nomeado" : ""].filter(Boolean).join(" · ");
    const total = typeof ESTAGIO_MAXIMO_BESTIARIO !== "undefined" ? ESTAGIO_MAXIMO_BESTIARIO : 3;
    const pips = Array.from({ length: total }, (_, i) => `<i${i < v.estagio ? ' class="feito"' : ""}></i>`).join("");
    const prox = v.proximo;
    const pct = prox ? Math.min(100, (100 * (v.abates - prox.desde)) / Math.max(1, prox.abates - prox.desde)) : 100;
    const contagem = prox ? `${fmt(v.abates)}/${fmt(prox.abates)}` : `${fmt(v.abates)} · completa`;
    const estadoTxt = v.estagio ? `estágio ${v.estagio} de ${total}, ${v.nomeEstagio}` : "nenhum estágio";
    const rotulo = `${nome}, ${v.nomeArea}: ${fmt(v.abates)} abates, ${estadoTxt}${prox ? `; ${fmt(prox.abates)} abates para ${prox.nome}` : ""}`;
    return `<li class="especie" data-especie="${esc(v.especie)}">
      <button type="button" class="especie-linha" data-ver-especie="${esc(v.especie)}" aria-expanded="${aberta}" aria-controls="det-${esc(v.especie)}" aria-label="${esc(rotulo)}">
        <span class="icone">${img}</span>
        <span class="especie-info"><strong>${esc(nome)}</strong><span>${esc(sub)}</span></span>
        <span class="especie-prog"><span class="pips" title="${esc(estadoTxt)}">${pips}</span><span class="mini-barra"><i style="width:${pct.toFixed(1)}%"></i></span><b>${contagem}</b></span>
      </button>
      <div class="especie-detalhe" id="det-${esc(v.especie)}"${aberta ? "" : " hidden"}>${aberta ? htmlDetalheEspecie(v) : ""}</div></li>`;
  }
  function htmlDetalheEspecie(v) {
    const est = typeof ESTAGIOS_BESTIARIO !== "undefined" ? ESTAGIOS_BESTIARIO : [];
    const trancado = (revela) => {
      const i = est.findIndex((e) => e.revela === revela);
      const e = est[i];
      return e ? `<p class="trancado">${imgGlifo("ui_cadeado")}Com ${fmt(e.abates)} abates (${esc(e.nome)}): ${esc(e.texto)}. Faltam ${fmt(Math.max(0, e.abates - v.abates))}.</p>` : "";
    };
    let html = "";
    if (v.titulo) html += `<p><em>${esc(v.nome)}, ${esc(v.titulo)}</em></p>`;
    html += "<h4>Ficha</h4>";
    if (v.ficha) {
      const f = v.ficha;
      const linhas = [
        ["Vida", fmt(f.vida)],
        ["Dano", fmt(f.dano)],
        ["Defesa", f.defesa],
        ["Seu dano passa", `${f.passa}%`],
        ["Nível", f.nivel ?? "—"],
        ["XP", fmt(f.xp)],
        ["Seu golpe", fmt(f.golpeCorpo)],
        ...(f.golpeArco !== null ? [["Sua flecha", fmt(f.golpeArco)]] : []),
      ];
      html += `<dl class="ficha-best">${linhas.map(([k, x]) => `<div><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join("")}</dl>`;
      const tracos = [f.tier !== "Normal" ? f.tier : "", ...f.comportamentos.filter((c) => c !== "Persegue e ataca"), f.status ? `causa ${f.status.toLowerCase()}` : ""].filter(Boolean);
      html += `<p>${esc(tracos.length ? tracos.join(" · ") : "Persegue e ataca")}.</p>`;
    } else html += trancado("ficha");
    html += "<h4>Fraquezas</h4>";
    if (v.fraquezas) html += v.fraquezas.length ? `<ul>${v.fraquezas.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "<p>Nenhuma fraqueza conhecida: vença no golpe.</p>";
    else html += trancado("fraquezas");
    html += "<h4>Saque</h4>";
    if (v.saque) {
      const itens = v.saque.itens.map((l) => {
        const cor = corRaridade(l.raridade);
        const rar = l.raridade !== "comum" && typeof RARIDADES !== "undefined" ? ` (${RARIDADES[l.raridade].nome}${l.minima ? " ou melhor" : ""})` : "";
        return `<li>${htmlItem(l.item, 16)}<span${cor && l.raridade !== "comum" ? ` class="rar-nome" style="--rar:${cor}"` : ""}>${esc(l.nome)}</span><span>${esc(rar)}</span>${l.textoChance ? `<span class="chance">${esc(l.textoChance)}</span>` : ""}</li>`;
      }).join("");
      html += `<ul class="saque-best">${itens}</ul>`;
      if (v.saque.moedas !== null) html += `<p>${imgGlifo("ui_moeda")} Moedas: ${fmt(v.saque.moedas)} por abate.</p>`;
      else html += trancado("chances");
    } else html += trancado("fraquezas");
    html += v.contaParaAmuleto ? `<p class="nota">Conta para o amuleto: ${esc(v.nomeFamilia)}.</p>` : `<p class="nota">Raro nomeado: não conta para o amuleto de ${esc(v.nomeFamilia)}.</p>`;
    return html;
  }

  // ----- Analisador de caçada (JGB-10) -----
  // Lê Mundo.analisador(ID) (contas puras em logica.js); zerar passa por executar(). Recolher o painel é
  // minimizar a janela (tecla X, o título ou o botão de minimizar; "Janelas laterais"), e a escolha fica no
  // layout salvo. CHAVE_ANALISADOR é a escolha antiga (só lida uma vez, para quem já tinha recolhido).
  const CHAVE_ANALISADOR = "jornada_analisador_aberto";
  let htmlAnalisador = "";
  function abrirAnalisador(aberto) {
    minimizarJanela("pAnalisador", !aberto);
  }
  // Mostra o estado de minimizado no painel (data-aberto, seta e aria-expanded do título).
  function marcarAnalisador() {
    const p = painel("pAnalisador");
    if (!p) return;
    const aberto = p.dataset.min !== "true";
    if (p.dataset.aberto === String(aberto)) return;
    p.dataset.aberto = String(aberto);
    $("#btnAnalisador")?.setAttribute("aria-expanded", String(aberto));
    if (aberto) atualizarAnalisador(true);
  }
  function alternarAnalisador() {
    if (modo !== "estreito" && janelaFechada("pAnalisador")) { mostrarJanela("pAnalisador"); return; }
    const aberto = painel("pAnalisador")?.dataset.min === "true";
    abrirAnalisador(aberto);
    // No celular o painel fica na folha Batalha: a tecla abre o lugar dele.
    if (aberto && modo === "estreito" && folhaAtual !== "batalha") abrirFolha("batalha");
    if (aberto && modo !== "estreito") rolarAteJanela("pAnalisador");
  }
  // Só os números se redesenham (4 vezes por segundo, com o relógio); o botão Zerar fica fixo no HTML,
  // para o clique não se perder entre o mousedown e o mouseup.
  function atualizarAnalisador(forcar) {
    const corpo = $("#analiseDados");
    if (!corpo || typeof Mundo === "undefined" || typeof Mundo.analisador !== "function") return;
    const a = Mundo.analisador(ID);
    if (!a) return;
    const relogio = a.ativo ? (typeof textoRelogio === "function" ? textoRelogio(a.duracaoMs) : "") : "parado";
    const rel = $("#analisadorRelogio");
    if (rel && rel.textContent !== relogio) rel.textContent = relogio;
    if (painel("pAnalisador")?.dataset.aberto === "false" && !forcar) return;
    const hora = (v) => (v === null ? "—" : `${fmt(v)}/h`);
    const neg = (v) => (v < 0 ? ' class="lucro-neg"' : "");
    const tituloLucro = `Saque ${fmt(a.saque)} (moedas ${fmt(a.moedas)} + itens ${fmt(a.valorItens)}) − provisões ${fmt(a.gastos)}${a.perdas ? ` − perdas na morte ${fmt(a.perdas)}` : ""}`;
    const proximo = a.nivelMaximo ? "nível máximo" : a.proximoNivelMs !== null ? `em ${typeof textoEspera === "function" ? textoEspera(a.proximoNivelMs) : ""}` : "—";
    const linhas = [
      ["XP", fmt(a.xp), hora(a.xpHora), ""],
      ["Saque", fmt(a.saque), hora(a.saqueHora), `Moedas ${fmt(a.moedas)} + itens ${fmt(a.valorItens)} (pelo preço dos mercadores)${a.equipamentos ? `; ${a.equipamentos} equipamento${a.equipamentos > 1 ? "s" : ""} sem preço de venda` : ""}`],
      ["Lucro", `<span${neg(a.lucro)}>${fmt(a.lucro)}</span>`, a.lucroHora === null ? "—" : `<span${neg(a.lucroHora)}>${fmt(a.lucroHora)}/h</span>`, tituloLucro],
      ["Abates", fmt(a.abates), hora(a.abatesHora), ""],
      ["Mortes", fmt(a.mortes), "", a.perdas ? `${fmt(a.perdas)} moedas perdidas` : ""],
    ];
    const especies = a.especies.slice(0, 4).map((x) => `${x.nome} ${x.abates}`).join(" · ");
    const nota = !a.ativo
      ? '<p class="analise-nota">O relógio começa no seu próximo golpe.</p>'
      : !a.medindo ? '<p class="analise-nota">As taxas por hora aparecem depois de 1 minuto.</p>' : "";
    const html = `<dl class="analise"><dt class="cab"><span class="sr">Medida</span></dt><dd class="cab">Sessão</dd><dd class="cab">Por hora</dd>
      ${linhas.map(([k, v, h, t]) => `<dt${t ? ` title="${esc(t)}"` : ""}>${k}</dt><dd${t ? ` title="${esc(t)}"` : ""}>${v}</dd><dd class="hora">${h}</dd>`).join("")}
      </dl><p class="analise-proximo"><span>Próximo nível</span><b>${esc([a.proximoNivelMs !== null || a.nivelMaximo ? proximo : "", a.xpFalta && !a.nivelMaximo ? `faltam ${fmt(a.xpFalta)} XP` : ""].filter(Boolean).join(" · "))}</b></p>${nota}`;
    const txtEspecies = especies || "Nenhum abate ainda.";
    const pe = $("#analiseEspecies");
    if (pe && pe.textContent !== txtEspecies) pe.textContent = txtEspecies;
    if (html === htmlAnalisador && !forcar) return;
    htmlAnalisador = html;
    corpo.innerHTML = html;
  }

  // ----- Viagem -----
  // Lista de todas as cidades (destinosDeViagem, logica.js): preço pela distância, a cidade atual e as
  // ainda fechadas (capítulo anterior não concluído) aparecem desabilitadas, com o motivo.
  let guiaViagem = null;
  function abrirViagem(guiaId) {
    const p = jogador();
    if (!p) return;
    const guia = typeof npcs !== "undefined"
      ? (typeof guiaId === "string" && npcs[guiaId]) || Object.values(npcs).find((n) => n.papel === "guia" && n.area === p.area)
      : null;
    guiaViagem = guia?.id || null;
    const url = retratoURL(visualDe(guia?.id || "guia_canaa"), { escala: 3, recorte: "busto" });
    if (url) $("#viagemRetrato").src = url;
    $("#viagemTitulo").textContent = guia ? `Viagem com ${nomeCurto(guia.nome)}` : "Viagem rápida";
    const fala = falaRecente(guia?.id);
    if (guia && dlg.id === guia.id) fecharDialogo();
    desenharViagem(fala);
    abrirModal("modalViagem");
  }
  function desenharViagem(fala = "") {
    const p = jogador();
    if (!p || typeof destinosDeViagem !== "function") return;
    const moeda = imgGlifo("ui_moeda", "px g16");
    const linhas = destinosDeViagem(p).map((d) => {
      let cor = "#8fa34e";
      try { cor = Arte.minimapaCores(d.area).chao; } catch (e) { /* reserva */ }
      const selo = `<span class="selo-cidade" style="--cor:${cor}"></span>`;
      let rot, attrs = "", sub;
      if (d.atual) { rot = "Você está aqui"; attrs = "disabled"; sub = "cidade atual"; }
      else if (!d.aberta) { rot = `${imgGlifo("ui_cadeado")}Fechada`; attrs = `disabled title="${esc(d.motivo)}"`; sub = `Fechada: ${d.motivo}.`; }
      else if (d.falta > 0) { rot = `faltam ${d.falta}`; attrs = `disabled title="Faltam ${d.falta} moedas"`; sub = `${d.preco} moedas`; }
      else { rot = `${d.preco} ${moeda}`; sub = `${d.preco} moedas`; }
      const rotulo = d.atual ? `${d.nome}: você está aqui` : !d.aberta ? `${d.nome}: fechada, ${d.motivo}` : `Viajar para ${d.nome} por ${d.preco} moedas${d.falta ? `; faltam ${d.falta}` : ""}`;
      return `<li class="item-loja"><span class="icone">${selo}</span><span><strong>${esc(d.nome)}</strong><span>${esc(sub)}</span></span>
        <button type="button" class="btn primario" data-viajar="${esc(d.area)}" ${attrs} aria-label="${esc(rotulo)}">${rot}</button></li>`;
    }).join("");
    const barco = typeof REGRAS_BARCO !== "undefined" ? REGRAS_BARCO.passagem : 0;
    $("#viagemCorpo").innerHTML = `${fala ? `<p class="fala-modal">${esc(fala)}</p>` : ""}
      <div class="saldo">${moeda}<span>${p.moedas} moedas</span></div>
      <ul class="lista-loja">${linhas}</ul>
      <p class="nota">O preço cresce com a distância. Também dá para ir a pé pelas rotas e trilhas, de graça, ou de barco
        (${barco} moedas de passagem no cais de qualquer cidade).</p>`;
  }

  // ----- Barqueiro -----
  // Janela do cais: diz com todas as letras quanto custa a passagem, quanto o jogador tem e quanto sobra, e
  // só embarca quando ele confirma (o barqueiro cobra; pisar no cais sem falar com ele abre esta janela).
  function abrirBarco(barqueiroId) {
    const p = jogador();
    if (!p || typeof REGRAS_BARCO === "undefined") return;
    const b = typeof npcs !== "undefined" ? npcs[barqueiroId] : null;
    const url = retratoURL(visualDe(b?.id || "barqueiro_canaa"), { escala: 3, recorte: "busto" });
    if (url) $("#barcoRetrato").src = url;
    $("#barcoTitulo").textContent = b ? nomeCurto(b.nome) : "Barqueiro";
    const fala = falaRecente(b?.id);
    if (b && dlg.id === b.id) fecharDialogo();
    const preco = REGRAS_BARCO.passagem, moedas = p.moedas, falta = Math.max(0, preco - moedas);
    const mar = (typeof areas !== "undefined" && areas.mar?.nome) || "Mar das Rotas";
    const moeda = imgGlifo("ui_moeda", "px g16");
    $("#barcoCorpo").innerHTML = `
      <p class="fala-modal">${esc(fala || `${b ? nomeCurto(b.nome) : "Barqueiro"}: Meu barco leva você ao ${mar}. De lá, desembarque no cais de qualquer cidade aberta.`)}</p>
      <div class="bilhete" role="group" aria-label="Passagem de barco">
        <div class="bilhete-linha"><span>Destino</span><strong>${esc(mar)}</strong></div>
        <div class="bilhete-linha preco"><span>Passagem</span><strong>${preco} ${moeda}</strong></div>
        <div class="bilhete-linha"><span>Você tem</span><strong>${moedas} ${moeda}</strong></div>
        <div class="bilhete-linha ${falta ? "falta" : "sobra"}"><span>${falta ? "Faltam" : "Depois de pagar"}</span><strong>${falta ? falta : moedas - preco} ${moeda}</strong></div>
      </div>
      <div class="acoes-barco">
        <button type="button" class="btn secundario" data-fechar>Agora não</button>
        <button type="button" class="btn primario" data-embarcar ${falta ? "disabled" : ""} aria-label="${falta ? `Faltam ${falta} moedas para a passagem` : `Pagar ${preco} moedas e embarcar`}">${falta ? `Faltam ${falta} moedas` : `Pagar ${preco} ${moeda} e embarcar`}</button>
      </div>
      <p class="nota">A pesca no mar é de graça. Para voltar, navegue até o cais de uma cidade aberta.</p>`;
    abrirModal("modalBarco");
    $("#barcoCorpo [data-embarcar]:not([disabled])")?.focus();
  }

  // ----- Oração -----
  // F1 ora na hora (cura; do nível 25 em diante também tira veneno e sangramento); Shift + F1 é o Milagre.
  // A lógica valida fé, nível e vida e explica a recusa. Sem janela: no RPG a cura precisa ser rápida.
  function orar(acao = "oracao") {
    const p = jogador();
    if (!p) return null;
    if (!p.oracaoDesbloqueada) {
      mensagem("A Oração será aprendida na Galileia, em conversa com Jesus.", "missao");
      return null;
    }
    return executar({ tipo: "orar", acao });
  }

  // ----- Controles de toque -----
  // Aparecem sozinhos com (pointer: coarse); o botão da Ajuda alterna o que
  // está valendo: em tela de toque liga/desliga "toque-desligado", fora dela
  // liga/desliga "toque-forcado". O rótulo segue a visibilidade efetiva.
  function controlesDeToqueVisiveis() {
    const t = $("#toque");
    return !!t && getComputedStyle(t).display !== "none";
  }
  function alternarControlesDeToque() {
    const c = document.body.classList;
    if (controlesDeToqueVisiveis()) {
      c.remove("toque-forcado");
      if (controlesDeToqueVisiveis()) c.add("toque-desligado");
    } else {
      c.remove("toque-desligado");
      if (!controlesDeToqueVisiveis()) c.add("toque-forcado");
    }
  }

  // ----- Ajuda -----
  function abrirAjuda() {
    const p = jogador();
    const regra = p && typeof descreverRegraMorte === "function" ? descreverRegraMorte(p.nivel) : "";
    const k = (...t) => t.map((x) => `<kbd>${esc(x)}</kbd>`).join("");
    const linhas = [
      [k("W", "A", "S", "D") + " " + k("setas"), "Andar"],
      [k("Q", "E", "Z", "C"), "Andar na diagonal"],
      [k("F"), "Ação ao lado: falar, embarcar, desembarcar ou seguir a rota"],
      [k("Enter"), "Escrever no console: diga oi, comprar, vender, viajar, caçadas, embarcar, preço, missão ou tchau a quem está perto (ou clique nas palavras entre colchetes); Esc volta ao jogo"],
      ["Clique no chão", "Anda até lá (contorna obstáculos); num personagem ou saque, vai até ele"],
      ["Clique no minimapa", "Anda até aquele ponto, por longe que seja (a cruz de ouro marca o destino)"],
      ["Clique no inimigo", "Escolhe o alvo, vai até ele e ataca sozinho a cada 2 s"],
      [k("Espaço"), "Ataque com o que está na mão da arma: golpe (também na diagonal) ou, com arco ou funda, tiro"],
      [k("R"), "Ataque à distância (arco com flechas ou funda na mão); ao lado do alvo, golpeia"],
      [k("H"), "Usar poção de vida"],
      [k("1", "–", "6"), "Usar o atalho"],
      [k("P"), "Pescar (no mar, ao lado do ponto de pesca)"],
      [k("F1"), "Oração: cura na hora; do nível 25 de Oração em diante também tira veneno e sangramento (aprenda com Jesus, na Galileia)"],
      [`${k("Shift")} + ${k("F1")}`, "Milagre (Oração nível 100): vida cheia e todos os status removidos"],
      [k("T"), "Suas caçadas (aceitar e trocar só ao lado de um atalaia)"],
      [k("B"), "Bestiário: abates, ficha, fraquezas, saque e amuletos"],
      [k("N"), "Maná do dia (colher e comer) e reserva de descanso do Sábado"],
      [k("V"), "Vocação: escolher (nível 8), especialização (nível 50), habilidades e talentos (1 ponto por nível)"],
      [k("O"), "Ofícios: nível de cada ofício e receitas para fabricar com os materiais da mochila"],
      [`${k("+")} ${k("−")}`, "Aproximar ou afastar o mapa (também com a roda do mouse); a escolha fica salva"],
      [k("1", "–", "8"), "Habilidades da vocação (com vocação; os itens passam para Shift + 1 a 6)"],
      [k("X"), "Minimizar ou mostrar o analisador de caçada (XP/h, saque/h, lucro)"],
      [k("I"), "Mostrar ou ocultar mochila e bolsa"],
      [k("M"), "Mostrar ou ocultar o mapa"],
      [k("Alt"), "Segure para ver o nome de todos"],
      [k("?"), "Esta ajuda"],
      [k("Esc"), "Fechar janelas e conversas"],
    ];
    const comToque = controlesDeToqueVisiveis();
    const secTeclado = `
      <h3>Teclado e mouse</h3>
      <table class="teclas"><tbody>${linhas.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table>`;
    const secJanelas = mm("(min-width: 761px)") ? `
      <h3>Janelas</h3>
      <p>Arraste o cabeçalho de uma janela para a outra coluna ou outra posição. Os botões do cabeçalho minimizam (ou dois cliques no título) e fecham; o menu de três pontos move pelo teclado. O menu Janelas, no topo, reabre as janelas fechadas, escolhe o lugar da conversa e restaura o layout. A alça na borda de cima da conversa muda a altura dela.</p>` : "";
    const secItens = `${secJanelas}
      <h3>Itens</h3>
      <p>Arraste um item para o espaço de equipamento ou para uma tecla de atalho. Ou toque no item e depois no destino. Duplo clique equipa e usa poções. Para guardar, arraste o equipamento de volta para a mochila ou dê duplo clique nele (ou botão direito nele: Guardar na mochila). Botão direito numa tecla de atalho a esvazia. O equipamento é um boneco: cabeça, colar, mão da arma, armadura, mão do escudo, pernas, pés, anel e munição. A mão da arma leva a espada, o arco ou a funda; o arco usa as duas mãos (guarda o escudo). As flechas ficam empilhadas no espaço de munição. Clique na mochila do boneco para abrir o painel Mochila.</p>`;
    const secToque = `
      <h3>Toque</h3>
      <p>Toque no chão para andar até lá (o caminho contorna obstáculos). Toque num personagem para ir até ele e conversar, num saque para ir buscá-lo e num inimigo para escolher o alvo: você vai até ele e ataca sozinho. Para andar livre, encoste o polegar em qualquer ponto da metade esquerda do mundo e arraste: o joystick nasce ali e segue o dedo em qualquer ângulo; mexer o joystick cancela a caminhada. À direita: atacar, flecha, poção, oração e o botão de ação, que muda conforme o que está ao lado (falar, cais, pesca, rota). Os painéis abrem pela barra inferior. Toque num item e depois no espaço de equipamento ou na tecla de atalho; toque longo mostra a descrição.</p>`;
    // No toque, a seção de toque vem primeiro.
    const toque = comToque || mm("(pointer: coarse)");
    // Vigor: as faixas e a volta saem de REGRAS_VIGOR (dados/mundo.js).
    const textoAjudaVigor = () => {
      if (typeof REGRAS_VIGOR === "undefined" || typeof textoVigor !== "function") return "";
      const R = REGRAS_VIGOR, F = R.faixas;
      const faixas = F.map((f, i) => `${f.nome} (${i < F.length - 1 ? `a partir de ${textoVigor(f.desde)}` : `abaixo de ${textoVigor(F[i - 1].desde)}`}): ${f.texto}`).join("; ");
      return `<p>${esc(`Vigor (painel Personagem, até ${textoVigor(R.maximoMinutos)}): gasta só caçando e volta longe do jogo (1 minuto a cada ${R.regenCadaMinutos}); o descanso do Sábado o enche. ${faixas}.`)}</p>`;
    };
    $("#ajudaCorpo").innerHTML = `${toque ? secToque + secItens + secTeclado : secTeclado + secItens + secToque}
      <h3>Regras</h3>
      <p>As habilidades (corpo, arco, defesa e oração) melhoram com o uso. Fora de combate, a vida volta aos poucos. ${esc(regra)}</p>
      ${textoAjudaVigor()}
      <p>Caçadas: depois da missão principal de cada região, o atalaia oferece rondas (voltam 20 h depois da entrega) e grandes caçadas
        (voltam 6 d 20 h depois). Até 3 ao mesmo tempo; cada abate conta para todas as que pedem aquela criatura. Entregue a qualquer
        atalaia e troque os pontos de tarefa por melhorias.</p>
      <p>Saques: cada criatura tem a sua tabela, com itens comuns e drops raros (1%) e muito raros (0,1%). A cor e o brilho no chão
        mostram a raridade (comum, incomum, raro, épico, relíquia); equipamentos raros ou melhores trazem atributos aleatórios.</p>
      <p>Criaturas: cada região tem feras, pragas e inimigos com comportamentos próprios — matilhas que cercam, fuga com
        reforço, arqueiros que mantêm distância, curandeiros (marca CURA: derrube-os primeiro), investida (o chão fica
        vermelho na linha dela: saia da área marcada) e fúria — e alguns causam veneno, sangramento, atordoamento ou medo
        (sem atacar por 2,5 s). Golpe em quem está atordoado é sempre crítico; com medo, leva +25%; veneno e sangramento
        juntos infeccionam (+50% nos tiques). Os status ativos aparecem como selos na ficha. Às vezes uma
        criatura renasce campeã (nome dourado, 1 ou 2 modificadores, saque reforçado), e cada região tem um raro nomeado que
        aparece algumas vezes por dia, com anúncio no console (aba Servidor).</p>
      <p>Bestiário: cada abate conta para a espécie. Com 10, 100 e 1000 abates ela chega aos estágios Avistada (ficha),
        Estudada (fraquezas e saque) e Dominada (chances do saque). Com todas as espécies de uma família Estudadas (sem os raros
        nomeados), você ganha o amuleto dela: +5% de dano contra a família, para sempre.</p>
      <p>Vocações (V): no nível 8, escolha Guerreiro (tanque), Fundibulário (funda, de longe), Levita (cura), Profeta (controle e magia)
        ou Pastor (cão e ovelhas). Cada uma tem 7 habilidades com recarga, que abrem do nível 8 ao 25, nas teclas 1 a 8 (ou tocando
        na barra); no nível 50, a especialização dá um bônus e a 8ª habilidade. Combine: atordoar e depois bater (crítico), assustar e
        depois julgar. Trocar de vocação só com Jetro, em Canaã: a primeira troca é grátis, as outras custam moedas.</p>
      <p>Maná (N ou o botão Maná, no topo): todo dia, ao amanhecer, cai maná ao redor do arraial — 3 porções, 6 na sexta e
        nenhuma no sábado. Colha uma vez por dia e coma quando precisar (cada porção cura metade da vida e dá 30 de fé). O que sobra
        estraga no amanhecer seguinte (o da sexta dura o Sábado), e perder um dia não tira nada.</p>
      <p>Descanso do Sábado: o tempo longe do jogo de sexta às 18 h a sábado às 18 h vira uma reserva de XP (um Sábado inteiro vale
        o XP de um nível). Enquanto houver reserva, os abates rendem XP em dobro. A reserva não expira.</p>
      <p>Analisador de caçada: o relógio começa no seu primeiro golpe e mostra XP, saque (moedas e o valor de venda dos itens
        recolhidos), lucro (menos poções, flechas e perdas na morte), abates e mortes, por sessão e por hora, e quanto falta para
        o próximo nível. Zere quando quiser; recarregar a página também zera.</p>
      <p>Cidades: toda cidade tem um mercador (vende provisões e compra recursos), um guia de caravanas e um cais. O guia leva a qualquer cidade aberta, cobrando pela distância. No cais, a passagem do barco leva ao Mar das Rotas, que liga todas as cidades: navegue até o cais de uma cidade aberta para desembarcar. A pé, as rotas ligam as regiões de graça. Os capítulos (Egito, Mar Vermelho, Sinai, Galileia) abrem em ordem. No mar, pesque nos pontos com ondulação.</p>
      <div class="acoes-modal">
        <button type="button" class="btn secundario" data-alternar-toque aria-pressed="${comToque}">${comToque ? "Ocultar" : "Mostrar"} controles de toque</button>
        <button type="button" class="btn secundario" data-som aria-pressed="${!!window.Som?.ligado}">Som: ${window.Som?.ligado ? "ligado" : "desligado"}</button>
        <button type="button" class="btn secundario" data-tela-cheia>${imgGlifo("ui_tela_cheia", "px g16")}Tela cheia</button>
        <button type="button" class="btn primario" data-fechar data-foco-inicial>Entendi</button>
      </div>`;
    abrirModal("modalAjuda");
  }

  // ------------------------------------------------------------------
  // Minimapa (o MUNDO desenha no #miniMap; a UI decide onde ele fica)
  // ------------------------------------------------------------------
  // No largo é a janela Mapa (fechar e reabrir como as outras); no médio e em tela baixa ele fica sobre o
  // mundo, e a mesma escolha o mostra ou esconde. No celular, M mostra ou esconde o minimapa sobre o mundo.
  function alternarMinimapa() {
    if (modo === "estreito") document.body.classList.toggle("mapa-visivel-cel");
    else if (janelaFechada("pMapa")) mostrarJanela("pMapa");
    else fecharJanela("pMapa", false);
    marcarBotaoMapa();
  }
  function marcarBotaoMapa() {
    const visivel = modo === "estreito" ? document.body.classList.contains("mapa-visivel-cel") : !document.body.classList.contains("mapa-oculto");
    $("#btnMapa").setAttribute("aria-pressed", String(visivel));
  }

  // ------------------------------------------------------------------
  // Layout responsivo: largo (≥ 1280 px), médio e estreito (celular, ≤ 760 px)
  // ------------------------------------------------------------------
  let modo = null, folhaAtual = null;
  const FOLHAS = {
    mochila: { titulo: "Mochila e bolsa", paineis: ["pEquip", "pMochila", "pBolsa"] },
    equip: { titulo: "Personagem", paineis: ["pPersonagem", "pEquip"] },
    // O analisador vem antes: a lista de Batalha pode ser longa.
    batalha: { titulo: "Batalha e caçada", paineis: ["pAnalisador", "pBatalha"] },
    missao: { titulo: "Missão", paineis: ["pMissao"] },
    // O console (conversa e registro): no largo e no médio ele fica no dock de baixo.
    registro: { titulo: "Conversa e registro", paineis: ["pRegistro"] },
  };
  const calcModo = () => (mm("(min-width: 1280px)") ? "largo" : mm("(max-width: 760px)") ? "estreito" : "medio");
  // Largo em tela baixa (até 940 px de altura, ex.: 1600×900, 1366×768): o minimapa vai para cima do mundo,
  // como no médio, e as colunas ficam com as outras janelas inteiras.
  const TELA_BAIXA = "(max-height: 940px)";
  // Largo bem baixo (até 800 px de altura, ex.: 1366×768, 1280×720, ou 1920×1080 a 125% com a barra do
  // navegador): o layout padrão é outro (LAYOUT_PADRAO.baixo) e fica guardado à parte.
  const TELA_MUITO_BAIXA = "(max-height: 800px)";
  let chaveLayout = null, telaBaixa = false, telaMuitoBaixa = false;
  const painel = (id) => document.getElementById(id);

  function montar() {
    const novo = calcModo();
    const baixa = novo === "largo" && mm(TELA_BAIXA), muitoBaixa = baixa && mm(TELA_MUITO_BAIXA);
    const chave = `${novo}${baixa ? ":baixa" : ""}${muitoBaixa ? ":muito" : ""}`;
    if (chave === chaveLayout) return;
    chaveLayout = chave;
    modo = novo;
    telaBaixa = baixa;
    telaMuitoBaixa = muitoBaixa;
    for (const m of ["largo", "medio", "estreito"]) document.body.classList.toggle(`modo-${m}`, m === modo);
    document.body.classList.toggle("mapa-sobre-mundo", baixa);
    fecharMenuJanelas();
    fecharFolha();
    if (modo === "estreito") {
      const dep = $("#deposito");
      for (const id of [...Object.keys(JANELAS), "pRegistro"]) dep.appendChild(painel(id));
      document.body.classList.remove("sem-col-esq", "sem-col-dir", "mapa-oculto");
      $("#mapaSobre").appendChild($("#mapaMoldura"));
    }
    aplicarJanelas();
    ajustarConsole();
    marcarBotaoMapa();
    medirRodape();
  }

  // ------------------------------------------------------------------
  // Janelas laterais (largo e médio)
  // ------------------------------------------------------------------
  // Como nos MMORPGs clássicos: cada janela das colunas se move inteira (arrastando o cabeçalho, ou pelo menu
  // dela, no teclado) para a outra coluna ou outra posição, minimiza (fica só o cabeçalho) e fecha (reabre
  // pelo menu Janelas, no topo, que também restaura o layout). Uma coluna sem janelas sai e o mundo cresce.
  // O layout fica neste navegador, um por modo de tela; o conteúdo e os ids das janelas não mudam.
  const JANELAS = {
    pMissao: { nome: "Missão", glifo: "ui_pergaminho" },
    pMochila: { nome: "Mochila", glifo: "ui_mochila", tecla: "I" },
    pBolsa: { nome: "Bolsa", glifo: "ui_bolsa", tecla: "I" },
    pAnalisador: { nome: "Caçada", glifo: "ui_ampulheta", tecla: "X" },
    pMapa: { nome: "Mapa", glifo: "ui_rosa", tecla: "M" },
    pPersonagem: { nome: "Personagem", glifo: "ui_personagem" },
    pEquip: { nome: "Equipamento", glifo: "ui_escudo_bloq" },
    pBatalha: { nome: "Batalha", glifo: "ui_espadas" },
  };
  const LAYOUT_PADRAO = {
    largo: { esq: ["pMissao", "pMochila", "pBolsa", "pAnalisador"], dir: ["pMapa", "pPersonagem", "pEquip", "pBatalha"], min: [], fechadas: [] },
    // Largo bem baixo (1366×768): com o dock de baixo, cada coluna tem ~540 px. Personagem e Equipamento enchem
    // a direita, então a Batalha vai para a esquerda, sob a Missão, com a Mochila; Bolsa e Caçada começam
    // minimizadas (as poções também estão nos atalhos). Assim tudo cabe sem rolar e a Batalha mostra 2 linhas.
    baixo: { esq: ["pMissao", "pBatalha", "pMochila", "pBolsa", "pAnalisador"], dir: ["pMapa", "pPersonagem", "pEquip"], min: ["pBolsa", "pAnalisador"], fechadas: [] },
    // Médio: uma coluna só, à direita (o Mapa fica sobre o mundo); vida, fé e XP já estão no HUD, então
    // Personagem e Caçada começam minimizadas.
    medio: { esq: [], dir: ["pMissao", "pBatalha", "pEquip", "pMochila", "pBolsa", "pPersonagem", "pAnalisador", "pMapa"], min: ["pPersonagem", "pAnalisador"], fechadas: [] },
    // Celular: as janelas ficam nas folhas; só vale o recolher do analisador.
    estreito: { esq: [], dir: ["pMissao", "pMochila", "pBolsa", "pAnalisador", "pMapa", "pPersonagem", "pEquip", "pBatalha"], min: [], fechadas: [] },
  };
  const CHAVE_JANELAS = "jornada_janelas";
  const copiaLayout = (l) => ({ esq: [...l.esq], dir: [...l.dir], min: [...l.min], fechadas: [...l.fechadas] });
  // Layout salvo → layout válido: só ids conhecidos, cada janela numa coluna só (as que faltam entram no lado
  // padrão), listas de minimizadas e fechadas limpas. Um layout estragado ou de outra versão não quebra nada.
  function normalizarLayout(salvo, padrao) {
    const ids = Object.keys(JANELAS);
    const limpa = (l) => (Array.isArray(l) ? l.filter((id, i) => ids.includes(id) && l.indexOf(id) === i) : null);
    let esq = limpa(salvo?.esq), dir = limpa(salvo?.dir);
    if (!esq || !dir) { esq = [...padrao.esq]; dir = [...padrao.dir]; }
    dir = dir.filter((id) => !esq.includes(id));
    for (const id of ids) if (!esq.includes(id) && !dir.includes(id)) (padrao.esq.includes(id) ? esq : dir).push(id);
    return { esq, dir, min: limpa(salvo?.min) || [...padrao.min], fechadas: limpa(salvo?.fechadas) || [...padrao.fechadas] };
  }
  function carregarJanelas() {
    let salvo = null, analisadorRecolhido = false;
    try { salvo = JSON.parse(localStorage.getItem(CHAVE_JANELAS) || "null"); } catch (e) { salvo = null; }
    try { analisadorRecolhido = localStorage.getItem(CHAVE_ANALISADOR) === "0"; } catch (e) { /* sem armazenamento */ }
    if (!salvo || typeof salvo !== "object") salvo = null;
    const r = {};
    for (const m of Object.keys(LAYOUT_PADRAO)) {
      r[m] = normalizarLayout(salvo?.[m], LAYOUT_PADRAO[m]);
      if (!salvo && analisadorRecolhido && !r[m].min.includes("pAnalisador")) r[m].min.push("pAnalisador");
    }
    return r;
  }
  let janelas = carregarJanelas();
  const salvarJanelas = () => { try { localStorage.setItem(CHAVE_JANELAS, JSON.stringify(janelas)); } catch (e) { /* sem armazenamento */ } };
  // Qual layout guardado vale agora: o do modo de tela (o largo bem baixo tem o seu).
  const chaveJanelas = () => (modo === "largo" && telaMuitoBaixa ? "baixo" : modo);
  const layout = () => janelas[chaveJanelas()] || janelas.largo;
  const janelaFechada = (id) => modo !== "estreito" && layout().fechadas.includes(id);
  const janelaMinimizada = (id) => layout().min.includes(id);
  // O Mapa fica sobre o mundo no médio e em tela baixa (ali a janela dele não entra na coluna).
  const mapaSobreMundo = () => modo !== "largo" || telaBaixa;
  function marcarEm(lista, id, sim) {
    const i = lista.indexOf(id);
    if (sim && i < 0) lista.push(id);
    if (!sim && i >= 0) lista.splice(i, 1);
  }
  // Cabeçalho de cada janela: menu (mover pelo teclado), minimizar e fechar. O Mapa ganha um cabeçalho.
  function prepararJanelas() {
    for (const [id, j] of Object.entries(JANELAS)) {
      const sec = painel(id);
      if (!sec || sec.classList.contains("janela")) continue;
      sec.classList.add("janela");
      let cab = sec.querySelector(":scope > .painel-cab");
      if (!cab) {
        cab = document.createElement("div");
        cab.className = "painel-cab";
        cab.innerHTML = imgGlifo(j.glifo);
        const h2 = sec.querySelector(":scope > h2");
        if (h2) { h2.classList.remove("sr"); h2.textContent = j.nome.toUpperCase(); cab.appendChild(h2); }
        sec.prepend(cab);
      }
      const ctl = document.createElement("div");
      ctl.className = "janela-ctl";
      ctl.innerHTML = `<button type="button" class="janela-btn" data-janela-menu="${id}" aria-haspopup="menu" aria-expanded="false" aria-controls="menuJanela" aria-label="Mover ${esc(j.nome)}: menu da janela" title="Mover (menu)"><span class="ic-menu"></span></button>`
        + `<button type="button" class="janela-btn" data-janela-min="${id}" aria-pressed="false" aria-label="Minimizar ${esc(j.nome)}" title="Minimizar"><span class="ic-min"></span></button>`
        + `<button type="button" class="janela-btn" data-janela-fechar="${id}" aria-label="Fechar ${esc(j.nome)}" title="Fechar (reabre pelo menu Janelas)">${imgGlifo("ui_fechar")}</button>`;
      cab.appendChild(ctl);
    }
  }
  // Põe cada janela na coluna e na posição do layout, sem mexer nas que já estão no lugar (mover um
  // elemento no DOM zera a rolagem dele e da lista de dentro).
  function aplicarJanelas() {
    if (!modo) return;
    const lay = layout();
    for (const id of Object.keys(JANELAS)) {
      const el = painel(id);
      if (!el) continue;
      const min = lay.min.includes(id);
      el.dataset.min = String(min);
      const b = el.querySelector("[data-janela-min]");
      if (b) {
        b.setAttribute("aria-pressed", String(min));
        b.setAttribute("aria-label", `${min ? "Restaurar" : "Minimizar"} ${JANELAS[id].nome}`);
        b.title = min ? "Restaurar" : "Minimizar";
      }
    }
    marcarAnalisador();
    if (modo === "estreito") return;
    const dep = $("#deposito");
    for (const [lado, col] of [["esq", $("#colEsq")], ["dir", $("#colDir")]]) {
      let ref = col.firstElementChild, n = 0;
      for (const id of lay[lado]) {
        const el = painel(id);
        if (!el || lay.fechadas.includes(id) || (id === "pMapa" && mapaSobreMundo())) continue;
        if (el === ref) ref = ref.nextElementSibling;
        else col.insertBefore(el, ref);
        n++;
      }
      while (ref) { const prox = ref.nextElementSibling; dep.appendChild(ref); ref = prox; }
      document.body.classList.toggle(`sem-col-${lado}`, n === 0);
    }
    for (const id of Object.keys(JANELAS)) {
      const el = painel(id);
      if (el && !el.closest(".coluna") && el.parentElement !== dep) dep.appendChild(el);
    }
    (mapaSobreMundo() ? $("#mapaSobre") : $("#mapaCasa")).appendChild($("#mapaMoldura"));
    document.body.classList.toggle("mapa-oculto", lay.fechadas.includes("pMapa"));
    marcarBotaoMapa();
    sincronizarHideBags();
    if (menuJanelas.aberto?.id === "menuJanelas") desenharMenuJanelas();
  }
  // Depois de mover, minimizar ou fechar: grava, e o console revê a altura (o mundo pode ter mudado de largura).
  function mudouLayout() {
    aplicarJanelas();
    salvarJanelas();
    if (modo !== "estreito") ajustarConsole();
  }
  function minimizarJanela(id, sim) {
    marcarEm(layout().min, id, sim);
    mudouLayout();
  }
  function fecharJanela(id, avisar = true) {
    const tinhaFoco = painel(id)?.contains(document.activeElement);
    marcarEm(layout().fechadas, id, true);
    mudouLayout();
    if (tinhaFoco) $("#btnJanelas")?.focus();
    if (avisar) aviso(`${JANELAS[id].nome}: janela fechada. Reabra pelo menu Janelas, no topo.`, "sistema");
  }
  // Reabre (e restaura) a janela e a traz à vista.
  function mostrarJanela(id) {
    if (modo === "estreito") return;
    marcarEm(layout().fechadas, id, false);
    marcarEm(layout().min, id, false);
    mudouLayout();
    rolarAteJanela(id);
  }
  function rolarAteJanela(id) {
    const el = painel(id);
    if (el?.closest(".coluna")) el.scrollIntoView?.({ block: "nearest", behavior: reduzMovimento() ? "auto" : "smooth" });
  }
  // Mover pelo teclado (menu da janela): para a outra coluna (no fim) ou uma posição acima/abaixo entre as
  // janelas à vista na mesma coluna.
  function moverJanela(id, para) {
    const lay = layout();
    const lado = lay.esq.includes(id) ? "esq" : "dir";
    if (para === "esq" || para === "dir") {
      if (para === lado) return;
      marcarEm(lay[lado], id, false);
      lay[para].push(id);
    } else {
      const lista = lay[lado];
      const visiveis = lista.filter((x) => painel(x)?.closest(".coluna"));
      const i = visiveis.indexOf(id), vizinho = visiveis[i + (para === "subir" ? -1 : 1)];
      if (i < 0 || !vizinho) return;
      lista.splice(lista.indexOf(id), 1);
      lista.splice(lista.indexOf(vizinho) + (para === "subir" ? 0 : 1), 0, id);
    }
    mudouLayout();
    rolarAteJanela(id);
  }
  function restaurarLayout() {
    janelas = {};
    for (const [m, l] of Object.entries(LAYOUT_PADRAO)) janelas[m] = copiaLayout(l);
    delete prefConsole.altura;
    delete prefConsole.lugar;
    prefConsole.aberto = true;
    salvarConsole();
    mudouLayout();
    aviso("Layout das janelas restaurado.", "sistema");
  }
  // A tecla I (game.js alterna body.hideBags) mostra ou esconde Mochila e Bolsa juntas; o espaço da mochila
  // no boneco tira a classe para mostrar. body.hideBags acompanha "Mochila fechada".
  let hideBagsAntes = false;
  function sincronizarHideBags() {
    const sim = modo !== "estreito" && janelaFechada("pMochila");
    hideBagsAntes = sim;
    document.body.classList.toggle("hideBags", sim);
  }
  function observarMochila() {
    hideBagsAntes = document.body.classList.contains("hideBags");
    new MutationObserver(() => {
      const agora = document.body.classList.contains("hideBags");
      if (agora === hideBagsAntes) return;
      hideBagsAntes = agora;
      if (modo === "estreito") { abrirFolha("mochila"); return; }
      for (const id of ["pMochila", "pBolsa"]) {
        marcarEm(layout().fechadas, id, agora);
        if (!agora) marcarEm(layout().min, id, false);
      }
      mudouLayout();
      if (!agora) rolarAteJanela("pMochila");
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  // Sem escolha guardada, a seção Habilidades do Personagem (ligarFicha) só fica aberta no largo se a coluna
  // dela ainda comportar tudo: nada rola e a Batalha, se divide a coluna, fica com 3 linhas à vista. Medido
  // depois do 1º desenho, com o dock de baixo já no lugar (1920 × 1080: recolhida; 2560 × 1440: aberta).
  const ALTURA_MIN_BATALHA = 164;
  let habilidadesMedidas = false; // uma vez só, no 1º desenho com o personagem (atualizar)
  function habilidadesPeloEspaco() {
    if (habilidadesMedidas) return;
    habilidadesMedidas = true;
    if (modo !== "largo" || typeof prefFicha.habilidades === "boolean") return;
    const col = painel("pPersonagem")?.closest(".coluna"), bat = painel("pBatalha");
    if (!col || !$("#btnHabilidades")) return;
    abrirSecaoFicha("habilidades", true);
    const apertaBatalha = bat?.closest(".coluna") === col && bat.dataset.min !== "true" && bat.offsetHeight < ALTURA_MIN_BATALHA;
    if (col.scrollHeight > col.clientHeight + 1 || apertaBatalha) abrirSecaoFicha("habilidades", false);
  }
  // ----- Arrastar janelas -----
  // O cabeçalho é a alça (com o mouse, a caneta ou o dedo). Passou de 6 px, vira arraste: a janela fica
  // apagada, um rótulo segue o ponteiro e um traço de ouro mostra onde ela vai entrar. A metade da tela
  // escolhe a coluna (esquerda ou direita); a altura escolhe a posição. Numa coluna vazia, a borda do mundo
  // vira o alvo. Esc cancela.
  let arraste = null;
  function alvoDoArraste(x, y) {
    const m = $("#mundo").getBoundingClientRect();
    const lado = x < m.left + m.width / 2 ? "esq" : "dir";
    const col = lado === "esq" ? $("#colEsq") : $("#colDir");
    const visivel = !document.body.classList.contains(`sem-col-${lado}`);
    const outras = visivel ? Array.from(col.children).filter((el) => el.classList.contains("janela") && el.id !== arraste.id) : [];
    let antes = null;
    for (const el of outras) {
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) { antes = el; break; }
    }
    return { lado, col, visivel, outras, antes };
  }
  function desenharArraste(x, y) {
    const f = $("#fantasmaJanela"), marca = $("#marcaSoltar");
    f.style.left = `${Math.min(innerWidth - f.offsetWidth - 4, x + 14)}px`;
    f.style.top = `${Math.min(innerHeight - f.offsetHeight - 4, y + 14)}px`;
    const a = alvoDoArraste(x, y);
    arraste.alvo = a;
    marca.hidden = false;
    if (!a.visivel) {
      const m = $("#mundo").getBoundingClientRect();
      marca.className = "coluna";
      marca.dataset.rotulo = a.lado === "esq" ? "Soltar à esquerda" : "Soltar à direita";
      Object.assign(marca.style, { left: `${a.lado === "esq" ? m.left : m.right - 56}px`, top: `${m.top}px`, width: "56px", height: `${m.height}px` });
      return;
    }
    marca.className = "";
    const c = a.col.getBoundingClientRect();
    let topo;
    if (a.antes) topo = a.antes.getBoundingClientRect().top - 6;
    else if (a.outras.length) topo = a.outras[a.outras.length - 1].getBoundingClientRect().bottom + 2;
    else topo = c.top + 2;
    Object.assign(marca.style, { left: `${c.left}px`, top: `${Math.max(c.top, Math.min(c.bottom - 4, topo))}px`, width: `${c.width}px`, height: "" });
  }
  function comecarArraste() {
    arraste.ativo = true;
    fecharMenuJanelas();
    painel(arraste.id).classList.add("arrastada");
    document.body.classList.add("movendo-janela");
    const f = $("#fantasmaJanela");
    f.innerHTML = `${imgGlifo(JANELAS[arraste.id].glifo)}<span>${esc(JANELAS[arraste.id].nome)}</span>`;
    f.hidden = false;
  }
  function terminarArraste(soltar) {
    const a = arraste;
    arraste = null;
    if (!a?.ativo) return;
    painel(a.id).classList.remove("arrastada");
    document.body.classList.remove("movendo-janela");
    $("#fantasmaJanela").hidden = true;
    $("#marcaSoltar").hidden = true;
    $("#marcaSoltar").className = "";
    // O clique que vem logo depois do arraste não conta (no título da Caçada, ele minimizaria a janela).
    const engolir = (e) => { e.stopPropagation(); e.preventDefault(); };
    addEventListener("click", engolir, { capture: true, once: true });
    setTimeout(() => removeEventListener("click", engolir, { capture: true }), 0);
    if (!soltar || !a.alvo) return;
    const lay = layout();
    marcarEm(lay.esq, a.id, false);
    marcarEm(lay.dir, a.id, false);
    const lista = lay[a.alvo.lado], i = a.alvo.antes ? lista.indexOf(a.alvo.antes.id) : -1;
    if (i >= 0) lista.splice(i, 0, a.id);
    else lista.push(a.id);
    mudouLayout();
  }
  function ligarJanelas() {
    document.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || modo === "estreito") return;
      const cab = e.target.closest?.(".janela > .painel-cab");
      if (!cab || e.target.closest(".janela-ctl") || !cab.parentElement.closest(".coluna")) return;
      arraste = { id: cab.parentElement.id, x0: e.clientX, y0: e.clientY, ponteiro: e.pointerId, ativo: false };
    });
    document.addEventListener("pointermove", (e) => {
      if (!arraste || e.pointerId !== arraste.ponteiro) return;
      if (!arraste.ativo) {
        if (Math.hypot(e.clientX - arraste.x0, e.clientY - arraste.y0) < 6) return;
        comecarArraste();
      }
      e.preventDefault();
      desenharArraste(e.clientX, e.clientY);
    });
    document.addEventListener("pointerup", (e) => { if (arraste && e.pointerId === arraste.ponteiro) terminarArraste(true); });
    document.addEventListener("pointercancel", () => terminarArraste(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && arraste?.ativo) { e.preventDefault(); e.stopPropagation(); terminarArraste(false); }
    }, true);
    // Botões do cabeçalho
    document.addEventListener("click", (e) => {
      const b = e.target.closest?.("[data-janela-min],[data-janela-fechar],[data-janela-menu]");
      if (!b) return;
      if (b.dataset.janelaMin) minimizarJanela(b.dataset.janelaMin, !janelaMinimizada(b.dataset.janelaMin));
      else if (b.dataset.janelaFechar) fecharJanela(b.dataset.janelaFechar);
      else if (menuJanelas.aberto?.botao === b) fecharMenuJanelas();
      else abrirMenuJanela(b.dataset.janelaMenu, b);
    });
    // Duplo clique no cabeçalho minimiza ou restaura (como nos clientes clássicos).
    document.addEventListener("dblclick", (e) => {
      const cab = e.target.closest?.(".janela > .painel-cab");
      if (!cab || modo === "estreito" || e.target.closest(".janela-ctl, button.recolher") || !cab.parentElement.closest(".coluna")) return;
      minimizarJanela(cab.parentElement.id, !janelaMinimizada(cab.parentElement.id));
    });
    ligarMenusJanelas();
  }

  // ----- Menus: Janelas (topo) e o de cada janela -----
  // Um menu por vez; ↑ e ↓ andam entre as opções, Esc fecha e devolve o foco ao botão, clicar fora fecha.
  // Aberto, o menu fica com o teclado (como o menu do item e os modais): Espaço e Enter ativam a opção, e
  // nem as setas nem WASD andam com o personagem.
  const menuJanelas = { aberto: null };
  function abrirMenu(el, botao, html) {
    fecharMenuJanelas();
    el.innerHTML = html;
    el.hidden = false;
    menuJanelas.aberto = { id: el.id, el, botao };
    botao.setAttribute("aria-expanded", "true");
    teclado(false);
    posicionarMenu();
    el.querySelector(".menu-op:not([aria-disabled='true'])")?.focus();
  }
  function posicionarMenu() {
    const m = menuJanelas.aberto;
    if (!m) return;
    const r = m.botao.getBoundingClientRect(), w = m.el.offsetWidth, h = m.el.offsetHeight;
    const x = Math.max(8, Math.min(innerWidth - w - 8, r.right - w));
    const y = r.bottom + 4 + h > innerHeight - 8 ? Math.max(8, r.top - h - 4) : r.bottom + 4;
    m.el.style.left = `${x}px`;
    m.el.style.top = `${y}px`;
  }
  function fecharMenuJanelas(devolverFoco = false) {
    const m = menuJanelas.aberto;
    if (!m) return;
    menuJanelas.aberto = null;
    m.el.hidden = true;
    m.el.innerHTML = "";
    m.botao.setAttribute("aria-expanded", "false");
    // O teclado volta ao jogo, a menos que outro dono o segure (modal, menu do item, caixa de conversa).
    if (!modalAberto && !menuItem && document.activeElement?.id !== "entradaConversa") teclado(true);
    if (devolverFoco && document.contains(m.botao)) m.botao.focus();
  }
  const opMenu = (acao, rotulo, { desab = false, dica = "", papel = "menuitem", marcado = null, id = "" } = {}) =>
    `<button type="button" class="menu-op" role="${papel}" data-op="${acao}"${id ? ` data-id="${id}"` : ""}${marcado === null ? "" : ` aria-checked="${marcado}"`}${desab ? ' aria-disabled="true" tabindex="-1"' : ""}>`
    + `${marcado === null ? "" : '<span class="caixa" aria-hidden="true"></span>'}<span>${esc(rotulo)}</span>${!dica ? "" : dica.length === 1 ? `<kbd class="tecla-op" title="Tecla ${esc(dica)}">${esc(dica)}</kbd>` : `<span class="dica-op">${esc(dica)}</span>`}</button>`;
  function htmlMenuJanelas() {
    const lay = layout();
    let html = "<h3>Janelas</h3>";
    html += Object.keys(JANELAS).map((id) => opMenu("alternar", JANELAS[id].nome, { papel: "menuitemcheckbox", marcado: !lay.fechadas.includes(id), id, dica: JANELAS[id].tecla || "" })).join("");
    html += "<hr><h3>Conversa</h3>";
    html += opMenu("chat-dock", "Na faixa de baixo", { papel: "menuitemradio", marcado: !chatSobMundo() });
    html += opMenu("chat-mundo", "Sob o mapa, entre as colunas", { papel: "menuitemradio", marcado: chatSobMundo() });
    html += "<hr>" + opMenu("restaurar", "Restaurar layout");
    return html;
  }
  function desenharMenuJanelas() {
    const m = menuJanelas.aberto;
    if (!m || m.id !== "menuJanelas") return;
    const foco = document.activeElement?.closest?.(".menu-op");
    const chave = foco ? `${foco.dataset.op}|${foco.dataset.id || ""}` : null;
    m.el.innerHTML = htmlMenuJanelas();
    if (chave) $$(".menu-op", m.el).find((b) => `${b.dataset.op}|${b.dataset.id || ""}` === chave)?.focus();
  }
  function abrirMenuJanela(id, botao) {
    const lay = layout(), lado = lay.esq.includes(id) ? "esq" : "dir";
    const visiveis = lay[lado].filter((x) => painel(x)?.closest(".coluna"));
    const i = visiveis.indexOf(id), min = lay.min.includes(id);
    const html = `<h3>${esc(JANELAS[id].nome)}</h3>`
      + opMenu(lado === "esq" ? "dir" : "esq", lado === "esq" ? "Mover para a direita" : "Mover para a esquerda", { id })
      + opMenu("subir", "Subir", { id, desab: i <= 0 })
      + opMenu("descer", "Descer", { id, desab: i < 0 || i >= visiveis.length - 1 })
      + "<hr>" + opMenu("min", min ? "Restaurar" : "Minimizar", { id, dica: "2 cliques no título" })
      + opMenu("fechar", "Fechar", { id });
    const el = $("#menuJanela");
    el.setAttribute("aria-label", `Janela ${JANELAS[id].nome}`);
    abrirMenu(el, botao, html);
  }
  function acaoDoMenu(b) {
    if (b.getAttribute("aria-disabled") === "true") return;
    const op = b.dataset.op, id = b.dataset.id;
    if (op === "alternar") { if (janelaFechada(id)) mostrarJanela(id); else fecharJanela(id, false); return; }
    if (op === "chat-dock" || op === "chat-mundo") {
      prefConsole.lugar = op === "chat-mundo" ? "mundo" : "dock";
      salvarConsole();
      ajustarConsole();
      desenharMenuJanelas();
      return;
    }
    if (op === "restaurar") { fecharMenuJanelas(true); restaurarLayout(); return; }
    fecharMenuJanelas(op !== "fechar");
    if (op === "min") minimizarJanela(id, !janelaMinimizada(id));
    else if (op === "fechar") fecharJanela(id);
    else moverJanela(id, op);
    // Mover pelo teclado: o foco fica no botão do menu da janela, já no lugar novo.
    if (op !== "fechar") painel(id)?.querySelector("[data-janela-menu]")?.focus();
  }
  function ligarMenusJanelas() {
    $("#btnJanelas")?.addEventListener("click", (e) => {
      if (menuJanelas.aberto?.id === "menuJanelas") { fecharMenuJanelas(); return; }
      abrirMenu($("#menuJanelas"), e.currentTarget, htmlMenuJanelas());
    });
    for (const el of [$("#menuJanelas"), $("#menuJanela")]) {
      el.addEventListener("click", (e) => { const b = e.target.closest(".menu-op"); if (b) acaoDoMenu(b); });
      el.addEventListener("keydown", (e) => {
        const ops = $$(".menu-op:not([aria-disabled='true'])", el);
        const i = ops.indexOf(document.activeElement);
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fecharMenuJanelas(true); return; }
        if (e.key === "Tab") { fecharMenuJanelas(); return; }
        // Espaço ativa a opção como Enter; ← e → não fazem nada aqui (nem rolam a coluna). O stopPropagation
        // vale mesmo se uma cena nova religar o teclado do Phaser com o menu aberto (ele ouve na window).
        if (e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === " " && !e.repeat && ops.includes(document.activeElement)) acaoDoMenu(document.activeElement);
          return;
        }
        const passo = { ArrowDown: 1, ArrowUp: -1 }[e.key];
        if (passo) { e.preventDefault(); ops[(i + passo + ops.length) % ops.length]?.focus(); }
        if (e.key === "Home" || e.key === "End") { e.preventDefault(); ops[e.key === "Home" ? 0 : ops.length - 1]?.focus(); }
      });
    }
    document.addEventListener("pointerdown", (e) => {
      const m = menuJanelas.aberto;
      if (m && !m.el.contains(e.target) && !m.botao.contains(e.target)) fecharMenuJanelas();
    }, true);
    addEventListener("resize", () => fecharMenuJanelas());
    // Botões do cabeçalho das janelas e o botão Janelas, alcançados pelo teclado (Tab): Espaço os ativa como
    // Enter, em vez de chegar ao jogo (ataque). Depois de um clique, o foco fica no botão, mas aí Espaço
    // continua sendo o ataque, como antes; o Tab é que marca a navegação pelo teclado.
    let navegandoPorTab = false;
    document.addEventListener("pointerdown", () => { navegandoPorTab = false; }, true);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Tab") { navegandoPorTab = true; return; }
      if (e.key !== " " || !navegandoPorTab || e.ctrlKey || e.metaKey || e.altKey) return;
      const b = e.target.closest?.(".janela-btn, #btnJanelas");
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) b.click();
    }, true);
  }

  function abrirFolha(k) {
    if (modo !== "estreito") return;
    if (folhaAtual === k) { fecharFolha(); return; }
    const dep = $("#deposito"), cont = $("#folhaConteudo");
    for (const el of Array.from(cont.children)) dep.appendChild(el);
    for (const id of FOLHAS[k].paineis) cont.appendChild(painel(id));
    folhaAtual = k;
    $("#folhaTitulo").textContent = FOLHAS[k].titulo;
    const f = $("#folha");
    f.classList.add("aberta");
    f.setAttribute("aria-hidden", "false");
    document.body.classList.add("folha-aberta");
    for (const b of $$("#abasCel [data-folha]")) b.setAttribute("aria-expanded", String(b.dataset.folha === k));
    if (k === "registro") { limparNaoLidas(); rolarConsole(); if (dlg.id) fecharDialogo(); }
    medirRodape();
    posicionarAvisos();
  }
  function fecharFolha() {
    const f = $("#folha");
    if (!f) return;
    f.classList.remove("aberta");
    f.setAttribute("aria-hidden", "true");
    document.body.classList.remove("folha-aberta");
    posicionarAvisos();
    folhaAtual = null;
    for (const b of $$("#abasCel [data-folha]")) b.setAttribute("aria-expanded", "false");
  }
  function medirRodape() {
    const r = $("#rodape");
    if (r) document.documentElement.style.setProperty("--altura-rodape", `${r.offsetHeight}px`);
  }
  // Altura da folha inferior aberta: os avisos ficam logo acima da borda dela
  // e abaixo do HUD (que cresce com o quadro do alvo).
  function observarFolha() {
    const f = $("#folha");
    if (!f || typeof ResizeObserver !== "function") return;
    new ResizeObserver(() => {
      document.documentElement.style.setProperty("--altura-folha", `${f.offsetHeight}px`);
      posicionarAvisos();
    }).observe(f);
    const ro = new ResizeObserver(() => posicionarAvisos());
    for (const sel of ["#hud", "#missaoLinha", "#mapaSobre", "#palco"]) if ($(sel)) ro.observe($(sel));
  }

  // ------------------------------------------------------------------
  // Itens: arrastar, tocar-para-equipar, duplo clique, dica
  // ------------------------------------------------------------------
  function marcarSelecao() {
    for (const b of $$(".slot.selecionado, .equip.selecionado")) b.classList.remove("selecionado");
    let alvo = [];
    if (selecao?.origem === "item") alvo = $$(".slot[data-item]").filter((b) => b.dataset.item === selecao.id);
    else if (selecao?.origem === "equip") alvo = $$(`.equip[data-equip-slot="${selecao.slot}"]`);
    for (const b of alvo) b.classList.add("selecionado");
  }
  // aviso: dica de "tocar-para-equipar"; só aparece no toque e no teclado
  // (no mouse o caminho natural é arrastar ou dar duplo clique).
  function selecionar(nova, aviso) {
    selecao = nova;
    marcarSelecao();
    if (nova && aviso) mensagem(aviso, "sistema");
  }

  function equipar(id, slot) {
    // A lógica diz o que voltou para a mochila (o arco usa as duas mãos e guarda o escudo).
    const r = Mundo.equiparItem(ID, id, slot);
    if (r && r.mensagem) mensagem(r.mensagem, r.ok ? "sistema" : "perigo");
    window.gameScene?.atualizarVisualJogador?.();
    selecao = null;
    atualizar();
    return r;
  }
  function desequipar(slot) {
    const r = Mundo.desequiparItem(ID, slot);
    if (r && r.mensagem) mensagem(r.mensagem, "sistema");
    window.gameScene?.atualizarVisualJogador?.();
    selecao = null;
    atualizar();
  }
  function definirAtalho(i, id) {
    const r = Mundo.atribuirHotkey(ID, i, id);
    if (r && r.mensagem) mensagem(r.mensagem, r.ok ? "sistema" : "perigo");
    else if (r && r.ok && id) mensagem(`${nomeDoItem(id)} na tecla ${i + 1}.`, "sistema");
    selecao = null;
    atualizar();
  }
  function usarItem(id) {
    const d = info(id);
    if (!d) return;
    // Pela bolsa, a poção é bebida mesmo com a vida (ou a fé) cheia: serve para liberar espaço.
    if (id === "pocao") return executar({ tipo: "usarPocao", mesmoCheio: true });
    if (id === "pocao_fe") return executar({ tipo: "usarPocaoFe", mesmoCheio: true });
    const slot = slotDe(id);
    if (slot) return equipar(id, slot);
    mensagem(`${nomeDoItem(id)}: ${atributoItem(id) || "recurso"}.`, "sistema");
  }

  function ligarItens() {
    const doc = document;
    doc.addEventListener("dragstart", (e) => {
      const it = e.target.closest?.("[data-item]");
      const eq = e.target.closest?.(".equip.cheio");
      esconderDica();
      if (it) { e.dataTransfer.setData("text/item", it.dataset.item); e.dataTransfer.effectAllowed = "move"; }
      else if (eq) { e.dataTransfer.setData("text/equip", eq.dataset.equipSlot); e.dataTransfer.effectAllowed = "move"; }
    });
    const alvoSoltar = (e) => e.target.closest?.("[data-equip-slot], [data-atalho], .zona-soltar");
    doc.addEventListener("dragover", (e) => {
      const z = alvoSoltar(e);
      if (!z) return;
      e.preventDefault();
      for (const x of $$(".alvo-soltar")) if (x !== z) x.classList.remove("alvo-soltar");
      z.classList.add("alvo-soltar");
    });
    doc.addEventListener("dragleave", (e) => { const z = alvoSoltar(e); if (z && !z.contains(e.relatedTarget)) z.classList.remove("alvo-soltar"); });
    doc.addEventListener("dragend", () => { for (const x of $$(".alvo-soltar")) x.classList.remove("alvo-soltar"); });
    doc.addEventListener("drop", (e) => {
      const z = alvoSoltar(e);
      for (const x of $$(".alvo-soltar")) x.classList.remove("alvo-soltar");
      if (!z) return;
      e.preventDefault();
      const item = e.dataTransfer.getData("text/item"), slotEq = e.dataTransfer.getData("text/equip");
      if (z.dataset.equipSlot && item) equipar(item, z.dataset.equipSlot);
      else if (z.dataset.atalho !== undefined && item) definirAtalho(Number(z.dataset.atalho), item);
      else if (z.classList.contains("zona-soltar") && slotEq) desequipar(slotEq);
    });

    // Clique: tocar-para-equipar / usar atalho / escolher alvo
    doc.addEventListener("click", (e) => {
      if (suprimirClique) { suprimirClique = false; e.preventDefault(); return; }
      const t = e.target;
      const it = t.closest(".slot[data-item]");
      const eq = t.closest("[data-equip-slot]");
      const hk = t.closest("[data-atalho]");
      const zona = t.closest(".zona-soltar");
      const linha = t.closest("[data-alvo]");
      if (linha) { window.Jogo?.selecionarAlvo(linha.dataset.alvo === alvoAtual() ? null : linha.dataset.alvo); atualizar(); return; }
      // Duplo clique (2º clique da sequência, e.detail === 2): item da
      // mochila/bolsa é usado ou equipado; equipamento volta para a mochila.
      if (e.detail === 2 && it) { selecao = null; marcarSelecao(); return usarItem(it.dataset.item); }
      // (o 1º clique selecionou este mesmo espaço; um clique que acabou de
      // equipar não conta como metade de um duplo clique)
      if (e.detail === 2 && eq && selecao?.origem === "equip" && selecao.slot === eq.dataset.equipSlot) return desequipar(selecao.slot);
      const mouse = e.pointerType === "mouse";
      if (it) {
        const id = it.dataset.item;
        if (selecao && selecao.origem === "item" && selecao.id === id) return selecionar(null);
        const d = info(id);
        const dica = mouse ? null : slotDe(id) ? "Toque num espaço de equipamento para equipar." : d.tipo === "consumivel" ? "Toque numa tecla de atalho para guardar ali." : `${nomeDoItem(id)} selecionado.`;
        return selecionar({ origem: "item", id }, dica);
      }
      if (eq) {
        const slot = eq.dataset.equipSlot;
        if (selecao && selecao.origem === "item") return equipar(selecao.id, slot);
        if (selecao && selecao.origem === "equip" && selecao.slot === slot) return selecionar(null);
        if (eq.classList.contains("cheio")) return selecionar({ origem: "equip", slot }, mouse ? null : "Toque na mochila para guardar o equipamento.");
        return;
      }
      if (hk) {
        const i = Number(hk.dataset.atalho);
        if (selecao && selecao.origem === "item") return definirAtalho(i, selecao.id);
        hk.classList.remove("usado"); void hk.offsetWidth; hk.classList.add("usado");
        return window.Jogo ? Jogo.usarAtalho(i) : null;
      }
      if (zona && selecao && selecao.origem === "equip") return desequipar(selecao.slot);
      if (t.closest("[data-abrir-mochila]")) return abrirMochila();
      // Trocar de aba/folha mantém a seleção (tocar-para-equipar entre painéis).
      if (selecao && !t.closest(".modal, #dicaItem, [data-folha], [data-aba], #folhaFechar, #folhaAlca, .painel-cab")) selecionar(null);
    });
    doc.addEventListener("contextmenu", (e) => {
      const hk = e.target.closest("[data-atalho]");
      if (hk && jogador()?.hotkeys?.[Number(hk.dataset.atalho)]) { e.preventDefault(); definirAtalho(Number(hk.dataset.atalho), null); }
    });

    // Dica (ponteiro em cima, foco de teclado, toque longo)
    doc.addEventListener("mouseover", (e) => { const d = e.target.closest?.("[data-dica]"); if (d) mostrarDica(d); });
    doc.addEventListener("mouseout", (e) => { const d = e.target.closest?.("[data-dica]"); if (d && !d.contains(e.relatedTarget)) esconderDica(); });
    doc.addEventListener("focusin", (e) => { const d = e.target.closest?.("[data-dica]"); if (d && e.target.matches(":focus-visible")) mostrarDica(d); });
    doc.addEventListener("focusout", () => esconderDica());
    let toqueLongo = null;
    doc.addEventListener("pointerdown", (e) => {
      const d = e.target.closest?.("[data-dica]");
      if (!d || e.pointerType === "mouse") return;
      const x0 = e.clientX, y0 = e.clientY;
      // Item da mochila/bolsa: o toque longo abre o menu do item (descrição, usar e jogar no chão).
      // Peça vestida no boneco: o toque longo abre o menu dela (o que dá e Guardar).
      toqueLongo = { t: setTimeout(() => {
        if (d.matches(".slot[data-item]")) abrirMenuItem(d.dataset.item, d);
        else if (d.matches(".equip.cheio")) abrirMenuEquip(d.dataset.equipSlot, d);
        else mostrarDica(d);
        suprimirClique = true;
      }, 450), x0, y0 };
    });
    const cancelar = (e) => {
      if (!toqueLongo) return;
      if (e.type === "pointermove" && Math.hypot(e.clientX - toqueLongo.x0, e.clientY - toqueLongo.y0) < 8) return;
      clearTimeout(toqueLongo.t);
      toqueLongo = null;
      if (e.type === "pointerup") setTimeout(esconderDica, 1500);
    };
    doc.addEventListener("pointermove", cancelar);
    doc.addEventListener("pointerup", cancelar);
    doc.addEventListener("pointercancel", cancelar);
  }
  let suprimirClique = false;

  function mostrarDica(el) {
    if (menuItem) return; // com o menu do item aberto, a dica não cobre os botões dele
    const id = el.dataset.dica;
    const html = htmlDica(id, el.dataset.dicaOrigem);
    if (!html) return;
    const d = $("#dicaItem");
    d.innerHTML = html;
    d.classList.add("visivel");
    const r = el.getBoundingClientRect(), w = d.offsetWidth, h = d.offsetHeight;
    let x = r.right + 8, y = r.top;
    if (x + w > innerWidth - 8) x = r.left - w - 8;
    if (x < 8) x = Math.max(8, Math.min(innerWidth - w - 8, r.left));
    if (y + h > innerHeight - 8) y = innerHeight - h - 8;
    if (x === r.left || (x < r.right && x + w > r.left)) y = r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8;
    d.style.left = `${Math.round(x)}px`;
    d.style.top = `${Math.round(Math.max(8, y))}px`;
  }
  function esconderDica() { $("#dicaItem").classList.remove("visivel"); }

  // ------------------------------------------------------------------
  // Quantidades (seletor − n +) e menu do item: usar e jogar no chão
  // ------------------------------------------------------------------
  // Valor de cada seletor entre um redesenho e outro, pela chave "<ação>:<item>" (vender, comprar, largar).
  const quantidades = new Map();
  const kg = (n) => (typeof textoKg === "function" ? textoKg(n) : String(n));
  const contarNaMochila = (id, p = jogador()) => (p?.inventario || []).filter((x) => x === id).length;
  const livreParaSair = (id) => (typeof Mundo !== "undefined" && Mundo.quantidadeLivre ? Mundo.quantidadeLivre(ID, id) : contarNaMochila(id));
  function qtdEscolhida(chave, max, padrao) {
    const v = quantidades.has(chave) ? quantidades.get(chave) : padrao;
    return Math.max(1, Math.min(max, Math.floor(v) || 1));
  }
  // Seletor de quantidade; o botão com data-qtd-acao="<chave>" usa o valor e mostra o total (rotuloQtd).
  function htmlQtd(chave, valor, max, rotulo) {
    return `<span class="qtd-sel" data-qtd="${esc(chave)}"><button type="button" class="qtd-passo" data-passo="-1" aria-label="Um a menos"${valor <= 1 ? " disabled" : ""}>−</button>`
      + `<input type="number" inputmode="numeric" min="1" max="${max}" step="1" value="${valor}" aria-label="${esc(rotulo)}">`
      + `<button type="button" class="qtd-passo" data-passo="1" aria-label="Um a mais"${valor >= max ? " disabled" : ""}>+</button></span>`;
  }
  // Texto do botão de cada ação com a quantidade n (o total em moedas aparece antes de confirmar).
  function rotuloQtd(chave, n) {
    const [acao, id] = chave.split(/:(.*)/s);
    const moeda = imgGlifo("ui_moeda", "px g16");
    if (acao === "vender") {
      const total = (typeof VALORES_VENDA !== "undefined" ? VALORES_VENDA[id] || 0 : 0) * n;
      return { html: `Vender ${n} · +${total} ${moeda}`, texto: `Vender ${n} ${nomeDoItem(id)} por ${total} moedas` };
    }
    if (acao === "comprar") {
      const preco = (typeof catalogoDaLoja === "function" && lojaAtual ? catalogoDaLoja(lojaAtual).find((x) => x.item === id)?.preco : 0) || 0;
      const lote = id === "flechas" ? `${n * (typeof FLECHAS_POR_PACOTE !== "undefined" ? FLECHAS_POR_PACOTE : 5)} flechas` : `${n}`;
      return { html: `Comprar ${lote} · ${preco * n} ${moeda}`, texto: `Comprar ${id === "flechas" ? lote : `${n} ${nomeDoItem(id)}`} por ${preco * n} moedas` };
    }
    return { html: `Jogar ${n}`, texto: `Jogar ${n} ${nomeDoItem(id)} no chão` };
  }
  function htmlAcaoQtd(chave, n, classe, extra = "") {
    const r = rotuloQtd(chave, n);
    return `<button type="button" class="btn ${classe}" data-qtd-acao="${esc(chave)}" aria-label="${esc(r.texto)}"${extra}>${r.html}</button>`;
  }
  // Muda o valor de um seletor (passo ou digitação) e o texto dos botões dele, sem redesenhar a lista.
  function definirQtd(sel, valor, escrever = true) {
    const input = sel.querySelector("input");
    const max = Math.max(1, Number(input.max) || 1);
    const n = Math.max(1, Math.min(max, Math.floor(Number(valor)) || 1));
    const chave = sel.dataset.qtd;
    quantidades.set(chave, n);
    if (escrever && input.value !== String(n)) input.value = String(n);
    sel.querySelector('[data-passo="-1"]').disabled = n <= 1;
    sel.querySelector('[data-passo="1"]').disabled = n >= max;
    for (const b of $$("[data-qtd-acao]")) {
      if (b.dataset.qtdAcao !== chave) continue;
      const r = rotuloQtd(chave, n);
      b.innerHTML = r.html;
      b.setAttribute("aria-label", r.texto);
    }
    return n;
  }
  // Quantidade escolhida para a ação (lida do seletor na tela, limitada ao máximo dele).
  function quantidadeDe(chave) {
    const sel = $$(".qtd-sel").find((s) => s.dataset.qtd === chave);
    return sel ? definirQtd(sel, sel.querySelector("input").value) : quantidades.get(chave) || 1;
  }
  function ligarQuantidades() {
    document.addEventListener("click", (e) => {
      const passo = e.target.closest?.(".qtd-passo");
      if (!passo || passo.disabled) return;
      const sel = passo.closest(".qtd-sel");
      definirQtd(sel, (Number(sel.querySelector("input").value) || 1) + Number(passo.dataset.passo));
    });
    document.addEventListener("input", (e) => {
      const sel = e.target.closest?.(".qtd-sel");
      // Digitando: o texto só é corrigido quando passa do máximo (vazio ou 0 esperam o resto do número).
      if (sel && e.target.value !== "") definirQtd(sel, e.target.value, Number(e.target.value) > Number(e.target.max));
    });
    document.addEventListener("change", (e) => {
      const sel = e.target.closest?.(".qtd-sel");
      if (sel) definirQtd(sel, e.target.value);
    });
    // Enter no número: faz a ação do seletor (vender, comprar ou jogar essa quantidade).
    document.addEventListener("keydown", (e) => {
      const sel = e.key === "Enter" && e.target.closest?.(".qtd-sel");
      if (!sel) return;
      e.preventDefault();
      definirQtd(sel, e.target.value);
      $$("[data-qtd-acao]").find((b) => b.dataset.qtdAcao === sel.dataset.qtd)?.click();
    });
  }

  // Menu do item (botão direito, toque longo ou Shift+F10 num item da mochila/bolsa; ou ao soltar uma pilha no
  // mundo): descrição, usar (beber mesmo com a vida cheia, equipar) e jogar no chão 1, X ou tudo.
  let menuItem = null; // { id, ancora (elemento ou {x, y} da tela), casa (casa do mundo onde soltar) }
  function abrirMenuItem(id, ancora, casa = null) {
    if (!info(id) || !contarNaMochila(id)) return;
    esconderDica();
    if (selecao) selecionar(null);
    const reabrir = menuItem?.id === id;
    // rect: onde o menu nasceu (o espaço da mochila é recriado quando ela muda; o menu fica no lugar).
    const rect = ancora instanceof Element ? ancora.getBoundingClientRect() : { left: ancora.x, right: ancora.x, top: ancora.y, bottom: ancora.y };
    menuItem = { id, ancora, casa, rect };
    if (!reabrir) quantidades.delete(`largar:${id}`);
    desenharMenuItem(true);
    teclado(false);
  }
  // Menu de uma peça vestida (botão direito, toque longo ou Shift+F10 num espaço cheio do boneco): o que ela dá,
  // o peso e Guardar na mochila (a munição volta inteira).
  function abrirMenuEquip(slot, ancora) {
    const id = jogador()?.equipamento?.[slot];
    if (!id || !info(id)) return;
    esconderDica();
    if (selecao) selecionar(null);
    menuItem = { id, slot, ancora, rect: ancora.getBoundingClientRect() };
    desenharMenuItem(true);
    teclado(false);
  }
  function fecharMenuItem(devolverFoco = false) {
    if (!menuItem) return;
    const { ancora, id, slot } = menuItem;
    menuItem = null;
    const m = $("#menuItem");
    m.classList.remove("aberto");
    m.innerHTML = "";
    if (!modalAberto) teclado(true);
    if (!devolverFoco || !(ancora instanceof Element)) return;
    // O espaço pode ter sido recriado (a mochila mudou): volta ao do mesmo item.
    const alvo = document.contains(ancora) ? ancora
      : $$(".slot[data-item]").find((b) => b.dataset.item === id) || (slot ? $(`.equip[data-equip-slot="${slot}"]`) : null);
    alvo?.focus?.({ preventScroll: true });
  }
  function desenharMenuEquip(focar) {
    const p = jogador();
    const { slot, id } = menuItem;
    if (!p || p.equipamento?.[slot] !== id || !info(id)) return fecharMenuItem();
    const n = slot === "municao" && typeof municaoNoEspaco === "function" ? municaoNoEspaco(p) : 1;
    const peso = (typeof pesoItem === "function" ? pesoItem(id) : info(id).peso) * n;
    const efeitos = typeof efeitosDoItem === "function" ? efeitosDoItem(id) : [];
    const duas = typeof maosDoItem === "function" && maosDoItem(id) === 2 ? "usa as duas mãos" : "";
    const r = raridadeDe(id);
    const titulo = r !== "comum" ? ` class="rar" style="--rar:${corRaridade(r)}"` : "";
    const guardar = n > 1 ? `Guardar as ${n} na mochila` : "Guardar na mochila";
    const m = $("#menuItem");
    m.innerHTML = `<div class="menu-cab"><span class="slot"${attrRaridade(id)}>${htmlItem(id)}${n > 1 ? `<span class="qtd">${n}</span>` : ""}</span>`
      + `<div class="menu-nome"><h4${titulo}>${esc(nomeDoItem(id))}</h4><p>${esc(nomeEspaco(slot))}${n > 1 ? ` · ${n} unidades` : ""}</p></div>`
      + `<button type="button" class="menu-fechar" data-menu-fechar aria-label="Fechar o menu"><img class="px g16" src="${glifoURL("ui_fechar", 2)}" alt=""></button></div>`
      + `<p class="menu-info">${esc([...efeitos, duas, `${kg(peso)} kg`].filter(Boolean).join(" · "))}</p>`
      + `<div class="menu-grupo"><button type="button" class="btn primario" data-menu-guardar>${esc(guardar)}</button></div>`;
    m.setAttribute("aria-label", `Ações: ${nomeDoItem(id)} (${nomeEspaco(slot)})`);
    m.classList.add("aberto");
    posicionarMenuItem();
    if (focar) setTimeout(() => m.querySelector("[data-menu-guardar]")?.focus({ preventScroll: true }), 0);
  }
  function desenharMenuItem(focar) {
    if (menuItem?.slot) return desenharMenuEquip(focar);
    const p = jogador();
    const id = menuItem?.id;
    const d = id && info(id);
    const n = d ? contarNaMochila(id, p) : 0;
    if (!n) return fecharMenuItem();
    const livre = Math.min(n, livreParaSair(id));
    const reserva = n - livre;
    const peso = typeof pesoItem === "function" ? pesoItem(id) : d.peso;
    const tipo = NOME_TIPO[d.tipo] || "Item";
    const pesoTxt = n > 1 ? `${kg(peso)} kg cada · ${kg(peso * n)} kg ao todo` : `${kg(peso)} kg`;
    const r = raridadeDe(id);
    const titulo = r !== "comum" ? ` class="rar" style="--rar:${corRaridade(r)}"` : "";
    let usar = "";
    if (id === "pocao" || id === "pocao_fe") usar = `<button type="button" class="btn primario" data-menu-usar>Beber</button>`;
    else if (slotDe(id)) usar = `<button type="button" class="btn primario" data-menu-usar>Equipar</button>`;
    const chave = `largar:${id}`;
    let largar;
    if (!livre) largar = "";
    else if (livre === 1) largar = `<button type="button" class="btn" data-menu-largar="1">Jogar no chão</button>`;
    else {
      const x = qtdEscolhida(chave, livre, Math.max(2, Math.floor(livre / 2)));
      largar = `<button type="button" class="btn secundario" data-menu-largar="1">Jogar 1</button>`
        + `<button type="button" class="btn secundario" data-menu-largar="${livre}">Jogar ${reserva ? "as livres" : "tudo"} (${livre})</button>`
        + (livre > 2 ? `<span class="menu-x">${htmlQtd(chave, x, livre, `Quantidade a jogar no chão: ${nomeDoItem(id)}`)}${htmlAcaoQtd(chave, x, "")}</span>` : "");
    }
    const reservaTxt = reserva
      ? (() => { const res = Mundo.reservaDeMissao?.(p, id); return `<p class="menu-reserva">${reserva === n ? "Todos guardados" : `${reserva} guardados`} para a missão “${esc(res?.missao || "")}” (entrega a ${esc(res?.npc || "")}).</p>`; })()
      : "";
    const m = $("#menuItem");
    m.innerHTML = `<div class="menu-cab"><span class="slot"${attrRaridade(id)}>${htmlItem(id)}${n > 1 ? `<span class="qtd">${n}</span>` : ""}</span>`
      + `<div class="menu-nome"><h4${titulo}>${esc(nomeDoItem(id))}</h4><p>${esc(tipo)}${n > 1 ? ` · ${n} unidades` : ""}</p></div>`
      + `<button type="button" class="menu-fechar" data-menu-fechar aria-label="Fechar o menu"><img class="px g16" src="${glifoURL("ui_fechar", 2)}" alt=""></button></div>`
      + `<p class="menu-info">${esc([atributoItem(id, p), pesoTxt].filter(Boolean).join(" · "))}</p>${reservaTxt}`
      + (usar ? `<div class="menu-grupo">${usar}</div>` : "")
      + (largar ? `<div class="menu-grupo" role="group" aria-label="Jogar no chão"><span class="menu-rotulo">Jogar no chão${menuItem.casa ? " (onde você soltou)" : ""}</span>${largar}</div>` : "");
    m.setAttribute("aria-label", `Ações: ${nomeDoItem(id)}`);
    m.classList.add("aberto");
    posicionarMenuItem();
    if (focar) setTimeout(() => (m.querySelector("[data-menu-largar], [data-menu-usar]") || m.querySelector("button"))?.focus({ preventScroll: true }), 0);
  }
  function posicionarMenuItem() {
    const m = $("#menuItem"), a = menuItem.ancora;
    const r = a instanceof Element && document.contains(a) ? a.getBoundingClientRect() : menuItem.rect;
    const w = m.offsetWidth, h = m.offsetHeight;
    let x = r.right + 8, y = r.top;
    if (x + w > innerWidth - 8) x = r.left - w - 8;
    if (x < 8) x = Math.max(8, Math.min(innerWidth - w - 8, r.left));
    if (y + h > innerHeight - 8) y = innerHeight - h - 8;
    m.style.left = `${Math.round(x)}px`;
    m.style.top = `${Math.round(Math.max(8, y))}px`;
  }
  // Joga no chão: na casa onde o item foi solto no mundo (se for ao lado), senão aos pés do personagem.
  function largarItem(id, quantidade, casa) {
    const cmd = { tipo: "largarItem", item: id, quantidade };
    if (casa) Object.assign(cmd, { x: casa.x, y: casa.y });
    const r = executar(cmd);
    if (r?.ok) fecharMenuItem();
    else if (menuItem) desenharMenuItem(false);
    atualizar();
    return r;
  }
  function ligarMenuItem() {
    const m = $("#menuItem");
    m.addEventListener("click", (e) => {
      if (!menuItem) return;
      const id = menuItem.id;
      if (e.target.closest("[data-menu-fechar]")) return fecharMenuItem(true);
      if (e.target.closest("[data-menu-guardar]")) {
        const slot = menuItem.slot;
        fecharMenuItem();
        desequipar(slot);
        $$(".slot[data-item]").find((b) => b.dataset.item === id)?.focus?.({ preventScroll: true });
        return;
      }
      if (e.target.closest("[data-menu-usar]")) {
        usarItem(id);
        // Beber deixa o menu aberto (para beber mais de uma); equipar o fecha.
        if (slotDe(id) || !contarNaMochila(id)) fecharMenuItem();
        else desenharMenuItem(false);
        return;
      }
      const b = e.target.closest("[data-menu-largar], [data-qtd-acao]");
      if (!b || b.disabled) return;
      const q = b.dataset.qtdAcao ? quantidadeDe(b.dataset.qtdAcao) : Number(b.dataset.menuLargar) || 1;
      largarItem(id, q, menuItem.casa);
    });
    m.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fecharMenuItem(true); }
    });
    // Tab para fora do menu também o fecha.
    m.addEventListener("focusout", (e) => { if (menuItem && e.relatedTarget && !m.contains(e.relatedTarget)) fecharMenuItem(); });
    // Fecha ao clicar fora (no próprio item, o botão direito reabre), ao rolar a coluna do item (o menu ficaria
    // solto) ou ao mudar a janela. A rolagem do console (mensagem nova) não fecha.
    document.addEventListener("pointerdown", (e) => {
      if (menuItem && !e.target.closest?.("#menuItem")) fecharMenuItem();
    }, true);
    document.addEventListener("scroll", (e) => {
      const a = menuItem?.ancora;
      if (a instanceof Element && e.target instanceof Node && e.target !== a && e.target.contains(a)) fecharMenuItem();
    }, true);
    addEventListener("resize", () => fecharMenuItem());
    document.addEventListener("contextmenu", (e) => {
      const it = e.target.closest?.(".slot[data-item]");
      const eq = !it && e.target.closest?.(".equip.cheio[data-equip-slot]");
      if (!it && !eq) return;
      e.preventDefault();
      // Teclado (Shift+F10, tecla de menu): ancora no espaço; mouse: também.
      if (eq) abrirMenuEquip(eq.dataset.equipSlot, eq);
      else abrirMenuItem(it.dataset.item, it);
    });
  }

  // Arrastar um item da mochila ou da bolsa para o mundo joga no chão (na casa solta, se for ao lado; senão
  // aos pés do personagem). Pilha: abre o menu para escolher 1, X ou tudo. Equipamento vestido: guardar antes.
  function ligarChao() {
    const palco = $("#palco");
    const arrastandoItem = (e) => Array.from(e.dataTransfer?.types || []).some((t) => t === "text/item" || t === "text/equip");
    // O mundo: o mapa e o que flutua sobre ele, menos painéis, janelas e alvos de soltar (equipamento, atalho, mochila).
    const noMundo = (e) => !!e.target.closest?.("#game-root")
      || !e.target.closest?.(".painel, .perg, .console, #folha, [data-equip-slot], [data-atalho], .zona-soltar");
    palco.addEventListener("dragover", (e) => {
      if (!arrastandoItem(e) || !noMundo(e)) return palco.classList.remove("alvo-chao");
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      palco.classList.add("alvo-chao");
    });
    palco.addEventListener("dragleave", (e) => { if (!palco.contains(e.relatedTarget)) palco.classList.remove("alvo-chao"); });
    document.addEventListener("dragend", () => palco.classList.remove("alvo-chao"));
    palco.addEventListener("drop", (e) => {
      palco.classList.remove("alvo-chao");
      if (!arrastandoItem(e) || !noMundo(e)) return;
      e.preventDefault();
      const item = e.dataTransfer.getData("text/item"), slotEq = e.dataTransfer.getData("text/equip");
      if (slotEq) {
        const vestido = jogador()?.equipamento?.[slotEq];
        mensagem(`${vestido ? nomeDoItem(vestido) : "O equipamento"} está no corpo: arraste-o para a mochila antes de jogar no chão.`, "perigo");
        return;
      }
      if (!item || !contarNaMochila(item)) return;
      const casa = window.Jogo?.casaNaTela?.(e.clientX, e.clientY) || null;
      if (livreParaSair(item) > 1) abrirMenuItem(item, { x: e.clientX, y: e.clientY }, casa);
      else largarItem(item, 1, casa);
    });
  }

  // ------------------------------------------------------------------
  // Controles de toque (direcional + ações)
  // ------------------------------------------------------------------
  function ligarToque() {
    // Joystick flutuante e analógico: encostar o dedo em qualquer ponto da metade esquerda do mundo e
    // arrastar faz o joystick nascer ali, com o pino seguindo o dedo em 360°. O vetor (de −1 a 1 em cada
    // eixo) vai para Jogo.entrada; o MUNDO (game.js, passoAnalogico) transforma o ângulo em passos da
    // grade. Um toque sem arrastar não é joystick: o MUNDO anda até a casa tocada (ou fala, pega o saque
    // ou ataca o que foi tocado). Solto, o joystick volta ao canto, apagado, só como lembrete.
    const dpad = $("#dpad");
    const pino = dpad.querySelector(".joy-pino");
    const raiz = $("#game-root"), palco = $("#palco");
    const ZONA_MORTA = 0.22, ARRASTO = 12;
    let toque = null; // { id, x, y }: dedo na metade esquerda, ainda sem saber se é toque ou arrasto
    let ativo = false;
    const zerar = () => {
      if (window.Jogo) { Jogo.entrada = { dx: 0, dy: 0 }; Jogo.joystickAtivo = false; }
      dpad.classList.remove("ativo");
      dpad.style.left = dpad.style.top = dpad.style.bottom = "";
      pino.style.transform = "";
      ativo = false;
      toque = null;
    };
    const ativar = () => {
      const r = palco.getBoundingClientRect();
      const meio = dpad.offsetWidth / 2;
      // O centro do joystick fica onde o dedo encostou (sem sair do palco).
      dpad.style.left = `${Math.max(0, Math.min(r.width - 2 * meio, toque.x - r.left - meio))}px`;
      dpad.style.top = `${Math.max(0, Math.min(r.height - 2 * meio, toque.y - r.top - meio))}px`;
      dpad.style.bottom = "auto";
      dpad.classList.add("ativo");
      ativo = true;
      if (window.Jogo) Jogo.joystickAtivo = true;
    };
    const ler = (e) => {
      const r = dpad.getBoundingClientRect();
      const raio = Math.max(20, r.width / 2 - pino.offsetWidth / 2);
      let vx = e.clientX - (r.left + r.width / 2);
      let vy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(vx, vy);
      if (dist > raio) {
        vx = (vx / dist) * raio;
        vy = (vy / dist) * raio;
      }
      pino.style.transform = "translate(" + vx + "px, " + vy + "px)";
      const forca = Math.min(1, dist / raio);
      if (window.Jogo) Jogo.entrada = forca < ZONA_MORTA ? { dx: 0, dy: 0 } : { dx: vx / raio, dy: vy / raio, analogico: true };
    };
    raiz.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" || toque || !controlesDeToqueVisiveis()) return;
      const r = palco.getBoundingClientRect();
      if (e.clientX > r.left + r.width / 2) return; // metade direita: tocar alvos e botões
      toque = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }, true);
    addEventListener("pointermove", (e) => {
      if (!toque || e.pointerId !== toque.id) return;
      if (!ativo) {
        if (Math.hypot(e.clientX - toque.x, e.clientY - toque.y) < ARRASTO) return;
        ativar();
      }
      ler(e);
    }, { passive: true });
    for (const ev of ["pointerup", "pointercancel"]) {
      addEventListener(ev, (e) => {
        if (!toque || e.pointerId !== toque.id) return;
        // O "pointerup" do MUNDO (andar até a casa) vem logo depois: o arrasto ainda vale até lá.
        setTimeout(zerar, 0);
      });
    }
    dpad.addEventListener("contextmenu", (e) => e.preventDefault());

    for (const b of $$("#acoes [data-acao]")) {
      b.addEventListener("click", () => {
        const acao = b.dataset.acao === "interagir" && b.dataset.tipo === "pesca" ? "pescar" : b.dataset.acao;
        if (acao === "orar") return orar();
        window.Jogo?.acao(acao);
      });
    }
  }

  const GLIFO_INTERACAO = { npc: "ui_falar", cais: "ui_ancora", pesca: "ui_peixe", portal: "ui_dpad_seta" };
  let interacaoAnterior = "";
  function atualizarToque(p) {
    const b = $("#tInteragir");
    const r = window.Jogo?.podeInteragir?.() || null;
    const chave = r ? `${r.tipo}|${r.rotulo}` : "";
    if (chave !== interacaoAnterior) {
      interacaoAnterior = chave;
      b.hidden = !r;
      if (r) {
        b.dataset.tipo = r.tipo;
        const img = b.querySelector("img");
        const url = glifoURL(r.rotulo === "Caçadas" ? "ui_cacada" : GLIFO_INTERACAO[r.tipo] || "ui_falar", 2);
        if (url) img.src = url;
        img.style.transform = r.tipo === "portal" ? "rotate(90deg)" : "";
        b.querySelector(".rot").textContent = r.rotulo;
        b.setAttribute("aria-label", r.rotulo);
      }
    }
    $("#tOrar").hidden = !p.oracaoDesbloqueada;
  }

  // ------------------------------------------------------------------
  // Atualização geral
  // ------------------------------------------------------------------
  function atualizar() {
    const p = jogador();
    if (!p) return;
    $("#moedasValor").textContent = String(p.moedas);
    atualizarPontos(p);
    atualizarBarras(p);
    atualizarPersonagem(p);
    atualizarMissao(p);
    atualizarCacadas(p);
    atualizarItens(p);
    atualizarBatalha(p);
    atualizarAnalisador();
    atualizarBotaoMana(p);
    atualizarBarraHab(p);
    atualizarBotaoVocacao(p);
    $("#mapaCoord").textContent = `${p.x}, ${p.y}`;
    if (modalAberto?.id === "modalLoja") desenharLoja();
    if (modalAberto?.id === "modalMural") desenharMural();
    if (modalAberto?.id === "modalBestiario") desenharBestiario();
    if (modalAberto?.id === "modalMana") desenharMana();
    if (modalAberto?.id === "modalVocacao") desenharVocacao();
    if (modalAberto?.id === "modalOficios") desenharOficios();
    if (modalAberto?.id === "modalVisual") desenharVisual();
    habilidadesPeloEspaco();
  }

  function areaMudou(area) {
    const nome = (typeof areas !== "undefined" && areas[area]?.nome) || area;
    $("#areaNome").textContent = nome;
    $("#areaTopo").textContent = nome;
    $("#areaSub").textContent = (temArte() && Arte.SUBTITULOS && Arte.SUBTITULOS[area]) || "";
    try { document.documentElement.style.setProperty("--bioma", Arte.minimapaCores(area).chao); } catch (e) { /* reserva */ }
    document.body.dataset.area = area;
    fecharDialogo();
    // Loja e viagem dependem de estar ao lado do NPC; oração e ajuda não.
    if (modalAberto && (modalAberto.id === "modalLoja" || modalAberto.id === "modalViagem")) fecharModal(false);
    // O mural de um atalaia também; a consulta (T) pode continuar aberta.
    if (modalAberto?.id === "modalMural" && muralNpc !== null) fecharModal(false);
    // A cena nova (área, morte, viagem) liga o teclado e a captura de Espaço e setas de novo; com um
    // modal ainda aberto, desliga outra vez (sem isto, Espaço não ativa o botão focado do modal).
    if (modalAberto) teclado(false);
    alvoDesenhado = undefined;
    assinaturaBatalha = "";
    atualizar();
  }

  // Laço leve a 4 Hz: fé regenerando, veneno, botão de ação, distância do diálogo.
  function tique() {
    const p = jogador();
    if (!p) return;
    atualizarBarras(p);
    atualizarFicha(p); // o vigor corre caçando e volta parado
    atualizarToque(p);
    atualizarBatalha(p);
    atualizarAnalisador(); // relógio e taxas por hora correm sem precisar de abate
    atualizarBotaoMana(p); // o maná cai no amanhecer e estraga sozinho, sem nenhuma ação
    atualizarBarraHab(p); // recargas das habilidades
    if (modalAberto?.id === "modalMana") desenharMana();
    if (alvoDesenhado && typeof inimigos !== "undefined" && inimigos[alvoDesenhado]) atualizarVidaAlvo(inimigos[alvoDesenhado]);
    if (dlg.id && dlg.npc && Math.max(Math.abs(p.x - dlg.npc.x), Math.abs(p.y - dlg.npc.y)) > 2) fecharDialogo();
    // A espera ("Volta em 19 h 59 min") muda a cada minuto: o mural só se redesenha quando o texto muda.
    if (modalAberto?.id === "modalMural") desenharMural();
  }

  // ------------------------------------------------------------------
  // Botões, teclado da UI e eventos gerais
  // ------------------------------------------------------------------
  async function telaCheia() {
    try {
      if (!document.fullscreenElement) await $("#app").requestFullscreen();
      else await document.exitFullscreen();
    } catch (e) { mensagem("O navegador não permitiu ativar a tela cheia.", "sistema"); }
  }

  function ligarBotoes() {
    $("#btnMapa").addEventListener("click", alternarMinimapa);
    $("#btnTelaCheia").addEventListener("click", telaCheia);
    $("#btnAjuda").addEventListener("click", abrirAjuda);
    $("#btnMenu").addEventListener("click", abrirAjuda);
    $("#dialogo").addEventListener("click", (e) => {
      if (e.target.closest("[data-palavra]")) return; // a palavra-chave responde (ligarConsole)
      if (dlg.mostrado < dlg.texto.length) completarDialogo();
      else fecharDialogo();
    });
    $("#pontos").addEventListener("click", () => abrirMural(null));
    $("#btnBestiario").addEventListener("click", abrirBestiario);
    $("#btnOficios")?.addEventListener("click", () => abrirOficios());
    $("#btnVisual")?.addEventListener("click", abrirVisual);
    $("#btnMana").addEventListener("click", abrirMana);
    $("#btnVocacao").addEventListener("click", () => abrirVocacao(null));
    $("#barraHab").addEventListener("click", (e) => {
      const b = e.target.closest("[data-hab]");
      if (!b || b.classList.contains("bloqueada")) return;
      const i = Number(b.dataset.hab);
      if (window.Jogo?.usarHabilidade) window.Jogo.usarHabilidade(i);
      else {
        const h = barraHabilidades(jogador(), Date.now())[i];
        if (h) executar({ tipo: "usarHabilidade", habilidade: h.id });
      }
      atualizarBarraHab(jogador());
    });
    $("#btnAnalisador").addEventListener("click", () => abrirAnalisador(painel("pAnalisador").dataset.min === "true"));
    $("#missaoLinha").addEventListener("click", () => {
      const b = $("#missaoLinha");
      b.setAttribute("aria-expanded", String(b.getAttribute("aria-expanded") !== "true"));
    });
    // Folhas do celular
    document.addEventListener("click", (e) => {
      const folha = e.target.closest("[data-folha]");
      if (folha) abrirFolha(folha.dataset.folha);
      if (e.target.closest("[data-abrir-cacadas]")) abrirMural(null);
      if (e.target.closest("[data-zerar-analisador]")) {
        executar({ tipo: "zerarAnalisador" });
        atualizarAnalisador(true);
      }
    });
    $("#folhaFechar").addEventListener("click", fecharFolha);
    // arrastar a alça para baixo fecha a folha
    const alca = $("#folhaAlca");
    let y0 = null;
    alca.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      y0 = e.clientY;
      try { alca.setPointerCapture(e.pointerId); } catch (erro) { /* ignora */ }
    });
    alca.addEventListener("pointermove", (e) => { if (y0 !== null && e.clientY - y0 > 50) { y0 = null; fecharFolha(); } });
    alca.addEventListener("pointerup", () => { y0 = null; });

    // Modais: fechar, véu, ações internas
    for (const m of $$(".modal")) {
      m.addEventListener("click", (e) => {
        if (e.target === m || e.target.closest("[data-fechar]")) { fecharModal(); return; }
        // Loja: 1 unidade, a do seletor (data-qtd-acao) ou a do botão (data-quantidade, "Vender tudo").
        const qtdLoja = (b) => (b.dataset.qtdAcao ? quantidadeDe(b.dataset.qtdAcao) : Number(b.dataset.quantidade) || 1);
        const comprar = e.target.closest("[data-comprar]");
        if (comprar && !comprar.disabled) { executar({ tipo: "comprar", item: comprar.dataset.comprar, quantidade: qtdLoja(comprar) }); desenharLoja(); return; }
        const vender = e.target.closest("[data-vender]");
        if (vender && !vender.disabled) { executar({ tipo: "vender", item: vender.dataset.vender, quantidade: qtdLoja(vender) }); desenharLoja(); return; }
        const abaL = e.target.closest("[data-aba-loja]");
        if (abaL) { abaLoja = abaL.dataset.abaLoja; desenharLoja(true); $(`#lojaCorpo [data-aba-loja=${abaLoja}]`)?.focus(); return; }
        // Mural: aba, aceitar/retomar, guardar (sem confirmação: nada se perde) e trocar pontos.
        const abaM = e.target.closest("[data-aba-mural]");
        if (abaM) {
          abaMural = abaM.dataset.abaMural;
          retornoMural = null;
          confirmaTroca = null;
          desenharMural(true);
          $(`#muralCorpo [data-aba-mural=${abaMural}]`)?.focus();
          return;
        }
        const noMural = e.target.closest("[data-aceitar-tarefa], [data-guardar-tarefa], [data-trocar], [data-confirmar-troca], [data-cancelar-troca]");
        if (noMural) {
          if (!noMural.disabled) acaoMural(e, noMural);
          return;
        }
        const voc = e.target.closest("[data-vocacao], [data-especializacao]");
        if (voc) {
          if (!voc.disabled) acaoVocacao(voc);
          return;
        }
        const vis = e.target.closest("[data-aba-visual], [data-cosmetico-usar], [data-cosmetico-tirar], [data-cosmetico-comprar], [data-cor-parte], [data-cores-padrao]");
        if (vis) {
          if (!vis.disabled) acaoVisual(vis);
          return;
        }
        const ofi = e.target.closest("[data-fabricar], [data-aba-oficio]");
        if (ofi) {
          if (!ofi.disabled) acaoOficio(ofi);
          return;
        }
        const tal = e.target.closest("[data-talento], [data-reset-talentos], [data-aba-vocacao]");
        if (tal) {
          if (!tal.disabled) acaoTalento(tal);
          return;
        }
        const mana = e.target.closest("[data-acao-mana]");
        if (mana) {
          if (!mana.disabled) acaoMana(mana);
          return;
        }
        // Bestiário: abre e fecha a ficha da espécie (uma por vez).
        const verEspecie = e.target.closest("[data-ver-especie]");
        if (verEspecie) {
          const k = verEspecie.dataset.verEspecie;
          especieAberta = especieAberta === k ? null : k;
          desenharBestiario(true);
          $(`#bestiarioCorpo [data-ver-especie="${k}"]`)?.focus({ preventScroll: true });
          return;
        }
        const embarcar = e.target.closest("[data-embarcar]");
        if (embarcar && !embarcar.disabled) {
          fecharModal(false);
          executar({ tipo: "embarcar" });
          return;
        }
        const viajar = e.target.closest("[data-viajar]");
        if (viajar && !viajar.disabled) {
          fecharModal(false);
          executar({ tipo: "viajar", areaDestino: viajar.dataset.viajar });
          return;
        }
        if (e.target.closest("[data-alternar-toque]")) {
          alternarControlesDeToque();
          abrirAjuda();
          return;
        }
        if (e.target.closest("[data-som]")) {
          window.Som?.definir(!window.Som.ligado);
          if (window.Som?.ligado) window.Som.saque("incomum");
          abrirAjuda();
          return;
        }
        if (e.target.closest("[data-tela-cheia]")) telaCheia();
      });
    }

    document.addEventListener("keydown", (e) => {
      prenderFoco(e);
      if (e.key === "Escape") {
        if (modalAberto) { e.preventDefault(); fecharModal(); return; }
        if (menuJanelas.aberto) { e.preventDefault(); fecharMenuJanelas(true); return; }
        if (menuItem) { e.preventDefault(); fecharMenuItem(true); return; }
        if ($("#dicaItem").classList.contains("visivel")) { esconderDica(); return; }
        if (selecao) { selecionar(null); return; }
        if (dlg.id) { fecharDialogo(); return; }
        if (document.activeElement?.id === "entradaConversa") { document.activeElement.blur(); return; }
        if (folhaAtual) { fecharFolha(); return; }
        return;
      }
      if (e.key === "F1") { e.preventDefault(); if (!e.repeat) orar(e.shiftKey ? "milagre" : "oracao"); return; }
      const teclaT = (e.key === "t" || e.key === "T") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (teclaT && modalAberto?.id === "modalMural") { e.preventDefault(); fecharModal(); return; }
      const teclaB = (e.key === "b" || e.key === "B") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (teclaB && modalAberto?.id === "modalBestiario") { e.preventDefault(); fecharModal(); return; }
      const teclaO = (e.key === "o" || e.key === "O") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (teclaO && modalAberto?.id === "modalOficios") { e.preventDefault(); fecharModal(); return; }
      const teclaU = (e.key === "u" || e.key === "U") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (teclaU && modalAberto?.id === "modalVisual") { e.preventDefault(); fecharModal(); return; }
      const teclaV = (e.key === "v" || e.key === "V") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (teclaV && modalAberto?.id === "modalVocacao") { e.preventDefault(); fecharModal(); return; }
      const teclaN = (e.key === "n" || e.key === "N") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (teclaN && modalAberto?.id === "modalMana") { e.preventDefault(); fecharModal(); return; }
      if (modalAberto) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      // Enter: escrever no console (como nos MMORPGs clássicos); num botão focado, Enter continua sendo o clique.
      if (e.key === "Enter" && !e.repeat && (tag === "BODY" || e.target.closest?.("#game-root"))) { e.preventDefault(); focarConsole(); return; }
      if ((e.key === "m" || e.key === "M") && !e.repeat) { e.preventDefault(); alternarMinimapa(); return; }
      if (e.key === "?") { e.preventDefault(); abrirAjuda(); return; }
      // Zoom do mapa: + aproxima, − afasta (a roda do mouse faz o mesmo).
      if ((e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") && !e.repeat) {
        e.preventDefault();
        window.gameScene?.ajustarZoom?.(e.key === "-" || e.key === "_" ? -1 : 1);
        return;
      }
      if (teclaT) { e.preventDefault(); abrirMural(null); return; }
      if (teclaB) { e.preventDefault(); abrirBestiario(); return; }
      if (teclaO) { e.preventDefault(); abrirOficios(); return; }
      if (teclaU) { e.preventDefault(); abrirVisual(); return; }
      if (teclaN) { e.preventDefault(); abrirMana(); return; }
      if (teclaV) { e.preventDefault(); abrirVocacao(null); return; }
      // Com vocação: 1 a 8 usam as habilidades e Shift + 1 a 6 os atalhos de itens. Sem vocação, 1 a 6 são os itens.
      const digito = /^Digit([1-8])$/.exec(e.code || "") || (/^[1-8]$/.test(e.key) ? [null, e.key] : null);
      if (digito && !e.repeat && temVocacao(jogador()) && !e.shiftKey) {
        e.preventDefault();
        const i = Number(digito[1]) - 1;
        const b = $(`#barraHab [data-hab="${i}"]`);
        if (b) { b.classList.remove("pronta-agora"); void b.offsetWidth; b.classList.add("pronta-agora"); }
        window.Jogo?.usarHabilidade(i);
        atualizarBarraHab(jogador());
        return;
      }
      if (digito && !e.repeat && Number(digito[1]) <= 6 && (e.shiftKey || !temVocacao(jogador()))) {
        e.preventDefault();
        const i = Number(digito[1]) - 1;
        const hk = $(`#atalhos [data-atalho="${i}"]`);
        if (hk) { hk.classList.remove("usado"); void hk.offsetWidth; hk.classList.add("usado"); }
        window.Jogo?.usarAtalho(i);
        return;
      }
      if ((e.key === "x" || e.key === "X") && !e.repeat) { e.preventDefault(); alternarAnalisador(); return; }
    });
    // O Phaser também escuta "mousedown"/"touchstart" na janela e faria o clique
    // num botão da UI (modal, diálogo, HUD) atravessar até o NPC desenhado embaixo.
    // Só o próprio canvas repassa o toque/clique para o mundo.
    for (const tipo of ["mousedown", "touchstart", "pointerdown"]) {
      document.addEventListener(tipo, (e) => {
        if (!(e.target instanceof Element) || !e.target.closest("#game-root")) e.stopPropagation();
      }, { passive: true });
    }
    // Ao clicar no mundo, tira o foco de botões da UI (as teclas voltam ao jogo).
    $("#game-root").addEventListener("pointerdown", () => {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
      esconderDica();
    });
  }

  // ------------------------------------------------------------------
  // Início
  // ------------------------------------------------------------------
  function iniciar() {
    aplicarTexturas();
    prepararJanelas();
    preencherGlifos();
    montar();
    ligarBotoes();
    ligarItens();
    ligarQuantidades();
    ligarMenuItem();
    ligarChao();
    ligarConsole();
    ligarToque();
    ligarFicha();
    observarMochila();
    observarFolha();
    ligarJanelas();
    const re = () => { montar(); medirRodape(); };
    for (const q of ["(min-width: 1280px)", "(max-width: 760px)", TELA_BAIXA, TELA_MUITO_BAIXA]) {
      const mq = matchMedia(q);
      (mq.addEventListener ? mq.addEventListener("change", re) : mq.addListener(re));
    }
    // O console acompanha o tamanho da janela (a altura dele não deixa o zoom do mundo cair).
    addEventListener("resize", () => { if (modo !== "estreito") ajustarConsole(); medirRodape(); });
    setInterval(tique, 250);
    requestAnimationFrame(laçoRecarga);
    atualizar();
    if (!temArte()) console.warn("[interface] sprites.js ausente: ícones substituídos por letras.");
  }

  window.UI = {
    atualizar,
    mensagem,
    dialogo,
    avancarDialogo,
    abrirLoja,
    abrirViagem,
    abrirBarco,
    orar,
    abrirMural,
    abrirBestiario,
    abrirOficios,
    abrirVocacao,
    abrirAjuda,
    alternarMinimapa,
    atualizarMinimapa() { /* o MUNDO desenha o minimapa no #miniMap (game.js) */ },
    areaMudou,
    registro: () => registro.slice(),
  };
  // Compatibilidade com o código antigo
  window.atualizarInterface = () => UI.atualizar();
  window.mostrarMensagem = (t) => UI.mensagem(t);
  window.abrirLoja = (id) => UI.abrirLoja(id);
  window.abrirViagem = (id) => UI.abrirViagem(id);
  window.orar = (acao) => UI.orar(acao);
  window.abrirMural = (id) => UI.abrirMural(id ?? null);
  window.abrirBestiario = () => UI.abrirBestiario();
  window.alternarMinimapa = () => UI.alternarMinimapa();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
