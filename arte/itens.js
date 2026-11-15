// =====================================================================
// arte/itens.js — itens redesenhados (60 ícones e as pedras do peitoral).
// Pacote A8 do plano de arte.
//
// Como o desenho é feito
//   Cada ícone é montado, px a px, com volumes simples iluminados de cima e da esquerda: bola (elipsoide),
//   tubo (bastão de raio variável), torno (peça de olaria por perfil de raios), polígono e lâmina. O tom
//   sai de rampa6 + sombrear; por cima entram o brilho especular, a textura do material (veio, costura,
//   escama, trama) e os detalhes de 1 px. O objeto é visto do alto, em oblíquo, como o mundo: os vasos
//   mostram a boca, os escudos mostram a espessura da borda. A sombra de apoio fica na camada de sombra.
//
// Chaves que este arquivo assume (registrar() com a MESMA chave troca o desenho legado de sprites.js):
//   as 56 chaves de item de sprites.js (pocao, espada_ferro, escudo_bronze, pedra_*, moeda…), em 32 × 32 px;
//   as chamadas item("…") continuam em sprites.js (os testes as procuram lá) e são sobrescritas aqui
//
// Contrato (docs/GUIA-DE-ARTE.md, seção "Contrato"):
//   * Vistas e quadros: direcoes = 3 (lado virado para a direita, frente, costas; a esquerda é o
//     espelho do lado), quadrosPorVista = 8, quadros = 24. Em cada vista: 0 parado, 1 respirar,
//     2 contato A, 3 passagem A, 4 contato B, 5 passagem B, 6 antecipação do golpe, 7 golpe.
//     A def declara ciclo: [2, 3, 4, 5], quadroAcao: [6, 7], sombra: { w, h } em px e alturaCabeca
//     em px de mundo. Criaturas nunca recebem humano: true.
//   * Só primitivas em px de arte: g.fino, g.pf, g.retf, g.linf e, de Arte.motor.prim, retF, elipF,
//     linF, bastao e pintarMascara (no tileset, pin.fino). São PROIBIDOS os blocos de unidade
//     (2 × 2 px): g.p, g.ret, g.lin e pin.set.
//   * def.w e def.h em unidades de 1/16 de casa (= 2 px de arte): célula de 48 × 64 px é w: 24, h: 32.
//   * Cor: Arte.motor.rampa6(base, tipo) e sombrear(rampa, luz, X, Y); luz de cima e da esquerda.
//     Até 64 cores no miolo (16 nos ui_, 24 nos hb_/of_). O contorno colorido de 1 px é do motor.
//   * Nada de document, canvas ou window na carga: o arquivo só define funções e chama registrar().
//     Os testes rodam este arquivo numa vm sem DOM.
//   * Nenhuma coordenada de mapa no código. Arte 100% original.
// =====================================================================
(function (global) {
  "use strict";
  const Arte = global.Arte;
  if (!Arte || !Arte.motor) return;
  const M = Arte.motor;
  const { registrar, rampa6, sombrear, misturar, hash2, comAlfa, PIXEL_PATTERNS } = M;
  const { elipF, linF } = M.prim;

  // -------------------------------------------------------------------
  // Luz e volumes
  // -------------------------------------------------------------------
  const norm = (x, y, z) => { const n = Math.hypot(x, y, z) || 1; return [x / n, y / n, z / n]; };
  const LUZ = norm(-0.52, -0.66, 0.54);          // x para a direita, y para baixo, z para quem olha
  const MEIO = norm(LUZ[0], LUZ[1], LUZ[2] + 1); // meio caminho entre a luz e o olho (brilho especular)
  // normal -> l de sombrear: de frente ~0,28 (tom base), virado para a luz ~0,9, contra a luz -1
  const luzN = (nx, ny, nz) => (nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2]) * 1.3 - 0.42;
  const espN = (nx, ny, nz) => nx * MEIO[0] + ny * MEIO[1] + nz * MEIO[2];
  const BRANCO = "#fffdf2";
  const lerp = (a, b, t) => a + (b - a) * t;
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));

  // tom de um ponto de normal (nx, ny, nz); o = { vies, esp (cor do brilho), dur (dureza do brilho),
  // rebote (luz devolvida pelo chão no lado da sombra), pont (pontilhado) }
  function tomN(R, nx, ny, nz, X, Y, o, extra = 0) {
    let l = luzN(nx, ny, nz) + (o.vies || 0) + extra;
    if (o.rebote && nx * 0.6 + ny * 0.8 > 0.72) l += o.rebote;
    if (o.esp) {
      const e = espN(nx, ny, nz), d = o.dur || 0.975;
      if (e > d) return o.esp;
      if (e > d - 0.035) return R[5];
    }
    return sombrear(R, l, X, Y, !!o.pont);
  }
  // Elipsoide. o.plano < 1 achata o volume (disco abaulado); o.tex(X, Y, nx, ny) soma luz; o.so(X, Y,
  // nx, ny) recorta; o.cor(X, Y, nx, ny) troca a rampa num trecho.
  function bola(g, cx, cy, rx, ry, R, o = {}) {
    const k = o.plano || 1;
    for (let Y = Math.floor(cy - ry); Y <= Math.ceil(cy + ry); Y++)
      for (let X = Math.floor(cx - rx); X <= Math.ceil(cx + rx); X++) {
        const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
        if (d > 1 || (o.so && !o.so(X, Y, nx, ny))) continue;
        const n = norm(nx * k, ny * k, Math.sqrt(1 - d * k * k) + (1 - k));
        const Rr = (o.cor && o.cor(X, Y, nx, ny)) || R;
        g.fino(X, Y, tomN(Rr, n[0], n[1], n[2], X, Y, o, o.tex ? o.tex(X, Y, nx, ny) : 0));
      }
  }
  // Bastão de (x0, y0) a (x1, y1), raio r0 -> r1, pontas redondas. o.tex(X, Y, t, lado) soma luz;
  // o.cor(t, lado, X, Y) troca a rampa (faixas, amarras).
  function tubo(g, x0, y0, x1, y1, r0, r1, R, o = {}) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2), rm = Math.max(r0, r1);
    for (let Y = Math.floor(Math.min(y0, y1) - rm); Y <= Math.ceil(Math.max(y0, y1) + rm); Y++)
      for (let X = Math.floor(Math.min(x0, x1) - rm); X <= Math.ceil(Math.max(x0, x1) + rm); X++) {
        const px = X + 0.5 - x0, py = Y + 0.5 - y0;
        const tt = (px * dx + py * dy) / L2, t = lim(tt, 0, 1), r = lerp(r0, r1, t);
        const ex = px - dx * t, ey = py - dy * t, d = Math.hypot(ex, ey);
        if (d > r) continue;
        if (o.reto && (tt < 0 || tt > 1)) continue;
        const nx = ex / r, ny = ey / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lado = (px * dy - py * dx) / L / r;
        const Rr = (o.cor && o.cor(t, lado, X, Y)) || R;
        g.fino(X, Y, tomN(Rr, nx, ny, nz, X, Y, o, o.tex ? o.tex(X, Y, t, lado) : 0));
      }
  }
  // Curva: f(t) -> [x, y], t de 0 a 1, em n trechos de tubo; raio(t).
  function curva(g, f, n, raio, R, o = {}) {
    let a = f(0);
    for (let i = 1; i <= n; i++) {
      const t0 = (i - 1) / n, t1 = i / n, b = f(t1);
      const oo = Object.assign({}, o);
      if (o.cor) oo.cor = (t, lado, X, Y) => o.cor(lerp(t0, t1, t), lado, X, Y);
      if (o.tex) oo.tex = (X, Y, t, lado) => o.tex(X, Y, lerp(t0, t1, t), lado);
      tubo(g, a[0], a[1], b[0], b[1], raio(t0), raio(t1), R, oo);
      a = b;
    }
  }
  // Polígono (regra par-ímpar, no centro do px). cor: texto ou (X, Y, dentro) => cor | null.
  function dentroDe(pts) {
    return (X, Y) => {
      const x = X + 0.5, y = Y + 0.5; let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
  }
  function poli(g, pts, cor) {
    const den = dentroDe(pts);
    let x0 = 99, x1 = -99, y0 = 99, y1 = -99;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let Y = Math.floor(y0); Y <= Math.ceil(y1); Y++)
      for (let X = Math.floor(x0); X <= Math.ceil(x1); X++) {
        if (!den(X, Y)) continue;
        const c = typeof cor === "function" ? cor(X, Y, den) : cor;
        if (c) g.fino(X, Y, c);
      }
    return den;
  }
  // Peça de torno: perfil = [[Y, raio], ...] de cima para baixo, eixo em cx. O raio que cresce para
  // baixo vira a normal para cima (ombro iluminado); o que encolhe, para baixo (bojo em sombra).
  // o.cor(Y, nx, X) troca a rampa (faixas pintadas); o.tex(X, Y, nx) soma luz.
  function raioEm(perfil, y) {
    for (let i = 0; i < perfil.length - 1; i++) {
      const [ya, ra] = perfil[i], [yb, rb] = perfil[i + 1];
      if (y >= ya && y <= yb) return lerp(ra, rb, yb === ya ? 0 : (y - ya) / (yb - ya));
    }
    return -1;
  }
  function torno(g, cx, perfil, R, o = {}) {
    const ya = perfil[0][0], yb = perfil[perfil.length - 1][0];
    for (let Y = Math.floor(ya); Y < yb; Y++) {
      const r = raioEm(perfil, Y + 0.5);
      if (r <= 0) continue;
      const incl = lim((raioEm(perfil, Math.min(yb, Y + 1.2)) - raioEm(perfil, Math.max(ya, Y - 0.2))) / 1.4, -1.2, 1.2);
      for (let X = Math.floor(cx - r); X <= Math.ceil(cx + r); X++) {
        const nx = (X + 0.5 - cx) / r;
        if (Math.abs(nx) > 1) continue;
        const c = Math.sqrt(1 - nx * nx), n = norm(nx, -incl * 0.75 * c, c);
        const Rr = (o.cor && o.cor(Y, nx, X)) || R;
        g.fino(X, Y, tomN(Rr, n[0], n[1], n[2], X, Y, o, o.tex ? o.tex(X, Y, nx) : 0));
      }
    }
  }
  const pontos = (g, lista, cor) => { for (const [X, Y] of lista) g.fino(X, Y, cor); };
  // escurece (t > 0) ou clareia (t < 0) o que já está pintado
  function matiz(g, X, Y, t) {
    const c = g.gf(X, Y);
    if (c) g.fino(X, Y, t >= 0 ? misturar(c, "#24131a", t) : misturar(c, "#fff6dc", -t));
  }
  // faísca em cruz (metal polido, gema)
  function faisca(g, X, Y, cor = BRANCO, grande = false) {
    g.fino(X, Y, cor);
    if (grande) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) matiz(g, X + a, Y + b, -0.55);
  }

  // -------------------------------------------------------------------
  // Materiais
  // -------------------------------------------------------------------
  const FERRO = rampa6("#8f9ba6", "metal"), ACO = rampa6("#7f9cb8", "metal"), FERRO_ESC = rampa6("#5a626c", "metal");
  const BRONZE = rampa6("#b9803a", "metal"), OURO = rampa6("#dba73a", "metal"), COBRE = rampa6("#b8642b", "metal");
  const MADEIRA = rampa6("#8d5d33", "madeira"), MADEIRA_CL = rampa6("#b48452", "madeira"), CASCA = rampa6("#5c3f2a", "madeira");
  const COURO = rampa6("#7d4d2e", "couro"), COURO_ESC = rampa6("#553222", "couro"), COURO_CL = rampa6("#a8703a", "couro");
  const BARRO = rampa6("#b4673e", "pedra"), BARRO_CL = rampa6("#cf8c5c", "pedra"), BARRO_ESC = rampa6("#7a4630", "pedra");
  const LINHO = rampa6("#d9cba6", "pano"), LINHO_BR = rampa6("#ece4cf", "pano"), ANIL = rampa6("#3b5a9a", "pano");
  const OSSO = rampa6("#dccfae", "pedra"), PEDRA = rampa6("#8a8478", "pedra");
  const CORDA = rampa6("#b79a68", "pano");

  // -------------------------------------------------------------------
  // Registro: mesma chave, mesma célula (32 × 32 px), mesma origem do legado
  // -------------------------------------------------------------------
  const FEITOS = [];
  function item(chave, desenhar, extra = {}) {
    const s = extra.sombraApoio || [8.2, 14.3, 5, 1.1];
    const comSombra = (g, q) => {
      if (s) g.sombra(s[0], s[1], s[2], s[3], "#1c1210", 0.24);
      desenhar(g, q);
    };
    FEITOS.push(chave);
    const base = PIXEL_PATTERNS[chave] || {};
    return registrar(chave, Object.assign({}, base, { w: 16, h: 16, contorno: "amigo", origem: base.origem || [0.5, 0.75], acabamento: false, desenhar: comSombra }, extra));
  }

  // ===================================================================
  // 1. ARMAS
  // ===================================================================
  // Lâmina em diagonal (cabo embaixo à esquerda, ponta em cima à direita). s corre ao longo da lâmina,
  // k é o passo de 1 px atravessado (k < 0 = face de cima, na luz).
  const K = Math.SQRT1_2, EX = 10.5, EY = 21.5;
  function lamina(g, R, comp, larg, o = {}) {
    for (let Y = 0; Y < 32; Y++) for (let X = 0; X < 32; X++) {
      const dx = X + 0.5 - EX, dy = Y + 0.5 - EY, s = (dx - dy) * K, p = (dx + dy) * K;
      if (s < 0 || s > comp) continue;
      const w = larg(s);
      if (Math.abs(p) > w) continue;
      const k = Math.round(p / K), km = Math.floor(w / K + 1e-6);
      let i = k === 0 ? (o.sulco && s < comp - 5 && s > 1.5 ? 1 : 3) : k < 0 ? (k === -km && km > 1 ? 5 : 4) : k === km && km > 1 ? 1 : 2;
      if (o.brilhos) for (const b of o.brilhos) if (Math.abs(s + p * 0.9 - b) < 1.1 && k !== 0) i = Math.min(5, i + 1);
      if (o.folha) i = k === 0 ? 5 : k < 0 ? (k === -km ? 3 : 4) : k === km ? 0 : 1;
      let c = R[i];
      if (o.tex) c = o.tex(c, s, k, X, Y) || c;
      g.fino(X, Y, c);
    }
  }
  const emS = (s, p = 0) => [EX + (s + p) * K, EY + (p - s) * K]; // ponto a s da guarda e p atravessado
  function punho(g, Rcabo, Rpomo, o = {}) {
    const a = emS(-1.2), b = emS(-6.6), c = emS(-8.4);
    tubo(g, a[0], a[1], b[0], b[1], 1.45, 1.35, Rcabo, { cor: o.faixas ? (t) => (Math.floor(t * 5.2) % 2 ? o.faixas : null) : null });
    bola(g, c[0], c[1], o.pomo || 2.1, o.pomo || 2.1, Rpomo, { esp: o.espPomo });
  }
  function guarda(g, R, meia, raio, o = {}) {
    const a = emS(0, -meia), b = emS(0, meia);
    tubo(g, a[0], a[1], b[0], b[1], raio, raio, R, { esp: o.esp, dur: 0.985 });
    if (o.bolas) { bola(g, a[0], a[1], o.bolas, o.bolas, R, { esp: o.esp }); bola(g, b[0], b[1], o.bolas, o.bolas, R, {}); }
  }

  // Espada de treino: lâmina larga de madeira clara, ponta rombuda, cruzeta amarrada com corda.
  item("espada_madeira", (g) => {
    punho(g, MADEIRA, MADEIRA, { pomo: 1.9, faixas: CORDA });
    lamina(g, MADEIRA_CL, 20.5, (s) => (s > 18 ? 1.9 - (s - 18) * 0.5 : 1.9), {
      tex: (c, s, k, X, Y) => (k !== 0 && hash2(Math.round(s * 0.45), k, 7) > 0.74 ? misturar(c, MADEIRA[1], 0.42) : null),
    });
    const n1 = emS(11.2, -0.4), n2 = emS(6.1, 0.9);
    g.fino(Math.floor(n1[0]), Math.floor(n1[1]), MADEIRA[1]); g.fino(Math.floor(n2[0]), Math.floor(n2[1]), MADEIRA[1]);
    guarda(g, MADEIRA, 4.4, 1.5);
    // amarração em X sobre a cruzeta
    const a = emS(0.2, -1.4), b = emS(0.2, 1.4);
    linF(g, Math.floor(a[0]), Math.floor(a[1]), Math.floor(b[0]), Math.floor(b[1]), CORDA[4]);
    g.fino(Math.floor(a[0]), Math.floor(a[1]) + 1, CORDA[2]);
  });
  // Espada de ferro: lâmina reta de dois gumes com nervura, guarda e pomo de bronze, cabo de couro.
  item("espada_ferro", (g) => {
    punho(g, COURO_ESC, BRONZE, { faixas: COURO, espPomo: BRANCO });
    lamina(g, FERRO, 23.5, (s) => (s > 19 ? 1.5 - (s - 19) * 0.3 : s < 1.6 ? 2.2 : 1.5), { brilhos: [8, 15.5] });
    guarda(g, BRONZE, 5.2, 1.5, { esp: BRANCO });
    const f = emS(15.6, -1.5); faisca(g, Math.floor(f[0]), Math.floor(f[1]));
  });
  // Espada temperada: aço azulado em folha (mais larga no terço final), sulco central, guarda de ouro
  // com pontas em botão e pedra no cruzamento.
  item("espada_temperada", (g) => {
    punho(g, rampa6("#6a2a2a", "couro"), OURO, { faixas: OURO, espPomo: BRANCO, pomo: 2.2 });
    lamina(g, ACO, 25, (s) => {
      const folha = 1.5 + 0.75 * Math.exp(-(((s - 15.5) / 4.2) ** 2));
      return s > 19.5 ? folha * Math.max(0, 1 - (s - 19.5) / 5.4) + 0.3 : folha;
    }, { sulco: true, brilhos: [6.5, 12.5] });
    guarda(g, OURO, 5.4, 1.45, { esp: BRANCO, bolas: 1.9 });
    const c = emS(0.2);
    pontos(g, [[Math.floor(c[0]), Math.floor(c[1])]], "#c2452d"); g.fino(Math.floor(c[0]), Math.floor(c[1]) - 1, "#f08a6a");
    const f = emS(17.5, -2.1); faisca(g, Math.floor(f[0]), Math.floor(f[1]), BRANCO, true);
  });

  // Arcos: vara em curva, girada, com a corda do lado de dentro.
  function girar(x, y, graus, cx = 16, cy = 16) {
    const a = (graus * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
  }
  item("arco_madeira", (g) => {
    const GIRO = 24, f = (t) => { const u = t * 2 - 1; return girar(9.5 + 10 * (1 - u * u), 16.5 + 11.6 * u, GIRO); };
    const a = f(0), b = f(1);
    linF(g, Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), LINHO_BR[4]);
    curva(g, f, 22, (t) => 1.05 + 0.95 * Math.sin(Math.PI * t), MADEIRA, {
      cor: (t) => (Math.abs(t - 0.5) < 0.085 ? COURO_ESC : t < 0.045 || t > 0.955 ? CORDA : null),
      tex: (X, Y, t) => (hash2(Math.round(t * 30), 3, 11) > 0.7 ? -0.3 : 0),
    });
  }, { sombraApoio: [8.6, 14.4, 5.4, 1] });
  // Arco composto: chifre escuro e tendão claro em lâminas, empunhadura recuada, pontas recurvadas.
  item("arco_composto", (g) => {
    const GIRO = 24;
    const f = (t) => {
      const u = t * 2 - 1, au = Math.abs(u);
      const x = 9.5 + 10.5 * (1 - u * u) + (au > 0.8 ? 15 * (au - 0.8) : 0);
      return girar(x, 16.5 + 11.8 * u, GIRO);
    };
    const a = f(0.07), b = f(0.93);
    linF(g, Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), LINHO_BR[4]);
    const CHIFRE = rampa6("#6e4a32", "madeira"), GRIP = rampa6("#9a3229", "couro");
    curva(g, f, 26, (t) => 1.0 + 0.8 * Math.sin(Math.PI * t), CHIFRE, {
      esp: "#f2dcae", dur: 0.985,
      cor: (t) => {
        const d = Math.abs(t - 0.5);
        return d < 0.075 ? GRIP : d > 0.41 ? OSSO : Math.abs(d - 0.26) < 0.025 ? OURO : null;
      },
    });
  }, { sombraApoio: [8.6, 14.4, 5.4, 1] });

  // Funda: bolsa de couro com a pedra, duas tiras trançadas, laço de dedo numa ponta e nó na outra.
  item("funda", (g) => {
    const tira = (f) => {
      let a = f(0);
      for (let i = 1; i <= 14; i++) {
        const b = f(i / 14);
        linF(g, Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), (X, Y, j) => CORDA[(j + i) % 2 ? 4 : 3]);
        linF(g, Math.round(a[0]) + 1, Math.round(a[1]), Math.round(b[0]) + 1, Math.round(b[1]), (X, Y, j) => CORDA[(j + i) % 2 ? 2 : 1]);
        a = b;
      }
    };
    const esq = (t) => [8.5 - 4.5 * Math.sin(t * Math.PI) + t * 1.5, 21 - 14 * t];
    const dir = (t) => [23 + 4 * Math.sin(t * Math.PI) - t * 1, 21 - 13 * t];
    tira(esq); tira(dir);
    // laço de dedo (esquerda) e nó com ponta solta (direita)
    const l = esq(1);
    for (let k = 0; k < 12; k++) { const an = (k / 12) * Math.PI * 2; g.fino(Math.round(l[0] + Math.cos(an) * 2.4), Math.round(l[1] - 2.4 + Math.sin(an) * 2.4), CORDA[k % 2 ? 4 : 2]); }
    const d = dir(1);
    bola(g, d[0] + 0.5, d[1], 2, 2, CORDA, {});
    pontos(g, [[Math.round(d[0]) + 2, Math.round(d[1]) - 2], [Math.round(d[0]) + 3, Math.round(d[1]) - 3], [Math.round(d[0]) + 3, Math.round(d[1]) - 4]], CORDA[4]);
    // bolsa: folha de couro em berço, pespontada, com a pedra dentro
    bola(g, 16, 23, 9.6, 4.6, COURO_ESC, { plano: 0.5 });
    bola(g, 16, 22.4, 8.4, 3.7, COURO, { plano: 0.4, vies: -0.35, tex: (X, Y, nx, ny) => (ny < -0.2 ? -0.5 : 0.35) });
    for (let k = 0; k < 9; k++) { const X = 8 + k * 2, Y = Math.round(25.6 - Math.abs(k - 4) * 0.42); g.fino(X, Y, COURO[5]); }
    bola(g, 16, 20.6, 4.3, 3.9, PEDRA, { esp: "#f2ecdc", dur: 0.985, rebote: 0.3 });
    matiz(g, 17, 22, 0.2); matiz(g, 14, 21, 0.18);
    for (let X = 12; X <= 20; X++) matiz(g, X, 24, 0.4);
  }, { sombraApoio: [8, 14.2, 5.6, 1.1] });

  // Flechas: feixe de três, haste de caniço, ponta de bronze em folha, penas tingidas.
  item("flecha", (g) => {
    const CANICO = rampa6("#c09a5e", "madeira"), PENA = rampa6("#b23a2c", "pano");
    const uma = (ox, oy, comp, Rp) => {
      const x0 = 5 + ox, y0 = 26 + oy, x1 = x0 + comp, y1 = y0 - comp;
      linF(g, x0, y0, x1, y1, (X, Y, i) => CANICO[i % 7 === 3 ? 2 : 3]);
      linF(g, x0, y0 - 1, x1 - 1, y1, CANICO[5]);
      // ponta em folha
      poli(g, [[x1 - 0.2, y1 - 1.2], [x1 + 4.2, y1 - 3.2], [x1 + 2.2, y1 + 1.2]], (X, Y) => (X - x1 + (Y - y1) < -0.5 ? BRONZE[5] : X - x1 + (Y - y1) > 0.5 ? BRONZE[1] : BRONZE[3]));
      g.fino(x1 + 3, y1 - 3, BRANCO);
      // penas: duas barbas, uma de cada lado da haste
      for (let i = 0; i < 5; i++) {
        g.fino(x0 + i - 1, y0 - i - 1, Rp[i === 0 ? 2 : 4]); g.fino(x0 + i - 2, y0 - i - 1, Rp[i < 4 ? 5 : 4]);
        g.fino(x0 + i + 1, y0 - i + 1, Rp[i === 0 ? 1 : 2]); g.fino(x0 + i + 1, y0 - i + 2, Rp[1]);
      }
      g.fino(x0 - 1, y0 + 1, CANICO[1]);
    };
    uma(-2, -4, 17, rampa6("#d9cba6", "pano"));
    uma(3, 1, 17, rampa6("#d9cba6", "pano"));
    uma(0, -1, 19, PENA);
    // amarra do feixe
    for (const [X, Y] of [[12, 15], [13, 16], [14, 17], [15, 18], [16, 19], [17, 20]]) g.fino(X, Y, COURO_ESC[(X & 1) ? 2 : 4]);
  }, { sombraApoio: [8.4, 14.3, 5.2, 1] });

  // ===================================================================
  // 2. ESCUDOS — disco abaulado visto de cima, com a espessura da borda aparecendo embaixo
  // ===================================================================
  function escudo(g, Raro, face, o = {}) {
    const cx = 16, cy = 14.5, rx = 12.4, ry = 11.6;
    elipF(g, cx, cy + 2.2, rx, ry, (nx) => Raro[nx < -0.35 ? 2 : nx > 0.5 ? 0 : 1]);
    elipF(g, cx, cy, rx, ry, (nx, ny, X, Y) => {
      const r = Math.hypot(nx, ny), ang = Math.atan2(ny, nx);
      const n = norm(nx * 0.62, ny * 0.62, Math.sqrt(Math.max(0.05, 1 - r * r * 0.38)));
      return face(r, ang, luzN(n[0], n[1], n[2]), nx, ny, X, Y);
    });
    // umbo
    if (o.umbo) {
      for (let k = 0; k < 16; k++) { const an = (k / 16) * Math.PI * 2; matiz(g, Math.round(cx - 0.5 + Math.cos(an) * (o.umbo + 1) + 0.6), Math.round(cy - 0.5 + Math.sin(an) * (o.umbo + 1) + 0.8), 0.32); }
      bola(g, cx, cy, o.umbo, o.umbo, o.Rumbo, { esp: BRANCO, dur: 0.97, rebote: 0.35 });
    }
    // rebites: cabeça clara com a sombra embaixo à direita
    for (const [an, rr] of o.rebites || []) {
      const X = Math.round(cx - 0.5 + Math.cos(an) * rx * rr), Y = Math.round(cy - 0.5 + Math.sin(an) * ry * rr);
      matiz(g, X + 1, Y + 1, 0.4); g.fino(X, Y, (o.Rreb || o.Rumbo)[5]);
    }
  }
  const aoRedor = (n, r, fase = 0) => Array.from({ length: n }, (_, i) => [fase + (i / n) * Math.PI * 2, r]);
  const reflexo = (ang) => Math.cos(2 * (ang + Math.PI * 0.75)); // faixa de luz do metal torneado

  // Tábuas de acácia, aro de couro cru costurado, umbo e cravos de bronze.
  item("escudo_madeira", (g) => {
    const ARO = rampa6("#6a4028", "couro");
    escudo(g, ARO, (r, ang, l, nx, ny, X, Y) => {
      if (r > 0.86) return (Math.floor((ang + Math.PI) * 5.1) % 2 === 0 && r < 0.95) ? ARO[4] : sombrear(ARO, l - 0.1 + (r > 0.94 ? -0.3 : 0.25), X, Y, false);
      if (r > 0.8) return MADEIRA[0];
      const tab = Math.floor((X - 3) / 5), junta = (X - 3) % 5 === 4;
      if (junta) return MADEIRA[0];
      const veio = hash2(X, Math.floor(Y / 4) + tab * 5, 21) > 0.72 ? -0.32 : 0;
      return sombrear(MADEIRA, l * 0.85 + (hash2(tab, 1, 5) - 0.5) * 0.45 + veio + ((X - 3) % 5 === 0 ? 0.3 : 0), X, Y, false);
    }, { umbo: 3.3, Rumbo: BRONZE, rebites: aoRedor(4, 0.48, Math.PI / 4).concat(aoRedor(2, 0.66, Math.PI / 2)) });
  }, { sombraApoio: [8.3, 14.2, 6.2, 1.3] });
  // Bronze batido: aro grosso, friso em relevo, coroa de botões e umbo polido.
  item("escudo_bronze", (g) => {
    const ARO = rampa6("#8a5a26", "metal");
    escudo(g, ARO, (r, ang, l, nx, ny, X, Y) => {
      const m = l + reflexo(ang) * 0.42;
      if (r > 0.85) return sombrear(BRONZE, l + 0.2 + (r > 0.94 ? -0.5 : 0.25) + reflexo(ang) * 0.2, X, Y, false);
      if (r > 0.79) return ARO[1];
      if (r > 0.5 && r < 0.56) return sombrear(BRONZE, m - 0.7, X, Y, false);
      if (r > 0.43 && r <= 0.5) return sombrear(BRONZE, m + 0.45, X, Y, false);
      return sombrear(BRONZE, m, X, Y, true);
    }, { umbo: 3.6, Rumbo: OURO, Rreb: OURO, rebites: aoRedor(8, 0.68, Math.PI / 8) });
    faisca(g, 9, 7, BRANCO, true);
  }, { sombraApoio: [8.3, 14.2, 6.2, 1.3] });
  // Ferro: chapa fria com reforço em cruz, aro escuro rebitado e umbo pontudo.
  item("escudo_ferro", (g) => {
    escudo(g, FERRO_ESC, (r, ang, l, nx, ny, X, Y) => {
      const m = l + reflexo(ang) * 0.5;
      if (r > 0.84) return sombrear(FERRO_ESC, l + 0.15 + (r > 0.94 ? -0.4 : 0.3), X, Y, false);
      if (r > 0.79) return FERRO_ESC[0];
      const braco = Math.min(Math.abs(nx), Math.abs(ny)) * 12;
      if (braco < 1.6) return sombrear(FERRO_ESC, l + 0.45 + (nx + ny > 0 && braco > 0.8 ? -0.5 : 0), X, Y, false);
      if (braco < 2.5 && (Math.abs(nx) < Math.abs(ny) ? nx > 0 : ny > 0)) return sombrear(FERRO, m - 0.75, X, Y, false);
      return sombrear(FERRO, m, X, Y, true);
    }, { umbo: 3.4, Rumbo: FERRO, Rreb: FERRO, rebites: aoRedor(8, 0.9, 0).concat(aoRedor(4, 0.5, 0)) });
    g.fino(15, 13, BRANCO); g.fino(14, 13, FERRO[5]);
    faisca(g, 8, 8, BRANCO, true);
  }, { sombraApoio: [8.3, 14.2, 6.2, 1.3] });

  // ===================================================================
  // 3. ARMADURAS E VESTES — estendidas no chão
  // ===================================================================
  // Túnica de pano cru: mangas curtas, decote, cinto de anil com a ponta caída, barra listrada.
  item("tunica_pano", (g) => {
    const PANO = rampa6("#cdb98a", "pano");
    poli(g, [[11.5, 4], [20.5, 4], [24.5, 6], [29, 11.5], [26, 15.5], [23, 13], [23, 22], [25, 28.5], [7, 28.5], [9, 22], [9, 13], [6, 15.5], [3, 11.5], [7.5, 6]], (X, Y, den) => {
      if ((X - 16) ** 2 / 12.5 + (Y - 4) ** 2 / 5.5 < 1) return PANO[0];
      if ((X - 16) ** 2 / 20 + (Y - 4) ** 2 / 10 < 1) return PANO[5];
      const manga = Y < 16 && (X < 9 || X > 22);
      if (manga) { const e = X < 9; return sombrear(PANO, (e ? 0.55 : -0.35) - (Y - 9) * 0.1 + (!den(X, Y + 1) ? -0.5 : 0), X, Y, false); }
      if (Y === 17 || Y === 18) return ANIL[Y === 17 ? (X < 15 ? 5 : 4) : (X < 14 ? 3 : 2)];
      if (Y === 26) return ANIL[X < 15 ? 4 : 2];
      const t = (X - 7) / 18;
      let l = 0.62 - 1.2 * t + Math.cos(t * 3.2 * 2 * Math.PI + 0.6) * (Y > 18 ? 0.3 : 0.14) - (Y === 19 ? 0.55 : 0) + (Y < 7 ? 0.2 : 0);
      if (X === 9 && Y < 16 || X === 22 && Y < 16) l -= 0.4;
      return sombrear(PANO, l, X, Y, false);
    });
    // nó do cinto e ponta caída
    pontos(g, [[12, 17], [13, 17], [12, 18]], ANIL[5]); pontos(g, [[13, 18], [12, 19], [12, 20], [12, 21], [12, 22]], ANIL[3]);
    pontos(g, [[13, 19], [13, 20], [13, 21], [13, 22], [13, 23]], ANIL[1]); g.fino(12, 23, OURO[4]);
  }, { sombraApoio: [8, 14.6, 5.6, 0.9] });

  const TORSO = [[8.5, 4], [13, 4], [14, 7.5], [18, 7.5], [19, 4], [23.5, 4], [25.5, 8], [24, 12], [25, 17], [24.2, 21.5], [26, 28.5], [6, 28.5], [7.8, 21.5], [7, 17], [8, 12], [6.5, 8]];
  // Armadura de couro: peitoral fervido com ombreiras, costura clara, duas correias com fivela e saiote de tiras.
  item("armadura_couro", (g) => {
    const den = poli(g, TORSO, (X, Y) => {
      const nx = (X - 15.5) / 10.5, c = Math.sqrt(Math.max(0.05, 1 - nx * nx));
      let l = luzN(nx * 0.9, -0.15, c);
      if (Y >= 23) { // saiote de tiras
        const u = (X - 6) % 4;
        if (u === 3) return COURO_ESC[0];
        return sombrear(COURO_ESC, l + (u === 0 ? 0.55 : u === 2 ? -0.15 : 0.2) - (Y - 23) * 0.04, X, Y, false);
      }
      if (Y === 22) return COURO[0];
      if (Y === 13 || Y === 18) return COURO_ESC[2];
      if (Y === 12 || Y === 17) return COURO_ESC[X < 14 ? 4 : 3];
      if (Y === 14 || Y === 19) l -= 0.55;
      if (Y < 8) l += 0.3;
      return sombrear(COURO, l, X, Y, false);
    });
    // borda do saiote: pontas arredondadas
    for (let X = 6; X <= 26; X++) if ((X - 6) % 4 !== 1 && den(X, 28)) g.fino(X, 28, null);
    // costura clara ao longo da gola e das cavas
    pontos(g, [[10, 5], [12, 5], [13, 7], [15, 8], [17, 8], [19, 7], [20, 5], [22, 5], [8, 9], [9, 11], [24, 9], [23, 11], [9, 15], [23, 15], [9, 20], [23, 20]], COURO[5]);
    // fivelas de bronze
    for (const Y of [12, 17]) { pontos(g, [[15, Y], [16, Y], [17, Y + 1]], OURO[4]); g.fino(15, Y + 1, OURO[5]); g.fino(16, Y + 1, COURO_ESC[0]); g.fino(17, Y, OURO[2]); }
    // cravos nas ombreiras
    pontos(g, [[9, 7], [22, 7]], OURO[5]); pontos(g, [[10, 8], [23, 8]], COURO[0]);
  }, { sombraApoio: [8, 14.6, 5.6, 0.9] });
  // Couraça de escamas: lâminas de bronze em fileiras desencontradas sobre forro de couro vermelho.
  item("couraca_escamas", (g) => {
    const FORRO = rampa6("#7a2a26", "couro");
    poli(g, TORSO, (X, Y, den) => {
      const nx = (X - 15.5) / 10.5, c = Math.sqrt(Math.max(0.05, 1 - nx * nx));
      const l = luzN(nx * 0.9, -0.15, c);
      const beira = !den(X - 1, Y) || !den(X + 1, Y) || !den(X, Y - 1);
      if (Y < 7 || (beira && Y < 23)) return sombrear(FORRO, l + 0.25, X, Y, false);
      if (Y >= 27) return FORRO[Y === 27 ? (X < 15 ? 4 : 3) : 1];
      const fil = Math.floor((Y - 7) / 4), v = (Y - 7) % 4, u = (X + (fil % 2) * 3) % 5;
      const d = v === 0 ? [-1.3, 0.9, 0.9, 0.5, -1.3][u] : v === 1 ? [0.7, 0.3, 0.1, 0, -0.5][u] : v === 2 ? [0.3, 0, 0, -0.2, -0.6][u] : [-1.3, -0.6, -0.5, -0.7, -1.3][u];
      return sombrear(BRONZE, l * 0.7 + d, X, Y, false);
    });
    pontos(g, [[10, 5], [21, 5]], OURO[5]); pontos(g, [[15, 22], [16, 22]], OURO[5]);
    faisca(g, 11, 10, BRANCO); faisca(g, 13, 16, BRANCO);
  }, { sombraApoio: [8, 14.6, 5.6, 0.9] });

  // Manto bordado: púrpura aberto na frente, gola e barras de ouro com pontos, broche com pedra.
  item("manto_bordado", (g) => {
    const PURP = rampa6("#7a3a8e", "pano");
    const FORMA = [[11, 4], [21, 4], [24.5, 7], [27.5, 14], [29.5, 26.5], [25.5, 29], [21.5, 27], [17.5, 29], [16, 27.5], [14.5, 29], [10.5, 27], [6.5, 29], [2.5, 26.5], [4.5, 14], [7.5, 7]];
    poli(g, FORMA, (X, Y, den) => {
      const barra = !den(X, Y + 1) || !den(X, Y + 2) || !den(X, Y + 3);
      const aberto = Math.abs(X - 15.5) < 0.6 && Y > 8;
      if (aberto) return PURP[0];
      if (Y < 7) return OURO[(X + Y) % 3 === 0 ? 5 : X < 15 ? 4 : 2];
      const frente = Math.abs(X - 15.5) < 3 && Y > 7;
      if (barra || frente) {
        const claro = (frente ? Y % 3 === 0 : (X + (Y & 1)) % 3 === 0);
        return claro ? OURO[5] : OURO[X < 15 ? 3 : 2];
      }
      const t = (X - 3) / 26;
      const l = 0.5 - 1.05 * t + Math.cos(t * 4 * 2 * Math.PI + 0.3) * (0.2 + (Y - 6) * 0.012) - (Y < 9 ? 0.3 : 0);
      return sombrear(PURP, l, X, Y, false);
    });
    bola(g, 16, 7.5, 2.3, 2.3, OURO, { esp: BRANCO });
    g.fino(15, 7, "#f08a6a"); g.fino(16, 7, "#c2452d"); g.fino(15, 8, "#c2452d"); g.fino(16, 8, "#8e2a1f");
  }, { sombraApoio: [8, 14.6, 6.2, 0.9] });

  // ===================================================================
  // 4. OLARIA, FRASCOS E VIDROS
  // ===================================================================
  // boca vista de cima: aro claro e o escuro de dentro
  function boca(g, cx, cy, rx, ry, R, dentro) {
    elipF(g, cx, cy, rx, ry, (nx, ny) => R[ny < -0.2 ? 5 : nx < 0 ? 4 : 2]);
    if (rx > 1.6) elipF(g, cx, cy + 0.2, rx - 1.1, Math.max(0.6, ry - 0.8), (nx, ny) => (ny < -0.1 ? dentro[0] : dentro[1]));
  }
  const VIDRO = rampa6("#9fc0cf", "metal");
  // Poção de vida: frasco bojudo de vidro com licor vermelho, gargalo, rolha e cordão.
  item("pocao", (g) => {
    const LICOR = rampa6("#c2392b", "metal");
    bola(g, 16, 20, 9.2, 8.6, VIDRO, { rebote: 0.4 });
    bola(g, 16, 20.6, 7.7, 7.2, LICOR, { rebote: 0.55, so: (X, Y) => Y >= 16, vies: 0.05 });
    for (let X = 10; X <= 21; X++) if (g.gf(X, 16)) g.fino(X, 16, X < 14 ? "#f6a48a" : LICOR[4]);
    // brilho do vidro: risco curvo em cima à esquerda e ponto de luz devolvida embaixo à direita
    pontos(g, [[10, 17], [10, 18], [11, 15], [11, 16], [12, 14]], BRANCO); pontos(g, [[11, 19], [12, 15]], "#ffd9cc");
    pontos(g, [[21, 24], [20, 25]], "#f08a6a");
    torno(g, 16, [[5, 2.6], [7, 2.2], [11, 2.2], [13, 3.4]], VIDRO, {});
    pontos(g, [[14, 8], [14, 9], [14, 10]], BRANCO);
    torno(g, 16, [[2, 2.2], [3, 2.9], [6, 2.6]], rampa6("#b48452", "madeira"), {});
    for (let X = 13; X <= 18; X++) g.fino(X, 11, CORDA[X < 15 ? 5 : 3]);
    pontos(g, [[19, 12], [19, 13]], CORDA[3]);
  }, { sombraApoio: [8.1, 14.3, 5.2, 1.1] });
  // Poção de fé: redoma alta de faiança azul com tampa de ouro e uma estrela de luz dentro.
  item("pocao_fe", (g) => {
    const AZUL = rampa6("#3d62b4", "metal"), VA = rampa6("#a9c2e8", "metal");
    torno(g, 16, [[9, 3], [11, 6.6], [13, 7.6], [24, 7.2], [27, 5.6], [28.5, 3.5]], VA, { rebote: 0.3 });
    torno(g, 16, [[13, 6.2], [14, 6.4], [24, 6], [26.5, 4.4], [27.5, 3]], AZUL, { rebote: 0.5 });
    for (let X = 10; X <= 21; X++) if (g.gf(X, 13)) g.fino(X, 13, X < 14 ? "#cfe0ff" : AZUL[4]);
    torno(g, 16, [[4, 2.4], [5, 3.2], [8, 3], [9.5, 3.4]], OURO, { esp: BRANCO });
    torno(g, 16, [[2, 1.4], [3, 2], [4.2, 2]], OURO, {});
    pontos(g, [[10, 14], [10, 15], [10, 16], [10, 17], [11, 12]], BRANCO); pontos(g, [[10, 18], [10, 19], [11, 13]], "#cfe0ff");
    pontos(g, [[21, 23], [21, 24], [20, 25]], "#7fa3e0");
    // estrela de luz
    pontos(g, [[16, 19], [15, 19], [17, 19], [16, 18], [16, 20]], "#eaf2ff"); g.fino(16, 19, BRANCO);
    pontos(g, [[16, 17], [16, 21], [14, 19], [18, 19]], "#9fbcf0");
  }, { sombraApoio: [8.1, 14.5, 4.4, 1] });
  // Veneno de escorpião: potinho escuro tampado com pano e cordão, escorrido verde e o sinal do ferrão.
  item("veneno_escorpiao", (g) => {
    const POTE = rampa6("#5a4634", "pedra"), VERDE = rampa6("#8fb83a", "metal");
    torno(g, 16, [[12, 4.6], [14, 8.2], [18, 10], [23, 9.4], [26.5, 6.8], [28, 4.4]], POTE, { rebote: 0.35, esp: "#d8c8a8", dur: 0.985 });
    torno(g, 16, [[7, 4.2], [8.5, 5.6], [11, 5.4], [12.5, 4.8]], rampa6("#b8a070", "pano"), {});
    for (let X = 11; X <= 20; X++) g.fino(X, 12, "#8e2a1f");
    pontos(g, [[11, 13], [10, 14], [21, 13]], "#8e2a1f"); pontos(g, [[12, 12], [13, 12]], "#d0553c");
    pontos(g, [[13, 8], [14, 7], [17, 8]], "#e0cc9a");
    // escorrido
    pontos(g, [[19, 13], [19, 14], [20, 15], [20, 16], [20, 17], [20, 18]], VERDE[4]); pontos(g, [[21, 16], [21, 17], [21, 18], [21, 19]], VERDE[2]);
    pontos(g, [[20, 19], [20, 20]], VERDE[5]); g.fino(20, 18, BRANCO);
    // sinal do ferrão, pintado a vermelho
    pontos(g, [[12, 21], [13, 22], [14, 22], [15, 21], [15, 20], [14, 19], [13, 19]], "#c2452d"); g.fino(12, 18, "#e2774f"); g.fino(11, 20, "#c2452d");
  }, { sombraApoio: [8.1, 14.5, 5.2, 1] });
  // Frasco de barro: garrafinha de gargalo fino com asa, barro claro e uma faixa riscada.
  item("frasco_barro", (g) => {
    curva(g, (t) => [19.5 + 4.2 * Math.sin(t * Math.PI), 9 + 8 * t], 8, () => 1.1, BARRO_ESC, {});
    torno(g, 16, [[9, 2.2], [13, 2.4], [16, 6.4], [19.5, 8.2], [24, 7.6], [27, 5], [28.5, 3.6]], BARRO_CL, { rebote: 0.35, cor: (Y) => (Y === 20 ? BARRO_ESC : null) });
    torno(g, 16, [[6, 3.4], [7.5, 3.6], [9, 2.6]], BARRO_CL, {});
    boca(g, 16, 6.3, 3.6, 1.7, BARRO_CL, [BARRO_ESC[0], BARRO_ESC[1]]);
    pontos(g, [[12, 18], [12, 19], [13, 17]], BARRO_CL[5]); g.fino(12, 17, BRANCO);
  }, { sombraApoio: [8.1, 14.5, 4.6, 1] });
  // Jarro de barro: bojudo, de boca larga, com duas asas e faixas pintadas.
  item("jarro_barro", (g) => {
    const TINTA = rampa6("#6a2f22", "pedra");
    for (const s of [-1, 1]) curva(g, (t) => [16 + s * (7.5 + 4 * Math.sin(t * Math.PI)), 10.5 + 7 * t], 8, () => 1.25, BARRO_ESC, {});
    torno(g, 16, [[8, 5.6], [10, 5], [12, 6.4], [16, 10.4], [20, 11], [24, 9.2], [27, 6], [28.5, 4.6]], BARRO, {
      rebote: 0.35, pont: true,
      cor: (Y, nx, X) => (Y === 14 || Y === 18 ? TINTA : Y === 16 && (X + 100) % 4 < 2 ? TINTA : null),
    });
    boca(g, 16, 7.8, 6.2, 2.4, BARRO_CL, [BARRO_ESC[0], BARRO_ESC[1]]);
    pontos(g, [[9, 19], [9, 20], [10, 17]], BARRO_CL[5]); g.fino(10, 18, BRANCO);
  }, { sombraApoio: [8.1, 14.5, 5.4, 1.1] });
  // Ânfora: corpo alto de ombro largo e pé estreito, gargalo com duas asas, selo de linho na boca.
  item("anfora", (g) => {
    for (const s of [-1, 1]) curva(g, (t) => [16 + s * (3 + 5.2 * Math.sin(t * Math.PI * 0.9)), 5 + 8 * t], 8, () => 1.2, BARRO_ESC, {});
    torno(g, 16, [[2, 3.4], [3.5, 3], [5, 2.5], [9, 2.7], [12, 7.4], [15, 8.6], [19, 7.6], [24, 4.2], [27, 2.2], [28, 2.8], [29, 2.8]], BARRO, {
      rebote: 0.35, pont: true, cor: (Y) => (Y === 13 || Y === 21 ? BARRO_ESC : Y === 12 ? BARRO_CL : null),
    });
    boca(g, 16, 2.6, 3.4, 1.5, LINHO, [LINHO[2], LINHO[3]]);
    pontos(g, [[11, 15], [11, 16], [11, 17], [12, 14]], BARRO_CL[5]); g.fino(11, 16, BRANCO);
    // marca do oleiro
    pontos(g, [[16, 16], [17, 17], [16, 18], [15, 17]], BARRO_ESC[1]);
  }, { sombraApoio: [8.1, 14.6, 3.6, 0.9] });
  // Lamparina: candeia de barro vista de cima, bico apertado com o pavio aceso, alça atrás.
  item("lamparina", (g) => {
    curva(g, (t) => [6.5 - 3 * Math.sin(t * Math.PI), 17 + 5 * t], 6, () => 1.3, BARRO_ESC, {});
    tubo(g, 20, 21.5, 26.5, 20.5, 3.4, 2.3, BARRO, { rebote: 0.3 });
    bola(g, 14, 21.5, 9, 5.6, BARRO, { rebote: 0.35, esp: "#f6d8b4", dur: 0.985 });
    elipF(g, 13.5, 19.6, 5.6, 2.6, (nx, ny) => (nx * nx + ny * ny > 0.5 ? BARRO_CL[ny < 0 ? 5 : 4] : BARRO_ESC[ny < -0.1 ? 0 : 1]));
    pontos(g, [[12, 20], [13, 20]], "#d9a23a");
    for (let X = 8; X <= 20; X += 3) g.fino(X, 24, BARRO_ESC[2]);
    // pavio e chama
    g.fino(26, 19, "#2a1a14"); g.fino(27, 19, "#2a1a14");
    pontos(g, [[26, 18], [27, 18], [26, 17], [27, 17], [27, 16], [26, 15], [27, 14]], "#f0a030");
    pontos(g, [[26, 17], [26, 16], [27, 15]], "#ffe07a"); g.fino(26, 18, BRANCO); g.fino(25, 17, "#e2662a"); g.fino(28, 17, "#e2662a"); g.fino(28, 18, "#c2452d");
  }, { sombraApoio: [7.6, 14, 5.6, 1], depois: (g) => { for (const [X, Y, a] of [[26, 12, 0.35], [27, 11, 0.22], [24, 16, 0.22], [29, 16, 0.22], [25, 14, 0.25], [28, 13, 0.25]]) g.fino(X, Y, comAlfa("#ffd070", a)); } });
  // Óleo de peixe: cantil baixo de barro com rolha, o óleo dourado escorrendo pela boca.
  item("oleo_peixe", (g) => {
    const OLEO = rampa6("#d8b33a", "metal");
    torno(g, 16, [[11, 3], [13, 3.4], [16, 8.6], [20, 10], [24, 9], [27, 6.2], [28.5, 4.4]], BARRO_ESC, { rebote: 0.35 });
    torno(g, 16, [[9, 3.6], [10, 4], [11.5, 3.6]], BARRO, {});
    torno(g, 16, [[5.5, 2], [6.5, 2.6], [9.5, 2.4]], rampa6("#b48452", "madeira"), {});
    // escorrido de óleo e gota
    pontos(g, [[13, 11], [12, 12], [12, 13], [11, 14], [11, 15], [11, 16], [10, 17], [10, 18], [10, 19]], OLEO[4]);
    pontos(g, [[13, 12], [12, 14], [12, 15], [11, 17], [11, 18], [11, 19], [11, 20], [10, 20]], OLEO[3]); pontos(g, [[10, 21], [11, 21]], OLEO[2]);
    pontos(g, [[11, 15], [10, 18]], BRANCO);
    // peixinho riscado no bojo
    pontos(g, [[15, 21], [16, 20], [17, 20], [18, 20], [19, 21], [18, 22], [17, 22], [16, 22], [20, 20], [21, 19], [20, 22], [21, 23]], BARRO_CL[5]);
    g.fino(16, 21, BARRO_ESC[0]);
  }, { sombraApoio: [8.1, 14.5, 5.2, 1] });
  // Incenso: tacinha de bronze com grãos de olíbano, uma brasa e o fio de fumaça.
  item("incenso", (g) => {
    const GRAO = rampa6("#e2c878", "pedra");
    torno(g, 16, [[19, 9.6], [21, 9], [24, 5], [25.5, 2.4], [27, 2.6], [28.5, 5.2]], BRONZE, { rebote: 0.3, esp: BRANCO, dur: 0.985 });
    boca(g, 16, 19, 9.6, 3.2, BRONZE, [BRONZE[0], BRONZE[1]]);
    for (const [x, y, r] of [[12, 18.6, 2.4], [19.6, 18.4, 2.6], [16, 17, 2.9], [15.4, 19.6, 2], [22.4, 19.4, 1.5]]) bola(g, x, y, r, r * 0.85, GRAO, { esp: BRANCO, dur: 0.98 });
    g.fino(17, 15, "#f0a030"); g.fino(18, 16, "#e2662a"); g.fino(17, 16, "#ffe07a");
  }, {
    sombraApoio: [8.1, 14.5, 4.6, 1],
    depois: (g) => {
      const f = [[17, 13, 0.75], [17, 12, 0.7], [16, 11, 0.7], [15, 10, 0.65], [15, 9, 0.6], [16, 8, 0.6], [17, 7, 0.55], [18, 6, 0.5], [18, 5, 0.45], [17, 4, 0.4], [16, 3, 0.32], [16, 2, 0.22], [16, 10, 0.3], [17, 8, 0.3], [14, 9, 0.25], [19, 5, 0.22], [18, 12, 0.3]];
      for (const [X, Y, a] of f) g.fino(X, Y, comAlfa("#efe8dc", a));
    },
  });
  // Óleo da unção: chifre polido com aros de ouro, tampa e correia; uma gota dourada na ponta.
  item("oleo_uncao", (g) => {
    const CHIFRE = rampa6("#e0d2ac", "pedra"), PONTA = rampa6("#7a5a3a", "pedra");
    const f = (t) => [5 + 18.5 * t - 3.5 * Math.sin(t * Math.PI), 26.5 - 17.5 * t - 5.5 * Math.sin(t * Math.PI) * (1 - t * 0.4)];
    // correia
    let a = [8, 19];
    for (let i = 1; i <= 10; i++) { const t = i / 10, b = [8 + 15 * t, 19 - 12 * t - 6.5 * Math.sin(t * Math.PI)]; linF(g, Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), COURO[(i & 1) ? 2 : 3]); a = b; }
    curva(g, f, 20, (t) => 0.9 + 3.1 * Math.pow(t, 0.8), CHIFRE, {
      rebote: 0.4, esp: BRANCO, dur: 0.99,
      cor: (t) => (t < 0.16 ? PONTA : Math.abs(t - 0.5) < 0.035 || Math.abs(t - 0.86) < 0.04 ? OURO : null),
      tex: (X, Y, t) => (hash2(Math.round(t * 24), 2, 9) > 0.78 ? -0.25 : 0),
    });
    const b = f(1);
    bola(g, b[0] + 0.4, b[1] - 0.4, 3.9, 3.5, OURO, { esp: BRANCO, rebote: 0.3 });
    bola(g, b[0] + 2, b[1] - 2.4, 1.7, 1.7, OURO, { esp: BRANCO });
    pontos(g, [[4, 28], [4, 29]], OURO[4]); g.fino(3, 29, BRANCO);
  }, { sombraApoio: [8, 14.4, 5.4, 1] });

  // ===================================================================
  // 5. COMIDA E ERVAS
  // ===================================================================
  // Peixe de lado, cabeça à direita. o = { cx, cy, rx, ry, R (dorso), Rv (ventre), listras, cauda }
  function peixe(g, o) {
    const { cx, cy, rx, ry, R, Rv } = o, xr = cx - rx;
    const Rn = o.Rn || R;
    // cauda bifurcada com raios
    const cw = o.cauda || 5;
    poli(g, [[xr + 2.5, cy - 1.4], [xr - cw + 0.5, cy - cw], [xr - cw * 0.45, cy], [xr - cw + 0.5, cy + cw], [xr + 2.5, cy + 1.4]], (X, Y) => Rn[(Y < cy - 0.5 ? 4 : 2) - ((X + Y) % 2 ? 1 : 0)]);
    // nadadeira dorsal e ventral
    poli(g, [[cx - rx * 0.45, cy - ry * 0.75], [cx - rx * 0.1, cy - ry - 2.6], [cx + rx * 0.35, cy - ry - 1.2], [cx + rx * 0.5, cy - ry * 0.6]], (X) => Rn[(X % 2) ? 3 : 2]);
    poli(g, [[cx - rx * 0.2, cy + ry * 0.7], [cx - rx * 0.3, cy + ry + 2.2], [cx + rx * 0.15, cy + ry * 0.8]], Rn[2]);
    bola(g, cx, cy, rx, ry, R, {
      rebote: 0.3, plano: 0.9,
      so: (X, Y, nx, ny) => Math.abs(ny) <= Math.pow(Math.max(0, 1 - Math.pow(Math.abs(nx), 2.4 - (nx < 0 ? 0.9 : 0))), 0.5) + 0.02,
      cor: (X, Y, nx, ny) => (ny > 0.3 ? Rv : null),
      tex: (X, Y, nx, ny) => {
        if (nx > 0.5) return 0.1;
        let d = 0;
        if (o.listras && Math.floor((X - Y * 0.5) / 2) % 2 === 0 && ny < 0.25) d -= 0.5;
        if (ny < 0.3 && ((X + (Y % 2) * 2) % 4 === 0)) d += o.escama === undefined ? 0.55 : o.escama;
        return d;
      },
    });
    // opérculo, olho, boca, nadadeira peitoral
    const gx = Math.round(cx + rx * 0.48);
    for (let Y = Math.round(cy - ry * 0.55); Y <= Math.round(cy + ry * 0.5); Y++) matiz(g, gx - (Math.abs(Y - cy) > ry * 0.3 ? 1 : 0), Y, 0.4);
    const ox = Math.round(cx + rx * 0.7), oy = Math.round(cy - ry * 0.3);
    g.fino(ox, oy, o.olho || "#1c1210"); g.fino(ox - 1, oy, "#f2e8c8"); g.fino(ox, oy - 1, "#f2e8c8");
    matiz(g, Math.round(cx + rx) - 1, Math.round(cy + ry * 0.15), 0.55);
    poli(g, [[gx - 1.5, cy + 0.5], [gx - 5, cy + 3.2], [gx - 1.5, cy + 2.6]], Rn[1]);
  }
  // Peixe fresco: tilápia do lago, dorso verde-azulado e ventre de prata.
  item("peixe", (g) => {
    peixe(g, { cx: 17.5, cy: 19, rx: 9.5, ry: 5.6, R: rampa6("#4f9aa0", "metal"), Rv: rampa6("#d9dcc8", "metal"), Rn: rampa6("#3a7880", "pano") });
    pontos(g, [[14, 15], [15, 15], [17, 15]], BRANCO);
  }, { sombraApoio: [8.4, 13.6, 6, 1.1] });
  // Peixe grande: barbo comprido e listrado, de dorso azul-escuro.
  item("peixe_grande", (g) => {
    peixe(g, { cx: 18, cy: 18, rx: 11.6, ry: 6.6, cauda: 6, listras: true, R: rampa6("#3f7fa6", "metal"), Rv: rampa6("#e2dcc4", "metal"), Rn: rampa6("#2f5e80", "pano") });
    pontos(g, [[13, 13], [14, 13], [16, 13], [19, 13]], BRANCO);
    pontos(g, [[28, 20], [29, 21]], "#2f5e80");
  }, { sombraApoio: [8.6, 13.6, 6.8, 1.2] });
  // Peixe seco: aberto e salgado, cor de palha, pendurado num cordão pelo rabo.
  item("peixe_seco", (g) => {
    const SECO = rampa6("#c9a868", "pedra"), SECO2 = rampa6("#e6d4a0", "pedra");
    peixe(g, { cx: 17.5, cy: 19.5, rx: 9.6, ry: 4.8, R: SECO, Rv: SECO2, Rn: rampa6("#a8844a", "pedra"), escama: 0, olho: "#6a4a2a" });
    // cortes da salga e cristais de sal
    for (const X of [12, 15, 18]) { matiz(g, X, 18, 0.45); matiz(g, X + 1, 19, 0.45); matiz(g, X + 1, 20, 0.45); }
    pontos(g, [[13, 17], [17, 17], [20, 19], [11, 20], [16, 21]], BRANCO);
    // cordão
    linF(g, 6, 15, 9, 6, CORDA[3]); linF(g, 5, 23, 4, 10, CORDA[2]); pontos(g, [[9, 5], [8, 4], [4, 9], [5, 8], [6, 6], [7, 5]], CORDA[4]);
  }, { sombraApoio: [8.4, 13.8, 6, 1] });
  // Peixe defumado: tostado e lustroso, espetado num graveto, ainda soltando fumaça.
  item("peixe_defumado", (g) => {
    linF(g, 2, 22, 30, 17, MADEIRA[2]); linF(g, 2, 21, 30, 16, MADEIRA[4]);
    peixe(g, { cx: 17, cy: 19, rx: 10, ry: 5.4, R: rampa6("#8a5226", "metal"), Rv: rampa6("#b97e3e", "metal"), Rn: rampa6("#5a3418", "pedra"), escama: 0.3, olho: "#2a1a14" });
    for (const X of [11, 14, 17, 20]) { matiz(g, X, 17, 0.45); matiz(g, X, 18, 0.5); matiz(g, X + 1, 19, 0.45); matiz(g, X + 1, 20, 0.4); }
    pontos(g, [[12, 15], [13, 15], [16, 15], [19, 16]], "#f6d8a0");
    pontos(g, [[29, 16], [30, 16]], MADEIRA[4]);
  }, {
    sombraApoio: [8.4, 13.8, 6.2, 1],
    depois: (g) => { for (const [X, Y, a] of [[12, 11, 0.6], [12, 10, 0.55], [13, 9, 0.5], [13, 8, 0.45], [12, 7, 0.4], [12, 6, 0.3], [19, 10, 0.55], [20, 9, 0.5], [20, 8, 0.45], [19, 7, 0.4], [19, 6, 0.32], [20, 5, 0.22], [13, 5, 0.2]]) g.fino(X, Y, comAlfa("#e8e0d4", a)); },
  });
  // Erva medicinal: maço de hissopo amarrado, três ramos de folhas miúdas e florzinhas claras.
  item("erva", (g) => {
    const V = rampa6("#6f8a3c", "folha"), V2 = rampa6("#8aa04a", "folha");
    const ramo = (bx, by, tx, ty, curv, R, flor) => {
      const f = (t) => [lerp(bx, tx, t) + curv * Math.sin(t * Math.PI), lerp(by, ty, t)];
      for (let i = 1; i <= 7; i++) {
        const t = i / 7.4, [x, y] = f(t), s = i % 2 ? 1 : -1, dx = (tx - bx) * 0.08;
        const fx = x + s * 2.6 - dx, fy = y - 1.2;
        tubo(g, x, y, fx, fy, 1.15, 0.7, R, { vies: s < 0 ? 0.25 : -0.15 });
      }
      curva(g, f, 8, () => 0.6, rampa6("#55682c", "folha"), {});
      const [x, y] = f(1);
      if (flor) { pontos(g, [[Math.round(x), Math.round(y) - 1], [Math.round(x) - 1, Math.round(y)], [Math.round(x) + 1, Math.round(y)]], "#f4ecd8"); g.fino(Math.round(x), Math.round(y), "#e6c85a"); }
      else bola(g, x, y - 0.5, 1.4, 1.8, R, {});
    };
    ramo(14.5, 23, 6.5, 8, -1.5, V, true);
    ramo(17.5, 23, 25, 9, 1.5, V, true);
    ramo(16, 23, 16, 4.5, 0.6, V2, true);
    // talos e amarra
    tubo(g, 16, 22, 15.5, 28.5, 1.9, 1.5, rampa6("#55682c", "folha"), {});
    pontos(g, [[14, 23], [15, 23], [16, 23], [17, 23], [14, 24], [15, 24]], CORDA[4]); pontos(g, [[16, 24], [17, 24], [18, 24], [18, 25], [19, 26]], CORDA[2]);
  }, { sombraApoio: [8, 14.6, 4, 0.9] });
  // Odre de água: pele de cabra costurada, bojuda, gargalo amarrado com rolha e alça de couro.
  item("odre_agua", (g) => {
    const PELE = rampa6("#96623a", "couro");
    // alça
    const al = (t) => [(1 - t) * (1 - t) * 22 + 2 * t * (1 - t) * 7 + t * t * 5.5, (1 - t) * (1 - t) * 10 + 2 * t * (1 - t) * 0.5 + t * t * 18];
    curva(g, al, 14, () => 1.05, COURO_ESC, {});
    // gargalo e rolha
    tubo(g, 19, 13, 24, 7, 3.1, 2.1, PELE, {});
    bola(g, 25.2, 5.4, 2.1, 2.1, rampa6("#c09458", "madeira"), {});
    // pernas amarradas (as patas da pele)
    tubo(g, 8, 24, 4.5, 27, 2.2, 1.3, PELE, {}); tubo(g, 23, 25, 26.5, 27.5, 2.2, 1.3, PELE, {});
    pontos(g, [[5, 25], [6, 26]], CORDA[4]); pontos(g, [[25, 26], [26, 25]], CORDA[3]);
    bola(g, 15.5, 20, 10, 7.8, PELE, { rebote: 0.4, esp: "#f6dcb4", dur: 0.985 });
    // costura da barriga e rugas junto ao gargalo
    for (let i = 0; i < 9; i++) { const X = 8 + i * 2, Y = Math.round(23.4 + Math.sin((i / 8) * Math.PI) * 2.6); if (g.gf(X, Y)) { g.fino(X, Y, PELE[5]); matiz(g, X, Y + 1, 0.3); } }
    for (const [X, Y] of [[17, 15], [18, 16], [20, 16], [21, 17]]) matiz(g, X, Y, 0.3);
    // amarra do gargalo
    for (const [X, Y] of [[18, 10], [19, 11], [20, 12], [21, 13], [22, 13]]) g.fino(X, Y, CORDA[X < 20 ? 5 : 3]);
    pontos(g, [[22, 14], [22, 15]], "#7fc4d8"); g.fino(22, 16, "#cfeaf2");
  }, { sombraApoio: [7.8, 14.2, 5.8, 1.1] });

  // ===================================================================
  // 6. RECURSOS DOS OFÍCIOS
  // ===================================================================
  // Madeira: três toras de acácia empilhadas, casca rachada, topo com os anéis à mostra.
  item("madeira", (g) => {
    const MIOLO = rampa6("#d2a364", "madeira"), CASCA2 = rampa6("#76553a", "madeira");
    const tora = (x0, y, comp, r) => {
      tubo(g, x0, y, x0 + comp, y - 1.2, r, r, CASCA2, {
        reto: true, vies: 0.15,
        tex: (X, Y, t, lado) => (hash2(X >> 1, Math.round(lado * 2.5), 17) > 0.62 ? -0.4 : hash2(X, Y, 3) > 0.9 ? 0.4 : 0),
      });
      const cx = x0 + comp, cy = y - 1.2;
      elipF(g, cx, cy, r * 0.62, r, (nx, ny) => { const d = Math.hypot(nx, ny); return d > 0.82 ? CASCA[2] : d > 0.55 ? MIOLO[3] : d > 0.3 ? MIOLO[4] : MIOLO[2]; });
      g.fino(Math.round(cx - 0.5), Math.round(cy - 0.5), MIOLO[1]);
      elipF(g, x0, y, r * 0.5, r, (nx, ny) => CASCA[ny < 0 ? 2 : 0]);
    };
    tora(5, 24.5, 17, 3.6);
    tora(8.5, 23.5, 18.5, 3.7);
    tora(7, 16.5, 17.5, 3.9);
    pontos(g, [[11, 14], [12, 14], [15, 13], [18, 13]], CASCA[5]);
  }, { sombraApoio: [8.4, 14.2, 6.4, 1.1] });
  // Argila do Nilo: torrão úmido amassado, com a marca dos dedos e o brilho da água.
  item("argila", (g) => {
    const ARG = rampa6("#a8623e", "pedra");
    bola(g, 16, 22.5, 11, 6, ARG, { rebote: 0.3, pont: true });
    bola(g, 11.5, 19.5, 6, 5, ARG, { rebote: 0.2, pont: true });
    bola(g, 19.5, 17, 7, 6, ARG, { rebote: 0.25, pont: true, esp: "#ffd9b8", dur: 0.985 });
    // dedadas
    for (const [x, y] of [[18, 18], [21.5, 20], [13, 21.5]]) { elipF(g, x, y, 1.8, 1.3, ARG[1]); matiz(g, Math.round(x), Math.round(y) + 1, -0.3); }
    pontos(g, [[9, 17], [10, 16], [16, 13], [17, 13]], "#f0c094"); g.fino(15, 14, BRANCO);
    pontos(g, [[7, 25], [24, 26], [26, 22]], ARG[1]);
    pontos(g, [[5, 27], [28, 25]], ARG[3]);
  }, { sombraApoio: [8.2, 14.2, 6.2, 1.1] });
  // Minério de cobre: pedra facetada com veios alaranjados de cobre nativo e manchas de malaquita.
  item("minerio_cobre", (g) => {
    const ROCHA = rampa6("#77706c", "pedra"), VEIO = rampa6("#d07a34", "metal"), MALAQ = rampa6("#3fa66a", "pedra");
    const facetas = [[9, 12, 0.75], [16, 9, 0.95], [23, 12, 0.35], [8, 19, 0.2], [15, 17, 0.5], [22, 19, -0.15], [12, 25, -0.45], [20, 25, -0.75], [26, 22, -0.6]];
    poli(g, [[6, 13], [10, 8], [17, 5.5], [23, 7.5], [27.5, 13], [28.5, 21], [25, 26.5], [18, 28.5], [9, 28], [4.5, 22.5]], (X, Y) => {
      let m = 1e9, m2 = 1e9, l = 0;
      for (const [fx, fy, fl] of facetas) { const d = (X - fx) ** 2 + (Y - fy) ** 2 * 1.3; if (d < m) { m2 = m; m = d; l = fl; } else if (d < m2) m2 = d; }
      if (Math.sqrt(m2) - Math.sqrt(m) < 0.75) return ROCHA[l > 0.3 ? 5 : 1]; // aresta entre facetas
      return sombrear(ROCHA, l + (hash2(X, Y, 8) - 0.5) * 0.35, X, Y, false);
    });
    // veios de cobre e malaquita
    const veio = (lista) => lista.forEach(([X, Y], i) => { g.fino(X, Y, VEIO[i % 3 === 0 ? 5 : 4]); g.fino(X + 1, Y + 1, VEIO[2]); });
    veio([[9, 15], [10, 16], [11, 16], [12, 17], [13, 19], [14, 20], [15, 20]]);
    veio([[18, 9], [19, 10], [19, 11], [20, 12], [21, 14], [22, 15]]);
    veio([[17, 23], [18, 24], [20, 23], [21, 22]]);
    g.fino(10, 15, BRANCO); g.fino(19, 9, BRANCO);
    for (const [x, y] of [[23.5, 19], [11, 23.5]]) { elipF(g, x, y, 1.8, 1.4, (nx, ny) => MALAQ[ny < -0.2 ? 5 : nx > 0.3 ? 2 : 3]); }
  }, { sombraApoio: [8.3, 14.2, 6, 1.2] });
  // Resina de acácia: lágrimas de âmbar translúcido, com a luz atravessando até o outro lado.
  item("resina", (g) => {
    const AMB = rampa6("#d9902a", "metal");
    const gota = (cx, cy, rx, ry, bico) => {
      if (bico) poli(g, [[cx - rx * 0.55, cy - ry * 0.6], [cx - 0.4, cy - ry - bico], [cx + 0.6, cy - ry - bico], [cx + rx * 0.55, cy - ry * 0.6]], (X) => AMB[X < cx ? 4 : 2]);
      bola(g, cx, cy, rx, ry, AMB, {
        // translúcida: escurece no miolo de cima e acende do lado oposto à luz
        tex: (X, Y, nx, ny) => { const d = nx * 0.55 + ny * 0.8; return d > 0.25 ? 0.95 + d * 0.5 : -0.25; },
      });
      const hx = Math.round(cx - rx * 0.45), hy = Math.round(cy - ry * 0.5);
      g.fino(hx, hy, BRANCO); g.fino(hx + 1, hy - 1, BRANCO); if (rx > 4) g.fino(hx - 1, hy + 1, "#ffe9b0");
      if (rx > 4) pontos(g, [[Math.round(cx + rx * 0.4), Math.round(cy + ry * 0.45)], [Math.round(cx + rx * 0.2), Math.round(cy + ry * 0.6)]], "#ffe07a");
    };
    gota(13.5, 19.5, 7.4, 8, 3.5);
    gota(23.5, 23.5, 4.4, 4.6, 2);
    gota(22.5, 12.5, 2.6, 2.8, 1.2);
    pontos(g, [[11, 22], [15, 24]], AMB[1]);
  }, { sombraApoio: [8.4, 14.3, 5.8, 1.1] });
  // Lingote de bronze: lingote "pele de boi" da Idade do Bronze, com as quatro alças e a marca da fundição.
  item("lingote_bronze", (g) => {
    const BR = rampa6("#c98a30", "metal");
    // barra em tronco de pirâmide vista do alto: tampo claro, frente média, topo direito escuro
    const barra = (x, y, w, brilho) => {
      poli(g, [[x, y + 3], [x + w, y + 3], [x + w + 1.5, y + 8], [x - 1.5, y + 8]], (X, Y) => sombrear(BR, -0.25 - (Y - y - 3) * 0.14 + (hash2(X >> 1, Y, 3) > 0.8 ? 0.3 : 0), X, Y, false));
      poli(g, [[x + w, y + 3], [x + w + 3, y], [x + w + 4.5, y + 5], [x + w + 1.5, y + 8]], (X, Y) => BR[Y < y + 3 ? 1 : 0]);
      poli(g, [[x + 3, y], [x + w + 3, y], [x + w, y + 3], [x, y + 3]], (X, Y) => (Y === Math.floor(y) ? BR[5] : sombrear(BR, 0.7 - (X - x) * 0.03 + (hash2(X >> 1, Y, 9) > 0.75 ? -0.35 : 0), X, Y, false)));
      for (let X = Math.ceil(x); X < x + w; X++) g.fino(X, Math.floor(y + 3), BR[5]);
      if (brilho) faisca(g, Math.round(x + 4), Math.round(y + 1), BRANCO, true);
    };
    barra(3.5, 17.5, 14);
    barra(12.5, 19.5, 14);
    barra(7.5, 10.5, 15, true);
    // marca da fundição no tampo de cima
    pontos(g, [[15, 12], [17, 12], [16, 11]], BR[1]);
  }, { sombraApoio: [8.4, 14, 6.6, 1.1] });
  // Tecido de linho: três peças dobradas e empilhadas, cada dobra arredondada, ourela de anil.
  item("tecido_linho", (g) => {
    for (let i = 2; i >= 0; i--) {
      const y = 9 + i * 6, x0 = 5 + (i === 1 ? 1 : 0), x1 = 27 - (i === 1 ? 0 : 1);
      // lombada da dobra (frente) e o plano de cima
      poli(g, [[x0, y + 2], [x1, y + 2], [x1, y + 7.5], [x0, y + 7.5]], (X, Y) => {
        const v = (Y - (y + 2)) / 5.5;
        if (X >= x1 - 3 && X < x1 - 1) return ANIL[v < 0.4 ? 4 : 2];
        return sombrear(LINHO, 0.45 - v * 1.5 - (X - 16) * 0.012, X, Y, false);
      });
      poli(g, [[x0 + 2.5, y - 2], [x1 + 0.5, y - 2], [x1, y + 2], [x0, y + 2]], (X, Y) => {
        if (X >= x1 - 3 + (y + 2 - Y) * 0.1 && X < x1 - 1) return ANIL[5];
        return sombrear(LINHO_BR, 0.8 - (X - x0) * 0.02 + (((X + Y * 2) % 5) === 0 ? -0.35 : 0), X, Y, false);
      });
      for (let X = x0; X < x1; X++) if (g.gf(X, Math.floor(y + 7))) g.fino(X, Math.floor(y + 7), LINHO[1]);
    }
  }, { sombraApoio: [8.1, 14.5, 6, 0.9] });
  // Linho egípcio: peça de linho fino e alvo enrolada, a ponta solta estendida com barra de anil e fio de
  // ouro, atada com duas fitas douradas.
  item("linho_egipcio", (g) => {
    const ALVO = rampa6("#e4dcc6", "pano");
    // a ponta desenrolada, estendida no chão à frente do rolo, com a barra bordada
    const aba = [[5, 21.5], [21, 18.5], [27.5, 24.5], [11.5, 28.5]];
    poli(g, aba, (X, Y, den) => {
      const beira = !den(X, Y + 1) || !den(X + 1, Y + 1);
      const v = (Y - 21.5) - (X - 5) * 0.19 + (X - 5) * 0.0;   // distância da dobra de cima
      const u = (X - 5) + (Y - 21.5) * -0.9;                      // ao longo da barra
      if (beira) return OURO[Math.floor(u) % 2 ? 4 : 2];
      if (!den(X, Y + 2) || !den(X + 1, Y + 2)) return ANIL[3];
      if (!den(X, Y + 3) || !den(X + 1, Y + 3)) return ANIL[4];
      return sombrear(ALVO, 0.75 - (X - 4) * 0.025 + (Math.floor(u / 4) % 2 ? -0.18 : 0), X, Y, false);
    });
    tubo(g, 7.5, 16.5, 22, 13.5, 6, 6, ALVO, {
      reto: true, rebote: 0.35, vies: 0.22,
      cor: (t) => (Math.abs(t - 0.3) < 0.055 || Math.abs(t - 0.72) < 0.055 ? OURO : null),
      tex: (X, Y, t, lado) => (Math.abs(lado - 0.15) < 0.09 || Math.abs(lado + 0.45) < 0.07 ? -0.22 : 0),
    });
    elipF(g, 7.5, 16.5, 2.6, 6, (nx, ny) => ALVO[ny < -0.2 ? 3 : 1]);
    // topo do rolo: as voltas finas do pano
    elipF(g, 22, 13.5, 3.9, 6, (nx, ny) => { const d = Math.hypot(nx, ny), v = Math.floor(d * 4.4); return d > 0.86 ? ALVO[5] : v % 2 ? ALVO[nx + ny < 0 ? 4 : 3] : ALVO[nx + ny < 0 ? 2 : 1]; });
    g.fino(21, 13, ALVO[0]); g.fino(22, 13, ALVO[0]);
  }, { sombraApoio: [8.2, 14.4, 6.2, 1.1] });
  // Couro grosso: couro curtido enrolado, a flor escura por fora e o carnal claro na espiral, atado por tiras.
  item("couro_grosso", (g) => {
    const FLOR = rampa6("#7a4c30", "couro"), CARNAL = rampa6("#c9a472", "couro");
    tubo(g, 7, 19.5, 22, 16.5, 6.6, 6.6, FLOR, {
      reto: true, rebote: 0.35,
      cor: (t) => (Math.abs(t - 0.3) < 0.06 || Math.abs(t - 0.72) < 0.06 ? CORDA : null),
      tex: (X, Y, t, lado) => (hash2(X >> 1, Y >> 1, 6) > 0.84 ? -0.3 : 0),
    });
    elipF(g, 7, 19.5, 2.8, 6.6, (nx, ny) => FLOR[ny < -0.2 ? 3 : 1]);
    // topo do rolo: as voltas do couro, carnal claro e flor escura
    elipF(g, 22, 16.5, 4.2, 6.6, (nx, ny) => { const d = Math.hypot(nx, ny); return d > 0.84 ? FLOR[2] : d > 0.48 ? CARNAL[nx + ny < 0 ? 4 : 3] : d > 0.2 ? FLOR[0] : CARNAL[2]; });
    // a beira do couro, levantada
    pontos(g, [[21, 10], [22, 10], [23, 10], [24, 11]], CARNAL[4]);
    pontos(g, [[10, 14], [12, 13], [17, 12]], FLOR[5]);
  }, { sombraApoio: [8, 14.3, 6.2, 1.1] });

  // ===================================================================
  // 7. SAQUES DAS CRIATURAS
  // ===================================================================
  // Pele de lobo: couro aberto com as quatro patas, a cauda e a máscara, pelo cinza com a risca do lombo.
  item("pele_lobo", (g) => {
    const PELO = rampa6("#857868", "pelo"), LOMBO = rampa6("#5e5348", "pelo"), CLARO = rampa6("#b8aa94", "pelo");
    const FORMA = [[10.6, 3], [13.8, 5.6], [14.6, 2], [17.4, 2], [18.2, 5.6], [21.4, 3], [20.6, 8], [19.5, 9.8], [23, 10.5], [28, 8], [29, 11], [24.5, 14.5], [24.5, 19], [29, 23], [27.5, 26], [22.5, 23], [18.5, 24], [17.5, 29.5], [14.5, 29.5], [13.5, 24], [9.5, 23], [4.5, 26], [3, 23], [7.5, 19], [7.5, 14.5], [3, 11], [4, 8], [9, 10.5], [12.5, 9.8], [11.4, 8]];
    poli(g, FORMA, (X, Y, den) => {
      const borda = !den(X + 1, Y) || !den(X, Y + 1) || !den(X - 1, Y) || !den(X, Y - 1);
      const lombo = Math.abs(X - 15.5) < 2.2 - (Y > 22 ? 1 : 0) && Y > 8;
      const pelo = hash2(X, Y >> 1, 23);
      if (borda && pelo > 0.45) return CLARO[4];
      const R = lombo ? LOMBO : Math.abs(X - 15.5) > 7 || Y > 24 ? CLARO : PELO;
      return sombrear(R, 0.35 - (X - 15.5) * 0.045 - (Y - 16) * 0.03 + (pelo > 0.7 ? 0.45 : pelo < 0.25 ? -0.4 : 0), X, Y, false);
    });
    // máscara: orelhas por dentro, olhos vazios e focinho
    pontos(g, [[12, 5], [12, 6], [19, 5], [19, 6]], LOMBO[1]); pontos(g, [[13, 8], [18, 8]], "#2a1a14"); pontos(g, [[15, 2], [16, 2]], "#2a1a14"); pontos(g, [[15, 3], [16, 3], [15, 4], [16, 4], [15, 5], [16, 5]], CLARO[4]); pontos(g, [[14, 7], [17, 7]], CLARO[5]);
  }, { sombraApoio: [8, 14.6, 6.2, 0.9] });
  // Presa de lobo: canino comprido e curvo de marfim, ponta fina, raiz ocre com o sulco da gengiva.
  item("presa_lobo", (g) => {
    const MARFIM = rampa6("#e9dfc4", "pedra"), RAIZ = rampa6("#b98a58", "pedra");
    const P0 = [8.5, 7.5], P1 = [11, 24], P2 = [26, 25.5];
    const f = (t) => [(1 - t) * (1 - t) * P0[0] + 2 * t * (1 - t) * P1[0] + t * t * P2[0], (1 - t) * (1 - t) * P0[1] + 2 * t * (1 - t) * P1[1] + t * t * P2[1]];
    curva(g, f, 22, (t) => (t < 0.12 ? 3.2 + t * 8 : 4.2 * Math.pow(1 - (t - 0.12) / 0.88, 0.8) + 0.35), MARFIM, {
      rebote: 0.3, esp: BRANCO, dur: 0.988,
      cor: (t) => (t < 0.24 ? RAIZ : null),
      tex: (X, Y, t, lado) => (t > 0.24 && t < 0.29 ? -0.55 : t < 0.24 && hash2(X, Y, 9) > 0.7 ? -0.3 : 0),
    });
    // topo da raiz, partido em duas pontas
    pontos(g, [[8, 4], [9, 4], [5, 6], [6, 5]], RAIZ[2]); g.fino(7, 5, RAIZ[0]);
    // estrias do esmalte ao longo do dente
    for (const t of [0.42, 0.5, 0.58, 0.66]) { const [x, y] = f(t); matiz(g, Math.round(x - 0.5), Math.round(y + 0.6), 0.16); }
  }, { sombraApoio: [8.6, 14.2, 5.2, 1] });
  // Ferrão de escorpião: dois anéis da cauda, o bulbo do veneno e o aguilhão grande em gancho, negro na
  // ponta, com a gota verde.
  item("ferrao_escorpiao", (g) => {
    const QUIT = rampa6("#c28a38", "metal"), MEIO_T = rampa6("#7a4420", "metal"), ESC = rampa6("#33201a", "pedra");
    // anéis: placas achatadas, com a junta escura entre elas
    const anel = (x, y, rx, ry) => { bola(g, x + 0.8, y + 1, rx + 0.3, ry + 0.3, ESC, {}); bola(g, x, y, rx, ry, QUIT, { rebote: 0.35, esp: "#fff0c8", dur: 0.985, tex: (X, Y, nx, ny) => (Math.abs(nx - ny) < 0.16 ? -0.45 : 0) }); };
    anel(5, 26.5, 2.7, 2.5);
    anel(8, 22.5, 3.2, 2.9);
    // aguilhão: espinho escuro e lustroso que sai do alto do bulbo, sobe, e cai em gancho afiado
    const P0 = [15.5, 12.5], P1 = [30.5, 1], P2 = [25.5, 22.5];
    const f = (t) => [(1 - t) * (1 - t) * P0[0] + 2 * t * (1 - t) * P1[0] + t * t * P2[0], (1 - t) * (1 - t) * P0[1] + 2 * t * (1 - t) * P1[1] + t * t * P2[1]];
    curva(g, f, 24, (t) => 2.7 * Math.pow(1 - t, 0.7) + 0.45, MEIO_T, { cor: (t) => (t > 0.5 ? ESC : null), esp: "#ffe2b0", dur: 0.975, rebote: 0.3 });
    // bulbo do veneno, com a junta escura onde nasce o aguilhão
    bola(g, 13.4, 17.4, 5.9, 5.3, ESC, {});
    bola(g, 12.6, 16.6, 5.8, 5.2, QUIT, { rebote: 0.4, esp: BRANCO, dur: 0.974, tex: (X, Y, nx, ny) => (nx - ny > 1.02 ? -0.9 : Math.abs(nx * 0.7 + ny * 0.2 - 0.2) < 0.07 ? -0.35 : 0) });
    pontos(g, [[10, 22], [14, 22]], ESC[2]);
    pontos(g, [[25, 24], [25, 25]], "#9ccc3a"); g.fino(25, 26, "#d8f08a");
  }, { sombraApoio: [8, 14.3, 5.8, 1] });
  // Ponta de lança de bronze: folha larga com nervura, alvado com o cravo e um toco da haste quebrada.
  item("ponta_lanca", (g) => {
    const BR = rampa6("#c98f34", "metal");
    const a = emS(-7.5), b = emS(-2);
    tubo(g, a[0], a[1], b[0], b[1], 1.5, 1.5, MADEIRA, {});
    pontos(g, [[Math.floor(a[0]) - 1, Math.floor(a[1]) + 1], [Math.floor(a[0]) - 2, Math.floor(a[1])], [Math.floor(a[0]) - 1, Math.floor(a[1]) - 1]], MADEIRA[5]);
    lamina(g, BR, 24, (s) => (s < 6 ? 0 : s < 11 ? (s - 6) * 0.86 + 0.4 : Math.max(0.3, 4.7 * (1 - (s - 11) / 13.6))), { folha: true });
    const c = emS(-3), d = emS(7.5);
    tubo(g, c[0], c[1], d[0], d[1], 2.3, 1.2, BR, { esp: BRANCO, dur: 0.985 });
    // aro e cravo do alvado
    const e1 = emS(-2.6, -2), e2 = emS(-2.6, 2);
    linF(g, Math.round(e1[0]), Math.round(e1[1]), Math.round(e2[0]), Math.round(e2[1]), BR[1]);
    const r = emS(1); g.fino(Math.floor(r[0]), Math.floor(r[1]), BR[0]); g.fino(Math.floor(r[0]) - 1, Math.floor(r[1]) - 1, BRANCO);
    const fz = emS(13, -2.6); faisca(g, Math.floor(fz[0]), Math.floor(fz[1]), BRANCO, true);
  }, { sombraApoio: [8.4, 14.3, 5.2, 1] });
  // Bracelete de cobre: aro aberto e grosso, pontas em botão, riscos gravados e um toque de azinhavre.
  item("bracelete_cobre", (g) => {
    const CB = rampa6("#c46f33", "metal");
    const cx = 16, cy = 17, rx = 9.6, ry = 6.6;
    const f = (t) => { const a = Math.PI * (0.64 + t * 1.72); return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; };
    curva(g, f, 30, (t) => 1.7 + 0.5 * Math.sin(Math.PI * t), CB, {
      esp: BRANCO, dur: 0.975, rebote: 0.45,
      tex: (X, Y, t) => (t > 0.3 && t < 0.7 && Math.round(t * 44) % 3 === 0 ? -0.5 : 0),
    });
    const p0 = f(0), p1 = f(1);
    bola(g, p0[0], p0[1], 2.7, 2.7, CB, { esp: BRANCO, rebote: 0.3 }); bola(g, p1[0], p1[1], 2.7, 2.7, CB, { esp: BRANCO, rebote: 0.3 });
    pontos(g, [[7, 15], [8, 14]], "#4fb98a"); g.fino(24, 20, "#3fa66a");
  }, { sombraApoio: [8, 13.8, 5.8, 1.1] });
  // Pena de ave de rapina: raque clara, barbas castanhas com barras escuras e a ponta rasgada.
  item("pena_ave", (g) => {
    const CAST = rampa6("#8a6038", "pelo"), BARRA = rampa6("#4a2e18", "pelo"), CREME = rampa6("#e6d8b4", "pelo");
    const f = (t) => [5.5 + 21 * t + 2.2 * Math.sin(t * Math.PI), 27 - 22.5 * t + 2.2 * Math.sin(t * Math.PI)];
    for (let Y = 0; Y < 32; Y++) for (let X = 0; X < 32; X++) {
      // ponto mais próximo da raque
      let m = 1e9, tm = 0, lado = 0;
      for (let i = 0; i <= 40; i++) { const t = i / 40, [x, y] = f(t), d = Math.hypot(X + 0.5 - x, Y + 0.5 - y); if (d < m) { m = d; tm = t; lado = (X + 0.5 - x) + (Y + 0.5 - y); } }
      if (tm < 0.2 || tm >= 1) continue;
      const u = (tm - 0.2) / 0.8, larg = (lado < 0 ? 4.6 : 3.6) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.7) + 0.3;
      if (m > larg) continue;
      // falhas entre as barbas
      if (m > larg - 1.3 && hash2(Math.round(tm * 26), lado < 0 ? 1 : 2, 5) > 0.72) continue;
      const barra = Math.floor(u * 6.5 + m * 0.12) % 2 === 1 && u > 0.12;
      const R = u < 0.16 ? CREME : barra ? BARRA : CAST;
      g.fino(X, Y, sombrear(R, (lado < 0 ? 0.5 : -0.25) - m * 0.08 + (Math.round(tm * 40) % 3 === 0 ? -0.25 : 0), X, Y, false));
    }
    curva(g, f, 20, (t) => (t < 0.2 ? 0.95 : 0.55), CREME, {});
    g.fino(5, 27, CREME[2]);
  }, { sombraApoio: [8.2, 14.3, 5, 0.9] });
  // Carapaça: casco abaulado visto de cima, placas grandes no lombo, placas menores nos flancos, aro de
  // placas da beirada e o brilho do casco polido.
  item("carapaca", (g) => {
    const CASCO = rampa6("#a8763a", "pedra"), PLACA = rampa6("#7c5a2c", "pedra"), BEIRA = rampa6("#6a4420", "pedra"), SULCO = "#3a2414";
    bola(g, 16, 19.6, 12.2, 8.6, BEIRA, { rebote: 0.3 });
    const cx = 16, cy = 17, rx = 11.8, ry = 8.2;
    bola(g, cx, cy, rx, ry, CASCO, {
      rebote: 0.3, esp: "#fff2cc", dur: 0.978, plano: 0.8,
      cor: (X, Y, nx, ny) => {
        const r = Math.hypot(nx, ny);
        if (r > 0.8) return BEIRA;
        const lombo = Math.abs(nx) < 0.3;
        const fila = Math.floor((ny + (lombo ? 1 : 1.3)) * 1.7);
        return (fila + (lombo ? 0 : 1)) % 2 === 0 ? PLACA : null;
      },
      tex: (X, Y, nx, ny) => {
        const r = Math.hypot(nx, ny);
        if (r > 0.8) return 0.15 + (Math.floor((Math.atan2(ny, nx) + Math.PI) * 3.2) % 2 ? 0.25 : -0.2);
        // miolo de cada placa mais claro
        const lombo = Math.abs(nx) < 0.3, v = (ny + (lombo ? 1 : 1.3)) * 1.7, fr = v - Math.floor(v);
        return Math.abs(fr - 0.5) < 0.22 ? 0.22 : 0;
      },
    });
    // sulcos entre as placas: beirada, as duas linhas do lombo e as travessas
    for (let Y = 0; Y < 32; Y++) for (let X = 0; X < 32; X++) {
      const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry, r = Math.hypot(nx, ny);
      if (r > 0.98 || !g.gf(X, Y)) continue;
      const lombo = Math.abs(nx) < 0.3, v = (ny + (lombo ? 1 : 1.3)) * 1.7, fr = v - Math.floor(v);
      const anel = Math.abs(r - 0.8) < 0.045;
      const raia = r < 0.8 && Math.abs(Math.abs(nx) - 0.3) < 0.05;
      const trav = r < 0.8 && fr < 0.2;
      const div = r > 0.84 && Math.abs(((Math.atan2(ny, nx) + Math.PI) * 3.2) % 1 - 0.5) > 0.42;
      if (anel || raia || trav) g.fino(X, Y, SULCO); else if (div) matiz(g, X, Y, 0.4);
    }
    pontos(g, [[11, 12], [12, 11], [13, 11]], BRANCO);
  }, { sombraApoio: [8, 14.1, 6.4, 1.1] });
  // Amuleto de faiança: escaravelho azul-turquesa vidrado, com a cabeça, as asas riscadas e o cordão.
  item("amuleto_faianca", (g) => {
    const FAI = rampa6("#2fa0a8", "metal"), ESC = rampa6("#1e6a7a", "metal");
    // cordão em laço
    const fl = (t) => { const a = Math.PI * (0.5 + t * 2); return [16 + Math.cos(a) * 8.5 * (0.35 + 0.65 * Math.sin(t * Math.PI)), 13.5 - Math.sin(t * Math.PI) * 10.5 + Math.abs(Math.cos(a)) * 0]; };
    let a = fl(0);
    for (let i = 1; i <= 24; i++) { const b = fl(i / 24); linF(g, Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), CORDA[(i % 3) ? 3 : 5]); a = b; }
    // perninhas
    for (const [x0, y0, x1, y1] of [[10, 18, 7, 16], [9.5, 21.5, 6, 22], [10.5, 25, 7.5, 27.5], [22, 18, 25, 16], [22.5, 21.5, 26, 22], [21.5, 25, 24.5, 27.5]]) linF(g, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), ESC[x0 < 16 ? 3 : 1]);
    bola(g, 16, 15.2, 4.2, 3, ESC, { rebote: 0.3 });
    bola(g, 16, 22, 6.8, 6.6, FAI, {
      rebote: 0.45, esp: BRANCO, dur: 0.975,
      tex: (X, Y, nx, ny) => (Math.abs(nx) < 0.09 && ny > -0.45 ? -0.7 : ny < -0.45 && ny > -0.62 ? -0.7 : Math.abs(Math.abs(nx) - 0.5) < 0.07 && ny > -0.3 ? -0.3 : 0),
    });
    pontos(g, [[14, 14], [18, 14]], "#f2e8c8"); g.fino(16, 12, OURO[4]); g.fino(15, 12, OURO[5]);
    pontos(g, [[20, 25], [19, 26]], "#8ad8d0");
  }, { sombraApoio: [8, 14.5, 4.6, 1] });
  // Insígnia do bando: medalhão de bronze escurecido com a adaga cravada em relevo, argola e tira de couro rasgada.
  item("insignia_bandido", (g) => {
    const VELHO = rampa6("#a87434", "metal"), FUNDO = rampa6("#6a2a3a", "pedra");
    // tira rasgada
    poli(g, [[13, 2], [16, 3], [19, 2], [18.5, 8], [13.5, 8]], (X, Y) => COURO_ESC[X < 15 ? 4 : X > 17 ? 1 : 3]);
    curva(g, (t) => { const an = t * Math.PI * 2; return [16 + Math.cos(an) * 2, 8.5 + Math.sin(an) * 2]; }, 10, () => 0.9, VELHO, {});
    elipF(g, 16, 20.6, 9.6, 8.8, VELHO[0]);
    bola(g, 16, 19, 9.6, 8.8, VELHO, { plano: 0.55, rebote: 0.3, tex: (X, Y, nx, ny) => { const r = Math.hypot(nx, ny); return r > 0.8 ? (nx + ny < 0 ? 0.55 : -0.3) : r > 0.7 ? -0.75 : 0; }, cor: (X, Y, nx, ny) => (Math.hypot(nx, ny) < 0.7 ? FUNDO : null) });
    // serpente em relevo
    const S = [[19, 14], [18, 14], [17, 14], [16, 14], [15, 15], [14, 16], [14, 17], [15, 18], [16, 19], [17, 19], [18, 20], [19, 21], [19, 22], [18, 23], [17, 24], [16, 24], [15, 24], [14, 23], [13, 23]];
    for (const [X, Y] of S) matiz(g, X + 1, Y + 1, 0.45);
    S.forEach(([X, Y], i) => g.fino(X, Y, VELHO[i % 4 === 2 ? 3 : 5]));
    pontos(g, [[20, 13], [20, 14]], VELHO[5]); g.fino(21, 13, "#e2553a"); g.fino(19, 13, "#1c1210");
    // mossas e brilho
    matiz(g, 22, 17, 0.4); matiz(g, 10, 22, 0.4); pontos(g, [[9, 14], [10, 13], [11, 12]], "#ffe9b0");
  }, { sombraApoio: [8, 14.5, 5.2, 1] });

  // ===================================================================
  // 8. PEDRAS DO PEITORAL (Êxodo 28.17–20) — a mesma lapidação, na cor de cada pedra
  // ===================================================================
  const ITENS_JOGO = typeof ITENS !== "undefined" ? ITENS : global.ITENS || {};
  for (const [chave, d] of Object.entries(ITENS_JOGO)) {
    if (!d.pedra) continue;
    const R = rampa6(d.pedra, "metal"), claro = misturar(d.pedra, "#ffffff", 0.78);
    item(chave, (g) => {
      // lapidação oitavada vista do alto: cinta (8 vértices), mesa no centro e 8 facetas de coroa em tom chapado
      const cx = 16, cy = 17.5, rx = 11, ry = 9.4, N = 8;
      const V = [], T = [];
      for (let i = 0; i < N; i++) {
        const a = ((i + 0.5) / N) * Math.PI * 2;
        V.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
        T.push([cx - 0.6 + Math.cos(a) * rx * 0.5, cy - 1 + Math.sin(a) * ry * 0.5]);
      }
      // faceta i fica entre os vértices i e i+1; i = 0 aponta para baixo à direita, depois embaixo, e segue no sentido do relógio
      const tomFac = [1, 2, 1, 3, 4, 5, 4, 2];
      // pavilhão: a espessura da pedra, embaixo
      poli(g, V.map(([x, y]) => [x, y + 2.4]), (X) => R[X < 12 ? 1 : 0]);
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        poli(g, [V[i], V[j], T[j], T[i]], R[tomFac[i]]);
      }
      // mesa: céu refletido em faixa diagonal
      poli(g, T, (X, Y) => { const d = (X - cx) * 0.75 + (Y - cy + 1); return d < -3.2 ? claro : d < -1.2 ? R[5] : d < 1.6 ? R[4] : d < 3.2 ? R[3] : R[4]; });
      // arestas entre as facetas: claras do lado da luz, escuras do outro
      for (let i = 0; i < N; i++) linF(g, Math.floor(V[i][0]), Math.floor(V[i][1]), Math.floor(T[i][0]), Math.floor(T[i][1]), i >= 3 && i <= 6 ? claro : R[i === 7 || i === 2 ? 3 : 2]);
      // fio da mesa
      for (let i = 0; i < N; i++) { const j = (i + 1) % N; if (i >= 3 && i <= 5) linF(g, Math.floor(T[i][0]), Math.floor(T[i][1]), Math.floor(T[j][0]), Math.floor(T[j][1]), claro); }
      faisca(g, 11, 12, BRANCO, true); g.fino(20, 21, claro); g.fino(22, 14, BRANCO);
    }, { sombraApoio: [8, 14.3, 5.4, 1.1] });
  }

  // ===================================================================
  // 9. MOEDAS
  // ===================================================================
  // Moeda girando (4 quadros): de frente, a três quartos, de perfil, a três quartos de volta. O cunho é uma palma.
  const OURO_V = rampa6("#c08a2c", "metal"); // ouro mais velho: friso, serrilha e espessura
  item("moeda", (g, q) => {
    const cx = 16, cy = 20, ry = 7.2, rx = [7.2, 5, 1.6, 5][q], verso = q === 3, esp = [0, 1.6, 0, 1.6][q];
    if (q === 2) {
      // de perfil: só o serrilhado da borda
      for (let Y = Math.round(cy - ry); Y < Math.round(cy + ry); Y++) {
        const ny = (Y + 0.5 - cy) / ry, w = Math.abs(ny) > 0.86 ? 1 : 1.6;
        for (let X = Math.round(cx - w); X < Math.round(cx + w); X++) g.fino(X, Y, sombrear(Y % 2 ? OURO_V : OURO, (X < cx - 0.2 ? 0.55 : -0.3) - ny * 0.55, X, Y, false));
      }
      g.fino(15, 15, BRANCO);
      return;
    }
    // borda (espessura) do lado para onde a moeda está virada
    if (esp) elipF(g, cx + (verso ? -esp : esp), cy, rx, ry, (nx, ny, X, Y) => OURO_V[(Y % 2 ? 2 : 3) - (ny > 0.3 ? 1 : 0)]);
    elipF(g, cx, cy, rx, ry, (nx, ny, X, Y) => {
      const r = Math.hypot(nx, ny), l = 0.25 - (nx * 0.5 + ny * 0.75) * 0.7;
      if (r > 0.8) return sombrear(OURO, l + (nx + ny < 0 ? 0.6 : -0.45), X, Y, false);
      if (r > 0.66) return sombrear(OURO_V, l + (nx + ny < 0 ? -0.35 : 0.6), X, Y, false);
      return sombrear(OURO, l + 0.1, X, Y, false);
    });
    // cunho: palma (frente) ou estrela de pontos (verso), espremido com a largura
    const k = rx / 7.2, pt = (dx, dy, c) => { const X = Math.round(cx - 0.5 + dx * k), Y = cy + dy; if (g.gf(X, Y)) g.fino(X, Y, c); };
    if (!verso) {
      for (let dy = -3; dy <= 3; dy++) pt(0, dy, OURO[1]);
      for (const [dx, dy] of [[-1, -3], [-2, -2], [-1, -1], [-2, 0], [-1, 1], [1, -3], [2, -2], [1, -1], [2, 0], [1, 1]]) pt(dx, dy, dx < 0 ? OURO[1] : OURO[0]);
      for (const [dx, dy] of [[-1, -4], [-3, -2], [-3, 0]]) pt(dx, dy, OURO[5]);
    } else {
      for (const [dx, dy] of [[0, -3], [0, 3], [-3, 0], [3, 0], [0, 0], [-2, -2], [2, 2], [-2, 2], [2, -2]]) pt(dx, dy, OURO[1]);
    }
    const bx = Math.round(cx - rx * 0.55), by = Math.round(cy - ry * 0.62);
    g.fino(bx, by, BRANCO); if (q === 0) faisca(g, bx + 1, by - 1, BRANCO, false);
  }, { quadros: 4, sombraApoio: [8, 14, 3.6, 0.9] });
  // Pilha de moedas: três pilhas de alturas diferentes e duas moedas soltas, borda serrilhada.
  item("moeda_pilha", (g) => {
    const pilha = (cx, base, n, rx = 5.2, ry = 2.6) => {
      for (let i = 0; i < n; i++) {
        const y = base - i * 2;
        elipF(g, cx, y + 1.2, rx, ry, (nx, ny) => OURO_V[ny > 0.55 ? 1 : nx < -0.45 ? 4 : nx > 0.45 ? 2 : 3]);
        elipF(g, cx, y, rx, ry, (nx, ny) => { const r = Math.hypot(nx, ny); return i < n - 1 ? OURO[nx < -0.2 ? 4 : 3] : r > 0.72 ? OURO[nx + ny < 0 ? 5 : 3] : r > 0.5 ? OURO[2] : OURO[nx + ny < 0 ? 4 : 3]; });
      }
      const y = base - (n - 1) * 2;
      g.fino(Math.round(cx - 3), Math.round(y - 1.5), BRANCO);
    };
    pilha(21.5, 21, 6);
    pilha(10.5, 22.5, 4);
    pilha(17, 26, 2);
    // moeda solta, deitada na frente
    elipF(g, 7, 27.2, 3.6, 1.9, (nx, ny) => OURO[nx + ny < -0.2 ? 5 : nx + ny > 0.6 ? 2 : 4]); g.fino(7, 27, OURO[1]);
    faisca(g, 20, 9, BRANCO, true); g.fino(9, 14, BRANCO);
  }, { sombraApoio: [8.2, 14.2, 6.6, 1.1] });

  // ===================================================================
  // 9. PEÇAS DO CORPO DO BONECO (cabeça, colar, pernas, pés, anel) E A MOCHILA
  // ===================================================================
  const cil = (R, X, Y, cx, meia, extra = 0, pont = false) => {
    const nx = lim((X + 0.5 - cx) / meia, -0.98, 0.98);
    return sombrear(R, luzN(nx * 0.9, -0.15, Math.sqrt(1 - nx * nx)) + extra, X, Y, pont);
  };
  // Turbante de linho: voltas de pano em diagonal, faixa de anil, broche e a ponta caída atrás.
  item("turbante_linho", (g) => {
    tubo(g, 23.5, 18, 26.5, 26.5, 2.3, 1.5, LINHO, { tex: (X, Y, t) => (Math.round(t * 9) % 2 ? -0.35 : 0.1) });
    bola(g, 15.5, 15, 10.5, 8.6, LINHO_BR, {
      rebote: 0.25,
      tex: (X, Y) => { const k = ((Math.round(X * 0.6 + Y) % 4) + 4) % 4; return k === 0 ? -0.8 : k === 1 ? 0.3 : 0; },
    });
    for (let X = 5; X <= 26; X++) {
      const Y = Math.round(21.2 - (X - 5) * 0.3);
      if (g.gf(X, Y) && g.gf(X, Y + 1)) { g.fino(X, Y, ANIL[X < 12 ? 5 : X < 19 ? 4 : 3]); g.fino(X, Y + 1, ANIL[X < 12 ? 3 : X < 19 ? 2 : 1]); }
    }
    bola(g, 11.5, 12, 2, 2, OURO, { esp: BRANCO });
    g.fino(11, 12, "#c2452d");
  }, { sombraApoio: [8, 12.6, 5.6, 1.1] });
  // Capacete de couro: calota fervida com costura no meio, aba clara, orelheiras e cravos.
  item("capacete_couro", (g) => {
    poli(g, [[6, 17], [11.5, 17], [11, 25.5], [8.5, 27.5], [6, 25]], (X, Y) => sombrear(COURO_ESC, 0.7 - (X - 6) * 0.25 - (Y - 17) * 0.05, X, Y, false));
    poli(g, [[20.5, 17], [26, 17], [26, 25], [23.5, 27.5], [21, 25.5]], (X, Y) => sombrear(COURO_ESC, 0.2 - (X - 20) * 0.25 - (Y - 17) * 0.05, X, Y, false));
    bola(g, 16, 17.5, 10.5, 12.5, COURO, { so: (X, Y) => Y < 17, rebote: 0.2, tex: (X, Y) => (X === 16 ? -0.7 : X === 15 ? 0.35 : (X + Y * 3) % 7 === 0 ? -0.2 : 0) });
    tubo(g, 5.5, 17.6, 26.5, 17.6, 1.5, 1.5, COURO_CL, {});
    for (let Y = 7; Y < 16; Y += 2) g.fino(17, Y, COURO[5]);
    pontos(g, [[8, 17], [12, 17], [20, 17], [24, 17]], OURO[5]); pontos(g, [[8, 18], [12, 18], [20, 18], [24, 18]], COURO_ESC[0]);
    pontos(g, [[8, 24], [23, 24]], OURO[4]);
  }, { sombraApoio: [8, 14.4, 5.4, 1.1] });
  // Elmo de bronze: calota polida, testeira de ouro, abas do rosto, nasal e o botão no alto.
  item("elmo_bronze", (g) => {
    poli(g, [[12, 17], [20, 17], [20, 26.5], [12, 26.5]], (X, Y) => (Y < 20 ? "#1c1210" : "#2e1c16"));
    poli(g, [[6, 16], [26, 16], [26, 24], [23, 28.5], [19.5, 28.5], [18.5, 20.5], [13.5, 20.5], [12.5, 28.5], [9, 28.5], [6, 24]], (X, Y, den) => cil(BRONZE, X, Y, 16, 10.6, (!den(X, Y + 1) ? -0.5 : 0) - (Y - 16) * 0.03 + (!den(X - 1, Y) ? 0.3 : 0), true));
    bola(g, 16, 17, 10.5, 12.3, BRONZE, { so: (X, Y) => Y < 16, esp: BRANCO, dur: 0.97, rebote: 0.3 });
    tubo(g, 5.5, 16.4, 26.5, 16.4, 1.3, 1.3, OURO, { esp: BRANCO, dur: 0.985 });
    for (let Y = 18; Y <= 25; Y++) { g.fino(15, Y, BRONZE[Y === 25 ? 3 : 5]); g.fino(16, Y, BRONZE[Y === 25 ? 1 : 3]); }
    bola(g, 16, 4.3, 2, 2, OURO, { esp: BRANCO });
    faisca(g, 10, 9, BRANCO, true);
  }, { sombraApoio: [8, 14.6, 5.4, 1.1] });
  // Colar de contas: cordão, contas de cornalina e turquesa, e a conta grande de ouro no meio.
  item("colar_contas", (g) => {
    const CORN = rampa6("#c2452d", "metal"), TURQ = rampa6("#3fa69a", "metal");
    const f = (t) => { const a = Math.PI * (0.04 + t * 0.92); return [16 + Math.cos(a) * 10, 9 + Math.sin(a) * 14]; };
    curva(g, (t) => [16 + Math.cos(Math.PI * (1 + t)) * 10, 9.5 + Math.sin(Math.PI * (1 + t)) * 4.6], 14, () => 0.8, CORDA, {});
    for (let i = 0; i <= 12; i++) {
      if (i === 6) continue;
      const p = f(i / 12);
      bola(g, p[0], p[1], 1.9, 1.9, i % 2 ? TURQ : CORN, { esp: BRANCO, dur: 0.985, rebote: 0.3 });
    }
    const m = f(0.5);
    bola(g, m[0], m[1] + 0.6, 3.3, 3.3, OURO, { esp: BRANCO, rebote: 0.35 });
    g.fino(16, 24, CORN[4]); g.fino(15, 24, CORN[5]); g.fino(16, 25, CORN[2]); g.fino(15, 25, CORN[3]);
  }, { sombraApoio: [8, 14, 5.4, 1] });
  // Saiote de couro: cinto com fivela e sete tiras de pontas de bronze.
  item("saiote_couro", (g) => {
    poli(g, [[5, 9], [27, 9], [27, 15], [5, 15]], (X, Y) => COURO_ESC[Y < 11 ? 0 : 1]);
    for (let i = 0; i < 7; i++) {
      const X0 = 5 + i * 3 + (i > 3 ? 1 : 0), comp = Math.round(17 - Math.abs(i - 3) * 1.3), R = i % 2 ? COURO : COURO_CL;
      for (let j = 0; j < comp; j++) {
        const Y = 10 + j, ponta = j >= comp - 2, l = 0.25 - (i - 3) * 0.12 - j * 0.02;
        g.fino(X0, Y, ponta ? OURO[5] : sombrear(R, l + 0.6, X0, Y, false));
        g.fino(X0 + 1, Y, ponta ? OURO[j === comp - 1 ? 2 : 4] : sombrear(R, l + (j % 4 === 2 ? -0.3 : 0.1), X0 + 1, Y, false));
        if (j < comp - 1) g.fino(X0 + 2, Y, ponta ? OURO[2] : sombrear(R, l - 0.7, X0 + 2, Y, false));
      }
    }
    tubo(g, 5, 7.6, 27, 7.6, 2.1, 2.1, COURO_ESC, { tex: (X) => (X % 3 === 0 ? 0.35 : 0) });
    bola(g, 16, 7.6, 2.7, 2.7, OURO, { esp: BRANCO });
    g.fino(16, 8, COURO_ESC[0]); g.fino(15, 8, OURO[1]);
  }, { sombraApoio: [8, 14.4, 5.6, 0.9] });
  // Grevas de bronze: duas placas de canela com a joelheira redonda e as correias de couro.
  item("grevas_bronze", (g) => {
    for (const cx of [10, 22]) {
      torno(g, cx, [[4, 3.2], [6.5, 4.5], [9.5, 4], [14, 3.8], [21, 3], [26, 2.7], [27.5, 3.4], [28.5, 3.2]], BRONZE, {
        esp: BRANCO, dur: 0.975, rebote: 0.3,
        cor: (Y) => (Y === 13 || Y === 22 ? COURO_ESC : null),
        tex: (X, Y) => (Y === 12 || Y === 21 ? 0.35 : Y === 14 || Y === 23 ? -0.5 : 0),
      });
      bola(g, cx, 6.8, 2.4, 2.4, OURO, { esp: BRANCO });
      for (let Y = 10; Y <= 25; Y++) matiz(g, cx, Y, -0.22); // a aresta do meio da placa
      pontos(g, [[cx - 2, 13], [cx - 1, 22]], OURO[5]);
    }
  }, { sombraApoio: [8, 14.6, 5.6, 0.9] });
  // Sandálias de couro: duas solas vistas de cima, tiras cruzadas e a tira do calcanhar.
  item("sandalias_couro", (g) => {
    for (const [cx, cy] of [[10, 15.5], [22, 17]]) {
      bola(g, cx + 0.4, cy + 0.6, 4.6, 10.6, COURO_ESC, { plano: 0.3 });
      bola(g, cx, cy, 4.2, 10.2, COURO_CL, { plano: 0.35, tex: (X, Y) => ((X + Y * 2) % 5 === 0 ? -0.25 : 0) });
      for (const [dy, larg] of [[-6, 3], [-2, 4], [5, 4]]) {
        const Y = Math.round(cy + dy);
        for (let X = Math.round(cx) - larg; X < Math.round(cx) + larg; X++) { g.fino(X, Y, COURO_ESC[X < cx ? 4 : 2]); g.fino(X, Y + 1, COURO_ESC[X < cx ? 2 : 0]); }
      }
      for (let Y = Math.round(cy) - 9; Y < Math.round(cy) - 6; Y++) g.fino(Math.round(cx) - 1, Y, COURO_ESC[3]);
      for (let Y = Math.round(cy) - 4; Y < Math.round(cy) - 2; Y++) g.fino(Math.round(cx) - 1, Y, COURO_ESC[3]);
      g.fino(Math.round(cx) + 3, Math.round(cy) + 5, OURO[5]);
    }
  }, { sombraApoio: [8, 14.4, 5.6, 0.9] });
  // Botas de viagem: o par de perfil, cano dobrado, atilhos de linho e sola grossa.
  item("botas_viagem", (g) => {
    const bota = (dx, dy, R, R2) => {
      const forma = [[9, 4], [18, 4], [18, 16], [24, 18.5], [27.5, 22], [27.5, 27], [8, 27], [8, 18]].map(([x, y]) => [x + dx, y + dy]);
      poli(g, forma, (X, Y, den) => {
        const x = X - dx, y = Y - dy;
        if (y >= 25) return R[x < 12 ? 1 : 0];
        if (y < 7) return sombrear(R2, 0.75 - (x - 9) * 0.16 - (y === 6 ? 0.6 : 0), X, Y, false);
        if (y < 17 || x < 18) return cil(R, X, Y, 13.5 + dx, 5.6, (y > 17 ? -0.15 : 0) + (!den(X, Y - 1) ? 0.3 : 0), true);
        return sombrear(R, 0.55 - (x - 18) * 0.1 - (y - 18) * 0.14 + (!den(X, Y - 1) ? 0.4 : 0), X, Y, true);
      });
    };
    bota(-4, -1, COURO_ESC, COURO);
    bota(1, 1, COURO, COURO_CL);
    for (const Y of [10, 13, 16]) pontos(g, [[15, Y], [16, Y + 1], [17, Y]], LINHO[4]);
    pontos(g, [[16, 19], [17, 20]], LINHO[3]);
  }, { sombraApoio: [8.4, 14.6, 5.8, 0.9] });
  // Anel de selo: aro grosso de bronze e a chapa oval de ouro com a marca gravada.
  item("anel_selo_bronze", (g) => {
    curva(g, (t) => [16 + Math.cos(Math.PI * 2 * t) * 8.2, 19 + Math.sin(Math.PI * 2 * t) * 6.4], 36, () => 2, BRONZE, { esp: BRANCO, dur: 0.975, rebote: 0.4 });
    bola(g, 16, 11.6, 6, 4.4, BRONZE, { plano: 0.5 });
    bola(g, 16, 11, 5.2, 3.6, OURO, { plano: 0.45, esp: BRANCO, dur: 0.99 });
    pontos(g, [[14, 11], [15, 11], [16, 11], [17, 11], [16, 10], [16, 12], [15, 12]], BRONZE[0]);
    pontos(g, [[15, 10], [17, 12]], OURO[1]);
    faisca(g, 9, 22, BRANCO, true);
  }, { sombraApoio: [8, 14.2, 5.4, 1.1] });
  // Mochila: bolsa de couro com aba, fivela, bolso lateral e a esteira enrolada por cima.
  item("mochila", (g) => {
    curva(g, (t) => [16 + Math.cos(Math.PI * (1 + t)) * 4, 7 + Math.sin(Math.PI * (1 + t)) * 3.6], 10, () => 0.9, COURO_ESC, {});
    const den = poli(g, [[8, 10], [24, 10], [26.5, 13], [26.5, 26], [24, 28.5], [8, 28.5], [5.5, 26], [5.5, 13]], (X, Y, d) => cil(COURO, X, Y, 16, 11, (!d(X, Y + 1) ? -0.6 : 0) + (Y > 24 ? -0.2 : 0), true));
    // aba: cai até o meio, com a borda em curva e o pesponto claro
    for (let X = 6; X <= 26; X++) {
      const fim = Math.round(19.5 - ((X - 16) / 10.5) ** 2 * 4);
      for (let Y = 10; Y <= fim; Y++) {
        if (!den(X, Y)) continue;
        g.fino(X, Y, Y === fim ? COURO_ESC[0] : cil(COURO_CL, X, Y, 16, 11, Y === 10 ? 0.4 : Y === fim - 2 && X % 2 ? 0.5 : 0, false));
      }
    }
    // correia e fivela
    for (let Y = 10; Y <= 23; Y++) { g.fino(15, Y, COURO_ESC[4]); g.fino(16, Y, COURO_ESC[2]); }
    bola(g, 16, 20, 2.4, 2.4, OURO, { esp: BRANCO });
    g.fino(16, 20, COURO_ESC[0]);
    // esteira enrolada em cima, amarrada com duas tiras
    tubo(g, 7.5, 8.2, 24.5, 8.2, 2.7, 2.7, LINHO, { cor: (t) => (Math.abs(t - 0.2) < 0.045 || Math.abs(t - 0.8) < 0.045 ? COURO_ESC : null), tex: (X) => (X % 3 === 0 ? -0.3 : 0) });
    pontos(g, [[8, 26], [23, 26]], OURO[4]);
  }, { sombraApoio: [8, 14.6, 5.8, 0.9] });


  // Conferência na carga: nenhuma chave de item do legado ficou sem desenho novo (o teste do pacote confere de novo).
  Arte.ITENS_NOVOS = FEITOS.slice();
})(typeof window !== "undefined" ? window : globalThis);
