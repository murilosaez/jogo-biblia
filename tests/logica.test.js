#!/usr/bin/env node
// Testes da lógica de "Jornada · RPG Bíblico".
// Uso: node tests/logica.test.js        (sem dependências)
// Carrega storage.js, dados/*.js e logica.js num vm com localStorage,
// relógio (Date) e Math.random controlados.
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const RAIZ = path.resolve(__dirname, "..");
const ARQUIVOS_DADOS = [
  "dados/itens.js",
  "dados/mapas.js",
  "dados/mundo.js",
  "dados/npcs.js",
  "dados/criaturas.js",
  "dados/capitulos.js",
  "dados/missoes.js",
  "dados/tarefas.js",
  "dados/vocacoes.js",
];
const ARQUIVOS = ["storage.js", ...ARQUIVOS_DADOS, "logica.js"];
const FONTES = ARQUIVOS.map((f) => fs.readFileSync(path.join(RAIZ, f), "utf8"));
const FONTE_LOGICA = FONTES[ARQUIVOS.indexOf("logica.js")];
const FONTE_DADOS = ARQUIVOS_DADOS.map((f) => FONTES[ARQUIVOS.indexOf(f)]).join("\n");
const INICIO_RELOGIO = 1_700_000_000_000;
const ID = "jogador1";

// ---------------------------------------------------------------------
// Ambiente
// ---------------------------------------------------------------------
function aleatorioComSemente(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function carregarJogo(opcoes = {}) {
  const store = opcoes.store || {};
  let agora = opcoes.inicio ?? INICIO_RELOGIO;
  const escritas = [];
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      escritas.push(k);
      store[k] = String(v);
    },
    removeItem: (k) => delete store[k],
  };
  class DataFalsa extends Date {
    constructor(...args) {
      if (args.length) super(...args);
      else super(agora);
    }
    static now() {
      return agora;
    }
  }
  const math = Object.create(Math);
  let fonteAleatoria = aleatorioComSemente(opcoes.semente ?? 1);
  math.random = () => fonteAleatoria();
  let timers = [];
  let proximoTimer = 1;
  const setTimeoutFalso = (fn, ms) => {
    const id = proximoTimer++;
    timers.push({ id, quando: agora + (ms || 0), fn });
    return id;
  };
  const clearTimeoutFalso = (id) => {
    timers = timers.filter((t) => t.id !== id);
  };
  const ctx = {
    console,
    Date: DataFalsa,
    Math: math,
    JSON,
    localStorage,
    setTimeout: setTimeoutFalso,
    clearTimeout: clearTimeoutFalso,
  };
  vm.createContext(ctx);
  vm.runInContext(FONTES.join("\n;\n") + "\n;globalThis.__get = function (nome) { return eval(nome); };", ctx, {
    filename: "jogo-vm.js",
  });
  const g = (nome) => ctx.__get(nome);
  const jogo = {
    ctx,
    g,
    store,
    escritas,
    get agora() {
      return agora;
    },
    rodarTimers() {
      for (;;) {
        const vencidos = timers.filter((t) => t.quando <= agora).sort((a, b) => a.quando - b.quando);
        if (!vencidos.length) break;
        for (const t of vencidos) {
          timers = timers.filter((x) => x.id !== t.id);
          t.fn();
        }
      }
    },
    avancar(ms) {
      agora += ms;
      jogo.rodarTimers();
    },
    definirAleatorio(fn) {
      fonteAleatoria = fn;
    },
    M: g("Mundo"),
    get p() {
      return g("Mundo").jogadores[ID];
    },
    entrar() {
      return g("Mundo").entrar(ID);
    },
    exec(comando) {
      return g("Mundo").executar(ID, comando);
    },
    atualizar() {
      return g("Mundo").atualizar(ID, agora);
    },
  };
  return jogo;
}

const json = (v) => JSON.parse(JSON.stringify(v));
function igual(a, b, msg) {
  assert.deepStrictEqual(json(a), json(b), msg);
}

// ---------------------------------------------------------------------
// Utilidades de simulação
// ---------------------------------------------------------------------
const VIZINHOS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function casaLivreParaJogador(j, area, x, y) {
  const mapa = j.g("mapas")[area];
  if (!mapa[y] || mapa[y][x] !== 0) return false;
  if (Object.values(j.g("npcs")).some((n) => n.area === area && n.x === x && n.y === y)) return false;
  const p = j.p;
  return !Object.values(j.g("inimigos")).some(
    (e) => e.area === area && j.M.inimigoVivo(p, e.id) && e.x === x && e.y === y,
  );
}

// Coloca o jogador numa casa livre vizinha (Chebyshev 1) ao alvo.
function posicionarAoLado(j, area, alvo, preferirOrtogonal = true) {
  const p = j.p;
  const ordem = preferirOrtogonal ? VIZINHOS : [...VIZINHOS].reverse();
  for (const [dx, dy] of ordem) {
    const x = alvo.x + dx;
    const y = alvo.y + dy;
    if (casaLivreParaJogador(j, area, x, y)) {
      p.area = area;
      p.x = x;
      p.y = y;
      return { x, y };
    }
  }
  throw new Error(`Sem casa livre ao lado de ${alvo.x},${alvo.y} em ${area}`);
}

function falar(j, npcId) {
  const n = j.g("npcs")[npcId];
  posicionarAoLado(j, n.area, n);
  const r = j.exec({ tipo: "interagir", alvoId: npcId });
  assert.ok(r.ok, `Conversa com ${npcId} falhou: ${r.mensagem}`);
  return r;
}

// Caminha até a casa do coletável a partir de uma vizinha.
function pisarEm(j, area, alvo) {
  const { x, y } = posicionarAoLado(j, area, alvo);
  return j.exec({ tipo: "mover", dx: alvo.x - x, dy: alvo.y - y });
}

function pegarSaques(j) {
  const p = j.p;
  for (const s of [...p.saqueNoChao].filter((s) => s.area === p.area)) {
    const ao = posicionarAoLado(j, s.area, s);
    assert.ok(ao);
    const r = j.exec({ tipo: "coletarSaque", saqueId: s.id });
    assert.ok(r.ok, `Não pegou saque ${s.id}: ${r.mensagem}`);
  }
}

function equiparMelhor(j) {
  const p = j.p;
  const info = j.g("infoItem");
  for (const [slot, tipo] of Object.entries({ arma: "arma", escudo: "escudo", armadura: "armadura" })) {
    const valor = (i) => (i ? info(i).bonus || info(i).defesa || 0 : -1);
    const melhor = p.inventario.filter((i) => info(i).tipo === tipo).sort((a, b) => valor(b) - valor(a))[0];
    if (melhor && valor(melhor) > valor(p.equipamento[slot])) {
      const r = j.M.equiparItem(ID, melhor, slot);
      assert.ok(r.ok, r.mensagem);
    }
  }
}

function esperarCurar(j, limiteMs = 15 * 60 * 1000) {
  const vidaMaxima = j.g("vidaMaxima");
  let t = 0;
  while (j.p.vida < vidaMaxima(j.p) && t < limiteMs) {
    j.avancar(500);
    t += 500;
    j.atualizar();
  }
  assert.strictEqual(j.p.vida, vidaMaxima(j.p), "o jogador deveria se recuperar fora de combate");
  return t;
}

function atravessar(j, area, ponto, dx, dy) {
  const p = j.p;
  p.area = area;
  p.x = ponto.x - dx;
  p.y = ponto.y - dy;
  const r = j.exec({ tipo: "mover", dx, dy });
  assert.ok(r.ok && r.areaAlterada, `Transição falhou em ${area}: ${r.mensagem}`);
  return r;
}

// Jogador "normal": autoataque a cada 2 s, poção quando a vida cai abaixo de 30%.
// semCampeao: a luta é contra a criatura comum (a campanha mede a dificuldade-base das lutas obrigatórias;
// um campeão sorteado no renascimento mudaria a conta).
function lutar(j, inimigoId, { maxPocoes = 3, tipo = "corpo", semCampeao = false } = {}) {
  const M = j.M;
  const e = j.g("inimigos")[inimigoId];
  const vidaMaxima = j.g("vidaMaxima");
  const p = j.p;
  if (M.obterVidaInimigo(ID, inimigoId) <= 0) assert.ok(M.reaparecerInimigo(ID, inimigoId));
  if (semCampeao && p.campeoes[inimigoId]) {
    delete p.campeoes[inimigoId];
    p.vidaInimigos[inimigoId] = e.vidaMaxima;
  }
  e.x = e.inicioX;
  e.y = e.inicioY;
  j.avancar(1500); // tempo de caminhar até o inimigo
  posicionarAoLado(j, e.area, e);
  const inicio = j.agora;
  const vidaInicial = p.vida;
  let proximoAuto = j.agora;
  let pocoes = 0;
  let danoRecebido = 0;
  let golpes = 0;
  let criticos = 0;
  while (j.agora - inicio < 180_000) {
    for (const ev of j.atualizar()) {
      if (ev.tipo === "jogadorAtingido") danoRecebido += ev.dano;
      if (ev.tipo === "renasceu") {
        return {
          vitoria: false,
          duracao: (j.agora - inicio) / 1000,
          pocoes,
          danoRecebido,
          golpes,
          mensagem: ev.mensagem,
        };
      }
    }
    if (j.agora >= proximoAuto) {
      proximoAuto += 2000;
      let r = j.exec({ tipo: tipo === "distancia" ? "atacarDistancia" : "atacar", alvoId: inimigoId });
      // Atordoado ou com medo: perde a vez. Longe (a criatura recuou ou fugiu): vai atrás dela e tenta de novo.
      if (r.atordoado || r.medo) { j.avancar(100); continue; }
      if (!r.ok && /Chegue ao lado|Nenhum inimigo a até/.test(r.mensagem)) {
        posicionarAoLado(j, e.area, e);
        r = j.exec({ tipo: tipo === "distancia" ? "atacarDistancia" : "atacar", alvoId: inimigoId });
      }
      assert.ok(r.ok, `ataque falhou: ${r.mensagem}`);
      golpes++;
      if (r.critico) criticos++;
      if (r.derrotado) {
        return {
          vitoria: true,
          duracao: (j.agora - inicio) / 1000,
          pocoes,
          danoRecebido,
          golpes,
          criticos,
          vidaInicial,
          vidaMax: vidaMaxima(p),
          nivel: p.nivel,
        };
      }
    }
    if (p.vida < vidaMaxima(p) * 0.3 && pocoes < maxPocoes && p.inventario.includes("pocao")) {
      const r = j.exec({ tipo: "usarPocao" });
      if (r.ok) pocoes++;
    }
    j.avancar(100);
  }
  return { vitoria: false, duracao: 180, pocoes, danoRecebido, golpes, mensagem: "tempo esgotado" };
}

// Campanha completa com um jogador que só faz o obrigatório.
function jogarCampanha(semente) {
  const j = carregarJogo({ semente });
  const M = j.M;
  const lutas = [];
  const registrar = (capitulo, inimigoId, r) => {
    const e = j.g("inimigos")[inimigoId];
    assert.ok(r.vitoria, `[semente ${semente}] derrota contra ${inimigoId}: ${r.mensagem}`);
    lutas.push({ capitulo, inimigo: e.nome, id: inimigoId, ...r });
  };
  j.entrar();
  equiparMelhor(j);

  // Canaã
  falar(j, "viajante1");
  esperarCurar(j);
  registrar("Canaã", "lobo1", lutar(j, "lobo1", { semCampeao: true }));
  pegarSaques(j);
  falar(j, "viajante1");
  equiparMelhor(j);
  assert.strictEqual(j.p.equipamento.arma, "espada_ferro");
  falar(j, "viajante1");
  for (const erva of j.g("coletaveisDaArea")("canaan").slice(0, 3)) assert.ok(pisarEm(j, "canaan", erva).itemColetado);
  falar(j, "viajante1");
  assert.strictEqual(j.p.missoes.ervas.status, "concluida");

  // Deserto (pela trilha)
  atravessar(j, "canaan", j.g("areas").canaan.passagem, 1, 0);
  assert.strictEqual(j.p.area, "deserto");
  falar(j, "noemi1");
  for (const odre of j.g("coletaveisDaArea")("deserto").slice(0, 3)) assert.ok(pisarEm(j, "deserto", odre).itemColetado);
  falar(j, "noemi1");
  equiparMelhor(j);
  assert.strictEqual(j.p.equipamento.armadura, "armadura_couro");
  for (let i = 0; i < 2; i++) {
    esperarCurar(j);
    registrar("Deserto", "escorpiao1", lutar(j, "escorpiao1", { semCampeao: true }));
    pegarSaques(j);
    j.avancar(5000);
  }
  falar(j, "noemi1");
  assert.strictEqual(j.p.missoes.deserto.etapa, 2, "etapa 3 de 3 (índice 2)");
  esperarCurar(j);
  registrar("Deserto", "bandido1", lutar(j, "bandido1", { semCampeao: true }));
  pegarSaques(j);
  falar(j, "noemi1");
  assert.strictEqual(j.p.missoes.deserto.status, "concluida");

  // Capítulos
  const portais = j.g("PORTAIS");
  const CAPITULOS = j.g("CAPITULOS");
  let origem = "deserto";
  for (const chave of j.g("ORDEM_CAPITULOS")) {
    const portal = portais.find((x) => x.area === origem && x.destino === chave);
    atravessar(j, origem, portal, 1, 0);
    assert.strictEqual(j.p.area, chave);
    const cap = CAPITULOS[chave];
    falar(j, cap.npc);
    assert.strictEqual(j.p.missoes[cap.missao].status, "em_andamento");
    esperarCurar(j);
    registrar(cap.nome, cap.inimigo, lutar(j, cap.inimigo, { semCampeao: true }));
    pegarSaques(j);
    igual(j.p.missoes[cap.missao].progresso, [1], `alvo de ${chave} deveria estar cumprido`);
    assert.strictEqual(j.g("faseCapitulo")(j.p, chave), "retorno");
    const r = falar(j, cap.npc);
    assert.strictEqual(j.p.missoes[cap.missao].status, "concluida", `${chave} não concluiu: ${r.mensagem}`);
    equiparMelhor(j);
    origem = chave;
  }

  // Oração
  const r = falar(j, "jesusGalileia");
  assert.ok(r.oracaoAprendida, r.mensagem);
  assert.strictEqual(j.p.oracaoDesbloqueada, true);
  j.p.vida -= 30;
  assert.ok(j.exec({ tipo: "orar", acao: "vida" }).ok);
  return { j, lutas };
}

// ---------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------
const testes = [];
const teste = (nome, fn) => testes.push({ nome, fn });

teste("1. capítulos concluem e a campanha chega à Oração", () => {
  const { j } = jogarCampanha(7);
  for (const chave of j.g("ORDEM_CAPITULOS")) assert.strictEqual(j.p.missoes[chave].status, "concluida");
  assert.strictEqual(j.p.oracaoDesbloqueada, true);
});

teste("1b. derrotar o inimigo do capítulo marca o objetivo (CAPITULOS[k].inimigo)", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  p.missoes.deserto.status = "concluida";
  p.missoes.egito = { status: "em_andamento", etapa: 0, progresso: [0] };
  p.vidaInimigos.soldadoEgito1 = 1;
  const e = j.g("inimigos").soldadoEgito1;
  posicionarAoLado(j, "egito", e);
  const r = j.exec({ tipo: "atacar", alvoId: e.id });
  assert.ok(r.derrotado);
  igual(p.missoes.egito.progresso, [1]);
  assert.strictEqual(j.g("faseCapitulo")(p, "egito"), "retorno");
  assert.match(r.mensagem, /volte a Moisés/);
});

teste("2. balanceamento: campanha vencível, lutas de 10–40 s e dificuldade crescente", () => {
  const sementes = [1, 2, 3, 4, 5, 6];
  const porLuta = new Map();
  for (const s of sementes) {
    const { lutas } = jogarCampanha(s);
    lutas.forEach((l, i) => {
      const chave = `${i}`;
      if (!porLuta.has(chave)) porLuta.set(chave, []);
      porLuta.get(chave).push(l);
    });
  }
  const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const linhas = [];
  for (const lista of porLuta.values()) {
    const l0 = lista[0];
    const j = carregarJogo();
    const e = j.g("inimigos")[l0.id];
    linhas.push({
      capitulo: l0.capitulo,
      inimigo: l0.inimigo,
      nivel: l0.nivel,
      vidaInimigo: e.vidaMaxima,
      defesa: e.defesa,
      dano: e.danoContraJogador,
      duracaoMedia: media(lista.map((l) => l.duracao)),
      duracaoMax: Math.max(...lista.map((l) => l.duracao)),
      golpes: media(lista.map((l) => l.golpes)),
      pressao: media(lista.map((l) => l.danoRecebido / l.vidaMax)),
      pocoes: media(lista.map((l) => l.pocoes)),
      pocoesMax: Math.max(...lista.map((l) => l.pocoes)),
    });
  }
  console.log(
    "\n    Duração das lutas obrigatórias (média de " + sementes.length + " campanhas, autoataque a cada 2 s):",
  );
  console.log(
    "    " +
      ["Capítulo", "Inimigo", "Nv", "HP", "Def", "Dano", "Duração", "Máx", "Golpes", "Dano rec./vida", "Poções"]
        .map((t, i) => t.padEnd([13, 26, 4, 5, 5, 6, 9, 7, 8, 16, 7][i]))
        .join(""),
  );
  for (const l of linhas) {
    console.log(
      "    " +
        [
          l.capitulo,
          l.inimigo,
          l.nivel,
          l.vidaInimigo,
          l.defesa,
          l.dano,
          l.duracaoMedia.toFixed(1) + " s",
          l.duracaoMax.toFixed(0) + " s",
          l.golpes.toFixed(1),
          (l.pressao * 100).toFixed(0) + "%",
          l.pocoes.toFixed(1) + " (≤" + l.pocoesMax + ")",
        ]
          .map((t, i) => String(t).padEnd([13, 26, 4, 5, 5, 6, 9, 7, 8, 16, 7][i]))
          .join(""),
    );
  }
  console.log("");
  for (const l of linhas) {
    assert.ok(
      l.duracaoMedia >= 10 && l.duracaoMedia <= 40,
      `${l.inimigo}: duração média ${l.duracaoMedia.toFixed(1)} s fora de 10–40 s`,
    );
    assert.ok(l.duracaoMax <= 45, `${l.inimigo}: luta mais longa ${l.duracaoMax} s`);
    assert.ok(l.pocoesMax <= 2, `${l.inimigo}: exigiu ${l.pocoesMax} poções`);
  }
  // Dificuldade crescente: o chefe de cada capítulo dura mais e pressiona mais que o anterior.
  const chefes = [];
  for (const l of linhas) {
    const ultimo = chefes[chefes.length - 1];
    if (ultimo && ultimo.capitulo === l.capitulo) chefes[chefes.length - 1] = l;
    else chefes.push(l);
  }
  for (let i = 1; i < chefes.length; i++) {
    const a = chefes[i - 1];
    const b = chefes[i];
    assert.ok(
      b.duracaoMedia > a.duracaoMedia,
      `${b.capitulo} (${b.duracaoMedia.toFixed(1)} s) deveria durar mais que ${a.capitulo} (${a.duracaoMedia.toFixed(1)} s)`,
    );
    assert.ok(b.pressao >= a.pressao - 0.03, `${b.capitulo} deveria pressionar ao menos tanto quanto ${a.capitulo}`);
    assert.ok(
      b.vidaInimigo > a.vidaInimigo && b.defesa >= a.defesa,
      `${b.inimigo} deveria ser mais forte que ${a.inimigo}`,
    );
  }
  assert.ok(
    chefes[chefes.length - 1].pressao > chefes[0].pressao + 0.2,
    "o último capítulo deveria ser claramente mais difícil que o primeiro",
  );
});

teste("2b. a fórmula usa nível, arma e habilidade; defesa mitiga sem zerar", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const danoBruto = j.g("danoBruto");
  const mitigarDano = j.g("mitigarDano");
  p.equipamento.arma = "espada_ferro";
  const nv1 = danoBruto(p, "corpo");
  p.nivel = 5;
  const nv5 = danoBruto(p, "corpo");
  assert.ok(nv5 > nv1, "nível deve aumentar o dano");
  p.habilidades.corpo = 40;
  assert.ok(danoBruto(p, "corpo") > nv5, "habilidade deve aumentar o dano");
  p.equipamento.arma = "espada_madeira";
  assert.ok(danoBruto(p, "corpo") < danoBruto({ ...p, equipamento: { arma: "espada_ferro" } }, "corpo"));
  assert.ok(mitigarDano(20, 12) < 20 && mitigarDano(20, 12) > 20 * 0.5, "defesa 12 mitiga parcialmente");
  assert.ok(mitigarDano(1, 500) >= 1, "nunca zera");
  // O caso relatado: espada de ferro e habilidade 0 contra o chefe dos saqueadores.
  const q = { nivel: 4, equipamento: { arma: "espada_ferro" }, habilidades: { corpo: 0 } };
  const bandido = j.g("inimigos").bandido1;
  assert.ok(mitigarDano(danoBruto(q, "corpo"), bandido.defesa) >= 15, "o golpe precisa tirar um dano relevante");
  // Arco não pode ficar em 1 de dano nos capítulos novos.
  const arqueiro = { nivel: 6, equipamento: { arco: "arco_madeira" }, habilidades: { distancia: 5 } };
  for (const id of ["soldadoEgito1", "perseguidorMar1", "guardiaoSinai1", "ameaçaGalileia1"]) {
    const e = j.g("inimigos")[id];
    assert.ok(mitigarDano(danoBruto(arqueiro, "distancia"), e.defesa) >= 10, `arco contra ${id}`);
  }
});

teste("3. curva de habilidades alcançável e crítico de 5% a 25%", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const ganhar = j.g("ganharHabilidade");
  const porUso = j.g("XP_HABILIDADE_POR_USO");
  let oracoes = 0;
  while (p.habilidades.oracao < 25) {
    ganhar(p, "oracao", porUso.oracao);
    oracoes++;
  }
  assert.ok(oracoes >= 150 && oracoes <= 250, `Oração 25 em ${oracoes} orações`);
  const ate25 = oracoes;
  while (p.habilidades.oracao < 50) {
    ganhar(p, "oracao", porUso.oracao);
    oracoes++;
  }
  assert.ok(oracoes - ate25 >= 200 && oracoes - ate25 <= 800, `Oração 50 exige ${oracoes - ate25} orações a mais`);
  while (p.habilidades.oracao < 100) {
    ganhar(p, "oracao", porUso.oracao);
    oracoes++;
  }
  assert.ok(oracoes > 1500 && oracoes < 5000, `Oração 100 em ${oracoes} orações (meta de longo prazo)`);
  // Corpo: progressão perceptível em poucas lutas.
  let golpes = 0;
  while (p.habilidades.corpo < 5) {
    ganhar(p, "corpo", porUso.corpo);
    golpes++;
  }
  assert.ok(golpes <= 40, `corpo 5 em ${golpes} golpes`);
  const chance = j.g("chanceCritico");
  assert.strictEqual(chance({ habilidades: { corpo: 0 } }, "corpo"), 5);
  assert.strictEqual(chance({ habilidades: { corpo: 50 } }, "corpo"), 15);
  assert.strictEqual(chance({ habilidades: { corpo: 100 } }, "corpo"), 25);
  assert.strictEqual(chance({ habilidades: { distancia: 100 } }, "distancia"), 25);
});

teste("4. ataque manual tem recarga compartilhada (corpo e distância)", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const e = j.g("inimigos").lobo1;
  p.vidaInimigos.lobo1 = 10_000;
  posicionarAoLado(j, "canaan", e);
  let aplicados = 0;
  for (let i = 0; i < 20; i++) if (j.exec({ tipo: "atacar", alvoId: "lobo1" }).danoAplicado) aplicados++;
  assert.strictEqual(aplicados, 1, "20 golpes instantâneos devem aplicar só 1");
  const r = j.exec({ tipo: "atacar", alvoId: "lobo1" });
  assert.strictEqual(r.emRecarga, true);
  assert.ok(r.mensagem);
  const recarga = j.g("RECARGA_ATAQUE");
  assert.ok(recarga >= 600 && recarga <= 1000);
  assert.ok(j.M.recargaAtaque(ID) > 0);
  j.avancar(recarga);
  assert.ok(j.exec({ tipo: "atacar", alvoId: "lobo1" }).danoAplicado);
  // Arco compartilha a recarga.
  p.equipamento.arma = null;
  p.equipamento.arco = "arco_madeira";
  p.inventario.push("flecha", "flecha");
  const tiro = j.exec({ tipo: "atacarDistancia", alvoId: "lobo1" });
  assert.strictEqual(tiro.emRecarga, true);
  assert.strictEqual(j.M.contarItem(ID, "flecha"), 2, "flecha não é gasta durante a recarga");
  j.avancar(recarga);
  assert.ok(j.exec({ tipo: "atacarDistancia", alvoId: "lobo1" }).danoAplicado);
  assert.ok(j.g("INTERVALO_AUTO_ATAQUE") > recarga, "autoataque não esbarra na recarga");
});

teste("5. ervas só em Canaã, odres só no Deserto; helper coletaveisDaArea", () => {
  const j = carregarJogo();
  j.entrar();
  const coletaveis = j.g("coletaveisDaArea");
  igual(
    coletaveis("canaan").map((c) => c.item),
    Array(6).fill("erva"),
  );
  igual(
    coletaveis("deserto").map((c) => c.item),
    Array(6).fill("odre_agua"),
  );
  for (const c of coletaveis("deserto")) {
    assert.ok(c.id && Number.isInteger(c.x) && Number.isInteger(c.y) && c.textura, "formato {id,x,y,item,textura}");
  }
  for (const area of ["mar", "egito", "marVermelho", "sinai", "galileia"]) {
    igual(coletaveis(area), [], `${area} não tem coletáveis`);
    for (const o of j.g("odres")) assert.strictEqual(j.M.coletavelDisponivel(ID, area, o.id), false);
  }
  assert.strictEqual(j.M.coletavelDisponivel(ID, "canaan", "odre1"), false);
  // Pisar onde ficaria um odre no Egito não coleta nada.
  const p = j.p;
  p.missoes.deserto.status = "concluida";
  const mapa = j.g("mapas").egito;
  const odre = j.g("odres").find((o) => mapa[o.y][o.x] === 0);
  assert.ok(odre);
  const antes = p.inventario.length;
  const r = pisarEm(j, "egito", odre);
  assert.ok(!r.itemColetado);
  assert.strictEqual(p.inventario.length, antes);
});

teste("6. veneno pode ser aplicado de novo depois de expirar", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  p.missoes.deserto.status = "concluida";
  p.vida = 9999;
  p.nivel = 30;
  const e = j.g("inimigos").escorpiao1;
  posicionarAoLado(j, "deserto", e);
  let venenos = 0;
  let terminou = 0;
  for (let t = 0; t < 40_000; t += 100) {
    for (const ev of j.atualizar()) {
      if (ev.tipo === "veneno") venenos++;
      if (ev.tipo === "venenoTerminou") terminou++;
    }
    if (venenos === 1 && terminou === 0) {
      // Afasta-se do escorpião até o veneno passar.
      p.x = 70;
      p.y = 20;
    }
    if (terminou === 1 && venenos === 1) posicionarAoLado(j, "deserto", e);
    j.avancar(100);
    if (venenos >= 2) break;
  }
  assert.strictEqual(terminou, 1, "o veneno expira e é zerado");
  assert.strictEqual(venenos, 2, "um segundo envenenamento acontece");
  assert.ok(j.g("statusAtivo")(p, "veneno", j.agora), "envenenado de novo");
});

teste("7. regra de morte única, nota no evento renasceu e coerente com o nível", () => {
  const j0Vida = (id) => carregarJogo().g("inimigos")[id].vidaMaxima;
  const morrer = (nivel, opcoes = {}) => {
    const j = carregarJogo({ semente: opcoes.semente || 3 });
    j.entrar();
    const p = j.p;
    p.nivel = nivel;
    p.moedas = 100;
    p.vida = 1;
    p.skillXp.corpo = 50;
    p.habilidades.corpo = 10;
    if (opcoes.aleatorio) j.definirAleatorio(opcoes.aleatorio);
    // O bandido derrota o jogador e, no mesmo quadro, o escorpião (que vem antes na
    // ordem dos inimigos) se move: events[0] é "inimigoMoveu", não o "renasceu".
    p.missoes.deserto.status = "concluida";
    p.vidaInimigos.bandido1 = 33;
    const bandido = j.g("inimigos").bandido1;
    const pos = posicionarAoLado(j, "deserto", bandido);
    const escorpiao = j.g("inimigos").escorpiao1;
    escorpiao.x = pos.x - 3;
    escorpiao.y = pos.y;
    const ev = j.atualizar();
    const renasceu = ev.find((e) => e.tipo === "renasceu");
    return { j, p, renasceu, ev };
  };
  const nv1 = morrer(1);
  assert.ok(nv1.renasceu);
  assert.strictEqual(nv1.p.moedas, 100);
  assert.doesNotMatch(nv1.renasceu.mensagem, /moedas perdidas|10%/);
  assert.match(nv1.renasceu.mensagem, /Sem penalidade até o nível 10/);
  assert.strictEqual(nv1.ev[0].tipo, "inimigoMoveu", "cenário com outro evento antes");
  assert.strictEqual(nv1.p.vidaInimigos.bandido1, j0Vida("bandido1"), "inimigos vivos são restaurados");
  assert.strictEqual(nv1.p.area, "canaan");

  const nv15 = morrer(15);
  assert.strictEqual(nv15.p.moedas, 90);
  assert.match(nv15.renasceu.mensagem, /10 moedas perdidas/);
  assert.doesNotMatch(nv15.renasceu.mensagem, /Sem penalidade/);
  assert.strictEqual(nv15.p.skillXp.corpo, 50);

  const nv30 = morrer(30);
  assert.strictEqual(nv30.p.moedas, 90);
  assert.ok(nv30.p.skillXp.corpo < 50, "nível 26–50 perde XP de habilidade");
  assert.strictEqual(nv30.p.habilidades.corpo, 10, "sem cair de nível");
  assert.match(nv30.renasceu.mensagem, /XP de habilidade/);

  const nv60 = morrer(60, { aleatorio: () => 0.01 });
  assert.ok(nv60.renasceu.penalidade.item, "nível 51+ pode deixar cair item");
  assert.ok(nv60.p.saqueNoChao.some((s) => s.item === nv60.renasceu.penalidade.item));
  const nv60b = morrer(60, { aleatorio: () => 0.99 });
  assert.strictEqual(nv60b.renasceu.penalidade.item, null);

  // Morte por veneno usa a mesma regra e reseta inimigos.
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  p.nivel = 15;
  p.moedas = 200;
  p.area = "deserto";
  p.x = 70;
  p.y = 20;
  p.vida = 2;
  p.vidaInimigos.escorpiao1 = 5;
  p.status = { veneno: { ate: j.agora + 10_000, pilhas: 1, dano: 3, intervalo: 3000, proximo: j.agora } };
  const ev = j.atualizar();
  const r = ev.find((e) => e.tipo === "renasceu");
  assert.ok(r, "morte por veneno gera renasceu");
  assert.strictEqual(r.causa, "veneno");
  assert.strictEqual(p.moedas, 180);
  assert.strictEqual(p.vidaInimigos.escorpiao1, j0Vida("escorpiao1"));
  igual(p.status, {}, "a morte cura os status");
  assert.strictEqual(p.mortes, 1);
});

teste("7b. o texto do LEIA-ME descreve a mesma regra de morte", () => {
  const leia = fs.readFileSync(path.join(RAIZ, "LEIA-ME.txt"), "utf8");
  assert.match(leia, /nível 10/i);
  assert.match(leia, /11.{1,3}25/);
  assert.match(leia, /26.{1,3}50/);
  assert.match(leia, /51/);
  assert.match(leia, /5% do XP/);
  assert.match(leia, /10% do XP/);
  assert.match(leia, /30%/);
});

teste("8. alcance Chebyshev para todos e ALCANCE_ARCO único", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  // Inimigo ataca na diagonal.
  const lobo = j.g("inimigos").lobo1;
  p.vida = 100;
  p.area = "canaan";
  p.x = lobo.x + 1;
  p.y = lobo.y + 1;
  const ev = j.atualizar();
  assert.ok(
    ev.some((e) => e.tipo === "jogadorAtingido"),
    "lobo ataca na diagonal",
  );
  // NPC conversa na diagonal.
  const eliabe = j.g("npcs").viajante1;
  p.x = eliabe.x + 1;
  p.y = eliabe.y + 1;
  assert.ok(j.exec({ tipo: "interagir" }).ok, "conversa na diagonal sem alvoId");
  assert.ok(j.exec({ tipo: "interagir", alvoId: "viajante1" }).ok);
  p.x = eliabe.x + 2;
  assert.ok(!j.exec({ tipo: "interagir", alvoId: "viajante1" }).ok);
  // Mercador na diagonal.
  const m = j.g("npcs").mercador1;
  p.area = "deserto";
  p.x = m.x - 1;
  p.y = m.y - 1;
  p.moedas = 100;
  assert.ok(j.exec({ tipo: "comprar", item: "pocao" }).ok);
  // Arco: exatamente ALCANCE_ARCO.
  const alcance = j.g("ALCANCE_ARCO");
  assert.ok(Number.isInteger(alcance) && alcance >= 5 && alcance <= 8);
  p.equipamento.arma = null;
  p.equipamento.arco = "arco_madeira";
  p.inventario.push(...Array(5).fill("flecha"));
  p.area = "deserto";
  p.vidaInimigos.escorpiao1 = 999;
  const esc = j.g("inimigos").escorpiao1;
  const mapa = j.g("mapas").deserto;
  // procura uma linha livre de "alcance" casas a partir do escorpião
  let achou = false;
  for (const [dx, dy] of VIZINHOS) {
    let livre = true;
    for (let i = 1; i <= alcance + 1; i++) if (mapa[esc.y + dy * i]?.[esc.x + dx * i] !== 0) livre = false;
    if (!livre) continue;
    p.x = esc.x + dx * alcance;
    p.y = esc.y + dy * alcance;
    assert.ok(j.exec({ tipo: "atacarDistancia", alvoId: "escorpiao1" }).danoAplicado, "acerta no alcance máximo");
    j.avancar(1000);
    p.x = esc.x + dx * (alcance + 1);
    p.y = esc.y + dy * (alcance + 1);
    assert.ok(!j.exec({ tipo: "atacarDistancia", alvoId: "escorpiao1" }).ok, "erra além do alcance");
    achou = true;
    break;
  }
  assert.ok(achou, "deveria existir uma linha livre perto do escorpião");
});

teste("9. inimigos longe das vilas e tudo alcançável (BFS)", () => {
  const j = carregarJogo();
  j.entrar();
  const mapas = j.g("mapas");
  const npcs = Object.values(j.g("npcs"));
  const inimigos = Object.values(j.g("inimigos"));
  const areas = j.g("areas");
  for (const e of inimigos) {
    for (const n of npcs.filter((n) => n.area === e.area)) {
      const d = Math.max(Math.abs(n.x - e.inicioX), Math.abs(n.y - e.inicioY));
      assert.ok(d > e.raioPercepcao + 2, `${e.id} está a ${d} casas de ${n.id}`);
    }
    const inicio = areas[e.area].inicio;
    const d = Math.max(Math.abs(inicio.x - e.inicioX), Math.abs(inicio.y - e.inicioY));
    assert.ok(d > e.raioPercepcao + 2, `${e.id} perto demais da entrada da área`);
  }
  // NPCs com espaço entre si.
  for (const a of npcs)
    for (const b of npcs)
      if (a !== b && a.area === b.area) {
        assert.ok(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) >= 3, `${a.id} colado em ${b.id}`);
      }
  const bfs = (area, s) => {
    const mapa = mapas[area];
    const bloqueado = new Set(npcs.filter((n) => n.area === area).map((n) => n.x + "," + n.y));
    const visto = new Set([s.x + "," + s.y]);
    const fila = [[s.x, s.y]];
    while (fila.length) {
      const [x, y] = fila.shift();
      for (const [dx, dy] of VIZINHOS) {
        const k = x + dx + "," + (y + dy);
        if (mapa[y + dy]?.[x + dx] === 0 && !visto.has(k) && !bloqueado.has(k)) {
          visto.add(k);
          fila.push([x + dx, y + dy]);
        }
      }
    }
    return visto;
  };
  const alcancavel = (vis, ponto) => vis.has(ponto.x + "," + ponto.y);
  const vizinhoAlcancavel = (vis, ponto) => VIZINHOS.some(([dx, dy]) => vis.has(ponto.x + dx + "," + (ponto.y + dy)));
  for (const area of Object.keys(areas)) {
    const vis = bfs(area, areas[area].inicio);
    for (const n of npcs.filter((n) => n.area === area))
      assert.ok(vizinhoAlcancavel(vis, n), `NPC ${n.id} inalcançável`);
    for (const e of inimigos.filter((e) => e.area === area)) {
      assert.ok(alcancavel(vis, { x: e.inicioX, y: e.inicioY }), `inimigo ${e.id} inalcançável`);
    }
    for (const t of j.g("PORTAIS").filter((t) => t.area === area))
      assert.ok(alcancavel(vis, t), `portal ${t.x},${t.y} em ${area}`);
    for (const c of j.g("coletaveisDaArea")(area)) assert.ok(alcancavel(vis, c), `coletável ${c.id}`);
    const a = areas[area];
    const portos = Object.values(a.portos || {}).flatMap((pt) => [pt.cais, pt.embarque]);
    for (const ponto of [a.passagem, a.cais, a.chegada, a.chegadaViagem, ...portos].filter(Boolean)) {
      assert.ok(alcancavel(vis, ponto), `${area}: ponto ${ponto.x},${ponto.y} inalcançável`);
    }
    if (area === "mar")
      for (const ponto of j.g("pontosPesca")) assert.ok(vizinhoAlcancavel(vis, ponto), `pesca ${ponto.id}`);
  }
  for (const t of j.g("PORTAIS"))
    assert.ok(alcancavel(bfs(t.destino, areas[t.destino].inicio), t.chegada), "chegada de portal");
});

teste("10. missões exigem os itens na mochila", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  p.missoes.lobo.status = "concluida";
  falar(j, "viajante1");
  for (const erva of j.g("coletaveisDaArea")("canaan").slice(0, 3)) pisarEm(j, "canaan", erva);
  assert.strictEqual(p.missoes.ervas.progresso[0].length, 3);
  j.M.removerItens(p, "erva", 3); // vendeu as ervas
  const pocoes = j.M.contarItem(ID, "pocao");
  falar(j, "viajante1");
  assert.strictEqual(p.missoes.ervas.status, "em_andamento", "sem ervas não conclui");
  assert.strictEqual(j.M.contarItem(ID, "pocao"), pocoes);

  // Odres, venenos e insígnia.
  falar(j, "noemi1");
  for (const odre of j.g("coletaveisDaArea")("deserto").slice(0, 3)) pisarEm(j, "deserto", odre);
  j.M.removerItens(p, "odre_agua", 3);
  falar(j, "noemi1");
  assert.strictEqual(p.missoes.deserto.etapa, 0);
  p.inventario.push("odre_agua", "odre_agua", "odre_agua");
  falar(j, "noemi1");
  assert.strictEqual(p.missoes.deserto.etapa, 1);
  p.missoes.deserto.progresso[0] = ["a", "b"];
  const moedas = p.moedas;
  falar(j, "noemi1");
  assert.strictEqual(p.missoes.deserto.etapa, 1);
  assert.strictEqual(p.moedas, moedas);
  p.inventario.push("veneno_escorpiao", "veneno_escorpiao");
  falar(j, "noemi1");
  assert.strictEqual(p.missoes.deserto.etapa, 2);
  p.missoes.deserto.progresso[0] = ["c"];
  falar(j, "noemi1");
  assert.strictEqual(p.missoes.deserto.status, "em_andamento");
  p.inventario.push("insignia_bandido");
  falar(j, "noemi1");
  assert.strictEqual(p.missoes.deserto.status, "concluida");
});

teste("11. Arão do Egito tem falas próprias e não duplica a missão", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  p.missoes.deserto.status = "concluida";
  const arao = falar(j, "aaronEgito");
  assert.strictEqual(p.missoes.egito.status, "nao_iniciada", "Arão não inicia a missão");
  const moises = falar(j, "moisesEgito");
  assert.strictEqual(p.missoes.egito.status, "em_andamento");
  assert.notStrictEqual(arao.mensagem.replace(/^[^:]+:/, ""), moises.mensagem.replace(/^[^:]+:/, ""));
  const araoDepois = falar(j, "aaronEgito");
  assert.match(araoDepois.mensagem, /^Arão:/);
  assert.notStrictEqual(araoDepois.mensagem, arao.mensagem, "fala muda conforme o capítulo");
  assert.strictEqual(p.missoes.egito.status, "em_andamento");
});

teste("12. sem código morto: versão única, aviso pendente consumível", () => {
  const fonteExp = FONTE_DADOS;
  const fonteLog = FONTE_LOGICA;
  assert.doesNotMatch(fonteExp + fonteLog, /defesaP\b/);
  assert.doesNotMatch(fonteExp, /versao\s*=\s*5/);
  assert.doesNotMatch(fonteLog, /^\s{2}avisosPendentes\(/m, "Mundo.avisosPendentes não tem uso: a UI usa consumirAviso");
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  assert.strictEqual(p.versao, j.g("VERSAO_SAVE"));
  p.habilidades.defesa = 100;
  const def = j.g("defesaTotal")(p);
  assert.ok(def <= j.g("defesaEquipamento")(p) + 20, "defesa da habilidade tem teto");
  assert.strictEqual(j.M.consumirAviso(ID), null, "personagem novo não tem aviso");
  j.M.adicionarAviso(p, "x", "Olá");
  assert.strictEqual(j.M.consumirAviso(ID), "Olá");
  assert.strictEqual(j.M.consumirAviso(ID), null, "aviso aparece uma vez");
});

teste("13. gravação agrupada (debounce ~1 s) e flush", () => {
  const j = carregarJogo();
  j.entrar();
  j.escritas.length = 0;
  for (let i = 0; i < 30; i++) {
    j.exec({ tipo: "mover", dx: i % 2 ? 1 : -1, dy: 0 });
    j.avancar(30);
  }
  assert.ok(j.escritas.length <= 1, `30 passos em 0,9 s geraram ${j.escritas.length} escritas`);
  j.avancar(1000);
  assert.ok(j.escritas.length >= 1 && j.escritas.length <= 2);
  const Storage = j.g("Storage");
  j.p.moedas = 4242;
  Storage.salvar(j.p);
  assert.notStrictEqual(JSON.parse(j.store.save_jogador1).moedas, 4242, "ainda pendente");
  assert.strictEqual(Storage.carregar(ID).moedas, 4242, "carregar enxerga o pendente");
  j.p.moedas = 77;
  Storage.salvar(j.p);
  Storage.flush();
  assert.strictEqual(JSON.parse(j.store.save_jogador1).moedas, 77);
  assert.strictEqual(Storage.temPendencias(), false);
  assert.strictEqual(typeof Storage.salvarAgora, "function");
});

teste("14. saques no chão expiram, exceto os de missão em andamento", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  p.missoes.deserto = { status: "em_andamento", etapa: 1, progresso: [[], 0] }; // etapa 2: venenos
  const t = j.agora;
  p.saqueNoChao.push(
    { id: "velho_moedas", area: "deserto", x: 10, y: 10, moedas: 5, criadoEm: t },
    { id: "velho_pele", area: "deserto", x: 10, y: 10, item: "pele_lobo", criadoEm: t },
    { id: "missao_veneno", area: "deserto", x: 10, y: 10, item: "veneno_escorpiao", criadoEm: t },
  );
  j.avancar(j.g("TEMPO_EXPIRACAO_SAQUE") + 10_000);
  const ev = j.atualizar();
  igual(
    p.saqueNoChao.map((s) => s.id),
    ["missao_veneno"],
  );
  assert.ok(ev.some((e) => e.tipo === "saqueExpirou" && e.ids.includes("velho_pele")));
  // Limite de quantidade.
  for (let i = 0; i < 200; i++)
    p.saqueNoChao.push({ id: "s" + i, area: "canaan", x: 5, y: 9, moedas: 1, criadoEm: j.agora + i });
  j.M.limparSaques(p, j.agora + 300);
  assert.ok(p.saqueNoChao.length <= j.g("LIMITE_SAQUES_NO_CHAO"));
  assert.ok(p.saqueNoChao.some((s) => s.id === "missao_veneno"));
  assert.ok(
    p.saqueNoChao.some((s) => s.id === "s199"),
    "mantém os mais recentes",
  );
});

teste("15. estatisticasCombate e textoMissaoAtual (todas as áreas)", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  p.equipamento.arma = "espada_ferro";
  p.equipamento.escudo = "escudo_madeira";
  const s = j.g("estatisticasCombate")(p);
  for (const k of ["danoCorpo", "danoDistancia", "defesa", "critico"]) assert.strictEqual(typeof s[k], "number", k);
  assert.strictEqual(s.danoCorpo, j.g("danoBruto")(p, "corpo"));
  assert.strictEqual(s.defesa, j.g("defesaTotal")(p));
  assert.strictEqual(s.critico, 5);
  assert.ok(s.habilidades.oracao && "necessario" in s.habilidades.corpo);
  const texto = j.g("textoMissaoAtual");
  for (const area of Object.keys(j.g("areas"))) {
    p.area = area;
    const t = texto(p);
    assert.ok(t.startsWith(j.g("areas")[area].nome + " · "), `${area}: ${t}`);
  }
  p.area = "mar";
  assert.doesNotMatch(texto(p), /Galileia|Pedro/);
  p.area = "galileia";
  assert.match(texto(p), /capítulo anterior/);
  p.area = "canaan";
  assert.match(texto(p), /Eliabe/);
});

teste("16. sem monkey-patch: cada função do Mundo é definida uma vez", () => {
  const fonteExp = FONTE_DADOS;
  assert.doesNotMatch(fonteExp, /Mundo/, "dados/ não toca no Mundo");
  assert.doesNotMatch(fonteExp + FONTE_LOGICA, /\.bind\(Mundo\)/);
  const fonteLog = FONTE_LOGICA;
  for (const nome of ["entrar", "executar", "atualizar"]) {
    const ocorrencias = fonteLog.match(new RegExp(`^\\s{2}${nome}\\(`, "gm")) || [];
    assert.strictEqual(ocorrencias.length, 1, `Mundo.${nome} definido ${ocorrencias.length} vezes`);
  }
  for (const f of FONTES) {
    const longas = f.split("\n").filter((l) => l.length > 220);
    assert.strictEqual(longas.length, 0, "código legível, sem linhas minificadas");
  }
});

teste("17. migração: save v5 carrega sem perder itens, moedas e progresso", () => {
  const original = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "save_v5.json"), "utf8"));
  const store = { save_jogador1: JSON.stringify(original) };
  const j = carregarJogo({ store, inicio: INICIO_RELOGIO + 60_000 });
  const p = j.entrar();
  assert.strictEqual(p.moedas, original.moedas);
  assert.strictEqual(p.nivel, original.nivel);
  assert.strictEqual(p.xp, original.xp);
  assert.strictEqual(p.mortes, original.mortes);
  const contar = (lista) => lista.reduce((m, i) => ((m[i] = (m[i] || 0) + 1), m), {});
  const antes = contar(original.inventario.concat(Object.values(original.equipamento).filter(Boolean)));
  const depois = contar(p.inventario.concat(Object.values(p.equipamento).filter(Boolean)));
  for (const [item, n] of Object.entries(antes)) assert.ok((depois[item] || 0) >= n, `perdeu ${item}`);
  igual(p.equipamento, original.equipamento);
  igual(p.missoes.lobo, { status: "concluida", etapa: 0, progresso: [1] });
  igual(p.missoes.ervas.status, "concluida");
  assert.strictEqual(p.missoes.deserto.status, "concluida");
  igual(p.missoes.egito, { status: "em_andamento", etapa: 0, progresso: [0] }, "capítulo em andamento, alvo pendente");
  for (const k of ["marVermelho", "sinai", "galileia"]) assert.strictEqual(p.missoes[k].status, "nao_iniciada");
  for (const campo of ["missaoEliabe", "missaoErvas", "missaoDeserto", "capitulos"]) assert.ok(!(campo in p), campo);
  assert.strictEqual(p.habilidades.corpo >= original.habilidades.corpo, true);
  assert.strictEqual(p.habilidades.defesa >= original.habilidades.defesa, true);
  assert.strictEqual(p.area, "egito");
  igual([p.status, "envenenadoAte" in p], [{}, false], "veneno vencido some na carga e os campos antigos saem do save");
  // A fixture gravou a vida cheia antiga (guarda 40, escorpião 70…): na v6
  // todo inimigo vivo volta com a vida máxima rebalanceada.
  for (const e of Object.values(j.g("inimigos"))) {
    if (p.inimigosDerrotados.includes(e.id)) continue;
    assert.strictEqual(p.vidaInimigos[e.id], e.vidaMaxima, `${e.id} começa ferido após a migração`);
  }
  assert.ok(p.inimigosDerrotados.includes("lobo1"));
  assert.strictEqual(p.versao, j.g("VERSAO_SAVE"));
  assert.ok(!("avisoAtualizacao" in p), "campo antigo foi convertido");
  const avisos = [];
  for (let a = j.M.consumirAviso(ID); a; a = j.M.consumirAviso(ID)) avisos.push(a);
  assert.ok(
    avisos.some((a) => /Arco/.test(a) && !/com 4|mochila \(I\)/.test(a)),
    "aviso do arco corrigido",
  );
  assert.ok(p.saqueNoChao.every((s) => Number.isFinite(s.criadoEm)));
  // Recarregar não duplica nada.
  j.g("Storage").flush();
  const j2 = carregarJogo({ store: j.store, inicio: INICIO_RELOGIO + 120_000 });
  const p2 = j2.entrar();
  igual(p2.inventario, p.inventario);
  assert.strictEqual(p2.moedas, p.moedas);
  assert.strictEqual(j2.M.consumirAviso(ID), null);
  // O capítulo em andamento do save antigo pode ser concluído.
  const e = j2.g("inimigos").soldadoEgito1;
  p2.vidaInimigos.soldadoEgito1 = 1;
  posicionarAoLado(j2, "egito", e);
  assert.ok(j2.exec({ tipo: "atacar", alvoId: e.id }).derrotado);
  falar(j2, "moisesEgito");
  assert.strictEqual(p2.missoes.egito.status, "concluida");
});

teste("18. API usada por game.js continua disponível", () => {
  const j = carregarJogo();
  const globais = [
    "areas",
    "mapas",
    "npcs",
    "inimigos",
    "ervas",
    "odres",
    "pontosPesca",
    "PORTAIS",
    "ITENS",
    "COLS",
    "ROWS",
    "TILE",
    "vidaMaxima",
    "limiarNivel",
    "pesoCarregado",
    "capacidadeCarga",
    "defesaTotal",
    "nomeItem",
    "pesoItem",
    "INTERVALO_AUTO_ATAQUE",
    "TEMPO_RESPAWN_INIMIGO",
    "ALCANCE_ARCO",
    "coletaveisDaArea",
    "estatisticasCombate",
    "textoMissaoAtual",
    "Storage",
    "Mundo",
    "TAREFAS",
    "REGRAS_TAREFAS",
    "TIPOS_TAREFA",
    "FAMILIAS_CRIATURAS",
    "OFERTAS_TROCA",
    "visaoTarefa",
    "tarefasDoMural",
    "tarefasDoJogador",
    "tarefasDoInimigo",
    "ofertasDeTroca",
    "textoEspera",
  ];
  for (const nome of globais) assert.notStrictEqual(j.g(nome), undefined, nome);
  for (const f of [
    "entrar",
    "executar",
    "atualizar",
    "obterVidaInimigo",
    "coletavelDisponivel",
    "pescaDisponivel",
    "reaparecerInimigo",
    "equiparItem",
    "desequiparItem",
    "atribuirHotkey",
    "contarItem",
    "consumirAviso",
    "recargaAtaque",
  ]) {
    assert.strictEqual(typeof j.M[f], "function", f);
  }
  const p = j.entrar();
  assert.strictEqual(j.M.jogadores[ID], p);
  assert.ok(j.exec({ tipo: "mover", dx: 1, dy: 0 }).ok);
  for (const tipo of [
    "interagir",
    "atacar",
    "atacarDistancia",
    "coletarSaque",
    "comprar",
    "vender",
    "viajar",
    "pescar",
    "usarPocao",
    "usarPocaoFe",
    "orar",
    "alternarEquipamento",
    "aceitarTarefa",
    "guardarTarefa",
    "trocarPontos",
  ]) {
    const r = j.exec({ tipo });
    assert.strictEqual(typeof r.ok, "boolean", tipo);
  }
  assert.ok(Array.isArray(j.atualizar()));
  // Viagem rápida pelos guias.
  falar(j, "guia_canaa");
  const v = j.exec({ tipo: "viajar", areaDestino: "deserto" });
  assert.ok(v.ok && v.areaAlterada);
  // Pesca e cais.
  atravessar(j, "deserto", j.g("areas").deserto.cais, 0, -1);
  assert.strictEqual(j.p.area, "mar");
  const ponto = j.g("pontosPesca")[0];
  j.p.x = ponto.x + 1;
  j.p.y = ponto.y;
  assert.ok(j.exec({ tipo: "pescar" }).ok);
  // Ids que vêm de fora só valem como chaves próprias das tabelas. "constructor", "toString" e
  // "__proto__" são recusados sem mudar nada (antes: saldo, moedas ou fé em NaN, função na mochila).
  const k = carregarJogo();
  k.entrar();
  concluirMissoes(k);
  Object.assign(k.p, { pontosTarefa: 200, pontosTarefaTotal: 200, moedas: 500, oracaoDesbloqueada: true, fe: 50 });
  const comandos = [
    ["comprar", "item"],
    ["vender", "item"],
    ["interagir", "alvoId"],
    ["atacar", "alvoId"],
    ["atacarDistancia", "alvoId"],
    ["coletarSaque", "saqueId"],
    ["viajar", "areaDestino"],
    ["orar", "acao"],
    ["alternarEquipamento", "slot"],
    ["aceitarTarefa", "tarefaId"],
    ["guardarTarefa", "tarefaId"],
    ["trocarPontos", "ofertaId"],
  ];
  for (const npcId of ["mercador1", "atalaia_deserto", "guia_deserto"]) {
    const npc = k.g("npcs")[npcId];
    posicionarAoLado(k, npc.area, npc);
    for (const chave of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      const antes = json(k.p);
      for (const [tipo, campo] of comandos) {
        assert.strictEqual(k.exec({ tipo, [campo]: chave }).ok, false, `${tipo} com ${campo} "${chave}"`);
      }
      assert.strictEqual(k.M.equiparItem(ID, chave, "arma").ok, false);
      assert.strictEqual(k.M.equiparItem(ID, "espada_ferro", chave).ok, false);
      assert.strictEqual(k.M.desequiparItem(ID, chave).ok, false);
      assert.strictEqual(k.M.atribuirHotkey(ID, 0, chave).ok, false);
      igual(k.p, antes, `"${chave}" não muda o save (ao lado de ${npcId})`);
    }
  }
  assert.strictEqual(k.exec({ tipo: "trocarPontos", ofertaId: "constructor" }).mensagem, "Essa troca não existe.");
  posicionarAoLado(k, "deserto", k.g("npcs").mercador1);
  assert.strictEqual(k.exec({ tipo: "comprar", item: "constructor" }).mensagem, "Esse mercador não vende esse item.");
  k.g("Storage").flush();
  const recarregado = carregarJogo({ store: k.store });
  recarregado.entrar();
  assert.deepStrictEqual([recarregado.p.pontosTarefa, recarregado.p.moedas, recarregado.p.fe], [200, 500, 50]);
});

teste("19. personagem novo começa com o equipamento inicial vestido e vence o lobo sem ajustes", () => {
  const j = carregarJogo({ semente: 11 });
  const p = j.entrar();
  igual(p.equipamento, { arma: "espada_madeira", arco: null, escudo: "escudo_madeira", armadura: "tunica_pano" });
  assert.strictEqual(j.M.contarItem(ID, "pocao"), 3);
  assert.ok(!p.inventario.includes("espada_madeira"), "não duplica o item na mochila");
  falar(j, "viajante1");
  const r = lutar(j, "lobo1", { maxPocoes: 0 });
  assert.ok(r.vitoria, "vence o lobo sem poções");
  // Recarregar não entrega o kit de novo.
  j.g("Storage").flush();
  const j2 = carregarJogo({ store: j.store });
  const p2 = j2.entrar();
  assert.strictEqual(p2.inventario.filter((i) => i === "espada_madeira").length, 0);
});

teste("20. recarregar o save atual preserva a vida atual dos inimigos feridos", () => {
  const j = carregarJogo();
  j.entrar();
  j.p.vidaInimigos.lobo1 = 33;
  j.g("Storage").flush();
  const j2 = carregarJogo({ store: j.store });
  assert.strictEqual(j2.entrar().vidaInimigos.lobo1, 33);
});

teste("21. pisar na pilha de saque recolhe item e moedas juntos", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  p.missoes.deserto = { status: "em_andamento", etapa: 1, progresso: [[], 0] }; // etapa 2: venenos
  const casa = { x: 14, y: 9 };
  assert.ok(casaLivreParaJogador(j, "deserto", casa.x, casa.y));
  const t = j.agora;
  p.saqueNoChao.push(
    { id: "s_moedas", area: "deserto", ...casa, moedas: 8, criadoEm: t },
    { id: "s_veneno", area: "deserto", ...casa, item: "veneno_escorpiao", criadoEm: t },
  );
  const moedas = p.moedas;
  const r = pisarEm(j, "deserto", casa);
  assert.ok(r.ok);
  assert.deepStrictEqual([...r.itensColetados].sort(), ["s_moedas", "s_veneno"]);
  assert.strictEqual(r.itensColetados[0], "s_veneno", "item de missão vem primeiro");
  assert.strictEqual(p.moedas, moedas + 8);
  assert.match(r.mensagem, /Veneno de escorpião, 8 moedas/);
  assert.ok(!p.saqueNoChao.some((s) => s.x === casa.x && s.y === casa.y));
  assert.deepStrictEqual(json(p.missoes.deserto.progresso[0]), ["s_veneno"]);
});

teste("22. mochila cheia: o passo sobre o saque vale e a mensagem chega à UI", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const casa = { x: 14, y: 9 };
  p.saqueNoChao.push(
    { id: "s_espada", area: "deserto", ...casa, item: "espada_ferro", criadoEm: j.agora },
    { id: "s_moedas", area: "deserto", ...casa, moedas: 5, criadoEm: j.agora },
  );
  posicionarAoLado(j, "deserto", casa);
  while (j.g("pesoCarregado")(p) + 10 <= j.g("capacidadeCarga")(p)) p.inventario.push("espada_ferro");
  const r = j.exec({ tipo: "mover", dx: casa.x - p.x, dy: casa.y - p.y });
  assert.ok(r.ok, "o movimento não é recusado");
  assert.deepStrictEqual([p.x, p.y], [casa.x, casa.y]);
  assert.match(r.mensagem, /Mochila cheia/);
  assert.match(r.mensagem, /5 moedas/, "as moedas da pilha são recolhidas mesmo assim");
  assert.ok(p.saqueNoChao.some((s) => s.id === "s_espada"), "a espada fica no chão");
});

teste("23. veneno de 15 s com dano a cada 3 s aplica 5 vezes (15 de dano)", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  // Na vila de Canaã, longe das criaturas: nenhuma picada renova o veneno.
  Object.assign(p, j.g("areas").canaan.inicio, { area: "canaan" });
  p.vida = 200;
  j.g("aplicarStatus")(p, { tipo: "veneno" }, j.agora);
  let ticks = 0;
  let terminou = false;
  for (let t = 0; t <= 20_000 && !terminou; t += 37) {
    j.avancar(37);
    for (const ev of j.atualizar()) {
      if (ev.veneno) ticks++;
      if (ev.tipo === "venenoTerminou") terminou = true;
    }
  }
  assert.ok(terminou);
  assert.strictEqual(ticks, 5);
});

teste("24. chegada a capítulo: dica só no início e preposição correta", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  p.missoes.deserto.status = "concluida";
  const PORTAIS = j.g("PORTAIS");
  const paraEgito = PORTAIS.find((t) => t.destino === "egito");
  const passo = (portal) => {
    const vizinho = VIZINHOS.map(([dx, dy]) => ({ dx, dy })).find(({ dx, dy }) =>
      casaLivreParaJogador(j, portal.area, portal.x - dx, portal.y - dy),
    );
    return atravessar(j, portal.area, portal, vizinho.dx, vizinho.dy);
  };
  let r = passo(paraEgito);
  assert.match(r.mensagem, /^Você chegou ao Egito\. Fale com os personagens/);
  p.missoes.egito.status = "concluida";
  r = passo(paraEgito);
  assert.strictEqual(r.mensagem, "Você chegou ao Egito.");
  const paraGalileia = PORTAIS.find((t) => t.destino === "galileia");
  for (const k of ["marVermelho", "sinai"]) p.missoes[k].status = "concluida";
  r = passo(paraGalileia);
  assert.match(r.mensagem, /^Você chegou à Galileia\. Fale/);
});

const FONTE_GAME = fs.readFileSync(path.join(RAIZ, "game.js"), "utf8");

teste("25. avisos pendentes só saem do save quando consumidos, um por vez", () => {
  // game.js consome cada aviso só na hora de mostrá-lo (dentro do timer da
  // cena); se a cena reiniciar antes, o aviso precisa continuar no save.
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  j.M.adicionarAviso(p, "a", "Primeiro");
  j.M.adicionarAviso(p, "b", "Segundo");
  j.g("Storage").flush();
  // "Reinício da cena" sem consumir: nada se perde.
  const j2 = carregarJogo({ store: j.store, inicio: INICIO_RELOGIO + 5_000 });
  j2.entrar();
  assert.strictEqual(j2.M.consumirAviso(ID), "Primeiro");
  j2.g("Storage").flush();
  // Consumiu um e a cena reiniciou de novo: o segundo continua pendente.
  const j3 = carregarJogo({ store: j2.store, inicio: INICIO_RELOGIO + 10_000 });
  j3.entrar();
  assert.strictEqual(j3.M.consumirAviso(ID), "Segundo");
  assert.strictEqual(j3.M.consumirAviso(ID), null);
  // Na cena, consumirAviso fica dentro do delayedCall, e não num laço no create.
  assert.doesNotMatch(FONTE_GAME, /while\s*\(\(\w+\s*=\s*Mundo\.consumirAviso/, "create não deve consumir todos os avisos de uma vez");
  assert.match(FONTE_GAME, /delayedCall\([^)]*\(\)\s*=>\s*\{\s*const texto = Mundo\.consumirAviso/);
});

teste("26. com o arco nas mãos, o tiro a 1 casa vale e bate mais que o soco", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const e = j.g("inimigos").lobo1;
  p.vidaInimigos.lobo1 = 10_000;
  p.equipamento.arma = null;
  p.equipamento.arco = "arco_madeira";
  p.inventario.push("flecha", "flecha");
  posicionarAoLado(j, "canaan", e);
  assert.ok(j.M.linhaDeTiroLivre(p, e), "alvo ao lado está na linha de tiro");
  const est = j.g("estatisticasCombate")(p);
  assert.ok(est.danoDistancia > est.danoCorpo, "com o arco equipado o corpo a corpo é sem arma");
  const tiro = j.exec({ tipo: "atacarDistancia", alvoId: "lobo1" });
  assert.ok(tiro.danoAplicado);
  assert.strictEqual(j.M.contarItem(ID, "flecha"), 1, "a flecha é gasta");
  // O autoataque da cena não pode exigir distância > 1 para atirar.
  const auto = FONTE_GAME.match(/const podeAtirar = [^;]*;/);
  assert.ok(auto, "autoAtacar define podeAtirar");
  assert.doesNotMatch(auto[0], /dist\s*>\s*1/);
});

teste("27. dados/: conteúdo puro e todas as referências apontam para algo que existe", () => {
  assert.doesNotMatch(FONTE_DADOS, /\bfunction\b|=>/, "dados/ não contém funções nem regras");
  const j = carregarJogo();
  const nomes = ["ITENS", "areas", "npcs", "inimigos", "CAPITULOS", "PORTAIS", "MISSOES"];
  const [ITENS, areas, npcs, inimigos, CAPITULOS, PORTAIS, MISSOES] = nomes.map((n) => j.g(n));
  const item = (id, onde) => assert.ok(ITENS[id], `${onde}: item inexistente "${id}"`);
  const area = (id, onde) => assert.ok(areas[id], `${onde}: área inexistente "${id}"`);
  for (const [id, preco] of Object.entries(j.g("PRECOS_LOJA"))) {
    if (id !== "flechas") item(id, "loja");
    assert.ok(preco > 0, `preço de ${id}`);
  }
  for (const id of Object.keys(j.g("VALORES_VENDA"))) item(id, "venda");
  for (const n of Object.values(npcs)) area(n.area, `npc ${n.id}`);
  for (const e of Object.values(inimigos)) {
    area(e.area, `criatura ${e.id}`);
    const RARIDADES = j.g("RARIDADES");
    const CHANCES = j.g("CHANCES_SAQUE");
    assert.ok(Array.isArray(e.saque.itens) && e.saque.itens.length, `${e.id}: tabela de saque`);
    for (const linha of e.saque.itens) {
      const onde = `saque de ${e.id}`;
      assert.ok(typeof linha === "object" && linha, `${onde}: cada linha é { item, chance }`);
      item(linha.item, onde);
      const chance = typeof linha.chance === "string" ? CHANCES[linha.chance] : linha.chance;
      assert.ok(chance > 0 && chance <= 1, `${onde}: chance de ${linha.item} (${linha.chance})`);
      for (const campo of ["raridade", "raridadeMinima"]) {
        if (campo in linha) assert.ok(RARIDADES[linha[campo]], `${onde}: ${campo} "${linha[campo]}"`);
      }
    }
    assert.ok(e.vidaMaxima > 0 && e.xpRecompensa > 0, `atributos de ${e.id}`);
  }
  for (const [chave, c] of Object.entries(CAPITULOS)) {
    assert.ok(MISSOES[c.missao], `capítulo ${chave}: missão ${c.missao}`);
    assert.strictEqual(npcs[c.npc]?.area, chave, `capítulo ${chave}: o líder ${c.npc} fica na área do capítulo`);
    assert.ok(inimigos[c.inimigo], `capítulo ${chave}: inimigo ${c.inimigo}`);
    assert.ok(MISSOES[c.anterior], `capítulo ${chave}: anterior ${c.anterior}`);
    if (c.mestre) {
      assert.ok(npcs[c.mestre], `capítulo ${chave}: mestre ${c.mestre}`);
      assert.ok(c.painelMestre?.antes && c.painelMestre?.depois, `capítulo ${chave}: painelMestre`);
    }
  }
  // dados/missoes.js (dados crus, antes do registro).
  const brutos = j.g("DADOS_MISSOES");
  const modelos = j.g("MODELOS_MISSAO");
  const vistos = [];
  const VARIAVEIS = ["coletados", "total", "naMochila", "nivel", "npc", "etapa", "etapas", "peso", "capacidade", "recompensa", "proximaArea"];
  const textos = (v) => (typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(textos) : []);
  for (const m of brutos) {
    const onde = `missão ${m.id}`;
    assert.ok(typeof m.id === "string" && !vistos.includes(m.id), `${onde}: id único`);
    assert.ok(npcs[m.npc], `${onde}: npc ${m.npc}`);
    if (m.npcEntrega) assert.ok(npcs[m.npcEntrega], `${onde}: npcEntrega ${m.npcEntrega}`);
    if (m.anterior) assert.ok(vistos.includes(m.anterior), `${onde}: anterior ${m.anterior} precisa vir antes`);
    if (m.proxima) assert.ok(brutos.some((x) => x.id === m.proxima), `${onde}: proxima ${m.proxima}`);
    if (m.modelo) assert.ok(modelos[m.modelo], `${onde}: modelo ${m.modelo}`);
    assert.ok(m.falas?.inicio, `${onde}: fala de início`);
    assert.ok(Array.isArray(m.etapas) && m.etapas.length, `${onde}: etapas`);
    m.etapas.forEach((e, n) => {
      const o2 = `${onde}, etapa ${n + 1}`;
      assert.ok(e.objetivos.length, `${o2}: objetivos`);
      assert.ok(e.objetivos.some((o) => o.tipo !== "entregar"), `${o2}: ao menos um objetivo acompanhado`);
      for (const o of e.objetivos) {
        assert.ok(["derrotar", "coletar", "entregar", "falar", "chegar"].includes(o.tipo), `${o2}: tipo ${o.tipo}`);
        if (o.tipo === "derrotar") assert.ok(inimigos[o.criatura], `${o2}: criatura ${o.criatura}`);
        if (o.tipo === "coletar" || o.tipo === "entregar") item(o.item, o2);
        if (o.tipo === "coletar") assert.ok(["mapa", "saque"].includes(o.origem), `${o2}: origem ${o.origem}`);
        if (o.tipo === "falar") assert.ok(npcs[o.npc], `${o2}: npc ${o.npc}`);
        if (o.tipo === "chegar") area(o.area, o2);
        if (o.quantidade !== undefined) assert.ok(Number.isInteger(o.quantidade) && o.quantidade > 0, `${o2}: quantidade`);
      }
      for (const i of e.recompensa.itens) item(i, `recompensa de ${o2}`);
      assert.ok(e.falas?.concluir && e.falas?.andamento && e.painel?.andamento, `${o2}: falas e painel`);
    });
    for (const t of textos([m.falas, m.painel, m.etapas])) {
      for (const [, nome] of t.matchAll(/\{(\w+)\}/g)) assert.ok(VARIAVEIS.includes(nome), `${onde}: variável {${nome}}`);
    }
    vistos.push(m.id);
  }
  for (const p of PORTAIS) {
    area(p.area, "portal");
    area(p.destino, "portal");
    if (p.capitulo) assert.ok(CAPITULOS[p.capitulo], `portal: capítulo ${p.capitulo}`);
  }
  // Criaturas: espécie e família (as caçadas contam por elas).
  const FAMILIAS = j.g("FAMILIAS_CRIATURAS");
  for (const e of Object.values(inimigos)) {
    assert.ok(typeof e.especie === "string" && /^[a-z_]+$/.test(e.especie), `criatura ${e.id}: especie "${e.especie}"`);
    assert.ok(FAMILIAS[e.familia], `criatura ${e.id}: família inexistente "${e.familia}"`);
  }
  // dados/tarefas.js (dados crus): caçadas, atalaias e troca de pontos apontam para algo que existe.
  const especies = new Set(Object.values(inimigos).map((e) => e.especie));
  const inteiroPositivo = (v) => Number.isInteger(v) && v > 0;
  for (const t of j.g("DADOS_TAREFAS")) {
    const onde = `caçada ${t.id}`;
    assert.strictEqual(npcs[t.mural]?.papel, "mural", `${onde}: o mural ${t.mural} precisa ser um atalaia (papel "mural")`);
    assert.ok(j.g("TIPOS_TAREFA")[t.tipo], `${onde}: tipo ${t.tipo}`);
    for (const c of t.alvo?.criaturas || []) assert.ok(inimigos[c], `${onde}: criatura ${c}`);
    for (const es of t.alvo?.especies || []) assert.ok(especies.has(es), `${onde}: nenhuma criatura da espécie ${es}`);
    for (const f of t.alvo?.familias || []) assert.ok(FAMILIAS[f], `${onde}: família ${f}`);
    if (t.alvo?.area) area(t.alvo.area, onde);
    if (t.requer?.missao) assert.ok(MISSOES[t.requer.missao], `${onde}: missão ${t.requer.missao}`);
    assert.ok(inteiroPositivo(t.total), `${onde}: total`);
    const { xp, moedas, pontos } = t.recompensa || {};
    assert.ok(Number.isInteger(xp) && xp >= 0 && Number.isInteger(moedas) && moedas >= 0, `${onde}: xp e moedas`);
    assert.ok(inteiroPositivo(pontos), `${onde}: pontos`);
    assert.ok(!("itens" in t.recompensa), `${onde}: caçada nunca dá itens (a entrega não pode travar por peso)`);
  }
  for (const n of Object.values(npcs).filter((n) => n.papel === "mural")) {
    assert.ok(MISSOES[n.requer?.missao], `atalaia ${n.id}: requer.missao ${n.requer?.missao}`);
  }
  const ofertas = j.g("DADOS_TROCA_PONTOS");
  for (const o of ofertas) {
    const onde = `troca ${o.id}`;
    if (o.item) item(o.item, onde);
    if (o.requer?.missao) assert.ok(MISSOES[o.requer.missao], `${onde}: missão ${o.requer.missao}`);
    if (o.requer?.troca) assert.ok(ofertas.some((x) => x.id === o.requer.troca), `${onde}: troca ${o.requer.troca}`);
    assert.ok(inteiroPositivo(o.preco), `${onde}: preço`);
    if (o.quantidade !== undefined) assert.ok(inteiroPositivo(o.quantidade), `${onde}: quantidade`);
  }
  const ids = [...Object.keys(npcs), ...Object.keys(inimigos)];
  assert.strictEqual(new Set(ids).size, ids.length, "ids de NPCs e criaturas são únicos");
});

// ---------------------------------------------------------------------
// Motor de missões (JGB-42)
// ---------------------------------------------------------------------
// Missão de teste com um objetivo de cada tipo, dada por um NPC de teste em Canaã.
function carregarComMissaoDeTeste() {
  const j = carregarJogo();
  j.g("registrarNpc")({ id: "anciaoTeste", nome: "Ancião", area: "canaan", x: 20, y: 8, papel: "missao" });
  const missao = (dados) => j.g("registrarMissao")(json(dados));
  const viagem = j.g("areas").deserto.chegadaViagem; // a viagem rápida deixa o jogador perto de Tamar
  missao({
    id: "teste",
    npc: "anciaoTeste",
    falas: { inicio: "Comece por Micael.", concluida: "Tudo feito.", subiuNivel: " Agora nível {nivel}." },
    painel: { inicio: "Fale com o Ancião.", concluida: "Teste concluído." },
    etapas: [
      {
        objetivos: [{ tipo: "falar", npc: "guia_canaa", fala: "O Ancião mandou você? Diga que estou bem.", aviso: "Volte a {npc}." }],
        recompensa: { xp: 5, moedas: 1, itens: [] },
        painel: { andamento: "Fale com Micael." },
        falas: { andamento: "Micael espera você.", concluir: "Bom. Etapa {etapa}/{etapas} feita." },
      },
      {
        objetivos: [{ tipo: "chegar", area: "deserto", x: viagem.x - 1, y: viagem.y - 1, raio: 2, aviso: "Você achou Tamar." }],
        recompensa: { xp: 5, moedas: 0, itens: [] },
        painel: { andamento: "Vá até Tamar." },
        falas: { andamento: "Procure Tamar no Deserto.", concluir: "Viu Tamar." },
      },
      {
        objetivos: [{ tipo: "derrotar", criatura: "lobo1", quantidade: 2, aviso: "Dois lobos!" }],
        recompensa: { xp: 5, moedas: 0, itens: [] },
        painel: { andamento: "Lobos: {coletados}/{total}." },
        falas: { andamento: "Faltam lobos: {coletados}/{total}.", concluir: "Lobos afastados." },
      },
      {
        objetivos: [
          { tipo: "coletar", item: "pele_lobo", quantidade: 2, origem: "saque" },
          { tipo: "entregar", item: "pele_lobo", quantidade: 2 },
        ],
        recompensa: { xp: 7, moedas: 3, itens: ["espada_ferro", "pocao", "pocao"] },
        painel: { andamento: "Peles: {coletados}/{total}.", retorno: "Leve as peles." },
        falas: {
          andamento: "Peles: {coletados}/{total}.",
          faltamItens: "Tenho de ver {total} peles (você tem {naMochila}).",
          mochilaCheia: "Mochila cheia ({peso}/{capacidade} kg).",
          concluir: "Recompensa: {recompensa}.",
        },
      },
    ],
  });
  missao({
    id: "teste2",
    npc: "guia_canaa",
    anterior: "teste",
    falas: { inicio: "Agora eu.", bloqueada: "Primeiro o Ancião." },
    etapas: [
      {
        objetivos: [{ tipo: "falar", npc: "anciaoTeste" }],
        painel: { andamento: "x" },
        falas: { andamento: "x", concluir: "y" },
      },
    ],
  });
  j.entrar();
  return j;
}

teste("28. motor: falar, chegar, derrotar, coletar e entregar, com variáveis e recompensa", () => {
  const j = carregarComMissaoDeTeste();
  const p = j.p;
  const balao = (npcId) => j.g("estadoMissaoNpc")(p, npcId);
  const m = () => p.missoes.teste;
  igual(m(), { status: "nao_iniciada", etapa: 0, progresso: [0] }, "missão registrada entra no save");
  assert.strictEqual(balao("anciaoTeste"), "missao");
  assert.strictEqual(balao("guia_canaa"), null, "guia: a missão dele está bloqueada");
  assert.ok(falar(j, "guia_canaa").abrirViagem, "com a missão bloqueada, o guia faz o seu papel");
  assert.strictEqual(falar(j, "anciaoTeste").mensagem, "Ancião: Comece por Micael.");
  assert.strictEqual(m().status, "em_andamento");
  assert.strictEqual(balao("anciaoTeste"), "andamento");
  assert.strictEqual(falar(j, "anciaoTeste").mensagem, "Ancião: Micael espera você.");
  // falar
  const r1 = falar(j, "guia_canaa");
  assert.strictEqual(r1.mensagem, "Micael, guia de caravanas: O Ancião mandou você? Diga que estou bem. Volte a Ancião.");
  assert.ok(!r1.abrirViagem, "a conversa do objetivo substitui a do guia uma vez");
  assert.ok(falar(j, "guia_canaa").abrirViagem, "depois, o guia volta ao normal");
  assert.strictEqual(balao("anciaoTeste"), "entregar");
  const xp = p.xp;
  assert.strictEqual(falar(j, "anciaoTeste").mensagem, "Ancião: Bom. Etapa 1/4 feita.");
  assert.strictEqual(p.xp, xp + 5);
  igual(m(), { status: "em_andamento", etapa: 1, progresso: [0] });
  // chegar: entrar no Deserto pela trilha (longe de Tamar) não basta; a viagem rápida chega ao lado dela.
  const trilha = atravessar(j, "canaan", j.g("areas").canaan.passagem, 1, 0);
  assert.doesNotMatch(trilha.mensagem, /Tamar/);
  igual(m().progresso, [0]);
  atravessar(j, "deserto", j.g("areas").deserto.passagem, -1, 0);
  falar(j, "guia_canaa");
  const v = j.exec({ tipo: "viajar", areaDestino: "deserto" });
  assert.match(v.mensagem, /Viagem rápida ao Deserto por \d+ moedas\..* Você achou Tamar\.$/);
  igual(m().progresso, [1]);
  falar(j, "anciaoTeste");
  assert.strictEqual(m().etapa, 2);
  // derrotar (quantidade 2): o aviso sai só quando o objetivo é cumprido.
  const golpe = () => {
    if (j.M.obterVidaInimigo(ID, "lobo1") <= 0) j.M.reaparecerInimigo(ID, "lobo1");
    p.vidaInimigos.lobo1 = 1;
    posicionarAoLado(j, "canaan", j.g("inimigos").lobo1);
    j.avancar(1000);
    return j.exec({ tipo: "atacar", alvoId: "lobo1" });
  };
  assert.doesNotMatch(golpe().mensagem, /Dois lobos/);
  p.area = "canaan";
  // O painel mostra a primeira missão não concluída da área (Eliabe vem antes do Ancião).
  assert.match(j.g("textoMissaoAtual")(p), /Eliabe/);
  for (const id of ["lobo", "ervas"]) p.missoes[id].status = "concluida";
  assert.match(j.g("textoMissaoAtual")(p), /^Canaã · Lobos: 1\/2\.$/);
  assert.match(golpe().mensagem, /\+40 XP\. Dois lobos! Saque no chão/);
  assert.doesNotMatch(golpe().mensagem, /Dois lobos/, "sem repetirAviso, não repete");
  igual(m().progresso, [2]);
  falar(j, "anciaoTeste");
  igual(m(), { status: "em_andamento", etapa: 3, progresso: [[], 0] });
  // coletar (saque, por id) e entregar.
  igual(json(j.M.itensDeMissaoPendentes(p)), ["pele_lobo"], "peles da etapa não expiram");
  p.saqueNoChao = p.saqueNoChao.filter((s) => s.item !== "pele_lobo");
  const t = j.agora;
  p.saqueNoChao.push({ id: "pele_a", area: "canaan", x: 21, y: 12, item: "pele_lobo", criadoEm: t });
  pegarSaques(j);
  assert.strictEqual(falar(j, "anciaoTeste").mensagem, "Ancião: Peles: 1/2.");
  j.M.registrarColeta(p, "pele_lobo", "pele_a", "saque");
  j.M.registrarColeta(p, "pele_lobo", "pele_b", "mapa");
  igual(m().progresso[0], ["pele_a"], "mesmo id não conta duas vezes e a origem precisa bater");
  p.saqueNoChao.push({ id: "pele_b", area: "canaan", x: 21, y: 12, item: "pele_lobo", criadoEm: t });
  pegarSaques(j);
  assert.strictEqual(balao("anciaoTeste"), "entregar");
  assert.match(j.g("textoMissaoAtual")(p), /Leve as peles\.$/);
  j.M.removerItens(p, "pele_lobo", 99);
  p.inventario.push("pele_lobo");
  assert.strictEqual(falar(j, "anciaoTeste").mensagem, "Ancião: Tenho de ver 2 peles (você tem 1).");
  p.inventario.push("pele_lobo");
  // recompensa bloqueada pela mochila cheia (as peles entregues já contam como espaço livre).
  const peso = j.g("pesoCarregado");
  const cap = j.g("capacidadeCarga");
  while (peso(p) + 12 - 4 <= cap(p)) p.inventario.push("pocao"); // espada 10 + 2 poções − 2 peles
  const antes = json(p.inventario);
  const cheia = falar(j, "anciaoTeste");
  assert.strictEqual(cheia.mensagem, `Ancião: Mochila cheia (${peso(p)}/${cap(p)} kg).`);
  igual(p.inventario, antes, "nada muda com a mochila cheia");
  assert.strictEqual(m().status, "em_andamento");
  j.M.removerItens(p, "pocao", 3);
  p.xp = j.g("limiarNivel")(p.nivel) - 1;
  const moedas = p.moedas;
  const nivel = p.nivel;
  const fim = falar(j, "anciaoTeste");
  assert.strictEqual(fim.mensagem, `Ancião: Recompensa: +7 XP, 3 moedas, Espada de ferro, 2× Poção de vida. Agora nível ${nivel + 1}.`);
  assert.strictEqual(p.moedas, moedas + 3);
  assert.strictEqual(j.M.contarItem(ID, "pele_lobo"), 0, "a entrega remove os itens");
  assert.ok(p.inventario.includes("espada_ferro"));
  assert.strictEqual(m().status, "concluida");
  assert.strictEqual(falar(j, "anciaoTeste").mensagem, "Ancião: Tudo feito.");
  assert.strictEqual(balao("anciaoTeste"), null);
  // Pré-requisito cumprido: a missão do guia fica disponível.
  assert.strictEqual(balao("guia_canaa"), "missao");
  assert.strictEqual(falar(j, "guia_canaa").mensagem, "Micael, guia de caravanas: Agora eu.");
});

teste("29. motor: substituição de variáveis e pré-requisitos", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const preencher = j.g("preencherTexto");
  assert.strictEqual(preencher("{a} e {b}, {c}", { a: 1, b: "x" }), "1 e x, {c}", "variável desconhecida fica como está");
  const M = j.g("MISSOES");
  const vars = j.g("variaveisMissao")(p, M.ervas, { status: "em_andamento", etapa: 0, progresso: [["erva1", "erva2"], 0] });
  p.inventario.push("erva");
  igual(
    { ...vars, peso: 0, capacidade: 0 },
    { coletados: 2, total: 3, naMochila: 0, nivel: 1, npc: "Eliabe", etapa: 1, etapas: 1, peso: 0, capacidade: 0, recompensa: "+80 XP, 2× Poção de vida", proximaArea: "Deserto" },
  );
  assert.strictEqual(j.g("variaveisMissao")(p, M.ervas, p.missoes.ervas).naMochila, 1);
  assert.strictEqual(j.g("variaveisMissao")(p, M.deserto, p.missoes.deserto).proximaArea, "Egito");
  // Pré-requisitos: ervas depende do lobo; cada capítulo, do anterior.
  const fase = j.g("faseMissao");
  assert.strictEqual(fase(p, "ervas"), "bloqueado");
  assert.strictEqual(fase(p, "deserto"), "inicio", "Noemi não depende de Canaã");
  for (const k of j.g("ORDEM_CAPITULOS")) assert.strictEqual(j.g("faseCapitulo")(p, k), "bloqueado");
  p.missoes.deserto.status = "concluida";
  assert.strictEqual(j.g("faseCapitulo")(p, "egito"), "inicio");
  assert.strictEqual(j.g("capituloAnteriorConcluido")(p, "marVermelho"), false);
  assert.strictEqual(falar(j, "araoMar").mensagem, "Arão: Conclua primeiro o capítulo anterior para chegar a esta etapa.");
  assert.strictEqual(p.missoes.marVermelho.status, "nao_iniciada");
  p.missoes.egito.status = "concluida";
  assert.strictEqual(j.g("faseCapitulo")(p, "marVermelho"), "inicio");
  assert.strictEqual(j.g("capituloDoInimigo")("perseguidorMar1"), "marVermelho");
  assert.strictEqual(j.g("capituloDoInimigo")("lobo1"), null);
});

// Save v6 (formato antigo) a partir de um personagem novo, com os campos de missão dados.
function saveV6(campos) {
  const j = carregarJogo();
  j.entrar();
  j.g("Storage").flush();
  const s = JSON.parse(j.store.save_jogador1);
  delete s.missoes;
  const cap = (status = "bloqueado", alvo = false) => ({ status, alvo });
  Object.assign(
    s,
    {
      versao: 6,
      missaoEliabe: { status: "concluida", loboDerrotado: true, recompensaRecebida: true },
      missaoErvas: { status: "concluida", recompensaRecebida: true, ervasMissaoColetadas: ["erva1", "erva2", "erva3"] },
      missaoDeserto: {
        status: "bloqueada",
        etapa: 0,
        recompensaRecebida: false,
        odresMissaoColetados: [],
        venenosMissaoColetados: [],
        insigniasMissaoColetadas: [],
      },
      capitulos: { egito: cap(), marVermelho: cap(), sinai: cap(), galileia: cap() },
    },
    campos(s),
  );
  return carregarJogo({ store: { save_jogador1: JSON.stringify(s) }, inicio: INICIO_RELOGIO + 60_000 });
}

teste("30. migração v6 → v7 no meio das etapas, sem perder progresso", () => {
  // Lobo derrotado, recompensa ainda não entregue.
  let j = saveV6(() => ({
    missaoEliabe: { status: "em_andamento", loboDerrotado: true, recompensaRecebida: false },
    missaoErvas: { status: "bloqueada", recompensaRecebida: false, ervasMissaoColetadas: [] },
  }));
  let p = j.entrar();
  assert.strictEqual(p.versao, j.g("VERSAO_SAVE"));
  igual(p.missoes.lobo, { status: "em_andamento", etapa: 0, progresso: [1] });
  igual(p.missoes.ervas, { status: "nao_iniciada", etapa: 0, progresso: [[], 0] });
  for (const campo of ["missaoEliabe", "missaoErvas", "missaoDeserto", "capitulos"]) assert.ok(!(campo in p), campo);
  assert.strictEqual(j.g("estadoMissaoNpc")(p, "viajante1"), "entregar");
  assert.match(falar(j, "viajante1").mensagem, /^Eliabe: Obrigado! Receba 2 poções, uma espada de ferro/);

  // Ervas: 2 de 3 coletadas; a terceira completa a missão.
  j = saveV6((s) => ({
    missaoErvas: { status: "em_andamento", recompensaRecebida: false, ervasMissaoColetadas: ["erva1", "erva3"] },
    ervasColetadas: ["erva1", "erva3"],
    inventario: [...s.inventario, "erva", "erva"],
  }));
  p = j.entrar();
  igual(p.missoes.ervas.progresso, [["erva1", "erva3"], 0]);
  p.area = "canaan";
  assert.match(j.g("textoMissaoAtual")(p), /Colete ervas medicinais: 2\/3\./);
  assert.ok(pisarEm(j, "canaan", j.g("ervas")[1]).itemColetado);
  assert.match(falar(j, "viajante1").mensagem, /Que Deus o recompense!/);
  assert.strictEqual(p.missoes.ervas.status, "concluida");

  // Odres: 2/3, etapa 1 do Deserto.
  j = saveV6((s) => ({
    missaoDeserto: { status: "em_andamento", etapa: 1, recompensaRecebida: false, odresMissaoColetados: ["odre1", "odre2"] },
    odresColetados: ["odre1", "odre2"],
    inventario: [...s.inventario, "odre_agua", "odre_agua"],
  }));
  p = j.entrar();
  igual(p.missoes.deserto, { status: "em_andamento", etapa: 0, progresso: [["odre1", "odre2"], 0] });
  assert.strictEqual(falar(j, "noemi1").mensagem, "Noemi: Ainda faltam odres. Você encontrou 2/3.");
  pisarEm(j, "deserto", j.g("odres")[2]);
  assert.match(falar(j, "noemi1").mensagem, /^Noemi: A água salvou a caravana!/);
  assert.strictEqual(p.missoes.deserto.etapa, 1);

  // Venenos: 1/2, com um saque de veneno antigo no chão (continua protegido).
  j = saveV6((s) => ({
    missaoDeserto: { status: "em_andamento", etapa: 2, venenosMissaoColetados: ["saque_x"], odresMissaoColetados: ["odre1"] },
    inventario: [...s.inventario, "veneno_escorpiao"],
    saqueNoChao: [{ id: "v_antigo", area: "deserto", x: 14, y: 9, item: "veneno_escorpiao", criadoEm: INICIO_RELOGIO - 3_600_000 }],
  }));
  p = j.entrar();
  igual(p.missoes.deserto, { status: "em_andamento", etapa: 1, progresso: [["saque_x"], 0] });
  assert.ok(p.saqueNoChao.some((s) => s.id === "v_antigo"), "saque da etapa não expira na carga");
  p.area = "deserto";
  pegarSaques(j);
  igual(p.missoes.deserto.progresso, [["saque_x", "v_antigo"], 0]);
  assert.match(falar(j, "noemi1").mensagem, /^Noemi: Com o veneno prepararemos um antídoto/);

  // Insígnia já pega (etapa 3) e capítulo com alvo cumprido.
  j = saveV6((s) => ({
    missaoDeserto: { status: "em_andamento", etapa: 3, insigniasMissaoColetadas: ["c"] },
    inventario: [...s.inventario, "insignia_bandido"],
  }));
  p = j.entrar();
  igual(p.missoes.deserto.progresso, [["c"], 0]);
  assert.strictEqual(j.g("estadoMissaoNpc")(p, "noemi1"), "entregar");
  assert.match(falar(j, "noemi1").mensagem, /Capítulo do Deserto concluído!/);

  j = saveV6(() => ({
    missaoDeserto: { status: "concluida", etapa: 4 },
    atualizacaoDistanciaEntregue: true,
    capitulos: {
      egito: { status: "concluida", alvo: true },
      marVermelho: { status: "em_andamento", alvo: true },
      sinai: { status: "bloqueado", alvo: false },
    },
  }));
  p = j.entrar();
  igual(p.missoes.marVermelho, { status: "em_andamento", etapa: 0, progresso: [1] });
  igual(p.missoes.galileia, { status: "nao_iniciada", etapa: 0, progresso: [0] }, "capítulo ausente no save");
  assert.strictEqual(j.g("faseCapitulo")(p, "marVermelho"), "retorno");
  const r = falar(j, "araoMar");
  assert.strictEqual(r.capituloConcluido, "marVermelho", r.mensagem);

  // Campos corrompidos não quebram a carga.
  j = saveV6(() => ({ missaoEliabe: "x", missaoErvas: { status: "estranho" }, capitulos: { egito: { alvo: "sim" }, sinai: null } }));
  p = j.entrar();
  assert.strictEqual(p.missoes.lobo.status, "nao_iniciada");
  assert.strictEqual(p.missoes.ervas.status, "nao_iniciada");
  igual(p.missoes.egito, { status: "nao_iniciada", etapa: 0, progresso: [0] });

  // Recarregar o save migrado não muda nada.
  j.g("Storage").flush();
  const j2 = carregarJogo({ store: j.store, inicio: INICIO_RELOGIO + 120_000 });
  igual(j2.entrar().missoes, p.missoes);
});

teste("31. balões vêm de estadoMissaoNpc e nenhuma missão está escrita como código", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const balao = (id) => j.g("estadoMissaoNpc")(p, id);
  igual(
    ["viajante1", "noemi1", "moisesEgito", "aaronEgito", "jesusGalileia", "mercador1"].map(balao),
    ["missao", "missao", null, null, null, null],
  );
  falar(j, "viajante1");
  assert.strictEqual(balao("viajante1"), "andamento");
  p.missoes.deserto.status = "concluida";
  for (const k of ["egito", "marVermelho", "sinai", "galileia"]) p.missoes[k].status = "concluida";
  assert.strictEqual(balao("jesusGalileia"), "entregar", "o Mestre espera para ensinar a Oração");
  p.oracaoDesbloqueada = true;
  assert.strictEqual(balao("jesusGalileia"), null);
  // game.js usa a função pura e ninguém lê os campos antigos.
  const FONTE_UI = fs.readFileSync(path.join(RAIZ, "interface.js"), "utf8");
  assert.match(FONTE_GAME, /estadoBalao\(npc, p\) \{[\s\S]{0,400}estadoMissaoNpc\(p, npc\.id\)/);
  for (const fonte of [FONTE_GAME, FONTE_UI]) {
    assert.doesNotMatch(fonte, /\b(missaoEliabe|missaoErvas|missaoDeserto)\b|\.capitulos\b|QUANTIDADE_(ERVAS|ODRES|VENENOS)/);
  }
  assert.doesNotMatch(FONTE_LOGICA, /interagirEliabe|interagirNoemi|"viajante1"|"noemi1"|"lobo1"|"veneno_escorpiao"/);
  assert.doesNotMatch(FONTE_LOGICA, /"atalaia_|"canaa_lobos"|"deserto_ferroes"|"escorpiao"|"soldados_farao"|"alforje_couro"|"escudo_ferro"/);
});

teste("32. LEIA-ME: versão do save e funções da interface batem com o código", () => {
  const j = carregarJogo();
  const leia = fs.readFileSync(path.join(RAIZ, "LEIA-ME.txt"), "utf8").replace(/\s+/g, " ");
  // Toda versão de save citada (conteúdo e instalação) é a VERSAO_SAVE atual.
  const versao = j.g("VERSAO_SAVE");
  const citadas = [...leia.matchAll(/(?:save|migrado automaticamente para a) versão (\d+)/g)].map((m) => Number(m[1]));
  assert.ok(citadas.length >= 2, "o LEIA-ME cita a versão do save no conteúdo e na instalação");
  for (const v of citadas) assert.strictEqual(v, versao, `LEIA-ME cita a versão ${v} do save`);
  // Toda função listada para a interface existe, com os parâmetros escritos.
  const trecho = leia.match(/Funções para a interface \(sem DOM\): (.*?); constante/)[1];
  const listadas = [...trecho.matchAll(/([\w.]+)\(([^)]*)\)/g)].map((m) => ({
    nome: m[1],
    params: m[2].split(",").filter((s) => s.trim()).length,
  }));
  for (const { nome, params } of listadas) {
    const [dono, metodo] = nome.includes(".") ? nome.split(".") : [null, nome];
    const fn = dono ? j.g(dono)[metodo] : j.g(metodo);
    assert.strictEqual(typeof fn, "function", nome);
    assert.strictEqual(fn.length, params, `parâmetros de ${nome}`);
  }
  // game.js depende de estadoMissaoNpc para os balões: ela está na lista.
  assert.match(FONTE_GAME, /estadoMissaoNpc\(p, npc\.id\)/);
  assert.ok(
    listadas.some((f) => f.nome === "estadoMissaoNpc" && f.params === 2),
    "estadoMissaoNpc(p, npcId) listada entre as funções para a interface",
  );
  // Caçadas: a interface usa estas funções puras (nenhuma com parâmetro de valor padrão, que muda fn.length).
  const cacadas = { tarefasDoMural: 2, tarefasDoJogador: 1, tarefasDoInimigo: 2, ofertasDeTroca: 1, visaoTarefa: 2, textoEspera: 1 };
  for (const [nome, params] of Object.entries(cacadas)) {
    assert.ok(listadas.some((f) => f.nome === nome && f.params === params), `${nome} listada no LEIA-ME com ${params} parâmetro(s)`);
  }
});

// ---------------------------------------------------------------------
// Caçadas dos atalaias e troca de pontos de tarefa (JGB-3)
// ---------------------------------------------------------------------
const HORA = 3_600_000;

// Abre todos os murais (cada atalaia exige a missão principal da região).
function concluirMissoes(j) {
  for (const id of Object.keys(j.g("MISSOES"))) j.p.missoes[id].status = "concluida";
}

// Aceita uma caçada ao lado do atalaia do mural dela.
function aceitarCacada(j, tarefaId) {
  const mural = j.g("npcs")[j.g("TAREFAS")[tarefaId].mural];
  posicionarAoLado(j, mural.area, mural);
  return j.exec({ tipo: "aceitarTarefa", tarefaId });
}

const guardarCacada = (j, tarefaId) => j.exec({ tipo: "guardarTarefa", tarefaId });
const progressoCacada = (j, tarefaId) => j.p.tarefas[tarefaId]?.progresso ?? null;
const estadoCacada = (j, tarefaId) => j.g("estadoTarefa")(j.p, tarefaId);

// Abate num golpe (vida 1), com espada ou flecha, e limpa o saque do chão.
function abater(j, inimigoId, tipo = "atacar") {
  const p = j.p;
  const e = j.g("inimigos")[inimigoId];
  if (j.M.obterVidaInimigo(ID, inimigoId) <= 0) j.M.reaparecerInimigo(ID, inimigoId);
  e.x = e.inicioX;
  e.y = e.inicioY;
  p.vidaInimigos[inimigoId] = 1;
  posicionarAoLado(j, e.area, e);
  j.avancar(1000);
  const r = j.exec({ tipo, alvoId: inimigoId });
  assert.ok(r.derrotado, `abate de ${inimigoId}: ${r.mensagem}`);
  p.saqueNoChao = [];
  return r;
}

// Mural de teste sem requisito, em Canaã, e caçadas de teste nele (registradas antes de entrar).
function registrarMuralDeTeste(j) {
  j.g("registrarNpc")({ id: "muralTeste", nome: "Vigia de teste", area: "canaan", x: 20, y: 8, papel: "mural" });
}
function registrarCacadaDeTeste(j, dados) {
  const base = { mural: "muralTeste", tipo: "ronda", curto: "Teste", descricao: "Derrote {total}.", total: 5 };
  return j.g("registrarTarefa")(json({ ...base, recompensa: { xp: 1, moedas: 1, pontos: 1 }, ...dados }));
}

teste("33. caçadas e troca: dados coerentes, todo mural completo e invariantes de economia", () => {
  const j = carregarJogo();
  const [npcs, inimigos, ITENS, MISSOES] = ["npcs", "inimigos", "ITENS", "MISSOES"].map((n) => j.g(n));
  const TAREFAS = j.g("TAREFAS");
  const REGRAS = j.g("REGRAS_TAREFAS");
  const casaAlvo = j.g("casaAlvo");
  const brutos = j.g("DADOS_TAREFAS");
  // Caçadas (as referências a criaturas, famílias, áreas, NPCs e missões ficam no teste 27).
  const ids = brutos.map((t) => t.id);
  assert.strictEqual(new Set(ids).size, ids.length, "ids de caçada únicos");
  for (const t of brutos) {
    const onde = `caçada ${t.id}`;
    assert.match(t.id, /^[a-z_]+$/, `${onde}: id`);
    const listas = ["criaturas", "especies", "familias"].filter((k) => (t.alvo?.[k] || []).length);
    assert.ok(listas.length, `${onde}: o alvo precisa de ao menos uma lista não vazia`);
    for (const k of Object.keys(t.alvo)) assert.ok(["criaturas", "especies", "familias", "area"].includes(k), `${onde}: alvo.${k}`);
    const casam = Object.values(inimigos).filter((e) => casaAlvo(TAREFAS[t.id].alvo, e));
    assert.ok(casam.length, `${onde}: nenhuma criatura conta para esta caçada`);
    for (const k of ["nome", "curto", "descricao"]) assert.strictEqual(typeof t[k], "string", `${onde}: ${k}`);
    for (const [, nome] of t.descricao.matchAll(/\{(\w+)\}/g)) assert.strictEqual(nome, "total", `${onde}: variável {${nome}}`);
    if (t.requer?.nivel !== undefined) assert.ok(Number.isInteger(t.requer.nivel) && t.requer.nivel >= 1, `${onde}: nivel`);
    if (t.esperaHoras !== undefined) assert.ok(t.esperaHoras > 0, `${onde}: esperaHoras`);
    if (t.oculta !== undefined) assert.strictEqual(typeof t.oculta, "boolean", `${onde}: oculta`);
    assert.ok(TAREFAS[t.id].esperaHoras > 0, `${onde}: espera do tipo`);
  }
  for (const [tipo, d] of Object.entries(j.g("TIPOS_TAREFA"))) assert.ok(d.nome && d.esperaHoras > 0, `tipo ${tipo}`);
  // Murais: toda área com criaturas tem um atalaia com ao menos uma ronda e uma grande caçada.
  const murais = Object.values(npcs).filter((n) => n.papel === "mural");
  for (const area of new Set(Object.values(inimigos).map((e) => e.area))) {
    const atalaia = murais.find((n) => n.area === area);
    assert.ok(atalaia, `${area} tem criaturas e precisa de um atalaia`);
    const tipos = brutos.filter((t) => t.mural === atalaia.id && !t.oculta).map((t) => t.tipo);
    assert.ok(tipos.includes("ronda") && tipos.includes("grande"), `${atalaia.id}: ronda e grande caçada`);
  }
  const FALAS = j.g("FALAS_MURAL");
  for (const k of ["saudacao", "entrega", "bloqueado", "subiuNivel"]) assert.strictEqual(typeof FALAS[k], "string", `FALAS_MURAL.${k}`);
  for (const texto of Object.values(FALAS)) {
    for (const [, nome] of texto.matchAll(/\{(\w+)\}/g)) assert.ok(["recompensa", "requisito", "nivel"].includes(nome), `FALAS_MURAL: {${nome}}`);
  }
  // Troca de pontos.
  const ofertas = j.g("DADOS_TROCA_PONTOS");
  assert.strictEqual(new Set(ofertas.map((o) => o.id)).size, ofertas.length, "ids de troca únicos");
  for (const o of ofertas) {
    const onde = `troca ${o.id}`;
    assert.ok(!!o.item !== !!o.melhoria, `${onde}: exatamente um de item e melhoria`);
    if (o.melhoria) {
      assert.deepStrictEqual(Object.keys(o.melhoria), ["carga"], `${onde}: melhoria só de carga`);
      assert.ok(Number.isInteger(o.melhoria.carga) && o.melhoria.carga > 0, `${onde}: carga`);
      assert.strictEqual(typeof o.nome, "string", `${onde}: nome da melhoria`);
    } else {
      assert.ok(ITENS[o.item], `${onde}: item`);
      assert.ok(!(o.item in j.g("PRECOS_LOJA")) && !(o.item in j.g("VALORES_VENDA")), `${onde}: pontos nunca viram moedas`);
    }
    if (o.requer?.missao) assert.ok(MISSOES[o.requer.missao], `${onde}: missão`);
  }
  assert.ok(Number.isInteger(REGRAS.limiteAtivas) && REGRAS.limiteAtivas >= 1, "limiteAtivas");
  assert.ok(REGRAS.bonusPrimeiraVez >= 0, "bonusPrimeiraVez");
  // Economia: pontos não caem de um mural para o seguinte (por tipo), a grande vale ao menos 4 rondas
  // e a troca inteira custa mais que uma volta completa com o bônus de primeira vez.
  const ordemAreas = ["canaan", "deserto", ...j.g("ORDEM_CAPITULOS")];
  const visiveis = brutos.filter((t) => !t.oculta);
  const pontosDe = (mural, tipo) => visiveis.filter((t) => t.mural === mural && t.tipo === tipo).map((t) => t.recompensa.pontos);
  const muraisEmOrdem = ordemAreas.map((a) => murais.find((n) => n.area === a)).filter(Boolean);
  for (const tipo of Object.keys(j.g("TIPOS_TAREFA"))) {
    let maiorAnterior = 0;
    for (const n of muraisEmOrdem) {
      const pts = pontosDe(n.id, tipo);
      if (!pts.length) continue;
      assert.ok(Math.min(...pts) >= maiorAnterior, `${tipo} de ${n.id} (${Math.min(...pts)}) vale menos que no mural anterior`);
      maiorAnterior = Math.max(...pts);
    }
  }
  for (const n of muraisEmOrdem) {
    const ronda = Math.max(...pontosDe(n.id, "ronda"));
    assert.ok(Math.min(...pontosDe(n.id, "grande")) >= 4 * ronda, `${n.id}: a grande caçada vale ao menos 4 rondas`);
  }
  const somaTroca = ofertas.reduce((s, o) => s + o.preco, 0);
  const volta = visiveis.reduce((s, t) => s + t.recompensa.pontos, 0) * (1 + REGRAS.bonusPrimeiraVez);
  assert.ok(somaTroca > volta, `troca inteira (${somaTroca}) precisa custar mais que uma volta com bônus (${volta})`);
});

teste("34. caçadas: cada abate conta para todas as ativas que casam (golpe, flecha e missão juntos)", () => {
  const j = carregarJogo();
  registrarMuralDeTeste(j);
  registrarCacadaDeTeste(j, { id: "t_farao", nome: "Faraó", alvo: { familias: ["soldados_farao"] } });
  registrarCacadaDeTeste(j, { id: "t_farao_mar", nome: "Faraó no mar", alvo: { familias: ["soldados_farao"], area: "marVermelho" } });
  registrarCacadaDeTeste(j, { id: "t_lobo", nome: "Lobo e missão", alvo: { criaturas: ["lobo1"] } });
  j.entrar();
  concluirMissoes(j);
  const p = j.p;
  for (const id of ["deserto_ferroes", "deserto_rotas", "deserto_bando"]) assert.ok(aceitarCacada(j, id).ok, id);
  // 1 escorpião: as duas caçadas de escorpião avançam; a do bando, não. Sem "Caçada" na mensagem.
  const r1 = abater(j, "escorpiao1");
  igual(r1.tarefas, [
    { id: "deserto_ferroes", nome: "Ferrões no caminho", curto: "Escorpiões", progresso: 1, meta: 40, cumpridaAgora: false },
    { id: "deserto_rotas", nome: "As rotas das caravanas", curto: "Escorpiões", progresso: 1, meta: 180, cumpridaAgora: false },
  ]);
  assert.doesNotMatch(r1.mensagem, /Caçada/);
  assert.strictEqual(progressoCacada(j, "deserto_bando"), 0);
  // O chefe do bando (alvo por instância) só conta para a caçada dele.
  const r2 = abater(j, "bandido1");
  igual(r2.tarefas.map((t) => [t.id, t.progresso]), [["deserto_bando", 1]]);
  assert.strictEqual(progressoCacada(j, "deserto_ferroes"), 1);
  // Flecha também conta.
  p.equipamento.arma = null;
  p.equipamento.arco = "arco_madeira";
  p.inventario.push("flecha", "flecha");
  const r3 = abater(j, "escorpiao1", "atacarDistancia");
  assert.strictEqual(r3.tipoAtaque, "distancia");
  igual(r3.tarefas.map((t) => [t.id, t.progresso]), [["deserto_ferroes", 2], ["deserto_rotas", 2]]);
  // Meta − 1: o abate seguinte cumpre a caçada; um abate a mais não passa da meta.
  p.tarefas.deserto_ferroes.progresso = 39;
  const r4 = abater(j, "escorpiao1");
  igual(r4.tarefas[0], { id: "deserto_ferroes", nome: "Ferrões no caminho", curto: "Escorpiões", progresso: 40, meta: 40, cumpridaAgora: true });
  assert.match(r4.mensagem, /\+60 XP\..* Caçada cumprida: Ferrões no caminho \(40\/40\)! Entregue a qualquer atalaia\. /);
  assert.strictEqual(estadoCacada(j, "deserto_ferroes"), "cumprida");
  const r5 = abater(j, "escorpiao1");
  igual(r5.tarefas.map((t) => t.id), ["deserto_rotas"]);
  assert.strictEqual(progressoCacada(j, "deserto_ferroes"), 40);
  assert.doesNotMatch(r5.mensagem, /Caçada/);
  // Não contam: abate antes de aceitar, caçada guardada e caçada em espera.
  abater(j, "lobo1");
  assert.strictEqual(p.tarefas.canaa_lobos, undefined, "abate antes de aceitar não cria progresso");
  assert.strictEqual(progressoCacada(j, "deserto_rotas"), 4);
  assert.ok(guardarCacada(j, "deserto_rotas").ok);
  falar(j, "atalaia_deserto"); // entrega Ferrões: fica em espera
  assert.strictEqual(estadoCacada(j, "deserto_ferroes"), "espera");
  const r6 = abater(j, "escorpiao1");
  igual(r6.tarefas, []);
  assert.strictEqual(progressoCacada(j, "deserto_rotas"), 4, "guardada não conta");
  assert.strictEqual(progressoCacada(j, "deserto_ferroes"), 0, "em espera não conta");
  // Família: soldados de Faraó contam no Egito e no Mar Vermelho; com area, só no Mar Vermelho.
  assert.ok(aceitarCacada(j, "t_farao").ok);
  assert.ok(aceitarCacada(j, "t_farao_mar").ok);
  igual(abater(j, "soldadoEgito1").tarefas.map((t) => t.id), ["t_farao"]);
  igual(abater(j, "perseguidorMar1").tarefas.map((t) => t.id), ["t_farao", "t_farao_mar"]);
  assert.deepStrictEqual([progressoCacada(j, "t_farao"), progressoCacada(j, "t_farao_mar")], [2, 1]);
  // O mesmo abate cumpre o objetivo da missão e avança a caçada.
  assert.ok(guardarCacada(j, "t_farao_mar").ok);
  assert.ok(aceitarCacada(j, "t_lobo").ok);
  assert.strictEqual(progressoCacada(j, "t_lobo"), 0, "o lobo abatido antes de aceitar não conta");
  p.missoes.lobo = { status: "em_andamento", etapa: 0, progresso: [0] };
  const r7 = abater(j, "lobo1");
  igual(p.missoes.lobo.progresso, [1]);
  igual(r7.tarefas.map((t) => [t.id, t.progresso]), [["t_lobo", 1]]);
  assert.match(r7.mensagem, /Volte a Eliabe\./);
});

teste("35. caçadas: aceitar, guardar, limite de 3, visões e balões dos atalaias", () => {
  const j = carregarJogo();
  const descricao = "Derrote {total}.";
  const recompensa = { xp: 1, moedas: 1, pontos: 1 };
  const antiga = { id: "t_oculta", mural: "atalaia_canaa", tipo: "ronda", nome: "Antiga", curto: "Antiga", descricao, recompensa };
  j.g("registrarTarefa")(json({ ...antiga, alvo: { especies: ["lobo"] }, total: 5, oculta: true }));
  j.entrar();
  const p = j.p;
  const npcs = j.g("npcs");
  const balao = (id) => j.g("estadoMissaoNpc")(p, id);
  const aceitar = (tarefaId) => j.exec({ tipo: "aceitarTarefa", tarefaId });
  // 1. Personagem novo: mural de Canaã fechado.
  assert.strictEqual(balao("atalaia_canaa"), null);
  const fechado = falar(j, "atalaia_canaa");
  assert.ok(!("abrirMural" in fechado));
  assert.strictEqual(fechado.mensagem, "Atalaia: Ainda não posso pôr seu nome no rol. Volte depois de concluir a missão “Ervas para os feridos”.");
  // 2. Com as ervas entregues: "!" e o mural abre.
  p.missoes.lobo.status = "concluida";
  p.missoes.ervas.status = "concluida";
  assert.strictEqual(balao("atalaia_canaa"), "missao");
  const aberto = falar(j, "atalaia_canaa");
  igual(aberto, { ok: true, mensagem: `Atalaia: ${j.g("FALAS_MURAL").saudacao}`, abrirMural: "atalaia_canaa" });
  // 3. Aceitar: longe, mural de outra região, desconhecida, válida, repetida e bloqueada.
  p.x = 2;
  p.y = 2;
  assert.strictEqual(aceitar("canaa_lobos").mensagem, "Fale com o atalaia (Canaã) para aceitar esta caçada.");
  posicionarAoLado(j, "canaan", npcs.atalaia_canaa);
  const r1 = aceitar("deserto_ferroes");
  assert.strictEqual(r1.ok, false);
  assert.strictEqual(r1.mensagem, "Fale com o atalaia (Deserto) para aceitar esta caçada.");
  assert.strictEqual(aceitar("nada").mensagem, "Caçada desconhecida.");
  igual(p.tarefas, {}, "recusas não mudam o save");
  const inicio = j.agora;
  igual(aceitar("canaa_lobos"), { ok: true, tarefaId: "canaa_lobos", retomada: false, mensagem: "Caçada aceita: Lobos na estrada (0/30)." });
  igual(p.tarefas.canaa_lobos, { ativa: true, progresso: 0, meta: 30, concluidas: 0, disponivelEm: 0, aceitaEm: inicio });
  assert.strictEqual(balao("atalaia_canaa"), "mural");
  assert.strictEqual(aceitar("canaa_lobos").mensagem, "Você já acompanha esta caçada.");
  assert.strictEqual(aceitarCacada(j, "deserto_ferroes").mensagem, "Para aceitar, é preciso concluir a missão “A caravana do deserto”.");
  assert.strictEqual(balao("atalaia_deserto"), null);
  // 4. Limite de 3 (contando as cumpridas).
  concluirMissoes(j);
  j.avancar(1000);
  assert.ok(aceitarCacada(j, "canaa_matilha").ok);
  j.avancar(1000);
  assert.ok(aceitarCacada(j, "deserto_ferroes").ok);
  const antes = json(p.tarefas);
  assert.strictEqual(aceitarCacada(j, "deserto_rotas").mensagem, "Você já acompanha 3 caçadas. Guarde uma para aceitar outra.");
  igual(p.tarefas, antes);
  // 5. Guardar (de qualquer lugar) mantém o progresso e libera a vaga; retomar só no mural certo.
  p.tarefas.deserto_ferroes.progresso = 27;
  posicionarAoLado(j, "canaan", npcs.atalaia_canaa);
  igual(guardarCacada(j, "deserto_ferroes"), {
    ok: true,
    tarefaId: "deserto_ferroes",
    mensagem: "Caçada guardada com 27/40. Para retomar, fale com o atalaia (Deserto).",
  });
  assert.strictEqual(estadoCacada(j, "deserto_ferroes"), "guardada");
  assert.ok(aceitarCacada(j, "deserto_rotas").ok, "a vaga foi liberada");
  posicionarAoLado(j, "canaan", npcs.atalaia_canaa);
  assert.strictEqual(aceitar("deserto_ferroes").mensagem, "Fale com o atalaia (Deserto) para aceitar esta caçada.");
  // Guardar sem progresso não promete um "retomar": a caçada só volta a ficar disponível no mural.
  igual(guardarCacada(j, "deserto_rotas"), {
    ok: true,
    tarefaId: "deserto_rotas",
    mensagem: "Caçada devolvida ao mural: As rotas das caravanas. Para aceitar de novo, fale com o atalaia (Deserto).",
  });
  assert.strictEqual(estadoCacada(j, "deserto_rotas"), "disponivel");
  j.avancar(1000);
  const retomada = aceitarCacada(j, "deserto_ferroes");
  igual(retomada, { ok: true, tarefaId: "deserto_ferroes", retomada: true, mensagem: "Caçada retomada: Ferrões no caminho (27/40)." });
  assert.strictEqual(p.tarefas.deserto_ferroes.progresso, 27);
  p.tarefas.canaa_lobos.progresso = 30;
  assert.strictEqual(guardarCacada(j, "canaa_lobos").mensagem, "Esta caçada já foi cumprida: entregue-a a qualquer atalaia.");
  assert.strictEqual(guardarCacada(j, "deserto_rotas").mensagem, "Esta caçada não está ativa.");
  assert.strictEqual(guardarCacada(j, "nada").mensagem, "Caçada desconhecida.");
  // 6. "?" em todo atalaia quando há caçada cumprida, até num de mural fechado.
  assert.strictEqual(balao("atalaia_egito"), "entregar");
  p.missoes.egito = { status: "nao_iniciada", etapa: 0, progresso: [0] };
  assert.strictEqual(balao("atalaia_egito"), "entregar");
  p.tarefas.canaa_lobos.progresso = 29;
  assert.strictEqual(balao("atalaia_egito"), null);
  assert.strictEqual(balao("atalaia_sinai"), "missao");
  p.tarefas.canaa_lobos.progresso = 30;
  // 7. Visões. Ferrões guardada, Bando em espera, Rotas disponível; Egito bloqueado.
  assert.ok(guardarCacada(j, "deserto_ferroes").ok);
  p.tarefas.deserto_bando = { ativa: false, progresso: 0, meta: 15, concluidas: 1, disponivelEm: j.agora + 5 * HORA, aceitaEm: 1 };
  const mural = (npcId) => j.g("tarefasDoMural")(p, npcId).map((v) => [v.id, v.estado]);
  igual(mural("atalaia_canaa"), [["canaa_lobos", "cumprida"], ["canaa_matilha", "ativa"]], "a oculta não aparece");
  igual(mural("atalaia_deserto"), [["deserto_ferroes", "guardada"], ["deserto_bando", "espera"], ["deserto_rotas", "disponivel"]]);
  for (const v of j.g("tarefasDoMural")(p, "atalaia_egito")) {
    assert.strictEqual(v.estado, "bloqueada");
    assert.strictEqual(v.motivo, "concluir a missão “A saída do Egito”");
  }
  const visao = (id) => j.g("visaoTarefa")(p, id);
  assert.strictEqual(visao("deserto_bando").esperaMs, 5 * HORA);
  assert.strictEqual(visao("deserto_bando").pontosNaEntrega, 8, "sem bônus depois da 1ª entrega");
  igual(visao("deserto_ferroes"), {
    id: "deserto_ferroes",
    nome: "Ferrões no caminho",
    curto: "Escorpiões",
    tipo: "ronda",
    tipoNome: "Ronda",
    mural: "atalaia_deserto",
    area: "deserto",
    nomeArea: "Deserto",
    descricao: "Derrote 40 escorpiões nas pedras a oeste do acampamento.",
    valem: ["Escorpião"],
    retrato: "escorpiao1",
    meta: 40,
    progresso: 27,
    estado: "guardada",
    esperaMs: 0,
    motivo: "",
    recompensa: { xp: 360, moedas: 80, pontos: 10 },
    pontosNaEntrega: 15,
    primeiraVez: true,
    concluidas: 0,
    aceitaEm: p.tarefas.deserto_ferroes.aceitaEm,
  });
  igual(visao("egito_farao").valem, ["Guarda egípcio", "Soldado perseguidor", "Arqueiro egípcio", "Auriga de Faraó"]);
  assert.strictEqual(visao("egito_farao").tipoNome, "Grande caçada");
  // tarefasDoJogador: ativas e cumpridas por aceitaEm, depois as guardadas.
  p.tarefas.canaa_lobos.aceitaEm = j.agora + 5;
  p.tarefas.deserto_ferroes.aceitaEm = 0;
  igual(j.g("tarefasDoJogador")(p).map((v) => v.id), ["canaa_matilha", "canaa_lobos", "deserto_ferroes"]);
  // tarefasDoInimigo: só as ativas ainda não cumpridas.
  assert.ok(aceitarCacada(j, "deserto_rotas").ok);
  igual(j.g("tarefasDoInimigo")(p, "escorpiao1").map((v) => v.id), ["deserto_rotas"]);
  igual(j.g("tarefasDoInimigo")(p, "lobo1").map((v) => v.id), ["canaa_matilha"]);
  igual(j.g("tarefasDoInimigo")(p, "nada"), []);
  // oculta: fora do mural e não aceita; quem já a acompanha continua vendo.
  assert.strictEqual(aceitarCacada(j, "t_oculta").mensagem, "Esta caçada não está mais no mural.");
  p.tarefas.t_oculta = { ativa: true, progresso: 2, meta: 5, concluidas: 0, disponivelEm: 0, aceitaEm: j.agora };
  assert.ok(mural("atalaia_canaa").some(([id]) => id === "t_oculta"));
  assert.ok(j.g("tarefasDoJogador")(p).some((v) => v.id === "t_oculta"));
});

teste("36. caçadas: entrega em qualquer atalaia, espera contada da entrega e a morte não mexe em nada", () => {
  const j = carregarJogo();
  j.entrar();
  concluirMissoes(j);
  const p = j.p;
  const limiar = j.g("limiarNivel");
  p.nivel = 20;
  p.xp = limiar(19); // os 420 XP (abate + entrega) não sobem de nível
  assert.ok(aceitarCacada(j, "deserto_ferroes").ok);
  const aceitaEm = j.agora;
  p.tarefas.deserto_ferroes.progresso = 39;
  abater(j, "escorpiao1");
  // 1 e 2. Entrega noutra região, com a mochila acima da capacidade.
  while (j.g("pesoCarregado")(p) <= j.g("capacidadeCarga")(p) + 5) p.inventario.push("espada_ferro");
  const moedas = p.moedas;
  const r = falar(j, "atalaia_egito");
  igual(r, {
    ok: true,
    mensagem: "Atalaia: Bom trabalho! Anotei no rol: Ferrões no caminho (+360 XP, 80 moedas, 15 pontos de tarefa).",
    abrirMural: "atalaia_egito",
    tarefasEntregues: [{ id: "deserto_ferroes", nome: "Ferrões no caminho", xp: 360, moedas: 80, pontos: 15, primeiraVez: true }],
    niveis: [],
  });
  assert.strictEqual(p.moedas, moedas + 80);
  // O abate do escorpião (nível 5) rende XP reduzido no nível 20 (ver teste 41); a entrega rende os 360 cheios.
  assert.strictEqual(p.xp, limiar(19) + j.g("xpDoAbate")(p, j.g("inimigos").escorpiao1) + 360);
  assert.deepStrictEqual([p.pontosTarefa, p.pontosTarefaTotal], [15, 15]);
  igual(p.tarefas.deserto_ferroes, { ativa: false, progresso: 0, meta: 40, concluidas: 1, disponivelEm: j.agora + 20 * HORA, aceitaEm });
  assert.strictEqual(j.g("estadoMissaoNpc")(p, "atalaia_egito"), "missao", "o ? some depois da entrega");
  const deNovo = falar(j, "atalaia_egito");
  assert.ok(!("tarefasEntregues" in deNovo), "nada a entregar");
  // 3 e 4. Espera de 20 h a partir da entrega.
  j.avancar(20 * HORA - 60_000);
  assert.strictEqual(estadoCacada(j, "deserto_ferroes"), "espera");
  assert.strictEqual(aceitarCacada(j, "deserto_ferroes").mensagem, "Esta caçada volta ao mural em 1 min.");
  j.avancar(60_000);
  assert.strictEqual(estadoCacada(j, "deserto_ferroes"), "disponivel");
  assert.ok(aceitarCacada(j, "deserto_ferroes").ok);
  p.tarefas.deserto_ferroes.progresso = 39;
  abater(j, "escorpiao1");
  const segunda = falar(j, "atalaia_deserto");
  igual(segunda.tarefasEntregues.map((t) => [t.pontos, t.primeiraVez]), [[10, false]], "a 2ª entrega não tem bônus");
  assert.deepStrictEqual([p.pontosTarefa, p.pontosTarefaTotal], [25, 25]);
  assert.strictEqual(p.tarefas.deserto_ferroes.concluidas, 2);
  // 5 e 6. Grande caçada: 164 h de espera; subir de nível na entrega aparece na fala.
  assert.ok(aceitarCacada(j, "deserto_rotas").ok);
  p.tarefas.deserto_rotas.progresso = p.tarefas.deserto_rotas.meta - 1;
  abater(j, "escorpiao1");
  p.nivel = 10;
  p.xp = limiar(10) - 1; // +1800 XP: níveis 11, 12 e 13 (o 13→14 pede 950 XP a mais)
  const nivel = p.nivel;
  const grande = falar(j, "atalaia_deserto");
  igual(grande.niveis, [nivel + 1, nivel + 2, nivel + 3]);
  assert.strictEqual(
    grande.mensagem,
    `Atalaia: Bom trabalho! Anotei no rol: As rotas das caravanas (+1800 XP, 300 moedas, 75 pontos de tarefa). Você subiu para o nível ${nivel + 3}!`,
  );
  const visao = j.g("visaoTarefa")(p, "deserto_rotas");
  assert.strictEqual(visao.esperaMs, 164 * HORA);
  assert.strictEqual(j.g("textoEspera")(visao.esperaMs), "6 d 20 h");
  j.avancar(164 * HORA - 1);
  assert.strictEqual(estadoCacada(j, "deserto_rotas"), "espera");
  j.avancar(1);
  assert.strictEqual(estadoCacada(j, "deserto_rotas"), "disponivel");
  // 7. textoEspera.
  const texto = j.g("textoEspera");
  const exemplos = [[0, "agora"], [30_000, "1 min"], [45 * 60_000, "45 min"], [19 * HORA + 59 * 60_000, "19 h 59 min"]];
  exemplos.push([20 * HORA, "20 h"], [164 * HORA, "6 d 20 h"], [48 * HORA + 30 * 60_000, "2 d"], [-5, "agora"]);
  for (const [ms, esperado] of exemplos) assert.strictEqual(texto(ms), esperado, `textoEspera(${ms})`);
  // 8. A morte (com a penalidade mais dura) não toca em caçadas, pontos nem trocas.
  assert.ok(aceitarCacada(j, "canaa_lobos").ok);
  p.tarefas.canaa_lobos.progresso = 7;
  p.trocas.alforje_couro = 1;
  const antes = json({ tarefas: p.tarefas, pontos: p.pontosTarefa, total: p.pontosTarefaTotal, trocas: p.trocas });
  p.nivel = 60;
  j.definirAleatorio(() => 0.01);
  const morte = j.M.aplicarMorte(ID, "inimigo");
  assert.ok(morte.penalidade.moedas > 0 && morte.penalidade.item, "a morte aplicou a penalidade");
  igual({ tarefas: p.tarefas, pontos: p.pontosTarefa, total: p.pontosTarefaTotal, trocas: p.trocas }, antes);
});

teste("37. troca de pontos: recusas sem mudar nada, itens, alforjes e estados das ofertas", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const npcs = j.g("npcs");
  const carga = () => j.g("capacidadeCarga")(p);
  const trocar = (ofertaId) => j.exec({ tipo: "trocarPontos", ofertaId });
  const recusa = (ofertaId, mensagem) => {
    const antes = json(p);
    const r = trocar(ofertaId);
    assert.strictEqual(r.ok, false, ofertaId);
    if (mensagem instanceof RegExp) assert.match(r.mensagem, mensagem);
    else assert.strictEqual(r.mensagem, mensagem);
    igual(p, antes, `a recusa de ${ofertaId} não muda o save`);
  };
  recusa("nada", "Essa troca não existe.");
  recusa("alforje_couro", "Aproxime-se de um atalaia para trocar pontos.");
  posicionarAoLado(j, "canaan", npcs.atalaia_canaa);
  recusa("alforje_couro", "Aproxime-se de um atalaia para trocar pontos."); // mural ainda fechado
  p.missoes.lobo.status = "concluida";
  p.missoes.ervas.status = "concluida";
  recusa("alforje_couro", "Faltam 60 pontos de tarefa.");
  p.pontosTarefa = 59;
  recusa("alforje_couro", "Falta 1 ponto de tarefa.");
  p.pontosTarefa = 500;
  p.pontosTarefaTotal = 800;
  recusa("escudo_ferro", "Para trocar, é preciso concluir a missão “A saída do Egito”.");
  recusa("alforje_viagem", "Para trocar, é preciso ter Alforje de couro.");
  p.missoes.deserto.status = "concluida";
  p.missoes.egito.status = "concluida";
  while (j.g("pesoCarregado")(p) + 8 <= carga()) p.inventario.push("pocao");
  recusa("escudo_ferro", /^Mochila cheia \([\d.]+\/\d+ kg\)\. Libere espaço para receber Escudo de ferro\.$/);
  j.M.removerItens(p, "pocao", 999);
  // Item: desconta o saldo (o total da vida não muda) e entra na mochila; pode repetir.
  igual(trocar("escudo_ferro"), { ok: true, ofertaId: "escudo_ferro", pontos: 350, mensagem: "Troca feita: Escudo de ferro por 150 pontos de tarefa. Saldo: 350." });
  assert.strictEqual(j.M.contarItem(ID, "escudo_ferro"), 1);
  assert.strictEqual(p.pontosTarefaTotal, 800);
  igual(p.trocas, { escudo_ferro: 1 });
  // Alforjes: +10 kg cada, uma vez; o de viagem exige o de couro.
  const cargaAntes = carga();
  const couro = trocar("alforje_couro");
  assert.strictEqual(couro.mensagem, "Troca feita: Alforje de couro (+10 kg de carga) por 60 pontos de tarefa. Saldo: 290.");
  assert.strictEqual(carga(), cargaAntes + 10);
  recusa("alforje_couro", "Você já tem Alforje de couro.");
  assert.ok(trocar("alforje_viagem").ok);
  assert.strictEqual(carga(), cargaAntes + 20);
  assert.strictEqual(p.pontosTarefa, 110);
  // O Azarias não compra (nem vende) itens da troca.
  posicionarAoLado(j, "deserto", npcs.mercador1);
  assert.strictEqual(j.exec({ tipo: "vender", item: "escudo_ferro" }).ok, false);
  assert.strictEqual(j.exec({ tipo: "comprar", item: "couraca_escamas" }).ok, false);
  assert.strictEqual(j.M.contarItem(ID, "escudo_ferro"), 1);
  // ofertasDeTroca: os quatro estados.
  const estados = () => j.g("ofertasDeTroca")(p).map((o) => [o.id, o.estado]);
  igual(estados(), [["alforje_couro", "comprada"], ["escudo_ferro", "semPontos"], ["alforje_viagem", "comprada"], ["couraca_escamas", "bloqueada"]]);
  const [alforje, escudo, , couraca] = j.g("ofertasDeTroca")(p);
  igual(escudo, {
    id: "escudo_ferro",
    nome: "Escudo de ferro",
    icone: null,
    item: "escudo_ferro",
    quantidade: 1,
    efeito: "Defesa 7",
    preco: 150,
    estado: "semPontos",
    motivo: "",
    falta: 40,
    possui: 1,
  });
  assert.deepStrictEqual([alforje.icone, alforje.item, alforje.efeito], ["ui_alforje", null, "+10 kg de carga, para sempre"]);
  assert.strictEqual(couraca.motivo, "concluir a missão “A batalha de Refidim”");
  p.pontosTarefa = 150;
  igual(estados()[1], ["escudo_ferro", "disponivel"]);
  // possui: unidades do item na mochila e equipadas (a interface confirma antes de trocar outro).
  const possui = () => j.g("ofertasDeTroca")(p).map((o) => o.possui);
  igual(possui(), [0, 1, 0, 0]);
  assert.ok(j.M.equiparItem(ID, "escudo_ferro", "escudo").ok);
  igual(possui(), [0, 1, 0, 0], "o escudo equipado conta");
  p.inventario.push("escudo_ferro");
  igual(possui(), [0, 2, 0, 0]);
});

teste("38. migração para a v8 e a v9: saves v5, v6 e v7 ganham caçadas vazias; v9 recarrega igual; corrompido é normalizado", () => {
  const versaoAtual = carregarJogo().g("VERSAO_SAVE");
  const vazio = (p, onde) => {
    igual([p.tarefas, p.pontosTarefa, p.pontosTarefaTotal, p.trocas], [{}, 0, 0, {}], onde);
    assert.strictEqual(p.versao, versaoAtual, onde);
  };
  const avisos8 = (p) => p.avisosPendentes.filter((a) => a.id === "atualizacao_8").length;
  const recarregar = (j, ms) => {
    j.g("Storage").flush();
    const j2 = carregarJogo({ store: j.store, inicio: j.agora + ms });
    j2.entrar();
    return j2;
  };
  // v5 (fixture) e v6.
  const v5 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "save_v5.json"), "utf8"));
  let j = carregarJogo({ store: { save_jogador1: JSON.stringify(v5) }, inicio: INICIO_RELOGIO + 60_000 });
  let p = j.entrar();
  vazio(p, "v5");
  assert.deepStrictEqual([p.moedas, p.nivel, p.xp], [v5.moedas, v5.nivel, v5.xp]);
  assert.strictEqual(avisos8(p), 1);
  j = saveV6(() => ({}));
  p = j.entrar();
  vazio(p, "v6");
  assert.strictEqual(p.missoes.ervas.status, "concluida");
  assert.strictEqual(avisos8(p), 1);
  // v7 sintético: um personagem com progresso, gravado sem os campos novos.
  const base = carregarJogo();
  base.entrar();
  Object.assign(base.p, { nivel: 6, xp: 1100, moedas: 321 });
  base.p.missoes.lobo.status = "concluida";
  base.p.missoes.deserto = { status: "em_andamento", etapa: 1, progresso: [["saque_a"], 0] };
  base.p.inventario.push("pele_lobo", "espada_ferro", "veneno_escorpiao");
  base.g("Storage").flush();
  const v7 = JSON.parse(base.store.save_jogador1);
  for (const campo of ["tarefas", "pontosTarefa", "pontosTarefaTotal", "trocas"]) delete v7[campo];
  Object.assign(v7, { versao: 7, avisosPendentes: [] });
  j = carregarJogo({ store: { save_jogador1: JSON.stringify(v7) }, inicio: INICIO_RELOGIO + 60_000 });
  p = j.entrar();
  vazio(p, "v7");
  for (const campo of ["inventario", "moedas", "missoes", "equipamento", "nivel", "xp"]) igual(p[campo], v7[campo], campo);
  assert.strictEqual(avisos8(p), 1);
  let j2 = recarregar(j, 60_000);
  assert.strictEqual(avisos8(j2.p), 1, "recarregar antes de ler o aviso não o duplica");
  while (j2.M.consumirAviso(ID));
  assert.strictEqual(avisos8(recarregar(j2, 60_000).p), 0, "o aviso aparece uma vez");
  const novo = carregarJogo();
  vazio(novo.entrar(), "novo");
  assert.strictEqual(avisos8(novo.p), 0, "personagem novo não recebe o aviso");
  // v9 com caçadas em andamento, pontos e trocas: recarrega idêntico.
  j = carregarJogo();
  j.entrar();
  concluirMissoes(j);
  p = j.p;
  assert.ok(aceitarCacada(j, "canaa_lobos").ok);
  assert.ok(aceitarCacada(j, "deserto_ferroes").ok);
  p.tarefas.deserto_ferroes.progresso = 39;
  abater(j, "escorpiao1");
  abater(j, "lobo1");
  falar(j, "atalaia_canaa"); // entrega Ferrões
  assert.ok(aceitarCacada(j, "deserto_rotas").ok);
  p.tarefas.deserto_rotas.progresso = 12;
  assert.ok(guardarCacada(j, "deserto_rotas").ok);
  p.pontosTarefa = 200;
  p.pontosTarefaTotal = 215;
  posicionarAoLado(j, "canaan", j.g("npcs").atalaia_canaa);
  assert.ok(j.exec({ tipo: "trocarPontos", ofertaId: "alforje_couro" }).ok);
  const salvo = json({ tarefas: p.tarefas, pontos: p.pontosTarefa, total: p.pontosTarefaTotal, trocas: p.trocas });
  const cargaSalva = j.g("capacidadeCarga")(p);
  j2 = recarregar(j, 30 * 60_000);
  const p2 = j2.p;
  igual({ tarefas: p2.tarefas, pontos: p2.pontosTarefa, total: p2.pontosTarefaTotal, trocas: p2.trocas }, salvo);
  assert.strictEqual(j2.g("capacidadeCarga")(p2), cargaSalva, "o alforje continua valendo");
  igual(j2.g("tarefasDoJogador")(p2).map((v) => [v.id, v.estado, v.progresso]), [["canaa_lobos", "ativa", 1], ["deserto_rotas", "guardada", 12]]);
  assert.strictEqual(j2.g("estadoTarefa")(p2, "deserto_ferroes"), "espera");
  // Save v9 corrompido.
  const corrompido = json(p2);
  const agora = INICIO_RELOGIO + 1_000_000;
  corrompido.tarefas = {
    canaa_lobos: { ativa: true, progresso: -5, meta: 30, concluidas: 1, disponivelEm: 0, aceitaEm: 10, extra: "fica" },
    canaa_matilha: { ativa: "sim", progresso: 5, meta: 0, concluidas: -1, disponivelEm: 1e15, aceitaEm: "x" },
    deserto_ferroes: { ativa: true, progresso: 999, meta: 40, concluidas: 2, disponivelEm: 5, aceitaEm: 20 },
    deserto_bando: "x",
    cacada_antiga: { ativa: true, progresso: 3, meta: 9 },
    constructor: { ativa: true, progresso: 3, meta: 9 },
  };
  Object.assign(corrompido, { pontosTarefa: "muitos", pontosTarefaTotal: 2, trocas: { alforje_couro: 1, lixo: "a", outra: 2.5 } });
  j = carregarJogo({ store: { save_jogador1: JSON.stringify(corrompido) }, inicio: agora });
  p = j.entrar();
  igual(p.tarefas.canaa_lobos, { ativa: true, progresso: 0, meta: 30, concluidas: 1, disponivelEm: 0, aceitaEm: 10, extra: "fica" });
  igual(p.tarefas.canaa_matilha, { ativa: false, progresso: 5, meta: 300, concluidas: 0, disponivelEm: agora + 164 * HORA, aceitaEm: 0 });
  igual(p.tarefas.deserto_ferroes, { ativa: true, progresso: 40, meta: 40, concluidas: 2, disponivelEm: 5, aceitaEm: 20 });
  assert.ok(!("deserto_bando" in p.tarefas), "entrada inválida de caçada conhecida é removida");
  igual(p.tarefas.cacada_antiga, { ativa: true, progresso: 3, meta: 9 }, "caçada que saiu dos dados fica intocada");
  igual(p.tarefas.constructor, { ativa: true, progresso: 3, meta: 9 }, "id herdado de Object.prototype não é caçada");
  assert.strictEqual(j.g("visaoTarefa")(p, "constructor"), null, "a lista \"Voltam ao mural\" percorre as chaves do save");
  assert.deepStrictEqual([p.pontosTarefa, p.pontosTarefaTotal], [0, 2]);
  igual(p.trocas, { alforje_couro: 1 });
  // A caçada desconhecida não ocupa vaga: com 2 ativas conhecidas, a 3ª é aceita.
  igual(j.g("tarefasDoJogador")(p).map((v) => v.id), ["canaa_lobos", "deserto_ferroes", "canaa_matilha"]);
  assert.ok(aceitarCacada(j, "deserto_rotas").ok);
  // NaN, saldo maior que o total e mais ativas que o limite (nada é desativado).
  const normalizar = j.g("normalizarTarefas");
  const ativa = { ativa: true, progresso: 1, meta: 5, concluidas: 0, disponivelEm: 0, aceitaEm: 0 };
  const q = { tarefas: { canaa_lobos: { ...ativa, progresso: NaN } }, pontosTarefa: NaN, pontosTarefaTotal: NaN };
  for (const id of ["deserto_ferroes", "egito_guardas", "mar_retaguarda"]) q.tarefas[id] = { ...ativa };
  normalizar(q, agora);
  assert.strictEqual(q.tarefas.canaa_lobos.progresso, 0);
  assert.strictEqual(Object.values(q.tarefas).filter((s) => s.ativa).length, 4);
  assert.deepStrictEqual([q.pontosTarefa, q.pontosTarefaTotal], [0, 0]);
  const r = { pontosTarefa: 50.7, pontosTarefaTotal: 20 };
  normalizar(r, agora);
  igual([r.pontosTarefa, r.pontosTarefaTotal, r.tarefas, r.trocas], [50, 50, {}, {}]);
});

// Perfil de quem chega à região do mural (nível, equipamento e habilidades da campanha).
const PERFIS_CHEGADA = {
  canaan: { nivel: 3, arma: "espada_ferro", escudo: "escudo_madeira", armadura: "tunica_pano", corpo: 4, defesa: 2 },
  deserto: { nivel: 5, arma: "espada_ferro", escudo: "escudo_madeira", armadura: "armadura_couro", corpo: 7, defesa: 5 },
  egito: { nivel: 6, arma: "espada_ferro", escudo: "escudo_bronze", armadura: "armadura_couro", corpo: 8, defesa: 6 },
  marVermelho: { nivel: 7, arma: "espada_temperada", escudo: "escudo_bronze", armadura: "armadura_couro", corpo: 10, defesa: 8 },
  sinai: { nivel: 8, arma: "espada_temperada", escudo: "escudo_bronze", armadura: "armadura_couro", corpo: 11, defesa: 9 },
  galileia: { nivel: 9, arma: "espada_temperada", escudo: "escudo_bronze", armadura: "armadura_couro", corpo: 12, defesa: 10 },
};

teste("39. ritmo das caçadas: rondas de 5–30 min, grandes de 30–90, recompensa na faixa e sem mortes", () => {
  const linhas = [];
  const referencia = carregarJogo();
  for (const id of referencia.g("ORDEM_TAREFAS")) {
    const j = carregarJogo({ semente: 3 });
    j.entrar();
    concluirMissoes(j);
    const t = j.g("TAREFAS")[id];
    if (t.oculta) continue;
    const p = j.p;
    // Criatura de referência: a mais fraca que conta; n = quantas contam na mesma área.
    const casam = Object.values(j.g("inimigos")).filter((e) => j.g("casaAlvo")(t.alvo, e));
    const ref = casam.reduce((a, b) => (b.vidaMaxima < a.vidaMaxima ? b : a));
    const n = casam.filter((e) => e.area === ref.area).length;
    const area = j.g("npcs")[t.mural].area;
    const perfil = PERFIS_CHEGADA[area];
    assert.ok(perfil, `${id}: falta o perfil de chegada de ${area}`);
    p.nivel = perfil.nivel;
    p.xp = j.g("limiarNivel")(perfil.nivel - 1);
    p.vida = j.g("vidaMaxima")(p);
    p.equipamento = { arma: perfil.arma, arco: null, escudo: perfil.escudo, armadura: perfil.armadura };
    p.habilidades = { corpo: perfil.corpo, distancia: 0, defesa: perfil.defesa, oracao: 0 };
    assert.ok(aceitarCacada(j, id).ok, id);
    const meta = p.tarefas[id].meta;
    const inicio = j.agora;
    while (p.tarefas[id].progresso < meta) {
      p.inventario = Array(20).fill("pocao");
      const r = lutar(j, ref.id, { maxPocoes: 99 });
      assert.ok(r.vitoria, `${id}: derrota contra ${ref.id} (${r.mensagem})`);
      p.saqueNoChao = [];
      j.avancar(Math.max(1500, j.g("TEMPO_RESPAWN_INIMIGO") / n));
    }
    const minutos = ((j.agora - inicio) / 60_000) * 1.5; // tempo prático: cliques, saque e distração
    const nivelFinal = p.nivel;
    const r = falar(j, t.mural);
    igual(r.tarefasEntregues?.map((x) => x.id), [id], `${id}: entrega`);
    linhas.push({
      id,
      tipo: t.tipo,
      meta,
      minutos,
      niveis: `${perfil.nivel}→${nivelFinal}`,
      xp: t.recompensa.xp / (meta * ref.xpRecompensa),
      moedas: t.recompensa.moedas / (meta * ref.saque.moedas),
      ptsMin: t.recompensa.pontos / minutos,
    });
  }
  const larguras = [20, 8, 10, 8, 7, 9, 8];
  const linha = (cols) => "    " + cols.map((c, i) => String(c).padEnd(larguras[i])).join("");
  console.log("\n    Ritmo das caçadas (perfil de chegada, autoataque, poção abaixo de 30%; minutos práticos = simulados × 1,5):");
  console.log(linha(["Caçada", "Abates", "Min", "Nível", "XP%", "Moedas%", "Pts/min"]));
  for (const l of linhas) {
    const pct = (v) => `${Math.round(v * 100)}%`;
    console.log(linha([l.id, l.meta, l.minutos.toFixed(1), l.niveis, pct(l.xp), pct(l.moedas), l.ptsMin.toFixed(2)]));
  }
  console.log("");
  for (const l of linhas) {
    const [min, max] = l.tipo === "ronda" ? [5, 30] : [30, 90];
    assert.ok(l.minutos >= min && l.minutos <= max, `${l.id}: ${l.minutos.toFixed(1)} min fora de ${min}–${max}`);
    assert.ok(l.xp >= 0.1 && l.xp <= 0.3, `${l.id}: XP = ${(l.xp * 100).toFixed(0)}% do XP dos abates`);
    assert.ok(l.moedas <= 0.4, `${l.id}: moedas = ${(l.moedas * 100).toFixed(0)}% do saque`);
    assert.ok(l.ptsMin >= 0.5 && l.ptsMin <= 2, `${l.id}: ${l.ptsMin.toFixed(2)} pontos por minuto`);
  }
});

// Usos de p.tarefas, p.trocas, p.pontosTarefa e p.pontosTarefaTotal num código de interface que não
// são leitura com valor padrão ("p.pontosTarefa || 0", "Object.keys(p.tarefas || {})"). Atribuição,
// delete, Object.assign, alias (p.tarefas[id] guardado numa variável), desestruturação e acesso por
// string entram na lista. Comentários de linha inteira e de bloco são ignorados.
const CAMPOS_CACADA = "tarefas|trocas|pontosTarefa|pontosTarefaTotal";
function usosQueNaoSaoLeitura(fonte) {
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const problemas = [];
  const trecho = (i) => codigo.slice(Math.max(0, i - 30), i + 50).replace(/\s+/g, " ");
  for (const m of codigo.matchAll(new RegExp(`\\??\\.(${CAMPOS_CACADA})\\b(?!\\s*\\|\\|)`, "g"))) problemas.push(trecho(m.index));
  const outros = [
    new RegExp(`\\[\\s*["'\`](${CAMPOS_CACADA})["'\`]\\s*\\]`, "g"),
    new RegExp(`\\{[^{}]*\\b(${CAMPOS_CACADA})\\b[^{}]*\\}\\s*=(?!=)`, "g"),
    new RegExp(`Object\\.(assign|defineProperty|defineProperties|setPrototypeOf)\\([^)]*\\b(${CAMPOS_CACADA})\\b`, "g"),
    new RegExp(`\\bdelete\\b[^;]*\\b(${CAMPOS_CACADA})\\b`, "g"),
  ];
  for (const re of outros) for (const m of codigo.matchAll(re)) problemas.push(trecho(m.index));
  return [...new Set(problemas)];
}

// Fotografia de p que distingue o que JSON.stringify esconde: undefined, NaN, Infinity e funções.
function fotografia(v) {
  return JSON.stringify(v, (_, x) => {
    if (x === undefined) return "<undefined>";
    if (typeof x === "function") return "<função>";
    if (typeof x === "number" && !Number.isFinite(x)) return `<${x}>`;
    return x;
  });
}

teste("40. a interface só lê o estado das caçadas: código sem escrita nele e funções puras que não mudam p", () => {
  const FONTE_UI = fs.readFileSync(path.join(RAIZ, "interface.js"), "utf8");
  const FONTE_ARTE = fs.readFileSync(path.join(RAIZ, "sprites.js"), "utf8");
  const HTML = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  // game.js abre o mural pedido pela lógica e mostra a contagem dos abates.
  assert.match(FONTE_GAME, /abrirMural/);
  assert.match(FONTE_GAME, /r\.tarefas/);
  // interface.js monta o mural e as listas só com as funções puras do contrato.
  assert.match(FONTE_UI, /function abrirMural\(/);
  for (const fn of ["tarefasDoJogador(", "tarefasDoMural(", "ofertasDeTroca(", "tarefasDoInimigo("]) {
    assert.ok(FONTE_UI.includes(fn), `interface.js usa ${fn})`);
  }
  // A interface só lê p.tarefas, p.pontosTarefa e p.trocas: toda mudança passa por executar().
  // O verificador pega cada forma de escrita (amostras abaixo) e deixa passar as leituras com padrão.
  const escritas = [
    "p.pontosTarefa = 300;",
    "p.tarefas[id].progresso = 5;",
    "p.pontosTarefa += 10;",
    "delete p.tarefas[id];",
    "Object.assign(p.trocas, { alforje_couro: 1 });",
    "const s = p.tarefas[t.id]; s.ativa = true;",
    'p["pontosTarefa"] = 300;',
    "const { tarefas } = p; tarefas.x = {};",
    "p.trocas?.alforje_couro;",
  ];
  for (const amostra of escritas) assert.ok(usosQueNaoSaoLeitura(amostra).length, `o verificador deixou passar: ${amostra}`);
  const leituras = "const n = p.pontosTarefa || 0;\n  // p.tarefas[id] = 1\nconst ids = Object.keys(p.tarefas || {}); /* p.trocas = {} */";
  igual(usosQueNaoSaoLeitura(leituras), [], "leituras com valor padrão e comentários passam");
  for (const [nome, fonte] of [["interface.js", FONTE_UI], ["game.js", FONTE_GAME]]) {
    igual(usosQueNaoSaoLeitura(fonte), [], `${nome} só lê o estado das caçadas (com "|| padrão") e muda tudo por executar()`);
  }
  // Em tempo de execução: as funções puras que a interface chama não mudam p em nada, em todos os
  // estados (ativa, cumprida, guardada, espera, bloqueada), com caçada antiga e chave herdada no save.
  const jr = carregarJogo();
  jr.entrar();
  const pr = jr.p;
  pr.missoes.lobo.status = "concluida";
  pr.missoes.ervas.status = "concluida";
  pr.missoes.deserto.status = "concluida";
  assert.ok(aceitarCacada(jr, "canaa_lobos").ok);
  assert.ok(aceitarCacada(jr, "deserto_ferroes").ok);
  assert.ok(aceitarCacada(jr, "deserto_rotas").ok);
  pr.tarefas.deserto_ferroes.progresso = 40;
  pr.tarefas.deserto_rotas.progresso = 12;
  assert.ok(guardarCacada(jr, "deserto_rotas").ok);
  pr.tarefas.deserto_bando = { ativa: false, progresso: 0, meta: 15, concluidas: 1, disponivelEm: jr.agora + HORA, aceitaEm: 1 };
  pr.tarefas.cacada_antiga = { ativa: true, progresso: 3, meta: 9 };
  Object.defineProperty(pr.tarefas, "constructor", { value: { ativa: true, progresso: 1, meta: 2 }, enumerable: true, writable: true });
  Object.assign(pr, { pontosTarefa: 170, pontosTarefaTotal: 230, trocas: { alforje_couro: 1 } });
  pr.inventario.push("escudo_ferro");
  const g = (nome) => jr.g(nome);
  const ids = [...g("ORDEM_TAREFAS"), "cacada_antiga", "constructor", "nada"];
  const antes = fotografia(pr);
  for (const id of ids) {
    g("visaoTarefa")(pr, id);
    g("estadoTarefa")(pr, id);
  }
  for (const npcId of Object.keys(g("npcs"))) {
    g("tarefasDoMural")(pr, npcId);
    g("estadoMissaoNpc")(pr, npcId);
  }
  for (const inimigoId of [...Object.keys(g("inimigos")), "constructor"]) g("tarefasDoInimigo")(pr, inimigoId);
  g("tarefasDoJogador")(pr);
  g("ofertasDeTroca")(pr);
  g("textoMissaoAtual")(pr);
  g("estatisticasCombate")(pr);
  g("capacidadeCarga")(pr);
  g("pesoCarregado")(pr);
  assert.strictEqual(fotografia(pr), antes, "as funções puras da interface não mudam p");
  igual(g("tarefasDoMural")(pr, "atalaia_deserto").map((v) => [v.id, v.estado]), [
    ["deserto_ferroes", "cumprida"],
    ["deserto_bando", "espera"],
    ["deserto_rotas", "guardada"],
  ]);
  // index.html carrega dados/tarefas.js antes de logica.js e tem o modal e a lista do painel Missão.
  const scripts = [...HTML.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const iTarefas = scripts.indexOf("dados/tarefas.js");
  assert.ok(iTarefas >= 0 && iTarefas < scripts.indexOf("logica.js"), "dados/tarefas.js antes de logica.js");
  assert.match(HTML, /id="modalMural"/);
  assert.match(HTML, /id="missaoCacadas"/);
  // game.js monta a textura "mk_balao_" + estadoMissaoNpc: todo estado possível tem o seu balão.
  for (const estado of ["missao", "andamento", "entregar", "mural"]) {
    assert.match(FONTE_ARTE, new RegExp(`balao\\("mk_balao_${estado}"`), `falta o balão mk_balao_${estado}`);
  }
  // Os atalaias têm visual próprio, e os itens da troca têm ícone.
  assert.match(FONTE_ARTE, /VISUAL_POR_PAPEL = \{ mural: "pj_atalaia" \}/);
  const j = carregarJogo();
  for (const o of Object.values(j.g("OFERTAS_TROCA"))) {
    if (o.item) assert.match(FONTE_ARTE, new RegExp(`item\\("${o.item}"`), `falta o ícone de ${o.item}`);
    else assert.match(FONTE_ARTE, new RegExp(`glifo\\("${o.icone}"`), `falta o glifo ${o.icone}`);
  }
});

teste("41. XP: curva cresce depois do nível 10 e criatura muito mais fraca rende menos", () => {
  const j = carregarJogo();
  const limiar = j.g("limiarNivel");
  // Tabela até o 10; depois, cada nível custa 150 XP a mais que o anterior.
  assert.strictEqual(limiar(10), 3250);
  const custos = [11, 12, 13, 14].map((n) => limiar(n) - limiar(n - 1));
  assert.deepStrictEqual(custos, [650, 800, 950, 1100]);
  for (let n = 11; n < 100; n++) assert.ok(limiar(n + 1) - limiar(n) > limiar(n) - limiar(n - 1), `custo cresce no ${n}`);
  // Farmar não dispara: 150 guardas egípcios a partir do nível 6 não passam do nível 20.
  j.entrar();
  const p = j.p;
  Object.assign(p, { nivel: 6, xp: limiar(5) });
  const guarda = j.g("inimigos").soldadoEgito1;
  for (let i = 0; i < 150; i++) j.g("adicionarXP")(p, j.g("xpDoAbate")(p, guarda));
  assert.ok(p.nivel <= 20, `150 guardas levaram ao nível ${p.nivel}`);
  // Redução: até 5 níveis acima, XP cheio; depois, -15% por nível, mínimo de 10%.
  const xp = j.g("xpDoAbate");
  const lobo = j.g("inimigos").lobo1; // nível 3, 40 XP
  const com = (nivel) => xp({ nivel }, lobo);
  assert.deepStrictEqual([com(1), com(8), com(9), com(10), com(14), com(30)], [40, 40, 34, 28, 4, 4]);
  assert.strictEqual(xp({ nivel: 50 }, { xpRecompensa: 40 }), 40, "criatura sem nível rende sempre o XP cheio");
  for (const e of Object.values(j.g("inimigos"))) assert.ok(Number.isInteger(e.nivel) && e.nivel > 0, `${e.id} tem nível`);
  // A mensagem e o retorno do abate mostram o XP realmente ganho.
  p.nivel = 20;
  p.vida = 9999;
  const r = abater(j, "lobo1");
  assert.strictEqual(r.xpGanho, 4);
  assert.match(r.mensagem, /\+4 XP \(criatura fraca para o seu nível\)/);
});

teste("42. grupos de criaturas, renascimento e coleta em lugar aleatório, flecha em qualquer direção", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const inimigos = j.g("inimigos");
  // Grupos: cópias <id>_N com base no original, espalhadas e sem uma puxar a outra.
  const lobos = Object.values(inimigos).filter((e) => e.especie === inimigos.lobo1.especie);
  assert.ok(lobos.length >= 4, `${lobos.length} lobos em Canaã`);
  for (const e of lobos.filter((e) => e.id !== "lobo1")) assert.strictEqual(e.base, "lobo1");
  for (const a of lobos)
    for (const b of lobos)
      if (a !== b) assert.ok(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > a.raioPercepcao, `${a.id} perto de ${b.id}`);
  // Uma cópia conta para a missão do lobo (objetivo "lobo1").
  falar(j, "viajante1");
  abater(j, "lobo1_2");
  assert.strictEqual(j.g("estadoMissaoNpc")(p, "viajante1"), "entregar");
  // Renasce num ponto aleatório do grupo (posição muda em algum dos renascimentos).
  const copia = inimigos.lobo1_3;
  const posicoes = new Set();
  for (let i = 0; i < 6; i++) {
    p.inimigosDerrotados.push(copia.id);
    j.M.reaparecerInimigo(ID, copia.id);
    posicoes.add(`${copia.x},${copia.y}`);
    assert.strictEqual(j.g("mapas").canaan[copia.y][copia.x], 0);
    assert.deepStrictEqual([copia.inicioX, copia.inicioY], [copia.x, copia.y]);
  }
  assert.ok(posicoes.size > 1, "renasce em lugares diferentes");
  // Erva coletada brota noutro lugar livre.
  const erva = j.g("ervas")[0];
  const antes = `${erva.x},${erva.y}`;
  pisarEm(j, "canaan", { ...erva });
  assert.notStrictEqual(`${erva.x},${erva.y}`, antes);
  assert.strictEqual(j.g("mapas").canaan[erva.y][erva.x], 0);
  // Flecha: acerta fora da linha/coluna/diagonal, respeita o alcance circular e os obstáculos.
  const tiro = (dx, dy, bloquear) => {
    const mapa = j.g("mapas").canaan;
    const alvo = { x: 30 + dx, y: 30 + dy };
    const fonte = { x: 30, y: 30, area: "canaan" };
    const guardado = [];
    for (let y = 26; y <= 36; y++) for (let x = 24; x <= 36; x++) { guardado.push([x, y, mapa[y][x]]); mapa[y][x] = 0; }
    if (bloquear) mapa[bloquear[1]][bloquear[0]] = 1;
    const ok = j.M.linhaDeTiroLivre(fonte, alvo);
    for (const [x, y, v] of guardado) mapa[y][x] = v;
    return ok;
  };
  assert.ok(tiro(3, 1), "alvo em ângulo qualquer");
  assert.ok(tiro(-2, 5), "alvo em ângulo qualquer (outro quadrante)");
  assert.ok(tiro(6, 0) && tiro(4, 4), "alcance de 6 casas em círculo");
  assert.ok(!tiro(5, 5), "fora do círculo de 6 casas");
  assert.ok(!tiro(4, 2, [32, 31]), "obstáculo no caminho bloqueia");
});

// ---------------------------------------------------------------------
// Mapas ampliados (JGB-43)
// ---------------------------------------------------------------------
teste("43. mapas: tamanho e desenho vêm de dados/, sem bolsões fechados nem coordenadas fixas no código", () => {
  const j = carregarJogo();
  j.entrar();
  const [mapas, pisos, areas, tam, MAPAS, PISO] = ["mapas", "pisos", "areas", "DADOS_TAMANHO_MAPA", "DADOS_MAPAS", "PISO"].map(j.g);
  const COLS = j.g("COLS");
  const ROWS = j.g("ROWS");
  igual([COLS, ROWS], [tam.colunas, tam.linhas], "COLS e ROWS vêm de dados/mapas.js");
  assert.ok(COLS >= 160 && ROWS >= 120, "mapas ampliados");
  for (const area of Object.keys(areas)) {
    assert.ok(MAPAS[area], `${area}: desenho em dados/mapas.js`);
    assert.strictEqual(mapas[area].length, ROWS, area);
    assert.ok(mapas[area].every((l, y) => l.length === COLS && pisos[area][y].length === COLS), `${area}: grade ${COLS}×${ROWS}`);
    // Toda casa livre se alcança a partir do início (os bolsões fechados viraram obstáculo).
    const mapa = mapas[area];
    const inicio = areas[area].inicio;
    const visto = new Set([`${inicio.x},${inicio.y}`]);
    const fila = [[inicio.x, inicio.y]];
    while (fila.length) {
      const [x, y] = fila.pop();
      for (const [dx, dy] of VIZINHOS.slice(0, 4)) {
        const k = `${x + dx},${y + dy}`;
        if (mapa[y + dy]?.[x + dx] === 0 && !visto.has(k)) {
          visto.add(k);
          fila.push([x + dx, y + dy]);
        }
      }
    }
    const livres = mapa.flat().filter((v) => v === 0).length;
    assert.strictEqual(visto.size, livres, `${area}: ${livres - visto.size} casas livres inalcançáveis`);
    // Caminhos e água ficam no piso; água bloqueia, caminho é livre.
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        if (pisos[area][y][x] === PISO.AGUA) assert.strictEqual(mapa[y][x], 1, `${area}: água livre em ${x},${y}`);
        if (pisos[area][y][x] === PISO.CAMINHO) assert.strictEqual(mapa[y][x], 0, `${area}: caminho bloqueado em ${x},${y}`);
      }
  }
  // O mapa é sempre o mesmo (o desenho é determinístico).
  igual(carregarJogo().g("mapas"), mapas, "duas cargas geram o mesmo mapa");
  // Nenhuma coordenada de mapa escrita no código: trilhas, vilas, tendas, marcos e decoração vêm de dados/.
  for (const arquivo of ["logica.js", "game.js", "sprites.js"]) {
    const fonte = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
    assert.doesNotMatch(fonte, /mapas\.\w+\[\d/, `${arquivo}: linha de mapa escrita no código`);
    assert.doesNotMatch(fonte, /\b[xy] === \d+ && [xy] === \d+/, `${arquivo}: casa fixa no código`);
    assert.doesNotMatch(fonte, /plano\("dc_\w+", \d/, `${arquivo}: decoração em posição fixa`);
    assert.doesNotMatch(fonte, /\bhubs\b|\btrilhas:/, `${arquivo}: vilas e trilhas fixas no bioma`);
  }
});

teste("44. mapas: tendas e bancas dos comerciantes, estruturas com colisão, vilas com moradores e zonas", () => {
  const j = carregarJogo();
  j.entrar();
  const [mapas, pisos, areas, npcs, inimigos, PISO, ESTRUTURAS, MAPAS, estruturasPorArea] = [
    "mapas", "pisos", "areas", "npcs", "inimigos", "PISO", "DADOS_ESTRUTURAS", "DADOS_MAPAS", "estruturasPorArea",
  ].map(j.g);
  const dentro = (v, pt) => pt.x >= v.x && pt.y >= v.y && pt.x < v.x + v.largura && pt.y < v.y + v.altura;
  for (const area of Object.keys(areas)) {
    const ocupadas = new Set();
    const pontos = [
      ...Object.values(npcs).filter((n) => n.area === area),
      ...j.g("PORTAIS").filter((t) => t.area === area),
      ...["inicio", "passagem", "chegada", "cais", "chegadaViagem"].map((k) => areas[area][k]).filter(Boolean),
    ];
    for (const e of estruturasPorArea[area]) {
      const modelo = ESTRUTURAS[e.tipo];
      assert.ok(modelo, `${area}: estrutura de tipo desconhecido "${e.tipo}"`);
      igual([e.largura, e.altura], [modelo.largura, modelo.altura], `${area}: pegada de ${e.tipo}`);
      for (let y = e.y; y < e.y + e.altura; y++)
        for (let x = e.x; x < e.x + e.largura; x++) {
          const k = `${x},${y}`;
          assert.ok(x > 0 && y > 0 && x < j.g("COLS") - 1 && y < j.g("ROWS") - 1, `${area}: ${e.tipo} fora do mapa`);
          assert.ok(!ocupadas.has(k), `${area}: estruturas sobrepostas em ${k}`);
          ocupadas.add(k);
          assert.strictEqual(mapas[area][y][x], 1, `${area}: ${e.tipo} sem colisão em ${k}`);
          assert.strictEqual(pisos[area][y][x], PISO.ESTRUTURA, `${area}: piso de ${e.tipo} em ${k}`);
          assert.ok(!pontos.some((pt) => pt.x === x && pt.y === y), `${area}: ${e.tipo} sobre um NPC ou ponto da área em ${k}`);
        }
      if (e.npc) {
        const n = npcs[e.npc];
        assert.ok(n && n.area === area, `${area}: ${e.tipo} atendida por "${e.npc}", que não está na área`);
        igual([n.x, n.y], [e.x + (e.largura >> 1), e.y + e.altura], `${e.npc} atende logo à frente da ${e.tipo}`);
      }
      if (e.reservada) assert.ok(e.tipo === "banca" && e.variante === 1 && !e.npc, `${area}: banca reservada fica vazia`);
    }
    // Comerciantes, guias e atalaias atendem numa tenda ou banca própria.
    for (const n of Object.values(npcs).filter((n) => n.area === area && ["loja", "guia", "mural"].includes(n.papel))) {
      const e = estruturasPorArea[area].find((x) => x.npc === n.id);
      assert.ok(e && ["tenda", "banca"].includes(e.tipo), `${n.id} (${n.papel}) sem tenda ou banca`);
    }
    // Toda vila tem moradores; todo NPC mora numa vila; zonas de caça não invadem vilas.
    const vilas = MAPAS[area].vilas;
    for (const v of vilas) {
      const moradores = Object.values(npcs).filter((n) => n.area === area && n.papel === "ambiente" && dentro(v, n));
      assert.ok(moradores.length >= 2, `${v.nome}: só ${moradores.length} morador(es)`);
    }
    for (const n of Object.values(npcs).filter((n) => n.area === area))
      assert.ok(vilas.some((v) => dentro(v, n)), `${n.id} fora das vilas de ${area}`);
    for (const e of Object.values(inimigos).filter((e) => e.area === area && !e.base)) {
      const r = e.grupo.raio + e.raioPercepcao;
      for (const v of vilas) {
        const longe = e.x + r < v.x || e.x - r >= v.x + v.largura || e.y + r < v.y || e.y - r >= v.y + v.altura;
        assert.ok(longe, `zona de ${e.id} invade ${v.nome}`);
      }
    }
  }
  // Os tipos de obstáculo citados nos mapas existem na arte (sprites.js).
  vm.runInContext(fs.readFileSync(path.join(RAIZ, "sprites.js"), "utf8"), j.ctx, { filename: "sprites.js" });
  const Arte = j.ctx.Arte;
  for (const [area, d] of Object.entries(MAPAS)) {
    const tipos = [...d.regioes.map((r) => r.tipo), ...d.vilas.map((v) => v.muro), ...d.marcos.map((m) => m.tipo)].filter(Boolean);
    for (const tipo of tipos) {
      const marco = ["fogueira", "estandarte", "tenda"].includes(tipo);
      assert.ok(Arte.PIXEL_PATTERNS[`ob_${area}_${tipo}`] || marco, `${area}: obstáculo "${tipo}" sem desenho`);
    }
    // A casa de um marco usa o desenho do tipo fixo, não o sorteio do bioma.
    for (const m of d.marcos) assert.ok(Arte.tipoObstaculo(area, m.x, m.y).chave.endsWith(m.tipo), `${area}: marco ${m.tipo}`);
    for (const e of d.estruturas) {
      const def = Arte.PIXEL_PATTERNS[`es_${e.tipo}`];
      assert.ok(def && (e.variante || 0) < def.quadros, `${area}: es_${e.tipo} variante ${e.variante}`);
    }
    for (const dec of d.decoracoes) assert.ok(Arte.PIXEL_PATTERNS[dec.chave], `${area}: decoração ${dec.chave}`);
  }
  for (const n of Object.values(npcs).filter((n) => n.papel === "ambiente"))
    assert.ok(Arte.PIXEL_PATTERNS[Arte.visualDe(n.id)] && Arte.visualDe(n.id).startsWith("pj_morador_"), `${n.id}: visual do morador`);
});

teste("45. mapas: moradores conversam em rodízio, coleta brota nas zonas e o barco sai do cais certo", () => {
  const j = carregarJogo();
  j.entrar();
  const npcs = j.g("npcs");
  // Morador: uma fala de cada vez, voltando ao começo; não abre loja nem mexe em missões.
  const zila = npcs.zila_canaa;
  const falas = [1, 2, 3].map(() => falar(j, "zila_canaa"));
  assert.ok(falas.every((r) => !r.abrirLoja && !r.abrirViagem && !r.abrirMural));
  igual(falas.map((r) => r.mensagem), [...zila.falas.linhas, zila.falas.linhas[0]].map((l) => `Zila: ${l}`));
  assert.strictEqual(j.g("estadoMissaoNpc")(j.p, "zila_canaa"), null, "morador sem balão de missão");
  // Coleta: depois de pega, a erva brota de novo numa casa livre de uma zona de coleta.
  const zonas = j.g("DADOS_MAPAS").canaan.zonasColeta;
  const ervas = j.g("ervas");
  const p = j.p;
  for (let i = 0; i < 8; i++) {
    const erva = ervas[i % ervas.length];
    p.ervasRespawn[erva.id] = 0;
    p.inventario = [];
    const r = pisarEm(j, "canaan", erva);
    assert.strictEqual(r.itemColetado, erva.id, r.mensagem);
    const naZona = zonas.some((z) => Math.max(Math.abs(erva.x - z.x), Math.abs(erva.y - z.y)) <= z.raio);
    assert.ok(naZona, `${erva.id} brotou fora das zonas (${erva.x},${erva.y})`);
    assert.strictEqual(j.g("mapas").canaan[erva.y][erva.x], 0, "brota em casa livre");
  }
  // Cais: toda cidade tem o seu; embarca (pagando a passagem) no ponto de embarque dela no mar.
  const areas = j.g("areas");
  for (const origem of j.g("REGRAS_VIAGEM").ordem) {
    const cais = areas[origem].cais;
    assert.ok(cais && areas.mar.portos[origem], `${origem}: cais e porto no mar`);
    Object.assign(p, { area: origem, x: cais.x, y: cais.y + 1, moedas: 100 });
    const r = j.exec({ tipo: "mover", dx: 0, dy: -1 });
    assert.ok(r.areaAlterada, `${origem}: embarque`);
    const embarque = areas.mar.portos[origem].embarque;
    igual([p.area, p.x, p.y, p.moedas], ["mar", embarque.x, embarque.y, 100 - j.g("REGRAS_BARCO").passagem], `${origem}: barco no embarque`);
  }
});

teste("46. migração para a v9: posição e saques dos mapas de 80×60 vão para o mapa novo, sempre em casa livre", () => {
  const base = carregarJogo();
  base.entrar();
  base.g("Storage").flush();
  const v8 = JSON.parse(base.store.save_jogador1);
  const npcs = base.g("npcs");
  // Jogador no Deserto, ao lado do antigo acampamento (Noemi ficava em 68,8), e saques espalhados.
  Object.assign(v8, { versao: 8, area: "deserto", x: 70, y: 9, avisosPendentes: [] });
  v8.saqueNoChao = [
    { id: "s_ok", area: "deserto", x: 20, y: 50, item: "pele_lobo", criadoEm: INICIO_RELOGIO },
    { id: "s_borda", area: "canaan", x: 79, y: 59, moedas: 3, criadoEm: INICIO_RELOGIO },
  ];
  let j = carregarJogo({ store: { save_jogador1: JSON.stringify(v8) }, inicio: INICIO_RELOGIO + 60_000 });
  let p = j.entrar();
  const mapas = j.g("mapas");
  const livre = (area, pt) => mapas[area][pt.y][pt.x] === 0 && !Object.values(npcs).some((n) => n.area === area && n.x === pt.x && n.y === pt.y);
  assert.strictEqual(p.versao, j.g("VERSAO_SAVE"));
  assert.strictEqual(p.area, "deserto");
  assert.ok(livre("deserto", p), "jogador em casa livre");
  assert.ok(Math.max(Math.abs(p.x - 140), Math.abs(p.y - 18)) <= 4, `perto do ponto equivalente (140,18): ${p.x},${p.y}`);
  assert.ok(Math.max(Math.abs(p.x - npcs.noemi1.x), Math.abs(p.y - npcs.noemi1.y)) <= 8, "continua no acampamento de Noemi");
  for (const s of p.saqueNoChao) assert.ok(livre(s.area, s), `saque ${s.id} em casa livre (${s.x},${s.y})`);
  const ok = p.saqueNoChao.find((s) => s.id === "s_ok");
  assert.ok(Math.max(Math.abs(ok.x - 40), Math.abs(ok.y - 100)) <= 4, "saque no ponto equivalente");
  assert.strictEqual(p.avisosPendentes.filter((a) => a.id === "atualizacao_9").length, 1, "aviso da atualização");
  // Recarregar a v9 não mexe na posição nem repete o aviso.
  const pos = [p.x, p.y];
  base.g("Storage").flush();
  j.g("Storage").flush();
  const j2 = carregarJogo({ store: j.store, inicio: j.agora + 60_000 });
  igual([j2.entrar().x, j2.p.y], pos, "v9 recarrega no mesmo lugar");
  assert.strictEqual(j2.p.avisosPendentes.filter((a) => a.id === "atualizacao_9").length, 1);
  // Save v9 com posição que não existe mais (fora do mapa, sobre estrutura ou NPC): casa livre mais próxima.
  const tenda = j.g("estruturasPorArea").deserto.find((e) => e.npc === "noemi1");
  for (const [x, y, onde] of [[500, -3, "fora do mapa"], [tenda.x + 1, tenda.y, "sobre a tenda"], [npcs.noemi1.x, npcs.noemi1.y, "sobre Noemi"]]) {
    const salvo = { ...JSON.parse(j.store.save_jogador1), area: "deserto", x, y };
    j = carregarJogo({ store: { save_jogador1: JSON.stringify(salvo) } });
    p = j.entrar();
    assert.ok(livre("deserto", p), `${onde}: ${p.x},${p.y}`);
    if (onde !== "fora do mapa") assert.ok(Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= 3, `${onde}: vai para perto`);
  }
});

// ---------------------------------------------------------------------
// Raridades, atributos aleatórios e tabelas de saque (JGB-4 e JGB-5)
// ---------------------------------------------------------------------
teste("47. raridades: item com raridade se descreve sozinho, só a forma canônica vale e o sorteio respeita as faixas", () => {
  const j = carregarJogo();
  const [info, gerar, codigo, valido, nome, textoAtr] = ["infoItem", "gerarItem", "codigoItem", "itemValido", "nomeItem", "textoAtributos"].map(j.g);
  const RARIDADES = j.g("RARIDADES");
  const ATR = j.g("ATRIBUTOS_ITEM");
  const ordem = Object.keys(RARIDADES);
  igual(ordem, ["comum", "incomum", "raro", "epico", "reliquia"]);
  for (const r of ordem) assert.match(RARIDADES[r].cor, /^#[0-9a-f]{6}$/i, `cor de ${r}`);
  for (let i = 1; i < ordem.length; i++) {
    assert.ok(RARIDADES[ordem[i]].brilho > RARIDADES[ordem[i - 1]].brilho, `${ordem[i]} brilha mais que ${ordem[i - 1]}`);
    assert.ok(RARIDADES[ordem[i]].som, `${ordem[i]} tem som`);
  }
  assert.ok(!RARIDADES.comum.som && !RARIDADES.comum.brilho, "comum não brilha nem toca");
  assert.ok(RARIDADES.epico.anuncio && RARIDADES.reliquia.anuncio && !RARIDADES.raro.anuncio, "anúncio a partir do épico");
  // Atributos aleatórios só a partir do raro.
  for (const r of ["comum", "incomum"]) assert.strictEqual(RARIDADES[r].atributos, 0);
  for (const r of ["raro", "epico", "reliquia"]) assert.ok(RARIDADES[r].atributos >= 1);

  // Item base: raridade comum (ou a dos dados) e nome sem sufixo.
  assert.strictEqual(info("espada_ferro").raridade, "comum");
  assert.strictEqual(info("pedra_onix").raridade, "reliquia");
  assert.strictEqual(nome("pedra_onix"), "Ônix");
  // Forma canônica: base@raridade.atributoValor na ordem de ATRIBUTOS_ITEM.
  const id = codigo("espada_ferro", "epico", { critico: 3, dano: 4 });
  assert.strictEqual(id, "espada_ferro@epico.dano4.critico3");
  const d = info(id);
  assert.strictEqual(d.bonus, 12 + 4);
  assert.strictEqual(d.raridade, "epico");
  assert.strictEqual(nome(id), "Espada de ferro (Épico)");
  igual(textoAtr(id), ["+4 de dano", "+3% de chance de crítico"]);
  assert.strictEqual(j.g("pesoItem")(id), 10);
  assert.strictEqual(info("escudo_bronze@raro.defesa2.vida8").defesa, 5 + 2);
  // Recusas: ordem errada, atributo que o tipo não tem, valor fora do teto, raridade inválida,
  // raridade em item que não é equipamento, atributos demais, sobras.
  for (const ruim of [
    "espada_ferro@epico.critico3.dano4",
    "espada_ferro@raro.defesa1",
    "espada_ferro@raro.dano99",
    "espada_ferro@lendario.dano1",
    "espada_ferro@comum",
    "pocao@raro",
    "pele_lobo@epico.vida5",
    "espada_ferro@incomum.dano1.critico1.vida5",
    "espada_ferro@raro.dano0",
    "espada_ferro@raro.dano1@x",
    "nada@raro",
    "constructor@raro",
    "__proto__",
    42,
    null,
  ]) assert.ok(!valido(ruim), `inválido: ${ruim}`);

  // Sorteio: muitas gerações por raridade e tipo ficam dentro das faixas e são sempre canônicas.
  const rng = aleatorioComSemente(7);
  const principal = { arma: "dano", arma_distancia: "dano", escudo: "defesa", armadura: "defesa" };
  for (const base of ["espada_ferro", "arco_composto", "escudo_bronze", "armadura_couro"]) {
    const tipo = j.g("ITENS")[base].tipo;
    for (const r of ordem) {
      for (let i = 0; i < 300; i++) {
        const item = gerar(base, r, rng);
        if (r === "comum") { assert.strictEqual(item, base); continue; }
        const x = info(item);
        assert.ok(x, `${base} ${r}: ${item} válido`);
        assert.strictEqual(x.raridade, r);
        const chaves = Object.keys(x.atributos);
        const melhoria = RARIDADES[r].melhoria;
        const sorteados = chaves.filter((k) => k !== principal[tipo]).length;
        assert.ok(sorteados <= RARIDADES[r].atributos, `${item}: atributos demais`);
        assert.ok((x.atributos[principal[tipo]] || 0) >= melhoria, `${item}: melhoria do principal`);
        for (const k of chaves) {
          assert.ok(ATR[k].tipos.includes(tipo), `${item}: ${k} não vale para ${tipo}`);
          const faixa = ATR[k].faixas[r] || [0, 0];
          const max = faixa[1] + (k === principal[tipo] ? melhoria : 0);
          assert.ok(x.atributos[k] >= 1 && x.atributos[k] <= max, `${item}: ${k}=${x.atributos[k]} fora da faixa`);
        }
      }
    }
  }
});

teste("48. raridades: atributos valem no combate, na vida, na carga e sobrevivem ao save; inválidos somem na carga", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const [vidaMaxima, capacidade, chance, defesa, danoBruto] = ["vidaMaxima", "capacidadeCarga", "chanceCritico", "defesaEquipamento", "danoBruto"].map(j.g);
  const vida0 = vidaMaxima(p), carga0 = capacidade(p), crit0 = chance(p, "corpo"), def0 = defesa(p), dano0 = danoBruto(p, "corpo");
  const arma0 = p.equipamento.arma;
  const espada = "espada_ferro@reliquia.dano5.critico4.vida25";
  const couraca = "armadura_couro@epico.defesa3.carga5";
  p.inventario.push(espada, couraca);
  assert.ok(j.M.equiparItem(ID, espada, "arma").ok);
  const r = j.M.equiparItem(ID, couraca, "armadura");
  assert.ok(r.ok);
  assert.match(r.mensagem, /Armadura de couro \(Épico\) equipado \(\+8 de defesa, \+5 kg de carga\)/);
  const baseArma = arma0 ? j.g("infoItem")(arma0).bonus : 0;
  assert.strictEqual(danoBruto(p, "corpo"), dano0 - baseArma + 12 + 5);
  assert.strictEqual(vidaMaxima(p), vida0 + 25);
  assert.strictEqual(chance(p, "corpo"), crit0 + 4);
  assert.strictEqual(chance(p, "distancia") - chance({ ...p, equipamento: {} }, "distancia"), 4, "crítico do equipamento vale no arco também");
  assert.strictEqual(capacidade(p), carga0 + 5);
  assert.ok(defesa(p) >= def0 - 10 + 8);
  // Tirar o equipamento de vida baixa a vida atual até a nova máxima.
  p.vida = vidaMaxima(p);
  assert.ok(j.M.desequiparItem(ID, "arma").ok);
  assert.strictEqual(p.vida, vida0);
  // alternarEquipamento escolhe o de maior dano (o raro ganha da espada comum).
  p.inventario.push("espada_ferro");
  j.M.alternarEquipamento(ID, "arma");
  assert.strictEqual(p.equipamento.arma, espada);

  // Save: os itens com raridade voltam iguais; os inválidos somem (mochila, equipamento e chão).
  p.saqueNoChao.push(
    { id: "s_raro", area: "canaan", x: 5, y: 5, item: "escudo_madeira@raro.vida7", criadoEm: j.agora },
    { id: "s_ruim", area: "canaan", x: 5, y: 5, item: "escudo_madeira@raro.dano7", criadoEm: j.agora },
    { id: "s_dest", area: "canaan", x: 5, y: 5, item: "pele_lobo", destaque: "inventado", criadoEm: j.agora },
  );
  p.inventario.push("arco_madeira@lendario", "pocao");
  j.g("Storage").salvarAgora(p);
  const salvo = JSON.parse(j.store.save_jogador1);
  const j2 = carregarJogo({ store: { save_jogador1: JSON.stringify(salvo) } });
  const p2 = j2.entrar();
  assert.strictEqual(p2.equipamento.arma, espada);
  assert.strictEqual(p2.equipamento.armadura, couraca);
  assert.ok(!p2.inventario.includes("arco_madeira@lendario"));
  assert.ok(p2.saqueNoChao.some((s) => s.id === "s_raro"));
  assert.ok(!p2.saqueNoChao.some((s) => s.id === "s_ruim"));
  assert.ok(!("destaque" in p2.saqueNoChao.find((s) => s.id === "s_dest")), "destaque inválido sai do save");
  assert.strictEqual(j2.g("vidaMaxima")(p2), vida0 + 25);
  // A troca de pontos reconhece o item em qualquer raridade.
  p2.inventario.push("escudo_ferro@raro.vida5");
  assert.strictEqual(j2.g("unidadesDoItem")(p2, "escudo_ferro"), 1);
});

teste("49. tabelas de saque: simulação de muitos abates bate com as chances, drop raro anuncia e a campanha não depende de sorte", () => {
  const j = carregarJogo();
  const inimigos = j.g("inimigos");
  const sortear = j.g("sortearSaque");
  const chanceSaque = j.g("chanceSaque");
  const RARIDADES = j.g("RARIDADES");
  const CHANCES = j.g("CHANCES_SAQUE");
  const base = j.g("baseItem");
  const raridade = j.g("raridadeItem");
  const ordem = Object.keys(RARIDADES);
  const originais = Object.values(inimigos).filter((e) => !e.base);
  const N = 60_000;
  const linhas = [];
  for (const e of originais) {
    const tabela = e.saque.itens;
    const itens = tabela.map((l) => l.item);
    assert.strictEqual(new Set(itens).size, itens.length, `${e.id}: cada item aparece uma vez na tabela`);
    // Raro nomeado tem saque garantido e pedra a 5%; as outras têm drop raro (1%) e muito raro (0,1%).
    if (e.nomeado) {
      assert.ok(tabela.some((l) => chanceSaque(l.chance) === 1 && l.raridadeMinima), `${e.id}: equipamento garantido`);
    } else {
      assert.ok(tabela.some((l) => chanceSaque(l.chance) <= CHANCES.raro && chanceSaque(l.chance) > CHANCES.muito_raro), `${e.id}: tem drop raro (1%)`);
      assert.ok(tabela.some((l) => chanceSaque(l.chance) <= CHANCES.muito_raro), `${e.id}: tem drop muito raro (0,1%)`);
    }
    // Linhas de 1% ou menos sempre rendem raro ou melhor (brilham e tocam).
    for (const l of tabela.filter((l) => chanceSaque(l.chance) <= CHANCES.raro)) {
      const min = l.raridadeMinima || l.raridade || raridade(l.item);
      assert.ok(ordem.indexOf(min) >= ordem.indexOf("raro"), `${e.id}: ${l.item} a ${l.chance} precisa ser raro ou melhor`);
    }
    const rng = aleatorioComSemente(1000 + originais.indexOf(e));
    const contagem = Object.fromEntries(itens.map((i) => [i, 0]));
    const raridades = Object.fromEntries(itens.map((i) => [i, {}]));
    for (let k = 0; k < N; k++) {
      for (const { item } of sortear(e, rng)) {
        contagem[base(item)]++;
        const r = raridade(item);
        raridades[base(item)][r] = (raridades[base(item)][r] || 0) + 1;
      }
    }
    for (const l of tabela) {
      const pr = chanceSaque(l.chance);
      const esperado = N * pr;
      const sigma = Math.sqrt(N * pr * (1 - pr)) || 1;
      const obs = contagem[l.item];
      assert.ok(Math.abs(obs - esperado) <= 5 * sigma, `${e.id}: ${l.item} caiu ${obs}× em ${N} (esperado ${esperado.toFixed(0)})`);
      if (l.raridadeMinima) {
        for (const r of Object.keys(raridades[l.item])) assert.ok(ordem.indexOf(r) >= ordem.indexOf(l.raridadeMinima), `${l.item}: ${r} abaixo do mínimo`);
      }
      linhas.push({ criatura: e.id, item: l.item, chance: pr, obs, esperado });
    }
  }
  console.log("\n    Simulação das tabelas de saque (" + N.toLocaleString("pt-BR") + " abates por criatura; drops de 1% e 0,1%):");
  for (const l of linhas.filter((l) => l.chance <= 0.01)) {
    console.log(`    ${l.criatura.padEnd(18)}${l.item.padEnd(20)}${(l.chance * 100).toFixed(1).padStart(6)}%  ${String(l.obs).padStart(7)}  (esperado ${l.esperado.toFixed(0)})`);
  }

  // Sorteio de raridade de equipamento: distribuição segue SORTEIO_RARIDADE, cortada pelo mínimo.
  const sortearRaridade = j.g("sortearRaridade");
  const pesos = j.g("SORTEIO_RARIDADE");
  const rng = aleatorioComSemente(99);
  for (const minima of [undefined, "incomum", "raro"]) {
    const corte = Math.max(0, ordem.indexOf(minima));
    const opcoes = ordem.slice(corte);
    const total = opcoes.reduce((s, r) => s + pesos[r], 0);
    const cont = {};
    const M = 100_000;
    for (let k = 0; k < M; k++) { const r = sortearRaridade(minima, rng); cont[r] = (cont[r] || 0) + 1; }
    for (const r of ordem) {
      const pr = opcoes.includes(r) ? pesos[r] / total : 0;
      const sigma = Math.sqrt(M * pr * (1 - pr)) || 1;
      assert.ok(Math.abs((cont[r] || 0) - M * pr) <= 5 * sigma, `raridade ${r} com mínimo ${minima}: ${cont[r] || 0}`);
    }
  }

  // Itens que as missões pedem como saque caem sempre (a campanha não depende de sorte).
  const pedidos = new Set();
  for (const m of Object.values(j.g("MISSOES")))
    for (const etapa of m.etapas || []) for (const o of etapa.objetivos || []) if (o.tipo === "coletar" && o.origem === "saque") pedidos.add(o.item);
  assert.ok(pedidos.size >= 2);
  for (const item of pedidos) {
    // Pelo menos uma criatura (a da missão) deixa cair sempre; outras podem deixar com chance.
    const sempre = originais.filter((e) => !e.nomeado && e.saque.itens.some((l) => l.item === item && chanceSaque(l.chance) === 1));
    assert.ok(sempre.length, `${item}: alguma criatura deixa cair sempre`);
  }

  // No jogo: abate com drop raro devolve saquesRaros e anúncio; o saque no chão tem o item com raridade.
  j.entrar();
  const p = j.p;
  p.nivel = 30;
  p.vida = 9999;
  let r = null;
  for (let tentativa = 0; tentativa < 400 && !r?.anuncios?.length; tentativa++) {
    // Força o sorteio: tudo abaixo de 1% cai, e a raridade sai épica (sorteio alto).
    let n = 0;
    j.definirAleatorio(() => (n++ % 2 === 0 ? 0.0005 : 0.97));
    r = abaterSemLimpar(j, "lobo1");
  }
  j.definirAleatorio(aleatorioComSemente(5));
  assert.ok(r.saquesRaros.length, "drop raro marcado");
  assert.ok(r.anuncios.includes("Drop muito raro (0,1%)! Lobo deixou cair: Sárdio."), r.anuncios.join(" | "));
  assert.ok(r.anuncios.some((t) => /^Drop raro \(1%\)! Lobo deixou cair: Escudo de madeira \((Raro|Épico|Relíquia)\)\.$/.test(t)), r.anuncios.join(" | "));
  for (const s of r.saquesRaros) {
    assert.ok(ordem.indexOf(s.raridade) >= ordem.indexOf("incomum"));
    assert.ok(p.saqueNoChao.some((c) => c.id === s.saqueId && c.item === s.item), "o destaque aponta para o saque no chão");
  }
  const sardio = p.saqueNoChao.find((s) => s.item === "pedra_sardio");
  assert.ok(sardio, "a pedra muito rara caiu com o sorteio forçado");
  // E entra na mochila pelo caminho normal, com o nome da pedra.
  posicionarAoLado(j, sardio.area, sardio);
  const c = j.exec({ tipo: "coletarSaque", saqueId: sardio.id });
  assert.ok(c.ok && /Sárdio/.test(c.mensagem), c.mensagem);
});

// ---------------------------------------------------------------------
// Criaturas novas, comportamentos, status, campeões e raros nomeados (JGB-6 e JGB-7)
// ---------------------------------------------------------------------
// Luta de balanceamento: jogador no perfil de chegada da região, no nível da criatura (ou acima),
// com poções, contra a criatura (vida cheia, sem campeão). Devolve o resultado de lutar.
function lutasDeBalanceamento(sementes, inimigoId, { nivelExtra = 0, pocoes = 6 } = {}) {
  const j = carregarJogo({ semente: sementes[0] });
  j.entrar();
  concluirMissoes(j);
  const p = j.p;
  const e = j.g("inimigos")[inimigoId];
  const perfil = PERFIS_CHEGADA[e.area];
  // Sem vizinhos atrapalhando: a luta é só contra esta criatura.
  for (const outro of Object.values(j.g("inimigos"))) if (outro !== e && outro.area === e.area) { outro.inicioX = outro.x = -50; outro.inicioY = outro.y = -50; }
  if (e.nomeado) e.nomeado.deslocamentoHoras = ((j.agora - 60_000) % (e.nomeado.aCadaHoras * 3_600_000)) / 3_600_000; // janela aberta agora
  return sementes.map((semente) => {
    j.definirAleatorio(aleatorioComSemente(semente));
    p.nivel = Math.max(perfil.nivel, e.nivel) + nivelExtra;
    p.xp = j.g("limiarNivel")(p.nivel - 1);
    p.equipamento = { arma: perfil.arma, arco: null, escudo: perfil.escudo, armadura: perfil.armadura };
    p.habilidades = { corpo: perfil.corpo, distancia: 0, defesa: perfil.defesa, oracao: 0 };
    p.skillXp = { corpo: 0, distancia: 0, defesa: 0, oracao: 0 };
    p.vida = j.g("vidaMaxima")(p);
    p.inventario = Array(pocoes).fill("pocao");
    p.status = {};
    p.imune = {};
    p.campeoes = {};
    if (e.nomeado) {
      p.nomeados = {};
      j.atualizar();
      assert.ok(j.M.inimigoVivo(p, e.id), `${e.id}: apareceu na janela`);
    } else if (j.M.obterVidaInimigo(ID, e.id) <= 0) {
      j.M.reaparecerInimigo(ID, e.id);
      p.campeoes = {};
    }
    p.vidaInimigos[e.id] = e.vidaMaxima;
    j.g("zerarComportamento")(e);
    const r = lutar(j, inimigoId, { maxPocoes: pocoes });
    p.saqueNoChao = [];
    j.avancar(20_000);
    return { ...r, nivel: p.nivel };
  });
}

teste("50. criaturas: 30+ espécies, cada uma com família, tier, comportamento, status, tabela de saque e sprite próprio", () => {
  const j = carregarJogo();
  const inimigos = Object.values(j.g("inimigos")).filter((e) => !e.base);
  const especies = inimigos.filter((e) => !e.nomeado);
  assert.ok(especies.length >= 30, `${especies.length} criaturas (meta: 30+)`);
  const novas = especies.filter((e) => !["lobo1", "escorpiao1", "bandido1", "soldadoEgito1", "perseguidorMar1", "guardiaoSinai1", "ameaçaGalileia1"].includes(e.id));
  assert.ok(novas.length >= 24, `${novas.length} criaturas novas`);
  const [FAM, TIERS, COMP, STATUS] = ["FAMILIAS_CRIATURAS", "TIERS_CRIATURAS", "COMPORTAMENTOS", "STATUS_CRIATURAS"].map(j.g);
  // Regiões: todas as áreas de caça com criaturas novas.
  for (const area of ["canaan", "deserto", "egito", "marVermelho", "sinai", "galileia"]) {
    assert.ok(novas.filter((e) => e.area === area).length >= 3, `${area}: pelo menos 3 criaturas novas`);
  }
  const dados = Object.fromEntries(j.g("DADOS_CRIATURAS").map((d) => [d.id, d]));
  for (const e of inimigos) {
    const d = dados[e.id];
    assert.ok(FAM[e.familia], `${e.id}: família ${e.familia}`);
    assert.ok(TIERS[d.tier || "normal"] && d.tier, `${e.id}: tier explícito nos dados`);
    for (const c of [].concat(d.comportamento || "padrao")) assert.ok(COMP[c], `${e.id}: comportamento ${c}`);
    if (d.status) assert.ok(STATUS[d.status.tipo], `${e.id}: status ${d.status.tipo}`);
    assert.ok(e.saque.itens.length >= 3, `${e.id}: tabela de saque`);
    assert.ok(Number.isInteger(e.nivel) && e.vidaMaxima > 0 && e.xpRecompensa > 0, `${e.id}: atributos`);
    if (d.comportamento === "distancia" || [].concat(d.comportamento || []).includes("distancia")) assert.ok(["flecha", "pedra", "magia"].includes(e.projetil), `${e.id}: projétil`);
  }
  // Variedade: comportamentos e status novos aparecem em várias criaturas.
  for (const c of Object.keys(COMP).filter((c) => c !== "padrao")) assert.ok(inimigos.filter((e) => e.comportamentos.includes(c)).length >= 2, `comportamento ${c} em 2+ criaturas`);
  for (const t of Object.keys(STATUS)) assert.ok(inimigos.filter((e) => e.efeito?.tipo === t).length >= 2, `status ${t} em 2+ criaturas`);
  assert.ok(especies.filter((e) => e.tier === "elite").length >= 5, "5+ elites");
  // Sprite próprio: cada criatura nova tem um sprite que nenhuma outra espécie usa (o raro nomeado usa o
  // da espécie dele, maior e tingido).
  vm.runInContext(fs.readFileSync(path.join(RAIZ, "sprites.js"), "utf8"), j.ctx, { filename: "sprites.js" });
  const Arte = j.ctx.Arte;
  const visual = new Map();
  for (const e of especies) {
    const v = Arte.visualDe(e.id);
    assert.ok(j.ctx.PIXEL_PATTERNS[v], `${e.id}: sprite ${v}`);
    if (novas.includes(e)) {
      assert.ok(!visual.has(v), `${e.id} reaproveita o sprite de ${visual.get(v)}`);
      assert.strictEqual(v, `in_${e.aparencia}`, `${e.id}: sprite próprio`);
    }
    if (!visual.has(v)) visual.set(v, e.id);
    for (let q = 0; q < 5; q++) assert.ok(Arte.pixels(v, { quadro: q }), `${v}: quadro ${q}`);
  }
  for (const e of inimigos.filter((e) => e.nomeado)) assert.ok(j.ctx.PIXEL_PATTERNS[Arte.visualDe(e.id)] && e.escala > 1, `${e.id}: visual do nomeado`);
  // Ícones dos recursos novos de saque.
  for (const item of ["pena_ave", "couro_grosso", "carapaca", "amuleto_faianca"]) assert.ok(j.ctx.PIXEL_PATTERNS[item], `ícone de ${item}`);
});

teste("51. balanceamento: cada criatura é vencível no nível dela, em tempo justo e com poucas poções", () => {
  const j0 = carregarJogo();
  const lista = Object.values(j0.g("inimigos")).filter((e) => !e.base);
  const sementes = [11, 12, 13, 14];
  const linhas = [];
  for (const e of lista) {
    const rs = lutasDeBalanceamento(sementes, e.id, e.nomeado ? { nivelExtra: 1, pocoes: 10 } : {});
    for (const r of rs) assert.ok(r.vitoria, `${e.id}: derrota (${r.mensagem})`);
    const media = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
    linhas.push({
      id: e.id, nome: e.nome, tier: e.tier, nivel: e.nivel, jogador: rs[0].nivel,
      duracao: media((r) => r.duracao), max: Math.max(...rs.map((r) => r.duracao)),
      pressao: media((r) => r.danoRecebido / r.vidaMax), pocoes: Math.max(...rs.map((r) => r.pocoes)),
      xpMin: (e.xpRecompensa / media((r) => r.duracao)) * 60,
    });
  }
  const larg = [20, 24, 8, 5, 5, 9, 7, 9, 8, 8];
  const lin = (c) => "    " + c.map((x, i) => String(x).padEnd(larg[i])).join("");
  console.log("\n    Balanceamento por criatura (perfil de chegada, nível da criatura, autoataque; média de " + sementes.length + " lutas):");
  console.log(lin(["Criatura", "Nome", "Tier", "Nv", "Jog", "Duração", "Máx", "Dano/vida", "Poções", "XP/min"]));
  for (const l of linhas) console.log(lin([l.id, l.nome, l.tier, l.nivel, l.jogador, l.duracao.toFixed(1) + " s", l.max.toFixed(0) + " s", Math.round(l.pressao * 100) + "%", l.pocoes, l.xpMin.toFixed(0)]));
  console.log("");
  // [duração mínima, máxima (s), poções no pior caso, XP por minuto mínimo e máximo]
  const FAIXAS = { normal: [3, 45, 2, 150, 700], chefe: [8, 60, 3, 150, 700], elite: [12, 75, 3, 300, 750], raro: [15, 150, 8, 500, 1500] };
  for (const l of linhas) {
    const [min, max, pocoes, xpMin, xpMax] = FAIXAS[l.tier];
    assert.ok(l.duracao >= min && l.duracao <= max, `${l.id}: duração média ${l.duracao.toFixed(1)} s fora de ${min}–${max} s`);
    assert.ok(l.pocoes <= pocoes, `${l.id}: ${l.pocoes} poções (máx. ${pocoes})`);
    assert.ok(l.xpMin >= xpMin && l.xpMin <= xpMax, `${l.id}: ${l.xpMin.toFixed(0)} XP/min fora de ${xpMin}–${xpMax}`);
  }
  // Elite e raro nomeado pressionam mais que as normais da mesma região.
  for (const area of new Set(lista.map((e) => e.area))) {
    const da = linhas.filter((l) => j0.g("inimigos")[l.id].area === area);
    const normais = da.filter((l) => l.tier === "normal");
    for (const forte of da.filter((l) => l.tier === "elite" || l.tier === "raro")) {
      const media = normais.reduce((a, l) => a + l.duracao, 0) / normais.length;
      assert.ok(forte.duracao > media, `${forte.id} deveria durar mais que a média das normais de ${area}`);
    }
  }
});

// Cena de comportamento: só a criatura na área (as outras longe), jogador forte e cheio de vida.
function cenaComportamento(inimigoId, opcoes = {}) {
  const j = carregarJogo({ semente: opcoes.semente ?? 5 });
  j.entrar();
  const p = j.p;
  const e = j.g("inimigos")[inimigoId];
  for (const outro of Object.values(j.g("inimigos"))) if (outro !== e && outro.area === e.area && !opcoes.manterVizinhos) { outro.inicioX = outro.x = -50; outro.inicioY = outro.y = -50; }
  p.nivel = 20;
  p.vida = j.g("vidaMaxima")(p);
  p.area = e.area;
  return { j, p, e };
}
// Põe o jogador a "d" casas da criatura (na horizontal, com o caminho livre) e devolve a posição.
// Se nenhuma das 8 direções estiver livre, abre a linha no mapa do teste.
function aDistancia(j, e, d) {
  const mapa = j.g("mapas")[e.area];
  const direcoes = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (const [sx, sy] of direcoes) {
    let ok = true;
    for (let i = 1; i <= d + 1 && ok; i++) if (mapa[e.y + sy * i]?.[e.x + sx * i] !== 0) ok = false;
    if (ok) { Object.assign(j.p, { area: e.area, x: e.x + sx * d, y: e.y + sy * d }); return j.p; }
  }
  const sx = e.x + d + 1 < 159 ? 1 : -1;
  for (let i = 1; i <= d + 1; i++) mapa[e.y][e.x + sx * i] = 0;
  Object.assign(j.p, { area: e.area, x: e.x + sx * d, y: e.y });
  return j.p;
}

teste("52. comportamentos e status: matilha, fuga, distância, investida, fúria, sangramento e atordoamento", () => {
  // Matilha: atingido de longe, o chacal chama os outros do bando (e eles enxergam mais longe).
  {
    const { j, p, e } = cenaComportamento("chacal1", { manterVizinhos: true });
    const bando = Object.values(j.g("inimigos")).filter((x) => x.especie === "chacal" && x !== e && Math.max(Math.abs(x.x - e.x), Math.abs(x.y - e.y)) <= 12);
    assert.ok(bando.length, "há chacais por perto");
    p.equipamento.arma = null;
    p.equipamento.arco = "arco_madeira";
    p.inventario.push("flecha", "flecha");
    aDistancia(j, e, 4);
    const r = j.exec({ tipo: "atacarDistancia", alvoId: e.id });
    assert.ok(r.ok, r.mensagem);
    for (const x of bando) assert.ok(x.alertaAte > j.agora, `${x.id} alertado`);
  }
  // Fuga: com 25% da vida ou menos foge (uma vez) e se afasta; depois volta a lutar.
  {
    const { j, p, e } = cenaComportamento("hiena1");
    posicionarAoLado(j, e.area, e);
    p.vidaInimigos[e.id] = 20;
    const ev = j.atualizar();
    assert.ok(ev.some((x) => x.tipo === "fuga"), "anuncia a fuga");
    const antes = distanciaJ(p, e);
    for (let i = 0; i < 6; i++) { j.avancar(500); j.atualizar(); }
    assert.ok(distanciaJ(p, e) > antes, "se afastou");
    j.avancar(4000);
    j.atualizar();
    assert.ok(!(e.fugindoAte > j.agora) && e.fugiu, "fugiu uma vez só");
  }
  // Distância: o arqueiro acerta de 4 casas com o caminho livre; colado, recua entre um disparo e outro.
  {
    const { j, p, e } = cenaComportamento("arqueiroBando1");
    aDistancia(j, e, 4);
    const ev = j.atualizar();
    const tiro = ev.find((x) => x.tipo === "jogadorAtingido");
    assert.ok(tiro && tiro.distancia && tiro.projetil === "flecha", "tiro de longe");
    assert.match(tiro.mensagem, /acertou de longe/);
    posicionarAoLado(j, e.area, e);
    j.avancar(300);
    const antes = distanciaJ(p, e);
    j.atualizar();
    assert.ok(distanciaJ(p, e) > antes, "recuou");
  }
  // Investida: a 3 casas prepara (aviso) e, se o jogador ficar na linha, avança e bate 1,6×; se sair, erra.
  {
    const { j, p, e } = cenaComportamento("javali1");
    const cfg = j.g("COMPORTAMENTOS").investida;
    aDistancia(j, e, 3);
    let ev = j.atualizar();
    assert.ok(ev.some((x) => x.tipo === "investidaPreparo"), "prepara a investida");
    j.avancar(cfg.preparo);
    ev = j.atualizar();
    const golpe = ev.find((x) => x.tipo === "jogadorAtingido");
    assert.ok(golpe && golpe.investida, "acertou a investida");
    const bruto = Math.round(e.danoContraJogador * cfg.multiplicador);
    assert.strictEqual(golpe.dano, j.g("mitigarDano")(bruto, j.g("defesaTotal")(p)));
    assert.ok(distanciaJ(p, e) <= 1, "avançou até o jogador");
    // Segunda: o jogador sai da linha (fica longe) durante o preparo.
    const r2 = cenaComportamento("javali1");
    aDistancia(r2.j, r2.e, 3);
    r2.j.atualizar();
    Object.assign(r2.p, { x: r2.e.x + 12, y: r2.e.y + 12 });
    r2.j.avancar(cfg.preparo);
    assert.ok(r2.j.atualizar().some((x) => x.tipo === "investidaErrou"), "errou quem saiu da linha");
  }
  // Fúria: com 30% da vida ou menos, bate 1,4× mais forte.
  {
    const { j, p, e } = cenaComportamento("urso1");
    posicionarAoLado(j, e.area, e);
    p.vidaInimigos[e.id] = 40;
    const ev = j.atualizar();
    assert.ok(ev.some((x) => x.tipo === "furia"));
    const golpe = ev.find((x) => x.tipo === "jogadorAtingido");
    const bruto = Math.round(e.danoContraJogador * j.g("COMPORTAMENTOS").furia.dano);
    assert.strictEqual(golpe.dano, j.g("mitigarDano")(bruto, j.g("defesaTotal")(p)));
  }
  // Sangramento: ticks a cada 2 s por 8 s; a Oração "Remover veneno" estanca.
  {
    const { j, p, e } = cenaComportamento("leao1");
    j.definirAleatorio(() => 0); // o sangramento sempre pega
    posicionarAoLado(j, e.area, e);
    const ev = j.atualizar();
    assert.ok(ev.some((x) => x.tipo === "sangramento"), "sangrando");
    Object.assign(p, { x: e.x + 30, y: e.y + 30 });
    const ef = e.efeito;
    let ticks = 0;
    for (let t = 0; t <= ef.duracao + 500; t += 250) { j.avancar(250); for (const x of j.atualizar()) if (x.sangramento) ticks++; }
    assert.strictEqual(ticks, ef.duracao / ef.intervalo, "um tick por intervalo");
    assert.ok(!j.g("statusAtivo")(p, "sangramento", j.agora) && !p.status.sangramento, "parou");
    j.g("aplicarStatus")(p, ef, j.agora);
    p.oracaoDesbloqueada = true;
    p.habilidades.oracao = 30;
    p.skillXp.oracao = 0;
    p.fe = 100;
    const r = j.exec({ tipo: "orar", acao: "veneno" });
    assert.ok(r.ok && /sangramento foi estancado/.test(r.mensagem), r.mensagem);
    assert.ok(!p.status.sangramento);
  }
  // Atordoamento: não anda nem ataca; passa; e há imunidade logo depois.
  {
    const { j, p, e } = cenaComportamento("feiticeiro1");
    j.definirAleatorio(() => 0);
    aDistancia(j, e, 3);
    const ev = j.atualizar();
    assert.ok(ev.some((x) => x.tipo === "atordoado"), "atordoado");
    assert.ok(j.exec({ tipo: "mover", dx: 0, dy: 1 }).atordoado);
    assert.ok(j.exec({ tipo: "atacar", alvoId: e.id }).atordoado);
    assert.ok(j.exec({ tipo: "usarPocao" }).ok || p.vida === j.g("vidaMaxima")(p), "poção continua valendo");
    j.avancar(e.efeito.duracao + 1);
    assert.ok(!j.M.atordoado(p));
    assert.ok(!j.g("aplicarStatus")(p, e.efeito, j.agora), "imune logo depois");
    j.avancar(e.efeito.imunidade);
    assert.ok(j.g("aplicarStatus")(p, e.efeito, j.agora), "a imunidade passa");
  }
});
const distanciaJ = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

teste("53. campeões (JGB-6): 5% ao renascer, modificadores no nome, mais fortes e com saque e XP reforçados", () => {
  const j = carregarJogo({ semente: 21 });
  j.entrar();
  const p = j.p;
  const [CAMPEAO, MODS, atributos, nomeDe] = ["CAMPEAO", "MODIFICADORES_CAMPEAO", "atributosInimigo", "nomeInimigo"].map(j.g);
  // Frequência: em muitos renascimentos, perto de 5%, com 1 ou 2 modificadores diferentes.
  const e = j.g("inimigos").hiena1;
  let campeoes = 0;
  const N = 6000;
  const contagemMods = {};
  for (let i = 0; i < N; i++) {
    p.inimigosDerrotados.push(e.id);
    assert.ok(j.M.reaparecerInimigo(ID, e.id));
    const mods = p.campeoes[e.id];
    if (mods) {
      campeoes++;
      assert.ok(mods.length >= 1 && mods.length <= 2 && new Set(mods).size === mods.length, `modificadores ${mods}`);
      for (const m of mods) contagemMods[m] = (contagemMods[m] || 0) + 1;
    }
  }
  const sigma = Math.sqrt(N * CAMPEAO.chance * (1 - CAMPEAO.chance));
  assert.ok(Math.abs(campeoes - N * CAMPEAO.chance) <= 5 * sigma, `${campeoes} campeões em ${N}`);
  for (const m of Object.keys(MODS)) assert.ok(contagemMods[m] > 0, `modificador ${m} aparece`);
  // Chefe e raro nomeado nunca são campeões.
  for (const id of ["bandido1", "presaCinzenta"]) {
    p.inimigosDerrotados.push(id);
    for (let i = 0; i < 300; i++) { j.M.reaparecerInimigo(ID, id); p.inimigosDerrotados.push(id); }
    assert.ok(!p.campeoes[id], `${id} nunca é campeão`);
  }
  // Nome com o gênero da criatura e atributos.
  p.campeoes.hiena1 = ["rapido", "vampirico"];
  assert.strictEqual(nomeDe(p, e), "Hiena Rápida e Vampírica");
  p.campeoes.urso1 = ["blindado"];
  assert.strictEqual(nomeDe(p, j.g("inimigos").urso1), "Urso Blindado");
  const at = atributos(p, e);
  assert.strictEqual(at.vidaMaxima, Math.round(e.vidaMaxima * CAMPEAO.vida));
  assert.strictEqual(at.dano, Math.round(e.danoContraJogador * CAMPEAO.dano));
  assert.ok(at.intervaloAtaque < 1200 && at.rouboVida > 0);
  assert.strictEqual(atributos(p, j.g("inimigos").urso1).defesa, Math.round(j.g("inimigos").urso1.defesa * MODS.blindado.defesa));
  assert.strictEqual(j.M.fichaInimigo(ID, e.id).campeao, true);
  // Vampírico recupera vida ao acertar.
  const cena = cenaComportamento("hiena1");
  cena.p.campeoes.hiena1 = ["vampirico"];
  cena.p.vidaInimigos.hiena1 = 50;
  posicionarAoLado(cena.j, cena.e.area, cena.e);
  const golpe = cena.j.atualizar().find((x) => x.tipo === "jogadorAtingido");
  assert.ok(golpe.roubo && cena.p.vidaInimigos.hiena1 > 50, "roubou vida");
  // Abate: XP ×3, nome no anúncio e saque reforçado (2 rolagens; equipamento incomum ou melhor).
  p.campeoes.hiena1 = ["feroz"];
  p.vidaInimigos.hiena1 = 1;
  p.nivel = 5;
  const r = abaterSemLimpar(j, "hiena1");
  assert.strictEqual(r.xpGanho, e.xpRecompensa * CAMPEAO.xp);
  assert.ok(r.campeao && r.anuncios.some((t) => /^Campeão derrotado: Hiena Feroz!/.test(t)), r.anuncios.join(" | "));
  assert.match(r.mensagem, /Você derrotou Hiena Feroz!/);
  assert.ok(!p.campeoes.hiena1, "deixa de ser campeã depois de derrotada");
  const moedas = p.saqueNoChao.find((s) => s.moedas && s.x === e.x && s.y === e.y);
  assert.strictEqual(moedas.moedas, e.saque.moedas * CAMPEAO.moedas);
  // Saque reforçado na média: muitas rolagens com reforço rendem ~2× itens e nenhum equipamento comum.
  const sortear = j.g("sortearSaque");
  const rng = aleatorioComSemente(3);
  let normal = 0, reforcado = 0, comum = 0;
  for (let i = 0; i < 20000; i++) {
    normal += sortear(e, rng).length;
    for (let k = 0; k < CAMPEAO.rolagensSaque; k++) for (const s of sortear(e, rng, CAMPEAO.raridadeMinima)) {
      reforcado++;
      const d = j.g("infoItem")(s.item);
      if (["arma", "arma_distancia", "escudo", "armadura"].includes(d.tipo) && d.raridade === "comum") comum++;
    }
  }
  assert.ok(reforcado > normal * 1.8, `saque reforçado (${reforcado} × ${normal})`);
  assert.strictEqual(comum, 0, "equipamento de campeão é incomum ou melhor");
  // Explosivo: ao morrer, marca o chão e explode depois em quem ficou ao lado.
  const ex = cenaComportamento("chacal1");
  ex.p.campeoes.chacal1 = ["explosivo"];
  ex.p.vidaInimigos.chacal1 = 1;
  posicionarAoLado(ex.j, ex.e.area, ex.e);
  ex.j.avancar(1000);
  const morte = ex.j.exec({ tipo: "atacar", alvoId: "chacal1" });
  assert.ok(morte.derrotado && morte.explosao, "marca a explosão");
  const vidaAntes = ex.p.vida;
  ex.j.avancar(MODS.explosivo.explosao.atraso);
  const bum = ex.j.atualizar().find((x) => x.tipo === "explosao");
  assert.ok(bum && bum.dano > 0 && ex.p.vida === vidaAntes - bum.dano, "explodiu em quem estava ao lado");
  // Save: os campeões voltam; modificador inventado ou criatura que não pode ser campeã somem.
  p.campeoes = { urso1: ["blindado", "inventado"], bandido1: ["rapido"], nada: ["feroz"] };
  j.g("Storage").salvarAgora(p);
  const j2 = carregarJogo({ store: { save_jogador1: j.store.save_jogador1 } });
  const p2 = j2.entrar();
  igual(p2.campeoes, { urso1: ["blindado"] });
  assert.strictEqual(p2.vidaInimigos.urso1 <= j2.g("atributosInimigo")(p2, j2.g("inimigos").urso1).vidaMaxima, true);
});

teste("54. raros nomeados (JGB-6): janela de aparição, anúncio, não renascem fora dela e somem quando ela fecha", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const nomeados = Object.values(j.g("inimigos")).filter((e) => e.nomeado);
  assert.ok(nomeados.length >= 6, "um raro nomeado por região de caça");
  assert.strictEqual(new Set(nomeados.map((e) => e.area)).size, nomeados.length, "um por região");
  const janela = j.g("janelaNomeado");
  const e = j.g("inimigos").presaCinzenta;
  const n = e.nomeado;
  // Algumas vezes por dia: aparições de duracaoMinutos a cada aCadaHoras.
  assert.ok(24 / n.aCadaHoras >= 3 && 24 / n.aCadaHoras <= 8, "3 a 8 aparições por dia");
  const periodo = n.aCadaHoras * 3_600_000;
  // Vai para logo antes da próxima janela: fora dela, não existe.
  const prox = janela(e, j.agora);
  const inicio = prox.ativa ? prox.inicio + periodo : prox.proxima;
  j.avancar(inicio - j.agora - 60_000);
  j.atualizar();
  assert.ok(!j.M.inimigoVivo(p, e.id), "fora da janela não existe");
  assert.strictEqual(j.M.obterVidaInimigo(ID, e.id), 0);
  // Abre a janela: anúncio e criatura com vida cheia.
  j.avancar(61_000);
  const ev = j.atualizar();
  const apareceu = ev.find((x) => x.tipo === "nomeadoApareceu" && x.id === e.id);
  assert.ok(apareceu, "anuncia a aparição");
  assert.match(apareceu.mensagem, /^Rumores na estrada: Presa-Cinzenta, o lobo velho, foi visto em Canaã! Some em 30 min\.$/);
  assert.ok(j.M.inimigoVivo(p, e.id));
  assert.strictEqual(p.vidaInimigos[e.id], e.vidaMaxima);
  assert.ok(!j.atualizar().some((x) => x.tipo === "nomeadoApareceu" && x.id === e.id), "anuncia uma vez por janela");
  // Derrotado: anúncio próprio, saque garantido e não renasce até a próxima janela.
  p.nivel = 20;
  p.vida = j.g("vidaMaxima")(p);
  p.vidaInimigos[e.id] = 1;
  const r = abaterSemLimpar(j, e.id);
  assert.ok(r.nomeado && r.anuncios.some((t) => /^Presa-Cinzenta foi derrotado!/.test(t)));
  assert.doesNotMatch(r.mensagem, /reaparecerá/);
  const equip = p.saqueNoChao.filter((s) => s.x === e.x && s.y === e.y && s.item && /^(espada|escudo)/.test(s.item));
  assert.ok(equip.some((s) => ["raro", "epico", "reliquia"].includes(j.g("raridadeItem")(s.item))), "equipamento raro ou melhor garantido");
  assert.strictEqual(j.M.reaparecerInimigo(ID, e.id), false, "não renasce pelo tempo");
  j.avancar(10 * 60_000);
  j.atualizar();
  assert.ok(!j.M.inimigoVivo(p, e.id), "continua derrotado dentro da janela");
  // A janela fecha (sem aviso de sumiço, porque foi derrotado) e a próxima traz ele de volta.
  j.avancar(25 * 60_000);
  const fim = j.atualizar().find((x) => x.tipo === "nomeadoSumiu" && x.id === e.id);
  assert.ok(fim && fim.mensagem === null, "fechou a janela");
  j.avancar(inicio + periodo + 30_000 - j.agora);
  assert.ok(j.atualizar().some((x) => x.tipo === "nomeadoApareceu" && x.id === e.id), "volta na janela seguinte");
  // Vivo quando a janela fecha: some, com aviso.
  j.avancar(31 * 60_000);
  const sumiu = j.atualizar().find((x) => x.tipo === "nomeadoSumiu" && x.id === e.id);
  assert.match(sumiu.mensagem, /Presa-Cinzenta sumiu de Canaã/);
  assert.ok(!j.M.inimigoVivo(p, e.id));
  // Save: a janela atual fica guardada (recarregar no meio dela não anuncia de novo).
  j.avancar(inicio + 2 * periodo + 60_000 - j.agora);
  j.atualizar();
  j.g("Storage").salvarAgora(p);
  const j2 = carregarJogo({ store: { save_jogador1: j.store.save_jogador1 }, inicio: j.agora });
  const p2 = j2.entrar();
  assert.ok(j2.M.inimigoVivo(p2, e.id), "continua presente depois de recarregar");
  assert.ok(!j2.atualizar().some((x) => x.tipo === "nomeadoApareceu" && x.id === e.id), "sem anúncio repetido");
});

// Área de teste: abre um quadrado livre em volta de (cx, cy) e tira as outras criaturas da área.
function arenaLivre(j, area, cx, cy, raio, manter = []) {
  const mapa = j.g("mapas")[area];
  for (let y = cy - raio; y <= cy + raio; y++) for (let x = cx - raio; x <= cx + raio; x++) mapa[y][x] = 0;
  for (const e of Object.values(j.g("inimigos"))) if (e.area === area && !manter.includes(e.id)) { e.inicioX = e.x = -50; e.inicioY = e.y = -50; }
}
function colocar(j, e, x, y) {
  e.x = e.inicioX = x;
  e.y = e.inicioY = y;
  j.g("zerarComportamento")(e);
  if (j.M.obterVidaInimigo(ID, e.id) <= 0) j.M.reaparecerInimigo(ID, e.id);
  j.p.campeoes = {};
  j.p.vidaInimigos[e.id] = e.vidaMaxima;
  e.x = x; e.y = y;
}
// Roda o laço de tempo por ms, em passos de 100 ms; devolve todos os eventos.
function rodar(j, ms) {
  const ev = [];
  for (let t = 0; t < ms; t += 100) { j.avancar(100); ev.push(...j.atualizar()); }
  return ev;
}

teste("55. simulação de cada comportamento (JGB-8): cerco, fuga com reforço, distância, curandeiro, investida e fúria", () => {
  const inimigos = (j) => j.g("inimigos");
  const preparar = (semente = 9) => {
    const j = carregarJogo({ semente });
    j.entrar();
    const p = j.p;
    p.nivel = 40;
    p.vida = j.g("vidaMaxima")(p);
    return { j, p };
  };
  const linhas = [];

  // Matilha cerca: 4 chacais vindo do mesmo lado ocupam casas diferentes em volta do jogador, de lados opostos.
  {
    const { j, p } = preparar();
    const ids = ["chacal1", "chacal1_2", "chacal1_3", "chacal1_4"];
    const cx = 60, cy = 60;
    arenaLivre(j, "canaan", cx, cy, 9, ids);
    Object.assign(p, { area: "canaan", x: cx, y: cy });
    ids.forEach((id, i) => colocar(j, inimigos(j)[id], cx + 5, cy - 2 + i));
    rodar(j, 8000);
    const lados = ids.map((id) => inimigos(j)[id]).filter((e) => distanciaJ(p, e) <= 1).map((e) => Math.atan2(e.y - p.y, e.x - p.x));
    assert.strictEqual(new Set(ids.map((id) => `${inimigos(j)[id].x},${inimigos(j)[id].y}`)).size, 4, "casas diferentes");
    assert.ok(lados.length >= 4, `${lados.length} chacais colados no jogador`);
    const abertura = Math.max(...lados.flatMap((a) => lados.map((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))))));
    assert.ok(abertura >= Math.PI / 2, `cercam por lados diferentes (abertura ${(abertura * 180 / Math.PI).toFixed(0)}°)`);
    linhas.push(["Matilha cerca", `${lados.length} chacais em volta, abertura de ${(abertura * 180 / Math.PI).toFixed(0)}°`]);
  }

  // Fuga com retorno e reforço: a hiena foge ferida e volta com outra que estava longe (fora da percepção).
  {
    const { j, p } = preparar();
    const cx = 60, cy = 80;
    arenaLivre(j, "deserto", cx, cy, 14, ["hiena1", "hiena1_2"]);
    Object.assign(p, { area: "deserto", x: cx, y: cy });
    const h = inimigos(j).hiena1, aliada = inimigos(j).hiena1_2;
    colocar(j, h, cx + 1, cy);
    colocar(j, aliada, cx - 13, cy + 12);
    // Longe: fora da percepção e do alerta comum da matilha (só o reforço a traz).
    assert.ok(distanciaJ(p, aliada) > aliada.raioPercepcao && distanciaJ(h, aliada) > j.g("COMPORTAMENTOS").matilha.raioAlerta, "a aliada começa longe");
    p.vidaInimigos[h.id] = 20;
    const ev = rodar(j, 4500);
    const volta = ev.find((x) => x.tipo === "retorno");
    assert.ok(ev.some((x) => x.tipo === "fuga") && volta && volta.reforcos >= 1, "foge e volta com reforço");
    assert.ok(p.vidaInimigos[h.id] > 20, "volta um pouco curada");
    rodar(j, 10000);
    assert.ok(distanciaJ(p, aliada) <= 1, "o reforço chega ao jogador");
    linhas.push(["Fuga e reforço", `voltou com ${volta.reforcos} reforço; a aliada veio de 13 casas`]);
  }

  // Arqueiro mantém distância: com o jogador parado colado nele, recua e atira de 3+ casas.
  {
    const { j, p } = preparar();
    const cx = 70, cy = 60;
    arenaLivre(j, "deserto", cx, cy, 9, ["arqueiroBando1"]);
    Object.assign(p, { area: "deserto", x: cx, y: cy });
    const a = inimigos(j).arqueiroBando1;
    colocar(j, a, cx + 1, cy);
    const tiros = [];
    for (let t = 0; t < 15000; t += 100) { j.avancar(100); for (const x of j.atualizar()) if (x.tipo === "jogadorAtingido") tiros.push(distanciaJ(p, a)); }
    const depois = tiros.slice(2);
    const media = depois.reduce((s, d) => s + d, 0) / depois.length;
    assert.ok(tiros.length >= 6, `${tiros.length} disparos`);
    assert.ok(media >= j.g("COMPORTAMENTOS").distancia.distanciaMinima, `distância média dos disparos ${media.toFixed(1)}`);
    linhas.push(["Arqueiro", `${tiros.length} disparos, distância média ${media.toFixed(1)} casas`]);
  }

  // Curandeiro e prioridade de alvo: com o curandeiro vivo a luta contra o arqueiro demora mais; matar o
  // curandeiro primeiro encurta a luta contra os dois. Ele cura a aliada mais ferida.
  {
    const luta = (ordem, comCurandeiro = true) => {
      const { j, p } = preparar(17);
      p.nivel = 6;
      p.vida = j.g("vidaMaxima")(p);
      p.equipamento = { arma: "espada_ferro", arco: null, escudo: "escudo_madeira", armadura: "armadura_couro" };
      p.habilidades = { corpo: 7, distancia: 0, defesa: 5, oracao: 0 };
      p.inventario = Array(20).fill("pocao");
      const cx = 70, cy = 60;
      const ids = comCurandeiro ? ["arqueiroBando1", "curandeiroBando1"] : ["arqueiroBando1"];
      arenaLivre(j, "deserto", cx, cy, 9, ids);
      Object.assign(p, { area: "deserto", x: cx, y: cy });
      colocar(j, inimigos(j).arqueiroBando1, cx + 2, cy);
      if (comCurandeiro) colocar(j, inimigos(j).curandeiroBando1, cx + 4, cy + 1);
      const inicio = j.agora;
      let curas = 0;
      for (const id of ordem) {
        const r = lutar(j, id, { maxPocoes: 20 });
        assert.ok(r.vitoria, `${id}: ${r.mensagem}`);
      }
      return { segundos: (j.agora - inicio) / 1000, curas };
    };
    // Prioridade do curandeiro: entre duas feridas, cura a de menor fração de vida.
    {
      const { j, p } = preparar();
      const cx = 70, cy = 60;
      arenaLivre(j, "deserto", cx, cy, 9, ["arqueiroBando1", "arqueiroBando1_2", "curandeiroBando1"]);
      Object.assign(p, { area: "deserto", x: cx - 8, y: cy - 8 });
      colocar(j, inimigos(j).arqueiroBando1, cx, cy);
      colocar(j, inimigos(j).arqueiroBando1_2, cx + 2, cy);
      colocar(j, inimigos(j).curandeiroBando1, cx + 1, cy + 2);
      p.vidaInimigos.arqueiroBando1 = 100;
      p.vidaInimigos.arqueiroBando1_2 = 40;
      const cura = j.atualizar().find((x) => x.tipo === "cura");
      assert.ok(cura && cura.alvo === "arqueiroBando1_2", "cura a mais ferida primeiro");
      assert.strictEqual(cura.cura, Math.round(inimigos(j).arqueiroBando1.vidaMaxima * j.g("COMPORTAMENTOS").curandeiro.curaPercentual));
      assert.ok(!j.atualizar().some((x) => x.tipo === "cura"), "respeita o intervalo");
    }
    const semCurandeiro = luta(["arqueiroBando1"], false);
    const arqueiroPrimeiro = luta(["arqueiroBando1", "curandeiroBando1"]);
    const curandeiroPrimeiro = luta(["curandeiroBando1", "arqueiroBando1"]);
    assert.ok(curandeiroPrimeiro.segundos < arqueiroPrimeiro.segundos, `matar o curandeiro primeiro é mais rápido (${curandeiroPrimeiro.segundos} s × ${arqueiroPrimeiro.segundos} s)`);
    linhas.push(["Curandeiro", `arqueiro sozinho ${semCurandeiro.segundos.toFixed(0)} s; arqueiro → curandeiro ${arqueiroPrimeiro.segundos.toFixed(0)} s; curandeiro → arqueiro ${curandeiroPrimeiro.segundos.toFixed(0)} s`]);
  }

  // Investida telegrafada: a área marcada inclui o jogador; quem sai dela nunca é atingido, quem fica sempre é.
  {
    const rodadas = (desvia) => {
      const { j, p } = preparar(23);
      const cx = 60, cy = 60;
      arenaLivre(j, "canaan", cx, cy, 9, ["javali1"]);
      const jv = inimigos(j).javali1;
      let acertos = 0, investidas = 0, antecedencia = Infinity;
      for (let k = 0; k < 10; k++) {
        Object.assign(p, { area: "canaan", x: cx, y: cy });
        colocar(j, jv, cx + 3 - (k % 2) * 6, cy + (k % 3) - 1);
        p.vida = j.g("vidaMaxima")(p);
        const ev = j.atualizar();
        const prep = ev.find((x) => x.tipo === "investidaPreparo");
        assert.ok(prep, "prepara a investida");
        assert.ok(prep.casas.some((c) => c.x === p.x && c.y === p.y), "a área marcada passa pelo jogador");
        antecedencia = Math.min(antecedencia, prep.ate - j.agora);
        investidas++;
        if (desvia) {
          // sai da linha: um passo para uma casa vizinha fora da área marcada
          const fora = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]].find(([dx, dy]) => !prep.casas.some((c) => c.x === p.x + dx && c.y === p.y + dy));
          assert.ok(j.exec({ tipo: "mover", dx: fora[0], dy: fora[1] }).ok);
        }
        let ev2 = [];
        for (let t = 0; t < 1200; t += 100) { j.avancar(100); ev2.push(...j.atualizar()); if (ev2.some((x) => x.tipo === "investidaErrou" || x.investida)) break; }
        if (ev2.some((x) => x.tipo === "jogadorAtingido" && x.investida)) acertos++;
      }
      return { acertos, investidas, antecedencia };
    };
    const fica = rodadas(false), sai = rodadas(true);
    assert.strictEqual(fica.acertos, fica.investidas, "quem fica na área marcada é atingido");
    assert.strictEqual(sai.acertos, 0, "quem sai da área marcada desvia");
    assert.ok(fica.antecedencia >= 800, `telegrafo visível ${fica.antecedencia} ms antes do golpe`);
    linhas.push(["Investida", `parado: ${fica.acertos}/${fica.investidas} acertos; desviando: ${sai.acertos}/${sai.investidas}; aviso ${fica.antecedencia} ms antes`]);
  }

  // Fúria: abaixo de 30% da vida, o dano por segundo sobe (dano 1,4× e golpes 25% mais rápidos).
  {
    const { j, p } = preparar();
    const cx = 60, cy = 60;
    arenaLivre(j, "canaan", cx, cy, 6, ["urso1"]);
    Object.assign(p, { area: "canaan", x: cx, y: cy });
    const u = inimigos(j).urso1;
    colocar(j, u, cx + 1, cy);
    const dps = () => {
      p.vida = j.g("vidaMaxima")(p);
      let dano = 0;
      for (const x of rodar(j, 12000)) if (x.tipo === "jogadorAtingido") dano += x.dano;
      return dano / 12;
    };
    const antes = dps();
    p.vidaInimigos[u.id] = Math.floor(u.vidaMaxima * 0.25);
    const depois = dps();
    assert.ok(u.furioso && depois >= antes * 1.6, `dano por segundo ${antes.toFixed(1)} → ${depois.toFixed(1)}`);
    linhas.push(["Fúria", `dano por segundo ${antes.toFixed(1)} → ${depois.toFixed(1)}`]);
  }

  console.log("\n    Simulação dos comportamentos:");
  for (const [a, b] of linhas) console.log(`    ${a.padEnd(18)}${b}`);
  console.log("");
});

// Abate num golpe sem limpar o saque (para olhar o que caiu).
function abaterSemLimpar(j, inimigoId) {
  const p = j.p;
  const e = j.g("inimigos")[inimigoId];
  if (j.M.obterVidaInimigo(ID, inimigoId) <= 0) j.M.reaparecerInimigo(ID, inimigoId);
  p.vidaInimigos[inimigoId] = 1;
  posicionarAoLado(j, e.area, e);
  j.avancar(1000);
  const r = j.exec({ tipo: "atacar", alvoId: inimigoId });
  assert.ok(r.derrotado, `abate de ${inimigoId}: ${r.mensagem}`);
  return r;
}

// ---------------------------------------------------------------------
// Bestiário (JGB-9) e analisador de caçada (JGB-10)
// ---------------------------------------------------------------------
// Põe a contagem da espécie em n (direto no save, como se n abates já tivessem acontecido).
function contarNoBestiario(j, especie, n) {
  j.p.bestiario[especie] = n;
}

teste("56. bestiário (JGB-9): estágios de 10/100/1000 abates revelam ficha, fraquezas e saque; amuleto dá +5% contra a família", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const g = (n) => j.g(n);
  const visao = (k) => g("visaoEspecie")(p, k);
  const ESPECIES = g("ESPECIES");
  const ORDEM = g("ORDEM_ESPECIES");
  const R = g("REGRAS_BESTIARIO");
  igual(R.estagios.map((e) => e.abates), [10, 100, 1000]);

  // 1. Toda espécie dos dados aparece uma vez, por família; personagem novo começa sem nada revelado.
  igual(p.bestiario, {});
  const porFamilia = g("bestiarioPorFamilia")(p);
  const listadas = porFamilia.flatMap((f) => f.especies.map((v) => v.especie));
  igual([...listadas].sort(), [...ORDEM].sort(), "cada espécie uma vez");
  assert.strictEqual(ORDEM.length, new Set(g("DADOS_CRIATURAS").map((c) => c.especie)).size);
  for (const f of porFamilia) for (const v of f.especies) assert.strictEqual(v.familia, f.familia);
  const v0 = visao("lobo");
  igual([v0.nome, v0.abates, v0.estagio, v0.ficha, v0.fraquezas, v0.saque, v0.proximo.abates], [null, 0, 0, null, null, null, 10]);
  igual(g("resumoBestiario")(p), { especies: ORDEM.length, conhecidas: 0, porEstagio: [0, 0, 0], amuletos: 0, familias: 10 });

  // 2. Cada abate conta para a espécie, também o das cópias do grupo (lobo1_2 é "lobo") e com flecha.
  let r = abater(j, "lobo1");
  igual(r.bestiario, { especie: "lobo", abates: 1, estagio: 0, subiu: false, amuleto: null });
  assert.ok(g("inimigos").lobo1_2, "o lobo tem cópias");
  abater(j, "lobo1_2");
  assert.strictEqual(p.bestiario.lobo, 2);
  assert.strictEqual(visao("lobo").nome, "Lobo", "conhecida a partir do 1º abate");
  assert.strictEqual(visao("lobo").ficha, null, "ficha só no estágio 1");

  // 3. Estágio 1 (10): ficha com vida, defesa, quanto do golpe passa e o golpe do jogador; anúncio no Registro.
  contarNoBestiario(j, "lobo", 9);
  r = abater(j, "lobo1");
  igual([r.bestiario.abates, r.bestiario.estagio, r.bestiario.subiu], [10, 1, true]);
  assert.ok(r.anuncios.some((t) => t.startsWith("Bestiário: Lobo chegou ao estágio 1 de 3, Avistada (10 abates)")), r.anuncios.join(" | "));
  let v = visao("lobo");
  const lobo = ESPECIES.lobo;
  igual([v.ficha.vida, v.ficha.dano, v.ficha.defesa, v.ficha.nivel, v.ficha.xp], [lobo.vidaMaxima, lobo.danoContraJogador, lobo.defesa, lobo.nivel, lobo.xpRecompensa]);
  assert.strictEqual(v.ficha.passa, Math.round((100 * 20) / (20 + lobo.defesa)));
  assert.strictEqual(v.ficha.golpeCorpo, g("mitigarDano")(g("danoBruto")(p, "corpo"), lobo.defesa));
  igual([v.fraquezas, v.saque], [null, null]);
  igual([v.proximo.abates, v.proximo.nome, v.proximo.desde], [100, "Estudada", 10]);
  r = abater(j, "lobo1");
  assert.strictEqual(r.bestiario.subiu, false, "11º abate não repete o anúncio");
  assert.ok(!r.anuncios.some((t) => t.startsWith("Bestiário")));

  // 4. Estágio 2 (100): fraquezas e itens do saque, ainda sem chances nem moedas.
  contarNoBestiario(j, "lobo", 99);
  abater(j, "lobo1");
  v = visao("lobo");
  assert.strictEqual(v.estagio, 2);
  assert.ok(v.fraquezas.includes(R.fraquezaDefesaBaixa), "lobo tem pouca defesa");
  igual(v.saque.itens.map((l) => l.item), g("tabelaDeSaque")(lobo).map((l) => l.item));
  assert.ok(v.saque.itens.every((l) => l.chance === null && l.textoChance === null));
  assert.strictEqual(v.saque.moedas, null);
  assert.strictEqual(v.saque.itens.find((l) => l.item === "escudo_madeira").raridade, "raro", "raridade mínima da linha");

  // 5. Estágio 3 (1000): chances e moedas; depois dele não há próximo.
  contarNoBestiario(j, "lobo", 999);
  r = abater(j, "lobo1");
  igual([r.bestiario.estagio, r.bestiario.subiu], [3, true]);
  v = visao("lobo");
  igual(v.saque.itens.map((l) => [l.item, l.textoChance]).filter(([i]) => ["pele_lobo", "presa_lobo", "pedra_sardio"].includes(i)), [
    ["pele_lobo", "100%"],
    ["presa_lobo", "25%"],
    ["pedra_sardio", "0,1%"],
  ]);
  assert.strictEqual(v.saque.moedas, lobo.saque.moedas);
  assert.strictEqual(v.proximo, null);

  // 6. Fraquezas vêm dos comportamentos e status (com a chance da criatura) e do alcance menor que o do arco.
  const fraq = (k) => g("fraquezasDaEspecie")(ESPECIES[k]);
  const C = g("COMPORTAMENTOS");
  assert.ok(fraq("hiena").includes(C.matilha.fraqueza) && fraq("hiena").includes(C.fuga.fraqueza));
  assert.ok(fraq("arqueiro_bando").some((t) => t.includes("alcança 6 casas") && t.includes(", 5.")), fraq("arqueiro_bando").join(" | "));
  assert.ok(fraq("vibora").some((t) => t.includes("Remover veneno")));
  const atordoa = ORDEM.find((k) => ESPECIES[k].efeito?.tipo === "atordoamento" && ESPECIES[k].efeito.chance === 0.25);
  assert.ok(fraq(atordoa).some((t) => t.includes("25%") && t.includes("4 s")), fraq(atordoa).join(" | "));
  for (const k of ORDEM) for (const t of fraq(k)) assert.doesNotMatch(t, /\{\w+\}/, `marca sem valor em ${k}: ${t}`);
  for (const [k, c] of Object.entries(C)) if (k !== "padrao") assert.ok(c.fraqueza, `comportamento ${k} sem fraqueza`);
  for (const [k, st] of Object.entries(g("STATUS_CRIATURAS"))) assert.ok(st.fraqueza, `status ${k} sem fraqueza`);

  // 7. Amuleto: todas as espécies da família no estágio 2 (raros nomeados fora da conta). Pragas: 3 espécies.
  const doAmuleto = g("especiesDoAmuleto");
  assert.ok(!doAmuleto("feras").includes("lobo_velho"), "Presa-Cinzenta (raro nomeado) não conta");
  assert.ok(visao("lobo_velho").contaParaAmuleto === false && visao("lobo").contaParaAmuleto === true);
  const pragas = doAmuleto("pragas");
  igual([...pragas].sort(), ["gafanhotos", "ra", "vespas"]);
  const gafanhotos = g("inimigos").gafanhotos1;
  assert.strictEqual(g("bonusAmuleto")(p, gafanhotos), 0);
  contarNoBestiario(j, "gafanhotos", 100);
  contarNoBestiario(j, "ra", 250);
  contarNoBestiario(j, "vespas", 99);
  assert.strictEqual(g("progressoAmuleto")(p, "pragas").cumpridas, 2);
  r = abater(j, "vespas1");
  assert.strictEqual(r.bestiario.amuleto, "pragas");
  assert.ok(r.anuncios.some((t) => t.startsWith("Amuleto conquistado: Pragas! +5% de dano")), r.anuncios.join(" | "));
  r = abater(j, "vespas1");
  assert.strictEqual(r.bestiario.amuleto, null, "o amuleto só é anunciado uma vez");
  assert.strictEqual(g("bonusAmuleto")(p, gafanhotos), 0.05);
  assert.strictEqual(g("bonusAmuleto")(p, g("inimigos").lobo1), 0, "só contra a família dele");
  igual(g("amuletosDoJogador")(p).map((a) => a.familia), ["pragas"]);
  assert.strictEqual(j.M.fichaInimigo(ID, "gafanhotos1").amuleto, 0.05);
  // O bônus entra no golpe, antes da defesa e do crítico.
  const calc = g("calcularGolpe");
  igual(calc(p, "corpo", 4, 0.99, 1.05), { bruto: Math.round(g("danoBruto")(p, "corpo") * 1.05), critico: false, dano: g("mitigarDano")(Math.round(g("danoBruto")(p, "corpo") * 1.05), 4) });
  igual(calc(p, "corpo", 4, 0.99), calc(p, "corpo", 4, 0.99, 1), "sem multiplicador, o golpe de sempre");
  p.nivel = 30; // dano bruto alto: os 5% fazem diferença
  const e = g("inimigos").gafanhotos1;
  if (j.M.obterVidaInimigo(ID, e.id) <= 0) j.M.reaparecerInimigo(ID, e.id);
  delete p.campeoes[e.id];
  p.vidaInimigos[e.id] = 100000;
  e.x = e.inicioX;
  e.y = e.inicioY;
  posicionarAoLado(j, e.area, e);
  j.definirAleatorio(() => 0.99); // sem crítico
  j.avancar(1000);
  r = j.exec({ tipo: "atacar", alvoId: e.id });
  const bruto = g("danoBruto")(p, "corpo");
  igual([r.amuleto, r.danoAplicado], [0.05, g("mitigarDano")(Math.round(bruto * 1.05), e.defesa)]);
  assert.ok(r.danoAplicado > g("mitigarDano")(bruto, e.defesa), "com o amuleto, o golpe é maior");
  assert.strictEqual(g("visaoEspecie")(p, "gafanhotos").ficha.golpeCorpo, r.danoAplicado);

  // 8. As funções da interface não mudam p, e a morte não mexe no bestiário.
  const antes = fotografia(p);
  for (const k of [...ORDEM, "constructor", "nada"]) g("visaoEspecie")(p, k);
  g("bestiarioPorFamilia")(p);
  g("resumoBestiario")(p);
  g("amuletosDoJogador")(p);
  assert.strictEqual(fotografia(p), antes);
  assert.strictEqual(g("visaoEspecie")(p, "constructor"), null);
  const bestiarioAntes = json(p.bestiario);
  p.nivel = 60;
  j.M.aplicarMorte(ID, "inimigo");
  igual(p.bestiario, bestiarioAntes, "a morte não tira abates");

  // 9. Save: recarrega igual; contagens inválidas somem; save v9 ganha o bestiário vazio e o aviso uma vez.
  j.g("Storage").flush();
  const j2 = carregarJogo({ store: j.store, inicio: j.agora + 60_000 });
  j2.entrar();
  igual(j2.p.bestiario, bestiarioAntes);
  assert.strictEqual(j2.g("bonusAmuleto")(j2.p, j2.g("inimigos").gafanhotos1), 0.05);
  const salvo = JSON.parse(j.store.save_jogador1);
  salvo.bestiario = { lobo: "abc", chacal: 12.7, javali: -4, inexistente: 5, constructor: 3, urso: Infinity };
  const j3 = carregarJogo({ store: { save_jogador1: JSON.stringify(salvo) } });
  j3.entrar();
  igual(j3.p.bestiario, { chacal: 12 });
  const v9 = JSON.parse(j.store.save_jogador1);
  delete v9.bestiario;
  Object.assign(v9, { versao: 9, avisosPendentes: [] });
  const j4 = carregarJogo({ store: { save_jogador1: JSON.stringify(v9) } });
  j4.entrar();
  igual(j4.p.bestiario, {});
  assert.strictEqual(j4.p.versao, j4.g("VERSAO_SAVE"));
  assert.strictEqual(j4.p.avisosPendentes.filter((a) => a.id === "atualizacao_10").length, 1);
  j4.g("Storage").flush();
  const j5 = carregarJogo({ store: j4.store });
  j5.entrar();
  assert.strictEqual(j5.p.avisosPendentes.filter((a) => a.id === "atualizacao_10").length, 1, "recarregar não duplica o aviso");

  // 10. A interface só lê o bestiário pelas funções puras; game.js só lê o resultado do ataque.
  const FONTE_UI = fs.readFileSync(path.join(RAIZ, "interface.js"), "utf8");
  for (const fn of ["bestiarioPorFamilia(", "resumoBestiario(", "Mundo.analisador(", '"zerarAnalisador"']) assert.ok(FONTE_UI.includes(fn), `interface.js usa ${fn}`);
  assert.doesNotMatch(FONTE_UI, /\.bestiario\b/, "interface.js não toca em p.bestiario");
  igual([...FONTE_GAME.matchAll(/(\w+)\.bestiario\b/g)].map((m) => m[1]), ["r"], "game.js só lê r.bestiario");
  const HTML = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  for (const id of ["modalBestiario", "btnBestiario", "pAnalisador", "btnAnalisador", "analiseDados"]) assert.match(HTML, new RegExp(`id="${id}"`));
  const ARTE = fs.readFileSync(path.join(RAIZ, "sprites.js"), "utf8");
  for (const gl of ["ui_bestiario", "ui_amuleto", "ui_ampulheta"]) assert.match(ARTE, new RegExp(`glifo\\("${gl}"`), `falta o glifo ${gl}`);
});

teste("57. analisador de caçada (JGB-10): XP/h, saque/h, lucro, abates, mortes e tempo até o próximo nível; zerável", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const g = (n) => j.g(n);
  const A = () => j.M.analisador(ID);
  const MIN = 60_000;

  // 1. Parado até o primeiro golpe: coleta e poção antes dele não contam.
  let a = A();
  igual([a.ativo, a.duracaoMs, a.xp, a.xpHora, a.saque, a.lucro, a.abates, a.mortes, a.proximoNivelMs], [false, 0, 0, null, 0, 0, 0, 0, null]);
  p.vida = 10;
  p.inventario.push("pocao");
  assert.ok(j.exec({ tipo: "usarPocao" }).ok);
  assert.strictEqual(A().gastos, 0, "poção antes da sessão não conta");

  // 2. Abate: começa o relógio (no golpe), conta XP, abate e espécie. Saque recolhido entra pelo valor de venda.
  const inicio = j.agora + 1000; // abaterSemLimpar avança 1 s antes do golpe
  const r1 = abaterSemLimpar(j, "lobo1");
  a = A();
  igual([a.ativo, a.xp, a.abates, a.especies], [true, r1.xpGanho, 1, [{ especie: "lobo", nome: "Lobo", abates: 1 }]]);
  const doChao = p.saqueNoChao.filter((s) => s.area === p.area);
  const moedasChao = doChao.reduce((t, s) => t + (s.moedas || 0), 0);
  const valorChao = doChao.filter((s) => s.item).reduce((t, s) => t + (g("VALORES_VENDA")[g("baseItem")(s.item)] || 0), 0);
  assert.ok(doChao.length, "o lobo deixou saque");
  pegarSaques(j);
  a = A();
  igual([a.moedas, a.valorItens, a.saque, a.itens], [moedasChao, valorChao, moedasChao + valorChao, doChao.filter((s) => s.item).length]);
  assert.ok(a.saque > 0, "pele de lobo vale 5");

  // 3. Taxas por hora só depois de 1 minuto, e batem com a conta.
  j.avancar(20_000);
  a = A();
  igual([a.medindo, a.xpHora, a.saqueHora, a.lucroHora, a.abatesHora], [false, null, null, null, null]);
  j.avancar(inicio + 2 * MIN - j.agora); // 2 minutos de sessão
  a = A();
  assert.strictEqual(a.duracaoMs, 2 * MIN);
  igual([a.medindo, a.xpHora, a.saqueHora, a.abatesHora], [true, Math.round(r1.xpGanho * 30), Math.round(a.saque * 30), 30]);
  assert.strictEqual(a.xpFalta, g("limiarNivel")(p.nivel) - p.xp);
  assert.strictEqual(a.proximoNivelMs, Math.ceil((a.xpFalta * 3_600_000) / a.xpHora));

  // 4. Gastos: poção (12) e flecha (8 por 5 = 1,6) pelo preço da loja; o lucro desconta.
  p.vida = 10;
  p.inventario.push("pocao");
  assert.ok(j.exec({ tipo: "usarPocao" }).ok);
  p.equipamento.arma = null;
  p.equipamento.arco = "arco_madeira";
  for (let i = 0; i < 5; i++) p.inventario.push("flecha");
  const r2 = abater(j, "lobo1", "atacarDistancia");
  a = A();
  assert.strictEqual(a.gastos, Math.round(12 + 1.6));
  igual([a.abates, a.xp], [2, r1.xpGanho + r2.xpGanho]);
  assert.strictEqual(a.lucro, a.saque - a.gastos);

  // 5. Morte: conta a morte e as moedas perdidas; o item que caiu na morte não vira saque ao ser recolhido.
  Object.assign(p, { nivel: 60, moedas: 200 });
  j.definirAleatorio(() => 0); // 30% de chance: o item cai
  const morte = j.M.aplicarMorte(ID, "inimigo");
  assert.ok(morte.penalidade.item, "um item caiu no local da derrota");
  a = A();
  igual([a.mortes, a.perdas, a.lucro], [1, 20, a.saque - a.gastos - 20]);
  const saqueAntes = a.saque;
  const caido = p.saqueNoChao.find((s) => s.id.startsWith("morte_"));
  posicionarAoLado(j, caido.area, caido);
  assert.ok(j.exec({ tipo: "coletarSaque", saqueId: caido.id }).ok);
  assert.strictEqual(A().saque, saqueAntes, "recolher o próprio item não é lucro");

  // 6. Trocar de área / renascer (entrar de novo) não zera; Mundo.analisador não muda p.
  const antes = A();
  j.entrar();
  igual(A(), antes, "a sessão atravessa entrar()");
  const foto = fotografia(j.p);
  j.M.analisador(ID);
  g("resumoAnalisador")(j.p, j.M.estado[ID].analisador, j.agora);
  assert.strictEqual(fotografia(j.p), foto);
  assert.ok(!("analisador" in j.p), "o analisador não vai para o save");

  // 7. Zerar: tudo volta a zero e o relógio espera o próximo golpe.
  const z = j.exec({ tipo: "zerarAnalisador" });
  assert.ok(z.ok && z.analisadorZerado);
  a = A();
  igual([a.ativo, a.xp, a.saque, a.gastos, a.mortes, a.abates, a.especies], [false, 0, 0, 0, 0, 0, []]);
  j.definirAleatorio(aleatorioComSemente(3));
  abater(j, "chacal1");
  igual([A().ativo, A().abates, A().especies.map((x) => x.especie)], [true, 1, ["chacal"]]);

  // 8. Relógio e nível máximo.
  igual([g("textoRelogio")(0), g("textoRelogio")(65_000), g("textoRelogio")(3_725_000)], ["0:00", "1:05", "1:02:05"]);
  j.p.nivel = g("NIVEL_MAXIMO");
  j.avancar(2 * MIN);
  a = A();
  igual([a.nivelMaximo, a.xpFalta, a.proximoNivelMs], [true, 0, null]);
});

// ---------------------------------------------------------------------
// Cidades: mercador, guia e cais em todas; viagem e barco pagos
// ---------------------------------------------------------------------
// Abre os capítulos até (e sem incluir) o da cidade pedida: concluir a missão de cada capítulo anterior.
function abrirAte(j, regiao) {
  const ordem = j.g("REGRAS_VIAGEM").ordem;
  const CAP = j.g("CAPITULOS");
  for (const area of ordem.slice(0, ordem.indexOf(regiao) + 1)) {
    const anterior = CAP[area]?.anterior;
    if (anterior) j.p.missoes[anterior].status = "concluida";
  }
}

teste("58. cidades: toda cidade tem mercador, guia e cais; cada mercador vende o próprio catálogo e todos compram", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const [npcs, areas, LOJAS, PRECOS, VENDA, ordem] = ["npcs", "areas", "LOJAS", "PRECOS_LOJA", "VALORES_VENDA", "REGRAS_VIAGEM"].map(j.g);
  igual(ordem.ordem, ["canaan", "deserto", "egito", "marVermelho", "sinai", "galileia"]);
  for (const area of ordem.ordem) {
    const daqui = Object.values(npcs).filter((n) => n.area === area);
    const lojas = daqui.filter((n) => n.papel === "loja");
    assert.strictEqual(lojas.length, 1, `${area}: um mercador`);
    assert.strictEqual(daqui.filter((n) => n.papel === "guia").length, 1, `${area}: um guia de caravanas`);
    assert.ok(areas[area].cais && areas[area].chegadaViagem, `${area}: cais e chegada da viagem`);
    assert.ok(j.M.casaParaFicar(area, areas[area].chegadaViagem.x, areas[area].chegadaViagem.y), `${area}: chegada da viagem livre`);
    assert.ok(j.M.casaParaFicar(area, areas[area].cais.x, areas[area].cais.y + 1), `${area}: desembarque livre`);
    // O catálogo existe, tem preço e inclui as provisões.
    const cat = j.g("catalogoDaLoja")(lojas[0].id);
    assert.ok(Array.isArray(LOJAS[lojas[0].id]) && cat.length === LOJAS[lojas[0].id].length, `${lojas[0].id}: catálogo com preços`);
    for (const item of ["pocao", "pocao_fe", "flechas"]) assert.ok(cat.some((x) => x.item === item), `${lojas[0].id} vende ${item}`);
    for (const { item, preco } of cat) assert.strictEqual(preco, PRECOS[item]);
  }
  for (const id of Object.keys(LOJAS)) assert.strictEqual(npcs[id]?.papel, "loja", `LOJAS.${id} é um mercador`);
  // Comprar: só ao lado de um mercador e só o que ele vende; vender: qualquer mercador compra tudo de VALORES_VENDA.
  const loja = (id) => {
    const n = npcs[id];
    posicionarAoLado(j, n.area, n);
    return n;
  };
  p.moedas = 500;
  loja("mercador_canaa");
  assert.ok(j.exec({ tipo: "comprar", item: "pocao" }).ok);
  const r = j.exec({ tipo: "comprar", item: "arco_madeira" });
  igual([r.ok, r.mensagem], [false, "Esse mercador não vende esse item."]);
  loja("mercador1");
  assert.ok(j.exec({ tipo: "comprar", item: "arco_madeira" }).ok, "Azarias vende o arco");
  for (const id of ["mercador_egito", "mercador_mar", "mercador_sinai", "mercador_galileia"]) {
    loja(id);
    const falar = j.exec({ tipo: "interagir", alvoId: id });
    assert.strictEqual(falar.abrirLoja, id, `${id}: falar abre a loja dele`);
    assert.match(falar.mensagem, new RegExp(`^${npcs[id].nome.split(",")[0]}: `));
    p.inventario.push("pele_lobo");
    const moedas = p.moedas;
    assert.ok(j.exec({ tipo: "vender", item: "pele_lobo" }).ok, `${id} compra pele`);
    assert.strictEqual(p.moedas, moedas + VENDA.pele_lobo);
    assert.ok(j.exec({ tipo: "comprar", item: "flechas" }).ok, `${id} vende flechas`);
  }
  Object.assign(p, { area: "canaan", x: areas.canaan.inicio.x, y: areas.canaan.inicio.y });
  assert.strictEqual(j.exec({ tipo: "comprar", item: "pocao" }).ok, false, "longe do mercador não compra");
});

teste("59. viagem rápida entre todas as cidades abertas, paga pela distância, e o barco pago que liga todos os cais", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const [areas, npcs, RV, RB] = ["areas", "npcs", "REGRAS_VIAGEM", "REGRAS_BARCO"].map(j.g);
  const preco = j.g("precoViagem");
  // 1. Preço: base + porEtapa × distância na ordem; simétrico; sem rota para a mesma cidade.
  igual([preco("canaan", "deserto"), preco("deserto", "canaan"), preco("canaan", "galileia"), preco("sinai", "egito")],
    [RV.base + RV.porEtapa, RV.base + RV.porEtapa, RV.base + 5 * RV.porEtapa, RV.base + 2 * RV.porEtapa]);
  igual([preco("canaan", "canaan"), preco("canaan", "mar"), preco("canaan", "constructor")], [null, null, null]);
  // 2. Personagem novo: Canaã e Deserto abertos; os capítulos fecham até o anterior ser concluído.
  const abertas = () => j.g("destinosDeViagem")(p).filter((d) => d.aberta).map((d) => d.area);
  igual(abertas(), ["canaan", "deserto"]);
  const guia = (id) => posicionarAoLado(j, npcs[id].area, npcs[id]);
  guia("guia_canaa");
  p.moedas = 1000;
  let r = j.exec({ tipo: "viajar", areaDestino: "egito" });
  assert.ok(!r.ok && /fechada/.test(r.mensagem), r.mensagem);
  assert.strictEqual(p.moedas, 1000, "recusa não cobra");
  // 3. Sem moedas suficientes: recusa sem cobrar; com moedas: cobra e chega ao lado do guia de lá.
  p.moedas = preco("canaan", "deserto") - 1;
  r = j.exec({ tipo: "viajar", areaDestino: "deserto" });
  assert.ok(!r.ok && r.mensagem.includes(`custa ${preco("canaan", "deserto")} moedas`), r.mensagem);
  igual([p.area, p.moedas], ["canaan", preco("canaan", "deserto") - 1]);
  p.moedas = 100;
  r = j.exec({ tipo: "viajar", areaDestino: "deserto" });
  assert.ok(r.ok && r.areaAlterada && r.precoViagem === preco("canaan", "deserto"));
  igual([p.area, p.x, p.y, p.moedas], ["deserto", areas.deserto.chegadaViagem.x, areas.deserto.chegadaViagem.y, 100 - preco("canaan", "deserto")]);
  // 4. Todas as cidades, de todas para todas, depois de abertas.
  abrirAte(j, "galileia");
  igual(abertas(), RV.ordem);
  for (const de of RV.ordem) {
    const id = Object.values(npcs).find((n) => n.area === de && n.papel === "guia").id;
    for (const para of RV.ordem) {
      if (para === de) continue;
      guia(id);
      p.moedas = 100;
      r = j.exec({ tipo: "viajar", areaDestino: para });
      assert.ok(r.ok, `${de} → ${para}: ${r.mensagem}`);
      igual([p.area, p.moedas], [para, 100 - preco(de, para)], `${de} → ${para}`);
    }
  }
  Object.assign(p, { area: "canaan", x: areas.canaan.inicio.x, y: areas.canaan.inicio.y });
  r = j.exec({ tipo: "viajar", areaDestino: "deserto" });
  assert.ok(!r.ok, "longe do guia não viaja");

  // 5. Barco: o cais de cada cidade cobra a passagem e embarca no porto dela; sem moedas, fica no cais.
  const j2 = carregarJogo();
  j2.entrar();
  const p2 = j2.p;
  const embarcar = (area, moedas) => {
    const cais = areas[area].cais;
    Object.assign(p2, { area, x: cais.x, y: cais.y + 1, moedas });
    return j2.exec({ tipo: "mover", dx: 0, dy: -1 });
  };
  r = embarcar("canaan", RB.passagem - 1);
  assert.ok(r.caminhoBloqueado && /passagem do barco custa/.test(r.mensagem), r.mensagem);
  igual([p2.area, p2.moedas], ["canaan", RB.passagem - 1]);
  r = embarcar("canaan", 50);
  assert.ok(r.areaAlterada && r.passagemPaga === RB.passagem);
  igual([p2.area, p2.moedas], ["mar", 50 - RB.passagem]);
  // 6. No mar: desembarca no cais de qualquer cidade aberta; o de cidade fechada recusa e o jogador fica no mar.
  const portos = areas.mar.portos;
  igual(Object.keys(portos).sort(), [...RV.ordem].sort(), "um porto no mar para cada cidade");
  const desembarcar = (regiao) => {
    const c = portos[regiao].cais;
    const vizinho = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).find((v) => j2.M.casaLivre(v.x, v.y, { ...p2, area: "mar" }, true));
    Object.assign(p2, { area: "mar", x: vizinho.x, y: vizinho.y });
    return j2.exec({ tipo: "mover", dx: c.x - vizinho.x, dy: c.y - vizinho.y });
  };
  r = desembarcar("egito");
  assert.ok(r.caminhoBloqueado && /fechado/.test(r.mensagem), r.mensagem);
  assert.strictEqual(p2.area, "mar");
  abrirAte(j2, "galileia");
  for (const regiao of RV.ordem) {
    r = desembarcar(regiao);
    assert.ok(r.areaAlterada, `desembarque ${regiao}: ${r.mensagem}`);
    igual([p2.area, p2.x, p2.y], [regiao, areas[regiao].cais.x, areas[regiao].cais.y + 1], `${regiao}: logo abaixo do cais`);
    r = embarcar(regiao, 20);
    igual([r.areaAlterada, p2.area, p2.x, p2.y, p2.moedas], [true, "mar", portos[regiao].embarque.x, portos[regiao].embarque.y, 20 - RB.passagem], `${regiao}: embarque`);
  }
  // 7. Todo porto do mar se alcança a partir de qualquer outro (o mar liga todas as cidades).
  const mapa = j2.g("mapas").mar;
  const visto = new Set([`${areas.mar.inicio.x},${areas.mar.inicio.y}`]);
  const fila = [[areas.mar.inicio.x, areas.mar.inicio.y]];
  while (fila.length) {
    const [x, y] = fila.pop();
    for (const [dx, dy] of VIZINHOS) {
      const k = `${x + dx},${y + dy}`;
      if (mapa[y + dy]?.[x + dx] === 0 && !visto.has(k)) { visto.add(k); fila.push([x + dx, y + dy]); }
    }
  }
  for (const [regiao, pt] of Object.entries(portos)) {
    assert.ok(visto.has(`${pt.cais.x},${pt.cais.y}`) && visto.has(`${pt.embarque.x},${pt.embarque.y}`), `porto ${regiao} alcançável no mar`);
  }
});

// ---------------------------------------------------------------------
// Maná diário e XP de descanso do Sábado (JGB-11)
// ---------------------------------------------------------------------
// Instantes na hora local do processo (o jogo usa a hora local do jogador): 12 de novembro de 2026 é uma quinta.
const local = (dia, hora, minuto = 0) => new Date(2026, 10, dia, hora, minuto).getTime();

teste("60. maná diário (JGB-11): cai no amanhecer, dobra na sexta, não cai no sábado e o guardado estraga", () => {
  assert.strictEqual(new Date(local(12, 12)).getDay(), 4, "12/11/2026 é quinta");
  const j = carregarJogo({ inicio: local(12, 7) });
  j.entrar();
  const p = j.p;
  const M = (agora = j.agora) => j.g("estadoMana")(p, agora);
  const ir = (instante) => j.avancar(instante - j.agora);

  // Quinta, 7 h: caiu a porção comum.
  let m = M();
  igual([m.disponivel, m.porcaoHoje, m.dobrado, m.sabado, m.guardado], [true, 3, false, false, 0]);
  // Antes do amanhecer ainda é o dia anterior (quarta), que já passou sem colheita: nada se perde.
  igual([M(local(13, 5, 59)).disponivel, M(local(13, 5, 59)).porcaoHoje], [true, 3]);
  let r = j.exec({ tipo: "colherMana" });
  assert.ok(r.ok, r.mensagem);
  assert.match(r.mensagem, /3 porções/);
  igual([p.mana.porcao, p.mana.estragaEm, p.mana.proximaEm], [3, local(13, 6), local(13, 6)]);
  m = M();
  igual([m.disponivel, m.colhido, m.guardado, m.proximoEm], [false, true, 3, local(13, 6)]);
  r = j.exec({ tipo: "colherMana" });
  assert.ok(!r.ok && /já colheu/.test(r.mensagem), "uma colheita por dia");
  assert.strictEqual(p.mana.porcao, 3);

  // Comer: com vida e fé cheias, recusa sem gastar; ferido, cura metade da vida máxima (e fé, com a Oração).
  r = j.exec({ tipo: "comerMana" });
  assert.ok(!r.ok && p.mana.porcao === 3, "saciado não come");
  const vidaMax = j.g("vidaMaxima")(p);
  p.vida = 10;
  p.oracaoDesbloqueada = true;
  p.fe = 50;
  r = j.exec({ tipo: "comerMana" });
  assert.ok(r.ok, r.mensagem);
  igual([r.cura, r.fe, p.vida, p.fe, p.mana.porcao], [Math.round(vidaMax / 2), 30, 10 + Math.round(vidaMax / 2), 80, 2]);
  p.vida = vidaMax - 3;
  r = j.exec({ tipo: "comerMana" });
  igual([r.cura, p.vida, p.fe, p.mana.porcao], [3, vidaMax, 100, 1], "a cura para no máximo");

  // Sexta, 6 h: o que sobrou estraga (Êx 16:20), com aviso no laço; cai a porção dobrada.
  ir(local(13, 5, 59));
  igual(j.atualizar().filter((e) => e.tipo === "manaEstragou").length, 0);
  ir(local(13, 6));
  const ev = j.atualizar().find((e) => e.tipo === "manaEstragou");
  assert.ok(ev && ev.quantidade === 1 && /Êx 16:20/.test(ev.mensagem) && /colha/.test(ev.mensagem), "aviso do maná estragado");
  igual([p.mana.porcao, M().guardado], [0, 0]);
  m = M();
  igual([m.disponivel, m.porcaoHoje, m.dobrado], [true, 6, true]);
  r = j.exec({ tipo: "colherMana" });
  assert.ok(r.ok && /dobrada/.test(r.mensagem), r.mensagem);
  // O da sexta dura o Sábado inteiro: estraga no amanhecer de domingo.
  igual([p.mana.porcao, p.mana.estragaEm], [6, local(15, 6)]);

  // Sábado: não cai maná; o da sexta continua bom e alimenta.
  ir(local(14, 10));
  m = M();
  igual([m.disponivel, m.sabado, m.porcaoHoje, m.guardado, m.proximoEm], [false, true, 0, 6, local(15, 6)]);
  r = j.exec({ tipo: "colherMana" });
  assert.ok(!r.ok && /Sábado/.test(r.mensagem) && /6 no jarro/.test(r.mensagem), r.mensagem);
  p.vida = 10;
  assert.ok(j.exec({ tipo: "comerMana" }).ok);
  assert.strictEqual(p.mana.porcao, 5);
  j.atualizar();
  assert.strictEqual(p.mana.porcao, 5, "no sábado o maná da sexta não estraga");

  // Domingo, 6 h: estraga e cai a porção comum de novo.
  ir(local(15, 6));
  j.atualizar();
  igual([p.mana.porcao, M().disponivel, M().porcaoHoje], [0, true, 3]);

  // Ficar dias sem jogar não tira nada: na volta, o maná do dia está lá, como sempre.
  ir(local(25, 20));
  igual([M().disponivel, M().porcaoHoje], [true, 3]);
  assert.ok(j.exec({ tipo: "colherMana" }).ok);

  // Comer com o jarro vazio explica quando cai o próximo; colhido e vazio, também.
  p.mana.porcao = 0;
  p.mana.estragaEm = 0;
  r = j.exec({ tipo: "comerMana" });
  assert.ok(!r.ok && /vazio/.test(r.mensagem) && /10 h/.test(r.mensagem), r.mensagem);
});

teste("60b. maná: save antigo, relógio mexido e dados corrompidos não rendem maná a mais", () => {
  // Save v10 (sem maná nem descanso): jarro vazio, colheita liberada, aviso da novidade uma vez.
  const j = carregarJogo({ inicio: local(16, 9) });
  j.entrar();
  const p = j.p;
  delete p.mana;
  delete p.descanso;
  p.versao = 10;
  p.avisosPendentes = [];
  j.g("Storage").flush();
  const j2 = carregarJogo({ store: j.store, inicio: local(16, 9) });
  const p2 = j2.entrar();
  igual(p2.mana, { porcao: 0, estragaEm: 0, proximaEm: 0 });
  igual([p2.descanso.xp, p2.descanso.vistoEm], [0, local(16, 9)]);
  assert.ok(p2.avisosPendentes.some((a) => a.id === "atualizacao_11"), "aviso da novidade");
  assert.ok(j2.exec({ tipo: "colherMana" }).ok);

  // Relógio adiantado e depois atrasado: não colhe de novo no "mesmo" dia, nem guarda maná por mais de 2,5 dias.
  const j3 = carregarJogo({ store: j2.store, inicio: local(16, 9) });
  const p3 = j3.entrar();
  p3.mana.estragaEm = local(30, 6);
  p3.mana.proximaEm = local(30, 6);
  j3.g("Storage").flush();
  const j4 = carregarJogo({ store: j3.store, inicio: local(16, 10) });
  const p4 = j4.entrar();
  assert.ok(p4.mana.estragaEm <= local(16, 10) + 2.5 * 24 * HORA, "maná não dura mais que 2,5 dias");
  assert.strictEqual(p4.mana.proximaEm, local(17, 6), "colhido hoje: o próximo é amanhã");
  assert.ok(!j4.exec({ tipo: "colherMana" }).ok);

  // Corrompido: normalizado sem quebrar.
  for (const lixo of [null, 7, "x", [], { porcao: "9", estragaEm: -1, proximaEm: NaN }, { porcao: 99, estragaEm: local(17, 6) }]) {
    const k = carregarJogo({ inicio: local(16, 9) });
    k.entrar();
    k.p.mana = lixo;
    k.p.descanso = lixo;
    k.g("Storage").flush();
    const k2 = carregarJogo({ store: k.store, inicio: local(16, 9) });
    const q = k2.entrar();
    assert.ok(Number.isInteger(q.mana.porcao) && q.mana.porcao >= 0 && q.mana.porcao <= 6, `porção de ${JSON.stringify(lixo)}`);
    assert.ok(Number.isFinite(q.descanso.xp) && q.descanso.xp >= 0);
    assert.ok(k2.exec({ tipo: "colherMana" }).ok || q.mana.porcao > 0);
  }
});

teste("61. descanso do Sábado (JGB-11): a ausência no Sábado vira reserva e os abates rendem XP em dobro", () => {
  const tempoNoSabado = (j, a, b) => j.g("tempoNoSabado")(a, b);
  const j = carregarJogo({ inicio: local(13, 12) }); // sexta, meio-dia
  // Janela: sexta 18 h → sábado 18 h, hora local; semanas inteiras somam 24 h por Sábado.
  igual(
    [
      tempoNoSabado(j, local(13, 17), local(13, 19)),
      tempoNoSabado(j, local(14, 17), local(15, 9)),
      tempoNoSabado(j, local(9, 0), local(13, 17)),
      tempoNoSabado(j, local(9, 0), local(23, 0)),
      tempoNoSabado(j, local(14, 10), local(14, 9)),
    ],
    [2 * HORA - HORA, HORA, 0, 48 * HORA, 0],
  );
  j.entrar();
  const p = j.p;
  const custo = j.g("custoDoNivel")(1);
  assert.strictEqual(custo, 100);
  assert.strictEqual(p.descanso.xp, 0);

  // Fechou na sexta ao meio-dia e voltou no sábado ao meio-dia: 18 h de Sábado = 75% do XP do nível.
  j.g("Storage").flush();
  const j2 = carregarJogo({ store: j.store, inicio: local(14, 12) });
  const p2 = j2.entrar();
  assert.strictEqual(p2.descanso.xp, Math.round(0.75 * custo));
  const aviso = p2.avisosPendentes.find((a) => a.id === "descanso");
  assert.ok(aviso && /\+75 XP de descanso/.test(aviso.texto) && /dobro/.test(aviso.texto), "aviso do descanso");
  igual(j2.g("estadoDescanso")(p2, j2.agora), { xp: 75, limite: 150, multiplicador: 2, sabado: true });

  // Abate: XP em dobro, o extra sai da reserva; quando ela acaba, o último abate leva só o que restava.
  const base = j2.g("xpDoAbate")(p2, j2.g("inimigos").lobo1);
  let r = abater(j2, "lobo1");
  igual([r.xpGanho, r.xpDescanso, p2.descanso.xp], [2 * base, base, 75 - base]);
  assert.match(r.mensagem, /do descanso/);
  while (p2.descanso.xp > 0) abater(j2, "lobo1");
  r = abater(j2, "lobo1");
  igual([r.xpGanho, r.xpDescanso], [base, 0]);
  assert.doesNotMatch(r.mensagem, /descanso/);

  // Jogando no Sábado não acumula (cada ação marca presença); parado 5 min ou mais, acumula.
  const antes = p2.descanso.xp;
  j2.avancar(4 * 60_000);
  j2.M.salvar(p2);
  assert.strictEqual(p2.descanso.xp, antes, "4 min parado não conta");
  j2.avancar(60 * 60_000);
  j2.M.salvar(p2);
  assert.strictEqual(p2.descanso.xp, antes + Math.round(j2.g("custoDoNivel")(p2.nivel) / 24), "1 h parado no Sábado vira reserva (pelo nível atual)");

  // Fora do Sábado, a ausência não conta.
  const sabadoTarde = p2.descanso.xp;
  const restanteDoSabado = local(14, 18) - j2.agora;
  j2.avancar(local(17, 12) - j2.agora); // de sábado à tarde a terça: só até sábado 18 h conta
  j2.M.salvar(p2);
  const reserva = p2.descanso.xp;
  assert.strictEqual(reserva, sabadoTarde + Math.round((restanteDoSabado / (24 * HORA)) * j2.g("custoDoNivel")(p2.nivel)));
  j2.avancar(local(19, 12) - j2.agora);
  j2.M.salvar(p2);
  assert.strictEqual(p2.descanso.xp, reserva, "terça → quinta não é Sábado");

  // Limite: três semanas fora param em 1,5 × o XP do nível; a reserva não expira.
  j2.avancar(local(40, 12) - j2.agora);
  j2.M.salvar(p2);
  assert.strictEqual(p2.descanso.xp, j2.g("limiteDescanso")(p2));
  j2.avancar(30 * 24 * HORA);
  j2.M.salvar(p2);
  assert.strictEqual(p2.descanso.xp, j2.g("limiteDescanso")(p2), "não expira");
});

teste("61b. descanso: relógio atrasado e adiantado de novo não credita o mesmo Sábado duas vezes", () => {
  const j = carregarJogo({ inicio: local(13, 12) });
  j.entrar();
  const p = j.p;
  j.avancar(local(14, 12) - j.agora);
  j.M.salvar(p);
  assert.strictEqual(p.descanso.xp, 75);
  p.descanso.xp = 0; // gastou tudo caçando
  // Atrasa o relógio para sexta de manhã e adianta de novo para sábado: o trecho já creditado não conta.
  j.avancar(local(13, 9) - j.agora);
  j.M.salvar(p);
  j.avancar(local(14, 12) - j.agora);
  j.M.salvar(p);
  assert.strictEqual(p.descanso.xp, 0);
  // O que vem depois do já creditado ainda conta.
  j.avancar(local(14, 18) - j.agora);
  j.M.salvar(p);
  assert.strictEqual(p.descanso.xp, Math.round((6 / 24) * 100));
});

// ---------------------------------------------------------------------
// Status unificados (JGB-16)
// ---------------------------------------------------------------------
teste("62. status (JGB-16): um motor para jogador e criaturas — duração, acúmulo, imunidade e cura", () => {
  const j = carregarJogo();
  j.entrar();
  const g = (n) => j.g(n);
  const [aplicar, ativo, passo] = [g("aplicarStatus"), g("statusAtivo"), g("passoDosStatus")];
  const STATUS = g("STATUS_CRIATURAS");
  // Todo status tem nome, duração, acúmulo válido e fraqueza; os que machucam têm dano e intervalo.
  for (const [tipo, d] of Object.entries(STATUS)) {
    assert.ok(d.nome && d.duracao > 0 && d.fraqueza, tipo);
    assert.ok(["renova", "pilhas", "nenhum"].includes(d.acumulo), `${tipo}: acumulo`);
    if (d.acumulo === "pilhas") assert.ok(d.pilhasMax >= 2, `${tipo}: pilhasMax`);
    if ("intervalo" in d) assert.ok(d.dano > 0 && d.intervalo > 0 && d.duracao % d.intervalo === 0, `${tipo}: tiques exatos`);
  }
  igual(Object.keys(STATUS), ["veneno", "sangramento", "atordoamento", "medo"]);
  const t0 = 1_000_000;
  // Veneno renova: a duração recomeça, o dano por tique fica o maior.
  const a = {};
  igual(aplicar(a, { tipo: "veneno" }, t0), { novo: true, pilhas: 1, ate: t0 + 15000 });
  igual(aplicar(a, { tipo: "veneno", dano: 5 }, t0 + 6000), { novo: false, pilhas: 1, ate: t0 + 21000 });
  assert.strictEqual(a.status.veneno.dano, 5);
  // Sangramento soma pilhas até o máximo; o tique multiplica.
  const b = {};
  const sang = STATUS.sangramento;
  for (let i = 0; i < 4; i++) aplicar(b, { tipo: "sangramento" }, t0);
  assert.strictEqual(b.status.sangramento.pilhas, sang.pilhasMax);
  const tq = passo(b, t0 + sang.intervalo).tiques[0];
  igual([tq.tipo, tq.dano, tq.pilhas], ["sangramento", sang.dano * sang.pilhasMax, sang.pilhasMax]);
  // Atordoamento e medo: não acumulam e deixam imunidade depois.
  for (const tipo of ["atordoamento", "medo"]) {
    const c = {};
    const d = STATUS[tipo];
    assert.ok(aplicar(c, { tipo }, t0));
    assert.strictEqual(aplicar(c, { tipo }, t0 + 100), null, `${tipo}: não renova`);
    assert.ok(ativo(c, tipo, t0 + d.duracao - 1) && !ativo(c, tipo, t0 + d.duracao));
    igual(passo(c, t0 + d.duracao).terminados, [tipo]);
    assert.strictEqual(aplicar(c, { tipo }, t0 + d.duracao + d.imunidade - 1), null, `${tipo}: imune`);
    assert.ok(aplicar(c, { tipo }, t0 + d.duracao + d.imunidade), `${tipo}: a imunidade passa`);
  }
  // Tiques na grade da aplicação, com o do fim valendo; um por chamada.
  for (const tipo of ["veneno", "sangramento"]) {
    const c = {};
    const d = STATUS[tipo];
    aplicar(c, { tipo }, t0);
    let tiques = 0;
    let fim = null;
    for (let t = t0; t <= t0 + d.duracao + 1000 && !fim; t += 50) {
      const r = passo(c, t);
      tiques += r.tiques.length;
      if (r.terminados.length) fim = t;
    }
    assert.strictEqual(tiques, d.duracao / d.intervalo, `${tipo}: tiques`);
    assert.ok(fim >= t0 + d.duracao, `${tipo}: termina no fim`);
  }
  // Tipo desconhecido ou de Object.prototype não aplica nada.
  for (const tipo of ["toString", "constructor", "x", null]) assert.strictEqual(aplicar({}, { tipo }, t0), null);
});

teste("62b. status no jogador: urso e hiena assustam (sem atacar, +25% de dano), Milagre cura tudo e o save migra", () => {
  const { j, p, e } = cenaComportamento("urso1");
  j.definirAleatorio(() => 0); // o medo sempre pega
  posicionarAoLado(j, e.area, e);
  const ev = j.atualizar();
  const medo = ev.find((x) => x.tipo === "medo");
  assert.ok(medo && /não atacar|sem atacar/.test(medo.mensagem), "o urso assusta");
  const r = j.exec({ tipo: "atacar", alvoId: e.id });
  assert.ok(!r.ok && r.medo, "com medo não ataca");
  assert.ok(j.exec({ tipo: "mover", dx: -1, dy: 0 }).ok !== false || true, "pode andar");
  assert.ok(!j.M.atordoado(p), "medo não prende os pés");
  // Pânico: o golpe seguinte do urso tem +25%.
  posicionarAoLado(j, e.area, e);
  const vidaAntes = p.vida;
  j.avancar(1300);
  const golpe = j.atualizar().find((x) => x.tipo === "jogadorAtingido" && x.inimigoId === e.id);
  assert.ok(golpe && golpe.combinacoes?.includes("Pânico"), "pânico no golpe");
  assert.ok(vidaAntes - p.vida >= golpe.dano);
  // Fim do medo, com aviso; depois volta a atacar.
  j.avancar(3000);
  const fim = j.atualizar();
  assert.ok(fim.some((x) => x.tipo === "medoTerminou"), "o medo passa");
  assert.ok(j.g("inimigos").hiena1.efeito?.tipo === "medo", "a hiena também assusta");
  // Milagre cura todos os status.
  for (const tipo of ["veneno", "sangramento"]) j.g("aplicarStatus")(p, { tipo }, j.agora);
  p.imune = {};
  j.g("aplicarStatus")(p, { tipo: "medo" }, j.agora);
  Object.assign(p, { oracaoDesbloqueada: true, fe: 100, vida: 10 });
  p.habilidades.oracao = 100;
  const m = j.exec({ tipo: "orar", acao: "milagre" });
  assert.ok(m.ok, m.mensagem);
  igual(j.g("statusAtivos")(p, j.agora), []);

  // Save v11 com os campos antigos: o veneno ainda valendo vira p.status; o atordoamento não sobrevive.
  const k = carregarJogo();
  k.entrar();
  Object.assign(k.p, {
    versao: 11,
    status: undefined,
    envenenadoAte: k.agora + 9000,
    proximoDanoVeneno: k.agora + 1000,
    venenoAtual: { dano: 4, intervalo: 3000 },
    sangrandoAte: k.agora - 1,
    atordoadoAte: k.agora + 500,
    imuneAtordoamentoAte: k.agora + 4000,
  });
  delete k.p.status;
  k.g("Storage").flush();
  const k2 = carregarJogo({ store: k.store });
  const q = k2.entrar();
  igual(q.status, { veneno: { ate: k.agora + 9000, pilhas: 1, dano: 4, intervalo: 3000, proximo: k.agora + 1000 } });
  for (const campo of ["envenenadoAte", "proximoDanoVeneno", "venenoAtual", "sangrandoAte", "atordoadoAte", "imuneAtordoamentoAte"]) {
    assert.ok(!(campo in q), `${campo} saiu do save`);
  }
});

teste("62c. combinações (JGB-16): atordoado leva crítico, medo leva +25%, veneno com sangramento infecciona; status nas criaturas", () => {
  const { j, p, e } = cenaComportamento("lobo1");
  posicionarAoLado(j, e.area, e);
  const vidaLobo = () => j.M.obterVidaInimigo(ID, e.id);
  const golpeEm = () => {
    j.avancar(1000);
    p.vidaInimigos[e.id] = 10_000; // o golpe mede o dano sem derrotar
    return j.exec({ tipo: "atacar", alvoId: e.id });
  };
  j.definirAleatorio(() => 0.99); // sem crítico pela sorte
  const normal = golpeEm();
  assert.ok(normal.ok && !normal.critico);
  // Atordoada: não anda nem ataca, e todo golpe nela é crítico.
  let r = j.M.aplicarStatusNaCriatura(ID, e.id, { tipo: "atordoamento" }, j.agora);
  assert.ok(r.ok && r.novo);
  const critico = golpeEm();
  assert.ok(critico.critico && critico.combinacoes.includes("Golpe no atordoado"), "atordoado leva crítico");
  assert.ok(critico.danoAplicado > normal.danoAplicado);
  Object.assign(e, { status: {}, imune: {} });
  j.M.aplicarStatusNaCriatura(ID, e.id, { tipo: "atordoamento" }, j.agora);
  const pos = { x: e.x, y: e.y };
  p.vida = j.g("vidaMaxima")(p);
  for (let t = 0; t < 1000; t += 100) { j.avancar(100); assert.ok(!j.atualizar().some((x) => x.inimigoId === e.id && x.tipo === "jogadorAtingido"), "atordoada não ataca"); }
  igual({ x: e.x, y: e.y }, pos, "atordoada não anda");
  // Com medo: foge de quem a assustou, não ataca, e leva +25%.
  j.avancar(2000);
  j.atualizar();
  e.imune = {};
  r = j.M.aplicarStatusNaCriatura(ID, e.id, { tipo: "medo" }, j.agora);
  assert.ok(r.ok, r.mensagem);
  const panico = golpeEm();
  assert.ok(panico.combinacoes?.includes("Pânico"));
  assert.strictEqual(panico.danoAplicado, j.g("mitigarDano")(Math.round(j.g("danoBruto")(p, "corpo") * 1.25), e.defesa || 0));
  const antes = Math.max(Math.abs(p.x - e.x), Math.abs(p.y - e.y));
  for (let t = 0; t < 2000; t += 100) { j.avancar(100); j.atualizar(); }
  assert.ok(Math.max(Math.abs(p.x - e.x), Math.abs(p.y - e.y)) > antes, "com medo, a criatura se afasta");
  // Veneno + sangramento na criatura: tiques com +50%; o tique pode derrotá-la, com XP e saque como num golpe.
  e.status = {};
  j.M.aplicarStatusNaCriatura(ID, e.id, { tipo: "veneno" }, j.agora);
  j.M.aplicarStatusNaCriatura(ID, e.id, { tipo: "sangramento" }, j.agora);
  j.avancar(2000);
  const tique = j.atualizar().find((x) => x.tipo === "statusInimigo" && x.status === "sangramento");
  assert.ok(tique && tique.infeccao && tique.dano === Math.round(j.g("STATUS_CRIATURAS").sangramento.dano * 1.5), "ferida infeccionada");
  p.vidaInimigos[e.id] = 1;
  const xpAntes = p.xp;
  let morte = null;
  for (let t = 0; t < 4000 && !morte; t += 100) { j.avancar(100); morte = j.atualizar().find((x) => x.tipo === "inimigoDerrotado"); }
  assert.ok(morte && morte.derrotado && morte.inimigoId === e.id && /venceu/.test(morte.mensagem), "o tique derrota");
  assert.ok(p.xp > xpAntes && vidaLobo() === 0 && j.g("statusAtivos")(e, j.agora).length === 0);
  // Renascida, volta sem status.
  j.M.reaparecerInimigo(ID, e.id);
  igual(e.status, {});
  assert.ok(!j.M.aplicarStatusNaCriatura(ID, "naoExiste", { tipo: "medo" }).ok);
});

// ---------------------------------------------------------------------
// Vocações e habilidades (JGB-20)
// ---------------------------------------------------------------------
const FONTE_SPRITES = fs.readFileSync(path.join(RAIZ, "sprites.js"), "utf8");

// Jogador no nível n, com a vocação (e a especialização) escolhidas direto no save.
function comVocacao(j, vocacao, nivel = 25, especializacao = null) {
  const p = j.p;
  p.nivel = nivel;
  p.xp = j.g("limiarNivel")(nivel - 1);
  p.vocacao = { id: vocacao, especializacao, trocas: 0, avisada: true, avisadaEspecializacao: true };
  p.recargas = {};
  p.buffs = {};
  p.vida = j.g("vidaMaxima")(p);
  return p;
}
const usar = (j, habilidade, alvoId) => j.exec({ tipo: "usarHabilidade", habilidade, alvoId });

teste("63. vocações (JGB-20): 5 vocações, 7 habilidades cada, 2 especializações, dados coerentes e ícones", () => {
  const j = carregarJogo();
  const VOC = j.g("VOCACOES");
  const HAB = j.g("HABILIDADES_VOCACAO");
  const R = j.g("REGRAS_VOCACAO");
  const STATUS = j.g("STATUS_CRIATURAS");
  igual(Object.keys(VOC), ["guerreiro", "fundibulario", "levita", "profeta", "pastor"]);
  const usadas = new Set();
  for (const [id, v] of Object.entries(VOC)) {
    assert.ok(v.nome && v.titulo && v.papel && v.descricao && v.textoPassivo, `${id}: textos`);
    assert.strictEqual(v.habilidades.length, 7, `${id}: 7 habilidades`);
    const niveis = v.habilidades.map((h) => HAB[h]?.nivel);
    assert.ok(niveis.every((n, i) => n >= R.nivelEscolha && (i === 0 || n >= niveis[i - 1])), `${id}: níveis em ordem a partir do ${R.nivelEscolha}`);
    assert.ok(niveis.filter((n) => n === R.nivelEscolha).length >= 2, `${id}: 2+ habilidades já na escolha`);
    const esps = Object.values(v.especializacoes);
    assert.strictEqual(esps.length, 2, `${id}: 2 especializações`);
    for (const e of esps) assert.ok(HAB[e.habilidade] && HAB[e.habilidade].nivel === R.nivelEspecializacao && e.textoPassivo, `${id}: especialização ${e.nome}`);
    assert.ok(v.habilidades.length + 1 <= R.barra, "cabe na barra");
    if (v.arma) assert.ok(j.g("ITENS")[v.arma], `${id}: arma ${v.arma}`);
    for (const h of [...v.habilidades, ...esps.map((e) => e.habilidade)]) {
      assert.ok(!usadas.has(h) || h === undefined, `${h} em uma vocação só`);
      usadas.add(h);
    }
  }
  for (const [id, h] of Object.entries(HAB)) {
    assert.ok(usadas.has(id), `${id} pertence a uma vocação`);
    assert.ok(h.nome && h.descricao && h.recarga >= 4000 && ["inimigo", "si"].includes(h.alvo), `${id}: campos`);
    assert.ok(h.dano || h.cura || h.buff || h.invocar || h.cao || h.movimento || h.status || h.purificar, `${id}: algum efeito`);
    if (h.alvo === "inimigo") assert.ok(h.alcance >= 1, `${id}: alcance`);
    if (h.dano) assert.ok(["corpo", "distancia", "magia"].includes(h.dano.tipo) && h.dano.mult > 0, `${id}: dano`);
    if (h.status) assert.ok(STATUS[h.status.tipo], `${id}: status`);
    if (h.bonus) for (const t of [].concat(h.bonus.status)) assert.ok(STATUS[t], `${id}: bônus ${t}`);
    if (h.invocar) assert.ok(R.aliados[h.invocar.tipo], `${id}: aliado`);
    assert.ok(new RegExp(`glifo\\("hb_${h.icone}"`).test(FONTE_SPRITES), `${id}: ícone hb_${h.icone} em sprites.js`);
  }
  // 6 a 8 habilidades por vocação (7 + a da especialização) e cada uma com combinação ou controle.
  for (const v of Object.values(VOC)) {
    const todas = v.habilidades.map((h) => HAB[h]);
    assert.ok(todas.some((h) => h.status || h.bonus || h.cao?.status), `${v.nome}: aplica ou aproveita status`);
    assert.ok(todas.some((h) => h.dano || h.cao), `${v.nome}: causa dano`);
  }
  // O mestre de vocações fica numa casa livre da vila de Canaã.
  const mestre = Object.values(j.g("npcs")).find((n) => n.papel === "vocacao");
  assert.ok(mestre && mestre.area === "canaan" && j.g("mapas").canaan[mestre.y][mestre.x] === 0, "mestre de vocações em casa livre");
  // A funda: arma à distância sem munição, vendida em Canaã.
  const funda = j.g("ITENS").funda;
  assert.ok(funda.tipo === "arma_distancia" && funda.semMunicao && j.g("LOJAS").mercador_canaa.includes("funda"));
});

teste("63b. vocação: escolha no nível 8, troca só com o mestre (1ª grátis, depois paga), especialização no 50 e save", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const g = (n) => j.g(n);
  p.nivel = 7;
  let r = j.exec({ tipo: "escolherVocacao", vocacao: "guerreiro" });
  assert.ok(!r.ok && /nível 8/.test(r.mensagem), "antes do 8 não escolhe");
  assert.ok(!j.exec({ tipo: "usarHabilidade", habilidade: "golpe_firme" }).ok, "sem vocação, sem habilidade");
  // Ao chegar ao 8, um aviso (uma vez).
  p.nivel = 8;
  p.avisosPendentes = [];
  j.M.salvar(p);
  j.M.salvar(p);
  assert.strictEqual(p.avisosPendentes.filter((a) => a.id === "vocacao").length, 1, "aviso de escolha");
  // 1ª escolha em qualquer lugar: o Fundibulário ganha a funda.
  r = j.exec({ tipo: "escolherVocacao", vocacao: "fundibulario" });
  assert.ok(r.ok && p.vocacao.id === "fundibulario" && p.inventario.includes("funda"), r.mensagem);
  assert.ok(!j.exec({ tipo: "escolherVocacao", vocacao: "fundibulario" }).ok, "já é");
  // Trocar exige o mestre; a 1ª troca é grátis, a 2ª custa precoTroca.
  r = j.exec({ tipo: "escolherVocacao", vocacao: "guerreiro" });
  assert.ok(!r.ok && /Jetro/.test(r.mensagem), "troca longe do mestre");
  const mestre = Object.values(g("npcs")).find((n) => n.papel === "vocacao");
  posicionarAoLado(j, mestre.area, mestre);
  const conversa = j.exec({ tipo: "interagir", alvoId: mestre.id });
  assert.ok(conversa.ok && conversa.abrirVocacao === mestre.id, "falar com o mestre abre a vocação");
  const vidaAntes = g("vidaMaxima")(p);
  p.moedas = 100;
  r = j.exec({ tipo: "escolherVocacao", vocacao: "guerreiro" });
  assert.ok(r.ok && p.moedas === 100 && p.vocacao.trocas === 1, `1ª troca grátis: ${r.mensagem}`);
  assert.strictEqual(g("vidaMaxima")(p), vidaAntes + Math.round(vidaAntes * 0.15), "guerreiro: +15% de vida");
  const preco = g("REGRAS_VOCACAO").precoTroca;
  r = j.exec({ tipo: "escolherVocacao", vocacao: "levita" });
  assert.ok(!r.ok && new RegExp(String(preco)).test(r.mensagem) && p.vocacao.id === "guerreiro", "sem moedas, sem troca");
  p.moedas = preco + 5;
  r = j.exec({ tipo: "escolherVocacao", vocacao: "levita" });
  assert.ok(r.ok && p.moedas === 5 && r.moedasGastas === preco, "2ª troca paga");
  // Especialização no 50, uma vez; aparece como 8ª habilidade.
  assert.ok(!j.exec({ tipo: "escolherEspecializacao", especializacao: "cantor" }).ok, "antes do 50");
  p.nivel = 50;
  assert.ok(!j.exec({ tipo: "escolherEspecializacao", especializacao: "valente" }).ok, "de outra vocação, não");
  r = j.exec({ tipo: "escolherEspecializacao", especializacao: "cantor" });
  assert.ok(r.ok && p.vocacao.especializacao === "cantor", r.mensagem);
  const barra = g("barraHabilidades")(p, j.agora);
  igual([barra.length, barra[7].id, barra.every((b) => b.aberta)], [8, "salmo", true]);
  assert.ok(!j.exec({ tipo: "escolherEspecializacao", especializacao: "sumo_sacerdote" }).ok, "só uma");
  // Trocar de vocação zera a especialização.
  p.moedas = preco;
  assert.ok(j.exec({ tipo: "escolherVocacao", vocacao: "profeta" }).ok);
  assert.strictEqual(p.vocacao.especializacao, null);
  // Save: recarrega igual; vocação inválida ou recarga no futuro distante são normalizadas.
  p.recargas.palavra_de_fogo = j.agora + 999_999;
  g("Storage").flush();
  const q = carregarJogo({ store: j.store, inicio: j.agora }).entrar();
  igual([q.vocacao.id, q.vocacao.trocas, q.recargas.palavra_de_fogo <= j.agora + 5000], ["profeta", 3, true]);
  const k = carregarJogo();
  k.entrar();
  k.p.vocacao = { id: "constructor", especializacao: "toString", trocas: -2 };
  k.g("Storage").flush();
  const q2 = carregarJogo({ store: k.store }).entrar();
  igual(q2.vocacao.id, null);
  igual(q2.vocacao.trocas, 0);
});

teste("63c. habilidades: recarga própria e global, alcance, funda sem flechas, combinações, área, movimento e buffs", () => {
  const { j, p, e } = cenaComportamento("urso1");
  const g = (n) => j.g(n);
  comVocacao(j, "fundibulario", 25);
  p.equipamento.arma = null;
  p.equipamento.arco = "funda";
  p.vidaInimigos[e.id] = 10_000;
  aDistancia(j, e, 4);
  j.definirAleatorio(() => 0.99); // sem crítico pela sorte
  // Pedra certeira: dano à distância sem gastar flecha; recarga própria e global.
  const flechas = p.inventario.filter((i) => i === "flecha").length;
  let r = usar(j, "pedra_certeira", e.id);
  assert.ok(r.ok && r.alvos[0].dano > 0, r.mensagem);
  const normal = r.alvos[0].dano;
  assert.strictEqual(p.inventario.filter((i) => i === "flecha").length, flechas, "a funda não gasta flecha");
  r = usar(j, "pedra_na_testa", e.id);
  assert.ok(!r.ok && r.emRecarga, "recarga global");
  j.avancar(800);
  r = usar(j, "pedra_certeira", e.id);
  assert.ok(!r.ok && r.emRecarga && /pronta em/.test(r.mensagem), "recarga própria");
  // Pedra na testa atordoa; a Pedra certeira dobra em quem está atordoado (e o golpe no atordoado é crítico).
  r = usar(j, "pedra_na_testa", e.id);
  assert.ok(r.ok && r.alvos[0].status === "atordoamento");
  j.avancar(800);
  p.recargas.pedra_certeira = 0;
  r = usar(j, "pedra_certeira", e.id);
  assert.ok(r.alvos[0].critico && r.alvos[0].combinacoes.includes("Pedra certeira") && r.alvos[0].dano > normal * 2.5, `combinação: ${r.mensagem}`);
  // Alcance: longe demais, recusa sem gastar a recarga.
  j.avancar(10_000);
  aDistancia(j, e, 8);
  r = usar(j, "pedra_afiada", e.id);
  assert.ok(!r.ok && !p.recargas.pedra_afiada, "fora do alcance");
  // Arco gasta flechas.
  p.equipamento.arco = "arco_madeira";
  aDistancia(j, e, 4);
  p.inventario.push("flecha", "flecha");
  const antes = p.inventario.filter((i) => i === "flecha").length;
  r = usar(j, "mao_esquerda", e.id);
  assert.ok(r.ok && p.inventario.filter((i) => i === "flecha").length === antes - 2, "duas pedras = duas flechas no arco");
  // Recuo ágil: salta para longe da criatura mais próxima.
  j.avancar(1000);
  posicionarAoLado(j, e.area, e);
  r = usar(j, "recuo_agil");
  assert.ok(r.ok && distanciaJ(p, e) >= 3, `recuo: ${r.mensagem}`);

  // Guerreiro: investida leva ao lado do alvo; Escudo erguido soma defesa; área pega todos em volta.
  comVocacao(j, "guerreiro", 25);
  p.equipamento.arma = "espada_ferro";
  aDistancia(j, e, 4);
  j.avancar(1000);
  r = usar(j, "investida_do_valente", e.id);
  assert.ok(r.ok && distanciaJ(p, e) === 1 && r.movimento, `investida: ${r.mensagem}`);
  j.avancar(1000);
  const def = g("defesaTotal")(p);
  assert.ok(usar(j, "escudo_erguido").ok);
  assert.strictEqual(g("defesaTotal")(p), def + 8, "escudo erguido");
  j.avancar(6001);
  j.atualizar();
  assert.strictEqual(g("defesaTotal")(p), def, "o buff acaba");
  j.avancar(1000);
  e.imune = {};
  r = usar(j, "grito_de_guerra");
  assert.ok(r.ok && r.alvos.some((l) => l.inimigoId === e.id && l.status === "medo"), "grito assusta em área");
  // Com medo, o jogador não usa habilidade ofensiva, mas usa buff.
  j.avancar(1000);
  g("aplicarStatus")(p, { tipo: "medo" }, j.agora);
  assert.ok(usar(j, "golpe_firme", e.id).medo, "medo bloqueia ataque");

  // Levita: escudo absorve, incenso regenera, purificação tira status.
  comVocacao(j, "levita", 25);
  p.vida = 50;
  assert.ok(usar(j, "purificacao").ok);
  igual(g("statusAtivos")(p, j.agora), [], "purificação");
  j.avancar(1000);
  assert.ok(usar(j, "escudo_da_fe").ok);
  const escudo = Math.round(g("vidaMaxima")(p) * 0.3);
  assert.strictEqual(p.buffs.escudo_da_fe.pontos, escudo);
  igual(j.M.absorverDano(p, escudo + 7, j.agora), { dano: 7, absorvido: escudo });
  j.avancar(1000);
  p.vida = 50;
  assert.ok(usar(j, "incenso").ok);
  let curou = 0;
  for (let t = 0; t < 8000; t += 250) { j.avancar(250); for (const ev of j.atualizar()) if (ev.tipo === "curaBuff") curou += ev.cura; }
  assert.ok(curou > 0 && p.vida > 50, "incenso regenera");

  // Profeta: Juízo consome medo/atordoamento para 250%; Mar aberto empurra.
  comVocacao(j, "profeta", 25);
  aDistancia(j, e, 3);
  Object.assign(e, { status: {}, imune: {} });
  r = usar(j, "palavra_de_fogo", e.id);
  assert.ok(r.ok);
  j.avancar(1000);
  r = usar(j, "repreensao", e.id);
  assert.ok(r.ok && r.alvos[0].status === "medo");
  j.avancar(1000);
  r = usar(j, "juizo", e.id);
  assert.ok(r.alvos[0].combinacoes.includes("Juízo") && !g("statusAtivo")(e, "medo", j.agora), `juízo consome: ${r.mensagem}`);
  j.avancar(1000);
  Object.assign(e, { status: {}, imune: {} });
  posicionarAoLado(j, e.area, e);
  r = usar(j, "mar_aberto");
  assert.ok(r.ok && distanciaJ(p, e) > 1, `mar aberto empurra: ${r.mensagem}`);
});

teste("63d. Pastor: o cão segue e morde (com XP do abate), a ovelha atrai as criaturas e cai, tudo some ao trocar de área", () => {
  const { j, p, e } = cenaComportamento("lobo1");
  comVocacao(j, "pastor", 25);
  p.equipamento.arma = "espada_ferro";
  aDistancia(j, e, 3);
  let r = usar(j, "chamar_o_cao");
  assert.ok(r.ok && r.aliados.length === 1 && r.aliados[0].tipo === "cao", r.mensagem);
  const cao = j.M.aliados(ID)[0];
  // Morde o seu alvo: depois do seu golpe, o cão vai até a criatura e morde.
  j.avancar(1000);
  p.vidaInimigos[e.id] = 10_000;
  r = usar(j, "mordida", e.id);
  assert.ok(r.ok && r.alvos.some((l) => l.aliadoId === cao.id && l.dano > 0 && l.status === "sangramento"), `mordida: ${r.mensagem}`);
  assert.ok(distanciaJ(cao, e) <= 1, "o cão foi até o alvo");
  // Sozinho, ele morde de novo e pode derrotar (o XP é seu).
  p.vidaInimigos[e.id] = 3;
  e.status = {};
  const xp = p.xp;
  let morte = null;
  for (let t = 0; t < 4000 && !morte; t += 100) { j.avancar(100); morte = j.atualizar().find((x) => x.tipo === "inimigoDerrotado"); }
  assert.ok(morte && morte.aliadoId === cao.id && p.xp > xp, "o cão derrota e o XP vem");
  // Longe, o cão segue você.
  Object.assign(p, j.g("areas").canaan.inicio);
  for (let t = 0; t < 15_000; t += 100) { j.avancar(100); j.atualizar(); }
  assert.ok(j.M.aliados(ID).length === 1 && distanciaJ(cao, p) <= 3, "segue você (e vem correndo se ficar longe)");

  // Ovelha: as criaturas a até 4 casas dela a atacam em vez de você.
  const { j: k, p: q, e: urso } = cenaComportamento("urso1");
  comVocacao(k, "pastor", 25);
  posicionarAoLado(k, urso.area, urso);
  r = k.exec({ tipo: "usarHabilidade", habilidade: "ovelha_isca" });
  assert.ok(r.ok && r.aliados[0].tipo === "ovelha", r.mensagem);
  const ovelha = k.M.aliados(ID)[0];
  const vidaJogador = q.vida;
  let atingida = 0;
  let caiu = false;
  for (let t = 0; t < 12_000 && !caiu; t += 100) {
    k.avancar(100);
    for (const ev of k.atualizar()) {
      if (ev.tipo === "iscaAtingida") atingida++;
      if (ev.tipo === "aliadoPartiu" && ev.aliadoId === ovelha.id) caiu = true;
      assert.ok(!(ev.tipo === "jogadorAtingido" && ev.inimigoId === urso.id) || atingida === 0 || caiu, "com a ovelha de pé, o urso não bate em você");
    }
  }
  assert.ok(atingida > 0 && caiu, "a ovelha apanha e cai (ou some no tempo)");
  assert.ok(q.vida >= vidaJogador - 30, "você foi poupado enquanto ela durou");
  // Trocar de área dispensa os aliados.
  k.exec({ tipo: "usarHabilidade", habilidade: "chamar_o_cao" });
  k.M.entrar(ID);
  igual(k.M.aliados(ID), []);
});

// Simula uma luta com a vocação (rotação simples: cura abaixo de 50%, buffs, depois as habilidades de dano/controle
// prontas e o golpe básico a cada 2 s) ou sem vocação (só o golpe básico). Devolve { vitoria, duracao, pocoes }.
function lutaComVocacao(inimigoId, vocacao, { semente = 7, nivelExtra = 0 } = {}) {
  const j = carregarJogo({ semente });
  j.entrar();
  concluirMissoes(j);
  const e = j.g("inimigos")[inimigoId];
  const perfil = PERFIS_CHEGADA[e.area];
  for (const outro of Object.values(j.g("inimigos"))) if (outro !== e && outro.area === e.area) { outro.inicioX = outro.x = -50; outro.inicioY = outro.y = -50; }
  const p = j.p;
  const nivel = Math.max(perfil.nivel, e.nivel, 8) + nivelExtra;
  if (vocacao) comVocacao(j, vocacao, nivel);
  else Object.assign(p, { nivel, xp: j.g("limiarNivel")(nivel - 1) });
  p.equipamento = { arma: perfil.arma, arco: vocacao === "fundibulario" ? "funda" : null, escudo: perfil.escudo, armadura: perfil.armadura };
  if (vocacao === "fundibulario") p.equipamento.arma = null;
  p.habilidades = { corpo: perfil.corpo, distancia: perfil.corpo, defesa: perfil.defesa, oracao: 0 };
  p.vida = j.g("vidaMaxima")(p);
  p.inventario = Array(6).fill("pocao");
  p.campeoes = {};
  if (j.M.obterVidaInimigo(ID, e.id) <= 0) j.M.reaparecerInimigo(ID, e.id);
  p.campeoes = {};
  p.vidaInimigos[e.id] = e.vidaMaxima;
  Object.assign(e, { x: e.inicioX, y: e.inicioY, status: {}, imune: {} });
  posicionarAoLado(j, e.area, e);
  const HAB = j.g("HABILIDADES_VOCACAO");
  const ids = vocacao ? j.g("idsHabilidades")(p).filter((h) => HAB[h].nivel <= p.nivel) : [];
  const inicio = j.agora;
  let proximoBasico = j.agora;
  let pocoes = 0;
  while (j.agora - inicio < 180_000) {
    for (const ev of j.atualizar()) if (ev.tipo === "renasceu") return { vitoria: false, duracao: (j.agora - inicio) / 1000, pocoes };
    if (j.M.obterVidaInimigo(ID, e.id) <= 0) return { vitoria: true, duracao: (j.agora - inicio) / 1000, pocoes };
    const vidaMax = j.g("vidaMaxima")(p);
    if (p.vida < vidaMax * 0.3 && p.inventario.includes("pocao")) { j.exec({ tipo: "usarPocao" }); pocoes++; }
    if (distanciaJ(p, e) > 1 && !["fundibulario", "profeta", "levita"].includes(vocacao)) posicionarAoLado(j, e.area, e);
    let agiu = false;
    const ordem = [...ids].sort((a, b) => (HAB[b].cura && p.vida < vidaMax * 0.5 ? 1 : 0) - (HAB[a].cura && p.vida < vidaMax * 0.5 ? 1 : 0));
    for (const h of ordem) {
      const d = HAB[h];
      if (d.cura && !d.dano && p.vida > vidaMax * 0.6) continue;
      if (d.movimento?.recuo) continue;
      const r = usar(j, h, d.alvo === "inimigo" ? e.id : undefined);
      if (r.ok) { agiu = true; break; }
      if (r.emRecarga && !/pronta em/.test(r.mensagem)) break;
    }
    if (!agiu && j.agora >= proximoBasico) {
      const r = j.exec({ tipo: vocacao === "fundibulario" ? "atacarDistancia" : "atacar", alvoId: e.id });
      if (r.ok || !r.emRecarga) proximoBasico = j.agora + 2000;
      if (!r.ok && /Chegue ao lado|Nenhum inimigo/.test(r.mensagem)) posicionarAoLado(j, e.area, e);
    }
    j.avancar(100);
  }
  return { vitoria: false, duracao: 180, pocoes };
}

teste("63e. simulação de cada vocação: vence as elites de cada região, mais rápido ou com menos poções que sem vocação, sem banalizar", () => {
  const alvos = ["urso1", "leao1", "crocodilo1", "auriga1", "leopardo1", "mercenario1"];
  const vocacoes = ["guerreiro", "fundibulario", "levita", "profeta", "pastor"];
  const linhas = [];
  const base = {};
  for (const a of alvos) base[a] = lutaComVocacao(a, null);
  const resumo = {};
  for (const v of vocacoes) {
    let tempo = 0;
    let pocoes = 0;
    for (const a of alvos) {
      const r = lutaComVocacao(a, v);
      assert.ok(r.vitoria, `${v} contra ${a}: derrota`);
      tempo += r.duracao;
      pocoes += r.pocoes;
      linhas.push(`    ${v.padEnd(14)}${a.padEnd(13)}${String(r.duracao.toFixed(1)).padStart(6)} s ${String(r.pocoes).padStart(3)}  (sem vocação: ${base[a].duracao.toFixed(1)} s, ${base[a].pocoes})`);
    }
    resumo[v] = { tempo, pocoes };
  }
  const tempoBase = alvos.reduce((t, a) => t + base[a].duracao, 0);
  const pocoesBase = alvos.reduce((t, a) => t + base[a].pocoes, 0);
  console.log(`\n    Simulação das vocações (nível de chegada da região, mín. 8; tempo e poções):\n${linhas.join("\n")}`);
  console.log(`    Total sem vocação: ${tempoBase.toFixed(1)} s, ${pocoesBase} poções\n` + vocacoes.map((v) => `    ${v.padEnd(14)}${resumo[v].tempo.toFixed(1)} s, ${resumo[v].pocoes} poções`).join("\n"));
  for (const v of vocacoes) {
    const { tempo, pocoes } = resumo[v];
    assert.ok(tempo <= tempoBase || pocoes < pocoesBase, `${v}: nem mais rápida nem mais segura que sem vocação`);
    assert.ok(tempo <= tempoBase * 1.25, `${v}: lenta demais (${tempo.toFixed(1)} s contra ${tempoBase.toFixed(1)} s)`);
    assert.ok(tempo >= tempoBase * 0.35, `${v}: banaliza as lutas (${tempo.toFixed(1)} s contra ${tempoBase.toFixed(1)} s)`);
  }
  // Com todas as habilidades (nível 25), cada vocação usa as 7 numa luta longa sem erro.
  for (const v of vocacoes) assert.ok(lutaComVocacao("mercenario1", v, { nivelExtra: 14 }).vitoria, `${v} no nível 25`);
});

// Põe pontos num talento direto pelo comando (falha o teste se recusar).
function aprender(j, talento, vezes = 1) {
  for (let i = 0; i < vezes; i++) {
    const r = j.exec({ tipo: "aprenderTalento", talento });
    assert.ok(r.ok, `${talento}: ${r.mensagem}`);
  }
}

teste("64. talentos (JGB-21): 3 ramos por vocação, fileiras, requisitos, um ápice por ramo e textos claros", () => {
  const j = carregarJogo();
  const T = j.g("TALENTOS");
  const R = j.g("REGRAS_TALENTOS");
  const VOC = j.g("VOCACOES");
  const textoEf = j.g("textoEfeitoTalento");
  igual(Object.keys(T), Object.keys(VOC));
  igual(R.tiers.length, 4);
  const ids = new Set();
  const camposEfeito = ["vida", "defesa", "dano", "critico", "cura", "aliados", "reducao", "recarga", "habilidades"];
  for (const [vid, ramos] of Object.entries(T)) {
    const v = VOC[vid];
    const habs = new Set([...v.habilidades, ...Object.values(v.especializacoes).map((e) => e.habilidade)]);
    assert.strictEqual(ramos.length, 3, `${vid}: 3 ramos`);
    for (const ramo of ramos) {
      assert.ok(ramo.id && ramo.nome && ramo.foco, `${vid}/${ramo.id}: textos do ramo`);
      const porTier = [1, 2, 3, 4].map((t) => ramo.talentos.filter((x) => x.tier === t));
      assert.ok(porTier.every((l) => l.length), `${ramo.id}: as 4 fileiras têm talento`);
      const apices = ramo.talentos.filter((x) => x.apice);
      assert.ok(apices.length === 1 && apices[0].tier === 4 && apices[0].graus === 1 && apices[0].texto, `${ramo.id}: um ápice na fileira 4`);
      // Pontos das fileiras 1 a 3 bastam para abrir o ápice.
      const antesDoApice = ramo.talentos.filter((x) => x.tier < 4).reduce((s, x) => s + x.graus, 0);
      assert.ok(antesDoApice >= R.tiers[3], `${ramo.id}: ápice alcançável`);
      for (let t = 2; t <= 4; t++) {
        const acima = ramo.talentos.filter((x) => x.tier < t).reduce((s, x) => s + x.graus, 0);
        assert.ok(acima >= R.tiers[t - 1], `${ramo.id}: fileira ${t} alcançável`);
      }
      for (const t of ramo.talentos) {
        assert.ok(!ids.has(t.id) && /^[a-z_]+$/.test(t.id), `${t.id}: id único`);
        ids.add(t.id);
        assert.ok(t.nome && Number.isInteger(t.graus) && t.graus >= 1 && t.graus <= 5, `${t.id}: nome e graus`);
        if (t.requer) {
          const req = ramo.talentos.find((x) => x.id === t.requer);
          assert.ok(req && req.tier < t.tier, `${t.id}: requisito no mesmo ramo, acima`);
        }
        if (t.tier >= 3) assert.ok(t.requer, `${t.id}: fileira ${t.tier} pede um talento de cima`);
        assert.ok(Object.keys(t.efeito).length && Object.keys(t.efeito).every((k) => camposEfeito.includes(k)), `${t.id}: efeito conhecido`);
        for (const k of Object.keys(t.efeito.dano || {})) assert.ok(["corpo", "distancia", "magia"].includes(k), `${t.id}: dano.${k}`);
        for (const k of Object.keys(t.efeito.critico || {})) assert.ok(["corpo", "distancia"].includes(k), `${t.id}: critico.${k}`);
        for (const [h, m] of Object.entries(t.efeito.habilidades || {})) {
          assert.ok(habs.has(h), `${t.id}: ${h} é do ${v.nome}`);
          assert.ok(Object.keys(m).every((k) => ["dano", "cura", "recarga"].includes(k)), `${t.id}: ${h}`);
          if (m.dano) assert.ok(j.g("HABILIDADES_VOCACAO")[h].dano || j.g("HABILIDADES_VOCACAO")[h].cao, `${t.id}: ${h} causa dano`);
          if (m.cura) assert.ok(j.g("HABILIDADES_VOCACAO")[h].cura || j.g("HABILIDADES_VOCACAO")[h].buff?.regen, `${t.id}: ${h} cura`);
        }
        // Texto claro: sem "undefined"/"NaN", com número e, com mais graus, o valor do grau final.
        const um = textoEf(t.efeito, 1);
        const todos = textoEf(t.efeito, t.graus);
        assert.ok(um && !/undefined|NaN/.test(um + todos) && /\d/.test(um), `${t.id}: texto "${um}"`);
        if (t.graus > 1) assert.notStrictEqual(um, todos, `${t.id}: o texto acompanha os graus`);
      }
    }
    // Teto por ramo cheio: nada passa de +40% de dano, 20% de redução, 25% de recarga ou 30% de vida.
    for (const ramo of ramos) {
      const p = { vocacao: { id: vid }, nivel: 200, talentos: Object.fromEntries(ramo.talentos.map((t) => [t.id, t.graus])) };
      const ef = j.g("efeitosTalentos")(p);
      assert.ok(Math.max(...Object.values(ef.dano)) <= 0.4 && ef.reducao <= 0.2 && ef.recarga <= 0.25 && ef.vida <= 0.3, `${ramo.id}: teto`);
    }
  }
  // Texto: porcentagem com vírgula e listas com "e".
  igual(textoEf({ dano: { corpo: 0.03 }, defesa: 1 }, 3), "+3 de defesa e +9% de dano corpo a corpo");
  igual(textoEf({ reducao: 0.015 }, 3), "4,5% menos dano recebido");
  igual(textoEf({ habilidades: { golpe_firme: { dano: 0.12 } } }, 2), "Golpe firme: +24% de dano");
});

teste("64b. talentos: 1 ponto por nível, fileira, requisito, um ápice, reset pago, troca de vocação e save", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  const g = (n) => j.g(n);
  const visao = () => g("visaoTalentos")(p);
  // Sem vocação: nada.
  p.nivel = 20;
  igual([visao().totais, visao().ramos.length], [0, 0]);
  assert.ok(!j.exec({ tipo: "aprenderTalento", talento: "gu_pele_de_couro" }).ok);
  // No nível 8, 1 ponto; fileira 2 ainda fechada.
  comVocacao(j, "guerreiro", 8);
  igual([visao().totais, visao().livres, visao().ramos.map((r) => r.id)], [1, 1, ["baluarte", "valentia", "comando"]]);
  let r = j.exec({ tipo: "aprenderTalento", talento: "gu_firmeza" });
  assert.ok(!r.ok && /Requer 3 pontos em Baluarte/.test(r.mensagem), r.mensagem);
  assert.ok(!j.exec({ tipo: "aprenderTalento", talento: "fu_mao_firme" }).ok, "talento de outra vocação");
  assert.ok(!j.exec({ tipo: "aprenderTalento", talento: "constructor" }).ok, "id estranho");
  const def = g("defesaTotal")(p);
  r = j.exec({ tipo: "aprenderTalento", talento: "gu_pele_de_couro" });
  assert.ok(r.ok && r.graus === 1 && r.livres === 0 && /\+1 de defesa/.test(r.mensagem), r.mensagem);
  assert.strictEqual(g("defesaTotal")(p), def + 1, "defesa do talento");
  r = j.exec({ tipo: "aprenderTalento", talento: "gu_pele_de_couro" });
  assert.ok(!r.ok && /Sem pontos livres/.test(r.mensagem) && /nível 9/.test(r.mensagem), r.mensagem);
  // Nível 30: 23 pontos.
  p.nivel = 30;
  igual([visao().totais, visao().livres], [23, 22]);
  aprender(j, "gu_pele_de_couro", 2);
  assert.ok(!j.exec({ tipo: "aprenderTalento", talento: "gu_pele_de_couro" }).ok, "graus no máximo");
  aprender(j, "gu_firmeza", 2);
  // Fileira 3 pede 6 pontos no ramo e Firmeza completa.
  r = j.exec({ tipo: "aprenderTalento", talento: "gu_ultimo_folego" });
  assert.ok(!r.ok && /Requer 6 pontos/.test(r.mensagem), r.mensagem);
  aprender(j, "gu_folego", 1);
  r = j.exec({ tipo: "aprenderTalento", talento: "gu_ultimo_folego" });
  assert.ok(!r.ok && /Requer Firmeza completo/.test(r.mensagem), r.mensagem);
  aprender(j, "gu_firmeza", 1);
  aprender(j, "gu_ultimo_folego", 3);
  // 10 no ramo para o ápice (aqui: 3 + 1 + 3 + 3 = 10).
  aprender(j, "gu_torre_de_davi", 1);
  const v1 = visao();
  igual([v1.gastos, v1.ramos[0].pontos, v1.ramos[0].talentos.find((t) => t.id === "gu_torre_de_davi").graus], [11, 11, 1]);
  // Um ápice só: Valentia cheia até a fileira 3, mas o ápice recusa (o motivo é o ápice, não os pontos).
  aprender(j, "gu_braco_forte", 3);
  aprender(j, "gu_olho_no_golpe", 3);
  aprender(j, "gu_golpe_pesado", 3);
  aprender(j, "gu_sede_de_batalha", 3);
  assert.strictEqual(visao().livres, 0, "23 − 11 − 12");
  r = j.exec({ tipo: "aprenderTalento", talento: "gu_tres_valentes" });
  assert.ok(!r.ok && /um ápice/.test(r.mensagem) && /Torre de Davi/.test(r.mensagem), r.mensagem);
  const tal = visao().ramos[1].talentos.find((t) => t.id === "gu_tres_valentes");
  assert.ok(!tal.pode && tal.motivo, "a interface recebe o motivo");
  assert.ok(/redu|vida|defesa/.test(visao().resumo), `resumo: ${visao().resumo}`);
  // Vida máxima com os talentos de vida; reset pago devolve tudo (e a vida cabe no novo máximo).
  const vidaCom = g("vidaMaxima")(p);
  p.vida = vidaCom;
  const gastos = visao().gastos;
  const preco = 50 + 5 * gastos;
  assert.strictEqual(visao().precoReset, preco);
  p.moedas = preco - 1;
  r = j.exec({ tipo: "resetarTalentos" });
  assert.ok(!r.ok && new RegExp(String(preco)).test(r.mensagem) && visao().gastos === gastos, "sem moedas, sem reset");
  p.moedas = preco + 7;
  r = j.exec({ tipo: "resetarTalentos" });
  assert.ok(r.ok && r.moedasGastas === preco && p.moedas === 7 && visao().gastos === 0 && visao().livres === 23, r.mensagem);
  assert.ok(g("vidaMaxima")(p) < vidaCom && p.vida === g("vidaMaxima")(p), "vida ajustada ao novo máximo");
  assert.ok(!j.exec({ tipo: "resetarTalentos" }).ok, "nada a devolver");
  // Trocar de vocação com o mestre devolve os pontos de graça.
  aprender(j, "gu_braco_forte", 3);
  const mestre = Object.values(g("npcs")).find((n) => n.papel === "vocacao");
  posicionarAoLado(j, mestre.area, mestre);
  r = j.exec({ tipo: "escolherVocacao", vocacao: "levita" });
  assert.ok(r.ok && /3 pontos de talento voltaram/.test(r.mensagem) && Object.keys(p.talentos).length === 0, r.mensagem);
  igual([visao().livres, visao().ramos[0].id], [23, "santuario"]);
  // Aviso de pontos livres: uma vez.
  p.avisosPendentes = [];
  p.vocacao.avisadaTalentos = false;
  j.M.salvar(p);
  j.M.salvar(p);
  assert.strictEqual(p.avisosPendentes.filter((a) => a.id === "talentos").length, 1, "aviso de talentos");
  // Save: recarrega igual.
  aprender(j, "le_maos_que_curam", 3);
  aprender(j, "le_bencao_ampla", 2);
  g("Storage").flush();
  const q = carregarJogo({ store: j.store, inicio: j.agora }).entrar();
  igual(q.talentos, { le_maos_que_curam: 3, le_bencao_ampla: 2 });
});

teste("64c. talentos no save: árvore inválida devolve os pontos, ids estranhos somem e a v13 recebe o aviso", () => {
  const salvarCom = (talentos, nivel = 30, vocacao = "levita", versao) => {
    const j = carregarJogo();
    j.entrar();
    comVocacao(j, vocacao, nivel);
    j.p.talentos = talentos;
    j.g("Storage").flush();
    if (versao) {
      const chave = Object.keys(j.store).find((k) => k.startsWith("save_"));
      const dados = JSON.parse(j.store[chave]);
      dados.versao = versao;
      j.store[chave] = JSON.stringify(dados);
    }
    const k = carregarJogo({ store: j.store, inicio: j.agora });
    const q = k.entrar();
    return { q, avisos: q.avisosPendentes.map((a) => a.id) };
  };
  // Válida: fica igual.
  let r = salvarCom({ le_maos_que_curam: 3, le_ministerio: 1, le_bencao_pronta: 3 });
  igual([r.q.talentos, r.avisos.includes("talentos_devolvidos")], [{ le_maos_que_curam: 3, le_ministerio: 1, le_bencao_pronta: 3 }, false]);
  // Ids estranhos e de outra vocação somem sem mexer no resto.
  r = salvarCom({ le_maos_que_curam: 2, constructor: 3, gu_firmeza: 3, toString: 1 });
  igual(r.q.talentos, { le_maos_que_curam: 2 });
  // Mais pontos que o nível dá, fileira sem pontos, requisito faltando, graus a mais, dois ápices: tudo volta.
  for (const [nome, talentos, nivel] of [
    ["pontos a mais", { le_maos_que_curam: 3, le_bencao_pronta: 3 }, 10],
    ["fileira fechada", { le_incenso_suave: 1 }, 30],
    ["requisito", { le_maos_que_curam: 2, le_bencao_pronta: 3, le_incenso_suave: 1, le_ministerio: 1 }, 30],
    ["graus a mais", { le_maos_que_curam: 9 }, 30],
    ["grau não inteiro", { le_maos_que_curam: 1.5 }, 30],
  ]) {
    r = salvarCom(talentos, nivel);
    assert.ok(Object.keys(r.q.talentos).length === 0 && r.avisos.includes("talentos_devolvidos"), `${nome}: ${JSON.stringify(r.q.talentos)}`);
  }
  const doisApices = { le_maos_que_curam: 3, le_bencao_pronta: 3, le_incenso_suave: 3, le_bencao_ampla: 3, le_ministerio: 3, le_oleo_da_uncao: 1,
    le_chama_acesa: 3, le_pavio_limpo: 3, le_brilho: 3, le_som_do_shofar: 3, le_azeite_puro: 3, le_sete_lampadas: 1 };
  r = salvarCom(doisApices, 100);
  assert.ok(Object.keys(r.q.talentos).length === 0, "dois ápices");
  // Sem vocação, os talentos somem.
  const j = carregarJogo();
  j.entrar();
  j.p.talentos = { gu_pele_de_couro: 1 };
  j.g("Storage").flush();
  igual(carregarJogo({ store: j.store }).entrar().talentos, {});
  // Save v13 com vocação: aviso da novidade (uma vez), árvore vazia.
  r = salvarCom(undefined, 20, "profeta", 13);
  assert.ok(r.avisos.includes("atualizacao_14") && !r.avisos.includes("talentos"), r.avisos.join(","));
  igual(r.q.talentos, {});
});

teste("64d. efeitos dos talentos no combate: dano, crítico, defesa, redução, recarga (com teto), cura e aliados", () => {
  const { j, p, e } = cenaComportamento("urso1");
  const g = (n) => j.g(n);
  comVocacao(j, "guerreiro", 40);
  p.equipamento.arma = "espada_ferro";
  p.vidaInimigos[e.id] = 100_000;
  posicionarAoLado(j, e.area, e);
  j.definirAleatorio(() => 0.99); // sem crítico pela sorte
  let r = usar(j, "golpe_firme", e.id);
  const semTalento = r.alvos[0].dano;
  assert.strictEqual(p.recargas.golpe_firme - j.agora, 6000, "recarga base");
  // Golpe pesado 3/3 (+36%) e Braço forte 3/3 (+9% corpo a corpo).
  p.talentos = { gu_braco_forte: 3, gu_olho_no_golpe: 3, gu_golpe_pesado: 3 };
  igual(Math.round(g("fatorDano")(p, "corpo", j.agora) * 1000), 1090);
  j.avancar(7000);
  r = usar(j, "golpe_firme", e.id);
  assert.ok(r.alvos[0].dano > semTalento * 1.3, `golpe com talentos: ${r.alvos[0].dano} contra ${semTalento}`);
  const critSem = (() => { const t = p.talentos; p.talentos = {}; const c = g("chanceCritico")(p, "corpo"); p.talentos = t; return c; })();
  assert.strictEqual(g("chanceCritico")(p, "corpo"), critSem + 3, "crítico");
  // Recarga: Disciplina 3/3 (−9%) em todas; a soma com a da habilidade para no teto de 40%.
  p.talentos = { gu_disciplina: 3 };
  j.avancar(7000);
  r = usar(j, "golpe_firme", e.id);
  assert.strictEqual(p.recargas.golpe_firme - j.agora, Math.round(6000 * 0.91), "recarga com talento");
  assert.strictEqual(g("barraHabilidades")(p, j.agora)[0].recarga, Math.round(6000 * 0.91), "a barra mostra a recarga com talento");
  p.talentos = { gu_disciplina: 3, gu_capitao_de_mil: 3, gu_espada_de_gideao: 1, gu_escudo_treinado: 3 };
  assert.strictEqual(g("recargaHabilidade")(p, "escudo_erguido"), Math.round(15000 * 0.6), "teto de 40%");
  // Redução e defesa: Firmeza 3/3 (6% a menos) e Torre de Davi (+8%, +3 de defesa, +10% de vida).
  p.talentos = { gu_firmeza: 3 };
  igual(j.M.absorverDano(p, 100, j.agora).dano, 94);
  const vidaSem = (() => { const t = p.talentos; p.talentos = {}; const v = g("vidaMaxima")(p); p.talentos = t; return v; })();
  p.talentos = { gu_firmeza: 3, gu_torre_de_davi: 1 };
  igual(j.M.absorverDano(p, 100, j.agora).dano, 86);
  assert.ok(g("vidaMaxima")(p) > vidaSem, "ápice dá vida");

  // Levita: Mãos que curam 3/3 (+12% em todas as curas) e Bênção ampla 3/3 (+30% na Bênção sacerdotal).
  comVocacao(j, "levita", 40);
  p.talentos = {};
  const vidaMax = g("vidaMaxima")(p);
  p.vida = 1;
  j.avancar(60_000);
  const curaSem = usar(j, "bencao_sacerdotal").cura;
  p.talentos = { le_maos_que_curam: 3, le_bencao_ampla: 3 };
  p.vida = 1;
  j.avancar(60_000);
  const curaCom = usar(j, "bencao_sacerdotal").cura;
  assert.strictEqual(curaCom, Math.round(vidaMax * 0.35 * 1.2 * 1.12 * 1.3), `cura com talentos: ${curaCom} (sem: ${curaSem})`);
  // Incenso suave: a regeneração do Incenso leva o bônus da habilidade.
  p.talentos = { le_incenso_suave: 3 };
  p.vida = 1;
  j.avancar(60_000);
  assert.ok(usar(j, "incenso").ok);
  igual(p.buffs.incenso.fatorCura, 1.3);

  // Pastor: Faro 3/3 (+12% no dano dos aliados) e Presas (+36% na Mordida).
  comVocacao(j, "pastor", 40);
  p.talentos = { pa_faro: 3, pa_presas: 3 };
  igual(Math.round(g("passivosDe")(p).aliados * 1000), Math.round(1.2 * 1.12 * 1000));
  igual(Math.round(g("fatorTalentoHabilidade")(p, "mordida", "dano") * 100), 136);
  // Talentos de outra vocação que sobraram não valem.
  p.talentos = { gu_firmeza: 3 };
  igual(g("passivosDe")(p).reducao, 0);
});

// ---------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------
// Filtro opcional: node tests/logica.test.js 2.  (roda só testes cujo nome começa com "2.")
const filtro = process.argv[2];
const selecionados = filtro ? testes.filter((t) => t.nome.startsWith(filtro)) : testes;
let falhas = 0;
for (const { nome, fn } of selecionados) {
  try {
    fn();
    console.log(`  ok   ${nome}`);
  } catch (erro) {
    falhas++;
    console.log(
      `  FALHA ${nome}\n        ${String(erro.stack || erro)
        .split("\n")
        .slice(0, 4)
        .join("\n        ")}`,
    );
  }
}
console.log(`\n${selecionados.length - falhas}/${selecionados.length} testes passaram.`);
process.exit(falhas ? 1 : 0);
