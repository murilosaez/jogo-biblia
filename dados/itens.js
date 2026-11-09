// =====================================================================
// dados/itens.js — itens, loja e valores de venda
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// Campos: nome, peso (kg), tipo (consumivel | recurso | arma | arma_distancia | escudo |
// armadura | municao), bonus (dano) e defesa.
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
  tunica_pano: { nome: "Túnica de pano", peso: 4, tipo: "armadura", defesa: 2 },
  armadura_couro: { nome: "Armadura de couro", peso: 8, tipo: "armadura", defesa: 5 },
  arco_madeira: { nome: "Arco de madeira", peso: 7, tipo: "arma_distancia", bonus: 10 },
  arco_composto: { nome: "Arco composto", peso: 7, tipo: "arma_distancia", bonus: 15 },
  flecha: { nome: "Flecha", peso: 0.1, tipo: "municao" },
  pele_lobo: { nome: "Pele de lobo", peso: 2, tipo: "recurso" },
  veneno_escorpiao: { nome: "Veneno de escorpião", peso: 0.5, tipo: "recurso" },
  insignia_bandido: { nome: "Insígnia do bando", peso: 0.5, tipo: "recurso" },
  peixe: { nome: "Peixe fresco", peso: 1, tipo: "recurso" },
};

// Loja do Azarias: preço de compra ("flechas" é um pacote de FLECHAS_POR_PACOTE).
const PRECOS_LOJA = { pocao: 12, pocao_fe: 18, flechas: 8, escudo_madeira: 35, armadura_couro: 65, arco_madeira: 80 };
const FLECHAS_POR_PACOTE = 5;
const VALORES_VENDA = { pele_lobo: 5, erva: 2, odre_agua: 3, peixe: 6 };
