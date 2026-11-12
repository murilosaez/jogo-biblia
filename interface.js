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
//            abrirLoja, abrirViagem, abrirOracao, abrirMural, alternarMinimapa)
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
  const inicioSessao = Date.now();

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
    consumivel: "Consumível", recurso: "Recurso", arma: "Arma corpo a corpo", arma_distancia: "Arco",
    escudo: "Escudo", armadura: "Armadura", municao: "Munição",
  };
  const ROTULO_SLOT = { arma: "Arma", arco: "Arco", escudo: "Escudo", armadura: "Armadura" };
  const SILHUETA_SLOT = { arma: "espada_ferro", arco: "arco_madeira", escudo: "escudo_madeira", armadura: "armadura_couro" };
  const slotDoTipo = (tipo) => {
    const mapa = typeof SLOTS_EQUIPAMENTO !== "undefined" ? SLOTS_EQUIPAMENTO : { arma: "arma", arco: "arma_distancia", escudo: "escudo", armadura: "armadura" };
    return Object.keys(mapa).find((s) => mapa[s] === tipo) || null;
  };

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
    if (id === "pocao") return `cura ${p && typeof curaPocao === "function" ? curaPocao(p) : 30} de vida`;
    if (id === "pocao_fe") return `+${typeof CURA_POCAO_FE !== "undefined" ? CURA_POCAO_FE : 40} de fé`;
    if (d.tipo === "municao") return "munição para o arco";
    if (typeof VALORES_VENDA !== "undefined" && VALORES_VENDA[id]) return `os mercadores pagam ${VALORES_VENDA[id]}`;
    return NOME_TIPO[d.tipo] || "";
  }

  function atributoCurto(id) {
    const d = info(id);
    if (!d) return "";
    if (d.bonus) return `+${d.bonus} dano`;
    if (d.defesa) return `+${d.defesa} def`;
    return "";
  }

  function htmlDica(id, origem) {
    const d = info(id);
    if (!d) return "";
    const partes = [NOME_TIPO[d.tipo] || "Item", atributoItem(id), `${typeof pesoItem === "function" ? pesoItem(id) : d.peso} kg`].filter(Boolean);
    const r = raridadeDe(id);
    const nomeR = typeof RARIDADES !== "undefined" ? RARIDADES[r]?.nome : "";
    const linhaRaridade = r !== "comum" && nomeR ? `<p class="raridade" style="--rar:${corRaridade(r)}">${esc(nomeR)}</p>` : "";
    const atributos = typeof textoAtributos === "function" ? textoAtributos(id) : [];
    const linhaAtributos = atributos.length ? `<ul class="atr-item">${atributos.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
    let acao = "";
    if (origem === "equip") acao = "Arraste para a mochila, ou dê duplo clique, para guardar.";
    else if (slotDoTipo(d.tipo)) acao = "Duplo clique equipa. Também pode arrastar ou tocar e escolher o espaço.";
    else if (d.tipo === "consumivel") acao = "Duplo clique usa. Arraste para uma tecla de atalho.";
    else if (typeof VALORES_VENDA !== "undefined" && VALORES_VENDA[id]) acao = "Venda a qualquer mercador (há um em cada cidade).";
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

  function atualizarBarras(p) {
    const max = typeof vidaMaxima === "function" ? vidaMaxima(p) : 100;
    const baixa = p.vida / max < 0.25;
    const feMax = typeof FE_MAXIMA !== "undefined" ? FE_MAXIMA : 100;
    const xp = xpDoNivel(p);
    const travada = !p.oracaoDesbloqueada;
    const vidaTxt = `${p.vida}/${max}`;
    const feTxt = travada ? "aprenda na Galileia" : `${p.fe || 0}/${feMax}`;
    const xpTxt = `${xp.atual}/${xp.total} XP`;
    definirBarra($("#barraVida"), p.vida, max, vidaTxt, { baixa });
    definirBarra($("#barraFe"), travada ? 0 : p.fe || 0, feMax, feTxt, { travada });
    // Reserva de descanso do Sábado: a barra ganha contorno azul e o título explica o XP em dobro.
    const descanso = Math.floor(p.descanso?.xp || 0);
    const tituloXp = descanso ? `Reserva de descanso: ${descanso} XP (abates com XP em dobro)` : "";
    for (const id of ["#barraXp", "#hudXp"]) if ($(id) && $(id).title !== tituloXp) $(id).title = tituloXp;
    definirBarra($("#barraXp"), xp.atual, xp.total, xpTxt, { descanso });
    definirBarra($("#hudVida"), p.vida, max, vidaTxt, { baixa });
    definirBarra($("#hudFe"), travada ? 0 : p.fe || 0, feMax, feTxt, { travada });
    definirBarra($("#hudXp"), xp.atual, xp.total, xpTxt, { descanso });
    $("#hudVidaTxt").textContent = vidaTxt;
    $("#hudFeTxt").textContent = travada ? "—" : `${p.fe || 0}`;
    $("#hudXpTxt").textContent = `Nv ${p.nivel}`;
    const env = (p.envenenadoAte || 0) > Date.now();
    document.body.classList.toggle("envenenado", env);
  }

  // ------------------------------------------------------------------
  // Personagem
  // ------------------------------------------------------------------
  let assinaturaRetrato = "";
  function atualizarPersonagem(p) {
    $("#seloNivel").textContent = p.nivel;
    $("#fichaNivel").textContent = `Nível ${p.nivel}`;
    const eq = p.equipamento || {};
    const ass = JSON.stringify(eq);
    if (ass !== assinaturaRetrato && temArte()) {
      assinaturaRetrato = ass;
      let chave = "pj_jogador";
      try { chave = Arte.garantirJogador ? Arte.garantirJogador(eq) : chave; } catch (e) { chave = "pj_jogador"; }
      const url = retratoURL(chave, { escala: 3, recorte: "busto" }) || retratoURL("pj_jogador", { escala: 3 });
      if (url) $("#retratoJogador").src = url;
    }
    if (typeof estatisticasCombate !== "function") return;
    const s = estatisticasCombate(p);
    const h = s.habilidades || {};
    const nh = (k, rot) => {
      const x = h[k];
      return x ? `<span title="${esc(x.nome)}: ${x.maximo ? "máximo" : `${x.xp}/${x.necessario} XP para o próximo nível`}">${rot} ${x.nivel}</span>` : "";
    };
    const hab = [nh("corpo", "Corpo"), nh("distancia", "Arco"), nh("defesa", "Defesa"), nh("oracao", "Oração")].filter(Boolean).join(" · ");
    const el = $("#habilidades");
    if (el.innerHTML !== hab) el.innerHTML = hab;
    const peso = typeof pesoCarregado === "function" ? pesoCarregado(p) : 0;
    const cap = typeof capacidadeCarga === "function" ? capacidadeCarga(p) : 0;
    const linhas = [
      ["Dano corpo", s.danoCorpo],
      ["Dano arco", s.temArco ? s.danoDistancia : "—"],
      ["Defesa", `${s.defesa} (−${s.reducaoDano}%)`],
      ["Crítico", `${s.critico}%`],
      ["Flechas", s.flechas],
      ["Carga", `${peso}/${cap}`],
      ["Pontos de tarefa", p.pontosTarefa || 0, "largo"], // nas duas colunas: numa só, quebrava em 2 linhas
    ];
    const html = linhas.map(([k, v, cls]) => `<div${cls ? ` class="${cls}"` : ""}><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    const dl = $("#atributos");
    if (dl.innerHTML !== html) dl.innerHTML = html;
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
  const ehMochila = (tipo) => ["arma", "arma_distancia", "escudo", "armadura", "municao"].includes(tipo);

  function contar(lista) {
    const g = new Map();
    for (const id of lista || []) g.set(id, (g.get(id) || 0) + 1);
    return g;
  }

  function htmlSlotItem(id, qtd) {
    const nome = nomeDoItem(id);
    const sel = selecao && selecao.origem === "item" && selecao.id === id ? " selecionado" : "";
    return `<button type="button" class="slot cheio${sel}" role="listitem" draggable="true" data-item="${esc(id)}" data-dica="${esc(id)}"${attrRaridade(id)} aria-label="${esc(nome)}${qtd > 1 ? `, ${qtd} unidades` : ""}">${htmlItem(id)}${qtd > 1 ? `<span class="qtd">${qtd}</span>` : ""}</button>`;
  }

  function atualizarItens(p, forcar) {
    // A seleção não entra na assinatura: marcá-la só troca a classe
    // .selecionado (marcarSelecao), sem recriar os botões. Recriá-los entre
    // os dois cliques impedia o navegador de reconhecer o duplo clique.
    // A capacidade entra: um alforje da troca muda o "x / 170 kg" sem mexer na mochila.
    const cap = typeof capacidadeCarga === "function" ? capacidadeCarga(p) : 0;
    const ass = JSON.stringify([p.inventario, p.equipamento, p.hotkeys, cap]);
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
    $("#pesoTexto").textContent = `${Number(peso).toFixed(1)} / ${cap} kg`;

    // Equipamento
    const eq = p.equipamento || {};
    $("#gradeEquip").innerHTML = Object.keys(ROTULO_SLOT).map((slot) => {
      const id = eq[slot];
      const sel = selecao && selecao.origem === "equip" && selecao.slot === slot ? " selecionado" : "";
      if (id && info(id)) {
        return `<button type="button" class="equip cheio${sel}" draggable="true" data-equip-slot="${slot}" data-dica="${esc(id)}" data-dica-origem="equip" aria-label="${ROTULO_SLOT[slot]}: ${esc(nomeDoItem(id))}">
          <span class="slot"${attrRaridade(id)}>${htmlItem(id)}</span><span class="equip-txt"><small>${ROTULO_SLOT[slot]}</small><em>${esc(atributoCurto(id))}</em></span></button>`;
      }
      const sil = silhuetaURL(SILHUETA_SLOT[slot]);
      return `<button type="button" class="equip vazio${sel}" data-equip-slot="${slot}" aria-label="Espaço de ${ROTULO_SLOT[slot].toLowerCase()} vazio">
        <span class="slot">${sil ? `<img class="px silhueta" src="${sil}" width="32" height="32" alt="">` : ""}</span><span class="equip-txt"><small>${ROTULO_SLOT[slot]}</small><em>vazio</em></span></button>`;
    }).join("");

    // Atalhos
    const hk = p.hotkeys || [];
    let html = "";
    for (let i = 0; i < 6; i++) {
      const id = hk[i];
      const qtd = id ? g.get(id) || 0 : 0;
      const nome = id ? nomeDoItem(id) : "";
      html += `<button type="button" class="atalho${id && !qtd ? " esgotado" : ""}" data-atalho="${i}" ${id ? `data-dica="${esc(id)}"` : ""}
        aria-label="Atalho ${i + 1}: ${id ? `${esc(nome)}, ${qtd} restantes` : "vazio"}" title="${id ? `${esc(nome)} · tecla ${i + 1} · botão direito limpa` : `Solte um consumível · tecla ${i + 1}`}">
        <span class="tecla-n">${i + 1}</span>${id ? htmlItem(id) : ""}${id ? `<span class="qtd">${qtd}</span>` : ""}</button>`;
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

  const registro = [];
  function registrar(texto, tipo) {
    const s = Math.floor((Date.now() - inicioSessao) / 1000);
    const hora = `${String(Math.floor(s / 60) % 100).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    registro.unshift({ texto, tipo, hora });
    if (registro.length > 30) registro.length = 30;
    const li = document.createElement("li");
    if (tipo === "anuncio") li.className = "anuncio";
    li.innerHTML = `<span class="marca-tipo" style="--cor:${(TIPOS[tipo] || TIPOS.sistema).cor}">${imgGlifo(glifoDoTipo(tipo, texto), "px g16", (TIPOS[tipo] || TIPOS.sistema).nome)}</span><time>${hora}</time><span>${esc(texto)}</span>`;
    const ol = $("#listaRegistro");
    ol.prepend(li);
    while (ol.children.length > 30) ol.lastElementChild.remove();
    $("#registroQtd").textContent = String(registro.length);
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
  function posicionarAvisos() {
    const caixa = $("#avisos"), palco = $("#palco");
    if (!caixa || !palco) return;
    if (!document.body.classList.contains("folha-aberta")) { caixa.classList.remove("sem-espaco"); return; }
    const base = palco.getBoundingClientRect().top;
    let topo = 0;
    for (const sel of ["#hud", "#missaoLinha", "#mapaSobre"]) {
      const el = $(sel);
      if (el && el.offsetParent) topo = Math.max(topo, el.getBoundingClientRect().bottom - base);
    }
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
    registrar(texto, tipo);
    if (tipo === "fala") {
      // O MUNDO chama UI.dialogo logo depois de uma fala; se não chamar, vira aviso.
      falaPendente = texto;
      setTimeout(() => { if (falaPendente === texto) { falaPendente = null; aviso(texto, "fala"); } }, 0);
      return;
    }
    aviso(texto, tipo);
  }

  // ------------------------------------------------------------------
  // Diálogo com retrato (máquina de escrever a 40 caracteres/s)
  // ------------------------------------------------------------------
  const PAPEIS = {
    viajante1: "pastor", guia_canaa: "guia de caravanas", guia_deserto: "guia de caravanas", mercador1: "mercador",
    noemi1: "do acampamento", moisesEgito: "líder do povo", aaronEgito: "irmão de Moisés", araoMar: "irmão de Moisés",
    josueSinai: "comandante", pedroGalileia: "pescador", jesusGalileia: "Médico dos médicos",
  };
  const dlg = { id: null, texto: "", mostrado: 0, timer: null, fechar: null, npc: null };

  function textoSemPrefixo(nome, texto) {
    const m = String(texto).match(/^([^:]{1,40}):\s+/);
    if (!m) return texto;
    const curto = nomeCurto(nome);
    if (nome.startsWith(m[1]) || m[1].startsWith(curto)) return texto.slice(m[0].length);
    return texto;
  }

  function dialogo({ id, nome, papel, texto }) {
    if (falaPendente === texto) falaPendente = null;
    const caixa = $("#dialogo");
    const corpo = textoSemPrefixo(nome || "", texto || "");
    // Mesmo NPC e mesma fala: completa e, depois, fecha (clique ou F).
    if (caixa.classList.contains("aberto") && dlg.id === id && dlg.texto === corpo) {
      if (dlg.mostrado < corpo.length) completarDialogo();
      else fecharDialogo();
      return;
    }
    dlg.id = id;
    dlg.texto = corpo;
    dlg.npc = typeof npcs !== "undefined" ? npcs[id] : null;
    $("#dlgNome").textContent = nomeCurto(nome || dlg.npc?.nome || "");
    const reserva = papel === "loja" ? "mercador" : papel === "guia" ? "guia de caravanas" : papel === "mural" ? "vigia · mural de caçadas"
      : papel === "ambiente" ? String(nome || dlg.npc?.nome || "").split(",").slice(1).join(",").trim() : "";
    $("#dlgPapel").textContent = PAPEIS[id] || reserva;
    const url = retratoURL(visualDe(id), { escala: 3, recorte: "busto" });
    const img = $("#dlgRetrato");
    if (url) img.src = url; else img.removeAttribute("src");
    img.alt = `Retrato de ${nomeCurto(nome || "")}`;
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
    dlg.fechar = setTimeout(fecharDialogo, 9000 + corpo.length * 45);
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
  function abrirLoja(mercId) {
    const p = jogador();
    const merc = typeof npcs !== "undefined"
      ? (typeof mercId === "string" && npcs[mercId]) || (p && Mundo.mercadorProximo?.(p)) || Object.values(npcs).find((n) => n.papel === "loja" && n.area === p?.area)
      : null;
    lojaAtual = merc?.id || null;
    $("#lojaTitulo").textContent = nomeCurto(merc?.nome || "Mercador");
    const url = retratoURL(visualDe(merc?.id || "mercador1"), { escala: 3, recorte: "busto" });
    if (url) $("#lojaRetrato").src = url;
    falaLoja = dlg.id === merc?.id ? dlg.texto : "";
    if (dlg.id === merc?.id) fecharDialogo();
    desenharLoja();
    abrirModal("modalLoja");
  }
  function desenharLoja() {
    const p = jogador();
    if (!p) return;
    const corpo = $("#lojaCorpo");
    const g = contar(p.inventario);
    const moeda = imgGlifo("ui_moeda", "px g16");
    let lista = "";
    if (abaLoja === "comprar") {
      const catalogo = typeof catalogoDaLoja === "function" && lojaAtual ? catalogoDaLoja(lojaAtual) : [];
      for (const { item: id, preco } of catalogo) {
        const falta = preco - p.moedas;
        lista += `<li class="item-loja"><span class="icone">${htmlItem(id)}</span><span><strong>${esc(nomeDoItem(id))}</strong><span>${esc(atributoItem(id, p))}</span></span>
          <button type="button" class="btn primario" data-comprar="${esc(id)}" ${falta > 0 ? `disabled title="Faltam ${falta} moedas"` : ""} aria-label="Comprar ${esc(nomeDoItem(id))} por ${preco} moedas${falta > 0 ? `; faltam ${falta}` : ""}">${falta > 0 ? `faltam ${falta}` : `${preco} ${moeda}`}</button></li>`;
      }
    } else {
      for (const [id, valor] of Object.entries(typeof VALORES_VENDA !== "undefined" ? VALORES_VENDA : {})) {
        const n = g.get(id) || 0;
        if (!n) continue;
        lista += `<li class="item-loja"><span class="icone">${htmlItem(id)}</span><span><strong>${esc(nomeDoItem(id))}</strong><span>Você tem ${n}</span></span>
          <button type="button" class="btn primario" data-vender="${esc(id)}" aria-label="Vender um ${esc(nomeDoItem(id))} por ${valor} moedas">+${valor} ${moeda}</button></li>`;
      }
      if (!lista) lista = '<li class="vazio-txt" style="color:var(--tinta-suave)">Você não tem nada que o mercador compre. Ele aceita recursos: peles, presas, ferrões, linho, ervas, odres, peixe e as pedras preciosas.</li>';
    }
    corpo.innerHTML = `${falaLoja ? `<p class="fala-modal">${esc(falaLoja)}</p>` : ""}
      <div class="saldo">${moeda}<span>${p.moedas} moedas</span></div>
      <div class="abas-modal" role="tablist">
        <button type="button" class="aba-modal" role="tab" data-aba-loja="comprar" aria-selected="${abaLoja === "comprar"}">Comprar</button>
        <button type="button" class="aba-modal" role="tab" data-aba-loja="vender" aria-selected="${abaLoja === "vender"}">Vender</button>
      </div>
      <ul class="lista-loja" role="tabpanel">${lista}</ul>
      <p class="nota" style="color:var(--tinta-suave)">Flechas são vendidas em lotes de ${typeof FLECHAS_POR_PACOTE !== "undefined" ? FLECHAS_POR_PACOTE : 5}. Fique ao lado do mercador para negociar.</p>`;
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
    falaMural = muralNpc && dlg.id === muralNpc ? dlg.texto : "";
    if (falaMural) fecharDialogo();
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
        de sexta às 18 h a sábado às 18 h vira reserva de XP (um Sábado inteiro vale o XP de um nível; ela não expira).</p>`;
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
        return `<li>${htmlItem(l.item, 16)}<span${cor && l.raridade !== "comum" ? ` style="color:${cor};text-shadow:1px 1px 0 #2a1a14"` : ""}>${esc(l.nome)}</span><span>${esc(rar)}</span>${l.textoChance ? `<span class="chance">${esc(l.textoChance)}</span>` : ""}</li>`;
      }).join("");
      html += `<ul class="saque-best">${itens}</ul>`;
      if (v.saque.moedas !== null) html += `<p>${imgGlifo("ui_moeda")} Moedas: ${fmt(v.saque.moedas)} por abate.</p>`;
      else html += trancado("chances");
    } else html += trancado("fraquezas");
    html += v.contaParaAmuleto ? `<p class="nota">Conta para o amuleto: ${esc(v.nomeFamilia)}.</p>` : `<p class="nota">Raro nomeado: não conta para o amuleto de ${esc(v.nomeFamilia)}.</p>`;
    return html;
  }

  // ----- Analisador de caçada (JGB-10) -----
  // Lê Mundo.analisador(ID) (contas puras em logica.js); zerar passa por executar(). Painel recolhível
  // (tecla X); a escolha fica no navegador.
  const CHAVE_ANALISADOR = "jornada_analisador_aberto";
  let htmlAnalisador = "";
  function analisadorAberto() {
    try { return localStorage.getItem(CHAVE_ANALISADOR) !== "0"; } catch (e) { return true; }
  }
  function abrirAnalisador(aberto) {
    const p = painel("pAnalisador");
    if (!p) return;
    p.dataset.aberto = String(aberto);
    $("#btnAnalisador").setAttribute("aria-expanded", String(aberto));
    try { localStorage.setItem(CHAVE_ANALISADOR, aberto ? "1" : "0"); } catch (e) { /* sem armazenamento */ }
    if (aberto) atualizarAnalisador(true);
  }
  function alternarAnalisador() {
    const aberto = painel("pAnalisador")?.dataset.aberto !== "true";
    abrirAnalisador(aberto);
    // No celular e no médio o painel fica dentro de Batalha: a tecla abre o lugar dele.
    if (aberto && modo === "estreito" && folhaAtual !== "batalha") abrirFolha("batalha");
    if (aberto && modo === "medio" && abaMedia !== "batalha") mostrarAbaMedia("batalha");
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
    const fala = guia && dlg.id === guia.id ? dlg.texto : "";
    if (fala) fecharDialogo();
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

  // ----- Oração -----
  const ORACOES = [
    { acao: "vida", glifo: "ui_coracao", texto: "Restaura parte da sua vida." },
    { acao: "veneno", glifo: "ui_gota", texto: "Remove o veneno do corpo." },
    { acao: "area", glifo: "ui_losango", texto: "Cura você e a área 3×3 ao redor." },
    { acao: "milagre", glifo: "ui_estrela_chefe", texto: "Vida cheia e veneno removido." },
  ];
  function abrirOracao() {
    const p = jogador();
    if (!p) return;
    if (!p.oracaoDesbloqueada) {
      mensagem("A Oração será aprendida na Galileia, em conversa com Jesus.", "missao");
      return;
    }
    desenharOracao();
    abrirModal("modalOracao");
  }
  // Estado que muda o que a janela mostra (fé, nível, vida e veneno). O
  // tique() redesenha a janela aberta quando ele muda, para os cartões
  // liberarem sozinhos enquanto a fé regenera.
  let assinaturaOracao = "";
  function estadoOracao(p) {
    const nivelOr = typeof estatisticasCombate === "function" ? estatisticasCombate(p).habilidades.oracao?.nivel || 0 : 0;
    return { nivelOr, ass: JSON.stringify([p.fe, nivelOr, p.vida, p.envenenadoAte > Date.now()]) };
  }
  // Os cartões são montados uma vez por nível de oração (o nível muda quais
  // ficam travados); depois o tique() só atualiza no lugar a fé, os custos,
  // o title e o aria-disabled. Recriar os botões a cada mudança de fé fazia o
  // clique cair entre o botão antigo (mousedown) e o novo (mouseup) e sumir.
  let nivelOracaoMontado = -1;
  const dadosOracao = () => ({
    nomes: typeof NOMES_ORACAO !== "undefined" ? NOMES_ORACAO : {},
    custos: typeof CUSTO_ORACAO !== "undefined" ? CUSTO_ORACAO : {},
    niveis: typeof NIVEL_ORACAO !== "undefined" ? NIVEL_ORACAO : {},
    feMax: typeof FE_MAXIMA !== "undefined" ? FE_MAXIMA : 100,
  });
  function desenharOracao() {
    const p = jogador();
    if (!p) return;
    const { nivelOr, ass } = estadoOracao(p);
    assinaturaOracao = ass;
    if (nivelOr !== nivelOracaoMontado || !$("#oracaoCorpo [data-orar]")) montarOracao(nivelOr);
    atualizarOracao(p, nivelOr);
  }
  function montarOracao(nivelOr) {
    nivelOracaoMontado = nivelOr;
    const focado = document.activeElement?.closest?.("#oracaoCorpo [data-orar]")?.dataset.orar;
    const { nomes, niveis } = dadosOracao();
    const cartoes = ORACOES.map((o) => {
      const req = niveis[o.acao] ?? 0;
      const estado = nivelOr < req
        ? `<span class="trava">${imgGlifo("ui_cadeado", "px g16")}nível ${req}</span>`
        : `<span class="custo">${imgGlifo("ui_candeia", "px g16")}<span class="custo-txt"></span></span>`;
      return `<button type="button" class="cartao" data-orar="${o.acao}">
        ${imgGlifo(o.glifo, "px g24")}<strong>${esc(nomes[o.acao] || o.acao)}</strong><span>${esc(o.texto)}</span>${estado}</button>`;
    }).join("");
    $("#oracaoCorpo").innerHTML = `<div class="linha-barra" style="margin:0 0 10px">${imgGlifo("ui_candeia", "px g16", "Fé")}<div class="barra fe" id="oracaoFe"><i></i><b></b></div></div>
      <div class="cartoes">${cartoes}</div>
      <p class="nota" style="color:var(--tinta-suave)">O jogo é solo: a cura em área cura você e mostra o efeito 3×3. As poções de vida e de fé continuam disponíveis.</p>`;
    if (focado) $(`#oracaoCorpo [data-orar="${focado}"]`)?.focus();
  }
  function atualizarOracao(p, nivelOr) {
    const { nomes, custos, niveis, feMax } = dadosOracao();
    const fe = p.fe || 0;
    $("#oracaoSub").textContent = `Oração nível ${nivelOr} · fé ${fe}/${feMax}`;
    $("#oracaoFe > i").style.width = `${(100 * fe) / feMax}%`;
    $("#oracaoFe > b").textContent = `${fe}/${feMax}`;
    for (const b of $$("#oracaoCorpo [data-orar]")) {
      const acao = b.dataset.orar, custo = custos[acao] ?? 0, req = niveis[acao] ?? 0;
      const travado = nivelOr < req, falta = custo - fe;
      const motivo = travado ? `Oração nível ${req}` : falta > 0 ? `faltam ${falta} de fé` : "";
      b.setAttribute("aria-disabled", String(travado || falta > 0));
      if (motivo) b.title = motivo; else b.removeAttribute("title");
      b.setAttribute("aria-label", `${nomes[acao] || acao}, custa ${custo} de fé${motivo ? `; ${motivo}` : ""}`);
      const txt = b.querySelector(".custo-txt");
      if (txt) txt.textContent = `${custo} de fé${falta > 0 ? ` · faltam ${falta}` : ""}`;
    }
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
      ["Clique no chão", "Anda até lá (contorna obstáculos); num personagem ou saque, vai até ele"],
      ["Clique no inimigo", "Escolhe o alvo, vai até ele e ataca sozinho a cada 2 s"],
      [k("Espaço"), "Golpe corpo a corpo no alvo (também na diagonal)"],
      [k("R"), "Flecha no alvo, se houver arco equipado e flechas"],
      [k("H"), "Usar poção de vida"],
      [k("1", "–", "6"), "Usar o atalho"],
      [k("P"), "Pescar (no mar, ao lado do ponto de pesca)"],
      [k("F1"), "Oração (depois de aprender com Jesus, na Galileia)"],
      [k("T"), "Suas caçadas (aceitar e trocar só ao lado de um atalaia)"],
      [k("B"), "Bestiário: abates, ficha, fraquezas, saque e amuletos"],
      [k("N"), "Maná do dia (colher e comer) e reserva de descanso do Sábado"],
      [k("X"), "Mostrar ou ocultar o analisador de caçada (XP/h, saque/h, lucro)"],
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
    const secItens = `
      <h3>Itens</h3>
      <p>Arraste um item para o espaço de equipamento ou para uma tecla de atalho. Ou toque no item e depois no destino. Duplo clique equipa armas e usa poções. Para guardar, arraste o equipamento de volta para a mochila ou dê duplo clique nele. Botão direito numa tecla de atalho a esvazia. Espada e arco ocupam as mãos: equipar um guarda o outro.</p>`;
    const secToque = `
      <h3>Toque</h3>
      <p>Toque no chão para andar até lá (o caminho contorna obstáculos). Toque num personagem para ir até ele e conversar, num saque para ir buscá-lo e num inimigo para escolher o alvo: você vai até ele e ataca sozinho. Para andar livre, encoste o polegar em qualquer ponto da metade esquerda do mundo e arraste: o joystick nasce ali e segue o dedo em qualquer ângulo; mexer o joystick cancela a caminhada. À direita: atacar, flecha, poção, oração e o botão de ação, que muda conforme o que está ao lado (falar, cais, pesca, rota). Os painéis abrem pela barra inferior. Toque num item e depois no espaço de equipamento ou na tecla de atalho; toque longo mostra a descrição.</p>`;
    // No toque, a seção de toque vem primeiro.
    const toque = comToque || mm("(pointer: coarse)");
    $("#ajudaCorpo").innerHTML = `${toque ? secToque + secItens + secTeclado : secTeclado + secItens + secToque}
      <h3>Regras</h3>
      <p>As habilidades (corpo, arco, defesa e oração) melhoram com o uso. Fora de combate, a vida volta aos poucos. ${esc(regra)}</p>
      <p>Caçadas: depois da missão principal de cada região, o atalaia oferece rondas (voltam 20 h depois da entrega) e grandes caçadas
        (voltam 6 d 20 h depois). Até 3 ao mesmo tempo; cada abate conta para todas as que pedem aquela criatura. Entregue a qualquer
        atalaia e troque os pontos de tarefa por melhorias.</p>
      <p>Saques: cada criatura tem a sua tabela, com itens comuns e drops raros (1%) e muito raros (0,1%). A cor e o brilho no chão
        mostram a raridade (comum, incomum, raro, épico, relíquia); equipamentos raros ou melhores trazem atributos aleatórios.</p>
      <p>Criaturas: cada região tem feras, pragas e inimigos com comportamentos próprios — matilhas que cercam, fuga com
        reforço, arqueiros que mantêm distância, curandeiros (marca CURA: derrube-os primeiro), investida (o chão fica
        vermelho na linha dela: saia da área marcada) e fúria — e alguns causam veneno, sangramento ou atordoamento. Às vezes uma
        criatura renasce campeã (nome dourado, 1 ou 2 modificadores, saque reforçado), e cada região tem um raro nomeado que
        aparece algumas vezes por dia, com anúncio no Registro.</p>
      <p>Bestiário: cada abate conta para a espécie. Com 10, 100 e 1000 abates ela chega aos estágios Avistada (ficha),
        Estudada (fraquezas e saque) e Dominada (chances do saque). Com todas as espécies de uma família Estudadas (sem os raros
        nomeados), você ganha o amuleto dela: +5% de dano contra a família, para sempre.</p>
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
  function alternarMinimapa() {
    if (modo === "estreito") document.body.classList.toggle("mapa-visivel-cel");
    else document.body.classList.toggle("mapa-oculto");
    const visivel = modo === "estreito" ? document.body.classList.contains("mapa-visivel-cel") : !document.body.classList.contains("mapa-oculto");
    $("#btnMapa").setAttribute("aria-pressed", String(visivel));
  }

  // ------------------------------------------------------------------
  // Layout responsivo: distribui os painéis (largo / médio / estreito)
  // ------------------------------------------------------------------
  let modo = null, abaMedia = "mochila", folhaAtual = null;
  const ABAS_MEDIO = {
    personagem: { rotulo: "Personagem", glifo: "ui_personagem", paineis: ["pPersonagem"] },
    // Equipamento junto da mochila: dá para arrastar de um para o outro.
    mochila: { rotulo: "Mochila", glifo: "ui_mochila", paineis: ["pEquip", "pMochila", "pBolsa"] },
    batalha: { rotulo: "Batalha", glifo: "ui_espadas", paineis: ["pAnalisador", "pBatalha", "pRegistro"] },
  };
  const FOLHAS = {
    mochila: { titulo: "Mochila e bolsa", paineis: ["pEquip", "pMochila", "pBolsa"] },
    equip: { titulo: "Personagem", paineis: ["pPersonagem", "pEquip"] },
    // O analisador vem antes: a lista de Batalha pode ser longa.
    batalha: { titulo: "Batalha e caçada", paineis: ["pAnalisador", "pBatalha"] },
    missao: { titulo: "Missão", paineis: ["pMissao"] },
    registro: { titulo: "Registro", paineis: ["pRegistro"] },
  };
  const calcModo = () => (mm("(min-width: 1280px)") ? "largo" : mm("(max-width: 760px)") ? "estreito" : "medio");
  // Largo em tela baixa (até 760 px de altura, ex.: 1280×720): o minimapa vai
  // para cima do mundo, como no médio, e a coluna direita fica com
  // Personagem, Equipamento e Batalha inteiros.
  const TELA_BAIXA = "(max-height: 760px)";
  let chaveLayout = null;
  const painel = (id) => document.getElementById(id);

  function abrirRegistro(aberto) {
    const p = painel("pRegistro");
    p.dataset.aberto = String(aberto);
    $("#btnRegistro").setAttribute("aria-expanded", String(aberto));
  }

  function montar() {
    const novo = calcModo();
    const baixa = novo === "largo" && mm(TELA_BAIXA);
    const chave = `${novo}${baixa ? ":baixa" : ""}`;
    if (chave === chaveLayout) return;
    chaveLayout = chave;
    modo = novo;
    document.body.classList.toggle("mapa-sobre-mundo", baixa);
    const dep = $("#deposito");
    for (const id of ["pMissao", "pMochila", "pBolsa", "pAnalisador", "pRegistro", "pMapa", "pPersonagem", "pEquip", "pBatalha"]) dep.appendChild(painel(id));
    $("#colEsq").innerHTML = "";
    $("#colDir").innerHTML = "";
    fecharFolha();
    const moldura = $("#mapaMoldura");
    if (modo === "largo") {
      for (const id of ["pMissao", "pMochila", "pBolsa", "pAnalisador", "pRegistro"]) $("#colEsq").appendChild(painel(id));
      for (const id of [...(baixa ? [] : ["pMapa"]), "pPersonagem", "pEquip", "pBatalha"]) $("#colDir").appendChild(painel(id));
      (baixa ? $("#mapaSobre") : $("#mapaCasa")).appendChild(moldura);
      abrirRegistro(true);
    } else if (modo === "medio") {
      $("#colDir").appendChild(painel("pMissao"));
      const nav = document.createElement("div");
      nav.className = "abas";
      nav.setAttribute("role", "tablist");
      nav.setAttribute("aria-label", "Painéis");
      nav.innerHTML = Object.entries(ABAS_MEDIO).map(([k, a]) =>
        `<button type="button" class="aba" role="tab" id="aba-${k}" data-aba="${k}" aria-controls="painelAba" aria-selected="${k === abaMedia}" title="${a.rotulo}">${imgGlifo(a.glifo)}<span>${a.rotulo}</span></button>`).join("");
      $("#colDir").appendChild(nav);
      const caixa = document.createElement("div");
      caixa.className = "painel-aba";
      caixa.id = "painelAba";
      caixa.setAttribute("role", "tabpanel");
      $("#colDir").appendChild(caixa);
      mostrarAbaMedia(abaMedia);
      $("#mapaSobre").appendChild(moldura);
      abrirRegistro(true);
    } else {
      $("#mapaSobre").appendChild(moldura);
      abrirRegistro(true);
    }
    const visivel = modo === "estreito" ? document.body.classList.contains("mapa-visivel-cel") : !document.body.classList.contains("mapa-oculto");
    $("#btnMapa").setAttribute("aria-pressed", String(visivel));
    medirRodape();
  }

  function mostrarAbaMedia(k) {
    abaMedia = k;
    const caixa = $("#painelAba");
    if (!caixa) return;
    const dep = $("#deposito");
    for (const el of Array.from(caixa.children)) dep.appendChild(el);
    for (const id of ABAS_MEDIO[k].paineis) caixa.appendChild(painel(id));
    caixa.setAttribute("aria-labelledby", `aba-${k}`);
    for (const b of $$("[data-aba]")) b.setAttribute("aria-selected", String(b.dataset.aba === k));
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
    for (const sel of ["#hud", "#missaoLinha", "#mapaSobre"]) if ($(sel)) ro.observe($(sel));
  }

  // A tecla I do MUNDO alterna body.hideBags; no médio/estreito isso abre a mochila.
  function observarMochila() {
    let antes = document.body.classList.contains("hideBags");
    new MutationObserver(() => {
      const agora = document.body.classList.contains("hideBags");
      if (agora === antes) return;
      antes = agora;
      if (modo === "medio") mostrarAbaMedia(abaMedia === "mochila" ? "personagem" : "mochila");
      else if (modo === "estreito") abrirFolha("mochila");
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
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
    // A lógica guarda a espada ao equipar o arco (e vice-versa): avisar.
    const p = jogador();
    const outro = slot === "arma" ? "arco" : slot === "arco" ? "arma" : null;
    const guardado = p && outro ? p.equipamento[outro] : null;
    const r = Mundo.equiparItem(ID, id, slot);
    if (r && r.mensagem) {
      const extra = r.ok && guardado ? ` ${nomeDoItem(guardado)} voltou para a mochila (espada e arco não ficam juntos).` : "";
      mensagem(r.mensagem + extra, r.ok ? "sistema" : "perigo");
    }
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
    if (id === "pocao") return window.Jogo ? Jogo.acao("pocao") : executar({ tipo: "usarPocao" });
    if (id === "pocao_fe") return window.Jogo ? Jogo.acao("pocaoFe") : executar({ tipo: "usarPocaoFe" });
    const slot = slotDoTipo(d.tipo);
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
        const dica = mouse ? null : slotDoTipo(d.tipo) ? "Toque num espaço de equipamento para equipar." : d.tipo === "consumivel" ? "Toque numa tecla de atalho para guardar ali." : `${nomeDoItem(id)} selecionado.`;
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
      toqueLongo = { t: setTimeout(() => { mostrarDica(d); suprimirClique = true; }, 450), x0, y0 };
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
        if (acao === "orar") return abrirOracao();
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
    $("#mapaCoord").textContent = `${p.x}, ${p.y}`;
    if (modalAberto?.id === "modalLoja") desenharLoja();
    if (modalAberto?.id === "modalMural") desenharMural();
    if (modalAberto?.id === "modalBestiario") desenharBestiario();
    if (modalAberto?.id === "modalMana") desenharMana();
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
    atualizarToque(p);
    atualizarBatalha(p);
    atualizarAnalisador(); // relógio e taxas por hora correm sem precisar de abate
    atualizarBotaoMana(p); // o maná cai no amanhecer e estraga sozinho, sem nenhuma ação
    if (modalAberto?.id === "modalMana") desenharMana();
    if (alvoDesenhado && typeof inimigos !== "undefined" && inimigos[alvoDesenhado]) atualizarVidaAlvo(inimigos[alvoDesenhado]);
    if (dlg.id && dlg.npc && Math.max(Math.abs(p.x - dlg.npc.x), Math.abs(p.y - dlg.npc.y)) > 2) fecharDialogo();
    if (modalAberto?.id === "modalOracao" && estadoOracao(p).ass !== assinaturaOracao) desenharOracao();
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
    $("#btnRegistro").addEventListener("click", () => abrirRegistro(painel("pRegistro").dataset.aberto !== "true"));
    $("#dialogo").addEventListener("click", () => (dlg.mostrado < dlg.texto.length ? completarDialogo() : fecharDialogo()));
    $("#pontos").addEventListener("click", () => abrirMural(null));
    $("#btnBestiario").addEventListener("click", abrirBestiario);
    $("#btnMana").addEventListener("click", abrirMana);
    $("#btnAnalisador").addEventListener("click", () => abrirAnalisador(painel("pAnalisador").dataset.aberto !== "true"));
    $("#missaoLinha").addEventListener("click", () => {
      const b = $("#missaoLinha");
      b.setAttribute("aria-expanded", String(b.getAttribute("aria-expanded") !== "true"));
    });
    // Abas do médio e folhas do celular
    document.addEventListener("click", (e) => {
      const aba = e.target.closest("[data-aba]");
      if (aba) mostrarAbaMedia(aba.dataset.aba);
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
        const comprar = e.target.closest("[data-comprar]");
        if (comprar && !comprar.disabled) { executar({ tipo: "comprar", item: comprar.dataset.comprar }); desenharLoja(); return; }
        const vender = e.target.closest("[data-vender]");
        if (vender) { executar({ tipo: "vender", item: vender.dataset.vender }); desenharLoja(); $("#lojaCorpo [data-aba-loja=vender]")?.focus(); return; }
        const abaL = e.target.closest("[data-aba-loja]");
        if (abaL) { abaLoja = abaL.dataset.abaLoja; desenharLoja(); $(`#lojaCorpo [data-aba-loja=${abaLoja}]`)?.focus(); return; }
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
        const viajar = e.target.closest("[data-viajar]");
        if (viajar && !viajar.disabled) {
          fecharModal(false);
          executar({ tipo: "viajar", areaDestino: viajar.dataset.viajar });
          return;
        }
        const orar = e.target.closest("[data-orar]");
        if (orar) {
          // Decide pelo estado atual (a lógica valida fé e nível e explica a
          // recusa), não pelo aria-disabled desenhado alguns segundos antes.
          const r = executar({ tipo: "orar", acao: orar.dataset.orar });
          if (r && r.ok) fecharModal(); else desenharOracao();
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
        if ($("#dicaItem").classList.contains("visivel")) { esconderDica(); return; }
        if (selecao) { selecionar(null); return; }
        if (dlg.id) { fecharDialogo(); return; }
        if (folhaAtual) { fecharFolha(); return; }
        return;
      }
      if (e.key === "F1") { e.preventDefault(); if (modalAberto?.id === "modalOracao") fecharModal(); else abrirOracao(); return; }
      const teclaT = (e.key === "t" || e.key === "T") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (teclaT && modalAberto?.id === "modalMural") { e.preventDefault(); fecharModal(); return; }
      const teclaB = (e.key === "b" || e.key === "B") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (teclaB && modalAberto?.id === "modalBestiario") { e.preventDefault(); fecharModal(); return; }
      const teclaN = (e.key === "n" || e.key === "N") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (teclaN && modalAberto?.id === "modalMana") { e.preventDefault(); fecharModal(); return; }
      if (modalAberto) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if ((e.key === "m" || e.key === "M") && !e.repeat) { e.preventDefault(); alternarMinimapa(); return; }
      if (e.key === "?") { e.preventDefault(); abrirAjuda(); return; }
      if (teclaT) { e.preventDefault(); abrirMural(null); return; }
      if (teclaB) { e.preventDefault(); abrirBestiario(); return; }
      if (teclaN) { e.preventDefault(); abrirMana(); return; }
      if ((e.key === "x" || e.key === "X") && !e.repeat) { e.preventDefault(); alternarAnalisador(); return; }
      if (/^[1-6]$/.test(e.key) && !e.repeat) {
        const i = Number(e.key) - 1;
        const hk = $(`#atalhos [data-atalho="${i}"]`);
        if (hk) { hk.classList.remove("usado"); void hk.offsetWidth; hk.classList.add("usado"); }
        window.Jogo?.usarAtalho(i);
      }
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
    preencherGlifos();
    montar();
    ligarBotoes();
    ligarItens();
    ligarToque();
    observarMochila();
    observarFolha();
    abrirAnalisador(analisadorAberto());
    const re = () => { montar(); medirRodape(); };
    for (const q of ["(min-width: 1280px)", "(max-width: 760px)", TELA_BAIXA]) {
      const mq = matchMedia(q);
      (mq.addEventListener ? mq.addEventListener("change", re) : mq.addListener(re));
    }
    addEventListener("resize", medirRodape);
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
    abrirOracao,
    abrirMural,
    abrirBestiario,
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
  window.abrirOracao = () => UI.abrirOracao();
  window.abrirMural = (id) => UI.abrirMural(id ?? null);
  window.abrirBestiario = () => UI.abrirBestiario();
  window.alternarMinimapa = () => UI.alternarMinimapa();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
