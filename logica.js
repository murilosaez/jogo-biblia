// =====================================================================
// logica.js — regras de "Jornada · RPG Bíblico" (sem DOM).
//
// Ordem de carga: storage.js → logica.js → expansao.js → game.js.
// Este arquivo define o motor (Mundo) e os dados de Canaã, Deserto e Mar.
// expansao.js apenas ACRESCENTA dados (áreas, NPCs, inimigos, capítulos e
// portais) usando as funções registrar* daqui; nenhuma função é reembrulhada.
// =====================================================================

// ---------------------------------------------------------------------
// Constantes gerais
// ---------------------------------------------------------------------
const TILE = 32;
const COLS = 80;
const ROWS = 60;
const VERSAO_SAVE = 6;

const VIDA_BASE = 100;
const VIDA_POR_NIVEL = 10;
const NIVEL_MAXIMO = 100;
const XP_NIVEIS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];
const XP_POR_NIVEL_APOS_TABELA = 650;

// Regeneração de vida fora de combate: 2% da vida máxima a cada 3 s,
// começando 8 s depois do último golpe dado ou recebido.
const TEMPO_REGEN = 3000;
const PAUSA_REGEN_COMBATE = 8000;
const REGEN_PERCENTUAL = 0.02;

const INTERVALO_MOVIMENTO = 600; // passo dos inimigos
const INTERVALO_ATAQUE = 1200; // golpe dos inimigos
const RECARGA_ATAQUE = 800; // recarga do jogador (corpo e distância compartilham)
const INTERVALO_AUTO_ATAQUE = 2000; // autoataque ao clicar num inimigo
const ALCANCE_CORPO = 1; // Chebyshev: as 8 casas vizinhas
const ALCANCE_INTERACAO = 1; // conversar, comprar, pegar saque
const ALCANCE_ARCO = 6; // em linha reta, coluna ou diagonal, sem obstáculos

const TEMPO_RESPAWN_INIMIGO = 5000;
const TEMPO_RESPAWN_COLETAVEL = 18000;
const TEMPO_RESPAWN_PESCA = 12000;
const TEMPO_EXPIRACAO_SAQUE = 10 * 60 * 1000;
const LIMITE_SAQUES_NO_CHAO = 60;
const INTERVALO_LIMPEZA_SAQUES = 5000;

const CURA_POCAO = 30; // mínimo
const CURA_POCAO_PERCENTUAL = 0.25; // da vida máxima
const CURA_POCAO_FE = 40;
const QUANTIDADE_POCOES_INICIAIS = 3;
const QUANTIDADE_ERVAS_MISSAO = 3;
const QUANTIDADE_ODRES_MISSAO = 3;
const QUANTIDADE_VENENOS_MISSAO = 2;
const RECOMPENSA_MISSAO_POCOES = 2;
const CARGA_BASE = 50;
const CARGA_POR_NIVEL = 10;

// Combate: dano bruto = base + 3 por nível acima do 1º + arma + habilidade/4.
// A defesa mitiga em proporção: dano final = bruto × 20 / (20 + defesa), mínimo 1.
const DANO_BASE_CORPO = 6;
const DANO_BASE_DISTANCIA = 4;
const DANO_POR_NIVEL = 3;
const CONSTANTE_DEFESA = 20;
const CRITICO_MINIMO = 5; // % com habilidade 0
const CRITICO_MAXIMO = 25; // % com habilidade 100
const MULTIPLICADOR_CRITICO = 1.5;

// Habilidades: sobem por uso. XP para passar do nível n ao n+1 = 6 + ⌊1,5·n⌋.
const HABILIDADES = ["corpo", "distancia", "defesa", "oracao"];
const NOMES_HABILIDADES = { corpo: "Corpo a corpo", distancia: "Distância", defesa: "Defesa", oracao: "Oração" };
const HABILIDADE_MAXIMA = 100;
const XP_HABILIDADE_POR_USO = { corpo: 2, distancia: 2, defesa: 1, oracao: 3 };

// Fé e Oração
const FE_MAXIMA = 100;
const FE_REGEN_MS = 2000;
const CUSTO_ORACAO = { vida: 20, veneno: 40, area: 60, milagre: 100 };
const NIVEL_ORACAO = { vida: 0, veneno: 25, area: 50, milagre: 100 };
const NOMES_ORACAO = { vida: "Cura de vida", veneno: "Remover veneno", area: "Cura em área", milagre: "Milagre" };

const VENENO_PADRAO = { duracao: 15000, dano: 3, intervalo: 3000 };

// Regra de morte (aplicada em um único lugar: Mundo.aplicarMorte).
const REGRAS_MORTE = [
  { ateNivel: 10, moedas: 0, xpHabilidade: 0, chanceItem: 0 },
  { ateNivel: 25, moedas: 0.1, xpHabilidade: 0, chanceItem: 0 },
  { ateNivel: 50, moedas: 0.1, xpHabilidade: 0.05, chanceItem: 0 },
  { ateNivel: Infinity, moedas: 0.1, xpHabilidade: 0.1, chanceItem: 0.3 },
];

// ---------------------------------------------------------------------
// Itens, loja e equipamento
// ---------------------------------------------------------------------
const ITENS = {
  pocao: { nome: "Poção de vida", peso: 1, tipo: "consumivel" },
  pocao_fe: { nome: "Poção de fé", peso: 1, tipo: "consumivel" },
  erva: { nome: "Erva medicinal", peso: 0.5, tipo: "recurso" },
  odre_agua: { nome: "Odre de água", peso: 3, tipo: "recurso" },
  espada_madeira: { nome: "Espada de madeira", peso: 6, tipo: "arma", bonus: 5 },
  espada_ferro: { nome: "Espada de ferro", peso: 10, tipo: "arma", bonus: 12 },
  espada_temperada: { nome: "Espada temperada", peso: 9, tipo: "arma", bonus: 17 },
  escudo_madeira: { nome: "Escudo de madeira", peso: 5, tipo: "escudo", defesa: 3 },
  escudo_bronze: { nome: "Escudo de bronze", peso: 7, tipo: "escudo", defesa: 5 },
  tunica_pano: { nome: "Túnica de pano", peso: 4, tipo: "armadura", defesa: 2 },
  armadura_couro: { nome: "Armadura de couro", peso: 8, tipo: "armadura", defesa: 5 },
  arco_madeira: { nome: "Arco de madeira", peso: 7, tipo: "arma_distancia", bonus: 10 },
  arco_composto: { nome: "Arco composto", peso: 7, tipo: "arma_distancia", bonus: 15 },
  flecha: { nome: "Flecha", peso: 0.1, tipo: "municao" },
  pele_lobo: { nome: "Pele de lobo", peso: 2, tipo: "recurso" },
  veneno_escorpiao: { nome: "Veneno de escorpião", peso: 0.5, tipo: "recurso" },
  insignia_bandido: { nome: "Insígnia do bando", peso: 0.5, tipo: "recurso" },
  peixe: { nome: "Peixe fresco", peso: 1, tipo: "recurso" },
};
const SLOTS_EQUIPAMENTO = { arma: "arma", arco: "arma_distancia", escudo: "escudo", armadura: "armadura" };
const PRECOS_LOJA = { pocao: 12, pocao_fe: 18, flechas: 8, escudo_madeira: 35, armadura_couro: 65, arco_madeira: 80 };
const FLECHAS_POR_PACOTE = 5;
const VALORES_VENDA = { pele_lobo: 5, erva: 2, odre_agua: 3, peixe: 6 };

function nomeItem(id) {
  return ITENS[id]?.nome || id;
}

function pesoItem(id) {
  return ITENS[id]?.peso ?? 1;
}

function capacidadeCarga(p) {
  return CARGA_BASE + Math.max(0, (p.nivel || 1) - 1) * CARGA_POR_NIVEL;
}

function pesoCarregado(p) {
  const pesoBolsa = p.inventario.reduce((soma, item) => soma + pesoItem(item), 0);
  const pesoEquipado = Object.values(p.equipamento || {}).reduce((soma, item) => soma + (item ? pesoItem(item) : 0), 0);
  return Math.round((pesoBolsa + pesoEquipado) * 10) / 10;
}

function defesaEquipamento(p) {
  return Object.values(p.equipamento || {}).reduce((soma, item) => soma + (item ? ITENS[item]?.defesa || 0 : 0), 0);
}

function curaPocao(p) {
  return Math.max(CURA_POCAO, Math.round(vidaMaxima(p) * CURA_POCAO_PERCENTUAL));
}

function bonusArma(p) {
  const item = p.equipamento?.arma;
  return item ? ITENS[item]?.bonus || 0 : 0;
}

function bonusArco(p) {
  const item = p.equipamento?.arco;
  return item ? ITENS[item]?.bonus || 0 : 0;
}

// ---------------------------------------------------------------------
// Níveis do personagem
// ---------------------------------------------------------------------
function vidaMaxima(personagem) {
  return VIDA_BASE + Math.max(0, (personagem.nivel || 1) - 1) * VIDA_POR_NIVEL;
}

// XP total necessário para sair do nível informado.
function limiarNivel(nivel) {
  if (nivel < XP_NIVEIS.length) return XP_NIVEIS[nivel];
  return XP_NIVEIS[XP_NIVEIS.length - 1] + (nivel - XP_NIVEIS.length + 1) * XP_POR_NIVEL_APOS_TABELA;
}

function adicionarXP(personagem, quantidade) {
  personagem.xp = Math.max(0, (personagem.xp || 0) + quantidade);
  const niveis = [];
  while (personagem.nivel < NIVEL_MAXIMO && personagem.xp >= limiarNivel(personagem.nivel)) {
    personagem.nivel += 1;
    personagem.vida = vidaMaxima(personagem);
    niveis.push(personagem.nivel);
  }
  return niveis;
}

// ---------------------------------------------------------------------
// Habilidades (corpo, distância, defesa, oração)
// ---------------------------------------------------------------------
function nivelHabilidade(p, chave) {
  const n = Math.floor(Number(p.habilidades?.[chave]) || 0);
  return Math.max(0, Math.min(HABILIDADE_MAXIMA, n));
}

// XP para passar do nível n para o n+1.
function xpParaHabilidade(nivel) {
  return 6 + Math.floor((nivel || 0) * 1.5);
}

// XP acumulado necessário para chegar ao nível informado a partir do zero.
function xpTotalAteHabilidade(nivel) {
  let total = 0;
  for (let n = 0; n < nivel; n++) total += xpParaHabilidade(n);
  return total;
}

function ganharHabilidade(p, chave, xp) {
  p.habilidades[chave] = nivelHabilidade(p, chave);
  p.skillXp[chave] = Math.max(0, Number(p.skillXp[chave]) || 0) + xp;
  let subiu = 0;
  while (p.habilidades[chave] < HABILIDADE_MAXIMA && p.skillXp[chave] >= xpParaHabilidade(p.habilidades[chave])) {
    p.skillXp[chave] -= xpParaHabilidade(p.habilidades[chave]);
    p.habilidades[chave]++;
    subiu++;
  }
  if (p.habilidades[chave] >= HABILIDADE_MAXIMA) p.skillXp[chave] = 0;
  return subiu;
}

function progressoHabilidade(p, chave) {
  const nivel = nivelHabilidade(p, chave);
  const maximo = nivel >= HABILIDADE_MAXIMA;
  return {
    chave,
    nome: NOMES_HABILIDADES[chave] || chave,
    nivel,
    xp: maximo ? 0 : Math.floor(p.skillXp?.[chave] || 0),
    necessario: maximo ? 0 : xpParaHabilidade(nivel),
    maximo,
  };
}

// Bônus que a habilidade soma ao dano (corpo/distância) ou à defesa.
function bonusHabilidade(p, chave) {
  const n = nivelHabilidade(p, chave);
  if (chave === "defesa") return Math.floor(n / 5);
  if (chave === "corpo" || chave === "distancia") return Math.floor(n / 4);
  return 0;
}

// ---------------------------------------------------------------------
// Fórmulas de combate (puras)
// ---------------------------------------------------------------------
function defesaTotal(p) {
  return defesaEquipamento(p) + bonusHabilidade(p, "defesa");
}

function danoBruto(p, tipo) {
  const nivel = Math.max(1, p.nivel || 1);
  const porNivel = (nivel - 1) * DANO_POR_NIVEL;
  if (tipo === "distancia") return DANO_BASE_DISTANCIA + porNivel + bonusArco(p) + bonusHabilidade(p, "distancia");
  return DANO_BASE_CORPO + porNivel + bonusArma(p) + bonusHabilidade(p, "corpo");
}

// Chance de crítico em % (5% com habilidade 0 até 25% com habilidade 100).
function chanceCritico(p, tipo) {
  const n = nivelHabilidade(p, tipo === "distancia" ? "distancia" : "corpo");
  return CRITICO_MINIMO + ((CRITICO_MAXIMO - CRITICO_MINIMO) * n) / HABILIDADE_MAXIMA;
}

function mitigarDano(dano, defesa) {
  const d = Math.max(0, defesa || 0);
  return Math.max(1, Math.round((dano * CONSTANTE_DEFESA) / (CONSTANTE_DEFESA + d)));
}

function calcularGolpe(p, tipo, defesaAlvo, aleatorio = Math.random()) {
  const bruto = danoBruto(p, tipo);
  const critico = aleatorio < chanceCritico(p, tipo) / 100;
  const comCritico = critico ? Math.round(bruto * MULTIPLICADOR_CRITICO) : bruto;
  return { bruto: comCritico, critico, dano: mitigarDano(comCritico, defesaAlvo) };
}

// Números que o painel deve mostrar (mesma fórmula usada nos golpes).
function estatisticasCombate(p) {
  const defesaHab = bonusHabilidade(p, "defesa");
  const defEquip = defesaEquipamento(p);
  const habilidades = {};
  for (const chave of HABILIDADES) habilidades[chave] = progressoHabilidade(p, chave);
  return {
    nivel: p.nivel || 1,
    vida: p.vida,
    vidaMaxima: vidaMaxima(p),
    danoCorpo: danoBruto(p, "corpo"),
    danoDistancia: p.equipamento?.arco ? danoBruto(p, "distancia") : 0,
    temArco: !!p.equipamento?.arco,
    flechas: (p.inventario || []).filter((x) => x === "flecha").length,
    defesa: defEquip + defesaHab,
    defesaEquipamento: defEquip,
    defesaHabilidade: defesaHab,
    reducaoDano: Math.round((1 - CONSTANTE_DEFESA / (CONSTANTE_DEFESA + defEquip + defesaHab)) * 100),
    critico: Math.round(chanceCritico(p, "corpo") * 10) / 10,
    criticoCorpo: Math.round(chanceCritico(p, "corpo") * 10) / 10,
    criticoDistancia: Math.round(chanceCritico(p, "distancia") * 10) / 10,
    multiplicadorCritico: MULTIPLICADOR_CRITICO,
    alcanceArco: ALCANCE_ARCO,
    recargaAtaque: RECARGA_ATAQUE,
    intervaloAutoAtaque: INTERVALO_AUTO_ATAQUE,
    habilidades,
  };
}

// ---------------------------------------------------------------------
// Regra de morte
// ---------------------------------------------------------------------
function regraMorte(nivel) {
  return REGRAS_MORTE.find((r) => (nivel || 1) <= r.ateNivel);
}

function descreverRegraMorte(nivel) {
  const r = regraMorte(nivel);
  if (!r.moedas) return "Sem penalidade até o nível 10: moedas, itens e habilidades foram preservados.";
  const partes = [`perde ${Math.round(r.moedas * 100)}% das moedas`];
  if (r.xpHabilidade) partes.push(`${Math.round(r.xpHabilidade * 100)}% do XP de cada habilidade (sem cair de nível)`);
  if (r.chanceItem) partes.push(`${Math.round(r.chanceItem * 100)}% de chance de deixar cair um item da mochila`);
  return `No nível ${nivel}, a morte ${partes.join(", ")}.`;
}

// ---------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------
function distanciaChebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function dentroDoMapa(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < COLS && y < ROWS;
}

// ---------------------------------------------------------------------
// Áreas e mapas base
// ---------------------------------------------------------------------
const areas = {
  canaan: {
    id: "canaan",
    nome: "Canaã",
    inicio: { x: 2, y: 2 },
    passagem: { x: 77, y: 56 },
    chegada: { x: 75, y: 56 },
    cais: { x: 40, y: 2 },
    chegadaViagem: { x: 8, y: 6 },
  },
  deserto: {
    id: "deserto",
    nome: "Deserto",
    inicio: { x: 4, y: 56 },
    passagem: { x: 2, y: 56 },
    chegada: { x: 4, y: 56 },
    cais: { x: 40, y: 2 },
    chegadaViagem: { x: 65, y: 12 },
  },
  mar: {
    id: "mar",
    nome: "Mar das Rotas",
    inicio: { x: 3, y: 30 },
    caisCanaa: { x: 2, y: 30 },
    caisDeserto: { x: 77, y: 30 },
  },
};

function criarMapa(areaId) {
  const mapa = [];
  for (let y = 0; y < ROWS; y++) {
    mapa[y] = [];
    for (let x = 0; x < COLS; x++) {
      const borda = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      let obstaculo = false;
      if (areaId === "canaan") {
        obstaculo = x % 6 === 3 && y % 4 === 2;
      } else if (areaId === "deserto") {
        obstaculo = (x * 7 + y * 11) % 23 === 0;
      } else {
        obstaculo = x > 7 && x < COLS - 8 && y > 4 && y < ROWS - 5 && (x * 17 + y * 23) % 41 === 0;
      }
      mapa[y][x] = borda || obstaculo ? 1 : 0;
    }
  }
  return mapa;
}

const mapas = { canaan: criarMapa("canaan"), deserto: criarMapa("deserto"), mar: criarMapa("mar") };

// Abre uma casa (nunca a borda do mapa).
function abrirCasa(areaId, x, y) {
  const mapa = mapas[areaId];
  if (!mapa || x < 1 || y < 1 || x > COLS - 2 || y > ROWS - 2) return;
  mapa[y][x] = 0;
}

// Abre a casa e as 8 vizinhas, para que NPCs e inimigos tenham espaço em volta.
function abrirClareira(areaId, x, y, raio = 1) {
  for (let dy = -raio; dy <= raio; dy++) for (let dx = -raio; dx <= raio; dx++) abrirCasa(areaId, x + dx, y + dy);
}

function registrarArea(area, mapa) {
  areas[area.id] = area;
  mapas[area.id] = mapa;
  for (const ponto of [area.inicio, area.chegada, area.passagem]) if (ponto) abrirCasa(area.id, ponto.x, ponto.y);
}

// ---------------------------------------------------------------------
// NPCs, coletáveis, pesca e inimigos base
// ---------------------------------------------------------------------
// papel: "missao" (Eliabe/Noemi), "loja", "guia", ou, nos capítulos,
// "lider" (dá a missão), "apoio" (só conversa) e "mestre" (ensina a Oração).
const npcs = {};

function registrarNpc(npc) {
  npcs[npc.id] = npc;
  abrirClareira(npc.area, npc.x, npc.y, 1);
  return npc;
}

registrarNpc({ id: "viajante1", nome: "Eliabe", area: "canaan", x: 5, y: 5, papel: "missao" });
registrarNpc({ id: "guia_canaa", nome: "Micael, guia de caravanas", area: "canaan", x: 9, y: 5, papel: "guia" });
registrarNpc({ id: "noemi1", nome: "Noemi", area: "deserto", x: 68, y: 8, papel: "missao" });
registrarNpc({ id: "mercador1", nome: "Azarias, mercador", area: "deserto", x: 72, y: 10, papel: "loja" });
registrarNpc({ id: "guia_deserto", nome: "Tamar, guia de caravanas", area: "deserto", x: 66, y: 12, papel: "guia" });

const pontosPesca = [
  { id: "pesca1", x: 18, y: 15 },
  { id: "pesca2", x: 40, y: 42 },
  { id: "pesca3", x: 62, y: 18 },
  { id: "pesca4", x: 49, y: 32 },
];

// Ervas só existem em Canaã e odres só no Deserto.
const ervas = [
  { id: "erva1", x: 13, y: 12 },
  { id: "erva2", x: 41, y: 31 },
  { id: "erva3", x: 71, y: 49 },
];
const odres = [
  { id: "odre1", x: 11, y: 48 },
  { id: "odre2", x: 39, y: 34 },
  { id: "odre3", x: 70, y: 15 },
];
const COLETAVEIS_POR_AREA = {
  canaan: { lista: ervas, item: "erva", textura: "erva", respawn: "ervasRespawn", coletados: "ervasColetadas" },
  deserto: { lista: odres, item: "odre_agua", textura: "odre", respawn: "odresRespawn", coletados: "odresColetados" },
};

// Lista pronta para renderização: [{ id, x, y, item, textura }].
function coletaveisDaArea(areaId) {
  const grupo = COLETAVEIS_POR_AREA[areaId];
  if (!grupo) return [];
  return grupo.lista.map((c) => ({ id: c.id, x: c.x, y: c.y, item: grupo.item, textura: grupo.textura }));
}

const inimigos = {};

// Campos: vidaMaxima, danoContraJogador (antes da defesa), defesa, raioPercepcao,
// xpRecompensa, saque { itens, moedas }, veneno opcional e aparencia (dica visual).
function registrarInimigo(dados) {
  const e = {
    ...dados,
    x: dados.x,
    y: dados.y,
    inicioX: dados.x,
    inicioY: dados.y,
    defesa: dados.defesa || 0,
    saque: dados.saque || { itens: [], moedas: 0 },
    proximoMovimento: 0,
    proximoAtaque: 0,
  };
  inimigos[e.id] = e;
  abrirClareira(e.area, e.x, e.y, 1);
  return e;
}

// Lobo longe da vila de Eliabe e Micael.
registrarInimigo({
  id: "lobo1",
  nome: "Lobo",
  aparencia: "lobo",
  area: "canaan",
  x: 22,
  y: 15,
  vidaMaxima: 70,
  danoContraJogador: 6,
  defesa: 2,
  raioPercepcao: 6,
  xpRecompensa: 40,
  saque: { itens: ["pele_lobo"], moedas: 4 },
});
registrarInimigo({
  id: "escorpiao1",
  nome: "Escorpião",
  aparencia: "escorpiao",
  area: "deserto",
  x: 16,
  y: 9,
  vidaMaxima: 130,
  danoContraJogador: 9,
  defesa: 4,
  raioPercepcao: 5,
  xpRecompensa: 60,
  saque: { itens: ["veneno_escorpiao"], moedas: 8 },
  veneno: { ...VENENO_PADRAO },
});
registrarInimigo({
  id: "bandido1",
  nome: "Chefe dos saqueadores",
  aparencia: "bandido",
  area: "deserto",
  x: 49,
  y: 46,
  vidaMaxima: 190,
  danoContraJogador: 10,
  defesa: 6,
  raioPercepcao: 6,
  xpRecompensa: 100,
  saque: { itens: ["insignia_bandido"], moedas: 15 },
});

// Trilhas terrestres contínuas e acessos aos cais.
for (let x = 2; x <= 77; x++) {
  mapas.canaan[56][x] = 0;
  mapas.deserto[56][x] = 0;
  mapas.canaan[2][x] = 0;
}
for (let y = 2; y <= 56; y++) {
  mapas.canaan[y][2] = 0;
  mapas.deserto[y][40] = 0;
}
for (let x = 40; x <= 77; x++) mapas.deserto[2][x] = 0;
for (let x = 1; x <= 78; x++) mapas.mar[30][x] = 0;
for (const ponto of pontosPesca) abrirCasa("mar", ponto.x, ponto.y);
for (const [areaId, grupo] of Object.entries(COLETAVEIS_POR_AREA))
  for (const c of grupo.lista) abrirCasa(areaId, c.x, c.y);
for (const area of Object.values(areas)) {
  for (const ponto of [area.inicio, area.passagem, area.chegada, area.chegadaViagem]) {
    if (ponto) abrirCasa(area.id, ponto.x, ponto.y);
  }
  if (area.cais) {
    abrirCasa(area.id, area.cais.x, area.cais.y);
    abrirCasa(area.id, area.cais.x, area.cais.y + 1);
  }
}

// ---------------------------------------------------------------------
// Capítulos e portais (preenchidos por expansao.js)
// ---------------------------------------------------------------------
const CAPITULOS = {};
const ORDEM_CAPITULOS = [];
const PORTAIS = [];

function registrarCapitulo(chave, dados) {
  CAPITULOS[chave] = dados;
  if (!ORDEM_CAPITULOS.includes(chave)) ORDEM_CAPITULOS.push(chave);
}

function registrarPortal(portal) {
  PORTAIS.push(portal);
  abrirCasa(portal.area, portal.x, portal.y);
  abrirCasa(portal.destino, portal.chegada.x, portal.chegada.y);
}

function capituloDoInimigo(inimigoId) {
  return ORDEM_CAPITULOS.find((k) => CAPITULOS[k].inimigo === inimigoId) || null;
}

function capituloAnteriorConcluido(p, chave) {
  const anterior = CAPITULOS[chave]?.anterior;
  if (!anterior) return true;
  if (anterior === "deserto") return p.missaoDeserto?.status === "concluida";
  return p.capitulos?.[anterior]?.status === "concluida";
}

// Fase do capítulo do ponto de vista do jogador.
function faseCapitulo(p, chave) {
  if (!capituloAnteriorConcluido(p, chave)) return "bloqueado";
  const c = p.capitulos?.[chave];
  if (!c || c.status === "bloqueado") return "inicio";
  if (c.status === "em_andamento") return c.alvo ? "retorno" : "andamento";
  return "concluido";
}

// ---------------------------------------------------------------------
// Textos de missão (para a UI)
// ---------------------------------------------------------------------
function textoMissaoCanaa(p) {
  const m1 = p.missaoEliabe;
  const m2 = p.missaoErvas;
  if (m1.status === "nao_iniciada") return "Fale com Eliabe, na vila ao lado do ponto de partida.";
  if (m1.status === "em_andamento") {
    return m1.loboDerrotado
      ? "Volte a Eliabe para receber a recompensa."
      : "Derrote o lobo a sudeste da vila e volte a Eliabe.";
  }
  if (m2.status === "bloqueada") return "Fale com Eliabe para a próxima tarefa.";
  if (m2.status === "em_andamento") {
    const n = Math.min(QUANTIDADE_ERVAS_MISSAO, m2.ervasMissaoColetadas.length);
    return n >= QUANTIDADE_ERVAS_MISSAO
      ? "Leve as 3 ervas a Eliabe."
      : `Colete ervas medicinais: ${n}/${QUANTIDADE_ERVAS_MISSAO}.`;
  }
  if (p.missaoDeserto.status !== "concluida") {
    return "Tarefas de Canaã concluídas. Siga a trilha (sudeste) ou fale com Micael para ir ao Deserto.";
  }
  return "Tarefas de Canaã concluídas.";
}

function textoMissaoDeserto(p) {
  const m = p.missaoDeserto;
  if (m.status === "bloqueada") return "Encontre Noemi no acampamento a nordeste.";
  if (m.status === "concluida") {
    const prox = ORDEM_CAPITULOS.find((k) => CAPITULOS[k].anterior === "deserto");
    if (prox && p.capitulos?.[prox]?.status !== "concluida") {
      return `Capítulo concluído. Siga a rota a leste da trilha até ${CAPITULOS[prox].nome}.`;
    }
    return "Capítulo do Deserto concluído.";
  }
  if (m.etapa === 1) {
    return `Etapa 1/3 · Encontre odres de água: ${Math.min(3, m.odresMissaoColetados.length)}/${QUANTIDADE_ODRES_MISSAO}.`;
  }
  if (m.etapa === 2) {
    return `Etapa 2/3 · Veneno de escorpião: ${Math.min(2, m.venenosMissaoColetados.length)}/${QUANTIDADE_VENENOS_MISSAO}.`;
  }
  return `Etapa 3/3 · Insígnia do chefe dos saqueadores: ${Math.min(1, m.insigniasMissaoColetadas.length)}/1.`;
}

function textoMissaoCapitulo(p, chave) {
  const cap = CAPITULOS[chave];
  const lider = npcs[cap.npc]?.nome || "o líder";
  const fase = faseCapitulo(p, chave);
  if (fase === "bloqueado") return "Conclua o capítulo anterior para avançar aqui.";
  if (fase === "inicio") return `Fale com ${lider} para iniciar.`;
  if (fase === "andamento") return cap.objetivo;
  if (fase === "retorno") return `Objetivo cumprido. Volte a ${lider}.`;
  if (cap.mestre) {
    if (!p.oracaoDesbloqueada) return `Converse com ${npcs[cap.mestre]?.nome || "o Mestre"} para aprender a Oração.`;
    return "Oração aprendida — F1 para orar.";
  }
  const indice = ORDEM_CAPITULOS.indexOf(chave);
  const prox = ORDEM_CAPITULOS[indice + 1];
  if (prox && p.capitulos?.[prox]?.status !== "concluida") {
    return `Capítulo concluído. Siga a rota a leste até ${CAPITULOS[prox].nome}.`;
  }
  return "Capítulo concluído.";
}

// Texto curto "Área · objetivo" para TODAS as áreas.
function textoMissaoAtual(p) {
  if (!p) return "";
  const nome = areas[p.area]?.nome || p.area;
  let texto;
  if (p.area === "canaan") texto = textoMissaoCanaa(p);
  else if (p.area === "deserto") texto = textoMissaoDeserto(p);
  else if (p.area === "mar") {
    texto = "Pesque nos pontos marcados (P) ou navegue até um cais: Canaã a oeste, Deserto a leste.";
  } else if (CAPITULOS[p.area]) texto = textoMissaoCapitulo(p, p.area);
  else texto = "Explore a região.";
  return `${nome} · ${texto}`;
}

// ---------------------------------------------------------------------
// Estado inicial das missões
// ---------------------------------------------------------------------
function missaoEliabeNova() {
  return { status: "nao_iniciada", loboDerrotado: false, recompensaRecebida: false };
}

function missaoErvasNova() {
  return { status: "bloqueada", recompensaRecebida: false, ervasMissaoColetadas: [] };
}

function missaoDesertoNova() {
  return {
    status: "bloqueada",
    etapa: 0,
    recompensaRecebida: false,
    odresMissaoColetados: [],
    venenosMissaoColetados: [],
    insigniasMissaoColetadas: [],
  };
}

function personagemNovo(id) {
  return {
    id,
    area: "canaan",
    x: areas.canaan.inicio.x,
    y: areas.canaan.inicio.y,
    vida: VIDA_BASE,
    inventario: [],
    itensIniciaisEntregues: false,
    inimigosDerrotados: [],
    vidaInimigos: {},
    ervasColetadas: [],
    odresColetados: [],
    ervasRespawn: {},
    odresRespawn: {},
    pescaRespawn: {},
    xp: 0,
    nivel: 1,
    moedas: 30,
    economiaInicialEntregue: true,
    habilidades: { corpo: 0, distancia: 0, defesa: 0, oracao: 0 },
    skillXp: { corpo: 0, distancia: 0, defesa: 0, oracao: 0 },
    mortes: 0,
  };
}

function objetoValido(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// ---------------------------------------------------------------------
// Mundo
// ---------------------------------------------------------------------
const Mundo = {
  jogadores: {},
  estado: {},

  salvar(p) {
    p.versao = VERSAO_SAVE;
    Storage.salvar(p);
  },

  // ----- Entrada e migração de saves -----
  entrar(id) {
    const salvo = Storage.carregar(id);
    const novo = !objetoValido(salvo);
    const p = novo ? personagemNovo(id) : salvo;
    this.migrar(p, id, novo);
    for (const e of Object.values(inimigos)) {
      e.x = e.inicioX;
      e.y = e.inicioY;
      e.proximoMovimento = 0;
      e.proximoAtaque = 0;
    }
    this.jogadores[id] = p;
    this.estado[id] = {
      proximaRegen: Date.now() + TEMPO_REGEN,
      ultimoCombate: 0,
      proximoAtaqueJogador: 0,
      proximaLimpezaSaques: 0,
    };
    this.limparSaques(p, Date.now());
    this.salvar(p);
    return p;
  },

  migrar(p, id, novo) {
    const agora = Date.now();
    const versaoAnterior = Number(p.versao) || 0;
    p.id = id;
    if (!Array.isArray(p.inventario)) p.inventario = [];
    p.inventario = p.inventario.filter((item) => typeof item === "string" && ITENS[item]);

    if (!p.economiaInicialEntregue) {
      p.moedas = Math.max(0, Number(p.moedas) || 0) + 30;
      p.economiaInicialEntregue = true;
    }
    p.moedas = Number.isFinite(p.moedas) ? Math.max(0, Math.floor(p.moedas)) : 30;
    p.mortes = Number.isInteger(p.mortes) ? Math.max(0, p.mortes) : 0;
    p.nivel = Number.isInteger(p.nivel) ? Math.max(1, Math.min(NIVEL_MAXIMO, p.nivel)) : 1;
    p.xp = Number.isFinite(p.xp) ? Math.max(0, p.xp) : 0;

    // Habilidades e XP de habilidade.
    if (!objetoValido(p.habilidades)) p.habilidades = {};
    if (!objetoValido(p.skillXp)) p.skillXp = {};
    for (const chave of HABILIDADES) {
      p.habilidades[chave] = nivelHabilidade(p, chave);
      p.skillXp[chave] = Number.isFinite(p.skillXp[chave]) ? Math.max(0, p.skillXp[chave]) : 0;
      ganharHabilidade(p, chave, 0); // aplica a curva atual ao progresso guardado
    }

    // Equipamento e atalhos.
    if (!objetoValido(p.equipamento)) p.equipamento = { arma: null, arco: null, escudo: null, armadura: null };
    for (const slot of Object.keys(SLOTS_EQUIPAMENTO)) if (!(slot in p.equipamento)) p.equipamento[slot] = null;
    for (const [slot, tipo] of Object.entries(SLOTS_EQUIPAMENTO)) {
      const item = p.equipamento[slot];
      if (item && ITENS[item]?.tipo !== tipo) {
        if (ITENS[item]) p.inventario.push(item);
        p.equipamento[slot] = null;
      }
    }
    // Espada e arco são exclusivos: mantém a espada e guarda o arco.
    if (p.equipamento.arma && p.equipamento.arco) {
      p.inventario.push(p.equipamento.arco);
      p.equipamento.arco = null;
    }
    if (!Array.isArray(p.hotkeys)) p.hotkeys = ["pocao", null, null, null, null, null];
    p.hotkeys = Array.from({ length: 6 }, (_, i) => (ITENS[p.hotkeys[i]] ? p.hotkeys[i] : null));

    // Listas e mapas de respawn.
    for (const chave of ["inimigosDerrotados", "ervasColetadas", "odresColetados"]) {
      if (!Array.isArray(p[chave])) p[chave] = [];
    }
    for (const chave of ["ervasRespawn", "odresRespawn", "pescaRespawn", "vidaInimigos"]) {
      if (!objetoValido(p[chave])) p[chave] = {};
    }

    // Saques no chão.
    if (!Array.isArray(p.saqueNoChao)) p.saqueNoChao = [];
    p.saqueNoChao = p.saqueNoChao.filter(
      (s) =>
        objetoValido(s) &&
        typeof s.id === "string" &&
        areas[s.area] &&
        Number.isInteger(s.x) &&
        Number.isInteger(s.y) &&
        ((Number.isInteger(s.moedas) && s.moedas > 0) || ITENS[s.item]),
    );
    for (const s of p.saqueNoChao) if (!Number.isFinite(s.criadoEm)) s.criadoEm = agora;

    // Itens iniciais (uma única vez).
    if (!p.itensIniciaisEntregues) {
      for (let i = 0; i < QUANTIDADE_POCOES_INICIAIS; i++) p.inventario.push("pocao");
      p.itensIniciaisEntregues = true;
    }
    // Equipamento inicial já vem vestido (nos espaços vazios), para a primeira luta ser justa.
    if (!p.equipamentoInicialEntregue) {
      for (const [item, slot] of [
        ["espada_madeira", "arma"],
        ["escudo_madeira", "escudo"],
        ["tunica_pano", "armadura"],
      ]) {
        const livre = !p.equipamento[slot] && !(slot === "arma" && p.equipamento.arco);
        if (livre) p.equipamento[slot] = item;
        else p.inventario.push(item);
      }
      p.equipamentoInicialEntregue = true;
    }

    // Missões de Canaã e Deserto.
    const missoes = [
      ["missaoEliabe", missaoEliabeNova, ["nao_iniciada", "em_andamento", "concluida"], "nao_iniciada"],
      ["missaoErvas", missaoErvasNova, ["bloqueada", "em_andamento", "concluida"], "bloqueada"],
      ["missaoDeserto", missaoDesertoNova, ["bloqueada", "em_andamento", "concluida"], "bloqueada"],
    ];
    for (const [chave, nova, permitidos, padrao] of missoes) {
      if (!objetoValido(p[chave])) p[chave] = nova();
      const modelo = nova();
      for (const [campo, valor] of Object.entries(modelo)) if (!(campo in p[chave])) p[chave][campo] = valor;
      if (!permitidos.includes(p[chave].status)) p[chave].status = padrao;
      if (typeof p[chave].recompensaRecebida !== "boolean") p[chave].recompensaRecebida = false;
    }
    if (typeof p.missaoEliabe.loboDerrotado !== "boolean") p.missaoEliabe.loboDerrotado = false;
    if (!Array.isArray(p.missaoErvas.ervasMissaoColetadas)) p.missaoErvas.ervasMissaoColetadas = [];
    const md = p.missaoDeserto;
    if (!Number.isInteger(md.etapa)) md.etapa = md.status === "concluida" ? 4 : md.status === "em_andamento" ? 1 : 0;
    for (const lista of ["odresMissaoColetados", "venenosMissaoColetados", "insigniasMissaoColetadas"]) {
      if (!Array.isArray(md[lista])) md[lista] = [];
    }

    // Capítulos da expansão.
    if (!objetoValido(p.capitulos)) p.capitulos = {};
    for (const chave of ORDEM_CAPITULOS) {
      const c = objetoValido(p.capitulos[chave]) ? p.capitulos[chave] : { status: "bloqueado", alvo: false };
      if (!["bloqueado", "em_andamento", "concluida"].includes(c.status)) c.status = "bloqueado";
      c.alvo = c.alvo === true;
      p.capitulos[chave] = c;
    }

    // Fé, Oração e veneno.
    p.oracaoDesbloqueada = !!p.oracaoDesbloqueada;
    p.fe = Number.isFinite(p.fe) ? Math.max(0, Math.min(FE_MAXIMA, Math.floor(p.fe))) : FE_MAXIMA;
    p.envenenadoAte = Number.isFinite(p.envenenadoAte) && p.envenenadoAte > agora ? p.envenenadoAte : 0;
    p.proximoDanoVeneno = p.envenenadoAte && Number.isFinite(p.proximoDanoVeneno) ? p.proximoDanoVeneno : 0;
    if (!p.envenenadoAte) p.venenoAtual = null;
    delete p.proximaRegenFe;

    // Avisos pendentes para a UI (exibidos uma vez via Mundo.consumirAviso).
    if (!Array.isArray(p.avisosPendentes)) p.avisosPendentes = [];
    p.avisosPendentes = p.avisosPendentes.filter((a) => objetoValido(a) && typeof a.texto === "string");
    if (typeof p.avisoAtualizacao === "string") {
      this.adicionarAviso(
        p,
        "recompensa_arco",
        "Nova recompensa: Arco de madeira e flechas. Arraste o arco até o espaço Arco do equipamento e use R para atirar.",
      );
    }
    delete p.avisoAtualizacao;

    // Saves antigos que já concluíram o Deserto recebem o arco uma única vez.
    if (md.status === "concluida" && !p.atualizacaoDistanciaEntregue) {
      if (!p.equipamento.arco && !p.inventario.includes("arco_madeira")) this.adicionarItem(p, "arco_madeira");
      for (let i = 0; i < 8; i++) if (!this.adicionarItem(p, "flecha")) break;
      p.atualizacaoDistanciaEntregue = true;
      this.adicionarAviso(
        p,
        "recompensa_arco",
        "Nova recompensa: Arco de madeira e flechas. Arraste o arco até o espaço Arco do equipamento e use R para atirar.",
      );
    }
    if (!novo && versaoAnterior < 6) {
      this.adicionarAviso(
        p,
        "atualizacao_6",
        "Jornada atualizada: combate rebalanceado (nível, arma e habilidade contam no dano), capítulos do Egito à Galileia corrigidos e regras de morte unificadas. Veja a Ajuda.",
      );
    }

    // Vida e posição.
    const maxVida = vidaMaxima(p);
    p.vida = Number.isFinite(p.vida) ? Math.max(0, Math.min(Math.round(p.vida), maxVida)) : maxVida;
    if (!areas[p.area]) {
      p.area = "canaan";
      p.x = areas.canaan.inicio.x;
      p.y = areas.canaan.inicio.y;
    }
    if (p.vida <= 0) {
      p.area = "canaan";
      p.x = areas.canaan.inicio.x;
      p.y = areas.canaan.inicio.y;
      p.vida = maxVida;
    }
    // Se o mapa mudou e o jogador ficou sobre um obstáculo ou NPC, volta ao início da área.
    if (!dentroDoMapa(p.x, p.y) || mapas[p.area][p.y][p.x] !== 0 || this.npcEm(p.area, p.x, p.y)) {
      const inicio = areas[p.area].inicio || areas.canaan.inicio;
      p.x = inicio.x;
      p.y = inicio.y;
    }

    // Vida dos inimigos.
    for (const e of Object.values(inimigos)) {
      const hp = p.vidaInimigos[e.id];
      if (p.inimigosDerrotados.includes(e.id)) p.vidaInimigos[e.id] = 0;
      else p.vidaInimigos[e.id] = Number.isFinite(hp) && hp > 0 ? Math.min(hp, e.vidaMaxima) : e.vidaMaxima;
    }
    p.versao = VERSAO_SAVE;
    return p;
  },

  // ----- Avisos para a UI -----
  adicionarAviso(p, avisoId, texto) {
    if (!Array.isArray(p.avisosPendentes)) p.avisosPendentes = [];
    if (p.avisosPendentes.some((a) => a.id === avisoId)) return;
    p.avisosPendentes.push({ id: avisoId, texto });
  },

  avisosPendentes(id) {
    return (this.jogadores[id]?.avisosPendentes || []).map((a) => a.texto);
  },

  // Retorna o próximo aviso (texto) e o remove; null se não houver.
  consumirAviso(id) {
    const p = this.jogadores[id];
    if (!p || !p.avisosPendentes?.length) return null;
    const aviso = p.avisosPendentes.shift();
    this.salvar(p);
    return aviso.texto;
  },

  // ----- Consultas -----
  inimigoVivo(p, inimigoId) {
    return !p.inimigosDerrotados.includes(inimigoId) && p.vidaInimigos[inimigoId] > 0;
  },

  obterVidaInimigo(id, inimigoId) {
    const p = this.jogadores[id];
    const e = inimigos[inimigoId];
    if (!p || !e) return null;
    return p.inimigosDerrotados.includes(inimigoId) ? 0 : p.vidaInimigos[inimigoId];
  },

  contarItem(id, item) {
    const p = this.jogadores[id];
    return p ? p.inventario.filter((x) => x === item).length : 0;
  },

  // Só é verdadeiro para coletáveis que pertencem à área informada.
  coletavelDisponivel(id, area, itemId) {
    const p = this.jogadores[id];
    const grupo = COLETAVEIS_POR_AREA[area];
    if (!p || !grupo || !grupo.lista.some((c) => c.id === itemId)) return false;
    const tempos = p[grupo.respawn];
    return !tempos?.[itemId] || Date.now() >= tempos[itemId];
  },

  pescaDisponivel(id, pontoId) {
    const p = this.jogadores[id];
    return !!p && (!p.pescaRespawn?.[pontoId] || Date.now() >= p.pescaRespawn[pontoId]);
  },

  // Milissegundos até o próximo ataque manual ser aceito.
  recargaAtaque(id) {
    const estado = this.estado[id];
    return estado ? Math.max(0, estado.proximoAtaqueJogador - Date.now()) : 0;
  },

  npcEm(area, x, y) {
    return Object.values(npcs).some((n) => n.area === area && n.x === x && n.y === y);
  },

  npcProximo(p, filtro = () => true) {
    return Object.values(npcs).find(
      (n) => n.area === p.area && distanciaChebyshev(p, n) <= ALCANCE_INTERACAO && filtro(n),
    );
  },

  casaLivre(x, y, p, ignorarJogador = false) {
    if (!mapas[p.area]?.[y] || mapas[p.area][y][x] !== 0) return false;
    if (!ignorarJogador && p.x === x && p.y === y) return false;
    if (this.npcEm(p.area, x, y)) return false;
    return !Object.values(inimigos).some(
      (e) => e.area === p.area && this.inimigoVivo(p, e.id) && e.x === x && e.y === y,
    );
  },

  // ----- Inventário -----
  adicionarItem(p, item) {
    if (!ITENS[item] || pesoCarregado(p) + pesoItem(item) > capacidadeCarga(p) + 0.0001) return false;
    p.inventario.push(item);
    return true;
  },

  podeReceberComRemocao(p, recompensas, remocoes = []) {
    let peso = pesoCarregado(p);
    for (const [item, quantidade] of remocoes) peso -= pesoItem(item) * quantidade;
    for (const item of recompensas) peso += pesoItem(item);
    return peso <= capacidadeCarga(p) + 0.0001;
  },

  // Remove até "quantidade" unidades; retorna quantas foram removidas.
  removerItens(p, item, quantidade) {
    let restante = quantidade;
    p.inventario = p.inventario.filter((x) => {
      if (x === item && restante > 0) {
        restante--;
        return false;
      }
      return true;
    });
    return quantidade - restante;
  },

  mensagemMochilaCheia(p, complemento) {
    return `Mochila cheia (${pesoCarregado(p)}/${capacidadeCarga(p)} kg). ${complemento}`;
  },

  equiparItem(id, itemId, slot) {
    const p = this.jogadores[id];
    const tipo = SLOTS_EQUIPAMENTO[slot];
    if (!p || !tipo || ITENS[itemId]?.tipo !== tipo)
      return { ok: false, mensagem: "Esse item não serve neste espaço." };
    const indice = p.inventario.indexOf(itemId);
    if (indice < 0) return { ok: false, mensagem: "O item não está na mochila." };
    const slotIncompativel = slot === "arma" ? "arco" : slot === "arco" ? "arma" : null;
    if (slotIncompativel && p.equipamento[slotIncompativel]) {
      p.inventario.push(p.equipamento[slotIncompativel]);
      p.equipamento[slotIncompativel] = null;
    }
    const anterior = p.equipamento[slot];
    p.inventario.splice(indice, 1);
    if (anterior) p.inventario.push(anterior);
    p.equipamento[slot] = itemId;
    this.salvar(p);
    const d = ITENS[itemId];
    const efeito = d.bonus ? `+${d.bonus} de dano` : `+${d.defesa || 0} de defesa`;
    return { ok: true, mensagem: `${nomeItem(itemId)} equipado (${efeito}).` };
  },

  desequiparItem(id, slot) {
    const p = this.jogadores[id];
    const item = p?.equipamento?.[slot];
    if (!item) return { ok: false };
    p.inventario.push(item);
    p.equipamento[slot] = null;
    this.salvar(p);
    return { ok: true, mensagem: `${nomeItem(item)} voltou para a mochila.` };
  },

  atribuirHotkey(id, indice, item) {
    const p = this.jogadores[id];
    if (!p || indice < 0 || indice > 5) return { ok: false };
    if (item && (ITENS[item]?.tipo !== "consumivel" || !p.inventario.includes(item))) {
      return { ok: false, mensagem: "A hotkey aceita consumíveis que estejam na mochila." };
    }
    p.hotkeys[indice] = item || null;
    this.salvar(p);
    return { ok: true };
  },

  alternarEquipamento(id, slot) {
    const p = this.jogadores[id];
    const tipo = SLOTS_EQUIPAMENTO[slot];
    if (!tipo) return { ok: false, mensagem: "Espaço de equipamento inválido." };
    const atual = p.equipamento[slot];
    const valor = (item) => ITENS[item].bonus || ITENS[item].defesa || 0;
    const candidatos = p.inventario.filter((item) => ITENS[item]?.tipo === tipo).sort((a, b) => valor(b) - valor(a));
    if (atual && candidatos.length) {
      const escolhido = candidatos[0];
      p.inventario[p.inventario.indexOf(escolhido)] = atual;
      p.equipamento[slot] = escolhido;
      this.salvar(p);
      return { ok: true, mensagem: `Equipado: ${nomeItem(escolhido)}. ${nomeItem(atual)} foi para a mochila.` };
    }
    if (atual) {
      p.inventario.push(atual);
      p.equipamento[slot] = null;
      this.salvar(p);
      return { ok: true, mensagem: `Você guardou ${nomeItem(atual)} na mochila.` };
    }
    if (!candidatos.length) return { ok: false, mensagem: `Você não tem item para equipar no espaço: ${slot}.` };
    const escolhido = candidatos[0];
    const slotIncompativel = slot === "arma" ? "arco" : slot === "arco" ? "arma" : null;
    const trocou = !!(slotIncompativel && p.equipamento[slotIncompativel]);
    if (trocou) {
      p.inventario.push(p.equipamento[slotIncompativel]);
      p.equipamento[slotIncompativel] = null;
    }
    p.inventario.splice(p.inventario.indexOf(escolhido), 1);
    p.equipamento[slot] = escolhido;
    this.salvar(p);
    const aviso = trocou ? " Espada e arco não podem ser usados ao mesmo tempo; o outro foi para a mochila." : "";
    return { ok: true, mensagem: `Equipado: ${nomeItem(escolhido)}.${aviso}` };
  },

  // ----- Saques no chão -----
  criarSaque(p, e, agora = Date.now()) {
    const itens = e.saque?.itens || [];
    const moedas = e.saque?.moedas || 0;
    const sufixo = `${agora}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    itens.forEach((item, i) => {
      p.saqueNoChao.push({ id: `saque_${e.id}_${sufixo}_${i}`, area: e.area, x: e.x, y: e.y, item, criadoEm: agora });
    });
    if (moedas > 0) {
      p.saqueNoChao.push({
        id: `saque_${e.id}_${sufixo}_moedas`,
        area: e.area,
        x: e.x,
        y: e.y,
        moedas,
        criadoEm: agora,
      });
    }
    return [...itens.map(nomeItem), ...(moedas > 0 ? [`${moedas} moedas`] : [])];
  },

  // Itens que uma missão em andamento ainda pede: esses saques nunca expiram.
  itensDeMissaoPendentes(p) {
    const m = p.missaoDeserto;
    if (m?.status !== "em_andamento") return [];
    if (m.etapa === 2) return ["veneno_escorpiao"];
    if (m.etapa === 3) return ["insignia_bandido"];
    return [];
  },

  // Remove saques com mais de 10 min e mantém no máximo LIMITE_SAQUES_NO_CHAO.
  limparSaques(p, agora = Date.now()) {
    const protegidos = this.itensDeMissaoPendentes(p);
    const protegido = (s) => !!s.item && protegidos.includes(s.item);
    const antes = p.saqueNoChao.length;
    const removidos = [];
    p.saqueNoChao = p.saqueNoChao.filter((s) => {
      const expirou = agora - (s.criadoEm || agora) >= TEMPO_EXPIRACAO_SAQUE;
      if (expirou && !protegido(s)) {
        removidos.push(s.id);
        return false;
      }
      return true;
    });
    let excesso = p.saqueNoChao.length - LIMITE_SAQUES_NO_CHAO;
    if (excesso > 0) {
      const removiveis = p.saqueNoChao.filter((s) => !protegido(s)).sort((a, b) => a.criadoEm - b.criadoEm);
      const cortar = new Set();
      for (const s of removiveis) {
        if (excesso <= 0) break;
        cortar.add(s.id);
        removidos.push(s.id);
        excesso--;
      }
      p.saqueNoChao = p.saqueNoChao.filter((s) => !cortar.has(s.id));
    }
    if (p.saqueNoChao.length !== antes) this.salvar(p);
    return removidos;
  },

  coletarSaque(id, saqueId) {
    const p = this.jogadores[id];
    const s = p?.saqueNoChao.find((x) => x.id === saqueId && x.area === p.area);
    if (!s) return { ok: false, mensagem: "Esse saque não está mais no chão." };
    if (distanciaChebyshev(p, s) > ALCANCE_INTERACAO)
      return { ok: false, mensagem: "Chegue ao lado do item para pegá-lo." };
    if (s.moedas) {
      p.moedas += s.moedas;
      p.saqueNoChao = p.saqueNoChao.filter((x) => x.id !== s.id);
      this.salvar(p);
      return { ok: true, moedas: s.moedas, itemColetado: s.id, mensagem: `Você pegou ${s.moedas} moedas.` };
    }
    if (!this.adicionarItem(p, s.item)) {
      return { ok: false, mensagem: this.mensagemMochilaCheia(p, "Libere espaço para pegar o item.") };
    }
    p.saqueNoChao = p.saqueNoChao.filter((x) => x.id !== s.id);
    const m = p.missaoDeserto;
    if (m.status === "em_andamento") {
      if (m.etapa === 2 && s.item === "veneno_escorpiao" && !m.venenosMissaoColetados.includes(s.id)) {
        m.venenosMissaoColetados.push(s.id);
      }
      if (m.etapa === 3 && s.item === "insignia_bandido" && !m.insigniasMissaoColetadas.includes(s.id)) {
        m.insigniasMissaoColetadas.push(s.id);
      }
    }
    this.salvar(p);
    return { ok: true, itemColetado: s.id, mensagem: `Você pegou: ${nomeItem(s.item)}.` };
  },

  // ----- Comércio -----
  mercadorProximo(p) {
    return this.npcProximo(p, (n) => n.papel === "loja");
  },

  comprarItem(id, item) {
    const p = this.jogadores[id];
    if (!p || !this.mercadorProximo(p)) return { ok: false, mensagem: "Aproxime-se do mercador para comprar." };
    const preco = PRECOS_LOJA[item];
    if (!preco) return { ok: false, mensagem: "Esse item não está à venda." };
    const lista = item === "flechas" ? Array(FLECHAS_POR_PACOTE).fill("flecha") : [item];
    if (p.moedas < preco) return { ok: false, mensagem: `Você precisa de ${preco} moedas.` };
    if (!this.podeReceberComRemocao(p, lista)) return { ok: false, mensagem: "A mochila está cheia." };
    p.moedas -= preco;
    for (const x of lista) this.adicionarItem(p, x);
    this.salvar(p);
    const nome = item === "flechas" ? `${FLECHAS_POR_PACOTE} flechas` : nomeItem(item);
    return { ok: true, mensagem: `Compra realizada: ${nome} por ${preco} moedas.` };
  },

  venderItem(id, item) {
    const p = this.jogadores[id];
    const valor = VALORES_VENDA[item];
    if (!p || !this.mercadorProximo(p)) return { ok: false, mensagem: "Aproxime-se do mercador para vender." };
    const i = p.inventario.indexOf(item);
    if (!valor || i < 0) return { ok: false, mensagem: "O mercador não compra esse item ou você não o tem." };
    p.inventario.splice(i, 1);
    p.moedas += valor;
    this.salvar(p);
    return { ok: true, mensagem: `Você vendeu ${nomeItem(item)} por ${valor} moedas.` };
  },

  // ----- Comandos -----
  executar(id, comando) {
    const p = this.jogadores[id];
    if (!p || !this.estado[id] || !comando || typeof comando.tipo !== "string") return { ok: false };
    switch (comando.tipo) {
      case "mover":
        return this.mover(id, comando.dx, comando.dy);
      case "interagir":
        return this.interagir(id, comando.alvoId);
      case "atacar":
        return this.atacar(id, comando.alvoId, "corpo");
      case "atacarDistancia":
        return this.atacar(id, comando.alvoId, "distancia");
      case "coletarSaque":
        return this.coletarSaque(id, comando.saqueId);
      case "comprar":
        return this.comprarItem(id, comando.item);
      case "vender":
        return this.venderItem(id, comando.item);
      case "viajar":
        return this.viajar(id, comando.areaDestino);
      case "pescar":
        return this.pescar(id);
      case "usarPocao":
        return this.usarPocao(id);
      case "usarPocaoFe":
        return this.usarPocaoFe(id);
      case "orar":
        return this.orar(id, comando.acao);
      case "alternarEquipamento":
        return this.alternarEquipamento(id, comando.slot);
      default:
        return { ok: false };
    }
  },

  // ----- Movimento -----
  mover(id, dxBruto, dyBruto) {
    const p = this.jogadores[id];
    const dx = Number(dxBruto);
    const dy = Number(dyBruto);
    if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) > 1 || Math.abs(dy) > 1 || (!dx && !dy)) {
      return { ok: false };
    }
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (!this.casaLivre(nx, ny, p, true)) return { ok: false };
    p.x = nx;
    p.y = ny;

    const transicao = this.verificarTransicao(p);
    if (transicao) return transicao;

    const saque = p.saqueNoChao.find((s) => s.area === p.area && s.x === nx && s.y === ny);
    if (saque) return this.coletarSaque(id, saque.id);

    const coleta = this.coletarRecurso(id, p);
    if (coleta) return coleta;

    this.salvar(p);
    return { ok: true };
  },

  mudarDeArea(p, area, x, y, mensagem) {
    p.area = area;
    p.x = x;
    p.y = y;
    this.salvar(p);
    return { ok: true, areaAlterada: true, mensagem };
  },

  verificarTransicao(p) {
    const { x, y } = p;
    if (p.area === "mar") {
      const mar = areas.mar;
      if (x === mar.caisCanaa.x && y === mar.caisCanaa.y) {
        return this.mudarDeArea(
          p,
          "canaan",
          areas.canaan.cais.x,
          areas.canaan.cais.y + 1,
          "O barco chegou ao cais de Canaã.",
        );
      }
      if (x === mar.caisDeserto.x && y === mar.caisDeserto.y) {
        return this.mudarDeArea(
          p,
          "deserto",
          areas.deserto.cais.x,
          areas.deserto.cais.y + 1,
          "O barco chegou ao cais do Deserto.",
        );
      }
      return null;
    }
    const area = areas[p.area];
    if (area.passagem && x === area.passagem.x && y === area.passagem.y) {
      const destino = p.area === "canaan" ? "deserto" : "canaan";
      const chegada = areas[destino].chegada;
      return this.mudarDeArea(
        p,
        destino,
        chegada.x,
        chegada.y,
        `Você percorreu a trilha terrestre e chegou a ${areas[destino].nome}.`,
      );
    }
    if (area.cais && x === area.cais.x && y === area.cais.y) {
      const origem = p.area;
      return this.mudarDeArea(
        p,
        "mar",
        origem === "canaan" ? 3 : 76,
        30,
        "Você embarcou no cais. Navegue até o marcador Canaã ou Deserto para desembarcar.",
      );
    }
    const portal = PORTAIS.find((t) => t.area === p.area && t.x === x && t.y === y);
    if (portal) {
      if (portal.capitulo && !capituloAnteriorConcluido(p, portal.capitulo)) {
        this.salvar(p);
        return {
          ok: true,
          caminhoBloqueado: true,
          mensagem: `O caminho ainda está bloqueado. Conclua o capítulo anterior antes de seguir para ${areas[portal.destino].nome}.`,
        };
      }
      const destino = areas[portal.destino];
      const dica = CAPITULOS[portal.destino] ? " Fale com os personagens para iniciar o capítulo." : "";
      return this.mudarDeArea(
        p,
        portal.destino,
        portal.chegada.x,
        portal.chegada.y,
        `Você chegou a ${destino.nome}.${dica}`,
      );
    }
    return null;
  },

  // Ervas (Canaã) e odres (Deserto) ao pisar no ponto.
  coletarRecurso(id, p) {
    const grupo = COLETAVEIS_POR_AREA[p.area];
    if (!grupo) return null;
    const c = grupo.lista.find((x) => x.x === p.x && x.y === p.y && this.coletavelDisponivel(id, p.area, x.id));
    if (!c) return null;
    const nome = p.area === "canaan" ? "a erva" : "o odre";
    if (!this.adicionarItem(p, grupo.item)) {
      return { ok: true, mensagem: this.mensagemMochilaCheia(p, `Libere espaço para pegar ${nome}.`) };
    }
    p[grupo.coletados].push(c.id);
    p[grupo.respawn][c.id] = Date.now() + TEMPO_RESPAWN_COLETAVEL;
    if (p.area === "canaan") {
      const m = p.missaoErvas;
      if (m.status === "em_andamento" && !m.ervasMissaoColetadas.includes(c.id)) m.ervasMissaoColetadas.push(c.id);
      this.salvar(p);
      return { ok: true, itemColetado: c.id, mensagem: "Você coletou uma erva medicinal." };
    }
    const m = p.missaoDeserto;
    if (m.status === "em_andamento" && m.etapa === 1 && !m.odresMissaoColetados.includes(c.id)) {
      m.odresMissaoColetados.push(c.id);
    }
    this.salvar(p);
    return { ok: true, itemColetado: c.id, mensagem: "Você encontrou um odre de água." };
  },

  viajar(id, destino) {
    const p = this.jogadores[id];
    const guia = this.npcProximo(p, (n) => n.papel === "guia");
    if (!guia) return { ok: false, mensagem: "Aproxime-se de um guia de caravanas para usar a viagem rápida." };
    if (!["canaan", "deserto"].includes(destino) || destino === p.area) {
      return { ok: false, mensagem: "Destino indisponível." };
    }
    const chegada = areas[destino].chegadaViagem;
    return this.mudarDeArea(
      p,
      destino,
      chegada.x,
      chegada.y,
      `Viagem rápida para ${areas[destino].nome}. A trilha terrestre continua disponível para viajar a pé.`,
    );
  },

  pescar(id) {
    const p = this.jogadores[id];
    if (p.area !== "mar") return { ok: false, mensagem: "A pesca só é possível no mar, a partir do barco." };
    const ponto = pontosPesca.find((x) => distanciaChebyshev(p, x) <= 1);
    if (!ponto)
      return { ok: false, mensagem: "Aproxime o barco de um ponto de pesca marcado com o peixe e pressione P." };
    if (!this.pescaDisponivel(id, ponto.id)) {
      return { ok: false, mensagem: "Esse ponto está descansando. Tente outro local ou volte em alguns instantes." };
    }
    if (!this.adicionarItem(p, "peixe")) {
      return { ok: false, mensagem: this.mensagemMochilaCheia(p, "Libere espaço antes de pescar.") };
    }
    p.pescaRespawn[ponto.id] = Date.now() + TEMPO_RESPAWN_PESCA;
    this.salvar(p);
    return {
      ok: true,
      mensagem: `Você pescou um peixe fresco! Azarias compra cada peixe por ${VALORES_VENDA.peixe} moedas.`,
    };
  },

  // ----- Consumíveis -----
  usarPocao(id) {
    const p = this.jogadores[id];
    const i = p.inventario.indexOf("pocao");
    if (i < 0) return { ok: false, mensagem: "Você não tem poções." };
    if (p.vida >= vidaMaxima(p)) return { ok: false, mensagem: "Sua vida já está cheia. A poção não foi consumida." };
    p.inventario.splice(i, 1);
    const antes = p.vida;
    p.vida = Math.min(vidaMaxima(p), p.vida + curaPocao(p));
    this.salvar(p);
    return {
      ok: true,
      cura: p.vida - antes,
      mensagem: `Você usou uma poção e recuperou ${p.vida - antes} de vida. Vida: ${p.vida}/${vidaMaxima(p)}.`,
    };
  },

  usarPocaoFe(id) {
    const p = this.jogadores[id];
    const i = p.inventario.indexOf("pocao_fe");
    if (i < 0) return { ok: false, mensagem: "Você não tem poções de fé." };
    if (p.fe >= FE_MAXIMA) return { ok: false, mensagem: "Sua fé já está cheia; a poção não foi consumida." };
    p.inventario.splice(i, 1);
    const antes = p.fe;
    p.fe = Math.min(FE_MAXIMA, p.fe + CURA_POCAO_FE);
    this.salvar(p);
    return {
      ok: true,
      feCurada: p.fe - antes,
      mensagem: `Poção de fé: +${p.fe - antes} de fé. Fé ${p.fe}/${FE_MAXIMA}.`,
    };
  },

  // ----- Oração -----
  orar(id, acao) {
    const p = this.jogadores[id];
    if (!p.oracaoDesbloqueada) {
      return { ok: false, mensagem: "A Oração ainda não foi aprendida. Avance até a Galileia e converse com Jesus." };
    }
    if (acao === "aliado") {
      return {
        ok: false,
        mensagem:
          "Ainda não há grupo ou companheiros. A cura de aliados será habilitada quando o sistema de grupo existir.",
      };
    }
    const custo = CUSTO_ORACAO[acao];
    if (custo === undefined) return { ok: false, mensagem: "Escolha uma forma de Oração." };
    const nivel = nivelHabilidade(p, "oracao");
    if (nivel < NIVEL_ORACAO[acao]) {
      return {
        ok: false,
        mensagem: `${NOMES_ORACAO[acao]} desbloqueia no nível ${NIVEL_ORACAO[acao]} de Oração (atual: ${nivel}).`,
      };
    }
    const agora = Date.now();
    const envenenado = p.envenenadoAte > agora;
    const vidaCheia = p.vida >= vidaMaxima(p);
    if ((acao === "vida" || acao === "area") && vidaCheia) return { ok: false, mensagem: "Sua vida já está cheia." };
    if (acao === "veneno" && !envenenado) return { ok: false, mensagem: "Você não está envenenado." };
    if (acao === "milagre" && vidaCheia && !envenenado)
      return { ok: false, mensagem: "Você não precisa de um milagre agora." };
    if (p.fe < custo) {
      return {
        ok: false,
        mensagem: `Fé insuficiente (${p.fe}/${custo}). Use uma poção de fé ou aguarde a regeneração.`,
      };
    }
    p.fe -= custo;
    const antes = p.vida;
    let mensagem;
    if (acao === "vida") {
      p.vida = Math.min(vidaMaxima(p), p.vida + 20 + Math.floor(nivel / 2));
      mensagem = `Oração: recuperou ${p.vida - antes} de vida.`;
    } else if (acao === "veneno") {
      this.curarVeneno(p);
      mensagem = "O veneno foi removido pela Oração.";
    } else if (acao === "area") {
      p.vida = Math.min(vidaMaxima(p), p.vida + 30 + Math.floor(nivel / 2));
      mensagem = `Oração em área 3×3: você recuperou ${p.vida - antes} de vida. Aliados próximos serão curados quando houver companheiros no jogo.`;
    } else {
      p.vida = vidaMaxima(p);
      this.curarVeneno(p);
      mensagem = "Milagre: vida restaurada por completo e veneno removido.";
    }
    const subiu = ganharHabilidade(p, "oracao", XP_HABILIDADE_POR_USO.oracao);
    if (subiu) mensagem += ` Oração: nível ${p.habilidades.oracao}.`;
    this.salvar(p);
    return { ok: true, cura: p.vida - antes, mensagem: `${mensagem} Fé ${p.fe}/${FE_MAXIMA}.` };
  },

  curarVeneno(p) {
    p.envenenadoAte = 0;
    p.proximoDanoVeneno = 0;
    p.venenoAtual = null;
  },

  // ----- Conversas -----
  interagir(id, alvoId) {
    const p = this.jogadores[id];
    const npc = alvoId ? npcs[alvoId] : this.npcProximo(p);
    if (!npc || npc.area !== p.area) return { ok: false, mensagem: "Não há ninguém por perto para conversar." };
    if (distanciaChebyshev(p, npc) > ALCANCE_INTERACAO)
      return { ok: false, mensagem: "Chegue mais perto para conversar." };
    if (npc.id === "viajante1") return this.interagirEliabe(id);
    if (npc.id === "noemi1") return this.interagirNoemi(id);
    if (npc.papel === "loja") {
      return {
        ok: true,
        abrirLoja: true,
        mensagem: `${npc.nome.split(",")[0]}: Tenho provisões, flechas e equipamentos para vender.`,
      };
    }
    if (npc.papel === "guia") {
      return {
        ok: true,
        abrirViagem: true,
        mensagem: `${npc.nome}: Posso levar você rapidamente entre Canaã e o Deserto. A viagem é gratuita; também há uma trilha terrestre para caminhar.`,
      };
    }
    if (npc.capitulo) return this.interagirCapitulo(id, npc);
    return { ok: true, mensagem: `${npc.nome}: A paz esteja com você.` };
  },

  interagirEliabe(id) {
    const p = this.jogadores[id];
    const m1 = p.missaoEliabe;
    const m2 = p.missaoErvas;
    if (m1.status === "nao_iniciada") {
      m1.status = "em_andamento";
      this.salvar(p);
      return {
        ok: true,
        mensagem:
          "Eliabe: Um lobo ronda a estrada a sudeste e ameaça os viajantes. Afaste-o e volte para falar comigo.",
      };
    }
    if (m1.status === "em_andamento" && m1.loboDerrotado && !m1.recompensaRecebida) {
      const recompensas = ["pocao", "pocao", "espada_ferro"];
      if (!this.podeReceberComRemocao(p, recompensas)) {
        return {
          ok: true,
          mensagem: "Eliabe: Sua mochila está cheia. Libere espaço para receber 2 poções e uma espada de ferro.",
        };
      }
      for (const item of recompensas) this.adicionarItem(p, item);
      m1.recompensaRecebida = true;
      m1.status = "concluida";
      const niveis = adicionarXP(p, 50);
      this.salvar(p);
      return {
        ok: true,
        mensagem: `Eliabe: Obrigado! Receba 2 poções, uma espada de ferro (+12 de dano) e 50 XP. Missão concluída!${niveis.length ? ` Você subiu para o nível ${p.nivel}!` : ""}`,
      };
    }
    if (m1.status === "em_andamento") {
      return {
        ok: true,
        mensagem: "Eliabe: O lobo ainda ronda a estrada. Encontre-o a sudeste e volte quando conseguir.",
      };
    }
    if (m2.status === "bloqueada") {
      m2.status = "em_andamento";
      m2.ervasMissaoColetadas = [];
      // As plantas reaparecem para a missão, sem apagar as ervas da mochila.
      p.ervasColetadas = [];
      for (const planta of ervas) p.ervasRespawn[planta.id] = Date.now();
      this.salvar(p);
      return {
        ok: true,
        missaoErvasIniciada: true,
        mensagem: "Eliabe: Há viajantes feridos na vila. Preciso de 3 ervas medicinais; colete três e volte.",
      };
    }
    if (m2.status === "em_andamento") {
      const coletadas = m2.ervasMissaoColetadas.length;
      const naMochila = p.inventario.filter((x) => x === "erva").length;
      if (coletadas < QUANTIDADE_ERVAS_MISSAO) {
        return {
          ok: true,
          mensagem: `Eliabe: Ainda faltam ervas. Você coletou ${coletadas}/${QUANTIDADE_ERVAS_MISSAO} para esta missão.`,
        };
      }
      if (naMochila < QUANTIDADE_ERVAS_MISSAO) {
        return {
          ok: true,
          mensagem: `Eliabe: Preciso que você traga as ${QUANTIDADE_ERVAS_MISSAO} ervas na mochila (você tem ${naMochila}). As plantas brotam de novo em alguns segundos.`,
        };
      }
      const recompensas = Array(RECOMPENSA_MISSAO_POCOES).fill("pocao");
      if (!this.podeReceberComRemocao(p, recompensas, [["erva", QUANTIDADE_ERVAS_MISSAO]])) {
        return { ok: true, mensagem: "Eliabe: Sua mochila está cheia. Libere espaço para receber as poções." };
      }
      this.removerItens(p, "erva", QUANTIDADE_ERVAS_MISSAO);
      for (const item of recompensas) this.adicionarItem(p, item);
      m2.recompensaRecebida = true;
      m2.status = "concluida";
      const niveis = adicionarXP(p, 80);
      this.salvar(p);
      return {
        ok: true,
        mensagem: `Eliabe: Que Deus o recompense! Receba 2 poções e 80 XP. Missão concluída!${niveis.length ? ` Você subiu para o nível ${p.nivel}!` : ""}`,
      };
    }
    return { ok: true, mensagem: "Eliabe: Obrigado por ajudar os viajantes. Você concluiu as tarefas de Canaã." };
  },

  interagirNoemi(id) {
    const p = this.jogadores[id];
    const m = p.missaoDeserto;
    const subiu = (niveis) => (niveis.length ? ` Nível ${p.nivel}!` : "");
    if (m.status === "bloqueada") {
      m.status = "em_andamento";
      m.etapa = 1;
      m.odresMissaoColetados = [];
      p.odresColetados = [];
      for (const odre of odres) p.odresRespawn[odre.id] = Date.now();
      this.salvar(p);
      return {
        ok: true,
        missaoDesertoIniciada: true,
        mensagem: "Noemi: A caravana precisa de água. Encontre 3 odres espalhados pelo deserto e traga-os para mim.",
      };
    }
    if (m.status === "em_andamento" && m.etapa === 1) {
      const coletados = m.odresMissaoColetados.length;
      if (coletados < QUANTIDADE_ODRES_MISSAO) {
        return {
          ok: true,
          mensagem: `Noemi: Ainda faltam odres. Você encontrou ${coletados}/${QUANTIDADE_ODRES_MISSAO}.`,
        };
      }
      const naMochila = p.inventario.filter((x) => x === "odre_agua").length;
      if (naMochila < QUANTIDADE_ODRES_MISSAO) {
        return {
          ok: true,
          mensagem: `Noemi: Traga os ${QUANTIDADE_ODRES_MISSAO} odres na mochila (você tem ${naMochila}).`,
        };
      }
      const recompensas = ["pocao", "pocao", "armadura_couro", "arco_madeira", ...Array(8).fill("flecha")];
      if (!this.podeReceberComRemocao(p, recompensas, [["odre_agua", QUANTIDADE_ODRES_MISSAO]])) {
        return {
          ok: true,
          mensagem: "Noemi: Sua mochila está cheia. Libere espaço para receber poções, armadura, arco e flechas.",
        };
      }
      this.removerItens(p, "odre_agua", QUANTIDADE_ODRES_MISSAO);
      for (const item of recompensas) this.adicionarItem(p, item);
      m.etapa = 2;
      m.venenosMissaoColetados = [];
      const niveis = adicionarXP(p, 100);
      this.salvar(p);
      return {
        ok: true,
        mensagem: `Noemi: A água salvou a caravana! Receba 2 poções, armadura de couro, arco, 8 flechas e 100 XP. Agora derrote o escorpião a noroeste e traga 2 amostras do veneno.${subiu(niveis)}`,
      };
    }
    if (m.status === "em_andamento" && m.etapa === 2) {
      const coletados = m.venenosMissaoColetados.length;
      if (coletados < QUANTIDADE_VENENOS_MISSAO) {
        return {
          ok: true,
          mensagem: `Noemi: Derrote o escorpião e pegue o veneno que ele deixa. Amostras: ${coletados}/${QUANTIDADE_VENENOS_MISSAO}.`,
        };
      }
      const naMochila = p.inventario.filter((x) => x === "veneno_escorpiao").length;
      if (naMochila < QUANTIDADE_VENENOS_MISSAO) {
        return {
          ok: true,
          mensagem: `Noemi: Preciso das ${QUANTIDADE_VENENOS_MISSAO} amostras na mochila (você tem ${naMochila}). O escorpião volta em alguns segundos.`,
        };
      }
      this.removerItens(p, "veneno_escorpiao", QUANTIDADE_VENENOS_MISSAO);
      m.etapa = 3;
      m.insigniasMissaoColetadas = [];
      p.moedas += 25;
      const niveis = adicionarXP(p, 100);
      this.salvar(p);
      return {
        ok: true,
        mensagem: `Noemi: Com o veneno prepararemos um antídoto. Receba 25 moedas e 100 XP. Os saqueadores ameaçam o acampamento: derrote o chefe ao sul e traga a insígnia dele. Etapa final!${subiu(niveis)}`,
      };
    }
    if (m.status === "em_andamento" && m.etapa === 3) {
      if (m.insigniasMissaoColetadas.length < 1) {
        return {
          ok: true,
          mensagem: "Noemi: Encontre o chefe dos saqueadores ao sul, derrote-o e traga a insígnia que ele deixar.",
        };
      }
      if (!p.inventario.includes("insignia_bandido")) {
        return { ok: true, mensagem: "Noemi: Traga a insígnia na mochila para provar que o bando foi vencido." };
      }
      this.removerItens(p, "insignia_bandido", 1);
      m.etapa = 4;
      m.status = "concluida";
      m.recompensaRecebida = true;
      p.moedas += 100;
      const niveis = adicionarXP(p, 180);
      this.salvar(p);
      return {
        ok: true,
        mensagem: `Noemi: A caravana está segura! Receba 100 moedas e 180 XP. Capítulo do Deserto concluído! A rota a leste da trilha leva ao Egito.${subiu(niveis)}`,
      };
    }
    return { ok: true, mensagem: "Noemi: A caravana está segura graças a você. Que o Senhor guarde o seu caminho." };
  },

  interagirCapitulo(id, npc) {
    const p = this.jogadores[id];
    const chave = npc.capitulo;
    const cap = CAPITULOS[chave];
    const fase = faseCapitulo(p, chave);
    const falar = (texto) => ({ ok: true, mensagem: `${npc.nome}: ${texto}` });
    if (fase === "bloqueado")
      return falar(npc.falas?.bloqueado || "Conclua primeiro o capítulo anterior para chegar a esta etapa.");
    if (npc.papel === "mestre") return this.interagirMestre(id, npc);
    if (npc.papel !== "lider") return falar(npc.falas?.[fase] || npc.falas?.andamento || "A paz esteja com você.");

    const estado = p.capitulos[chave];
    if (fase === "inicio") {
      estado.status = "em_andamento";
      estado.alvo = false;
      this.salvar(p);
      return { ...falar(cap.falas.inicio), capituloIniciado: chave };
    }
    if (fase === "andamento") return falar(cap.falas.andamento);
    if (fase === "concluido") return falar(cap.falas.concluido);

    // fase === "retorno": entrega a recompensa e conclui.
    const r = cap.recompensa;
    const itens = r.itens || [];
    if (!this.podeReceberComRemocao(p, itens)) {
      return falar(
        `Sua mochila está cheia (${pesoCarregado(p)}/${capacidadeCarga(p)} kg). Libere espaço para receber a recompensa.`,
      );
    }
    for (const item of itens) this.adicionarItem(p, item);
    estado.status = "concluida";
    p.moedas += r.moedas || 0;
    const niveis = adicionarXP(p, r.xp || 0);
    this.salvar(p);
    const contagem = {};
    for (const item of itens) contagem[item] = (contagem[item] || 0) + 1;
    const nomes = Object.entries(contagem).map(([item, n]) => (n > 1 ? `${n}× ${nomeItem(item)}` : nomeItem(item)));
    const partes = [`+${r.xp} XP`, `${r.moedas} moedas`, ...nomes];
    const subiu = niveis.length ? ` Você subiu ao nível ${p.nivel}.` : "";
    return {
      ...falar(`${cap.falas.retorno} Recompensa: ${partes.join(", ")}.${subiu}`),
      capituloConcluido: chave,
    };
  },

  interagirMestre(id, npc) {
    const p = this.jogadores[id];
    const chave = npc.capitulo;
    const falar = (texto) => ({ ok: true, mensagem: `${npc.nome}: ${texto}` });
    if (p.capitulos[chave]?.status !== "concluida" && !p.oracaoDesbloqueada) return falar(npc.falas.antes);
    if (!p.oracaoDesbloqueada) {
      p.oracaoDesbloqueada = true;
      p.fe = FE_MAXIMA;
      this.salvar(p);
      return { ...falar(npc.falas.ensino), oracaoAprendida: true };
    }
    return falar(npc.falas.depois);
  },

  // ----- Combate do jogador -----
  alvoCorpo(p, alvoId) {
    if (alvoId) {
      const e = inimigos[alvoId];
      if (!e || e.area !== p.area) return { erro: "Não há inimigos por perto." };
      if (!this.inimigoVivo(p, e.id)) return { erro: "Esse inimigo já foi derrotado." };
      if (distanciaChebyshev(p, e) > ALCANCE_CORPO)
        return { erro: `Chegue ao lado de ${e.nome.toLowerCase()} para atacá-lo.` };
      return { inimigo: e };
    }
    const e = Object.values(inimigos).find(
      (x) => x.area === p.area && this.inimigoVivo(p, x.id) && distanciaChebyshev(p, x) <= ALCANCE_CORPO,
    );
    return e ? { inimigo: e } : { erro: "Não há inimigos por perto." };
  },

  linhaDeTiroLivre(p, e) {
    const dx = Math.abs(e.x - p.x);
    const dy = Math.abs(e.y - p.y);
    const distancia = Math.max(dx, dy);
    if ((dx !== 0 && dy !== 0 && dx !== dy) || distancia < 1 || distancia > ALCANCE_ARCO) return false;
    const passoX = Math.sign(e.x - p.x);
    const passoY = Math.sign(e.y - p.y);
    for (let i = 1; i < distancia; i++) {
      if (mapas[p.area][p.y + passoY * i][p.x + passoX * i] !== 0) return false;
    }
    return true;
  },

  alvoDistancia(p, alvoId) {
    const candidatos = Object.values(inimigos)
      .filter((e) => (!alvoId || e.id === alvoId) && e.area === p.area && this.inimigoVivo(p, e.id))
      .filter((e) => this.linhaDeTiroLivre(p, e))
      .sort((a, b) => distanciaChebyshev(p, a) - distanciaChebyshev(p, b));
    if (candidatos.length) return { inimigo: candidatos[0] };
    return {
      erro: `Nenhum inimigo alinhado e desimpedido até ${ALCANCE_ARCO} casas. Posicione-se na mesma linha, coluna ou diagonal.`,
    };
  },

  atacar(id, alvoId, tipo) {
    const p = this.jogadores[id];
    const estado = this.estado[id];
    const agora = Date.now();
    const distancia = tipo === "distancia";
    if (distancia) {
      if (!p.equipamento.arco) return { ok: false, mensagem: "Equipe um arco antes de atacar à distância." };
      if (!p.inventario.includes("flecha")) return { ok: false, mensagem: "Você não tem flechas." };
    }
    const alvo = distancia ? this.alvoDistancia(p, alvoId) : this.alvoCorpo(p, alvoId);
    if (alvo.erro) return { ok: false, mensagem: alvo.erro };
    const e = alvo.inimigo;

    if (agora < estado.proximoAtaqueJogador) {
      const restante = estado.proximoAtaqueJogador - agora;
      return {
        ok: false,
        emRecarga: true,
        recargaRestante: restante,
        mensagem: `Recuperando o fôlego: próximo golpe em ${(restante / 1000).toFixed(1).replace(".", ",")} s.`,
      };
    }
    estado.proximoAtaqueJogador = agora + RECARGA_ATAQUE;
    estado.ultimoCombate = agora;
    if (distancia) this.removerItens(p, "flecha", 1);

    const golpe = calcularGolpe(p, tipo, e.defesa || 0);
    const chaveHabilidade = distancia ? "distancia" : "corpo";
    const subiu = ganharHabilidade(p, chaveHabilidade, XP_HABILIDADE_POR_USO[chaveHabilidade]);
    p.vidaInimigos[e.id] = Math.max(0, p.vidaInimigos[e.id] - golpe.dano);

    const prefixo = golpe.critico ? "CRÍTICO! " : "";
    const textoHabilidade = subiu
      ? ` ${NOMES_HABILIDADES[chaveHabilidade]}: nível ${p.habilidades[chaveHabilidade]}.`
      : "";
    const base = {
      ok: true,
      danoAplicado: golpe.dano,
      inimigoId: e.id,
      critico: golpe.critico,
      defesaAlvo: e.defesa || 0,
      tipoAtaque: tipo,
      skillLevel: p.habilidades[chaveHabilidade],
    };
    if (p.vidaInimigos[e.id] === 0) {
      const morte = this.derrotarInimigo(p, e);
      return {
        ...base,
        derrotado: true,
        saques: morte.saques,
        mensagem: `${prefixo}${morte.mensagem}${textoHabilidade}`,
      };
    }
    this.salvar(p);
    const acao = distancia ? `Sua flecha atingiu ${e.nome.toLowerCase()}` : `Você acertou ${e.nome.toLowerCase()}`;
    return {
      ...base,
      derrotado: false,
      mensagem: `${prefixo}${acao} (${golpe.dano} de dano). Vida dele: ${p.vidaInimigos[e.id]}/${e.vidaMaxima}.${textoHabilidade}`,
    };
  },

  derrotarInimigo(p, e) {
    const agora = Date.now();
    if (!p.inimigosDerrotados.includes(e.id)) p.inimigosDerrotados.push(e.id);
    p.vidaInimigos[e.id] = 0;
    let objetivo = "";
    if (e.id === "lobo1" && p.missaoEliabe.status === "em_andamento") {
      p.missaoEliabe.loboDerrotado = true;
      objetivo = " Volte a Eliabe.";
    }
    const chave = capituloDoInimigo(e.id);
    if (chave && p.capitulos[chave]?.status === "em_andamento" && !p.capitulos[chave].alvo) {
      p.capitulos[chave].alvo = true;
      objetivo = ` Objetivo concluído: volte a ${npcs[CAPITULOS[chave].npc]?.nome || "o líder"}.`;
    }
    const niveis = adicionarXP(p, e.xpRecompensa);
    const saque = this.criarSaque(p, e, agora);
    this.salvar(p);
    const up = niveis.length ? ` Você subiu para o nível ${p.nivel}! Vida máxima: ${vidaMaxima(p)}.` : "";
    const textoSaque = saque.length ? ` Saque no chão: ${saque.join(", ")}. Clique no saque ou caminhe sobre ele.` : "";
    return {
      saques: p.saqueNoChao.filter((s) => s.area === p.area && s.x === e.x && s.y === e.y).map((s) => s.id),
      mensagem: `Você derrotou ${e.nome.toLowerCase()}! +${e.xpRecompensa} XP.${up}${objetivo}${textoSaque} Ele reaparecerá em ${TEMPO_RESPAWN_INIMIGO / 1000} segundos.`,
    };
  },

  reaparecerInimigo(id, inimigoId) {
    const p = this.jogadores[id];
    const e = inimigos[inimigoId];
    if (!p || !e) return false;
    const i = p.inimigosDerrotados.indexOf(inimigoId);
    if (i < 0) return false;
    p.inimigosDerrotados.splice(i, 1);
    p.vidaInimigos[inimigoId] = e.vidaMaxima;
    e.x = e.inicioX;
    e.y = e.inicioY;
    e.proximoMovimento = 0;
    e.proximoAtaque = 0;
    this.salvar(p);
    return true;
  },

  // ----- Inimigos -----
  passoInimigo(e, alvoX, alvoY, p) {
    const sx = Math.sign(alvoX - e.x);
    const sy = Math.sign(alvoY - e.y);
    const tentativas = [];
    if (sx && sy) tentativas.push({ x: sx, y: sy });
    if (Math.abs(alvoX - e.x) >= Math.abs(alvoY - e.y)) tentativas.push({ x: sx, y: 0 }, { x: 0, y: sy });
    else tentativas.push({ x: 0, y: sy }, { x: sx, y: 0 });
    for (const d of tentativas) {
      if ((d.x || d.y) && this.casaLivre(e.x + d.x, e.y + d.y, p)) {
        e.x += d.x;
        e.y += d.y;
        return true;
      }
    }
    return false;
  },

  aplicarVeneno(p, veneno, agora) {
    if (p.envenenadoAte > agora) return false;
    p.envenenadoAte = agora + veneno.duracao;
    p.proximoDanoVeneno = agora + veneno.intervalo;
    p.venenoAtual = { dano: veneno.dano, intervalo: veneno.intervalo };
    return true;
  },

  // ----- Morte (regra única) -----
  aplicarMorte(id, causa, agora = Date.now()) {
    const p = this.jogadores[id];
    const estado = this.estado[id];
    const regra = regraMorte(p.nivel);
    const local = { area: p.area, x: p.x, y: p.y };
    const moedasPerdidas = Math.floor(p.moedas * regra.moedas);
    p.moedas -= moedasPerdidas;

    let xpPerdido = 0;
    if (regra.xpHabilidade) {
      for (const chave of HABILIDADES) {
        const nivel = nivelHabilidade(p, chave);
        if (nivel >= HABILIDADE_MAXIMA) continue;
        const total = xpTotalAteHabilidade(nivel) + (p.skillXp[chave] || 0);
        const perda = Math.min(p.skillXp[chave] || 0, Math.floor(total * regra.xpHabilidade));
        p.skillXp[chave] -= perda;
        xpPerdido += perda;
      }
    }

    let itemPerdido = null;
    if (regra.chanceItem && p.inventario.length && Math.random() < regra.chanceItem) {
      const indice = Math.floor(Math.random() * p.inventario.length);
      itemPerdido = p.inventario.splice(indice, 1)[0];
      p.saqueNoChao.push({
        id: `morte_${agora}_${indice}`,
        area: local.area,
        x: local.x,
        y: local.y,
        item: itemPerdido,
        criadoEm: agora,
      });
    }

    p.mortes++;
    this.curarVeneno(p);
    p.area = "canaan";
    p.x = areas.canaan.inicio.x;
    p.y = areas.canaan.inicio.y;
    p.vida = vidaMaxima(p);
    for (const outro of Object.values(inimigos)) {
      outro.x = outro.inicioX;
      outro.y = outro.inicioY;
      outro.proximoAtaque = 0;
      outro.proximoMovimento = 0;
      if (this.inimigoVivo(p, outro.id)) p.vidaInimigos[outro.id] = outro.vidaMaxima;
    }
    if (estado) {
      estado.ultimoCombate = 0;
      estado.proximaRegen = agora + TEMPO_REGEN;
      estado.proximoAtaqueJogador = 0;
    }
    this.salvar(p);

    const partes = [];
    if (moedasPerdidas) partes.push(`${moedasPerdidas} moedas perdidas (${Math.round(regra.moedas * 100)}%)`);
    if (xpPerdido) partes.push(`${xpPerdido} XP de habilidade perdidos (${Math.round(regra.xpHabilidade * 100)}%)`);
    if (itemPerdido) partes.push(`${nomeItem(itemPerdido)} caiu no local da derrota`);
    const nota = partes.length
      ? `Penalidade de morte (nível ${p.nivel}): ${partes.join("; ")}.`
      : regra.moedas
        ? `Penalidade de morte (nível ${p.nivel}): você não carregava nada a perder.`
        : "Sem penalidade até o nível 10: moedas, itens e habilidades foram preservados.";
    const inicio = causa === "veneno" ? "O veneno foi fatal." : "Você foi derrotado.";
    return {
      tipo: "renasceu",
      causa,
      penalidade: { moedas: moedasPerdidas, xpHabilidade: xpPerdido, item: itemPerdido },
      mensagem: `${inicio} Você voltou a Canaã com a vida restaurada. ${nota}`,
    };
  },

  // ----- Laço de tempo -----
  atualizar(id, agora) {
    const p = this.jogadores[id];
    const estado = this.estado[id];
    const eventos = [];
    if (!p || !estado) return eventos;

    for (const e of Object.values(inimigos)) {
      if (e.area !== p.area || !this.inimigoVivo(p, e.id)) continue;
      const distancia = distanciaChebyshev(p, e);
      if (distancia <= ALCANCE_CORPO) {
        if (agora < e.proximoAtaque) continue;
        e.proximoAtaque = agora + (e.intervaloAtaque || INTERVALO_ATAQUE);
        estado.ultimoCombate = agora;
        const defesa = defesaTotal(p);
        const dano = mitigarDano(e.danoContraJogador, defesa);
        p.vida = Math.max(0, p.vida - dano);
        const subiu = ganharHabilidade(p, "defesa", XP_HABILIDADE_POR_USO.defesa);
        if (p.vida === 0) {
          eventos.push(this.aplicarMorte(id, "inimigo", agora));
          return eventos;
        }
        eventos.push({
          tipo: "jogadorAtingido",
          inimigoId: e.id,
          dano,
          defesaBloqueada: Math.max(0, e.danoContraJogador - dano),
          mensagem: `${e.nome} atingiu você por ${dano} de dano! Vida: ${p.vida}/${vidaMaxima(p)}.${subiu ? ` Defesa: nível ${p.habilidades.defesa}.` : ""}`,
        });
        if (e.veneno && this.aplicarVeneno(p, e.veneno, agora)) {
          eventos.push({
            tipo: "veneno",
            mensagem: `${e.nome} envenenou você (${e.veneno.dano} de dano a cada ${e.veneno.intervalo / 1000} s por ${e.veneno.duracao / 1000} s). A Oração remove veneno a partir do nível ${NIVEL_ORACAO.veneno}.`,
          });
        }
        this.salvar(p);
        continue;
      }
      if (agora < e.proximoMovimento) continue;
      e.proximoMovimento = agora + INTERVALO_MOVIMENTO;
      let alvoX = e.inicioX;
      let alvoY = e.inicioY;
      if (distancia <= e.raioPercepcao) {
        alvoX = p.x;
        alvoY = p.y;
      } else if (e.x === e.inicioX && e.y === e.inicioY) continue;
      if (this.passoInimigo(e, alvoX, alvoY, p)) {
        e.proximoAtaque = Math.max(e.proximoAtaque, agora + 600);
        eventos.push({ tipo: "inimigoMoveu", id: e.id });
      }
    }

    // Veneno: dano periódico; ao expirar, o estado é zerado para poder ser reaplicado.
    if (p.envenenadoAte) {
      if (agora >= p.envenenadoAte) {
        this.curarVeneno(p);
        this.salvar(p);
        eventos.push({ tipo: "venenoTerminou", mensagem: "O veneno perdeu o efeito." });
      } else if (agora >= p.proximoDanoVeneno) {
        const veneno = p.venenoAtual || VENENO_PADRAO;
        p.proximoDanoVeneno = agora + veneno.intervalo;
        p.vida = Math.max(0, p.vida - veneno.dano);
        estado.ultimoCombate = agora;
        if (p.vida === 0) {
          eventos.push(this.aplicarMorte(id, "veneno", agora));
          return eventos;
        }
        this.salvar(p);
        eventos.push({
          tipo: "jogadorAtingido",
          dano: veneno.dano,
          defesaBloqueada: 0,
          veneno: true,
          mensagem: `O veneno causa ${veneno.dano} de dano. Vida: ${p.vida}/${vidaMaxima(p)}.`,
        });
      }
    }

    // Fé: +1 a cada FE_REGEN_MS depois de aprender a Oração.
    if (p.oracaoDesbloqueada && p.fe < FE_MAXIMA) {
      if (!estado.proximaRegenFe) estado.proximaRegenFe = agora + FE_REGEN_MS;
      else if (agora >= estado.proximaRegenFe) {
        p.fe = Math.min(FE_MAXIMA, p.fe + 1);
        estado.proximaRegenFe = agora + FE_REGEN_MS;
        this.salvar(p);
      }
    } else estado.proximaRegenFe = 0;

    // Vida: regenera fora de combate.
    const vidaMax = vidaMaxima(p);
    if (p.vida < vidaMax && agora - estado.ultimoCombate >= PAUSA_REGEN_COMBATE && agora >= estado.proximaRegen) {
      p.vida = Math.min(vidaMax, p.vida + Math.max(1, Math.round(vidaMax * REGEN_PERCENTUAL)));
      estado.proximaRegen = agora + TEMPO_REGEN;
      this.salvar(p);
      eventos.push({ tipo: "regenerou" });
    }

    if (agora >= estado.proximaLimpezaSaques) {
      estado.proximaLimpezaSaques = agora + INTERVALO_LIMPEZA_SAQUES;
      const removidos = this.limparSaques(p, agora);
      if (removidos.length) eventos.push({ tipo: "saqueExpirou", ids: removidos });
    }
    return eventos;
  },
};
