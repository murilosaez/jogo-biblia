// =====================================================================
// arte/artropode.js — artrópodes, rã e enxames.
// Pacote A3 do plano de arte.
//
// Como o desenho é feito
//   Escorpião, caranguejo e rã são esqueletos de volumes (elipsoides e cadeias de esferas) no espaço do
//   bicho: f = para a frente, l = lateral (positivo = lado direito do bicho), z = altura, em px de arte.
//   Uma câmera oblíqua (a mesma inclinação dos quadrúpedes) projeta o MESMO esqueleto de lado, de frente
//   e de costas num z-buffer que guarda, por px, profundidade, normal, material e parte. A luz vem de
//   cima e da esquerda; o tom sai de rampa6 + sombrear (pontilhado só na transição). Por cima entram o
//   brilho da carapaça, as linhas das placas (presas ao corpo), a sombra onde uma parte cobre outra e os
//   selos de 1 px (olhos, ferrão), que só aparecem se o ponto estiver à vista. Nada é bitmap girado.
//   Os enxames são insetos de 4 a 6 px desenhados à mão em 3 orientações × 2 poses de asa, espalhados
//   num volume (os de trás menores e mais escuros), cada um com o seu salpico de sombra no chão.
//
// Chaves que este arquivo assume (registrar() com a MESMA chave troca o desenho legado de sprites.js):
//   in_escorpiao in_caranguejo in_ra (40 × 40 px) · in_gafanhotos in_vespas (48 × 48 px, contorno null)
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
  const { registrar, rampa6, sombrear, misturar, hash2 } = M;

  const GRAU = Math.PI / 180;
  const INCL = 38 * GRAU, SP = Math.sin(INCL), CP = Math.cos(INCL);
  const norm = (v) => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
  const LUZ = norm([-0.58, 0.3, 0.76]);
  const MEIO = norm([LUZ[0], LUZ[1] + CP, LUZ[2] + SP]); // meio caminho entre a luz e a câmera (brilho)
  const CICLO = [2, 3, 4, 5], ACAO = [6, 7];
  // guinada de cada vista: para onde aponta a frente do bicho (0 = direita da tela, 90 = para quem olha)
  const GUINADA = [0, 90, -90];
  const mix = (a, b, t) => a + (b - a) * t;

  // -------------------------------------------------------------------
  // Cena: z-buffer de elipsoides em projeção ortográfica oblíqua.
  // -------------------------------------------------------------------
  class Cena {
    constructor(W, H, guinada, ox, oy, S) {
      this.W = W; this.H = H; this.ox = ox; this.oy = oy; this.S = S;
      this.cy = Math.cos(guinada * GRAU); this.sy = Math.sin(guinada * GRAU);
      const n = W * H;
      this.zb = new Float32Array(n).fill(-1e9);
      this.nx = new Float32Array(n); this.ny = new Float32Array(n); this.nz = new Float32Array(n);
      this.af = new Float32Array(n); this.al = new Float32Array(n); this.az = new Float32Array(n);
      this.vies = new Float32Array(n);
      this.mat = new Int8Array(n).fill(-1);
      this.parte = new Int16Array(n);
      this.viesAtual = 0; this.parteAtual = 0;
      this.arf = 0; // inclinação (rad) do grupo: nariz para cima
      this.pv = [0, 0]; this.des = [0, 0, 0];
      this.selos = [];
    }
    // grupo: parte (para a linha de sombra entre volumes) e viés de luz dos próximos volumes
    grupo(parte, vies = 0) { this.parteAtual = parte; this.viesAtual = vies; return this; }
    // pose do corpo inteiro: inclinação em torno do pivô [f, z] e deslocamento [f, l, z]
    pose(graus = 0, pivo = [0, 0], des = [0, 0, 0]) { this.arf = graus * GRAU; this.pv = pivo; this.des = des; return this; }
    // ponto do bicho -> ponto posado (ainda no espaço do bicho, em px)
    pt(p) {
      const c = Math.cos(this.arf), s = Math.sin(this.arf), f = p[0] - this.pv[0], z = p[2] - this.pv[1];
      return [(this.pv[0] + f * c - z * s + this.des[0]) * this.S, (p[1] + this.des[1]) * this.S, (this.pv[1] + f * s + z * c + this.des[2]) * this.S];
    }
    tela(p) {
      const q = this.pt(p), x = q[0] * this.cy - q[1] * this.sy, y = q[0] * this.sy + q[1] * this.cy;
      return [this.ox + x, this.oy + y * SP - q[2] * CP, y * CP + q[2] * SP];
    }
    elip(p, r, mat) {
      const W = this.W, H = this.H, S = this.S, cy = this.cy, sy = this.sy;
      const [X0, Y0, D0] = this.tela(p);
      const rf = Math.max(0.5, r[0] * S), rl = Math.max(0.5, r[1] * S), rz = Math.max(0.5, r[2] * S);
      const ct = Math.cos(this.arf), st = Math.sin(this.arf);
      // eixos locais no mundo
      const ef = [ct * cy, ct * sy, st], el = [-sy, cy, 0], ez = [-st * cy, -st * sy, ct];
      const df = CP * ef[1] + SP * ef[2], dl = CP * el[1], dz = CP * ez[1] + SP * ez[2];
      const iF = 1 / (rf * rf), iL = 1 / (rl * rl), iZ = 1 / (rz * rz);
      const a = df * df * iF + dl * dl * iL + dz * dz * iZ;
      const R = Math.max(rf, rl, rz);
      const xa = Math.max(0, Math.floor(X0 - R)), xb = Math.min(W - 1, Math.ceil(X0 + R));
      const ya = Math.max(0, Math.floor(Y0 - R)), yb = Math.min(H - 1, Math.ceil(Y0 + R));
      for (let Y = ya; Y <= yb; Y++) {
        const dv = Y + 0.5 - Y0, py = dv * SP, pz = -dv * CP;
        for (let X = xa; X <= xb; X++) {
          const dx = X + 0.5 - X0;
          const pf = dx * ef[0] + py * ef[1] + pz * ef[2], pl = dx * el[0] + py * el[1], pzz = dx * ez[0] + py * ez[1] + pz * ez[2];
          const b = 2 * (pf * df * iF + pl * dl * iL + pzz * dz * iZ);
          const c = pf * pf * iF + pl * pl * iL + pzz * pzz * iZ - 1;
          const disc = b * b - 4 * a * c;
          if (disc < 0) continue;
          const t = (-b + Math.sqrt(disc)) / (2 * a), d = D0 + t, i = Y * W + X;
          if (d <= this.zb[i]) continue;
          const qf = pf + t * df, ql = pl + t * dl, qz = pzz + t * dz;
          let nf = qf * iF, nl = ql * iL, nz = qz * iZ;
          const nn = 1 / (Math.hypot(nf, nl, nz) || 1); nf *= nn; nl *= nn; nz *= nn;
          this.zb[i] = d;
          this.nx[i] = nf * ef[0] + nl * el[0] + nz * ez[0];
          this.ny[i] = nf * ef[1] + nl * el[1] + nz * ez[1];
          this.nz[i] = nf * ef[2] + nz * ez[2];
          this.mat[i] = mat; this.parte[i] = this.parteAtual; this.vies[i] = this.viesAtual;
          this.af[i] = p[0] + qf / S; this.al[i] = p[1] + ql / S; this.az[i] = p[2] + qz / S;
        }
      }
    }
    bola(p, r, mat) { this.elip(p, [r, r, r], mat); }
    cadeia(a, r0, b, r1, mat) {
      const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * this.S, n = Math.max(1, Math.ceil(d / 0.5));
      for (let k = 0; k <= n; k++) { const t = k / n, r = r0 + (r1 - r0) * t; this.elip([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], [r, r, r], mat); }
    }
    curva(pts, raios, mat) { for (let k = 0; k < pts.length - 1; k++) this.cadeia(pts[k], raios[k], pts[k + 1], raios[k + 1], mat); }
    visivel(p, tol = 1.6) {
      const [X, Y, d] = this.tela(p), xi = Math.floor(X), yi = Math.floor(Y);
      if (xi < 0 || yi < 0 || xi >= this.W || yi >= this.H) return null;
      const i = yi * this.W + xi;
      return this.mat[i] >= 0 && d >= this.zb[i] - tol ? [xi, yi] : null;
    }
    // selo: px soltos [dx, dy, cor] presos a um ponto do bicho; só entra se o ponto estiver à vista
    selo(p, pts, tol) {
      const v = this.visivel(p, tol);
      if (!v) return false;
      for (const [dx, dy, cor] of pts) if (cor) this.selos.push(v[0] + dx, v[1] + dy, cor);
      return true;
    }
    // mats[i] = { rampa, ganho, vies, brilho (limiar), luz (cor do brilho), padrao(af, al, az, nz) -> viés ou { mat } }
    pintar(g, mats) {
      const W = this.W, H = this.H, zb = this.zb, mat = this.mat, parte = this.parte;
      for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (mat[i] < 0) continue;
        let m = mats[mat[i]];
        let l = this.nx[i] * LUZ[0] + this.ny[i] * LUZ[1] + this.nz[i] * LUZ[2];
        let extra = this.vies[i];
        if (m.padrao) {
          const r = m.padrao(this.af[i], this.al[i], this.az[i], this.nz[i], X, Y);
          if (typeof r === "number") extra += r; else if (r) { if (r.mat !== undefined) m = mats[r.mat]; extra += r.vies || 0; }
        }
        // faces viradas para cima ficam no tom base; só o que encara a luz clareia
        let lv = (l - 0.48) * 1.7 * (m.ganho || 1) + (m.vies || 0) + extra;
        // sombra de contato: um vizinho de outra parte passa bem na frente deste px
        const z = zb[i], pa = parte[i];
        let cob = 0;
        if (X > 0 && mat[i - 1] >= 0 && parte[i - 1] !== pa && zb[i - 1] > z + 0.9) cob++;
        if (Y > 0 && mat[i - W] >= 0 && parte[i - W] !== pa && zb[i - W] > z + 0.9) cob++;
        if (X < W - 1 && mat[i + 1] >= 0 && parte[i + 1] !== pa && zb[i + 1] > z + 1.1) cob += 0.6;
        if (Y < H - 1 && mat[i + W] >= 0 && parte[i + W] !== pa && zb[i + W] > z + 1.1) cob += 0.6;
        if (cob) lv -= 0.42 + 0.25 * cob;
        let cor = sombrear(m.rampa, Math.max(-1, Math.min(1, lv)), X, Y);
        if (m.brilho && !cob) {
          const e = this.nx[i] * MEIO[0] + this.ny[i] * MEIO[1] + this.nz[i] * MEIO[2];
          if (e > m.brilho) cor = m.luz;
        }
        g.fino(X, Y, cor);
      }
      const s = this.selos;
      for (let k = 0; k < s.length; k += 3) g.fino(s[k], s[k + 1], s[k + 2]);
    }
  }

  // tinta do raro nomeado: entra na cor base, antes da rampa
  const tingir = (tinta) => (hex) => (tinta ? misturar(hex, tinta, 0.42) : hex);
  const par = (v) => Math.round(v / 2) * 2;
  // rampa de quitina: os dois tons claros puxam para a cor do reflexo (âmbar, coral), e não para o creme
  // da rampa de couro, que deixava a carapaça acinzentada
  const quitina = (base, luz) => { const r = rampa6(base, "couro").slice(); r[4] = misturar(base, luz, 0.36); r[5] = misturar(base, luz, 0.7); return r; };

  // Def de uma criatura de volumes. esp = { lado (px), S (ou Sv: escala por vista), orig: [[ox, oy] × 3 vistas, em px da célula base],
  // sombra [w, h], altura, mats(cor) -> materiais, montar(cena, vista, q, esp) }.
  function volumeDef(esp, porte, tinta) {
    const lado = par(esp.lado * porte), k = lado / esp.lado;
    const mats = esp.mats(tingir(tinta));
    return {
      w: lado / 2, h: lado / 2, direcoes: 3, quadrosPorVista: 8, quadros: 24, ciclo: CICLO, quadroAcao: ACAO,
      sombra: { w: Math.round(esp.sombra[0] * k), h: Math.round(esp.sombra[1] * k) }, alturaCabeca: Math.round(esp.altura * k),
      contorno: "hostil", acabamento: false, origem: [0.5, 1],
      desenhar(g, quadro) {
        const vista = Math.floor(quadro / 8), q = quadro % 8, o = esp.orig[vista];
        const c = new Cena(g.w, g.h, esp.guinada ? esp.guinada[vista] : GUINADA[vista], o[0] * k, o[1] * k, (esp.Sv ? esp.Sv[vista] : esp.S) * k);
        esp.montar(c, vista, q);
        c.pintar(g, mats);
      },
    };
  }
  function volume(chave, esp) {
    const def = volumeDef(esp, 1, null);
    def.variante = (porte, tinta) => volumeDef(esp, porte, tinta);
    return registrar(chave, def);
  }

  // ===================================================================
  // ESCORPIÃO — castanho-avermelhado com pinças âmbar, visto de cima em ângulo
  // ===================================================================
  const E = { CORPO: 0, PLACA: 1, PATA: 2, CAUDA: 3, FERRAO: 4, PINCA: 5 };
  const PE = { CORPO: 1, CABECA: 2, CAUDA: 10, PATA: 20, BRACO: 40 };
  function escorpiao(c, vista, q) {
    const and = q >= 2 && q <= 5, fase = and ? q - 2 : 0;
    const resp = q === 1 ? 1 : 0, ant = q === 6, gol = q === 7;
    // corpo: baixa na antecipação, avança no golpe
    const des = [ant ? -1.6 : gol ? 1.2 : 0, 0, (resp ? 0.5 : 0) + (ant ? -0.5 : 0) + (and && fase % 2 ? 0.4 : 0)];
    c.pose(ant ? 5 : gol ? -6 : 0, [0, 3], des);
    // --- patas: 4 pares, tetrápode alternado (grupo A: 1ª e 3ª de um lado, 2ª e 4ª do outro)
    // os pés abrem em leque (4 px de tela entre um e outro): de frente e de costas cada pata é um traço
    // limpo, e não uma trama; o joelho fica baixo, pouco acima do dorso
    // de frente e de costas o escorço achata o leque: ali os pés abrem mais para a frente e para trás
    // (um X e dois traços de cada lado) e a pata é reta, sem o joelho alto
    const lado = vista === 0;
    const raiz = [6, 3.2, 0.4, -2.4], pe = lado ? [11.5, 4, -4.5, -13] : [14.5, 5.5, -5, -15], abre = lado ? [9, 10.6, 10.6, 9] : [7.6, 10, 10, 7.8];
    for (const s of [1, -1]) for (let k = 0; k < 4; k++) {
      const grupoA = (k % 2 === 0) === (s === 1);
      // fase do passo desta pata: 0 apoiada à frente, 1 apoiada no meio (indo para trás), 2 atrás, 3 no ar voltando
      const ph = and ? (fase + (grupoA ? 0 : 2)) % 4 : -1;
      const av = ph < 0 ? 0 : [1.9, 0, -1.9, 0][ph], ar = ph === 3 ? 2.2 : 0;
      const fx = pe[k] + av - des[0], lz = abre[k] + (resp ? 0.3 : 0) + (ant ? 0.8 : 0);
      c.grupo(PE.PATA + k + (s > 0 ? 0 : 4));
      const r0 = [raiz[k], s * 4, 2.6], jo = [mix(raiz[k], fx, 0.55), s * (lz * 0.62), (lado ? 3.9 : 2.3) + ar * 0.5 - des[2]], po = [fx, s * lz, 0.7 + ar - des[2]];
      c.cadeia(r0, 0.75, jo, 0.62, E.PATA); c.cadeia(jo, 0.62, po, 0.61, E.PATA);
    }
    // --- abdome em placas e cefalotórax
    c.grupo(PE.CORPO); c.elip([-2.6, 0, 3.6], [6.8, 5.5, 3.1], E.PLACA);
    c.grupo(PE.CABECA); c.elip([5.2, 0, 3.4], [4.4, 4.8, 2.7], E.CORPO);
    c.selo([7.4, 1.2, 5.2], [[0, 0, "#1c1210"]], 2.2); c.selo([7.4, -1.2, 5.2], [[0, 0, "#1c1210"]], 2.2);
    // --- pinças (pedipalpos): braço em cotovelo e mão larga com dois dedos
    const abertura = ant ? 2.6 : gol ? 0.2 : resp ? 1.5 : 1.0 + (and ? (fase % 2) * 0.4 : 0);
    for (const s of [1, -1]) {
      const sobe = ant ? 2.5 : 0, lad = ant ? 2 : gol ? -1.2 : 0, vai = gol ? 1.5 : and ? (s > 0 ? [0.8, 0, -0.8, 0] : [-0.8, 0, 0.8, 0])[fase] : 0;
      const om = [8.2, s * 2.6, 3], cot = [11.6 + vai * 0.5, s * (7.2 + lad), 3.6 + sobe * 0.5], pul = [14.6 + vai, s * (6 + lad), 3.6 + sobe];
      const mao = [16.6 + vai, s * (5.4 + lad), 3.7 + sobe];
      c.grupo(PE.BRACO + (s > 0 ? 0 : 1));
      c.cadeia(om, 1.05, cot, 1.15, E.PINCA); c.cadeia(cot, 1.15, pul, 1.1, E.PINCA);
      c.grupo(PE.BRACO + 2 + (s > 0 ? 0 : 1));
      c.elip(mao, [3.1, 2.6, 2.1], E.PINCA);
      const d1 = [22.2 + vai, s * (3.9 + lad), 3.5 + sobe], d2 = [21.8 + vai, s * (3.9 + lad + abertura * 1.5), 3.7 + sobe];
      c.cadeia([18.6 + vai, s * (4.6 + lad), 3.6 + sobe], 1.15, d1, 0.6, E.PINCA);
      c.cadeia([18.4 + vai, s * (6 + lad), 3.7 + sobe], 1.05, d2, 0.6, E.PINCA);
    }
    // --- cauda: 5 gomos em arco sobre o dorso, bulbo e ferrão
    const ang = ant ? [24, 60, 98, 136, 164] : gol ? [52, 98, 132, 158, 196] : [38, 76, 112, 150, 190];
    const bal = resp ? 4 : and ? [3, 0, -3, 0][fase] : 0, torce = and ? [0.5, 0, -0.5, 0][fase] : 0;
    let p = [-8.3, 0, 3.6];
    const raios = [2.1, 2, 1.9, 1.75, 1.65], comp = gol ? 4.6 : 4.2;
    // de frente e de costas a cauda se enrola para um lado: lê como gancho, e não como um poste em escorço
    const enrola = vista === 0 ? [0, 0, 0, 0, 0] : gol ? [1, 1.2, 0.4, -1, -1.6] : [2.2, 2.4, 0.8, -2, -3];
    for (let k = 0; k < 5; k++) {
      const a = (ang[k] + bal * (k / 4)) * GRAU, n = [p[0] - Math.cos(a) * comp, p[1] + torce * (k + 1) * 0.5 + enrola[k], p[2] + Math.sin(a) * comp];
      const meio = [mix(p[0], n[0], 0.5), mix(p[1], n[1], 0.5), mix(p[2], n[2], 0.5)];
      // cada gomo é uma conta: junta fina e escura, barriga larga
      c.grupo(PE.CAUDA + k, -0.6); c.bola(p, raios[k] * 0.6, E.CAUDA);
      c.grupo(PE.CAUDA + k, k % 2 ? -0.06 : 0.08); c.cadeia(mix3(p, meio, 0.45), raios[k] * 0.8, meio, raios[k], E.CAUDA); c.cadeia(meio, raios[k], mix3(meio, n, 0.55), raios[k] * 0.8, E.CAUDA);
      p = n;
    }
    const af = (ang[4] + bal + 25) * GRAU, bul = [p[0] - Math.cos(af) * 1.6, p[1], p[2] + Math.sin(af) * 1.6];
    c.grupo(PE.CAUDA + 6); c.elip(bul, [2.1, 1.9, 1.9], E.FERRAO);
    const ag = (ang[4] + bal + 62) * GRAU, m1 = [bul[0] - Math.cos(af) * 2.2, bul[1], bul[2] + Math.sin(af) * 2.2 - 0.4];
    const ponta = [m1[0] - Math.cos(ag) * 2.6, m1[1], m1[2] + Math.sin(ag) * 2.6];
    c.grupo(PE.CAUDA + 7); c.curva([bul, m1, ponta], [1.2, 0.85, 0.55], E.FERRAO);
    c.selo(ponta, [[0, 0, "#2a0f0c"]], 3);
  }
  function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
  volume("in_escorpiao", {
    lado: 40, Sv: [0.82, 0.92, 0.92], orig: [[17, 32], [20, 24], [20, 29]], sombra: [26, 8], altura: 24,
    mats(cor) {
      const brilho = cor("#f0a850");
      return [
        { rampa: quitina(cor("#6e3418"), brilho), ganho: 1.15, vies: 0, brilho: 0.955, luz: brilho },
        { rampa: quitina(cor("#5a2a14"), brilho), ganho: 1.15, vies: 0, brilho: 0.972, luz: brilho,
          // placas do dorso: um vinco escuro a cada 3,6 px e a luz logo atrás dele
          padrao: (af, al, az, nz) => { if (nz < 0.15) return -0.15; const t = (((af + 9.4) / 3.6) % 1 + 1) % 1; return t < 0.3 ? -0.85 : t < 0.6 ? 0.3 : 0; } },
        // patas num tom só (quase sem modelado): com 1 px de largura, o pontilhado virava ruído
        { rampa: rampa6(cor("#a05c20"), "couro"), ganho: 0.35, vies: 0.05 },
        { rampa: quitina(cor("#8a4a1c"), brilho), ganho: 1.1, vies: 0, brilho: 0.965, luz: brilho },
        { rampa: rampa6(cor("#a02c1c"), "couro"), ganho: 1, vies: 0, brilho: 0.95, luz: cor("#f09a6a") },
        { rampa: quitina(cor("#b46424"), cor("#f8cc80")), ganho: 1.1, vies: 0, brilho: 0.955, luz: brilho,
          // pontas dos dedos escuras
          padrao: (af) => (af > 20.2 ? -0.8 : 0) },
      ];
    },
    montar: escorpiao,
  });

  // ===================================================================
  // CARANGUEJO — carapaça larga, olhos em haste, anda de lado
  // ===================================================================
  const K = { CASCO: 0, VENTRE: 1, PATA: 2, PINCA: 3, OLHO: 4, HASTE: 5, PERNA: 6 };
  function caranguejo(c, vista, q) {
    const and = q >= 2 && q <= 5, fase = and ? q - 2 : 0, resp = q === 1, ant = q === 6, gol = q === 7;
    const deLado = vista === 0; // na vista de lado ele anda de lado: as patas abrem e fecham
    const sobe = (resp ? 0.6 : 0) + (and && fase % 2 ? 0.5 : 0) + (ant ? 1.4 : 0);
    const inc = ant ? 14 : gol ? -8 : 0;
    const des = [gol ? 1.6 : ant ? -0.8 : 0, 0, sobe];
    // --- patas (sem a pose do corpo: os pés ficam no chão)
    // pés em leque largo e patas finas num tom só: com 4 px de tela entre uma e outra, não viram trama
    const raiz = [2.6, 0.6, -1.4, -3.4], abre = [13.6, 15.6, 15.4, 12.8], pf = [10, 3.4, -3.6, -10.6];
    for (const s of [1, -1]) for (let k = 0; k < 4; k++) {
      const grupoA = (k % 2 === 0) === (s === 1);
      const ph = and ? (fase + (grupoA ? 0 : 2)) % 4 : -1;
      const ar = ph === 3 ? 2.4 : 0;
      // de lado: a pata estica e encolhe (lado que puxa na frente); de frente e de costas: vai e volta
      const estica = ph < 0 ? 0 : deLado ? [2.4, 0.4, -2.2, 0.4][ph] * (s < 0 ? 1 : -1) * (s < 0 ? 1 : 1) : 0;
      const vai = ph < 0 || deLado ? 0 : [1.8, 0, -1.8, 0][ph];
      const lz = abre[k] + estica + (ant ? 1 : 0);
      c.pose(0); c.grupo(20 + k + (s > 0 ? 0 : 4));
      const r0 = [raiz[k] + des[0], s * 7.2, 4 + sobe], jo = [mix(raiz[k], pf[k] + vai, 0.55), s * (lz * 0.74), 6.4 + sobe * 0.6 + ar * 0.6], po = [pf[k] + vai, s * lz, 0.6 + ar];
      c.cadeia(r0, 0.85, jo, 0.65, K.PERNA); c.cadeia(jo, 0.65, po, 0.58, K.PERNA);
    }
    // --- carapaça
    c.pose(inc, [0, 4], des);
    c.grupo(1); c.elip([0, 0, 5.2], [6, 9.8, 4], K.CASCO);
    // olhos em haste
    for (const s of [1, -1]) {
      const topo = [5.6, s * 2.9, 9.8 + (resp ? 0.7 : 0)];
      c.grupo(4 + (s > 0 ? 0 : 1)); c.cadeia([4.6, s * 2.6, 7], 0.8, topo, 0.8, K.HASTE);
      c.bola(topo, 1.3, K.OLHO);
      c.selo([topo[0] + 0.6, topo[1], topo[2] + 0.6], [[0, 0, "#f4ecd8"]], 2.4);
    }
    // --- pinças: braço, mão grossa e dois dedos
    for (const s of [1, -1]) {
      const guia = deLado ? s < 0 : true; // de lado, a pinça da frente (lado para onde anda) é a que ataca
      const alto = ant ? 5.5 : gol ? (guia ? 1.5 : 3) : resp ? 0.8 : and ? (grupoPinca(s, fase)) : 0;
      const frente = gol && guia ? 4.2 : ant ? -1 : 0;
      const abert = ant ? 2.6 : gol ? (guia ? 0.1 : 1.6) : resp ? 1.6 : 1.1;
      const om = [4, s * 7.2, 4.2], cot = [8.4 + frente * 0.4, s * 10, 4.8 + alto * 0.5], mao = [10.6 + frente, s * 6.6, 5.6 + alto];
      c.grupo(8 + (s > 0 ? 0 : 1)); c.cadeia(om, 1.5, cot, 1.6, K.PATA); c.cadeia(cot, 1.6, mao, 1.8, K.PATA);
      c.grupo(10 + (s > 0 ? 0 : 1)); c.elip(mao, [3.5, 3, 2.7], K.PINCA);
      c.cadeia([mao[0] + 2, s * 5.2, mao[2] + 0.9], 1.5, [mao[0] + 4.6, s * 2.6, mao[2] + 0.6 + abert], 0.6, K.PINCA);
      c.cadeia([mao[0] + 2, s * 5.4, mao[2] - 0.9], 1.3, [mao[0] + 4.4, s * 2.8, mao[2] - 1.1], 0.6, K.PINCA);
    }
  }
  const grupoPinca = (s, fase) => (s > 0 ? [0.8, 0, 0, 0] : [0, 0, 0.8, 0])[fase];
  volume("in_caranguejo", {
    lado: 40, S: 0.86, guinada: [72, 90, -90], orig: [[19.5, 30], [20, 29], [20, 32]], sombra: [28, 8], altura: 22,
    mats(cor) {
      const casco = rampa6(cor("#c2452d"), "couro"), brilho = cor("#f8b890");
      return [
        { rampa: casco, brilho: 0.965, luz: brilho,
          // borda clara do casco, ventre creme e pintas escuras no dorso
          padrao: (af, al, az, nz) => {
            if (az < 3.6) return { mat: K.VENTRE };
            if (nz > 0.5 && hash2(Math.floor(af * 0.7 + 20), Math.floor(al * 0.7 + 20), 7) < 0.16) return -0.6;
            return az < 4.5 ? 0.35 : 0;
          } },
        { rampa: rampa6(cor("#e8c8a0"), "pele"), vies: 0.1 },
        { rampa: rampa6(cor("#d2553a"), "couro"), vies: 0.05, padrao: (af, al) => (Math.abs(al) > 13.6 ? -0.7 : 0) },
        { rampa: rampa6(cor("#e06a42"), "couro"), vies: 0.08, brilho: 0.95, luz: brilho,
          padrao: (af, al, az) => (Math.abs(al) < 3.6 ? { mat: K.VENTRE, vies: 0.2 } : 0) },
        { rampa: rampa6("#241a1c", "pedra"), brilho: 0.9, luz: "#f4ecd8" },
        { rampa: rampa6(cor("#e89a6a"), "couro") },
        { rampa: rampa6(cor("#c44a30"), "couro"), ganho: 0.35, vies: 0.1, padrao: (af, al) => (Math.abs(al) > 12.8 ? -0.8 : 0) },
      ];
    },
    montar: caranguejo,
  });

  // ===================================================================
  // RÃ — atarracada; salta em 4 fases e ataca com a língua
  // ===================================================================
  const R = { PELE: 0, VENTRE: 1, PERNA: 2, OLHO: 3, LINGUA: 4, BOCA: 5 };
  function ra(c, vista, q) {
    const resp = q === 1, ant = q === 6, gol = q === 7;
    // pose do tronco por quadro: [inclinação, avanço, altura]
    const P = { 0: [16, 0, 0], 1: [17, 0, 0.3], 2: [8, -1, -1.3], 3: [34, 2, 3], 4: [8, 2, 8.5], 5: [-14, 1, 1.6], 6: [24, -1.4, 0], 7: [6, 1.6, 0] }[q];
    const des = [P[1], 0, P[2]], pivo = [-2, 3];
    const corpo = (p) => { c.pose(P[0], pivo, des); const r = c.pt(p).map((v) => v / c.S); c.pose(0); return r; };
    // --- pernas de trás (dobradas em Z; esticam no impulso e no ar)
    for (const s of [1, -1]) {
      const anca = corpo([-4.6, s * 4.4, 3.4]);
      let joelho, torn, dedos;
      if (q === 3) { joelho = [-5.6, s * 6.4, 3.6]; torn = [-9.6, s * 6, 1.6]; dedos = [-12.4, s * 6.4, 0.6]; }
      else if (q === 4) { joelho = [anca[0] - 4.6, s * 5.6, anca[2] - 0.5]; torn = [anca[0] - 8.6, s * 5, anca[2] - 1.8]; dedos = [anca[0] - 11.6, s * 5.2, anca[2] - 2.8]; }
      else if (q === 5) { joelho = [anca[0] + 2.5, s * 7.6, anca[2] + 3.2]; torn = [anca[0] - 3.5, s * 7.4, 2.6]; dedos = [anca[0] + 0.5, s * 9, 1.2]; }
      else { const ag = q === 2 ? 1 : 0; joelho = [1 + ag, s * (7.8 + ag * 0.4), 4.4 - ag * 0.6]; torn = [-5.4, s * 7.6, 1.5]; dedos = [-0.6 + ag, s * 9.4, 0.7]; }
      c.grupo(10 + (s > 0 ? 0 : 1)); c.cadeia(anca, 2.7, joelho, 2.1, R.PERNA);
      c.grupo(12 + (s > 0 ? 0 : 1)); c.cadeia(joelho, 1.9, torn, 1.25, R.PERNA);
      c.grupo(14 + (s > 0 ? 0 : 1)); c.cadeia(torn, 1.2, dedos, 0.85, R.PERNA);
      c.cadeia(dedos, 0.8, [dedos[0] + 1.8, dedos[1] + s * 1.4, dedos[2]], 0.6, R.PERNA);
    }
    // --- tronco e cabeça
    c.pose(P[0], pivo, des);
    c.grupo(1); c.elip([-1.6, 0, 5], [6.6, 5.7, 4.5], R.PELE);
    const papo = resp ? 3.1 : ant ? 2.2 : 0;
    if (papo) { c.grupo(3); c.elip([4.6, 0, 3.6], [papo, papo * 1.15, papo * 0.9], R.VENTRE); }
    c.grupo(2); c.elip([4.4, 0, 6.6], [4.6, 5.3, 3.2], R.PELE);
    if (ant || gol) { c.grupo(6); c.elip([6.4, 0, 5.2], [2.9, 3.8, 1.5], R.BOCA); }
    for (const s of [1, -1]) {
      c.grupo(4 + (s > 0 ? 0 : 1)); c.bola([4.8, s * 3.3, 9.2], 2, R.PELE);
      c.bola([5.5, s * 3.9, 9.6], 1.45, R.OLHO);
      c.selo([6.3, s * 4.3, 9.9], [[0, 0, "#16100c"]], 2.6);
    }
    // --- língua
    if (gol) {
      c.grupo(7);
      c.curva([[7.6, 0, 5.4], [11.5, 0, 6.4], [15.6, 0, 5.2]], [1, 0.85, 0.9], R.LINGUA);
      c.bola([16.4, 0, 5], 1.7, R.LINGUA);
    }
    // --- braços
    for (const s of [1, -1]) {
      const ombro = corpo([3.4, s * 4.4, 4.2]);
      let mao;
      if (q === 4) mao = [ombro[0] + 3.6, s * 5, ombro[2] - 2.6];
      else if (q === 3) mao = [ombro[0] + 1.2, s * 5.4, ombro[2] - 4];
      else if (q === 5) mao = [ombro[0] + 2.6, s * 6, 0.6];
      else mao = [6.2 + P[1] * 0.5, s * 5.8, 0.6];
      const cot = [mix(ombro[0], mao[0], 0.4) - 0.6, s * 6.6, mix(ombro[2], mao[2], 0.5)];
      c.pose(0); c.grupo(16 + (s > 0 ? 0 : 1));
      c.cadeia(ombro, 1.45, cot, 1.2, R.PERNA); c.cadeia(cot, 1.2, mao, 0.95, R.PERNA);
      c.cadeia(mao, 0.85, [mao[0] + 1.5, mao[1] + s * 1.1, mao[2]], 0.6, R.PERNA);
    }
  }
  volume("in_ra", {
    lado: 40, S: 0.96, orig: [[19, 32], [20, 31], [20, 30]], sombra: [22, 8], altura: 22,
    mats(cor) {
      const pele = rampa6(cor("#4a8a32"), "folha");
      const pintas = (af, al, az, nz) => (nz > 0.25 && hash2(Math.floor(af * 0.6 + 30), Math.floor(Math.abs(al) * 0.6 + 30), 3) < 0.2 ? -0.55 : 0);
      return [
        { rampa: pele, brilho: 0.975, luz: cor("#c8e878"),
          padrao: (af, al, az, nz) => (nz < -0.05 || az < 3 ? { mat: R.VENTRE } : af > 3 && az < 5.6 ? { mat: R.VENTRE, vies: 0.1 } : pintas(af, al, az, nz)) },
        { rampa: rampa6(cor("#d8e0a0"), "pele"), vies: 0.05 },
        { rampa: rampa6(cor("#3f7a2c"), "folha"), padrao: (af, al, az, nz) => (nz > 0.3 && (Math.floor(af * 0.5 + 40) & 1) === 0 ? -0.4 : 0) },
        { rampa: rampa6(cor("#e8b83a"), "metal"), vies: 0.25 },
        { rampa: rampa6("#d86a7a", "pele"), vies: 0.1, brilho: 0.95, luz: "#f8b0b8" },
        { rampa: rampa6("#7a2434", "pele"), vies: -0.3 },
      ];
    },
    montar: ra,
  });

  // ===================================================================
  // ENXAMES — gafanhotos e vespas: insetos de 4 a 6 px, sem nuvem
  // ===================================================================
  // Moldes à mão. Letras: a corpo, A corpo escuro, c corpo claro, k cabeça/preto, p pata, w asa, W veia da asa.
  // [orientação][tamanho (0 pequeno, 1 grande)][asa (0 em cima, 1 embaixo)]; "lado" olha para a direita.
  const MOLDES = {
    gafanhoto: {
      lado: [[[".ww.", "Aack", ".p.."], ["....", "AWck", ".p.."]],
        [["...wWw..", "..wwww..", ".aaaack.", "AAaaAAk.", ".p..p...", "p......."], ["........", ".WwwWw..", ".aaWwck.", "AAaaAAk.", ".pp.p...", "...p...."]]],
      frente: [[["w..w", ".kk.", ".aa."], ["....", "wkkw", ".aa."]],
        [["w.....w", ".ww.ww.", "..kck..", "..aAa..", ".p...p."], [".......", "..kck..", "wwaAaww", "w.p.p.w"]]],
      costas: [[["w..w", ".aa.", ".AA."], ["....", "waaw", ".AA."]],
        [["w.....w", ".ww.ww.", "..aca..", "..aAa..", "...A..."], [".......", "..aca..", "wwaAaww", "w..A..w"]]],
    },
    vespa: {
      lado: [[[".ww.", "aAkk"], ["....", "aWkk", "...."]],
        [["...wWw..", "..www...", ".aAa.kk.", "aAaAkkc.", "a....p.."], ["........", ".wwWw...", ".aAa.kk.", "aAaAkkc.", "a....p.."]]],
      frente: [[["w..w", ".kk.", ".aA."], ["....", "wkkw", ".aA."]],
        [["w.....w", ".ww.ww.", "..kck..", "..aAa..", "...a..."], [".......", "..kck..", "wwAaAww", "...a..."]]],
      costas: [[["w..w", ".kk.", ".aA."], ["....", "wkkw", ".Aa."]],
        [["w.....w", ".ww.ww.", "..kkk..", "..aAa..", "..AaA..", "...a..."], [".......", "..kkk..", "wwaAaww", "..AaA..", "...a..."]]],
    },
  };
  const NOME_VISTA = ["lado", "frente", "costas"];
  function enxameDef(o, porte, tinta) {
    const lado = par(48 * porte), k = lado / 48, cor = tingir(tinta);
    const n = Math.round(o.n * Math.pow(porte, 1.6)), sem = o.semente;
    const base = { a: cor(o.cores.a), A: cor(o.cores.A), c: cor(o.cores.c), k: o.cores.k, p: cor(o.cores.p), w: o.cores.w, W: o.cores.W };
    // três planos: fundo (pequeno e escuro), meio e frente
    const noite = "#2a2636";
    const tons = [0.46, 0.2, 0].map((t) => { const r = {}; for (const [l, c] of Object.entries(base)) r[l] = misturar(c.slice(0, 7), noite, t) + c.slice(7); return r; });
    // lugar de cada inseto no volume: u ao longo da frente do enxame (adensa na frente), v lateral, h altura
    const ins = [];
    for (let i = 0; i < n; i++) {
      // amostragem em estratos: os insetos se espalham sem se amontoar
      const r1 = (i + hash2(i, 1, sem)) / n, r2 = (((i * 7) % n) + hash2(i, 2, sem)) / n, r3 = (((i * 5 + 2) % n) + hash2(i, 3, sem)) / n, r4 = hash2(i, 4, sem);
      const u = 1 - 2 * Math.pow(r1, 1.4); // mais gente na frente (u perto de 1)
      const larg = 0.45 + 0.55 * (1 - Math.abs(u)) + (u > 0 ? 0.15 : 0);
      ins.push({ u, v: (r2 * 2 - 1) * larg, h: 0.1 + r3 * 0.9, f: r4 });
    }
    return {
      w: lado / 2, h: lado / 2, direcoes: 3, quadrosPorVista: 8, quadros: 24, ciclo: CICLO, quadroAcao: ACAO,
      // a sombra é salpicada (um salpico por inseto, na camada de sombra do sprite): a do jogo fica mínima
      sombra: { w: 4, h: 2 }, alturaCabeca: Math.round(38 * k),
      contorno: null, acabamento: false, origem: [0.5, 1], limiteCores: 64,
      desenhar(g, quadro) {
        const vista = Math.floor(quadro / 8), q = quadro % 8, moldes = MOLDES[o.molde][NOME_VISTA[vista]];
        const W = g.w, H = g.h, cx = W / 2, chao = H - 9 * k, ant = q === 6, gol = q === 7;
        const lista = [];
        for (let i = 0; i < ins.length; i++) {
          const b = ins[i];
          // zumbido: cada inseto gira num lacinho próprio; no ciclo, um quarto de volta por fase
          const volta = b.f * 6.283 + (q >= 2 && q <= 5 ? (q - 2) * 1.5708 : q * 2.3) + i;
          let u = b.u + Math.cos(volta) * 0.13, v = b.v + Math.sin(volta * 1.3 + i) * 0.12, h = b.h + Math.sin(volta) * 0.09;
          if (ant) { u = u * 0.6 - 0.35; v *= 0.78; h = 0.5 + (h - 0.5) * 0.8; }
          if (gol) { u = u * 0.6 + 0.34; v *= 0.62; h = 0.44 + (h - 0.5) * 0.68; }
          // projeção de cada vista: de lado, u corre na horizontal; de frente, desce a tela; de costas, sobe
          let X, Yc, prof;
          if (vista === 0) { X = cx + k + u * 16 * k; Yc = chao + k + v * 6 * k; prof = (v + 1) / 2; }
          else if (vista === 1) { X = cx - v * 16 * k; Yc = chao - 3 * k + u * 6 * k; prof = (u + 1) / 2; }
          else { X = cx + v * 16 * k; Yc = chao - 3 * k - u * 6 * k; prof = (1 - u) / 2; }
          lista.push({ X: Math.round(X), Yc: Math.round(Yc), Y: Math.round(Yc - (5 + h * (vista === 0 ? 22 : 19)) * k), prof, asa: (i + q) & 1, i });
        }
        // afasta quem ficou em cima de outro (menos no bote): o enxame se lê como insetos, não como mancha
        for (let volta = 0; volta < (gol ? 2 : 4); volta++) for (let a = 0; a < lista.length; a++) for (let b = a + 1; b < lista.length; b++) {
          const A = lista[a], B = lista[b], dx = B.X - A.X, dy = B.Y - A.Y;
          if (Math.abs(dx) >= 7 || Math.abs(dy) >= 5) continue;
          const sy = dy > 0 || (dy === 0 && (a + b) & 1) ? 1 : -1;
          if (A.Y - sy > 3 * k) A.Y -= sy;
          if (B.Y + sy < H - 14 * k) B.Y += sy;
          if (Math.abs(dx) < 4) { const sx = dx > 0 || (dx === 0 && a & 1) ? 1 : -1; if (A.X - sx > 6 && A.X - sx < W - 7) A.X -= sx; if (B.X + sx > 6 && B.X + sx < W - 7) B.X += sx; }
        }
        lista.sort((a, b) => a.prof - b.prof || a.i - b.i);
        for (const it of lista) {
          const plano = it.prof < 0.4 ? 0 : it.prof < 0.7 ? 1 : 2;
          const molde = moldes[plano === 0 ? 0 : 1][it.asa], tom = tons[plano];
          const mw = molde[0].length, mh = molde.length, x0 = it.X - (mw >> 1), y0 = it.Y - (mh >> 1);
          // salpico de sombra no chão, embaixo do inseto
          const sw = plano === 0 ? 2 : 3;
          for (let dx = 0; dx < sw; dx++) g.sombraPx(it.X - 1 + dx + 2, it.Yc, plano === 2 ? 0.2 : 0.13);
          if (plano === 2) g.sombraPx(it.X + 1, it.Yc + 1, 0.13);
          for (let j = 0; j < mh; j++) for (let x = 0; x < mw; x++) {
            const l = molde[j][x];
            if (l !== ".") g.fino(x0 + x, y0 + j, tom[l]);
          }
        }
      },
    };
  }
  function enxame(chave, o) {
    const def = enxameDef(o, 1, null);
    def.variante = (porte, tinta) => enxameDef(o, porte, tinta);
    return registrar(chave, def);
  }
  enxame("in_gafanhotos", {
    molde: "gafanhoto", n: 20, semente: 11,
    cores: { a: "#8fa02a", A: "#3a4212", c: "#d6e060", k: "#241c10", p: "#4a2e14", w: "#e6e0b0d8", W: "#9aa860" },
  });
  enxame("in_vespas", {
    molde: "vespa", n: 18, semente: 23,
    cores: { a: "#f0c040", A: "#2a1a14", c: "#f8e078", k: "#1c1210", p: "#c8782a", w: "#eef2f6d8", W: "#a8b8cc" },
  });
})(typeof window !== "undefined" ? window : globalThis);
