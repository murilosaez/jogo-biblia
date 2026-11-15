// =====================================================================
// arte/flora.js — flora, rochas, estruturas e decoração, altas e com sombra projetada (pacote A5).
//
// Re-registra, com as MESMAS chaves e o mesmo número de variantes (quadros) da reserva de
// sprites.js: as 26 chaves ob_<area>_<tipo>, es_casa, es_tenda, es_banca, es_poco e os 4 dc_*.
// No fim do arquivo fica a REVISÃO DA ARTE DO MUNDO (o desenho que veio da main): os props das vilas
// (ob_<area>_barril, _caixotes, _carroca, _jarros, _lenha, _cocho, _cerca), sempre registrados, e o segundo
// desenho de 15 obstáculos, de 3 estruturas e das 4 decorações, que só vale nas chaves de Arte.MUNDO_DA_MAIN.
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

  // ================================================================== REVISÃO DA ARTE DO MUNDO (lado da main)
  // O segundo desenho dos elementos do mundo, vindo da revisão que estava em sprites.js: árvores de 2 casas com a
  // copa em cachos (3 variantes), rochas facetadas, arbustos, retama e coral, a mureta de Canaã, tenda, banca e
  // poço e as 4 decorações do chão. Ficam guardados em Arte.motor.mundoAlternativo (chave → def) e só valem para
  // as chaves citadas em Arte.MUNDO_DA_MAIN (sprites.js) — a escolha é por elemento. Os PROPS DAS VILAS (barril,
  // caixotes, carroça, jarros, lenha, cocho e cerca, um por região) só existem neste desenho e são sempre
  // registrados. Tudo em px de arte, luz de cima e da esquerda, sombra para a direita; nada de espelho.
  {
  const { comAlfa, tom } = M;
  const PIXEL_PATTERNS = PP;
  const ALT = {};
  const alt = (chave, def) => {
    const d = ALT[chave] = Object.assign({ origem: [0.5, 1], semEspelho: true, alturaVisual: Math.max(0, def.h * 2 - 8) }, def);
    if (d.alto === undefined) d.alto = !!d.estrutura;
    return d;
  };
  // elipse em px a partir de medidas em unidades de 2 px (as do desenho antigo)
  const elipU = (g, cx, cy, rx, ry, c) => elipF(g, cx * 2, cy * 2, rx * 2, ry * 2, c);
  function obstaculo(chave, alto, variantes, desenhar) {
    return alt(chave, {
      w: 18, h: alto ? 26 : 18, quadros: variantes, alto, obstaculo: true, origem: [0.5, 1],
      desenhar(g, v) { desenhar(g, v, alto ? 24 : 16); },
    });
  }
  // tenda: 0 pano cru · 1 listras vermelhas · 2 listras índigo · 3 pelo de cabra escuro
  const CORES_TENDA = [
    { pano: ["#a8916a", "#c8b48a", "#e0d0a8"], listra: "#b8a07a" },
    { pano: ["#b8a07a", "#d8c49a", "#eadcb6"], listra: "#a8402e" },
    { pano: ["#b8a07a", "#d8c49a", "#eadcb6"], listra: "#3b5a9a" },
    { pano: ["#2e2420", "#46382e", "#5e4c3e"], listra: "#8a7a62" },
  ];
  alt("es_tenda", {
    w: 52, h: 44, quadros: CORES_TENDA.length, origem: [0.5, 1], estrutura: true,
    desenhar(g, v) {
      // em px de arte (X, Y): 1 px de arte = 1 px de mundo, como as árvores e os props
      const c = CORES_TENDA[v], b = 42, cumeeira = 9, beiral = 24, B = 2 * b + 1, C = 2 * cumeeira, E = 2 * beiral;
      g.sombra(29, b + 0.5, 25, 2);
      // vara de 3 px (luz à esquerda, sombra à direita) de Y0 a Y1
      const vara = (X0, Y0, Y1) => { for (let Y = Y0; Y <= Y1; Y++) { g.fino(X0, Y, "#8a6a42"); g.fino(X0 + 1, Y, "#6b4a2e"); g.fino(X0 + 2, Y, "#4a3222"); } };
      // cordas de 1 px e estacas
      for (const [x0, x1] of [[4, 1], [47, 50]]) { g.linf(x0 + 0.5, beiral + 0.5, x1 + 0.5, b, "#8a6a42"); g.retf(x1, b - 0.5, 1, 1, (X, Y, i) => (i ? "#3a2418" : "#5a3a24")); }
      // teto: desce da cumeeira até o beiral, com listras de 2 px e a bainha escura de 1 px
      for (let Y = C; Y <= E + 1; Y++) {
        const t = (Y - C) / (E + 1 - C), meia = Math.round(30 + t * 18);
        for (let X = 52 - meia; X <= 51 + meia; X++) {
          const lado = X < 52 - meia + 5 ? 2 : X > 51 + meia - 7 ? 0 : 1, k = (Y - C) % 10;
          let cor = c.pano[lado];
          if (k === 6 || k === 7) cor = c.listra;
          else if (k === 8) cor = misturar(c.pano[lado], "#1c1210", 0.12); // sombra de 1 px sob a listra
          if (X === 52 - meia || X === 51 + meia) cor = c.pano[0];
          if (Y === E + 1) cor = misturar(c.pano[0], "#1c1210", 0.2);
          g.fino(X, Y, cor);
        }
      }
      // paredes de pano até o chão (costuras de 1 px), com a entrada aberta no meio
      for (let Y = E + 2; Y <= B; Y++)
        for (let X = 6; X <= 97; X++) {
          const entrada = X >= 42 && X <= 61;
          let cor = X < 12 ? c.pano[2] : X > 91 ? c.pano[0] : c.pano[1];
          if ((X - 6) % 18 === 0) cor = c.pano[0];
          if (entrada) cor = Y < E + 7 ? c.pano[0] : X === 42 || X === 61 ? "#3a2a22" : "#1c1210";
          g.fino(X, Y, cor);
        }
      // aba enrolada sobre a entrada (luz em cima, sombra embaixo) e varas do beiral
      for (let X = 40; X <= 63; X++) for (let j = 0; j < 4; j++) g.fino(X, E + 2 + j, j === 0 ? misturar(c.listra, "#ffffff", 0.25) : j === 3 ? misturar(c.listra, "#1c1210", 0.35) : c.listra);
      for (const X of [6, 40, 62, 96]) vara(X, E, B);
      vara(46, C - 6, C + 1); vara(56, C - 6, C + 1);
      // tapete na soleira, com a franja de 1 px
      for (let X = 44; X <= 59; X++) { g.fino(X, B - 1, "#8e2a1f"); g.fino(X, B, X % 2 ? "#e8b94a" : "#5e1a14"); }
    },
  });

  // banca: 0 com mercadorias · 1 vazia (espaço reservado para uma loja futura)
  alt("es_banca", {
    w: 52, h: 46, quadros: 2, origem: [0.5, 1], estrutura: true,
    desenhar(g, v) {
      // em px de arte (X, Y): 1 px de arte = 1 px de mundo, como as árvores e os props
      const b = 44, toldo = 6, balcao = 31, B = 2 * b + 1, Tt = 2 * toldo, Bc = 2 * balcao;
      g.sombra(29, b + 0.5, 25, 2);
      // bloco em px com a luz de 1 px em cima e a sombra de 1 px embaixo
      const bloco = (X0, Y0, w, h, cor) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.fino(X0 + i, Y0 + j, j === 0 ? misturar(cor, "#ffffff", 0.3) : j === h - 1 ? misturar(cor, "#1c1210", 0.3) : cor); };
      // fundo de pano escuro entre os postes, com a trama diagonal de 1 px
      for (let Y = Tt + 18; Y < Bc; Y++) for (let X = 10; X <= 93; X++) g.fino(X, Y, (X + Y) % 9 === 0 ? "#4a3a30" : "#3a2c24");
      // prateleira dos fundos com jarros (mercadorias) ou panos dobrados (vazia)
      for (let X = 12; X <= 91; X++) { g.fino(X, Bc - 14, "#9a7048"); g.fino(X, Bc - 13, "#5e3c1c"); }
      if (v === 0) {
        for (const [x, cor] of [[9, "#b5663a"], [14, "#c8b070"], [19, "#8e4a2a"], [33, "#b5663a"], [38, "#d88a58"], [42, "#8e4a2a"]])
          elipU(g, x, balcao - 10, 2, 2.6, (nx, ny) => (nx + ny < -0.4 ? misturar(cor, "#ffffff", 0.25) : nx > 0.55 ? misturar(cor, "#1c1210", 0.25) : cor));
      } else {
        bloco(20, Bc - 20, 16, 6, "#c8b48a"); bloco(68, Bc - 18, 14, 4, "#a8916a");
      }
      // balcão de tábuas: tampo claro de 1 px, frente com as juntas de 1 px a cada 22 px e a beira esquerda na luz
      for (let Y = Bc; Y <= B; Y++) for (let X = 6; X <= 97; X++) {
        const j = Y - Bc;
        g.fino(X, Y, j === 0 ? "#e0c08a" : j < 3 ? "#c9a46a" : j === 3 ? "#a8844f" : (X - 6) % 22 === 0 ? "#5e4630" : (Y - Bc) % 7 === 0 ? "#6a4a2c" : X < 12 ? "#9a7048" : "#7a5530");
      }
      // mercadorias no balcão
      if (v === 0) {
        elipU(g, 11, balcao - 1, 3, 1.5, (nx, ny) => (ny < -0.3 ? "#f2cf6a" : "#e8b94a")); g.pf(10, balcao - 2, "#ffe08a");
        bloco(34, Bc - 6, 12, 6, "#8e2a1f");
        bloco(50, Bc - 4, 10, 4, "#55642c"); g.fino(52, Bc - 5, "#7a8a3f"); g.fino(53, Bc - 6, "#7a8a3f");
        for (let i = 0; i < 3; i++) elipU(g, 35 + i * 4, balcao - 2, 1.6, 1.6, (nx, ny) => (nx + ny < -0.5 ? "#f0c080" : i % 2 ? "#c2452d" : "#d9a35c"));
      } else {
        bloco(40, Bc - 4, 20, 4, "#d4bf8f");
      }
      // postes de 3 px e toldo listrado (listras de 8 px) com a bainha recortada em línguas
      for (const X of [8, 94]) for (let Y = Tt; Y <= B; Y++) { g.fino(X, Y, "#7a5a3c"); g.fino(X + 1, Y, "#5e4630"); g.fino(X + 2, Y, "#3e2c1e"); }
      const fimToldo = 2 * (toldo + 9) - 1;
      for (let Y = Tt; Y <= fimToldo; Y++)
        for (let X = 2; X <= 101; X++) {
          const k = (X - 2) % 8, r = Y - (fimToldo - 4);
          if (r >= 0 && Math.abs(k - 3.5) > 3.6 - r * 0.75) continue; // a ponta de cada listra arredonda
          const listra = Math.floor((X - 2) / 8) % 2 === 0;
          let cor = listra ? (v === 0 ? "#c2452d" : "#3b5a9a") : "#eadcb6";
          if (Y === Tt) cor = "#5e1a14";
          else if (Y === Tt + 2) cor = "#f3e4c0";
          else if (r >= 2 || Y === fimToldo) cor = misturar(cor, "#1c1210", 0.22);
          g.fino(X, Y, cor);
        }
    },
  });

  alt("es_poco", {
    w: 20, h: 28, quadros: 1, origem: [0.5, 1], estrutura: true,
    desenhar(g) {
      const b = 26;
      g.sombra(12, b, 9, 1.6);
      // cilindro de pedra em px de arte: fiadas de 5 px com a junta de 1 px, pedras de 9 px desencontradas,
      // aresta de luz no topo de cada pedra, lado esquerdo claro e direito na sombra
      for (let Y = 30; Y <= 2 * b + 1; Y++)
        for (let X = 4; X <= 35; X++) {
          const fila = Math.floor((Y - 30) / 6), off = fila % 2 ? 5 : 0, k = (Y - 30) % 6;
          let cor = X < 9 ? "#c8b898" : X > 30 ? "#7a6a54" : "#a8987a";
          if (k === 5 || (X + off) % 10 === 0) cor = "#6e604c";
          else if (k === 0) cor = X > 30 ? "#8a7a62" : X < 9 ? "#ddd0b4" : "#c8b898";
          g.fino(X, Y, cor);
        }
      // borda e água escura
      elipU(g, 9.5, 14.5, 8.5, 3, (nx, ny) => (ny < -0.45 ? "#e2d4b6" : nx > 0.7 ? "#b8a888" : "#d2c2a2"));
      elipU(g, 9.5, 14.5, 6, 1.8, (nx, ny) => (ny < -0.5 ? "#143a44" : "#1d4f5c"));
      g.pf(8, 14.5, "#4fa3a5"); g.pf(8.5, 14.5, "#4fa3a5"); g.pf(11, 15, "#2f7680");
      // armação (postes de 3 px), travessa, corda de 1 px e balde com o aro
      const poste = (X0) => { for (let Y = 6; Y <= 29; Y++) { g.fino(X0, Y, "#8a6a42"); g.fino(X0 + 1, Y, "#6b4a2e"); g.fino(X0 + 2, Y, "#4a3222"); } };
      poste(5); poste(31);
      for (let X = 4; X <= 35; X++) { g.fino(X, 4, "#a8844f"); g.fino(X, 5, "#8a6a42"); g.fino(X, 6, "#5e4630"); }
      g.linf(10, 3.5, 10, 9, "#c9a46a");
      g.retf(8.5, 9.5, 3.5, 2.5, (X, Y, i, j) => (j === 0 ? "#a8844f" : j === 4 ? "#5e4630" : i === 0 ? "#9a7048" : i === 6 ? "#5e4630" : j === 2 ? "#6b4a2e" : "#7a5530"));
    },
  });


  // Decoração plana das vilas (até 3 px-a de altura; vai em casa livre; posições em dados/mapas.js).
  // Desenhadas em px de arte (g.fino, g.retf, g.elip), como o resto do chão: 1 px de arte = 1 px de mundo.
  alt("dc_tapete", {
    w: 16, h: 16, contorno: null, origem: [0.5, 0.5],
    desenhar(g) {
      // tapete de lã: bainha escura, duas faixas douradas de 1 px, losango no meio e a franja nas pontas
      g.retf(2, 4, 12, 8, (X, Y, i, j) => {
        if (j === 0 || j === 15 || i === 0 || i === 23) return "#5e1a14";
        if (j === 2 || j === 13) return "#e8b94a";
        const d = Math.abs(i - 11.5) * 0.55 + Math.abs(j - 7.5);
        if (d > 2.6 && d < 3.6) return "#e8b94a";
        if (d <= 1.2) return "#3b5a9a";
        return (i * 3 + j) % 7 === 0 ? "#a8382a" : "#8e2a1f";
      });
      for (let X = 3; X < 28; X += 2) { g.fino(X, 7, "#e8b94a"); g.fino(X + 1, 24, "#c99a3a"); }
    },
  });
  alt("dc_esteira", {
    w: 16, h: 16, contorno: null, origem: [0.5, 0.5],
    desenhar(g) {
      // esteira de palha trançada: fios de 3 × 2 px que se alternam, beira escura e o rolo na ponta
      g.retf(2, 5, 12, 7, (X, Y, i, j) => {
        if (i === 0 || j === 0 || i === 23 || j === 13) return "#8a7040";
        const fio = (Math.floor(i / 3) + Math.floor(j / 2)) % 2;
        return fio ? (i % 3 === 0 ? "#b89c5c" : "#c8b070") : (j % 2 ? "#94783e" : "#a8904e");
      });
      elipU(g, 12, 4, 2.5, 1.6, (nx, ny) => (nx + ny < -0.5 ? "#a8844f" : "#8a6a42"));
      g.fino(24, 8, "#5e4630"); g.fino(25, 8, "#5e4630");
    },
  });
  alt("dc_rede", {
    w: 16, h: 16, contorno: null, origem: [0.5, 0.5],
    desenhar(g) {
      // rede de pesca estendida: malha diagonal de 1 px com os nós claros, borda solta, boias de cortiça e um peixe
      for (let Y = 5; Y < 27; Y++) for (let X = 3; X < 29; X++) {
        const nx = (X - 15.5) / 12.5, ny = (Y - 15.5) / 10.5;
        if (nx * nx + ny * ny > 0.92 + hash2(X >> 1, Y >> 1, 90) * 0.16) continue;
        const a = (X + Y) % 5 === 0, b = (X - Y + 60) % 5 === 0;
        if (a && b) g.fino(X, Y, "#e6cf9c"); else if (a || b) g.fino(X, Y, (X + Y * 3) % 7 ? "#b8a278" : "#9a8460");
      }
      for (const [X, Y] of [[6, 9], [24, 8], [7, 22], [24, 21]]) {
        g.fino(X, Y, "#c98a52"); g.fino(X + 1, Y, "#a66b39"); g.fino(X, Y + 1, "#a66b39"); g.fino(X + 1, Y + 1, "#6e4426");
      }
      // peixe: corpo de 6 px, barriga clara, olho e a cauda em leque
      for (let X = 19; X <= 22; X++) { g.fino(X, 17, "#7cc4c0"); g.fino(X, 19, "#2f7680"); }
      for (let X = 18; X <= 23; X++) g.fino(X, 18, "#4fa3a5");
      g.fino(19, 18, "#1c2a2a"); g.fino(24, 18, "#2f7680"); g.fino(25, 17, "#2f7680"); g.fino(25, 19, "#2f7680");
    },
  });
  alt("dc_fogo_apagado", {
    w: 16, h: 16, contorno: null, origem: [0.5, 0.5],
    desenhar(g) {
      // fogueira apagada: anel de 8 pedras (3 × 2 px, luz em cima), a cinza no meio e dois tições cruzados
      elipU(g, 8, 8.2, 3.4, 2, (nx, ny) => (nx * nx + ny * ny > 0.55 ? "#7a7068" : "#5a5048"));
      for (let a = 0; a < 8; a++) {
        const t = (a / 8) * Math.PI * 2, X = Math.round(15.5 + Math.cos(t) * 9.5) - 1, Y = Math.round(16 + Math.sin(t) * 6) - 1;
        const [luz, meio, sombra] = a % 2 ? ["#a39b8a", "#8a8070", "#5e564a"] : ["#bcb4a2", "#a39b8a", "#6e665a"];
        for (let i = 0; i < 3; i++) { g.fino(X + i, Y, luz); g.fino(X + i, Y + 1, i === 2 ? sombra : meio); }
      }
      g.linf(6.5, 7.2, 9.5, 8.7, "#2a1e18"); g.linf(6.5, 8.7, 9.5, 7.2, "#3a2c24");
      g.fino(16, 15, "#8a3a24"); g.fino(15, 16, "#5a2a1c");
    },
  });


  // -------------------------------------------------------------------
  // Rochas facetadas em px de arte: o contorno é um polígono irregular (7 a 10 lados sorteados em volta de uma
  // elipse, a base reta no chão) e cada lado vira uma face que sobe até o pico, um pouco à esquerda e acima do
  // meio. A luz de cada face (de cima e da esquerda) mistura a direção da face com o volume da pedra e cai em 4
  // tons; as cristas viradas para a luz ganham 1 px de realce e as dobras viradas para baixo, 1 px escuro.
  // Material: estratos (arenito), pintas (granito), musgo, colunas (basalto) e rachaduras. O contorno e a sombra
  // no chão (para a direita) completam a peça. tons: [sombra funda, sombra, base, luz, realce].
  // -------------------------------------------------------------------
  function rochaArte(g, cx, B, rx, ry, tons, sem, o = {}) {
    const N = o.lados || 8, angs = [], raios = [];
    for (let k = 0; k < N; k++) {
      angs.push(-Math.PI + ((k + 0.25 + hash2(k, sem, 1) * 0.5) * 2 * Math.PI) / N);
      raios.push(0.84 + hash2(k, sem, 2) * 0.24);
    }
    const setor = (a) => { let k = N - 1; for (let i = 0; i < N; i++) if (a >= angs[i]) k = i; return a < angs[0] ? N - 1 : k; };
    const raio = (a) => {
      const k = setor(a), k2 = (k + 1) % N;
      let a0 = angs[k], a1 = angs[k2];
      if (a1 <= a0) a1 += 2 * Math.PI;
      let aa = a; if (aa < a0) aa += 2 * Math.PI;
      const t = (aa - a0) / (a1 - a0);
      // lado reto entre dois vértices: raio do polígono na direção a (aproximação pela corda)
      const r0 = raios[k], r1 = raios[k2], meio = Math.cos(((a1 - a0) / 2));
      return ((r0 * (1 - t) + r1 * t) * meio) / Math.cos(aa - (a0 + a1) / 2);
    };
    const cy = B - ry * (o.alto || 0.92), pkx = -0.22, pky = -0.42;
    const W = g.w, H = g.h, mapa = new Int8Array(W * H).fill(-1), face = new Int8Array(W * H).fill(-1);
    const nxy = (X, Y) => [(X + 0.5 - cx) / rx, (Y + 0.5 - cy) / ry];
    for (let Y = Math.max(0, Math.floor(cy - ry * 1.2)); Y <= Math.min(H - 1, B); Y++)
      for (let X = Math.max(0, Math.floor(cx - rx * 1.2)); X <= Math.min(W - 1, Math.ceil(cx + rx * 1.2)); X++) {
        const [nx, ny] = nxy(X, Y), d = Math.hypot(nx, ny);
        if (d > raio(Math.atan2(ny, nx))) continue;
        const k = setor(Math.atan2(ny - pky, nx - pkx)), am = (angs[k] + angs[(k + 1) % N] + (k === N - 1 ? 2 * Math.PI : 0)) / 2;
        const fb = -(0.62 * Math.cos(am) + 0.78 * Math.sin(am)), sb = -(0.6 * nx + 0.8 * ny) * 0.8 + (1 - d) * 0.35;
        const l = 0.5 * fb + 0.5 * sb + (o.luz || 0) - (ny > 0.55 ? 0.25 : 0);
        let tom = l > 0.42 ? 3 : l > 0.02 ? 2 : l > -0.42 ? 1 : 0;
        if (ny < -0.4 && l > -0.35) tom = Math.max(tom, 3); // o plano de cima, sempre na luz
        mapa[Y * W + X] = tom;
        face[Y * W + X] = k;
      }
    const em = (X, Y) => (X < 0 || Y < 0 || X >= W || Y >= H ? -1 : mapa[Y * W + X]);
    const fc = (X, Y) => (X < 0 || Y < 0 || X >= W || Y >= H ? -1 : face[Y * W + X]);
    const t = mapa.slice();
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const v = em(X, Y);
      if (v < 0) continue;
      const i = Y * W + X, [nx, ny] = nxy(X, Y);
      // material
      if (o.estratos && ny > -0.5 && (Y + Math.round(nx * 2)) % 4 === 0) t[i] = Math.max(0, v - 1);
      if (o.colunas && ny > -0.35 && (X + (Y >> 3)) % 4 === 0) t[i] = Math.max(0, v - 1);
      if (o.pintas && hash2(X, Y, sem + 3) < 0.1) t[i] = hash2(X, Y, sem + 4) < 0.5 ? Math.max(0, v - 1) : Math.min(4, v + 1);
      // cristas e dobras entre faces (só na metade de cima, onde se vê o volume)
      const kR = fc(X + 1, Y), kB = fc(X, Y + 1);
      if (ny < 0.35 && ((kR >= 0 && kR !== face[i]) || (kB >= 0 && kB !== face[i]))) {
        const outro = kR >= 0 && kR !== face[i] ? em(X + 1, Y) : em(X, Y + 1);
        t[i] = v >= 2 && outro >= 2 ? 4 : Math.max(0, Math.min(v, outro) - 1);
      }
      // silhueta: realce em cima e à esquerda, sombra funda embaixo e à direita
      if (em(X, Y - 1) < 0 && v >= 2) t[i] = 4;
      else if (em(X - 1, Y) < 0 && v >= 2 && ny < 0.3) t[i] = Math.max(t[i], 3);
      else if (em(X + 1, Y) < 0 || em(X, Y + 1) < 0) t[i] = Math.min(t[i], 0);
      if (o.musgo && ny < -0.25 && v >= 2 && hash2(X >> 1, Y >> 1, sem + 5) < 0.42) t[i] = 5 + (hash2(X, Y, sem + 6) < 0.5 ? 0 : 1);
    }
    // rachaduras: passeios curtos de 1 px na face de sombra
    for (let r = 0; r < (o.rachas ?? 2); r++) {
      let X = Math.round(cx + rx * (0.1 + hash2(r, sem, 7) * 0.5)), Y = Math.round(cy - ry * 0.2 + hash2(sem, r, 8) * ry * 0.6);
      for (let n = 0; n < 4 + Math.floor(hash2(r, sem, 9) * 4); n++) {
        if (em(X, Y) >= 1 && em(X + 1, Y) >= 0 && em(X, Y + 1) >= 0) t[Y * W + X] = 0;
        Y += 1; X += hash2(n, r, sem + 10) < 0.5 ? 1 : 0;
      }
    }
    const musgo = o.corMusgo || ["#4a5a2a", "#6e8a3a"];
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const v = t[Y * W + X];
      if (mapa[Y * W + X] < 0) continue;
      g.fino(X, Y, v >= 5 ? musgo[v - 5] : tons[v]);
    }
  }
  // Pedra de uma casa (baixa): 1 ou 2 blocos e a sombra para a direita.
  function pedregulho(chave, variantes, tons, sem0, o = {}) {
    return obstaculo(chave, false, variantes, (g, v) => {
      const sem = sem0 + v * 31, B = 31;
      const [rx, ry, cx] = (o.formas || [[13, 10, 18], [11, 8, 16], [14, 12, 18]])[v % 3];
      g.sombra((cx + 4) / 2, B / 2, rx / 2 + 1.5, 1.6, "#1c1210", 0.32);
      if (o.antes) o.antes(g, v, B);
      if (o.dupla && v === 1) rochaArte(g, cx + rx - 1, B, rx * 0.45, ry * 0.5, tons, sem + 7, { ...o, rachas: 0, lados: 7 });
      rochaArte(g, cx, B, rx, ry, tons, sem, o);
      if (o.dupla && v !== 1) rochaArte(g, cx - rx * 0.55, B + 1, rx * 0.42, ry * 0.45, tons, sem + 9, { ...o, rachas: 0, lados: 7, musgo: false });
    });
  }
  // Arbusto de uma casa (bloqueia): galhos curtos no pé e a copa baixa em cachos (Copa, os mesmos 5 tons e o
  // contorno escuro das árvores), sombra para a direita. o.seco: cachos ralos com os galhos à mostra;
  // o.flores: [cor, luz] dos pontinhos de flor.
  function arbustoOb(chave, variantes, tons, sem0, o = {}) {
    const d = obstaculo(chave, false, variantes, (g, v) => {
      const sem = sem0 + v * 37, B = 31, W = g.w, cx = W / 2 + (v - 1);
      g.sombra(cx / 2 + 2.5, B / 2, 8, 1.7, "#1c1210", 0.3);
      const casca = o.casca || CASCA_ACACIA;
      for (let k = 0; k < 5; k++) galhoArte(g, cx + (k - 2), B, cx + (k - 2) * 4, B - 9 - (k % 2) * 4, casca, false);
      const C = new Copa(W, B + 1);
      const molde = [[cx - 7, B - 11, 7, 6], [cx + 6, B - 12, 7, 6], [cx, B - 17, 8, 6], [cx - 4, B - 6, 7, 4.5], [cx + 5, B - 6, 6, 4]];
      moldeCopa(C, o.seco ? molde.filter((_, i) => hash2(i, v, sem) > 0.35) : molde, v, sem, { topo: B - 23, base: B, lobos: 7, jitter: 4 });
      if (o.seco) for (let k = 0; k < 4; k++) galhoArte(g, cx + (k - 1.5) * 3, B - 8, cx + (k - 1.5) * 9, B - 22 + (k % 2) * 3, casca, false);
      C.pintar(g, tons, sem, 0.5);
      if (o.flores) for (let k = 0; k < 12; k++) {
        const X = 4 + Math.floor(hash2(k, v, sem + 20) * (W - 8)), Y = B - 24 + Math.floor(hash2(v, k, sem + 21) * 18);
        if (C.get(X, Y) >= 2) { g.fino(X, Y, o.flores[0]); if (k % 2) g.fino(X, Y - 1, o.flores[1]); }
      }
    });
    d.contorno = "#1c2414";
    return d;
  }
  // Retama (giesta do deserto): moita de varas finas que sobem em leque, verde-acinzentadas, com as pontas claras,
  // folhinhas em grupos de 2 px e flores amarelas.
  function retamaOb(chave, variantes, sem0) {
    const d = obstaculo(chave, false, variantes, (g, v) => {
      const sem = sem0 + v * 41, B = 31, cx = g.w / 2 + (v - 1);
      const c = ["#3e3e20", "#5e5e30", "#7e7e44", "#a0a060"];
      g.sombra(cx / 2 + 2, B / 2, 7, 1.5, "#1c1210", 0.3);
      const n = 13 + v * 2;
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.1 + (hash2(k, v, sem) - 0.5) * 0.25;
        const L = 13 + Math.floor(hash2(v, k, sem + 1) * 9) - Math.abs(k / (n - 1) - 0.5) * 8;
        const x0 = cx + Math.round((k / (n - 1) - 0.5) * 6), X1 = x0 + Math.cos(a) * L, Y1 = B + Math.sin(a) * L;
        linhaPx(g, x0, B, X1, Y1, (X, Y, i) => (i < 3 ? c[0] : i > L - 3 ? c[3] : k % 2 ? c[1] : c[2]));
        for (let q = 4; q < L - 2; q += 4) {
          const X = Math.round(x0 + Math.cos(a) * q), Y = Math.round(B + Math.sin(a) * q), lado = k < n / 2 ? -1 : 1;
          g.fino(X + lado, Y, c[2]); g.fino(X + lado * 2, Y - 1, c[3]);
        }
        if (hash2(k, v, sem + 2) < 0.4) { g.fino(Math.round(X1), Math.round(Y1) - 1, "#e8d468"); g.fino(Math.round(X1) + 1, Math.round(Y1), "#b89a3a"); }
      }
    });
    d.contorno = "#2a2a16";
    return d;
  }
  // Coral morto na praia do Mar Vermelho: galhos grossos que se bifurcam (3, 2 e 1 px), com as pontas claras e os
  // pólipos em pontinhos, sobre uma laje de pedra.
  function coralOb(chave, variantes, sem0) {
    return obstaculo(chave, false, variantes, (g, v) => {
      const sem = sem0 + v * 43, B = 31, cx = g.w / 2 + (v - 1) * 2;
      const c = ["#5a1e1a", "#8a3a30", "#b8584a", "#d8806a", "#f2ae90"];
      g.sombra(cx / 2 + 2, B / 2, 8, 1.6, "#1c1210", 0.32);
      rochaArte(g, cx, B, 9, 3, ["#4a3a30", "#6a5446", "#8a705c", "#a88c74", "#c4a88e"], sem + 5, { lados: 7, rachas: 0 });
      const galho = (X, Y, ang, L, larg, prof) => {
        const X1 = X + Math.cos(ang) * L, Y1 = Y + Math.sin(ang) * L;
        for (let w = 0; w < larg; w++) linhaPx(g, X + w, Y, X1 + w, Y1, (x, y, i) => (w === 0 ? c[Math.min(4, 2 + prof)] : w === larg - 1 ? c[Math.max(0, prof)] : c[1 + Math.min(2, prof)]));
        if (prof >= 2 || L < 4) { g.fino(Math.round(X1), Math.round(Y1) - 1, c[4]); return; }
        const abre = 0.45 + hash2(prof, Math.round(X), sem) * 0.35;
        galho(X1, Y1, ang - abre, L * 0.72, Math.max(1, larg - 1), prof + 1);
        galho(X1, Y1, ang + abre, L * 0.66, Math.max(1, larg - 1), prof + 1);
      };
      galho(cx - 4, B - 4, -Math.PI / 2 - 0.5, 9 + v, 3, 0);
      galho(cx + 2, B - 4, -Math.PI / 2 + 0.35, 10, 3, 0);
      if (v !== 1) galho(cx - 1, B - 5, -Math.PI / 2 - 0.05, 7, 2, 1);
    });
  }

  // -------------------------------------------------------------------
  // Vegetação em escala de MMORPG clássico: a árvore é maior que a casa. A copa transborda para cima (a
  // árvore tem 56–68 px de altura, quase 2 casas) e um pouco para os lados; o tronco fica na casa que bloqueia,
  // com a base na linha b (a colisão não muda). Desenho em px de arte: a copa é feita de cachos de folhas
  // (bolhas recortadas em lobos) sombreados um a um em 5 tons (sombra funda → realce, luz de cima e da
  // esquerda); onde um cacho cai sobre outro, a borda escurece e separa os cachos; as marcas de folha vêm em
  // grupos de 2 px (nada de ruído de TV); contorno escuro de 1 px e a sombra no chão para a direita.
  // 3 variantes por espécie (quadros); game.js sorteia a variante, o espelho e um deslocamento por casa.
  // -------------------------------------------------------------------
  class Copa {
    constructor(W, H) { this.W = W; this.H = H; this.t = new Int8Array(W * H).fill(-1); }
    get(X, Y) { return X < 0 || Y < 0 || X >= this.W || Y >= this.H ? -1 : this.t[Y * this.W + X]; }
    set(X, Y, v) { if (X >= 0 && Y >= 0 && X < this.W && Y < this.H) this.t[Y * this.W + X] = v; }
    // Cacho de folhas: centro e raios em px de arte; luz: viés do cacho (+ mais claro); lobos: recortes da borda.
    cacho(cx, cy, rx, ry, sem, luz = 0, lobos = 6) {
      const fase = hash2(Math.round(cx), Math.round(cy), sem) * 6.283;
      const x0 = Math.floor(cx - rx - 3), x1 = Math.ceil(cx + rx + 3), y0 = Math.floor(cy - ry - 3), y1 = Math.ceil(cy + ry + 3);
      const novo = [];
      for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
        const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry, d = Math.sqrt(nx * nx + ny * ny);
        const lim = 1 + 0.11 * Math.sin(Math.atan2(ny, nx) * lobos + fase) + (hash2(X >> 1, Y >> 1, sem + 1) - 0.5) * 0.14;
        if (d <= lim) {
          const l = -(0.55 * nx + 0.8 * ny) * 0.7 + luz + (1 - d) * 0.2;
          novo.push(X, Y, l > 0.6 ? 4 : l > 0.22 ? 3 : l > -0.16 ? 2 : l > -0.52 ? 1 : 0);
        } else if (d <= lim + 1.2 / Math.min(rx, ry) && ny < 0.2 && this.get(X, Y) >= 0 && hash2(X >> 1, Y, sem + 2) < 0.7) novo.push(X, Y, -2); // fresta entre cachos
      }
      for (let i = 0; i < novo.length; i += 3) {
        const X = novo[i], Y = novo[i + 1], v = novo[i + 2];
        this.set(X, Y, v === -2 ? Math.max(0, Math.min(this.get(X, Y) - 1, 1)) : v);
      }
    }
    // Pinta na grade com os 5 tons; marcas de folha: grupos de 2 px um tom abaixo e brilhos de 1 px um tom acima.
    // Folhas: numa grade de 4 × 3 px (deslocada a cada fileira), cada folha é um traço de 2 px um tom acima com
    // 1 px um tom abaixo logo embaixo (a sombra da folha); marcas: chance de folha por célula.
    pintar(g, tons, sem, marcas = 0.5) {
      const W = this.W, t = this.t, orig = t.slice();
      const o = (X, Y) => (X < 0 || Y < 0 || X >= W || Y >= this.H ? -1 : orig[Y * W + X]);
      for (let Y = 1; Y < this.H - 1; Y += 3) for (let X = ((Y / 3) | 0) % 2 ? 2 : 0; X < W - 1; X += 4) {
        const h = hash2(X, Y, sem + 7);
        if (h > marcas) continue;
        const x = X + (h < marcas * 0.5 ? 1 : 0), v = o(x, Y);
        if (v < 1 || o(x + 1, Y) < 1 || o(x, Y + 1) < 0 || o(x, Y - 1) < 0) continue;
        if (v < 4) { t[Y * W + x] = v + 1; if (hash2(x, Y, sem + 8) < 0.6) t[Y * W + x + 1] = Math.min(4, o(x + 1, Y) + 1); }
        t[(Y + 1) * W + x] = Math.max(0, o(x, Y + 1) - 1);
      }
      for (let Y = 0; Y < this.H; Y++) for (let X = 0; X < W; X++) { const v = t[Y * W + X]; if (v >= 0) g.fino(X, Y, tons[v]); }
    }
    tem(X, Y) { return this.get(X, Y) >= 0; }
  }
  // Linha de 1 px de arte (Bresenham) em px de arte.
  function linhaPx(g, X0, Y0, X1, Y1, c) {
    X0 = Math.round(X0); Y0 = Math.round(Y0); X1 = Math.round(X1); Y1 = Math.round(Y1);
    const dX = Math.abs(X1 - X0), dY = -Math.abs(Y1 - Y0), sX = X0 < X1 ? 1 : -1, sY = Y0 < Y1 ? 1 : -1;
    let e = dX + dY, i = 0;
    for (;;) {
      g.fino(X0, Y0, typeof c === "function" ? c(X0, Y0, i++) : c);
      if (X0 === X1 && Y0 === Y1) break;
      const e2 = 2 * e;
      if (e2 >= dY) { e += dY; X0 += sX; }
      if (e2 <= dX) { e += dX; Y0 += sY; }
    }
  }
  // Tronco em px de arte, da base (x0, yb) ao topo (x1, yt): afina para cima, abre a raiz no chão; casca com
  // luz à esquerda, sombra à direita e estrias. cores: [sombra funda, sombra, base, luz]. torto: curva em px.
  function troncoArte(g, x0, yb, x1, yt, larg, cores, sem, torto = 0, afina = 0.4) {
    for (let Y = yt; Y <= yb; Y++) {
      const t = (yb - Y) / Math.max(1, yb - yt);
      const cx = x0 + (x1 - x0) * t + Math.sin(t * 3.4 + sem) * torto * t;
      let w = larg * (1 - t * afina);
      if (Y > yb - 4) w += (Y - (yb - 4)) * 1.3; // raiz que abre no chão
      const a = Math.round(cx - w / 2), b = Math.max(a + 1, Math.round(cx + w / 2) - 1), n = b - a;
      for (let X = a; X <= b; X++) {
        const i = X - a;
        let c = i === 0 ? cores[3] : i === n ? cores[0] : i >= n - 1 ? cores[1] : cores[2];
        if (i > 0 && i < n - 1 && hash2(X, Y >> 1, sem) < 0.16) c = cores[1];
        else if (i === 1 && hash2(X, Y, sem + 1) < 0.4) c = cores[3];
        g.fino(X, Y, c);
      }
    }
  }
  // Galho de 2 px: luz em cima, sombra embaixo.
  function galhoArte(g, X0, Y0, X1, Y1, cores, grosso = true) {
    linhaPx(g, X0, Y0, X1, Y1, cores[2]);
    if (grosso) linhaPx(g, X0 + 1, Y0 + 1, X1 + 1, Y1 + 1, cores[1]);
  }
  // Cachos de uma copa a partir de um molde [[x, y, rx, ry], ...], com variação por variante e a luz
  // maior em cima e à esquerda. Os de cima pintam primeiro; os de baixo ficam por cima (frente da copa).
  function moldeCopa(C, molde, v, sem, { luz = 0.18, jitter = 3, W = C.W, topo = 0, base = C.H, lobos = 6 } = {}) {
    const cachos = molde.map(([x, y, rx, ry], i) => [
      x + (hash2(i, v, sem) - 0.5) * jitter, y + (hash2(v, i, sem + 1) - 0.5) * jitter * 0.7,
      rx * (0.9 + hash2(i, v, sem + 2) * 0.2), ry * (0.9 + hash2(i, v, sem + 3) * 0.2),
    ]).sort((a, b) => a[1] - b[1]);
    cachos.forEach(([x, y, rx, ry], i) => {
      const l = luz - ((y - topo) / Math.max(1, base - topo)) * 0.42 - ((x - W / 2) / W) * 0.28;
      C.cacho(x, y, rx, ry, sem + i * 13, l, lobos);
    });
  }
  function arvore(chave, w, h, desenhar, contorno = "#1c2414") {
    return alt(chave, {
      w, h, quadros: 3, alto: true, obstaculo: true, arvore: true, origem: [0.5, 1], contorno,
      desenhar(g, v) { desenhar(g, v, (h - 2) * 2, w * 2); },
    });
  }
  const CASCA_OLIVEIRA = ["#2a241e", "#463c32", "#665a4a", "#8a7e68"];
  const CASCA_FIGUEIRA = ["#2e2a26", "#4a443e", "#6a6258", "#8c8476"];
  const CASCA_ACACIA = ["#2a1e16", "#4a3424", "#6a4c32", "#8c6a46"];
  const CASCA_PALMEIRA = ["#3a2a1c", "#5a4228", "#7c5c38", "#a07c4e"];

  // Canaã
  // Oliveira: dois troncos cinzentos que se enroscam e abrem em galhos, copa aberta e prateada (cachos soltos,
  // com frestas onde aparecem os galhos), o avesso prateado das folhas e azeitonas.
  const MOLDE_OLIVEIRA = [
    [[20, 12, 10, 7], [35, 10, 10, 7], [10, 22, 8, 7], [46, 21, 8, 7], [22, 26, 10, 7], [37, 27, 10, 7], [28, 18, 9, 7]],
    [[16, 13, 9, 7], [30, 9, 10, 7], [43, 15, 9, 7], [9, 25, 8, 6], [24, 25, 10, 8], [41, 28, 10, 7], [33, 19, 8, 6]],
    [[24, 10, 11, 8], [40, 14, 9, 7], [12, 18, 8, 7], [17, 29, 9, 6], [31, 25, 11, 8], [46, 27, 7, 6]],
  ];
  arvore("ob_canaan_oliveira", 28, 31, (g, v, B, W) => {
    const cx = W / 2, sem = 310 + v * 17;
    g.sombra(cx / 2 + 3, B / 2 - 0.5, 12, 2.8);
    troncoArte(g, cx - 2, B, cx - 6 + v * 3, B - 24, 6, CASCA_OLIVEIRA, sem, 2.2);
    troncoArte(g, cx + 2, B - 2, cx + 5 - v, B - 22, 5, CASCA_OLIVEIRA, sem + 3, -1.8);
    galhoArte(g, cx - 6 + v * 3, B - 24, cx - 16, B - 32, CASCA_OLIVEIRA);
    galhoArte(g, cx + 5 - v, B - 22, cx + 16, B - 30, CASCA_OLIVEIRA);
    galhoArte(g, cx - 2, B - 26, cx + 1, B - 40, CASCA_OLIVEIRA);
    const C = new Copa(W, B);
    moldeCopa(C, MOLDE_OLIVEIRA[v], v, sem, { topo: 2, base: 36 });
    C.pintar(g, ["#28331f", "#3f4e30", "#5a6a42", "#7a8a5c", "#a2ae84"], sem);
    for (let k = 0; k < 22; k++) {
      const X = 4 + Math.floor(hash2(k, v, sem + 20) * (W - 8)), Y = 3 + Math.floor(hash2(v, k, sem + 21) * 32);
      if (C.get(X, Y) >= 2 && C.get(X + 1, Y) >= 2) { g.fino(X, Y, "#b8c094"); if (k % 3 === 0) g.fino(X + 1, Y, "#cdd2ac"); }
    }
    for (let k = 0; k < 7; k++) {
      const X = 6 + Math.floor(hash2(k, v, sem + 22) * (W - 12)), Y = 8 + Math.floor(hash2(v, k, sem + 23) * 26);
      if (C.get(X, Y) >= 1 && C.get(X, Y + 1) >= 1) { g.fino(X, Y, "#4a3c58"); g.fino(X, Y + 1, "#2a2034"); }
    }
  });
  // mureta de pedra seca solta (a emendada vem de Cenario.texturaMuro), em px de arte: 3 fiadas de 7 px com a junta
  // de 1 px, pedras de 6 a 10 px desencontradas (a fiada do meio começa com meia pedra), luz em cima e à esquerda
  obstaculo("ob_canaan_muro", false, 2, (g, v, b) => {
    g.sombra(10, b, 8, 1.3);
    const P = ["#6e5a40", "#9c8460", "#c2ab82", "#d8c8a0"], X1 = 33;
    for (let fila = 0; fila < 3; fila++) {
      const Y0 = 2 * (b - 11) + fila * 8;
      let X = 2, primeira = (fila + v) % 2 === 1;
      while (X <= X1) {
        const w = Math.min(X1 + 1 - X, primeira ? 3 + Math.floor(hash2(X, fila, 42 + v) * 3) : 6 + Math.floor(hash2(X, fila, 40 + v) * 5));
        primeira = false;
        for (let j = 0; j < 7; j++) for (let i = 0; i < w; i++) g.fino(X + i, Y0 + j, j === 0 ? P[3] : j === 6 || i === w - 1 ? P[1] : i === 0 ? P[3] : P[2]);
        for (let j = 0; j < 7; j++) g.fino(X + w, Y0 + j, P[0]);
        X += w + 1;
      }
      for (let X = 2; X <= X1; X++) g.fino(X, Y0 + 7, P[0]);
    }
    // musgo de 1 a 2 px no alto da mureta
    for (let X = 2; X <= X1; X++) if (hash2(X, v, 41) < 0.3) { g.fino(X, 2 * (b - 11) - 1, "#6e8a3a"); if (hash2(v, X, 43) < 0.4) g.fino(X, 2 * (b - 11) - 2, "#8fa84c"); }
  });
  pedregulho("ob_canaan_rocha", 3, ["#3e3a32", "#5e584c", "#857e6c", "#aaa28e", "#cec6b0"], 50, { musgo: true, dupla: true });

  // Deserto
  pedregulho("ob_deserto_rocha", 3, ["#5a3020", "#86482c", "#b0663c", "#d08a56", "#eab47e"], 60, { estratos: true, dupla: true });
  // Acácia: tronco fino que se abre em três galhos até a copa chata em guarda-chuva (cachos achatados, 8
  // lobos), com as bolinhas amarelas das flores. No Sinai a copa é mais rala e mais seca.
  const MOLDE_ACACIA = [
    [[13, 12, 8, 5], [24, 9, 9, 5], [36, 9, 9, 5], [47, 12, 8, 5], [8, 18, 7, 4], [19, 17, 9, 5], [31, 16, 9, 5], [42, 17, 9, 5], [52, 18, 6, 4]],
    [[16, 10, 9, 5], [29, 8, 10, 5], [42, 11, 9, 5], [10, 17, 8, 4], [23, 16, 10, 5], [37, 17, 9, 5], [50, 16, 7, 4]],
    [[11, 14, 8, 5], [22, 10, 9, 5], [35, 11, 9, 5], [48, 15, 8, 5], [16, 19, 9, 4], [29, 18, 10, 5], [42, 19, 9, 4]],
  ];
  function acacia(chave, tons, sem0, rala) {
    arvore(chave, 30, 28, (g, v, B, W) => {
      const cx = W / 2, sem = sem0 + v * 23;
      g.sombra(cx / 2 + 3, B / 2 - 0.5, 13, 2.6);
      const fx = cx + (v - 1) * 2, fy = B - 14;
      troncoArte(g, cx, B, fx, fy, 5, CASCA_ACACIA, sem, 1, 0.2);
      galhoArte(g, fx, fy, 14 + v, 20, CASCA_ACACIA);
      galhoArte(g, fx, fy, cx + 1, 15, CASCA_ACACIA);
      galhoArte(g, fx + 1, fy, 46 - v, 20, CASCA_ACACIA);
      galhoArte(g, fx - 6, fy - 4, 6 + v, 18, CASCA_ACACIA, false);
      const C = new Copa(W, B);
      const molde = rala ? MOLDE_ACACIA[v].filter((_, i) => hash2(i, v, sem) > 0.25) : MOLDE_ACACIA[v];
      moldeCopa(C, molde, v, sem, { topo: 4, base: 24, lobos: 8, luz: 0.22 });
      C.pintar(g, tons, sem, 0.4);
      for (let k = 0; k < 12; k++) {
        const X = 4 + Math.floor(hash2(k, v, sem + 30) * (W - 8)), Y = 4 + Math.floor(hash2(v, k, sem + 31) * 18);
        if (C.get(X, Y) >= 2) g.fino(X, Y, "#e2d27a");
      }
    });
  }
  acacia("ob_deserto_acacia", ["#30381a", "#4c5426", "#687034", "#888e44", "#aaa862"], 380, false);
  retamaOb("ob_deserto_retama", 3, 80);
  pedregulho("ob_mar_rochedo", 2, ["#3a322c", "#54483e", "#74644e", "#9a8664", "#bca884"], 90, { antes: (g) => elipU(g, 9.5, 15, 8.5, 1.8, "#e8f2e0") });
  // Tamareira: tronco alto com as cicatrizes das folhas em escamas (em V, luz à esquerda), coroa de folhas
  // compridas que caem com o peso (folíolos dos dois lados da nervura: claros em cima, escuros embaixo) e
  // cachos de tâmaras debaixo da coroa.
  arvore("ob_egito_tamareira", 26, 34, (g, v, B, W) => {
    const cx = W / 2, sem = 420 + v * 29;
    g.sombra(cx / 2 + 3, B / 2 - 0.5, 9, 2.4);
    const tx = cx + (v - 1) * 4, ty = 20 + v;
    for (let Y = ty; Y <= B; Y++) {
      const t = (B - Y) / (B - ty), xc = cx + (tx - cx) * t * t;
      const w = 6 - t * 1.5 + (Y > B - 3 ? (Y - (B - 3)) * 1.2 : 0);
      const a = Math.round(xc - w / 2), b = Math.round(xc + w / 2) - 1;
      for (let X = a; X <= b; X++) {
        const i = X - a, n = b - a, faixa = (Y + Math.abs(X + 0.5 - xc) * 0.9 | 0) % 4;
        let c = faixa === 0 ? CASCA_PALMEIRA[1] : faixa === 1 ? CASCA_PALMEIRA[3] : CASCA_PALMEIRA[2];
        if (i === n) c = CASCA_PALMEIRA[0]; else if (i === n - 1 && faixa !== 1) c = CASCA_PALMEIRA[1];
        else if (i === 0 && faixa !== 0) c = CASCA_PALMEIRA[3];
        g.fino(X, Y, c);
      }
    }
    const tons = ["#1e3418", "#2e4c20", "#44682a", "#5e8636", "#82a64c"];
    // [ângulo em graus (0 = direita, −90 = para cima), comprimento, plano: 0 atrás … 2 na frente]. Cada folha é
    // uma faixa curva: a nervura em cima (clara) e os folíolos pendurados embaixo, mais compridos no meio, com a
    // borda de baixo serrilhada e escura.
    const folhas = [[-120, 14, 0], [-60, 14, 0], [-92, 11, 0], [-140, 18, 1], [-40, 18, 1], [-165, 21, 1], [-15, 21, 1], [172, 23, 2], [8, 23, 2], [138, 18, 2], [42, 18, 2], [100, 12, 2]];
    for (const [ang0, L0, plano] of folhas) {
      const ang = ((ang0 + (hash2(ang0 + 200, v, sem) - 0.5) * 16) * Math.PI) / 180, L = L0 + (hash2(v, ang0 + 200, sem + 1) - 0.5) * 4;
      const dx = Math.cos(ang), dy = Math.sin(ang), b = plano + 1;
      for (let k = 1; k <= L; k++) {
        const t = k / L, X = Math.round(tx + dx * k), Y = Math.round(ty + dy * k * 0.8 + t * t * L * 0.55);
        const w = Math.max(1, Math.round(Math.sin(Math.min(1, t * 1.15) * Math.PI) * 4.6 + 0.6) - (k % 3 === 2 ? 1 : 0));
        for (let q = 0; q <= w; q++) g.fino(X, Y + q, q === 0 ? tons[Math.min(4, b + 1)] : q === w ? tons[Math.max(0, b - 1)] : tons[b]);
      }
    }
    for (const [ox, oy] of [[-4, 3], [3, 4], [-1, 5]]) for (let k = 0; k < 6; k++) g.fino(tx + ox + (k % 3) - 1, ty + oy + ((k / 3) | 0), k === 0 ? "#e8a050" : k % 2 ? "#a8521e" : "#d07a32");
    g.fino(tx, ty, tons[0]); g.fino(tx - 1, ty, tons[1]); g.fino(tx + 1, ty, tons[1]);
  });
  pedregulho("ob_marVermelho_granito", 3, ["#4a1e18", "#74302a", "#9e4a3a", "#c46e56", "#e0987a"], 70, { pintas: true, lados: 7 });
  coralOb("ob_marVermelho_coral", 3, 95);
  pedregulho("ob_sinai_penedo", 3, ["#36282a", "#5a423c", "#7e5e4e", "#a27c64", "#c49e82"], 120, { pintas: true, dupla: true, formas: [[15, 12, 18], [13, 10, 17], [15, 13, 18]] });
  arbustoOb("ob_sinai_arbusto", 3, ["#24261a", "#3c3e26", "#565834", "#727244", "#908e5a"], 130, { seco: true });
  acacia("ob_sinai_acacia", ["#2e3018", "#484a24", "#626430", "#7e7e40", "#9c9858"], 400, true);
  // Galileia
  // Figueira: tronco curto e grosso de casca lisa e cinzenta, copa larga e fechada em cachos grandes (folhas
  // largas, verde-escuro) e figos maduros.
  const MOLDE_FIGUEIRA = [
    [[18, 11, 11, 8], [32, 8, 11, 8], [45, 12, 10, 8], [9, 23, 9, 8], [23, 22, 11, 9], [38, 22, 11, 9], [51, 24, 8, 8], [17, 34, 10, 7], [31, 35, 11, 7], [45, 34, 10, 7]],
    [[22, 9, 12, 8], [40, 10, 11, 8], [11, 20, 9, 8], [28, 21, 12, 9], [47, 22, 10, 8], [15, 33, 10, 7], [32, 34, 12, 7], [48, 33, 8, 7]],
    [[26, 8, 11, 8], [41, 13, 10, 8], [13, 15, 9, 8], [20, 26, 11, 9], [36, 25, 12, 9], [52, 27, 7, 7], [10, 34, 8, 6], [27, 36, 11, 7], [43, 36, 10, 6]],
  ];
  arvore("ob_galileia_figueira", 30, 32, (g, v, B, W) => {
    const cx = W / 2, sem = 350 + v * 19;
    g.sombra(cx / 2 + 3, B / 2 - 0.5, 13, 3);
    troncoArte(g, cx, B, cx - 1 + v, B - 20, 9, CASCA_FIGUEIRA, sem, 1, 0.3);
    galhoArte(g, cx - 2, B - 16, cx - 12, B - 24, CASCA_FIGUEIRA);
    galhoArte(g, cx + 2, B - 15, cx + 13, B - 23, CASCA_FIGUEIRA);
    const C = new Copa(W, B);
    moldeCopa(C, MOLDE_FIGUEIRA[v], v, sem, { topo: 0, base: 42, lobos: 5 });
    C.pintar(g, ["#16301a", "#244a24", "#356630", "#4c843e", "#6ea456"], sem, 0.55);
    for (let k = 0; k < 9; k++) {
      const X = 5 + Math.floor(hash2(k, v, sem + 22) * (W - 10)), Y = 6 + Math.floor(hash2(v, k, sem + 23) * 34);
      if (C.get(X, Y) >= 1 && C.get(X + 1, Y + 1) >= 1) { g.fino(X, Y, "#8a5a8a"); g.fino(X + 1, Y, "#6a3a6a"); g.fino(X, Y + 1, "#5a2e5a"); g.fino(X + 1, Y + 1, "#3e1e40"); }
    }
  });
  pedregulho("ob_galileia_basalto", 3, ["#1a1a1c", "#2c2c2e", "#424240", "#5e5c58", "#807c74"], 170, { colunas: true, lados: 7 });

  // -------------------------------------------------------------------
  // Props das vilas (marcos de dados/mapas.js): barril, caixotes, carroça, jarros, lenha, cocho e cerca. Um
  // desenho por região (ob_<area>_<tipo>) com a madeira, o barro e a pedra de lá; bloqueiam a casa como todo
  // marco e não têm deslocamento sorteado (a cerca emenda com a vizinha: postes a cada 16 px e as travessas de
  // ponta a ponta). Desenho em px de arte, luz de cima e da esquerda, 4–5 tons por material, contorno sépia.
  // -------------------------------------------------------------------
  const PROPS_VILA = ["barril", "caixotes", "carroca", "jarros", "lenha", "cocho", "cerca"];
  const MATERIAL_PROPS = {
    canaan: { madeira: ["#3a2416", "#5a3a22", "#7a5232", "#9a6e44", "#bc8e5e"], barro: ["#5a2e1c", "#84462a", "#a8603a", "#c87e52", "#e0a070"], pedra: ["#4a463c", "#6a6456", "#8c8672", "#aea690", "#cac2aa"] },
    deserto: { madeira: ["#4a2e1c", "#6e4628", "#92623a", "#b4824e", "#d0a06a"], barro: ["#6a3a20", "#92562e", "#b8743e", "#d49656", "#ecb878"], pedra: ["#5a3a26", "#7e5434", "#a47248", "#c4945e", "#deb47c"] },
    egito: { madeira: ["#4e3a20", "#72562e", "#967444", "#b8945c", "#d4b47a"], barro: ["#5e2c18", "#8a4426", "#b05e36", "#cc7c4c", "#e49c68"], pedra: ["#6a5c40", "#8a7a5a", "#ab9b78", "#cdbf9c", "#e4d8b8"] },
    marVermelho: { madeira: ["#3e342c", "#5e5246", "#80705e", "#a08e78", "#c0ae96"], barro: ["#5a2e22", "#82442e", "#a65e40", "#c27c58", "#dc9e78"], pedra: ["#4a2a24", "#6e3e30", "#965a44", "#b87a5c", "#d49c7e"] },
    sinai: { madeira: ["#33241c", "#52392a", "#73503a", "#94704e", "#b48e68"], barro: ["#56301e", "#7a462a", "#9c603a", "#ba7e52", "#d29c6c"], pedra: ["#3a2c28", "#5a463c", "#7a6250", "#9c8068", "#bca084"] },
    galileia: { madeira: ["#36231a", "#56382a", "#784e38", "#9a6a4a", "#ba8a64"], barro: ["#56301e", "#7e4a2c", "#a2643c", "#c08254", "#d8a274"], pedra: ["#222224", "#363636", "#4e4c4a", "#6c6a64", "#8c8880"] },
  };
  const FERRO_PROPS = ["#24201c", "#3e3832", "#5e564c", "#80786a"];
  const AGUA_PROPS = ["#24505e", "#346e7e", "#5a98a4", "#9ccacc"];
  // retângulo em px de arte com a cor de cada px (função ou cor)
  function retPx(g, X, Y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const cor = typeof c === "function" ? c(i, j, w, h) : c; if (cor) g.fino(X + i, Y + j, cor); }
  }
  // elipse cheia em px de arte; c(nx, ny) devolve a cor
  function elipPx(g, cx, cy, rx, ry, c) {
    for (let Y = Math.floor(cy - ry); Y <= Math.ceil(cy + ry); Y++) for (let X = Math.floor(cx - rx); X <= Math.ceil(cx + rx); X++) {
      const nx = (X + 0.5 - cx) / rx, ny = (Y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) { const cor = c(nx, ny, X, Y); if (cor) g.fino(X, Y, cor); }
    }
  }
  const DESENHO_PROP = {
    // barril de aduelas com dois aros de ferro e a tampa de cima; a variante 1 tem um barril menor ao lado
    barril(g, v, M, B) {
      const um = (cx, base, rx, alt) => {
        const m = M.madeira, topo = base - alt;
        for (let Y = topo + 2; Y <= base; Y++) {
          const t = (Y - topo) / alt, bojo = Math.sin(t * Math.PI) * 1.6, r = rx - 1.6 + bojo;
          for (let X = Math.round(cx - r); X <= Math.round(cx + r) - 1; X++) {
            const u = (X + 0.5 - (cx - r)) / (2 * r), ad = Math.floor(u * 6);
            let k = u < 0.2 ? 4 : u < 0.45 ? 3 : u < 0.75 ? 2 : u < 0.9 ? 1 : 0;
            if (Math.floor(((X - (cx - r)) / (2 * r)) * 6 * 2) % 2 === 1 && k > 0 && ad % 2) k--;
            let cor = m[k];
            const aro = Math.abs(Y - (topo + alt * 0.3)) < 1 || Math.abs(Y - (topo + alt * 0.75)) < 1;
            if (aro) cor = FERRO_PROPS[Math.min(3, Math.max(0, k - 1))];
            g.fino(X, Y, cor);
          }
        }
        elipPx(g, cx - 0.5, topo + 2.5, rx - 1.2, 2.4, (nx, ny) => (nx * nx + ny * ny > 0.55 ? m[1] : ny < 0 ? m[4] : m[3]));
      };
      g.sombra(11, B / 2, 7, 1.6, "#1c1210", 0.3);
      if (v === 1) um(27, B - 1, 6, 14);
      um(15, B, 9, 22);
    },
    // caixotes de tábuas com o quadro escuro e a trave em X; empilhados
    caixotes(g, v, M, B) {
      const m = M.madeira;
      const cx = (X, Y, w, h, tampa) => {
        retPx(g, X, Y, w, tampa, (i) => (i === 0 ? m[4] : i === w - 1 ? m[2] : m[3]));
        retPx(g, X, Y + tampa, w, h - tampa, (i, j, W, H) => {
          if (i === 0 || j === 0) return m[3];
          if (i === W - 1 || j === H - 1) return m[0];
          if (i === 1 || i === W - 2 || j === 1 || j === H - 2) return m[1];
          const d = Math.abs((i - 2) / (W - 4) - (j - 2) / (H - 4));
          if (d < 0.12) return m[1];
          return j % 4 === 0 ? m[1] : i < W / 2 ? m[3] : m[2];
        });
      };
      g.sombra(11, B / 2, 8, 1.6, "#1c1210", 0.3);
      cx(3, B - 15, 17, 16, 4);
      cx(19, B - 12, 13, 13, 3);
      if (v !== 1) cx(7, B - 26, 13, 12, 3);
    },
    // carroça de duas rodas, de lado: caixa de tábuas com sacos ou feno, roda de raios e os varais no chão
    carroca(g, v, M, B) {
      const m = M.madeira, W = g.w;
      g.sombra(W / 4 + 1, B / 2, 13, 1.8, "#1c1210", 0.3);
      // varais
      linhaPx(g, W - 4, B - 1, W - 16, B - 9, m[1]); linhaPx(g, W - 4, B - 2, W - 16, B - 10, m[3]);
      // carga
      if (v === 0) for (let k = 0; k < 3; k++) elipPx(g, 12 + k * 7, B - 19, 4.2, 4, (nx, ny) => (ny < -0.3 && nx < 0.2 ? "#e0d0a8" : nx > 0.4 || ny > 0.5 ? "#a08a60" : "#c8b488"));
      else for (let X = 7; X < 30; X++) for (let Y = B - 23 + Math.round(Math.sin(X * 0.7) * 1.2); Y < B - 15; Y++) g.fino(X, Y, (X + Y) % 3 === 0 ? "#b89a40" : Y < B - 20 ? "#e8d070" : "#d0b050");
      // caixa
      retPx(g, 5, B - 16, 28, 9, (i, j, w, h) => (j === 0 ? m[4] : j === h - 1 || i === w - 1 ? m[0] : j % 3 === 0 ? m[1] : i < 3 ? m[3] : m[2]));
      // roda
      const rx = 17, ry = B - 7;
      elipPx(g, rx, ry, 7, 7, (nx, ny, X, Y) => {
        const d = Math.hypot(nx, ny);
        if (d > 0.74) return d > 0.9 ? m[0] : nx + ny < 0 ? m[3] : m[1];
        if (d < 0.2) return m[4];
        const a = Math.atan2(ny, nx), raio = Math.abs(((a / Math.PI) * 3 + 6) % 1 - 0.5) < 0.12;
        return raio ? m[2] : null;
      });
    },
    // jarros de barro (talhas): 2 ou 3 de tamanhos diferentes, com a boca escura e a luz à esquerda
    jarros(g, v, M, B) {
      const b = M.barro;
      const jarro = (cx, base, rx, alt) => {
        const cy = base - alt * 0.42;
        elipPx(g, cx, cy, rx, alt * 0.42, (nx, ny) => { const l = -(0.65 * nx + 0.6 * ny); return l > 0.5 ? b[4] : l > 0.1 ? b[3] : l > -0.35 ? b[2] : l > -0.7 ? b[1] : b[0]; });
        const topo = base - alt;
        retPx(g, Math.round(cx - rx * 0.45), topo + 2, Math.round(rx * 0.9), Math.round(alt * 0.22), (i, j, w) => (i === 0 ? b[3] : i === w - 1 ? b[0] : b[2]));
        retPx(g, Math.round(cx - rx * 0.6), topo, Math.round(rx * 1.2), 2, (i, j, w) => (j === 0 ? (i === 0 ? b[3] : b[4]) : i < w - 2 && i > 1 ? "#1c1210" : b[1]));
      };
      g.sombra(11, B / 2, 8, 1.6, "#1c1210", 0.3);
      jarro(22, B - 2, 6, 16);
      jarro(12, B, 7.5, 22);
      if (v === 1) jarro(27, B, 4.5, 12);
    },
    // lenha empilhada: toras vistas de ponta (anéis claros, casca escura) em fileiras de 3, 2 e 1
    lenha(g, v, M, B) {
      const m = M.madeira;
      g.sombra(11, B / 2, 8, 1.5, "#1c1210", 0.3);
      // as toras de lado, atrás
      retPx(g, 4, B - 13, 26, 12, (i, j, w, h) => (j === 0 ? m[3] : j === h - 1 ? m[0] : j % 4 === 0 ? m[0] : (i * 7 + j) % 11 === 0 ? m[1] : m[2]));
      const fil = [[3, B - 4], [2, B - 11], [1, B - 18]];
      fil.forEach(([n, y], f) => {
        for (let k = 0; k < n; k++) {
          const x = 10 + k * 8 - (n - 3) * 4 + (v && f === 1 ? 1 : 0);
          elipPx(g, x, y, 4, 3.6, (nx, ny) => {
            const d = Math.hypot(nx, ny);
            if (d > 0.78) return nx + ny < -0.3 ? m[2] : m[0];
            return d < 0.25 ? "#a07a4a" : Math.abs(d - 0.5) < 0.1 ? "#c8a070" : "#e0c08a";
          });
        }
      });
    },
    // cocho: pedra (ou madeira no deserto) com a água dentro, a face da frente mais escura
    cocho(g, v, M, B) {
      const p = M.pedra, a = AGUA_PROPS;
      g.sombra(11, B / 2, 9, 1.5, "#1c1210", 0.3);
      retPx(g, 3, B - 14, 30, 6, (i, j, w, h) => {
        if (j === 0 || i === 0) return p[4];
        if (i === w - 1) return p[1];
        if (j === h - 1 || i === 1 || i === w - 2) return p[3];
        return j === 1 ? a[0] : (i + j * 3) % 9 === 0 ? a[3] : j === 2 ? a[1] : a[2];
      });
      retPx(g, 3, B - 8, 30, 8, (i, j, w, h) => (j === 0 ? p[2] : i === w - 1 || j === h - 1 ? p[0] : (i % 7 === 0 && j > 1) ? p[0] : i < 3 ? p[2] : p[1]));
    },
    // cerca de madeira: postes a cada 16 px (com a cabeça clara) e duas travessas de ponta a ponta da casa; nos
    // quadros de fecho (v ≥ 2: a última peça da fileira, sem cerca à direita) as travessas terminam num poste
    cerca(g, v, M, B) {
      const m = M.madeira, W = g.w, x0 = (W - 32) / 2;
      for (const y of [B - 15, B - 8]) retPx(g, x0, y, 32, 3, (i, j) => (j === 0 ? m[3] : j === 2 ? m[0] : (i + y) % 9 === 0 ? m[1] : m[2]));
      const postes = v >= 2 ? [x0 + 1, x0 + 17, x0 + 28] : [x0 + 1, x0 + 17];
      for (const px of postes) retPx(g, px, B - 20, 4, 20, (i, j, w, h) => (j === 0 ? m[4] : i === 0 ? m[3] : i === w - 1 ? m[0] : j === h - 1 ? m[0] : m[2]));
    },
  };
  for (const area of Object.keys(MATERIAL_PROPS)) for (const tipo of PROPS_VILA) {
    const chave = `ob_${area}_${tipo}`;
    if (!PIXEL_PATTERNS[chave] || !PIXEL_PATTERNS[chave].prop) continue; // os jarros do Egito são obstáculo do bioma
    const largo = tipo === "carroca", cerca = tipo === "cerca";
    // a cerca tem 2 quadros a mais com o poste de fecho na ponta direita (fecho: 2 = primeiro quadro de fecho)
    registrar(chave, {
      semEspelho: true, alto: false, alturaVisual: 30,
      w: largo ? 22 : 18, h: tipo === "caixotes" || tipo === "barril" || tipo === "jarros" ? 20 : 18, quadros: cerca ? 4 : 2, fecho: cerca ? 2 : 0, obstaculo: true, prop: true, origem: [0.5, 1],
      desenhar(g, v) { DESENHO_PROP[tipo](g, v, MATERIAL_PROPS[area], g.h - 5); },
    });
  }

  M.mundoAlternativo = ALT;
  for (const chave of Arte.MUNDO_DA_MAIN || []) if (ALT[chave]) registrar(chave, Object.assign({}, ALT[chave]));
  }
})(typeof window !== "undefined" ? window : globalThis);
