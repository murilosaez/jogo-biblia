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
  // Humanos (§6.2) em 32 px por casa: célula 40 × 48 px de arte (20 × 24 unidades), pés na linha 45.
  // 3 vistas × 5 quadros (0 parado, 1 respirar, 2 passo A, 3 passo B, 4 ação/fala):
  //   quadros 0–4 de lado (virado para a direita; a esquerda é o espelho), 5–9 de frente, 10–14 de costas.
  // Moldes: "manto" (veste longa), "curta" (túnica curta, pernas à mostra) e "veu" (veste longa com véu).
  // Cores (letras de sempre): H cabelo, S/s pele e sombra, B barba, R/r/d veste (clara, média, escura),
  // A cinto, F sandálias, V/W véu. Acessórios desenham em cada vista (ACESSORIOS, abaixo).
  // Luz de cima e da esquerda; contorno sépia (amigos) ou carmim (hostis) de 1 px.
  // -------------------------------------------------------------------
  const VISTAS = ["lado", "frente", "costas"];
  const QUADROS_POR_VISTA = 5;
  const escuro = (c, t = 0.28) => misturar(c, "#1c1210", t);
  const claro = (c, t = 0.2) => misturar(c, "#fff6e0", t);
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
  // Membro grosso (manga, perna): segmento de largura w com luz no lado esquerdo.
  function membro(g, X0, Y0, X1, Y1, w, cores) {
    const [cl, md, es] = cores;
    const n = Math.max(Math.abs(X1 - X0), Math.abs(Y1 - Y0)) || 1;
    for (let t = 0; t <= n; t++) {
      const x = Math.round(X0 + ((X1 - X0) * t) / n), y = Math.round(Y0 + ((Y1 - Y0) * t) / n);
      for (let k = 0; k < w; k++) g.fino(x + k - Math.floor(w / 2), y, k === 0 ? cl : k === w - 1 ? es : md);
    }
  }

  // Pose de cada vista/quadro: deslocamento do tronco (respirar), mãos (arma e escudo), pés.
  function pose(vista, q) {
    const dy = q === 1 ? 1 : 0;
    if (vista === "lado") {
      const maoArma = q === 4 ? [28, 24] : q === 2 ? [18, 30] : q === 3 ? [24, 30] : [21, 31 + dy];
      const maoLonge = q === 2 ? [25, 29] : q === 3 ? [17, 29] : null;
      return { vista, q, dy, maoArma, maoEscudo: [26, 27 + dy], maoLonge, braco: [21, 22 + dy] };
    }
    if (vista === "frente") {
      const balanco = q === 2 ? 1 : q === 3 ? -1 : 0;
      const maoArma = q === 4 ? [8, 16] : [11, 31 + dy + balanco];
      return { vista, q, dy, maoArma, maoEscudo: [28, 31 + dy - balanco], braco: [11, 22 + dy] };
    }
    const balanco = q === 2 ? -1 : q === 3 ? 1 : 0;
    const maoArma = q === 4 ? [31, 16] : [28, 31 + dy + balanco];
    return { vista, q, dy, maoArma, maoEscudo: [11, 31 + dy - balanco], braco: [28, 22 + dy] };
  }

  function coresHumano(cfg) {
    const c = Object.assign({ o: "#2a1a14", F: "#5a3a24", A: "#7a4a30" }, cfg.cores);
    c.H = c.H || "#4a2f20";
    c.B = c.B || c.H;
    c.R = c.R || "#d4bf8f"; c.r = c.r || escuro(c.R, 0.15); c.d = c.d || escuro(c.R, 0.32);
    c.S = c.S || "#cf9466"; c.s = c.s || escuro(c.S, 0.18);
    return c;
  }

  // ----- cabeça -----
  function cabeca(g, cfg, c, P) {
    const v = P.vista, dy = P.dy;
    const veu = cfg.molde === "veu" || cfg.capuz;
    const V = cfg.capuz ? cfg.capuz[0] : c.V, W = cfg.capuz ? cfg.capuz[1] : c.W || escuro(c.V || "#888888");
    const Hc = [escuro(c.H, 0.3), c.H, claro(c.H, 0.18)];
    const cabeloLongo = cfg.cabelo === "longo";
    const careca = cfg.cabelo === "careca";
    const tomCabelo = (nx, ny, X, Y) => {
      const l = -(0.55 * nx + 0.8 * ny) + (hash2(X, Y, 77) - 0.5) * 0.5;
      return l > 0.55 ? Hc[2] : l < -0.35 ? Hc[0] : Hc[1];
    };
    const pele = (nx, ny) => (nx > 0.55 || ny > 0.72 ? c.s : nx < -0.55 && ny < 0.3 && ny > -0.4 ? claro(c.S, 0.1) : c.S);
    if (v === "frente") {
      const cy = 13 + dy;
      if (cabeloLongo && !veu) { retF(g, 13, 12 + dy, 3, 11, (X, Y) => (Y % 3 ? Hc[1] : Hc[0])); retF(g, 24, 12 + dy, 3, 11, (X, Y) => (Y % 3 ? Hc[0] : escuro(c.H, 0.4))); }
      if (veu) elipF(g, 20, 13 + dy, 7.6, 8, (nx, ny) => (nx > 0.45 ? W : nx < -0.5 && ny < 0 ? claro(V, 0.12) : V));
      elipF(g, 20, cy, 6, 6.5, (nx, ny, X, Y) => {
        if (veu) return pele(nx, ny);
        const cabelo = !careca && (ny < -0.3 + 0.12 * nx * nx || (Math.abs(nx) > 0.82 && ny < 0.25));
        return cabelo ? tomCabelo(nx, ny, X, Y) : pele(nx, ny);
      });
      if (veu) {
        // véu cai sobre os ombros; franja do cabelo na testa
        retF(g, 12, 17 + dy, 4, 7, (X) => (X < 14 ? claro(V, 0.1) : V)); retF(g, 24, 17 + dy, 4, 7, W);
        retF(g, 16, 19 + dy, 2, 2, V); retF(g, 22, 19 + dy, 2, 2, W);
        elipF(g, 20, 9 + dy, 6.5, 2.4, (nx) => (nx > 0.5 ? W : V));
        retF(g, 17, 9 + dy, 6, 1, Hc[1]);
      } else if (!careca) {
        // orelhas
        g.fino(13, 13 + dy, c.s); g.fino(13, 14 + dy, c.s); g.fino(26, 13 + dy, c.s); g.fino(26, 14 + dy, escuro(c.s, 0.15));
      }
      // sobrancelhas, olhos (com brilho), nariz e boca
      const sob = cfg.barba === false && veu ? escuro(c.S, 0.35) : Hc[0];
      retF(g, 16, 11 + dy, 2, 1, sob); retF(g, 22, 11 + dy, 2, 1, sob);
      retF(g, 17, 12 + dy, 1, 2, c.o); retF(g, 22, 12 + dy, 1, 2, c.o);
      g.fino(16, 13 + dy, "#f6efdc"); g.fino(23, 13 + dy, "#f6efdc");
      g.fino(20, 15 + dy, c.s); g.fino(19, 15 + dy, claro(c.S, 0.08));
      if (cfg.barba !== false) {
        elipF(g, 20, 17.5 + dy, 5.2, 3.6, (nx, ny, X, Y) => (Y < 15 + dy ? null : nx > 0.5 ? escuro(c.B, 0.25) : (X + Y) % 3 === 0 ? claro(c.B, 0.12) : c.B));
        retF(g, 14, 14 + dy, 1, 3, c.B); retF(g, 25, 14 + dy, 1, 3, escuro(c.B, 0.25));
        retF(g, 19, 16 + dy, 2, 1, escuro(c.B, 0.45));
      } else {
        retF(g, 19, 17 + dy, 2, 1, misturar(c.s, "#5a2a20", 0.45));
      }
    } else if (v === "costas") {
      if (veu) {
        elipF(g, 20, 13 + dy, 7.6, 8, (nx, ny) => (nx > 0.45 ? W : nx < -0.5 && ny < 0 ? claro(V, 0.12) : V));
        retF(g, 12, 18 + dy, 16, 6, (X, Y) => (X > 24 ? W : X < 15 ? claro(V, 0.1) : (Y - X) % 5 === 0 ? escuro(V, 0.1) : V));
      } else {
        if (cabeloLongo) retF(g, 15, 15 + dy, 10, 8, (X, Y) => (X % 3 === 0 ? Hc[0] : Hc[1]));
        elipF(g, 20, 13 + dy, 6, 6.5, (nx, ny, X, Y) => (careca ? pele(nx, ny) : tomCabelo(nx, ny, X, Y)));
        if (!careca) { g.fino(13, 13 + dy, c.s); g.fino(13, 14 + dy, c.s); g.fino(26, 13 + dy, escuro(c.s, 0.15)); g.fino(26, 14 + dy, escuro(c.s, 0.15)); }
        if (cfg.barba !== false) { g.fino(14, 17 + dy, c.B); g.fino(25, 17 + dy, escuro(c.B, 0.2)); }
      }
    } else {
      // de lado, virado para a direita
      if (veu) {
        elipF(g, 19.5, 13 + dy, 7, 8, (nx, ny) => (ny > 0.3 && nx > 0.2 ? W : nx < -0.5 && ny < 0 ? claro(V, 0.12) : V));
        retF(g, 13, 18 + dy, 9, 6, (X) => (X < 15 ? claro(V, 0.1) : X > 19 ? W : V));
      }
      if (cabeloLongo && !veu) retF(g, 14, 14 + dy, 4, 9, (X, Y) => (Y % 3 ? Hc[1] : Hc[0]));
      elipF(g, 20.5, 13 + dy, 5.5, 6.5, (nx, ny, X, Y) => {
        const rosto = veu ? nx > -0.35 && ny > -0.45 : nx > -0.12 && ny > -0.32;
        if (veu && !rosto) return null;
        if (!rosto && !careca) return tomCabelo(nx, ny, X, Y);
        return nx > 0.7 || ny > 0.72 ? c.s : c.S;
      });
      if (veu) elipF(g, 19, 9.5 + dy, 6, 3, (nx) => (nx > 0.6 ? W : V));
      // nariz, olho, sobrancelha, orelha e boca
      g.fino(26, 14 + dy, c.S); g.fino(26, 15 + dy, c.s);
      retF(g, 23, 12 + dy, 1, 2, c.o); g.fino(24, 12 + dy, "#f6efdc");
      retF(g, 23, 11 + dy, 2, 1, veu ? escuro(c.S, 0.35) : Hc[0]);
      if (!veu && !careca) { g.fino(19, 13 + dy, c.s); g.fino(19, 14 + dy, escuro(c.s, 0.2)); g.fino(20, 14 + dy, c.s); }
      if (cfg.barba !== false) {
        elipF(g, 22.5, 17 + dy, 4, 3.4, (nx, ny, X, Y) => (Y < 15 + dy || X < 19 ? null : ny > 0.4 ? escuro(c.B, 0.22) : (X + Y) % 3 === 0 ? claro(c.B, 0.12) : c.B));
        retF(g, 19, 14 + dy, 2, 3, c.B);
        g.fino(25, 16 + dy, escuro(c.B, 0.45));
      } else g.fino(25, 17 + dy, misturar(c.s, "#5a2a20", 0.45));
    }
  }

  // ----- tronco, braços e pernas -----
  function corpo(g, cfg, c, P) {
    const v = P.vista, dy = P.dy, q = P.q;
    const largo = cfg.porte === "grande" ? 1 : 0;
    const veste = (X, x0, x1) => (X <= x0 + 2 ? c.R : X >= x1 - 2 ? c.d : c.r);
    const longo = cfg.molde !== "curta";
    const pele = [claro(c.S, 0.06), c.S, c.s];
    const sandalia = [claro(c.F, 0.15), c.F, escuro(c.F, 0.3)];
    if (v === "lado") {
      const passo = q === 2 ? 1 : q === 3 ? -1 : 0;
      // braço de longe (atrás do corpo) aparece no balanço
      if (P.maoLonge) { membro(g, 21, 22 + dy, P.maoLonge[0], P.maoLonge[1] - 2, 3, [c.d, escuro(c.d, 0.15), escuro(c.d, 0.25)]); retF(g, P.maoLonge[0] - 1, P.maoLonge[1] - 1, 3, 3, c.s); }
      if (cfg.montado) inferiorMontado(g, cfg, c, P);
      else {
      // pernas e pés
      const pes = passo === 1 ? [[24, 13], [26, 15]] : passo === -1 ? [[19, 18], [21, 20]] : [[21, 17], [22, 18]];
      const [[fx, bx]] = [pes[0]];
      if (!longo) {
        membro(g, 19, 37, bx + 1, 43, 3, [c.s, c.s, escuro(c.s, 0.2)]);
        membro(g, 21, 37, fx, 43, 3, pele);
      }
      retF(g, bx - 1, 43, 5, 3, (X, Y) => (Y === 43 ? escuro(c.F, 0.15) : escuro(c.F, 0.3)));
      retF(g, fx - 1, 43, 6, 3, (X, Y) => (Y === 43 ? (X < fx + 2 ? c.S : sandalia[0]) : X === fx + 4 && Y === 43 ? null : sandalia[1]));
      // veste inferior
      if (longo) {
        for (let Y = 32; Y <= 42; Y++) {
          const k = Math.floor((Y - 32) / 4), aberto = Math.max(0, passo) * Math.floor((Y - 34) / 3);
          const x0 = 15 - k - (passo === 1 ? Math.max(0, Math.floor((Y - 35) / 3)) : 0), x1 = 25 + k + aberto;
          for (let X = x0; X <= x1; X++) g.fino(X, Y, Y === 42 ? c.d : (X - x0) % 5 === 3 && Y > 34 ? escuro(c.r, 0.12) : veste(X, x0, x1));
        }
      } else {
        for (let Y = 32; Y <= 36; Y++) for (let X = 14 - (Y > 34 ? 1 : 0); X <= 26 + (Y > 33 ? 1 : 0); X++) g.fino(X, Y, Y === 36 ? c.d : veste(X, 14, 26));
      }
      }
      // tronco
      for (let Y = 20 + dy; Y <= 31; Y++) {
        const x0 = Y === 20 + dy ? 16 : 15 - largo, x1 = Y === 20 + dy ? 24 : 25 + largo;
        for (let X = x0; X <= x1; X++) g.fino(X, Y, veste(X, x0, x1));
      }
      retF(g, 19, 18 + dy, 4, 2, c.s);
      retF(g, 15 - largo, 30, 11 + 2 * largo, 2, (X, Y) => (Y === 30 ? claro(c.A, 0.12) : c.A));
      return;
    }
    // frente e costas
    const frente = v === "frente";
    const passo = q === 2 ? 1 : q === 3 ? -1 : 0;
    const pE = frente ? passo : -passo; // pé da esquerda (da tela) sobe no passo
    if (cfg.montado) inferiorMontado(g, cfg, c, P);
    else {
    // pés
    const pe = (x, sobe, cores) => retF(g, x, 43 - sobe, 5, 3 - (sobe ? 1 : 0), (X, Y) => (Y === 43 - sobe && frente ? (X === x || X === x + 4 ? cores[1] : c.S) : cores[X === x ? 0 : X === x + 4 ? 2 : 1]));
    pe(14, pE === 1 ? 1 : 0, sandalia);
    pe(21, pE === -1 ? 1 : 0, sandalia);
    if (longo) {
      for (let Y = 32; Y <= 42; Y++) {
        const k = Math.floor((Y - 32) / 4) + largo, bal = Y > 37 ? passo : 0;
        const x0 = 13 - k + bal, x1 = 26 + k + bal;
        for (let X = x0; X <= x1; X++) {
          let cor = veste(X, x0, x1);
          if (Y > 33 && (X === 17 + bal || X === 22 + bal)) cor = escuro(cor, 0.14);
          if (Y === 42) cor = c.d;
          g.fino(X, Y, cor);
        }
      }
    } else {
      retF(g, 15, 37, 4, 6 - (pE === 1 ? 1 : 0), (X) => (X === 15 ? pele[0] : X === 18 ? pele[2] : pele[1]));
      retF(g, 21, 37, 4, 6 - (pE === -1 ? 1 : 0), (X) => (X === 21 ? pele[1] : pele[2]));
      g.fino(16, 40, c.F); g.fino(17, 40, c.F); g.fino(22, 40, c.F); g.fino(23, 40, c.F);
      for (let Y = 32; Y <= 36; Y++) {
        const k = Y > 34 ? 1 : 0, x0 = 13 - k - largo, x1 = 26 + k + largo;
        for (let X = x0; X <= x1; X++) g.fino(X, Y, Y === 36 ? c.d : (X === 19 || X === 20) && Y > 33 ? escuro(c.r, 0.15) : veste(X, x0, x1));
      }
    }
    }
    // tronco (ombros caídos) e cinto
    for (let Y = 20 + dy; Y <= 31; Y++) {
      const ombro = Y === 20 + dy;
      const x0 = (ombro ? 14 : 13) - largo, x1 = (ombro ? 25 : 26) + largo;
      for (let X = x0; X <= x1; X++) g.fino(X, Y, veste(X, x0, x1));
    }
    if (frente) {
      // decote em V e pescoço
      retF(g, 18, 18 + dy, 4, 2, c.s);
      retF(g, 18, 20 + dy, 4, 1, c.S); retF(g, 19, 21 + dy, 2, 1, c.s);
      if (cfg.gola) { retF(g, 17, 20 + dy, 6, 1, cfg.gola); g.fino(18, 21 + dy, cfg.gola); g.fino(21, 21 + dy, cfg.gola); }
    } else retF(g, 18, 18 + dy, 4, 2, c.s);
    retF(g, 13 - largo, 30, 14 + 2 * largo, 2, (X, Y) => (Y === 30 ? claro(c.A, 0.12) : X > 23 ? escuro(c.A, 0.15) : c.A));
    if (frente) { g.fino(19, 30, claro(c.A, 0.45)); g.fino(20, 30, claro(c.A, 0.3)); }
  }

  // Montado: veste curta sobre a sela e pernas abertas (de frente/costas) ou dobrada para a frente (de lado).
  function inferiorMontado(g, cfg, c, P) {
    const longo = cfg.molde !== "curta";
    const perna = longo ? [c.R, c.r, c.d] : [claro(c.S, 0.06), c.S, c.s];
    const sand = [claro(c.F, 0.15), c.F, escuro(c.F, 0.3)];
    if (P.vista === "lado") {
      for (let Y = 32; Y <= 36; Y++) for (let X = 14; X <= 25; X++) g.fino(X, Y, Y === 36 ? c.d : X < 17 ? c.R : X > 22 ? c.d : c.r);
      membro(g, 20, 34, 25, 36, 4, perna);
      membro(g, 25, 36, 25, 42, 3, perna);
      retF(g, 24, 42, 5, 2, (X, Y) => (Y === 42 ? sand[0] : sand[1]));
      return;
    }
    for (let Y = 32; Y <= 36; Y++) for (let X = 12; X <= 27; X++) g.fino(X, Y, Y === 36 ? c.d : X < 15 ? c.R : X > 24 ? c.d : c.r);
    membro(g, 14, 35, 11, 38, 3, perna); membro(g, 11, 38, 11, 42, 3, perna);
    membro(g, 26, 35, 29, 38, 3, [perna[1], perna[2], perna[2]]); membro(g, 29, 38, 29, 42, 3, [perna[1], perna[2], perna[2]]);
    retF(g, 9, 42, 4, 2, sand[1]); retF(g, 28, 42, 4, 2, sand[2]);
  }

  // Braços na frente/costas (os dois) ou o braço de perto (de lado), com as mãos por cima da arma.
  function bracos(g, cfg, c, P, soMaos) {
    const v = P.vista, dy = P.dy, largo = cfg.porte === "grande" ? 1 : 0;
    const manga = cfg.mangaCor ? [claro(cfg.mangaCor, 0.12), cfg.mangaCor, escuro(cfg.mangaCor, 0.2)] : [c.R, c.r, c.d];
    const mao = (X, Y, sombra) => retF(g, X - 1, Y - 1, 3, 3, (x, y) => (sombra || x === X + 1 || y === Y + 1 ? c.s : c.S));
    if (v === "lado") {
      const [hx, hy] = P.maoArma;
      if (!soMaos) membro(g, 21, 21 + dy, hx, hy - 2, 4, manga);
      mao(hx, hy, false);
      return;
    }
    const frente = v === "frente";
    const [ax, ay] = P.maoArma, [ex, ey] = P.maoEscudo;
    const xa = frente ? 11 - largo : 28 + largo, xe = frente ? 28 + largo : 11 - largo;
    if (!soMaos) {
      membro(g, xa, 21 + dy, ax, ay - 2, 3, frente ? manga : [manga[1], manga[1], manga[2]]);
      membro(g, xe, 21 + dy, ex, ey - 2, 3, frente ? [manga[1], manga[2], escuro(manga[2], 0.15)] : [manga[0], manga[1], manga[1]]);
    }
    mao(ax, ay, !frente);
    if (!cfg.duasMaosOcupadas) mao(ex, ey, frente);
  }

  // ----- acessórios: f(g, c, P, cfg) por vista; camada "fundo" (antes do corpo), "meio" (depois do
  // corpo, antes dos braços) ou "frente" (por cima de tudo). camada pode ser função da vista.
  const ACESSORIOS = {};
  function acessorio(nome, camada, f) { ACESSORIOS[nome] = { camada, f }; }
  const camadaPorVista = (lado, frente, costas) => (v) => (v === "lado" ? lado : v === "frente" ? frente : costas);

  // cajados e lanças: haste vertical na mão da arma
  function haste(g, P, cores, topo, chao, larg = 2) {
    const [hx, hy] = P.maoArma;
    const inclina = P.q === 4 ? (P.vista === "frente" ? -1 : 1) : 0;
    const y0 = Math.max(P.q === 4 ? 3 : 0, hy - topo), y1 = Math.min(45, hy + chao + (P.q === 4 ? 6 : 0));
    linF(g, hx + inclina * 3, y0, hx, y1, (X, Y) => (X <= hx - 1 + inclina ? cores[0] : escuro(cores[0], 0.25)), 1);
    linF(g, hx + inclina * 3 + 1, y0, hx + 1, y1, escuro(cores[0], 0.25), 1);
    if (larg < 2) return [hx + inclina * 3, y0];
    return [hx + inclina * 3, y0];
  }
  acessorio("cajado_alto", "frente", (g, c, P) => { const [x, y] = haste(g, P, c, 25, 15); retF(g, x, y - 1, 2, 2, c[1] || claro(c[0], 0.2)); });
  acessorio("cajado_curvo", "frente", (g, c, P) => {
    const [x, y] = haste(g, P, c, 25, 15);
    const lado = P.vista === "costas" ? 1 : -1;
    linF(g, x, y, x + lado * 1, y - 3, c[0], 2); linF(g, x + lado, y - 3, x + lado * 4, y - 4, c[1] || c[0], 2); linF(g, x + lado * 5, y - 3, x + lado * 5, y - 1, c[0], 2);
  });
  acessorio("cajado_curto", "frente", (g, c, P) => { const [x, y] = haste(g, P, c, 15, 14); elipF(g, x + 1, y - 1, 2, 2, (nx, ny) => (nx + ny < -0.3 ? "#ffe08a" : "#e8b94a")); });
  acessorio("lanca", "frente", (g, c, P) => {
    const [x, y] = haste(g, P, c, 24, 14);
    for (let i = 0; i < 6; i++) { const w = i < 2 ? 1 : i < 4 ? 2 : 1; retF(g, x + 1 - w + (w > 1 ? 1 : 0), y - 6 + i, w * 2 - (w > 1 ? 0 : 0) || 1, 1, i < 3 ? claro(c[1], 0.2) : c[1]); }
    retF(g, x, y - 1, 2, 2, escuro(c[1], 0.2));
  });
  acessorio("lanca_longa", "frente", (g, c, P) => {
    const [x, y] = haste(g, P, c, 28, 14);
    for (let i = 0; i < 7; i++) { const w = i === 0 ? 1 : i < 5 ? 2 : 1; retF(g, x + 1 - Math.floor(w / 2), y - 7 + i, w, 1, i < 3 ? claro(c[1], 0.25) : c[1]); }
    retF(g, x - 1, y, 4, 1, escuro(c[1], 0.3));
  });
  acessorio("ankh", "frente", (g, c, P) => {
    const [hx, hy] = P.maoArma, x = hx + (P.q === 4 ? (P.vista === "frente" ? -3 : 3) : 0), y = hy - 17;
    elipF(g, x + 1, y - 3, 2, 2.5, (nx, ny) => (nx * nx + ny * ny < 0.3 ? null : c[0]));
    retF(g, x - 2, y, 6, 1, c[0]); retF(g, x, y, 2, 4, c[0]);
  });
  // espadas: em pé ao lado do corpo; no golpe vão à frente (de lado) ou ao alto (frente/costas)
  function lamina(g, P, c, curva) {
    const [hx, hy] = P.maoArma;
    const [esc, cla, guarda, cabo] = [c[0], c[1], c[2] || "#b07a38", c[3] || "#5a3624"];
    const golpe = P.q === 4;
    if (P.vista === "lado" && golpe) {
      // horizontal, à frente
      retF(g, hx - 3, hy, 3, 1, cabo); retF(g, hx, hy - 2, 1, 5, guarda);
      for (let i = 1; i <= 9; i++) { const yy = hy - (curva && i > 5 ? i - 5 : 0); g.fino(hx + i, yy - 1, cla); g.fino(hx + i, yy, esc); }
      g.fino(hx + 10, hy - (curva ? 5 : 0) - 1, cla);
      return;
    }
    const sobe = golpe ? -6 : 0;
    const x = hx, gy = hy - 2 + sobe;
    retF(g, x - 2, gy, 5, 1, guarda); g.fino(x - 2, gy, claro(guarda, 0.3));
    retF(g, x, gy + 1, 1, 3, cabo); g.fino(x, gy + 4, guarda);
    for (let i = 1; i <= 10; i++) {
      const dx = curva && i > 6 ? Math.floor((i - 6) / 2) * (P.vista === "frente" ? -1 : 1) : 0;
      g.fino(x - 1 + dx, gy - i, cla); g.fino(x + dx, gy - i, esc);
    }
    g.fino(x - 1 + (curva ? (P.vista === "frente" ? -2 : 2) : 0), gy - 11, cla);
  }
  acessorio("espada", "frente", (g, c, P) => lamina(g, P, c, false));
  acessorio("espada_curva", "frente", (g, c, P) => lamina(g, P, c, true));
  acessorio("porrete", "frente", (g, c, P) => {
    const [hx, hy] = P.maoArma, sobe = P.q === 4 ? -5 : 0, ld = P.vista === "lado" && P.q === 4;
    if (ld) { retF(g, hx, hy - 1, 8, 2, c[1] || c[0]); elipF(g, hx + 9, hy, 2.6, 2.6, (nx, ny) => (nx + ny < -0.4 ? claro(c[0], 0.2) : c[0])); return; }
    retF(g, hx, hy - 9 + sobe, 2, 9, c[1] || c[0]);
    elipF(g, hx + 1, hy - 11 + sobe, 2.6, 3, (nx, ny) => (nx + ny < -0.4 ? claro(c[0], 0.2) : nx + ny > 0.6 ? escuro(c[0], 0.2) : c[0]));
  });
  // escudos: de frente no braço do escudo; de costas mostram o verso; de lado, à frente do peito
  function escudo(g, P, cores, forma) {
    const [fr, aro, cen] = [cores[0], cores[1], cores[2] || cores[0]];
    const v = P.vista;
    if (v === "lado") {
      const [x, y] = P.maoEscudo;
      const ry = forma === "alto" ? 8 : 6, rx = forma === "alto" ? 2.2 : 2.6;
      elipF(g, x + 0.5, y - 1, rx, ry, (nx, ny) => (nx > 0.55 ? aro : nx < -0.6 ? escuro(fr, 0.2) : ny < -0.6 ? claro(fr, 0.2) : fr));
      return;
    }
    const [x, y] = P.maoEscudo;
    const cx = v === "frente" ? x + 1 : x - 1, cy = y - 3;
    if (v === "costas") {
      elipF(g, cx, cy, forma === "alto" ? 5 : 5.5, forma === "alto" ? 8 : 5.5, (nx, ny) => (nx * nx + ny * ny > 0.7 ? escuro(aro, 0.1) : escuro(fr, 0.3)));
      retF(g, cx - 3, cy - 1, 7, 2, "#5a3a24");
      return;
    }
    if (forma === "alto") {
      retF(g, cx - 5, cy - 8, 11, 16, (X, Y, i, j) => (i === 0 || j === 0 ? claro(fr, 0.2) : i === 10 || j === 15 ? escuro(fr, 0.3) : (i + j) % 4 === 0 ? aro : fr));
      retF(g, cx - 1, cy - 8, 2, 16, cen);
      return;
    }
    if (forma === "oval") {
      elipF(g, cx, cy, 4.2, 6.5, (nx, ny, X, Y) => (nx * nx + ny * ny > 0.72 ? escuro(fr, 0.2) : Y % 3 === 0 ? aro : nx + ny < -0.5 ? claro(fr, 0.15) : fr));
      return;
    }
    elipF(g, cx, cy, 5.6, 5.6, (nx, ny) => {
      const r = Math.sqrt(nx * nx + ny * ny);
      if (r > 0.8) return nx + ny < -0.3 ? claro(aro, 0.2) : aro;
      if (r < 0.28) return nx + ny < 0 ? claro(cen, 0.35) : cen;
      return tom([escuro(fr, 0.15), fr, claro(fr, 0.18)], -(nx + ny) * 0.9);
    });
  }
  acessorio("escudo_redondo", "frente", (g, c, P) => escudo(g, P, c, "redondo"));
  acessorio("escudo_alto", "frente", (g, c, P) => escudo(g, P, c, "alto"));
  acessorio("escudo_oval", "frente", (g, c, P) => escudo(g, P, c, "oval"));
  // arco nas costas e arco na mão
  acessorio("arco_costas", camadaPorVista("fundo", "fundo", "frente"), (g, c, P) => {
    const corda = c[1];
    if (P.vista === "lado") { for (let Y = 17; Y <= 37; Y++) { const t = (Y - 27) / 10; g.fino(Math.round(13 + 3 * t * t), Y + P.dy, c[0]); g.fino(Math.round(14 + 3 * t * t), Y + P.dy, escuro(c[0], 0.2)); } linF(g, 16, 17 + P.dy, 16, 37 + P.dy, corda); return; }
    if (P.vista === "frente") { for (let Y = 16; Y <= 34; Y++) { const t = (Y - 25) / 9; g.fino(Math.round(29 - 2 * t * t), Y, c[0]); } return; }
    linF(g, 13, 17 + P.dy, 27, 36 + P.dy, (X, Y, i) => (i % 2 ? c[0] : escuro(c[0], 0.2)), 2);
    linF(g, 16, 15 + P.dy, 29, 33 + P.dy, corda);
  });
  acessorio("arco_mao", "frente", (g, c, P) => {
    const [hx, hy] = P.maoArma, v = P.vista, puxa = P.q === 4;
    if (v === "lado") {
      const x0 = puxa ? hx + 2 : hx;
      for (let Y = -10; Y <= 10; Y++) { const t = Y / 10; g.fino(Math.round(x0 + 3 - 3 * t * t), hy - 2 + Y, Y % 4 ? c[0] : escuro(c[0], 0.25)); }
      linF(g, x0 - (puxa ? 4 : 0), hy - 2, x0 + 0, hy - 12, c[1]); linF(g, x0 - (puxa ? 4 : 0), hy - 2, x0, hy + 8, c[1]);
      if (puxa) linF(g, x0 - 5, hy - 2, x0 + 7, hy - 2, "#c8b48a");
      return;
    }
    const sx = v === "frente" ? -1 : 1;
    for (let Y = -10; Y <= 10; Y++) { const t = Y / 10; g.fino(Math.round(hx + sx * (3 - 3 * t * t)), hy - 3 + Y, Y % 4 ? c[0] : escuro(c[0], 0.25)); }
    linF(g, hx, hy - 13, hx, hy + 7, c[1]);
  });
  // capas
  function capa(g, c, P, larga) {
    const v = P.vista, dy = P.dy, sw = P.q === 2 ? 1 : P.q === 3 ? -1 : 0;
    const [a, b] = [c[0], c[1]];
    if (v === "lado") {
      for (let Y = 20 + dy; Y <= 42; Y++) { const k = Math.floor((Y - 20) / 5); for (let X = 13 - k + sw * (Y > 34 ? 1 : 0); X <= 17; X++) g.fino(X, Y, X === 17 ? escuro(a, 0.25) : (X + Y) % 6 === 0 ? b : a); }
      return;
    }
    if (v === "frente") {
      const x0 = larga ? 7 : 9, x1 = larga ? 32 : 30;
      for (let Y = 21 + dy; Y <= 42; Y++) for (let X = x0; X <= x1; X++) g.fino(X, Y, X < 12 ? claro(a, 0.08) : X > 27 ? escuro(a, 0.25) : b);
      return;
    }
    for (let Y = 19 + dy; Y <= 42; Y++) {
      const k = Math.floor((Y - 19) / 6) + (larga ? 1 : 0), x0 = 12 - k + (Y > 36 ? sw : 0), x1 = 27 + k + (Y > 36 ? sw : 0);
      for (let X = x0; X <= x1; X++) g.fino(X, Y, Y === 42 ? b : X < x0 + 2 ? claro(a, 0.12) : X > x1 - 2 ? escuro(a, 0.25) : (X - x0) % 5 === 2 && Y > 24 ? escuro(a, 0.12) : a);
    }
    retF(g, 13, 19 + dy, 14, 1, b);
  }
  acessorio("capa", camadaPorVista("fundo", "fundo", "frente"), (g, c, P) => capa(g, c, P, false));
  acessorio("capa_larga", camadaPorVista("fundo", "fundo", "frente"), (g, c, P) => capa(g, c, P, true));
  // cabeça
  acessorio("turbante", "frente", (g, c, P) => {
    const dy = P.dy, cx = P.vista === "lado" ? 20 : 20;
    elipF(g, cx, 9 + dy, 7, 4.2, (nx, ny, X, Y) => ((Y + Math.round(nx * 3)) % 3 === 0 ? escuro(c[0], 0.18) : nx < -0.4 ? claro(c[0], 0.15) : nx > 0.5 ? escuro(c[0], 0.1) : c[0]));
    if (c[1]) for (let X = cx - 7; X <= cx + 6; X++) g.fino(X, 11 + dy, c[1]);
    if (c[2]) g.fino(cx - 3, 6 + dy, c[2]);
    if (P.vista === "lado") retF(g, 13, 9 + dy, 2, 6, escuro(c[0], 0.15));
  });
  acessorio("elmo", "frente", (g, c, P) => {
    const dy = P.dy, v = P.vista, cx = v === "lado" ? 20.5 : 20;
    elipF(g, cx, 11 + dy, 6.6, 5.5, (nx, ny, X, Y) => (Y > 10 + dy ? null : nx + ny < -0.6 ? claro(c[1], 0.2) : nx > 0.4 ? escuro(c[0], 0.2) : c[0]));
    retF(g, Math.round(cx) - 7, 10 + dy, 14, 1, c[1]);
    if (v === "frente") retF(g, 19, 11 + dy, 2, 4, c[0]);
    if (v === "lado") { retF(g, 15, 10 + dy, 3, 6, c[0]); g.fino(25, 11 + dy, c[0]); }
    retF(g, Math.round(cx) - 1, 4 + dy, 2, 2, c[1]);
  });
  acessorio("faixa", "frente", (g, c, P) => {
    const dy = P.dy;
    if (P.vista === "lado") { retF(g, 15, 9 + dy, 11, 1, c[0]); retF(g, 13, 10 + dy, 2, 3, c[0]); return; }
    retF(g, 14, 9 + dy, 12, 1, c[0]); if (P.vista === "costas") retF(g, 19, 10 + dy, 2, 4, c[0]);
  });
  acessorio("bandana", "frente", (g, c, P) => {
    const dy = P.dy;
    elipF(g, P.vista === "lado" ? 20.5 : 20, 10 + dy, 6.6, 4.2, (nx, ny, X, Y) => (Y > 10 + dy ? null : nx > 0.4 ? escuro(c[0], 0.2) : (X + Y) % 4 === 0 ? claro(c[0], 0.15) : c[0]));
    if (P.vista === "lado") { retF(g, 13, 10 + dy, 2, 2, c[0]); retF(g, 12, 12 + dy, 2, 3, escuro(c[0], 0.2)); }
    if (P.vista === "costas") { retF(g, 18, 11 + dy, 4, 2, c[0]); retF(g, 17, 13 + dy, 2, 3, escuro(c[0], 0.2)); retF(g, 21, 13 + dy, 2, 3, c[0]); }
    if (P.vista === "frente" && c[1]) g.fino(16, 13 + dy, c[1]);
  });
  // nemes (toucado listrado do Egito): topo e abas sobre os ombros
  acessorio("nemes", "frente", (g, c, P) => {
    const dy = P.dy, v = P.vista, faixa = (Y) => ((Y >> 1) % 2 ? c[1] : c[0]);
    elipF(g, v === "lado" ? 20 : 20, 10 + dy, 7, 4.6, (nx, ny, X, Y) => (Y > 10 + dy ? null : faixa(Y)));
    retF(g, 13, 9 + dy, 14, 2, faixa(9));
    if (v === "frente") { retF(g, 12, 11 + dy, 3, 11, (X, Y) => faixa(Y)); retF(g, 25, 11 + dy, 3, 11, (X, Y) => escuro(faixa(Y), 0.15)); retF(g, 14, 10 + dy, 12, 1, c[2] || c[1]); }
    else if (v === "lado") retF(g, 14, 11 + dy, 5, 10, (X, Y) => faixa(Y));
    else retF(g, 13, 10 + dy, 14, 11, (X, Y) => (X > 24 ? escuro(faixa(Y), 0.15) : faixa(Y)));
  });
  // colar largo (Egito) e peitoral do sumo sacerdote
  acessorio("colar", "meio", (g, c, P) => {
    const dy = P.dy;
    if (P.vista === "costas") return;
    if (P.vista === "lado") { retF(g, 19, 20 + dy, 6, 2, (X) => (X % 2 ? c[0] : c[1])); return; }
    for (let Y = 20; Y <= 22; Y++) { const k = Y - 20; for (let X = 15 - k + 2; X <= 24 + k - 2; X++) g.fino(X, Y + dy, (X + Y) % 2 ? c[0] : c[1]); }
  });
  acessorio("peitoral", "meio", (g, c, P) => {
    const dy = P.dy, pedras = ["#c2452d", "#4fa3a5", "#e8b94a", "#55642c", "#6d8fc4", "#b98ad0"];
    if (P.vista === "costas") return;
    const x0 = P.vista === "lado" ? 22 : 17, w = P.vista === "lado" ? 3 : 6;
    retF(g, x0, 22 + dy, w, 7, c[0]);
    for (let j = 0; j < 3; j++) for (let i = 0; i < (P.vista === "lado" ? 1 : 3); i++) { g.fino(x0 + 1 + i * 2 - (P.vista === "lado" ? 0 : 0), 23 + j * 2 + dy, pedras[(i + j * 3) % 6]); }
  });
  // carga e utensílios
  acessorio("bolsa", "meio", (g, c, P) => {
    const v = P.vista;
    const x = v === "lado" ? 21 : v === "frente" ? 15 : 23;
    if (v === "costas" && false) return;
    retF(g, x, 32, 4, 4, (X, Y) => (Y === 32 ? c[1] || c[0] : X === x + 3 ? escuro(c[0], 0.2) : c[0])); g.fino(x + 1, 33, c[1] || claro(c[0], 0.2));
  });
  acessorio("odre", camadaPorVista("meio", "meio", "fundo"), (g, c, P) => {
    const x = P.vista === "lado" ? 16 : P.vista === "frente" ? 25 : 12;
    elipF(g, x + 2, 35, 2.6, 3.4, (nx, ny) => (nx + ny < -0.4 ? c[1] || claro(c[0], 0.2) : nx + ny > 0.5 ? escuro(c[0], 0.2) : c[0]));
    retF(g, x + 1, 30, 2, 2, c[1] || c[0]);
  });
  acessorio("saco", camadaPorVista("fundo", "meio", "meio"), (g, c, P) => {
    const [x, y] = P.maoEscudo, cx = P.vista === "lado" ? 15 : x + (P.vista === "frente" ? 2 : -2);
    elipF(g, cx, y + 3, 3.2, 3.6, (nx, ny) => (nx + ny < -0.4 ? c[1] || claro(c[0], 0.2) : nx + ny > 0.5 ? escuro(c[0], 0.2) : c[0]));
    retF(g, cx - 1, y - 1, 2, 2, escuro(c[0], 0.2));
  });
  acessorio("jarro", camadaPorVista("frente", "frente", "meio"), (g, c, P) => {
    const [x, y] = P.maoEscudo, cx = P.vista === "lado" ? 27 : x + (P.vista === "frente" ? 2 : -2);
    elipF(g, cx, y + 1, 3.6, 4, (nx, ny) => tom([c[1], c[0], c[2] || claro(c[0], 0.2)], -(0.6 * nx + 0.8 * ny)));
    retF(g, cx - 1.5, y - 4, 3, 2, c[1]); retF(g, cx - 2.5, y - 5, 5, 1, c[0]);
    g.fino(Math.round(cx) - 2, y, c[2] || claro(c[0], 0.3));
  });
  acessorio("fardo", camadaPorVista("fundo", "fundo", "frente"), (g, c, P) => {
    const dy = P.dy;
    if (P.vista === "lado") { retF(g, 11, 19 + dy, 6, 12, (X, Y) => (Y % 4 === 0 ? c[1] || escuro(c[0], 0.2) : X === 11 ? claro(c[0], 0.15) : c[0])); return; }
    if (P.vista === "frente") { retF(g, 12, 15 + dy, 16, 6, (X, Y) => (Y === 15 + dy ? claro(c[0], 0.15) : c[0])); return; }
    retF(g, 12, 17 + dy, 16, 13, (X, Y) => (Y % 4 === 0 ? c[1] || escuro(c[0], 0.2) : X < 14 ? claro(c[0], 0.15) : X > 25 ? escuro(c[0], 0.2) : c[0]));
    linF(g, 15, 17 + dy, 15, 29 + dy, "#5a3a24"); linF(g, 24, 17 + dy, 24, 29 + dy, "#5a3a24");
  });
  acessorio("corda", "meio", (g, c, P) => {
    const dy = P.dy, x = P.vista === "frente" ? 25 : P.vista === "costas" ? 15 : 18;
    elipF(g, x, 25 + dy, 3.6, 3.6, (nx, ny) => { const r = nx * nx + ny * ny; return r < 0.25 ? null : (Math.round(r * 6) % 2 ? c[0] : c[1]); });
  });
  acessorio("rede", camadaPorVista("fundo", "meio", "meio"), (g, c, P) => {
    const dy = P.dy, x0 = P.vista === "frente" ? 24 : P.vista === "costas" ? 10 : 12;
    for (let j = 0; j < 12; j++) for (let i = 0; i < 7; i++) if ((i + j) % 3 === 0 || (i - j + 30) % 3 === 0) g.fino(x0 + i, 21 + j + dy, (i + j) % 2 ? c[0] : escuro(c[0], 0.2));
  });
  acessorio("shofar", "meio", (g, c, P) => {
    if (P.vista === "costas") return;
    const x = P.vista === "frente" ? 22 : 16;
    linF(g, x, 32, x + 4, 34, c[0], 2); g.fino(x - 1, 31, c[1]); g.fino(x, 31, c[1]); g.fino(x + 5, 34, c[2]);
  });
  acessorio("pele_leopardo", "meio", (g, c, P) => {
    if (P.vista === "costas") { retF(g, 22, 20 + P.dy, 5, 9, (X, Y) => ((X * 3 + Y * 5) % 7 === 0 ? "#3a2414" : "#d8a040")); return; }
    const x0 = P.vista === "frente" ? 13 : 16;
    retF(g, x0, 20 + P.dy, 6, 10, (X, Y) => ((X * 3 + Y * 5) % 7 === 0 ? "#3a2414" : X === x0 ? "#f0c868" : "#d8a040"));
  });
  acessorio("estola", "meio", (g, c, P) => {
    // manto sobre um ombro, caindo pelo lado direito do corpo
    const dy = P.dy, [M, m, n] = c;
    if (P.vista === "frente") {
      for (let Y = 20; Y <= 40; Y++) {
        const x0 = Y < 30 ? Math.round(16 + (Y - 20) * 0.7) : 23, x1 = Y < 22 ? x0 + 4 : 27;
        for (let X = x0; X <= x1; X++) g.fino(X, Y + (Y < 32 ? dy : 0), X === x0 ? M : X === x1 ? n : m);
      }
    } else if (P.vista === "costas") {
      for (let Y = 20; Y <= 40; Y++) { const x0 = 13, x1 = Y < 30 ? Math.round(22 - (Y - 20) * 0.4) : 18; for (let X = x0; X <= x1; X++) g.fino(X, Y + (Y < 32 ? dy : 0), X === x0 ? M : X === x1 ? n : m); }
    } else for (let Y = 20; Y <= 40; Y++) for (let X = 16; X <= 21; X++) g.fino(X, Y + (Y < 32 ? dy : 0), X === 16 ? M : X === 21 ? n : m);
  });
  // efeitos de mão
  acessorio("brilho", "frente", (g, c, P) => {
    if (P.q !== 1 && P.q !== 4) return;
    const [hx, hy] = P.maoArma, y = hy - (c[1] || 0);
    g.fino(hx, y - 4, c[0]); g.fino(hx - 2, y - 2, c[0]); g.fino(hx + 2, y - 3, c[0]); g.fino(hx, y - 6, claro(c[0], 0.5));
  });
  acessorio("funda", "frente", (g, c, P) => {
    const [hx, hy] = P.maoArma;
    const pos = [[30, 4], [24, 2], [14, 4], [22, 6], [33, 6]][P.q];
    const px = P.vista === "costas" ? 40 - pos[0] : pos[0];
    linF(g, hx, hy - 1, px, pos[1] + 2, c[0]); elipF(g, px, pos[1], 1.5, 1.5, c[1] || "#8a8478");
  });

  // Armaduras do jogador (por cima da veste): couro (colete com ombreiras e rebites) e escamas.
  const ARMADURAS = {
    tunica_pano: { veste: { R: "#c9d4e0", r: "#a8b8c8", d: "#7f90a4" }, gola: "#3b5a9a" },
    armadura_couro: {
      f: (g, P) => {
        const dy = P.dy, v = P.vista, L = ["#a8703a", "#7a4a30", "#4f3220"];
        const x0 = v === "lado" ? 15 : 13, x1 = v === "lado" ? 25 : 26;
        for (let Y = 21 + dy; Y <= 33; Y++) for (let X = x0; X <= x1; X++) g.fino(X, Y, Y === 33 ? L[2] : X <= x0 + 1 ? L[0] : X >= x1 - 1 ? L[2] : (Y - dy) % 4 === 0 ? escuro(L[1], 0.15) : L[1]);
        if (v !== "lado") { retF(g, 10, 20 + dy, 4, 3, L[0]); retF(g, 26, 20 + dy, 4, 3, L[2]); }
        else retF(g, 19, 20 + dy, 5, 3, L[0]);
        if (v === "frente") { for (const [x, y] of [[15, 23], [24, 23], [15, 29], [24, 29]]) g.fino(x, y + dy, "#e8b94a"); retF(g, 19, 21 + dy, 2, 2, "#f0d0a0"); }
      },
    },
    couraca_escamas: {
      f: (g, P) => {
        const dy = P.dy, v = P.vista, E = ["#d29e52", "#b07a38", "#7a4a24"];
        const x0 = v === "lado" ? 15 : 13, x1 = v === "lado" ? 25 : 26;
        for (let Y = 21 + dy; Y <= 31; Y++) for (let X = x0; X <= x1; X++) { const fila = (Y - dy) >> 1, off = fila % 2; g.fino(X, Y, (X + off) % 3 === 0 && (Y - dy) % 2 ? E[2] : (Y - dy) % 2 ? E[1] : E[0]); }
        for (let X = x0 - 1; X <= x1 + 1; X += 2) retF(g, X, 32, 1, 4, X % 4 === 1 ? E[1] : E[2]);
        if (v !== "lado") { elipF(g, 11.5, 22 + dy, 2.5, 2, E[0]); elipF(g, 28.5, 22 + dy, 2.5, 2, E[2]); }
      },
    },
  };

  // Desenha um humano numa vista e quadro.
  function desenharHumano(g, cfg, quadro) {
    const vista = VISTAS[Math.floor(quadro / QUADROS_POR_VISTA)] || "lado";
    const q = quadro % QUADROS_POR_VISTA;
    const P = pose(vista, q);
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
    for (const [a, cores] of acs) if (camada(a) === "frente") a.f(g, cores, P, cfg);
    // a mão da arma por cima do cabo
    if (acs.some(([a]) => camada(a) === "frente")) bracos(g, cfg, c, P, true);
    if (cfg.extra) cfg.extra(g, P, c);
  }

  // Registra um humano: cfg = { molde, cores, barba, cabelo, porte, gola, capuz, armadura, acessorios,
  // hostil, duasMaosOcupadas, extra(g, P, c) }.
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
  const base = (id) => String(id || "").split("@")[0];
  function chaveJogador(eq = {}, visual = {}) {
    const partes = [base(eq.arma), eq.arco ? base(eq.arco) : "", base(eq.escudo), base(eq.armadura), visual.traje || "", visual.montaria || ""];
    return "pj_jogador" + (partes.some(Boolean) ? "|" + partes.join("|") : "");
  }
  // visual: cosméticos (JGB-27) — traje (outfit) e montaria; só mudam a aparência.
  function garantirJogador(eq = {}, visual = {}) {
    const chave = chaveJogador(eq, visual);
    if (PIXEL_PATTERNS[chave]) return chave;
    const traje = (visual.traje && typeof TRAJES !== "undefined" && TRAJES[visual.traje]?.visual) || null;
    const acessorios = [["bolsa", ["#7a4a30", "#a8703a"]]].concat(traje?.acessorios || []);
    const arco = base(eq.arco);
    if (arco === "funda") acessorios.push(["shofar", ["#8a6a42", "#5a3a24", "#a8916a"]]);
    else if (arco) acessorios.push(["arco_costas", ARCOS[arco] || ARCOS.arco_madeira]);
    if (eq.arma) acessorios.push(["espada", LAMINAS[base(eq.arma)] || LAMINAS.espada_ferro]);
    if (eq.escudo) acessorios.push(["escudo_redondo", CORES_ESCUDO[base(eq.escudo)] || CORES_ESCUDO.escudo_madeira]);
    const cfg = {
      molde: traje?.molde || "curta", barba: false,
      cores: Object.assign({ H: "#4a2f20", S: "#e0a878", s: "#c68a5c", R: "#eadcb6", r: "#d4bf8f", d: "#a8916a", A: "#3b5a9a", F: "#5a3a24" }, traje?.cores),
      armadura: traje ? null : base(eq.armadura) || null,
      gola: traje?.gola, cabelo: traje?.cabelo,
      acessorios,
    };
    if (visual.montaria) registrarMontado(chave, cfg, visual.montaria);
    else humano(chave, cfg);
    return chave;
  }
  garantirJogador({});

  // -------------------------------------------------------------------
  // Montarias (JGB-27): jumento, camelo, cavalo e carro, só visuais. Célula 48 × 56 px de arte
  // (24 × 28 unidades), chão na linha 53; 3 vistas × 5 quadros como os humanos. O cavaleiro é o boneco
  // do jogador com cfg.montado, desenhado entre as partes de trás e da frente da montaria.
  // -------------------------------------------------------------------
  const MONTARIAS_ARTE = {
    jumento: { pelo: ["#5e554a", "#857a6c", "#a89e8e"], ventre: "#d8d0c0", focinho: "#ded6c6", crina: "#3e3830", corpo: [22, 39, 10, 5.2], perna: 46, pescoco: [[30, 36], [36, 31]], cabeca: [38.5, 30, 3.6, 2.8], orelhas: "longas", cauda: "tufo", sela: ["#8e2a1f", "#c2452d"] },
    cavalo: { pelo: ["#5a3418", "#7e4a24", "#a86a38"], ventre: "#a86a38", focinho: "#4a2a14", crina: "#241610", corpo: [21, 36, 11.5, 6], perna: 43, pescoco: [[30, 33], [35, 26]], cabeca: [38.5, 25.5, 4.2, 2.6], orelhas: "curtas", cauda: "longa", sela: ["#3b5a9a", "#6d8fc4"] },
    camelo: { pelo: ["#9a7444", "#c49a62", "#dcb882"], ventre: "#e8d0a0", focinho: "#b08a58", crina: "#8a6a3e", corpo: [20, 34, 10.5, 5.5], perna: 41, pescoco: [[30, 33], [35, 26], [38, 20]], cabeca: [40.5, 19.5, 3.4, 2.2], orelhas: "curtas", cauda: "tufo", corcova: true, sela: ["#8e2a1f", "#e8b94a"] },
  };
  const CHAO_MT = 53;
  function animalLado(g, a, q) {
    const [A, B, C] = a.pelo, [cx, cy, rx, ry] = a.corpo;
    const passo = q === 2 ? 1 : q === 3 ? -1 : 0, resp = q === 1 ? 1 : 0;
    const tomP = (nx, ny) => (ny > 0.55 ? a.ventre : tom([A, B, C], -(0.4 * nx + 0.9 * ny)));
    const perna = (x, d, longe) => {
      const cor = longe ? [escuro(A, 0.15), A] : [B, A];
      elipF(g, x, cy + ry * 0.4, 2.4, ry * 0.75, (nx) => (nx < -0.2 ? cor[0] : cor[1]));
      linF(g, x - 1, cy + ry, x - 1 + d * 2, CHAO_MT - 1, cor[0], 2);
      linF(g, x + 1, cy + ry, x + 1 + d * 2, CHAO_MT - 1, escuro(cor[0], 0.2));
      retF(g, x - 2 + d * 2, CHAO_MT - 1, 4, 2, escuro(A, 0.45));
    };
    perna(cx - rx + 4, -passo, true); perna(cx + rx - 4, passo, true);
    // cauda
    if (a.cauda === "longa") for (let k = 0; k < 14; k++) retF(g, cx - rx - 1 - Math.round(k * 0.35) + (k > 9 ? passo : 0), cy - 3 + k, 3 - (k > 10 ? 1 : 0), 1, k % 3 ? a.crina : escuro(a.crina, 0.2));
    else { linF(g, cx - rx, cy - 2, cx - rx - 2, cy + 6, B); elipF(g, cx - rx - 2, cy + 8, 1.6, 2.2, a.crina); }
    // corpo
    elipF(g, cx, cy + resp * 0.5, rx, ry, tomP);
    elipF(g, cx - rx * 0.55, cy - 0.5, rx * 0.45, ry * 1.02, tomP);
    elipF(g, cx + rx * 0.55, cy, rx * 0.45, ry * 1.08, tomP);
    if (a.corcova) elipF(g, cx - 1, cy - ry - 1, 5.5, 4.2, (nx, ny) => tom([A, B, C], -(0.5 * nx + 0.9 * ny)));
    perna(cx - rx + 3, passo, false); perna(cx + rx - 5, -passo, false);
    // pescoço, crina e cabeça
    const pts = a.pescoco;
    for (let i = 0; i < pts.length - 1; i++) for (let t = 0; t <= 1; t += 0.2) {
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
      elipF(g, x, y, 2.6, 2.8, tomP);
      if (a !== MONTARIAS_ARTE.camelo) { g.fino(Math.round(x - 2), Math.round(y - 2), a.crina); g.fino(Math.round(x - 1), Math.round(y - 3), a.crina); }
    }
    const [hx, hy, hrx, hry] = a.cabeca;
    elipF(g, hx, hy, hrx, hry, (nx, ny) => (nx > 0.45 ? a.focinho : tom([A, B, C], -(0.5 * nx + 0.8 * ny))));
    retF(g, Math.round(hx - 1), Math.round(hy - 1), 2, 1, "#1c1210"); g.fino(Math.round(hx - 1), Math.round(hy - 1), "#fff6e0");
    g.fino(Math.round(hx + hrx - 1), Math.round(hy), escuro(a.focinho, 0.45));
    if (a.orelhas === "longas") { linF(g, hx - 2, hy - 2, hx - 4, hy - 8, B, 2); linF(g, hx - 1, hy - 2, hx - 1, hy - 8, C, 2); g.fino(Math.round(hx - 1), Math.round(hy - 6), "#c88a7a"); }
    else { linF(g, hx - 2, hy - 2, hx - 3, hy - 5, B, 2); }
    // sela
    const sx = cx + 1, sy = cy - ry - (a.corcova ? 3 : 0);
    retF(g, sx - 6, sy - 1, 12, 5, (X, Y) => (Y === sy - 1 ? claro(a.sela[0], 0.15) : (X + Y) % 4 === 0 ? a.sela[1] : a.sela[0]));
    retF(g, sx - 6, sy + 4, 12, 1, a.sela[1]);
    return [sx, sy + 1];
  }
  function animalFrente(g, a, q, parte) {
    const [A, B, C] = a.pelo, passo = q === 2 ? 1 : q === 3 ? -1 : 0;
    const tomP = (nx, ny) => (ny > 0.6 ? a.ventre : tom([A, B, C], -(0.5 * nx + 0.8 * ny)));
    if (parte === "fundo") {
      // lombo atrás do cavaleiro (corcova do camelo) e as pernas
      for (const [x, d] of [[18, passo], [30, -passo]]) { retF(g, x - 1, 42 - d, 4, CHAO_MT - 42 + d, (X) => (X === x - 1 ? B : A)); retF(g, x - 1, CHAO_MT - 1, 4, 2, escuro(A, 0.45)); }
      elipF(g, 24, 38, 9, 6, tomP);
      if (a.corcova) elipF(g, 24, 31, 6, 4.5, tomP);
      retF(g, 15, 32, 18, 4, (X, Y) => ((X + Y) % 4 === 0 ? a.sela[1] : a.sela[0]));
      return [24, 33];
    }
    // cabeça e pescoço à frente do cavaleiro
    const hy = a === MONTARIAS_ARTE.camelo ? 38 : 39;
    elipF(g, 24, hy - 2, 3.4, 5, tomP);
    elipF(g, 24, hy + 3, 3.2, 3.6, (nx, ny) => (ny > 0.2 ? a.focinho : tom([A, B, C], -(0.5 * nx + 0.8 * ny))));
    g.fino(22, hy, "#1c1210"); g.fino(26, hy, "#1c1210"); g.fino(22, hy - 1, "#fff6e0"); g.fino(23, hy + 5, escuro(a.focinho, 0.5)); g.fino(25, hy + 5, escuro(a.focinho, 0.5));
    if (a.orelhas === "longas") { linF(g, 21, hy - 5, 18, hy - 11, B, 2); linF(g, 27, hy - 5, 30, hy - 11, A, 2); }
    else { linF(g, 21, hy - 6, 20, hy - 9, B, 2); linF(g, 27, hy - 6, 28, hy - 9, A, 2); }
    if (a.crina && a !== MONTARIAS_ARTE.camelo) retF(g, 23, hy - 8, 2, 3, a.crina);
  }
  function animalCostas(g, a, q, parte) {
    const [A, B, C] = a.pelo, passo = q === 2 ? -1 : q === 3 ? 1 : 0;
    const tomP = (nx, ny) => tom([A, B, C], -(0.5 * nx + 0.8 * ny));
    if (parte === "fundo") {
      if (a.orelhas === "longas") { linF(g, 21, 26, 18, 20, B, 2); linF(g, 27, 26, 30, 20, A, 2); }
      elipF(g, 24, 29, 3, 3, tomP);
      return [24, 33];
    }
    for (const [x, d] of [[18, passo], [30, -passo]]) { retF(g, x - 1, 44 - d, 4, CHAO_MT - 44 + d, (X) => (X === x - 1 ? B : A)); retF(g, x - 1, CHAO_MT - 1, 4, 2, escuro(A, 0.45)); }
    elipF(g, 24, 41, 9.5, 6.5, tomP);
    linF(g, 24, 37, 24, 47, escuro(A, 0.25));
    if (a.cauda === "longa") retF(g, 23, 40, 3, 11, (X, Y) => (Y % 3 ? a.crina : escuro(a.crina, 0.2)));
    else { retF(g, 23, 40, 2, 6, B); elipF(g, 24, 47, 1.6, 2, a.crina); }
  }
  // Carro: cavalo à frente, caixa de vime e roda de raios atrás; o cavaleiro vai de pé dentro.
  function carroVista(g, vista, q, parte) {
    const cav = MONTARIAS_ARTE.cavalo, [A, B] = cav.pelo;
    const roda = (cx, cy, r) => {
      elipF(g, cx, cy, r, r, (nx, ny) => { const d = Math.sqrt(nx * nx + ny * ny); return d > 0.78 ? (d > 0.92 ? "#3e2a1a" : "#7a5530") : d < 0.25 ? "#b07a38" : null; });
      for (let k = 0; k < 6; k++) { const ang = (k / 6) * Math.PI + q * 0.5; linF(g, cx - Math.cos(ang) * (r - 1), cy - Math.sin(ang) * (r - 1), cx + Math.cos(ang) * (r - 1), cy + Math.sin(ang) * (r - 1), "#6b4a2e"); }
    };
    if (vista === "lado") {
      if (parte === "fundo") {
        // cavalo menor à frente (direita), puxando pelo varal
        const passo = q === 2 ? 1 : q === 3 ? -1 : 0;
        const tomP = (nx, ny) => tom([A, B, cav.pelo[2]], -(0.4 * nx + 0.9 * ny));
        for (const [x, d] of [[31, -passo], [41, passo]]) { linF(g, x, 42, x + d * 2, CHAO_MT - 1, A, 2); retF(g, x - 1 + d * 2, CHAO_MT - 1, 3, 2, "#2a1a14"); }
        elipF(g, 36, 40, 7.5, 4.4, tomP);
        for (let t = 0; t <= 1; t += 0.2) elipF(g, 41 + 3 * t, 37 - 7 * t, 2.2, 2.4, tomP);
        elipF(g, 45.5, 29.5, 2.6, 1.8, (nx) => (nx > 0.4 ? cav.focinho : B)); g.fino(45, 29, "#1c1210");
        linF(g, 43, 28, 42, 25, B, 2); retF(g, 41, 30, 2, 6, cav.crina);
        for (const [x, d] of [[33, passo], [39, -passo]]) { linF(g, x, 42, x + d * 2, CHAO_MT - 1, B, 2); retF(g, x - 1 + d * 2, CHAO_MT - 1, 3, 2, "#2a1a14"); }
        linF(g, 18, 40, 31, 38, "#6b4a2e", 2);
        return [14, 33];
      }
      retF(g, 4, 34, 20, 10, (X, Y) => (Y === 34 ? "#d29e52" : (X + Y) % 3 === 0 ? "#7a5530" : X < 7 ? "#b07a38" : "#8a5a32"));
      retF(g, 4, 34, 20, 1, "#e8b94a");
      roda(13, 46, 7);
      return;
    }
    if (parte === "fundo") {
      roda(7, 45, 5.5); roda(41, 45, 5.5);
      if (vista === "frente") return [24, 33];
      return [24, 33];
    }
    retF(g, 10, 38, 28, 8, (X, Y) => (Y === 38 ? "#d29e52" : (X + Y) % 3 === 0 ? "#7a5530" : "#8a5a32"));
    if (vista === "frente") animalFrente(g, cav, q, "frente");
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
    registrar("mt_" + tipo, { w: 24, h: 28, quadros: 1, contorno: "amigo", origem: [0.5, 1], desenhar(g) { desenharMontaria(g, tipo, "lado", 0, "fundo"); desenharMontaria(g, tipo, "lado", 0, "frente"); } });

  // Jogador montado: montaria (fundo) + boneco sentado (ou de pé no carro) + montaria (frente).
  function registrarMontado(chave, cfg, tipo) {
    const cav = Object.assign({}, cfg, { montado: tipo !== "carro" });
    return registrar(chave, {
      w: 24, h: 28, quadros: QUADROS_POR_VISTA * VISTAS.length, direcoes: VISTAS.length, contorno: "amigo", origem: [0.5, 1],
      humano: true, montado: tipo, retratoQuadro: QUADROS_POR_VISTA, busto: [4, 0, 16, 13],
      desenhar(g, quadro) {
        const vista = VISTAS[Math.floor(quadro / QUADROS_POR_VISTA)], q = quadro % QUADROS_POR_VISTA;
        const [sx, sy] = desenharMontaria(g, tipo, vista, q, "fundo");
        const r = new Grade(20, 24);
        desenharHumano(r, cav, quadro - (q >= 2 && q <= 3 ? q : 0)); // montado não dá passos
        const ox = Math.round(sx) - 20, oy = Math.round(sy) - (tipo === "carro" ? 40 : 33);
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
    extraCorpo: (g, P) => { if (P.vista === "frente") retF(g, 16, 22 + P.dy, 2, 20 - P.dy, "#e8dcc0"); },
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
    extraCorpo: (g, P, c) => { const x0 = P.vista === "lado" ? 15 : 13, x1 = P.vista === "lado" ? 25 : 26; retF(g, x0, 21 + P.dy, x1 - x0 + 1, 9 - P.dy, (X) => (X < x0 + 2 ? c.S : X > x1 - 2 ? c.s : c.S)); },
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
    extra: (g, P) => { if (P.vista === "frente") { retF(g, 16, 12 + P.dy, 3, 2, "#1e1a1a"); linF(g, 14, 10 + P.dy, 25, 9 + P.dy, "#1e1a1a"); } else if (P.vista === "lado") retF(g, 22, 12 + P.dy, 3, 2, "#1e1a1a"); },
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

  // Tipo de obstáculo por casa: o tipo fixo do mapa (bosque, muro da vila, marco; dados/mapas.js) ou o
  // sorteio por peso do bioma. Tipos com desenho próprio fora do bioma ficam em MARCOS.
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
        return m ? ID.COSTA + m : ID.AGUA + Math.floor(hash2(x, y, 2) * 4);
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
      const limite = def.res === 1 ? (chave.startsWith("ui_") ? 6 : 12) : chave.startsWith("fx_") ? 999 : LIMITE_CORES + 1;
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
      // só os que aparecem na área)
      if (/^(mk_portal_|pj_|in_|al_|mt_)/.test(chave)) continue;
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
