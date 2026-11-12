// =====================================================================
// sprites.js — arte procedural do mundo ("Iluminura viva").
//
// Tudo aqui é gerado em código: paletas, padrões de pixel (personagens,
// inimigos, itens, glifos de UI, marcadores, obstáculos, decoração e
// efeitos), tilesets por área e ícones para a interface.
//
// Regras (guia de estilo §1):
//   * 1 pixel de arte (px-a) = 2 px de mundo (Arte.PX).
//   * Luz vinda do oeste e de cima: realce em cima/esquerda, sombra
//     embaixo/direita, sombra projetada para a direita.
//   * Contorno automático de 1 px-a: sépia #2a1a14 (amigos, itens) e
//     carmim #4a1416 (inimigos). Chão e decoração não têm contorno.
//   * Nada de DOM na carga: canvas/document só dentro das funções.
//
// Expõe window.Arte, window.PIXEL_PATTERNS e window.iconeItemURL.
// =====================================================================
(function (global) {
  "use strict";

  const PX = 2;
  const T = 16; // tile em px-a

  // -------------------------------------------------------------------
  // Utilidades
  // -------------------------------------------------------------------
  function hash2(x, y, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function ruido(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const l = (a, b, t) => a + (b - a) * t * t * (3 - 2 * t);
    return l(l(hash2(xi, yi, s), hash2(xi + 1, yi, s), fx), l(hash2(xi, yi + 1, s), hash2(xi + 1, yi + 1, s), fx), fy);
  }
  function hexRgb(h) {
    const v = h.replace("#", "");
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), v.length > 6 ? parseInt(v.slice(6, 8), 16) : 255];
  }
  function rgbHex(r, g, b) {
    const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return "#" + c(r) + c(g) + c(b);
  }
  function misturar(a, b, t) {
    const A = hexRgb(a), B = hexRgb(b);
    return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  function comAlfa(hex, a) {
    return hex.slice(0, 7) + Math.round(a * 255).toString(16).padStart(2, "0");
  }
  function sementeDe(texto) {
    let s = 0;
    for (const ch of String(texto)) s += ch.charCodeAt(0);
    return s;
  }
  const temDOM = () => typeof document !== "undefined" && !!document.createElement;
  function novoCanvas(w, h) {
    if (typeof OffscreenCanvas !== "undefined" && !temDOM()) return new OffscreenCanvas(w, h);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  // -------------------------------------------------------------------
  // Paletas (§3.1) e cores semânticas (§3.2)
  // -------------------------------------------------------------------
  const PALETA = {
    tinta: ["#1c1210", "#2a1a14", "#4a3020", "#5a3a24"],
    pergaminho: ["#a8844f", "#cfae74", "#e6cf9c", "#f3e4c0"],
    ouro: ["#7a5518", "#b8862b", "#e8b94a", "#ffe08a"],
    lapis: ["#22356a", "#3b5a9a", "#6d8fc4", "#a9c2e8"],
    vermelhao: ["#5e1a14", "#8e2a1f", "#c2452d", "#e2774f"],
    oliva: ["#34401f", "#55642c", "#7a8a3f", "#a7b25a"],
    ocre: ["#4f3220", "#7d522b", "#b07a3e", "#d9a35c"],
    turquesa: ["#1d4f5c", "#2f7680", "#4fa3a5", "#a9dccf"],
    purpura: ["#3a2238", "#5a2d4a", "#8a4a6e", "#b98ad0"],
    linho: ["#a8916a", "#d4bf8f", "#eadcb6", "#f6efdc"],
    ferro: ["#3e4650", "#6e7a84", "#a8b4bc", "#e4ecf0"],
    bronze: ["#5e3c1c", "#8a5a2b", "#b07a38", "#d29e52"],
    peleA: ["#e0a878", "#c68a5c", "#a0663f"],
    peleB: ["#cf9466", "#b07548", "#8a5634"],
    peleC: ["#b97a4c", "#93603a", "#6e4428"],
    peleSombra: "#5a3424",
    cabeloEscuro: ["#2e1f18", "#4a2f20", "#6a4630"],
    cabeloGrisalho: ["#8e8882", "#bfb7a6", "#e8e2d4"],
  };

  const SEMANTICA = {
    "vida-1": "#8e2a1f", "vida-2": "#c2452d", "vida-3": "#e2774f",
    dano: "#f6e6bd", recebido: "#ff7a5c", critico: "#ffd24a", cura: "#8fd16a",
    "fe-1": "#22356a", "fe-2": "#3b5a9a", "fe-3": "#7fa3e0",
    "xp-1": "#7a5518", "xp-2": "#c8962e", "xp-3": "#f2cf6a",
    moeda: "#e8b94a", veneno: "#a8c84a", bloqueio: "#b9c6d6", hostil: "#ef6a5e", tarefa: "#e6cf9c",
    amigo: "#f3e4c0", missao: "#f2d27a", saida: "#b98ad0", agua: "#6fd0d0", bloqueado: "#7a6a5a",
  };

  const CONTORNO = { amigo: "#2a1a14", hostil: "#4a1416" };

  const SUBTITULOS = {
    canaan: "Terra de oliveiras e pastores",
    deserto: "Areias e acampamentos",
    mar: "Águas entre os portos",
    egito: "Às margens do Nilo",
    marVermelho: "A travessia",
    sinai: "Onde o caminho sobe",
    galileia: "À beira do lago",
  };

  // -------------------------------------------------------------------
  // Grade: superfície de desenho em px-a (cores "#rrggbb" ou "#rrggbbaa")
  // -------------------------------------------------------------------
  class Grade {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.d = new Array(w * h).fill(null); // camada principal
      this.s = new Array(w * h).fill(null); // sombra projetada (sem contorno)
    }
    dentro(x, y) {
      return x >= 0 && y >= 0 && x < this.w && y < this.h;
    }
    p(x, y, c) {
      x = Math.round(x);
      y = Math.round(y);
      if (!c || !this.dentro(x, y)) return;
      this.d[y * this.w + x] = typeof c === "function" ? c(x, y) : c;
    }
    g(x, y) {
      return this.dentro(x, y) ? this.d[y * this.w + x] : null;
    }
    apagar(x, y) {
      if (this.dentro(x, y)) this.d[y * this.w + x] = null;
    }
    ret(x, y, w, h, c) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, typeof c === "function" ? c(x + i, y + j, i, j) : c);
    }
    lin(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy, i = 0;
      for (;;) {
        this.p(x0, y0, typeof c === "function" ? c(x0, y0, i++) : c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
      }
    }
    // Elipse cheia; c pode ser cor ou função (nx, ny, x, y) com nx/ny em [-1, 1].
    elip(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
          if (nx * nx + ny * ny <= 1) this.p(x, y, typeof c === "function" ? c(nx, ny, x, y) : c);
        }
      }
    }
    // Carimba linhas de caracteres com um mapa de cores.
    carimbar(x0, y0, linhas, cores) {
      linhas.forEach((l, y) => {
        for (let x = 0; x < l.length; x++) {
          const ch = l[x];
          if (ch !== "." && ch !== " " && cores[ch]) this.p(x0 + x, y0 + y, cores[ch]);
        }
      });
    }
    sombra(cx, cy, rx, ry, cor = "#1c1210", alfa = 0.3) {
      const c = comAlfa(cor, alfa);
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
          if (nx * nx + ny * ny <= 1 && this.dentro(x, y)) this.s[y * this.w + x] = c;
        }
    }
    contorno(cor) {
      if (!cor) return;
      const w = this.w, h = this.h, d = this.d, marcar = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (d[y * w + x]) continue;
          if ((x > 0 && d[y * w + x - 1]) || (x < w - 1 && d[y * w + x + 1]) || (y > 0 && d[(y - 1) * w + x]) || (y < h - 1 && d[(y + 1) * w + x]))
            marcar.push(y * w + x);
        }
      for (const i of marcar) d[i] = cor;
    }
    espelhar() {
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w >> 1; x++) {
          const a = y * this.w + x, b = y * this.w + this.w - 1 - x;
          [this.d[a], this.d[b]] = [this.d[b], this.d[a]];
          [this.s[a], this.s[b]] = [this.s[b], this.s[a]];
        }
    }
    final() {
      return this.d.map((c, i) => c || this.s[i]);
    }
  }

  // Sombreado esférico: luz do oeste e de cima. rampa = escuro → claro.
  function tom(rampa, l) {
    const n = rampa.length;
    const i = Math.max(0, Math.min(n - 1, Math.floor((l * 0.5 + 0.5) * n + 0.2)));
    return rampa[i];
  }
  const esfera = (rampa, vies = 0) => (nx, ny) => tom(rampa, -(0.55 * nx + 0.8 * ny) + vies);

  // -------------------------------------------------------------------
  // Registro de padrões
  //   { w, h, quadros, contorno: "amigo"|"hostil"|null, origem,
  //     linhas|quadrosLinhas + cores   (padrão de caracteres)
  //     desenhar(g, quadro)            (padrão procedural) }
  // -------------------------------------------------------------------
  const PIXEL_PATTERNS = {};
  function registrar(chave, def) {
    def.quadros = def.quadros || (def.quadrosLinhas ? def.quadrosLinhas.length : 1);
    def.origem = def.origem || [0.5, 1];
    if (def.contorno === undefined) def.contorno = "amigo";
    PIXEL_PATTERNS[chave] = def;
    return def;
  }

  const cachePixels = new Map();
  function pixels(chave, { quadro = 0 } = {}) {
    const id = chave + "#" + quadro;
    if (cachePixels.has(id)) return cachePixels.get(id);
    const def = PIXEL_PATTERNS[chave];
    if (!def) return null;
    const g = new Grade(def.w, def.h);
    const q = Math.min(quadro, def.quadros - 1);
    if (def.desenhar) def.desenhar(g, q);
    else {
      const linhas = def.quadrosLinhas ? def.quadrosLinhas[q] : def.linhas;
      g.carimbar(0, 0, linhas, def.cores);
    }
    g.contorno(CONTORNO[def.contorno] || def.contorno || null);
    if (def.depois) def.depois(g, q);
    const limite = def.limiteCores || (chave.startsWith("ui_") ? 6 : chave.startsWith("fx_") ? 0 : 12);
    const r = { w: def.w, h: def.h, data: reduzirCores(g.final(), limite, CONTORNO[def.contorno]) };
    cachePixels.set(id, r);
    return r;
  }

  // Limita o número de cores: funde a cor mais rara na vizinha mais próxima
  // (o contorno nunca é fundido). Garante a regra de no máximo 12 cores.
  function reduzirCores(data, limite, protegida) {
    if (!limite) return data;
    const conta = new Map();
    for (const c of data) if (c) conta.set(c, (conta.get(c) || 0) + 1);
    if (conta.size <= limite) return data;
    const troca = new Map();
    const dist = (a, b) => { const A = hexRgb(a), B = hexRgb(b); return (A[0] - B[0]) ** 2 * 0.3 + (A[1] - B[1]) ** 2 * 0.59 + (A[2] - B[2]) ** 2 * 0.11 + (A[3] - B[3]) ** 2; };
    while (conta.size > limite) {
      let rara = null;
      for (const [c, n] of conta) if (c !== protegida && (!rara || n < conta.get(rara))) rara = c;
      let alvo = null, melhor = Infinity;
      for (const c of conta.keys()) if (c !== rara) { const d = dist(c, rara); if (d < melhor) { melhor = d; alvo = c; } }
      conta.set(alvo, conta.get(alvo) + conta.get(rara));
      conta.delete(rara);
      troca.set(rara, alvo);
      for (const [k, v] of troca) if (v === rara) troca.set(k, alvo);
    }
    return data.map((c) => (c && troca.has(c) ? troca.get(c) : c));
  }

  // Desenha um quadro num contexto 2D na posição (ox, oy) em px de tela.
  function pintarPixels(ctx, px, ox, oy, escala) {
    let atual = null;
    for (let y = 0; y < px.h; y++)
      for (let x = 0; x < px.w; x++) {
        const c = px.data[y * px.w + x];
        if (!c) continue;
        if (c !== atual) {
          ctx.fillStyle = c;
          atual = c;
        }
        ctx.fillRect(ox + x * escala, oy + y * escala, escala, escala);
      }
  }

  // Canvas de um quadro (ou de todos, em tira horizontal, com tira:true).
  function canvas(chave, { quadro = 0, escala = PX, tira = false } = {}) {
    const def = PIXEL_PATTERNS[chave];
    if (!def) return null;
    const n = tira ? def.quadros : 1;
    const c = novoCanvas(def.w * escala * n, def.h * escala);
    const ctx = c.getContext("2d");
    for (let i = 0; i < n; i++) pintarPixels(ctx, pixels(chave, { quadro: tira ? i : quadro }), i * def.w * escala, 0, escala);
    return c;
  }

  // -------------------------------------------------------------------
  // Humanos (§6.2): moldes 14×18 na célula 16×22, em x=1, y=3
  // -------------------------------------------------------------------
  const MOLDES = {
    manto: [
      ".....HHHH.....",
      "....HHHHHH....",
      "....HSSSSs....",
      "....SoSSos....",
      "....sBBBBs....",
      "...RRrBBrdd...",
      "..RRRrrrrrddd.",
      "..SRRrrrrrdS..",
      "..SRAAAAAAdS..",
      "...RRrrrrrdd..",
      "...RRrrrrddd..",
      "...Rrrrrrddd..",
      "..RRrrrrrrddd.",
      "..Rrrrrrrrddd.",
      "..rrrrrrrdddd.",
      "...dddddddd...",
      "....FF..FF....",
      "...FFF..FFF...",
    ],
    curta: [
      ".....HHHH.....",
      "....HHHHHH....",
      "....HSSSSs....",
      "....SoSSos....",
      "....sBBBBs....",
      "...RRrBBrdd...",
      "..RRRrrrrrdd..",
      "..SRRrrrrrdS..",
      "..SRAAAAAAdS..",
      "...RRrrrrdd...",
      "...Rrrrrrdd...",
      "...rrrrrrdd...",
      "....SS..sS....",
      "....SS..ss....",
      "....Ss..ss....",
      "....ss..ss....",
      "....FF..FF....",
      "...FFF..FFF...",
    ],
    veu: [
      ".....VVVV.....",
      "....VVVVVV....",
      "...VVSSSSsV...",
      "...VSoSSosV...",
      "...VsSSSSsW...",
      "..VVRrrrrrWW..",
      "..VRRrrrrrdW..",
      "..SRRrrrrrdS..",
      "..SRAAAAAAdS..",
      "...RRrrrrrdd..",
      "...RRrrrrddd..",
      "..RRrrrrrddd..",
      "..RRrrrrrrddd.",
      "..Rrrrrrrrddd.",
      "..rrrrrrrdddd.",
      "..dddddddddd..",
      "....FF..FF....",
      "...FFF..FFF...",
    ],
  };

  const trocar = (l, x, ch) => (x < 0 || x >= l.length ? l : l.slice(0, x) + ch + l.slice(x + 1));

  // 5 quadros: 0 parado, 1 respirar, 2 passo A, 3 passo B, 4 ação/fala.
  function quadrosDoMolde(molde, { duasMaos = false } = {}) {
    const W = molde[0].length;
    const vazio = ".".repeat(W);
    const f0 = molde.slice();
    const f1 = [vazio].concat(molde.slice(0, 9), molde.slice(10));
    const f2 = f1.slice();
    f2[16] = "...FF....FF...";
    f2[17] = "..FFF.....FF..";
    const f3 = f1.slice();
    f3[16] = "...FF....FF...";
    f3[17] = "..FF.....FFF..";
    const f4 = molde.slice();
    f4[7] = trocar(f4[7], 11, "d");
    f4[8] = trocar(f4[8], 11, "d");
    f4[6] = trocar(f4[6], 12, "S");
    f4[5] = trocar(f4[5], 12, "S");
    if (duasMaos) {
      f4[7] = trocar(f4[7], 2, "R");
      f4[8] = trocar(f4[8], 2, "R");
      f4[6] = trocar(f4[6], 1, "S");
      f4[5] = trocar(f4[5], 1, "S");
    }
    return [f0, f1, f2, f3, f4];
  }

  // alargar: duplica colunas e linhas (molde 14×18 → 16×20, para o chefe).
  function alargar(linhas, colunas = [2, 11], filas = [10, 13]) {
    const cols = colunas.slice().sort((a, b) => b - a);
    let r = linhas.map((l) => {
      let s = l;
      for (const c of cols) s = s.slice(0, c + 1) + s[c] + s.slice(c + 1);
      return s;
    });
    for (const f of filas.slice().sort((a, b) => b - a)) r.splice(f + 1, 0, r[f]);
    return r;
  }
  // curvar: linhas 0–5 descem 1 px e avançam 1 px (postura encurvada).
  function curvar(linhas) {
    const W = linhas[0].length;
    const r = linhas.slice();
    const topo = linhas.slice(0, 6).map((l) => "." + l.slice(0, W - 1));
    r[0] = ".".repeat(W);
    for (let i = 0; i < 6; i++) {
      let base = i + 1 === 6 ? r[6] : ".".repeat(W);
      let s = "";
      for (let x = 0; x < W; x++) s += topo[i][x] !== "." ? topo[i][x] : base[x];
      r[i + 1] = s;
    }
    return r;
  }

  // Sem barba: B vira S e as pontas de cada fila viram s.
  function semBarba(linhas) {
    return linhas.map((l) => {
      const a = l.indexOf("B"), b = l.lastIndexOf("B");
      if (a < 0) return l;
      let s = "";
      for (let x = 0; x < l.length; x++) s += l[x] !== "B" ? l[x] : x === a || x === b ? "s" : "S";
      return s;
    });
  }

  // Acessórios (coordenadas na célula 16×22). "mao" = segue a mão no quadro 4.
  const ACESSORIOS = {
    cajado_curvo: { mao: true, f: (g, c, ox, oy) => { g.lin(13 + ox, 2 + oy, 13 + ox, 20 + oy, c[0]); g.p(12 + ox, 1 + oy, c[0]); g.p(11 + ox, 1 + oy, c[0]); g.p(11 + ox, 2 + oy, c[0]); g.p(13 + ox, 2 + oy, c[1] || c[0]); } },
    cajado_alto: { mao: true, f: (g, c, ox, oy) => { g.lin(13 + ox, 0 + oy, 13 + ox, 20 + oy, c[0]); g.p(13 + ox, 0 + oy, c[1] || c[0]); } },
    cajado_curto: { mao: true, f: (g, c, ox, oy) => { g.lin(13 + ox, 6 + oy, 13 + ox, 20 + oy, c[0]); g.p(13 + ox, 5 + oy, "#e9d36a"); } },
    lanca: { mao: true, f: (g, c, ox, oy) => { g.lin(13 + ox, 3 + oy, 13 + ox, 19 + oy, c[0]); g.lin(13 + ox, 0 + oy, 13 + ox, 2 + oy, c[1]); g.p(12 + ox, 2 + oy, c[1]); g.p(14 + ox, 2 + oy, c[1]); } },
    lanca_longa: { mao: true, f: (g, c, ox, oy) => { g.lin(13 + ox, 2 + oy, 13 + ox, 19 + oy, c[0]); g.lin(13 + ox, 0 + oy, 13 + ox, 1 + oy, c[1]); g.p(12 + ox, 1 + oy, c[1]); g.p(14 + ox, 1 + oy, c[1]); } },
    espada: { mao: true, f: (g, c, ox, oy) => { g.ret(12 + ox, 12 + oy, 3, 1, c[2] || "#b07a38"); g.lin(13 + ox, 13 + oy, 13 + ox, 17 + oy, c[0]); g.p(13 + ox, 11 + oy, c[3] || "#5a3624"); g.p(13 + ox, 13 + oy, c[1]); } },
    espada_curva: { mao: true, f: (g, c, ox, oy) => { g.ret(12 + ox, 12 + oy, 3, 1, c[2]); g.lin(13 + ox, 13 + oy, 13 + ox, 16 + oy, c[0]); g.p(14 + ox, 17 + oy, c[0]); g.p(13 + ox, 13 + oy, c[1]); g.p(13 + ox, 11 + oy, "#2a1a14"); } },
    porrete: { mao: true, f: (g, c, ox, oy) => { g.ret(13 + ox, 11 + oy, 2, 3, c[0]); g.lin(13 + ox, 14 + oy, 13 + ox, 16 + oy, c[1] || c[0]); g.p(13 + ox, 11 + oy, c[1] || c[0]); } },
    escudo_redondo: { f: (g, c) => { g.elip(3, 13, 3, 3, (nx, ny) => (nx * nx + ny * ny > 0.5 ? c[1] : tom([c[0], c[2] || c[0]], -(nx + ny)))); g.p(3, 13, c[1]); } },
    escudo_alto: { f: (g, c) => { g.ret(0, 9, 5, 8, (x, y) => ((x + y) % 3 === 0 ? c[1] : c[0])); g.ret(1, 8, 3, 1, c[0]); g.lin(4, 9, 4, 16, c[2] || c[0]); } },
    escudo_oval: { f: (g, c) => { g.elip(2.5, 13, 2.6, 4, (nx, ny, x, y) => ((y % 2) ? c[0] : c[1])); } },
    arco_costas: { fundo: true, f: (g, c) => { g.lin(11, 5, 12, 6, c[0]); g.lin(12, 7, 12, 12, c[0]); g.lin(12, 13, 11, 14, c[0]); g.lin(10, 5, 10, 14, c[1]); } },
    capa: { fundo: true, f: (g, c, ox, oy, q) => { const o = q === 2 || q === 4 ? 1 : 0; g.ret(2, 8, 3, 9 - o, c[0]); g.p(1, 12 + o, c[0]); g.p(1, 13 + o, c[1]); g.p(1, 14, c[1]); g.lin(2, 16 - o, 4, 16 - o, c[1]); } },
    capa_larga: { fundo: true, f: (g, c, ox, oy, q) => { const o = q % 2; g.ret(2, 8, 14, 12 + o, c[0]); g.lin(2, 19 + o, 15, 19 + o, c[1]); } },
    rede: { f: (g, c) => { for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2 === 0) g.p(1 + x, 8 + y, c[0]); g.p(2, 7, c[0]); } },
    jarro: { f: (g, c) => { g.ret(0, 11, 4, 4, c[0]); g.ret(1, 10, 2, 1, c[1]); g.p(0, 11, c[2] || c[0]); g.p(1, 12, c[2] || c[0]); g.lin(0, 15, 3, 15, c[1]); } },
    bolsa: { f: (g, c) => { g.ret(3, 13, 3, 3, c[0]); g.p(3, 13, c[1] || c[0]); } },
    odre: { f: (g, c) => { g.ret(11, 13, 3, 4, c[0]); g.p(11, 13, c[1] || c[0]); g.p(12, 12, c[1] || c[0]); } },
    fardo: { fundo: true, f: (g, c) => { g.ret(9, 6, 6, 3, c[0]); g.lin(9, 6, 14, 6, c[1] || c[0]); } },
    corda: { f: (g, c) => { g.ret(2, 8, 4, 4, c[0]); g.p(3, 9, c[1]); g.p(4, 10, c[1]); g.p(3, 10, c[0]); } },
    // shofar (chifre de carneiro) na cintura: c = [marfim, ponta, bocal]; a boca larga sobe à esquerda.
    shofar: { f: (g, c) => { g.p(2, 11, c[1]); g.p(2, 12, c[0]); g.p(3, 12, c[0]); g.ret(3, 13, 3, 1, c[0]); g.p(6, 13, c[2]); g.p(4, 12, c[1]); } },
    saco: { f: (g, c) => { g.ret(1, 12, 3, 3, c[0]); g.p(2, 11, c[1] || c[0]); } },
    turbante: { f: (g, c) => { g.ret(3, 3, 10, 2, c[0]); g.ret(4, 2, 8, 1, c[0]); if (c[1]) { g.lin(3, 4, 12, 4, c[1]); } g.p(4, 2, c[2] || c[0]); } },
    elmo: { f: (g, c) => { g.ret(5, 2, 6, 1, c[1]); g.ret(4, 3, 8, 2, c[0]); g.lin(5, 3, 10, 3, c[1]); g.p(5, 5, c[0]); g.p(10, 5, c[0]); g.p(8, 1, c[1]); } },
    peitoral: { f: (g, c) => { g.ret(6, 9, 4, 3, c[0]); g.p(6, 10, "#c2452d"); g.p(8, 10, "#4fa3a5"); g.p(7, 11, "#e8b94a"); g.p(9, 9, c[1] || c[0]); } },
  };

  // Monta um personagem: molde + paleta + ajustes + acessórios.
  function humano(chave, cfg) {
    let base = cfg.barba === false ? semBarba(MOLDES[cfg.molde]) : MOLDES[cfg.molde].slice();
    let quadros = quadrosDoMolde(base, { duasMaos: !!cfg.duasMaos });
    if (cfg.ajustar) quadros = quadros.map((q, i) => cfg.ajustar(q.slice(), i));
    if (cfg.curvar) quadros = quadros.map(curvar);
    if (cfg.alargar) quadros = quadros.map((q) => alargar(q));
    const W = cfg.alargar ? 18 : 16, H = cfg.alargar ? 24 : 22;
    const cores = Object.assign({ o: "#2a1a14", F: "#5a3a24" }, cfg.cores);
    return registrar(chave, {
      w: W, h: H, quadros: 5, contorno: cfg.hostil ? "hostil" : "amigo", origem: [0.5, 1],
      humano: true,
      desenhar(g, q) {
        const acs = (cfg.acessorios || []).map((a) => [ACESSORIOS[a[0]], a[1]]);
        const desloc = (a) => (a.mao && q === 4 ? [1, -1] : [0, 0]);
        for (const [a, c] of acs) if (a.fundo) a.f(g, c, ...desloc(a), q);
        g.carimbar(1, 3, quadros[q], cores);
        for (const [a, c] of acs) if (!a.fundo) a.f(g, c, ...desloc(a), q);
        if (cfg.extra) cfg.extra(g, q);
      },
    });
  }

  // Jogador: o equipamento escolhe acessórios (arma visível, P2).
  const LAMINAS = {
    espada_madeira: ["#b48452", "#d9a35c", "#4f3220"],
    espada_ferro: ["#a8b4bc", "#e4ecf0", "#b07a38"],
    espada_temperada: ["#8fb0cc", "#e8f0f8", "#e8b94a"],
  };
  const CORES_ESCUDO = {
    escudo_madeira: ["#7d522b", "#4f3220", "#b07a3e"],
    escudo_bronze: ["#b07a38", "#7a4a24", "#f2d27a"],
    escudo_ferro: ["#8a949c", "#4a5258", "#d4dce2"],
  };
  function chaveJogador(eq = {}) {
    return "pj_jogador" + (eq.arma ? "|" + eq.arma : "") + (eq.arco ? "|arco" : "") + (eq.escudo ? "|" + eq.escudo : "");
  }
  function garantirJogador(eq = {}) {
    const chave = chaveJogador(eq);
    if (PIXEL_PATTERNS[chave]) return chave;
    const acessorios = [["bolsa", ["#7a4a30", "#a8703a"]]];
    if (eq.arco) acessorios.push(["arco_costas", ["#9a6a3c", "#eadcb6"]]);
    if (eq.arma && LAMINAS[eq.arma]) acessorios.push(["espada", LAMINAS[eq.arma]]);
    if (eq.escudo && CORES_ESCUDO[eq.escudo]) acessorios.push(["escudo_redondo", CORES_ESCUDO[eq.escudo]]);
    humano(chave, {
      molde: "curta", barba: false,
      cores: { H: "#4a2f20", S: "#e0a878", s: "#c68a5c", R: "#eadcb6", r: "#d4bf8f", d: "#a8916a", A: "#3b5a9a", F: "#5a3a24" },
      acessorios,
    });
    return chave;
  }
  garantirJogador({});

  // ----- NPCs (§6.4) -----
  humano("pj_eliabe", {
    molde: "manto",
    cores: { H: "#e8dcc0", S: "#cf9466", s: "#b07548", B: "#5a3a26", R: "#b08a5a", r: "#8a6a42", d: "#5e4630", A: "#8e2a1f", L: "#e8dcc0", F: "#5e4630" },
    ajustar: (l) => l.map((s, y) => (y >= 5 && y <= 15 && s[6] !== "." && s[6] !== "A" ? trocar(s, 6, "L") : s)).map((s, y) => (y === 1 ? s.replace("HHHHHH", "HHAAHH") : s)),
    acessorios: [["cajado_curvo", ["#7a5530", "#9a7048"]]],
  });
  humano("pj_micael", {
    molde: "manto",
    cores: { H: "#2f4a7a", S: "#e0a878", s: "#c68a5c", B: "#2e1f18", R: "#e0c890", r: "#c9ad78", d: "#a08a5a", A: "#2a1a14", F: "#5a3a24" },
    acessorios: [["cajado_alto", ["#6b4a2e", "#8a6a42"]], ["odre", ["#a66b39", "#c98a52"]]],
  });
  humano("pj_noemi", {
    molde: "veu", barba: false,
    cores: { V: "#c0603a", W: "#8e4a2a", S: "#b97a4c", s: "#93603a", R: "#d9a35c", r: "#b07a3e", d: "#7d522b", A: "#3f7f7a", F: "#4f3220" },
    acessorios: [["jarro", ["#b5663a", "#8e4a2a", "#d88a58"]]],
  });
  humano("pj_azarias", {
    molde: "manto",
    cores: { H: "#bfb7a6", S: "#e0a878", s: "#c68a5c", B: "#bfb7a6", R: "#eadcb6", r: "#55642c", d: "#34401f", A: "#e8b94a", F: "#5a3a24" },
    acessorios: [["fardo", ["#8a6a42", "#a8865e"]], ["turbante", ["#e8b94a", "#8e2a1f"]], ["bolsa", ["#e8b94a", "#ffe08a"]]],
  });
  humano("pj_tamar", {
    molde: "veu", barba: false,
    cores: { V: "#4fa3a5", W: "#2f7680", S: "#cf9466", s: "#b07548", R: "#e0b498", r: "#d8a98a", d: "#a87a62", A: "#8e2a1f", F: "#5a3a24" },
    acessorios: [["corda", ["#c9a46a", "#8a6a42"]], ["cajado_alto", ["#6b4a2e", "#c2452d"]]],
  });
  humano("pj_moises", {
    molde: "manto",
    cores: { H: "#e8e2d4", S: "#cf9466", s: "#b07548", B: "#bfb7a6", R: "#a8603a", r: "#8e4a2e", d: "#6e3422", A: "#eadcb6", F: "#4f3220" },
    acessorios: [["cajado_alto", ["#6b4a2e", "#8a6a42"]]],
    extra: (g, q) => { if (q !== 4) { g.lin(13, 0, 13, 1, "#6b4a2e"); } },
  });
  humano("pj_arao", {
    molde: "manto",
    cores: { H: "#a49a8a", S: "#cf9466", s: "#b07548", B: "#a49a8a", R: "#6d6fb4", r: "#4a4a8a", d: "#2e2e62", A: "#c2452d", F: "#4f3220" },
    acessorios: [["turbante", ["#f0e8d8"]], ["peitoral", ["#e8b94a"]], ["cajado_curto", ["#6b4a2e"]]],
  });
  humano("pj_josue", {
    molde: "curta",
    cores: { H: "#4a2f20", S: "#e0a878", s: "#c68a5c", B: "#4a2f20", R: "#b04a36", r: "#9a3a2a", d: "#7a2a1f", A: "#7a4a30", F: "#4a2f20" },
    acessorios: [["escudo_redondo", ["#8a5a32", "#c08a3e", "#a8703a"]], ["lanca", ["#6b4a2e", "#a8b4bc"]]],
  });
  humano("pj_pedro", {
    molde: "curta",
    cores: { H: "#6a3e26", S: "#c68a5c", s: "#a0663f", B: "#6a3e26", R: "#8aa0aa", r: "#6a7f8a", d: "#4f626c", A: "#d4bf8f", F: "#a0663f" },
    acessorios: [["rede", ["#c9b48a"]]],
  });
  humano("pj_jesus", {
    molde: "manto", duasMaos: true,
    cores: { H: "#4a2f20", S: "#cf9466", s: "#b07548", B: "#4a2f20", R: "#f2ead8", r: "#dcd0b4", d: "#b8a888", A: "#b8a888", M: "#c0523a", m: "#a8402e", n: "#7a2a1f", F: "#5a3a24" },
    // manto terracota sobre um ombro (cols 9–12, linhas 5–14) e cabelo até os ombros.
    ajustar: (l) => l.map((s, y) => {
      if (y >= 3 && y <= 5) { s = trocar(s, 4, "H"); s = trocar(s, 9, "H"); }
      if (y >= 5 && y <= 14) for (let x = 9; x <= 12; x++) if ("Rrd".includes(s[x])) s = trocar(s, x, x === 9 ? "M" : x === 12 ? "n" : "m");
      return s;
    }),
  });
  humano("pj_viajante", {
    molde: "manto",
    cores: { H: "#4a2f20", S: "#cf9466", s: "#b07548", B: "#4a2f20", R: "#d4bf8f", r: "#a8916a", d: "#7d6a4a", A: "#7a4a30", F: "#5a3a24" },
  });
  // Atalaia (vigia do mural de caçadas): um visual só para todos, reconhecível como marco em cada região.
  // Túnica curta em terra e ocre, cinto lápis, cajado alto e o shofar na cintura (o vigia toca o alarme).
  humano("pj_atalaia", {
    molde: "curta",
    cores: { H: "#2e1f18", S: "#cf9466", s: "#b07548", B: "#2e1f18", R: "#a8703a", r: "#7d522b", d: "#4f3220", A: "#3b5a9a", F: "#4f3220" },
    acessorios: [["cajado_alto", ["#6b4a2e", "#8a6a42"]], ["shofar", ["#eadcb6", "#8a6a42", "#5a3a24"]]],
  });

  // ----- Inimigos humanos (§6.5) -----
  humano("in_chefe", {
    molde: "manto", alargar: true, hostil: true,
    cores: { H: "#2a2a3a", S: "#b97a4c", s: "#93603a", B: "#2a2a3a", R: "#8a3a4a", r: "#6a2a3a", d: "#4a1a2a", A: "#e8b94a", F: "#2a1a14", I: "#b07a38" },
    ajustar: (l) => l.map((s, y) => (y === 6 ? trocar(trocar(s, 6, "I"), 7, "I") : s)),
    acessorios: [["capa", ["#3a1420", "#4a1a2a"]], ["espada_curva", ["#a8b4bc", "#e4ecf0", "#e8b94a"]]],
  });
  // ajuste de posição da espada do chefe (célula 18 de largura)
  humano("in_salteador", {
    molde: "curta", curvar: true, hostil: true,
    cores: { H: "#5a5a4a", S: "#93603a", s: "#6e4428", B: "#3e3e32", R: "#7a6a52", r: "#5e5040", d: "#463c30", A: "#3e3e32", F: "#2a1a14" },
    ajustar: (l) => l.map((s, y) => (y === 2 ? s.replace("HSSSSs", "HHSSSH") : y === 3 ? s.replace(/^(....)S/, "$1H") : s)),
    acessorios: [["porrete", ["#6b4a2e", "#4a3222"]], ["saco", ["#a8916a", "#d4bf8f"]]],
  });
  humano("in_guarda_egipcio", {
    molde: "curta", hostil: true, barba: false,
    cores: { H: "#f0e8d8", h: "#3b5a9a", S: "#b97a4c", s: "#93603a", R: "#f0e8d8", r: "#d8ccb4", d: "#b0a48c", A: "#e8b94a", K: "#e8b94a", L: "#3b5a9a", F: "#4f3220" },
    ajustar: (l) => l.map((s, y) => {
      if (y <= 2) { let t = ""; for (let x = 0; x < s.length; x++) t += s[x] === "H" ? (x % 2 ? "h" : "H") : s[x]; s = t; }
      if (y >= 2 && y <= 4) { s = trocar(s, 3, y === 2 ? "." : "h"); s = trocar(s, 10, y === 2 ? "." : "h"); }
      if (y === 5) { let t = ""; for (let x = 0; x < s.length; x++) t += "RrdBS".includes(s[x]) && s[x] !== "." ? (x % 2 ? "K" : "L") : s[x]; s = t; }
      if (y >= 6 && y <= 7) s = s.replace(/[Rr]/g, "S").replace(/d/g, "s");
      return s;
    }),
    acessorios: [["escudo_alto", ["#8a5a32", "#e8dcc0", "#5e3c1c"]], ["lanca", ["#6b4a2e", "#b07a38"]]],
  });
  humano("in_perseguidor", {
    molde: "curta", hostil: true, barba: false,
    cores: { H: "#5e3c1c", S: "#b97a4c", s: "#93603a", R: "#f0e8d8", r: "#d8ccb4", d: "#b0a48c", A: "#5e3c1c", K: "#c08a3e", L: "#8a5a2b", F: "#4f3220" },
    ajustar: (l) => l.map((s, y) => {
      if (y >= 5 && y <= 8) { let t = ""; for (let x = 0; x < s.length; x++) t += "Rrd".includes(s[x]) ? ((x + y) % 2 ? "K" : "L") : s[x]; s = t; }
      return s;
    }),
    acessorios: [["capa", ["#6a1f1f", "#4a1416"]], ["arco_costas", ["#6e4a28", "#eadcb6"]], ["elmo", ["#8a5a2b", "#c08a3e"]], ["espada", ["#a8b4bc", "#e4ecf0", "#c08a3e"]]],
  });
  humano("in_amalequita", {
    molde: "manto", hostil: true,
    cores: { H: "#1e1a1a", S: "#b97a4c", s: "#93603a", B: "#1e1a1a", R: "#52526e", r: "#3a3a52", d: "#2a2a3a", A: "#a88a5a", G: "#c8b8a0", F: "#2a1a14" },
    ajustar: (l) => l.map((s, y) => {
      if (y === 5) s = s.replace(/[Rrd]/g, "G");
      if (y === 15) { let t = ""; for (let x = 0; x < s.length; x++) t += s[x] === "d" && x % 2 ? "." : s[x]; s = t; }
      return s;
    }),
    acessorios: [["turbante", ["#1e1a1a"]], ["escudo_oval", ["#a88a5a", "#7d6a4a"]], ["lanca_longa", ["#4a3222", "#a8b4bc"]]],
  });

  // ----- Quadrúpede e aracnídeo (20×14) -----
  registrar("in_lobo", {
    w: 20, h: 14, quadros: 5, contorno: "hostil",
    desenhar(g, q) {
      const A = "#6a5a4c", B = "#8a7a6a", C = "#a89a86", V = "#c8b8a0", E = "#e8b94a", N = "#2a1a14";
      const resp = q === 1 ? 1 : 0, bote = q === 4 ? 2 : 0;
      // patas (atrás do corpo): quadros de trote alternam
      const passo = q === 2 ? 1 : q === 3 ? -1 : 0;
      const pata = (x, cor, d) => { g.lin(x + d, 9, x + d, 11, cor); g.p(x + d, 12, cor); };
      pata(6, A, -passo); pata(14, A, passo);
      // cauda baixa
      g.lin(4, 6, 2, 7, B); g.lin(2, 8, 1, 9, A); g.p(1, 8, B);
      // corpo
      g.elip(9, 7 + resp * 0.3, 5.6, 2.8, (nx, ny) => (ny > 0.55 ? V : tom([A, B, C], -(0.4 * nx + 0.9 * ny))));
      pata(5, B, passo); pata(12, B, -passo);
      // cabeça
      const hx = 14.5 + bote;
      g.elip(hx, 5, 2.4, 2.2, esfera([A, B, C]));
      g.ret(hx + 1, 5, 2, 2, B); g.p(hx + 2.5, 6, V); g.p(hx + 3, 5, N);
      // orelhas
      if (q === 4) { g.p(hx - 2, 3, A); g.p(hx - 1, 3, B); }
      else { g.p(hx - 1, 2, B); g.p(hx - 1, 1, C); g.p(hx + 1, 2, B); g.p(hx + 1, 1, B); }
      g.p(hx + 0.5, 4, E);
    },
  });
  registrar("in_escorpiao", {
    w: 20, h: 14, quadros: 5, contorno: "hostil",
    desenhar(g, q) {
      const A = "#9a5e24", B = "#c98a3a", C = "#e8b45e", F = "#c2452d", O = "#2a1a14";
      const osc = q === 1 || q === 3 ? 1 : 0, ataque = q === 4;
      // patas
      const lp = q === 2 ? 1 : 0;
      for (const x of [7, 9, 11]) { g.p(x - 1 + lp, 11, A); g.p(x - 2 + lp, 12, A); g.p(x + 1 - lp, 11, A); }
      // corpo segmentado
      g.elip(10, 9, 4.6, 2, esfera([A, B, C]));
      for (const x of [8, 10, 12]) g.p(x, 9, A);
      // cauda em arco sobre o corpo (5 segmentos)
      const cauda = ataque ? [[6, 8], [4, 7], [3, 5], [4, 3], [6, 3]] : [[6, 8], [4, 7], [3, 5], [3 + osc, 3], [5 + osc, 2]];
      cauda.forEach(([x, y], i) => { g.ret(x, y, 2, 2, i % 2 ? B : C); g.p(x + 1, y + 1, A); });
      const [fx, fy] = cauda[4];
      g.p(fx + 2, fy + 1, F); g.p(fx + 2, fy + 2, F);
      // pinças
      const ab = ataque ? 0 : 1;
      g.ret(14, 7, 2, 2, B); g.ret(16, 6 - ab, 2, 2, C); g.ret(16, 9 + ab, 2, 2, B); g.p(18, 6 - ab, C); g.p(18, 10 + ab, A);
      g.p(14, 8, O);
    },
  });

  // -------------------------------------------------------------------
  // Itens (§6.6): célula 16×16, arte de até 12×12 apoiada na linha 14
  // -------------------------------------------------------------------
  function item(chave, desenhar, extra = {}) {
    return registrar(chave, Object.assign({ w: 16, h: 16, contorno: "amigo", origem: [0.5, 0.75], desenhar }, extra));
  }
  function laminaDiagonal(g, cores, comprimento) {
    const [esc, med, cla, guarda, cabo] = cores;
    // cabo (embaixo à esquerda) e pomo
    g.lin(3, 12, 4, 11, cabo); g.p(2, 13, guarda);
    // guarda perpendicular
    g.p(4, 9, guarda); g.p(5, 10, guarda); g.p(6, 11, guarda); g.p(3, 8, guarda); g.p(7, 12, guarda);
    // lâmina: fio de luz em cima/esquerda, sombra embaixo/direita
    const x1 = 5 + comprimento, y1 = 10 - comprimento;
    g.lin(6, 9, x1, y1, med);
    g.lin(6, 8, x1 - 1, y1, cla);
    g.lin(7, 9, x1, y1 + 1, esc);
    g.p(x1, y1, cla);
  }
  item("pocao", (g) => {
    g.elip(8, 10.5, 4.5, 4.5, "#a9c2e8");
    g.elip(8, 10.8, 3.5, 3.4, esfera(["#8e2a1f", "#c2452d", "#e2774f"]));
    g.ret(7, 4, 2, 2, "#a9c2e8"); g.ret(7, 3, 2, 1, "#b07a3e"); g.p(7, 2, "#d9a35c");
    g.p(6, 8, "#f6efdc");
  });
  item("pocao_fe", (g) => {
    g.ret(5, 6, 6, 9, "#a9c2e8"); g.apagar(5, 6); g.apagar(10, 6); g.apagar(5, 14); g.apagar(10, 14);
    g.ret(6, 7, 4, 7, (x, y) => tom(["#22356a", "#3b5a9a", "#7fa3e0"], -((x - 7.5) * 0.5 + (y - 10) * 0.35)));
    g.ret(7, 3, 2, 3, "#a9c2e8"); g.ret(7, 2, 2, 1, "#b07a3e");
    g.p(6, 8, "#e4ecf0");
  });
  item("veneno_escorpiao", (g) => {
    g.elip(8, 11, 5, 3.4, esfera(["#4f3220", "#7d522b", "#b07a3e"]));
    g.ret(7, 6, 2, 2, "#7d522b"); g.ret(7, 5, 2, 1, "#4f3220");
    g.p(10, 7, "#a8c84a"); g.p(10, 8, "#6a8a2a");
    g.lin(6, 10, 8, 10, "#c2452d"); g.p(9, 11, "#c2452d");
  });
  // Folha lanceolada preenchida entre (x0,y0) e (x1,y1); luz do lado de cima/esquerda.
  function folha(g, x0, y0, x1, y1, larg, cores) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    for (let y = Math.floor(Math.min(y0, y1) - larg); y <= Math.ceil(Math.max(y0, y1) + larg); y++)
      for (let x = Math.floor(Math.min(x0, x1) - larg); x <= Math.ceil(Math.max(x0, x1) + larg); x++) {
        const px = x + 0.5 - x0, py = y + 0.5 - y0;
        const t = (px * dx + py * dy) / (len * len);
        if (t < 0 || t > 1) continue;
        const lado = (px * dy - py * dx) / len;
        const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * larg;
        if (Math.abs(lado) > w) continue;
        g.p(x, y, lado * (dy > 0 ? 1 : -1) < -0.2 ? cores[2] : Math.abs(lado) < 0.5 ? cores[1] : cores[0]);
      }
  }
  item("erva", (g) => {
    const E = "#55642c", M = "#7a8a3f", C = "#a7b25a";
    g.lin(8, 14, 8, 9, E);
    folha(g, 8, 11, 3, 6, 1.6, [E, M, C]);
    folha(g, 8, 11, 13, 6, 1.6, [E, M, C]);
    folha(g, 8, 10, 8, 2, 1.5, [E, M, C]);
    g.p(8, 2, "#efe6cf"); g.p(9, 3, "#efe6cf");
  });
  item("odre_agua", (g) => {
    g.elip(8, 10.5, 4.6, 4, esfera(["#4f3220", "#7d522b", "#b07a3e", "#d9a35c"]));
    g.ret(7, 5, 2, 2, "#7d522b"); g.ret(7, 4, 2, 1, "#b07a3e");
    g.lin(4, 7, 6, 6, "#d9a35c"); g.lin(10, 6, 12, 7, "#d9a35c");
    g.p(11, 12, "#4fa3a5");
  });
  item("espada_madeira", (g) => laminaDiagonal(g, ["#8a6038", "#b48452", "#d9a35c", "#4f3220", "#4f3220"], 6));
  item("espada_ferro", (g) => laminaDiagonal(g, ["#6e7a84", "#a8b4bc", "#e4ecf0", "#b07a38", "#5a3624"], 7));
  item("espada_temperada", (g) => laminaDiagonal(g, ["#5a7896", "#8fb0cc", "#e8f0f8", "#e8b94a", "#5a3624"], 8));
  item("escudo_madeira", (g) => {
    g.elip(8, 9, 5.5, 5.5, (nx, ny, x) => (nx * nx + ny * ny > 0.68 ? "#4f3220" : tom(["#7d522b", "#b07a3e"], -(0.6 * nx + 0.8 * ny)) ));
    for (const x of [6, 10]) g.lin(x, 5, x, 13, "#7d522b");
    g.ret(7, 8, 2, 2, "#b07a38"); g.p(7, 8, "#d29e52");
  });
  item("escudo_bronze", (g) => {
    g.elip(8, 9, 5.5, 5.5, (nx, ny) => { const r = Math.sqrt(nx * nx + ny * ny); return r > 0.82 ? "#7a4a24" : r > 0.55 ? tom(["#b07a38", "#d29e52"], -(nx + ny)) : r > 0.3 ? "#b07a38" : "#f2d27a"; });
  });
  // Escudo de ferro (troca de pontos de tarefa): ferro frio, aro escuro, 4 rebites e umbo.
  item("escudo_ferro", (g) => {
    g.elip(8, 9, 5.5, 5.5, (nx, ny) => {
      const r = Math.sqrt(nx * nx + ny * ny);
      if (r > 0.8) return "#4a5258";
      if (r < 0.3) return "#d4dce2";
      return tom(["#6e7a84", "#8a949c", "#b4bec6"], -(nx + ny) * 0.7);
    });
    for (const [x, y] of [[8, 4], [12, 9], [8, 13], [3, 9]]) g.p(x, y, "#d4dce2");
  });
  item("tunica_pano", (g) => {
    const l = ["#a8916a", "#d4bf8f", "#eadcb6"];
    g.ret(3, 4, 10, 3, (x, y) => tom(l, -((x - 8) * 0.15 + (y - 6) * 0.3)));
    g.ret(5, 7, 6, 7, (x, y) => tom(l, -((x - 8) * 0.25 + (y - 10) * 0.12)));
    g.ret(5, 9, 6, 1, "#3b5a9a");
    g.ret(7, 4, 2, 1, "#a8916a");
  });
  item("armadura_couro", (g) => {
    const l = ["#4f3220", "#7a4a30", "#a8703a"];
    g.ret(4, 4, 8, 10, (x, y) => tom(l, -((x - 7.5) * 0.22 + (y - 8) * 0.12)));
    g.ret(6, 3, 4, 1, "#4f3220"); g.ret(7, 4, 2, 1, "#2a1a14");
    g.lin(4, 8, 11, 8, "#4f3220"); g.lin(4, 11, 11, 11, "#4f3220");
    for (const [x, y] of [[5, 5], [10, 5], [5, 12], [10, 12]]) g.p(x, y, "#e8b94a");
  });
  // Couraça de escamas (troca de pontos de tarefa): peitoral de bronze escuro; cada escama é um brilho
  // com a sombra logo abaixo, em fileiras desencontradas.
  item("couraca_escamas", (g) => {
    const l = ["#7a4a24", "#b07a38", "#d29e52"];
    g.ret(4, 4, 8, 10, (x, y) => tom(l, -((x - 7.5) * 0.2 + (y - 8) * 0.1)));
    g.ret(6, 3, 4, 1, "#7a4a24"); g.ret(7, 4, 2, 1, "#2a1a14");
    for (let y = 6; y <= 12; y += 2) for (let x = 4 + ((y / 2) % 2); x <= 11; x += 2) g.p(x, y, "#7a4a24");
    for (let y = 5; y <= 11; y += 2) for (let x = 5 - ((y + 1) / 2) % 2; x <= 11; x += 2) g.p(x, y, "#d29e52");
    g.ret(3, 4, 1, 3, "#7a4a24"); g.ret(12, 4, 1, 3, "#7a4a24");
  });
  item("arco_madeira", (g) => {
    g.lin(6, 2, 8, 3, "#9a6a3c"); g.lin(9, 4, 10, 6, "#9a6a3c"); g.lin(10, 7, 10, 9, "#c08f58");
    g.lin(10, 10, 9, 12, "#9a6a3c"); g.lin(8, 13, 6, 14, "#6b4a2e");
    g.lin(6, 3, 6, 13, "#eadcb6"); g.p(10, 8, "#6b4a2e");
  });
  item("arco_composto", (g) => {
    g.p(5, 2, "#2a1a14"); g.p(6, 3, "#7d522b"); g.lin(7, 3, 9, 5, "#b07a3e"); g.lin(9, 6, 9, 7, "#eadcb6");
    g.lin(9, 9, 9, 10, "#eadcb6"); g.p(10, 8, "#7d522b"); g.lin(9, 11, 7, 13, "#b07a3e"); g.p(6, 13, "#7d522b"); g.p(5, 14, "#2a1a14");
    g.lin(6, 4, 6, 12, "#eadcb6");
  });
  item("flecha", (g) => {
    g.lin(4, 12, 11, 5, "#b07a3e");
    g.p(12, 4, "#a8b4bc"); g.p(13, 3, "#e4ecf0"); g.p(11, 4, "#a8b4bc"); g.p(12, 5, "#a8b4bc");
    g.p(3, 12, "#c2452d"); g.p(4, 13, "#c2452d"); g.p(2, 12, "#eadcb6"); g.p(4, 14, "#eadcb6"); g.p(3, 13, "#eadcb6");
  });
  item("pele_lobo", (g) => {
    const l = ["#6a5a4c", "#8a7a6a", "#a89a86"];
    g.elip(8, 9.5, 4, 4, (nx, ny) => (nx * nx + ny * ny < 0.35 ? "#c8b8a0" : tom(l, -(0.5 * nx + 0.7 * ny))));
    for (const [x, y] of [[3, 6], [12, 6], [3, 13], [12, 13]]) g.ret(x, y, 2, 1, "#8a7a6a");
    g.ret(7, 3, 3, 2, "#8a7a6a"); g.p(7, 2, "#6a5a4c"); g.p(9, 2, "#6a5a4c");
  });
  item("insignia_bandido", (g) => {
    g.elip(8, 9.5, 4.5, 4.5, esfera(["#5e3c1c", "#b07a38", "#d29e52"]));
    g.p(8, 7, "#8a3a4a"); g.ret(7, 8, 3, 1, "#8a3a4a"); g.ret(6, 9, 5, 1, "#6a2a3a"); g.ret(7, 10, 3, 1, "#6a2a3a"); g.p(8, 11, "#6a2a3a");
    g.p(8, 4, "#5e3c1c"); g.p(7, 3, "#b07a38"); g.p(9, 3, "#b07a38"); g.p(8, 2, "#b07a38");
  });
  item("peixe", (g) => {
    g.elip(7.5, 9, 4.6, 2.6, (nx, ny) => (ny > 0.45 ? "#eadcb6" : tom(["#2f7680", "#4fa3a5", "#a9dccf"], -(0.4 * nx + 0.9 * ny))));
    g.lin(2, 7, 3, 8, "#2f7680"); g.lin(2, 11, 3, 10, "#2f7680"); g.p(2, 9, "#2f7680"); g.p(1, 6, "#4fa3a5"); g.p(1, 12, "#4fa3a5");
    g.p(10, 8, "#2a1a14"); g.lin(6, 6, 8, 6, "#2f7680");
  });
  item("moeda", (g, q) => {
    const larg = [3, 2, 1, 2][q];
    g.elip(8, 11, larg + 0.01, 3, (nx, ny) => (Math.abs(nx) > 0.75 && larg > 1 ? "#b8862b" : tom(["#b8862b", "#e8b94a", "#ffe08a"], -(0.5 * nx + 0.8 * ny))));
    if (larg > 1) g.p(8, 11, "#7a5518");
  }, { quadros: 4 });
  item("moeda_pilha", (g) => {
    for (const [x, y] of [[5, 12], [10, 12], [7, 8]]) {
      g.elip(x + 0.5, y, 3, 2, esfera(["#b8862b", "#e8b94a", "#ffe08a"]));
      g.lin(x - 2, y + 1, x + 2, y + 1, "#7a5518");
      g.p(x, y, "#7a5518");
    }
  });
  const ALIAS_ITEM = { odre: "odre_agua", flechas: "flecha", moedas: "moeda" };
  const aliasItem = (id) => ALIAS_ITEM[id] || id;

  // -------------------------------------------------------------------
  // Glifos de UI (§6.7) — 8×8 ou 12×12, contorno já desenhado
  // -------------------------------------------------------------------
  function glifo(chave, linhas, cores) {
    return registrar(chave, { w: linhas[0].length, h: linhas.length, linhas, cores: Object.assign({ k: "#2a1a14" }, cores), contorno: null, origem: [0.5, 0.5] });
  }
  glifo("ui_coracao", [".kk..kk.", "kRRkkRRk", "kRrRRRrk", "kRRRRRdk", ".kRRRdk.", "..kRdk..", "...kk...", "........"], { R: "#c2452d", r: "#e2774f", d: "#8e2a1f" });
  glifo("ui_louro", ["k......k", "gk....kg", "Gg.kk.gG", "kGgkkgGk", ".kGggGk.", "..kGGk..", "...kk...", "..kddk.."], { g: "#e8b94a", G: "#b8862b", d: "#7a5518" });
  glifo("ui_candeia", ["...yk...", "...Yy...", "..kYk...", ".kkkkkk.", "kOoooOok", ".kOOOOkk", "..kkkk..", ".lllll.."], { y: "#ffe08a", Y: "#e8b94a", O: "#7d522b", o: "#b07a3e", l: "#3b5a9a" });
  glifo("ui_moeda", ["..kkkk..", ".kyYYYk.", "kyYYYYdk", "kYYkkYdk", "kYYkkYdk", "kYYYYddk", ".kddddk.", "..kkkk.."], { y: "#ffe08a", Y: "#e8b94a", d: "#b8862b" });
  glifo("ui_mochila", ["..kkkk..", ".k....k.", "kkkkkkkk", "kLLLLLLk", "kLkyykLk", "kLLLLLDk", "kLLLLDDk", "kkkkkkkk"], { L: "#a8703a", D: "#7a4a30", y: "#e8b94a" });
  glifo("ui_bolsa", ["..k..k..", "...kk...", "..kLLk..", ".kLLLLk.", "kLLyyLDk", "kLLLLLDk", ".kLDDDk.", "..kkkk.."], { L: "#a8703a", D: "#7a4a30", y: "#e8b94a" });
  glifo("ui_pergaminho", [".kkkkkk.", "kPPPPPPk", "kkPlllPk", ".kPPPPPk", ".kPlllPk", ".kPPPPkk", ".kPPPPPk", ".kkkkkk."], { P: "#e6cf9c", l: "#5a3a24" });
  glifo("ui_espadas", ["k......k", "kIk..kIk", ".kIkkIk.", "..kIIk..", "..kIIk..", ".kBkkBk.", "kBk..kBk", "kk....kk"], { I: "#e4ecf0", B: "#b07a38" });
  glifo("ui_personagem", ["..kkkk..", ".kHHHHk.", ".kSSSSk.", ".kSkkSk.", "..kSSk..", ".kRRRRk.", "kRRAARRk", "kkkkkkkk"], { H: "#4a2f20", S: "#e0a878", R: "#eadcb6", A: "#3b5a9a" });
  // Pena e rosa-dos-ventos aparecem sobre couro escuro (barra do topo, abas
  // do celular) e sobre pergaminho: todo traço tem miolo claro e contorno
  // de tinta, para ler nos dois fundos.
  glifo("ui_registro", [".....kkk", "....kWWk", "...kWWwk", "..kWWwk.", ".kWwwk..", ".kNkk...", "kNk.....", "kYYYYYk."], { W: "#f3e4c0", w: "#c9b48a", N: "#b07a38", Y: "#e8b94a" });
  glifo("ui_rosa", ["...k....", "..kRk...", ".kkRkk..", "kDDYddk.", ".kkDkk..", "..kDk...", "...k....", "........"], { R: "#c2452d", Y: "#e8b94a", D: "#e6cf9c", d: "#c9ad78" });
  glifo("ui_tela_cheia", ["YYY..YYY", "Y......Y", "Y......Y", "........", "........", "Y......Y", "Y......Y", "YYY..YYY"], { Y: "#e6cf9c" });
  glifo("ui_ajuda", ["..kkkk..", ".kYYYYk.", "kYkkkYYk", "kYYYkYYk", "kYYkYYYk", "kYYYYYYk", ".kYkYYk.", "..kkkk.."], { Y: "#e8b94a" });
  glifo("ui_fechar", ["DD....DD", "DDD..DDD", ".DDDDDD.", "..DDDD..", "..DDDD..", ".DDDDDD.", "DDD..DDD", "DD....DD"], { D: "#e6cf9c" });
  glifo("ui_menu", ["........", "DDDDDDDD", "DDDDDDDD", "........", "DDDDDDDD", "DDDDDDDD", "........", "DDDDDDDD"], { D: "#e6cf9c" });
  glifo("ui_cadeado", ["..kkkk..", ".kIkkIk.", ".kIk.kI.", "kkkkkkkk", "kYYYYYdk", "kYYkkYdk", "kYYYkYdk", "kkkkkkkk"], { I: "#a8b4bc", Y: "#e8b94a", d: "#b8862b" });
  glifo("ui_losango", ["...kk...", "..kYYk..", ".kYyYYk.", "kYyYYYdk", "kYYYYddk", ".kYYddk.", "..kddk..", "...kk..."], { Y: "#e8b94a", y: "#ffe08a", d: "#b8862b" });
  glifo("ui_escudo_bloq", ["kkkkkkkk", "kBBBBBdk", "kBbBBBdk", "kBBBBBdk", ".kBBBdk.", ".kBBBdk.", "..kBdk..", "...kk..."], { B: "#b9c6d6", b: "#e4ecf0", d: "#6e7a84" });
  glifo("ui_gota", ["...kk...", "...kk...", "..kVVk..", ".kVvVVk.", "kVvVVVdk", "kVVVVddk", ".kVVddk.", "..kkkk.."], { V: "#a8c84a", v: "#e4f0a8", d: "#6a8a2a" });
  glifo("ui_estrela_chefe", ["k.k..k.k", "kYkkkYkk", "kYYYYYYk", ".kkYYkk.", "..kYYk..", ".kYyYYk.", "..kYYk..", "...kk..."], { Y: "#e8b94a", y: "#ffe08a" });
  glifo("ui_ancora", ["...kk...", "..kAAk..", "...kk...", ".kkAAkk.", "...AA...", "k..AA..k", "kA.AA.Ak", ".kAAAAk."], { A: "#6fd0d0" });
  glifo("ui_peixe", ["........", "k..kkkk.", "kkkAAAAk", "kAkAAAkA", "kAkAAAAk", "kkkaaaak", "k..kkkk.", "........"], { A: "#4fa3a5", a: "#a9dccf" });
  glifo("ui_dpad_seta", ["...kk...", "..kYYk..", ".kYYYYk.", "kYYYYYYk", "kkkYYkkk", "..kYYk..", "..kYYk..", "..kkkk.."], { Y: "#e6cf9c" });
  glifo("ui_atacar", ["......kk", ".....kIk", "....kIk.", "k..kIk..", "kk.Ik...", ".kBk....", "kBkkk...", "kk......"], { I: "#e4ecf0", B: "#b07a38" });
  glifo("ui_flecha", ["....kkkk", ".....kIk", "....kWkk", "...kWk.k", "..kWk...", "Rkkk....", "RRk.....", "kRR....."], { I: "#e4ecf0", W: "#b07a38", R: "#c2452d" });
  glifo("ui_falar", [".kkkkkk.", "kPPPPPPk", "kPkPkPPk", "kPPPPPPk", ".kkPkkk.", "..kPk...", "..kk....", "........"], { P: "#f3e4c0" });
  glifo("ui_orar", ["...kk...", "..kSSk..", "..kSSk..", ".kSSSSk.", ".kSSSsk.", "kSSkkSsk", "kRRk.kRk", "kkk..kkk"], { S: "#e0a878", s: "#c68a5c", R: "#eadcb6" });
  // Caçadas: tabuinha de contagem (riscos cortados por um traço), selo de argila dos pontos de tarefa e alforje.
  glifo("ui_cacada", [".kkkkkk.", "kMWMWMyk", "kMWMWyWk", "kMWMyMWk", "kMWyWMWk", "kMyMWMWk", "kyWMWMWk", ".kkkkkk."], { W: "#d9a35c", M: "#5a3a24", y: "#f6efdc" });
  glifo("ui_selo", ["..kkkk..", ".kTtTTkk", "kTtiiiTk", "kTTimiTk", "kTTiiidk", "kTTTTddk", ".kTddkk.", "..kkk..."], { T: "#b5663a", t: "#d88a58", d: "#8e4a2a", i: "#6e3420", m: "#f0c890" });
  glifo("ui_alforje", [".kkkkkk.", "kkddddkk", "kDDkkDDk", "kDyDkDyk", "kLLLkLLk", "kLLLkLLk", "kLLdkLdk", "kkkkkkkk"], { L: "#a8703a", D: "#7a4a30", d: "#5a3624", y: "#e8b94a" });

  // -------------------------------------------------------------------
  // Marcadores (§6.8)
  // -------------------------------------------------------------------
  // Portal: arco de pedra com interior brilhante (4 quadros) + quadro 4 = fechado.
  // A pedra e o estandarte são definidos por área (registrarPortal).
  function registrarPortal(chave, pedra, estandarte) {
    registrar(chave, {
      w: 18, h: 26, quadros: 5,
      desenhar(g, q) {
        const fechado = q === 4;
        // interior
        const brilho = ["#5a2d4a", "#8a4a6e", "#b98ad0", "#e8c8f0"];
        for (let y = 6; y < 24; y++) for (let x = 4; x < 14; x++) {
          const dx = (x - 8.5) / 5, dy = (y - 15) / 10;
          if (y < 9 && dx * dx + ((y - 9) / 3.2) ** 2 > 1) continue;
          if (fechado) { g.p(x, y, y > 20 ? "#3a2238" : "#2a1a14"); continue; }
          const v = Math.sin((y + q * 2) * 0.9) * 0.5 + 0.5 - Math.abs(dx) * 0.6;
          g.p(x, y, brilho[Math.max(0, Math.min(3, Math.floor(v * 3 + 0.6)))]);
        }
        // pilares e arco
        const [d, m, c, l] = pedra;
        g.ret(1, 8, 3, 17, (x) => (x === 1 ? c : x === 2 ? m : d));
        g.ret(14, 8, 3, 17, (x) => (x === 14 ? m : x === 15 ? d : d));
        g.ret(1, 24, 16, 1, d);
        for (let x = 1; x <= 16; x++) {
          const dx = (x - 8.5) / 8;
          const top = Math.round(8 - Math.sqrt(Math.max(0, 1 - dx * dx)) * 6);
          g.p(x, top, l); g.p(x, top + 1, c); g.p(x, top + 2, m);
        }
        for (const y of [11, 15, 19]) { g.p(1, y, d); g.p(3, y, d); g.p(14, y, d); g.p(16, y, d); }
        // estandarte com a cor do chão do destino
        g.ret(6, 2, 1, 2, "#6b4a2e"); g.ret(7, 1, 4, 3, estandarte); g.p(10, 4, estandarte);
        if (fechado) {
          g.lin(3, 14, 14, 16, "#c9a46a"); g.lin(3, 15, 14, 17, "#8a6a42");
          g.ret(7, 15, 4, 4, "#e8b94a"); g.ret(8, 13, 2, 2, "#a8b4bc"); g.p(9, 16, "#2a1a14"); g.lin(7, 18, 10, 18, "#b8862b");
        }
      },
    });
  }
  // Setas no chão (3 quadros); fechado = quadro 3 (sem animação, cor bloqueado).
  registrar("mk_setas", {
    w: 16, h: 16, quadros: 4, contorno: null, origem: [0.5, 0.5],
    desenhar(g, q) {
      for (let i = 0; i < 3; i++) {
        const ativa = q === 3 ? false : i === q;
        const cor = q === 3 ? "#7a6a5a" : ativa ? "#e8c8f0" : "#b98ad0";
        const x = 2 + i * 5, y = 8;
        g.p(x, y - 2, cor); g.p(x + 1, y - 1, cor); g.p(x + 2, y, cor); g.p(x + 1, y + 1, cor); g.p(x, y + 2, cor);
        if (ativa) g.p(x + 3, y, cor);
      }
    },
  });
  registrar("mk_trilha", {
    w: 12, h: 20,
    desenhar(g) {
      g.sombra(8, 18.5, 4, 1.2);
      g.ret(2, 3, 8, 16, (x, y) => tom(["#7c7466", "#a39b8a", "#c8c0ac"], -((x - 5.5) * 0.35 + (y - 10) * 0.08)));
      g.apagar(2, 3); g.apagar(9, 3);
      g.ret(3, 2, 6, 1, "#c8c0ac");
      // seta ocre pintada
      g.lin(4, 8, 7, 8, "#b07a3e"); g.p(6, 7, "#b07a3e"); g.p(6, 9, "#b07a3e"); g.p(7, 8, "#d9a35c");
      g.lin(3, 13, 8, 13, "#7c7466"); g.p(4, 16, "#6e8a3a"); g.p(3, 17, "#6e8a3a");
    },
  });
  // Cais: píer de tábuas na vertical (3 tiles), postes, bandeirola com 2 quadros.
  registrar("mk_cais", {
    w: 18, h: 50, quadros: 2,
    desenhar(g, q) {
      for (const x of [3, 14]) for (const y of [6, 20, 34]) { g.ret(x, y, 1, 3, "#4a3222"); g.p(x, y + 3, "#2a1a14"); }
      for (let y = 4; y < 48; y++) {
        const t = y % 4 === 0 ? "#6e4a28" : y % 4 === 1 ? "#c08f58" : "#9a6a3c";
        g.ret(4, y, 10, 1, t);
        if (y % 4 === 0) g.p(4 + ((y * 3) % 9), y, "#4a3222");
      }
      g.ret(2, 2, 2, 8, "#6e4a28"); g.ret(14, 2, 2, 8, "#6e4a28");
      g.lin(3, 3, 14, 3, "#c9b48a");
      g.lin(16, 0, 16, 9, "#4a3222");
      const b = q ? 1 : 0;
      g.ret(17 - 4, 1 + b, 3, 2, "#6fd0d0"); g.p(12, 1 + b * 2, "#6fd0d0");
    },
  });
  // Ponto de pesca: ondulações (3 quadros) + quadro 3 = esgotado.
  registrar("mk_pesca", {
    w: 16, h: 16, quadros: 4, contorno: null, origem: [0.5, 0.5],
    desenhar(g, q) {
      const cor = (a) => comAlfa("#e8f2e0", a);
      if (q === 3) { g.elip(8, 8, 3, 1.4, (nx, ny) => (nx * nx + ny * ny > 0.5 ? cor(0.35) : null)); return; }
      const raios = [2 + q, 5 + q * 0.6];
      for (const r of raios) {
        for (let a = 0; a < 40; a++) {
          const t = (a / 40) * Math.PI * 2;
          g.p(8 + Math.cos(t) * r, 8 + Math.sin(t) * r * 0.5, cor(r > 5 ? 0.45 : 0.85));
        }
      }
      g.ret(6 + (q % 2), 9, 4, 1, "#245e6a"); g.ret(7 + (q % 2), 8, 2, 1, "#245e6a");
    },
  });
  registrar("mk_barco", {
    w: 26, h: 22, quadros: 2,
    desenhar(g, q) {
      const b = q;
      g.sombra(14, 19, 10, 1.6, "#173a44", 0.35);
      // casco
      for (let y = 13; y <= 17; y++) {
        const enc = y - 13;
        g.ret(2 + enc, y + b, 22 - enc * 2, 1, y === 13 ? "#9a6a3c" : y < 16 ? "#6e4a28" : "#4a3222");
      }
      g.ret(1, 12 + b, 24, 1, "#9a6a3c");
      // mastro e vela creme com faixa lápis
      g.lin(12, 1 + b, 12, 12 + b, "#4a3222");
      for (let y = 2; y <= 11; y++) {
        const l = Math.floor((y - 1) * 0.9);
        g.ret(13, y + b, l, 1, y === 7 ? "#3b5a9a" : y < 5 ? "#f3e4c0" : "#eadcb6");
      }
      g.p(13, 11 + b, "#d4bf8f");
    },
  });
  // Balões sobre NPCs (escudete de pergaminho com glifo).
  function balao(chave, linhasGlifo, cores) {
    registrar(chave, {
      w: 9, h: 12, quadros: 1,
      desenhar(g) {
        g.ret(1, 1, 7, 8, "#f3e4c0"); g.apagar(1, 1); g.apagar(7, 1);
        g.ret(1, 8, 7, 1, "#e6cf9c");
        g.p(4, 9, "#e6cf9c"); g.p(3, 9, "#e6cf9c"); g.p(4, 10, "#e6cf9c");
        g.carimbar(2, 2, linhasGlifo, cores);
      },
    });
  }
  balao("mk_balao_missao", ["..Y..", "..Y..", "..Y..", "..d..", ".....", "..Y.."], { Y: "#c8962e", d: "#7a5518" });
  balao("mk_balao_entregar", [".YYY.", "Y...d", "...Y.", "..Y..", ".....", "..Y.."], { Y: "#c8962e", d: "#7a5518" });
  balao("mk_balao_andamento", [".....", ".....", ".....", ".....", "b.b.b", "....."], { b: "#7a6a5a" });
  balao("mk_balao_loja", ["..d..", ".dYd.", "dYYYd", "dYyYd", "dYYYd", ".ddd."], { Y: "#e8b94a", y: "#ffe08a", d: "#7a5518" });
  balao("mk_balao_guia", ["..R..", "..R..", "dddYd", "..L..", "..L..", "....."], { R: "#c2452d", d: "#5a3a24", Y: "#e8b94a", L: "#7d6a4a" });
  // Mural de caçadas: três riscos de contagem cortados por uma barra (legível em 5×6).
  balao("mk_balao_mural", ["Y.Y.Y", "Y.Y.Y", "ddddd", "Y.Y.Y", "Y.Y.Y", "....."], { Y: "#c8962e", d: "#7a5518" });

  // -------------------------------------------------------------------
  // Efeitos (§8)
  // -------------------------------------------------------------------
  registrar("fx_sombra", { w: 12, h: 5, contorno: null, origem: [0.5, 0.5], desenhar: (g) => g.elip(6, 2.5, 5, 1.6, comAlfa("#1c1210", 0.3)) });
  registrar("fx_sombra_g", { w: 16, h: 5, contorno: null, origem: [0.5, 0.5], desenhar: (g) => g.elip(8, 2.5, 7, 1.7, comAlfa("#1c1210", 0.32)) });
  registrar("fx_sombra_lobo", { w: 18, h: 5, contorno: null, origem: [0.5, 0.5], desenhar: (g) => g.elip(9, 2.5, 8, 1.6, comAlfa("#1c1210", 0.3)) });
  function anel(chave, cor, quadros, tracejado) {
    registrar(chave, {
      w: 18, h: 9, quadros, contorno: null, origem: [0.5, 0.5],
      desenhar(g, q) {
        const n = 48;
        for (let i = 0; i < n; i++) {
          const t = (i / n) * Math.PI * 2;
          if (tracejado && Math.floor((i + q * 3) / 6) % 2 === 1) continue;
          g.p(9 + Math.cos(t) * 7.5, 4.5 + Math.sin(t) * 2.8, cor);
        }
        if (tracejado) {
          const r = q % 2;
          for (const [x, y, dx, dy] of [[0, 0, 1, 1], [17, 0, -1, 1], [0, 8, 1, -1], [17, 8, -1, -1]]) {
            g.p(x + dx * r, y + dy * r, "#ffe08a"); g.p(x + dx * (r + 1), y + dy * r, "#ffe08a"); g.p(x + dx * r, y + dy * (r + 1), "#ffe08a");
          }
        }
      },
    });
  }
  anel("fx_anel", "#ef6a5e", 4, true);
  anel("fx_anel_amigo", "#f3e4c0", 1, false);
  registrar("fx_corte", {
    w: 16, h: 16, quadros: 2, contorno: null, origem: [0.5, 0.5],
    desenhar(g, q) {
      for (let i = 0; i < 14; i++) {
        const t = -1.2 + (i / 13) * 2.2 + q * 0.3;
        const r = 6 + (i % 3 === 0 ? 0.5 : 0);
        g.p(8 + Math.cos(t) * r, 8 + Math.sin(t) * r, i < 5 ? "#e8b94a" : "#f6efdc");
        if (i > 3 && i < 11) g.p(8 + Math.cos(t) * (r - 1), 8 + Math.sin(t) * (r - 1), "#f6efdc");
      }
    },
  });
  registrar("fx_faisca", {
    w: 8, h: 8, quadros: 3, contorno: null, origem: [0.5, 0.5],
    desenhar(g, q) {
      const r = [1, 2, 3][q], c = q === 2 ? "#e8b94a" : "#fff6d0";
      g.p(4, 4 - r, c); g.p(4, 3 + r, c); g.p(4 - r, 4, c); g.p(3 + r, 4, c);
      if (q < 2) g.ret(3, 3, 2, 2, "#fff6d0");
      if (q === 1) { g.p(2, 2, c); g.p(5, 5, c); g.p(5, 2, c); g.p(2, 5, c); }
    },
  });
  registrar("fx_brilho", {
    w: 5, h: 5, quadros: 3, contorno: null, origem: [0.5, 0.5],
    desenhar(g, q) {
      const c = "#fff6d0";
      g.p(2, 2, c);
      if (q >= 1) { g.p(2, 1, c); g.p(2, 3, c); g.p(1, 2, c); g.p(3, 2, c); }
      if (q === 2) { g.p(2, 0, comAlfa(c, 0.6)); g.p(2, 4, comAlfa(c, 0.6)); g.p(0, 2, comAlfa(c, 0.6)); g.p(4, 2, comAlfa(c, 0.6)); }
    },
  });
  registrar("fx_pixel", { w: 1, h: 1, contorno: null, origem: [0.5, 0.5], desenhar: (g) => g.p(0, 0, "#ffffff") });
  registrar("fx_luz_quente", {
    w: 24, h: 8, contorno: null, origem: [0.5, 0.5],
    desenhar: (g) => g.elip(12, 4, 11, 3.5, (nx, ny) => (nx * nx + ny * ny > 0.5 ? "#c88a4a" : "#ffe2a8")),
  });
  registrar("fx_bolha", { w: 3, h: 3, contorno: null, origem: [0.5, 0.5], desenhar: (g) => { g.p(1, 0, "#a8c84a"); g.p(0, 1, "#a8c84a"); g.p(2, 1, "#a8c84a"); g.p(1, 2, "#a8c84a"); } });
  registrar("fx_borboleta", {
    w: 5, h: 4, quadros: 2, contorno: null, origem: [0.5, 0.5],
    desenhar(g, q) {
      g.p(2, 1, "#5a3a24"); g.p(2, 2, "#5a3a24");
      if (q === 0) { g.ret(0, 0, 2, 2, "#f6efdc"); g.ret(3, 0, 2, 2, "#f6efdc"); g.p(0, 2, "#eadcb6"); g.p(4, 2, "#eadcb6"); }
      else { g.ret(1, 0, 1, 3, "#eadcb6"); g.ret(3, 0, 1, 3, "#eadcb6"); }
    },
  });
  // Fogueira (3 quadros a 6 fps).
  registrar("fx_fogueira", {
    w: 14, h: 14, quadros: 3, origem: [0.5, 1],
    desenhar(g, q) {
      g.sombra(8, 12, 6, 1.4);
      for (const [x, y] of [[2, 11], [5, 12], [8, 12], [11, 11], [3, 10], [10, 10]]) g.ret(x, y, 2, 1, "#6a5a4a");
      g.lin(3, 11, 10, 9, "#4a3222"); g.lin(4, 9, 10, 11, "#6b4a2e");
      const h = [5, 6, 4][q], o = [0, 1, -1][q];
      g.elip(7 + o * 0.3, 10 - h / 2, 2.5, h / 2, "#c2452d");
      g.elip(7 + o * 0.5, 10 - h / 2 + 0.5, 1.6, h / 2 - 0.6, "#e8b94a");
      g.p(7 + o, 10 - h, "#ffe08a"); g.p(7, 9, "#ffe08a");
    },
  });
  // Faixa de pergaminho do cartão de título (180×36 px-a, pontas enroladas).
  registrar("fx_faixa", {
    w: 180, h: 36, contorno: "amigo", origem: [0.5, 0.5],
    desenhar(g) {
      const P = ["#cfae74", "#e6cf9c", "#f3e4c0"];
      for (let y = 3; y < 33; y++) for (let x = 8; x < 172; x++) {
        const n = hash2(x, y, 77);
        g.p(x, y, y < 5 ? P[2] : y > 30 ? P[0] : n < 0.06 ? P[0] : P[1]);
      }
      for (const lado of [0, 1]) {
        const x0 = lado ? 168 : 2;
        for (let y = 1; y < 35; y++) for (let x = 0; x < 10; x++) {
          const t = x / 9;
          const c = lado ? (t < 0.3 ? P[2] : t < 0.7 ? P[1] : P[0]) : t < 0.3 ? P[0] : t < 0.7 ? P[1] : P[2];
          g.p(x0 + x, y, c);
        }
        g.lin(x0 + (lado ? 3 : 6), 2, x0 + (lado ? 3 : 6), 33, "#a8844f");
      }
      g.lin(14, 6, 165, 6, "#b8862b"); g.lin(14, 29, 165, 29, "#b8862b");
    },
  });

  // Decoração plana dos hubs (até 3 px-a de altura; vai em casa livre).
  registrar("dc_tapete", {
    w: 16, h: 16, contorno: null, origem: [0.5, 0.5],
    desenhar(g) {
      g.ret(2, 4, 12, 8, (x, y) => (y === 4 || y === 11 ? "#5e1a14" : (y - 4) % 3 === 0 ? "#e8b94a" : "#8e2a1f"));
      for (let x = 2; x < 14; x += 2) { g.p(x, 3, "#e8b94a"); g.p(x, 12, "#e8b94a"); }
    },
  });
  registrar("dc_esteira", {
    w: 16, h: 16, contorno: null, origem: [0.5, 0.5],
    desenhar(g) {
      g.ret(2, 5, 12, 7, (x, y) => ((x + (y % 2)) % 2 ? "#c8b070" : "#a8904e"));
      g.elip(12, 4, 2.5, 1.6, "#8a6a42"); g.p(12, 4, "#5e4630");
    },
  });
  registrar("dc_rede", {
    w: 16, h: 16, contorno: null, origem: [0.5, 0.5],
    desenhar(g) {
      for (let y = 3; y < 13; y++) for (let x = 2; x < 14; x++) if ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) g.p(x, y, "#c9b48a");
      for (const [x, y] of [[3, 3], [13, 4], [4, 12], [12, 12]]) g.p(x, y, "#e6cf9c");
      g.ret(9, 9, 3, 2, "#4fa3a5"); g.p(12, 9, "#2f7680");
    },
  });
  registrar("dc_fogo_apagado", {
    w: 16, h: 16, contorno: null, origem: [0.5, 0.5],
    desenhar(g) {
      for (let a = 0; a < 8; a++) { const t = (a / 8) * Math.PI * 2; g.ret(7 + Math.cos(t) * 4.5, 8 + Math.sin(t) * 3, 2, 1, a % 2 ? "#8a8070" : "#a39b8a"); }
      g.ret(6, 7, 4, 2, "#3a2c24"); g.p(7, 7, "#6a5646");
    },
  });

  // Mapeamentos (§7)
  const VISUAL_NPC = {
    viajante1: "pj_eliabe", guia_canaa: "pj_micael", noemi1: "pj_noemi", mercador1: "pj_azarias",
    guia_deserto: "pj_tamar", moisesEgito: "pj_moises", aaronEgito: "pj_arao", araoMar: "pj_arao",
    josueSinai: "pj_josue", pedroGalileia: "pj_pedro", jesusGalileia: "pj_jesus",
  };
  const VISUAL_INIMIGO = {
    lobo1: "in_lobo", escorpiao1: "in_escorpiao", bandido1: "in_chefe",
    soldadoEgito1: "in_guarda_egipcio", perseguidorMar1: "in_perseguidor", guardiaoSinai1: "in_amalequita",
    "ameaçaGalileia1": "in_salteador",
  };
  const VISUAL_POR_APARENCIA = { lobo: "in_lobo", escorpiao: "in_escorpiao", bandido: "in_salteador", soldado: "in_guarda_egipcio", guerreiro: "in_amalequita" };
  const CHEFES = new Set(["bandido1"]);
  // NPCs sem visual próprio que compartilham um visual pelo papel (os 6 atalaias são o mesmo vigia).
  const VISUAL_POR_PAPEL = { mural: "pj_atalaia" };

  function visualDe(id) {
    if (VISUAL_NPC[id]) return VISUAL_NPC[id];
    const n = typeof npcs !== "undefined" ? npcs[id] : null;
    if (n && VISUAL_POR_PAPEL[n.papel]) return VISUAL_POR_PAPEL[n.papel];
    if (VISUAL_INIMIGO[id]) return VISUAL_INIMIGO[id];
    const ini = typeof inimigos !== "undefined" ? inimigos[id] : null;
    if (ini) return VISUAL_POR_APARENCIA[ini.aparencia] || "in_salteador";
    return "pj_viajante";
  }
  const nomeCurto = (nome) => String(nome || "").split(/[,·]/)[0].trim();

  // -------------------------------------------------------------------
  // Biomas (§3.3)
  // -------------------------------------------------------------------
  const TRILHAS_CAPITULO = { linhas: [[56, 1, 78], [30, 2, 77]], colunas: [] };
  const BIOMAS = {
    canaan: {
      chao: { base: "#8fa34e", escuro: "#7b9042", claro: "#a6b862", salpico: "#c3c873" },
      mancha: { base: "#7d9145", escuro: "#6a7e3a" },
      caminho: { base: "#c7a066", escuro: "#a98450", claro: "#ddb97c", borda: "#8c6a40" },
      obstaculos: [{ tipo: "oliveira", peso: 55, alto: true }, { tipo: "muro", peso: 25 }, { tipo: "rocha", peso: 20 }],
      borda: { tipo: "sebe", rampa: ["#34401f", "#4a5a2a", "#6a7a3a", "#8a9a4a"] },
      moldura: { norte: "colinas", sul: "colinas", leste: "colinas", oeste: "colinas" },
      deco: [{ tipo: "anemona", peso: 3, cor: "#c8402f" }, { tipo: "flor_branca", peso: 3, cor: "#efe6cf" }, { tipo: "flor_amarela", peso: 2, cor: "#e9d36a" }, { tipo: "tufo", peso: 4, cor: "#6e8a3a" }, { tipo: "pedrinha", peso: 2, cor: "#b8ab8a" }],
      luz: { cor: "#ffd08a", alfa: 0.1, modo: "screen" }, vinheta: { cor: "#1a2410", forca: 0.28 }, sombra: "#2a2a1a",
      particulas: { tipo: "polen", cor: "#f2e6a0", max: 20 },
      trilhas: { linhas: [[56, 2, 77], [2, 2, 77]], colunas: [[2, 2, 56]] },
      hubs: [{ x: 7, y: 5, raio: 3, tipo: "vila" }],
    },
    deserto: {
      chao: { base: "#e2c07c", escuro: "#cfa863", claro: "#efd598", salpico: "#c4955a" },
      mancha: { base: "#d6b06c", escuro: "#c49a58" },
      caminho: { base: "#c9a16a", escuro: "#b08a58", claro: "#d9b47e", borda: "#a37e50" },
      obstaculos: [{ tipo: "rocha", peso: 55 }, { tipo: "acacia", peso: 25, alto: true }, { tipo: "retama", peso: 20 }],
      borda: { tipo: "duna", rampa: ["#9a7040", "#b88a50", "#d8b070", "#ecc890"] },
      moldura: { norte: "dunas", sul: "dunas", leste: "dunas", oeste: "dunas" },
      deco: [{ tipo: "pedrinha", peso: 3, cor: "#a8845a" }, { tipo: "tufo_seco", peso: 3, cor: "#9a8550" }, { tipo: "ondulacao", peso: 4, cor: "#cfa863" }, { tipo: "pegadas", peso: 1, cor: "#b08a58" }],
      luz: { cor: "#ffbf6a", alfa: 0.12, modo: "screen" }, vinheta: { cor: "#3a2410", forca: 0.34 }, sombra: "#5a3424",
      particulas: { tipo: "areia", cor: "#f0dcaa", max: 25 },
      trilhas: { linhas: [[56, 2, 77], [2, 40, 77]], colunas: [[40, 2, 56]] },
      hubs: [{ x: 69, y: 10, raio: 4, tipo: "acampamento" }],
    },
    mar: {
      chao: { base: "#2f7f8c", escuro: "#276a78", claro: "#3f98a0", salpico: "#bfe6d6" },
      mancha: { base: "#3f98a0", escuro: "#4fa3a5" },
      caminho: { base: "#358a96", escuro: "#2f7f8c", claro: "#3f98a0", borda: "#358a96" },
      agua: { profunda: "#1d4f5c", base: "#2f7f8c", escura: "#276a78", clara: "#3f98a0", brilho: "#bfe6d6", espuma: "#e8f2e0" },
      obstaculos: [{ tipo: "ilhota", peso: 40, alto: true }, { tipo: "rochedo", peso: 40 }, { tipo: "recife", peso: 20 }],
      borda: { tipo: "mar_profundo", rampa: ["#163e4a", "#1d4f5c", "#245e6a", "#2f7680"] },
      moldura: { norte: "mar", sul: "mar", leste: "praia", oeste: "relva" },
      deco: [{ tipo: "cardume", peso: 1, cor: "#245e6a" }],
      luz: { cor: "#ffd9a0", alfa: 0.07, modo: "screen" }, vinheta: { cor: "#0a2030", forca: 0.25 }, sombra: "#173a44",
      particulas: { tipo: "brilho", cor: "#bfe6d6", max: 20 },
      trilhas: { linhas: [[30, 1, 78]], colunas: [] },
      hubs: [],
    },
    egito: {
      chao: { base: "#9a8650", escuro: "#857344", claro: "#b09c62", salpico: "#6f7a3a" },
      mancha: { base: "#7f6e3e", escuro: "#6a5c34" },
      caminho: { base: "#e6d3a0", escuro: "#cdb77f", claro: "#f2e4bc", borda: "#b09a68" },
      agua: { profunda: "#1f5a5a", base: "#2c6e6e", escura: "#245e5e", clara: "#3a8a88", brilho: "#6aaaa0", espuma: "#e8f2e0" },
      obstaculos: [{ tipo: "tamareira", peso: 35, alto: true }, { tipo: "tijolos", peso: 25 }, { tipo: "coluna", peso: 20, alto: true }, { tipo: "jarros", peso: 20 }],
      borda: { tipo: "muro_tijolo", rampa: ["#6a3c22", "#87502f", "#a8683f", "#c8865a"], norte: "agua" },
      moldura: { norte: "agua", sul: "campos", leste: "campos", oeste: "campos" },
      deco: [{ tipo: "caco", peso: 2, cor: "#b5663a" }, { tipo: "junco", peso: 3, cor: "#7a9a3a" }, { tipo: "broto", peso: 4, cor: "#6f7a3a" }],
      luz: { cor: "#ffcc66", alfa: 0.12, modo: "screen" }, vinheta: { cor: "#2a1a08", forca: 0.32 }, sombra: "#4a3020",
      particulas: { tipo: "poeira", cor: "#f2d27a", max: 20 },
      trilhas: TRILHAS_CAPITULO,
      hubs: [{ x: 11, y: 52, raio: 3, tipo: "vila" }],
    },
    marVermelho: {
      chao: { base: "#c49a72", escuro: "#a8866a", claro: "#dcb48a", salpico: "#f0e0d0" },
      mancha: { base: "#a08868", escuro: "#8a7458" },
      caminho: { base: "#b89a78", escuro: "#9c8060", claro: "#ccb090", borda: "#8a7458" },
      agua: { profunda: "#153f52", base: "#215a6e", escura: "#1b4d60", clara: "#2a6f86", brilho: "#3f8aa0", espuma: "#e8f2e0" },
      obstaculos: [{ tipo: "granito", peso: 40 }, { tipo: "coral", peso: 35 }, { tipo: "destrocos", peso: 25 }],
      borda: { tipo: "praia_granito", rampa: ["#5a2a20", "#7a3426", "#a5503a", "#c87a58"], norte: "muralha", sul: "muralha" },
      moldura: { norte: "muralha", sul: "muralha", leste: "granito", oeste: "granito" },
      deco: [{ tipo: "concha", peso: 3, cor: "#f0e0d0" }, { tipo: "alga", peso: 3, cor: "#6a7a4a" }, { tipo: "poca", peso: 2, cor: "#7a9aa0" }],
      luz: { cor: "#ff9f78", alfa: 0.12, modo: "screen" }, vinheta: { cor: "#3a2238", forca: 0.4 }, sombra: "#3a2238",
      particulas: { tipo: "respingo", cor: "#e8f2e0", max: 25 },
      trilhas: TRILHAS_CAPITULO,
      hubs: [{ x: 9, y: 52, raio: 3, tipo: "pegadas" }],
    },
    sinai: {
      chao: { base: "#8f735a", escuro: "#7a6050", claro: "#a68a6c", salpico: "#bca084" },
      mancha: { base: "#8a6e5e", escuro: "#6a5248" },
      caminho: { base: "#c2a888", escuro: "#a08a6c", claro: "#d4bea0", borda: "#7a6450" },
      obstaculos: [{ tipo: "penedo", peso: 50 }, { tipo: "arbusto", peso: 20 }, { tipo: "marco", peso: 15 }, { tipo: "acacia", peso: 15, alto: true }],
      borda: { tipo: "paredao", rampa: ["#2e2430", "#3a2a44", "#5a4a4a", "#7a6a62"] },
      moldura: { norte: "penhascos", sul: "penhascos", leste: "penhascos", oeste: "penhascos" },
      deco: [{ tipo: "seixo", peso: 3, cor: "#7a6a5a" }, { tipo: "liquen", peso: 2, cor: "#9aa070" }, { tipo: "tufo", peso: 3, cor: "#7a7f4a" }],
      luz: { cor: "#c8d0f0", alfa: 0.08, modo: "screen" }, vinheta: { cor: "#10101e", forca: 0.42 }, sombra: "#3a2a44",
      particulas: { tipo: "nevoa", cor: "#e8ecf4", max: 12 },
      trilhas: TRILHAS_CAPITULO,
      hubs: [{ x: 9, y: 52, raio: 3, tipo: "estandarte" }],
    },
    galileia: {
      chao: { base: "#7ea05a", escuro: "#6a8c4c", claro: "#97b86e", salpico: "#b8d080" },
      mancha: { base: "#74965a", escuro: "#62844a" },
      caminho: { base: "#8a7a62", escuro: "#6e604c", claro: "#a8987c", borda: "#5a4e3e" },
      agua: { profunda: "#2f6a7a", base: "#3a7688", escura: "#336e80", clara: "#4a8fa0", brilho: "#6aaab8", espuma: "#e8f2e0" },
      obstaculos: [{ tipo: "figueira", peso: 35, alto: true }, { tipo: "basalto_muro", peso: 30 }, { tipo: "basalto", peso: 20 }, { tipo: "barco", peso: 15 }],
      borda: { tipo: "muro_basalto", rampa: ["#262422", "#363432", "#4c4a48", "#6e6a64"], norte: "agua" },
      moldura: { norte: "agua", sul: "colinas", leste: "colinas", oeste: "colinas" },
      deco: [{ tipo: "anemona", peso: 3, cor: "#d8443a" }, { tipo: "mostarda", peso: 3, cor: "#e2c044" }, { tipo: "lirio", peso: 2, cor: "#b8a0d0" }, { tipo: "tufo", peso: 3, cor: "#5e7e40" }],
      luz: { cor: "#ffe0a0", alfa: 0.08, modo: "screen" }, vinheta: { cor: "#1a1408", forca: 0.24 }, sombra: "#2a3a3a",
      particulas: { tipo: "borboleta", cor: "#f6efdc", max: 15 },
      trilhas: TRILHAS_CAPITULO,
      hubs: [{ x: 11, y: 52, raio: 3, tipo: "rede" }],
    },
  };

  // -------------------------------------------------------------------
  // Obstáculos (§5.3): altos 18×26 (arte 16×24), baixos 18×18.
  // A base da arte fica na penúltima linha; a última é margem.
  // Cada quadro é uma variante de forma.
  // -------------------------------------------------------------------
  function copa(g, cx, cy, rx, ry, rampa, semente, recorte = 0.22) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, r = nx * nx + ny * ny;
        const borda = 1 + (hash2(x, y, semente) - 0.5) * recorte * 2;
        if (r > borda) continue;
        const l = -(0.5 * nx + 0.85 * ny) + (hash2(x >> 1, y, semente + 1) - 0.5) * 0.35;
        g.p(x, y, tom(rampa, l));
      }
  }
  function rocha(g, x0, y0, w, h, rampa, semente, { topo = null, estratos = null, veio = null } = {}) {
    const cx = x0 + w / 2, cy = y0 + h / 2;
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const nx = (x + 0.5 - cx) / (w / 2), ny = (y + 0.5 - cy) / (h / 2);
        const canto = Math.abs(nx) ** 3 + Math.abs(ny) ** 3;
        if (canto > 1 + (hash2(x, y, semente) - 0.5) * 0.3 || (y === y0 + h - 1 && Math.abs(nx) > 0.8)) continue;
        let c = tom(rampa, -(0.55 * nx + 0.85 * ny) + 0.1);
        if (estratos && (y - y0) % 3 === 2 && ny > -0.6) c = rampa[Math.max(0, rampa.indexOf(c) - 1)];
        if (topo && ny < -0.55) c = topo;
        if (veio && Math.abs((x - x0) - (y - y0) * 0.8 - w * 0.2) < 0.6 && ny > -0.7) c = veio;
        g.p(x, y, c);
      }
  }
  function tronco(g, x, yBase, yTopo, cores, largura = 2) {
    for (let y = yTopo; y <= yBase; y++) {
      const ondula = Math.round(Math.sin(y * 0.7) * 0.6);
      g.p(x + ondula, y, cores[1]);
      if (largura > 1) g.p(x + ondula + 1, y, cores[0]);
    }
    g.p(x - 1, yBase, cores[1]); g.p(x + 2, yBase, cores[0]);
  }
  function obstaculo(chave, alto, variantes, desenhar) {
    return registrar(chave, {
      w: 18, h: alto ? 26 : 18, quadros: variantes, alto, obstaculo: true, origem: [0.5, 1],
      desenhar(g, v) { desenhar(g, v, alto ? 24 : 16); },
    });
  }

  // Canaã
  obstaculo("ob_canaan_oliveira", true, 3, (g, v, b) => {
    g.sombra(11, b, 6.5, 1.6);
    const tr = ["#4a321f", "#6b4a2e"];
    tronco(g, 8, b, 13, tr);
    g.p(10, 15, tr[1]); g.p(11, 14, tr[1]);
    const cp = ["#4a5f2e", "#5f7a3a", "#7d9548", "#a3b468"], s = 30 + v;
    const o = v === 1 ? 1 : 0;
    copa(g, 5.5 + o, 9, 4.2, 3.6, cp, s);
    copa(g, 11.5 - o, 8, 4.4, 4, cp, s + 3);
    copa(g, 8.5, 11.5 + (v === 2 ? 1 : 0), 5.6, 3.4, cp, s + 6);
    for (let i = 0; i < 6; i++) {
      const x = 3 + Math.floor(hash2(i, v, 11) * 12), y = 5 + Math.floor(hash2(i, v, 12) * 8);
      if (g.g(x, y)) g.p(x, y, "#b9c08a");
    }
  });
  obstaculo("ob_canaan_muro", false, 2, (g, v, b) => {
    g.sombra(10, b, 8, 1.3);
    const P = ["#6e5a40", "#9c8460", "#c2ab82", "#d8c8a0"];
    for (let fila = 0; fila < 3; fila++) {
      const y0 = b - 11 + fila * 4;
      let x = 1 + ((fila + v) % 2) * 2;
      if (fila === 0) x = 1;
      while (x < 17) {
        const w = Math.min(17 - x, 3 + Math.floor(hash2(x, fila, 40 + v) * 3));
        g.ret(x, y0, w, 3, (px, py) => (py === y0 ? P[3] : py === y0 + 2 ? P[1] : px === x ? P[2] : P[2]));
        g.p(x + w - 1, y0 + 1, P[1]);
        g.ret(x + w, y0, 1, 3, P[0]);
        x += w + 1;
      }
      g.lin(1, y0 + 3, 16, y0 + 3, P[0]);
    }
    for (let x = 1; x < 17; x++) if (hash2(x, v, 41) < 0.35) g.p(x, b - 12, "#6e8a3a");
  });
  obstaculo("ob_canaan_rocha", false, 2, (g, v, b) => {
    g.sombra(10, b, 7, 1.3);
    rocha(g, 2 + v, b - 9, 13 - v, 10, ["#7c7466", "#a39b8a", "#c8c0ac"], 50 + v);
    for (let x = 3 + v; x < 9; x++) for (let y = b - 9; y < b - 7; y++) if (g.g(x, y) && hash2(x, y, 51) < 0.7) g.p(x, y, "#6e8a3a");
  });

  // Deserto
  obstaculo("ob_deserto_rocha", false, 3, (g, v, b) => {
    const dim = [[14, 12], [12, 9], [16, 14]][v];
    g.sombra(10, b, dim[0] / 2 + 1, 1.4);
    rocha(g, Math.round(9 - dim[0] / 2), b - dim[1] + 1, dim[0], dim[1], ["#6e4228", "#96532f", "#c47a45", "#e0a16a"], 60 + v, { topo: "#edc08a", estratos: true });
  });
  obstaculo("ob_deserto_acacia", true, 2, (g, v, b) => {
    g.sombra(11, b, 6, 1.5);
    const tr = ["#4a3222", "#6b4a2e"];
    g.lin(8, b, 8, 12, tr[1]); g.lin(9, b, 9, 13, tr[0]);
    g.lin(8, 12, 5, 8, tr[1]); g.lin(9, 12, 12, 8, tr[0]);
    const cp = ["#5a6a2e", "#8a8f4a", "#a8a85e"];
    for (let y = 4 + v; y <= 8 + v; y++) {
      const meia = y === 4 + v ? 5 : y === 8 + v ? 6 : 7;
      for (let x = 9 - meia; x <= 8 + meia; x++) if (hash2(x, y, 70) > 0.08) g.p(x, y, y === 4 + v ? cp[2] : y >= 7 + v ? cp[0] : hash2(x, y, 71) < 0.3 ? cp[2] : cp[1]);
    }
  });
  obstaculo("ob_deserto_retama", false, 2, (g, v, b) => {
    g.sombra(10, b, 6, 1.2);
    const c = ["#5a5630", "#8c8450", "#a8a068"];
    for (let i = 0; i < 9; i++) {
      const x = 4 + i + (i > 4 ? v : 0), alt = 5 + Math.floor(hash2(i, v, 80) * 5);
      g.lin(x, b, x + (i % 3 === 0 ? -1 : 0), b - alt, i % 2 ? c[1] : c[0]);
      g.p(x + (i % 3 === 0 ? -1 : 0), b - alt, c[2]);
    }
  });
  obstaculo("ob_deserto_tenda", true, 1, (g, v, b) => {
    g.sombra(11, b, 8, 1.6);
    const c = ["#3a2c24", "#4a3a30", "#6a5646"];
    for (let y = b - 13; y <= b; y++) {
      const t = (y - (b - 13)) / 13, meia = Math.round(4 + t * 4);
      for (let x = 9 - meia; x <= 8 + meia; x++) {
        let cor = x < 9 - meia + 2 ? c[2] : x > 8 + meia - 2 ? c[0] : c[1];
        if ((y - b) % 4 === 0) cor = "#8a7a68";
        g.p(x, y, cor);
      }
    }
    g.ret(7, b - 6, 4, 7, "#1c1210"); g.ret(8, b - 7, 2, 1, "#1c1210");
    g.lin(16, b, 16, b - 15, "#6b4a2e"); g.lin(9, b - 14, 16, b - 15, "#c9a46a");
  });

  // Mar
  obstaculo("ob_mar_ilhota", true, 2, (g, v, b) => {
    g.elip(9, b - 2.5, 8, 3.5, (nx, ny) => (nx * nx + ny * ny > 0.7 ? "#e8f2e0" : tom(["#c9ad78", "#e0c48a", "#f0dcaa"], -(0.5 * nx + 0.9 * ny))));
    const tr = ["#6a4a2e", "#8a6a42"];
    for (let y = b - 3; y >= 8; y--) { const x = 7 + Math.round((b - 3 - y) * 0.25); g.p(x, y, tr[(y % 2)]); g.p(x + 1, y, tr[0]); }
    const tx = 7 + Math.round((b - 11) * 0.25), ty = 7;
    const f = ["#3e6a2e", "#5a8a3a", "#86ac4e"];
    const folhas = [[-6, 2], [-4, -3], [0, -4], [5, -2], [6, 3], [-2, 4]];
    folhas.forEach(([dx, dy], i) => { g.lin(tx, ty, tx + dx, ty + dy, f[i % 2 ? 1 : 2]); g.lin(tx, ty + 1, tx + dx, ty + dy + 1, f[0]); });
    g.p(tx, ty + 1, "#8e4a2a"); g.p(tx + 1, ty + 2, "#8e4a2a");
  });
  obstaculo("ob_mar_rochedo", false, 2, (g, v, b) => {
    g.elip(9, b - 1.5, 8, 2.2, "#e8f2e0");
    rocha(g, 3 + v, b - 11, 12 - v, 11, ["#4a4038", "#5d5048", "#7d6a4a", "#a8936a"], 90 + v);
    for (let x = 2; x < 16; x++) if (hash2(x, v, 91) < 0.5) g.p(x, b - 1, "#e8f2e0");
  });
  obstaculo("ob_mar_recife", false, 2, (g, v, b) => {
    g.elip(9, b - 3, 8, 3.6, "#4fa3a5");
    for (let i = 0; i < 7; i++) {
      const x = 3 + i * 2 + (v && i % 2), h = 2 + Math.floor(hash2(i, v, 95) * 4);
      g.lin(x, b - 2, x, b - 2 - h, i % 2 ? "#a85a4a" : "#d07a5a"); g.p(x + 1, b - 2 - h + 1, "#d07a5a");
    }
  });

  // Egito
  obstaculo("ob_egito_tamareira", true, 2, (g, v, b) => {
    g.sombra(11, b, 6, 1.5);
    const tr = ["#6a4a2e", "#8a6a42"];
    for (let y = b; y >= 8; y--) { const x = 8 + (v && y < 14 ? 1 : 0); g.p(x, y, y % 2 ? tr[0] : tr[1]); g.p(x + 1, y, tr[0]); }
    const tx = 8.5 + v, ty = 6;
    const f = ["#4f6f2e", "#6a8a3a", "#9ab04a"];
    const arcos = [[-7, 4], [-5, 1], [-1, -4], [4, -2], [7, 2], [6, 6], [-6, 7]];
    arcos.forEach(([dx, dy], i) => {
      const n = 7;
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = tx + dx * t, y = ty + dy * t + t * t * 3 - 1;
        g.p(x, y, k > n - 2 ? f[0] : i % 2 ? f[1] : f[2]);
        if (k > 1 && k < n) g.p(x, y + 1, f[0]);
      }
    });
    g.ret(tx - 1, ty + 1, 3, 2, "#8e4a2a"); g.p(tx - 1, ty + 1, "#b5663a");
  });
  obstaculo("ob_egito_coluna", true, 1, (g, v, b) => {
    g.sombra(11, b, 6, 1.5);
    const P = ["#9a845c", "#c8b48a", "#e8dcbc"];
    g.ret(4, b - 1, 10, 2, P[0]); g.ret(4, b - 1, 10, 1, P[1]);
    g.ret(5, 6, 8, b - 6, (x) => (x <= 6 ? P[2] : x >= 11 ? P[0] : P[1]));
    for (const yb of [b - 6, 9]) {
      for (let x = 5; x < 13; x++) g.p(x, yb + ((x % 2) ? 0 : 1), x % 4 < 2 ? "#3b5a9a" : "#b8503a");
    }
    // capitel em leque
    for (let y = 1; y <= 5; y++) { const m = 3 + y; g.ret(9 - m, y, m * 2, 1, y === 1 ? P[2] : y % 2 ? P[1] : "#7a9a5a"); }
    g.ret(3, 5, 12, 1, P[0]);
  });
  obstaculo("ob_egito_tijolos", false, 2, (g, v, b) => {
    g.sombra(10, b, 7.5, 1.3);
    const c = ["#87502f", "#a8683f", "#c8865a"];
    const filas = v ? [[2, 4], [3, 3], [5, 1]] : [[1, 4], [2, 3], [4, 2]];
    filas.forEach(([x0, n], i) => {
      const y = b - 2 - i * 3;
      for (let k = 0; k < n; k++) {
        const x = x0 + k * 4 + (i % 2) * 1;
        g.ret(x, y, 4, 3, (px, py) => (py === y ? c[2] : px === x + 3 ? c[0] : c[1]));
      }
    });
    const topo = b - 2 - (filas.length - 1) * 3 - 1;
    for (let x = filas[2][0]; x < filas[2][0] + filas[2][1] * 4 + 1; x++) if (hash2(x, v, 101) < 0.7) g.p(x, topo, "#d8c070");
  });
  obstaculo("ob_egito_jarros", false, 2, (g, v, b) => {
    g.sombra(10, b, 7, 1.3);
    const c = ["#6a3420", "#8e4a2a", "#b5663a", "#d88a58"];
    g.elip(6, b - 5, 3.6, 5, esfera(c));
    g.ret(5, b - 11, 3, 2, c[1]); g.ret(5, b - 11, 3, 1, "#2a1a14");
    g.elip(12, b - 3, 3, 3.3, esfera(c));
    g.ret(11, b - 7, 2, 1, "#2a1a14");
    g.lin(4, b - 6, 8, b - 6, c[0]);
  });

  // Mar Vermelho
  obstaculo("ob_marVermelho_granito", false, 2, (g, v, b) => {
    g.sombra(10, b, 7, 1.3);
    const c = ["#5a2a20", "#7a3426", "#a5503a", "#c87a58"];
    for (let y = b - 11; y <= b; y++) for (let x = 2; x < 16; x++) {
      const lim = (y - (b - 11)) * (v ? 1.4 : 1.1);
      if (x < 9 - lim || x > 9 + lim * 0.8 + 2) continue;
      let cor = x < 9 - lim + 2 ? c[3] : y < b - 8 ? c[2] : x > 9 + lim * 0.6 ? c[0] : c[1];
      if (Math.abs(x - 6 - (y - (b - 11)) * 0.7) < 0.5) cor = c[0];
      g.p(x, y, cor);
    }
  });
  obstaculo("ob_marVermelho_coral", false, 2, (g, v, b) => {
    g.sombra(10, b, 6, 1.2);
    const c = ["#8a3a30", "#c8604c", "#e08a6a"];
    const galhos = (x, y, ang, n, prof) => {
      if (prof > 3 || n < 1) return;
      let px = x, py = y;
      for (let i = 0; i < n; i++) { px += Math.cos(ang); py += Math.sin(ang); g.p(px, py, prof === 0 ? c[0] : prof === 1 ? c[1] : c[2]); }
      galhos(px, py, ang - 0.6, n - 1, prof + 1);
      galhos(px, py, ang + 0.6, n - 1, prof + 1);
    };
    galhos(9 + v, b, -Math.PI / 2, 4, 0);
    g.ret(7 + v, b - 1, 4, 2, c[0]);
  });
  obstaculo("ob_marVermelho_destrocos", false, 2, (g, v, b) => {
    g.sombra(10, b, 7.5, 1.2);
    const c = ["#5e4630", "#8a6a4a", "#a8865e"];
    g.lin(1, b - 2, 12, b - 6 + v, c[1]); g.lin(1, b - 1, 12, b - 5 + v, c[0]); g.lin(2, b - 3, 11, b - 7 + v, c[2]);
    g.lin(5, b, 16, b - 2, c[1]); g.lin(5, b - 1, 16, b - 3, c[2]);
    g.elip(13, b - 7, 2.6, 2.6, (nx, ny) => (nx * nx + ny * ny > 0.4 ? c[0] : null));
    g.p(13, b - 7, c[2]); g.lin(13, b - 7, 11, b - 4, c[0]);
  });

  // Sinai
  obstaculo("ob_sinai_penedo", false, 2, (g, v, b) => {
    const dim = [[16, 14], [12, 10]][v];
    g.sombra(10, b, dim[0] / 2 + 1, 1.4);
    rocha(g, Math.round(9 - dim[0] / 2), b - dim[1] + 1, dim[0], dim[1], ["#4e302a", "#6a4038", "#8a5a4a", "#b07a62"], 120 + v, { veio: "#d0a080" });
  });
  obstaculo("ob_sinai_arbusto", false, 1, (g, v, b) => {
    g.sombra(10, b, 6, 1.2);
    copa(g, 9, b - 4, 5.5, 4, ["#3e4a2a", "#5a6a3a", "#7a8a4a"], 130, 0.3);
    for (let i = 0; i < 8; i++) { const x = 4 + Math.floor(hash2(i, 1, 131) * 11), y = b - 8 + Math.floor(hash2(i, 2, 131) * 3); if (!g.g(x, y)) g.p(x, y, "#7a8a4a"); }
  });
  obstaculo("ob_sinai_marco", false, 1, (g, v, b) => {
    g.sombra(10, b, 5, 1.2);
    const c = ["#6a5a4a", "#8a7a6a", "#a89a88"];
    rocha(g, 4, b - 3, 10, 4, c, 140);
    rocha(g, 5, b - 7, 8, 4, c, 141);
    rocha(g, 6, b - 10, 6, 3, c, 142);
    rocha(g, 7, b - 13, 4, 3, c, 143);
  });
  obstaculo("ob_sinai_acacia", true, 1, (g, v, b) => {
    g.sombra(11, b, 6, 1.5);
    const tr = ["#4a3222", "#6b4a2e"];
    g.lin(8, b, 8, 12, tr[1]); g.lin(9, b, 9, 12, tr[0]);
    g.lin(8, 12, 4, 6, tr[1]); g.lin(9, 12, 13, 5, tr[0]); g.lin(8, 9, 9, 4, tr[1]);
    g.lin(4, 6, 2, 5, tr[1]); g.lin(13, 5, 15, 4, tr[0]);
    for (const [x, y] of [[3, 4], [5, 5], [12, 3], [14, 4], [9, 3], [10, 3]]) g.p(x, y, "#7a7a40");
  });

  // Galileia
  obstaculo("ob_galileia_figueira", true, 2, (g, v, b) => {
    g.sombra(11, b, 7, 1.6);
    const tr = ["#3e2c20", "#5a4030"];
    tronco(g, 8, b, 13, tr);
    const cp = ["#3a5e2a", "#4f7a34", "#6e9a48", "#8ab45e"];
    copa(g, 8.5, 9.5, 7.6, 5.4, cp, 150 + v, 0.18);
    for (let i = 0; i < 5; i++) { const x = 3 + Math.floor(hash2(i, v, 152) * 12), y = 6 + Math.floor(hash2(i, v, 153) * 6); if (g.g(x, y)) { g.p(x, y, cp[3]); g.p(x + 1, y + 1, cp[0]); } }
    for (const [x, y] of [[5, 11], [11, 9], [9, 13]]) g.p(x + v, y, "#5a2e5a");
  });
  obstaculo("ob_galileia_basalto_muro", false, 2, (g, v, b) => {
    g.sombra(10, b, 8, 1.3);
    // Basalto preto (guia §3.3): pedra no tom escuro da rampa, juntas no
    // mais escuro e realce claro só no canto de cima/esquerda (luz do oeste).
    const c = ["#262422", "#363432", "#4c4a48", "#6e6a64"];
    for (let fila = 0; fila < 3; fila++) {
      const y0 = b - 11 + fila * 4;
      let x = 1 + ((fila + v) % 2) * 2;
      if (fila === 0) x = 1;
      while (x < 17) {
        const w = Math.min(17 - x, 3 + Math.floor(hash2(x, fila, 160 + v) * 3));
        g.ret(x, y0, w, 3, (px, py) => (py === y0 ? (px === x ? c[3] : c[2]) : px === x ? c[2] : c[1]));
        g.ret(x + w, y0, 1, 3, c[0]);
        x += w + 1;
      }
      g.lin(1, y0 + 3, 16, y0 + 3, c[0]);
    }
  });
  obstaculo("ob_galileia_basalto", false, 2, (g, v, b) => {
    g.sombra(10, b, 7, 1.3);
    rocha(g, 2 + v, b - 9, 13 - v, 10, ["#262422", "#363432", "#4c4a48", "#6e6a64"], 170 + v);
    // vesículas do basalto: furinhos escuros
    for (let i = 0; i < 6; i++) { const x = 4 + Math.floor(hash2(i, v, 171) * 9), y = b - 7 + Math.floor(hash2(i, v, 172) * 6); if (g.g(x, y)) g.p(x, y, "#262422"); }
  });
  obstaculo("ob_galileia_barco", false, 1, (g, v, b) => {
    g.sombra(10, b, 8.5, 1.3);
    const c = ["#4a3222", "#6e4a28", "#9a6a3c", "#b8875a"];
    // casco emborcado: cúpula baixa com tábuas horizontais e quilha clara
    for (let y = b - 6; y <= b; y++) {
      const t = (y - (b - 7)) / 7, meia = Math.round(3 + Math.sqrt(t) * 5);
      for (let x = 9 - meia; x < 9 + meia; x++) {
        const l = -((x - 9) / meia) * 0.5 - (1 - t) * 0.6;
        g.p(x, y, (y - b) % 2 === 0 ? c[0] : tom(c, l));
      }
    }
    g.lin(4, b - 7, 13, b - 7, c[3]);
    g.p(3, b - 7, c[2]); g.p(14, b - 7, c[1]);
  });
  // Estandarte vermelho num mastro (hub do Sinai, em casa bloqueada).
  obstaculo("ob_sinai_estandarte", true, 1, (g, v, b) => {
    g.sombra(10, b, 4, 1.2);
    rocha(g, 6, b - 3, 6, 4, ["#6a5a4a", "#8a7a6a", "#a89a88"], 180);
    g.lin(8, b - 3, 8, 2, "#6b4a2e"); g.p(8, 1, "#e8b94a");
    g.ret(9, 3, 6, 7, (x, y) => (x === 9 ? "#8e2a1f" : y === 3 ? "#d04a3a" : "#b03a2e"));
    g.p(14, 10, "#b03a2e"); g.p(12, 10, "#b03a2e");
  });

  // Tipo de obstáculo por casa (peso por hash) e regras especiais.
  function tipoObstaculo(area, x, y) {
    const bio = BIOMAS[area];
    if (!bio) return null;
    if (area === "deserto" && x === 70 && y === 14) return { chave: "fx_fogueira", alto: false, animado: 3 };
    if (area === "sinai" && x === 9 && y === 54) return { chave: "ob_sinai_estandarte", alto: true };
    if (area === "deserto") {
      for (const n of [[68, 8], [72, 10]]) if (Math.max(Math.abs(x - n[0]), Math.abs(y - n[1])) <= 6 && hash2(x, y, 6) < 0.8) return { chave: "ob_deserto_tenda", alto: true };
    }
    const lista = bio.obstaculos.filter((o) => !(area === "galileia" && o.tipo === "barco" && Math.max(Math.abs(x - 9), Math.abs(y - 52)) > 8));
    const total = lista.reduce((s, o) => s + o.peso, 0);
    let r = hash2(x, y, 3) * total;
    for (const o of lista) {
      r -= o.peso;
      if (r <= 0) return { chave: `ob_${area}_${o.tipo}`, alto: !!o.alto };
    }
    const o = lista[lista.length - 1];
    return { chave: `ob_${area}_${o.tipo}`, alto: !!o.alto };
  }

  // -------------------------------------------------------------------
  // Tileset por área (§5.2): 8 colunas × 13 linhas de tiles
  //   0–3 chão · 4–5 mancha · 6–7 detalhe raro · 8–23 caminho (4 bits)
  //   24–39 costa/muralha (animado) · 40–43 água · 44–47 rota (animado)
  //   48–63 borda (4 bits) · 64–79 decoração · 80–87 moldura externa
  //   96–99 sombras de contato · 104–119 mancha em autotile (4 bits)
  // -------------------------------------------------------------------
  const TS_COLS = 8, TS_LINHAS = 15;
  const ID = { CHAO: 0, MANCHA: 4, RARO: 6, CAMINHO: 8, COSTA: 24, AGUA: 40, ROTA: 44, BORDA: 48, DECO: 64, MOLDURA: 80, SOMBRA: 96, MANCHA4: 104 };

  class Pincel {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.buf = new Uint8ClampedArray(w * h * 4);
    }
    // tile i, posição local (x, y) em px-a
    set(i, x, y, cor, alfa = 1) {
      if (x < 0 || y < 0 || x >= T || y >= T || !cor) return;
      const tx = (i % TS_COLS) * T + x, ty = Math.floor(i / TS_COLS) * T + y;
      const o = (ty * this.w + tx) * 4, c = hexRgb(cor);
      const a = (c[3] / 255) * alfa;
      if (a >= 1 || this.buf[o + 3] === 0) {
        this.buf[o] = c[0]; this.buf[o + 1] = c[1]; this.buf[o + 2] = c[2]; this.buf[o + 3] = Math.round(a * 255);
      } else {
        this.buf[o] = this.buf[o] + (c[0] - this.buf[o]) * a;
        this.buf[o + 1] = this.buf[o + 1] + (c[1] - this.buf[o + 1]) * a;
        this.buf[o + 2] = this.buf[o + 2] + (c[2] - this.buf[o + 2]) * a;
        this.buf[o + 3] = Math.min(255, this.buf[o + 3] + a * 255);
      }
    }
    limpar(i) {
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const tx = (i % TS_COLS) * T + x, ty = Math.floor(i / TS_COLS) * T + y, o = (ty * this.w + tx) * 4;
        this.buf[o] = this.buf[o + 1] = this.buf[o + 2] = this.buf[o + 3] = 0;
      }
    }
    encher(i, cor) { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) this.set(i, x, y, cor); }
    grade(i, g, ox = 0, oy = 0) {
      const d = g.final();
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (d[y * g.w + x]) this.set(i, x + ox, y + oy, d[y * g.w + x]);
    }
  }

  // Salpicos em grupos horizontais de até 2 px-a (evita "ruído de TV").
  function salpicar(pin, i, n, cores, semente) {
    for (let k = 0; k < n; k++) {
      const x = Math.floor(hash2(i, k, semente) * 15), y = Math.floor(hash2(k, i, semente + 1) * 16);
      const c = cores[Math.floor(hash2(i + k, k, semente + 2) * cores.length)];
      pin.set(i, x, y, c);
      if (hash2(k, k, semente + 3) < 0.55) pin.set(i, x + 1, y, c);
    }
  }

  function pintarChao(pin, area, bio, semente) {
    const c = bio.chao, m = bio.mancha;
    for (let i = 0; i < 8; i++) {
      const mancha = i === 4 || i === 5;
      pin.encher(i, mancha ? m.base : c.base);
      salpicar(pin, i, 12, mancha ? [m.escuro, c.base, m.escuro] : [c.escuro, c.claro, c.escuro], semente + i * 7);
      if (mancha) {
        // borda pontilhada que se mistura com o chão base
        for (let k = 0; k < 16; k++) for (const [x, y] of [[k, 0], [k, 15], [0, k], [15, k]]) if ((x + y) % 2 === 0 && hash2(x, y, semente + i) < 0.6) pin.set(i, x, y, c.base);
      }
    }
    // variante 1: salpico; 2: tufo/ondulação; 3: pedrinha plana
    salpicar(pin, 1, area === "marVermelho" ? 2 : 6, [c.salpico], semente + 31);
    if (area === "deserto" || area === "marVermelho") {
      for (let x = 3; x < 13; x++) pin.set(2, x, 7 + Math.round(Math.sin(x * 0.8)), c.escuro);
      for (let x = 2; x < 9; x++) pin.set(2, x, 11 + Math.round(Math.sin(x * 0.8 + 1)), c.claro);
    } else {
      for (const [x, y] of [[5, 9], [6, 8], [7, 9], [8, 7], [9, 9], [10, 8]]) pin.set(2, x, y, c.escuro);
      pin.set(2, 8, 6, c.claro);
    }
    pin.set(3, 9, 9, c.claro); pin.set(3, 10, 9, c.claro); pin.set(3, 9, 10, c.escuro); pin.set(3, 10, 10, c.escuro); pin.set(3, 11, 10, c.escuro);
    // detalhes raros planos
    if (area === "egito") {
      for (const i of [4, 5]) for (let x = 0; x < 16; x++) for (const y of [3, 4, 11, 12]) if (hash2(x, y, i) < 0.85) pin.set(i, x, y, y % 8 < 4 ? m.escuro : c.salpico);
      for (let x = 1; x < 16; x += 3) { pin.set(6, x, 6, c.salpico); pin.set(6, x, 5, "#8a9a4a"); }
    } else if (area === "galileia") {
      for (let k = 0; k < 6; k++) { pin.set(4, Math.floor(hash2(k, 4, 5) * 15), Math.floor(hash2(4, k, 5) * 15), k % 2 ? "#e2c044" : "#b8a0d0"); pin.set(5, Math.floor(hash2(k, 5, 5) * 15), Math.floor(hash2(5, k, 5) * 15), "#e2c044"); }
      pin.set(6, 7, 7, "#d8443a"); pin.set(6, 8, 7, "#d8443a"); pin.set(6, 7, 8, "#e2c044");
    } else if (area === "marVermelho") {
      pin.set(6, 6, 8, "#f0e0d0"); pin.set(6, 7, 8, "#f0e0d0"); pin.set(6, 6, 9, "#dcb48a");
    } else {
      // rachadura
      let x = 4, y = 5;
      for (let k = 0; k < 7; k++) { pin.set(6, x, y, c.escuro); x += 1; y += hash2(k, 6, semente) < 0.5 ? 1 : 0; }
    }
    if (area === "canaan") { pin.set(7, 8, 8, "#efe6cf"); pin.set(7, 7, 8, "#efe6cf"); pin.set(7, 8, 9, "#e9d36a"); }
    else { pin.set(7, 6, 9, c.salpico); pin.set(7, 7, 9, c.salpico); pin.set(7, 10, 6, c.claro); }
  }

  // Mancha macro em autotile: lados sem vizinho de mancha esmaecem em
  // pontilhado (3 px-a) até o chão base — nada de quadrados visíveis.
  function pintarMancha(pin, area, bio, semente) {
    const c = bio.chao, m0 = bio.mancha;
    // no Egito os sulcos de plantio são mais suaves (faixas largas, pouco contraste)
    const m = area === "egito" ? { base: misturar(m0.base, c.base, 0.45), escuro: misturar(m0.escuro, c.base, 0.3) }
      : { base: misturar(m0.base, c.base, 0.3), escuro: m0.escuro };
    for (let mask = 0; mask < 16; mask++) {
      const i = ID.MANCHA4 + mask;
      const aberto = { n: !(mask & 1), l: !(mask & 2), s: !(mask & 4), o: !(mask & 8) };
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        let d = 99;
        if (aberto.n) d = Math.min(d, y);
        if (aberto.s) d = Math.min(d, 15 - y);
        if (aberto.o) d = Math.min(d, x);
        if (aberto.l) d = Math.min(d, 15 - x);
        const lim = d >= 6 ? 1 : (d + 0.5) / 6.5;
        const dentro = ruido((x + mask * 16) / 2, y / 2, semente + 5) * 0.6 + hash2(x + mask * 16, y, semente + 5) * 0.4 < lim;
        let cor = dentro ? m.base : c.base;
        if (area === "egito" && dentro && y % 8 === 3 && hash2(x, y, mask) < 0.7) cor = m.escuro;
        pin.set(i, x, y, cor);
      }
      salpicar(pin, i, 9, [m.escuro, c.escuro], semente + 300 + mask);
      // As flores do "campo de flores" da Galileia não ficam no tile da mancha
      // (todo tile interior tem a mesma máscara e repetiria as mesmas flores a
      // cada 32 px): saem como decoração rasteira sorteada por casa (indiceDeco).
    }
  }

  // Caminho em autotile: máscara N1 L2 S4 O8 de vizinhos que também são caminho.
  function pintarCaminho(pin, bio, semente) {
    const c = bio.caminho, chao = bio.chao.base;
    for (let mask = 0; mask < 16; mask++) {
      const i = ID.CAMINHO + mask;
      pin.encher(i, c.base);
      salpicar(pin, i, 10, [c.escuro, c.claro], semente + mask * 3);
      const aberto = { n: !(mask & 1), l: !(mask & 2), s: !(mask & 4), o: !(mask & 8) };
      for (let k = 0; k < 16; k++) {
        const lados = [["n", k, 0, k, 1], ["s", k, 15, k, 14], ["o", 0, k, 1, k], ["l", 15, k, 14, k]];
        for (const [lado, x0, y0, x1, y1] of lados) {
          if (!aberto[lado]) continue;
          pin.set(i, x0, y0, (x0 + y0) % 2 ? chao : c.borda);
          pin.set(i, x1, y1, c.borda);
        }
      }
    }
  }

  // Água: fases 0–3 (cada casa começa numa fase diferente).
  function pintarAgua(pin, i, agua, fase, t, clara = false) {
    const base = clara ? misturar(agua.base, agua.clara, 0.45) : agua.base;
    pin.encher(i, base);
    // 3 ondulações por tile (vale escuro + crista clara), em posições próprias
    // de cada tile; derivam 1 px-a a cada 2 fases (≈ 500 ms).
    for (let k = 0; k < 3; k++) {
      const x0 = Math.floor(hash2(i, k, 31) * 16), y0 = 2 + Math.floor(hash2(k, i, 32) * 12);
      const desl = Math.floor((t + hash2(i, k, 33) * 8) / 2) % 16;
      const len = 3 + (k % 2);
      for (let d = 0; d < len; d++) pin.set(i, (x0 + desl + d) % 16, y0, agua.escura);
      for (let d = 1; d < len - 1; d++) pin.set(i, (x0 + desl + d) % 16, y0 - 1, agua.clara);
    }
    if ((t + fase + i) % 7 < 2) pin.set(i, Math.floor(hash2(i, fase, 34) * 16), Math.floor(hash2(fase, i, 35) * 16), agua.brilho);
  }
  function pintarCosta(pin, bio, t) {
    const a = bio.agua;
    for (let mask = 0; mask < 16; mask++) {
      const i = ID.COSTA + mask;
      pintarAgua(pin, i, a, mask % 4, t);
      const terra = { n: mask & 1, l: mask & 2, s: mask & 4, o: mask & 8 };
      for (let k = 0; k < 16; k++) {
        const onda = (k + t) % 4 < 2;
        if (terra.n) { pin.set(i, k, 0, a.espuma); if (onda) pin.set(i, k, 1, a.espuma); }
        if (terra.s) { pin.set(i, k, 15, a.espuma); if (onda) pin.set(i, k, 14, a.espuma); pin.set(i, k, 13, a.clara); }
        if (terra.o) { pin.set(i, 0, k, a.espuma); if (onda) pin.set(i, 1, k, a.espuma); }
        if (terra.l) { pin.set(i, 15, k, a.espuma); if (onda) pin.set(i, 14, k, a.espuma); }
      }
    }
  }
  // Muralha de água (Mar Vermelho): faixas verticais que descem 1 px por quadro.
  function pintarMuralha(pin, bio, t) {
    const a = bio.agua, rampa = [a.profunda, a.escura, a.base, a.clara];
    const corpo = (i, ox) => {
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const faixa = Math.floor(hash2(x, 0, 200) * 4);
        const v = (y - t * 1 + faixa * 5 + 64) % 8;
        const l = (x < 3 ? 1 : x > 12 ? -1 : 0) * 0.3 + (v < 2 ? 0.5 : v < 5 ? 0 : -0.4);
        pin.set(i, x, y, tom(rampa, l));
      }
    };
    // 24: corpo (norte); 25: base norte (espuma + coral); 26: crista sul (espuma em cima); 27: corpo (sul)
    corpo(24); corpo(27);
    corpo(25);
    for (let x = 0; x < 16; x++) {
      const o = (x + t) % 3 === 0 ? 1 : 0;
      pin.set(25, x, 13 - o, a.espuma); pin.set(25, x, 14, a.espuma); pin.set(25, x, 15, hash2(x, 1, 201) < 0.5 ? "#d07a5a" : "#a85a4a");
    }
    corpo(26);
    for (let x = 0; x < 16; x++) {
      const o = (x + t) % 3 === 0 ? 1 : 0;
      pin.set(26, x, 0, "#a85a4a"); pin.set(26, x, 1, a.espuma); pin.set(26, x, 2 + o, a.espuma);
    }
  }

  // Borda do mapa (anel x=0/79, y=0/59): máscara de vizinhos que também são borda.
  function pintarBorda(pin, bio, area) {
    const tipo = bio.borda.tipo, r = bio.borda.rampa;
    for (let mask = 0; mask < 16; mask++) {
      const i = ID.BORDA + mask;
      const aberto = { n: !(mask & 1), l: !(mask & 2), s: !(mask & 4), o: !(mask & 8) };
      if (tipo === "sebe" || tipo === "duna") {
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
          const n = ruido(x / 3, y / 3, 210 + mask);
          let l = (n - 0.5) * 1.6 - (y / 16 - 0.5) * 0.6 - (x / 16 - 0.5) * 0.3;
          if (aberto.s && y > 11) l -= 0.8;
          if (aberto.l && x > 11) l -= 0.6;
          if (tipo === "duna") l = Math.sin((x + y * 0.4) * 0.5) * 0.6 + (aberto.s && y > 11 ? -0.6 : 0.2);
          pin.set(i, x, y, tom(r, l));
        }
        if (tipo === "sebe") for (let k = 0; k < 5; k++) pin.set(i, Math.floor(hash2(k, mask, 211) * 16), Math.floor(hash2(mask, k, 211) * 12), r[3]);
      } else if (tipo === "mar_profundo") {
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) pin.set(i, x, y, ruido(x / 4, y / 4, 220) < 0.45 ? r[0] : r[1]);
        for (const lado of ["n", "s", "l", "o"]) if (aberto[lado]) for (let k = 0; k < 16; k++) {
          const [x, y] = lado === "n" ? [k, 0] : lado === "s" ? [k, 15] : lado === "o" ? [0, k] : [15, k];
          pin.set(i, x, y, r[2]);
          if (hash2(k, mask, 221) < 0.15) pin.set(i, x, y, "#5d5048");
        }
      } else if (tipo === "praia_granito") {
        pin.encher(i, "#c49a72");
        for (let k = 0; k < 4; k++) {
          const cx = 3 + Math.floor(hash2(k, mask, 230) * 10), cy = 3 + Math.floor(hash2(mask, k, 230) * 10);
          const g = new Grade(16, 16);
          rocha(g, cx - 3, cy - 3, 7, 6, r, 231 + k);
          pin.grade(i, g);
        }
      } else {
        // muros (tijolo, basalto) e paredão
        const juntas = tipo === "muro_basalto" ? r[0] : tipo === "paredao" ? r[0] : "#4a2a18";
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
          let c;
          if (tipo === "paredao") {
            const n = ruido(x / 3, y / 5, 240 + mask);
            c = tom(r, (n - 0.5) * 1.8 - (x / 16 - 0.5) * 0.4);
            if (Math.abs(x - y * 0.6 - 4) < 0.5 || Math.abs(x + y * 0.3 - 13) < 0.5) c = r[0];
          } else {
            const fila = Math.floor(y / 4), dx = (x + (fila % 2) * 3) % 6;
            if (tipo === "muro_basalto") {
              // pedra escura; realce claro só no canto de cima/esquerda
              c = y % 4 === 3 || dx === 5 ? juntas : y % 4 === 0 ? (dx === 0 ? r[3] : r[2]) : dx === 0 ? r[2] : r[1];
            } else c = y % 4 === 3 || dx === 5 ? juntas : y % 4 === 0 ? r[3] : dx === 0 ? r[2] : r[1];
          }
          pin.set(i, x, y, c);
        }
      }
      // face voltada para o interior: realce e sombra própria
      for (let k = 0; k < 16; k++) {
        if (aberto.s) { pin.set(i, k, 15, "#1c1210", 0.55); pin.set(i, k, 14, "#1c1210", 0.25); }
        if (aberto.l) { pin.set(i, 15, k, "#1c1210", 0.45); }
        if (aberto.n) pin.set(i, k, 0, r[3], 0.6);
        if (aberto.o) pin.set(i, 0, k, r[3], 0.5);
      }
    }
  }

  // Decoração rasteira (transparente; sem contorno). Até 16 variantes.
  // 16 variantes de decoração do bioma, repetidas conforme o peso.
  function listaDeco(bio) {
    const lista = [];
    for (const d of bio.deco) for (let k = 0; k < d.peso && lista.length < 16; k++) lista.push(d);
    while (lista.length < 16) lista.push(bio.deco[lista.length % bio.deco.length]);
    return lista;
  }
  const TIPOS_FLOR = new Set(["anemona", "flor_branca", "flor_amarela", "mostarda", "lirio"]);

  function pintarDeco(pin, bio, area) {
    listaDeco(bio).forEach((d, k) => {
      const i = ID.DECO + k, c = d.cor, ox = 3 + Math.floor(hash2(k, 1, 250) * 9), oy = 4 + Math.floor(hash2(k, 2, 250) * 8);
      const P = (x, y, cor = c, a = 1) => pin.set(i, ox + x, oy + y, cor, a);
      switch (d.tipo) {
        case "anemona": case "flor_branca": case "flor_amarela": case "mostarda": case "lirio":
          P(0, 2, "#55642c"); P(0, 1, c); P(-1, 1, c); P(1, 1, c); P(0, 0, c); P(0, 1, d.tipo === "anemona" ? "#2a1a14" : "#e9d36a");
          if (k % 2) { P(3, 3, "#55642c"); P(3, 2, c); P(4, 2, c); }
          break;
        case "tufo": case "tufo_seco": case "junco": case "broto":
          P(0, 2, c); P(1, 1, c); P(2, 2, c); P(1, 2, c); P(-1, 1, c, 0.8); if (d.tipo === "junco") { P(1, 0, c); P(1, -1, c); P(2, -2, "#a8865e"); }
          break;
        case "pedrinha": case "seixo":
          P(0, 0, misturar(c, "#ffffff", 0.25)); P(1, 0, c); P(0, 1, c); P(1, 1, misturar(c, "#000000", 0.25)); if (k % 2) { P(4, 2, c); P(5, 2, misturar(c, "#000000", 0.25)); }
          break;
        case "ondulacao":
          for (let x = 0; x < 6; x++) P(x - 2, Math.round(Math.sin(x)), c);
          break;
        case "pegadas":
          for (let n = 0; n < 3; n++) { P(n * 4 - 4, n % 2 ? 0 : 2, c); P(n * 4 - 3, n % 2 ? 0 : 2, c); }
          break;
        case "caco":
          P(0, 0, c); P(1, 0, c); P(0, 1, "#8e4a2a"); if (k % 2) { P(3, 1, "#d88a58"); P(4, 1, c); }
          break;
        case "concha":
          P(0, 0, c); P(1, 0, c); P(0, 1, "#d8c0b0"); P(1, 1, c); P(2, 1, "#d8c0b0");
          break;
        case "alga":
          P(0, 0, c); P(1, 1, c); P(2, 0, c); P(3, 1, "#4a5a34");
          break;
        case "poca":
          for (let x = -2; x < 3; x++) { P(x, 0, "#7a9aa0", 0.7); P(x, 1, "#5a7a80", 0.7); } P(-1, 0, "#e8f2e0", 0.8);
          break;
        case "liquen":
          P(0, 0, c); P(1, 0, c); P(1, 1, c); P(-1, 1, c, 0.7);
          break;
        case "cardume":
          for (let n = 0; n < 4; n++) { P(n * 2 - 3, n % 2, c, 0.8); }
          break;
        default:
          P(0, 0, c);
      }
    });
  }

  // Moldura externa: cenário fora do mapa (escurecida 15% para recuar).
  function pintarMoldura(pin, bio, area) {
    const esc = (cor) => misturar(cor, bio.vinheta.cor, 0.15);
    const pinta = (i, tipo, v) => {
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        let c;
        const n = ruido((x + v * 16) / 4, y / 4, 260 + v);
        switch (tipo) {
          case "colinas": {
            const r = area === "galileia" ? ["#4a6a3a", "#5a7a46", "#6a8c4c"] : ["#5a6a30", "#6a7a3a", "#7b9042"];
            c = tom(r, (n - 0.5) * 2);
            break;
          }
          case "dunas": {
            // ondulações horizontais contínuas entre tiles (períodos 16 em x e 8 em y)
            const onda = Math.sin(((y + 2 * Math.sin((2 * Math.PI * (x + v * 4)) / 16)) * 2 * Math.PI) / 8);
            c = tom(["#c49a5a", "#d0a868", "#dcb878"], onda * 0.7);
            break;
          }
          case "campos": c = (y + v) % 4 < 2 ? "#857344" : "#6f7a3a"; if (hash2(x, y, v) < 0.1) c = "#9a8650"; break;
          case "penhascos": c = tom(bio.borda.rampa, (n - 0.5) * 2 - 0.2); break;
          case "granito": c = tom(["#7a3426", "#a5503a", "#c49a72"], (n - 0.5) * 2); break;
          case "praia": c = tom(["#cfa863", "#e2c07c", "#efd598"], (n - 0.5) * 2); break;
          case "relva": c = tom(["#6a7e3a", "#7b9042", "#8fa34e"], (n - 0.5) * 2); break;
          default: c = tom([bio.borda.rampa[0], bio.borda.rampa[1]], (n - 0.5) * 2);
        }
        pin.set(i, x, y, esc(c));
      }
      if (tipo === "colinas" && v % 2 === 0) {
        const g = new Grade(16, 16), cx = v === 0 ? 5 : 10, cy = v === 0 ? 6 : 9;
        copa(g, cx, cy, 4, 3.4, ["#3e5228", "#4a5f2e", "#5f7a3a"].map(esc), 270 + v);
        g.p(cx, cy + 4, esc("#4a321f")); g.p(cx, cy + 5, esc("#4a321f"));
        pin.grade(i, g);
      }
    };
    // 80–83: tipo dos lados N/S genéricos; 84–87: leste/oeste (podem diferir)
    for (let v = 0; v < 4; v++) pinta(ID.MOLDURA + v, bio.moldura.sul, v);
    for (let v = 0; v < 2; v++) pinta(ID.MOLDURA + 4 + v, bio.moldura.oeste, v);
    for (let v = 0; v < 2; v++) pinta(ID.MOLDURA + 6 + v, bio.moldura.leste, v);
    for (let v = 0; v < 2; v++) pinta(ID.MOLDURA + 8 + v, bio.moldura.norte, v);
  }

  function pintarSombras(pin, bio) {
    const c = bio.sombra;
    for (let k = 0; k < 16; k++) {
      pin.set(ID.SOMBRA + 0, 2, k, c, 0.12); pin.set(ID.SOMBRA + 1, k, 2, c, 0.12);
      pin.set(ID.SOMBRA + 2, 2, k, c, 0.12); if (k > 2) pin.set(ID.SOMBRA + 2, k, 2, c, 0.12);
      pin.set(ID.SOMBRA + 0, 0, k, c, 0.25); pin.set(ID.SOMBRA + 0, 1, k, c, 0.25); // obstáculo a oeste
      pin.set(ID.SOMBRA + 1, k, 0, c, 0.25); pin.set(ID.SOMBRA + 1, k, 1, c, 0.25); // obstáculo ao norte
      pin.set(ID.SOMBRA + 2, 0, k, c, 0.25); pin.set(ID.SOMBRA + 2, 1, k, c, 0.25);
      if (k > 1) { pin.set(ID.SOMBRA + 2, k, 0, c, 0.25); pin.set(ID.SOMBRA + 2, k, 1, c, 0.25); }
    }
  }

  const cacheTileset = {};
  function gerarTileset(area) {
    if (cacheTileset[area]) return cacheTileset[area];
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const bio = BIOMAS[area] || BIOMAS.canaan;
    const semente = sementeDe(area);
    const pin = new Pincel(TS_COLS * T, TS_LINHAS * T);
    pintarChao(pin, area, bio, semente);
    pintarCaminho(pin, bio, semente);
    pintarMancha(pin, area, bio, semente);
    pintarBorda(pin, bio, area);
    pintarDeco(pin, bio, area);
    pintarMoldura(pin, bio, area);
    pintarSombras(pin, bio);
    const agua = bio.agua || BIOMAS.mar.agua;
    const animados = [];
    const temMuralha = bio.borda.norte === "muralha";
    if (temMuralha) animados.push((t) => pintarMuralha(pin, bio, t));
    else animados.push((t) => pintarCosta(pin, { agua }, t));
    animados.push((t) => { for (let f = 0; f < 4; f++) pintarAgua(pin, ID.AGUA + f, agua, f * 4, t); });
    animados.push((t) => { for (let f = 0; f < 4; f++) pintarAgua(pin, ID.ROTA + f, agua, f * 4, t, true); });
    for (const a of animados) a(0);

    const mapa = typeof mapas !== "undefined" ? mapas[area] : null;
    const COLSm = typeof COLS !== "undefined" ? COLS : 80, ROWSm = typeof ROWS !== "undefined" ? ROWS : 60;
    const ehBorda = (x, y) => x <= 0 || y <= 0 || x >= COLSm - 1 || y >= ROWSm - 1;
    // casas de caminho
    const caminho = new Set();
    for (const [y, x0, x1] of bio.trilhas.linhas) for (let x = x0; x <= x1; x++) if (mapa && !mapa[y][x]) caminho.add(x + "," + y);
    for (const [x, y0, y1] of bio.trilhas.colunas) for (let y = y0; y <= y1; y++) if (mapa && !mapa[y][x]) caminho.add(x + "," + y);
    const ehCaminho = (x, y) => caminho.has(x + "," + y);
    // enseada do cais (Canaã e Deserto): água na borda norte em torno de x=40
    const temEnseada = area === "canaan" || area === "deserto";
    const enseada = (x, y) => temEnseada && y <= 0 && x >= 37 && x <= 43;
    const ehAguaBorda = (x, y) => {
      if (enseada(x, y)) return true;
      if (y <= 0 && bio.borda.norte === "agua") return true;
      return false;
    };
    const ehMuralha = (x, y) => temMuralha && (y <= 0 || y >= ROWSm - 1);

    // mancha: ruído de baixa frequência; caminho e borda nunca são mancha
    const ehMancha = (x, y) => {
      if (area === "mar" || x <= 0 || y <= 0 || x >= COLSm - 1 || y >= ROWSm - 1 || ehCaminho(x, y)) return false;
      const r = area === "egito" ? ruido(x / 10, y / 2, semente) : ruido(x / 6, y / 6, semente);
      return r > 0.62;
    };
    function indice(x, y) {
      // moldura externa
      if (x < 0 || y < 0 || x >= COLSm || y >= ROWSm) {
        if (ehAguaBorda(x, Math.min(y, 0)) && y < 0) return ID.AGUA + Math.floor(hash2(x, y, 2) * 4);
        if (ehMuralha(x, y)) return y < 0 ? ID.COSTA + 0 : ID.COSTA + 3;
        const v = Math.floor(hash2(x, y, 8) * 4);
        if (y < 0 && x >= 0 && x < COLSm) return bio.moldura.norte === bio.moldura.sul ? ID.MOLDURA + v : ID.MOLDURA + 8 + (v % 2);
        if (x < 0) return ID.MOLDURA + 4 + (v % 2);
        if (x >= COLSm) return ID.MOLDURA + 6 + (v % 2);
        if (y < 0) return ID.MOLDURA + 8 + (v % 2);
        return ID.MOLDURA + v;
      }
      if (ehBorda(x, y)) {
        if (ehMuralha(x, y)) return y <= 0 ? ID.COSTA + 1 : ID.COSTA + 2;
        if (ehAguaBorda(x, y)) {
          // costa: espuma nos lados com terra
          let m = 0;
          if (!ehAguaBorda(x, y + 1)) m |= 4;
          if (x > 0 && !ehAguaBorda(x - 1, y)) m |= 8;
          if (x < COLSm - 1 && !ehAguaBorda(x + 1, y)) m |= 2;
          return ID.COSTA + m;
        }
        const viz = (xx, yy) => (xx < 0 || yy < 0 || xx >= COLSm || yy >= ROWSm || (ehBorda(xx, yy) && !ehAguaBorda(xx, yy)) ? 1 : 0);
        const m = viz(x, y - 1) | (viz(x + 1, y) << 1) | (viz(x, y + 1) << 2) | (viz(x - 1, y) << 3);
        return ID.BORDA + m;
      }
      if (area === "mar") return y === 30 ? ID.ROTA + Math.floor(hash2(x, y, 2) * 4) : ID.AGUA + Math.floor(hash2(x, y, 2) * 4);
      if (ehCaminho(x, y)) {
        const m = (ehCaminho(x, y - 1) ? 1 : 0) | (ehCaminho(x + 1, y) ? 2 : 0) | (ehCaminho(x, y + 1) ? 4 : 0) | (ehCaminho(x - 1, y) ? 8 : 0);
        return ID.CAMINHO + m;
      }
      if (ehMancha(x, y)) {
        const m = (ehMancha(x, y - 1) ? 1 : 0) | (ehMancha(x + 1, y) ? 2 : 0) | (ehMancha(x, y + 1) ? 4 : 0) | (ehMancha(x - 1, y) ? 8 : 0);
        return ID.MANCHA4 + m;
      }
      if (hash2(x, y, 9) < 0.04) return ID.RARO + (hash2(x, y, 10) < 0.5 ? 0 : 1);
      const r = hash2(x, y, 1);
      return r < 0.55 ? 0 : r < 0.7 ? 1 : r < 0.85 ? 2 : 3;
    }
    // variantes de flor (para o campo de flores da Galileia)
    const variantesFlor = listaDeco(bio).map((d, k) => (TIPOS_FLOR.has(d.tipo) ? k : -1)).filter((k) => k >= 0);
    function indiceDeco(x, y, proibido) {
      if (!mapa || x < 1 || y < 1 || x >= COLSm - 1 || y >= ROWSm - 1 || mapa[y][x]) return -1;
      if (area === "mar") return hash2(x, y, 7) < 0.015 ? ID.DECO : -1;
      if (ehCaminho(x, y) || (proibido && proibido(x, y))) return -1;
      // Galileia: a mancha é um campo de flores; cada casa sorteia a sua flor
      // (variante com posição própria), sem padrão de papel de parede.
      if (area === "galileia" && variantesFlor.length && ehMancha(x, y)) {
        if (hash2(x, y, 7) >= 0.3) return -1;
        return ID.DECO + variantesFlor[Math.floor(hash2(x, y, 13) * variantesFlor.length)];
      }
      let p = 0.07;
      for (const h of bio.hubs) if (Math.max(Math.abs(x - h.x), Math.abs(y - h.y)) <= h.raio) p = 0.15;
      if (hash2(x, y, 7) >= p) return -1;
      return ID.DECO + Math.floor(hash2(x, y, 12) * 16);
    }
    function indiceSombra(x, y) {
      if (!mapa || x < 1 || y < 1 || x >= COLSm - 1 || y >= ROWSm - 1 || mapa[y][x]) return -1;
      if (area === "mar") return -1;
      // só a borda do mapa projeta faixa de sombra (os obstáculos têm sombra própria)
      const o = x - 1 === 0 && !ehAguaBorda(x - 1, y), n = y - 1 === 0 && !ehAguaBorda(x, y - 1);
      if (o && n) return ID.SOMBRA + 2;
      if (o) return ID.SOMBRA;
      if (n) return ID.SOMBRA + 1;
      return -1;
    }

    // Canvas final (escala 2), pintado a partir do buffer em px-a.
    const final = novoCanvas(TS_COLS * T * PX, TS_LINHAS * T * PX);
    const ctx = final.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const mini = novoCanvas(pin.w, pin.h);
    const mctx = mini.getContext("2d");
    const enviar = (indices) => {
      const img = mctx.createImageData(pin.w, pin.h);
      img.data.set(pin.buf);
      mctx.putImageData(img, 0, 0);
      if (!indices) {
        ctx.clearRect(0, 0, final.width, final.height);
        ctx.drawImage(mini, 0, 0, final.width, final.height);
        return;
      }
      for (const i of indices) {
        const sx = (i % TS_COLS) * T, sy = Math.floor(i / TS_COLS) * T;
        ctx.clearRect(sx * PX, sy * PX, T * PX, T * PX);
        ctx.drawImage(mini, sx, sy, T, T, sx * PX, sy * PX, T * PX, T * PX);
      }
    };
    enviar(null);
    const indicesAnimados = [];
    for (let i = ID.COSTA; i < ID.BORDA; i++) indicesAnimados.push(i);
    const ts = {
      canvas: final, indice, indiceDeco, indiceSombra, largura: TS_COLS, altura: TS_LINHAS, desloc: 4,
      ehCaminho, enseada: temEnseada,
      animar(t) {
        for (const i of indicesAnimados) pin.limpar(i);
        for (const a of animados) a(t);
        enviar(indicesAnimados);
      },
      ms: 0,
    };
    ts.ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
    cacheTileset[area] = ts;
    return ts;
  }

  function minimapaCores(area) {
    const bio = BIOMAS[area] || BIOMAS.canaan;
    const p = (c) => misturar(c, "#e6cf9c", 0.35);
    const agua = (bio.agua || BIOMAS.mar.agua).base;
    return {
      chao: p(area === "mar" ? agua : bio.chao.base),
      // No mar a rota (linha 30) é a faixa clara de espuma, como na tela.
      caminho: p(area === "mar" ? bio.agua.brilho : bio.caminho.base),
      obstaculo: p(area === "mar" ? "#c9ad78" : bio.borda.rampa[1]),
      agua: p(agua),
      borda: p(bio.borda.rampa[0]),
      fundo: "#e6cf9c",
    };
  }

  // -------------------------------------------------------------------
  // Portais por área (estandarte na cor do chão do destino)
  // -------------------------------------------------------------------
  for (const area of Object.keys(BIOMAS)) {
    const r = BIOMAS[area].borda.rampa;
    const pedra = area === "mar" ? ["#4a4038", "#5d5048", "#7d6a4a", "#a8936a"] : [r[0], r[1], r[2], r[3]];
    for (const destino of Object.keys(BIOMAS)) registrarPortal(`mk_portal_${area}_${destino}`, pedra, BIOMAS[destino].chao.base);
  }

  // -------------------------------------------------------------------
  // Validação dos padrões (§6.1): largura das linhas, cores definidas
  // e no máximo 12 cores por sprite (6 por glifo de UI).
  // -------------------------------------------------------------------
  function validar() {
    const problemas = [];
    for (const [chave, def] of Object.entries(PIXEL_PATTERNS)) {
      const conjuntos = def.quadrosLinhas || (def.linhas ? [def.linhas] : []);
      for (const linhas of conjuntos) {
        linhas.forEach((l, i) => { if (l.length !== def.w) problemas.push(`${chave}: linha ${i} com ${l.length} != ${def.w}`); });
        for (const l of linhas) for (const ch of l) if (ch !== "." && !def.cores[ch]) problemas.push(`${chave}: '${ch}' sem cor`);
      }
      const limite = chave.startsWith("ui_") ? 6 : chave.startsWith("fx_") ? 99 : 12;
      for (let q = 0; q < def.quadros; q++) {
        const px = pixels(chave, { quadro: q });
        const n = new Set(px.data.filter(Boolean)).size;
        if (n > limite) { problemas.push(`${chave}#${q}: ${n} cores`); break; }
      }
    }
    return problemas;
  }

  // -------------------------------------------------------------------
  // URLs para a interface
  // -------------------------------------------------------------------
  const cacheURL = new Map();
  function paraURL(c) {
    return c && c.toDataURL ? c.toDataURL("image/png") : "";
  }
  function iconeURL(chave, escala = 2) {
    chave = aliasItem(chave);
    const id = "i:" + chave + ":" + escala;
    if (cacheURL.has(id)) return cacheURL.get(id);
    const url = PIXEL_PATTERNS[chave] ? paraURL(canvas(chave, { escala })) : "";
    cacheURL.set(id, url);
    return url;
  }
  function silhuetaURL(chave, cor = "#2a1a14", escala = 2) {
    chave = aliasItem(chave);
    const id = "s:" + chave + ":" + cor + ":" + escala;
    if (cacheURL.has(id)) return cacheURL.get(id);
    const px = pixels(chave);
    if (!px) return "";
    const c = novoCanvas(px.w * escala, px.h * escala);
    pintarPixels(c.getContext("2d"), { w: px.w, h: px.h, data: px.data.map((v) => (v ? cor : null)) }, 0, 0, escala);
    const url = paraURL(c);
    cacheURL.set(id, url);
    return url;
  }
  function retratoURL(chave, { escala = 3, recorte = "busto" } = {}) {
    const id = "r:" + chave + ":" + escala + ":" + recorte;
    if (cacheURL.has(id)) return cacheURL.get(id);
    const def = PIXEL_PATTERNS[chave];
    if (!def) return "";
    const px = pixels(chave, { quadro: def.humano ? 4 : 0 });
    let y0 = 0, h = px.h;
    if (recorte === "busto" && def.humano) { y0 = 2; h = 13; }
    const c = novoCanvas(px.w * escala, h * escala);
    pintarPixels(c.getContext("2d"), { w: px.w, h, data: px.data.slice(y0 * px.w, (y0 + h) * px.w) }, 0, 0, escala);
    const url = paraURL(c);
    cacheURL.set(id, url);
    return url;
  }
  function texturaURL(nome) {
    const id = "t:" + nome;
    if (cacheURL.has(id)) return cacheURL.get(id);
    const rampa = nome === "pergaminho" ? ["#d9bd84", "#ead6a6", "#f0dfb6"] : ["#24150e", "#2c1a12", "#341f15"];
    const c = novoCanvas(64, 64), ctx = c.getContext("2d");
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const n = ruido(x / 4, y / 4, nome.length) * 0.7 + hash2(x, y, 5) * 0.3;
      ctx.fillStyle = tom(rampa, (n - 0.5) * 2.2);
      ctx.fillRect(x * 2, y * 2, 2, 2);
    }
    const url = paraURL(c);
    cacheURL.set(id, url);
    return url;
  }
  function molduraURL(nome) {
    const id = "m:" + nome;
    if (cacheURL.has(id)) return cacheURL.get(id);
    const r = nome === "pergaminho" ? ["#a8844f", "#cfae74", "#e6cf9c", "#f3e4c0"] : ["#5e3c1c", "#8a5a2b", "#b07a38", "#d29e52"];
    const g = new Grade(12, 12);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const borda = Math.min(x, y, 11 - x, 11 - y);
      if (borda > 3) continue;
      let c = borda === 0 ? "#1c1210" : borda === 1 ? (x < 6 && y < 6 ? r[3] : r[2]) : borda === 2 ? r[1] : r[0];
      if (borda === 1 && (x > 9 || y > 9)) c = r[1];
      g.p(x, y, c);
    }
    for (const [x, y] of [[1, 1], [10, 1], [1, 10], [10, 10]]) g.p(x, y, "#e8b94a");
    const c = novoCanvas(24, 24);
    pintarPixels(c.getContext("2d"), { w: 12, h: 12, data: g.final() }, 0, 0, 2);
    const url = paraURL(c);
    cacheURL.set(id, url);
    return url;
  }

  // -------------------------------------------------------------------
  // Phaser: registro de texturas (idempotente) e água animada
  // -------------------------------------------------------------------
  function garantirTextura(scene, chave) {
    if (scene.textures.exists(chave)) return chave;
    const def = PIXEL_PATTERNS[chave];
    if (!def) return null;
    const c = canvas(chave, { tira: true });
    const tex = scene.textures.addCanvas(chave, c);
    for (let i = 0; i < def.quadros; i++) tex.add(i, 0, i * def.w * PX, 0, def.w * PX, def.h * PX);
    return chave;
  }
  function registrarTexturas(scene) {
    for (const chave of Object.keys(PIXEL_PATTERNS)) {
      if (chave.startsWith("mk_portal_") || chave.startsWith("pj_jogador|")) continue; // sob demanda
      garantirTextura(scene, chave);
    }
  }
  function registrarTileset(scene, area) {
    const ts = gerarTileset(area);
    const chave = "ts_" + area;
    if (!scene.textures.exists(chave)) scene.textures.addCanvas(chave, ts.canvas);
    return { chave, ts };
  }
  let ultimaFaseAgua = -1;
  function animarAgua(scene, area, t) {
    const ts = gerarTileset(area);
    const fase = Math.floor(t);
    if (fase === ultimaFaseAgua) return;
    ultimaFaseAgua = fase;
    ts.animar(fase);
    const tex = scene.textures.get("ts_" + area);
    if (tex && tex.refresh) tex.refresh();
  }

  global.Arte = {
    versao: 1, PX,
    PALETA, SEMANTICA, BIOMAS, SUBTITULOS, PIXEL_PATTERNS,
    VISUAL_NPC, VISUAL_INIMIGO, VISUAL_POR_APARENCIA, VISUAL_POR_PAPEL, CHEFES,
    visualDe, nomeCurto, aliasItem,
    pixels, canvas, iconeURL, silhuetaURL, retratoURL, texturaURL, molduraURL, minimapaCores,
    gerarTileset, registrarTexturas, registrarTileset, garantirTextura, animarAgua,
    garantirJogador, chaveJogador, tipoObstaculo, validar,
    hash2, ruido, misturar,
    ID_TILE: ID,
  };
  global.PIXEL_PATTERNS = PIXEL_PATTERNS;
  global.iconeItemURL = (itemId, escala = 2) => iconeURL(aliasItem(itemId), escala);
})(typeof window !== "undefined" ? window : globalThis);
