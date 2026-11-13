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
// Chão contínuo: o chão de cada região é pintado em pedaços de 16 × 16 casas, pixel a pixel, a partir do
// mundo (não de azulejos repetidos): a relva e a areia variam devagar, as estradas de terra têm a beira
// irregular, as ruas das vilas são de pedra, o chão em volta das portas fica pisado e a beira da água é
// molhada. A água, a borda do mapa e a moldura continuam no Tilemap (animados), por baixo.
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
  const esc = (c, t = 0.25) => misturar(c, "#1c1210", t);
  const cla = (c, t = 0.2) => misturar(c, "#fff6e0", t);
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
    { id: "adobe", face: ["#8a6440", "#a87e52", "#c49a68", "#dab682"], textura: "reboco", topo: ["#8e6c46", "#b48e60", "#ceaa78", "#e4c896"], dentro: ["#b49a72", "#ccb38a", "#dccaa2"], piso: { casa: "barro", loja: "tabuas" }, telhado: "terraco" },
    { id: "pedra", face: ["#6a6252", "#8c826c", "#aca088", "#cac0a4"], textura: "blocos", topo: ["#8a7c62", "#ac9e80", "#c6b898", "#ddd2b4"], dentro: ["#b0a690", "#c8bea6", "#dcd4be"], piso: { casa: "lajota", loja: "tabuas" }, telhado: "terraco" },
    { id: "basalto", face: ["#1c1a18", "#2c2a27", "#403d39", "#5a5650"], textura: "blocos", topo: ["#7e7666", "#9e9480", "#b8ae98", "#cec6b0"], dentro: ["#8a8478", "#a29c8e", "#b8b2a4"], piso: { casa: "lajota_escura", loja: "tabuas" }, telhado: "terraco" },
    { id: "tijolo", face: ["#5a301c", "#7a4428", "#9a5a36", "#b8724a"], textura: "tijolo", topo: ["#94704c", "#b48e64", "#cca87c", "#e0c298"], dentro: ["#b89a76", "#cfb48e", "#e0caa6"], piso: { casa: "barro", loja: "tabuas" }, telhado: "terraco" },
    { id: "tenda", face: ["#5a4a36", "#8a7656", "#b8a47e", "#d8c8a2"], textura: "pano", listra: ["#8e2a1f", "#b8402e"], topo: ["#6a5640", "#8a7458", "#a89070", "#c4ae8c"], dentro: ["#8a7656", "#a8916c", "#c4ae86"], piso: { casa: "areia", loja: "areia" }, telhado: "lona" },
  ];
  const material = (v) => MATERIAIS_PREDIO[Math.max(0, Math.min(MATERIAIS_PREDIO.length - 1, v || 0))];

  // Textura da face de uma parede: reboco, blocos de pedra, tijolo de barro ou pano listrado.
  function pintarFace(tela, x0, y0, w, h, mat, s, cores = mat.face) {
    const [c0, c1, c2, c3] = cores;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const lx = x - x0, ly = y - y0;
      let c = c2;
      if (mat.textura === "reboco") {
        const n = ruido(x / 7, y / 5, s) * 0.7 + hash2(x, y, s) * 0.3;
        c = n < 0.25 ? c1 : n > 0.78 ? c3 : c2;
        // reboco caído: tijolos à mostra
        if (ruido(x / 11, y / 9, s + 3) > 0.78) c = ((ly >> 2) + ((lx + ((ly >> 2) & 1) * 3) / 6 | 0)) % 2 ? c1 : misturar(c1, "#8e4a2a", 0.3);
      } else if (mat.textura === "blocos") {
        const fila = Math.floor(ly / 8), off = Math.floor(hash2(fila, 0, s) * 11);
        const larg = 13, col = Math.floor((lx + off) / larg), bx = (lx + off) % larg, by = ly % 8;
        const tom = hash2(col, fila, s + 1);
        c = tom < 0.3 ? c1 : tom > 0.8 ? misturar(c2, c3, 0.5) : c2;
        if (by === 0 || bx === 0) c = c0;
        else if (by === 1 || bx === 1) c = c3;
        else if (by === 7 || bx === larg - 1) c = misturar(c1, c0, 0.4);
        else if (hash2(x, y, s + 2) < 0.06) c = c1;
      } else if (mat.textura === "tijolo") {
        const fila = Math.floor(ly / 5), bx = (lx + (fila % 2) * 4) % 9, by = ly % 5;
        const tom = hash2(Math.floor((lx + (fila % 2) * 4) / 9), fila, s);
        c = tom < 0.35 ? c1 : tom > 0.85 ? c3 : c2;
        if (by === 4 || bx === 8) c = "#4a2a18";
        else if (by === 0) c = misturar(c, c3, 0.5);
      } else if (mat.textura === "pano") {
        const dobra = Math.sin((lx / 16) * Math.PI * 2);
        c = dobra > 0.6 ? c3 : dobra < -0.6 ? c1 : c2;
        if (mat.listra && (ly % 12 === 3 || ly % 12 === 4)) c = dobra < -0.6 ? mat.listra[0] : mat.listra[1];
        if (hash2(x, y, s) < 0.04) c = c1;
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
        else if (hash2(wx, wy, 74) < 0.05) c = esc(c, 0.1);
        return c;
      }
      case "areia": {
        const n = ruido(wx / 9, wy / 9, 75);
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
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const borda = x < 3 || y < 3 || x >= w - 3 || y >= h - 3;
      const cx = Math.abs(x - w / 2), cy = Math.abs(y - h / 2);
      let c = cores[1];
      if (borda) c = cores[0];
      else if (x === 4 || y === 4 || x === w - 5 || y === h - 5) c = cores[2];
      else if (Math.abs(cx * 0.55 + cy - 5) < 0.9) c = cores[2];
      else if (cx * 0.55 + cy < 3) c = cores[3];
      else if ((x + y) % 6 === 0) c = esc(cores[1], 0.15);
      tela.p(x0 + x, y0 + y, c);
    }
    for (let y = 2; y < h - 2; y += 2) { tela.p(x0 - 1, y0 + y, "#e8dcc0"); tela.p(x0 + w, y0 + y, "#e8dcc0"); }
  }

  // ---------------------------------------------------------------- prédio: imagens
  // e: estrutura (logica.js) com x, y, largura, altura, porta, variante, tipo, placa, tapete.
  function pintarPredio(e) {
    const mat = material(e.variante);
    const L = e.largura, A = e.altura, W = L * T, H = A * T;
    const s = (e.x * 31 + e.y * 17) | 0;
    const porta = e.porta.x - e.x;
    const loja = e.tipo === "loja";
    return {
      chao: pintarChaoPredio(e, mat, W, H, s, loja),
      dentro: pintarDentro(e, mat, L, A, W, H, s, porta, loja),
      fora: pintarFora(e, mat, L, A, W, H, s, porta, loja),
      sombra: pintarSombra(W, H),
    };
  }

  function pintarChaoPredio(e, mat, W, H, s, loja) {
    const tela = new Tela(W, H);
    const tipo = mat.piso[loja ? "loja" : "casa"];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tela.p(x, y, corPiso(tipo, e.x * T + x, e.y * T + y, mat));
    // sombra das paredes no chão: faixa mais escura junto ao fundo e à esquerda
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dy = y - T, dx = x - 10;
      if (dy >= 0 && dy < 6) tela.tom(x, y, "#1c1210", 0.35 - dy * 0.05);
      if (dx >= 0 && dx < 4 && y >= T) tela.tom(x, y, "#1c1210", 0.22 - dx * 0.05);
    }
    if (e.tapete) pintarTapete(tela, (e.tapete.x - e.x) * T - 6, (e.tapete.y - e.y) * T + 4, s);
    // soleira de pedra na porta
    const px = (e.porta.x - e.x) * T, py = (e.porta.y - e.y) * T;
    tela.ret(px + 5, py + 20, 22, 10, (x, y) => (y === py + 20 ? "#d8ccb0" : y === py + 29 ? "#6a5e4a" : "#b4a88c"));
    return tela;
  }

  // Parede de dentro: o fundo alto (reboco claro, prateleiras na loja, nicho e ervas na casa) e as paredes
  // cortadas dos lados e da frente, finas (12 px) na beira de fora da pegada, como uma planta baixa.
  function pintarDentro(e, mat, L, A, W, H, s, porta, loja) {
    const tela = new Tela(W, H + T);
    const topo = mat.topo;
    // topo da parede do fundo (y 0–31 = a casa logo acima do prédio, vista por cima)
    tela.ret(0, 20, W, 12, (x, y) => (y === 20 ? topo[3] : y === 31 ? topo[0] : hash2(x, y, s) < 0.12 ? topo[1] : topo[2]));
    // face de dentro da parede do fundo (y 32–63)
    pintarFace(tela, 0, T, W, T, { ...mat, textura: mat.textura === "pano" ? "pano" : "reboco" }, s + 5, [esc(mat.dentro[0], 0.15), mat.dentro[0], mat.dentro[1], mat.dentro[2]]);
    for (let x = 0; x < W; x++) { tela.p(x, T, esc(mat.dentro[0], 0.4)); tela.p(x, 2 * T - 1, esc(mat.dentro[0], 0.35)); tela.p(x, 2 * T - 2, esc(mat.dentro[0], 0.2)); }
    if (loja) {
      // duas prateleiras de madeira com mercadorias
      for (const yp of [T + 12, T + 25]) {
        tela.ret(14, yp, W - 28, 2, (x, y) => (y === yp ? "#a8743e" : "#5a3820"));
        tela.ret(14, yp + 2, W - 28, 1, "#1c1210", 0.35);
        for (let x = 16; x < W - 18; x += 7) {
          const k = hash2(x, yp, s + 9);
          if (k < 0.25) { tela.elip(x + 2.5, yp - 3.5, 2.6, 3.5, (nx) => (nx < -0.3 ? "#d88a58" : nx > 0.4 ? "#8e4a2a" : "#b5663a")); tela.ret(x + 2, yp - 8, 2, 1, "#8e4a2a"); }
          else if (k < 0.45) { tela.ret(x, yp - 5, 5, 5, (xx, yy, i) => (i === 0 ? "#e8dcc0" : i === 4 ? "#8a7a5a" : "#c8b890")); }
          else if (k < 0.6) { tela.ret(x, yp - 4, 6, 4, (xx, yy, i, j) => (j === 0 ? "#6a8ad0" : i % 2 ? "#3b5a9a" : "#2e4680")); }
          else if (k < 0.78) { tela.elip(x + 3, yp - 2, 3, 2, (nx, ny) => (ny < -0.2 ? "#e8b94a" : "#b07a38")); }
          else { tela.ret(x + 1, yp - 6, 3, 6, (xx, yy, i, j) => (j < 2 ? "#3a8a5a" : "#7a5a3a")); }
        }
      }
      // pano pendurado com o sinal do comerciante (balança)
      const cx = Math.round(W / 2);
      tela.ret(cx - 4, T + 2, 9, 7, (x, y, i, j) => (j === 0 ? "#5a3820" : "#8e2a1f"));
      tela.lin(cx - 3, T + 5, cx + 3, T + 5, "#e8b94a"); tela.p(cx, T + 4, "#e8b94a"); tela.p(cx - 3, T + 6, "#e8b94a"); tela.p(cx + 3, T + 6, "#e8b94a");
    } else {
      // nicho com a candeia, réstia de ervas e um cesto pendurado
      const nx = 18 + Math.floor(hash2(s, 2, 81) * (W - 60));
      tela.ret(nx, T + 9, 10, 9, "#4a3020"); tela.ret(nx + 1, T + 10, 8, 7, "#6a4a30");
      tela.elip(nx + 5, T + 15, 3, 1.6, "#b5663a"); tela.p(nx + 7, T + 13, "#ffd24a"); tela.p(nx + 7, T + 12, "#fff0a0");
      const hx = nx + 22;
      tela.lin(hx, T + 4, hx + 10, T + 4, "#6b4a2e");
      for (let k = 0; k < 4; k++) { tela.lin(hx + 1 + k * 3, T + 5, hx + 1 + k * 3, T + 11 + (k % 2) * 2, k % 2 ? "#5a7a3a" : "#7a9a4a"); }
      if (W > 150) { const bx = W - 40; tela.elip(bx, T + 14, 5, 4, (nx2, ny) => ((Math.round(ny * 4) % 2) ? "#a8865e" : "#c8a470")); tela.lin(bx, T + 4, bx, T + 10, "#6b4a2e"); }
    }
    // paredes cortadas dos lados e da frente (12 px de espessura, na beira de fora)
    const cortada = (x, y, w, h) => {
      tela.ret(x, y, w, h, (xx, yy) => {
        const n = hash2(xx, yy, s + 11);
        return n < 0.15 ? topo[0] : n > 0.88 ? topo[2] : topo[1];
      });
    };
    cortada(0, T + 20, 12, H - 20);
    cortada(W - 12, T + 20, 12, H - 20);
    const ys = H + T - 12;
    for (let c = 0; c < L; c++) if (c !== porta) cortada(c * T, ys, T, 12);
    // bordas: luz em cima e à esquerda, sombra embaixo e à direita, e o contorno
    for (let y = T + 20; y < H + T; y++) { tela.p(11, y, topo[0]); tela.p(W - 12, y, topo[3]); tela.p(0, y, TINTA); tela.p(W - 1, y, TINTA); }
    for (let x = 0; x < W; x++) {
      if (Math.floor(x / T) === porta) continue;
      tela.p(x, ys, topo[3]); tela.p(x, H + T - 1, TINTA); tela.p(x, H + T - 2, topo[0]);
    }
    // batentes da porta
    const dx = porta * T;
    tela.ret(dx, ys - 2, 4, 14, "#6b4a2e"); tela.ret(dx + T - 4, ys - 2, 4, 14, "#5a3820");
    for (let x = 0; x < W; x++) tela.p(x, 19, TINTA);
    for (let y = 19; y < T + 20; y++) { tela.p(0, y, TINTA); tela.p(W - 1, y, TINTA); }
    return tela;
  }

  // Lado de fora: telhado (y 0 a H − 1, a pegada subida uma casa) e a fachada (y H a H + 31).
  function pintarFora(e, mat, L, A, W, H, s, porta, loja) {
    const tela = new Tela(W, H + T);
    if (mat.telhado === "lona") pintarLona(tela, mat, W, H, s);
    else pintarTerraco(tela, mat, W, H, s, loja);
    // fachada
    const fy = H;
    pintarFace(tela, 0, fy, W, T, mat, s);
    for (let x = 0; x < W; x++) {
      tela.tom(x, fy, "#1c1210", 0.55); tela.tom(x, fy + 1, "#1c1210", 0.35); tela.tom(x, fy + 2, "#1c1210", 0.15);
      tela.tom(x, fy + T - 1, "#1c1210", 0.45); tela.tom(x, fy + T - 2, "#1c1210", 0.2);
    }
    // pontas das vigas do teto (adobe, tijolo e pedra)
    if (mat.telhado === "terraco") for (let x = 6; x < W - 4; x += 12) { tela.ret(x, fy + 3, 3, 3, "#4e3018"); tela.p(x, fy + 3, "#8a6038"); }
    // janelas (treliça com persianas) nas casas sem porta, alternadas
    for (let c = 0; c < L; c++) {
      if (c === porta || Math.abs(c - porta) === 1 && loja) continue;
      if ((c + (porta & 1)) % 2 === 0 && L > 4) continue;
      if (mat.textura === "pano") continue;
      const jx = c * T + 10, jy = fy + 9;
      tela.ret(jx - 2, jy - 1, 16, 12, "#6b4a2e");
      tela.ret(jx, jy, 12, 9, "#1c1210");
      tela.ret(jx + 1, jy + 1, 10, 7, (x, y, i, j) => ((i + j) % 3 === 0 ? "#8a6038" : (i - j + 30) % 3 === 0 ? "#6b4a2e" : "#2a1a14"));
      tela.ret(jx - 2, jy + 10, 16, 2, (x, y, i, j) => (j === 0 ? "#b48452" : "#5a3820"));
      // luz quente lá dentro
      tela.p(jx + 5, jy + 4, "#e8a040"); tela.p(jx + 6, jy + 4, "#ffd27a");
    }
    // porta: vão em arco com batentes de madeira, porta aberta para dentro
    const dx = porta * T, dy = fy;
    const vx = dx + 7, vw = 18, vt = dy + 5;
    for (let y = vt; y < dy + T; y++) for (let x = vx; x < vx + vw; x++) {
      const ax = (x + 0.5 - (vx + vw / 2)) / (vw / 2), ay = (y - (vt + 6)) / 6;
      if (y < vt + 6 && ax * ax + ay * ay > 1) continue;
      const fundo = y > dy + T - 6 ? "#5a3e28" : "#1c1210";
      tela.p(x, y, fundo);
    }
    // a folha da porta é uma imagem à parte (pintarPorta): abre quando o jogador chega perto
    // verga e batentes
    tela.ret(vx - 3, vt - 2, vw + 6, 3, (x, y, i, j) => (j === 0 ? "#b48452" : j === 2 ? "#4e3018" : "#8a6038"));
    tela.ret(vx - 3, vt + 1, 3, dy + T - vt - 1, (x, y, i) => (i === 0 ? "#8a6038" : "#5a3820"));
    tela.ret(vx + vw, vt + 1, 3, dy + T - vt - 1, (x, y, i) => (i === 2 ? "#3a2414" : "#5a3820"));
    if (loja) pintarToldoEPlaca(tela, e, mat, W, fy, porta, s);
    tela.contorno();
    return tela;
  }

  function pintarTerraco(tela, mat, W, H, s, loja) {
    const [t0, t1, t2, t3] = mat.topo;
    // superfície do terraço: placas de barro batido sobre as vigas (juntas desencontradas), cada prédio num
    // tom, com manchas de chuva e remendos
    const tons = [[esc(t1, 0.12), t1, misturar(t1, t2, 0.5)], [esc(t1, 0.05), misturar(t1, t2, 0.4), t2], [esc(t1, 0.2), esc(t1, 0.08), t1]][Math.floor(hash2(s, 7, 24) * 3)];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fila = Math.floor(y / 20), off = (fila % 2) * 14, col = Math.floor((x + off) / 28);
      const lx = (x + off) % 28, ly = y % 20;
      const n = ruido(x / 10, y / 10, s + 20) * 0.6 + hash2(col, fila, s + 25) * 0.25 + hash2(x, y, s + 21) * 0.15;
      let c = rampa(tons, Math.min(1, n * 1.15), x, y);
      if (ly === 0 || lx === 0) c = esc(tons[0], 0.18);
      else if (ly === 1 || lx === 1) c = cla(c, 0.1);
      if (ruido(x / 14, y / 14, s + 26) > 0.74) c = misturar(c, "#5a5a3a", 0.25); // mancha de chuva
      tela.p(x, y, c);
    }
    // parapeito (7 px): topo claro com luz em cima/esquerda; a face de dentro aparece no lado de baixo e no
    // da direita (mais escura); a sombra dele cai no terraço junto ao norte e ao oeste
    const P = 7;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (d < P) {
        const faceDentro = (H - 1 - y === d && d >= P - 3) || (W - 1 - x === d && d >= P - 3);
        let c = d === 0 ? t1 : faceDentro ? t1 : d === 1 ? cla(t3, 0.15) : t3;
        if (d === P - 1 && !faceDentro) c = t2;
        if (!faceDentro && d > 1 && d < P - 1 && hash2(x, y, s + 22) < 0.12) c = t2;
        tela.p(x, y, c);
      } else if (d < P + 4 && (y - P < 4 || x - P < 4)) {
        tela.tom(x, y, "#1c1210", 0.34 - Math.min(y - P, x - P) * 0.08);
      }
    }
    // escoadouro de barro no meio da beira de baixo
    const ex = Math.round(W * 0.7);
    tela.ret(ex, H - 4, 4, 5, (x, y, i) => (i === 0 ? "#d88a58" : "#8e4a2a"));
    // forno de barro (tabun), jarros e uma esteira de palha com figos secando
    const fx = 20 + Math.floor(hash2(s, 1, 23) * (W - 70)), fy = 18 + Math.floor(hash2(s, 2, 23) * Math.max(1, H - 50));
    tela.elip(fx + 3, fy + 12, 11, 4, "#1c1210");
    for (let y = 0; y < 14; y++) for (let x = 0; x < 20; x++) {
      const nx = (x - 9.5) / 10, ny = (y - 12) / 12;
      if (nx * nx + ny * ny > 1 || y > 12) continue;
      tela.p(fx - 7 + x, fy + y, nx < -0.4 || ny < -0.75 ? "#d88a58" : nx > 0.45 ? "#8e4a2a" : "#b5663a");
    }
    tela.elip(fx + 3, fy + 3, 3, 2, "#3a1a10");
    const jx = W - 34, jy = H - 30;
    tela.elip(jx, jy, 5, 6, (nx, ny) => (nx < -0.4 ? "#d88a58" : nx > 0.4 ? "#7a3a20" : "#b5663a"));
    tela.ret(jx - 2, jy - 8, 4, 2, "#7a3a20");
    tela.elip(jx + 10, jy + 3, 4, 5, (nx) => (nx < -0.4 ? "#c8b48a" : nx > 0.4 ? "#7a6a4a" : "#a8946a"));
    if (H >= 4 * T) {
      const ex2 = 16, ey = H - 34, cores = loja ? ["#8e2a1f", "#b8402e"] : ["#a8865e", "#c8a470"];
      tela.ret(ex2, ey, 30, 18, (x, y, i, j) => (i === 0 || j === 0 || i === 29 || j === 17 ? esc(cores[0], 0.2) : (j >> 1) % 2 ? cores[0] : cores[1]));
      for (let k = 0; k < 6; k++) tela.elip(ex2 + 5 + (k % 3) * 9, ey + 5 + Math.floor(k / 3) * 7, 2, 2, (nx) => (nx < 0 ? "#8a5a8a" : "#5a2e5a"));
    }
    // pequena escada de madeira encostada no parapeito leste (acesso pelo lado de fora)
    const lx = W - 12;
    for (let y = 10; y < 34; y++) { tela.p(lx, y, "#6b4a2e"); tela.p(lx + 6, y, "#5a3820"); }
    for (let y = 12; y < 34; y += 5) tela.lin(lx, y, lx + 6, y, "#a87444");
  }

  function pintarLona(tela, mat, W, H, s) {
    const [t0, t1, t2, t3] = mat.topo, meio = Math.round(H * 0.42);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // duas águas: a de cima mais clara (luz), a de baixo mais escura, e a cumeeira no meio
      const t = y < meio ? 0.75 - (y / meio) * 0.25 : 0.4 - ((y - meio) / (H - meio)) * 0.3;
      const dobra = Math.sin((x / 24) * Math.PI * 2) * 0.12;
      let c = rampa([t0, t1, t2, t3], Math.max(0, Math.min(1, t + dobra)), x, y);
      if (mat.listra && x % 32 === 15) c = y < meio ? mat.listra[1] : mat.listra[0];
      else if (mat.listra && x % 32 === 16) c = esc(y < meio ? mat.listra[1] : mat.listra[0], 0.3);
      if (Math.abs(y - meio) < 1) c = esc(t0, 0.2);
      tela.p(x, y, c);
    }
    // franja embaixo e beiral levantado
    for (let x = 0; x < W; x++) { tela.p(x, H - 1, t0); if (x % 4 < 2) tela.p(x, H - 2, t1); }
    // mastros nas pontas da cumeeira e no meio
    for (const x of [6, W >> 1, W - 7]) { tela.ret(x - 1, meio - 9, 3, 10, (xx, y, i) => (i === 0 ? "#a87444" : "#5a3820")); tela.p(x, meio - 10, "#e8b94a"); }
  }

  // Toldo listrado sobre a porta (3 casas) e a placa pendurada ao lado, com o sinal do comerciante.
  function pintarToldoEPlaca(tela, e, mat, W, fy, porta, s) {
    const cores = mat.id === "tenda" ? ["#2e4680", "#e8dcc0"] : mat.id === "basalto" ? ["#3b5a9a", "#e8dcc0"] : ["#a8342a", "#efe2c4"];
    const x0 = Math.max(0, (porta - 1) * T + 4), x1 = Math.min(W, (porta + 2) * T - 4), y0 = fy - 4, alt = 10;
    for (let y = y0; y < y0 + alt; y++) for (let x = x0; x < x1; x++) {
      const faixa = Math.floor((x - x0) / 8) % 2;
      let c = faixa ? cores[1] : cores[0];
      if (y === y0) c = cla(c, 0.25);
      else if (y > y0 + alt - 3) c = esc(c, 0.18);
      tela.p(x, y, c);
    }
    // borda recortada (meias-luas)
    for (let x = x0; x < x1; x++) {
      const lx = (x - x0) % 8;
      if (lx > 0 && lx < 7) tela.p(x, y0 + alt, Math.floor((x - x0) / 8) % 2 ? cores[1] : cores[0]);
      if (lx > 1 && lx < 6) tela.p(x, y0 + alt + 1, Math.floor((x - x0) / 8) % 2 ? esc(cores[1], 0.1) : esc(cores[0], 0.1));
    }
    // sombra do toldo na parede
    for (let x = x0 + 2; x < x1; x++) tela.tom(x, y0 + alt + 2, "#1c1210", 0.35);
    // placa: suporte de ferro e tábua com a balança de dois pratos
    const lado = porta + 1 < Math.round(W / T) ? 1 : -1;
    const bx = lado > 0 ? (porta + 2) * T - 2 : (porta - 1) * T + 2;
    const pyb = fy + 6;
    tela.lin(bx, pyb, bx + lado * 10, pyb, "#2a2a2a");
    tela.lin(bx + lado * 3, pyb + 1, bx + lado * 3, pyb + 3, "#2a2a2a");
    tela.lin(bx + lado * 9, pyb + 1, bx + lado * 9, pyb + 3, "#2a2a2a");
    const qx = lado > 0 ? bx + 1 : bx - 13, qy = pyb + 4;
    tela.ret(qx, qy, 13, 11, (x, y, i, j) => (i === 0 || j === 0 || i === 12 || j === 10 ? "#4e3018" : j === 1 ? "#c8945a" : "#a87444"));
    // balança
    tela.lin(qx + 6, qy + 2, qx + 6, qy + 8, "#e8b94a");
    tela.lin(qx + 2, qy + 3, qx + 10, qy + 3, "#e8b94a");
    tela.lin(qx + 1, qy + 6, qx + 4, qy + 6, "#e8b94a"); tela.lin(qx + 8, qy + 6, qx + 11, qy + 6, "#e8b94a");
    tela.p(qx + 2, qy + 5, "#b07a38"); tela.p(qx + 9, qy + 5, "#b07a38");
    tela.lin(qx + 4, qy + 9, qx + 8, qy + 9, "#b07a38");
  }

  function pintarSombra(W, H) {
    // sombra projetada para a direita e para baixo (luz de cima e da esquerda), sobre a pegada deslocada
    // imagem colocada no canto da pegada: faixa de 10 px à direita (a partir de y 4) e de 5 px embaixo
    const tela = new Tela(W + 10, H + 5);
    for (let y = 0; y < H + 5; y++) for (let x = 0; x < W + 10; x++) {
      if (x < W && y < H) continue;
      if (x >= W && y < 4 + (x - W)) continue; // ponta de cima em diagonal
      if (y >= H && x < 6 + (y - H)) continue; // ponta da esquerda em diagonal
      const borda = Math.min(W + 10 - x, H + 5 - y);
      tela.p(x, y, "#1c1210", borda < 3 ? 0.13 : 0.26);
    }
    return tela;
  }

  // ---------------------------------------------------------------- móveis (32 × 48, base na linha 47)
  // viz: { esq, dir } para o balcão emendar com os vizinhos.
  function pintarMovel(tipo, mat, viz = {}, semente = 0) {
    const tela = new Tela(T, 48);
    const B = 47;
    const madeira = ["#4e3018", "#6b4a2e", "#8a5a32", "#a87444", "#c8945a"];
    switch (tipo) {
      case "balcao": {
        const x0 = viz.esq ? 0 : 2, x1 = viz.dir ? T : T - 2;
        // tampo
        tela.ret(x0, B - 26, x1 - x0, 8, (x, y, i, j) => (j === 0 ? madeira[4] : j === 7 ? madeira[1] : (x + y) % 9 === 0 ? madeira[2] : madeira[3]));
        // frente em tábuas verticais
        tela.ret(x0, B - 18, x1 - x0, 18, (x, y, i, j) => (j === 0 ? "#2a1a14" : x % 8 === 0 ? madeira[0] : x % 8 === 1 ? madeira[3] : j > 15 ? madeira[1] : madeira[2]));
        if (!viz.esq) tela.ret(x0, B - 26, 1, 26, madeira[0]);
        if (!viz.dir) tela.ret(x1 - 1, B - 26, 1, 26, madeira[0]);
        // mercadoria sobre o balcão
        const k = Math.floor(hash2(semente, 3, 90) * 5);
        const cx = 8 + Math.floor(hash2(semente, 4, 90) * 14), cy = B - 24;
        if (k === 0) { tela.elip(cx, cy - 3, 3.2, 4, (nx) => (nx < -0.3 ? "#d88a58" : nx > 0.4 ? "#8e4a2a" : "#b5663a")); tela.ret(cx - 1, cy - 9, 3, 2, "#8e4a2a"); }
        else if (k === 1) { for (let i = 0; i < 4; i++) tela.elip(cx - 3 + i * 2, cy - 1 - (i % 2), 1.6, 1.2, "#e8b94a"); tela.p(cx, cy - 3, "#fff0a0"); }
        else if (k === 2) { tela.ret(cx - 4, cy - 4, 9, 4, (x, y, i, j) => (j === 0 ? "#ead6a6" : "#c8b48a")); tela.ret(cx - 3, cy - 6, 7, 2, "#d8c098"); }
        else if (k === 3) { tela.lin(cx, cy - 8, cx, cy, "#b07a38"); tela.lin(cx - 5, cy - 7, cx + 5, cy - 7, "#e8b94a"); tela.elip(cx - 4, cy - 3, 2.5, 1, "#e8b94a"); tela.elip(cx + 4, cy - 3, 2.5, 1, "#e8b94a"); }
        else { tela.elip(cx, cy - 2, 4, 2.5, (nx, ny) => (ny < 0 ? "#c8a470" : "#8a6a3a")); tela.elip(cx - 1, cy - 4, 1.5, 1.2, "#c8402f"); tela.elip(cx + 2, cy - 4, 1.5, 1.2, "#7a9a3a"); }
        break;
      }
      case "barris": {
        const barril = (cx, by, rx, h) => {
          for (let y = by - h; y <= by; y++) for (let x = cx - rx; x <= cx + rx; x++) {
            const nx = (x - cx) / rx, bojo = 1 - 0.12 * Math.cos(((y - (by - h)) / h) * Math.PI);
            if (Math.abs(nx) > bojo) continue;
            let c = nx < -0.45 ? madeira[3] : nx > 0.45 ? madeira[1] : madeira[2];
            if ((y - (by - h)) % Math.round(h / 3) === 2) c = "#3a3a3a";
            tela.p(x, y, c);
          }
          tela.elip(cx, by - h, rx - 1, 2.2, (nx, ny) => (ny < 0 ? madeira[4] : madeira[3]));
        };
        barril(10, B - 2, 7, 18); barril(23, B - 1, 7, 16);
        break;
      }
      case "caixotes": {
        const caixa = (x, y, w, h) => tela.ret(x, y, w, h, (xx, yy, i, j) => (i === 0 || j === 0 ? madeira[4] : i === w - 1 || j === h - 1 ? madeira[0] : i === j || i === w - 1 - j ? madeira[1] : j % 5 === 0 ? madeira[1] : madeira[3]));
        caixa(2, B - 14, 16, 14); caixa(16, B - 12, 14, 12); caixa(6, B - 26, 13, 12);
        break;
      }
      case "sacos": {
        const saco = (cx, by, r) => {
          tela.elip(cx, by - r, r, r + 1, (nx, ny) => (nx < -0.4 || ny < -0.6 ? "#e2cc9c" : nx > 0.45 ? "#9a8256" : "#c8b082"));
          tela.ret(cx - 2, by - 2 * r - 3, 4, 3, "#9a8256"); tela.lin(cx - 2, by - 2 * r - 1, cx + 2, by - 2 * r - 1, "#6b4a2e");
        };
        saco(9, B, 7); saco(22, B, 6); saco(15, B - 9, 6);
        tela.elip(22, B - 13, 2.5, 1.5, "#e8d070");
        break;
      }
      case "cama": {
        // esteira de dormir com manta e almofada (baixa, quase no chão)
        tela.ret(2, B - 22, 28, 22, (x, y, i, j) => (i === 0 || j === 0 ? "#6a5232" : (j % 3 === 0) ? "#a8906a" : "#c8b082"));
        tela.ret(4, B - 20, 10, 6, (x, y, i, j) => (j === 0 ? "#f0e6cf" : "#d8ccb0"));
        tela.ret(4, B - 13, 24, 12, (x, y, i, j) => (j === 0 ? "#a8443a" : (i + j) % 6 < 3 ? "#8e2a1f" : "#7a2018"));
        tela.ret(4, B - 2, 24, 1, "#1c1210", 0.4);
        break;
      }
      case "jarros": {
        const jarro = (cx, by, rx, h, cores) => {
          for (let y = by - h; y <= by; y++) for (let x = cx - rx; x <= cx + rx; x++) {
            const t = (y - (by - h)) / h, larg = rx * (t < 0.15 ? 0.45 : Math.sin(Math.min(1, (t - 0.05) * 1.2) * Math.PI * 0.95) * 0.85 + 0.15);
            const nx = (x - cx) / Math.max(1, larg);
            if (Math.abs(nx) > 1) continue;
            tela.p(x, y, nx < -0.4 ? cores[2] : nx > 0.45 ? cores[0] : cores[1]);
          }
          tela.ret(cx - Math.round(rx * 0.45), by - h - 1, Math.round(rx * 0.9) + 1, 2, cores[0]);
        };
        jarro(11, B - 1, 8, 26, ["#7a3a20", "#a8562e", "#d07a4a"]);
        jarro(23, B, 6, 18, ["#7a6a4a", "#a8946a", "#c8b48a"]);
        break;
      }
      case "mesa": {
        // mesa baixa com pão e copo, e um banquinho
        tela.ret(3, B - 20, 24, 7, (x, y, i, j) => (j === 0 ? madeira[4] : j === 6 ? madeira[1] : madeira[3]));
        tela.ret(5, B - 13, 3, 11, madeira[1]); tela.ret(22, B - 13, 3, 11, madeira[0]);
        tela.elip(11, B - 22, 4, 2, (nx, ny) => (ny < 0 ? "#d8a860" : "#a87444"));
        tela.ret(18, B - 25, 4, 5, (x, y, i) => (i === 0 ? "#d88a58" : "#a8562e"));
        tela.ret(24, B - 9, 6, 3, madeira[3]); tela.ret(25, B - 6, 1, 6, madeira[1]); tela.ret(28, B - 6, 1, 6, madeira[0]);
        break;
      }
    }
    // sombra no chão e contorno
    const sombra = new Tela(T, 48);
    for (let x = 4; x < T; x++) for (let y = B - 3; y <= B; y++) if (!tela.tem(x, y) && tela.tem(x - 3, y - 2)) sombra.p(x, y, "#1c1210", 0.3);
    tela.contorno();
    for (let i = 0; i < sombra.buf.length; i += 4) if (sombra.buf[i + 3] && !tela.buf[i + 3]) { tela.buf[i] = 28; tela.buf[i + 1] = 18; tela.buf[i + 2] = 16; tela.buf[i + 3] = 70; }
    return tela;
  }

  // Folha da porta (32 × 32, no lugar da casa da porta na fachada): fechada (tábuas com cravos e argola de
  // ferro; na tenda, a aba de pano baixada) ou aberta (encostada à esquerda; na tenda, a aba amarrada).
  function pintarPorta(mat, aberta) {
    const tela = new Tela(T, T);
    const vx = 7, vw = 18, vt = 5;
    const dentroDoArco = (x, y) => {
      const ax = (x + 0.5 - (vx + vw / 2)) / (vw / 2), ay = (y - (vt + 6)) / 6;
      return x >= vx && x < vx + vw && y >= vt && y < T && !(y < vt + 6 && ax * ax + ay * ay > 1);
    };
    if (mat.textura === "pano") {
      const [c0, c1, c2] = mat.face, l = mat.listra || [c0, c1];
      if (aberta) {
        for (let y = vt; y < T; y++) for (let x = vx; x < vx + 6; x++) if (dentroDoArco(x, y)) tela.p(x, y, (y >> 2) % 3 === 0 ? l[1] : x === vx + 5 ? c0 : c1);
        tela.lin(vx, vt + 12, vx + 6, vt + 12, "#3a2414");
      } else {
        for (let y = vt; y < T; y++) for (let x = vx; x < vx + vw; x++) if (dentroDoArco(x, y)) {
          const dobra = Math.sin(((x - vx) / vw) * Math.PI * 3);
          tela.p(x, y, (y - vt) % 9 < 2 ? l[(x >> 2) & 1] : dobra > 0.4 ? c2 : dobra < -0.4 ? c0 : c1);
        }
      }
      return tela;
    }
    const madeira = ["#3a2414", "#5a3820", "#7a5232", "#8a5a32", "#a87444"];
    if (aberta) {
      for (let y = vt + 6; y < T - 1; y++) for (let i = 0; i < 4; i++) tela.p(vx + i, y, i === 0 ? madeira[4] : i === 3 ? madeira[1] : madeira[3]);
      tela.p(vx + 1, vt + 10, "#e8b94a"); tela.p(vx + 1, T - 6, "#e8b94a");
      return tela;
    }
    for (let y = vt; y < T; y++) for (let x = vx; x < vx + vw; x++) {
      if (!dentroDoArco(x, y)) continue;
      const lx = x - vx, tab = lx % 5;
      let c = tab === 0 ? madeira[1] : tab === 1 ? madeira[4] : madeira[3];
      if (y === T - 1) c = madeira[0];
      if (y === vt + 9 || y === T - 7) c = tab === 0 ? "#2a2a2a" : "#4a4a4a"; // ferragens
      tela.p(x, y, c);
    }
    tela.p(vx + vw - 5, vt + 15, "#e8b94a"); tela.p(vx + vw - 4, vt + 16, "#b07a38"); tela.p(vx + vw - 6, vt + 16, "#b07a38"); tela.p(vx + vw - 5, vt + 17, "#b07a38");
    return tela;
  }
  function texturaPorta(scene, variante, aberta) {
    const chave = `porta_${variante || 0}_${aberta ? 1 : 0}`;
    if (!scene.textures.exists(chave)) scene.textures.addCanvas(chave, pintarPorta(material(variante), aberta).canvas());
    return chave;
  }

  // Registra as texturas do prédio na cena; devolve as chaves.
  function texturasPredio(scene, e) {
    const base = `pr_${e.tipo}_${e.x}_${e.y}_${e.variante || 0}`;
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
  // Muro de vila (e mureta de campo) que emenda com os vizinhos: mask N1 L2 S4 O8. Textura 32 × 52: o topo
  // (a pegada subida 20 px) e a face de baixo, que aparece onde o muro não continua para o sul.
  const ALTURA_MURO = 20;
  const MUROS = {
    muro: { face: ["#5e5646", "#807662", "#a0957c", "#bcb196"], textura: "blocos", topo: ["#7a705c", "#9a8e76", "#b6aa8e", "#d0c6a8"] },
    tijolos: { face: ["#5a301c", "#7a4428", "#9a5a36", "#b8724a"], textura: "tijolo", topo: ["#8a5a38", "#a87048", "#c08658", "#d8a070"] },
  };
  function pintarMuro(tipo, mask, v) {
    const m = MUROS[tipo] || MUROS.muro, h = ALTURA_MURO, tela = new Tela(T, T + h);
    const a = 9, b = 23; // espessura do muro: 14 px no meio da casa
    const noTopo = (x, y) => (x >= a && x < b && y >= a && y < b) || (mask & 1 && x >= a && x < b && y < a) || (mask & 4 && x >= a && x < b && y >= b) ||
      (mask & 8 && y >= a && y < b && x < a) || (mask & 2 && y >= a && y < b && x >= b);
    // face: abaixo da última linha do topo em cada coluna
    for (let x = 0; x < T; x++) {
      let fundo = -1;
      for (let y = T - 1; y >= 0; y--) if (noTopo(x, y)) { fundo = y; break; }
      if (fundo < 0 || fundo === T - 1) continue;
      pintarFace(tela, x, fundo + 1, 1, h, { textura: m.textura }, 300 + v, m.face);
      tela.tom(x, fundo + 1, "#1c1210", 0.3);
      tela.tom(x, fundo + h, "#1c1210", 0.35);
    }
    // topo: pedras de cobertura com luz em cima e à esquerda
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      if (!noTopo(x, y)) continue;
      const bx = Math.floor((x + (Math.floor(y / 7) % 2) * 5) / 10), by = Math.floor(y / 7), lx = (x + (by % 2) * 5) % 10, ly = y % 7;
      const t = hash2(bx + v * 7, by, 310);
      let c = t < 0.3 ? m.topo[1] : t > 0.85 ? m.topo[3] : m.topo[2];
      if (lx === 0 || ly === 0) c = m.topo[0];
      else if (ly === 1 || lx === 1) c = cla(c, 0.12);
      const borda = !noTopo(x - 1, y) || !noTopo(x, y - 1);
      const borda2 = !noTopo(x + 1, y) || !noTopo(x, y + 1);
      if (borda) c = m.topo[3]; else if (borda2) c = m.topo[0];
      tela.p(x, y, c);
    }
    // grama ao pé do muro e o contorno
    tela.contorno();
    return tela;
  }
  function texturaMuro(scene, tipo, mask, v = 0) {
    const chave = `muro_${tipo}_${mask}_${v % 3}`;
    if (!scene.textures.exists(chave)) scene.textures.addCanvas(chave, pintarMuro(tipo, mask, v % 3).canvas());
    return chave;
  }

  // ---------------------------------------------------------------- chão contínuo
  // Classe de cada casa: 0 não pinta (água, borda, fora), 1 chão, 2 estrada de terra, 3 rua de pedra (caminho
  // dentro de uma vila), 4 chão de prédio (fica sob as imagens do prédio).
  const NADA = 0, CHAO = 1, TERRA = 2, RUA = 3, PREDIO = 4;
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

  const LADO = 16; // casas por pedaço
  function pintarPedacoChao(area, bx, by) {
    const bio = Arte.BIOMAS[area] || Arte.BIOMAS.canaan;
    const { cls, gasto } = classesDaArea(area);
    const L = LADO * T, tela = new Tela(L, L);
    const s = 991 + area.length * 13;
    const c = bio.chao, m = bio.mancha, cm = bio.caminho;
    const [r0, g0] = rgb(c.base);
    const relva = g0 > r0 + 8;
    const areia = !relva;
    const tonsChao = [c.escuro, misturar(c.escuro, c.base, 0.5), c.base, misturar(c.base, c.claro, 0.5), c.claro];
    const tonsMancha = [m.escuro, misturar(m.escuro, m.base, 0.5), m.base, misturar(m.base, c.base, 0.4)];
    const tonsTerra = [cm.escuro, misturar(cm.escuro, cm.base, 0.5), cm.base, misturar(cm.base, cm.claro, 0.5), cm.claro];
    const tonsGasto = tonsTerra.map((t) => misturar(t, c.base, 0.35));
    const pedra = area === "egito" ? ["#9a8a68", "#b8a882", "#d0c29c", "#e4d8b8"] : area === "galileia" ? ["#4a4844", "#5e5b56", "#76726a", "#908b80"] : ["#8a7e66", "#a89a7e", "#c2b496", "#d8ccb0"];
    const junta = area === "galileia" ? "#2a2826" : "#5a4e3a";
    const W0 = bx * L, H0 = by * L;
    const classe = (wx, wy) => {
      const x = Math.floor(wx / T), y = Math.floor(wy / T);
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return naOrla(area, x, y) ? CHAO : NADA;
      return cls[y * COLS + x];
    };
    const gastoEm = (wx, wy) => {
      // bilinear entre os centros das casas
      const fx = wx / T - 0.5, fy = wy / T - 0.5, x = Math.floor(fx), y = Math.floor(fy), tx = fx - x, ty = fy - y;
      const g = (xx, yy) => (xx < 0 || yy < 0 || xx >= COLS || yy >= ROWS ? 0 : gasto[yy * COLS + xx]);
      return (g(x, y) * (1 - tx) + g(x + 1, y) * tx) * (1 - ty) + (g(x, y + 1) * (1 - tx) + g(x + 1, y + 1) * tx) * ty;
    };
    for (let py = 0; py < L; py++) {
      const wy = H0 + py;
      for (let px = 0; px < L; px++) {
        const wx = W0 + px;
        const propria = classe(wx, wy);
        if (propria === NADA) continue;
        // amostra deslocada por ruído: beiras orgânicas entre relva e estrada
        const ox = (ruido(wx / 21, wy / 21, s + 1) - 0.5) * 18, oy = (ruido(wx / 21 + 40, wy / 21, s + 2) - 0.5) * 18;
        let k = classe(wx + ox, wy + oy);
        if (k === NADA || k === PREDIO) k = propria === PREDIO ? CHAO : propria;
        // rua de pedra: beira quase reta (pouco ruído)
        if (k === RUA || propria === RUA) {
          const k2 = classe(wx + ox * 0.18, wy + oy * 0.18);
          k = k2 === NADA || k2 === PREDIO ? propria : k2;
        }
        let cor;
        if (k === RUA) {
          // pedras em fiadas de 8 px, larguras desencontradas, junta escura e luz em cima/esquerda
          const fila = wy >> 3, ly = wy & 7, off = Math.floor(hash2(fila, 3, s) * 10);
          const larg = 9 + Math.floor(hash2(fila, 4, s) * 4), col = Math.floor((wx + off) / larg), lx = (wx + off) % larg;
          const tom = hash2(col, fila, s + 5);
          cor = pedra[tom < 0.25 ? 0 : tom < 0.6 ? 1 : tom < 0.9 ? 2 : 3];
          if (ly === 0 || lx === 0 || (ly === 1 && lx === 1) || (ly === 7 && lx === larg - 1)) cor = junta;
          else if (ly === 1 || lx === 1) cor = misturar(cor, "#fff6e0", 0.18);
          else if (ly === 7 || lx === larg - 1) cor = misturar(cor, junta, 0.35);
          // beira da rua: meio-fio
          const fora = classe(wx + 4, wy) !== RUA || classe(wx - 4, wy) !== RUA || classe(wx, wy + 4) !== RUA || classe(wx, wy - 4) !== RUA;
          if (fora && propria !== RUA && hash2(wx >> 2, wy >> 2, s + 6) < 0.5) cor = misturar(cor, c.base, 0.5);
        } else if (k === TERRA) {
          const n = ruido(wx / 13, wy / 13, s + 7) * 0.6 + ruido(wx / 5, wy / 5, s + 8) * 0.4;
          cor = rampa(tonsTerra, Math.min(1, Math.max(0, n * 1.1 - 0.05)), wx, wy);
          // beira: um fio mais escuro e tufos de relva por cima
          const vizChao = (dx, dy) => { const q = classe(wx + ox + dx, wy + oy + dy); return q === CHAO || q === PREDIO; };
          if (vizChao(0, -3) || vizChao(3, 0) || vizChao(0, 3) || vizChao(-3, 0)) {
            cor = cm.borda;
            if (relva && hash2(wx, wy, s + 9) < 0.35) cor = c.escuro;
          }
          // sulcos das rodas
          const h = hash2(wx >> 1, wy >> 1, s + 10);
          if (h < 0.025) cor = cm.claro; else if (h > 0.985) cor = cm.escuro;
        } else {
          // relva ou areia: tom de baixa frequência + manchas grandes
          const n = ruido(wx / 85, wy / 85, s + 11) * 0.55 + ruido(wx / 27, wy / 27, s + 12) * 0.3 + hash2(wx >> 1, wy >> 1, s + 13) * 0.15;
          const mn = ruido(wx / 140, wy / 140, s + 14) * 0.75 + ruido(wx / 31, wy / 31, s + 15) * 0.25;
          if (mn > 0.62 + bayer(wx, wy) * 0.05 && area !== "egito") cor = rampa(tonsMancha, Math.min(1, Math.max(0, (n - 0.2) * 1.4)), wx, wy);
          else cor = rampa(tonsChao, Math.min(1, Math.max(0, (n - 0.15) * 1.35)), wx, wy);
          if (area === "egito" && mn > 0.58) {
            // campos de plantio: sulcos paralelos
            const sulco = (wy + Math.round(ruido(wx / 60, wy / 60, s) * 6)) % 8;
            cor = sulco < 2 ? m.escuro : sulco < 4 ? m.base : misturar(m.base, c.base, 0.4);
          }
          if (areia) {
            // ondulações da areia
            const v = (wy + ruido(wx / 46, wy / 46, s + 16) * 26 + wx * 0.1) / 14;
            const f = v - Math.floor(v), forte = ruido(wx / 70, wy / 70, s + 27);
            if (forte > 0.45) {
              if (f < 0.07) cor = misturar(cor, c.claro, 0.55); else if (f < 0.12) cor = misturar(cor, c.escuro, 0.25);
            }
          }
          // chão pisado das vilas e da frente das portas
          const g = gastoEm(wx, wy) + (ruido(wx / 11, wy / 11, s + 17) - 0.5) * 0.45;
          if (g > 0.48) {
            const t = ruido(wx / 9, wy / 9, s + 18);
            cor = g > 0.56 ? rampa(tonsGasto, t, wx, wy) : (bayer(wx, wy) < 0.5 ? rampa(tonsGasto, t, wx, wy) : cor);
          }
        }
        // beira da água: areia molhada e uma linha escura
        if (propria !== NADA) {
          const lx = wx & 31, ly = wy & 31;
          const agua = (dx, dy) => { const x = (wx >> 5) + dx, y = (wy >> 5) + dy; return x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1 && pisos[area][y][x] === PISO.AGUA; };
          let d = 99;
          if (agua(0, -1)) d = Math.min(d, ly); if (agua(0, 1)) d = Math.min(d, 31 - ly);
          if (agua(-1, 0)) d = Math.min(d, lx); if (agua(1, 0)) d = Math.min(d, 31 - lx);
          const borda = d + (ruido(wx / 7, wy / 7, s + 19) - 0.5) * 4;
          if (borda < 1.5) cor = "#3a3022";
          else if (borda < 6) cor = misturar(cor, "#6a5a3e", 0.45);
        }
        tela.p(px, py, cor);
      }
    }
    // folhinhas de relva (2–3 px, ponta clara) e pedrinhas, em posições do mundo
    if (relva) for (let gy = 0; gy < L; gy += 5) for (let gx = 0; gx < L; gx += 5) {
      const wx = W0 + gx, wy = H0 + gy, h = hash2(wx, wy, s + 20);
      if (h > 0.42) continue;
      const x = gx + Math.floor(hash2(wx, wy, s + 21) * 4), y = gy + Math.floor(hash2(wx, wy, s + 22) * 4);
      const k = classe(W0 + x, H0 + y);
      if (k !== CHAO) continue;
      if (gastoEm(W0 + x, H0 + y) > 0.5) continue;
      tela.p(x, y, h < 0.14 ? c.claro : misturar(c.claro, c.base, 0.4));
      tela.p(x, y + 1, c.escuro);
      if (h < 0.08) { tela.p(x + 1, y - 1, c.claro); tela.p(x + 1, y, c.escuro); }
    }
    for (let gy = 0; gy < L; gy += 9) for (let gx = 0; gx < L; gx += 9) {
      const wx = W0 + gx, wy = H0 + gy;
      if (hash2(wx, wy, s + 23) > 0.06) continue;
      const x = gx + Math.floor(hash2(wx, wy, s + 24) * 7), y = gy + Math.floor(hash2(wx, wy, s + 25) * 7);
      const k = classe(W0 + x, H0 + y);
      if (k !== CHAO && k !== TERRA) continue;
      const pc = k === TERRA ? cm.claro : misturar(c.base, "#c8b898", 0.6);
      tela.p(x, y, misturar(pc, "#fff6e0", 0.3)); tela.p(x + 1, y, pc); tela.p(x, y + 1, pc); tela.p(x + 1, y + 1, misturar(pc, "#1c1210", 0.3)); tela.p(x + 2, y + 1, misturar(pc, "#1c1210", 0.5));
    }
    return tela;
  }

  function texturaPedacoChao(scene, area, bx, by) {
    const chave = `chao_${area}_${bx}_${by}`;
    if (!scene.textures.exists(chave)) scene.textures.addCanvas(chave, pintarPedacoChao(area, bx, by).canvas());
    return chave;
  }

  global.Cenario = {
    MATERIAIS_PREDIO, material, LADO_PEDACO: LADO,
    obstaculosDaOrla, naOrla, MOLDURA_CASAS, temOrla: (area) => !!ORLAS[area],
    texturasPredio, texturaMovel, texturaPorta, texturaPedacoChao, classesDaArea, texturaMuro, MUROS, ALTURA_MURO,
    // para testes e ferramentas
    pintarPredio, pintarMovel, pintarPedacoChao,
  };
})(typeof window !== "undefined" ? window : globalThis);
