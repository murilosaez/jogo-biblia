// =====================================================================
// arte/quadrupede.js — quadrúpedes em 3 vistas (pacote A1 do plano de arte).
//
// Chaves que este arquivo assume (registrar() com a MESMA chave troca o desenho legado de sprites.js):
//   al_cao al_ovelha in_lobo in_chacal in_hiena in_cabra in_javali (48 × 48 px)
//   in_leao in_urso in_leopardo in_crocodilo (64 × 64 px)
//   pv_animal_jumento pv_animal_cavalo pv_animal_camelo (prévias das anatomias de montaria, 72 × 80 px;
//   só aparecem na folha de contato)
//   expõe Arte.motor.animal(g, vista, quadro, anatomia, opcoes) e Arte.motor.ANATOMIAS (ver o fim do
//   arquivo): o esqueleto que arte/montado.js usa para jumento, cavalo e camelo.
//
// Como o desenho é feito
//   Cada bicho é um esqueleto de volumes (elipsoides e cadeias de esferas) no espaço do animal:
//   f = para a frente (focinho), l = lateral (positivo = lado direito do bicho), z = altura; tudo em px
//   de arte. Uma câmera oblíqua (INCL graus acima do horizonte, a mesma dos humanos vistos "de cima")
//   projeta o MESMO esqueleto nas três vistas — de lado, de frente e de costas —, de modo que o
//   escorço, o dorso visto de cima e as pernas de longe mais altas na tela saem da geometria, não de
//   três desenhos à mão. Cada px guarda profundidade, normal e material; a luz vem de cima e da
//   esquerda e o tom sai de rampa6 + sombrear (pontilhado só na transição). Por cima entram: pelagem em
//   traços curtos presos ao corpo (no sentido do pelo), malhas e listras no espaço do animal (as mesmas
//   nas três vistas), linha de sombra onde uma parte passa na frente de outra e os "selos" de 1 px
//   (olhos, focinho, boca, presas, garras), que só aparecem se o ponto estiver visível naquela vista.
//   O contorno colorido de 1 px é do motor.
//
// Contrato (docs/GUIA-DE-ARTE.md, seção "Contrato"):
//   * direcoes = 3 (lado virado para a direita, frente, costas), quadrosPorVista = 8, quadros = 24.
//     Em cada vista: 0 parado, 1 respirar, 2 contato A, 3 passagem A, 4 contato B, 5 passagem B,
//     6 antecipação do golpe, 7 golpe. ciclo [2, 3, 4, 5], quadroAcao [6, 7], sombra { w, h } em px e
//     alturaCabeca em px de mundo. Criaturas nunca recebem humano: true.
//   * Só primitivas em px de arte (aqui, g.fino). def.w e def.h em unidades (2 px de arte).
//   * Nada de document, canvas ou window na carga. Nenhuma coordenada de mapa. Arte 100% original.
// =====================================================================
(function (global) {
  "use strict";
  const Arte = global.Arte;
  if (!Arte || !Arte.motor) return;
  const M = Arte.motor;
  const { registrar, rampa6, sombrear, misturar, hash2, sementeDe, hexRgb, rgbHex } = M;

  // -------------------------------------------------------------------
  // Câmera e luz. Mundo: x para a direita, y para quem olha (sul), z para cima.
  // -------------------------------------------------------------------
  const GRAU = Math.PI / 180;
  const INCL = 38 * GRAU, SP = Math.sin(INCL), CP = Math.cos(INCL);
  const LUZ = (() => { const v = [-0.58, 0.3, 0.76], n = Math.hypot(v[0], v[1], v[2]); return v.map((c) => c / n); })();
  const ESCORCO = 0.86; // de frente e de costas o comprimento encolhe um pouco mais que a projeção pura
  const LARGO = 1.16;   // e a largura cresce um pouco, para o bicho de frente não virar um palito
  const VISTA = { lado: 0, frente: 1, costas: 2 };

  // Partes (para a linha de sombra entre volumes que se cobrem)
  const P = { TRONCO: 1, CABECA: 2, MAND: 3, ORELHA: 4, CAUDA: 6, JUBA: 7, CHIFRE: 8, PERNA: 10, EXTRA: 20 };

  // -------------------------------------------------------------------
  // Cena: z-buffer de elipsoides em projeção ortográfica oblíqua.
  // -------------------------------------------------------------------
  class Cena {
    constructor(W, H, vista, ox, oy) {
      this.W = W; this.H = H; this.v = vista; this.ox = ox; this.oy = oy; this.L = LARGO;
      const n = W * H;
      this.zb = new Float32Array(n).fill(-1e9);
      this.nx = new Float32Array(n); this.ny = new Float32Array(n); this.nz = new Float32Array(n);
      this.af = new Float32Array(n); this.al = new Float32Array(n); this.az = new Float32Array(n);
      this.wy = new Float32Array(n);
      this.vies = new Float32Array(n); this.lx = new Int8Array(n); this.ly = new Int8Array(n);
      this.mat = new Int8Array(n).fill(-1);
      this.parte = new Int16Array(n);
      this.sx = 0; this.sy = 0;          // deslocamento de tela (px inteiros) do grupo atual
      this.pf = 0; this.pl = 0; this.pz = 0; // quanto o grupo saiu do repouso (para a pelagem não escorregar)
      this.viesAtual = 0; this.parteAtual = 0;
      this.selos = [];
    }
    grupo(parte, sx = 0, sy = 0, vies = 0) { this.parteAtual = parte; this.sx = sx; this.sy = sy; this.viesAtual = vies; this.pf = this.pl = this.pz = 0; return this; }
    solto(pf, pl, pz) { this.pf = pf; this.pl = pl; this.pz = pz; return this; }
    // animal -> mundo
    mx(f, l) { return this.v === 0 ? f : this.v === 1 ? -l * this.L : l * this.L; }
    my(f, l) { return this.v === 0 ? l : this.v === 1 ? f * ESCORCO : -f * ESCORCO; }
    tela(f, l, z) {
      const x = this.mx(f, l), y = this.my(f, l);
      return [this.ox + this.sx + x, this.oy + this.sy + y * SP - z * CP, y * CP + z * SP];
    }
    elip(f, l, z, rf, rl, rz, mat) {
      const v = this.v, W = this.W, H = this.H;
      const wx = this.mx(f, l), wy = this.my(f, l);
      const Rx = v === 0 ? rf : rl * this.L, Ry = v === 0 ? rl : rf, Rz = rz;
      const X0 = this.ox + this.sx + wx, Y0 = this.oy + this.sy + wy * SP - z * CP, D0 = wy * CP + z * SP;
      const hh = Math.sqrt(Ry * Ry * SP * SP + Rz * Rz * CP * CP);
      const xa = Math.max(0, Math.floor(X0 - Rx)), xb = Math.min(W - 1, Math.ceil(X0 + Rx));
      const ya = Math.max(0, Math.floor(Y0 - hh)), yb = Math.min(H - 1, Math.ceil(Y0 + hh));
      const iRx = 1 / (Rx * Rx), iRy = 1 / (Ry * Ry), iRz = 1 / (Rz * Rz);
      const a = CP * CP * iRy + SP * SP * iRz;
      for (let Y = ya; Y <= yb; Y++) {
        const dv = Y + 0.5 - Y0;
        const b = 2 * dv * SP * CP * (iRy - iRz);
        const c0 = dv * dv * (SP * SP * iRy + CP * CP * iRz) - 1;
        for (let X = xa; X <= xb; X++) {
          const dx = X + 0.5 - X0;
          const c = c0 + dx * dx * iRx, disc = b * b - 4 * a * c;
          if (disc < 0) continue;
          const t = (-b + Math.sqrt(disc)) / (2 * a), d = D0 + t, i = Y * W + X;
          if (d <= this.zb[i]) continue;
          const ry = dv * SP + t * CP, rz2 = -dv * CP + t * SP;
          let nx = dx * iRx, ny = ry * iRy, nz = rz2 * iRz;
          const nn = 1 / Math.hypot(nx, ny, nz);
          this.zb[i] = d; this.nx[i] = nx * nn; this.ny[i] = ny * nn; this.nz[i] = nz * nn;
          this.mat[i] = mat; this.parte[i] = this.parteAtual; this.vies[i] = this.viesAtual; this.lx[i] = this.sx; this.ly[i] = this.sy;
          this.wy[i] = wy + ry;
          if (v === 0) { this.af[i] = f + dx - this.pf; this.al[i] = l + ry - this.pl; }
          else if (v === 1) { this.al[i] = l - dx / this.L - this.pl; this.af[i] = f + ry - this.pf; }
          else { this.al[i] = l + dx / this.L - this.pl; this.af[i] = f - ry - this.pf; }
          this.az[i] = z + rz2 - this.pz;
        }
      }
    }
    bola(f, l, z, r, mat) { this.elip(f, l, z, r, r, r, mat); }
    // cadeia de esferas entre dois pontos [f, l, z] com raio r0 -> r1
    cadeia(a, r0, b, r1, mat) {
      const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.ceil(d / Math.max(0.6, Math.min(r0, r1) * 0.4)));
      for (let k = 0; k <= n; k++) { const t = k / n, r = r0 + (r1 - r0) * t; this.elip(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, r, r, r, mat); }
    }
    // curva por vários pontos, com um raio por ponto
    curva(pts, raios, mat) { for (let k = 0; k < pts.length - 1; k++) this.cadeia(pts[k], raios[k], pts[k + 1], raios[k + 1], mat); }
    // o ponto do animal está à vista? (não coberto por outro volume)
    visivel(f, l, z, tol = 1.6) {
      const [X, Y, d] = this.tela(f, l, z), xi = Math.floor(X), yi = Math.floor(Y);
      if (xi < 0 || yi < 0 || xi >= this.W || yi >= this.H) return null;
      const i = yi * this.W + xi;
      return this.mat[i] >= 0 && d >= this.zb[i] - tol ? [xi, yi] : null;
    }
    // selo: px soltos [dx, dy, cor] ancorados num ponto do animal; só entra se a âncora estiver à vista
    selo(f, l, z, pts, tol) {
      const p = this.visivel(f, l, z, tol);
      if (!p) return false;
      for (const [dx, dy, cor] of pts) if (cor) this.selos.push(p[0] + dx, p[1] + dy, cor);
      return true;
    }
    // Pinta na grade. mats[i] = { rampa, ganho, vies, pelo (traços), pelagem (aceita padrão) }.
    // o.padrao(h) devolve outro material (ou null) para os px de material com pelagem.
    pintar(g, mats, o = {}) {
      const W = this.W, H = this.H, zb = this.zb, mat = this.mat, parte = this.parte;
      const sem = o.semente || 0, corte = o.corte, lado = o.parte, kProf = this.v === 0 ? 0 : (o.kProf || 0.028);
      const h = { f: 0, l: 0, z: 0, nz: 0, X: 0, Y: 0, parte: 0, b: 0 };
      for (let Y = 0; Y < H; Y++)
        for (let X = 0; X < W; X++) {
          const i = Y * W + X;
          if (mat[i] < 0) continue;
          if (lado && (lado === "fundo") !== (this.wy[i] < corte)) continue;
          let m = mats[mat[i]];
          const pr = parte[i], d = zb[i];
          h.f = this.af[i]; h.l = this.al[i]; h.z = this.az[i]; h.nz = this.nz[i]; h.X = X; h.Y = Y; h.parte = pr;
          h.b = hash2((this.v === 0 ? X - this.ox - this.lx[i] + 200 : Y - this.oy - this.ly[i] + 200) >> 1, 5, sem); // recorte irregular (dentes de 2 px) para as fronteiras de pelagem
          if (m.pelagem && o.padrao) m = o.padrao(h) || m;
          let l = (this.nx[i] * LUZ[0] + this.ny[i] * LUZ[1] + this.nz[i] * LUZ[2]) * (m.ganho || 1.7) - (m.base === undefined ? 0.75 : m.base) + (kProf ? Math.max(-0.45, Math.min(0.15, this.wy[i] * kProf)) : 0) + (m.vies || 0) + this.vies[i] + Math.min(0.12, (h.z - o.zMeio) * o.kAlt);
          // linha de sombra: um volume de outra parte passa na frente, encostado neste px
          let oc = 0;
          if (X > 0 && mat[i - 1] >= 0 && parte[i - 1] !== pr && zb[i - 1] - d > 1.7) oc = 1;
          else if (Y > 0 && mat[i - W] >= 0 && parte[i - W] !== pr && zb[i - W] - d > 1.7) oc = 1;
          else if (X < W - 1 && mat[i + 1] >= 0 && parte[i + 1] !== pr && zb[i + 1] - d > 1.7) oc = 0.7;
          else if (Y < H - 1 && mat[i + W] >= 0 && parte[i + W] !== pr && zb[i + W] - d > 1.7) oc = 0.7;
          if (oc) l -= 0.9 * oc;
          else if (m.pelo) {
            // pelagem: traços de 2 a 3 px no sentido do pelo (ao longo de f), presos ao corpo
            const Xl = X - this.ox - this.lx[i] + 200, Yl = Y - this.oy - this.ly[i] + 200;
            const lin = this.v === 0 ? Yl : Xl, col = Math.floor(((this.v === 0 ? Xl : Yl) + hash2(lin, 7, sem) * 6) / 3);
            const r = hash2(col, lin, sem + 31);
            const dn = this.v === 0 ? m.pelo : m.pelo * 0.55;
            if (r < dn) l -= 0.4; else if (r > 1 - dn * 0.6) l += 0.4;
          }
          g.fino(X, Y, sombrear(m.rampa, l, X, Y, o.pontilhar === true));
        }
      for (let k = 0; k < this.selos.length; k += 3) {
        const X = this.selos[k], Y = this.selos[k + 1];
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        if (lado && mat[Y * W + X] >= 0 && (lado === "fundo") !== (this.wy[Y * W + X] < corte)) continue;
        g.fino(X, Y, this.selos[k + 2]);
      }
    }
  }

  // -------------------------------------------------------------------
  // Materiais de um bicho (rampas de 6 tons), com a tinta dos raros.
  // -------------------------------------------------------------------
  function tingir(cor, tinta) {
    if (!tinta) return cor;
    const a = hexRgb(cor), b = hexRgb(tinta.length === 6 ? "#" + tinta : tinta);
    // multiplicação (como o setTint do jogo), suavizada para o desenho não perder a leitura
    return misturar(cor, rgbHex(Math.round((a[0] * b[0]) / 255), Math.round((a[1] * b[1]) / 255), Math.round((a[2] * b[2]) / 255)), 0.85);
  }
  const NOMES_MAT = ["pelo", "ventre", "dorso", "perna", "focinho", "juba", "casco", "nariz", "boca", "chifre", "mancha", "ponta", "extra", "extra2"];
  const IM = {}; NOMES_MAT.forEach((n, i) => (IM[n] = i));
  const cacheMats = new Map();
  function materiais(A, tinta) {
    const id = A.nome + "|" + (tinta || "");
    let r = cacheMats.get(id);
    if (r) return r;
    const c = A.cores, t = (cor) => tingir(cor, tinta);
    const tipo = A.tipoPelo || "pelo", dens = A.pelagem === undefined ? 0.1 : A.pelagem;
    const mk = (cor, tp, extra) => Object.assign({ rampa: rampa6(cor, tp) }, extra);
    r = [];
    r[IM.pelo] = mk(t(c.pelo), tipo, { pelo: dens, pelagem: true });
    r[IM.ventre] = mk(t(c.ventre || c.pelo), tipo, { pelo: dens * 0.6, vies: 0.05 });
    r[IM.dorso] = mk(t(c.dorso || c.pelo), tipo, { pelo: dens, vies: c.dorso ? -0.3 : 0 });
    r[IM.perna] = mk(t(c.perna || c.pelo), tipo, { pelo: dens * 0.5, pelagem: !c.perna || !!A.pernaPadrao });
    r[IM.focinho] = mk(t(c.focinho || c.ventre || c.pelo), tipo, {});
    r[IM.juba] = mk(t(c.juba || c.dorso || c.pelo), tipo, { pelo: 0.2, vies: c.juba ? -0.22 : 0 });
    r[IM.casco] = mk(c.casco || "#3a2c24", "couro", { ganho: 1.2, base: 0.3 });
    r[IM.nariz] = mk(c.nariz || "#2a1c1a", "couro", { ganho: 1, base: 0.3 });
    r[IM.boca] = mk(c.boca || "#8a2a2a", "pele", { ganho: 0.8, base: 0.3 });
    r[IM.chifre] = mk(c.chifre || "#8a7658", "madeira", {});
    r[IM.mancha] = mk(t(c.mancha || "#2e2018"), tipo, { pelo: dens * 0.5 });
    r[IM.ponta] = mk(t(c.ponta || c.pelo), tipo, { pelo: dens });
    r[IM.extra] = mk(t(c.extra || c.pelo), c.tipoExtra || tipo, { pelo: c.extraPelo || 0 });
    r[IM.extra2] = mk(t(c.extra2 || c.pata || c.pelo), c.tipoExtra2 || tipo, {});
    if (cacheMats.size < 400) cacheMats.set(id, r);
    return r;
  }

  // -------------------------------------------------------------------
  // Pose de cada quadro (0 parado, 1 respirar, 2..5 passo, 6 antecipação, 7 golpe)
  // -------------------------------------------------------------------
  // fase do par A (dianteira direita + traseira esquerda); o par B anda meio ciclo depois
  const FASE_A = { 2: 0, 3: 0.25, 4: 0.5, 5: 0.75 };
  function passoDe(fase, S, ergue) {
    fase = ((fase % 1) + 1) % 1;
    if (fase < 0.5) return [S * (1 - 4 * fase), 0];
    const u = (fase - 0.5) * 2;
    return [S * (-1 + 2 * u), Math.sin(Math.PI * u) * ergue];
  }
  // junta de dois ossos no plano (f, z): quadril H, pé F, ossos a e b; sinal = para que lado dobra (em f)
  function junta(H, F, a, b, sinal) {
    let dx = F[0] - H[0], dz = F[1] - H[1], d = Math.hypot(dx, dz);
    const dm = Math.min(d, a + b - 0.01), k = dm / (d || 1);
    dx *= k; dz *= k; d = dm || 0.01;
    const t = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - t * t));
    const ux = dx / d, uz = dz / d;
    // perpendicular: (uz, -ux) aponta para +f quando o osso desce
    return [H[0] + ux * t + -uz * hh * sinal, H[1] + uz * t + ux * hh * sinal];
  }

  // -------------------------------------------------------------------
  // O quadrúpede. A = anatomia (px de arte no porte 1; ver ANATOMIAS). Devolve âncoras para quem monta.
  // -------------------------------------------------------------------
  function desenharAnimal(g, vistaEm, q, A, o = {}) {
    const vista = typeof vistaEm === "string" ? VISTA[vistaEm] || 0 : vistaEm | 0;
    if (A.rasteiro) return desenharRasteiro(g, vista, q, A, o);
    const E = (A.esc || 1) * (o.porte || 1) * (vista === 0 ? 1 : A.escFrente || 1.12);
    const W = g.w, H = g.h;
    const T = A.tronco, Pn = A.perna, C = A.cabeca, N = A.pescoco;
    const comp = T.comp * E, mf = comp / 2;
    const afD = Pn.afast * E, afT = (Pn.afastT || Pn.afast) * E, pata = Pn.pata * E;
    // ---- pose
    const andando = q >= 2 && q <= 5, contato = q === 2 || q === 4;
    const pose = { corpoY: 0, cabY: 0, cabF: 0, cabZ: 0, boca: 0, cauda: 0, caudaZ: 0, av: 0, agacha: 0, incl: 0 };
    if (q === 1) { pose.corpoY = 1; pose.cabY = 1; pose.caudaZ = -0.6; }
    if (andando) { pose.corpoY = contato ? 1 : 0; pose.cabY = contato ? 0 : 1; pose.cauda = q === 2 ? 1 : q === 4 ? -1 : q === 3 ? 0.4 : -0.4; pose.caudaZ = contato ? 0.8 : 0; }
    if (q === 6) { pose.av = -(A.recuo === undefined ? 2 : A.recuo); pose.corpoY = 2; pose.cabY = vista === 2 ? 1 : 3; pose.cabF = -1.5 * E; pose.agacha = 1; pose.caudaZ = -1.5; pose.boca = (A.bocaAberta || 30) * 0.25; }
    if (q === 7) { pose.av = A.bote || 4; pose.corpoY = 0; pose.cabY = 0; pose.cabF = 2 * E; pose.cabZ = 0.5 * E; pose.boca = A.bocaAberta || 30; pose.caudaZ = 2; }
    if (o.pose) Object.assign(pose, o.pose);
    // ---- origem na tela: os pés mais próximos de quem olha ficam a 3 px do fim da célula
    const fPeD = mf + (Pn.fD || 0) * E, fPeT = -mf + (Pn.fT || 0) * E;
    let [ox, oy] = origem(g, A, vista, o);
    // avanço do golpe na direção da vista (de frente e de costas o chão limita a descida e a subida)
    if (pose.av) { if (vista === 0) ox += pose.av; else if (vista === 1) oy += Math.max(-2, Math.min(A.boteFrente || 2, pose.av)); else oy -= Math.max(-2, Math.min(3, pose.av)); }
    const cena = new Cena(W, H, vista, ox, oy);
    if (A.largo) cena.L = A.largo;
    const cy = pose.corpoY; // px de tela: o tronco desce
    const dzC = -cy / CP;   // o mesmo em altura do mundo (para as pernas acompanharem)
    const mundoY = (f, l) => cena.my(f, l);
    // ---- pernas: [frente?, lado]
    const zq = T.zq * E, zo = T.zo * E;
    const S = (Pn.passo || 4) * E, ergue = (Pn.ergue || 3) * E;
    const pernas = [];
    for (const [frente, s] of [[1, -1], [1, 1], [0, -1], [0, 1]]) {
      const parA = (frente && s > 0) || (!frente && s < 0);
      let df = 0, dz = 0;
      if (andando) [df, dz] = passoDe(FASE_A[q] + (parA ? 0 : 0.5), S, ergue);
      // parado: as de longe um pouco adiantadas, para as quatro aparecerem de lado
      const descanso = (s < 0 ? 1 : -0.5) * (Pn.desloc === undefined ? 1.2 : Pn.desloc) * E * (frente ? 1 : -0.6);
      let pf = (frente ? fPeD : fPeT) + descanso + df, pz = dz;
      if (q === 6) pf += frente ? 1.5 * E : 0.5 * E;
      if (q === 7) { if (frente) { pf += (s > 0 ? 3 : 1.5) * E; pz += (s > 0 ? 3 : 1) * E * (A.patada === false ? 0 : 1); } else pf -= 2.5 * E; }
      pernas.push({ frente, s, pf, pz });
    }
    const R0 = Pn.r0 * E, R1 = Pn.r1 * E;
    const desenharPerna = (p) => {
      const { frente, s, pf, pz } = p;
      const l = s * (frente ? afD : afT);
      const hf = frente ? mf + (Pn.ombroF || 0) * E : -mf + (Pn.quadrilF || 0) * E;
      const hz = (frente ? zo + (Pn.ombroZ || -1) * E : zq + (Pn.quadrilZ || -0.5) * E) + dzC;
      const longe = mundoY(hf, l) < -0.5 ? (vista === 0 ? -0.34 : -0.22) : 0;
      cena.grupo(P.PERNA + (frente ? 0 : 2) + (s > 0 ? 1 : 0), 0, 0, longe);
      const pe = [pf, pata * 0.9 + pz];
      const alc = hz - pata * 0.9;
      const mPerna = IM.perna, mCoxa = IM[Pn.matCoxa || "pelo"];
      const lp = l + s * (Pn.abre || 0) * E; // pé um pouco mais aberto que o ombro
      if (frente) {
        const a = alc * 0.48, b = alc * 0.56;
        const J = junta([hf, hz], pe, a, b, -1);
        cena.cadeia([hf, l, hz], R0 * (Pn.ombro || 1.15), [J[0], (l + lp) / 2, J[1]], R0 * 0.8, mCoxa);
        cena.cadeia([J[0], (l + lp) / 2, J[1]], R0 * 0.78, [pe[0], lp, pe[1] + R1 * 0.3], R1, mPerna);
      } else {
        // traseira: coxa para a frente até o joelho, canela para trás até o jarrete, e o metatarso desce
        const jar = [pe[0] - alc * (Pn.jarreteF === undefined ? 0.2 : Pn.jarreteF), pe[1] + alc * 0.36];
        const a = alc * 0.42, b = alc * 0.4;
        const J = junta([hf, hz], jar, a, b, 1);
        cena.cadeia([hf, l, hz], R0 * (Pn.coxa || 1.55), [J[0], l, J[1]], R0 * 1.0, mCoxa);
        cena.cadeia([J[0], l, J[1]], R0 * 0.95, [jar[0], lp, jar[1]], R1 * 1.05, mCoxa);
        cena.cadeia([jar[0], lp, jar[1]], R1 * 1.05, [pe[0], lp, pe[1] + R1 * 0.3], R1, mPerna);
      }
      // pata (ou casco)
      if (Pn.casco) {
        const hc = Pn.casco * E;
        cena.elip(pe[0] + pata * 0.25, lp, pe[1] - pata * 0.9 + hc * 0.5, pata * 1.05, pata * 0.95, hc * 0.62, IM.casco);
      } else {
        cena.elip(pe[0] + pata * 0.45, lp, pe[1] - pata * 0.2, pata * 1.3, pata, pata * 0.72, c2(A, "pata", mPerna));
        if (A.garras) {
          const gz = pe[1] - pata * 0.55, gf = pe[0] + pata * 1.6;
          if (vista === 0) cena.selo(gf - 0.3, lp, gz, [[0, 0, A.garras], [-2, 0, A.garras]], 2.5);
          else if (vista === 1) cena.selo(gf - 0.5, lp, gz, [[-1, 0, A.garras], [1, 0, A.garras]], 2.5);
        }
      }
    };
    // ---- cauda (atrás de tudo na ordem não importa: o z-buffer resolve)
    const tronco = () => {
      cena.grupo(P.TRONCO, 0, cy, 0);
      const n = Math.ceil(comp / 0.75);
      const [aL, aZ] = T.anca, [cL, cZ] = T.cintura, [pL, pZ] = T.peito;
      for (let k = 0; k <= n; k++) {
        const t = k / n, f = -mf + comp * t;
        // perfil: anca -> cintura -> peito (cosseno entre os três)
        const u = t < 0.5 ? t * 2 : (t - 0.5) * 2, w = (1 - Math.cos(Math.PI * u)) / 2;
        const rl = (t < 0.5 ? aL + (cL - aL) * w : cL + (pL - cL) * w) * E;
        const rz = (t < 0.5 ? aZ + (cZ - aZ) * w : cZ + (pZ - cZ) * w) * E;
        const zc = (T.zq + (T.zo - T.zq) * t) * E - (t > 0.5 ? (T.peitoCai || 0) * w * E : 0) + (T.arco || 0) * E * Math.sin(Math.PI * t)
          - pose.agacha * (t > 0.5 ? 0 : 0) + pose.incl * (t - 0.5) * E;
        // a barriga recolhe: o centro sobe na cintura
        const sobe = (T.recolhe || 0) * E * Math.sin(Math.PI * t);
        cena.elip(f, 0, zc + sobe, rz * 0.95, rl, rz, IM[T.mat || "pelo"]);
      }
      if (T.corcova) { const [hf, hz, rf, rl, rz] = T.corcova; cena.elip(hf * E, 0, hz * E, rf * E, rl * E, rz * E, IM.pelo); }
      if (A.la) {
        // lã: tufos redondos por cima do tronco
        const sem = sementeDe(A.nome);
        for (let k = 0; k < A.la.n; k++) {
          const t = hash2(k, 1, sem), ang = (hash2(k, 2, sem) - 0.5) * Math.PI * 1.5;
          const f = -mf - T.anca[1] * E * 0.6 + (comp + (T.anca[1] + T.peito[1]) * E * 0.75) * t;
          const tt = Math.max(0, Math.min(1, (f + mf) / comp));
          const rl = (T.anca[0] + (T.peito[0] - T.anca[0]) * tt) * E, rz = (T.anca[1] + (T.peito[1] - T.anca[1]) * tt) * E;
          const zc = (T.zq + (T.zo - T.zq) * tt) * E;
          const r = (A.la.r0 + hash2(k, 3, sem) * A.la.r1) * E;
          cena.bola(f, Math.sin(ang) * rl * 0.9, zc + Math.cos(ang) * rz * 0.85, r, IM.pelo);
        }
      }
      if (A.crista) {
        // crista de cerdas ao longo do lombo
        const cr = A.crista;
        for (let k = 0; k <= 24; k++) {
          const t = cr.de + (cr.ate - cr.de) * (k / 24), f = -mf + comp * t;
          const u = t < 0.5 ? t * 2 : (t - 0.5) * 2, w = (1 - Math.cos(Math.PI * u)) / 2;
          const rz = (t < 0.5 ? aZ + (cZ - aZ) * w : cZ + (pZ - cZ) * w) * E;
          const zc = (T.zq + (T.zo - T.zq) * t) * E + (T.arco || 0) * E * Math.sin(Math.PI * t) + (T.recolhe || 0) * E * Math.sin(Math.PI * t);
          cena.elip(f, 0, zc + rz + cr.alt * E * 0.2 * (k % 2 ? 1 : 0.6), 0.9 * E, cr.larg * E, cr.alt * E, IM.juba);
        }
      }
    };
    const cauda = () => {
      const K = A.cauda;
      if (!K) return;
      cena.grupo(P.CAUDA, 0, cy, 0);
      const bf = -mf - T.anca[1] * E * (K.baseF === undefined ? 0.75 : K.baseF), bz = zq + T.anca[1] * E * (K.baseZ === undefined ? 0.35 : K.baseZ);
      const bal = pose.cauda * (K.balanco === undefined ? 1.2 : K.balanco) * E;
      const pts = K.pts.map(([df, dz], i) => {
        const u = i / (K.pts.length - 1);
        let f = bf + df * E, z = bz + dz * E + pose.caudaZ * u * E * (K.sobe || 1);
        if (q === 7 && K.estica && vista === 0) { f = bf + (df * (1 - u * 0.2) - u * K.estica) * E; z = bz + dz * E * (1 - u * 0.75) + u * E; }
        return [f, bal * u * u, Math.max(z, K.raios[i] * E * 0.8)];
      });
      const mats = K.mats || [];
      for (let k = 0; k < pts.length - 1; k++) cena.cadeia(pts[k], K.raios[k] * E, pts[k + 1], K.raios[k + 1] * E, mats[k] !== undefined ? IM[mats[k]] : IM[K.mat || "pelo"]);
      if (K.tufo) { const u = pts[pts.length - 1]; cena.elip(u[0] - K.tufo * E * 0.3, u[1], u[2], K.tufo * E * 1.25, K.tufo * E, K.tufo * E, IM[K.matTufo || "juba"]); }
    };
    // ---- pescoço e cabeça
    let ancoraCabeca = null;
    const cabeca = () => {
      const hy = cy + pose.cabY - cy; // deslocamento extra da cabeça (px de tela), além do tronco
      const ang = (N.ang - pose.agacha * (N.baixa === undefined ? 14 : N.baixa) * (vista === 2 ? 0.25 : 1) + (q === 7 ? -(N.estica === undefined ? 10 : N.estica) : 0)) * GRAU;
      const n0 = [mf + (N.f || 0.5) * E, 0, zo + (N.z || 1) * E];
      const nl = N.comp * E;
      const n1 = [n0[0] + Math.cos(ang) * nl + pose.cabF, 0, n0[2] + Math.sin(ang) * nl + pose.cabZ];
      // pescoço (parte do tronco: funde com o peito)
      cena.grupo(P.TRONCO, 0, cy, 0);
      const nPts = N.pts ? N.pts.map(([u, dz, r]) => [n0[0] + (n1[0] - n0[0]) * u, 0, n0[2] + (n1[2] - n0[2]) * u + dz * E, r * E]) : null;
      if (nPts) { for (let k = 0; k < nPts.length - 1; k++) cena.cadeia(nPts[k], nPts[k][3], nPts[k + 1], nPts[k + 1][3], IM[N.mat || "pelo"]); }
      else cena.cadeia(n0, N.r0 * E, n1, N.r1 * E, IM[N.mat || "pelo"]);
      if (A.juba) {
        cena.grupo(P.JUBA, 0, cy + hy, 0);
        const jl = vista === 0 ? 1 : A.juba.largoFrente || 1.22, jz = vista === 0 ? 1 : A.juba.altoFrente || 1.12;
        for (const [u, dz, rf, rl, rz, mt] of A.juba.massas) cena.elip(n0[0] + (n1[0] - n0[0]) * u, 0, n0[2] + (n1[2] - n0[2]) * u + dz * E, rf * E, rl * E * jl, rz * E * jz, IM[mt || "juba"]);
      }
      if (A.crina) {
        // crina: fileira estreita sobre o pescoço, do topete até a cernelha
        cena.grupo(P.JUBA, 0, cy, 0);
        const cr = A.crina, n = 14;
        for (let k = 0; k <= n; k++) {
          const u = k / n * (cr.ate || 1), r = (N.r0 + (N.r1 - N.r0) * u) * E;
          cena.elip(n0[0] + (n1[0] - n0[0]) * u - Math.sin(ang) * r * 1.0, cr.cai ? cr.cai * E * 0.5 : 0, n0[2] + (n1[2] - n0[2]) * u + Math.cos(ang) * r * 1.0, cr.alt * E, cr.larg * E, cr.alt * E, IM.juba);
        }
      }
      // crânio
      const r = C.r * E, larg = C.larg || 1;
      const hf = n1[0] + (C.f || 0.4) * r, hz = n1[2] + (C.z || 0.25) * r;
      const sy = cy + hy;
      cena.grupo(P.CABECA, 0, sy, 0).solto(pose.cabF, 0, pose.cabZ);
      cena.elip(hf, 0, hz, r * (C.compr || 1), r * larg, r * (C.alt || 0.95), IM[C.mat || "pelo"]);
      if (C.bochecha && vista !== 2) for (const s of [-1, 1]) cena.elip(hf - r * 0.15, s * r * larg * 0.7, hz - r * 0.35, r * 0.7, r * C.bochecha, r * 0.6, IM[C.matBochecha || "ventre"]);
      // focinho: do crânio até a ponta, caindo
      const Fo = C.foc, cabAng = (C.ang || 0) * GRAU + (q === 7 ? (C.ergue || 8) * GRAU : 0);
      const dirF = Math.cos(cabAng), dirZ = Math.sin(cabAng);
      const f0 = [hf + r * 0.55 * dirF, 0, hz - r * 0.2 + r * 0.55 * dirZ];
      const tip = [f0[0] + Fo.comp * E * dirF + Fo.cai * E * dirZ, 0, f0[2] - Fo.cai * E * dirF + Fo.comp * E * dirZ];
      const mF = IM[Fo.mat || "focinho"];
      const lf = Fo.larg || 1;
      const nF = Math.ceil(Fo.comp * E / 0.6);
      for (let k = 0; k <= nF; k++) {
        const t = k / nF, rr = (Fo.r0 + (Fo.r1 - Fo.r0) * t) * E;
        cena.elip(f0[0] + (tip[0] - f0[0]) * t, 0, f0[2] + (tip[2] - f0[2]) * t, rr, rr * lf, rr * (Fo.alt || 0.9), t < (Fo.de === undefined ? 0.25 : Fo.de) ? IM[C.mat || "pelo"] : mF);
      }
      // mandíbula: gira para baixo no golpe
      const ab = pose.boca * GRAU;
      const Mn = C.mand || {};
      const m0 = [hf + r * 0.1, 0, hz - r * 0.62];
      const mc = Fo.comp * E * (Mn.comp || 0.86) + r * 0.45;
      const angM = Math.atan2(tip[2] - f0[2], tip[0] - f0[0]) - ab;
      const m1 = [m0[0] + Math.cos(angM) * mc, 0, m0[2] + Math.sin(angM) * mc - (Mn.cai || 0.3) * E];
      cena.grupo(P.MAND, 0, sy, 0).solto(pose.cabF, 0, pose.cabZ);
      const rm0 = (Mn.r0 || Fo.r0 * 0.75) * E, rm1 = (Mn.r1 || Fo.r1 * 0.7) * E;
      const nM = Math.ceil(mc / 0.6);
      for (let k = 0; k <= nM; k++) { const t = k / nM, rr = rm0 + (rm1 - rm0) * t; cena.elip(m0[0] + (m1[0] - m0[0]) * t, 0, m0[2] + (m1[2] - m0[2]) * t, rr, rr * lf * 0.9, rr * 0.8, IM[Mn.mat || "ventre"]); }
      if (pose.boca > 12) {
        // céu da boca e língua
        cena.grupo(P.MAND + 100, 0, sy, 0);
        const mm = [(tip[0] + m1[0]) / 2 - Fo.comp * E * 0.3, 0, (tip[2] + m1[2]) / 2];
        cena.elip(mm[0], 0, mm[2], Fo.comp * E * 0.42, Fo.r1 * E * lf * 0.8, Math.max(1, Math.abs(tip[2] - m1[2]) * 0.34), IM.boca);
      }
      // orelhas
      const O = A.orelha;
      if (O) for (const s of [-1, 1]) {
        cena.grupo(P.ORELHA + (s > 0 ? 1 : 0), 0, sy, (mundoY(hf, s) < 0 && vista === 0 ? -0.18 : 0) + (O.vies || 0));
        const bx = hf + (O.f === undefined ? -0.25 : O.f) * r, bl = s * (O.abre === undefined ? 0.62 : O.abre) * r * larg, bzz = hz + r * (O.z === undefined ? 0.6 : O.z);
        const tras = q === 6 || q === 7 ? (O.deita || 0) * E * (vista === 0 ? 1 : 0.4) : 0;
        if (O.tipo === "redonda") cena.elip(bx - tras * 0.5, bl, bzz + O.alt * E * 0.45 - tras * 0.3, O.esp * E, O.base * E, O.alt * E * 0.75, IM[O.mat || "pelo"]);
        else if (O.tipo === "caida") cena.cadeia([bx, bl, bzz - r * 0.2], O.base * E, [bx - (O.tras || 0) * E, bl + s * O.alt * E * 0.75, bzz - r * 0.2 - O.alt * E * 0.65], O.base * E * 0.7, IM[O.mat || "pelo"]);
        else {
          // em pé (pontuda ou longa): cone da base à ponta, um pouco aberto para fora
          const ko = vista === 1 ? O.frente || 1.3 : 1; // de frente e de costas a orelha precisa de mais corpo para ler
          const tipO = [bx - (O.tras || 0.4) * E - tras, bl + s * (O.fora || 0.5) * E * ko, bzz + O.alt * E * (vista === 1 ? 1.12 : 1) - tras * 0.6];
          cena.cadeia([bx, bl, bzz - 0.4 * E], O.base * E * ko, tipO, (O.ponta || 0.45) * E * ko, IM[O.mat || "pelo"]);
          if (O.dentro && vista === 1) cena.selo(bx + O.base * E * ko * 0.7, bl + s * (O.fora || 0.5) * E * ko * 0.4, bzz + O.alt * E * 0.3, [[0, 0, O.dentro], [0, -1, O.dentro]], 3);
        }
      }
      // chifres
      if (A.chifre) for (const s of [-1, 1]) {
        cena.grupo(P.CHIFRE + (s > 0 ? 1 : 0), 0, sy, mundoY(hf, s) < 0 && vista === 0 ? -0.2 : 0);
        const Ch = A.chifre;
        const pts = Ch.pts.map(([df, dl, dz]) => [hf + df * E, s * dl * E, hz + r * 0.6 + dz * E]);
        cena.curva(pts, Ch.raios.map((x) => x * E), IM.chifre);
      }
      // ---- selos da cara
      cena.grupo(P.CABECA, 0, sy, 0);
      const olho = C.olho || {}, corO = A.cores.olho || "#e8b94a", esc = A.cores.traço || "#1c1210", ld = rampa6(tingir(A.cores.pelo, o.tinta), A.tipoPelo || "pelo")[1];
      const grande = C.olhoGrande;
      for (const s of [-1, 1]) {
        const ef = hf + r * (olho.f === undefined ? 0.5 : olho.f), el = s * r * larg * (olho.l === undefined ? 0.72 : olho.l), ez = hz + r * (olho.z === undefined ? 0.32 : olho.z);
        if (vista === 0) {
          if (s < 0) continue;
          cena.selo(ef, el, ez, grande ? [[-1, -1, ld], [0, -1, ld], [1, -1, ld], [-1, 0, corO], [0, 0, esc], [1, 0, esc], [0, 1, ld]] : [[-1, -1, ld], [0, -1, ld], [-1, 0, corO], [0, 0, esc]], 2.5);
        } else if (vista === 1) {
          const d = s > 0 ? -1 : 1; // l positivo cai à esquerda na tela
          cena.selo(ef, el, ez, grande ? [[0, -1, ld], [d, -1, ld], [0, 0, corO], [d, 0, esc], [0, 1, esc]] : [[0, -1, ld], [d, -1, ld], [0, 0, esc], [d, 0, corO]], 3);
        }
      }
      const nar = A.cores.nariz || "#2a1c1a", narL = misturar(nar, "#fff6e0", 0.3);
      const nf = tip[0] + Fo.r1 * E * 0.55, nz = tip[2] + Fo.r1 * E * 0.3;
      if (C.narina) {
        // herbívoro: narinas e boca escuras na ponta do focinho comprido
        if (vista === 0) cena.selo(nf, Fo.r1 * E * lf * 0.6, nz - Fo.r1 * E * 0.2, [[0, 0, nar]], 3);
        else if (vista === 1) { cena.selo(nf, 0, nz - Fo.r1 * E * 0.3, [[-2, 0, nar], [1, 0, nar]], 3); }
      } else if (vista === 0) cena.selo(nf, 0.4, nz, C.narizGrande ? [[0, 0, nar], [-1, 0, nar], [0, 1, nar], [-1, -1, narL], [0, -1, nar]] : [[0, 0, nar], [-1, 0, narL], [0, 1, nar]], 3);
      else if (vista === 1) cena.selo(nf, 0, nz, C.narizGrande ? [[-1, 0, narL], [0, 0, nar], [1, 0, nar], [-1, 1, nar], [0, 1, nar], [1, 1, nar], [0, 2, nar]] : [[-1, 0, narL], [0, 0, nar], [-1, 1, nar], [0, 1, nar]], 3);
      // boca: risco escuro entre o focinho e a mandíbula (de lado) e presas
      const corBoca = rampa6(tingir(A.cores.focinho || A.cores.ventre || A.cores.pelo, o.tinta), "pelo")[0];
      if (vista === 0 && pose.boca < 12 && !C.semBoca) {
        const n = Math.max(2, Math.round(Fo.comp * E * 0.75));
        for (let k = 1; k <= n; k++) {
          const t = 1 - k / (n + 1) * 0.8, rr = (Fo.r0 + (Fo.r1 - Fo.r0) * t) * E;
          cena.selo(f0[0] + (tip[0] - f0[0]) * t, rr * lf * 0.8, f0[2] + (tip[2] - f0[2]) * t - rr * 0.62, [[0, 0, corBoca]], 2.2);
        }
      }
      const presa = A.presas;
      if (presa) {
        const branco = "#f6efdc", bs = "#cfc4a8";
        if (vista === 0) {
          if (pose.boca > 12 || presa.sempre) {
            cena.selo(tip[0] - Fo.r1 * E * 0.6, Fo.r1 * E * lf * 0.7, tip[2] - Fo.r1 * E * 0.75, presa.longa ? [[0, 0, branco], [0, 1, branco], [0, 2, bs]] : [[0, 0, branco], [0, 1, bs]], 4);
            if (pose.boca > 12) { cena.selo(tip[0] - Fo.r1 * E * 2.2, Fo.r1 * E * lf * 0.7, tip[2] - Fo.r1 * E * 0.6, [[0, 0, branco]], 4); cena.selo(m1[0] - rm1 * 0.6, rm1 * 0.7, m1[2] + rm1 * 0.8, [[0, 0, branco], [-2, 0, branco]], 4); }
          }
        } else if (vista === 1 && pose.boca > 12) {
          const w = Math.max(1, Math.round(Fo.r1 * E * lf * 0.8));
          cena.selo(tip[0], 0, tip[2] - Fo.r1 * E * 0.8, [[-w, 0, branco], [w - 1, 0, branco], [-w, 1, bs], [w - 1, 1, bs]], 5);
          cena.selo(m1[0], 0, m1[2] + rm1 * 0.6, [[-w + 1, 0, branco], [w - 2, 0, branco]], 5);
        }
      }
      if (A.defesas) {
        // defesas do javali: saem da mandíbula e curvam para cima
        const Dn = A.defesas, bf = tip[0] - Fo.comp * E * 0.3, bz = tip[2] - Fo.r1 * E * 0.4;
        if (vista === 0) cena.selo(bf, Fo.r1 * E * lf, bz, [[0, 0, Dn], [1, -1, Dn], [1, -2, "#ffffff"]], 4);
        else if (vista === 1) for (const s of [-1, 1]) cena.selo(bf, s * Fo.r1 * E * lf * 0.9, bz, [[-s, 0, Dn], [-s, -1, "#ffffff"], [-s * 2, -2, Dn]], 4);
      }
      if (A.barbicha) {
        cena.grupo(P.MAND, 0, sy, 0);
        const B = A.barbicha;
        cena.cadeia([m0[0] + mc * 0.55, 0, m0[2] - 0.5 * E], B.r * E, [m0[0] + mc * 0.45, 0, m0[2] - B.comp * E], B.r * E * 0.5, IM[B.mat || "juba"]);
      }
      ancoraCabeca = cena.tela(hf, 0, hz + r);
    };

    // ---- montar tudo (a ordem não importa: z-buffer)
    cauda();
    tronco();
    for (const p of pernas) desenharPerna(p);
    cabeca();
    if (A.extra) A.extra(cena, { E, q, vista, pose, cy, mf, zq, zo, IM, P });
    // ---- pintar
    const mats = materiais(A, o.tinta || null);
    const zV = (A.zVentre === undefined ? -99 : A.zVentre) * E, zD = (A.zDorso === undefined ? 999 : A.zDorso) * E;
    const pad = A.padrao;
    const ctxPad = { E, mats, IM, mf, vista };
    cena.pintar(g, mats, {
      semente: sementeDe(A.nome), zMeio: zo * 0.8, kAlt: 0.3 / zo, parte: o.parte, corte: o.corte === undefined ? (vista === 0 ? 0 : vista === 1 ? (A.selaF || 0) * E : -(A.selaF || 0) * E) : o.corte,
      padrao(h) {
        if (pad) { const r = pad(h, ctxPad); if (r) return r; }
        if (h.parte < P.PERNA && h.z + (h.b - 0.5) * 1.6 < zV) return mats[IM.ventre];
        if (h.nz > 0.35 && h.z - (h.b - 0.5) * 1.6 > zD) return mats[IM.dorso];
        return null;
      },
    });
    if (o.medindo) o.medindo(cena);
    const selaF = (A.selaF || 0) * E, selaZ = (A.selaZ || T.zo + T.peito[1]) * E;
    cena.grupo(0, 0, cy, 0);
    return { ox, oy, corpoY: cy, sela: cena.tela(selaF, 0, selaZ).slice(0, 2).map(Math.round), cabeca: ancoraCabeca ? ancoraCabeca.slice(0, 2).map(Math.round) : null, tela: (f, l, z) => cena.tela(f * E, l * E, z * E), escala: E };
  }
  // Enquadramento: mede a caixa de todos os quadros de uma vista e devolve a origem [ox, oy] que centra o
  // bicho na largura da célula e põe o px mais baixo a 2 px do fim dela (1 px de margem para o contorno).
  const cacheAjuste = new Map();
  const FOLGA = 28;
  function ajuste(A, porte, vista, W, H) {
    const id = A.nome + "|" + porte + "|" + vista + "|" + W + "x" + H;
    let r = cacheAjuste.get(id);
    if (r) return r;
    const GW = W + 2 * FOLGA, GH = H + 2 * FOLGA; // grade folgada: mede também o que sairia da célula
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    const gm = { w: GW, h: GH, fino() {} };
    const medindo = (c) => { for (let i = 0; i < c.mat.length; i++) if (c.mat[i] >= 0) { const X = i % GW, Y = (i / GW) | 0; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; } };
    for (const q of [0, 2, 4, 6, 7]) desenharAnimal(gm, vista, q, A, { porte, medindo }); // os extremos: parado, os dois contatos e o golpe
    r = [Math.round(GW / 2 + (W - 1 - x0 - x1) / 2), Math.round(GH / 2) + H - 3 - y1, x1 - x0 + 1, y1 - y0 + 1];
    if (typeof process !== "undefined" && process.env && process.env.DEPURA) console.log("ajuste", id, "largura", r[2], "altura", r[3], r[2] > W - 2 || r[3] > H - 4 ? "*** NAO CABE" : "");
    cacheAjuste.set(id, r);
    return r;
  }
  function origem(g, A, vista, o) {
    if (o.medindo) return [Math.round(g.w / 2), Math.round(g.h / 2)];
    if (o.ox !== undefined && o.oy !== undefined) return [o.ox, o.oy];
    const aj = ajuste(A, o.porte || 1, vista, g.w, g.h);
    return [aj[0] + (o.dx || 0), aj[1] + (o.dy || 0)];
  }
  const c2 = (A, nome, padrao) => (A.cores[nome] ? IM.extra2 : padrao);

  // -------------------------------------------------------------------
  // Rasteiro (crocodilo): corpo baixo e largo, pernas abertas para os lados, cauda longa que ondula e
  // a bocarra que abre. Mesma câmera, mesma luz e mesmos materiais do quadrúpede.
  // -------------------------------------------------------------------
  function desenharRasteiro(g, vista, q, A, o = {}) {
    const E = (A.esc || 1) * (o.porte || 1) * (vista === 0 ? 1 : A.escFrente || 1.08);
    const W = g.w, H = g.h, R = A.rasteiro;
    const andando = q >= 2 && q <= 5;
    const av = q === 6 ? -(A.recuo === undefined ? 2 : A.recuo) : q === 7 ? A.bote || 4 : 0;
    let [ox, oy] = origem(g, A, vista, o);
    if (av) { if (vista === 0) ox += av; else if (vista === 1) oy += Math.max(-2, Math.min(2, av)); else oy -= Math.max(-2, Math.min(3, av)); }
    const cena = new Cena(W, H, vista, ox, oy);
    const boca = q === 7 ? R.bocaAberta : q === 6 ? R.bocaAberta * 0.3 : q === 1 ? 4 : 0;
    const ergue = q === 7 ? 1.2 * E : q === 6 ? 0.6 * E : 0; // o peito sobe no bote
    const fase = andando ? (q - 2) / 4 : 0;
    const onda = andando ? Math.sin(fase * 2 * Math.PI) : q === 1 ? 0.35 : q === 7 ? -0.6 : q === 6 ? 0.8 : 0;
    const zc = R.z * E;
    // cauda: afina e ondula para os lados
    cena.grupo(P.CAUDA, 0, 0, 0);
    const nC = Math.ceil(R.cauda * E / 0.7), f0 = -R.tras * E;
    for (let k = 0; k <= nC; k++) {
      const u = k / nC, f = f0 - R.cauda * E * u;
      const l = Math.sin(onda * 1.4 + u * Math.PI * 1.25) * u * R.balanco * E * (0.5 + 0.5 * Math.abs(onda) + 0.25);
      const r = (R.rz * 0.95 * (1 - u) + 0.7 * u) * E;
      cena.elip(f, l, Math.max(r * 0.9, zc * (1 - u * 0.75)), r * 1.2, r * (1.15 - u * 0.3), r, IM.pelo);
      if (k % Math.round(2.6 * E / 0.7) === 0 && u < 0.92) cena.elip(f, l, Math.max(r * 0.9, zc * (1 - u * 0.75)) + r * 0.95, 0.9 * E, 0.6 * E, (1.0 - u * 0.4) * E, IM.dorso);
    }
    // tronco
    cena.grupo(P.TRONCO, 0, 0, 0);
    const nT = Math.ceil((R.tras + R.frente) * E / 0.7);
    for (let k = 0; k <= nT; k++) {
      const t = k / nT, f = (-R.tras + (R.tras + R.frente) * t) * E, w = Math.sin(Math.PI * (0.12 + t * 0.8));
      cena.elip(f, 0, zc + ergue * t, R.rz * E * 1.1, (R.rl * (0.72 + 0.28 * w)) * E, R.rz * E * (0.85 + 0.15 * w), IM.pelo);
    }
    // escudos do dorso em duas fileiras
    for (let f = -R.tras + 1; f <= R.frente - 1; f += 2.6) for (const s of [-1, 1]) {
      const t = (f + R.tras) / (R.tras + R.frente);
      cena.elip(f * E, s * R.rl * 0.36 * E, zc + ergue * t + R.rz * E * 0.86, 1.0 * E, 0.85 * E, 0.9 * E, IM.dorso);
    }
    // pernas abertas
    const S = R.passo * E;
    for (const [frente, s] of [[1, -1], [1, 1], [0, -1], [0, 1]]) {
      const parA = (frente && s > 0) || (!frente && s < 0);
      let df = 0, dz = 0;
      if (andando) [df, dz] = passoDe(fase + (parA ? 0 : 0.5), S, 1.6 * E);
      if (q === 7) df += frente ? 1.5 * E : -2 * E;
      const hf = (frente ? R.frente - 3.5 : -R.tras + 2.5) * E, hz = zc * 0.85 + (frente ? ergue * 0.8 : 0);
      const longe = cena.my(hf, s) < -0.5 && vista === 0 ? -0.3 : 0;
      cena.grupo(P.PERNA + (frente ? 0 : 2) + (s > 0 ? 1 : 0), 0, 0, longe);
      const cot = [hf + (frente ? -1 : 1.2) * E + df * 0.4, s * (R.rl + 2.4) * E, hz + 0.8 * E + dz * 0.5];
      const pe = [hf + (frente ? 1.5 : -0.5) * E + df, s * (R.rl + 3.6) * E, 1.1 * E + dz];
      cena.cadeia([hf, s * R.rl * 0.7 * E, hz], 2.0 * E, cot, 1.7 * E, IM.pelo);
      cena.cadeia(cot, 1.6 * E, pe, 1.3 * E, IM.perna);
      cena.elip(pe[0] + 0.8 * E, pe[1] + s * 0.4 * E, pe[2] - 0.2 * E, 2.1 * E, 1.7 * E, 0.95 * E, IM.perna);
      if (vista === 0) cena.selo(pe[0] + 2.6 * E, pe[1], pe[2] - 0.4 * E, [[0, 0, A.garras], [-2, 0, A.garras]], 2.5);
      else if (vista === 1) cena.selo(pe[0] + 2.2 * E, pe[1], pe[2] - 0.4 * E, [[-1, 0, A.garras], [1, 0, A.garras]], 2.5);
    }
    // cabeça: crânio chato, focinho comprido e a mandíbula
    const hx = (R.frente + 2.5) * E + (q === 6 ? -1.5 * E : 0), hz = zc + ergue + 0.3 * E;
    const aS = boca * 0.68 * GRAU, aI = boca * 0.32 * GRAU;
    cena.grupo(P.CABECA, 0, 0, 0);
    cena.elip(hx, 0, hz, 4.4 * E, R.rl * 0.76 * E, R.rz * 0.84 * E, IM.pelo);
    const nF = Math.ceil(R.focinho * E / 0.6);
    for (let k = 0; k <= nF; k++) {
      const t = k / nF, d = (1.5 + R.focinho * t) * E;
      cena.elip(hx + Math.cos(aS) * d, 0, hz + 0.2 * E + Math.sin(aS) * d, 1.6 * E, (R.rl * 0.56 - (R.rl * 0.56 - 2.2) * t) * E, (1.55 - 0.4 * t) * E, IM.pelo);
    }
    const ponta = [hx + Math.cos(aS) * (R.focinho + 1.2) * E, 0, hz + 0.2 * E + Math.sin(aS) * (R.focinho + 1.2) * E];
    cena.elip(ponta[0], 0, ponta[2] + 0.6 * E, 1.5 * E, 2.1 * E, 1.3 * E, IM.pelo); // calombo das narinas
    cena.grupo(P.MAND, 0, 0, 0);
    for (let k = 0; k <= nF; k++) {
      const t = k / nF, d = (0.5 + (R.focinho + 0.6) * t) * E;
      cena.elip(hx + Math.cos(aI) * d, 0, Math.max(1.0 * E, hz - 1.9 * E - Math.sin(aI) * d), 1.5 * E, (R.rl * 0.5 - (R.rl * 0.5 - 1.8) * t) * E, 1.05 * E, IM.ventre);
    }
    if (boca > 12) {
      cena.grupo(P.MAND + 100, 0, 0, 0);
      const d = R.focinho * 0.5 * E;
      cena.elip(hx + d, 0, hz - 0.8 * E + Math.sin(aS) * d * 0.4, R.focinho * 0.46 * E, 1.9 * E, Math.max(1, Math.sin(aS) * d * 0.55), IM.boca);
    }
    // olhos no alto do crânio
    for (const s of [-1, 1]) {
      cena.grupo(P.ORELHA + (s > 0 ? 1 : 0), 0, 0, 0);
      const ef = hx + 0.6 * E, el = s * R.rl * 0.42 * E, ez = hz + R.rz * 0.8 * E;
      cena.bola(ef, el, ez, 1.35 * E, IM.dorso);
      const am = A.cores.olho, pr = "#1c1210";
      if (vista === 0 && s > 0) cena.selo(ef + 0.4 * E, el + 0.8 * E, ez + 0.2 * E, [[0, 0, am], [1, 0, pr]], 3);
      else if (vista === 1) cena.selo(ef + 1.0 * E, el, ez + 0.1 * E, [[0, 0, am], [s > 0 ? -1 : 1, 0, pr]], 3);
    }
    // dentes: fileira branca na borda das mandíbulas (de lado) e presas de frente
    const br = "#f6efdc";
    cena.grupo(P.CABECA, 0, 0, 0);
    if (vista === 0) {
      for (let k = 1; k <= nF; k += 2) {
        const t = k / nF, d = (1.5 + R.focinho * t) * E;
        const l = (R.rl * 0.56 - (R.rl * 0.56 - 2.2) * t) * E * 0.8;
        if ((k >> 1) % 2 === 0 || boca > 12) cena.selo(hx + Math.cos(aS) * d, l, hz + 0.2 * E + Math.sin(aS) * d - 1.3 * E, [[0, 0, br]], 3.5);
        if (boca > 12 && (k >> 1) % 2 === 1) cena.selo(hx + Math.cos(aI) * d, l * 0.9, Math.max(1.0 * E, hz - 1.9 * E - Math.sin(aI) * d) + 1.1 * E, [[0, 0, br]], 3.5);
      }
      cena.selo(ponta[0] + 0.6 * E, 1.2 * E, ponta[2] + 1.2 * E, [[0, 0, "#1c1210"]], 3);
    } else if (vista === 1) {
      cena.selo(ponta[0] + 1.2 * E, 0, ponta[2] + 1.0 * E, [[-2, 0, "#1c1210"], [1, 0, "#1c1210"]], 3);
      if (boca > 12) { cena.selo(ponta[0], 0, ponta[2] - 1.2 * E, [[-2, 0, br], [1, 0, br], [-1, 0, br], [0, 0, br]], 5); }
    }
    if (o.medindo) o.medindo(cena);
    const mats = materiais(A, o.tinta || null);
    const zV = A.zVentre * E;
    cena.pintar(g, mats, {
      semente: sementeDe(A.nome), zMeio: zc, kAlt: 0.04 / E, parte: o.parte, corte: 0,
      padrao(h) {
        if (h.parte !== P.CAUDA && h.z + (h.b - 0.5) * 1.2 < zV) return mats[IM.ventre];
        if (h.nz > 0.1 && Math.sin((h.f / E) * 0.62 + 0.8) > 0.62) return mats[IM.mancha];
        return null;
      },
    });
    return { ox, oy, escala: E, tela: (f, l, z) => cena.tela(f * E, l * E, z * E) };
  }

  // -------------------------------------------------------------------
  // Anatomias (px de arte no porte 1). deriva() copia uma anatomia e troca só o que muda.
  // -------------------------------------------------------------------
  function deriva(base, muda) {
    const r = Object.assign({}, base);
    for (const k of Object.keys(muda)) {
      const v = muda[k];
      r[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k]) && k !== "cauda" && k !== "juba" ? deriva(base[k], v) : v;
    }
    return r;
  }
  const CAUDA_PELUDA = { pts: [[0, 0], [-2.5, -1.5], [-4.5, -5], [-5.2, -9.5]], raios: [1.5, 2.1, 2.3, 1.1], estica: 1, mats: ["dorso", "dorso", "ponta"] };
  const ANATOMIAS = {};
  // Lobo: cinzento, lombo escuro, peito e focinho claros, cauda cheia de ponta preta.
  ANATOMIAS.lobo = {
    nome: "lobo", cel: [48, 48], esc: 0.96, largo: 1.36, bote: 3, recuo: 1, escFrente: 1.08, alt: 31, sombra: [34, 12],
    cores: { pelo: "#8d7f70", dorso: "#54483f", ventre: "#cfc2aa", perna: "#a89a86", focinho: "#cfc2aa", ponta: "#4a4038", olho: "#f0c040", nariz: "#231816" },
    zVentre: 12.4, zDorso: 19,
    tronco: { comp: 14.5, zq: 16.4, zo: 17, anca: [4.2, 4.5], cintura: [3.6, 3.9], peito: [4.7, 5.6], recolhe: 0.9, peitoCai: 0.6 },
    pescoco: { comp: 5.2, ang: 46, r0: 4.5, r1: 3.7, f: 0.5, z: 1.4 },
    cabeca: { r: 3.9, larg: 1.02, foc: { comp: 6.2, r0: 2.5, r1: 1.55, cai: 1.5 }, bochecha: 1.0, olho: {} },
    orelha: { tipo: "pontuda", alt: 5.2, base: 2.0, abre: 0.8, fora: 0.9, dentro: "#c4a898", deita: 1.5, vies: 0.1, mat: "dorso" },
    perna: { r0: 2.3, r1: 1.2, pata: 1.55, afast: 3.4, passo: 4.4, ergue: 3, fD: -0.5, fT: -1 },
    cauda: CAUDA_PELUDA, presas: {},
  };
  // Chacal dourado: menor e mais fino, orelhas grandes, manto grisalho no lombo.
  ANATOMIAS.chacal = deriva(ANATOMIAS.lobo, {
    nome: "chacal", esc: 0.84, bote: 3, recuo: 2, alt: 28, sombra: [30, 10],
    cores: { pelo: "#c9984f", dorso: "#7d6a55", ventre: "#efdcb0", perna: "#cf9a4a", focinho: "#efdcb0", ponta: "#3a2c22", olho: "#e8b030" },
    tronco: { anca: [3.8, 4.1], cintura: [3.2, 3.5], peito: [4.2, 5.0] },
    cabeca: { r: 3.7, foc: { comp: 6.6, r0: 2.2, r1: 1.35, cai: 1.4 }, bochecha: 0.8 },
    orelha: { alt: 6.6, base: 2.2, abre: 0.78, fora: 1.2, dentro: "#f0c8a0", mat: "pelo", vies: 0.1 },
    perna: { r0: 2.0, r1: 1.05, pata: 1.4 },
  });
  // Cão pastor (aliado): castanho de peito, meias e ponta da cauda brancos; cauda enrolada sobre o lombo.
  ANATOMIAS.cao = deriva(ANATOMIAS.lobo, {
    nome: "cao", esc: 0.86, bote: 3, recuo: 2, alt: 30, sombra: [30, 10], bocaAberta: 24,
    cores: { pelo: "#b57c44", dorso: "#8a5a30", ventre: "#f1e6cf", perna: "#ecdfc4", focinho: "#f1e6cf", ponta: "#f1e6cf", olho: "#3a2416", nariz: "#231816" },
    zVentre: 13, zDorso: 19.5,
    cabeca: { r: 4.0, foc: { comp: 5.2, r0: 2.6, r1: 1.8, cai: 1.4 }, bochecha: 0.7 },
    orelha: { alt: 4.2, base: 2.0, abre: 0.74, fora: 1.0, dentro: "#e0a88a", mat: "dorso" },
    cauda: { pts: [[0, 0], [-2.4, 2.4], [-1.8, 5.4], [0.8, 6]], raios: [1.5, 1.9, 1.9, 1.3], mats: ["pelo", "pelo", "ponta"], balanco: 1.6, baseZ: 0.6 },
    presas: null,
  });
  // Hiena-listrada: dianteira alta e garupa caída, cabeça pesada de focinho escuro, crista e listras.
  ANATOMIAS.hiena = deriva(ANATOMIAS.lobo, {
    nome: "hiena", escFrente: 1.06, esc: 0.98, bote: 3, recuo: 1, alt: 30, sombra: [34, 12], pernaPadrao: true,
    cores: { pelo: "#b3a283", ventre: "#d9cba8", perna: "#b3a283", focinho: "#3a302a", juba: "#4a4036", mancha: "#3e342c", ponta: "#3a302a", olho: "#e0a030", nariz: "#1c1412" },
    zVentre: 10.5, zDorso: 99,
    tronco: { comp: 13, zq: 14.4, zo: 17.8, anca: [3.9, 4.1], cintura: [3.8, 4.2], peito: [4.9, 6.0], recolhe: 0.6, peitoCai: 0.6 },
    pescoco: { comp: 5.4, ang: 34, r0: 4.8, r1: 4.2, f: 0.8, z: 1.2 },
    cabeca: { r: 4.2, larg: 1.05, foc: { comp: 4.8, r0: 2.9, r1: 2.1, cai: 1.5, de: 0.1 }, bochecha: 0, mand: { mat: "focinho" } },
    orelha: { tipo: "pontuda", alt: 4.6, base: 2.2, ponta: 1.0, abre: 0.8, fora: 1.0, dentro: "#2a201c", vies: 0.2 },
    perna: { r0: 2.3, r1: 1.25, pata: 1.6, afast: 3.5, passo: 4.2 },
    crista: { de: 0.2, ate: 1.25, alt: 1.5, larg: 0.9 },
    cauda: { pts: [[0, 0], [-2.2, -2], [-3.4, -5.5], [-3.6, -8.5]], raios: [1.4, 1.9, 2.0, 1.1], mats: ["juba", "juba", "ponta"] },
    padrao(h, c) {
      const f = h.f / c.E, z = h.z / c.E;
      if (h.parte >= P.PERNA && h.parte < P.EXTRA) return z < 9.5 && Math.sin(z * 1.9) > 0.35 ? c.mats[IM.mancha] : null;
      if (h.parte === P.TRONCO && z > 11 && f < 8 && Math.sin(f * 1.15 + Math.sin(z * 0.55) * 1.1) > 0.5) return c.mats[IM.mancha];
      return null;
    },
  });
  // Cabra-montês: chifres longos em arco para trás, barbicha, cauda curta erguida, cascos.
  ANATOMIAS.cabra = {
    nome: "cabra", cel: [48, 48], esc: 0.98, largo: 1.34, escFrente: 1.0, bote: 3, recuo: 2, alt: 33, sombra: [30, 10], bocaAberta: 6, patada: false,
    cores: { pelo: "#b89c72", dorso: "#7a6044", ventre: "#eee3c8", perna: "#5e4a36", focinho: "#e6dcc4", juba: "#4a3a2a", chifre: "#6e5a44", ponta: "#3a2c20", olho: "#e8c050", nariz: "#2a1c18", casco: "#2e241e" },
    zVentre: 12.2, zDorso: 20.5,
    tronco: { comp: 12.5, zq: 17.6, zo: 17.2, anca: [4.3, 4.8], cintura: [4.3, 4.8], peito: [4.5, 5.4], recolhe: 0.3 },
    pescoco: { comp: 6, ang: 60, r0: 3.9, r1: 3.0, f: 0.8, z: 1.5 },
    cabeca: { r: 3.3, larg: 0.95, ang: -22, foc: { comp: 4.6, r0: 2.4, r1: 1.7, cai: 0.6 }, olho: { f: 0.3, z: 0.35, l: 0.8 }, narina: true },
    orelha: { tipo: "caida", alt: 3.2, base: 1.1, abre: 0.85, tras: 0.6, z: 0.3 },
    chifre: { pts: [[0.6, 1.3, 0], [-0.6, 1.7, 3.6], [-3.4, 2.1, 6.2], [-6.8, 2.5, 6.4], [-8.6, 2.7, 4.6]], raios: [1.25, 1.15, 1.0, 0.8, 0.5] },
    barbicha: { comp: 3.4, r: 1.0, mat: "juba" },
    perna: { r0: 1.9, r1: 1.0, pata: 1.25, casco: 1.9, afast: 3.0, passo: 4, ergue: 3, coxa: 1.6 },
    cauda: { pts: [[0, 0], [-1.6, 1.4], [-2.2, 3]], raios: [1.2, 1.1, 0.7], mats: ["dorso", "ponta"], baseZ: 0.7 },
  };
  // Ovelha (aliada): corpo de lã em tufos, cara e pernas castanhas, orelhas caídas.
  ANATOMIAS.ovelha = {
    nome: "ovelha", cel: [48, 48], esc: 0.96, bote: 2, recuo: 1, alt: 28, sombra: [30, 12], bocaAberta: 6, patada: false, pelagem: 0, tipoPelo: "pano",
    cores: { pelo: "#e9e2d0", ventre: "#d9d0ba", perna: "#5a4232", extra: "#6e5240", focinho: "#4e3a2c", ponta: "#e9e2d0", olho: "#1c1210", nariz: "#2a1c18", casco: "#2a201a" },
    zVentre: 9,
    tronco: { comp: 11, zq: 15, zo: 15, anca: [5.4, 5.6], cintura: [5.8, 5.9], peito: [5.4, 5.6] },
    la: { n: 54, r0: 2.2, r1: 1.5 },
    pescoco: { comp: 4.4, ang: 42, r0: 4.2, r1: 3.6, f: 1.5, z: 1 },
    cabeca: { r: 3.1, larg: 0.95, ang: -24, mat: "extra", foc: { comp: 4.2, r0: 2.4, r1: 1.8, cai: 0.5, de: 0 }, olho: { f: 0.3, z: 0.4, l: 0.8 }, narina: true, mand: { mat: "focinho" } },
    orelha: { tipo: "caida", alt: 3.4, base: 1.15, abre: 0.85, tras: 0.4, z: 0.25, mat: "extra" },
    perna: { r0: 1.7, r1: 1.05, pata: 1.3, casco: 1.8, afast: 3.4, passo: 3.4, ergue: 2.4, coxa: 1.3, matCoxa: "perna" },
    cauda: { pts: [[0, 0], [-1.6, -2.2], [-1.8, -4.6]], raios: [1.5, 1.5, 1.1], baseZ: 0.2 },
  };
  // Javali: dianteira maciça, cabeça comprida e baixa, focinho em disco, defesas, crista de cerdas.
  ANATOMIAS.javali = {
    nome: "javali", cel: [48, 48], esc: 1.0, bote: 4, recuo: 2, alt: 28, sombra: [34, 12], bocaAberta: 14, patada: false, pelagem: 0.16,
    cores: { pelo: "#5e4630", dorso: "#3a2a1e", ventre: "#6e5640", perna: "#33261c", focinho: "#8a6a58", juba: "#2a1e16", ponta: "#2a1e16", olho: "#d04a30", nariz: "#4a3028", casco: "#1e1612" },
    zVentre: 8.5, zDorso: 18,
    tronco: { comp: 13, zq: 13.4, zo: 14.6, anca: [4.9, 5.2], cintura: [5.3, 5.6], peito: [5.8, 6.8], arco: 0.8 },
    pescoco: { comp: 3.4, ang: 4, r0: 5.6, r1: 4.8, f: 1.5, z: 0 },
    cabeca: { r: 4.4, larg: 1.0, ang: -16, foc: { comp: 6.4, r0: 3.3, r1: 2.3, cai: 0.4, mat: "pelo" }, olho: { f: 0.35, z: 0.3, l: 0.78 }, narizGrande: true, mand: { mat: "pelo" } },
    orelha: { tipo: "pontuda", alt: 3.4, base: 1.7, abre: 0.72, fora: 0.8, dentro: "#7a5a50", vies: 0.15 },
    defesas: "#f6efdc",
    crista: { de: 0.25, ate: 1.2, alt: 1.6, larg: 0.9 },
    perna: { r0: 2.1, r1: 1.15, pata: 1.35, casco: 1.8, afast: 3.9, passo: 3.6, ergue: 2.4, coxa: 1.6 },
    cauda: { pts: [[0, 0], [-1.8, -1.5], [-2.4, -4.5]], raios: [0.9, 0.75, 0.7], tufo: 1.1, matTufo: "ponta", baseZ: 0.5 },
  };
  // Leão: juba escura que cobre pescoço e peito, focinho largo, cauda de borla.
  ANATOMIAS.leao = {
    nome: "leao", cel: [64, 64], esc: 1.13, bote: 4, alt: 35, sombra: [46, 16], garras: "#f6efdc",
    cores: { pelo: "#cf9a48", ventre: "#eed9a4", focinho: "#ecd6a0", juba: "#7a4618", extra: "#4a2a10", olho: "#f0b030", nariz: "#3a2018", ponta: "#55300f" },
    zVentre: 10.5,
    tronco: { comp: 15, zq: 16.2, zo: 17, anca: [4.6, 4.8], cintura: [4.0, 4.2], peito: [5.2, 6.0], recolhe: 0.8, peitoCai: 0.5 },
    pescoco: { comp: 5.2, ang: 34, r0: 5, r1: 4.4, f: 1, z: 1.2, mat: "juba" },
    cabeca: { r: 4.3, larg: 1.08, foc: { comp: 4.6, r0: 3.0, r1: 2.3, cai: 1.4, larg: 1.1 }, olho: { f: 0.62, z: 0.3, l: 0.6 }, olhoGrande: true, narizGrande: true, mand: { mat: "focinho" } },
    orelha: { tipo: "redonda", alt: 2.2, base: 1.5, esp: 0.9, abre: 0.78, z: 0.55, f: -0.1 },
    juba: { massas: [[0.1, 0.5, 6.2, 6.4, 7.6, "juba"], [0.75, 0.6, 5, 6.2, 6.8, "juba"], [-0.1, -4.5, 4.5, 5, 5, "extra"], [1.0, 2.2, 3.2, 4.6, 4.2, "juba"]] },
    perna: { r0: 2.7, r1: 1.5, pata: 1.9, afast: 3.9, passo: 4.4, ergue: 2.8, fD: -0.5, fT: -1 },
    cauda: { pts: [[0, 0], [-2.2, -3], [-3.4, -7.5], [-5, -10], [-7, -9.6]], raios: [1.3, 1.1, 0.95, 0.9, 0.9], tufo: 1.5, matTufo: "extra", estica: 2 },
    presas: {},
  };
  // Leopardo: esguio, pintas em roseta, cauda longa de ponta erguida.
  ANATOMIAS.leopardo = {
    nome: "leopardo", cel: [64, 64], esc: 1.1, largo: 1.28, bote: 4, alt: 34, sombra: [44, 14], garras: "#f6efdc", pelagem: 0.05,
    cores: { pelo: "#dfa94e", ventre: "#f5e6b8", focinho: "#f5e6b8", mancha: "#2e1e14", ponta: "#2e1e14", olho: "#a8d060", nariz: "#5a2c22" },
    zVentre: 10.2,
    tronco: { comp: 16.5, zq: 15.2, zo: 15.4, anca: [4.0, 4.3], cintura: [3.5, 3.7], peito: [4.4, 5.1], recolhe: 0.9, peitoCai: 0.5 },
    pescoco: { comp: 5, ang: 30, r0: 4.2, r1: 3.5, f: 0.8, z: 1.2 },
    cabeca: { r: 3.7, larg: 1.06, foc: { comp: 3.6, r0: 2.6, r1: 1.9, cai: 1.2, larg: 1.05 }, olho: { f: 0.62, z: 0.3, l: 0.6 }, narizGrande: false, mand: { mat: "focinho" } },
    orelha: { tipo: "redonda", alt: 2.0, base: 1.4, esp: 0.9, abre: 0.78, z: 0.55, f: -0.1, mat: "mancha" },
    perna: { r0: 2.3, r1: 1.3, pata: 1.7, afast: 3.5, passo: 4.6, ergue: 2.8, fD: -0.5, fT: -1 },
    cauda: { pts: [[0, 0], [-2.6, -2.6], [-5, -6], [-7.6, -7.4], [-10, -5.6], [-10.8, -2.6]], raios: [1.3, 1.15, 1.05, 1.0, 1.0, 0.95], mats: ["pelo", "pelo", "pelo", "pelo", "ponta"], estica: 0 },
    presas: {},
    padrao(h, c) {
      if (h.parte === P.MAND || (h.parte === P.CABECA && c.vista === 1)) return null; // de frente a cara fica limpa
      const E = c.E, f = h.f / E, z = h.z / E, l = Math.abs(h.l) / E;
      if (h.parte < P.PERNA && h.parte !== P.CAUDA && z < 9.6) return null;
      const u = f / 3.7, v = (z * 0.9 - l * 0.9 + 60) / 3.4;
      const iu = Math.floor(u), iv = Math.floor(v);
      const cu = iu + 0.5 + (hash2(iu, iv, 77) - 0.5) * 0.55, cv = iv + 0.5 + (hash2(iv, iu, 78) - 0.5) * 0.55;
      const d = Math.hypot((u - cu) * 3.7, (v - cv) * 3.4);
      return d < (h.parte === P.TRONCO ? 1.0 : 0.75) ? c.mats[IM.mancha] : null;
    },
  };
  // Urso-pardo sírio: maciço, pelagem clara e comprida, corcova nos ombros, patas largas de garras.
  ANATOMIAS.urso = {
    nome: "urso", cel: [64, 64], esc: 1.22, bote: 4, alt: 37, sombra: [46, 18], garras: "#efe6d0", pelagem: 0.16,
    cores: { pelo: "#8a623a", dorso: "#6a4828", ventre: "#74512e", perna: "#4e3420", focinho: "#c7a070", ponta: "#6a4828", olho: "#1c1210", nariz: "#1c1210" },
    zVentre: 7.5, zDorso: 19,
    tronco: { comp: 13, zq: 14.4, zo: 15.4, anca: [6.0, 6.2], cintura: [6.0, 6.2], peito: [6.2, 6.9], arco: 1.0 },
    pescoco: { comp: 4.6, ang: 14, r0: 5.8, r1: 5.0, f: 1.5, z: 0.5 },
    cabeca: { r: 4.7, larg: 1.08, ang: -8, foc: { comp: 4.6, r0: 2.8, r1: 2.0, cai: 0.9 }, olho: { f: 0.62, z: 0.28, l: 0.55 }, narizGrande: true, mand: { mat: "focinho" } },
    orelha: { tipo: "redonda", alt: 2.3, base: 1.6, esp: 1.0, abre: 0.8, z: 0.55, f: -0.15, mat: "dorso" },
    perna: { r0: 3.3, r1: 2.3, pata: 2.5, afast: 4.6, passo: 4, ergue: 2.6, coxa: 1.35, ombro: 1.2, jarreteF: 0.08 },
    cauda: { pts: [[0, 0], [-1.4, -0.6]], raios: [1.6, 1.2], baseZ: 0.2 },
    presas: {},
  };
  // Crocodilo-do-nilo.
  ANATOMIAS.crocodilo = {
    nome: "crocodilo", cel: [64, 64], esc: 0.88, bote: 4, recuo: 1, alt: 28, sombra: [52, 16], garras: "#e8e0c0", pelagem: 0.14, tipoPelo: "couro",
    cores: { pelo: "#5f7a3c", dorso: "#3d5428", ventre: "#d6cf96", perna: "#52702f", mancha: "#34491f", olho: "#f0c838", boca: "#a03a3a" },
    zVentre: 2.6,
    rasteiro: { z: 4.2, rz: 3.5, rl: 5.8, tras: 9, frente: 11, cauda: 25, balanco: 5, passo: 3, focinho: 12.5, bocaAberta: 46 },
  };

  // ---- montarias (para arte/montado.js): cores de MONTARIAS_ARTE, sem arreios (o montado desenha os seus)
  const MA = M.MONTARIAS_ARTE || {};
  const corM = (tipo, campo, i, padrao) => { const v = MA[tipo] && MA[tipo][campo]; return (Array.isArray(v) ? v[i] : v) || padrao; };
  const CAUDA_CRINA = { pts: [[0, 0], [-2.4, -2], [-3.8, -9], [-4.2, -18]], raios: [1.5, 2.2, 2.4, 1.3], mat: "juba", balanco: 1.6 };
  // Cavalo: castanho de crina escura. selaF/selaZ = onde assenta a sela (px, no porte 1).
  ANATOMIAS.cavalo = {
    nome: "cavalo", cel: [72, 80], esc: 1.1, bote: 2, recuo: 1, alt: 53, sombra: [52, 16], bocaAberta: 6, patada: false, pelagem: 0.05, escFrente: 1.06,
    cores: { pelo: corM("cavalo", "pelo", 1, "#9c5c30"), ventre: corM("cavalo", "ventre", 0, "#b87a46"), perna: misturar(corM("cavalo", "pelo", 1, "#9c5c30"), "#1c1210", 0.35), focinho: corM("cavalo", "focinho", 0, "#4e3020"), juba: corM("cavalo", "crina", 1, "#2a1a12"), casco: corM("cavalo", "casco", 0, "#2e2018"), olho: "#1c1210", nariz: "#1c1210" },
    zVentre: 21, selaF: -1, selaZ: 37,
    tronco: { comp: 21, zq: 30.6, zo: 30, anca: [6.4, 6.9], cintura: [6.3, 6.5], peito: [6.3, 7.3], recolhe: 0.4 },
    pescoco: { comp: 13, ang: 54, r0: 6.2, r1: 3.9, f: 2, z: 2 },
    cabeca: { r: 3.8, larg: 0.92, compr: 1.1, ang: -50, f: 0.5, z: 0.2, foc: { comp: 8.6, r0: 3.2, r1: 2.5, cai: 0, de: 0.55, larg: 0.9 }, olho: { f: 0.35, z: 0.25, l: 0.85 }, narina: true, mand: { mat: "pelo", comp: 0.8 } },
    orelha: { tipo: "pontuda", alt: 3.8, base: 1.3, abre: 0.6, fora: 0.6, tras: 0.2, deita: 1 },
    crina: { alt: 1.9, larg: 1.2, ate: 1 },
    perna: { r0: 2.9, r1: 1.5, pata: 1.85, casco: 2.6, afast: 4.6, passo: 6, ergue: 4.5, coxa: 1.8, ombro: 1.5, desloc: 1.6 },
    cauda: CAUDA_CRINA,
  };
  // Jumento: cinzento de focinho e ventre claros, orelhas compridas, cruz escura no lombo, cauda de tufo.
  ANATOMIAS.jumento = deriva(ANATOMIAS.cavalo, {
    nome: "jumento", esc: 1.0, alt: 44, sombra: [44, 14],
    cores: { pelo: corM("jumento", "pelo", 1, "#8c8274"), ventre: corM("jumento", "ventre", 0, "#ddd6c6"), perna: misturar(corM("jumento", "pelo", 1, "#8c8274"), "#1c1210", 0.2), focinho: corM("jumento", "focinho", 0, "#e6dfd0"), juba: corM("jumento", "crina", 1, "#3e3830"), mancha: corM("jumento", "pelo", 3, "#463e36"), casco: corM("jumento", "casco", 0, "#2a2420"), olho: "#1c1210", nariz: "#3a302c" },
    zVentre: 18.5, selaF: -1, selaZ: 31.5,
    tronco: { comp: 18, zq: 25.6, zo: 25, anca: [6.0, 6.4], cintura: [6.2, 6.4], peito: [6.0, 6.8] },
    pescoco: { comp: 9.5, ang: 44, r0: 5.6, r1: 4.0 },
    cabeca: { r: 4.1, ang: -42, foc: { comp: 8, r0: 3.4, r1: 2.8, de: 0.4 }, mand: { mat: "focinho" } },
    orelha: { alt: 8, base: 1.5, ponta: 0.7, abre: 0.62, fora: 1.4, tras: 1.2 },
    crina: { alt: 1.4, larg: 1.0, ate: 0.9 },
    perna: { r0: 2.6, r1: 1.4, pata: 1.7, casco: 2.3, afast: 4.3, passo: 5, ergue: 3.6 },
    cauda: { pts: [[0, 0], [-1.8, -4], [-2.4, -10]], raios: [1.2, 0.95, 0.9], tufo: 1.7, matTufo: "juba", balanco: 1.6 },
    padrao(h, c) {
      const E = c.E;
      if (h.parte !== P.TRONCO) return null;
      if (h.nz > 0.6 && Math.abs(h.l) < 1.0 * E && h.f < c.mf + 2 * E) return c.mats[IM.mancha];
      if (Math.abs(h.f - (c.mf - 1.5 * E)) < 0.9 * E && h.z > 26 * E) return c.mats[IM.mancha];
      return null;
    },
  });
  // Camelo de uma corcova: pernas compridas, pescoço em S, pés largos.
  ANATOMIAS.camelo = {
    nome: "camelo", cel: [72, 80], esc: 1.0, bote: 2, recuo: 1, alt: 51, sombra: [50, 16], bocaAberta: 6, patada: false, pelagem: 0.06, escFrente: 1.06,
    cores: { pelo: corM("camelo", "pelo", 1, "#c8a066"), ventre: corM("camelo", "ventre", 0, "#ecd8ae"), perna: corM("camelo", "pelo", 1, "#c8a066"), dorso: corM("camelo", "pelo", 2, "#9c7646"), focinho: corM("camelo", "focinho", 0, "#b08a58"), juba: corM("camelo", "crina", 1, "#8a6a3e"), pata: corM("camelo", "casco", 0, "#7a5a3a"), extra2: corM("camelo", "casco", 0, "#7a5a3a"), ponta: corM("camelo", "crina", 2, "#6a4e2c"), olho: "#1c1210", nariz: "#4a3424" },
    zVentre: 27, selaF: -1.5, selaZ: 47.5,
    tronco: { comp: 19, zq: 33.4, zo: 33, anca: [5.8, 6.2], cintura: [6.2, 6.6], peito: [5.8, 6.6], recolhe: 0.8, corcova: [-1.5, 41, 7.5, 5.2, 6.4] },
    pescoco: { comp: 17, ang: 56, r0: 4.8, r1: 3.0, f: 2.5, z: -1, pts: [[0, 0, 5], [0.22, -3.6, 4.2], [0.6, -2.6, 3.5], [1, 0, 3.0]] },
    cabeca: { r: 3.4, larg: 0.95, compr: 1.1, ang: -18, foc: { comp: 6.6, r0: 2.9, r1: 2.4, cai: 0.4, de: 0.35 }, olho: { f: 0.35, z: 0.3, l: 0.8 }, narina: true, mand: { mat: "focinho" } },
    orelha: { tipo: "redonda", alt: 1.6, base: 1.0, esp: 0.8, abre: 0.8, z: 0.6, f: -0.5 },
    perna: { r0: 2.6, r1: 1.45, pata: 2.3, afast: 4.2, passo: 6, ergue: 4.5, coxa: 1.6, ombro: 1.4, desloc: 1.6 },
    cauda: { pts: [[0, 0], [-1.6, -4], [-2, -9]], raios: [1.2, 0.95, 0.85], tufo: 1.4, matTufo: "ponta", balanco: 1.4 },
  };

  // -------------------------------------------------------------------
  // Registro
  // -------------------------------------------------------------------
  function defDe(A, contorno, porte = 1, tinta = null) {
    const par = (v) => Math.ceil(v / 2);
    return {
      w: par(A.cel[0] * porte), h: par(A.cel[1] * porte), direcoes: 3, quadrosPorVista: 8, ciclo: [2, 3, 4, 5], quadroAcao: [6, 7], contorno, acabamento: false,
      sombra: { w: Math.round((A.sombra[0] * porte) / 2) * 2, h: Math.round((A.sombra[1] * porte) / 2) * 2 },
      alturaCabeca: Math.round(A.alt * porte),
      desenhar(g, quadro) { desenharAnimal(g, Math.floor(quadro / 8), quadro % 8, A, { porte, tinta }); },
    };
  }
  function bicho(chave, nome, contorno) {
    const A = ANATOMIAS[nome];
    const def = defDe(A, contorno);
    // raro nomeado: o mesmo esqueleto redesenhado no porte pedido, com a pelagem tingida
    def.variante = (porte, tinta) => defDe(A, contorno, porte || 1, tinta);
    registrar(chave, def);
  }
  bicho("al_cao", "cao", "amigo");
  bicho("al_ovelha", "ovelha", "amigo");
  bicho("in_lobo", "lobo", "hostil");
  bicho("in_chacal", "chacal", "hostil");
  bicho("in_hiena", "hiena", "hostil");
  bicho("in_cabra", "cabra", "hostil");
  bicho("in_javali", "javali", "hostil");
  bicho("in_leao", "leao", "hostil");
  bicho("in_urso", "urso", "hostil");
  bicho("in_leopardo", "leopardo", "hostil");
  bicho("in_crocodilo", "crocodilo", "hostil");
  // prévias das anatomias de montaria (só folha de contato; o montado de verdade é de arte/montado.js)
  bicho("pv_animal_jumento", "jumento", "amigo");
  bicho("pv_animal_cavalo", "cavalo", "amigo");
  bicho("pv_animal_camelo", "camelo", "amigo");

  // -------------------------------------------------------------------
  // Para arte/montado.js
  //   Arte.motor.animal(g, vista, quadro, anatomia, opcoes) -> { ox, oy, corpoY, sela, cabeca, tela, escala }
  //     vista: 0 | 1 | 2 ou "lado" | "frente" | "costas"; quadro: 0..7 dentro da vista;
  //     anatomia: nome em Arte.motor.ANATOMIAS ("jumento", "cavalo", "camelo", "lobo"...) ou o objeto;
  //     opcoes: { porte, tinta, dx, dy (desloca a origem automática), ox, oy (origem na mão: px do ponto
  //       do chão sob o meio do tronco), parte: "fundo" | "frente" (pinta só o que fica atrás/à frente
  //       do plano da sela, para encaixar o cavaleiro entre as duas passadas), corte, pose }.
  //     devolve: sela [X, Y] (px onde assenta a sela, já com o balanço do passo), cabeca [X, Y] (topo
  //       da cabeça), corpoY (quanto o tronco desceu neste quadro), tela(f, l, z) -> [X, Y, prof].
  //   Sem origem na mão, o bicho é centrado na largura da grade e os pés ficam a 3 px do fim dela.
  // -------------------------------------------------------------------
  M.animal = (g, vista, quadro, anatomia, opcoes) => desenharAnimal(g, vista, quadro, typeof anatomia === "string" ? ANATOMIAS[anatomia] : anatomia, opcoes || {});
  M.ANATOMIAS = ANATOMIAS;
})(typeof window !== "undefined" ? window : globalThis);
