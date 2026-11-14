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
  const cacheMistura = new Map();
  function misturar(a, b, t) {
    const id = a + b + t;
    let r = cacheMistura.get(id);
    if (r) return r;
    const A = hexRgb(a), B = hexRgb(b);
    r = rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
    if (cacheMistura.size < 50000) cacheMistura.set(id, r);
    return r;
  }
  function comAlfa(hex, a) {
    return hex.slice(0, 7) + Math.round(a * 255).toString(16).padStart(2, "0");
  }
  const escuroT = (c, t) => misturar(c, "#1c1210", t), claroT = (c, t) => misturar(c, "#fff6e0", t);
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
  // Resolução: a arte é desenhada em 32 px por casa (RES px de arte por unidade). As coordenadas
  // continuam em unidades de 1/16 de casa (as do desenho antigo), mas elipses, linhas e sombras são
  // calculadas em cada px de arte, e g.pf / g.linf / g.retf põem detalhe de 1 px de arte (meia unidade).
  // Os glifos da interface (ui_, hb_, of_) ficam em RES 1.
  const RES = 2;
  class Grade {
    constructor(w, h, r = RES) {
      this.r = r;
      this.lw = w;
      this.lh = h;
      this.w = w * r;
      this.h = h * r;
      this.d = new Array(this.w * this.h).fill(null); // camada principal
      this.s = new Array(this.w * this.h).fill(null); // sombra projetada (sem contorno)
    }
    dentroF(X, Y) {
      return X >= 0 && Y >= 0 && X < this.w && Y < this.h;
    }
    dentro(x, y) {
      return x >= 0 && y >= 0 && x < this.lw && y < this.lh;
    }
    // px de arte (inteiros, na resolução final)
    fino(X, Y, c) {
      if (X % 1 || Y % 1) { X = Math.round(X); Y = Math.round(Y); }
      if (!c || !this.dentroF(X, Y)) return;
      this.d[Y * this.w + X] = c;
    }
    p(x, y, c) {
      x = Math.round(x);
      y = Math.round(y);
      if (!c || !this.dentro(x, y)) return;
      const cor = typeof c === "function" ? c(x, y) : c;
      if (!cor) return;
      const r = this.r;
      for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) this.d[(y * r + j) * this.w + x * r + i] = cor;
    }
    // 1 px de arte na posição (x, y) em unidades (aceita meia unidade).
    pf(x, y, c) {
      this.fino(Math.floor(x * this.r + 1e-6), Math.floor(y * this.r + 1e-6), typeof c === "function" ? c(x, y) : c);
    }
    g(x, y) {
      x = Math.round(x); y = Math.round(y);
      return this.dentro(x, y) ? this.d[y * this.r * this.w + x * this.r] : null;
    }
    gf(X, Y) {
      return this.dentroF(X, Y) ? this.d[Y * this.w + X] : null;
    }
    apagar(x, y) {
      if (!this.dentro(x, y)) return;
      const r = this.r;
      for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) this.d[(y * r + j) * this.w + x * r + i] = null;
    }
    ret(x, y, w, h, c) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, typeof c === "function" ? c(x + i, y + j, i, j) : c);
    }
    // Retângulo em px de arte: (x, y, w, h) em unidades, com meia unidade de precisão.
    retf(x, y, w, h, c) {
      const X0 = Math.round(x * this.r), Y0 = Math.round(y * this.r), W = Math.round(w * this.r), H = Math.round(h * this.r);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) this.fino(X0 + i, Y0 + j, typeof c === "function" ? c(X0 + i, Y0 + j, i, j) : c);
    }
    // Linha: os pontos da linha em unidades decidem a cor (c pode ser função (x, y, i)); o traço é
    // feito em px de arte, com a espessura de uma unidade, para a diagonal não virar escada.
    lin(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const pts = [];
      {
        let a = x0, b = y0;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let e = dx + dy, i = 0;
        for (;;) {
          pts.push([a, b, typeof c === "function" ? c(a, b, i++) : c]);
          if (a === x1 && b === y1) break;
          const e2 = 2 * e;
          if (e2 >= dy) { e += dy; a += sx; }
          if (e2 <= dx) { e += dx; b += sy; }
        }
      }
      if (x0 === x1 || y0 === y1 || pts.length < 3) { for (const [a, b, cor] of pts) this.p(a, b, cor); return; }
      const r = this.r;
      let X = x0 * r, Y = y0 * r;
      const X1 = x1 * r, Y1 = y1 * r;
      const dX = Math.abs(X1 - X), dY = -Math.abs(Y1 - Y), sX = X < X1 ? 1 : -1, sY = Y < Y1 ? 1 : -1;
      let e = dX + dY, n = 0;
      const total = Math.max(dX, -dY) || 1;
      for (;;) {
        const cor = pts[Math.min(pts.length - 1, Math.round((n / total) * (pts.length - 1)))][2];
        for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) this.fino(X + i, Y + j, cor);
        if (X === X1 && Y === Y1) break;
        const e2 = 2 * e;
        if (e2 >= dY) { e += dY; X += sX; }
        if (e2 <= dX) { e += dX; Y += sY; }
        n++;
      }
    }
    // Linha fina (1 px de arte) entre pontos em unidades.
    linf(x0, y0, x1, y1, c) {
      const r = this.r;
      let X = Math.floor(x0 * r + 1e-6), Y = Math.floor(y0 * r + 1e-6);
      const X1 = Math.floor(x1 * r + 1e-6), Y1 = Math.floor(y1 * r + 1e-6);
      const dX = Math.abs(X1 - X), dY = -Math.abs(Y1 - Y), sX = X < X1 ? 1 : -1, sY = Y < Y1 ? 1 : -1;
      let e = dX + dY, i = 0;
      for (;;) {
        this.fino(X, Y, typeof c === "function" ? c(X, Y, i++) : c);
        if (X === X1 && Y === Y1) break;
        const e2 = 2 * e;
        if (e2 >= dY) { e += dY; X += sX; }
        if (e2 <= dX) { e += dX; Y += sY; }
      }
    }
    // Elipse cheia, calculada em cada px de arte; c pode ser cor ou função (nx, ny, x, y) com nx/ny
    // em [-1, 1] e x/y na casa da unidade.
    elip(cx, cy, rx, ry, c) {
      const r = this.r;
      for (let Y = Math.floor((cy - ry) * r) - 1; Y <= Math.ceil((cy + ry) * r); Y++) {
        for (let X = Math.floor((cx - rx) * r) - 1; X <= Math.ceil((cx + rx) * r); X++) {
          const lx = (X + 0.5) / r, ly = (Y + 0.5) / r;
          const nx = (lx - cx) / rx, ny = (ly - cy) / ry;
          if (nx * nx + ny * ny <= 1) this.fino(X, Y, typeof c === "function" ? c(nx, ny, Math.floor(lx), Math.floor(ly)) : c);
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
      const c = comAlfa(cor, alfa), r = this.r;
      for (let Y = Math.floor((cy - ry) * r); Y <= Math.ceil((cy + ry) * r); Y++)
        for (let X = Math.floor((cx - rx) * r); X <= Math.ceil((cx + rx) * r); X++) {
          const nx = ((X + 0.5) / r - cx) / rx, ny = ((Y + 0.5) / r - cy) / ry;
          if (nx * nx + ny * ny <= 1 && this.dentroF(X, Y)) this.s[Y * this.w + X] = c;
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
    // Acabamento em px de arte (só na RES 2): realce de 1 px nas bordas viradas para a luz (cima e
    // esquerda) e meia-sombra nas viradas para baixo/direita, por dentro do contorno.
    acabamento(cor) {
      if (this.r < 2) return;
      const w = this.w, h = this.h, d = this.d, nova = d.slice();
      const fora = (x, y) => x < 0 || y < 0 || x >= w || y >= h || !d[y * w + x] || d[y * w + x] === cor;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const c = d[y * w + x];
          if (!c || c === cor || c.length > 7) continue;
          if (fora(x, y - 1) || fora(x - 1, y)) nova[y * w + x] = misturar(c, "#fff6e0", 0.16);
          else if (fora(x, y + 1) || fora(x + 1, y)) nova[y * w + x] = misturar(c, "#1c1210", 0.18);
        }
      this.d = nova;
    }
    // Textura fina (pelo, escama, couro): traços de 2 px de arte um pouco mais escuros ou claros,
    // espalhados por hash (sem "ruído de TV": nunca 2 traços colados).
    textura(semente = 0, protegida = null) {
      if (this.r < 2) return;
      const w = this.w, d = this.d;
      for (let y = 1; y < this.h - 1; y++)
        for (let x = 1; x < w - 2; x++) {
          const c = d[y * w + x];
          if (!c || c === protegida || c.length > 7 || d[y * w + x + 1] !== c) continue;
          const h = hash2(x >> 1, y, semente + 911);
          if (h < 0.09 && (x + y) % 3 === 0) { d[y * w + x] = escuroT(c, 0.13); d[y * w + x + 1] = escuroT(c, 0.13); x += 2; }
          else if (h > 0.95 && (x + y) % 3 === 1) { d[y * w + x] = claroT(c, 0.1); x += 2; }
        }
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
    if (def.res === undefined) def.res = /^(ui_|hb_|of_)/.test(chave) ? 1 : RES;
    PIXEL_PATTERNS[chave] = def;
    return def;
  }

  const cachePixels = new Map();
  function pixels(chave, { quadro = 0 } = {}) {
    const id = chave + "#" + quadro;
    if (cachePixels.has(id)) return cachePixels.get(id);
    const def = PIXEL_PATTERNS[chave];
    if (!def) return null;
    const g = new Grade(def.w, def.h, def.res);
    const q = Math.min(quadro, def.quadros - 1);
    if (def.desenhar) def.desenhar(g, q);
    else {
      const linhas = def.quadrosLinhas ? def.quadrosLinhas[q] : def.linhas;
      g.carimbar(0, 0, linhas, def.cores);
    }
    const corContorno = CONTORNO[def.contorno] || def.contorno || null;
    if (def.textura ?? (def.res > 1 && /^(in_|al_|mt_)/.test(chave) && !def.humano)) g.textura(sementeDe(chave), corContorno);
    g.contorno(corContorno);
    if (corContorno && def.acabamento !== false) g.acabamento(corContorno);
    if (def.depois) def.depois(g, q);
    const limite = def.limiteCores || (def.res === 1 ? (chave.startsWith("ui_") ? 6 : 12) : chave.startsWith("fx_") ? 0 : LIMITE_CORES);
    const r = { w: g.w, h: g.h, res: def.res, data: reduzirCores(g.final(), limite, corContorno) };
    cachePixels.set(id, r);
    return r;
  }

  const LIMITE_CORES = 24; // cores por sprite em 32 px por casa (o contorno não conta para a fusão)
  // Limita o número de cores: funde a cor mais rara na vizinha mais próxima
  // (o contorno nunca é fundido). Garante a regra de no máximo 12 cores.
  function reduzirCores(data, limite, protegida) {
    if (!limite) return data;
    const conta = new Map();
    for (const c of data) if (c) conta.set(c, (conta.get(c) || 0) + 1);
    if (conta.size <= limite) return data;
    const troca = new Map();
    const rgb = new Map();
    for (const c of conta.keys()) rgb.set(c, hexRgb(c));
    const dist = (a, b) => { const A = rgb.get(a), B = rgb.get(b); return (A[0] - B[0]) ** 2 * 0.3 + (A[1] - B[1]) ** 2 * 0.59 + (A[2] - B[2]) ** 2 * 0.11 + (A[3] - B[3]) ** 2; };
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

  // px de tela por px de arte para uma escala dada em px de tela por unidade (inteiro, no mínimo 1).
  const escalaArte = (px, escala) => Math.max(1, Math.round(escala / (px.res || 1)));
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

  // Canvas de um quadro (ou de todos, em tira horizontal, com tira:true). escala = px de tela por
  // unidade (PX = tamanho no mundo); cada px de arte ocupa escala / res px, arredondado.
  function canvas(chave, { quadro = 0, escala = PX, tira = false } = {}) {
    const def = PIXEL_PATTERNS[chave];
    if (!def) return null;
    const n = tira ? def.quadros : 1;
    const p0 = pixels(chave, { quadro: 0 }), e = escalaArte(p0, escala);
    const c = novoCanvas(p0.w * e * n, p0.h * e);
    const ctx = c.getContext("2d");
    for (let i = 0; i < n; i++) pintarPixels(ctx, pixels(chave, { quadro: tira ? i : quadro }), i * p0.w * e, 0, e);
    return c;
  }

  // -------------------------------------------------------------------
  // Humanos (§6.2, JGB-49): proporção de MMORPG clássico visto de cima. Célula 40 × 48 px de arte
  // (20 × 24 unidades), pés na linha 45. Cabeça grande de 16 × 15 px (linhas 7–21), tronco de 16 px com
  // braços de 4 px de cada lado (24 px de ombro a ombro), pernas curtas e firmes, mãos e sandálias à mostra.
  // 3 vistas × 5 quadros (0 parado, 1 respirar, 2 contato A, 3 contato B, 4 ação/fala):
  //   quadros 0–4 de lado (virado para a direita; a esquerda é o espelho), 5–9 de frente, 10–14 de costas.
  //   Andando, game.js toca 2 → 0 → 3 → 0 (o quadro 0 é a passagem): no contato as pernas abrem, o tronco
  //   desce 1 px e os braços balançam ao contrário das pernas.
  // Moldes: "manto" (veste longa), "curta" (túnica curta, pernas à mostra) e "veu" (veste longa com véu).
  // Cores (letras): H cabelo, S/s pele e sombra, B barba, R/r/d tronco (claro, médio, escuro), P/p/q parte
  // de baixo (sem elas, a do tronco), A cinto e detalhes, F sandálias, V/W véu. Cada material vira uma
  // rampa de 4 tons (realce, base, sombra, sombra funda) com a luz de cima e da esquerda; contorno sépia
  // (amigos) ou carmim (hostis) de 1 px. Acessórios desenham em cada vista (ACESSORIOS, abaixo).
  // -------------------------------------------------------------------
  const VISTAS = ["lado", "frente", "costas"];
  const QUADROS_POR_VISTA = 5;
  const escuro = (c, t = 0.28) => misturar(c, "#1c1210", t);
  const claro = (c, t = 0.2) => misturar(c, "#fff6e0", t);
  const BRANCO_OLHO = "#f6efdc";
  // Rampa de 4 tons a partir de uma cor base: a luz puxa para o creme quente e a sombra para o
  // púrpura-sépia (sombra colorida, não cinza).
  function rampaDe(base) {
    return [misturar(base, "#fff2cc", 0.26), base, misturar(base, "#2e1a2a", 0.3), misturar(base, "#1a0e16", 0.5)];
  }
  // primitivas em px de arte
  function retF(g, X, Y, W, H, c) {
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) g.fino(X + i, Y + j, typeof c === "function" ? c(X + i, Y + j, i, j) : c);
  }
  function elipF(g, cx, cy, rx, ry, c) {
    for (let Y = Math.floor(cy - ry) - 1; Y <= Math.ceil(cy + ry); Y++)
      for (let X = Math.floor(cx - rx) - 1; X <= Math.ceil(cx + rx); X++) {
        const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) g.fino(X, Y, typeof c === "function" ? c(nx, ny, X, Y) : c);
      }
  }
  function linF(g, X0, Y0, X1, Y1, c, larg = 1) {
    X0 = Math.round(X0); Y0 = Math.round(Y0); X1 = Math.round(X1); Y1 = Math.round(Y1);
    const dX = Math.abs(X1 - X0), dY = -Math.abs(Y1 - Y0), sX = X0 < X1 ? 1 : -1, sY = Y0 < Y1 ? 1 : -1;
    let e = dX + dY, i = 0;
    for (;;) {
      const cor = typeof c === "function" ? c(X0, Y0, i++) : c;
      for (let j = 0; j < larg; j++) for (let k = 0; k < larg; k++) g.fino(X0 + k, Y0 + j, cor);
      if (X0 === X1 && Y0 === Y1) break;
      const e2 = 2 * e;
      if (e2 >= dY) { e += dY; X0 += sX; }
      if (e2 <= dX) { e += dX; Y0 += sY; }
    }
  }
  // Máscara de px (chave Y * 64 + X) para formas com volume: bastão de largura w entre dois pontos.
  function bastao(mask, X0, Y0, X1, Y1, w) {
    const n = Math.max(Math.abs(X1 - X0), Math.abs(Y1 - Y0)) || 1, h = w >> 1;
    for (let t = 0; t <= n; t++) {
      const x = Math.round(X0 + ((X1 - X0) * t) / n), y = Math.round(Y0 + ((Y1 - Y0) * t) / n);
      for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) if (x - h + i >= 0 && y - h + j >= 0) mask.add((y - h + j) * 64 + x - h + i);
    }
    return mask;
  }
  // Pinta a máscara com a rampa: realce na borda de cima/esquerda, sombra na de baixo/direita.
  function pintarMascara(g, mask, R) {
    const tem = (X, Y) => mask.has(Y * 64 + X);
    for (const k of mask) {
      const X = k % 64, Y = (k - X) / 64;
      const dir = !tem(X + 1, Y), baixo = !tem(X, Y + 1), esq = !tem(X - 1, Y), cima = !tem(X, Y - 1);
      g.fino(X, Y, dir && baixo ? R[3] : dir || baixo ? R[2] : esq || cima ? R[0] : R[1]);
    }
  }
  // Tom de pano numa faixa [x0, x1]: luz à esquerda, sombra à direita (4 tons).
  function tomPano(R, X, x0, x1) {
    const t = (X - x0 + 0.5) / (x1 - x0 + 1);
    return t < 0.19 ? R[0] : t < 0.64 ? R[1] : t < 0.88 ? R[2] : R[3];
  }

  // Pose de cada vista/quadro. dy: o tronco desce 1 px ao respirar e no contato dos passos. passo: 1 no
  // contato A (pé de perto/da esquerda à frente), -1 no B. Mãos: centro [x, y] (a mão ocupa x-2..x+1).
  function pose(vista, q) {
    const dy = q >= 1 && q <= 3 ? 1 : 0, passo = q === 2 ? 1 : q === 3 ? -1 : 0;
    const base = { vista, q, dy, passo, T: 7 + dy, yT: 22 + dy, yC: 31 + dy, yR: 33 + dy };
    if (vista === "lado") {
      const maoArma = q === 4 ? [30, 27 + dy] : passo === 1 ? [15, 32 + dy] : passo === -1 ? [26, 32 + dy] : [21, 34 + dy];
      const maoLonge = passo === 1 ? [26, 31 + dy] : passo === -1 ? [15, 31 + dy] : null;
      return Object.assign(base, { maoArma, maoEscudo: [27, 30 + dy], maoLonge });
    }
    if (vista === "frente") {
      const maoArma = q === 4 ? [9, 19 + dy] : [9, 34 + dy - passo];
      return Object.assign(base, { maoArma, maoEscudo: [31, 34 + dy + passo] });
    }
    const maoArma = q === 4 ? [31, 19 + dy] : [31, 34 + dy + passo];
    return Object.assign(base, { maoArma, maoEscudo: [9, 34 + dy - passo] });
  }

  function coresHumano(cfg) {
    const c = Object.assign({ o: "#2a1a14", F: "#5a3a24", A: "#7a4a30" }, cfg.cores);
    c.H = c.H || "#4a2f20";
    c.B = c.B || c.H;
    c.R = c.R || "#d4bf8f"; c.r = c.r || escuro(c.R, 0.15); c.d = c.d || escuro(c.R, 0.32);
    c.S = c.S || "#cf9466"; c.s = c.s || escuro(c.S, 0.18);
    c.pele = [claro(c.S, 0.14), c.S, c.s, misturar(c.s, "#3a1c20", 0.3)];
    c.cab = [claro(c.H, 0.22), c.H, misturar(c.H, "#1e1018", 0.32), misturar(c.H, "#140a10", 0.55)];
    c.barba = c.B === c.H ? c.cab : [claro(c.B, 0.2), c.B, misturar(c.B, "#1e1018", 0.3), misturar(c.B, "#140a10", 0.5)];
    c.tronco = [c.R, c.r, c.d, misturar(c.d, "#1a0e16", 0.35)];
    c.pernas = c.P ? [c.P, c.p || escuro(c.P, 0.15), c.q || escuro(c.P, 0.32), misturar(c.q || escuro(c.P, 0.32), "#1a0e16", 0.35)] : c.tronco;
    c.cinto = [claro(c.A, 0.24), c.A, misturar(c.A, "#1a0e16", 0.32)];
    c.sand = [claro(c.F, 0.2), c.F, misturar(c.F, "#140a10", 0.35)];
    c.labio = misturar(c.s, "#6a2420", 0.4);
    c.rosto = misturar(c.S, "#d0503a", 0.22);
    return c;
  }

  // ----- cabeça -----
  // Meia-largura da cabeça de frente/costas por linha (15 linhas, colunas 20 - hw .. 19 + hw) e o perfil
  // (de lado, virado para a direita) em [x0, x1].
  const HW_CAB = [4, 6, 7, 7, 8, 8, 8, 8, 8, 8, 8, 7, 7, 6, 4];
  const PERFIL = [[16, 23], [14, 25], [13, 26], [13, 26], [13, 26], [13, 26], [13, 26], [13, 26], [13, 26], [13, 26], [13, 26], [14, 26], [14, 26], [15, 25], [17, 24]];
  // franja (curto, de frente): última linha de cabelo por coluna 12..27
  const FRANJA = [9, 8, 6, 5, 5, 4, 5, 5, 5, 4, 5, 5, 4, 6, 8, 9];
  function cabeca(g, cfg, c, P) {
    const v = P.vista, T = P.T;
    const veu = cfg.molde === "veu" || !!cfg.capuz;
    const Vc = cfg.capuz ? cfg.capuz[0] : c.V || "#888888", Wc = cfg.capuz ? cfg.capuz[1] : c.W || escuro(Vc);
    const V = [claro(Vc, 0.16), Vc, misturar(Vc, Wc, 0.55), Wc];
    const H = c.cab, Pl = c.pele;
    const longo = cfg.cabelo === "longo", careca = cfg.cabelo === "careca";
    const barba = cfg.barba !== false;
    // tom do cabelo: luz de cima/esquerda, mechas por hash (nada de ruído: traços verticais de 2 px)
    const tomCab = (X, Y, nx, ny) => {
      const l = -(0.6 * nx + 0.85 * ny) + ((hash2(X, Y >> 1, 77) - 0.5) * 0.45);
      return l > 0.62 ? H[0] : l > -0.15 ? H[1] : l > -0.8 ? H[2] : H[3];
    };
    const pele = (X, r, x0, x1) => (X <= x0 + 1 && r >= 4 && r <= 11 ? Pl[0] : X >= x1 - 1 || r >= 13 ? Pl[2] : Pl[1]);
    if (v === "frente" || v === "costas") {
      const frente = v === "frente";
      // cabelo comprido atrás dos ombros
      if (longo && !veu) {
        if (frente) for (let Y = T + 5; Y <= T + 18; Y++) { retF(g, 11, Y, 3, 1, (X) => (X === 11 ? H[1] : (X + Y) % 3 ? H[2] : H[3])); retF(g, 26, Y, 3, 1, (X) => (X === 28 ? H[3] : (X + Y) % 3 ? H[2] : H[3])); }
        else for (let Y = T + 10; Y <= T + 19; Y++) { const k = Y > T + 16 ? Y - T - 16 : 0; retF(g, 13 + k, Y, 14 - 2 * k, 1, (X) => tomPano(H, X, 13 + k, 26 - k)); }
      }
      if (veu) {
        // véu: cobre a cabeça e cai sobre os ombros (de costas, até o meio das costas)
        for (let r = -1; r <= 15; r++) {
          const hw = r < 0 ? 5 : r < 15 ? Math.min(9, HW_CAB[r] + 1) : 8;
          for (let X = 20 - hw; X <= 19 + hw; X++) g.fino(X, T + r, tomPano(V, X, 20 - hw, 19 + hw));
        }
        const fim = frente ? T + 21 : T + 24;
        for (let Y = T + 8; Y <= fim; Y++) {
          const k = frente ? 0 : Math.max(0, Y - (T + 19));
          if (frente) { retF(g, 10, Y, 4, 1, (X) => (X === 10 ? V[0] : X === 13 ? V[2] : V[1])); retF(g, 26, Y, 4, 1, (X) => (X === 29 ? V[3] : V[2])); }
          else retF(g, 11 + k, Y, 18 - 2 * k, 1, (X) => ((X - Y) % 6 === 0 ? V[2] : tomPano(V, X, 11 + k, 28 - k)));
        }
        if (!frente) return;
        // rosto na janela do véu, com a franja do cabelo na testa
        for (let r = 4; r <= 14; r++) {
          const hw = Math.min(6, HW_CAB[r] - 1);
          for (let X = 20 - hw; X <= 19 + hw; X++) g.fino(X, T + r, r === 4 ? (X % 2 ? H[1] : H[2]) : pele(X, r, 20 - hw, 19 + hw));
        }
        retF(g, 13, T + 2, 14, 1, V[0]);
      } else {
        // orelhas
        if (!careca || true) { retF(g, 11, T + 7, 1, 3, (X, Y) => (Y === T + 8 ? Pl[2] : Pl[1])); retF(g, 28, T + 7, 1, 3, (X, Y) => (Y === T + 8 ? Pl[3] : Pl[2])); }
        for (let r = 0; r < 15; r++) {
          const hw = HW_CAB[r], x0 = 20 - hw, x1 = 19 + hw, Y = T + r;
          for (let X = x0; X <= x1; X++) {
            const nx = (X - 19.5) / 8, ny = (r - 6) / 7;
            let cabelo;
            if (careca) cabelo = false;
            else if (frente) cabelo = r <= FRANJA[X - 12] && (r <= 5 || X <= 13 || X >= 26);
            else cabelo = r <= 12 || ((X <= 15 || X >= 24) && r <= 13) || (longo && r <= 14);
            if (!cabelo && frente && careca && r <= 3) { g.fino(X, Y, r <= 1 && X < 19 ? Pl[0] : pele(X, r, x0, x1)); continue; }
            g.fino(X, Y, cabelo ? tomCab(X, Y, nx, ny) : frente ? pele(X, r, x0, x1) : Pl[2]);
          }
        }
        if (careca) g.fino(16, T + 2, claro(Pl[0], 0.3));
        if (!frente) {
          // nuca e a barba aparecendo dos lados
          if (barba) { retF(g, 12, T + 10, 2, 4, (X, Y) => (X === 12 ? c.barba[1] : c.barba[2])); retF(g, 26, T + 10, 2, 4, c.barba[2]); }
          return;
        }
      }
      // sobrancelhas, olhos (pálpebra em cima; embaixo o branco para fora e a pupila para dentro), nariz,
      // bochechas e boca
      const sob = veu || careca ? misturar(c.S, "#2a1a14", 0.55) : H[3];
      retF(g, 15, T + 6, 3, 1, sob); retF(g, 22, T + 6, 3, 1, sob);
      retF(g, 16, T + 7, 2, 1, c.o); retF(g, 22, T + 7, 2, 1, c.o);
      g.fino(16, T + 8, BRANCO_OLHO); g.fino(17, T + 8, c.o); g.fino(22, T + 8, c.o); g.fino(23, T + 8, BRANCO_OLHO);
      g.fino(19, T + 9, Pl[0]); g.fino(20, T + 10, Pl[2]); g.fino(19, T + 10, Pl[1]);
      g.fino(15, T + 10, c.rosto); g.fino(24, T + 10, c.rosto);
      if (barba) {
        // barba cheia: do bigode até abaixo do queixo, com mechas e a boca aberta no meio
        for (let r = 10; r <= 16; r++) {
          const Y = T + r;
          const x0 = r === 10 ? 13 : r <= 14 ? 20 - HW_CAB[r] : r === 15 ? 15 : 17, x1 = 39 - x0;
          for (let X = x0; X <= x1; X++) {
            if (r === 10 && X > 14 && X < 25) continue;
            if (r === 11 && X > 14 && X < 17) continue;
            if (r === 11 && X > 22 && X < 25) continue;
            const l = X <= x0 + 1 ? 0 : X >= x1 - 1 || r >= 15 ? 2 : (X + r * 3) % 5 === 0 ? 2 : 1;
            g.fino(X, Y, c.barba[l]);
          }
        }
        retF(g, 19, T + 12, 2, 1, c.labio); g.fino(18, T + 12, c.barba[3]); g.fino(21, T + 12, c.barba[3]);
      } else {
        retF(g, 19, T + 12, 2, 1, c.labio);
        if (veu) { g.fino(15, T + 7, c.o); g.fino(24, T + 7, c.o); } // cílios
      }
      return;
    }
    // ----- de lado, virado para a direita -----
    if (longo && !veu) for (let Y = T + 5; Y <= T + 18; Y++) retF(g, 12, Y, 7, 1, (X) => (X === 12 ? H[1] : (X + Y) % 3 === 0 ? H[3] : H[2]));
    if (veu) {
      for (let r = -1; r <= 15; r++) {
        const [a, b] = r < 0 ? [16, 23] : r < 15 ? PERFIL[r] : [14, 22];
        for (let X = a - 1; X <= b + (r < 4 ? 1 : 0); X++) g.fino(X, T + r, tomPano(V, X, a - 1, b + 1));
      }
      for (let Y = T + 8; Y <= T + 22; Y++) { const k = Y > T + 18 ? Y - T - 18 : 0; retF(g, 11 + k, Y, 9 - k, 1, (X) => tomPano(V, X, 11 + k, 19)); }
      // janela do rosto
      for (let r = 4; r <= 14; r++) {
        const [, b] = PERFIL[r];
        for (let X = 21; X <= b; X++) g.fino(X, T + r, r === 4 ? H[2] : pele(X, r, 21, b));
      }
    } else {
      for (let r = 0; r < 15; r++) {
        const [x0, x1] = PERFIL[r], Y = T + r;
        for (let X = x0; X <= x1; X++) {
          const nx = (X - 19.5) / 7, ny = (r - 6) / 7;
          const cabelo = !careca && (r <= 4 || (r === 5 && X <= 23) || (r <= 10 && X <= 19) || (r <= 12 && X <= 16) || (longo && X <= 18));
          g.fino(X, Y, cabelo ? tomCab(X, Y, nx, ny) : pele(X, r, 20, x1));
        }
      }
      if (careca) g.fino(17, T + 2, claro(Pl[0], 0.3));
      // orelha
      retF(g, 19, T + 7, 2, 3, (X, Y) => (X === 20 && Y === T + 8 ? Pl[2] : Pl[1]));
    }
    // nariz, olho, sobrancelha, bochecha e boca
    g.fino(27, T + 9, Pl[1]); g.fino(27, T + 10, Pl[2]);
    retF(g, 24, T + 7, 2, 1, c.o); g.fino(24, T + 8, BRANCO_OLHO); g.fino(25, T + 8, c.o);
    retF(g, 23, T + 6, 3, 1, veu || careca ? misturar(c.S, "#2a1a14", 0.55) : H[3]);
    g.fino(23, T + 10, c.rosto);
    if (barba) {
      for (let r = 10; r <= 16; r++) {
        const x0 = r <= 14 ? 20 : r === 15 ? 21 : 22, x1 = r <= 12 ? 26 : r <= 14 ? PERFIL[r][1] : r === 15 ? 25 : 24;
        for (let X = x0; X <= x1; X++) {
          if (r === 10 && X > 21 && X < 25) continue;
          if (r === 11 && X > 21 && X < 24) continue;
          g.fino(X, T + r, X === x0 ? c.barba[0] : r >= 15 || X === x1 ? c.barba[2] : (X + r * 3) % 5 === 0 ? c.barba[2] : c.barba[1]);
        }
      }
      g.fino(26, T + 12, c.labio); g.fino(25, T + 12, c.barba[3]);
    } else {
      g.fino(26, T + 12, c.labio);
      if (veu) g.fino(26, T + 7, c.o);
    }
  }

  // ----- tronco, braços e pernas -----
  // Sandália de frente/costas (5 px): peito do pé (ou calcanhar), a tira e a sola.
  function pe(g, c, x, ergue, frente) {
    const y = 43 - ergue;
    for (let i = 0; i < 5; i++) {
      g.fino(x + i, y, frente ? (i === 0 ? c.pele[0] : i === 4 ? c.pele[2] : c.pele[1]) : i === 4 ? c.pele[3] : c.pele[2]);
      g.fino(x + i, y + 1, i === 0 ? c.sand[0] : i === 4 ? c.sand[2] : c.sand[1]);
      g.fino(x + i, y + 2, ergue && !frente ? c.sand[1] : c.sand[2]);
    }
    if (frente) g.fino(x + 2, y, c.sand[1]);
  }
  // Sandália de lado (6 px, ponta à direita).
  function peLado(g, c, x, longe) {
    const s = longe ? [c.sand[1], c.sand[2], c.sand[2]] : c.sand, p = longe ? c.pele[2] : c.pele[1];
    for (let i = 0; i < 6; i++) {
      g.fino(x - 2 + i, 43, i >= 4 ? null : i === 2 ? s[1] : p);
      g.fino(x - 2 + i, 44, i === 5 ? s[1] : i === 0 ? s[0] : i === 3 ? s[1] : p);
      g.fino(x - 2 + i, 45, s[2]);
    }
    g.fino(x + 3, 44, longe ? c.pele[3] : c.pele[2]);
  }
  function corpo(g, cfg, c, P) {
    const v = P.vista, dy = P.dy, L = cfg.porte === "grande" ? 1 : 0;
    const T = c.tronco, B = c.pernas, longo = cfg.molde !== "curta";
    const { yT, yC, yR, passo } = P;
    const barra = cfg.barra ? c.cinto : null;
    if (v === "lado") {
      // braço de longe (atrás do corpo) aparece no balanço
      if (P.maoLonge) {
        pintarMascara(g, bastao(new Set(), 20, yT + 2, P.maoLonge[0], P.maoLonge[1] - 2, 4), [T[2], T[2], T[3], T[3]]);
        retF(g, P.maoLonge[0] - 2, P.maoLonge[1] - 1, 4, 3, (X, Y) => (Y === P.maoLonge[1] - 1 ? c.pele[2] : c.pele[3]));
      }
      if (cfg.montado) inferiorMontado(g, cfg, c, P);
      else {
        // pés: o de perto à frente no contato A, atrás no B; o de longe ao contrário
        const fPerto = passo === 1 ? 26 : passo === -1 ? 14 : 21, fLonge = passo === 1 ? 14 : passo === -1 ? 26 : 18;
        if (!longo) {
          pintarMascara(g, bastao(new Set(), 19, yR + 3, fLonge, 41, 4), [c.pele[2], c.pele[2], c.pele[3], c.pele[3]]);
          peLado(g, c, fLonge, true);
          pintarMascara(g, bastao(new Set(), 20, yR + 3, fPerto, 41, 4), c.pele);
          retF(g, fPerto - 1, 40, 3, 1, c.sand[1]);
          peLado(g, c, fPerto, false);
          // saia da túnica
          for (let Y = yR; Y <= 37; Y++) {
            const a = 14 - (Y > yR + 1 ? 1 : 0) - (passo && Y > yR + 2 ? 1 : 0), b = 25 + (Y > yR + 1 ? 1 : 0) + (passo && Y > yR + 2 ? 1 : 0);
            for (let X = a; X <= b; X++) g.fino(X, Y, Y === 37 ? (barra ? barra[1] : B[3]) : (X - a) % 4 === 3 && Y > yR ? B[2] : tomPano(B, X, a, b));
          }
        } else {
          peLado(g, c, fLonge, true);
          peLado(g, c, fPerto, false);
          // veste longa: abre em A no passo, com a dobra entre as pernas
          for (let Y = yR; Y <= 42; Y++) {
            const t = (Y - yR) / (42 - yR);
            const abre = passo ? Math.round(t * t * 4) : 0;
            const a = 14 - Math.round(t) - abre, b = 25 + Math.round(t) + abre;
            for (let X = a; X <= b; X++) {
              let cor = tomPano(B, X, a, b);
              if (passo && t > 0.35 && Math.abs(X - 20) <= (t > 0.75 ? 1 : 0)) cor = B[3];
              else if (!passo && X === 22 && Y > yR + 2) cor = B[2];
              if (Y === 42) cor = B[3];
              else if (Y === 41 && barra) cor = barra[1];
              g.fino(X, Y, cor);
            }
          }
        }
      }
      // tronco (peito um pouco à frente)
      retF(g, 18, yT - 2, 4, 3, c.pele[2]);
      for (let Y = yT; Y < yC; Y++) {
        const i = Y - yT, x0 = (i === 0 ? 15 : 14) - L, x1 = (i === 0 ? 24 : i >= 2 && i <= 5 ? 26 : 25) + L;
        for (let X = x0; X <= x1; X++) g.fino(X, Y, Y === yC - 1 && X > x0 ? T[2] : tomPano(T, X, x0, x1));
      }
      if (cfg.gola) retF(g, 22, yT, 3, 1, cfg.gola);
      // cinto com a ponta da faixa caindo na frente
      retF(g, 14 - L, yC, 12 + 2 * L, 2, (X, Y) => (Y === yC ? (X < 17 ? c.cinto[0] : c.cinto[1]) : c.cinto[2]));
      retF(g, 24, yC + 2, 2, 3, (X) => (X === 24 ? c.cinto[1] : c.cinto[2]));
      return;
    }
    // ----- frente e costas -----
    const frente = v === "frente";
    if (cfg.montado) inferiorMontado(g, cfg, c, P);
    else {
      // no contato A o pé da esquerda (da tela) fica à frente e o outro sobe 1 px; no B, o contrário
      const ergueE = passo === -1 ? 1 : 0, ergueD = passo === 1 ? 1 : 0;
      if (!longo) {
        for (const [x, ergue, lado] of [[14, ergueE, 0], [22, ergueD, 1]]) {
          for (let Y = 37; Y <= 42 - ergue; Y++) for (let i = 0; i < 4; i++) {
            const t = lado ? [c.pele[1], c.pele[1], c.pele[2], c.pele[3]] : [c.pele[0], c.pele[1], c.pele[1], c.pele[2]];
            g.fino(x + i, Y, Y === 41 - ergue && i > 0 && i < 3 ? c.sand[1] : frente ? t[i] : [c.pele[2], c.pele[2], c.pele[2], c.pele[3]][i]);
          }
          pe(g, c, x - (lado ? 0 : 1), ergue, frente);
        }
        // saia da túnica, com pregas
        for (let Y = yR; Y <= 37; Y++) {
          const k = (Y >= yR + 2 ? 1 : 0) + L, x0 = 12 - k, x1 = 27 + k;
          for (let X = x0; X <= x1; X++) {
            let cor = tomPano(B, X, x0, x1);
            if (Y > yR && (X === 16 || X === 23)) cor = B[2];
            if (Y === 37) cor = barra ? barra[1] : B[3];
            g.fino(X, Y, cor);
          }
        }
      } else {
        pe(g, c, 13, ergueE, frente);
        pe(g, c, 22, ergueD, frente);
        for (let Y = yR; Y <= 42; Y++) {
          const k = Math.min(2, Math.floor((Y - yR + 1) / 3)) + L, bal = Y >= 38 ? -passo : 0;
          const x0 = 12 - k + bal, x1 = 27 + k + bal;
          for (let X = x0; X <= x1; X++) {
            let cor = tomPano(B, X, x0, x1);
            if (Y > yR + 1 && (X === 16 + bal || X === 23 + bal)) cor = cor === B[0] ? B[1] : B[2];
            if (Y > yR + 3 && X === 17 + bal) cor = B[0];
            if (Y === 42) cor = B[3];
            else if (Y === 41 && barra) cor = barra[1];
            g.fino(X, Y, cor);
          }
        }
      }
    }
    // tronco e cinto
    retF(g, 18, yT - 2, 4, 3, c.pele[2]);
    for (let Y = yT; Y < yC; Y++) {
      const i = Y - yT, x0 = (i === 0 ? 13 : 12) - L, x1 = (i === 0 ? 26 : 27) + L;
      for (let X = x0; X <= x1; X++) {
        let cor = tomPano(T, X, x0, x1);
        if (Y === yC - 1) cor = cor === T[0] ? T[1] : T[2]; // a veste dobra sobre o cinto
        g.fino(X, Y, cor);
      }
    }
    if (frente) {
      // decote em V com a gola
      const gola = cfg.gola || T[3];
      for (let i = 0; i < 3; i++) { retF(g, 17 + i, yT + i, 6 - 2 * i, 1, i === 0 ? c.pele[2] : c.pele[1]); g.fino(16 + i, yT + i, gola); g.fino(23 - i, yT + i, gola); }
      retF(g, 19, yT + 3, 2, 1, gola);
    } else retF(g, 17, yT, 6, 1, T[3]);
    retF(g, 12 - L, yC, 16 + 2 * L, 2, (X, Y) => (Y === yC ? (X < 15 ? c.cinto[0] : X > 25 ? c.cinto[2] : c.cinto[1]) : X > 25 ? c.cinto[2] : c.cinto[1]));
    if (frente) {
      // nó do cinto e as pontas da faixa
      retF(g, 18, yC, 3, 2, (X, Y) => (Y === yC && X < 20 ? c.cinto[0] : c.cinto[1]));
      retF(g, 20, yC + 2, 2, 4, (X, Y) => (X === 20 ? c.cinto[1] : c.cinto[2]));
    } else retF(g, 19, yC, 2, 1, c.cinto[2]);
  }

  // Montado: veste aberta sobre a sela; de lado, a coxa vai para a frente e a canela desce; de frente e
  // de costas, as pernas abrem para os lados da montaria.
  function inferiorMontado(g, cfg, c, P) {
    const longo = cfg.molde !== "curta", B = c.pernas, yR = P.yR;
    const perna = longo ? B : c.pele, longe = [perna[2], perna[2], perna[3], perna[3]];
    if (P.vista === "lado") {
      pintarMascara(g, bastao(bastao(new Set(), 19, yR + 1, 26, yR + 2, 5), 26, yR + 2, 26, 40, 4), perna);
      retF(g, 25, 41, 6, 2, (X, Y) => (Y === 41 ? c.sand[0] : X === 30 ? c.sand[2] : c.sand[1]));
      for (let Y = yR; Y <= yR + 3; Y++) for (let X = 13; X <= 22; X++) g.fino(X, Y, Y === yR + 3 ? B[3] : tomPano(B, X, 13, 22));
      return;
    }
    pintarMascara(g, bastao(bastao(new Set(), 13, yR + 2, 8, yR + 4, 4), 8, yR + 4, 8, 40, 4), P.vista === "frente" ? perna : longe);
    pintarMascara(g, bastao(bastao(new Set(), 26, yR + 2, 31, yR + 4, 4), 31, yR + 4, 31, 40, 4), P.vista === "frente" ? longe : perna);
    retF(g, 5, 41, 5, 2, (X, Y) => (Y === 41 ? c.sand[0] : c.sand[1])); retF(g, 30, 41, 5, 2, (X, Y) => (Y === 41 ? c.sand[1] : c.sand[2]));
    for (let Y = yR; Y <= yR + 3; Y++) for (let X = 10; X <= 29; X++) g.fino(X, Y, Y === yR + 3 ? B[3] : tomPano(B, X, 10, 29));
  }

  // Braços na frente/costas (os dois) ou o braço de perto (de lado), com as mãos por cima da arma.
  function mao(g, c, X, Y, dorso) {
    for (let j = -1; j <= 1; j++) for (let i = -2; i <= 1; i++) {
      const t = dorso ? (j === 1 || i === 1 ? 3 : 2) : j === -1 && i < 0 ? 0 : j === 1 || i === 1 ? 2 : 1;
      g.fino(X + i, Y + j, c.pele[t]);
    }
  }
  function bracos(g, cfg, c, P, soMaos) {
    const v = P.vista, L = cfg.porte === "grande" ? 1 : 0, yT = P.yT;
    const M = cfg.mangaCor ? rampaDe(cfg.mangaCor) : c.tronco;
    const punho = (mask, R) => { pintarMascara(g, mask, R); };
    if (v === "lado") {
      const [hx, hy] = P.maoArma;
      if (!soMaos) {
        const m = bastao(new Set(), 20, yT + 3, hx, hy - 2, 4);
        for (let i = 0; i < 3; i++) m.add(yT * 64 + 19 + i);
        punho(m, M);
        // vinco escuro do lado de trás do braço, para ele se soltar do tronco
        for (const k of m) { const X = k % 64, Y = (k - X) / 64; if (Y > yT + 3 && !m.has(k - 1)) g.fino(X, Y, M[3]); }
      }
      mao(g, c, hx, hy, false);
      return;
    }
    const frente = v === "frente";
    const [ax, ay] = P.maoArma, [ex, ey] = P.maoEscudo;
    const xa = frente ? 10 - L : 30 + L, xe = frente ? 30 + L : 10 - L;
    const sombra = [M[1], M[2], M[2], M[3]];
    // braço com o ombro arredondado (2 px a mais na linha dos ombros, colados ao tronco)
    const braco = (x, hx, hy) => {
      const m = bastao(new Set(), x, yT + 3, hx, hy - 2, 4);
      const ombro = x < 20 ? x : x - 2;
      for (let i = 0; i < 3; i++) m.add(yT * 64 + ombro + i);
      return m;
    };
    if (!soMaos) {
      punho(braco(xa, ax, ay), frente ? M : sombra);
      punho(braco(xe, ex, ey), frente ? sombra : M);
    }
    mao(g, c, ax, ay, !frente);
    if (!cfg.duasMaosOcupadas) mao(g, c, ex, ey, !frente);
  }

  // ----- acessórios: f(g, c, P, cfg) por vista; camada "fundo" (antes do corpo), "meio" (depois do
  // corpo, antes dos braços) ou "frente" (por cima de tudo). camada pode ser função da vista.
  // Âncoras (pose): T topo da cabeça, yT ombros, yC cinto, maoArma e maoEscudo.
  const ACESSORIOS = {};
  function acessorio(nome, camada, f) { ACESSORIOS[nome] = { camada, f }; }
  const camadaPorVista = (lado, frente, costas) => (v) => (v === "lado" ? lado : v === "frente" ? frente : costas);

  // cajados e lanças: haste na mão da arma
  function haste(g, P, cores, topo, chao) {
    const [hx, hy] = P.maoArma;
    const inclina = P.q === 4 ? (P.vista === "frente" ? -1 : 1) : 0;
    const x = hx - 1;
    const y0 = Math.max(P.q === 4 ? 2 : 0, hy - topo), y1 = Math.min(45, hy + chao + (P.q === 4 ? 6 : 0));
    linF(g, x + inclina * 3, y0, x, y1, cores[0], 1);
    linF(g, x + inclina * 3 + 1, y0, x + 1, y1, escuro(cores[0], 0.3), 1);
    return [x + inclina * 3, y0];
  }
  acessorio("cajado_alto", "frente", (g, c, P) => { const [x, y] = haste(g, P, c, 27, 14); retF(g, x, y - 1, 2, 2, c[1] || claro(c[0], 0.2)); });
  acessorio("cajado_curvo", "frente", (g, c, P) => {
    const [x, y] = haste(g, P, c, 27, 14);
    const lado = P.vista === "costas" ? 1 : -1;
    linF(g, x, y, x + lado * 1, y - 3, c[0], 2); linF(g, x + lado, y - 3, x + lado * 4, y - 4, c[1] || c[0], 2); linF(g, x + lado * 5, y - 3, x + lado * 5, y - 1, c[0], 2);
  });
  acessorio("cajado_curto", "frente", (g, c, P) => { const [x, y] = haste(g, P, c, 17, 13); elipF(g, x + 1, y - 1, 2.2, 2.2, (nx, ny) => (nx + ny < -0.3 ? "#ffe08a" : "#e8b94a")); });
  acessorio("lanca", "frente", (g, c, P) => {
    const [x, y] = haste(g, P, c, 27, 13);
    for (let i = 0; i < 7; i++) { const w = i < 2 ? 1 : i < 5 ? 2 : 1; retF(g, x + (w > 1 ? 0 : i < 2 ? 0 : 1), y - 7 + i, w, 1, i < 3 ? claro(c[1], 0.25) : c[1]); }
    retF(g, x - 1, y - 1, 4, 1, escuro(c[1], 0.25));
  });
  acessorio("lanca_longa", "frente", (g, c, P) => {
    const [x, y] = haste(g, P, c, 31, 13);
    for (let i = 0; i < 8; i++) { const w = i === 0 ? 1 : i < 6 ? 2 : 1; retF(g, x + (w > 1 ? 0 : 0), y - 8 + i, w, 1, i < 3 ? claro(c[1], 0.25) : c[1]); }
    retF(g, x - 1, y, 4, 1, escuro(c[1], 0.3));
  });
  acessorio("ankh", "frente", (g, c, P) => {
    const [hx, hy] = P.maoArma, x = hx - 1 + (P.q === 4 ? (P.vista === "frente" ? -3 : 3) : 0), y = hy - 18;
    elipF(g, x + 1, y - 3, 2.2, 2.8, (nx, ny) => (nx * nx + ny * ny < 0.3 ? null : c[0]));
    retF(g, x - 2, y, 6, 1, c[0]); retF(g, x, y, 2, 4, c[0]);
  });
  // espadas: na mão, com a lâmina para cima e para fora do corpo; no golpe vão à frente (de lado) ou ao
  // alto (frente/costas)
  function lamina(g, P, c, curva) {
    const [hx, hy] = P.maoArma;
    const [esc, cla, guarda, cabo] = [c[0], c[1], c[2] || "#b07a38", c[3] || "#5a3624"];
    const golpe = P.q === 4;
    if (P.vista === "lado" && golpe) {
      retF(g, hx - 4, hy, 3, 1, cabo); retF(g, hx + 2, hy - 2, 1, 5, guarda); g.fino(hx + 2, hy - 2, claro(guarda, 0.3));
      for (let i = 3; i <= 12; i++) { const yy = hy - (curva && i > 8 ? i - 8 : 0); g.fino(hx + i, yy - 1, cla); g.fino(hx + i, yy, esc); }
      g.fino(hx + 13, hy - (curva ? 5 : 0) - 1, cla);
      return;
    }
    if (P.vista === "lado") {
      // de lado, parada ou andando: baixa, com a ponta para a frente e para o chão (fora do tronco)
      const x = hx + 1, y = hy;
      retF(g, x - 3, y - 1, 3, 2, cabo); retF(g, x, y - 3, 1, 5, guarda); g.fino(x, y - 3, claro(guarda, 0.3));
      for (let i = 1; i <= 10; i++) { const X = x + i, Y = y + Math.round(i * 0.75) - (curva && i > 7 ? i - 7 : 0); g.fino(X, Y - 1, cla); g.fino(X, Y, esc); }
      return;
    }
    // direção da lâmina: (sx, -1) por px, para fora do corpo
    const sx = golpe ? 0 : P.vista === "frente" ? -0.4 : 0.4;
    const x = hx - 1, gy = hy - 2 - (golpe ? 1 : 0);
    retF(g, x - 2, gy, 5, 1, guarda); g.fino(x - 2, gy, claro(guarda, 0.3));
    retF(g, x, gy + 1, 1, 3, cabo); g.fino(x, gy + 4, guarda);
    for (let i = 1; i <= 11; i++) {
      const dx = Math.round(sx * i) + (curva && i > 7 ? Math.floor((i - 7) / 2) * (P.vista === "frente" ? -1 : 1) : 0);
      g.fino(x - 1 + dx, gy - i, cla); g.fino(x + dx, gy - i, esc);
    }
    g.fino(x + Math.round(sx * 12) - (sx < 0 ? 1 : 0), gy - 12, cla);
  }
  acessorio("espada", "frente", (g, c, P) => lamina(g, P, c, false));
  acessorio("espada_curva", "frente", (g, c, P) => lamina(g, P, c, true));
  acessorio("porrete", "frente", (g, c, P) => {
    const [hx, hy] = P.maoArma, sobe = P.q === 4 ? -5 : 0, ld = P.vista === "lado" && P.q === 4, x = hx - 1;
    if (ld) { retF(g, x, hy - 1, 9, 2, c[1] || c[0]); elipF(g, x + 11, hy, 3, 3, (nx, ny) => (nx + ny < -0.4 ? claro(c[0], 0.2) : c[0])); return; }
    retF(g, x, hy - 10 + sobe, 2, 10, c[1] || c[0]);
    elipF(g, x + 1, hy - 12 + sobe, 3, 3.4, (nx, ny) => (nx + ny < -0.4 ? claro(c[0], 0.2) : nx + ny > 0.6 ? escuro(c[0], 0.2) : c[0]));
  });
  // escudos: de frente no braço do escudo; de costas mostram o verso; de lado, à frente do peito
  function escudo(g, P, cores, forma) {
    const [fr, aro, cen] = [cores[0], cores[1], cores[2] || cores[0]];
    const v = P.vista;
    const [x, y] = P.escudoEm || P.maoEscudo; // montado, o escudo fica pendurado do lado
    if (v === "lado") {
      const ry = forma === "alto" ? 9.5 : 7, rx = forma === "alto" ? 2.6 : 3;
      elipF(g, x + 0.5, y - 1, rx, ry, (nx, ny) => (nx > 0.5 ? aro : nx < -0.55 ? escuro(fr, 0.25) : ny < -0.6 ? claro(fr, 0.2) : fr));
      return;
    }
    const cx = v === "frente" ? x + 0.5 : x - 1.5, cy = y - 3;
    if (v === "costas") {
      elipF(g, cx, cy, forma === "alto" ? 6 : 6.5, forma === "alto" ? 9.5 : 6.5, (nx, ny) => (nx * nx + ny * ny > 0.72 ? escuro(aro, 0.1) : nx + ny < -0.6 ? escuro(fr, 0.2) : escuro(fr, 0.35)));
      retF(g, Math.round(cx) - 4, Math.round(cy) - 1, 8, 2, "#5a3a24");
      return;
    }
    if (forma === "alto") {
      retF(g, Math.round(cx) - 6, Math.round(cy) - 9, 13, 19, (X, Y, i, j) => (i === 0 || j === 0 ? claro(fr, 0.2) : i === 12 || j === 18 ? escuro(fr, 0.3) : (i + j) % 4 === 0 ? aro : fr));
      retF(g, Math.round(cx) - 1, Math.round(cy) - 9, 2, 19, cen);
      return;
    }
    if (forma === "oval") {
      elipF(g, cx, cy, 5, 7.5, (nx, ny, X, Y) => (nx * nx + ny * ny > 0.72 ? escuro(fr, 0.2) : Y % 3 === 0 ? aro : nx + ny < -0.5 ? claro(fr, 0.15) : fr));
      return;
    }
    elipF(g, cx, cy, 6.6, 6.6, (nx, ny) => {
      const r = Math.sqrt(nx * nx + ny * ny);
      if (r > 0.8) return nx + ny < -0.3 ? claro(aro, 0.2) : nx + ny > 0.5 ? escuro(aro, 0.2) : aro;
      if (r < 0.26) return nx + ny < 0 ? claro(cen, 0.35) : cen;
      return tom([escuro(fr, 0.2), fr, claro(fr, 0.18)], -(nx + ny) * 0.9);
    });
  }
  acessorio("escudo_redondo", "frente", (g, c, P) => escudo(g, P, c, "redondo"));
  acessorio("escudo_alto", "frente", (g, c, P) => escudo(g, P, c, "alto"));
  acessorio("escudo_oval", "frente", (g, c, P) => escudo(g, P, c, "oval"));
  // arco nas costas e arco na mão
  acessorio("arco_costas", camadaPorVista("fundo", "fundo", "frente"), (g, c, P) => {
    const corda = c[1], dy = P.dy;
    if (P.vista === "lado") { for (let Y = 18; Y <= 40; Y++) { const t = (Y - 29) / 11; g.fino(Math.round(12 + 3 * t * t), Y + dy, c[0]); g.fino(Math.round(13 + 3 * t * t), Y + dy, escuro(c[0], 0.25)); } linF(g, 15, 18 + dy, 15, 40 + dy, corda); return; }
    if (P.vista === "frente") { for (let Y = 16; Y <= 36; Y++) { const t = (Y - 26) / 10; g.fino(Math.round(32 - 2 * t * t), Y + dy, c[0]); g.fino(Math.round(33 - 2 * t * t), Y + dy, escuro(c[0], 0.25)); } return; }
    linF(g, 12, 18 + dy, 27, 38 + dy, (X, Y, i) => (i % 2 ? c[0] : escuro(c[0], 0.2)), 2);
    linF(g, 15, 16 + dy, 30, 35 + dy, corda);
  });
  acessorio("arco_mao", "frente", (g, c, P) => {
    const [hx0, hy] = P.maoArma, hx = hx0 - 1, v = P.vista, puxa = P.q === 4;
    if (v === "lado") {
      const x0 = puxa ? hx + 2 : hx + 1;
      for (let Y = -11; Y <= 11; Y++) { const t = Y / 11; g.fino(Math.round(x0 + 3 - 3 * t * t), hy - 2 + Y, Y % 4 ? c[0] : escuro(c[0], 0.25)); }
      linF(g, x0 - (puxa ? 4 : 0), hy - 2, x0, hy - 13, c[1]); linF(g, x0 - (puxa ? 4 : 0), hy - 2, x0, hy + 9, c[1]);
      if (puxa) linF(g, x0 - 5, hy - 2, x0 + 8, hy - 2, "#c8b48a");
      return;
    }
    const sx = v === "frente" ? -1 : 1;
    for (let Y = -11; Y <= 11; Y++) { const t = Y / 11; g.fino(Math.round(hx + sx * (3 - 3 * t * t)), hy - 3 + Y, Y % 4 ? c[0] : escuro(c[0], 0.25)); }
    linF(g, hx, hy - 14, hx, hy + 8, c[1]);
  });
  // capas
  function capa(g, c, P, larga) {
    const v = P.vista, dy = P.dy, sw = P.passo;
    const R = [claro(c[0], 0.14), c[0], misturar(c[0], c[1], 0.5), c[1]];
    if (v === "lado") {
      for (let Y = 22 + dy; Y <= 43; Y++) { const k = Math.floor((Y - 22) / 5) + (larga ? 1 : 0), x0 = 13 - k - (Y > 36 ? sw : 0); for (let X = x0; X <= 17; X++) g.fino(X, Y, X === 17 ? R[3] : (X + Y) % 6 === 0 ? R[2] : tomPano(R, X, x0, 17)); }
      return;
    }
    if (v === "frente") {
      const x0 = larga ? 5 : 7, x1 = larga ? 34 : 32;
      for (let Y = 23 + dy; Y <= 43; Y++) for (let X = x0; X <= x1; X++) g.fino(X, Y, X < x0 + 2 ? R[0] : X > x1 - 2 ? R[3] : R[2]);
      return;
    }
    for (let Y = 21 + dy; Y <= 43; Y++) {
      const k = Math.floor((Y - 21) / 6) + (larga ? 1 : 0), x0 = 11 - k + (Y > 36 ? sw : 0), x1 = 28 + k + (Y > 36 ? sw : 0);
      for (let X = x0; X <= x1; X++) g.fino(X, Y, Y === 43 ? R[3] : (X - x0) % 5 === 2 && Y > 26 ? R[2] : tomPano(R, X, x0, x1));
    }
    retF(g, 12, 21 + dy, 16, 1, R[3]);
  }
  acessorio("capa", camadaPorVista("fundo", "fundo", "frente"), (g, c, P) => capa(g, c, P, false));
  acessorio("capa_larga", camadaPorVista("fundo", "fundo", "frente"), (g, c, P) => capa(g, c, P, true));
  // cabeça
  acessorio("turbante", "frente", (g, c, P) => {
    const T = P.T, lado = P.vista === "lado", cx = lado ? 19.5 : 20;
    elipF(g, cx, T + 2.5, 9, 5.2, (nx, ny, X, Y) => (Y > T + 5 ? null : (Y + Math.round(nx * 3)) % 3 === 0 ? escuro(c[0], 0.2) : nx < -0.45 || ny < -0.6 ? claro(c[0], 0.18) : nx > 0.55 ? escuro(c[0], 0.12) : c[0]));
    if (c[1]) for (let X = Math.round(cx) - 9; X <= Math.round(cx) + 8; X++) g.fino(X, T + 5, c[1]);
    if (c[2]) retF(g, Math.round(cx) - 4, T - 1, 2, 2, c[2]);
    if (lado) retF(g, 11, T + 3, 3, 8, (X) => (X === 11 ? c[0] : escuro(c[0], 0.18)));
    else if (P.vista === "costas") retF(g, 19, T + 6, 3, 6, (X) => (X === 19 ? c[0] : escuro(c[0], 0.2)));
  });
  acessorio("elmo", "frente", (g, c, P) => {
    const T = P.T, v = P.vista, cx = v === "lado" ? 19.5 : 20;
    elipF(g, cx, T + 5.5, 8.8, 7, (nx, ny, X, Y) => (Y > T + 5 ? null : nx + ny < -0.7 ? claro(c[1], 0.25) : nx < -0.3 && ny < 0 ? c[1] : nx > 0.45 ? escuro(c[0], 0.25) : c[0]));
    retF(g, Math.round(cx) - 9, T + 5, 18, 1, (X) => (X < cx - 4 ? claro(c[1], 0.1) : c[1]));
    if (v === "frente") retF(g, 19, T + 6, 2, 4, (X) => (X === 19 ? c[1] : c[0]));
    if (v === "lado") { retF(g, 15, T + 6, 4, 6, (X) => (X === 15 ? c[1] : c[0])); retF(g, 25, T + 6, 1, 1, c[0]); }
    if (v === "costas") retF(g, 12, T + 6, 16, 3, (X) => (X < 15 ? c[1] : X > 24 ? escuro(c[0], 0.2) : c[0]));
    retF(g, Math.round(cx) - 1, T - 2, 2, 2, c[1]);
  });
  acessorio("faixa", "frente", (g, c, P) => {
    const T = P.T, R = [claro(c[0], 0.2), c[0], escuro(c[0], 0.25)];
    if (P.vista === "lado") { retF(g, 13, T + 4, 14, 2, (X, Y) => (Y === T + 4 ? R[0] : R[1])); retF(g, 11, T + 5, 2, 5, (X) => (X === 11 ? R[1] : R[2])); return; }
    retF(g, 12, T + 4, 16, 2, (X, Y) => (Y === T + 4 ? (X > 24 ? R[1] : R[0]) : X > 24 ? R[2] : R[1]));
    if (P.vista === "costas") { retF(g, 18, T + 6, 2, 5, R[1]); retF(g, 21, T + 6, 2, 4, R[2]); }
  });
  acessorio("bandana", "frente", (g, c, P) => {
    const T = P.T, lado = P.vista === "lado";
    elipF(g, lado ? 19.5 : 20, T + 5, 8.6, 6, (nx, ny, X, Y) => (Y > T + 5 ? null : nx > 0.45 ? escuro(c[0], 0.22) : nx < -0.4 && ny < 0 ? claro(c[0], 0.18) : c[0]));
    if (lado) { retF(g, 11, T + 5, 2, 3, c[0]); retF(g, 10, T + 7, 2, 4, escuro(c[0], 0.2)); }
    if (P.vista === "costas") { retF(g, 18, T + 6, 4, 2, c[0]); retF(g, 17, T + 8, 2, 4, escuro(c[0], 0.2)); retF(g, 21, T + 8, 2, 4, c[0]); }
    if (P.vista === "frente" && c[1]) { g.fino(15, T + 2, c[1]); g.fino(23, T + 3, c[1]); g.fino(18, T + 1, c[1]); }
  });
  // nemes (toucado listrado do Egito): topo e abas sobre os ombros
  acessorio("nemes", "frente", (g, c, P) => {
    const T = P.T, v = P.vista, faixa = (Y) => ((Y >> 1) % 2 ? c[1] : c[0]);
    elipF(g, v === "lado" ? 19.5 : 20, T + 5, 9, 6.2, (nx, ny, X, Y) => (Y > T + 5 ? null : nx > 0.6 ? escuro(faixa(Y), 0.15) : faixa(Y)));
    retF(g, 11, T + 4, 18, 2, (X, Y) => faixa(Y));
    if (v === "frente") { retF(g, 10, T + 6, 3, 13, (X, Y) => faixa(Y)); retF(g, 27, T + 6, 3, 13, (X, Y) => escuro(faixa(Y), 0.15)); retF(g, 12, T + 5, 16, 1, c[2] || c[1]); }
    else if (v === "lado") retF(g, 12, T + 6, 7, 12, (X, Y) => (X === 18 ? escuro(faixa(Y), 0.15) : faixa(Y)));
    else retF(g, 11, T + 6, 18, 13, (X, Y) => (X > 25 ? escuro(faixa(Y), 0.15) : faixa(Y)));
  });
  // colar largo (Egito) e peitoral do sumo sacerdote
  acessorio("colar", "meio", (g, c, P) => {
    const y = P.yT;
    if (P.vista === "costas") return;
    if (P.vista === "lado") { retF(g, 20, y, 7, 3, (X, Y) => ((X + Y) % 2 ? c[0] : c[1])); return; }
    for (let j = 0; j < 4; j++) for (let X = 14 + j; X <= 25 - j; X++) g.fino(X, y + j, (X + j) % 2 ? c[0] : c[1]);
  });
  acessorio("peitoral", "meio", (g, c, P) => {
    const y = P.yT + 3, pedras = ["#c2452d", "#4fa3a5", "#e8b94a", "#55642c", "#6d8fc4", "#b98ad0"];
    if (P.vista === "costas") return;
    const lado = P.vista === "lado", x0 = lado ? 22 : 16, w = lado ? 4 : 8;
    retF(g, x0, y, w, 8, (X, Y) => (Y === y ? claro(c[0], 0.2) : c[0]));
    for (let j = 0; j < 3; j++) for (let i = 0; i < (lado ? 1 : 3); i++) retF(g, x0 + 1 + i * 2 + (lado ? 1 : 0), y + 1 + j * 2, 1 + (lado ? 0 : 1) - (lado ? 0 : 1), 1, pedras[(i + j * 3) % 6]);
    if (!lado) for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) g.fino(x0 + 1 + i * 2 + 1, y + 1 + j * 2, escuro(pedras[(i + j * 3) % 6], 0.2));
  });
  // carga e utensílios
  acessorio("bolsa", "meio", (g, c, P) => {
    // alforje pendurado na alça que cruza o peito (do ombro esquerdo ao quadril direito)
    const v = P.vista, y = P.yC + 1, alca = escuro(c[0], 0.2);
    const x = v === "lado" ? 14 : v === "frente" ? 23 : 13;
    if (v === "frente") linF(g, 14, P.yT, x + 1, y - 1, (X, Y, i) => (i % 3 ? alca : c[1] || c[0]));
    else if (v === "costas") linF(g, 26, P.yT, x + 2, y - 1, alca);
    else linF(g, 21, P.yT, x + 2, y - 1, alca);
    retF(g, x, y, 4, 5, (X, Y) => (Y === y ? c[1] || c[0] : X === x + 3 || Y === y + 4 ? escuro(c[0], 0.25) : X === x ? claro(c[0], 0.12) : c[0]));
    g.fino(x + 1, y + 1, c[1] || claro(c[0], 0.2));
  });
  acessorio("odre", camadaPorVista("meio", "meio", "fundo"), (g, c, P) => {
    const x = P.vista === "lado" ? 15 : P.vista === "frente" ? 27 : 12;
    elipF(g, x + 1, 36, 3, 4, (nx, ny) => (nx + ny < -0.4 ? c[1] || claro(c[0], 0.2) : nx + ny > 0.5 ? escuro(c[0], 0.25) : c[0]));
    retF(g, x, 30, 2, 3, c[1] || c[0]);
  });
  acessorio("saco", camadaPorVista("fundo", "meio", "meio"), (g, c, P) => {
    const [x, y] = P.maoEscudo, cx = P.vista === "lado" ? 13 : x + (P.vista === "frente" ? 1 : -2);
    const cy = P.vista === "lado" ? 33 : y + 4;
    elipF(g, cx, cy, 3.8, 4.2, (nx, ny) => (nx + ny < -0.4 ? c[1] || claro(c[0], 0.2) : nx + ny > 0.5 ? escuro(c[0], 0.25) : c[0]));
    retF(g, Math.round(cx) - 1, cy - 5, 2, 2, escuro(c[0], 0.2));
  });
  acessorio("jarro", camadaPorVista("frente", "frente", "meio"), (g, c, P) => {
    const [x, y] = P.maoEscudo, cx = P.vista === "lado" ? 28 : x + (P.vista === "frente" ? 1 : -2), cy = P.vista === "lado" ? 31 : y + 1;
    elipF(g, cx, cy, 4.2, 4.6, (nx, ny) => tom([c[1], c[0], c[2] || claro(c[0], 0.2)], -(0.6 * nx + 0.8 * ny)));
    retF(g, Math.round(cx) - 2, cy - 6, 4, 2, c[1]); retF(g, Math.round(cx) - 3, cy - 7, 6, 1, c[0]);
    g.fino(Math.round(cx) - 2, cy - 1, c[2] || claro(c[0], 0.3));
  });
  acessorio("fardo", camadaPorVista("fundo", "fundo", "frente"), (g, c, P) => {
    const dy = P.dy, R = [claro(c[0], 0.15), c[0], c[1] || escuro(c[0], 0.2), escuro(c[0], 0.35)];
    if (P.vista === "lado") { retF(g, 9, 20 + dy, 7, 13, (X, Y) => (Y % 4 === 0 ? R[2] : tomPano(R, X, 9, 15))); return; }
    if (P.vista === "frente") { retF(g, 10, 17 + dy, 20, 6, (X, Y) => (Y === 17 + dy ? R[0] : tomPano(R, X, 10, 29))); return; }
    retF(g, 11, 19 + dy, 18, 15, (X, Y) => (Y % 4 === 0 ? R[2] : tomPano(R, X, 11, 28)));
    linF(g, 14, 19 + dy, 14, 33 + dy, "#5a3a24"); linF(g, 25, 19 + dy, 25, 33 + dy, "#5a3a24");
  });
  acessorio("corda", "meio", (g, c, P) => {
    const y = P.yT + 5, x = P.vista === "frente" ? 26 : P.vista === "costas" ? 14 : 17;
    elipF(g, x, y, 4.2, 4.2, (nx, ny) => { const r = nx * nx + ny * ny; return r < 0.22 ? null : (Math.round(r * 6) % 2 ? c[0] : c[1]); });
  });
  acessorio("rede", camadaPorVista("fundo", "meio", "meio"), (g, c, P) => {
    const y = P.yT, x0 = P.vista === "frente" ? 26 : P.vista === "costas" ? 6 : 9;
    for (let j = 0; j < 14; j++) for (let i = 0; i < 8; i++) if ((i + j) % 3 === 0 || (i - j + 30) % 3 === 0) g.fino(x0 + i, y + j, (i + j) % 2 ? c[0] : escuro(c[0], 0.2));
  });
  acessorio("shofar", "meio", (g, c, P) => {
    if (P.vista === "costas") return;
    const x = P.vista === "frente" ? 23 : 16, y = P.yC + 2;
    linF(g, x, y, x + 5, y + 2, c[0], 2); g.fino(x - 1, y - 1, c[1]); g.fino(x, y - 1, c[1]); g.fino(x + 6, y + 2, c[2]); g.fino(x + 6, y + 3, c[2]);
  });
  acessorio("pele_leopardo", "meio", (g, c, P) => {
    const y = P.yT, mancha = (X, Y) => (X * 3 + Y * 5) % 7 === 0;
    if (P.vista === "costas") { retF(g, 21, y, 6, 10, (X, Y) => (mancha(X, Y) ? "#3a2414" : "#d8a040")); return; }
    const x0 = P.vista === "frente" ? 12 : 16;
    retF(g, x0, y, 7, 10, (X, Y) => (mancha(X, Y) ? "#3a2414" : X === x0 ? "#f0c868" : "#d8a040"));
  });
  acessorio("estola", "meio", (g, c, P) => {
    // manto sobre um ombro, caindo pelo lado direito do corpo
    const dy = P.dy, [M, m, n] = c, y0 = 22;
    if (P.vista === "frente") {
      for (let Y = y0; Y <= 42; Y++) {
        const x0 = Y < 32 ? Math.round(15 + (Y - y0) * 0.8) : 23, x1 = Y < y0 + 2 ? x0 + 4 : 28;
        for (let X = x0; X <= x1; X++) g.fino(X, Y + (Y < 34 ? dy : 0), X === x0 ? M : X >= x1 - 1 ? n : m);
      }
    } else if (P.vista === "costas") {
      for (let Y = y0; Y <= 42; Y++) { const x0 = 11, x1 = Y < 32 ? Math.round(23 - (Y - y0) * 0.4) : 18; for (let X = x0; X <= x1; X++) g.fino(X, Y + (Y < 34 ? dy : 0), X === x0 ? M : X === x1 ? n : m); }
    } else for (let Y = y0; Y <= 42; Y++) for (let X = 16; X <= 22; X++) g.fino(X, Y + (Y < 34 ? dy : 0), X === 16 ? M : X === 22 ? n : m);
  });
  // efeitos de mão
  acessorio("brilho", "frente", (g, c, P) => {
    if (P.q !== 1 && P.q !== 4) return;
    const [hx0, hy] = P.maoArma, hx = hx0 - 1, y = hy - (c[1] || 0);
    g.fino(hx, y - 4, c[0]); g.fino(hx - 2, y - 2, c[0]); g.fino(hx + 2, y - 3, c[0]); g.fino(hx, y - 6, claro(c[0], 0.5)); g.fino(hx + 3, y - 6, claro(c[0], 0.3));
  });
  acessorio("funda", "frente", (g, c, P) => {
    const [hx, hy] = P.maoArma;
    const pos = [[31, 3], [24, 1], [13, 3], [22, 5], [34, 5]][P.q];
    const px = P.vista === "costas" ? 40 - pos[0] : pos[0];
    linF(g, hx - 1, hy - 1, px, pos[1] + 2, c[0]); elipF(g, px, pos[1], 1.6, 1.6, c[1] || "#8a8478");
  });
  // Funda na mão do jogador: as duas cordas caem do punho até a bolsa com a pedra; no golpe, gira no alto.
  acessorio("funda_mao", "frente", (g, c, P) => {
    const [hx, hy] = P.maoArma;
    if (P.q === 4) { linF(g, hx - 1, hy - 1, hx + (P.vista === "costas" ? -5 : 5), hy - 9, c[0]); elipF(g, hx + (P.vista === "costas" ? -5 : 5), hy - 10, 1.6, 1.4, c[1]); return; }
    linF(g, hx - 2, hy + 1, hx - 2, hy + 5, c[0]); linF(g, hx, hy + 1, hx, hy + 5, escuro(c[0], 0.25));
    retF(g, hx - 3, hy + 6, 4, 2, (X, Y) => (Y === hy + 6 ? c[0] : escuro(c[0], 0.3))); g.fino(hx - 2, hy + 6, c[1]);
  });

  // Peças do corpo do jogador (boneco): capacete de couro (calota com costura e aba, sem nasal) e as que
  // pintam por cima do corpo já desenhado — grevas (canela), botas (tornozelo e pé) e saiote (tiras de couro
  // sobre a saia). Elas trocam as cores da pele (ou da saia) só nas linhas da perna, então seguem o passo e as
  // 3 vistas sem desenho próprio por quadro. Poucas cores novas (o sprite tem no máximo 24 e funde as raras):
  // as grevas usam 2 tons de bronze; botas e saiote usam o couro das sandálias, que o boneco já tem.
  acessorio("capacete", "frente", (g, c, P) => {
    const T = P.T, v = P.vista, cx = v === "lado" ? 19.5 : 20, R = [claro(c[0], 0.24), c[0], escuro(c[0], 0.3)];
    elipF(g, cx, T + 5.5, 8.6, 6.8, (nx, ny, X, Y) => (Y > T + 5 ? null : nx + ny < -0.75 ? R[0] : nx > 0.5 ? R[2] : R[1]));
    // costura do meio e a aba clara
    if (v === "lado") linF(g, 19, T - 1, 24, T + 4, R[2]); else for (let Y = T - 1; Y <= T + 4; Y++) g.fino(20, Y, R[2]);
    retF(g, Math.round(cx) - 9, T + 5, 18, 1, (X) => (X < cx + 4 ? R[0] : R[2]));
    if (v === "lado") retF(g, 14, T + 6, 3, 4, (X) => (X === 14 ? R[1] : R[2])); // a orelheira
  });
  function recolorir(g, y0, y1, de, para) {
    for (let Y = y0; Y <= y1; Y++) for (let X = 0; X < 40; X++) {
      const i = de.indexOf(g.gf(X, Y));
      if (i >= 0) g.fino(X, Y, para[i]);
    }
  }
  const linhaComPele = (g, k, ys) => ys.find((Y) => { for (let X = 0; X < 40; X++) if (k.pele.includes(g.gf(X, Y))) return true; return false; });
  acessorio("grevas", "meio", (g, c, P, cfg) => {
    // placa de bronze da canela, do joelho ao tornozelo, num tom só: o acabamento do contorno já dá o
    // realce à esquerda e a sombra à direita (2 tons a mais seriam raros demais e se fundiriam na pele)
    recolorir(g, 38, 42, coresHumano(cfg).pele, [c[0], c[0], c[0], c[0]]);
  });
  acessorio("botas", "meio", (g, c, P, cfg) => {
    const k = coresHumano(cfg), S = k.sand;
    // o cano sobe até o meio da canela; com grevas, só o que sobrou da perna (do tornozelo para baixo)
    const topo = linhaComPele(g, k, [39, 40, 41, 42]) ?? 43;
    recolorir(g, topo, 45, k.pele, [S[0], S[1], S[1], S[2]]);
    if (topo === 39) recolorir(g, 39, 39, [S[1]], [S[0]]); // o cano dobrado
  });
  acessorio("saiote", "meio", (g, c, P, cfg) => {
    const k = coresHumano(cfg), S = k.sand;
    // tiras de couro de 2 px com o vão escuro entre elas, do quadril até 1 px abaixo da barra (a barra da
    // veste usa a cor do cinto)
    for (let Y = P.yR; Y <= 38; Y++) for (let X = 8; X < 32; X++) {
      const cor = g.gf(X, Y);
      const saia = k.pernas.includes(cor) || (Y === 37 && k.cinto.includes(cor));
      const perna = Y === 38 && k.pele.includes(cor);
      if ((!saia && !perna) || (perna && X % 3 === 2)) continue;
      g.fino(X, Y, X % 3 === 2 ? S[2] : X % 3 === 0 && Y < 38 ? S[0] : S[1]);
    }
  });

  // Armaduras do jogador (por cima da veste): couro (colete com ombreiras e rebites) e escamas.
  // f desenha o colete (antes dos braços); ombros, as ombreiras (por cima dos braços).
  const ARMADURAS = {
    tunica_pano: { veste: { R: "#c9d4e0", r: "#a8b8c8", d: "#7f90a4" }, gola: "#3b5a9a" },
    armadura_couro: {
      f: (g, P) => {
        const v = P.vista, L = ["#b07a42", "#8a5a34", "#5e3a22", "#3e2416"], y0 = P.yT + 1, y1 = P.yC + 2;
        const x0 = v === "lado" ? 14 : 12, x1 = v === "lado" ? 26 : 27;
        for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) g.fino(X, Y, Y === y1 ? L[3] : (Y - y0) % 4 === 3 ? L[2] : tomPano(L, X, x0, x1));
        if (v === "frente") { for (const [x, y] of [[14, 3], [25, 3], [14, 7], [25, 7]]) g.fino(x, y0 + y, "#e8b94a"); retF(g, 18, y0, 4, 2, "#f0d0a0"); }
      },
      ombros: (g, P) => {
        const L = ["#b07a42", "#8a5a34", "#5e3a22"], y = P.yT - 1;
        if (P.vista === "lado") { elipF(g, 20, y + 3, 3.4, 2.6, (nx, ny) => (nx + ny < -0.3 ? L[0] : ny > 0.4 ? L[2] : L[1])); return; }
        elipF(g, 9.5, y + 3, 3.6, 2.6, (nx, ny) => (nx + ny < -0.3 ? L[0] : ny > 0.4 ? L[2] : L[1]));
        elipF(g, 30.5, y + 3, 3.6, 2.6, (nx, ny) => (ny > 0.3 || nx > 0.3 ? L[2] : L[1]));
      },
    },
    couraca_escamas: {
      f: (g, P) => {
        const v = P.vista, E = ["#e2b264", "#b07a38", "#7a4a24"], y0 = P.yT + 1, y1 = P.yC - 1;
        const x0 = v === "lado" ? 14 : 12, x1 = v === "lado" ? 26 : 27;
        for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const fila = (Y - y0) >> 1, off = fila % 2; g.fino(X, Y, (X + off) % 3 === 0 && (Y - y0) % 2 ? E[2] : (Y - y0) % 2 ? E[1] : X < x0 + 3 ? E[0] : misturar(E[0], E[1], 0.4)); }
        for (let X = x0 - 1; X <= x1 + 1; X += 2) retF(g, X, P.yC + 2, 1, 5, X % 4 === 1 ? E[1] : E[2]);
      },
      ombros: (g, P) => {
        const E = ["#e2b264", "#b07a38", "#7a4a24"], y = P.yT - 1;
        if (P.vista === "lado") { elipF(g, 20, y + 3, 3.4, 2.6, (nx, ny) => (nx + ny < -0.3 ? E[0] : ny > 0.4 ? E[2] : E[1])); return; }
        elipF(g, 9.5, y + 3, 3.6, 2.6, (nx, ny) => (nx + ny < -0.3 ? E[0] : ny > 0.4 ? E[2] : E[1]));
        elipF(g, 30.5, y + 3, 3.6, 2.6, (nx, ny) => (ny > 0.3 || nx > 0.3 ? E[2] : E[1]));
      },
    },
  };

  // Desenha um humano numa vista e quadro.
  function desenharHumano(g, cfg, quadro) {
    const vista = VISTAS[Math.floor(quadro / QUADROS_POR_VISTA)] || "lado";
    const q = quadro % QUADROS_POR_VISTA;
    const P = pose(vista, q);
    // montado: as duas mãos seguram as rédeas à frente do corpo
    if (cfg.montado && q !== 4) {
      if (vista === "lado") P.maoArma = [25, 31 + P.dy];
      else { P.escudoEm = P.maoEscudo; P.maoArma = vista === "frente" ? [15, 33 + P.dy] : [26, 33 + P.dy]; P.maoEscudo = vista === "frente" ? [26, 33 + P.dy] : [15, 33 + P.dy]; }
    }
    const c = coresHumano(cfg);
    const acs = (cfg.acessorios || []).map(([nome, cores]) => [ACESSORIOS[nome], cores, nome]).filter((a) => a[0]);
    const camada = (a) => (typeof a.camada === "function" ? a.camada(vista) : a.camada);
    for (const [a, cores] of acs) if (camada(a) === "fundo") a.f(g, cores, P, cfg);
    corpo(g, cfg, c, P);
    const arm = cfg.armadura && ARMADURAS[cfg.armadura];
    if (arm && arm.f) arm.f(g, P);
    if (cfg.extraCorpo) cfg.extraCorpo(g, P, c);
    for (const [a, cores] of acs) if (camada(a) === "meio") a.f(g, cores, P, cfg);
    cabeca(g, cfg, c, P);
    bracos(g, cfg, c, P, false);
    if (arm && arm.ombros) arm.ombros(g, P);
    for (const [a, cores] of acs) if (camada(a) === "frente") a.f(g, cores, P, cfg);
    // a mão da arma por cima do cabo
    if (acs.some(([a]) => camada(a) === "frente")) bracos(g, cfg, c, P, true);
    if (cfg.extra) cfg.extra(g, P, c);
  }

  // Registra um humano: cfg = { molde, cores, barba, cabelo, porte, gola, capuz, mangaCor, armadura,
  // acessorios, barra (barra da veste na cor do cinto), hostil, duasMaosOcupadas, extra(g, P, c) }.
  function humano(chave, cfg) {
    if (cfg.armadura && ARMADURAS[cfg.armadura]?.veste) {
      cfg = Object.assign({}, cfg, { cores: Object.assign({}, cfg.cores, ARMADURAS[cfg.armadura].veste), gola: cfg.gola || ARMADURAS[cfg.armadura].gola });
    }
    return registrar(chave, {
      w: 20, h: 24, quadros: QUADROS_POR_VISTA * VISTAS.length, direcoes: VISTAS.length, contorno: cfg.hostil ? "hostil" : "amigo", origem: [0.5, 1],
      humano: true, retratoQuadro: QUADROS_POR_VISTA + 4, busto: [4, 2, 12, 10],
      desenhar(g, quadro) { desenharHumano(g, cfg, quadro); },
    });
  }

  // Jogador: o equipamento escolhe acessórios (arma, arco/funda, escudo) e a armadura (P2).
  const LAMINAS = {
    espada_madeira: ["#8a6038", "#d9a35c", "#4f3220", "#4f3220"],
    espada_ferro: ["#6e7a84", "#e4ecf0", "#b07a38", "#5a3624"],
    espada_temperada: ["#5a7896", "#e8f0f8", "#e8b94a", "#5a3624"],
  };
  const CORES_ESCUDO = {
    escudo_madeira: ["#8a5a32", "#4f3220", "#b07a3e"],
    escudo_bronze: ["#b07a38", "#7a4a24", "#f2d27a"],
    escudo_ferro: ["#8a949c", "#4a5258", "#d4dce2"],
  };
  const ARCOS = { arco_madeira: ["#9a6a3c", "#eadcb6"], arco_composto: ["#6e3a24", "#f0e4c4"] };
  // Peças do corpo vistas no boneco: [acessório, cores]. Colar e anel são pequenos demais para o mundo.
  const PECAS_CORPO = {
    turbante_linho: ["turbante", ["#ddd0b0", "#a8916a"]],
    capacete_couro: ["capacete", ["#7a4a2c", "#a8703a"]],
    elmo_bronze: ["elmo", ["#a87234", "#e8b94a"]],
    saiote_couro: ["saiote", ["#8a5a32", "#e8b94a"]],
    grevas_bronze: ["grevas", ["#b07a38", "#f2d27a"]],
    botas_viagem: ["botas", ["#6a4228", "#9a6a3c"]],
  };
  const base = (id) => String(id || "").split("@")[0];
  const ehDistancia = (id) => typeof ITENS !== "undefined" && ITENS[base(id)]?.tipo === "arma_distancia";
  // Cores do visual (JGB-49): cabeça, tronco, pernas e detalhe, ids da paleta CORES_VISUAL
  // (dados/cosmeticos.js); null ou ausente = a cor do traje (ou a do boneco sem traje).
  const PARTES_COR = ["cabeca", "tronco", "pernas", "detalhe"];
  const corDaPaleta = (id) => (id && typeof CORES_VISUAL !== "undefined" && CORES_VISUAL.find((x) => x.id === id)?.cor) || null;
  function chaveJogador(eq = {}, visual = {}) {
    const cores = PARTES_COR.map((k) => (corDaPaleta(visual.cores?.[k]) ? visual.cores[k] : ""));
    const partes = [base(eq.arma), "", base(eq.escudo), base(eq.armadura), visual.traje || "", visual.montaria || ""];
    const corpo = ["cabeca", "pernas", "pes"].map((s) => (PECAS_CORPO[base(eq[s])] ? base(eq[s]) : ""));
    if (corpo.some(Boolean)) partes.push("e:" + corpo.join("."));
    if (cores.some(Boolean)) partes.push("c:" + cores.join("."));
    return "pj_jogador" + (partes.some(Boolean) ? "|" + partes.join("|") : "");
  }
  // Panos da cabeça que tomam a cor da cabeça (o elmo é metal e fica como é).
  const PANOS_CABECA = new Set(["turbante", "faixa", "bandana", "nemes"]);
  // visual: cosméticos (JGB-27) — traje (outfit), montaria e cores (JGB-49); só mudam a aparência.
  function garantirJogador(eq = {}, visual = {}) {
    const chave = chaveJogador(eq, visual);
    if (PIXEL_PATTERNS[chave]) return chave;
    const traje = (visual.traje && typeof TRAJES !== "undefined" && TRAJES[visual.traje]?.visual) || null;
    const cab = corDaPaleta(visual.cores?.cabeca), tro = corDaPaleta(visual.cores?.tronco);
    const per = corDaPaleta(visual.cores?.pernas), det = corDaPaleta(visual.cores?.detalhe);
    const acessorios = [["bolsa", ["#7a4a30", "#a8703a"]]].concat((traje?.acessorios || []).map(([nome, cores]) =>
      cab && PANOS_CABECA.has(nome) ? [nome, [cab].concat(cores.slice(1))] : [nome, cores]));
    // Peças do corpo (com traje não aparecem: o traje decide a roupa, como com a armadura). As grevas pintam a
    // canela antes das botas; o turbante toma a cor da cabeça escolhida, como os panos dos trajes.
    if (!traje) for (const s of ["pernas", "pes", "cabeca"]) {
      const pc = PECAS_CORPO[base(eq[s])];
      if (pc) acessorios.push(cab && PANOS_CABECA.has(pc[0]) ? [pc[0], [cab].concat(pc[1].slice(1))] : pc);
    }
    // Uma mão para a arma (o arco usa as duas): arco ou funda na mão, ou a espada.
    const arma = base(eq.arma);
    if (arma === "funda") acessorios.push(["funda_mao", ["#8a6a42", "#a8a090"]]);
    else if (ehDistancia(arma)) acessorios.push(["arco_mao", ARCOS[arma] || ARCOS.arco_madeira]);
    else if (arma) acessorios.push(["espada", LAMINAS[arma] || LAMINAS.espada_ferro]);
    if (eq.escudo) acessorios.push(["escudo_redondo", CORES_ESCUDO[base(eq.escudo)] || CORES_ESCUDO.escudo_madeira]);
    const cores = Object.assign({ H: "#4a2f20", S: "#e0a878", s: "#c68a5c", R: "#eadcb6", r: "#d4bf8f", d: "#a8916a", P: "#d4bf8f", p: "#b8a07a", q: "#8a7656", A: "#3b5a9a", F: "#5a3a24" }, traje?.cores);
    if (traje?.cores && !traje.cores.P) { delete cores.P; delete cores.p; delete cores.q; }
    if (cab) { cores.H = cab; if (traje?.molde === "veu") { cores.V = cab; cores.W = rampaDe(cab)[2]; } }
    if (tro) [cores.R, cores.r, cores.d] = rampaDe(tro);
    if (per) [cores.P, cores.p, cores.q] = rampaDe(per);
    if (det) cores.A = det;
    const cfg = {
      molde: traje?.molde || "curta", barba: false, barra: true,
      cores,
      armadura: traje ? null : base(eq.armadura) || null,
      gola: det || traje?.gola, cabelo: traje?.cabelo,
      acessorios,
    };
    // a túnica de pano é pano: com a cor do tronco escolhida, ela toma essa cor (fica só a gola dela)
    if (tro && ARMADURAS[cfg.armadura]?.veste) { cfg.gola = cfg.gola || ARMADURAS[cfg.armadura].gola; cfg.armadura = null; }
    if (visual.montaria) registrarMontado(chave, cfg, visual.montaria);
    else humano(chave, cfg);
    return chave;
  }
  garantirJogador({});

  // -------------------------------------------------------------------
  // Montarias (JGB-27, redesenhadas na JGB-49): jumento, camelo, cavalo e carro, só visuais. Célula de
  // 56 × 64 px de arte (28 × 32 unidades), chão na linha 61; 3 vistas × 5 quadros como os humanos (no
  // passo, as pernas vão em pares diagonais e o corpo desce 1 px). O cavaleiro é o boneco do jogador com
  // cfg.montado, desenhado entre a parte de trás ("fundo") e a da frente ("frente") da montaria.
  // -------------------------------------------------------------------
  const CHAO_MT = 61, W_MT = 28, H_MT = 32;
  const MONTARIAS_ARTE = {
    // cavalo castanho de crina escura, meia branca na pata de trás, manta azul com franja de ouro
    cavalo: {
      pelo: ["#c8874c", "#9c5c30", "#6e3c20", "#48250f"], ventre: "#b87a46", focinho: "#4e3020", crina: ["#4a3020", "#2a1a12", "#160c08"], casco: "#2e2018",
      corpo: [27, 41, 12, 6.5], anca: [16, 39.5, 7.5, 7.2], peito: [37, 40.5, 6.5, 7], pernas: { topo: 45, joelho: 53, larg: 4 },
      pescoco: [[38, 36, 5.2], [40.5, 31, 4.4], [43, 26.5, 3.8]], testa: [45.5, 23.5, 3.8, 3.4], focinho2: [50, 27.5, 3.2, 2.8],
      orelhas: [[43, 20], [45, 19.5]], cauda: "longa", meia: true, mancha: true,
      manta: ["#6d8fc4", "#3b5a9a", "#22356a"], franja: "#e8b94a", couro: ["#a8703a", "#7a4a24", "#4f3220"], sela: [25, 33],
    },
    // jumento cinzento, focinho e barriga claros, cruz escura no lombo e orelhas compridas
    jumento: {
      pelo: ["#b4aa9a", "#8c8274", "#655c50", "#463e36"], ventre: "#ddd6c6", focinho: "#e6dfd0", crina: ["#5a524a", "#3e3830", "#2a2420"], casco: "#2a2420",
      corpo: [26, 44, 11, 6], anca: [16.5, 43, 6.5, 6.5], peito: [35, 43.5, 6, 6.5], pernas: { topo: 48, joelho: 54, larg: 4 },
      pescoco: [[36, 40, 4.8], [39, 36, 4.2], [41.5, 32.5, 3.8]], testa: [43.5, 30.5, 3.8, 3.4], focinho2: [48, 34, 3.4, 3.2],
      orelhas: [[41, 23], [44, 22.5]], orelhaLonga: true, cauda: "tufo", cruz: true,
      manta: ["#e2774f", "#c2452d", "#8e2a1f"], franja: "#e8b94a", couro: ["#a8703a", "#7a4a24", "#4f3220"], sela: [24, 37],
    },
    // camelo de uma corcova, pernas compridas de joelho grosso, tapete listrado com borlas sobre a corcova
    camelo: {
      pelo: ["#e8c890", "#c8a066", "#9c7646", "#6e5030"], ventre: "#ecd8ae", focinho: "#b08a58", crina: ["#a8824e", "#8a6a3e", "#6a4e2c"], casco: "#7a5a3a",
      corpo: [25, 37, 11.5, 6.2], anca: [15.5, 37, 6.5, 6.4], peito: [34.5, 37.5, 6, 6.5], pernas: { topo: 41, joelho: 51, larg: 3 },
      pescoco: [[37, 37.5, 4.2], [41, 38, 3.6], [44, 34, 3.3], [45.5, 29, 3], [46.5, 24.5, 2.9]], testa: [48, 21.5, 3.6, 3], focinho2: [51.5, 23.5, 2.8, 2.4],
      orelhas: [[46, 18.5]], cauda: "tufo", corcova: [24, 29, 7, 5.5], patas: true,
      manta: ["#e2774f", "#c2452d", "#8e2a1f"], franja: "#e8b94a", listra: "#3b5a9a", couro: ["#a8703a", "#7a4a24", "#4f3220"], sela: [24, 27],
    },
  };
  const tomAnimal = (a, ventre = true) => (nx, ny) => (ventre && ny > 0.62 ? a.ventre : tom(a.pelo, -(0.45 * nx + 0.95 * ny) + 0.1));
  // Perna de lado: coxa/antebraço (larg px) até o joelho, canela mais fina, boleto e casco (ou pata larga).
  function pernaMt(g, a, x, sw, dy, longe, tras) {
    const R = longe ? [a.pelo[2], a.pelo[2], a.pelo[3], a.pelo[3]] : a.pelo;
    const p = a.pernas, kx = x + Math.round(sw / 2) + (tras ? -1 : 0), fx = x + sw;
    const m = bastao(new Set(), x, p.topo + dy, kx, p.joelho, p.larg);
    bastao(m, kx, p.joelho, fx, CHAO_MT - 3, Math.max(2, p.larg - 1));
    pintarMascara(g, m, R);
    if (a.meia && !longe && tras) retF(g, fx - 1, CHAO_MT - 6, 3, 3, (X) => (X === fx - 1 ? "#f4ecdc" : "#d8ccb6"));
    if (a.patas) retF(g, fx - 2, CHAO_MT - 2, 5, 2, (X, Y) => (Y === CHAO_MT - 2 ? claro(a.casco, longe ? 0 : 0.2) : a.casco));
    else retF(g, fx - 2, CHAO_MT - 3, 4, 3, (X, Y) => (Y === CHAO_MT - 3 ? claro(a.casco, longe ? 0.05 : 0.25) : X === fx + 1 ? escuro(a.casco, 0.3) : a.casco));
  }
  function mantaLado(g, a, sx, sy) {
    const [M0, M1, M2] = a.manta, [C0, C1, C2] = a.couro;
    // manta (com a franja embaixo) e a sela de couro por cima
    for (let Y = sy - 1; Y <= sy + 6; Y++) for (let X = sx - 7; X <= sx + 6; X++) {
      let cor = X <= sx - 6 ? M0 : X >= sx + 5 ? M2 : M1;
      if (Y === sy + 5) cor = a.franja;
      if (Y === sy + 6) cor = X % 2 ? a.franja : null;
      if (a.listra && (Y === sy + 1 || Y === sy + 3) && Y < sy + 5) cor = a.listra;
      if (cor) g.fino(X, Y, cor);
    }
    retF(g, sx - 5, sy - 2, 10, 2, (X, Y) => (Y === sy - 2 ? C0 : X > sx + 2 ? C2 : C1));
    retF(g, sx + 4, sy - 4, 2, 3, (X) => (X === sx + 4 ? C0 : C1));
    retF(g, sx - 6, sy - 3, 2, 2, C1);
    linF(g, sx + 1, sy + 6, sx + 1, sy + 10, C2); // loro do estribo
  }
  function animalLado(g, a, q) {
    const passo = q === 2 ? 1 : q === 3 ? -1 : 0, dy = q >= 1 && q <= 3 ? 1 : 0;
    const [cx, cy0, rx, ry] = a.corpo, cy = cy0 + dy;
    const tomP = tomAnimal(a);
    const xa = Math.round(a.anca[0]) + 1, xp = Math.round(a.peito[0]) - 1;
    // pernas de longe (mais escuras): par diagonal ao contrário das de perto
    pernaMt(g, a, xp - 2, 4 * -passo, dy, true, false);
    pernaMt(g, a, xa + 2, 4 * passo, dy, true, true);
    // cauda
    if (a.cauda === "longa") {
      for (let k = 0; k < 17; k++) { const x = Math.round(a.anca[0] - a.anca[2] + 1 - k * 0.32 + (k > 10 ? -passo : 0)); retF(g, x - 1, cy - 5 + k, 3 + (k > 4 && k < 13 ? 1 : 0), 1, (X) => (X === x - 1 ? a.crina[0] : (X + k) % 3 ? a.crina[1] : a.crina[2])); }
    } else {
      const x0 = Math.round(a.anca[0] - a.anca[2]);
      linF(g, x0 + 1, cy - 4, x0 - 1, cy + 5, a.pelo[2], 2);
      elipF(g, x0 - 0.5, cy + 7, 1.8, 2.6, (nx, ny) => (nx < -0.2 ? a.crina[0] : a.crina[1]));
    }
    // corpo: anca, barriga e peito
    elipF(g, a.anca[0], a.anca[1] + dy, a.anca[2], a.anca[3], tomP);
    elipF(g, cx, cy, rx, ry, tomP);
    elipF(g, a.peito[0], a.peito[1] + dy, a.peito[2], a.peito[3], tomP);
    if (a.corcova) { const [hx, hy, hrx, hry] = a.corcova; elipF(g, hx, hy + dy, hrx, hry, (nx, ny) => tom(a.pelo, -(0.5 * nx + 0.9 * ny) + 0.15)); }
    // pescoço, crina e cabeça
    for (let i = 0; i < a.pescoco.length - 1; i++) for (let t = 0; t <= 1; t += 0.125) {
      const [x0, y0, r0] = a.pescoco[i], [x1, y1, r1] = a.pescoco[i + 1];
      elipF(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + dy, r0 + (r1 - r0) * t, r0 + (r1 - r0) * t, tomAnimal(a, false));
    }
    const [tx, ty, trx, try_] = a.testa, [fx, fy, frx, fry] = a.focinho2;
    for (let t = 0; t <= 1; t += 0.2) elipF(g, tx + (fx - tx) * t, ty + (fy - ty) * t + dy, trx + (frx - trx) * t, try_ + (fry - try_) * t, tomAnimal(a, false));
    elipF(g, fx, fy + dy, frx, fry, (nx, ny) => (nx + ny < -0.6 ? claro(a.focinho, 0.15) : a.focinho));
    if (a.mancha) for (let t = 0.1; t <= 0.7; t += 0.15) g.fino(Math.round(tx + (fx - tx) * t + 1), Math.round(ty + (fy - ty) * t + dy - 2), "#f4ecdc");
    g.fino(Math.round(fx + frx - 1), Math.round(fy + dy - 1), escuro(a.focinho, 0.5)); // narina
    linF(g, Math.round(fx), Math.round(fy + fry + dy - 1), Math.round(fx + frx - 1), Math.round(fy + fry + dy - 1), escuro(a.focinho, 0.45)); // boca
    const ox = Math.round(tx - 0.5), oy = Math.round(ty + dy - 1);
    retF(g, ox, oy, 2, 1, "#1c1210"); g.fino(ox, oy - 1, "#1c1210"); g.fino(ox + 1, oy, "#3a2a24"); g.fino(ox, oy, "#fff6e0");
    for (const [ex, ey] of a.orelhas) {
      if (a.orelhaLonga) { linF(g, ex, ey + dy + 9, ex - 2, ey + dy, a.pelo[1], 2); g.fino(ex - 1, ey + dy + 3, "#d89a8a"); g.fino(ex - 2, ey + dy, a.crina[1]); }
      else { linF(g, ex, ey + dy + 4, ex - 1, ey + dy, a.pelo[1], 2); g.fino(ex - 1, ey + dy, a.pelo[2]); }
    }
    // crina ao longo do pescoço (e o topete)
    if (a.crina && !a.corcova) {
      const pts = a.pescoco;
      for (let i = 0; i < pts.length - 1; i++) for (let t = 0; t <= 1; t += 0.2) {
        const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t + dy, r = pts[i][2];
        const X = Math.round(x - r * 0.75), Y = Math.round(y - r * 0.75);
        retF(g, X, Y, 2, 2, a.crina[1]); g.fino(X - 1, Y + 1, a.crina[2]); if ((i + t * 5) % 2 < 1) g.fino(X + 1, Y + 2, a.crina[1]);
        g.fino(X, Y, a.crina[0]);
      }
      retF(g, Math.round(tx) - 1, Math.round(ty + dy - try_), 2, 2, a.crina[1]);
    } else if (a.corcova) { retF(g, 44, 25 + dy, 2, 6, a.crina[1]); g.fino(47, 18 + dy, a.crina[1]); }
    if (a.cruz) { linF(g, 18, cy - ry + 1, 33, cy - ry, a.pelo[3]); linF(g, 34, cy - ry - 1, 33, cy - ry + 5, a.pelo[3]); }
    // pernas de perto
    pernaMt(g, a, xp - 1, 4 * passo, dy, false, false);
    pernaMt(g, a, xa, 4 * -passo, dy, false, true);
    // manta, sela, cabeçada e rédeas
    const [sx, sy0] = a.sela, sy = sy0 + dy;
    mantaLado(g, a, sx, sy);
    const [C0, , C2] = a.couro;
    linF(g, Math.round(tx), Math.round(ty + dy - try_ + 1), Math.round(fx - 1), Math.round(fy + dy + 1), C2);
    linF(g, Math.round(fx), Math.round(fy + dy - fry + 1), Math.round(fx), Math.round(fy + dy + fry - 1), C2);
    // rédeas com folga: descem da boca e sobem até a mão do cavaleiro
    const mx = Math.round((fx + sx + 6) / 2), my = Math.max(Math.round(fy + dy + 1), sy - 2) + 3;
    linF(g, Math.round(fx - 1), Math.round(fy + dy + 1), mx, my, C0); linF(g, mx, my, sx + 6, sy - 2, C0);
    return [sx, sy];
  }
  // De frente: o lombo e as patas de trás atrás do cavaleiro; peito, pescoço, cabeça e patas da frente
  // por cima dele. Cabeça de frente (comprida, as orelhas em pé), pintada como uma forma só: luz da esquerda, focinho
  // embaixo, olhos nos lados, narinas, topete e a cabeçada com o frontal colorido.
  function cabecaFrenteMt(g, a, xs, y0, curta) {
    const P = a.pelo, F = [claro(a.focinho, 0.18), a.focinho, escuro(a.focinho, 0.25), escuro(a.focinho, 0.45)];
    const camelo = !!a.corcova, jumento = !!a.orelhaLonga;
    const HW = curta ? [3, 4, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3] : [5, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 4, 4, 4, 4, 3];
    const n = HW.length, fz = n - (curta ? 4 : 5);
    // orelhas
    for (const s of [-1, 1]) {
      const ox = xs + s * (jumento ? 5 : 4) - (s > 0 ? 2 : 0), comp = jumento ? 7 : camelo ? 2 : 5;
      const m = bastao(new Set(), ox + 1, y0, ox + 1 + s * (jumento ? 5 : 1), y0 - comp, 2);
      pintarMascara(g, m, s < 0 ? [P[0], P[1], P[2], P[2]] : [P[1], P[2], P[3], P[3]]);
      if (jumento) { g.fino(ox + s + (s < 0 ? 1 : 0), y0 - 4, "#d89a8a"); g.fino(ox + 1 + s * 5, y0 - comp, a.crina[1]); }
    }
    for (let i = 0; i < n; i++) {
      const hw = HW[i], x0 = xs - hw, x1 = xs + hw - 1, Y = y0 + i;
      for (let X = x0; X <= x1; X++) g.fino(X, Y, i >= fz ? tomPano(F, X, x0, x1) : tomPano(P, X, x0, x1));
    }
    if (a.mancha) retF(g, xs - 1, y0 + 1, 2, fz - 1, (X, Y) => (X === xs - 1 ? "#f4ecdc" : "#d8ccb6"));
    // olhos nos lados, narinas, topete
    const ye = y0 + 3;
    retF(g, xs - HW[3], ye, 1, 2, "#1c1210"); g.fino(xs - HW[3] + 1, ye, "#fff6e0");
    retF(g, xs + HW[3] - 1, ye, 1, 2, "#1c1210");
    g.fino(xs - 2, y0 + n - 2, F[3]); g.fino(xs + 1, y0 + n - 2, F[3]);
    if (!camelo) retF(g, xs - 2, y0 - 1, 4, 3, (X, Y) => (Y === y0 - 1 ? a.crina[0] : (X + Y) % 2 ? a.crina[1] : a.crina[2]));
    else retF(g, xs - 2, y0 + n - 1, 4, 1, F[2]); // beiço caído do camelo
    // cabeçada
    const C = a.couro[2];
    for (let X = xs - HW[1]; X <= xs + HW[1] - 1; X++) g.fino(X, y0 + 1, C);
    for (let X = xs - HW[fz]; X <= xs + HW[fz] - 1; X++) g.fino(X, y0 + fz, C);
    retF(g, xs - 1, y0 + 1, 2, 1, a.franja);
  }
  function animalFrente(g, a, q, parte) {
    const passo = q === 2 ? 1 : q === 3 ? -1 : 0, dy = q >= 1 && q <= 3 ? 1 : 0;
    const P = a.pelo, tomP = (nx, ny) => tom(P, -(0.55 * nx + 0.85 * ny) + 0.15);
    const camelo = !!a.corcova, jumento = !!a.orelhaLonga, pequeno = !!a.pequeno;
    const yb = (camelo ? 38 : jumento ? 44 : 42) + dy, xs = 28;
    const perna = (x, ergue, longe, topo) => {
      const R = longe ? [P[2], P[2], P[3], P[3]] : [P[0], P[1], P[1], P[2]];
      pintarMascara(g, bastao(new Set(), x, topo, x, CHAO_MT - 3 - ergue, a.pernas.larg + 1), R);
      if (camelo) retF(g, x - 3, CHAO_MT - 2 - ergue, 6, 2, (X, Y) => (Y === CHAO_MT - 2 - ergue ? claro(a.casco, 0.2) : a.casco));
      else retF(g, x - 2, CHAO_MT - 3 - ergue, 5, 3, (X, Y) => (Y === CHAO_MT - 3 - ergue ? claro(a.casco, 0.2) : X === x + 2 ? escuro(a.casco, 0.3) : a.casco));
    };
    if (parte === "fundo") {
      // o corpo visto de frente vai para trás: o lombo largo (com a manta) e as patas de trás dos lados
      perna(xs - 10, passo === -1 ? 1 : 0, true, yb + 4); perna(xs + 9, passo === 1 ? 1 : 0, true, yb + 4);
      elipF(g, xs, yb + 2, pequeno ? 9 : 14, pequeno ? 6 : 8, (nx, ny) => (ny > 0.55 ? a.ventre : tomP(nx, ny)));
      if (camelo) elipF(g, xs, yb - 5, 8, 6, tomP);
      if (pequeno) return [xs, yb];
      const [M0, M1, M2] = a.manta, ym = yb - (camelo ? 9 : 6);
      for (let Y = ym; Y <= ym + 10; Y++) for (let X = xs - 14; X <= xs + 13; X++) {
        let cor = X < xs - 11 ? M0 : X > xs + 10 ? M2 : M1;
        if (Y === ym + 9) cor = a.franja;
        if (Y === ym + 10) cor = X % 2 ? a.franja : null;
        if (a.listra && (Y === ym + 3 || Y === ym + 5)) cor = a.listra;
        if (cor) g.fino(X, Y, cor);
      }
      return [xs, ym];
    }
    // patas da frente, peito largo e a cabeça baixa diante do cavaleiro
    perna(xs - 6, passo === 1 ? 1 : 0, false, yb + 10); perna(xs + 5, passo === -1 ? 1 : 0, false, yb + 10);
    elipF(g, xs, yb + 10, pequeno ? 7 : camelo ? 7.5 : 10, 5, tomP);
    if (camelo) elipF(g, xs, yb + 5, 4, 5, tomP); // pescoço
    cabecaFrenteMt(g, a, xs, yb + (camelo ? -1 : pequeno ? 3 : -3), pequeno || camelo);
  }
  // De costas: cabeça e orelhas atrás do cavaleiro; garupa, cauda e patas de trás por cima dele.
  function animalCostas(g, a, q, parte) {
    const passo = q === 2 ? -1 : q === 3 ? 1 : 0, dy = q >= 1 && q <= 3 ? 1 : 0;
    const P = a.pelo, tomP = (nx, ny) => tom(P, -(0.55 * nx + 0.85 * ny) + 0.15);
    const camelo = !!a.corcova, jumento = !!a.orelhaLonga;
    const yb = (camelo ? 38 : jumento ? 44 : 42) + dy, xs = 28;
    if (parte === "fundo") {
      const hy = yb - (camelo ? 19 : 14);
      elipF(g, xs, hy + 3, 5, 5, tomP);
      for (const s of [-1, 1]) linF(g, xs + s * 3 - (s > 0 ? 1 : 0), hy, xs + s * (jumento ? 6 : 4) - (s > 0 ? 1 : 0), hy - (jumento ? 10 : 5), s < 0 ? P[1] : P[2], 2);
      if (!camelo) retF(g, xs - 1, hy - 2, 2, 12, (X) => (X === xs - 1 ? a.crina[0] : a.crina[1]));
      elipF(g, xs, yb - 2, 12, 6, tomP);
      if (camelo) elipF(g, xs, yb - 6, 8, 6, tomP);
      const [M0, M1, M2] = a.manta, ym = yb - (camelo ? 9 : 6);
      for (let Y = ym; Y <= ym + 10; Y++) for (let X = xs - 14; X <= xs + 13; X++) {
        let cor = X < xs - 11 ? M0 : X > xs + 10 ? M2 : M1;
        if (Y === ym + 9) cor = a.franja;
        if (Y === ym + 10) cor = X % 2 ? a.franja : null;
        if (a.listra && (Y === ym + 3 || Y === ym + 5)) cor = a.listra;
        if (cor) g.fino(X, Y, cor);
      }
      return [xs, ym];
    }
    const perna = (x, ergue) => {
      pintarMascara(g, bastao(new Set(), x, yb + 8, x, CHAO_MT - 3 - ergue, a.pernas.larg + 1), P);
      if (camelo) retF(g, x - 3, CHAO_MT - 2 - ergue, 6, 2, a.casco);
      else retF(g, x - 2, CHAO_MT - 3 - ergue, 5, 3, (X, Y) => (Y === CHAO_MT - 1 - ergue ? escuro(a.casco, 0.2) : a.casco));
    };
    perna(xs - 7, passo === 1 ? 1 : 0); perna(xs + 6, passo === -1 ? 1 : 0);
    // garupa redonda com o vinco no meio
    for (const s of [-1, 1]) elipF(g, xs + s * 5 - (s > 0 ? 1 : 0), yb + 5, 8, 7.5, (nx, ny) => tom(P, -(0.55 * nx + 0.85 * ny) + (s < 0 ? 0.3 : -0.05)));
    linF(g, xs, yb, xs, yb + 11, P[3]); linF(g, xs - 1, yb, xs - 1, yb + 11, P[2]);
    if (a.cauda === "longa") for (let Y = yb - 1; Y <= yb + 17; Y++) { const w = Y < yb + 2 ? 2 : Y < yb + 13 ? 4 : 3, x = xs - (w >> 1) + (Y > yb + 11 ? passo : 0); retF(g, x, Y, w, 1, (X) => (X === x ? a.crina[0] : (X + Y) % 3 ? a.crina[1] : a.crina[2])); }
    else { retF(g, xs - 1, yb, 2, 9, (X) => (X === xs - 1 ? P[1] : P[2])); elipF(g, xs, yb + 11, 2, 2.8, (nx) => (nx < 0 ? a.crina[0] : a.crina[1])); }
  }
  // Carro: cavalo à frente, caixa de vime e a roda de raios; o cavaleiro vai de pé dentro.
  function roda(g, cx, cy, r, q) {
    elipF(g, cx, cy, r, r, (nx, ny) => { const d = Math.sqrt(nx * nx + ny * ny); return d > 0.8 ? (nx + ny < -0.4 ? "#a8703a" : d > 0.93 ? "#3e2a1a" : "#7a5530") : d < 0.24 ? (nx + ny < 0 ? "#e8b94a" : "#b07a38") : null; });
    for (let k = 0; k < 4; k++) { const ang = (k / 4) * Math.PI + (q % 2) * 0.4; linF(g, cx - Math.cos(ang) * (r - 1.2), cy - Math.sin(ang) * (r - 1.2), cx + Math.cos(ang) * (r - 1.2), cy + Math.sin(ang) * (r - 1.2), "#6b4a2e"); }
  }
  function carroVista(g, vista, q, parte) {
    const cav = MONTARIAS_ARTE.cavalo, dy = q >= 1 && q <= 3 ? 1 : 0;
    const vime = (X, Y, x0) => ((X + Y) % 3 === 0 ? "#7a5530" : (X - Y) % 4 === 0 ? "#c8964e" : X < x0 + 2 ? "#c08a48" : "#9a6a38");
    if (vista === "lado") {
      if (parte === "fundo") {
        // cavalo à frente (direita), menor, puxando pelo varal
        const pequeno = Object.assign({}, cav, {
          corpo: [41, 45, 8, 4.8], anca: [34.5, 44, 5, 5], peito: [47.5, 44.5, 4.5, 5], pernas: { topo: 48, joelho: 54, larg: 3 },
          pescoco: [[48.5, 40.5, 3.6], [50.5, 36.5, 3], [52, 33, 2.7]], testa: [53, 30.5, 2.8, 2.6], focinho2: [54.5, 34, 2.2, 2], orelhas: [[51, 27]],
          sela: [41, 41], meia: false,
        });
        const passo = q === 2 ? 1 : q === 3 ? -1 : 0;
        for (let k = 0; k < 11; k++) retF(g, Math.round(29.5 - k * 0.25), 41 + k + dy, 2, 1, k % 3 ? cav.crina[1] : cav.crina[2]);
        elipF(g, pequeno.anca[0], pequeno.anca[1] + dy, pequeno.anca[2], pequeno.anca[3], tomAnimal(cav));
        elipF(g, 41, 45 + dy, 8, 4.8, tomAnimal(cav));
        elipF(g, 47.5, 44.5 + dy, 4.5, 5, tomAnimal(cav));
        for (const [x, s, longe, tras] of [[45, -passo, true, false], [35, passo, true, true], [47, passo, false, false], [33, -passo, false, true]]) pernaMt(g, pequeno, x, 3 * s, dy, longe, tras);
        for (let t = 0; t <= 1; t += 0.2) elipF(g, 48.5 + 3.5 * t, 40.5 - 7.5 * t + dy, 3.6 - t, 3.6 - t, tomAnimal(cav, false));
        elipF(g, 53, 31 + dy, 2.8, 2.6, tomAnimal(cav, false)); elipF(g, 54.5, 34 + dy, 2.2, 2, cav.focinho);
        g.fino(52, 30 + dy, "#1c1210"); linF(g, 51, 28 + dy, 50, 25 + dy, cav.pelo[1], 2);
        for (let t = 0; t <= 1; t += 0.25) retF(g, Math.round(47.5 + 3.5 * t), Math.round(38 - 7 * t + dy), 2, 2, cav.crina[1]);
        // arreio e varal
        retF(g, 44, 40 + dy, 3, 9, (X) => (X === 44 ? "#e8b94a" : "#b07a38"));
        linF(g, 14, 47 + dy, 44, 44 + dy, "#6b4a2e", 2);
        linF(g, 54, 34 + dy, 26, 36 + dy, "#4f3220");
        return [14, 47 + dy];
      }
      // caixa do carro por cima das pernas do cavaleiro e a roda
      for (let Y = 37 + dy; Y <= 50 + dy; Y++) { const x0 = Y < 40 + dy ? 4 + (40 + dy - Y) : 4, x1 = 26; for (let X = x0; X <= x1; X++) g.fino(X, Y, Y === 37 + dy || X === x1 ? "#e8b94a" : Y === 50 + dy ? "#5e3c1c" : vime(X, Y, x0)); }
      retF(g, 4, 43 + dy, 23, 1, "#b07a38");
      roda(g, 15, 52, 9, q);
      return;
    }
    if (parte === "fundo") {
      roda(g, 6, 51, 7.5, q); roda(g, 49, 51, 7.5, q);
      if (vista === "costas") { elipF(g, 28, 26 + dy, 3.6, 4, tomAnimal(cav, false)); linF(g, 25, 23 + dy, 24, 19 + dy, cav.pelo[1], 2); linF(g, 30, 23 + dy, 31, 19 + dy, cav.pelo[2], 2); }
      return [28, 49 + dy];
    }
    for (let Y = 41 + dy; Y <= 52 + dy; Y++) for (let X = 11; X <= 44; X++) g.fino(X, Y, Y === 41 + dy ? "#e8b94a" : Y === 52 + dy ? "#5e3c1c" : X === 11 ? "#c8964e" : X === 44 ? "#6b4a2e" : vime(X, Y, 11));
    retF(g, 11, 46 + dy, 34, 1, "#b07a38");
    if (vista === "frente") {
      // o cavalo, menor, de frente diante da caixa
      const pequeno = Object.assign({}, cav, { pequeno: true, pernas: { topo: 46, joelho: 54, larg: 3 } });
      animalFrente(g, pequeno, q, "frente");
    }
  }
  function desenharMontaria(g, tipo, vista, q, parte) {
    if (tipo === "carro") return carroVista(g, vista, q, parte);
    const a = MONTARIAS_ARTE[tipo] || MONTARIAS_ARTE.jumento;
    if (vista === "lado") return parte === "fundo" ? animalLado(g, a, q) : null;
    if (vista === "frente") return animalFrente(g, a, q, parte);
    return animalCostas(g, a, q, parte);
  }
  // Montaria sozinha (para a loja): de lado, parada.
  for (const tipo of ["jumento", "cavalo", "camelo", "carro"])
    registrar("mt_" + tipo, { w: W_MT, h: H_MT, quadros: 1, contorno: "amigo", origem: [0.5, 1], desenhar(g) { desenharMontaria(g, tipo, "lado", 0, "fundo"); desenharMontaria(g, tipo, "lado", 0, "frente"); } });

  // Jogador montado: montaria (fundo) + boneco sentado (ou de pé no carro) + montaria (frente).
  // A sela devolve [x, y] onde fica o quadril (linha yR = 33 do boneco); no carro, o chão da caixa.
  function registrarMontado(chave, cfg, tipo) {
    const cav = Object.assign({}, cfg, { montado: tipo !== "carro" });
    return registrar(chave, {
      w: W_MT, h: H_MT, quadros: QUADROS_POR_VISTA * VISTAS.length, direcoes: VISTAS.length, contorno: "amigo", origem: [0.5, 1],
      humano: true, montado: tipo, retratoQuadro: QUADROS_POR_VISTA, busto: [6, 0, 16, 14], limiteCores: 32,
      desenhar(g, quadro) {
        const vista = VISTAS[Math.floor(quadro / QUADROS_POR_VISTA)], q = quadro % QUADROS_POR_VISTA;
        const [sx, sy] = desenharMontaria(g, tipo, vista, q, "fundo");
        const r = new Grade(20, 24);
        desenharHumano(r, cav, quadro - (q >= 1 && q <= 3 ? q : 0)); // montado não dá passos: balança com a montaria
        const ox = Math.round(sx) - 20, oy = Math.round(sy) - (tipo === "carro" ? 45 : 33);
        for (let Y = 0; Y < r.h; Y++) for (let X = 0; X < r.w; X++) { const c = r.d[Y * r.w + X]; if (c) g.fino(X + ox, Y + oy, c); }
        desenharMontaria(g, tipo, vista, q, "frente");
      },
    });
  }
  // ----- NPCs (§6.4) -----
  humano("pj_eliabe", {
    molde: "manto", cabelo: "curto",
    cores: { H: "#e8dcc0", S: "#cf9466", s: "#b07548", B: "#e8dcc0", R: "#b08a5a", r: "#8a6a42", d: "#5e4630", A: "#8e2a1f", F: "#5e4630" },
    // faixa de linho claro descendo pela veste e tira vermelha na testa
    extraCorpo: (g, P) => { if (P.vista === "frente") retF(g, 15, P.yT + 2, 2, 41 - P.yT - 2, (X) => (X === 15 ? "#f4ead2" : "#d8ccae")); },
    acessorios: [["faixa", ["#8e2a1f"]], ["cajado_curvo", ["#7a5530", "#9a7048"]]],
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
    cores: { H: "#e8e2d4", S: "#cf9466", s: "#b07548", B: "#d8d2c4", R: "#a8603a", r: "#8e4a2e", d: "#6e3422", A: "#eadcb6", F: "#4f3220" },
    cabelo: "longo",
    acessorios: [["cajado_alto", ["#6b4a2e", "#8a6a42"]]],
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
    molde: "manto", cabelo: "longo",
    cores: { H: "#4a2f20", S: "#cf9466", s: "#b07548", B: "#4a2f20", R: "#f2ead8", r: "#dcd0b4", d: "#b8a888", A: "#b8a888", F: "#5a3a24" },
    // manto terracota sobre um ombro e cabelo até os ombros
    acessorios: [["estola", ["#c0523a", "#a8402e", "#7a2a1f"]]],
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

  // -------------------------------------------------------------------
  // Estruturas de várias casas (dados/mapas.js, DADOS_ESTRUTURAS): casa, tenda, banca e poço.
  // A pegada (largura × altura em casas) bloqueia a passagem; o desenho sobe acima dela.
  // A base da arte fica na penúltima linha; a última é margem. Cada quadro é uma variante.
  // -------------------------------------------------------------------
  // casa: 0 adobe claro · 1 pedra de Canaã · 2 basalto da Galileia · 3 tijolo de barro do Egito
  const CORES_CASA = [
    { parede: ["#a8845a", "#c8a272", "#e0c090"], teto: ["#b08a5a", "#cfae74", "#e6cf9c"], junta: "#8a6a42", pedra: false },
    { parede: ["#8a7a62", "#a8987a", "#c8b898"], teto: ["#8a7a5e", "#a8966f", "#c2b088"], junta: "#6e604c", pedra: true },
    { parede: ["#363432", "#4c4a48", "#6a6662"], teto: ["#5a4a3a", "#7a6448", "#94805e"], junta: "#262422", pedra: true },
    { parede: ["#87502f", "#a8683f", "#c8865a"], teto: ["#a8865e", "#c8a272", "#dcbc8a"], junta: "#6a3c22", tijolo: true },
  ];
  registrar("es_casa", {
    w: 52, h: 52, quadros: CORES_CASA.length, origem: [0.5, 1], estrutura: true,
    desenhar(g, v) {
      const c = CORES_CASA[v], b = 50, topo = 20, x0 = 3, x1 = 48;
      g.sombra(30, b + 0.5, 25, 2.2);
      // parede da frente com textura do material
      for (let y = topo; y <= b; y++)
        for (let x = x0; x <= x1; x++) {
          const luz = x < x0 + 3 ? 2 : x > x1 - 4 ? 0 : 1;
          let cor = c.parede[luz];
          if (c.pedra) {
            const fila = Math.floor((y - topo) / 5), off = fila % 2 ? 4 : 0;
            if ((y - topo) % 5 === 4 || (x + off) % 8 === 0) cor = c.junta;
            else if (hash2(Math.floor((x + off) / 8), fila, 300 + v) < 0.3) cor = c.parede[Math.max(0, luz - 1)];
          } else if (c.tijolo) {
            const fila = Math.floor((y - topo) / 3), off = fila % 2 ? 3 : 0;
            if ((y - topo) % 3 === 2 || (x + off) % 6 === 0) cor = c.junta;
          } else if (hash2(x, y, 301) < 0.06) cor = c.parede[Math.max(0, luz - 1)];
          g.p(x, y, cor);
        }
      // teto plano visto de cima (com mureta) e as pontas das vigas
      g.ret(x0 - 1, topo - 9, x1 - x0 + 3, 9, (x, y) => (y === topo - 9 || x === x0 - 1 || x === x1 + 1 ? c.teto[0] : y === topo - 8 ? c.teto[2] : c.teto[1]));
      g.lin(x0 - 1, topo - 1, x1 + 1, topo - 1, c.teto[0]);
      for (let x = x0 + 3; x < x1; x += 7) { g.p(x, topo + 1, "#5a3a24"); g.p(x + 1, topo + 1, "#4a3020"); }
      // porta em arco com folha de madeira
      const px = x0 + 13;
      for (let y = b - 16; y <= b; y++)
        for (let x = px; x < px + 9; x++) {
          const nx = (x - (px + 4)) / 4.6, ny = (y - (b - 11)) / 5;
          if (y < b - 11 && nx * nx + ny * ny > 1) continue;
          g.p(x, y, x === px || y === b - 16 ? "#2a1a14" : x < px + 3 ? "#5a3a24" : "#7a5530");
        }
      g.p(px + 6, b - 7, "#e8b94a");
      // janela com treliça
      g.ret(x1 - 13, topo + 7, 6, 5, "#2a1a14");
      for (let k = 0; k < 6; k += 1.5) { g.linf(x1 - 13 + k, topo + 7, x1 - 13 + k + 2.5, topo + 11.5, "#6b4a2e"); g.linf(x1 - 10.5 + k, topo + 7, x1 - 13 + k, topo + 11.5, "#5a3a24"); }
      g.lin(x1 - 14, topo + 12, x1 - 6, topo + 12, c.teto[2]);
      // escada externa até o terraço (adobe e pedra)
      if (v < 2) for (let i = 0; i < 6; i++) g.ret(x1 - 4 + Math.floor(i / 2), b - 4 - i * 5, 4, 2, c.teto[i % 2 ? 1 : 2]);
      // jarro e degrau na soleira
      g.ret(px - 1, b, 11, 1, c.parede[0]);
      g.elip(px - 5, b - 2, 2, 2.5, (nx, ny) => tom(["#8e4a2a", "#b5663a", "#d88a58"], -(nx + ny)));
      // detalhe em 32 px: tábuas e cravos da porta, verga de madeira, persianas da janela, reboco gasto
      for (let x = px + 1.5; x < px + 8.5; x += 1.5) g.linf(x, b - 10, x, b - 0.5, "#4a3020");
      for (const y of [b - 9, b - 3]) for (let x = px + 1; x < px + 8.5; x += 2) g.pf(x, y, "#c9a46a");
      g.retf(px - 1, b - 17, 11, 1, "#5a3a24"); g.linf(px - 1, b - 17, px + 9.5, b - 17, "#7a5530");
      for (const sx of [x1 - 15, x1 - 7]) { g.ret(sx, topo + 6, 2, 7, "#6b4a2e"); for (let y = topo + 6.5; y < topo + 13; y += 1) g.linf(sx, y, sx + 1.5, y, "#8a6a42"); g.linf(sx, topo + 6, sx, topo + 12.5, "#4a3020"); }
      for (let k = 0; k < 12; k++) {
        const x = x0 + 2 + hash2(k, v, 321) * (x1 - x0 - 4), y = topo + 2 + hash2(v, k, 322) * (b - topo - 6);
        if (Math.abs(x - (px + 4)) < 7 && y > b - 18) continue;
        g.linf(x, y, x + 1, y + 0.5, misturar(c.parede[0], c.junta, 0.5));
      }
      // no terraço: forno de barro (tabun) com fumaça e um vaso de planta
      g.elip(x0 + 9, topo - 5, 3, 2.4, (nx, ny) => tom(["#7a4a2a", "#a8683f", "#c8865a"], -(nx + ny)));
      g.retf(x0 + 8.5, topo - 7.5, 1, 0.5, "#2a1a14");
      g.elip(x1 - 6, topo - 4, 1.6, 1.4, "#b5663a"); g.elip(x1 - 6, topo - 6, 2.2, 1.6, (nx, ny) => (nx + ny < 0 ? "#7a8a3f" : "#55642c"));
    },
    depois(g, v) {
      // fumaça do forno (sem contorno), em fiapos de 1 px
      const x0 = 3 + 9, topo = 20 - 8;
      for (let k = 0; k < 6; k++) g.pf(x0 - 0.5 + Math.sin(k * 1.3 + v) * 0.8, topo - k * 1.2, comAlfa("#e8e2d4", 0.5 - k * 0.07));
    },
  });

  // tenda: 0 pano cru · 1 listras vermelhas · 2 listras índigo · 3 pelo de cabra escuro
  const CORES_TENDA = [
    { pano: ["#a8916a", "#c8b48a", "#e0d0a8"], listra: "#b8a07a" },
    { pano: ["#b8a07a", "#d8c49a", "#eadcb6"], listra: "#a8402e" },
    { pano: ["#b8a07a", "#d8c49a", "#eadcb6"], listra: "#3b5a9a" },
    { pano: ["#2e2420", "#46382e", "#5e4c3e"], listra: "#8a7a62" },
  ];
  registrar("es_tenda", {
    w: 52, h: 44, quadros: CORES_TENDA.length, origem: [0.5, 1], estrutura: true,
    desenhar(g, v) {
      const c = CORES_TENDA[v], b = 42, cumeeira = 9, beiral = 24;
      g.sombra(29, b + 0.5, 25, 2);
      // cordas e estacas
      for (const [x0, x1] of [[4, 1], [47, 50]]) { g.lin(x0, beiral, x1, b, "#8a6a42"); g.p(x1, b, "#5a3a24"); }
      // teto: desce da cumeeira até o beiral, com listras
      for (let y = cumeeira; y <= beiral; y++) {
        const t = (y - cumeeira) / (beiral - cumeeira), meia = Math.round(15 + t * 9);
        for (let x = 26 - meia; x <= 25 + meia; x++) {
          const lado = x < 26 - meia + 3 ? 2 : x > 25 + meia - 4 ? 0 : 1;
          let cor = c.pano[lado];
          if ((y - cumeeira) % 5 === 3) cor = c.listra;
          if (y === beiral) cor = c.pano[0];
          g.p(x, y, cor);
        }
      }
      // paredes de pano até o chão, com a entrada aberta no meio
      for (let y = beiral + 1; y <= b; y++)
        for (let x = 3; x <= 48; x++) {
          const entrada = x >= 21 && x <= 30;
          let cor = x < 6 ? c.pano[2] : x > 45 ? c.pano[0] : c.pano[1];
          if ((x - 3) % 9 === 0) cor = c.pano[0];
          if (entrada) cor = y < beiral + 3 ? c.pano[0] : "#1c1210";
          g.p(x, y, cor);
        }
      // aba enrolada sobre a entrada e varas do beiral
      g.ret(20, beiral + 1, 12, 2, c.listra);
      for (const x of [3, 20, 31, 48]) g.lin(x, beiral, x, b, "#6b4a2e");
      g.lin(23, cumeeira - 3, 23, cumeeira, "#6b4a2e"); g.lin(28, cumeeira - 3, 28, cumeeira, "#6b4a2e");
      // tapete na soleira
      g.ret(22, b, 8, 1, "#8e2a1f");
    },
  });

  // banca: 0 com mercadorias · 1 vazia (espaço reservado para uma loja futura)
  registrar("es_banca", {
    w: 52, h: 46, quadros: 2, origem: [0.5, 1], estrutura: true,
    desenhar(g, v) {
      const b = 44, toldo = 6, balcao = 31;
      g.sombra(29, b + 0.5, 25, 2);
      // fundo de pano escuro entre os postes
      g.ret(5, toldo + 9, 42, balcao - toldo - 9, (x, y) => ((x + y) % 7 === 0 ? "#4a3a30" : "#3a2c24"));
      // prateleira dos fundos com jarros (mercadorias) ou panos dobrados (vazia)
      g.lin(6, balcao - 7, 45, balcao - 7, "#7a5530");
      if (v === 0) {
        for (const [x, cor] of [[9, "#b5663a"], [14, "#c8b070"], [19, "#8e4a2a"], [33, "#b5663a"], [38, "#d88a58"], [42, "#8e4a2a"]])
          g.elip(x, balcao - 10, 2, 2.6, (nx, ny) => (nx + ny < -0.4 ? misturar(cor, "#ffffff", 0.25) : cor));
      } else {
        g.ret(10, balcao - 10, 8, 3, "#c8b48a"); g.lin(10, balcao - 10, 17, balcao - 10, "#e0d0a8");
        g.ret(34, balcao - 9, 7, 2, "#a8916a");
      }
      // balcão de madeira
      g.ret(3, balcao, 46, b - balcao + 1, (x, y) => (y === balcao ? "#c9a46a" : y === balcao + 1 ? "#a8844f" : (x - 3) % 11 === 0 ? "#5e4630" : x < 6 ? "#9a7048" : "#7a5530"));
      // mercadorias no balcão
      if (v === 0) {
        g.elip(11, balcao - 1, 3, 1.5, "#e8b94a"); g.p(10, balcao - 2, "#ffe08a");
        g.ret(17, balcao - 3, 6, 3, "#8e2a1f"); g.lin(17, balcao - 3, 22, balcao - 3, "#c2452d");
        g.ret(25, balcao - 2, 5, 2, "#55642c"); g.p(26, balcao - 3, "#7a8a3f");
        for (let i = 0; i < 3; i++) g.elip(35 + i * 4, balcao - 2, 1.6, 1.6, i % 2 ? "#c2452d" : "#d9a35c");
      } else {
        g.ret(20, balcao - 2, 10, 2, "#d4bf8f"); g.lin(20, balcao - 2, 29, balcao - 2, "#eadcb6");
      }
      // postes e toldo listrado com bainha recortada
      for (const x of [4, 47]) g.lin(x, toldo, x, b, "#5e4630");
      for (let y = toldo; y < toldo + 9; y++)
        for (let x = 1; x <= 50; x++) {
          const listra = Math.floor((x - 1) / 4) % 2 === 0;
          const cor = y === toldo ? "#5e1a14" : listra ? (v === 0 ? "#c2452d" : "#3b5a9a") : "#eadcb6";
          g.p(x, y, y > toldo + 6 && (x % 4 === 0) ? null : cor);
        }
      g.lin(1, toldo + 1, 50, toldo + 1, "#f3e4c0");
    },
  });

  registrar("es_poco", {
    w: 20, h: 28, quadros: 1, origem: [0.5, 1], estrutura: true,
    desenhar(g) {
      const b = 26;
      g.sombra(12, b, 9, 1.6);
      // cilindro de pedra
      for (let y = 15; y <= b; y++)
        for (let x = 2; x <= 17; x++) {
          const fila = Math.floor((y - 15) / 3), off = fila % 2 ? 2 : 0;
          let cor = x < 5 ? "#c8b898" : x > 14 ? "#7a6a54" : "#a8987a";
          if ((y - 15) % 3 === 2 || (x + off) % 5 === 0) cor = "#6e604c";
          g.p(x, y, cor);
        }
      // borda e água escura
      g.elip(9.5, 14.5, 8.5, 3, "#d2c2a2");
      g.elip(9.5, 14.5, 6, 1.8, "#1d4f5c");
      g.p(8, 14, "#4fa3a5");
      // armação, travessa, corda e balde
      g.lin(3, 14, 3, 3, "#6b4a2e"); g.lin(16, 14, 16, 3, "#6b4a2e");
      g.lin(2, 3, 17, 3, "#8a6a42"); g.lin(2, 2, 17, 2, "#5e4630");
      g.lin(10, 4, 10, 9, "#c9a46a");
      g.ret(9, 9, 3, 3, "#7a5530"); g.lin(9, 9, 11, 9, "#a8844f");
    },
  });

  // ----- Moradores das vilas (papel "ambiente"; aparencia em dados/npcs.js) -----
  humano("pj_morador_aguadeira", {
    molde: "veu", barba: false,
    cores: { V: "#4fa3a5", W: "#2f7680", S: "#cf9466", s: "#b07548", R: "#e6cf9c", r: "#cfae74", d: "#a8844f", A: "#8e2a1f", F: "#5a3a24" },
    acessorios: [["jarro", ["#b5663a", "#8e4a2a", "#d88a58"]]],
  });
  humano("pj_morador_pastor", {
    molde: "curta",
    cores: { H: "#4a2f20", S: "#c68a5c", s: "#a0663f", B: "#4a2f20", R: "#eadcb6", r: "#a8916a", d: "#7d6a4a", A: "#7d522b", F: "#5a3a24" },
    acessorios: [["cajado_curvo", ["#7a5530", "#9a7048"]], ["saco", ["#a8916a", "#d4bf8f"]]],
  });
  humano("pj_morador_ancia", {
    molde: "veu", barba: false,
    cores: { V: "#8e8882", W: "#5e5852", S: "#b97a4c", s: "#93603a", R: "#5a2d4a", r: "#3a2238", d: "#2a1a24", A: "#d4bf8f", F: "#4f3220" },
    acessorios: [["cajado_curto", ["#6b4a2e"]]],
  });
  humano("pj_morador_cameleiro", {
    molde: "manto",
    cores: { H: "#2e1f18", S: "#b97a4c", s: "#93603a", B: "#2e1f18", R: "#7d522b", r: "#5e4630", d: "#4a3020", A: "#e8b94a", F: "#4f3220" },
    acessorios: [["turbante", ["#eadcb6", "#c2452d"]], ["corda", ["#c9a46a", "#8a6a42"]]],
  });
  humano("pj_morador_tecela", {
    molde: "veu", barba: false,
    cores: { V: "#8e2a1f", W: "#5e1a14", S: "#b97a4c", s: "#93603a", R: "#d9a35c", r: "#b07a3e", d: "#7d522b", A: "#3b5a9a", F: "#4f3220" },
    acessorios: [["fardo", ["#c2452d", "#e2774f"]]],
  });
  humano("pj_morador_oleiro", {
    molde: "curta",
    cores: { H: "#2e1f18", S: "#b97a4c", s: "#93603a", B: "#2e1f18", R: "#d4bf8f", r: "#b8a07a", d: "#8a7a62", A: "#8e4a2a", F: "#6a4428" },
    acessorios: [["jarro", ["#a8683f", "#87502f", "#c8865a"]]],
  });
  humano("pj_morador_mae", {
    molde: "veu", barba: false,
    cores: { V: "#7d522b", W: "#4f3220", S: "#cf9466", s: "#b07548", R: "#a8603a", r: "#8e4a2e", d: "#6e3422", A: "#e6cf9c", F: "#4f3220" },
    acessorios: [["saco", ["#d4bf8f", "#eadcb6"]]],
  });
  humano("pj_morador_anciao", {
    molde: "manto",
    cores: { H: "#bfb7a6", S: "#cf9466", s: "#b07548", B: "#e8e2d4", R: "#6a7f8a", r: "#4f626c", d: "#36464e", A: "#d4bf8f", F: "#4f3220" },
    acessorios: [["cajado_curvo", ["#7a5530", "#9a7048"]]],
  });
  humano("pj_morador_sentinela", {
    molde: "curta",
    cores: { H: "#4a2f20", S: "#c68a5c", s: "#a0663f", B: "#4a2f20", R: "#8a5a32", r: "#6b4a2e", d: "#4f3220", A: "#c2452d", F: "#4a2f20" },
    acessorios: [["lanca", ["#6b4a2e", "#a8b4bc"]], ["escudo_oval", ["#7d522b", "#b07a3e"]]],
  });
  humano("pj_morador_pastora", {
    molde: "veu", barba: false,
    cores: { V: "#d4bf8f", W: "#a8916a", S: "#c68a5c", s: "#a0663f", R: "#55642c", r: "#34401f", d: "#2a3418", A: "#e8b94a", F: "#4f3220" },
    acessorios: [["cajado_alto", ["#6b4a2e", "#8a6a42"]]],
  });
  humano("pj_morador_pescador", {
    molde: "curta",
    cores: { H: "#4a2f20", S: "#b97a4c", s: "#93603a", B: "#4a2f20", R: "#c8b48a", r: "#a8916a", d: "#7d6a4a", A: "#2f7680", F: "#93603a" },
    acessorios: [["rede", ["#c9b48a"]], ["saco", ["#4fa3a5", "#a9dccf"]]],
  });
  // Barqueiro do cais: túnica curta azul-mar, faixa na cabeça, rolo de corda e o remo na mão.
  acessorio("remo", "frente", (g, c, P) => {
    const [x, y] = haste(g, P, c, 26, 15);
    retF(g, x - 1, y - 2, 4, 6, c[1]); retF(g, x - 1, y - 2, 1, 6, claro(c[1], 0.3)); retF(g, x + 2, y - 2, 1, 6, escuro(c[1], 0.3));
  });
  humano("pj_morador_barqueiro", {
    molde: "curta",
    cores: { H: "#2a1a10", S: "#a8683e", s: "#82502e", B: "#2a1a10", R: "#3f7f9a", r: "#2f6680", d: "#1f4a5e", A: "#c8b48a", F: "#6a4a2e" },
    barba: true,
    acessorios: [["bandana", ["#c8402f", "#f0e0c0"]], ["corda", ["#c9b48a", "#8a7450"]], ["remo", ["#6b4a2e", "#a8784a"]]],
  });
  humano("pj_morador_vizinha", {
    molde: "veu", barba: false,
    cores: { V: "#b98ad0", W: "#8a4a6e", S: "#cf9466", s: "#b07548", R: "#eadcb6", r: "#d4bf8f", d: "#a8916a", A: "#5a2d4a", F: "#5a3a24" },
    acessorios: [["jarro", ["#c8b070", "#a8904e", "#e0d0a8"]]],
  });

  // ----- Inimigos humanos (§6.5) -----
  humano("in_chefe", {
    molde: "manto", porte: "grande", hostil: true,
    cores: { H: "#2a2a3a", S: "#b97a4c", s: "#93603a", B: "#2a2a3a", R: "#8a3a4a", r: "#6a2a3a", d: "#4a1a2a", A: "#e8b94a", F: "#2a1a14" },
    gola: "#b07a38",
    acessorios: [["capa", ["#3a1420", "#4a1a2a"]], ["faixa", ["#e8b94a"]], ["espada_curva", ["#a8b4bc", "#e4ecf0", "#e8b94a"]]],
  });
  humano("in_salteador", {
    molde: "curta", hostil: true,
    cores: { H: "#5a5a4a", S: "#93603a", s: "#6e4428", B: "#3e3e32", R: "#7a6a52", r: "#5e5040", d: "#463c30", A: "#3e3e32", F: "#2a1a14" },
    capuz: ["#5a5a4a", "#3e3e32"],
    acessorios: [["porrete", ["#6b4a2e", "#4a3222"]], ["saco", ["#a8916a", "#d4bf8f"]]],
  });
  humano("in_guarda_egipcio", {
    molde: "curta", hostil: true, barba: false,
    cores: { H: "#1e1a1a", S: "#b97a4c", s: "#93603a", R: "#f0e8d8", r: "#d8ccb4", d: "#b0a48c", A: "#e8b94a", F: "#4f3220" },
    // peito nu com colar largo, saiote de linho e nemes listrado
    extraCorpo: (g, P, c) => { const x0 = P.vista === "lado" ? 14 : 12, x1 = P.vista === "lado" ? 26 : 27; retF(g, x0, P.yT, x1 - x0 + 1, P.yC - P.yT, (X, Y) => (Y === P.yC - 1 ? c.pele[2] : tomPano(c.pele, X, x0, x1))); },
    mangaCor: "#b97a4c",
    acessorios: [["colar", ["#e8b94a", "#3b5a9a"]], ["nemes", ["#f0e8d8", "#3b5a9a", "#e8b94a"]], ["escudo_alto", ["#8a5a32", "#e8dcc0", "#5e3c1c"]], ["lanca", ["#6b4a2e", "#b07a38"]]],
  });
  humano("in_perseguidor", {
    molde: "curta", hostil: true, barba: false,
    cores: { H: "#5e3c1c", S: "#b97a4c", s: "#93603a", R: "#f0e8d8", r: "#d8ccb4", d: "#b0a48c", A: "#5e3c1c", F: "#4f3220" },
    armadura: "couraca_escamas",
    acessorios: [["capa", ["#6a1f1f", "#4a1416"]], ["arco_costas", ["#6e4a28", "#eadcb6"]], ["elmo", ["#8a5a2b", "#c08a3e"]], ["espada", ["#a8b4bc", "#e4ecf0", "#c08a3e"]]],
  });
  humano("in_amalequita", {
    molde: "manto", hostil: true,
    cores: { H: "#1e1a1a", S: "#b97a4c", s: "#93603a", B: "#1e1a1a", R: "#52526e", r: "#3a3a52", d: "#2a2a3a", A: "#a88a5a", F: "#2a1a14" },
    gola: "#c8b8a0",
    acessorios: [["turbante", ["#1e1a1a"]], ["escudo_oval", ["#a88a5a", "#7d6a4a"]], ["lanca_longa", ["#4a3222", "#a8b4bc"]]],
  });

  // ----- Quadrúpede e aracnídeo (20×14) -----
  // lobo: desenhado pelo quadrúpede (abaixo), com a pelagem cinza e o ventre claro
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


  // ----- Criaturas novas (JGB-7): cada uma com o seu sprite -----
  // Quadrúpede genérico (5 quadros: parado, respiração, passo, passo, bote). o: cores e formas.
  // Desenhado em 32 px por casa (coordenadas em unidades de meia casa/8, com meia unidade de precisão):
  // coxa e ombro arredondados, canela fina, pata ou casco, peito e quadril, pescoço, focinho afilado.
  function quadrupede(chave, o) {
    const W = o.w || 20, H = o.h || 14;
    return registrar(chave, {
      w: W, h: H, quadros: 5, contorno: o.contorno || "hostil",
      desenhar(g, q) {
        const [A, B, C] = o.pelo, V = o.ventre || C, N = "#2a1a14";
        const resp = q === 1 ? 0.5 : 0, bote = q === 4 ? 2 : 0;
        const passo = q === 2 ? 1 : q === 3 ? -1 : 0;
        const chao = H - 1.5, perna = o.perna || 3;
        const cy = chao - perna - o.ry + 0.5; // centro do corpo
        const cx = o.cx || W / 2 - 1;
        const tomPelo = (nx, ny) => (ny > 0.5 ? V : tom([A, B, C], -(0.4 * nx + 0.9 * ny) + (o.corcunda ? nx * 0.3 : 0)));
        const casco = o.casco || escuroT(A, 0.3);
        // perna: coxa (elipse), canela (1,5 un. de largura) que se inclina no passo e pata
        const perna1 = (x, d, longe) => {
          const cor = longe ? [escuroT(A, 0.15), A] : [B, C];
          const topo = cy + o.ry * 0.25, joelho = chao - perna * 0.45;
          g.elip(x, topo + 0.4, 1.05, Math.max(1.1, o.ry * 0.62), (nx, ny) => (nx < -0.3 ? cor[1] : cor[0]));
          g.linf(x - 0.5, joelho - 1, x - 0.5 + d * 0.5, chao - 0.5, cor[0]);
          g.linf(x, joelho - 1, x + d * 0.5, chao - 0.5, longe ? cor[0] : escuroT(cor[0], 0.18));
          g.retf(x - 0.5 + d * 0.5, chao - 0.5, o.casco ? 1 : 1.5, 1, casco);
          g.pf(x - 0.5 + d * 0.5, chao - 0.5, claroT(casco, 0.25));
        };
        const tras = cx - o.rx + 1.6, frente = cx + o.rx - 1.6;
        perna1(tras + 1, -passo, true); perna1(frente, passo, true);
        // cauda (cadeia de bolinhas)
        const tx = cx - o.rx + 0.3;
        const cadeia = (pts, r0, r1, cor) => pts.forEach(([x, y], i) => g.elip(x, y, r0 + ((r1 - r0) * i) / Math.max(1, pts.length - 1), r0 + ((r1 - r0) * i) / Math.max(1, pts.length - 1), cor));
        const bal = q === 1 || q === 3 ? 0.5 : 0;
        if (o.cauda === "tufo") { cadeia([[tx, cy - 0.5], [tx - 1, cy], [tx - 2, cy + 0.8], [tx - 3, cy + 1.6 - bal]], 0.7, 0.5, B); g.elip(tx - 3.6, cy + 2.2 - bal, 1.1, 1.2, o.tufo || A); }
        else if (o.cauda === "longa") cadeia([[tx, cy], [tx - 1, cy - 0.3], [tx - 2, cy - 0.8], [tx - 3, cy - 1.6 - bal], [tx - 3.6, cy - 2.6 - bal], [tx - 3.8, cy - 3.6 - bal]], 0.7, 0.5, B);
        else if (o.cauda === "peluda") { cadeia([[tx, cy - 0.5], [tx - 1, cy + 0.2], [tx - 2, cy + 1 - bal], [tx - 2.6, cy + 2 - bal]], 0.8, 1.1, B); g.pf(tx - 2.8, cy + 3 - bal, C); }
        else if (o.cauda === "curta") cadeia([[tx, cy - 0.6], [tx - 0.8, cy - 1.2]], 0.7, 0.6, B);
        // corpo: tronco, quadril e peito
        g.elip(cx, cy + resp * 0.5, o.rx, o.ry, tomPelo);
        g.elip(cx - o.rx * 0.5, cy - 0.2, o.rx * 0.48, o.ry * 1.02, tomPelo);
        g.elip(cx + o.rx * 0.55, cy + 0.1 + resp * 0.5, o.rx * 0.48, o.ry * 1.08, tomPelo);
        if (o.manchas) for (const [x, y] of o.manchas) { g.elip(cx + x + 0.5, cy + y + 0.5, 0.75, 0.6, o.corMancha || N); g.pf(cx + x + 0.75, cy + y + 0.5, escuroT(B, 0.05)); }
        if (o.listras) for (const x of o.listras) { g.linf(cx + x, cy - o.ry + 0.5, cx + x - 0.5, cy + 0.5, o.corMancha || A); g.linf(cx + x + 0.5, cy - o.ry + 0.5, cx + x, cy + 0.5, o.corMancha || A); }
        perna1(tras, passo, false); perna1(frente - 1, -passo, false);
        // pescoço e cabeça
        const hx = cx + o.rx + (o.pescoco || 0) + bote, hy = cy - (o.alturaCabeca || 2);
        for (let t = 0; t <= 1; t += 0.25) g.elip(cx + o.rx * 0.7 + (hx - 0.6 - cx - o.rx * 0.7) * t + bote * 0, cy - 0.4 + (hy + 0.4 - cy) * t, 1.4, 1.4 + (1 - t) * 0.6, tomPelo);
        if (o.juba) g.elip(hx - 1, hy + 0.5, o.cabeca + 1.6, o.cabeca + 1.6, (nx, ny, x, y) => tom(o.juba, -(0.55 * nx + 0.8 * ny) + (hash2(x, y, 5) - 0.5) * 0.6));
        g.elip(hx, hy, o.cabeca, o.cabeca * 0.92, esfera([A, B, C]));
        const fl = o.focinho || 2, cf = o.corFocinho || B;
        // focinho afilado e mandíbula
        g.elip(hx + 0.6 + fl * 0.55, hy + 0.65, fl * 0.75 + 0.3, 0.95, (nx, ny) => (ny < -0.4 ? claroT(cf, 0.12) : ny > 0.5 ? escuroT(cf, 0.2) : cf));
        g.retf(hx + fl + 0.5, hy, 1, 1, N); // nariz
        g.pf(hx + fl + 0.5, hy, claroT(N, 0.4));
        g.linf(hx + 1, hy + 1.5, hx + fl + 0.5, hy + 1.5, escuroT(cf, 0.4));
        // olho com íris, pupila e brilho
        const ox = hx + 0.5, oy = hy - 1;
        g.retf(ox - 0.5, oy, 1.5, 1, o.olho || "#e8b94a");
        g.pf(ox + 0.5, oy, "#1c1210"); g.pf(ox, oy, claroT(o.olho || "#e8b94a", 0.55));
        g.linf(ox - 0.5, oy - 0.5, ox + 1, oy - 0.5, escuroT(A, 0.2));
        if (o.presas) { g.retf(hx + fl - 0.5, hy + 1.5, 0.5, 1, "#f6efdc"); g.retf(hx + fl, hy + 1.5, 0.5, 1.5, "#f6efdc"); }
        if (o.barbicha) { g.linf(hx + 1, hy + 2, hx + 0.5, hy + 3.5, o.barbicha); g.linf(hx + 1.5, hy + 2, hx + 1, hy + 3.5, escuroT(o.barbicha, 0.2)); }
        // orelhas (triângulos), com o dentro rosado
        const orelha = (x, y, alt, larg, cor, dentro) => { for (let k = 0; k <= alt * 2; k++) { const w = larg * (1 - k / (alt * 2 + 1)); g.retf(x - w / 2, y - k / 2, Math.max(0.5, w), 0.5, cor); } if (dentro) g.retf(x - 0.25, y - alt / 2, 0.5, alt / 2, dentro); };
        if (o.orelhas === "pontudas") { orelha(hx - 1.2, hy - 1.6, 2, 1.6, A, null); orelha(hx + 0.3, hy - 1.6, 2.2, 1.6, B, "#c88a7a"); }
        else if (o.orelhas === "grandes") { orelha(hx - 1.4, hy - 1.6, 3.2, 1.8, A, null); orelha(hx + 0.4, hy - 1.6, 3.4, 1.8, B, "#c88a7a"); }
        else if (o.orelhas === "redondas") { g.elip(hx - 1.2, hy - 2, 1, 0.9, A); g.elip(hx + 0.6, hy - 2.1, 1, 0.9, B); g.pf(hx + 0.6, hy - 2, "#c88a7a"); }
        if (o.chifres) {
          const ch = o.chifres;
          const arco = (x0, y0, esc) => { for (let k = 0; k <= 8; k++) { const t = k / 8; g.retf(x0 - 2.6 * t * t - 0.5 * t, y0 - 3.4 * t, 0.5 + (1 - t) * 0.6, 0.5, k % 3 === 0 ? escuroT(ch, 0.2) : esc ? escuroT(ch, 0.1) : ch); } };
          arco(hx - 0.6, hy - 1.4, true); arco(hx + 0.4, hy - 1.4, false);
          g.pf(hx - 1.5, hy - 3.5, claroT(ch, 0.35));
        }
        // pelagem em traços sobre o lombo
        const sem = sementeDe(chave);
        for (let i = 0; i < 18; i++) {
          const t = hash2(i, 3, sem), u = hash2(i, 4, sem);
          const x = cx - o.rx * 0.8 + t * o.rx * 1.6, y = cy - o.ry * 0.8 + u * o.ry * 1.0;
          if (((x - cx) / o.rx) ** 2 + ((y - cy) / o.ry) ** 2 > 0.75) continue;
          g.linf(x, y, x + 0.5, y + 0.5, u < 0.4 ? claroT(C, 0.12) : escuroT(B, 0.18));
        }
      },
    });
  }
  // Aliados do Pastor (JGB-20): cão pastor e ovelha, com o contorno dos amigos.
  quadrupede("al_cao", {
    w: 20, h: 14, pelo: ["#5a3a24", "#8a5a34", "#b07a48"], ventre: "#efe2c4", rx: 4.6, ry: 2.4, cabeca: 2.2, focinho: 2,
    corFocinho: "#efe2c4", orelhas: "pontudas", cauda: "peluda", perna: 4, contorno: "amigo",
  });
  quadrupede("al_ovelha", {
    w: 20, h: 14, pelo: ["#cfc6b4", "#e8e2d4", "#f8f4ea"], ventre: "#e8e2d4", rx: 5, ry: 3, cabeca: 1.8, focinho: 1,
    corFocinho: "#3a3028", olho: "#2a1a14", orelhas: "pontudas", cauda: "curta", perna: 2, casco: "#3a3028", contorno: "amigo",
  });
  quadrupede("in_lobo", {
    w: 20, h: 14, pelo: ["#5a4c40", "#857565", "#a89a86"], ventre: "#d0c2a8", rx: 4.8, ry: 2.5, cabeca: 2.2, focinho: 2.4,
    corFocinho: "#9a8a76", orelhas: "pontudas", cauda: "peluda", perna: 4, olho: "#e8b94a",
  });
  quadrupede("in_chacal", {
    w: 20, h: 14, pelo: ["#9a6a34", "#c08a48", "#dcae6c"], ventre: "#ecd4a4", rx: 4.6, ry: 2.2, cabeca: 2, focinho: 3,
    orelhas: "grandes", cauda: "peluda", perna: 4,
  });
  quadrupede("in_javali", {
    w: 20, h: 14, pelo: ["#3e2a1e", "#5a3e2a", "#7a5a3e"], ventre: "#6a5040", rx: 5.6, ry: 3, cabeca: 2.4, focinho: 2,
    corFocinho: "#8a6a5a", orelhas: "pontudas", cauda: "curta", perna: 2, presas: true, olho: "#c2452d",
    listras: [-3, -1, 1], corMancha: "#2e1e14", corcunda: true,
  });
  quadrupede("in_urso", {
    w: 22, h: 16, pelo: ["#3a2418", "#5a3a24", "#7a5636"], ventre: "#6a4a32", rx: 6.2, ry: 3.8, cabeca: 3, focinho: 2,
    corFocinho: "#a07a52", orelhas: "redondas", cauda: "curta", perna: 3, alturaCabeca: 2, corcunda: true,
  });
  quadrupede("in_leao", {
    w: 22, h: 16, pelo: ["#a0702e", "#c8963e", "#e4be6a"], ventre: "#f0d89a", rx: 5.8, ry: 2.8, cabeca: 2.4, focinho: 2,
    juba: ["#5e3818", "#8a5222", "#a8682e"], cauda: "tufo", tufo: "#5e3818", perna: 4, orelhas: "redondas",
  });
  quadrupede("in_hiena", {
    w: 20, h: 14, pelo: ["#7a6a52", "#a08e6e", "#c4b08a"], ventre: "#d8c8a4", rx: 4.8, ry: 2.6, cabeca: 2.2, focinho: 2,
    corFocinho: "#3e3428", orelhas: "redondas", cauda: "peluda", perna: 4, corcunda: true,
    manchas: [[-3, -1], [-1, 0], [1, -1], [2, 1], [-2, 1], [3, -1]], corMancha: "#3e3428",
  });
  quadrupede("in_cabra", {
    w: 20, h: 16, pelo: ["#8a8478", "#b4ae9e", "#dcd6c6"], ventre: "#ece6d6", rx: 4.6, ry: 2.6, cabeca: 2, focinho: 2,
    orelhas: "pontudas", chifres: "#5a4a3a", barbicha: "#6a6458", cauda: "curta", perna: 5, alturaCabeca: 3, casco: "#3a3028",
  });
  quadrupede("in_leopardo", {
    w: 22, h: 14, pelo: ["#b0782a", "#d8a040", "#f0c868"], ventre: "#f4e2b0", rx: 5.8, ry: 2.4, cabeca: 2, focinho: 1,
    orelhas: "redondas", cauda: "longa", perna: 4, olho: "#9ad06a",
    manchas: [[-4, -1], [-2, 0], [0, -1], [2, 0], [3, -1], [-3, 1], [1, 1], [4, 1], [-1, -2]], corMancha: "#3a2414",
  });
  registrar("in_crocodilo", {
    w: 26, h: 13, quadros: 5, contorno: "hostil",
    desenhar(g, q) {
      const A = "#34502a", B = "#4e7238", C = "#729450", V = "#c8c890";
      const passo = q === 2 ? 1 : q === 3 ? -1 : 0, boca = q === 4 ? 2 : q === 1 ? 1 : 0;
      // cauda grossa que afina, com cristas
      for (let i = 0; i < 8; i++) { const h = i < 3 ? 1 : i < 6 ? 2 : 3; g.ret(i, 9 - h, 1, h, i % 2 ? A : B); if (i % 2) g.p(i, 8 - h, C); }
      // patas curtas, abertas para os lados
      for (const [x, d] of [[9, passo], [16, -passo]]) { g.ret(x + d, 10, 2, 2, A); g.p(x + d - 1, 11, A); }
      // corpo baixo e largo
      g.elip(13, 7.5, 6.4, 3, (nx, ny) => (ny > 0.45 ? V : tom([A, B, C], -(0.3 * nx + 0.9 * ny))));
      for (const x of [9, 11, 13, 15, 17]) { g.p(x, 5, C); g.p(x, 6, A); }
      for (const [x, d] of [[10, -passo], [17, passo]]) g.ret(x + d, 10, 2, 2, B);
      // cabeça larga e focinho comprido
      g.ret(18, 5, 4, 4, B); g.p(19, 4, C); g.p(20, 4, C); g.p(20, 5, "#e8b94a");
      g.ret(22, 6 - boca, 4, 2, B); g.p(25, 6 - boca, A);
      g.ret(22, 8 + boca, 4, 1, A);
      g.p(23, 8 - boca, "#f6efdc"); g.p(25, 8 - boca, "#f6efdc");
      if (boca) g.ret(22, 8 - boca + 1, 4, boca, "#a83a3a");
    },
  });
  function serpente(chave, o) {
    return registrar(chave, {
      w: 20, h: 14, quadros: 5, contorno: "hostil",
      desenhar(g, q) {
        const [A, B, C] = o.cores, V = o.ventre;
        const fase = q * 1.2, bote = q === 4 ? 2 : 0, resp = q === 1 ? 1 : 0;
        const escama = (nx, ny, x, y) => (ny > 0.35 ? V : ny < -0.45 ? C : (x + y) % 2 ? B : escuroT(B, 0.08));
        // corpo em tubo ondulado (onda em S), afinando para a cauda, com o desenho do dorso
        const fimCorpo = o.capuz ? 11.5 : 14.5;
        for (let x = 1; x <= fimCorpo; x += 0.5) {
          const y = 10.3 + Math.sin((x + fase) * 0.75) * 1.4;
          const r = x < 4 ? 0.45 + (x - 1) * 0.2 : 1.05;
          g.elip(x, y, 0.75, r, escama);
          if (o.padrao && Math.floor(x * 2) % 6 === 0 && x > 2) { g.pf(x, y - 0.5, o.padrao); g.pf(x - 0.5, y, o.padrao); g.pf(x + 0.5, y, o.padrao); g.pf(x, y + 0.5 - 0.5, o.padrao); }
        }
        if (o.capuz) {
          // naja: a frente do corpo se ergue, com o capuz aberto (largo) e a cabeça no alto
          const bx = 12.5 + bote / 2, topo = 2 - resp;
          for (let y = topo + 3; y <= 10.5; y += 0.5) g.elip(bx + 0.2 * Math.sin(y), y, 1, 0.6, (nx, ny, X, Y) => (nx > 0.3 ? V : Y % 2 ? B : A));
          g.elip(bx + 0.5, topo + 4.2, 3.2, 3.1, (nx, ny) => tom([A, B, C], -(0.4 * nx + 0.8 * ny)));
          // as "lentes" do capuz
          for (let k = 0; k < 4; k++) g.linf(bx - 2 + k * 1.2, topo + 2.5, bx - 1.5 + k * 1.2, topo + 6.5, escuroT(B, 0.18));
          g.pf(bx - 1, topo + 3.5, o.capuz); g.pf(bx + 2, topo + 3.5, o.capuz); g.retf(bx, topo + 5.5, 1, 1.5, escuroT(o.capuz, 0.1));
          g.elip(bx + 1.2, topo + 0.9, 1.9, 1.2, (nx, ny) => (ny > 0.4 ? V : nx < -0.3 ? C : B));
          g.retf(bx + 2, topo + 0.5, 1, 0.5, o.olho); g.pf(bx + 2, topo + 0.5, "#fff6e0");
          if (q === 4 || q === 1) { g.linf(bx + 3, topo + 1.5, bx + 4.5, topo + 1, "#c2452d"); g.pf(bx + 5, topo + 0.5, "#c2452d"); g.pf(bx + 5, topo + 1.5, "#c2452d"); }
          return;
        }
        // víbora: cabeça triangular baixa, um pouco erguida
        const hx = 15 + bote, hy = 8 - resp;
        g.elip(14.5 + bote / 2, 9.5 - resp / 2, 0.9, 1.4, escama);
        g.elip(hx + 1.6, hy + 1, 2.1, 1.4, (nx, ny) => (ny > 0.45 ? V : ny < -0.3 ? C : B));
        g.elip(hx + 3.4, hy + 1.2, 1, 0.9, B);
        g.linf(hx + 0.5, hy + 0.5, hx + 2.5, hy, escuroT(B, 0.25));
        g.retf(hx + 2, hy + 0.5, 1, 0.5, o.olho || "#e8b94a"); g.pf(hx + 2.5, hy + 0.5, "#1c1210"); g.pf(hx + 2, hy + 0.5, "#fff6e0");
        g.pf(hx + 4, hy + 1, escuroT(B, 0.4));
        if (q === 4 || q === 1) { g.linf(hx + 4.5, hy + 1.5, hx + 5.5, hy + 1.5, "#c2452d"); g.pf(hx + 6, hy + 1, "#c2452d"); g.pf(hx + 6, hy + 2, "#c2452d"); }
      },
    });
  }
  serpente("in_vibora", { cores: ["#8a6a3e", "#b4925a", "#d6b882"], ventre: "#e8d8b0", padrao: "#4f3a22", ponta: "#4f3a22" });
  serpente("in_naja", { cores: ["#24221e", "#3e3a30", "#5e584a"], ventre: "#c8b88a", capuz: "#c8b88a", olho: "#e2774f" });
  function ave(chave, o) {
    return registrar(chave, {
      w: 20, h: 16, quadros: 5, contorno: "hostil",
      desenhar(g, q) {
        const [A, B, C] = o.penas, N = "#2a1a14";
        const asa = q === 1 || q === 3 ? -3 : q === 2 ? 2 : 0, voo = q === 2 || q === 3 ? -1 : 0, bico = q === 4 ? 1 : 0;
        const cy = 8 + voo, cv = o.curvado ? 1 : 0;
        // asa de trás: penas em leque (traços finos)
        for (let k = 0; k < 5; k++) g.linf(7 - k * 0.3, cy, 2.5 - k * 0.2 + k * 0.4, cy + asa - 1 + k * 0.4, k % 2 ? A : escuroT(A, 0.15));
        // cauda em penas
        for (let k = 0; k < 4; k++) g.linf(5.5, cy + 1.5 + k * 0.4, 2.5, cy + 2 + k * 0.7, k % 2 ? A : B);
        // corpo
        g.elip(9, cy + 1, 4.2, 2.6, (nx, ny, x, y) => (ny > 0.5 ? (o.peito || B) : tom([A, B, C], -(0.4 * nx + 0.9 * ny))));
        for (let k = 0; k < 6; k++) g.pf(8 + (k % 3) * 1.5, cy + 2.5 + Math.floor(k / 3) * 0.5, escuroT(o.peito || B, 0.15));
        // asa da frente: rêmiges uma a uma, com a ponta escura
        for (let i = 0; i < 7; i++) {
          const x0 = 9.5 - i * 0.9, y0 = cy + (asa * i) / 6;
          g.linf(x0, y0, x0 + 1.5, y0 + 1.5, i % 2 ? B : C);
          g.linf(x0 - 0.5, y0 + 0.5, x0 + 1, y0 + 2, i === 6 ? escuroT(A, 0.2) : i % 2 ? A : B);
        }
        // pescoço e cabeça
        g.elip(12.5, cy - 0.5 + cv * 0.5, 1.3, 1.6, esfera(o.cabeca ? [o.cabeca[0], A, B] : [A, B, C]));
        g.elip(14, cy - 2 + cv, 2, 1.8, esfera(o.cabeca || [A, B, C]));
        if (o.colar) g.elip(12.3, cy + 0.3, 1.6, 0.8, (nx, ny, x, y) => ((x + y) % 2 ? o.colar : escuroT(o.colar, 0.1)));
        g.retf(14.5, cy - 3 + cv, 1, 1, o.olho || "#e8b94a"); g.pf(15, cy - 2.5 + cv, "#1c1210"); g.pf(14.5, cy - 3 + cv, "#fff6e0");
        // bico curvo
        const by = cy - 2 + cv + bico;
        g.retf(16, by, 1.5, 1, o.bico); g.retf(17.5, by + 0.5, 0.5, 1, escuroT(o.bico, 0.25)); g.pf(16, by, claroT(o.bico, 0.35));
        if (bico) g.retf(16, by + 1, 1.5, 0.5, escuroT(o.bico, 0.3));
        // garras
        for (const x of [9, 11]) { g.linf(x + 0.5, cy + 3, x + 0.5, cy + 4, o.pes || "#e8b94a"); g.retf(x, cy + 4, 1.5, 0.5, o.pes || "#e8b94a"); }
        g.sombra(10, 14.5, 3, 0.7);
      },
    });
  }
  ave("in_abutre", { penas: ["#2e2420", "#4a3a30", "#6a5646"], peito: "#8a7462", cabeca: ["#b0605a", "#d88a7a", "#f0b0a0"], colar: "#e8dcc0", bico: "#d8c8a0", curvado: true });
  ave("in_aguia", { penas: ["#4a2e18", "#6e4a28", "#946a3e"], peito: "#7a5230", cabeca: ["#c8c0b0", "#ece6da", "#ffffff"], bico: "#e8b94a" });
  ave("in_corvo", { penas: ["#121018", "#24202e", "#3a3448"], peito: "#2a2636", bico: "#3a3438", olho: "#c2452d", pes: "#3a3438" });
  function enxame(chave, o) {
    return registrar(chave, {
      w: 20, h: 18, quadros: 5, contorno: null,
      desenhar(g, q) {
        // insetos de 3 px (corpo, cabeça escura e asa clara) que mudam de lugar a cada quadro (zumbido);
        // no bote, o enxame se adensa à frente. Uma nuvem leve marca a área do enxame.
        g.elip(10, 10, 8.5, 6.5, comAlfa(o.nuvem, 0.22));
        const pts = o.pontos;
        for (let i = 0; i < pts.length; i++) {
          const [x0, y0] = pts[i];
          const dx = Math.round(Math.sin(i * 2.1 + q * 1.7) * 1.4) + (q === 4 ? 2 : 0), dy = Math.round(Math.cos(i * 1.3 + q * 2.3) * 1.2);
          const x = x0 + dx, y = y0 + dy;
          g.p(x, y, o.cores[0]); g.p(x + 1, y, o.cores[1]); g.p(x - 1, y, "#1c1210");
          g.p(x, y - 1, comAlfa("#ffffff", (i + q) % 2 ? 0.85 : 0.45));
        }
      },
    });
  }
  enxame("in_gafanhotos", {
    cores: ["#5a7a1e", "#a8b848"], nuvem: "#c8c070",
    pontos: [[4, 6], [7, 4], [10, 6], [13, 4], [16, 7], [5, 10], [9, 9], [12, 11], [7, 14], [15, 13], [3, 13], [11, 15], [17, 10], [8, 7], [14, 9], [6, 12]],
  });
  enxame("in_vespas", {
    cores: ["#f0c040", "#2a1a14"], nuvem: "#f0d880",
    pontos: [[4, 6], [8, 4], [11, 7], [15, 5], [5, 10], [10, 11], [14, 10], [7, 14], [16, 13], [3, 13], [12, 15], [17, 8], [9, 8]],
  });
  registrar("in_ra", {
    w: 16, h: 12, quadros: 5, contorno: "hostil",
    desenhar(g, q) {
      const A = "#2e5a22", B = "#4a8a32", C = "#7ab84a", V = "#d8e0a0";
      const salto = q === 2 ? -2 : q === 4 ? -1 : 0, papo = q === 1 ? 1 : 0;
      g.ret(2, 9 + Math.min(0, salto + 1), 3, 2, A); g.ret(11, 9 + Math.min(0, salto + 1), 3, 2, A); // patas de trás
      g.elip(8, 7 + salto, 4.5, 3, (nx, ny) => (ny > 0.5 ? V : tom([A, B, C], -(0.4 * nx + 0.9 * ny))));
      for (const [x, y] of [[6, 6], [9, 5], [7, 8]]) g.p(x, y + salto, A);
      g.ret(9, 10 + Math.min(0, salto + 1), 2, 1, B); g.ret(5, 10 + Math.min(0, salto + 1), 2, 1, B);
      g.elip(10, 4 + salto, 1.4, 1.4, esfera([A, C, "#c8e070"])); g.p(10, 4 + salto, "#2a1a14");
      g.elip(6, 4 + salto, 1.4, 1.4, esfera([A, C, "#c8e070"])); g.p(6, 4 + salto, "#2a1a14");
      if (papo) g.elip(8, 9 + salto, 1.6, 1, "#f0f0c0");
      if (q === 4) g.lin(9, 8 + salto, 14, 7 + salto, "#d86a7a");
    },
  });
  registrar("in_caranguejo", {
    w: 20, h: 12, quadros: 5, contorno: "hostil",
    desenhar(g, q) {
      const A = "#8a2a1a", B = "#c2452d", C = "#e8784a", N = "#2a1a14";
      const lado = q === 2 ? 1 : q === 3 ? -1 : 0, pinca = q === 4 ? 0 : 1, resp = q === 1 ? 1 : 0;
      for (const x of [5, 7, 12, 14]) { g.lin(x + lado, 8, x + lado + (x < 10 ? -2 : 2), 10, A); }
      g.elip(10 + lado, 7, 5, 2.6, (nx, ny) => (ny > 0.5 ? A : tom([A, B, C], -(0.4 * nx + 0.9 * ny))));
      g.p(8 + lado, 4 - resp, N); g.p(12 + lado, 4 - resp, N); g.p(8 + lado, 5, B); g.p(12 + lado, 5, B);
      // pinças erguidas
      for (const [x, s] of [[3, -1], [17, 1]]) {
        g.lin(x + lado - s, 6, x + lado, 4, B);
        g.ret(x + lado - 1, 2 - pinca, 3, 2, C); g.p(x + lado + s, 1 - pinca, C); g.p(x + lado, 3 - pinca, A);
      }
    },
  });
  // Humanos hostis novos.
  humano("in_arqueiro_bando", {
    molde: "curta", hostil: true,
    cores: { H: "#3e2a1a", S: "#a86e44", s: "#86542e", B: "#3e2a1a", R: "#8a6a3e", r: "#6a5030", d: "#4a3822", A: "#6a2a2a", F: "#2a1a14" },
    acessorios: [["turbante", ["#6a2a2a"]], ["saco", ["#8a6a3e", "#a88a5a"]], ["arco_mao", ["#6e4a28", "#eadcb6"]]],
  });
  humano("in_feiticeiro", {
    molde: "manto", hostil: true, barba: false,
    cores: { H: "#1e1a2a", S: "#a86e44", s: "#86542e", R: "#2a3a6a", r: "#1e2a4e", d: "#141c36", A: "#e8b94a", F: "#2a1a14" },
    acessorios: [["colar", ["#e8b94a", "#3b5a9a"]], ["nemes", ["#3b5a9a", "#1e2a4e", "#e8b94a"]], ["cajado_curto", ["#e8b94a"]], ["brilho", ["#9ad0ff", 14]]],
  });
  humano("in_arqueiro_egipcio", {
    molde: "curta", hostil: true, barba: false,
    cores: { H: "#1e1a1a", S: "#b97a4c", s: "#93603a", R: "#f0e8d8", r: "#d8ccb4", d: "#b0a48c", A: "#3b5a9a", F: "#4f3220" },
    acessorios: [["faixa", ["#3b5a9a"]], ["colar", ["#3b5a9a", "#e8b94a"]], ["arco_mao", ["#8a5a32", "#eadcb6"]]],
  });
  humano("in_pirata", {
    molde: "curta", hostil: true,
    cores: { H: "#1e1a1a", S: "#a86e44", s: "#86542e", B: "#2a2420", R: "#c8b48a", r: "#a8916a", d: "#7d6a4a", A: "#c2452d", F: "#2a1a14" },
    // tapa-olho e faixa vermelha na cintura
    extra: (g, P) => { if (P.vista === "frente") { retF(g, 15, P.T + 6, 4, 3, "#1e1a1a"); linF(g, 12, P.T + 5, 27, P.T + 4, "#1e1a1a"); } else if (P.vista === "lado") { retF(g, 23, P.T + 6, 3, 3, "#1e1a1a"); linF(g, 19, P.T + 5, 23, P.T + 6, "#1e1a1a"); } },
    acessorios: [["bandana", ["#c2452d", "#e2774f"]], ["corda", ["#a8916a", "#7d6a4a"]], ["espada_curva", ["#a8b4bc", "#e4ecf0", "#5a3a24"]]],
  });
  humano("in_auriga", {
    molde: "curta", hostil: true, barba: false,
    cores: { H: "#1e1a1a", S: "#b97a4c", s: "#93603a", R: "#e8dcc0", r: "#c8b48a", d: "#a8916a", A: "#e8b94a", F: "#4f3220" },
    armadura: "couraca_escamas",
    acessorios: [["capa_larga", ["#6a1f1f", "#4a1416"]], ["elmo", ["#b07a38", "#e8b94a"]], ["escudo_alto", ["#b07a38", "#f2d27a", "#5e3c1c"]], ["lanca_longa", ["#4a3222", "#e8b94a"]]],
  });
  humano("in_fundibulario", {
    molde: "manto", hostil: true,
    cores: { H: "#1e1a1a", S: "#a86e44", s: "#86542e", B: "#1e1a1a", R: "#6a5a3a", r: "#4e422a", d: "#36301e", A: "#8a3a2a", F: "#2a1a14" },
    // funda girando sobre a cabeça
    acessorios: [["turbante", ["#8a3a2a"]], ["saco", ["#6a5a3a", "#8a7a5a"]], ["funda", ["#a8916a", "#8a8478"]]],
  });
  // Curandeiros (JGB-8): manto claro, bolsa de ervas e cajado com brilho verde.
  humano("in_curandeiro_bando", {
    molde: "manto", hostil: true,
    cores: { H: "#6a6458", S: "#a86e44", s: "#86542e", B: "#8a8478", R: "#a8916a", r: "#86704e", d: "#5e4e36", A: "#4a7a3a", F: "#2a1a14" },
    acessorios: [["saco", ["#4a7a3a", "#7ab04a"]], ["cajado_alto", ["#6b4a2e", "#8ad06a"]], ["brilho", ["#c8f0a0", 24]]],
  });
  humano("in_sacerdote", {
    molde: "manto", hostil: true, barba: false, cabelo: "careca",
    cores: { H: "#b97a4c", S: "#b97a4c", s: "#93603a", R: "#f0e8d8", r: "#d8ccb4", d: "#b0a48c", A: "#e8b94a", F: "#4f3220" },
    // pele de leopardo sobre o ombro e o ankh de ouro no cajado
    acessorios: [["colar", ["#e8b94a", "#3b5a9a"]], ["pele_leopardo", []], ["cajado_curto", ["#e8b94a"]], ["ankh", ["#e8b94a"]], ["brilho", ["#c8f0a0", 18]]],
  });
  humano("in_mercenario", {
    molde: "curta", hostil: true, porte: "grande",
    cores: { H: "#3a2a1e", S: "#b97a4c", s: "#93603a", B: "#3a2a1e", R: "#5a5450", r: "#3e3a36", d: "#2a2624", A: "#8a1f1f", F: "#2a1a14" },
    armadura: "armadura_couro",
    acessorios: [["capa", ["#8a1f1f", "#5a1414"]], ["elmo", ["#7a828a", "#c8d0d6"]], ["escudo_redondo", ["#8a1f1f", "#5a1414", "#c8d0d6"]], ["espada", ["#c8d0d6", "#f0f4f8", "#7a4a24"]]],
  });

  // -------------------------------------------------------------------
  // Itens (§6.6): célula 16×16, arte de até 12×12 apoiada na linha 14
  // -------------------------------------------------------------------
  // Cada ícone ganha uma sombra de apoio suave (camada de sombra: sem contorno).
  function item(chave, desenhar, extra = {}) {
    const comSombra = (g, q) => { g.sombra(8.5, 14.6, 4.6, 0.9, "#1c1210", 0.22); desenhar(g, q); };
    return registrar(chave, Object.assign({ w: 16, h: 16, contorno: "amigo", origem: [0.5, 0.75], desenhar: comSombra }, extra));
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
  // Funda: correia de couro com a bolsa da pedra no meio.
  item("funda", (g) => {
    g.lin(3, 3, 6, 8, "#8a5a2e"); g.lin(13, 3, 10, 8, "#8a5a2e");
    g.elip(8, 9.5, 2.6, 2, () => "#6b4a2e"); g.p(8, 9, "#b8ab8a"); g.p(7, 9, "#d8ccb0");
    g.ret(2, 2, 2, 2, "#c08f58"); g.ret(12, 2, 2, 2, "#c08f58");
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
  // Saques das tabelas das criaturas.
  item("presa_lobo", (g) => {
    // presa curva, base escura e ponta clara
    for (const [x, y, c] of [[5, 13, "#b8a888"], [6, 12, "#d8cbb0"], [7, 11, "#d8cbb0"], [8, 10, "#eadcb6"], [9, 8, "#eadcb6"], [10, 7, "#f6efdc"], [10, 5, "#f6efdc"], [11, 4, "#ffffff"]]) g.p(x, y, c);
    for (const [x, y] of [[6, 13], [7, 12], [8, 11], [9, 10], [9, 9], [10, 8], [11, 6], [11, 5]]) g.p(x, y, "#a89a86");
    g.ret(4, 13, 2, 2, "#8a3a2a"); g.p(5, 12, "#b8a888");
  });
  item("ferrao_escorpiao", (g) => {
    g.elip(7, 11, 3.2, 2.6, esfera(["#4f3220", "#7d522b", "#b07a3e"]));
    g.lin(9, 9, 11, 6, "#7d522b"); g.lin(10, 9, 12, 6, "#4f3220");
    g.p(12, 5, "#a8c84a"); g.p(11, 4, "#d8e88a"); g.p(13, 5, "#6a8a2a");
  });
  item("linho_egipcio", (g) => {
    // rolo de linho dobrado
    g.ret(3, 7, 10, 6, (x, y) => tom(["#b8a888", "#d8cbb0", "#f6efdc"], -((y - 9.5) * 0.45 + (x - 8) * 0.12)));
    g.lin(3, 9, 12, 9, "#b8a888"); g.lin(3, 11, 12, 11, "#b8a888");
    g.ret(7, 6, 2, 8, "#3b5a9a"); g.p(7, 6, "#7fa3e0");
  });
  item("ponta_lanca", (g) => {
    for (let i = 0; i < 6; i++) {
      const w = Math.max(0, 2 - Math.floor(i / 2));
      g.ret(8 - w, 3 + i, 1 + 2 * w, 1, (x) => (x < 8 ? "#e8b94a" : x > 8 ? "#8a5e2a" : "#b8862b"));
    }
    g.ret(7, 9, 3, 4, "#7a4a30"); g.ret(7, 9, 1, 4, "#a8703a"); g.p(8, 13, "#4f3220");
  });
  item("bracelete_cobre", (g) => {
    g.elip(8, 10, 5, 3.6, esfera(["#7a3a1a", "#b8642b", "#e89a5a"]));
    for (let y = 8; y <= 12; y++) for (let x = 4; x <= 12; x++) if (((x + 0.5 - 8) / 3) ** 2 + ((y + 0.5 - 10) / 1.8) ** 2 < 1) g.apagar(x, y);
    g.p(8, 7, "#3fa66a"); g.p(5, 9, "#f0c080");
  });
  item("pena_ave", (g) => {
    for (let i = 0; i < 9; i++) { const x = 4 + i, y = 12 - i; g.p(x, y, "#e8dcc0"); }
    for (let i = 1; i < 8; i++) { const x = 4 + i, y = 12 - i; g.p(x - 1, y - 1, i % 2 ? "#6e4a28" : "#946a3e"); g.p(x + 1, y + 1, i % 2 ? "#4a2e18" : "#6e4a28"); }
    g.p(12, 3, "#2a1a14"); g.p(11, 4, "#4a2e18");
  });
  item("couro_grosso", (g) => {
    g.ret(3, 6, 10, 7, (x, y) => tom(["#4a3022", "#6e4a32", "#8e6a4a"], -((x - 8) * 0.12 + (y - 9) * 0.4)));
    for (const [x, y] of [[3, 6], [12, 6], [3, 12], [12, 12]]) g.apagar(x, y);
    g.lin(4, 8, 11, 8, "#3a2418"); g.p(6, 10, "#a8866a"); g.p(9, 11, "#a8866a"); g.p(2, 9, "#6e4a32"); g.p(13, 9, "#6e4a32");
  });
  item("carapaca", (g) => {
    g.elip(8, 9.5, 5, 3.6, esfera(["#6a4a1e", "#9a7032", "#c89a52"]));
    g.lin(8, 6, 8, 13, "#4a3214"); g.lin(4, 9, 12, 9, "#4a3214");
    g.p(6, 7, "#e8c890"); g.p(10, 11, "#4a3214");
  });
  item("amuleto_faianca", (g) => {
    g.lin(4, 3, 8, 7, "#c8b48a"); g.lin(12, 3, 8, 7, "#c8b48a");
    g.elip(8, 10, 3.2, 3.4, esfera(["#1e6a7a", "#2fa0a8", "#8ad8d0"]));
    g.p(8, 10, "#1c3a4a"); g.p(7, 10, "#f6efdc"); g.p(9, 10, "#f6efdc"); g.p(8, 12, "#1c3a4a");
  });
  // Peças do corpo (boneco). Luz de cima e da esquerda, 3–4 tons por material.
  item("turbante_linho", (g) => {
    const L = ["#8a7656", "#b8a47e", "#dccba4", "#f4ecd4"];
    g.elip(8, 9, 5.8, 4.4, (nx, ny) => (ny > 0.62 ? L[0] : tom([L[1], L[2], L[3]], -(0.55 * nx + 0.85 * ny))));
    // as voltas do pano (diagonais) e a ponta caindo à direita
    for (const k of [0, 3, 6]) g.linf(3.5 + k, 12, 6 + k, 6.5, L[1]);
    g.retf(2.5, 11.5, 11, 1.5, (X) => (X < 12 ? L[2] : L[1]));
    g.lin(13, 10, 13, 13, L[1]); g.pf(13, 13.5, L[0]);
  });
  item("capacete_couro", (g) => {
    const C = ["#4a2c1a", "#7a4a2c", "#a8703a", "#c89058"];
    g.elip(8, 10, 5.5, 5.6, (nx, ny) => (ny > 0.05 ? null : tom([C[1], C[2], C[3]], -(0.6 * nx + 0.8 * ny) * 1.3)));
    g.retf(2.5, 9.5, 11, 1.5, (X) => (X < 14 ? C[2] : C[1])); // aba
    g.retf(3, 11, 2, 3, C[1]); g.retf(11, 11, 2, 3, C[0]); // orelheiras
    for (let y = 4.5; y < 9.5; y += 1) g.pf(8, y, y % 2 ? C[0] : C[1]); // costura
    g.pf(5, 6.5, C[3]); g.pf(4.5, 7.5, C[3]);
  });
  item("elmo_bronze", (g) => {
    const B = ["#5e3c1c", "#8a5a2a", "#b07a38", "#d29e52", "#f2d27a"];
    g.elip(8, 9, 5.4, 5.2, (nx, ny) => (ny > 0.08 ? null : tom([B[2], B[3], B[4]], -(0.6 * nx + 0.8 * ny) * 1.3)));
    g.retf(2.5, 8.5, 11, 1.5, (X) => (X < 10 ? B[3] : B[2])); // testeira
    g.retf(3, 10, 2.5, 4, (X) => (X < 7 ? B[3] : B[2])); g.retf(10.5, 10, 2.5, 4, B[1]); // abas do rosto
    g.retf(5.5, 10, 5, 3.5, "#2a1a14"); g.retf(7.5, 10, 1, 3, B[2]); // abertura e nasal
    g.retf(7, 2.5, 2, 1.5, B[4]); g.retf(7.5, 4, 1, 1, B[3]); // botão no alto
  });
  item("colar_contas", (g) => {
    // fio em arco com contas de cornalina e a conta maior no meio
    const contas = [[3, 5], [3.6, 7.4], [4.8, 9.4], [6.4, 10.8], [9.6, 10.8], [11.2, 9.4], [12.4, 7.4], [13, 5]];
    g.linf(3, 4.5, 3, 5, "#8a7656"); g.linf(13, 4.5, 13, 5, "#8a7656");
    for (const [x, y] of contas) g.elip(x, y, 1.05, 1.05, (nx, ny) => (nx + ny < -0.4 ? "#f0905a" : nx + ny > 0.5 ? "#8a2a1a" : "#c2452d"));
    g.elip(8, 12, 1.7, 1.7, (nx, ny) => (nx + ny < -0.5 ? "#f6b07a" : nx + ny > 0.5 ? "#8a2a1a" : "#d2582d"));
    g.pf(7.5, 11.5, "#fff0d8");
  });
  item("saiote_couro", (g) => {
    const C = ["#4a2c1a", "#6e4228", "#8a5a32", "#b07a44"];
    g.retf(3, 3.5, 10, 2, (X, Y, i, j) => (j === 0 ? C[3] : C[2])); // cinto
    g.retf(7, 3.5, 2, 2, "#e8b94a"); g.pf(7.5, 4, "#f2d27a"); // fivela
    for (let i = 0; i < 5; i++) {
      const x = 3 + i * 2, comp = 8 - Math.abs(i - 2) * 0.5;
      g.retf(x, 5.5, 1.5, comp, (X, Y, a) => (a === 0 ? C[3 - (i % 2)] : C[1]));
      g.retf(x, 5.5 + comp, 1.5, 0.5, "#d29e52"); // a ponta de bronze
    }
  });
  item("grevas_bronze", (g) => {
    const B = ["#5e3c1c", "#8a5a2a", "#b07a38", "#d29e52", "#f2d27a"];
    for (const x0 of [3.5, 8.5]) {
      // placa da canela: joelho largo em cima, afina no tornozelo
      for (let y = 3; y < 14; y += 0.5) {
        const w = y < 5 ? 3.5 : y < 10 ? 3 : 2.5;
        g.retf(x0 + (3.5 - w) / 2, y, w, 0.5, (X, Y, i) => (i === 0 ? B[4] : i < 2 ? B[3] : i < 4 ? B[2] : B[1]));
      }
      g.retf(x0, 6.5, 3.5, 0.5, B[0]); g.retf(x0 + 0.25, 11, 3, 0.5, B[0]); // as correias
    }
  });
  item("sandalias_couro", (g) => {
    const C = ["#4a2c1a", "#7a4a2c", "#a8703a", "#c89058"];
    for (const [x, d] of [[3.5, 0], [9, 1]]) {
      g.elip(x + 2, 9 + d, 2.2, 4.4, (nx, ny) => (nx + ny < -0.5 ? C[3] : nx > 0.5 ? C[1] : C[2])); // sola
      g.retf(x + 0.5, 7 + d, 3.5, 1, C[0]); g.retf(x + 0.5, 10 + d, 3.5, 1, C[0]); // tiras
      g.linf(x + 2, 6 + d, x + 2, 7 + d, C[0]);
    }
  });
  item("botas_viagem", (g) => {
    const C = ["#3a2216", "#5e3a24", "#7a4e30", "#a0703e"];
    // cano e pé de perfil (bico à direita), sola escura e o cano dobrado
    g.retf(4, 3.5, 5, 7.5, (X, Y, i) => (i < 2 ? C[3] : i < 6 ? C[2] : C[1]));
    g.elip(9, 11.6, 4.6, 2.4, (nx, ny) => (ny < -0.2 && nx < 0 ? C[2] : nx + ny < -0.4 ? C[3] : C[1]));
    g.retf(4, 13, 10, 1, C[0]);
    g.retf(3.5, 3, 6, 1.5, (X, Y, i) => (i < 3 ? "#b08458" : "#8a6440"));
    for (const y of [6, 7.5, 9]) g.retf(8, y, 1.5, 0.5, "#d8c8a0"); // atilhos
  });
  item("anel_selo_bronze", (g) => {
    g.elip(8, 10, 4, 3.4, (nx, ny) => (nx * nx + ny * ny < 0.38 ? null : nx + ny < -0.4 ? "#f2d27a" : nx + ny > 0.6 ? "#7a4a24" : "#b07a38"));
    // o selo: chapa oval por cima, com a marca gravada
    g.elip(8, 5.5, 2.8, 2.2, (nx, ny) => (nx + ny < -0.5 ? "#f2d27a" : nx + ny > 0.5 ? "#8a5a2a" : "#d29e52"));
    g.retf(7, 5, 2, 0.5, "#5e3c1c"); g.retf(7.5, 4.5, 1, 1.5, "#5e3c1c");
  });
  // A mochila do boneco (o espaço que abre o painel Mochila): couro com aba, fivela e alças.
  item("mochila", (g) => {
    const C = ["#4a2c1a", "#7a4a2c", "#a8703a", "#c89058"];
    g.retf(3, 4, 10, 10, (X, Y, i, j) => (j === 19 ? C[0] : i < 2 ? C[3] : i > 16 ? C[1] : C[2]));
    g.retf(3, 4, 10, 4.5, (X, Y, i, j) => (j === 8 ? C[0] : j === 0 ? C[3] : C[1])); // aba
    g.retf(7, 7.5, 2, 2, "#e8b94a"); g.pf(7.5, 8, "#f2d27a"); // fivela
    g.retf(4, 2.5, 2, 1.5, C[1]); g.retf(10, 2.5, 2, 1.5, C[1]); // alças
    g.retf(4, 11, 8, 0.5, C[1]);
  });
  // Pedras do peitoral: a mesma lapidação, na cor de cada pedra (campo "pedra" em dados/itens.js).
  for (const [chave, d] of Object.entries(typeof ITENS !== "undefined" ? ITENS : {})) {
    if (!d.pedra) continue;
    const rampa = [misturar(d.pedra, "#120a08", 0.45), d.pedra, misturar(d.pedra, "#ffffff", 0.45)];
    item(chave, (g) => {
      // gema lapidada: mesa no alto, facetas laterais e brilho
      for (let y = 6; y <= 13; y++) {
        const w = y <= 8 ? 2 + (y - 6) : Math.max(0, 4 - (y - 9));
        for (let x = 8 - w; x <= 7 + w; x++) g.p(x, y, tom(rampa, -((x - 7.5) * 0.18 + (y - 9) * 0.25) + (y <= 8 ? 0.5 : 0)));
      }
      g.p(6, 7, "#ffffff"); g.p(7, 6, misturar(d.pedra, "#ffffff", 0.7));
    });
  }
  item("peixe", (g) => {
    g.elip(7.5, 9, 4.6, 2.6, (nx, ny) => (ny > 0.45 ? "#eadcb6" : tom(["#2f7680", "#4fa3a5", "#a9dccf"], -(0.4 * nx + 0.9 * ny))));
    g.lin(2, 7, 3, 8, "#2f7680"); g.lin(2, 11, 3, 10, "#2f7680"); g.p(2, 9, "#2f7680"); g.p(1, 6, "#4fa3a5"); g.p(1, 12, "#4fa3a5");
    g.p(10, 8, "#2a1a14"); g.lin(6, 6, 8, 6, "#2f7680");
  });
  // ----- Ofícios (JGB-24): matérias-primas e o que se fabrica -----
  item("madeira", (g) => {
    // duas toras empilhadas, com os anéis à mostra
    for (const [y, x0] of [[11, 3], [7, 4]]) {
      g.ret(x0, y - 1, 9, 3, (x, yy) => tom(["#5a3622", "#7d522b", "#a8703a"], -((yy - y) * 0.6)));
      g.elip(x0 + 9.5, y + 0.5, 1.6, 1.6, esfera(["#b07a3e", "#d9a35c", "#efc88a"]));
      g.p(x0 + 9, y, "#7d522b");
    }
    g.p(5, 10, "#4f3220"); g.p(8, 6, "#4f3220");
  });
  item("argila", (g) => {
    g.elip(8, 11, 5.5, 3.4, esfera(["#6a3a22", "#9a5a36", "#c47e52", "#e0a272"]));
    g.elip(8, 8.5, 3.2, 2.2, esfera(["#7a4428", "#a8643c", "#d08c5c"]));
    g.p(6, 11, "#5a3018"); g.p(10, 12, "#5a3018"); g.p(7, 7, "#f0c094");
  });
  item("minerio_cobre", (g) => {
    g.elip(8, 10.5, 5.2, 4, esfera(["#3e3a3c", "#5e585a", "#867e7e", "#a8a0a0"]));
    for (const [x, y] of [[6, 9], [9, 11], [10, 8], [5, 12]]) { g.p(x, y, "#c46a2b"); g.p(x + 1, y, "#e89a5a"); }
    g.p(8, 13, "#3fa66a");
  });
  item("resina", (g) => {
    // gotas de resina âmbar
    g.elip(7, 10, 3, 3.4, esfera(["#8a4a10", "#c47a1e", "#e8a83a", "#ffd88a"]));
    g.elip(11, 12, 1.8, 2, esfera(["#8a4a10", "#c47a1e", "#e8a83a"]));
    g.lin(7, 4, 7, 6, "#c47a1e"); g.p(6, 8, "#fff2c8");
  });
  item("peixe_grande", (g) => {
    g.elip(8, 9, 6.4, 3.4, (nx, ny) => (ny > 0.4 ? "#eadcb6" : tom(["#2a5a70", "#3f84a0", "#8ac4d8"], -(0.4 * nx + 0.9 * ny))));
    g.lin(1, 6, 2, 8, "#2a5a70"); g.lin(1, 12, 2, 10, "#2a5a70"); g.p(1, 9, "#2a5a70");
    g.p(12, 8, "#2a1a14"); g.lin(5, 5, 9, 5, "#2a5a70"); g.p(7, 9, "#c8e4ec");
  });
  item("lingote_bronze", (g) => {
    for (let y = 0; y < 5; y++) g.ret(3 + (4 - y) * 0.5 | 0, 7 + y, 10 - ((4 - y) | 0), 1, (x) => tom(["#7a4a18", "#b8862b", "#e8b94a", "#ffe08a"], -(x - 8) * 0.12 - (2 - y) * 0.35));
    g.lin(5, 7, 10, 7, "#ffe08a"); g.lin(3, 11, 12, 11, "#5a3410");
  });
  item("tecido_linho", (g) => {
    // peça de tecido dobrada em três
    for (let i = 0; i < 3; i++) g.ret(3, 6 + i * 2.5 | 0, 10, 2, (x) => tom(["#c8b898", "#e8dcc0", "#fbf5e6"], -(x - 8) * 0.1 + (1 - i) * 0.3));
    g.lin(3, 13, 12, 13, "#a8987a"); g.p(12, 7, "#3b5a9a"); g.p(12, 10, "#3b5a9a");
  });
  item("frasco_barro", (g) => {
    g.elip(8, 11, 3.2, 3, esfera(["#6a3a22", "#9a5a36", "#c47e52"]));
    g.ret(7, 5, 2, 4, "#9a5a36"); g.ret(6, 4, 4, 1, "#c47e52"); g.p(7, 10, "#e0a272");
  });
  item("oleo_peixe", (g) => {
    g.elip(8, 10.5, 3.6, 3.4, esfera(["#5a4a1a", "#9a8a2a", "#d0c04a", "#f0e08a"]));
    g.ret(7, 4, 2, 4, "#c8b48a"); g.ret(6, 3, 4, 1, "#7d522b"); g.p(7, 9, "#fff8c8");
  });
  item("peixe_seco", (g) => {
    g.elip(8, 9, 5, 2.4, (nx, ny) => tom(["#7a5a30", "#a8844a", "#d0b07a"], -(0.4 * nx + 0.9 * ny)));
    g.lin(2, 7, 3, 9, "#7a5a30"); g.lin(2, 11, 3, 9, "#7a5a30");
    for (const x of [6, 8, 10]) g.p(x, 9, "#5a3a1a");
    g.lin(8, 3, 8, 6, "#c8b48a"); g.p(11, 8, "#2a1a14");
  });
  item("peixe_defumado", (g) => {
    g.elip(8, 9.5, 5.6, 2.8, (nx, ny) => tom(["#4a2a14", "#7a4a22", "#a8703a"], -(0.4 * nx + 0.9 * ny)));
    g.lin(1, 7, 2, 9, "#4a2a14"); g.lin(1, 12, 2, 10, "#4a2a14"); g.p(12, 9, "#2a1a14");
    g.p(6, 4, "#b8b0a8"); g.p(8, 3, "#d8d0c8"); g.p(10, 5, "#b8b0a8");
  });
  item("jarro_barro", (g) => {
    g.elip(8, 10, 4.6, 4.2, esfera(["#6a3a22", "#9a5a36", "#c47e52", "#e0a272"]));
    g.ret(6, 3, 4, 3, "#9a5a36"); g.ret(5, 3, 6, 1, "#c47e52");
    g.lin(11, 5, 12, 8, "#6a3a22"); g.lin(5, 10, 11, 10, "#5a3018");
  });
  item("lamparina", (g) => {
    g.elip(7, 11, 5, 2.4, esfera(["#6a3a22", "#9a5a36", "#c47e52", "#e0a272"]));
    g.ret(11, 9, 3, 2, "#9a5a36"); g.p(6, 10, "#2a1a14");
    g.p(13, 7, "#ffe08a"); g.p(13, 8, "#e8a83a"); g.p(12, 7, "#ffd06a"); g.p(13, 6, "#fff2c8");
  });
  item("anfora", (g) => {
    g.elip(8, 9, 3.6, 4.4, esfera(["#6a3a22", "#9a5a36", "#c47e52", "#e0a272"]));
    g.ret(7, 2, 2, 3, "#9a5a36"); g.lin(6, 3, 5, 6, "#6a3a22"); g.lin(9, 3, 10, 6, "#6a3a22");
    g.lin(8, 13, 8, 14, "#6a3a22"); g.p(7, 15, "#5a3018"); g.lin(5, 9, 11, 9, "#c8b48a");
  });
  item("incenso", (g) => {
    // pedaços de olíbano num pratinho, com fumaça
    g.elip(8, 12.5, 5, 1.8, esfera(["#6e5a40", "#a8906a", "#d0bc94"]));
    for (const [x, y] of [[6, 11], [9, 11], [8, 10]]) g.elip(x, y, 1.4, 1.2, esfera(["#c8a85a", "#e8d08a", "#fff2c8"]));
    g.p(8, 7, "#d8d0c8"); g.p(9, 5, "#b8b0a8"); g.p(8, 3, "#d8d0c8");
  });
  item("oleo_uncao", (g) => {
    // chifre de óleo (1 Sm 16:13)
    g.lin(4, 12, 11, 5, (x, y, i) => (i % 3 ? "#e8d8b0" : "#c8b48a"));
    g.lin(5, 12, 12, 5, "#b8a07a"); g.lin(4, 11, 10, 5, "#fff2c8");
    g.ret(11, 3, 2, 2, "#7d522b"); g.p(13, 3, "#e8b94a"); g.p(3, 13, "#7a6a4a");
  });
  item("manto_bordado", (g) => {
    g.ret(4, 4, 8, 10, (x, y) => tom(["#5a2a6a", "#7a3a8e", "#a05ab8"], -((x - 8) * 0.1 + (y - 8) * 0.2)));
    g.apagar(4, 4); g.apagar(11, 4); g.ret(7, 4, 2, 2, "#3a1a44");
    for (let y = 6; y <= 13; y += 2) { g.p(4, y, "#e8b94a"); g.p(11, y, "#e8b94a"); }
    g.lin(4, 13, 11, 13, "#e8b94a");
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
  // Item com raridade ("espada_ferro@raro.dano2") usa a arte do item base.
  const aliasItem = (id) => {
    const base = typeof id === "string" ? id.split("@")[0] : id;
    return ALIAS_ITEM[base] || base;
  };

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
  glifo("ui_talentos", ["..kGGk..", ".kGgGGk.", "kGGkGgGk", "kGgGGGGk", ".kkTTkk.", "..kTTk..", "..kTTk..", ".kkkkkk."], { G: "#5f8a3a", g: "#8fbf5a", T: "#7a4a30" });
  // Ofícios (JGB-24): um glifo por ofício (of_<icone> em dados/oficios.js).
  glifo("of_pescador", ["......k.", ".....kWk", "..kk.k..", ".kBBkk..", "kBbBBBk.", ".kBBBk..", "..kkk...", "........"], { B: "#3f84a0", b: "#2a1a14", W: "#e6cf9c" });
  glifo("of_ferreiro", [".kkkkk..", ".kIIIIk.", ".kkkIIk.", "...kNk..", "...kNk..", "...kNk..", "...kNk..", "...kkk.."], { I: "#a8b4bc", N: "#7d522b" });
  glifo("of_carpinteiro", ["....kkk.", "...kIIk.", "..kIIk..", ".kNkk...", "kNk.....", "kk......", ".kkkkkk.", "kNNNNNNk"], { I: "#a8b4bc", N: "#a8703a" });
  glifo("of_oleiro", ["..kkkk..", ".kOOOOk.", "kOoOOOOk", "kOOOOOOk", ".kOOOOk.", "..kkkk..", "kkkkkkkk", "kNNNNNNk"], { O: "#c47e52", o: "#e0a272", N: "#7d522b" });
  glifo("of_tecelao", ["k.k.k.k.", "kLkLkLk.", "LLLLLLL.", "kLkLkLk.", "LLLLLLL.", "kLkLkLk.", "k.k.k.k.", "........"], { L: "#e6cf9c" });
  glifo("of_perfumista", ["...kk...", "..kYYk..", "...kk...", "..kPPk..", ".kPpPPk.", "kPPPPPPk", ".kPPPPk.", "..kkkk.."], { Y: "#e8b94a", P: "#8a4ac2", p: "#c8a0e8" });
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
  // Bestiário (livro de capa de couro com a pegada dourada), amuleto da família e ampulheta do analisador.
  glifo("ui_bestiario", [".kkkkkk.", "kYLYLYPk", "kLLLLLPk", "kLYYYLPk", "kLYYYLPk", "kLLYLLPk", "kLLLLLPk", ".kkkkkk."], { L: "#7a4a30", Y: "#e8b94a", P: "#f3e4c0" });
  glifo("ui_amuleto", ["C......C", ".C....C.", "..C..C..", "...kk...", "..kYYk..", ".kYyGYk.", ".kYGGdk.", "..kddk.."], { C: "#c9b48a", Y: "#e8b94a", y: "#ffe08a", d: "#b8862b", G: "#3fa66a" });
  // Habilidades das vocações (JGB-20): um glifo por ícone (hb_<icone> em dados/vocacoes.js).
  glifo("hb_espada", ["......kW", ".....kWk", "....kWk.", "k..kWk..", "kk.Wk...", ".kBk....", "kBkkk...", "kk......"], { W: "#e4ecf0", B: "#b07a38" });
  glifo("hb_escudo", ["kkkkkkkk", "kBBBBBdk", "kBbBBBdk", "kBBYBBdk", ".kBBBdk.", ".kBBBdk.", "..kBdk..", "...kk..."], { B: "#b07a38", b: "#d29e52", d: "#6b4a2e", Y: "#e8b94a" });
  glifo("hb_grito", [".kk...W.", "kRRk.W..", "kRRRk..W", "kRRRk.W.", "kRRRk..W", "kRRk.W..", ".kk...W.", "........"], { R: "#c2452d", W: "#f6efdc" });
  glifo("hb_escudo_golpe", ["kkkkk.Y.", "kBBBk.YY", "kBbBkYY.", "kBBBk.Y.", ".kBk....", "..k.....", "........", "........"], { B: "#b07a38", b: "#d29e52", Y: "#ffe08a" });
  glifo("hb_investida", ["........", "W...kk..", "....kWk.", "WWkkWWWk", "....kWk.", "W...kk..", "........", "........"], { W: "#e4ecf0" });
  glifo("hb_redemoinho", ["..kkkk..", ".kW..Wk.", "kW.kk.Wk", "kW.k..W.", "kW..kWk.", "k.Wk....", ".k.kkkk.", "..k....."], { W: "#e4ecf0" });
  glifo("hb_coracao", [".kk.kk..", "kRRkRRk.", "kRrRRRk.", "kRRRRRk.", ".kRRRk..", "..kRk...", "...k....", "........"], { R: "#c2452d", r: "#ef6a5e" });
  glifo("hb_chama", ["...k....", "..kYk...", "..kYk.k.", ".kYOYkYk", ".kYOOYYk", "kYOOROYk", "kYORROYk", ".kkkkkk."], { Y: "#ffe08a", O: "#e8b94a", R: "#c2452d" });
  glifo("hb_muralha", ["kkkkkkkk", "kSSkSSSk", "kkkkkkkk", "kSSSkSSk", "kkkkkkkk", "kSSkSSSk", "kkkkkkkk", "........"], { S: "#b8ab8a" });
  glifo("hb_pedra", ["........", "..kkk...", ".kSSsk..", "kSSSssk.", "kSSssdk.", ".kSsdk..", "..kkk...", "........"], { S: "#d8ccb0", s: "#b8ab8a", d: "#8a7a6a" });
  glifo("hb_testa", [".kkkkk..", "kRRRRRk.", "kRWWWRk.", "kRWkWRk.", "kRWWWRk.", "kRRRRRk.", ".kkkkk..", "........"], { R: "#c2452d", W: "#f6efdc" });
  glifo("hb_salto", ["kkkk....", "kWWk....", "kWk.....", "k.kW....", "...kW...", "....kW..", ".....kWk", "......kk"], { W: "#e4ecf0" });
  glifo("hb_chuva", ["S..S..S.", "d..d..d.", "........", ".S..S..S", ".d..d..d", "........", "S..S..S.", "d..d..d."], { S: "#d8ccb0", d: "#8a7a6a" });
  glifo("hb_pedra_afiada", ["......kR", "....kkR.", "..kSSk..", ".kSSsk..", "kSSsk...", "kSsk....", ".kk.....", "........"], { S: "#d8ccb0", s: "#b8ab8a", R: "#c2452d" });
  glifo("hb_duas_pedras", [".kkk....", "kSsk....", "kSdk....", ".kk.kkk.", "....kSsk", "....kSdk", ".....kk.", "........"], { S: "#d8ccb0", s: "#b8ab8a", d: "#8a7a6a" });
  glifo("hb_olho", ["........", "..kkkk..", ".kWWWWk.", "kWWBBWWk", "kWWBkWWk", ".kWWWWk.", "..kkkk..", "........"], { W: "#f6efdc", B: "#4fa3a5" });
  glifo("hb_pedra_grande", ["..kkkk..", ".kSSssk.", "kSSSsssk", "kSSssddk", "kSsssddk", "kSssdddk", ".kddddk.", "..kkkk.."], { S: "#d8ccb0", s: "#b8ab8a", d: "#8a7a6a" });
  glifo("hb_cura", ["...kk...", "..kGGk..", "..kGGk..", "kkkGGkkk", "kGGGGGGk", "kkkGGkkk", "..kGGk..", "...kk..."], { G: "#8fd16a" });
  glifo("hb_candelabro", ["Y.Y.Y.Y.", "N.N.N.N.", "NNNNNNN.", "...N....", "...N....", "..NNN...", ".NNNNN..", "........"], { Y: "#ffe08a", N: "#e8b94a" });
  glifo("hb_incenso", ["..W.W...", "...W....", "..W.....", "..kkkk..", ".kNNNNk.", ".kNnNNk.", "..kNNk..", "..kkkk.."], { W: "#d8ccb0", N: "#b07a38", n: "#d29e52" });
  glifo("hb_agua", ["...kk...", "..kBBk..", ".kBbBBk.", ".kBbBBk.", "kBBBBBBk", "kBBBBBdk", ".kBBBdk.", "..kkkk.."], { B: "#6fd0d0", b: "#d8f4f4", d: "#3a8a8a" });
  glifo("hb_trombeta", ["........", "k.......", "kNk.....", "kNNk....", ".kNNkk..", "..kNNNkk", "...kNNNk", "....kkk."], { N: "#e0c088" });
  glifo("hb_escudo_luz", ["Y.kkkk.Y", ".kWWWWk.", "kWWYWWWk", "kWYYYWWk", ".kWYWWk.", ".kWWWk..", "..kWk...", "...k...."], { W: "#d8f4f4", Y: "#ffe08a" });
  glifo("hb_maos", ["k.k..k.k", "kSk..kSk", "kSk..kSk", "kSSkkSSk", "kSSSSSSk", ".kSSSSk.", "..kSSk..", "..kkkk.."], { S: "#e0a878" });
  glifo("hb_altar", ["..Y..Y..", ".YRY.Y..", "..kkkk..", ".kSSSSk.", "kSSSSSSk", "kSdSSdSk", "kSSSSSSk", "kkkkkkkk"], { Y: "#ffe08a", R: "#c2452d", S: "#b8ab8a", d: "#8a7a6a" });
  glifo("hb_harpa", ["kkkkk...", "kN..Wk..", "kN.W.Wk.", "kNW.W.Wk", "kN.W.W.k", "kN..W.k.", "kNNNNNk.", "kkkkkk.."], { N: "#b07a38", W: "#f6efdc" });
  glifo("hb_nuvem", ["..kkk...", ".kWWWkk.", "kWWWWWWk", "kWWWWWWk", ".kkWWkk.", "...kWk..", "...kWk..", "...kWk.."], { W: "#f6efdc" });
  glifo("hb_gota", ["...kk...", "...kk...", "..kVVk..", ".kVvVVk.", "kVvVVVdk", "kVVVVddk", ".kVVddk.", "..kkkk.."], { V: "#a8c84a", v: "#e4f0a8", d: "#6a8a2a" });
  glifo("hb_raio", ["....kkk.", "...kYk..", "..kYk...", ".kYYYYk.", "...kYk..", "..kYk...", ".kYk....", ".kk....."], { Y: "#ffe08a" });
  glifo("hb_balanca", ["...kk...", "kkkkkkkk", "k..kk..k", "Y..kk..Y", "YY.kk.YY", "...kk...", "..kkkk..", ".kkkkkk."], { Y: "#e8b94a" });
  glifo("hb_onda", ["........", "..kkk...", ".kBBBk..", "kBBkBBk.", "BkkkBBBk", "BBBBBBBk", "kBBBBBBk", "kkkkkkkk"], { B: "#4fa3a5" });
  glifo("hb_carro", ["Y..Y....", ".YR.Y...", "kkkkkk..", "kNNNNk..", "kkkkkkkk", ".kWk.kWk", "..k...k.", "........"], { Y: "#ffe08a", R: "#c2452d", N: "#c2452d", W: "#e8b94a" });
  glifo("hb_cao", ["k.....k.", "kk...kk.", "kNkkkNk.", "kNNNNNk.", "kNkNNkNk", "kNNNNNNk", ".kNNdNk.", "..kkkk.."], { N: "#b07a38", d: "#2a1a14" });
  glifo("hb_cajado", ["..kkkk..", ".kN..Nk.", ".kN..kk.", "..k.kN..", "....kN..", "....kN..", "....kN..", "....kk.."], { N: "#b07a38" });
  glifo("hb_ovelha", [".kkkkk..", "kWWWWWkk", "kWWWWkSk", "kWWWWkSk", "kWWWWWkk", ".kkkkkk.", ".k.k.k..", ".k.k.k.."], { W: "#f6efdc", S: "#3a3028" });
  glifo("hb_presa", ["kkkkkkkk", "kRRRRRRk", "kWkRRkWk", ".W.kk.W.", "........", ".W....W.", "kWkkkkWk", "kRRRRRRk"], { R: "#c2452d", W: "#f6efdc" });
  glifo("hb_rebanho", ["kkk.kkk.", "kWWkkWWk", "kWWkkWWk", "kkkkkkkk", "........", "..kkk...", ".kWWWk..", "..k.k..."], { W: "#f6efdc" });
  glifo("hb_vara", ["k......k", ".kN..Nk.", "..kNNk..", "...kk...", "..kNNk..", ".kN..Nk.", "kN....Nk", "k......k"], { N: "#b07a38" });
  glifo("hb_aprisco", ["N.N.N.N.", "NNNNNNNN", "N.N.N.N.", "N.N.N.N.", "NNNNNNNN", "N.N.N.N.", "N.N.N.N.", "........"], { N: "#b07a38" });
  // Maná (JGB-11): jarro de barro (o ômer) com flocos brancos caindo.
  glifo("ui_mana", [".W.W..W.", "..kkkk.W", ".kWWWWk.", "kCCCCCCk", "kCcCCCdk", "kCcCCCdk", ".kCCCdk.", "..kkkk.."], { C: "#c98a52", c: "#e0a878", d: "#8e5a2b", W: "#f6efdc" });
  glifo("ui_ampulheta", ["NNNNNNNN", ".kYYYYk.", "..kYYk..", "...kk...", "...kk...", "..k.Yk..", ".kYYYYk.", "NNNNNNNN"], { N: "#b07a38", Y: "#e8b94a" });

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
  // Brilho do saque no chão e pilar de luz (brancos: o jogo tinge na cor da raridade).
  registrar("fx_aura", {
    w: 28, h: 12, contorno: null, origem: [0.5, 0.5],
    desenhar: (g) => g.elip(14, 6, 13, 5.2, (nx, ny) => {
      const d = nx * nx + ny * ny;
      return comAlfa("#ffffff", d < 0.2 ? 0.75 : d < 0.5 ? 0.45 : 0.2);
    }),
  });
  registrar("fx_pilar", {
    w: 8, h: 56, contorno: null, origem: [0.5, 1],
    desenhar(g) {
      for (let y = 0; y < 56; y++) {
        const a = 0.65 * (y / 55) ** 1.4;
        g.ret(2, y, 4, 1, comAlfa("#ffffff", a));
        g.p(1, y, comAlfa("#ffffff", a * 0.4)); g.p(6, y, comAlfa("#ffffff", a * 0.4));
        g.p(3, y, comAlfa("#ffffff", Math.min(1, a * 1.4))); g.p(4, y, comAlfa("#ffffff", Math.min(1, a * 1.4)));
      }
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

  // Decoração plana das vilas (até 3 px-a de altura; vai em casa livre; posições em dados/mapas.js).
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
  // Sem entrada aqui, a aparencia "x" usa o sprite "in_x" (criaturas novas: in_chacal, in_javali…).
  const VISUAL_POR_APARENCIA = { lobo: "in_lobo", escorpiao: "in_escorpiao", bandido: "in_salteador", soldado: "in_guarda_egipcio", guerreiro: "in_amalequita" };
  const CHEFES = new Set(["bandido1"]);
  // NPCs sem visual próprio que compartilham um visual pelo papel (os 6 atalaias são o mesmo vigia).
  const VISUAL_POR_PAPEL = { mural: "pj_atalaia" };

  function visualDe(id) {
    if (VISUAL_NPC[id]) return VISUAL_NPC[id];
    const n = typeof npcs !== "undefined" ? npcs[id] : null;
    if (n && n.aparencia && PIXEL_PATTERNS["pj_morador_" + n.aparencia]) return "pj_morador_" + n.aparencia;
    if (n && VISUAL_POR_PAPEL[n.papel]) return VISUAL_POR_PAPEL[n.papel];
    if (VISUAL_INIMIGO[id]) return VISUAL_INIMIGO[id];
    const ini = typeof inimigos !== "undefined" ? inimigos[id] : null;
    if (ini) return VISUAL_POR_APARENCIA[ini.aparencia] || (PIXEL_PATTERNS["in_" + ini.aparencia] ? "in_" + ini.aparencia : "in_salteador");
    return "pj_viajante";
  }
  const nomeCurto = (nome) => String(nome || "").split(/[,·]/)[0].trim();

  // -------------------------------------------------------------------
  // Biomas (§3.3)
  // -------------------------------------------------------------------
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
    },
    galileia: {
      chao: { base: "#7ea05a", escuro: "#6a8c4c", claro: "#97b86e", salpico: "#b8d080" },
      mancha: { base: "#74965a", escuro: "#62844a" },
      caminho: { base: "#8a7a62", escuro: "#6e604c", claro: "#a8987c", borda: "#5a4e3e" },
      agua: { profunda: "#2f6a7a", base: "#3a7688", escura: "#336e80", clara: "#4a8fa0", brilho: "#6aaab8", espuma: "#e8f2e0" },
      obstaculos: [{ tipo: "figueira", peso: 35, alto: true }, { tipo: "basalto_muro", peso: 30 }, { tipo: "basalto", peso: 20 }, { tipo: "barco", peso: 15, soMarco: true }],
      borda: { tipo: "muro_basalto", rampa: ["#262422", "#363432", "#4c4a48", "#6e6a64"], norte: "agua" },
      moldura: { norte: "agua", sul: "colinas", leste: "colinas", oeste: "colinas" },
      deco: [{ tipo: "anemona", peso: 3, cor: "#d8443a" }, { tipo: "mostarda", peso: 3, cor: "#e2c044" }, { tipo: "lirio", peso: 2, cor: "#b8a0d0" }, { tipo: "tufo", peso: 3, cor: "#5e7e40" }],
      luz: { cor: "#ffe0a0", alfa: 0.08, modo: "screen" }, vinheta: { cor: "#1a1408", forca: 0.24 }, sombra: "#2a3a3a",
      particulas: { tipo: "borboleta", cor: "#f6efdc", max: 15 },
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
  // -------------------------------------------------------------------
  // Rochas facetadas em px de arte: o contorno é um polígono irregular (7 a 10 lados sorteados em volta de uma
  // elipse, a base reta no chão) e cada lado vira uma face que sobe até o pico, um pouco à esquerda e acima do
  // meio. A luz de cada face (de cima e da esquerda) mistura a direção da face com o volume da pedra e cai em 4
  // tons; as cristas viradas para a luz ganham 1 px de realce e as dobras viradas para baixo, 1 px escuro.
  // Material: estratos (arenito), pintas (granito), musgo, colunas (basalto) e rachaduras. O contorno e a sombra
  // no chão (para a direita) completam a peça. tons: [sombra funda, sombra, base, luz, realce].
  // -------------------------------------------------------------------
  function rochaArte(g, cx, B, rx, ry, tons, sem, o = {}) {
    const N = o.lados || 8, angs = [], raios = [];
    for (let k = 0; k < N; k++) {
      angs.push(-Math.PI + ((k + 0.25 + hash2(k, sem, 1) * 0.5) * 2 * Math.PI) / N);
      raios.push(0.84 + hash2(k, sem, 2) * 0.24);
    }
    const setor = (a) => { let k = N - 1; for (let i = 0; i < N; i++) if (a >= angs[i]) k = i; return a < angs[0] ? N - 1 : k; };
    const raio = (a) => {
      const k = setor(a), k2 = (k + 1) % N;
      let a0 = angs[k], a1 = angs[k2];
      if (a1 <= a0) a1 += 2 * Math.PI;
      let aa = a; if (aa < a0) aa += 2 * Math.PI;
      const t = (aa - a0) / (a1 - a0);
      // lado reto entre dois vértices: raio do polígono na direção a (aproximação pela corda)
      const r0 = raios[k], r1 = raios[k2], meio = Math.cos(((a1 - a0) / 2));
      return ((r0 * (1 - t) + r1 * t) * meio) / Math.cos(aa - (a0 + a1) / 2);
    };
    const cy = B - ry * (o.alto || 0.92), pkx = -0.22, pky = -0.42;
    const W = g.w, H = g.h, mapa = new Int8Array(W * H).fill(-1), face = new Int8Array(W * H).fill(-1);
    const nxy = (X, Y) => [(X + 0.5 - cx) / rx, (Y + 0.5 - cy) / ry];
    for (let Y = Math.max(0, Math.floor(cy - ry * 1.2)); Y <= Math.min(H - 1, B); Y++)
      for (let X = Math.max(0, Math.floor(cx - rx * 1.2)); X <= Math.min(W - 1, Math.ceil(cx + rx * 1.2)); X++) {
        const [nx, ny] = nxy(X, Y), d = Math.hypot(nx, ny);
        if (d > raio(Math.atan2(ny, nx))) continue;
        const k = setor(Math.atan2(ny - pky, nx - pkx)), am = (angs[k] + angs[(k + 1) % N] + (k === N - 1 ? 2 * Math.PI : 0)) / 2;
        const fb = -(0.62 * Math.cos(am) + 0.78 * Math.sin(am)), sb = -(0.6 * nx + 0.8 * ny) * 0.8 + (1 - d) * 0.35;
        const l = 0.5 * fb + 0.5 * sb + (o.luz || 0) - (ny > 0.55 ? 0.25 : 0);
        let tom = l > 0.42 ? 3 : l > 0.02 ? 2 : l > -0.42 ? 1 : 0;
        if (ny < -0.4 && l > -0.35) tom = Math.max(tom, 3); // o plano de cima, sempre na luz
        mapa[Y * W + X] = tom;
        face[Y * W + X] = k;
      }
    const em = (X, Y) => (X < 0 || Y < 0 || X >= W || Y >= H ? -1 : mapa[Y * W + X]);
    const fc = (X, Y) => (X < 0 || Y < 0 || X >= W || Y >= H ? -1 : face[Y * W + X]);
    const t = mapa.slice();
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const v = em(X, Y);
      if (v < 0) continue;
      const i = Y * W + X, [nx, ny] = nxy(X, Y);
      // material
      if (o.estratos && ny > -0.5 && (Y + Math.round(nx * 2)) % 4 === 0) t[i] = Math.max(0, v - 1);
      if (o.colunas && ny > -0.35 && (X + (Y >> 3)) % 4 === 0) t[i] = Math.max(0, v - 1);
      if (o.pintas && hash2(X, Y, sem + 3) < 0.1) t[i] = hash2(X, Y, sem + 4) < 0.5 ? Math.max(0, v - 1) : Math.min(4, v + 1);
      // cristas e dobras entre faces (só na metade de cima, onde se vê o volume)
      const kR = fc(X + 1, Y), kB = fc(X, Y + 1);
      if (ny < 0.35 && ((kR >= 0 && kR !== face[i]) || (kB >= 0 && kB !== face[i]))) {
        const outro = kR >= 0 && kR !== face[i] ? em(X + 1, Y) : em(X, Y + 1);
        t[i] = v >= 2 && outro >= 2 ? 4 : Math.max(0, Math.min(v, outro) - 1);
      }
      // silhueta: realce em cima e à esquerda, sombra funda embaixo e à direita
      if (em(X, Y - 1) < 0 && v >= 2) t[i] = 4;
      else if (em(X - 1, Y) < 0 && v >= 2 && ny < 0.3) t[i] = Math.max(t[i], 3);
      else if (em(X + 1, Y) < 0 || em(X, Y + 1) < 0) t[i] = Math.min(t[i], 0);
      if (o.musgo && ny < -0.25 && v >= 2 && hash2(X >> 1, Y >> 1, sem + 5) < 0.42) t[i] = 5 + (hash2(X, Y, sem + 6) < 0.5 ? 0 : 1);
    }
    // rachaduras: passeios curtos de 1 px na face de sombra
    for (let r = 0; r < (o.rachas ?? 2); r++) {
      let X = Math.round(cx + rx * (0.1 + hash2(r, sem, 7) * 0.5)), Y = Math.round(cy - ry * 0.2 + hash2(sem, r, 8) * ry * 0.6);
      for (let n = 0; n < 4 + Math.floor(hash2(r, sem, 9) * 4); n++) {
        if (em(X, Y) >= 1 && em(X + 1, Y) >= 0 && em(X, Y + 1) >= 0) t[Y * W + X] = 0;
        Y += 1; X += hash2(n, r, sem + 10) < 0.5 ? 1 : 0;
      }
    }
    const musgo = o.corMusgo || ["#4a5a2a", "#6e8a3a"];
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const v = t[Y * W + X];
      if (mapa[Y * W + X] < 0) continue;
      g.fino(X, Y, v >= 5 ? musgo[v - 5] : tons[v]);
    }
  }
  // Pedra de uma casa (baixa): 1 ou 2 blocos e a sombra para a direita.
  function pedregulho(chave, variantes, tons, sem0, o = {}) {
    return obstaculo(chave, false, variantes, (g, v) => {
      const sem = sem0 + v * 31, B = 31;
      const [rx, ry, cx] = (o.formas || [[13, 10, 18], [11, 8, 16], [14, 12, 18]])[v % 3];
      g.sombra((cx + 4) / 2, B / 2, rx / 2 + 1.5, 1.6, "#1c1210", 0.32);
      if (o.antes) o.antes(g, v, B);
      if (o.dupla && v === 1) rochaArte(g, cx + rx - 1, B, rx * 0.45, ry * 0.5, tons, sem + 7, { ...o, rachas: 0, lados: 7 });
      rochaArte(g, cx, B, rx, ry, tons, sem, o);
      if (o.dupla && v !== 1) rochaArte(g, cx - rx * 0.55, B + 1, rx * 0.42, ry * 0.45, tons, sem + 9, { ...o, rachas: 0, lados: 7, musgo: false });
    });
  }
  // Arbusto de uma casa (bloqueia): galhos curtos no pé e a copa baixa em cachos (Copa, os mesmos 5 tons e o
  // contorno escuro das árvores), sombra para a direita. o.seco: cachos ralos com os galhos à mostra;
  // o.flores: [cor, luz] dos pontinhos de flor.
  function arbustoOb(chave, variantes, tons, sem0, o = {}) {
    const d = obstaculo(chave, false, variantes, (g, v) => {
      const sem = sem0 + v * 37, B = 31, W = g.w, cx = W / 2 + (v - 1);
      g.sombra(cx / 2 + 2.5, B / 2, 8, 1.7, "#1c1210", 0.3);
      const casca = o.casca || CASCA_ACACIA;
      for (let k = 0; k < 5; k++) galhoArte(g, cx + (k - 2), B, cx + (k - 2) * 4, B - 9 - (k % 2) * 4, casca, false);
      const C = new Copa(W, B + 1);
      const molde = [[cx - 7, B - 11, 7, 6], [cx + 6, B - 12, 7, 6], [cx, B - 17, 8, 6], [cx - 4, B - 6, 7, 4.5], [cx + 5, B - 6, 6, 4]];
      moldeCopa(C, o.seco ? molde.filter((_, i) => hash2(i, v, sem) > 0.35) : molde, v, sem, { topo: B - 23, base: B, lobos: 7, jitter: 4 });
      if (o.seco) for (let k = 0; k < 4; k++) galhoArte(g, cx + (k - 1.5) * 3, B - 8, cx + (k - 1.5) * 9, B - 22 + (k % 2) * 3, casca, false);
      C.pintar(g, tons, sem, 0.5);
      if (o.flores) for (let k = 0; k < 12; k++) {
        const X = 4 + Math.floor(hash2(k, v, sem + 20) * (W - 8)), Y = B - 24 + Math.floor(hash2(v, k, sem + 21) * 18);
        if (C.get(X, Y) >= 2) { g.fino(X, Y, o.flores[0]); if (k % 2) g.fino(X, Y - 1, o.flores[1]); }
      }
    });
    d.contorno = "#1c2414";
    return d;
  }
  // Retama (giesta do deserto): moita de varas finas que sobem em leque, verde-acinzentadas, com as pontas claras,
  // folhinhas em grupos de 2 px e flores amarelas.
  function retamaOb(chave, variantes, sem0) {
    const d = obstaculo(chave, false, variantes, (g, v) => {
      const sem = sem0 + v * 41, B = 31, cx = g.w / 2 + (v - 1);
      const c = ["#3e3e20", "#5e5e30", "#7e7e44", "#a0a060"];
      g.sombra(cx / 2 + 2, B / 2, 7, 1.5, "#1c1210", 0.3);
      const n = 13 + v * 2;
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.1 + (hash2(k, v, sem) - 0.5) * 0.25;
        const L = 13 + Math.floor(hash2(v, k, sem + 1) * 9) - Math.abs(k / (n - 1) - 0.5) * 8;
        const x0 = cx + Math.round((k / (n - 1) - 0.5) * 6), X1 = x0 + Math.cos(a) * L, Y1 = B + Math.sin(a) * L;
        linhaPx(g, x0, B, X1, Y1, (X, Y, i) => (i < 3 ? c[0] : i > L - 3 ? c[3] : k % 2 ? c[1] : c[2]));
        for (let q = 4; q < L - 2; q += 4) {
          const X = Math.round(x0 + Math.cos(a) * q), Y = Math.round(B + Math.sin(a) * q), lado = k < n / 2 ? -1 : 1;
          g.fino(X + lado, Y, c[2]); g.fino(X + lado * 2, Y - 1, c[3]);
        }
        if (hash2(k, v, sem + 2) < 0.4) { g.fino(Math.round(X1), Math.round(Y1) - 1, "#e8d468"); g.fino(Math.round(X1) + 1, Math.round(Y1), "#b89a3a"); }
      }
    });
    d.contorno = "#2a2a16";
    return d;
  }
  // Coral morto na praia do Mar Vermelho: galhos grossos que se bifurcam (3, 2 e 1 px), com as pontas claras e os
  // pólipos em pontinhos, sobre uma laje de pedra.
  function coralOb(chave, variantes, sem0) {
    return obstaculo(chave, false, variantes, (g, v) => {
      const sem = sem0 + v * 43, B = 31, cx = g.w / 2 + (v - 1) * 2;
      const c = ["#5a1e1a", "#8a3a30", "#b8584a", "#d8806a", "#f2ae90"];
      g.sombra(cx / 2 + 2, B / 2, 8, 1.6, "#1c1210", 0.32);
      rochaArte(g, cx, B, 9, 3, ["#4a3a30", "#6a5446", "#8a705c", "#a88c74", "#c4a88e"], sem + 5, { lados: 7, rachas: 0 });
      const galho = (X, Y, ang, L, larg, prof) => {
        const X1 = X + Math.cos(ang) * L, Y1 = Y + Math.sin(ang) * L;
        for (let w = 0; w < larg; w++) linhaPx(g, X + w, Y, X1 + w, Y1, (x, y, i) => (w === 0 ? c[Math.min(4, 2 + prof)] : w === larg - 1 ? c[Math.max(0, prof)] : c[1 + Math.min(2, prof)]));
        if (prof >= 2 || L < 4) { g.fino(Math.round(X1), Math.round(Y1) - 1, c[4]); return; }
        const abre = 0.45 + hash2(prof, Math.round(X), sem) * 0.35;
        galho(X1, Y1, ang - abre, L * 0.72, Math.max(1, larg - 1), prof + 1);
        galho(X1, Y1, ang + abre, L * 0.66, Math.max(1, larg - 1), prof + 1);
      };
      galho(cx - 4, B - 4, -Math.PI / 2 - 0.5, 9 + v, 3, 0);
      galho(cx + 2, B - 4, -Math.PI / 2 + 0.35, 10, 3, 0);
      if (v !== 1) galho(cx - 1, B - 5, -Math.PI / 2 - 0.05, 7, 2, 1);
    });
  }

  // -------------------------------------------------------------------
  // Vegetação em escala de MMORPG clássico: a árvore é maior que a casa. A copa transborda para cima (a
  // árvore tem 56–68 px de altura, quase 2 casas) e um pouco para os lados; o tronco fica na casa que bloqueia,
  // com a base na linha b (a colisão não muda). Desenho em px de arte: a copa é feita de cachos de folhas
  // (bolhas recortadas em lobos) sombreados um a um em 5 tons (sombra funda → realce, luz de cima e da
  // esquerda); onde um cacho cai sobre outro, a borda escurece e separa os cachos; as marcas de folha vêm em
  // grupos de 2 px (nada de ruído de TV); contorno escuro de 1 px e a sombra no chão para a direita.
  // 3 variantes por espécie (quadros); game.js sorteia a variante, o espelho e um deslocamento por casa.
  // -------------------------------------------------------------------
  class Copa {
    constructor(W, H) { this.W = W; this.H = H; this.t = new Int8Array(W * H).fill(-1); }
    get(X, Y) { return X < 0 || Y < 0 || X >= this.W || Y >= this.H ? -1 : this.t[Y * this.W + X]; }
    set(X, Y, v) { if (X >= 0 && Y >= 0 && X < this.W && Y < this.H) this.t[Y * this.W + X] = v; }
    // Cacho de folhas: centro e raios em px de arte; luz: viés do cacho (+ mais claro); lobos: recortes da borda.
    cacho(cx, cy, rx, ry, sem, luz = 0, lobos = 6) {
      const fase = hash2(Math.round(cx), Math.round(cy), sem) * 6.283;
      const x0 = Math.floor(cx - rx - 3), x1 = Math.ceil(cx + rx + 3), y0 = Math.floor(cy - ry - 3), y1 = Math.ceil(cy + ry + 3);
      const novo = [];
      for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
        const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry, d = Math.sqrt(nx * nx + ny * ny);
        const lim = 1 + 0.11 * Math.sin(Math.atan2(ny, nx) * lobos + fase) + (hash2(X >> 1, Y >> 1, sem + 1) - 0.5) * 0.14;
        if (d <= lim) {
          const l = -(0.55 * nx + 0.8 * ny) * 0.7 + luz + (1 - d) * 0.2;
          novo.push(X, Y, l > 0.6 ? 4 : l > 0.22 ? 3 : l > -0.16 ? 2 : l > -0.52 ? 1 : 0);
        } else if (d <= lim + 1.2 / Math.min(rx, ry) && ny < 0.2 && this.get(X, Y) >= 0 && hash2(X >> 1, Y, sem + 2) < 0.7) novo.push(X, Y, -2); // fresta entre cachos
      }
      for (let i = 0; i < novo.length; i += 3) {
        const X = novo[i], Y = novo[i + 1], v = novo[i + 2];
        this.set(X, Y, v === -2 ? Math.max(0, Math.min(this.get(X, Y) - 1, 1)) : v);
      }
    }
    // Pinta na grade com os 5 tons; marcas de folha: grupos de 2 px um tom abaixo e brilhos de 1 px um tom acima.
    // Folhas: numa grade de 4 × 3 px (deslocada a cada fileira), cada folha é um traço de 2 px um tom acima com
    // 1 px um tom abaixo logo embaixo (a sombra da folha); marcas: chance de folha por célula.
    pintar(g, tons, sem, marcas = 0.5) {
      const W = this.W, t = this.t, orig = t.slice();
      const o = (X, Y) => (X < 0 || Y < 0 || X >= W || Y >= this.H ? -1 : orig[Y * W + X]);
      for (let Y = 1; Y < this.H - 1; Y += 3) for (let X = ((Y / 3) | 0) % 2 ? 2 : 0; X < W - 1; X += 4) {
        const h = hash2(X, Y, sem + 7);
        if (h > marcas) continue;
        const x = X + (h < marcas * 0.5 ? 1 : 0), v = o(x, Y);
        if (v < 1 || o(x + 1, Y) < 1 || o(x, Y + 1) < 0 || o(x, Y - 1) < 0) continue;
        if (v < 4) { t[Y * W + x] = v + 1; if (hash2(x, Y, sem + 8) < 0.6) t[Y * W + x + 1] = Math.min(4, o(x + 1, Y) + 1); }
        t[(Y + 1) * W + x] = Math.max(0, o(x, Y + 1) - 1);
      }
      for (let Y = 0; Y < this.H; Y++) for (let X = 0; X < W; X++) { const v = t[Y * W + X]; if (v >= 0) g.fino(X, Y, tons[v]); }
    }
    tem(X, Y) { return this.get(X, Y) >= 0; }
  }
  // Linha de 1 px de arte (Bresenham) em px de arte.
  function linhaPx(g, X0, Y0, X1, Y1, c) {
    X0 = Math.round(X0); Y0 = Math.round(Y0); X1 = Math.round(X1); Y1 = Math.round(Y1);
    const dX = Math.abs(X1 - X0), dY = -Math.abs(Y1 - Y0), sX = X0 < X1 ? 1 : -1, sY = Y0 < Y1 ? 1 : -1;
    let e = dX + dY, i = 0;
    for (;;) {
      g.fino(X0, Y0, typeof c === "function" ? c(X0, Y0, i++) : c);
      if (X0 === X1 && Y0 === Y1) break;
      const e2 = 2 * e;
      if (e2 >= dY) { e += dY; X0 += sX; }
      if (e2 <= dX) { e += dX; Y0 += sY; }
    }
  }
  // Tronco em px de arte, da base (x0, yb) ao topo (x1, yt): afina para cima, abre a raiz no chão; casca com
  // luz à esquerda, sombra à direita e estrias. cores: [sombra funda, sombra, base, luz]. torto: curva em px.
  function troncoArte(g, x0, yb, x1, yt, larg, cores, sem, torto = 0, afina = 0.4) {
    for (let Y = yt; Y <= yb; Y++) {
      const t = (yb - Y) / Math.max(1, yb - yt);
      const cx = x0 + (x1 - x0) * t + Math.sin(t * 3.4 + sem) * torto * t;
      let w = larg * (1 - t * afina);
      if (Y > yb - 4) w += (Y - (yb - 4)) * 1.3; // raiz que abre no chão
      const a = Math.round(cx - w / 2), b = Math.max(a + 1, Math.round(cx + w / 2) - 1), n = b - a;
      for (let X = a; X <= b; X++) {
        const i = X - a;
        let c = i === 0 ? cores[3] : i === n ? cores[0] : i >= n - 1 ? cores[1] : cores[2];
        if (i > 0 && i < n - 1 && hash2(X, Y >> 1, sem) < 0.16) c = cores[1];
        else if (i === 1 && hash2(X, Y, sem + 1) < 0.4) c = cores[3];
        g.fino(X, Y, c);
      }
    }
  }
  // Galho de 2 px: luz em cima, sombra embaixo.
  function galhoArte(g, X0, Y0, X1, Y1, cores, grosso = true) {
    linhaPx(g, X0, Y0, X1, Y1, cores[2]);
    if (grosso) linhaPx(g, X0 + 1, Y0 + 1, X1 + 1, Y1 + 1, cores[1]);
  }
  // Cachos de uma copa a partir de um molde [[x, y, rx, ry], ...], com variação por variante e a luz
  // maior em cima e à esquerda. Os de cima pintam primeiro; os de baixo ficam por cima (frente da copa).
  function moldeCopa(C, molde, v, sem, { luz = 0.18, jitter = 3, W = C.W, topo = 0, base = C.H, lobos = 6 } = {}) {
    const cachos = molde.map(([x, y, rx, ry], i) => [
      x + (hash2(i, v, sem) - 0.5) * jitter, y + (hash2(v, i, sem + 1) - 0.5) * jitter * 0.7,
      rx * (0.9 + hash2(i, v, sem + 2) * 0.2), ry * (0.9 + hash2(i, v, sem + 3) * 0.2),
    ]).sort((a, b) => a[1] - b[1]);
    cachos.forEach(([x, y, rx, ry], i) => {
      const l = luz - ((y - topo) / Math.max(1, base - topo)) * 0.42 - ((x - W / 2) / W) * 0.28;
      C.cacho(x, y, rx, ry, sem + i * 13, l, lobos);
    });
  }
  function arvore(chave, w, h, desenhar, contorno = "#1c2414") {
    return registrar(chave, {
      w, h, quadros: 3, alto: true, obstaculo: true, arvore: true, origem: [0.5, 1], contorno,
      desenhar(g, v) { desenhar(g, v, (h - 2) * 2, w * 2); },
    });
  }
  const CASCA_OLIVEIRA = ["#2a241e", "#463c32", "#665a4a", "#8a7e68"];
  const CASCA_FIGUEIRA = ["#2e2a26", "#4a443e", "#6a6258", "#8c8476"];
  const CASCA_ACACIA = ["#2a1e16", "#4a3424", "#6a4c32", "#8c6a46"];
  const CASCA_PALMEIRA = ["#3a2a1c", "#5a4228", "#7c5c38", "#a07c4e"];

  // Canaã
  // Oliveira: dois troncos cinzentos que se enroscam e abrem em galhos, copa aberta e prateada (cachos soltos,
  // com frestas onde aparecem os galhos), o avesso prateado das folhas e azeitonas.
  const MOLDE_OLIVEIRA = [
    [[20, 12, 10, 7], [35, 10, 10, 7], [10, 22, 8, 7], [46, 21, 8, 7], [22, 26, 10, 7], [37, 27, 10, 7], [28, 18, 9, 7]],
    [[16, 13, 9, 7], [30, 9, 10, 7], [43, 15, 9, 7], [9, 25, 8, 6], [24, 25, 10, 8], [41, 28, 10, 7], [33, 19, 8, 6]],
    [[24, 10, 11, 8], [40, 14, 9, 7], [12, 18, 8, 7], [17, 29, 9, 6], [31, 25, 11, 8], [46, 27, 7, 6]],
  ];
  arvore("ob_canaan_oliveira", 28, 31, (g, v, B, W) => {
    const cx = W / 2, sem = 310 + v * 17;
    g.sombra(cx / 2 + 3, B / 2 - 0.5, 12, 2.8);
    troncoArte(g, cx - 2, B, cx - 6 + v * 3, B - 24, 6, CASCA_OLIVEIRA, sem, 2.2);
    troncoArte(g, cx + 2, B - 2, cx + 5 - v, B - 22, 5, CASCA_OLIVEIRA, sem + 3, -1.8);
    galhoArte(g, cx - 6 + v * 3, B - 24, cx - 16, B - 32, CASCA_OLIVEIRA);
    galhoArte(g, cx + 5 - v, B - 22, cx + 16, B - 30, CASCA_OLIVEIRA);
    galhoArte(g, cx - 2, B - 26, cx + 1, B - 40, CASCA_OLIVEIRA);
    const C = new Copa(W, B);
    moldeCopa(C, MOLDE_OLIVEIRA[v], v, sem, { topo: 2, base: 36 });
    C.pintar(g, ["#28331f", "#3f4e30", "#5a6a42", "#7a8a5c", "#a2ae84"], sem);
    for (let k = 0; k < 22; k++) {
      const X = 4 + Math.floor(hash2(k, v, sem + 20) * (W - 8)), Y = 3 + Math.floor(hash2(v, k, sem + 21) * 32);
      if (C.get(X, Y) >= 2 && C.get(X + 1, Y) >= 2) { g.fino(X, Y, "#b8c094"); if (k % 3 === 0) g.fino(X + 1, Y, "#cdd2ac"); }
    }
    for (let k = 0; k < 7; k++) {
      const X = 6 + Math.floor(hash2(k, v, sem + 22) * (W - 12)), Y = 8 + Math.floor(hash2(v, k, sem + 23) * 26);
      if (C.get(X, Y) >= 1 && C.get(X, Y + 1) >= 1) { g.fino(X, Y, "#4a3c58"); g.fino(X, Y + 1, "#2a2034"); }
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
  pedregulho("ob_canaan_rocha", 3, ["#3e3a32", "#5e584c", "#857e6c", "#aaa28e", "#cec6b0"], 50, { musgo: true, dupla: true });

  // Deserto
  pedregulho("ob_deserto_rocha", 3, ["#5a3020", "#86482c", "#b0663c", "#d08a56", "#eab47e"], 60, { estratos: true, dupla: true });
  // Acácia: tronco fino que se abre em três galhos até a copa chata em guarda-chuva (cachos achatados, 8
  // lobos), com as bolinhas amarelas das flores. No Sinai a copa é mais rala e mais seca.
  const MOLDE_ACACIA = [
    [[13, 12, 8, 5], [24, 9, 9, 5], [36, 9, 9, 5], [47, 12, 8, 5], [8, 18, 7, 4], [19, 17, 9, 5], [31, 16, 9, 5], [42, 17, 9, 5], [52, 18, 6, 4]],
    [[16, 10, 9, 5], [29, 8, 10, 5], [42, 11, 9, 5], [10, 17, 8, 4], [23, 16, 10, 5], [37, 17, 9, 5], [50, 16, 7, 4]],
    [[11, 14, 8, 5], [22, 10, 9, 5], [35, 11, 9, 5], [48, 15, 8, 5], [16, 19, 9, 4], [29, 18, 10, 5], [42, 19, 9, 4]],
  ];
  function acacia(chave, tons, sem0, rala) {
    arvore(chave, 30, 28, (g, v, B, W) => {
      const cx = W / 2, sem = sem0 + v * 23;
      g.sombra(cx / 2 + 3, B / 2 - 0.5, 13, 2.6);
      const fx = cx + (v - 1) * 2, fy = B - 14;
      troncoArte(g, cx, B, fx, fy, 5, CASCA_ACACIA, sem, 1, 0.2);
      galhoArte(g, fx, fy, 14 + v, 20, CASCA_ACACIA);
      galhoArte(g, fx, fy, cx + 1, 15, CASCA_ACACIA);
      galhoArte(g, fx + 1, fy, 46 - v, 20, CASCA_ACACIA);
      galhoArte(g, fx - 6, fy - 4, 6 + v, 18, CASCA_ACACIA, false);
      const C = new Copa(W, B);
      const molde = rala ? MOLDE_ACACIA[v].filter((_, i) => hash2(i, v, sem) > 0.25) : MOLDE_ACACIA[v];
      moldeCopa(C, molde, v, sem, { topo: 4, base: 24, lobos: 8, luz: 0.22 });
      C.pintar(g, tons, sem, 0.4);
      for (let k = 0; k < 12; k++) {
        const X = 4 + Math.floor(hash2(k, v, sem + 30) * (W - 8)), Y = 4 + Math.floor(hash2(v, k, sem + 31) * 18);
        if (C.get(X, Y) >= 2) g.fino(X, Y, "#e2d27a");
      }
    });
  }
  acacia("ob_deserto_acacia", ["#30381a", "#4c5426", "#687034", "#888e44", "#aaa862"], 380, false);
  retamaOb("ob_deserto_retama", 3, 80);
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
  pedregulho("ob_mar_rochedo", 2, ["#3a322c", "#54483e", "#74644e", "#9a8664", "#bca884"], 90, { antes: (g) => g.elip(9.5, 15, 8.5, 1.8, "#e8f2e0") });
  obstaculo("ob_mar_recife", false, 2, (g, v, b) => {
    g.elip(9, b - 3, 8, 3.6, "#4fa3a5");
    for (let i = 0; i < 7; i++) {
      const x = 3 + i * 2 + (v && i % 2), h = 2 + Math.floor(hash2(i, v, 95) * 4);
      g.lin(x, b - 2, x, b - 2 - h, i % 2 ? "#a85a4a" : "#d07a5a"); g.p(x + 1, b - 2 - h + 1, "#d07a5a");
    }
  });

  // Egito
  // Tamareira: tronco alto com as cicatrizes das folhas em escamas (em V, luz à esquerda), coroa de folhas
  // compridas que caem com o peso (folíolos dos dois lados da nervura: claros em cima, escuros embaixo) e
  // cachos de tâmaras debaixo da coroa.
  arvore("ob_egito_tamareira", 26, 34, (g, v, B, W) => {
    const cx = W / 2, sem = 420 + v * 29;
    g.sombra(cx / 2 + 3, B / 2 - 0.5, 9, 2.4);
    const tx = cx + (v - 1) * 4, ty = 20 + v;
    for (let Y = ty; Y <= B; Y++) {
      const t = (B - Y) / (B - ty), xc = cx + (tx - cx) * t * t;
      const w = 6 - t * 1.5 + (Y > B - 3 ? (Y - (B - 3)) * 1.2 : 0);
      const a = Math.round(xc - w / 2), b = Math.round(xc + w / 2) - 1;
      for (let X = a; X <= b; X++) {
        const i = X - a, n = b - a, faixa = (Y + Math.abs(X + 0.5 - xc) * 0.9 | 0) % 4;
        let c = faixa === 0 ? CASCA_PALMEIRA[1] : faixa === 1 ? CASCA_PALMEIRA[3] : CASCA_PALMEIRA[2];
        if (i === n) c = CASCA_PALMEIRA[0]; else if (i === n - 1 && faixa !== 1) c = CASCA_PALMEIRA[1];
        else if (i === 0 && faixa !== 0) c = CASCA_PALMEIRA[3];
        g.fino(X, Y, c);
      }
    }
    const tons = ["#1e3418", "#2e4c20", "#44682a", "#5e8636", "#82a64c"];
    // [ângulo em graus (0 = direita, −90 = para cima), comprimento, plano: 0 atrás … 2 na frente]. Cada folha é
    // uma faixa curva: a nervura em cima (clara) e os folíolos pendurados embaixo, mais compridos no meio, com a
    // borda de baixo serrilhada e escura.
    const folhas = [[-120, 14, 0], [-60, 14, 0], [-92, 11, 0], [-140, 18, 1], [-40, 18, 1], [-165, 21, 1], [-15, 21, 1], [172, 23, 2], [8, 23, 2], [138, 18, 2], [42, 18, 2], [100, 12, 2]];
    for (const [ang0, L0, plano] of folhas) {
      const ang = ((ang0 + (hash2(ang0 + 200, v, sem) - 0.5) * 16) * Math.PI) / 180, L = L0 + (hash2(v, ang0 + 200, sem + 1) - 0.5) * 4;
      const dx = Math.cos(ang), dy = Math.sin(ang), b = plano + 1;
      for (let k = 1; k <= L; k++) {
        const t = k / L, X = Math.round(tx + dx * k), Y = Math.round(ty + dy * k * 0.8 + t * t * L * 0.55);
        const w = Math.max(1, Math.round(Math.sin(Math.min(1, t * 1.15) * Math.PI) * 4.6 + 0.6) - (k % 3 === 2 ? 1 : 0));
        for (let q = 0; q <= w; q++) g.fino(X, Y + q, q === 0 ? tons[Math.min(4, b + 1)] : q === w ? tons[Math.max(0, b - 1)] : tons[b]);
      }
    }
    for (const [ox, oy] of [[-4, 3], [3, 4], [-1, 5]]) for (let k = 0; k < 6; k++) g.fino(tx + ox + (k % 3) - 1, ty + oy + ((k / 3) | 0), k === 0 ? "#e8a050" : k % 2 ? "#a8521e" : "#d07a32");
    g.fino(tx, ty, tons[0]); g.fino(tx - 1, ty, tons[1]); g.fino(tx + 1, ty, tons[1]);
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
  pedregulho("ob_marVermelho_granito", 3, ["#4a1e18", "#74302a", "#9e4a3a", "#c46e56", "#e0987a"], 70, { pintas: true, lados: 7 });
  coralOb("ob_marVermelho_coral", 3, 95);
  obstaculo("ob_marVermelho_destrocos", false, 2, (g, v, b) => {
    g.sombra(10, b, 7.5, 1.2);
    const c = ["#5e4630", "#8a6a4a", "#a8865e"];
    g.lin(1, b - 2, 12, b - 6 + v, c[1]); g.lin(1, b - 1, 12, b - 5 + v, c[0]); g.lin(2, b - 3, 11, b - 7 + v, c[2]);
    g.lin(5, b, 16, b - 2, c[1]); g.lin(5, b - 1, 16, b - 3, c[2]);
    g.elip(13, b - 7, 2.6, 2.6, (nx, ny) => (nx * nx + ny * ny > 0.4 ? c[0] : null));
    g.p(13, b - 7, c[2]); g.lin(13, b - 7, 11, b - 4, c[0]);
  });

  // Sinai
  pedregulho("ob_sinai_penedo", 3, ["#36282a", "#5a423c", "#7e5e4e", "#a27c64", "#c49e82"], 120, { pintas: true, dupla: true, formas: [[15, 12, 18], [13, 10, 17], [15, 13, 18]] });
  arbustoOb("ob_sinai_arbusto", 3, ["#24261a", "#3c3e26", "#565834", "#727244", "#908e5a"], 130, { seco: true });
  obstaculo("ob_sinai_marco", false, 1, (g, v, b) => {
    g.sombra(10, b, 5, 1.2);
    const c = ["#6a5a4a", "#8a7a6a", "#a89a88"];
    rocha(g, 4, b - 3, 10, 4, c, 140);
    rocha(g, 5, b - 7, 8, 4, c, 141);
    rocha(g, 6, b - 10, 6, 3, c, 142);
    rocha(g, 7, b - 13, 4, 3, c, 143);
  });
  acacia("ob_sinai_acacia", ["#2e3018", "#484a24", "#626430", "#7e7e40", "#9c9858"], 400, true);
  // Galileia
  // Figueira: tronco curto e grosso de casca lisa e cinzenta, copa larga e fechada em cachos grandes (folhas
  // largas, verde-escuro) e figos maduros.
  const MOLDE_FIGUEIRA = [
    [[18, 11, 11, 8], [32, 8, 11, 8], [45, 12, 10, 8], [9, 23, 9, 8], [23, 22, 11, 9], [38, 22, 11, 9], [51, 24, 8, 8], [17, 34, 10, 7], [31, 35, 11, 7], [45, 34, 10, 7]],
    [[22, 9, 12, 8], [40, 10, 11, 8], [11, 20, 9, 8], [28, 21, 12, 9], [47, 22, 10, 8], [15, 33, 10, 7], [32, 34, 12, 7], [48, 33, 8, 7]],
    [[26, 8, 11, 8], [41, 13, 10, 8], [13, 15, 9, 8], [20, 26, 11, 9], [36, 25, 12, 9], [52, 27, 7, 7], [10, 34, 8, 6], [27, 36, 11, 7], [43, 36, 10, 6]],
  ];
  arvore("ob_galileia_figueira", 30, 32, (g, v, B, W) => {
    const cx = W / 2, sem = 350 + v * 19;
    g.sombra(cx / 2 + 3, B / 2 - 0.5, 13, 3);
    troncoArte(g, cx, B, cx - 1 + v, B - 20, 9, CASCA_FIGUEIRA, sem, 1, 0.3);
    galhoArte(g, cx - 2, B - 16, cx - 12, B - 24, CASCA_FIGUEIRA);
    galhoArte(g, cx + 2, B - 15, cx + 13, B - 23, CASCA_FIGUEIRA);
    const C = new Copa(W, B);
    moldeCopa(C, MOLDE_FIGUEIRA[v], v, sem, { topo: 0, base: 42, lobos: 5 });
    C.pintar(g, ["#16301a", "#244a24", "#356630", "#4c843e", "#6ea456"], sem, 0.55);
    for (let k = 0; k < 9; k++) {
      const X = 5 + Math.floor(hash2(k, v, sem + 22) * (W - 10)), Y = 6 + Math.floor(hash2(v, k, sem + 23) * 34);
      if (C.get(X, Y) >= 1 && C.get(X + 1, Y + 1) >= 1) { g.fino(X, Y, "#8a5a8a"); g.fino(X + 1, Y, "#6a3a6a"); g.fino(X, Y + 1, "#5a2e5a"); g.fino(X + 1, Y + 1, "#3e1e40"); }
    }
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
  pedregulho("ob_galileia_basalto", 3, ["#1a1a1c", "#2c2c2e", "#424240", "#5e5c58", "#807c74"], 170, { colunas: true, lados: 7 });
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

  // Tipo de obstáculo por casa: o tipo fixo do mapa (bosque, muro da vila, marco; dados/mapas.js) ou o
  // sorteio por peso do bioma. Tipos com desenho próprio fora do bioma ficam em MARCOS.
  // -------------------------------------------------------------------
  // Props das vilas (marcos de dados/mapas.js): barril, caixotes, carroça, jarros, lenha, cocho e cerca. Um
  // desenho por região (ob_<area>_<tipo>) com a madeira, o barro e a pedra de lá; bloqueiam a casa como todo
  // marco e não têm deslocamento sorteado (a cerca emenda com a vizinha: postes a cada 16 px e as travessas de
  // ponta a ponta). Desenho em px de arte, luz de cima e da esquerda, 4–5 tons por material, contorno sépia.
  // -------------------------------------------------------------------
  const PROPS_VILA = ["barril", "caixotes", "carroca", "jarros", "lenha", "cocho", "cerca"];
  const MATERIAL_PROPS = {
    canaan: { madeira: ["#3a2416", "#5a3a22", "#7a5232", "#9a6e44", "#bc8e5e"], barro: ["#5a2e1c", "#84462a", "#a8603a", "#c87e52", "#e0a070"], pedra: ["#4a463c", "#6a6456", "#8c8672", "#aea690", "#cac2aa"] },
    deserto: { madeira: ["#4a2e1c", "#6e4628", "#92623a", "#b4824e", "#d0a06a"], barro: ["#6a3a20", "#92562e", "#b8743e", "#d49656", "#ecb878"], pedra: ["#5a3a26", "#7e5434", "#a47248", "#c4945e", "#deb47c"] },
    egito: { madeira: ["#4e3a20", "#72562e", "#967444", "#b8945c", "#d4b47a"], barro: ["#5e2c18", "#8a4426", "#b05e36", "#cc7c4c", "#e49c68"], pedra: ["#6a5c40", "#8a7a5a", "#ab9b78", "#cdbf9c", "#e4d8b8"] },
    marVermelho: { madeira: ["#3e342c", "#5e5246", "#80705e", "#a08e78", "#c0ae96"], barro: ["#5a2e22", "#82442e", "#a65e40", "#c27c58", "#dc9e78"], pedra: ["#4a2a24", "#6e3e30", "#965a44", "#b87a5c", "#d49c7e"] },
    sinai: { madeira: ["#33241c", "#52392a", "#73503a", "#94704e", "#b48e68"], barro: ["#56301e", "#7a462a", "#9c603a", "#ba7e52", "#d29c6c"], pedra: ["#3a2c28", "#5a463c", "#7a6250", "#9c8068", "#bca084"] },
    galileia: { madeira: ["#36231a", "#56382a", "#784e38", "#9a6a4a", "#ba8a64"], barro: ["#56301e", "#7e4a2c", "#a2643c", "#c08254", "#d8a274"], pedra: ["#222224", "#363636", "#4e4c4a", "#6c6a64", "#8c8880"] },
  };
  const FERRO_PROPS = ["#24201c", "#3e3832", "#5e564c", "#80786a"];
  const AGUA_PROPS = ["#24505e", "#346e7e", "#5a98a4", "#9ccacc"];
  // retângulo em px de arte com a cor de cada px (função ou cor)
  function retPx(g, X, Y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const cor = typeof c === "function" ? c(i, j, w, h) : c; if (cor) g.fino(X + i, Y + j, cor); }
  }
  // elipse cheia em px de arte; c(nx, ny) devolve a cor
  function elipPx(g, cx, cy, rx, ry, c) {
    for (let Y = Math.floor(cy - ry); Y <= Math.ceil(cy + ry); Y++) for (let X = Math.floor(cx - rx); X <= Math.ceil(cx + rx); X++) {
      const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) { const cor = c(nx, ny, X, Y); if (cor) g.fino(X, Y, cor); }
    }
  }
  const DESENHO_PROP = {
    // barril de aduelas com dois aros de ferro e a tampa de cima; a variante 1 tem um barril menor ao lado
    barril(g, v, M, B) {
      const um = (cx, base, rx, alt) => {
        const m = M.madeira, topo = base - alt;
        for (let Y = topo + 2; Y <= base; Y++) {
          const t = (Y - topo) / alt, bojo = Math.sin(t * Math.PI) * 1.6, r = rx - 1.6 + bojo;
          for (let X = Math.round(cx - r); X <= Math.round(cx + r) - 1; X++) {
            const u = (X + 0.5 - (cx - r)) / (2 * r), ad = Math.floor(u * 6);
            let k = u < 0.2 ? 4 : u < 0.45 ? 3 : u < 0.75 ? 2 : u < 0.9 ? 1 : 0;
            if (Math.floor(((X - (cx - r)) / (2 * r)) * 6 * 2) % 2 === 1 && k > 0 && ad % 2) k--;
            let cor = m[k];
            const aro = Math.abs(Y - (topo + alt * 0.3)) < 1 || Math.abs(Y - (topo + alt * 0.75)) < 1;
            if (aro) cor = FERRO_PROPS[Math.min(3, Math.max(0, k - 1))];
            g.fino(X, Y, cor);
          }
        }
        elipPx(g, cx - 0.5, topo + 2.5, rx - 1.2, 2.4, (nx, ny) => (nx * nx + ny * ny > 0.55 ? m[1] : ny < 0 ? m[4] : m[3]));
      };
      g.sombra(11, B / 2, 7, 1.6, "#1c1210", 0.3);
      if (v === 1) um(27, B - 1, 6, 14);
      um(15, B, 9, 22);
    },
    // caixotes de tábuas com o quadro escuro e a trave em X; empilhados
    caixotes(g, v, M, B) {
      const m = M.madeira;
      const cx = (X, Y, w, h, tampa) => {
        retPx(g, X, Y, w, tampa, (i) => (i === 0 ? m[4] : i === w - 1 ? m[2] : m[3]));
        retPx(g, X, Y + tampa, w, h - tampa, (i, j, W, H) => {
          if (i === 0 || j === 0) return m[3];
          if (i === W - 1 || j === H - 1) return m[0];
          if (i === 1 || i === W - 2 || j === 1 || j === H - 2) return m[1];
          const d = Math.abs((i - 2) / (W - 4) - (j - 2) / (H - 4));
          if (d < 0.12) return m[1];
          return j % 4 === 0 ? m[1] : i < W / 2 ? m[3] : m[2];
        });
      };
      g.sombra(11, B / 2, 8, 1.6, "#1c1210", 0.3);
      cx(3, B - 15, 17, 16, 4);
      cx(19, B - 12, 13, 13, 3);
      if (v !== 1) cx(7, B - 26, 13, 12, 3);
    },
    // carroça de duas rodas, de lado: caixa de tábuas com sacos ou feno, roda de raios e os varais no chão
    carroca(g, v, M, B) {
      const m = M.madeira, W = g.w;
      g.sombra(W / 4 + 1, B / 2, 13, 1.8, "#1c1210", 0.3);
      // varais
      linhaPx(g, W - 4, B - 1, W - 16, B - 9, m[1]); linhaPx(g, W - 4, B - 2, W - 16, B - 10, m[3]);
      // carga
      if (v === 0) for (let k = 0; k < 3; k++) elipPx(g, 12 + k * 7, B - 19, 4.2, 4, (nx, ny) => (ny < -0.3 && nx < 0.2 ? "#e0d0a8" : nx > 0.4 || ny > 0.5 ? "#a08a60" : "#c8b488"));
      else for (let X = 7; X < 30; X++) for (let Y = B - 23 + Math.round(Math.sin(X * 0.7) * 1.2); Y < B - 15; Y++) g.fino(X, Y, (X + Y) % 3 === 0 ? "#b89a40" : Y < B - 20 ? "#e8d070" : "#d0b050");
      // caixa
      retPx(g, 5, B - 16, 28, 9, (i, j, w, h) => (j === 0 ? m[4] : j === h - 1 || i === w - 1 ? m[0] : j % 3 === 0 ? m[1] : i < 3 ? m[3] : m[2]));
      // roda
      const rx = 17, ry = B - 7;
      elipPx(g, rx, ry, 7, 7, (nx, ny, X, Y) => {
        const d = Math.hypot(nx, ny);
        if (d > 0.74) return d > 0.9 ? m[0] : nx + ny < 0 ? m[3] : m[1];
        if (d < 0.2) return m[4];
        const a = Math.atan2(ny, nx), raio = Math.abs(((a / Math.PI) * 3 + 6) % 1 - 0.5) < 0.12;
        return raio ? m[2] : null;
      });
    },
    // jarros de barro (talhas): 2 ou 3 de tamanhos diferentes, com a boca escura e a luz à esquerda
    jarros(g, v, M, B) {
      const b = M.barro;
      const jarro = (cx, base, rx, alt) => {
        const cy = base - alt * 0.42;
        elipPx(g, cx, cy, rx, alt * 0.42, (nx, ny) => { const l = -(0.65 * nx + 0.6 * ny); return l > 0.5 ? b[4] : l > 0.1 ? b[3] : l > -0.35 ? b[2] : l > -0.7 ? b[1] : b[0]; });
        const topo = base - alt;
        retPx(g, Math.round(cx - rx * 0.45), topo + 2, Math.round(rx * 0.9), Math.round(alt * 0.22), (i, j, w) => (i === 0 ? b[3] : i === w - 1 ? b[0] : b[2]));
        retPx(g, Math.round(cx - rx * 0.6), topo, Math.round(rx * 1.2), 2, (i, j, w) => (j === 0 ? (i === 0 ? b[3] : b[4]) : i < w - 2 && i > 1 ? "#1c1210" : b[1]));
      };
      g.sombra(11, B / 2, 8, 1.6, "#1c1210", 0.3);
      jarro(22, B - 2, 6, 16);
      jarro(12, B, 7.5, 22);
      if (v === 1) jarro(27, B, 4.5, 12);
    },
    // lenha empilhada: toras vistas de ponta (anéis claros, casca escura) em fileiras de 3, 2 e 1
    lenha(g, v, M, B) {
      const m = M.madeira;
      g.sombra(11, B / 2, 8, 1.5, "#1c1210", 0.3);
      // as toras de lado, atrás
      retPx(g, 4, B - 13, 26, 12, (i, j, w, h) => (j === 0 ? m[3] : j === h - 1 ? m[0] : j % 4 === 0 ? m[0] : (i * 7 + j) % 11 === 0 ? m[1] : m[2]));
      const fil = [[3, B - 4], [2, B - 11], [1, B - 18]];
      fil.forEach(([n, y], f) => {
        for (let k = 0; k < n; k++) {
          const x = 10 + k * 8 - (n - 3) * 4 + (v && f === 1 ? 1 : 0);
          elipPx(g, x, y, 4, 3.6, (nx, ny) => {
            const d = Math.hypot(nx, ny);
            if (d > 0.78) return nx + ny < -0.3 ? m[2] : m[0];
            return d < 0.25 ? "#a07a4a" : Math.abs(d - 0.5) < 0.1 ? "#c8a070" : "#e0c08a";
          });
        }
      });
    },
    // cocho: pedra (ou madeira no deserto) com a água dentro, a face da frente mais escura
    cocho(g, v, M, B) {
      const p = M.pedra, a = AGUA_PROPS;
      g.sombra(11, B / 2, 9, 1.5, "#1c1210", 0.3);
      retPx(g, 3, B - 14, 30, 6, (i, j, w, h) => {
        if (j === 0 || i === 0) return p[4];
        if (i === w - 1) return p[1];
        if (j === h - 1 || i === 1 || i === w - 2) return p[3];
        return j === 1 ? a[0] : (i + j * 3) % 9 === 0 ? a[3] : j === 2 ? a[1] : a[2];
      });
      retPx(g, 3, B - 8, 30, 8, (i, j, w, h) => (j === 0 ? p[2] : i === w - 1 || j === h - 1 ? p[0] : (i % 7 === 0 && j > 1) ? p[0] : i < 3 ? p[2] : p[1]));
    },
    // cerca de madeira: postes a cada 16 px (com a cabeça clara) e duas travessas de ponta a ponta da casa; nos
    // quadros de fecho (v ≥ 2: a última peça da fileira, sem cerca à direita) as travessas terminam num poste
    cerca(g, v, M, B) {
      const m = M.madeira, W = g.w, x0 = (W - 32) / 2;
      for (const y of [B - 15, B - 8]) retPx(g, x0, y, 32, 3, (i, j) => (j === 0 ? m[3] : j === 2 ? m[0] : (i + y) % 9 === 0 ? m[1] : m[2]));
      const postes = v >= 2 ? [x0 + 1, x0 + 17, x0 + 28] : [x0 + 1, x0 + 17];
      for (const px of postes) retPx(g, px, B - 20, 4, 20, (i, j, w, h) => (j === 0 ? m[4] : i === 0 ? m[3] : i === w - 1 ? m[0] : j === h - 1 ? m[0] : m[2]));
    },
  };
  for (const area of Object.keys(MATERIAL_PROPS)) for (const tipo of PROPS_VILA) {
    const chave = `ob_${area}_${tipo}`;
    if (PIXEL_PATTERNS[chave]) continue; // os jarros do Egito já são obstáculo do bioma
    const largo = tipo === "carroca", cerca = tipo === "cerca";
    // a cerca tem 2 quadros a mais com o poste de fecho na ponta direita (fecho: 2 = primeiro quadro de fecho)
    registrar(chave, {
      w: largo ? 22 : 18, h: tipo === "caixotes" || tipo === "barril" || tipo === "jarros" ? 20 : 18, quadros: cerca ? 4 : 2, fecho: cerca ? 2 : 0, obstaculo: true, prop: true, origem: [0.5, 1],
      desenhar(g, v) { DESENHO_PROP[tipo](g, v, MATERIAL_PROPS[area], g.h - 5); },
    });
  }
  const MARCOS = {
    fogueira: { chave: "fx_fogueira", alto: false, animado: 3 },
    estandarte: { chave: "ob_sinai_estandarte", alto: true },
    tenda: { chave: "ob_deserto_tenda", alto: true },
  };
  function tipoObstaculo(area, x, y) {
    const bio = BIOMAS[area];
    if (!bio) return null;
    const fixo = typeof tiposObstaculo !== "undefined" ? tiposObstaculo[area]?.[x + "," + y] : null;
    if (fixo) {
      const doBioma = bio.obstaculos.find((o) => o.tipo === fixo);
      if (doBioma) return { chave: `ob_${area}_${fixo}`, alto: !!doBioma.alto };
      if (MARCOS[fixo]) return MARCOS[fixo];
      const prop = PIXEL_PATTERNS[`ob_${area}_${fixo}`];
      // fecho: prop que emenda com o vizinho (a cerca) e é o último da fileira, sem o mesmo prop à direita
      if (prop?.prop) return { chave: `ob_${area}_${fixo}`, alto: false, prop: true, fecho: !!prop.fecho && tiposObstaculo[area][x + 1 + "," + y] !== fixo };
    }
    const lista = bio.obstaculos.filter((o) => !o.soMarco);
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

  // Pincel do tileset: buffer em px de arte (RES por unidade); set/encher trabalham em unidades
  // (cada uma vira um bloco RES × RES) e fino(i, X, Y) põe 1 px de arte (X, Y de 0 a T·RES − 1).
  class Pincel {
    constructor(w, h) {
      this.r = RES;
      this.w = w * RES; this.h = h * RES;
      this.buf = new Uint8ClampedArray(this.w * this.h * 4);
    }
    fino(i, X, Y, cor, alfa = 1) {
      const L = T * this.r;
      if (X < 0 || Y < 0 || X >= L || Y >= L || !cor) return;
      const tx = (i % TS_COLS) * L + X, ty = Math.floor(i / TS_COLS) * L + Y;
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
    // tile i, posição local (x, y) em unidades
    set(i, x, y, cor, alfa = 1) {
      if (x < 0 || y < 0 || x >= T || y >= T || !cor) return;
      const r = this.r;
      for (let j = 0; j < r; j++) for (let k = 0; k < r; k++) this.fino(i, x * r + k, y * r + j, cor, alfa);
    }
    // cor já pintada (hex) em px de arte, para detalhes que dependem do fundo
    ler(i, X, Y) {
      const L = T * this.r;
      const tx = (i % TS_COLS) * L + X, ty = Math.floor(i / TS_COLS) * L + Y, o = (ty * this.w + tx) * 4;
      return this.buf[o + 3] ? rgbHex(this.buf[o], this.buf[o + 1], this.buf[o + 2]) : null;
    }
    limpar(i) {
      const L = T * this.r;
      for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
        const tx = (i % TS_COLS) * L + x, ty = Math.floor(i / TS_COLS) * L + y, o = (ty * this.w + tx) * 4;
        this.buf[o] = this.buf[o + 1] = this.buf[o + 2] = this.buf[o + 3] = 0;
      }
    }
    encher(i, cor) { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) this.set(i, x, y, cor); }
    grade(i, g, ox = 0, oy = 0) {
      const d = g.final(), f = this.r / g.r;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const c = d[y * g.w + x];
        if (!c) continue;
        for (let j = 0; j < f; j++) for (let k = 0; k < f; k++) this.fino(i, (x + ox * g.r) * f + k, (y + oy * g.r) * f + j, c);
      }
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

  // Detalhe em 32 px por casa (px de arte de verdade, por cima do chão pintado em unidades):
  // na relva, folhinhas de 1 × 2 px com a ponta clara; na areia e terra, grãos e pedrinhas com
  // luz em cima/esquerda; nos caminhos, seixos de 2–3 px e marcas de roda.
  function detalharChao(pin, area, bio, semente) {
    const c = bio.chao, [r, g] = hexRgb(c.base);
    const relva = g > r + 8;
    const L = T * pin.r;
    const folha = (i, X, Y, k) => {
      const cor = k % 3 ? c.claro : c.salpico;
      pin.fino(i, X, Y, cor); pin.fino(i, X, Y + 1, c.escuro);
      if (k % 4 === 0) { pin.fino(i, X + 1, Y + 1, cor); pin.fino(i, X + 1, Y + 2, c.escuro); }
    };
    const grao = (i, X, Y, k) => { pin.fino(i, X, Y, k % 2 ? c.claro : c.salpico); if (k % 3 === 0) pin.fino(i, X + 1, Y + 1, c.escuro); };
    const chao = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let m = 0; m < 16; m++) chao.push(ID.MANCHA4 + m);
    if (area !== "mar")
      for (const i of chao) {
        const n = relva ? 22 : 14;
        for (let k = 0; k < n; k++) {
          const X = Math.floor(hash2(i, k, semente + 701) * (L - 2)), Y = Math.floor(hash2(k, i, semente + 702) * (L - 3));
          (relva ? folha : grao)(i, X, Y, k);
        }
      }
    const cm = bio.caminho;
    for (let m = 0; m < 16; m++) {
      const i = ID.CAMINHO + m;
      for (let k = 0; k < 7; k++) {
        const X = 3 + Math.floor(hash2(i, k, semente + 711) * (L - 7)), Y = 3 + Math.floor(hash2(k, i, semente + 712) * (L - 7));
        const w = 2 + (k % 2);
        for (let a = 0; a < w; a++) { pin.fino(i, X + a, Y, a === 0 ? cm.claro : misturar(cm.claro, cm.base, 0.5)); pin.fino(i, X + a, Y + 1, a === w - 1 ? cm.escuro : cm.base); }
        pin.fino(i, X + w, Y + 1, cm.escuro); pin.fino(i, X + 1, Y + 2, misturar(cm.escuro, cm.base, 0.5));
      }
      for (let k = 0; k < 10; k++) pin.fino(i, Math.floor(hash2(i, k, semente + 713) * L), Math.floor(hash2(k, i, semente + 714) * L), k % 2 ? cm.claro : cm.escuro);
    }
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
  // Água em px de arte (1 px de arte = 1 px de mundo, como o resto do cenário): a base, 5 ondulações por tile
  // (vale escuro de 4 a 7 px e a crista clara 1 px acima, mais curta) que derivam 1 px a cada 2 fases (≈ 500 ms)
  // e, de vez em quando, um brilho de 2 px.
  function pintarAgua(pin, i, agua, fase, t, clara = false) {
    const base = clara ? misturar(agua.base, agua.clara, 0.45) : agua.base, L = T * pin.r;
    pin.encher(i, base);
    for (let k = 0; k < 5; k++) {
      const x0 = Math.floor(hash2(i, k, 31) * L), y0 = 3 + Math.floor(hash2(k, i, 32) * (L - 5));
      const desl = Math.floor((t + hash2(i, k, 33) * 8) / 2) % L;
      const len = 4 + Math.floor(hash2(k, i, 36) * 4);
      for (let d = 0; d < len; d++) pin.fino(i, (x0 + desl + d) % L, y0, agua.escura);
      for (let d = 1; d < len - 1; d++) pin.fino(i, (x0 + desl + d) % L, y0 - 1, agua.clara);
    }
    if ((t + fase + i) % 7 < 2) {
      const X = Math.floor(hash2(i, fase, 34) * (L - 1)), Y = Math.floor(hash2(fase, i, 35) * L);
      pin.fino(i, X, Y, agua.brilho); pin.fino(i, X + 1, Y, agua.brilho);
    }
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
    detalharChao(pin, area, bio, semente);
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
    const piso = typeof pisos !== "undefined" ? pisos[area] : null;
    const PISOm = typeof PISO !== "undefined" ? PISO : { CAMINHO: 1, AGUA: 2 };
    const COLSm = typeof COLS !== "undefined" ? COLS : 80, ROWSm = typeof ROWS !== "undefined" ? ROWS : 60;
    const ehBorda = (x, y) => x <= 0 || y <= 0 || x >= COLSm - 1 || y >= ROWSm - 1;
    // caminho (estradas e a rota do mar) e água interna (lagos, rios) vêm do piso do mapa (logica.js)
    const ehCaminho = (x, y) => !!piso && !!mapa && piso[y]?.[x] === PISOm.CAMINHO && !mapa[y][x];
    const ehAguaInterna = (x, y) => !!piso && piso[y]?.[x] === PISOm.AGUA;
    // enseada do cais (Canaã e Deserto): água na borda norte em volta do cais
    const cais = typeof areas !== "undefined" ? areas[area]?.cais : null;
    const temEnseada = !!cais;
    const enseada = (x, y) => temEnseada && y <= 0 && Math.abs(x - cais.x) <= 3;
    const ehAguaBorda = (x, y) => {
      if (enseada(x, y)) return true;
      if (y <= 0 && bio.borda.norte === "agua") return true;
      return false;
    };
    const ehAgua = (x, y) => ehAguaBorda(x, y) || ehAguaInterna(x, y);
    const ehMuralha = (x, y) => temMuralha && (y <= 0 || y >= ROWSm - 1);

    // mancha: ruído de baixa frequência; caminho e borda nunca são mancha
    const ehMancha = (x, y) => {
      if (area === "mar" || x <= 0 || y <= 0 || x >= COLSm - 1 || y >= ROWSm - 1 || ehCaminho(x, y) || ehAguaInterna(x, y)) return false;
      const r = area === "egito" ? ruido(x / 10, y / 2, semente) : ruido(x / 6, y / 6, semente);
      return r > 0.62;
    };
    // Com o chão contínuo (cenario.js), a beira da água (areia, espuma e raso) é pintada por ele, seguindo uma
    // linha orgânica: a água do Tilemap fica lisa, sem a espuma em degrau nas beiras das casas.
    const beiraContinua = () => area !== "mar" && typeof global.Cenario !== "undefined";
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
          if (beiraContinua()) return ID.AGUA + Math.floor(hash2(x, y, 2) * 4);
          // costa: espuma nos lados com terra
          let m = 0;
          if (!ehAgua(x, y + 1)) m |= 4;
          if (x > 0 && !ehAgua(x - 1, y)) m |= 8;
          if (x < COLSm - 1 && !ehAgua(x + 1, y)) m |= 2;
          return ID.COSTA + m;
        }
        const viz = (xx, yy) => (xx < 0 || yy < 0 || xx >= COLSm || yy >= ROWSm || (ehBorda(xx, yy) && !ehAguaBorda(xx, yy)) ? 1 : 0);
        const m = viz(x, y - 1) | (viz(x + 1, y) << 1) | (viz(x, y + 1) << 2) | (viz(x - 1, y) << 3);
        return ID.BORDA + m;
      }
      if (area === "mar") return ehCaminho(x, y) ? ID.ROTA + Math.floor(hash2(x, y, 2) * 4) : ID.AGUA + Math.floor(hash2(x, y, 2) * 4);
      if (ehAguaInterna(x, y)) {
        // lago ou rio: espuma nos lados com terra (como a costa da borda)
        const terra = (xx, yy) => (xx >= 0 && yy >= 0 && xx < COLSm && yy < ROWSm && !ehAgua(xx, yy) ? 1 : 0);
        const m = terra(x, y - 1) | (terra(x + 1, y) << 1) | (terra(x, y + 1) << 2) | (terra(x - 1, y) << 3);
        return m && !beiraContinua() ? ID.COSTA + m : ID.AGUA + Math.floor(hash2(x, y, 2) * 4);
      }
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
    const vilas = (typeof DADOS_MAPAS !== "undefined" && DADOS_MAPAS[area]?.vilas) || [];
    const variantesFlor = listaDeco(bio).map((d, k) => (TIPOS_FLOR.has(d.tipo) ? k : -1)).filter((k) => k >= 0);
    function indiceDeco(x, y, proibido) {
      if (!mapa || x < 1 || y < 1 || x >= COLSm - 1 || y >= ROWSm - 1 || mapa[y][x]) return -1;
      if (area === "mar") return hash2(x, y, 7) < 0.015 ? ID.DECO : -1;
      // com o chão contínuo, a vegetação rasteira sai em moitas no próprio chão (cenario.js, DADOS_MAPAS.vegetacao)
      if (beiraContinua() && DADOS_MAPAS[area]?.vegetacao) return -1;
      if (ehCaminho(x, y) || (proibido && proibido(x, y))) return -1;
      if (piso && piso[y][x] >= (PISOm.ESTRUTURA ?? 3)) return -1; // chão de prédio (cenario.js pinta o piso)
      // Galileia: a mancha é um campo de flores; cada casa sorteia a sua flor
      // (variante com posição própria), sem padrão de papel de parede.
      if (area === "galileia" && variantesFlor.length && ehMancha(x, y)) {
        if (hash2(x, y, 7) >= 0.3) return -1;
        return ID.DECO + variantesFlor[Math.floor(hash2(x, y, 13) * variantesFlor.length)];
      }
      let p = 0.07;
      for (const v of vilas) if (x > v.x && y > v.y && x < v.x + v.largura - 1 && y < v.y + v.altura - 1) p = 0.15;
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

    // Canvas final (32 px por casa = 1 px de arte por px de mundo), pintado a partir do buffer.
    const final = novoCanvas(pin.w, pin.h);
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
      const L = T * RES;
      for (const i of indices) {
        const sx = (i % TS_COLS) * L, sy = Math.floor(i / TS_COLS) * L;
        ctx.clearRect(sx, sy, L, L);
        ctx.drawImage(mini, sx, sy, L, L, sx, sy, L, L);
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
      estrutura: p("#7a5530"),
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
      const limite = def.limiteCores ? def.limiteCores + 1 : def.res === 1 ? (chave.startsWith("ui_") ? 6 : 12) : chave.startsWith("fx_") ? 999 : LIMITE_CORES + 1;
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
    const e = escalaArte(px, escala);
    const c = novoCanvas(px.w * e, px.h * e);
    pintarPixels(c.getContext("2d"), { w: px.w, h: px.h, data: px.data.map((v) => (v ? cor : null)) }, 0, 0, e);
    const url = paraURL(c);
    cacheURL.set(id, url);
    return url;
  }
  function retratoURL(chave, { escala = 3, recorte = "busto" } = {}) {
    const id = "r:" + chave + ":" + escala + ":" + recorte;
    if (cacheURL.has(id)) return cacheURL.get(id);
    const def = PIXEL_PATTERNS[chave];
    if (!def) return "";
    const quadroInteiro = recorte === "inteiro" && def.direcoes ? 5 : null; // de frente, parado
    const px = pixels(chave, { quadro: quadroInteiro ?? def.retratoQuadro ?? (def.humano ? 4 : 0) });
    const r = px.res || 1;
    // busto: retângulo em unidades (def.busto = [x, y, w, h]); sem ele, o quadro inteiro
    let [bx, by, bw, bh] = recorte === "busto" && def.busto ? def.busto : [0, 0, def.w, def.h];
    bx *= r; by *= r; bw *= r; bh *= r;
    const e = escalaArte(px, escala);
    const dados = [];
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) dados.push(px.data[(by + y) * px.w + bx + x] || null);
    const c = novoCanvas(bw * e, bh * e);
    pintarPixels(c.getContext("2d"), { w: bw, h: bh, data: dados }, 0, 0, e);
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
    const g = new Grade(12, 12, 1);
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
    const qw = c.width / def.quadros;
    for (let i = 0; i < def.quadros; i++) tex.add(i, 0, i * qw, 0, qw, c.height);
    return chave;
  }
  function registrarTexturas(scene) {
    for (const chave of Object.keys(PIXEL_PATTERNS)) {
      // sob demanda: portais, variantes do jogador, humanos, criaturas e montarias (criarEntidade gera
      // só os que aparecem na área) e os obstáculos (criarObstaculos e criarOrla geram os da área atual)
      if (/^(mk_portal_|pj_|in_|al_|mt_|ob_)/.test(chave)) continue;
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
    versao: 2, PX, RES,
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
