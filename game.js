// =====================================================================
// game.js — MUNDO: cena Phaser (mapa, entidades, efeitos), entrada de
// teclado do mundo, fachada window.Jogo e boot.
//
// A arte vem de sprites.js (window.Arte). Toda a UI DOM (painéis,
// modais, atalhos, toque) fica em interface.js (window.UI).
// =====================================================================
const MEU_ID = "jogador1";

// ---------------------------------------------------------------------
// Constantes visuais
// ---------------------------------------------------------------------
const TAM = 32; // tile em px de mundo
const MOLDURA = 4; // tiles de cenário fora do mapa
// Visão: a câmera mostra cerca de VISAO casas (como num MMORPG 2D clássico, 15 × 11 na tela deitada) e cada pixel
// da arte (32 px por casa, 1 px de arte por px de mundo) ocupa um número inteiro de pixels da tela. O canvas desenha na
// resolução real da tela (devicePixelRatio, até DPR_MAXIMO), sem o navegador esticar a imagem.
const VISAO = { deitada: [15, 11], empe: [9, 13] };
const PIXELS_ARTE_POR_CASA = 32;
const DPR_MAXIMO = 3;
const CHAVE_ZOOM = "jornada_zoom";
// Cor da vida, como num MMORPG 2D clássico: verde cheia, amarela pela metade, vermelha no fim (fração mínima → cor).
const CORES_VIDA = [[0.92, 0x00c000, "#3fd23f"], [0.6, 0x60c060, "#8ad88a"], [0.3, 0xc0c000, "#e0d040"], [0.08, 0xc03030, "#e06050"], [0, 0xc00000, "#e03030"]];
function corDaVida(frac) {
  return CORES_VIDA.find(([min]) => frac >= min) || CORES_VIDA[CORES_VIDA.length - 1];
} // ajuste do jogador (roda do mouse ou + e −), salvo neste navegador
function dprAtual() {
  return Math.max(1, Math.min(DPR_MAXIMO, window.devicePixelRatio || 1));
}
function ajusteZoomSalvo() {
  try { const v = Number(localStorage.getItem(CHAVE_ZOOM)); return Number.isInteger(v) && Math.abs(v) <= 6 ? v : 0; } catch (e) { return 0; }
}
// Dia e noite: um dia inteiro dura CICLO_DIA.minutos de relógio (o mesmo para todos, pela hora real).
// Fases (fração do dia): manhã e tarde claras, entardecer, noite e amanhecer. escuroMax: quanto a noite
// escurece (sem esconder o que importa: nomes, barras e números ficam por cima). Só aparência.
const CICLO_DIA = { minutos: 40, entardecer: [0.5, 0.58], amanhecer: [0.92, 1.0], escuroMax: 0.7, cor: 0x080c26 };
function escuridaoDoDia(agora = Date.now()) {
  const f = ((agora / 60000) % CICLO_DIA.minutos) / CICLO_DIA.minutos;
  const [e0, e1] = CICLO_DIA.entardecer, [a0, a1] = CICLO_DIA.amanhecer;
  const k = f < e0 ? 0 : f < e1 ? (f - e0) / (e1 - e0) : f < a0 ? 1 : f < a1 ? 1 - (f - a0) / (a1 - a0) : 0;
  return { fracao: f, escuro: CICLO_DIA.escuroMax * (k * k * (3 - 2 * k)) };
}
const BLOCO = 16; // lado (em casas) dos blocos de cenário ligados e desligados conforme a câmera
const ORCAMENTO_CHAO_MS = 4; // tempo por quadro para pintar o chão contínuo em fatias (cenario.js)
// Minimapa: casas mostradas em volta do jogador, em 3 níveis (0 = mais perto). A escolha fica neste navegador.
const MINIMAPA_NIVEIS = [{ colunas: 40, linhas: 30 }, { colunas: 80, linhas: 60 }, { colunas: 160, linhas: 120 }];
const CHAVE_MINIMAPA = "jornada_minimapa";
const estadoMinimapa = {
  nivel: (() => { try { const v = localStorage.getItem(CHAVE_MINIMAPA); const n = v === null ? 1 : Number(v); return Number.isInteger(n) && MINIMAPA_NIVEIS[n] ? n : 1; } catch (e) { return 1; } })(),
  dx: 0, dy: 0, // deslocamento da janela em casas (arrastar o mapa); centralizar() zera
};
// Texto do mundo (nomes, rótulos, números): condensada em negrito com contorno escuro, legível sobre qualquer chão.
const FONTE_PIXEL = '"Barlow Semi Condensed", "Arial Narrow", "Alegreya Sans", sans-serif';
const FONTE_TITULO = '"Cinzel", Georgia, serif';
const FONTE_TEXTO = '"Alegreya Sans", system-ui, sans-serif';

const PROF = {
  moldura: -10, chao: 0, deco: 1, sombraContato: 2, marcadorChao: 3, sombra: 5,
  entidade: 10000, barra: 19000, rotulo: 20000, numero: 21000, luz: 29000, cartao: 30000,
};

// Números flutuantes: cor por tipo e tamanho em px de TELA (CSS), como todo texto do mundo em FONTE_PIXEL.
const ESTILO_NUM = {
  dano: ["#fff1cf", 15], critico: ["#ffc93a", 19], recebido: ["#ff5f4a", 15], cura: ["#7fe06a", 15],
  fe: ["#8fb8ff", 14], xp: ["#f2cf6a", 13], moeda: ["#e8b94a", 14], veneno: ["#b4e04a", 14],
  bloqueio: ["#c3d0e0", 12], errou: ["#c9bfa6", 12], tarefa: ["#e6cf9c", 13], bestiario: ["#c9e0a0", 13],
};
// Subida do número: meia casa, em arco (desvia para o lado enquanto desacelera) e some no fim. Como ele já
// nasce sobre a cabeça, subir mais que isso o solta de quem levou o golpe (ia parar a 45 px da cabeça).
const NUM_VOO = { sobe: 13, lado: 8, ms: 820, some: 0.6 };
// Os números nascem logo acima do nome (barra de 4 px a 3 px da cabeça, 2 px de vão e o nome de ~7 px de
// mundo) e sobem dali: ficam colados em quem levou o golpe sem tapar nem a barra nem o nome.
const NUM_ACIMA = 17;
// Nome e barra de vida sobre cada personagem: barra de 26 × 4 px de mundo com borda de 1 px (chefes 34 × 5),
// a 3 px da cabeça; o nome fica logo acima dela, em NOME_PX px de tela.
const BARRA = { w: 26, h: 4, wChefe: 34, hChefe: 5, folga: 3 };
const NOME_PX = 13;
// Golpe em 2 tempos: antecipação (quadroAcao[0]) e golpe (quadroAcao[1]), com uma investida curta de
// `avanco` px na direção do alvo e volta. Os efeitos do acerto saem no tempo do golpe.
const GOLPE = { total: 210, antecipa: 120, avanco: 4 };

// Nome do campeão e aura dele.
const COR_CAMPEAO = "#f2c94c";

// Sprites com 3 vistas (def.direcoes): lado (espelhado para a esquerda), frente e costas, cada uma com
// def.quadrosPorVista quadros (8 no contrato novo de arte/*.js; 5 no legado: 0–4, 5–9, 10–14).
// A vista sai do último passo ou do alvo: lado se o passo for mais horizontal.
const DESLOC_VISTA = { lado: 0, frente: 5, costas: 10 }; // legado (5 quadros por vista)
const ORDEM_VISTA = { lado: 0, frente: 1, costas: 2 };
function virar(sprite, dx, dy) {
  if (!sprite || (!dx && !dy)) return;
  const def = PIXEL_PATTERNS[sprite.texture?.key];
  if (!def?.direcoes) { if (dx) sprite.setFlipX(dx < 0); return; }
  const vista = Math.abs(dx) >= Math.abs(dy) ? "lado" : dy > 0 ? "frente" : "costas";
  sprite.setData("vista", vista);
  sprite.setFlipX(vista === "lado" && dx < 0);
}
function quadroComVista(sprite, q) {
  const def = PIXEL_PATTERNS[sprite.texture?.key];
  return def?.direcoes ? q + ORDEM_VISTA[sprite.getData("vista") || "frente"] * (def.quadrosPorVista || 5) : q;
}
// Andando: humanos (3 vistas) tocam contato A, passagem (quadro 0), contato B, passagem — no contato o
// tronco desce 1 px (sprites.js); as criaturas alternam os 2 passos. No contrato novo a def traz o
// ciclo (def.ciclo, ex.: [2, 3, 4, 5]): a fase vem da fração do passo (dado "fasePasso", de 0 a 1,
// quando o movimento a define) ou do relógio.
const CICLO_PASSO = [2, 0, 3, 0];
function quadroAndando(sprite, time) {
  const def = PIXEL_PATTERNS[sprite.texture?.key];
  if (def?.ciclo) {
    const n = def.ciclo.length, fase = sprite.getData("fasePasso");
    return def.ciclo[typeof fase === "number" ? Math.max(0, Math.min(n - 1, Math.floor(fase * n))) : Math.floor(time / 110) % n];
  }
  // legado: a mesma fração do passo quando o deslize a informa (pés em fase com o deslocamento)
  const fase = sprite.getData("fasePasso"), comFase = typeof fase === "number";
  if (def?.direcoes) return CICLO_PASSO[comFase ? Math.max(0, Math.min(3, Math.floor(fase * 4))) : Math.floor(time / 110) % 4];
  return 2 + (comFase ? Math.max(0, Math.min(1, Math.floor(fase * 2))) : Math.floor(time / 125) % 2);
}
// Barco: com vistas (def.direcoes), o balanço da vista atual (def.ciclo, mais vivo navegando); o legado tem
// 2 quadros de balanço e só espelha.
function quadroDoBarco(sprite, time, navegando) {
  const def = PIXEL_PATTERNS[sprite.texture?.key];
  if (!def?.direcoes) return Math.floor(time / 600) % 2;
  const ciclo = def.ciclo || [0, 1];
  return quadroComVista(sprite, ciclo[Math.floor(time / (navegando ? 190 : 360)) % ciclo.length]);
}
// Quadro do golpe (dentro da vista): no contrato novo, antecipação e depois o golpe no fim
// (def.quadroAcao = [antecipação, golpe]; o golpe dura GOLPE.total − GOLPE.antecipa ms); no legado, o quadro 4.
function quadroDeAcao(sprite, restanteMs) {
  const qa = PIXEL_PATTERNS[sprite.texture?.key]?.quadroAcao;
  return qa ? (restanteMs > GOLPE.total - GOLPE.antecipa ? qa[0] : qa[1]) : 4;
}
// Fala (NPC respondendo): no contrato novo alterna parado e respirar, sem erguer a arma; no legado, o quadro 4.
function quadroDeFala(sprite, time) {
  return PIXEL_PATTERNS[sprite.texture?.key]?.quadroAcao ? Math.floor(time / 150) % 2 : 4;
}

// ---------------------------------------------------------------------
// Deslize: jogador, criaturas e aliados andam de casa em casa por interpolação linear no tempo (sem
// tweens). O estado guarda a posição-base (sem o recuo de golpe) e o passo em curso; animar() chama
// avancarDeslize a cada quadro. Um passo novo parte de onde o sprite está: se o anterior não acabou,
// o movimento emenda sem parada nem salto.
// ---------------------------------------------------------------------
// O intervalo real entre dois passos do jogador sai do nível (velocidadeDoJogador, logica.js): cena.passoReto()
// e cena.passoDiagonal().
const PASSO_CRIATURA_MS = { minimo: 250, maximo: 700, padrao: 600 };
function novoDeslize(x, y) {
  return { x, y, passo: null, n: 0, ultimoInicio: -1e9, durMedida: 0, durTeto: 0, casaX: null, casaY: null, recuoX: 0, recuoY: 0, recuoAte: 0, tremorAte: 0, golpe: null, yProf: null };
}
// Leva a posição-base até o instante `time`. Devolve a fração do passo (0 a 1) ou -1 se está parado.
function avancarDeslize(st, time) {
  const p = st.passo;
  if (!p) return -1;
  let k = Math.max(0, Math.min(1, (time - p.t0) / p.dur));
  const kk = p.suave ? 1 - Math.pow(1 - k, 3) : k;
  st.x = p.x0 + (p.x1 - p.x0) * kk;
  st.y = p.y0 + (p.y1 - p.y0) * kk;
  if (k >= 1) { st.passo = null; k = -1; }
  return k;
}
function iniciarDeslize(st, x1, y1, t0, dur, suave = false) {
  avancarDeslize(st, t0);
  st.passo = { x0: st.x, y0: st.y, x1, y1, t0, dur: Math.max(1, dur), suave };
  st.ultimoInicio = t0;
  st.n++;
}
// Posiciona o sprite (base + recuo de golpe + tremor) e grava a fase do ciclo de andar. Passo do jogador
// (st.meioCiclo; 133 a 325 ms por casa, pelo nível) ou outro passo curto: uma passada por casa, meio ciclo —
// o pé de apoio troca a cada casa; passo longo (criaturas): um ciclo inteiro por casa.
function aplicarDeslize(st, sprite, time) {
  const k = avancarDeslize(st, time);
  if (k >= 0) {
    const meio = st.meioCiclo || st.passo.dur < 300;
    sprite.setData("fasePasso", meio ? ((st.n & 1) + k) / 2 : k);
  } else if (sprite.getData("fasePasso") != null) sprite.setData("fasePasso", null);
  let x = st.x, y = st.y;
  if (st.recuoAte > time) { x += st.recuoX; y += st.recuoY; }
  // investida do golpe: 1 px para trás na antecipação, `avanco` px à frente no golpe e volta (só visual)
  const g = st.golpe;
  if (g) {
    const t = time - g.t0;
    if (t >= g.total) st.golpe = null;
    else if (t >= 0) {
      const volta = g.total - g.antecipa - 40;
      const a = t < g.antecipa ? (t > 40 ? -1 : 0) : g.avanco * (1 - Math.max(0, (t - g.antecipa - 40) / volta));
      x += Math.round(g.dx * a); y += Math.round(g.dy * a);
    }
  }
  if (st.tremorAte > time && Math.floor((st.tremorAte - time) / 60) % 2) x += 2;
  if (sprite.x !== x || sprite.y !== y) sprite.setPosition(x, y);
  return k >= 0;
}
// Folga somada à duração do passo: o passo seguinte só sai no primeiro quadro depois do intervalo, e sem
// ela o sprite pararia um quadro em cada casa. Com ela o passo novo emenda no anterior ainda em curso.
function folgaDeQuadro(cena) {
  return Math.max(20, Math.min(40, (cena.game?.loop?.delta || 17) * 1.5));
}

// Vizinhos da grade em ordem de ângulo (0°, 45°… com y para baixo), para o joystick analógico.
const DIRECOES_8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

// Rótulo que sobe quando cai um saque raro ou melhor ("ÉPICO!").
const ESTILO_RARIDADE = { incomum: 14, raro: 16, epico: 19, reliquia: 22 }; // px de tela

// ---------------------------------------------------------------------
// Sons do saque (Web Audio, sintetizados: sem arquivos). Cada raridade tem o seu arpejo; desligáveis
// na ajuda (a escolha fica neste navegador).
// ---------------------------------------------------------------------
const Som = {
  ctx: null,
  ligado: (() => { try { return localStorage.getItem("jornada_som") !== "0"; } catch (e) { return true; } })(),
  definir(ligado) {
    this.ligado = !!ligado;
    try { localStorage.setItem("jornada_som", ligado ? "1" : "0"); } catch (e) { /* armazenamento bloqueado */ }
  },
  contexto() {
    if (!this.ligado) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) { try { this.ctx = new AC(); } catch (e) { return null; } }
    if (this.ctx.state === "suspended") this.ctx.resume?.().catch?.(() => {});
    return this.ctx;
  },
  nota(ctx, freq, inicio, dur, tipo, volume) {
    const osc = ctx.createOscillator(), ganho = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, inicio);
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(volume, inicio + 0.012);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + dur + 0.02);
  },
  // Arpejos por raridade (Hz): quanto mais rara, mais notas, mais aguda e mais longa.
  ARPEJOS: {
    incomum: [[784, 0.18]],
    raro: [[659, 0.16], [988, 0.3]],
    epico: [[523, 0.14], [659, 0.14], [784, 0.14], [1047, 0.45]],
    reliquia: [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.12], [1319, 0.7]],
  },
  saque(raridade) {
    const notas = this.ARPEJOS[raridade];
    const ctx = notas && this.contexto();
    if (!ctx) return;
    let t = ctx.currentTime + 0.02;
    for (const [freq, dur] of notas) {
      this.nota(ctx, freq, t, dur + 0.15, "triangle", 0.07);
      if (raridade === "epico" || raridade === "reliquia") this.nota(ctx, freq * 2, t, dur, "sine", 0.025);
      t += Math.min(dur, 0.12);
    }
  },
};
window.Som = Som;

// Números que levam um glifo à esquerda: moedas e a contagem das caçadas ("27/40").
const ICONE_NUM = { moeda: "ui_moeda", tarefa: "ui_cacada", bestiario: "ui_bestiario" };

const COR = {
  amigo: "#f3e4c0", hostil: "#ef6a5e", saida: "#b98ad0", agua: "#6fd0d0", tinta: "#1c1210",
  fechada: "#b9a27a", // portal de capítulo ainda não liberado
};

// Medidas tiradas do próprio desenho (uma vez por chave): a altura do corpo acima dos pés, para pôr nome
// e barra rente à cabeça quando a def não traz alturaCabeca, e a máscara opaca dos objetos altos, para saber
// se a copa ou o telhado cobre de fato um personagem (a sombra projetada, semitransparente, não conta).
const cacheAltura = new Map(), cacheMascara = new Map();
const pxOpaco = (c) => !!c && (c.length < 9 || parseInt(c.slice(7, 9), 16) > 150);
function alturaDoDesenho(chave) {
  if (cacheAltura.has(chave)) return cacheAltura.get(chave);
  const def = PIXEL_PATTERNS[chave];
  let alt = def ? def.h * Arte.PX - 8 : 32;
  try {
    let melhor = 0;
    for (const quadro of def.direcoes ? [0, def.quadrosPorVista || 5] : [0]) {
      const px = Arte.pixels(chave, { quadro }), i = px.data.findIndex(pxOpaco);
      if (i >= 0) melhor = Math.max(melhor, px.h - Math.floor(i / px.w));
    }
    if (melhor) alt = Math.round(melhor * ((def.h * Arte.PX) / Arte.pixels(chave, { quadro: 0 }).h));
  } catch (e) { /* fica a estimativa pela célula */ }
  cacheAltura.set(chave, alt);
  return alt;
}
// Altura do desenho numa vista só (quadro parado dela). O montado não declara alturaCabeca e a vista de
// frente é bem mais alta que a de lado: com a medida única, nome e barra flutuavam longe da cabeça de lado.
function alturaDaVista(chave, vista) {
  const def = PIXEL_PATTERNS[chave];
  if (!def?.direcoes) return alturaDoDesenho(chave);
  const k = chave + "|v" + vista;
  if (cacheAltura.has(k)) return cacheAltura.get(k);
  let alt = alturaDoDesenho(chave);
  try {
    const px = Arte.pixels(chave, { quadro: (ORDEM_VISTA[vista] || 0) * (def.quadrosPorVista || 5) }), i = px.data.findIndex(pxOpaco);
    if (i >= 0) alt = Math.round((px.h - Math.floor(i / px.w)) * ((def.h * Arte.PX) / px.h));
  } catch (e) { /* fica a medida geral */ }
  cacheAltura.set(k, alt);
  return alt;
}
function mascaraDoDesenho(chave, quadro) {
  const k = chave + "|" + quadro;
  if (cacheMascara.has(k)) return cacheMascara.get(k);
  let m = null;
  try {
    const px = Arte.pixels(chave, { quadro });
    const op = new Uint8Array(px.w * px.h);
    let y0 = px.h, y1 = -1, x0 = px.w, x1 = -1;
    for (let i = 0; i < op.length; i++) if (pxOpaco(px.data[i])) {
      op[i] = 1;
      const x = i % px.w, y = (i / px.w) | 0;
      if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x;
    }
    if (y1 >= 0) m = { w: px.w, h: px.h, op, x0, x1, y0, y1 };
  } catch (e) { /* sem máscara: o objeto não entra no índice */ }
  cacheMascara.set(k, m);
  return m;
}

const reduzMovimento = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
// Uma mão para a arma: dá para atirar agora (arco com flechas, ou a funda, na mão)? Pergunta à lógica.
const atiraDaqui = (p) => typeof podeAtirar === "function" && podeAtirar(p);
const centroX = (x) => x * TAM + TAM / 2;
const baseY = (y) => y * TAM + TAM - 1;
const hexNum = (h) => parseInt(h.replace("#", "").slice(0, 6), 16);

// ---------------------------------------------------------------------
// Cena
// ---------------------------------------------------------------------
class Cena extends Phaser.Scene {
  constructor() {
    super("mundo");
  }

  // ===== criação ======================================================
  create() {
    const tCriar = performance.now();
    const t0Criacao = performance.now();
    this.p = Mundo.entrar(MEU_ID);
    this.areaAtual = this.p.area;
    // o bioma que a área pinta: o próprio ou, nas masmorras (areas[x].arte), o da arte com o clima trocado
    this.bio = Arte.bioDaArea?.(this.areaAtual) || Arte.BIOMAS[this.areaAtual] || Arte.BIOMAS.canaan;
    this.liberarTexturasDeOutraArea();
    this.trocando = false;
    this.proximoPasso = 0;
    this.proximoAutoAtaque = 0;
    this.ultimoAutoAtaque = 0;
    this.alvoId = null;
    this.hoverId = null;
    // Andar por toque/clique: rota em andamento (casas a percorrer) e perseguição do alvo escolhido.
    this.rota = null;
    this.perseguir = false;
    this.respawns = new Set();
    this.entidades = {}; // id → {tipo, dados, sprite, sombra, rotulo, balao, ...}
    this.spritesItens = {};
    this.spritesAliados = {}; // cão e ovelhas do Pastor (JGB-20), sincronizados com Mundo.aliados
    this.copas = new Map(); // casa (x + y × 4096) → objetos altos (copa, coluna, estrutura) cuja máscara passa por ela
    this.translucidos = new Map(); // imagem → alfa atual, enquanto cobre alguém ou volta ao normal
    this.proximos = []; // entidades a até 4 casas do jogador (translucidez)
    this.fxAtivos = []; // tiras de efeito em curso (fx())
    this.numeros = []; // números flutuantes em curso (numero())
    this.textosTela = new Set(); // textos em px de tela (nomes, números): reescalados quando o zoom muda
    this.blocos = new Map(); // "bx,by" → imagens do cenário daquele bloco (culling)
    this.pedacosChao = new Map(); // "bx,by" → pedaço do chão contínuo (cenario.js)
    this.luzes = []; // fontes de luz da noite: { x, y, r, quente, tremula, predio }
    this.predios = [];
    this.blocosVisiveis = "";
    this.animados = [];
    this.marcadores = [];
    this.proximaAtualizacaoPesca = 0;
    this.proximoMinimapa = 0;
    this.proximoDesenhoMinimapa = 0;
    this.proximosRotulos = 0;
    this.proximoBalao = 0;
    this.nivelAnterior = this.p.nivel;
    this.vidaBaixa = false;

    // Textos do mundo (nomes, dano, avisos) na resolução do zoom: nítidos de perto.
    // A cena reinicia a cada troca de região e `this.add` é o mesmo objeto: guarda a fábrica original uma vez só,
    // senão o ajuste abaixo se empilha e os nomes crescem 2 px a cada região visitada.
    const fabrica = this.add;
    if (!fabrica._textoOriginal) fabrica._textoOriginal = fabrica.text.bind(fabrica);
    const textoOriginal = fabrica._textoOriginal;
    // A fonte do mundo (FONTE_PIXEL: nomes, rótulos, números) é medida em px de TELA: sempre em negrito, com
    // contorno escuro fino, do mesmo tamanho em qualquer zoom (o texto é desenhado na resolução da tela e
    // escalado por 1 / zoom). Os títulos (FONTE_TITULO) seguem em px de mundo.
    fabrica.text = (x, y, texto, estilo = {}) => {
      if (estilo.fontFamily !== FONTE_PIXEL) return textoOriginal(x, y, texto, { ...estilo, resolution: Math.max(estilo.resolution || 1, this.resolucaoTexto()) });
      const css = Math.max(11, parseInt(estilo.fontSize, 10) || 13), k = this.escalaUI();
      const e = { ...estilo, fontStyle: "700", fontSize: Math.round(css * k) + "px", resolution: 1 };
      if (e.stroke) e.strokeThickness = Math.max(2, Math.round((e.strokeThickness || 3) * k));
      if (e.padding) e.padding = { x: Math.round((e.padding.x || 0) * k), y: Math.round((e.padding.y || 0) * k) };
      const t = textoOriginal(x, y, texto, e);
      t._css = css; t._k = k; t._traco = e.stroke ? estilo.strokeThickness || 3 : 0; t._pop = 1;
      t.setScale(1 / (this.cameras.main.zoom || 1));
      this.textosTela.add(t);
      t.once("destroy", () => this.textosTela.delete(t));
      return t;
    };

    Arte.registrarTexturas(this);
    this.criarTecladoEPonteiro();
    this.criarChao();
    this.criarObstaculos();
    this.criarOrla();
    this.criarEstruturas();
    this.criarDecoracao();
    this.criarMarcadores();
    if (this.areaAtual === "mar") this.desenharPontosPesca();
    this.criarSaques();
    this.criarNpcs();
    for (const e of Object.values(inimigos).filter((e) => e.area === this.areaAtual)) {
      if (Mundo.obterVidaInimigo(MEU_ID, e.id) > 0) this.criarInimigo(e);
      // o raro nomeado volta pela janela (eventoNomeado); as vagas de masmorra, pela onda (masmorraSurgiu)
      else if (!e.nomeado && !e.masmorra) this.agendarRespawn(e.id);
    }
    this.criarJogador();
    this.criarEfeitosDeMundo();
    this.criarCamera();
    // chão que a câmera vê: pintado já, atrás do escurecimento e do cartão de transição
    const tChao = performance.now();
    this.atualizarChaoContinuo(true);
    const chaoInicialMs = performance.now() - tChao;
    this.criarAtmosfera();
    this.criarAmbiente();
    this.msCriacao = performance.now() - t0Criacao; // tempo de montar a cena (medido nas capturas de arte)

    window.gameScene = this;
    if (window.Jogo) {
      window.Jogo.pronto = true;
      // medidas da troca de área (ferramentas): tempo de montar a cena, de pintar o chão visível e o total
      // desde o pedido de troca (inclui o escurecimento de saída)
      const t = performance.now(), pedido = this.registry.get("trocaPedidaEm");
      window.Jogo.medidas = { area: this.areaAtual, criarCenaMs: Math.round(t - tCriar), chaoInicialMs: Math.round(chaoInicialMs), trocaDeAreaMs: pedido ? Math.round(t - pedido) : null };
      this.registry.set("trocaPedidaEm", null);
    }
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.aoRedimensionar, this);
      if (window.gameScene === this) window.gameScene = null;
    });

    // Fade de entrada e cartão de título quando a área muda.
    const cam = this.cameras.main;
    cam.fadeIn(400, 28, 18, 16);
    const ultima = this.registry.get("ultimaArea");
    if (ultima !== this.areaAtual) this.mostrarCartao();
    this.registry.set("ultimaArea", this.areaAtual);
    // Eventos do comando que trocou de área (entrar numa masmorra: a 1ª etapa), depois do cartão de título.
    const eventosPendentes = this.registry.get("eventosPendentes") || [];
    this.registry.set("eventosPendentes", null);
    for (const x of eventosPendentes) if (x.tipo === "masmorraEtapa") this.time.delayedCall(ultima !== this.areaAtual ? 2700 : 200, () => this.eventoMasmorra(x));
    window.UI?.areaMudou?.(this.areaAtual);
    window.atualizarInterface?.();

    // Mensagens: a pendente (morte, viagem) tem prioridade; depois os avisos da lógica.
    const pendente = this.registry.get("mensagemPendente");
    this.registry.set("mensagemPendente", null);
    if (pendente) this.mensagem(pendente);
    else if (!ultima && typeof tutorialAtivo === "function" && tutorialAtivo(this.p)) this.mensagem("Bem-vindo a Canaã! Siga o cartão do tutorial, no canto da tela.");
    else if (!ultima) this.mensagem("Bem-vindo! Arraste os itens para os espaços de equipamento.");
    // Cada aviso da lógica só é consumido na hora de aparecer: se a cena
    // reiniciar antes (troca de área, morte, viagem), o relógio dela descarta
    // o timer e o aviso segue pendente no save para o próximo create.
    const proximoAviso = (atraso) => this.time.delayedCall(atraso, () => {
      const texto = Mundo.consumirAviso?.(MEU_ID);
      if (!texto) return;
      this.mensagem(texto);
      proximoAviso(3200);
    });
    proximoAviso(pendente ? 2600 : 1800);
    if (window.Arte && typeof console !== "undefined")
      console.debug(`[mundo] ${this.areaAtual}: ${this.children.list.length} objetos; tileset ${Arte.gerarTileset(this.areaAtual).ms.toFixed(1)} ms`);
  }

  criarTecladoEPonteiro() {
    // F1 é tratado só pelo keydown do documento (UI); aqui não é registrado.
    this.teclas = this.input.keyboard.addKeys({
      w: "W", a: "A", s: "S", d: "D", q: "Q", e: "E", z: "Z", c: "C", f: "F", p: "P", space: "SPACE", r: "R", h: "H", i: "I",
      up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT", alt: "ALT",
    });
    this.input.keyboard.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE", "ALT"]);
    // Zoom do jogador: roda do mouse sobre o mapa, ou + e − no teclado.
    this.input.on("wheel", (ptr, sobre, dx, dy) => { if (dy) this.ajustarZoom(dy < 0 ? 1 : -1); });
    // Toque ou clique curto no chão (sem arrastar: arrasto é o joystick) anda até a casa tocada.
    this.input.on("pointerup", (ptr, sobre) => {
      if (sobre.length || this.trocando || ptr.rightButtonReleased?.()) return;
      if (Math.hypot(ptr.upX - ptr.downX, ptr.upY - ptr.downY) > 12 * this.escalaUI() || ptr.upTime - ptr.downTime > 700) return;
      if (window.Jogo?.joystickAtivo) return;
      this.irAteCasa(Math.floor(ptr.worldX / TAM), Math.floor(ptr.worldY / TAM));
    });
  }

  // ===== chão: 3 camadas de Tilemap (chão+borda+moldura, decoração, sombras)
  criarChao() {
    const { chave, ts } = Arte.registrarTileset(this, this.areaAtual);
    this.tileset = ts;
    const W = COLS + MOLDURA * 2, H = ROWS + MOLDURA * 2;
    const proibido = this.casasProibidasParaDeco();
    const orla = !!window.Cenario?.temOrla?.(this.areaAtual);
    const chao = [], deco = [], sombra = [];
    for (let y = 0; y < H; y++) {
      const a = [], b = [], c = [];
      for (let x = 0; x < W; x++) {
        const mx = x - MOLDURA, my = y - MOLDURA;
        a.push(ts.indice(mx, my));
        b.push(ts.indiceDeco(mx, my, proibido));
        c.push(orla ? -1 : ts.indiceSombra(mx, my)); // com a orla (cenario.js) a borda não é mais uma parede
      }
      chao.push(a); deco.push(b); sombra.push(c);
    }
    const off = -MOLDURA * TAM;
    const camada = (dados, prof) => {
      const mapa = this.make.tilemap({ data: dados, tileWidth: TAM, tileHeight: TAM });
      const tiles = mapa.addTilesetImage("ts", chave, TAM, TAM, 0, 0);
      return mapa.createLayer(0, tiles, off, off).setDepth(prof);
    };
    this.camadaChao = camada(chao, PROF.chao);
    camada(deco, PROF.deco);
    camada(sombra, PROF.sombraContato);
  }

  casasProibidasParaDeco() {
    const set = new Set();
    const marca = (x, y, r = 0) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) set.add(`${x + dx},${y + dy}`); };
    for (const n of Object.values(npcs)) if (n.area === this.areaAtual) marca(n.x, n.y);
    for (const e of Object.values(inimigos)) if (e.area === this.areaAtual) marca(e.x, e.y);
    for (const p of PORTAIS) if (p.area === this.areaAtual) marca(p.x, p.y, 1);
    const a = areas[this.areaAtual];
    for (const k of ["passagem", "cais"]) if (a?.[k]) marca(a[k].x, a[k].y, 1);
    for (const pt of Object.values(a?.portos || {})) marca(pt.cais.x, pt.cais.y, 1);
    for (const d of DADOS_MAPAS[this.areaAtual]?.decoracoes || []) marca(d.x, d.y, 1);
    return (x, y) => set.has(`${x},${y}`);
  }

  // ===== blocos de cenário: só os blocos perto da câmera ficam visíveis
  noBloco(img, x, y) {
    const chave = `${Math.floor(x / BLOCO)},${Math.floor(y / BLOCO)}`;
    if (!this.blocos.has(chave)) this.blocos.set(chave, []);
    this.blocos.get(chave).push(img);
    img.setVisible(false);
    return img;
  }
  atualizarBlocos() {
    const v = this.cameras.main.worldView, lado = BLOCO * TAM;
    // uma linha de blocos de folga (16 casas para cada lado): árvores de 3 casas, colunas e telhados passam
    // do próprio bloco e a sombra projetada sai para a direita; nada some na beira da tela
    const bx0 = Math.floor(v.x / lado) - 1, by0 = Math.floor(v.y / lado) - 1;
    const bx1 = Math.floor((v.x + v.width) / lado) + 1, by1 = Math.floor((v.y + v.height) / lado) + 1;
    const assinatura = `${bx0},${by0},${bx1},${by1}`;
    if (assinatura === this.blocosVisiveis) return;
    this.blocosVisiveis = assinatura;
    for (const [chave, imgs] of this.blocos) {
      const [bx, by] = chave.split(",").map(Number);
      const ver = bx >= bx0 && bx <= bx1 && by >= by0 && by <= by1;
      if (imgs.length && imgs[0].visible === ver) continue;
      for (const img of imgs) img.setVisible(ver);
    }
  }

  // ===== obstáculos: um Image por casa bloqueada do interior (y-sort)
  criarObstaculos() {
    const mapa = mapas[this.areaAtual], piso = pisos[this.areaAtual];
    const cais = areas[this.areaAtual]?.cais;
    for (let y = 1; y < ROWS - 1; y++)
      for (let x = 1; x < COLS - 1; x++) {
        if (!mapa[y][x] || piso[y][x] === PISO.AGUA || piso[y][x] >= PISO.ESTRUTURA) continue;
        if (cais && x === cais.x && y < cais.y) continue; // sob o píer do cais
        const tipo = Arte.tipoObstaculo(this.areaAtual, x, y);
        if (!tipo || !Arte.garantirTextura(this, tipo.chave)) continue; // a arte dos obstáculos é gerada só para a área atual
        // muro de vila e mureta de pedra: emendam com os vizinhos do mesmo tipo (cenario.js)
        const muro = this.tipoMuro(x, y);
        if (muro) {
          const m = (this.tipoMuro(x, y - 1) === muro ? 1 : 0) | (this.tipoMuro(x + 1, y) === muro ? 2 : 0) | (this.tipoMuro(x, y + 1) === muro ? 4 : 0) | (this.tipoMuro(x - 1, y) === muro ? 8 : 0);
          if (m) {
            const chave = Cenario.texturaMuro(this, muro, m, Math.floor(Arte.hash2(x, y, 6) * 3));
            this.noBloco(this.add.image(x * TAM, y * TAM - Cenario.ALTURA_MURO, chave).setOrigin(0, 0).setDepth(PROF.entidade + y * TAM + TAM - 2), x, y);
            continue;
          }
        }
        const def = PIXEL_PATTERNS[tipo.chave];
        let variante = tipo.animado ? 0 : Math.floor(Arte.hash2(x, y, 4) * (def.fecho || def.quadros));
        if (tipo.fecho) variante += def.fecho; // a última cerca da fileira: quadro com o poste na ponta direita
        // árvores e pedras fora da grade: deslocamento sorteado por casa (bosque natural), pequeno nos altos
        // (o tronco fica na casa que ele bloqueia). Espelho só em quem não traz luz e sombra desenhadas
        // (def.semEspelho): a luz vem sempre de cima e da esquerda e a sombra cai para a direita.
        const solto = !tipo.animado && !muro && !def.prop; // os props das vilas ficam no lugar (a cerca emenda)
        const alto = tipo.alto || def.alto;
        const desloc = solto ? Math.round((Arte.hash2(x, y, 5) - 0.5) * (alto ? 6 : 8)) : 0;
        const descer = solto ? Math.round((Arte.hash2(x, y, 7) - 0.5) * (alto ? 4 : 6)) : 0;
        const img = this.add.image(centroX(x) + desloc, y * TAM + TAM + (def.obstaculo ? 2 * Arte.PX : 0) + descer, tipo.chave, variante)
          .setOrigin(0.5, 1)
          .setDepth(PROF.entidade + y * TAM + TAM - 2)
          .setFlipX(solto && !def.semEspelho && Arte.hash2(x, y, 8) < 0.5);
        if (!def.obstaculo) img.y = y * TAM + TAM; // fogueira etc.
        this.registrarAlto(img, tipo.chave, variante);
        if (tipo.animado) this.animados.push({ img, quadros: Arte.FX?.[tipo.chave]?.quadros || tipo.animado, fps: Arte.FX?.[tipo.chave]?.ms ? 1000 / Arte.FX[tipo.chave].ms : 6 });
        if (tipo.chave === "fx_fogueira") this.luzes.push({ x: centroX(x), y: y * TAM + 20, r: 120, quente: 1, tremula: true });
        this.noBloco(img, x, y);
      }
  }

  // Orla (cenario.js): mata, palmeiral ou pedregal na borda do mapa e nas casas de fora, mais escuro para fora.
  criarOrla() {
    if (!window.Cenario) return;
    this.corSombraOrla = Arte.motor.misturar(this.bio.sombra || "#2a2420", "#000000", 0.35);
    for (const o of Cenario.obstaculosDaOrla(this.areaAtual)) {
      if (!Arte.garantirTextura(this, o.chave)) continue;
      const def = PIXEL_PATTERNS[o.chave];
      const quadro = Math.floor(Arte.hash2(o.x, o.y, 4) * def.quadros);
      const img = this.add.image(centroX(o.x) + o.dx, o.y * TAM + TAM + o.dy + (def.obstaculo ? 2 * Arte.PX : 0), o.chave, quadro)
        .setOrigin(0.5, 1).setDepth(PROF.entidade + o.y * TAM + TAM - 2).setFlipX(!def.semEspelho && Arte.hash2(o.x, o.y, 8) < 0.5);
      // mais escuro para fora, no matiz da sombra da região (e não em cinza)
      if (o.escuro) img.setTint(hexNum(Arte.motor.misturar("#ffffff", this.corSombraOrla, Math.min(1, o.escuro * 1.15))));
      // a copa alta da orla cobre a fileira andável junto à borda: fica translúcida como as do interior
      if (o.y >= -1 && o.y <= ROWS && o.x >= -1 && o.x <= COLS) this.registrarAlto(img, o.chave, quadro);
      this.noBloco(img, o.x, o.y);
    }
  }

  // Tipo de muro contínuo da casa (muro, tijolos) ou null.
  tipoMuro(x, y) {
    if (!window.Cenario || mapas[this.areaAtual][y]?.[x] !== 1 || pisos[this.areaAtual][y][x] !== PISO.CHAO) return null;
    const t = Arte.tipoObstaculo(this.areaAtual, x, y);
    const nome = t?.chave?.replace(`ob_${this.areaAtual}_`, "");
    return nome && Cenario.MUROS[nome] ? nome : null;
  }

  // ===== estruturas: casas, tendas, bancas e poços (dados/mapas.js), uma imagem por estrutura
  criarEstruturas() {
    this.predios = [];
    this.sobPredio = new Map(); // casa de dentro (x + y × COLS) → prédio cujo telhado a tapa enquanto está fechado
    this.atrasDePredio = new Map(); // casa (x + y × COLS) → prédio cujo telhado a cobre
    this.fantasmas = new Map(); // entidade → cópia translúcida dela por cima do telhado que a esconde
    for (const e of estruturasPorArea[this.areaAtual] || []) {
      if (e.entrar) { this.criarPredio(e); continue; }
      const chave = `es_${e.tipo}`;
      if (!this.textures.exists(chave)) continue;
      const base = (e.y + e.altura) * TAM;
      const quadro = Math.min(e.variante || 0, PIXEL_PATTERNS[chave].quadros - 1);
      const img = this.add.image((e.x + e.largura / 2) * TAM, base + Arte.PX, chave, quadro)
        .setOrigin(0.5, 1).setDepth(PROF.entidade + base - 2);
      this.noBloco(img, e.x + (e.largura >> 1), e.y + e.altura - 1);
      // como as copas: o telhado fica translúcido com alguém atrás dele
      this.registrarAlto(img, chave, quadro);
    }
  }

  // Objeto alto (copa, coluna, estandarte, tenda, telhado de estrutura): entra no índice this.copas em
  // todas as casas por onde o desenho passa (da base até a altura real dele), para ficar translúcido
  // quando cobre o jogador ou alguém perto dele (atualizarTranslucidez).
  registrarAlto(img, chave, quadro = 0) {
    const def = PIXEL_PATTERNS[chave];
    if (!def || (def.alturaVisual || 0) < 40 && def.h * Arte.PX < 64) return;
    const m = mascaraDoDesenho(chave, quadro);
    if (!m || m.y1 - m.y0 < 40) return;
    const k = (def.h * Arte.PX) / m.h; // px de mundo por px da máscara (1 na arte em res 2)
    const ox = img.x - img.displayOriginX, oy = img.y - img.displayOriginY;
    const fx0 = img.flipX ? m.w - 1 - m.x1 : m.x0, fx1 = img.flipX ? m.w - 1 - m.x0 : m.x1;
    const alto = { img, m, k, ox, oy, x0: ox + fx0 * k, x1: ox + (fx1 + 1) * k, y0: oy + m.y0 * k, y1: oy + (m.y1 + 1) * k };
    for (let ty = Math.floor(alto.y0 / TAM); ty <= Math.floor((alto.y1 - 1) / TAM); ty++)
      for (let tx = Math.floor(alto.x0 / TAM); tx <= Math.floor((alto.x1 - 1) / TAM); tx++) {
        const c = tx + 64 + (ty + 64) * 4096;
        const lista = this.copas.get(c);
        if (lista) lista.push(alto); else this.copas.set(c, [alto]);
      }
  }
  // O ponto (x, y) do mundo cai sobre um px opaco do objeto alto?
  altoCobre(alto, x, y) {
    if (x < alto.x0 || x >= alto.x1 || y < alto.y0 || y >= alto.y1) return false;
    const m = alto.m;
    let lx = Math.floor((x - alto.ox) / alto.k);
    const ly = Math.floor((y - alto.oy) / alto.k);
    if (alto.img.flipX) lx = m.w - 1 - lx;
    return lx >= 0 && ly >= 0 && lx < m.w && ly < m.h && m.op[ly * m.w + lx] === 1;
  }
  // Translucidez geral: todo objeto alto desenhado na frente (profundidade maior) que cobre de fato o
  // corpo do jogador, de um NPC ou de uma criatura a até 4 casas dele vai para alfa 0,5 e volta ao sair.
  atualizarTranslucidez(delta) {
    const cobrindo = new Set();
    const testar = (s, altura) => {
      if (!s?.visible) return;
      const prof = s.depth, a = Math.max(20, altura);
      // 7 pontos do corpo: cabeça, peito (centro e lados), quadril, canela e pés (a tenda ou a rocha que
      // esconde só as pernas de quem está logo atrás também conta)
      const pontos = [[0, -a + 5], [0, -a * 0.62], [-6, -a * 0.55], [6, -a * 0.55], [0, -a * 0.3], [0, -a * 0.14], [0, -3]];
      const vistos = new Set();
      for (const ty of new Set([Math.floor((s.y - a + 5) / TAM), Math.floor((s.y - a * 0.3) / TAM), Math.floor((s.y - 3) / TAM)]))
        for (const tx of [Math.floor((s.x - 6) / TAM), Math.floor((s.x + 6) / TAM)]) {
          const lista = this.copas.get(tx + 64 + (ty + 64) * 4096);
          if (!lista) continue;
          for (const alto of lista) {
            if (vistos.has(alto) || cobrindo.has(alto.img)) continue;
            vistos.add(alto);
            if (alto.img.depth <= prof || !alto.img.visible) continue;
            // só canela e pés cobertos (os 2 últimos pontos) não bastam: o objeto ficava inteiro translúcido
            // por esconder 8 px de sandália; do quadril para cima, sim
            let n = 0, acima = 0;
            pontos.forEach(([dx, dy], i) => { if (this.altoCobre(alto, s.x + dx, s.y + dy)) { n++; if (i < 5) acima++; } });
            if (n >= 2 && acima >= 1) cobrindo.add(alto.img);
          }
        }
    };
    testar(this.jogador, this.alturaRotuloJogador()); // montado: a altura da vista atual, não a geral
    for (const ent of this.proximos) testar(ent.sprite, ent.alturaCabeca);
    for (const s of Object.values(this.spritesAliados)) testar(s, 24);
    const passo = reduzMovimento() ? 1 : Math.min(1, (delta || 16) / 110) * 0.5;
    for (const img of cobrindo) if (!this.translucidos.has(img)) this.translucidos.set(img, img.alpha);
    for (const [img, a] of this.translucidos) {
      if (!img.active) { this.translucidos.delete(img); continue; }
      const alvo = cobrindo.has(img) ? 0.5 : 1;
      const novo = Math.abs(alvo - a) <= passo ? alvo : a + Math.sign(alvo - a) * passo;
      img.setAlpha(novo);
      if (novo === 1) this.translucidos.delete(img); else this.translucidos.set(img, novo);
    }
  }

  // Prédio onde se entra (cenario.js): chão, parede de dentro, móveis e, por cima, o telhado com a fachada.
  // O telhado some quando o jogador entra (atualizarPredios) e fica translúcido com ele logo atrás.
  criarPredio(e) {
    const k = Cenario.texturasPredio(this, e);
    const X0 = e.x * TAM, Y0 = e.y * TAM, W = e.largura * TAM, H = e.altura * TAM;
    const meio = e.x + (e.largura >> 1), fim = e.y + e.altura - 1;
    const chao = this.add.image(X0, Y0, k.chao).setOrigin(0, 0).setDepth(PROF.deco + 0.5);
    const sombra = this.add.image(X0, Y0, k.sombra).setOrigin(0, 0).setDepth(PROF.sombraContato + 0.5);
    // parede de 2 casas (Cenario.ALTURA_PAREDE): "dentro" e "fora" têm a pegada mais a altura e sobem AP px
    const AP = Cenario.ALTURA_PAREDE;
    const dentro = this.add.image(X0, Y0 - AP, k.dentro).setOrigin(0, 0).setDepth(PROF.entidade + Y0 + 30);
    const fora = this.add.image(X0, Y0 - AP, k.fora).setOrigin(0, 0).setDepth(PROF.entidade + Y0 + H - 1.5);
    const imgs = [chao, sombra, dentro, fora];
    const bloqueado = new Set(e.moveis.map((m) => `${m.x},${m.y}`));
    e.moveis.forEach((m, i) => {
      const viz = m.tipo === "balcao"
        ? { esq: e.moveis.some((o) => o.tipo === "balcao" && o.x === m.x - 1 && o.y === m.y), dir: e.moveis.some((o) => o.tipo === "balcao" && o.x === m.x + 1 && o.y === m.y) }
        : {};
      const chave = Cenario.texturaMovel(this, m.tipo, e.variante, viz, m.x * 7 + m.y * 3 + i);
      imgs.push(this.add.image(centroX(m.x), m.y * TAM + TAM, chave).setOrigin(0.5, 1).setDepth(PROF.entidade + m.y * TAM + TAM - 2));
    });
    // folha da porta: fecha e abre conforme o jogador chega perto (fica na fachada, some com o telhado)
    const porta = this.add.image(e.porta.x * TAM, e.porta.y * TAM + TAM - AP, Cenario.texturaPorta(this, e.variante, false)).setOrigin(0, 0)
      .setDepth(PROF.entidade + Y0 + H - 1.4);
    imgs.push(porta);
    for (const img of imgs) this.noBloco(img, meio, fim);
    // a parede de dentro (2 casas de altura) só aparece com o jogador dentro: de fora, com o telhado translúcido,
    // ela taparia quem está atrás do prédio
    dentro.setAlpha(0);
    const pr = { e, fora, porta, paredeDentro: dentro, aberta: false, alvo: 1, bloqueado };
    this.predios.push(pr);
    // casas ao norte que o telhado subido cobre (2 fileiras com a parede de 64 px): quem pisa nelas fica atrás dele
    for (let y = e.y; y < e.y + e.altura - 1; y++) for (let x = e.x; x < e.x + e.largura; x++) this.sobPredio.set(x + y * COLS, pr);
    for (let q = 1; q <= Math.ceil(AP / TAM); q++) for (let x = e.x; x < e.x + e.largura; x++) this.atrasDePredio.set(x + (e.y - q) * COLS, pr);
    // candeia na porta e a luz de dentro (que só conta com o telhado aberto)
    this.luzes.push({ x: centroX(e.porta.x) + 20, y: e.porta.y * TAM + TAM - Math.round(AP * 0.66), r: 56, quente: 0.8, tremula: true });
    this.luzes.push({ x: X0 + W / 2, y: Y0 + H / 2, r: Math.max(W, H) * 0.75, quente: 0.6, predio: this.predios[this.predios.length - 1] });
  }

  // Telhado: some com o jogador dentro (chão de dentro ou porta), fica translúcido com ele atrás (nas fileiras
  // ao norte que o telhado subido cobre) e volta inteiro do lado de fora. A parede de dentro (2 casas de
  // altura) só aparece com o jogador dentro. NPC ou criatura atrás do telhado (ou da parede de dentro) não
  // muda o prédio: ganha uma cópia translúcida por cima dele (atualizarFantasmas), só no contorno do corpo.
  atualizarPredios(delta) {
    if (!this.predios?.length) return;
    const p = this.p;
    const passo = Math.min(1, (delta || 16) / 140) * 1.6;
    const rumo = (a, alvo) => (Math.abs(alvo - a) < 0.02 ? alvo : Math.max(0, Math.min(1, a + (alvo - a) * passo)));
    const atrasDoJogador = this.atrasDePredio.get(p.x + p.y * COLS);
    const estaDentro = (e) => p.x > e.x && p.x < e.x + e.largura - 1 && p.y > e.y && (p.y < e.y + e.altura - 1 || (p.x === e.porta.x && p.y === e.porta.y));
    // o prédio em que o jogador está: o telhado subido de um vizinho logo ao sul cairia sobre o chão e a porta
    // dele (casas a 1 fileira uma da outra), então esse vizinho também abre (quase some) enquanto ele está dentro
    const casaDoJogador = this.predios.find((pr) => estaDentro(pr.e))?.e || null;
    const fileirasAP = Math.ceil(Cenario.ALTURA_PAREDE / TAM);
    for (const pr of this.predios) {
      const e = pr.e;
      const dentro = e === casaDoJogador;
      const c = casaDoJogador;
      const cobreACasa = !!c && !dentro && e.y > c.y && e.y - fileirasAP < c.y + c.altura && e.x < c.x + c.largura && c.x < e.x + e.largura;
      const alvo = dentro ? 0 : cobreACasa ? 0.22 : atrasDoJogador === pr ? 0.5 : 1;
      // a porta abre com o jogador a uma casa dela (ou nela) e fecha quando ele se afasta
      const aberta = cheb(p, e.porta) <= 1;
      if (aberta !== pr.aberta) {
        pr.aberta = aberta;
        pr.porta.setTexture(Cenario.texturaPorta(this, e.variante, aberta));
        const ctx = Som.contexto();
        if (ctx) Som.nota(ctx, aberta ? 220 : 165, ctx.currentTime, 0.08, "triangle", 0.03);
      }
      if (pr.fora.alpha !== alvo) {
        pr.fora.setAlpha(rumo(pr.fora.alpha, alvo));
        pr.porta.setAlpha(pr.fora.alpha);
      }
      const alvoParede = dentro ? 1 : 0;
      if (pr.paredeDentro.alpha !== alvoParede) pr.paredeDentro.setAlpha(rumo(pr.paredeDentro.alpha, alvoParede));
      if (dentro !== pr.dentro) {
        pr.dentro = dentro;
        if (dentro) window.UI?.entrouNoPredio?.(e);
      }
    }
    this.atualizarFantasmas();
  }
  // Personagem dentro de um prédio de telhado fechado: o corpo está tapado, então nome e barra também somem
  // (senão flutuam sobre o telhado sem ninguém embaixo). O balão de missão/loja fica, como letreiro do prédio.
  sobTelhado(ent) {
    const d = ent.dados, pr = d && this.sobPredio?.get(d.x + d.y * COLS);
    return !!pr && pr.fora.alpha > 0.6;
  }
  // Quem está atrás de um telhado (ou da parede de dentro, com o jogador dentro de casa) aparece através dele:
  // uma cópia do sprite, a 0,8 de alfa, desenhada logo acima do prédio — o efeito é o de o prédio ficar
  // translúcido só sobre o corpo de quem ele esconde. Some quando o telhado inteiro já está translúcido.
  atualizarFantasmas() {
    const vistos = this._fantasmasVistos || (this._fantasmasVistos = new Set());
    vistos.clear();
    if (this.atrasDePredio.size) for (const id in this.entidades) {
      const ent = this.entidades[id], s = ent.sprite, d = ent.dados;
      if (!s?.active || !s.visible || !d) continue;
      const pr = this.atrasDePredio.get(d.x + d.y * COLS);
      if (!pr) continue;
      // por cima do telhado; com o jogador dentro, por cima da parede do fundo (e por baixo de quem está dentro)
      const capa = pr.dentro ? pr.paredeDentro : pr.fora;
      // 0,8: lê-se como a pessoa vista por cima do beiral, não como um vulto (a 0,5 o NPC de missão parecia um fantasma)
      const alfa = 0.8 * s.alpha * Math.max(0, Math.min(1, pr.dentro ? capa.alpha : (capa.alpha - 0.5) * 2));
      if (alfa < 0.02) continue;
      let f = this.fantasmas.get(ent);
      if (!f) { f = this.add.sprite(s.x, s.y, s.texture.key, s.frame.name); this.fantasmas.set(ent, f); }
      if (f.texture.key !== s.texture.key) f.setTexture(s.texture.key, s.frame.name); else if (f.frame.name !== s.frame.name) f.setFrame(s.frame.name);
      f.setPosition(s.x, s.y).setOrigin(s.originX, s.originY).setScale(s.scaleX, s.scaleY).setFlipX(s.flipX).setAlpha(alfa);
      if (s.isTinted) f.setTint(s.tintTopLeft); else if (f.isTinted) f.clearTint();
      const prof = capa.depth + 0.2;
      if (f.depth !== prof) f.setDepth(prof);
      vistos.add(ent);
    }
    for (const [ent, f] of this.fantasmas) if (!vistos.has(ent)) { f.destroy(); this.fantasmas.delete(ent); }
  }

  // Memória: o chão contínuo (1 MB por pedaço de 512 × 512 px) e os prédios pintados para uma área só
  // servem nela. Na troca de área (a cena reinicia e os objetos antigos já foram destruídos) essas
  // texturas saem do gerenciador; sem isso, cada área visitada deixava de 10 a 30 MB para trás.
  liberarTexturasDeOutraArea() {
    const antes = this.registry.get("areaDasTexturas");
    this.registry.set("areaDasTexturas", this.areaAtual);
    if (!antes || antes === this.areaAtual) return;
    for (const chave of Object.keys(this.textures.list)) if (/^(chao_|pr_)/.test(chave)) this.textures.remove(chave);
  }

  // ===== chão contínuo (cenario.js): pedaços de 16 × 16 casas pintados pixel a pixel, criados perto da câmera
  // A pintura é fatiada (Cenario.pintarFatia): no máximo ORCAMENTO_CHAO_MS por quadro, um pedaço por vez, o mais
  // perto do centro primeiro — andar não engasga. `agora` (troca de área, atrás do cartão de transição e do
  // escurecimento da câmera): pinta de uma vez os pedaços que a câmera vê; os da margem seguem fatiados.
  atualizarChaoContinuo(agora = false) {
    if (this.areaAtual === "mar" || !window.Cenario) return;
    const cam = this.cameras.main, lado = Cenario.LADO_PEDACO * TAM;
    // antes do primeiro quadro a câmera ainda não mediu o que vê: o retângulo sai do zoom e do alvo dela
    let v = cam.worldView;
    if (agora || !v.width) {
      const w = cam.width / cam.zoom, h = cam.height / cam.zoom, c = this.alvoCamera || this.jogador;
      v = { x: c.x - w / 2, y: c.y - h / 2 - 16 / cam.zoom, width: w, height: h + 32 / cam.zoom };
    }
    // inclui a orla de fora do mapa (MOLDURA_CASAS casas além da borda)
    const m = Cenario.MOLDURA_CASAS * TAM;
    const bx0 = Math.max(Math.floor(-m / lado), Math.floor((v.x - lado / 2) / lado)), by0 = Math.max(Math.floor(-m / lado), Math.floor((v.y - lado / 2) / lado));
    const bx1 = Math.min(Math.floor((COLS * TAM + m - 1) / lado), Math.floor((v.x + v.width + lado / 2) / lado));
    const by1 = Math.min(Math.floor((ROWS * TAM + m - 1) / lado), Math.floor((v.y + v.height + lado / 2) / lado));
    this.pedacosChao = this.pedacosChao || new Map();
    const cx = (v.x + v.width / 2) / lado, cy = (v.y + v.height / 2) / lado, falta = [];
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) if (!this.pedacosChao.has(`${bx},${by}`)) falta.push([bx, by]);
    if (falta.length) {
      const naTela = ([bx, by]) => bx * lado < v.x + v.width && (bx + 1) * lado > v.x && by * lado < v.y + v.height && (by + 1) * lado > v.y;
      falta.sort((a, b) => (naTela(b) - naTela(a)) || Math.hypot(a[0] + 0.5 - cx, a[1] + 0.5 - cy) - Math.hypot(b[0] + 0.5 - cx, b[1] + 0.5 - cy));
      const t0 = performance.now();
      for (const [bx, by] of falta) {
        const urgente = naTela([bx, by]);
        let chave;
        if (agora && urgente) chave = Cenario.texturaPedacoChao(this, this.areaAtual, bx, by);
        else {
          // um pedaço que já entrou na tela sem estar pronto (salto de câmera) ganha o dobro do orçamento
          const resto = ORCAMENTO_CHAO_MS * (urgente ? 2 : 1) - (performance.now() - t0);
          if (resto < 0.5) break;
          chave = Cenario.texturaPedacoChaoFatiada(this, this.areaAtual, bx, by, resto);
          if (!chave) break; // um pedaço por vez: continua no próximo quadro
        }
        const img = this.add.image(bx * lado, by * lado, chave).setOrigin(0, 0).setDepth(PROF.chao + 0.5);
        this.pedacosChao.set(`${bx},${by}`, { img, chave });
      }
    }
    // libera os pedaços longe da câmera (memória)
    if (this.pedacosChao.size > 30) {
      for (const [k, pd] of this.pedacosChao) {
        const [bx, by] = k.split(",").map(Number);
        if (bx >= bx0 - 1 && bx <= bx1 + 1 && by >= by0 - 1 && by <= by1 + 1) continue;
        pd.img.destroy();
        this.textures.remove(pd.chave);
        this.pedacosChao.delete(k);
      }
    }
  }

  criarDecoracao() {
    const plano = (chave, x, y) => {
      if (mapas[this.areaAtual][y]?.[x] !== 0 || !this.textures.exists(chave)) return;
      this.add.image(centroX(x), y * TAM + TAM / 2, chave).setDepth(PROF.deco);
    };
    const a = this.areaAtual;
    for (const d of DADOS_MAPAS[a]?.decoracoes || []) plano(d.chave, d.x, d.y);
    // Jesus: luz quente e sutil no chão (sem auréola, nada sobre o corpo).
    const jesus = npcs.jesusGalileia;
    if (jesus && jesus.area === a) {
      const luz = this.add.image(centroX(jesus.x), baseY(jesus.y) - 2, "fx_luz_quente").setDepth(PROF.sombra - 1).setAlpha(0.1).setBlendMode(Phaser.BlendModes.ADD);
      if (!reduzMovimento()) this.tweens.add({ targets: luz, alpha: 0.18, duration: 3000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  // ===== marcadores: portais, trilha, cais, pesca (família única)
  criarMarcadores() {
    const a = this.areaAtual, area = areas[a];
    const rotulo = (texto, x, y, cor = COR.saida) => {
      const t = this.textoRotulo(texto, cor);
      this.marcadores.push({ x, y, rotulo: t, dy: -54 });
      return t;
    };
    const setas = (x, y, paraOeste, fechado) => {
      const s = this.add.sprite(centroX(x), y * TAM + TAM / 2, "mk_setas", fechado ? 3 : 0).setDepth(PROF.marcadorChao).setFlipX(paraOeste);
      if (!fechado) this.animados.push({ img: s, quadros: 3, fps: 5 });
      return s;
    };
    // Portais entre regiões. Guardados em this.portais para que
    // atualizarPortais() os abra quando o capítulo anterior for concluído
    // sem trocar de área (ex.: falar com Moisés depois de vencer o alvo).
    this.portais = [];
    for (const p of PORTAIS.filter((x) => x.area === a)) {
      const fechado = this.portalFechado(p);
      const chave = Arte.garantirTextura(this, `mk_portal_${a}_${p.destino}`);
      const img = this.add.sprite(centroX(p.x), p.y * TAM + TAM + 2, chave, fechado ? 4 : 0).setOrigin(0.5, 1).setDepth(PROF.entidade + p.y * TAM + TAM - 3);
      if (!fechado) this.animados.push({ img, quadros: 4, fps: 6 });
      this.luzes.push({ x: centroX(p.x), y: p.y * TAM, r: 110, quente: 0.3 });
      const oeste = p.x < COLS / 2;
      const s = setas(p.x + (oeste ? 1 : -1), p.y, oeste, fechado);
      this.add.image(centroX(p.x) + 6, baseY(p.y) - 1, "fx_sombra_g").setDepth(PROF.sombra);
      const t = rotulo(fechado ? `${p.texto} · fechada` : p.texto, p.x, p.y, fechado ? COR.fechada : COR.saida);
      this.portais.push({ dados: p, img, setas: s, rotulo: t, fechado });
    }
    // Trilha terrestre Canaã ↔ Deserto
    if (area?.passagem) {
      const p = area.passagem, oeste = p.x < COLS / 2;
      this.add.image(centroX(p.x), p.y * TAM + TAM + 2, "mk_trilha").setOrigin(0.5, 1).setDepth(PROF.entidade + p.y * TAM + TAM - 3);
      setas(p.x + (oeste ? 1 : -1), p.y, oeste, false);
      rotulo(a === "canaan" ? "Trilha para o Deserto" : "Trilha para Canaã", p.x, p.y);
    }
    // Cais de toda cidade: píer que entra na água ao norte (enseada na borda, o Nilo ou o lago da Galileia),
    // com o barco atracado. Pisar nele paga a passagem e embarca.
    if (area?.cais) {
      const c = area.cais;
      const s = this.add.sprite(centroX(c.x), c.y * TAM + TAM + 2, "mk_cais", 0).setOrigin(0.5, 1).setDepth(PROF.marcadorChao);
      this.animados.push({ img: s, quadros: 2, fps: 2 });
      const barco = this.add.sprite(centroX(c.x) + 38, c.y * TAM - 52, "mk_barco", 0).setOrigin(0.5, 1).setDepth(PROF.marcadorChao + 1);
      // atracado: o balanço da vista de lado (os primeiros quadros da folha)
      const qBarco = PIXEL_PATTERNS.mk_barco?.quadrosPorVista || 2;
      this.animados.push({ img: barco, quadros: qBarco, fps: qBarco > 2 ? 2.8 : 1.5 });
      const passagem = typeof REGRAS_BARCO !== "undefined" ? ` · ${REGRAS_BARCO.passagem} moedas` : "";
      rotulo(`Barco para o Mar das Rotas${passagem}`, c.x, c.y, COR.agua);
    }
    // Mar: um cais em cada cidade, na margem mais perto (o píer sai da margem para o mar).
    if (a === "mar") {
      for (const [regiao, porto] of Object.entries(area.portos || {})) {
        const c = porto.cais;
        const lado = c.x < 10 ? "oeste" : c.x > COLS - 10 ? "leste" : c.y < 10 ? "norte" : "sul";
        const ang = { oeste: -90, leste: 90, norte: 180, sul: 0 }[lado];
        const x = lado === "oeste" ? c.x * TAM - TAM / 2 : lado === "leste" ? c.x * TAM + TAM * 1.5 : centroX(c.x);
        const y = lado === "norte" ? c.y * TAM - TAM / 2 : lado === "sul" ? c.y * TAM + TAM * 1.5 : c.y * TAM + TAM / 2;
        const s = this.add.sprite(x, y, "mk_cais", 0).setAngle(ang).setDepth(PROF.marcadorChao);
        this.animados.push({ img: s, quadros: 2, fps: 2 });
        const fechado = areaAberta(this.p, regiao) ? "" : " (fechado)";
        rotulo(`Desembarcar · ${areas[regiao].nome}${fechado}`, c.x, c.y, COR.agua);
      }
    }
  }

  // ===== coletáveis e saques ==========================================
  addItemVisual(id, x, y, textura, quadro = 0, raridade = "comum") {
    const chave = Arte.aliasItem(textura);
    const tex = this.textures.exists(chave) ? chave : "pele_lobo";
    const px = centroX(x), py = y * TAM + 24;
    const sombra = this.add.image(px + 2, y * TAM + 27, "fx_sombra").setDepth(PROF.sombra).setScale(0.8, 1);
    const s = this.add.sprite(px, py, tex, quadro).setOrigin(0.5, 0.75).setDepth(PROF.entidade + y * TAM + 20);
    s.sombraItem = sombra;
    if (!reduzMovimento()) this.tweens.add({ targets: s, y: py - 2, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * 600 });
    if (tex === "moeda") this.animados.push({ img: s, quadros: 4, fps: 6 });
    const extras = this.brilhoDoSaque(px, y, raridade);
    const destruir = s.destroy.bind(s);
    s.destroy = (...args) => {
      sombra.destroy();
      for (const x of extras) x.destroy();
      this.animados = this.animados.filter((a) => a.img !== s);
      destruir(...args);
    };
    this.spritesItens[id] = s;
    return s;
  }
  // Brilho no chão conforme a raridade (RARIDADES[r].brilho): 1 aura; 2 aura e faíscas;
  // 3 também o pilar de luz; 4 pilar mais alto e aura maior. Devolve o que destruir junto com o item.
  brilhoDoSaque(px, y, raridade) {
    const r = typeof RARIDADES !== "undefined" ? RARIDADES[raridade] : null;
    const nivel = r?.brilho || 0;
    if (!nivel) return [];
    const cor = hexNum(r.cor), reduz = reduzMovimento(), extras = [];
    const aura = this.add.image(px, y * TAM + 26, "fx_aura").setOrigin(0.5, 0.5).setDepth(PROF.sombra + 1).setTint(cor)
      .setScale(nivel >= 4 ? 1.35 : nivel >= 3 ? 1.15 : 1).setAlpha(0.5 + 0.1 * nivel);
    extras.push(aura);
    if (!reduz) this.tweens.add({ targets: aura, alpha: 0.3 + 0.05 * nivel, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    if (nivel >= 3) {
      const pilar = this.add.image(px, y * TAM + 28, "fx_pilar").setOrigin(0.5, 1).setDepth(PROF.entidade + y * TAM + 19).setTint(cor)
        .setScale(nivel >= 4 ? 1.3 : 1, nivel >= 4 ? 2.4 : 1.7).setAlpha(0.42);
      extras.push(pilar);
      if (!reduz) this.tweens.add({ targets: pilar, alpha: 0.22, scaleX: pilar.scaleX * 0.8, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    if (nivel >= 2 && !reduz) {
      const evento = this.time.addEvent({
        delay: nivel >= 4 ? 380 : nivel >= 3 ? 560 : 820, loop: true,
        callback: () => {
          const f = this.add.sprite(px + (Math.random() - 0.5) * 22, y * TAM + 22 - Math.random() * (nivel >= 3 ? 34 : 14), "fx_brilho", 0)
            .setTint(cor).setDepth(PROF.numero - 3);
          this.tweens.add({ targets: f, y: f.y - 10, alpha: 0, duration: 700, onComplete: () => f.destroy() });
          this.time.delayedCall(180, () => f.active && f.setFrame(1));
          this.time.delayedCall(380, () => f.active && f.setFrame(2));
        },
      });
      extras.push({ destroy: () => evento.remove(false) });
    }
    return extras;
  }
  // Saque raro ou melhor acabou de cair: som, estouro de faíscas e o nome da raridade subindo.
  anunciarSaqueRaro(saques, e) {
    if (!saques?.length || !e) return;
    const ordem = typeof RARIDADES !== "undefined" ? Object.keys(RARIDADES) : [];
    const melhor = saques.reduce((a, b) => (ordem.indexOf(b.raridade) > ordem.indexOf(a.raridade) ? b : a));
    const r = RARIDADES[melhor.raridade];
    if (!r) return;
    Som.saque(melhor.raridade);
    const x = centroX(e.x), y = baseY(e.y);
    this.particulasSimples(x, y - 12, r.cor, 6 + 4 * r.brilho, { subir: true, dur: 700, espalha: 14 + 3 * r.brilho });
    if (r.brilho >= 2) {
      const t = this.add.text(x, y - 52, `${r.nome.toUpperCase()}!`, {
        fontFamily: FONTE_PIXEL, fontSize: (ESTILO_RARIDADE[melhor.raridade] || 14) + "px", color: r.cor, stroke: COR.tinta, strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(PROF.numero);
      if (!reduzMovimento()) { const b = t.scale; t.setScale(b * 1.5); this.tweens.add({ targets: t, scale: b, duration: 220, ease: "Back.easeOut" }); }
      this.tweens.add({ targets: t, y: t.y - 22, duration: 1400, ease: "Cubic.easeOut" });
      this.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 400, onComplete: () => t.destroy() });
    }
    if (r.brilho >= 3 && !reduzMovimento()) this.cameras.main.flash(160, ...[1, 3, 5].map((i) => parseInt(r.cor.slice(i, i + 2), 16) >> 1));
  }
  criarSaques(pular = false) {
    for (const s of this.p.saqueNoChao || []) {
      if (s.area !== this.areaAtual || this.spritesItens[s.id]) continue;
      const textura = s.moedas ? (s.moedas >= 10 ? "moeda_pilha" : "moeda") : s.item;
      const raridade = s.moedas ? "comum" : s.destaque || raridadeItem(s.item);
      const sprite = this.addItemVisual(s.id, s.x, s.y, textura, 0, raridade);
      // A pilha (o que não coube na mochila de uma vez) ganha cópias atrás.
      if (s.quantidade > 1) this.desenharPilha(sprite, s);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => this.irAteSaque(s.id));
      if (pular && !reduzMovimento()) {
        sprite.x += (Math.random() - 0.5) * 10;
        this.tweens.add({ targets: sprite, scaleY: 1.15, duration: 120, yoyo: true });
      }
    }
  }
  // Pilha de saque no chão (s.quantidade): cópias do mesmo desenho atrás do item, deslocadas em pixels
  // inteiros (2 a partir de 2 unidades, 3 a partir de 5), como um montinho; somem junto com ele.
  desenharPilha(sprite, s) {
    const copias = [[-5, 2], [5, 3]].slice(0, s.quantidade >= 5 ? 2 : 1).map(([dx, dy]) =>
      this.add.image(sprite.x + dx, sprite.y + dy, sprite.texture.key, 0).setOrigin(0.5, 0.75).setDepth(sprite.depth - 1));
    const destruir = sprite.destroy.bind(sprite);
    sprite.destroy = (...args) => { for (const c of copias) c.destroy(); destruir(...args); };
  }
  // O saque mudou na lógica (pilha que cresceu ou diminuiu): redesenha só ele.
  redesenharSaque(id) {
    this.spritesItens[id]?.destroy();
    delete this.spritesItens[id];
    this.p = Mundo.jogadores[MEU_ID];
    this.criarSaques(true);
  }
  pegarSaque(id) {
    const r = Mundo.executar(MEU_ID, { tipo: "coletarSaque", saqueId: id });
    this.mensagem(r.mensagem);
    if (r.ok) {
      const s = this.spritesItens[id];
      if (s && r.moedas) this.numero(s.x, s.y - 16, `+${r.moedas}`, "moeda");
      if (r.restante) this.redesenharSaque(id); // a mochila encheu no meio da pilha: o resto fica
      else {
        s?.destroy();
        delete this.spritesItens[id];
      }
      this.p = Mundo.jogadores[MEU_ID];
      window.atualizarInterface?.();
    }
  }

  // ===== pesca ========================================================
  desenharPontosPesca() {
    this.pesca = [];
    for (const ponto of pontosPesca) {
      const s = this.add.sprite(centroX(ponto.x), ponto.y * TAM + TAM / 2, "mk_pesca", 0).setDepth(PROF.marcadorChao).setInteractive({ useHandCursor: true });
      s.on("pointerdown", () => this.irAtePesca(ponto));
      this.pesca.push({ ponto, s });
      this.marcadores.push({ x: ponto.x, y: ponto.y, rotulo: this.textoRotulo("Pesca", COR.agua), dy: -18 });
    }
  }
  pescar() {
    const r = Mundo.executar(MEU_ID, { tipo: "pescar" });
    this.mensagem(r.mensagem);
    if (r.ok) {
      this.p = Mundo.jogadores[MEU_ID];
      const ponto = pontosPesca.find((x) => cheb(this.p, x) <= 1);
      if (ponto && !reduzMovimento()) {
        const peixe = this.add.image(centroX(ponto.x), ponto.y * TAM + 16, "peixe").setDepth(PROF.numero - 1);
        this.tweens.add({ targets: peixe, x: this.jogador.x, duration: 600 });
        this.tweens.add({ targets: peixe, y: peixe.y - 30, duration: 300, yoyo: true, ease: "Quad.easeOut", onComplete: () => peixe.destroy() });
      }
      this.oficioSubiu(r.oficioSubiu);
      window.atualizarInterface?.();
    }
  }

  // Ofício subiu de nível (JGB-24): "CARPINTEIRO 3" sobre o jogador, no estilo do "NÍVEL N".
  oficioSubiu(subiu) {
    if (!subiu || !this.jogador?.active || typeof OFICIOS === "undefined") return;
    const x = this.jogador.x, y = this.jogador.y;
    const t = this.add.text(x, y - 40, `${OFICIOS[subiu.oficio].nome.toUpperCase()} ${subiu.nivel}`, { fontFamily: FONTE_TITULO, fontStyle: "700", fontSize: "16px", color: "#e6cf9c", stroke: COR.tinta, strokeThickness: 4, resolution: 2 })
      .setOrigin(0.5, 1).setDepth(PROF.numero);
    this.tweens.add({ targets: t, y: y - 66, alpha: 0, delay: 700, duration: 600, onComplete: () => t.destroy() });
    if (!reduzMovimento()) this.particulasSimples(x, y - 10, "#e6cf9c", 10, { subir: true, dur: 800 });
  }

  // ===== entidades ====================================================
  portalFechado(p) {
    return !!p.capitulo && typeof capituloAnteriorConcluido === "function" && !capituloAnteriorConcluido(this.p, p.capitulo);
  }
  // Abre (quadro, animação e rótulo) os portais cujo capítulo anterior acabou
  // de ser concluído nesta mesma cena.
  atualizarPortais() {
    for (const portal of this.portais || []) {
      if (!portal.fechado || this.portalFechado(portal.dados)) continue;
      portal.fechado = false;
      portal.img.setFrame(0);
      portal.setas.setFrame(0);
      this.animados.push({ img: portal.img, quadros: 4, fps: 6 }, { img: portal.setas, quadros: 3, fps: 5 });
      portal.rotulo.setText(portal.dados.texto).setColor(COR.saida);
      this.particulasSimples(portal.img.x, portal.img.y - 24, "#f2d27a", 10, { subir: true, dur: 800 });
    }
  }
  // Nome de personagem ou rótulo de marcador: pequeno (px de tela), negrito, com contorno escuro fino.
  textoRotulo(texto, cor, px = 12) {
    return this.add.text(0, 0, texto, { fontFamily: FONTE_PIXEL, fontSize: px + "px", color: cor, stroke: COR.tinta, strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(PROF.rotulo).setAlpha(0);
  }

  criarEntidade(tipo, dados, chave) {
    // Raro nomeado (escala e tinta nos dados): se a arte tiver a variante pronta, no porte e na cor,
    // usa a textura dela (sem escala fracionária nem tinta por cima); senão, setScale e setTint.
    const variante = dados.escala || dados.tinta ? Arte.garantirVariante(chave, { escala: dados.escala || 1, tinta: dados.tinta }) : null;
    if (variante) chave = variante;
    Arte.garantirTextura(this, chave);
    const def = PIXEL_PATTERNS[chave];
    const quadrupede = !!def && !def.humano;
    const x = centroX(dados.x), y = baseY(dados.y);
    // sombra: a medida da def (contrato novo) ou uma das três do legado
    const chaveSombra = def?.sombra ? Arte.garantirTextura(this, Arte.garantirSombra(def.sombra.w, def.sombra.h))
      : quadrupede ? "fx_sombra_lobo" : Arte.CHEFES.has(dados.id) ? "fx_sombra_g" : "fx_sombra";
    const sombra = this.add.image(x + 3, y - 1, chaveSombra).setDepth(PROF.sombra);
    const sprite = this.add.sprite(x, y, chave, 0).setOrigin(0.5, 1).setDepth(PROF.entidade + y);
    sprite.setInteractive({ useHandCursor: true });
    // Criatura: nome com os modificadores de campeão (dourado), elite prateado e raro nomeado lilás,
    // maior e tingido (escala e tinta dos dados).
    const ficha = tipo === "inimigo" ? Mundo.fichaInimigo(MEU_ID, dados.id) : null;
    const nome = ficha ? ficha.nome : Arte.nomeCurto(dados.nome);
    const corTier = ficha && typeof TIERS_CRIATURAS !== "undefined" ? TIERS_CRIATURAS[ficha.tier]?.cor : null;
    const corNome = ficha?.campeao ? COR_CAMPEAO : corTier || (tipo === "inimigo" ? corDaVida(1)[2] : COR.amigo);
    const escala = variante ? 1 : dados.escala || 1;
    if (escala !== 1) sprite.setScale(escala);
    if (dados.tinta && !variante) sprite.setTint(hexNum(dados.tinta));
    if (ficha?.campeao || ficha?.nomeado) {
      sprite.auraCampeao = this.add.image(x, y - 2, "fx_aura").setDepth(PROF.sombra + 1).setTint(hexNum(ficha.campeao ? COR_CAMPEAO : corTier)).setAlpha(0.55).setScale(1.2);
      if (!reduzMovimento()) this.tweens.add({ targets: sprite.auraCampeao, alpha: 0.25, duration: 800, yoyo: true, repeat: -1 });
    }
    const ent = {
      id: dados.id, tipo, dados, chave, sprite, sombra, quadrupede,
      rotulo: this.textoRotulo(nome, corNome, NOME_PX),
      corNome,
      corAtual: corNome,
      // nome na cor da vida (verde com a vida cheia), a não ser nos destaques: campeão, elite e raro nomeado
      corFixa: tipo !== "inimigo" || !!(ficha?.campeao || corTier),
      chefe: Arte.CHEFES.has(dados.id),
      grande: !!def && def.w * Arte.PX >= 56,
      fase: Math.random() * 1200, acaoAte: 0, falando: false, andandoAte: 0, feridoAte: 0,
      desl: Object.assign(novoDeslize(x, y), { casaX: dados.x, casaY: dados.y, durTeto: tipo === "inimigo" ? Number(dados.intervaloMovimento) || PASSO_CRIATURA_MS.padrao : 0 }),
      alturaCabeca: Math.round((def.alturaCabeca || alturaDoDesenho(chave)) * escala),
      vidaFantasma: tipo === "inimigo" ? Mundo.obterVidaInimigo(MEU_ID, dados.id) : 0,
      fantasmaDesde: 0,
    };
    sprite.on("pointerover", () => { this.hoverId = dados.id; });
    sprite.on("pointerout", () => { if (this.hoverId === dados.id) this.hoverId = null; });
    this.entidades[dados.id] = ent;
    return ent;
  }

  criarNpcs() {
    for (const n of Object.values(npcs).filter((n) => n.area === this.areaAtual)) {
      const ent = this.criarEntidade("npc", n, Arte.visualDe(n.id));
      ent.balao = this.add.image(ent.sprite.x, 0, "mk_balao_missao").setOrigin(0.5, 1).setDepth(PROF.barra).setVisible(false);
      ent.sprite.on("pointerdown", () => this.irAteNpc(n.id));
    }
    this.atualizarBaloes();
  }

  criarInimigo(e) {
    this.entidades[e.id] && this.destruirEntidade(e.id);
    const ent = this.criarEntidade("inimigo", e, Arte.visualDe(e.id));
    ent.sprite.on("pointerdown", () => this.selecionarAlvo(e.id));
    return ent;
  }

  destruirEntidade(id) {
    const ent = this.entidades[id];
    if (!ent) return;
    ent.sprite?.auraCampeao?.destroy();
    ent.alerta?.destroy();
    for (const k of ["sprite", "sombra", "rotulo", "balao"]) ent[k]?.destroy();
    delete this.entidades[id];
    if (this.hoverId === id) this.hoverId = null;
  }

  // Balões: !, ?, …, loja, guia (§6.8)
  estadoBalao(npc, p) {
    try {
      if (npc.papel === "loja") return "loja";
      if (npc.papel === "guia") return "guia";
      // Missões, capítulos e o Mestre: regra única em logica.js (motor de missões).
      if (typeof estadoMissaoNpc === "function") return estadoMissaoNpc(p, npc.id);
    } catch (e) {
      return null;
    }
    return null;
  }
  atualizarBaloes() {
    for (const ent of Object.values(this.entidades)) {
      if (ent.tipo !== "npc") continue;
      const estado = this.estadoBalao(ent.dados, this.p);
      ent.estadoBalao = estado;
      if (!estado) ent.balao.setVisible(false);
      else ent.balao.setTexture("mk_balao_" + estado).setVisible(true);
    }
  }

  // ===== jogador ======================================================
  chaveJogador() {
    if (this.areaAtual === "mar") return "mk_barco";
    const visual = typeof visualDoJogador === "function" ? visualDoJogador(this.p) : {};
    const chave = Arte.garantirJogador(this.p.equipamento || {}, visual);
    return Arte.garantirTextura(this, chave);
  }
  criarJogador() {
    const x = centroX(this.p.x), y = baseY(this.p.y);
    this.chaveAtualJogador = this.chaveJogador();
    this.sombraJogador = this.add.image(x + 3, y - 1, this.areaAtual === "mar" ? "fx_sombra_g" : "fx_sombra").setDepth(PROF.sombra);
    if (this.areaAtual === "mar") this.sombraJogador.setVisible(false);
    this.jogador = this.add.sprite(x, y + (this.areaAtual === "mar" ? 6 : 0), this.chaveAtualJogador, 0).setOrigin(0.5, 1).setDepth(PROF.entidade + y + 1);
    this.estadoJogador = { andandoAte: 0, acaoAte: 0, fase: 0, desl: Object.assign(novoDeslize(this.jogador.x, this.jogador.y), { meioCiclo: true }) };
    // nome sobre o jogador, como em todo personagem (a cor acompanha a vida)
    this.rotuloJogador = this.textoRotulo("Você", corDaVida(1)[2], NOME_PX).setAlpha(1).setDepth(PROF.rotulo + 0.5);
    this.corRotuloJogador = corDaVida(1)[2];
    this.medirJogador();
    // a câmera segue este ponto (só a posição interpolada: sem o recuo de golpe)
    this.alvoCamera = { x: this.jogador.x, y: this.jogador.y };
    this.sprite = this.jogador; // compatibilidade
  }
  // Altura do corpo (para nome, barra e translucidez) e sombra do sprite atual do jogador.
  medirJogador() {
    const chave = this.chaveAtualJogador, def = PIXEL_PATTERNS[chave];
    this.alturaJogador = Math.round(def?.alturaCabeca || alturaDoDesenho(chave));
    if (def?.sombra && this.areaAtual !== "mar") this.sombraJogador.setTexture(Arte.garantirTextura(this, Arte.garantirSombra(def.sombra.w, def.sombra.h)));
  }
  // Onde ficam nome e barra do jogador: a altura declarada (a pé, barco) ou a da vista atual (montado).
  alturaRotuloJogador() {
    const chave = this.chaveAtualJogador, def = PIXEL_PATTERNS[chave];
    if (!def || def.alturaCabeca || !def.direcoes || this.jogador.texture.key !== chave) return this.alturaJogador;
    return alturaDaVista(chave, this.jogador.getData("vista") || "frente");
  }
  atualizarVisualJogador() {
    const chave = this.chaveJogador();
    if (chave && chave !== this.chaveAtualJogador) {
      this.chaveAtualJogador = chave;
      this.jogador.setTexture(chave, 0);
      this.medirJogador();
    }
  }

  // ===== efeitos reutilizáveis ========================================
  criarEfeitosDeMundo() {
    this.anel = this.add.sprite(0, 0, "fx_anel", 0).setDepth(PROF.marcadorChao + 0.6).setVisible(false);
    this.anelAmigo = this.add.sprite(0, 0, "fx_anel_amigo", 0).setDepth(PROF.marcadorChao + 0.6).setVisible(false);
    this.gBarras = this.add.graphics().setDepth(PROF.barra);
    this.gRecarga = this.add.graphics().setDepth(PROF.marcadorChao + 0.5);
    this.estrelaChefe = this.add.image(0, 0, "ui_estrela_chefe").setDepth(PROF.barra + 1).setVisible(false);
    this.dica = this.add.text(0, 0, "", { fontFamily: FONTE_PIXEL, fontSize: "12px", color: "#2a1a14", backgroundColor: "#ead6a6", padding: { x: 5, y: 2 } })
      .setOrigin(0.5, 0).setDepth(PROF.rotulo + 1).setVisible(false);
    this.brilhoItem = this.add.sprite(0, 0, "fx_brilho", 0).setDepth(PROF.numero - 2).setVisible(false);
    this.proximoBrilho = 0;
    // pontos da elipse por fora do anel fino (arco de recarga do autoataque), em ordem angular
    this.pontosAnel = [];
    let ant = "";
    for (let i = 0; i < 96; i++) {
      const t = -Math.PI / 2 + (i / 96) * Math.PI * 2;
      const pt = [Math.round(Math.cos(t) * 21), Math.round(Math.sin(t) * 10.5)];
      if (pt.join() !== ant) { this.pontosAnel.push(pt); ant = pt.join(); }
    }
  }

  // Número flutuante único (§8.5): cor pelo tipo (dano, crítico, recebido, cura, fé, veneno, erro…), contorno
  // escuro fino, subida de cerca de 1 casa em arco com desaceleração. Os números em curso se empilham: o
  // mais novo nasce no lugar e empurra para cima os anteriores que ele cobriria (animarEfeitos).
  numero(x, y, txt, tipo = "dano") {
    const [cor, fs] = ESTILO_NUM[tipo] || ESTILO_NUM.dano, reduz = reduzMovimento();
    this._lado = -(this._lado || 1);
    const t = this.add.text(0, 0, txt, { fontFamily: FONTE_PIXEL, fontSize: fs + "px", color: cor, stroke: COR.tinta, strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(PROF.numero);
    let obj = t, w = t.displayWidth;
    if (ICONE_NUM[tipo]) {
      const ic = this.add.image(-t.displayWidth / 2 - 2, 2, ICONE_NUM[tipo]).setOrigin(1, 1);
      obj = this.add.container(0, 0, [t, ic]).setDepth(PROF.numero);
      w += ic.displayWidth * 2 + 4;
    }
    obj.setPosition(Math.round(x), Math.round(y));
    const n = { obj, t, x0: x, y0: y, t0: this.time.now, w, h: t.displayHeight * 0.74, lado: reduz ? 0 : this._lado, y, pop: reduz ? 0 : tipo === "critico" ? 0.7 : 0.3 };
    this.numeros.push(n);
    if (this.numeros.length > 24) this.numeros.shift().obj.destroy();
    if (tipo === "critico" && !reduz) this.cameras.main.shake(80, 0.003);
    return n;
  }
  // Tira de efeito (Arte.FX[chave] = { quadros, ms, laco }) na posição dada, um quadro a cada `ms`, e some
  // no fim. opts: depth, flipX, flipY, angle, alpha, tint, escala, atraso (ms), ms, quadros, quadro (fixo),
  // segue (sprite que o efeito acompanha, com dx e dy), apaga (ms finais em que o alfa cai a zero).
  fx(chave, x, y, opts = {}) {
    const def = PIXEL_PATTERNS[chave];
    if (!def || !Arte.garantirTextura(this, chave)) return null;
    const info = Arte.FX?.[chave] || {};
    const quadros = opts.quadros || (opts.quadro != null ? 1 : info.quadros || def.quadros || 1), ms = opts.ms || info.ms || 60;
    const o = opts.origem || def.origem || [0.5, 0.5];
    const s = this.add.sprite(Math.round(x), Math.round(y), chave, opts.quadro || 0).setOrigin(o[0], o[1]).setDepth(opts.depth ?? PROF.numero - 1);
    if (opts.flipX) s.setFlipX(true);
    if (opts.flipY) s.setFlipY(true);
    if (opts.angle) s.setAngle(opts.angle);
    if (opts.alpha != null) s.setAlpha(opts.alpha);
    if (opts.tint != null) s.setTint(opts.tint);
    if (opts.escala) s.setScale(opts.escala);
    const t0 = this.time.now + (opts.atraso || 0);
    if (opts.atraso) s.setVisible(false);
    this.fxAtivos.push({ s, t0, ms, quadros, fixo: opts.quadro != null ? opts.quadro : -1, segue: opts.segue || null, dx: opts.dx || 0, dy: opts.dy || 0, apaga: opts.apaga || 0, alfa: opts.alpha ?? 1, chao: !!opts.chao });
    return s;
  }
  // compatibilidade: tira com contagem e tempo dados por quem chama
  efeitoQuadro(chave, x, y, quadros, ms, opts = {}) {
    return this.fx(chave, x, y, { ...opts, quadros, ms });
  }
  // Marca no chão (poça, restos): fica sob os pés de todos e some sozinha; no máximo 16 ao mesmo tempo.
  marcaNoChao(chave, x, y, { vida = 8000, apaga = 1500, alpha = 1, flipX = false, quadro = null } = {}) {
    const marcas = this.fxAtivos.filter((f) => f.chao);
    if (marcas.length >= 16) { marcas[0].s.destroy(); this.fxAtivos.splice(this.fxAtivos.indexOf(marcas[0]), 1); }
    const n = quadro != null ? 1 : Arte.FX?.[chave]?.quadros || 1;
    return this.fx(chave, x, y, { depth: PROF.marcadorChao + 0.2, ms: vida / n, apaga, alpha, flipX, chao: true, quadro: quadro ?? undefined });
  }
  // Projétil (fx_flecha, fx_pedra, fx_orbe): 3 desenhos — horizontal, diagonal e vertical — espelhados para
  // as 8 direções. Voa de (x0, y0) até o alvo e chama aoChegar. Devolve a duração do voo em ms.
  voar(chave, x0, y0, x1, y1, aoChegar) {
    const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy);
    const dur = Math.max(90, Math.min(260, dist / 0.55));
    const setor = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8; // 0 leste, 2 sul, 4 oeste, 6 norte
    const quadro = setor % 4 === 0 ? 0 : setor % 2 === 0 ? 2 : 1;
    const def = PIXEL_PATTERNS[chave];
    if (!def || !Arte.garantirTextura(this, chave)) { this.time.delayedCall(dur, () => aoChegar?.()); return dur; }
    const p = this.add.sprite(x0, y0, chave, Math.min(quadro, def.quadros - 1)).setDepth(PROF.numero - 1)
      .setFlipX(setor >= 3 && setor <= 5).setFlipY(setor >= 1 && setor <= 3);
    this.tweens.add({ targets: p, x: x1, y: y1, duration: dur, onComplete: () => { p.destroy(); aoChegar?.(); } });
    return dur;
  }
  // Por quadro: tiras de efeito (quadro pela idade), marcas no chão e números (arco, pilha e sumiço).
  animarEfeitos(time) {
    const fxs = this.fxAtivos;
    for (let i = fxs.length - 1; i >= 0; i--) {
      const f = fxs[i], s = f.s, idade = time - f.t0;
      if (!s.active) { fxs.splice(i, 1); continue; }
      if (idade < 0) continue;
      const total = f.ms * f.quadros;
      if (idade >= total) { s.destroy(); fxs.splice(i, 1); continue; }
      if (!s.visible) s.setVisible(true);
      if (f.fixo < 0) { const q = Math.floor(idade / f.ms); if (s.frame.name !== q) s.setFrame(q); }
      if (f.segue) { if (f.segue.active) s.setPosition(f.segue.x + f.dx, f.segue.y + f.dy); else f.segue = null; }
      if (f.apaga && total - idade < f.apaga) s.setAlpha(f.alfa * Math.max(0, (total - idade) / f.apaga));
    }
    const ns = this.numeros;
    if (!ns.length) return;
    for (let i = ns.length - 1; i >= 0; i--) {
      const n = ns[i], k = (time - n.t0) / NUM_VOO.ms;
      if (k >= 1 || !n.obj.active) { n.obj.destroy(); ns.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - k, 3); // desacelera
      n.x = n.x0 + n.lado * NUM_VOO.lado * Math.sin(e * Math.PI * 0.5);
      n.y = n.y0 - NUM_VOO.sobe * e;
      n.obj.setAlpha(k < NUM_VOO.some ? 1 : 1 - (k - NUM_VOO.some) / (1 - NUM_VOO.some));
      if (n.pop) { const z = 1 + n.pop * Math.max(0, 1 - (time - n.t0) / 150); n.t.setScale((n.t._pop = z) / this.cameras.main.zoom); }
    }
    // pilha: do mais novo para o mais antigo, cada um fica acima de todos os mais novos que cobriria
    // (repete até assentar: subir por causa de um pode pôr em cima de outro)
    for (let i = ns.length - 2; i >= 0; i--) {
      const a = ns[i];
      for (let volta = 0, mexeu = true; mexeu && volta < 6; volta++) {
        mexeu = false;
        for (let j = ns.length - 1; j > i; j--) {
          const b = ns[j];
          if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 2 && a.y > b.y - b.h && a.y - a.h < b.y) { a.y = b.y - b.h - 1; mexeu = true; }
        }
      }
    }
    for (const n of ns) n.obj.setPosition(Math.round(n.x), Math.round(n.y));
  }
  particulasSimples(x, y, cor, n, { subir = false, dur = 400, espalha = 10 } = {}) {
    if (reduzMovimento()) return;
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, "fx_pixel").setTint(hexNum(cor)).setDepth(PROF.numero - 1);
      const ang = Math.random() * Math.PI * 2;
      this.tweens.add({
        targets: p, x: x + Math.cos(ang) * espalha, y: subir ? y - 20 - Math.random() * 20 : y + Math.sin(ang) * espalha * 0.5 - 4,
        alpha: 0, duration: dur + Math.random() * 200, onComplete: () => p.destroy(),
      });
    }
  }

  // ===== câmera, luz e vinheta ========================================
  criarCamera() {
    const cam = this.cameras.main;
    cam.setBackgroundColor("#1c1210");
    this.limitarCamera();
    // A câmera segue um alvo em px inteiros de mundo (alvoCamera, criado com o jogador) e, a cada quadro, quem
    // se move pelo mundo (personagens, barras, nomes, números) vai para px inteiros (pixelsInteiros): 1 px de
    // arte = 1 px de mundo em qualquer zoom, sem meio pixel de arte entre o chão e quem anda.
    this.alvoCamera = { x: Math.round(this.alvoCamera?.x ?? this.jogador.x), y: Math.round(this.alvoCamera?.y ?? this.jogador.y) };
    cam.startFollow(this.alvoCamera, true, 1, 1, 0, 16);
    cam.setRoundPixels(true);
    this.events.on("postupdate", this.pixelsInteiros, this);
    this.events.once("shutdown", () => this.events.off("postupdate", this.pixelsInteiros, this));
    this.scale.on("resize", this.aoRedimensionar, this);
    this.aoRedimensionar();
  }
  // Depois do quadro (tweens e update): tudo o que está visível no mundo fica em px inteiros e a câmera vai junto.
  pixelsInteiros() {
    const lista = this.children.list;
    for (let i = 0; i < lista.length; i++) {
      const o = lista[i];
      if (!o.visible || o.scrollFactorX !== 1) continue;
      if (o.x !== Math.round(o.x)) o.x = Math.round(o.x);
      if (o.y !== Math.round(o.y)) o.y = Math.round(o.y);
    }
    // o alvo da câmera é a posição do deslize do jogador (update), sem a investida do golpe: só arredonda
    if (this.alvoCamera) { this.alvoCamera.x = Math.round(this.alvoCamera.x); this.alvoCamera.y = Math.round(this.alvoCamera.y); }
  }
  // Pixels da tela por pixel de arte (inteiro), para ver cerca de VISAO casas; o ajuste do jogador soma ou
  // tira 1 por vez. w e h em pixels do canvas (já multiplicados pelo devicePixelRatio).
  pixelsPorPixelDeArte(w, h, ajuste = ajusteZoomSalvo()) {
    const [cw, ch] = h > w * 1.15 ? VISAO.empe : VISAO.deitada;
    // arredonda (e não trunca): com 32 px por casa cada passo de zoom é grande, e o mais perto de VISAO vence
    const base = Math.round(Math.min(w / (cw * PIXELS_ARTE_POR_CASA), h / (ch * PIXELS_ARTE_POR_CASA)));
    const minimo = Math.max(1, Math.ceil(dprAtual()));
    return Math.max(minimo, Math.min(16, Math.max(minimo, base) + ajuste));
  }
  zoomIdeal(w, h) {
    return this.pixelsPorPixelDeArte(w, h) / (TAM / PIXELS_ARTE_POR_CASA);
  }
  // Pixels do canvas por pixel de CSS (os textos e cartões na tela usam pixels de CSS).
  escalaUI() {
    return 1 / (this.scale.zoom || 1);
  }
  resolucaoTexto() {
    const z = this.cameras?.main?.zoom || this.zoomIdeal(this.scale.width, this.scale.height);
    return Math.min(8, Math.max(2, Math.ceil(z)));
  }
  // Aproxima (+1) ou afasta (−1) a câmera e guarda a escolha.
  ajustarZoom(passo) {
    const w = this.scale.width, h = this.scale.height;
    const atual = ajusteZoomSalvo();
    const base = this.pixelsPorPixelDeArte(w, h, 0);
    const novo = Math.max(-6, Math.min(6, atual + passo));
    if (this.pixelsPorPixelDeArte(w, h, novo) === this.pixelsPorPixelDeArte(w, h, atual)) return;
    try { localStorage.setItem(CHAVE_ZOOM, String(this.pixelsPorPixelDeArte(w, h, novo) - base)); } catch (e) { /* sem armazenamento */ }
    this.aoRedimensionar();
  }
  // Converte coordenadas de tela para objetos com scrollFactor 0 (compensa o zoom).
  naTela(obj, sx, sy, escala = true) {
    const cam = this.cameras.main, z = cam.zoom;
    obj.setPosition((sx - cam.width / 2) / z + cam.width / 2, (sy - cam.height / 2) / z + cam.height / 2);
    if (escala) obj.setScale(this.escalaUI() / z);
    return obj;
  }
  aoRedimensionar() {
    const cam = this.cameras.main, w = this.scale.width, h = this.scale.height;
    cam.setSize(w, h);
    cam.setZoom(this.zoomIdeal(w, h));
    this.limitarCamera();
    for (const o of this.sobreposicoes || []) o();
    this.minimapaEstatico = null;
    // textos em px de tela: mesmo tamanho na tela em qualquer zoom (e refeitos se o DPR mudou)
    const k = this.escalaUI();
    for (const t of this.textosTela || []) {
      if (!t.active) continue;
      if (t._k !== k) { t._k = k; t.setFontSize(Math.round(t._css * k) + "px"); if (t._traco) t.setStroke(COR.tinta, Math.max(2, Math.round(t._traco * k))); }
      t.setScale((t._pop || 1) / cam.zoom);
    }
  }
  // Limites da câmera: o mapa com a moldura ou, com areas[área].vista (as masmorras), só aquele retângulo de
  // casas; menor que a tela, ele cresce em volta do centro (a sala fica no meio, não presa a um canto).
  limitarCamera() {
    const cam = this.cameras.main, v = areas[this.areaAtual]?.vista;
    if (!v) { cam.setBounds(-MOLDURA * TAM, -MOLDURA * TAM, (COLS + MOLDURA * 2) * TAM, (ROWS + MOLDURA * 2) * TAM); return; }
    const z = cam.zoom || 1, vw = cam.width / z, vh = cam.height / z;
    let x = v.x * TAM, y = v.y * TAM, w = v.largura * TAM, h = v.altura * TAM;
    if (w < vw) { x -= (vw - w) / 2; w = vw; }
    if (h < vh) { y -= (vh - h) / 2; h = vh; }
    cam.setBounds(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
  }
  criarAtmosfera() {
    const cam = this.cameras.main, bio = this.bio;
    this.sobreposicoes = [];
    // luz (tela cheia)
    const luz = this.add.rectangle(0, 0, 10, 10, hexNum(bio.luz.cor), bio.luz.alfa).setScrollFactor(0).setDepth(PROF.luz)
      .setBlendMode(bio.luz.modo === "multiply" ? Phaser.BlendModes.MULTIPLY : Phaser.BlendModes.SCREEN);
    const cobrir = (o) => () => { const z = cam.zoom; o.setPosition(cam.width / 2, cam.height / 2).setDisplaySize(cam.width / z + 2, cam.height / z + 2); };
    luz.setOrigin(0.5);
    this.sobreposicoes.push(cobrir(luz));
    // gradiente de baixo no Sinai
    if (this.areaAtual === "sinai") {
      const chave = "fx_grad_sinai";
      if (!this.textures.exists(chave)) {
        const c = this.textures.createCanvas(chave, 4, 64), ctx = c.getContext();
        const g = ctx.createLinearGradient(0, 0, 0, 64);
        g.addColorStop(0, "rgba(58,42,68,0)"); g.addColorStop(1, "rgba(58,42,68,0.18)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 64); c.refresh();
      }
      const gr = this.add.image(0, 0, chave).setScrollFactor(0).setDepth(PROF.luz).setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.sobreposicoes.push(cobrir(gr));
    }
    // vinheta do bioma + vinheta de vida baixa
    const vinheta = (chave, cor, forca) => {
      if (!this.textures.exists(chave)) {
        const c = this.textures.createCanvas(chave, 256, 256), ctx = c.getContext();
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
        const gr = ctx.createRadialGradient(128, 128, 128 * 0.55, 128, 128, 182);
        gr.addColorStop(0, `rgba(${r},${g},${b},0)`); gr.addColorStop(1, `rgba(${r},${g},${b},${forca})`);
        ctx.fillStyle = gr; ctx.fillRect(0, 0, 256, 256); c.refresh();
      }
      const im = this.add.image(0, 0, chave).setScrollFactor(0).setDepth(PROF.luz + 1);
      this.sobreposicoes.push(cobrir(im));
      return im;
    };
    vinheta("fx_vinheta_" + this.areaAtual, bio.vinheta.cor, bio.vinheta.forca);
    this.criarNoite();
    this.vinhetaVida = vinheta("fx_vinheta_vida", "#8e2a1f", 0.9).setAlpha(0);
    for (const f of this.sobreposicoes) f();
  }
  // Noite: uma camada escura do tamanho da vista, com buracos suaves nas fontes de luz (jogador, fogueiras,
  // candeias das portas, interiores e portais) e um brilho quente por cima. Fica abaixo dos nomes e barras.
  criarNoite() {
    if (!this.textures.exists("fx_luz_noite")) {
      const c = this.textures.createCanvas("fx_luz_noite", 128, 128), ctx = c.getContext();
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,0.8)"); g.addColorStop(0.7, "rgba(255,255,255,0.25)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); c.refresh();
    }
    this.pincelLuz = this.make.image({ key: "fx_luz_noite", add: false }).setOrigin(0.5);
    this.noite = this.add.renderTexture(0, 0, 8, 8).setScrollFactor(0).setOrigin(0.5).setDepth(PROF.barra - 2).setVisible(false);
    this.brilhoNoite = this.add.renderTexture(0, 0, 8, 8).setScrollFactor(0).setOrigin(0.5).setDepth(PROF.barra - 1)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.proximaNoite = 0;
    this.faseAnterior = null;
  }
  atualizarNoite(time) {
    if (!this.noite || time < this.proximaNoite) return;
    this.proximaNoite = time + 50;
    // nas masmorras não há dia nem noite: a escuridão é a do clima delas (bio.escuroFixo, sprites.js)
    const ciclo = escuridaoDoDia(), fixo = this.bio.escuroFixo;
    const escuro = fixo ?? ciclo.escuro, fracao = ciclo.fracao;
    // aviso ao anoitecer e ao amanhecer
    const fase = escuro > 0.3 ? "noite" : "dia";
    if (fixo == null && this.faseAnterior && fase !== this.faseAnterior) this.mensagem(fase === "noite" ? `Anoitece em ${areas[this.areaAtual]?.nome || "toda parte"}.` : "Amanhece. O sol volta a clarear a estrada.");
    this.faseAnterior = fase;
    this.fracaoDia = fracao;
    const ver = escuro > 0.01;
    this.noite.setVisible(ver); this.brilhoNoite.setVisible(ver);
    if (!ver) return;
    const cam = this.cameras.main, v = cam.worldView;
    const W = Math.ceil(v.width) + 2, H = Math.ceil(v.height) + 2;
    for (const rt of [this.noite, this.brilhoNoite]) {
      if (rt.width !== W || rt.height !== H) rt.resize(W, H);
      rt.setPosition(cam.width / 2, cam.height / 2).setDisplaySize(W * cam.zoom, H * cam.zoom);
    }
    this.noite.clear().fill(CICLO_DIA.cor, escuro);
    this.brilhoNoite.clear();
    const fontes = [{ x: this.jogador.x, y: this.jogador.y - 20, r: 84, quente: 0.25 }, ...this.luzes];
    const b = this.pincelLuz;
    for (const l of fontes) {
      if (l.predio && l.predio.fora.alpha > 0.5) continue;
      const lx = l.x - v.x + 1, ly = l.y - v.y + 1;
      if (lx < -l.r || ly < -l.r || lx > W + l.r || ly > H + l.r) continue;
      const r = l.r * (l.tremula && !reduzMovimento() ? 1 + 0.05 * Math.sin(time / 90 + l.x) : 1);
      b.setScale((r * 2) / 128).setAlpha(1).clearTint();
      this.noite.erase(b, lx, ly);
      if (l.quente) {
        b.setScale((r * 1.4) / 128).setAlpha(0.22 * l.quente * (escuro / CICLO_DIA.escuroMax)).setTint(0xffa040);
        this.brilhoNoite.draw(b, lx, ly);
      }
    }
  }
  pulsoVinheta(alfa = 0.35, ms = 150) {
    if (!this.vinhetaVida || this.vidaBaixa) return;
    this.vinhetaVida.setAlpha(alfa);
    this.tweens.add({ targets: this.vinhetaVida, alpha: 0, duration: ms * 2, delay: ms });
  }

  // Cartão de título (§8.7)
  // outroTitulo e subtitulo: o cartão de outra coisa (a etapa da masmorra); sem eles, o da área.
  mostrarCartao(outroTitulo, subtitulo) {
    const cam = this.cameras.main;
    const nome = outroTitulo ?? (areas[this.areaAtual]?.nome || "");
    const sub = subtitulo ?? (Arte.SUBTITULOS[this.areaAtual] || "");
    const faixa = this.add.image(0, 0, "fx_faixa");
    const titulo = this.add.text(0, -6, nome, { fontFamily: FONTE_TITULO, fontStyle: "700", fontSize: "26px", color: "#2a1a14", resolution: 2 }).setOrigin(0.5);
    const subt = this.add.text(0, 18, sub, { fontFamily: FONTE_TEXTO, fontStyle: "italic", fontSize: "14px", color: "#5a3a24", resolution: 2 }).setOrigin(0.5);
    const larg = Math.max(titulo.width, subt.width) / 2 + 22;
    const l1 = this.add.image(-larg, -6, "ui_losango").setScale(1.5), l2 = this.add.image(larg, -6, "ui_losango").setScale(1.5);
    const c = this.add.container(0, 0, [faixa, titulo, subt, l1, l2]).setScrollFactor(0).setDepth(PROF.cartao).setAlpha(0);
    const yAlvo = Math.round(cam.height * (outroTitulo != null ? 0.34 : 0.22)); // o da etapa, abaixo dos avisos
    this.naTela(c, cam.width / 2, yAlvo);
    const yFinal = c.y;
    if (reduzMovimento()) {
      this.tweens.chain({ targets: c, tweens: [{ alpha: 1, duration: 300 }, { alpha: 0, delay: 1600, duration: 300, onComplete: () => c.destroy() }] });
      return;
    }
    c.y = yFinal - 12 / cam.zoom;
    this.tweens.chain({
      targets: c,
      tweens: [
        { alpha: 1, y: yFinal, duration: 400, ease: "Cubic.easeOut" },
        { alpha: 0, y: yFinal - 8 / cam.zoom, delay: 1600, duration: 500, ease: "Cubic.easeIn", onComplete: () => c.destroy() },
      ],
    });
  }

  // Partículas ambiente e pequenas vidas (≤ 30; desligadas com reduced-motion)
  criarAmbiente() {
    if (reduzMovimento()) return;
    const p = this.bio.particulas, cam = this.cameras.main;
    const zona = {
      getRandomPoint: (pt) => {
        const v = cam.worldView;
        if (p.tipo === "respingo") {
          const norte = Math.random() < 0.5;
          pt.x = v.x + Math.random() * v.width;
          pt.y = norte ? TAM + Math.random() * 8 : (ROWS - 1) * TAM - Math.random() * 8;
          return pt;
        }
        pt.x = v.x + Math.random() * v.width;
        pt.y = v.y + Math.random() * v.height;
        return pt;
      },
    };
    const base = { emitZone: { type: "random", source: zona }, maxAliveParticles: p.max, tint: hexNum(p.cor) };
    const cfg = {
      polen: { lifespan: 4000, speedX: { min: -6, max: 6 }, speedY: { min: -10, max: -3 }, scale: 1, alpha: { start: 0.9, end: 0 }, frequency: 220 },
      poeira: { lifespan: 3500, speedX: { min: 4, max: 14 }, speedY: { min: -6, max: 2 }, scale: 1, alpha: { start: 0.8, end: 0 }, frequency: 200 },
      areia: { lifespan: 1400, speedX: { min: 70, max: 130 }, speedY: { min: -4, max: 4 }, scaleX: 3, scaleY: 0.5, alpha: { start: 0.7, end: 0 }, frequency: 90 },
      brilho: { lifespan: 800, speed: 0, scale: 1, alpha: { start: 0.9, end: 0 }, frequency: 110, textura: "fx_brilho", frame: [0, 0, 1] },
      respingo: { lifespan: 600, speedY: { min: -30, max: -10 }, speedX: { min: -10, max: 10 }, gravityY: 60, scale: 1, alpha: { start: 1, end: 0 }, frequency: 70 },
      nevoa: { lifespan: 9000, speedX: { min: 4, max: 10 }, speedY: 0, scaleX: 40, scaleY: 10, alpha: { start: 0.0, end: 0.15, ease: "Sine.easeInOut" }, frequency: 700 },
      brasa: { lifespan: 2400, speedX: { min: -8, max: 8 }, speedY: { min: -34, max: -14 }, scale: 1, alpha: { start: 1, end: 0 }, frequency: 120 },
      borboleta: { lifespan: 3000, speedX: { min: -8, max: 8 }, speedY: { min: 2, max: 8 }, scale: 1, alpha: { start: 0.9, end: 0 }, frequency: 400, tint: 0xd8a0b8 },
    }[p.tipo];
    if (cfg) {
      const textura = cfg.textura || "fx_pixel";
      delete cfg.textura;
      this.ambiente = this.add.particles(0, 0, textura, Object.assign({}, base, cfg)).setDepth(p.tipo === "nevoa" ? PROF.rotulo - 1 : PROF.barra - 1);
    }
    // borboletas (Canaã e Galileia)
    if (this.areaAtual === "canaan" || this.areaAtual === "galileia") {
      for (let i = 0; i < 3; i++) {
        const b = this.add.sprite(centroX(this.p.x) + (i - 1) * 120, baseY(this.p.y) - 60, "fx_borboleta", 0).setDepth(PROF.barra - 2);
        this.animados.push({ img: b, quadros: 2, fps: 8 });
        const voar = () => {
          if (!b.active) return;
          const v = cam.worldView;
          this.tweens.add({ targets: b, x: v.x + Math.random() * v.width, y: v.y + Math.random() * v.height, duration: 4000 + Math.random() * 3000, ease: "Sine.easeInOut", onComplete: voar });
        };
        voar();
      }
    }
  }

  // ===== interação, combate e movimento ===============================
  mensagem(t, tipo) {
    if (!t) return;
    if (window.UI?.mensagem) window.UI.mensagem(t, tipo);
    else window.mostrarMensagem?.(t);
  }

  interagir(alvoId) {
    // Com a fala deste NPC aberta, F (ou clicar nele) só completa e depois
    // fecha a caixa, como diz a dica "clique ou F". Falar de novo avançaria
    // a missão e trocaria a fala (briefing, recompensa) pela seguinte.
    const npcAlvo = alvoId ? npcs[alvoId] : Mundo.npcProximo?.(this.p);
    if (npcAlvo && window.UI?.avancarDialogo?.(npcAlvo.id)) return { ok: true };
    const r = Mundo.executar(MEU_ID, alvoId ? { tipo: "interagir", alvoId } : { tipo: "interagir" });
    this.mensagem(r.mensagem, r.ok ? "fala" : undefined);
    if (r.ok) {
      const npc = alvoId ? npcs[alvoId] : Mundo.npcProximo?.(this.p);
      const ent = npc && this.entidades[npc.id];
      if (ent) {
        ent.acaoAte = this.time.now + 400; ent.falando = true;
        virar(ent.sprite, this.p.x - npc.x, this.p.y - npc.y);
        if (window.UI?.dialogo) window.UI.dialogo({ id: npc.id, nome: npc.nome, papel: npc.papel, texto: r.mensagem });
      }
    }
    if (r.abrirLoja) (window.UI?.abrirLoja || window.abrirLoja)?.(r.abrirLoja);
    if (r.abrirDeposito) (window.UI?.abrirDeposito || window.abrirDeposito)?.(r.abrirDeposito);
    if (r.abrirForja) window.UI?.abrirForja?.(r.abrirForja);
    if (r.abrirViagem) (window.UI?.abrirViagem || window.abrirViagem)?.(r.abrirViagem);
    if (r.abrirBarco) window.UI?.abrirBarco?.(r.abrirBarco);
    if (r.abrirMasmorra) window.UI?.abrirMasmorra?.(r.abrirMasmorra);
    if (r.abrirMural) window.UI?.abrirMural?.(r.abrirMural);
    if (r.abrirVocacao) window.UI?.abrirVocacao?.(r.abrirVocacao);
    if (r.tarefasEntregues?.length) this.particulasSimples(this.jogador.x, this.jogador.y - 20, "#f2d27a", 12, { subir: true, dur: 800 });
    if (r.capituloConcluido || r.oracaoAprendida) this.particulasSimples(this.jogador.x, this.jogador.y - 20, "#f2d27a", 12, { subir: true, dur: 800 });
    this.p = Mundo.jogadores[MEU_ID];
    if (r.capituloConcluido) this.atualizarPortais();
    this.atualizarBaloes();
    this.verificarNivel();
    this.atualizarVisualJogador();
    window.atualizarInterface?.();
    return r;
  }

  // O que está ao alcance do jogador (para a dica "F · Falar" e o botão de toque).
  podeInteragir() {
    const p = this.p;
    if (!p) return null;
    let melhor = null;
    for (const n of Object.values(npcs)) {
      if (n.area !== this.areaAtual || cheb(p, n) > (n.alcance || 1) || (n.alcance > 1 && cheb(p, n) > 1 && !this.linhaLivre(p.x, p.y, n))) continue;
      return { tipo: "npc", id: n.id, rotulo: n.papel === "mural" ? "Caçadas" : "Falar", x: n.x, y: n.y, tecla: "F" };
    }
    const a = areas[this.areaAtual];
    const alvos = [];
    if (this.areaAtual === "mar") {
      for (const pt of Object.values(a.portos || {})) alvos.push({ tipo: "cais", id: "cais", rotulo: "Desembarcar", x: pt.cais.x, y: pt.cais.y, tecla: "F" });
      for (const pt of pontosPesca) alvos.push({ tipo: "pesca", id: pt.id, rotulo: "Pescar", x: pt.x, y: pt.y, tecla: "P" });
    } else {
      if (a?.cais) alvos.push({ tipo: "cais", id: "cais", rotulo: "Embarcar", x: a.cais.x, y: a.cais.y, tecla: "F" });
      if (a?.passagem) alvos.push({ tipo: "portal", id: "trilha", rotulo: "Seguir rota", x: a.passagem.x, y: a.passagem.y, tecla: "F" });
      for (const t of PORTAIS) if (t.area === this.areaAtual) alvos.push({ tipo: "portal", id: "portal", rotulo: "Seguir rota", x: t.x, y: t.y, tecla: "F" });
    }
    for (const alvo of alvos) {
      const d = cheb(p, alvo);
      if (d <= 1 && !(alvo.x === p.x && alvo.y === p.y) && (!melhor || d < cheb(p, melhor))) melhor = alvo;
    }
    return melhor;
  }
  acaoContextual() {
    const alvo = this.podeInteragir();
    if (!alvo || alvo.tipo === "npc") return this.interagir();
    if (alvo.tipo === "pesca") return this.pescar();
    // cais/portal: um passo até a casa do marcador
    this.mover(Math.sign(alvo.x - this.p.x), Math.sign(alvo.y - this.p.y));
  }

  atacarAlvo(distancia = false, auto = false) {
    let id = this.alvoId;
    if (!id) {
      const e = Object.values(inimigos).find((x) => x.area === this.areaAtual && Mundo.obterVidaInimigo(MEU_ID, x.id) > 0 && cheb(this.p, x) <= 1);
      if (e) id = e.id;
    }
    const r = Mundo.executar(MEU_ID, { tipo: distancia ? "atacarDistancia" : "atacar", alvoId: id });
    if (!r.ok) {
      if (!(auto && r.emRecarga)) this.mensagem(r.mensagem);
      return r;
    }
    this.mensagem(r.mensagem, "combate");
    r.atrasoVisual = this.efeitoAtaque(r, r.inimigoId || id, r.tipoAtaque === "distancia");
    this.aposAtaque(r);
    return r;
  }
  // Golpe do jogador em 2 tempos: antecipação, depois o golpe com uma investida curta; o arco do corte, o
  // impacto, o respingo, o número e o recuo da criatura saem no tempo do golpe (ou quando o projétil chega).
  // Tudo na posição do sprite (que pode estar no meio de um passo). Devolve o atraso do acerto em ms.
  efeitoAtaque(r, id, distancia) {
    const ent = this.entidades[id];
    const e = inimigos[id];
    if (!e) return 0;
    const j = this.jogador, agora = this.time.now, reduz = reduzMovimento();
    const alvo = () => (ent?.sprite?.active ? { x: ent.sprite.x, y: ent.sprite.y, alt: ent.alturaCabeca } : { x: centroX(e.x), y: baseY(e.y), alt: 28 });
    const a0 = alvo(), meioJ = this.alturaJogador * 0.5;
    const ang = Math.atan2(a0.y - j.y, a0.x - j.x), ux = Math.cos(ang), uy = Math.sin(ang);
    this.estadoJogador.acaoAte = agora + GOLPE.total;
    if (this.areaAtual !== "mar") virar(j, e.x - this.p.x, e.y - this.p.y);
    const acerto = () => {
      const a = alvo(), meio = a.y - a.alt * 0.5, prof = PROF.entidade + a.y + 30;
      if (r.danoAplicado) {
        this.numero(a.x, a.y - a.alt - NUM_ACIMA, r.critico ? `${r.danoAplicado}!` : `${r.danoAplicado}`, r.critico ? "critico" : "dano");
        this.fx("fx_impacto", a.x - ux * 3, meio - uy * 3, { depth: prof, escala: r.critico ? 1 : undefined });
        this.sangrar(a.x, a.y, a.alt, ux, r.critico || r.derrotado ? 1 : 0.35);
      } else {
        this.numero(a.x, a.y - a.alt - NUM_ACIMA, "errou", "errou");
        this.fx("fx_faisca", a.x - ux * 8, meio - uy * 6, { depth: prof, alpha: 0.8 });
      }
      if (ent && ent.sprite.active) {
        ent.feridoAte = this.time.now + 4000;
        if (r.danoAplicado) {
          ent.sprite.setTintFill(0xfff1d0);
          this.time.delayedCall(60, () => ent.sprite.active && ent.sprite.clearTint());
        }
        if (!reduz && r.danoAplicado && this.entidades[id] === ent)
          Object.assign(ent.desl, { recuoX: Math.round(ux * 2), recuoY: Math.round(uy * 2), recuoAte: this.time.now + 90 });
      }
    };
    if (distancia) {
      // pedra da funda ou flecha: sai da mão no tempo do golpe e acerta ao chegar
      // (a funda atira uma pedra — r.projetil, da lógica —; o arco, a flecha)
      const pedra = r.projetil === "pedra";
      const voo = Math.max(90, Math.min(260, Math.hypot(a0.x - j.x, a0.y - j.y) / 0.55));
      this.time.delayedCall(GOLPE.antecipa, () => {
        if (!j.active) return;
        const a = alvo();
        this.voar(pedra ? "fx_pedra" : "fx_flecha", j.x + ux * 10, j.y - meioJ + uy * 6, a.x, a.y - a.alt * 0.5, acerto);
      });
      return GOLPE.antecipa + voo;
    }
    if (!reduz) this.estadoJogador.desl.golpe = { dx: ux, dy: uy, t0: agora, ...GOLPE };
    this.time.delayedCall(GOLPE.antecipa, () => {
      if (!j.active) return;
      // o arco passa entre os dois corpos, na altura do alvo (criatura baixa: o golpe desce até ela)
      const a = alvo(), yArco = j.y - meioJ + (a.y - a.alt * 0.5 - (j.y - meioJ)) * 0.5;
      this.corte(j.x, yArco - uy * 12, ux, uy, Math.max(j.y, a0.y));
      acerto();
    });
    return GOLPE.antecipa;
  }
  // Arco do golpe (fx_corte, desenhado para a direita): orientado em passos de 45° na direção (ux, uy),
  // espelhado para a esquerda (a luz do desenho continua em cima).
  corte(x, y, ux, uy, yProf, opts = {}) {
    const grau = Math.round(Phaser.Math.RadToDeg(Math.atan2(uy, ux)) / 45) * 45;
    const esq = Math.abs(grau) > 90;
    const angle = esq ? Phaser.Math.Angle.WrapDegrees(grau - 180) : grau;
    return this.fx("fx_corte", x + ux * 15, y + uy * 12, { depth: PROF.entidade + yProf + 31, flipX: esq, angle: angle || undefined, ...opts });
  }
  // A casa sob o ponto (x, y) do mundo é chão firme (não é água)? Marcas no chão só ficam nele.
  chaoFirme(x, y) {
    if (this.areaAtual === "mar") return false;
    const tx = Math.floor(x / TAM), ty = Math.floor((y - 4) / TAM);
    const piso = pisos[this.areaAtual]?.[ty]?.[tx];
    return piso !== undefined && piso !== PISO.AGUA;
  }
  // Respingo de sangue no corpo atingido e, às vezes (chance), a poça que fica no chão uns 8 s.
  sangrar(x, y, alt, ux = 1, chance = 0.35) {
    if (reduzMovimento()) return;
    this.fx("fx_sangue", x + ux * 3, y - alt * 0.45, { depth: PROF.entidade + y + 29, flipX: ux < 0 });
    // uma poça por lugar: quem apanha parado não fica num tapete de poças empilhadas
    const jaTem = this.fxAtivos.some((f) => f.chao && f.s.active && f.s.texture.key === "fx_poca" && Math.abs(f.s.x - x) < 18 && Math.abs(f.s.y - (y - 10)) < 12);
    if (!jaTem && Math.random() < chance && this.chaoFirme(x, y))
      this.marcaNoChao("fx_poca", x + Math.round((Math.random() - 0.5) * 10), y - 12 + Math.round(Math.random() * 4), { vida: 8000, apaga: 1600, alpha: 0.8, flipX: Math.random() < 0.5 });
  }
  autoAtacar() {
    const e = inimigos[this.alvoId];
    if (!e || Mundo.obterVidaInimigo(MEU_ID, e.id) <= 0) {
      this.alvoId = null;
      window.atualizarInterface?.();
      return;
    }
    const alinhado = Mundo.linhaDeTiroLivre(this.p, e); // qualquer direção, caminho livre
    // Uma mão para a arma: com o arco (com flechas) ou a funda na mão, o autoataque atira, também a 1 casa
    // (a lógica aceita o tiro a partir de 1 casa); sem flechas, golpeia ao lado.
    const podeAtirar = atiraDaqui(this.p) && alinhado;
    // Ainda a caminho do alvo: espera chegar (sem a mensagem "chegue ao lado" a cada 2 s).
    if (this.perseguir && !this.alcancaAlvo(e)) return;
    this.ultimoAutoAtaque = this.time.now;
    this.atacarAlvo(!!podeAtirar, true);
  }
  aposAtaque(r) {
    if (r.derrotado) {
      const id = r.inimigoId;
      const caiu = this.entidades[id]?.sprite, ondeCaiu = caiu ? { x: caiu.x, y: caiu.y } : null; // onde o sprite estava (pode estar no meio de um passo)
      const atraso = r.atrasoVisual || 0; // o golpe ainda está a caminho: a criatura cai quando ele chega
      this.animarMorte(id, atraso);
      this.agendarRespawn(id);
      this.alvoId = null;
      const e = inimigos[id];
      const nx = ondeCaiu ? ondeCaiu.x : e ? centroX(e.x) : 0, ny = ondeCaiu ? ondeCaiu.y : e ? baseY(e.y) : 0;
      if (e) this.time.delayedCall(260 + atraso, () => this.numero(nx, ny - 34, `+${r.xpGanho ?? e.xpRecompensa} XP`, "xp"));
      // Caçadas que avançaram com este abate: "27/40" depois do "+XP" (até 3, uma por vez). Nascem abaixo
      // do "+XP", que já subiu, e sobem no mesmo ritmo: os dois números nunca se cobrem.
      if (e) (r.tarefas || []).slice(0, 3).forEach((t, i) => {
        this.time.delayedCall(520 + atraso + i * 250, () => this.numero(nx, ny - 26, `${t.progresso}/${t.meta}`, "tarefa"));
      });
      if (e && r.saquesRaros?.length) this.time.delayedCall(300, () => this.anunciarSaqueRaro(r.saquesRaros, e));
      // Bestiário: a espécie subiu de estágio ("ESTÁGIO 2/3") ou o abate completou o amuleto da família.
      const b = r.bestiario;
      if (e && b?.subiu) {
        const atraso = 780 + (r.atrasoVisual || 0) + Math.min(3, (r.tarefas || []).length) * 250;
        this.time.delayedCall(atraso, () => this.numero(nx, ny - 26, b.amuleto ? "AMULETO!" : `ESTÁGIO ${b.estagio}/${ESTAGIO_MAXIMO_BESTIARIO}`, "bestiario"));
        if (b.amuleto) this.time.delayedCall(atraso, () => this.particulasSimples(this.jogador.x, this.jogador.y - 20, "#c9e0a0", 14, { subir: true, dur: 900 }));
      }
      if (r.explosao) this.marcarExplosao(r.explosao);
      // O saque vai direto para a mochila: as moedas sobem do lugar do abate.
      if (e && r.moedasSaque) this.time.delayedCall(420 + atraso, () => this.numero(nx, ny - 18, `+${r.moedasSaque}`, "moeda"));
      this.oficioSubiu(r.oficioSubiu);
      for (const texto of r.anuncios || []) this.time.delayedCall(320, () => this.mensagem(texto, "anuncio"));
    }
    this.p = Mundo.jogadores[MEU_ID];
    this.time.delayedCall(r.derrotado ? 300 + (r.atrasoVisual || 0) : 0, () => this.criarSaques(true));
    const subiu = this.p.nivel > this.nivelAnterior;
    this.verificarNivel();
    const cumpridas = (r.tarefas || []).filter((t) => t.cumpridaAgora);
    if (cumpridas.length) this.time.delayedCall(subiu ? 1300 : 700, () => this.cartaoCacadaCumprida(cumpridas));
    this.atualizarBaloes();
    window.atualizarInterface?.();
  }
  // Morte: clarão, a criatura se dissipa (fx_morte) e ficam os restos no chão por alguns segundos
  // (fx_restos_p ou fx_restos_g, pelo tamanho do desenho). atraso: ms até o golpe final chegar.
  animarMorte(id, atraso = 0) {
    const ent = this.entidades[id];
    if (!ent) return;
    delete this.entidades[id];
    if (this.hoverId === id) this.hoverId = null;
    const { sprite, sombra, rotulo } = ent;
    ent.alerta?.destroy();
    sprite.auraCampeao?.destroy();
    sprite.disableInteractive();
    const cair = () => {
      rotulo?.destroy();
      if (!sprite.active) return;
      const x = sprite.x, y = sprite.y, reduz = reduzMovimento();
      sprite.setTintFill(0xfff1d0);
      this.time.delayedCall(70, () => sprite.active && sprite.clearTint());
      this.tweens.add({ targets: [sprite, sombra], alpha: 0, delay: 80, duration: 240, onComplete: () => { sprite.destroy(); sombra.destroy(); } });
      this.fx("fx_morte", x, y - Math.max(12, Math.min(24, ent.alturaCabeca * 0.5)), { depth: PROF.entidade + y + 2, escala: ent.grande ? 1.5 : undefined });
      if (!this.chaoFirme(x, y)) return;
      if (!reduz) this.marcaNoChao("fx_poca", x + 2, y - 11, { vida: 9000, apaga: 1800, alpha: 0.9 });
      this.marcaNoChao(ent.grande ? "fx_restos_g" : "fx_restos_p", x, y + 2, { vida: 7500, apaga: 1500, flipX: Arte.hash2(x, y, 3) < 0.5 }).setAlpha(0);
      const marca = this.fxAtivos[this.fxAtivos.length - 1];
      marca.alfa = 0;
      this.tweens.add({ targets: marca, alfa: 1, delay: 260, duration: 220, onUpdate: () => marca.s.active && marca.s.setAlpha(marca.alfa) });
    };
    if (atraso) this.time.delayedCall(atraso, cair); else cair();
  }
  agendarRespawn(id) {
    if (this.respawns.has(id) || inimigos[id]?.masmorra) return; // vaga de masmorra: só a onda a acende de novo
    this.respawns.add(id);
    this.time.delayedCall(TEMPO_RESPAWN_INIMIGO, () => {
      this.respawns.delete(id);
      const e = inimigos[id];
      if (this.areaAtual === e.area && Mundo.reaparecerInimigo(MEU_ID, id)) {
        const ent = this.criarInimigo(e);
        ent.sprite.setAlpha(0); ent.sombra.setAlpha(0);
        this.tweens.add({ targets: [ent.sprite, ent.sombra], alpha: 1, duration: 400 });
        const ficha = Mundo.fichaInimigo(MEU_ID, id);
        if (ficha?.campeao) {
          this.mensagem(`Um campeão surgiu: ${ficha.nome}! Mais forte, rende o triplo de XP e saque reforçado.`, "anuncio");
          Som.saque("raro");
          this.particulasSimples(ent.sprite.x, ent.sprite.y - 12, COR_CAMPEAO, 14, { subir: true, dur: 800, espalha: 16 });
        } else this.mensagem(`${e.nome} reapareceu.`);
        window.atualizarInterface?.();
      }
    });
  }
  selecionarAlvo(id) {
    if (!id) { this.alvoId = null; this.perseguir = false; window.atualizarInterface?.(); return; }
    if (!inimigos[id] || Mundo.obterVidaInimigo(MEU_ID, id) <= 0) return;
    const novo = this.alvoId !== id;
    this.alvoId = id;
    this.rota = null;
    this.perseguir = true; // vai até ficar ao alcance (o movimento manual cancela)
    this.proximoAutoAtaque = Date.now() + INTERVALO_AUTO_ATAQUE;
    this.ultimoAutoAtaque = this.time.now;
    if (novo && !reduzMovimento()) {
      this.anel.setScale(1.3);
      this.tweens.add({ targets: this.anel, scale: 1, duration: 120 });
    }
    window.atualizarInterface?.();
    const alvo = inimigos[id];
    this.mensagem(`${Mundo.nomeInimigo(MEU_ID, id) || alvo.nome} ${alvo.genero === "f" ? "selecionada" : "selecionado"}; autoataque a cada 2 segundos.`);
  }
  // mesmoCheio (pela bolsa): bebe mesmo com a vida ou a fé cheia, para liberar espaço; teclas e atalhos não.
  usarPocao(mesmoCheio = false) {
    const r = Mundo.executar(MEU_ID, { tipo: "usarPocao", mesmoCheio });
    this.mensagem(r.mensagem);
    if (r.ok && r.cura) this.efeitoCura(r.cura);
    window.atualizarInterface?.();
    return r;
  }
  usarPocaoFe(mesmoCheio = false) {
    const r = Mundo.executar(MEU_ID, { tipo: "usarPocaoFe", mesmoCheio });
    this.mensagem(r.mensagem);
    if (r.ok && r.feCurada) { this.numero(this.jogador.x, this.yNumeroJogador(), `+${r.feCurada} fé`, "fe"); this.fxNoJogador("fx_luz_fe"); }
    window.atualizarInterface?.();
    return r;
  }
  efeitoCura(cura) {
    this.numero(this.jogador.x, this.yNumeroJogador(), `+${cura}`, "cura");
    this.fxNoJogador("fx_cura");
  }
  // Onde nascem os números sobre o jogador: logo acima do nome dele.
  yNumeroJogador() {
    return this.jogador.y - this.alturaRotuloJogador() - NUM_ACIMA;
  }
  // Efeito de coluna (cura, luz da fé, veneno) preso ao jogador: a base da tira fica nos pés dele.
  fxNoJogador(chave, opts = {}) {
    return this.fxNoSprite(chave, this.jogador, opts);
  }
  fxNoSprite(chave, s, opts = {}) {
    const def = PIXEL_PATTERNS[chave];
    if (!def || !s?.active) return null;
    const dy = -Math.round(def.h * Arte.PX * 0.5) + 5;
    return this.fx(chave, s.x, s.y + dy, { depth: PROF.entidade + s.y + 40, segue: s, dy, ...opts });
  }
  usarHotkey(i) {
    const id = this.p.hotkeys?.[i];
    if (id === "pocao") return this.usarPocao();
    if (id === "pocao_fe") return this.usarPocaoFe();
    if (id) this.mensagem("Este item não é utilizável no momento.");
  }
  verificarNivel() {
    const p = Mundo.jogadores[MEU_ID];
    if (!p) return;
    if (p.nivel > this.nivelAnterior) {
      const x = this.jogador.x, y = this.jogador.y;
      this.particulasSimples(x, y - 10, "#ffe08a", 16, { subir: true, dur: 1000, espalha: 8 });
      const t = this.add.text(x, y - 56, `NÍVEL ${p.nivel}`, { fontFamily: FONTE_TITULO, fontStyle: "700", fontSize: "20px", color: "#ffe08a", stroke: COR.tinta, strokeThickness: 4, resolution: 2 })
        .setOrigin(0.5, 1).setDepth(PROF.numero);
      this.tweens.add({ targets: t, y: y - 80, alpha: 0, delay: 600, duration: 600, onComplete: () => t.destroy() });
      // Talentos (JGB-21): com vocação, cada nível dá ponto de talento.
      const livres = typeof pontosTalentoLivres === "function" ? pontosTalentoLivres(p) : 0;
      if (livres > 0) {
        const sub = this.add.text(x, y - 54, `+ TALENTO · ${livres} livre${livres > 1 ? "s" : ""} (V)`, { fontFamily: FONTE_PIXEL, fontSize: "11px", color: "#e6cf9c", stroke: COR.tinta, strokeThickness: 3, resolution: 2 })
          .setOrigin(0.5, 0).setDepth(PROF.numero);
        this.tweens.add({ targets: sub, y: y - 78, alpha: 0, delay: 900, duration: 600, onComplete: () => sub.destroy() });
      }
    }
    this.nivelAnterior = p.nivel;
  }

  // Cartão "CAÇADA CUMPRIDA" sobre o jogador, no estilo do "NÍVEL N" (com o nome da caçada embaixo).
  cartaoCacadaCumprida(cumpridas) {
    if (!this.jogador?.active) return;
    const x = this.jogador.x, y = this.jogador.y, reduz = reduzMovimento();
    const titulo = this.add.text(0, 0, "CAÇADA CUMPRIDA", { fontFamily: FONTE_TITULO, fontStyle: "700", fontSize: "18px", color: "#ffe08a", stroke: COR.tinta, strokeThickness: 4, resolution: 2 })
      .setOrigin(0.5, 1);
    const nomes = cumpridas.map((t) => t.nome).join(" · ");
    const sub = this.add.text(0, 2, nomes, { fontFamily: FONTE_PIXEL, fontSize: "11px", color: "#e6cf9c", stroke: COR.tinta, strokeThickness: 3, resolution: 2 })
      .setOrigin(0.5, 0);
    const c = this.add.container(x, y - 60, [titulo, sub]).setDepth(PROF.numero);
    if (reduz) {
      this.time.delayedCall(1800, () => c.destroy());
      return;
    }
    this.particulasSimples(x, y - 10, "#ffe08a", 16, { subir: true, dur: 1000, espalha: 8 });
    this.tweens.add({ targets: c, y: y - 84, alpha: 0, delay: 1200, duration: 600, onComplete: () => c.destroy() });
  }

  // Devolve true se o passo aconteceu (o joystick analógico tenta outro passo quando não acontece).
  // intervalo: tempo real até o próximo passo (quem chama marca this.proximoPasso com o mesmo valor).
  // Ms por casa do jogador, pelo nível (a velocidade sobe aos poucos a cada nível).
  passoReto() { return velocidadeDoJogador(this.p).reto; }
  passoDiagonal() { return velocidadeDoJogador(this.p).diagonal; }
  mover(dx, dy, intervalo = this.passoReto()) {
    if (this.trocando) return false;
    // Cais com barqueiro: antes de embarcar, a janela dele mostra o preço da passagem e pede confirmação.
    const a = areas[this.areaAtual];
    if (a?.cais && this.p.x + dx === a.cais.x && this.p.y + dy === a.cais.y) {
      const barqueiro = Object.values(npcs).find((n) => n.area === this.areaAtual && n.papel === "barqueiro");
      if (barqueiro && window.UI?.abrirBarco) {
        this.pararRota();
        const ent = this.entidades[barqueiro.id];
        if (ent) { ent.acaoAte = this.time.now + 400; ent.falando = true; virar(ent.sprite, this.p.x - barqueiro.x, this.p.y - barqueiro.y); }
        window.UI.abrirBarco(barqueiro.id);
        return false;
      }
    }
    const r = Mundo.executar(MEU_ID, { tipo: "mover", dx, dy });
    if (!r.ok) return false;
    if (r.areaAlterada) { this.trocarArea(r.mensagem); return true; }
    this.p = Mundo.jogadores[MEU_ID];
    // Pilha de saque (o que não coube na mochila no abate): a lógica recolhe tudo o que couber.
    const coletados = r.itensColetados || (r.itemColetado ? [r.itemColetado] : []);
    if (coletados.length) {
      if (r.moedas) this.numero(centroX(this.p.x), this.p.y * TAM + 8, `+${r.moedas}`, "moeda");
      for (const id of coletados) {
        this.spritesItens[id]?.destroy();
        delete this.spritesItens[id];
      }
      this.mensagem(r.mensagem, "saque");
      this.atualizarBaloes();
    } else if (r.mensagem) this.mensagem(r.mensagem);
    this.oficioSubiu(r.oficioSubiu);
    // no mar o barco também vira: com 3 vistas (def.direcoes) mostra proa, popa ou o lado; sem elas, só espelha
    virar(this.jogador, dx, dy);
    const nx = centroX(this.p.x), ny = baseY(this.p.y) + (this.areaAtual === "mar" ? 6 : 0);
    const agora = this.time.now, dur = intervalo + folgaDeQuadro(this);
    iniciarDeslize(this.estadoJogador.desl, nx, ny, agora, dur);
    this.estadoJogador.andandoAte = agora + dur;
    // poeira do passo, atrás dos pés, a cada 2 casas (fora de casa e da água)
    if (this.estadoJogador.desl.n % 2 === 0 && this.areaAtual !== "mar" && !this.predios.some((pr) => pr.dentro)) this.poeira(this.jogador, dx, dy, 0.7);
    if (this.areaAtual === "mar" && !reduzMovimento()) this.particulasSimples(this.jogador.x - dx * 20, this.jogador.y - 4, "#e8f2e0", 2, { espalha: 6, dur: 500 });
    window.atualizarInterface?.();
    return true;
  }
  trocarArea(mensagem) {
    this.trocando = true;
    this.registry.set("trocaPedidaEm", performance.now());
    this.registry.set("mensagemPendente", mensagem || null);
    const cam = this.cameras.main;
    cam.once("camerafadeoutcomplete", () => this.scene.restart());
    cam.fadeOut(220, 28, 18, 16);
  }

  // Executa um comando vindo da UI, com os efeitos visuais do resultado.
  executarComando(comando) {
    if (!comando) return { ok: false };
    if (comando.tipo === "mover") { this.mover(comando.dx, comando.dy); return { ok: true }; }
    if (comando.tipo === "interagir") return this.interagir(comando.alvoId);
    if (comando.tipo === "atacar") return this.atacarAlvo(false);
    if (comando.tipo === "atacarDistancia") return this.atacarAlvo(true);
    if (comando.tipo === "pescar") { this.pescar(); return { ok: true }; }
    if (comando.tipo === "usarPocao") return this.usarPocao(comando.mesmoCheio === true);
    if (comando.tipo === "usarPocaoFe") return this.usarPocaoFe(comando.mesmoCheio === true);
    if (comando.tipo === "usarHabilidade") return this.usarHabilidade(comando.habilidade, comando.alvoId);
    const r = Mundo.executar(MEU_ID, comando);
    if (r.mensagem) this.mensagem(r.mensagem);
    if (r.areaAlterada) {
      if (r.eventos?.length) this.registry.set("eventosPendentes", r.eventos);
      this.trocarArea(null);
      return r;
    }
    if (comando.tipo === "comerMana" && r.ok && r.cura) this.efeitoCura(r.cura);
    this.oficioSubiu(r.oficioSubiu);
    if (comando.tipo === "orar" && r.ok) {
      if (r.cura) this.efeitoCura(r.cura);
      this.fxNoJogador("fx_luz_fe", { atraso: r.cura ? 180 : 0 });
      if (comando.acao === "milagre" && !reduzMovimento()) this.cameras.main.flash(300, 255, 224, 138);
    }
    this.p = Mundo.jogadores[MEU_ID];
    this.atualizarVisualJogador();
    this.atualizarBaloes(); // aceitar, guardar e trocar: o "!" do atalaia vira o balão de contagem
    window.atualizarInterface?.();
    return r;
  }

  // ===== laço =========================================================
  update(time) {
    if (!this.jogador) return;
    const agora = Date.now();
    if (time >= this.proximoDesenhoMinimapa) {
      this.proximoDesenhoMinimapa = time + 100; // acompanha o deslize do jogador
      this.desenharMinimapa();
    }
    if (time >= this.proximoMinimapa) {
      this.proximoMinimapa = time + 250;
      this.p = Mundo.jogadores[MEU_ID] || this.p;
      this.atualizarMapaSobre();
      Arte.animarAgua(this, this.areaAtual, time / 250);
      this.atualizarVisualJogador();
    }
    if (time >= this.proximaAtualizacaoPesca) {
      this.proximaAtualizacaoPesca = time + 500;
      if (this.pesca) for (const { ponto, s } of this.pesca) s.setData("esgotado", !Mundo.pescaDisponivel(MEU_ID, ponto.id));
    }
    if (time >= this.proximoBalao) {
      this.proximoBalao = time + 500;
      this.atualizarBaloes();
      this.atualizarPortais(); // também cobre conclusões vindas de fora do diálogo
    }

    if (!this.trocando) this.lerTeclas(time, agora);
    if (this.trocando) return;

    const ev = Mundo.atualizar(MEU_ID, agora);
    for (const x of ev) {
      if (x.tipo === "inimigoMoveu") this.moverInimigo(x.id);
      else if (x.tipo === "jogadorAtingido") this.jogadorAtingido(x);
      else if (x.tipo === "veneno") this.mensagem(x.mensagem, "perigo");
      else if (x.tipo === "venenoTerminou" || x.tipo === "sangramentoTerminou") this.mensagem(x.mensagem);
      else if (x.tipo === "manaEstragou") this.mensagem(x.mensagem);
      else if (x.tipo === "sangramento") this.mensagem(x.mensagem, "perigo");
      else if (x.tipo === "atordoado") this.jogadorAtordoado(x);
      else if (x.tipo === "medo") this.jogadorComMedo(x);
      else if (x.tipo === "medoTerminou") this.mensagem(x.mensagem);
      else if (x.tipo === "statusInimigo") this.statusNaCriatura(x);
      else if (x.tipo === "inimigoDerrotado") { this.mensagem(x.mensagem, "combate"); this.aposAtaque(x); }
      else if (x.tipo === "aliadoAtacou") this.numeroNoInimigo(x.inimigoId, `−${x.dano}`, "dano");
      else if (x.tipo === "iscaAtingida") this.numeroNoAliado(x.aliadoId, `−${x.dano}`);
      else if (x.tipo === "curaBuff") this.numero(this.jogador.x, this.yNumeroJogador(), `+${x.cura}`, "cura");
      else if (x.tipo === "furia" || x.tipo === "fuga" || x.tipo === "investidaPreparo" || x.tipo === "investidaErrou" || x.tipo === "retorno") this.comportamentoInimigo(x);
      else if (x.tipo === "cura") this.curaInimiga(x);
      else if (x.tipo === "explosao") this.explosao(x);
      else if (x.tipo === "nomeadoApareceu" || x.tipo === "nomeadoSumiu") this.eventoNomeado(x);
      else if (/^(masmorra|perigo)/.test(x.tipo)) this.eventoMasmorra(x);
      else if (x.tipo === "saqueExpirou") for (const id of x.ids || []) { this.spritesItens[id]?.destroy(); delete this.spritesItens[id]; }
      else if (x.tipo === "renasceu") {
        this.alvoId = null;
        this.trocando = true;
        this.registry.set("mensagemPendente", x.mensagem);
        this.registry.set("ultimaArea", "canaan"); // na morte, só fade (sem cartão)
        const cam = this.cameras.main;
        cam.once("camerafadeoutcomplete", () => this.scene.restart());
        cam.fadeOut(300, 28, 18, 16);
        return;
      }
    }
    if (ev.length) window.atualizarInterface?.();
    this.sincronizarAliados(time);

    this.animar(time);
  }

  lerTeclas(time, agora) {
    const JD = Phaser.Input.Keyboard.JustDown, t = this.teclas;
    if (JD(t.f)) this.acaoContextual();
    if (JD(t.space)) this.atacarAlvo(false);
    if (JD(t.r)) this.atacarAlvo(true);
    if (JD(t.h)) this.usarPocao();
    if (JD(t.p)) this.pescar();
    if (JD(t.i)) document.body.classList.toggle("hideBags");
    if (this.alvoId && agora >= this.proximoAutoAtaque) {
      this.proximoAutoAtaque = agora + INTERVALO_AUTO_ATAQUE;
      this.autoAtacar();
    }
    if (time < this.proximoPasso || this.trocando) return;
    let dx = 0, dy = 0;
    if (t.a.isDown || t.left.isDown) dx = -1;
    else if (t.d.isDown || t.right.isDown) dx = 1;
    if (t.w.isDown || t.up.isDown) dy = -1;
    else if (t.s.isDown || t.down.isDown) dy = 1;
    if (t.q.isDown) { dx = -1; dy = -1; } else if (t.e.isDown) { dx = 1; dy = -1; } else if (t.z.isDown) { dx = -1; dy = 1; } else if (t.c.isDown) { dx = 1; dy = 1; }
    const ent = window.Jogo?.entrada;
    const manual = dx || dy || (ent && (ent.dx || ent.dy));
    // Movimento manual (teclado ou joystick) cancela a rota e a perseguição.
    if (manual && (this.rota || this.perseguir)) this.pararRota(true);
    if (!dx && !dy && ent?.analogico) return this.passoAnalogico(time, ent);
    this.desvioJoystick = 0;
    if (!dx && !dy && ent) { dx = Math.sign(ent.dx || 0); dy = Math.sign(ent.dy || 0); }
    if (dx || dy) {
      this.proximoPasso = Math.max(time, this.proximoPasso) + this.passoReto();
      this.mover(dx, dy, this.passoReto());
      return;
    }
    if (this.rota) return this.passoDaRota(time);
    if (this.perseguir && this.alvoId) this.passoDePerseguicao(time);
  }

  // ===== andar por toque/clique ========================================
  // Rota pela grade em 8 direções (busca em largura), só por casas livres (Mundo.casaLivre). Casas de
  // transição (cais, trilha, portal) só entram como destino, para a rota não trocar de área no meio.
  // objetivo(x, y): a casa serve de chegada? Devolve a lista de passos [dx, dy] ou null (sem caminho).
  calcularRota(objetivo, limite = 4000) {
    const p = this.p;
    if (objetivo(p.x, p.y)) return [];
    const transicao = this.casasDeTransicao();
    const chave = (x, y) => y * COLS + x;
    const veio = new Map([[chave(p.x, p.y), null]]);
    const fila = [[p.x, p.y]];
    for (let i = 0; i < fila.length && veio.size < limite; i++) {
      const [x, y] = fila[i];
      for (const [dx, dy] of DIRECOES_8) {
        const nx = x + dx, ny = y + dy, k = chave(nx, ny);
        if (veio.has(k) || !Mundo.casaLivre(nx, ny, p, true)) continue;
        const chega = objetivo(nx, ny);
        if (transicao.has(k) && !chega) continue;
        veio.set(k, [x, y, dx, dy]);
        if (chega) {
          const passos = [];
          for (let c = veio.get(k); c; c = veio.get(chave(c[0], c[1]))) passos.unshift([c[2], c[3]]);
          return passos;
        }
        fila.push([nx, ny]);
      }
    }
    return null;
  }
  casasDeTransicao() {
    if (this._transicao?.area === this.areaAtual) return this._transicao.casas;
    const a = areas[this.areaAtual] || {}, casas = new Set(), add = (c) => c && casas.add(c.y * COLS + c.x);
    add(a.passagem); add(a.cais);
    for (const c of Object.values(a.portos || {})) add(c.cais);
    for (const t of PORTAIS) if (t.area === this.areaAtual) add(t);
    this._transicao = { area: this.areaAtual, casas };
    return casas;
  }
  // Começa uma rota; ao chegar, chama fim(). Sem caminho, avisa.
  iniciarRota(objetivo, fim, destino) {
    const passos = this.calcularRota(objetivo);
    if (!passos) { this.mensagem("Não há caminho até lá."); return false; }
    this.perseguir = false;
    this.rota = { passos, objetivo, fim, destino };
    this.marcarDestino(destino);
    if (!passos.length) this.concluirRota();
    return true;
  }
  passoDaRota(time) {
    const r = this.rota;
    if (!r.passos.length) return this.concluirRota();
    const [dx, dy] = r.passos[0];
    const dur = dx && dy ? this.passoDiagonal() : this.passoReto();
    if (this.mover(dx, dy, dur)) {
      r.passos.shift();
      this.proximoPasso = Math.max(time, this.proximoPasso) + dur;
      if (this.trocando) { this.rota = null; return; }
      if (!r.passos.length) this.concluirRota();
      return;
    }
    // Algo entrou no caminho (uma criatura andou): refaz a rota uma vez a cada bloqueio (a rota longa, do
    // clique no chão ou no minimapa, refaz pelo A* até o mesmo destino).
    let nova;
    if (r.longa) {
      const nr = this.rotaAte(r.longa.x, r.longa.y);
      nova = nr?.passos;
      if (nr?.passos.length) { r.destino = nr.chegada; r.objetivo = (cx, cy) => cx === nr.chegada.x && cy === nr.chegada.y; this.marcarDestino(nr.chegada); }
    } else nova = this.calcularRota(r.objetivo);
    if (!nova || !nova.length) { this.pararRota(); return; }
    r.passos = nova;
    this.proximoPasso = time + this.passoReto();
  }
  concluirRota() {
    const r = this.rota;
    this.pararRota();
    r?.fim?.();
  }
  pararRota(manual = false) {
    this.rota = null;
    if (manual) this.perseguir = false;
    if (this.marcaDestino) this.marcaDestino.setVisible(false);
  }
  marcarDestino(c) {
    if (!c) return;
    if (!this.marcaDestino) {
      this.marcaDestino = this.add.graphics().setDepth(PROF.marcadorChao);
      this.marcaDestino.lineStyle(2, 0xf2d27a, 0.9).strokeRect(-11, -11, 22, 22).lineStyle(2, 0x2a1a14, 0.6).strokeRect(-13, -13, 26, 26);
    }
    this.marcaDestino.setPosition(centroX(c.x), c.y * TAM + TAM / 2).setVisible(true).setAlpha(1);
  }
  // Rota longa até (x, y) pelo A* (rotaNaGrade, logica.js), sobre a grade de passagem da área montada de
  // uma vez: serve para qualquer distância (o mapa inteiro tem 160 × 120 casas e a busca leva poucos ms).
  // Casas de transição (cais, trilha, portal) só entram como destino. Destino bloqueado ou fora de alcance:
  // a casa alcançável mais perto dele.
  rotaAte(x, y) {
    const grade = Mundo.gradeDePassagem(this.p), transicao = this.casasDeTransicao(), alvo = y * COLS + x;
    return rotaNaGrade((cx, cy) => {
      const k = cy * COLS + cx;
      return grade[k] === 1 && (k === alvo || !transicao.has(k));
    }, this.p, { x, y });
  }
  // Destinos do toque: casa do chão (ou a mais perto dela que dá para alcançar), NPC (fala ao chegar),
  // saque (recolhe ao pisar) e ponto de pesca (pesca ao chegar). O clique no minimapa também chega aqui.
  // Um clique novo troca a rota; andar com as teclas ou o joystick cancela.
  irAteCasa(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS || (x === this.p.x && y === this.p.y)) return false;
    const r = this.rotaAte(x, y);
    this.perseguir = false;
    if (!r || !r.passos.length) { this.pararRota(); return false; }
    this.rota = { passos: r.passos, objetivo: (cx, cy) => cx === r.chegada.x && cy === r.chegada.y, fim: null, destino: r.chegada, longa: { x, y } };
    this.marcarDestino(r.chegada);
    window.atualizarInterface?.();
    return true;
  }
  irAteNpc(id) {
    const n = npcs[id];
    if (!n) return;
    const alcance = n.alcance || 1; // atrás do balcão, conversa-se por cima dele
    if (cheb(this.p, n) <= alcance) { this.pararRota(); this.interagir(id); return; }
    this.iniciarRota((x, y) => cheb({ x, y }, n) <= alcance && (alcance === 1 || this.linhaLivre(x, y, n)), () => this.interagir(id), n);
  }
  // Do outro lado do balcão: entre a casa e o NPC só há o balcão (nenhuma parede).
  linhaLivre(x, y, n) {
    const piso = pisos[this.areaAtual];
    const mx = Math.round((x + n.x) / 2), my = Math.round((y + n.y) / 2);
    return piso[my]?.[mx] !== PISO.PAREDE && piso[y]?.[x] !== PISO.PAREDE;
  }
  irAteSaque(id) {
    const s = this.p.saqueNoChao.find((x) => x.id === id);
    if (!s) return;
    if (cheb(this.p, s) <= 1) { this.pararRota(); this.pegarSaque(id); return; }
    this.iniciarRota((x, y) => x === s.x && y === s.y, null, s);
  }
  irAtePesca(ponto) {
    if (cheb(this.p, ponto) <= 1) { this.pararRota(); this.pescar(); return; }
    this.iniciarRota((x, y) => cheb({ x, y }, ponto) <= 1, () => this.pescar(), ponto);
  }
  // O alvo está ao alcance do ataque que o autoataque usaria (arco com flechas ou funda e caminho livre, ou
  // ao lado)?
  alcancaAlvo(e) {
    return atiraDaqui(this.p) ? Mundo.linhaDeTiroLivre(this.p, e) : cheb(this.p, e) <= 1;
  }
  // Persegue o alvo um passo por vez (a criatura anda: a rota é refeita a cada passo). Ao chegar,
  // o autoataque sai na hora.
  passoDePerseguicao(time) {
    const e = inimigos[this.alvoId];
    if (!e || e.area !== this.areaAtual || Mundo.obterVidaInimigo(MEU_ID, e.id) <= 0) { this.perseguir = false; return; }
    if (this.alcancaAlvo(e)) {
      if (!this.chegouAoAlvo) this.proximoAutoAtaque = Math.min(this.proximoAutoAtaque, Date.now());
      this.chegouAoAlvo = true;
      return;
    }
    this.chegouAoAlvo = false;
    const objetivo = atiraDaqui(this.p)
      ? (x, y) => Mundo.linhaDeTiroLivre({ x, y, area: this.areaAtual }, e)
      : (x, y) => cheb({ x, y }, e) <= 1;
    const passos = this.calcularRota(objetivo, 2500);
    if (!passos) { this.perseguir = false; this.mensagem("Não há caminho até o alvo."); return; }
    if (!passos.length) return;
    const [dx, dy] = passos[0];
    const dur = dx && dy ? this.passoDiagonal() : this.passoReto();
    if (this.mover(dx, dy, dur)) this.proximoPasso = Math.max(time, this.proximoPasso) + dur;
    else this.proximoPasso = time + this.passoReto();
  }

  // Joystick analógico em 360°: o mapa é em casas, então cada passo é um dos 2 vizinhos da grade em volta
  // do ângulo (reto ou diagonal). O desvio acumulado (distância do caminho feito até a linha do dedo)
  // escolhe qual: a 20°, por exemplo, sai "reto, diagonal, reto, reto, diagonal…" e o trajeto segue a
  // linha. Bloqueado, tenta o outro vizinho e depois os passos que ainda avançam (desliza na quina).
  // A velocidade ao longo da linha é constante: o passo diagonal (1,41 casa) demora um pouco mais.
  passoAnalogico(time, ent) {
    const mag = Math.hypot(ent.dx, ent.dy);
    if (mag < 0.001) { this.desvioJoystick = 0; return; }
    const ux = ent.dx / mag, uy = ent.dy / mag;
    const ang = Math.atan2(uy, ux);
    // Mudou bastante de direção: começa uma linha nova.
    if (this.anguloJoystick === undefined || Math.abs(Math.atan2(Math.sin(ang - this.anguloJoystick), Math.cos(ang - this.anguloJoystick))) > 0.3) this.desvioJoystick = 0;
    this.anguloJoystick = ang;
    const setor = Math.floor(ang / (Math.PI / 4));
    const a = DIRECOES_8[((setor % 8) + 8) % 8], b = DIRECOES_8[(((setor + 1) % 8) + 8) % 8];
    const cruz = (d) => d[0] * uy - d[1] * ux; // desvio lateral que o passo acrescenta
    const desvio = this.desvioJoystick || 0;
    const ordem = Math.abs(desvio + cruz(a)) <= Math.abs(desvio + cruz(b)) ? [a, b] : [b, a];
    const avanco = (d) => d[0] * ux + d[1] * uy;
    // Contra a parede: primeiro os eixos do dedo (a 10° num muro vertical, desliza para baixo, do lado
    // em que o dedo está), depois o que ainda avança.
    const eixos = [[Math.sign(ux), 0], [0, Math.sign(uy)]].filter((d) => d[0] || d[1]).sort((p, q) => avanco(q) - avanco(p));
    const tentativas = [...ordem];
    for (const d of [...eixos, ...DIRECOES_8.filter((d) => avanco(d) > 0.2).sort((p, q) => avanco(q) - avanco(p))]) {
      if (!tentativas.some((t) => t[0] === d[0] && t[1] === d[1])) tentativas.push(d);
    }
    for (const d of tentativas) {
      const dur = Math.round(this.passoReto() * Math.min(1.3, Math.max(1, avanco(d))));
      if (!this.mover(d[0], d[1], dur)) continue;
      // Um passo de desvio (bloqueio) não entra na conta: a linha recomeça de onde o jogador está.
      this.desvioJoystick = ordem.includes(d) ? desvio + cruz(d) : 0;
      this.proximoPasso = Math.max(time, this.proximoPasso) + dur;
      return;
    }
    this.proximoPasso = time + this.passoReto(); // tudo bloqueado: tenta de novo no próximo passo
  }

  // A criatura mudou de casa na lógica: desliza até lá no tempo de um passo dela. Esse tempo é o medido
  // entre dois passos seguidos da mesma criatura (cobre fuga e campeão rápido), de 250 a 700 ms e nunca
  // acima do intervalo dos dados da criatura (600 se não houver), que também vale no primeiro passo. durFixa: empurrão de habilidade.
  moverInimigo(id, durFixa = 0) {
    const ent = this.entidades[id], e = inimigos[id];
    if (!ent || !e) return;
    const cx = ent.desl.casaX, cy = ent.desl.casaY;
    this.deslizarAte(ent.desl, ent.sprite, e.x, e.y, durFixa);
    ent.andandoAte = ent.desl.passo ? ent.desl.passo.t0 + ent.desl.passo.dur : 0;
    // criatura grande levanta poeira a cada passo
    if (ent.grande && ent.desl.passo && cx != null && this.cameras.main.worldView.contains(ent.sprite.x, ent.sprite.y)) this.poeira(ent.sprite, Math.sign(e.x - cx), Math.sign(e.y - cy), 0.8);
  }
  // Poeira do passo (fx_poeira) atrás dos pés de quem anda na direção (dx, dy), na cor do chão da região.
  poeira(s, dx, dy, alpha = 0.7) {
    if (reduzMovimento() || (!dx && !dy) || !this.chaoFirme(s.x, s.y)) return;
    if (this.corPoeira === undefined) this.corPoeira = hexNum(Arte.motor.misturar(this.bio.caminho?.claro || this.bio.chao.claro, "#ffffff", 0.45));
    this.fx("fx_poeira", s.x - dx * 9, s.y - 11 - dy * 5, { depth: PROF.entidade + s.y - 3 - (dy < 0 ? 0 : 6), flipX: dx < 0, alpha, tint: this.corPoeira });
  }
  // Passo de criatura ou aliado até a casa (cx, cy), virando o sprite pelo passo da grade (e não pela
  // posição do sprite, que ainda pode estar a caminho da casa anterior).
  deslizarAte(st, sprite, cx, cy, durFixa = 0) {
    const agora = this.time.now, L = PASSO_CRIATURA_MS;
    const dcx = cx - (st.casaX ?? cx), dcy = cy - (st.casaY ?? cy);
    st.casaX = cx; st.casaY = cy;
    const nx = centroX(cx), ny = baseY(cy);
    if (Math.max(Math.abs(dcx), Math.abs(dcy)) > 3) { st.passo = null; st.x = nx; st.y = ny; return; } // reapareceu longe: sem deslizar
    if (!dcx && !dcy && !st.passo && st.x === nx && st.y === ny) return;
    if (dcx || dcy) virar(sprite, dcx, dcy);
    // só passos seguidos entram na medida: a pausa de quem vagueia não alonga o deslize seguinte
    const desde = agora - st.ultimoInicio;
    const teto = st.durTeto || L.maximo; // o intervalo dos dados: modificadores só encurtam o passo
    if (desde <= (st.durMedida || st.durTeto || L.padrao) * 1.25) st.durMedida = Math.max(L.minimo, Math.min(teto, desde));
    const dur = durFixa || (st.durMedida || st.durTeto || L.padrao) + folgaDeQuadro(this);
    iniciarDeslize(st, nx, ny, agora, dur);
  }

  // A criatura acertou o jogador. O golpe dela também tem 2 tempos (antecipação e bote, com investida curta),
  // e o número, o arranhão, o respingo e o recuo do jogador saem no tempo do bote ou da chegada do projétil.
  jogadorAtingido(x) {
    const j = this.jogador, reduz = reduzMovimento(), alt = this.alturaJogador;
    if (x.sangramento) {
      this.numero(j.x, this.yNumeroJogador(), `−${x.dano}`, "recebido");
      this.sangrar(j.x, j.y, alt, 1, 0.5);
      return;
    }
    const atacante = x.inimigoId && this.entidades[x.inimigoId];
    if (atacante?.alerta) { atacante.alerta.destroy(); atacante.alerta = null; }
    if (x.veneno) {
      this.numero(j.x, this.yNumeroJogador(), `−${x.dano}`, "veneno");
      j.setTint(0xa8c84a);
      this.time.delayedCall(120, () => j.active && j.clearTint());
      if (!reduz) this.fxNoSprite("fx_veneno", j, { dy: -alt * 0.45, alpha: 0.95 });
      return;
    }
    this.mensagem(x.mensagem, "combate");
    const ent = this.entidades[x.inimigoId], e = inimigos[x.inimigoId], agora = this.time.now;
    let atraso = 0, ux = 0, uy = 0;
    if (ent && e) {
      const s = ent.sprite, d = Math.hypot(j.x - s.x, j.y - s.y) || 1;
      ux = (j.x - s.x) / d; uy = (j.y - s.y) / d;
      ent.acaoAte = agora + GOLPE.total; ent.falando = false;
      virar(s, this.p.x - e.x, this.p.y - e.y);
      if (x.distancia) atraso = reduz ? 0 : GOLPE.antecipa + this.projetil(x.inimigoId, x.projetil, GOLPE.antecipa);
      else {
        atraso = GOLPE.antecipa;
        if (!reduz) ent.desl.golpe = { dx: ux, dy: uy, t0: agora, ...GOLPE };
        // golpe corpo a corpo com o deslize ainda a caminho da casa vizinha: o resto do passo vira um bote curto
        const ps = ent.desl.passo;
        if (ps && ps.t0 + ps.dur - agora > 100) {
          const ult = ent.desl.ultimoInicio;
          iniciarDeslize(ent.desl, ps.x1, ps.y1, agora, 100, true);
          ent.desl.ultimoInicio = ult; ent.desl.n--;
        }
      }
    }
    const acerto = () => {
      if (!j.active || this.trocando) return;
      this.numero(j.x, this.yNumeroJogador(), `−${x.dano}`, "recebido");
      // BLOQ só aparece quando o escudo segurou tanto quanto passou (ou mais), e entra na pilha dos números
      if (x.defesaBloqueada > 0 && x.defesaBloqueada >= x.dano) this.time.delayedCall(140, () => j.active && this.numero(j.x, this.yNumeroJogador(), `BLOQ ${x.defesaBloqueada}`, "bloqueio"));
      j.setTint(0xffa48c);
      this.time.delayedCall(100, () => j.active && j.clearTint());
      this.pulsoVinheta(0.35, 150);
      if (x.investida && !reduz) this.cameras.main.shake(120, 0.004);
      const meio = j.y - alt * 0.5;
      if (ent && !x.distancia) this.corte(j.x - ux * 22, meio - uy * 12, ux, uy, j.y, { tint: 0xffd0c0, alpha: 0.95 });
      else this.fx("fx_faisca", j.x, meio, { depth: PROF.entidade + j.y + 30 });
      if (x.dano > 0) this.sangrar(j.x, j.y, alt, ux || 1, x.investida ? 1 : 0.3);
      if ((ux || uy) && !reduz) Object.assign(this.estadoJogador.desl, { recuoX: Math.round(ux * 2), recuoY: Math.round(uy * 2), recuoAte: this.time.now + 90 });
    };
    if (atraso) this.time.delayedCall(atraso, acerto); else acerto();
  }

  // Flecha, pedra ou feitiço voando da criatura até o jogador (3 desenhos espelhados para as 8 direções).
  // Sai depois de `espera` ms (o tempo da antecipação) e devolve a duração do voo.
  projetil(inimigoId, tipo, espera = 0) {
    const ent = this.entidades[inimigoId];
    if (!ent || reduzMovimento()) return 0;
    const chave = tipo === "magia" ? "fx_orbe" : tipo === "pedra" ? "fx_pedra" : "fx_flecha";
    const s = ent.sprite, j = this.jogador;
    const y0 = s.y - Math.round(ent.alturaCabeca * 0.55), y1 = () => j.y - Math.round(this.alturaJogador * 0.5);
    const voo = Math.max(90, Math.min(260, Math.hypot(j.x - s.x, y1() - y0) / 0.55));
    const soltar = () => {
      if (!s.active || !j.active) return;
      this.voar(chave, s.x, y0, j.x, y1(), () => { if (tipo === "magia" && j.active) this.fx("fx_impacto", j.x, y1(), { depth: PROF.entidade + j.y + 30, tint: 0xbfe0ff }); });
    };
    if (espera) this.time.delayedCall(espera, soltar); else soltar();
    return voo;
  }

  // Medo (JGB-16): aviso e "MEDO" sobre o jogador (sem prender: ele pode recuar).
  jogadorComMedo(x) {
    this.mensagem(x.mensagem, "perigo");
    this.numero(this.jogador.x, this.yNumeroJogador(), "MEDO", "bloqueio");
    if (reduzMovimento()) return;
    this.jogador.setTint(0xb9a2d6);
    this.time.delayedCall(Math.max(300, x.ate - Date.now()), () => this.jogador.active && this.jogador.clearTint());
  }

  // Tique de status numa criatura (veneno, sangramento): número com a cor do status sobre ela.
  statusNaCriatura(x) {
    const e = inimigos[x.inimigoId];
    const ent = this.entidades[x.inimigoId];
    if (!e || !ent?.sprite?.active) return;
    const s = ent.sprite, veneno = x.status === "veneno";
    this.numero(s.x, s.y - ent.alturaCabeca - NUM_ACIMA, `−${x.dano}`, veneno ? "veneno" : "recebido");
    if (reduzMovimento()) return;
    if (veneno) this.fxNoSprite("fx_veneno", s, { dy: -Math.round(ent.alturaCabeca * 0.45) });
    else this.sangrar(s.x, s.y, ent.alturaCabeca, 1, 0.25);
  }

  // ===== vocações (JGB-20) ============================================
  // Usa a habilidade (pelo id) no alvo escolhido (ou no mais perto) e mostra os efeitos.
  usarHabilidade(habilidade, alvoId) {
    const def = typeof HABILIDADES_VOCACAO !== "undefined" ? HABILIDADES_VOCACAO[habilidade] : null;
    const alvo = alvoId || (def?.alvo === "inimigo" ? this.alvoId : null) || undefined;
    const r = Mundo.executar(MEU_ID, { tipo: "usarHabilidade", habilidade, alvoId: alvo });
    if (!r.ok) {
      if (r.mensagem) this.mensagem(r.mensagem);
      return r;
    }
    this.p = Mundo.jogadores[MEU_ID];
    if (r.movimento) {
      iniciarDeslize(this.estadoJogador.desl, centroX(this.p.x), baseY(this.p.y) + (this.areaAtual === "mar" ? 6 : 0), this.time.now, 160, true); // Cubic.easeOut
      this.fx("fx_poeira", this.jogador.x, this.jogador.y - 11, { depth: PROF.entidade + this.jogador.y - 3, alpha: 0.8 });
    }
    // efeito da habilidade: golpe (arco e impacto), projétil, luz da fé ou fogo na casa de cada atingido
    const tipoDano = def?.dano?.tipo, deFogo = tipoDano === "magia" && /chama|raio|carro|fogo/.test(def?.icone || "");
    const j = this.jogador, yMao = j.y - this.alturaJogador * 0.5, reduz = reduzMovimento();
    if (def?.dano && this.areaAtual !== "mar") {
      this.estadoJogador.acaoAte = this.time.now + GOLPE.total;
      if (def.alvo === "si" && def.dano.area && !reduz) for (const [dx, dy] of DIRECOES_8) this.fx("fx_poeira", j.x + dx * 20, j.y - 11 + dy * 12, { depth: PROF.entidade + j.y + dy * 12 - 3, flipX: dx < 0, alpha: 0.8, atraso: 40 });
      if (def.alvo === "si" && tipoDano === "magia") this.fxNoJogador("fx_luz_fe");
    }
    (r.alvos || []).forEach((l, i) => {
      const ent = this.entidades[l.inimigoId];
      if (!ent?.sprite?.active || !l.dano) return;
      const s = ent.sprite, meio = s.y - ent.alturaCabeca * 0.5, prof = PROF.entidade + s.y + 30;
      const d = Math.hypot(s.x - j.x, s.y - j.y) || 1, ux = (s.x - j.x) / d, uy = (s.y - j.y) / d;
      if (deFogo) this.fx("fx_fogo", s.x, s.y - 18, { depth: prof, quadros: 8, ms: 70, apaga: 200, atraso: i * 40 });
      else if (tipoDano === "magia") this.fxNoSprite("fx_luz_fe", s, { atraso: i * 40 });
      else if (tipoDano === "distancia" && !reduz) this.voar("fx_pedra", j.x + ux * 10, yMao, s.x, meio, () => this.fx("fx_impacto", s.x, meio, { depth: prof }));
      else {
        if (i === 0 && def?.alvo === "inimigo") { virar(j, s.x - j.x, s.y - j.y); this.corte(j.x, yMao, ux, uy, Math.max(j.y, s.y)); }
        this.fx("fx_impacto", s.x, meio, { depth: prof, atraso: i * 30 });
      }
      this.sangrar(s.x, s.y, ent.alturaCabeca, ux, 0.25);
    });
    for (const l of r.alvos || []) {
      const e = inimigos[l.inimigoId];
      if (!e) continue;
      if (l.repelido) this.moverInimigo(l.inimigoId, 180);
      if (l.dano) this.numeroNoInimigo(l.inimigoId, l.critico ? `${l.dano}!` : `${l.dano}`, l.critico ? "critico" : "dano");
      if (l.status) this.time.delayedCall(200, () => this.numeroNoInimigo(l.inimigoId, STATUS_CRIATURAS[l.status].nome.toUpperCase(), "bloqueio"));
      const ent = this.entidades[l.inimigoId];
      if (ent?.sprite?.active && l.dano) { ent.sprite.setTintFill(0xffffff); this.time.delayedCall(70, () => ent.sprite.active && ent.sprite.clearTint()); }
      if (!this.alvoId && !l.derrotado && def?.alvo === "inimigo") this.alvoId = l.inimigoId;
    }
    if (r.cura) this.efeitoCura(r.cura);
    if (r.buff && !r.cura) this.fxNoJogador("fx_luz_fe");
    this.mensagem(r.mensagem, "combate");
    for (const m of r.mortes || []) this.aposAtaque({ ...m, derrotado: true });
    if (!(r.mortes || []).length) window.atualizarInterface?.();
    return r;
  }
  // Barra de habilidades: a habilidade do espaço i (0 a 7).
  usarHabilidadeDaBarra(i) {
    const barra = typeof barraHabilidades === "function" ? barraHabilidades(this.p, Date.now()) : [];
    const h = barra[i];
    if (!h) return null;
    return this.usarHabilidade(h.id);
  }
  numeroNoInimigo(id, txt, tipo) {
    const e = inimigos[id], s = this.entidades[id]?.sprite;
    if (s?.active) this.numero(s.x, s.y - this.entidades[id].alturaCabeca - NUM_ACIMA, txt, tipo);
    else if (e) this.numero(centroX(e.x), baseY(e.y) - 24, txt, tipo);
  }
  numeroNoAliado(id, txt) {
    const s = this.spritesAliados[id];
    if (s) this.numero(s.x, s.y - 20, txt, "recebido");
  }
  // Cão e ovelhas: um sprite por aliado da área, que anda até a casa dele (e some quando ele vai embora).
  sincronizarAliados(time) {
    const lista = typeof Mundo.aliados === "function" ? Mundo.aliados(MEU_ID).filter((a) => a.area === this.areaAtual) : [];
    const vistos = new Set();
    for (const a of lista) {
      vistos.add(a.id);
      const x = centroX(a.x), y = baseY(a.y);
      let s = this.spritesAliados[a.id];
      if (!s) {
        // o protegido da masmorra (Daniel, JGB-23) é gente: o morador da aparência dele, com nome e barra de vida
        const protegido = a.tipo === "protegido";
        const visual = protegido ? (PIXEL_PATTERNS["pj_morador_" + a.aparencia] ? "pj_morador_" + a.aparencia : "pj_viajante") : a.tipo === "cao" ? "al_cao" : "al_ovelha";
        const chave = Arte.garantirTextura(this, visual);
        s = this.add.sprite(x, y, chave, 0).setOrigin(0.5, 1).setDepth(PROF.entidade + y);
        s.desl = Object.assign(novoDeslize(x, y), { casaX: a.x, casaY: a.y });
        if (protegido) {
          s.alturaCabeca = PIXEL_PATTERNS[chave]?.alturaCabeca || alturaDoDesenho(chave);
          s.rotulo = this.textoRotulo(a.nome || "", COR.amigo, NOME_PX).setAlpha(1);
          s.sombraPe = this.add.image(x + 3, y - 1, "fx_sombra").setDepth(PROF.sombra);
          s.anelPe = this.add.image(x, y - 2, "fx_aura").setTint(0x8fd16a).setAlpha(0.45).setDepth(PROF.sombra + 1);
          if (!reduzMovimento()) this.tweens.add({ targets: s.anelPe, alpha: 0.2, duration: 900, yoyo: true, repeat: -1 });
          this.luzes.push({ x, y: y - 20, r: 76, quente: 0.6 }); // a candeia de Daniel na cova (ele não sai do lugar)
        }
        this.spritesAliados[a.id] = s;
        if (!reduzMovimento()) this.particulasSimples(x, y - 8, "#f6efdc", 6, { espalha: 8, dur: 500 });
      }
      s.dadosAliado = a;
      const st = s.desl;
      if (st.casaX !== a.x || st.casaY !== a.y) this.deslizarAte(st, s, a.x, a.y);
      const andando = aplicarDeslize(st, s, time);
      const yi = Math.round(st.y);
      if (yi !== st.yProf) { st.yProf = yi; s.setDepth(PROF.entidade + yi); }
      s.setFrame(quadroComVista(s, andando ? quadroAndando(s, time) : 0));
      if (s.rotulo) {
        s.sombraPe.setPosition(s.x + 3, s.y - 1); s.anelPe.setPosition(s.x, s.y - 2);
        s.rotulo.setPosition(Math.round(s.x), Math.round(s.y - s.alturaCabeca - BARRA.folga - BARRA.hChefe - 2));
      }
    }
    for (const [id, s] of Object.entries(this.spritesAliados)) {
      if (vistos.has(id)) continue;
      if (!reduzMovimento()) this.particulasSimples(s.x, s.y - 8, "#f6efdc", 5, { espalha: 8, dur: 400 });
      for (const o of [s.rotulo, s.sombraPe, s.anelPe]) o?.destroy();
      s.destroy();
      delete this.spritesAliados[id];
    }
  }

  jogadorAtordoado(x) {
    this.mensagem(x.mensagem, "perigo");
    this.numero(this.jogador.x, this.yNumeroJogador(), "ATORDOADO", "bloqueio");
    if (reduzMovimento()) return;
    const ate = this.time.now + Math.max(300, x.ate - Date.now());
    const estrelas = [0, 1, 2].map(() => this.add.sprite(0, 0, "fx_brilho", 1).setTint(0xffe08a).setDepth(PROF.numero - 2));
    const ev = this.time.addEvent({ delay: 40, loop: true, callback: () => {
      const t = this.time.now / 200;
      estrelas.forEach((s, i) => s.setPosition(this.jogador.x + Math.cos(t + (i * Math.PI * 2) / 3) * 10, this.jogador.y - this.alturaJogador + 2 + Math.sin(t + (i * Math.PI * 2) / 3) * 3));
      if (this.time.now >= ate) { ev.remove(false); for (const s of estrelas) s.destroy(); }
    } });
  }

  // Fúria, fuga e investida: avisos sobre a criatura (a investida mostra "!" durante o preparo).
  comportamentoInimigo(x) {
    const ent = this.entidades[x.id];
    if (x.mensagem) this.mensagem(x.mensagem, x.tipo === "investidaErrou" ? "combate" : "perigo");
    if (!ent) return;
    const s = ent.sprite, y = s.y - ent.alturaCabeca - BARRA.folga - BARRA.h - 12;
    if (x.tipo === "furia") {
      this.numero(s.x, y, "FÚRIA!", "critico");
      if (!ent.dados.tinta) s.setTint(0xff9a8a);
      this.particulasSimples(s.x, s.y - 14, "#c2452d", 10, { subir: true, dur: 700 });
    } else if (x.tipo === "fuga") this.numero(s.x, y, "FOGE!", "errou");
    else if (x.tipo === "investidaErrou") this.numero(s.x, y, "ERROU", "errou");
    else if (x.tipo === "retorno") {
      this.numero(s.x, y, x.reforcos ? "REFORÇO!" : "VOLTOU", "critico");
      this.particulasSimples(s.x, s.y - 14, "#8fd16a", 6, { subir: true, dur: 600 });
    }
    else if (x.tipo === "investidaPreparo") {
      ent.alerta?.destroy();
      ent.alerta = this.add.text(s.x, y, "!", { fontFamily: FONTE_PIXEL, fontSize: "18px", color: "#ffd24a", stroke: COR.tinta, strokeThickness: 4, resolution: 2 })
        .setOrigin(0.5, 1).setDepth(PROF.numero);
      if (!reduzMovimento()) ent.desl.tremorAte = this.time.now + 840;
      // Telegrafo no chão: as casas por onde a investida vai passar, pulsando até o golpe.
      const marcas = (x.casas || []).map((c) => {
        const r = this.add.rectangle(c.x * TAM + TAM / 2, c.y * TAM + TAM / 2, TAM - 4, TAM - 4, 0xff3a1a, 0.8)
          .setStrokeStyle(2, 0xffd24a, 1).setDepth(PROF.sombra + 2);
        if (!reduzMovimento()) this.tweens.add({ targets: r, alpha: 0.75, duration: 160, yoyo: true, repeat: -1 });
        return r;
      });
      this.time.delayedCall(Math.max(200, x.ate - Date.now()) + 150, () => { ent.alerta?.destroy(); ent.alerta = null; for (const r of marcas) r.destroy(); });
    }
  }

  // Curandeiro inimigo: raio verde até a aliada curada e o "+N" sobre ela.
  curaInimiga(x) {
    const de = this.entidades[x.id], para = this.entidades[x.alvo];
    this.mensagem(x.mensagem, "combate");
    if (!para) return;
    if (de) { de.acaoAte = this.time.now + 300; de.falando = true; }
    this.numero(para.sprite.x, para.sprite.y - para.alturaCabeca - NUM_ACIMA, `+${x.cura}`, "cura");
    this.fxNoSprite("fx_cura", para.sprite);
    if (de && de !== para && !reduzMovimento()) {
      const linha = this.add.line(0, 0, de.sprite.x, de.sprite.y - 20, para.sprite.x, para.sprite.y - 14, 0x8fd16a, 0.8).setOrigin(0, 0).setLineWidth(2).setDepth(PROF.numero - 2);
      this.tweens.add({ targets: linha, alpha: 0, duration: 450, onComplete: () => linha.destroy() });
    }
  }

  // Campeão explosivo: marca o chão ao morrer e explode depois (o dano vem da lógica).
  marcarExplosao(ex) {
    if (!ex) return;
    const x = centroX(ex.x), y = baseY(ex.y) - 4;
    const anel = this.add.image(x, y, "fx_aura").setTint(0xff6a2a).setDepth(PROF.sombra + 2).setScale(2.4).setAlpha(0.5);
    if (!reduzMovimento()) this.tweens.add({ targets: anel, alpha: 0.95, scale: 2.8, duration: 200, yoyo: true, repeat: -1 });
    this.time.delayedCall(Math.max(200, ex.em - Date.now()) + 150, () => anel.destroy());
    this.mensagem("O campeão vai explodir! Afaste-se!", "perigo");
  }
  explosao(x) {
    if (x.area !== this.areaAtual) return;
    const px = centroX(x.x), py = baseY(x.y) - 8;
    // fogo na casa da explosão e nas 8 em volta (efeito de área), com o estouro no centro
    this.fx("fx_impacto", px, py - 8, { depth: PROF.entidade + py + 60, escala: 2 });
    for (const [dx, dy] of [[0, 0], ...DIRECOES_8]) {
      if (!this.chaoFirme(px + dx * TAM, py + dy * TAM)) continue;
      this.fx("fx_fogo", px + dx * TAM, py + 8 + dy * TAM - 24, { depth: PROF.entidade + py + dy * TAM + 9, quadros: 8, ms: 80, apaga: 240, atraso: dx || dy ? 60 + Math.round(Math.random() * 80) : 0 });
    }
    this.particulasSimples(px, py, "#ffe08a", 10, { subir: true, dur: 700, espalha: 20 });
    if (!reduzMovimento()) this.cameras.main.shake(220, 0.008);
    if (x.dano) this.numero(this.jogador.x, this.yNumeroJogador(), `−${x.dano}`, "recebido");
    this.mensagem(x.mensagem, x.dano ? "perigo" : "combate");
  }

  // Raro nomeado: aparece (anúncio no Registro e, na área, o sprite) e some quando a janela fecha.
  eventoNomeado(x) {
    if (x.mensagem) this.mensagem(x.mensagem, "anuncio");
    const e = inimigos[x.id];
    if (x.tipo === "nomeadoApareceu") {
      Som.saque("epico");
      if (e && x.area === this.areaAtual && !this.entidades[x.id]) {
        const ent = this.criarInimigo(e);
        ent.sprite.setAlpha(0);
        this.tweens.add({ targets: ent.sprite, alpha: 1, duration: 600 });
      }
    } else if (this.entidades[x.id]) {
      if (this.alvoId === x.id) this.alvoId = null;
      this.destruirEntidade(x.id);
    }
  }

  // ===== masmorras (JGB-23): criaturas que acendem, perigos no chão, etapas, fases e o fim =====
  eventoMasmorra(x) {
    if (x.area && x.area !== this.areaAtual) return;
    const reduz = reduzMovimento();
    if (x.tipo === "masmorraSurgiu") {
      const e = inimigos[x.id];
      if (!e || Mundo.obterVidaInimigo(MEU_ID, x.id) <= 0) return;
      const ent = this.criarInimigo(e); // criarInimigo troca a entidade, se a vaga já estava em cena
      ent.sprite.setAlpha(0); ent.sombra.setAlpha(0);
      this.tweens.add({ targets: [ent.sprite, ent.sombra], alpha: 1, duration: reduz ? 1 : 500 });
      if (!reduz) this.particulasSimples(ent.sprite.x, ent.sprite.y - 10, Arte.CHEFES.has(x.id) ? "#ffb04a" : "#c9b89a", Arte.CHEFES.has(x.id) ? 16 : 8, { subir: true, espalha: 14, dur: 700 });
    } else if (x.tipo === "perigoAviso") this.marcarPerigo(x);
    else if (x.tipo === "perigo") this.fogoNoChao(x);
    else if (x.tipo === "masmorraEtapa") {
      this.limparVagasApagadas(); // a etapa que acabou apaga as criaturas que sobraram (sem evento por criatura)
      this.mostrarCartao(`Etapa ${x.numero} de ${x.total}`, x.texto);
      this.mensagem(`Etapa ${x.numero} de ${x.total}: ${x.texto}.`, "missao");
    } else if (x.tipo === "masmorraFase") {
      this.mensagem(x.mensagem, "anuncio");
      if (!reduz) this.cameras.main.shake(260, 0.004);
    } else if (x.tipo === "masmorraFim") {
      // as vagas que sobraram somem (a instância acabou); a janela do resultado é da interface
      this.limparVagasApagadas();
      for (const m of this.marcasPerigo || []) m.destroy();
      this.marcasPerigo = [];
      this.mensagem(x.mensagem, x.vitoria ? "anuncio" : "perigo");
      if (x.vitoria) {
        window.Som?.saque?.("epico");
        this.particulasSimples(this.jogador.x, this.jogador.y - 20, "#f2d27a", 18, { subir: true, dur: 1000, espalha: 18 });
        if (!reduz) this.cameras.main.flash(300, 255, 224, 138);
      }
      this.p = Mundo.jogadores[MEU_ID];
      this.verificarNivel();
      this.time.delayedCall(reduz ? 200 : 900, () => window.UI?.resultadoMasmorra?.(x));
    }
    window.atualizarInterface?.();
  }
  // Criaturas da masmorra que a lógica apagou (fim de etapa, fim da masmorra): somem num esmaecer.
  limparVagasApagadas() {
    for (const id of Object.keys(this.entidades)) {
      if (!inimigos[id]?.masmorra || Mundo.obterVidaInimigo(MEU_ID, id) > 0) continue;
      const ent = this.entidades[id];
      delete this.entidades[id]; // sai da lista já (barras, alvo, minimapa); os objetos esmaecem e somem
      if (this.alvoId === id) this.alvoId = null;
      if (this.hoverId === id) this.hoverId = null;
      ent.alerta?.destroy();
      ent.sprite?.auraCampeao?.destroy();
      ent.sprite?.disableInteractive();
      const objs = [ent.sprite, ent.sombra, ent.rotulo, ent.balao].filter(Boolean);
      this.tweens.add({ targets: objs, alpha: 0, duration: reduzMovimento() ? 1 : 400, onComplete: () => { for (const o of objs) o.destroy(); } });
    }
  }
  // Casas que vão pegar fogo: telégrafo vermelho com borda de ouro (como o da investida), pulsando até `ate`.
  // Uma Graphics só para todas as casas do padrão (as linhas cobrem centenas delas).
  marcarPerigo(x) {
    const casas = x.casas || [];
    if (!casas.length) return;
    const g = this.add.graphics().setDepth(PROF.sombra + 2);
    for (const c of casas) {
      const px = c.x * TAM, py = c.y * TAM;
      g.fillStyle(0xff3a1a, 0.42).fillRect(px + 2, py + 2, TAM - 4, TAM - 4);
      g.lineStyle(2, 0xffd24a, 0.9).strokeRect(px + 3, py + 3, TAM - 6, TAM - 6);
    }
    this.marcasPerigo = (this.marcasPerigo || []).filter((m) => m.active);
    this.marcasPerigo.push(g);
    if (!reduzMovimento()) {
      const pulso = this.tweens.add({ targets: g, alpha: 0.45, duration: 180, yoyo: true, repeat: -1 });
      g.once("destroy", () => pulso.remove()); // o tween infinito sai junto com a marca (não fica órfão)
    }
    if (casas.some((c) => c.x === this.p.x && c.y === this.p.y)) this.mensagem(`${x.nome}: saia das casas marcadas!`, "perigo");
    this.time.delayedCall(Math.max(150, x.ate - Date.now()) + 120, () => g.destroy());
  }
  // O fogo sobe nas casas: clarão laranja em todas e labaredas (fx_fogo) em até 90 delas, perto do jogador
  // primeiro; se atingiu, o dano sobre o jogador e a mensagem.
  fogoNoChao(x) {
    const casas = x.casas || [], reduz = reduzMovimento();
    const g = this.add.graphics().setDepth(PROF.sombra + 3).setBlendMode(Phaser.BlendModes.ADD);
    for (const c of casas) g.fillStyle(0xff7a1a, 0.55).fillRect(c.x * TAM, c.y * TAM, TAM, TAM);
    this.tweens.add({ targets: g, alpha: 0, duration: reduz ? 300 : 700, onComplete: () => g.destroy() });
    const perto = casas.slice().sort((a, b) => Math.hypot(a.x - this.p.x, a.y - this.p.y) - Math.hypot(b.x - this.p.x, b.y - this.p.y)).slice(0, reduz ? 30 : 90);
    for (const c of perto) {
      const px = centroX(c.x), py = baseY(c.y);
      this.fx("fx_fogo", px, py - 24, { depth: PROF.entidade + py + 1, quadros: 8, ms: 80, apaga: 240, atraso: reduz ? 0 : Math.round(Arte.hash2(c.x, c.y, 9) * 120) });
    }
    if (x.atingiu) {
      this.numero(this.jogador.x, this.yNumeroJogador(), `−${x.dano}`, "recebido");
      this.pulsoVinheta(0.4, 160);
      if (!reduz) this.cameras.main.shake(200, 0.006);
      this.mensagem(x.mensagem, "perigo");
    }
  }

  // Quadros, rótulos, barras, anel, copas e dica — tudo por quadro, sem alocação.
  animar(time) {
    const reduz = reduzMovimento();
    // jogador
    const ej = this.estadoJogador, j = this.jogador, dj = ej.desl;
    // Posição: o passo em curso; parado fora da casa da lógica (teleporte, empurrão), volta a ela.
    if (!dj.passo) {
      const cx = centroX(this.p.x), cy = baseY(this.p.y) + (this.areaAtual === "mar" ? 6 : 0);
      if (dj.x !== cx || dj.y !== cy) {
        if (Math.max(Math.abs(dj.x - cx), Math.abs(dj.y - cy)) > TAM * 3) { dj.x = cx; dj.y = cy; }
        else { iniciarDeslize(dj, cx, cy, time, 120); ej.andandoAte = time + 120; }
      }
    }
    aplicarDeslize(dj, j, time);
    this.alvoCamera.x = dj.x; this.alvoCamera.y = dj.y;
    if (this.areaAtual === "mar") j.setFrame(quadroDoBarco(j, time, ej.andandoAte > time));
    else if (ej.acaoAte > time) j.setFrame(quadroComVista(j, quadroDeAcao(j, ej.acaoAte - time)));
    else if (ej.andandoAte > time) j.setFrame(quadroComVista(j, quadroAndando(j, time)));
    else j.setFrame(quadroComVista(j, reduz ? 0 : Math.floor(time / 600) % 2));
    // setDepth sempre reordena a cena inteira (milhares de obstáculos): só quando o y inteiro muda
    const yj = Math.round(dj.y);
    if (yj !== dj.yProf) { dj.yProf = yj; j.setDepth(PROF.entidade + yj + 1); }
    this.sombraJogador.setPosition(j.x + 3, j.y - 1);

    // entidades
    for (const ent of Object.values(this.entidades)) {
      const s = ent.sprite, de = ent.desl;
      // criatura fora da casa da lógica sem evento de passo (retorno, empurrão): desliza até lá
      if (!de.passo && ent.tipo === "inimigo" && (de.casaX !== ent.dados.x || de.casaY !== ent.dados.y)) this.moverInimigo(ent.id);
      aplicarDeslize(de, s, time);
      let q;
      const agindo = ent.acaoAte > time;
      if (agindo) q = ent.falando ? quadroDeFala(s, time) : quadroDeAcao(s, ent.acaoAte - time);
      else if (ent.andandoAte > time) q = quadroAndando(s, time);
      else q = reduz ? 0 : Math.floor((time + ent.fase) / 600) % 2;
      if (ent.dados.id === "jesusGalileia" && agindo && ent.acaoAte - time > 400) q = 0;
      s.setFrame(quadroComVista(s, q));
      const ye = Math.round(de.y);
      if (ye !== de.yProf) { de.yProf = ye; s.setDepth(PROF.entidade + ye); }
      ent.sombra.setPosition(s.x + 3, s.y - 1);
      // o nome acompanha o deslize a cada quadro (o arranjo contra sobreposição roda a cada 100 ms)
      if (ent.rotuloDx !== undefined && ent.rotulo._alvo === 1) ent.rotulo.setPosition(Math.round(s.x + ent.rotuloDx), Math.round(s.y + ent.rotuloDy));
      if (s.auraCampeao) s.auraCampeao.setPosition(s.x, s.y - 2);
      if (ent.alerta) ent.alerta.setPosition(s.x, s.y - ent.alturaCabeca - BARRA.folga - BARRA.h - 12 - (reduz ? 0 : Math.floor(time / 120) % 2));
      if (ent.tipo === "npc" && ent.acaoAte < time && (this.p.x !== ent.dados.x || this.p.y !== ent.dados.y) && cheb(this.p, ent.dados) <= 3) virar(s, this.p.x - ent.dados.x, this.p.y - ent.dados.y);
      if (ent.balao && ent.balao.visible) this.posicionarBalao(ent, reduz ? 0 : Math.floor(time / 500) % 2 ? -2 : 0);
    }

    // animações simples por quadro
    for (const a of this.animados) if (a.img.active) a.img.setFrame(Math.floor((time / 1000) * a.fps) % a.quadros);
    if (this.pesca) for (const { s } of this.pesca) s.setFrame(s.getData("esgotado") ? 3 : Math.floor(time / 530) % 3);

    this.atualizarBlocos();
    this.atualizarChaoContinuo();
    // copas, colunas e telhados ficam translúcidos quando cobrem o jogador ou alguém a até 4 casas dele
    this.proximos.length = 0;
    for (const ent of Object.values(this.entidades)) if (cheb(this.p, ent.dados) <= 4) this.proximos.push(ent);
    this.atualizarTranslucidez(time - (this.ultimoQuadro || time));
    this.atualizarPredios(time - (this.ultimoQuadro || time));
    this.animarEfeitos(time);
    this.atualizarNoite(time);
    this.ultimoQuadro = time;
    this.desenharAlvoEBarras(time);
    if (time >= this.proximosRotulos) {
      this.proximosRotulos = time + 100;
      this.atualizarRotulos();
      this.atualizarDica();
    }

    // brilho ocasional sobre itens no chão
    if (time >= this.proximoBrilho && !reduz) {
      this.proximoBrilho = time + 2000 + Math.random() * 1000;
      const itens = Object.values(this.spritesItens).filter((s) => s.active && this.cameras.main.worldView.contains(s.x, s.y));
      if (itens.length) {
        const s = itens[Math.floor(Math.random() * itens.length)];
        this.brilhoItem.setPosition(s.x + 6, s.y - 12).setVisible(true).setFrame(0);
        this.brilhoAte = time + 300;
      }
    }
    if (this.brilhoItem.visible) {
      const r = this.brilhoAte - time;
      if (r <= 0) this.brilhoItem.setVisible(false);
      else this.brilhoItem.setFrame(r > 200 ? 0 : r > 100 ? 1 : 2);
    }

    // vida baixa: a vinheta pulsa em vermelhão
    const p = this.p, baixa = p.vida / vidaMaxima(p) < 0.25;
    if (baixa !== this.vidaBaixa) {
      this.vidaBaixa = baixa;
      this.tweens.killTweensOf(this.vinhetaVida);
      if (baixa) this.tweens.add({ targets: this.vinhetaVida, alpha: { from: 0, to: 0.25 }, duration: 500, yoyo: true, repeat: -1 });
      else this.vinhetaVida.setAlpha(0);
    }
  }

  desenharAlvoEBarras(time) {
    const g = this.gBarras, gr = this.gRecarga;
    g.clear();
    gr.clear();
    this.estrelaChefe.setVisible(false);
    const alvo = this.alvoId && this.entidades[this.alvoId];
    if (alvo) {
      // anel fino sob os pés do alvo e, por fora dele, o arco de recarga do autoataque
      const s = alvo.sprite, fa = Arte.FX?.fx_anel;
      this.anel.setVisible(true).setPosition(s.x, s.y - 2).setFrame(Math.floor(time / (fa?.ms || 125)) % (fa?.quadros || 4));
      const frac = Math.min(1, (time - this.ultimoAutoAtaque) / INTERVALO_AUTO_ATAQUE);
      const n = Math.floor(frac * this.pontosAnel.length);
      gr.fillStyle(0xffe08a, 0.95);
      for (let i = 0; i < n; i++) { const [dx, dy] = this.pontosAnel[i]; gr.fillRect(s.x + dx, s.y - 2 + dy, 1, 1); }
    } else this.anel.setVisible(false);
    // anel amigo sob o NPC com o ponteiro
    const hover = this.hoverId && this.entidades[this.hoverId];
    if (hover && hover.tipo === "npc") {
      const fa = Arte.FX?.fx_anel_amigo;
      this.anelAmigo.setVisible(true).setPosition(hover.sprite.x, hover.sprite.y - 2).setFrame(Math.floor(time / (fa?.ms || 160)) % (fa?.quadros || 1));
    } else this.anelAmigo.setVisible(false);

    // Barra de vida fina sobre todo personagem: borda escura de 1 px, fundo, segmento fantasma, vida na cor
    // dela, um fio de luz em cima e um de sombra embaixo. topo = y da 1ª linha de dentro.
    const barra = (cx, topo, w, h, frac, cor, fracFantasma = 0) => {
      const x = Math.round(cx - w / 2), y = Math.round(topo);
      g.fillStyle(0x140c0a, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle(0x3a1f1c, 1).fillRect(x, y, w, h);
      const wv = Math.max(frac > 0 ? 1 : 0, Math.round(w * frac)), wf = Math.round(w * fracFantasma);
      if (wf > wv) g.fillStyle(0xffe08a, 1).fillRect(x + wv, y, wf - wv, h);
      if (!wv) return;
      g.fillStyle(cor, 1).fillRect(x, y, wv, h);
      g.fillStyle(0xffffff, 0.3).fillRect(x, y, wv, 1);
      g.fillStyle(0x000000, 0.22).fillRect(x, y + h - 1, wv, 1);
    };
    const v = this.cameras.main.worldView, naVista = (s) => s.x > v.x - 40 && s.x < v.right + 40 && s.y > v.y - 8 && s.y < v.bottom + 96;

    const cheia = corDaVida(1)[1];
    for (const ent of Object.values(this.entidades)) {
      const s = ent.sprite, w = ent.chefe ? BARRA.wChefe : BARRA.w, h = ent.chefe ? BARRA.hChefe : BARRA.h;
      const topo = s.y - ent.alturaCabeca - BARRA.folga - h;
      if (this.sobTelhado(ent)) continue;
      if (ent.tipo !== "inimigo") { if (s.visible && naVista(s)) barra(s.x, topo, w, h, 1, cheia); continue; }
      const vida = Mundo.obterVidaInimigo(MEU_ID, ent.id), max = Mundo.vidaMaximaInimigo(MEU_ID, ent.id) || ent.dados.vidaMaxima;
      // fantasma: segmento que encolhe em 400 ms
      if (vida < ent.vidaFantasma) {
        if (!ent.fantasmaDesde) ent.fantasmaDesde = time;
        const t = (time - ent.fantasmaDesde) / 400;
        if (t >= 1) { ent.vidaFantasma = vida; ent.fantasmaDesde = 0; }
      } else { ent.vidaFantasma = vida; ent.fantasmaDesde = 0; }
      if (!s.visible || vida <= 0 || !naVista(s)) continue;
      // Nome na cor da vida (a cor do tier ou do campeão volta com a vida cheia).
      const cor = corDaVida(vida / max);
      const corNome = vida >= max && ent.corFixa ? ent.corNome : cor[2];
      if (ent.rotulo && ent.corAtual !== corNome) { ent.corAtual = corNome; ent.rotulo.setColor(corNome); }
      let fantasma = ent.vidaFantasma;
      if (ent.fantasmaDesde) fantasma = ent.vidaFantasma - (ent.vidaFantasma - vida) * Math.min(1, (time - ent.fantasmaDesde) / 400);
      barra(s.x, topo, w, h, vida / max, cor[1], fantasma / max);
      if (ent.chefe) this.estrelaChefe.setVisible(true).setPosition(Math.round(s.x - w / 2) - 10, Math.round(topo) + 2);
    }
    // Protegido da masmorra (Daniel): a barra larga de chefe, verde que vai ao vermelho com a vida dele.
    for (const s of Object.values(this.spritesAliados)) {
      const a = s.dadosAliado;
      if (!s.rotulo || !a?.vidaMax || !s.visible || !naVista(s)) continue;
      const frac = Math.max(0, Math.min(1, a.vida / a.vidaMax)), cor = corDaVida(frac);
      barra(s.x, s.y - s.alturaCabeca - BARRA.folga - BARRA.hChefe, BARRA.wChefe, BARRA.hChefe, frac, cor[1]);
    }
    // Jogador: nome e barra rentes à cabeça, como em todo personagem. Por último: a barra dele fica por cima
    // da de uma criatura colada logo atrás (ao norte), que cairia na mesma altura.
    const p = this.p, vmax = typeof vidaMaxima === "function" ? vidaMaxima(p) : 0, j = this.jogador;
    if (vmax && j?.visible) {
      const frac = Math.max(0, Math.min(1, p.vida / vmax)), cor = corDaVida(frac);
      const topo = Math.round(j.y - this.alturaRotuloJogador() - BARRA.folga - BARRA.h);
      barra(j.x, topo, BARRA.w, BARRA.h, frac, cor[1]);
      this.rotuloJogador.setPosition(Math.round(j.x), topo - 2);
      if (this.corRotuloJogador !== cor[2]) { this.corRotuloJogador = cor[2]; this.rotuloJogador.setColor(cor[2]); }
    }
  }

  // Altura do nome (texto em px de tela) em px de mundo, sem a folga da linha.
  alturaNome(t) {
    return Math.max(5, Math.round((t?.displayHeight || 8) * 0.72));
  }
  // Retângulo do jogador (base no meio dos pés), com a barra e o nome sobre a cabeça. O jogador é a
  // prioridade visual nº 1 (§1.8): rótulos de marcador, balões e a dica não passam por cima dele.
  retanguloJogador() {
    const j = this.jogador;
    return { x: j.x, y: j.y, w: 28, h: this.alturaRotuloJogador() + BARRA.folga + BARRA.h + 3 + this.alturaNome(this.rotuloJogador) };
  }
  // Balão (!, ?, loja, guia) sobre o nome do NPC; se cruzar o jogador
  // (NPC logo abaixo dele), vai para o lado oposto ao jogador.
  posicionarBalao(ent, quique) {
    const s = ent.sprite, b = ent.balao, corpo = this.retanguloJogador();
    let x = s.x;
    const y = s.y - ent.alturaCabeca - BARRA.folga - BARRA.h - 4 - this.alturaNome(ent.rotulo) + quique;
    const cruza = Math.abs(corpo.x - x) < (corpo.w + b.displayWidth) / 2 && y > corpo.y - corpo.h && y - b.displayHeight < corpo.y;
    if (cruza) x = corpo.x + (s.x >= corpo.x ? 1 : -1) * ((corpo.w + b.displayWidth) / 2 + 2);
    b.setPosition(Math.round(x), Math.round(y));
  }

  // Nomes: todo personagem na tela mostra o nome pequeno logo acima da barra; marcadores (portal, cais,
  // pesca), de perto ou com Alt. Anti-sobreposição (§8.2): um nome que cairia sobre outro sobe; o do
  // jogador tem o lugar garantido e os rótulos de marcador não passam por cima do corpo dele.
  atualizarRotulos() {
    const todos = this.teclas.alt.isDown;
    const v = this.cameras.main.worldView;
    const visiveis = [];
    for (const ent of Object.values(this.entidades)) {
      const s = ent.sprite;
      if (!s.visible || this.sobTelhado(ent) || s.x < v.x - 60 || s.x > v.right + 60 || s.y < v.y - 8 || s.y > v.bottom + 110) { this.desvanecer(ent.rotulo, false); continue; }
      const y = s.y - ent.alturaCabeca - BARRA.folga - (ent.chefe ? BARRA.hChefe : BARRA.h) - 2;
      visiveis.push({ t: ent.rotulo, x: s.x, y, ent });
    }
    for (const m of this.marcadores) {
      const mostra = todos || cheb(this.p, m) <= 3;
      if (!mostra) { this.desvanecer(m.rotulo, false); continue; }
      visiveis.push({ t: m.rotulo, x: centroX(m.x), y: m.y * TAM + TAM + m.dy });
    }
    visiveis.sort((a, b) => b.y - a.y);
    // Retângulos com base em y (rótulos têm origem embaixo).
    const bate = (r, x, y, w, h) => Math.abs(r.x - x) < (r.w + w) / 2 + 1 && y > r.y - r.h && y - h < r.y;
    const corpo = this.retanguloJogador(), j = this.jogador, rj = this.rotuloJogador;
    const colocados = [{ x: j.x, y: rj.y, w: rj.displayWidth, h: this.alturaNome(rj) + 1 }];
    for (const vv of visiveis) {
      const w = vv.t.displayWidth, h = this.alturaNome(vv.t) + 1;
      let y = vv.y, ok = false;
      for (let k = 0; k < 4; k++) {
        if (!colocados.some((r) => bate(r, vv.x, y, w, h)) && (vv.ent || !bate(corpo, vv.x, y, w, h))) { ok = true; break; }
        y -= h;
      }
      if (!ok) { if (vv.ent) y = vv.y; else { this.desvanecer(vv.t, false); continue; } }
      colocados.push({ x: vv.x, y, w, h });
      vv.t.setPosition(Math.round(vv.x), Math.round(y));
      if (vv.ent) { vv.ent.rotuloDx = vv.x - vv.ent.sprite.x; vv.ent.rotuloDy = y - vv.ent.sprite.y; }
      this.desvanecer(vv.t, true);
    }
  }
  desvanecer(t, mostrar) {
    if (!t) return;
    const alvo = mostrar ? 1 : 0;
    if (t._alvo === alvo) return;
    t._alvo = alvo;
    this.tweens.killTweensOf(t);
    if (reduzMovimento()) t.setAlpha(alvo);
    else this.tweens.add({ targets: t, alpha: alvo, duration: 150 });
  }
  atualizarDica() {
    const alvo = this.podeInteragir();
    this.interacaoAtual = alvo;
    if (!alvo || (window.matchMedia && matchMedia("(pointer: coarse)").matches)) { this.dica.setVisible(false); return; }
    const texto = `${alvo.tecla} · ${alvo.rotulo}`;
    if (this.dica.text !== texto) this.dica.setText(texto);
    const ent = alvo.tipo === "npc" && this.entidades[alvo.id];
    let x = ent ? ent.sprite.x : centroX(alvo.x), y = (ent ? ent.sprite.y : baseY(alvo.y)) + 4;
    // Alvo logo ao norte: a pílula (origem no topo) cairia sobre o tronco
    // do jogador. Nesse caso ela vai para baixo dos pés dele (§1.8).
    const corpo = this.retanguloJogador(), w = this.dica.displayWidth, h = this.dica.displayHeight;
    const cruza = Math.abs(corpo.x - x) < (corpo.w + w) / 2 && y < corpo.y && y + h > corpo.y - corpo.h;
    if (cruza) { x = corpo.x; y = corpo.y + 4; }
    this.dica.setPosition(Math.round(x), Math.round(y)).setVisible(true);
  }

  // ===== minimapa (DOM; mesmas cores do mundo) ========================
  // Minimapa sobre o mundo (médio, celular e largo em tela baixa): ele não
  // recebe cliques (pointer-events:none no CSS, o clique chega ao canvas) e
  // fica translúcido quando o jogador, um inimigo ou um NPC passa por baixo.
  atualizarMapaSobre() {
    const caixa = document.getElementById("mapaSobre"), canvas = this.game.canvas;
    if (!caixa || !canvas) return;
    const m = caixa.getBoundingClientRect();
    let coberto = false;
    if (m.width && m.height) {
      const c = canvas.getBoundingClientRect(), cam = this.cameras.main, v = cam.worldView;
      const kx = c.width / this.scale.width, ky = c.height / this.scale.height;
      const tela = (s) => [c.left + (cam.x + (s.x - v.x) * cam.zoom) * kx, c.top + (cam.y + (s.y - v.y) * cam.zoom) * ky];
      const sprites = [this.jogador, ...Object.values(this.entidades).map((e) => e.sprite)];
      coberto = sprites.some((s) => {
        if (!s || !s.visible) return false;
        const [x, y] = tela(s), meiaL = (s.displayWidth * cam.zoom * kx) / 2, alt = s.displayHeight * cam.zoom * ky;
        return x + meiaL > m.left && x - meiaL < m.right && y > m.top && y - alt < m.bottom;
      });
    }
    caixa.classList.toggle("encoberto", coberto);
  }
  // O minimapa mostra uma janela de casas em volta do jogador (MINIMAPA_NIVEIS, 3 níveis). O mapa inteiro
  // é pintado uma vez num canvas com um número inteiro de px por casa e recortado a cada desenho. O
  // tamanho do canvas vem do DOM (a interface decide; aqui só se acompanha).
  desenharMinimapa() {
    const canvas = document.querySelector("#miniMap");
    if (!canvas || !this.p) return;
    const lw = canvas.clientWidth, lh = canvas.clientHeight;
    if (lw > 8 && lh > 8 && (canvas.width !== lw || canvas.height !== lh)) { canvas.width = lw; canvas.height = lh; this.minimapaEstatico = null; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const nivel = MINIMAPA_NIVEIS[estadoMinimapa.nivel] || MINIMAPA_NIVEIS[1];
    // com areas[área].vista (as masmorras), o minimapa mostra só aquele retângulo: no nível mais afastado,
    // ele inteiro (sem as casas fechadas em volta)
    const vista = areas[this.areaAtual]?.vista;
    const colunas = vista ? Math.min(nivel.colunas, vista.largura) : nivel.colunas;
    const E = Math.max(1, vista ? Math.floor(Math.min(W / colunas, H / Math.min(nivel.linhas, vista.altura))) : Math.round(W / colunas)); // px do minimapa por casa (inteiro: casas iguais)
    if (!this.minimapaEstatico || this.minimapaEstatico.escala !== E) this.minimapaEstatico = this.pintarMinimapa(E);
    const jc = W / E, jl = H / E; // casas que cabem
    // janela centrada no jogador (mais o arrasto), presa às bordas do mapa (ou da vista)
    const x0 = vista ? vista.x : 0, y0 = vista ? vista.y : 0, xl = vista ? vista.largura : COLS, yl = vista ? vista.altura : ROWS;
    const preso = (v, min, max) => (max <= min ? (min + max) / 2 : Math.max(min, Math.min(max, v)));
    const cx = this.p.x + 0.5 + estadoMinimapa.dx, cy = this.p.y + 0.5 + estadoMinimapa.dy;
    const ox = preso(Math.round((cx - jc / 2) * E) / E, x0, x0 + xl - jc), oy = preso(Math.round((cy - jl / 2) * E) / E, y0, y0 + yl - jl);
    this.janelaMinimapa = { ox, oy, sx: E, sy: E }; // para o clique no minimapa (ligarMinimapa)
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = this.minimapaEstatico.fundo;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.minimapaEstatico.canvas, -Math.round(ox * E), -Math.round(oy * E));
    const TINTA = "#1c1210";
    // Marcas: quadrado (criaturas e gente), losango (portais, cais, missão) e cruz (o jogador), todas com
    // borda escura de 1 px para ler sobre qualquer chão.
    const marca = (x, y, cor, forma = "ponto", t = 2) => {
      const px = Math.round((x - ox + 0.5) * E), py = Math.round((y - oy + 0.5) * E);
      if (px < -t || py < -t || px > W + t || py > H + t) return;
      if (forma === "cruz") {
        const b = t, e = 1; // braço e meia espessura
        ctx.fillStyle = TINTA;
        ctx.fillRect(px - b - 1, py - e - 1, 2 * b + 3, 2 * e + 3); ctx.fillRect(px - e - 1, py - b - 1, 2 * e + 3, 2 * b + 3);
        ctx.fillStyle = cor;
        ctx.fillRect(px - b, py - e, 2 * b + 1, 2 * e + 1); ctx.fillRect(px - e, py - b, 2 * e + 1, 2 * b + 1);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(px, py, 1, 1);
      } else if (forma === "losango") {
        for (const [r, c] of [[t + 1, TINTA], [t, cor]])
          for (let d = -r; d <= r; d++) { const m = r - Math.abs(d); ctx.fillStyle = c; ctx.fillRect(px - m, py + d, 2 * m + 1, 1); }
      } else {
        const a = Math.floor(t / 2);
        ctx.fillStyle = TINTA; ctx.fillRect(px - a - 1, py - a - 1, t + 2, t + 2);
        ctx.fillStyle = cor; ctx.fillRect(px - a, py - a, t, t);
      }
    };
    const grande = E >= 2 ? 1 : 0;
    const a = areas[this.areaAtual];
    for (const t of PORTAIS) if (t.area === this.areaAtual) marca(t.x, t.y, "#c9a0e6", "losango", 2 + grande);
    if (a?.passagem) marca(a.passagem.x, a.passagem.y, "#c9a0e6", "losango", 2 + grande);
    if (a?.cais) marca(a.cais.x, a.cais.y, "#7fe0e0", "losango", 2 + grande);
    if (this.areaAtual === "mar") {
      for (const pt of Object.values(a.portos || {})) marca(pt.cais.x, pt.cais.y, "#7fe0e0", "losango", 2 + grande);
      for (const pt of pontosPesca) marca(pt.x, pt.y, "#bfeff0", "ponto", 2);
    }
    const depois = [];
    for (const ent of Object.values(this.entidades)) {
      const d = ent.tipo === "inimigo" ? inimigos[ent.id] : ent.dados;
      if (ent.tipo === "npc") {
        // "!"/"?" em losango dourado; o atalaia com o mural em uso na cor das caçadas (pergaminho);
        // comerciantes e guias em âmbar; moradores (só conversa) em tom discreto.
        const destaque = ent.estadoBalao === "missao" || ent.estadoBalao === "entregar";
        if (destaque) depois.push([d.x, d.y, "#ffd24a", "losango", 2 + grande]);
        else marca(d.x, d.y, ent.estadoBalao === "mural" ? "#f3e4c0" : d.papel === "ambiente" ? "#cfae74" : "#f0a830", "ponto", d.papel === "ambiente" ? 2 : 3);
      } else if (ent.id === this.alvoId) depois.push([d.x, d.y, "#ffffff", "ponto", 4], [d.x, d.y, "#ff3a2a", "ponto", 2]);
      else marca(d.x, d.y, ent.corNome === COR_CAMPEAO ? "#ffb02a" : "#ef4a3a", "ponto", Arte.CHEFES.has(ent.id) ? 4 : 2 + grande);
    }
    for (const s of Object.values(this.spritesAliados)) if (s.desl) marca(s.desl.casaX, s.desl.casaY, "#8fd16a", "ponto", 2);
    for (const m of depois) marca(...m);
    // destino da rota: um alvo de ouro (na borda, se estiver fora do recorte)
    const d = this.rota?.destino;
    if (d) {
      const px = Math.round(Math.max(3, Math.min(W - 4, (d.x - ox + 0.5) * E))), py = Math.round(Math.max(3, Math.min(H - 4, (d.y - oy + 0.5) * E)));
      ctx.fillStyle = "#2a1a14";
      ctx.fillRect(px - 4, py - 1, 9, 3); ctx.fillRect(px - 1, py - 4, 3, 9);
      ctx.fillStyle = "#ffe9a8";
      ctx.fillRect(px - 3, py, 7, 1); ctx.fillRect(px, py - 3, 1, 7);
    }
    // o que a câmera mostra
    const v = this.cameras.main.worldView;
    const rx = Math.round((v.x / TAM - ox) * E), ry = Math.round((v.y / TAM - oy) * E), rw = Math.round((v.width * E) / TAM), rh = Math.round((v.height * E) / TAM);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#1c1210aa"; ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
    ctx.strokeStyle = "#f3e4c066"; ctx.strokeRect(rx + 1.5, ry + 1.5, rw - 2, rh - 2);
    // o jogador: cruz clara que pisca em azul, na posição do sprite (acompanha o deslize)
    const dj = this.estadoJogador?.desl;
    const jx = dj ? dj.x / TAM - 0.5 : this.p.x, jy = dj ? (dj.y - (this.areaAtual === "mar" ? 6 : 0) + 1) / TAM - 1 : this.p.y;
    marca(jx, jy, Math.floor(this.time.now / 400) % 2 === 0 || reduzMovimento() ? "#fff6dc" : "#6fa8ff", "cruz", E >= 4 ? 4 : 3);
  }
  // Pinta o mapa inteiro da área com E px por casa. Cores do bioma (menos lavadas que as do pergaminho),
  // com leve variação por casa; cada obstáculo na cor média do seu próprio desenho (copa verde, rocha,
  // muro de pedra), com luz em cima e à esquerda e sombra embaixo e à direita; copas isoladas de cantos
  // redondos; margem escura entre água e terra; prédios como um bloco de telhado com contorno e porta.
  pintarMinimapa(E) {
    const brutas = Arte.minimapaCores(this.areaAtual), mis = Arte.misturar, M = Arte.motor;
    // as cores do motor vêm misturadas a 35% de pergaminho: aqui volta-se a ~12%, para o mapa ter contraste
    const viva = (cor) => {
      try {
        const a = M.hexRgb(cor), p = M.hexRgb("#e6cf9c");
        const c = [0, 1, 2].map((i) => Math.max(0, Math.min(255, Math.round((a[i] - 0.35 * p[i]) / 0.65))));
        return mis(M.rgbHex(c[0], c[1], c[2]), "#e6cf9c", 0.12);
      } catch (e) { return cor; }
    };
    const cores = {};
    for (const k of Object.keys(brutas)) cores[k] = k === "fundo" ? brutas[k] : viva(brutas[k]);
    const c = document.createElement("canvas");
    c.width = COLS * E; c.height = ROWS * E;
    const g = c.getContext("2d"), m = mapas[this.areaAtual], piso = pisos[this.areaAtual], ts = this.tileset;
    const noMar = this.areaAtual === "mar";
    const CH = 0, CA = 1, AG = 2, OB = 3, ES = 4, IN = 5, BO = 6, PO = 7;
    const tipo = (x, y) => {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return BO;
      const idx = ts.indice(x, y);
      // No mar toda casa usa um índice de água (o "chão" já é água); ali valem borda, ilhas/rochedos e a rota.
      if (!noMar && idx >= Arte.ID_TILE.COSTA && idx < Arte.ID_TILE.BORDA) return AG;
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return BO;
      const p = piso[y][x];
      if (p === PISO.ESTRUTURA || p === PISO.PAREDE) return ES;
      if (p === PISO.PORTA) return m[y][x] ? ES : PO;
      if (p === PISO.INTERIOR) return m[y][x] ? ES : IN;
      if (m[y][x]) return OB;
      return ts.ehCaminho(x, y) ? CA : CH;
    };
    const T = [];
    for (let y = 0; y < ROWS; y++) { const l = new Uint8Array(COLS); for (let x = 0; x < COLS; x++) l[x] = tipo(x, y); T.push(l); }
    const em = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? BO : T[y][x]);
    // Cor de cada tipo de obstáculo: a média dos px do desenho (uma vez por tipo), um pouco escurecida.
    const corDoTipo = {}, tonsOb = {};
    const tonsDe = (chave) => {
      if (tonsOb[chave]) return tonsOb[chave];
      let cor = cores.obstaculo;
      try {
        const px = Arte.pixels(chave, { quadro: 0 });
        let r = 0, gg = 0, b2 = 0, n = 0;
        // só os 60% de cima (a copa, o topo da rocha) e sem os px quase pretos do contorno
        const fim = Math.floor(px.h * 0.6) * px.w;
        for (let i = 0; i < fim; i += 3) { const v = px.data[i]; if (!v) continue; const a = M.hexRgb(v); if (a[3] < 200 || a[0] + a[1] + a[2] < 150) continue; r += a[0]; gg += a[1]; b2 += a[2]; n++; }
        if (n > 8) {
          // um pouco mais de saturação: a média de muitos tons sai acinzentada
          const md = (r + gg + b2) / (3 * n), sat = (v) => md + (v / n - md) * 1.45;
          cor = mis(M.rgbHex(sat(r), sat(gg), sat(b2)), "#1c1210", 0.22);
        }
      } catch (e) { /* fica a cor do bioma */ }
      corDoTipo[chave] = cor;
      return (tonsOb[chave] = { base: [mis(cor, "#1c1210", 0.07), cor, cor, mis(cor, "#fff6dc", 0.06)], luz: mis(cor, "#fff6dc", 0.3), sombra: mis(cor, "#1c1210", 0.4) });
    };
    const muroTons = { base: 0, luz: 0, sombra: 0 };
    { const cor = mis(cores.borda, "#8a8078", 0.5); Object.assign(muroTons, { base: [cor, cor, cor, cor], luz: mis(cor, "#fff6dc", 0.4), sombra: mis(cor, "#1c1210", 0.5) }); }
    const base = [cores.chao, cores.caminho, cores.agua, cores.obstaculo, cores.estrutura, mis(cores.estrutura, "#fff6dc", 0.09), cores.borda, mis(cores.estrutura, "#1c1210", 0.55)];
    // tons prontos (a variação por casa escolhe um de 4): nada de misturar cor casa a casa
    const tons = base.map((cor, t) => [0, 1, 2, 3].map((i) => (t === CH || t === AG ? mis(cor, i < 2 ? "#1c1210" : "#fff6dc", [0.05, 0.015, 0.015, 0.045][i]) : cor)));
    const margem = mis(noMar ? cores.obstaculo : cores.agua, "#1c1210", 0.45), fundoAgua = mis(cores.agua, "#fff6dc", 0.16);
    const sombraChao = mis(cores.chao, "#1c1210", 0.2);
    const telhado = mis(cores.estrutura, "#fff6dc", 0.3), contorno = mis(cores.estrutura, "#1c1210", 0.55);
    const b = Math.max(1, Math.round(E / 4)); // espessura das margens
    const seca = (t) => t !== AG;
    const macico = (v) => v === OB || v === BO;
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const t = T[y][x], X = x * E, Y = y * E;
        const n = em(x, y - 1), s = em(x, y + 1), o = em(x - 1, y), l = em(x + 1, y);
        if (t === OB) {
          const muro = this.tipoMuro(x, y);
          const tp = muro ? null : Arte.tipoObstaculo(this.areaAtual, x, y);
          const tn = muro ? muroTons : tp ? tonsDe(tp.chave) : tonsDe("");
          // por baixo, o chão (aparece nos cantos da copa isolada)
          g.fillStyle = tons[CH][Math.floor(Arte.hash2(x, y, 77) * 4)];
          g.fillRect(X, Y, E, E);
          g.fillStyle = tn.base[Math.floor(Arte.hash2(x, y, 79) * 4)];
          if (E === 1) {
            g.fillRect(X, Y, 1, 1);
            if (!macico(n) && !macico(o)) { g.fillStyle = tn.luz; g.fillRect(X, Y, 1, 1); } else if (!macico(s) || !macico(l)) { g.fillStyle = tn.sombra; g.fillRect(X, Y, 1, 1); }
            continue;
          }
          g.fillRect(X, Y, E, E);
          if (E === 2) { // 2 px por casa: só um px de luz e um de sombra, para a árvore solta ler como copa
            if (muro) { g.fillStyle = tn.sombra; if (!macico(s)) g.fillRect(X, Y + 1, 2, 1); else if (!macico(l)) g.fillRect(X + 1, Y, 1, 2); continue; } // muro: traço contínuo
            if (!macico(n) || !macico(o)) { g.fillStyle = tn.luz; g.fillRect(X, Y, 1, 1); }
            if (!macico(s) || !macico(l)) { g.fillStyle = tn.sombra; g.fillRect(X + 1, Y + 1, 1, 1); }
            continue;
          }
          g.fillStyle = tn.luz;
          if (!macico(n)) g.fillRect(X, Y, E, b);
          if (!macico(o)) g.fillRect(X, Y, b, E);
          g.fillStyle = tn.sombra;
          if (!macico(s)) g.fillRect(X, Y + E - b, E, b);
          if (!macico(l)) g.fillRect(X + E - b, Y, b, E);
          // cantos redondos onde o maciço acaba em quina (só com 3 px ou mais por casa, e nunca em muro)
          if (E >= 3 && !muro) {
            g.fillStyle = tons[CH][1];
            if (!macico(n) && !macico(o)) g.fillRect(X, Y, 1, 1);
            if (!macico(n) && !macico(l)) g.fillRect(X + E - 1, Y, 1, 1);
            if (!macico(s) && !macico(o)) g.fillRect(X, Y + E - 1, 1, 1);
            if (!macico(s) && !macico(l)) g.fillRect(X + E - 1, Y + E - 1, 1, 1);
          }
          continue;
        }
        g.fillStyle = tons[t][Math.floor(Arte.hash2(x, y, 77) * 4)];
        g.fillRect(X, Y, E, E);
        if (t === AG || (noMar && t === CH)) {
          // margem: a água junto da terra escurece (no mar, junto das ilhas e rochedos)
          const terra = noMar ? macico : seca;
          if (E === 1) { if (terra(n) || terra(s) || terra(o) || terra(l)) { g.fillStyle = margem; g.fillRect(X, Y, 1, 1); } }
          else {
            if (!noMar && !terra(n) && !terra(s) && !terra(o) && !terra(l) && Arte.hash2(x, y, 78) < 0.16) { g.fillStyle = fundoAgua; g.fillRect(X + 1, Y + (E >> 1), Math.max(1, E - 2), 1); }
            g.fillStyle = margem;
            if (terra(n)) g.fillRect(X, Y, E, b);
            if (terra(s)) g.fillRect(X, Y + E - b, E, b);
            if (terra(o)) g.fillRect(X, Y, b, E);
            if (terra(l)) g.fillRect(X + E - b, Y, b, E);
          }
        } else if (t === CH || t === CA) {
          // sombra projetada: chão logo abaixo ou à direita de um obstáculo ou prédio
          if (E >= 2 && !noMar) {
            g.fillStyle = sombraChao;
            if (n === OB || n === ES) g.fillRect(X, Y, E, b);
            if (o === OB || o === ES) g.fillRect(X, Y, b, E);
          }
        } else if (t === ES || t === IN || t === PO) {
          const fora = (v) => v !== ES && v !== IN && v !== PO;
          if (E === 1) { if (fora(s) || fora(l)) { g.fillStyle = contorno; g.fillRect(X, Y, 1, 1); } else if (fora(n) || fora(o)) { g.fillStyle = telhado; g.fillRect(X, Y, 1, 1); } }
          else {
            g.fillStyle = telhado;
            if (fora(n)) g.fillRect(X, Y, E, b);
            if (fora(o)) g.fillRect(X, Y, b, E);
            g.fillStyle = contorno;
            if (fora(s)) g.fillRect(X, Y + E - b, E, b);
            if (fora(l)) g.fillRect(X + E - b, Y, b, E);
          }
        }
      }
    return { canvas: c, escala: E, fundo: cores.borda };
  }
  // Fachada do minimapa (Jogo.minimapa): zoom em 3 níveis, arrasto da janela e volta ao jogador.
  minimapaZoom(delta) {
    const passo = -Math.sign(delta || 0), ult = MINIMAPA_NIVEIS.length - 1;
    let n = Math.max(0, Math.min(ult, estadoMinimapa.nivel + passo));
    // canvas pequeno (celular): dois níveis podem dar o mesmo px por casa; pula o que não mudaria a imagem
    const W = document.querySelector("#miniMap")?.width || 0;
    const px = (i) => Math.max(1, Math.round(W / MINIMAPA_NIVEIS[i].colunas));
    while (W && passo && n > 0 && n < ult && px(n) === px(estadoMinimapa.nivel)) n += passo;
    if (W && n !== estadoMinimapa.nivel && px(n) === px(estadoMinimapa.nivel)) n = estadoMinimapa.nivel;
    if (n !== estadoMinimapa.nivel) {
      estadoMinimapa.nivel = n;
      try { localStorage.setItem(CHAVE_MINIMAPA, String(n)); } catch (e) { /* armazenamento bloqueado */ }
      this.minimapaEstatico = null;
      this.desenharMinimapa();
    }
    return n;
  }
  minimapaMover(dx, dy) {
    const lim = (v, max) => Math.max(-max, Math.min(max, v));
    estadoMinimapa.dx = lim(estadoMinimapa.dx + (dx || 0), COLS);
    estadoMinimapa.dy = lim(estadoMinimapa.dy + (dy || 0), ROWS);
    this.desenharMinimapa();
  }
}

// ---------------------------------------------------------------------
// Fachada para a interface (§2.3)
// ---------------------------------------------------------------------
window.Jogo = {
  pronto: false,
  entrada: { dx: 0, dy: 0 },
  executar(comando) {
    const s = window.gameScene;
    if (s) return s.executarComando(comando);
    return Mundo.executar(MEU_ID, comando);
  },
  selecionarAlvo(id) { window.gameScene?.selecionarAlvo(id || null); },
  acao(nome) {
    const s = window.gameScene;
    if (!s) return null;
    switch (nome) {
      case "atacar": return s.atacarAlvo(false);
      case "flecha": return s.atacarAlvo(true);
      case "interagir": return s.acaoContextual();
      case "pescar": return s.pescar();
      case "orar": return (window.UI?.orar || window.orar)?.("oracao");
      case "pocao": return s.usarPocao();
      case "pocaoFe": return s.usarPocaoFe();
      default: return null;
    }
  },
  usarAtalho(i) { return window.gameScene?.usarHotkey(i); },
  usarHabilidade(i) { return window.gameScene?.usarHabilidadeDaBarra(i); },
  alvoAtual() { return window.gameScene?.alvoId || null; },
  // Minimapa (o MUNDO desenha no #miniMap; a interface só manda): zoom(+1) aproxima e zoom(-1) afasta,
  // em 3 níveis guardados neste navegador; mover(dx, dy) arrasta a janela em casas; centralizar() volta
  // ao jogador; nivel() devolve o nível (0 = mais perto) e janela() as casas mostradas nesse nível.
  minimapa: {
    zoom(delta) {
      const s = window.gameScene;
      if (s) return s.minimapaZoom(delta);
      const n = Math.max(0, Math.min(MINIMAPA_NIVEIS.length - 1, estadoMinimapa.nivel - Math.sign(delta || 0)));
      estadoMinimapa.nivel = n;
      try { localStorage.setItem(CHAVE_MINIMAPA, String(n)); } catch (e) { /* armazenamento bloqueado */ }
      return n;
    },
    mover(dx, dy) { window.gameScene?.minimapaMover(dx, dy); },
    centralizar() { estadoMinimapa.dx = 0; estadoMinimapa.dy = 0; window.gameScene?.desenharMinimapa(); },
    nivel() { return estadoMinimapa.nivel; },
    niveis() { return MINIMAPA_NIVEIS.length; },
    janela() { return { ...MINIMAPA_NIVEIS[estadoMinimapa.nivel] }; },
  },
  podeInteragir() {
    const r = window.gameScene?.podeInteragir();
    return r ? { tipo: r.tipo, id: r.id, rotulo: r.rotulo } : null;
  },
};

// Clique (ou toque) no minimapa: anda até a casa clicada pela rota longa (irAteCasa). O minimapa mostra
// um recorte em volta do jogador; a cena guarda o do último desenho (janelaMinimapa). Vale onde ele
// estiver: na janela Mapa ou sobre o mundo (ali, translúcido com alguém embaixo, o clique passa ao mundo).
function ligarMinimapa() {
  const c = document.getElementById("miniMap");
  if (!c || c.dataset.ligado) return;
  c.dataset.ligado = "1";
  c.addEventListener("click", (e) => {
    const s = window.gameScene, j = s?.janelaMinimapa;
    if (!s?.p || !j || s.trocando || arrastou(e)) return;
    const r = c.getBoundingClientRect();
    const px = ((e.clientX - r.left - c.clientLeft) / (c.clientWidth || 1)) * c.width;
    const py = ((e.clientY - r.top - c.clientTop) / (c.clientHeight || 1)) * c.height;
    if (px < 0 || py < 0 || px >= c.width || py >= c.height) return;
    const x = Math.floor(j.ox + px / j.sx), y = Math.floor(j.oy + py / j.sy);
    if (!s.irAteCasa(x, y) && !(x === s.p.x && y === s.p.y)) s.mensagem?.("Não há caminho até lá.");
    s.desenharMinimapa();
  });
  // arrastar o minimapa (a interface move a janela dele) não é clique: o ponteiro andou mais de 4 px
  let baixo = null;
  c.addEventListener("pointerdown", (e) => { baixo = { x: e.clientX, y: e.clientY }; });
  const arrastou = (e) => !!baixo && Math.hypot(e.clientX - baixo.x, e.clientY - baixo.y) > 4;
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligarMinimapa);
else ligarMinimapa();

// ---------------------------------------------------------------------
// Boot: espera as fontes (no máximo 1,5 s) e cria o jogo em Scale.RESIZE.
// ---------------------------------------------------------------------
function iniciarJogo() {
  const raiz = document.getElementById("game-root");
  if (raiz) {
    raiz.style.position = "relative";
    raiz.style.overflow = "hidden";
  }
  const fontes = document.fonts
    ? Promise.all(['700 15px "Barlow Semi Condensed"', '700 28px "Cinzel"', '14px "Alegreya Sans"'].map((f) => document.fonts.load(f).catch(() => null)))
    : Promise.resolve();
  Promise.race([fontes, new Promise((r) => setTimeout(r, 1500))])
    .catch(() => {})
    .then(() => {
      // O canvas tem o tamanho da área do jogo × devicePixelRatio e o CSS o mostra no tamanho da área
      // (scale.zoom = 1 / dpr): um pixel do canvas para cada pixel da tela, sem o navegador esticar.
      const medida = () => {
        const dpr = dprAtual();
        return { w: Math.max(1, Math.round((raiz?.clientWidth || window.innerWidth) * dpr)), h: Math.max(1, Math.round((raiz?.clientHeight || window.innerHeight) * dpr)), dpr };
      };
      const m0 = medida();
      const jogo = new Phaser.Game({
        type: Phaser.AUTO,
        parent: "game-root",
        pixelArt: true,
        roundPixels: true,
        antialias: false,
        backgroundColor: "#1c1210",
        scale: { mode: Phaser.Scale.NONE, width: m0.w, height: m0.h, zoom: 1 / m0.dpr },
        scene: Cena,
      });
      let ultima = `${m0.w}x${m0.h}@${m0.dpr}`;
      const redimensionar = () => {
        const m = medida(), chave = `${m.w}x${m.h}@${m.dpr}`;
        if (chave === ultima) return;
        ultima = chave;
        // resize antes de setZoom: com zoom 1 (devicePixelRatio 1) o resize do Phaser não mexe no tamanho CSS
        // do canvas, e o setZoom o acerta com o tamanho que estiver valendo. Na ordem inversa, o canvas ficava
        // com o tamanho da medida anterior (uma faixa escura embaixo do mundo ao mudar a altura da conversa).
        jogo.scale.resize(m.w, m.h);
        jogo.scale.setZoom(1 / m.dpr);
      };
      if (window.ResizeObserver && raiz) new ResizeObserver(redimensionar).observe(raiz);
      window.addEventListener("resize", redimensionar);
      jogo.events.once("ready", () => {
        const c = jogo.canvas;
        if (c) { c.style.position = "absolute"; c.style.left = "0"; c.style.top = "0"; }
        redimensionar();
      });
    });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciarJogo);
else iniciarJogo();
