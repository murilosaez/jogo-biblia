// =====================================================================
// dados/mundo.js — áreas, pontos de coleta, pesca e portais
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// Áreas de Canaã, Deserto e Mar (o desenho de cada mapa fica em dados/mapas.js).
// inicio: onde se nasce (e renasce, em Canaã); passagem/chegada: trilha terrestre Canaã ↔ Deserto;
// cais: onde se embarca (pisar nele paga a passagem do barco); quem desembarca chega logo abaixo do cais;
// chegadaViagem: onde a viagem rápida do guia deixa o jogador.
// No mar, portos[regiao]: cais (a casa do mar onde se desembarca naquela região) e embarque (onde o barco
// aparece quando se embarca nela). Todas as cidades se ligam pelo mar.
const DADOS_AREAS_BASE = {
  canaan: {
    id: "canaan",
    nome: "Canaã",
    inicio: { x: 25, y: 22 },
    passagem: { x: 157, y: 112 },
    chegada: { x: 155, y: 112 },
    cais: { x: 80, y: 2 },
    chegadaViagem: { x: 15, y: 19 },
  },
  deserto: {
    id: "deserto",
    nome: "Deserto",
    inicio: { x: 5, y: 112 },
    passagem: { x: 2, y: 112 },
    chegada: { x: 5, y: 112 },
    cais: { x: 80, y: 2 },
    chegadaViagem: { x: 130, y: 23 },
  },
  mar: {
    id: "mar",
    nome: "Mar das Rotas",
    inicio: { x: 4, y: 60 },
    portos: {
      canaan: { cais: { x: 2, y: 60 }, embarque: { x: 4, y: 60 } },
      deserto: { cais: { x: 157, y: 60 }, embarque: { x: 155, y: 60 } },
      egito: { cais: { x: 40, y: 117 }, embarque: { x: 40, y: 115 } },
      marVermelho: { cais: { x: 120, y: 117 }, embarque: { x: 120, y: 115 } },
      sinai: { cais: { x: 120, y: 2 }, embarque: { x: 120, y: 4 } },
      galileia: { cais: { x: 40, y: 2 }, embarque: { x: 40, y: 4 } },
    },
  },
};

// Regiões dos capítulos. inicio: onde o jogador chega pela primeira vez.
// cais e chegadaViagem: como nas áreas acima (cada cidade tem o seu cais e o seu guia de caravanas).
const DADOS_AREAS_CAPITULOS = {
  egito: { id: "egito", nome: "Egito", bioma: "nilo", inicio: { x: 5, y: 112 }, cais: { x: 24, y: 6 }, chegadaViagem: { x: 31, y: 95 } },
  marVermelho: { id: "marVermelho", nome: "Mar Vermelho", bioma: "costa", inicio: { x: 5, y: 112 }, cais: { x: 22, y: 2 }, chegadaViagem: { x: 34, y: 95 } },
  sinai: { id: "sinai", nome: "Monte Sinai", bioma: "montanha", inicio: { x: 5, y: 112 }, cais: { x: 22, y: 2 }, chegadaViagem: { x: 34, y: 95 } },
  galileia: { id: "galileia", nome: "Galileia", bioma: "galileia", inicio: { x: 5, y: 112 }, cais: { x: 44, y: 17 }, chegadaViagem: { x: 9, y: 28 } },
};

// Viagem rápida (guias de caravanas, um em cada cidade): de qualquer cidade para qualquer outra já aberta
// (Canaã e o Deserto desde o início; cada capítulo, quando o anterior é concluído, como os portais).
// Preço em moedas = base + porEtapa × etapas, e etapas = a distância entre as duas na ordem do caminho.
const REGRAS_VIAGEM = {
  ordem: ["canaan", "deserto", "egito", "marVermelho", "sinai", "galileia"],
  base: 4,
  porEtapa: 6,
};

// Barco: pisar no cais de qualquer cidade paga a passagem e embarca no Mar das Rotas; no mar, navegue até o
// cais de qualquer cidade aberta para desembarcar (a pesca no mar continua de graça).
const REGRAS_BARCO = { passagem: 8 };

// Pontos de pesca no Mar das Rotas.
const pontosPesca = [
  { id: "pesca1", x: 36, y: 30 },
  { id: "pesca2", x: 80, y: 84 },
  { id: "pesca3", x: 124, y: 36 },
  { id: "pesca4", x: 98, y: 64 },
  { id: "pesca5", x: 30, y: 74 },
  { id: "pesca6", x: 60, y: 46 },
  { id: "pesca7", x: 136, y: 100 },
  { id: "pesca8", x: 146, y: 24 },
];

// Ervas só existem em Canaã e odres só no Deserto.
// Posições iniciais; depois de coletado, cada ponto brota de novo num lugar aleatório das zonas de
// coleta da área (zonasColeta em dados/mapas.js).
const ervas = [
  { id: "erva1", x: 54, y: 12 },
  { id: "erva2", x: 60, y: 19 },
  { id: "erva3", x: 40, y: 82 },
  { id: "erva4", x: 48, y: 88 },
  { id: "erva5", x: 108, y: 55 },
  { id: "erva6", x: 122, y: 94 },
];
const odres = [
  { id: "odre1", x: 52, y: 72 },
  { id: "odre2", x: 60, y: 80 },
  { id: "odre3", x: 108, y: 46 },
  { id: "odre4", x: 28, y: 94 },
  { id: "odre5", x: 102, y: 18 },
  { id: "odre6", x: 114, y: 52 },
];

// Pontos de extração dos ofícios (JGB-24): pise no ponto para colher o item (madeira, argila, minério ou
// resina). Cada ponto fica sempre no mesmo lugar e brota de novo depois de REGRAS_OFICIOS.respawnExtracao.
// O XP vai para o ofício que tem o item em OFICIOS[...].coleta (dados/oficios.js).
const pontosExtracao = [
  { id: "madeira_canaa1", area: "canaan", item: "madeira", x: 128, y: 37 },
  { id: "madeira_canaa2", area: "canaan", item: "madeira", x: 105, y: 15 },
  { id: "madeira_canaa3", area: "canaan", item: "madeira", x: 140, y: 33 },
  { id: "madeira_canaa4", area: "canaan", item: "madeira", x: 106, y: 24 },
  { id: "madeira_galileia1", area: "galileia", item: "madeira", x: 118, y: 98 },
  { id: "madeira_galileia2", area: "galileia", item: "madeira", x: 142, y: 90 },
  { id: "madeira_galileia3", area: "galileia", item: "madeira", x: 135, y: 100 },
  { id: "argila1", area: "egito", item: "argila", x: 117, y: 11 },
  { id: "argila2", area: "egito", item: "argila", x: 129, y: 7 },
  { id: "argila3", area: "egito", item: "argila", x: 51, y: 11 },
  { id: "argila4", area: "egito", item: "argila", x: 68, y: 13 },
  { id: "resina1", area: "sinai", item: "resina", x: 61, y: 28 },
  { id: "resina2", area: "sinai", item: "resina", x: 69, y: 22 },
  { id: "resina3", area: "sinai", item: "resina", x: 57, y: 21 },
  { id: "resina4", area: "sinai", item: "resina", x: 52, y: 29 },
  { id: "minerio1", area: "sinai", item: "minerio_cobre", x: 148, y: 27 },
  { id: "minerio2", area: "sinai", item: "minerio_cobre", x: 125, y: 39 },
  { id: "minerio3", area: "sinai", item: "minerio_cobre", x: 102, y: 17 },
  { id: "minerio4", area: "sinai", item: "minerio_cobre", x: 137, y: 35 },
];

// Portais entre regiões (os de ida exigem o capítulo anterior concluído).
const DADOS_PORTAIS = [
  {
    area: "deserto",
    x: 157,
    y: 112,
    destino: "egito",
    chegada: { x: 5, y: 112 },
    capitulo: "egito",
    texto: "Rota para o Egito",
  },
  {
    area: "egito",
    x: 2,
    y: 112,
    destino: "deserto",
    chegada: { x: 155, y: 112 },
    texto: "Volta ao Deserto",
  },
  {
    area: "egito",
    x: 157,
    y: 112,
    destino: "marVermelho",
    chegada: { x: 5, y: 112 },
    capitulo: "marVermelho",
    texto: "Travessia do Mar Vermelho",
  },
  {
    area: "marVermelho",
    x: 2,
    y: 112,
    destino: "egito",
    chegada: { x: 155, y: 112 },
    texto: "Volta ao Egito",
  },
  {
    area: "marVermelho",
    x: 157,
    y: 112,
    destino: "sinai",
    chegada: { x: 5, y: 112 },
    capitulo: "sinai",
    texto: "Caminho do Sinai",
  },
  {
    area: "sinai",
    x: 2,
    y: 112,
    destino: "marVermelho",
    chegada: { x: 155, y: 112 },
    texto: "Volta ao Mar Vermelho",
  },
  {
    area: "sinai",
    x: 157,
    y: 112,
    destino: "galileia",
    chegada: { x: 5, y: 112 },
    capitulo: "galileia",
    texto: "Rota para a Galileia",
  },
  {
    area: "galileia",
    x: 2,
    y: 112,
    destino: "sinai",
    chegada: { x: 155, y: 112 },
    texto: "Volta ao Sinai",
  },
];

// Maná diário (Êxodo 16; JGB-11). O dia do maná começa no amanhecer (hora local do jogador) e vai até o
// amanhecer seguinte: é a janela de coleta. Colha uma vez por dia (tecla N ou botão Maná, em qualquer lugar)
// e coma quando quiser. Nos dias comuns cai uma porção; na sexta, porção dobrada (Êx 16:22); no sábado não
// cai (Êx 16:26-27). O que sobra estraga no próximo amanhecer em que cai maná (Êx 16:20): o da sexta dura o
// Sábado inteiro (Êx 16:23-24). Perder um dia não tira nada: no outro cai de novo.
const REGRAS_MANA = {
  amanhecer: 6, // hora local
  porcao: 3, // um ômer por dia, em 3 refeições
  porcaoSexta: 6, // porção dobrada
  sexta: 5, // Date.getDay(): 0 = domingo
  sabado: 6,
  cura: { vida: 0.5, fe: 30 }, // cada porção: metade da vida máxima e 30 de fé (com a Oração aprendida)
};

// XP de descanso no Sábado (JGB-11). O tempo longe do jogo (página fechada, ou nenhuma ação por
// ausenciaMinutos ou mais) que cai dentro do Sábado, de sexta ao pôr do sol a sábado ao pôr do sol (hora
// local), vira uma reserva de XP: um Sábado inteiro vale porSabado × o XP do nível atual. Enquanto houver
// reserva, cada abate rende XP × multiplicador (o extra sai da reserva). A reserva não expira, só para de
// crescer no limite (limite × o XP do nível atual).
const REGRAS_DESCANSO = {
  inicio: { dia: 5, hora: 18 }, // sexta, 18 h
  fim: { dia: 6, hora: 18 }, // sábado, 18 h
  ausenciaMinutos: 5,
  porSabado: 1,
  limite: 1.5,
  multiplicador: 2,
};

// Vigor: o fôlego para a caçada, em minutos, mostrado em horas:minutos ("40:00", os quarenta dias). Todo
// personagem começa cheio.
//   Gasta só caçando: enquanto houve golpe dado ou recebido nos últimos janelaCombateSegundos, o vigor cai em
//     tempo real (1 minuto por minuto). Com a aba parada (sem quadros), passos maiores que passoMaximoSegundos
//     não contam.
//   Volta longe da caçada: o tempo longe do jogo (página fechada, ou nenhuma ação por carenciaMinutos ou mais)
//     devolve 1 minuto a cada regenCadaMinutos, sem contar a carência. Uma ausência com pelo menos
//     sabadoMinimoMinutos dentro do Sábado (a janela de REGRAS_DESCANSO) enche o vigor.
//   Faixas (vale a primeira, de cima para baixo, com minutos >= desde): xp multiplica o XP das criaturas
//     (o descanso do Sábado dobra depois); o id dá a cor da barra (data-faixa no index.html).
const REGRAS_VIGOR = {
  maximoMinutos: 40 * 60,
  janelaCombateSegundos: 60,
  passoMaximoSegundos: 5,
  carenciaMinutos: 10,
  regenCadaMinutos: 3,
  sabadoMinimoMinutos: 60,
  faixas: [
    { id: "descansado", nome: "Descansado", desde: 38 * 60, xp: 1.1, texto: "+10% de XP das criaturas" },
    { id: "disposto", nome: "Disposto", desde: 12 * 60, xp: 1, texto: "XP normal das criaturas" },
    { id: "exausto", nome: "Exausto", desde: 0, xp: 0.5, texto: "metade do XP das criaturas" },
  ],
};
