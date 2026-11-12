// =====================================================================
// logica.js — regras de "Jornada · RPG Bíblico" (sem DOM).
//
// Ordem de carga: storage.js → dados/*.js → logica.js → sprites.js → game.js → interface.js.
// Este arquivo define o motor (Mundo) e as regras. Todo o CONTEÚDO (itens, áreas, NPCs,
// criaturas, missões, capítulos, portais, caçadas dos atalaias e troca de pontos de tarefa) vem
// dos arquivos em dados/ e é registrado aqui pelas funções registrar*; para criar conteúdo novo,
// edite apenas dados/.
// =====================================================================

// ---------------------------------------------------------------------
// Constantes gerais
// ---------------------------------------------------------------------
const TILE = 32;
const COLS = 80;
const ROWS = 60;
const VERSAO_SAVE = 8;

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
// ITENS vem de dados/itens.js.
// PRECOS_LOJA, FLECHAS_POR_PACOTE e VALORES_VENDA vêm de dados/itens.js.
const SLOTS_EQUIPAMENTO = { arma: "arma", arco: "arma_distancia", escudo: "escudo", armadura: "armadura" };

function nomeItem(id) {
  return ITENS[id]?.nome || id;
}

function pesoItem(id) {
  return ITENS[id]?.peso ?? 1;
}

// Carga máxima: base + 10 kg por nível acima do 1º + melhorias da troca de pontos (bonusCarga).
function capacidadeCarga(p) {
  return CARGA_BASE + Math.max(0, (p.nivel || 1) - 1) * CARGA_POR_NIVEL + bonusCarga(p);
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
// Cópia profunda de um objeto de dados (os arquivos de dados/ nunca são alterados em jogo).
function clonarDados(valor) {
  return JSON.parse(JSON.stringify(valor));
}

// Canaã, Deserto e Mar (dados/mundo.js); as regiões dos capítulos entram via registrarArea.
const areas = {};
for (const [id, area] of Object.entries(DADOS_AREAS_BASE)) areas[id] = clonarDados(area);

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

// Regiões dos capítulos (dados/mundo.js), cada uma com seu padrão de obstáculos.
// Obstáculos de cada região (padrões determinísticos).
const PADROES_OBSTACULO = {
  egito: (x, y) => (x * 13 + y * 17) % 29 === 0,
  marVermelho: (x, y) => (x * 11 + y * 19) % 37 === 0,
  sinai: (x, y) => (x * 7 + y * 13) % 17 === 0,
  galileia: (x, y) => (x * 5 + y * 23) % 31 === 0,
};

function criarMapaCapitulo(id) {
  const mapa = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => {
      const borda = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      return borda || PADROES_OBSTACULO[id](x, y) ? 1 : 0;
    }),
  );
  // Estrada principal (linha 56) e trilha central (linha 30).
  for (let x = 1; x < COLS - 1; x++) mapa[56][x] = 0;
  for (let x = 2; x < COLS - 2; x++) mapa[30][x] = 0;
  return mapa;
}

for (const area of Object.values(DADOS_AREAS_CAPITULOS)) {
  registrarArea({ ...area, inicio: { x: 4, y: 56 } }, criarMapaCapitulo(area.id));
}

// ---------------------------------------------------------------------
// NPCs, coletáveis, pesca e inimigos base
// ---------------------------------------------------------------------
// papel: "missao" (dá missões de dados/missoes.js), "loja", "guia", "mural" (atalaia: mural de
// caçadas de dados/tarefas.js, aberto quando requer.missao é concluída) ou, nos capítulos,
// "lider" (dá a missão do capítulo), "apoio" (só conversa) e "mestre" (ensina a Oração).
const npcs = {};

function registrarNpc(npc) {
  npcs[npc.id] = npc;
  abrirClareira(npc.area, npc.x, npc.y, 1);
  return npc;
}

// Todos os NPCs vêm de dados/npcs.js.
for (const npc of DADOS_NPCS) registrarNpc(clonarDados(npc));

// pontosPesca, ervas e odres vêm de dados/mundo.js.

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
  if (e.veneno === "padrao") e.veneno = { ...VENENO_PADRAO };
  inimigos[e.id] = e;
  abrirClareira(e.area, e.x, e.y, 1);
  return e;
}

// Todas as criaturas vêm de dados/criaturas.js.
for (const criatura of DADOS_CRIATURAS) registrarInimigo(clonarDados(criatura));

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
// Missões (dados/missoes.js) — motor genérico, sem missões escritas como código
// ---------------------------------------------------------------------
// Estado no save: p.missoes[id] = { status, etapa, progresso }.
//   status: "nao_iniciada" | "em_andamento" | "concluida";
//   etapa: índice da etapa atual (na missão concluída, a última);
//   progresso: um valor por objetivo da etapa atual — lista de ids de origem ("coletar")
//   ou contagem ("derrotar", "falar", "chegar"; "entregar" fica 0: é conferido na entrega).
const MISSOES = {};
const ORDEM_MISSOES = [];
const MISSOES_POR_NPC = {};
const STATUS_MISSAO = ["nao_iniciada", "em_andamento", "concluida"];

// Aplica o modelo (MODELOS_MISSAO) e os valores padrão de cada etapa e objetivo.
function registrarMissao(dados) {
  const modelo = MODELOS_MISSAO[dados.modelo] || {};
  const padraoEtapa = modelo.etapa || {};
  const missao = {
    ...dados,
    anterior: dados.anterior || null,
    falas: { ...modelo.falas, ...dados.falas },
    painel: { ...modelo.painel, ...dados.painel },
    etapas: dados.etapas.map((etapa) => ({
      recompensa: { xp: 0, moedas: 0, itens: [], ...etapa.recompensa },
      painel: { ...padraoEtapa.painel, ...etapa.painel },
      falas: { ...padraoEtapa.falas, ...etapa.falas },
      objetivos: etapa.objetivos.map((o) => ({
        quantidade: 1,
        ...(o.tipo !== "entregar" && padraoEtapa.aviso ? { aviso: padraoEtapa.aviso } : {}),
        ...o,
      })),
    })),
  };
  MISSOES[missao.id] = missao;
  if (!ORDEM_MISSOES.includes(missao.id)) ORDEM_MISSOES.push(missao.id);
  for (const npcId of new Set([missao.npc, receptorMissao(missao)])) {
    (MISSOES_POR_NPC[npcId] = MISSOES_POR_NPC[npcId] || []).push(missao);
  }
  return missao;
}

function receptorMissao(missao) {
  return missao.npcEntrega || missao.npc;
}

for (const missao of DADOS_MISSOES) registrarMissao(clonarDados(missao));

function estadoMissaoNovo() {
  return { status: "nao_iniciada", etapa: 0, progresso: [] };
}

function estadoMissao(p, missaoId) {
  return p?.missoes?.[missaoId] || estadoMissaoNovo();
}

function missaoConcluida(p, missaoId) {
  return estadoMissao(p, missaoId).status === "concluida";
}

function etapaDaMissao(missao, estado) {
  return missao.etapas[Math.max(0, Math.min(missao.etapas.length - 1, estado.etapa || 0))];
}

function contagemObjetivo(valor) {
  return Array.isArray(valor) ? valor.length : Number(valor) || 0;
}

// Objetivos acompanhados durante a etapa ("entregar" só é conferido na entrega).
function objetivosCumpridos(missao, estado) {
  const etapa = etapaDaMissao(missao, estado);
  return etapa.objetivos.every(
    (o, i) => o.tipo === "entregar" || contagemObjetivo(estado.progresso?.[i]) >= o.quantidade,
  );
}

// Fase da missão do ponto de vista do jogador: "bloqueado" (falta a anterior), "inicio",
// "andamento", "retorno" (objetivos cumpridos, falta entregar) ou "concluido".
function faseMissao(p, missaoId) {
  const missao = MISSOES[missaoId];
  if (!missao) return null;
  if (missao.anterior && !missaoConcluida(p, missao.anterior)) return "bloqueado";
  const estado = estadoMissao(p, missaoId);
  if (estado.status === "nao_iniciada") return "inicio";
  if (estado.status === "em_andamento") return objetivosCumpridos(missao, estado) ? "retorno" : "andamento";
  return "concluido";
}

// Missão seguinte citada no painel após a conclusão.
function proximaMissao(missao) {
  if (missao.proxima) return MISSOES[missao.proxima] || null;
  return ORDEM_MISSOES.map((id) => MISSOES[id]).find((m) => m.anterior === missao.id) || null;
}

// "+80 XP, 25 moedas, 2× Poção de vida, 15 pontos de tarefa" (itens e pontos são opcionais).
function resumoRecompensa(r) {
  const contagem = {};
  for (const item of r.itens || []) contagem[item] = (contagem[item] || 0) + 1;
  const nomes = Object.entries(contagem).map(([item, n]) => (n > 1 ? `${n}× ${nomeItem(item)}` : nomeItem(item)));
  const pontos = r.pontos ? [textoPontos(r.pontos)] : [];
  return [...(r.xp ? [`+${r.xp} XP`] : []), ...(r.moedas ? [`${r.moedas} moedas`] : []), ...nomes, ...pontos].join(", ");
}

// "1 ponto de tarefa" / "15 pontos de tarefa".
function textoPontos(n) {
  return n === 1 ? "1 ponto de tarefa" : `${n} pontos de tarefa`;
}

// Variáveis das falas: {coletados}/{total} vêm do primeiro objetivo da etapa e
// {naMochila} do primeiro objetivo "entregar".
function variaveisMissao(p, missao, estado) {
  const etapa = etapaDaMissao(missao, estado);
  const indice = missao.etapas.indexOf(etapa);
  const primeiro = etapa.objetivos[0];
  const entrega = etapa.objetivos.find((o) => o.tipo === "entregar");
  const progresso = indice === estado.etapa ? estado.progresso || [] : [];
  const proxima = proximaMissao(missao);
  return {
    coletados: Math.min(primeiro.quantidade, contagemObjetivo(progresso[0])),
    total: primeiro.quantidade,
    naMochila: entrega ? p.inventario.filter((x) => x === entrega.item).length : 0,
    nivel: p.nivel,
    npc: npcs[receptorMissao(missao)]?.nome || "o líder",
    etapa: indice + 1,
    etapas: missao.etapas.length,
    peso: pesoCarregado(p),
    capacidade: capacidadeCarga(p),
    recompensa: resumoRecompensa(etapa.recompensa),
    proximaArea: proxima ? areas[npcs[proxima.npc]?.area]?.nome || "" : "",
  };
}

function preencherTexto(texto, variaveis) {
  return String(texto ?? "").replace(/\{(\w+)\}/g, (marca, nome) => (nome in variaveis ? String(variaveis[nome]) : marca));
}

// Missão "da vez" de uma lista: a primeira não concluída (ou a última, se todas acabaram).
function missaoDaVez(p, lista) {
  return lista.find((m) => !missaoConcluida(p, m.id)) || lista[lista.length - 1] || null;
}

function missoesDoNpc(npcId) {
  return MISSOES_POR_NPC[npcId] || [];
}

// ---------------------------------------------------------------------
// Capítulos e portais (dados/capitulos.js e dados/mundo.js)
// ---------------------------------------------------------------------
// Cada capítulo aponta para a sua missão; npc, inimigo e anterior vêm dela.
const CAPITULOS = {};
const ORDEM_CAPITULOS = [];
const PORTAIS = [];

function registrarCapitulo(chave, dados) {
  const missao = MISSOES[dados.missao];
  const alvo = missao?.etapas.flatMap((e) => e.objetivos).find((o) => o.tipo === "derrotar");
  CAPITULOS[chave] = { ...dados, npc: missao?.npc, inimigo: alvo?.criatura || null, anterior: missao?.anterior || null };
  if (!ORDEM_CAPITULOS.includes(chave)) ORDEM_CAPITULOS.push(chave);
}

function registrarPortal(portal) {
  PORTAIS.push(portal);
  abrirCasa(portal.area, portal.x, portal.y);
  abrirCasa(portal.destino, portal.chegada.x, portal.chegada.y);
}

for (const capitulo of DADOS_CAPITULOS) {
  const { chave, ...dados } = clonarDados(capitulo);
  registrarCapitulo(chave, dados);
}
for (const portal of DADOS_PORTAIS) registrarPortal(clonarDados(portal));

function capituloDoInimigo(inimigoId) {
  return ORDEM_CAPITULOS.find((k) => CAPITULOS[k].inimigo === inimigoId) || null;
}

function capituloDaMissao(missaoId) {
  return ORDEM_CAPITULOS.find((k) => CAPITULOS[k].missao === missaoId) || null;
}

function capituloAnteriorConcluido(p, chave) {
  const anterior = CAPITULOS[chave]?.anterior;
  return !anterior || missaoConcluida(p, anterior);
}

// "ao Egito", "à Galileia", "a Canaã": contração da preposição "a" com o
// artigo de cada área (áreas sem entrada aqui usam só "a").
const PREPOSICAO_AREA = {
  canaan: "a",
  deserto: "ao",
  mar: "ao",
  egito: "ao",
  marVermelho: "ao",
  sinai: "ao",
  galileia: "à",
};
function nomeComPreposicao(areaId) {
  return `${PREPOSICAO_AREA[areaId] || "a"} ${areas[areaId]?.nome || areaId}`;
}

// Fase do capítulo do ponto de vista do jogador (a fase da sua missão).
function faseCapitulo(p, chave) {
  return faseMissao(p, CAPITULOS[chave]?.missao) || "bloqueado";
}

// ---------------------------------------------------------------------
// Caçadas (dados/tarefas.js) — tarefas de caça dos atalaias e troca de pontos de tarefa
// ---------------------------------------------------------------------
// Estado no save (só as caçadas que o jogador já tocou):
//   p.tarefas[id] = { ativa, progresso, meta, concluidas, disponivelEm, aceitaEm };
//   p.pontosTarefa (saldo), p.pontosTarefaTotal (ganhos na vida, nunca diminui) e
//   p.trocas[ofertaId] (vezes que a oferta foi trocada).
// O estado de cada caçada é derivado (estadoTarefa), nunca gravado: "bloqueada", "espera",
// "disponivel", "ativa", "cumprida" (meta atingida, falta entregar) ou "guardada" (fora das ativas,
// com o progresso mantido). A espera só começa na entrega; uma caçada aceita nunca expira.
const TAREFAS = {}; // id → caçada normalizada
const ORDEM_TAREFAS = []; // ordem dos dados (ordem no mural)
const OFERTAS_TROCA = {}; // id → oferta normalizada
const ORDEM_OFERTAS = [];
const ESTADOS_ACOMPANHADOS = ["ativa", "cumprida", "guardada"];
const MS_POR_HORA = 3_600_000;

function registrarTarefa(dados) {
  const tarefa = {
    ...dados,
    alvo: { criaturas: [], especies: [], familias: [], area: null, ...dados.alvo },
    requer: { ...dados.requer },
    oculta: dados.oculta === true,
    recompensa: { xp: 0, moedas: 0, pontos: 0, ...dados.recompensa },
    esperaHoras: dados.esperaHoras ?? TIPOS_TAREFA[dados.tipo]?.esperaHoras ?? 0,
  };
  TAREFAS[tarefa.id] = tarefa;
  if (!ORDEM_TAREFAS.includes(tarefa.id)) ORDEM_TAREFAS.push(tarefa.id);
  return tarefa;
}

function registrarOfertaTroca(dados) {
  const oferta = { quantidade: 1, ...dados, requer: { ...dados.requer }, unica: !!dados.melhoria };
  OFERTAS_TROCA[oferta.id] = oferta;
  if (!ORDEM_OFERTAS.includes(oferta.id)) ORDEM_OFERTAS.push(oferta.id);
  return oferta;
}

for (const t of DADOS_TAREFAS) registrarTarefa(clonarDados(t));
for (const o of DADOS_TROCA_PONTOS) registrarOfertaTroca(clonarDados(o));

// O abate conta se a criatura estiver na lista OU for de uma das espécies OU famílias (e da área, se houver).
function casaAlvo(alvo, e) {
  const lista = (chave) => alvo[chave] || [];
  const casa = lista("criaturas").includes(e.id) || lista("especies").includes(e.especie) || lista("familias").includes(e.familia);
  return casa && (!alvo.area || e.area === alvo.area);
}

function esperaMs(tarefa) {
  return tarefa.esperaHoras * MS_POR_HORA;
}

// Pontos da próxima entrega: a primeira de cada caçada ganha o bônus (arredondado para baixo).
function pontosDaEntrega(tarefa, concluidas) {
  const base = tarefa.recompensa.pontos;
  return concluidas === 0 ? Math.floor(base * (1 + REGRAS_TAREFAS.bonusPrimeiraVez)) : base;
}

// Nome de uma oferta da troca: o da melhoria ou o do item ("3× Poção de vida").
function nomeOferta(oferta) {
  if (!oferta) return "";
  if (oferta.melhoria) return oferta.nome;
  return oferta.quantidade > 1 ? `${oferta.quantidade}× ${nomeItem(oferta.item)}` : nomeItem(oferta.item);
}

// "" se o requisito { missao?, nivel?, troca? } está cumprido; se não, a frase do primeiro que falta.
function requisitoPendente(p, requer) {
  const r = requer || {};
  if (r.missao && !missaoConcluida(p, r.missao)) return `concluir a missão “${MISSOES[r.missao]?.nome || r.missao}”`;
  if (r.nivel && (p?.nivel || 1) < r.nivel) return `chegar ao nível ${r.nivel}`;
  if (r.troca && !(p?.trocas?.[r.troca] > 0)) return `ter ${nomeOferta(OFERTAS_TROCA[r.troca]) || r.troca}`;
  return "";
}

// O requisito do atalaia (mural aberto) vem antes do requisito próprio da caçada.
function requisitoDaTarefa(p, t) {
  return requisitoPendente(p, npcs[t.mural]?.requer) || requisitoPendente(p, t.requer);
}

function estadoTarefa(p, tarefaId) {
  const t = TAREFAS[tarefaId];
  if (!t) return null;
  const s = p?.tarefas?.[tarefaId];
  if (s?.ativa) return s.progresso >= s.meta ? "cumprida" : "ativa";
  if (s?.progresso > 0) return "guardada";
  if (requisitoDaTarefa(p, t)) return "bloqueada";
  if (Date.now() < (s?.disponivelEm || 0)) return "espera";
  return "disponivel";
}

// Caçadas ativas (inclusive as cumpridas, que ocupam a vaga até a entrega).
function tarefasAtivas(p) {
  return ORDEM_TAREFAS.filter((id) => p?.tarefas?.[id]?.ativa === true);
}

// "agora", "45 min", "19 h 59 min", "20 h", "6 d 20 h", "2 d" (minutos arredondados para cima).
function textoEspera(ms) {
  if (!(ms > 0)) return "agora";
  const minutos = Math.ceil(ms / 60000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (minutos < 1440) return minutos % 60 ? `${horas} h ${minutos % 60} min` : `${horas} h`;
  const dias = Math.floor(minutos / 1440);
  const resto = Math.floor((minutos % 1440) / 60);
  return resto ? `${dias} d ${resto} h` : `${dias} d`;
}

// Tudo o que a interface mostra de uma caçada (funções puras; a interface nunca altera p.tarefas).
function visaoTarefa(p, tarefaId) {
  const t = TAREFAS[tarefaId];
  if (!t) return null;
  const s = p?.tarefas?.[tarefaId];
  const estado = estadoTarefa(p, tarefaId);
  const meta = s ? s.meta : t.total;
  const area = npcs[t.mural]?.area || null;
  const casam = Object.values(inimigos).filter((e) => casaAlvo(t.alvo, e));
  const concluidas = s?.concluidas || 0;
  return {
    id: t.id,
    nome: t.nome,
    curto: t.curto,
    tipo: t.tipo,
    tipoNome: TIPOS_TAREFA[t.tipo]?.nome || t.tipo,
    mural: t.mural,
    area,
    nomeArea: areas[area]?.nome || "",
    descricao: preencherTexto(t.descricao, { total: meta }),
    valem: [...new Set(casam.map((e) => e.nome))],
    retrato: casam[0]?.id || null,
    meta,
    progresso: s?.progresso || 0,
    estado,
    esperaMs: estado === "espera" ? s.disponivelEm - Date.now() : 0,
    motivo: estado === "bloqueada" ? requisitoDaTarefa(p, t) : "",
    recompensa: { xp: t.recompensa.xp, moedas: t.recompensa.moedas, pontos: t.recompensa.pontos },
    pontosNaEntrega: pontosDaEntrega(t, concluidas),
    primeiraVez: concluidas === 0,
    concluidas,
    aceitaEm: s?.aceitaEm || 0,
  };
}

// Caçadas do mural de um atalaia, na ordem dos dados. As ocultas só aparecem para quem já as acompanha.
function tarefasDoMural(p, npcId) {
  return ORDEM_TAREFAS.filter((id) => TAREFAS[id].mural === npcId)
    .map((id) => visaoTarefa(p, id))
    .filter((v) => !TAREFAS[v.id].oculta || ESTADOS_ACOMPANHADOS.includes(v.estado));
}

// Caçadas que o jogador acompanha: ativas e cumpridas, depois as guardadas (cada grupo por aceitaEm).
function tarefasDoJogador(p) {
  const grupo = (v) => (v.estado === "guardada" ? 1 : 0);
  return ORDEM_TAREFAS.filter((id) => ESTADOS_ACOMPANHADOS.includes(estadoTarefa(p, id)))
    .map((id) => visaoTarefa(p, id))
    .sort((a, b) => grupo(a) - grupo(b) || a.aceitaEm - b.aceitaEm);
}

// Caçadas ativas (não cumpridas) para as quais o abate deste inimigo conta (glifo da lista Batalha).
function tarefasDoInimigo(p, inimigoId) {
  const e = inimigos[inimigoId];
  if (!e) return [];
  return ORDEM_TAREFAS.filter((id) => estadoTarefa(p, id) === "ativa" && casaAlvo(TAREFAS[id].alvo, e))
    .map((id) => visaoTarefa(p, id));
}

function efeitoOferta(oferta) {
  if (oferta.melhoria) return `+${oferta.melhoria.carga} kg de carga, para sempre`;
  const item = ITENS[oferta.item] || {};
  if (item.defesa) return `Defesa ${item.defesa}`;
  if (item.bonus) return `Dano +${item.bonus}`;
  return "";
}

// Ofertas da troca de pontos, na ordem dos dados.
function ofertasDeTroca(p) {
  const saldo = p?.pontosTarefa || 0;
  return ORDEM_OFERTAS.map((id) => {
    const o = OFERTAS_TROCA[id];
    const motivo = requisitoPendente(p, o.requer);
    let estado = "disponivel";
    if (o.unica && p?.trocas?.[id] > 0) estado = "comprada";
    else if (motivo) estado = "bloqueada";
    else if (saldo < o.preco) estado = "semPontos";
    return {
      id,
      nome: nomeOferta(o),
      icone: o.melhoria ? o.icone || null : null,
      item: o.item || null,
      quantidade: o.quantidade,
      efeito: efeitoOferta(o),
      preco: o.preco,
      estado,
      motivo: estado === "bloqueada" ? motivo : "",
      falta: estado === "semPontos" ? o.preco - saldo : 0,
    };
  });
}

// kg a mais das melhorias já trocadas (uma vez por oferta). Defensiva: roda em migrar antes da normalização.
function bonusCarga(p) {
  const trocas = objetoValido(p?.trocas) ? p.trocas : {};
  let bonus = 0;
  for (const id of ORDEM_OFERTAS) {
    if (Number.isInteger(trocas[id]) && trocas[id] > 0) bonus += OFERTAS_TROCA[id].melhoria?.carga || 0;
  }
  return bonus;
}

// Garante p.tarefas, p.pontosTarefa, p.pontosTarefaTotal e p.trocas coerentes (save novo ou antigo).
// Caçadas que saíram dos dados ficam no save intocadas (não contam, não ocupam vaga, não aparecem).
// Ativas acima do limite não são desativadas: só fica bloqueado aceitar outra.
function normalizarTarefas(p, agora) {
  if (!objetoValido(p.tarefas)) p.tarefas = {};
  for (const [id, s] of Object.entries(p.tarefas)) {
    const t = TAREFAS[id];
    if (!t) continue;
    if (!objetoValido(s)) {
      delete p.tarefas[id];
      continue;
    }
    const inteiro = (v, minimo) => Number.isInteger(v) && v >= minimo;
    const instante = (v) => Number.isFinite(v) && v >= 0;
    s.ativa = s.ativa === true;
    s.meta = inteiro(s.meta, 1) ? s.meta : t.total;
    s.progresso = Number.isInteger(s.progresso) ? Math.max(0, Math.min(s.meta, s.progresso)) : 0;
    s.concluidas = inteiro(s.concluidas, 0) ? s.concluidas : 0;
    s.disponivelEm = instante(s.disponivelEm) ? Math.min(s.disponivelEm, agora + esperaMs(t)) : 0; // relógio adiantado
    s.aceitaEm = instante(s.aceitaEm) ? s.aceitaEm : 0;
  }
  const pontos = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  p.pontosTarefa = pontos(p.pontosTarefa);
  p.pontosTarefaTotal = Math.max(pontos(p.pontosTarefaTotal), p.pontosTarefa);
  if (!objetoValido(p.trocas)) p.trocas = {};
  for (const [id, n] of Object.entries(p.trocas)) if (!(Number.isInteger(n) && n >= 0)) delete p.trocas[id];
}

// ---------------------------------------------------------------------
// Textos de missão e balões (para a UI; funções puras)
// ---------------------------------------------------------------------
function textoMissaoDaArea(p, areaId) {
  const lista = ORDEM_MISSOES.map((id) => MISSOES[id]).filter((m) => npcs[m.npc]?.area === areaId);
  const missao = missaoDaVez(p, lista);
  if (!missao) return null;
  const estado = estadoMissao(p, missao.id);
  const fase = faseMissao(p, missao.id);
  const variaveis = variaveisMissao(p, missao, estado);
  const etapa = etapaDaMissao(missao, estado);
  let texto;
  if (fase === "bloqueado") texto = missao.painel.bloqueada;
  else if (fase === "inicio") texto = missao.painel.inicio;
  else if (fase === "andamento") texto = etapa.painel.andamento;
  else if (fase === "retorno") texto = etapa.painel.retorno || etapa.painel.andamento;
  else {
    const cap = CAPITULOS[capituloDaMissao(missao.id)];
    if (cap?.mestre) {
      const mestre = npcs[cap.mestre]?.nome || "o Mestre";
      return preencherTexto(p.oracaoDesbloqueada ? cap.painelMestre.depois : cap.painelMestre.antes, { mestre });
    }
    const proxima = proximaMissao(missao);
    const seguir = proxima && !missaoConcluida(p, proxima.id);
    texto = seguir ? missao.painel.concluida : missao.painel.encerrada || missao.painel.concluida;
  }
  return preencherTexto(texto, variaveis);
}

// Texto curto "Área · objetivo" para TODAS as áreas.
function textoMissaoAtual(p) {
  if (!p) return "";
  const nome = areas[p.area]?.nome || p.area;
  let texto = textoMissaoDaArea(p, p.area);
  if (!texto && p.area === "mar") {
    texto = "Pesque nos pontos marcados (P) ou navegue até um cais: Canaã a oeste, Deserto a leste.";
  }
  return `${nome} · ${texto || "Explore a região."}`;
}

// Balão sobre o NPC: "missao" (!), "andamento" (…), "entregar" (?), "mural" (atalaia com o
// mural aberto e já usado) ou null.
function estadoMissaoNpc(p, npcId) {
  const npc = npcs[npcId];
  if (!p || !npc) return null;
  if (npc.papel === "mestre") {
    return !p.oracaoDesbloqueada && faseCapitulo(p, npc.capitulo) === "concluido" ? "entregar" : null;
  }
  if (npc.papel === "mural") {
    // Caçada cumprida de qualquer região: "?" em todo atalaia, até nos de mural ainda bloqueado.
    if (ORDEM_TAREFAS.some((id) => estadoTarefa(p, id) === "cumprida")) return "entregar";
    if (requisitoPendente(p, npc.requer)) return null;
    const doMural = ORDEM_TAREFAS.filter((id) => TAREFAS[id].mural === npcId);
    return doMural.some((id) => p.tarefas?.[id]) ? "mural" : "missao"; // "!" só até a 1ª caçada aceita neste mural
  }
  const missao = missaoDaVez(p, missoesDoNpc(npcId));
  if (!missao) return null;
  const fase = faseMissao(p, missao.id);
  if (fase === "inicio") return missao.npc === npcId ? "missao" : null;
  if (fase === "andamento") return "andamento";
  if (fase === "retorno") return receptorMissao(missao) === npcId ? "entregar" : "andamento";
  return null;
}

// ---------------------------------------------------------------------
// Estado inicial das missões e migração de saves antigos (v6 ou anterior)
// ---------------------------------------------------------------------
function progressoVazio(missao, etapa) {
  return missao.etapas[etapa].objetivos.map((o) => (o.tipo === "coletar" ? [] : 0));
}

// Converte missaoEliabe, missaoErvas, missaoDeserto e capitulos para p.missoes.
function missoesDeSaveAntigo(p) {
  const objeto = (v) => (objetoValido(v) ? v : {});
  const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  const status = (v, mapa) => mapa[v] || "nao_iniciada";
  const doStatus = { em_andamento: "em_andamento", concluida: "concluida" };
  const missoes = {};
  const eliabe = objeto(p.missaoEliabe);
  missoes.lobo = { status: status(eliabe.status, doStatus), etapa: 0, progresso: [eliabe.loboDerrotado === true ? 1 : 0] };
  const ervas = objeto(p.missaoErvas);
  missoes.ervas = { status: status(ervas.status, doStatus), etapa: 0, progresso: [lista(ervas.ervasMissaoColetadas), 0] };
  const deserto = objeto(p.missaoDeserto);
  const statusDeserto = status(deserto.status, doStatus);
  // Saves sem etapa: a mesma regra da v6 (em andamento → etapa 1; concluída → última).
  const etapaAntiga = Number.isInteger(deserto.etapa) ? deserto.etapa : statusDeserto === "concluida" ? 4 : 1;
  const etapa = Math.max(1, Math.min(3, etapaAntiga));
  const listaEtapa = ["odresMissaoColetados", "venenosMissaoColetados", "insigniasMissaoColetadas"][etapa - 1];
  missoes.deserto = { status: statusDeserto, etapa: etapa - 1, progresso: [lista(deserto[listaEtapa]), 0] };
  const capitulos = objeto(p.capitulos);
  for (const chave of Object.keys(CAPITULOS)) {
    const c = objeto(capitulos[chave]);
    missoes[CAPITULOS[chave].missao] = {
      status: status(c.status, doStatus),
      etapa: 0,
      progresso: [c.alvo === true ? 1 : 0],
    };
  }
  return missoes;
}

// Garante p.missoes[id] coerente com os dados de cada missão.
function normalizarMissoes(p) {
  if (!objetoValido(p.missoes)) p.missoes = {};
  for (const missao of Object.values(MISSOES)) {
    const e = objetoValido(p.missoes[missao.id]) ? p.missoes[missao.id] : estadoMissaoNovo();
    if (!STATUS_MISSAO.includes(e.status)) e.status = "nao_iniciada";
    e.etapa = Number.isInteger(e.etapa) ? Math.max(0, Math.min(missao.etapas.length - 1, e.etapa)) : 0;
    if (e.status === "nao_iniciada") e.etapa = 0;
    const antes = Array.isArray(e.progresso) ? e.progresso : [];
    e.progresso = missao.etapas[e.etapa].objetivos.map((o, i) => {
      if (o.tipo === "coletar") return Array.isArray(antes[i]) ? [...new Set(antes[i].filter((x) => typeof x === "string"))] : [];
      return Number.isInteger(antes[i]) ? Math.max(0, Math.min(o.quantidade, antes[i])) : 0;
    });
    p.missoes[missao.id] = e;
  }
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

    // Missões (motor genérico). Saves até a v6 guardavam cada missão num campo
    // próprio (missaoEliabe, missaoErvas, missaoDeserto, capitulos): o progresso é
    // convertido para p.missoes, inclusive no meio de uma etapa, e os campos saem do save.
    if (!objetoValido(p.missoes)) p.missoes = missoesDeSaveAntigo(p);
    for (const campo of ["missaoEliabe", "missaoErvas", "missaoDeserto", "capitulos"]) delete p[campo];
    normalizarMissoes(p);
    // Caçadas e pontos de tarefa (save v8). Saves até a v7 não têm esses campos: começam vazios.
    normalizarTarefas(p, agora);

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
    if (missaoConcluida(p, "deserto") && !p.atualizacaoDistanciaEntregue) {
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
    if (!novo && versaoAnterior < 8) {
      this.adicionarAviso(
        p,
        "atualizacao_8",
        "Novidade: os atalaias de cada região têm um mural de caçadas. Ganhe XP, moedas e pontos de tarefa " +
          "e troque os pontos por melhorias. Tecla T: suas caçadas.",
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

    // Vida dos inimigos. Saves anteriores à v6 gravaram a vida cheia da
    // tabela antiga (lobo 50, chefe 100, guarda 40…): com o rebalanceamento,
    // todo inimigo vivo volta com a vida máxima nova.
    const vidaAntiga = versaoAnterior < 6;
    for (const e of Object.values(inimigos)) {
      const hp = p.vidaInimigos[e.id];
      if (p.inimigosDerrotados.includes(e.id)) p.vidaInimigos[e.id] = 0;
      else if (vidaAntiga || !Number.isFinite(hp) || hp <= 0) p.vidaInimigos[e.id] = e.vidaMaxima;
      else p.vidaInimigos[e.id] = Math.min(hp, e.vidaMaxima);
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

  // Itens que uma missão em andamento ainda pede como saque: esses saques nunca expiram.
  itensDeMissaoPendentes(p) {
    return this.objetivosAbertos(p)
      .filter(({ objetivo: o }) => o.tipo === "coletar" && o.origem === "saque")
      .map(({ objetivo: o }) => o.item);
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
    this.registrarColeta(p, s.item, s.id, "saque");
    this.salvar(p);
    return { ok: true, itemColetado: s.id, mensagem: `Você pegou: ${nomeItem(s.item)}.` };
  },

  // Ao pisar numa casa, recolhe toda a pilha de saque (item e moedas caem
  // na mesma casa). Itens de missão vêm primeiro. Com a mochila cheia, o
  // passo continua valendo: o resultado é ok e a mensagem explica o que ficou.
  coletarPilhaDeSaque(id, p) {
    const deMissao = this.itensDeMissaoPendentes(p);
    const prioridade = (s) => (s.item && deMissao.includes(s.item) ? 1 : 0);
    const pilha = p.saqueNoChao
      .filter((s) => s.area === p.area && s.x === p.x && s.y === p.y)
      .sort((a, b) => prioridade(b) - prioridade(a));
    if (!pilha.length) return null;
    const coletados = [];
    const nomes = [];
    let moedas = 0;
    let falha = null;
    for (const s of pilha) {
      const r = this.coletarSaque(id, s.id);
      if (!r.ok) {
        falha = falha || r.mensagem;
        continue;
      }
      coletados.push(s.id);
      if (r.moedas) moedas += r.moedas;
      else nomes.push(nomeItem(s.item));
    }
    if (moedas) nomes.push(`${moedas} moedas`);
    const partes = [];
    if (nomes.length) partes.push(`Você pegou: ${nomes.join(", ")}.`);
    if (falha) partes.push(falha);
    if (!coletados.length) this.salvar(p);
    return {
      ok: true,
      itensColetados: coletados,
      itemColetado: coletados[0],
      moedas: moedas || undefined,
      mensagem: partes.join(" "),
    };
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
      case "aceitarTarefa":
        return this.aceitarTarefa(id, comando.tarefaId);
      case "guardarTarefa":
        return this.guardarTarefa(id, comando.tarefaId);
      case "trocarPontos":
        return this.trocarPontos(id, comando.ofertaId);
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

    const aviso = this.registrarChegada(p);
    const pilha = this.coletarPilhaDeSaque(id, p);
    if (pilha) return this.anexarAviso(pilha, aviso);

    const coleta = this.coletarRecurso(id, p);
    if (coleta) return this.anexarAviso(coleta, aviso);

    this.salvar(p);
    return this.anexarAviso({ ok: true }, aviso);
  },

  mudarDeArea(p, area, x, y, mensagem) {
    p.area = area;
    p.x = x;
    p.y = y;
    const aviso = this.registrarChegada(p);
    this.salvar(p);
    return this.anexarAviso({ ok: true, areaAlterada: true, mensagem }, aviso);
  },

  // Acrescenta o aviso de um objetivo cumprido à mensagem de um resultado.
  anexarAviso(r, aviso) {
    if (!aviso) return r;
    return { ...r, mensagem: r.mensagem ? `${r.mensagem} ${aviso}` : aviso };
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
        `Você percorreu a trilha terrestre e chegou ${nomeComPreposicao(destino)}.`,
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
      const novoCapitulo = CAPITULOS[portal.destino] && faseCapitulo(p, portal.destino) === "inicio";
      const dica = novoCapitulo ? " Fale com os personagens para iniciar o capítulo." : "";
      return this.mudarDeArea(
        p,
        portal.destino,
        portal.chegada.x,
        portal.chegada.y,
        `Você chegou ${nomeComPreposicao(portal.destino)}.${dica}`,
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
    this.registrarColeta(p, grupo.item, c.id, "mapa");
    this.salvar(p);
    const mensagem = p.area === "canaan" ? "Você coletou uma erva medicinal." : "Você encontrou um odre de água.";
    return { ok: true, itemColetado: c.id, mensagem };
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
    const conversa = this.registrarConversa(p, npc);
    if (conversa) return conversa;
    if (this.conversaDeMissao(p, npc)) return this.interagirMissao(id, npc);
    if (npc.papel === "mural") return this.interagirMural(id, npc);
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

  // ----- Motor de missões (dados/missoes.js) -----
  // Quem dá missões conversa sobre elas; um NPC com outro papel (loja, guia, mural) só
  // fala da missão enquanto ela está disponível ou em andamento.
  conversaDeMissao(p, npc) {
    const missao = missaoDaVez(p, missoesDoNpc(npc.id));
    if (!missao) return false;
    if (!["loja", "guia", "mural"].includes(npc.papel)) return true;
    return ["inicio", "andamento", "retorno"].includes(faseMissao(p, missao.id));
  },

  // Etapas abertas: [{ missao, estado, objetivo, indice }] das missões em andamento.
  objetivosAbertos(p) {
    const abertos = [];
    for (const missaoId of ORDEM_MISSOES) {
      const missao = MISSOES[missaoId];
      const estado = estadoMissao(p, missaoId);
      if (estado.status !== "em_andamento") continue;
      etapaDaMissao(missao, estado).objetivos.forEach((objetivo, indice) => abertos.push({ missao, estado, objetivo, indice }));
    }
    return abertos;
  },

  // Soma 1 ao objetivo; devolve o aviso (com variáveis) se ele acabou de ser cumprido
  // (ou a cada vez, com repetirAviso), ou "" se não houver aviso.
  avancarObjetivo(p, { missao, estado, objetivo, indice }) {
    const antes = contagemObjetivo(estado.progresso[indice]);
    if (antes < objetivo.quantidade) estado.progresso[indice] = antes + 1;
    const cumpriuAgora = antes < objetivo.quantidade && antes + 1 >= objetivo.quantidade;
    if (!objetivo.aviso || !(cumpriuAgora || (objetivo.repetirAviso && antes >= objetivo.quantidade - 1))) return "";
    return preencherTexto(objetivo.aviso, variaveisMissao(p, missao, estado));
  },

  // Abate de criatura (objetivo "derrotar"). Devolve o aviso para a mensagem do combate.
  registrarAbate(p, inimigoId) {
    let aviso = "";
    for (const aberto of this.objetivosAbertos(p)) {
      if (aberto.objetivo.tipo === "derrotar" && aberto.objetivo.criatura === inimigoId) {
        aviso = this.avancarObjetivo(p, aberto) || aviso;
      }
    }
    return aviso;
  },

  // Coleta de item (objetivo "coletar"): cada coletável do mapa ou saque conta uma vez, pelo id.
  registrarColeta(p, item, origemId, origem) {
    for (const { objetivo: o, estado, indice } of this.objetivosAbertos(p)) {
      if (o.tipo !== "coletar" || o.item !== item || o.origem !== origem) continue;
      const lista = Array.isArray(estado.progresso[indice]) ? estado.progresso[indice] : [];
      if (!lista.includes(origemId)) lista.push(origemId);
      estado.progresso[indice] = lista;
    }
  },

  // Chegada a um local (objetivo "chegar"): a área, ou a até "raio" casas de x, y.
  registrarChegada(p) {
    const avisos = [];
    for (const aberto of this.objetivosAbertos(p)) {
      const o = aberto.objetivo;
      if (o.tipo !== "chegar" || o.area !== p.area) continue;
      if (Number.isInteger(o.x) && distanciaChebyshev(p, o) > (o.raio || 0)) continue;
      if (contagemObjetivo(aberto.estado.progresso[aberto.indice]) >= o.quantidade) continue;
      const aviso = this.avancarObjetivo(p, aberto);
      if (aviso) avisos.push(aviso);
    }
    return avisos.join(" ");
  },

  // Conversa com um NPC pedido por um objetivo "falar". Devolve a resposta (fala do
  // objetivo, ou o cumprimento padrão, e o aviso) ou null se nenhum objetivo pedia esse NPC.
  registrarConversa(p, npc) {
    const abertos = this.objetivosAbertos(p).filter(
      ({ objetivo: o, estado, indice }) =>
        o.tipo === "falar" && o.npc === npc.id && contagemObjetivo(estado.progresso[indice]) < o.quantidade,
    );
    if (!abertos.length) return null;
    const avisos = abertos.map((aberto) => this.avancarObjetivo(p, aberto)).filter(Boolean);
    const fala = abertos.find((a) => a.objetivo.fala)?.objetivo.fala || "A paz esteja com você.";
    this.salvar(p);
    return this.anexarAviso({ ok: true, mensagem: `${npc.nome}: ${fala}` }, avisos.join(" "));
  },

  // Começa uma etapa: zera o progresso e faz os coletáveis pedidos reaparecerem.
  iniciarEtapa(p, missao, estado, etapa) {
    estado.etapa = etapa;
    estado.progresso = progressoVazio(missao, etapa);
    for (const o of missao.etapas[etapa].objetivos) {
      if (o.tipo !== "coletar" || !o.reaparecer) continue;
      for (const grupo of Object.values(COLETAVEIS_POR_AREA)) {
        if (grupo.item !== o.item) continue;
        // As plantas (ou odres) reaparecem para a missão, sem apagar o que está na mochila.
        p[grupo.coletados] = [];
        for (const c of grupo.lista) p[grupo.respawn][c.id] = Date.now();
      }
    }
  },

  // Conversa com quem dá ou recebe missões: inicia, comenta o andamento ou entrega.
  interagirMissao(id, npc) {
    const p = this.jogadores[id];
    const missao = missaoDaVez(p, missoesDoNpc(npc.id));
    const estado = estadoMissao(p, missao.id);
    const fase = faseMissao(p, missao.id);
    const etapa = etapaDaMissao(missao, estado);
    const capitulo = capituloDaMissao(missao.id);
    const falar = (texto) => ({
      ok: true,
      mensagem: `${npc.nome}: ${preencherTexto(texto, variaveisMissao(p, missao, estado))}`,
    });
    if (fase === "bloqueado") {
      return falar(npc.falas?.bloqueado || missao.falas.bloqueada || "Conclua primeiro a missão anterior.");
    }
    if (fase === "concluido") return falar(missao.falas.concluida || "A paz esteja com você.");
    if (fase === "inicio") {
      if (npc.id !== missao.npc) return falar(npc.falas?.inicio || "A paz esteja com você.");
      p.missoes[missao.id] = { status: "em_andamento", etapa: 0, progresso: [] };
      this.iniciarEtapa(p, missao, p.missoes[missao.id], 0);
      this.salvar(p);
      return {
        ...falar(missao.falas.inicio),
        ...(missao.sinalAoIniciar ? { [missao.sinalAoIniciar]: true } : {}),
        ...(capitulo ? { capituloIniciado: capitulo } : {}),
      };
    }
    if (fase === "andamento" || npc.id !== receptorMissao(missao)) return falar(etapa.falas.andamento);
    return this.entregarEtapa(p, missao, estado, etapa, falar, capitulo);
  },

  // fase "retorno": confere as entregas e a mochila, dá a recompensa e avança a etapa.
  entregarEtapa(p, missao, estado, etapa, falar, capitulo) {
    const entregas = etapa.objetivos.filter((o) => o.tipo === "entregar");
    for (const o of entregas) {
      if (p.inventario.filter((x) => x === o.item).length < o.quantidade) {
        return falar(etapa.falas.faltamItens || etapa.falas.andamento);
      }
    }
    const r = etapa.recompensa;
    const remocoes = entregas.map((o) => [o.item, o.quantidade]);
    if (r.itens.length && !this.podeReceberComRemocao(p, r.itens, remocoes)) return falar(etapa.falas.mochilaCheia);
    for (const o of entregas) this.removerItens(p, o.item, o.quantidade);
    for (const item of r.itens) this.adicionarItem(p, item);
    p.moedas += r.moedas;
    const niveis = adicionarXP(p, r.xp);
    const resposta = falar(`${etapa.falas.concluir}${niveis.length ? missao.falas.subiuNivel || "" : ""}`);
    const ultima = estado.etapa >= missao.etapas.length - 1;
    if (ultima) estado.status = "concluida";
    else this.iniciarEtapa(p, missao, estado, estado.etapa + 1);
    this.salvar(p);
    return ultima && capitulo ? { ...resposta, capituloConcluido: capitulo } : resposta;
  },

  // NPCs de capítulo sem missão própria: "apoio" (falas por fase) e "mestre" (Oração).
  interagirCapitulo(id, npc) {
    const p = this.jogadores[id];
    const fase = faseCapitulo(p, npc.capitulo);
    const falar = (texto) => ({ ok: true, mensagem: `${npc.nome}: ${texto}` });
    if (fase === "bloqueado")
      return falar(npc.falas?.bloqueado || "Conclua primeiro o capítulo anterior para chegar a esta etapa.");
    if (npc.papel === "mestre") return this.interagirMestre(id, npc);
    return falar(npc.falas?.[fase] || npc.falas?.andamento || "A paz esteja com você.");
  },

  interagirMestre(id, npc) {
    const p = this.jogadores[id];
    const chave = npc.capitulo;
    const falar = (texto) => ({ ok: true, mensagem: `${npc.nome}: ${texto}` });
    if (!missaoConcluida(p, CAPITULOS[chave].missao) && !p.oracaoDesbloqueada) return falar(npc.falas.antes);
    if (!p.oracaoDesbloqueada) {
      p.oracaoDesbloqueada = true;
      p.fe = FE_MAXIMA;
      this.salvar(p);
      return { ...falar(npc.falas.ensino), oracaoAprendida: true };
    }
    return falar(npc.falas.depois);
  },

  // ----- Caçadas (atalaias, dados/tarefas.js) -----
  // Atalaia ao lado com o mural já aberto (só ele aceita a troca de pontos).
  muralProximo(p) {
    return this.npcProximo(p, (n) => n.papel === "mural" && !requisitoPendente(p, n.requer));
  },

  // Conversa com um atalaia: entrega todas as caçadas cumpridas (de qualquer região, mesmo com o
  // mural deste atalaia bloqueado) e, se o mural estiver aberto, pede à interface que o abra.
  interagirMural(id, npc) {
    const p = this.jogadores[id];
    const falas = { ...FALAS_MURAL, ...npc.falas };
    const entrega = this.entregarTarefas(p);
    const pendente = requisitoPendente(p, npc.requer);
    const entregou = entrega.entregues.length > 0;
    const partes = [];
    if (entregou) {
      const recompensa = entrega.entregues
        .map((t) => `${t.nome} (${resumoRecompensa({ xp: t.xp, moedas: t.moedas, pontos: t.pontos })})`)
        .join("; ");
      const subiu = entrega.niveis.length ? preencherTexto(falas.subiuNivel, { nivel: p.nivel }) : "";
      partes.push(`${preencherTexto(falas.entrega, { recompensa })}${subiu}`);
    }
    if (pendente) partes.push(preencherTexto(falas.bloqueado, { requisito: pendente }));
    else if (!entregou) partes.push(preencherTexto(falas.saudacao, {}));
    this.salvar(p);
    return {
      ok: true,
      mensagem: `${npc.nome.split(",")[0]}: ${partes.join(" ")}`,
      ...(pendente ? {} : { abrirMural: npc.id }),
      ...(entregou ? { tarefasEntregues: entrega.entregues, niveis: entrega.niveis } : {}),
    };
  },

  // Entrega (sem comando próprio: acontece ao falar com qualquer atalaia). A recompensa é XP,
  // moedas e pontos de tarefa, nunca itens: a mochila cheia não bloqueia a entrega.
  entregarTarefas(p) {
    const entregues = [];
    const niveis = [];
    for (const id of ORDEM_TAREFAS) {
      if (estadoTarefa(p, id) !== "cumprida") continue;
      const t = TAREFAS[id];
      const s = p.tarefas[id];
      const primeiraVez = s.concluidas === 0;
      const pontos = pontosDaEntrega(t, s.concluidas);
      p.moedas += t.recompensa.moedas;
      niveis.push(...adicionarXP(p, t.recompensa.xp));
      p.pontosTarefa += pontos;
      p.pontosTarefaTotal += pontos;
      s.ativa = false;
      s.progresso = 0;
      s.meta = t.total;
      s.concluidas += 1;
      s.disponivelEm = Date.now() + esperaMs(t); // a espera só começa na entrega
      entregues.push({ id, nome: t.nome, xp: t.recompensa.xp, moedas: t.recompensa.moedas, pontos, primeiraVez });
    }
    return { entregues, niveis };
  },

  // Aceita (ou retoma, se estava guardada) uma caçada, ao lado do atalaia do mural dela.
  // Em toda recusa nada muda no save; a ordem das checagens é a do contrato com a interface.
  aceitarTarefa(id, tarefaId) {
    const p = this.jogadores[id];
    const t = TAREFAS[tarefaId];
    if (!t) return { ok: false, mensagem: "Caçada desconhecida." };
    const nomeArea = areas[npcs[t.mural]?.area]?.nome || "";
    if (!this.npcProximo(p, (n) => n.id === t.mural)) {
      return { ok: false, mensagem: `Fale com o atalaia (${nomeArea}) para aceitar esta caçada.` };
    }
    const estado = estadoTarefa(p, tarefaId);
    if (estado === "ativa" || estado === "cumprida") return { ok: false, mensagem: "Você já acompanha esta caçada." };
    if (estado === "bloqueada") return { ok: false, mensagem: `Para aceitar, é preciso ${requisitoDaTarefa(p, t)}.` };
    if (t.oculta && estado !== "guardada") return { ok: false, mensagem: "Esta caçada não está mais no mural." };
    if (estado === "espera") {
      const falta = p.tarefas[tarefaId].disponivelEm - Date.now();
      return { ok: false, mensagem: `Esta caçada volta ao mural em ${textoEspera(falta)}.` };
    }
    const limite = REGRAS_TAREFAS.limiteAtivas;
    if (tarefasAtivas(p).length >= limite) {
      return { ok: false, mensagem: `Você já acompanha ${limite} caçadas. Guarde uma para aceitar outra.` };
    }
    const retomada = estado === "guardada";
    const s = p.tarefas[tarefaId] || { ativa: false, progresso: 0, meta: t.total, concluidas: 0, disponivelEm: 0, aceitaEm: 0 };
    if (!retomada) {
      s.progresso = 0;
      s.meta = t.total;
    }
    s.ativa = true;
    s.aceitaEm = Date.now();
    p.tarefas[tarefaId] = s;
    this.salvar(p);
    const mensagem = retomada
      ? `Caçada retomada: ${t.nome} (${s.progresso}/${s.meta}).`
      : `Caçada aceita: ${t.nome} (0/${s.meta}).`;
    return { ok: true, tarefaId, retomada, mensagem };
  },

  // Guarda uma caçada ativa (de qualquer lugar): sai das ativas, mantém o progresso e libera a vaga.
  guardarTarefa(id, tarefaId) {
    const p = this.jogadores[id];
    const t = TAREFAS[tarefaId];
    if (!t) return { ok: false, mensagem: "Caçada desconhecida." };
    const estado = estadoTarefa(p, tarefaId);
    if (estado === "cumprida") return { ok: false, mensagem: "Esta caçada já foi cumprida: entregue-a a qualquer atalaia." };
    if (estado !== "ativa") return { ok: false, mensagem: "Esta caçada não está ativa." };
    const s = p.tarefas[tarefaId];
    s.ativa = false;
    this.salvar(p);
    const nomeArea = areas[npcs[t.mural]?.area]?.nome || "";
    return {
      ok: true,
      tarefaId,
      mensagem: `Caçada guardada com ${s.progresso}/${s.meta}. Para retomar, fale com o atalaia (${nomeArea}).`,
    };
  },

  // Troca de pontos de tarefa (ao lado de um atalaia com o mural aberto). Pontos nunca viram moedas.
  trocarPontos(id, ofertaId) {
    const p = this.jogadores[id];
    const o = OFERTAS_TROCA[ofertaId];
    if (!o) return { ok: false, mensagem: "Essa troca não existe." };
    if (!this.muralProximo(p)) return { ok: false, mensagem: "Aproxime-se de um atalaia para trocar pontos." };
    const nome = nomeOferta(o);
    if (o.unica && p.trocas[ofertaId] > 0) return { ok: false, mensagem: `Você já tem ${nome}.` };
    const motivo = requisitoPendente(p, o.requer);
    if (motivo) return { ok: false, mensagem: `Para trocar, é preciso ${motivo}.` };
    if (p.pontosTarefa < o.preco) {
      const falta = o.preco - p.pontosTarefa;
      return { ok: false, mensagem: `${falta === 1 ? "Falta" : "Faltam"} ${textoPontos(falta)}.` };
    }
    const itens = o.item ? Array(o.quantidade).fill(o.item) : [];
    if (itens.length && !this.podeReceberComRemocao(p, itens)) {
      return { ok: false, mensagem: this.mensagemMochilaCheia(p, `Libere espaço para receber ${nome}.`) };
    }
    p.pontosTarefa -= o.preco;
    for (const item of itens) this.adicionarItem(p, item);
    p.trocas[ofertaId] = (p.trocas[ofertaId] || 0) + 1;
    this.salvar(p);
    const efeito = o.melhoria ? ` (+${o.melhoria.carga} kg de carga)` : "";
    return {
      ok: true,
      ofertaId,
      pontos: p.pontosTarefa,
      mensagem: `Troca feita: ${nome}${efeito} por ${textoPontos(o.preco)}. Saldo: ${p.pontosTarefa}.`,
    };
  },

  // Abate de criatura: +1 em todas as caçadas ativas cujo alvo casa com ela, até a meta.
  // Devolve só as que avançaram: [{ id, nome, curto, progresso, meta, cumpridaAgora }].
  registrarAbateTarefas(p, e) {
    const avancos = [];
    for (const id of ORDEM_TAREFAS) {
      const s = p.tarefas?.[id];
      const t = TAREFAS[id];
      if (!s?.ativa || s.progresso >= s.meta || !casaAlvo(t.alvo, e)) continue;
      s.progresso += 1;
      avancos.push({ id, nome: t.nome, curto: t.curto, progresso: s.progresso, meta: s.meta, cumpridaAgora: s.progresso >= s.meta });
    }
    return avancos;
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
        tarefas: morte.tarefas,
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
    const aviso = this.registrarAbate(p, e.id);
    const objetivo = aviso ? ` ${aviso}` : "";
    const tarefas = this.registrarAbateTarefas(p, e);
    // A mensagem só cita a caçada quando ela é cumprida (o progresso aparece nos números do mundo).
    const cacada = tarefas
      .filter((t) => t.cumpridaAgora)
      .map((t) => ` Caçada cumprida: ${t.nome} (${t.meta}/${t.meta})! Entregue a qualquer atalaia.`)
      .join("");
    const niveis = adicionarXP(p, e.xpRecompensa);
    const saque = this.criarSaque(p, e, agora);
    this.salvar(p);
    const up = niveis.length ? ` Você subiu para o nível ${p.nivel}! Vida máxima: ${vidaMaxima(p)}.` : "";
    const textoSaque = saque.length ? ` Saque no chão: ${saque.join(", ")}. Clique no saque ou caminhe sobre ele.` : "";
    const reaparece = ` Ele reaparecerá em ${TEMPO_RESPAWN_INIMIGO / 1000} segundos.`;
    return {
      saques: p.saqueNoChao.filter((s) => s.area === p.area && s.x === e.x && s.y === e.y).map((s) => s.id),
      tarefas,
      mensagem: `Você derrotou ${e.nome.toLowerCase()}! +${e.xpRecompensa} XP.${up}${objetivo}${cacada}${textoSaque}${reaparece}`,
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
    // Os ticks seguem a grade do envenenamento (t+3 s, t+6 s, … t+15 s) e o
    // tick que coincide com o fim ainda é aplicado: 15 s / 3 s = 5 ticks.
    if (p.envenenadoAte) {
      const veneno = p.venenoAtual || VENENO_PADRAO;
      const tickPendente = agora >= p.proximoDanoVeneno && p.proximoDanoVeneno <= p.envenenadoAte;
      if (!tickPendente && agora >= p.envenenadoAte) {
        this.curarVeneno(p);
        this.salvar(p);
        eventos.push({ tipo: "venenoTerminou", mensagem: "O veneno perdeu o efeito." });
      } else if (tickPendente) {
        p.proximoDanoVeneno += veneno.intervalo;
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
