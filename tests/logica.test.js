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
  "dados/mundo.js",
  "dados/npcs.js",
  "dados/criaturas.js",
  "dados/capitulos.js",
  "dados/missoes.js",
  "dados/tarefas.js",
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
  const ITENS = j.g("ITENS");
  for (const [slot, tipo] of Object.entries({ arma: "arma", escudo: "escudo", armadura: "armadura" })) {
    const valor = (i) => (i ? ITENS[i].bonus || ITENS[i].defesa || 0 : -1);
    const melhor = p.inventario.filter((i) => ITENS[i].tipo === tipo).sort((a, b) => valor(b) - valor(a))[0];
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
function lutar(j, inimigoId, { maxPocoes = 3, tipo = "corpo" } = {}) {
  const M = j.M;
  const e = j.g("inimigos")[inimigoId];
  const vidaMaxima = j.g("vidaMaxima");
  const p = j.p;
  if (M.obterVidaInimigo(ID, inimigoId) <= 0) assert.ok(M.reaparecerInimigo(ID, inimigoId));
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
      const r = j.exec({ tipo: tipo === "distancia" ? "atacarDistancia" : "atacar", alvoId: inimigoId });
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
  registrar("Canaã", "lobo1", lutar(j, "lobo1"));
  pegarSaques(j);
  falar(j, "viajante1");
  equiparMelhor(j);
  assert.strictEqual(j.p.equipamento.arma, "espada_ferro");
  falar(j, "viajante1");
  for (const erva of j.g("coletaveisDaArea")("canaan")) assert.ok(pisarEm(j, "canaan", erva).itemColetado);
  falar(j, "viajante1");
  assert.strictEqual(j.p.missoes.ervas.status, "concluida");

  // Deserto (pela trilha)
  atravessar(j, "canaan", j.g("areas").canaan.passagem, 1, 0);
  assert.strictEqual(j.p.area, "deserto");
  falar(j, "noemi1");
  for (const odre of j.g("coletaveisDaArea")("deserto")) assert.ok(pisarEm(j, "deserto", odre).itemColetado);
  falar(j, "noemi1");
  equiparMelhor(j);
  assert.strictEqual(j.p.equipamento.armadura, "armadura_couro");
  for (let i = 0; i < 2; i++) {
    esperarCurar(j);
    registrar("Deserto", "escorpiao1", lutar(j, "escorpiao1"));
    pegarSaques(j);
    j.avancar(5000);
  }
  falar(j, "noemi1");
  assert.strictEqual(j.p.missoes.deserto.etapa, 2, "etapa 3 de 3 (índice 2)");
  esperarCurar(j);
  registrar("Deserto", "bandido1", lutar(j, "bandido1"));
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
    registrar(cap.nome, cap.inimigo, lutar(j, cap.inimigo));
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
    ["erva", "erva", "erva"],
  );
  igual(
    coletaveis("deserto").map((c) => c.item),
    ["odre_agua", "odre_agua", "odre_agua"],
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
  assert.ok(p.envenenadoAte > j.agora);
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
  p.envenenadoAte = j.agora + 10_000;
  p.proximoDanoVeneno = j.agora;
  const ev = j.atualizar();
  const r = ev.find((e) => e.tipo === "renasceu");
  assert.ok(r, "morte por veneno gera renasceu");
  assert.strictEqual(r.causa, "veneno");
  assert.strictEqual(p.moedas, 180);
  assert.strictEqual(p.vidaInimigos.escorpiao1, j0Vida("escorpiao1"));
  assert.strictEqual(p.envenenadoAte, 0);
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
    for (const ponto of [a.passagem, a.cais, a.chegada, a.chegadaViagem, a.caisCanaa, a.caisDeserto].filter(Boolean)) {
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
  for (const erva of j.g("coletaveisDaArea")("canaan")) pisarEm(j, "canaan", erva);
  assert.strictEqual(p.missoes.ervas.progresso[0].length, 3);
  j.M.removerItens(p, "erva", 3); // vendeu as ervas
  const pocoes = j.M.contarItem(ID, "pocao");
  falar(j, "viajante1");
  assert.strictEqual(p.missoes.ervas.status, "em_andamento", "sem ervas não conclui");
  assert.strictEqual(j.M.contarItem(ID, "pocao"), pocoes);

  // Odres, venenos e insígnia.
  falar(j, "noemi1");
  for (const odre of j.g("coletaveisDaArea")("deserto")) pisarEm(j, "deserto", odre);
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
  assert.strictEqual(p.envenenadoAte, 0, "veneno vencido é zerado na carga");
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
  assert.strictEqual(k.exec({ tipo: "comprar", item: "constructor" }).mensagem, "Esse item não está à venda.");
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
  p.area = "deserto";
  p.x = 40;
  p.y = 40;
  p.vida = 200;
  j.M.aplicarVeneno(p, j.g("VENENO_PADRAO"), j.agora);
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
    for (const i of e.saque.itens) item(i, `saque de ${e.id}`);
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
        objetivos: [{ tipo: "chegar", area: "deserto", x: 66, y: 12, raio: 2, aviso: "Você achou Tamar." }],
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
  assert.match(v.mensagem, /Viagem rápida para Deserto\..* Você achou Tamar\.$/);
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
    { id: "deserto_rotas", nome: "As rotas das caravanas", curto: "Escorpiões", progresso: 1, meta: 150, cumpridaAgora: false },
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
  igual(visao("egito_farao").valem, ["Guarda egípcio", "Soldado perseguidor"]);
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
  p.tarefas.deserto_rotas.progresso = 149;
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

teste("38. migração para a v8: saves v5, v6 e v7 ganham caçadas vazias; v8 recarrega igual; corrompido é normalizado", () => {
  const vazio = (p, onde) => {
    igual([p.tarefas, p.pontosTarefa, p.pontosTarefaTotal, p.trocas], [{}, 0, 0, {}], onde);
    assert.strictEqual(p.versao, 8, onde);
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
  // v8 com caçadas em andamento, pontos e trocas: recarrega idêntico.
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
  // Save v8 corrompido.
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
