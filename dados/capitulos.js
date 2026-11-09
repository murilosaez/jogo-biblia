// =====================================================================
// dados/capitulos.js — capítulos da campanha (em ordem)
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// npc: líder que dá a missão; inimigo: alvo que conclui o objetivo; mestre: quem ensina a
// Oração; recompensa { xp, moedas, itens }; falas: inicio, andamento, retorno, concluido.
const DADOS_CAPITULOS = [
  {
    chave: "egito",
    nome: "Egito",
    anterior: "deserto",
    npc: "moisesEgito",
    inimigo: "soldadoEgito1",
    objetivo: "Afaste o guarda egípcio na trilha central e volte a Moisés.",
    recompensa: { xp: 160, moedas: 30, itens: ["escudo_bronze", "pocao", "pocao"] },
    falas: {
      inicio:
        "O Senhor ouviu o clamor do povo no Egito. Um guarda de Faraó vigia a trilha central e impede a saída das famílias. Afaste-o e volte a mim.",
      andamento: "O guarda egípcio ainda bloqueia a trilha central. Seja firme e volte quando o caminho estiver livre.",
      retorno: "O caminho está livre! O povo parte esta noite, como o Senhor ordenou. Leve este escudo de bronze.",
      concluido: "O Senhor vai adiante de nós. Siga a rota a leste até o Mar Vermelho.",
    },
  },
  {
    chave: "marVermelho",
    nome: "Mar Vermelho",
    anterior: "egito",
    npc: "araoMar",
    inimigo: "perseguidorMar1",
    objetivo: "Proteja a retaguarda: vença o soldado perseguidor e volte a Arão.",
    recompensa: { xp: 220, moedas: 40, itens: ["espada_temperada", "pocao", "pocao"] },
    falas: {
      inicio:
        "O mar se abriu diante de nós, mas soldados de Faraó perseguem a retaguarda. Proteja os últimos da fila durante a travessia e volte a mim.",
      andamento:
        "O soldado perseguidor ainda ameaça a retaguarda, na trilha central. Não tema: o Senhor peleja por nós.",
      retorno:
        "O povo atravessou em terra seca! Entre as armas que o mar deixou na praia havia esta espada temperada; ela é sua.",
      concluido: "Miriã e as mulheres cantam ao Senhor com tamborins. Siga a leste até o Monte Sinai.",
    },
  },
  {
    chave: "sinai",
    nome: "Monte Sinai",
    anterior: "marVermelho",
    npc: "josueSinai",
    inimigo: "guardiaoSinai1",
    objetivo: "Defenda o acampamento: vença o guerreiro amalequita e volte a Josué.",
    recompensa: { xp: 260, moedas: 50, itens: ["arco_composto", ...Array(10).fill("flecha")] },
    falas: {
      inicio:
        "Em Refidim, os amalequitas atacaram os que vinham cansados. Moisés ora no alto do monte com as mãos erguidas; ajude-me a defender o acampamento e volte a mim.",
      andamento:
        "O guerreiro amalequita ainda ronda o desfiladeiro. Enquanto as mãos de Moisés estiverem erguidas, não desanime.",
      retorno:
        "Vitória! Moisés ergueu um altar e o chamou: “O Senhor é a minha bandeira”. Leve este arco composto e flechas.",
      concluido: "O povo acampa ao pé do monte para receber a Lei. A rota a leste segue para a Galileia.",
    },
  },
  {
    chave: "galileia",
    nome: "Galileia",
    anterior: "sinai",
    npc: "pedroGalileia",
    inimigo: "ameaçaGalileia1",
    mestre: "jesusGalileia",
    objetivo: "Proteja a estrada: vença o salteador na trilha central e volte a Pedro.",
    recompensa: { xp: 300, moedas: 60, itens: ["pocao", "pocao", "pocao_fe", "pocao_fe"] },
    falas: {
      inicio:
        "A paz esteja com você! Um salteador ataca quem vem à beira do lago para ouvir o Mestre. Ajude a proteger a estrada e volte a mim.",
      andamento: "O salteador ainda está na trilha central. Tenha cuidado, e volte quando a estrada estiver segura.",
      retorno: "A estrada está segura! O Mestre quer falar com você; vá até ele.",
      concluido: "Ouça o Mestre: ele ensina a orar e a cuidar dos que sofrem.",
    },
  },
];
