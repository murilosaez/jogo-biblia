// =====================================================================
// dados/criaturas.js — inimigos
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// Campos: id, nome, aparencia (sprite), especie, familia, area, x, y, vidaMaxima, danoContraJogador
// (antes da defesa), defesa, raioPercepcao, nivel, xpRecompensa, saque { itens, moedas } e veneno ("padrao" ou
// { duracao, dano, intervalo }).
// saque: { moedas, itens: [{ item, chance, raridade?, raridadeMinima? }] } — tabela de saque. Cada linha é
// sorteada à parte: chance é um número de 0 a 1 ou um nome de CHANCES_SAQUE (dados/itens.js): "sempre" (100%),
// "comum" (25%), "incomum" (8%), "raro" (1%) e "muito_raro" (0,1%). Equipamento sem raridade fixa sorteia a
// raridade por SORTEIO_RARIDADE; raridadeMinima corta as raridades abaixo dela. Itens que uma missão pede
// (pele, veneno, insígnia) ficam em "sempre", para a campanha não depender de sorte.
// nivel: nível da criatura (nível em que o jogador costuma chegar à região). Quem está mais de 5 níveis
// acima rende menos XP (ver xpDoAbate em logica.js).
// grupo: { quantidade, raio }: quantas criaturas iguais existem na área e o raio (em casas) em volta de x, y
// onde elas nascem e renascem, sempre num ponto aleatório livre. As cópias se chamam <id>_2, <id>_3...
// e contam como a original em missões e caçadas.
// especie: grupo das instâncias da mesma criatura (escorpiao1, escorpiao2… = "escorpiao"); familia: chave de
// FAMILIAS_CRIATURAS. As caçadas (dados/tarefas.js) e, no futuro, o bestiário contam por espécie ou família.

// Famílias de criaturas. nome: como o grupo aparece na interface.
const FAMILIAS_CRIATURAS = {
  feras: { nome: "Feras" },
  peconhentos: { nome: "Peçonhentos" },
  saqueadores: { nome: "Saqueadores" },
  soldados_farao: { nome: "Soldados de Faraó" },
  amalequitas: { nome: "Amalequitas" },
};

const DADOS_CRIATURAS = [
  {
    id: "lobo1",
    nome: "Lobo",
    aparencia: "lobo",
    especie: "lobo",
    familia: "feras",
    area: "canaan",
    x: 70,
    y: 52,
    vidaMaxima: 70,
    danoContraJogador: 6,
    defesa: 2,
    raioPercepcao: 6,
    nivel: 3,
    grupo: { quantidade: 6, raio: 22 },
    xpRecompensa: 40,
    saque: {
      moedas: 4,
      itens: [
        { item: "pele_lobo", chance: "sempre" },
        { item: "presa_lobo", chance: "comum" },
        { item: "pocao", chance: 0.06 },
        { item: "tunica_pano", chance: 0.03 },
        { item: "escudo_madeira", chance: "raro", raridadeMinima: "raro" },
        { item: "pedra_sardio", chance: "muito_raro" },
      ],
    },
  },
  {
    id: "escorpiao1",
    nome: "Escorpião",
    aparencia: "escorpiao",
    especie: "escorpiao",
    familia: "peconhentos",
    area: "deserto",
    x: 40,
    y: 32,
    vidaMaxima: 130,
    danoContraJogador: 9,
    defesa: 4,
    raioPercepcao: 5,
    nivel: 5,
    grupo: { quantidade: 6, raio: 20 },
    xpRecompensa: 60,
    saque: {
      moedas: 8,
      itens: [
        { item: "veneno_escorpiao", chance: "sempre" },
        { item: "ferrao_escorpiao", chance: "comum" },
        { item: "pocao_fe", chance: 0.05 },
        { item: "escudo_madeira", chance: 0.03 },
        { item: "arco_madeira", chance: "raro", raridadeMinima: "raro" },
        { item: "pedra_topazio", chance: "muito_raro" },
      ],
    },
    veneno: "padrao",
  },
  {
    id: "bandido1",
    nome: "Chefe dos saqueadores",
    aparencia: "bandido",
    especie: "chefe_saqueadores",
    familia: "saqueadores",
    area: "deserto",
    x: 100,
    y: 80,
    vidaMaxima: 190,
    danoContraJogador: 10,
    defesa: 6,
    raioPercepcao: 6,
    nivel: 6,
    grupo: { quantidade: 1, raio: 6 },
    xpRecompensa: 100,
    saque: {
      moedas: 15,
      itens: [
        { item: "insignia_bandido", chance: "sempre" },
        { item: "pocao", chance: "comum" },
        { item: "espada_ferro", chance: 0.05, raridadeMinima: "incomum" },
        { item: "armadura_couro", chance: "raro", raridadeMinima: "raro" },
        { item: "pedra_esmeralda", chance: "muito_raro" },
      ],
    },
  },
  {
    id: "soldadoEgito1",
    nome: "Guarda egípcio",
    aparencia: "soldado",
    especie: "guarda_egipcio",
    familia: "soldados_farao",
    area: "egito",
    x: 84,
    y: 60,
    vidaMaxima: 250,
    danoContraJogador: 10,
    defesa: 8,
    raioPercepcao: 6,
    nivel: 6,
    grupo: { quantidade: 4, raio: 20 },
    xpRecompensa: 100,
    saque: {
      moedas: 18,
      itens: [
        { item: "linho_egipcio", chance: "comum" },
        { item: "pocao", chance: 0.08 },
        { item: "escudo_bronze", chance: 0.03 },
        { item: "espada_ferro", chance: "raro", raridadeMinima: "raro" },
        { item: "pedra_carbunculo", chance: "muito_raro" },
      ],
    },
  },
  {
    id: "perseguidorMar1",
    nome: "Soldado perseguidor",
    aparencia: "soldado",
    especie: "soldado_perseguidor",
    familia: "soldados_farao",
    area: "marVermelho",
    x: 84,
    y: 60,
    vidaMaxima: 310,
    danoContraJogador: 11,
    defesa: 10,
    raioPercepcao: 7,
    nivel: 7,
    grupo: { quantidade: 4, raio: 20 },
    xpRecompensa: 130,
    saque: {
      moedas: 22,
      itens: [
        { item: "ponta_lanca", chance: "comum" },
        { item: "pocao", chance: 0.08 },
        { item: "armadura_couro", chance: 0.03 },
        { item: "escudo_bronze", chance: "raro", raridadeMinima: "raro" },
        { item: "pedra_safira", chance: "muito_raro" },
      ],
    },
  },
  {
    id: "guardiaoSinai1",
    nome: "Guerreiro amalequita",
    aparencia: "guerreiro",
    especie: "guerreiro_amalequita",
    familia: "amalequitas",
    area: "sinai",
    x: 84,
    y: 60,
    vidaMaxima: 400,
    danoContraJogador: 11,
    defesa: 12,
    raioPercepcao: 7,
    nivel: 8,
    grupo: { quantidade: 4, raio: 20 },
    xpRecompensa: 160,
    saque: {
      moedas: 26,
      itens: [
        { item: "bracelete_cobre", chance: "comum" },
        { item: "pocao", chance: 0.08 },
        { item: "arco_madeira", chance: 0.03 },
        { item: "espada_temperada", chance: "raro", raridadeMinima: "raro" },
        { item: "pedra_ametista", chance: "muito_raro" },
      ],
    },
  },
  // O id com "ç" foi mantido para não invalidar saves existentes.
  {
    id: "ameaçaGalileia1",
    nome: "Salteador da estrada",
    aparencia: "bandido",
    especie: "salteador",
    familia: "saqueadores",
    area: "galileia",
    x: 88,
    y: 66,
    vidaMaxima: 470,
    danoContraJogador: 11,
    defesa: 14,
    raioPercepcao: 7,
    nivel: 9,
    grupo: { quantidade: 4, raio: 20 },
    xpRecompensa: 190,
    saque: {
      moedas: 30,
      itens: [
        { item: "pocao", chance: "comum" },
        { item: "pocao_fe", chance: 0.08 },
        { item: "espada_temperada", chance: 0.03 },
        { item: "arco_composto", chance: "raro", raridadeMinima: "raro" },
        { item: "pedra_onix", chance: "muito_raro" },
      ],
    },
  },
];
