// =====================================================================
// arte/efeitos.js — efeitos e projéteis animados.
// Pacote A7 do plano de arte.
//
// Chaves que este arquivo assume (registrar() com a MESMA chave troca o desenho legado de sprites.js):
//   fx_corte fx_faisca fx_fogueira fx_anel fx_anel_amigo (re-registradas) e as novas fx_impacto fx_sangue
//   fx_poca fx_fogo fx_fumaca fx_poeira fx_cura fx_luz_fe fx_veneno fx_morte fx_restos_p fx_restos_g
//   fx_respingo_agua fx_flecha fx_pedra fx_orbe; preenche Arte.FX[chave] = { quadros, ms, laco }.
//   Tira simples (sem vistas); contorno null. As chaves fx_sombra_<w>x<h> são do motor (Arte.garantirSombra)
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
  const { registrar, misturar, hash2, ruido, comAlfa, rampa6, sombrear } = M;
  const TAU = Math.PI * 2;
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));

  // -------------------------------------------------------------------
  // Tela de trabalho de um quadro: cor + alfa contínuo por px de arte. Os efeitos pintam aqui e só no
  // fim despejam na Grade com g.fino, com o alfa reduzido a 3 níveis (cheio, 2/3 e 1/3): é o que dá a
  // borda suave sem virar degradê de filtro.
  // -------------------------------------------------------------------
  class Tela {
    constructor(W, H) { this.W = W; this.H = H; this.c = new Array(W * H).fill(null); this.a = new Float32Array(W * H); }
    // Pinta 1 px; sem `forcar`, um px mais opaco já pintado não é trocado por um mais fraco.
    px(X, Y, cor, a = 1, forcar = false) {
      X = Math.round(X); Y = Math.round(Y);
      if (X < 0 || Y < 0 || X >= this.W || Y >= this.H || !cor || !(a > 0)) return;
      const i = Y * this.W + X;
      if (!forcar && this.a[i] > a) return;
      this.c[i] = cor; this.a[i] = Math.min(1, a);
    }
    alfa(X, Y) { return X < 0 || Y < 0 || X >= this.W || Y >= this.H ? 0 : this.a[Y * this.W + X]; }
    apagar(X, Y) { if (X >= 0 && Y >= 0 && X < this.W && Y < this.H) { this.c[Y * this.W + X] = null; this.a[Y * this.W + X] = 0; } }
    // Elipse cheia; cor fixa ou (nx, ny, X, Y) => cor | [cor, alfa] | null, com nx, ny de -1 a 1.
    elipse(cx, cy, rx, ry, cor, a = 1) {
      for (let Y = Math.floor(cy - ry); Y <= Math.ceil(cy + ry); Y++)
        for (let X = Math.floor(cx - rx); X <= Math.ceil(cx + rx); X++) {
          const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry;
          if (nx * nx + ny * ny > 1) continue;
          const r = typeof cor === "function" ? cor(nx, ny, X, Y) : cor;
          if (!r) continue;
          if (Array.isArray(r)) this.px(X, Y, r[0], r[1]); else this.px(X, Y, r, a);
        }
    }
    linha(x0, y0, x1, y1, cor, a = 1) {
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, cor, a);
    }
    // Traço de 1 px por fora dos px opacos (4 vizinhos). cor fixa ou (corDoVizinho) => cor.
    contornar(cor, a = 1) {
      const W = this.W, H = this.H, marcar = [];
      for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
        if (this.a[Y * W + X] >= 0.83) continue;
        let viz = null;
        for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
          if (this.alfa(X + dx, Y + dy) >= 0.83) { viz = this.c[(Y + dy) * W + X + dx]; break; }
        }
        if (viz) marcar.push(Y * W + X, typeof cor === "function" ? cor(viz) : cor);
      }
      for (let i = 0; i < marcar.length; i += 2) { this.c[marcar[i]] = marcar[i + 1]; this.a[marcar[i]] = a; }
    }
    // Brilho de 1 px em volta de tudo o que já foi pintado (8 vizinhos), só onde está vazio.
    halo(cor, a = 0.33) {
      const W = this.W, H = this.H, marcar = [];
      for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
        if (this.a[Y * W + X] > 0) continue;
        let tem = false;
        for (let dy = -1; dy <= 1 && !tem; dy++) for (let dx = -1; dx <= 1; dx++) if (this.alfa(X + dx, Y + dy) > a) { tem = true; break; }
        if (tem) marcar.push(Y * W + X);
      }
      for (const i of marcar) { this.c[i] = cor; this.a[i] = a; }
    }
    despejar(g, ox = 0, oy = 0) {
      for (let i = 0; i < this.c.length; i++) {
        const a = this.a[i];
        if (!this.c[i] || a < 0.17) continue;
        const X = (i % this.W) + ox, Y = ((i / this.W) | 0) + oy;
        g.fino(X, Y, a >= 0.83 ? this.c[i] : comAlfa(this.c[i], a >= 0.5 ? 0.66 : 0.33));
      }
    }
  }
  const escuro = (t = 0.6) => (c) => misturar(c.slice(0, 7), "#1c1210", t);
  // Cor por faixas: lista de [limiar, cor, alfa?] do maior para o menor.
  function faixa(v, lista) {
    for (const f of lista) if (v >= f[0]) return f;
    return null;
  }
  // Brilho de 4 pontas (cintilação): braços finos em cruz que afinam para a ponta.
  function cintila(T, cx, cy, r, cores, a = 1) {
    const [centro, meio, ponta] = cores;
    for (let d = -r; d <= r; d++) {
      const k = Math.abs(d) / Math.max(1, r), c = k < 0.34 ? centro : k < 0.7 ? meio : ponta, al = k > 0.8 ? a * 0.66 : a;
      T.px(cx + d, cy, c, al); T.px(cx, cy + d, c, al);
    }
    if (r >= 3) { const m = r >= 6 ? 2 : 1; for (let dy = -m; dy <= m; dy++) for (let dx = -m; dx <= m; dx++) if (Math.abs(dx) + Math.abs(dy) <= m) T.px(cx + dx, cy + dy, Math.abs(dx) + Math.abs(dy) < m ? centro : meio, a); }
  }

  const FX = Arte.FX || (Arte.FX = {});
  // Registra a tira e a entrada de Arte.FX. desenhar(T, q, g) pinta na Tela (W × H px) do quadro q.
  function fx(chave, W, H, quadros, ms, laco, desenhar, extra) {
    registrar(chave, Object.assign({
      w: W / 2, h: H / 2, quadros, contorno: null, acabamento: false, textura: false, origem: [0.5, 0.5],
      desenhar(g, q) { const T = new Tela(W, H); desenhar(T, q, g); T.despejar(g); },
    }, extra || {}));
    FX[chave] = { quadros, ms, laco };
  }

  // ===================================================================
  // LUZ E GOLPES
  // ===================================================================
  const LUZ = ["#fffbe8", "#ffe9a0", "#e8b94a"]; // centro, meio, ponta
  const BRASA = "#c98a3a";

  // Corte: lâmina de luz em crescente, desenhada virada para a DIREITA (o jogo gira pelo ângulo do golpe).
  // Quadros 0 e 1 valem sozinhos (meio arco, arco inteiro); 2 a 4 são o rastro que se desfaz.
  fx("fx_corte", 32, 32, 5, 45, false, (T, q) => {
    const cx = 11, cy = 16, R = 15, t0 = -1.3, t1 = 1.15;
    const ini = [0, 0, 0.22, 0.52, 0.74][q], fim = [0.56, 1, 1, 1, 1][q];
    const gros = [4.8, 6.4, 4.4, 2.8, 1.7][q];
    for (let Y = 0; Y < 32; Y++) for (let X = 0; X < 32; X++) {
      const dx = X + 0.5 - cx, dy = Y + 0.5 - cy, r = Math.hypot(dx, dy), u = (Math.atan2(dy, dx) - t0) / (t1 - t0);
      if (u < ini || u > fim) continue;
      const k = (u - ini) / (fim - ini);                       // 0 na cauda, 1 na ponta da lâmina
      const w = gros * Math.pow(Math.sin(Math.PI * lim(0.08 + k * 0.9, 0, 1)), 0.8) * (0.45 + 0.55 * k);
      const d = R - r;
      if (d < -0.2 || d > w) continue;
      const v = 1 - d / Math.max(0.6, w);                      // 1 no fio (fora), 0 no miolo do arco
      if (q === 4 && hash2(X, Y, 31) < 0.45) continue;
      // o fio fica sempre claro e opaco; o rastro esfria (creme -> ouro) em vez de ficar transparente e barrento
      const cor = q <= 2 ? (v > 0.62 ? LUZ[0] : v > 0.34 ? LUZ[1] : LUZ[2]) : q === 3 ? (v > 0.55 ? LUZ[0] : LUZ[1]) : (v > 0.5 ? LUZ[1] : LUZ[2]);
      const a = (v > 0.34 || q >= 3 ? 1 : 0.66) * (k < 0.14 ? 0.66 : 1);
      T.px(X, Y, cor, a);
    }
    if (q < 3) T.halo(BRASA, 0.33);
    if (q >= 2) for (let i = 0; i < 5; i++) {                   // faíscas que se soltam do fio
      const t = t0 + (t1 - t0) * (0.25 + 0.7 * hash2(i, q, 7)), rr = R + 1 + (q - 1) * (0.6 + hash2(i, 3, 9));
      T.px(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr, q === 4 ? LUZ[2] : LUZ[1], q === 4 ? 0.66 : 1);
    }
  });

  // Impacto: estouro de luz com raios, que abre num anel e termina em pó.
  fx("fx_impacto", 48, 48, 5, 50, false, (T, q) => {
    const c = 24, N = 8;
    const nucleo = [5.5, 7, 0, 0, 0][q], raioL = [10, 20, 23, 23.5, 0][q], raioC = [7, 13, 17, 0, 0][q];
    const ini = [0, 0, 10, 17, 0][q], anel = [0, 0, 13.5, 18.5, 21.5][q], esp = [0, 0, 2.6, 1.6, 1.2][q];
    for (let Y = 0; Y < 48; Y++) for (let X = 0; X < 48; X++) {
      const dx = X + 0.5 - c, dy = Y + 0.5 - c, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx) + 0.2;
      if (nucleo && r < nucleo) { T.px(X, Y, r < nucleo * 0.55 ? LUZ[0] : r < nucleo * 0.85 ? LUZ[1] : LUZ[2], 1); continue; }
      const i = Math.round((th / TAU) * N), eixo = (i / N) * TAU, comp = ((i % 2) + 2) % 2 === 0 ? raioL : raioC;
      if (comp && r >= ini && r < comp) {
        const larg = 2.4 * (1 - (r - ini) / (comp - ini)) + 0.35, dist = Math.abs(Math.sin(th - eixo)) * r;
        if (dist < larg) { T.px(X, Y, dist < larg * 0.45 ? LUZ[0] : r > comp * 0.75 ? LUZ[2] : LUZ[1], q === 3 ? 0.66 : 1); continue; }
      }
      if (anel && Math.abs(r - anel) < esp / 2) {
        const h = hash2(Math.round((th / TAU) * 40), 0, 5 + q);
        if (q >= 3 && h < (q === 3 ? 0.35 : 0.62)) continue;
        T.px(X, Y, Math.abs(r - anel) < esp / 4 ? LUZ[1] : LUZ[2], q === 2 ? 1 : q === 3 ? 0.66 : 0.4);
      }
    }
    if (q <= 2) T.halo("#f08a24", 0.4);
    if (q >= 2) for (let i = 0; i < 9; i++) {                   // pó levantado
      const t = (i / 9) * TAU + hash2(i, 1, 3), rr = [0, 0, 19, 21.5, 23][q] * (0.7 + 0.3 * hash2(i, 2, 4));
      T.px(c + Math.cos(t) * rr, c + Math.sin(t) * rr, i % 2 ? "#e9d9b0" : LUZ[1], q === 4 ? 0.5 : 0.9);
    }
  });

  // Faísca: cintilação de 4 pontas que cresce e se solta. Os 3 primeiros quadros valem sozinhos.
  fx("fx_faisca", 32, 32, 5, 55, false, (T, q) => {
    const c = 16;
    if (q <= 2) {
      cintila(T, c, c, [3, 7, 11][q], LUZ);
      if (q >= 1) { const d = q === 1 ? 3 : 5; for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { T.px(c + sx * d, c + sy * d, LUZ[1]); if (q === 2) T.px(c + sx * (d - 1), c + sy * (d - 1), LUZ[0]); } }
      T.halo(BRASA, 0.33);
    } else {
      const r = q === 3 ? 12 : 14;
      for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let d = q === 3 ? 7 : 12; d <= r; d++) T.px(c + sx * d, c + sy * d, d > r - 2 ? LUZ[2] : LUZ[1], q === 3 ? 1 : 0.66);
      if (q === 3) cintila(T, c, c, 2, LUZ, 0.66);
      for (let i = 0; i < 6; i++) { const t = (i / 6) * TAU + 0.5, rr = (q === 3 ? 7 : 10) + hash2(i, 0, 2) * 3; T.px(c + Math.cos(t) * rr, c + Math.sin(t) * rr, LUZ[2], q === 3 ? 1 : 0.5); }
    }
  });

  // Brilho pequeno (saque, estrelas de atordoado): mesma célula de 10 × 10 px, agora px a px. O jogo tinge.
  fx("fx_brilho", 10, 10, 3, 110, true, (T, q) => {
    const B = ["#ffffff", "#fff6d0", "#fff6d0"];
    if (q === 0) { T.px(5, 5, B[0]); T.px(4, 5, B[1], 0.66); T.px(6, 5, B[1], 0.66); T.px(5, 4, B[1], 0.66); T.px(5, 6, B[1], 0.66); }
    else { cintila(T, 5, 5, q === 1 ? 2 : 4, B); if (q === 2) for (const [x, y] of [[3, 3], [7, 3], [3, 7], [7, 7]]) T.px(x, y, B[1], 0.66); }
  });

  // ===================================================================
  // FOGO E FUMAÇA
  // ===================================================================
  const FOGO = [[0.84, "#fff4b0"], [0.6, "#ffd24a"], [0.34, "#f59a26"], [0.001, "#d4531c"]];
  // Chama de línguas: cada língua é uma gota que balança; o calor (0..1) escolhe a faixa de cor.
  function chama(T, cx, base, larg, alt, fase, linguas, sem) {
    for (let Y = Math.max(0, Math.floor(base - alt - 2)); Y <= base; Y++)
      for (let X = Math.floor(cx - larg - 4); X <= Math.ceil(cx + larg + 4); X++) {
        const h = (base - (Y + 0.5)) / alt;
        let calor = 0, frio = 1;
        for (let i = 0; i < linguas.length; i++) {
          const L = linguas[i];                                  // [desvio x, altura 0..1, largura 0..1, voltas por laço]
          const ai = L[1] * (0.86 + 0.14 * Math.sin(fase * L[3] + i * 1.9 + sem));
          const hh = h / ai;
          if (hh < 0 || hh > 1) continue;
          const bal = Math.sin(fase * L[3] + hh * 3.2 + i * 2.3 + sem) * hh * hh * larg * 0.42;
          const perfil = Math.pow(Math.sin(Math.PI * (0.16 + 0.84 * hh)), 0.85) * Math.min(1, 0.45 + Math.sqrt(h * 14) * 0.55);
          const d = Math.abs(X + 0.5 - (cx + L[0] * larg + bal)) / (larg * L[2] * perfil + 0.01);
          if (d < 1) { const ci = (1 - d * d) * (1 - 0.45 * hh) * (0.6 + 0.4 * L[2] / 0.9); calor = Math.max(calor, ci); frio *= 1 - ci * 0.8; }
        }
        if (calor <= 0) continue;
        { const k = lim((h - 0.18) / 0.4, 0, 1), uni = Math.max(calor, 1 - frio); calor = (uni + (calor * 1.12 - uni) * k) * (0.8 + 0.2 * Math.min(1, h * 5)) + 0.02; } // união suave das línguas; pé mais frio
        // veios mais frios entre as línguas: dão o desenho de labareda dentro da chama
        for (let i = 0; i < 2; i++) {
          const h0 = i ? 0.3 : 0.16, h1 = i ? 0.9 : 0.74;
          if (h <= h0 || h >= h1) continue;
          const xv = cx + (i ? 0.3 : -0.3) * larg + Math.sin(fase + h * 5 + i * 2 + sem) * larg * 0.16 + (i ? -1 : 1) * h * larg * 0.3;
          const wv = larg * 0.2 * Math.sin(Math.PI * (h - h0) / (h1 - h0)) + 0.3, dv = Math.abs(X + 0.5 - xv);
          if (dv < wv) calor = Math.max(0.03, calor - 0.34 * (1 - dv / wv));
        }
        const f = faixa(calor, FOGO);
        if (f) T.px(X, Y, f[1], 1);
      }
  }
  const LINGUAS_FOGO = [[0, 1, 0.9, 1], [-0.5, 0.62, 0.55, 2], [0.52, 0.7, 0.5, 1], [-0.12, 0.45, 0.7, 2], [0.2, 0.84, 0.42, 2]];
  function fagulhas(T, cx, topo, n, q, N, sem, alt = 12) {
    for (let i = 0; i < n; i++) {
      const t = (q / N + i / n + hash2(i, 0, sem) * 0.3) % 1;
      const x = cx + (hash2(i, 1, sem) - 0.5) * 14 + Math.sin(t * 5 + i) * 2, y = topo + 6 - t * alt;
      T.px(x, y, t < 0.5 ? "#ffd24a" : "#f59a26", t < 0.75 ? 1 : 0.5);
      if (t < 0.3) T.px(x, y + 1, "#f59a26", 0.66);
    }
  }
  const contornoFogo = (T) => { T.contornar(() => "#8a2414", 1); T.halo("#e0641c", 0.3); };

  // Fogo aceso no chão (chama alta, em laço de 8).
  fx("fx_fogo", 32, 48, 8, 90, true, (T, q) => {
    const fase = (q / 8) * TAU;
    T.elipse(16, 43, 13, 3.6, (nx, ny) => ["#f59a26", nx * nx + ny * ny < 0.5 ? 0.5 : 0.25]); // clarão no chão
    chama(T, 16, 44, 10.5, 34, fase, LINGUAS_FOGO, 0);
    fagulhas(T, 16, 8, 4, q, 8, 3, 10);
    contornoFogo(T);
  }, { origem: [0.5, 1] });

  // Fogueira do acampamento: pedras, lenha cruzada, brasas e chama. O jogo ainda toca só os quadros
  // 0 a 2: as línguas principais dão a volta em 3 quadros, as fagulhas em 6.
  const PEDRA = rampa6("#8d8273", "pedra"), LENHA = rampa6("#6b4a2e", "madeira");
  fx("fx_fogueira", 32, 40, 6, 110, true, (T, q, g) => {
    g.sombra(8.5, 17.4, 7.2, 1.9, "#1c1210", 0.3);
    const fase = ((q % 3) / 3) * TAU;
    const pedra = (cx, cy, rx, ry, s) => T.elipse(cx, cy, rx, ry, (nx, ny, X, Y) => sombrear(PEDRA, -(nx * 0.55 + ny * 0.75) + (hash2(X, Y, s) - 0.5) * 0.3, X, Y));
    // pedras de trás
    pedra(9, 30, 3, 2.2, 1); pedra(15.5, 29, 3.2, 2.2, 2); pedra(22.5, 30, 3, 2.3, 3);
    // lenha cruzada
    const tora = (x0, y0, x1, y1) => {
      for (let k = -1; k <= 1; k++) T.linha(x0, y0 + k, x1, y1 + k, LENHA[k < 0 ? 4 : k === 0 ? 3 : 1]);
      T.px(x0, y0, "#d9b98a"); T.px(x0, y0 - 1, "#b08a58"); T.px(x1, y1, LENHA[0]);
    };
    tora(6, 34, 25, 30); tora(7, 30, 26, 34);
    // brasas entre as toras
    for (let i = 0; i < 7; i++) { const x = 11 + i * 1.6 + hash2(i, 0, 5), y = 32 + (hash2(i, 1, 5) - 0.5) * 2; T.px(x, y, (i + q) % 3 === 0 ? "#ffd24a" : "#f0641c", 1, true); }
    chama(T, 16, 32, 6.8, 21 + [0, 2, -1][q % 3], fase, LINGUAS_FOGO, 1.3);
    fagulhas(T, 16, 9, 3, q, 6, 11, 9);
    // pedras da frente
    pedra(6, 34.5, 3.2, 2.5, 4); pedra(12, 36.3, 3.4, 2.4, 5); pedra(19.5, 36.4, 3.5, 2.4, 6); pedra(26, 34.6, 3.2, 2.5, 7);
    T.contornar((c) => (/^#(ff|f5|d4|f0)/.test(c) ? "#8a2414" : misturar(c, "#1c1210", 0.62)), 1);
  }, { origem: [0.5, 1] });

  // Nuvem de novelos sombreados (fumaça, pó). bolhas: [cx, cy, r], pintadas de trás para a frente;
  // tons: [realce, claro, médio, escuro]. Cada novelo é uma bolinha com luz de cima e da esquerda e um
  // fio escuro por baixo: é isso que separa um novelo do outro. Sem furos de ruído: a nuvem se desfaz
  // porque os novelos encolhem e se afastam.
  function nuvem(T, bolhas, tons, a, furo, sem) {
    if (tons.length === 3) tons = [tons[0], tons[0], tons[1], tons[2]];
    // campo de altura: a união das bolinhas; a luz sai da inclinação, então os novelos se fundem com vinco
    const W = T.W, Hh = T.H, alt = new Float32Array(W * Hh);
    for (const [cx, cy, r] of bolhas) {
      if (r <= 0.7) continue;
      for (let Y = Math.max(0, Math.floor(cy - r - 1)); Y <= Math.min(Hh - 1, Math.ceil(cy + r + 1)); Y++) for (let X = Math.max(0, Math.floor(cx - r - 1)); X <= Math.min(W - 1, Math.ceil(cx + r + 1)); X++) {
        const dx = (X + 0.5 - cx) / r, dy = (Y + 0.5 - cy) / r, d = Math.hypot(dx, dy) + (r > 2.5 ? (ruido(X * 0.5, Y * 0.5, sem) - 0.5) * 0.24 : 0);
        if (d >= 1) continue;
        const h = 0.6 + r * Math.sqrt(1 - d * d);
        if (h > alt[Y * W + X]) alt[Y * W + X] = h;
      }
    }
    const A = (X, Y) => (X < 0 || Y < 0 || X >= W || Y >= Hh ? 0 : alt[Y * W + X]);
    // apara px soltos na beira (pontas de 1 px)
    for (let Y = 0; Y < Hh; Y++) for (let X = 0; X < W; X++) if (alt[Y * W + X] && (A(X + 1, Y) > 0) + (A(X - 1, Y) > 0) + (A(X, Y + 1) > 0) + (A(X, Y - 1) > 0) < 2) alt[Y * W + X] = 0;
    for (let Y = 0; Y < Hh; Y++) for (let X = 0; X < W; X++) {
      const h = alt[Y * W + X];
      if (!h) continue;
      const l = ((A(X + 1, Y) - A(X - 1, Y)) * 0.62 + (A(X, Y + 1) - A(X, Y - 1)) * 0.78) * 0.5;
      const beira = !A(X + 1, Y) || !A(X, Y + 1);                 // fio escuro só por baixo e pela direita
      const c = beira ? tons[3] : l > 0.34 ? tons[0] : l > -0.12 ? tons[1] : l > -0.5 ? tons[2] : tons[3];
      T.px(X, Y, c, a, true);
    }
  }
  // Fumaça: sobe, abre e se desfaz.
  fx("fx_fumaca", 32, 32, 6, 90, false, (T, q) => {
    const t = q / 5, tons = ["#f1ece2", "#d3ccc0", "#a59c90", "#786f66"];
    const cresce = [0.62, 0.86, 1, 1.05, 0.9, 0.7][q], abre = [0, 0.25, 0.5, 0.7, 0.9, 1.1][q];
    // [x, y, r, sobe]: os de trás primeiro, o novelo grande e claro por último
    const bolhas = [[20.5, 20.5, 4.6, 9], [10.5, 22, 4.2, 7], [16.5, 15.5, 4.4, 13], [21.5, 25, 3.6, 4], [11.5, 26.5, 3.4, 3], [16, 22.5, 5.6, 8]]
      .map(([x, y, r, sobe], i) => [x + (x - 16) * abre * 0.42 + Math.sin(t * 4 + i * 1.7) * 1.2, y + 3 - t * sobe * 1.25, r * cresce * (q >= 4 && i % 2 ? 0.7 : 1)]);
    nuvem(T, bolhas, tons, [1, 1, 1, 1, 0.66, 0.4][q], 0, 21);
    if (q >= 3) for (let i = 0; i < 5; i++) T.px(16 + (hash2(i, 0, 22) - 0.5) * 24, 6 + hash2(i, 1, 22) * 14 - (q - 3) * 2, tons[2], q === 5 ? 0.4 : 0.66); // fiapos
  });
  // Poeira do passo: sopro baixo de areia, junto ao chão (base da célula = pés).
  fx("fx_poeira", 32, 32, 4, 80, false, (T, q) => {
    const t = q / 3, tons = ["#f6ecd0", "#e2d0a6", "#c2a878", "#96794e"];
    const cresce = [0.6, 1, 1.05, 0.7][q];
    const bolhas = [[9, 27, 2.8], [23.5, 27.3, 2.7], [19.5, 25.5, 3.3], [12.5, 25.6, 3.2], [16, 26.6, 3.7]]
      .map(([x, y, r], i) => [x + (x - 16) * t * 0.75, y - t * (1.5 + (i % 3)) + (q === 3 ? 0.5 : 0), r * cresce * (q === 3 && i % 2 ? 0.7 : 1)]);
    nuvem(T, bolhas, tons, [1, 1, 1, 0.66][q], 0, 33);
    for (let i = 0; i < 4; i++) T.px(7 + i * 6 + (i - 1.5) * t * 5, 23 - hash2(i, 0, 8) * 3 - t * 5 + t * t * 4, tons[1], q === 3 ? 0.66 : 1);
  }, { origem: [0.5, 1] });

  // ===================================================================
  // SANGUE, VENENO, ÁGUA
  // ===================================================================
  const SANGUE = ["#e2604c", "#b82a22", "#861a1a", "#5a1014"];
  fx("fx_sangue", 32, 32, 5, 60, false, (T, q) => {
    const c = 16, t = q / 4;
    if (q <= 1) T.elipse(c, c, q ? 2.5 : 4, q ? 2.2 : 3.4, (nx, ny) => (nx + ny < -0.5 ? SANGUE[0] : nx + ny > 0.7 ? SANGUE[2] : SANGUE[1]));
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * TAU + hash2(i, 0, 41) * 0.6, v = 7 + hash2(i, 1, 41) * 7, tam = hash2(i, 2, 41);
      const e = Math.min(1, t * 1.15 + 0.12);                    // já sai aberto no quadro 0
      const x = c + Math.cos(ang) * v * e, y = c + Math.sin(ang) * v * e * 0.7 - Math.sin(Math.PI * Math.min(1, t)) * 5 + t * 3;
      if (q < 4) { const x0 = c + Math.cos(ang) * v * (e - 0.22), y0 = y - Math.sin(ang) * v * 0.15 + (t < 0.5 ? 1 : -1); T.linha(x0, y0, x, y, SANGUE[2], q === 3 ? 0.4 : 0.66); }
      const a = q === 4 ? 0.66 : 1;
      T.px(x, y, SANGUE[1], a, true); T.px(x, y + 1, SANGUE[2], a, true);
      if (tam > 0.3) { T.px(x + 1, y, SANGUE[1], a, true); T.px(x + 1, y + 1, SANGUE[3], a, true); T.px(x, y, SANGUE[0], a, true); }
      if (tam > 0.65 && q < 4) { T.px(x - 1, y, SANGUE[1], a, true); T.px(x - 1, y + 1, SANGUE[2], a, true); T.px(x, y - 1, SANGUE[1], a, true); T.px(x + 1, y - 1, SANGUE[2], a, true); T.px(x, y + 2, SANGUE[3], a, true); T.px(x + 1, y + 2, SANGUE[3], a, true); }
    }
  });
  // Poça em 3 estados: fresca, escurecendo, mancha seca.
  fx("fx_poca", 32, 32, 3, 4000, false, (T, q) => {
    const rx = [9.5, 8.6, 7.6][q], ry = [4.6, 4.1, 3.4][q], cx = 16, cy = 18;
    for (let Y = 8; Y < 28; Y++) for (let X = 2; X < 30; X++) {
      const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry, d = Math.hypot(nx, ny) + (ruido(X * 0.3, Y * 0.42, 64) - 0.5) * 0.34;
      if (d > 1) continue;
      if (q === 0) T.px(X, Y, d > 0.8 ? SANGUE[2] : ny < -0.3 && ny > -0.62 && nx < 0.1 && nx > -0.6 ? SANGUE[0] : SANGUE[1], 1);
      else if (q === 1) T.px(X, Y, d > 0.74 ? SANGUE[3] : SANGUE[2], d > 0.9 ? 0.66 : 1);
      else if (hash2(X, Y, 62) > 0.18) T.px(X, Y, d > 0.7 ? "#4a2a22" : "#5e2a22", d > 0.7 || hash2(X, Y, 63) < 0.3 ? 0.33 : 0.66);
    }
    for (const [x, y, n] of [[5, 13, 2], [27, 21, 2], [24, 11, 1], [8, 24, 1]]) {
      if (q === 2 && n === 1) continue;
      T.px(x, y, q === 0 ? SANGUE[1] : q === 1 ? SANGUE[2] : "#5e2a22", q === 2 ? 0.4 : 1);
      if (n > 1 && q < 2) T.px(x + 1, y, SANGUE[2], 1);
    }
    if (q === 0) T.contornar(() => SANGUE[3], 0.66);
  });

  // Veneno: bolhas verdes que sobem de um vapor arroxeado e estouram.
  const VENENO = ["#e4f79a", "#a8d84a", "#6a9a2c", "#3c5e20"];
  fx("fx_veneno", 32, 32, 5, 90, false, (T, q) => {
    const t = q / 4;
    nuvem(T, [[12, 25 - t * 3, 4.2 - t], [19.5, 24 - t * 4, 4.6 - t * 1.4], [16, 21 - t * 5, 3.4]], ["#b488c8", "#8a5ea2", "#643f7c", "#432a58"], [0.66, 0.66, 0.66, 0.66, 0.33][q], 0, 71);
    const BOLHAS = [[9, 24, 3.2, 0], [22, 26, 2.6, 0.15], [15.5, 22, 4, 0.05], [25, 18, 2, 0.3], [6, 17, 1.8, 0.4], [18, 13, 2.4, 0.25]];
    BOLHAS.forEach(([x, y, r, atraso], i) => {
      const k = Math.max(0, t - atraso * 0.6), cy = y - k * (15 + i * 1.5), cx = x + Math.sin(k * 6 + i) * 1.6, vida = k / (0.85 - atraso * 0.5);
      if (t < atraso * 0.6) return;
      if (vida >= 1) {                                           // estourou: gotas em cruz
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, -0.7], [-0.7, -0.7]]) T.px(cx + dx * (r + 1.5), cy + dy * (r + 1.5), VENENO[1], 0.8);
        return;
      }
      T.elipse(cx, cy, r, r, (nx, ny) => {
        const d = Math.hypot(nx, ny);
        return d > 0.62 ? (nx + ny > 0.3 ? VENENO[3] : VENENO[2]) : [VENENO[1], 0.6];
      });
      T.px(cx - r * 0.45, cy - r * 0.45, VENENO[0], 1, true);
      if (r > 3) T.px(cx - r * 0.45 + 1, cy - r * 0.45, VENENO[0], 1, true);
    });
  });
  // Bolha solta do pântano (legado, 6 × 6 px): anel fino com reflexo.
  fx("fx_bolha", 6, 6, 1, 0, false, (T) => {
    for (const [x, y] of [[2, 0], [3, 0], [1, 1], [4, 1], [0, 2], [5, 2], [0, 3], [5, 3], [1, 4], [4, 4], [2, 5], [3, 5]]) T.px(x, y, x + y > 5 ? VENENO[2] : VENENO[1]);
    T.px(2, 1, VENENO[0]); T.px(1, 2, VENENO[0]);
    for (const [x, y] of [[3, 1], [2, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 3], [4, 3], [2, 4], [3, 4]]) T.px(x, y, VENENO[1], 0.4);
  });

  // Respingo de água: coluna, coroa, gotas caindo e a onda que se abre.
  const AGUA = ["#f2fbff", "#bfe6f5", "#7fc0de", "#3f8fba"];
  function anelAgua(T, cx, cy, rx, ry, cor, a, furo, sem) {
    const n = Math.ceil(rx * 7);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU;
      if (furo && hash2(Math.floor(i / 3), 0, sem) < furo) continue;
      T.px(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, Math.sin(t) < -0.2 ? cor[1] : cor[0], a);
    }
  }
  fx("fx_respingo_agua", 32, 32, 4, 80, false, (T, q) => {
    const cx = 16, cy = 23;
    const rx = [4.5, 7.5, 10.5, 13.5][q], ry = rx * 0.42;
    if (q < 3) T.elipse(cx, cy, rx - 1, ry - 0.6, [AGUA[2], q === 0 ? 0.66 : 0.4]);
    anelAgua(T, cx, cy, rx, ry, [AGUA[1], AGUA[3]], q === 3 ? 0.66 : 1, q === 3 ? 0.3 : 0, 5);
    if (q >= 2) anelAgua(T, cx, cy, rx * 0.5, ry * 0.5, [AGUA[1], AGUA[2]], q === 3 ? 0.4 : 0.66, 0.2, 6);
    // coroa: pontas de água que sobem e caem
    const PONTAS = [[-0.85, 0.55], [-0.45, 0.85], [0, 1], [0.42, 0.8], [0.85, 0.5]];
    const alt = [7, 12, 6, 0][q];
    PONTAS.forEach(([p, k], i) => {
      const h = Math.round(alt * k * (0.85 + 0.3 * hash2(i, 0, 9)));
      if (h < 2) return;
      const x0 = cx + p * (rx - 1), abre = p * (q === 0 ? 1 : 3.5);
      for (let j = 0; j <= h; j++) {
        const u = j / h, x = x0 + abre * u * u, y = cy - 1 - j + Math.abs(p) * 1.2;
        T.px(x, y, u > 0.75 ? AGUA[0] : u > 0.35 ? AGUA[1] : AGUA[2], 1, true);
        if (u < 0.55) T.px(x + (p <= 0 ? 1 : -1), y, AGUA[3], 1);
        if (u < 0.3 && h > 5) T.px(x + (p <= 0 ? -1 : 1), y, AGUA[1], 1);
      }
    });
    // gotas soltas
    for (let i = 0; i < 7; i++) {
      const p = (i / 6) * 2 - 1, t = (q + 0.6) / 4, v = 15 + hash2(i, 1, 9) * 8;
      const x = cx + p * (3 + t * 13), y = cy - 2 - v * t * 2.4 + 34 * t * t * 1.25;
      if (y > cy + Math.abs(p) * 2 || q === 0 && i % 2) continue;
      T.px(x, y, AGUA[0], q === 3 ? 0.66 : 1, true); T.px(x, y + 1, AGUA[2], q === 3 ? 0.66 : 1);
      if (hash2(i, 2, 9) > 0.5 && q < 3) T.px(x + 1, y + 1, AGUA[3], 1);
    }
  });

  // ===================================================================
  // CURA, FÉ, MORTE
  // ===================================================================
  // Cura: ciscos de luz verde sobem em espiral a partir de um anel no chão (base da célula = pés).
  const CURA = ["#f4ffe0", "#b9ee84", "#6cc04a"];
  function anelChao(T, cx, cy, rx, ry, cores, a) {
    const n = Math.ceil(rx * 7);
    for (let i = 0; i < n; i++) { const t = (i / n) * TAU; T.px(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, Math.sin(t) > 0.1 ? cores[1] : cores[2], Math.sin(t) > 0.1 ? a : a * 0.66); }
  }
  fx("fx_cura", 32, 48, 6, 90, false, (T, q) => {
    const t = q / 5;
    anelChao(T, 16, 43, 5 + t * 9, 1.8 + t * 2.4, CURA, [1, 1, 1, 0.66, 0.5, 0.33][q]);
    if (q <= 3) T.elipse(16, 43, 4 + t * 6, 1.4 + t * 1.6, [CURA[1], q === 3 ? 0.2 : 0.4]);
    for (let i = 0; i < 8; i++) {
      const atraso = (i % 4) * 0.13, k = (t - atraso) * (1.15 + hash2(i, 0, 81) * 0.5);
      if (k <= 0 || k > 1.05) continue;
      const lado = i % 2 ? 1 : -1, x = 16 + Math.sin(k * 4.4 + i * 1.3) * (4 + i % 3 * 2.2) * lado, y = 42 - k * (30 + (i % 3) * 4);
      const r = k < 0.2 ? 1 : k < 0.7 ? (i % 3 === 0 ? 3 : 2) : 1;
      for (let j = 1; j <= 3; j++) T.px(16 + Math.sin((k - j * 0.035) * 4.4 + i * 1.3) * (4 + i % 3 * 2.2) * lado, y + j * 2, CURA[2], j === 1 ? 0.66 : 0.33); // rastro
      if (k > 0.85) T.px(x, y, CURA[1], 0.66); else cintila(T, Math.round(x), Math.round(y), r, CURA);
    }
  }, { origem: [0.5, 1] });

  // Luz da fé: um facho que desce do alto (largo em cima, fino no chão), abre e se desfaz em ciscos de ouro.
  const OURO = ["#fffdf0", "#ffe9a0", "#f0bf4e"];
  fx("fx_luz_fe", 32, 48, 6, 90, false, (T, q) => {
    const larg = [1.2, 3.6, 6.2, 5.2, 2.6, 0][q];
    if (larg) for (let Y = 0; Y < 44; Y++) {
      const k = 1 - Y / 44, w = larg * (0.55 + 0.75 * k);
      for (let X = 0; X < 32; X++) {
        const d = Math.abs(X + 0.5 - 16) / w;
        if (d > 1) continue;
        const fura = q >= 3 && d > 0.3 && hash2(X, Y >> 2, 90 + q) < (q - 2) * 0.3;
        if (fura) continue;
        T.px(X, Y, d < 0.34 ? (q === 4 ? OURO[1] : OURO[0]) : d < 0.7 ? (q === 4 ? OURO[2] : OURO[1]) : OURO[2], (d < 0.7 ? 1 : 0.66) * (Y < 5 ? 0.4 + Y * 0.12 : 1));
      }
    }
    // raios finos ao lado do facho
    if (q >= 1 && q <= 4) for (const [dx, y0, y1] of [[-9, 6, 30], [9, 2, 26], [-12.5, 14, 36], [12, 12, 34]]) {
      if (Math.abs(dx) > 10 && (q < 2 || q > 3)) continue;
      for (let Y = y0; Y <= y1; Y++) T.px(16 + dx * (0.55 + 0.45 * (1 - Y / 44)), Y, OURO[1], (q === 4 ? 0.33 : 0.66) * (Y < y0 + 3 || Y > y1 - 3 ? 0.5 : 1));
    }
    anelChao(T, 16, 43, [3, 6, 10, 12.5, 14, 14.5][q], [1.4, 2.2, 3.2, 3.8, 4.2, 4.4][q], OURO, [1, 1, 1, 0.8, 0.5, 0.33][q]);
    if (q >= 1 && q <= 4) T.elipse(16, 43, [0, 4.5, 8, 9, 8][q], [0, 1.5, 2.4, 2.6, 2.2][q], (nx, ny) => [nx * nx + ny * ny < 0.4 && q < 4 ? OURO[0] : OURO[1], q >= 4 ? 0.66 : 1]);
    // ciscos que sobem
    if (q >= 2) for (let i = 0; i < 9; i++) {
      const k = (q - 2) / 3 + hash2(i, 0, 93) * 0.35, x = 16 + (hash2(i, 1, 93) - 0.5) * 22, y = 40 - k * 30 - hash2(i, 2, 93) * 8;
      if (q === 5 && i % 3 === 0) continue;
      if (i % 3 === 0 && q < 5) cintila(T, Math.round(x), Math.round(y), 2, OURO); else T.px(x, y, i % 2 ? OURO[1] : OURO[2], q === 5 ? 0.66 : 1);
    }
    if (q <= 2) T.halo("#f0bf4e", 0.3);
  }, { origem: [0.5, 1] });

  // Morte: o vulto vira luz e pó que sobem ("és pó, e ao pó tornarás"). Base da célula = pés.
  const PO = ["#efe2c0", "#cdb68a", "#9c8460"];
  fx("fx_morte", 48, 48, 6, 90, false, (T, q) => {
    const t = q / 5, cx = 24, cy = 30, rx = 10.5, ry = 13;
    const corroi = [-1, 0.34, 0.52, 0.8, 2, 2][q];
    if (corroi < 1.5) for (let Y = 12; Y < 46; Y++) for (let X = 8; X < 40; X++) {
      const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry, d = Math.hypot(nx, ny) + (ruido(X * 0.3, Y * 0.3, 101) - 0.5) * 0.3;
      if (d > 1) continue;
      // corrói de cima para baixo e de fora para dentro
      const resiste = ruido(X * 0.2, Y * 0.2, 102) * 0.34 + (ny * 0.5 + 0.5) * 0.56 + (1 - d) * 0.1;
      if (resiste < corroi) continue;
      const borda = resiste - corroi < 0.05 && corroi > 0;
      T.px(X, Y, borda ? PO[1] : d < 0.5 ? OURO[0] : d < 0.8 ? OURO[1] : OURO[2], q === 0 && d > 0.9 ? 0.66 : 1);
    }
    if (q <= 2) T.halo("#f0bf4e", 0.4);
    // grãos de pó e ciscos de luz que se soltam e sobem
    if (q >= 1) for (let i = 0; i < 46; i++) {
      const ang = hash2(i, 0, 104) * TAU, rr = Math.sqrt(hash2(i, 1, 104)), nasce = hash2(i, 2, 104) * 0.5;
      const k = t - nasce * 0.6;
      if (k <= 0) continue;
      const vida = k / (0.55 + hash2(i, 3, 104) * 0.45);
      if (vida > 1.15) continue;
      const x = cx + Math.cos(ang) * rr * rx * (1 + k * 0.7) + Math.sin(k * 7 + i) * 1.5, y = cy + Math.sin(ang) * rr * ry - k * (20 + hash2(i, 4, 104) * 16);
      const a = vida > 0.85 ? 0.4 : vida > 0.6 ? 0.66 : 1;
      if (i % 5 === 0 && vida < 0.8) cintila(T, Math.round(x), Math.round(y), i % 10 === 0 ? 2 : 1, OURO, a);
      else { T.px(x, y, i % 3 === 0 ? PO[0] : i % 3 === 1 ? PO[1] : PO[2], a); if (i % 4 === 0 && vida < 0.5) T.px(x + 1, y, PO[2], a); }
    }
    // pó que assenta no chão
    if (q >= 2) for (let X = 10; X < 38; X++) for (let Y = 42; Y < 47; Y++) {
      const nx = (X + 0.5 - 24) / (8 + t * 6), ny = (Y + 0.5 - 44.5) / 2.2;
      if (nx * nx + ny * ny > 1 || hash2(X, Y, 105) < 0.25 + (q - 2) * 0.17) continue;
      T.px(X, Y, hash2(X, Y, 106) < 0.4 ? PO[1] : PO[2], q >= 4 ? 0.5 : 0.8);
    }
  }, { origem: [0.5, 1] });

  // Restos genéricos por porte: montinho de pó com ossos alvejados e pedrinhas.
  const OSSO = ["#f4ecd6", "#d9cca8", "#a8987a"], MONTE = rampa6("#a8916a", "pedra");
  function monte(T, cx, cy, rx, ry, s) {
    for (let Y = Math.floor(cy - ry - 1); Y <= cy + ry + 1; Y++) for (let X = Math.floor(cx - rx - 1); X <= cx + rx + 1; X++) {
      const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry, d = Math.hypot(nx, ny) + (ruido(X * 0.4, Y * 0.6, s) - 0.5) * 0.45;
      if (d > 1) continue;
      T.px(X, Y, sombrear(MONTE, -(nx * 0.5 + ny * 0.9) * 0.9 + (hash2(X, Y, s + 1) - 0.5) * 0.5, X, Y));
    }
  }
  function osso(T, x0, y0, x1, y1, grosso) {
    T.linha(x0, y0, x1, y1, OSSO[0], 1, true);
    for (let i = 0; i <= 8; i++) T.px(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8, OSSO[0], 1, true);
    if (grosso) { T.linha(x0, y0 + 1, x1, y1 + 1, OSSO[1]); for (let i = 0; i <= 12; i++) T.px(x0 + ((x1 - x0) * i) / 12, y0 + 1 + ((y1 - y0) * i) / 12, OSSO[1], 1, true); }
    for (const [x, y] of [[x0, y0], [x1, y1]]) { T.px(x, y - 1, OSSO[0], 1, true); T.px(x, y + 1 + (grosso ? 1 : 0), OSSO[1], 1, true); T.px(x + (x === x0 ? -1 : 1), y, OSSO[0], 1, true); T.px(x + (x === x0 ? -1 : 1), y + (grosso ? 1 : 0), OSSO[2], 1, true); }
  }
  // costela: arco fino que sai da espinha (x, y) e desce
  function costela(T, x, y, alt, abre) {
    for (let j = 0; j <= alt; j++) { const u = j / alt, X = x + Math.sin(u * Math.PI * 0.9) * abre, Y = y + j; T.px(X, Y, u < 0.6 ? OSSO[0] : OSSO[1], 1, true); if (u > 0.3) T.px(X + 1, Y, OSSO[2], 1); }
  }
  const restos = (chave, W, H, desenhar) => {
    registrar(chave, {
      w: W / 2, h: H / 2, quadros: 1, contorno: null, acabamento: false, textura: false, origem: [0.5, 0.78],
      desenhar(g) { const T = new Tela(W, H); desenhar(T, g); T.contornar(escuro(0.62), 1); T.despejar(g); },
    });
    FX[chave] = { quadros: 1, ms: 0, laco: false };
  };
  restos("fx_restos_p", 32, 32, (T, g) => {
    g.sombra(8.4, 12.8, 6.4, 1.6, "#1c1210", 0.26);
    monte(T, 16, 24.5, 10, 3.2, 111); monte(T, 17, 22.5, 5.5, 2.6, 112);
    // dois ossos cruzados sobre o monte: no porte pequeno, uma forma só lê melhor que um esqueleto
    osso(T, 8, 19, 24, 25, true); osso(T, 8, 25, 24, 18, true);
    for (const [x, y] of [[27, 27], [5, 26]]) { T.px(x, y, MONTE[1], 1, true); T.px(x + 1, y, MONTE[4], 1, true); }
  });
  restos("fx_restos_g", 48, 40, (T, g) => {
    g.sombra(12.4, 16.6, 10, 2.2, "#1c1210", 0.28);
    monte(T, 24, 30, 15, 5, 121); monte(T, 18, 27, 8, 4.4, 122); monte(T, 31, 28, 7, 3.6, 123);
    // espinha e costelas (caixa torácica caída de lado)
    T.linha(16, 20, 34, 22, OSSO[0], 1, true); T.linha(16, 21, 34, 23, OSSO[1], 1, true);
    for (let i = 0; i < 5; i++) costela(T, 18 + i * 3.6, 22 + i * 0.4, 8 - Math.abs(i - 2), 2.6 - i * 0.15);
    for (let i = 0; i < 6; i++) T.px(15 + i * 3.6, 19 + i * 0.4, OSSO[0], 1, true);   // vértebras
    osso(T, 6, 31, 17, 27, true); osso(T, 30, 33, 42, 30, true);
    for (const [x, y] of [[8, 34], [40, 34], [22, 36], [35, 26], [11, 25]]) { T.px(x, y, MONTE[1], 1, true); T.px(x + 1, y, MONTE[4], 1, true); T.px(x, y - 1, MONTE[5], 1, true); }
  });

  // ===================================================================
  // PROJÉTEIS: 3 quadros = horizontal (para a DIREITA), diagonal (direita e CIMA), vertical (para CIMA).
  // O jogo espelha (setFlipX / setFlipY) para as outras 5 direções. Cada desenho é feito no próprio
  // eixo: u ao longo do voo (ponta em +), v de lado; a luz continua vindo de cima e da esquerda.
  // ===================================================================
  const DIRS = [0, -Math.PI / 4, -Math.PI / 2];
  function projetil(chave, ms, forma, depois) {
    registrar(chave, {
      w: 16, h: 16, quadros: 3, contorno: null, acabamento: false, textura: false, origem: [0.5, 0.5],
      desenhar(g, q) {
        const T = new Tela(32, 32), a = DIRS[q], ca = Math.cos(a), sa = Math.sin(a);
        for (let Y = 0; Y < 32; Y++) for (let X = 0; X < 32; X++) {
          const dx = X + 0.5 - 16, dy = Y + 0.5 - 16, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
          // luz: quanto o lado v deste px olha para cima e para a esquerda (-1..1)
          const luz = -Math.sign(v) * (-sa + ca) * 0.7071;
          const r = forma(u, v, luz, X, Y, q);
          if (r) T.px(X, Y, r[0], r[1] === undefined ? 1 : r[1]);
        }
        if (depois) depois(T, q, ca, sa);
        T.despejar(g);
      },
    });
    FX[chave] = { quadros: 3, ms, laco: false, direcoes: ["horizontal", "diagonal", "vertical"] };
  }
  const HASTE = ["#c9a06a", "#8a5a34", "#5a3820"], BRONZE = ["#f2d27a", "#c9963a", "#7e5a1e"], PENA = ["#f6efdc", "#d6c8a4", "#a8432c", "#7a2a1c"];
  projetil("fx_flecha", 0, (u, v, luz, X, Y, q) => {
    const av = Math.abs(v), k = q === 1 ? 0.25 : 0;              // na diagonal o traço engrossa meio px
    if (u >= 7.5 && u <= 13.5) {                                 // ponta de bronze
      const w = (13.5 - u) * 0.5 + 0.35;
      if (av <= w) return [av < 0.5 ? BRONZE[1] : luz > 0 ? BRONZE[0] : BRONZE[2]];
    }
    if (u >= -11 && u < 7.5 && av <= 0.72 + k) return [av < 0.5 + k && luz >= 0 ? HASTE[0] : HASTE[1]];
    if (u >= -13 && u <= -6) {                                   // penas
      const w = Math.min(3.1, (u + 13.4) * 1.5, (-5.6 - u) * 1.1 + 0.6);
      if (av <= w) { const faixaV = u > -10.6 && u < -8.6; return [faixaV ? (luz > 0 ? PENA[2] : PENA[3]) : luz > 0 ? PENA[0] : PENA[1]]; }
    }
    if (u < -13 && u > -15.6 && av < 0.6) return [PENA[1], 0.5];   // risco de vento
    return null;
  }, (T) => T.contornar(escuro(0.62), 1));

  const SEIXO = rampa6("#978a78", "pedra");
  projetil("fx_pedra", 0, (u, v, luz, X, Y) => {
    const du = u - 5.5, d = Math.hypot(du, v * 1.08);
    if (d <= 4.1) {                                              // o seixo
      const dx = X + 0.5 - 16, dy = Y + 0.5 - 16;
      // centro do seixo no mundo: normal aproximada pela posição relativa
      return [sombrear(SEIXO, lim(luz * Math.abs(v) / 4 * 1.4 + (hash2(X, Y, 131) - 0.5) * 0.25 - (d > 3.2 ? 0.25 : 0), -1, 1), X, Y), 1, dx, dy];
    }
    if (u < 3 && u > -13.5) {                                    // rastro de pó, em cunha
      for (const [v0, ini] of [[0, -13.5], [-2.6, -8.5], [2.6, -10.5]])
        if (Math.abs(v - v0) <= 0.55 && u > ini) return ["#f6efdc", u > ini + (v0 ? 4 : 7) ? 0.66 : 0.33];
    }
    return null;
  }, (T, q, ca, sa) => {
    // luz e sombra do seixo refeitas no mundo (a esfera não gira com o voo)
    const cx = 16 + 5.5 * ca, cy = 16 + 5.5 * sa;
    for (let Y = 0; Y < 32; Y++) for (let X = 0; X < 32; X++) {
      const dx = X + 0.5 - cx, dy = Y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > 4.3 || T.alfa(X, Y) < 0.83) continue;
      T.px(X, Y, sombrear(SEIXO, lim(-(dx * 0.6 + dy * 0.8) / 4.1 * 1.25 + (hash2(X, Y, 131) - 0.5) * 0.22, -1, 1), X, Y), 1, true);
    }
    T.px(cx - 1.6, cy - 2, SEIXO[5], 1, true);
    T.contornar((c) => (c === "#eadcb6" || c === "#f6efdc" ? null : misturar(c, "#1c1210", 0.62)), 1);
  });

  projetil("fx_orbe", 0, (u, v, luz, X, Y) => {
    const d = Math.hypot(u - 5, v);
    if (d <= 2.6) return [OURO[0]];
    if (d <= 4.4) return [OURO[1]];
    if (d <= 6) return [OURO[2], 0.66];
    if (u < 5 && u > -14) {                                      // cauda de cometa
      const k = (u + 14) / 19, w = 4.6 * k * k + 0.4, av = Math.abs(v);
      if (av <= w) {
        if (k < 0.55 && hash2(X, Y, 141) < 0.4 - k * 0.4) return null;
        return [av < w * 0.4 ? OURO[1] : OURO[2], k > 0.6 ? (av < w * 0.4 ? 1 : 0.66) : k > 0.3 ? 0.66 : 0.33];
      }
    }
    if (d <= 7.4) return [OURO[2], 0.33];
    return null;
  }, (T, q, ca, sa) => {
    cintila(T, Math.round(16 + 5 * ca - 0.5), Math.round(16 + 5 * sa - 0.5), 7, [OURO[0], OURO[0], OURO[1]]);
    for (let i = 0; i < 4; i++) {                                 // ciscos soltos atrás
      const u = -8 - i * 2.2, v = (hash2(i, 0, 142) - 0.5) * 9;
      T.px(16 + u * ca - v * sa, 16 + u * sa + v * ca, OURO[1], 0.8);
    }
  });

  // ===================================================================
  // MARCADORES DE CHÃO
  // ===================================================================
  // Elipse de traço fino (1 px), com um fio de sombra por baixo para ler em qualquer chão.
  function elipseFina(T, cx, cy, rx, ry, cor, pulo) {
    const n = 220, vistos = new Set();
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU, X = Math.round(cx + Math.cos(t) * rx - 0.5), Y = Math.round(cy + Math.sin(t) * ry - 0.5), id = Y * 64 + X;
      if (pulo && pulo(i / n)) continue;
      if (vistos.has(id)) continue;
      vistos.add(id);
      T.px(X, Y, typeof cor === "function" ? cor(t) : cor, 1, true);
    }
    for (const id of vistos) { const X = id % 64, Y = (id / 64) | 0; if (!T.alfa(X, Y + 1)) T.px(X, Y + 1, "#1c1210", 0.4); }
  }
  // Alvo hostil: elipse tracejada que gira (um terço de traço por quadro: dá a volta em 3 e em 6 quadros;
  // o jogo ainda toca só 4) e cantoneiras de bronze que respiram.
  fx("fx_anel", 40, 20, 6, 125, true, (T, q) => {
    const R = ["#ff8a78", "#e2493e", "#a82a26"];
    elipseFina(T, 20, 9.5, 17, 6.6, (t) => (Math.sin(t) < -0.35 ? R[2] : Math.sin(t) > 0.5 ? R[0] : R[1]), (u) => ((u * 12 - (q % 3) / 3) % 1 + 1) % 1 > 0.62);
    const r = [0, 1, 1, 0, 1, 1][q], C = q >= 3 ? "#fff0b8" : "#ffe08a";
    for (const [x, y, dx, dy] of [[0, 0, 1, 1], [39, 0, -1, 1], [0, 19, 1, -1], [39, 19, -1, -1]]) {
      const X = x + dx * r, Y = y + dy * r;
      for (let i = 0; i < 4; i++) { T.px(X + dx * i, Y, C, 1, true); if (i < 3) T.px(X, Y + dy * i, C, 1, true); }
      T.px(X + dx, Y + dy, "#b8842a", 1, true);
      T.px(X + dx * 4, Y, "#1c1210", 0.4); T.px(X, Y + dy * 3, "#1c1210", 0.4);
    }
  });
  // Alvo amigo: elipse inteira, cor de pergaminho, com um brilho que corre devagar.
  fx("fx_anel_amigo", 40, 20, 6, 160, true, (T, q) => {
    const fase = (q / 6) * TAU;
    elipseFina(T, 20, 9.5, 17, 6.6, (t) => { const d = Math.cos(t - fase); return d > 0.86 ? "#fffbe8" : Math.sin(t) < -0.35 ? "#cdb98c" : "#f3e4c0"; });
  });

  // Aura do saque e do campeão (branca: o jogo tinge) e clarão quente, agora em px e com 3 níveis de alfa.
  registrar("fx_aura", {
    w: 28, h: 12, quadros: 1, contorno: null, acabamento: false, textura: false, origem: [0.5, 0.5],
    desenhar: (g) => M.prim.elipF(g, 28, 12, 26.5, 10.6, (nx, ny) => { const d = nx * nx + ny * ny; return comAlfa("#ffffff", d < 0.2 ? 0.75 : d < 0.5 ? 0.45 : d < 0.8 ? 0.2 : 0.1); }),
  });
  FX.fx_aura = { quadros: 1, ms: 0, laco: false };
  fx("fx_luz_quente", 48, 16, 1, 0, false, (T) => {
    T.elipse(24, 8, 22.5, 7.2, (nx, ny) => { const d = nx * nx + ny * ny; return d < 0.48 ? ["#ffe2a8", 1] : d < 0.8 ? ["#c88a4a", 1] : ["#c88a4a", 0.66]; });
  });

  // Borboleta das campinas (2 quadros: asas abertas, asas fechadas), 10 × 8 px.
  fx("fx_borboleta", 10, 8, 2, 125, true, (T, q) => {
    const A = ["#fffbe8", "#f3e4c0", "#d9b46a"], C = "#5a3a24";
    if (q === 0) {
      for (const s of [-1, 1]) {
        const x = (d) => 4.5 + s * (d + 0.5);
        for (const [d, y, c] of [[1, 1, 1], [2, 0, 0], [3, 0, 0], [4, 1, 1], [1, 2, 0], [2, 1, 0], [3, 1, 0], [2, 2, 0], [3, 2, 2], [4, 2, 1], [1, 3, 1], [2, 3, 1], [3, 4, 1], [1, 4, 0], [2, 4, 2], [1, 5, 1], [2, 5, 1]]) T.px(Math.floor(x(d)), y, A[c]);
      }
    } else {
      for (const s of [-1, 1]) { const X = s < 0 ? 3 : 6; for (let y = 0; y <= 5; y++) T.px(X, y, y === 0 || y === 5 ? A[1] : y === 3 ? A[2] : A[0]); T.px(s < 0 ? 2 : 7, 1, A[1], 0.66); T.px(s < 0 ? 2 : 7, 2, A[1]); }
    }
    for (let y = 1; y <= 5; y++) { T.px(4, y, C, 1, true); T.px(5, y, C, 1, true); }
    T.px(4, 0, C, 0.66); T.px(5, 0, C, 0.66);
  });

  // Tabela dos efeitos legados que ficam como estão (1 quadro).
  for (const k of ["fx_pilar", "fx_pixel", "fx_faixa", "fx_sombra", "fx_sombra_g", "fx_sombra_lobo"]) if (M.PIXEL_PATTERNS[k] && !FX[k]) FX[k] = { quadros: M.PIXEL_PATTERNS[k].quadros || 1, ms: 0, laco: false };
})(typeof window !== "undefined" ? window : globalThis);
