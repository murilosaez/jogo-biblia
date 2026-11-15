// =====================================================================
// arte/icones.js — ícones de interface, habilidades e ofícios (pacote A9 do plano de arte).
//
// Chaves que este arquivo assume (registrar() com a MESMA chave troca o desenho legado de sprites.js):
//   35 ui_* (16 × 16 px; ui_rosa 32 × 32), 39 hb_* e 6 of_* (32 × 32 px), todos em res 2;
//   preenche Arte.TAM_ICONE. As chamadas glifo("…") continuam em sprites.js
//
// Como é desenhado:
//   * ui_*: figura pixel a pixel (mapa de 16 × 16 letras, uma letra por px de arte) ou por traços finos,
//     com 3-4 tons e contorno de tinta de 1 px, para ler sobre couro escuro e sobre pergaminho.
//   * hb_*: placa de bronze com campo tingido pela vocação (carmim do guerreiro, mar do atirador,
//     índigo do sacerdote, púrpura do profeta, pasto do pastor) e a figura por cima.
//   * of_*: selo redondo de bronze com campo de pergaminho e a ferramenta do ofício.
//   Tudo passa por uma tela própria (Fig) em px de arte e só no fim vai para a Grade com g.fino.
//
// Contrato (docs/GUIA-DE-ARTE.md, seção "Contrato"):
//   * Só primitivas em px de arte. São PROIBIDOS os blocos de unidade (2 × 2 px).
//   * def.w e def.h em unidades de 1/16 de casa (= 2 px de arte): 16 × 16 px é w: 8, h: 8.
//   * Luz de cima e da esquerda. Nada de document, canvas ou window na carga.
//   * Nenhuma coordenada de mapa no código. Arte 100% original.
// =====================================================================
(function (global) {
  "use strict";
  const Arte = global.Arte;
  if (!Arte || !Arte.motor) return;
  const M = Arte.motor, registrar = M.registrar, PP = M.PIXEL_PATTERNS, misturar = M.misturar;

  // -------------------------------------------------------------------
  // Rampas (do claro para o escuro, 4 tons)
  // -------------------------------------------------------------------
  const OURO = ["#fff0b0", "#f0c048", "#c08a2a", "#7a5218"];
  const BRONZE = ["#f4d088", "#c8923c", "#925f22", "#5a3814"];
  const ACO = ["#f4f8fa", "#c0ccd4", "#8494a0", "#4a5662"];
  const MAD = ["#d8a868", "#a8703a", "#7a4a2a", "#4a2c1c"];
  const PEDRA = ["#f0e6cc", "#c8bb9c", "#968a74", "#5e5448"];
  const VERM = ["#f8a080", "#d84a32", "#a02a22", "#5e161a"];
  const PELE = ["#f8d4a8", "#e0a878", "#b87850", "#7c4a34"];
  const AGUA = ["#e0fafa", "#78d4dc", "#3a94b0", "#1e5878"];
  const VERDE = ["#d0f088", "#84c048", "#4c8a30", "#285420"];
  const LA = ["#ffffff", "#f0e8d4", "#c8bca0", "#8a7c68"];
  const BARRO = ["#f0b488", "#c47e52", "#935434", "#5c3020"];
  const ROXO = ["#e4c4f6", "#a868d8", "#6e3ca0", "#40205e"];
  const ESCURO = ["#74645a", "#4a3e38", "#2e2622", "#1a1210"];
  const CHIFRE = ["#f8ecc8", "#d8b888", "#a88458", "#6e5034"];
  const PELO = ["#f0c890", "#d09a58", "#a06c38", "#6a4424"];
  const LUZ = ["#ffffff", "#dcf2f8", "#9ccae0", "#5a8cb0"];
  const FOGO = ["#fff8c0", "#ffd848", "#ff9a28", "#e0501c"];
  const AREIA = ["#f4e2b0", "#dcc288", "#b89a64", "#8a7048"];
  const TINTA = "#1c100c";

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const RAD = Math.PI / 180;

  // -------------------------------------------------------------------
  // Tela de trabalho em px de arte
  // -------------------------------------------------------------------
  function Fig(w, h) {
    const d = new Array(w * h).fill(null), topo = [];
    const cor = (c, x, y, a, b) => (typeof c === "function" ? c(x, y, a, b) : c);
    const F = {
      w, h, d, topo,
      ler(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? d[y * w + x] : null; },
      pt(x, y, c) { x = Math.round(x); y = Math.round(y); if (c && x >= 0 && y >= 0 && x < w && y < h) d[y * w + x] = c; },
      apagar(x, y) { if (x >= 0 && y >= 0 && x < w && y < h) d[y * w + x] = null; },
      // mistura sobre o que já existe (brilhos do fundo)
      mix(x, y, c, a) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const v = d[y * w + x];
        if (v) d[y * w + x] = misturar(v, c, Math.max(0, Math.min(1, a)));
      },
      luz(x, y, c) { topo.push([Math.round(x), Math.round(y), c]); },
      forma(x0, y0, x1, y1, dentro, c) {
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (dentro(x, y)) F.pt(x, y, cor(c, x, y));
      },
      ret(x, y, ww, hh, c) {
        for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) F.pt(x + i, y + j, cor(c, x + i, y + j, i, j));
      },
      elip(cx, cy, rx, ry, c) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x - cx) / rx, ny = (y - cy) / ry;
          if (nx * nx + ny * ny <= 1.0001) F.pt(x, y, cor(c, x, y, nx, ny));
        }
      },
      furo(cx, cy, rx, ry) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x - cx) / rx, ny = (y - cy) / ry;
          if (nx * nx + ny * ny <= 1.0001) F.apagar(x, y);
        }
      },
      // traço de largura l; a cor recebe (x, y, s) com s de −1 (lado da sombra) a 1 (lado da luz)
      lin(x0, y0, x1, y1, c, l = 1) {
        const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2), m = l / 2;
        let nx = -dy / L, ny = dx / L;
        if (nx + ny > 0 || (nx + ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
        for (let y = Math.floor(Math.min(y0, y1) - m); y <= Math.ceil(Math.max(y0, y1) + m); y++) {
          for (let x = Math.floor(Math.min(x0, x1) - m); x <= Math.ceil(Math.max(x0, x1) + m); x++) {
            const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L2));
            const px = x0 + dx * t, py = y0 + dy * t, ex = x - px, ey = y - py;
            if (ex * ex + ey * ey <= m * m + 0.02) F.pt(x, y, cor(c, x, y, (ex * nx + ey * ny) / m, t));
          }
        }
      },
      poli(pts, c) {
        let y0 = Infinity, y1 = -Infinity;
        for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
        for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) {
          const xs = [];
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
          }
          xs.sort((p, q) => p - q);
          for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.001); x <= Math.floor(xs[i + 1] + 0.001); x++) F.pt(x, y, cor(c, x, y));
        }
      },
      // arco em graus (0 = direita, 90 = baixo), largura de l0 a l1
      arco(cx, cy, r, a0, a1, c, l0 = 1, l1 = l0) {
        const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * RAD * r * 2));
        for (let i = 0; i <= n; i++) {
          const t = i / n, a = (a0 + (a1 - a0) * t) * RAD, l = l0 + (l1 - l0) * t;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (l <= 1.2) F.pt(x, y, cor(c, Math.round(x), Math.round(y), 0, t));
          else F.elip(x, y, l / 2, l / 2, (X, Y) => cor(c, X, Y, 0, t));
        }
      },
      brilho(cx, cy, r, c, forca = 0.5) {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const q = Math.hypot(x - cx, y - cy) / r;
          if (q < 1) F.mix(x, y, c, forca * (1 - q) * (1 - q) + (bayer(x, y) - 0.5) * 0.06);
        }
      },
      raio(x0, y0, x1, y1, c, a) {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let i = 0; i <= n; i++) F.mix(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a * (1 - (i / n) * 0.6));
      },
    };
    return F;
  }

  // Sombreadores
  const esf = (R, vies = 0) => (x, y, nx, ny) => {
    const l = -(nx * 0.55 + ny * 0.65) + vies + (bayer(x, y) - 0.5) * 0.14;
    return R[l > 0.5 ? 0 : l > -0.05 ? 1 : l > -0.55 ? 2 : 3];
  };
  const diag = (R, lx, ly, ex, ey, pont = 0.6) => {
    const dx = ex - lx, dy = ey - ly, L2 = dx * dx + dy * dy || 1;
    return (x, y) => {
      const t = ((x - lx) * dx + (y - ly) * dy) / L2;
      return R[Math.max(0, Math.min(R.length - 1, Math.floor(t * R.length + (bayer(x, y) - 0.5) * pont)))];
    };
  };
  const barra = (R) => (x, y, s) => R[s > 0.4 ? 0 : s > -0.45 ? 1 : 2];

  // Passa a figura para a Grade: fundo, sombra projetada, contorno de tinta, figura e luzes.
  function compor(g, b, f, o = {}) {
    const w = f.w, h = f.h, tinta = o.contorno === undefined ? TINTA : o.contorno;
    const cheio = (x, y) => !!f.ler(x, y);
    const borda = (x, y) => !cheio(x, y) && (cheio(x - 1, y) || cheio(x + 1, y) || cheio(x, y - 1) || cheio(x, y + 1));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = b ? b.ler(x, y) : null;
      const fc = f.ler(x, y);
      if (fc) c = fc;
      else if (tinta && borda(x, y)) c = b && !c && o.soDentro ? null : tinta;
      else if (c && o.sombra && (cheio(x - 1, y - 1) || borda(x - 1, y - 1))) c = misturar(c, "#000000", o.sombra);
      if (c) g.fino(x, y, c);
    }
    for (const [x, y, c] of f.topo) if (x >= 0 && y >= 0 && x < w && y < h) g.fino(x, y, c);
  }

  // -------------------------------------------------------------------
  // Formas reutilizadas
  // -------------------------------------------------------------------
  const FORMA_CHAMA = [[0.1, 1], [0.3, 0.72], [0.2, 0.6], [0.46, 0.36], [0.42, 0.12], [0.22, 0], [-0.22, 0], [-0.46, 0.14], [-0.44, 0.4], [-0.26, 0.62], [-0.2, 0.46], [-0.04, 0.74]];
  function chama(f, cx, base, alt, larg, R = ["#c8301c", "#f07a22", "#ffc840", "#fff6c0"]) {
    [1, 0.72, 0.46, 0.22].forEach((k, i) => {
      f.poli(FORMA_CHAMA.map(([u, v]) => [cx + u * larg * k, base - v * alt * k]), R[i]);
    });
  }
  function gota(f, cx, cy, r, ponta, R) {
    const sh = diag(R, cx - r * 0.7, ponta + (cy - ponta) * 0.4, cx + r * 0.8, cy + r);
    f.forma(cx - r, ponta, cx + r, cy + r, (x, y) => Math.hypot(x - cx, y - cy) <= r + 0.1 || (y < cy && y >= ponta && Math.abs(x - cx) <= ((y - ponta) / (cy - ponta)) * r * 0.92), sh);
    f.luz(cx - r * 0.45, cy - r * 0.2, R[0]); f.luz(cx - r * 0.45, cy - r * 0.2 + 1, R[0]); f.luz(cx - r * 0.45 + 1, cy - r * 0.2 - 1, "#ffffff");
  }
  function coracao(f, cx, cy, s, R) {
    const sh = diag(R, cx - s * 0.9, cy - s, cx + s * 0.9, cy + s * 1.1);
    f.forma(cx - s * 1.3, cy - s * 1.3, cx + s * 1.3, cy + s * 1.3, (px, py) => {
      const x = (px - cx) / s, y = -(py - cy) / s + 0.15, q = x * x + y * y - 1;
      return q * q * q - x * x * y * y * y <= 0;
    }, sh);
  }
  function pedraFig(f, cx, cy, rx, ry, R = PEDRA) {
    f.elip(cx, cy, rx, ry, esf(R));
    f.pt(cx - rx * 0.4, cy - ry * 0.45, "#ffffff");
  }
  function estrela4(f, cx, cy, r, c1, c2, topo) {
    const p = topo ? (x, y, c) => f.luz(x, y, c) : (x, y, c) => f.pt(x, y, c);
    for (let i = -r; i <= r; i++) { p(cx + i, cy, Math.abs(i) > r / 2 ? c2 : c1); p(cx, cy + i, Math.abs(i) > r / 2 ? c2 : c1); }
    if (r >= 3) { p(cx - 1, cy - 1, c2); p(cx + 1, cy - 1, c2); p(cx - 1, cy + 1, c2); p(cx + 1, cy + 1, c2); }
  }
  function folha(f, x, y, ang, comp, larg, R) {
    const c = Math.cos(ang * RAD), s = Math.sin(ang * RAD), nx = -s, ny = c;
    const pts = [[x, y], [x + c * comp * 0.45 + nx * larg, y + s * comp * 0.45 + ny * larg], [x + c * comp, y + s * comp], [x + c * comp * 0.45 - nx * larg, y + s * comp * 0.45 - ny * larg]];
    const cima = nx + ny < 0 ? 1 : -1;
    f.poli(pts, (X, Y) => (((X - x) * nx + (Y - y) * ny) * cima > 0.2 ? R[0] : ((X - x) * nx + (Y - y) * ny) * cima < -0.6 ? R[2] : R[1]));
  }
  function ovelhinha(f, cx, cy, k) {
    f.ret(Math.round(cx - 3 * k), Math.round(cy + 2 * k), Math.max(1, Math.round(1.4 * k)), Math.round(3.4 * k), ESCURO[1]);
    f.ret(Math.round(cx + 1.6 * k), Math.round(cy + 2 * k), Math.max(1, Math.round(1.4 * k)), Math.round(3.4 * k), ESCURO[1]);
    f.elip(cx, cy, 4.6 * k, 3.6 * k, esf(LA));
    f.elip(cx - 2.6 * k, cy - 2 * k, 2.2 * k, 1.9 * k, esf(LA, 0.2));
    f.elip(cx + 2.4 * k, cy - 2.2 * k, 2.3 * k, 1.9 * k, esf(LA, 0.2));
    f.elip(cx, cy - 2.8 * k, 2.4 * k, 1.8 * k, esf(LA, 0.3));
    f.elip(cx, cy + 0.6 * k, 2.1 * k, 2.3 * k, esf(ESCURO, 0.25));
    f.pt(cx - 2.6 * k, cy + 0.2 * k, ESCURO[1]); f.pt(cx + 2.6 * k, cy + 0.2 * k, ESCURO[1]);
    f.luz(cx - 1 * k, cy, "#f6efdc"); f.luz(cx + 1 * k, cy, "#f6efdc");
  }
  function espadaFig(f, px, py, tx, ty, l, k = 1) {
    // do pomo (px, py) à ponta (tx, ty)
    const dx = tx - px, dy = ty - py, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, vx = -uy, vy = ux;
    const cabo = 4.6 * k, gx = px + ux * cabo, gy = py + uy * cabo;
    f.lin(px + ux, py + uy, gx, gy, barra(MAD), l * 0.72);
    f.lin(gx + ux, gy + uy, tx - ux * l * 0.8, ty - uy * l * 0.8, barra(ACO), l);
    f.poli([[tx, ty], [tx - ux * l * 1.5 + vx * l * 0.5, ty - uy * l * 1.5 + vy * l * 0.5], [tx - ux * l * 1.5 - vx * l * 0.5, ty - uy * l * 1.5 - vy * l * 0.5]], ACO[0]);
    const m = l * 1.25;
    f.lin(gx - vx * m, gy - vy * m, gx + vx * m, gy + vy * m, barra(OURO), Math.max(1.4, l * 0.75));
    f.elip(px, py, l * 0.5, l * 0.5, esf(OURO));
  }

  // -------------------------------------------------------------------
  // Placa das habilidades (32 × 32) e selo dos ofícios (32 × 32)
  // -------------------------------------------------------------------
  const CAMPO = {
    guerreiro: ["#a8412e", "#822a24", "#5c1c1e", "#3c1216"],
    atirador: ["#3a8a94", "#28687a", "#1a485c", "#102e40"],
    sacerdote: ["#5068b8", "#384c96", "#263470", "#18204c"],
    profeta: ["#8a52ac", "#683a8a", "#482664", "#2e1644"],
    pastor: ["#5c9440", "#42742e", "#2c5424", "#1a381c"],
  };
  function placa(b, tint) {
    const R = 3.5, c = 15.5;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const qx = Math.max(Math.abs(x - c) - (c + 0.5 - R), 0), qy = Math.max(Math.abs(y - c) - (c + 0.5 - R), 0);
      let k;
      if (qx > 0 && qy > 0) k = R - Math.hypot(qx, qy);
      else k = Math.min(x, y, 31 - x, 31 - y) + 0.5;
      if (k <= 0) continue;
      const luz = x + y < 31;
      let cor;
      if (k < 1) cor = "#22130e";
      else if (k < 2) cor = luz ? BRONZE[0] : BRONZE[2];
      else if (k < 3) cor = luz ? BRONZE[1] : BRONZE[3];
      else if (k < 4) cor = luz ? "#180c0a" : "#2c1a14";
      else {
        const t = Math.hypot(x - 13, y - 12) / 19;
        cor = tint[Math.max(0, Math.min(3, Math.floor(t * 4 + (bayer(x, y) - 0.5) * 0.45)))];
      }
      b.pt(x, y, cor);
    }
    // rebites de canto
    for (const [x, y] of [[2, 2], [29, 2], [2, 29], [29, 29]]) b.pt(x, y, x + y < 31 ? "#fff0c0" : BRONZE[1]);
  }
  function selo(b) {
    const c = 15.5;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const r = Math.hypot(x - c, y - c);
      if (r > 15.6) continue;
      const luz = (x - c) + (y - c) < 0;
      let cor;
      if (r > 14.6) cor = "#22130e";
      else if (r > 13.5) cor = luz ? BRONZE[0] : BRONZE[2];
      else if (r > 12.4) cor = luz ? BRONZE[1] : BRONZE[3];
      else if (r > 11.4) cor = luz ? "#3a2416" : "#5a3c22";
      else {
        const t = Math.hypot(x - 12, y - 11) / 17;
        cor = ["#fbf0d0", "#f0deb0", "#e0c890", "#c8ac74"][Math.max(0, Math.min(3, Math.floor(t * 4 + (bayer(x, y) - 0.5) * 0.45)))];
      }
      b.pt(x, y, cor);
    }
    // pontinhos gravados no aro (cima, baixo, lados)
    for (const [x, y] of [[15, 2], [16, 2], [15, 29], [16, 29], [2, 15], [2, 16], [29, 15], [29, 16]]) b.pt(x, y, x + y < 31 ? "#fff0c0" : BRONZE[1]);
  }

  // -------------------------------------------------------------------
  // Habilidades: [vocação do campo, desenho(f, b)]
  // -------------------------------------------------------------------
  const CREME = "#fff0c8";
  const HB = {
    espada: ["guerreiro", (f, b) => {
      for (let a = 195; a <= 285; a += 2) { const t = (a - 195) / 90; b.mix(15 + Math.cos(a * RAD) * 12, 19 + Math.sin(a * RAD) * 12, CREME, 0.15 + t * 0.6); b.mix(15 + Math.cos(a * RAD) * 11, 19 + Math.sin(a * RAD) * 11, CREME, t * 0.4); }
      espadaFig(f, 7, 25, 26, 6, 3.4);
    }],
    escudo: ["guerreiro", (f) => {
      f.elip(16, 16, 10, 10, esf(BRONZE));
      f.elip(16, 16, 8, 8, esf(MAD));
      for (const x of [12, 16, 20]) for (let y = 9; y <= 23; y++) if (Math.hypot(x - 16, y - 16) < 7.6) f.pt(x, y, MAD[2]);
      f.elip(16, 16, 3.2, 3.2, esf(OURO));
      f.pt(15, 15, "#ffffff");
      for (const a of [45, 135, 225, 315]) f.pt(16 + Math.cos(a * RAD) * 9, 16 + Math.sin(a * RAD) * 9, a > 180 ? "#fff0c0" : BRONZE[3]);
    }],
    grito: ["guerreiro", (f) => {
      // cabeça de perfil, boca aberta, e as ondas do brado
      f.elip(11, 16, 5.5, 6.5, esf(PELE));
      f.poli([[5, 13], [8, 8], [14, 8], [17, 12], [16, 13], [6, 14]], diag(VERM, 6, 8, 16, 14));
      f.ret(5, 13, 12, 1, OURO[1]);
      f.poli([[5, 19], [7, 25], [12, 25], [13, 22], [9, 20]], diag(ESCURO, 5, 19, 12, 25));
      f.poli([[13, 17], [17, 16], [17, 20], [13, 20]], "#3a1010");
      f.pt(16, 16, LA[0]); f.pt(15, 16, LA[0]);
      f.pt(13, 14, TINTA); f.pt(14, 14, TINTA);
      f.pt(17, 15, PELE[2]);
      f.arco(14, 18, 8, -38, 38, CREME, 1.6);
      f.arco(14, 18, 12, -32, 32, "#ffd870", 1.6);
    }],
    escudo_golpe: ["guerreiro", (f, b) => {
      b.brilho(23, 9, 8, "#ffe890", 0.7);
      f.elip(13, 18, 8.5, 8.5, esf(BRONZE));
      f.elip(13, 18, 6.5, 6.5, esf(MAD));
      f.elip(13, 18, 2.6, 2.6, esf(OURO));
      for (const [dx, dy, n] of [[1, 0, 4], [0, -1, 4], [1, -1, 3], [-1, -1, 2], [1, 1, 2], [-1, 0, 2], [0, 1, 2]]) for (let i = 1; i <= n; i++) f.pt(23 + dx * i, 9 + dy * i, i > n - 1 ? "#ffb030" : "#ffe890");
      f.pt(23, 9, "#ffffff");
      f.luz(23, 9, "#ffffff"); f.luz(24, 8, "#fff8d0");
    }],
    investida: ["guerreiro", (f, b) => {
      for (const [y, x0, x1] of [[9, 5, 14], [13, 4, 10], [22, 5, 12], [25, 8, 17]]) for (let x = x0; x <= x1; x++) b.mix(x, y, CREME, 0.25 + ((x - x0) / (x1 - x0)) * 0.55);
      f.lin(6, 20, 20, 14, barra(MAD), 2.2);
      f.poli([[18, 10], [27, 11], [21, 18]], diag(ACO, 19, 10, 24, 17));
      f.lin(19, 13.5, 26, 11.3, ACO[0], 1);
      f.lin(16.4, 12.6, 18.6, 17.6, barra(OURO), 1.8);
    }],
    redemoinho: ["guerreiro", (f, b) => {
      // a espada no meio do giro, com os dois rastros do corte em volta
      b.brilho(16, 16, 11, "#ffd8a0", 0.3);
      for (const a0 of [150, 330]) {
        for (let i = 0; i <= 70; i++) {
          const t = i / 70, a = (a0 + 125 * t) * RAD, l = 0.8 + 3.4 * t * t;
          f.elip(16 + Math.cos(a) * 9.6, 16 + Math.sin(a) * 9.6, l / 2, l / 2, t > 0.8 ? "#ffffff" : t > 0.45 ? CREME : "#e8b070");
        }
      }
      espadaFig(f, 11, 21, 21.5, 10.5, 2.8, 0.8);
    }],
    coracao: ["guerreiro", (f, b) => {
      b.brilho(16, 16, 12, "#ffb0a0", 0.35);
      coracao(f, 16, 16, 8.6, VERM);
      f.pt(11, 11, VERM[0]); f.pt(12, 10, VERM[0]); f.pt(11, 12, VERM[0]); f.pt(12, 11, "#ffffff");
    }],
    chama: ["guerreiro", (f, b) => {
      b.brilho(16, 18, 12, "#ffb040", 0.45);
      chama(f, 16, 26, 20, 16);
      f.luz(8, 9, "#ffd848"); f.luz(24, 12, "#ffb040"); f.luz(23, 6, "#ffe890");
    }],
    muralha: ["guerreiro", (f) => {
      const dentro = (x, y) => x >= 6 && x <= 25 && ((y >= 12 && y <= 25) || (y >= 8 && y < 12 && ((x - 6) % 8) < 4));
      f.forma(6, 8, 25, 25, dentro, (x, y) => {
        const yy = y - 8, lin = Math.floor(yy / 4) + 1, ry = yy % 4, rx = (x - 6 + (lin % 2 ? 3 : 0)) % 6;
        if (yy >= 4 && (ry === 3 || rx === 5)) return PEDRA[3];
        if (yy < 4) return ry === 0 ? PEDRA[0] : (x - 6) % 8 === 3 ? PEDRA[2] : PEDRA[1];
        return ry === 0 ? PEDRA[0] : ry === 2 || rx === 4 ? PEDRA[2] : PEDRA[1];
      });
    }],
    pedra: ["atirador", (f, b) => {
      for (const [x0, y0, x1, y1] of [[5, 22, 13, 15], [7, 26, 16, 18], [11, 27, 18, 21]]) b.raio(x1, y1, x0, y0, CREME, 0.8);
      pedraFig(f, 19, 13, 6.2, 5.4);
      f.pt(21, 14, PEDRA[2]); f.pt(22, 13, PEDRA[2]); f.pt(17, 16, PEDRA[3]);
    }],
    testa: ["atirador", (f, b) => {
      b.brilho(16, 11, 8, "#ffe890", 0.5);
      f.elip(16, 19, 6.6, 7, esf(PELE));
      f.poli([[8, 16], [9, 10], [13, 7], [19, 7], [23, 10], [24, 16], [21, 15], [16, 14], [11, 15]], diag(BRONZE, 9, 7, 23, 16));
      f.ret(15, 4, 2, 4, VERM[1]); f.pt(15, 4, VERM[0]);
      f.ret(15, 14, 2, 5, BRONZE[2]);
      for (const x of [12, 19]) { f.pt(x, 18, TINTA); f.pt(x + 1, 19, TINTA); f.pt(x + 1, 18, PELE[2]); f.pt(x, 19, PELE[2]); f.pt(x + 1, 17, TINTA); f.pt(x - 1, 19, TINTA); }
      f.ret(14, 23, 5, 1, "#5a2a22");
      // a pedra e o estalo do impacto
      estrela4(f, 16, 11, 4, "#ffffff", "#ffd848", true);
      f.luz(16, 11, PEDRA[2]); f.luz(15, 11, PEDRA[1]); f.luz(16, 10, PEDRA[0]); f.luz(15, 10, PEDRA[0]);
    }],
    salto: ["atirador", (f) => {
      // o salto para trás: poeira no ponto de partida e a seta em arco
      f.elip(25, 25.4, 2, 1.3, esf(AREIA)); f.pt(27, 22, AREIA[1]); f.pt(22, 26, AREIA[2]);
      f.arco(17, 23, 8.4, 335, 222, LA[2], 1.6, 3);
      f.arco(16.8, 22.6, 8.4, 335, 222, LA[1], 1.2, 2.4);
      f.arco(16.6, 22.2, 8.4, 325, 225, LA[0], 1, 1);
      f.poli([[14.4, 22], [5, 17.6], [7.4, 26.4]], (x, y) => (x + y * 0.6 < 21 ? LA[0] : x + y * 0.6 < 25 ? LA[1] : LA[2]));
    }],
    chuva: ["atirador", (f, b) => {
      for (const [x, y, r] of [[10, 11, 3.2], [20, 9, 2.8], [15, 19, 3.4], [23, 21, 2.8], [8, 23, 2.6]]) {
        b.raio(x + 2, y - 3, x + 6, y - 9, CREME, 0.75);
        b.raio(x + 3, y - 2, x + 7, y - 8, CREME, 0.4);
        pedraFig(f, x, y, r, r * 0.9);
      }
    }],
    pedra_afiada: ["atirador", (f) => {
      // lasca de sílex: duas faces, gume lascado, ponta para cima e o sangue do corte
      const lado = (x, y) => (x - 24) * 21 + (y - 5) * 14; // > 0 à direita da aresta ponta-base
      f.poli([[8, 26], [6, 19], [11, 11], [18, 6], [24, 5], [23, 11], [18, 20], [12, 26]], (x, y) => {
        const d = lado(x, y) / 25.2;
        if (d > 0) return d > 2.4 && (x + y * 2) % 5 === 0 ? PEDRA[3] : PEDRA[2];
        return d > -1 ? PEDRA[0] : d < -3.6 && (x * 2 + y) % 7 < 2 ? PEDRA[2] : PEDRA[1];
      });
      for (const [x, y] of [[22, 12], [20, 16], [17, 21], [14, 24]]) { f.pt(x, y, PEDRA[3]); f.pt(x - 1, y, PEDRA[3]); }
      f.pt(9, 24, PEDRA[3]); f.pt(10, 25, PEDRA[3]); f.pt(8, 19, PEDRA[0]); f.pt(10, 15, PEDRA[0]); f.pt(13, 11, PEDRA[0]);
      estrela4(f, 23, 6, 2, "#ffffff", "#fff0c0", true);
      f.elip(23, 21, 1.6, 2, esf(VERM)); f.pt(23, 18, VERM[1]);
      f.elip(25, 25.6, 1.1, 1.3, VERM[1]);
    }],
    duas_pedras: ["atirador", (f, b) => {
      for (let a = 200; a <= 300; a += 2) b.mix(13 + Math.cos(a * RAD) * 9, 20 + Math.sin(a * RAD) * 9, CREME, ((a - 200) / 100) * 0.7);
      for (let a = 20; a <= 120; a += 2) b.mix(19 + Math.cos(a * RAD) * 9, 12 + Math.sin(a * RAD) * 9, CREME, ((a - 20) / 100) * 0.7);
      pedraFig(f, 21, 12, 5, 4.4);
      pedraFig(f, 11, 20, 5, 4.4);
      f.pt(23, 13, PEDRA[2]); f.pt(13, 21, PEDRA[2]);
    }],
    olho: ["atirador", (f, b) => {
      b.brilho(16, 16, 12, "#ffe890", 0.3);
      f.forma(5, 9, 27, 23, (x, y) => Math.abs(y - 16.5) <= 6.2 * (1 - Math.pow(Math.abs(x - 16) / 10.5, 2)), (x, y) => (y < 13 ? LA[2] : y > 20 ? LA[1] : LA[0]));
      f.elip(16, 16.5, 4.6, 4.8, esf(["#a8f0e8", "#38b8b0", "#1e7c84", "#104a58"]));
      f.elip(16, 16.5, 2, 2.2, "#0c1418");
      f.luz(14, 14, "#ffffff"); f.luz(15, 14, "#ffffff"); f.luz(14, 15, "#ffffff");
      for (const [x0, y0, x1, y1] of [[16, 5, 16, 7], [10, 6, 11, 8], [22, 6, 21, 8], [6, 9, 7, 10], [26, 9, 25, 10]]) f.lin(x0, y0, x1, y1, OURO[1], 1);
    }],
    pedra_grande: ["atirador", (f) => {
      f.elip(12, 13, 6, 5, esf(PEDRA, 0.15));
      f.elip(21, 14, 5, 5, esf(PEDRA));
      f.elip(16, 18, 9.5, 7.5, esf(PEDRA));
      f.elip(12, 13, 5, 4, esf(PEDRA, 0.25));
      f.lin(15, 11, 17, 16, PEDRA[3], 1); f.lin(17, 16, 15, 21, PEDRA[3], 1); f.lin(17, 16, 22, 18, PEDRA[3], 1);
      f.pt(16, 12, PEDRA[0]); f.pt(18, 16, PEDRA[0]);
      f.pt(9, 11, "#ffffff"); f.pt(10, 10, "#ffffff");
      f.pt(9, 22, PEDRA[3]); f.pt(22, 23, PEDRA[3]); f.pt(12, 20, PEDRA[2]);
    }],
    cura: ["sacerdote", (f, b) => {
      // ramo de oliveira que reverdece
      b.brilho(16, 16, 12, "#b0ff90", 0.4);
      f.lin(9, 26, 22, 8, barra(MAD), 1.6);
      for (const [x, y, a, c] of [[11, 23, 200, 6], [13, 20, -20, 6.5], [14, 18, 215, 6.5], [17, 15, -30, 6.5], [17, 13, 225, 6], [20, 10, -40, 5.5], [22, 8, 300, 5]]) folha(f, x, y, a, c, 2, VERDE);
      f.elip(14, 24, 1.4, 1.6, esf(["#b890d8", "#6a4a8c", "#40285c", "#281638"]));
      estrela4(f, 24, 20, 2, "#ffffff", "#c8ffa0", true);
      estrela4(f, 8, 10, 1, "#ffffff", "#c8ffa0", true);
      f.luz(25, 13, "#c8ffa0"); f.luz(7, 17, "#c8ffa0");
    }],
    candelabro: ["sacerdote", (f, b) => {
      b.brilho(16, 8, 13, "#ffe070", 0.55);
      f.poli([[10, 26], [22, 26], [19, 23], [13, 23]], diag(OURO, 11, 23, 21, 27, 0));
      f.lin(16, 23, 16, 9, barra(OURO), 2);
      for (const r of [3, 6, 9]) {
        f.arco(16, 13, r, 0, 180, (x, y) => (x < 16 ? OURO[1] : OURO[2]), 1.5);
        f.lin(16 - r, 13, 16 - r, 10, OURO[1], 1.2); f.lin(16 + r, 13, 16 + r, 10, OURO[2], 1.2);
      }
      for (let x = 7; x <= 25; x += 3) {
        f.pt(x, 9, OURO[0]);
        f.luz(x, 8, "#ffb030"); f.luz(x, 7, "#ffe070"); f.luz(x, 6, "#fff8d0");
      }
      f.pt(16, 20, OURO[0]); f.pt(15, 16, OURO[0]);
    }],
    incenso: ["sacerdote", (f, b) => {
      b.brilho(16, 17, 7, "#ff9040", 0.35);
      // fio de fumaça que sobe ondulando e afina, com um tufo solto no alto
      const P = (t) => [16 + Math.sin(t * 7.6) * (1.6 + t * 2.2), 15.5 - t * 9.5];
      for (let i = 0; i <= 60; i++) { const t = i / 60, [x, y] = P(t), r = 1.25 - t * 0.45; f.elip(x, y, r, r, LA[2]); }
      for (let i = 0; i <= 60; i++) { const t = i / 60, [x, y] = P(t); f.pt(x - 0.5, y - 0.3, LA[0]); }
      f.elip(21.4, 6, 1.5, 1.2, esf(LA, 0.2)); f.pt(11, 8, LA[1]); f.pt(12, 7, LA[0]);
      f.forma(8, 18, 24, 26, (x, y) => y >= 18 && Math.pow((x - 16) / 7.5, 2) + Math.pow((y - 18) / 6.5, 2) <= 1, diag(BRONZE, 9, 17, 22, 26));
      f.ret(8, 17, 17, 2, (x, y) => (y === 17 ? OURO[0] : OURO[2]));
      f.ret(13, 25, 7, 2, (x, y) => (y === 25 ? BRONZE[1] : BRONZE[3]));
      for (const x of [11, 14, 17, 20]) { f.pt(x, 16, "#ff7030"); f.luz(x, 16, x % 2 ? "#ffd060" : "#ff7030"); }
      f.ret(10, 21, 13, 1, BRONZE[3]);
    }],
    agua: ["sacerdote", (f, b) => {
      b.brilho(16, 17, 12, "#a0f0ff", 0.35);
      gota(f, 16, 18, 7.4, 5, AGUA);
      f.luz(12, 16, "#ffffff"); f.luz(12, 17, "#ffffff"); f.luz(13, 14, "#ffffff"); f.luz(12, 18, AGUA[0]);
      f.luz(24, 8, "#e0fafa"); f.luz(7, 9, "#e0fafa"); f.luz(25, 9, AGUA[1]);
    }],
    trombeta: ["sacerdote", (f, b) => {
      // shofar: chifre de carneiro, bocal embaixo à esquerda e a boca larga virada para cima
      const P = [[5, 13], [7, 27], [23, 27], [24, 9]];
      const bz = (t, k) => { const u = 1 - t; return u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]; };
      for (const [dx, dy, c, l0, l1] of [[0, 0, CHIFRE[2], 2, 7], [-0.5, -0.5, CHIFRE[1], 1, 5], [-1.2, -1, CHIFRE[0], 0.6, 2]]) {
        for (let i = 0; i <= 60; i++) { const t = i / 60, l = l0 + (l1 - l0) * t * t; f.elip(bz(t, 0) + dx * (0.4 + t), bz(t, 1) + dy * (0.4 + t), l / 2, l / 2, c); }
      }
      f.elip(24, 9, 3, 1.4, CHIFRE[3]);
      f.pt(22, 9, CHIFRE[0]); f.pt(21, 9, CHIFRE[0]);
      for (const t of [0.3, 0.5, 0.68]) { const x = bz(t, 0), y = bz(t, 1); f.pt(x + 1, y + 1, CHIFRE[3]); f.pt(x, y + 1.6, CHIFRE[3]); }
      for (const [x0, y0, x1, y1] of [[24, 6, 24, 4], [20, 6, 18, 4], [27, 7, 28, 5]]) b.raio(x0, y0, x1, y1, CREME, 0.95);
    }],
    escudo_luz: ["sacerdote", (f, b) => {
      b.brilho(16, 16, 14, "#fff0a0", 0.6);
      for (let a = 0; a < 360; a += 30) b.raio(16 + Math.cos(a * RAD) * 8, 16 + Math.sin(a * RAD) * 8, 16 + Math.cos(a * RAD) * 13, 16 + Math.sin(a * RAD) * 13, "#fff8d0", 0.7);
      f.poli([[8, 7], [24, 7], [24, 15], [21, 21], [16, 25], [11, 21], [8, 15]], diag(OURO, 8, 7, 24, 24, 0));
      f.poli([[10, 9], [22, 9], [22, 15], [19.6, 20], [16, 23], [12.4, 20], [10, 15]], diag(LUZ, 10, 8, 23, 23));
      estrela4(f, 16, 15, 4, OURO[1], OURO[2]);
      f.pt(16, 15, "#ffffff");
    }],
    maos: ["sacerdote", (f, b) => {
      b.brilho(16, 9, 9, "#fff0a0", 0.7);
      for (const s of [-1, 1]) {
        const cx = 16 + s * 6.5;
        f.ret(Math.round(cx - 3), 23, 7, 4, (x, y) => (y === 23 ? LA[0] : x - cx < 0 ? LA[1] : LA[2]));
        f.elip(cx, 19, 3.4, 4, esf(PELE));
        [[-2.6, 8.6, -0.5], [-0.9, 7, -0.15], [0.9, 7.4, 0.15], [2.6, 9, 0.5]].forEach(([dx, y1, inc]) => f.lin(cx + dx, 17, cx + dx + inc, y1 + 2, barra(PELE), 1.5));
        f.lin(cx - s * 3, 19, cx - s * 5.4, 15.5, barra(PELE), 1.6);
      }
      estrela4(f, 16, 8, 3, "#ffffff", "#ffe890", true);
    }],
    altar: ["sacerdote", (f, b) => {
      b.brilho(16, 9, 9, "#ffb040", 0.5);
      chama(f, 16, 14, 10, 10);
      f.ret(8, 15, 16, 10, (x, y) => ((y - 15) % 4 === 3 || (x - 8 + (Math.floor((y - 15) / 4) % 2 ? 3 : 0)) % 6 === 5 ? PEDRA[3] : (y - 15) % 4 === 0 ? PEDRA[0] : x > 20 ? PEDRA[2] : PEDRA[1]));
      f.ret(7, 13, 18, 2, (x, y) => (y === 13 ? PEDRA[0] : PEDRA[1]));
      f.ret(7, 25, 18, 2, (x, y) => (y === 25 ? PEDRA[1] : PEDRA[2]));
      f.poli([[6, 13], [6, 9], [9, 13]], PEDRA[0]);
      f.poli([[25, 13], [25, 9], [22, 13]], PEDRA[1]);
    }],
    harpa: ["sacerdote", (f) => {
      // kinnor: caixa embaixo, dois braços e a travessa
      f.lin(9, 22, 8, 8, barra(MAD), 2.4);
      f.lin(23, 22, 24, 10, barra(MAD), 2.4);
      f.lin(6, 7, 26, 9.5, barra(OURO), 2);
      f.poli([[7, 20], [25, 20], [22, 26], [10, 26]], diag(MAD, 8, 19, 23, 27));
      f.ret(8, 20, 16, 1, MAD[0]);
      f.elip(16, 23, 1.6, 1.4, MAD[3]);
      for (let i = 0; i < 5; i++) { const x = 11 + i * 2.5; for (let y = 9 + Math.round(i * 0.3); y <= 19; y++) f.luz(x, y, i % 2 ? "#fff8e0" : "#e8d8b0"); }
      f.pt(6, 7, OURO[0]); f.pt(26, 9, OURO[0]);
    }],
    nuvem: ["profeta", (f, b) => {
      // coluna de nuvem: pé largo no chão, corpo em tufos e topo aberto
      const NUV = ["#ffffff", "#dde8f6", "#a2b4d4", "#64749c"];
      b.brilho(16, 13, 13, "#ffffff", 0.22);
      f.elip(16, 25, 7.4, 2.2, esf(NUV, -0.3));
      f.elip(11, 24, 3, 2, esf(NUV, -0.1)); f.elip(21, 24.4, 2.8, 1.8, esf(NUV, -0.3));
      f.elip(16, 21, 4.4, 3.2, esf(NUV, -0.15));
      f.elip(14.4, 17.4, 4.4, 3.2, esf(NUV, -0.05));
      f.elip(17.6, 14, 4.8, 3.4, esf(NUV));
      f.elip(13.6, 11, 5.2, 3.6, esf(NUV, 0.08));
      f.elip(19.4, 9, 5, 3.6, esf(NUV, 0.1));
      f.elip(14, 7.4, 4.6, 3, esf(NUV, 0.2));
      for (const [x, y] of [[13, 19], [18, 17], [12, 13], [20, 12], [16, 10]]) { f.pt(x, y, NUV[2]); f.pt(x + 1, y, NUV[2]); }
    }],
    gota: ["profeta", (f, b) => {
      b.brilho(16, 18, 11, "#b0ff60", 0.3);
      gota(f, 16, 18, 6.6, 6, VERDE);
      f.elip(8, 11, 1.5, 1.5, esf(VERDE)); f.elip(24, 13, 1.2, 1.2, VERDE[1]); f.elip(23, 25, 1.2, 1.2, VERDE[2]);
      f.pt(15, 21, VERDE[3]); f.pt(18, 19, VERDE[3]); f.pt(17, 22, VERDE[3]);
      for (const [x, y] of [[24, 6], [7, 22]]) { f.luz(x, y, "#141410"); f.luz(x + 1, y, "#141410"); f.luz(x - 1, y - 1, "#e8f0d8"); f.luz(x + 2, y - 1, "#e8f0d8"); }
    }],
    raio: ["profeta", (f, b) => {
      b.brilho(16, 10, 13, "#ffe070", 0.5);
      f.poli([[18, 4], [9, 16], [14.5, 16], [10, 27], [23, 12.5], [17.5, 12.5], [22, 4]], diag(FOGO, 16, 4, 14, 27, 0.5));
      f.lin(19, 5, 12, 15, "#ffffff", 1);
      f.luz(7, 26, "#ff9a28"); f.luz(13, 28, "#ffd848"); f.luz(6, 24, "#ffd848"); f.luz(14, 26, "#ff9a28");
    }],
    balanca: ["profeta", (f) => {
      f.poli([[11, 26], [21, 26], [19, 24], [13, 24]], diag(OURO, 12, 24, 20, 27, 0));
      f.lin(16, 24, 16, 8, barra(OURO), 2);
      f.lin(8, 10, 24, 10, barra(OURO), 1.8);
      f.elip(16, 7, 1.8, 1.8, esf(OURO));
      for (const cx of [8, 24]) {
        f.lin(cx, 10, cx - 3, 17, OURO[2], 1); f.lin(cx, 10, cx + 3, 17, OURO[2], 1);
        f.forma(cx - 4, 17, cx + 4, 21, (x, y) => y >= 17 && Math.pow((x - cx) / 4.2, 2) + Math.pow((y - 17) / 3.4, 2) <= 1, (x, y) => (y === 17 ? OURO[0] : x < cx ? OURO[1] : OURO[2]));
      }
    }],
    onda: ["profeta", (f) => {
      // o mar aberto: duas muralhas de água e o caminho seco
      f.poli([[11, 27], [20, 27], [17.4, 12], [14.6, 12]], diag(AREIA, 13, 12, 20, 30));
      for (const s of [1, -1]) {
        const X = (x) => (s > 0 ? x : 31 - x);
        const pts = [[4, 27], [4, 11], [7, 7], [11, 6], [14, 9], [14, 13], [12, 11], [10, 12], [11, 17], [13, 27]].map(([x, y]) => [X(x), y]);
        f.poli(pts, diag(AGUA, X(5), 8, X(13), 26));
        for (const [x, y] of [[5, 10], [6, 8], [7, 7], [8, 6], [9, 6], [10, 6], [11, 6], [12, 7], [13, 8], [14, 9], [14, 10], [13, 11], [12, 11]]) f.pt(X(x), y, "#ffffff");
        for (const [x, y] of [[7, 14], [8, 19], [6, 22], [10, 23], [9, 15]]) f.pt(X(x), y, AGUA[0]);
      }
    }],
    carro: ["profeta", (f, b) => {
      b.brilho(13, 13, 13, "#ffb040", 0.5);
      chama(f, 9, 22, 15, 10);
      chama(f, 16, 13, 9, 8);
      chama(f, 23, 12, 7, 6);
      f.elip(18, 19, 7.6, 7.6, esf(OURO));
      f.furo(18, 19, 5.4, 5.4);
      for (const a of [0, 60, 120]) f.lin(18 - Math.cos(a * RAD) * 6, 19 - Math.sin(a * RAD) * 6, 18 + Math.cos(a * RAD) * 6, 19 + Math.sin(a * RAD) * 6, OURO[1], 1);
      f.elip(18, 19, 1.8, 1.8, esf(OURO));
    }],
    cao: ["pastor", (f) => {
      f.poli([[8, 4], [13, 9], [8, 14]], diag(PELO, 8, 5, 13, 13));
      f.poli([[23, 4], [18, 9], [23, 14]], diag(PELO.slice(1).concat(PELO[3]), 18, 5, 24, 13));
      f.pt(9, 8, VERM[0]); f.pt(9, 9, VERM[0]); f.pt(22, 8, VERM[2]); f.pt(22, 9, VERM[2]);
      f.elip(15.5, 15.5, 7.6, 7.2, esf(PELO));
      f.elip(15.5, 20.5, 4.4, 4, esf(LA));
      f.elip(15.5, 18.6, 1.8, 1.4, "#201410");
      f.pt(15, 18, "#6a5a50");
      f.ret(15, 20, 1, 2, LA[3]); f.pt(14, 22, LA[3]); f.pt(16, 22, LA[3]); f.pt(13, 21, LA[3]); f.pt(17, 21, LA[3]);
      f.ret(15, 23, 2, 2, VERM[0]);
      for (const x of [12, 19]) { f.ret(x - 1, 14, 2, 2, "#201410"); f.luz(x - 1, 14, "#ffffff"); f.pt(x - 1, 12, PELO[2]); f.pt(x, 12, PELO[2]); }
    }],
    cajado: ["pastor", (f, b) => {
      const R = ["#f6d49a", "#cc9452", "#8e5c30", "#4e2e1c"];
      b.brilho(16, 14, 12, "#f0ffb0", 0.32);
      f.lin(10, 27, 13.6, 12, barra(R), 3.2);
      f.arco(18.6, 11.4, 5, 172, 395, R[1], 3.2, 2.4);
      f.arco(18.2, 10.9, 5, 185, 330, R[0], 1.2, 1);
      f.arco(19.2, 11.9, 5, 330, 395, R[2], 1.2, 1);
      f.pt(11, 23, R[3]); f.pt(12, 19, R[3]); f.pt(12, 24, R[2]);
      f.ret(10, 20, 4, 1, OURO[1]); f.ret(10, 21, 4, 1, OURO[2]);
    }],
    ovelha: ["pastor", (f) => {
      f.ret(9, 21, 2, 5, ESCURO[1]); f.ret(12, 22, 2, 4, ESCURO[2]); f.ret(17, 22, 2, 4, ESCURO[2]); f.ret(19, 21, 2, 5, ESCURO[1]);
      f.elip(14, 17, 7.6, 5.4, esf(LA));
      for (const [x, y, r] of [[9, 14, 3.4], [13, 12, 3.6], [18, 12.5, 3.6], [8, 18, 3], [20, 17, 3.2], [14, 15, 3.4]]) f.elip(x, y, r, r * 0.88, esf(LA, 0.12));
      f.elip(23.5, 13.5, 3.2, 3.6, esf(ESCURO, 0.2));
      f.poli([[20, 11], [22, 10], [22, 13]], ESCURO[1]);
      f.luz(24, 13, "#f6efdc"); f.pt(25, 16, "#0c0806");
    }],
    presa: ["pastor", (f) => {
      f.elip(16, 16, 10, 9.4, diag(["#8a2024", "#5e161a", "#3a0c12", "#240810"], 16, 8, 16, 26, 0.5));
      f.forma(6, 6, 26, 11, (x, y) => y <= 10 && Math.pow((x - 16) / 10, 2) + Math.pow((y - 16) / 9.4, 2) <= 1, diag(VERM, 8, 6, 22, 12));
      f.forma(7, 22, 25, 26, (x, y) => y >= 22 && Math.pow((x - 16) / 10, 2) + Math.pow((y - 16) / 9.4, 2) <= 1, diag(VERM.slice(1).concat(VERM[3]), 8, 21, 22, 27));
      const dente = (x, y0, w, h, cima) => f.poli(cima ? [[x - w, y0], [x + w, y0], [x, y0 + h]] : [[x - w, y0], [x + w, y0], [x, y0 - h]], (X) => (X < x ? LA[0] : LA[2]));
      dente(10, 10, 2.2, 8, true); dente(22, 10, 2.2, 8, true);
      dente(14, 10, 1.4, 3.4, true); dente(18, 10, 1.4, 3.4, true);
      dente(12.5, 23, 1.8, 6, false); dente(19.5, 23, 1.8, 6, false);
      dente(16, 23, 1.4, 3, false);
    }],
    rebanho: ["pastor", (f) => {
      ovelhinha(f, 10, 12, 1);
      ovelhinha(f, 22, 12, 1);
      ovelhinha(f, 16, 20, 1.25);
    }],
    vara: ["pastor", (f) => {
      f.lin(9, 26, 23, 8, barra(MAD), 2.8);
      f.elip(23.6, 7.4, 2.6, 2.6, esf(MAD));
      f.ret(21, 9, 1, 1, OURO[1]);
      f.lin(23, 26, 11, 11, barra(BARRO), 2.4);
      f.arco(12.8, 8.2, 3.4, 122, 380, BARRO[1], 2.4, 1.8);
      f.arco(12.5, 7.9, 3.4, 150, 300, BARRO[0], 1, 1);
    }],
    aprisco: ["pastor", (f) => {
      ovelhinha(f, 16, 11, 1);
      f.ret(6, 14, 20, 2, (x, y) => (y === 14 ? MAD[0] : MAD[2]));
      f.ret(6, 20, 20, 2, (x, y) => (y === 20 ? MAD[0] : MAD[2]));
      for (const x of [6, 12, 19, 24]) {
        f.ret(x, 11, 2, 15, (X) => (X === x ? MAD[0] : MAD[1]));
        f.pt(x, 10, MAD[0]); f.pt(x + 1, 10, MAD[1]);
        f.pt(x + 1, 15, MAD[3]); f.pt(x + 1, 21, MAD[3]);
      }
      for (const x of [8, 10, 15, 17, 22]) { f.pt(x, 26, VERDE[1]); f.pt(x, 25, VERDE[0]); f.pt(x + 1, 26, VERDE[2]); }
    }],
  };

  // -------------------------------------------------------------------
  // Ofícios
  // -------------------------------------------------------------------
  const PEIXE = ["#e8f4f0", "#8cc8cc", "#4a8ca0", "#2a5670"];
  const OF = {
    pescador(f) {
      f.poli([[6, 13], [11, 18], [6, 23], [8, 18]], diag(PEIXE.slice(1).concat(PEIXE[3]), 5, 13, 9, 23));
      f.forma(7, 12, 25, 24, (x, y) => Math.abs(y - 18) <= 5 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 16) / 8.6, 2))), (x, y) => (y < 15 ? PEIXE[2] : y < 18 ? PEIXE[1] : y < 21 ? PEIXE[0] : LA[1]));
      f.poli([[13, 13], [18, 10], [19, 14]], PEIXE[3]);
      for (const [x, y] of [[12, 16], [14, 18], [12, 20], [16, 16], [16, 20], [10, 18], [18, 18]]) f.pt(x, y, PEIXE[2]);
      f.pt(21, 16, "#101418"); f.pt(21, 17, "#101418"); f.pt(22, 16, "#ffffff");
      f.lin(19, 15, 19, 21, PEIXE[2], 1);
      for (let y = 5; y <= 11; y++) f.pt(22, y, "#5a3c22");
      f.arco(23.6, 11.4, 1.6, 180, 20, ACO[3], 1);
    },
    ferreiro(f, b) {
      b.brilho(14, 15, 5, "#ffb040", 0.7);
      f.poli([[9, 17], [4.5, 18], [9, 20]], ESCURO[1]);
      f.ret(9, 16, 15, 4, (x, y) => (y === 16 ? ACO[1] : y === 17 ? ACO[2] : ESCURO[0]));
      f.ret(13, 20, 7, 3, (x) => (x < 15 ? ESCURO[0] : ESCURO[1]));
      f.ret(10, 23, 13, 3, (x, y) => (y === 23 ? ESCURO[0] : ESCURO[2]));
      f.lin(12, 14, 19, 9, barra(MAD), 2);
      f.lin(17.6, 5.6, 22, 10.6, barra(["#c8d2da", "#7a8894", "#465260"]), 5);
      f.pt(21, 5, "#ffffff"); f.pt(22, 6, "#e4ecf0");
      f.luz(11, 14, "#ffe070"); f.luz(15, 12, "#ffb030"); f.luz(9, 13, "#ffb030"); f.luz(12, 11, "#fff8d0");
    },
    carpinteiro(f) {
      f.ret(7, 21, 18, 4, (x, y) => (y === 21 ? MAD[0] : y === 24 ? MAD[2] : (x * 3 + y) % 7 === 0 ? MAD[2] : MAD[1]));
      f.ret(7, 21, 1, 4, MAD[0]);
      f.poli([[6, 12], [17, 8], [18, 13], [7, 18]], diag(ACO, 8, 9, 19, 17, 0.3));
      for (let i = 0; i < 6; i++) f.poli([[7 + i * 2, 18 - i * 0.82], [9 + i * 2, 17.2 - i * 0.82], [8.4 + i * 2, 19.6 - i * 0.82]], ACO[2]);
      f.poli([[17, 6], [23, 6], [24, 14], [18, 15]], diag(MAD, 17, 6, 24, 15));
      f.furo(20.6, 10.4, 1.4, 2);
      f.pt(18, 8, OURO[1]); f.pt(19, 13, OURO[1]);
    },
    oleiro(f) {
      f.ret(8, 25, 16, 2, (x, y) => (y === 25 ? MAD[0] : MAD[2]));
      f.ret(14, 27, 4, 1, MAD[3]);
      f.arco(10.4, 13, 3, 100, 260, BARRO[2], 1.6);
      f.arco(21.6, 13, 3, -80, 80, BARRO[3], 1.6);
      f.elip(16, 17.5, 6.6, 7, esf(BARRO));
      f.ret(13, 8, 6, 4, (x) => (x < 15 ? BARRO[0] : x < 18 ? BARRO[1] : BARRO[2]));
      f.ret(12, 6, 8, 2, (x, y) => (y === 6 ? BARRO[0] : BARRO[2]));
      for (let x = 10; x <= 22; x++) if (Math.pow((x - 16) / 6.6, 2) + Math.pow((15 - 17.5) / 7, 2) <= 1) { f.pt(x, 15, BARRO[3]); f.pt(x, 16, x % 2 ? "#f6e6c0" : BARRO[3]); f.pt(x, 17, BARRO[3]); }
    },
    tecelao(f) {
      f.ret(7, 6, 2, 21, (x) => (x === 7 ? MAD[0] : MAD[2]));
      f.ret(23, 6, 2, 21, (x) => (x === 23 ? MAD[1] : MAD[3]));
      f.ret(6, 7, 20, 2, (x, y) => (y === 7 ? MAD[0] : MAD[2]));
      f.ret(6, 23, 20, 2, (x, y) => (y === 23 ? MAD[0] : MAD[2]));
      f.ret(10, 15, 12, 8, (x, y) => { const l = y - 15; return l === 2 || l === 5 ? (x % 2 ? "#c83c2c" : "#8e241e") : l === 3 || l === 4 ? (x % 2 ? "#3a64b0" : "#28488a") : (x + y) % 2 ? "#f6ecd0" : "#d8c8a0"; });
      for (let x = 10; x <= 21; x += 2) for (let y = 9; y <= 14; y++) f.pt(x, y, "#e8dcc0");
      f.lin(11, 13, 20, 12, barra(MAD), 1.6);
    },
    perfumista(f, b) {
      b.brilho(16, 18, 9, "#d8a0ff", 0.35);
      f.elip(16, 19.5, 6.4, 6.4, esf(ROXO));
      f.ret(14, 10, 4, 5, (x) => (x === 14 ? ROXO[0] : x === 17 ? ROXO[2] : ROXO[1]));
      f.ret(13, 9, 6, 2, (x, y) => (y === 9 ? OURO[0] : OURO[2]));
      f.elip(16, 6.6, 2, 2, esf(OURO));
      f.ret(11, 18, 11, 1, OURO[1]); f.ret(11, 19, 11, 1, OURO[2]);
      f.pt(13, 16, "#ffffff"); f.pt(13, 17, ROXO[0]); f.pt(14, 15, ROXO[0]);
      f.luz(23, 9, "#ffffff"); f.luz(22, 9, "#e4c4f6"); f.luz(24, 9, "#e4c4f6"); f.luz(23, 8, "#e4c4f6"); f.luz(23, 10, "#e4c4f6");
      f.luz(8, 12, "#e4c4f6"); f.luz(25, 14, "#a868d8");
    },
  };

  // -------------------------------------------------------------------
  // Glifos de interface: paleta de letras (uma letra = 1 px de arte)
  // -------------------------------------------------------------------
  const LETRAS = {
    k: "#2a1a14", o: "#ffffff",
    y: "#fff0b0", Y: "#f0c048", g: "#c08a2a", G: "#7a5218",
    r: "#f8a080", R: "#d84a32", d: "#a02a22", D: "#5e161a",
    l: "#d8a868", L: "#a8703a", m: "#7a4a2a", M: "#4a2c1c",
    p: "#fbf0d0", P: "#e6cf9c", q: "#c4a672", Q: "#8a6c44",
    i: "#f4f8fa", I: "#c0ccd4", s: "#8494a0", S: "#4a5662",
    c: "#f8d4a8", C: "#e0a878", e: "#b87850",
    v: "#d0f088", V: "#84c048", w: "#4c8a30", W: "#285420",
    b: "#e0fafa", B: "#78d4dc", a: "#3a94b0", A: "#1e5878",
    t: "#f0b488", T: "#c47e52", n: "#935434", N: "#5c3020",
    h: "#4a2f20",
  };
  const UI = {
    ui_coracao: [
      "................",
      "................",
      "..rRRR....RRRd..",
      ".rorRRR..RRRRRd.",
      ".rrRRRRRRRRRRRd.",
      ".rRRRRRRRRRRRRd.",
      ".RRRRRRRRRRRRdd.",
      ".RRRRRRRRRRRRdD.",
      "..RRRRRRRRRRdD..",
      "...RRRRRRRRdD...",
      "....RRRRRRdD....",
      ".....RRRRdD.....",
      "......RRdD......",
      ".......dD.......",
      "................",
      "................"],
    ui_louro: [
      "................",
      "....yY....Yg....",
      "...yYY....YYg...",
      "..yYY......YYg..",
      "..YY.y....g.YG..",
      ".yY.yY....Yg.YG.",
      ".yY.YY....YY.YG.",
      ".YY..........YG.",
      ".Y.yY......Yg.G.",
      ".gYYY......YYYG.",
      "..YY.y....g.YG..",
      "..g.yYY..YYg.G..",
      "...yYYY..YYYG...",
      "....gYYrRYYG....",
      "......gRdG......",
      "................"],
    ui_candeia: [
      "................",
      "..........y.....",
      ".........yoy....",
      ".........yYy....",
      ".........gYg....",
      "..........g.....",
      "....ttttttTTT...",
      "..ttTTTTTTTTTTn.",
      ".tT.tTTTTTTTTnn.",
      ".tT.TTTTTTTTnn..",
      "..tTTTTTTTTnn...",
      "...TTTTTTnnn....",
      "....nnnnnnN.....",
      "...nnnnnnnnN....",
      "................",
      "................"],
    ui_moeda: [
      "................",
      ".....yyyyyy.....",
      "...yyYYYYYYgg...",
      "..yYYYYYYYYYYg..",
      "..yYYYggggYYYg..",
      ".yYYYgYYYYyYYYg.",
      ".yYYgYYYYYYyYYg.",
      ".yYYgYYYYYYyYYg.",
      ".yYYgYYYYYYyYYg.",
      ".yYYgYYYYYYyYYg.",
      ".YYYYgYYYYyYYYG.",
      "..YYYYyyyyYYYG..",
      "..gYYYYYYYYYYG..",
      "...ggYYYYYYGG...",
      ".....gGGGGG.....",
      "................"],
    ui_mochila: [
      "................",
      ".....mmmmmm.....",
      "....m......m....",
      "...lLLLLLLLLm...",
      "..lLLLLLLLLLLm..",
      "..LLLLLLLLLLLm..",
      "..LLLLLLLLLLmm..",
      "..mmmmmYYmmmmM..",
      "..LLLLLYgLLLLm..",
      "..LLLLLLLLLLLm..",
      "..LmmmmmmmmmLm..",
      "..LmlLLLLLLmLm..",
      "..LmLLLLLLLmmm..",
      "..mLLLLLLLLmmM..",
      "...mmmmmmmmMM...",
      "................"],
    ui_bolsa: [
      "................",
      ".....l....m.....",
      "......l..m......",
      ".....YgYYgG.....",
      "......lLLm......",
      ".....lLLLLm.....",
      "....lLLLLLLm....",
      "...lLLLLLLLLm...",
      "..lLLLLLLLLLLm..",
      "..LLLLLLLLLLmm..",
      "..LLLLLLLLLLmm..",
      "..LLLLLLLLLmmM..",
      "..mLLLLLLLmmmM..",
      "...mmLLLmmmMM...",
      "....mmmmMMM.....",
      "................"],
    ui_pergaminho: [
      "................",
      "..qPPPPPPPPPPq..",
      ".qppppppppppPPq.",
      "..qQQQQQQQQQQq..",
      "...pppppppppP...",
      "...pQQQQQQQpP...",
      "...pppppppppP...",
      "...pQQQQQpppP...",
      "...pppppppppP...",
      "...pQQQQQQQpP...",
      "...pppppppppP...",
      "...pQQQQpppPP...",
      "..qPPPPPPPPPPq..",
      ".qppppppppppPPq.",
      "..qQQQQQQQQQQq..",
      "................"],
    ui_personagem: [
      "................",
      ".....hhhhhh.....",
      "....hhhhhhhh....",
      "....hcccccch....",
      "....cckcckcC....",
      "....ccccccCC....",
      ".....ccCCCC.....",
      "......eCCe......",
      "....pPPCCPPq....",
      "...pPPPPPPPPq...",
      "..pPPPaAAaPPPq..",
      "..PPPPaAAaPPPq..",
      "..PPPPPaaPPPqq..",
      "..PPPPPPPPPPqQ..",
      "..qqqqqqqqqqQQ..",
      "................"],
    ui_registro: [
      "................",
      "...........ppp..",
      ".........pppPP..",
      "........ppPPPq..",
      ".......ppPPqq...",
      "......ppPPqq....",
      ".....ppPPqq.....",
      "....pPPPqq......",
      "....PPqqq.......",
      "...lPqq.........",
      "...lm...........",
      "..lm............",
      ".km.............",
      ".k...YYYYYYYYg..",
      ".....gggggggG...",
      "................"],
    ui_tela_cheia: [
      "................",
      ".ppppp....ppppp.",
      ".pPPPP....PPPPq.",
      ".pP..........Pq.",
      ".pP..........Pq.",
      ".pP..........Pq.",
      "................",
      "................",
      "................",
      "................",
      ".pP..........Pq.",
      ".pP..........Pq.",
      ".pP..........Pq.",
      ".pPPPP....PPPPq.",
      ".qqqqq....qqqqq.",
      "................"],
    ui_talentos: [
      "................",
      ".....vvvVV......",
      "...vvvVVVVVV....",
      "..vvVVVvVVVVww..",
      "..vVVvVVVVVwVw..",
      ".vVVVVVVwVVVwww.",
      ".VVVvVVVVVVwwwW.",
      ".VVVVVwVVVwwwWW.",
      "..wVVwwmwwwwWW..",
      "...wwwlmmwWWW...",
      "......lLm.......",
      "......lLm.......",
      "......lLm.......",
      ".....lLLmm......",
      "....mmmmmmm.....",
      "................"],
    ui_ajuda: [
      "................",
      ".....yyyyyy.....",
      "...yyYYYYYYgg...",
      "..yYYYMMMMYYYg..",
      "..yYYMMYYMMYYg..",
      ".yYYYMMYYMMYYYg.",
      ".yYYYYYYYMMYYYg.",
      ".yYYYYYYMMYYYYg.",
      ".yYYYYYMMYYYYYg.",
      ".YYYYYYMMYYYYYG.",
      ".YYYYYYYYYYYYYG.",
      "..YYYYYMMYYYYG..",
      "..gYYYYMMYYYYG..",
      "...ggYYYYYYGG...",
      ".....gGGGGG.....",
      "................"],
    ui_fechar: [
      "................",
      "................",
      "..pP........Pq..",
      "..PPP......PPq..",
      "...PPP....PPq...",
      "....PPP..PPq....",
      ".....PPPPPq.....",
      "......PPPq......",
      "......PPPq......",
      ".....PPPPPq.....",
      "....PPq..PPq....",
      "...PPq....PPq...",
      "..PPq......PPq..",
      "..Pq........Pq..",
      "................",
      "................"],
    ui_menu: [
      "................",
      "................",
      "..pppppppppppp..",
      "..PPPPPPPPPPPq..",
      "..qqqqqqqqqqqq..",
      "................",
      "..pppppppppppp..",
      "..PPPPPPPPPPPq..",
      "..qqqqqqqqqqqq..",
      "................",
      "..pppppppppppp..",
      "..PPPPPPPPPPPq..",
      "..qqqqqqqqqqqq..",
      "................",
      "................",
      "................"],
    ui_cadeado: [
      "................",
      ".....iIIIIs.....",
      "....iIssssIs....",
      "....iI....Is....",
      "....iI....Is....",
      "....iI....Is....",
      "..yyYYYYYYYYgg..",
      "..yYYYYYYYYYYg..",
      "..yYYYYMMYYYYg..",
      "..YYYYMMMMYYYG..",
      "..YYYYYMMYYYYG..",
      "..YYYYYMMYYYYG..",
      "..gYYYYYYYYYGG..",
      "..gGGGGGGGGGGG..",
      "................",
      "................"],
    ui_losango: [
      "................",
      ".......yy.......",
      "......yyYg......",
      ".....yyYYgg.....",
      "....yyYYYYgg....",
      "...yyYYYYYYgg...",
      "..yyYYYYYYYYgg..",
      ".yoyYYYYYYYYYgG.",
      ".gYYYYYYYYYYgGG.",
      "..gYYYYYYYYgGG..",
      "...gYYYYYYgGG...",
      "....gYYYYgGG....",
      ".....gYYgGG.....",
      "......ggGG......",
      ".......GG.......",
      "................"],
    ui_escudo_bloq: [
      "................",
      "..iiiiiiyIIIss..",
      "..iIIIIIYgIIIs..",
      "..iIIIIIYgIIss..",
      "..iIIIIIYgIIss..",
      "..iYYYYYYYgggs..",
      "..IgggggYgGGGs..",
      "..IIIIIIYgIIss..",
      "..IIIIIIYgIsss..",
      "...IIIIIYgIss...",
      "...sIIIIYgsss...",
      "....sIIIYgss....",
      ".....sIIYgs.....",
      "......ssgS......",
      ".......sS.......",
      "................"],
    ui_gota: [
      "................",
      ".......v........",
      ".......vV.......",
      "......vVV.......",
      "......vVVw......",
      ".....vVVVw......",
      ".....vVVVVw.....",
      "....vVVVVVVw....",
      "...vvVVVVVVww...",
      "...voVVVVVVwW...",
      "...vvVVVVVVwW...",
      "...VVVVVVVwwW...",
      "....VVVVVwwW....",
      ".....wwwwWW.....",
      "................",
      "................"],
    ui_estrela_chefe: [
      "................",
      "................",
      "................",
      ".y.....yy.....g.",
      ".yY...yYYg...Yg.",
      ".yYY..yYYg..YYg.",
      ".yYYY.YYYY.YYYg.",
      ".yYYYYYYYYYYYYg.",
      ".yYYYYYYYYYYYYg.",
      ".YYrRYYbBYYrRYg.",
      ".YYRdYYBaYYRdYG.",
      ".gYYYYYYYYYYYYG.",
      ".gGGGGGGGGGGGGG.",
      "................",
      "................",
      "................"],
    ui_ancora: [
      "................",
      "......bBBa......",
      ".....bB..Ba.....",
      "......bBBa......",
      ".......Ba.......",
      "....bBBBBBBa....",
      ".......Ba.......",
      ".......Ba.......",
      ".b.....Ba.....a.",
      ".bB....Ba....Ba.",
      ".bB....Ba....Ba.",
      "..bB...Ba...Ba..",
      "...bBB.Ba.BBa...",
      "....aBBBBBBa....",
      "......aaaa......",
      "................"],
    ui_peixe: [
      "................",
      "................",
      "................",
      ".a......BBB.....",
      ".aB...aBBBBBB...",
      ".aBB.BBBBBBBBB..",
      "..aBBBBBBBBkBBB.",
      "..aBBBBBBBBBBBa.",
      ".aBBbbBBBBBBBa..",
      ".aB..bbbbbbba...",
      ".a.....aaa......",
      "................",
      "................",
      "................",
      "................",
      "................"],
    ui_dpad_seta: [
      "................",
      ".......pp.......",
      "......pPPq......",
      ".....pPPPPq.....",
      "....pPPPPPPq....",
      "...pPPPPPPPPq...",
      "..pPPPPPPPPPPq..",
      ".pPPPPPPPPPPPPq.",
      ".qqqqPPPPPPqqqq.",
      ".....PPPPPq.....",
      ".....PPPPPq.....",
      ".....PPPPPq.....",
      ".....PPPPPq.....",
      ".....PPPPPq.....",
      ".....qqqqqq.....",
      "................"],
    ui_falar: [
      "................",
      "...pppppppppp...",
      "..pppppppppppP..",
      ".ppppppppppppPq.",
      ".ppppppppppppPq.",
      ".ppQQppQQppQQPq.",
      ".ppQQppQQppQQPq.",
      ".ppppppppppppPq.",
      ".PppppppppppPPq.",
      "..PPPPPPPPPPPq..",
      "...qqPPPqqqqq...",
      "....pPPq........",
      "....pPq.........",
      "....pq..........",
      "................",
      "................"],
    ui_orar: [
      "................",
      ".......ce.......",
      "......cCeC......",
      "......cCeC......",
      ".....ccCeCC.....",
      ".....cCCeCCe....",
      ".....cCCeCCe....",
      "....ccCCeCCCe...",
      "....cCeCeCeCe...",
      "....cCCeeeCCe...",
      "....cCCCeCCCe...",
      ".....CCCeCCe....",
      "....BBBaeaBBB...",
      "...bBBBa.aBBBA..",
      "...BBBa...aBBA..",
      "................"],
    ui_selo: [
      "................",
      ".....tttttt.....",
      "...ttTTTTTTTn...",
      "..tTTTTTTTTTTn..",
      "..tTTnnnnnnTTn..",
      ".tTTnTTTTTTtTTn.",
      ".tTTnTTttTTtTTn.",
      ".tTTnTttttTtTTn.",
      ".tTTnTTttTTtTTn.",
      ".TTTnTTTTTTtTTN.",
      ".TTTTnttttTTTnN.",
      "..TTTTTTTTTTnN..",
      "..nTTTTTTTTnnN..",
      "...nnTTTTnnNN...",
      ".....nNNNNN.....",
      "................"],
    ui_alforje: [
      "................",
      "................",
      "...mmmmmmmmmm...",
      "..mLLLLmmLLLLm..",
      ".lLLLLLmmLLLLLm.",
      ".lLLLLLmmLLLLLm.",
      ".mmmmmmmmmmmmmM.",
      ".lLLYLLmmLLYLLm.",
      ".lLLgLLmmLLgLLm.",
      ".lLLLLLmmLLLLLm.",
      ".lLLLLLmmLLLLLm.",
      ".LLLLLLmmLLLLmm.",
      ".mLLLLmMMmLLLmM.",
      "..mmmmM..mmmmM..",
      "................",
      "................"],
    ui_bestiario: [
      "................",
      "..mmmmmmmmmmm...",
      ".lLLLLLLLLLLmp..",
      ".lLLLLLLLLLLmpP.",
      ".lLLYLYLYLLLmpP.",
      ".lLLYLYLYLLLmpP.",
      ".lLLLLLLLLLLmpP.",
      ".lLLLYYYYLLLmpP.",
      ".lLLYYYYYYLLmpP.",
      ".lLLYYYYYYLLmpP.",
      ".lLLLYYYYLLLmpP.",
      ".lLLLLLLLLLLmpP.",
      ".lLLLLLLLLLLmpq.",
      ".mmmmmmmmmmmmq..",
      "..qqqqqqqqqqq...",
      "................"],
    ui_amuleto: [
      "................",
      ".q............q.",
      "..q..........q..",
      "...q........q...",
      "....q......q....",
      ".....q....q.....",
      "......qyyq......",
      ".....yYYYYg.....",
      "....yYvvVVYg....",
      "....yYvoVwYg....",
      "....YYVVwwYG....",
      "....gYVwwWYG....",
      ".....gYYYYG.....",
      "......gGGG......",
      "................",
      "................"],
    ui_mana: [
      "................",
      "................",
      ".....o....o.....",
      "..o.....o.....o.",
      "................",
      "....ooopoooo....",
      "...oopoooopoo...",
      "..tTTTTTTTTTTn..",
      ".tTtTTTTTTTTTnn.",
      ".tTtTTTTTTTTTnn.",
      "..TTTTTTTTTTnn..",
      "..nTTTTTTTTnnN..",
      "...nnTTTTnnNN...",
      ".....nNNNN......",
      "....nnnnnnN.....",
      "................"],
    ui_ampulheta: [
      "................",
      "..lLLLLLLLLLLm..",
      "..mmmmmmmmmmmM..",
      "...ibbbbbbbbs...",
      "...ibYYYYYYbs...",
      "....ibYYYYbs....",
      ".....ibYYbs.....",
      "......ibYs......",
      "......ibYs......",
      ".....ib.Ybs.....",
      "....ibb.Ybbs....",
      "...ibbYYYYbbs...",
      "...ibYYYYYYbs...",
      "..lLLLLLLLLLLm..",
      "..mmmmmmmmmmmM..",
      "................"],
  };
  // Glifos de interface por traço (diagonais limpas)
  const UI_TRACO = {
    ui_espadas(f) {
      espadaFig(f, 13, 13, 2.5, 2.5, 2, 0.62);
      espadaFig(f, 2, 13, 12.5, 2.5, 2, 0.62);
    },
    ui_atacar(f) {
      espadaFig(f, 2.5, 13, 13.5, 2, 2.6, 0.7);
    },
    ui_flecha(f) {
      f.lin(3, 12.5, 11, 4.5, barra(MAD), 1.5);
      f.poli([[14, 1.5], [8.6, 3.4], [12.2, 7]], (x, y) => (x + y < 14.5 ? ACO[0] : ACO[2]));
      for (const [x, y] of [[1, 12], [2, 11], [3, 10], [1, 13], [2, 12]]) f.pt(x, y, VERM[0]);
      for (const [x, y] of [[3, 14], [4, 13], [5, 12], [2, 14], [3, 13], [2, 13]]) f.pt(x, y, VERM[1]);
    },
    ui_cacada(f) {
      // tabuinha de contagem: quatro riscos e o corte que fecha a mão cheia
      f.ret(1, 2, 14, 12, (x, y) => (y === 2 || x === 1 ? MAD[0] : y === 13 || x === 14 ? MAD[3] : (x + y * 3) % 7 === 0 ? MAD[1] : MAD[2]));
      for (const x of [4, 6, 9, 11]) f.ret(x, 5, 1, 6, "#fbf0d0");
      for (let i = 0; i <= 10; i++) f.pt(3 + i, 11 - Math.round(i * 0.6), VERM[0]);
      for (let i = 0; i <= 10; i++) if (!((3 + i) % 2)) f.pt(3 + i, 12 - Math.round(i * 0.6), VERM[2]);
      f.pt(2, 3, OURO[1]); f.pt(13, 3, OURO[1]);
    },
  };

  // Rosa dos ventos (32 × 32) para a bússola do minimapa: traços de 2 px, norte em carmim.
  function rosa(g) {
    const b = Fig(32, 32), f = Fig(32, 32), c = 15.5;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const r = Math.hypot(x - c, y - c), luz = (x - c) + (y - c) < 0;
      if (r > 13.6) continue;
      if (r > 12.6) b.pt(x, y, "#22130e");
      else if (r > 10.6) b.pt(x, y, luz ? (r > 11.6 ? BRONZE[0] : BRONZE[1]) : r > 11.6 ? BRONZE[2] : BRONZE[3]);
      else if (r > 9.6) b.pt(x, y, "#1a1410");
      else b.pt(x, y, ["#3c5a8c", "#2e4670", "#223458", "#182642"][Math.max(0, Math.min(3, Math.floor((Math.hypot(x - 12, y - 11) / 15) * 4 + (bayer(x, y) - 0.5) * 0.8)))]);
    }
    // pontas menores (colaterais) e maiores (cardeais), cada uma com metade clara e metade escura
    const ponta = (ang, comp, larg, clara, escura) => {
      const a = ang * RAD, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux, cx = 16, cy = 16;
      const tip = [cx + ux * comp - 0.5, cy + uy * comp - 0.5], m = [cx - 0.5, cy - 0.5];
      const e = [m[0] + vx * larg, m[1] + vy * larg], d = [m[0] - vx * larg, m[1] - vy * larg];
      const ladoClaro = vx + vy < 0 || (vx + vy === 0 && vx < 0);
      f.poli([tip, e, m], ladoClaro ? clara : escura);
      f.poli([tip, d, m], ladoClaro ? escura : clara);
    };
    for (const a of [45, 135, 225, 315]) ponta(a, 11, 3.2, OURO[1], OURO[2]);
    ponta(0, 15, 4.8, LA[0], LA[2]);
    ponta(90, 15, 4.8, LA[0], LA[2]);
    ponta(180, 15, 4.8, LA[0], LA[2]);
    ponta(270, 15.5, 4.8, VERM[0], VERM[2]);
    f.ret(14, 14, 3, 3, OURO[1]); f.pt(14, 14, "#ffffff"); f.pt(16, 16, OURO[3]);
    compor(g, b, f, { sombra: 0.3 });
  }

  // -------------------------------------------------------------------
  // Registro
  // -------------------------------------------------------------------
  const base = (chave, extra) => Object.assign({}, PP[chave], { linhas: undefined, quadrosLinhas: undefined, cores: undefined }, extra);
  function limpar(def) { for (const k of Object.keys(def)) if (def[k] === undefined) delete def[k]; return def; }
  const reg = (chave, lado, desenhar, limite) => registrar(chave, limpar(base(chave, {
    w: lado / 2, h: lado / 2, res: 2, quadros: 1, contorno: null, acabamento: false, textura: false, origem: [0.5, 0.5], limiteCores: limite, desenhar,
  })));

  for (const [nome, [voc, fn]] of Object.entries(HB)) {
    reg("hb_" + nome, 32, (g) => {
      const b = Fig(32, 32), f = Fig(32, 32);
      placa(b, CAMPO[voc]);
      fn(f, b);
      compor(g, b, f, { sombra: 0.34, soDentro: true });
    }, 48);
  }
  for (const [nome, fn] of Object.entries(OF)) {
    reg("of_" + nome, 32, (g) => {
      const b = Fig(32, 32), f = Fig(32, 32);
      selo(b);
      fn(f, b);
      compor(g, b, f, { sombra: 0.22, contorno: "#2e1a10", soDentro: true });
    }, 48);
  }
  for (const [chave, linhas] of Object.entries(UI)) {
    reg(chave, 16, (g) => {
      const f = Fig(16, 16);
      for (let y = 0; y < 16; y++) { const l = linhas[y] || ""; for (let x = 0; x < 16; x++) { const c = LETRAS[l[x]]; if (c) f.pt(x, y, c); } }
      compor(g, null, f);
    }, 16);
  }
  for (const [chave, fn] of Object.entries(UI_TRACO)) {
    reg(chave, 16, (g) => { const f = Fig(16, 16); fn(f); compor(g, null, f); }, 16);
  }
  reg("ui_rosa", 32, rosa, 32);

  // Tamanho de cada família em px de arte (lado do quadrado); a interface escala por múltiplos inteiros.
  Arte.TAM_ICONE = { ui: 16, hb: 32, of: 32, rosa: 32 };
})(typeof window !== "undefined" ? window : globalThis);
