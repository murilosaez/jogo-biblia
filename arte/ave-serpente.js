// =====================================================================
// arte/ave-serpente.js — aves e serpentes em 3 vistas.
// Pacote A2 do plano de arte: abutre, águia e corvo (sempre em voo) e víbora e naja (rastejando).
//
// Chaves que este arquivo assume (registrar() com a MESMA chave troca o desenho legado de sprites.js):
//   in_abutre in_aguia in_vibora in_naja (48 × 48 px) · in_corvo (40 × 40 px)
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
  const { registrar, rampa6, sombrear, esferaPx, misturar, hexRgb, rgbHex, prim } = M;
  const { elipF, linF } = prim;
  const TAU = Math.PI * 2;
  const mescla = (a, b, t) => a + (b - a) * t;
  const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const norma = (x, y) => { const m = Math.hypot(x, y) || 1; return [x / m, y / m]; };
  const CICLO = [2, 3, 4, 5], ACAO = [6, 7];
  const BOCA = rampa6("#b8485a", "pele"), LINGUA = "#d2414a", PRESA = "#fff6e0", PUPILA = "#140c0c";

  // Raro nomeado: a tinta dos dados entra na paleta (multiplica e puxa um pouco para a cor), e não por
  // cima da textura pronta.
  function tingir(cor, tinta) {
    if (!tinta) return cor;
    const a = hexRgb(cor), t = hexRgb(tinta);
    return misturar(misturar(cor, rgbHex((a[0] * t[0]) / 255, (a[1] * t[1]) / 255, (a[2] * t[2]) / 255), 0.85), tinta, 0.14);
  }

  // -------------------------------------------------------------------
  // Tela: o desenho é pensado num quadro de 48 × 48 e levado à célula com a escala `s` (espécie menor,
  // raro maior), alinhado pela base e centrado. Só a posição e o tamanho das formas escalam: o traço
  // continua de 1 px de arte e a textura (penas, escamas, pontilhado) continua por px.
  // -------------------------------------------------------------------
  function tela(g, s, dy = 0) {
    const ox = (g.w - 48 * s) / 2, oy = g.h - 48 * s + dy * s;
    return { g, s, X: (x) => ox + x * s, Y: (y) => oy + y * s };
  }
  const elip = (T, cx, cy, rx, ry, cor) => elipF(T.g, T.X(cx), T.Y(cy), Math.max(0.75, rx * T.s), Math.max(0.75, ry * T.s), cor);
  const ponto = (T, x, y, cor) => T.g.fino(Math.floor(T.X(x)), Math.floor(T.Y(y)), cor);
  const risco = (T, x0, y0, x1, y1, cor, larg = 1) =>
    linF(T.g, Math.floor(T.X(x0)), Math.floor(T.Y(y0)), Math.floor(T.X(x1)), Math.floor(T.Y(y1)), cor, Math.max(1, Math.round(larg * T.s)));

  // Tubo com volume ao longo de uma curva (corpo de serpente, pescoço): curva(u) → [x, y] e raio(u), no
  // quadro de 48; cor(u, k, X, Y, comp, ox, oy) com k de −1 a 1 atravessando o tubo, comp = comprimento
  // percorrido e (ox, oy) o desvio unitário na tela. Pinta da cauda (u = 0) para a cabeça.
  function tubo(T, curva, raio, cor) {
    const g = T.g, s = T.s;
    let total = 0, ant = curva(0);
    for (let i = 1; i <= 48; i++) { const p = curva(i / 48); total += Math.hypot(p[0] - ant[0], p[1] - ant[1]); ant = p; }
    const N = Math.max(8, Math.ceil(total * s * 3));
    const pts = [];
    let comp = 0;
    ant = curva(0);
    for (let i = 0; i <= N; i++) { const p = curva(i / N); comp += Math.hypot(p[0] - ant[0], p[1] - ant[1]); pts.push([p[0], p[1], comp]); ant = p; }
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)], p = pts[i];
      const [tx, ty] = norma(b[0] - a[0], b[1] - a[1]);
      const r = raio(i / N), passos = Math.max(1, Math.ceil(r * s * 2.2));
      for (let j = -passos; j <= passos; j++) {
        const k = j / passos, ox = -ty * k, oy = tx * k;
        const X = Math.floor(T.X(p[0] + ox * r)), Y = Math.floor(T.Y(p[1] + oy * r));
        const c = cor(i / N, k, X, Y, p[2], ox, oy);
        if (c) g.fino(X, Y, c);
      }
    }
  }
  // luz num cilindro deitado, visto de cima em oblíquo: vem de cima e da esquerda
  const luzTubo = (k, ox, oy) => (-0.4 * ox - 0.55 * oy + 0.73 * Math.sqrt(Math.max(0, 1 - k * k))) * 1.3 - 0.5;

  // ===================================================================
  // AVES — sempre em voo: o corpo fica acima da linha do chão e a sombra (def.sombra) é do jogo.
  // ===================================================================
  // Asa: úmero e mão numa curva (ombro S → punho → ponta) com as penas saindo dela em leque: junto ao
  // corpo apontam para a cauda (direção c), na ponta acompanham a envergadura (direção a). Cada px sabe de
  // que pena é (fr = posição dentro da pena) e a que altura da pena está (v): coberteiras claras em
  // escama junto ao bordo de ataque, rêmiges com a haste escura e a ponta escura, "dedos" abertos na mão.
  function asa(T, S, a, c, L, corda, R, o) {
    const g = T.g, s = T.s, RA = o.RA || R, vies = o.vies || 0, dobra = o.dobra === undefined ? 2 : o.dobra;
    const n = Math.max(4, Math.round(((L + corda * 0.5) * s) / 2.7));
    const U = Math.ceil((L + corda) * s * 3.2);
    const px = S[0] + a[0] * L * 0.42 - c[0] * dobra, py = S[1] + a[1] * L * 0.42 - c[1] * dobra;
    const fx = S[0] + a[0] * L + c[0] * L * 0.04, fy = S[1] + a[1] * L + c[1] * L * 0.04;
    for (let iu = 0; iu <= U; iu++) {
      const u = iu / U, w = 1 - u;
      const lx = w * w * S[0] + 2 * w * u * px + u * u * fx, ly = w * w * S[1] + 2 * w * u * py + u * u * fy;
      const k = suave(0.5, 1, u);
      const [dx, dy] = norma(c[0] * (1 - 0.8 * k) + a[0] * 1.05 * k, c[1] * (1 - 0.8 * k) + a[1] * 1.05 * k);
      const f = u * n, fi = Math.min(n - 1, Math.floor(f)), fr = f - fi, fc = (u * n * 1.5 + 0.5) % 1, sep = Math.min(0.45, 0.95 / ((L + corda * 0.5) * s / n));
      const len = corda * (0.82 + 0.2 * Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.05))) * (1 - 0.2 * (2 * fr - 1) * (2 * fr - 1)) * (o.curta || 1);
      const V = Math.max(2, Math.ceil(len * s * 2.2));
      for (let iv = 0; iv <= V; iv++) {
        const v = iv / V;
        if (o.dedos && u > 0.66 && v > 0.5 && fr < 0.26) continue;
        const X = Math.floor(T.X(lx + dx * len * v)), Y = Math.floor(T.Y(ly + dy * len * v));
        // tom da rampa (0 escuro … 5 claro), em faixas nítidas e sem pontilhado
        let t;
        if (v < 0.15) { g.fino(X, Y, RA[Math.max(0, Math.min(5, Math.round(4.6 + vies)))]); continue; }                                            // bordo de ataque
        else if (v < 0.36) { g.fino(X, Y, RA[Math.max(0, Math.min(5, Math.round((fc < 0.3 ? 2 : 3.4) + vies - u * 0.5)))]); continue; }                       // coberteiras, em escama
        else if (v < 0.43) t = 2;                                          // sombra das coberteiras sobre as rêmiges
        else t = (fr < sep ? 0.2 : fr > 0.66 ? 2.2 : 1.5) - (v > 0.84 ? 0.9 : 0); // rêmiges: haste escura, ponta escura
        g.fino(X, Y, R[Math.max(0, Math.min(5, Math.round(t + vies - u * 0.5)))]);
      }
    }
  }
  // Cauda em leque a partir de B, na direção ang, com n penas.
  function cauda(T, B, ang, len, abre, n, R, o) {
    const g = T.g, s = T.s, passos = Math.ceil(abre * 2 * len * s * 3), sep = Math.min(0.45, (0.95 * n) / (abre * 2 * len * s * 0.8));
    for (let i = 0; i <= passos; i++) {
      const t = i / passos, th = -abre + 2 * abre * t, f = t * n, fr = f - Math.min(n - 1, Math.floor(f));
      const lr = len * (1 - (o.cunha || 0.05) * (2 * t - 1) * (2 * t - 1)) * (1 - 0.12 * (2 * fr - 1) * (2 * fr - 1));
      const dx = Math.cos(ang + th), dy = Math.sin(ang + th), V = Math.ceil(lr * s * 2.2);
      for (let iv = 0; iv <= V; iv++) {
        const v = iv / V, X = Math.floor(T.X(B[0] + dx * lr * v)), Y = Math.floor(T.Y(B[1] + dy * lr * v));
        let t = (fr < sep ? 0.6 : fr > 0.66 ? 3.2 : 2.4) + (o.vies || 0) + (v < 0.3 ? -0.8 : 0);
        if (v > 0.78) t += o.ponta === undefined ? -1 : o.ponta;
        g.fino(X, Y, R[Math.max(0, Math.min(5, Math.round(t)))]);
      }
    }
  }
  // plumagem do corpo: volume esférico com penas em escama (uma fiada de px mais escuros a cada 3 linhas)
  const plumagem = (R, vies = 0, RB = null, corte = 0.4) => (nx, ny, X, Y) => {
    const l = -(0.5 * nx + 0.82 * ny) + vies - ((X + 2 * Y) % 5 === 0 ? 0.3 : 0);
    return sombrear(RB && ny > corte ? RB : R, RB && ny > corte ? l + 0.55 : l, X, Y);
  };

  // batida: f de −1 (asas no alto) a 1 (asas embaixo); sobe = quanto o corpo sobe (px) na fase
  const BATIDA = [
    { f: -0.55, dy: 0 },          // 0 parado (planando)
    { f: -0.3, dy: 0.6 },         // 1 respirar
    { f: -1, dy: 1 },             // 2 asas no alto
    { f: -0.15, dy: 0 },          // 3 descendo, abertas
    { f: 1, dy: -1 },             // 4 asas embaixo
    { f: 0.3, dy: 0, recolhe: 0.8 }, // 5 subindo, meio recolhidas
    { f: -1, dy: -1, ant: 1 }, // 6 antecipação: freia no ar, asas ao alto
    { f: 0.75, dy: 3, golpe: 1 }, // 7 golpe: mergulho com as garras e o bico
  ];

  function garra(T, x, y, dx, dy, RPE) {
    // perna curta e três dedos com unha escura
    risco(T, x, y, x + dx, y + dy, RPE[3], 1.6);
    const [ux, uy] = norma(dx, dy);
    for (const d of [-0.7, 0, 0.7]) {
      const ex = x + dx + (ux * Math.cos(d) - uy * Math.sin(d)) * 2.6, ey = y + dy + (ux * Math.sin(d) + uy * Math.cos(d)) * 2.6;
      risco(T, x + dx, y + dy, ex, ey, RPE[4]);
      ponto(T, ex + ux * 0.9, ey + uy * 0.9, "#2a1a14");
    }
  }

  function aveLado(T, o, P, q) {
    const b = BATIDA[q], f = b.f, t01 = (Math.max(-1, Math.min(1, f)) + 1) / 2;
    const cx = 21 + (b.ant ? -1 : b.golpe ? 4 : 0), cy = 25 + b.dy;
    const L = o.asa, corda = o.corda, rec = b.recolhe || 1;
    const emp = b.ant ? -1.5 : b.golpe ? 1.5 : 0; // empina (peito sobe) ou mergulha (peito desce)
    // asa de longe: sobe na tela; comprida com a asa no alto, curta embaixo
    // (as duas asas varrem para trás: a silhueta é uma flecha apontando para onde a ave voa, e não uma cruz)
    asa(T, [cx + 4.5, cy - 3], norma(-0.62 - 0.32 * f - (b.golpe ? 0.3 : 0), -1), norma(-1, 0.3), L * mescla(1.04, 0.5, t01) * rec * (b.ant ? 0.86 : 1), corda * mescla(1.2, 1, t01), P.R,
      { vies: -0.6, dedos: o.dedos, dobra: 2.2, RA: P.RA });
    // cauda
    cauda(T, [cx - 7, cy + 0.6 - emp * 0.4], Math.PI - 0.08 + emp * 0.08, o.cauda, b.ant ? 0.5 : 0.34, o.penasCauda || 5, P.RT, { cunha: o.cunha, ponta: o.pontaCauda });
    // pernas recolhidas (ou as garras à frente, no bote)
    if (b.golpe) { garra(T, cx + 4, cy + 4, 5, 4.5, P.RPE); garra(T, cx + 1, cy + 4.5, 4.5, 5.5, P.RPE); }
    else if (b.ant) { garra(T, cx + 3, cy + 4, 3.5, 3, P.RPE); }
    else { risco(T, cx - 1, cy + 4.6, cx - 5, cy + 5.4, P.RPE[2]); ponto(T, cx - 6, cy + 5.6, P.RPE[1]); }
    // corpo: garupa e peito
    elip(T, cx - 4.5, cy + 0.8 + emp * 0.4, o.rc * 0.72, o.rl * 0.8, plumagem(P.R, 0, P.RP, 0.45));
    elip(T, cx + 2, cy - emp * 0.4, o.rc * 0.8, o.rl, plumagem(P.R, 0.05, P.RP, 0.4));
    // pescoço e cabeça
    const hx = cx + o.cabX, hy = cy + o.cabY - emp + (b.golpe ? 1.5 : 0);
    if (o.pescoco) {
      // pescoço nu e comprido, em S, saindo do colar de penugem
      const nx0 = cx + o.rc * 0.8 - 0.5, ny0 = cy - 1 - emp * 0.6;
      tubo(T, (u) => { const w = 1 - u; return [w * w * nx0 + 2 * w * u * (hx - 1) + u * u * hx, w * w * ny0 + 2 * w * u * (ny0 - 3.5) + u * u * hy]; },
        () => 1.5, (u, k, X, Y, comp, ox, oy) => sombrear(P.RC, luzTubo(k, ox, oy) - 0.15, X, Y));
      elip(T, nx0 - 0.3, ny0 + 0.3, 2.6, 3.6, (nx, ny, X, Y) => sombrear(P.RK, -(0.5 * nx + 0.8 * ny) - ((X + Y) % 2 ? 0.25 : 0), X, Y));
    } else {
      elip(T, cx + o.cabX - 3.2, cy + o.cabY * 0.45 - emp * 0.7, o.rcab + 0.2, o.rcab + 0.5, plumagem(P.RC, -0.05));
    }
    elip(T, hx, hy, o.rcab, o.rcab * 0.92, esferaPx(P.RC, 0.1));
    bicoLado(T, o, P, hx + o.rcab - 0.9, hy + 0.3, b.golpe ? 1 : 0);
    // olho com a sobrancelha (o cenho de rapina)
    const ex = hx + o.rcab * 0.3, ey = hy - o.rcab * 0.3;
    ponto(T, ex - 1 / T.s, ey, P.RC[2]); ponto(T, ex, ey, P.olho); ponto(T, ex + 1 / T.s, ey, PUPILA); ponto(T, ex, ey + 1 / T.s, P.RC[2]);
    if (o.cenho) { risco(T, ex - 1.2, ey - 1.3, ex + 2, ey - 0.9, P.RC[1]); }
    // asa de perto: desce na tela; curta com a asa no alto, comprida embaixo
    asa(T, [cx + 3, cy - 0.2], norma(-0.7 + 0.25 * f, 1), norma(-1, -0.3), L * mescla(0.42, 0.98, t01) * rec, corda * mescla(0.9, 1.2, t01), P.R,
      { vies: 0, dedos: o.dedos, dobra: 2.2, RA: P.RA });
  }
  function bicoLado(T, o, P, x, y, aberto) {
    const n = o.bico, RB = P.RB;
    for (let i = 0; i < n; i++) {
      const t = i / n, esp = t < 0.35 ? 3 : t < 0.75 ? 2 : 1;
      for (let j = 0; j < esp; j++) ponto(T, x + i / T.s, y - 1 + (j + (t > 0.6 && o.gancho ? 1 : 0)) / T.s, j === 0 ? RB[4] : j === 1 ? RB[3] : RB[2]);
    }
    if (o.gancho) { ponto(T, x + (n - 1) / T.s, y - 1 + 2 / T.s, RB[1]); if (o.gancho > 1) ponto(T, x + (n - 1) / T.s, y - 1 + 3 / T.s, RB[1]); }
    ponto(T, x + 1 / T.s, y - 1, RB[1]); // narina
    // mandíbula
    const ab = aberto ? 2 : 0;
    for (let i = 0; i < n - 2; i++) ponto(T, x + i / T.s, y - 1 + (3 + Math.round((ab * i) / (n - 2))) / T.s, RB[2]);
    if (aberto) for (let i = 1; i < n - 2; i++) ponto(T, x + i / T.s, y - 1 + 3 / T.s, i > 2 ? BOCA[2] : BOCA[1]);
  }

  // frente (cabeça embaixo, vindo para a câmera) e costas (cabeça em cima): simétricas
  function aveFrente(T, o, P, q, costas) {
    const b = BATIDA[q], f = b.f, sinal = costas ? -1 : 1;
    const cx = 24, cy = (costas ? 25 : 22) + b.dy * (costas && (b.ant || b.golpe) ? -1 : 1);
    const ang = f < 0 ? f * 0.66 : f * 0.36, rec = b.recolhe || 1;
    const L = o.asa * 0.86 * (1 - 0.1 * Math.abs(f)) * rec, corda = o.corda;
    const rx = o.rl * 1.25, ry = o.rc * 0.74;
    const caudaAng = costas ? Math.PI / 2 : -Math.PI / 2;
    const fazAsas = () => {
      for (const lado of [-1, 1]) {
        const a = [lado * Math.cos(ang), Math.sin(ang)];
        const esc = -sinal * a[1], c = norma(-esc * a[0] - lado * 0.12, -sinal - esc * a[1]); // para a cauda, perpendicular à envergadura
        asa(T, [cx + lado * (rx - 1.5), cy - sinal * 1.5], a, c, L, corda, P.R, { vies: lado < 0 ? 0 : -0.4, dedos: o.dedos, dobra: 2.2 * rec, RA: P.RA });
      }
    };
    const fazCauda = () => cauda(T, [cx, cy - sinal * (ry - 3.5)], caudaAng, o.cauda, b.ant ? 0.6 : 0.4, o.penasCauda || 5, P.RT, { cunha: o.cunha, ponta: o.pontaCauda });
    fazAsas(); fazCauda();
    if (!costas && b.golpe) { garra(T, cx - 3.5, cy + 3, -1, 9.5, P.RPE); garra(T, cx + 3.5, cy + 3, 1, 9.5, P.RPE); }
    if (!costas && b.ant) { garra(T, cx - 3.5, cy + 4, -0.5, 5, P.RPE); garra(T, cx + 3.5, cy + 4, 0.5, 5, P.RPE); }
    // corpo: o dorso (de costas) ou o dorso com o peito aparecendo embaixo (de frente)
    elip(T, cx, cy, rx, ry, costas ? plumagem(P.R, 0.05) : plumagem(P.R, 0.05, P.RP, 0.55));
    const hy = cy + sinal * (o.cabF + (b.golpe && !costas ? -3 : 0));
    if (o.pescoco) {
      elip(T, cx, cy + sinal * (ry - 1.2), 4.2, 2.6, (nx, ny, X, Y) => sombrear(P.RK, -(0.5 * nx + 0.8 * ny) - ((X + Y) % 2 ? 0.25 : 0), X, Y));
      tubo(T, (u) => [cx, mescla(cy + sinal * (ry - 0.5), hy, u)], () => 1.6, (u, k, X, Y, comp, ox, oy) => sombrear(P.RC, luzTubo(k, ox, oy) - 0.1, X, Y));
    } else {
      elip(T, cx, cy + sinal * (ry - 0.8), o.rcab + 0.6, o.rcab * 0.9, plumagem(P.RC, costas ? -0.05 : 0));
    }
    elip(T, cx, hy, o.rcab, o.rcab * 0.95, esferaPx(P.RC, 0.1));
    const RB = P.RB, n = Math.max(2, Math.round(o.bico * 0.75));
    if (costas) {
      // de costas só a ponta do bico passa da cabeça
      ponto(T, cx - 0.5, hy - o.rcab * 0.95 - 0.2, RB[3]); ponto(T, cx - 0.5, hy - o.rcab * 0.95 - 0.2 - 1 / T.s, RB[2]);
    } else {
      const by = hy + o.rcab * 0.15;
      for (let i = 0; i < n; i++) {
        const meio = i < n * 0.55 ? 1 : 0;
        for (let j = -meio; j <= meio; j++) ponto(T, cx - 0.5 + j / T.s, by + i / T.s, j < 0 ? RB[4] : j > 0 ? RB[2] : RB[3]);
      }
      ponto(T, cx - 0.5, by + n / T.s, o.gancho ? RB[1] : RB[2]);
      if (b.golpe) { ponto(T, cx - 0.5, by + (n + 1) / T.s, BOCA[2]); ponto(T, cx - 0.5, by + (n + 2) / T.s, RB[1]); }
      for (const lado of [-1, 1]) {
        const ex = cx - 0.5 + lado * (o.rcab * 0.62), ey = hy - o.rcab * 0.12;
        ponto(T, ex, ey, P.olho); ponto(T, ex, ey + 1 / T.s, PUPILA);
        if (o.cenho) { ponto(T, ex, ey - 1 / T.s, P.RC[1]); ponto(T, ex + lado / T.s, ey - 2 / T.s, P.RC[1]); ponto(T, ex - lado / T.s, ey - 1 / T.s + 0.0001, P.RC[1]); }
      }
    }
  }

  function aveDef(o, porte, tinta) {
    const p = porte || 1, s = p * (o.esc || 1), lado = 2 * Math.ceil((o.C * p) / 2);
    const cor = (c) => tingir(c, tinta);
    const P = {
      R: rampa6(cor(o.penas[o.tomBase || 1]), "pelo"), RP: rampa6(cor(o.peito || o.penas[1]), "pelo"),
      RK: o.colar ? rampa6(cor(o.colar), "pelo") : null,
      RB: rampa6(o.corBico, "pedra"), RPE: rampa6(o.pes || "#e8b94a", "pele"), olho: o.olho || "#f2c84a",
    };
    P.RC = o.cabeca ? rampa6(cor(o.cabeca[1]), o.pescoco ? "pele" : "pelo") : P.R;
    P.RA = rampa6(cor(o.cobertas || o.penas[2]), "pelo");
    P.RT = o.corCauda ? rampa6(cor(o.corCauda), "pelo") : P.R;
    return {
      w: lado / 2, h: lado / 2, direcoes: 3, quadrosPorVista: 8, quadros: 24, ciclo: CICLO, quadroAcao: ACAO,
      sombra: { w: Math.round(o.sombra[0] * p), h: Math.round(o.sombra[1] * p) }, alturaCabeca: Math.round(o.C * p * 0.8),
      contorno: "hostil", acabamento: false, origem: [0.5, 1],
      desenhar(g, quadro) {
        const T = tela(g, s), vista = Math.floor(quadro / 8), q = quadro % 8;
        if (vista === 0) aveLado(T, o, P, q);
        else aveFrente(T, o, P, q, vista === 2);
      },
    };
  }
  function ave(chave, o) {
    const def = aveDef(o, 1, null);
    def.variante = (porte, tinta) => aveDef(o, porte, tinta);
    return registrar(chave, def);
  }
  // os parâmetros de cor são os do desenho legado (penas, peito, cabeça, colar, bico, olho, pés)
  ave("in_abutre", {
    C: 48, esc: 1, penas: ["#2e2420", "#4a3a30", "#6a5646"], peito: "#8a7462", cabeca: ["#b0605a", "#d88a7a", "#f0b0a0"], colar: "#e8dcc0", corBico: "#d8c8a0",
    pescoco: true, gancho: 2, bico: 5, dedos: true, cobertas: "#8a7462", asa: 13, corda: 8.5, cauda: 6.5, cunha: 0.05, rc: 10, rl: 5.2, rcab: 2.7, cabX: 15, cabY: -0.5, cabF: 12, sombra: [28, 9],
  });
  ave("in_aguia", {
    C: 48, esc: 1, penas: ["#4a2e18", "#6e4a28", "#946a3e"], peito: "#7a5230", cabeca: ["#c8c0b0", "#ece6da", "#ffffff"], corBico: "#e8b94a", corCauda: "#e4dccb", pontaCauda: 0.6,
    gancho: 1, bico: 5, cenho: true, dedos: true, asa: 14, corda: 8, cauda: 12, rc: 9.2, rl: 4.7, rcab: 3.5, cabX: 11.5, cabY: -3.4, cabF: 9.5, sombra: [26, 8],
  });
  ave("in_corvo", {
    C: 40, esc: 0.82, penas: ["#121018", "#24202e", "#3c3852"], peito: "#34304a", corBico: "#6e6870", olho: "#e2553a", pes: "#4a4448", tomBase: 2, cobertas: "#62628e", cabeca: ["#121018", "#2e2a3e", "#3a3448"],
    bico: 5, asa: 13.5, corda: 8, cauda: 9.5, cunha: 0.3, penasCauda: 5, rc: 8.6, rl: 4.4, rcab: 3.4, cabX: 10.5, cabY: -2.6, cabF: 9, sombra: [18, 6],
  });

  // ===================================================================
  // SERPENTES — tubo sobre senoide, escamas por px, ventre claro.
  // ===================================================================
  // cor do corpo: dorso com o desenho da espécie, ventre na borda de baixo
  function escamas(P, o, opt) {
    const per = 7, ventre = opt.ventre === undefined ? 0.5 : opt.ventre;
    return (u, k, X, Y, comp, ox, oy) => {
      let l = luzTubo(k, ox, oy) - 0.55 * suave(0.72, 1, Math.abs(k)); // a borda escurece: separa as voltas do corpo
      if (oy > ventre) return sombrear(P.RV, l + 0.75 - ((X & 1) ? 0.12 : 0), X, Y);
      if ((X + Y) & 1) l -= 0.1; // grão das escamas
      if (P.RP) {
        // víbora: losangos escuros de orla clara no dorso e pintas nos flancos
        // selas escuras atravessando o dorso, com um anel claro depois de cada uma
        const tp = (comp + 100) % per, kc = Math.abs(k - (opt.centro || 0)), e = (tp - 1.6) / 1.9;
        if (e * e + (kc / 0.72) * (kc / 0.72) < 1) return sombrear(P.RP, l - 0.1, X, Y, false);
        if (kc < 0.6 && tp > 3.6 && tp < 4.8) return sombrear(P.R, l + 0.7, X, Y, false);
      } else {
        // naja: lisa e lustrosa, com anéis apagados
        const t = ((comp + 100) % 8) / 8;
        if (t < 0.14) l += 0.3;
        if (Math.abs(k + 0.38) < 0.2) l += 0.42;
      }
      return sombrear(P.R, l, X, Y);
    };
  }
  // sombra de apoio colada ao corpo (camada de sombra): a serpente rasteja, a sombra do jogo é só um reforço
  function apoio(g) {
    for (let Y = 0; Y < g.h; Y++) for (let X = 0; X < g.w; X++) if (g.gf(X, Y)) { g.sombraPx(X + 1, Y + 2, 0.26); g.sombraPx(X + 2, Y + 1, 0.26); }
  }
  function lingua(T, x, y, dx, dy, n) {
    const [ux, uy] = norma(dx, dy);
    for (let i = 0; i < n; i++) ponto(T, x + (ux * i) / T.s, y + (uy * i) / T.s, LINGUA);
    const bx = x + (ux * n) / T.s, by = y + (uy * n) / T.s;
    ponto(T, bx + (ux - uy) / T.s, by + (uy + ux) / T.s, LINGUA); ponto(T, bx + (ux + uy) / T.s, by + (uy - ux) / T.s, LINGUA);
  }
  // cabeça de lado (virada para a direita), centro do crânio em (x, y); m = tamanho; boca de 0 a 1
  function cabecaLado(T, x, y, m, P, o, boca, comLingua) {
    const ab = boca * 2.4 * m;
    if (boca > 0) elip(T, x + 2.8 * m, y + 1.2 * m + ab * 0.35, 3.6 * m, 1 * m + ab * 0.62, (nx, ny, X, Y) => sombrear(BOCA, -0.2 - ny * 0.5, X, Y));
    elip(T, x + 1.6 * m, y + 1.7 * m + ab, 4.3 * m, 1.25 * m, (nx, ny, X, Y) => sombrear(P.RV, 0.35 - ny * 0.6 - nx * 0.2, X, Y));
    elip(T, x, y - ab * 0.3, 4.3 * m, 2.7 * m, esferaPx(P.R, 0.12));
    elip(T, x + 3.9 * m, y + 0.45 * m - ab * 0.55, 2.9 * m, 1.9 * m, esferaPx(P.R, 0.08));
    if (P.RP) risco(T, x - 3 * m, y + 0.4 * m - ab * 0.3, x + 1.4 * m, y - 0.2 * m - ab * 0.3, P.RP[2]); // faixa atrás do olho
    const ex = x + 2.3 * m, ey = y - 1 * m - ab * 0.45;
    risco(T, ex - 1.6 * m, ey - 1.2 * m, ex + 1.6 * m, ey - 0.8 * m, P.R[1]);
    ponto(T, ex, ey, P.olho); ponto(T, ex + 1 / T.s, ey, PUPILA);
    ponto(T, x + 6 * m, y + 0.2 * m - ab * 0.55, P.R[1]); // narina
    if (boca > 0) for (const fx of [4.2, 5.4]) { ponto(T, x + fx * m, y + 1.8 * m - ab * 0.4, PRESA); ponto(T, x + fx * m, y + 1.8 * m - ab * 0.4 + 1 / T.s, PRESA); }
    if (comLingua) lingua(T, x + 6.9 * m, y + 1.3 * m + ab * 0.3, 1, 0.15, 3);
  }
  // cabeça vista de cima: sinal = 1 de frente (focinho para baixo, olhos à mostra), −1 de costas
  function cabecaCima(T, x, y, m, P, o, sinal, boca, comLingua) {
    const ab = boca * 2.6 * m;
    if (boca > 0 && sinal > 0) {
      elip(T, x, y + 4.4 * m + ab * 0.5, 3 * m, 1.6 * m + ab * 0.5, (nx, ny, X, Y) => sombrear(BOCA, -0.25 - ny * 0.45, X, Y));
      elip(T, x, y + 5.6 * m + ab, 2.9 * m, 1.1 * m, (nx, ny, X, Y) => sombrear(P.RV, 0.3 - ny * 0.5, X, Y));
    }
    elip(T, x, y, 4.7 * m, 3.7 * m, esferaPx(P.R, 0.12));
    elip(T, x, y + sinal * 3.3 * m, 3.1 * m, 2.7 * m, esferaPx(P.R, 0.1));
    if (P.RP) { // V escuro no alto da cabeça
      risco(T, x - 2.6 * m, y - sinal * 2 * m, x - 0.5, y + sinal * 1 * m, P.RP[2]); risco(T, x + 1.8 * m, y - sinal * 2 * m, x - 0.5, y + sinal * 1 * m, P.RP[2]);
    }
    if (sinal > 0) {
      for (const lado of [-1, 1]) {
        const ex = x - 0.5 + lado * 3 * m, ey = y + 1.3 * m;
        ponto(T, ex, ey - 1 / T.s, P.R[1]); ponto(T, ex + lado / T.s, ey - 1 / T.s, P.R[1]);
        ponto(T, ex, ey, P.olho); ponto(T, ex, ey + 1 / T.s, PUPILA);
        ponto(T, x - 0.5 + lado * 1.2 * m, y + 5 * m, P.R[1]);
      }
      if (boca > 0) for (const lado of [-1, 1]) { ponto(T, x - 0.5 + lado * 1.7 * m, y + 4.6 * m, PRESA); ponto(T, x - 0.5 + lado * 1.7 * m, y + 4.6 * m + 1 / T.s, PRESA); }
      if (comLingua) lingua(T, x - 0.5, y + 6.2 * m + ab, 0, 1, 3);
    } else {
      for (const lado of [-1, 1]) ponto(T, x - 0.5 + lado * 4 * m, y - 1.4 * m, P.olho);
      if (comLingua) lingua(T, x - 0.5, y - 6.2 * m, 0, -1, 3);
    }
  }

  // --- víbora: corpo grosso de losangos, cabeça triangular baixa ---
  function viboraLado(T, P, o, q) {
    const fase = q >= 2 && q <= 5 ? ((q - 2) * TAU) / 4 : q === 1 ? 0.5 : 0;
    const pose = q === 6 ? { x0: 5, x1: 25, amp: 5, ondas: 1.05, erg: 12 } : q === 7 ? { x0: 4, x1: 35, amp: 2.2, ondas: 1.3, erg: 4 } : { x0: 4, x1: 32.5, amp: 4.3, ondas: 1.5, erg: q === 1 ? 6 : 5 };
    const curva = (u) => [mescla(pose.x0, pose.x1, u) - (q === 6 ? 5 * suave(0.7, 1, u) : 0),
      39.5 + pose.amp * (1 - suave(0.7, 1, u)) * Math.sin(TAU * pose.ondas * u + fase) - pose.erg * suave(0.68, 1, u)];
    tubo(T, curva, (u) => 2.9 * (0.18 + 0.82 * suave(0, 0.36, u)) * (1 - 0.42 * suave(0.8, 1, u)), escamas(P, o, { ventre: 0.52, centro: -0.2 }));
    const h = curva(1);
    cabecaLado(T, h[0] + 2.5, h[1] - 0.4, 1, P, o, q === 7 ? 1 : q === 6 ? 0.25 : 0, q === 1 || q === 7 || q === 3);
  }
  function viboraCima(T, P, o, q, costas) {
    const fase = q >= 2 && q <= 5 ? ((q - 2) * TAU) / 4 : q === 1 ? 0.5 : 0;
    const sinal = costas ? -1 : 1;
    // de frente a cauda fica no alto e a cabeça embaixo; de costas, o contrário
    const y0 = costas ? 46 : 5, y1 = costas ? (q === 6 ? 27 : q === 7 ? 16 : 17) : q === 6 ? 27 : q === 7 ? 36 : 35;
    const amp = q === 6 ? 10.5 : q === 7 ? 3.5 : 8.5, ondas = q === 6 ? 1.2 : q === 7 ? 1.2 : 1.35;
    const curva = (u) => [24 + amp * (0.45 + 0.55 * suave(0, 0.3, u)) * (1 - suave(0.74, 1, u)) * Math.sin(TAU * ondas * u + fase), mescla(y0, y1, u)];
    const persp = (u) => (costas ? 1.1 - 0.2 * u : 0.86 + 0.24 * u);
    tubo(T, curva, (u) => 2.6 * (0.2 + 0.8 * suave(0, 0.35, u)) * (1 - 0.42 * suave(0.82, 1, u)) * persp(u), escamas(P, o, { ventre: 2 }));
    const h = curva(1);
    cabecaCima(T, h[0], h[1] + sinal * 2.4, costas ? 1 : 1.1, P, o, sinal, q === 7 ? 1 : 0, q === 1 || q === 3 || (costas && q === 7));
  }

  // --- naja: o terço da frente erguido, capuz aberto ---
  function capuzRaio(larg) { return (u) => 2.4 + larg * Math.sin(Math.PI * suave(0.3, 1.04, u)) ** 1.2; }
  function najaLado(T, P, o, q) {
    const fase = q >= 2 && q <= 5 ? ((q - 2) * TAU) / 4 : q === 1 ? 0.5 : 0;
    const bal = q >= 2 && q <= 5 ? Math.sin(fase) : 0;
    const base = [26, 40];
    tubo(T, (u) => [mescla(4, base[0], u), base[1] + 3.6 * (1 - suave(0.7, 1, u)) * Math.sin(TAU * 1.3 * u + fase)],
      (u) => 2.5 * (0.22 + 0.78 * suave(0, 0.35, u)), escamas(P, o, { ventre: 0.52 }));
    const topo = q === 6 ? [26.5, 13] : q === 7 ? [35, 27] : [30 + bal, q === 1 ? 15 : 16], ctrl = q === 6 ? [34, 32] : q === 7 ? [31, 27] : [34.5, 33];
    const larg = q === 6 ? 3.9 : q === 7 ? 2.2 : 3.2;
    const dorso = escamas(P, o, { ventre: 2 });
    tubo(T, (u) => { const w = 1 - u; return [w * w * base[0] + 2 * w * u * ctrl[0] + u * u * topo[0], w * w * base[1] + 2 * w * u * ctrl[1] + u * u * topo[1]]; },
      capuzRaio(larg), (u, k, X, Y, comp, ox, oy) => {
        // de lado vê-se o capuz em três quartos: o ventre claro, de faixas, do lado para onde ela olha
        if (k > 0.1) return sombrear(P.RV, luzTubo(k, ox, oy) + 0.55 - (Math.floor(comp / 2.2) % 2 ? 0.28 : 0) - k * 0.3, X, Y);
        return dorso(u, k, X, Y, comp, ox, oy);
      });
    cabecaLado(T, topo[0] + 2.2, topo[1] - 1 + (q === 7 ? 1 : 0), 0.8, P, o, q === 7 ? 1 : 0, q === 1 || q === 7 || q === 4);
  }
  function najaCima(T, P, o, q, costas) {
    const fase = q >= 2 && q <= 5 ? ((q - 2) * TAU) / 4 : q === 1 ? 0.5 : 0;
    const bal = q >= 2 && q <= 5 ? Math.sin(fase) * 0.8 : 0;
    const dorso = escamas(P, o, { ventre: 2 });
    if (!costas) {
      // de frente: o corpo deitado faz um S atrás da base; o capuz mostra o ventre de faixas
      const base = [24, 42];
      tubo(T, (u) => [24 + 14.5 * Math.sin(TAU * 0.95 * (1 - u) + fase * 0.5 + 0.5) * suave(0, 0.28, 1 - u), base[1] - 17 * Math.pow(1 - u, 0.9)],
        (u) => 2.3 * (0.2 + 0.8 * suave(0, 0.4, u)) * (0.85 + 0.15 * u), dorso);
      const topoY = q === 6 ? 14 : q === 7 ? 19 : q === 1 ? 17 : 18, larg = q === 6 ? 7 : q === 7 ? 5.4 : 6;
      tubo(T, (u) => [24 + bal * u, mescla(base[1], topoY, u)], capuzRaio(larg), (u, k, X, Y, comp, ox, oy) => {
        const a = Math.abs(k);
        if (a > 0.78 || u < 0.12) return sombrear(P.R, luzTubo(k, ox, oy) - 0.1, X, Y);
        // escudos ventrais riscados a cada 3 px
        return sombrear(P.RV, 0.6 - k * 0.4 - a * a * 0.55 - (comp % 3 < 1 ? 0.6 : 0), X, Y, false);
      });
      if (q === 7) cabecaCima(T, 24, 23.5, 1.05, P, o, 1, 1, true);
      else cabecaCima(T, 24 + bal, topoY - 1.5, 0.95, P, o, 1, 0, q === 1 || q === 4);
    } else {
      // de costas: capuz escuro com o desenho dos "óculos"; o corpo deitado vem para a câmera
      const base = [24, 33];
      const topoY = q === 6 ? 18 : q === 7 ? 15 : q === 1 ? 14.5 : 15, larg = q === 6 ? 7 : q === 7 ? 4 : 6;
      const cxT = 24 + bal, meio = mescla(base[1], topoY, 0.66);
      tubo(T, (u) => [24 + bal * u, mescla(base[1], topoY, u)], capuzRaio(larg), (u, k, X, Y, comp, ox, oy) => {
        const c = dorso(u, k, X, Y, comp, ox, oy);
        return c;
      });
      // óculos do capuz: dois aros claros ligados por baixo, px a px
      const OC = [".XX.XX.", "X..X..X", "X..X..X", ".XX.XX.", "...X...", "...X..."];
      OC.forEach((lin, j) => { for (let i = 0; i < 7; i++) if (lin[i] === "X") ponto(T, cxT - 0.5 + (i - 3) / T.s, meio + (j - 2) / T.s, P.RM[i < 3 ? 4 : 3]); });
      cabecaCima(T, cxT, topoY - 1.6, 0.78, P, o, -1, 0, q === 1 || q === 7 || q === 4);
      tubo(T, (u) => [24 + 10 * Math.sin(TAU * 0.9 * u + fase * 0.5 + 0.4) * suave(0, 0.35, u), base[1] + 13 * Math.pow(u, 0.85)],
        (u) => 2.4 * (1 - 0.8 * suave(0.55, 1, u)) * (1 + 0.1 * u), dorso);
    }
  }

  function serpenteDef(o, porte, tinta) {
    const p = porte || 1, lado = 2 * Math.ceil((48 * p) / 2);
    const cor = (c) => tingir(c, tinta);
    const P = {
      R: rampa6(cor(o.cores[1]), "couro"), RV: rampa6(cor(o.ventre), "pele"), RP: o.padrao ? rampa6(cor(o.padrao), "couro") : null,
      RM: o.capuz ? rampa6(cor(o.capuz), "pele") : null, olho: o.olho || "#f2c84a",
    };
    return {
      w: lado / 2, h: lado / 2, direcoes: 3, quadrosPorVista: 8, quadros: 24, ciclo: CICLO, quadroAcao: ACAO,
      sombra: { w: Math.round(22 * p), h: Math.round(6 * p) }, alturaCabeca: Math.round((o.capuz ? 38 : 26) * p),
      contorno: "hostil", acabamento: false, origem: [0.5, 1],
      desenhar(g, quadro) {
        const T = tela(g, p, -2), vista = Math.floor(quadro / 8), q = quadro % 8;
        if (o.capuz) { if (vista === 0) najaLado(T, P, o, q); else najaCima(T, P, o, q, vista === 2); }
        else if (vista === 0) viboraLado(T, P, o, q);
        else viboraCima(T, P, o, q, vista === 2);
        apoio(g);
      },
    };
  }
  function serpente(chave, o) {
    const def = serpenteDef(o, 1, null);
    def.variante = (porte, tinta) => serpenteDef(o, porte, tinta);
    return registrar(chave, def);
  }
  serpente("in_vibora", { cores: ["#8a6a3e", "#b4925a", "#d6b882"], ventre: "#e8d8b0", padrao: "#4f3a22", ponta: "#4f3a22" });
  serpente("in_naja", { cores: ["#24221e", "#3e3a30", "#5e584a"], ventre: "#c8b88a", capuz: "#c8b88a", olho: "#e2774f" });
})(typeof window !== "undefined" ? window : globalThis);
