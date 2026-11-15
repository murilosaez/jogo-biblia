// =====================================================================
// cenario.js — prédios onde se entra (casas e lojas) e o chão contínuo das regiões
// Arte original gerada em código (nenhuma imagem externa). Carregado depois de sprites.js (usa Arte.hash2,
// Arte.ruido, Arte.misturar e Arte.BIOMAS) e antes de game.js.
//
// Prédios (DADOS_ESTRUTURAS com entrar: true): cada prédio vira 5 imagens, todas em 32 px por casa:
//   chão      — o piso de dentro (tábuas, lajotas, barro batido ou areia com tapete), na altura do chão;
//   dentro    — a parede do fundo (alta, com prateleiras) e as paredes baixas cortadas dos lados e da frente;
//   fora      — o telhado (terraço com parapeito, ou lona na tenda grande) e a fachada com a porta, as
//               janelas e, nas lojas, o toldo e a placa. Some quando o jogador entra;
//   sombra    — a sombra do prédio no chão, à direita e embaixo;
//   móveis    — balcão, barris, caixotes, sacos, cama, jarros e mesa (um por casa bloqueada).
// A altura da parede vem de Cenario.ALTURA_PAREDE (64 px = 2 casas; a pintura aceita de 32 a 64) e entra na
// chave das texturas; "dentro" e "fora" têm W × (H + altura) e ficam em Y0 − altura.
// Muros contínuos: 34 px de altura (Cenario.ALTURA_MURO), com pedras de cobertura e a face texturizada.
// Chão contínuo: o chão de cada região é pintado em pedaços de 16 × 16 casas, pixel a pixel, a partir do
// mundo (não de azulejos repetidos): relva em lâminas e moitas, areia com ondulação e grão, estradas de
// terra com beira desenhada (fio escuro, degrau e tufos), calçada de pedras irregulares, chão pisado em
// volta das portas, margem da água orgânica (a terra invade a casa de água, com barranco e faixa rasa) e as
// sombras de contato de muros e prédios. A pintura pode ser feita em fatias (iniciarPedaco + pintarFatia).
// A água, a borda do mapa e a moldura continuam no Tilemap (animados), por baixo.
// Sem DOM: tudo é pintado em Tela (buffer RGBA); só Tela.canvas() usa document.
// =====================================================================
(function (global) {
  const Arte = global.Arte;
  if (!Arte) return; // sem a arte (testes da lógica): nada a fazer
  const { hash2, ruido, misturar } = Arte;
  const T = 32; // px por casa
  const TINTA = "#2a1a14";

  // ---------------------------------------------------------------- cores
  const cacheCor = new Map();
  function rgb(c) {
    let v = cacheCor.get(c);
    if (!v) {
      const h = c.replace("#", "");
      v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      cacheCor.set(c, v);
    }
    return v;
  }
  // Matiz por região: a sombra puxa para a cor de sombra do bioma (bio.sombra) e a luz para a cor da luz dele
  // (bio.luz.cor). matiz(area) escolhe a região da pintura em curso; matiz(null) volta ao neutro (sépia e creme).
  const SOMBRA_NEUTRA = "#1c1210", LUZ_NEUTRA = "#fff6e0";
  let SOMBRA = SOMBRA_NEUTRA, LUZ = LUZ_NEUTRA;
  const cacheMatiz = {};
  function matiz(area) {
    const bio = area && Arte.BIOMAS[area];
    if (!bio) { SOMBRA = SOMBRA_NEUTRA; LUZ = LUZ_NEUTRA; return; }
    const m = cacheMatiz[area] || (cacheMatiz[area] = [misturar(SOMBRA_NEUTRA, misturar(bio.sombra, "#000000", 0.35), 0.6), misturar(LUZ_NEUTRA, bio.luz.cor, 0.5)]);
    SOMBRA = m[0]; LUZ = m[1];
  }
  const esc = (c, t = 0.25) => misturar(c, SOMBRA, t);
  const cla = (c, t = 0.2) => misturar(c, LUZ, t);
  // Bayer 4 × 4: degradê em pixel art (pontilhado ordenado), sem gradiente liso.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  // Escolhe a cor da rampa para t em 0..1, com pontilhado nas passagens.
  function rampa(cores, t, x, y) {
    const n = cores.length - 1;
    const i = Math.max(0, Math.min(n, Math.floor(t * n + bayer(x, y))));
    return cores[i];
  }

  // ---------------------------------------------------------------- tela de pixels
  class Tela {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.buf = new Uint8ClampedArray(w * h * 4);
    }
    p(x, y, c, a = 1) {
      x |= 0; y |= 0;
      if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const o = (y * this.w + x) * 4, [r, g, b] = rgb(c), d = this.buf;
      if (a >= 1 || d[o + 3] === 0) {
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = Math.round(Math.min(1, a) * 255);
      } else {
        d[o] += (r - d[o]) * a; d[o + 1] += (g - d[o + 1]) * a; d[o + 2] += (b - d[o + 2]) * a;
        d[o + 3] = Math.min(255, d[o + 3] + a * 255);
      }
    }
    // escurece (ou clareia) o que já está pintado, sem mudar o alfa
    tom(x, y, cor, a) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const o = (y * this.w + x) * 4, d = this.buf;
      if (!d[o + 3]) return;
      const [r, g, b] = rgb(cor);
      d[o] += (r - d[o]) * a; d[o + 1] += (g - d[o + 1]) * a; d[o + 2] += (b - d[o + 2]) * a;
    }
    tem(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.buf[(y * this.w + x) * 4 + 3] > 0; }
    ret(x, y, w, h, c, a = 1) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const cor = typeof c === "function" ? c(x + i, y + j, i, j) : c;
        if (cor) this.p(x + i, y + j, cor, a);
      }
    }
    lin(x0, y0, x1, y1, c, a = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let k = 0; k <= n; k++) this.p(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), c, a);
    }
    elip(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
          if (nx * nx + ny * ny <= 1) { const cor = typeof c === "function" ? c(nx, ny, x, y) : c; if (cor) this.p(x, y, cor); }
        }
    }
    // contorno de 1 px em volta do que está pintado (só onde está vazio)
    // cor fixa, ou null para o contorno colorido: a cor do vizinho pintado, escurecida e puxada à sombra
    contorno(cor = TINTA) {
      const marcar = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.tem(x, y)) continue;
        if (this.tem(x - 1, y) || this.tem(x + 1, y) || this.tem(x, y - 1) || this.tem(x, y + 1)) marcar.push(x, y);
      }
      for (let i = 0; i < marcar.length; i += 2) this.p(marcar[i], marcar[i + 1], cor);
    }
    canvas() {
      const c = document.createElement("canvas");
      c.width = this.w; c.height = this.h;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(this.w, this.h);
      img.data.set(this.buf);
      ctx.putImageData(img, 0, 0);
      return c;
    }
  }

  // ---------------------------------------------------------------- materiais dos prédios
  // face: rampa da parede (escura → clara); topo: reboco do terraço e da parede cortada; dentro: reboco claro
  // da parede de dentro; piso da casa e da loja; telhado: terraço (teto plano das casas do antigo Israel e do
  // Egito) ou lona (tenda grande de pelo de cabra e pano).
  const MATERIAIS_PREDIO = [
    { id: "adobe", face: ["#7e5a3a", "#a47a50", "#c29866", "#dcb884"], textura: "reboco", topo: ["#8e6c46", "#b48e60", "#ceaa78", "#e4c896"], dentro: ["#b49a72", "#ccb38a", "#dccaa2"], piso: { casa: "barro", loja: "tabuas" }, telhado: "terraco" },
    { id: "pedra", face: ["#5e5648", "#857b66", "#a89c84", "#c8bea2"], textura: "blocos", topo: ["#8a7c62", "#ac9e80", "#c6b898", "#ddd2b4"], dentro: ["#b0a690", "#c8bea6", "#dcd4be"], piso: { casa: "lajota", loja: "tabuas" }, telhado: "terraco" },
    { id: "basalto", face: ["#181614", "#2a2826", "#403d39", "#5c5852"], textura: "blocos", topo: ["#7e7666", "#9e9480", "#b8ae98", "#cec6b0"], dentro: ["#8a8478", "#a29c8e", "#b8b2a4"], piso: { casa: "lajota_escura", loja: "tabuas" }, telhado: "terraco" },
    { id: "tijolo", face: ["#542c1a", "#784226", "#9a5a36", "#ba744c"], textura: "tijolo", topo: ["#94704c", "#b48e64", "#cca87c", "#e0c298"], dentro: ["#b89a76", "#cfb48e", "#e0caa6"], piso: { casa: "barro", loja: "tabuas" }, telhado: "terraco" },
    { id: "tenda", face: ["#5a4a36", "#8a7656", "#b8a47e", "#d8c8a2"], textura: "pano", listra: ["#8e2a1f", "#b8402e"], topo: ["#6a5640", "#8a7458", "#a89070", "#c4ae8c"], dentro: ["#8a7656", "#a8916c", "#c4ae86"], piso: { casa: "areia", loja: "areia" }, telhado: "lona" },
  ];
  const material = (v) => MATERIAIS_PREDIO[Math.max(0, Math.min(MATERIAIS_PREDIO.length - 1, v || 0))];
  // Altura da parede dos prédios (px): Cenario.ALTURA_PAREDE, entre 32 (1 casa) e 64 (2 casas).
  const alturaParede = () => Math.max(32, Math.min(64, Math.round((global.Cenario && global.Cenario.ALTURA_PAREDE) || 32)));
  const MADEIRA = ["#3a2414", "#4e3018", "#6b4a2e", "#8a5a32", "#a87444", "#c8945a"];

  // Textura da face de uma parede: reboco sobre adobe (fiadas à mostra onde caiu), cantaria de pedra em fiadas
  // irregulares, tijolo de barro ou pano listrado.
  const FIADAS_PEDRA = [8, 7, 9, 8];
  function pintarFace(tela, x0, y0, w, h, mat, s, cores = mat.face) {
    const [c0, c1, c2, c3] = cores;
    // juntas das fiadas de pedra: larguras sorteadas de 9 a 17 px
    const juntas = [];
    if (mat.textura === "blocos") {
      let y = 0, f = 0;
      while (y < h) {
        const alt = FIADAS_PEDRA[f % 4], xs = [];
        let x = -Math.floor(hash2(f, 1, s) * 9);
        while (x < w) { xs.push(x); x += 9 + Math.floor(hash2(xs.length, f, s + 1) * 9); }
        xs.push(x);
        juntas.push({ y, alt, xs }); y += alt; f++;
      }
    }
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const lx = x - x0, ly = y - y0, hp = hash2(x, y, s);
      let c = c2;
      if (mat.textura === "reboco") {
        const n = ruido(x / 9, y / 6, s) * 0.75 + hp * 0.25;
        c = n < 0.3 ? c1 : n > 0.74 ? c3 : c2;
        // fiadas de adobe adivinhadas sob o reboco
        const fila = Math.floor(ly / 6), onda = Math.round(ruido(x / 13, fila, s + 4) * 2);
        if ((ly + onda) % 6 === 0 && ruido(x / 17, y / 9, s + 5) > 0.42 && hp > 0.2) c = misturar(c, c1, 0.5);
        // reboco caído: tijolos de barro à mostra, com a beira do reboco em relevo
        const q = ruido(x / 12, y / 10, s + 3);
        if (q > 0.74) {
          const tf = Math.floor(ly / 4), bx = (lx + (tf % 2) * 4) % 8, tj = hash2(Math.floor((lx + (tf % 2) * 4) / 8), tf, s + 6);
          c = ly % 4 === 3 || bx === 7 ? c0 : tj < 0.4 ? misturar(c1, "#8e4a2a", 0.35) : tj > 0.8 ? misturar(c1, c2, 0.4) : c1;
          if (q < 0.765) c = ruido(x / 12, (y - 1) / 10, s + 3) < q ? esc(c0, 0.2) : c3;
        } else if (hp < 0.035) c = c1;
      } else if (mat.textura === "blocos") {
        let f = juntas[juntas.length - 1];
        for (const j of juntas) if (ly >= j.y && ly < j.y + j.alt) { f = j; break; }
        let b = 0;
        while (b + 1 < f.xs.length && lx >= f.xs[b + 1]) b++;
        const bx = lx - f.xs[b], bw = f.xs[b + 1] - f.xs[b], by = ly - f.y;
        const tom = hash2(b, f.y, s + 1);
        c = tom < 0.26 ? c1 : tom > 0.82 ? misturar(c2, c3, 0.6) : tom > 0.5 ? c2 : misturar(c1, c2, 0.55);
        if (tom > 0.6 && tom < 0.66) c = misturar(c, "#8a6a4a", 0.2);
        if (by === 0 || bx === 0) c = c0;
        else if (by === 1 || bx === 1) c = cla(c, 0.2);
        else if (by === f.alt - 1 || bx === bw - 1) c = esc(c, 0.2);
        else if (hp < 0.07) c = esc(c, 0.1);
        else if (hp > 0.95) c = cla(c, 0.1);
        else if (tom < 0.12 && Math.abs(bx - by * 1.4 - 2) < 0.8) c = esc(c, 0.3); // pedra rachada
      } else if (mat.textura === "tijolo") {
        const fila = Math.floor(ly / 5), off = (fila % 2) * 4, bx = (lx + off) % 9, by = ly % 5;
        const tom = hash2(Math.floor((lx + off) / 9), fila, s);
        c = tom < 0.3 ? c1 : tom > 0.84 ? c3 : c2;
        if (tom > 0.45 && tom < 0.53) c = misturar(c1, "#3a2a22", 0.4); // tijolo queimado
        else if (tom > 0.6 && tom < 0.66) c = misturar(c2, "#c8a070", 0.35);
        if (by === 4 || bx === 8) c = esc(c0, 0.1);
        else if (by === 0) c = cla(c, 0.16);
        else if (by === 3) c = esc(c, 0.1);
        else if (hp < 0.05) c = esc(c, 0.12);
      } else if (mat.textura === "pano") {
        // pano pesado de pelo de cabra, em panos de 24 px costurados: pregas largas e moles (o vinco escuro é
        // fino, a luz pega no dorso da prega), costura a cada pano e duas barras tecidas (em cima e embaixo)
        const fase = (lx / 24) * Math.PI * 2 + Math.sin(ly / 13 + s) * 0.7 + Math.sin(lx / 41 + s) * 0.9;
        const dobra = Math.sin(fase), l = 0.58 + dobra * 0.25 - (ly / h) * 0.12;
        c = l > 0.8 ? c3 : l > 0.42 ? (l > 0.72 && bayer(x, y) > 0.5 ? c3 : c2) : l > 0.3 ? (bayer(x, y) > (l - 0.3) / 0.12 ? c1 : c2) : dobra < -0.93 ? c0 : c1;
        const barra = mat.listra ? (ly >= 8 && ly < 13 ? 1 : ly >= h - 14 && ly < h - 9 ? 1 : ly === 15 || ly === h - 17 ? 2 : 0) : 0;
        if (barra === 1) c = l < 0.36 ? esc(mat.listra[0], 0.2) : l > 0.74 ? cla(mat.listra[1], 0.15) : (ly === 8 || ly === h - 14) ? mat.listra[1] : (lx + ly) % 4 === 0 ? mat.listra[1] : mat.listra[0];
        else if (barra === 2) c = l < 0.36 ? mat.listra[0] : mat.listra[1];
        else if (lx % 24 === 0) c = misturar(c, c0, 0.45); // costura
        else if (hp < 0.03) c = misturar(c, c1, 0.5);
      }
      tela.p(x, y, c);
    }
  }

  // ---------------------------------------------------------------- piso de dentro
  function corPiso(tipo, wx, wy, mat) {
    switch (tipo) {
      case "tabuas": {
        // tábuas de 8 px no sentido leste–oeste, emendas desencontradas
        const fila = wy >> 3, ly = wy & 7, off = Math.floor(hash2(fila, 0, 71) * 40);
        const tab = Math.floor((wx + off) / 40), lx = (wx + off) % 40;
        const tom = hash2(tab, fila, 72);
        const base = tom < 0.33 ? "#8a5a32" : tom < 0.66 ? "#9a6838" : "#a87444";
        if (ly === 7) return "#4e3018";
        if (lx === 0) return "#5a3820";
        if (ly === 0) return cla(base, 0.18);
        const veio = Math.sin((wx + off) * 0.45 + ly * 1.7 + tom * 9);
        if (veio > 0.85) return esc(base, 0.18);
        if ((lx === 3 || lx === 36) && ly === 3) return "#3a2414"; // cravo
        if (tom > 0.9 && Math.hypot(lx - 20, (ly - 4) * 2) < 2.2) return esc(base, 0.3); // nó da madeira
        return base;
      }
      case "lajota":
      case "lajota_escura": {
        const escura = tipo === "lajota_escura";
        const lx = wx & 15, ly = wy & 15, tom = hash2(wx >> 4, wy >> 4, 73);
        const cores = escura ? ["#4a4640", "#5c5850", "#6e6a60"] : ["#a89a7c", "#bcae8e", "#cec2a2"];
        if (lx === 0 || ly === 0) return escura ? "#2e2c28" : "#7a6e56";
        let c = cores[tom < 0.33 ? 0 : tom < 0.7 ? 1 : 2];
        if (lx === 1 || ly === 1) c = cla(c, 0.15);
        else if (lx === 15 || ly === 15) c = esc(c, 0.12);
        else if (hash2(wx, wy, 74) < 0.06) c = esc(c, 0.1);
        else if (tom > 0.86 && Math.abs(lx - ly * 0.7 - 3) < 0.7) c = esc(c, 0.25); // lajota trincada
        return c;
      }
      case "areia": {
        const n = ruido(wx / 9, wy / 9, 75) + (hash2(wx, wy, 79) - 0.5) * 0.12;
        return n < 0.35 ? "#c8a46a" : n > 0.7 ? "#e2c48c" : "#d6b47c";
      }
      default: { // barro batido
        const n = ruido(wx / 6, wy / 6, 76) * 0.7 + hash2(wx, wy, 77) * 0.3;
        const base = n < 0.3 ? "#9a7650" : n > 0.75 ? "#bc966a" : "#ac865c";
        if (hash2(wx, wy, 78) < 0.03) return "#7a5a3a";
        return base;
      }
    }
  }

  // Tapete tecido (1 casa e meia de largura), com franja: vermelho e índigo, losangos no meio.
  function pintarTapete(tela, x0, y0, s) {
    const w = 44, h = 24, cores = hash2(s, 1, 80) < 0.5 ? ["#7a2018", "#a8342a", "#d8a85a", "#2e3a6a"] : ["#26305a", "#3b4a8a", "#d8b06a", "#8a2a20"];
    for (let x = 1; x < w + 2; x++) { tela.tom(x0 + x, y0 + h, SOMBRA, 0.3); tela.tom(x0 + x, y0 + h + 1, SOMBRA, 0.12); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const borda = x < 3 || y < 3 || x >= w - 3 || y >= h - 3;
      const cx = Math.abs(x - w / 2), cy = Math.abs(y - h / 2);
      let c = cores[1];
      if (borda) c = (x + y) % 4 === 0 ? esc(cores[0], 0.2) : cores[0];
      else if (x === 4 || y === 4 || x === w - 5 || y === h - 5) c = cores[2];
      else if (Math.abs(cx * 0.55 + cy - 5) < 0.9) c = cores[2];
      else if (cx * 0.55 + cy < 3) c = cores[3];
      else if (Math.abs(Math.abs(cx - 14) * 0.7 + cy - 3) < 0.8) c = cores[3];
      else if ((x + y) % 6 === 0) c = esc(cores[1], 0.15);
      else if (y & 1) c = cla(cores[1], 0.06);
      tela.p(x0 + x, y0 + y, c);
    }
    for (let y = 1; y < h - 1; y += 2) { tela.p(x0 - 1, y0 + y, "#e8dcc0"); tela.p(x0 - 2, y0 + y, "#c8b890"); tela.p(x0 + w, y0 + y, "#e8dcc0"); tela.p(x0 + w + 1, y0 + y, "#c8b890"); }
  }

  // ---------------------------------------------------------------- prédio: imagens
  // e: estrutura (logica.js) com x, y, largura, altura, porta, variante, tipo, placa, tapete.
  function areaDoPredio(e) {
    if (typeof estruturasPorArea === "undefined") return null;
    for (const [area, lista] of Object.entries(estruturasPorArea)) if (lista.includes(e)) return area;
    return null;
  }
  function pintarPredio(e) {
    const mat = material(e.variante);
    const L = e.largura, A = e.altura, W = L * T, H = A * T, AP = alturaParede();
    const s = (e.x * 31 + e.y * 17) | 0;
    const porta = e.porta.x - e.x;
    const loja = e.tipo === "loja";
    matiz(areaDoPredio(e));
    const telas = {
      chao: pintarChaoPredio(e, mat, W, H, s, loja),
      dentro: pintarDentro(e, mat, L, A, W, H, s, porta, loja, AP),
      fora: pintarFora(e, mat, L, A, W, H, s, porta, loja, AP),
      sombra: pintarSombra(W, H, AP),
    };
    matiz(null);
    return telas;
  }

  function pintarChaoPredio(e, mat, W, H, s, loja) {
    const tela = new Tela(W, H);
    const tipo = mat.piso[loja ? "loja" : "casa"];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tela.p(x, y, corPiso(tipo, e.x * T + x, e.y * T + y, mat));
    // sombra das paredes no chão: faixa mais escura junto ao fundo e à esquerda
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dy = y - T, dx = x - 12;
      if (dy >= 0 && dy < 7) tela.tom(x, y, SOMBRA, 0.4 - dy * 0.055);
      if (dx >= 0 && dx < 5 && y >= T) tela.tom(x, y, SOMBRA, 0.26 - dx * 0.05);
    }
    if (e.tapete) pintarTapete(tela, (e.tapete.x - e.x) * T - 6, (e.tapete.y - e.y) * T + 4, s);
    // soleira de pedra na porta
    const px = (e.porta.x - e.x) * T, py = (e.porta.y - e.y) * T;
    tela.ret(px + 4, py + 19, 24, 12, (x, y, i, j) => (j === 0 ? "#e0d4b8" : j === 11 ? "#5a4e3c" : j === 10 ? "#7a6e58" : i === 0 ? "#d0c4a6" : i === 23 ? "#8a7e66" : i === 12 ? "#948870" : hash2(x, y, 88) < 0.1 ? "#a89c80" : "#b8ac90"));
    return tela;
  }

  // Parede de dentro: o fundo alto (reboco claro, prateleiras na loja, nicho e ervas na casa) e as paredes
  // cortadas dos lados e da frente, finas (12 px) na beira de fora da pegada, como uma planta baixa.
  // Imagem de W × (H + AP), posta em Y0 − AP: topo da parede do fundo em y 20–31, a face dela de y 32 a 31 + AP.
  function pintarDentro(e, mat, L, A, W, H, s, porta, loja, AP = 32) {
    const tela = new Tela(W, H + AP);
    const topo = mat.topo, F0 = T, F1 = T + AP; // face de dentro da parede do fundo
    const k = AP / 32;
    // topo da parede do fundo
    tela.ret(0, 20, W, 12, (x, y) => (y === 20 ? cla(topo[3], 0.15) : y === 21 ? topo[3] : y === 31 ? topo[0] : y === 30 ? topo[1] : hash2(x, y, s) < 0.12 ? topo[1] : x % 23 === 7 && y > 22 ? topo[1] : topo[2]));
    // face de dentro da parede do fundo
    pintarFace(tela, 0, F0, W, AP, { ...mat, textura: mat.textura === "pano" ? "pano" : "reboco" }, s + 5, [esc(mat.dentro[0], 0.15), mat.dentro[0], mat.dentro[1], mat.dentro[2]]);
    for (let x = 0; x < W; x++) {
      tela.tom(x, F0, SOMBRA, 0.5); tela.tom(x, F0 + 1, SOMBRA, 0.3); tela.tom(x, F0 + 2, SOMBRA, 0.14);
      tela.tom(x, F1 - 1, SOMBRA, 0.4); tela.tom(x, F1 - 2, SOMBRA, 0.22); tela.tom(x, F1 - 3, SOMBRA, 0.1);
    }
    // rodapé de pedra
    if (mat.textura !== "pano") tela.ret(12, F1 - 4, W - 24, 3, (x, y, i, j) => (i % 11 === 0 ? esc(mat.dentro[0], 0.45) : j === 0 ? mat.dentro[1] : esc(mat.dentro[0], 0.2 + j * 0.08)));
    if (loja) {
      // prateleiras de madeira com mercadorias (duas; três na parede alta)
      const ys = AP >= 56 ? [F0 + Math.round(AP * 0.3), F0 + Math.round(AP * 0.55), F0 + Math.round(AP * 0.8)] : [F0 + 12, F0 + 25];
      for (const yp of ys) {
        tela.ret(14, yp, W - 28, 3, (x, y, i, j) => (j === 0 ? MADEIRA[5] : j === 1 ? MADEIRA[3] : MADEIRA[1]));
        tela.ret(14, yp + 3, W - 28, 2, SOMBRA, 0.32);
        for (const x of [15, W - 18]) tela.ret(x, yp + 3, 2, 3, MADEIRA[1]); // mãos-francesas
        for (let x = 17; x < W - 22; x += 8) {
          const q = hash2(x, yp, s + 9);
          if (q < 0.25) { // jarro
            tela.elip(x + 3, yp - 4, 3.2, 4, (nx, ny) => (nx < -0.35 && ny < 0.3 ? "#e6a070" : nx > 0.4 || ny > 0.6 ? "#8e4a2a" : "#b5663a")); tela.ret(x + 2, yp - 9, 3, 2, (xx, yy, i) => (i === 0 ? "#b5663a" : "#7a3a20"));
          } else if (q < 0.45) { // rolo de pano
            tela.ret(x, yp - 5, 6, 5, (xx, yy, i, j) => (j === 0 ? "#f4ecd6" : j === 4 ? "#8a7a5a" : i === 0 ? "#e8dcc0" : i === 5 ? "#a89878" : "#cfc09c"));
          } else if (q < 0.6) { // pano tingido dobrado
            tela.ret(x, yp - 4, 7, 4, (xx, yy, i, j) => (j === 0 ? "#7a9ae0" : j === 3 ? "#26386a" : i % 2 ? "#3b5a9a" : "#2e4680"));
          } else if (q < 0.78) { // pães
            tela.elip(x + 3, yp - 2, 3.4, 2.2, (nx, ny) => (ny < -0.2 ? "#ecc060" : nx > 0.5 ? "#8a5a28" : "#b88440")); tela.p(x + 2, yp - 3, "#f6dc90");
          } else { // molho de ervas num pote
            tela.ret(x + 1, yp - 3, 4, 3, (xx, yy, i) => (i === 0 ? "#a8845a" : i === 3 ? "#5a4028" : "#7a5a3a"));
            tela.ret(x + 1, yp - 7, 4, 4, (xx, yy, i, j) => ((i + j) % 2 ? "#3a8a5a" : "#5aa86a")); tela.p(x + 2, yp - 8, "#7ac07a");
          }
        }
      }
      // pano pendurado com o sinal do comerciante (balança)
      const cx = Math.round(W / 2);
      tela.ret(cx - 5, F0 + 1, 11, 8, (x, y, i, j) => (j === 0 ? MADEIRA[2] : i === 0 ? "#b8402e" : i === 10 ? "#6a1c14" : "#8e2a1f"));
      tela.lin(cx - 3, F0 + 4, cx + 3, F0 + 4, "#e8b94a"); tela.lin(cx, F0 + 3, cx, F0 + 7, "#e8b94a"); tela.p(cx - 3, F0 + 6, "#e8b94a"); tela.p(cx + 3, F0 + 6, "#e8b94a");
    } else {
      // nicho com a candeia, réstia de ervas e um cesto pendurado
      const nx = 18 + Math.floor(hash2(s, 2, 81) * (W - 60)), ny0 = F0 + Math.round(9 * k);
      tela.ret(nx - 1, ny0 - 1, 12, 11, esc(mat.dentro[0], 0.35));
      tela.ret(nx, ny0, 10, 9, (x, y, i, j) => (j < 2 || i < 2 ? "#2e1c12" : "#5a3c26"));
      tela.ret(nx - 1, ny0 + 9, 12, 1, mat.dentro[2]);
      tela.elip(nx + 5, ny0 + 7, 3, 1.6, (nx2) => (nx2 < -0.2 ? "#d07a4a" : "#9a4e2a")); tela.p(nx + 7, ny0 + 5, "#ffd24a"); tela.p(nx + 7, ny0 + 4, "#fff0a0"); tela.p(nx + 7, ny0 + 3, "#ffb030");
      for (const [dx, dy] of [[6, 4], [8, 4], [7, 2], [6, 6], [8, 6]]) tela.tom(nx + dx, ny0 + dy, "#ffb040", 0.25);
      const hx = nx + 22, hy = F0 + Math.round(4 * k);
      tela.lin(hx, hy, hx + 12, hy, MADEIRA[2]); tela.p(hx, hy - 1, MADEIRA[1]); tela.p(hx + 12, hy - 1, MADEIRA[1]);
      for (let q = 0; q < 4; q++) {
        const alt = 6 + (q % 2) * 2 + Math.round(k);
        for (let d = 0; d <= alt; d++) { tela.p(hx + 2 + q * 3, hy + 1 + d, d < 2 ? "#8a7a4a" : q % 2 ? "#5a7a3a" : "#7a9a4a"); if (d > 2 && d < alt) tela.p(hx + 1 + q * 3, hy + 1 + d, q % 2 ? "#466230" : "#5e7e3a"); }
      }
      if (W > 150) {
        const bx = W - 40, byc = F0 + Math.round(14 * k);
        tela.lin(bx, F0 + 3, bx, byc - 4, "#6b4a2e");
        tela.elip(bx, byc, 6, 4.5, (nx2, ny) => (ny < -0.6 ? "#e0c088" : (Math.round(ny * 5) + Math.round(nx2 * 3)) % 2 ? "#a8865e" : nx2 > 0.4 ? "#8a6a44" : "#c8a470"));
        tela.ret(bx - 6, byc - 4, 12, 1, "#7a5a36");
      }
    }
    // paredes cortadas dos lados e da frente (12 px de espessura, na beira de fora): miolo de adobe à mostra
    // (pedras de capa com juntas a cada 16 px ao comprido da parede, sem granulado)
    const cortada = (x, y, w, h) => {
      const deitada = w > h;
      tela.ret(x, y, w, h, (xx, yy) => {
        const q = (deitada ? xx : yy) + 5, n = hash2(xx, yy, s + 11);
        const bloco = hash2(Math.floor(q / 16), deitada ? 1 : xx < 16 ? 2 : 3, s + 12);
        if (q % 16 === 0) return topo[0];
        if (q % 16 === 1) return cla(topo[2], 0.12);
        return n < 0.05 ? topo[1] : bloco < 0.3 ? misturar(topo[1], topo[2], 0.5) : topo[2];
      });
    };
    const yl = AP + 20, ys = H + AP - 12;
    cortada(0, yl, 12, H - 20);
    cortada(W - 12, yl, 12, H - 20);
    for (let c = 0; c < L; c++) if (c !== porta) cortada(c * T, ys, T, 12);
    // bordas: luz em cima e à esquerda, sombra embaixo e à direita, e o contorno
    for (let y = yl; y < H + AP; y++) { tela.p(1, y, topo[3]); tela.p(11, y, topo[0]); tela.p(10, y, esc(topo[1], 0.1)); tela.p(W - 12, y, topo[3]); tela.p(W - 2, y, topo[0]); tela.p(0, y, TINTA); tela.p(W - 1, y, TINTA); }
    for (let x = 0; x < W; x++) {
      if (Math.floor(x / T) === porta) continue;
      tela.p(x, ys, topo[3]); tela.p(x, H + AP - 1, TINTA); tela.p(x, H + AP - 2, topo[0]); tela.p(x, H + AP - 3, esc(topo[1], 0.1));
    }
    // sombra das paredes no chão de dentro (luz de cima e da esquerda): ao pé da parede do fundo e da de oeste
    for (let x = 12; x < W - 12; x++) for (let q = 0; q < 6; q++) tela.p(x, F1 + q, SOMBRA, q < 2 ? 0.34 : q < 4 ? ((x + q) % 2 ? 0.26 : 0.18) : (x + q) % 2 ? 0.14 : 0.06);
    for (let y = F1 + 6; y < ys; y++) for (let q = 0; q < 5; q++) tela.p(12 + q, y, SOMBRA, q < 2 ? 0.3 : q < 4 ? ((y + q) % 2 ? 0.2 : 0.12) : (y + q) % 2 ? 0.1 : 0.04);
    // batentes da porta
    const dx = porta * T;
    tela.ret(dx, ys - 2, 4, 14, (x, y, i, j) => (j === 0 ? MADEIRA[5] : i === 0 ? MADEIRA[4] : i === 3 ? MADEIRA[1] : MADEIRA[2]));
    tela.ret(dx + T - 4, ys - 2, 4, 14, (x, y, i, j) => (j === 0 ? MADEIRA[4] : i === 0 ? MADEIRA[3] : i === 3 ? MADEIRA[0] : MADEIRA[1]));
    for (let x = 0; x < W; x++) tela.p(x, 19, TINTA);
    for (let y = 19; y < yl; y++) { tela.p(0, y, TINTA); tela.p(W - 1, y, TINTA); }
    return tela;
  }

  // Medidas do vão da porta para a altura da parede: 18 × 27 px com 32 e 26 × 56 px com 64 (a porta da parede
  // de 2 casas é mais alta que uma pessoa, que tem de 50 a 56 px).
  function vaoDaPorta(AP) {
    const f = (AP - 32) / 32, vw = 18 + 2 * Math.round(4 * f), vh = 27 + Math.round(29 * f);
    return { vw, vh, vx: (T - vw) >> 1, arco: Math.round(vw / 3) };
  }
  // Lado de fora: telhado (y 0 a H − 1, a pegada subida AP px) e a fachada (y H a H + AP − 1).
  function pintarFora(e, mat, L, A, W, H, s, porta, loja, AP = 32) {
    const tela = new Tela(W, H + AP);
    if (mat.telhado === "lona") pintarLona(tela, mat, W, H, s);
    else pintarTerraco(tela, mat, W, H, s, loja);
    // fachada
    const fy = H, k = AP / 32, pano = mat.textura === "pano";
    pintarFace(tela, 0, fy, W, AP, mat, s);
    for (let x = 0; x < W; x++) {
      // sombra do beiral em cima, pé da parede escurecido e cunhais (luz à esquerda, sombra à direita)
      tela.tom(x, fy, SOMBRA, 0.6); tela.tom(x, fy + 1, SOMBRA, 0.42); tela.tom(x, fy + 2, SOMBRA, 0.24); tela.tom(x, fy + 3, SOMBRA, 0.1);
      tela.tom(x, fy + AP - 1, SOMBRA, 0.5); tela.tom(x, fy + AP - 2, SOMBRA, 0.28); tela.tom(x, fy + AP - 3, SOMBRA, 0.12);
    }
    for (let y = fy + 3; y < fy + AP; y++) { tela.tom(0, y, LUZ, 0.3); tela.tom(1, y, LUZ, 0.14); tela.tom(W - 1, y, SOMBRA, 0.4); tela.tom(W - 2, y, SOMBRA, 0.22); tela.tom(W - 3, y, SOMBRA, 0.1); }
    if (!pano) {
      // rodapé: manchas de umidade que sobem do chão
      for (let x = 0; x < W; x++) { const alt = Math.floor(ruido(x / 6, 0, s + 30) * 6 * k); for (let q = 0; q < alt; q++) tela.tom(x, fy + AP - 3 - q, "#4a3a2a", 0.2 - q * 0.02); }
      // pontas das vigas do teto, com a sombra de cada uma na parede
      const vy = fy + Math.round(3 * k), vt = k > 1.5 ? 4 : 3;
      const vp = vaoDaPorta(AP), px0 = porta * T + vp.vx - 5, px1 = porta * T + vp.vx + vp.vw + 4, alta = AP - vp.vh < 14;
      for (let x = 7; x < W - 6; x += 12) {
        if (alta && x + vt > px0 && x < px1) continue; // a porta alta chega às vigas
        tela.ret(x, vy, vt, vt, (xx, yy, i, j) => (i === 0 || j === 0 ? MADEIRA[4] : i === vt - 1 && j === vt - 1 ? MADEIRA[0] : MADEIRA[2]));
        for (let q = 0; q < vt + 1; q++) { tela.tom(x + 1 + q, vy + vt, SOMBRA, 0.4); tela.tom(x + vt, vy + 1 + Math.min(q, vt - 1), SOMBRA, 0.3); }
      }
    }
    // janelas: vão fundo com sombra interna, treliça de madeira, verga, peitoril saliente e folhas abertas
    const jw = 12, jh = Math.round(9 * (k > 1.5 ? 2 : 1)), jy = fy + Math.round(AP * 0.3);
    for (let c = 0; c < L; c++) {
      if (c === porta || Math.abs(c - porta) === 1 && loja) continue;
      if ((c + (porta & 1)) % 2 === 0 && L > 4) continue;
      if (pano) continue;
      const jx = c * T + 10;
      // moldura
      tela.ret(jx - 2, jy - 2, jw + 4, jh + 3, (x, y, i, j) => (j === 0 ? MADEIRA[5] : i === 0 ? MADEIRA[4] : i === jw + 3 ? MADEIRA[1] : j === 1 ? MADEIRA[4] : MADEIRA[2]));
      // vão: escuro, mais fundo em cima e à esquerda (sombra da parede grossa), com a luz quente de dentro
      tela.ret(jx, jy, jw, jh, (x, y, i, j) => (j < 2 || i < 2 ? "#120b08" : j === jh - 1 || i === jw - 1 ? "#3a2618" : "#24160e"));
      for (let j = 2; j < jh - 1; j++) for (let i = 2; i < jw - 1; i++) {
        const d = Math.hypot(i - jw * 0.55, (j - jh * 0.6) * 1.3);
        if (d < 2.2) tela.p(jx + i, jy + j, d < 1.1 ? "#ffd27a" : "#c8782e"); else if (d < 3.6) tela.tom(jx + i, jy + j, "#e8a040", 0.3);
      }
      // treliça em losangos
      for (let j = 0; j < jh; j++) for (let i = 0; i < jw; i++) if ((i + j) % 4 === 0 || (i - j + 40) % 4 === 0) tela.p(jx + i, jy + j, (i + j) % 4 === 0 ? MADEIRA[3] : MADEIRA[2]);
      // peitoril saliente e a sombra dele
      tela.ret(jx - 3, jy + jh + 1, jw + 6, 2, (x, y, i, j) => (j === 0 ? cla(mat.face[3], 0.25) : mat.face[1]));
      for (let i = -2; i < jw + 5; i++) { tela.tom(jx + i, jy + jh + 3, SOMBRA, 0.42); tela.tom(jx + i, jy + jh + 4, SOMBRA, 0.18); }
      for (let j = -1; j < jh + 2; j++) tela.tom(jx + jw + 2, jy + j, SOMBRA, 0.3);
      if (k > 1.5) {
        // folhas de madeira abertas dos dois lados (parede alta)
        for (const [fx, luz] of [[jx - 7, true], [jx + jw + 3, false]]) tela.ret(fx, jy - 1, 5, jh + 2, (x, y, i, j) => (j === 0 || j === jh + 1 ? MADEIRA[1] : i === 0 ? MADEIRA[luz ? 5 : 3] : i === 4 ? MADEIRA[0] : j % 6 === 3 ? MADEIRA[1] : MADEIRA[luz ? 3 : 2]));
      }
    }
    // porta: vão em arco com ombreiras de pedra ou madeira; a folha é uma imagem à parte (pintarPorta)
    const { vw, vh, vx: ox, arco } = vaoDaPorta(AP);
    const dx = porta * T, vx = dx + ox, vt = fy + AP - vh;
    const noVao = (x, y) => {
      if (x < vx || x >= vx + vw || y < vt || y >= fy + AP) return false;
      const ax = (x + 0.5 - (vx + vw / 2)) / (vw / 2), ay = (y + 0.5 - (vt + arco)) / arco;
      return !(y < vt + arco && ax * ax + ay * ay > 1);
    };
    // ombreira (3 px) em volta do vão, seguindo o arco
    for (let y = vt - 3; y < fy + AP; y++) for (let x = vx - 3; x < vx + vw + 3; x++) {
      if (noVao(x, y)) { tela.p(x, y, y > fy + AP - 6 ? "#4a3220" : x < vx + 3 || y < vt + 3 || !noVao(x, y - 3) || !noVao(x - 3, y) ? "#0e0806" : "#1c1210"); continue; }
      let perto = false, cima = false, esq = false;
      for (let q = 1; q <= 3 && !perto; q++) { if (noVao(x + q, y) || noVao(x + q, y + q)) { perto = true; esq = true; } else if (noVao(x - q, y) || noVao(x - q, y + q)) perto = true; else if (noVao(x, y + q)) { perto = true; cima = true; } }
      if (!perto) continue;
      const pedra = !pano && mat.id !== "adobe";
      const base = pedra ? mat.topo : [MADEIRA[1], MADEIRA[2], MADEIRA[3], MADEIRA[5]];
      let c = cima || esq ? base[2] : base[1];
      if (!noVao(x + 1, y) && !noVao(x, y + 1) && !noVao(x - 1, y) && (noVao(x + 3, y) || noVao(x, y + 3) && !noVao(x, y + 2))) c = base[3];
      if (noVao(x - 1, y) || noVao(x + 1, y) || noVao(x, y + 1)) c = esq || cima ? base[1] : base[0];
      if (pedra && (y - vt) % 7 === 0 && !cima) c = base[0];
      tela.p(x, y, c);
    }
    // degrau da soleira
    tela.ret(vx - 2, fy + AP - 2, vw + 4, 2, (x, y, i, j) => (j === 0 ? "#d8ccb0" : "#8a7e66"));
    if (loja) pintarToldoEPlaca(tela, e, mat, W, fy, porta, s, AP);
    else if (!pano) {
      // candeia de barro num suporte ao lado da porta
      const lx = vx + vw + 5, ly = fy + AP - Math.round(Math.min(vh - 6, 34 * Math.max(1, k * 0.62)));
      if (lx + 4 < W) { tela.ret(lx, ly + 2, 4, 1, "#2a2a2a"); tela.elip(lx + 2, ly + 1, 2.2, 1.4, (nx) => (nx < 0 ? "#d07a4a" : "#8e4a2a")); tela.p(lx + 3, ly - 1, "#ffd24a"); tela.p(lx + 3, ly - 2, "#fff0a0"); }
    }
    tela.contorno(esc(mat.face[0], 0.6));
    return tela;
  }

  function pintarTerraco(tela, mat, W, H, s, loja) {
    const [t0, t1, t2, t3] = mat.topo;
    // superfície do terraço: barro batido e caiado sobre as vigas, em panos grandes de juntas suaves, cada
    // prédio num tom, com manchas de chuva, remendos e o caminho gasto de quem anda
    const tons = [[esc(t1, 0.16), esc(t1, 0.04), t1, misturar(t1, t2, 0.5)], [esc(t1, 0.1), t1, misturar(t1, t2, 0.4), t2], [esc(t1, 0.24), esc(t1, 0.12), esc(t1, 0.03), t1]][Math.floor(hash2(s, 7, 24) * 3)];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fila = Math.floor(y / 22), off = (fila % 2) * 15 + Math.floor(hash2(fila, 2, s) * 6), col = Math.floor((x + off) / 30);
      const lx = (x + off) % 30, ly = y % 22, hp = hash2(x, y, s + 21);
      const n = ruido(x / 12, y / 12, s + 20) * 0.55 + hash2(col, fila, s + 25) * 0.38 + 0.04;
      let c = tons[Math.max(0, Math.min(3, Math.floor(n * 4.2 + (hp - 0.5) * 0.16)))];
      if (ly === 0 || lx === 0) c = hp < 0.8 ? esc(tons[0], 0.12) : c;
      else if (ly === 1 || lx === 1) c = cla(c, 0.1);
      const ch = ruido(x / 15, y / 15, s + 26);
      if (ch > 0.72) c = misturar(c, "#5a5a3a", ch > 0.76 ? 0.17 : 0.09); // mancha de chuva
      else if (ruido(x / 9, y / 26, s + 27) > 0.8) c = cla(c, 0.1); // caminho gasto
      if (hp < 0.012) c = esc(c, 0.16); // pedrisco
      tela.p(x, y, c);
    }
    // parapeito espesso (9 px): o topo claro, com as pedras de cobertura marcadas e luz em cima e à esquerda;
    // no lado norte aparece a face de dentro dele (4 px, na sombra) e a sombra cai no terraço ao norte e a oeste
    const P = 9, FD = 4;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dN = y, dS = H - 1 - y, dO = x, dL = W - 1 - x;
      const noTopo = dN < P - FD || dS < P - 2 || dO < P - 2 || dL < P - 2;
      if (noTopo) {
        const d = Math.min(dN, dS, dO, dL);
        const horizontal = dN === d || dS === d, q = horizontal ? x : y;
        let c = hash2(Math.floor((q + 5) / 17), horizontal ? (dN === d ? 1 : 2) : dO === d ? 3 : 4, s + 22) < 0.3 ? misturar(t2, t3, 0.5) : t3;
        if (d === 0) c = dN === 0 || dO === 0 ? cla(t3, 0.3) : t1;
        else if (d === 1 && (dN === 1 || dO === 1)) c = cla(t3, 0.16);
        else if ((q + 5) % 17 === 0) c = t1;
        else if ((q + 5) % 17 === 1) c = cla(t3, 0.12);
        else if (hash2(x, y, s + 22) < 0.1) c = t2;
        // beira de dentro do topo (para o terraço): escura a sul e a leste dele, clara nos outros
        if (dS === P - 3 && dO >= P - 2 && dL >= P - 2 || dL === P - 3 && dS >= P - 2 && dN >= P - FD) c = cla(t3, 0.2);
        if (dO === P - 3 && dN >= P - FD && dS >= P - 2) c = t1;
        tela.p(x, y, c);
      } else if (dN < P) {
        // face de dentro do parapeito norte
        const j = dN - (P - FD);
        tela.p(x, y, j === 0 ? esc(t1, 0.22) : j === FD - 1 ? esc(t0, 0.25) : hash2(x, y, s + 28) < 0.15 ? esc(t1, 0.2) : esc(t1, 0.1));
      } else {
        // sombra do parapeito no terraço: ao norte (5 px) e a oeste (6 px), com a ponta em degraus
        const sN = dN - P, sO = dO - (P - 2);
        if (sN < 5) tela.tom(x, y, SOMBRA, 0.4 - sN * 0.07);
        else if (sO < 6) tela.tom(x, y, SOMBRA, 0.36 - sO * 0.055);
        else if (dS === P - 2 || dL === P - 2) tela.tom(x, y, SOMBRA, 0.2);
      }
    }
    // escoadouro de barro no meio da beira de baixo
    const ex = Math.round(W * 0.7);
    tela.ret(ex, H - 5, 5, 6, (x, y, i, j) => (i === 0 ? "#e09a68" : i === 4 ? "#7a3a20" : j === 5 ? "#3a1a10" : "#b5663a"));
    // forno de barro (tabun), jarros e uma esteira de palha com figos secando
    const fx = 24 + Math.floor(hash2(s, 1, 23) * (W - 76)), fy = 22 + Math.floor(hash2(s, 2, 23) * Math.max(1, H - 58));
    for (let y = -2; y < 6; y++) for (let x = -12; x < 16; x++) { const nx = (x - 2) / 14, ny = (y - 2) / 4; if (nx * nx + ny * ny < 1) tela.tom(fx + 3 + x, fy + 11 + y, SOMBRA, 0.38); }
    for (let y = 0; y < 15; y++) for (let x = 0; x < 22; x++) {
      const nx = (x - 10.5) / 11, ny = (y - 13) / 13;
      if (nx * nx + ny * ny > 1 || y > 13) continue;
      const l = -nx * 0.6 - ny * 0.9 + (hash2(x, y, s + 29) - 0.5) * 0.25;
      tela.p(fx - 8 + x, fy + y, l > 1.05 ? "#eeb080" : l > 0.75 ? "#d88a58" : l > 0.3 ? "#b5663a" : l > -0.05 ? "#96502c" : "#74381e");
    }
    tela.elip(fx + 3, fy + 3, 3.4, 2.2, (nx, ny) => (ny < -0.3 ? "#1a0c08" : "#3a1a10")); tela.p(fx + 3, fy + 4, "#e8702a"); tela.p(fx + 2, fy + 4, "#a8401a");
    tela.ret(fx - 1, fy + 10, 9, 4, (x, y, i, j) => (j === 0 ? "#2a1408" : i % 3 === 0 ? "#e8702a" : "#3a1a10"));
    const jarro = (cx, cy, rx, ry, cores) => {
      for (let q = -rx; q <= rx + 3; q++) { tela.tom(cx + q + 2, cy + ry, SOMBRA, 0.34); tela.tom(cx + q + 3, cy + ry + 1, SOMBRA, 0.16); }
      tela.elip(cx, cy, rx, ry, (nx, ny) => { const l = -nx * 0.8 - ny * 0.5; return l > 0.75 ? cores[3] : l > 0.2 ? cores[2] : l > -0.4 ? cores[1] : cores[0]; });
      tela.ret(cx - 2, cy - ry - 2, 4, 2, (x, y, i, j) => (j === 0 ? cores[2] : cores[0])); tela.ret(cx - 1, cy - ry - 2, 2, 1, "#1c1210");
    };
    jarro(W - 36, H - 30, 5, 6, ["#6a2e18", "#964a28", "#c06a3c", "#e8a070"]);
    jarro(W - 25, H - 26, 4, 5, ["#6a5a3e", "#94805a", "#b8a47a", "#dcc8a0"]);
    if (H >= 4 * T) {
      const ex2 = 18, ey = H - 36, cores = loja ? ["#7a2018", "#a8342a", "#c85a44"] : ["#8a6a44", "#b08c5e", "#d0ac78"];
      for (let x = 1; x < 33; x++) { tela.tom(ex2 + x, ey + 19, SOMBRA, 0.3); } for (let y = 1; y < 20; y++) tela.tom(ex2 + 31, ey + y, SOMBRA, 0.3);
      tela.ret(ex2, ey, 31, 19, (x, y, i, j) => (i === 0 || j === 0 ? cores[2] : i === 30 || j === 18 ? esc(cores[0], 0.25) : (j >> 1) % 2 ? (i % 5 === 0 ? cores[0] : cores[1]) : i % 5 === 2 ? cores[1] : cores[2]));
      for (let q = 0; q < 8; q++) { const px = ex2 + 5 + (q % 4) * 7 + (q > 3 ? 2 : 0), py = ey + 5 + Math.floor(q / 4) * 8; tela.elip(px, py, 2.2, 2.2, (nx, ny) => (nx + ny < -0.5 ? "#a878a8" : nx + ny > 0.6 ? "#3e1e3e" : "#6a3a6a")); tela.tom(px + 2, py + 2, SOMBRA, 0.3); }
    }
    // abrigo de sombra (pano listrado sobre quatro estacas), no lado oposto ao forno
    if (W >= 5 * T && H >= 4 * T && hash2(s, 5, 23) > 0.3) {
      const aw = 40, ah = 26, ax = fx + 3 < W / 2 ? W - 22 - aw : 16, ay = 17;
      const tinta = [["#7a2018", "#a8342a", "#c85a44"], ["#22386a", "#34508e", "#5a78b4"], ["#6a4a1e", "#96702e", "#c09a4e"]][Math.floor(hash2(s, 6, 23) * 3)];
      const cru = ["#9c8c6c", "#cdbf9c", "#ece2c4"];
      for (let y = 0; y < ah + 2; y++) for (let x = 0; x < aw + 1; x++) tela.tom(ax + 6 + x, ay + 8 + y, SOMBRA, x < 1 || y < 1 || x >= aw || y >= ah + 1 ? 0.18 : 0.36);
      for (const [px, py] of [[ax - 1, ay - 1], [ax + aw - 1, ay - 1], [ax - 1, ay + ah - 1], [ax + aw - 1, ay + ah - 1]]) { tela.ret(px, py, 2, 2, MADEIRA[1]); tela.p(px, py, MADEIRA[4]); }
      for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
        const faixa = Math.floor(x / 5) % 2, pal = faixa ? tinta : cru;
        if (y === ah - 1 && x % 5 > 2) continue; // barra recortada
        // o pano faz barriga: claro perto das estacas de cima, mais escuro no meio e na barra
        const barriga = Math.sin((y / (ah - 1)) * Math.PI), dobra = (y === 8 || y === 17) ? 1 : 0;
        let c = pal[barriga > 0.8 ? 1 : y < ah / 2 ? 2 : 1];
        if (y < 2) c = cla(pal[2], 0.25); else if (y >= ah - 3) c = pal[0]; else if (dobra) c = pal[0]; else if (y === 9 || y === 18) c = cla(pal[2], 0.15);
        if (x === 0) c = cla(c, 0.2); else if (x === aw - 1) c = esc(c, 0.25);
        else if (x % 5 === 4) c = esc(c, 0.1);
        tela.p(ax + x, ay + y, c);
      }
      for (let x = -1; x <= aw; x++) tela.p(ax + x, ay - 1, x < 1 || x >= aw - 1 ? MADEIRA[4] : MADEIRA[3]); // vara de cima
    }
    // terraço grande: a vida de cima da casa — cama de dormir ao fresco (esteira, manta listrada e rolo de
    // cabeceira) e feixes de linho postos a secar em fileira (como no terraço de Raabe)
    if (W >= 6 * T && H >= 4 * T) {
      const cw = 20, chh = 38;
      let cx = Math.round(W * (fx + 3 < W / 2 ? 0.6 : 0.3)), cy = Math.round(H * 0.5) - (chh >> 1);
      if (Math.abs(cx + 10 - fx) < 30 && Math.abs(cy + 19 - fy) < 34) cy = fy > H / 2 ? 46 : Math.min(H - chh - 44, fy + 30);
      cy = Math.max(46, Math.min(H - chh - 14, cy));
      const manta = [["#6a2a22", "#9c3e30", "#c86a4c", "#e8dcc0"], ["#2a3e6a", "#3e5a94", "#6a86be", "#e8dcc0"], ["#5a4a22", "#8a7434", "#b8a258", "#efe2c4"]][Math.floor(hash2(s, 8, 23) * 3)];
      for (let y = 2; y < chh + 2; y++) for (let x = 2; x < cw + 3; x++) if (x >= cw || y >= chh) tela.tom(cx + x, cy + y, SOMBRA, 0.3);
      tela.ret(cx, cy, cw, chh, (x, y, i, j) => {
        if (i === 0 || j === 0) return "#e2c890"; if (i === cw - 1 || j === chh - 1) return "#8a6a3c";
        if (j < 12) return (i + j) % 3 === 0 ? "#b89658" : j % 2 ? "#d4b478" : "#c6a468"; // esteira de palha à mostra
        const f = Math.floor((j - 12) / 4) % 3, dobra = j === 12 ? 1 : 0;
        let c = f === 0 ? manta[1] : f === 1 ? manta[3] : manta[2];
        if (dobra) c = manta[0]; else if ((j - 12) % 4 === 0) c = esc(c, 0.14);
        if (i < 3) c = cla(c, 0.14); else if (i > cw - 5) c = esc(c, 0.16);
        return c;
      });
      // rolo de cabeceira
      tela.ret(cx + 3, cy + 3, cw - 6, 6, (x, y, i, j) => (j === 0 ? "#f4ead0" : j === 5 ? "#9a8a68" : i === 0 || i === cw - 7 ? "#b8a888" : j < 3 ? "#e6dabc" : "#cfc2a0"));
      for (let x = 4; x < cw - 2; x++) tela.tom(cx + x, cy + 9, SOMBRA, 0.3);
      // feixes de linho: hastes douradas amarradas ao meio, deitadas lado a lado junto ao parapeito norte
      const nf = Math.min(6, Math.floor((W - 150) / 14)), lx0 = Math.round(W * 0.5) - nf * 7 + (fx + 3 < W / 2 ? -20 : 20), ly0 = 17;
      if (!(fy < 48 && Math.abs(fx + 3 - lx0 - nf * 7) < nf * 7 + 22))
        for (let q = 0; q < nf; q++) {
          const bx = lx0 + q * 14, by = ly0 + Math.round((hash2(q, s, 30) - 0.5) * 4);
          for (let y = 1; y < 18; y++) for (let x = 1; x < 11; x++) if (x >= 8 || y >= 16) tela.tom(bx + x + 1, by + y + 1, SOMBRA, 0.26);
          tela.ret(bx, by, 9, 16, (x, y, i, j) => {
            const aperto = Math.abs(j - 8) < 2 ? 1 : 0;
            if (aperto && (i === 0 || i === 8)) return null;
            if (j === 8) return "#7a4a2a"; if (j === 7) return "#a8703e";
            const h = hash2(x, y >> 1, s + 31);
            let c = i % 2 ? (h < 0.4 ? "#b89240" : "#cfa850") : h < 0.3 ? "#e8cc7c" : "#dcb964";
            if (j < 2) c = h < 0.5 ? "#8a9a4a" : "#a8a850"; // pontas ainda verdes
            if (i === 0) c = cla(c, 0.18); else if (i === 8) c = esc(c, 0.22);
            return c;
          });
        }
    }
    // escada de mão encostada no parapeito leste (acesso pelo lado de fora)
    const lx = W - 14;
    for (let y = 12; y < 38; y++) { tela.p(lx, y, MADEIRA[4]); tela.p(lx + 1, y, MADEIRA[2]); tela.p(lx + 7, y, MADEIRA[3]); tela.p(lx + 8, y, MADEIRA[1]); tela.tom(lx + 9, y + 1, SOMBRA, 0.25); }
    for (let y = 14; y < 38; y += 5) { tela.lin(lx + 1, y, lx + 7, y, MADEIRA[4]); tela.lin(lx + 2, y + 1, lx + 6, y + 1, MADEIRA[1]); }
  }

  // Tenda grande vista de cima: pano de pelo de cabra em quatro águas — a de trás (norte) e a da frente (sul)
  // presas na cumeeira, e duas pontas em triângulo (a oeste na luz, a leste na sombra). O pano é feito de
  // faixas de 32 px costuradas que fazem barriga entre as cordas (cada faixa escura à esquerda e clara à
  // direita, luz da esquerda), com listras tecidas em faixas alternadas, uma barra tecida perto do beiral,
  // remendos, mastros com as cordas e o beiral recortado preso por estacas.
  function pintarLona(tela, mat, W, H, s) {
    const [t0, t1, t2, t3] = mat.topo, meio = Math.round(H * 0.4), hx = Math.min(30, W >> 2);
    const R = [esc(t0, 0.32), esc(t0, 0.12), t0, misturar(t0, t1, 0.5), t1, misturar(t1, t2, 0.5), t2, misturar(t2, t3, 0.5), t3, cla(t3, 0.25)];
    const listra = mat.listra || [t0, t1];
    const yBarra = meio + Math.round((H - meio) * 0.66);
    // largura da ponta (triângulo) na linha y: 0 nos cantos, hx na cumeeira
    const ponta = (y) => (y < meio ? (hx * y) / meio : (hx * (H - 1 - y)) / (H - 1 - meio));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const pw = ponta(y), oeste = x < pw, leste = x > W - 1 - pw;
      const onda = (ruido(x / 34, y / 22, s + 31) - 0.5) * 0.14;
      let l, c;
      if (oeste || leste) {
        // pontas: o pano desce da cumeeira para o lado; faixas ao comprido (dobras na horizontal)
        const d = oeste ? x / Math.max(1, pw) : (W - 1 - x) / Math.max(1, pw); // 0 na beira, 1 na aresta
        const dobra = Math.sin(((y % 24) / 24) * Math.PI * 2) * 0.05;
        l = oeste ? 0.7 + d * 0.16 + dobra : 0.2 + d * 0.14 + dobra;
        c = rampa(R, Math.max(0, Math.min(0.999, l + onda)), x, y);
        if (d > 0.93) c = oeste ? R[9] : misturar(c, R[0], 0.5); // aresta
        tela.p(x, y, c);
        continue;
      }
      const px = x % 32, fx = Math.floor(x / 32);
      const prega = Math.sin((px / 32 - 0.5) * Math.PI); // −1 logo depois da costura, +1 antes da seguinte
      if (y < meio) { const v = y / meio; l = 0.64 + v * 0.2 + prega * 0.07; } // água de trás: clareia até a cumeeira
      else { const v = (y - meio) / (H - meio); l = 0.6 - v * 0.2 + prega * (0.07 + 0.06 * Math.sin(v * Math.PI)); } // água da frente
      l += onda - (x / W) * 0.06;
      c = rampa(R, Math.max(0, Math.min(0.999, l)), x, y);
      // barra tecida perto do beiral (acompanha a barriga do pano)
      const jb = y - yBarra - Math.round(Math.sin((px / 32) * Math.PI) * 2);
      if (jb >= 0 && jb < 6) {
        c = jb === 0 || jb === 5 ? esc(listra[0], 0.3) : jb === 1 || jb === 4 ? listra[1] : (px + (jb === 2 ? 0 : 2)) % 6 < 3 ? "#e8dcc0" : listra[0];
        if (prega < -0.5) c = esc(c, 0.14);
      } else if (fx % 2 === 0 && px >= 15 && px <= 17) {
        // listra tecida ao comprido das faixas alternadas
        c = px === 15 ? esc(listra[0], 0.2) : px === 16 ? listra[1] : listra[0];
        if (y >= meio) c = esc(c, 0.1);
      } else if (px === 0) c = misturar(c, R[0], 0.5); // costura entre as faixas
      else if (px === 31) c = misturar(c, R[9], 0.3);
      else if ((x + y * 3) % 7 === 0 && hash2(x, y, s + 32) < 0.3) c = misturar(c, R[1], 0.25); // trama grossa
      tela.p(x, y, c);
    }
    // remendos costurados
    for (let q = 0; q < 3; q++) {
      const px = hx + 8 + Math.floor(hash2(s, q, 33) * Math.max(1, W - 2 * hx - 30)), py = 8 + Math.floor(hash2(s, q, 34) * (H - 26));
      if (Math.abs(py - meio) < 12 || Math.abs(py - yBarra) < 14 || (px % 32 > 4 && px % 32 < 20) || px % 32 > 21) continue;
      tela.ret(px, py, 9, 7, (x, y, i, j) => (i === 0 || j === 0 || i === 8 || j === 6 ? ((i + j) % 2 ? R[0] : R[5]) : py < meio ? R[7] : R[5]));
    }
    // cumeeira: a vara por baixo do pano faz um vinco claro em cima e uma sombra logo abaixo
    for (let x = hx; x < W - hx; x++) {
      tela.p(x, meio - 2, R[8]); tela.p(x, meio - 1, R[9]); tela.p(x, meio, R[6]);
      tela.tom(x, meio + 1, SOMBRA, 0.4); tela.tom(x, meio + 2, SOMBRA, 0.24); tela.tom(x, meio + 3, SOMBRA, 0.1);
    }
    // beiras: luz ao norte e a oeste, sombra a leste
    for (let x = 0; x < W; x++) { tela.p(x, 0, R[9]); tela.p(x, 1, R[8]); }
    for (let y = 0; y < H; y++) { tela.p(0, y, R[9]); tela.p(1, y, R[8]); tela.p(W - 1, y, R[0]); tela.p(W - 2, y, R[1]); }
    // mastros nas pontas da cumeeira e no meio (a ponta fura o pano), com a sombra de cada um e as cordas
    for (const x of [hx, W >> 1, W - 1 - hx]) {
      for (let q = 1; q < 14; q++) { tela.tom(x + 1 + q, meio + Math.round(q * 0.5), SOMBRA, 0.36); tela.tom(x + 1 + q, meio + 1 + Math.round(q * 0.5), SOMBRA, 0.18); }
      tela.ret(x - 1, meio - 11, 3, 12, (xx, y, i) => (i === 0 ? MADEIRA[5] : i === 1 ? MADEIRA[3] : MADEIRA[1]));
      tela.p(x, meio - 12, "#e8b94a"); tela.p(x - 1, meio - 12, "#f6dc90"); tela.p(x + 1, meio - 12, "#b07a38"); tela.p(x, meio - 13, "#f6dc90");
    }
    // cordas de amarração: da cumeeira aos cantos, por cima das arestas das pontas
    for (const [xa, xb] of [[hx, 2], [W - 1 - hx, W - 3]]) for (const yb of [2, H - 3]) {
      const n = Math.max(Math.abs(xb - xa), Math.abs(yb - meio));
      for (let q = 3; q < n; q++) if (q % 5 < 3) tela.p(Math.round(xa + ((xb - xa) * q) / n), Math.round(meio + ((yb - meio) * q) / n), xb < xa ? misturar(R[9], "#fff6e0", 0.2) : R[4]);
    }
    // beiral do sul: a barra do pano recortada em meias-luas entre as estacas, com a sombra em cima dela
    for (let x = 0; x < W; x++) {
      const px = x % 32, cai = Math.round(Math.sin((px / 32) * Math.PI) * 2);
      for (let q = 0; q < 3 + cai; q++) tela.tom(x, H - 1 - q, SOMBRA, 0.3 - q * 0.05);
      tela.p(x, H - 1, (x >> 1) % 2 ? R[1] : R[0]);
      if (px === 0 || px === 31) { tela.p(x, H - 2, MADEIRA[4]); tela.p(x, H - 3, MADEIRA[5]); }
    }
  }

  // Toldo listrado sobre a porta (3 casas), com as varas, e a placa pendurada ao lado, com o sinal do comerciante.
  function pintarToldoEPlaca(tela, e, mat, W, fy, porta, s, AP = 32) {
    const cores = mat.id === "tenda" ? ["#2e4680", "#e8dcc0"] : mat.id === "basalto" ? ["#3b5a9a", "#e8dcc0"] : ["#a8342a", "#efe2c4"];
    const { vh } = vaoDaPorta(AP), alt = Math.round(10 * (AP > 48 ? 1.4 : 1));
    const x0 = Math.max(0, (porta - 1) * T + 4), x1 = Math.min(W, (porta + 2) * T - 4), y0 = Math.max(fy + 2, fy + AP - vh - alt + 1);
    // sombra do toldo na parede
    for (let x = x0 + 2; x < x1 + 2; x++) for (let q = 0; q < 4; q++) tela.tom(x, y0 + alt + 2 + q, SOMBRA, 0.42 - q * 0.09);
    for (let y = y0; y < y0 + alt; y++) for (let x = x0; x < x1; x++) {
      const faixa = Math.floor((x - x0) / 8) % 2, lx = (x - x0) % 8, j = y - y0;
      let c = faixa ? cores[1] : cores[0];
      // o pano cai para a frente: claro em cima, sombra na dobra de baixo e barriga entre as varas
      if (j === 0) c = cla(c, 0.3);
      else if (j === 1) c = cla(c, 0.12);
      else if (j > alt - 3) c = esc(c, 0.22);
      else if (j > alt - 5) c = esc(c, 0.1);
      if (lx === 0 && j > 1) c = esc(c, 0.14);
      tela.p(x, y, c);
    }
    // borda recortada (meias-luas)
    for (let x = x0; x < x1; x++) {
      const lx = (x - x0) % 8, cor = Math.floor((x - x0) / 8) % 2 ? cores[1] : cores[0];
      if (lx > 0 && lx < 7) tela.p(x, y0 + alt, esc(cor, 0.12));
      if (lx > 1 && lx < 6) tela.p(x, y0 + alt + 1, esc(cor, 0.26));
    }
    for (const x of [x0, x1 - 1]) { tela.ret(x, y0 - 1, 1, alt + 2, MADEIRA[1]); tela.p(x, y0 - 2, "#e8b94a"); }
    // placa: suporte de ferro e tábua com a balança de dois pratos
    const lado = porta + 1 < Math.round(W / T) ? 1 : -1;
    const bx = lado > 0 ? (porta + 2) * T - 2 : (porta - 1) * T + 2;
    const pyb = Math.max(y0 + alt + 4, fy + AP - vh + 1);
    tela.lin(bx, pyb, bx + lado * 10, pyb, "#2a2a2a"); tela.lin(bx, pyb + 1, bx + lado * 3, pyb + 1, "#4a4a4a");
    tela.lin(bx + lado * 3, pyb + 1, bx + lado * 3, pyb + 3, "#2a2a2a");
    tela.lin(bx + lado * 9, pyb + 1, bx + lado * 9, pyb + 3, "#2a2a2a");
    const qx = lado > 0 ? bx + 1 : bx - 13, qy = pyb + 4;
    for (let i = 1; i < 14; i++) { tela.tom(qx + i + 1, qy + 11, SOMBRA, 0.35); tela.tom(qx + 13, qy + Math.min(10, i), SOMBRA, 0.3); }
    tela.ret(qx, qy, 13, 11, (x, y, i, j) => (i === 0 || j === 0 || i === 12 || j === 10 ? MADEIRA[1] : j === 1 || i === 1 ? MADEIRA[5] : j % 4 === 2 ? MADEIRA[3] : MADEIRA[4]));
    // balança
    tela.lin(qx + 6, qy + 2, qx + 6, qy + 8, "#e8b94a");
    tela.lin(qx + 2, qy + 3, qx + 10, qy + 3, "#f6dc90");
    tela.lin(qx + 1, qy + 6, qx + 4, qy + 6, "#e8b94a"); tela.lin(qx + 8, qy + 6, qx + 11, qy + 6, "#e8b94a");
    tela.p(qx + 2, qy + 5, "#b07a38"); tela.p(qx + 9, qy + 5, "#b07a38"); tela.p(qx + 2, qy + 4, "#b07a38"); tela.p(qx + 10, qy + 4, "#b07a38");
    tela.lin(qx + 4, qy + 9, qx + 8, qy + 9, "#b07a38");
  }

  // Sombra projetada do prédio no chão, para a direita e para baixo (luz de cima e da esquerda): a pegada
  // arrastada por metade da altura da parede para a direita e um quarto para baixo. As beiras de longe são
  // suaves (pontilhado em dois degraus); as diagonais dos cantos são nítidas. Imagem posta no canto da pegada.
  function pintarSombra(W, H, AP = 32) {
    const sx = Math.round(AP * 0.5), sy = Math.round(AP * 0.25);
    const tela = new Tela(W + sx, H + sy);
    for (let y = 0; y < H + sy; y++) for (let x = 0; x < W + sx; x++) {
      if (x < W && y < H) continue;
      // menor t (0..1) com (x − sx·t, y − sy·t) dentro da pegada: quanto do caminho da sombra o ponto usa
      const t0 = Math.max(x >= W ? (x - W + 1) / sx : 0, y >= H ? (y - H + 1) / sy : 0);
      if (t0 > 1) continue;
      if (x - sx * t0 < 0 || y - sy * t0 < 0) continue; // fora das diagonais dos cantos
      const beira = (1 - t0) * Math.min(sx, sy * 2); // px até a beira de longe
      let a = 0.34;
      if (beira < 2) a = (x + y) % 2 ? 0.12 : 0.05; else if (beira < 4) a = (x + y) % 2 ? 0.22 : 0.12; else if (beira < 7) a = (x + y) % 2 ? 0.34 : 0.24;
      // junto à parede a sombra é mais densa
      if (t0 < 0.14) a = 0.44;
      tela.p(x, y, SOMBRA, a);
    }
    return tela;
  }

  // ---------------------------------------------------------------- móveis (32 × 48, base na linha 47)
  // viz: { esq, dir } para o balcão emendar com os vizinhos. Volume: luz de cima e da esquerda, tampo visto
  // de cima, frente na sombra e sombra projetada no chão à direita.
  function pintarMovel(tipo, mat, viz = {}, semente = 0) {
    const tela = new Tela(T, 48);
    const B = 46;
    const M = MADEIRA;
    // cilindro em pé (barril, jarro): l de −1 (esquerda, luz) a 1 (direita, sombra)
    const tomCil = (nx, cores) => (nx < -0.62 ? cores[2] : nx < -0.25 ? cores[3] : nx < 0.3 ? cores[2] : nx < 0.68 ? cores[1] : cores[0]);
    switch (tipo) {
      case "balcao": {
        const x0 = viz.esq ? 0 : 2, x1 = viz.dir ? T : T - 2;
        // tampo (visto de cima, 9 px): tábuas ao comprido, beira da frente arredondada
        tela.ret(x0, B - 27, x1 - x0, 9, (x, y, i, j) => (j === 0 ? M[5] : j === 8 ? M[2] : j === 7 ? M[3] : j === 4 ? M[3] : (x * 3 + j) % 13 === 0 ? M[3] : M[4]));
        // frente: almofadas de tábua vertical entre travessas, na sombra do tampo
        tela.ret(x0, B - 18, x1 - x0, 19, (x, y, i, j) => (j === 0 ? "#22140c" : j === 1 ? M[0] : j < 4 ? M[2] : j > 15 ? (j === 18 ? M[0] : M[1]) : x % 8 === 0 ? M[0] : x % 8 === 1 ? M[4] : x % 8 === 7 ? M[2] : M[3]));
        for (let x = x0; x < x1; x++) if (x % 8 === 4) { tela.p(x, B - 14, M[1]); tela.p(x, B - 4, M[1]); }
        if (!viz.esq) { tela.ret(x0, B - 27, 1, 27, M[5]); tela.ret(x0, B - 18, 2, 19, (x, y, i) => (i ? M[2] : M[4])); }
        if (!viz.dir) { tela.ret(x1 - 2, B - 18, 2, 19, (x, y, i) => (i ? M[0] : M[1])); tela.ret(x1 - 1, B - 27, 1, 9, M[2]); }
        // mercadoria sobre o balcão
        const k = Math.floor(hash2(semente, 3, 90) * 5);
        const cx = 9 + Math.floor(hash2(semente, 4, 90) * 13), cy = B - 22;
        for (let q = -3; q < 6; q++) tela.tom(cx + q, cy, SOMBRA, 0.28);
        if (k === 0) { tela.elip(cx, cy - 4, 3.6, 4.4, (nx, ny) => tomCil(nx, ["#7a3a20", "#a8562e", "#c8703c", "#eaa070"])); tela.ret(cx - 1, cy - 10, 3, 2, (x, y, i) => (i === 0 ? "#c8703c" : "#7a3a20")); }
        else if (k === 1) { for (let i = 0; i < 5; i++) { tela.elip(cx - 4 + i * 2, cy - 1 - (i % 2), 1.8, 1.3, (nx, ny) => (ny < -0.2 ? "#f6dc90" : nx > 0.3 ? "#a8782a" : "#e8b94a")); } tela.elip(cx, cy - 4, 1.8, 1.3, "#e8b94a"); tela.p(cx - 1, cy - 5, "#fff0a0"); }
        else if (k === 2) { tela.ret(cx - 5, cy - 4, 11, 4, (x, y, i, j) => (j === 0 ? "#f0e2bc" : j === 3 ? "#9a8660" : i === 10 ? "#a8946a" : "#cdb98e")); tela.ret(cx - 4, cy - 7, 9, 3, (x, y, i, j) => (j === 0 ? "#7a9ae0" : i === 8 ? "#26386a" : "#3b5a9a")); }
        else if (k === 3) { tela.lin(cx, cy - 9, cx, cy - 1, "#b07a38"); tela.lin(cx - 5, cy - 8, cx + 5, cy - 8, "#f6dc90"); tela.lin(cx - 5, cy - 7, cx - 5, cy - 5, "#b07a38"); tela.lin(cx + 5, cy - 7, cx + 5, cy - 5, "#b07a38"); tela.elip(cx - 5, cy - 4, 2.6, 1.1, "#e8b94a"); tela.elip(cx + 5, cy - 4, 2.6, 1.1, "#e8b94a"); tela.ret(cx - 2, cy - 1, 5, 1, "#8a5a28"); }
        else { tela.elip(cx, cy - 2, 5, 2.8, (nx, ny) => (ny < -0.3 ? "#e0c088" : nx > 0.5 ? "#7a5a30" : (Math.round(nx * 5) & 1) ? "#a8865e" : "#c8a470")); tela.elip(cx - 2, cy - 4, 1.8, 1.5, (nx, ny) => (nx + ny < -0.4 ? "#f08070" : "#c8402f")); tela.elip(cx + 2, cy - 4, 1.8, 1.5, (nx, ny) => (nx + ny < -0.4 ? "#b8d86a" : "#7a9a3a")); tela.elip(cx, cy - 5, 1.6, 1.3, "#e8b94a"); }
        break;
      }
      case "barris": {
        const barril = (cx, by, rx, h) => {
          for (let y = by - h; y <= by; y++) for (let x = cx - rx; x <= cx + rx; x++) {
            const ty = (y - (by - h)) / h, bojo = 0.86 + 0.14 * Math.sin(ty * Math.PI), nx = (x - cx) / (rx * bojo);
            if (Math.abs(nx) > 1) continue;
            let c = tomCil(nx, [M[1], M[2], M[3], M[5]]);
            if ((x - cx + 20) % 4 === 0) c = M[1]; // aduelas
            const aro = Math.abs(ty - 0.2) < 0.045 || Math.abs(ty - 0.8) < 0.045;
            if (aro) c = nx < -0.3 ? "#8a8a8a" : nx > 0.5 ? "#2a2a2a" : "#565656";
            if (y === by) c = M[0];
            tela.p(x, y, c);
          }
          // tampa vista de cima, com a borda das aduelas
          tela.elip(cx, by - h, rx - 0.6, 2.8, (nx, ny) => (nx * nx + ny * ny > 0.62 ? (ny < 0 ? M[5] : M[2]) : (Math.round(nx * 5) & 1) ? M[4] : M[3]));
          tela.p(cx + 1, by - h, M[1]);
        };
        barril(21, B - 5, 7, 17); barril(10, B, 8, 20);
        break;
      }
      case "caixotes": {
        const caixa = (x, y, w, h) => {
          // tampo visto de cima (4 px) e frente com moldura e travessa em X
          tela.ret(x, y - 4, w, 4, (xx, yy, i, j) => (j === 0 || i === 0 ? M[5] : i === w - 1 ? M[3] : i % 5 === 0 ? M[3] : M[4]));
          tela.ret(x, y, w, h, (xx, yy, i, j) => (j === 0 ? M[1] : i === 0 ? M[4] : i === w - 1 || j === h - 1 ? M[0] : i < 3 || j < 3 || i > w - 4 || j > h - 3 ? M[3] : Math.abs(i * (h / w) - j) < 1 || Math.abs((w - 1 - i) * (h / w) - j) < 1 ? M[3] : (i + 1) % 4 === 0 ? M[1] : M[2]));
          tela.p(x + 1, y + 1, "#2a2a2a"); tela.p(x + w - 2, y + 1, "#2a2a2a"); tela.p(x + 1, y + h - 2, "#2a2a2a"); tela.p(x + w - 2, y + h - 2, "#2a2a2a");
        };
        caixa(15, B - 12, 15, 13); caixa(2, B - 13, 15, 14); caixa(7, B - 28, 14, 11);
        break;
      }
      case "sacos": {
        const saco = (cx, by, r, cores) => {
          tela.elip(cx, by - r, r, r + 1, (nx, ny, x, y) => { const l = -nx * 0.7 - ny * 0.7; return (x + y) % 5 === 0 && l < 0.6 ? cores[1] : l > 0.8 ? cores[3] : l > 0.15 ? cores[2] : l > -0.5 ? cores[1] : cores[0]; });
          tela.ret(cx - 2, by - 2 * r - 3, 4, 3, (x, y, i) => (i === 0 ? cores[2] : cores[0])); tela.lin(cx - 2, by - 2 * r - 1, cx + 2, by - 2 * r - 1, "#5a3c22");
          tela.p(cx - 3, by - 2 * r - 4, cores[2]); tela.p(cx + 2, by - 2 * r - 4, cores[1]);
        };
        const juta = ["#7a6440", "#a08a5c", "#c8b082", "#e6d2a2"];
        saco(22, B - 1, 6, juta); saco(9, B, 7, juta); saco(15, B - 10, 6, ["#806a46", "#a89264", "#d0b88a", "#eedcb0"]);
        // saco aberto com grão
        tela.elip(15, B - 22, 3.4, 1.8, (nx, ny) => (ny < 0 ? "#f0d878" : "#c8a850")); tela.p(14, B - 23, "#fff0a0");
        break;
      }
      case "cama": {
        // esteira de dormir sobre um estrado baixo, com almofada e manta dobrada
        tela.ret(1, B - 24, 30, 24, (x, y, i, j) => (j === 0 || i === 0 ? M[5] : i === 29 ? M[1] : j > 20 ? (j === 23 ? M[0] : M[1]) : M[3]));
        tela.ret(3, B - 22, 26, 18, (x, y, i, j) => (i === 0 || j === 0 ? "#e2d0a4" : j % 3 === 0 ? "#a08a60" : i % 2 ? "#c2ac80" : "#d0ba8c"));
        // almofada
        tela.elip(9.5, B - 18, 6, 3.2, (nx, ny) => { const l = -nx * 0.6 - ny; return l > 0.6 ? "#fbf4e2" : l > -0.2 ? "#e6dcc2" : "#b8ac8c"; });
        // manta listrada, com a dobra em cima e a barriga do corpo
        tela.ret(3, B - 14, 26, 11, (x, y, i, j) => { const base = (i + j) % 7 < 2 ? "#d8a85a" : (i + j) % 7 < 4 ? "#7a2018" : "#9a2c22"; return j === 0 ? "#c8544a" : j === 1 ? "#b0402e" : i > 22 ? esc(base, 0.25) : j > 8 ? esc(base, 0.2) : base; });
        tela.ret(3, B - 3, 26, 1, SOMBRA, 0.45);
        break;
      }
      case "jarros": {
        const jarro = (cx, by, rx, h, cores, faixa) => {
          for (let y = by - h; y <= by; y++) for (let x = cx - rx; x <= cx + rx; x++) {
            const t = (y - (by - h)) / h, larg = rx * (t < 0.12 ? 0.5 : t < 0.2 ? 0.42 : Math.sin(Math.min(1, (t - 0.1) * 1.15) * Math.PI * 0.94) * 0.86 + 0.14);
            const nx = (x - cx) / Math.max(1, larg);
            if (Math.abs(nx) > 1) continue;
            let c = tomCil(nx, cores);
            if (faixa && Math.abs(t - 0.42) < 0.05) c = nx < 0.3 ? faixa[1] : faixa[0];
            if (t > 0.9) c = cores[0];
            tela.p(x, y, c);
          }
          // boca vista de cima e asas
          tela.elip(cx, by - h, rx * 0.5 + 0.4, 1.6, (nx, ny) => (nx * nx + ny * ny < 0.4 ? "#1c1210" : ny < 0 ? cores[3] : cores[1]));
          tela.p(cx - Math.round(rx * 0.7), by - Math.round(h * 0.78), cores[2]); tela.p(cx + Math.round(rx * 0.7), by - Math.round(h * 0.78), cores[0]);
          tela.p(cx - Math.round(rx * 0.35), by - Math.round(h * 0.55), cores[3]); tela.p(cx - Math.round(rx * 0.35), by - Math.round(h * 0.55) + 1, cores[3]);
        };
        jarro(22, B - 6, 6, 19, ["#6a5a3e", "#94805a", "#b8a47a", "#e0cca4"], ["#5a3c22", "#8a5a32"]);
        jarro(11, B, 8, 28, ["#6a2e18", "#964a28", "#c06a3c", "#eaa070"], ["#3a2414", "#e8dcc0"]);
        break;
      }
      case "mesa": {
        // banquinho atrás, mesa baixa com pão, tigela e copo
        tela.ret(22, B - 14, 8, 3, (x, y, i, j) => (j === 0 ? M[5] : j === 2 ? M[2] : M[4])); tela.ret(23, B - 11, 2, 9, M[2]); tela.ret(28, B - 11, 2, 9, M[1]);
        tela.ret(2, B - 23, 25, 8, (x, y, i, j) => (j === 0 || i === 0 ? M[5] : i === 24 ? M[3] : j === 7 ? M[2] : (i * 2 + j) % 11 === 0 ? M[3] : M[4]));
        tela.ret(2, B - 15, 25, 3, (x, y, i, j) => (j === 0 ? M[1] : i === 0 ? M[3] : j === 2 ? M[0] : M[2]));
        tela.ret(3, B - 12, 3, 12, (x, y, i) => (i === 0 ? M[3] : i === 2 ? M[1] : M[2])); tela.ret(23, B - 12, 3, 12, (x, y, i) => (i === 0 ? M[2] : M[0]));
        tela.ret(8, B - 12, 14, 2, SOMBRA, 0.25);
        for (let q = 5; q < 24; q++) tela.tom(q, B - 18, SOMBRA, 0.14);
        tela.elip(9, B - 20, 4.4, 2.4, (nx, ny) => (nx + ny * 1.4 < -0.5 ? "#f2cc80" : nx > 0.5 || ny > 0.5 ? "#a06a30" : "#d09a4c")); tela.lin(7, B - 21, 10, B - 20, "#a06a30");
        tela.elip(17, B - 19, 3, 1.8, (nx, ny) => (nx * nx + ny * ny < 0.4 ? "#7a2a4a" : ny < 0 ? "#e0a070" : "#a8562e"));
        tela.ret(22, B - 25, 3, 5, (x, y, i, j) => (j === 0 ? "#3a1a10" : i === 0 ? "#eaa070" : i === 2 ? "#8e4a2a" : "#c06a3c"));
        break;
      }
    }
    // contorno e sombra projetada no chão (à direita e embaixo), fora do contorno
    const corpo = new Uint8Array(T * 48);
    for (let i = 0; i < corpo.length; i++) corpo[i] = tela.buf[i * 4 + 3] ? 1 : 0;
    tela.contorno(esc(M[0], 0.45));
    for (let y = B - 8; y < 48; y++) for (let x = 0; x < T; x++) {
      if (tela.buf[(y * T + x) * 4 + 3]) continue;
      let d = 0;
      for (let q = 1; q <= 5 && !d; q++) { const sx = x - q, sy = y - Math.ceil(q / 2); if (sx >= 0 && sy >= 0 && corpo[sy * T + sx] && sy >= B - 10) d = q; }
      if (d) tela.p(x, y, SOMBRA, d > 3 ? 0.16 : 0.3);
    }
    return tela;
  }

  // Folha da porta (32 × AP, na casa da porta, com a base no chão): fechada (tábuas com travessas, cravos e
  // argola de ferro; na tenda, a aba de pano baixada) ou aberta (encostada à esquerda; na tenda, a aba amarrada).
  function pintarPorta(mat, aberta, AP = alturaParede()) {
    const tela = new Tela(T, AP);
    const { vw, vh, vx, arco } = vaoDaPorta(AP), vt = AP - vh;
    const dentroDoArco = (x, y) => {
      const ax = (x + 0.5 - (vx + vw / 2)) / (vw / 2), ay = (y + 0.5 - (vt + arco)) / arco;
      return x >= vx && x < vx + vw && y >= vt && y < AP && !(y < vt + arco && ax * ax + ay * ay > 1);
    };
    if (mat.textura === "pano") {
      const [c0, c1, c2, c3] = mat.face, l = mat.listra || [c0, c1];
      if (aberta) {
        for (let y = vt; y < AP; y++) for (let x = vx; x < vx + 7; x++) if (dentroDoArco(x, y)) { const aperto = Math.abs(y - (vt + vh * 0.45)) < 2 ? 2 : 0; if (x - vx >= 7 - aperto) continue; tela.p(x, y, (y >> 2) % 3 === 0 ? l[1] : x === vx ? c3 : x - vx > 4 ? c0 : x & 1 ? c1 : c2); }
        tela.lin(vx, vt + Math.round(vh * 0.45), vx + 5, vt + Math.round(vh * 0.45), "#3a2414");
      } else {
        for (let y = vt; y < AP; y++) for (let x = vx; x < vx + vw; x++) if (dentroDoArco(x, y)) {
          const dobra = Math.sin(((x - vx) / vw) * Math.PI * 3 + y * 0.08);
          tela.p(x, y, (y - vt) % 9 < 2 ? l[dobra > 0 ? 1 : 0] : dobra > 0.5 ? c3 : dobra > -0.1 ? c2 : dobra < -0.7 ? c0 : c1);
        }
        for (let x = vx; x < vx + vw; x++) if (dentroDoArco(x, AP - 1)) tela.p(x, AP - 1, c0);
      }
      return tela;
    }
    const M = MADEIRA;
    if (aberta) {
      // a folha encostada no batente esquerdo, de quina (5 px), com as ferragens
      for (let y = vt + arco; y < AP - 1; y++) for (let i = 0; i < 5; i++) tela.p(vx + i, y, i === 0 ? M[5] : i === 4 ? M[1] : i === 3 ? M[2] : M[4]);
      for (const y of [vt + arco + 4, AP - 7]) { tela.p(vx + 1, y, "#4a4a4a"); tela.p(vx + 2, y, "#2a2a2a"); tela.p(vx + 3, y, "#2a2a2a"); }
      for (let y = vt + arco + 1; y < AP - 1; y++) tela.p(vx + 5, y, "#0e0806", 0.6);
      return tela;
    }
    const tr1 = vt + arco + 3, tr2 = AP - 8; // travessas com as ferragens
    for (let y = vt; y < AP; y++) for (let x = vx; x < vx + vw; x++) {
      if (!dentroDoArco(x, y)) continue;
      const lx = x - vx, tab = lx % 6, nt = Math.floor(lx / 6);
      let c = tab === 0 ? M[1] : tab === 1 ? M[5] : tab === 5 ? M[2] : hash2(nt, y >> 2, 95) < 0.2 ? M[3] : M[4];
      if (hash2(nt, 7, 96) < 0.4 && tab > 1) c = c === M[4] ? M[3] : c;
      if (!dentroDoArco(x, y - 1) || !dentroDoArco(x - 1, y)) c = esc(c, 0.35); // sombra da ombreira
      if (y === AP - 1) c = M[0];
      if (y === tr1 || y === tr2) c = tab === 0 ? "#1c1c1c" : "#5a5a5a"; else if (y === tr1 + 1 || y === tr2 + 1) c = "#2a2a2a"; else if (y === tr1 + 2 || y === tr2 + 2) c = esc(c, 0.3);
      if ((y === tr1 || y === tr2) && tab === 3) c = "#9a9a9a"; // cravo
      tela.p(x, y, c);
    }
    // argola de ferro
    const ax = vx + vw - 6, ay = vt + Math.round(vh * 0.55);
    tela.p(ax, ay - 1, "#8a8a8a"); tela.p(ax - 1, ay, "#e8b94a"); tela.p(ax + 1, ay, "#b07a38"); tela.p(ax - 1, ay + 1, "#b07a38"); tela.p(ax + 1, ay + 1, "#8a5a28"); tela.p(ax, ay + 2, "#b07a38"); tela.p(ax + 1, ay + 2, SOMBRA, 0.5);
    return tela;
  }
  function texturaPorta(scene, variante, aberta) {
    const AP = alturaParede(), chave = `porta_${variante || 0}_${aberta ? 1 : 0}_h${AP}`;
    if (!scene.textures.exists(chave)) scene.textures.addCanvas(chave, pintarPorta(material(variante), aberta, AP).canvas());
    return chave;
  }

  // Registra as texturas do prédio na cena; devolve as chaves (a altura da parede entra na chave).
  function texturasPredio(scene, e) {
    const base = `pr_${e.tipo}_${e.x}_${e.y}_${e.variante || 0}_h${alturaParede()}`;
    const chaves = { chao: base + "_chao", dentro: base + "_dentro", fora: base + "_fora", sombra: base + "_sombra" };
    if (!scene.textures.exists(chaves.fora)) {
      const telas = pintarPredio(e);
      for (const [k, tela] of Object.entries(telas)) scene.textures.addCanvas(chaves[k], tela.canvas());
    }
    return chaves;
  }
  function texturaMovel(scene, tipo, variante, viz, semente) {
    const chave = `mv_${tipo}_${variante || 0}_${viz.esq ? 1 : 0}${viz.dir ? 1 : 0}_${tipo === "balcao" ? semente % 7 : 0}`;
    if (!scene.textures.exists(chave)) scene.textures.addCanvas(chave, pintarMovel(tipo, material(variante), viz, semente % 7).canvas());
    return chave;
  }

  // ---------------------------------------------------------------- muros contínuos
  // Muro de vila (e mureta de campo) que emenda com os vizinhos: mask N1 L2 S4 O8. Textura 32 × (32 + altura):
  // o topo (a pegada subida ALTURA_MURO px, com pedras de cobertura) e a face de baixo, que aparece onde o
  // muro não continua para o sul. A sombra do muro no chão (à direita e embaixo) é assada no chão contínuo.
  const ALTURA_MURO = 34;
  const MUROS = {
    muro: { face: ["#5a5242", "#7c725e", "#9c9178", "#b8ad92"], textura: "blocos", topo: ["#6e6452", "#978b73", "#b4a88c", "#d2c8aa"], pe: "relva", area: "canaan" },
    tijolos: { face: ["#562c1a", "#784226", "#985834", "#b67048"], textura: "tijolo", topo: ["#7c4e30", "#a46c46", "#be8456", "#d8a070"], pe: "areia", area: "egito" },
  };
  // fiadas da face (somam 34 px) e as juntas de cada uma, periódicas em 32 px (o muro emenda com o vizinho)
  const FIADAS_MURO = [[0, 8, [0, 11, 22]], [8, 9, [6, 17, 27]], [17, 8, [0, 13, 24]], [25, 9, [4, 15, 26]]];
  function corFaceMuro(m, x, ly, v) {
    const [c0, c1, c2, c3] = m.face;
    if (m.textura === "tijolo") {
      const fila = Math.floor(ly / 5), by = ly % 5, off = (fila % 2) * 4, bx = (x + off) % 8, col = Math.floor((x + off) / 8) % 4;
      if (by === 4 || bx === 7) return c0;
      const cruza = off && col === 0;
      const tom = cruza ? hash2(7, fila, 333) : hash2(col + v * 5, fila, 334);
      let c = tom < 0.3 ? c1 : tom > 0.82 ? c3 : c2;
      if (tom > 0.45 && tom < 0.52) c = misturar(c1, "#3a2a22", 0.35); // tijolo queimado
      if (by === 0) c = cla(c, 0.16);
      else if (by === 3 && bx > 0) c = esc(c, 0.1);
      if (hash2(x + v * 40, ly, 335) < 0.05) c = esc(c, 0.12);
      return c;
    }
    let f = FIADAS_MURO[FIADAS_MURO.length - 1], fi = FIADAS_MURO.length - 1;
    for (let k = 0; k < FIADAS_MURO.length; k++) if (ly >= FIADAS_MURO[k][0] && ly < FIADAS_MURO[k][0] + FIADAS_MURO[k][1]) { f = FIADAS_MURO[k]; fi = k; break; }
    const by = ly - f[0], juntas = f[2];
    let b = juntas.length - 1;
    for (let k = 0; k < juntas.length; k++) if (x >= juntas[k]) b = k;
    const cruza = x < juntas[0] || b === juntas.length - 1 && juntas[0] > 0;
    const ini = x < juntas[0] ? juntas[juntas.length - 1] - 32 : juntas[b];
    const fim = x < juntas[0] ? juntas[0] : b + 1 < juntas.length ? juntas[b + 1] : juntas[0] + 32;
    const bx = x - ini, bw = fim - ini;
    if (by === 0 || bx === 0) return c0;
    const tom = cruza ? hash2(9, fi, 336) : hash2(b + v * 5, fi, 337);
    let c = tom < 0.28 ? c1 : tom > 0.8 ? misturar(c2, c3, 0.6) : tom > 0.55 ? c2 : misturar(c1, c2, 0.55);
    if (by === 1 || bx === 1) c = cla(c, 0.2);
    else if (by === f[1] - 1 || bx === bw - 1) c = esc(c, 0.2);
    else if (hash2(x + v * 40, ly, 338) < 0.07) c = esc(c, 0.1);
    else if (hash2(x + v * 40, ly, 339) < 0.04) c = cla(c, 0.1);
    return c;
  }
  function pintarMuro(tipo, mask, v) {
    const m = MUROS[tipo] || MUROS.muro, h = ALTURA_MURO, tela = new Tela(T, T + h);
    matiz(m.area);
    const a = 9, b = 23; // espessura do muro: 14 px no meio da casa
    const noTopo = (x, y) => x >= 0 && y >= 0 && x < T && y < T && ((x >= a && x < b && y >= a && y < b) || (mask & 1 && x >= a && x < b && y < a) || (mask & 4 && x >= a && x < b && y >= b) ||
      (mask & 8 && y >= a && y < b && x < a) || (mask & 2 && y >= a && y < b && x >= b));
    const fundoDe = (x) => { for (let y = T - 1; y >= 0; y--) if (noTopo(x, y)) return y; return -1; };
    const temFace = (x) => { if (x < 0 || x >= T) return (x < 0 ? mask & 8 : mask & 2) ? true : false; const f = fundoDe(x); return f >= 0 && f < T - 1; };
    // face: abaixo da última linha do topo em cada coluna
    const bioPe = Arte.BIOMAS[m.area] || Arte.BIOMAS.canaan;
    for (let x = 0; x < T; x++) {
      const fundo = fundoDe(x);
      if (fundo < 0 || fundo === T - 1) continue;
      const pontaE = !temFace(x - 1), pontaD = !temFace(x + 1) || !temFace(x + 2);
      for (let ly = 0; ly < h; ly++) {
        let c = corFaceMuro(m, x, ly, v);
        if (pontaE) c = cla(c, 0.14); else if (pontaD) c = esc(c, !temFace(x + 1) ? 0.3 : 0.16);
        tela.p(x, fundo + 1 + ly, c);
      }
      // sombra da cobertura, pé escurecido e manchas de umidade
      tela.tom(x, fundo + 1, SOMBRA, 0.5); tela.tom(x, fundo + 2, SOMBRA, 0.3); tela.tom(x, fundo + 3, SOMBRA, 0.12);
      tela.tom(x, fundo + h, SOMBRA, 0.4); tela.tom(x, fundo + h - 1, SOMBRA, 0.24); tela.tom(x, fundo + h - 2, SOMBRA, 0.1);
      const esc0 = Math.floor(hash2(x >> 1, v, 340) * 9);
      if (hash2(x >> 1, v, 341) < 0.3) for (let k = 0; k < esc0; k++) tela.tom(x, fundo + 4 + k, m.pe === "relva" ? "#3e4a26" : "#3a2418", 0.16 - k * 0.012);
      // pé do muro: relva que sobe pela pedra, ou areia acumulada
      const hp = hash2(x, v, 342);
      if (m.pe === "relva") {
        const alt = hp < 0.2 ? 3 : hp < 0.5 ? 2 : hp < 0.8 ? 1 : 0, cc = bioPe.chao;
        for (let k = 0; k < alt; k++) tela.p(x, fundo + h - k, k === alt - 1 ? cc.claro : k ? cc.base : cc.escuro);
        if (!alt && hp > 0.9) tela.p(x, fundo + h, esc(cc.escuro, 0.3));
      } else {
        const alt = hp < 0.25 ? 2 : hp < 0.7 ? 1 : 0, cc = bioPe.chao;
        for (let k = 0; k < alt; k++) tela.p(x, fundo + h - k, k === alt - 1 && alt > 1 ? cc.base : esc(cc.escuro, 0.1));
      }
    }
    // topo: pedras de cobertura (uma no miolo e uma em cada braço), chanfradas, com luz em cima e à esquerda
    const [t0, t1, t2, t3] = m.topo;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      if (!noTopo(x, y)) continue;
      const reg = x >= a && x < b ? (y < a ? 1 : y >= b ? 2 : 0) : x < a ? 3 : 4;
      // juntas: na primeira linha/coluna de cada pedra, no sentido do muro
      let jx = 99, jy = 99, fx = 99, fy = 99; // distância à junta de cima/esquerda e à de baixo/direita
      if (reg === 0) { jy = y - a; jx = x - a; fy = b - 1 - y; fx = b - 1 - x; }
      else if (reg === 1) { jy = y; fy = a - 1 - y; }
      else if (reg === 2) { jy = y - b; fy = T - 1 - y; }
      else if (reg === 3) { jx = x; fx = a - 1 - x; }
      else { jx = x - b; fx = T - 1 - x; }
      const tom = hash2(reg + v * 7, tipo.length, 310);
      let c = tom < 0.3 ? misturar(t1, t2, 0.5) : tom > 0.75 ? misturar(t2, t3, 0.45) : t2;
      const juntaCima = reg === 0 ? (mask & 1 && jy === 0) : jy === 0, juntaEsq = reg === 0 ? (mask & 8 && jx === 0) : jx === 0;
      if (juntaCima || juntaEsq) c = t0;
      else if (jy === (reg === 0 && !(mask & 1) ? 0 : 1) && reg !== 3 && reg !== 4 || jx === (reg === 0 && !(mask & 8) ? 0 : 1) && reg !== 1 && reg !== 2) c = cla(t3, 0.1);
      else if (fy === 0 && reg !== 3 && reg !== 4 || fx === 0 && reg !== 1 && reg !== 2) c = t1;
      else if (m.textura === "tijolo") {
        // fiada de cutelo: tijolos atravessados no muro, de 4 px, cada um num tom
        const aoLongoY = reg === 1 || reg === 2 || reg === 0 && mask & 5 && !(mask & 10), q = aoLongoY ? y : x, n = q >> 2;
        const tb = hash2(n + v * 9, aoLongoY ? 1 : 2, 314);
        c = tb < 0.25 ? misturar(t1, t2, 0.4) : tb > 0.8 ? misturar(t2, t3, 0.6) : tb > 0.5 ? t2 : misturar(t1, t2, 0.75);
        if ((q & 3) === 0) c = t0; else if ((q & 3) === 1) c = cla(c, 0.18);
        else if (hash2(x + v * 50, y, 311) < 0.06) c = esc(c, 0.1);
      }
      else if (fy === 1 && reg !== 3 && reg !== 4 || fx === 1 && reg !== 1 && reg !== 2) c = esc(c, 0.08);
      else if (jy === 2 && reg !== 3 && reg !== 4 || jx === 2 && reg !== 1 && reg !== 2) c = cla(c, 0.1);
      else if (hash2(x + v * 50, y, 311) < 0.08) c = esc(c, 0.1);
      else if (hash2(x + v * 50, y, 312) < 0.05) c = cla(c, 0.12);
      else if (hash2((x + v * 50) >> 1, y >> 1, 315) < 0.05) c = esc(c, 0.16); // lasca
      else if (m.pe === "relva" && ruido((x + v * 30) / 4, y / 4, 313) > 0.8) c = misturar(c, "#6a7a3a", 0.35); // líquen
      // beiras de fora do topo
      const beiraLuz = !noTopo(x - 1, y) && x > 0 || !noTopo(x, y - 1) && y > 0;
      const beiraSombra = !noTopo(x + 1, y) && x < T - 1 || !noTopo(x, y + 1) && y < T - 1;
      if (beiraLuz) c = cla(t3, 0.22); else if (beiraSombra) c = esc(t1, 0.12);
      tela.p(x, y, c);
    }
    tela.contorno(esc(m.face[0], 0.55));
    matiz(null);
    return tela;
  }
  function texturaMuro(scene, tipo, mask, v = 0) {
    const chave = `muro_${tipo}_${mask}_${v % 3}_h${ALTURA_MURO}`;
    if (!scene.textures.exists(chave)) scene.textures.addCanvas(chave, pintarMuro(tipo, mask, v % 3).canvas());
    return chave;
  }
  // A casa (x, y) tem muro contínuo? Mesma regra de game.js (tipoMuro): devolve a máscara N1 L2 S4 O8 ou 0.
  const cacheMuros = {};
  function muroEm(area, x, y) {
    if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) return null;
    const c = cacheMuros[area] || (cacheMuros[area] = new Map()), id = y * COLS + x;
    if (c.has(id)) return c.get(id);
    let nome = null;
    if (mapas[area][y][x] === 1 && pisos[area][y][x] === PISO.CHAO && Arte.tipoObstaculo) {
      const t = Arte.tipoObstaculo(area, x, y);
      const n = t && t.chave ? t.chave.replace(`ob_${area}_`, "") : null;
      if (n && MUROS[n]) nome = n;
    }
    c.set(id, nome);
    return nome;
  }
  function mascaraMuro(area, x, y) {
    const m = muroEm(area, x, y);
    if (!m) return 0;
    return (muroEm(area, x, y - 1) === m ? 1 : 0) | (muroEm(area, x + 1, y) === m ? 2 : 0) | (muroEm(area, x, y + 1) === m ? 4 : 0) | (muroEm(area, x - 1, y) === m ? 8 : 0);
  }

  // ---------------------------------------------------------------- chão contínuo
  // Classe de cada casa: 0 não pinta (água, borda, fora), 1 chão, 2 estrada de terra, 3 rua de pedra (caminho
  // dentro de uma vila), 4 chão de prédio (fica sob as imagens do prédio).
  const NADA = 0, CHAO = 1, TERRA = 2, RUA = 3, PREDIO = 4;
  // classes só da pintura (por pixel): água de dentro do mapa e chão pisado
  const AGUA = 5, GASTO = 6;
  const cacheClasses = {};
  // Orla: a borda do mapa e as 4 casas de fora viram mata, palmeiral ou pedregal contínuo (com o chão da
  // região por baixo), em vez de uma faixa chapada. tipos: obstáculos do bioma (sprites.js, ob_<area>_<tipo>);
  // densidade: chance de cada casa da orla ter um. Fica de fora: água da borda (lago, Nilo, enseada) e muralha.
  const MOLDURA_CASAS = 4;
  const ORLAS = {
    canaan: { tipos: ["oliveira", "oliveira", "oliveira", "rocha"], densidade: 0.78 },
    deserto: { tipos: ["rocha", "rocha", "acacia", "retama"], densidade: 0.55 },
    egito: { tipos: ["tamareira", "tamareira", "tamareira", "jarros"], densidade: 0.7 },
    marVermelho: { tipos: ["granito", "granito", "coral", "destrocos"], densidade: 0.62 },
    sinai: { tipos: ["penedo", "penedo", "penedo", "arbusto"], densidade: 0.85 },
    galileia: { tipos: ["figueira", "figueira", "basalto", "figueira"], densidade: 0.75 },
  };
  // A casa (x, y), dentro ou fora do mapa, é água ou muralha da borda (fica com o Tilemap animado)?
  function aguaDaBorda(area, x, y) {
    const bio = Arte.BIOMAS[area] || Arte.BIOMAS.canaan;
    const cais = typeof areas !== "undefined" ? areas[area] && areas[area].cais : null;
    if (y <= 0 && cais && Math.abs(x - cais.x) <= 3) return true;
    if (y <= 0 && (bio.borda.norte === "agua" || bio.borda.norte === "muralha")) return true;
    if (y >= ROWS - 1 && bio.borda.sul === "muralha") return true;
    return false;
  }
  // Casa da orla: no anel da borda ou até MOLDURA_CASAS fora do mapa, sem ser água.
  function naOrla(area, x, y) {
    if (!ORLAS[area]) return false;
    const fora = x < 0 || y < 0 || x >= COLS || y >= ROWS;
    const anel = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
    if (!fora && !anel) return false;
    if (x < -MOLDURA_CASAS || y < -MOLDURA_CASAS || x >= COLS + MOLDURA_CASAS || y >= ROWS + MOLDURA_CASAS) return false;
    const cx = Math.max(0, Math.min(COLS - 1, x)), cy = Math.max(0, Math.min(ROWS - 1, y));
    if (aguaDaBorda(area, x, y) || aguaDaBorda(area, cx, cy)) return false;
    if (!fora && pisos[area][y][x] === PISO.AGUA) return false;
    return true;
  }
  // Obstáculos da orla: [{ x, y, chave, dx, dy, escuro }] — sorteio fixo por casa.
  function obstaculosDaOrla(area) {
    const o = ORLAS[area], lista = [];
    if (!o) return lista;
    for (let y = -MOLDURA_CASAS; y < ROWS + MOLDURA_CASAS; y++) for (let x = -MOLDURA_CASAS; x < COLS + MOLDURA_CASAS; x++) {
      if (!naOrla(area, x, y)) continue;
      const dist = Math.max(-x, -y, x - (COLS - 1), y - (ROWS - 1), 0); // 0 no anel, 1..4 fora
      if (hash2(x, y, 501) > o.densidade + dist * 0.04) continue;
      const tipo = o.tipos[Math.floor(hash2(x, y, 502) * o.tipos.length)];
      lista.push({ x, y, chave: `ob_${area}_${tipo}`, dx: Math.round((hash2(x, y, 503) - 0.5) * 16), dy: Math.round((hash2(x, y, 504) - 0.5) * 8), escuro: Math.min(0.45, dist * 0.1) });
    }
    return lista;
  }
  function classesDaArea(area) {
    if (cacheClasses[area]) return cacheClasses[area];
    const mapa = mapas[area], piso = pisos[area];
    const vilas = (DADOS_MAPAS[area] && DADOS_MAPAS[area].vilas) || [];
    const cls = new Uint8Array(COLS * ROWS);
    const gasto = new Float32Array(COLS * ROWS); // 0..1: chão pisado (terra batida) em volta de portas e vilas
    const naVila = (x, y) => vilas.some((v) => x >= v.x && y >= v.y && x < v.x + v.largura && y < v.y + v.altura);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x, p = piso[y][x];
      if (p === PISO.AGUA) cls[i] = NADA;
      else if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) cls[i] = naOrla(area, x, y) ? CHAO : NADA;
      else if (p === PISO.CAMINHO) cls[i] = naVila(x, y) ? RUA : TERRA;
      else if (p >= PISO.PAREDE) cls[i] = PREDIO;
      else cls[i] = CHAO;
      if (naVila(x, y)) gasto[i] = 0.32;
    }
    // em volta das portas, poços, tendas e bancas: terra batida
    const pisar = (cx, cy, r, f) => {
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const d = Math.hypot(x - cx, y - cy) / (r + 0.5);
        if (d < 1) gasto[y * COLS + x] = Math.max(gasto[y * COLS + x], f * (1 - d * d));
      }
    };
    for (const e of estruturasPorArea[area] || []) {
      if (e.entrar) pisar(e.porta.x, e.porta.y + 1, 2, 1);
      else pisar(e.x + (e.largura >> 1), e.y + e.altura, e.tipo === "poco" ? 2 : 1, 0.9);
      if (e.tipo === "poco") pisar(e.x, e.y, 2, 0.9);
    }
    for (const n of Object.values(npcs)) if (n.area === area) pisar(n.x, n.y, 1, 0.7);
    cacheClasses[area] = { cls, gasto };
    return cacheClasses[area];
  }

  // ---- ferramentas do chão: cores inteiras (0xRRGGBB) e campos de ruído amostrados numa grade e interpolados
  const cI = (hex) => parseInt(hex.slice(1, 7), 16);
  function mI(a, b, t) {
    const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255;
    return (Math.round(ar + ((b >> 16) - ar) * t) << 16) | (Math.round(ag + (((b >> 8) & 255) - ag) * t) << 8) | Math.round(ab + ((b & 255) - ab) * t);
  }
  // soma em `out` (N × N, canto X0, Y0 no mundo) o ruído de escala `esc` px, amostrado a cada `passo` px
  function campo(out, peso, esc, s, X0, Y0, N, passo, dx = 0) {
    const n = Math.floor(N / passo) + 2, g = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g[j * n + i] = ruido((X0 + i * passo) / esc + dx, (Y0 + j * passo) / esc, s) * peso;
    for (let y = 0; y < N; y++) {
      const j = (y / passo) | 0, ty = (y - j * passo) / passo, r0 = j * n, r1 = r0 + n;
      for (let x = 0; x < N; x++) {
        const i = (x / passo) | 0, tx = (x - i * passo) / passo;
        const a = g[r0 + i] + (g[r0 + i + 1] - g[r0 + i]) * tx, b = g[r1 + i] + (g[r1 + i + 1] - g[r1 + i]) * tx;
        out[y * N + x] += a + (b - a) * ty;
      }
    }
    return out;
  }
  const agora = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());

  const LADO = 16; // casas por pedaço
  // Prepara a pintura de um pedaço de chão (16 × 16 casas): devolve o estado que Cenario.pintarFatia avança.
  // A pintura é feita em passos curtos (campos de ruído, classe de cada pixel, pedras da rua, cor de base em
  // tiras, carimbos de relva e seixos, margem da água e sombras de contato), todos em coordenadas do mundo:
  // os pedaços vizinhos emendam sem costura.
  function iniciarPedaco(area, bx, by) {
    const est = { area, bx, by, chave: `chao_${area}_${bx}_${by}`, tela: null, pronto: false, i: 0, passos: [] };
    const P = est.passos;
    const bio = Arte.BIOMAS[area] || Arte.BIOMAS.canaan;
    const { cls, gasto } = classesDaArea(area);
    const L = LADO * T, M = 16, N = L + 2 * M, W0 = bx * L, H0 = by * L, X0 = W0 - M, Y0 = H0 - M;
    const tela = est.tela = new Tela(L, L), buf = tela.buf;
    const s = 991 + area.length * 13;
    matiz(area);
    const c = bio.chao, m = bio.mancha, cm = bio.caminho;
    const [r0, g0] = rgb(c.base);
    const relva = g0 > r0 + 8, areia = !relva, egito = area === "egito", pedregoso = area === "sinai";
    const SOMB = cI(SOMBRA), LUZI = cI(LUZ);
    // rampas de 7 tons (escuro → claro, base no índice 3)
    const rampa7 = (e, b, cl, sal) => [esc(e, 0.3), e, misturar(e, b, 0.5), b, misturar(b, cl, 0.5), cl, misturar(cl, sal, 0.55)].map(cI);
    const G = rampa7(c.escuro, c.base, c.claro, relva ? c.salpico : cla(c.claro, 0.3));
    const GM = rampa7(esc(m.escuro, 0.1), misturar(m.escuro, m.base, 0.6), misturar(m.base, c.base, 0.5), misturar(c.base, c.claro, 0.4));
    const TT = [esc(cm.escuro, 0.18), cm.escuro, misturar(cm.escuro, cm.base, 0.5), cm.base, misturar(cm.base, cm.claro, 0.5), cm.claro].map(cI);
    const TG = relva ? TT.map((t) => mI(mI(t, cI("#7a6248"), 0.3), G[2], 0.3)) : TT.map((t, i) => mI(t, G[Math.min(6, i + 1)], 0.62));
    const FIO = mI(cI(cm.borda), SOMB, 0.3), FIOG = mI(TG[1], SOMB, 0.22);
    const pedraBase = egito ? ["#8a7a5a", "#a8986f", "#c4b68c", "#dccfa8"] : area === "galileia" ? ["#403e3b", "#55524d", "#6c6861", "#858076"] : ["#7c705a", "#9a8c70", "#b6a888", "#cfc2a2"];
    const JUNTA = cI(esc(area === "galileia" ? "#242220" : "#4e4230", 0.15));
    const MUSGO = mI(cI(c.escuro), JUNTA, 0.45);
    const agua = bio.agua || { clara: "#4a8fa0", brilho: "#8ac0c8", profunda: "#1d4f5c" };
    const RASO = mI(cI(agua.clara), cI("#e6f2dc"), 0.42), FUNDO = mI(cI(agua.profunda || "#1d4f5c"), SOMB, 0.4);
    const BARRANCO = relva ? mI(TT[0], SOMB, 0.45) : mI(G[1], cI("#3a2c20"), 0.55);
    const MOLHADO = relva ? mI(TT[1], SOMB, 0.25) : mI(G[1], cI("#5a4a34"), 0.5);
    const flores = (bio.deco || []).filter((d) => /flor|anemona|mostarda|lirio/.test(d.tipo)).map((d) => d.cor);
    const tufoSeco = cI(((bio.deco || []).find((d) => /tufo/.test(d.tipo)) || { cor: "#8a8450" }).cor);

    // ---- casas em volta do pedaço (margem de 2 casas)
    const CX0 = Math.floor(X0 / T) - 1, CY0 = Math.floor(Y0 / T) - 1, CN = LADO + 4;
    const casa = new Uint8Array(CN * CN), gastoC = new Float32Array(CN * CN);
    let temAgua = false, temRua = false, temPredio = false;
    for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
      const x = CX0 + i, y = CY0 + j;
      let k;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) k = naOrla(area, x, y) ? CHAO : NADA;
      else {
        k = cls[y * COLS + x];
        if (k === NADA && pisos[area][y][x] === PISO.AGUA) k = AGUA;
        gastoC[j * CN + i] = gasto[y * COLS + x];
      }
      casa[j * CN + i] = k;
      if (k === AGUA) temAgua = true; else if (k === RUA) temRua = true; else if (k === PREDIO) temPredio = true;
    }
    const terraDe = (k) => k === CHAO || k === TERRA || k === RUA || k === PREDIO;
    // vizinhança de cada casa: terra em volta (para a margem da água) e rua por perto (para as pedras)
    const viz = new Uint8Array(CN * CN), pertoRua = new Uint8Array(CN * CN);
    const DV = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
    for (let j = 1; j < CN - 1; j++) for (let i = 1; i < CN - 1; i++) {
      let v = 0, r = casa[j * CN + i] === RUA ? 1 : 0;
      for (const [dx, dy, bit] of DV) { const q = casa[(j + dy) * CN + i + dx]; if (terraDe(q)) v |= bit; if (q === RUA) r = 1; }
      viz[j * CN + i] = v; pertoRua[j * CN + i] = r;
    }
    const casaEm = (wx, wy) => casa[((wy >> 5) - CY0) * CN + (wx >> 5) - CX0];

    // ---- dados por pixel (região com margem M)
    let fox, foy, ftom, fman, fmoita, fterra, finv, fond;
    const kk = new Uint8Array(N * N), tom = new Uint8Array(N * N);
    let raso = null, ped1 = null, pedE = null, pedU = null, sTom = null, sLuz = null, sEsc = null, sRach = null;
    const z = () => new Float32Array(N * N);
    P.push(() => { fox = campo(z(), 1, 21, s + 1, X0, Y0, N, 4); });
    P.push(() => { foy = campo(z(), 1, 21, s + 2, X0, Y0, N, 4, 40); });
    P.push(() => { ftom = campo(campo(z(), 0.6, 85, s + 11, X0, Y0, N, 16), 0.4, 27, s + 12, X0, Y0, N, 8); });
    P.push(() => { fman = campo(campo(z(), 0.75, 140, s + 14, X0, Y0, N, 16), 0.25, 31, s + 15, X0, Y0, N, 8); });
    P.push(() => { fond = campo(z(), 1, 46, s + 16, X0, Y0, N, 16); });
    P.push(() => { fmoita = campo(z(), 1, 11, s + 17, X0, Y0, N, 4); });
    P.push(() => { fterra = campo(z(), 0.6, 13, s + 7, X0, Y0, N, 4); });
    P.push(() => { campo(fterra, 0.4, 7, s + 8, X0, Y0, N, 4); });
    if (temAgua) P.push(() => { finv = campo(z(), 1, 9, s + 19, X0, Y0, N, 4); raso = new Uint8Array(N * N).fill(255); });

    // ---- classe de cada pixel: beiras orgânicas (amostra deslocada por ruído), chão pisado e margem da água
    const passoClasses = (j0, j1) => () => {
      for (let j = j0; j < j1; j++) {
        const wy = Y0 + j, cyi = ((wy >> 5) - CY0) * CN, ly = wy & 31;
        for (let i = 0; i < N; i++) {
          const wx = X0 + i, idx = j * N + i, ci = cyi + (wx >> 5) - CX0, own = casa[ci];
          if (own === NADA) continue;
          let k;
          if (own === AGUA) {
            const v = viz[ci];
            k = AGUA;
            if (v) {
              // distância à terra mais próxima: lados, quinas de fora (arredondadas) e cantos de dentro (boleados)
              const lx = wx & 31, a = lx + 0.5, b = ly + 0.5, R = 15;
              let d = 99, de = 0;
              if (v & 1 && b < d) { d = b; de = -CN; }
              if (v & 4 && 32 - b < d) { d = 32 - b; de = CN; }
              if (v & 8 && a < d) { d = a; de = -1; }
              if (v & 2 && 32 - a < d) { d = 32 - a; de = 1; }
              if (v & 16 && !(v & 3)) { const q = Math.hypot(32 - a, b); if (q < d) { d = q; de = 1 - CN; } }
              if (v & 32 && !(v & 6)) { const q = Math.hypot(32 - a, 32 - b); if (q < d) { d = q; de = 1 + CN; } }
              if (v & 64 && !(v & 12)) { const q = Math.hypot(a, 32 - b); if (q < d) { d = q; de = CN - 1; } }
              if (v & 128 && !(v & 9)) { const q = Math.hypot(a, b); if (q < d) { d = q; de = -1 - CN; } }
              if ((v & 9) === 9 && a < R && b < R) d = Math.min(d, R - Math.hypot(R - a, R - b));
              if ((v & 3) === 3 && 32 - a < R && b < R) d = Math.min(d, R - Math.hypot(R - 32 + a, R - b));
              if ((v & 6) === 6 && 32 - a < R && 32 - b < R) d = Math.min(d, R - Math.hypot(R - 32 + a, R - 32 + b));
              if ((v & 12) === 12 && a < R && 32 - b < R) d = Math.min(d, R - Math.hypot(R - a, R - 32 + b));
              const e = d - (2.6 + 8 * finv[idx]);
              if (e < 0) { const q = casa[ci + de]; k = q === TERRA ? TERRA : q === CHAO ? CHAO : GASTO; }
              else raso[idx] = Math.min(255, e * 16);
            }
          } else {
            const f = own === RUA ? 0.18 : 1;
            const q = casaEm(wx + Math.round((fox[idx] - 0.5) * 18 * f), wy + Math.round((foy[idx] - 0.5) * 18 * f));
            k = q === NADA || q === AGUA || q === PREDIO ? own : q;
            if (own === RUA) k = RUA; else if (k === RUA) k = own; // a rua é decidida pedra a pedra
            if (k === PREDIO) k = GASTO;
            else if (k === CHAO) {
              // chão pisado das vilas e da frente das portas (bilinear entre os centros das casas)
              const fx = wx / T - 0.5, fy = wy / T - 0.5, x = Math.floor(fx), y = Math.floor(fy), tx = fx - x, ty = fy - y;
              const gi = (y - CY0) * CN + x - CX0;
              const g = (gastoC[gi] * (1 - tx) + gastoC[gi + 1] * tx) * (1 - ty) + (gastoC[gi + CN] * (1 - tx) + gastoC[gi + CN + 1] * tx) * ty;
              if (g + (fmoita[idx] - 0.5) * 0.5 + (fox[idx] - 0.5) * 0.2 > 0.56) k = GASTO;
            }
          }
          kk[idx] = k;
        }
      }
    };
    for (let j = 0; j < N; j += 68) P.push(passoClasses(j, Math.min(N, j + 68)));

    // ---- rua de pedra: pedras irregulares nos dois eixos (células de Voronoi com peso), decididas pedra a pedra
    const GP = 10; // uma pedra a cada ~10 px (de 6 a 14 px conforme o sorteio)
    const SX0 = Math.floor((X0 - 14) / GP), SY0 = Math.floor((Y0 - 14) / GP), SN = Math.ceil((N + 28) / GP) + 2;
    if (temRua) {
      let sx, sy, sr, sk;
      P.push(() => {
        sx = new Float32Array(SN * SN); sy = new Float32Array(SN * SN); sr = new Float32Array(SN * SN); sk = new Uint8Array(SN * SN);
        sTom = new Int32Array(SN * SN); sLuz = new Int32Array(SN * SN); sEsc = new Int32Array(SN * SN); sRach = new Uint8Array(SN * SN);
        const P4 = pedraBase.map(cI), quente = cI("#9a6a48"), frio = cI("#6e7478");
        for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) {
          const gx = SX0 + i, gy = SY0 + j, q = j * SN + i;
          sx[q] = gx * GP + 5 + (hash2(gx, gy, s + 50) - 0.5) * 7.5; sy[q] = gy * GP + 5 + (hash2(gx, gy, s + 51) - 0.5) * 7.5;
          sr[q] = (hash2(gx, gy, s + 52) - 0.5) * 4.4;
          const wx = Math.floor(sx[q]), wy = Math.floor(sy[q]);
          const cxi = (wx >> 5) - CX0, cyi = (wy >> 5) - CY0;
          sk[q] = cxi < 0 || cyi < 0 || cxi >= CN || cyi >= CN ? NADA : casa[cyi * CN + cxi];
          const t = hash2(gx, gy, s + 5), u = hash2(gx, gy, s + 53);
          let cor = P4[t < 0.22 ? 0 : t < 0.6 ? 1 : t < 0.9 ? 2 : 3];
          if (u < 0.2) cor = mI(cor, quente, 0.28); else if (u > 0.88) cor = mI(cor, frio, 0.3);
          sTom[q] = cor; sLuz[q] = mI(cor, LUZI, 0.3); sEsc[q] = mI(cor, JUNTA, 0.4);
          sRach[q] = hash2(gx, gy, s + 54) < 0.1 ? 1 + Math.floor(hash2(gx, gy, s + 55) * 2) : 0;
        }
        ped1 = new Uint16Array(N * N); pedE = new Uint8Array(N * N); pedU = new Int8Array(N * N);
      });
      const passoPedras = (j0, j1) => () => {
        for (let j = j0; j < j1; j++) {
          const wy = Y0 + j, cyi = ((wy >> 5) - CY0) * CN, gy0 = Math.floor(wy / GP) - SY0;
          for (let i = 0; i < N; i++) {
            const wx = X0 + i, ci = cyi + (wx >> 5) - CX0;
            if (!pertoRua[ci]) continue;
            const idx = j * N + i, k = kk[idx];
            if (k === NADA || k === AGUA) continue;
            const gx0 = Math.floor(wx / GP) - SX0;
            let d1 = 1e9, d2 = 1e9, q1 = 0, u1 = 0;
            for (let b = gy0 - 1; b <= gy0 + 1; b++) for (let a = gx0 - 1; a <= gx0 + 1; a++) {
              const q = b * SN + a, dx = wx + 0.5 - sx[q], dy = wy + 0.5 - sy[q], ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy;
              const d = (ax > ay ? ax : ay) * 0.5 + Math.sqrt(dx * dx + dy * dy) * 0.5 - sr[q];
              if (d < d1) { d2 = d1; d1 = d; q1 = q; u1 = dx + dy * 1.2; } else if (d < d2) d2 = d;
            }
            const ks = sk[q1], own = casa[ci];
            if (ks === RUA || (own === RUA && (ks === PREDIO || ks === NADA || ks === AGUA))) {
              kk[idx] = RUA; ped1[idx] = q1; pedE[idx] = Math.min(255, (d2 - d1) * 24); pedU[idx] = Math.max(-127, Math.min(127, u1 * 8));
            } else if (k === RUA) kk[idx] = GASTO;
          }
        }
      };
      for (let j = 0; j < N; j += 68) P.push(passoPedras(j, Math.min(N, j + 68)));
    }

    // ---- cor de base de cada pixel
    const pintar = (idx, cor) => { // idx na região com margem → pixel do pedaço (se estiver dentro)
      const i = idx % N - M, j = ((idx / N) | 0) - M;
      if (i < 0 || j < 0 || i >= L || j >= L) return;
      const o = (j * L + i) * 4;
      buf[o] = cor >> 16; buf[o + 1] = (cor >> 8) & 255; buf[o + 2] = cor & 255; buf[o + 3] = 255;
    };
    const passoBase = (j0, j1) => () => {
      for (let j = j0; j < j1; j++) {
        const wy = Y0 + j, dentroY = j >= M && j < M + L;
        for (let i = 3; i < N - 3; i++) {
          const idx = j * N + i, k = kk[idx];
          if (k === NADA || k === AGUA) continue;
          const wx = X0 + i, h = hash2(wx, wy, s + 40), h2 = hash2(wx, wy, s + 41);
          const up = kk[idx - N], dn = kk[idx + N], lf = kk[idx - 1], rt = kk[idx + 1];
          let cor;
          if (k === CHAO) {
            const man = !egito && fman[idx] > 0.6 + (h - 0.5) * 0.05;
            const t = (ftom[idx] - 0.2) * 1.7;
            let ti = 1 + Math.floor((t < 0 ? 0 : t > 0.999 ? 0.999 : t) * 4 + (h2 - 0.5) * (relva ? 0.3 : 0.7));
            ti = ti < 1 ? 1 : ti > 4 ? 4 : ti;
            const R = man ? GM : G;
            cor = R[ti];
            if (relva) {
              if (h < 0.05) cor = R[ti - 1]; else if (h > 0.965) cor = R[ti + 1];
            } else {
              if (egito && fman[idx] > 0.56 + (h - 0.5) * 0.04) {
                // campos de plantio: leiras paralelas (crista clara, sulco escuro) com brotos
                const su = (wy + Math.round(fox[idx] * 7)) & 7;
                cor = su === 0 ? mI(GM[3], G[4], 0.5) : su < 3 ? GM[3] : su < 5 ? mI(GM[3], GM[2], 0.6) : su === 5 ? mI(GM[1], GM[2], 0.5) : GM[2];
                if (su === 1 && h < 0.07) cor = cI("#7a9a3a"); else if (su === 0 && h < 0.03) cor = cI("#9ab84a");
                else if (h2 < 0.06) cor = GM[1];
                tom[idx] = 3 | 16;
              } else {
                // ondulações da areia: crista clara e vale escuro, quebradas
                if (fman[idx] > 0.4 && !pedregoso) {
                  const v = (wy + fond[idx] * 26 + wx * 0.1) / 13, f = v - Math.floor(v);
                  if (f < 0.08 && h2 > 0.12) cor = R[ti + 1]; else if (f < 0.16 && h2 > 0.2) cor = R[ti - 1];
                }
                if (h < 0.06) cor = R[ti - 1]; else if (h > 0.95) cor = R[ti + 1];
                else if (pedregoso && h > 0.88) cor = mI(R[ti], cI("#5a4a44"), 0.25);
              }
            }
            if (!tom[idx]) tom[idx] = ti | (man ? 8 : 0);
            if (temRua && (up === RUA || lf === RUA || dn === RUA || rt === RUA)) cor = mI(cor, JUNTA, 0.6);
          } else if (k === RUA) {
            const e = pedE[idx], q = ped1[idx], u = pedU[idx];
            if (e < 30) {
              cor = JUNTA;
              if (relva && fmoita[idx] > 0.6 && h < 0.75) cor = h2 < 0.25 ? mI(G[2], JUNTA, 0.25) : MUSGO;
              else if (!relva && fmoita[idx] > 0.62 && h < 0.6) cor = mI(JUNTA, TT[2], 0.55); // areia nas juntas
            } else {
              cor = sTom[q];
              if (e < 62) cor = u < -4 ? sLuz[q] : u > 6 ? sEsc[q] : cor;
              else if (e < 90 && u > 30) cor = mI(cor, JUNTA, 0.16);
              else if (h < 0.07) cor = mI(cor, JUNTA, 0.14);
              else if (h > 0.95) cor = mI(cor, LUZI, 0.14);
              const rc = sRach[q];
              if (rc && e >= 62) { const d = rc === 1 ? (u + 4 + ((wx * 3) & 7)) : (u - ((wy * 5) & 7)); if (d === 0 || d === 1) cor = mI(cor, JUNTA, 0.5); }
            }
            tom[idx] = 3;
          } else {
            const R = k === TERRA ? TT : TG;
            const t = fterra[idx] * 1.15 - 0.08;
            let ti = 1 + Math.floor((t < 0 ? 0 : t > 0.999 ? 0.999 : t) * 4 + (h2 - 0.5) * 0.8);
            ti = ti < 1 ? 1 : ti > 4 ? 4 : ti;
            cor = R[ti];
            if (h < 0.06) cor = R[ti - 1]; else if (h > 0.95) cor = R[ti + 1];
            if (k === TERRA) {
              // sulcos das rodas: fios escuros que ondulam, com a beira de baixo clara
              const su = (wy + Math.round(fox[idx] * 9) + (wx >> 6)) % 21;
              if (fond[idx] > 0.42 && h2 > 0.1) { if (su === 0) cor = R[ti - 1]; else if (su === 1) cor = R[ti + 1]; }
              if (up === CHAO || dn === CHAO || lf === CHAO || rt === CHAO) cor = FIO;
              else if (kk[idx - 2 * N] === CHAO || kk[idx - 3 * N] === CHAO || kk[idx - 2] === CHAO || kk[idx - 3] === CHAO) cor = mI(R[ti - 1], FIO, 0.3);
              else if (kk[idx + 2 * N] === CHAO || kk[idx + 3 * N] === CHAO || kk[idx + 2] === CHAO || kk[idx + 3] === CHAO) cor = h2 < 0.75 ? R[ti + 1] : cor;
            } else if ((up === CHAO || dn === CHAO || lf === CHAO || rt === CHAO) && h < 0.6) cor = FIOG;
            tom[idx] = ti;
            if (temRua && (up === RUA || lf === RUA || dn === RUA || rt === RUA)) cor = mI(cor, JUNTA, 0.6);
            else if (temRua && (kk[idx - 2 * N] === RUA || kk[idx - 2] === RUA)) cor = mI(cor, JUNTA, 0.22);
          }
          if (dentroY && i >= M && i < M + L) {
            const o = ((j - M) * L + i - M) * 4;
            buf[o] = cor >> 16; buf[o + 1] = (cor >> 8) & 255; buf[o + 2] = cor & 255; buf[o + 3] = 255;
          }
        }
      }
    };
    for (let j = 3; j < N - 3; j += 54) P.push(passoBase(j, Math.min(N - 3, j + 54)));

    // ---- carimbos (em posições do mundo): lâminas de relva, moitas, flores, seixos e lajes
    const pt = (x, y, cor) => { // x, y na região com margem; não pinta sobre a água nem fora do chão
      if (x < M || y < M || x >= M + L || y >= M + L) return;
      const k = kk[y * N + x];
      if (k === NADA || k === AGUA) return;
      const o = ((y - M) * L + x - M) * 4;
      buf[o] = cor >> 16; buf[o + 1] = (cor >> 8) & 255; buf[o + 2] = cor & 255; buf[o + 3] = 255;
    };
    const outro = (idx) => { const a = kk[idx - 3], b = kk[idx + 3], cc = kk[idx - 3 * N], d = kk[idx + 3 * N]; return (a !== CHAO && a > 0) || (b !== CHAO && b > 0) || (cc !== CHAO && cc > 0) || (d !== CHAO && d > 0); };
    const passoLaminas = (y0, y1) => () => {
      for (let gy = y0; gy < y1; gy += 3) for (let gx = 4; gx < N - 8; gx += 4) {
        const wx = X0 + gx, wy = Y0 + gy, h = hash2(wx, wy, s + 20);
        const x = gx + Math.floor(hash2(wx, wy, s + 21) * 4), y = gy + Math.floor(hash2(wx, wy, s + 22) * 3), idx = y * N + x, k = kk[idx];
        if (k !== CHAO && k !== GASTO) continue;
        const tv = tom[idx];
        if (tv & 16) continue;
        const moita = fmoita[idx], beira = k === CHAO && outro(idx);
        const dens = k === GASTO ? 0.05 : beira ? 0.95 : 0.42 + moita * 0.58;
        if (h > dens) continue;
        const R = k === GASTO ? G : tv & 8 ? GM : G, ti = k === GASTO ? 2 : tv & 7;
        const h2 = hash2(wx, wy, s + 23), h3 = hash2(wx, wy, s + 24);
        let alt = 2 + Math.floor(h2 * 2.3) + (moita > 0.66 || beira ? 1 : 0);
        if (h3 < 0.36) {
          // lâmina na sombra (dá profundidade ao tapete)
          for (let q = 0; q < alt; q++) pt(x + (q === alt - 1 && h3 < 0.12 ? 1 : 0), y - q, q ? R[ti - 1] : R[Math.max(0, ti - 2)]);
          continue;
        }
        const inc = h3 > 0.86 ? 1 : h3 < 0.5 ? -1 : 0, forte = moita > 0.6 || h2 > 0.8;
        pt(x + 1, y, R[Math.max(0, ti - 2)]); if (alt > 3) pt(x + 1, y - 1, R[ti - 1]);
        for (let q = 0; q < alt; q++) pt(x + (q === alt - 1 ? inc : 0), y - q, q === alt - 1 ? R[Math.min(6, ti + (forte ? 3 : 2))] : q ? R[ti + 1] : R[ti]);
      }
    };
    if (relva) for (let y = 6; y < N - 6; y += 90) P.push(passoLaminas(y, Math.min(N - 6, y + 90)));
    P.push(() => {
      // moitas: leque de 5 lâminas com a base na sombra
      if (relva) for (let gy = 8; gy < N - 8; gy += 16) for (let gx = 8; gx < N - 8; gx += 16) {
        const wx = X0 + gx, wy = Y0 + gy, h = hash2(wx, wy, s + 60);
        const x = gx + Math.floor(hash2(wx, wy, s + 61) * 12) - 2, y = gy + Math.floor(hash2(wx, wy, s + 62) * 12) - 2, idx = y * N + x;
        if (kk[idx] !== CHAO || tom[idx] & 16) continue;
        if (h > 0.2 + fmoita[idx] * 0.3) continue;
        const R = tom[idx] & 8 ? GM : G, ti = tom[idx] & 7;
        for (let q = -2; q <= 3; q++) pt(x + q, y + 1, R[Math.max(0, ti - 2)]);
        pt(x + 3, y, R[Math.max(0, ti - 2)]); pt(x - 3, y + 1, R[ti - 1]);
        for (let b = -2; b <= 2; b++) {
          const alt = 4 - Math.abs(b) + Math.floor(hash2(wx + b, wy, s + 63) * 2.4);
          for (let q = 0; q <= alt; q++) {
            const px = x + b + Math.round((b * q) / (alt + 1) * 1.2);
            pt(px, y - q, q === alt ? R[6] : b < 0 ? R[Math.min(6, ti + 2)] : b > 0 ? R[ti - (q < 2 ? 1 : 0)] : R[ti + 1]);
          }
        }
      }
      // tufos secos (areia e pedregal)
      if (areia) for (let gy = 8; gy < N - 8; gy += 22) for (let gx = 8; gx < N - 8; gx += 22) {
        const wx = X0 + gx, wy = Y0 + gy;
        if (hash2(wx, wy, s + 64) > (pedregoso ? 0.2 : 0.11)) continue;
        const x = gx + Math.floor(hash2(wx, wy, s + 65) * 18) - 4, y = gy + Math.floor(hash2(wx, wy, s + 66) * 18) - 4, idx = y * N + x;
        if (kk[idx] !== CHAO || tom[idx] & 16) continue;
        const ti = tom[idx] & 7, esc2 = mI(tufoSeco, SOMB, 0.4), cl2 = mI(tufoSeco, LUZI, 0.35);
        for (let q = -1; q <= 2; q++) pt(x + q, y + 1, G[Math.max(0, ti - 2)]);
        for (let b = -2; b <= 2; b++) {
          const alt = 3 - Math.abs(b) + Math.floor(hash2(wx + b, wy, s + 67) * 2);
          for (let q = 0; q <= alt; q++) pt(x + b + Math.round((b * q) / (alt + 1)), y - q, q === alt ? cl2 : b > 0 ? esc2 : tufoSeco);
        }
      }
    });
    P.push(() => {
      // flores volumosas, em canteiros de 2 a 5
      if (relva && flores.length) for (let gy = 8; gy < N - 8; gy += 40) for (let gx = 8; gx < N - 8; gx += 40) {
        const wx = X0 + gx, wy = Y0 + gy;
        if (hash2(wx, wy, s + 70) > 0.2) continue;
        const cx = gx + Math.floor(hash2(wx, wy, s + 71) * 30), cy = gy + Math.floor(hash2(wx, wy, s + 72) * 30);
        const cor = cI(flores[Math.floor(hash2(wx, wy, s + 73) * flores.length)]), n = 2 + Math.floor(hash2(wx, wy, s + 74) * 4);
        const luz = mI(cor, LUZI, 0.45), sb = mI(cor, SOMB, 0.35), miolo = (cor >> 16) > 200 && ((cor >> 8) & 255) > 180 ? cI("#b8862a") : cI("#f4d860");
        for (let f = 0; f < n; f++) {
          const x = cx + Math.round((hash2(wx + f, wy, s + 75) - 0.5) * 16), y = cy + Math.round((hash2(wx + f, wy, s + 76) - 0.5) * 12);
          if (x < 4 || y < 6 || x >= N - 4 || y >= N - 6 || kk[y * N + x] !== CHAO) continue;
          const ti = tom[y * N + x] & 7;
          pt(x, y + 2, G[Math.max(0, ti - 2)]); pt(x, y + 3, G[Math.max(0, ti - 2)]); pt(x + 1, y + 3, G[Math.min(6, ti + 2)]); pt(x + 1, y + 4, G[Math.max(0, ti - 2)]);
          pt(x, y - 1, luz); pt(x - 1, y, luz); pt(x + 1, y, cor); pt(x, y + 1, sb); pt(x, y, miolo);
          if (hash2(wx + f, wy, s + 77) < 0.5) { pt(x - 1, y - 1, luz); pt(x + 1, y + 1, sb); pt(x + 1, y - 1, cor); pt(x - 1, y + 1, cor); }
        }
      }
      // seixos (2 a 4 px) com luz em cima e sombra embaixo
      const seixo = [cI(misturar(cm.claro, "#d8d0c0", 0.5)), cI(misturar(cm.base, "#a8a090", 0.5)), cI(esc(misturar(cm.escuro, "#6a6258", 0.5), 0.2))];
      for (let gy = 6; gy < N - 6; gy += 9) for (let gx = 6; gx < N - 6; gx += 9) {
        const wx = X0 + gx, wy = Y0 + gy, h = hash2(wx, wy, s + 23);
        const x = gx + Math.floor(hash2(wx, wy, s + 24) * 7), y = gy + Math.floor(hash2(wx, wy, s + 25) * 7), idx = y * N + x, k = kk[idx];
        if (k !== CHAO && k !== TERRA && k !== GASTO || tom[idx] & 16) continue;
        if (h > (k === TERRA ? 0.07 + fond[idx] * 0.14 : k === GASTO ? 0.07 : pedregoso ? 0.3 : areia ? 0.06 : 0.035)) continue;
        const som = mI(k === CHAO ? G[tom[idx] & 7] : TT[2], SOMB, 0.4), t = hash2(wx, wy, s + 26);
        if (t < 0.45) { pt(x, y, seixo[0]); pt(x + 1, y, seixo[1]); pt(x, y + 1, som); pt(x + 1, y + 1, som); }
        else if (t < 0.8) { pt(x, y, seixo[0]); pt(x + 1, y, seixo[0]); pt(x + 2, y, seixo[1]); pt(x, y + 1, seixo[1]); pt(x + 1, y + 1, seixo[1]); pt(x + 2, y + 1, seixo[2]); pt(x + 1, y + 2, som); pt(x + 2, y + 2, som); pt(x + 3, y + 1, som); }
        else {
          pt(x + 1, y - 1, seixo[0]); pt(x + 2, y - 1, seixo[0]);
          pt(x, y, seixo[0]); pt(x + 1, y, seixo[0]); pt(x + 2, y, seixo[1]); pt(x + 3, y, seixo[1]);
          pt(x, y + 1, seixo[1]); pt(x + 1, y + 1, seixo[1]); pt(x + 2, y + 1, seixo[2]); pt(x + 3, y + 1, seixo[2]);
          pt(x + 1, y + 2, som); pt(x + 2, y + 2, som); pt(x + 3, y + 2, som); pt(x + 4, y + 1, som);
        }
      }
      // lajes de rocha à flor do chão (pedregal e areia)
      if (areia) for (let gy = 16; gy < N - 16; gy += 34) for (let gx = 16; gx < N - 16; gx += 34) {
        const wx = X0 + gx, wy = Y0 + gy;
        if (hash2(wx, wy, s + 80) > (pedregoso ? 0.42 : area === "marVermelho" ? 0.2 : 0.1)) continue;
        const cx = gx + Math.floor(hash2(wx, wy, s + 81) * 26) - 6, cy = gy + Math.floor(hash2(wx, wy, s + 82) * 26) - 6;
        if (cx < 14 || cy < 12 || cx >= N - 14 || cy >= N - 12) continue;
        if (kk[cy * N + cx] !== CHAO || tom[cy * N + cx] & 16) continue;
        const rx = 5 + hash2(wx, wy, s + 83) * 6, ry = 3 + hash2(wx, wy, s + 84) * 3.5, ti = tom[cy * N + cx] & 7;
        const base = mI(G[ti + 1], cI("#8a8078"), 0.3), luz = mI(base, LUZI, 0.35), sb = mI(base, SOMB, 0.42);
        const den = (x, y) => { const nx = (x - cx) / rx, ny = (y - cy) / ry; return nx * nx + ny * ny < 1 + (hash2(wx + Math.round(Math.atan2(ny, nx) * 2.2), wy, s + 85) - 0.5) * 0.5; };
        for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
          if (!den(x, y)) { if (kk[y * N + x] === CHAO) { if (den(x - 1, y - 1)) pt(x, y, mI(G[ti], SOMB, 0.4)); else if (den(x - 2, y - 2) || den(x - 1, y - 2)) pt(x, y, mI(G[ti], SOMB, 0.18)); } continue; }
          if (kk[y * N + x] !== CHAO) continue;
          let cor = (y - cy) / ry + (x - cx) / rx * 0.5 < -0.35 ? mI(base, LUZI, 0.16) : base;
          if (!den(x, y + 1)) cor = mI(base, SOMB, 0.6); else if (!den(x, y + 2) || !den(x + 1, y)) cor = sb; // espessura da laje
          else if (!den(x - 1, y) || !den(x, y - 1)) cor = luz;
          else if (hash2(X0 + x, Y0 + y, s + 86) < 0.1) cor = mI(base, SOMB, 0.15);
          else if (Math.abs((x - cx) * 0.6 + (y - cy) + 1) < 0.6 && hash2(wx, wy, s + 87) < 0.5) cor = sb; // fenda
          pt(x, y, cor);
        }
      }
    });

    // ---- margem da água: barranco ou praia, terra molhada e a faixa rasa clara por cima da água do Tilemap
    let dAgua = null;
    if (temAgua) P.push(() => {
      // distância (chanfro 3-4) de cada pixel de terra à água
      const d = dAgua = new Uint8Array(N * N);
      for (let q = 0; q < N * N; q++) d[q] = kk[q] === AGUA ? 0 : 255;
      for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
        const q = y * N + x; let v = d[q];
        if (!v) continue;
        v = Math.min(v, d[q - 1] + 3, d[q - N] + 3, d[q - N - 1] + 4, d[q - N + 1] + 4); d[q] = v;
      }
    });
    if (temAgua) P.push(() => {
      const d = dAgua;
      for (let y = N - 2; y > 0; y--) for (let x = N - 2; x > 0; x--) {
        const q = y * N + x; let v = d[q];
        if (!v) continue;
        v = Math.min(v, d[q + 1] + 3, d[q + N] + 3, d[q + N + 1] + 4, d[q + N - 1] + 4); d[q] = v;
      }
    });
    const passoMargem = (j0, j1) => () => {
      const d = dAgua;
      for (let j = j0; j < j1; j++) for (let i = 0; i < L; i++) {
        const q = (j + M) * N + i + M, k = kk[q], o = (j * L + i) * 4;
        if (k === NADA) continue;
        if (k === AGUA ? raso[q] === 255 : d[q] > 30) continue;
        const h = hash2(W0 + i, H0 + j, s + 90);
        if (k === AGUA) {
          const e = raso[q] / 16;
          if (e >= 9) continue;
          let cor = RASO, a = 0;
          if (e < 1.1) { cor = FUNDO; a = 0.5; }
          else if (e < 3.2 + h * 0.8) a = 0.36;
          else if (e < 6.2 + h * 1.6) a = 0.19;
          if (!a) continue;
          buf[o] = cor >> 16; buf[o + 1] = (cor >> 8) & 255; buf[o + 2] = cor & 255; buf[o + 3] = Math.round(a * 255);
          continue;
        }
        const dw = d[q] / 3;
        if (dw > 9) continue;
        let cor = (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2];
        // margem norte (água logo abaixo): o barranco aparece de frente, mais alto
        const face = relva && (kk[q + N] === AGUA || kk[q + 2 * N] === AGUA || kk[q + 3 * N] === AGUA);
        if (dw <= 1.4) cor = BARRANCO;
        else if (face) cor = kk[q + 2 * N] === AGUA ? mI(TT[1], SOMB, 0.3) : h < 0.7 ? TT[1] : mI(TT[2], G[2], 0.3);
        else if (dw <= 2.7 && h < 0.8) cor = relva ? MOLHADO : mI(cor, MOLHADO, 0.6);
        else if (dw <= 4.2 + h * 1.5) cor = mI(cor, MOLHADO, relva ? 0.3 : 0.42);
        else if (dw <= 7 + h * 2) cor = mI(cor, MOLHADO, relva ? 0.12 : 0.2);
        else continue;
        buf[o] = cor >> 16; buf[o + 1] = (cor >> 8) & 255; buf[o + 2] = cor & 255;
      }
    };
    if (temAgua) for (let j = 0; j < L; j += 128) P.push(passoMargem(j, j + 128));

    // ---- sombras de contato assadas: pé das fachadas e sombra dos muros (à direita e embaixo)
    P.push(() => {
      const sm = new Uint8Array(N * N);
      let algo = false;
      const marca = (x0, y0, w, h, v) => {
        for (let y = Math.max(0, y0); y < Math.min(N, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(N, x0 + w); x++) if (sm[y * N + x] < v) sm[y * N + x] = v;
        algo = true;
      };
      for (let j = 1; j < CN - 1; j++) for (let i = 1; i < CN - 1; i++) {
        const x = CX0 + i, y = CY0 + j, px = x * T - X0, py = y * T - Y0;
        if (casa[j * CN + i] === PREDIO) {
          if (casa[(j + 1) * CN + i] !== PREDIO) { marca(px, py + T, T + (casa[j * CN + i + 1] !== PREDIO ? 2 : 0), 2, 3); marca(px, py + T + 2, T + 3, 2, 2); marca(px + 1, py + T + 4, T + 3, 2, 1); }
          if (casa[j * CN + i + 1] !== PREDIO) { marca(px + T, py + 2, 2, T, 3); marca(px + T + 2, py + 3, 2, T, 2); marca(px + T + 4, py + 4, 2, T, 1); }
          if (casa[j * CN + i - 1] !== PREDIO) marca(px - 1, py + 6, 1, T - 6, 1);
          continue;
        }
        if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) continue;
        const mk = mascaraMuro(area, x, y);
        if (!mk) continue;
        const rets = [[9, 9, 14, 14]];
        if (mk & 1) rets.push([9, 0, 14, 9]); if (mk & 4) rets.push([9, 23, 14, 9]); if (mk & 8) rets.push([0, 9, 9, 14]); if (mk & 2) rets.push([23, 9, 9, 14]);
        const comp = Math.round(ALTURA_MURO * 0.36);
        for (let q = 1; q <= comp; q++) for (const [rx, ry, rw, rh] of rets) marca(px + rx + q, py + ry + Math.round(q * 0.5), rw, rh, q > comp - 2 ? 1 : 2);
        for (const [rx, ry, rw, rh] of rets) marca(px + rx - 1, py + ry + rh, rw + 2, 2, 3);
      }
      if (!algo) return;
      const AL = [0, 0.13, 0.25, 0.4], sr = SOMB >> 16, sg = (SOMB >> 8) & 255, sb = SOMB & 255;
      for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) {
        const v = sm[(j + M) * N + i + M];
        if (!v) continue;
        const o = (j * L + i) * 4;
        if (!buf[o + 3] || buf[o + 3] < 255) continue;
        const a = AL[v];
        buf[o] += (sr - buf[o]) * a; buf[o + 1] += (sg - buf[o + 1]) * a; buf[o + 2] += (sb - buf[o + 2]) * a;
      }
    });
    P.push(() => { matiz(null); });
    // cada passo assume o matiz da região (outra pintura pode ter trocado entre duas fatias)
    est.passos = P.map((f) => () => { matiz(area); f(); });
    return est;
  }
  // Avança a pintura do pedaço por até `orcamentoMs` (sempre pelo menos um passo). Devolve true quando o
  // pedaço está pronto (estado.tela é a Tela de 512 × 512; estado.chave é a chave da textura).
  function pintarFatia(estado, orcamentoMs = 4) {
    if (estado.pronto) return true;
    const t0 = agora();
    while (estado.i < estado.passos.length) {
      estado.passos[estado.i++]();
      if (agora() - t0 >= orcamentoMs) break;
    }
    if (estado.i >= estado.passos.length) { estado.pronto = true; estado.passos = []; matiz(null); }
    return estado.pronto;
  }
  function pintarPedacoChao(area, bx, by) {
    const est = iniciarPedaco(area, bx, by);
    while (!pintarFatia(est, 1e9));
    return est.tela;
  }

  function texturaPedacoChao(scene, area, bx, by) {
    const chave = `chao_${area}_${bx}_${by}`;
    if (!scene.textures.exists(chave)) scene.textures.addCanvas(chave, pintarPedacoChao(area, bx, by).canvas());
    return chave;
  }
  // Versão fatiada de texturaPedacoChao: chame a cada quadro com um orçamento em ms; devolve a chave quando a
  // textura existe e null enquanto o pedaço ainda está sendo pintado (um pedaço por vez, na ordem pedida).
  const fatias = new Map();
  function texturaPedacoChaoFatiada(scene, area, bx, by, orcamentoMs = 4) {
    const chave = `chao_${area}_${bx}_${by}`;
    if (scene.textures.exists(chave)) { fatias.delete(chave); return chave; }
    let est = fatias.get(chave);
    if (!est) { if (fatias.size > 12) fatias.clear(); fatias.set(chave, est = iniciarPedaco(area, bx, by)); }
    if (!pintarFatia(est, orcamentoMs)) return null;
    fatias.delete(chave);
    scene.textures.addCanvas(chave, est.tela.canvas());
    return chave;
  }

  global.Cenario = {
    MATERIAIS_PREDIO, material, LADO_PEDACO: LADO,
    obstaculosDaOrla, naOrla, MOLDURA_CASAS, temOrla: (area) => !!ORLAS[area],
    texturasPredio, texturaMovel, texturaPorta, texturaPedacoChao, classesDaArea, texturaMuro, MUROS, ALTURA_MURO,
    // altura da parede dos prédios em px (64 = 2 casas; a pintura aceita de 32 a 64). game.js posiciona
    // "dentro" e "fora" em Y0 − ALTURA_PAREDE e a porta em porta.y × 32 + 32 − ALTURA_PAREDE.
    ALTURA_PAREDE: 64,
    // chão fatiado: iniciarPedaco(area, bx, by) → estado; pintarFatia(estado, ms) → pronto?; ou, de uma vez,
    // texturaPedacoChaoFatiada(scene, area, bx, by, ms) → chave | null
    iniciarPedaco, pintarFatia, texturaPedacoChaoFatiada, mascaraMuro,
    // para testes e ferramentas
    pintarPredio, pintarMovel, pintarPedacoChao, pintarMuro, pintarPorta, Tela,
  };
})(typeof window !== "undefined" ? window : globalThis);
