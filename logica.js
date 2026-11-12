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
const COLS = DADOS_TAMANHO_MAPA.colunas; // dados/mapas.js
const ROWS = DADOS_TAMANHO_MAPA.linhas;
const VERSAO_SAVE = 12;
const ESCALA_MAPAS_V8 = 2; // os mapas passaram de 80×60 (save v8) para 160×120 (save v9)

const VIDA_BASE = 100;
const VIDA_POR_NIVEL = 10;
const NIVEL_MAXIMO = 100;
const XP_NIVEIS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];
const XP_POR_NIVEL_APOS_TABELA = 650; // custo do nível 11
const XP_ACRESCIMO_POR_NIVEL = 150; // cada nível depois do 11 custa 150 XP a mais que o anterior
// Criatura muito mais fraca que você rende menos XP: até XP_FOLGA_NIVEIS de diferença, XP cheio;
// depois, cai XP_QUEDA_POR_NIVEL por nível de diferença, até XP_FATOR_MINIMO.
const XP_FOLGA_NIVEIS = 5;
const XP_QUEDA_POR_NIVEL = 0.15;
const XP_FATOR_MINIMO = 0.1;

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
const ALCANCE_ARCO = 6; // em qualquer direção (círculo de 6 casas), sem obstáculos no caminho da flecha

const TEMPO_RESPAWN_INIMIGO = 5000;
const TEMPO_RESPAWN_COLETAVEL = 18000;
const TEMPO_RESPAWN_PESCA = 12000;
const TEMPO_EXPIRACAO_SAQUE = 10 * 60 * 1000;
const LIMITE_SAQUES_NO_CHAO = 60;
const INTERVALO_LIMPEZA_SAQUES = 5000;
// Analisador de caçada (JGB-10): as taxas por hora só aparecem depois deste tempo de sessão (antes, um
// único abate viraria milhares de XP/h).
const ANALISADOR_MINIMO_MS = 60 * 1000;

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

// Registro de uma tabela (ITENS, PRECOS_LOJA, TAREFAS...) pelo id que vem de fora (comando ou save).
// Só chaves próprias: "constructor", "toString" ou "__proto__" achariam o que vem de Object.prototype
// e virariam NaN no saldo, nas moedas ou na fé.
function registroDe(tabela, id) {
  return typeof id === "string" && Object.hasOwn(tabela, id) ? tabela[id] : undefined;
}

// ---------------------------------------------------------------------
// Raridades e atributos aleatórios
// ---------------------------------------------------------------------
// RARIDADES, ATRIBUTOS_ITEM, SORTEIO_RARIDADE e CHANCES_SAQUE vêm de dados/itens.js.
// Um equipamento acima de comum é guardado como um texto que se descreve sozinho:
// "<item>@<raridade>[.<atributo><valor>]…", por exemplo "espada_ferro@epico.critico3.dano4" (os atributos
// na ordem de ATRIBUTOS_ITEM). Mochila, equipamento, saques no chão e save continuam listas de textos;
// dois itens com o mesmo sorteio são iguais e se empilham. O valor do atributo principal (dano da arma
// ou do arco, defesa do escudo ou da armadura) já inclui a melhoria da raridade.
const ORDEM_RARIDADES = Object.keys(RARIDADES);
const ORDEM_ATRIBUTOS = Object.keys(ATRIBUTOS_ITEM);
const TIPOS_COM_RARIDADE = new Set(Object.values(SLOTS_EQUIPAMENTO));
const CRITICO_EQUIPAMENTO_MAXIMO = 25; // soma dos atributos de crítico do equipamento, em pontos de %
const cacheItens = new Map();

// Id do item da tabela ITENS ("espada_ferro@raro.dano2" → "espada_ferro").
function baseItem(id) {
  return typeof id === "string" ? id.split("@")[0] : id;
}

function indiceRaridade(raridade) {
  return ORDEM_RARIDADES.indexOf(raridade);
}

function atributoPrincipal(tipo) {
  if (tipo === "arma" || tipo === "arma_distancia") return "dano";
  if (tipo === "escudo" || tipo === "armadura") return "defesa";
  return null;
}

// Maior valor que um atributo pode ter (confere saves): maior faixa + maior melhoria.
function tetoAtributo(chave) {
  const faixas = Object.values(ATRIBUTOS_ITEM[chave].faixas);
  const melhoria = Math.max(...Object.values(RARIDADES).map((r) => r.melhoria || 0));
  return Math.max(...faixas.map((f) => f[1])) + melhoria;
}

// Texto canônico de um item com raridade e atributos.
function codigoItem(base, raridade, atributos = {}) {
  if (!raridade || raridade === "comum") return base;
  const partes = ORDEM_ATRIBUTOS.filter((k) => atributos[k] > 0).map((k) => `${k}${atributos[k]}`);
  return [`${base}@${raridade}`, ...partes].join(".");
}

function lerItem(id) {
  if (typeof id !== "string") return null;
  const [base, resto, ...sobra] = id.split("@");
  const d = registroDe(ITENS, base);
  if (!d || sobra.length) return null;
  const montar = (raridade, atributos) => ({
    ...d,
    id,
    base,
    raridade,
    atributos,
    nome: raridade !== (d.raridade || "comum") ? `${d.nome} (${RARIDADES[raridade].nome})` : d.nome,
    bonus: (d.bonus || 0) + (atributos.dano || 0),
    defesa: (d.defesa || 0) + (atributos.defesa || 0),
  });
  if (resto === undefined) return montar(registroDe(RARIDADES, d.raridade) ? d.raridade : "comum", {});
  if (!TIPOS_COM_RARIDADE.has(d.tipo)) return null;
  const [raridade, ...partes] = resto.split(".");
  const r = registroDe(RARIDADES, raridade);
  if (!r || raridade === "comum") return null;
  const atributos = {};
  for (const parte of partes) {
    const m = /^([a-z]+)([1-9]\d{0,2})$/.exec(parte);
    const def = m && registroDe(ATRIBUTOS_ITEM, m[1]);
    if (!def || !def.tipos.includes(d.tipo) || m[1] in atributos) return null;
    if (Number(m[2]) > tetoAtributo(m[1])) return null;
    atributos[m[1]] = Number(m[2]);
  }
  if (Object.keys(atributos).length > r.atributos + 1) return null; // +1: a melhoria do principal
  if (codigoItem(base, raridade, atributos) !== id) return null; // só a forma canônica
  return montar(raridade, atributos);
}

// Descrição completa de um item (base + raridade + atributos), ou null se o id não for válido.
// O objeto vem de um cache: só leia.
function infoItem(id) {
  if (cacheItens.has(id)) return cacheItens.get(id);
  const info = lerItem(id);
  if (typeof id === "string") {
    if (cacheItens.size > 4000) cacheItens.clear();
    cacheItens.set(id, info);
  }
  return info;
}

function itemValido(id) {
  return !!infoItem(id);
}

function raridadeItem(id) {
  return infoItem(id)?.raridade || "comum";
}

// Linhas de atributo para a interface ("+3 de dano", "+2% de chance de crítico"…), na ordem dos dados.
// Só os atributos acima do item base: o dano ou a defesa base aparecem à parte.
function textoAtributos(id) {
  const info = infoItem(id);
  if (!info) return [];
  return ORDEM_ATRIBUTOS.filter((k) => info.atributos[k] > 0).map((k) =>
    ATRIBUTOS_ITEM[k].texto.replace("{v}", String(info.atributos[k])),
  );
}

// Sorteia a raridade (pesos de SORTEIO_RARIDADE), sem as raridades abaixo de "minima".
function sortearRaridade(minima, aleatorio = Math.random) {
  const corte = Math.max(0, indiceRaridade(minima));
  const opcoes = ORDEM_RARIDADES.filter((r, i) => i >= corte && SORTEIO_RARIDADE[r] > 0);
  if (!opcoes.length) return ORDEM_RARIDADES[corte] || "comum";
  const total = opcoes.reduce((s, r) => s + SORTEIO_RARIDADE[r], 0);
  let sorteio = aleatorio() * total;
  for (const r of opcoes) {
    sorteio -= SORTEIO_RARIDADE[r];
    if (sorteio < 0) return r;
  }
  return opcoes[opcoes.length - 1];
}

// Cria um equipamento da raridade pedida, com a melhoria e os atributos aleatórios dela.
// Itens que não são equipamento (ou raridade comum) voltam como o id base.
function gerarItem(base, raridade, aleatorio = Math.random) {
  const d = registroDe(ITENS, base);
  const r = registroDe(RARIDADES, raridade);
  if (!d || !r || raridade === "comum" || !TIPOS_COM_RARIDADE.has(d.tipo)) return base;
  const atributos = {};
  const principal = atributoPrincipal(d.tipo);
  if (r.melhoria && principal) atributos[principal] = r.melhoria;
  const possiveis = ORDEM_ATRIBUTOS.filter((k) => ATRIBUTOS_ITEM[k].tipos.includes(d.tipo) && ATRIBUTOS_ITEM[k].faixas[raridade]);
  for (let i = 0; i < r.atributos && possiveis.length; i++) {
    const k = possiveis.splice(Math.floor(aleatorio() * possiveis.length), 1)[0];
    const [min, max] = ATRIBUTOS_ITEM[k].faixas[raridade];
    atributos[k] = Math.min(tetoAtributo(k), (atributos[k] || 0) + min + Math.floor(aleatorio() * (max - min + 1)));
  }
  return codigoItem(base, raridade, atributos);
}

// ---------------------------------------------------------------------
// Tabelas de saque
// ---------------------------------------------------------------------
// Chance de uma linha da tabela (número de 0 a 1 ou nome de CHANCES_SAQUE).
function chanceSaque(chance) {
  const valor = typeof chance === "string" ? registroDe(CHANCES_SAQUE, chance) : chance;
  return Number.isFinite(valor) ? Math.max(0, Math.min(1, valor)) : 0;
}

// Linhas da tabela de saque de uma criatura (aceita a forma antiga, só com ids: sempre caem).
function tabelaDeSaque(e) {
  return (e?.saque?.itens || []).map((linha) => (typeof linha === "string" ? { item: linha, chance: 1 } : linha));
}

// Item que uma linha da tabela gera: equipamento sorteia a raridade (ou usa a fixa da linha).
function itemDaLinha(linha, aleatorio = Math.random) {
  const d = registroDe(ITENS, linha.item);
  if (!d || !TIPOS_COM_RARIDADE.has(d.tipo)) return linha.item;
  const raridade = registroDe(RARIDADES, linha.raridade) ? linha.raridade : sortearRaridade(linha.raridadeMinima, aleatorio);
  return gerarItem(linha.item, raridade, aleatorio);
}

// Sorteia o saque de um abate: cada linha da tabela é sorteada à parte (a de 100% não gasta sorteio).
// Devolve [{ item, chance }] na ordem da tabela.
// raridadeMinima (campeões): o equipamento sai dela para cima.
function sortearSaque(e, aleatorio = Math.random, raridadeMinima = null) {
  const saque = [];
  for (const linha of tabelaDeSaque(e)) {
    const chance = chanceSaque(linha.chance ?? 1);
    if (chance <= 0 || (chance < 1 && aleatorio() >= chance)) continue;
    const minima = raridadeMinima && indiceRaridade(raridadeMinima) > indiceRaridade(linha.raridadeMinima || "comum") ? raridadeMinima : linha.raridadeMinima;
    const item = itemDaLinha(minima === linha.raridadeMinima ? linha : { ...linha, raridadeMinima: minima }, aleatorio);
    if (itemValido(item)) saque.push({ item, chance });
  }
  return saque;
}

// Destaque de um saque que acabou de cair: a raridade do item, e pelo menos "raro" se a linha da
// tabela tinha 1% de chance ou menos (o drop raro sempre brilha e toca, mesmo sendo um item comum).
function destaqueDoSaque(item, chance) {
  const r = raridadeItem(item);
  if (chance <= CHANCES_SAQUE.raro && indiceRaridade(r) < indiceRaridade("raro")) return "raro";
  return r;
}

// "1%", "0,1%", "25%".
function textoChance(chance) {
  const pct = chance * 100;
  return `${String(Math.round(pct * 100) / 100).replace(".", ",")}%`;
}

// ---------------------------------------------------------------------
// Itens e equipamento
// ---------------------------------------------------------------------
function nomeItem(id) {
  return infoItem(id)?.nome || ITENS[id]?.nome || id;
}

function pesoItem(id) {
  return infoItem(id)?.peso ?? 1;
}

// Soma de um atributo em todo o equipamento vestido.
function atributoEquipado(p, chave) {
  return Object.values(p?.equipamento || {}).reduce((soma, item) => soma + (item ? infoItem(item)?.atributos[chave] || 0 : 0), 0);
}

// Carga máxima: base + 10 kg por nível acima do 1º + melhorias da troca de pontos (bonusCarga)
// + atributo de carga do equipamento.
function capacidadeCarga(p) {
  return CARGA_BASE + Math.max(0, (p.nivel || 1) - 1) * CARGA_POR_NIVEL + bonusCarga(p) + atributoEquipado(p, "carga");
}

function pesoCarregado(p) {
  const pesoBolsa = p.inventario.reduce((soma, item) => soma + pesoItem(item), 0);
  const pesoEquipado = Object.values(p.equipamento || {}).reduce((soma, item) => soma + (item ? pesoItem(item) : 0), 0);
  return Math.round((pesoBolsa + pesoEquipado) * 10) / 10;
}

function defesaEquipamento(p) {
  return Object.values(p.equipamento || {}).reduce((soma, item) => soma + (item ? infoItem(item)?.defesa || 0 : 0), 0);
}

function curaPocao(p) {
  return Math.max(CURA_POCAO, Math.round(vidaMaxima(p) * CURA_POCAO_PERCENTUAL));
}

function bonusArma(p) {
  const item = p.equipamento?.arma;
  return item ? infoItem(item)?.bonus || 0 : 0;
}

function bonusArco(p) {
  const item = p.equipamento?.arco;
  return item ? infoItem(item)?.bonus || 0 : 0;
}

// Chance de crítico vinda do equipamento, em pontos de % (no máximo CRITICO_EQUIPAMENTO_MAXIMO).
function criticoEquipamento(p) {
  return Math.min(CRITICO_EQUIPAMENTO_MAXIMO, atributoEquipado(p, "critico"));
}

// ---------------------------------------------------------------------
// Níveis do personagem
// ---------------------------------------------------------------------
// Vida máxima = base + 10 por nível acima do 1º + atributo de vida do equipamento.
function vidaMaxima(personagem) {
  return VIDA_BASE + Math.max(0, (personagem.nivel || 1) - 1) * VIDA_POR_NIVEL + atributoEquipado(personagem, "vida");
}

// XP total necessário para sair do nível informado.
function limiarNivel(nivel) {
  if (nivel < XP_NIVEIS.length) return XP_NIVEIS[nivel];
  // Depois da tabela, o custo de cada nível cresce: 650, 800, 950... (soma de progressão aritmética).
  const m = nivel - XP_NIVEIS.length + 1;
  return XP_NIVEIS[XP_NIVEIS.length - 1] + m * XP_POR_NIVEL_APOS_TABELA + (XP_ACRESCIMO_POR_NIVEL * m * (m - 1)) / 2;
}

// XP que um abate rende para o personagem (criatura sem "nivel" nos dados rende sempre o XP cheio).
function xpDoAbate(p, e) {
  const base = e.xpRecompensa || 0;
  if (!Number.isInteger(e.nivel)) return base;
  const acima = (p.nivel || 1) - e.nivel - XP_FOLGA_NIVEIS;
  if (acima <= 0) return base;
  const fator = Math.max(XP_FATOR_MINIMO, 1 - XP_QUEDA_POR_NIVEL * acima);
  return Math.max(1, Math.round(base * fator));
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

// Chance de crítico em % (5% com habilidade 0 até 25% com habilidade 100), mais o crítico do equipamento.
function chanceCritico(p, tipo) {
  const n = nivelHabilidade(p, tipo === "distancia" ? "distancia" : "corpo");
  return CRITICO_MINIMO + ((CRITICO_MAXIMO - CRITICO_MINIMO) * n) / HABILIDADE_MAXIMA + criticoEquipamento(p);
}

function mitigarDano(dano, defesa) {
  const d = Math.max(0, defesa || 0);
  return Math.max(1, Math.round((dano * CONSTANTE_DEFESA) / (CONSTANTE_DEFESA + d)));
}

// multiplicador: bônus sobre o dano bruto, antes do crítico e da defesa (o amuleto da família: 1,05).
function calcularGolpe(p, tipo, defesaAlvo, aleatorio = Math.random(), multiplicador = 1) {
  const bruto = Math.round(danoBruto(p, tipo) * multiplicador);
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

// ---------------------------------------------------------------------
// Gerador de mapas (o desenho de cada região vem de dados/mapas.js)
// ---------------------------------------------------------------------
// mapas[area][y][x]: 0 livre, 1 bloqueado (colisão). pisos[area][y][x]: o que há no chão (PISO).
// tiposObstaculo[area]["x,y"]: tipo fixo do obstáculo daquela casa (bosque de oliveiras, muro da vila,
// marco); sem tipo, o bioma sorteia (sprites.js). estruturasPorArea[area]: casas, tendas, bancas e poços.
const PISO = { CHAO: 0, CAMINHO: 1, AGUA: 2, ESTRUTURA: 3 };
const mapas = {};
const pisos = {};
const tiposObstaculo = {};
const estruturasPorArea = {};

// Hash e ruído determinísticos: o mesmo desenho em toda carga.
function hashCasa(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function ruidoCasa(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const l = (a, b, t) => a + (b - a) * t * t * (3 - 2 * t);
  const cima = l(hashCasa(xi, yi, s), hashCasa(xi + 1, yi, s), fx);
  const baixo = l(hashCasa(xi, yi + 1, s), hashCasa(xi + 1, yi + 1, s), fx);
  return l(cima, baixo, fy);
}

function casaInterna(x, y) {
  return x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1;
}

// Casas internas de um retângulo (x, y, largura, altura) ou elipse (forma "elipse": centro x, y e raios).
function casasDaForma(f, fn) {
  const elipse = f.forma === "elipse";
  const x0 = Math.max(1, elipse ? Math.floor(f.x - f.raioX) : f.x);
  const y0 = Math.max(1, elipse ? Math.floor(f.y - f.raioY) : f.y);
  const x1 = Math.min(COLS - 2, elipse ? Math.ceil(f.x + f.raioX) : f.x + f.largura - 1);
  const y1 = Math.min(ROWS - 2, elipse ? Math.ceil(f.y + f.raioY) : f.y + f.altura - 1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (elipse) {
        const nx = (x - f.x) / Math.max(0.5, f.raioX);
        const ny = (y - f.y) / Math.max(0.5, f.raioY);
        if (nx * nx + ny * ny > 1) continue;
      }
      fn(x, y);
    }
}

// Casas de um caminho: cada trecho anda primeiro na horizontal e depois na vertical, com a largura pedida.
function casasDoCaminho(c, fn) {
  const largura = Math.max(1, c.largura || 1);
  const marcar = (x, y) => {
    for (let dy = 0; dy < largura; dy++)
      for (let dx = 0; dx < largura; dx++) if (casaInterna(x + dx, y + dy)) fn(x + dx, y + dy);
  };
  for (let i = 1; i < c.pontos.length; i++) {
    const [x0, y0] = c.pontos[i - 1];
    const [x1, y1] = c.pontos[i];
    for (let x = x0; ; x += Math.sign(x1 - x0)) {
      marcar(x, y0);
      if (x === x1) break;
    }
    for (let y = y0; ; y += Math.sign(y1 - y0)) {
      marcar(x1, y);
      if (y === y1) break;
    }
  }
}

// Monta a grade de uma região: terreno de fundo, vilas, regiões, águas, caminhos, estruturas e marcos,
// nesta ordem (cada camada sobrescreve a anterior).
function gerarMapa(areaId) {
  const d = DADOS_MAPAS[areaId] || {};
  const t = d.terreno || {};
  const semente = t.semente || 1;
  const mapa = [];
  const piso = [];
  const tipos = {};
  for (let y = 0; y < ROWS; y++) {
    mapa[y] = [];
    piso[y] = [];
    for (let x = 0; x < COLS; x++) {
      const bosque =
        ruidoCasa(x / (t.escala || 7), y / (t.escala || 7), semente) > (t.limiar ?? 1) &&
        hashCasa(x, y, semente + 1) < (t.densidade || 0);
      const solto = hashCasa(x, y, semente + 2) < (t.salpico || 0);
      mapa[y][x] = !casaInterna(x, y) || bosque || solto ? 1 : 0;
      piso[y][x] = PISO.CHAO;
    }
  }
  const definir = (x, y, bloqueado, tipo, tipoPiso = PISO.CHAO) => {
    mapa[y][x] = bloqueado ? 1 : 0;
    piso[y][x] = tipoPiso;
    if (bloqueado && tipo) tipos[`${x},${y}`] = tipo;
    else delete tipos[`${x},${y}`];
  };
  for (const v of d.vilas || []) {
    casasDaForma(v, (x, y) => {
      const beira = x === v.x || y === v.y || x === v.x + v.largura - 1 || y === v.y + v.altura - 1;
      definir(x, y, beira && !!v.muro, v.muro);
    });
  }
  (d.regioes || []).forEach((r, i) => {
    casasDaForma(r, (x, y) => definir(x, y, hashCasa(x, y, semente + 10 + i) < (r.densidade || 0), r.tipo));
  });
  for (const a of d.aguas || []) casasDaForma(a, (x, y) => definir(x, y, true, null, PISO.AGUA));
  for (const c of d.caminhos || []) casasDoCaminho(c, (x, y) => definir(x, y, false, null, PISO.CAMINHO));
  const estruturas = [];
  for (const e of d.estruturas || []) {
    const modelo = DADOS_ESTRUTURAS[e.tipo];
    if (!modelo) continue;
    const estrutura = { ...clonarDados(e), largura: modelo.largura, altura: modelo.altura, variante: e.variante || 0 };
    casasDaForma(estrutura, (x, y) => definir(x, y, true, null, PISO.ESTRUTURA));
    estruturas.push(estrutura);
  }
  for (const m of d.marcos || []) if (casaInterna(m.x, m.y)) definir(m.x, m.y, true, m.tipo);
  mapas[areaId] = mapa;
  pisos[areaId] = piso;
  tiposObstaculo[areaId] = tipos;
  estruturasPorArea[areaId] = estruturas;
  return mapa;
}

// Estrutura (casa, tenda, banca, poço) que ocupa a casa, ou null.
function estruturaEm(areaId, x, y) {
  return (estruturasPorArea[areaId] || []).find(
    (e) => x >= e.x && y >= e.y && x < e.x + e.largura && y < e.y + e.altura,
  ) || null;
}

// Abre uma casa (nunca a borda do mapa nem a pegada de uma estrutura). Água aberta vira chão.
function abrirCasa(areaId, x, y) {
  const mapa = mapas[areaId];
  if (!mapa || !casaInterna(x, y) || pisos[areaId][y][x] === PISO.ESTRUTURA) return;
  mapa[y][x] = 0;
  if (pisos[areaId][y][x] === PISO.AGUA) pisos[areaId][y][x] = PISO.CHAO;
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

// Casas livres que não se alcançam a partir do início da área (andando nas 4 direções) viram obstáculo:
// nada nasce, brota ou cai num bolsão fechado.
function fecharBolsoes(areaId) {
  const mapa = mapas[areaId];
  const inicio = areas[areaId]?.inicio;
  if (!mapa || !inicio) return;
  const visto = mapa.map((linha) => linha.map(() => false));
  const fila = [[inicio.x, inicio.y]];
  visto[inicio.y][inicio.x] = true;
  while (fila.length) {
    const [x, y] = fila.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (mapa[ny]?.[nx] === 0 && !visto[ny][nx]) {
        visto[ny][nx] = true;
        fila.push([nx, ny]);
      }
    }
  }
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (mapa[y][x] === 0 && !visto[y][x]) mapa[y][x] = 1;
}

for (const id of Object.keys(DADOS_AREAS_BASE)) registrarArea(areas[id], gerarMapa(id));
// Regiões dos capítulos (dados/mundo.js), cada uma com o seu desenho em dados/mapas.js.
for (const area of Object.values(DADOS_AREAS_CAPITULOS)) registrarArea(clonarDados(area), gerarMapa(area.id));

// ---------------------------------------------------------------------
// NPCs, coletáveis, pesca e inimigos base
// ---------------------------------------------------------------------
// papel: "missao" (dá missões de dados/missoes.js), "loja", "guia", "mural" (atalaia: mural de
// caçadas de dados/tarefas.js, aberto quando requer.missao é concluída), "ambiente" (morador: só
// conversa, com as falas de dados/npcs.js) ou, nos capítulos, "lider" (dá a missão do capítulo),
// "apoio" (só conversa) e "mestre" (ensina a Oração).
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

// Pontos fixos sempre abertos: pesca, coletáveis, pontos das áreas (início, trilha, cais, viagem,
// embarque) e portais. Depois disso, os bolsões fechados viram obstáculo.
for (const ponto of pontosPesca) abrirCasa("mar", ponto.x, ponto.y);
for (const [areaId, grupo] of Object.entries(COLETAVEIS_POR_AREA))
  for (const c of grupo.lista) abrirCasa(areaId, c.x, c.y);
for (const area of Object.values(areas)) {
  for (const chave of ["inicio", "passagem", "chegada", "chegadaViagem"]) {
    if (area[chave]) abrirCasa(area.id, area[chave].x, area[chave].y);
  }
  for (const porto of Object.values(area.portos || {})) {
    abrirCasa(area.id, porto.cais.x, porto.cais.y);
    abrirCasa(area.id, porto.embarque.x, porto.embarque.y);
  }
  if (area.cais) {
    abrirCasa(area.id, area.cais.x, area.cais.y);
    abrirCasa(area.id, area.cais.x, area.cais.y + 1);
  }
}
for (const portal of DADOS_PORTAIS) {
  abrirCasa(portal.area, portal.x, portal.y);
  abrirCasa(portal.destino, portal.chegada.x, portal.chegada.y);
}
for (const areaId of Object.keys(areas)) fecharBolsoes(areaId);

const inimigos = {};

// Campos: vidaMaxima, danoContraJogador (antes da defesa), defesa, raioPercepcao, xpRecompensa,
// saque { itens, moedas }, tier, comportamento, status, aparencia (dica visual) e, no raro nomeado,
// nomeado { aCadaHoras, duracaoMinutos, deslocamentoHoras }. O campo antigo veneno ("padrao" ou
// { duracao, dano, intervalo }) ainda vale e vira status { tipo: "veneno" }.
function registrarInimigo(dados) {
  const e = {
    ...dados,
    x: dados.x,
    y: dados.y,
    inicioX: dados.x,
    inicioY: dados.y,
    defesa: dados.defesa || 0,
    saque: dados.saque || { itens: [], moedas: 0 },
    tier: registroDe(TIERS_CRIATURAS, dados.tier) ? dados.tier : "normal",
    proximoMovimento: 0,
    proximoAtaque: 0,
  };
  const lista = Array.isArray(dados.comportamento) ? dados.comportamento : [dados.comportamento || "padrao"];
  e.comportamentos = lista.filter((c) => registroDe(COMPORTAMENTOS, c) && c !== "padrao");
  // Status aplicado ao acertar: os padrões de STATUS_CRIATURAS com os ajustes da criatura.
  let status = dados.status;
  if (!status && dados.veneno) status = { tipo: "veneno", ...(dados.veneno === "padrao" ? {} : dados.veneno) };
  e.efeito = status && registroDe(STATUS_CRIATURAS, status.tipo) ? { ...STATUS_CRIATURAS[status.tipo], ...status } : null;
  e.veneno = e.efeito?.tipo === "veneno" ? { duracao: e.efeito.duracao, dano: e.efeito.dano, intervalo: e.efeito.intervalo } : undefined;
  inimigos[e.id] = e;
  if (!dados.id.includes("_")) abrirClareira(e.area, e.x, e.y, 1);
  return e;
}

// Zera o estado de comportamento (fúria, fuga, investida, alerta) — ao renascer e na morte do jogador.
function zerarComportamento(e) {
  e.furioso = false;
  e.fugiu = false;
  e.voltou = false;
  e.fugindoAte = 0;
  e.preparoAte = 0;
  e.investidaCasas = null;
  e.proximaInvestida = 0;
  e.alertaAte = 0;
  e.chamadoAte = 0;
  e.slotMatilha = null;
  e.proximaCura = 0;
  e.status = {};
  e.imune = {};
  e.assustadaPor = null;
}

// ---------------------------------------------------------------------
// Status (JGB-16) — um motor só para o jogador e para as criaturas
// ---------------------------------------------------------------------
// STATUS_CRIATURAS e COMBINACOES_STATUS vêm de dados/criaturas.js. Quem tem status (o jogador ou uma criatura)
// guarda alvo.status[tipo] = { ate, pilhas, dano, intervalo, proximo } (dano, intervalo e proximo só nos que
// machucam aos poucos) e alvo.imune[tipo] = até quando o status não pega de novo. No jogador, os dois vão para
// o save; nas criaturas, ficam na memória e zeram ao renascer.
const TIPOS_STATUS = Object.keys(STATUS_CRIATURAS);
const STATUS_PERIODICOS = TIPOS_STATUS.filter((t) => STATUS_CRIATURAS[t].intervalo > 0);

// O status ativo agora (ou null).
function statusAtivo(alvo, tipo, agora) {
  const s = alvo?.status?.[tipo];
  return s && s.ate > agora ? s : null;
}

// Tipos de status ativos agora, na ordem de STATUS_CRIATURAS.
function statusAtivos(alvo, agora) {
  return TIPOS_STATUS.filter((t) => statusAtivo(alvo, t, agora));
}

// Aplica um status (ef = { tipo, ...ajustes }, com os padrões de STATUS_CRIATURAS). Devolve null quando não pega
// (imune, ou acumulo "nenhum" com o status ainda ativo) ou { novo, pilhas, ate }.
function aplicarStatus(alvo, ef, agora) {
  const base = registroDe(STATUS_CRIATURAS, ef?.tipo);
  if (!base || !alvo) return null;
  const cfg = { ...base, ...ef };
  if (!objetoValido(alvo.status)) alvo.status = {};
  if (!objetoValido(alvo.imune)) alvo.imune = {};
  if ((alvo.imune[cfg.tipo] || 0) > agora) return null;
  const atual = statusAtivo(alvo, cfg.tipo, agora);
  if (atual) {
    if (cfg.acumulo === "nenhum") return null;
    if (cfg.acumulo === "pilhas") atual.pilhas = Math.min(cfg.pilhasMax || 1, atual.pilhas + 1);
    if (cfg.intervalo) atual.dano = Math.max(atual.dano, cfg.dano);
    atual.ate = agora + cfg.duracao;
    return { novo: false, pilhas: atual.pilhas, ate: atual.ate };
  }
  const s = { ate: agora + cfg.duracao, pilhas: 1 };
  if (cfg.intervalo) Object.assign(s, { dano: cfg.dano, intervalo: cfg.intervalo, proximo: agora + cfg.intervalo });
  alvo.status[cfg.tipo] = s;
  if (cfg.imunidade) alvo.imune[cfg.tipo] = s.ate + cfg.imunidade;
  return { novo: true, pilhas: 1, ate: s.ate };
}

function curarStatus(alvo, tipo) {
  if (objetoValido(alvo?.status)) delete alvo.status[tipo];
}

// Um passo do relógio dos status: no máximo um tique por status por chamada (o laço roda muitas vezes por
// segundo). Os tiques seguem a grade da aplicação (t + intervalo, t + 2·intervalo…) e o que coincide com o fim
// ainda vale: 15 s / 3 s = 5 tiques. Devolve { tiques: [{ tipo, dano, pilhas }], terminados: [tipo] }.
function passoDosStatus(alvo, agora) {
  const tiques = [];
  const terminados = [];
  if (!objetoValido(alvo?.status)) return { tiques, terminados };
  const infeccao = Object.values(COMBINACOES_STATUS).find(
    (c) => c.danoTiques && c.requer.every((t) => alvo.status[t] && alvo.status[t].ate >= agora),
  );
  for (const tipo of TIPOS_STATUS) {
    const s = alvo.status[tipo];
    if (!s) continue;
    const pendente = s.intervalo > 0 && agora >= s.proximo && s.proximo <= s.ate;
    if (pendente) {
      s.proximo += s.intervalo;
      const fator = infeccao?.requer.includes(tipo) ? infeccao.danoTiques : 1;
      tiques.push({ tipo, dano: Math.max(1, Math.round(s.dano * s.pilhas * fator)), pilhas: s.pilhas, infeccao: fator > 1 });
    } else if (agora >= s.ate) {
      delete alvo.status[tipo];
      terminados.push(tipo);
    }
  }
  return { tiques, terminados };
}

// Combinações que valem num golpe contra quem tem estes status: { critico, multiplicador, nomes }.
function combinacoesNoGolpe(alvo, agora) {
  let critico = false;
  let multiplicador = 1;
  const nomes = [];
  for (const c of Object.values(COMBINACOES_STATUS)) {
    if (!(c.critico || c.danoRecebido) || !c.requer.every((t) => statusAtivo(alvo, t, agora))) continue;
    if (c.critico) critico = true;
    if (c.danoRecebido) multiplicador *= c.danoRecebido;
    nomes.push(c.nome);
  }
  return { critico, multiplicador, nomes };
}

// Visão dos status para a interface (pura): [{ tipo, nome, restanteMs, pilhas }].
function visaoStatus(alvo, agora) {
  return statusAtivos(alvo, agora).map((tipo) => ({
    tipo,
    nome: STATUS_CRIATURAS[tipo].nome,
    restanteMs: alvo.status[tipo].ate - agora,
    pilhas: alvo.status[tipo].pilhas,
  }));
}

// Garante p.status e p.imune coerentes. Saves até a v11 guardavam cada status num campo próprio
// (envenenadoAte, venenoAtual, sangrandoAte…): o que ainda estiver valendo vira p.status.
function normalizarStatus(p, agora) {
  const antigo = objetoValido(p.status) ? p.status : {};
  p.status = {};
  for (const tipo of TIPOS_STATUS) {
    const s = antigo[tipo];
    if (!objetoValido(s) || !(Number.isFinite(s.ate) && s.ate > agora)) continue;
    const base = STATUS_CRIATURAS[tipo];
    const n = { ate: s.ate, pilhas: Number.isInteger(s.pilhas) ? Math.max(1, Math.min(base.pilhasMax || 1, s.pilhas)) : 1 };
    if (base.intervalo) {
      n.dano = Number.isFinite(s.dano) && s.dano > 0 ? s.dano : base.dano;
      n.intervalo = Number.isFinite(s.intervalo) && s.intervalo > 0 ? s.intervalo : base.intervalo;
      n.proximo = Number.isFinite(s.proximo) ? s.proximo : agora + n.intervalo;
    }
    p.status[tipo] = n;
  }
  const campos = [
    ["veneno", "envenenadoAte", "venenoAtual", "proximoDanoVeneno"],
    ["sangramento", "sangrandoAte", "sangramentoAtual", "proximoDanoSangue"],
  ];
  for (const [tipo, ate, atual, proximo] of campos) {
    if (!p.status[tipo] && Number.isFinite(p[ate]) && p[ate] > agora) {
      const base = STATUS_CRIATURAS[tipo];
      const dano = objetoValido(p[atual]) && p[atual].dano > 0 ? p[atual].dano : base.dano;
      const intervalo = objetoValido(p[atual]) && p[atual].intervalo > 0 ? p[atual].intervalo : base.intervalo;
      p.status[tipo] = { ate: p[ate], pilhas: 1, dano, intervalo, proximo: Number.isFinite(p[proximo]) && p[proximo] > 0 ? p[proximo] : agora + intervalo };
    }
    for (const campo of [ate, atual, proximo]) delete p[campo];
  }
  // O atordoamento e o medo são curtos: não sobrevivem a recarregar (nem a imunidade deles).
  delete p.status.atordoamento;
  delete p.status.medo;
  for (const campo of ["atordoadoAte", "imuneAtordoamentoAte"]) delete p[campo];
  p.imune = {};
}

// ---------------------------------------------------------------------
// Campeões e raros nomeados
// ---------------------------------------------------------------------
function podeSerCampeao(e) {
  return !e.nomeado && !!TIERS_CRIATURAS[e.tier]?.podeSerCampeao;
}

// Modificadores de campeão da criatura para este jogador (p.campeoes[id], no save); [] = não é campeã.
function modificadoresCampeao(p, e) {
  const lista = p?.campeoes?.[e.id];
  return Array.isArray(lista) ? lista.filter((k) => registroDe(MODIFICADORES_CAMPEAO, k)) : [];
}

// Sorteia 1 a 2 modificadores diferentes (CAMPEAO.modificadores), na ordem dos dados.
function sortearModificadores(aleatorio = Math.random) {
  const [min, max] = CAMPEAO.modificadores;
  const n = min + Math.floor(aleatorio() * (max - min + 1));
  const disponiveis = Object.keys(MODIFICADORES_CAMPEAO);
  const escolhidos = [];
  while (escolhidos.length < n && disponiveis.length) escolhidos.push(disponiveis.splice(Math.floor(aleatorio() * disponiveis.length), 1)[0]);
  return Object.keys(MODIFICADORES_CAMPEAO).filter((k) => escolhidos.includes(k));
}

// Atributos efetivos da criatura (campeã ou não): vida máxima, dano, defesa, intervalos, roubo de vida
// e explosão. A fúria entra na hora do golpe.
function atributosInimigo(p, e) {
  const modificadores = modificadoresCampeao(p, e);
  const campeao = modificadores.length > 0;
  let vida = e.vidaMaxima;
  let dano = e.danoContraJogador;
  let defesa = e.defesa || 0;
  let intervaloAtaque = e.intervaloAtaque || INTERVALO_ATAQUE;
  let intervaloMovimento = e.intervaloMovimento || INTERVALO_MOVIMENTO;
  let rouboVida = 0;
  let explosao = null;
  if (campeao) {
    vida *= CAMPEAO.vida;
    dano *= CAMPEAO.dano;
  }
  for (const k of modificadores) {
    const m = MODIFICADORES_CAMPEAO[k];
    if (m.intervaloAtaque) intervaloAtaque *= m.intervaloAtaque;
    if (m.intervaloMovimento) intervaloMovimento *= m.intervaloMovimento;
    if (m.rouboVida) rouboVida = Math.max(rouboVida, m.rouboVida);
    if (m.defesa) defesa *= m.defesa;
    if (m.dano) dano *= m.dano;
    if (m.explosao) explosao = m.explosao;
  }
  return {
    campeao,
    modificadores,
    vidaMaxima: Math.round(vida),
    dano: Math.round(dano),
    defesa: Math.round(defesa),
    intervaloAtaque: Math.round(intervaloAtaque),
    intervaloMovimento: Math.round(intervaloMovimento),
    rouboVida,
    explosao,
  };
}

// Nome com os modificadores ("Hiena Rápida e Vampírica"); o raro nomeado já tem nome próprio.
function nomeInimigo(p, e) {
  const mods = modificadoresCampeao(p, e);
  if (!mods.length) return e.nome;
  const g = e.genero === "f" ? 1 : 0;
  const nomes = mods.map((k) => MODIFICADORES_CAMPEAO[k].nome[g]);
  return `${e.nome} ${nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0]}`;
}

// Casas da linha reta de a até b (sem a, com b): o caminho da investida, marcado no chão.
function casasDaLinha(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const passos = Math.max(Math.abs(dx), Math.abs(dy));
  const casas = [];
  for (let i = 1; i <= passos; i++) casas.push({ x: a.x + Math.round((dx * i) / passos), y: a.y + Math.round((dy * i) / passos) });
  return casas;
}

// Janela de aparição do raro nomeado: aparece a cada aCadaHoras, por duracaoMinutos, a partir de
// deslocamentoHoras (hora do relógio, contada desde 1970 em UTC). indice identifica a janela.
function janelaNomeado(e, agora = Date.now()) {
  const n = e.nomeado;
  if (!n) return null;
  const periodo = n.aCadaHoras * 3_600_000;
  const desloc = (n.deslocamentoHoras || 0) * 3_600_000;
  const indice = Math.floor((agora - desloc) / periodo);
  const inicio = desloc + indice * periodo;
  const fim = inicio + n.duracaoMinutos * 60_000;
  return { indice, inicio, fim, ativa: agora < fim, proxima: agora < fim ? inicio : inicio + periodo };
}

// Casa livre aleatória a até `raio` casas de (cx, cy): chão livre, longe dos NPCs e da entrada da área
// (`folga` casas) e sem outra criatura, coletável, portal ou cais em cima. null se não achar.
function sortearCasaLivre(areaId, cx, cy, raio, folga, espacoInimigos = 0) {
  const mapa = mapas[areaId];
  const area = areas[areaId];
  const ocupadas = new Set();
  for (const e of Object.values(inimigos)) if (e.area === areaId) ocupadas.add(`${e.x},${e.y}`);
  for (const c of COLETAVEIS_POR_AREA[areaId]?.lista || []) ocupadas.add(`${c.x},${c.y}`);
  for (const pt of [area.passagem, area.chegada, area.cais, area.chegadaViagem]) if (pt) ocupadas.add(`${pt.x},${pt.y}`);
  for (const pt of DADOS_PORTAIS) if (pt.area === areaId) ocupadas.add(`${pt.x},${pt.y}`);
  const longe = (pt) => !pt || Math.max(Math.abs(pt.x - x), Math.abs(pt.y - y)) > folga;
  let x;
  let y;
  for (let tentativa = 0; tentativa < 80; tentativa++) {
    x = cx + Math.round((Math.random() * 2 - 1) * raio);
    y = cy + Math.round((Math.random() * 2 - 1) * raio);
    if (!dentroDoMapa(x, y) || mapa[y][x] !== 0 || ocupadas.has(`${x},${y}`)) continue;
    if (!longe(area.inicio) || !Object.values(npcs).every((n) => n.area !== areaId || longe(n))) continue;
    // Espaço entre criaturas: atacar uma não puxa as vizinhas.
    const perto = (e) => e.area === areaId && Math.max(Math.abs(e.inicioX - x), Math.abs(e.inicioY - y)) <= espacoInimigos;
    if (espacoInimigos && Object.values(inimigos).some(perto)) continue;
    return { x, y };
  }
  return null;
}

// Casa livre numa das zonas de coleta da área (dados/mapas.js); sem zonas, em qualquer lugar da área.
function sortearCasaDeColeta(areaId) {
  const zonas = DADOS_MAPAS[areaId]?.zonasColeta || [];
  if (!zonas.length) return sortearCasaLivre(areaId, COLS >> 1, ROWS >> 1, Math.max(COLS, ROWS) >> 1, 3);
  const zona = zonas[Math.floor(Math.random() * zonas.length)];
  return sortearCasaLivre(areaId, zona.x, zona.y, zona.raio, 3);
}

// Põe a criatura num ponto aleatório do seu grupo (nasce e renasce ali; é também o ponto para onde volta).
// Devolve false se não houver casa livre (a criatura fica onde estava).
function sortearPosicaoInimigo(e) {
  if (!e.grupo) return false;
  const espaco = e.raioPercepcao + 1;
  const casa = sortearCasaLivre(e.area, e.centroX, e.centroY, e.grupo.raio, e.raioPercepcao + 2, espaco);
  if (!casa) return false;
  e.x = e.inicioX = casa.x;
  e.y = e.inicioY = casa.y;
  return true;
}

// Todas as criaturas vêm de dados/criaturas.js. Com "grupo", nascem cópias <id>_2, <id>_3... (base: id)
// espalhadas em volta do ponto original.
for (const criatura of DADOS_CRIATURAS) {
  const original = registrarInimigo(clonarDados(criatura));
  original.centroX = original.x;
  original.centroY = original.y;
  for (let i = 2; i <= (criatura.grupo?.quantidade || 1); i++) {
    const copia = registrarInimigo({ ...clonarDados(criatura), id: `${criatura.id}_${i}` });
    Object.assign(copia, { base: criatura.id, centroX: original.x, centroY: original.y, inicioX: -99, inicioY: -99 });
    if (!sortearPosicaoInimigo(copia)) delete inimigos[copia.id]; // sem espaço: menos uma cópia
  }
}
// Raros nomeados (o laço de tempo confere a janela deles a cada quadro).
const NOMEADOS = Object.values(inimigos).filter((e) => e.nomeado);

// ---------------------------------------------------------------------
// Bestiário (JGB-9): estágios por espécie e amuletos por família
// ---------------------------------------------------------------------
// Estado no save: p.bestiario[especie] = abates (só espécies com pelo menos 1 abate). Os estágios e os
// amuletos não são guardados: saem da contagem, com as regras de REGRAS_BESTIARIO (dados/criaturas.js).
// As funções abaixo são puras: a interface só lê o bestiário por elas.
const ESPECIES = {}; // especie → criatura de referência (a original dos dados)
const ORDEM_ESPECIES = [];
for (const criatura of DADOS_CRIATURAS) {
  if (!criatura.especie || ESPECIES[criatura.especie]) continue;
  ESPECIES[criatura.especie] = inimigos[criatura.id];
  ORDEM_ESPECIES.push(criatura.especie);
}
const ESTAGIOS_BESTIARIO = REGRAS_BESTIARIO.estagios;
const ESTAGIO_MAXIMO_BESTIARIO = ESTAGIOS_BESTIARIO.length;

function abatesDaEspecie(p, especie) {
  const n = p?.bestiario && registroDe(ESPECIES, especie) ? registroDe(p.bestiario, especie) : 0;
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// 0 (nenhum estágio) até ESTAGIO_MAXIMO_BESTIARIO.
function estagioDeAbates(abates) {
  let estagio = 0;
  ESTAGIOS_BESTIARIO.forEach((s, i) => {
    if (abates >= s.abates) estagio = i + 1;
  });
  return estagio;
}

// O estágio revela "ficha", "fraquezas" ou "chances"? (cada estágio revela também o que os anteriores revelam)
function estagioRevela(estagio, revela) {
  const i = ESTAGIOS_BESTIARIO.findIndex((s) => s.revela === revela);
  return i >= 0 && estagio >= i + 1;
}

// Espécies que contam para o amuleto da família (sem os tiers de REGRAS_BESTIARIO.amuleto.ignorarTiers).
function especiesDoAmuleto(familia) {
  const fora = REGRAS_BESTIARIO.amuleto.ignorarTiers || [];
  return ORDEM_ESPECIES.filter((k) => ESPECIES[k].familia === familia && !fora.includes(ESPECIES[k].tier));
}

function progressoAmuleto(p, familia) {
  const regra = REGRAS_BESTIARIO.amuleto;
  const especies = especiesDoAmuleto(familia);
  const cumpridas = especies.filter((k) => estagioDeAbates(abatesDaEspecie(p, k)) >= regra.estagio).length;
  return {
    familia,
    nome: FAMILIAS_CRIATURAS[familia]?.nome || familia,
    cumpridas,
    total: especies.length,
    ativo: especies.length > 0 && cumpridas === especies.length,
    bonus: regra.bonusDano,
    estagio: regra.estagio,
    nomeEstagio: ESTAGIOS_BESTIARIO[regra.estagio - 1]?.nome || "",
  };
}

// Bônus de dano (fração) do amuleto contra a criatura: 0 sem o amuleto da família dela.
function bonusAmuleto(p, e) {
  return e?.familia && registroDe(FAMILIAS_CRIATURAS, e.familia) && progressoAmuleto(p, e.familia).ativo ? REGRAS_BESTIARIO.amuleto.bonusDano : 0;
}

function amuletosDoJogador(p) {
  return Object.keys(FAMILIAS_CRIATURAS).map((f) => progressoAmuleto(p, f)).filter((a) => a.ativo);
}

// Golpe esperado (sem crítico) do jogador contra a criatura: dano bruto com o amuleto, menos a defesa dela.
function golpeContra(p, e, tipo) {
  return mitigarDano(Math.round(danoBruto(p, tipo) * (1 + bonusAmuleto(p, e))), e.defesa || 0);
}

// Fraquezas da espécie: comportamentos, status (com a chance dela), pouca defesa e alcance menor que o do arco.
function fraquezasDaEspecie(e) {
  const lista = [];
  for (const c of e.comportamentos) if (COMPORTAMENTOS[c].fraqueza) lista.push(COMPORTAMENTOS[c].fraqueza);
  if (e.comportamentos.includes("distancia")) {
    const alcance = e.alcance || COMPORTAMENTOS.distancia.alcance;
    if (alcance < ALCANCE_ARCO) lista.push(preencherTexto(REGRAS_BESTIARIO.fraquezaAlcance, { arco: ALCANCE_ARCO, alcance }));
  }
  if (e.efeito?.fraqueza) {
    lista.push(preencherTexto(e.efeito.fraqueza, {
      chance: `${Math.round((e.efeito.chance ?? 1) * 100)}%`,
      imunidade: `${String((e.efeito.imunidade || 0) / 1000).replace(".", ",")} s`,
      duracao: `${String((e.efeito.duracao || 0) / 1000).replace(".", ",")} s`,
      pilhas: String(e.efeito.pilhasMax || 1),
    }));
  }
  if ((e.defesa || 0) <= REGRAS_BESTIARIO.defesaBaixa) lista.push(REGRAS_BESTIARIO.fraquezaDefesaBaixa);
  return lista;
}

// Tudo o que a tela do bestiário mostra de uma espécie, conforme o estágio (o que não foi revelado vem null).
function visaoEspecie(p, especie) {
  const e = registroDe(ESPECIES, especie);
  if (!e) return null;
  const abates = abatesDaEspecie(p, especie);
  const estagio = estagioDeAbates(abates);
  const proximo = ESTAGIOS_BESTIARIO[estagio] || null;
  const anterior = estagio > 0 ? ESTAGIOS_BESTIARIO[estagio - 1].abates : 0;
  const conhecida = abates > 0;
  const ficha = estagioRevela(estagio, "ficha")
    ? {
        vida: e.vidaMaxima,
        dano: e.danoContraJogador,
        defesa: e.defesa || 0,
        passa: Math.round((100 * CONSTANTE_DEFESA) / (CONSTANTE_DEFESA + (e.defesa || 0))),
        nivel: e.nivel ?? null,
        xp: e.xpRecompensa || 0,
        tier: TIERS_CRIATURAS[e.tier]?.nome || "",
        comportamentos: e.comportamentos.map((c) => COMPORTAMENTOS[c].nome),
        status: e.efeito ? STATUS_CRIATURAS[e.efeito.tipo].nome : null,
        golpeCorpo: golpeContra(p, e, "corpo"),
        golpeArco: p?.equipamento?.arco ? golpeContra(p, e, "distancia") : null,
      }
    : null;
  const comChances = estagioRevela(estagio, "chances");
  const saque = estagioRevela(estagio, "fraquezas")
    ? {
        moedas: comChances ? e.saque?.moedas || 0 : null,
        itens: tabelaDeSaque(e)
          .filter((l) => registroDe(ITENS, l.item))
          .map((l) => {
            const raridade = registroDe(RARIDADES, l.raridade) ? l.raridade : registroDe(RARIDADES, l.raridadeMinima) ? l.raridadeMinima : ITENS[l.item].raridade || "comum";
            const chance = chanceSaque(l.chance ?? 1);
            return { item: l.item, nome: ITENS[l.item].nome, raridade, minima: !l.raridade && !!l.raridadeMinima, chance: comChances ? chance : null, textoChance: comChances ? textoChance(chance) : null };
          }),
      }
    : null;
  return {
    especie,
    inimigoId: e.id,
    nome: conhecida ? e.nome : null,
    titulo: conhecida ? e.titulo || null : null,
    nomeado: !!e.nomeado,
    area: e.area,
    nomeArea: areas[e.area]?.nome || e.area,
    familia: e.familia,
    nomeFamilia: FAMILIAS_CRIATURAS[e.familia]?.nome || "",
    contaParaAmuleto: especiesDoAmuleto(e.familia).includes(especie),
    abates,
    estagio,
    nomeEstagio: estagio > 0 ? ESTAGIOS_BESTIARIO[estagio - 1].nome : "",
    proximo: proximo ? { abates: proximo.abates, nome: proximo.nome, revela: proximo.revela, texto: proximo.texto, desde: anterior } : null,
    ficha,
    fraquezas: estagioRevela(estagio, "fraquezas") ? fraquezasDaEspecie(e) : null,
    saque,
  };
}

// Bestiário por família (ordem de FAMILIAS_CRIATURAS; dentro dela, por nível), com o amuleto de cada uma.
function bestiarioPorFamilia(p) {
  return Object.keys(FAMILIAS_CRIATURAS)
    .map((familia) => ({
      familia,
      nome: FAMILIAS_CRIATURAS[familia].nome,
      amuleto: progressoAmuleto(p, familia),
      especies: ORDEM_ESPECIES.filter((k) => ESPECIES[k].familia === familia)
        .sort((a, b) => (ESPECIES[a].nivel || 0) - (ESPECIES[b].nivel || 0) || ORDEM_ESPECIES.indexOf(a) - ORDEM_ESPECIES.indexOf(b))
        .map((k) => visaoEspecie(p, k)),
    }))
    .filter((f) => f.especies.length);
}

function resumoBestiario(p) {
  const estagios = ORDEM_ESPECIES.map((k) => estagioDeAbates(abatesDaEspecie(p, k)));
  return {
    especies: ORDEM_ESPECIES.length,
    conhecidas: ORDEM_ESPECIES.filter((k) => abatesDaEspecie(p, k) > 0).length,
    porEstagio: ESTAGIOS_BESTIARIO.map((_, i) => estagios.filter((n) => n >= i + 1).length),
    amuletos: amuletosDoJogador(p).length,
    familias: Object.keys(FAMILIAS_CRIATURAS).filter((f) => especiesDoAmuleto(f).length).length,
  };
}

// Normaliza p.bestiario do save: só espécies que existem, com contagens inteiras e positivas.
function normalizarBestiario(p) {
  const antigo = objetoValido(p.bestiario) ? p.bestiario : {};
  p.bestiario = {};
  for (const especie of ORDEM_ESPECIES) {
    const n = Object.hasOwn(antigo, especie) ? Number(antigo[especie]) : 0;
    if (Number.isFinite(n) && n >= 1) p.bestiario[especie] = Math.floor(n);
  }
}

// ---------------------------------------------------------------------
// Maná diário (Êxodo 16) e XP de descanso do Sábado (JGB-11)
// ---------------------------------------------------------------------
// REGRAS_MANA e REGRAS_DESCANSO vêm de dados/mundo.js. O relógio, por enquanto, é o do navegador, na hora
// local do jogador; o confiável vem com o servidor (v0.5). Por isso toda função recebe "agora" e o save
// guarda marcas que não deixam o relógio mexido render duas vezes a mesma coisa.
// Save (v11): p.mana = { porcao, estragaEm, proximaEm } (porções no jarro, quando elas estragam e quando
// cai o próximo maná para você) e p.descanso = { xp, vistoEm, creditadoAte } (reserva de XP, última ação e
// até onde o Sábado já virou reserva).
const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;

// Dia do maná que contém "agora": do amanhecer (hora local) ao amanhecer seguinte.
function diaDoMana(agora) {
  const d = new Date(agora);
  if (d.getHours() < REGRAS_MANA.amanhecer) d.setDate(d.getDate() - 1);
  d.setHours(REGRAS_MANA.amanhecer, 0, 0, 0);
  const inicio = d.getTime();
  const semana = d.getDay();
  d.setDate(d.getDate() + 1);
  return { inicio, fim: d.getTime(), semana };
}

// Porções que caem num dia da semana: dobradas na sexta, nenhuma no sábado.
function porcaoDoDia(semana) {
  if (semana === REGRAS_MANA.sabado) return 0;
  return semana === REGRAS_MANA.sexta ? REGRAS_MANA.porcaoSexta : REGRAS_MANA.porcao;
}

// Primeiro amanhecer, a partir de "instante", em que cai maná (pula o Sábado).
function proximoAmanhecerComMana(instante) {
  let dia = diaDoMana(instante);
  if (dia.inicio < instante) dia = diaDoMana(dia.fim);
  for (let i = 0; i < 7 && !porcaoDoDia(dia.semana); i++) dia = diaDoMana(dia.fim);
  return dia.inicio;
}

function normalizarMana(p, agora) {
  const m = objetoValido(p.mana) ? p.mana : {};
  const instante = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
  const maximo = Math.max(REGRAS_MANA.porcao, REGRAS_MANA.porcaoSexta);
  p.mana = {
    porcao: Number.isInteger(m.porcao) ? Math.max(0, Math.min(maximo, m.porcao)) : 0,
    // Relógio adiantado: o maná não dura nem demora mais do que dois dias e meio a partir de agora.
    estragaEm: Math.min(instante(m.estragaEm), agora + 2.5 * DIA_MS),
    proximaEm: Math.min(instante(m.proximaEm), diaDoMana(agora).fim),
  };
  if (!p.mana.estragaEm) p.mana.porcao = 0;
}

// Visão do maná para a interface (pura). disponivel: dá para colher agora; porcaoHoje: o que cai hoje
// (0 no sábado); guardado: porções no jarro que ainda não estragaram; proximoEm: quando cai o próximo
// maná que você ainda não colheu (agora, se disponível).
function estadoMana(p, agora) {
  const m = objetoValido(p?.mana) ? p.mana : {};
  const dia = diaDoMana(agora);
  const porcaoHoje = porcaoDoDia(dia.semana);
  const guardado = m.porcao > 0 && agora < m.estragaEm ? m.porcao : 0;
  const colhido = agora < (m.proximaEm || 0);
  const disponivel = porcaoHoje > 0 && !colhido;
  return {
    disponivel,
    colhido,
    porcaoHoje,
    dobrado: porcaoHoje > REGRAS_MANA.porcao,
    sabado: porcaoHoje === 0,
    guardado,
    estragaEm: guardado ? m.estragaEm : 0,
    proximoEm: disponivel ? agora : proximoAmanhecerComMana(Math.max(agora, m.proximaEm || 0)),
  };
}

// XP que um nível custa (do nível atual para o seguinte).
function custoDoNivel(nivel) {
  return limiarNivel(nivel) - (nivel > 1 ? limiarNivel(nivel - 1) : 0);
}

// Milissegundos de [de, ate) que caem dentro do Sábado (REGRAS_DESCANSO.inicio → fim, hora local).
function tempoNoSabado(de, ate) {
  if (!(ate > de)) return 0;
  const { inicio, fim } = REGRAS_DESCANSO;
  const d = new Date(de);
  d.setDate(d.getDate() - ((d.getDay() - inicio.dia + 7) % 7));
  d.setHours(inicio.hora, 0, 0, 0);
  if (d.getTime() > de) d.setDate(d.getDate() - 7);
  const diasAteOFim = (fim.dia - inicio.dia + 7) % 7 || 7;
  let total = 0;
  // Uma ausência maior que um ano conta só o último ano (a reserva tem limite muito antes disso).
  if (ate - d.getTime() > 366 * DIA_MS) return tempoNoSabado(ate - 365 * DIA_MS, ate);
  while (d.getTime() < ate) {
    const comeco = d.getTime();
    const termino = new Date(comeco);
    termino.setDate(termino.getDate() + diasAteOFim);
    termino.setHours(fim.hora, 0, 0, 0);
    total += Math.max(0, Math.min(ate, termino.getTime()) - Math.max(de, comeco));
    d.setDate(d.getDate() + 7);
  }
  return total;
}

// Limite da reserva de descanso no nível atual.
function limiteDescanso(p) {
  return Math.round(custoDoNivel(p.nivel || 1) * REGRAS_DESCANSO.limite);
}

// Visão do descanso para a interface (pura).
function estadoDescanso(p, agora) {
  const xp = Math.max(0, Math.floor(p?.descanso?.xp || 0));
  return {
    xp,
    limite: limiteDescanso(p),
    multiplicador: REGRAS_DESCANSO.multiplicador,
    sabado: tempoNoSabado(agora, agora + 1) > 0,
  };
}

function normalizarDescanso(p, agora) {
  const d = objetoValido(p.descanso) ? p.descanso : {};
  const instante = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
  p.descanso = {
    xp: Number.isFinite(d.xp) ? Math.max(0, Math.min(limiteDescanso(p), Math.floor(d.xp))) : 0,
    // Sem marca (save novo ou anterior à v11), a ausência começa a contar agora.
    vistoEm: instante(d.vistoEm) || agora,
    creditadoAte: instante(d.creditadoAte),
  };
}

// Converte em reserva a ausência desde a última ação (só a que cai no Sábado e não virou reserva antes)
// e marca a presença. Devolve o XP creditado.
function creditarDescanso(p, agora) {
  if (!objetoValido(p.descanso)) normalizarDescanso(p, agora);
  const d = p.descanso;
  const desde = Math.max(d.vistoEm, d.creditadoAte);
  d.vistoEm = agora;
  if (agora - desde < REGRAS_DESCANSO.ausenciaMinutos * 60_000) return 0;
  const ms = tempoNoSabado(desde, agora);
  d.creditadoAte = agora;
  if (!ms) return 0;
  const custo = custoDoNivel(p.nivel || 1);
  const ganho = Math.round((ms / DIA_MS) * REGRAS_DESCANSO.porSabado * custo);
  const antes = d.xp;
  d.xp = Math.min(limiteDescanso(p), d.xp + ganho);
  return d.xp - antes;
}

// Parte extra do XP de um abate que sai da reserva de descanso.
function gastarDescanso(p, xp) {
  const reserva = p.descanso?.xp || 0;
  if (!(reserva > 0) || !(xp > 0)) return 0;
  const extra = Math.min(reserva, Math.round(xp * (REGRAS_DESCANSO.multiplicador - 1)));
  p.descanso.xp = reserva - extra;
  return extra;
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
  const base = inimigos[inimigoId]?.base;
  return ORDEM_CAPITULOS.find((k) => CAPITULOS[k].inimigo === inimigoId || CAPITULOS[k].inimigo === base) || null;
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
// "do Egito", "da Galileia", "de Canaã".
function nomeComDe(areaId) {
  const de = { a: "de", ao: "do", "à": "da" }[PREPOSICAO_AREA[areaId] || "a"];
  return `${de} ${areas[areaId]?.nome || areaId}`;
}

// ---------------------------------------------------------------------
// Viagem rápida, barco e lojas (funções puras para a interface)
// ---------------------------------------------------------------------
// Cidade aberta para viagem rápida e desembarque: Canaã e o Deserto sempre; um capítulo, quando o
// capítulo anterior foi concluído (a mesma regra dos portais).
function areaAberta(p, areaId) {
  if (!REGRAS_VIAGEM.ordem.includes(areaId)) return false;
  return CAPITULOS[areaId] ? capituloAnteriorConcluido(p, areaId) : true;
}

// Preço da viagem rápida entre duas cidades (null se não houver rota): base + porEtapa × etapas.
function precoViagem(origem, destino) {
  const o = REGRAS_VIAGEM.ordem;
  const i = o.indexOf(origem);
  const j = o.indexOf(destino);
  if (i < 0 || j < 0 || i === j) return null;
  return REGRAS_VIAGEM.base + REGRAS_VIAGEM.porEtapa * Math.abs(i - j);
}

// Destinos que um guia oferece a partir da área do jogador: todas as cidades, com preço, se estão abertas
// e quanto falta de moedas.
function destinosDeViagem(p) {
  return REGRAS_VIAGEM.ordem.map((area) => {
    const preco = precoViagem(p.area, area);
    const aberta = areaAberta(p, area);
    return {
      area,
      nome: areas[area].nome,
      atual: area === p.area,
      aberta,
      preco,
      falta: preco !== null ? Math.max(0, preco - (p.moedas || 0)) : 0,
      motivo: aberta ? "" : "conclua o capítulo anterior",
    };
  });
}

// Catálogo de um mercador: [{ item, preco }] na ordem de LOJAS (só itens com preço em PRECOS_LOJA).
function catalogoDaLoja(npcId) {
  const lista = registroDe(LOJAS, npcId) || [];
  return lista.filter((item) => registroDe(PRECOS_LOJA, item)).map((item) => ({ item, preco: PRECOS_LOJA[item] }));
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
  const casa = lista("criaturas").includes(e.id) || lista("criaturas").includes(e.base) || lista("especies").includes(e.especie) || lista("familias").includes(e.familia);
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
  const t = registroDe(TAREFAS, tarefaId);
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
  const t = registroDe(TAREFAS, tarefaId);
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
  const e = registroDe(inimigos, inimigoId);
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

// Unidades de um item que o jogador tem (mochila e equipamento).
function unidadesDoItem(p, item) {
  // Conta o item em qualquer raridade ("escudo_ferro@raro.vida8" também é um escudo de ferro).
  const naMochila = (p?.inventario || []).filter((x) => baseItem(x) === item).length;
  return naMochila + Object.values(p?.equipamento || {}).filter((x) => x && baseItem(x) === item).length;
}

// Ofertas da troca de pontos, na ordem dos dados. possui: unidades do item da oferta que o jogador
// já tem (a interface pede confirmação antes de trocar outro; 0 nas melhorias).
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
      possui: o.item ? unidadesDoItem(p, o.item) : 0,
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
    const t = registroDe(TAREFAS, id);
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
    texto = "Pesque nos pontos marcados (P) ou navegue até o cais de uma cidade aberta para desembarcar.";
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
// Analisador de caçada (JGB-10) — contas puras; o estado fica em Mundo.estado[id].analisador
// ---------------------------------------------------------------------
// inicio: hora do primeiro golpe da sessão (0 = parado, esperando o primeiro golpe); xp e abates: dos
// abates; moedas: as recolhidas do chão; valorItens: valor de venda (VALORES_VENDA) dos itens recolhidos;
// itens e equipamentos: quantos; gastos: poções e flechas pelo preço da loja; perdas: moedas da morte;
// especies: abates por espécie.
function analisadorNovo() {
  return { inicio: 0, xp: 0, abates: 0, mortes: 0, moedas: 0, valorItens: 0, itens: 0, equipamentos: 0, gastos: 0, perdas: 0, especies: {} };
}

// Preço de uma flecha na loja (o pacote dividido pelas flechas dele).
function custoFlecha() {
  return (PRECOS_LOJA.flechas || 0) / (FLECHAS_POR_PACOTE || 1);
}

// Quanto os mercadores pagam pelo item (0 para equipamento, que eles não compram).
function valorDeVenda(item) {
  return registroDe(VALORES_VENDA, baseItem(item)) || 0;
}

// Painel do analisador: totais, taxas por hora (null antes de ANALISADOR_MINIMO_MS) e tempo até o próximo nível.
function resumoAnalisador(p, a, agora = Date.now()) {
  const duracaoMs = a.inicio ? Math.max(0, agora - a.inicio) : 0;
  const medindo = duracaoMs >= ANALISADOR_MINIMO_MS;
  const porHora = (v) => (medindo ? Math.round((v * MS_POR_HORA) / duracaoMs) : null);
  const saque = a.moedas + a.valorItens;
  const gastos = Math.round(a.gastos);
  const lucro = saque - gastos - a.perdas;
  const nivelMaximo = (p.nivel || 1) >= NIVEL_MAXIMO;
  const xpFalta = nivelMaximo ? 0 : Math.max(0, limiarNivel(p.nivel || 1) - (p.xp || 0));
  const xpHora = porHora(a.xp);
  const especies = Object.entries(a.especies || {})
    .filter(([k, n]) => registroDe(ESPECIES, k) && n > 0)
    .sort((x, y) => y[1] - x[1] || ORDEM_ESPECIES.indexOf(x[0]) - ORDEM_ESPECIES.indexOf(y[0]))
    .map(([k, n]) => ({ especie: k, nome: ESPECIES[k].nome, abates: n }));
  return {
    ativo: !!a.inicio,
    medindo,
    duracaoMs,
    xp: a.xp,
    xpHora,
    abates: a.abates,
    abatesHora: porHora(a.abates),
    mortes: a.mortes,
    moedas: a.moedas,
    valorItens: a.valorItens,
    itens: a.itens,
    equipamentos: a.equipamentos,
    saque,
    saqueHora: porHora(saque),
    gastos,
    perdas: a.perdas,
    lucro,
    lucroHora: porHora(lucro),
    nivel: p.nivel || 1,
    nivelMaximo,
    xpFalta,
    proximoNivelMs: !nivelMaximo && xpHora > 0 ? Math.ceil((xpFalta * MS_POR_HORA) / xpHora) : null,
    especies,
  };
}

// Relógio da sessão: "1:05:12" (ou "5:12" abaixo de 1 hora).
function textoRelogio(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const dois = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${dois(m)}:${dois(sec)}` : `${m}:${dois(sec)}`;
}

// ---------------------------------------------------------------------
// Mundo
// ---------------------------------------------------------------------
const Mundo = {
  jogadores: {},
  estado: {},

  // Toda gravação marca a presença do jogador: a ausência desde a anterior que caiu no Sábado vira
  // reserva de XP de descanso (JGB-11).
  salvar(p) {
    const descanso = creditarDescanso(p, Date.now());
    if (descanso > 0) this.avisarDescanso(p, descanso);
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
      zerarComportamento(e);
    }
    this.jogadores[id] = p;
    // O analisador de caçada vive na memória (não vai ao save) e atravessa as trocas de área e a morte,
    // que chamam entrar() de novo: só zera ao recarregar a página ou pelo comando zerarAnalisador.
    const analisador = this.estado[id]?.analisador || analisadorNovo();
    this.estado[id] = {
      analisador,
      proximaRegen: Date.now() + TEMPO_REGEN,
      ultimoCombate: 0,
      proximoAtaqueJogador: 0,
      proximaLimpezaSaques: 0,
      explosoes: [],
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
    p.inventario = p.inventario.filter((item) => itemValido(item));

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
      if (item && infoItem(item)?.tipo !== tipo) {
        if (itemValido(item)) p.inventario.push(item);
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
        ((Number.isInteger(s.moedas) && s.moedas > 0) || itemValido(s.item)),
    );
    for (const s of p.saqueNoChao) {
      if (!Number.isFinite(s.criadoEm)) s.criadoEm = agora;
      if ("destaque" in s && (!s.item || !registroDe(RARIDADES, s.destaque))) delete s.destaque;
    }

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
    // Bestiário (save v10): abates por espécie. Saves até a v9 começam do zero (não havia contagem).
    normalizarBestiario(p);
    // Maná e descanso (save v11). Saves até a v10 começam com o jarro vazio e a ausência contando de agora.
    normalizarMana(p, agora);
    normalizarDescanso(p, agora);

    // Fé e Oração.
    p.oracaoDesbloqueada = !!p.oracaoDesbloqueada;
    p.fe = Number.isFinite(p.fe) ? Math.max(0, Math.min(FE_MAXIMA, Math.floor(p.fe))) : FE_MAXIMA;
    // Status (save v12): veneno, sangramento, atordoamento e medo num motor só (p.status e p.imune).
    normalizarStatus(p, agora);
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

    if (!novo && versaoAnterior < 10) {
      this.adicionarAviso(
        p,
        "atualizacao_10",
        "Novidades: o bestiário (tecla B) registra os seus abates de cada criatura e revela ficha, fraquezas e saque; " +
          "complete uma família e ganhe o amuleto dela (+5% de dano). O analisador de caçada (tecla X) mostra XP/h, saque/h e lucro.",
      );
    }

    if (!novo && versaoAnterior < 11) {
      this.adicionarAviso(
        p,
        "atualizacao_11",
        "Novidades: o maná cai todo dia ao amanhecer (tecla N ou botão Maná): colha e coma para recuperar vida e fé; " +
          "o que sobra estraga no dia seguinte. E quem descansa no Sábado volta com XP em dobro nas próximas caçadas.",
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
    // Saves até a v8 são dos mapas de 80×60: a posição vai para o ponto equivalente do mapa novo (dobro).
    if (!novo && versaoAnterior < 9) {
      p.x = Number.isInteger(p.x) ? p.x * ESCALA_MAPAS_V8 : p.x;
      p.y = Number.isInteger(p.y) ? p.y * ESCALA_MAPAS_V8 : p.y;
      for (const s of p.saqueNoChao) {
        s.x *= ESCALA_MAPAS_V8;
        s.y *= ESCALA_MAPAS_V8;
      }
      this.adicionarAviso(
        p,
        "atualizacao_9",
        "Os mapas ficaram maiores: vilas com ruas, casas e tendas, moradores para conversar e novas áreas de caça. " +
          "Se a sua posição antiga não existe mais, você foi levado ao lugar livre mais próximo.",
      );
    }
    // Posição segura: se o mapa mudou e o jogador ficou fora dele, sobre um obstáculo, estrutura ou NPC,
    // vai para a casa livre mais próxima (ou para o início da área).
    if (!this.casaParaFicar(p.area, p.x, p.y)) Object.assign(p, this.casaLivreMaisProxima(p.area, p.x, p.y));
    // Saques no chão que ficaram sobre um obstáculo vão para a casa livre mais próxima.
    for (const s of p.saqueNoChao) {
      if (!dentroDoMapa(s.x, s.y) || mapas[s.area][s.y][s.x] !== 0) Object.assign(s, this.casaLivreMaisProxima(s.area, s.x, s.y));
    }

    // Vida dos inimigos. Saves anteriores à v6 gravaram a vida cheia da
    // tabela antiga (lobo 50, chefe 100, guarda 40…): com o rebalanceamento,
    // todo inimigo vivo volta com a vida máxima nova.
    const vidaAntiga = versaoAnterior < 6;
    // Campeões (p.campeoes[id] = modificadores) e raros nomeados (p.nomeados[id] = { janela }).
    if (!objetoValido(p.campeoes)) p.campeoes = {};
    for (const [chave, mods] of Object.entries(p.campeoes)) {
      const e = registroDe(inimigos, chave);
      const validos = Array.isArray(mods) ? mods.filter((k) => registroDe(MODIFICADORES_CAMPEAO, k)) : [];
      if (!e || !podeSerCampeao(e) || !validos.length) delete p.campeoes[chave];
      else p.campeoes[chave] = validos;
    }
    if (!objetoValido(p.nomeados)) p.nomeados = {};
    for (const [chave, n] of Object.entries(p.nomeados)) {
      if (!registroDe(inimigos, chave)?.nomeado || !objetoValido(n) || !Number.isInteger(n.janela)) delete p.nomeados[chave];
    }
    for (const e of Object.values(inimigos)) {
      const hp = p.vidaInimigos[e.id];
      if (p.inimigosDerrotados.includes(e.id)) p.vidaInimigos[e.id] = 0;
      else if (vidaAntiga || !Number.isFinite(hp) || hp <= 0) p.vidaInimigos[e.id] = atributosInimigo(p, e).vidaMaxima;
      else p.vidaInimigos[e.id] = Math.min(hp, atributosInimigo(p, e).vidaMaxima);
    }
    p.versao = VERSAO_SAVE;
    return p;
  },

  // ----- Posição segura -----
  // Casa onde o jogador pode ficar: dentro do mapa, livre (sem obstáculo nem estrutura) e sem NPC.
  casaParaFicar(areaId, x, y) {
    return dentroDoMapa(x, y) && mapas[areaId]?.[y][x] === 0 && !this.npcEm(areaId, x, y);
  },

  // Casa livre mais próxima de (x, y), em anéis cada vez maiores; sem nenhuma, o início da área.
  casaLivreMaisProxima(areaId, x, y) {
    const cx = Number.isInteger(x) ? Math.max(0, Math.min(COLS - 1, x)) : 0;
    const cy = Number.isInteger(y) ? Math.max(0, Math.min(ROWS - 1, y)) : 0;
    for (let r = 0; r < Math.max(COLS, ROWS); r++) {
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.casaParaFicar(areaId, cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
        }
    }
    const inicio = areas[areaId]?.inicio || areas.canaan.inicio;
    return { x: inicio.x, y: inicio.y };
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
  // O raro nomeado só existe dentro da janela de aparição.
  inimigoVivo(p, inimigoId) {
    if (p.inimigosDerrotados.includes(inimigoId) || !(p.vidaInimigos[inimigoId] > 0)) return false;
    const e = inimigos[inimigoId];
    return !e?.nomeado || this.nomeadoPresente(p, e);
  },

  nomeadoPresente(p, e, agora = Date.now()) {
    const j = janelaNomeado(e, agora);
    return !!j?.ativa && p.nomeados?.[e.id]?.janela === j.indice;
  },

  obterVidaInimigo(id, inimigoId) {
    const p = this.jogadores[id];
    const e = inimigos[inimigoId];
    if (!p || !e) return null;
    return this.inimigoVivo(p, inimigoId) ? p.vidaInimigos[inimigoId] : 0;
  },

  // Para a interface: vida máxima e nome com os modificadores de campeão, e a "ficha" da criatura.
  vidaMaximaInimigo(id, inimigoId) {
    const p = this.jogadores[id];
    const e = registroDe(inimigos, inimigoId);
    return p && e ? atributosInimigo(p, e).vidaMaxima : 0;
  },

  nomeInimigo(id, inimigoId) {
    const p = this.jogadores[id];
    const e = registroDe(inimigos, inimigoId);
    return p && e ? nomeInimigo(p, e) : "";
  },

  fichaInimigo(id, inimigoId) {
    const p = this.jogadores[id];
    const e = registroDe(inimigos, inimigoId);
    if (!p || !e) return null;
    const at = atributosInimigo(p, e);
    return {
      nome: nomeInimigo(p, e),
      tier: e.tier,
      campeao: at.campeao,
      modificadores: at.modificadores,
      nomeado: !!e.nomeado,
      titulo: e.titulo || null,
      familia: FAMILIAS_CRIATURAS[e.familia]?.nome || "",
      comportamentos: e.comportamentos.map((c) => COMPORTAMENTOS[c].nome),
      curandeiro: e.comportamentos.includes("curandeiro"),
      status: e.efeito ? STATUS_CRIATURAS[e.efeito.tipo].nome : null,
      nivel: e.nivel,
      furioso: !!e.furioso,
      amuleto: bonusAmuleto(p, e),
      estagioBestiario: estagioDeAbates(abatesDaEspecie(p, e.especie)),
    };
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
    if (!itemValido(item) || pesoCarregado(p) + pesoItem(item) > capacidadeCarga(p) + 0.0001) return false;
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

  // Tirar um equipamento com vida extra baixa a vida máxima: a vida atual não passa dela.
  ajustarVidaAoEquipamento(p) {
    p.vida = Math.min(p.vida, vidaMaxima(p));
  },

  mensagemMochilaCheia(p, complemento) {
    return `Mochila cheia (${pesoCarregado(p)}/${capacidadeCarga(p)} kg). ${complemento}`;
  },

  equiparItem(id, itemId, slot) {
    const p = this.jogadores[id];
    const tipo = registroDe(SLOTS_EQUIPAMENTO, slot);
    if (!p || !tipo || infoItem(itemId)?.tipo !== tipo)
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
    this.ajustarVidaAoEquipamento(p);
    this.salvar(p);
    const d = infoItem(itemId);
    const efeito = [d.bonus ? `+${d.bonus} de dano` : `+${d.defesa || 0} de defesa`, ...textoAtributos(itemId).filter((t) => !/de dano$|de defesa$/.test(t))];
    return { ok: true, mensagem: `${nomeItem(itemId)} equipado (${efeito.join(", ")}).` };
  },

  desequiparItem(id, slot) {
    const p = this.jogadores[id];
    const item = registroDe(SLOTS_EQUIPAMENTO, slot) ? p?.equipamento?.[slot] : null;
    if (!item) return { ok: false };
    p.inventario.push(item);
    p.equipamento[slot] = null;
    this.ajustarVidaAoEquipamento(p);
    this.salvar(p);
    return { ok: true, mensagem: `${nomeItem(item)} voltou para a mochila.` };
  },

  atribuirHotkey(id, indice, item) {
    const p = this.jogadores[id];
    if (!p || indice < 0 || indice > 5) return { ok: false };
    if (item && (registroDe(ITENS, item)?.tipo !== "consumivel" || !p.inventario.includes(item))) {
      return { ok: false, mensagem: "A hotkey aceita consumíveis que estejam na mochila." };
    }
    p.hotkeys[indice] = item || null;
    this.salvar(p);
    return { ok: true };
  },

  alternarEquipamento(id, slot) {
    const p = this.jogadores[id];
    const tipo = registroDe(SLOTS_EQUIPAMENTO, slot);
    if (!tipo) return { ok: false, mensagem: "Espaço de equipamento inválido." };
    const atual = p.equipamento[slot];
    const valor = (item) => infoItem(item).bonus || infoItem(item).defesa || 0;
    const candidatos = p.inventario.filter((item) => infoItem(item)?.tipo === tipo).sort((a, b) => valor(b) - valor(a));
    if (atual && candidatos.length) {
      const escolhido = candidatos[0];
      p.inventario[p.inventario.indexOf(escolhido)] = atual;
      p.equipamento[slot] = escolhido;
      this.ajustarVidaAoEquipamento(p);
      this.salvar(p);
      return { ok: true, mensagem: `Equipado: ${nomeItem(escolhido)}. ${nomeItem(atual)} foi para a mochila.` };
    }
    if (atual) {
      p.inventario.push(atual);
      p.equipamento[slot] = null;
      this.ajustarVidaAoEquipamento(p);
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
    this.ajustarVidaAoEquipamento(p);
    this.salvar(p);
    const aviso = trocou ? " Espada e arco não podem ser usados ao mesmo tempo; o outro foi para a mochila." : "";
    return { ok: true, mensagem: `Equipado: ${nomeItem(escolhido)}.${aviso}` };
  },

  // ----- Saques no chão -----
  // Sorteia a tabela de saque da criatura e põe no chão. Devolve os nomes (para a mensagem) e os
  // destaques: saques incomuns ou melhores, ou de linha com 1% de chance ou menos, que brilham e tocam.
  // reforco (campeão): sorteia a tabela reforco.rolagensSaque vezes, equipamento com reforco.raridadeMinima
  // ou melhor e moedas × reforco.moedas.
  criarSaque(p, e, agora = Date.now(), reforco = null) {
    const moedas = Math.round((e.saque?.moedas || 0) * (reforco?.moedas || 1));
    const sufixo = `${agora}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    const itens = [];
    const destaques = [];
    const sorteio = [];
    for (let i = 0; i < (reforco?.rolagensSaque || 1); i++) sorteio.push(...sortearSaque(e, Math.random, reforco?.raridadeMinima));
    for (const { item, chance } of sorteio) {
      const id = `saque_${e.id}_${sufixo}_${itens.length}`;
      const destaque = destaqueDoSaque(item, chance);
      const s = { id, area: e.area, x: e.x, y: e.y, item, criadoEm: agora };
      if (indiceRaridade(destaque) > indiceRaridade(raridadeItem(item))) s.destaque = destaque;
      p.saqueNoChao.push(s);
      itens.push(item);
      if (indiceRaridade(destaque) >= indiceRaridade("incomum")) destaques.push({ saqueId: id, item, raridade: destaque, chance });
    }
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
    const nomes = [...itens.map(nomeItem), ...(moedas > 0 ? [`${moedas} moedas`] : [])];
    return { nomes, destaques };
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
    // O item que caiu na morte do próprio jogador não é saque novo: não entra no analisador.
    const analisador = this.estado[id]?.analisador;
    const conta = analisador?.inicio && !s.id.startsWith("morte_");
    if (s.moedas) {
      p.moedas += s.moedas;
      if (conta) analisador.moedas += s.moedas;
      p.saqueNoChao = p.saqueNoChao.filter((x) => x.id !== s.id);
      this.salvar(p);
      return { ok: true, moedas: s.moedas, itemColetado: s.id, mensagem: `Você pegou ${s.moedas} moedas.` };
    }
    if (!this.adicionarItem(p, s.item)) {
      return { ok: false, mensagem: this.mensagemMochilaCheia(p, "Libere espaço para pegar o item.") };
    }
    p.saqueNoChao = p.saqueNoChao.filter((x) => x.id !== s.id);
    if (conta) {
      analisador.itens += 1;
      analisador.valorItens += valorDeVenda(s.item);
      if (TIPOS_COM_RARIDADE.has(infoItem(s.item)?.tipo)) analisador.equipamentos += 1;
    }
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
    const merc = p && this.mercadorProximo(p);
    if (!merc) return { ok: false, mensagem: "Aproxime-se do mercador para comprar." };
    const preco = catalogoDaLoja(merc.id).find((x) => x.item === item)?.preco;
    if (!preco) return { ok: false, mensagem: "Esse mercador não vende esse item." };
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
    const valor = registroDe(VALORES_VENDA, item);
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
      case "zerarAnalisador":
        return this.zerarAnalisador(id);
      case "colherMana":
        return this.colherMana(id);
      case "comerMana":
        return this.comerMana(id);
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
    if (this.atordoado(p)) return { ok: false, atordoado: true, mensagem: "Você está atordoado." };
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
      // Cais de cada cidade: desembarca logo abaixo do cais dela, se a cidade já estiver aberta.
      for (const [regiao, porto] of Object.entries(areas.mar.portos)) {
        if (x !== porto.cais.x || y !== porto.cais.y) continue;
        if (!areaAberta(p, regiao)) {
          this.salvar(p);
          return {
            ok: true,
            caminhoBloqueado: true,
            mensagem: `O cais ${nomeComDe(regiao)} ainda está fechado. Conclua o capítulo anterior para desembarcar ali.`,
          };
        }
        const cais = areas[regiao].cais;
        return this.mudarDeArea(p, regiao, cais.x, cais.y + 1, `O barco chegou ao cais ${nomeComDe(regiao)}.`);
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
    if (area.cais && x === area.cais.x && y === area.cais.y && areas.mar.portos[p.area]) {
      // Barco pago: sem moedas, o jogador fica no cais.
      const passagem = REGRAS_BARCO.passagem;
      if (p.moedas < passagem) {
        this.salvar(p);
        return {
          ok: true,
          caminhoBloqueado: true,
          mensagem: `A passagem do barco custa ${passagem} moedas e você tem ${p.moedas}.`,
        };
      }
      p.moedas -= passagem;
      const embarque = areas.mar.portos[p.area].embarque;
      return {
        ...this.mudarDeArea(
          p,
          "mar",
          embarque.x,
          embarque.y,
          `Você pagou ${passagem} moedas de passagem e embarcou. Navegue até o cais de qualquer cidade aberta para desembarcar.`,
        ),
        passagemPaga: passagem,
      };
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
    // Brota de novo noutro lugar da área (o progresso de missão conta pelo id, não pela posição).
    const novaCasa = sortearCasaDeColeta(p.area);
    if (novaCasa) Object.assign(c, novaCasa);
    this.registrarColeta(p, grupo.item, c.id, "mapa");
    this.salvar(p);
    const mensagem = p.area === "canaan" ? "Você coletou uma erva medicinal." : "Você encontrou um odre de água.";
    return { ok: true, itemColetado: c.id, mensagem };
  },

  viajar(id, destino) {
    const p = this.jogadores[id];
    const guia = this.npcProximo(p, (n) => n.papel === "guia");
    if (!guia) return { ok: false, mensagem: "Aproxime-se de um guia de caravanas para usar a viagem rápida." };
    const preco = precoViagem(p.area, destino);
    if (preco === null) return { ok: false, mensagem: "Destino indisponível." };
    if (!areaAberta(p, destino)) {
      return { ok: false, mensagem: `A rota ${nomeComPreposicao(destino)} ainda está fechada: conclua o capítulo anterior.` };
    }
    if (p.moedas < preco) return { ok: false, mensagem: `A viagem custa ${preco} moedas e você tem ${p.moedas}.` };
    p.moedas -= preco;
    const chegada = areas[destino].chegadaViagem;
    return {
      ...this.mudarDeArea(
        p,
        destino,
        chegada.x,
        chegada.y,
        `Viagem rápida ${nomeComPreposicao(destino)} por ${preco} moedas.`,
      ),
      precoViagem: preco,
    };
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
      mensagem: `Você pescou um peixe fresco! Os mercadores compram cada peixe por ${VALORES_VENDA.peixe} moedas.`,
    };
  },

  // ----- Consumíveis -----
  // Gasto de provisão (poção) durante a sessão de caça: só conta com o relógio do analisador correndo.
  gastoNoAnalisador(id, valor) {
    const a = this.estado[id]?.analisador;
    if (a?.inicio) a.gastos += valor;
  },

  usarPocao(id) {
    const p = this.jogadores[id];
    const i = p.inventario.indexOf("pocao");
    if (i < 0) return { ok: false, mensagem: "Você não tem poções." };
    if (p.vida >= vidaMaxima(p)) return { ok: false, mensagem: "Sua vida já está cheia. A poção não foi consumida." };
    p.inventario.splice(i, 1);
    this.gastoNoAnalisador(id, PRECOS_LOJA.pocao || 0);
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
    this.gastoNoAnalisador(id, PRECOS_LOJA.pocao_fe || 0);
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
  // ----- Maná diário e descanso do Sábado (JGB-11) -----
  avisarDescanso(p, ganho) {
    if (!Array.isArray(p.avisosPendentes)) p.avisosPendentes = [];
    const antes = p.avisosPendentes.find((a) => a.id === "descanso");
    const total = ganho + (antes?.ganho || 0);
    p.avisosPendentes = p.avisosPendentes.filter((a) => a.id !== "descanso");
    p.avisosPendentes.push({
      id: "descanso",
      ganho: total,
      texto:
        `Você descansou no Sábado: +${total} XP de descanso (reserva: ${p.descanso.xp}). ` +
        `Os próximos abates rendem XP em dobro até a reserva acabar.`,
    });
  },

  // Porções guardadas que estragaram (Êx 16:20). Devolve quantas.
  estragarMana(p, agora) {
    if (!objetoValido(p.mana) || !(p.mana.porcao > 0) || agora < p.mana.estragaEm) return 0;
    const n = p.mana.porcao;
    p.mana.porcao = 0;
    p.mana.estragaEm = 0;
    this.salvar(p);
    return n;
  },

  textoManaEstragou(p, n, agora) {
    const porcoes = n === 1 ? "1 porção" : `${n} porções`;
    const hojeTexto = estadoMana(p, agora).disponivel ? " O maná de hoje já caiu: colha com N." : "";
    return `O maná guardado criou bichos e cheirou mal (Êx 16:20): ${porcoes} se perderam.${hojeTexto}`;
  },

  colherMana(id) {
    const p = this.jogadores[id];
    const agora = Date.now();
    this.estragarMana(p, agora);
    const est = estadoMana(p, agora);
    const quando = textoEspera(est.proximoEm - agora);
    if (est.sabado) {
      const guardado = est.guardado ? ` Você ainda tem ${est.guardado} no jarro.` : "";
      return { ok: false, mensagem: `Hoje é Sábado: o maná não cai (Êx 16:26).${guardado} O próximo cai em ${quando}.` };
    }
    if (!est.disponivel) return { ok: false, mensagem: `Você já colheu o maná de hoje. O próximo cai em ${quando}.` };
    const dia = diaDoMana(agora);
    p.mana.porcao = Math.min(Math.max(REGRAS_MANA.porcao, REGRAS_MANA.porcaoSexta), est.guardado + est.porcaoHoje);
    p.mana.estragaEm = proximoAmanhecerComMana(dia.fim);
    p.mana.proximaEm = dia.fim;
    this.salvar(p);
    const dura = textoEspera(p.mana.estragaEm - agora);
    const texto = est.dobrado
      ? `Sexta-feira: porção dobrada! Você colheu ${est.porcaoHoje} porções de maná. Guarde para o Sábado: ` +
        `este não estraga até o amanhecer depois dele (em ${dura}; Êx 16:22-24).`
      : `Você colheu ${est.porcaoHoje} porções de maná (Êx 16:16). Coma quando precisar (N): o que sobrar estraga em ${dura}.`;
    return { ok: true, mana: est.porcaoHoje, mensagem: texto };
  },

  comerMana(id) {
    const p = this.jogadores[id];
    const agora = Date.now();
    const estragou = this.estragarMana(p, agora);
    if (!(p.mana.porcao > 0)) {
      const est = estadoMana(p, agora);
      if (estragou) return { ok: false, mensagem: this.textoManaEstragou(p, estragou, agora) };
      if (est.disponivel) return { ok: false, mensagem: "O seu jarro está vazio, mas o maná de hoje já caiu: colha primeiro." };
      return { ok: false, mensagem: `O seu jarro está vazio. O próximo maná cai em ${textoEspera(est.proximoEm - agora)}.` };
    }
    const vidaMax = vidaMaxima(p);
    const feCheia = !p.oracaoDesbloqueada || p.fe >= FE_MAXIMA;
    if (p.vida >= vidaMax && feCheia) {
      return { ok: false, mensagem: "Você está saciado (vida e fé cheias). O maná fica no jarro para depois." };
    }
    const cura = Math.min(vidaMax - p.vida, Math.max(1, Math.round(vidaMax * REGRAS_MANA.cura.vida)));
    const fe = p.oracaoDesbloqueada ? Math.min(FE_MAXIMA - p.fe, REGRAS_MANA.cura.fe) : 0;
    p.vida += cura;
    p.fe += fe;
    p.mana.porcao -= 1;
    if (!p.mana.porcao) p.mana.estragaEm = 0;
    this.salvar(p);
    const ganhos = [cura ? `+${cura} de vida` : "", fe ? `+${fe} de fé` : ""].filter(Boolean).join(", ");
    const restam = p.mana.porcao ? `Restam ${p.mana.porcao} no jarro.` : "O jarro ficou vazio.";
    return { ok: true, cura, fe, mensagem: `Você comeu o maná, com gosto de bolo de mel (Êx 16:31): ${ganhos}. ${restam}` };
  },

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
    const custo = registroDe(CUSTO_ORACAO, acao);
    if (custo === undefined) return { ok: false, mensagem: "Escolha uma forma de Oração." };
    const nivel = nivelHabilidade(p, "oracao");
    if (nivel < NIVEL_ORACAO[acao]) {
      return {
        ok: false,
        mensagem: `${NOMES_ORACAO[acao]} desbloqueia no nível ${NIVEL_ORACAO[acao]} de Oração (atual: ${nivel}).`,
      };
    }
    const agora = Date.now();
    const envenenado = !!(statusAtivo(p, "veneno", agora) || statusAtivo(p, "sangramento", agora));
    const vidaCheia = p.vida >= vidaMaxima(p);
    if ((acao === "vida" || acao === "area") && vidaCheia) return { ok: false, mensagem: "Sua vida já está cheia." };
    if (acao === "veneno" && !envenenado) return { ok: false, mensagem: "Você não está envenenado nem sangrando." };
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
      const sangrava = !!statusAtivo(p, "sangramento", agora);
      const envenenadoAgora = !!statusAtivo(p, "veneno", agora);
      curarStatus(p, "veneno");
      curarStatus(p, "sangramento");
      mensagem = envenenadoAgora && sangrava ? "O veneno e o sangramento foram removidos pela Oração." : sangrava ? "O sangramento foi estancado pela Oração." : "O veneno foi removido pela Oração.";
    } else if (acao === "area") {
      p.vida = Math.min(vidaMaxima(p), p.vida + 30 + Math.floor(nivel / 2));
      mensagem = `Oração em área 3×3: você recuperou ${p.vida - antes} de vida. Aliados próximos serão curados quando houver companheiros no jogo.`;
    } else {
      p.vida = vidaMaxima(p);
      for (const tipo of TIPOS_STATUS) curarStatus(p, tipo);
      mensagem = "Milagre: vida restaurada por completo e todos os status removidos.";
    }
    const subiu = ganharHabilidade(p, "oracao", XP_HABILIDADE_POR_USO.oracao);
    if (subiu) mensagem += ` Oração: nível ${p.habilidades.oracao}.`;
    this.salvar(p);
    return { ok: true, cura: p.vida - antes, mensagem: `${mensagem} Fé ${p.fe}/${FE_MAXIMA}.` };
  },

  // Atordoado: não anda nem ataca (poções e Oração continuam valendo).
  atordoado(p, agora = Date.now()) {
    return !!statusAtivo(p, "atordoamento", agora);
  },

  // ----- Conversas -----
  interagir(id, alvoId) {
    const p = this.jogadores[id];
    const npc = alvoId ? registroDe(npcs, alvoId) : this.npcProximo(p);
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
        abrirLoja: npc.id,
        mensagem: `${npc.nome.split(",")[0]}: ${npc.falas?.saudacao || "Tenho provisões, flechas e equipamentos para vender."}`,
      };
    }
    if (npc.papel === "guia") {
      const abertas = destinosDeViagem(p).filter((d) => d.aberta && !d.atual).length;
      return {
        ok: true,
        abrirViagem: npc.id,
        mensagem: `${npc.nome.split(",")[0]}: Levo você a ${abertas === 1 ? "1 cidade" : `${abertas} cidades`} daqui. O preço depende da distância; a pé e de barco também se chega.`,
      };
    }
    if (npc.papel === "ambiente") return this.interagirMorador(id, npc);
    if (npc.capitulo) return this.interagirCapitulo(id, npc);
    return { ok: true, mensagem: `${npc.nome}: A paz esteja com você.` };
  },

  // Morador (papel "ambiente"): diz as falas.linhas uma de cada vez, em rodízio (só na sessão, fora do save).
  interagirMorador(id, npc) {
    const linhas = npc.falas?.linhas || [];
    const nome = npc.nome.split(",")[0];
    if (!linhas.length) return { ok: true, mensagem: `${nome}: A paz esteja com você.` };
    const vez = (this.estado[id].falasMorador = this.estado[id].falasMorador || {});
    const i = vez[npc.id] || 0;
    vez[npc.id] = (i + 1) % linhas.length;
    return { ok: true, mensagem: `${nome}: ${linhas[i]}` };
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
      const criatura = aberto.objetivo.criatura;
      if (aberto.objetivo.tipo === "derrotar" && (criatura === inimigoId || criatura === inimigos[inimigoId]?.base)) {
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
      // Conta cada origem uma vez e para na meta (há mais pontos de coleta no mapa do que a missão pede).
      if (!lista.includes(origemId) && lista.length < (o.quantidade || 1)) lista.push(origemId);
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
    const t = registroDe(TAREFAS, tarefaId);
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
    const t = registroDe(TAREFAS, tarefaId);
    if (!t) return { ok: false, mensagem: "Caçada desconhecida." };
    const estado = estadoTarefa(p, tarefaId);
    if (estado === "cumprida") return { ok: false, mensagem: "Esta caçada já foi cumprida: entregue-a a qualquer atalaia." };
    if (estado !== "ativa") return { ok: false, mensagem: "Esta caçada não está ativa." };
    const s = p.tarefas[tarefaId];
    s.ativa = false;
    this.salvar(p);
    const nomeArea = areas[npcs[t.mural]?.area]?.nome || "";
    // Sem progresso não há o que retomar: a caçada só volta a ficar disponível no mural.
    const mensagem = s.progresso > 0
      ? `Caçada guardada com ${s.progresso}/${s.meta}. Para retomar, fale com o atalaia (${nomeArea}).`
      : `Caçada devolvida ao mural: ${t.nome}. Para aceitar de novo, fale com o atalaia (${nomeArea}).`;
    return { ok: true, tarefaId, mensagem };
  },

  // Troca de pontos de tarefa (ao lado de um atalaia com o mural aberto). Pontos nunca viram moedas.
  trocarPontos(id, ofertaId) {
    const p = this.jogadores[id];
    const o = registroDe(OFERTAS_TROCA, ofertaId);
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

  // Bestiário: +1 abate na espécie. Devolve o novo total, o estágio, se subiu de estágio agora e a família
  // cujo amuleto este abate completou (ou null).
  registrarAbateBestiario(p, e) {
    if (!registroDe(ESPECIES, e.especie)) return null;
    if (!objetoValido(p.bestiario)) p.bestiario = {};
    const antes = abatesDaEspecie(p, e.especie);
    const tinhaAmuleto = progressoAmuleto(p, e.familia).ativo;
    p.bestiario[e.especie] = antes + 1;
    const estagio = estagioDeAbates(antes + 1);
    const amuleto = !tinhaAmuleto && progressoAmuleto(p, e.familia).ativo ? e.familia : null;
    return { especie: e.especie, abates: antes + 1, estagio, subiu: estagio > estagioDeAbates(antes), amuleto };
  },

  // ----- Analisador de caçada (JGB-10) -----
  // O relógio começa no primeiro golpe (ou abate, ou morte) depois de zerar; dali em diante contam o XP dos
  // abates, os abates, as mortes, o saque recolhido (moedas e valor de venda dos itens), as poções e flechas
  // gastas (pelo preço da loja) e as moedas perdidas na morte.
  iniciarAnalisador(id, agora = Date.now()) {
    const estado = this.estado[id];
    if (!estado.analisador) estado.analisador = analisadorNovo();
    if (!estado.analisador.inicio) estado.analisador.inicio = agora;
    return estado.analisador;
  },

  analisador(id, agora = Date.now()) {
    const p = this.jogadores[id];
    const a = this.estado[id]?.analisador;
    return p && a ? resumoAnalisador(p, a, agora) : null;
  },

  zerarAnalisador(id) {
    this.estado[id].analisador = analisadorNovo();
    return { ok: true, analisadorZerado: true, mensagem: "Analisador de caçada zerado. O relógio volta a contar no próximo golpe." };
  },

  // ----- Combate do jogador -----
  alvoCorpo(p, alvoId) {
    if (alvoId) {
      const e = registroDe(inimigos, alvoId);
      if (!e || e.area !== p.area) return { erro: "Não há inimigos por perto." };
      if (!this.inimigoVivo(p, e.id)) return { erro: "Esse inimigo já foi derrotado." };
      if (distanciaChebyshev(p, e) > ALCANCE_CORPO)
        return { erro: `Chegue ao lado de ${e.nome.toLowerCase()} para atacá-${e.genero === "f" ? "la" : "lo"}.` };
      return { inimigo: e };
    }
    const e = Object.values(inimigos).find(
      (x) => x.area === p.area && this.inimigoVivo(p, x.id) && distanciaChebyshev(p, x) <= ALCANCE_CORPO,
    );
    return e ? { inimigo: e } : { erro: "Não há inimigos por perto." };
  },

  linhaDeTiroLivre(p, e) {
    // Qualquer direção: alvo dentro do círculo de ALCANCE_ARCO casas e nenhuma casa bloqueada no
    // caminho reto da flecha (linha de Bresenham entre os dois, sem contar as pontas).
    return this.linhaReta({ x: p.x, y: p.y, area: p.area }, e, ALCANCE_ARCO + 0.5);
  },

  alvoDistancia(p, alvoId) {
    const candidatos = Object.values(inimigos)
      .filter((e) => (!alvoId || e.id === alvoId) && e.area === p.area && this.inimigoVivo(p, e.id))
      .filter((e) => this.linhaDeTiroLivre(p, e))
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    if (candidatos.length) return { inimigo: candidatos[0] };
    return {
      erro: `Nenhum inimigo a até ${ALCANCE_ARCO} casas com o caminho livre para a flecha.`,
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
    if (this.atordoado(p, agora)) return { ok: false, atordoado: true, mensagem: "Você está atordoado e não consegue atacar." };
    if (statusAtivo(p, "medo", agora)) return { ok: false, medo: true, mensagem: "Você está com medo e não consegue atacar: recue, beba a poção ou espere passar." };
    const alvo = distancia ? this.alvoDistancia(p, alvoId) : this.alvoCorpo(p, alvoId);
    if (alvo.erro) return { ok: false, mensagem: alvo.erro };
    const e = alvo.inimigo;
    const at = atributosInimigo(p, e);

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
    const analisador = this.iniciarAnalisador(id, agora);
    if (distancia) {
      this.removerItens(p, "flecha", 1);
      analisador.gastos += custoFlecha();
    }

    const bonus = bonusAmuleto(p, e);
    // Combinações: criatura atordoada leva crítico garantido; com medo, leva mais dano.
    const combo = combinacoesNoGolpe(e, agora);
    const golpe = calcularGolpe(p, tipo, at.defesa, combo.critico ? -1 : Math.random(), (1 + bonus) * combo.multiplicador);
    // Atingida, a criatura de matilha chama as outras (mesmo de longe, com a flecha).
    if (e.comportamentos.includes("matilha")) this.alertarMatilha(p, e, agora);
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
      defesaAlvo: at.defesa,
      tipoAtaque: tipo,
      skillLevel: p.habilidades[chaveHabilidade],
      amuleto: bonus,
      combinacoes: combo.nomes.length ? combo.nomes : undefined,
    };
    if (p.vidaInimigos[e.id] === 0) {
      const morte = this.derrotarInimigo(p, e);
      return {
        ...base,
        derrotado: true,
        saques: morte.saques,
        saquesRaros: morte.saquesRaros,
        anuncios: morte.anuncios,
        campeao: morte.campeao,
        nomeado: morte.nomeado,
        explosao: morte.explosao,
        tarefas: morte.tarefas,
        bestiario: morte.bestiario,
        xpGanho: morte.xpGanho,
        xpDescanso: morte.xpDescanso,
        mensagem: `${prefixo}${morte.mensagem}${textoHabilidade}`,
      };
    }
    this.salvar(p);
    const acao = distancia ? `Sua flecha atingiu ${e.nome.toLowerCase()}` : `Você acertou ${e.nome.toLowerCase()}`;
    return {
      ...base,
      derrotado: false,
      mensagem: `${prefixo}${acao} (${golpe.dano} de dano). Vida ${e.genero === "f" ? "dela" : "dele"}: ${p.vidaInimigos[e.id]}/${at.vidaMaxima}.${textoHabilidade}`,
    };
  },

  derrotarInimigo(p, e) {
    const agora = Date.now();
    const at = atributosInimigo(p, e);
    const nome = nomeInimigo(p, e);
    if (!p.inimigosDerrotados.includes(e.id)) p.inimigosDerrotados.push(e.id);
    p.vidaInimigos[e.id] = 0;
    e.status = {};
    e.imune = {};
    const aviso = this.registrarAbate(p, e.id);
    const objetivo = aviso ? ` ${aviso}` : "";
    const tarefas = this.registrarAbateTarefas(p, e);
    // A mensagem só cita a caçada quando ela é cumprida (o progresso aparece nos números do mundo).
    const cacada = tarefas
      .filter((t) => t.cumpridaAgora)
      .map((t) => ` Caçada cumprida: ${t.nome} (${t.meta}/${t.meta})! Entregue a qualquer atalaia.`)
      .join("");
    const xpBase = Math.round(xpDoAbate(p, e) * (at.campeao ? CAMPEAO.xp : 1));
    const xpDescanso = gastarDescanso(p, xpBase); // reserva do Sábado: XP em dobro enquanto durar
    const xpGanho = xpBase + xpDescanso;
    const niveis = adicionarXP(p, xpGanho);
    const bestiario = this.registrarAbateBestiario(p, e);
    const analisador = this.estado[p.id]?.analisador;
    if (analisador) {
      if (!analisador.inicio) analisador.inicio = agora;
      analisador.xp += xpGanho;
      analisador.abates += 1;
      if (e.especie) analisador.especies[e.especie] = (Object.hasOwn(analisador.especies, e.especie) ? analisador.especies[e.especie] : 0) + 1;
    }
    const saque = this.criarSaque(p, e, agora, at.campeao ? CAMPEAO : null);
    // Campeã explosiva: a explosão vem depois, em quem estiver ao lado (Mundo.atualizar).
    const explosao = at.explosao ? { em: agora + at.explosao.atraso, area: e.area, x: e.x, y: e.y, dano: Math.round(at.dano * at.explosao.dano), nome } : null;
    const estado = this.estado[p.id];
    if (explosao && estado) estado.explosoes.push(explosao);
    delete p.campeoes[e.id];
    this.salvar(p);
    const up = niveis.length ? ` Você subiu para o nível ${p.nivel}! Vida máxima: ${vidaMaxima(p)}.` : "";
    const textoSaque = saque.nomes.length ? ` Saque no chão: ${saque.nomes.join(", ")}. Clique no saque ou caminhe sobre ele.` : "";
    // Épico ou melhor, ou linha de 1% ou menos: anúncio próprio no Registro.
    const tituloAnuncio = (d) => {
      if (d.chance <= CHANCES_SAQUE.muito_raro) return `Drop muito raro (${textoChance(d.chance)})!`;
      if (d.chance <= CHANCES_SAQUE.raro) return `Drop raro (${textoChance(d.chance)})!`;
      return RARIDADES[d.raridade].anuncio;
    };
    const anuncios = saque.destaques
      .filter((d) => tituloAnuncio(d))
      .map((d) => `${tituloAnuncio(d)} ${nome} deixou cair: ${nomeItem(d.item)}.`);
    if (at.campeao) anuncios.unshift(`Campeão derrotado: ${nome}! +${xpGanho} XP e saque reforçado.`);
    if (e.nomeado) anuncios.unshift(`${e.nome} foi derrotado! Ele só volta na próxima aparição.`);
    if (bestiario?.subiu) {
      const est = ESTAGIOS_BESTIARIO[bestiario.estagio - 1];
      anuncios.push(`Bestiário: ${e.nome} chegou ao estágio ${bestiario.estagio} de ${ESTAGIO_MAXIMO_BESTIARIO}, ${est.nome} (${est.abates} abates). Revelado: ${est.texto}.`);
    }
    if (bestiario?.amuleto) {
      const a = progressoAmuleto(p, bestiario.amuleto);
      anuncios.push(`Amuleto conquistado: ${a.nome}! +${Math.round(a.bonus * 100)}% de dano contra ${a.nome.toLowerCase()}, para sempre.`);
    }
    const alvoTexto = at.campeao || e.nomeado ? nome : nome.toLowerCase();
    const fraca = xpDoAbate(p, e) < e.xpRecompensa ? " (criatura fraca para o seu nível)" : "";
    const descanso = xpDescanso ? ` (${xpDescanso} do descanso; reserva: ${p.descanso.xp})` : "";
    const reaparece = e.nomeado ? "" : ` ${e.genero === "f" ? "Ela" : "Ele"} reaparecerá em ${TEMPO_RESPAWN_INIMIGO / 1000} segundos.`;
    return {
      saques: p.saqueNoChao.filter((s) => s.area === p.area && s.x === e.x && s.y === e.y).map((s) => s.id),
      saquesRaros: saque.destaques.map(({ saqueId, item, raridade }) => ({ saqueId, item, raridade })),
      anuncios,
      campeao: at.campeao,
      nomeado: !!e.nomeado,
      explosao: explosao ? { em: explosao.em, x: explosao.x, y: explosao.y } : null,
      tarefas,
      bestiario,
      xpGanho,
      xpDescanso,
      mensagem: `Você derrotou ${alvoTexto}! +${xpGanho} XP${descanso}${fraca}.${up}${objetivo}${cacada}${textoSaque}${reaparece}`,
    };
  },

  // Renasce a criatura (o raro nomeado não: ele só volta na próxima janela). Com CAMPEAO.chance, renasce
  // campeã, com 1 ou 2 modificadores.
  reaparecerInimigo(id, inimigoId) {
    const p = this.jogadores[id];
    const e = inimigos[inimigoId];
    if (!p || !e || e.nomeado) return false;
    const i = p.inimigosDerrotados.indexOf(inimigoId);
    if (i < 0) return false;
    p.inimigosDerrotados.splice(i, 1);
    delete p.campeoes[inimigoId];
    if (podeSerCampeao(e) && Math.random() < CAMPEAO.chance) p.campeoes[inimigoId] = sortearModificadores();
    p.vidaInimigos[inimigoId] = atributosInimigo(p, e).vidaMaxima;
    e.x = e.inicioX;
    e.y = e.inicioY;
    sortearPosicaoInimigo(e);
    e.proximoMovimento = 0;
    e.proximoAtaque = 0;
    zerarComportamento(e);
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

  // ----- Comportamento das criaturas (um passo do laço de tempo) -----
  // Devolve "morte" se o jogador morreu (o evento já está em eventos).
  agirCriatura(id, p, estado, e, agora, eventos) {
    const at = atributosInimigo(p, e);
    const tem = (c) => e.comportamentos.includes(c);
    const distancia = distanciaChebyshev(p, e);
    const nome = nomeInimigo(p, e);

    // Status da criatura (JGB-16): tiques de dano, atordoada parada, com medo foge de quem a assustou.
    if (this.passoStatusCriatura(p, e, agora, eventos) === "derrotada") return null;
    if (statusAtivo(e, "atordoamento", agora)) return null;
    if (statusAtivo(e, "medo", agora)) {
      if (agora >= e.proximoMovimento) {
        e.proximoMovimento = agora + at.intervaloMovimento;
        if (this.passoParaLonge(e, p)) eventos.push({ tipo: "inimigoMoveu", id: e.id });
      }
      return null;
    }
    const vida = p.vidaInimigos[e.id];

    if (tem("furia") && !e.furioso && vida <= at.vidaMaxima * COMPORTAMENTOS.furia.vidaLimite) {
      e.furioso = true;
      eventos.push({ tipo: "furia", id: e.id, mensagem: `${nome} entra em fúria!` });
    }
    if (tem("fuga") && !e.fugiu && vida <= at.vidaMaxima * COMPORTAMENTOS.fuga.vidaLimite) {
      e.fugiu = true;
      e.fugindoAte = agora + COMPORTAMENTOS.fuga.duracao;
      e.preparoAte = 0;
      eventos.push({ tipo: "fuga", id: e.id, mensagem: `${nome} foge, ${e.genero === "f" ? "ferida" : "ferido"}!` });
    }
    if (e.fugindoAte > agora) {
      if (agora >= e.proximoMovimento) {
        e.proximoMovimento = agora + Math.round(at.intervaloMovimento * 0.8);
        if (this.passoParaLonge(e, p)) eventos.push({ tipo: "inimigoMoveu", id: e.id });
      }
      return null;
    }
    // Fim da fuga: volta um pouco curada e, se for de matilha, com reforço.
    if (e.fugiu && !e.voltou && e.fugindoAte) {
      const cfg = COMPORTAMENTOS.fuga;
      e.voltou = true;
      e.fugindoAte = 0;
      p.vidaInimigos[e.id] = Math.min(at.vidaMaxima, p.vidaInimigos[e.id] + Math.round(at.vidaMaxima * cfg.curaAoVoltar));
      const reforcos = tem("matilha") ? this.alertarMatilha(p, e, agora, { raio: cfg.raioReforco, chamar: true }) : 0;
      eventos.push({
        tipo: "retorno",
        id: e.id,
        reforcos,
        mensagem: reforcos ? `${nome} volta com reforço (${reforcos})!` : `${nome} volta à luta!`,
      });
    }

    // Curandeiro: cura a aliada mais ferida por perto (prioridade: menor fração de vida).
    if (tem("curandeiro") && agora >= (e.proximaCura || 0)) {
      const cura = this.curarAliada(p, e, agora);
      if (cura) {
        eventos.push(cura);
        return null;
      }
    }

    // Investida: o preparo terminou — avança em linha reta e bate, ou erra se você saiu da linha.
    // A linha ficou marcada no chão no preparo; quem estiver numa casa dela é atingido.
    if (e.preparoAte) {
      if (agora < e.preparoAte) return null;
      const cfg = COMPORTAMENTOS.investida;
      const casas = e.investidaCasas || [];
      e.preparoAte = 0;
      e.investidaCasas = null;
      e.proximaInvestida = agora + cfg.recarga;
      let passos = 0;
      let acertou = false;
      for (const c of casas) {
        if (p.area === e.area && p.x === c.x && p.y === c.y) {
          acertou = true;
          break;
        }
        if (!this.casaLivre(c.x, c.y, p)) break;
        e.x = c.x;
        e.y = c.y;
        passos++;
      }
      if (passos) eventos.push({ tipo: "inimigoMoveu", id: e.id, investida: true });
      if (!acertou || distanciaChebyshev(p, e) > ALCANCE_CORPO) {
        eventos.push({ tipo: "investidaErrou", id: e.id, mensagem: `${nome} avançou e errou!` });
        e.proximoAtaque = agora + 600;
        return null;
      }
      return this.golpeDaCriatura(id, p, estado, e, at, agora, eventos, { multiplicador: cfg.multiplicador, investida: true });
    }

    const alerta = e.alertaAte > agora;
    // Chamada como reforço: vem de onde estiver.
    const percepcao = e.chamadoAte > agora ? Infinity : e.raioPercepcao + (alerta ? COMPORTAMENTOS.matilha.alcanceExtra : 0);
    if (tem("matilha") && distancia <= e.raioPercepcao && !alerta) this.alertarMatilha(p, e, agora);

    if (tem("distancia")) {
      const cfg = COMPORTAMENTOS.distancia;
      const alcance = e.alcance || cfg.alcance;
      if (distancia <= percepcao && this.linhaReta(e, p, alcance + 0.5)) {
        // Colada em você, entre um disparo e outro, recua um passo.
        if (distancia < cfg.distanciaMinima && agora < e.proximoAtaque && agora >= e.proximoMovimento) {
          e.proximoMovimento = agora + at.intervaloMovimento;
          if (this.passoParaLonge(e, p)) eventos.push({ tipo: "inimigoMoveu", id: e.id });
          return null;
        }
        if (agora < e.proximoAtaque) return null;
        return this.golpeDaCriatura(id, p, estado, e, at, agora, eventos, { distancia: distancia > ALCANCE_CORPO });
      }
    } else if (distancia <= ALCANCE_CORPO) {
      if (agora < e.proximoAtaque) return null;
      return this.golpeDaCriatura(id, p, estado, e, at, agora, eventos, {});
    }

    if (tem("investida") && distancia <= percepcao) {
      const cfg = COMPORTAMENTOS.investida;
      const pronta = agora >= (e.proximaInvestida || 0);
      if (pronta && distancia >= cfg.alcanceMin && distancia <= cfg.alcanceMax && this.linhaReta(e, p, cfg.alcanceMax + 0.5)) {
        e.preparoAte = agora + cfg.preparo;
        e.investidaCasas = casasDaLinha(e, p);
        eventos.push({
          tipo: "investidaPreparo",
          id: e.id,
          ate: e.preparoAte,
          casas: e.investidaCasas.map((c) => ({ ...c })),
          mensagem: `${nome} prepara uma investida! Saia da área marcada.`,
        });
        return null;
      }
    }

    if (agora < e.proximoMovimento) return null;
    e.proximoMovimento = agora + at.intervaloMovimento;
    let alvoX = e.inicioX;
    let alvoY = e.inicioY;
    e.slotMatilha = null;
    if (distancia <= percepcao) {
      alvoX = p.x;
      alvoY = p.y;
      // Matilha cerca: cada uma mira uma casa diferente em volta do jogador.
      const slot = tem("matilha") ? this.slotDeCerco(p, e) : null;
      if (slot) {
        e.slotMatilha = slot;
        if (this.passoContornando(e, slot, p)) {
          e.proximoAtaque = Math.max(e.proximoAtaque, agora + 600);
          eventos.push({ tipo: "inimigoMoveu", id: e.id });
        }
        return null;
      }
    } else if (e.x === e.inicioX && e.y === e.inicioY) return null;
    if (this.passoInimigo(e, alvoX, alvoY, p)) {
      e.proximoAtaque = Math.max(e.proximoAtaque, agora + 600);
      eventos.push({ tipo: "inimigoMoveu", id: e.id });
    }
    return null;
  },

  // Golpe (ou disparo) da criatura no jogador, com fúria, roubo de vida e status.
  golpeDaCriatura(id, p, estado, e, at, agora, eventos, { multiplicador = 1, distancia = false, investida = false }) {
    const furia = e.furioso ? COMPORTAMENTOS.furia : null;
    e.proximoAtaque = agora + Math.round(at.intervaloAtaque * (furia ? furia.intervalo : 1));
    estado.ultimoCombate = agora;
    // Combinações: golpe no atordoado é crítico; com medo, leva mais dano.
    const combo = combinacoesNoGolpe(p, agora);
    const fatorCombo = combo.multiplicador * (combo.critico ? MULTIPLICADOR_CRITICO : 1);
    const bruto = Math.round(at.dano * (furia ? furia.dano : 1) * multiplicador * fatorCombo);
    const dano = mitigarDano(bruto, defesaTotal(p));
    p.vida = Math.max(0, p.vida - dano);
    const subiu = ganharHabilidade(p, "defesa", XP_HABILIDADE_POR_USO.defesa);
    const nome = nomeInimigo(p, e);
    if (p.vida === 0) {
      eventos.push(this.aplicarMorte(id, "inimigo", agora));
      return "morte";
    }
    if (at.rouboVida) p.vidaInimigos[e.id] = Math.min(at.vidaMaxima, p.vidaInimigos[e.id] + Math.max(1, Math.round(dano * at.rouboVida)));
    const verbo = investida ? "avançou e atingiu" : distancia ? (e.projetil === "magia" ? "lançou um feitiço em" : "acertou de longe") : "atingiu";
    eventos.push({
      tipo: "jogadorAtingido",
      inimigoId: e.id,
      dano,
      distancia,
      investida,
      projetil: distancia ? e.projetil || "flecha" : null,
      roubo: at.rouboVida ? true : undefined,
      critico: combo.critico || undefined,
      combinacoes: combo.nomes.length ? combo.nomes : undefined,
      defesaBloqueada: Math.max(0, bruto - dano),
      mensagem:
        `${combo.critico ? "CRÍTICO! " : ""}${nome} ${verbo} você por ${dano} de dano${combo.nomes.length ? ` (${combo.nomes.join(", ")})` : ""}! ` +
        `Vida: ${p.vida}/${vidaMaxima(p)}.${subiu ? ` Defesa: nível ${p.habilidades.defesa}.` : ""}`,
    });
    const ef = e.efeito;
    if (ef && (ef.chance >= 1 || Math.random() < ef.chance)) {
      const r = aplicarStatus(p, ef, agora);
      const ev = r && this.eventoStatusNoJogador(nome, ef, r);
      if (ev) eventos.push(ev);
    }
    this.salvar(p);
    return null;
  },

  // Aplica um status numa criatura (ef = { tipo, ...ajustes }): pela habilidade de uma vocação ou por um teste.
  // Devolve { ok, novo, pilhas, ate } ou { ok: false, mensagem } (imune ou sem acúmulo).
  aplicarStatusNaCriatura(id, inimigoId, ef, agora = Date.now()) {
    const p = this.jogadores[id];
    const e = registroDe(inimigos, inimigoId);
    const base = registroDe(STATUS_CRIATURAS, ef?.tipo);
    if (!p || !e || !base || !this.inimigoVivo(p, e.id)) return { ok: false, mensagem: "Alvo inválido." };
    const r = aplicarStatus(e, ef, agora);
    const nome = nomeInimigo(p, e);
    if (!r) return { ok: false, mensagem: `${nome} resiste: ${base.nome.toLowerCase()} não pega agora.` };
    return { ok: true, ...r, inimigoId: e.id, status: ef.tipo, mensagem: `${nome}: ${base.nome.toLowerCase()}${r.pilhas > 1 ? ` (${r.pilhas}×)` : ""}.` };
  },

  // Um passo dos status de uma criatura viva da área: tiques de dano (que podem derrotá-la, com XP e saque
  // como num golpe) e fim de cada status. Devolve "derrotada" quando o tique a derrota.
  passoStatusCriatura(p, e, agora, eventos) {
    if (!objetoValido(e.status) || !Object.keys(e.status).length) return null;
    const passo = passoDosStatus(e, agora);
    for (const t of passo.tiques) {
      p.vidaInimigos[e.id] = Math.max(0, p.vidaInimigos[e.id] - t.dano);
      const nomeStatus = STATUS_CRIATURAS[t.tipo].nome.toLowerCase();
      if (p.vidaInimigos[e.id] === 0) {
        const morte = this.derrotarInimigo(p, e);
        eventos.push({ tipo: "inimigoDerrotado", inimigoId: e.id, status: t.tipo, dano: t.dano, ...morte, derrotado: true, mensagem: `O ${nomeStatus} venceu: ${morte.mensagem}` });
        return "derrotada";
      }
      eventos.push({ tipo: "statusInimigo", inimigoId: e.id, status: t.tipo, dano: t.dano, pilhas: t.pilhas, infeccao: t.infeccao });
    }
    for (const tipo of passo.terminados) eventos.push({ tipo: "statusInimigoTerminou", inimigoId: e.id, status: tipo });
    if (passo.tiques.length) this.salvar(p);
    return null;
  },

  // Chama as criaturas da mesma espécie por perto (comportamento matilha).
  // Com chamar (retorno da fuga), as chamadas vêm atrás do jogador de onde estiverem. Devolve quantas
  // outras foram chamadas (vivas).
  alertarMatilha(p, e, agora, { raio = COMPORTAMENTOS.matilha.raioAlerta, chamar = false } = {}) {
    const cfg = COMPORTAMENTOS.matilha;
    let n = 0;
    for (const outro of Object.values(inimigos)) {
      if (outro.area !== e.area || outro.especie !== e.especie) continue;
      if (Math.max(Math.abs(outro.x - e.x), Math.abs(outro.y - e.y)) > raio) continue;
      outro.alertaAte = agora + cfg.duracao;
      if (chamar) outro.chamadoAte = agora + cfg.duracao * 2;
      if (outro !== e && this.inimigoVivo(p, outro.id)) n++;
    }
    return n;
  },

  // Casa em volta do jogador para a criatura de matilha: livre e ainda não escolhida por outra do bando;
  // entre essas, a que equilibra perto dela e longe (em ângulo) das casas já tomadas, para fechar o cerco
  // pelos lados vazios. Já ao lado do jogador, fica onde está.
  slotDeCerco(p, e) {
    if (distanciaChebyshev(p, e) <= ALCANCE_CORPO) return null;
    const tomadas = new Set();
    for (const outro of Object.values(inimigos)) {
      if (outro === e || outro.area !== e.area || outro.especie !== e.especie || !this.inimigoVivo(p, outro.id)) continue;
      if (distanciaChebyshev(p, outro) <= ALCANCE_CORPO) tomadas.add(`${outro.x},${outro.y}`);
      else if (outro.slotMatilha) tomadas.add(`${outro.slotMatilha.x},${outro.slotMatilha.y}`);
    }
    const angulos = [...tomadas].map((k) => {
      const [x, y] = k.split(",").map(Number);
      return Math.atan2(y - p.y, x - p.x);
    });
    let melhor = null;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = p.x + dx;
        const y = p.y + dy;
        if (tomadas.has(`${x},${y}`) || !this.casaLivre(x, y, p)) continue;
        const a = Math.atan2(dy, dx);
        const separacao = angulos.length ? Math.min(...angulos.map((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))))) / (Math.PI / 4) : 0;
        const d = Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) + Math.hypot(e.x - x, e.y - y) / 100 - 1.5 * separacao;
        if (!melhor || d < melhor.d) melhor = { x, y, d };
      }
    return melhor ? { x: melhor.x, y: melhor.y } : null;
  },

  // Curandeiro: cura a criatura viva mais ferida (menor fração de vida) a até alcance casas, se estiver
  // abaixo de vidaLimite. Devolve o evento, ou null se ninguém precisar.
  curarAliada(p, e, agora) {
    const cfg = COMPORTAMENTOS.curandeiro;
    let alvo = null;
    for (const outro of Object.values(inimigos)) {
      if (outro.area !== e.area || !this.inimigoVivo(p, outro.id)) continue;
      if (Math.max(Math.abs(outro.x - e.x), Math.abs(outro.y - e.y)) > cfg.alcance) continue;
      const max = atributosInimigo(p, outro).vidaMaxima;
      const fracao = p.vidaInimigos[outro.id] / max;
      if (fracao >= cfg.vidaLimite) continue;
      if (!alvo || fracao < alvo.fracao) alvo = { e: outro, max, fracao };
    }
    if (!alvo) return null;
    e.proximaCura = agora + cfg.intervalo;
    const antes = p.vidaInimigos[alvo.e.id];
    p.vidaInimigos[alvo.e.id] = Math.min(alvo.max, antes + Math.max(1, Math.round(alvo.max * cfg.curaPercentual)));
    const cura = p.vidaInimigos[alvo.e.id] - antes;
    const quem = alvo.e === e ? "a si mesmo" : nomeInimigo(p, alvo.e).toLowerCase();
    return { tipo: "cura", id: e.id, alvo: alvo.e.id, cura, mensagem: `${nomeInimigo(p, e)} curou ${quem} (+${cura}).` };
  },

  // Contorna quem está no caminho: um passo para a casa vizinha livre que mais se aproxima do alvo (ou
  // anda de lado, sem se afastar mais que meia casa e sem voltar à casa de onde veio). Usado pela
  // matilha para dar a volta no jogador.
  passoContornando(e, alvo, p) {
    const atual = Math.hypot(alvo.x - e.x, alvo.y - e.y);
    let melhor = null;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = e.x + dx;
        const ny = e.y + dy;
        const d = Math.hypot(alvo.x - nx, alvo.y - ny);
        if (d > atual + 0.5 || (e.casaAnterior && e.casaAnterior.x === nx && e.casaAnterior.y === ny)) continue;
        if (!this.casaLivre(nx, ny, p)) continue;
        if (!melhor || d < melhor.d) melhor = { nx, ny, d };
      }
    if (!melhor) return false;
    e.casaAnterior = { x: e.x, y: e.y };
    e.x = melhor.nx;
    e.y = melhor.ny;
    return true;
  },

  // Um passo que aumenta a distância até o jogador (fuga e recuo de quem ataca de longe).
  passoParaLonge(e, p) {
    const atual = distanciaChebyshev(p, e);
    const opcoes = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = e.x + dx;
        const ny = e.y + dy;
        const d = Math.max(Math.abs(p.x - nx), Math.abs(p.y - ny));
        if (d > atual && this.casaLivre(nx, ny, p)) opcoes.push({ nx, ny, d: d + Math.hypot(p.x - nx, p.y - ny) / 100 });
      }
    if (!opcoes.length) return false;
    opcoes.sort((a, b) => b.d - a.d);
    e.x = opcoes[0].nx;
    e.y = opcoes[0].ny;
    return true;
  },

  // Caminho reto livre entre a e b (pontas não contam), dentro de um círculo de raio "alcance".
  linhaReta(a, b, alcance) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if ((dx === 0 && dy === 0) || Math.hypot(dx, dy) > alcance) return false;
    const passos = Math.max(Math.abs(dx), Math.abs(dy));
    const mapa = mapas[a.area || b.area];
    for (let i = 1; i < passos; i++) {
      const x = a.x + Math.round((dx * i) / passos);
      const y = a.y + Math.round((dy * i) / passos);
      if (mapa[y][x] !== 0) return false;
    }
    return true;
  },

  // Raros nomeados: abre a janela (renasce com vida cheia num ponto do grupo e avisa) e fecha a janela.
  atualizarNomeados(p, agora, eventos) {
    for (const e of NOMEADOS) {
      const j = janelaNomeado(e, agora);
      const estado = p.nomeados[e.id];
      if (j.ativa && estado?.janela !== j.indice) {
        p.nomeados[e.id] = { janela: j.indice };
        p.inimigosDerrotados = p.inimigosDerrotados.filter((x) => x !== e.id);
        p.vidaInimigos[e.id] = atributosInimigo(p, e).vidaMaxima;
        e.x = e.inicioX;
        e.y = e.inicioY;
        sortearPosicaoInimigo(e);
        zerarComportamento(e);
        const minutos = Math.max(1, Math.round((j.fim - agora) / 60_000));
        eventos.push({
          tipo: "nomeadoApareceu",
          id: e.id,
          area: e.area,
          mensagem: `Rumores na estrada: ${e.nome}${e.titulo ? `, ${e.titulo},` : ""} foi visto em ${areas[e.area].nome}! Some em ${minutos} min.`,
        });
        this.salvar(p);
      } else if (!j.ativa && estado && estado.janela === j.indice && !estado.sumiu) {
        estado.sumiu = true;
        const vivo = !p.inimigosDerrotados.includes(e.id);
        eventos.push({ tipo: "nomeadoSumiu", id: e.id, area: e.area, mensagem: vivo ? `${e.nome} sumiu de ${areas[e.area].nome}.` : null });
        this.salvar(p);
      }
    }
  },

  // Evento do status que acabou de pegar no jogador (null quando só renovou sem mudar nada que valha avisar).
  eventoStatusNoJogador(nome, ef, r) {
    const s = (ms) => `${String(ms / 1000).replace(".", ",")} s`;
    if (ef.tipo === "veneno") {
      if (!r.novo) return null;
      return {
        tipo: "veneno",
        mensagem: `${nome} envenenou você (${ef.dano} de dano a cada ${s(ef.intervalo)} por ${s(ef.duracao)}). A Oração remove veneno a partir do nível ${NIVEL_ORACAO.veneno}.`,
      };
    }
    if (ef.tipo === "sangramento") {
      const pilhas = r.pilhas > 1 ? ` As feridas somam: ${r.pilhas}× (${ef.dano * r.pilhas} a cada ${s(ef.intervalo)}).` : "";
      return { tipo: "sangramento", pilhas: r.pilhas, mensagem: `${nome} feriu você: sangramento de ${ef.dano} a cada ${s(ef.intervalo)} por ${s(ef.duracao)}.${pilhas}` };
    }
    if (ef.tipo === "atordoamento") return { tipo: "atordoado", ate: r.ate, mensagem: `${nome} atordoou você por ${s(ef.duracao)}! O próximo golpe nele é crítico.` };
    if (ef.tipo === "medo") return { tipo: "medo", ate: r.ate, mensagem: `${nome} assustou você: ${s(ef.duracao)} sem atacar, levando +25% de dano. Recue ou beba a poção.` };
    return null;
  },

  // ----- Morte (regra única) -----  // ----- Morte (regra única) -----
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
    if (estado) {
      const a = this.iniciarAnalisador(id, agora);
      a.mortes += 1;
      a.perdas += moedasPerdidas;
    }
    p.status = {};
    p.imune = {};
    p.area = "canaan";
    p.x = areas.canaan.inicio.x;
    p.y = areas.canaan.inicio.y;
    p.vida = vidaMaxima(p);
    for (const outro of Object.values(inimigos)) {
      outro.x = outro.inicioX;
      outro.y = outro.inicioY;
      outro.proximoAtaque = 0;
      outro.proximoMovimento = 0;
      zerarComportamento(outro);
      if (this.inimigoVivo(p, outro.id)) p.vidaInimigos[outro.id] = atributosInimigo(p, outro).vidaMaxima;
    }
    if (estado) {
      estado.explosoes = [];
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
      if (this.agirCriatura(id, p, estado, e, agora, eventos) === "morte") return eventos;
    }

    // Explosões de campeões explosivos (marcadas na morte deles).
    if (estado.explosoes?.length) {
      const prontas = estado.explosoes.filter((x) => agora >= x.em);
      estado.explosoes = estado.explosoes.filter((x) => agora < x.em);
      for (const x of prontas) {
        const atingiu = x.area === p.area && distanciaChebyshev(p, x) <= 1;
        const dano = atingiu ? mitigarDano(x.dano, defesaTotal(p)) : 0;
        if (atingiu) {
          p.vida = Math.max(0, p.vida - dano);
          estado.ultimoCombate = agora;
        }
        eventos.push({
          tipo: "explosao",
          x: x.x,
          y: x.y,
          area: x.area,
          dano,
          mensagem: atingiu ? `${x.nome} explodiu e atingiu você por ${dano} de dano!` : `${x.nome} explodiu.`,
        });
        if (p.vida === 0) {
          eventos.push(this.aplicarMorte(id, "inimigo", agora));
          return eventos;
        }
        if (atingiu) this.salvar(p);
      }
    }

    // Status do jogador (veneno, sangramento, atordoamento, medo): tiques de dano e fim de cada um.
    const passo = passoDosStatus(p, agora);
    for (const t of passo.tiques) {
      p.vida = Math.max(0, p.vida - t.dano);
      estado.ultimoCombate = agora;
      if (p.vida === 0) {
        eventos.push(this.aplicarMorte(id, t.tipo, agora));
        return eventos;
      }
      const extra = [t.pilhas > 1 ? `${t.pilhas} feridas` : "", t.infeccao ? "ferida infeccionada" : ""].filter(Boolean).join(", ");
      eventos.push({
        tipo: "jogadorAtingido",
        dano: t.dano,
        defesaBloqueada: 0,
        [t.tipo]: true,
        status: t.tipo,
        mensagem: `O ${STATUS_CRIATURAS[t.tipo].nome.toLowerCase()} causa ${t.dano} de dano${extra ? ` (${extra})` : ""}. Vida: ${p.vida}/${vidaMaxima(p)}.`,
      });
    }
    const FIM_STATUS = {
      veneno: ["venenoTerminou", "O veneno perdeu o efeito."],
      sangramento: ["sangramentoTerminou", "O sangramento parou."],
      atordoamento: ["atordoamentoTerminou", ""],
      medo: ["medoTerminou", "O medo passou: você pode atacar de novo."],
    };
    for (const tipo of passo.terminados) {
      const [evento, mensagem] = FIM_STATUS[tipo];
      eventos.push({ tipo: evento, mensagem });
    }
    if (passo.tiques.length || passo.terminados.length) this.salvar(p);

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

    this.atualizarNomeados(p, agora, eventos);

    const estragou = this.estragarMana(p, agora);
    if (estragou) eventos.push({ tipo: "manaEstragou", quantidade: estragou, mensagem: this.textoManaEstragou(p, estragou, agora) });

    if (agora >= estado.proximaLimpezaSaques) {
      estado.proximaLimpezaSaques = agora + INTERVALO_LIMPEZA_SAQUES;
      const removidos = this.limparSaques(p, agora);
      if (removidos.length) eventos.push({ tipo: "saqueExpirou", ids: removidos });
    }
    return eventos;
  },
};
