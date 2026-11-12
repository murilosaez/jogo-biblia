// =====================================================================
// dados/npcs.js — personagens não jogáveis
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// papel: "missao" (dá missões; ver dados/missoes.js), "loja", "guia", "mural" (atalaia: mural de caçadas da
// região, ver dados/tarefas.js; requer: { missao } = missão que abre o mural), "ambiente" (morador da vila: só
// conversa; falas.linhas são ditas uma de cada vez, em rodízio; aparencia: o visual em sprites.js) e, nos
// capítulos, "lider" (dá a missão), "apoio" (só conversa) e "mestre" (ensina a Oração). falas: textos próprios.
// Quem atende numa tenda ou banca fica logo à frente dela (dados/mapas.js, estruturas com npc).
const DADOS_NPCS = [
  { id: "viajante1", nome: "Eliabe", area: "canaan", x: 22, y: 18, papel: "missao" },
  { id: "guia_canaa", nome: "Micael, guia de caravanas", area: "canaan", x: 13, y: 17, papel: "guia" },
  // Mestre de vocações (JGB-20): troca de vocação (papel "vocacao"; a 1ª escolha vale em qualquer lugar).
  // revisao-teologica: pendente (Jetro aconselhou Moisés a repartir o trabalho entre o povo, Êx 18)
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
  { id: "noemi1", nome: "Noemi", area: "deserto", x: 136, y: 14, papel: "missao" },
  { id: "mercador1", nome: "Azarias, mercador", area: "deserto", x: 142, y: 19, papel: "loja" },
  { id: "guia_deserto", nome: "Tamar, guia de caravanas", area: "deserto", x: 128, y: 20, papel: "guia" },
  // Mercadores e guias de caravanas das outras cidades (um de cada em toda cidade).
  // revisao-teologica: pendente (nomes e falas novos)
  {
    id: "mercador_canaa",
    nome: "Hadassa, mercadora",
    area: "canaan",
    x: 30,
    y: 17,
    papel: "loja",
    aparencia: "tecela",
    falas: { saudacao: "Pão, poções e flechas para quem vai às colinas. Também compro peles e presas." },
  },
  {
    id: "mercador_egito",
    nome: "Senefer, mercador",
    area: "egito",
    x: 15,
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
    x: 13,
    y: 95,
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
    y: 95,
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
    y: 22,
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
        "As bancas vazias da praça esperam um ferreiro e um curandeiro. Quem sabe um dia.",
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
    x: 14,
    y: 99,
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
];
