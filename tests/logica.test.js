#!/usr/bin/env node
// Testes da lógica de "Jornada · RPG Bíblico".
// Uso: node tests/logica.test.js        (sem dependências)
// Carrega storage.js, logica.js e expansao.js num vm com localStorage,
// relógio (Date) e Math.random controlados.
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const RAIZ = path.resolve(__dirname, "..");
const ARQUIVOS = ["storage.js", "logica.js", "expansao.js"];
const FONTES = ARQUIVOS.map((f) => fs.readFileSync(path.join(RAIZ, f), "utf8"));
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
  assert.strictEqual(j.p.missaoErvas.status, "concluida");

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
  assert.strictEqual(j.p.missaoDeserto.etapa, 3);
  esperarCurar(j);
  registrar("Deserto", "bandido1", lutar(j, "bandido1"));
  pegarSaques(j);
  falar(j, "noemi1");
  assert.strictEqual(j.p.missaoDeserto.status, "concluida");

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
    assert.strictEqual(j.p.capitulos[chave].status, "em_andamento");
    esperarCurar(j);
    registrar(cap.nome, cap.inimigo, lutar(j, cap.inimigo));
    pegarSaques(j);
    assert.strictEqual(j.p.capitulos[chave].alvo, true, `alvo de ${chave} deveria estar cumprido`);
    const r = falar(j, cap.npc);
    assert.strictEqual(j.p.capitulos[chave].status, "concluida", `${chave} não concluiu: ${r.mensagem}`);
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
  for (const chave of j.g("ORDEM_CAPITULOS")) assert.strictEqual(j.p.capitulos[chave].status, "concluida");
  assert.strictEqual(j.p.oracaoDesbloqueada, true);
});

teste("1b. derrotar o inimigo do capítulo marca o objetivo (CAPITULOS[k].inimigo)", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  p.missaoDeserto.status = "concluida";
  p.capitulos.egito = { status: "em_andamento", alvo: false };
  p.vidaInimigos.soldadoEgito1 = 1;
  const e = j.g("inimigos").soldadoEgito1;
  posicionarAoLado(j, "egito", e);
  const r = j.exec({ tipo: "atacar", alvoId: e.id });
  assert.ok(r.derrotado);
  assert.strictEqual(p.capitulos.egito.alvo, true);
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
  p.missaoDeserto.status = "concluida";
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
  p.missaoDeserto.status = "concluida";
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
    p.missaoDeserto.status = "concluida";
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
  p.missaoEliabe.status = "concluida";
  falar(j, "viajante1");
  for (const erva of j.g("coletaveisDaArea")("canaan")) pisarEm(j, "canaan", erva);
  assert.strictEqual(p.missaoErvas.ervasMissaoColetadas.length, 3);
  j.M.removerItens(p, "erva", 3); // vendeu as ervas
  const pocoes = j.M.contarItem(ID, "pocao");
  falar(j, "viajante1");
  assert.strictEqual(p.missaoErvas.status, "em_andamento", "sem ervas não conclui");
  assert.strictEqual(j.M.contarItem(ID, "pocao"), pocoes);

  // Odres, venenos e insígnia.
  falar(j, "noemi1");
  for (const odre of j.g("coletaveisDaArea")("deserto")) pisarEm(j, "deserto", odre);
  j.M.removerItens(p, "odre_agua", 3);
  falar(j, "noemi1");
  assert.strictEqual(p.missaoDeserto.etapa, 1);
  p.inventario.push("odre_agua", "odre_agua", "odre_agua");
  falar(j, "noemi1");
  assert.strictEqual(p.missaoDeserto.etapa, 2);
  p.missaoDeserto.venenosMissaoColetados = ["a", "b"];
  const moedas = p.moedas;
  falar(j, "noemi1");
  assert.strictEqual(p.missaoDeserto.etapa, 2);
  assert.strictEqual(p.moedas, moedas);
  p.inventario.push("veneno_escorpiao", "veneno_escorpiao");
  falar(j, "noemi1");
  assert.strictEqual(p.missaoDeserto.etapa, 3);
  p.missaoDeserto.insigniasMissaoColetadas = ["c"];
  falar(j, "noemi1");
  assert.strictEqual(p.missaoDeserto.status, "em_andamento");
  p.inventario.push("insignia_bandido");
  falar(j, "noemi1");
  assert.strictEqual(p.missaoDeserto.status, "concluida");
});

teste("11. Arão do Egito tem falas próprias e não duplica a missão", () => {
  const j = carregarJogo();
  j.entrar();
  const p = j.p;
  p.missaoDeserto.status = "concluida";
  const arao = falar(j, "aaronEgito");
  assert.strictEqual(p.capitulos.egito.status, "bloqueado", "Arão não inicia a missão");
  const moises = falar(j, "moisesEgito");
  assert.strictEqual(p.capitulos.egito.status, "em_andamento");
  assert.notStrictEqual(arao.mensagem.replace(/^[^:]+:/, ""), moises.mensagem.replace(/^[^:]+:/, ""));
  const araoDepois = falar(j, "aaronEgito");
  assert.match(araoDepois.mensagem, /^Arão:/);
  assert.notStrictEqual(araoDepois.mensagem, arao.mensagem, "fala muda conforme o capítulo");
  assert.strictEqual(p.capitulos.egito.status, "em_andamento");
});

teste("12. sem código morto: versão única, aviso pendente consumível", () => {
  const fonteExp = FONTES[2];
  const fonteLog = FONTES[1];
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
  p.missaoDeserto.status = "em_andamento";
  p.missaoDeserto.etapa = 2;
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
  const fonteExp = FONTES[2];
  assert.doesNotMatch(fonteExp, /Mundo\.\w+\s*=/, "expansao.js não reatribui funções do Mundo");
  assert.doesNotMatch(fonteExp + FONTES[1], /\.bind\(Mundo\)/);
  const fonteLog = FONTES[1];
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
  igual(p.missaoEliabe, original.missaoEliabe);
  igual(p.missaoErvas, original.missaoErvas);
  assert.strictEqual(p.missaoDeserto.status, "concluida");
  igual(p.capitulos.egito, original.capitulos.egito);
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
  assert.strictEqual(p2.capitulos.egito.status, "concluida");
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

teste("20. migração v6→v6 preserva a vida atual dos inimigos feridos", () => {
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
  p.missaoDeserto.status = "em_andamento";
  p.missaoDeserto.etapa = 2;
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
  assert.deepStrictEqual(json(p.missaoDeserto.venenosMissaoColetados), ["s_veneno"]);
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
  p.missaoDeserto.status = "concluida";
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
  p.capitulos.egito.status = "concluida";
  r = passo(paraEgito);
  assert.strictEqual(r.mensagem, "Você chegou ao Egito.");
  const paraGalileia = PORTAIS.find((t) => t.destino === "galileia");
  for (const k of ["marVermelho", "sinai"]) p.capitulos[k].status = "concluida";
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
