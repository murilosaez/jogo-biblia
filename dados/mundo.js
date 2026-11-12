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
