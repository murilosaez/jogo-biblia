// =====================================================================
// arte/humano-equip.js — equipamento do humano novo: 36 acessórios, armaduras, lâminas, escudos, arcos e trajes.
// Pacote H2 do plano de arte. Redesenha o equipamento sobre as âncoras de Arte.motor.novoHumano (arte/humano.js) e ATIVA o boneco novo.
//
// Chaves que este arquivo assume (registrar() com a MESMA chave troca o desenho legado de sprites.js):
//   nenhuma chave própria: redesenha ACESSORIOS, ARMADURAS, LAMINAS, CORES_ESCUDO e ARCOS sobre as âncoras
//   de Arte.motor.novoHumano e ativa Arte.motor.definirHumano (25 NPCs pj_*, 14 inimigos humanos in_*
//   e o jogador paramétrico pj_jogador|…)
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
  if (!Arte || !Arte.motor || !Arte.motor.novoHumano) return;
  const M = Arte.motor, N = M.novoHumano, PT = N.partes;
  const { misturar, hash2, sombrear, rampa6, comAlfa } = M;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const escuro = (c, t = 0.28) => misturar(c, "#1c1210", t);
  const claro = (c, t = 0.2) => misturar(c, "#fff6e0", t);
  const luz = (R, l, X, Y) => sombrear(R, clamp(l, -1, 1), X, Y, false);
  const DOIS_PI = Math.PI * 2, PES = N.PES;
  // rampa de metal a partir do par (escuro, claro) que as tabelas de cor já trazem
  const cacheMetal = new Map();
  function metal(esc, cla) {
    const k = esc + cla;
    let r = cacheMetal.get(k);
    if (!r) { r = [misturar(esc, "#140a14", 0.6), misturar(esc, "#2e1a2a", 0.3), esc, misturar(esc, cla, 0.55), cla, misturar(cla, "#ffffff", 0.6)]; cacheMetal.set(k, r); }
    return r;
  }
  const pano = (c) => rampa6(c, "pano"), madeira = (c) => rampa6(c, "madeira"), couro = (c) => rampa6(c, "couro");

  // -------------------------------------------------------------------
  // Formas orientadas: f(u, v, X, Y) com u ao longo da direção (dx, dy) e v perpendicular (v > 0 = à
  // direita de quem olha na direção). ladoLuz(dx, dy) diz de que lado de v a luz (cima/esquerda) bate.
  // -------------------------------------------------------------------
  function forma(G, x0, y0, dx, dy, u0, u1, vm, f) {
    const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    const xs = [x0 + dx * u0, x0 + dx * u1], ys = [y0 + dy * u0, y0 + dy * u1];
    for (let Y = Math.floor(Math.min(ys[0], ys[1]) - vm - 1); Y <= Math.ceil(Math.max(ys[0], ys[1]) + vm + 1); Y++)
      for (let X = Math.floor(Math.min(xs[0], xs[1]) - vm - 1); X <= Math.ceil(Math.max(xs[0], xs[1]) + vm + 1); X++) {
        const px = X + 0.5 - x0, py = Y + 0.5 - y0, u = px * dx + py * dy, v = -px * dy + py * dx;
        if (u < u0 || u > u1 || Math.abs(v) > vm) continue;
        const c = f(u, v, X, Y);
        if (c) G.fino(X, Y, c);
      }
  }
  const ladoLuz = (dx, dy) => (dy - dx >= 0 ? 1 : -1); // sinal de v do lado iluminado
  function elipse(G, cx, cy, rx, ry, f) {
    for (let Y = Math.floor(cy - ry); Y <= Math.ceil(cy + ry); Y++)
      for (let X = Math.floor(cx - rx); X <= Math.ceil(cx + rx); X++) {
        const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const c = f(nx, ny, X, Y);
        if (c) G.fino(X, Y, c);
      }
  }
  const bola = (R, vies = 0) => (nx, ny, X, Y) => luz(R, 0.3 - 0.85 * nx - 0.75 * ny + vies - (nx * nx + ny * ny > 0.72 ? 0.25 : 0), X, Y);
  function linha(G, x0, y0, x1, y1, cor) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) { const X = Math.round(x0 + ((x1 - x0) * i) / n), Y = Math.round(y0 + ((y1 - y0) * i) / n); G.fino(X, Y, typeof cor === "function" ? cor(i, X, Y) : cor); }
  }
  const pau = (G, x0, y0, x1, y1, R, w = 2) => PT.membro(G, x0, y0, x1, y1, w, w, R, {});

  // -------------------------------------------------------------------
  // Empunhadura: onde fica e para onde aponta o que está na mão da arma, por vista e quadro.
  //   lâmina: { x, y, dx, dy }               haste: + topo e base (px acima e abaixo da mão)
  // Parado e andando o cajado e a lança ficam plantados no chão (não sobem e descem com a mão).
  // -------------------------------------------------------------------
  function dirLamina(P) {
    const v = P.vista, g = P.golpe;
    if (v === "lado") return g === 1 ? [-0.3, -0.95] : g === 2 ? [0.62, 0.78] : [0.8, -0.6];
    if (v === "frente") return g === 1 ? [0.3, -0.95] : g === 2 ? [-0.35, 0.94] : [-0.35, -0.94];
    return g === 1 ? [0.7, -0.71] : g === 2 ? [-0.25, -0.97] : [0.35, -0.94];
  }
  function empunharHaste(P, o) {
    const v = P.vista, g = P.golpe, [hx, hy] = P.maoArma;
    const x = v === "costas" ? hx + 1 : hx;
    if (!g) {
      const ergue = P.fase === 1 || P.fase === 3 ? 1 : 0;
      if (o.solta) return { x, y: hy, dx: 0, dy: -1, topo: o.solta[0], base: o.solta[1] };
      return { x, y: hy, dx: 0, dy: -1, topo: hy - (o.yTopo - P.G), base: PES - 1 - ergue - hy };
    }
    let d, topo, base;
    if (o.lanca) {
      if (v === "lado") [d, topo, base] = g === 1 ? [[1, -0.08], 14, 12] : [[1, 0.12], 5, 24];
      else if (v === "frente") [d, topo, base] = g === 1 ? [[0.15, 0.99], 12, 12] : [[-0.12, 0.99], 16, 14];
      else [d, topo, base] = g === 1 ? [[0.1, -0.99], 16, 18] : [[-0.1, -0.99], 16, 18];
    } else if (v === "lado") [d, topo, base] = g === 1 ? [[-0.35, -0.94], 14, 10] : [[0.85, -0.53], 10, 12];
    else if (v === "frente") [d, topo, base] = g === 1 ? [[0.15, -0.99], 13, 14] : [[-0.5, 0.87], 12, 10];
    else [d, topo, base] = g === 1 ? [[0.3, -0.95], 16, 14] : [[-0.2, -0.98], 14, 16];
    if (o.solta) { topo = Math.min(topo, o.solta[0]); base = Math.min(base, o.solta[1]); }
    if (d[1] < -0.5) topo = Math.max(4, Math.min(topo, (hy - (o.margem || 3)) / -d[1])); // a ponta não sai da célula
    return { x: x + 0.5, y: hy + 0.5, dx: d[0], dy: d[1], topo, base };
  }
  // desenha a haste e devolve a ponta de cima { x, y, dx, dy }
  function haste(G, P, R, o) {
    const e = empunharHaste(P, o);
    const tx = e.x + e.dx * e.topo, ty = e.y + e.dy * e.topo;
    pau(G, e.x - e.dx * e.base, e.y - e.dy * e.base, tx, ty, R, 2);
    // nós da madeira
    if (o.nos !== false) for (let k = 3; k < e.topo + e.base - 2; k += 7) { const X = Math.floor(e.x + e.dx * (e.topo - k)), Y = Math.floor(e.y + e.dy * (e.topo - k)); if (G.gf && G.gf(X, Y)) G.fino(X, Y, R[1]); }
    P.topoArma = [tx, ty];
    return { x: tx, y: ty, dx: e.dx, dy: e.dy };
  }
  // quem leva haste, de lado, segura à frente do corpo (o braço não balança com ela)
  function preHaste(P, lanca) {
    if (P.vista !== "lado" || P.montado) return;
    if (!P.golpe) P.maoArma = [P.cx + 6 + ([1, 0, -1, 0][P.fase] || 0), P.yT + 14];
    else if (lanca && P.golpe === 2) P.maoArma = [P.cx + 7, P.yT + 8];
  }
  // de frente, a estocada da lança desce do peito para o chão (a mão não vai até o joelho)
  function preLanca(P) {
    preHaste(P, true);
    if (P.vista === "frente" && P.golpe === 2 && !P.montado) P.maoArma = [P.cx - 9 - P.L, P.yT + 12];
  }

  const AC = {};
  const ac = (nome, def) => { AC[nome] = def; };

  // ----- cajados, lanças, remo, ankh -----
  ac("cajado_alto", {
    pre: (P) => preHaste(P),
    frente(G, c, P) {
      const R = madeira(c[0]), t = haste(G, P, R, { yTopo: 7 });
      elipse(G, t.x - t.dx, t.y - t.dy, 1.8, 1.8, bola(madeira(c[1] || claro(c[0], 0.2))));
      return true;
    },
  });
  ac("cajado_curvo", {
    pre: (P) => preHaste(P),
    frente(G, c, P) {
      const R = madeira(c[0]), R2 = madeira(c[1] || c[0]), t = haste(G, P, R, { yTopo: 10, margem: 8 });
      // o gancho do pastor: meia-volta para fora do corpo (para a frente, de lado)
      const s = P.vista === "frente" ? -1 : 1, px = -t.dy * s, py = t.dx * s;
      const lado = Math.sign(px || s) || 1, ccx = t.x + (Math.abs(px) > 0.5 ? px : lado) * 3, ccy = t.y + (Math.abs(px) > 0.5 ? py : 0) * 3;
      for (let a = 0; a <= 215; a += 12) {
        const r = (a * Math.PI) / 180, X = Math.floor(ccx - lado * 3 * Math.cos(r)), Y = Math.floor(ccy - 3.4 * Math.sin(r));
        const R3 = a > 150 ? R2 : R;
        G.fino(X, Y, luz(R3, 0.5 - a / 200)); G.fino(X, Y - 1, luz(R3, 0.9 - a / 240));
      }
      return true;
    },
  });
  ac("cajado_curto", {
    frente(G, c, P) {
      const ouro = /^#(e|f)/.test(c[0]), R = ouro ? metal(escuro(c[0], 0.3), claro(c[0], 0.3)) : madeira(c[0]);
      const t = haste(G, P, R, { solta: [15, 7], nos: !ouro });
      elipse(G, t.x, t.y, 2.3, 2.3, bola(metal("#b07a38", "#ffe08a")));
      return true;
    },
  });
  function pontaLanca(G, t, c, n) {
    const R = metal(escuro(c, 0.25), claro(c, 0.35)), s = ladoLuz(t.dx, t.dy);
    forma(G, t.x, t.y, t.dx, t.dy, -1.5, 0, 1.6, () => "#3a2416");
    forma(G, t.x, t.y, t.dx, t.dy, 0, n, 2.4, (u, v, X, Y) => {
      const w = u < 2.2 ? 0.8 + u * 0.75 : 2.4 * (1 - (u - 2.2) / (n - 2.2)) + 0.45;
      if (Math.abs(v) > w) return null;
      return luz(R, Math.abs(v) < 0.5 ? 0.15 : v * s > 0 ? 0.85 : -0.5, X, Y);
    });
  }
  ac("lanca", {
    pre: (P) => preLanca(P),
    frente(G, c, P) { const t = haste(G, P, madeira(c[0]), { yTopo: 10, lanca: true }); pontaLanca(G, t, c[1], 7); return true; },
  });
  ac("lanca_longa", {
    pre: (P) => preLanca(P),
    frente(G, c, P) {
      const t = haste(G, P, madeira(c[0]), { yTopo: 10, lanca: true });
      pontaLanca(G, t, c[1], 8.5);
      // flâmula curta abaixo da ponta
      const s = P.vista === "frente" ? -1 : 1, R = pano("#8e2a1f");
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3 - (i > 1 ? 1 : 0); j++) G.fino(Math.floor(t.x - t.dx * (3 + j) - t.dy * s * (1.5 + i)), Math.floor(t.y - t.dy * (3 + j) + t.dx * s * (1.5 + i) + (i > 2 ? 1 : 0)), luz(R, 0.5 - i * 0.3 - j * 0.2));
      return true;
    },
  });
  ac("remo", {
    pre: (P) => preHaste(P),
    frente(G, c, P) {
      const t = haste(G, P, madeira(c[0]), { yTopo: 15 }), R = madeira(c[1] || c[0]), s = ladoLuz(t.dx, t.dy);
      forma(G, t.x, t.y, t.dx, t.dy, -1, 10, 2.6, (u, v, X, Y) => {
        const w = u < 1 ? 1.2 : u > 8 ? 2.6 - (u - 8) * 0.7 : 2.6;
        if (Math.abs(v) > w) return null;
        return luz(R, Math.abs(v) < 0.5 ? -0.35 : v * s > 0 ? 0.6 : -0.1, X, Y);
      });
      return true;
    },
  });
  ac("ankh", {
    frente(G, c, P) {
      const t = P.topoArma ? { x: P.topoArma[0], y: P.topoArma[1] } : { x: P.maoArma[0] + 0.5, y: P.maoArma[1] - 14 };
      const e = P.topoArma ? empunharHaste(P, { solta: [15, 7] }) : { dx: 0, dy: -1 };
      const R = metal("#a8742c", c[0] || "#e8b94a");
      // haste curta, travessa e a alça
      forma(G, t.x, t.y, e.dx, e.dy, -1, 3, 1, (u, v, X, Y) => luz(R, v > 0 ? -0.3 : 0.5, X, Y));
      forma(G, t.x + e.dx * 2.5, t.y + e.dy * 2.5, e.dx, e.dy, -1, 1, 3.6, (u, v, X, Y) => luz(R, 0.6 - Math.abs(v) * 0.2, X, Y));
      const ax = t.x + e.dx * 6.2, ay = t.y + e.dy * 6.2;
      elipse(G, ax, ay, 2.7, 3.2, (nx, ny, X, Y) => (nx * nx + ny * ny < 0.22 ? null : luz(R, 0.4 - nx * 0.8 - ny * 0.7, X, Y)));
      return true;
    },
  });

  // ----- espadas e porrete -----
  function lamina(G, P, c, curva) {
    const [hx, hy] = P.maoArma, [dx, dy] = dirLamina(P), x0 = hx + 0.5, y0 = hy + 0.5;
    const Rl = metal(c[0], c[1]), Rg = metal(escuro(c[2] || "#b07a38", 0.3), claro(c[2] || "#b07a38", 0.3)), Rc = couro(c[3] || "#5a3624");
    const s = ladoLuz(dx, dy), madeiraPura = /^#(8a6038|d9a35c)$/i.test(c[0]) || /^#(8a6038)$/i.test(c[0]);
    // 18 px da mão à ponta; apontada para cima, encurta para a ponta não sair da célula
    const n = dy < -0.5 ? Math.max(12, Math.min(18, (y0 - 2.5) / -dy)) : dx > 0.5 ? Math.min(18, (45.5 - x0) / dx) : 18, ks = P.vista === "frente" ? -1 : 1;
    // cabo com pomo, guarda e lâmina (fio claro do lado da luz, dorso escuro, brilho especular)
    forma(G, x0, y0, dx, dy, -3.2, 2, 1.05, (u, v, X, Y) => (u < -2.2 ? luz(Rg, 0.3 - v * s * -0.5, X, Y) : luz(Rc, (Math.floor(u) & 1 ? 0.25 : -0.3) + v * s * 0.3, X, Y)));
    forma(G, x0, y0, dx, dy, 2, 3.4, 3.3, (u, v, X, Y) => luz(Rg, 0.45 + v * s * 0.22 - (u > 2.9 ? 0.5 : 0), X, Y));
    forma(G, x0, y0, dx, dy, 3.4, n, 4.5, (u, v, X, Y) => {
      const t = (u - 3.4) / (n - 3.4);
      let w = t > 0.8 ? 1.55 * (1 - (t - 0.8) / 0.2) + 0.5 : 1.55;
      if (curva) { v -= ks * Math.pow(Math.max(0, t - 0.35), 2) * 7.5; w += t > 0.4 && t < 0.85 ? 0.45 : 0; }
      if (Math.abs(v) > w) return null;
      if (madeiraPura) return luz(madeira(c[1]), v * s * 0.6, X, Y);
      let l = Math.abs(v) < 0.5 ? 0.05 : v * s > 0 ? 0.8 : -0.7;
      if (t > 0.28 && t < 0.42 && v * s > -0.5) l = 1;
      return luz(Rl, l, X, Y);
    });
    return true;
  }
  ac("espada", { frente: (G, c, P) => lamina(G, P, c, false) });
  ac("espada_curva", { frente: (G, c, P) => lamina(G, P, c, true) });
  ac("porrete", {
    frente(G, c, P) {
      const [hx, hy] = P.maoArma, [dx, dy] = dirLamina(P), x0 = hx + 0.5, y0 = hy + 0.5;
      const Rc = madeira(c[1] || c[0]), Rm = madeira(c[0]), s = ladoLuz(dx, dy);
      forma(G, x0, y0, dx, dy, -2.5, 9, 1.1, (u, v, X, Y) => luz(Rc, v * s * 0.6 + (Math.floor(u) % 3 === 0 ? -0.3 : 0), X, Y));
      const cxm = x0 + dx * 10.5, cym = y0 + dy * 10.5;
      elipse(G, cxm, cym, 3.3, 3.3, (nx, ny, X, Y) => (hash2(X, Y, 31) > 0.86 ? "#c8c0b0" : bola(Rm)(nx, ny, X, Y)));
      forma(G, x0, y0, dx, dy, 7.2, 8.2, 2.2, () => "#3a2416");
      return true;
    },
  });

  // ----- escudos -----
  function escudo(G, P, c, formaE, camada) {
    const v = P.vista, [fr, aro, cen] = [c[0], c[1], c[2] || c[0]];
    const [x, y] = P.escudoEm || P.maoEscudo;
    const Rf = madeira(fr), Ra = metal(escuro(aro, 0.2), claro(aro, 0.25)), Rc = metal(escuro(cen, 0.25), claro(cen, 0.35));
    const ry = formaE === "alto" ? 10.5 : formaE === "oval" ? 8.5 : 7.2;
    if (v === "lado") {
      if (camada !== "meio") return false;
      // no braço de longe: de quina, à frente do peito
      const ex = P.maoLonge && P.maoLonge[0] > P.cx ? x + 2 : P.cx + 7, ey = P.maoLonge && P.maoLonge[0] > P.cx ? y - 3 : P.yT + 10;
      if (formaE === "alto") {
        for (let j = -10; j <= 10; j++) for (let i = -3; i <= 2; i++) {
          if ((j === -10 || j === -9) && (i === -3 || i === 2) || (j === -10 && (i === -2 || i === 1))) continue;
          const X = Math.floor(ex) + i, Y = Math.floor(ey) + j, borda = i === -3 || j === 10 || j <= -9 || (j === -8 && (i === -2 || i === 1));
          const malha = hash2(Math.floor((i + j * 0.5 + 40) / 2), Math.floor((j + 20) / 3), 53) > 0.55;
          G.fino(X, Y, borda ? luz(Rc, 0.5 - j * 0.04, X, Y) : luz(malha ? pano(aro) : Rf, -0.05 - i * 0.22 - j * 0.03 - (i === 2 ? 0.35 : 0), X, Y));
        }
        return false;
      }
      elipse(G, ex, ey, 3.2, ry, (nx, ny, X, Y) => (nx < -0.45 ? luz(Ra, 0.7 - ny * 0.4, X, Y) : luz(Rf, 0.1 - nx * 0.6 - ny * 0.55 - (nx > 0.5 ? 0.3 : 0), X, Y)));
      if (formaE !== "alto") elipse(G, ex + 1, ey, 1.3, 2, bola(Rc, 0.2));
      return false;
    }
    if (v === "costas") {
      if (camada !== "meio") return false;
      // o verso, com as correias; o braço passa por cima
      const ex = x - 1, ey = y - 4, Rv = madeira(escuro(fr, 0.3));
      elipse(G, ex, ey, formaE === "redondo" ? 7.2 : 6, ry, (nx, ny, X, Y) => (nx * nx + ny * ny > 0.74 ? luz(Ra, -0.2 - nx * 0.5 - ny * 0.5, X, Y) : luz(Rv, -0.1 - nx * 0.5 - ny * 0.5 + ((X & 3) === 0 ? -0.3 : 0), X, Y)));
      for (let i = -3; i <= 3; i++) { G.fino(Math.floor(ex) + i, Math.floor(ey) - 2, "#3a2416"); G.fino(Math.floor(ex) + i, Math.floor(ey) + 3, "#4a2c1a"); }
      return false;
    }
    if (camada !== "frente") return false;
    const ex = x + 1, ey = y - 4;
    if (formaE === "alto") {
      // escudo alto do Egito: topo em arco, base reta, couro malhado e a moldura
      for (let j = -10; j <= 10; j++) {
        const hw = j < -6 ? 6.5 * Math.sqrt(Math.max(0, 1 - Math.pow((j + 6) / 4.6, 2))) : 6.5;
        for (let X = Math.ceil(ex - hw); X < ex + hw; X++) {
          const Y = Math.floor(ey) + j, u = (X + 0.5 - ex) / 6.5, borda = Math.abs(X + 0.5 - ex) > hw - 1.3 || j === 10 || (j < -6 && Math.abs(X + 0.5 - ex) > hw - 1.6) || j === -10;
          if (hw < 0.5) continue;
          if (borda) { G.fino(X, Y, luz(Rc, 0.3 - u * 0.7 - j * 0.04, X, Y)); continue; }
          const malha = hash2(Math.floor((X + j * 0.5) / 3), Math.floor(j / 3), 53) > 0.55;
          G.fino(X, Y, luz(malha ? pano(aro) : Rf, 0.25 - u * 0.75 - j * 0.035, X, Y));
        }
      }
      for (let j = -2; j <= 2; j++) { G.fino(Math.floor(ex) - 1, Math.floor(ey) + j, Rc[4]); G.fino(Math.floor(ex), Math.floor(ey) + j, Rc[2]); }
      return true;
    }
    if (formaE === "oval") {
      elipse(G, ex, ey, 5.8, ry, (nx, ny, X, Y) => {
        const r = nx * nx + ny * ny;
        if (r > 0.72) return luz(Ra, 0.3 - nx * 0.7 - ny * 0.6, X, Y);
        if (Math.abs(nx) < 0.2) return luz(Ra, 0.5 - ny * 0.6, X, Y);
        return luz(Rf, 0.3 - nx * 0.8 - ny * 0.6 + ((Y & 3) === 1 ? -0.3 : 0), X, Y);
      });
      elipse(G, ex, ey, 1.6, 2, bola(Ra, 0.3));
      return true;
    }
    const metalico = !/^#(8a5a32|7d522b|8a1f1f)$/i.test(fr), Rm = metalico ? metal(escuro(fr, 0.25), claro(fr, 0.3)) : Rf;
    elipse(G, ex, ey, 7.2, 7.2, (nx, ny, X, Y) => {
      const r = Math.sqrt(nx * nx + ny * ny);
      if (r > 0.8) return luz(Ra, 0.35 - nx * 0.8 - ny * 0.8, X, Y);
      if (r < 0.3) return luz(Rc, 0.45 - nx * 2.2 - ny * 2.2, X, Y);
      if (r < 0.42) return luz(Rc, -0.6, X, Y);
      // tábuas (madeira) ou anéis batidos (metal)
      const marca = metalico ? Math.abs(r - 0.62) < 0.05 : (X - Math.floor(ex)) % 3 === 0;
      return luz(Rm, 0.3 - nx * 0.75 - ny * 0.75 - (marca ? 0.35 : 0), X, Y);
    });
    // rebites no aro
    for (const [ax, ay] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) G.fino(Math.floor(ex + ax * 5.2), Math.floor(ey + ay * 5.2), Rc[4]);
    return true;
  }
  for (const [nome, f] of [["escudo_redondo", "redondo"], ["escudo_alto", "alto"], ["escudo_oval", "oval"]])
    ac(nome, { meio: (G, c, P) => escudo(G, P, c, f, "meio"), frente: (G, c, P) => escudo(G, P, c, f, "frente") });

  // ----- arcos -----
  // arco entre dois pontos, com a barriga para o lado (px, py); a corda fecha as pontas
  function arcoCurvo(G, x0, y0, x1, y1, bx, by, R, corda, puxa) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.4);
    if (corda) {
      const mx = (x0 + x1) / 2 - (puxa ? bx * puxa : 0), my = (y0 + y1) / 2 - (puxa ? by * puxa : 0);
      linha(G, x0, y0, mx, my, corda); linha(G, mx, my, x1, y1, corda);
    }
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * 2 - 1, k = 1 - t * t, X = x0 + (x1 - x0) * (i / n) + bx * k, Y = y0 + (y1 - y0) * (i / n) + by * k;
      const fim = Math.abs(t) > 0.86, meio = Math.abs(t) < 0.16;
      G.fino(Math.floor(X), Math.floor(Y), luz(R, meio ? -0.6 : 0.55 - (t + 1) * 0.3));
      if (!fim) G.fino(Math.floor(X + Math.sign(bx || 0.0001) * (Math.abs(bx) >= Math.abs(by) ? 1 : 0)), Math.floor(Y + (Math.abs(by) > Math.abs(bx) ? Math.sign(by) : 0)), luz(R, meio ? -0.9 : -0.25 - (t + 1) * 0.2));
    }
  }
  ac("arco_costas", {
    fundo(G, c, P) {
      const R = madeira(c[0]), yT = P.yT, cx = P.cx;
      if (P.vista === "lado") arcoCurvo(G, cx - 5, yT - 4, cx - 6, yT + 20, -4, 0, R, c[1]);
      else if (P.vista === "frente") arcoCurvo(G, cx + 9, yT - 5, cx - 9, yT + 19, 2.5, 2.5, R, null);
    },
    meio(G, c, P) {
      const yT = P.yT, cx = P.cx;
      if (P.vista === "frente") { linha(G, cx + 5, yT + 1, cx - 6, P.yC - 1, (i) => (i % 3 === 2 ? escuro(c[1], 0.25) : c[1])); return; }
      if (P.vista !== "costas") return;
      arcoCurvo(G, cx - 9, yT - 5, cx + 9, yT + 19, 2.6, -2.6, madeira(c[0]), c[1]);
      // aljava ao ombro
      for (let j = 0; j < 9; j++) for (let i = 0; i < 3; i++) G.fino(cx + 2 + i + Math.floor(j / 4), yT + 1 + j, luz(couro("#7a4a30"), 0.5 - i * 0.5 - (j === 0 || j === 8 ? 0.4 : 0)));
      for (const [i, cor] of [[0, "#eadcb6"], [1, "#c2452d"], [2, "#eadcb6"]]) { G.fino(cx + 2 + i, yT - 1, cor); G.fino(cx + 2 + i, yT, "#8a6a42"); }
    },
  });
  // arco visto de cima, deitado: 2 px de madeira (em cima a luz, embaixo a sombra), pontas finas e a corda
  function arcoDeitado(G, xc, y, hw, by, R, corda, puxa) {
    const s = Math.sign(by), yc = (X) => y + by * (1 - Math.pow((X + 0.5 - xc) / hw, 2));
    if (corda) { const my = y - s * puxa; linha(G, Math.round(xc - hw), Math.round(y), Math.round(xc), Math.round(my), corda); linha(G, Math.round(xc), Math.round(my), Math.round(xc + hw) - 1, Math.round(y), corda); }
    for (let X = Math.round(xc - hw); X < Math.round(xc + hw); X++) {
      const t = Math.abs(X + 0.5 - xc) / hw, Y = Math.round(yc(X)), meio = t < 0.14;
      G.fino(X, Y, luz(R, meio ? -0.2 : 0.75 - t * 0.3 - (X > xc ? 0.25 : 0)));
      if (t < 0.9) G.fino(X, Y + 1, luz(R, meio ? -0.8 : -0.45 - (X > xc ? 0.2 : 0)));
      if (t > 0.45 && t < 0.9) G.fino(X, Y - s, luz(R, 0.2)); // a curva íngreme não abre buracos
    }
  }
  ac("arco_mao", {
    pre(P) {
      if (!P.golpe || P.montado) return;
      const cx = P.cx, yT = P.yT, puxa = P.golpe === 1 ? 0 : 3;
      if (P.vista === "lado") { P.maoArma = [cx + 11, yT + 6]; P.maoLonge = [cx + 1 + puxa, yT + 6]; P.maoEscudo = P.maoLonge; }
      else if (P.vista === "frente") { P.maoArma = [cx - 2, yT + 13]; P.maoEscudo = [cx + 3, yT + 8 + puxa]; }
      else { P.maoArma = [cx + 3, yT + 5]; P.maoEscudo = [cx - 4, yT + 10 - puxa]; }
    },
    fundo(G, c, P) {
      if (P.vista !== "costas" || !P.golpe || P.montado) return;
      const [hx, hy] = P.maoArma, g = P.golpe;
      arcoDeitado(G, P.cx, P.yT + 4, 13, -6.5, madeira(c[0]), c[1], 0);
    },
    frente(G, c, P) {
      const [hx, hy] = P.maoArma, v = P.vista, R = madeira(c[0]), g = P.golpe, flecha = "#d8c8a0";
      if (v === "lado") {
        arcoCurvo(G, hx - 2, hy - 12, hx - 2, hy + 12, 4, 0, R, c[1], g === 1 ? 2.4 : 0);
        if (g === 1) { linha(G, hx - 9, hy, hx + 6, hy, flecha); G.fino(hx + 7, hy, "#c8d0d6"); G.fino(hx + 6, hy - 1, "#8a949c"); G.fino(hx + 6, hy + 1, "#8a949c"); G.fino(hx - 9, hy - 1, "#c2452d"); G.fino(hx - 9, hy + 1, "#c2452d"); }
        return true;
      }
      const s = v === "frente" ? -1 : 1;
      if (g) {
        // vista de cima: o arco deitado à frente do peito, com a barriga para o alvo (para baixo, de frente;
        // de costas ele fica além do corpo e é desenhado no fundo). A corda vem até o peito na antecipação.
        if (v === "costas") return true;
        arcoDeitado(G, hx + 1, hy - 3, 11, 4.4, R, c[1], g === 1 ? 3 : 0);
        if (g === 1) { linha(G, hx + 1, hy - 5, hx + 1, hy + 4, flecha); G.fino(hx + 1, hy + 5, "#c8d0d6"); G.fino(hx, hy + 4, "#8a949c"); G.fino(hx + 2, hy + 4, "#8a949c"); G.fino(hx, hy - 5, "#c2452d"); G.fino(hx + 2, hy - 5, "#c2452d"); }
        return true;
      }
      arcoCurvo(G, hx + s, hy - 12, hx + s, hy + 11, s * 4, 0, R, c[1], 0);
      return true;
    },
  });

  // ----- capas -----
  function capa(G, c, P, larga, camada) {
    const v = P.vista, cx = P.cx, yT = P.yT, fase = P.fase, R = pano(c[0]), Rf = pano(c[1] || escuro(c[0], 0.3));
    const y0 = yT + 1, y1 = (larga ? 57 : 55) - (P.montado ? 14 : 0), a0 = P.ombroE[0] - 2, b0 = P.ombroD[0] + 1;
    const vai = fase >= 0 ? [-1, 0, 1, 0][fase] : 0;
    if (v === "costas") {
      if (camada !== "meio") return;
      for (let Y = y0; Y <= y1; Y++) {
        const t = (Y - y0) / (y1 - y0), ab = t * (larga ? 4 : 2.2), bal = t > 0.55 ? vai : 0;
        const a = Math.round(a0 + 1 - ab + bal), b = Math.round(b0 - 1 + ab + bal);
        for (let X = a; X <= b; X++) {
          const u = (X - a) / (b - a), d = Math.cos((u * 3.3 + 0.08 + (fase >= 0 ? fase * 0.09 : 0)) * DOIS_PI);
          if (Y > y1 - (d < -0.55 ? 1 : 0) - (X === a || X === b ? 1 : 0)) continue;
          let l = 0.6 - 1.25 * u + d * 0.42 * (0.2 + t) - t * 0.22;
          if (Y >= y1 - 1) l -= 0.35;
          if (Y === y0) l += 0.3;
          G.fino(X, Y, luz(R, l, X, Y));
        }
      }
      for (let X = cx - 5; X <= cx + 4; X++) G.fino(X, y0 - 1, luz(Rf, 0.3 - (X - cx) * 0.12, X, y0));
      return;
    }
    if (v === "frente") {
      if (camada === "fundo") {
        // o forro aparece atrás do corpo, dos dois lados
        for (let Y = y0 + 1; Y <= y1; Y++) {
          const t = (Y - y0) / (y1 - y0), ab = t * (larga ? 3.5 : 2), a = Math.round(a0 - ab + (t > 0.55 ? vai : 0)), b = Math.round(b0 + ab + (t > 0.55 ? vai : 0));
          for (let X = a; X <= b; X++) {
            const borda = X <= a + 1 || X >= b - 1;
            if (Y === y1 && (X === a || X === b)) continue;
            G.fino(X, Y, borda ? luz(R, X <= a + 1 ? 0.55 - t * 0.3 : -0.35 - t * 0.2, X, Y) : luz(Rf, -0.25 - (X - a) / (b - a) * 0.5 - (Y >= y1 - 1 ? 0.3 : 0), X, Y));
          }
        }
        return;
      }
      if (camada !== "meio") return;
      // presa nos ombros, com o broche
      for (let Y = yT; Y <= yT + 2; Y++) { const [a, b] = P.tronco(Y); for (let X = a; X <= b; X++) if (Math.abs(X + 0.5 - cx) > 3.2 - (Y - yT) * 0.4) G.fino(X, Y, luz(R, 0.8 - ((X - a) / (b - a)) * 1.3 - (Y - yT) * 0.25, X, Y)); }
      G.fino(cx - 4, yT + 2, "#f2d27a"); G.fino(cx - 4, yT + 3, "#b07a38"); G.fino(cx + 3, yT + 2, "#e8b94a"); G.fino(cx + 3, yT + 3, "#8a5a2b");
      return;
    }
    if (camada !== "fundo") return;
    // de lado: cai pelas costas e abre para trás no passo e no golpe
    const voa = P.golpe === 2 ? 4 : P.golpe === 1 ? -1 : fase === 0 || fase === 2 ? 2 : fase >= 0 ? 1 : 0;
    for (let Y = y0; Y <= y1; Y++) {
      const t = (Y - y0) / (y1 - y0), a = Math.round(cx - 6 - t * (larga ? 6 : 4) - t * t * voa), b = cx - 1;
      for (let X = a; X <= b; X++) {
        const u = (X - a) / Math.max(1, b - a);
        if (Y === y1 && X === a) continue;
        G.fino(X, Y, luz(R, 0.7 - 1.2 * u + Math.cos((u * 2 + t) * DOIS_PI) * 0.25 * t - t * 0.2 - (Y >= y1 - 1 ? 0.35 : 0), X, Y));
      }
    }
  }
  for (const [nome, larga] of [["capa", false], ["capa_larga", true]])
    ac(nome, { fundo: (G, c, P) => capa(G, c, P, larga, "fundo"), meio: (G, c, P) => capa(G, c, P, larga, "meio") });

  // ----- cabeça: turbante, elmo, faixa, bandana, nemes -----
  // cúpula sobre a cabeça: linhas T + r0 .. T + r0 + hw.length − 1, meia-largura por linha; de lado o eixo recua meio px
  function cupula(G, P, r0, hws, f) {
    const cx = P.cx, T = P.T;
    for (let k = 0; k < hws.length; k++) {
      const hw = hws[k], Y = T + r0 + k, a = cx - hw, b = cx + hw - 1;
      for (let X = a; X <= b; X++) { const c = f((X - a) / Math.max(1, b - a), k / Math.max(1, hws.length - 1), X, Y, k); if (c) G.fino(X, Y, c); }
    }
  }
  ac("turbante", {
    frente(G, c, P) {
      const v = P.vista, cx = P.cx, T = P.T, R = pano(c[0]), n = 8;
      cupula(G, P, -3, [4, 6, 7, 7, 7, 7, 7, 6], (u, w, X, Y, k) => {
        if (k === n - 1 && c[1]) return luz(pano(c[1]), 0.5 - 1.1 * u, X, Y);
        // as voltas do pano: faixas inclinadas que se cruzam na frente
        const d = v === "costas" ? (X - cx) * 0.45 + k : Math.abs(X - cx + (v === "lado" ? -2 : 0.5)) * 0.55 + k;
        const volta = (((d % 2.6) + 2.6) % 2.6) / 2.6;
        return luz(R, 0.75 - 1.35 * u - w * 0.45 + (volta < 0.3 ? -0.45 : volta > 0.7 ? 0.2 : 0), X, Y);
      });
      if (c[2] && v !== "costas") { const jx = v === "lado" ? cx + 4 : cx - 1; G.fino(jx, T, c[2]); G.fino(jx, T + 1, escuro(c[2], 0.3)); if (v === "frente") { G.fino(jx + 1, T, claro(c[2], 0.4)); G.fino(jx + 1, T + 1, c[2]); } }
      // a ponta do pano cai atrás
      if (v === "lado") for (let j = 0; j < 8; j++) for (let i = 0; i < 2; i++) G.fino(cx - 7 + i - (j > 5 ? 1 : 0), T + 4 + j, luz(R, 0.4 - i * 0.6 - j * 0.08));
      else if (v === "costas") for (let j = 0; j < 7; j++) for (let i = 0; i < 3 - (j > 4 ? 1 : 0); i++) G.fino(cx - 1 + i, T + 5 + j, luz(R, 0.5 - i * 0.5 - j * 0.07));
    },
  });
  ac("elmo", {
    frente(G, c, P) {
      const v = P.vista, cx = P.cx, T = P.T, R = metal(c[0], c[1]);
      cupula(G, P, -2, [3, 5, 6, 6, 6, 6, 6], (u, w, X, Y) => {
        let l = 0.55 - 1.5 * u - w * 0.5 + (u > 0.9 ? 0.25 : 0);
        const dx = u - 0.3, dy = w - 0.3;
        if (dx * dx + dy * dy < 0.012) l = 1;
        if (v !== "lado" && Math.abs(X - cx + 0.5) < 1) l += 0.3; // crista
        return luz(R, l, X, Y);
      });
      for (let X = cx - 6; X <= cx + 5; X++) G.fino(X, T + 5, luz(R, 0.9 - ((X - cx + 6) / 11) * 1.2));
      G.fino(cx - 1, T - 3, R[4]); G.fino(cx, T - 3, R[2]); G.fino(cx - 1, T - 4, R[5]); G.fino(cx, T - 4, R[3]);
      if (v === "frente") {
        for (let j = 6; j <= 8; j++) { G.fino(cx - 1, T + j, R[4]); G.fino(cx, T + j, R[2]); }
        for (let j = 6; j <= 9; j++) { G.fino(cx - 6, T + j, R[4]); G.fino(cx - 5, T + j, j < 9 ? R[3] : null || R[2]); G.fino(cx + 4, T + j, R[2]); G.fino(cx + 5, T + j, R[1]); }
      } else if (v === "lado") {
        for (let j = 6; j <= 9; j++) for (let i = -3; i <= (j < 8 ? 0 : -1); i++) G.fino(cx + i, T + j, luz(R, 0.5 + i * 0.25 - (j - 6) * 0.2));
        for (let j = 6; j <= 8; j++) for (let i = -6; i <= -5; i++) G.fino(cx + i, T + j, luz(R, 0.2 - (j - 6) * 0.3));
        G.fino(cx + 4, T + 6, R[3]);
      } else for (let j = 6; j <= 9; j++) for (let X = cx - 6 + (j > 8 ? 1 : 0); X <= cx + 5 - (j > 8 ? 1 : 0); X++) G.fino(X, T + j, luz(R, 0.5 - ((X - cx + 6) / 11) * 1.3 - (j - 6) * 0.15 + (j === 6 ? -0.3 : 0)));
    },
  });
  ac("faixa", {
    frente(G, c, P) {
      const v = P.vista, cx = P.cx, T = P.T, R = pano(c[0]);
      const a = cx - 6, b = v === "lado" ? cx + 4 : cx + 5;
      for (let Y = T + 3; Y <= T + 4; Y++) for (let X = a; X <= b; X++) G.fino(X, Y, luz(R, 0.75 - ((X - a) / (b - a)) * 1.3 - (Y - T - 3) * 0.4, X, Y));
      if (v === "lado") { for (let j = 0; j < 6; j++) { G.fino(cx - 7 - (j > 3 ? 1 : 0), T + 4 + j, R[j < 2 ? 4 : 3]); G.fino(cx - 6 - (j > 3 ? 1 : 0), T + 4 + j, R[1]); } }
      else if (v === "costas") { G.fino(cx - 1, T + 3, R[1]); G.fino(cx, T + 4, R[1]); for (let j = 0; j < 6; j++) { G.fino(cx - 2 - (j > 2 ? 1 : 0), T + 5 + j, R[4]); if (j < 5) G.fino(cx + 1 + (j > 2 ? 1 : 0), T + 5 + j, R[2]); } }
    },
  });
  ac("bandana", {
    frente(G, c, P) {
      const v = P.vista, cx = P.cx, T = P.T, R = pano(c[0]);
      cupula(G, P, -1, [4, 5, 6, 6, 6, 6], (u, w, X, Y, k) => (c[1] && hash2(X, Y, 91) > 0.88 && k > 0 && k < 5 ? c[1] : luz(R, 0.7 - 1.4 * u - w * 0.5 + (k === 5 ? -0.25 : 0), X, Y)));
      if (v === "lado") { G.fino(cx - 7, T + 3, R[3]); G.fino(cx - 7, T + 4, R[2]); for (let j = 0; j < 5; j++) { G.fino(cx - 8, T + 4 + j, R[j < 2 ? 4 : 3]); G.fino(cx - 7, T + 5 + j, R[1]); } }
      else if (v === "costas") { for (let i = -1; i <= 0; i++) for (let j = 4; j <= 5; j++) G.fino(cx + i, T + j, R[j === 4 ? 2 : 1]); for (let j = 0; j < 5; j++) { G.fino(cx - 2 - (j > 2 ? 1 : 0), T + 6 + j, R[4]); G.fino(cx + 1 + (j > 1 ? 1 : 0), T + 6 + j, R[2]); } }
      else { G.fino(cx + 5, T + 3, R[2]); G.fino(cx + 6, T + 4, R[2]); G.fino(cx + 6, T + 5, R[1]); }
    },
  });
  ac("nemes", {
    frente(G, c, P) {
      const v = P.vista, cx = P.cx, T = P.T, yT = P.yT, A = pano(c[0]), B = pano(c[1]);
      const lst = (k, l, X, Y) => luz(k & 1 ? B : A, l, X, Y);
      cupula(G, P, -2, [4, 6, 7, 7, 7, 7, 7], (u, w, X, Y) => lst(Math.floor((v === "lado" ? X - cx + 20 : Math.abs(X - cx + 0.5) + 0.5) / 2), 0.7 - 1.3 * u - w * 0.45, X, Y));
      const ouro = c[2] || c[1];
      if (v === "frente") {
        for (let X = cx - 6; X <= cx + 5; X++) G.fino(X, T + 4, luz(metal(escuro(ouro, 0.3), claro(ouro, 0.3)), 0.7 - ((X - cx + 6) / 11) * 1.2));
        G.fino(cx - 1, T + 3, claro(ouro, 0.5)); G.fino(cx, T + 3, ouro); G.fino(cx - 1, T + 2, ouro);
        // abas listradas sobre os ombros
        for (let Y = T + 5; Y <= yT + 7; Y++) {
          const k = Math.floor((Y - T) / 2), fim = Y === yT + 7 ? 1 : 0;
          for (let i = 0; i < 3 - fim; i++) { G.fino(cx - 8 + i + fim, Y, lst(k, 0.6 - i * 0.4, 0, 0)); G.fino(cx + 5 + i, Y, lst(k, -0.1 - i * 0.4, 0, 0)); }
        }
      } else if (v === "lado") {
        for (let Y = T + 5; Y <= yT + 6; Y++) { const k = Math.floor((Y - T) / 2), e = Y > yT + 3 ? Y - yT - 3 : 0; for (let X = cx - 7 + e; X <= cx - 3; X++) G.fino(X, Y, lst(k, 0.5 - (X - cx + 7) * 0.25, 0, 0)); }
        for (let Y = T + 8; Y <= yT + 6; Y++) { G.fino(cx - 1, Y, lst(Math.floor((Y - T) / 2), 0.3, 0, 0)); G.fino(cx, Y, lst(Math.floor((Y - T) / 2), -0.3, 0, 0)); }
        G.fino(cx + 5, T + 3, ouro); G.fino(cx + 6, T + 2, claro(ouro, 0.4));
      } else {
        for (let Y = T + 5; Y <= yT + 9; Y++) {
          const k = Math.floor((Y - T) / 2), hw = Y <= yT + 3 ? 7 : Y <= yT + 5 ? 5 : 2;
          for (let X = cx - hw; X < cx + hw; X++) G.fino(X, Y, lst(k, 0.6 - ((X - cx + hw) / (2 * hw)) * 1.2, 0, 0));
        }
      }
    },
  });

  // ----- sobre o tronco: colar, peitoral, pele de leopardo, estola -----
  ac("colar", {
    meio(G, c, P) {
      const v = P.vista, cx = P.cx, yT = P.yT, A = metal(escuro(c[0], 0.3), claro(c[0], 0.3)), B = pano(c[1]);
      const conta = (X, j, l) => ((X + j) & 1 ? luz(A, l) : luz(B, l));
      if (v === "costas") { for (let X = cx - 4; X <= cx + 3; X++) G.fino(X, yT + 1, conta(X, 0, 0.3 - (X - cx) * 0.15)); return; }
      if (v === "lado") { for (let j = 0; j < 4; j++) { const [, b] = P.tronco(yT + j); for (let X = cx - 1 + (j > 2 ? 1 : 0); X <= b; X++) G.fino(X, yT + j, j === 3 ? luz(A, -0.2) : conta(X, j, 0.5 - j * 0.2)); } return; }
      for (let j = 0; j < 5; j++) for (let X = cx - 7 + j; X <= cx + 6 - j; X++) {
        if (Math.abs(X + 0.5 - cx) < 2.6 - j * 0.9) continue; // o decote
        const [a, b] = P.tronco(yT + j);
        if (X < a || X > b) continue;
        G.fino(X, yT + j, j === 4 || Math.abs(X + 0.5 - cx) > 6.2 - j ? luz(A, 0.2 - (X - cx) * 0.1) : conta(X, j, 0.55 - (X - cx) * 0.1 - j * 0.1));
      }
    },
  });
  const PEDRAS = ["#c2452d", "#e8b94a", "#4fa3a5", "#55a04a", "#6d8fc4", "#f0e8d8", "#b98ad0", "#e2774f", "#3b5a9a", "#a9dccf", "#8e2a1f", "#f2d27a"];
  ac("peitoral", {
    meio(G, c, P) {
      const v = P.vista, cx = P.cx, y = P.yT + 4, O = metal("#a8742c", c[0] || "#e8b94a");
      if (v === "costas") {
        // as ombreiras do éfode e o cordão azul
        for (let j = 1; j <= 6; j++) { G.fino(cx - 5, P.yT + j, O[4]); G.fino(cx - 4, P.yT + j, O[2]); G.fino(cx + 3, P.yT + j, O[3]); G.fino(cx + 4, P.yT + j, O[1]); }
        return;
      }
      if (v === "lado") {
        for (let j = 0; j < 9; j++) { const [, b] = P.tronco(y + j); G.fino(b - 1, y + j, j % 2 ? PEDRAS[(j >> 1) * 3 % 12] : O[4]); G.fino(b, y + j, j % 2 ? escuro(PEDRAS[((j >> 1) * 3 + 2) % 12], 0.2) : O[2]); G.fino(b - 2, y + j, O[j === 0 ? 5 : 3]); }
        linha(G, cx, P.yT + 1, P.tronco(y)[1] - 2, y - 1, O[3]);
        return;
      }
      for (let j = 0; j < 9; j++) for (let i = 0; i < 8; i++) {
        const X = cx - 4 + i, Y = y + j, moldura = i === 0 || i === 7 || j % 2 === 0;
        if (moldura) G.fino(X, Y, luz(O, 0.7 - i * 0.14 - j * 0.07 + (j === 0 ? 0.3 : j === 8 ? -0.4 : 0)));
        else { const p = PEDRAS[((j - 1) >> 1) * 3 + ((i - 1) >> 1)]; G.fino(X, Y, (i - 1) & 1 ? escuro(p, 0.22) : claro(p, 0.12)); }
      }
      // as correntes de ouro até os ombros
      linha(G, cx - 4, y - 1, cx - 6, P.yT + 1, O[4]); linha(G, cx + 3, y - 1, cx + 5, P.yT + 1, O[2]);
    },
  });
  // faixa diagonal sobre o tronco: do ombro "de" até o quadril oposto; devolve [x0, x1] por linha
  function diagonal(P, Y, larg) {
    const v = P.vista, [a, b] = P.tronco(Y), t = clamp((Y - P.yT) / (P.yC + 1 - P.yT), 0, 1);
    if (v === "lado") return [Math.max(a, P.cx - 3 - Math.round(t)), Math.min(b, P.cx - 3 + larg)];
    if (v === "frente") { const x0 = Math.round(a + t * (b - a - larg + 1)); return [Math.max(a, x0 - (Y < P.yT + 2 ? 2 : 0)), Math.min(b, x0 + larg - 1)]; }
    const x1 = Math.round(b - t * (b - a - larg + 1));
    return [Math.max(a, x1 - larg + 1), Math.min(b, x1 + (Y < P.yT + 2 ? 2 : 0))];
  }
  ac("pele_leopardo", {
    meio(G, c, P) {
      const v = P.vista, cx = P.cx, Rp = rampa6("#d8a040", "pelo");
      const pinta = (X, Y) => { const h = hash2(Math.floor(X / 2), Math.floor(Y / 2), 17); return h > 0.62 && ((X ^ Y) & 1) === 0; };
      const cor = (X, Y, l) => (pinta(X, Y) ? "#3a2414" : luz(Rp, l, X, Y));
      for (let Y = P.yT; Y <= P.yC + 1; Y++) { const [a, b] = diagonal(P, Y, 8); for (let X = a; X <= b; X++) G.fino(X, Y, cor(X, Y, 0.6 - ((X - a) / Math.max(1, b - a)) * 1.2 - (X === a || X === b ? 0.3 : 0))); }
      // a pata e a cauda caindo abaixo do cinto
      const s = v === "costas" ? -1 : 1, x0 = v === "lado" ? cx + 1 : cx + s * 4;
      for (let j = 0; j < 8; j++) for (let i = 0; i < (j < 5 ? 4 : 2); i++) G.fino(x0 + (s > 0 ? i : -i) - (v === "lado" ? 2 : 0), P.yC + 2 + j, cor(x0 + i, P.yC + j, 0.4 - i * 0.35 - (j === 7 ? 0.4 : 0)));
    },
  });
  ac("estola", {
    meio(G, c, P) {
      const v = P.vista, cx = P.cx, R = [misturar(c[2], "#1a0e16", 0.5), misturar(c[2], "#2e1a2a", 0.2), c[2], c[1], c[0], misturar(c[0], "#fff2cc", 0.3)];
      const fase = P.fase, y1 = P.montado ? P.yC + 4 : 55;
      // manto sobre um ombro, cruzando o peito e caindo até a barra
      for (let Y = P.yT; Y <= P.yC + 1; Y++) {
        const [a, b] = diagonal(P, Y, 8);
        for (let X = a; X <= b; X++) { const u = (X - a) / Math.max(1, b - a); G.fino(X, Y, luz(R, 0.7 - 1.3 * u + Math.cos((u * 2 + (Y - P.yT) * 0.12) * DOIS_PI) * 0.22 - (X === (v === "costas" ? a : b) ? 0.35 : 0), X, Y)); }
      }
      const s = v === "costas" ? -1 : 1;
      for (let Y = P.yC + 2; Y <= y1; Y++) {
        const t = (Y - P.yC) / (y1 - P.yC), bal = fase >= 0 && t > 0.5 ? [-1, 0, 1, 0][fase] : 0;
        let a, b;
        if (v === "lado") { a = cx - 4 - Math.round(t * 2); b = cx + 3 + Math.round(t); }
        else if (s > 0) { a = cx + bal; b = cx + 8 + Math.round(t * 1.5) + bal + P.L; }
        else { a = cx - 9 - Math.round(t * 1.5) + bal - P.L; b = cx - 1 + bal; }
        for (let X = a; X <= b; X++) {
          const u = (X - a) / (b - a), d = Math.cos((u * 2.2 + 0.1) * DOIS_PI);
          if (Y > y1 - (d < -0.5 ? 1 : 0)) continue;
          G.fino(X, Y, luz(R, 0.65 - 1.25 * u + d * 0.35 * (0.3 + t) - t * 0.15 - (Y >= y1 - 1 ? 0.35 : 0) - (X === (s > 0 ? a : b) && v !== "lado" ? 0.45 : 0), X, Y));
        }
      }
    },
  });

  // ----- carga e utensílios -----
  ac("bolsa", {
    meio(G, c, P) {
      const v = P.vista, cx = P.cx, yT = P.yT, yC = P.yC, Rb = couro(c[0]), aba = couro(c[1] || claro(c[0], 0.2)), alca = escuro(c[0], 0.3);
      // alça cruzada do ombro ao quadril oposto e o alforje com aba e fivela
      let x;
      if (v === "frente") { linha(G, cx - 5, yT + 1, cx + 5, yC, (i) => (i % 4 === 3 ? Rb[4] : alca)); x = cx + 3; }
      else if (v === "costas") { linha(G, cx + 4, yT + 1, cx - 6, yC, (i) => (i % 4 === 3 ? Rb[4] : alca)); x = cx - 8; }
      else { linha(G, cx + 1, yT + 1, cx - 3, yC, alca); x = cx - 5; }
      if (P.montado) return;
      for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) {
        if (j === 6 && (i === 0 || i === 4)) continue;
        G.fino(x + i, yC + 1 + j, j < 3 ? luz(aba, 0.6 - i * 0.3 - j * 0.25) : luz(Rb, 0.4 - i * 0.3 - (j - 3) * 0.2));
      }
      G.fino(x + 2, yC + 4, "#e8c060");
    },
  });
  ac("odre", {
    meio(G, c, P) {
      const v = P.vista, cx = P.cx, yC = P.yC, R = couro(c[0]);
      const x = v === "lado" ? cx - 3 : v === "frente" ? cx + 6 + P.L : cx - 6 - P.L;
      linha(G, x, yC - 1, x, yC + 2, escuro(c[0], 0.35));
      elipse(G, x + 0.5, yC + 6.5, 3, 4.2, bola(R));
      G.fino(x, yC + 2, c[1] || R[4]); G.fino(x + 1, yC + 2, R[2]); G.fino(x, yC + 1, "#3a2416");
    },
  });
  ac("saco", {
    fundo(G, c, P) { if (P.vista === "lado") { elipse(G, P.cx - 8, P.yT + 9, 4, 5.4, bola(pano(c[0]))); G.fino(P.cx - 6, P.yT + 3, escuro(c[0], 0.3)); G.fino(P.cx - 5, P.yT + 2, escuro(c[0], 0.3)); G.fino(P.cx - 8, P.yT + 12, c[1] || claro(c[0])); } },
    meio(G, c, P) { if (P.vista === "lado") linha(G, P.cx - 5, P.yT + 2, P.cx + 2, P.yT + 4, escuro(c[0], 0.35)); },
    frente(G, c, P) {
      if (P.vista === "lado") return false;
      const [x, y] = P.maoEscudo, R = pano(c[0]);
      elipse(G, x + 0.5, y + 6.5, 4, 5, (nx, ny, X, Y) => bola(R, hash2(X, Y, 7) > 0.8 ? -0.2 : 0)(nx, ny, X, Y));
      G.fino(x, y + 2, R[1]); G.fino(x + 1, y + 2, R[1]); G.fino(x - 1, y + 8, c[1] ? luz(pano(c[1]), 0.4) : R[4]); G.fino(x, y + 9, c[1] ? luz(pano(c[1]), 0) : R[4]);
      return true;
    },
  });
  function jarro(G, c, x, y) {
    const R = [misturar(c[1], "#1a0e16", 0.5), misturar(c[1], "#2e1a2a", 0.2), c[1], c[0], c[2] || claro(c[0], 0.2), misturar(c[2] || c[0], "#fff2cc", 0.45)];
    elipse(G, x, y, 4.4, 5.2, (nx, ny, X, Y) => (Math.abs(ny + 0.25) < 0.1 ? luz(R, -0.55 - nx * 0.4) : bola(R)(nx, ny, X, Y)));
    for (let j = 0; j < 3; j++) for (let i = -2; i < 2; i++) G.fino(Math.floor(x) + i, Math.floor(y) - 7 + j, luz(R, 0.45 - i * 0.4 - (j === 2 ? 0.3 : 0)));
    for (let i = -3; i < 3; i++) G.fino(Math.floor(x) + i, Math.floor(y) - 8, luz(R, 0.7 - i * 0.3));
    // asa
    G.fino(Math.floor(x) + 3, Math.floor(y) - 6, R[2]); G.fino(Math.floor(x) + 4, Math.floor(y) - 5, R[2]); G.fino(Math.floor(x) + 4, Math.floor(y) - 4, R[1]);
  }
  ac("jarro", {
    pre(P) {
      // o braço do jarro dobra para segurá-lo contra o quadril
      const cx = P.cx, yC = P.yC;
      if (P.vista === "frente") P.maoEscudo = [P.ombroD[0] + 1, yC + 2];
      else if (P.vista === "costas") P.maoEscudo = [P.ombroE[0] - 1, yC + 2];
      else if (!P.golpe) { P.maoLonge = [cx + 7, yC + 1]; P.maoEscudo = P.maoLonge; }
    },
    meio(G, c, P) { if (P.vista === "lado") jarro(G, c, P.cx + 7.5, P.yC - 3); else if (P.vista === "costas") jarro(G, c, P.ombroE[0] - 2.5, P.yC - 3); },
    frente(G, c, P) { if (P.vista !== "frente") return false; jarro(G, c, P.ombroD[0] + 2.5, P.yC - 3); return true; },
  });
  function fardoRolo(G, x0, y0, w, h, R, R2) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if ((j === 0 || j === h - 1) && (i === 0 || i === w - 1)) continue;
      const corda = i === Math.floor(w * 0.28) || i === Math.floor(w * 0.72);
      G.fino(x0 + i, y0 + j, corda ? "#4a2c1a" : luz(j % 4 === 3 ? R2 : R, 0.65 - (i / w) * 1.1 - (j / h) * 0.6 + (j === 0 ? 0.25 : j === h - 1 ? -0.3 : 0), x0 + i, y0 + j));
    }
  }
  ac("fardo", {
    fundo(G, c, P) {
      const R = pano(c[0]), R2 = pano(c[1] || escuro(c[0], 0.2));
      if (P.vista === "lado") fardoRolo(G, P.cx - 12, P.yT, 7, 14, R, R2);
      else if (P.vista === "frente") fardoRolo(G, P.cx - 9, P.yT - 5, 18, 7, R, R2);
    },
    meio(G, c, P) {
      const cx = P.cx, yT = P.yT;
      if (P.vista === "costas") { fardoRolo(G, cx - 8, yT - 1, 16, 15, pano(c[0]), pano(c[1] || escuro(c[0], 0.2))); return; }
      if (P.vista === "frente") { for (let j = 1; j < 12; j++) { G.fino(cx - 5, yT + j, "#5a3a24"); G.fino(cx + 4, yT + j, "#4a2c1a"); } return; }
      linha(G, cx - 4, yT + 1, cx + 3, yT + 5, "#4a2c1a"); linha(G, cx + 3, yT + 5, cx - 4, yT + 11, "#4a2c1a");
    },
  });
  ac("corda", {
    meio(G, c, P) {
      // rolo de corda preso ao cinto
      const v = P.vista, x = v === "frente" ? P.cx - 5 : v === "costas" ? P.cx + 5 : P.cx - 1, y = P.yC + 4;
      elipse(G, x, y, 3.7, 4.2, (nx, ny, X, Y) => { const r = nx * nx + ny * ny; return r < 0.16 ? null : (Math.floor(Math.atan2(ny, nx) * 2.6 + 9) & 1 ? luz(pano(c[0]), 0.4 - nx * 0.6 - ny * 0.6) : luz(pano(c[1] || escuro(c[0], 0.25)), 0.1 - nx * 0.5 - ny * 0.5)); });
      G.fino(Math.floor(x), P.yC + 1, "#3a2416"); G.fino(Math.floor(x) - 1, P.yC + 1, "#3a2416");
    },
  });
  ac("rede", {
    meio(G, c, P) {
      // rede de pesca jogada sobre o ombro, com os pesos de chumbo na barra
      const v = P.vista, cx = P.cx, yT = P.yT, A = c[0], B = escuro(c[0], 0.3);
      const x0 = v === "frente" ? cx + 1 : v === "costas" ? cx - 8 : cx - 4, w = v === "lado" ? 8 : 7, h = 19;
      for (let j = 0; j < h; j++) {
        const [a, b] = j < P.yC - yT ? P.tronco(yT + j) : [x0, x0 + w];
        for (let i = 0; i < w + (j > 12 ? 1 : 0); i++) {
          const X = x0 + i + (j > 14 && v !== "lado" ? (v === "frente" ? 1 : -1) : 0), Y = yT + j;
          if (j < P.yC - yT && (X < a || X > b)) continue;
          if ((i + j) % 3 === 0 || (i - j + 60) % 3 === 0) G.fino(X, Y, (i + j) & 1 ? A : B);
          else if (j === h - 1 && i % 3 === 1) G.fino(X, Y, "#6e7a84");
        }
      }
    },
  });
  ac("shofar", {
    meio(G, c, P) {
      // chifre de carneiro preso ao cinto: boca larga embaixo, bocal em cima
      const v = P.vista, s = v === "costas" ? -1 : 1, x = v === "lado" ? P.cx - 4 : P.cx + s * 3, y = P.yC + 2, R = rampa6(c[0], "madeira");
      for (let i = 0; i < 8; i++) {
        const X = x + (v === "lado" ? i : s * i), Y = y + Math.round(i * i * 0.07), g2 = i > 4 ? 2 : 1;
        for (let j = 0; j <= g2; j++) G.fino(X, Y + j, i === 7 ? (j === 1 ? c[2] || R[1] : R[5]) : i === 0 ? c[1] || R[1] : luz(R, 0.6 - j * 0.6 - (i % 3 === 2 ? 0.2 : 0)));
      }
    },
  });
  ac("funda", {
    frente(G, c, P) {
      const [hx, hy] = P.maoArma, v = P.vista, s = v === "frente" ? -1 : 1, pedra = c[1] || "#8a8478";
      let px, py;
      if (P.golpe === 1) { px = v === "lado" ? hx - 7 : hx + s * 7; py = hy - 9; }
      else if (P.golpe === 2) { px = v === "lado" ? hx + 7 : hx - s * 2; py = v === "lado" ? hy - 5 : v === "frente" ? hy + 9 : hy - 10; }
      else { px = hx + ([1, 0, -1, 0][P.fase] || 0); py = hy + 9; }
      linha(G, hx, hy, px, py, (i) => (i & 1 ? c[0] : escuro(c[0], 0.25)));
      if (!P.golpe) linha(G, hx + 1, hy, px + 1, py, escuro(c[0], 0.35));
      elipse(G, px + 0.5, py + 0.5, 2, 1.7, bola(couro("#7a4a30")));
      if (P.golpe !== 2) { G.fino(px, py, claro(pedra, 0.3)); G.fino(px + 1, py, pedra); }
      else { // a pedra já saiu
        const fx = v === "lado" ? px + 5 : px - s * 1, fy = v === "lado" ? py - 1 : v === "frente" ? py + 4 : py - 4;
        G.fino(fx, fy, claro(pedra, 0.3)); G.fino(fx + 1, fy, pedra); G.fino(fx, fy + 1, pedra); G.fino(fx + 1, fy + 1, escuro(pedra, 0.3));
      }
      return true;
    },
  });
  // brilho: centelhas sem contorno (pintadas depois do contorno) em volta da ponta do que está na mão
  ac("brilho", {
    frente(G, c, P) {
      if (!(P.q === 1 || P.q === 3 || P.q === 5 || P.golpe)) return false;
      const base = G.base || G, t = P.topoArma || [P.maoArma[0], P.maoArma[1] - Math.min(16, c[1] || 8)];
      const lista = base.__centelhas || (base.__centelhas = []);
      const n = P.golpe ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const a = hash2(i, P.q, 71) * DOIS_PI, r = 2.5 + hash2(i, P.q, 73) * (P.golpe ? 5 : 3.5);
        lista.push([Math.round(t[0] + Math.cos(a) * r + (G.ox || 0)), Math.round(t[1] + Math.sin(a) * r * 0.8 - 1 + (G.oy || 0)), c[0], i === 0 || P.golpe === 2]);
      }
      return false;
    },
  });
  function centelhas(g) {
    const lista = g.__centelhas;
    if (!lista) return;
    for (const [X, Y, cor, grande] of lista) {
      if (X < 3 || Y < 3 || X > g.w - 4 || Y > g.h - 4) continue;
      g.fino(X, Y, "#ffffff");
      const b = comAlfa(cor, grande ? 0.95 : 0.7);
      g.fino(X - 1, Y, b); g.fino(X + 1, Y, b); g.fino(X, Y - 1, b); g.fino(X, Y + 1, b);
      if (grande) { const f = comAlfa(cor, 0.45); g.fino(X - 2, Y, f); g.fino(X + 2, Y, f); g.fino(X, Y - 2, f); g.fino(X, Y + 2, f); }
    }
    g.__centelhas = null;
  }

  // -------------------------------------------------------------------
  // Armaduras (por cima da veste): f veste o tronco (antes dos braços); ombros, as ombreiras (por cima).
  // A túnica de pano é só cor (ARMADURAS.tunica_pano.veste, aplicada por novoHumano.cores).
  // -------------------------------------------------------------------
  // ombreira em duas lâminas: a calota de cima (com o brilho) e a aba de baixo, separadas por um vinco
  function ombreira(G, x, y, R, vies, rx) {
    elipse(G, x, y, rx, 3, (nx, ny, X, Y) => {
      if (ny < -0.05) return luz(R, 0.45 - 0.8 * nx - 0.9 * (ny + 0.5) + vies + (nx < -0.1 && nx > -0.6 && ny < -0.35 ? 0.45 : 0), X, Y);
      if (ny < 0.3) return luz(R, -0.75 + vies * 0.5, X, Y); // vinco entre as lâminas
      return luz(R, 0.2 - 0.9 * nx + vies - (ny > 0.62 ? 0.55 : 0), X, Y);
    });
  }
  function ombreiras(G, P, R) {
    const y = P.yT + 3.4;
    if (P.vista === "lado") { ombreira(G, P.cx - 0.5, y, R, 0.05, 4.4); return; }
    ombreira(G, P.ombroE[0] + 0.5, y, R, 0.12, 4.6);
    ombreira(G, P.ombroD[0] - 0.5, y, R, -0.22, 4.6);
  }
  const decote = (P, X, Y) => P.vista === "frente" && Math.abs(X + 0.5 - P.cx) < 2.6 - (Y - P.yT) * 0.9;
  const ARM = {
    armadura_couro: {
      f(G, P) {
        const L = couro("#8a5a34"), v = P.vista, y0 = P.yT + (v === "lado" ? 1 : 0), y1 = P.yC + 1;
        for (let Y = y0; Y <= y1; Y++) {
          const [a, b] = P.tronco(Y), i = Y - P.yT;
          for (let X = a; X <= b; X++) {
            if (decote(P, X, Y)) continue;
            const u = (X - a) / (b - a);
            let l = 0.62 - 1.35 * u + (i <= 1 ? 0.4 : 0);
            if (i % 4 === 3) l -= 0.5; else if (i % 4 === 0 && i > 0 && (X & 1)) l += 0.35; // costura das placas
            if (v === "frente" && Math.abs(X + 0.5 - P.cx) < 1 && i > 3) l = (i & 1) ? 0.6 : -0.7; // atilho no peito
            if (v === "costas" && Math.abs(X + 0.5 - P.cx) < 1 && i > 1) l -= 0.35;
            if (Y >= P.yC) l = Y === y1 ? -0.8 : -0.35 - u * 0.4;
            G.fino(X, Y, luz(L, l, X, Y));
          }
        }
        if (v !== "lado") { const [a, b] = P.tronco(P.yT + 5); for (const [x, y] of [[a + 1, 2], [b - 1, 2], [a + 1, 6], [b - 1, 6], [a + 1, 10], [b - 1, 10]]) G.fino(x, P.yT + y, x < P.cx ? "#f2d27a" : "#b07a38"); G.fino(P.cx - 1, P.yC, "#f2d27a"); G.fino(P.cx, P.yC, "#b07a38"); G.fino(P.cx - 1, P.yC + 1, "#b07a38"); G.fino(P.cx, P.yC + 1, "#7a4a24"); }
        if (P.montado) return;
        // saiote de tiras de couro
        const [a, b] = P.tronco(P.yC);
        for (let X = a - 1; X <= b + 1; X++) { const k = (X - a + 1) % 3; if (k === 2) continue; for (let j = 0; j < 5 - (k ? 0 : 0); j++) G.fino(X, P.yC + 2 + j, luz(L, (k === 0 ? 0.35 : -0.3) - ((X - a) / (b - a)) * 0.7 - (j === 4 ? 0.4 : 0), X, 0)); }
      },
      ombros: (G, P) => ombreiras(G, P, couro("#9a6a3c")),
    },
    couraca_escamas: {
      f(G, P) {
        const E = metal("#8a5a2b", "#e2b264"), v = P.vista, y0 = P.yT + (v === "lado" ? 1 : 0), y1 = P.yC - 1;
        for (let Y = y0; Y <= y1; Y++) {
          const [a, b] = P.tronco(Y), i = Y - P.yT, fila = Math.floor(i / 3), sy = i % 3;
          for (let X = a; X <= b; X++) {
            if (decote(P, X, Y)) continue;
            const u = (X - a) / (b - a), sx = (((X - P.cx + (fila & 1) * 2) % 4) + 4) % 4;
            // escama: topo claro, corpo, e a borda de baixo em arco escuro
            let l = sy === 0 ? (sx === 3 ? -0.5 : 0.75) : sy === 1 ? (sx === 3 ? -0.2 : 0.2) : sx === 1 ? 0.0 : -0.75;
            l += 0.25 - 0.9 * u + (i <= 1 ? 0.3 : 0);
            G.fino(X, Y, luz(E, l, X, Y));
          }
        }
        if (P.montado) return;
        // tiras (pteruges) de couro com ponteira de bronze abaixo do cinto
        const [a, b] = P.tronco(P.yC), C = couro("#7a4a24");
        for (let X = a - 1; X <= b + 1; X++) { const k = (((X - a + 1) % 3) + 3) % 3; if (k === 2) continue; for (let j = 0; j < 6; j++) G.fino(X, P.yC + 2 + j, j >= 4 ? luz(E, (k === 0 ? 0.6 : -0.1) - (j === 5 ? 0.5 : 0)) : luz(C, (k === 0 ? 0.4 : -0.25) - ((X - a) / (b - a)) * 0.6)); }
      },
      ombros: (G, P) => ombreiras(G, P, metal("#8a5a2b", "#e2b264")),
    },
  };

  // -------------------------------------------------------------------
  // Traços próprios de alguns personagens (no desenho legado eram cfg.extra / cfg.extraCorpo, com as
  // coordenadas do boneco antigo): refeitos aqui sobre as âncoras novas, pela chave do humano.
  // -------------------------------------------------------------------
  let chavePorCfg = null;
  function chaveDe(cfg) {
    if (!chavePorCfg || !chavePorCfg.has(cfg)) { chavePorCfg = new Map(); for (const k of Object.keys(M.HUMANOS)) chavePorCfg.set(M.HUMANOS[k], k); }
    return chavePorCfg.get(cfg) || "";
  }
  const PROPRIOS = {
    // faixa de linho claro descendo pela veste
    pj_eliabe: { corpo(G, P) { if (P.vista === "costas" || P.montado) return; const x = P.vista === "frente" ? P.cx - 5 : P.cx + 1; for (let Y = P.yT + 2; Y <= 56; Y++) { if (Y === P.yC || Y === P.yC + 1) continue; G.fino(x, Y, "#f4ead2"); G.fino(x + 1, Y, Y % 5 === 0 ? "#b8a888" : "#d8ccae"); } } },
    // peito nu (o colar e o saiote de linho ficam)
    in_guarda_egipcio: { corpo(G, P, C) { peitoNu(G, P, C); } },
    // tapa-olho
    in_pirata: { fim(G, P) { const T = P.T, cx = P.cx; if (P.vista === "frente") { for (let X = cx - 5; X <= cx + 4; X++) G.fino(X, T + 4 + (X > cx ? 0 : X > cx - 3 ? 1 : 0), "#1e1a1a"); G.fino(cx - 3, T + 6, "#1e1a1a"); G.fino(cx - 2, T + 6, "#1e1a1a"); G.fino(cx - 3, T + 5, "#1e1a1a"); G.fino(cx - 2, T + 5, "#2e2826"); } else if (P.vista === "lado") { G.fino(cx + 2, T + 6, "#1e1a1a"); G.fino(cx + 3, T + 6, "#1e1a1a"); G.fino(cx + 3, T + 5, "#2e2826"); for (let X = cx - 4; X <= cx + 2; X++) G.fino(X, T + 5 - (X < cx - 1 ? 1 : 0), "#1e1a1a"); } else for (let X = cx - 5; X <= cx + 4; X++) G.fino(X, T + 4, "#1e1a1a"); } },
  };
  function peitoNu(G, P, C) {
    const Pl = C.Pele, R = [Pl[0], Pl[1], Pl[2], Pl[3], Pl[4], Pl[4]], v = P.vista;
    for (let Y = P.yT; Y < P.yC; Y++) {
      const [a, b] = P.tronco(Y), i = Y - P.yT;
      for (let X = a; X <= b; X++) {
        const u = (X - a) / (b - a), q = X + 0.5 - P.cx;
        let l = 0.55 - 1.3 * u + (i <= 1 ? 0.35 : 0);
        if (v === "frente") { if (i === 6 && Math.abs(q) > 1 && Math.abs(q) < 5.5) l -= 0.45; if (Math.abs(q) < 1 && i > 2) l -= 0.3; if (i > 8 && Math.abs(q) < 3 && (i & 1)) l -= 0.15; }
        else if (v === "costas") { if (Math.abs(q) < 1 && i > 1) l -= 0.4; if (i === 5 && Math.abs(q) > 2) l -= 0.2; }
        else if (i === 6 && u > 0.5) l -= 0.4;
        G.fino(X, Y, luz(R, l, X, Y));
      }
    }
  }

  // -------------------------------------------------------------------
  // Montagem: o esqueleto de arte/humano.js com o equipamento nas camadas.
  // desenhar(g, cfg, quadro, o): o = { ox, oy, montado, limites: [x0, y0, x1, y1] } (o M1 usa no montado).
  // Acessório sem desenho novo cai na reserva (um volume simples na mão), nunca some nem flutua.
  // -------------------------------------------------------------------
  const RESERVA = { frente(G, c, P) { const [hx, hy] = P.maoArma; pau(G, hx, hy + 3, hx, hy - 9, madeira((c && typeof c[0] === "string" && c[0]) || "#7a5530"), 2); return true; } };
  function desenhar(g, cfg, quadro, o) {
    o = o || {};
    const lim = o.limites || [1, 1, N.w * 2 - 2, N.PES];
    const acs = (cfg.acessorios || []).map(([nome, cores]) => [AC[nome] || (M.ACESSORIOS[nome] ? RESERVA : null), cores || []]).filter((a) => a[0]);
    const arm = cfg.armadura && ARM[cfg.armadura], proprio = PROPRIOS[chaveDe(cfg)];
    let Gc = null;
    const corte = (G) => Gc || (Gc = { fino(X, Y, c) { if (X >= lim[0] && X <= lim[2] && Y >= lim[1] && Y <= lim[3]) G.fino(X, Y, c); }, gf: (X, Y) => (G.gf ? G.gf(X, Y) : null), base: G.base || G, ox: o.ox || 0, oy: o.oy || 0 });
    return N.desenhar(g, cfg, quadro, Object.assign({}, o, {
      camada(nome, G, P, C) {
        const K = corte(G);
        P.montado = !!(o.montado || cfg.montado);
        if (nome === "fundo") {
          (G.base || G).__centelhas = null;
          for (const [a] of acs) if (a.pre) a.pre(P, cfg);
          for (const [a, c] of acs) if (a.fundo) a.fundo(K, c, P, cfg, C);
          return false;
        }
        if (nome === "armadura") { if (arm && arm.f) arm.f(K, P, C); if (proprio && proprio.corpo) proprio.corpo(K, P, C); return false; }
        if (nome === "meio") { for (const [a, c] of acs) if (a.meio) a.meio(K, c, P, cfg, C); return false; }
        if (nome === "ombros") { if (arm && arm.ombros) arm.ombros(K, P, C); return false; }
        if (nome === "frente") { let maos = false; for (const [a, c] of acs) if (a.frente && a.frente(K, c, P, cfg, C)) maos = true; return maos; }
        if (nome === "fim" && proprio && proprio.fim) proprio.fim(K, P, C);
        return false;
      },
    }));
  }

  const spec = Object.assign({}, N, {
    limiteCores: 96,
    desenhar: (g, cfg, quadro) => desenhar(g, cfg, quadro),
    depois: (g) => centelhas(g),
  });
  delete spec.partes; delete spec.pose; delete spec.cores; delete spec.inferiorMontado; delete spec.VISTAS; delete spec.CX; delete spec.PES;
  // para o M1 (montado) e para os testes: o boneco equipado e as tabelas novas
  M.humanoEquipado = { spec, desenhar, centelhas, ACESSORIOS: AC, ARMADURAS: ARM, PROPRIOS, RESERVA, empunharHaste, dirLamina };

  // Ativação: os NPCs, os inimigos humanos e o jogador paramétrico (chave composta inalterada) passam
  // ao boneco novo. O montado continua no esqueleto antigo até o M1 (definirMontado).
  M.definirHumano(spec);
})(typeof window !== "undefined" ? window : globalThis);
