// =====================================================================
// expansao.js — DADOS dos capítulos Egito, Mar Vermelho, Monte Sinai e
// Galileia. Carregado depois de logica.js. Este arquivo só registra áreas,
// mapas, NPCs, inimigos, capítulos e portais; toda a regra fica em logica.js.
// =====================================================================

const NOVAS_AREAS = {
  egito: { id: "egito", nome: "Egito", bioma: "nilo" },
  marVermelho: { id: "marVermelho", nome: "Mar Vermelho", bioma: "costa" },
  sinai: { id: "sinai", nome: "Monte Sinai", bioma: "montanha" },
  galileia: { id: "galileia", nome: "Galileia", bioma: "galileia" },
};

// Obstáculos de cada região (padrões determinísticos).
const PADROES_OBSTACULO = {
  egito: (x, y) => (x * 13 + y * 17) % 29 === 0,
  marVermelho: (x, y) => (x * 11 + y * 19) % 37 === 0,
  sinai: (x, y) => (x * 7 + y * 13) % 17 === 0,
  galileia: (x, y) => (x * 5 + y * 23) % 31 === 0,
};

function criarMapaCapitulo(id) {
  const mapa = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => {
      const borda = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      return borda || PADROES_OBSTACULO[id](x, y) ? 1 : 0;
    }),
  );
  // Estrada principal (linha 56) e trilha central (linha 30).
  for (let x = 1; x < COLS - 1; x++) mapa[56][x] = 0;
  for (let x = 2; x < COLS - 2; x++) mapa[30][x] = 0;
  return mapa;
}

for (const area of Object.values(NOVAS_AREAS)) {
  registrarArea({ ...area, inicio: { x: 4, y: 56 } }, criarMapaCapitulo(area.id));
}

// ---------------------------------------------------------------------
// Capítulos: líder (dá a missão), inimigo-alvo, recompensa e falas.
// ---------------------------------------------------------------------
registrarCapitulo("egito", {
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
});

registrarCapitulo("marVermelho", {
  nome: "Mar Vermelho",
  anterior: "egito",
  npc: "araoMar",
  inimigo: "perseguidorMar1",
  objetivo: "Proteja a retaguarda: vença o soldado perseguidor e volte a Arão.",
  recompensa: { xp: 220, moedas: 40, itens: ["espada_temperada", "pocao", "pocao"] },
  falas: {
    inicio:
      "O mar se abriu diante de nós, mas soldados de Faraó perseguem a retaguarda. Proteja os últimos da fila durante a travessia e volte a mim.",
    andamento: "O soldado perseguidor ainda ameaça a retaguarda, na trilha central. Não tema: o Senhor peleja por nós.",
    retorno:
      "O povo atravessou em terra seca! Entre as armas que o mar deixou na praia havia esta espada temperada; ela é sua.",
    concluido: "Miriã e as mulheres cantam ao Senhor com tamborins. Siga a leste até o Monte Sinai.",
  },
});

registrarCapitulo("sinai", {
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
});

registrarCapitulo("galileia", {
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
});

// ---------------------------------------------------------------------
// NPCs (vilas perto da chegada, longe dos inimigos)
// ---------------------------------------------------------------------
const NOVOS_NPCS = {
  moisesEgito: { id: "moisesEgito", nome: "Moisés", area: "egito", x: 9, y: 52, capitulo: "egito", papel: "lider" },
  aaronEgito: {
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
  araoMar: { id: "araoMar", nome: "Arão", area: "marVermelho", x: 9, y: 52, capitulo: "marVermelho", papel: "lider" },
  josueSinai: { id: "josueSinai", nome: "Josué", area: "sinai", x: 9, y: 52, capitulo: "sinai", papel: "lider" },
  pedroGalileia: {
    id: "pedroGalileia",
    nome: "Pedro",
    area: "galileia",
    x: 9,
    y: 52,
    capitulo: "galileia",
    papel: "lider",
  },
  jesusGalileia: {
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
};
for (const npc of Object.values(NOVOS_NPCS)) registrarNpc(npc);

// ---------------------------------------------------------------------
// Inimigos dos capítulos (dificuldade crescente)
// ---------------------------------------------------------------------
const NOVOS_INIMIGOS = {
  soldadoEgito1: {
    id: "soldadoEgito1",
    nome: "Guarda egípcio",
    aparencia: "soldado",
    area: "egito",
    x: 34,
    y: 31,
    vidaMaxima: 250,
    danoContraJogador: 10,
    defesa: 8,
    raioPercepcao: 6,
    xpRecompensa: 100,
    saque: { itens: [], moedas: 18 },
  },
  perseguidorMar1: {
    id: "perseguidorMar1",
    nome: "Soldado perseguidor",
    aparencia: "soldado",
    area: "marVermelho",
    x: 36,
    y: 31,
    vidaMaxima: 310,
    danoContraJogador: 11,
    defesa: 10,
    raioPercepcao: 7,
    xpRecompensa: 130,
    saque: { itens: [], moedas: 22 },
  },
  guardiaoSinai1: {
    id: "guardiaoSinai1",
    nome: "Guerreiro amalequita",
    aparencia: "guerreiro",
    area: "sinai",
    x: 39,
    y: 31,
    vidaMaxima: 400,
    danoContraJogador: 11,
    defesa: 12,
    raioPercepcao: 7,
    xpRecompensa: 160,
    saque: { itens: [], moedas: 26 },
  },
  // O id com "ç" foi mantido para não invalidar saves existentes.
  ameaçaGalileia1: {
    id: "ameaçaGalileia1",
    nome: "Salteador da estrada",
    aparencia: "bandido",
    area: "galileia",
    x: 38,
    y: 31,
    vidaMaxima: 470,
    danoContraJogador: 11,
    defesa: 14,
    raioPercepcao: 7,
    xpRecompensa: 190,
    saque: { itens: [], moedas: 30 },
  },
};
for (const inimigo of Object.values(NOVOS_INIMIGOS)) registrarInimigo(inimigo);

// ---------------------------------------------------------------------
// Portais entre regiões (os de ida exigem o capítulo anterior concluído)
// ---------------------------------------------------------------------
registrarPortal({
  area: "deserto",
  x: 77,
  y: 56,
  destino: "egito",
  chegada: { x: 4, y: 56 },
  capitulo: "egito",
  texto: "Rota para o Egito",
});
registrarPortal({
  area: "egito",
  x: 2,
  y: 56,
  destino: "deserto",
  chegada: { x: 75, y: 56 },
  texto: "Volta ao Deserto",
});
registrarPortal({
  area: "egito",
  x: 77,
  y: 56,
  destino: "marVermelho",
  chegada: { x: 4, y: 56 },
  capitulo: "marVermelho",
  texto: "Travessia do Mar Vermelho",
});
registrarPortal({
  area: "marVermelho",
  x: 2,
  y: 56,
  destino: "egito",
  chegada: { x: 75, y: 56 },
  texto: "Volta ao Egito",
});
registrarPortal({
  area: "marVermelho",
  x: 77,
  y: 56,
  destino: "sinai",
  chegada: { x: 4, y: 56 },
  capitulo: "sinai",
  texto: "Caminho do Sinai",
});
registrarPortal({
  area: "sinai",
  x: 2,
  y: 56,
  destino: "marVermelho",
  chegada: { x: 75, y: 56 },
  texto: "Volta ao Mar Vermelho",
});
registrarPortal({
  area: "sinai",
  x: 77,
  y: 56,
  destino: "galileia",
  chegada: { x: 4, y: 56 },
  capitulo: "galileia",
  texto: "Rota para a Galileia",
});
registrarPortal({
  area: "galileia",
  x: 2,
  y: 56,
  destino: "sinai",
  chegada: { x: 75, y: 56 },
  texto: "Volta ao Sinai",
});
