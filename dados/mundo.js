// =====================================================================
// dados/mundo.js — áreas, pontos de coleta, pesca e portais
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// Áreas de Canaã, Deserto e Mar (mapas gerados em logica.js).
const DADOS_AREAS_BASE = {
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

// Regiões dos capítulos (mapa com padrão de obstáculos próprio, em logica.js).
const DADOS_AREAS_CAPITULOS = {
  egito: { id: "egito", nome: "Egito", bioma: "nilo" },
  marVermelho: { id: "marVermelho", nome: "Mar Vermelho", bioma: "costa" },
  sinai: { id: "sinai", nome: "Monte Sinai", bioma: "montanha" },
  galileia: { id: "galileia", nome: "Galileia", bioma: "galileia" },
};

// Pontos de pesca no Mar das Rotas.
const pontosPesca = [
  { id: "pesca1", x: 18, y: 15 },
  { id: "pesca2", x: 40, y: 42 },
  { id: "pesca3", x: 62, y: 18 },
  { id: "pesca4", x: 49, y: 32 },
];

// Ervas só existem em Canaã e odres só no Deserto.
// Posições iniciais; depois de coletado, cada ponto brota de novo num lugar aleatório da área.
const ervas = [
  { id: "erva1", x: 13, y: 12 },
  { id: "erva2", x: 41, y: 31 },
  { id: "erva3", x: 71, y: 49 },
  { id: "erva4", x: 30, y: 22 },
  { id: "erva5", x: 58, y: 38 },
  { id: "erva6", x: 20, y: 44 },
];
const odres = [
  { id: "odre1", x: 11, y: 48 },
  { id: "odre2", x: 39, y: 34 },
  { id: "odre3", x: 70, y: 15 },
  { id: "odre4", x: 25, y: 20 },
  { id: "odre5", x: 58, y: 28 },
  { id: "odre6", x: 63, y: 44 },
];

// Portais entre regiões (os de ida exigem o capítulo anterior concluído).
const DADOS_PORTAIS = [
  {
    area: "deserto",
    x: 77,
    y: 56,
    destino: "egito",
    chegada: { x: 4, y: 56 },
    capitulo: "egito",
    texto: "Rota para o Egito",
  },
  {
    area: "egito",
    x: 2,
    y: 56,
    destino: "deserto",
    chegada: { x: 75, y: 56 },
    texto: "Volta ao Deserto",
  },
  {
    area: "egito",
    x: 77,
    y: 56,
    destino: "marVermelho",
    chegada: { x: 4, y: 56 },
    capitulo: "marVermelho",
    texto: "Travessia do Mar Vermelho",
  },
  {
    area: "marVermelho",
    x: 2,
    y: 56,
    destino: "egito",
    chegada: { x: 75, y: 56 },
    texto: "Volta ao Egito",
  },
  {
    area: "marVermelho",
    x: 77,
    y: 56,
    destino: "sinai",
    chegada: { x: 4, y: 56 },
    capitulo: "sinai",
    texto: "Caminho do Sinai",
  },
  {
    area: "sinai",
    x: 2,
    y: 56,
    destino: "marVermelho",
    chegada: { x: 75, y: 56 },
    texto: "Volta ao Mar Vermelho",
  },
  {
    area: "sinai",
    x: 77,
    y: 56,
    destino: "galileia",
    chegada: { x: 4, y: 56 },
    capitulo: "galileia",
    texto: "Rota para a Galileia",
  },
  {
    area: "galileia",
    x: 2,
    y: 56,
    destino: "sinai",
    chegada: { x: 75, y: 56 },
    texto: "Volta ao Sinai",
  },
];
