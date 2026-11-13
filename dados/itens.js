// =====================================================================
// dados/itens.js — itens, raridades, loja e valores de venda
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// Campos: nome, peso (kg), tipo (consumivel | recurso | arma | arma_distancia | escudo |
// armadura | municao), bonus (dano), defesa e raridade (padrão "comum"; chave de RARIDADES).
//
// Pesos: massas reais aproximadas, em kg, de objetos do Antigo Oriente Próximo (equipamento como os achados
// arqueológicos; provisões e mercadorias como hoje). Referências: túnica de linho 0,5; armadura de couro 5;
// couraça de escamas de bronze 12 (as do Egito pesavam 10 a 15); espada curta de ferro 1,3 (a de treino, de
// madeira, 0,8); escudo redondo de madeira 3, de bronze 5,5 e de ferro 6,5; arco simples 0,7 e composto 0,9
// (madeira, chifre e tendão); flecha 0,03; funda de lã 0,1; frasco de barro com poção 0,3; odre de pele de cabra
// com 2 litros 2,5; pele de lobo 1,5; couro grosso (urso, leão, crocodilo) 3; peixe 0,8 fresco e 0,4 seco;
// minério, argila e lingote 2 (um bloco que se carrega na mão); ânfora vazia 5; ervas, incenso e penas 0,01 a 0,1;
// pedras preciosas 0,01. A carga máxima (CARGA_BASE e CARGA_POR_NIVEL, abaixo) foi ajustada a esses pesos.
const ITENS = {
  pocao: { nome: "Poção de vida", peso: 0.3, tipo: "consumivel" },
  pocao_fe: { nome: "Poção de fé", peso: 0.3, tipo: "consumivel" },
  erva: { nome: "Erva medicinal", peso: 0.1, tipo: "recurso" },
  odre_agua: { nome: "Odre de água", peso: 2.5, tipo: "recurso" },
  espada_madeira: { nome: "Espada de madeira", peso: 0.8, tipo: "arma", bonus: 5 },
  espada_ferro: { nome: "Espada de ferro", peso: 1.3, tipo: "arma", bonus: 12 },
  espada_temperada: { nome: "Espada temperada", peso: 1.2, tipo: "arma", bonus: 17 },
  escudo_madeira: { nome: "Escudo de madeira", peso: 3, tipo: "escudo", defesa: 3 },
  escudo_bronze: { nome: "Escudo de bronze", peso: 5.5, tipo: "escudo", defesa: 5 },
  escudo_ferro: { nome: "Escudo de ferro", peso: 6.5, tipo: "escudo", defesa: 7 }, // só na troca de pontos de tarefa
  tunica_pano: { nome: "Túnica de pano", peso: 0.5, tipo: "armadura", defesa: 2 },
  armadura_couro: { nome: "Armadura de couro", peso: 5, tipo: "armadura", defesa: 5 },
  couraca_escamas: { nome: "Couraça de escamas", peso: 12, tipo: "armadura", defesa: 8 }, // só na troca de pontos
  arco_madeira: { nome: "Arco de madeira", peso: 0.7, tipo: "arma_distancia", bonus: 10 },
  arco_composto: { nome: "Arco composto", peso: 0.9, tipo: "arma_distancia", bonus: 15 },
  flecha: { nome: "Flecha", peso: 0.03, tipo: "municao" },
  // Funda (JGB-20): arma à distância que não gasta munição (pedras há em todo lugar). semMunicao: dispensa flechas.
  funda: { nome: "Funda", peso: 0.1, tipo: "arma_distancia", bonus: 9, semMunicao: true },
  pele_lobo: { nome: "Pele de lobo", peso: 1.5, tipo: "recurso" },
  veneno_escorpiao: { nome: "Veneno de escorpião", peso: 0.05, tipo: "recurso" },
  insignia_bandido: { nome: "Insígnia do bando", peso: 0.1, tipo: "recurso" },
  peixe: { nome: "Peixe fresco", peso: 0.8, tipo: "recurso" },

  // Ofícios (JGB-24, dados/oficios.js). Matérias-primas colhidas nos pontos de extração (dados/mundo.js)
  // e o peixe grande da pesca.
  madeira: { nome: "Madeira", peso: 3, tipo: "recurso" },
  argila: { nome: "Argila do Nilo", peso: 2, tipo: "recurso" },
  minerio_cobre: { nome: "Minério de cobre", peso: 2, tipo: "recurso" },
  resina: { nome: "Resina de acácia", peso: 0.2, tipo: "recurso" },
  peixe_grande: { nome: "Peixe grande", peso: 3, tipo: "recurso", raridade: "incomum" },
  // Feitos nos ofícios: materiais intermediários e mercadorias para vender.
  lingote_bronze: { nome: "Lingote de bronze", peso: 2, tipo: "recurso" },
  tecido_linho: { nome: "Tecido de linho", peso: 1, tipo: "recurso" },
  frasco_barro: { nome: "Frasco de barro", peso: 0.2, tipo: "recurso" },
  oleo_peixe: { nome: "Óleo de peixe", peso: 0.5, tipo: "recurso" },
  peixe_seco: { nome: "Peixe seco", peso: 0.4, tipo: "recurso" },
  peixe_defumado: { nome: "Peixe defumado", peso: 0.5, tipo: "recurso" },
  jarro_barro: { nome: "Jarro de barro", peso: 1.5, tipo: "recurso" },
  lamparina: { nome: "Lamparina", peso: 0.2, tipo: "recurso" },
  anfora: { nome: "Ânfora", peso: 5, tipo: "recurso" },
  incenso: { nome: "Incenso", peso: 0.1, tipo: "recurso" },
  oleo_uncao: { nome: "Óleo da unção", peso: 0.3, tipo: "recurso", raridade: "incomum" },
  manto_bordado: { nome: "Manto bordado", peso: 1.2, tipo: "recurso", raridade: "incomum" },

  // Saques das tabelas das criaturas (dados/criaturas.js).
  presa_lobo: { nome: "Presa de lobo", peso: 0.05, tipo: "recurso", raridade: "incomum" },
  ferrao_escorpiao: { nome: "Ferrão de escorpião", peso: 0.05, tipo: "recurso", raridade: "incomum" },
  linho_egipcio: { nome: "Linho egípcio", peso: 0.5, tipo: "recurso" },
  ponta_lanca: { nome: "Ponta de lança de bronze", peso: 0.3, tipo: "recurso" },
  bracelete_cobre: { nome: "Bracelete de cobre", peso: 0.1, tipo: "recurso", raridade: "incomum" },
  pena_ave: { nome: "Pena de ave de rapina", peso: 0.01, tipo: "recurso" },
  couro_grosso: { nome: "Couro grosso", peso: 3, tipo: "recurso" },
  carapaca: { nome: "Carapaça", peso: 0.3, tipo: "recurso" },
  amuleto_faianca: { nome: "Amuleto de faiança", peso: 0.05, tipo: "recurso", raridade: "incomum" },
  // Pedras do peitoral do sumo sacerdote (Êxodo 28.17–20): saques muito raros (0,1%). No futuro serão
  // engastadas nos equipamentos; por ora os mercadores as compram.
  pedra_sardio: { nome: "Sárdio", peso: 0.01, tipo: "recurso", raridade: "reliquia", pedra: "#c2452d" },
  pedra_topazio: { nome: "Topázio", peso: 0.01, tipo: "recurso", raridade: "reliquia", pedra: "#e8b94a" },
  pedra_esmeralda: { nome: "Esmeralda", peso: 0.01, tipo: "recurso", raridade: "reliquia", pedra: "#3fa66a" },
  pedra_carbunculo: { nome: "Carbúnculo", peso: 0.01, tipo: "recurso", raridade: "reliquia", pedra: "#a8243a" },
  pedra_safira: { nome: "Safira", peso: 0.01, tipo: "recurso", raridade: "reliquia", pedra: "#3b5ec2" },
  pedra_ametista: { nome: "Ametista", peso: 0.01, tipo: "recurso", raridade: "reliquia", pedra: "#8a4ac2" },
  pedra_onix: { nome: "Ônix", peso: 0.01, tipo: "recurso", raridade: "reliquia", pedra: "#4a4450" },
};

// Raridades, da mais comum à mais rara (a ordem importa). cor: nome, borda e brilho no chão;
// brilho: força do brilho no chão (0 = nenhum); som: aviso sonoro quando cai (null = nenhum);
// melhoria: pontos somados ao atributo principal do equipamento (dano da arma ou do arco, defesa do
// escudo ou da armadura); atributos: quantos atributos aleatórios o equipamento ganha (raro ou
// melhor); anuncio: título do aviso de destaque no Registro quando o saque cai (só épico e relíquia).
const RARIDADES = {
  comum: { nome: "Comum", cor: "#d8cbb0", brilho: 0, som: null, melhoria: 0, atributos: 0 },
  incomum: { nome: "Incomum", cor: "#6fc25a", brilho: 1, som: "incomum", melhoria: 1, atributos: 0 },
  raro: { nome: "Raro", cor: "#4f9be8", brilho: 2, som: "raro", melhoria: 1, atributos: 1 },
  epico: { nome: "Épico", cor: "#b46be0", brilho: 3, som: "epico", melhoria: 2, atributos: 2, anuncio: "Saque épico!" },
  reliquia: { nome: "Relíquia", cor: "#f0b43c", brilho: 4, som: "reliquia", melhoria: 3, atributos: 3, anuncio: "Saque de relíquia!" },
};

// Atributos aleatórios dos equipamentos raros ou melhores. tipos: em quais equipamentos aparece;
// faixas: [mínimo, máximo] sorteado em cada raridade; texto: como aparece ({v} = valor).
const ATRIBUTOS_ITEM = {
  dano: { tipos: ["arma", "arma_distancia"], faixas: { raro: [1, 2], epico: [2, 3], reliquia: [3, 5] }, texto: "+{v} de dano" },
  defesa: { tipos: ["escudo", "armadura"], faixas: { raro: [1, 1], epico: [1, 2], reliquia: [2, 3] }, texto: "+{v} de defesa" },
  critico: {
    tipos: ["arma", "arma_distancia", "escudo", "armadura"],
    faixas: { raro: [1, 2], epico: [2, 3], reliquia: [3, 5] },
    texto: "+{v}% de chance de crítico",
  },
  vida: {
    tipos: ["arma", "arma_distancia", "escudo", "armadura"],
    faixas: { raro: [5, 10], epico: [10, 20], reliquia: [20, 30] },
    texto: "+{v} de vida máxima",
  },
  // Carga: faixas na escala da carga máxima de hoje (CARGA_BASE). O teto continua 8 (5 + a maior melhoria),
  // então os itens antigos com +6 a +8 kg seguem válidos no save.
  carga: { tipos: ["escudo", "armadura"], faixas: { raro: [1, 2], epico: [2, 3], reliquia: [3, 5] }, texto: "+{v} kg de carga" },
};

// Carga máxima (kg) = CARGA_BASE + CARGA_POR_NIVEL por nível acima do 1º + alforjes da troca de pontos
// (dados/tarefas.js) + atributo de carga do equipamento. Com os pesos reais de ITENS, o equipamento inicial
// (espada de madeira, escudo de madeira, túnica e 3 poções) pesa 5,2 kg: sobram cerca de 30 kg no nível 1,
// quase o mesmo espaço livre de antes (32 kg com os pesos antigos). Nível 10: 62 kg; nível 25: 107 kg.
const CARGA_BASE = 35;
const CARGA_POR_NIVEL = 3;

// Sorteio da raridade de um equipamento que cai sem raridade fixa (peso de cada uma).
// Com raridadeMinima na tabela de saque, as raridades abaixo dela ficam fora do sorteio.
const SORTEIO_RARIDADE = { comum: 600, incomum: 280, raro: 90, epico: 25, reliquia: 5 };

// Chances nomeadas para as tabelas de saque (dados/criaturas.js). Também vale um número de 0 a 1.
const CHANCES_SAQUE = { sempre: 1, comum: 0.25, incomum: 0.08, raro: 0.01, muito_raro: 0.001 };

// Preço de compra nas lojas ("flechas" é um pacote de FLECHAS_POR_PACOTE). Os itens da troca de pontos
// de tarefa (dados/tarefas.js) ficam fora desta lista e de VALORES_VENDA: pontos nunca viram moedas.
const PRECOS_LOJA = { pocao: 12, pocao_fe: 18, flechas: 8, escudo_madeira: 35, armadura_couro: 65, arco_madeira: 80, funda: 60 };
const FLECHAS_POR_PACOTE = 5;
// Quantidade máxima numa compra só (unidades, ou lotes de flechas): o seletor da loja vai de 1 até ela.
const QUANTIDADE_MAXIMA_COMPRA = 100;
// O que cada mercador (NPC com papel "loja", dados/npcs.js) vende, na ordem da lista; o preço é o de
// PRECOS_LOJA. Todo mercador compra todos os itens de VALORES_VENDA.
const LOJAS = {
  mercador_canaa: ["pocao", "pocao_fe", "flechas", "escudo_madeira", "funda"],
  mercador1: ["pocao", "pocao_fe", "flechas", "escudo_madeira", "armadura_couro", "arco_madeira"],
  mercador_egito: ["pocao", "pocao_fe", "flechas", "armadura_couro", "arco_madeira"],
  mercador_mar: ["pocao", "pocao_fe", "flechas", "escudo_madeira", "armadura_couro", "arco_madeira"],
  mercador_sinai: ["pocao", "pocao_fe", "flechas", "escudo_madeira", "armadura_couro", "arco_madeira"],
  mercador_galileia: ["pocao", "pocao_fe", "flechas", "escudo_madeira", "armadura_couro", "arco_madeira"],
};
const VALORES_VENDA = {
  pele_lobo: 5,
  erva: 2,
  odre_agua: 3,
  peixe: 6,
  veneno_escorpiao: 4,
  insignia_bandido: 6,
  presa_lobo: 10,
  ferrao_escorpiao: 12,
  linho_egipcio: 8,
  ponta_lanca: 9,
  bracelete_cobre: 16,
  pena_ave: 4,
  couro_grosso: 8,
  carapaca: 6,
  amuleto_faianca: 18,
  // Ofícios (JGB-24): o que se fabrica vale mais que os materiais (teste 65).
  madeira: 2,
  argila: 1,
  minerio_cobre: 3,
  resina: 3,
  peixe_grande: 18,
  lingote_bronze: 11,
  tecido_linho: 19,
  frasco_barro: 2,
  oleo_peixe: 14,
  peixe_seco: 22,
  peixe_defumado: 34,
  jarro_barro: 6,
  lamparina: 22,
  anfora: 14,
  incenso: 12,
  oleo_uncao: 40,
  manto_bordado: 90,
  pedra_sardio: 150,
  pedra_topazio: 150,
  pedra_esmeralda: 160,
  pedra_carbunculo: 170,
  pedra_safira: 180,
  pedra_ametista: 190,
  pedra_onix: 200,
};
