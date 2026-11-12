// =====================================================================
// dados/itens.js — itens, raridades, loja e valores de venda
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// Campos: nome, peso (kg), tipo (consumivel | recurso | arma | arma_distancia | escudo |
// armadura | municao), bonus (dano), defesa e raridade (padrão "comum"; chave de RARIDADES).
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
  escudo_ferro: { nome: "Escudo de ferro", peso: 8, tipo: "escudo", defesa: 7 }, // só na troca de pontos de tarefa
  tunica_pano: { nome: "Túnica de pano", peso: 4, tipo: "armadura", defesa: 2 },
  armadura_couro: { nome: "Armadura de couro", peso: 8, tipo: "armadura", defesa: 5 },
  couraca_escamas: { nome: "Couraça de escamas", peso: 11, tipo: "armadura", defesa: 8 }, // só na troca de pontos
  arco_madeira: { nome: "Arco de madeira", peso: 7, tipo: "arma_distancia", bonus: 10 },
  arco_composto: { nome: "Arco composto", peso: 7, tipo: "arma_distancia", bonus: 15 },
  flecha: { nome: "Flecha", peso: 0.1, tipo: "municao" },
  pele_lobo: { nome: "Pele de lobo", peso: 2, tipo: "recurso" },
  veneno_escorpiao: { nome: "Veneno de escorpião", peso: 0.5, tipo: "recurso" },
  insignia_bandido: { nome: "Insígnia do bando", peso: 0.5, tipo: "recurso" },
  peixe: { nome: "Peixe fresco", peso: 1, tipo: "recurso" },

  // Saques das tabelas das criaturas (dados/criaturas.js).
  presa_lobo: { nome: "Presa de lobo", peso: 0.3, tipo: "recurso", raridade: "incomum" },
  ferrao_escorpiao: { nome: "Ferrão de escorpião", peso: 0.3, tipo: "recurso", raridade: "incomum" },
  linho_egipcio: { nome: "Linho egípcio", peso: 1, tipo: "recurso" },
  ponta_lanca: { nome: "Ponta de lança de bronze", peso: 1, tipo: "recurso" },
  bracelete_cobre: { nome: "Bracelete de cobre", peso: 0.5, tipo: "recurso", raridade: "incomum" },
  // Pedras do peitoral do sumo sacerdote (Êxodo 28.17–20): saques muito raros (0,1%). No futuro serão
  // engastadas nos equipamentos; por ora Azarias as compra.
  pedra_sardio: { nome: "Sárdio", peso: 0.2, tipo: "recurso", raridade: "reliquia", pedra: "#c2452d" },
  pedra_topazio: { nome: "Topázio", peso: 0.2, tipo: "recurso", raridade: "reliquia", pedra: "#e8b94a" },
  pedra_esmeralda: { nome: "Esmeralda", peso: 0.2, tipo: "recurso", raridade: "reliquia", pedra: "#3fa66a" },
  pedra_carbunculo: { nome: "Carbúnculo", peso: 0.2, tipo: "recurso", raridade: "reliquia", pedra: "#a8243a" },
  pedra_safira: { nome: "Safira", peso: 0.2, tipo: "recurso", raridade: "reliquia", pedra: "#3b5ec2" },
  pedra_ametista: { nome: "Ametista", peso: 0.2, tipo: "recurso", raridade: "reliquia", pedra: "#8a4ac2" },
  pedra_onix: { nome: "Ônix", peso: 0.2, tipo: "recurso", raridade: "reliquia", pedra: "#4a4450" },
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
  carga: { tipos: ["escudo", "armadura"], faixas: { raro: [2, 3], epico: [3, 5], reliquia: [5, 8] }, texto: "+{v} kg de carga" },
};

// Sorteio da raridade de um equipamento que cai sem raridade fixa (peso de cada uma).
// Com raridadeMinima na tabela de saque, as raridades abaixo dela ficam fora do sorteio.
const SORTEIO_RARIDADE = { comum: 600, incomum: 280, raro: 90, epico: 25, reliquia: 5 };

// Chances nomeadas para as tabelas de saque (dados/criaturas.js). Também vale um número de 0 a 1.
const CHANCES_SAQUE = { sempre: 1, comum: 0.25, incomum: 0.08, raro: 0.01, muito_raro: 0.001 };

// Loja do Azarias: preço de compra ("flechas" é um pacote de FLECHAS_POR_PACOTE). Os itens da troca de pontos
// de tarefa (dados/tarefas.js) ficam fora desta lista e de VALORES_VENDA: pontos nunca viram moedas.
const PRECOS_LOJA = { pocao: 12, pocao_fe: 18, flechas: 8, escudo_madeira: 35, armadura_couro: 65, arco_madeira: 80 };
const FLECHAS_POR_PACOTE = 5;
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
  pedra_sardio: 150,
  pedra_topazio: 150,
  pedra_esmeralda: 160,
  pedra_carbunculo: 170,
  pedra_safira: 180,
  pedra_ametista: 190,
  pedra_onix: 200,
};
