// =====================================================================
// arte/flora.js — flora, rochas, estruturas e decoração, altas e com sombra projetada (pacote A5).
//
// Re-registra, com as MESMAS chaves e o mesmo número de variantes (quadros) do desenho legado de
// sprites.js: as 26 chaves ob_<area>_<tipo>, es_casa, es_tenda, es_banca, es_poco e os 4 dc_*.
//
// Convenções deste arquivo:
//   * Tudo em px de arte (g.fino, retF, elipF, linF, bastao): nenhum bloco de unidade.
//   * Luz de cima e da esquerda; sombra projetada para a direita e para baixo, na camada de sombra da
//     Grade (g.sombraPx), em 3 degraus de alfa, com a cor de sombra do bioma.
//   * Células: árvore alta 64 × 96; coluna e estandarte 48 × 88; ilhota e acácia seca 64 × 80; tenda do
//     deserto 64 × 72; rochedo 64 × 56; rocha 48 × 40; arbusto, jarros e coral 40 × 40; muro 40 × 44.
//     As estruturas es_* guardam a célula e a pegada de antes.
//   * A âncora continua na base (origem 0,5 e 1): o pé do desenho fica no meio da célula e a faixa de
//     baixo guarda a sombra. O jogo desce os ob_ em 4 px (def.obstaculo), como no legado.
//   * Cada def declara alto (passa de 1 casa), alturaVisual (px desenhados acima do pé) e
//     semEspelho: true (o espelho por casa inverteria a luz e a sombra; quem lê é o G2).
//   * Nada de document, canvas ou window na carga; nenhuma coordenada de mapa. Arte 100% original.
// =====================================================================
(function (global) {
  "use strict";
  const Arte = global.Arte;
  if (!Arte || !Arte.motor) return;
  const M = Arte.motor;
  const { registrar, rampa6, sombrear, misturar, hash2, ruido, BIOMAS } = M;
  const PP = M.PIXEL_PATTERNS;
  const { retF, elipF, linF, bastao, pintarMascara, LM } = M.prim;
  const TAU = Math.PI * 2;
  const lim = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ------------------------------------------------------------------ sombra projetada
  // Elipse de sombra em px, com 3 degraus de alfa (miolo, meia-sombra e penumbra).
  function sombraElip(g, cx, cy, rx, ry, cor, a = 0.34) {
    for (let Y = Math.floor(cy - ry); Y <= Math.ceil(cy + ry); Y++)
      for (let X = Math.floor(cx - rx); X <= Math.ceil(cx + rx); X++) {
        const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry, n = nx * nx + ny * ny;
        if (n > 1) continue;
        g.sombraPx(X, Y, n < 0.5 ? a : n < 0.8 ? a * 0.66 : a * 0.33, cor);
      }
  }
  // Faixa de sombra (tronco, mastro, poste) do pé (x0, y0) até (x1, y1), com a largura dada.
  function sombraFaixa(g, x0, y0, x1, y1, larg, cor, a = 0.34) {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (let j = -1; j <= larg; j++) for (let k = 0; k < larg; k++)
        g.sombraPx(Math.round(x) + k, Math.round(y) + j, j < 0 || j === larg ? a * 0.33 : a, cor);
    }
  }
  // Sombra de uma copa: uma elipse por massa de folhagem, deitada no chão para a direita e para baixo
  // do pé (cx, b); o comprimento cresce com a altura da massa. Mais a faixa do tronco.
  function sombraCopa(g, cx, b, massas, cor, o = {}) {
    const kx = o.kx || 0.2, lim1 = g.w - 1;
    let alvoX = cx, alvoY = b, peso = 0;
    for (const m of massas) {
      const h = b - m.y, x = cx + (m.x - cx) * 0.72 + h * kx, y = b + 2 + h * 0.035;
      const rx = Math.min(m.rx * 0.78, lim1 - x + 3), ry = lim(m.ry * 0.3, 3, 6);
      sombraElip(g, x, y, Math.max(4, rx), ry, cor, o.a);
      alvoX += x * m.rx; alvoY += y * m.rx; peso += m.rx;
    }
    if (peso && o.tronco !== false) sombraFaixa(g, cx + 1, b - 1, (alvoX - cx) / peso, (alvoY - b) / peso, o.larg || 3, cor, o.a);
  }

  // ------------------------------------------------------------------ madeira
  // Tronco por segmentos [x, y, largura] de baixo para cima: volume (luz à esquerda), veios da casca
  // em traços verticais que acompanham a curva e, acima de sombraAte, a penumbra da copa.
  function tronco(g, segs, R, sem, o = {}) {
    for (let k = 0; k < segs.length - 1; k++) {
      const [xa, ya, wa] = segs[k], [xb, yb, wb] = segs[k + 1];
      for (let Y = ya; Y >= yb; Y--) {
        const t = (ya - Y) / Math.max(1, ya - yb), c = xa + (xb - xa) * t, w = wa + (wb - wa) * t;
        const X0 = Math.round(c - w / 2), X1 = Math.max(X0, Math.round(c + w / 2) - 1);
        for (let X = X0; X <= X1; X++) {
          const u = (X - X0 + 0.5) / (X1 - X0 + 1);
          let l = 0.72 - 1.5 * u;
          const veio = hash2(X - Math.round(c), (Y + X * 3) >> 3, sem);
          if (veio < 0.3) l -= 0.3; else if (veio > 0.84) l += 0.2;
          if (o.sombraAte && Y < o.sombraAte) l -= 0.4;
          if (o.aneis && (ya - Y) % o.aneis === 0) l -= 0.35;
          g.fino(X, Y, sombrear(R, l, X, Y));
        }
      }
    }
  }
  // Galho ou raiz: bastão com realce em cima/à esquerda e sombra embaixo/à direita.
  function galho(g, pts, w, R, escuro = 0) {
    const m = new Set();
    for (let i = 0; i < pts.length - 1; i++) bastao(m, Math.round(pts[i][0]), Math.round(pts[i][1]), Math.round(pts[i + 1][0]), Math.round(pts[i + 1][1]), w);
    const e = escuro;
    pintarMascara(g, m, [R[4 - e], R[3 - e], R[2 - e], R[Math.max(0, 1 - e)]]);
  }
  // Raízes abrindo no pé do tronco.
  function raizes(g, cx, b, w, R, sem) {
    const h = w / 2;
    galho(g, [[cx - h + 1, b - 5], [cx - h - 2, b - 1], [cx - h - 5 - (hash2(sem, 1, 7) > 0.5 ? 1 : 0), b]], 2, R);
    galho(g, [[cx + h - 2, b - 5], [cx + h + 1, b - 1], [cx + h + 4, b]], 2, R, 1);
    galho(g, [[cx - 1, b - 3], [cx - 2, b + 1]], 2, R);
  }

  // ------------------------------------------------------------------ folhagem
  // Copa em massas (elipses) cobertas de tufos de folhas: cada tufo é uma pequena forma com a luz em
  // cima/à esquerda e a sombra embaixo/à direita; os de baixo cobrem os de cima (telhas), e os da orla
  // passam da massa, recortando a silhueta em grupos de folhas. A luz de cada tufo soma a da massa
  // (posição dentro dela) e a da copa inteira.
  // massas: [{ x, y, rx, ry, l? }]; o: { r: [min, max], achatado, brilho: cor, densidade, fundo }
  function folhagem(g, massas, R, sem, o = {}) {
    const r0 = (o.r || [3, 5])[0], r1 = (o.r || [3, 5])[1], dens = o.densidade || 1;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const m of massas) { x0 = Math.min(x0, m.x - m.rx); x1 = Math.max(x1, m.x + m.rx); y0 = Math.min(y0, m.y - m.ry); y1 = Math.max(y1, m.y + m.ry); }
    const gx = (x) => ((x - x0) / Math.max(1, x1 - x0)) * 2 - 1, gy = (y) => ((y - y0) / Math.max(1, y1 - y0)) * 2 - 1;
    // fundo escuro de cada massa: o que aparece entre os tufos
    massas.forEach((m) => elipF(g, m.x, m.y, Math.max(2, m.rx - 2), Math.max(2, m.ry - 2), (nx, ny, X, Y) => sombrear(R, -0.75 - 0.2 * (nx + ny), X, Y)));
    const tufos = [];
    massas.forEach((m, k) => {
      const rm = (r0 + r1) / 2, n = Math.max(5, Math.round(((m.rx * m.ry) / (rm * rm)) * 1.25 * dens));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, rad = Math.sqrt(t) * 0.97, ang = i * 2.39996 + hash2(k, sem, 3) * TAU;
        const jx = (hash2(i, k, sem + 11) - 0.5) * 1.6, jy = (hash2(i, k, sem + 12) - 0.5) * 1.6;
        const mx = Math.cos(ang) * rad, my = Math.sin(ang) * rad;
        const x = m.x + mx * m.rx + jx, y = m.y + my * m.ry + jy;
        const r = r0 + hash2(i, k, sem + 13) * (r1 - r0);
        const l = -(0.5 * mx + 0.72 * my) * 0.5 + (m.l || 0) - (0.45 * gx(x) + 0.6 * gy(y)) * 0.32;
        tufos.push({ x, y, r, l, s: i * 7 + k * 131 });
      }
    });
    tufos.sort((a, b) => a.y - b.y || a.x - b.x);
    const ach = o.achatado || 0.8;
    for (const t of tufos) {
      const rx = t.r * (0.9 + hash2(t.s, sem, 21) * 0.3), ry = t.r * ach;
      elipF(g, t.x, t.y, rx, ry, (nx, ny, X, Y) => {
        const d = 0.6 * nx + 0.8 * ny;
        let l = t.l - d * 0.62;
        if (d > 0.5) l -= 0.22; // a barriga do tufo, já na sombra do próprio tufo
        return sombrear(R, lim(l, -1, 0.95), X, Y, false);
      });
      // folhas soltas no alto do tufo: 1 ou 2 px de brilho
      if (o.brilho && t.l > 0.05 && hash2(t.s, sem, 22) < 0.55) {
        const X = Math.round(t.x - rx * 0.35), Y = Math.round(t.y - ry * 0.55);
        g.fino(X, Y, o.brilho); if (hash2(t.s, sem, 23) < 0.5) g.fino(X + 1, Y, o.brilho);
      }
    }
    return { x0, x1, y0, y1 };
  }
  // Frutos ou flores: pontos de 2 × 2 px (realce em cima/à esquerda) só sobre folhagem já pintada.
  function frutos(g, caixa, n, cores, sem) {
    for (let i = 0; i < n; i++) {
      const X = Math.round(caixa.x0 + 3 + hash2(i, sem, 31) * (caixa.x1 - caixa.x0 - 6)), Y = Math.round(caixa.y0 + 5 + hash2(i, sem, 32) * (caixa.y1 - caixa.y0 - 8));
      if (!g.gf(X, Y) || !g.gf(X + 1, Y + 1) || !g.gf(X - 1, Y - 1)) continue;
      g.fino(X, Y, cores[1]); g.fino(X + 1, Y, cores[0]); g.fino(X, Y + 1, cores[0]); g.fino(X + 1, Y + 1, cores[2] || cores[0]);
    }
  }

  // ------------------------------------------------------------------ chão ao pé
  // Tufos de capim (ou capim seco) ao pé, pintados depois do contorno para fundirem com o chão.
  function capim(g, cx, b, larg, cores, sem, n = 7) {
    for (let i = 0; i < n; i++) {
      const X = Math.round(cx - larg / 2 + hash2(i, sem, 41) * larg), h = 2 + Math.floor(hash2(i, sem, 42) * 4), inc = hash2(i, sem, 43) < 0.5 ? -1 : 1;
      const Y = b + Math.round(hash2(i, sem, 44) * 3) - 1;
      for (let k = 0; k < h; k++) g.fino(X + (k >= h - 1 && h > 2 ? inc : 0), Y - k, k >= h - 1 ? cores[2] : k ? cores[1] : cores[0]);
    }
  }
  // Seixos e grãos ao pé (deserto, Sinai, praia).
  function seixos(g, cx, b, larg, R, sem, n = 5) {
    for (let i = 0; i < n; i++) {
      const X = Math.round(cx - larg / 2 + hash2(i, sem, 45) * larg), Y = b + Math.round(hash2(i, sem, 46) * 3) - 1;
      g.fino(X, Y, R[4]); g.fino(X + 1, Y, R[3]); g.fino(X, Y + 1, R[2]); g.fino(X + 1, Y + 1, R[1]);
      if (hash2(i, sem, 47) < 0.5) g.fino(X - 1, Y + 1, R[2]);
    }
  }
  const coresCapim = (bio) => [misturar(bio.chao.escuro, "#16303a", 0.3), bio.chao.escuro, misturar(bio.chao.claro, "#f0f0a8", 0.25)];

  // ------------------------------------------------------------------ registro
  // Parte da def legada (quadros, origem, obstaculo, alto do bioma) e troca célula e desenho.
  //   w, h em px de arte; pe = px livres abaixo do pé (sombra); altura = px desenhados acima do pé.
  function ob(chave, w, h, pe, altura, desenhar, depois) {
    const antes = PP[chave] || { quadros: 1, obstaculo: true, origem: [0.5, 1] };
    const area = chave.split("_")[1], bio = BIOMAS[area] || BIOMAS.canaan;
    const amb = { cx: w >> 1, b: h - pe, w, h, bio, sombra: bio.sombra || "#1c1210", area };
    return registrar(chave, Object.assign({}, antes, {
      w: w / 2, h: h / 2, acabamento: false, contorno: "amigo", semEspelho: true,
      alto: altura > 36, alturaVisual: altura, pe,
      desenhar(g, v) { desenhar(g, v, amb); },
      depois: depois ? (g, v) => depois(g, v, amb) : undefined,
    }));
  }

  // ================================================================== ÁRVORES
  // ---------------------------------------------------------------- oliveira (Canaã): tronco grosso e
  // retorcido, copa larga cinza-esverdeada com o avesso prateado das folhas e azeitonas escuras.
  const OLIVEIRAS = [
    {
      tronco: [[32, 86, 12], [31, 78, 9], [33, 70, 8], [32, 61, 8]],
      galhos: [[[31, 64], [25, 56], [19, 47]], [[33, 64], [40, 55], [45, 46]], [[32, 62], [32, 50], [31, 40]]],
      massas: [{ x: 19, y: 42, rx: 13, ry: 10 }, { x: 45, y: 40, rx: 13, ry: 11 }, { x: 31, y: 26, rx: 17, ry: 12, l: 0.08 }, { x: 32, y: 48, rx: 14, ry: 7, l: -0.12 }],
    },
    {
      tronco: [[32, 86, 13], [30, 77, 10], [28, 69, 8], [29, 60, 7]],
      galhos: [[[28, 63], [21, 54], [16, 44]], [[30, 62], [38, 52], [46, 43]], [[29, 60], [28, 46]], [[31, 74], [39, 68], [44, 62]]],
      massas: [{ x: 16, y: 38, rx: 12, ry: 11 }, { x: 30, y: 24, rx: 15, ry: 11, l: 0.08 }, { x: 46, y: 36, rx: 13, ry: 12 }, { x: 28, y: 46, rx: 13, ry: 7, l: -0.12 }, { x: 47, y: 56, rx: 8, ry: 6, l: -0.1 }],
    },
    {
      tronco: [[32, 86, 11], [33, 78, 9], [35, 68, 8], [34, 60, 8]],
      galhos: [[[33, 63], [25, 53], [17, 48]], [[35, 62], [43, 52], [47, 41]], [[34, 60], [35, 46], [37, 34]]],
      massas: [{ x: 16, y: 44, rx: 11, ry: 9 }, { x: 24, y: 30, rx: 13, ry: 10, l: 0.06 }, { x: 40, y: 22, rx: 14, ry: 10, l: 0.1 }, { x: 47, y: 40, rx: 12, ry: 11 }, { x: 34, y: 47, rx: 12, ry: 7, l: -0.12 }],
    },
  ];
  const R_OLIVA = rampa6("#6f8748", "folha"), R_TR_OLIVA = rampa6("#7d654b", "madeira");
  ob("ob_canaan_oliveira", 64, 96, 10, 76, (g, v, a) => {
    const t = OLIVEIRAS[v], s = 300 + v * 17;
    sombraCopa(g, a.cx, a.b, t.massas, a.sombra);
    tronco(g, t.tronco, R_TR_OLIVA, s, { sombraAte: 68 });
    // nó e oco no tronco velho
    elipF(g, t.tronco[1][0] - 1, t.tronco[1][1] - 3, 2, 3, (nx, ny) => (nx + ny > 0.2 ? R_TR_OLIVA[2] : R_TR_OLIVA[0]));
    for (const p of t.galhos) galho(g, p, 3, R_TR_OLIVA, 1);
    const cx = folhagem(g, t.massas, R_OLIVA, s, { r: [2.6, 4.2], brilho: "#cdd6a6", densidade: 1.15 });
    frutos(g, cx, 9, ["#3d3644", "#6a6078", "#2a2430"], s);
    raizes(g, a.cx, a.b, t.tronco[0][2], R_TR_OLIVA, s);
  }, (g, v, a) => capim(g, a.cx, a.b + 1, 22, coresCapim(a.bio), 310 + v, 8));

  // ---------------------------------------------------------------- figueira (Galileia): copa cheia e
  // redonda de folhas grandes, quase até o chão, com figos roxos.
  const FIGUEIRAS = [
    {
      tronco: [[32, 86, 10], [32, 78, 8], [31, 68, 7], [32, 60, 7]],
      galhos: [[[31, 66], [24, 58], [18, 52]], [[33, 66], [41, 58], [46, 52]]],
      massas: [{ x: 32, y: 29, rx: 21, ry: 15, l: 0.05 }, { x: 16, y: 45, rx: 12, ry: 10 }, { x: 48, y: 45, rx: 12, ry: 10 }, { x: 32, y: 52, rx: 15, ry: 8, l: -0.14 }],
    },
    {
      tronco: [[32, 86, 10], [33, 78, 8], [34, 68, 7], [33, 60, 7]],
      galhos: [[[33, 66], [25, 60], [17, 56]], [[35, 66], [42, 57], [48, 48]]],
      massas: [{ x: 26, y: 26, rx: 18, ry: 13, l: 0.06 }, { x: 44, y: 34, rx: 15, ry: 13 }, { x: 15, y: 46, rx: 11, ry: 10 }, { x: 34, y: 51, rx: 17, ry: 8, l: -0.14 }, { x: 50, y: 52, rx: 8, ry: 6, l: -0.1 }],
    },
  ];
  const R_FIGO = rampa6("#4d7c35", "folha"), R_TR_FIGO = rampa6("#7a6452", "madeira");
  ob("ob_galileia_figueira", 64, 96, 10, 74, (g, v, a) => {
    const t = FIGUEIRAS[v], s = 340 + v * 19;
    sombraCopa(g, a.cx, a.b, t.massas, a.sombra);
    tronco(g, t.tronco, R_TR_FIGO, s, { sombraAte: 72 });
    for (const p of t.galhos) galho(g, p, 3, R_TR_FIGO, 1);
    const cx = folhagem(g, t.massas, R_FIGO, s, { r: [3.8, 6], brilho: "#b4d672", achatado: 0.74 });
    frutos(g, cx, 10, ["#6a3a6a", "#a065a0", "#472446"], s);
    raizes(g, a.cx, a.b, t.tronco[0][2], R_TR_FIGO, s);
  }, (g, v, a) => capim(g, a.cx, a.b + 1, 22, coresCapim(a.bio), 350 + v, 8));

  // ---------------------------------------------------------------- palmeiras
  // Fronde em arco, cheia: um folíolo por px de nervura (lâmina contínua, sem malha de pontos), o lado
  // de cima na luz e o pendente na sombra; a cada 3 folíolos um mais curto e escuro abre a fenda que
  // serrilha a orla. A nervura clara vai por cima.
  function fronde(g, x0, y0, ang, len, queda, R, tomBase) {
    const dx = Math.cos(ang), dy = Math.sin(ang), n = Math.max(2, Math.round(len * 1.4)), pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x0 + dx * len * t, y0 + dy * len * t + queda * t * t]); }
    // sombra própria: a fronde escurece o que está 1–2 px abaixo dela e se destaca das de trás
    for (let i = 2; i <= n; i++) { const [X, Y] = pts[i], e = 1 + 3.7 * Math.sin(Math.PI * Math.min(1, (i / n) * 0.95 + 0.12)); linF(g, X, Y + 1, X + 0.6, Y + e + 1.6, R[0]); }
    for (let i = 1; i <= n; i++) {
      const t = i / n, [X, Y] = pts[i], [Xa, Ya] = pts[i - 1];
      let tx = X - Xa, ty = Y - Ya; const tn = Math.hypot(tx, ty) || 1; tx /= tn; ty /= tn;
      const lf = 1 + 3.7 * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.12));
      const fenda = i % 4 === 0;
      for (const lado of [-1, 1]) {
        // perpendicular à nervura, puxada pela gravidade e um pouco para a ponta
        let px = -ty * lado + tx * 0.45, py = tx * lado + ty * 0.45 + 0.5; const pn = Math.hypot(px, py) || 1; px /= pn; py /= pn;
        const cima = py < 0.2;
        const comp = lf * (cima ? 0.62 : 1) - (fenda ? 1.6 : 0);
        if (comp < 0.8) continue;
        const luz = tomBase + (cima ? 0.3 : -0.28) + (px < 0 ? 0.08 : -0.08) - (fenda ? 0.4 : 0);
        linF(g, X, Y, X + px * comp, Y + py * comp, (a, b, k) => sombrear(R, luz - k * (cima ? 0.03 : 0.1), a, b, false));
      }
    }
    for (let i = 0; i < n; i++) linF(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], sombrear(R, tomBase + 0.62 - (i / n) * 0.3, 0, 0, false));
  }
  // Palmeira inteira: estipe com as cicatrizes das folhas em anéis e a coroa de frondes.
  //   (x, yb) pé; alt = altura da estipe; incl = desvio do topo; L = comprimento das frondes.
  function palmeira(g, x, yb, alt, incl, L, R_TR, R_FR, sem, o = {}) {
    const w0 = o.w0 || 9, w1 = o.w1 || 6, yt = yb - alt;
    const cxDe = (Y) => { const t = (yb - Y) / alt; return x + incl * t * t; };
    for (let Y = yb; Y >= yt; Y--) {
      const t = (yb - Y) / alt, c = cxDe(Y), w = w0 + (w1 - w0) * Math.min(1, t * 1.6) + (t < 0.08 ? 2 : 0);
      const X0 = Math.round(c - w / 2), X1 = Math.round(c + w / 2) - 1, fila = Math.floor((yb - Y) / 4), dentroFila = (yb - Y) % 4;
      for (let X = X0; X <= X1; X++) {
        const u = (X - X0 + 0.5) / (X1 - X0 + 1);
        let l = 0.7 - 1.5 * u;
        if (dentroFila === 3) l -= 0.42; // sombra sob cada anel de cicatrizes
        else if (dentroFila === 0) l += 0.16;
        if ((X - X0 + fila * 2) % 4 === 0 && dentroFila !== 0) l -= 0.22; // dentes das bases cortadas
        if (Y < yt + 10) l -= 0.35; // penumbra da coroa
        g.fino(X, Y, sombrear(R_TR, l, X, Y));
      }
    }
    const tx = cxDe(yt), ty = yt;
    const F = o.frondes || [
      [-96, 0.86, 3, -0.4], [-58, 0.92, 5, -0.35], [-128, 0.92, 5, -0.35],
      [-22, 1, 10, -0.1], [-158, 1, 10, -0.05], [14, 0.95, 13, 0], [166, 0.95, 13, 0.05],
      [48, 0.72, 11, 0.15], [132, 0.72, 11, 0.2], [92, 0.5, 6, 0.3],
    ];
    const cachos = () => {
      if (!o.tamaras) return;
      for (const [dx, dy] of [[-6, 4], [5, 5], [-1, 8]]) {
        linF(g, tx, ty + 1, tx + dx, ty + dy, R_TR[2]);
        elipF(g, tx + dx, ty + dy + 2.5, 2.6, 3.2, (nx, ny, X, Y) => ((X + Y) % 3 === 0 ? o.tamaras[2] : nx + ny < -0.3 ? o.tamaras[1] : o.tamaras[0]));
      }
    };
    F.forEach(([grau, k, queda, tomBase], i) => {
      if (i === 7) { elipF(g, tx, ty + 1, w1 / 2 + 1.5, 3, (nx, ny, X, Y) => sombrear(R_TR, -0.2 - nx * 0.5 - ny * 0.4, X, Y)); }
      const jit = (hash2(i, sem, 51) - 0.5) * 12;
      fronde(g, tx, ty, ((grau + jit) * Math.PI) / 180, L * k * (0.92 + hash2(i, sem, 52) * 0.16), queda * (L / 26), R_FR, tomBase);
    });
    cachos();
    // miolo da coroa: bainhas claras de onde saem as frondes
    elipF(g, tx, ty - 0.5, 2.5, 2, (nx, ny) => (nx + ny < 0 ? R_FR[5] : R_FR[3]));
    return { tx, ty };
  }

  // ---------------------------------------------------------------- tamareira (Egito)
  const R_TAMAR = rampa6("#5c8838", "folha"), R_TR_TAMAR = rampa6("#94714a", "madeira"), TAMARAS = ["#b5663a", "#e6a352", "#7a3c20"];
  ob("ob_egito_tamareira", 64, 96, 10, 82, (g, v, a) => {
    const incl = v ? 3 : -3, s = 380 + v * 23, alt = v ? 61 : 65;
    const topoX = a.cx + incl;
    sombraCopa(g, a.cx, a.b, [{ x: topoX, y: a.b - alt, rx: 22, ry: 20 }], a.sombra, { kx: 0.14, larg: 3 });
    palmeira(g, a.cx, a.b, alt, incl, 25, R_TR_TAMAR, R_TAMAR, s, { tamaras: TAMARAS });
    // rebentos no pé
    for (const [dx, gr] of [[-7, -120], [7, -55], [-3, -95]]) fronde(g, a.cx + dx * 0.6, a.b - 1, (gr * Math.PI) / 180, 8, 3, R_TAMAR, -0.1);
  }, (g, v, a) => capim(g, a.cx, a.b + 1, 20, coresCapim(a.bio), 390 + v, 6));

  // ---------------------------------------------------------------- ilhota (Mar): banco de areia com
  // espuma na orla e uma palmeira jovem inclinada.
  const R_AREIA = rampa6("#e0c48a", "pedra");
  ob("ob_mar_ilhota", 64, 80, 4, 66, (g, v, a) => {
    const s = 420 + v * 29, cy = a.b - 9, espuma = a.bio.agua.espuma, rasa = a.bio.agua.clara;
    // água rasa em volta (camada de sombra: sem contorno) e a orla de espuma
    for (let Y = cy - 13; Y <= cy + 13; Y++) for (let X = 0; X < a.w; X++) {
      const nx = (X + 0.5 - a.cx) / 31, ny = (Y + 0.5 - cy) / 12.5, n = nx * nx + ny * ny;
      if (n <= 1) g.sombraPx(X, Y, n < 0.8 ? 0.6 : 0.35, rasa);
    }
    elipF(g, a.cx, cy, 27, 9.5, (nx, ny, X, Y) => {
      const n = nx * nx + ny * ny, borda = 0.8 + (ruido(X / 4, Y / 3, s) - 0.5) * 0.25;
      if (n > borda + 0.14) return hash2(X, Y, s) < 0.75 ? espuma : null;
      if (n > borda) return misturar(R_AREIA[2], rasa, 0.35); // areia molhada
      return sombrear(R_AREIA, 0.35 - 0.5 * nx - 0.7 * ny + (ruido(X / 3, Y / 2, s + 1) - 0.5) * 0.5, X, Y);
    });
    const px = a.cx - 5 + v * 6, incl = v ? -7 : 8;
    sombraElip(g, px + incl + 12, cy + 1, 11, 3.5, a.sombra, 0.3);
    palmeira(g, px, cy, 40, incl, 19, R_TR_TAMAR, R_TAMAR, s, { w0: 6, w1: 4 });
    // pedra e conchas na areia
    elipF(g, a.cx + (v ? -14 : 15), cy + 2, 4, 2.6, (nx, ny, X, Y) => sombrear(rampa6("#7d6a5a", "pedra"), -0.5 * nx - 0.8 * ny, X, Y));
    for (let i = 0; i < 4; i++) g.fino(Math.round(a.cx - 16 + hash2(i, s, 61) * 32), Math.round(cy - 2 + hash2(i, s, 62) * 6), i % 2 ? "#f6ead2" : "#d8a890");
  });

  // ---------------------------------------------------------------- acácia (Deserto): tronco fino
  // que se abre em forquilha e sustenta uma copa chata, em guarda-sol, de folhinhas miúdas.
  const ACACIAS = [
    {
      tronco: [[32, 86, 7], [31, 76, 5], [33, 66, 5], [33, 58, 5]],
      galhos: [[[32, 60], [25, 50], [15, 42], [9, 38]], [[34, 60], [41, 49], [50, 40], [55, 37]], [[33, 58], [32, 46], [30, 36]], [[25, 50], [22, 40]], [[41, 49], [43, 38]]],
      massas: [{ x: 31, y: 29, rx: 25, ry: 6 }, { x: 13, y: 36, rx: 10, ry: 4.5, l: -0.05 }, { x: 50, y: 35, rx: 11, ry: 4.5, l: -0.08 }, { x: 31, y: 23, rx: 15, ry: 4.5, l: 0.12 }],
    },
    {
      tronco: [[32, 86, 7], [34, 76, 5], [32, 67, 5], [30, 60, 5]],
      galhos: [[[29, 62], [22, 53], [13, 47], [8, 44]], [[31, 62], [39, 52], [47, 41], [53, 36]], [[30, 60], [31, 48], [34, 36]], [[22, 53], [20, 43]]],
      massas: [{ x: 36, y: 28, rx: 21, ry: 6 }, { x: 14, y: 41, rx: 11, ry: 4.5, l: -0.05 }, { x: 49, y: 33, rx: 11, ry: 5, l: -0.05 }, { x: 37, y: 22, rx: 12, ry: 4, l: 0.12 }, { x: 24, y: 34, rx: 10, ry: 4 }],
    },
  ];
  const R_ACACIA = rampa6("#8a9048", "folha"), R_TR_ACACIA = rampa6("#77563a", "madeira");
  ob("ob_deserto_acacia", 64, 96, 10, 68, (g, v, a) => {
    const t = ACACIAS[v], s = 460 + v * 31;
    sombraCopa(g, a.cx, a.b, t.massas, a.sombra, { kx: 0.16, larg: 2 });
    tronco(g, t.tronco, R_TR_ACACIA, s);
    t.galhos.forEach((p, i) => galho(g, p, i < 3 ? 3 : 2, R_TR_ACACIA, 1));
    folhagem(g, t.massas, R_ACACIA, s, { r: [2.2, 3.4], achatado: 0.72, brilho: "#d2d48a", densidade: 1.2 });
    raizes(g, a.cx, a.b, 6, R_TR_ACACIA, s);
  }, (g, v, a) => { seixos(g, a.cx, a.b + 2, 22, rampa6("#a8845a", "pedra"), 470 + v, 4); capim(g, a.cx, a.b + 1, 16, ["#7a6a3c", "#9a8550", "#c8b070"], 471 + v, 4); });

  // ---------------------------------------------------------------- acácia do Sinai: seca e torta,
  // quase só galhos, com uns poucos tufos de folha na ponta.
  const R_ACACIA_S = rampa6("#7b7c44", "folha"), R_TR_SECO = rampa6("#6e5646", "madeira");
  ob("ob_sinai_acacia", 64, 80, 10, 62, (g, v, a) => {
    const s = 500, b = a.b;
    const massas = [{ x: 14, y: 22, rx: 9, ry: 4 }, { x: 31, y: 13, rx: 10, ry: 4, l: 0.1 }, { x: 50, y: 20, rx: 9, ry: 4 }, { x: 22, y: 30, rx: 6, ry: 3 }, { x: 44, y: 31, rx: 6, ry: 3 }];
    sombraCopa(g, a.cx, b, massas, a.sombra, { kx: 0.16, larg: 2, a: 0.28 });
    tronco(g, [[32, b, 7], [34, b - 10, 5], [31, b - 20, 5], [32, b - 28, 4]], R_TR_SECO, s);
    const G = [
      [[31, b - 26], [24, b - 36], [16, b - 44], [12, b - 48]], [[33, b - 27], [40, b - 37], [47, b - 44], [52, b - 50]],
      [[32, b - 28], [31, b - 42], [31, b - 56]], [[24, b - 36], [21, b - 40], [22, b - 41]], [[40, b - 37], [44, b - 39]],
      [[16, b - 44], [9, b - 44]], [[47, b - 44], [55, b - 45]], [[31, b - 42], [25, b - 50]], [[31, b - 46], [38, b - 54]],
    ];
    G.forEach((p, i) => galho(g, p, i < 3 ? 3 : 2, R_TR_SECO, i < 3 ? 0 : 1));
    folhagem(g, massas, R_ACACIA_S, s, { r: [2, 3], achatado: 0.7, brilho: "#c2c088", densidade: 0.9 });
    raizes(g, a.cx, b, 6, R_TR_SECO, s);
  }, (g, v, a) => seixos(g, a.cx, a.b + 2, 24, rampa6("#8a7868", "pedra"), 505, 5));

  // ================================================================== ROCHAS
  function dentroPoli(P, x, y) {
    let d = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
    }
    return d;
  }
  // Rocha facetada: contorno poligonal irregular com a base achatada, uma face de cima (clara) e uma
  // face por aresta, cada uma com a sua luz; arestas vivas com realce, fissuras entre faces, grão.
  //   o: { n, k, estratos (px), veio (cor), musgo (rampa), furos, topoCor, sx, sy }
  function pedra(g, cx, b, w, h, R, sem, o = {}) {
    const n = o.n || 8, cy = b - h / 2, P = [], Q = [], luz = [];
    for (let i = 0; i < n; i++) {
      const a = ((i + (hash2(i, sem, 1) - 0.5) * 0.55) / n) * TAU, f = 0.84 + hash2(i, sem, 2) * 0.22;
      const x = cx + Math.cos(a) * (w / 2) * f;
      let y = cy + Math.sin(a) * (h / 2) * f;
      if (Math.sin(a) > 0.35) y = b - (1 - Math.sin(a)) * h * 0.22; // base assentada no chão
      P.push([x, y]);
    }
    const tx = cx - w * (o.sx ?? 0.07), ty = cy - h * (o.sy ?? 0.2), k = o.k || 0.54;
    for (const [x, y] of P) Q.push([tx + (x - cx) * k, ty + (y - cy) * k * 0.72]);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, mx = (P[i][0] + P[j][0]) / 2 - cx, my = (P[i][1] + P[j][1]) / 2 - cy, mn = Math.hypot(mx / w, my / h) || 1;
      luz.push(-(0.75 * (mx / w / mn) + 0.5 * (my / h / mn)) * 0.85 - 0.12 + (hash2(i, sem, 4) - 0.5) * 0.2);
    }
    const quads = P.map((p, i) => [Q[i], Q[(i + 1) % n], P[(i + 1) % n], p]);
    const X0 = Math.floor(cx - w / 2 - 2), X1 = Math.ceil(cx + w / 2 + 2), Y0 = Math.floor(b - h - 2);
    for (let Y = Y0; Y <= b; Y++) for (let X = X0; X <= X1; X++) {
      const x = X + 0.5, y = Y + 0.5;
      if (!dentroPoli(P, x, y)) continue;
      const grao = (ruido(X / 3.2, Y / 3.2, sem) - 0.5) * 0.34;
      let l, topo = dentroPoli(Q, x, y);
      if (topo) l = 0.56 - ((x - tx) / w) * 0.5 - ((y - ty) / h) * 0.3;
      else {
        let f = -1;
        for (let i = 0; i < n && f < 0; i++) if (dentroPoli(quads[i], x, y)) f = i;
        if (f < 0) { let m = 1e9; for (let i = 0; i < n; i++) { const d = Math.hypot((quads[i][2][0] + quads[i][3][0]) / 2 - x, (quads[i][2][1] + quads[i][3][1]) / 2 - y); if (d < m) { m = d; f = i; } } }
        l = luz[f] - ((y - cy) / h) * 0.3;
        if (o.estratos && (Y + Math.round(Math.sin(X / 7 + sem) * 1.6)) % o.estratos === 0) l -= 0.3;
      }
      l += grao;
      if (o.furos && hash2(X >> 1, Y >> 1, sem + 5) < 0.06) l -= 0.5;
      let cor = sombrear(R, lim(l, -1, 0.95), X, Y);
      if (topo && o.topoCor && ruido(X / 5, Y / 4, sem + 6) > 0.4) cor = misturar(cor, o.topoCor, 0.5);
      if (o.musgo && (topo || y < cy) && ruido(X / 4.5, Y / 3.5, sem + 7) > (topo ? 0.52 : 0.66)) cor = sombrear(o.musgo, lim(l - 0.15, -1, 0.9), X, Y);
      g.fino(X, Y, cor);
    }
    // fissuras entre faces vizinhas e aresta viva da face de cima virada para quem olha
    for (let i = 0; i < n; i++) {
      const ant = (i + n - 1) % n;
      if (hash2(i, sem, 8) < 0.62 && Math.abs(luz[i] - luz[ant]) < 0.5)
        linF(g, Q[i][0], Q[i][1], P[i][0] + (Q[i][0] - P[i][0]) * 0.12, P[i][1] + (Q[i][1] - P[i][1]) * 0.12, (X, Y) => (g.gf(X, Y) ? sombrear(R, Math.min(luz[i], luz[ant]) - 0.5, X, Y, false) : null));
      if (luz[i] < 0.25) linF(g, Q[i][0], Q[i][1], Q[(i + 1) % n][0], Q[(i + 1) % n][1], (X, Y) => (g.gf(X, Y) ? R[5] : null));
    }
    if (o.veio) {
      const x0 = cx - w * 0.3, y0 = b - h * 0.85;
      linF(g, x0, y0, x0 + w * 0.55, b - h * 0.1, (X, Y, i) => (g.gf(X, Y) && hash2(i >> 2, sem, 9) > 0.12 ? o.veio : null));
      linF(g, x0 + w * 0.2, y0 + h * 0.28, x0 + w * 0.45, y0 + h * 0.22, (X, Y) => (g.gf(X, Y) ? misturar(o.veio, R[3], 0.4) : null));
    }
    return { P, Q, tx, ty };
  }
  // Pedra pequena e arredondada (seixo grande, pedra de marco).
  function calhau(g, x, y, rx, ry, R, sem = 0) {
    elipF(g, x, y, rx, ry, (nx, ny, X, Y) => sombrear(R, -(0.6 * nx + 0.85 * ny) * 0.9 + 0.05 + (hash2(X >> 1, Y >> 1, sem) - 0.5) * 0.2, X, Y));
  }
  function rochas(chave, w, h, pe, R, dims, sem, o = {}, depois) {
    const alt = Math.max(...dims.map((d) => d[1]));
    return ob(chave, w, h, pe, alt, (g, v, a) => {
      const [pw, ph] = dims[v], b = a.b, s = sem + v * 13;
      if (o.antes) o.antes(g, v, a, pw, ph);
      else { sombraElip(g, a.cx + pw * 0.16, b + 1, pw * 0.52, Math.min(pe - 1, 2.5 + ph * 0.08), a.sombra); sombraElip(g, a.cx + pw * 0.3, b - ph * 0.12, pw * 0.36, ph * 0.2, a.sombra, 0.28); }
      // pedras menores encostadas
      const R2 = o.R2 || R;
      calhau(g, a.cx + pw * 0.44, b - 3, 4.5 + (v % 2), 3.2, R2, s + 3);
      if (v !== 1) calhau(g, a.cx - pw * 0.46, b - 2, 3.4, 2.4, R2, s + 4);
      pedra(g, a.cx, b, pw, ph, R, s, o);
      if (o.extra) o.extra(g, v, a, pw, ph);
    }, depois);
  }

  const R_CALCARIO = rampa6("#aaa290", "pedra"), R_MUSGO = rampa6("#6e8a3a", "folha");
  rochas("ob_canaan_rocha", 48, 40, 6, R_CALCARIO, [[36, 25], [30, 21]], 600, { musgo: R_MUSGO },
    (g, v, a) => capim(g, a.cx, a.b, 36 - v * 6, coresCapim(a.bio), 601 + v, 9));

  const R_ARENITO = rampa6("#c47a45", "pedra");
  rochas("ob_deserto_rocha", 48, 40, 6, R_ARENITO, [[36, 25], [29, 19], [42, 30]], 620, { estratos: 5, topoCor: "#edc08a", n: 9 },
    (g, v, a) => seixos(g, a.cx, a.b, 40, rampa6("#b88a5a", "pedra"), 621 + v, 5));

  const R_GRANITO = rampa6("#a5503a", "pedra");
  rochas("ob_marVermelho_granito", 48, 40, 6, R_GRANITO, [[32, 29], [38, 25]], 640, { n: 6, k: 0.42, sy: 0.3, furos: true },
    (g, v, a) => seixos(g, a.cx, a.b, 38, rampa6("#c8a888", "pedra"), 641 + v, 5));

  const R_PENEDO = rampa6("#8a5a4a", "pedra");
  rochas("ob_sinai_penedo", 64, 56, 8, R_PENEDO, [[50, 40], [38, 30]], 660, { veio: "#d6a888", n: 9 },
    (g, v, a) => seixos(g, a.cx, a.b + 1, 50 - v * 10, rampa6("#8a7868", "pedra"), 661 + v, 7));

  const R_BASALTO = rampa6("#4e4c4a", "pedra"), R_LIQUEN = rampa6("#a2a86c", "folha");
  rochas("ob_galileia_basalto", 48, 40, 6, R_BASALTO, [[36, 24], [30, 22]], 680, { furos: true, musgo: R_LIQUEN, n: 7 },
    (g, v, a) => capim(g, a.cx, a.b, 36 - v * 6, coresCapim(a.bio), 681 + v, 9));

  // rochedo do mar: escuro e molhado, com alga na linha d'água e espuma batendo em volta
  const R_ROCHEDO = rampa6("#75675c", "pedra"), R_ALGA = rampa6("#4f7a4a", "folha");
  function aguaRasa(g, cx, cy, rx, ry, bio, sem) {
    for (let Y = Math.floor(cy - ry); Y <= cy + ry; Y++) for (let X = Math.floor(cx - rx); X <= cx + rx; X++) {
      const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry, n = nx * nx + ny * ny;
      if (n <= 1) g.sombraPx(X, Y, n < 0.7 ? 0.55 : 0.3, bio.agua.clara);
    }
  }
  function espuma(g, cx, cy, rx, ry, bio, sem) {
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU, k = 1 + (hash2(i, sem, 71) - 0.5) * 0.16;
      if (hash2(i >> 1, sem, 72) < 0.22) continue;
      const X = Math.round(cx + Math.cos(a) * rx * k), Y = Math.round(cy + Math.sin(a) * ry * k);
      g.sombraPx(X, Y, 0.95, bio.agua.espuma); g.sombraPx(X + 1, Y, 0.95, bio.agua.espuma);
      if (hash2(i, sem, 73) < 0.4) g.sombraPx(X, Y + 1, 0.6, bio.agua.espuma);
    }
  }
  rochas("ob_mar_rochedo", 64, 56, 8, R_ROCHEDO, [[44, 34], [35, 27]], 700, {
    n: 8, furos: true,
    antes(g, v, a, pw) { aguaRasa(g, a.cx, a.b - 3, pw * 0.72, 9, a.bio, 701); },
    extra(g, v, a, pw) {
      // alga na linha d'água e espuma
      for (let X = Math.round(a.cx - pw / 2); X < a.cx + pw / 2; X++) for (let k = 0; k < 4; k++) {
        const Y = a.b - k;
        if (g.gf(X, Y) && hash2(X, k, 702 + v) < 0.75 - k * 0.2) g.fino(X, Y, sombrear(R_ALGA, -0.3 - k * 0.1 + (hash2(X, Y, 703) - 0.5) * 0.6, X, Y));
      }
      espuma(g, a.cx, a.b - 2, pw * 0.6, 6.5, a.bio, 704 + v);
    },
  });

  // ================================================================== ARBUSTOS E MIÚDOS
  // retama (giesta do deserto): moita arredondada de varas finas cinza-esverdeadas que sobem e pendem
  // nas pontas, em duas camadas (as de trás escuras, as da frente na luz) sobre um miolo de sombra, com
  // cachos de florezinhas brancas no lado da luz.
  const R_RETAMA = rampa6("#8c8a52", "folha"), R_RETAMA_PE = rampa6("#6e5a40", "madeira");
  ob("ob_deserto_retama", 40, 40, 6, 27, (g, v, a) => {
    const s = 720 + v * 7, b = a.b, cx = a.cx + (v ? 1 : -1), RX = v ? 15 : 16, RY = v ? 25 : 28;
    sombraElip(g, a.cx + 5, b + 1, 15, 3.4, a.sombra);
    // miolo de sombra: o que se vê entre as varas
    elipF(g, cx, b - RY * 0.45, RX * 0.74, RY * 0.46, (nx, ny, X, Y) => {
      const n = nx * nx + ny * ny;
      if (n > 0.62 + (ruido(X / 2.5, Y / 2.5, s) - 0.5) * 0.7) return null;
      return sombrear(R_RETAMA, -0.62 - 0.15 * (nx + ny), X, Y, false);
    });
    const flores = [];
    const camada = (n, sem, escuro, kLen) => {
      const varas = [];
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, grau = -152 + t * 124 + (hash2(i, sem, 1) - 0.5) * 9, ang = grau * (Math.PI / 180);
        // a ponta fica sobre a cúpula (elipse RX × RY com centro no pé)
        const c = Math.cos(ang), q = Math.sin(ang), raio = 1 / Math.hypot(c / RX, q / RY);
        varas.push({ c, q, len: raio * kLen * (0.8 + hash2(i, sem, 2) * 0.22), x: cx + (t - 0.5) * 9, tom: 0.5 - t * 0.85 - escuro + (hash2(i, sem, 3) - 0.5) * 0.25, cai: 1 + Math.abs(c) * 3, i });
      }
      varas.sort((p, q2) => p.tom - q2.tom); // as claras por cima
      for (const va of varas) {
        const N = Math.round(va.len);
        let px = va.x, py = b - 1;
        for (let k = 1; k <= N; k++) {
          const t = k / N, X = lim(va.x + va.c * va.len * t, 2, a.w - 3), Y = Math.max(2, b - 1 + va.q * va.len * t + t * t * t * va.cai);
          linF(g, px, py, X, Y, sombrear(R_RETAMA, va.tom - 0.35 + t * 0.6, 0, 0, false));
          px = X; py = Y;
          if (!escuro && t > 0.5 && va.tom > -0.25 && hash2(k, va.i, sem + 4) < 0.11) flores.push([Math.round(X), Math.round(Y)]);
        }
      }
    };
    camada(15, s + 50, 0.55, 0.9);
    camada(17, s, 0, 1);
    for (const [X, Y] of flores) { g.fino(X, Y - 1, "#f6f0dc"); if (hash2(X, Y, s + 5) < 0.5) g.fino(X + 1, Y, "#ddd3b4"); }
    // pé lenhoso
    galho(g, [[cx - 2, b - 5], [cx - 1, b]], 2, R_RETAMA_PE); galho(g, [[cx + 2, b - 6], [cx + 1, b]], 2, R_RETAMA_PE, 1);
  }, (g, v, a) => seixos(g, a.cx, a.b + 1, 24, rampa6("#b88a5a", "pedra"), 725 + v, 4));

  // arbusto do Sinai: moita rasteira e espinhenta, com galhos secos saindo
  const R_MOITA = rampa6("#5f6f3c", "folha");
  ob("ob_sinai_arbusto", 40, 40, 6, 24, (g, v, a) => {
    const b = a.b, s = 740;
    const massas = [{ x: 14, y: b - 9, rx: 8, ry: 7 }, { x: 25, y: b - 11, rx: 9, ry: 8, l: 0.05 }, { x: 20, y: b - 5, rx: 12, ry: 5, l: -0.12 }];
    sombraElip(g, a.cx + 5, b + 1, 15, 3.2, a.sombra);
    for (const [x0, y0, x1, y1] of [[14, b - 12, 8, b - 21], [24, b - 14, 29, b - 24], [19, b - 12, 18, b - 22], [28, b - 10, 35, b - 17]]) galho(g, [[x0, y0], [x1, y1]], 1, R_TR_SECO);
    folhagem(g, massas, R_MOITA, s, { r: [2.2, 3.4], brilho: "#b0b878", densidade: 1.1 });
    for (let i = 0; i < 5; i++) { const X = Math.round(8 + hash2(i, s, 5) * 24), Y = Math.round(b - 16 + hash2(i, s, 6) * 10); if (g.gf(X, Y)) g.fino(X, Y, "#e8dcae"); }
  }, (g, v, a) => seixos(g, a.cx, a.b + 1, 26, rampa6("#8a7868", "pedra"), 745, 5));

  // marco do Sinai: pilha de pedras chatas, da maior à menor
  const R_MARCO = rampa6("#94826f", "pedra");
  ob("ob_sinai_marco", 40, 48, 6, 36, (g, v, a) => {
    const b = a.b, s = 760;
    sombraElip(g, a.cx + 6, b + 1, 13, 3, a.sombra); sombraElip(g, a.cx + 9, b - 4, 8, 4, a.sombra, 0.28);
    const P = [[20, b - 4, 12, 5], [21, b - 11, 10, 4.2], [19, b - 17, 8.5, 3.6], [20.5, b - 23, 6.5, 3.4], [20, b - 28, 4.6, 2.8], [20.5, b - 32.5, 3, 2.2]];
    P.forEach(([x, y, rx, ry], i) => {
      calhau(g, x, y, rx, ry, i % 2 ? R_MARCO : R_PENEDO.map((c, k) => misturar(c, R_MARCO[k], 0.6)), s + i);
      // sombra de contato da pedra de cima
      if (i) for (let X = Math.round(x - rx + 1); X < x + rx - 1; X++) { const Y = Math.round(y + ry); if (g.gf(X, Y)) g.fino(X, Y, sombrear(R_MARCO, -0.85, X, Y)); }
    });
    calhau(g, 9, b - 2, 3.5, 2.4, R_MARCO, s + 9); calhau(g, 32, b - 1, 3, 2.2, R_MARCO, s + 10);
  }, (g, v, a) => seixos(g, a.cx, a.b + 1, 28, R_MARCO, 765, 5));

  // jarros do Egito: talha grande de barro com faixa pintada e um cântaro ao lado
  const R_BARRO = rampa6("#b5663a", "couro"), R_BARRO2 = rampa6("#c98a55", "couro"), R_LAPIS = rampa6("#3b5a9a", "pano");
  function jarro(g, x, b, rx, alt, R, o = {}) {
    const cy = b - alt * 0.45, ry = alt * 0.47;
    elipF(g, x, cy, rx, ry, (nx, ny, X, Y) => {
      let l = -(0.62 * nx + 0.55 * ny) * 0.95 + 0.05;
      if (nx < -0.25 && nx > -0.5 && ny < -0.1 && ny > -0.55) l += 0.3; // brilho do engobe
      const faixa = o.faixa && Math.abs(ny + 0.28) < 0.14;
      if (faixa) return sombrear(o.faixa, l - 0.1 + ((X + (Y & 1) * 2) % 4 < 2 ? 0.18 : -0.18), X, Y, false);
      if (o.faixa && (Math.abs(ny + 0.48) < 0.035 || Math.abs(ny + 0.08) < 0.035)) l -= 0.4;
      return sombrear(R, l, X, Y);
    });
    const yg = Math.round(cy - ry), wg = Math.max(2, Math.round(rx * 0.42));
    retF(g, x - wg, yg - 3, wg * 2, 4, (X) => sombrear(R, 0.5 - ((X - (x - wg)) / (wg * 2)) * 1.2, X, yg));
    elipF(g, x, yg - 3.5, wg + 1.5, 1.8, (nx, ny, X, Y) => sombrear(R, 0.5 - nx * 0.6, X, Y, false));
    if (o.tampa) elipF(g, x, yg - 4, wg + 0.5, 1.4, (nx, ny) => (nx + ny < 0 ? o.tampa[4] : o.tampa[2]));
    else elipF(g, x, yg - 3.5, wg, 1, "#2a1614");
    if (o.alcas) for (const lado of [-1, 1]) galho(g, [[x + lado * wg, yg - 1], [x + lado * (rx * 0.8), yg + 1], [x + lado * (rx * 0.86), yg + 5]], 2, R, lado > 0 ? 1 : 0);
  }
  ob("ob_egito_jarros", 40, 40, 6, 30, (g, v, a) => {
    const b = a.b;
    sombraElip(g, a.cx + 6, b + 1, 16, 3.2, a.sombra); sombraElip(g, a.cx + 11, b - 5, 9, 5, a.sombra, 0.28);
    if (v === 0) {
      jarro(g, 15, b, 9, 27, R_BARRO, { faixa: R_LAPIS, alcas: true });
      jarro(g, 29, b + 1, 6.5, 16, R_BARRO2, { tampa: rampa6("#d8c8a0", "pano") });
    } else {
      jarro(g, 25, b - 1, 8.5, 25, R_BARRO2, { faixa: rampa6("#a8402e", "pano"), tampa: rampa6("#d8c8a0", "pano"), alcas: true });
      jarro(g, 11, b + 1, 6, 15, R_BARRO, {});
      jarro(g, 32, b + 2, 4.6, 11, R_BARRO, { alcas: false });
    }
  });

  // coral do Mar Vermelho: ramos vermelhos sobre um calhau, pontas claras
  const R_CORAL = rampa6("#c8604c", "pano"), R_CORAL2 = rampa6("#e08a5a", "pano");
  ob("ob_marVermelho_coral", 40, 40, 6, 27, (g, v, a) => {
    const b = a.b, s = 780 + v * 9, R = v ? R_CORAL2 : R_CORAL;
    sombraElip(g, a.cx + 5, b + 1, 13, 3, a.sombra);
    calhau(g, a.cx, b - 2, 9, 3.4, rampa6("#b89a84", "pedra"), s);
    const pontas = [];
    const ramo = (x, y, ang, len, w, prof) => {
      const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
      galho(g, [[x, y], [x1, y1]], w, [R[5], R[4], R[3], R[2], R[1]], ang > -1.2 ? 1 : 0);
      if (prof >= 3 || len < 3.5) { pontas.push([x1, y1]); return; }
      const abre = 0.42 + hash2(prof, Math.round(x * 3), s) * 0.3;
      ramo(x1, y1, ang - abre, len * 0.74, Math.max(1, w - 1), prof + 1);
      ramo(x1, y1, ang + abre, len * 0.7, Math.max(1, w - 1), prof + 1);
      if (prof === 0) ramo(x1, y1, ang + 0.05, len * 0.6, 2, prof + 1);
    };
    ramo(a.cx - 4 + v * 2, b - 3, -1.75, 8, 3, 0);
    ramo(a.cx + 4 - v, b - 3, -1.2, 7, 3, 0);
    for (const [x, y] of pontas) g.fino(Math.round(x), Math.round(y), "#f6dcc0");
  }, (g, v, a) => seixos(g, a.cx, a.b + 1, 24, rampa6("#c8a888", "pedra"), 785 + v, 4));

  // recife (Mar): mancha de água rasa com lajes escuras de rocha aflorando, a crista coberta de coral e
  // a linha d'água escura e molhada; espuma em volta.
  const R_RECIFE = rampa6("#6d5f58", "pedra");
  ob("ob_mar_recife", 48, 40, 6, 16, (g, v, a) => {
    const b = a.b, s = 800 + v * 9, cy = b - 9;
    aguaRasa(g, a.cx, cy, 23, 12, a.bio, s);
    // laje submersa: sombra larga sob a água
    sombraElip(g, a.cx, cy + 1, 19, 8, "#1c2c34", 0.3);
    const cab = v ? [[13, cy + 1, 6.5, 4, 0], [27, cy - 3, 8.5, 5.4, 1], [37, cy + 3, 5, 3.4, 0], [23, cy + 5, 4.4, 2.8, 1]] : [[15, cy - 2, 7.5, 5, 1], [31, cy + 1, 9, 5.6, 0], [21, cy + 6, 4.6, 2.8, 0], [39, cy - 5, 3.6, 2.6, 1]];
    for (const [x, y, rx, ry, t] of cab) {
      const R = t ? R_CORAL2 : R_CORAL, sk = s + Math.round(x);
      elipF(g, x, y, rx, ry, (nx, ny, X, Y) => {
        const n = nx * nx + ny * ny, rd = ruido(X / 2.2, Y / 2.2, sk);
        if (n > 0.78 + (rd - 0.5) * 0.55) return null; // orla quebrada
        const l = -(0.55 * nx + 0.8 * ny) * 0.85 + 0.1;
        if (ny > 0.45) return sombrear(R_RECIFE, -0.85, X, Y, false); // linha d'água molhada
        // crista: coral em crosta com sulcos; o resto é rocha facetada
        const crista = ny < 0.05 + (rd - 0.5) * 0.7 - Math.abs(nx) * 0.15;
        if (crista) return sombrear(R, (hash2(X >> 1, Y >> 1, sk) < 0.3 ? l - 0.55 : l + 0.2), X, Y, false);
        return sombrear(R_RECIFE, l - 0.15 + (hash2(X >> 1, Y, sk + 1) < 0.25 ? -0.3 : 0), X, Y, false);
      });
    }
    espuma(g, a.cx, cy, 22, 11, a.bio, s);
    for (let i = 0; i < 4; i++) g.sombraPx(Math.round(8 + hash2(i, s, 3) * 32), Math.round(cy - 6 + hash2(i, s, 4) * 12), 0.9, a.bio.agua.brilho);
  });

  // destroços (Mar Vermelho): roda de carro de guerra meio enterrada, tábuas e uma haste partida
  const R_TABUA = rampa6("#8a6a4a", "madeira"), R_BRONZE = rampa6("#b8862b", "metal");
  ob("ob_marVermelho_destrocos", 48, 40, 6, 28, (g, v, a) => {
    const b = a.b, s = 820 + v * 5, rx = 10, ry = 11.5, wx = v ? 17 : 31, wy = b - 12;
    sombraElip(g, a.cx + 5, b + 1, 20, 3.2, a.sombra); sombraElip(g, wx + 7, b - 4, 9, 5, a.sombra, 0.28);
    // tábuas caídas atrás
    galho(g, v ? [[22, b - 3], [44, b - 9]] : [[3, b - 8], [26, b - 2]], 4, R_TABUA, 1);
    // roda: aro, raios e cubo de bronze; o quadro 1 tem o aro partido
    const aro = (nx, ny, X, Y) => {
      const n = nx * nx + ny * ny;
      if (n < 0.6) return null;
      if (v && nx > 0.2 && ny < -0.45) return null;
      return sombrear(R_TABUA, -(0.6 * nx + 0.7 * ny) * (n > 0.82 ? 1 : -0.6) - 0.05, X, Y);
    };
    for (let i = 0; i < 6; i++) { const an = (i / 6) * Math.PI + 0.3; if (v && i === 4) continue; linF(g, wx - Math.cos(an) * (rx - 2), wy - Math.sin(an) * (ry - 2), wx + Math.cos(an) * (rx - 2), wy + Math.sin(an) * (ry - 2), i % 2 ? R_TABUA[3] : R_TABUA[2], 2); }
    elipF(g, wx, wy, rx, ry, aro);
    elipF(g, wx, wy, 2.8, 3, (nx, ny, X, Y) => sombrear(R_BRONZE, -(0.6 * nx + 0.7 * ny), X, Y, false));
    // areia cobrindo o pé da roda
    elipF(g, wx - 1, b - 1, 11, 3.6, (nx, ny, X, Y) => sombrear(rampa6(a.bio.chao.base, "pedra"), 0.3 - 0.4 * nx - 0.8 * ny, X, Y));
    // tábua da frente com cravos e haste de lança partida
    galho(g, v ? [[26, b - 1], [45, b - 3]] : [[4, b - 1], [22, b + 1]], 4, R_TABUA);
    for (const k of [0.2, 0.75]) { const X = Math.round(v ? 26 + 19 * k : 4 + 18 * k), Y = Math.round(v ? b - 2 - 2 * k : b - 1 + 2 * k); g.fino(X, Y, R_BRONZE[4]); g.fino(X + 1, Y + 1, R_BRONZE[1]); }
    galho(g, v ? [[8, b - 1], [14, b - 16]] : [[38, b], [43, b - 15]], 2, R_TABUA);
    const px = v ? 14 : 43, py = b - 17;
    g.fino(px, py, R_BRONZE[4]); g.fino(px, py - 1, R_BRONZE[5]); g.fino(px + 1, py, R_BRONZE[2]); g.fino(px, py - 2, R_BRONZE[3]);
  }, (g, v, a) => seixos(g, a.cx, a.b + 1, 40, rampa6("#c8a888", "pedra"), 825 + v, 5));

  // barco emborcado (Galileia): casco de tábuas virado, quilha para cima, remo encostado
  const R_CASCO = rampa6("#8a5f38", "madeira");
  ob("ob_galileia_barco", 56, 40, 6, 22, (g, v, a) => {
    const b = a.b, cx = a.cx, s = 840;
    sombraElip(g, cx + 6, b + 1, 25, 3.4, a.sombra);
    const alt = 19, meia = 24;
    for (let X = cx - meia; X <= cx + meia; X++) {
      const u = (X - cx) / meia, perfil = Math.pow(1 - Math.abs(u) ** 2.4, 0.6), topo = b - alt * perfil;
      for (let Y = Math.round(topo); Y <= b; Y++) {
        const t = (Y - topo) / Math.max(1, b - topo); // 0 na quilha, 1 no chão
        let l = 0.6 - t * 1.0 - u * 0.45;
        const fiada = Math.floor(t * 5 + 0.3);
        if (Math.abs(t * 5 + 0.3 - fiada) < 0.14 && t > 0.1) l -= 0.5; // junta entre as fiadas de tábuas
        else if (hash2(X >> 2, fiada, s) < 0.25) l -= 0.14;
        if ((X + fiada * 5) % 13 === 0 && t > 0.12) l -= 0.3; // emenda das tábuas
        if (t < 0.1) l = 0.75 - u * 0.3; // quilha
        g.fino(X, Y, sombrear(R_CASCO, lim(l, -1, 0.95), X, Y));
      }
    }
    // remendo de piche e remo encostado
    elipF(g, cx - 9, b - 8, 3.4, 2.4, (nx, ny, X, Y) => sombrear(rampa6("#3a302c", "couro"), -nx - ny, X, Y, false));
    galho(g, [[cx + 14, b + 1], [cx + 23, b - 19]], 2, R_TABUA);
    elipF(g, cx + 23.5, b - 21, 2.2, 3.6, (nx, ny) => (nx < 0 ? R_TABUA[4] : R_TABUA[2]));
  }, (g, v, a) => capim(g, a.cx, a.b + 1, 48, coresCapim(a.bio), 845, 9));

  // ================================================================== MUROS, PILHAS E MARCOS ALTOS
  // Uma pedra de alvenaria: cantos comidos, luz em cima/à esquerda, sombra embaixo/à direita, grão.
  function bloco(g, x, y, w, h, R, tomBase, sem) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1) && w > 3 && h > 3) continue;
      let l = tomBase + (hash2(x + i, y + j, sem) - 0.5) * 0.22;
      if (j === 0) l += 0.34; else if (i === 0) l += 0.2;
      if (j === h - 1) l -= 0.36; else if (i === w - 1) l -= 0.24;
      g.fino(x + i, y + j, sombrear(R, lim(l, -1, 0.95), x + i, y + j, false));
    }
  }
  // Trecho de muro de pedra solta: face da frente em fiadas desencontradas e o topo visto de cima.
  function muroPedra(g, x0, b, w, hF, hT, R, sem, v) {
    const yF = b - hF, yT = yF - hT;
    retF(g, x0, yT + 1, w, hF + hT - 1, R[0]); // juntas
    // topo (capeamento): pedras claras, vistas de cima
    for (let x = x0; x < x0 + w;) {
      const lw = Math.min(x0 + w - x, 5 + Math.floor(hash2(x, sem, 1) * 6));
      const falta = v === 1 && x > x0 + w * 0.55 && x < x0 + w * 0.8;
      if (!falta) bloco(g, x, yT + (hash2(x, sem, 2) < 0.3 ? 1 : 0), lw - 1, hT - (hash2(x, sem, 2) < 0.3 ? 1 : 0), R, 0.42 - ((x - x0) / w) * 0.25, sem + 3);
      x += lw;
    }
    // fiadas da frente
    const fiadas = Math.round(hF / 6.5);
    for (let f = 0; f < fiadas; f++) {
      const y = yF + Math.round((f * hF) / fiadas), h = yF + Math.round(((f + 1) * hF) / fiadas) - y;
      for (let x = x0 - (f % 2 ? 4 : 0) - Math.floor(hash2(f, sem, 4) * 3); x < x0 + w;) {
        const lw = 6 + Math.floor(hash2(x, f, sem + 5) * 6), xa = Math.max(x0, x), xb = Math.min(x0 + w, x + lw);
        if (xb - xa > 2) bloco(g, xa, y, xb - xa - 1, h - 1, R, -0.05 - ((xa - x0) / w) * 0.3 - f * 0.06 + (hash2(x, f, sem + 6) - 0.5) * 0.3, sem + 7);
        x += lw;
      }
    }
    // sombra do capeamento sobre a primeira fiada
    for (let X = x0; X < x0 + w; X++) { const c = g.gf(X, yF); if (c && c !== R[0]) g.fino(X, yF, misturar(c, R[0], 0.45)); }
  }
  const R_MURO = rampa6("#b09a74", "pedra");
  ob("ob_canaan_muro", 40, 44, 6, 28, (g, v, a) => {
    sombraElip(g, a.cx + 4, a.b + 1, 20, 3, a.sombra); for (let Y = a.b - 16; Y <= a.b + 1; Y++) for (let X = 37; X < 40; X++) g.sombraPx(X, Y, X === 39 ? 0.12 : 0.3, a.sombra);
    muroPedra(g, 3, a.b, 34, 20, 7, R_MURO, 860 + v * 5, v);
    if (v === 1) calhau(g, 31, a.b - 1, 4, 2.6, R_MURO, 866);
    for (let X = 4; X < 36; X++) if (hash2(X, v, 867) < 0.3 && g.gf(X, a.b - 26)) { g.fino(X, a.b - 27, R_MUSGO[4]); g.fino(X, a.b - 26, R_MUSGO[2]); }
  }, (g, v, a) => capim(g, a.cx, a.b + 1, 34, coresCapim(a.bio), 868 + v, 9));
  ob("ob_galileia_basalto_muro", 40, 44, 6, 28, (g, v, a) => {
    sombraElip(g, a.cx + 4, a.b + 1, 20, 3, a.sombra); for (let Y = a.b - 16; Y <= a.b + 1; Y++) for (let X = 37; X < 40; X++) g.sombraPx(X, Y, X === 39 ? 0.12 : 0.3, a.sombra);
    muroPedra(g, 3, a.b, 34, 20, 7, R_BASALTO, 880 + v * 5, v);
    if (v === 1) calhau(g, 31, a.b - 1, 4, 2.6, R_BASALTO, 886);
    for (let X = 4; X < 36; X++) if (hash2(X, v, 887) < 0.22 && g.gf(X, a.b - 26)) g.fino(X, a.b - 26, R_LIQUEN[3]);
  }, (g, v, a) => capim(g, a.cx, a.b + 1, 34, coresCapim(a.bio), 888 + v, 9));

  // tijolos do Egito: pilha em degraus de adobes secando ao sol, com palha por cima
  const R_ADOBE = rampa6("#b0703f", "pedra");
  function tijolo(g, x, y, R, sem, topo = true) {
    const t = (hash2(x, y, sem) - 0.5) * 0.3;
    if (topo) retF(g, x, y - 3, 9, 3, (X, Y, i, j) => sombrear(R, 0.55 + t - (i === 8 ? 0.4 : 0) + (j === 0 ? 0.12 : 0), X, Y, false));
    retF(g, x, y, 9, 6, (X, Y, i, j) => sombrear(R, (j === 0 ? 0.25 : j === 5 ? -0.6 : -0.08) + t - (i === 8 ? 0.45 : i === 0 ? -0.15 : 0) + (hash2(X, Y, sem + 1) - 0.5) * 0.16, X, Y, false));
  }
  ob("ob_egito_tijolos", 40, 44, 6, 28, (g, v, a) => {
    const b = a.b, s = 900 + v * 3;
    sombraElip(g, a.cx + 5, b + 1, 20, 3, a.sombra); sombraElip(g, a.cx + 12, b - 5, 9, 6, a.sombra, 0.28);
    const fiadas = v ? [[2, 4], [2, 3], [2, 1]] : [[2, 4], [7, 3], [11, 2]];
    fiadas.forEach(([x0, n], k) => { for (let i = 0; i < n; i++) tijolo(g, x0 + i * 9, b - 5 - k * 8, R_ADOBE, s + k); });
    if (v) { // um adobe tombado, encostado na pilha
      const m = new Set(); bastao(m, 26, b - 12, 33, b - 4, 5); pintarMascara(g, m, [R_ADOBE[5], R_ADOBE[3], R_ADOBE[2], R_ADOBE[1]]);
    }
    // palha solta
    const top = fiadas[2];
    for (let i = 0; i < 8; i++) { const X = Math.round(top[0] + hash2(i, s, 5) * (top[1] * 9 - 3)), Y = b - 5 - 16 - 2 - Math.round(hash2(i, s, 6) * 2); linF(g, X, Y, X + 2 + (i % 2), Y - 1 + (i % 3 === 0 ? 2 : 0), i % 2 ? "#e2cc7a" : "#c8a850"); }
  });

  // coluna do Egito: fuste de calcário pintado, capitel aberto em papiro e ábaco
  const R_CALC = rampa6("#dccdaa", "pedra"), R_VERM = rampa6("#b8503a", "pano"), R_VERDE = rampa6("#6f9a5a", "pano"), R_OURO = rampa6("#d8aa3a", "metal");
  ob("ob_egito_coluna", 48, 88, 8, 76, (g, v, a) => {
    const b = a.b, cx = a.cx, yF = b - 6, yC = b - 58, s = 920;
    sombraFaixa(g, cx + 4, b - 1, cx + 17, b + 3, 5, a.sombra); sombraElip(g, cx + 14, b + 2, 9, 3.4, a.sombra); sombraElip(g, cx + 3, b + 1, 13, 3, a.sombra);
    const cil = (u) => 0.72 - 1.15 * Math.abs(u + 0.38) - (u > 0.55 ? 0.3 : 0);
    // base: soco redondo em dois degraus
    elipF(g, cx, b - 2.5, 12, 3.4, (nx, ny, X, Y) => sombrear(R_CALC, cil(nx) - 0.25 - (ny > 0.2 ? 0.25 : 0), X, Y));
    elipF(g, cx, b - 5.5, 10, 2.8, (nx, ny, X, Y) => sombrear(R_CALC, cil(nx) + (ny < 0 ? 0.15 : -0.2), X, Y));
    // fuste: estreita no pé, incha e afina de novo até o capitel
    for (let Y = yF; Y >= yC; Y--) {
      const t = (yF - Y) / (yF - yC), hw = t < 0.12 ? 6 + (t / 0.12) * 2 : 8 - (t - 0.12) * 2.4;
      for (let X = Math.round(cx - hw); X < Math.round(cx + hw); X++) {
        const u = (X + 0.5 - cx) / hw;
        let l = cil(u) + (hash2(X, Y >> 1, s) - 0.5) * 0.12, R = R_CALC;
        const k = yF - Y;
        if (t < 0.13) { if ((X - cx + 40) % 5 === Math.min(4, Math.floor(k / 2))) R = R_OURO; else if ((X - cx + 40) % 5 === 2 && k < 5) R = R_VERDE; } // bainhas de folha no pé
        else if (k >= 24 && k < 34) R = [R_LAPIS, R_OURO, R_VERM, R_OURO, R_LAPIS][Math.floor((k - 24) / 2)];
        else if (k >= 46 && k < 52) R = [R_VERM, R_OURO, R_LAPIS][Math.floor((k - 46) / 2)];
        else if (k > 35 && k < 45 && Math.abs(u) < 0.5 && hash2(Math.floor((X - cx + 20) / 2), Math.floor(k / 3), s + 1) < 0.5 && k % 3 !== 0) { R = R_VERM; l -= 0.25; } // sinais pintados
        else if (k > 9 && k < 23 && Math.abs(u) < 0.5 && hash2(Math.floor((X - cx + 20) / 2), Math.floor(k / 3), s + 2) < 0.45 && k % 3 !== 0) { R = R_LAPIS; l -= 0.1; }
        if (Y < yC + 4) l -= 0.4; // sombra do capitel
        g.fino(X, Y, sombrear(R, l, X, Y));
      }
    }
    // capitel: cálice que abre, com pétalas pintadas, e a boca vista de cima
    const yB = yC - 13;
    for (let Y = yC; Y >= yB; Y--) {
      const t = (yC - Y) / 13, hw = 6 + 9 * Math.pow(t, 1.6);
      for (let X = Math.round(cx - hw); X < Math.round(cx + hw); X++) {
        const u = (X + 0.5 - cx) / hw, petala = Math.floor((u + 1) * 4.5);
        const meio = Math.abs((u + 1) * 4.5 - petala - 0.5);
        let R = petala % 2 ? R_VERDE : R_CALC, l = cil(u) - 0.1 + t * 0.2;
        if (meio > 0.4) { R = R_OURO; l -= 0.15; }
        if (t < 0.18) R = R_LAPIS;
        g.fino(X, Y, sombrear(R, l, X, Y));
      }
    }
    elipF(g, cx, yB, 15, 3.2, (nx, ny, X, Y) => sombrear(R_CALC, 0.6 - nx * 0.5 - (ny > 0.3 ? 0.5 : 0), X, Y));
    elipF(g, cx, yB - 0.5, 11, 2, (nx, ny, X, Y) => sombrear(R_VERDE, 0.1 - nx * 0.5, X, Y));
    retF(g, cx - 7, yB - 5, 14, 5, (X, Y, i, j) => sombrear(R_CALC, (j === 0 ? 0.8 : 0.3) - (i / 14) * 0.9, X, Y));
  });

  // estandarte do Sinai: mastro num monte de pedras, pano vermelho ao vento com barra e franja douradas
  const R_ESTAND = rampa6("#b83a2e", "pano"), R_MASTRO = rampa6("#7a5634", "madeira");
  ob("ob_sinai_estandarte", 48, 88, 8, 78, (g, v, a) => {
    const b = a.b, mx = 17, topo = b - 70;
    sombraFaixa(g, mx + 2, b - 1, mx + 20, b + 3, 3, a.sombra); sombraElip(g, mx + 6, b + 1, 12, 3, a.sombra); sombraElip(g, mx + 22, b + 3, 7, 2.6, a.sombra, 0.28);
    retF(g, mx - 1, topo, 3, 70, (X, Y, i) => sombrear(R_MASTRO, 0.55 - i * 0.6 - (hash2(i, Y >> 3, 940) < 0.2 ? 0.25 : 0), X, Y, false));
    // amarrações de corda e ponteira de bronze
    for (const Y of [topo + 4, topo + 30, b - 22]) retF(g, mx - 1, Y, 3, 2, (X, Y2, i, j) => (j ? "#a8895a" : "#d8c090"));
    elipF(g, mx + 0.5, topo - 2.5, 2.6, 2.8, (nx, ny, X, Y) => sombrear(R_BRONZE, -(0.6 * nx + 0.7 * ny) + 0.1, X, Y, false));
    g.fino(mx, topo - 6, R_BRONZE[4]); g.fino(mx, topo - 7, R_BRONZE[5]);
    // pano: 24 × 30, ondulado; cada coluna desce conforme a onda e a luz acompanha a dobra
    const x0 = mx + 2, W = 25, H = 30;
    for (let i = 0; i < W; i++) {
      const onda = Math.sin(i / 3.6 + 0.6), dy = Math.round(onda * 1.6 + i * 0.1), y0 = topo + 3 + dy;
      for (let j = 0; j < H; j++) {
        // a ponta do pano é recortada em duas línguas
        const lingua = i > W - 9 && Math.abs(j - H / 2) < (i - (W - 9)) * 0.75;
        if (lingua) continue;
        let R = R_ESTAND, l = Math.cos(i / 3.6 + 0.6 + 0.9) * 0.55 + 0.05 - (j / H) * 0.15;
        if (j < 3 || j >= H - 3) R = R_OURO;
        else if (j === 3 || j === H - 4) l -= 0.5;
        else if (Math.abs(i - 9) + Math.abs(j - H / 2) < 5.5 && Math.abs(i - 9) + Math.abs(j - H / 2) > 3) R = R_OURO; // losango bordado
        else if (Math.abs(i - 9) + Math.abs(j - H / 2) < 1.5) R = R_OURO;
        g.fino(x0 + i, y0 + j, sombrear(R, lim(l, -1, 0.9), x0 + i, y0 + j));
      }
      if (i % 2 === 0 && i <= W - 9) g.fino(x0 + i, y0 + H, R_OURO[i % 4 ? 3 : 4]); // franja
    }
    // monte de pedras do pé
    calhau(g, mx - 6, b - 2, 5, 3.4, R_MARCO, 941); calhau(g, mx + 7, b - 2, 5.5, 3.6, R_PENEDO, 942); calhau(g, mx + 1, b - 5, 5, 3.6, R_MARCO, 943); calhau(g, mx + 1, b - 0.5, 4, 2.4, R_MARCO, 944);
  }, (g, v, a) => seixos(g, 20, a.b + 1, 26, R_MARCO, 945, 4));

  // tenda do deserto (marco de uma casa): toldo baixo de pelo de cabra, duas águas, boca escura,
  // cordas esticadas e uma vara alta com tira de pano e odre pendurado.
  const R_PELO = rampa6("#54433a", "pano"), R_FAIXA = rampa6("#9a8672", "pano");
  ob("ob_deserto_tenda", 64, 72, 8, 58, (g, v, a) => {
    const b = a.b, cx = 29, yCu = b - 34, yBe = b - 20, s = 960;
    sombraElip(g, cx + 8, b + 1, 27, 3.4, a.sombra);
    for (let Y = yBe; Y <= b + 1; Y++) for (let X = 55; X < 55 + Math.min(8, (Y - yBe) * 0.5); X++) g.sombraPx(X, Y, 0.3, a.sombra);
    // cordas e estacas
    for (const [xa, xb] of [[5, 1], [53, 58]]) { linF(g, xa, yBe, xb, b - 1, "#b89a6a"); retF(g, xb, b - 3, 2, 4, R_MASTRO[2]); }
    // água de trás (clara, virada para o céu) e água da frente
    for (let Y = yCu - 5; Y < yCu; Y++) { const t = (yCu - Y) / 5; for (let X = Math.round(15 + t * 5); X <= Math.round(43 - t * 5); X++) g.fino(X, Y, sombrear(R_PELO, 0.55 - ((X - 15) / 28) * 0.4, X, Y)); }
    for (let Y = yCu; Y <= yBe; Y++) {
      const t = (Y - yCu) / (yBe - yCu), xl = 13 - t * 9, xr = 45 + t * 9;
      for (let X = Math.round(xl); X <= Math.round(xr); X++) {
        const u = (X - xl) / (xr - xl);
        let l = 0.22 - (u - 0.5) * 0.9 - t * 0.2 + Math.cos(u * 22) * 0.1, R = R_PELO;
        if (Math.abs(t - 0.34) < 0.09 || Math.abs(t - 0.74) < 0.07) { R = R_FAIXA; l -= 0.1; } // tiras tecidas
        if (Y === yCu) l += 0.5; if (Y >= yBe - 1) l -= 0.45;
        g.fino(X, Y, sombrear(R, lim(l, -1, 0.9), X, Y));
      }
    }
    // parede baixa de pano com a boca aberta
    for (let Y = yBe + 1; Y <= b; Y++) for (let X = 5; X <= 53; X++) {
      const u = (X - 5) / 48, boca = X >= 22 && X <= 36 && Y > yBe + 2;
      if (boca) { g.fino(X, Y, Y > b - 3 ? (X % 3 ? "#7a2a22" : "#c89a4a") : misturar("#160c0e", "#3a2420", Math.max(0, (Y - yBe - 8) / 14) * (1 - Math.abs(X - 29) / 9))); continue; }
      let l = 0.3 - u * 1.0 + Math.cos(u * 30) * 0.16 - (Y < yBe + 4 ? 0.45 : 0) - (Y > b - 2 ? 0.3 : 0);
      if (X === 21 || X === 37) l -= 0.5;
      g.fino(X, Y, sombrear(R_PELO, lim(l, -1, 0.9), X, Y));
    }
    // aba enrolada sobre a boca
    retF(g, 21, yBe + 1, 17, 3, (X, Y, i, j) => sombrear(R_FAIXA, 0.5 - j * 0.5 - (i / 17) * 0.4, X, Y, false));
    // esteios da cumeeira
    for (const X of [13, 45]) retF(g, X, yCu - 4, 2, 5, (x2, y2, i) => R_MASTRO[i ? 2 : 4]);
    // vara alta com tira de pano e odre
    const vx = 50, vt = b - 57;
    retF(g, vx, vt, 2, 57, (X, Y, i) => sombrear(R_MASTRO, 0.45 - i * 0.7, X, Y, false));
    for (let i = 0; i < 11; i++) { const dy = Math.round(Math.sin(i / 2.2) * 1.4); retF(g, vx + 2 + i, vt + 2 + dy, 1, i > 8 ? 2 : 4, (X, Y, k, j) => sombrear(R_ESTAND, Math.cos(i / 2.2 + 0.8) * 0.5 - j * 0.1, X, Y, false)); }
    elipF(g, vx - 2.5, b - 26, 2.6, 4, (nx, ny, X, Y) => sombrear(rampa6("#8a5a3a", "couro"), -(0.6 * nx + 0.6 * ny), X, Y, false));
    linF(g, vx, b - 33, vx - 2, b - 30, "#b89a6a");
    calhau(g, 12, b - 1, 3.4, 2.2, rampa6("#b88a5a", "pedra"), s); calhau(g, 42, b, 3, 2, rampa6("#b88a5a", "pedra"), s + 1);
  }, (g, v, a) => seixos(g, 29, a.b + 2, 44, rampa6("#b88a5a", "pedra"), 965, 5));

  // ================================================================== ESTRUTURAS (es_*)
  // Mesma célula, pegada e origem do legado; cada quadro é uma variante. A base do desenho fica 4 px
  // acima do fim da célula (o jogo desce a imagem 2 px).
  function es(chave, desenhar, depois) {
    const antes = PP[chave];
    const W = antes.w * 2, H = antes.h * 2;
    return registrar(chave, Object.assign({}, antes, {
      acabamento: false, contorno: "amigo", semEspelho: true, alto: true, alturaVisual: H - 8,
      desenhar(g, v) { desenhar(g, v, W, H - 4); }, depois,
    }));
  }
  const SOMBRA_VILA = "#2a1c1a";
  // sombra lateral de uma parede: cunha à direita, do beiral ao chão, e uma faixa sob a base
  function sombraParede(g, xd, yTopo, b, larg, x0) {
    for (let Y = yTopo; Y <= b + 2; Y++) for (let X = xd; X < xd + Math.min(larg, (Y - yTopo) * 0.45 + 1); X++) g.sombraPx(X, Y, X >= xd + larg - 2 ? 0.16 : 0.32, SOMBRA_VILA);
    for (let X = x0; X < xd + larg; X++) { g.sombraPx(X, b + 1, 0.32, SOMBRA_VILA); g.sombraPx(X + 1, b + 2, 0.16, SOMBRA_VILA); }
  }
  const R_MADEIRA = rampa6("#7a5530", "madeira"), R_MADEIRA_CL = rampa6("#a8844f", "madeira");
  // tábuas verticais com veio e junta
  const tabuas = (R, x0, passo, tomBase = 0) => (X, Y, i, j) => {
    const k = (X - x0) % passo;
    return sombrear(R, tomBase + (k === 0 ? -0.6 : k === 1 ? 0.25 : 0) + (hash2(Math.floor((X - x0) / passo), Y >> 2, 7) - 0.5) * 0.3 - (j === 0 ? -0.3 : 0), X, Y, false);
  };

  // ---------------------------------------------------------------- tenda grande (3 × 2 casas)
  // 0 pano cru · 1 listras vermelhas · 2 listras índigo · 3 pelo de cabra escuro
  const TENDAS = [
    { pano: rampa6("#c8b48a", "pano"), listra: rampa6("#a8906a", "pano") },
    { pano: rampa6("#d8c49a", "pano"), listra: rampa6("#a8402e", "pano") },
    { pano: rampa6("#d8c49a", "pano"), listra: rampa6("#3b5a9a", "pano") },
    { pano: rampa6("#54433a", "pano"), listra: rampa6("#9a8672", "pano") },
  ];
  es("es_tenda", (g, v, W, b) => {
    const c = TENDAS[v], cx = 51, yCu = 15, yBe = 45, xe = 9, xd = 93, s = 1000 + v;
    sombraParede(g, xd + 1, yBe, b, 10, xe + 3);
    // cordas e estacas
    for (const [xa, xb] of [[5, 1], [97, 102], [5, 4], [97, 99]]) linF(g, xa, yBe - 1, xb, xb < 4 || xb > 100 ? b - 2 : yBe + 14, "#b89a6a");
    for (const X of [1, 101]) retF(g, X, b - 5, 2, 5, (x2, y2, i) => R_MADEIRA[i ? 2 : 4]);
    // água de trás: faixa estreita e clara, virada para o céu
    for (let Y = yCu - 7; Y < yCu; Y++) { const t = (yCu - Y) / 7; for (let X = Math.round(21 + t * 7); X <= Math.round(81 - t * 7); X++) g.fino(X, Y, sombrear(c.pano, 0.6 - ((X - 21) / 60) * 0.5 + (Y === yCu - 7 ? 0.2 : 0), X, Y)); }
    // água da frente: desce da cumeeira ao beiral, com barriga entre os esteios e tiras tecidas
    const beiral = (X) => yBe + Math.round(Math.abs(Math.sin(((X - 5) / 46) * Math.PI)) * 2);
    for (let X = 5; X <= 97; X++) {
      const yb = beiral(X);
      for (let Y = yCu; Y <= yb; Y++) {
        const t = (Y - yCu) / (yb - yCu), xl = 21 - t * 16, xr = 81 + t * 16;
        if (X < xl || X > xr) continue;
        const u = (X - xl) / (xr - xl);
        let l = 0.34 - (u - 0.5) * 0.8 - t * 0.22 + Math.cos(u * 26) * 0.1 + (ruido(X / 6, Y / 6, s) - 0.5) * 0.16, R = c.pano;
        if (Math.abs(t - 0.22) < 0.05 || Math.abs(t - 0.52) < 0.07 || Math.abs(t - 0.82) < 0.05) { R = c.listra; l -= 0.05; }
        if (Y === yCu) l += 0.5;
        if (Y >= yb - 1) l -= 0.4; else if (Y === yb - 2) l += 0.25; // bainha do beiral
        if (Y === yb && X % 6 === 0) continue; // bainha recortada
        g.fino(X, Y, sombrear(R, lim(l, -1, 0.95), X, Y));
      }
    }
    // parede de pano: dobras verticais, sombra do beiral, barra no chão
    for (let Y = yBe + 1; Y <= b; Y++) for (let X = xe; X <= xd; X++) {
      if (Y <= beiral(X)) continue;
      const u = (X - xe) / (xd - xe);
      let l = 0.42 - u * 1.0 + Math.cos(u * 46) * 0.2 - (Y < beiral(X) + 5 ? 0.5 : 0) - (Y > b - 2 ? 0.35 : 0) + (ruido(X / 5, Y / 7, s + 1) - 0.5) * 0.14, R = c.pano;
      if (Y >= b - 7 && Y < b - 4) { R = c.listra; l -= 0.05; }
      g.fino(X, Y, sombrear(R, lim(l, -1, 0.9), X, Y));
    }
    // boca: interior escuro, com o fundo de esteira e o brilho de uma lamparina
    const bx0 = 41, bx1 = 62, by0 = yBe + 8;
    for (let Y = by0; Y <= b; Y++) for (let X = bx0; X <= bx1; X++) {
      const d = Math.hypot(X - 56, (Y - (b - 9)) * 1.2);
      let cor = misturar("#140b0d", "#4a2a1c", lim(1 - d / 13, 0, 1) * 0.8);
      if (Y > b - 5) cor = (X + Y) % 4 < 2 ? "#8e2a1f" : X % 4 === 0 ? "#e8b94a" : "#6a1c18"; // tapete na soleira
      g.fino(X, Y, cor);
    }
    g.fino(56, b - 10, "#ffd27a"); g.fino(56, b - 9, "#e8943a"); g.fino(55, b - 8, "#8a6a42"); g.fino(56, b - 8, "#b8862b"); g.fino(57, b - 8, "#8a6a42");
    // aba aberta, presa para o lado esquerdo, e o rolo sobre a boca
    for (let Y = by0; Y <= b; Y++) { const larg = Math.round(7 - ((Y - by0) / (b - by0)) * 5); for (let i = 0; i < larg; i++) g.fino(bx0 + i, Y, sombrear(c.pano, 0.5 - i * 0.22 - (Y - by0) * 0.012, bx0 + i, Y)); }
    retF(g, bx0 - 1, by0 - 3, bx1 - bx0 + 3, 4, (X, Y, i, j) => sombrear(c.listra, 0.55 - j * 0.42 - (i / 24) * 0.3, X, Y, false));
    for (const X of [bx0 + 4, bx1 - 4]) retF(g, X, by0 - 3, 1, 5, "#b89a6a");
    // esteios: pontas na cumeeira e varas do beiral nos cantos
    for (const X of [21, 51, 80]) retF(g, X, yCu - 5, 2, 6, (x2, y2, i) => R_MADEIRA[i ? 2 : 4]);
    for (const X of [xe, xd - 1]) retF(g, X, yBe + 2, 2, b - yBe - 1, (x2, y2, i) => sombrear(R_MADEIRA, (X === xe ? 0.4 : -0.2) - i * 0.5, x2, y2, false));
    // talha de água e feixe de lenha junto à parede
    jarro(g, 26, b + 1, 6, 16, R_BARRO, { alcas: true });
    for (let i = 0; i < 4; i++) galho(g, [[70 + i, b - 1 - i * 2], [84 + i, b - 3 - i * 2 + (i % 2)]], 2, i % 2 ? R_MADEIRA : R_MADEIRA_CL);
    // pedras segurando a barra
    calhau(g, 14, b, 3.2, 2, R_CALCARIO, s); calhau(g, 90, b, 3, 2, R_CALCARIO, s + 1);
  });

  // ---------------------------------------------------------------- banca de feira (3 × 2 casas)
  // 0 com mercadorias (toldo vermelho) · 1 vazia, reservada (toldo índigo)
  const R_CRU = rampa6("#eadcb6", "pano");
  es("es_banca", (g, v, W, b) => {
    const R_T = v ? R_LAPIS : rampa6("#c2452d", "pano"), s = 1040 + v;
    const yTo = 5, yFr = 31, yBa = 57, yFa = 64;
    sombraParede(g, 99, yFr + 4, b, 5, 8);
    // fundo de pano escuro e prateleira
    retF(g, 9, yFr - 2, 86, yBa - yFr + 2, (X, Y) => sombrear(rampa6("#3a2c24", "pano"), -0.2 - ((X - 9) / 86) * 0.4 + Math.cos(X / 3.2) * 0.2 - (Y < yFr + 6 ? 0.5 : 0), X, Y));
    retF(g, 10, 47, 84, 3, (X, Y, i, j) => sombrear(R_MADEIRA_CL, j === 0 ? 0.5 : j === 1 ? 0 : -0.6, X, Y, false));
    if (v === 0) {
      [[18, R_BARRO, 5, 11], [29, R_BARRO2, 4, 9], [39, R_BARRO, 4.4, 12], [66, R_BARRO2, 5, 11], [77, R_BARRO, 4, 9], [87, R_BARRO2, 4.4, 10]].forEach(([x, R, rx, alt]) => jarro(g, x, 47, rx, alt, R, { tampa: x % 2 ? R_CRU : null }));
      // réstia de cebolas e peixes secos pendurados
      for (let i = 0; i < 5; i++) elipF(g, 50 + (i % 2) * 3, 37 + i * 2.2, 2, 1.8, (nx, ny) => (nx + ny < -0.2 ? "#f0d0a0" : i % 2 ? "#c88a5a" : "#d8a878"));
      for (const x of [57, 61]) { linF(g, x, 34, x, 37, "#b89a6a"); elipF(g, x, 41, 1.6, 4, (nx, ny) => (nx < -0.1 ? "#d8dcc8" : "#8a9a98")); }
    } else {
      retF(g, 18, 43, 16, 4, (X, Y, i, j) => sombrear(R_CRU, 0.4 - j * 0.3 - (i / 16) * 0.5, X, Y, false));
      retF(g, 62, 44, 12, 3, (X, Y, i, j) => sombrear(TENDAS[0].listra, 0.3 - j * 0.3, X, Y, false));
    }
    // tampo do balcão (visto de cima) e frente de tábuas
    retF(g, 5, yBa, 94, yFa - yBa, (X, Y, i, j) => sombrear(R_MADEIRA_CL, 0.5 - (i / 94) * 0.5 - (j === yFa - yBa - 1 ? 0.5 : 0) + ((X - 5) % 16 === 0 ? -0.4 : 0) + (hash2(X >> 3, Y, s) - 0.5) * 0.2, X, Y));
    retF(g, 6, yFa, 92, b - yFa + 1, (X, Y, i, j) => {
      const k = (X - 6) % 9;
      return sombrear(R_MADEIRA, 0.05 - (i / 92) * 0.5 + (k === 0 ? -0.6 : k === 1 ? 0.22 : 0) - (j < 2 ? 0.4 : 0) - (j > b - yFa - 2 ? 0.3 : 0) + (hash2(Math.floor((X - 6) / 9), Y >> 2, s + 1) - 0.5) * 0.3, X, Y, false);
    });
    retF(g, 6, yFa + 6, 92, 2, (X, Y, i, j) => sombrear(R_MADEIRA_CL, j ? -0.5 : 0.2 - (i / 92) * 0.4, X, Y, false)); // travessa
    for (let X = 10; X < 98; X += 9) { g.fino(X, yFa + 6, R_BRONZE[4]); g.fino(X, b - 5, R_BRONZE[3]); }
    if (v === 0) {
      // manta pendurada na frente do balcão
      for (let i = 0; i < 22; i++) for (let j = 0; j < 17 + (i % 2); j++) {
        const X = 41 + i, Y = yFa - 1 + j, faixa = Math.floor(j / 3) % 3;
        g.fino(X, Y, j >= 17 ? "#eadcb6" : sombrear([R_ESTAND, R_OURO, R_LAPIS][faixa], 0.3 - (i / 22) * 0.6 + Math.cos(i / 2.4) * 0.2 - (j % 3 === 2 ? 0.3 : 0), X, Y, false));
      }
      // sobre o tampo: cesto de grão, peças de pano, romãs, tâmaras e balança de bronze
      elipF(g, 16, yBa + 1, 8, 4.6, (nx, ny, X, Y) => sombrear(rampa6("#b8935a", "madeira"), -(0.5 * nx + 0.8 * ny) + ((X + Y) % 3 === 0 ? -0.3 : 0.05), X, Y, false));
      elipF(g, 16, yBa - 0.5, 6.4, 3, (nx, ny, X, Y) => (hash2(X, Y, s + 2) < 0.3 ? "#f6dc8a" : nx + ny < -0.2 ? "#e8c05a" : "#c89a3a"));
      [[R_ESTAND, 28, 0], [R_LAPIS, 30, -4], [R_CRU, 29, -8]].forEach(([R, x, dy]) => retF(g, x, yBa - 4 + dy, 11, 4, (X, Y, i, j) => sombrear(R, 0.5 - j * 0.32 - (i / 11) * 0.5 - (i === 0 ? 0.4 : 0), X, Y, false)));
      for (const [x, y, t] of [[68, yBa + 1, 0], [73, yBa - 1, 1], [77, yBa + 2, 0], [71, yBa + 3, 1]]) {
        elipF(g, x, y, 2.6, 2.6, (nx, ny, X, Y) => sombrear(t ? rampa6("#c2452d", "pano") : rampa6("#d9843c", "pano"), -(0.6 * nx + 0.7 * ny) + 0.1, X, Y, false));
        g.fino(x, y - 3, "#6a3a22");
      }
      elipF(g, 88, yBa + 1, 6, 3.4, (nx, ny, X, Y) => sombrear(rampa6("#8a5a3a", "couro"), -(0.5 * nx + 0.8 * ny), X, Y, false));
      for (let i = 0; i < 9; i++) g.fino(Math.round(84 + hash2(i, s, 3) * 8), Math.round(yBa - 1 + hash2(i, s, 4) * 3), i % 2 ? "#7a3c20" : "#b5663a");
      // balança
      retF(g, 58, yBa - 12, 1, 13, R_BRONZE[3]); retF(g, 52, yBa - 12, 13, 1, R_BRONZE[4]); g.fino(58, yBa - 13, R_BRONZE[5]);
      for (const x of [52, 64]) { linF(g, x, yBa - 11, x - 2, yBa - 6, R_BRONZE[2]); linF(g, x, yBa - 11, x + 2, yBa - 6, R_BRONZE[2]); retF(g, x - 3, yBa - 5, 7, 2, (X, Y, i, j) => R_BRONZE[j ? 2 : 4]); }
      retF(g, 56, yBa, 5, 2, R_BRONZE[2]);
    } else {
      // vazia: um caixote virado e um pano dobrado sobre o tampo
      retF(g, 22, yBa - 7, 16, 10, tabuas(R_MADEIRA_CL, 22, 5, 0.1)); retF(g, 22, yBa - 7, 16, 1, R_MADEIRA_CL[5]); retF(g, 22, yBa + 2, 16, 1, R_MADEIRA_CL[1]);
      retF(g, 62, yBa - 1, 18, 4, (X, Y, i, j) => sombrear(R_CRU, 0.5 - j * 0.3 - (i / 18) * 0.5, X, Y, false));
    }
    // postes da frente e toldo em rampa: listras que abrem para a frente, dobras e bainha em bicos
    for (const X of [7, 95]) retF(g, X, yFr - 2, 3, b - yFr + 3, (x2, y2, i) => sombrear(R_MADEIRA, (X === 7 ? 0.5 : 0) - i * 0.5, x2, y2, false));
    for (let Y = yTo; Y <= yFr + 4; Y++) {
      const t = Math.min(1, (Y - yTo) / (yFr - yTo)), xl = 11 - t * 9, xr = 92 + t * 9;
      for (let X = Math.round(xl); X <= Math.round(xr); X++) {
        const u = (X - xl) / (xr - xl), lis = Math.floor(u * 13), R = lis % 2 ? R_CRU : R_T;
        if (Y > yFr) { // bicos da bainha, um por listra
          const m = Math.abs(u * 13 - lis - 0.5) * 2;
          if (Y - yFr > (1 - m) * 4.5) continue;
        }
        let l = 0.4 - (u - 0.5) * 0.9 - t * 0.2 + Math.cos(u * 13 * Math.PI * 2) * 0.12 + (ruido(X / 7, Y / 5, s + 5) - 0.5) * 0.2;
        if (Y === yTo) l += 0.4; if (Y >= yFr - 1 && Y <= yFr) l -= 0.35;
        if (Y > yFr) l -= 0.2;
        g.fino(X, Y, sombrear(R, lim(l, -1, 0.95), X, Y));
      }
    }
    retF(g, 10, yTo - 2, 84, 2, (X, Y, i, j) => R_MADEIRA[j ? 2 : 4]); // vara de trás
  });

  // ---------------------------------------------------------------- poço (1 casa)
  const R_PEDRA_POCO = rampa6("#a8987a", "pedra");
  es("es_poco", (g, v, W, b) => {
    const cx = 19, yBo = b - 21, s = 1080;
    sombraElip(g, cx + 7, b, 15, 4, SOMBRA_VILA); sombraFaixa(g, cx + 12, b - 2, cx + 19, b - 6, 2, SOMBRA_VILA, 0.28);
    // corpo: cilindro de pedras em fiadas
    for (let Y = yBo; Y <= b; Y++) for (let X = cx - 14; X < cx + 14; X++) {
      const u = (X + 0.5 - cx) / 14, fundo = b - 5 + Math.sqrt(Math.max(0, 1 - u * u)) * 5;
      if (Y > fundo) continue;
      const fila = Math.floor((Y - yBo - Math.round((1 - u * u) * 2)) / 5), junta = (Y - yBo - Math.round((1 - u * u) * 2) + 50) % 5 === 4 || (X + (fila % 2) * 4 + 40) % 8 === 0;
      let l = 0.68 - 1.2 * Math.abs(u + 0.35) - (u > 0.5 ? 0.3 : 0) + (hash2(Math.floor((X + (fila % 2) * 4) / 8), fila, s) - 0.5) * 0.35 - (Y < yBo + 5 ? 0.3 : 0);
      if (junta) l -= 0.7;
      g.fino(X, Y, sombrear(R_PEDRA_POCO, lim(l, -1, 0.9), X, Y));
    }
    // boca: aro de pedra visto de cima, parede de dentro e água escura com reflexo
    elipF(g, cx, yBo, 15, 6, (nx, ny, X, Y) => {
      const n = nx * nx + ny * ny, ang = Math.atan2(ny, nx);
      if (n < 0.46) {
        if (ny < -0.05 - nx * 0.2) return sombrear(R_PEDRA_POCO, -0.9 + (hash2(X >> 2, Y >> 1, s + 1) - 0.5) * 0.3, X, Y, false); // parede de dentro, na sombra
        return (X + Y * 2) % 7 === 0 && nx < 0.2 ? "#3f8a96" : misturar("#102a34", "#1d4f5c", lim(0.5 - ny, 0, 1));
      }
      if (n < 0.52) return R_PEDRA_POCO[0];
      const junta = Math.abs(((ang / TAU) * 11 + 20) % 1 - 0.5) > 0.44;
      return sombrear(R_PEDRA_POCO, junta ? -0.5 : 0.55 - nx * 0.4 - (n > 0.9 && ny > 0 ? 0.4 : 0), X, Y, false);
    });
    // armação: dois esteios, travessa, sarilho com corda enrolada e manivela
    const yTr = b - 46;
    for (const X of [cx - 13, cx + 11]) retF(g, X, yTr, 3, yBo - yTr + (X < cx ? 1 : 2), (x2, y2, i) => sombrear(R_MADEIRA, 0.5 - i * 0.55 - (hash2(i, y2 >> 2, s + 2) < 0.25 ? 0.2 : 0), x2, y2, false));
    retF(g, cx - 15, yTr - 3, 31, 3, (X, Y, i, j) => sombrear(R_MADEIRA_CL, (j === 0 ? 0.5 : j === 1 ? 0.1 : -0.5) - (i / 31) * 0.3, X, Y, false));
    retF(g, cx - 10, yTr + 6, 21, 4, (X, Y, i, j) => sombrear(R_MADEIRA, [0.4, 0.1, -0.2, -0.6][j], X, Y, false));
    retF(g, cx - 5, yTr + 5, 10, 6, (X, Y, i, j) => sombrear(rampa6("#c9b07a", "pano"), [0.6, 0.35, 0.1, -0.1, -0.35, -0.6][j] + (i % 2 ? 0 : -0.25), X, Y, false));
    linF(g, cx + 14, yTr + 8, cx + 17, yTr + 8, R_MADEIRA[2]); linF(g, cx + 17, yTr + 8, cx + 17, yTr + 13, R_MADEIRA[3]);
    // corda e balde de aduelas com aro de bronze
    retF(g, cx, yTr + 11, 1, 9, (X, Y, i, j) => (j % 2 ? "#c9b07a" : "#a8895a"));
    const by = yTr + 20;
    linF(g, cx - 3, by + 1, cx, by - 2, "#a8895a"); linF(g, cx + 3, by + 1, cx, by - 2, "#a8895a");
    retF(g, cx - 4, by + 1, 8, 7, (X, Y, i, j) => sombrear(R_MADEIRA_CL, 0.5 - i * 0.16 + (i % 2 ? -0.12 : 0) - (j > 5 ? 0.3 : 0), X, Y, false));
    retF(g, cx - 4, by + 3, 8, 1, (X, Y, i) => R_BRONZE[i < 3 ? 4 : 2]);
    elipF(g, cx, by + 1, 4, 1.3, "#2a1c14");
  });

  // ---------------------------------------------------------------- casa (reserva: no jogo as casas
  // onde se entra são desenhadas por cenario.js): terraço com mureta e fachada de 58 px.
  // 0 adobe claro · 1 pedra de Canaã · 2 basalto da Galileia · 3 tijolo de barro do Egito
  const CASAS = [
    { R: rampa6("#c8a272", "pedra"), tipo: "reboco", teto: rampa6("#cfae74", "pedra") },
    { R: rampa6("#a8987a", "pedra"), tipo: "pedra", teto: rampa6("#b8a47a", "pedra") },
    { R: rampa6("#4c4a48", "pedra"), tipo: "pedra", teto: rampa6("#8a7252", "pedra") },
    { R: rampa6("#a8683f", "pedra"), tipo: "tijolo", teto: rampa6("#c8a272", "pedra") },
  ];
  es("es_casa", (g, v, W, b) => {
    const c = CASAS[v], R = c.R, x0 = 6, x1 = 97, yT = 8, yF = 42, s = 1100 + v * 7;
    sombraParede(g, x1 + 1, yF, b, 6, x0 + 3);
    // fachada no material da região
    for (let Y = yF; Y <= b; Y++) for (let X = x0; X <= x1; X++) {
      const u = (X - x0) / (x1 - x0);
      let l = 0.3 - u * 0.75 + (u < 0.04 ? 0.3 : 0) - (Y < yF + 4 ? 0.35 : 0) + (ruido(X / 9, Y / 9, s) - 0.5) * 0.3;
      if (c.tipo === "pedra") {
        const fila = Math.floor((Y - yF) / 7), xx = X + (fila % 2) * 6 + Math.floor(hash2(fila, v, s) * 4), k = xx % 13, j = (Y - yF) % 7;
        l += (hash2(Math.floor(xx / 13), fila, s + 1) - 0.5) * 0.4;
        if (j === 6 || k === 0) l -= 0.75; else if (j === 0 || k === 1) l += 0.22; else if (j === 5 || k === 12) l -= 0.2;
      } else if (c.tipo === "tijolo") {
        const fila = Math.floor((Y - yF) / 4), xx = X + (fila % 2) * 5, k = xx % 10, j = (Y - yF) % 4;
        l += (hash2(Math.floor(xx / 10), fila, s + 1) - 0.5) * 0.3;
        if (j === 3 || k === 0) l -= 0.6; else if (j === 0) l += 0.18;
      } else {
        // reboco: manchas onde ele caiu e aparece o adobe, e rachaduras finas
        if (ruido(X / 7, Y / 5, s + 2) > 0.74) { const j = (Y - yF) % 4; l -= j === 3 ? 0.7 : 0.3; }
        else if (hash2(X, Y, s + 3) < 0.04) l -= 0.25;
      }
      g.fino(X, Y, sombrear(R, lim(l, -1, 0.9), X, Y));
    }
    // terraço visto de cima: piso de terra batida, mureta em volta, com a face de dentro na sombra
    retF(g, x0 - 2, yT, x1 - x0 + 5, yF - yT, (X, Y, i, j) => {
      const W2 = x1 - x0 + 5, H2 = yF - yT, borda = i < 4 || i >= W2 - 4 || j < 4 || j >= H2 - 4;
      if (borda) return sombrear(c.teto, 0.62 - (i / W2) * 0.4 - (j >= H2 - 1 ? 0.6 : 0) + (hash2(X >> 2, Y >> 2, s + 4) - 0.5) * 0.2 - ((i === 3 || j === 3) && i >= 3 && j >= 3 ? 0.3 : 0), X, Y);
      return sombrear(c.teto, 0.05 - (i / W2) * 0.25 - (j < 7 || i < 7 ? 0.45 : 0) + (ruido(X / 6, Y / 4, s + 5) - 0.5) * 0.4, X, Y);
    });
    // pontas das vigas do teto
    for (let X = x0 + 5; X < x1 - 3; X += 9) retF(g, X, yF + 4, 3, 3, (x2, y2, i, j) => R_MADEIRA[j === 0 ? 4 : i === 2 ? 1 : 2]);
    // porta em arco: vão escuro, folha de tábuas com cravos, verga e soleira
    const px = 18, pw = 17, py = b - 31;
    for (let Y = py - 2; Y <= b; Y++) for (let X = px - 2; X < px + pw + 2; X++) {
      const nx = (X + 0.5 - (px + pw / 2)) / (pw / 2 + 2), arco = Y < py + 7 ? Math.sqrt(Math.max(0, 1 - nx * nx)) * 9 : 99;
      if (Y < py + 7 - arco) continue;
      const dentro = X >= px && X < px + pw && Y >= py + 7 - Math.sqrt(Math.max(0, 1 - ((X + 0.5 - (px + pw / 2)) / (pw / 2)) ** 2)) * 7;
      if (!dentro) { g.fino(X, Y, sombrear(c.teto, 0.5 - (X - px) / 40 - ((X + Y) % 6 === 0 ? 0.5 : 0), X, Y, false)); continue; } // moldura de pedra
      const k = (X - px) % 4;
      let l = 0.2 - ((X - px) / pw) * 0.5 + (k === 0 ? -0.6 : k === 1 ? 0.2 : 0) + (hash2(X >> 2, Y >> 2, s + 6) - 0.5) * 0.25;
      if (X < px + 2 || Y < py + 9 - arco * 0.7) l -= 0.5; // sombra do vão
      g.fino(X, Y, sombrear(R_MADEIRA, lim(l, -1, 0.9), X, Y, false));
    }
    for (const Y of [py + 12, b - 6]) { retF(g, px + 1, Y, pw - 2, 2, (X, Y2, i, j) => R_MADEIRA[j ? 1 : 2]); for (let X = px + 2; X < px + pw - 1; X += 4) g.fino(X, Y, R_BRONZE[4]); }
    g.fino(px + pw - 4, b - 14, R_BRONZE[5]); g.fino(px + pw - 4, b - 13, R_BRONZE[3]); g.fino(px + pw - 3, b - 13, R_BRONZE[2]);
    retF(g, px - 4, b - 1, pw + 8, 2, (X, Y, i, j) => sombrear(c.teto, j ? -0.3 : 0.5, X, Y, false));
    // janela: vão fundo com treliça de madeira, peitoril e portadas
    const jx = 50, jy = yF + 17, jw = 14, jh = 13;
    retF(g, jx - 1, jy - 1, jw + 2, jh + 2, "#1c1210");
    for (let j = 0; j < jh; j++) for (let i = 0; i < jw; i++) { const d1 = (i + j) % 5 === 0, d2 = (i - j + 50) % 5 === 0; if (d1 || d2) g.fino(jx + i, jy + j, d1 ? R_MADEIRA_CL[3] : R_MADEIRA[3]); else if (j < 2 || i < 2) g.fino(jx + i, jy + j, "#120a0c"); }
    retF(g, jx - 3, jy + jh + 1, jw + 6, 2, (X, Y, i, j) => sombrear(c.teto, j ? -0.4 : 0.55, X, Y, false));
    for (const X of [jx - 5, jx + jw + 1]) retF(g, X, jy - 1, 4, jh + 2, (x2, y2, i, j) => sombrear(R_MADEIRA_CL, (X < jx ? 0.3 : -0.1) - i * 0.15 - (j % 3 === 2 ? 0.45 : 0), x2, y2, false));
    // fresta alta de ventilação
    retF(g, x0 + 6, yF + 12, 3, 7, (X, Y, i, j) => (i === 2 && j > 0 ? misturar(R[2], "#1c1210", 0.4) : "#1c1210"));
    if (v < 2) {
      // escada de fora até o terraço: degraus com o piso claro e o espelho na sombra
      const n = 9, ex0 = 70;
      for (let i = 0; i < n; i++) {
        const xe = ex0 + i * 3, ye = b - (i + 1) * 6 - 2;
        retF(g, xe, ye, x1 - xe + 1, b - ye + 1, (X, Y, k, j) => {
          const degrau = Math.floor((X - ex0) / 3), yd = b - (Math.min(n - 1, degrau) + 1) * 6 - 2;
          if (Y < yd) return null;
          return sombrear(c.teto, Y - yd < 2 ? 0.6 : -0.15 - ((Y - yd) % 6 === 5 ? 0.3 : 0) - (X - x0) / 300 + (hash2(X >> 2, Y >> 2, s + 8) - 0.5) * 0.2, X, Y);
        });
      }
    } else {
      // segunda janela pequena e uma esteira de junco pendurada para secar
      retF(g, 76, yF + 19, 8, 9, "#1c1210"); for (let j = 0; j < 9; j += 3) retF(g, 76, yF + 19 + j, 8, 1, R_MADEIRA[3]);
      retF(g, 74, yF + 29, 12, 2, (X, Y, i, j) => sombrear(c.teto, j ? -0.4 : 0.55, X, Y, false));
      if (v === 3) { linF(g, 86, b, 92, yF - 2, R_MADEIRA_CL[3]); linF(g, 91, b, 97, yF - 2, R_MADEIRA_CL[2]); for (let k = 0; k < 6; k++) linF(g, 87 + k, b - 6 - k * 9, 92 + k, b - 6 - k * 9, R_MADEIRA_CL[4]); }
    }
    // talha junto à porta e banco de pedra
    jarro(g, px - 7, b + 1, 5, 14, R_BARRO, { alcas: true });
    retF(g, 40, b - 6, 22, 7, (X, Y, i, j) => sombrear(c.teto, (j < 2 ? 0.55 : -0.1) - (i / 22) * 0.4 - (i === 21 ? 0.4 : 0), X, Y, false));
    // no terraço: forno de barro (tabun), vaso de planta e esteira com grão a secar
    elipF(g, x0 + 16, yT + 16, 7, 5.5, (nx, ny, X, Y) => sombrear(R_BARRO, -(0.6 * nx + 0.8 * ny) + 0.05, X, Y));
    elipF(g, x0 + 16, yT + 13, 3, 1.6, "#1c1210");
    retF(g, x1 - 40, yT + 10, 22, 14, (X, Y, i, j) => ((i + (j & 1)) % 2 ? "#c8b070" : "#a8904e"));
    elipF(g, x1 - 29, yT + 17, 7, 4, (nx, ny, X, Y) => (hash2(X, Y, s + 9) < 0.35 ? "#f0d488" : "#d8b45a"));
    elipF(g, x1 - 9, yT + 24, 3, 2.6, (nx, ny, X, Y) => sombrear(R_BARRO2, -(nx + ny) * 0.6, X, Y, false));
    folhagem(g, [{ x: x1 - 9, y: yT + 19, rx: 4.5, ry: 3.5 }], R_FIGO, s, { r: [1.6, 2.4] });
  }, (g, v) => {
    // fumaça do forno, sem contorno
    for (let k = 0; k < 9; k++) { const X = Math.round(22 + Math.sin(k * 1.1 + v) * 2.2), Y = 20 - k * 2; g.fino(X, Y, M.comAlfa("#efe8da", 0.55 - k * 0.05)); if (k % 2) g.fino(X + 1, Y, M.comAlfa("#efe8da", 0.35 - k * 0.03)); }
  });

  // ================================================================== DECORAÇÃO PLANA (dc_*)
  // 32 × 32 px, sem contorno, origem no centro: fica no chão, sob os personagens.
  function dc(chave, desenhar) {
    return registrar(chave, Object.assign({}, PP[chave], { w: 16, h: 16, contorno: null, acabamento: false, origem: [0.5, 0.5], semEspelho: true, alto: false, alturaVisual: 0, desenhar }));
  }
  dc("dc_tapete", (g) => {
    for (let Y = 8; Y < 25; Y++) for (let X = 3; X < 29; X++) g.sombraPx(X + 1, Y + 1, 0.3, SOMBRA_VILA);
    retF(g, 3, 8, 26, 16, (X, Y, i, j) => {
      const bi = Math.min(i, 25 - i), bj = Math.min(j, 15 - j), b = Math.min(bi, bj);
      const l = 0.15 - (i / 26) * 0.35 + (hash2(X, Y, 1200) - 0.5) * 0.16;
      if (b === 0) return sombrear(rampa6("#5e1a14", "pano"), l + 0.2, X, Y, false);
      if (b === 1) return sombrear(R_OURO, l - 0.2, X, Y, false);
      if (b === 2 || b === 3) return sombrear(R_LAPIS, l + ((i + j) % 2 ? 0.2 : -0.15), X, Y, false);
      // campo: losangos encadeados em ouro sobre vermelho
      const d = (Math.abs(((i - 1) % 8) - 4) + Math.abs(j - 7.5));
      if (Math.abs(d - 3.5) < 0.8) return sombrear(R_OURO, l, X, Y, false);
      if (d < 1.6) return sombrear(R_CRU, l, X, Y, false);
      return sombrear(R_ESTAND, l - 0.1 + (j % 2 ? 0.08 : 0), X, Y, false);
    });
    for (let Y = 8; Y < 24; Y += 2) { g.fino(2, Y, "#eadcb6"); g.fino(1, Y, "#c8b48a"); g.fino(29, Y + 1, "#eadcb6"); g.fino(30, Y + 1, "#a8916a"); }
  });
  dc("dc_esteira", (g) => {
    for (let Y = 10; Y < 26; Y++) for (let X = 3; X < 29; X++) g.sombraPx(X + 1, Y + 1, 0.28, SOMBRA_VILA);
    const R = rampa6("#c8b070", "madeira");
    retF(g, 3, 10, 26, 15, (X, Y, i, j) => {
      const tr = ((i >> 1) + (j >> 1)) % 2;
      let l = (tr ? 0.3 : -0.1) - (i / 26) * 0.3 + ((i & 1) === 0 && tr ? 0.15 : 0) + (j & 1 && !tr ? -0.15 : 0);
      if (j === 0 || j === 14) l = -0.5; if (i === 0 || i === 25) l = -0.35;
      return sombrear(R, l, X, Y, false);
    });
    for (let X = 4; X < 29; X += 2) { g.fino(X, 9, R[4]); g.fino(X + 1, 25, R[2]); }
    // almofada em rolo numa ponta
    for (let Y = 5; Y < 12; Y++) for (let X = 17; X < 30; X++) g.sombraPx(X + 1, Y + 2, 0.28, SOMBRA_VILA);
    retF(g, 17, 5, 12, 6, (X, Y, i, j) => sombrear(i % 4 === 1 ? R_LAPIS : R_CRU, [0.7, 0.45, 0.15, -0.1, -0.4, -0.7][j] - (i / 12) * 0.2, X, Y, false));
    elipF(g, 17, 8, 1.4, 3, (nx, ny) => (nx < 0 ? R_CRU[4] : R_CRU[2])); elipF(g, 29, 8, 1.4, 3, R_CRU[1]);
  });
  dc("dc_rede", (g) => {
    // malha em losangos de uma rede estendida a secar, com boias de cortiça, pesos e um peixe
    const dentro = (X, Y) => { const nx = (X - 15.5) / 14, ny = (Y - 16) / 10.5; return nx * nx + ny * ny < 1 + (ruido(X / 5, Y / 5, 1230) - 0.5) * 0.5; };
    for (let Y = 3; Y < 30; Y++) for (let X = 1; X < 31; X++) {
      if (!dentro(X, Y)) continue;
      const a = (X + Y) % 6 === 0, b = (X - Y + 66) % 6 === 0;
      if (a && b) g.fino(X, Y, "#f0e2bc"); else if (a) g.fino(X, Y, "#d4c296"); else if (b) g.fino(X, Y, "#b8a478");
      else if ((X + Y + 1) % 6 === 0 || (X - Y + 67) % 6 === 0) g.sombraPx(X, Y, 0.3, SOMBRA_VILA);
    }
    for (let i = 0; i < 9; i++) {
      const an = (i / 9) * TAU + 0.3, X = Math.round(15.5 + Math.cos(an) * 13.5), Y = Math.round(16 + Math.sin(an) * 10);
      const cort = i % 3 !== 2;
      g.fino(X, Y, cort ? "#b07a48" : "#9a9488"); g.fino(X + 1, Y, cort ? "#8a5a34" : "#7a746a"); g.fino(X, Y - 1, cort ? "#d09a62" : "#c0b8a8"); g.fino(X + 1, Y + 1, cort ? "#6a4426" : "#5a544c");
    }
    const R_PEIXE = rampa6("#8aa4b0", "metal");
    elipF(g, 18, 17, 5, 2.4, (nx, ny, X, Y) => sombrear(R_PEIXE, -ny * 0.9 - nx * 0.2 + ((X + Y) % 2 ? 0.1 : -0.1), X, Y, false));
    for (const [dx, dy] of [[6, 0], [7, -1], [7, 1], [8, -2], [8, 2]]) g.fino(18 + dx, 17 + dy, R_PEIXE[2]);
    g.fino(14, 16, "#1c1210");
  });
  dc("dc_fogo_apagado", (g) => {
    const R_CINZA = rampa6("#a39a8c", "pedra"), R_CARVAO = rampa6("#3a302c", "pedra"), R_PED = rampa6("#9a8c78", "pedra"), R_PED2 = rampa6("#7f7468", "pedra");
    sombraElip(g, 17, 18, 13, 8.5, SOMBRA_VILA, 0.24);
    // leito: terra queimada na orla, cinza clara no meio, miolo de carvão
    elipF(g, 16, 17, 9, 6, (nx, ny, X, Y) => {
      const n = nx * nx + ny * ny, h = hash2(X, Y, 1251);
      if (n > 0.8) return h < 0.45 ? null : R_CARVAO[2];
      if (n > 0.66) return sombrear(R_CARVAO, 0.1 + (h - 0.5) * 0.8, X, Y, false);
      return sombrear(R_CINZA, 0.25 - nx * 0.35 - ny * 0.35 + (h - 0.5) * 0.6, X, Y, false);
    });
    // tições cruzados, de ponta esbranquiçada
    for (const p of [[[9, 19], [19, 14]], [[13, 13], [22, 19]], [[15, 21], [23, 15]]]) {
      const m = new Set(); bastao(m, p[0][0], p[0][1], p[1][0], p[1][1], 2); pintarMascara(g, m, [R_CARVAO[4], R_CARVAO[2], R_CARVAO[1], R_CARVAO[0]]);
      g.fino(p[0][0], p[0][1], "#d8d0c0"); g.fino(p[1][0], p[1][1], "#bcb4a6");
    }
    for (const [X, Y] of [[12, 16], [18, 16], [16, 19], [20, 18]]) g.fino(X, Y, "#efe9dc");
    g.fino(15, 16, "#c8552a"); g.fino(16, 16, "#8a3420"); // última brasa
    // roda de pedras desiguais, com vãos entre elas
    for (let i = 0; i < 9; i++) {
      const an = (i / 9) * TAU + 0.25 + (hash2(i, 3, 1253) - 0.5) * 0.2, x = 16 + Math.cos(an) * 12, y = 17 + Math.sin(an) * 8.6;
      calhau(g, x, y, 1.6 + hash2(i, 1, 1253) * 0.9, 1.3 + hash2(i, 2, 1253) * 0.6, i % 3 === 1 ? R_PED2 : R_PED, 1252 + i);
      // fuligem na face virada para o fogo
      const X = Math.round(x - Math.cos(an) * 1.6), Y = Math.round(y - Math.sin(an) * 1.2); if (g.gf(X, Y)) g.fino(X, Y, R_CARVAO[3]);
    }
  });
  PP.dc_fogo_apagado.contorno = "amigo"; // as pedras da roda têm volume: ganham o contorno de 1 px
})(typeof window !== "undefined" ? window : globalThis);
