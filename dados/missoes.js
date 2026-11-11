// =====================================================================
// dados/missoes.js — missões (Canaã, Deserto e capítulos), em ordem
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// O motor de missões (logica.js) lê estes dados; nenhuma missão é escrita como código.
// =====================================================================

// Campos de uma missão:
//   id: identificador (nos capítulos, igual à chave do capítulo em dados/capitulos.js);
//   npc: quem dá e recebe a missão (npcEntrega opcional, se outro NPC receber);
//   anterior: id da missão que precisa estar concluída antes (opcional);
//   modelo: nome de um modelo em MODELOS_MISSAO cujos textos servem de padrão (opcional);
//   proxima: missão citada no painel depois da conclusão (padrão: a que tem esta como anterior);
//   sinalAoIniciar: campo true devolvido à interface quando a missão começa (opcional);
//   falas (do NPC): inicio, concluida, bloqueada, subiuNivel (anexada se o jogador subir de nível);
//   painel (texto curto da UI): inicio, bloqueada, concluida, encerrada (quando a "proxima" já acabou);
//   etapas: lista em ordem, cada uma com objetivos, recompensa { xp, moedas, itens }, painel
//     { andamento, retorno } e falas { andamento, faltamItens, mochilaCheia, concluir }.
//
// Tipos de objetivo:
//   { tipo: "derrotar", criatura, quantidade?, aviso?, repetirAviso? } — abates da criatura;
//   { tipo: "coletar", item, quantidade, origem: "mapa" | "saque", reaparecer? } — cada coletável
//     do mapa ou saque é contado uma vez pelo seu id; reaparecer: os coletáveis do mapa voltam
//     quando a etapa começa; saques de "saque" não expiram enquanto a etapa estiver aberta;
//   { tipo: "entregar", item, quantidade } — exige os itens na mochila e os remove na entrega;
//   { tipo: "falar", npc, aviso? } — conversar com outro NPC;
//   { tipo: "chegar", area, x?, y?, raio?, aviso? } — entrar na área (ou chegar perto de x, y).
//   aviso: frase anexada à mensagem do jogo quando o objetivo é cumprido.
//
// Variáveis nas falas e no painel: {coletados} e {total} (primeiro objetivo com quantidade),
// {naMochila} (itens do primeiro objetivo "entregar" na mochila), {nivel}, {npc} (nome de quem
// recebe), {etapa}, {etapas}, {peso}, {capacidade}, {recompensa} (resumo da recompensa) e
// {proximaArea} (área da missão seguinte).

const MODELOS_MISSAO = {
  capitulo: {
    falas: {
      bloqueada: "Conclua primeiro o capítulo anterior para chegar a esta etapa.",
      subiuNivel: " Você subiu ao nível {nivel}.",
    },
    painel: {
      inicio: "Fale com {npc} para iniciar.",
      bloqueada: "Conclua o capítulo anterior para avançar aqui.",
      concluida: "Capítulo concluído. Siga a rota a leste até {proximaArea}.",
      encerrada: "Capítulo concluído.",
    },
    etapa: {
      painel: { retorno: "Objetivo cumprido. Volte a {npc}." },
      falas: { mochilaCheia: "Sua mochila está cheia ({peso}/{capacidade} kg). Libere espaço para receber a recompensa." },
      aviso: "Objetivo concluído: volte a {npc}.",
    },
  },
};

const DADOS_MISSOES = [
  // ------------------------------------------------------------------- Canaã
  {
    id: "lobo",
    nome: "O lobo da estrada",
    npc: "viajante1",
    falas: {
      inicio: "Um lobo ronda a estrada a sudeste e ameaça os viajantes. Afaste-o e volte para falar comigo.",
      subiuNivel: " Você subiu para o nível {nivel}!",
    },
    painel: { inicio: "Fale com Eliabe, na vila ao lado do ponto de partida." },
    etapas: [
      {
        objetivos: [{ tipo: "derrotar", criatura: "lobo1", aviso: "Volte a Eliabe.", repetirAviso: true }],
        recompensa: { xp: 50, moedas: 0, itens: ["pocao", "pocao", "espada_ferro"] },
        painel: {
          andamento: "Derrote o lobo a sudeste da vila e volte a Eliabe.",
          retorno: "Volte a Eliabe para receber a recompensa.",
        },
        falas: {
          andamento: "O lobo ainda ronda a estrada. Encontre-o a sudeste e volte quando conseguir.",
          mochilaCheia: "Sua mochila está cheia. Libere espaço para receber 2 poções e uma espada de ferro.",
          concluir: "Obrigado! Receba 2 poções, uma espada de ferro (+12 de dano) e 50 XP. Missão concluída!",
        },
      },
    ],
  },
  {
    id: "ervas",
    nome: "Ervas para os feridos",
    npc: "viajante1",
    anterior: "lobo",
    proxima: "deserto",
    sinalAoIniciar: "missaoErvasIniciada",
    falas: {
      inicio: "Há viajantes feridos na vila. Preciso de 3 ervas medicinais; colete três e volte.",
      concluida: "Obrigado por ajudar os viajantes. Você concluiu as tarefas de Canaã.",
      subiuNivel: " Você subiu para o nível {nivel}!",
    },
    painel: {
      inicio: "Fale com Eliabe para a próxima tarefa.",
      concluida: "Tarefas de Canaã concluídas. Siga a trilha (sudeste) ou fale com Micael para ir ao Deserto.",
      encerrada: "Tarefas de Canaã concluídas.",
    },
    etapas: [
      {
        objetivos: [
          { tipo: "coletar", item: "erva", quantidade: 3, origem: "mapa", reaparecer: true },
          { tipo: "entregar", item: "erva", quantidade: 3 },
        ],
        recompensa: { xp: 80, moedas: 0, itens: ["pocao", "pocao"] },
        painel: { andamento: "Colete ervas medicinais: {coletados}/{total}.", retorno: "Leve as 3 ervas a Eliabe." },
        falas: {
          andamento: "Ainda faltam ervas. Você coletou {coletados}/{total} para esta missão.",
          faltamItens:
            "Preciso que você traga as {total} ervas na mochila (você tem {naMochila}). As plantas brotam de novo em alguns segundos.",
          mochilaCheia: "Sua mochila está cheia. Libere espaço para receber as poções.",
          concluir: "Que Deus o recompense! Receba 2 poções e 80 XP. Missão concluída!",
        },
      },
    ],
  },

  // ------------------------------------------------------------------- Deserto
  {
    id: "deserto",
    nome: "A caravana do deserto",
    npc: "noemi1",
    sinalAoIniciar: "missaoDesertoIniciada",
    falas: {
      inicio: "A caravana precisa de água. Encontre 3 odres espalhados pelo deserto e traga-os para mim.",
      concluida: "A caravana está segura graças a você. Que o Senhor guarde o seu caminho.",
      subiuNivel: " Nível {nivel}!",
    },
    painel: {
      inicio: "Encontre Noemi no acampamento a nordeste.",
      concluida: "Capítulo concluído. Siga a rota a leste da trilha até {proximaArea}.",
      encerrada: "Capítulo do Deserto concluído.",
    },
    etapas: [
      {
        objetivos: [
          { tipo: "coletar", item: "odre_agua", quantidade: 3, origem: "mapa", reaparecer: true },
          { tipo: "entregar", item: "odre_agua", quantidade: 3 },
        ],
        recompensa: {
          xp: 100,
          moedas: 0,
          itens: ["pocao", "pocao", "armadura_couro", "arco_madeira", "flecha", "flecha", "flecha", "flecha", "flecha", "flecha", "flecha", "flecha"],
        },
        painel: { andamento: "Etapa {etapa}/{etapas} · Encontre odres de água: {coletados}/{total}." },
        falas: {
          andamento: "Ainda faltam odres. Você encontrou {coletados}/{total}.",
          faltamItens: "Traga os {total} odres na mochila (você tem {naMochila}).",
          mochilaCheia: "Sua mochila está cheia. Libere espaço para receber poções, armadura, arco e flechas.",
          concluir:
            "A água salvou a caravana! Receba 2 poções, armadura de couro, arco, 8 flechas e 100 XP. Agora derrote o escorpião a noroeste e traga 2 amostras do veneno.",
        },
      },
      {
        objetivos: [
          { tipo: "coletar", item: "veneno_escorpiao", quantidade: 2, origem: "saque" },
          { tipo: "entregar", item: "veneno_escorpiao", quantidade: 2 },
        ],
        recompensa: { xp: 100, moedas: 25, itens: [] },
        painel: { andamento: "Etapa {etapa}/{etapas} · Veneno de escorpião: {coletados}/{total}." },
        falas: {
          andamento: "Derrote o escorpião e pegue o veneno que ele deixa. Amostras: {coletados}/{total}.",
          faltamItens: "Preciso das {total} amostras na mochila (você tem {naMochila}). O escorpião volta em alguns segundos.",
          concluir:
            "Com o veneno prepararemos um antídoto. Receba 25 moedas e 100 XP. Os saqueadores ameaçam o acampamento: derrote o chefe ao sul e traga a insígnia dele. Etapa final!",
        },
      },
      {
        objetivos: [
          { tipo: "coletar", item: "insignia_bandido", quantidade: 1, origem: "saque" },
          { tipo: "entregar", item: "insignia_bandido", quantidade: 1 },
        ],
        recompensa: { xp: 180, moedas: 100, itens: [] },
        painel: { andamento: "Etapa {etapa}/{etapas} · Insígnia do chefe dos saqueadores: {coletados}/{total}." },
        falas: {
          andamento: "Encontre o chefe dos saqueadores ao sul, derrote-o e traga a insígnia que ele deixar.",
          faltamItens: "Traga a insígnia na mochila para provar que o bando foi vencido.",
          concluir:
            "A caravana está segura! Receba 100 moedas e 180 XP. Capítulo do Deserto concluído! A rota a leste da trilha leva ao Egito.",
        },
      },
    ],
  },

  // ------------------------------------------------------------------- Capítulos
  {
    id: "egito",
    nome: "A saída do Egito",
    npc: "moisesEgito",
    anterior: "deserto",
    modelo: "capitulo",
    falas: {
      inicio:
        "O Senhor ouviu o clamor do povo no Egito. Um guarda de Faraó vigia a trilha central e impede a saída das famílias. Afaste-o e volte a mim.",
      concluida: "O Senhor vai adiante de nós. Siga a rota a leste até o Mar Vermelho.",
    },
    etapas: [
      {
        objetivos: [{ tipo: "derrotar", criatura: "soldadoEgito1" }],
        recompensa: { xp: 160, moedas: 30, itens: ["escudo_bronze", "pocao", "pocao"] },
        painel: { andamento: "Afaste o guarda egípcio na trilha central e volte a Moisés." },
        falas: {
          andamento: "O guarda egípcio ainda bloqueia a trilha central. Seja firme e volte quando o caminho estiver livre.",
          concluir:
            "O caminho está livre! O povo parte esta noite, como o Senhor ordenou. Leve este escudo de bronze. Recompensa: {recompensa}.",
        },
      },
    ],
  },
  {
    id: "marVermelho",
    nome: "A travessia do mar",
    npc: "araoMar",
    anterior: "egito",
    modelo: "capitulo",
    falas: {
      inicio:
        "O mar se abriu diante de nós, mas soldados de Faraó perseguem a retaguarda. Proteja os últimos da fila durante a travessia e volte a mim.",
      concluida: "Miriã e as mulheres cantam ao Senhor com tamborins. Siga a leste até o Monte Sinai.",
    },
    etapas: [
      {
        objetivos: [{ tipo: "derrotar", criatura: "perseguidorMar1" }],
        recompensa: { xp: 220, moedas: 40, itens: ["espada_temperada", "pocao", "pocao"] },
        painel: { andamento: "Proteja a retaguarda: vença o soldado perseguidor e volte a Arão." },
        falas: {
          andamento: "O soldado perseguidor ainda ameaça a retaguarda, na trilha central. Não tema: o Senhor peleja por nós.",
          concluir:
            "O povo atravessou em terra seca! Entre as armas que o mar deixou na praia havia esta espada temperada; ela é sua. Recompensa: {recompensa}.",
        },
      },
    ],
  },
  {
    id: "sinai",
    nome: "A batalha de Refidim",
    npc: "josueSinai",
    anterior: "marVermelho",
    modelo: "capitulo",
    falas: {
      inicio:
        "Em Refidim, os amalequitas atacaram os que vinham cansados. Moisés ora no alto do monte com as mãos erguidas; ajude-me a defender o acampamento e volte a mim.",
      concluida: "O povo acampa ao pé do monte para receber a Lei. A rota a leste segue para a Galileia.",
    },
    etapas: [
      {
        objetivos: [{ tipo: "derrotar", criatura: "guardiaoSinai1" }],
        recompensa: {
          xp: 260,
          moedas: 50,
          itens: ["arco_composto", "flecha", "flecha", "flecha", "flecha", "flecha", "flecha", "flecha", "flecha", "flecha", "flecha"],
        },
        painel: { andamento: "Defenda o acampamento: vença o guerreiro amalequita e volte a Josué." },
        falas: {
          andamento:
            "O guerreiro amalequita ainda ronda o desfiladeiro. Enquanto as mãos de Moisés estiverem erguidas, não desanime.",
          concluir:
            "Vitória! Moisés ergueu um altar e o chamou: “O Senhor é a minha bandeira”. Leve este arco composto e flechas. Recompensa: {recompensa}.",
        },
      },
    ],
  },
  {
    id: "galileia",
    nome: "A estrada do lago",
    npc: "pedroGalileia",
    anterior: "sinai",
    modelo: "capitulo",
    falas: {
      inicio:
        "A paz esteja com você! Um salteador ataca quem vem à beira do lago para ouvir o Mestre. Ajude a proteger a estrada e volte a mim.",
      concluida: "Ouça o Mestre: ele ensina a orar e a cuidar dos que sofrem.",
    },
    etapas: [
      {
        objetivos: [{ tipo: "derrotar", criatura: "ameaçaGalileia1" }],
        recompensa: { xp: 300, moedas: 60, itens: ["pocao", "pocao", "pocao_fe", "pocao_fe"] },
        painel: { andamento: "Proteja a estrada: vença o salteador na trilha central e volte a Pedro." },
        falas: {
          andamento: "O salteador ainda está na trilha central. Tenha cuidado, e volte quando a estrada estiver segura.",
          concluir: "A estrada está segura! O Mestre quer falar com você; vá até ele. Recompensa: {recompensa}.",
        },
      },
    ],
  },
];
