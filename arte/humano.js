// =====================================================================
// arte/humano.js — esqueleto humano novo: corpo, cabeça, moldes e poses.
// Pacote A4 (prévia) e H2 (ativação) do plano de arte. A4: esqueleto e prévias; a ativação nas chaves reais é do H2 (arte/humano-equip.js).
//
// Chaves que este arquivo assume (registrar() com a MESMA chave troca o desenho legado de sprites.js):
//   pv_humano_manto pv_humano_curta pv_humano_veu pv_humano_grande (prévias, 48 × 64 px)
//   expõe Arte.motor.novoHumano; as chaves reais (pj_*, os in_* humanos e pj_jogador|…) só são
//   assumidas por Arte.motor.definirHumano em arte/humano-equip.js, com o equipamento inteiro
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
  const { registrar, misturar, hash2, sombrear, prim } = M;

  // -------------------------------------------------------------------
  // Geometria (px da célula de 48 × 64): eixo do corpo em x = 24 (entre as colunas 23 e 24), pés na
  // linha 61, topo da cabeça na linha 9 (7 no porte grande): corpo de 53 px (55), cabeça de 11 px.
  // Vista oblíqua de cima: o topo da cabeça (cabelo) ocupa quase metade dela e o rosto fica na parte
  // de baixo; o plano de cima dos ombros aparece como uma faixa clara; as pernas são um pouco mais
  // curtas que o tronco pediria e o peito do pé aparece de cima.
  // Coordenadas "contínuas" (membros): o px X cobre [X, X + 1), centro em X + 0,5.
  // -------------------------------------------------------------------
  const W = 24, H = 32, CX = 24, PES = 61, QPV = 8;
  const VISTAS = ["lado", "frente", "costas"];
  const escuro = (c, t = 0.28) => misturar(c, "#1c1210", t);
  const claro = (c, t = 0.2) => misturar(c, "#fff6e0", t);

  // ----- cores -----
  // As letras de coresHumano continuam valendo (H S s B R r d P p q A F V W). Cada material vira uma
  // rampa escuro → claro para sombrear(): o trio dado (claro, médio, escuro) fica no meio da rampa,
  // com a sombra puxada ao púrpura-sépia e a luz ao creme.
  const trio = (R, r, d) => [misturar(d, "#1a0e16", 0.52), misturar(d, "#2e1a2a", 0.24), d, r, R, misturar(R, "#fff2cc", 0.34)];
  const deBase = (b, k = 1) => [misturar(b, "#1a0e16", 0.6 * k), misturar(b, "#2e1a2a", 0.38 * k), misturar(b, "#2e1a2a", 0.18 * k), b, misturar(b, "#fff2cc", 0.22 * k), misturar(b, "#fff2cc", 0.42 * k)];
  const cacheCores = new WeakMap();
  function cores(cfg) {
    let c = cacheCores.get(cfg);
    if (c) return c;
    const arm = cfg.armadura && M.ARMADURAS && M.ARMADURAS[cfg.armadura];
    let k = cfg;
    if (arm && arm.veste) k = Object.assign({}, cfg, { cores: Object.assign({}, cfg.cores, arm.veste), gola: cfg.gola || arm.gola });
    c = M.coresHumano(k);
    c.gola = k.gola || null;
    // pele em 5 tons
    c.Pele = [misturar(c.s, "#2a1018", 0.5), misturar(c.s, "#4a2030", 0.26), c.s, c.S, misturar(c.S, "#ffe6c4", 0.3)];
    const pelo = (b) => [misturar(b, "#140a10", 0.6), misturar(b, "#1e1018", 0.4), misturar(b, "#1e1018", 0.18), b, misturar(b, "#f6e2b8", 0.16), misturar(b, "#f6e2b8", 0.34)];
    c.Cab = pelo(c.H);
    c.Barba = c.B === c.H ? c.Cab : pelo(c.B);
    c.Tronco = trio(c.R, c.r, c.d);
    c.Pernas = c.P ? trio(c.P, c.p || escuro(c.P, 0.15), c.q || escuro(c.P, 0.32)) : c.Tronco;
    c.Manga = cfg.mangaCor ? deBase(cfg.mangaCor) : c.Tronco;
    c.Cinto = [misturar(c.A, "#1a0e16", 0.5), misturar(c.A, "#2e1a2a", 0.25), c.A, misturar(c.A, "#fff2cc", 0.3)];
    c.Sand = [misturar(c.F, "#140a10", 0.45), c.F, misturar(c.F, "#f2cf9a", 0.24)];
    const Vc = cfg.capuz ? cfg.capuz[0] : c.V || "#8a8478", Wc = cfg.capuz ? cfg.capuz[1] : c.W || escuro(Vc);
    c.Veu = [misturar(Wc, "#1a0e16", 0.45), misturar(Wc, "#2e1a2a", 0.15), misturar(Vc, Wc, 0.6), Vc, misturar(Vc, "#fff2cc", 0.22), misturar(Vc, "#fff2cc", 0.42)];
    c.olho = misturar(c.o, "#1a0e16", 0.3);
    c.boca = misturar(c.s, "#7a2a24", 0.42);
    cacheCores.set(cfg, c);
    return c;
  }

  // ----- pose -----
  // Âncoras em px da célula. dy: sobe-e-desce do tronco (contato desce 1, passagem sobe 1); dx: avanço
  // do tronco (de lado). passo: 1 no contato A, −1 no B; fase: 0 contato A, 1 passagem A, 2 contato B,
  // 3 passagem B (−1 fora do andar); golpe: 1 antecipação, 2 golpe. Mãos: centro [x, y] (a mão ocupa
  // x−1..x+1, y−1..y+1). De frente a mão da arma é a da esquerda da tela; de costas, a da direita.
  // Pés: pe = { perto/longe (de lado) ou e/d (frente e costas): [x, base, erguido] }.
  function pose(vista, q, cfg) {
    if (typeof vista === "number") vista = VISTAS[vista] || "lado";
    cfg = cfg || {};
    const G = cfg.porte === "grande" ? 2 : 0, L = cfg.porte === "grande" ? 1 : 0;
    const fase = q >= 2 && q <= 5 ? q - 2 : -1, passo = q === 2 ? 1 : q === 4 ? -1 : 0, golpe = q === 6 ? 1 : q === 7 ? 2 : 0;
    let dy = q === 1 || q === 2 || q === 4 ? 1 : q === 3 || q === 5 ? -1 : 0, dx = 0;
    if (vista === "lado") { dx = golpe === 1 ? -1 : golpe === 2 ? 2 : 0; if (golpe === 2) dy = 1; }
    else if (vista === "frente") dy = golpe === 1 ? -1 : golpe === 2 ? 2 : dy;
    else dy = golpe === 1 ? 1 : golpe === 2 ? -1 : dy;
    const cx = CX + dx;
    const P = { vista, q, dy, dx, cx, passo, fase, golpe, G, L, T: 9 - G + dy, yT: 20 - G + dy, yC: 34 + dy, yR: 36 + dy, pes: PES };
    P.quadril = [cx, P.yR + 2];
    const m = 38 + dy;
    if (vista === "lado") {
      P.ombroE = P.ombroD = [cx - 1, P.yT + 4];
      // braço de perto ao contrário da perna de perto; o de longe aparece no balanço
      const bal = [-6, -2, 6, 2][fase] || 0, sobe = fase === 0 || fase === 2 ? 2 : 0;
      P.maoArma = golpe === 1 ? [cx - 8, P.yT + 2] : golpe === 2 ? [cx + 12, P.yT + 7] : [cx + bal, m - sobe];
      P.maoLonge = fase >= 0 ? [cx - bal + (bal < 0 ? 1 : -1), m - sobe - 1] : golpe ? [cx + (golpe === 1 ? 5 : -4), m - 4] : null;
      P.maoEscudo = P.maoLonge && P.maoLonge[0] > cx ? P.maoLonge : [cx + 6, P.yT + 12];
      const pp = [[6, PES, 0], [0, PES, 0], [-6, PES, 1], [2, PES - 4, 2]][fase], pl = [[-6, PES, 1], [2, PES - 4, 2], [6, PES, 0], [0, PES, 0]][fase];
      P.pe = {
        perto: golpe === 2 ? [CX + 7, PES, 0] : golpe === 1 ? [CX + 1, PES, 0] : pp ? [CX + pp[0], pp[1], pp[2]] : [CX + 2, PES, 0],
        longe: golpe === 2 ? [CX - 6, PES, 1] : golpe === 1 ? [CX - 3, PES, 0] : pl ? [CX + pl[0], pl[1], pl[2]] : [CX - 2, PES, 0],
      };
      return P;
    }
    const frente = vista === "frente";
    const ob = (cfg.molde === "veu" ? 7 : 8) + L;
    P.ombroE = [cx - ob, P.yT + 5]; P.ombroD = [cx + ob, P.yT + 5];
    // contato A: perna da esquerda da tela à frente, braço da direita à frente
    const bE = [-3, -1, 3, 1][fase] || 0; // braço da esquerda: + = para a frente
    const s = frente ? 1 : -1; // para a frente = para baixo (de frente) ou para cima (de costas)
    const xE = cx - ob - 1, xD = cx + ob;
    const mE = [xE + (bE > 0 ? 1 : 0), m + s * bE], mD = [xD - (bE < 0 ? 1 : 0), m - s * bE];
    if (frente) {
      P.maoArma = golpe === 1 ? [cx - 13 - L, P.yT - 3] : golpe === 2 ? [cx - 8 - L, m + 5] : mE;
      P.maoEscudo = golpe === 1 ? [xD - 1, m - 2] : golpe === 2 ? [xD + 1, m - 5] : mD;
    } else {
      P.maoArma = golpe === 1 ? [cx + 12 + L, m + 1] : golpe === 2 ? [cx + 14 + L, P.yT - 1] : mD;
      P.maoEscudo = golpe === 1 ? [xE, m] : golpe === 2 ? [xE + 1, m - 2] : mE;
    }
    // pés: [x do centro, base, erguido]; o da frente (de frente) desce até a linha dos pés, o de trás sobe
    const pe = (lado) => {
      const xc = CX + (lado < 0 ? -3 : 3) + lado * L;
      if (fase < 0) { // no golpe, o pé do lado da arma avança (de frente desce; de costas sobe) e o outro fica atrás
        if (golpe !== 2) return [xc, PES, 0];
        const arma = (lado < 0) === frente;
        return frente ? (arma ? [xc, PES, 0] : [xc, PES - 3, 1]) : arma ? [xc, PES - 3, 0] : [xc, PES, 1];
      }
      const meu = lado < 0 ? fase : (fase + 2) % 4; // 0 este pé à frente, 1 plantado, 2 atrás, 3 passando erguido
      if (frente) return meu === 0 ? [xc, PES, 0] : meu === 1 ? [xc, PES, 0] : meu === 2 ? [xc, PES - 3, 1] : [xc, PES - 3, 2];
      return meu === 0 ? [xc, PES - 3, 0] : meu === 1 ? [xc, PES, 0] : meu === 2 ? [xc, PES, 1] : [xc, PES - 2, 2];
    };
    P.pe = { e: pe(-1), d: pe(1) };
    return P;
  }

  // ----- primitivas locais -----
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // Membro com volume: cápsula de (x0, y0) a (x1, y1), largura w0 → w1, luz de cima e da esquerda.
  // o = { vies, pont, faixas: [[t0, t1, rampa]] (tiras atravessadas: mangas, correias), fim: cor do último px }
  function membro(G, x0, y0, x1, y1, w0, w1, R, o) {
    o = o || {};
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-6, rm = Math.max(w0, w1) / 2 + 1, vies = o.vies || 0;
    for (let Y = Math.floor(Math.min(y0, y1) - rm); Y <= Math.ceil(Math.max(y0, y1) + rm); Y++)
      for (let X = Math.floor(Math.min(x0, x1) - rm); X <= Math.ceil(Math.max(x0, x1) + rm); X++) {
        const px = X + 0.5 - x0, py = Y + 0.5 - y0, t = clamp((px * dx + py * dy) / l2, 0, 1);
        const r = (w0 + (w1 - w0) * t) / 2, ex = px - dx * t, ey = py - dy * t;
        if (ex * ex + ey * ey > r * r) continue;
        let rampa = R;
        if (o.faixas) for (const f of o.faixas) if (t >= f[0] && t <= f[1]) rampa = f[2];
        let l = (-(0.95 * ex + 0.5 * ey) / r) * 1.05 + vies;
        if (o.topo && t < 0.3) l += o.topo * (1 - t / 0.3);
        if (o.vinco && ex * o.vinco > r - 1.15) l = o.vincoL === undefined ? -0.8 : o.vincoL; // vinco escuro do lado do corpo
        G.fino(X, Y, sombrear(rampa, clamp(l, -1, 1), X, Y, !!o.pont));
      }
  }
  // Junta de 2 segmentos (cotovelo, joelho): lado = +1 dobra para a esquerda de quem vai de a para b.
  function junta(ax, ay, bx, by, l1, l2, lado, k) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1e-3, dm = Math.min(d, l1 + l2 - 0.01);
    const a = (l1 * l1 - l2 * l2 + dm * dm) / (2 * dm), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)) * (k === undefined ? 1 : k), ux = dx / d, uy = dy / d;
    return [ax + ux * a - uy * h * lado, ay + uy * a + ux * h * lado];
  }
  // Linha de px [x0, x1] com função de luz por coluna (t de 0 a 1) e rampa.
  function faixa(G, Y, x0, x1, R, luz, pont) {
    const n = Math.max(1, x1 - x0);
    for (let X = x0; X <= x1; X++) G.fino(X, Y, sombrear(R, clamp(luz((X - x0) / n, X), -1, 1), X, Y, pont === true));
  }
  function mao(G, c, x, y, o) {
    o = o || {};
    const R = c.Pele, v = o.vies || 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (i === 1 && j === -1 && !o.cheia) continue;
      G.fino(x + i, y + j, sombrear(R, 0.35 - 0.5 * i - 0.45 * j + v, 0, 0, false));
    }
  }

  // ----- cabeça (11 linhas, T..T+10) -----
  const HW = [3, 4, 5, 5, 5, 5, 5, 5, 5, 4, 3]; // meia largura de frente/costas
  // perfil (virado para a direita): [x0, x1] relativos ao eixo
  const PERFIL = [[-3, 2], [-4, 3], [-5, 4], [-5, 4], [-5, 4], [-5, 4], [-5, 4], [-5, 5], [-4, 4], [-4, 3], [-2, 2]];
  const FRANJA = [1, 1, 1, 0, 1, 1, 0, 1, 1, 1];
  function cabeca(G, cfg, c, P) {
    const v = P.vista, T = P.T, cx = P.cx, yT = P.yT;
    const veu = cfg.molde === "veu" || !!cfg.capuz, longo = cfg.cabelo === "longo", careca = cfg.cabelo === "careca", barba = cfg.barba !== false;
    const Pl = c.Pele, Hc = c.Cab, V = c.Veu, Bb = c.Barba;
    const sem = M.sementeDe ? M.sementeDe(c.H) % 97 : 7;
    const cab = (X, Y, nx, ny) => sombrear(Hc, clamp(0.38 - 0.85 * nx - 1.0 * ny + (hash2(X, 3, sem) - 0.5) * 0.55 + (hash2(X, Y, sem + 5) - 0.5) * 0.2, -1, 1), X, Y, false);
    const pele = (X, Y, nx, ny, extra) => sombrear(Pl, clamp(0.42 - 0.8 * nx - 0.3 * ny + (extra || 0), -1, 1), X, Y, false);
    const pano = (X, Y, t, extra) => sombrear(V, clamp(0.7 - 1.45 * t + (extra || 0), -1, 1), X, Y, false);
    if (v !== "lado") {
      const frente = v === "frente";
      // pescoço
      for (let Y = T + 10; Y <= yT + 1; Y++) for (let X = cx - 2; X <= cx + 1; X++) G.fino(X, Y, Pl[X < cx ? 1 : 0]);
      // cabelo comprido: atrás dos ombros (de frente, duas mechas ao lado do rosto; de costas, sobre as costas)
      if (longo && !veu) {
        if (frente) for (let Y = T + 4; Y <= yT + 4; Y++) for (const X of [cx - 7, cx - 6, cx + 5, cx + 6]) { if ((Y === yT + 4 || Y === T + 4) && (X === cx - 7 || X === cx + 6)) continue; G.fino(X, Y, cab(X, Y, X < cx ? -0.5 : 0.9, 0.2)); }
        else for (let Y = T + 8; Y <= yT + 8; Y++) { const k = Y > yT + 5 ? Y - yT - 5 : 0, hw = 6 - k; for (let X = cx - hw; X < cx + hw; X++) G.fino(X, Y, cab(X, Y, (X + 0.5 - cx) / 6, (Y - T - 8) / (yT - T) - 0.3)); }
      }
      // orelhas
      if (!veu && !longo) for (const Y of [T + 5, T + 6]) { G.fino(cx - 6, Y, Pl[Y === T + 5 ? 3 : 2]); G.fino(cx + 5, Y, Pl[1]); }
      for (let r = 0; r < 11; r++) {
        const hw = HW[r], Y = T + r, vol = r >= 2 && r <= 3 ? 1 : 0;
        for (let X = cx - hw - vol; X < cx + hw + vol; X++) {
          const i = X - cx + 5, nx = (X + 0.5 - cx) / 5.2;
          let pelo;
          if (i < 0 || i > 9) { if (!careca && !veu && r >= 1 && r <= 3) G.fino(X, Y, cab(X, Y, nx, frente ? (r - 1.6) / 3.4 : (r - 3.6) / 6)); continue; }
          if (careca) pelo = false;
          else if (frente) pelo = r <= 2 || (r === 3 && FRANJA[i]) || (r <= 6 && (i === 0 || i === 9)) || (r === 4 && (i === 1 || i === 8));
          else pelo = r <= 8 || (longo && r <= 10);
          if (pelo) G.fino(X, Y, cab(X, Y, nx, frente ? (r - 1.3) / 3 : (r - 3.6) / 6));
          else if (!frente) G.fino(X, Y, careca ? pele(X, Y, nx, (r - 3) / 6, -0.15) : Pl[X < cx - 1 ? 2 : 1]);
          else G.fino(X, Y, pele(X, Y, nx, (r - 7) / 4, r <= 4 && !careca ? -0.25 : careca && r <= 2 ? 0.35 : 0));
        }
      }
      if (frente) {
        // sobrancelha em sombra, olhos de 1 px, nariz, boca
        const sob = careca || veu ? Pl[1] : misturar(Hc[1], Pl[1], 0.5);
        for (const X of [cx - 3, cx - 2, cx + 1, cx + 2]) G.fino(X, T + 5, X === cx - 3 || X === cx + 2 ? Pl[2] : sob);
        G.fino(cx - 2, T + 6, c.olho); G.fino(cx + 1, T + 6, c.olho);
        G.fino(cx - 3, T + 6, Pl[2]); G.fino(cx + 2, T + 6, Pl[1]);
        G.fino(cx - 1, T + 7, Pl[4]); G.fino(cx, T + 7, Pl[2]);
        G.fino(cx - 4, T + 7, misturar(Pl[3], "#d0503a", 0.2)); G.fino(cx + 3, T + 7, misturar(Pl[2], "#d0503a", 0.2));
        if (barba) {
          for (let r = 7; r <= 12; r++) {
            const hw = r === 7 ? 5 : r <= 10 ? HW[r] : r === 11 ? 3 : 1, Y = T + r;
            for (let X = cx - hw; X < cx + hw; X++) {
              const i = X - cx;
              if (r === 7 && i > -5 && i < 4) continue;
              if (r === 8 && (i === -1 || i === 0)) { G.fino(X, Y, c.boca); continue; }
              G.fino(X, Y, sombrear(Bb, clamp(0.0 - 0.22 * i - (r - 9) * 0.22 + (hash2(X, 1, sem + 3) - 0.5) * 0.5, -1, 1), X, Y, false));
            }
          }
        } else { G.fino(cx - 1, T + 9, c.boca); G.fino(cx, T + 9, misturar(c.boca, Pl[1], 0.4)); G.fino(cx - 1, T + 10, Pl[2]); G.fino(cx, T + 10, Pl[1]); }
      } else if (barba && !veu) { G.fino(cx - 5, T + 8, Bb[2]); G.fino(cx + 4, T + 8, Bb[1]); }
      if (veu) {
        // véu ou capuz: cobre o cabelo, emoldura o rosto e cai sobre os ombros (de costas, até o meio das costas)
        for (let r = -1; r <= 10; r++) {
          const hw = r < 0 ? 4 : Math.min(6, HW[r] + 1), Y = T + r;
          for (let X = cx - hw; X < cx + hw; X++) {
            const i = X - cx, jan = frente && r >= 4 && (i >= -HW[r] + 1 && i < HW[r] - 1);
            if (jan) { if (r === 4) G.fino(X, Y, i === -4 || i === 3 ? V[1] : Hc[i < 0 ? 3 : 2]); continue; }
            G.fino(X, Y, pano(X, Y, (i + hw) / (2 * hw), (r < 3 ? 0.3 - r * 0.1 : 0) - (frente && r >= 4 ? 0.15 : 0)));
          }
        }
        if (frente) {
          for (let Y = T + 9; Y <= yT + 4; Y++) {
            const k = Y >= yT + 1 ? 1 : 0, f = Y === yT + 4 ? 1 : 0;
            for (let X = cx - 6 - k + f; X <= cx - 5 + (Y > T + 10 ? 1 : 0); X++) G.fino(X, Y, pano(X, Y, 0.1 + (X - cx + 7) * 0.12, Y > yT ? -0.1 : 0));
            for (let X = cx + 4 - (Y > T + 10 ? 1 : 0); X <= cx + 5 + k - f; X++) G.fino(X, Y, pano(X, Y, 0.62 + (X - cx - 4) * 0.12));
          }
          for (let X = cx - 3; X <= cx + 2; X++) G.fino(X, T + 11, V[X < cx ? 2 : 1]);
        } else {
          for (let Y = T + 9; Y <= yT + 10; Y++) {
            const k = Y > yT + 7 ? Y - yT - 7 : 0, hw = (Y < T + 11 ? 6 : 7) - k;
            for (let X = cx - hw; X < cx + hw; X++) {
              const t = (X - cx + hw) / (2 * hw);
              G.fino(X, Y, pano(X, Y, t, Math.cos((t * 2.5 + 0.1) * 2 * Math.PI) * 0.42 - 0.1 - (Y - T - 9) * 0.02 - (Y === yT + 10 - k && k ? 0.3 : 0)));
            }
          }
        }
      }
      return;
    }
    // ----- de lado, virado para a direita -----
    for (let Y = T + 10; Y <= yT + 1; Y++) for (let X = cx - 2; X <= cx + 1; X++) G.fino(X, Y, Pl[X < cx ? 2 : 1]);
    if (longo && !veu) for (let Y = T + 5; Y <= yT + 6; Y++) { const k = Y > yT + 4 ? Y - yT - 4 : 0; for (let X = cx - 6 + k; X <= cx - 2; X++) G.fino(X, Y, cab(X, Y, (X - cx + 4) / 4, 0.25)); }
    for (let r = 0; r < 11; r++) {
      const a = PERFIL[r][0] - (r >= 2 && r <= 4 && !careca && !veu ? 1 : 0), b = PERFIL[r][1], Y = T + r;
      for (let i = a; i <= b; i++) {
        const X = cx + i, nx = (i + 0.5) / 5.2;
        const pelo = !careca && (r <= 2 || (r === 3 && i <= 3) || (r === 4 && i <= 0) || (r <= 8 && i <= -2) || (r === 9 && i <= -3 && longo));
        if (pelo) G.fino(X, Y, cab(X, Y, nx * 0.8, (r - 2.2) / 4.5));
        else G.fino(X, Y, pele(X, Y, (i - 1.5) / 4, (r - 7) / 4, (r <= 4 && !careca ? -0.3 : careca && r <= 2 ? 0.3 : 0) + (i <= -2 ? -0.35 : 0.1)));
      }
    }
    // orelha, sobrancelha, olho, nariz, boca
    if (!veu) { G.fino(cx - 1, T + 6, Pl[4]); G.fino(cx - 1, T + 7, Pl[2]); G.fino(cx - 2, T + 6, Pl[2]); }
    G.fino(cx + 2, T + 5, careca || veu ? Pl[1] : misturar(Hc[1], Pl[1], 0.35)); G.fino(cx + 3, T + 5, careca || veu ? Pl[1] : misturar(Hc[1], Pl[1], 0.35));
    G.fino(cx + 3, T + 6, c.olho);
    G.fino(cx + 5, T + 7, Pl[3]); G.fino(cx + 1, T + 7, misturar(Pl[2], "#d0503a", 0.2));
    if (barba) {
      for (let r = 7; r <= 12; r++) {
        const a = r === 7 ? -1 : r <= 9 ? -1 : r === 10 ? 0 : 1, b = r === 7 ? 0 : r === 8 ? 4 : r === 9 ? 4 : r === 10 ? 4 : r === 11 ? 3 : 2, Y = T + r;
        for (let i = a; i <= b; i++) {
          if (r === 8 && i === 4) { G.fino(cx + i, Y, c.boca); continue; }
          G.fino(cx + i, Y, sombrear(Bb, clamp(0.05 - 0.2 * (i - 1) - (r - 9) * 0.22 + (hash2(cx + i, 1, sem + 3) - 0.5) * 0.5, -1, 1), cx + i, Y, false));
        }
      }
    } else { G.fino(cx + 3, T + 9, c.boca); G.fino(cx + 4, T + 9, misturar(c.boca, Pl[2], 0.3)); }
    if (veu) {
      for (let r = -1; r <= 10; r++) {
        const a = r < 0 ? -3 : PERFIL[r][0] - 1, b = r < 0 ? 2 : r <= 3 ? PERFIL[r][1] + (r >= 2 ? 1 : 0) : r === 4 ? 4 : 0, Y = T + r;
        for (let i = a; i <= b; i++) {
          if (r === 4 && i >= 1 && i <= 3) { G.fino(cx + i, Y, Hc[2]); continue; }
          if (r >= 5 && i === 0 && r <= 9) { G.fino(cx + i, Y, V[1]); continue; }
          G.fino(cx + i, Y, pano(cx + i, Y, (i + 6) / 12, r < 3 ? 0.3 - r * 0.1 : 0));
        }
      }
      for (let Y = T + 9; Y <= yT + 8; Y++) {
        const k = Y > yT + 5 ? Y - yT - 5 : 0, a = -7 + k, b = Y <= T + 10 ? 0 : -1;
        for (let i = a; i <= b; i++) G.fino(cx + i, Y, pano(cx + i, Y, (i + 7) / 9, Math.cos((i + 7) * 1.1) * 0.15));
      }
    }
  }

  // ----- pés -----
  // De frente/costas: 5 px de largura; x = centro; base = linha da sola; erguido: 0 no chão, 1 atrás
  // (calcanhar erguido), 2 no ar (passando).
  function peFrente(G, c, x, base, erg, frente, longe) {
    const Pl = c.Pele, S = c.Sand, e = longe ? 1 : 0;
    const p = (i) => Pl[clamp((i <= 0 ? 4 : i >= 3 ? 2 : 3) - e - (frente ? 0 : 1), 0, 4)];
    if (frente) {
      if (erg === 2) { // no ar: a ponta do pé para baixo, curto
        for (let i = 0; i < 4; i++) { G.fino(x - 2 + i, base - 2, i === 1 || i === 2 ? S[1] : p(i)); G.fino(x - 2 + i, base - 1, p(i)); G.fino(x - 2 + i, base, i === 0 || i === 3 ? S[0] : p(i + 1)); }
        return;
      }
      for (let i = 0; i < 5; i++) {
        const X = x - 2 + i - (i > 4 ? 1 : 0);
        if (i >= 1 && i <= 3) G.fino(X, base - 3, i === 2 ? S[1] : p(i));
        G.fino(X, base - 2, i === 2 ? S[2] : i === 0 || i === 4 ? S[1] : p(i));
        if (erg === 1) { G.fino(X, base - 1, S[0]); continue; }
        G.fino(X, base - 1, i === 2 ? S[1] : p(i));
        G.fino(X, base, S[0]);
      }
      return;
    }
    // de costas: calcanhar e a sola; atrás (erg 1) ou no ar (erg 2) a sola aparece
    for (let i = 0; i < 4; i++) {
      const X = x - 2 + i;
      G.fino(X, base - 2, i === 0 || i === 3 ? S[1] : p(i));
      G.fino(X, base - 1, erg ? S[1] : p(i));
      G.fino(X, base, erg ? S[0] : S[0]);
      if (erg === 2) G.fino(X, base - 3, S[1]);
    }
  }
  // De lado: ponta à direita; x = tornozelo; erguido 1 = calcanhar no ar (ponta no chão), 2 = no ar.
  function peLado(G, c, x, base, erg, longe) {
    const Pl = c.Pele, S = c.Sand, e = longe ? 1 : 0, p = (k) => Pl[clamp(k - e, 0, 4)];
    if (erg === 1) {
      G.fino(x - 2, base - 3, p(2)); G.fino(x - 1, base - 3, S[1]); G.fino(x, base - 3, p(3));
      G.fino(x - 1, base - 2, S[0]); G.fino(x, base - 2, p(3)); G.fino(x + 1, base - 2, S[1]); G.fino(x + 2, base - 2, p(3));
      G.fino(x, base - 1, S[0]); G.fino(x + 1, base - 1, p(2)); G.fino(x + 2, base - 1, p(3)); G.fino(x + 3, base - 1, p(4));
      G.fino(x + 1, base, S[0]); G.fino(x + 2, base, S[0]); G.fino(x + 3, base, S[0]); G.fino(x + 4, base, S[0]);
      return;
    }
    const d = erg === 2 ? 1 : 0; // no ar: a ponta cai 1 px
    for (let i = -2; i <= 1; i++) G.fino(x + i, base - 2, i === 0 ? S[1] : p(i < 0 ? 2 : 3));
    for (let i = -2; i <= 3; i++) G.fino(x + i, base - 1 + (i > 1 ? d : 0), i === 2 ? S[1] : i === -2 ? p(2) : p(i === 3 ? 4 : 3));
    for (let i = -3; i <= 4; i++) G.fino(x + i, base + (i > 1 ? d : 0), i === -3 && d ? null : S[0]);
    if (d) G.fino(x + 2, base - 1, p(3));
  }

  // ----- tronco, saia/veste e pernas -----
  // dobras da veste: luz por coluna (t de 0 a 1), com n dobras que se abrem para baixo
  const dobra = (t, n, fase, forca) => Math.cos((t * n + fase) * 2 * Math.PI) * forca;
  function corpo(G, cfg, c, P, o) {
    o = o || {};
    const v = P.vista, cx = P.cx, L = P.L, { yT, yC, yR, passo, fase, golpe } = P;
    const Tr = c.Tronco, B = c.Pernas, Pl = c.Pele, longo = cfg.molde !== "curta", fem = cfg.molde === "veu";
    const barra = cfg.barra ? c.Cinto : null, montado = !!(o.montado || cfg.montado);
    const PeleLonge = [Pl[0], Pl[0], Pl[1], Pl[2], Pl[3]];
    const fimSaia = 46, fimVeste = 58;
    if (v === "lado") {
      const ox = P.ombroE[0], oy = P.ombroE[1];
      // braço de longe (atrás do tronco)
      if (P.maoLonge && !montado) {
        const [hx, hy] = P.maoLonge, ct = junta(ox + 1.5, oy, hx + 0.5, hy - 1, 7.7, 7.7, 1, 0.6);
        const TrL = [Tr[0], Tr[0], Tr[1], Tr[2], Tr[3], Tr[3]];
        membro(G, ox + 1.5, oy, ct[0], ct[1], 4, 3.6, cfg.mangaCor ? c.Manga : TrL, { vies: cfg.mangaCor ? -0.5 : -0.2 });
        membro(G, ct[0], ct[1], hx + 0.5, hy - 1, 3.4, 3, longo ? (cfg.mangaCor ? c.Manga : TrL) : PeleLonge, { vies: -0.3 });
        mao(G, c, hx, hy, { vies: -0.7 });
      }
      if (montado) inferiorMontado(G, cfg, c, P);
      else {
        const [xp, bp, ep] = P.pe.perto, [xl, bl, el] = P.pe.longe;
        const hq = CX + (P.dx > 0 ? 1 : 0);
        if (!longo) {
          // pernas nuas com as correias da sandália; a de longe mais escura
          const perna = (x, base, erg, longe) => {
            const tz = [x - 0.5 + (erg === 1 ? -1 : 0), base - 3 - (erg === 1 ? 1 : 0)], hx = hq + (longe ? -1 : 0.5);
            const j = junta(hx, 44, tz[0], tz[1], 7.5, 8.5, -1, erg === 0 ? (fase < 0 ? 0.2 : 0.45) : 1); // de pé, o joelho quase não dobra
            const R = longe ? PeleLonge : Pl, cor = { faixas: [[0.45, 0.6, [c.Sand[0], c.Sand[0], c.Sand[1], c.Sand[1], c.Sand[2]]]] };
            membro(G, hx, 44, j[0], j[1], 4.6, 4, R, { vies: longe ? -0.5 : 0 });
            membro(G, j[0], j[1], tz[0], tz[1], 3.8, 3, R, Object.assign({ vies: longe ? -0.5 : 0.05 }, cor));
            peLado(G, c, x, base, erg, longe);
          };
          perna(xl, bl, el, true);
          perna(xp, bp, ep, false);
          // saia da túnica: abre no passo, com a prega entre as pernas
          const abre = fase === 0 || fase === 2 ? 3 : fase >= 0 ? 1 : golpe === 2 ? 3 : 0;
          for (let Y = yR; Y <= fimSaia; Y++) {
            const t = (Y - yR) / (fimSaia - yR), a = Math.round(cx - 5 - L - t * (1 + abre)), b = Math.round(cx + 4 + L + t * (1.5 + abre) + (fase === 1 || fase === 3 ? t * 1.5 : 0));
            faixa(G, Y, a, b, B, (u, X) => 0.6 - 1.3 * u + dobra(u, 2.2, 0.15 + fase * 0.13, 0.22 * t) - t * 0.25 - (Y === fimSaia ? 0.45 : 0) - (abre >= 3 && Math.abs(X - hq) < 1 && t > 0.4 ? 0.5 : 0));
            if (barra && Y === fimSaia - 1) for (let X = a; X <= b; X++) G.fino(X, Y, barra[X < a + 3 ? 3 : X > b - 3 ? 1 : 2]);
          }
        } else {
          peLado(G, c, xl, bl, el, true);
          peLado(G, c, xp, bp, ep, false);
          // veste longa em A: a barra acompanha os pés, com o joelho da frente marcando o pano
          const xa = Math.min(xp, xl) - 5, xb = Math.max(xp, xl) + 5, xf = Math.max(xp, xl), andando = fase >= 0 || golpe === 2;
          for (let Y = yR; Y <= fimVeste; Y++) {
            const t = (Y - yR) / (fimVeste - yR), k = Math.pow(t, 1.25);
            const a = Math.round(cx - 5 - L + (xa - (cx - 5 - L)) * k), b = Math.round(cx + 4 + L + (xb - (cx + 4 + L)) * k);
            faixa(G, Y, a, b, B, (u, X) => {
              let l = 0.66 - 1.4 * u + dobra(u, 2.4, 0.1 + (fase >= 0 ? fase * 0.17 : 0), 0.4 * (0.3 + t)) - t * 0.3;
              if (andando && t > 0.3 && Math.abs(X - CX) <= (t > 0.7 ? 1 : 0)) l -= 0.55; // prega funda entre as pernas
              const kx = X - (cx + 2 + (xf - cx - 1) * t * 0.9), ky = (Y - 47) / 5; // joelho da frente
              if (andando) l += Math.max(0, 0.45 - (kx * kx) / 6 - ky * ky * 0.4);
              if (Y >= fimVeste) l -= 0.5;
              else if (Y === fimVeste - 2 && !barra) l -= 0.3;
              return l;
            });
            if (barra && (Y === fimVeste - 1 || Y === fimVeste - 2)) for (let X = a; X <= b; X++) G.fino(X, Y, barra[X < a + 3 ? 3 : X > b - 4 ? 1 : 2]);
          }
        }
      }
      // tronco de perfil: costas arredondadas, peito à frente; o plano dos ombros em luz
      const hw = 5;
      for (let Y = yT; Y < yC; Y++) {
        const i = Y - yT, a = cx - hw - L + (i === 0 ? 2 : i === 1 ? 1 : 0) + (i > 9 ? 1 : 0), b = cx + hw - 1 + L - (i === 0 ? 2 : i === 1 ? 1 : 0) + (i >= 3 && i <= 8 ? 1 : 0) - (i > 10 && !fem ? 0 : 0);
        faixa(G, Y, a, b, Tr, (u) => 0.6 - 1.45 * u + (i <= 1 ? 0.6 : i === 2 ? 0.3 : 0) + (u > 0.6 && i >= 3 && i <= 6 ? 0.22 : 0) - (Y === yC - 1 ? 0.4 : 0) - (i > 8 ? 0.1 : 0));
      }
      if (c.gola) { G.fino(cx + 1, yT, c.gola); G.fino(cx + 2, yT + 1, c.gola); }
      // cinto, com a ponta da faixa caindo à frente
      for (let Y = yC; Y <= yC + 1; Y++) faixa(G, Y, cx - hw - L + 1, cx + hw - 1 + L, c.Cinto, (u) => 0.7 - 1.3 * u - (Y - yC) * 0.5, false);
      if (!montado) for (let Y = yC + 2; Y <= yC + 6; Y++) { G.fino(cx + 2, Y, c.Cinto[2]); G.fino(cx + 3, Y, c.Cinto[Y === yC + 6 ? 0 : 1]); }
      return;
    }
    // ----- frente e costas -----
    const frente = v === "frente";
    const hwT = (fem ? 5 : 6) + L;
    if (montado) inferiorMontado(G, cfg, c, P);
    else {
      const E = P.pe.e, D = P.pe.d;
      // "atrás" = mais longe de quem olha: fica mais escuro
      const longeE = frente ? E[2] === 1 : E[1] < D[1] && E[2] !== 2, longeD = frente ? D[2] === 1 : D[1] < E[1] && D[2] !== 2;
      if (!longo) {
        const perna = (pe, lado, longe) => {
          const x = pe[0] + (lado < 0 ? 0.5 : -0.5), yb = pe[1] - 3, R = longe ? PeleLonge : Pl;
          const dobrado = pe[2] === 2, yj = 44 + (yb - 44) * 0.5;
          const cor = [c.Sand[0], c.Sand[0], c.Sand[1], c.Sand[1], c.Sand[2]];
          membro(G, x, 44, x + (dobrado ? lado * 0.6 : 0), yj, 4.6, 4.2, R, { vies: (lado > 0 ? -0.12 : 0.05) + (dobrado && frente ? 0.3 : 0) });
          membro(G, x + (dobrado ? lado * 0.6 : 0), yj, x, yb, 4, 3.2, R, { vies: lado > 0 ? -0.12 : 0.05, faixas: [[0.3, 0.48, cor], [0.74, 0.9, cor]] });
          peFrente(G, c, pe[0], pe[1], pe[2], frente, longe);
        };
        perna(E, -1, longeE); perna(D, 1, longeD);
        // saia da túnica com pregas; o joelho que avança marca o pano
        for (let Y = yR; Y <= fimSaia; Y++) {
          const t = (Y - yR) / (fimSaia - yR), hw = hwT + (t > 0.25 ? 1 : 0) + (t > 0.7 ? 1 : 0);
          const a = cx - hw, b = cx + hw - 1;
          faixa(G, Y, a, b, B, (u, X) => {
            let l = 0.64 - 1.4 * u + dobra(u, 3, 0.08 + (fase >= 0 ? fase * 0.11 : 0), 0.4 * (0.4 + t)) - t * 0.2 - (t < 0.15 ? 0.3 : 0);
            const jx = fase === 0 || fase === 3 ? (frente ? E[0] : D[0]) : fase === 2 || fase === 1 ? (frente ? D[0] : E[0]) : null;
            if (jx !== null) l += Math.max(0, 0.4 - Math.pow(X - jx, 2) / 5) * t;
            if (Y === fimSaia) l -= 0.45;
            return l;
          });
          if (barra && Y === fimSaia - 1) for (let X = a; X <= b; X++) G.fino(X, Y, barra[X < a + 3 ? 3 : X > b - 4 ? 1 : 2]);
        }
      } else {
        // pés sob a barra; o de trás quase some
        for (const [pe, longe] of [[E, longeE], [D, longeD]]) peFrente(G, c, pe[0], Math.min(PES, pe[1] + (frente ? 0 : 0)), pe[2], frente, longe);
        const jx = fase === 0 || fase === 3 ? E[0] : fase === 2 || fase === 1 ? D[0] : null; // joelho que avança
        const lev = (X) => { // a barra sobe do lado da perna que fica atrás/no ar
          if (fase < 0 && golpe !== 2) return 0;
          const pe = X < CX ? E : D;
          const sobe = frente ? (pe[2] ? 2 : pe[1] < PES ? 1 : 0) : pe[1] <= PES - 3 ? 2 : pe[2] === 2 ? 1 : 0;
          return Math.min(sobe, Math.max(0, Math.abs(X + 0.5 - CX) > 5 ? 2 : Math.abs(X + 0.5 - CX) > 1 ? 1 : 0)); // em degraus suaves a partir do meio
        };
        for (let Y = yR; Y <= fimVeste; Y++) {
          const t = (Y - yR) / (fimVeste - yR), hw = hwT + (t > 0.1 ? 1 : 0) + (t > 0.5 ? 1 : 0);
          const bal = fase >= 0 && t > 0.6 ? (fase === 0 ? -1 : fase === 2 ? 1 : 0) : 0, a = cx - hw + bal, b = cx + hw - 1 + bal;
          for (let X = a; X <= b; X++) {
            const u = (X - a) / (b - a);
            // a barra ondula com as dobras: o fundo de cada dobra fica 1 px mais curto
            const fim = fimVeste - lev(X) - (X === a || X === b || !barra && dobra(u, 3, 0.05 + (fase >= 0 ? fase * 0.12 : 0), 1) < -0.8 ? 1 : 0);
            if (Y > fim) continue;
            let l = 0.66 - 1.4 * u + dobra(u, 3, 0.05 + (fase >= 0 ? fase * 0.12 : 0), 0.42 * (0.3 + t)) - t * 0.3;
            if (jx !== null && frente) l += Math.max(0, 0.5 - Math.pow(X - jx, 2) / 6 - Math.pow((Y - 48) / 6, 2));
            if (fase >= 0 && t > 0.45 && (X === CX - 1 || (t > 0.8 && X === CX))) l -= 0.45;
            if (Y === fim) l -= 0.5;
            else if (Y === fim - 1 && !barra) l -= 0.18; // bainha
            if (barra && (Y === fim - 1 || Y === fim - 2)) { G.fino(X, Y, barra[u < 0.2 ? 3 : u > 0.75 ? 1 : 2]); continue; }
            G.fino(X, Y, sombrear(B, clamp(l, -1, 1), X, Y, false));
          }
        }
      }
    }
    // tronco: ombros em escorço (faixa clara em cima), sombra dos braços e do queixo, pano dobrando no cinto
    for (let Y = yT; Y < yC; Y++) {
      const i = Y - yT, hw = i === 0 ? hwT - 3 : i === 1 ? hwT - 1 : i > 10 && !longo ? hwT - 1 : hwT, a = cx - hw, b = cx + hw - 1;
      faixa(G, Y, a, b, Tr, (u, X) => {
        let l = 0.5 - 1.6 * (u - 0.28) - (u < 0.1 ? 0.3 : 0) + (i <= 1 ? 0.6 : i === 2 ? 0.3 : 0);
        if (frente) { const q = Math.abs(X - cx + 0.5); if (i <= 4 && q < 4.5 - i * 0.6) l -= 0.45; if (i > 6) l += dobra(u, 2.5, 0.05, 0.1 + (i - 6) * 0.05); }
        else { if (i > 1 && Math.abs(X - cx + 0.5) < 1) l -= 0.3; if (i <= 3 && Math.abs(X - cx + 0.5) < 4 - i * 0.5) l -= 0.35; if (i > 8) l += dobra(u, 2.5, 0.3, 0.1 + (i - 8) * 0.05); }
        if (Y === yC - 1) l -= 0.4;
        return l;
      });
    }
    if (frente) {
      // decote em V com a gola
      const gola = c.gola || Tr[1];
      for (let i = 0; i < 3; i++) { for (let X = cx - 2 + i; X <= cx + 1 - i; X++) G.fino(X, yT + i, Pl[i === 0 ? 1 : X < cx ? 3 : 2]); G.fino(cx - 3 + i, yT + i, gola); G.fino(cx + 2 - i, yT + i, gola); }
      if (c.gola) { G.fino(cx - 1, yT + 3, gola); G.fino(cx, yT + 3, gola); }
    } else for (let X = cx - 3; X <= cx + 2; X++) G.fino(X, yT, c.gola || Tr[1]);
    // cinto de faixa: nó à frente e as pontas caindo
    const hwC = (longo ? hwT : hwT - 1);
    for (let Y = yC; Y <= yC + 1; Y++) faixa(G, Y, cx - hwC, cx + hwC - 1, c.Cinto, (u) => 0.75 - 1.4 * u - (Y - yC) * 0.5, false);
    if (frente && !montado) {
      G.fino(cx - 2, yC, c.Cinto[3]); G.fino(cx - 1, yC, c.Cinto[3]); G.fino(cx - 2, yC + 1, c.Cinto[2]); G.fino(cx - 1, yC + 1, c.Cinto[1]);
      for (let Y = yC + 2; Y <= yC + 7; Y++) { G.fino(cx - 2, Y, c.Cinto[Y > yC + 5 ? 1 : 2]); G.fino(cx - 1, Y, c.Cinto[Y === yC + 7 ? 0 : 1]); }
    } else if (!frente) { G.fino(cx - 1, yC, c.Cinto[0]); G.fino(cx, yC, c.Cinto[0]); }
  }

  // Montado: a veste abre sobre a sela. De lado, a coxa vai para a frente e a canela desce; de frente
  // e de costas, as pernas abrem para os lados da montaria. O pé fica em P.yR + 20.
  function inferiorMontado(G, cfg, c, P) {
    const longo = cfg.molde !== "curta", B = c.Pernas, Pl = c.Pele, yR = P.yR, cx = P.cx;
    const R = longo ? B : Pl, Rl = [R[0], R[0], R[1], R[2], R[3], R[3]].slice(0, R.length);
    const cor = [c.Sand[0], c.Sand[0], c.Sand[1], c.Sand[1], c.Sand[2]];
    if (P.vista === "lado") {
      membro(G, cx - 1, yR + 2, cx + 6, yR + 5, 6, 5, R);
      membro(G, cx + 6, yR + 5, cx + 5, yR + 15, 4.6, 3.4, longo ? B : Pl, longo ? { faixas: [[0.82, 1, Pl]] } : { faixas: [[0.5, 0.62, cor]] });
      peLado(G, c, cx + 5, yR + 20, 2, false);
      for (let Y = yR; Y <= yR + 4; Y++) faixa(G, Y, cx - 6, cx + 5, B, (u) => 0.55 - 1.2 * u - (Y === yR + 4 ? 0.5 : 0));
      return;
    }
    const frente = P.vista === "frente";
    for (const lado of [-1, 1]) {
      const r = (lado < 0) === frente ? R : Rl, o = { vies: lado > 0 ? -0.15 : 0.05 };
      membro(G, cx + lado * 4, yR + 2, cx + lado * 9, yR + 6, 5.4, 4.8, r, o);
      membro(G, cx + lado * 9, yR + 6, cx + lado * 10, yR + 15, 4.4, 3.4, r, Object.assign({ faixas: longo ? [[0.84, 1, Pl]] : [[0.5, 0.62, cor]] }, o));
      peFrente(G, c, Math.round(cx + lado * 10 + (lado < 0 ? 0 : -1)), yR + 20, frente ? 0 : 0, frente, false);
    }
    for (let Y = yR; Y <= yR + 4; Y++) faixa(G, Y, cx - 9, cx + 8, B, (u) => 0.55 - 1.2 * u - (Y === yR + 4 ? 0.5 : 0));
  }

  // ----- braços -----
  // Manga curta até o cotovelo na túnica curta (antebraço nu); manga comprida e larga na veste longa.
  function braco(G, cfg, c, P, ombro, maoP, lado, o) {
    o = o || {};
    const longo = cfg.molde !== "curta", fem = cfg.molde === "veu", Mg = c.Manga, Pl = c.Pele;
    const sx = ombro[0], sy = ombro[1], hx = maoP[0] + 0.5, hy = maoP[1] - 0.5;
    // o cotovelo dobra para fora do corpo; com a mão acima do ombro, para baixo
    const alto = hy < sy + 2, kd = o.k === undefined ? 1 : o.k;
    let ct = junta(sx, sy, hx, hy - 0.5, 7.7, 7.7, lado, alto ? 1 : kd);
    if (alto) { const ct2 = junta(sx, sy, hx, hy - 0.5, 7.7, 7.7, -lado, 1); if (ct2[1] > ct[1]) ct = ct2; }
    const wo = fem ? 3.6 : 4.2, v = o.vies || 0;
    if (!o.soMao) {
      const vinco = o.vinco || 0;
      membro(G, sx, sy, ct[0], ct[1], wo + 0.2, wo, Mg, { vies: v + 0.1, vinco, vincoL: o.vincoL, topo: P.vista === "lado" ? 0.3 : 0.55 });
      const punho = [Mg[0], Mg[0], Mg[1], Mg[1], Mg[2], Mg[3]];
      // o punho fica 1,3 px antes do centro da mão, na direção do cotovelo
      const dd = Math.hypot(hx - ct[0], hy - ct[1]) || 1, px = hx - ((hx - ct[0]) / dd) * 1.3, py = hy - ((hy - ct[1]) / dd) * 1.3;
      if (longo) membro(G, ct[0], ct[1], px, py, wo - 0.2, wo + 0.4, Mg, { vies: v, vinco, vincoL: o.vincoL, faixas: [[0.88, 1, punho]] });
      else membro(G, ct[0], ct[1], px, py, 3.6, 3, Pl, { vies: v, vinco, faixas: [[0, 0.12, [Mg[0], Mg[0], Mg[1], Mg[1], Mg[2], Mg[2]]]] });
    }
    mao(G, c, maoP[0], maoP[1], { vies: v });
    P.cotovelos = P.cotovelos || {};
    P.cotovelos[o.nome || "arma"] = [Math.round(ct[0]), Math.round(ct[1])];
  }
  function bracos(G, cfg, c, P, soMao) {
    if (P.vista === "lado") {
      braco(G, cfg, c, P, [P.ombroE[0] + 0.5, P.ombroE[1]], P.maoArma, 1, { soMao, k: !P.golpe && P.maoArma[0] < P.cx - 2 ? 0.2 : 0.6, vinco: -1 });
      return;
    }
    const frente = P.vista === "frente";
    const E = frente ? P.maoArma : P.maoEscudo, D = frente ? P.maoEscudo : P.maoArma;
    braco(G, cfg, c, P, [P.ombroE[0] + 0.5, P.ombroE[1]], E, 1, { soMao, k: 0.3, vinco: 1, nome: frente ? "arma" : "escudo", vies: 0.05 });
    braco(G, cfg, c, P, [P.ombroD[0] - 0.5, P.ombroD[1]], D, -1, { soMao, k: 0.3, nome: frente ? "escudo" : "arma", vies: -0.12 });
  }

  // ----- montagem -----
  // desenhar(g, cfg, quadro, o): o = { ox, oy (desloca o boneco na grade: montado), montado,
  //   camada(nome, G, P, c, cfg) } — camada é chamada nos pontos "fundo", "armadura", "meio", "ombros",
  //   "frente" e "fim"; se a chamada de "frente" devolver true, as mãos são repintadas por cima.
  // Devolve a pose usada.
  function desenhar(g, cfg, quadro, o) {
    o = o || {};
    const vista = VISTAS[Math.floor(quadro / QPV)] || "lado", q = quadro % QPV;
    const ox = o.ox || 0, oy = o.oy || 0;
    const G = ox || oy ? { fino: (X, Y, cor) => g.fino(X + ox, Y + oy, cor), gf: (X, Y) => g.gf(X + ox, Y + oy), base: g } : g;
    const c = cores(cfg), P = pose(vista, q, cfg);
    const montado = !!(o.montado || cfg.montado);
    if (montado && !P.golpe) {
      // as mãos nas rédeas, à frente do corpo
      if (vista === "lado") { P.maoArma = [P.cx + 6, P.yT + 12]; P.maoLonge = null; }
      else { P.escudoEm = P.maoEscudo; P.maoArma = [P.cx + (vista === "frente" ? -4 : 4), P.yT + 13]; P.maoEscudo = [P.cx + (vista === "frente" ? 3 : -3), P.yT + 13]; }
    }
    const cam = (nome) => (o.camada ? o.camada(nome, G, P, c, cfg) : false);
    cam("fundo");
    corpo(G, cfg, c, P, { montado });
    cam("armadura");
    cam("meio");
    cabeca(G, cfg, c, P);
    bracos(G, cfg, c, P, false);
    cam("ombros");
    if (cam("frente")) bracos(G, cfg, c, P, true);
    cam("fim");
    return P;
  }

  const novoHumano = {
    w: W, h: H, quadrosPorVista: QPV, ciclo: [2, 3, 4, 5], quadroAcao: [6, 7],
    busto: [6, 2, 12, 12], retratoQuadro: QPV, sombra: { w: 22, h: 10 }, alturaCabeca: 56,
    acabamento: false, limiteCores: 64,
    VISTAS, CX, PES, pose, desenhar, inferiorMontado, cores,
    partes: { corpo, cabeca, bracos, braco, mao, membro, junta, faixa, peFrente, peLado },
  };
  M.novoHumano = novoHumano;

  // ----- prévias (só na folha de contato; as chaves reais são do H2) -----
  function previa(chave, cfg) {
    registrar(chave, {
      w: W, h: H, direcoes: 3, quadrosPorVista: QPV, quadros: 3 * QPV, ciclo: novoHumano.ciclo, quadroAcao: novoHumano.quadroAcao,
      sombra: novoHumano.sombra, alturaCabeca: novoHumano.alturaCabeca, busto: novoHumano.busto, retratoQuadro: QPV,
      origem: [0.5, 1], contorno: cfg.hostil ? "hostil" : "amigo", acabamento: false, limiteCores: 64,
      desenhar(g, quadro) { desenhar(g, cfg, quadro); },
    });
  }
  previa("pv_humano_manto", { molde: "manto", cores: { H: "#4a2f20", S: "#cf9466", s: "#b07548", B: "#4a2f20", R: "#d4bf8f", r: "#a8916a", d: "#7d6a4a", A: "#8e2a1f", F: "#5a3a24" } });
  previa("pv_humano_curta", { molde: "curta", cores: { H: "#2e1f18", S: "#e0a878", s: "#c68a5c", B: "#2e1f18", R: "#b04a36", r: "#9a3a2a", d: "#7a2a1f", A: "#7a4a30", F: "#4a2f20" } });
  previa("pv_humano_veu", { molde: "veu", barba: false, cores: { V: "#4fa3a5", W: "#2f7680", H: "#3a2418", S: "#cf9466", s: "#b07548", R: "#e6cf9c", r: "#cfae74", d: "#a8844f", A: "#8e2a1f", F: "#5a3a24" } });
  previa("pv_humano_grande", { molde: "manto", porte: "grande", hostil: true, gola: "#b07a38", barra: true, cores: { H: "#2a2a3a", S: "#b97a4c", s: "#93603a", B: "#2a2a3a", R: "#8a3a4a", r: "#6a2a3a", d: "#4a1a2a", A: "#e8b94a", F: "#2a1a14" } });
})(typeof window !== "undefined" ? window : globalThis);
