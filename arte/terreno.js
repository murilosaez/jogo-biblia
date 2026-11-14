// =====================================================================
// arte/terreno.js — terreno do tileset em px: água, costa, borda, muralha, chão, caminho e decoração rasteira.
// Pacote A6 do plano de arte: todos os pintores do tileset, px a px.
//
// Chaves que este arquivo assume (registrar() com a MESMA chave troca o desenho legado de sprites.js):
//   nenhuma chave de padrão: troca funções de Arte.motor.pintores (agua, costa, borda, muralha, chao,
//   caminho, mancha, detalhe, deco, moldura, sombras) e chama Arte.motor.limparTilesets().
//   Só pin.fino (px); Arte.ID_TILE e o formato de 8 × 15 casas não mudam
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
  const { misturar, hash2, sombrear, comAlfa, pintores, BIOMAS } = M;
  const ID = M.ID_TILE;

  // -------------------------------------------------------------------
  // Base: uma casa é um quadro de 32 × 32 px de arte. Cada pintor compõe a casa num vetor local de
  // cores (null = vazio) e só no fim a despeja no pincel, px a px (pin.fino).
  // -------------------------------------------------------------------
  const L = 32, AREA = L * L, TAU = Math.PI * 2;
  const SOMBRA = "#3b2c34", LUZ = "#fff3d6", TINTA = "#1c1210";
  const suave = (t) => t * t * (3 - 2 * t);
  const SEN = new Float32Array(L);
  for (let k = 0; k < L; k++) SEN[k] = Math.sin((TAU * k) / L);

  const novo = () => new Array(AREA).fill(null);
  function por(b, X, Y, cor) {
    if (X >= 0 && Y >= 0 && X < L && Y < L) b[Y * L + X] = cor;
  }
  // mistura por cima do que já existe (para sombras e realces dentro da casa)
  function velar(b, X, Y, cor, a) {
    if (X < 0 || Y < 0 || X >= L || Y >= L) return;
    const k = Y * L + X;
    b[k] = b[k] ? misturar(b[k], cor, a) : comAlfa(cor, a);
  }
  function emitir(pin, i, b, f) {
    for (let k = 0; k < AREA; k++) {
      const c = b[k];
      if (c) pin.fino(i, k & 31, k >> 5, f ? f(c) : c);
    }
  }

  // Ruído de valor PERIÓDICO (cx × cy células por casa): a casa emenda consigo mesma e com qualquer
  // outra que use a mesma tabela, e a tabela pode derivar (água) sem abrir costura.
  // hash forte para as tabelas: o hash2 do motor tem uma rodada só, e sementes vizinhas saem parecidas
  function hz(x, y, s) {
    let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul((s | 0) + 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }
  const cacheTab = new Map();
  function tabRuido(cx, cy, s) {
    const id = cx + "x" + cy + ":" + s;
    let t = cacheTab.get(id);
    if (t) return t;
    t = new Float32Array(AREA);
    const nos = new Float32Array(cx * cy);
    for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) nos[j * cx + i] = hz(i, j, s);
    for (let Y = 0; Y < L; Y++) {
      const v = (Y * cy) / L, yi = Math.floor(v), fy = suave(v - yi), y1 = (yi + 1) % cy;
      for (let X = 0; X < L; X++) {
        const u = (X * cx) / L, xi = Math.floor(u), fx = suave(u - xi), x1 = (xi + 1) % cx;
        const a = nos[yi * cx + xi], bb = nos[yi * cx + x1], c = nos[y1 * cx + xi], d = nos[y1 * cx + x1];
        const cima = a + (bb - a) * fx, baixo = c + (d - c) * fx;
        t[Y * L + X] = cima + (baixo - cima) * fy;
      }
    }
    cacheTab.set(id, t);
    return t;
  }
  // duas oitavas, esticado para ocupar bem a faixa 0..1
  function tabFractal(c, s) {
    const id = "f" + c + ":" + s;
    let t = cacheTab.get(id);
    if (t) return t;
    const a = tabRuido(c, c, s), b2 = tabRuido(c * 2, c * 2, s + 17);
    t = new Float32Array(AREA);
    for (let k = 0; k < AREA; k++) t[k] = Math.max(0, Math.min(1, 0.5 + ((a[k] * 2 + b2[k]) / 3 - 0.5) * 1.7));
    cacheTab.set(id, t);
    return t;
  }
  // Janela: 0 na beira da casa, 1 no miolo. Um campo "comum" vale na beira (todas as variantes
  // emendam entre si) e o campo próprio da variante vale no miolo (a repetição some).
  const JAN = new Float32Array(AREA);
  for (let Y = 0; Y < L; Y++) for (let X = 0; X < L; X++) JAN[Y * L + X] = suave(Math.min(1, Math.min(X, 31 - X, Y, 31 - Y) / 7));
  function campo(comum, proprio) {
    const t = new Float32Array(AREA);
    for (let k = 0; k < AREA; k++) t[k] = comum[k] + (proprio[k] - comum[k]) * JAN[k];
    return t;
  }
  // Campo do chão: malhado miúdo COMUM a todas as variantes (cf células por casa: a repetição de 32 px
  // some porque o desenho é pequeno) mais um desvio largo, de média zero, só no miolo de cada variante.
  function campoChao(sc, sv, cf, cv, kv) {
    const a = tabFractal(cf, sc), v = tabFractal(cv, sv), t = new Float32Array(AREA);
    for (let k = 0; k < AREA; k++) t[k] = a[k] + (v[k] - 0.5) * kv * JAN[k];
    return t;
  }

  // Células de Voronoi periódicas (n × n por casa): pedras de calçada, lajes, touceiras de folha,
  // facetas de rocha. Devolve, por px, a célula, a folga até a segunda célula (junta) e o
  // deslocamento em relação ao centro; por célula, se ela toca a beira da casa.
  const cacheCel = new Map();
  function celulas(n, s, jit = 0.8, ny = n) {
    const id = n + ":" + s + ":" + jit + ":" + ny;
    let c = cacheCel.get(id);
    if (c) return c;
    const tam = L / n, tamY = L / ny, sx = [], sy = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < n; i++) {
      sx.push((i + 0.5 + (hash2(i, j, s) - 0.5) * jit) * tam);
      sy.push((j + 0.5 + (hash2(j, i, s + 1) - 0.5) * jit) * tamY);
    }
    c = { n, tam, id: new Int16Array(AREA), folga: new Float32Array(AREA), d: new Float32Array(AREA), ox: new Float32Array(AREA), oy: new Float32Array(AREA), beira: new Uint8Array(n * ny) };
    for (let Y = 0; Y < L; Y++) for (let X = 0; X < L; X++) {
      const ci = Math.floor(X / tam), cj = Math.floor(Y / tamY);
      let m1 = 1e9, m2 = 1e9, qual = 0, bx = 0, by = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const gi = ci + di, gj = cj + dj, wi = ((gi % n) + n) % n, wj = ((gj % ny) + ny) % ny, q = wj * n + wi;
        const dx = X + 0.5 - (sx[q] + (gi - wi) * tam), dy = Y + 0.5 - (sy[q] + (gj - wj) * tamY), dd = Math.hypot(dx, dy);
        if (dd < m1) { m2 = m1; m1 = dd; qual = q; bx = dx; by = dy; } else if (dd < m2) m2 = dd;
      }
      const k = Y * L + X;
      c.id[k] = qual; c.folga[k] = m2 - m1; c.d[k] = m1; c.ox[k] = bx; c.oy[k] = by;
      if (X === 0 || Y === 0 || X === 31 || Y === 31) c.beira[qual] = 1;
    }
    cacheCel.set(id, c);
    return c;
  }

  // tom fracionário de uma rampa escuro → claro, com pontilhado só na transição
  const tomP = (r, p, X, Y, pont = true) => sombrear(r, (p / (r.length - 1)) * 2 - 1, X, Y, pont);
  const cacheRampa = new Map();
  function rampaChao(c) {
    let r = cacheRampa.get(c);
    if (!r) cacheRampa.set(c, (r = [misturar(c.escuro, SOMBRA, 0.42), misturar(c.escuro, SOMBRA, 0.14), misturar(c.escuro, c.base, 0.45), c.base, misturar(c.base, c.claro, 0.6), misturar(c.claro, LUZ, 0.12)]));
    return r;
  }
  // rampa de 4 tons do bioma (borda) esticada para 6
  function rampa6de4(r) {
    let v = cacheRampa.get(r);
    if (!v) cacheRampa.set(r, (v = [misturar(r[0], SOMBRA, 0.45), r[0], r[1], r[2], r[3], misturar(r[3], LUZ, 0.3)]));
    return v;
  }
  const rampaCor = (base) => [misturar(base, SOMBRA, 0.6), misturar(base, SOMBRA, 0.36), misturar(base, SOMBRA, 0.16), base, misturar(base, LUZ, 0.28), misturar(base, LUZ, 0.52)];

  // pedrinha de w × h px com luz em cima/esquerda e sombra projetada à direita/abaixo
  function pedra(b, X, Y, w, h, rp, corSombra) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (w >= 3 && h >= 2 && (i === 0 || i === w - 1) && (j === 0 || j === h - 1) && (w > 3 || j === h - 1 || i === w - 1)) continue;
      const l = 0.75 - (w > 1 ? i / (w - 1) : 0.5) * 0.85 - (h > 1 ? j / (h - 1) : 0.5) * 0.95;
      por(b, X + i, Y + j, sombrear(rp, l, X + i, Y + j, false));
    }
    for (let i = 1; i <= w; i++) velar(b, X + i, Y + h, corSombra, i === w ? 0.22 : 0.4);
    for (let j = 1; j < h; j++) velar(b, X + w, Y + j, corSombra, 0.3);
  }

  // -------------------------------------------------------------------
  // Texturas de chão (devolvem a casa inteira). sc = semente comum do bioma, sv = da variante.
  // -------------------------------------------------------------------
  // Relva: manchas de tom em baixa frequência e lâminas de 2–4 px com ponta clara e pé na sombra.
  function texRelva(r, sc, sv, o = {}) {
    const b = novo(), f = campoChao(sc, sv, 5, 3, 0.5), amp = o.amp ?? 1, vies = o.vies || 0;
    for (let k = 0; k < AREA; k++) b[k] = tomP(r, 3 + vies + (f[k] - 0.5) * 2.0 * amp, k & 31, k >> 5);
    const n = o.laminas ?? 40, alt = o.alto ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const X = Math.floor(hash2(i, sv, 11) * L), Y = Math.floor(hash2(sv, i, 12) * L) - 1;
      const h = 2 + alt + Math.floor(hash2(i, sv, 13) * 3), tipo = hash2(sv + i, i, 14);
      if (tipo < (o.alto ? 0.16 : 0.24)) {
        // lâmina na sombra: dá fundo à relva
        for (let j = 0; j < h; j++) por(b, X, Y + j, j === h - 1 ? r[0] : r[1]);
        continue;
      }
      const inclina = tipo > 0.8 ? 1 : tipo > 0.64 ? -1 : 0;
      for (let j = 0; j < h; j++) por(b, X + (j === 0 ? inclina : 0), Y + j, j === 0 ? (tipo > 0.5 ? r[5] : r[4]) : j === h - 1 && h > 2 ? r[3] : r[4]);
      for (let j = 1; j < h; j++) por(b, X + 1, Y + j, j === h - 1 ? r[0] : r[1]);
    }
    return b;
  }
  // touceira: leque de lâminas mais altas
  function touceira(b, r, X, Y, s, n = 6) {
    const meio = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const x = X + i - (n >> 1), fora = Math.abs(i - meio), h = Math.max(2, Math.round(5 - fora * 1.1 + hash2(i, s, 41) * 2.4));
      const cai = fora > 0.6 ? (i < meio ? -1 : 1) : 0;
      for (let j = 0; j < h; j++) por(b, x + (j === h - 1 ? cai : 0), Y - j, j === h - 1 ? r[5] : j === 0 ? r[1] : (i + j) & 1 ? r[4] : r[2]);
    }
    for (let i = 0; i < 3; i++) velar(b, X + (n >> 1) - 1 + i, Y + 1, r[0], 0.55 - i * 0.12);
    velar(b, X + (n >> 1) + 1, Y, r[0], 0.4);
  }
  // Areia: relevo suave, ondulações de vento em trechos e grãos.
  function texAreia(r, sc, sv, o = {}) {
    const b = novo(), f = campoChao(sc, sv, 4, 2, 0.45), mk = campo(tabRuido(2, 2, sc + 3), tabRuido(3, 3, sv + 3));
    const amp = o.amp ?? 1, forca = o.ondas ?? 1, fase = (sc % 7) * 0.9;
    for (let k = 0; k < AREA; k++) {
      const X = k & 31, Y = k >> 5;
      let p = 3 + (f[k] - 0.5) * 1.9 * amp;
      const m = (mk[k] - 0.45) * 5 * forca;
      if (m > 0) {
        const hh = Y + 2.2 * Math.sin((TAU * X) / L + fase) + 0.9 * Math.sin((TAU * 3 * X) / L + fase * 2), q = ((Math.round(hh) % 8) + 8) % 8;
        if (q === 0) p -= Math.min(1.1, m); else if (q === 7) p += Math.min(0.9, m);
      }
      b[k] = tomP(r, p, X, Y);
    }
    const n = o.graos ?? 16;
    for (let i = 0; i < n; i++) {
      const X = Math.floor(hash2(i, sv, 21) * L), Y = Math.floor(hash2(sv, i, 22) * L);
      if (i % 3) { por(b, X, Y, r[5]); por(b, X + 1, Y + 1, r[2]); } else por(b, X, Y, r[1]);
    }
    return b;
  }
  // Terra e cascalho: malhado em 2 oitavas e pedriscos com luz e sombra.
  function texTerra(r, sc, sv, o = {}) {
    const b = novo(), f = campoChao(sc, sv, 9, 3, 0.75), amp = o.amp ?? 1;
    for (let k = 0; k < AREA; k++) b[k] = tomP(r, 3 + (o.vies || 0) + (f[k] - 0.5) * 1.9 * amp, k & 31, k >> 5);
    const n = o.cascalho ?? 14;
    for (let i = 0; i < n; i++) {
      const X = Math.floor(hash2(i, sv, 23) * L), Y = Math.floor(hash2(sv, i, 24) * L);
      por(b, X, Y, r[5]); por(b, X + 1, Y, r[4]); por(b, X + 1, Y + 1, r[1]); por(b, X, Y + 1, r[2]);
      if (i % 4 === 0) por(b, X + 2, Y + 1, r[0]);
    }
    return b;
  }
  function espalharPedras(b, rp, corSombra, n, sv, min = 2, max = 4) {
    for (let i = 0; i < n; i++) {
      const w = min + Math.floor(hash2(i, sv, 25) * (max - min + 1)), h = Math.max(2, w - 1 - Math.floor(hash2(sv, i, 26) * 2));
      pedra(b, 2 + Math.floor(hash2(i, sv, 27) * (L - 5 - w)), 2 + Math.floor(hash2(sv, i, 28) * (L - 5 - h)), w, h, rp, corSombra);
    }
  }
  // Rocha em facetas (penhasco, granito): células com luz própria e fendas nas juntas.
  function texRocha(r, sc, sv, o = {}) {
    // blocos de rocha vistos de cima: cada célula é um bloco com o plano de cima/esquerda na luz, o de
    // baixo/direita na sombra, aresta clara no lado da luz e fenda fina (1 px) entre blocos
    const b = novo(), c = celulas(o.n || 4, sc, 0.85, o.ny || o.n || 4), nz = campoChao(sc + 5, sv + 5, 6, 3, 0.4);
    for (let k = 0; k < AREA; k++) {
      const q = c.id[k], t = hash2(q, c.beira[q] ? sc : sv, 61), lado = (c.ox[k] * 0.55 + c.oy[k] * 0.8) / c.tam, fo = c.folga[k];
      let p = 3.1 + (t - 0.5) * 1.3 - lado * 2.1 + (nz[k] - 0.5) * 0.9;
      if (fo < 1) p = lado > 0 ? 0.3 : 1.2;
      else if (fo < 2.2) p += lado < 0 ? 1.1 : -0.8;
      else if (hash2(k & 31, k >> 5, sc + 62) < 0.05) p -= 0.9; // grão
      b[k] = tomP(r, p < 1 && fo >= 1 ? 1 : p, k & 31, k >> 5);
    }
    return b;
  }
  // Duna: cristas largas em diagonal com ondulação fina.
  function texDuna(r, sv) {
    // marcas de vento: cristas finas e onduladas, face clara voltada para a luz e sombra curta atrás
    const b = novo(), nz = tabFractal(7, 333), gr = tabFractal(3, 335);
    for (let k = 0; k < AREA; k++) {
      const X = k & 31, Y = k >> 5;
      const q = (4 * Y + Math.round(5 * SEN[X] + 2.5 * SEN[(3 * X + 9) & 31]) + 64) & 31; // 4 cristas por casa
      let p = 3 + (nz[k] - 0.5) * 1.5 + (gr[k] - 0.5) * 0.8;
      if (q < 4) p += 1.5; else if (q < 9) p += 0.6; else if (q >= 26) p -= 1.3; else if (q >= 21) p -= 0.5;
      b[k] = tomP(r, p, X, Y);
    }
    for (let i = 0; i < 10; i++) por(b, Math.floor(hz(i, sv, 71) * L), Math.floor(hz(sv, i, 72) * L), i % 2 ? r[5] : r[1]);
    return b;
  }
  // Água funda parada (borda do mar e moldura): manchas de fundo e cristas curtas.
  function texFundo(r, sc, sv) {
    const b = novo(), f = campo(tabFractal(2, sc), tabFractal(3, sv)), sg = campo(tabRuido(4, 4, sc + 2), tabRuido(4, 4, sv + 2));
    for (let k = 0; k < AREA; k++) {
      const X = k & 31, Y = k >> 5;
      let p = 1.6 + (f[k] - 0.5) * 3;
      const hh = Y + 2 * SEN[X] + 1.1 * SEN[(2 * X + 9) & 31], q = ((Math.round(hh) % 11) + 11) % 11;
      if (q === 0 && sg[k] > 0.58) p += 1.5; else if (q === 1 && sg[k] > 0.62) p -= 1;
      b[k] = tomP(r, p, X, Y);
    }
    return b;
  }

  // -------------------------------------------------------------------
  // Fábrica por área: chão, mancha e caminho do bioma, cada um como f(sv, o) → casa.
  // -------------------------------------------------------------------
  const areaDe = (bio) => Object.keys(BIOMAS).find((k) => BIOMAS[k] === bio) || "canaan";
  const cacheFab = new Map();
  function fabrica(area, bio, semente) {
    let fab = cacheFab.get(bio);
    if (fab) return fab;
    const c = bio.chao, m0 = bio.mancha, cm = bio.caminho;
    const [cr, cg] = M.hexRgb(c.base);
    const tipo = area === "mar" ? "mar" : cg > cr + 8 ? "relva" : area === "deserto" || area === "marVermelho" ? "areia" : "terra";
    const r = rampaChao(c), sc = semente * 3 + 1;
    // mancha: mais perto do chão (como no legado), para não virar tabuleiro
    const k1 = area === "egito" ? 0.3 : 0.2;
    const rm = rampaChao({ base: misturar(m0.base, c.base, k1), escuro: misturar(m0.escuro, c.escuro, k1 * 0.6), claro: misturar(m0.base, c.claro, 0.4) });
    const rp = rampaCor(tipo === "relva" ? "#b9ad92" : misturar(c.claro, "#a89a8c", 0.45));
    const rcm = rampaChao({ base: cm.base, escuro: cm.escuro, claro: cm.claro });
    fab = { tipo, r, rm, rp, rcm, sc, area, bio };
    fab.chao = (sv, o = {}) => {
      if (tipo === "relva") return texRelva(r, sc, sv, o);
      if (tipo === "areia") {
        const b = texAreia(r, sc, sv, Object.assign({ ondas: area === "marVermelho" ? 0.7 : 1 }, o));
        return b;
      }
      if (tipo === "mar") return texAguaFunda(bio.agua, sv, () => 0, 1);
      const b = texTerra(r, sc, sv, Object.assign({ cascalho: area === "sinai" ? 18 : 9, amp: area === "sinai" ? 1 : 0.8 }, o));
      if (area === "sinai") espalharPedras(b, rp, r[0], 2, sv, 2, 3);
      return b;
    };
    const reserva = [];
    fab.chaoPronto = (j) => reserva[j & 3] || (reserva[j & 3] = fab.chao(semente * 19 + (j & 3) * 7 + 900, { laminas: 34 }));
    fab.mancha = (sv) => {
      if (tipo === "relva") return texRelva(rm, sc + 50, sv, { laminas: 58, alto: true, vies: -0.35 });
      if (area === "egito") {
        // sulcos de plantio: leiras largas com a crista na luz e brotos
        const b = texTerra(rm, sc + 50, sv, { cascalho: 4, amp: 0.6 });
        for (let k = 0; k < AREA; k++) {
          const X = k & 31, Y = k >> 5, q = Y & 7, falha = hash2(X >> 1, Y >> 3, sc + 51) < 0.1;
          if (falha) continue;
          if (q === 3) b[k] = rm[1]; else if (q === 4) b[k] = hash2(X, Y, sc) < 0.5 ? rm[1] : rm[2]; else if (q === 1) b[k] = hash2(X, Y, sc + 2) < 0.75 ? rm[4] : rm[3];
        }
        for (let i = 0; i < 7; i++) {
          const X = 1 + Math.floor(hash2(i, sv, 52) * 29), Y = (Math.floor(hash2(sv, i, 53) * 4) << 3) + 1;
          por(b, X, Y, c.salpico); por(b, X, Y - 1, misturar(c.salpico, "#b8c860", 0.5)); por(b, X + 1, Y - 1, c.salpico); por(b, X + 1, Y, rm[1]);
        }
        return b;
      }
      if (tipo === "areia") {
        const b = texAreia(rm, sc + 50, sv, { ondas: area === "marVermelho" ? 1.8 : 0.5, graos: 22 });
        espalharPedras(b, rp, rm[0], area === "deserto" ? 3 : 1, sv, 2, 3);
        return b;
      }
      if (tipo === "mar") return fab.chao(sv);
      const b = texTerra(rm, sc + 50, sv, { cascalho: 22 });
      espalharPedras(b, rp, rm[0], 3, sv, 2, 4);
      return b;
    };
    // caminho: calçada de basalto na Galileia, lajes de calcário no Egito, terra batida no resto
    fab.caminho = (sv) => {
      if (area === "galileia" || area === "egito") {
        const laje = area === "egito", cel = celulas(laje ? 3 : 5, sc + 70, laje ? 0.55 : 0.85), b = novo();
        const nz = campo(tabFractal(5, sc + 71), tabFractal(5, sv + 71));
        for (let k = 0; k < AREA; k++) {
          const q = cel.id[k], t = hash2(q, cel.beira[q] ? sc : sv, 72), fo = cel.folga[k], lado = cel.ox[k] * 0.55 + cel.oy[k] * 0.8;
          let p;
          if (fo < (laje ? 1.2 : 1.4)) p = lado > 0 ? 0.2 : 0.9;
          else {
            p = 3 + (t - 0.5) * (laje ? 1.4 : 2.2) + (nz[k] - 0.5) * 1.2 - (lado / cel.tam) * (laje ? 0.9 : 2.2);
            if (fo < (laje ? 2.4 : 2.6)) p += lado < 0 ? 1 : -0.9;
          }
          b[k] = tomP(rcm, p, k & 31, k >> 5);
        }
        if (laje) for (let i = 0; i < 5; i++) { // lascas e fissuras nas lajes
          let X = 3 + Math.floor(hash2(i, sv, 73) * 24), Y = 3 + Math.floor(hash2(sv, i, 74) * 24);
          for (let j = 0; j < 4; j++) { por(b, X, Y, rcm[1]); X += 1; Y += hash2(j, i + sv, 75) < 0.5 ? 1 : 0; }
        }
        return b;
      }
      const b = texTerra(rcm, sc + 70, sv, { cascalho: area === "sinai" ? 16 : 7, amp: 0.75 });
      espalharPedras(b, rampaCor(misturar(cm.claro, "#b8b0a4", 0.5)), rcm[0], area === "sinai" ? 4 : area === "deserto" ? 2 : 3, sv, 2, 4);
      return b;
    };
    cacheFab.set(bio, fab);
    return fab;
  }

  // distância (px) até o lado ABERTO mais próximo (bit ligado = vizinho do mesmo tipo = fechado),
  // com o canto arredondado onde dois lados abertos se encontram
  function distAberta(mask, X, Y, R) {
    const dv = Math.min(mask & 1 ? 99 : Y, mask & 4 ? 99 : 31 - Y), dh = Math.min(mask & 8 ? 99 : X, mask & 2 ? 99 : 31 - X);
    if (dv < R && dh < R) return R - Math.hypot(R - dv, R - dh);
    return Math.min(dv, dh);
  }

  // -------------------------------------------------------------------
  // Chão (0–7): 0–3 variantes, 4–5 mancha solta, 6–7 detalhe raro
  // -------------------------------------------------------------------
  const CARIMBOS = {
    florzinha: ["  lm    ", " lmkd   ", "  md  l ", "  s  lkd", " fs   d ", "  s   s "],
    trevo: [" l l  ", "lmlm l", " mdmlm", "  d md", "    d "],
    seixos: [" lm   ", "lmmd  ", " ddd l", "    md"],
    concha: [" lml  ", "lmrml ", "mrmrmd", " mmmd ", "  dd  "],
  };
  function carimbo(b, ox, oy, linhas, cores) {
    for (let j = 0; j < linhas.length; j++) for (let i = 0; i < linhas[j].length; i++) {
      const ch = linhas[j][i];
      if (ch !== " " && cores[ch]) por(b, ox + i, oy + j, cores[ch]);
    }
  }
  const tres = (c) => ({ l: misturar(c, LUZ, 0.4), m: c, d: misturar(c, "#4a2034", 0.38) });

  pintores.chao = function (pin, area, bio, semente) {
    const fab = fabrica(area, bio, semente), r = fab.r, c = bio.chao;
    const verde = { s: "#4c5e28", f: "#6f8a3a" };
    for (let i = 0; i < 8; i++) {
      const sv = semente * 11 + i * 7 + 1, b = i === 4 || i === 5 ? fab.mancha(sv) : fab.chao(sv);
      if (fab.tipo === "relva") {
        if (i === 1) for (let k = 0; k < 7; k++) { const X = 2 + Math.floor(hash2(k, sv, 31) * 28), Y = 2 + Math.floor(hash2(sv, k, 32) * 26); por(b, X, Y, c.salpico); por(b, X, Y + 1, r[4]); por(b, X, Y + 2, r[4]); por(b, X + 1, Y + 2, r[1]); }
        if (i === 2) { touceira(b, r, 11, 15, sv); touceira(b, r, 22, 24, sv + 1, 5); }
        if (i === 3) { pedra(b, 18, 17, 4, 3, fab.rp, r[0]); pedra(b, 9, 8, 2, 2, fab.rp, r[0]); touceira(b, r, 16, 19, sv, 4); }
        if (i === 6) { carimbo(b, 9, 10, CARIMBOS.florzinha, Object.assign({ k: area === "galileia" ? "#e2c044" : "#2a1a14" }, verde, tres(area === "galileia" ? "#b8a0d0" : "#c8402f"))); touceira(b, r, 22, 22, sv, 4); }
        if (i === 7) { carimbo(b, 12, 12, CARIMBOS.trevo, tres(area === "canaan" ? "#efe6cf" : "#e2c044")); carimbo(b, 20, 20, CARIMBOS.trevo, tres("#efe6cf")); }
      } else if (fab.tipo === "areia") {
        if (i === 1) espalharPedras(b, fab.rp, r[0], 2, sv, 2, 3);
        if (i === 3) pedra(b, 14, 15, 5, 3, fab.rp, r[0]);
        if (i === 6) { if (area === "marVermelho") { carimbo(b, 12, 13, CARIMBOS.concha, { l: "#fff6ea", m: "#f0e0d0", r: "#d8b8a4", d: "#b08a78" }); velar(b, 18, 17, r[0], 0.4); } else { carimbo(b, 11, 13, CARIMBOS.seixos, { l: fab.rp[5], m: fab.rp[3], d: fab.rp[1] }); touceira(b, rampaCor("#9a8550"), 21, 20, sv, 4); } }
        if (i === 7) { espalharPedras(b, fab.rp, r[0], 3, sv + 3, 2, 4); }
      } else if (fab.tipo === "terra") {
        if (i === 1) espalharPedras(b, fab.rp, r[0], 2, sv, 2, 3);
        if (i === 2) touceira(b, rampaCor(c.salpico), 13, 18, sv, 5);
        if (i === 3) pedra(b, 15, 14, 5, 4, fab.rp, r[0]);
        if (i === 6) {
          if (area === "egito") for (let x = 4; x < 28; x += 5) { por(b, x, 15, c.salpico); por(b, x, 14, "#8a9a4a"); por(b, x + 1, 13, "#a8b860"); por(b, x - 1, 14, "#8a9a4a"); por(b, x + 1, 15, r[1]); }
          else { // rachadura
            let X = 7, Y = 9;
            for (let k = 0; k < 16; k++) { por(b, X, Y, r[0]); por(b, X, Y - 1, r[4]); X += 1; if (hash2(k, 6, semente) < 0.5) { Y += 1; por(b, X - 1, Y, r[1]); } }
          }
        }
        if (i === 7) { espalharPedras(b, fab.rp, r[0], 3, sv + 3, 2, 4); touceira(b, rampaCor(c.salpico), 22, 24, sv, 4); }
      }
      emitir(pin, i, b);
    }
  };

  // -------------------------------------------------------------------
  // Mancha em autotile (104–119): lados sem vizinho de mancha desfiam até o chão base
  // -------------------------------------------------------------------
  pintores.mancha = function (pin, area, bio, semente) {
    const fab = fabrica(area, bio, semente), nz = tabFractal(4, fab.sc + 9);
    for (let mask = 0; mask < 16; mask++) {
      const sv = semente * 13 + mask * 5 + 300, bm = fab.mancha(sv), bc = fab.chaoPronto(mask), b = novo();
      for (let k = 0; k < AREA; k++) {
        const X = k & 31, Y = k >> 5, d = distAberta(mask, X, Y, 12);
        const lim = 2 + nz[k] * 10, dentro = d > lim + (hash2(X + mask * 32, Y, semente + 5) - 0.5) * 3.2;
        b[k] = dentro ? bm[k] : bc[k];
      }
      emitir(pin, ID.MANCHA4 + mask, b);
    }
  };

  // -------------------------------------------------------------------
  // Caminho em autotile (8–23): máscara N1 L2 S4 O8 de vizinhos que também são caminho
  // -------------------------------------------------------------------
  pintores.caminho = function (pin, bio, semente) {
    const area = areaDe(bio), fab = fabrica(area, bio, semente), c = bio.caminho, nz = tabFractal(4, fab.sc + 31), r = fab.r;
    const beira = misturar(c.borda, SOMBRA, 0.25);
    for (let mask = 0; mask < 16; mask++) {
      const sv = semente * 17 + mask * 3 + 500, bp = fab.caminho(sv), bc = fab.chaoPronto(mask + 1), b = novo();
      const fora = new Uint8Array(AREA);
      for (let k = 0; k < AREA; k++) fora[k] = distAberta(mask, k & 31, k >> 5, 9) < 2 + nz[k] * 4.5 ? 1 : 0;
      const eFora = (X, Y) => (X < 0 ? !(mask & 8) : X > 31 ? !(mask & 2) : Y < 0 ? !(mask & 1) : Y > 31 ? !(mask & 4) : fora[Y * L + X] === 1);
      for (let k = 0; k < AREA; k++) {
        const X = k & 31, Y = k >> 5;
        if (fora[k]) { b[k] = bc[k]; continue; }
        let cor = bp[k];
        // o caminho é um pouco rebaixado: a margem de cima/esquerda faz sombra, a de baixo/direita pega luz
        if (eFora(X, Y - 1) || eFora(X - 1, Y)) cor = beira;
        else if (eFora(X, Y - 2) || eFora(X - 2, Y)) cor = misturar(cor, beira, 0.45);
        else if (eFora(X, Y + 1) || eFora(X + 1, Y)) cor = misturar(cor, c.claro, 0.6);
        b[k] = cor;
      }
      // relva que invade a margem
      if (fab.tipo === "relva") for (let i = 0; i < 26; i++) {
        const X = Math.floor(hash2(i, sv, 81) * L), Y = 1 + Math.floor(hash2(sv, i, 82) * 30);
        if (fora[Y * L + X] || !(eFora(X, Y - 2) || eFora(X - 2, Y) || eFora(X + 2, Y) || eFora(X, Y + 2))) continue;
        por(b, X, Y - 1, r[5]); por(b, X, Y, r[4]); por(b, X + 1, Y, r[1]);
      }
      emitir(pin, ID.CAMINHO + mask, b);
    }
  };

  // O detalhe fino do legado (folhinhas por cima do chão em unidades) já nasce dentro das texturas.
  pintores.detalhe = function () {};

  // -------------------------------------------------------------------
  // Borda do mapa (48–63): máscara de vizinhos que também são borda
  // -------------------------------------------------------------------
  // muro em fiadas: tijolo de adobe (16 × 8 px, meia amarração) ou basalto (pedras de largura irregular)
  const FIADAS_BASALTO = [[11, 10, 11], [9, 12, 11], [12, 9, 11], [10, 13, 9]];
  function texMuro(r, basalto, sv, luz = 0) {
    const b = novo();
    for (let k = 0; k < AREA; k++) {
      const X = k & 31, Y = k >> 5, fila = Y >> 3, yy = Y & 7;
      let xx, bw, idt;
      if (basalto) {
        const ws = FIADAS_BASALTO[fila];
        let x = (X + fila * 5) % L, n = 0;
        while (x >= ws[n]) { x -= ws[n]; n++; }
        xx = x; bw = ws[n]; idt = n + fila * 4;
      } else { const x = (X + (fila & 1) * 8) & 31; xx = x & 15; bw = 16; idt = (x >> 4) + fila * 2; }
      let p;
      if (yy === 7 || xx === bw - 1) p = basalto ? 0 : 0.6;
      else {
        p = 2.8 + luz + (hash2(idt, sv, 91) - 0.5) * (basalto ? 1.3 : 1.6);
        if (yy === 0) p += basalto ? (xx < bw * 0.6 ? 1.4 : 0.6) : 1.2;
        else if (yy === 6) p -= 1;
        if (xx === 0) p += 0.7; else if (xx === bw - 2) p -= 0.7;
        const e = hash2(X, Y, sv + 92);
        if (e < 0.07) p -= 1.1; else if (e > 0.93) p += 0.7;
        if (!basalto && hash2(X >> 1, Y >> 1, sv + 93) < 0.05) p -= 0.9; // adobe esfarelado
      }
      b[k] = tomP(r, p, X, Y, false);
    }
    return b;
  }
  // sebe vista de cima: relevo de folhagem (o lado de cima/esquerda de cada tufo pega luz) e folhas soltas
  function texSebe(r, sv) {
    // tufos redondos de folhagem (células): cada um é um volume com luz em cima/esquerda e vão escuro
    // entre eles; folhas soltas claras no lado da luz e escuras no da sombra
    const b = novo(), c = celulas(4, 410, 0.9), nz = campoChao(411, sv + 411, 6, 3, 0.5);
    for (let k = 0; k < AREA; k++) {
      const X = k & 31, Y = k >> 5, q = c.id[k], t = hz(q, 3, c.beira[q] ? 410 : sv), lado = (c.ox[k] * 0.55 + c.oy[k] * 0.85) / c.tam;
      let p = 2.9 + (t - 0.5) * 1.3 - lado * 3.4 + (nz[k] - 0.5) * 1.5;
      if (c.folga[k] < 1.2) p = Math.min(p, lado > 0 ? 0.2 : 1.2);
      else if (c.folga[k] < 2.6 && lado > 0) p -= 0.9;
      b[k] = tomP(r, p, X, Y);
    }
    for (let i = 0; i < 26; i++) {
      const X = 1 + Math.floor(hz(i, sv, 413) * 29), Y = 1 + Math.floor(hz(sv, i, 414) * 29), k = Y * L + X;
      if (c.folga[k] < 2.2) continue;
      const lado = c.ox[k] * 0.55 + c.oy[k] * 0.85;
      if (lado < 0) { por(b, X, Y, r[5]); por(b, X + 1, Y, r[4]); por(b, X + 1, Y + 1, r[2]); } else { por(b, X, Y, r[1]); por(b, X + 1, Y, r[2]); por(b, X, Y + 1, r[0]); }
    }
    return b;
  }
  // paredão: colunas de rocha (facetas altas) com fendas
  function texParedao(r, sv) {
    return texRocha(r, 420, sv, { n: 4, ny: 3 });
  }
  // praia com blocos de granito
  function texGranito(fab, r, sv) {
    const b = fab.chao(sv), c = celulas(3, 430, 0.7), chao = fab.r;
    const raio = (q) => (hash2(q, c.beira[q] ? 430 : sv, 431) < 0.62 ? c.tam * (0.3 + hash2(q, 430, 432) * 0.14) : 0);
    for (let k = 0; k < AREA; k++) { // sombra projetada (direita/abaixo) antes das pedras
      const X = k & 31, Y = k >> 5, k2 = ((Y - 2) & 31) * L + ((X - 2) & 31), q = c.id[k2];
      if (c.d[k2] < raio(q)) b[k] = chao[1];
    }
    for (let k = 0; k < AREA; k++) {
      const q = c.id[k], ra = raio(q);
      if (!ra) continue;
      const X = k & 31, Y = k >> 5, d = c.d[k], rr = ra * (1 + (hash2(X >> 1, Y >> 1, 433 + q) - 0.5) * 0.3);
      if (d > rr) continue;
      let p = 3 - ((c.ox[k] * 0.55 + c.oy[k] * 0.85) / ra) * 2.6 + (hash2(q, 1, 434) - 0.5);
      if (d > rr - 1.1 && c.ox[k] + c.oy[k] > 0) p = 0.4;
      if (hash2(X, Y, 435) < 0.06) p -= 1; // grão do granito
      b[k] = tomP(r, p, X, Y);
    }
    return b;
  }

  pintores.borda = function (pin, bio, area) {
    const tipo = bio.borda.tipo, r4 = bio.borda.rampa, r = rampa6de4(r4), fab = fabrica(area, bio, M.sementeDe(area));
    for (let mask = 0; mask < 16; mask++) {
      const i = ID.BORDA + mask, sv = 700 + mask * 9;
      const ab = { n: !(mask & 1), l: !(mask & 2), s: !(mask & 4), o: !(mask & 8) };
      let b, muro = false;
      if (tipo === "sebe") b = texSebe(r, sv);
      else if (tipo === "duna") b = texDuna(r, sv);
      else if (tipo === "mar_profundo") {
        // a mesma água do mar, que afunda para fora do mapa (lados abertos = lado de dentro)
        const ag = bio.agua || BIOMAS.mar.agua;
        b = texAguaFunda(ag, 440 + mask, (X, Y) => {
          const d = Math.min(ab.n ? Y : 40, ab.s ? 31 - Y : 40, ab.o ? X : 40, ab.l ? 31 - X : 40);
          return -Math.min(1, d / 30) * 1.9;
        }, 0);
        emitir(pin, i, b);
        continue;
      } else if (tipo === "praia_granito") b = texGranito(fab, r, sv);
      else if (tipo === "paredao") b = texParedao(r, sv);
      else { muro = true; b = texMuro(r, tipo === "muro_basalto", sv, ab.s ? 0.55 : 0.2); }
      if (muro && ab.s) {
        // topo do muro em cima (8 px, mais claro) e a face voltada para o jogador embaixo, na sombra
        const face = texMuro(r, tipo === "muro_basalto", sv + 1, -0.5);
        for (let k = 8 * L; k < AREA; k++) b[k] = face[k];
        for (let X = 0; X < L; X++) { b[7 * L + X] = r[5]; b[8 * L + X] = r[0]; velar(b, X, 9, TINTA, 0.3); }
      }
      // face voltada para o interior: realce nos lados de cima/esquerda, sombra nos de baixo/direita
      const semFace = tipo === "duna" || tipo === "praia_granito";
      for (let k = 0; k < L; k++) {
        if (ab.s) { const a = semFace ? [0.3, 0.2, 0.1, 0.05] : [0.6, 0.45, 0.3, 0.18, 0.08]; a.forEach((v, j) => velar(b, k, 31 - j, TINTA, v)); }
        if (ab.l) { velar(b, 31, k, TINTA, semFace ? 0.25 : 0.45); velar(b, 30, k, TINTA, semFace ? 0.12 : 0.25); velar(b, 29, k, TINTA, 0.1); }
        if (ab.n && !semFace) { velar(b, k, 0, r[5], 0.6); velar(b, k, 1, r[5], 0.25); }
        if (ab.o && !semFace) { velar(b, 0, k, r[5], 0.5); velar(b, 1, k, r[5], 0.2); }
      }
      emitir(pin, i, b);
    }
  };

  // -------------------------------------------------------------------
  // Decoração rasteira (64–79; transparente): mesma lista de 16 variantes do legado, pelo peso
  // -------------------------------------------------------------------
  function listaDeco(bio) {
    const lista = [];
    for (const d of bio.deco) for (let k = 0; k < d.peso && lista.length < 16; k++) lista.push(d);
    while (lista.length < 16) lista.push(bio.deco[lista.length % bio.deco.length]);
    return lista;
  }
  const DECO = {
    florA: ["  lm      ", " lmmd     ", " mkkd   l ", " mmdd  lmd", "  dd   mkd", "  s     dd", "  sf    s ", " fs    fs ", "  s     s "],
    florB: ["      lm  ", " l   lmkd ", "lkd   md  ", " d  l  s  ", " s lkd sf ", " sf d  s  ", "    s     ", "   fs     "],
    florC: [" l l    ", "lmlm    ", " mkm  l ", "lmmd lkd", " d d  d ", "  s   s ", " fs   sf", "  s   s "],
    mostarda: ["  l  l    ", " lml lm l ", "  d lmd lm", "  s  d   d", "  s  s  s ", "  sf s fs ", "   s s s  ", "   fss    ", "    s     "],
    lirio: ["  l       ", " lml   l  ", "lmkml lml ", " mmd lmkmd", " dmd  mmd ", "  s   dd  ", "  sf   s  ", " fs   fs  ", "  s    s  "],
    tufoA: ["    l      ", " l  m  l   ", " m l m m  l", "  mm ml m m", " d m mm md ", "  dmdmmdm  ", "   ddmdd   "],
    tufoB: ["  l     l ", "  m  l  m ", " l m m m  ", " m mlm md ", "  mdmmdm  ", "  ddmddd  "],
    junco: ["   h      ", "   h  h   ", "   h  h   ", " l m  m   ", " m m  m l ", " m ml m m ", " m mm mm  ", "  mm dm   ", "  dm dm   ", "  dd dd   "],
    broto: [" l   l   l  ", "lm  lm  lm  ", " md  md  md ", " d   d   d  "],
    caco: [" lm       ", "lmmd   l  ", " mdd  lmd ", "  d    mmd", "   lm   d ", "   md     "],
    concha: [" lml     ", "lmrml    ", "mrmrmd lm", " mmmd  md", "  dd     "],
    alga: [" l     l  ", " m  l  m  ", "  m m m   ", "  m m  m  ", " m  dm m  ", " d  md d  ", "  d d d   "],
    peixe: ["d  ddd  ", "mdmmmml ", "m  mll  "],
  };
  function carimboSombreado(b, ox, oy, linhas, cores, corSombra) {
    // sombra de contato: 1 px abaixo/à direita do que toca o chão (as 2 últimas linhas do desenho)
    const h = linhas.length;
    for (let j = h - 2; j < h; j++) for (let i = 0; i < linhas[j].length; i++) if (linhas[j][i] !== " ") { velar(b, ox + i + 1, oy + j + 1, corSombra, 0.3); velar(b, ox + i, oy + j + 1, corSombra, 0.2); }
    carimbo(b, ox, oy, linhas, cores);
  }
  pintores.deco = function (pin, bio, area) {
    const somb = bio.sombra || TINTA;
    listaDeco(bio).forEach((d, k) => {
      const b = novo(), c = d.cor, t3 = tres(c), v = k % 2, h1 = hash2(k, 1, 250), h2 = hash2(k, 2, 250);
      const verde = { s: "#4c5e28", f: "#7a9440" };
      const st = (linhas, cores) => {
        const w = Math.max(...linhas.map((s) => s.length)), ox = 2 + Math.floor(h1 * (L - 4 - w)), oy = 3 + Math.floor(h2 * (L - 6 - linhas.length));
        carimboSombreado(b, ox, oy, linhas, cores, somb);
      };
      switch (d.tipo) {
        case "anemona": st(v ? DECO.florB : DECO.florA, Object.assign({ k: "#2a1a14" }, verde, t3)); break;
        case "flor_branca": st(v ? DECO.florA : DECO.florC, Object.assign({ k: "#e9c84a" }, verde, { l: "#fffaf0", m: c, d: "#b9b0c4" })); break;
        case "flor_amarela": st(v ? DECO.florC : DECO.florB, Object.assign({ k: "#c8742a" }, verde, t3)); break;
        case "mostarda": st(v ? DECO.florB : DECO.mostarda, Object.assign({ k: "#c8862a" }, verde, t3)); break;
        case "lirio": st(v ? DECO.florC : DECO.lirio, Object.assign({ k: "#f2e6a0" }, verde, t3)); break;
        case "tufo": case "tufo_seco": st(v ? DECO.tufoB : DECO.tufoA, t3); break;
        case "junco": st(DECO.junco, Object.assign({ h: v ? "#8a6a44" : "#a8865e" }, t3)); break;
        case "broto": st(DECO.broto, { l: misturar(c, "#c8d870", 0.5), m: c, d: misturar(c, SOMBRA, 0.4) }); break;
        case "caco": st(DECO.caco, { l: misturar(c, LUZ, 0.4), m: c, d: "#7a3a22" }); break;
        case "concha": st(DECO.concha, { l: "#fffaf2", m: c, r: "#d8b8a4", d: "#a88474" }); break;
        case "alga": st(DECO.alga, t3); break;
        case "pedrinha": case "seixo": {
          const rp = rampaCor(c), ox = 4 + Math.floor(h1 * 16), oy = 6 + Math.floor(h2 * 16);
          pedra(b, ox, oy, 5, 4, rp, somb); pedra(b, ox + 7, oy + 3, 3, 2, rp, somb);
          if (v) pedra(b, ox + 2, oy + 6, 2, 2, rp, somb);
          break;
        }
        case "ondulacao": {
          const ox = 4 + Math.floor(h1 * 8), oy = 8 + Math.floor(h2 * 14);
          for (let x = 0; x < 16; x++) { const y = Math.round(Math.sin(x * 0.55 + k) * 1.4); por(b, ox + x, oy + y, comAlfa(c, 0.9)); por(b, ox + x, oy + y - 1, comAlfa(misturar(c, LUZ, 0.6), 0.75)); }
          for (let x = 3; x < 13; x++) { const y = 5 + Math.round(Math.sin(x * 0.55 + k + 1) * 1.2); por(b, ox + x, oy + y, comAlfa(c, 0.8)); por(b, ox + x, oy + y - 1, comAlfa(misturar(c, LUZ, 0.6), 0.6)); }
          break;
        }
        case "pegadas": {
          const ox = 5 + Math.floor(h1 * 8), oy = 5 + Math.floor(h2 * 8);
          for (let n = 0; n < 4; n++) {
            const x = ox + n * 5, y = oy + n * 3 + (n % 2 ? 4 : 0);
            for (let j = 0; j < 4; j++) for (let q = 0; q < 3; q++) if (!((j === 0 || j === 3) && q !== 1) || j === 0) por(b, x + q, y + j, comAlfa(misturar(c, SOMBRA, 0.3), j === 0 ? 0.6 : 0.85));
            por(b, x + 3, y + 2, comAlfa(LUZ, 0.35)); por(b, x + 1, y + 4, comAlfa(LUZ, 0.35));
          }
          break;
        }
        case "poca": {
          const ox = 8 + Math.floor(h1 * 14), oy = 8 + Math.floor(h2 * 14);
          for (let y = -3; y <= 3; y++) for (let x = -7; x <= 7; x++) {
            const e = (x * x) / 49 + (y * y) / 9 + (hash2(x, y, k + 251) - 0.5) * 0.25;
            if (e > 1) continue;
            por(b, ox + x, oy + y, e > 0.72 ? comAlfa(y < 0 ? "#3f5860" : "#a8c4c0", 0.8) : comAlfa(y < -1 ? "#5a7a80" : c, 0.82));
          }
          por(b, ox - 3, oy - 1, comAlfa("#e8f2e0", 0.9)); por(b, ox - 2, oy - 1, comAlfa("#e8f2e0", 0.9)); por(b, ox - 4, oy, comAlfa("#e8f2e0", 0.7));
          break;
        }
        case "liquen": {
          const ox = 8 + Math.floor(h1 * 14), oy = 8 + Math.floor(h2 * 14);
          for (let y = -4; y <= 4; y++) for (let x = -5; x <= 5; x++) {
            const e = (x * x) / 25 + (y * y) / 16 + (hash2(x >> 1, y >> 1, k + 252) - 0.5) * 0.9;
            if (e > 0.8) continue;
            por(b, ox + x, oy + y, comAlfa(hash2(x, y, k + 253) < 0.3 ? t3.l : e > 0.5 ? t3.d : c, 0.9));
          }
          break;
        }
        case "cardume": {
          const ox = 4 + Math.floor(h1 * 8), oy = 6 + Math.floor(h2 * 10);
          for (let n = 0; n < 4; n++) carimbo(b, ox + n * 5 + (n % 2) * 2, oy + ((n * 5) % 13), DECO.peixe, { m: comAlfa(c, 0.6), l: comAlfa(misturar(c, "#bfe6d6", 0.45), 0.65), d: comAlfa(misturar(c, SOMBRA, 0.45), 0.6) });
          break;
        }
        default: por(b, 16, 16, c);
      }
      emitir(pin, ID.DECO + k, b);
    });
  };

  // -------------------------------------------------------------------
  // Moldura externa (80–89): cenário fora do mapa, 15% mais escuro para recuar
  // -------------------------------------------------------------------
  function arvoreDeCima(b, cx, cy, ra, r, s, corSombra) {
    for (let y = -ra - 1; y <= ra + 3; y++) for (let x = -ra - 1; x <= ra + 3; x++) if (Math.hypot(x - 2, y - 2) < ra) velar(b, cx + x, cy + y, corSombra, 0.38);
    for (let y = -ra - 1; y <= ra + 1; y++) for (let x = -ra - 1; x <= ra + 1; x++) {
      const d = Math.hypot(x, y) / ra, rec = 1 + (hash2((x + 40) >> 1, (y + 40) >> 1, s) - 0.5) * 0.36;
      if (d > rec) continue;
      const moita = (hash2((x + 40) >> 2, (y + 40) >> 2, s + 1) - 0.5) * 1.5;
      por(b, cx + x, cy + y, d > rec - 0.16 && x + y > 0 ? r[0] : tomP(r, 3 - ((x * 0.55 + y * 0.85) / ra) * 2.4 + moita, cx + x, cy + y));
    }
  }
  pintores.moldura = function (pin, bio, area) {
    const vin = bio.vinheta.cor, cacheEsc = new Map();
    const esc = (cor) => { let v = cacheEsc.get(cor); if (!v) cacheEsc.set(cor, (v = misturar(cor.slice(0, 7), vin, 0.15))); return v; };
    const relvaDe = (base, escuro, claro) => rampaChao({ base, escuro, claro });
    const pinta = (i, tipo, v) => {
      const sv = 800 + v * 13 + i;
      let b;
      switch (tipo) {
        case "colinas": {
          const r = area === "galileia" ? relvaDe("#5a7a46", "#4a6a3a", "#6a8c4c") : relvaDe("#6a7a3a", "#5a6a30", "#7b9042");
          b = texRelva(r, 810, sv, { laminas: 30, amp: 1.3 });
          if (v % 2 === 0) arvoreDeCima(b, v === 0 ? 11 : 20, v === 0 ? 13 : 17, 8, rampaCor("#4a5f2e"), 811 + v, r[0]);
          else arvoreDeCima(b, 22, 9, 4, rampaCor("#56702f"), 812 + v, r[0]);
          break;
        }
        case "dunas": b = texDuna(rampa6de4(["#b88a50", "#c49a5a", "#d0a868", "#dcb878"]), sv); break;
        case "campos": {
          const rt = relvaDe("#857344", "#6f5f38", "#9a8650"), rv = rampaCor("#6f7a3a");
          b = texTerra(rt, 820, sv, { cascalho: 5, amp: 0.7 });
          for (let k = 0; k < AREA; k++) { // leiras de plantio com a copa das plantas
            const X = k & 31, Y = k >> 5, q = Y & 7;
            if (q >= 2 && q <= 5) { const e = hash2(X >> 1, Y >> 3, 821 + v); if (e > 0.18) b[k] = tomP(rv, 3 + (q === 2 ? 1.4 : q === 5 ? -1.6 : 0) + (hash2(X, Y, 822 + v) - 0.5) * 2, X, Y, false); } else if (q === 6) b[k] = rt[1];
          }
          break;
        }
        case "penhascos": b = texRocha(rampa6de4(bio.borda.rampa), 830, sv, { n: 3, ny: 3 }); break;
        case "agua": case "muralha": case "mar": { const ag = bio.agua || BIOMAS.mar.agua; b = texAguaFunda(ag, 835 + v, () => (tipo === "mar" ? -1.9 : -0.9), tipo === "mar" ? 0.2 : 0.5); break; }
        case "granito": b = texRocha(rampa6de4(["#6a2c22", "#7a3426", "#a5503a", "#c49a72"]), 831, sv); break;
        case "praia": b = texAreia(relvaDe("#e2c07c", "#cfa863", "#efd598"), 832, sv); break;
        case "relva": b = texRelva(relvaDe("#7b9042", "#6a7e3a", "#8fa34e"), 833, sv); break;
        default: { const rb = bio.borda.rampa; b = texFundo([rb[0], rb[0], rb[1], rb[1], rb[2]], 834, sv); }
      }
      emitir(pin, i, b, esc);
    };
    // 80–83: lados norte/sul genéricos; 84–85 oeste; 86–87 leste; 88–89 norte (quando difere do sul)
    for (let v = 0; v < 4; v++) pinta(ID.MOLDURA + v, bio.moldura.sul, v);
    for (let v = 0; v < 2; v++) pinta(ID.MOLDURA + 4 + v, bio.moldura.oeste, v);
    for (let v = 0; v < 2; v++) pinta(ID.MOLDURA + 6 + v, bio.moldura.leste, v);
    for (let v = 0; v < 2; v++) pinta(ID.MOLDURA + 8 + v, bio.moldura.norte, v);
  };

  // -------------------------------------------------------------------
  // Sombras de contato da borda (96 oeste, 97 norte, 98 canto): degradê de 8 px
  // -------------------------------------------------------------------
  pintores.sombras = function (pin, bio) {
    const c = bio.sombra, A = [0.34, 0.3, 0.25, 0.2, 0.15, 0.11, 0.07, 0.04];
    for (let k = 0; k < L; k++) for (let d = 0; d < A.length; d++) {
      // a beira do degradê é pontilhada para não virar uma régua
      const a = A[d];
      if (d < 6 || (k + d) % 2 === 0) { pin.fino(ID.SOMBRA, d, k, c, a); pin.fino(ID.SOMBRA + 1, k, d, c, a); }
    }
    for (let Y = 0; Y < L; Y++) for (let X = 0; X < L; X++) {
      const d = Math.min(X, Y);
      if (d < A.length && (d < 6 || (X + Y) % 2 === 0)) pin.fino(ID.SOMBRA + 2, X, Y, c, A[d]);
    }
  };

  // -------------------------------------------------------------------
  // Água (animada): fundo em manchas que derivam devagar, cristas longas que correm e mudam de
  // forma, brilho pontilhado. Tudo sai de tabelas periódicas: a deriva é só um deslocamento de índice.
  // -------------------------------------------------------------------
  const AG_FUNDO = tabRuido(2, 5, 901), AG_A = 0.13, AG_B = 0.06;
  const ONDA_X = new Int8Array(L), ONDA_C = new Int8Array(L);
  for (let k = 0; k < L; k++) { ONDA_X[k] = Math.round(3 * SEN[(2 * k + 5) & 31]); ONDA_C[k] = Math.round(5 * SEN[(2 * k) & 31] + 3 * SEN[(3 * k + 7) & 31]); }
  // janela larga (rota do mar): clareia o miolo da casa e desfaz a beira
  const JAN_ROTA = new Float32Array(AREA);
  for (let k = 0; k < AREA; k++) { const X = k & 31, Y = k >> 5; JAN_ROTA[k] = 0.55 + 0.45 * suave(Math.min(1, (Math.min(X, 31 - X, Y, 31 - Y) + (hash2(X >> 1, Y >> 1, 903) - 0.5) * 3) / 6)); }
  const cacheVarAgua = new Map(), CICLO_CRISTA = 15, VIDA_CRISTA = [0.35, 0.7, 1, 1, 1, 1, 1, 0.75, 0.45];
  // Cada variante tem o seu fundo e as suas cristas (posição, comprimento e tempo próprios): como as
  // variantes caem ao acaso no mapa, as cristas não se alinham em fileiras nem em colunas.
  function varAgua(sv) {
    let v = cacheVarAgua.get(sv);
    if (v) return v;
    v = { fundo: tabRuido(2, 6, 910 + sv * 3), brilhos: [0, 1, 2, 3].map((k) => [3 + Math.floor(hash2(sv, k, 913) * 26), 3 + Math.floor(hash2(k, sv, 914) * 26), Math.floor(hash2(sv + k, k, 915) * 13)]) };
    // cristas desenhadas: 3 traços por variante, cada um na sua faixa de altura (sorteada), com
    // comprimento, inclinação e relógio próprios — nada de fileiras iguais de casa em casa
    v.cristas = [];
    for (let n = 0, tent = 0; v.cristas.length < 3 && tent < 12; n++, tent++) {
      const len = 6 + Math.floor(hz(sv, n, 916) * 10), y = 4 + Math.floor(hz(sv + 7, n, 918) * 24);
      if (v.cristas.some((c) => Math.abs(c.y - y) < 5)) continue;
      v.cristas.push({ len, x: 3 + Math.floor(hz(n, sv, 917) * (24 - len)), y, o: Math.floor(hz(sv, n + 9, 919) * CICLO_CRISTA), arco: hz(n, sv + 3, 920) < 0.6 ? 1 : 0, cai: hz(sv, n, 921) < 0.5 ? 1 : -1 });
    }
    // cavas: traços escuros em crescente (2 px de altura no meio), parados, que respiram
    v.cavas = [];
    for (let n = 0, tent = 0; v.cavas.length < 3 && tent < 20; n++, tent++) {
      const len = 8 + Math.floor(hz(sv, n, 931) * 9), y = 4 + Math.floor(hz(sv + 5, n, 932) * 24), x = 3 + Math.floor(hz(n, sv, 933) * (25 - len));
      if (v.cavas.some((c) => Math.abs(c.y - y) < 4 && x < c.x + c.len + 2 && c.x < x + len + 2) || v.cristas.some((c) => Math.abs(c.y - y) < 3) || (Math.abs(y - 10) < 4 && (x < 7 || x + len > 23))) continue;
      v.cavas.push({ len, x, y, o: Math.floor(hz(sv, n + 3, 934) * 8) });
    }
    cacheVarAgua.set(sv, v);
    return v;
  }
  const cacheRampaAgua = new Map();
  function rampaAgua(agua) {
    const id = agua.base + agua.clara;
    let r = cacheRampaAgua.get(id);
    if (r) return r;
    const b0 = agua.base, e0 = agua.escura;
    r = { tons: [misturar(e0, agua.profunda, 0.45), e0, b0, misturar(b0, agua.clara, 0.55), agua.clara, misturar(agua.clara, agua.brilho, 0.4)], crista: misturar(agua.clara, agua.brilho, 0.3), nucleo: misturar(agua.clara, agua.brilho, 0.8), vale: e0, brilho: agua.brilho, espuma: agua.espuma, barranco: misturar(agua.profunda, "#3a2c22", 0.55) };
    cacheRampaAgua.set(id, r);
    return r;
  }
  // Uma casa de água na fase t. vies: Float32Array opcional × kv somado ao tom (rota clara, fundo que
  // escurece); raso: idem, para a costa (e segura os vales junto à espuma). cr = força das cristas.
  const BUF_AGUA = new Array(AREA);
  // onda mansa: lombo claro em cima (1 px) e cava escura embaixo (1–2 px), pontas pontilhadas; dá a volta na casa
  function ondaMansa(b, tons, x0, y, len, raso) {
    const meio = (len - 1) / 2;
    if (raso && raso[(y & 31) * L + ((x0 + (len >> 1)) & 31)] > 0.5) return;
    for (let j = 0; j < len; j++) {
      const u = Math.abs(j - meio) / (meio + 0.5), X = (x0 + j) & 31, Y = y + (u > 0.62 ? 1 : 0), k1 = ((Y + 1) & 31) * L + X;
      if (u > 0.82) { if ((X + Y) & 1) b[k1] = tons[1]; continue; }
      b[(Y & 31) * L + X] = tons[3]; b[k1] = tons[1];
      if (u < 0.25 || (u < 0.5 && (X + Y) & 1)) b[((Y + 2) & 31) * L + X] = tons[1];
    }
  }
  function aguaCasa(sv, agua, t, vies, kv, raso, cr = 1) {
    const V = varAgua(sv), R = rampaAgua(agua), tons = R.tons, dx = t >> 1, dy = t >> 2, b = BUF_AGUA, fundo = V.fundo;
    for (let Y = 0; Y < L; Y++) for (let X = 0; X < L; X++) {
      const k = Y * L + X, kf = ((Y - dy) & 31) * L + ((X - dx) & 31);
      // marulho: duas ondas largas em diagonal que correm + fundo malhado (comum na beira da casa,
      // para emendar com qualquer variante, e próprio da variante no miolo). A água fica lisa no tom
      // de base; só o que passa do limiar vira lente escura (cava) ou clara (lombo), de beira pontilhada
      const v = AG_A * SEN[(X + 2 * Y - t) & 31] + AG_B * SEN[(2 * Y - X + (t >> 1) + 11) & 31] + (AG_FUNDO[kf] - 0.5) * (1 - JAN[k]) * 0.95 + (fundo[kf] - 0.5) * JAN[k] * 1.5;
      const d = (v < 0 ? -v : v) - 0.2;
      let p = 2 + (d > 0 ? (v < 0 ? -0.8 : 0.8) * (d * 2.2 > 1 ? 1 : d * 2.2) : 0);
      if (raso) p += raso[k];
      if (vies) p += kv * vies[k];
      p = p < 0 ? 0 : p > 5 ? 5 : p;
      b[k] = sombrear(tons, p / 2.5 - 1, X, Y);
    }
    // ondas mansas: 2 comuns a todas as variantes, paradas, que atravessam a beira da casa (sem elas
    // cada casa vira uma ilha de traços) e as próprias da variante, que respiram
    ondaMansa(b, tons, 25, 10, 12, raso); ondaMansa(b, tons, 9, 30, 10, raso);
    for (const c of V.cavas) {
      const enc = [0, 1, 2, 1][((t + c.o) >> 1) & 3];
      ondaMansa(b, tons, c.x + (enc >> 1), c.y, c.len - enc, raso);
    }
    // cristas: traços curtos em arco, com o miolo mais claro e o vale escuro logo abaixo; nascem,
    // correm 1 px a cada 2 fases e somem
    const quantas = Math.min(V.cristas.length, cr >= 1 ? 3 : cr >= 0.45 ? 2 : cr > 0 ? 1 : 0);
    for (let n = 0; n < quantas; n++) {
      const c = V.cristas[n], f = (t + c.o) % CICLO_CRISTA;
      if (f >= VIDA_CRISTA.length) continue;
      const len = Math.max(3, Math.round(c.len * VIDA_CRISTA[f])), x0 = c.x + (f >> 1) + ((c.len - len) >> 1), meio = (len - 1) / 2;
      if (raso && raso[c.y * L + x0 + (len >> 1)] > 0.5) continue;
      for (let j = 0; j < len; j++) {
        const u = Math.abs(j - meio) / (meio + 0.5), X = x0 + j;
        const Y = c.y + (c.arco ? (u > 0.72 ? 1 : 0) : Math.round(((j - meio) / len) * 2.2 * c.cai));
        b[Y * L + X] = u < 0.45 && len > 5 ? R.nucleo : R.crista;
        if (u < 0.7 && len > 4) b[(Y + 1) * L + X + 1] = R.vale;
      }
    }
    return b;
  }
  // água parada (borda funda do mar, moldura): a mesma água, sem tempo, mais escura
  function texAguaFunda(agua, sv, funcVies, cr = 0.35) {
    const v = new Float32Array(AREA);
    for (let k = 0; k < AREA; k++) v[k] = funcVies(k & 31, k >> 5);
    return aguaCasa(sv, agua, 0, v, 1, null, cr).slice();
  }
  pintores.agua = function (pin, i, agua, fase, t, clara = false, raso = null) {
    t = Math.floor(t) || 0;
    const V = varAgua(i), R = rampaAgua(agua);
    const b = aguaCasa(i, agua, t, clara ? JAN_ROTA : null, 1, raso);
    for (let k = 0; k < AREA; k++) pin.fino(i, k & 31, k >> 5, b[k]);
    // brilho pontilhado: pontos que acendem e apagam, cada um no seu tempo (mais na rota)
    const nb = clara ? 4 : 2;
    for (let b = 0; b < nb; b++) {
      const [X, Y, o] = V.brilhos[b], f = (t + o + fase) % 13;
      if (f === 0) pin.fino(i, X, Y, R.brilho);
      else if (f === 1) { pin.fino(i, X, Y, R.espuma); pin.fino(i, X - 1, Y, R.brilho); pin.fino(i, X + 1, Y, R.brilho); }
      else if (f === 2) pin.fino(i, X, Y, R.brilho);
    }
  };

  // Costa (24–39; bit = lado com terra): faixa rasa mais clara, espuma grossa e irregular colada à
  // margem e uma segunda linha solta que avança e recua.
  const ONDA_MARGEM = new Float32Array(L);
  for (let k = 0; k < L; k++) ONDA_MARGEM[k] = 1.2 * SEN[(2 * k + 5) & 31] + 0.8 * SEN[(3 * k + 11) & 31];
  const rasoDe = new Map(), MU_SEG = tabRuido(2, 4, 902);
  pintores.costa = function (pin, bio, t, desde = 0) {
    t = Math.floor(t) || 0;
    const a = bio.agua, R = rampaAgua(a), vai = 1.3 * SEN[(4 * t) & 31];
    for (let mask = desde; mask < 16; mask++) {
      const i = ID.COSTA + mask;
      let raso = rasoDe.get(mask), dist = rasoDe.get("d" + mask), lado = rasoDe.get("l" + mask);
      if (!raso) {
        raso = new Float32Array(AREA); dist = new Float32Array(AREA); lado = new Uint8Array(AREA);
        for (let k = 0; k < AREA; k++) {
          const X = k & 31, Y = k >> 5;
          let d = 99, q = 0, ld = 0;
          if (mask & 1 && Y < d) { d = Y; q = X; ld = 0; }
          if (mask & 4 && 31 - Y < d) { d = 31 - Y; q = X; ld = 1; }
          if (mask & 8 && X < d) { d = X; q = Y; ld = 2; }
          if (mask & 2 && 31 - X < d) { d = 31 - X; q = Y; ld = 3; }
          dist[k] = d; lado[k] = q | (ld << 5);
          const dd = d + ONDA_MARGEM[q] * 0.8;
          raso[k] = dd < 11 ? (1 - dd / 11) * 2.4 : 0;
        }
        rasoDe.set(mask, raso); rasoDe.set("d" + mask, dist); rasoDe.set("l" + mask, lado);
      }
      pintores.agua(pin, i, a, mask % 4, t, false, mask ? raso : null);
      if (!mask) continue;
      for (let k = 0; k < AREA; k++) {
        const d = dist[k];
        if (d > 9) continue;
        const X = k & 31, Y = k >> 5, q = lado[k] & 31, ld = lado[k] >> 5, wb = ONDA_MARGEM[q];
        // 1ª linha: 1 a 3 px colados à terra, respirando com a fase
        const e1 = 1.7 + 0.5 * wb + 0.9 * SEN[(3 * q + 4 * t + ld * 7) & 31];
        if (d < 1 && !(wb > 0.9)) { pin.fino(i, X, Y, R.barranco); continue; }
        if (d < Math.max(2, e1 + 1)) { pin.fino(i, X, Y, d + 1 >= e1 && d > 0 ? misturar(R.espuma, a.clara, 0.35) : R.espuma); continue; }
        if (d < e1 + 2) { pin.fino(i, X, Y, R.nucleo); continue; }
        // 2ª linha: solta, quebrada em trechos que correm ao longo da margem
        const c2 = 5.6 + wb * 1.1 + vai, seg = MU_SEG[(ld * 7 + 3) * L + ((q + (ld & 1 ? t : -t)) & 31)];
        if (seg > 0.5 && Math.abs(d - c2 - 1) < 0.6) pin.fino(i, X, Y, seg > 0.6 ? R.espuma : R.nucleo);
        else if (seg > 0.56 && Math.abs(d - c2 - 2) < 0.6) pin.fino(i, X, Y, R.crista);
      }
    }
  };

  // Muralha de água (Mar Vermelho): paredão que escorre. 24 corpo (norte), 25 pé do norte (espuma e
  // leito), 26 crista do sul (leito e espuma em cima), 27 corpo (sul).
  const MU_COL = tabRuido(8, 1, 920), MU_CAI = tabRuido(8, 2, 921), MU_FIO = tabRuido(16, 2, 922), MU_ESP = tabRuido(6, 4, 923);
  pintores.muralha = function (pin, bio, t) {
    t = Math.floor(t) || 0;
    const a = bio.agua, R = rampaAgua(a);
    const tons = [misturar(a.profunda, SOMBRA, 0.25), a.profunda, a.escura, a.base, a.clara, misturar(a.clara, a.brilho, 0.6)];
    const leito = ["#7a4636", "#a85a4a", "#d07a5a"];
    const corpo = (i, modo) => {
      for (let Y = 0; Y < L; Y++) for (let X = 0; X < L; X++) {
        const ky = ((Y - 3 * t) & 31) * L + X, kf = ((Y - 5 * t) & 31) * L + X;
        let p = 2.5 + (MU_COL[X] - 0.5) * 1.5 + (MU_CAI[ky] - 0.5) * 3.6;
        let cor = MU_FIO[kf] > 0.8 ? (MU_FIO[kf] > 0.88 ? R.nucleo : tons[4]) : sombrear(tons, Math.max(0, Math.min(5, p)) / 2.5 - 1, X, Y);
        if (modo) {
          // espuma que ferve no encontro com o leito seco
          const yb = modo === 1 ? 31 - Y : Y, e = MU_ESP[((yb + (modo === 1 ? t : -t)) & 31) * L + ((X + t * (X & 1 ? 1 : -1)) & 31)];
          const alt = 4 + e * 9;
          if (yb <= 1) cor = hash2(X, yb, 924) < 0.3 ? leito[2] : yb ? leito[1] : leito[0];
          else if (yb < alt - 2.5) cor = R.espuma;
          else if (yb < alt) cor = (X + Y + t) & 1 ? R.espuma : R.nucleo;
          else if (yb < alt + 5 && hash2(X, Y + t * 3, 925 + (t & 7)) < 0.14) cor = R.nucleo; // respingos
        }
        pin.fino(i, X, Y, cor);
      }
    };
    corpo(ID.COSTA, 0); corpo(ID.COSTA + 3, 0); corpo(ID.COSTA + 1, 1); corpo(ID.COSTA + 2, 2);
    // poças e braços de água dentro do mapa usam a costa comum (as 4 primeiras casas são da muralha)
    pintores.costa(pin, bio, t, 4);
  };

  M.limparTilesets();
})(typeof window !== "undefined" ? window : globalThis);
