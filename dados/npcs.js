// =====================================================================
// dados/npcs.js — personagens não jogáveis
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// papel: "missao" (dá missões; ver dados/missoes.js), "loja", "guia", "mural" (atalaia: mural de caçadas da
// região, ver dados/tarefas.js; requer: { missao } = missão que abre o mural), "ambiente" (morador da vila: só
// conversa; falas.linhas são ditas uma de cada vez, em rodízio; aparencia: o visual em sprites.js) e, nos
// capítulos, "lider" (dá a missão), "apoio" (só conversa) e "mestre" (ensina a Oração). falas: textos próprios.
// Quem atende numa tenda ou banca fica logo à frente dela; o mercador fica atrás do balcão da loja (dados/mapas.js,
// estruturas com npc). "barqueiro": fica ao lado do cais da cidade, diz o preço da passagem e embarca quem pagar.
// "deposito": guarda do depósito da cidade (atende à frente de uma banca); o depósito é um só em todas as cidades
// (REGRAS_DEPOSITO, dados/mundo.js). "ferreiro": forja e engasta (dados/oficios.js), à frente de uma banca.
// "masmorra": porteiro das masmorras listadas em masmorras (dados/masmorras.js).
const DADOS_NPCS = [
  // Guardas do depósito (um por cidade). Os nomes vêm dos que cuidavam dos depósitos do templo (Ne 12:25; 13:13)
  // e de Itamar, que fez a conta do material do tabernáculo (Êx 38:21).
  {
    id: "deposito_canaa",
    nome: "Selemias, guarda do depósito",
    area: "canaan",
    x: 30,
    y: 20,
    papel: "deposito",
    aparencia: "anciao",
    falas: { saudacao: "O que você guardar comigo fica guardado em todo depósito: em qualquer cidade é o mesmo baú." },
  },
  {
    id: "deposito_deserto",
    nome: "Zadoque, guarda do depósito",
    area: "deserto",
    x: 150,
    y: 18,
    papel: "deposito",
    aparencia: "sentinela",
    falas: { saudacao: "No deserto nada se perde comigo. O que guardar aqui, retira em qualquer cidade." },
  },
  {
    id: "deposito_egito",
    nome: "Pedaías, guarda do depósito",
    area: "egito",
    x: 27,
    y: 101,
    papel: "deposito",
    aparencia: "oleiro",
    falas: { saudacao: "Como José guardou o trigo, guardo o que é seu. Vale em todo depósito." },
  },
  {
    id: "deposito_mar",
    nome: "Hanã, guarda do depósito",
    area: "marVermelho",
    x: 19,
    y: 94,
    papel: "deposito",
    aparencia: "pescador",
    falas: { saudacao: "Deixe aqui o que pesa na viagem. Em qualquer cidade o baú é o mesmo." },
  },
  {
    id: "deposito_sinai",
    nome: "Itamar, guarda do depósito",
    area: "sinai",
    x: 20,
    y: 94,
    papel: "deposito",
    aparencia: "pastor",
    falas: { saudacao: "Tudo o que chega aqui fica contado. Guarde e retire em qualquer depósito." },
  },
  {
    id: "deposito_galileia",
    nome: "Matanias, guarda do depósito",
    area: "galileia",
    x: 41,
    y: 27,
    papel: "deposito",
    aparencia: "ancia",
    falas: { saudacao: "O depósito é um só: o que guardar na Galileia, encontra em Canaã e no Egito." },
  },
  { id: "viajante1", nome: "Eliabe", area: "canaan", x: 22, y: 18, papel: "missao" },
  { id: "guia_canaa", nome: "Micael, guia de caravanas", area: "canaan", x: 13, y: 17, papel: "guia" },
  // Mestre de vocações (JGB-20): troca de vocação (papel "vocacao"; a 1ª escolha vale em qualquer lugar).
  // Jetro aconselhou Moisés a repartir o trabalho entre o povo (Êx 18).
  {
    id: "mestre_vocacoes",
    nome: "Jetro, mestre de vocações",
    area: "canaan",
    x: 27,
    y: 26,
    papel: "vocacao",
    aparencia: "anciao",
    falas: { saudacao: "Não é bom que um só carregue tudo: cada um tem a sua parte no caminho." },
  },
  // Ferreiros (JGB-25): forjam de +1 a +10 e engastam as pedras do peitoral (REGRAS_FORJA e REGRAS_ENGASTE,
  // dados/oficios.js), à frente da banca deles. Bezalel e Aoliabe lavraram o metal e lapidaram as pedras do
  // tabernáculo (Êx 31:2-6; 35:30-35).
  {
    id: "ferreiro_canaa",
    nome: "Bezalel, ferreiro",
    area: "canaan",
    x: 18,
    y: 17,
    papel: "ferreiro",
    aparencia: "oleiro",
    falas: { saudacao: "O fogo prova o metal. Traga a sua peça e eu a aprimoro; traga uma pedra do peitoral e eu a engasto." },
  },
  {
    id: "ferreiro_deserto",
    nome: "Aoliabe, ferreiro",
    area: "deserto",
    x: 147,
    y: 24,
    papel: "ferreiro",
    aparencia: "cameleiro",
    falas: { saudacao: "Até no deserto a bigorna canta. Forjo armas e armaduras e engasto pedras preciosas." },
  },
  // Porteiro das masmorras (JGB-23, dados/masmorras.js): Baruque, o escriba de Jeremias (Jr 36:4), que desceu com ele
  // ao Egito (Jr 43:6-7); aqui, em Gósen, guarda as histórias do exílio e abre a Cova dos leões e a Fornalha ardente.
  {
    id: "porteiro_egito",
    nome: "Baruque, escriba",
    area: "egito",
    x: 22,
    y: 104,
    papel: "masmorra",
    aparencia: "anciao",
    masmorras: ["cova_leoes", "fornalha"],
    falas: { saudacao: "Escrevi as palavras que o Senhor deu a Jeremias (Jr 36:4). Quer entrar numa das histórias do exílio?" },
  },
  // Porteiro do Ventre do grande peixe (JGB-52): Amitai, pai de Jonas, de Gate-Hefer, na Galileia (2 Rs 14:25; Jn 1:1).
  {
    id: "porteiro_galileia",
    nome: "Amitai, pai de Jonas",
    area: "galileia",
    x: 24,
    y: 24,
    papel: "masmorra",
    aparencia: "pescador",
    masmorras: ["ventre_peixe"],
    falas: { saudacao: "Meu filho Jonas fugiu do Senhor e foi tragado por um grande peixe (Jn 1:17). Quer descer com ele ao abismo?" },
  },
  { id: "noemi1", nome: "Noemi", area: "deserto", x: 136, y: 14, papel: "missao" },
  { id: "mercador1", nome: "Azarias, mercador", area: "deserto", x: 143, y: 17, papel: "loja" },
  { id: "guia_deserto", nome: "Tamar, guia de caravanas", area: "deserto", x: 128, y: 20, papel: "guia" },
  // Mercadores e guias de caravanas das outras cidades (um de cada em toda cidade).
  {
    id: "mercador_canaa",
    nome: "Hadassa, mercadora",
    area: "canaan",
    x: 30,
    y: 10,
    papel: "loja",
    aparencia: "tecela",
    falas: { saudacao: "Pão, poções e flechas para quem vai às colinas. Também compro peles e presas." },
  },
  {
    id: "mercador_egito",
    nome: "Senefer, mercador",
    area: "egito",
    x: 13,
    y: 94,
    papel: "loja",
    aparencia: "oleiro",
    falas: { saudacao: "Linho, poções e couro curtido. Em Gósen ninguém vende mais barato." },
  },
  { id: "guia_egito", nome: "Natanael, guia de caravanas", area: "egito", x: 31, y: 94, papel: "guia", aparencia: "cameleiro" },
  {
    id: "mercador_mar",
    nome: "Quenaz, mercador",
    area: "marVermelho",
    x: 12,
    y: 93,
    papel: "loja",
    aparencia: "pescador",
    falas: { saudacao: "O que o mar traz eu compro; o que o caminho pede eu vendo." },
  },
  { id: "guia_mar", nome: "Abigail, guia de caravanas", area: "marVermelho", x: 34, y: 94, papel: "guia", aparencia: "pastora" },
  {
    id: "mercador_sinai",
    nome: "Mesulão, mercador",
    area: "sinai",
    x: 12,
    y: 93,
    papel: "loja",
    aparencia: "pastor",
    falas: { saudacao: "Na montanha o frio corta. Leve poções e uma boa armadura." },
  },
  { id: "guia_sinai", nome: "Hobabe, guia de caravanas", area: "sinai", x: 34, y: 94, papel: "guia", aparencia: "cameleiro" },
  {
    id: "mercador_galileia",
    nome: "Eliaquim, mercador",
    area: "galileia",
    x: 37,
    y: 19,
    papel: "loja",
    aparencia: "anciao",
    falas: { saudacao: "Peixe seco, poções e flechas. E compro o que você trouxer da estrada." },
  },
  { id: "guia_galileia", nome: "Salomé, guia de caravanas", area: "galileia", x: 9, y: 27, papel: "guia", aparencia: "vizinha" },
  { id: "moisesEgito", nome: "Moisés", area: "egito", x: 20, y: 96, capitulo: "egito", papel: "lider" },
  {
    id: "aaronEgito",
    nome: "Arão",
    area: "egito",
    x: 26,
    y: 95,
    capitulo: "egito",
    papel: "apoio",
    falas: {
      bloqueado: "Conclua primeiro o caminho pelo Deserto.",
      inicio:
        "Sou Arão, irmão de Moisés. O Senhor me chamou para falar ao lado dele diante de Faraó. Ouça o que meu irmão tem a dizer.",
      andamento:
        "Coragem! O guarda fica na trilha central. Se estiver ferido, descanse aqui entre nós antes de voltar.",
      retorno: "Vi que o caminho foi aberto. Moisés está esperando por você.",
      concluido:
        "Prepare as sandálias e o cajado: partiremos às pressas, como o Senhor ordenou. Nos veremos à beira do mar.",
    },
  },
  { id: "araoMar", nome: "Arão", area: "marVermelho", x: 18, y: 97, capitulo: "marVermelho", papel: "lider" },
  { id: "josueSinai", nome: "Josué", area: "sinai", x: 19, y: 97, capitulo: "sinai", papel: "lider" },
  {
    id: "pedroGalileia",
    nome: "Pedro",
    area: "galileia",
    x: 42,
    y: 19,
    capitulo: "galileia",
    papel: "lider",
  },
  {
    id: "jesusGalileia",
    nome: "Jesus",
    area: "galileia",
    x: 25,
    y: 30,
    capitulo: "galileia",
    papel: "mestre",
    falas: {
      bloqueado: "Conclua primeiro o caminho pelo Monte Sinai.",
      antes: "A paz esteja com você. Ajude Pedro a proteger os que vêm pela estrada; depois venha, e eu lhe ensinarei.",
      ensino:
        "Quando você orar, entre no seu quarto e ore ao seu Pai, que está em secreto. Você aprendeu a Oração: pressione F1 para pedir cura. A fé se renova com o tempo.",
      depois:
        "Vigie e ore. Quanto mais você ora, mais sua Oração cresce: aos níveis 25, 50 e 100 novas formas de cura se abrem.",
    },
  },
  // Atalaias: mural de caçadas de cada região (dados/tarefas.js). Mesmo visual em todas as regiões.
  { id: "atalaia_canaa", nome: "Atalaia, vigia de Canaã", area: "canaan", x: 35, y: 17, papel: "mural", requer: { missao: "ervas" } },
  {
    id: "atalaia_deserto",
    nome: "Atalaia, vigia do Deserto",
    area: "deserto",
    x: 139,
    y: 24,
    papel: "mural",
    requer: { missao: "deserto" },
  },
  { id: "atalaia_egito", nome: "Atalaia, vigia do Egito", area: "egito", x: 32, y: 99, papel: "mural", requer: { missao: "egito" } },
  {
    id: "atalaia_mar",
    nome: "Atalaia, vigia do Mar Vermelho",
    area: "marVermelho",
    x: 30,
    y: 97,
    papel: "mural",
    requer: { missao: "marVermelho" },
  },
  { id: "atalaia_sinai", nome: "Atalaia, vigia do Sinai", area: "sinai", x: 30, y: 97, papel: "mural", requer: { missao: "sinai" } },
  {
    id: "atalaia_galileia",
    nome: "Atalaia, vigia da Galileia",
    area: "galileia",
    x: 14,
    y: 40,
    papel: "mural",
    requer: { missao: "galileia" },
  },
  // Moradores das vilas (ambientação): só conversam.
  {
    id: "zila_canaa",
    nome: "Zila, aguadeira",
    area: "canaan",
    x: 19,
    y: 25,
    papel: "ambiente",
    aparencia: "aguadeira",
    falas: {
      linhas: [
        "O poço da vila é fundo e a água é fresca. Beba antes de seguir viagem.",
        "Dizem que os lobos descem das colinas a leste quando o sol se põe. Ande pela estrada.",
      ],
    },
  },
  {
    id: "abiel_canaa",
    nome: "Abiel, pastor",
    area: "canaan",
    x: 33,
    y: 24,
    papel: "ambiente",
    aparencia: "pastor",
    falas: {
      linhas: [
        "Perdi duas ovelhas para os lobos esta semana. Se for às colinas a leste, vá preparado.",
        "As oliveiras do nordeste são antigas; meu avô já colhia azeitonas ali.",
      ],
    },
  },
  {
    id: "ada_canaa",
    nome: "Ada, anciã da vila",
    area: "canaan",
    x: 14,
    y: 30,
    papel: "ambiente",
    aparencia: "ancia",
    falas: {
      linhas: [
        "Bezalel, o ferreiro, já trabalha na banca da praça. Agora só falta um curandeiro.",
        "A estrada do sul leva à trilha do Deserto. É longa, mas segura de dia.",
      ],
    },
  },
  {
    id: "itai_deserto",
    nome: "Itai, cameleiro",
    area: "deserto",
    x: 123,
    y: 14,
    papel: "ambiente",
    aparencia: "cameleiro",
    falas: {
      linhas: [
        "Os camelos descansam junto ao oásis. Daqui partem as caravanas para o Egito.",
        "Os escorpiões gostam das pedras a noroeste. Pise com cuidado.",
      ],
    },
  },
  {
    id: "keila_deserto",
    nome: "Keila, tecelã",
    area: "deserto",
    x: 123,
    y: 23,
    papel: "ambiente",
    aparencia: "tecela",
    falas: {
      linhas: [
        "Estas tendas são de pelo de cabra: seguram o calor do dia e o frio da noite.",
        "Azarias vende de tudo, mas pechinchar com ele é perder tempo.",
      ],
    },
  },
  {
    id: "uziel_egito",
    nome: "Uziel, oleiro",
    area: "egito",
    x: 15,
    y: 100,
    papel: "ambiente",
    aparencia: "oleiro",
    falas: {
      linhas: [
        "Fazemos tijolos de sol a sol para Faraó. O barro do Nilo não tem fim.",
        "Os guardas vigiam a estrada do meio. Ninguém passa sem ser visto.",
      ],
    },
  },
  {
    id: "sela_egito",
    nome: "Selá, aguadeira",
    area: "egito",
    x: 18,
    y: 102,
    papel: "ambiente",
    aparencia: "aguadeira",
    falas: {
      linhas: [
        "A água do poço de Gósen é nossa; a do rio, os egípcios guardam.",
        "Moisés e Arão falaram com Faraó. Esperamos e oramos.",
      ],
    },
  },
  {
    id: "naama_mar",
    nome: "Naama, mãe hebreia",
    area: "marVermelho",
    x: 13,
    y: 99,
    papel: "ambiente",
    aparencia: "mae",
    falas: {
      linhas: [
        "Saímos às pressas, com a massa ainda sem fermento. As crianças estão cansadas.",
        "O mar à frente, o exército atrás. Ainda assim, ninguém aqui quer voltar.",
      ],
    },
  },
  {
    id: "zuar_mar",
    nome: "Zuar, ancião",
    area: "marVermelho",
    x: 25,
    y: 101,
    papel: "ambiente",
    aparencia: "anciao",
    falas: {
      linhas: [
        "Vi a coluna de nuvem durante o dia. Ela vai à nossa frente.",
        "Os soldados de Faraó rondam a estrada do meio. Fique perto do acampamento.",
      ],
    },
  },
  {
    id: "gadi_sinai",
    nome: "Gadi, sentinela",
    area: "sinai",
    x: 25,
    y: 93,
    papel: "ambiente",
    aparencia: "sentinela",
    falas: {
      linhas: [
        "Do alto daquelas pedras vigiamos o vale. Os amalequitas vêm pelo leste.",
        "Josué escolheu homens para a batalha. Precisamos de todo braço forte.",
      ],
    },
  },
  {
    id: "tirza_sinai",
    nome: "Tirza, pastora",
    area: "sinai",
    x: 13,
    y: 100,
    papel: "ambiente",
    aparencia: "pastora",
    falas: {
      linhas: [
        "Há pouca pastagem entre estas rochas, mas as cabras se arranjam.",
        "O monte a nordeste vive coberto de nuvens. Ninguém sobe lá sem ser chamado.",
      ],
    },
  },
  {
    id: "joel_galileia",
    nome: "Joel, pescador",
    area: "galileia",
    x: 32,
    y: 28,
    papel: "ambiente",
    aparencia: "pescador",
    falas: {
      linhas: [
        "Peixe do lago, salgado ontem à noite. Hoje a pesca foi fraca: passamos a noite sem pegar nada.",
        "Os barcos ficam na praia, ao norte da vila. Cuidado com as redes estendidas.",
      ],
    },
  },
  {
    id: "noa_galileia",
    nome: "Noa, vizinha",
    area: "galileia",
    x: 30,
    y: 38,
    papel: "ambiente",
    aparencia: "vizinha",
    falas: {
      linhas: [
        "Muita gente tem vindo a Cafarnaum para ouvir o Mestre.",
        "A estrada do meio anda perigosa: salteadores atacam quem viaja sozinho.",
      ],
    },
  },
  // Barqueiros: um ao lado do cais de cada cidade (dados/mundo.js). Dizem o preço da passagem (REGRAS_BARCO) e
  // embarcam quem pagar.
  { id: "barqueiro_canaa", nome: "Zebulom, barqueiro", area: "canaan", x: 81, y: 3, papel: "barqueiro", aparencia: "barqueiro" },
  { id: "barqueiro_deserto", nome: "Elom, barqueiro", area: "deserto", x: 81, y: 3, papel: "barqueiro", aparencia: "barqueiro" },
  { id: "barqueiro_egito", nome: "Hurão, barqueiro do Nilo", area: "egito", x: 25, y: 7, papel: "barqueiro", aparencia: "barqueiro" },
  { id: "barqueiro_mar", nome: "Gade, barqueiro", area: "marVermelho", x: 23, y: 3, papel: "barqueiro", aparencia: "barqueiro" },
  { id: "barqueiro_sinai", nome: "Jetur, barqueiro", area: "sinai", x: 23, y: 3, papel: "barqueiro", aparencia: "barqueiro" },
  { id: "barqueiro_galileia", nome: "Zebedeu, barqueiro", area: "galileia", x: 45, y: 18, papel: "barqueiro", aparencia: "barqueiro" },
];
