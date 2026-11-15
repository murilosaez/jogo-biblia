// =====================================================================
// sprites.js — motor da arte gerada em código ("Iluminura viva").
//
// O que mora aqui:
//   * o motor: Grade (camada de desenho em px de arte), registrar/pixels/canvas, rampa de 6 tons e
//     sombreamento com pontilhado só na transição, contorno colorido de 1 px, limite de cores, sombras e
//     variantes sob demanda, ganchos de humano/montado e pintores do tileset (tudo em Arte.motor);
//   * as tabelas que o jogo e os arquivos de arte leem: PALETA, BIOMAS, VISUAL_*, as cfgs dos humanos,
//     equipamento, montarias, a lista de chaves de itens, glifos e obstáculos;
//   * o que não foi redesenhado e é desenhado aqui mesmo: portais, setas, trilha, cais, pesca, balões de
//     NPC, sombras, pilar de luz, faixa do cartão de título;
//   * a reserva: um marcador por chave, o boneco e a montaria simples e o tileset antigo, que só aparecem
//     se um arte/*.js não carregar (e que os testes usam como base de comparação).
// A arte do jogo mora em arte/*.js (carregados depois deste arquivo): cada um registra por cima das
// mesmas chaves. Guia: docs/GUIA-DE-ARTE.md.
//
// Regras:
//   * 32 px de arte por casa; 1 px de arte = 1 px de mundo. def.w/def.h são em unidades de 2 px (Arte.PX).
//   * Luz de cima e da esquerda: realce em cima/esquerda, sombra embaixo/direita, sombra projetada para
//     a direita e para baixo.
//   * Contorno automático de 1 px, colorido pelo material vizinho e puxado ao sépia #2a1a14 (amigos,
//     itens) ou ao carmim #4a1416 (inimigos). Chão e decoração não têm contorno.
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
      // Máscara do contorno automático: 1 nos px que contorno() gravou. acabamento(), textura() e a
      // fusão de cores reconhecem o contorno por ela (o contorno é colorido: não dá para comparar a cor).
      this.borda = new Uint8Array(this.w * this.h);
      this.temBorda = false;
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
      if (this.temBorda) this.borda[Y * this.w + X] = 0; // pintado por cima do contorno (def.depois)
    }
    p(x, y, c) {
      x = Math.round(x);
      y = Math.round(y);
      if (!c || !this.dentro(x, y)) return;
      const cor = typeof c === "function" ? c(x, y) : c;
      if (!cor) return;
      const r = this.r;
      for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) {
        this.d[(y * r + j) * this.w + x * r + i] = cor;
        if (this.temBorda) this.borda[(y * r + j) * this.w + x * r + i] = 0;
      }
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
      for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) {
        this.d[(y * r + j) * this.w + x * r + i] = null;
        this.borda[(y * r + j) * this.w + x * r + i] = 0;
      }
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
    // Sombra projetada (camada própria, sem contorno): miolo com o alfa pedido e um anel de penumbra
    // com metade dele na borda, para a sombra não terminar num degrau duro.
    sombra(cx, cy, rx, ry, cor = "#1c1210", alfa = 0.3) {
      const c = comAlfa(cor, alfa), c2 = comAlfa(cor, alfa * 0.5), r = this.r;
      // o miolo é a elipse encolhida 1 px de arte (no mínimo 55% do raio)
      const kx = Math.max(0.55, 1 - 1 / Math.max(1, rx * r)), ky = Math.max(0.55, 1 - 1 / Math.max(1, ry * r));
      for (let Y = Math.floor((cy - ry) * r); Y <= Math.ceil((cy + ry) * r); Y++)
        for (let X = Math.floor((cx - rx) * r); X <= Math.ceil((cx + rx) * r); X++) {
          const nx = ((X + 0.5) / r - cx) / rx, ny = ((Y + 0.5) / r - cy) / ry;
          if (nx * nx + ny * ny > 1 || !this.dentroF(X, Y)) continue;
          const mx = nx / kx, my = ny / ky;
          this.s[Y * this.w + X] = mx * mx + my * my <= 1 ? c : c2;
        }
    }
    // 1 px de arte na camada de sombra (sem contorno), para sombras projetadas de forma livre (copa de
    // árvore, parede): alfa de 0 a 1; onde já há sombra fica a mais forte (as sombras não se somam).
    sombraPx(X, Y, alfa = 0.3, cor = "#1c1210") {
      X = Math.round(X); Y = Math.round(Y);
      if (!this.dentroF(X, Y) || !(alfa > 0)) return;
      const i = Y * this.w + X, c = comAlfa(cor, Math.min(1, alfa)), a = this.s[i];
      if (!a || parseInt(a.slice(7, 9) || "ff", 16) < parseInt(c.slice(7, 9) || "ff", 16)) this.s[i] = c;
    }
    // Contorno automático de 1 px, por fora da silhueta. Colorido (padrão): cada px toma a cor do
    // vizinho preenchido mais escuro, escurecida ~62% e puxada 35% para a tinta (sépia dos amigos,
    // carmim dos hostis); 10% mais clara quando a forma fica abaixo/à direita do px (lado da luz: cima
    // e esquerda). Com legado = true, a cor única de antes. Os px gravados entram na máscara `borda`.
    contorno(cor, legado = false) {
      if (!cor) return;
      const w = this.w, h = this.h, d = this.d, marcar = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (d[y * w + x]) continue;
          const o = x > 0 ? d[y * w + x - 1] : null, l = x < w - 1 ? d[y * w + x + 1] : null;
          const n = y > 0 ? d[(y - 1) * w + x] : null, s = y < h - 1 ? d[(y + 1) * w + x] : null;
          if (!o && !l && !n && !s) continue;
          if (legado) { marcar.push(y * w + x, cor); continue; }
          let viz = null, lum = Infinity;
          for (const c of [s, l, n, o]) if (c) { const v = luminancia(c); if (v < lum) { lum = v; viz = c; } }
          marcar.push(y * w + x, corDeContorno(viz, cor, (s || l) && !n && !o));
        }
      for (let k = 0; k < marcar.length; k += 2) { d[marcar[k]] = marcar[k + 1]; this.borda[marcar[k]] = 1; }
      this.temBorda = marcar.length > 0;
    }
    // Acabamento em px de arte (só na RES 2): realce de 1 px nas bordas viradas para a luz (cima e
    // esquerda) e meia-sombra nas viradas para baixo/direita, por dentro do contorno.
    // O contorno é reconhecido pela máscara `borda`. cor (opcional) só vale para o contorno legado de
    // cor única (def.contornoLegado): aí os traços internos nessa cor também contam como contorno.
    acabamento(cor = null) {
      if (this.r < 2) return;
      const w = this.w, h = this.h, d = this.d, b = this.borda, nova = d.slice();
      const fora = (x, y) => x < 0 || y < 0 || x >= w || y >= h || !d[y * w + x] || b[y * w + x] === 1 || d[y * w + x] === cor;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const c = d[y * w + x];
          if (!c || b[y * w + x] || c === cor || c.length > 7) continue;
          if (fora(x, y - 1) || fora(x - 1, y)) nova[y * w + x] = misturar(c, "#fff6e0", 0.16);
          else if (fora(x, y + 1) || fora(x + 1, y)) nova[y * w + x] = misturar(c, "#1c1210", 0.18);
        }
      this.d = nova;
    }
    // Textura fina (pelo, escama, couro): traços de 2 px de arte um pouco mais escuros ou claros,
    // espalhados por hash (sem "ruído de TV": nunca 2 traços colados).
    textura(semente = 0, protegida = null) {
      if (this.r < 2) return;
      const w = this.w, d = this.d, b = this.borda;
      for (let y = 1; y < this.h - 1; y++)
        for (let x = 1; x < w - 2; x++) {
          const c = d[y * w + x];
          if (!c || b[y * w + x] || b[y * w + x + 1] || c === protegida || c.length > 7 || d[y * w + x + 1] !== c) continue;
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
          const m = this.borda[a]; this.borda[a] = this.borda[b]; this.borda[b] = m;
        }
    }
    final() {
      return this.d.map((c, i) => c || this.s[i]);
    }
  }

  // Cor do contorno colorido (ver Grade.contorno). viz = cor do vizinho preenchido; tinta = sépia,
  // carmim ou a cor pedida em def.contorno; luz = px do lado da luz (cima/esquerda da forma).
  const cacheLum = new Map();
  function luminancia(c) {
    let v = cacheLum.get(c);
    if (v === undefined) { const k = hexRgb(c); v = k[0] * 0.3 + k[1] * 0.59 + k[2] * 0.11; if (cacheLum.size < 50000) cacheLum.set(c, v); }
    return v;
  }
  const cacheContorno = new Map();
  function corDeContorno(viz, tinta, luz) {
    const id = viz + tinta + (luz ? 1 : 0);
    let r = cacheContorno.get(id);
    if (r) return r;
    r = misturar(misturar(viz.slice(0, 7), "#1c1210", 0.62), tinta.slice(0, 7), 0.35);
    if (luz) r = misturar(r, "#fff6e0", 0.1);
    if (cacheContorno.size < 50000) cacheContorno.set(id, r);
    return r;
  }

  // Rampa de 6 tons (escuro → claro, como pede tom()/sombrear()) a partir da cor base, com o matiz
  // deslocado: a luz puxa para o creme quente e a sombra para o púrpura-sépia (nada de cinza). A base
  // fica no índice 3. tipo ajusta o contraste: "pano" (padrão), "pele", "pelo", "couro", "madeira",
  // "pedra", "folha" e "metal" (mais contraste e realce quase branco).
  const TIPOS_RAMPA = {
    pano: { luz: "#fff2cc", sombra: "#2e1a2a", funda: "#1a0e16", k: 1 },
    pele: { luz: "#ffe6c4", sombra: "#4a2030", funda: "#2a1018", k: 0.9 },
    pelo: { luz: "#f6e2b8", sombra: "#2a1a26", funda: "#160c12", k: 1.05 },
    couro: { luz: "#f2cf9a", sombra: "#2a1620", funda: "#160a10", k: 1 },
    madeira: { luz: "#f4d8a0", sombra: "#2a1820", funda: "#180c10", k: 1 },
    pedra: { luz: "#f4ecd8", sombra: "#2a2434", funda: "#16121c", k: 0.95 },
    folha: { luz: "#f0f0a8", sombra: "#16303a", funda: "#0e1a22", k: 1.05 },
    metal: { luz: "#fffbea", sombra: "#22203a", funda: "#0e0c1a", k: 1.3 },
  };
  const cacheRampa6 = new Map();
  function rampa6(base, tipo = "pano") {
    const id = base + tipo;
    let r = cacheRampa6.get(id);
    if (r) return r;
    const t = TIPOS_RAMPA[tipo] || TIPOS_RAMPA.pano, k = t.k, m = (c, v) => misturar(base, c, Math.min(0.92, v * k));
    r = [m(t.funda, 0.62), m(t.sombra, 0.44), m(t.sombra, 0.22), base.slice(0, 7), m(t.luz, 0.24), m(t.luz, 0.48)];
    if (cacheRampa6.size < 5000) cacheRampa6.set(id, r);
    return r;
  }
  // Sombreado contínuo por px de arte: l em [-1, 1] (-1 sombra, 1 luz) escolhe o tom da rampa (escuro →
  // claro, qualquer tamanho). Com pontilhar (padrão), a faixa de transição entre dois tons vizinhos é
  // pontilhada pela matriz de Bayer 4 × 4 na posição (X, Y) do px; fora dela o tom é chapado.
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const FAIXA_PONTILHADO = 0.2; // meia largura da faixa, em fração de um tom
  function sombrear(rampa, l, X = 0, Y = 0, pontilhar = true) {
    const n = rampa.length, p = Math.max(0, Math.min(n - 1, (l * 0.5 + 0.5) * (n - 1)));
    const i = Math.floor(p), t = p - i;
    if (i >= n - 1) return rampa[n - 1];
    if (!pontilhar) return rampa[t < 0.5 ? i : i + 1];
    if (t <= 0.5 - FAIXA_PONTILHADO) return rampa[i];
    if (t >= 0.5 + FAIXA_PONTILHADO) return rampa[i + 1];
    return rampa[(t - (0.5 - FAIXA_PONTILHADO)) / (2 * FAIXA_PONTILHADO) > BAYER4[(Y & 3) * 4 + (X & 3)] ? i + 1 : i];
  }
  // Volume esférico por px, para elipF(g, cx, cy, rx, ry, esferaPx(rampa)): luz de cima e da esquerda.
  const esferaPx = (rampa, vies = 0, pontilhar = true) => (nx, ny, X, Y) => sombrear(rampa, -(0.55 * nx + 0.8 * ny) + vies, X, Y, pontilhar);
  // Pano por px numa faixa de colunas [x0, x1], para retF(g, X, Y, W, H, panoPx(rampa, x0, x1)): luz à
  // esquerda, sombra à direita. o = { vies, dobras (nº de dobras verticais), y0, y1 (escurece para baixo) }.
  function panoPx(rampa, x0, x1, o = {}) {
    const larg = Math.max(1, x1 - x0), vies = o.vies || 0, dobras = o.dobras || 0, pont = o.pontilhar !== false;
    return (X, Y) => {
      const t = (X - x0) / larg; // 0 à esquerda, 1 à direita
      let l = 0.75 - 1.5 * t + vies;
      if (dobras) l += Math.cos(t * dobras * 2 * Math.PI) * 0.22 - 0.1;
      if (o.y1 > o.y0) l -= ((Y - o.y0) / (o.y1 - o.y0)) * 0.35;
      return sombrear(rampa, l, X, Y, pont);
    };
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
  //
  // Contrato novo (arte/*.js; ver docs/GUIA-DE-ARTE.md, "Contrato"): direcoes = 3 (lado, frente,
  // costas), quadrosPorVista = 8 e quadros = direcoes × quadrosPorVista; ciclo (quadros do passo),
  // quadroAcao ([antecipação, golpe]), sombra { w, h } em px, alturaCabeca em px de mundo e
  // variante(porte, tinta) para os raros. Sem quadrosPorVista, vale o legado (5 por vista).
  // Registrar por cima de uma chave troca o desenho: os caches dela são apagados.
  // -------------------------------------------------------------------
  const PIXEL_PATTERNS = {};
  const cachePixels = new Map();
  const cacheURL = new Map();
  function limparCaches(chave) {
    for (const id of cachePixels.keys()) if (id.startsWith(chave + "#")) cachePixels.delete(id);
    for (const id of cacheURL.keys()) if (id.includes(":" + chave + ":")) cacheURL.delete(id);
  }
  function registrar(chave, def) {
    if (def.direcoes && def.quadrosPorVista && !def.quadros) def.quadros = def.direcoes * def.quadrosPorVista;
    def.quadros = def.quadros || (def.quadrosLinhas ? def.quadrosLinhas.length : 1);
    def.origem = def.origem || [0.5, 1];
    if (def.contorno === undefined) def.contorno = "amigo";
    if (def.res === undefined) def.res = /^(ui_|hb_|of_)/.test(chave) ? 1 : RES;
    if (PIXEL_PATTERNS[chave]) limparCaches(chave);
    PIXEL_PATTERNS[chave] = def;
    return def;
  }

  // Marcador de reserva: as chaves que arte/*.js redesenha continuam registradas aqui só com os campos que o
  // jogo e os pacotes de arte leem da def (célula, quadros, origem, obstaculo, alto…). O desenho é um losango
  // discreto, que só aparece se o arquivo de arte daquela família não carregar.
  function marcador(g) {
    const cx = g.w >> 1, cy = g.h >> 1, r = Math.max(1, Math.min(6, (Math.min(g.w, g.h) >> 1) - 2));
    for (let j = -r; j <= r; j++) for (let i = -(r - Math.abs(j)); i <= r - Math.abs(j); i++) g.fino(cx + i, cy + j, Math.abs(i) + Math.abs(j) === r ? "#5a3a24" : "#b08a5a");
  }
  const reserva = (chave, def) => registrar(chave, Object.assign({ desenhar: marcador }, def));

  // Limite de cores do miolo de um sprite (os px do contorno não contam nem são fundidos).
  const LIMITE_CORES = 64; // arte do mundo, em 32 px por casa
  const LIMITE_UI = 16, LIMITE_GLIFO = 24; // glifos ui_ e hb_/of_ (em qualquer resolução)
  function limiteDe(chave, def) {
    if (def.limiteCores) return def.limiteCores;
    if (chave.startsWith("ui_")) return LIMITE_UI;
    if (/^(hb_|of_)/.test(chave) || def.res === 1) return LIMITE_GLIFO;
    return chave.startsWith("fx_") ? 0 : LIMITE_CORES; // efeitos: sem fusão
  }

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
    // contornoLegado: o traço de cor única de antes, reconhecido também pela cor (traços internos)
    const legado = def.contornoLegado ? corContorno : null;
    // textura fina automática: só nas criaturas legadas; no contrato novo (quadrosPorVista) o desenho já
    // traz o pelo px a px, e ela só entra se a def pedir (textura: true)
    if (def.textura ?? (def.res > 1 && /^(in_|al_|mt_)/.test(chave) && !def.humano && !def.quadrosPorVista)) g.textura(sementeDe(chave), legado);
    g.contorno(corContorno, !!def.contornoLegado);
    if (corContorno && def.acabamento !== false) g.acabamento(legado);
    if (def.depois) def.depois(g, q);
    const r = { w: g.w, h: g.h, res: def.res, data: reduzirCores(g.final(), limiteDe(chave, def), g.borda, legado), borda: g.borda };
    cachePixels.set(id, r);
    return r;
  }

  // Limita o número de cores: funde a cor mais rara na vizinha mais próxima. Os px do contorno (máscara
  // borda) não contam nem são fundidos; no contorno legado, a cor dele (protegida) também não.
  function reduzirCores(data, limite, borda = null, protegida = null) {
    if (!limite) return data;
    const conta = new Map();
    for (let i = 0; i < data.length; i++) { const c = data[i]; if (c && !(borda && borda[i])) conta.set(c, (conta.get(c) || 0) + 1); }
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
    return data.map((c, i) => (c && !(borda && borda[i]) && troca.has(c) ? troca.get(c) : c));
  }

  // px de tela por px de arte para uma escala dada em px de tela por unidade (inteiro, no mínimo 1).
  const escalaArte = (px, escala) => Math.max(1, Math.round(escala / (px.res || 1)));
  // Desenha um quadro num contexto 2D na posição (ox, oy) em px de tela.
  // Na escala 1 (a do mundo: 1 px de arte por px de textura) grava o quadro de uma vez com ImageData;
  // nas outras, um retângulo por px. putImageData substitui a área do quadro (não mistura): os chamadores
  // pintam sempre num canvas novo.
  const cacheRGBA = new Map();
  function rgbaDe(c) {
    let v = cacheRGBA.get(c);
    if (!v) { v = hexRgb(c); if (cacheRGBA.size < 50000) cacheRGBA.set(c, v); }
    return v;
  }
  function pintarPixels(ctx, px, ox, oy, escala) {
    if (escala === 1 && ctx.createImageData && ctx.putImageData) {
      const img = ctx.createImageData(px.w, px.h), b = img.data, n = px.w * px.h;
      for (let i = 0; i < n; i++) {
        const c = px.data[i];
        if (!c) continue;
        const v = rgbaDe(c), o = i * 4;
        b[o] = v[0]; b[o + 1] = v[1]; b[o + 2] = v[2]; b[o + 3] = v[3];
      }
      ctx.putImageData(img, ox, oy);
      return;
    }
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
  // Humanos: o desenho é de arte/humano.js + arte/humano-equip.js (célula 48 × 64 px, 3 vistas × 8 quadros),
  // ativado por definirHumano(spec). Aqui ficam o que esses arquivos e o jogo leem: as cfgs de cada humano
  // (HUMANOS), as cores (coresHumano), as tabelas de equipamento (ACESSORIOS, ARMADURAS, LAMINAS,
  // CORES_ESCUDO, ARCOS), as primitivas em px e um boneco de reserva simples (40 × 48 px, 3 vistas × 5 quadros),
  // que é o que definirHumano(null) devolve e o que aparece se os arquivos de arte não carregarem.
  // Cores (letras): H cabelo, S/s pele e sombra, B barba, R/r/d tronco (claro, médio, escuro), P/p/q parte
  // de baixo (sem elas, a do tronco), A cinto e detalhes, F sandálias, V/W véu.
  // -------------------------------------------------------------------
  const VISTAS = ["lado", "frente", "costas"];
  const QUADROS_POR_VISTA = 5;
  const escuro = (c, t = 0.28) => misturar(c, "#1c1210", t);
  const claro = (c, t = 0.2) => misturar(c, "#fff6e0", t);
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
  // Máscara de px (chave Y * LM + X, com LM = 1024: cabe qualquer célula) para formas com volume: bastão de largura w entre dois pontos.
  const LM = 1024;
  function bastao(mask, X0, Y0, X1, Y1, w) {
    const n = Math.max(Math.abs(X1 - X0), Math.abs(Y1 - Y0)) || 1, h = w >> 1;
    for (let t = 0; t <= n; t++) {
      const x = Math.round(X0 + ((X1 - X0) * t) / n), y = Math.round(Y0 + ((Y1 - Y0) * t) / n);
      for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) if (x - h + i >= 0 && y - h + j >= 0) mask.add((y - h + j) * LM + x - h + i);
    }
    return mask;
  }
  // Pinta a máscara com a rampa: realce na borda de cima/esquerda, sombra na de baixo/direita.
  function pintarMascara(g, mask, R) {
    const tem = (X, Y) => mask.has(Y * LM + X);
    for (const k of mask) {
      const X = k % LM, Y = (k - X) / LM;
      const dir = !tem(X + 1, Y), baixo = !tem(X, Y + 1), esq = !tem(X - 1, Y), cima = !tem(X, Y - 1);
      g.fino(X, Y, dir && baixo ? R[3] : dir || baixo ? R[2] : esq || cima ? R[0] : R[1]);
    }
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

  // Acessórios que uma cfg pode citar (o desenho de cada um está em arte/humano-equip.js; nome que só
  // exista aqui cai na reserva de lá, um bastão na mão).
  const ACESSORIOS = {};
  for (const nome of ["cajado_alto", "cajado_curvo", "cajado_curto", "lanca", "lanca_longa", "ankh", "espada", "espada_curva", "porrete", "escudo_redondo", "escudo_alto", "escudo_oval",
    "arco_costas", "arco_mao", "capa", "capa_larga", "turbante", "elmo", "faixa", "bandana", "nemes",
    "colar", "peitoral", "bolsa", "odre", "saco", "jarro", "fardo", "corda", "rede", "shofar", "pele_leopardo", "estola", "brilho", "funda", "remo"]) ACESSORIOS[nome] = {};

  // Armaduras do jogador: a túnica de pano só troca as cores da veste (veste, gola); couro e escamas são
  // desenhados por cima do tronco em arte/humano-equip.js.
  const ARMADURAS = {
    tunica_pano: { veste: { R: "#c9d4e0", r: "#a8b8c8", d: "#7f90a4" }, gola: "#3b5a9a" },
    armadura_couro: {},
    couraca_escamas: {},
  };

  // Boneco de reserva (40 × 48 px): cabeça, veste nas cores da cfg, pernas e pés; no passo as pernas abrem.
  function desenharHumano(g, cfg, quadro) {
    const vista = VISTAS[Math.floor(quadro / QUADROS_POR_VISTA)] || "lado", q = quadro % QUADROS_POR_VISTA;
    const c = coresHumano(cfg), dy = q >= 1 && q <= 3 ? 1 : 0, passo = q === 2 ? 2 : q === 3 ? -2 : 0;
    const longa = cfg.molde !== "curta", lado = vista === "lado", x0 = lado ? 15 : 13, w = lado ? 10 : 14;
    for (const [x, d] of [[x0 + 1, passo], [x0 + w - 5, -passo]]) {
      retF(g, x + (lado ? d : 0), 34, 4, 9 - (lado ? 0 : Math.max(0, d)), c.pele[1]);
      retF(g, x + (lado ? d : 0), 43 - (lado ? 0 : Math.max(0, d)), lado ? 5 : 4, 2, c.sand[1]);
    }
    retF(g, x0, 22 + dy, w, (longa ? 20 : 13) - dy, (X) => (X < x0 + 2 ? c.tronco[0] : X >= x0 + w - 3 ? c.tronco[2] : c.tronco[1]));
    retF(g, x0, 31 + dy, w, 2, c.cinto[1]);
    elipF(g, 20, 14.5 + dy, lado ? 6.5 : 7.5, 7.5, (nx, ny) => (vista === "costas" || ny < -0.35 || (lado && nx < -0.2) ? c.cab[1] : nx + ny > 0.9 ? c.pele[2] : c.pele[1]));
    if (vista !== "costas") for (const x of lado ? [23] : [17, 22]) g.fino(x, 15 + dy, c.o);
    if (q === 4) retF(g, lado ? x0 + w : x0 - 3, 22, 3, 3, c.pele[1]); // mão erguida na ação
  }

  // Registra um humano: cfg = { molde, cores, barba, cabelo, porte, gola, capuz, mangaCor, armadura,
  // acessorios, barra (barra da veste na cor do cinto), hostil }.
  //
  // Ganchos (Arte.motor): HUMANOS guarda a cfg de cada humano registrado e MONTADOS a de cada jogador
  // montado já gerado. definirHumano(spec) / definirMontado(spec) trocam o esqueleto: re-registram
  // todas essas chaves com a spec e fazem as próximas (garantirJogador) nascerem com ela.
  //   spec = { w, h (em unidades), quadrosPorVista, ciclo, quadroAcao, busto, retratoQuadro, sombra,
  //            alturaCabeca, desenhar(g, cfg, quadro[, montaria]) } + qualquer campo de def (limiteCores…).
  // A spec recebe a cfg ORIGINAL (cores, molde, armadura, acessorios…): é ela quem aplica ARMADURAS,
  // ACESSORIOS etc. definirHumano(null) / definirMontado(null) voltam ao boneco e à montaria de reserva.
  const HUMANOS = {}, MONTADOS = {};
  let specHumano = null, specMontado = null;
  function defDeSpec(spec, extra, desenhar) {
    const def = Object.assign({}, spec, extra);
    def.direcoes = VISTAS.length;
    def.quadrosPorVista = spec.quadrosPorVista || 8;
    def.quadros = def.direcoes * def.quadrosPorVista;
    def.humano = true;
    if (def.retratoQuadro === undefined) def.retratoQuadro = def.quadrosPorVista; // de frente, parado
    def.desenhar = desenhar;
    return def;
  }
  function definirHumano(spec) {
    if (spec && (typeof spec.desenhar !== "function" || !spec.w || !spec.h)) throw new Error("definirHumano: a spec precisa de w, h e desenhar(g, cfg, quadro)");
    specHumano = spec || null;
    const chaves = Object.keys(HUMANOS);
    for (const chave of chaves) humano(chave, HUMANOS[chave]);
    return chaves.length;
  }
  function definirMontado(spec) {
    if (spec && (typeof spec.desenhar !== "function" || !spec.w || !spec.h)) throw new Error("definirMontado: a spec precisa de w, h e desenhar(g, cfg, quadro, montaria)");
    specMontado = spec || null;
    const chaves = Object.keys(MONTADOS);
    for (const chave of chaves) registrarMontado(chave, MONTADOS[chave].cfg, MONTADOS[chave].tipo);
    return chaves.length;
  }
  function humano(chave, cfg) {
    HUMANOS[chave] = cfg;
    if (specHumano) {
      const spec = specHumano;
      return registrar(chave, defDeSpec(spec, { contorno: cfg.hostil ? "hostil" : "amigo", origem: [0.5, 1] }, (g, quadro) => spec.desenhar(g, cfg, quadro)));
    }
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
  // Cores do visual (JGB-49): cabeça, tronco, pernas e detalhe, ids da paleta CORES_VISUAL
  // (dados/cosmeticos.js); null ou ausente = a cor do traje (ou a do boneco sem traje).
  const PARTES_COR = ["cabeca", "tronco", "pernas", "detalhe"];
  const corDaPaleta = (id) => (id && typeof CORES_VISUAL !== "undefined" && CORES_VISUAL.find((x) => x.id === id)?.cor) || null;
  function chaveJogador(eq = {}, visual = {}) {
    const cores = PARTES_COR.map((k) => (corDaPaleta(visual.cores?.[k]) ? visual.cores[k] : ""));
    const partes = [base(eq.arma), eq.arco ? base(eq.arco) : "", base(eq.escudo), base(eq.armadura), visual.traje || "", visual.montaria || ""];
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
    const arco = base(eq.arco);
    if (arco === "funda") acessorios.push(["shofar", ["#8a6a42", "#5a3a24", "#a8916a"]]);
    else if (arco) acessorios.push(["arco_costas", ARCOS[arco] || ARCOS.arco_madeira]);
    if (eq.arma) acessorios.push(["espada", LAMINAS[base(eq.arma)] || LAMINAS.espada_ferro]);
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
  // Montarias (só visuais): jumento, cavalo, camelo e carro. O desenho é de arte/montado.js (célula 72 × 96 px,
  // 3 vistas × 8 quadros, ativado por definirMontado) sobre o esqueleto de arte/quadrupede.js. Aqui ficam as
  // cores de cada montaria (MONTARIAS_ARTE; a geometria é do desenho de reserva antigo e não é mais lida) e uma
  // montaria de reserva (56 × 64 px, 3 vistas × 5 quadros) com o boneco de reserva em cima.
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
  // Montaria de reserva: corpo, pescoço e cabeça em elipses na cor do pelo, quatro pernas; o carro é uma caixa
  // de madeira com roda. Devolve [x, y] do quadril do cavaleiro.
  function desenharMontaria(g, tipo, vista, q) {
    const a = MONTARIAS_ARTE[tipo] || MONTARIAS_ARTE.jumento, P = a.pelo, lado = vista === "lado";
    const dy = q >= 1 && q <= 3 ? 1 : 0, passo = q === 2 ? 2 : q === 3 ? -2 : 0;
    const tomP = (nx, ny) => (ny > 0.5 ? P[2] : nx + ny < -0.5 ? P[0] : P[1]);
    if (tipo === "carro") {
      retF(g, 12, 38 + dy, 32, 14, (X, Y) => (Y < 40 + dy ? "#c8a070" : X > 40 ? "#6a4a2e" : "#a8784a"));
      elipF(g, lado ? 20 : 28, 54, 7, 7, (nx, ny) => (nx * nx + ny * ny > 0.55 ? "#5a3a24" : "#a8784a"));
      return [28, 45 + dy];
    }
    for (const [x, d] of lado ? [[14, passo], [20, -passo], [34, -passo], [39, passo]] : [[21, passo], [32, -passo]])
      retF(g, x + (lado ? d : 0), 46, 3, CHAO_MT - 46 - (lado ? 0 : Math.max(0, d)), x === 20 || x === 34 ? P[3] : P[2]);
    if (lado) { elipF(g, 27, 42 + dy, 14, 7, tomP); elipF(g, 42, 33 + dy, 4.5, 8, tomP); elipF(g, 46, 26 + dy, 5, 4, tomP); return [25, 36 + dy]; }
    elipF(g, 28, 42 + dy, 9, 9, tomP);
    if (vista === "frente") elipF(g, 28, 48 + dy, 4.5, 6, tomP); else elipF(g, 28, 30 + dy, 4, 5, tomP);
    return [28, 36 + dy];
  }
  // Montaria sozinha (para a loja): de lado, parada.
  for (const tipo of ["jumento", "cavalo", "camelo", "carro"])
    registrar("mt_" + tipo, { w: W_MT, h: H_MT, quadros: 1, contorno: "amigo", origem: [0.5, 1], desenhar(g) { desenharMontaria(g, tipo, "lado", 0); } });

  // Jogador montado: arte/montado.js pela spec; sem ela, a montaria de reserva com o boneco de reserva em cima.
  function registrarMontado(chave, cfg, tipo) {
    MONTADOS[chave] = { cfg, tipo };
    if (specMontado) {
      const spec = specMontado, cfgM = Object.assign({}, cfg, { montado: tipo !== "carro", montaria: tipo });
      return registrar(chave, defDeSpec(spec, { contorno: "amigo", origem: [0.5, 1], montado: tipo }, (g, quadro) => spec.desenhar(g, cfgM, quadro, tipo)));
    }
    const cav = Object.assign({}, cfg, { montado: tipo !== "carro" });
    return registrar(chave, {
      w: W_MT, h: H_MT, quadros: QUADROS_POR_VISTA * VISTAS.length, direcoes: VISTAS.length, contorno: "amigo", origem: [0.5, 1],
      humano: true, montado: tipo, retratoQuadro: QUADROS_POR_VISTA, busto: [6, 0, 16, 14], limiteCores: 32,
      desenhar(g, quadro) {
        const vista = VISTAS[Math.floor(quadro / QUADROS_POR_VISTA)], q = quadro % QUADROS_POR_VISTA;
        const [sx, sy] = desenharMontaria(g, tipo, vista, q);
        const r = new Grade(20, 24);
        desenharHumano(r, cav, quadro - (q >= 1 && q <= 3 ? q : 0)); // montado não dá passos: balança com a montaria
        const ox = Math.round(sx) - 20, oy = Math.round(sy) - (tipo === "carro" ? 45 : 33);
        for (let Y = 0; Y < r.h; Y++) for (let X = 0; X < r.w; X++) { const c = r.d[Y * r.w + X]; if (c) g.fino(X + ox, Y + oy, c); }
      },
    });
  }
  // ----- NPCs (§6.4) -----
  humano("pj_eliabe", {
    molde: "manto", cabelo: "curto",
    cores: { H: "#e8dcc0", S: "#cf9466", s: "#b07548", B: "#e8dcc0", R: "#b08a5a", r: "#8a6a42", d: "#5e4630", A: "#8e2a1f", F: "#5e4630" },
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
  // O desenho (4 variantes de casa e de tenda, 2 de banca) está em arte/flora.js.
  reserva("es_casa", { w: 52, h: 52, quadros: 4, origem: [0.5, 1], estrutura: true, contorno: "amigo" });

  reserva("es_tenda", { w: 52, h: 44, quadros: 4, origem: [0.5, 1], estrutura: true, contorno: "amigo" });
  reserva("es_banca", { w: 52, h: 46, quadros: 2, origem: [0.5, 1], estrutura: true, contorno: "amigo" });
  reserva("es_poco", { w: 20, h: 28, quadros: 1, origem: [0.5, 1], estrutura: true, contorno: "amigo" });

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
  // Itens: célula 32 × 32 px (16 × 16 unidades), origem [0.5, 0.75]. O desenho de cada um está em arte/itens.js,
  // que registra por cima com a mesma chave; as chamadas item("…") ficam aqui porque são a lista de chaves de
  // item que os testes e arte/itens.js conferem.
  // -------------------------------------------------------------------
  function item(chave, extra = {}) {
    return reserva(chave, Object.assign({ w: 16, h: 16, contorno: "amigo", origem: [0.5, 0.75] }, extra));
  }
  item("pocao");
  item("pocao_fe");
  item("veneno_escorpiao");
  item("erva");
  item("odre_agua");
  item("espada_madeira");
  item("espada_ferro");
  item("espada_temperada");
  item("escudo_madeira");
  item("escudo_bronze");
  // Escudo de ferro (troca de pontos de tarefa): ferro frio, aro escuro, 4 rebites e umbo.
  item("escudo_ferro");
  item("tunica_pano");
  item("armadura_couro");
  // Couraça de escamas (troca de pontos de tarefa): peitoral de bronze escuro; cada escama é um brilho
  // com a sombra logo abaixo, em fileiras desencontradas.
  item("couraca_escamas");
  item("arco_madeira");
  item("arco_composto");
  // Funda: correia de couro com a bolsa da pedra no meio.
  item("funda");
  item("flecha");
  item("pele_lobo");
  item("insignia_bandido");
  // Saques das tabelas das criaturas.
  item("presa_lobo");
  item("ferrao_escorpiao");
  item("linho_egipcio");
  item("ponta_lanca");
  item("bracelete_cobre");
  item("pena_ave");
  item("couro_grosso");
  item("carapaca");
  item("amuleto_faianca");
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
  item("peixe");
  // ----- Ofícios (JGB-24): matérias-primas e o que se fabrica -----
  item("madeira");
  item("argila");
  item("minerio_cobre");
  item("resina");
  item("peixe_grande");
  item("lingote_bronze");
  item("tecido_linho");
  item("frasco_barro");
  item("oleo_peixe");
  item("peixe_seco");
  item("peixe_defumado");
  item("jarro_barro");
  item("lamparina");
  item("anfora");
  item("incenso");
  item("oleo_uncao");
  item("manto_bordado");
  item("moeda", { quadros: 4 });
  item("moeda_pilha");
  const ALIAS_ITEM = { odre: "odre_agua", flechas: "flecha", moedas: "moeda" };
  // Item com raridade ("espada_ferro@raro.dano2") usa a arte do item base.
  const aliasItem = (id) => {
    const base = typeof id === "string" ? id.split("@")[0] : id;
    return ALIAS_ITEM[base] || base;
  };

  // -------------------------------------------------------------------
  // Glifos: ui_ (interface), hb_ (habilidades) e of_ (ofícios). O desenho de cada um está em arte/icones.js
  // (ui_ em 16 × 16 px, hb_/of_ em 32 × 32 px); as chamadas glifo("…") ficam aqui porque são a lista de chaves
  // que os testes e arte/icones.js conferem.
  // -------------------------------------------------------------------
  function glifo(chave, lado = 8) {
    return reserva(chave, { w: lado, h: lado, contorno: null, origem: [0.5, 0.5] });
  }
  glifo("ui_coracao");
  glifo("ui_louro");
  glifo("ui_candeia");
  glifo("ui_moeda");
  glifo("ui_mochila");
  glifo("ui_bolsa");
  glifo("ui_pergaminho");
  glifo("ui_espadas");
  glifo("ui_personagem");
  // Pena e rosa-dos-ventos aparecem sobre couro escuro (barra do topo, abas
  // do celular) e sobre pergaminho: todo traço tem miolo claro e contorno
  // de tinta, para ler nos dois fundos.
  glifo("ui_registro");
  glifo("ui_rosa");
  glifo("ui_tela_cheia");
  glifo("ui_talentos");
  // Ofícios (JGB-24): um glifo por ofício (of_<icone> em dados/oficios.js).
  glifo("of_pescador");
  glifo("of_ferreiro");
  glifo("of_carpinteiro");
  glifo("of_oleiro");
  glifo("of_tecelao");
  glifo("of_perfumista");
  glifo("ui_ajuda");
  glifo("ui_fechar");
  glifo("ui_menu");
  glifo("ui_cadeado");
  glifo("ui_losango");
  glifo("ui_escudo_bloq");
  glifo("ui_gota");
  glifo("ui_estrela_chefe");
  glifo("ui_ancora");
  glifo("ui_peixe");
  glifo("ui_dpad_seta");
  glifo("ui_atacar");
  glifo("ui_flecha");
  glifo("ui_falar");
  glifo("ui_orar");
  // Caçadas: tabuinha de contagem (riscos cortados por um traço), selo de argila dos pontos de tarefa e alforje.
  glifo("ui_cacada");
  glifo("ui_selo");
  glifo("ui_alforje");
  // Bestiário (livro de capa de couro com a pegada dourada), amuleto da família e ampulheta do analisador.
  glifo("ui_bestiario");
  glifo("ui_amuleto");
  // Habilidades das vocações (JGB-20): um glifo por ícone (hb_<icone> em dados/vocacoes.js).
  glifo("hb_espada");
  glifo("hb_escudo");
  glifo("hb_grito");
  glifo("hb_escudo_golpe");
  glifo("hb_investida");
  glifo("hb_redemoinho");
  glifo("hb_coracao");
  glifo("hb_chama");
  glifo("hb_muralha");
  glifo("hb_pedra");
  glifo("hb_testa");
  glifo("hb_salto");
  glifo("hb_chuva");
  glifo("hb_pedra_afiada");
  glifo("hb_duas_pedras");
  glifo("hb_olho");
  glifo("hb_pedra_grande");
  glifo("hb_cura");
  glifo("hb_candelabro");
  glifo("hb_incenso");
  glifo("hb_agua");
  glifo("hb_trombeta");
  glifo("hb_escudo_luz");
  glifo("hb_maos");
  glifo("hb_altar");
  glifo("hb_harpa");
  glifo("hb_nuvem");
  glifo("hb_gota");
  glifo("hb_raio");
  glifo("hb_balanca");
  glifo("hb_onda");
  glifo("hb_carro");
  glifo("hb_cao");
  glifo("hb_cajado");
  glifo("hb_ovelha");
  glifo("hb_presa");
  glifo("hb_rebanho");
  glifo("hb_vara");
  glifo("hb_aprisco");
  // Maná (JGB-11): jarro de barro (o ômer) com flocos brancos caindo.
  glifo("ui_mana");
  glifo("ui_ampulheta");

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
  reserva("mk_barco", { w: 26, h: 22, quadros: 2, origem: [0.5, 1], contorno: "amigo" });
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
  // Sombra de chão sob medida (def.sombra = { w, h } em px de arte): registra `fx_sombra_<w>x<h>` na
  // primeira vez e devolve a chave (w e h arredondados para par). O jogo gera a textura por garantirTextura.
  function garantirSombra(w, h) {
    const W = Math.max(4, Math.round((w || 0) / 2) * 2), H = Math.max(2, Math.round((h || 0) / 2) * 2);
    const chave = `fx_sombra_${W}x${H}`;
    if (!PIXEL_PATTERNS[chave]) registrar(chave, { w: W / 2, h: H / 2, contorno: null, origem: [0.5, 0.5], desenhar: (g) => g.sombra(W / 4, H / 4, W / 4, H / 4, "#1c1210", 0.3) });
    return chave;
  }
  // Raro nomeado sem escala fracionária nem tinta por cima: se a def tiver variante(porte, tinta), ela
  // devolve a def (ou só os campos que mudam) do sprite já no porte e na cor pedidos; registra em
  // `<chave>~v:<tinta>.<porte × 100>` e devolve essa chave. Sem variante na def, devolve null (o jogo
  // continua com setScale e setTint).
  function garantirVariante(chave, { escala = 1, tinta = null } = {}) {
    const def = PIXEL_PATTERNS[chave];
    if (!def || typeof def.variante !== "function") return null;
    const porte = Math.round((escala || 1) * 100);
    const nova = `${chave}~v:${String(tinta || "").replace("#", "")}.${porte}`;
    if (PIXEL_PATTERNS[nova]) return nova;
    const v = def.variante(porte / 100, tinta || null);
    if (!v) return null;
    registrar(nova, Object.assign({}, def, v, { varianteDe: chave }));
    return nova;
  }
  registrar("fx_sombra_lobo", { w: 18, h: 5, contorno: null, origem: [0.5, 0.5], desenhar: (g) => g.elip(9, 2.5, 8, 1.6, comAlfa("#1c1210", 0.3)) });
  reserva("fx_anel", { w: 18, h: 9, quadros: 4, contorno: null, origem: [0.5, 0.5] });
  reserva("fx_anel_amigo", { w: 18, h: 9, quadros: 1, contorno: null, origem: [0.5, 0.5] });
  reserva("fx_corte", { w: 16, h: 16, quadros: 2, contorno: null, origem: [0.5, 0.5] });
  reserva("fx_faisca", { w: 8, h: 8, quadros: 3, contorno: null, origem: [0.5, 0.5] });
  reserva("fx_brilho", { w: 5, h: 5, quadros: 3, contorno: null, origem: [0.5, 0.5] });
  reserva("fx_aura", { w: 28, h: 12, contorno: null, origem: [0.5, 0.5], quadros: 1 });
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
  reserva("fx_luz_quente", { w: 24, h: 8, contorno: null, origem: [0.5, 0.5], quadros: 1 });
  reserva("fx_bolha", { w: 3, h: 3, contorno: null, origem: [0.5, 0.5], quadros: 1 });
  reserva("fx_borboleta", { w: 5, h: 4, quadros: 2, contorno: null, origem: [0.5, 0.5] });
  reserva("fx_fogueira", { w: 14, h: 14, quadros: 3, origem: [0.5, 1], contorno: "amigo" });
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

  reserva("dc_tapete", { w: 16, h: 16, contorno: null, origem: [0.5, 0.5], quadros: 1 });
  reserva("dc_esteira", { w: 16, h: 16, contorno: null, origem: [0.5, 0.5], quadros: 1 });
  reserva("dc_rede", { w: 16, h: 16, contorno: null, origem: [0.5, 0.5], quadros: 1 });
  reserva("dc_fogo_apagado", { w: 16, h: 16, contorno: null, origem: [0.5, 0.5], quadros: 1 });

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
      luz: { cor: "#ffd08a", alfa: 0.1, modo: "screen" }, vinheta: { cor: "#1a2410", forca: 0.18 }, sombra: "#2a2a1a",
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
      luz: { cor: "#ffbf6a", alfa: 0.12, modo: "screen" }, vinheta: { cor: "#3a2410", forca: 0.22 }, sombra: "#5a3424",
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
      luz: { cor: "#ffd9a0", alfa: 0.07, modo: "screen" }, vinheta: { cor: "#0a2030", forca: 0.16 }, sombra: "#173a44",
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
      luz: { cor: "#ffcc66", alfa: 0.12, modo: "screen" }, vinheta: { cor: "#2a1a08", forca: 0.2 }, sombra: "#4a3020",
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
      luz: { cor: "#ff9f78", alfa: 0.12, modo: "screen" }, vinheta: { cor: "#3a2238", forca: 0.26 }, sombra: "#3a2238",
      particulas: { tipo: "respingo", cor: "#e8f2e0", max: 25 },
    },
    sinai: {
      chao: { base: "#a08266", escuro: "#896d59", claro: "#b89b7c", salpico: "#ccb294" },
      mancha: { base: "#987a66", escuro: "#7a6052" },
      caminho: { base: "#c2a888", escuro: "#a08a6c", claro: "#d4bea0", borda: "#7a6450" },
      obstaculos: [{ tipo: "penedo", peso: 50 }, { tipo: "arbusto", peso: 20 }, { tipo: "marco", peso: 15 }, { tipo: "acacia", peso: 15, alto: true }],
      borda: { tipo: "paredao", rampa: ["#2e2430", "#3a2a44", "#5a4a4a", "#7a6a62"] },
      moldura: { norte: "penhascos", sul: "penhascos", leste: "penhascos", oeste: "penhascos" },
      deco: [{ tipo: "seixo", peso: 3, cor: "#7a6a5a" }, { tipo: "liquen", peso: 2, cor: "#9aa070" }, { tipo: "tufo", peso: 3, cor: "#7a7f4a" }],
      luz: { cor: "#c8d0f0", alfa: 0.08, modo: "screen" }, vinheta: { cor: "#10101e", forca: 0.26 }, sombra: "#3a2a44",
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
      luz: { cor: "#ffe0a0", alfa: 0.08, modo: "screen" }, vinheta: { cor: "#1a1408", forca: 0.16 }, sombra: "#2a3a3a",
      particulas: { tipo: "borboleta", cor: "#f6efdc", max: 15 },
    },
  };

  // -------------------------------------------------------------------
  // Obstáculos: uma chave por bioma e tipo (ob_<area>_<tipo>), cada quadro uma variante de forma. O desenho
  // está em arte/flora.js, que parte destas defs (quadros, alto, obstaculo, origem) e troca a célula.
  // -------------------------------------------------------------------
  function obstaculo(chave, alto, variantes) {
    return reserva(chave, { w: 18, h: alto ? 26 : 18, quadros: variantes, alto, obstaculo: true, origem: [0.5, 1] });
  }
  // Copa e rocha do desenho antigo: só a moldura e a borda do tileset de reserva ainda as usam.
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

  obstaculo("ob_canaan_oliveira", true, 3);
  obstaculo("ob_canaan_muro", false, 2);
  obstaculo("ob_canaan_rocha", false, 2);

  obstaculo("ob_deserto_rocha", false, 3);
  obstaculo("ob_deserto_acacia", true, 2);
  obstaculo("ob_deserto_retama", false, 2);
  obstaculo("ob_deserto_tenda", true, 1);

  obstaculo("ob_mar_ilhota", true, 2);
  obstaculo("ob_mar_rochedo", false, 2);
  obstaculo("ob_mar_recife", false, 2);

  obstaculo("ob_egito_tamareira", true, 2);
  obstaculo("ob_egito_coluna", true, 1);
  obstaculo("ob_egito_tijolos", false, 2);
  obstaculo("ob_egito_jarros", false, 2);

  obstaculo("ob_marVermelho_granito", false, 2);
  obstaculo("ob_marVermelho_coral", false, 2);
  obstaculo("ob_marVermelho_destrocos", false, 2);

  obstaculo("ob_sinai_penedo", false, 2);
  obstaculo("ob_sinai_arbusto", false, 1);
  obstaculo("ob_sinai_marco", false, 1);
  obstaculo("ob_sinai_acacia", true, 1);

  obstaculo("ob_galileia_figueira", true, 2);
  obstaculo("ob_galileia_basalto_muro", false, 2);
  obstaculo("ob_galileia_basalto", false, 2);
  obstaculo("ob_galileia_barco", false, 1);
  obstaculo("ob_sinai_estandarte", true, 1);

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
      pintores.agua(pin, i, a, mask % 4, t);
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
    for (let v = 0; v < 2; v++) { pinta(ID.MOLDURA + 10 + v, bio.moldura.oeste, v); pinta(ID.MOLDURA + 12 + v, bio.moldura.leste, v); }
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

  // Pintores do tileset, numa tabela substituível (Arte.motor.pintores): um arte/*.js troca a função
  // (mesma assinatura) e chama limparTilesets() para os tilesets já gerados serem refeitos.
  //   chao(pin, area, bio, semente) · caminho(pin, bio, semente) · mancha(pin, area, bio, semente)
  //   detalhe(pin, area, bio, semente) · borda(pin, bio, area) · deco(pin, bio, area)
  //   moldura(pin, bio, area) · sombras(pin, bio)
  //   agua(pin, indice, agua, fase, t, clara) · costa(pin, { agua }, t) · muralha(pin, bio, t)  (animados)
  const pintores = {
    chao: pintarChao, caminho: pintarCaminho, mancha: pintarMancha, detalhe: detalharChao,
    borda: pintarBorda, deco: pintarDeco, moldura: pintarMoldura, sombras: pintarSombras,
    agua: pintarAgua, costa: pintarCosta, muralha: pintarMuralha,
  };
  let cacheTileset = {};
  function limparTilesets(area) {
    if (area) delete cacheTileset[area];
    else cacheTileset = {};
    ultimaFaseAgua = -1;
  }
  function gerarTileset(area) {
    if (cacheTileset[area]) return cacheTileset[area];
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const bio = BIOMAS[area] || BIOMAS.canaan;
    const semente = sementeDe(area);
    const pin = new Pincel(TS_COLS * T, TS_LINHAS * T);
    pintores.chao(pin, area, bio, semente);
    pintores.caminho(pin, bio, semente);
    pintores.mancha(pin, area, bio, semente);
    pintores.detalhe(pin, area, bio, semente);
    pintores.borda(pin, bio, area);
    pintores.deco(pin, bio, area);
    pintores.moldura(pin, bio, area);
    pintores.sombras(pin, bio);
    const agua = bio.agua || BIOMAS.mar.agua;
    const animados = [];
    const temMuralha = bio.borda.norte === "muralha";
    if (temMuralha) animados.push((t) => pintores.muralha(pin, bio, t));
    else animados.push((t) => pintores.costa(pin, { agua }, t));
    animados.push((t) => { for (let f = 0; f < 4; f++) pintores.agua(pin, ID.AGUA + f, agua, f * 4, t); });
    animados.push((t) => { for (let f = 0; f < 4; f++) pintores.agua(pin, ID.ROTA + f, agua, f * 4, t, true); });
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
        // no mar a terra de fora encosta na água: a coluna vizinha do mapa é a praia (90–91 oeste, 92–93 leste)
        if (area === "mar" && x === -1) return ID.MOLDURA + 10 + (v % 2);
        if (area === "mar" && x === COLSm) return ID.MOLDURA + 12 + (v % 2);
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
  // Validação dos padrões (§6.1): largura das linhas, cores definidas, contrato de quadros e limite de
  // cores do miolo (64 por sprite do mundo, 16 por glifo ui_, 24 por glifo hb_/of_).
  // -------------------------------------------------------------------
  function validar() {
    const problemas = [];
    for (const [chave, def] of Object.entries(PIXEL_PATTERNS)) {
      const conjuntos = def.quadrosLinhas || (def.linhas ? [def.linhas] : []);
      for (const linhas of conjuntos) {
        linhas.forEach((l, i) => { if (l.length !== def.w) problemas.push(`${chave}: linha ${i} com ${l.length} != ${def.w}`); });
        for (const l of linhas) for (const ch of l) if (ch !== "." && !def.cores[ch]) problemas.push(`${chave}: '${ch}' sem cor`);
      }
      // contrato de quadros: vistas × quadros por vista, e os quadros citados existem em cada vista
      const qpv = def.quadrosPorVista || (def.direcoes ? QUADROS_POR_VISTA : 0);
      if (def.direcoes && def.quadros !== def.direcoes * qpv) problemas.push(`${chave}: ${def.quadros} quadros != ${def.direcoes} vistas x ${qpv}`);
      for (const q of [].concat(def.ciclo || [], def.quadroAcao || [])) if (!(q >= 0 && q < (qpv || def.quadros))) problemas.push(`${chave}: quadro ${q} fora da vista`);
      // cores do miolo (o contorno, reconhecido pela máscara, não conta; +1 de folga no contorno legado)
      const limite = limiteDe(chave, def) + (def.contornoLegado ? 1 : 0);
      for (let q = 0; q < def.quadros; q++) {
        const px = pixels(chave, { quadro: q });
        if (px.w !== Math.round(def.w * def.res) || px.h !== Math.round(def.h * def.res)) { problemas.push(`${chave}#${q}: ${px.w}x${px.h} px`); break; }
        if (!limiteDe(chave, def)) continue;
        const cores = new Set();
        for (let i = 0; i < px.data.length; i++) if (px.data[i] && !px.borda[i]) cores.add(px.data[i]);
        if (cores.size > limite) { problemas.push(`${chave}#${q}: ${cores.size} cores`); break; }
      }
    }
    return problemas;
  }

  // -------------------------------------------------------------------
  // URLs para a interface
  // -------------------------------------------------------------------
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
    const quadroInteiro = recorte === "inteiro" && def.direcoes ? def.quadrosPorVista || QUADROS_POR_VISTA : null; // de frente, parado
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
      // (e as prévias pv_, as sombras sob medida e as variantes dos raros)
      if (/^(mk_portal_|pj_|in_|al_|mt_|pv_|fx_sombra_\d)/.test(chave) || chave.includes("~v:")) continue;
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
    garantirSombra, garantirVariante, limparTilesets,
    // Tabela dos efeitos animados (arte/efeitos.js preenche): chave → { quadros, ms, ... }.
    FX: {},
    // Motor para os arquivos arte/*.js (ver docs/GUIA-DE-ARTE.md, "Contrato").
    motor: {
      Grade, registrar, pixels, limparCaches, PIXEL_PATTERNS, aliasItem, CHEFES, TS_COLS, TS_LINHAS, PALETA, CONTORNO, BIOMAS, SEMANTICA, RES, T, VISTAS,
      misturar, hash2, ruido, comAlfa, hexRgb, rgbHex, sementeDe,
      rampa6, sombrear, esferaPx, panoPx, tom, esfera, rampaDe,
      prim: { retF, elipF, linF, bastao, pintarMascara, LM },
      HUMANOS, MONTADOS, ACESSORIOS, ARMADURAS, LAMINAS, CORES_ESCUDO, ARCOS, coresHumano, MONTARIAS_ARTE,
      definirHumano, definirMontado, garantirSombra, garantirVariante,
      pintores, limparTilesets, Pincel, ID_TILE: ID,
    },
  };
  global.PIXEL_PATTERNS = PIXEL_PATTERNS;
  global.iconeItemURL = (itemId, escala = 2) => iconeURL(aliasItem(itemId), escala);
})(typeof window !== "undefined" ? window : globalThis);
