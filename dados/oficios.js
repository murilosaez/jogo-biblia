// =====================================================================
// dados/oficios.js — ofícios, receitas e regras de progressão (JGB-24)
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// Regras.
//   nivelMaximo: nível máximo de cada ofício;
//   xp: XP para subir do nível n ao n + 1 = round(base × n ^ expoente) (do 1 ao 2: 10; do 10 ao 11: 251);
//   coletaExtra: chance de colher 1 unidade a mais (pesca e material que cai das criaturas) = porNivel × (nível − 1),
//     até maximo;
//   peixeGrande: a partir de nivel, cada pesca tem chance (+ porNivel por nível acima) de trazer um peixe
//     grande em vez do peixe comum, até maximo;
//   qualidade: ao fabricar um equipamento (arma, arco, escudo ou armadura), chance de sair incomum ou melhor =
//     porNivelAcima × (nível do ofício − nível da receita), até maximo; a raridade sai do sorteio normal a
//     partir de "incomum";
const REGRAS_OFICIOS = {
  nivelMaximo: 30,
  xp: { base: 10, expoente: 1.4 },
  coletaExtra: { porNivel: 0.02, maximo: 0.4 },
  peixeGrande: { nivel: 5, chance: 0.04, porNivel: 0.01, maximo: 0.25 },
  qualidade: { porNivelAcima: 0.03, maximo: 0.3 },
};

// Ofícios, na ordem da janela. coleta: item colhido → XP que rende a este ofício (pesca e o material que cai
// das criaturas direto na mochila); onde: de onde vêm os materiais (texto da janela); icone: glifo "of_<icone>".
const OFICIOS = {
  pescador: {
    nome: "Pescador",
    descricao: "Pesca no mar e prepara o peixe para durar a viagem (Lc 5:4-6).",
    onde: "Peixe: pontos de pesca no mar, a partir do barco (tecla P).",
    icone: "pescador",
    coleta: { peixe: 8, peixe_grande: 12 },
  },
  ferreiro: {
    nome: "Ferreiro",
    descricao: "Funde o cobre e forja escudos e espadas (Gn 4:22).",
    onde: "Minério de cobre: guardiões e fundibulários do Sinai. Pontas de lança e couro: das criaturas.",
    icone: "ferreiro",
    coleta: { minerio_cobre: 5 },
  },
  carpinteiro: {
    nome: "Carpinteiro",
    descricao: "Trabalha a madeira: flechas, escudos e arcos (Mc 6:3).",
    onde: "Madeira: javalis e ursos de Canaã, vespas e corvos da Galileia. Penas, peles e carapaças: das criaturas.",
    icone: "carpinteiro",
    coleta: { madeira: 4 },
  },
  oleiro: {
    nome: "Oleiro",
    descricao: "Molda o barro na roda: frascos, jarros, lamparinas e ânforas (Jr 18:3-4).",
    onde: "Argila: rãs e crocodilos do Nilo, no Egito.",
    icone: "oleiro",
    coleta: { argila: 4 },
  },
  tecelao: {
    nome: "Tecelão",
    descricao: "Tece o linho e costura túnicas, armaduras e mantos (Êx 35:35).",
    onde: "Linho egípcio, couro, penas e braceletes: das criaturas. O tecelão não colhe: só fabrica.",
    icone: "tecelao",
    coleta: {},
  },
  perfumista: {
    nome: "Perfumista",
    descricao: "Mistura ervas e resinas: poções, incenso e o óleo da unção (Êx 30:25).",
    onde: "Ervas: chacais e lobos de Canaã. Resina: cabras e águias do Sinai. Odres: abutres, hienas e o bando do Deserto.",
    icone: "perfumista",
    coleta: { erva: 2, resina: 4 },
  },
};

// Receitas, na ordem da janela. Campos: oficio, nivel (do ofício), materiais { item: quantidade } (da mochila,
// não do equipamento), produto { item, quantidade }, xp (por fabricação).
// Os ids ficam só na interface e nos comandos (não vão para o save).
const RECEITAS = {
  // Pescador
  peixe_seco: { oficio: "pescador", nivel: 1, materiais: { peixe: 3 }, produto: { item: "peixe_seco", quantidade: 1 }, xp: 12 },
  oleo_peixe: { oficio: "pescador", nivel: 4, materiais: { peixe: 2 }, produto: { item: "oleo_peixe", quantidade: 1 }, xp: 15 },
  peixe_defumado: {
    oficio: "pescador", nivel: 8, materiais: { peixe_grande: 1, madeira: 1 }, produto: { item: "peixe_defumado", quantidade: 1 }, xp: 30,
  },

  // Ferreiro
  lingote_bronze: { oficio: "ferreiro", nivel: 1, materiais: { minerio_cobre: 3 }, produto: { item: "lingote_bronze", quantidade: 1 }, xp: 12 },
  escudo_bronze: {
    oficio: "ferreiro", nivel: 5, materiais: { lingote_bronze: 3, madeira: 2 }, produto: { item: "escudo_bronze", quantidade: 1 }, xp: 40,
  },
  espada_temperada: {
    oficio: "ferreiro", nivel: 10, materiais: { lingote_bronze: 4, ponta_lanca: 2, couro_grosso: 1 },
    produto: { item: "espada_temperada", quantidade: 1 }, xp: 70,
  },

  // Carpinteiro
  flechas: { oficio: "carpinteiro", nivel: 1, materiais: { madeira: 1, pena_ave: 1 }, produto: { item: "flecha", quantidade: 5 }, xp: 8 },
  escudo_madeira: {
    oficio: "carpinteiro", nivel: 3, materiais: { madeira: 4, pele_lobo: 1 }, produto: { item: "escudo_madeira", quantidade: 1 }, xp: 25,
  },
  arco_madeira: {
    oficio: "carpinteiro", nivel: 6, materiais: { madeira: 4, linho_egipcio: 1 }, produto: { item: "arco_madeira", quantidade: 1 }, xp: 40,
  },
  arco_composto: {
    oficio: "carpinteiro", nivel: 12, materiais: { madeira: 3, carapaca: 2, tecido_linho: 1 },
    produto: { item: "arco_composto", quantidade: 1 }, xp: 80,
  },

  // Oleiro
  frasco_barro: { oficio: "oleiro", nivel: 1, materiais: { argila: 1 }, produto: { item: "frasco_barro", quantidade: 1 }, xp: 6 },
  jarro_barro: { oficio: "oleiro", nivel: 3, materiais: { argila: 3 }, produto: { item: "jarro_barro", quantidade: 1 }, xp: 15 },
  lamparina: { oficio: "oleiro", nivel: 6, materiais: { argila: 2, oleo_peixe: 1 }, produto: { item: "lamparina", quantidade: 1 }, xp: 30 },
  anfora: { oficio: "oleiro", nivel: 10, materiais: { argila: 5, resina: 1 }, produto: { item: "anfora", quantidade: 1 }, xp: 50 },

  // Tecelão
  tecido_linho: { oficio: "tecelao", nivel: 1, materiais: { linho_egipcio: 2 }, produto: { item: "tecido_linho", quantidade: 1 }, xp: 12 },
  tunica_pano: { oficio: "tecelao", nivel: 3, materiais: { tecido_linho: 2 }, produto: { item: "tunica_pano", quantidade: 1 }, xp: 20 },
  armadura_couro: {
    oficio: "tecelao", nivel: 7, materiais: { couro_grosso: 3, tecido_linho: 1 }, produto: { item: "armadura_couro", quantidade: 1 }, xp: 45,
  },
  manto_bordado: {
    oficio: "tecelao", nivel: 12, materiais: { tecido_linho: 3, pena_ave: 2, bracelete_cobre: 1 },
    produto: { item: "manto_bordado", quantidade: 1 }, xp: 80,
  },

  // Perfumista
  pocao: { oficio: "perfumista", nivel: 1, materiais: { erva: 2, odre_agua: 1 }, produto: { item: "pocao", quantidade: 1 }, xp: 10 },
  incenso: { oficio: "perfumista", nivel: 4, materiais: { resina: 2, erva: 1 }, produto: { item: "incenso", quantidade: 1 }, xp: 20 },
  pocao_fe: {
    oficio: "perfumista", nivel: 7, materiais: { erva: 2, resina: 1, frasco_barro: 1 }, produto: { item: "pocao_fe", quantidade: 1 }, xp: 35,
  },
  oleo_uncao: {
    oficio: "perfumista", nivel: 12, materiais: { resina: 3, erva: 3, frasco_barro: 1 }, produto: { item: "oleo_uncao", quantidade: 1 }, xp: 80,
  },
};

// Forja (JGB-25): o ferreiro (papel "ferreiro", dados/npcs.js) aprimora um equipamento de +0 a +10. Cada tentativa
// de passar de +n a +(n+1) usa a linha n de niveis: chance de dar certo, moedas e lingotes de bronze (Ferreiro:
// 3 minérios de cobre por lingote). Na falha, o material e as moedas se perdem, mas o item fica como estava:
// a forja nunca destrói nem rebaixa. ganho: quanto cada nível soma ao atributo principal (dano da arma e do arco,
// defesa do escudo e da armadura); as outras peças do corpo (cabeça, colar, pernas, pés e anel) ganham
// ganhoOutros por nível, arredondado para baixo (+1 de defesa a cada 2 níveis). xpOficio: XP de Ferreiro por
// tentativa no ofício oficio. O nível fica no texto do item ("espada_ferro@comum+3"; ver logica.js).
const REGRAS_FORJA = {
  maximo: 10,
  oficio: "ferreiro",
  material: "lingote_bronze",
  niveis: [
    { chance: 1, moedas: 10, material: 0 }, // +0 → +1
    { chance: 0.9, moedas: 16, material: 0 },
    { chance: 0.8, moedas: 26, material: 0 },
    { chance: 0.65, moedas: 41, material: 1 },
    { chance: 0.5, moedas: 66, material: 1 },
    { chance: 0.4, moedas: 105, material: 2 },
    { chance: 0.3, moedas: 168, material: 2 },
    { chance: 0.2, moedas: 268, material: 3 },
    { chance: 0.12, moedas: 429, material: 3 },
    { chance: 0.08, moedas: 687, material: 4 }, // +9 → +10
  ],
  ganho: { arma: 1, arma_distancia: 1, escudo: 1, armadura: 1 },
  ganhoOutros: 0.5,
  xpOficio: 3,
};

// Engaste (JGB-25): o ferreiro prende uma pedra do peitoral (ITENS com engaste, dados/itens.js) num equipamento,
// uma por peça. moedas: preço de cada engaste; trocar a pedra de uma peça perde a que estava nela. O bônus vale
// com a peça vestida. tetos: soma máxima de cada efeito em fração (as pedras se somam entre as peças); o crítico
// respeita o teto do equipamento (25 pontos) e a velocidade, o teto de REGRAS_VELOCIDADE. textos: a linha de cada
// efeito na interface ({v}: o valor; {p}: o valor em %; {familia}: o nome da família).
const REGRAS_ENGASTE = {
  moedas: 25,
  tetos: { reducao: 0.12, cura: 0.3, xp: 0.2, moedas: 0.3, familia: 0.3, velocidade: 0.75 },
  textos: {
    dano: "+{v} de dano",
    critico: "+{v}% de chance de crítico",
    vida: "+{v} de vida máxima",
    defesa: "+{v} de defesa",
    carga: "+{v} kg de carga",
    reducao: "−{p}% de dano recebido",
    cura: "+{p}% de cura (poções e Oração)",
    xp: "+{p}% de XP dos abates",
    moedas: "+{p}% de moedas no saque",
    familia: "+{p}% de dano contra {familia}",
    velocidade: "+{v} casas/s de velocidade",
  },
};
