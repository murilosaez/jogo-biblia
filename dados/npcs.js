// =====================================================================
// dados/npcs.js — personagens não jogáveis
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// papel: "missao" (dá missões; ver dados/missoes.js), "loja", "guia", "mural" (atalaia: mural de caçadas da
// região, ver dados/tarefas.js; requer: { missao } = missão que abre o mural) e, nos capítulos, "lider" (dá a
// missão), "apoio" (só conversa) e "mestre" (ensina a Oração). falas: textos próprios do NPC.
const DADOS_NPCS = [
  { id: "viajante1", nome: "Eliabe", area: "canaan", x: 5, y: 5, papel: "missao" },
  { id: "guia_canaa", nome: "Micael, guia de caravanas", area: "canaan", x: 9, y: 5, papel: "guia" },
  { id: "noemi1", nome: "Noemi", area: "deserto", x: 68, y: 8, papel: "missao" },
  { id: "mercador1", nome: "Azarias, mercador", area: "deserto", x: 72, y: 10, papel: "loja" },
  { id: "guia_deserto", nome: "Tamar, guia de caravanas", area: "deserto", x: 66, y: 12, papel: "guia" },
  { id: "moisesEgito", nome: "Moisés", area: "egito", x: 9, y: 52, capitulo: "egito", papel: "lider" },
  {
    id: "aaronEgito",
    nome: "Arão",
    area: "egito",
    x: 13,
    y: 52,
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
  { id: "araoMar", nome: "Arão", area: "marVermelho", x: 9, y: 52, capitulo: "marVermelho", papel: "lider" },
  { id: "josueSinai", nome: "Josué", area: "sinai", x: 9, y: 52, capitulo: "sinai", papel: "lider" },
  {
    id: "pedroGalileia",
    nome: "Pedro",
    area: "galileia",
    x: 9,
    y: 52,
    capitulo: "galileia",
    papel: "lider",
  },
  {
    id: "jesusGalileia",
    nome: "Jesus",
    area: "galileia",
    x: 14,
    y: 51,
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
  { id: "atalaia_canaa", nome: "Atalaia, vigia de Canaã", area: "canaan", x: 7, y: 8, papel: "mural", requer: { missao: "ervas" } },
  {
    id: "atalaia_deserto",
    nome: "Atalaia, vigia do Deserto",
    area: "deserto",
    x: 69,
    y: 12,
    papel: "mural",
    requer: { missao: "deserto" },
  },
  { id: "atalaia_egito", nome: "Atalaia, vigia do Egito", area: "egito", x: 8, y: 55, papel: "mural", requer: { missao: "egito" } },
  {
    id: "atalaia_mar",
    nome: "Atalaia, vigia do Mar Vermelho",
    area: "marVermelho",
    x: 7,
    y: 55,
    papel: "mural",
    requer: { missao: "marVermelho" },
  },
  { id: "atalaia_sinai", nome: "Atalaia, vigia do Sinai", area: "sinai", x: 7, y: 55, papel: "mural", requer: { missao: "sinai" } },
  {
    id: "atalaia_galileia",
    nome: "Atalaia, vigia da Galileia",
    area: "galileia",
    x: 8,
    y: 55,
    papel: "mural",
    requer: { missao: "galileia" },
  },
];
