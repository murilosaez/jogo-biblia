// =====================================================================
// dados/masmorras.js — masmorras (JGB-23): instâncias com etapas, perigos, chefe e recompensa exclusiva
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// Uma masmorra é uma área própria (dados/mundo.js, DADOS_AREAS_MASMORRAS; desenho em dados/mapas.js) onde só se
// entra pelo porteiro (papel "masmorra", dados/npcs.js). Lá dentro, o estado (etapa, ondas, perigos, o NPC
// protegido) vive só na memória: recarregar a página devolve à porta e a masmorra recomeça; morrer lá dentro leva a
// Canaã, como toda morte (o item que cair fica à porta), e a masmorra também recomeça.
//
// REGRAS_MASMORRAS: recargaHoras (depois de uma vitória, a mesma masmorra só abre de novo após esse tempo).
//
// Campos de uma masmorra:
//   nome, referencia (passagem bíblica), descricao (janela de entrada), mecanica (uma frase), nivelMinimo;
//   area: a área dela; vagas: as criaturas da masmorra — cada uma copia uma criatura de dados/criaturas.js
//     (base) e muda o que vier (nome, tier, vida, dano...); x, y: onde surge (dentro da sala). Elas só existem
//     enquanto a instância está aberta, não renascem e nunca viram campeão;
//   protegido (opcional): o NPC a proteger { nome, aparencia, x, y, vida, defesa, raioIsca } — as criaturas o
//     atacam enquanto ele estiver a até raioIsca casas; se a vida dele chega a 0, a masmorra falha;
//   etapas, em ordem; cada uma com texto (o objetivo no painel) e:
//     tipo "proteger": duracaoMs (sobreviva com o protegido de pé);
//     tipo "sobreviver": duracaoMs (sobreviva até o fim do tempo);
//     tipo "zona": zona { x, y, raio } e duracaoMs — o tempo só conta com o jogador dentro do círculo (a oração);
//     tipo "chegar": alvo { x, y, largura, altura } — a etapa termina quando o jogador entra no retângulo;
//     tipo "chefe": vaga (o chefe; a etapa termina quando ele cai) e fases [{ vidaAte (fração), chamar: [vagas],
//       texto }] — ao cair abaixo de vidaAte, a fase chama as vagas e avisa;
//     ondas (opcional): [{ em (ms desde o começo da etapa), vagas: [ids] }];
//     perigos (opcional): [{ padrao, aCadaMs, avisoMs, dano, nome }] — casas do chão marcadas com aviso que, ao
//       fim do aviso, ferem quem estiver nelas. padrao: "linhas" (faixas de cada 3 linhas ou colunas), "xadrez"
//       (metade das casas, alternadas), "alvo" (3×3 em volta do jogador) ou "anel" (a 2 e 3 casas do chefe);
//     fim: frase dita ao concluir a etapa (opcional);
//   sala: o retângulo jogável (os padrões de perigo cobrem só ele);
//   labirinto (opcional): { x, y, largura, altura, parede, aberturas, portas } — a cada entrada, um labirinto novo
//     é escavado nesse retângulo (largura e altura ímpares; corredores nas casas de x e y ímpares a partir da borda),
//     com paredes do tipo parede; aberturas: fração das paredes internas derrubadas a mais (atalhos); portas:
//     casas sempre abertas (a ligação com o resto da sala). Ao sair, a sala volta a ser como era;
//   recompensa: { xp, moedas, item } — o item (exclusivo, só desta masmorra) vem na 1ª vitória; nas outras,
//     XP e moedas;
//   falas: { entrada, vitoria, derrota }.
// Os ids (masmorra, vagas e etapas) ficam no save do histórico: não renomeie.

const REGRAS_MASMORRAS = { recargaHoras: 4 };

const DADOS_MASMORRAS = {
  cova_leoes: {
    nome: "Cova dos leões",
    referencia: "Daniel 6",
    descricao:
      "Daniel orou ao seu Deus como costumava, e por isso o lançaram na cova dos leões (Dn 6:10, 16). Foi o Senhor quem " +
      "fechou a boca dos leões (Dn 6:22); aqui, você vigia ao lado dele a noite inteira: os leões famintos vêm em levas, " +
      "e o maior deles vem por último.",
    mecanica: "Proteja Daniel até o amanhecer (cerca de 3 minutos): os leões atacam a ele, não a você.",
    nivelMinimo: 10,
    area: "cova_leoes",
    sala: { x: 4, y: 4, largura: 32, altura: 22 },
    protegido: { nome: "Daniel", aparencia: "anciao", x: 19, y: 15, vida: 360, defesa: 2, raioIsca: 40 },
    vagas: [
      { id: "cova_leao_1", base: "leao1", x: 33, y: 6, nome: "Leão faminto", tier: "normal", vidaMaxima: 140, danoContraJogador: 11, raioPercepcao: 40 },
      { id: "cova_leao_2", base: "leao1", x: 33, y: 24, nome: "Leão faminto", tier: "normal", vidaMaxima: 140, danoContraJogador: 11, raioPercepcao: 40 },
      { id: "cova_leao_3", base: "leao1", x: 19, y: 5, nome: "Leão faminto", tier: "normal", vidaMaxima: 140, danoContraJogador: 11, raioPercepcao: 40 },
      { id: "cova_leao_4", base: "leao1", x: 19, y: 24, nome: "Leão faminto", tier: "normal", vidaMaxima: 140, danoContraJogador: 11, raioPercepcao: 40 },
      { id: "cova_leao_5", base: "leao1", x: 34, y: 15, nome: "Leão faminto", tier: "normal", vidaMaxima: 140, danoContraJogador: 11, raioPercepcao: 40 },
      { id: "cova_leao_6", base: "leao1", x: 28, y: 5, nome: "Leão faminto", tier: "normal", vidaMaxima: 140, danoContraJogador: 11, raioPercepcao: 40 },
      { id: "cova_leao_7", base: "leao1", x: 28, y: 24, nome: "Leão faminto", tier: "normal", vidaMaxima: 140, danoContraJogador: 11, raioPercepcao: 40 },
      {
        id: "cova_leao_chefe", base: "leao1", x: 34, y: 15, nome: "Leão-rei da cova", tier: "chefe", escala: 1.3, vidaMaxima: 900, danoContraJogador: 13,
        defesa: 7, xpRecompensa: 400, raioPercepcao: 40, comportamento: ["investida", "furia"], vidaLimite: 0.3,
      },
    ],
    etapas: [
      {
        id: "noite",
        tipo: "proteger",
        duracaoMs: 120000,
        texto: "Proteja Daniel dos leões famintos",
        ondas: [
          { em: 2000, vagas: ["cova_leao_1", "cova_leao_2"] },
          { em: 30000, vagas: ["cova_leao_3", "cova_leao_4"] },
          { em: 60000, vagas: ["cova_leao_5", "cova_leao_6"] },
          { em: 85000, vagas: ["cova_leao_7"] },
        ],
        fim: "A noite avança. Um rugido mais forte que os outros sacode a cova.",
      },
      {
        id: "leao_rei",
        tipo: "chefe",
        vaga: "cova_leao_chefe",
        texto: "Derrote o leão-rei antes que ele alcance Daniel",
        fases: [{ vidaAte: 0.5, chamar: ["cova_leao_1", "cova_leao_2"], texto: "O leão-rei ruge e chama a matilha!" }],
        fim: "Ao romper da manhã, a cova se cala: \"O meu Deus enviou o seu anjo e fechou a boca aos leões\" (Dn 6:22).",
      },
    ],
    recompensa: { xp: 900, moedas: 120, item: "selo_dario" },
    falas: {
      entrada: "Daniel está na cova. Fique ao lado dele até o amanhecer.",
      vitoria: "Daniel saiu da cova sem dano algum, porque crera no seu Deus (Dn 6:23).",
      derrota: "A sua vigília não resistiu desta vez; foi o Senhor quem guardou Daniel (Dn 6:22). Volte quando estiver pronto.",
    },
  },

  fornalha: {
    nome: "Fornalha ardente",
    referencia: "Daniel 3",
    descricao:
      "Sadraque, Mesaque e Abede-Nego não se prostraram diante da imagem de ouro e foram lançados na fornalha " +
      "aquecida sete vezes mais (Dn 3:19-21). Atravesse o fogo: o chão se acende em padrões, e os guardas do rei avançam.",
    mecanica: "Desvie das casas marcadas antes que o fogo suba e derrote o capitão da guarda.",
    nivelMinimo: 12,
    area: "fornalha",
    sala: { x: 4, y: 4, largura: 32, altura: 22 },
    vagas: [
      { id: "fornalha_guarda_1", base: "mercenario1", x: 33, y: 7, nome: "Guarda do rei", tier: "normal", vidaMaxima: 200, danoContraJogador: 10, defesa: 8,
        raioPercepcao: 40, comportamento: "padrao" },
      { id: "fornalha_guarda_2", base: "mercenario1", x: 33, y: 23, nome: "Guarda do rei", tier: "normal", vidaMaxima: 200, danoContraJogador: 10, defesa: 8,
        raioPercepcao: 40, comportamento: "padrao" },
      { id: "fornalha_guarda_3", base: "mercenario1", x: 26, y: 6, nome: "Guarda do rei", tier: "normal", vidaMaxima: 200, danoContraJogador: 10, defesa: 8,
        raioPercepcao: 40, comportamento: "padrao" },
      { id: "fornalha_guarda_4", base: "mercenario1", x: 26, y: 24, nome: "Guarda do rei", tier: "normal", vidaMaxima: 200, danoContraJogador: 10, defesa: 8,
        raioPercepcao: 40, comportamento: "padrao" },
      {
        id: "fornalha_capitao", base: "mercenario1", x: 32, y: 15, nome: "Capitão da guarda de Nabucodonosor", tier: "chefe", escala: 1.3, vidaMaxima: 1000,
        danoContraJogador: 14, defesa: 12, xpRecompensa: 500, raioPercepcao: 40, comportamento: "furia", vidaLimite: 0.3,
      },
    ],
    etapas: [
      {
        id: "chamas",
        tipo: "sobreviver",
        duracaoMs: 75000,
        texto: "Atravesse as chamas: saia das casas marcadas",
        ondas: [
          { em: 15000, vagas: ["fornalha_guarda_1", "fornalha_guarda_2"] },
          { em: 45000, vagas: ["fornalha_guarda_3", "fornalha_guarda_4"] },
        ],
        perigos: [
          { padrao: "linhas", aCadaMs: 5000, avisoMs: 1500, dano: 28, nome: "As chamas sobem" },
          { padrao: "alvo", aCadaMs: 7000, avisoMs: 1200, dano: 24, nome: "Uma labareda" },
        ],
        fim: "O capitão da guarda entra na fornalha para ver o que acontece.",
      },
      {
        id: "capitao",
        tipo: "chefe",
        vaga: "fornalha_capitao",
        texto: "Derrote o capitão da guarda entre as chamas",
        perigos: [
          { padrao: "xadrez", aCadaMs: 8000, avisoMs: 1800, dano: 30, nome: "O fogo se espalha" },
          { padrao: "anel", aCadaMs: 6000, avisoMs: 1400, dano: 26, nome: "Brasas em volta do capitão" },
        ],
        fases: [{ vidaAte: 0.5, chamar: ["fornalha_guarda_1", "fornalha_guarda_2"], texto: "O capitão chama os guardas!" }],
        fim: "\"Eu, porém, vejo quatro homens soltos, que andam passeando dentro do fogo, sem nenhum dano\" (Dn 3:25).",
      },
    ],
    recompensa: { xp: 1100, moedas: 150, item: "turbante_fornalha" },
    falas: {
      entrada: "A fornalha foi aquecida sete vezes mais (Dn 3:19). Saia das casas marcadas e siga até o fim.",
      vitoria: "Nem um cabelo foi chamuscado, nem cheiro de fogo passou sobre eles (Dn 3:27).",
      derrota: "As chamas venceram desta vez. Volte quando estiver pronto.",
    },
  },

  ventre_peixe: {
    nome: "Ventre do grande peixe",
    referencia: "Jonas 1:17–2:10",
    descricao:
      "Jonas fugiu da presença do Senhor (Jn 1:3), e o Senhor deparou um grande peixe para que o tragasse; três dias e três " +
      "noites esteve no ventre do peixe (Jn 1:17). Lá de dentro, ele orou (Jn 2:1). Sobreviva às águas do abismo, ore com ele e " +
      "resista até que o Senhor fale ao peixe.",
    mecanica: "Sobreviva ao suco do ventre, fique no círculo para orar com Jonas e vença a serpente do abismo.",
    nivelMinimo: 14,
    area: "ventre_peixe",
    sala: { x: 4, y: 4, largura: 32, altura: 22 },
    vagas: [
      { id: "ventre_caranguejo_1", base: "caranguejo1", x: 33, y: 6, nome: "Caranguejo do abismo", vidaMaxima: 170, danoContraJogador: 11, defesa: 10, raioPercepcao: 40 },
      { id: "ventre_caranguejo_2", base: "caranguejo1", x: 33, y: 24, nome: "Caranguejo do abismo", vidaMaxima: 170, danoContraJogador: 11, defesa: 10, raioPercepcao: 40 },
      { id: "ventre_caranguejo_3", base: "caranguejo1", x: 20, y: 5, nome: "Caranguejo do abismo", vidaMaxima: 170, danoContraJogador: 11, defesa: 10, raioPercepcao: 40 },
      { id: "ventre_caranguejo_4", base: "caranguejo1", x: 20, y: 24, nome: "Caranguejo do abismo", vidaMaxima: 170, danoContraJogador: 11, defesa: 10, raioPercepcao: 40 },
      {
        id: "ventre_serpente", base: "naja1", x: 32, y: 15, nome: "Serpente do abismo", tier: "chefe", escala: 1.5, vidaMaxima: 1100,
        danoContraJogador: 15, defesa: 12, xpRecompensa: 550, raioPercepcao: 40, comportamento: "furia",
      },
    ],
    etapas: [
      {
        id: "aguas",
        tipo: "sobreviver",
        duracaoMs: 60000,
        texto: "As águas do ventre sobem: saia das casas marcadas",
        ondas: [{ em: 20000, vagas: ["ventre_caranguejo_1", "ventre_caranguejo_2"] }],
        perigos: [
          { padrao: "linhas", aCadaMs: 5000, avisoMs: 1500, dano: 30, nome: "O suco do ventre sobe" },
          { padrao: "alvo", aCadaMs: 6500, avisoMs: 1200, dano: 26, nome: "Uma golfada" },
        ],
        fim: "O abismo rodeia Jonas; então, do ventre do peixe, ele ora ao Senhor, seu Deus (Jn 2:1).",
      },
      {
        id: "oracao",
        tipo: "zona",
        zona: { x: 19, y: 15, raio: 2 },
        duracaoMs: 25000,
        texto: "Fique no círculo e ore com Jonas",
        ondas: [
          { em: 3000, vagas: ["ventre_caranguejo_3", "ventre_caranguejo_4"] },
          { em: 14000, vagas: ["ventre_caranguejo_1", "ventre_caranguejo_2"] },
        ],
        perigos: [{ padrao: "xadrez", aCadaMs: 7000, avisoMs: 1800, dano: 28, nome: "O ventre se contrai" }],
        fim: "\"Na minha angústia, clamei ao Senhor, e ele me respondeu\" (Jn 2:2). Algo se move no fundo do ventre.",
      },
      {
        id: "serpente",
        tipo: "chefe",
        vaga: "ventre_serpente",
        texto: "Vença a serpente do abismo",
        perigos: [
          { padrao: "anel", aCadaMs: 6000, avisoMs: 1400, dano: 28, nome: "A serpente se enrosca" },
          { padrao: "linhas", aCadaMs: 9000, avisoMs: 1600, dano: 30, nome: "O suco do ventre sobe" },
        ],
        fases: [{ vidaAte: 0.5, chamar: ["ventre_caranguejo_3", "ventre_caranguejo_4"], texto: "A serpente chama os caranguejos do abismo!" }],
        fim: "\"Falou, pois, o Senhor ao peixe, e este vomitou a Jonas na terra\" (Jn 2:10).",
      },
    ],
    recompensa: { xp: 1300, moedas: 170, item: "concha_peixe" },
    falas: {
      entrada: "Escuro e fundo: o ventre do grande peixe, onde Jonas esteve três dias e três noites (Jn 1:17).",
      vitoria: "\"Ao Senhor pertence a salvação!\" (Jn 2:9). Jonas está na terra seca, pronto para ir a Nínive.",
      derrota: "O abismo venceu desta vez. Volte quando estiver pronto.",
    },
  },

  piramides: {
    nome: "Tesouros do Egito",
    referencia: "Hebreus 11:26; Êxodo 1 e 7",
    descricao:
      "Os hebreus edificaram para Faraó as cidades-celeiros (Êx 1:11). Moisés \"considerou o opróbrio de Cristo por maiores " +
      "riquezas do que os tesouros do Egito\" (Hb 11:26). Atravesse as galerias do túmulo — elas nunca são as mesmas — até a " +
      "câmara do tesouro, onde Janes, mago de Faraó, resiste à verdade (2 Tm 3:8).",
    mecanica: "Ache o caminho no labirinto, que muda a cada entrada, e vença o mago na câmara do tesouro.",
    nivelMinimo: 16,
    area: "piramides",
    sala: { x: 4, y: 4, largura: 32, altura: 21 },
    labirinto: { x: 4, y: 4, largura: 27, altura: 21, parede: "tijolos", aberturas: 0.08, portas: [{ x: 30, y: 15 }] },
    vagas: [
      { id: "piramides_guarda_1", base: "soldadoEgito1", x: 17, y: 7, nome: "Guarda do túmulo", vidaMaxima: 260, danoContraJogador: 12, defesa: 12, raioPercepcao: 8 },
      { id: "piramides_guarda_2", base: "soldadoEgito1", x: 23, y: 21, nome: "Guarda do túmulo", vidaMaxima: 260, danoContraJogador: 12, defesa: 12, raioPercepcao: 8 },
      // os guardas que o mago chama na câmara (a fase final): já dentro dela e enxergando a sala toda
      { id: "piramides_guarda_3", base: "soldadoEgito1", x: 33, y: 10, nome: "Guarda do túmulo", vidaMaxima: 260, danoContraJogador: 12, defesa: 12, raioPercepcao: 40 },
      { id: "piramides_guarda_4", base: "soldadoEgito1", x: 33, y: 20, nome: "Guarda do túmulo", vidaMaxima: 260, danoContraJogador: 12, defesa: 12, raioPercepcao: 40 },
      { id: "piramides_escorpiao_1", base: "escorpiao1", x: 11, y: 21, nome: "Escorpião do túmulo", vidaMaxima: 160, danoContraJogador: 10, defesa: 8, raioPercepcao: 7 },
      { id: "piramides_escorpiao_2", base: "escorpiao1", x: 25, y: 9, nome: "Escorpião do túmulo", vidaMaxima: 160, danoContraJogador: 10, defesa: 8, raioPercepcao: 7 },
      { id: "piramides_naja_1", base: "naja1", x: 33, y: 11, nome: "Serpente do mago", vidaMaxima: 150, danoContraJogador: 11, defesa: 8, raioPercepcao: 40 },
      { id: "piramides_naja_2", base: "naja1", x: 33, y: 19, nome: "Serpente do mago", vidaMaxima: 150, danoContraJogador: 11, defesa: 8, raioPercepcao: 40 },
      {
        id: "piramides_janes", base: "feiticeiro1", x: 34, y: 15, nome: "Janes, mago de Faraó", tier: "chefe", escala: 1.4, vidaMaxima: 1800,
        danoContraJogador: 16, defesa: 14, xpRecompensa: 600, raioPercepcao: 40,
      },
    ],
    etapas: [
      {
        id: "galerias",
        tipo: "chegar",
        alvo: { x: 31, y: 9, largura: 5, altura: 13 },
        texto: "Ache o caminho até a câmara do tesouro",
        ondas: [
          { em: 1000, vagas: ["piramides_guarda_1", "piramides_escorpiao_1"] },
          { em: 30000, vagas: ["piramides_guarda_2", "piramides_escorpiao_2"] },
        ],
        perigos: [{ padrao: "alvo", aCadaMs: 9000, avisoMs: 1300, dano: 26, nome: "Uma armadilha do túmulo" }],
        fim: "A câmara do tesouro: ouro, prata e um mago que lança o seu bordão ao chão.",
      },
      {
        id: "janes",
        tipo: "chefe",
        vaga: "piramides_janes",
        texto: "Vença Janes, mago de Faraó",
        perigos: [{ padrao: "anel", aCadaMs: 6500, avisoMs: 1400, dano: 28, nome: "As encantações do mago" }],
        fases: [
          { vidaAte: 0.6, chamar: ["piramides_naja_1", "piramides_naja_2"], texto: "Janes lança o bordão: serpentes! (Êx 7:11-12)" },
          { vidaAte: 0.3, chamar: ["piramides_guarda_3", "piramides_guarda_4"], texto: "O mago chama os guardas do túmulo!" },
        ],
        fim: "\"Do modo por que Janes e Jambres resistiram a Moisés, também estes resistem à verdade\"; eles \"não irão avante\" (2 Tm 3:8-9).",
      },
    ],
    recompensa: { xp: 1500, moedas: 200, item: "sandalias_pascoa" },
    falas: {
      entrada: "Galerias escuras, que não são as mesmas da última vez. Ache a câmara do tesouro.",
      vitoria: "O tesouro fica para trás: \"lombos cingidos, sandálias nos pés e cajado na mão; comê-lo-eis à pressa\" (Êx 12:11).",
      derrota: "As galerias venceram desta vez. Volte quando estiver pronto: o caminho será outro.",
    },
  },
};
