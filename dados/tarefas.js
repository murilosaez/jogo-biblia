// =====================================================================
// dados/tarefas.js — caçadas (tarefas de caça) dos atalaias e troca de pontos de tarefa
// Dados puros (sem regras). Carregado depois de dados/missoes.js e antes de logica.js.
// =====================================================================

// limiteAtivas: caçadas acompanhadas ao mesmo tempo; bonusPrimeiraVez: pontos extras na 1ª entrega (0.5 = +50%).
const REGRAS_TAREFAS = { limiteAtivas: 3, bonusPrimeiraVez: 0.5 };

// esperaHoras: tempo, contado da ENTREGA, até a caçada voltar ao mural (corre com o jogo fechado).
// Uma caçada aceita nunca expira.
const TIPOS_TAREFA = {
  ronda: { nome: "Ronda", esperaHoras: 20 },
  grande: { nome: "Grande caçada", esperaHoras: 164 },
};

// Falas dos atalaias (NPCs com papel "mural"); um NPC pode sobrepor qualquer uma no seu campo falas.
// Variáveis: {recompensa} (o que foi entregue agora), {requisito} (o que falta para abrir o mural), {nivel}.
const FALAS_MURAL = {
  saudacao: "Quem vigia as trilhas sempre encontra trabalho. Escolha uma caçada no mural; você pode entregá-la a qualquer atalaia.",
  entrega: "Bom trabalho! Anotei no rol: {recompensa}.",
  bloqueado: "Ainda não posso pôr seu nome no rol. Volte depois de {requisito}.",
  subiuNivel: " Você subiu para o nível {nivel}!",
};

// Campos de uma caçada:
//   id: PERMANENTE (fica no save). Não renomeie nem apague; para tirar do mural use oculta: true
//     (quem já aceitou ainda conclui e entrega);
//   mural: id do atalaia (NPC com papel "mural") que oferece a caçada; tipo: chave de TIPOS_TAREFA;
//   nome; curto (painel e números do mundo); descricao (variável {total} = abates pedidos);
//   alvo: { criaturas?: [...], especies?: [...], familias?: [...], area? } — o abate conta se a criatura
//     estiver em criaturas OU tiver uma das especies OU uma das familias (dados/criaturas.js); area limita
//     a uma região. Prefira especies e familias: criaturas novas passam a contar sem mudar a caçada;
//   total: abates; recompensa: { xp, moedas, pontos } (nunca itens: a entrega nunca trava por peso);
//   requer (opcional): { missao?, nivel? }, somado ao requer do atalaia;
//   esperaHoras (opcional): sobrepõe a do tipo; oculta (opcional): some do mural.
// Guia de balanceamento: XP ≈ 15% (ronda) ou 20% (grande) do XP dos abates; moedas ≈ 25% das moedas do
// saque; pontos não diminuem de uma região para a seguinte. O teste 39 mede o ritmo de cada caçada.
const DADOS_TAREFAS = [
  // ------------------------------------------------------------------ Canaã
  {
    id: "canaa_lobos",
    mural: "atalaia_canaa",
    tipo: "ronda",
    nome: "Lobos na estrada",
    curto: "Lobos",
    descricao: "Derrote {total} lobos que rondam as trilhas e os rebanhos de Canaã.",
    alvo: { especies: ["lobo"] },
    total: 30,
    recompensa: { xp: 180, moedas: 30, pontos: 6 },
  },
  {
    id: "canaa_matilha",
    mural: "atalaia_canaa",
    tipo: "grande",
    nome: "A matilha",
    curto: "Matilha",
    descricao: "A matilha sempre volta. Derrote {total} lobos para que os pastores de Canaã durmam em paz.",
    alvo: { especies: ["lobo"] },
    total: 300,
    recompensa: { xp: 2400, moedas: 300, pontos: 40 },
  },
  // ---------------------------------------------------------------- Deserto
  {
    id: "deserto_ferroes",
    mural: "atalaia_deserto",
    tipo: "ronda",
    nome: "Ferrões no caminho",
    curto: "Escorpiões",
    descricao: "Derrote {total} escorpiões nas pedras a oeste do acampamento.",
    alvo: { especies: ["escorpiao"] },
    total: 40,
    recompensa: { xp: 360, moedas: 80, pontos: 10 },
  },
  {
    id: "deserto_bando",
    mural: "atalaia_deserto",
    tipo: "ronda",
    nome: "O bando volta",
    curto: "Chefe do bando",
    descricao: "Os que fugiram voltam a se reunir, e o bando sempre arranja um novo chefe. Vença o chefe dos saqueadores {total} vezes.",
    alvo: { criaturas: ["bandido1"] },
    total: 15,
    recompensa: { xp: 220, moedas: 60, pontos: 8 },
  },
  {
    id: "deserto_rotas",
    mural: "atalaia_deserto",
    tipo: "grande",
    nome: "As rotas das caravanas",
    curto: "Escorpiões",
    descricao: "Derrote {total} escorpiões e deixe seguras as rotas das caravanas.",
    alvo: { especies: ["escorpiao"] },
    total: 180, // 6 escorpiões no deserto: 180 mantém a grande caçada acima de 30 min
    recompensa: { xp: 1800, moedas: 300, pontos: 50 },
  },
  // ------------------------------------------------------------------ Egito
  {
    id: "egito_guardas",
    mural: "atalaia_egito",
    tipo: "ronda",
    nome: "A trilha central",
    curto: "Guardas",
    descricao: "Afaste {total} guardas egípcios da trilha central, por onde o povo precisa passar.",
    alvo: { especies: ["guarda_egipcio"] },
    total: 30,
    recompensa: { xp: 450, moedas: 140, pontos: 12 },
  },
  {
    id: "egito_farao",
    mural: "atalaia_egito",
    tipo: "grande",
    nome: "Soldados de Faraó",
    curto: "Soldados de Faraó",
    descricao: "Vença {total} soldados de Faraó, no Egito ou no Mar Vermelho.",
    alvo: { familias: ["soldados_farao"] },
    total: 150,
    recompensa: { xp: 3000, moedas: 700, pontos: 65 },
  },
  // ----------------------------------------------------------- Mar Vermelho
  {
    id: "mar_retaguarda",
    mural: "atalaia_mar",
    tipo: "ronda",
    nome: "A retaguarda",
    curto: "Perseguidores",
    descricao: "Detenha {total} soldados perseguidores que ameaçam a retaguarda do povo.",
    alvo: { especies: ["soldado_perseguidor"] },
    total: 25,
    recompensa: { xp: 480, moedas: 140, pontos: 12 },
  },
  {
    id: "mar_praia",
    mural: "atalaia_mar",
    tipo: "grande",
    nome: "Até a beira do mar",
    curto: "Perseguidores",
    descricao: "Vença {total} soldados perseguidores antes que alcancem o acampamento à beira do mar.",
    alvo: { especies: ["soldado_perseguidor"] },
    total: 100,
    recompensa: { xp: 2600, moedas: 550, pontos: 65 },
  },
  // ------------------------------------------------------------------ Sinai
  {
    id: "sinai_refidim",
    mural: "atalaia_sinai",
    tipo: "ronda",
    nome: "Os que ficam para trás",
    curto: "Amalequitas",
    descricao: "Os amalequitas atacam os cansados que ficam para trás. Vença {total} guerreiros amalequitas.",
    alvo: { especies: ["guerreiro_amalequita"] },
    total: 20,
    recompensa: { xp: 480, moedas: 130, pontos: 14 },
  },
  {
    id: "sinai_vale",
    mural: "atalaia_sinai",
    tipo: "grande",
    nome: "O vale de Refidim",
    curto: "Amalequitas",
    descricao: "Vença {total} guerreiros amalequitas e guarde o acampamento ao pé do monte.",
    alvo: { especies: ["guerreiro_amalequita"] },
    total: 100,
    recompensa: { xp: 3200, moedas: 650, pontos: 70 },
  },
  // --------------------------------------------------------------- Galileia
  {
    id: "galileia_viajantes",
    mural: "atalaia_galileia",
    tipo: "ronda",
    nome: "Viajantes em paz",
    curto: "Salteadores",
    descricao: "Afaste {total} salteadores para que os viajantes cheguem em paz ao lago.",
    alvo: { especies: ["salteador"] },
    total: 18,
    recompensa: { xp: 520, moedas: 140, pontos: 15 },
  },
  {
    id: "galileia_estrada",
    mural: "atalaia_galileia",
    tipo: "grande",
    nome: "A estrada segura",
    curto: "Salteadores",
    descricao: "Afaste {total} salteadores e deixe segura a estrada da Galileia.",
    alvo: { especies: ["salteador"] },
    total: 80,
    recompensa: { xp: 3000, moedas: 600, pontos: 75 },
  },
];

// Troca de pontos (em qualquer atalaia com o mural aberto). Campos: id (PERMANENTE, fica no save);
//   item (id em dados/itens.js) e quantidade (padrão 1) OU melhoria: { carga } (kg a mais, para sempre, compra
//   única) com nome e icone (glifo da arte); preco (pontos de tarefa); requer (opcional): { missao?, nivel?, troca? }.
// Alforjes: +5 kg cada, na escala da carga de dados/itens.js (CARGA_BASE 35 kg + 3 por nível).
// Itens da troca não entram em PRECOS_LOJA nem em VALORES_VENDA: pontos nunca viram moedas.
const DADOS_TROCA_PONTOS = [
  { id: "alforje_couro", nome: "Alforje de couro", icone: "ui_alforje", melhoria: { carga: 5 }, preco: 60 },
  { id: "escudo_ferro", item: "escudo_ferro", preco: 150, requer: { missao: "egito" } },
  {
    id: "alforje_viagem",
    nome: "Alforje de viagem",
    icone: "ui_alforje",
    melhoria: { carga: 5 },
    preco: 180,
    requer: { troca: "alforje_couro" },
  },
  { id: "couraca_escamas", item: "couraca_escamas", preco: 300, requer: { missao: "sinai" } },
];
