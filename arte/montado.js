// =====================================================================
// arte/montado.js — jogador montado, montarias e barco.
// Pacote M1 do plano de arte.
//
// Chaves que este arquivo assume (registrar() com a MESMA chave troca o desenho legado de sprites.js):
//   pj_jogador|…|<montaria> (72 × 96 px, por Arte.motor.definirMontado; a altura do plano era 80: de
//     frente e de costas o cavaleiro fica ~12 px mais alto na célula — o meio do animal está mais longe
//     de quem olha que as patas da frente — e o golpe com a espada erguida não cabia)
//   mt_jumento mt_cavalo mt_camelo mt_carro (prévias de 64 × 64 px, 1 quadro)
//   mk_barco (64 × 64 px, 3 vistas × 4 quadros: direcoes 3, quadrosPorVista 4, ciclo [0, 1, 2, 3]; o mastro
//     de frente e de costas pede os 64 px de altura)
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
  const { registrar, rampa6, sombrear, hash2, comAlfa, prim } = M;
  const N = M.novoHumano, HE = M.humanoEquipado, AN = M.ANATOMIAS;
  if (!N || !HE || !AN || typeof M.animal !== "function") return; // sem o humano novo e o quadrúpede, fica o legado

  // -------------------------------------------------------------------
  // Como o montado é feito
  //   A montaria é o esqueleto de arte/quadrupede.js (Arte.motor.animal) com os arreios postos como
  //   volumes no espaço do animal (manta, sela, cilha, cabresto), de modo que saem certos nas três
  //   vistas. O cavaleiro é o boneco equipado de arte/humano-equip.js com a metade de baixo de montado
  //   (novoHumano.inferiorMontado), assentado no ponto da sela que o animal devolve em cada quadro.
  //   Camadas: de lado, animal inteiro e o cavaleiro por cima (a perna de perto cai sobre o flanco);
  //   de frente e de costas, a metade do animal além do plano da sela, o cavaleiro e a metade de cá.
  //   O animal de cada (tipo, vista, quadro) é desenhado uma vez e guardado: trocar de equipamento
  //   montado só redesenha o boneco.
  // -------------------------------------------------------------------
  const CW = 72, CH = 96, QPV = 8;
  const GRAU = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const MA = M.MONTARIAS_ARTE || {};
  const corM = (tipo, campo, i, padrao) => { const v = MA[tipo] && MA[tipo][campo]; return (Array.isArray(v) ? v[i] : v) || padrao; };

  // ----- arreios -----
  // manta: [para trás, para a frente] da sela (px no porte 1), cai = quanto desce pelo flanco;
  // sela: arção de couro; alforje: bolsas atrás do cavaleiro; cabresto: focinheira + faceira.
  // Pernas: o esqueleto do quadrúpede dobra a traseira num Z fundo (a coxa quase deitada), que de lado lê
  // como bicho agachado. Aqui as quatro pernas são desenhadas pelo gancho `extra`, com as mesmas pegadas
  // (pf, pz) do esqueleto: dianteira em coluna com o joelho para a frente, traseira com o jarrete
  // marcado e a soldra recolhida no flanco. As do esqueleto ficam com raio ~0 (somem); os cascos são os dele.
  const PERNA_CAVALO = { fT: -2.5, quadrilF: 1.5, quadrilZ: 1.5, fD: 1, ombroF: 1, ergue: 3.4, passo: 5.5, r0: 2.3, r1: 1.4 };
  const TRONCO_CAVALO = { zq: 34.1, zo: 33.5 }; // 3,5 px mais alto que o do quadrúpede: perna de cavalo, não de pônei
  const FASE_A = { 2: 0, 3: 0.25, 4: 0.5, 5: 0.75 };
  function passoDe(fase, S, ergue) {
    fase = ((fase % 1) + 1) % 1;
    if (fase < 0.5) return [S * (1 - 4 * fase), 0];
    const u = (fase - 0.5) * 2;
    return [S * (-1 + 2 * u), Math.sin(Math.PI * u) * ergue];
  }
  function junta(H, F, a, b, sinal) {
    let dx = F[0] - H[0], dz = F[1] - H[1], d = Math.hypot(dx, dz);
    const dm = Math.min(d, a + b - 0.01), k = dm / (d || 1);
    dx *= k; dz *= k; d = dm || 0.01;
    const t = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - t * t));
    const ux = dx / d, uz = dz / d;
    return [H[0] + ux * t - uz * hh * sinal, H[1] + uz * t + ux * hh * sinal];
  }
  function pernasMontaria(cena, k, A) {
    const { E, cy, mf, zq, zo, IM, q, vista, P, pose } = k, Pn = A.perna;
    const CPc = Math.cos(38 * GRAU), dzC = -cy / CPc, pata = Pn.pata * E, S = (Pn.passo || 4) * E, ergue = (Pn.ergue || 3) * E;
    const andando = q >= 2 && q <= 5, R0 = Pn.r0 * E, R1 = Pn.r1 * E;
    const fPeD = mf + (Pn.fD || 0) * E, fPeT = -mf + (Pn.fT || 0) * E;
    for (const [frente, s] of [[1, -1], [1, 1], [0, -1], [0, 1]]) {
      const parA = (frente && s > 0) || (!frente && s < 0);
      let df = 0, dz = 0;
      if (andando) [df, dz] = passoDe(FASE_A[q] + (parA ? 0 : 0.5), S, ergue);
      const descanso = (s < 0 ? 1 : -0.5) * (Pn.desloc === undefined ? 1.2 : Pn.desloc) * E * (frente ? 1 : -0.6);
      let pf = (frente ? fPeD : fPeT) + descanso + df, pz = dz;
      if (q === 6) pf += frente ? 1.5 * E : 0.5 * E;
      if (q === 7) { if (frente) { pf += (s > 0 ? 3 : 1.5) * E; pz += (s > 0 ? 3 : 1) * E * (A.patada === false ? 0 : 1); } else pf -= 2.5 * E; }
      const l = s * (frente ? Pn.afast : Pn.afastT || Pn.afast) * E, lp = l + s * (Pn.abre || 0) * E;
      const hf = frente ? mf + (Pn.ombroF || 0) * E : -mf + (Pn.quadrilF || 0) * E;
      const hz = (frente ? zo + (Pn.ombroZ || -1) * E : zq + (Pn.quadrilZ || -0.5) * E) + dzC;
      const longe = cena.my(hf, l) < -0.5 ? (vista === 0 ? -0.34 : -0.22) : 0;
      cena.grupo(P.PERNA + (frente ? 0 : 2) + (s > 0 ? 1 : 0), 0, 0, longe);
      const pe = [pf, pata * 0.9 + pz], alc = hz - pata * 0.9, fim = [pe[0], lp, pe[1] + R1 * 0.3];
      if (frente) {
        // braço largo no ombro, joelho (carpo) marcado, canela fina
        const J = junta([hf, hz], pe, alc * 0.5, alc * 0.515, 1), jl = (l + lp) / 2;
        cena.cadeia([hf, l, hz], R0 * 1.5, [J[0], jl, J[1]], R0 * 0.82, IM.pelo);
        cena.bola(J[0] + 0.3, jl, J[1], R0 * 0.86, IM.pelo);
        cena.cadeia([J[0], jl, J[1]], R0 * 0.74, fim, R1, IM.perna);
      } else {
        const jar = [pe[0] - alc * 0.05, pe[1] + alc * 0.36];
        const J = junta([hf, hz], jar, alc * 0.365, alc * 0.365, 1);
        cena.cadeia([hf, l, hz], R0 * 1.9, [J[0], l, J[1]], R0 * 1.25, IM.pelo);
        cena.cadeia([J[0], l, J[1]], R0 * 1.2, [jar[0], lp, jar[1]], R1 * 1.2, IM.pelo);
        cena.cadeia([jar[0], lp, jar[1]], R1 * 1.15, fim, R1, IM.perna);
      }
    }
  }
  const ARREIOS = {
    cavalo: { porte: 1.0, assento: 39, manta: [6.6, 6.2], cai: 1.9, sela: true, cilha: 2.2, peitoral: true, cabresto: 0.5, couro: "#3a2418", selaZ: 40.5, tronco: TRONCO_CAVALO, perna: PERNA_CAVALO },
    jumento: { porte: 1, assento: 39, manta: [6.4, 5.6], cai: 1.7, sela: false, cilha: 1.6, alforje: true, cabresto: 0.42, couro: "#6e4424", selaZ: 33.5, tronco: { zq: 27.6, zo: 27 }, perna: { fT: -2.2, quadrilF: 1.5, quadrilZ: 1.2, fD: 0.8, ombroF: 0.8, ergue: 2.8, passo: 4.8, r0: 2.1, r1: 1.3 } },
    // os cavalos do carro (parelha): menores, com peitoral de tiro, selim e cabresto
    tiro: { base: "cavalo", porte: 0.84, manta: [2.6, 2.6], cai: 1.2, cilha: 0.5, peitoral: true, cabresto: 0.5, couro: "#3a2418", selaZ: 40.5, tronco: TRONCO_CAVALO, perna: PERNA_CAVALO },
    camelo: { porte: 1.04, assento: 43, manta: [8.6, 8.2], cai: 2.3, corcova: true, cilha: 4.5, cabresto: 0.45, couro: "#8e2a1f", borlas: true, selaZ: 46, fundoFV: -3,
      tronco: { zq: 36.4, zo: 36, anca: [6.6, 6.9], cintura: [7.0, 7.3], peito: [6.4, 7.1], corcova: [-1.5, 42, 7.5, 5.6, 5.4] },
      perna: { fT: -2.5, quadrilF: 1.5, quadrilZ: 1.5, fD: 1, ombroF: 1, r0: 2.25, r1: 1.5, pata: 2.5, ergue: 3.6, passo: 5.6 } },
  };
  const ult = { boca: null, pito: null }; // âncoras de tela do último animal desenhado (para as rédeas)
  function comArreios(tipo) {
    const T = ARREIOS[tipo], base = T.base || tipo, A0 = AN[base];
    // anatomia derivada só aqui (o pv_animal_* do quadrúpede não muda): tronco, pernas e ponto da sela
    const A = Object.assign({}, A0, T.selaZ ? { selaZ: T.selaZ } : null, { tronco: Object.assign({}, A0.tronco, T.tronco), perna: Object.assign({}, A0.perna, T.perna) });
    const pernaOculta = Object.assign({}, A.perna, { r0: 0.001, r1: 0.001 });
    const manta = corM(base, "manta", 1, "#c2452d"), couro = T.couro || corM(base, "couro", 1, "#7a4a24");
    return Object.assign({}, A, {
      nome: tipo + "_arreado", escFrente: T.escFrente || 1, perna: pernaOculta,
      cores: Object.assign({}, A.cores, { extra: manta, tipoExtra: "pano", chifre: couro }),
      extra(cena, k) {
        const { E, cy, mf, IM, pose, q, vista } = k, Tr = A.tronco, comp = Tr.comp * E;
        const [aL, aZ] = Tr.anca, [cL, cZ] = Tr.cintura, [pL, pZ] = Tr.peito;
        // seção do tronco em f: meia largura, meia altura e altura do centro (as contas do quadrúpede)
        const secao = (f) => {
          const t = clamp((f + mf) / comp, 0, 1), u = t < 0.5 ? t * 2 : (t - 0.5) * 2, w = (1 - Math.cos(Math.PI * u)) / 2;
          return {
            rl: (t < 0.5 ? aL + (cL - aL) * w : cL + (pL - cL) * w) * E, rz: (t < 0.5 ? aZ + (cZ - aZ) * w : cZ + (pZ - cZ) * w) * E,
            zc: (Tr.zq + (Tr.zo - Tr.zq) * t) * E - (t > 0.5 ? (Tr.peitoCai || 0) * w * E : 0) + ((Tr.arco || 0) + (Tr.recolhe || 0)) * E * Math.sin(Math.PI * t),
          };
        };
        const sf = (A.selaF || 0) * E;
        pernasMontaria(cena, k, A);
        cena.grupo(k.P.EXTRA, 0, cy, 0);
        // manta: fatias que acompanham o lombo e descem pelo flanco
        const d = T.cai * E;
        for (let f = sf - T.manta[0] * E; f <= sf + T.manta[1] * E + 0.01; f += 0.6) {
          const s = secao(f);
          cena.elip(f, 0, s.zc + d, 0.95, s.rl + 1.0, s.rz - d + 0.9, IM.extra);
        }
        let topo = secao(sf).zc + secao(sf).rz + 0.9;
        if (T.corcova && Tr.corcova) {
          // tapete sobre a corcova e os dois arções de madeira da sela de camelo
          const [hf, hz, rf, rl, rz] = Tr.corcova;
          cena.elip(hf * E, 0, hz * E + 0.6, rf * E + 0.9, rl * E + 1.0, rz * E + 0.7, IM.extra);
          topo = hz * E + rz * E + 1.3;
          cena.grupo(k.P.EXTRA + 2, 0, cy, 0);
          for (const s of [-1, 1]) cena.cadeia([hf * E + s * (rf * E * 0.78), 0, topo - 3.2], 1.5, [hf * E + s * (rf * E * 0.86), 0, topo + 0.8], 1.1, IM.chifre);
          cena.grupo(k.P.EXTRA, 0, cy, 0);
        }
        if (T.sela) {
          // sela de couro: assento baixo com o arção da frente e o de trás
          cena.grupo(k.P.EXTRA + 2, 0, cy, 0);
          cena.elip(sf, 0, topo - 0.3, 4.6 * E, 3.6 * E, 1.3, IM.chifre);
          cena.elip(sf + 4.2 * E, 0, topo + 0.5, 1.2, 2.4 * E, 1.5, IM.chifre);
          cena.elip(sf - 4.4 * E, 0, topo + 0.3, 1.1, 2.9 * E, 1.3, IM.chifre);
        }
        // cilha: a cinta que passa por baixo da barriga
        cena.grupo(k.P.EXTRA + 3, 0, cy, 0);
        { const f = sf + T.cilha * E, s = secao(f); cena.elip(f, 0, s.zc, 0.85, s.rl + 1.5, s.rz + 0.5, IM.chifre); }
        if (T.peitoral) { const f = mf + 1.2 * E, s = secao(mf); cena.elip(f, 0, s.zc + 1.5 * E, s.rz * 0.9, s.rl + 0.5, 0.9, IM.chifre); }
        if (T.alforje) for (const s of [-1, 1]) {
          const f = sf - 4.6 * E, se = secao(f);
          cena.elip(f, s * (se.rl + 0.6), se.zc + 0.5 * E, 3.1 * E, 1.9 * E, 3.3 * E, IM.chifre);
        }
        // cabeça: as mesmas contas do quadrúpede para achar o crânio e o focinho
        const Nk = A.pescoco, C = A.cabeca, Fo = C.foc;
        const ang = (Nk.ang - pose.agacha * (Nk.baixa === undefined ? 14 : Nk.baixa) * (vista === 2 ? 0.25 : 1) + (q === 7 ? -(Nk.estica === undefined ? 10 : Nk.estica) : 0)) * GRAU;
        const n0 = [mf + (Nk.f || 0.5) * E, k.zo + (Nk.z || 1) * E], nl = Nk.comp * E;
        const n1 = [n0[0] + Math.cos(ang) * nl + pose.cabF, n0[1] + Math.sin(ang) * nl + pose.cabZ];
        const r = C.r * E, larg = C.larg || 1, hf = n1[0] + (C.f || 0.4) * r, hz = n1[1] + (C.z || 0.25) * r;
        const cabAng = (C.ang || 0) * GRAU + (q === 7 ? (C.ergue || 8) * GRAU : 0), dF = Math.cos(cabAng), dZ = Math.sin(cabAng);
        const f0 = [hf + r * 0.55 * dF, hz - r * 0.2 + r * 0.55 * dZ];
        const tip = [f0[0] + Fo.comp * E * dF + Fo.cai * E * dZ, f0[1] - Fo.cai * E * dF + Fo.comp * E * dZ];
        const lf = Fo.larg || 1, tn = T.cabresto, rr = (Fo.r0 + (Fo.r1 - Fo.r0) * tn) * E;
        const bf = f0[0] + (tip[0] - f0[0]) * tn, bz = f0[1] + (tip[1] - f0[1]) * tn;
        cena.grupo(k.P.EXTRA + 4, 0, cy + pose.cabY, 0).solto(pose.cabF, 0, pose.cabZ);
        // focinheira (perpendicular ao focinho) e faceira até atrás da orelha
        for (let a = -1; a <= 1; a += 0.5) cena.elip(bf + dZ * a * 0.2, 0, bz - dF * a * 0.2, 0.75, rr * lf + 0.55, rr * (Fo.alt || 0.9) + 0.55, IM.chifre);
        for (const s of [-1, 1]) cena.cadeia([bf, s * (rr * lf + 0.1), bz + rr * 0.3], 0.75, [hf - r * 0.35, s * (r * larg * 0.93), hz + r * 0.55], 0.75, IM.chifre);
        cena.elip(hf - r * 0.4, 0, hz + r * 0.25, 0.7, r * larg + 0.4, r * 0.8 + 0.4, IM.chifre);
        ult.boca = cena.tela(bf - 0.6, vista === 0 ? rr * lf : 0, bz - rr * 0.35).slice(0, 2).map(Math.round);
        cena.grupo(k.P.EXTRA, 0, cy, 0);
        ult.pito = cena.tela(sf + 4.5 * E, 0, topo).slice(0, 2).map(Math.round);
      },
    });
  }
  const ARREADOS = {};
  for (const tipo of Object.keys(ARREIOS)) if (AN[ARREIOS[tipo].base || tipo]) ARREADOS[tipo] = comArreios(tipo);

  // Acabamento da manta no desenho já feito: a barra (o px de manta que tem embaixo outra coisa) vira
  // franja dourada e, no tapete do camelo, as fileiras logo acima viram listras.
  const idx = (R) => { const m = new Map(); R.forEach((c, i) => m.set(c, i)); return m; };
  function acabarManta(px, tipo, CW, CH) {
    const nome = tipo; tipo = ARREIOS[nome].base || nome;
    const R = rampa6(corM(tipo, "manta", 1, "#c2452d"), "pano"), im = idx(R);
    const Fr = rampa6(corM(tipo, "franja", 0, "#e8b94a"), "metal"), Li = rampa6(corM(tipo, "listra", 0, "#3b5a9a"), "pano"), Cl = rampa6("#eadcb6", "pano");
    const borlas = ARREIOS[nome].borlas, eh = (X, Y) => X >= 0 && X < CW && Y >= 0 && Y < CH && im.has(px[Y * CW + X]);
    const troca = [];
    for (let X = 0; X < CW; X++) {
      let fundo = -1; // linha da barra nesta coluna (a mais baixa de cada trecho de manta)
      for (let Y = CH - 1; Y >= 0; Y--) {
        if (!eh(X, Y)) { fundo = -1; continue; }
        if (fundo < 0) fundo = Y;
        const dist = fundo - Y, i = im.get(px[Y * CW + X]);
        if (dist === 0) troca.push(X, Y, X % 2 ? Fr[clamp(i, 1, 4)] : Fr[clamp(i + 1, 2, 5)]);
        else if (borlas && (dist === 2 || dist === 3)) troca.push(X, Y, Li[i]);
        else if (borlas && dist === 5) troca.push(X, Y, Cl[clamp(i, 1, 5)]);
        else if (!borlas && dist === 2) troca.push(X, Y, R[Math.max(0, i - 1)]);
      }
    }
    for (let k = 0; k < troca.length; k += 3) px[troca[k + 1] * CW + troca[k]] = troca[k + 2];
  }

  // ----- animal em cache: { tudo, fundo (máscara: além do plano da sela), sela, boca, pito } -----
  const gradeDe = (W, H) => { const d = new Array(W * H).fill(null); return { w: W, h: H, d, fino(X, Y, c) { if (X >= 0 && Y >= 0 && X < W && Y < H && c) d[Y * W + X] = c; }, gf: (X, Y) => (X >= 0 && Y >= 0 && X < W && Y < H ? d[Y * W + X] : null) }; };
  const cacheAnimal = new Map();
  function animalPronto(tipo, vista, q, W, H, o) {
    W = W || CW; H = H || CH;
    const id = tipo + "|" + vista + "|" + q + "|" + W + "x" + H + (o ? "|" + JSON.stringify(o) : "");
    if (cacheAnimal.size > 400) cacheAnimal.clear();
    let r = cacheAnimal.get(id);
    if (r) return r;
    const A = ARREADOS[tipo], g = gradeDe(W, H);
    ult.boca = ult.pito = null;
    o = Object.assign({ porte: ARREIOS[tipo].porte || 1 }, o);
    const a = M.animal(g, vista, q, A, o);
    r = { px: g.d, sela: a.sela, boca: ult.boca, pito: ult.pito, fundo: null, a };
    acabarManta(r.px, tipo, W, H);
    if (vista !== 0) { const gf = gradeDe(W, H); M.animal(gf, vista, q, A, Object.assign({ parte: "fundo" }, o)); r.fundo = gf.d; }
    cacheAnimal.set(id, r);
    return r;
  }
  function colar(g, r, W, H, qual) {
    const px = r.px, f = r.fundo;
    for (let i = 0; i < px.length; i++) {
      if (!px[i]) continue;
      if (qual && f && (qual === "fundo") !== !!f[i]) continue;
      g.fino(i % W, (i / W) | 0, px[i]);
    }
  }
  // rédea: cordão de 1 px com barriga, da boca até a mão
  function redea(g, a, b, cor, barriga) {
    const n = Math.max(2, Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    for (let k = 0; k <= n; k++) { const t = k / n; g.fino(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * barriga), cor); }
  }

  // Recorte do cavaleiro contra a montaria: o contorno do motor só corre por fora da silhueta, e perna
  // nua sobre pelo castanho (ou couro sobre couro) some. Aqui o px do animal encostado no boneco
  // escurece (mais do lado da sombra: à direita e embaixo), e o px do boneco logo acima da metade de cá
  // do animal ganha a sombra de quem está assentado atrás dela.
  const TRACO = "#1e1210";
  const retrato = (g) => { const d = new Array(CW * CH); for (let Y = 0, i = 0; Y < CH; Y++) for (let X = 0; X < CW; X++) d[i++] = g.gf(X, Y); return d; };
  function recortar(g, base, comBoneco) {
    const meio = comBoneco || retrato(g), fim = comBoneco ? retrato(g) : meio;
    const B = (X, Y) => X >= 0 && Y >= 0 && X < CW && Y < CH && meio[Y * CW + X] !== base[Y * CW + X]; // px do boneco
    for (let Y = 0; Y < CH; Y++) for (let X = 0; X < CW; X++) {
      const i = Y * CW + X, c = fim[i];
      if (!c) continue;
      const boneco = B(X, Y), coberto = fim[i] !== meio[i]; // coberto: a metade de cá do animal passou por cima
      if (!boneco && !coberto && base[i]) {
        if (B(X - 1, Y) || B(X, Y - 1)) g.fino(X, Y, M.misturar(c, TRACO, 0.5));
        else if (B(X + 1, Y) || B(X, Y + 1)) g.fino(X, Y, M.misturar(c, TRACO, 0.3));
      } else if (boneco && !coberto && Y + 1 < CH && fim[i + CW] !== meio[i + CW] && B(X, Y + 1)) g.fino(X, Y, M.misturar(c, TRACO, 0.38));
    }
  }

  // ----- o cavaleiro sobre a montaria -----
  // ARREIOS[tipo].assento: linha do boneco (px da célula de 48 × 64) que assenta na sela
  function desenharMontado(g, cfg, quadro, tipo) {
    const v = Math.floor(quadro / QPV), q = quadro % QPV;
    if (tipo === "carro" || !ARREADOS[tipo]) return desenharCarro(g, cfg, v, q);
    // de lado a montaria sobe 3 px na célula: o meio do corpo fica sobre o mesmo ponto do chão das outras vistas
    const r = animalPronto(tipo, v, q, CW, CH, v === 0 ? { dy: -3 } : null);
    const ox = r.sela[0] - N.CX + (v === 0 ? -1 : 0), oy = r.sela[1] - ARREIOS[tipo].assento - (v === 0 ? 0 : ARREIOS[tipo].fundoFV || 5); // fundoFV: ajuste do assento de frente e de costas (padrão 5; no camelo −3: senta no alto da corcova e as pernas descem pelos lados)
    // o cavaleiro não dá passos: parado sobre o balanço da montaria; a antecipação e o golpe são os dele
    const hq = v * QPV + (q >= 6 ? q : 0);
    const o = { ox, oy, montado: true, limites: [1 - ox, 1 - oy, CW - 2 - ox, CH - 3 - oy] };
    const couro = COR_REDEA;
    if (v === 0) {
      colar(g, r, CW, CH);
      const base = retrato(g);
      const P = HE.desenhar(g, cfg, hq, o);
      recortar(g, base, null);
      if (r.boca && !P.golpe) redea(g, [r.boca[0], r.boca[1]], [P.maoArma[0] + ox + 1, P.maoArma[1] + oy], couro, 1.6);
      else if (r.boca && r.pito) redea(g, r.boca, [r.pito[0], r.pito[1] - 1], couro, 2);
    } else {
      colar(g, r, CW, CH, "fundo");
      const base = retrato(g);
      HE.desenhar(g, cfg, hq, o);
      const comBoneco = retrato(g);
      colar(g, r, CW, CH, "frente");
      recortar(g, base, comBoneco);
    }
  }

  // -------------------------------------------------------------------
  // Carro de duas rodas puxado por uma parelha. Peças no espaço do carro (f para a frente, l lateral,
  // z altura; origem no chão sob o eixo), projetadas pela mesma câmera oblíqua do quadrúpede.
  // -------------------------------------------------------------------
  const COR_REDEA = "#3a2418";
  const SP = Math.sin(38 * GRAU), CP = Math.cos(38 * GRAU), ESCORCO = 0.86, LARGO = 1.16;
  const projecao = (v, ox, oy) => (f, l, z) => {
    const x = v === 0 ? f : v === 1 ? -l * LARGO : l * LARGO, y = v === 0 ? l : v === 1 ? f * ESCORCO : -f * ESCORCO;
    return [ox + x, oy + y * SP - z * CP];
  };
  // polígono convexo cheio; cor = string ou (X, Y) => cor
  function poli(g, pts, cor) {
    let y0 = 1e9, y1 = -1e9;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let Y = Math.round(y0); Y <= Math.round(y1); Y++) {
      let a = 1e9, b = -1e9;
      const yc = clamp(Y, y0, y1);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], n = pts[(i + 1) % pts.length];
        if ((p[1] <= yc && n[1] >= yc) || (n[1] <= yc && p[1] >= yc)) {
          const x = p[1] === n[1] ? p[0] : p[0] + ((yc - p[1]) / (n[1] - p[1])) * (n[0] - p[0]);
          a = Math.min(a, x, p[1] === n[1] ? n[0] : x); b = Math.max(b, x, p[1] === n[1] ? n[0] : x);
        }
      }
      for (let X = Math.round(a); X <= Math.round(b); X++) g.fino(X, Y, typeof cor === "function" ? cor(X, Y) : cor);
    }
  }
  const MAD = rampa6("#8a5a30", "madeira"), MADE = rampa6("#5e3c1c", "madeira"), VIME = rampa6("#c0914e", "madeira"), VIMEE = rampa6("#8a6234", "madeira");
  const BRZ = rampa6("#c8923e", "metal"), TINTA = rampa6("#a8382a", "pano");
  const C = { hw: 8, z0: 12, tras: -8, frente: 9, zt: 29, zf: 38, roda: 12, eixo: 10.5, D: 23, lado: -3.5, parelha: [-6.5, 6.5] };
  // roda de lado: aro de madeira com a cinta, 6 raios e o cubo de bronze; fase 0..3 gira um sexto de volta
  function rodaLado(g, cx, cy, r, fase, longe) {
    const rot = (fase / 4) * (Math.PI / 3), W = longe ? MADE : MAD;
    for (let Y = Math.floor(cy - r); Y <= Math.ceil(cy + r); Y++) for (let X = Math.floor(cx - r); X <= Math.ceil(cx + r); X++) {
      const dx = X + 0.5 - cx, dy = Y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > r) continue;
      const luz = (-dx - dy) / (r * 1.3);
      if (d > r - 1) g.fino(X, Y, sombrear(longe ? MADE : BRZ, luz * 0.8 - (longe ? 0.5 : 0.35), X, Y, false));
      else if (d > r - 2.6) g.fino(X, Y, sombrear(W, luz + 0.1, X, Y, false));
      else if (d < 1.9) g.fino(X, Y, sombrear(BRZ, luz * 2 + (longe ? -0.5 : 0.2), X, Y, false));
      else {
        let a = (Math.atan2(dy, dx) - rot) % (Math.PI / 3); if (a < 0) a += Math.PI / 3;
        if (Math.min(a, Math.PI / 3 - a) * d < 0.62) g.fino(X, Y, sombrear(W, luz * 0.6 - 0.15, X, Y, false));
        else g.fino(X, Y, longe ? "#2a1a14" : dy > -1 ? "#3a2418" : "#4a3020"); // o vão entre os raios, na sombra do carro
      }
    }
  }
  // roda de topo (de frente e de costas): barra de 3 px com o cubo para fora e um brilho que anda
  function rodaTopo(g, x, cy, alt, fase, fora) {
    const y0 = Math.round(cy - alt), y1 = Math.round(cy + alt);
    for (let Y = y0; Y <= y1; Y++) {
      const ponta = Y === y0 || Y === y1, t = (Y - y0) / (y1 - y0);
      for (let i = ponta ? 0 : -1; i <= (ponta ? 0 : 1); i++) {
        const marca = ((Y - y0 + fase * 2) % 8 + 8) % 8 < 2;
        g.fino(x + i, Y, i * fora > 0 ? sombrear(BRZ, 0.2 - t * 0.9 + (marca ? 0.4 : 0), 0, 0, false) : sombrear(MAD, (i === 0 ? 0.1 : -0.5) - t * 0.5 + (marca ? 0.35 : 0), 0, 0, false));
      }
    }
    const yc = Math.round(cy);
    for (let j = -1; j <= 1; j++) for (let i = 1; i <= 3; i++) g.fino(x + fora * i, yc + j, sombrear(BRZ, 0.5 - j * 0.5 - (i === 3 ? 0.4 : 0), 0, 0, false));
  }
  const vime = (R, x0, vies) => (X, Y) => sombrear(R, ((X + Y * 2) % 4 < 2 ? 0.28 : -0.12) + ((X - Y) % 5 === 0 ? -0.35 : 0) + vies - (X - x0) * 0.03, X, Y, false);
  // Devolve { pes: [X, Y] (onde o condutor pisa), mao: ponto das rédeas }.
  function desenharCarroEm(g, W, H, v, q, cavaleiro, k) {
    k = k || {};
    const fase = q >= 2 && q <= 5 ? q - 2 : 0, tranco = q === 3 || q === 5 ? 1 : 0;
    // de costas a parelha vai 16 px mais à frente: senão o condutor a cobre inteira e só sobram as orelhas
    const D = (k.D || C.D) + (v === 2 ? 16 : 0), dProf = D * ESCORCO * SP;
    // origem do carro (chão sob o eixo) em cada vista
    const ox = v === 0 ? Math.round(W / 2 - 20) + (k.dx || 0) : W / 2, oy = v === 0 ? H - 9 - (k.sobe === undefined ? 3 : k.sobe) : v === 1 ? H - 10 - Math.round(dProf) : H - 10;
    const T = projecao(v, ox, oy - tranco), T0 = projecao(v, ox, oy);
    const R = (f, l, z) => { const a = T(f, l, z); return [Math.round(a[0]), Math.round(a[1])]; };
    const qa = q >= 6 ? q - 6 : q; // o cavalo de tiro não dá o bote: no golpe fica parado e respira
    const cav = (parte) => {
      // parelha: dois cavalos lado a lado no varal (o de lá primeiro). De costas o condutor fica entre os
      // dois e eles aparecem um de cada lado; de frente cobrem a caixa; de lado o de lá sai por trás.
      let r = null, sx = 0, sy = 0;
      for (const l0 of C.parelha) {
        const l = l0 * (v === 2 ? 1.3 : 1); // de costas abrem um pouco mais, para sobrar garupa de cada lado do condutor
        const c = T0(D + (v === 0 && l < 0 ? 2 : 0), l, 0);
        r = animalPronto("tiro", v, qa, W, H, Object.assign({ ox: Math.round(c[0]), oy: Math.round(c[1]) }, k.porte ? { porte: k.porte } : null));
        colar(g, r, W, H, parte);
        sx += r.sela[0] / 2; sy += r.sela[1] / 2;
      }
      return { sela: [Math.round(sx), Math.round(sy)], boca: r.boca };
    };
    const pes = R(0.5, v === 0 ? C.lado : 0, C.z0), hw = C.hw;
    const piso = () => poli(g, [T(C.tras, -hw, C.z0), T(C.frente, -hw, C.z0), T(C.frente, hw, C.z0), T(C.tras, hw, C.z0)], (X, Y) => sombrear(MADE, (Y % 3 === 0 ? -0.5 : 0.05) - 0.2, X, Y, false));
    const varal = (r) => { const a = T(C.frente, 0, C.z0 + 1), b = r.sela; prim.linF(g, Math.round(a[0]), Math.round(a[1]), b[0] - (v === 0 ? 2 : 0), b[1] + (v === 0 ? 5 : 3), (X, Y, i) => MAD[i % 5 === 0 ? 1 : 3], 2); };
    if (v === 0) {
      const r = cav();
      // roda e parede de longe, piso
      const rl = T(0, -C.eixo, 0), rp = T(0, C.eixo, 0);
      rodaLado(g, rl[0], rl[1] - C.roda, C.roda, fase, true);
      poli(g, [T(C.tras, -hw, C.z0), T(C.frente, -hw, C.z0), T(C.frente, -hw, C.zf), T(C.tras, -hw, C.zt)], vime(VIMEE, ox, -0.3));
      piso();
      varal(r);
      const P = cavaleiro ? cavaleiro(pes) : null;
      // parede de perto: vime com a moldura de madeira, a barra pintada e o corrimão de bronze
      const a = R(C.tras, hw, C.z0), b = R(C.frente, hw, C.z0), c = R(C.frente, hw, C.zf), d = R(C.tras, hw, C.zt);
      poli(g, [a, b, c, d], vime(VIME, a[0], 0.15));
      prim.linF(g, a[0], a[1], b[0], b[1], (X) => MAD[X % 4 === 0 ? 1 : 2], 2);
      poli(g, [[d[0] + 1, d[1] + 3], [c[0] - 1, c[1] + 3], [c[0] - 1, c[1] + 5], [d[0] + 1, d[1] + 5]], (X, Y) => sombrear(TINTA, 0.3 - (X - a[0]) * 0.03, X, Y, false));
      prim.linF(g, a[0], a[1], d[0], d[1], (X, Y, i) => sombrear(MAD, 0.5 - i * 0.03, X, Y, false), 2);
      prim.linF(g, b[0], b[1], c[0], c[1], (X, Y, i) => sombrear(MAD, 0.0, X, Y, false), 2);
      prim.linF(g, d[0], d[1], c[0], c[1], (X, Y, i) => sombrear(BRZ, 0.6 - i * 0.05, X, Y, false), 1);
      prim.linF(g, d[0], d[1] + 1, c[0], c[1] + 1, MAD[1], 1);
      rodaLado(g, rp[0], rp[1] - C.roda, C.roda, fase, false);
      // rédeas: da boca do cavalo à mão do condutor
      const mao = P ? [P.maoArma[0] + P.__ox + 1, P.maoArma[1] + P.__oy] : [c[0] - 1, c[1]];
      if (r.boca) redea(g, r.boca, mao, COR_REDEA, 2.2);
      return;
    }
    const xr = Math.round(C.eixo * LARGO), cyR = T(0, 0, 0)[1] - C.roda, altR = Math.hypot(C.roda, (C.roda / CP) * ESCORCO * SP);
    const xe = Math.round(W / 2 - hw * LARGO), xd = Math.round(W / 2 + hw * LARGO) - 1;
    if (v === 1) {
      // de frente: piso e paredes de topo, o condutor, o painel da frente, as rodas e o cavalo por cima
      piso();
      for (const x of [xe, xd]) { const a = R(C.tras, 0, C.zt), b = R(C.frente, 0, C.zf); for (let Y = a[1]; Y <= b[1]; Y++) { g.fino(x, Y, MADE[2]); g.fino(x + (x === xe ? 1 : -1), Y, VIMEE[2]); } }
      if (cavaleiro) cavaleiro(pes);
      const yb = R(C.frente, 0, C.z0)[1], yt = R(C.frente, 0, C.zf)[1];
      for (let Y = yt; Y <= yb; Y++) for (let X = xe; X <= xd; X++) {
        const u = (X - xe) / (xd - xe), arco = Math.round(Math.pow(Math.abs(u - 0.5) * 2, 2) * 2.2);
        if (Y < yt + arco) continue;
        const borda = Y === yt + arco, luz = 0.55 - u * 1.1 - Math.pow(Math.abs(u - 0.4) * 1.6, 2) * 0.4;
        g.fino(X, Y, borda ? sombrear(BRZ, luz + 0.3, X, Y, false) : Y === yt + arco + 1 ? MAD[1] : Y >= yb - 1 ? sombrear(MAD, luz - 0.2, X, Y, false) : Y >= yb - 6 && Y <= yb - 4 ? sombrear(TINTA, luz, X, Y, false) : X === xe || X === xd ? sombrear(MAD, luz, X, Y, false) : vime(VIME, xe, luz * 0.5)(X, Y));
      }
      rodaTopo(g, Math.round(W / 2) - xr - 1, cyR, altR, fase, -1); rodaTopo(g, Math.round(W / 2) + xr, cyR, altR, fase, 1);
      cav();
      return;
    }
    // de costas: o cavalo lá na frente, o varal, o painel da frente por dentro, as paredes de topo, o piso, as rodas e o condutor
    const r = cav();
    varal(r);
    const yb = R(C.frente, 0, C.z0)[1], yt = R(C.frente, 0, C.zf)[1];
    for (let Y = yt; Y <= yb; Y++) for (let X = xe; X <= xd; X++) {
      const u = (X - xe) / (xd - xe), arco = Math.round(Math.pow(Math.abs(u - 0.5) * 2, 2) * 2.2);
      if (Y < yt + arco) continue;
      g.fino(X, Y, Y === yt + arco ? sombrear(BRZ, 0.5 - u, X, Y, false) : vime(VIMEE, xe, -0.25 - u * 0.3)(X, Y));
    }
    piso();
    for (const x of [xe, xd]) {
      const a = R(C.tras, 0, C.z0), b = R(C.tras, 0, C.zt), c = R(C.frente, 0, C.zf), s = x === xe ? 1 : -1;
      for (let Y = c[1]; Y <= a[1]; Y++) { const rim = Y < b[1]; g.fino(x, Y, rim ? sombrear(BRZ, x === xe ? 0.4 : -0.2, x, Y, false) : MAD[x === xe ? 3 : 2]); g.fino(x + s, Y, rim ? VIMEE[x === xe ? 3 : 1] : MAD[x === xe ? 2 : 1]); }
    }
    rodaTopo(g, Math.round(W / 2) - xr - 1, cyR, altR, fase, -1); rodaTopo(g, Math.round(W / 2) + xr, cyR, altR, fase, 1);
    if (cavaleiro) cavaleiro(pes);
  }
  function desenharCarro(g, cfg, v, q) {
    desenharCarroEm(g, CW, CH, v, q, (pes) => {
      const ox = pes[0] - N.CX, oy = pes[1] - N.PES;
      const base = retrato(g);
      const P = HE.desenhar(g, cfg, v * QPV + (q >= 6 ? q : 0), { ox, oy, limites: [1 - ox, 1 - oy, CW - 2 - ox, CH - 3 - oy] });
      recortar(g, base, null); // o condutor destaca-se da parelha e da caixa
      P.__ox = ox; P.__oy = oy;
      return P;
    });
  }

  // ----- prévias da loja: a montaria arreada, de lado, parada (64 × 64 px, 1 quadro) -----
  const PW = 64, PH = 64, PORTE_PREVIA = { cavalo: 0.92, jumento: 1.08, camelo: 0.9 };
  for (const tipo of ["jumento", "cavalo", "camelo"]) {
    if (!ARREADOS[tipo]) continue;
    registrar("mt_" + tipo, {
      w: PW / 2, h: PH / 2, quadros: 1, contorno: "amigo", origem: [0.5, 1], acabamento: false, textura: false, limiteCores: 96,
      desenhar(g) {
        const r = animalPronto(tipo, 0, 0, PW, PH, { porte: PORTE_PREVIA[tipo] });
        colar(g, r, PW, PH);
        if (r.boca && r.pito) redea(g, r.boca, [r.pito[0], r.pito[1] - 1], COR_REDEA, 2.4);
      },
    });
  }
  registrar("mt_carro", {
    w: PW / 2, h: PH / 2, quadros: 1, contorno: "amigo", origem: [0.5, 1], acabamento: false, textura: false, limiteCores: 96,
    desenhar(g) { desenharCarroEm(g, PW, PH, 0, 0, null, { porte: 0.68, D: 20, dx: 5, sobe: 0 }); },
  });

  // -------------------------------------------------------------------
  // mk_barco: barco de pesca de um mastro, com a carga do dia (cesto, rede, ânfora, remos). Casco, bancos, mastro e vela são
  // superfícies no espaço do barco (f para a proa, l para boreste, z altura), amostradas num z-buffer
  // pela mesma câmera oblíqua: as três vistas saem do mesmo modelo. 4 quadros de balanço (arfagem e
  // vela que enfuna); a espuma da proa e a esteira entram depois do contorno.
  // -------------------------------------------------------------------
  const BW = 64, BH = 64, BQ = 4;
  const LUZ = (() => { const v = [-0.58, 0.3, 0.76], n = Math.hypot(v[0], v[1], v[2]); return v.map((c) => c / n); })();
  const CASCO = rampa6("#8a5a30", "madeira"), CASCOE = rampa6("#5a3a20", "madeira"), BANCO = rampa6("#b08450", "madeira");
  const BARRO = rampa6("#b8663a", "pedra"), VELA = rampa6("#eadcb6", "pano"), FAIXA = rampa6("#3b5a9a", "pano"), FAIXA2 = rampa6("#b04a36", "pano"), CESTO = rampa6("#c0914e", "madeira"), REDE = rampa6("#7a8a5a", "pano");
  const B = { L: 25, hw: 9, piso: 2, mastro: 2, topo: 46, verga: 42, pe: 14, meia: 15, ang: 46 * GRAU, popa: -16, esc: 1.0 };
  const meiaBoca = (f) => { const t = f / B.L, a = Math.abs(t); return a >= 1 ? 0 : B.hw * Math.pow(1 - Math.pow(a, t > 0 ? 2.0 : 2.6), t > 0 ? 0.85 : 0.6); };
  const borda = (f) => { const t = f / B.L; return 6.4 + 4.2 * t * t + (t > 0 ? 1.8 * t * t * t : 0); };
  class Casco {
    constructor(v, ox, oy, de) {
      this.v = v; this.ox = ox; this.oy = oy;
      const n = BW * BH;
      this.zb = de ? de.zb.slice() : new Float32Array(n).fill(-1e9); this.cor = de ? de.cor.slice() : new Array(n).fill(null); this.X = 0; this.Y = 0;
    }
    // barco -> tela
    tela(f, l, z) {
      const v = this.v, x = v === 0 ? f : v === 1 ? -l * LARGO : l * LARGO, y = v === 0 ? l : v === 1 ? f * B.esc : -f * B.esc;
      return [this.ox + x, this.oy + y * SP - z * CP];
    }
    // testa a profundidade e devolve o índice do px (ou −1 se outro ponto mais perto já o cobre);
    // quem chama só calcula a cor quando passa
    pt(f, l, z) {
      const v = this.v, x = v === 0 ? f : v === 1 ? -l * LARGO : l * LARGO, y = v === 0 ? l : v === 1 ? f * B.esc : -f * B.esc;
      const X = Math.floor(this.ox + x), Y = Math.floor(this.oy + y * SP - z * CP);
      if (X < 0 || Y < 0 || X >= BW || Y >= BH) return -1;
      const i = Y * BW + X, d = y * CP + z * SP;
      if (d <= this.zb[i]) return -1;
      this.zb[i] = d; this.X = X; this.Y = Y;
      return i;
    }
    // luz de uma normal dada no espaço do barco
    luz(nf, nl, nz) {
      const v = this.v, nx = v === 0 ? nf : v === 1 ? -nl : nl, ny = v === 0 ? nl : v === 1 ? nf : -nf, n = Math.hypot(nx, ny, nz) || 1;
      return ((nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2]) / n) * 1.5 - 0.45;
    }
  }
  const cacheBarco = new Map();
  // casco, carga e mastro: um modelo por vista; a vela entra por cima em cada quadro
  const ORIGEM_BARCO = (v) => [v === 0 ? 33 : 32, v === 0 ? BH - 12 : v === 1 ? BH - 22 : BH - 22];
  function cascoPronto(v) {
    let K = cacheBarco.get("casco" + v);
    if (K) return K;
    const [ox, oy] = ORIGEM_BARCO(v);
    K = new Casco(v, ox, oy);
    const L = B.L, cor = K.cor, S = (R, l) => sombrear(R, l, K.X, K.Y, false);
    let i;
    // passo da amostragem em cada eixo: pouco menos de 1 px na tela desta vista
    const pf = v === 0 ? 0.48 : 0.5, pl = v === 0 ? 0.7 : 0.42, pz = 0.55;
    // casco por fora (tábuas em fiadas, a faixa molhada na linha d'água) e por dentro
    for (let f = -L; f <= L; f += pf) {
      const w = meiaBoca(f), zg = borda(f), t = f / L;
      if (w <= 0.05) continue;
      for (let z = 0; z <= zg; z += pz) {
        const u = z / zg, pu = Math.pow(u, 0.8), fiada = (z % 2.7) < pz;
        for (const sl of [-1, 1]) {
          // de lado, o costado de longe por fora e o de perto por dentro nunca aparecem
          if (!(v === 0 && sl < 0) && (i = K.pt(f * (0.9 + 0.1 * u), sl * w * (0.58 + 0.42 * pu), z)) >= 0) {
            const lz = K.luz(t * 0.9, sl, -0.55 + u * 0.5) + (u - 0.5) * 0.35;
            cor[i] = z < 0.9 ? S(CASCOE, lz - 0.5) : S(CASCO, lz - (fiada ? 0.55 : 0) + (hash2(Math.round(f * 2), Math.round(z / 2.7), 7) - 0.5) * 0.16);
          }
          if (z >= B.piso && !(v === 0 && sl > 0) && (i = K.pt(f * 0.93, sl * Math.max(0, w * (0.5 + 0.42 * pu) - 0.9), z)) >= 0) cor[i] = S(CASCOE, K.luz(0, -sl, 0.3) * 0.7 - 0.15 - (fiada ? 0.3 : 0));
        }
      }
      // a borda (alcatrate): a régua clara por cima
      for (const sl of [-1, 1]) for (let d = 0; d <= 1.1; d += 0.5) if ((i = K.pt(f, sl * (w - d), zg + 0.35)) >= 0) cor[i] = S(BANCO, K.luz(0, sl * 0.2, 1) + 0.15 - d * 0.2);
      // piso (paneiro) com as cavernas
      const wi = Math.max(0, w * 0.62 - 0.6), cav = Math.abs(f % 6) < 0.4;
      for (let l = -wi; l <= wi; l += pl) if ((i = K.pt(f * 0.93, l, B.piso)) >= 0) cor[i] = S(CASCOE, (cav ? 0.25 : -0.25) + (Math.abs(l % 2.4) < 0.35 ? -0.3 : 0));
    }
    // roda de proa e cadaste (as pontas que sobem)
    for (let u = 0; u <= 1; u += 0.04) for (let d = -0.5; d <= 0.5; d += 0.5) {
      if ((i = K.pt(L - 1.4 + u * 1.6 + u * u * 0.8, d, borda(L) - 2 + u * 7.5)) >= 0) cor[i] = S(CASCO, 0.35 - u * 0.2 - d * 0.5);
      if ((i = K.pt(-L + 1.6 - u * 1.2 + u * u * 1.6, d, borda(-L) - 2 + u * 5.5)) >= 0) cor[i] = S(CASCO, 0.25 - d * 0.5);
    }
    // bancos
    for (const fb of [B.popa, -4, 11]) {
      const w = meiaBoca(fb) - 1.1, z = borda(fb) - 1.9;
      for (let f = fb - 1.5; f <= fb + 1.5; f += pf) for (let l = -w; l <= w; l += pl) if ((i = K.pt(f, l, z)) >= 0) cor[i] = S(BANCO, 0.35 - (f - fb) * 0.12 * (v === 0 ? 1 : 0) - l * 0.03);
    }
    // carga: o cesto do peixe, a rede enrolada, dois remos deitados a bombordo e a ânfora de água
    for (let a = 0; a < Math.PI * 2; a += 0.16) for (let z = B.piso; z <= 6.4; z += 0.42) {
      const rr = 2.6 + (z - B.piso) * 0.12;
      if ((i = K.pt(15.5 + Math.cos(a) * rr, -1.5 + Math.sin(a) * rr, z)) >= 0) cor[i] = S(CESTO, K.luz(Math.cos(a), Math.sin(a), 0.2) + ((K.X + K.Y * 2) % 3 === 0 ? -0.3 : 0.1));
    }
    for (let a = 0; a < Math.PI * 2; a += 0.2) for (let rr = 0; rr <= 2.5; rr += 0.42) if ((i = K.pt(15.5 + Math.cos(a) * rr, -1.5 + Math.sin(a) * rr, 6.5)) >= 0) cor[i] = (K.X * 3 + K.Y) % 4 === 0 ? "#dfe8ea" : (K.X + K.Y) % 2 ? "#8aa0a8" : "#b4c4c8";
    for (let a = 0; a < Math.PI * 2; a += 0.14) for (let b = 0; b < Math.PI; b += 0.25) if ((i = K.pt(8.3 + Math.cos(a) * Math.sin(b) * 2.2, 3.2 + Math.sin(a) * Math.sin(b) * 2.6, B.piso + Math.cos(b) * 0.2 + 1.6 * Math.sin(b))) >= 0) cor[i] = S(REDE, ((K.X + K.Y) % 2 ? 0.25 : -0.35) + Math.sin(b) * 0.2);
    for (let f = -13; f <= 13; f += 0.42) for (const dl of [0, 1.3]) if ((i = K.pt(f, -meiaBoca(f * 0.9) * 0.62 + 1.2 + dl, B.piso + 1.2 + (f + 13) * 0.07)) >= 0) cor[i] = S(BANCO, (dl ? -0.2 : 0.3) - (f > 9 ? 0.35 : 0));
    for (let a = 0; a < Math.PI * 2; a += 0.18) for (let z = 0; z <= 6.6; z += 0.42) {
      const rr = z < 4 ? 1.5 + Math.sin((z / 4) * Math.PI) * 1.3 : z < 5.6 ? 1.0 : 1.5;
      if ((i = K.pt(-10 + Math.cos(a) * rr, 2.4 + Math.sin(a) * rr, B.piso + z)) >= 0) cor[i] = S(BARRO, K.luz(Math.cos(a), Math.sin(a), 0.3) + 0.1);
    }
    // mastro
    for (let z = B.piso; z <= B.topo; z += pz) for (const [df, dl] of [[0, 0], [0.7, 0], [0, 0.7], [0.7, 0.7]]) if ((i = K.pt(B.mastro + df - 0.35, dl - 0.35, z)) >= 0) cor[i] = S(CASCO, 0.45 - (df + dl) * 0.6);
    // remo de governo a boreste da popa
    for (let u = 0; u <= 1; u += 0.03) {
      const f = -L + 5 - u * 9, l = meiaBoca(-L + 5) + 0.6 + u * 1.5, z = borda(-L + 5) + 2.5 - u * 9.5;
      for (const d of u > 0.72 ? [-0.9, -0.3, 0.3, 0.9] : [0]) if ((i = K.pt(f, l, z + d)) >= 0) cor[i] = S(BANCO, 0.2 - u * 0.5 - d * 0.2);
    }
    cacheBarco.set("casco" + v, K);
    return K;
  }
  // Balanço em 4 quadros sobre o modelo parado: 0 em repouso, 1 proa para cima (de lado) ou o mastro
  // caindo para um bordo (de frente e de costas), 2 o barco inteiro 1 px acima, 3 o contrário do 1.
  function barcoPronto(v, q) {
    const id = v + "|" + q;
    let r = cacheBarco.get(id);
    if (r) return r;
    const base = cascoPronto(v), K = new Casco(v, base.ox, base.oy, base), L = B.L, cor = K.cor, S = (R, l) => sombrear(R, l, K.X, K.Y, false);
    const enfuna = [3.4, 4.2, 3.6, 2.8][q], pz = v === 0 ? 0.55 : 0.36;
    let i;
    // verga e vela redonda, braceada para aparecer nas três vistas
    const dF = Math.sin(B.ang), dL = Math.cos(B.ang), nF = Math.cos(B.ang), nL = -Math.sin(B.ang), alt = B.verga - B.pe;
    for (let sv = -B.meia - 1; sv <= B.meia + 1; sv += 0.4) for (const dz of [0, 0.6]) if ((i = K.pt(B.mastro + 1 + sv * dF, sv * dL, B.verga + 0.6 + dz)) >= 0) cor[i] = S(CASCO, 0.3 - dz);
    for (let sv = -B.meia; sv <= B.meia; sv += v === 0 ? 0.45 : 0.3) {
      const us = (sv + B.meia) / (2 * B.meia), sus = Math.sin(Math.PI * us);
      const incl = Math.cos(Math.PI * us) * enfuna * 0.11, costura = Math.abs(((sv + 40) % 5) - 2.5) < 0.21;
      for (let z = B.pe; z <= B.verga; z += pz) {
        const uz = (B.verga - z) / alt, bojo = enfuna * sus * Math.sin(Math.PI * Math.min(1, uz * 1.15) * 0.82), s2 = sv * (1 - 0.1 * uz);
        if ((i = K.pt(B.mastro + 1.2 + s2 * dF + nF * bojo, s2 * dL + nL * bojo, z)) < 0) continue;
        // normal do pano: a frente da vela (para onde enfuna) e as dobras do bojo
        const lz = K.luz(nF - dF * incl, nL - dL * incl, 0.25 - uz * 0.5), bainha = uz > 0.96;
        const R = uz > 0.2 && uz < 0.3 ? FAIXA : uz > 0.34 && uz < 0.38 ? FAIXA2 : uz > 0.78 && uz < 0.83 ? FAIXA : VELA;
        cor[i] = S(R, Math.abs(lz) * 0.9 + 0.2 - (costura ? 0.3 : 0) - (bainha ? 0.35 : 0) + sus * 0.34 - uz * 0.3 + (0.5 - us) * 0.4 * (v === 1 ? -1 : 1));
      }
    }
    const jogo = [0, 1, 0, -1][q], sobe = q === 2 ? -1 : 0, linha = K.tela(0, 0, 0)[1];
    // de lado a proa sobe e desce (colunas); de frente e de costas o mastro pende (linhas)
    const tf = (X, Y) => (v === 0 ? [X, Y + sobe - Math.round((jogo * (X - K.ox)) / 21)] : [X + Math.round((jogo * (linha - Y)) / 26), Y + sobe]);
    const px = new Array(BW * BH).fill(null);
    for (let k = 0; k < cor.length; k++) if (cor[k]) { const t = tf(k % BW, (k / BW) | 0); if (t[0] >= 0 && t[1] >= 0 && t[0] < BW && t[1] < BH) px[t[1] * BW + t[0]] = cor[k]; }
    const A = (f, l, z) => { const t = K.tela(f, l, z); return tf(Math.round(t[0]), Math.round(t[1])); };
    r = { px, escota: A(B.mastro + 1.2 - B.meia * 0.9 * dF, -B.meia * 0.9 * dL, B.pe), escota2: A(B.mastro + 1.2 + B.meia * 0.9 * dF, B.meia * 0.9 * dL, B.pe),
      topo: A(B.mastro, 0, B.topo), proa: A(L + 0.8, 0, borda(L) + 5), re: A(-L + 1, 0, borda(-L) + 3), agua: (f, l) => A(f, l, 0),
      cunho: A(B.popa, -meiaBoca(B.popa), borda(B.popa)), cunho2: A(B.popa, meiaBoca(B.popa), borda(B.popa)) };
    cacheBarco.set(id, r);
    return r;
  }
  function desenharBarco(g, quadro) {
    const v = Math.floor(quadro / BQ), q = quadro % BQ, r = barcoPronto(v, q);
    const corda = "#4a3626", cabo = "#6a5238";
    for (let i = 0; i < r.px.length; i++) if (r.px[i]) g.fino(i % BW, (i / BW) | 0, r.px[i]);
    // estais (do topo do mastro à proa e à popa) e as escotas (das pontas da vela à popa)
    prim.linF(g, r.topo[0], r.topo[1], r.proa[0], r.proa[1], corda, 1);
    if (v !== 1) { prim.linF(g, r.topo[0], r.topo[1], r.re[0], r.re[1], corda, 1); redea(g, r.escota, r.cunho, cabo, 1.5); }
    if (v === 0) redea(g, r.escota2, r.cunho2, cabo, 1.2);
    // a sombra do casco na água
    for (let X = 0; X < BW; X++) {
      let y = -1;
      for (let Y = BH - 1; Y >= BH - 30; Y--) if (r.px[Y * BW + X]) { y = Y; break; }
      if (y > 0) { g.sombraPx(X, y + 1, 0.4, "#0e2a3a"); g.sombraPx(X, y + 2, 0.26, "#0e2a3a"); g.sombraPx(X, y + 3, 0.12, "#0e2a3a"); }
    }
  }
  // espuma: a onda da proa e a esteira, por cima do contorno (px claros, sem borda escura)
  function espumaBarco(g, quadro) {
    const v = Math.floor(quadro / BQ), q = quadro % BQ, r = barcoPronto(v, q);
    const E = ["#f4fbf8", "#cfeae6", "#9fd0cf"], L = B.L;
    const px = (X, Y, i, a) => { if (X >= 0 && Y >= 0 && X < BW && Y < BH) g.fino(X, Y, comAlfa(E[i], a)); };
    if (v === 0) {
      // linha d'água do costado de perto, a onda da proa e a esteira atrás da popa
      for (let f = -L + 3; f <= L - 2; f += 1) { const p = r.agua(f * 0.9, meiaBoca(f) * 0.58); if ((Math.round(f) + q * 2) % 5 < 3) px(p[0], p[1] + 1, 1, 0.8); }
      const b = r.agua(L * 0.9, 0);
      for (let k = 0; k < 6; k++) { px(b[0] + 1 - k, b[1] + 1 + (k >> 1) + (q % 2), 0, 0.95); px(b[0] + 2 - k, b[1] - (k >> 1) - (k > 2 ? 1 : 0), k < 3 ? 0 : 1, 0.85); }
      px(b[0] + 2, b[1], 0, 1); px(b[0] + 3, b[1] + q % 2, 1, 0.8);
      const s = r.agua(-L * 0.9, 0);
      for (let k = 0; k < 9; k++) {
        const fora = 1 + (k >> 1);
        if ((k + q) % 4 !== 3) px(s[0] - 2 - k, s[1] + 3 + fora - (k > 6 ? 1 : 0), k < 4 ? 0 : 1, 0.9 - k * 0.07);
        if ((k + q) % 4 !== 1) px(s[0] - 2 - k, s[1] - fora, k < 3 ? 1 : 2, 0.8 - k * 0.07);
        if ((k + q * 3) % 5 < 2) px(s[0] - 3 - k, s[1] + 1 + ((k + q) % 3), 2, 0.7);
      }
      return;
    }
    if (v === 1) {
      // de frente: o bigode de espuma abrindo da proa para os lados
      const b = r.agua(L * 0.9, 0);
      for (const sl of [-1, 1]) for (let k = 0; k < 9; k++) {
        const X = b[0] + sl * (1 + k) - (sl < 0 ? 0 : 1), Y = b[1] + 2 - Math.round(k * 0.75) + ((k + q) % 3 === 0 ? 1 : 0);
        if ((k + q) % 5 !== 4) px(X, Y, k < 4 ? 0 : 1, 0.95 - k * 0.06);
        if (k > 1 && (k + q) % 3 === 0) px(X + sl, Y + 1, 2, 0.7);
      }
      px(b[0] - 1, b[1] + 3, 0, 1); px(b[0], b[1] + 3, 0, 1);
      return;
    }
    // de costas: a esteira que fica para trás (para baixo na tela) e a água que abre lá na proa
    const s = r.agua(-L * 0.9, 0);
    for (const sl of [-1, 1]) for (let k = 0; k < 6; k++) {
      const X = s[0] + sl * (2 + Math.round(k * 1.6)) - (sl < 0 ? 0 : 1), Y = s[1] + 2 + (k >> 1) + ((k + q) % 2);
      if ((k + q) % 4 !== 3) px(X, Y, k < 3 ? 0 : 1, 0.9 - k * 0.08);
    }
    for (let k = -2; k <= 1; k++) if ((k + q + 8) % 3 !== 0) px(s[0] + k, s[1] + 3 + ((k + q + 8) % 2), 1, 0.8);
    const b = r.agua(L * 0.9, 0);
    for (const sl of [-1, 1]) for (let k = 0; k < 5; k++) if ((k + q) % 3 !== 2) px(b[0] + sl * (3 + k) - (sl < 0 ? 0 : 1), b[1] - 1 + (k >> 1), 1, 0.75 - k * 0.1);
  }
  registrar("mk_barco", {
    w: BW / 2, h: BH / 2, direcoes: 3, quadrosPorVista: BQ, quadros: 3 * BQ, ciclo: [0, 1, 2, 3], quadroAcao: [1, 3],
    origem: [0.5, 1], contorno: "amigo", acabamento: false, textura: false, limiteCores: 112, alturaCabeca: 60,
    desenhar: desenharBarco, depois: espumaBarco,
  });

  const spec = {
    w: CW / 2, h: CH / 2, quadrosPorVista: QPV, ciclo: [2, 3, 4, 5], quadroAcao: [6, 7],
    // sem alturaCabeca: cada montaria tem a sua altura e a spec é uma só — o jogo mede o desenho
    // (alturaDoDesenho em game.js: o topo mais alto entre o lado e a frente, parados)
    busto: [10, 1, 16, 17], retratoQuadro: QPV, sombra: { w: 46, h: 16 },
    acabamento: false, limiteCores: 112,
    desenhar: desenharMontado,
    depois: (g) => HE.centelhas(g),
  };
  M.montadoNovo = { spec, ARREIOS, ARREADOS, animalPronto };
  M.definirMontado(spec);
})(typeof window !== "undefined" ? window : globalThis);
