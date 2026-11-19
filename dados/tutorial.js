// =====================================================================
// dados/tutorial.js — primeiros passos do personagem novo (JGB-14)
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// Meta (docs/PLANO-DE-DESIGN.md, "Ciclos de recompensa"): o 1º nível em menos de 2 minutos e uma recompensa a
// cada 30 a 60 segundos. As etapas seguem a 1ª missão (o lobo de Eliabe, dados/missoes.js): andar, falar,
// lutar, receber a recompensa (o nível 2 chega aqui: 10 + 10 de XP do tutorial, 40 do lobo e 50 da missão),
// vestir a espada nova e visitar a mercadora.
//
// Campos de uma etapa:
//   id: identificador (fica no save; não renomeie);
//   titulo: o que fazer, curto (cabeçalho do cartão);
//   texto: como fazer no teclado e mouse; textoToque: no celular (opcional; sem ele, vale o texto);
//   destaque: seletor CSS do que a interface faz pulsar durante a etapa (opcional);
//   alvo: NPC para onde o cartão aponta (distância e rumo; numa etapa de abate, aponta a criatura mais perto);
//   recompensa: { xp, moedas } dados ao cumprir a etapa (opcional);
//   cumprida: frase mostrada ao cumprir.
//
// Condições (condicao.tipo):
//   { tipo: "andar", casas }                — andar essa quantidade de casas;
//   { tipo: "missao", missao, status }      — a missão chega a esse status (ou a um depois dele);
//   { tipo: "abate", missao }               — o 1º objetivo da etapa atual da missão foi cumprido (ou ela acabou);
//   { tipo: "equipar", espaco, item }       — o item (qualquer raridade) está vestido nesse espaço;
//   { tipo: "loja" }                        — comprar ou vender qualquer coisa a um mercador.

const REGRAS_TUTORIAL = {
  // Saves de antes do tutorial não o recebem: quem já joga não precisa dele.
  recompensaFinal: { xp: 0, moedas: 15 },
  concluido: "Tutorial concluído! Receba 15 moedas. Daqui em diante, siga as missões no painel. Boa jornada!",
  pulado: "Tutorial pulado. As missões continuam no painel; a ajuda (?) mostra os controles.",
};

const DADOS_TUTORIAL = [
  {
    id: "andar",
    titulo: "Ande pela vila",
    texto: "Use W A S D ou as setas (ou clique no chão) para andar.",
    textoToque: "Arraste o joystick (ou toque no chão) para andar.",
    condicao: { tipo: "andar", casas: 3 },
    recompensa: { xp: 10, moedas: 0 },
    cumprida: "Isso! +10 XP.",
  },
  {
    id: "falar",
    titulo: "Fale com Eliabe",
    texto: "Eliabe tem uma missão (o balão ! em cima dele). Chegue perto e aperte F (ou clique nele).",
    textoToque: "Eliabe tem uma missão (o balão ! em cima dele). Chegue perto e toque no botão Falar.",
    alvo: "viajante1",
    condicao: { tipo: "missao", missao: "lobo", status: "em_andamento" },
    recompensa: { xp: 10, moedas: 0 },
    cumprida: "Missão aceita! +10 XP.",
  },
  {
    id: "lutar",
    titulo: "Derrote o lobo",
    texto: "O lobo ronda a estrada a sudeste. Clique nele para atacar; se a vida cair, beba uma poção (tecla 1).",
    textoToque: "O lobo ronda a estrada a sudeste. Toque nele (ou no botão de espada) para atacar; se a vida cair, toque no botão da poção.",
    condicao: { tipo: "abate", missao: "lobo" },
    cumprida: "Lobo derrotado! O saque cai direto na mochila.",
  },
  {
    id: "voltar",
    titulo: "Volte a Eliabe",
    texto: "Volte à vila e fale com Eliabe (F) para receber a recompensa.",
    textoToque: "Volte à vila e toque em Falar ao lado de Eliabe para receber a recompensa.",
    alvo: "viajante1",
    condicao: { tipo: "missao", missao: "lobo", status: "concluida" },
    cumprida: "Recompensa recebida: espada de ferro, 2 poções e o nível 2!",
  },
  {
    id: "equipar",
    titulo: "Vista a espada de ferro",
    texto: "Arraste a espada de ferro da Mochila para o espaço da mão no Equipamento (ou botão direito nela: Equipar).",
    textoToque: "Abra a Mochila, toque na espada de ferro e depois no espaço da mão (ou toque longo: Equipar).",
    destaque: "#pEquip",
    condicao: { tipo: "equipar", espaco: "arma", item: "espada_ferro" },
    recompensa: { xp: 15, moedas: 0 },
    cumprida: "Espada de ferro na mão: +12 de dano. +15 XP.",
  },
  {
    id: "loja",
    titulo: "Visite a mercadora",
    texto: "Hadassa vende poções e compra peles, na loja ao norte da vila. Fale com ela (F) e venda a pele de lobo.",
    textoToque: "Hadassa vende poções e compra peles, na loja ao norte da vila. Fale com ela e venda a pele de lobo.",
    alvo: "mercador_canaa",
    condicao: { tipo: "loja" },
    recompensa: { xp: 15, moedas: 0 },
    cumprida: "Negócio feito! +15 XP.",
  },
];
