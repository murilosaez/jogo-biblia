// =====================================================================
// dados/vocacoes.js — vocações, habilidades e especializações (JGB-20)
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// revisao-teologica: pendente (nomes, textos e referências bíblicas)
// =====================================================================

// Regras gerais.
//   nivelEscolha: nível em que se escolhe a vocação (em qualquer lugar, pela janela Vocação, tecla V);
//   nivelEspecializacao: nível em que se escolhe uma das duas especializações da vocação;
//   trocasGratis e precoTroca: trocar de vocação só com o mestre de vocações (papel "vocacao" em dados/npcs.js);
//     as primeiras trocasGratis são grátis, as outras custam precoTroca moedas. Trocar zera a especialização;
//   recargaGlobal: ms entre uma ação e outra (golpe, flecha ou habilidade), além da recarga de cada habilidade;
//   barra: espaços da barra de habilidades (teclas 1 a 8);
//   magia: o dano mágico (Levita e Profeta) = base + porNivel × (nível − 1), e passa por defesa × fatorDefesa;
//     o crítico mágico usa a chance da distância;
//   aliados: o cão e as ovelhas do Pastor.
//     cao — segue você e morde o seu alvo (ou a criatura mais perto que esteja lutando com você, até alcanceBusca
//       casas); dano = danoBase + danoPorNivel × (nível − 1); some depois de duracao ms ou ao trocar de área;
//       as criaturas não o atacam;
//     ovelha — fica parada onde surgiu, com vida = vidaPercentual × a sua vida máxima; as criaturas a até
//       raioIsca casas dela atacam a ovelha em vez de você, até ela cair ou sumir (duracao).
const REGRAS_VOCACAO = {
  nivelEscolha: 8,
  nivelEspecializacao: 50,
  trocasGratis: 1,
  precoTroca: 150,
  recargaGlobal: 800,
  barra: 8,
  magia: { base: 5, porNivel: 3, fatorDefesa: 0.5 },
  aliados: {
    cao: { nome: "Cão pastor", danoBase: 4, danoPorNivel: 1.5, intervaloAtaque: 1500, intervaloMovimento: 350, duracao: 60000, alcanceBusca: 6 },
    ovelha: { nome: "Ovelha", vidaPercentual: 0.3, defesa: 2, raioIsca: 4, duracao: 12000 },
  },
};

// Habilidades. Campos:
//   nome, nivel (em que nível abre), recarga (ms), icone (glifo "hb_<icone>" em sprites.js), descricao;
//   alvo: "inimigo" (precisa de uma criatura viva a até alcance casas; 1 = ao lado; a distância e a magia
//     precisam do caminho livre) ou "si" (em você; o que tiver area acontece em volta de você);
//   dano: { tipo: "corpo" | "distancia" | "magia", mult, area (raio em volta do alvo ou de você), golpes };
//     "distancia" precisa da funda ou do arco nas mãos (o arco gasta uma flecha por golpe);
//   bonus: { status, mult, consome } — combinação: contra quem tem o status, o dano × mult (consome: tira o status);
//   status: { tipo, ...ajustes } — aplicado em quem o golpe atinge (com area, em todos dentro dela);
//   cura: { vida } — fração da sua vida máxima; aliados: true cura também o cão e as ovelhas;
//   purificar: true — tira de você veneno, sangramento, atordoamento e medo;
//   buff: { duracao, defesa (somada), dano (× seus golpes e habilidades), critico (% somado), reducao (fração do
//     dano recebido que some), escudo (fração da vida máxima que absorve golpes), regen ({ vida, intervalo }),
//     aliados (× dano dos aliados) };
//   movimento: "investida" (vai até o lado do alvo antes do golpe), { recuo: n } (salta n casas para longe da
//     criatura mais próxima) ou { repelir: n } (empurra n casas as criaturas atingidas);
//   invocar: { tipo: "cao" | "ovelha", quantidade };
//   cao: { mult, status } — o cão morde o seu alvo agora (precisa do cão por perto).
// As referências entre parênteses na descrição são só inspiração; o efeito é de jogo.
const HABILIDADES_VOCACAO = {
  // ----- Guerreiro (Valente de Davi): tanque, corpo a corpo -----
  golpe_firme: {
    nome: "Golpe firme", nivel: 8, recarga: 6000, icone: "espada", alvo: "inimigo", alcance: 1,
    dano: { tipo: "corpo", mult: 1.6 },
    descricao: "Um golpe pesado: 160% do dano corpo a corpo.",
  },
  escudo_erguido: {
    nome: "Escudo erguido", nivel: 8, recarga: 15000, icone: "escudo", alvo: "si",
    buff: { duracao: 6000, defesa: 8 },
    descricao: "+8 de defesa por 6 s.",
  },
  grito_de_guerra: {
    nome: "Grito de guerra", nivel: 10, recarga: 20000, icone: "grito", alvo: "si",
    dano: { tipo: "corpo", mult: 0.4, area: 2 }, status: { tipo: "medo" },
    descricao: "Assusta as criaturas a até 2 casas (medo: fogem e levam +25% de dano).",
  },
  golpe_de_escudo: {
    nome: "Golpe de escudo", nivel: 12, recarga: 12000, icone: "escudo_golpe", alvo: "inimigo", alcance: 1,
    dano: { tipo: "corpo", mult: 1 }, status: { tipo: "atordoamento", duracao: 1500 },
    descricao: "Atordoa o alvo por 1,5 s: os golpes seguintes nele são críticos.",
  },
  investida_do_valente: {
    nome: "Investida do valente", nivel: 15, recarga: 14000, icone: "investida", alvo: "inimigo", alcance: 4,
    movimento: "investida", dano: { tipo: "corpo", mult: 1.3 }, status: { tipo: "atordoamento", duracao: 1000 },
    descricao: "Avança até o alvo (até 4 casas), golpeia com 130% e atordoa por 1 s.",
  },
  redemoinho: {
    nome: "Redemoinho", nivel: 20, recarga: 10000, icone: "redemoinho", alvo: "si",
    dano: { tipo: "corpo", mult: 1.2, area: 1 },
    descricao: "Golpeia todas as criaturas ao seu lado com 120%.",
  },
  ultimo_bastiao: {
    nome: "Último bastião", nivel: 25, recarga: 60000, icone: "coracao", alvo: "si",
    cura: { vida: 0.3 }, buff: { duracao: 5000, defesa: 15 },
    descricao: "Recupera 30% da vida e ganha +15 de defesa por 5 s.",
  },
  furia_de_davi: {
    nome: "Fúria de Davi", nivel: 50, recarga: 45000, icone: "chama", alvo: "si",
    buff: { duracao: 8000, dano: 1.5 },
    descricao: "Seus golpes e habilidades causam +50% por 8 s.",
  },
  muralha: {
    nome: "Muralha", nivel: 50, recarga: 45000, icone: "muralha", alvo: "si",
    buff: { duracao: 6000, reducao: 0.5 }, status: { tipo: "medo" }, dano: { tipo: "corpo", mult: 0.3, area: 2 },
    descricao: "Recebe metade do dano por 6 s e assusta as criaturas a até 2 casas.",
  },

  // ----- Fundibulário (Benjamita): dano à distância com a funda -----
  pedra_certeira: {
    nome: "Pedra certeira", nivel: 8, recarga: 6000, icone: "pedra", alvo: "inimigo", alcance: 6,
    dano: { tipo: "distancia", mult: 1.6 }, bonus: { status: "atordoamento", mult: 2 },
    descricao: "160% do dano à distância; o dobro em quem está atordoado.",
  },
  pedra_na_testa: {
    nome: "Pedra na testa", nivel: 8, recarga: 12000, icone: "testa", alvo: "inimigo", alcance: 6,
    dano: { tipo: "distancia", mult: 1 }, status: { tipo: "atordoamento" },
    descricao: "Atordoa o alvo por 1,2 s (1 Sm 17:49). Combine com a Pedra certeira.",
  },
  recuo_agil: {
    nome: "Recuo ágil", nivel: 10, recarga: 10000, icone: "salto", alvo: "si",
    movimento: { recuo: 3 },
    descricao: "Salta até 3 casas para longe da criatura mais próxima.",
  },
  chuva_de_pedras: {
    nome: "Chuva de pedras", nivel: 12, recarga: 12000, icone: "chuva", alvo: "inimigo", alcance: 6,
    dano: { tipo: "distancia", mult: 0.8, area: 1 },
    descricao: "80% do dano à distância no alvo e em quem estiver ao lado dele.",
  },
  pedra_afiada: {
    nome: "Pedra afiada", nivel: 15, recarga: 8000, icone: "pedra_afiada", alvo: "inimigo", alcance: 6,
    dano: { tipo: "distancia", mult: 0.9 }, status: { tipo: "sangramento" },
    descricao: "90% do dano à distância e sangramento (as feridas somam).",
  },
  mao_esquerda: {
    nome: "Mão esquerda", nivel: 20, recarga: 10000, icone: "duas_pedras", alvo: "inimigo", alcance: 6,
    dano: { tipo: "distancia", mult: 0.9, golpes: 2 },
    descricao: "Duas pedras seguidas de 90% cada (Jz 20:16).",
  },
  olho_de_aguia: {
    nome: "Olho de águia", nivel: 25, recarga: 40000, icone: "olho", alvo: "si",
    buff: { duracao: 8000, critico: 25 },
    descricao: "+25% de chance de crítico por 8 s.",
  },
  pedra_de_golias: {
    nome: "Pedra de Golias", nivel: 50, recarga: 45000, icone: "pedra_grande", alvo: "inimigo", alcance: 6,
    dano: { tipo: "distancia", mult: 4 }, bonus: { status: "atordoamento", mult: 1.5, consome: true },
    descricao: "400% do dano à distância; +50% em quem está atordoado (o atordoamento acaba).",
  },
  saraivada: {
    nome: "Saraivada", nivel: 50, recarga: 45000, icone: "chuva", alvo: "inimigo", alcance: 6,
    dano: { tipo: "distancia", mult: 1.2, area: 2 }, status: { tipo: "medo" },
    descricao: "120% em todas as criaturas a até 2 casas do alvo, que ficam com medo.",
  },

  // ----- Levita: cura e suporte -----
  bencao: {
    nome: "Bênção", nivel: 8, recarga: 8000, icone: "cura", alvo: "si",
    cura: { vida: 0.25, aliados: true },
    descricao: "Recupera 25% da vida (também do cão e das ovelhas).",
  },
  luz_do_candelabro: {
    nome: "Luz do candelabro", nivel: 8, recarga: 5000, icone: "candelabro", alvo: "inimigo", alcance: 5,
    dano: { tipo: "magia", mult: 1.3 },
    descricao: "Dano mágico de 130% a até 5 casas.",
  },
  incenso: {
    nome: "Incenso", nivel: 10, recarga: 20000, icone: "incenso", alvo: "si",
    buff: { duracao: 8000, regen: { vida: 0.04, intervalo: 1000 } },
    descricao: "Recupera 4% da vida a cada segundo por 8 s.",
  },
  purificacao: {
    nome: "Purificação", nivel: 12, recarga: 15000, icone: "agua", alvo: "si",
    purificar: true, cura: { vida: 0.1 },
    descricao: "Tira veneno, sangramento, atordoamento e medo e recupera 10% da vida.",
  },
  toque_do_shofar: {
    nome: "Toque do shofar", nivel: 15, recarga: 20000, icone: "trombeta", alvo: "si",
    dano: { tipo: "magia", mult: 0.5, area: 2 }, status: { tipo: "atordoamento" },
    descricao: "Atordoa as criaturas a até 2 casas por 1,2 s (Js 6:20).",
  },
  escudo_da_fe: {
    nome: "Escudo da fé", nivel: 20, recarga: 30000, icone: "escudo_luz", alvo: "si",
    buff: { duracao: 8000, escudo: 0.3 },
    descricao: "Um escudo que absorve golpes até 30% da sua vida máxima, por 8 s.",
  },
  bencao_sacerdotal: {
    nome: "Bênção sacerdotal", nivel: 25, recarga: 40000, icone: "maos", alvo: "si",
    cura: { vida: 0.35, aliados: true }, purificar: true,
    descricao: "Recupera 35% da vida, a sua e a dos aliados, e tira todos os status (Nm 6:24-26).",
  },
  expiacao: {
    nome: "Expiação", nivel: 50, recarga: 60000, icone: "altar", alvo: "si",
    cura: { vida: 1, aliados: true }, purificar: true, buff: { duracao: 6000, escudo: 0.2 },
    descricao: "Vida cheia, sem status, e um escudo de 20% da vida por 6 s.",
  },
  salmo: {
    nome: "Salmo", nivel: 50, recarga: 40000, icone: "harpa", alvo: "si",
    dano: { tipo: "magia", mult: 1.5, area: 3 }, status: { tipo: "atordoamento" }, cura: { vida: 0.15 },
    descricao: "Dano mágico de 150% e atordoamento a até 3 casas; recupera 15% da vida.",
  },

  // ----- Profeta: controle e dano mágico -----
  palavra_de_fogo: {
    nome: "Palavra de fogo", nivel: 8, recarga: 5000, icone: "chama", alvo: "inimigo", alcance: 5,
    dano: { tipo: "magia", mult: 1.5 },
    descricao: "Dano mágico de 150% a até 5 casas (Jr 23:29).",
  },
  repreensao: {
    nome: "Repreensão", nivel: 8, recarga: 12000, icone: "grito", alvo: "inimigo", alcance: 5,
    dano: { tipo: "magia", mult: 0.5 }, status: { tipo: "medo" },
    descricao: "Assusta o alvo: ele foge sem atacar e leva +25% de dano.",
  },
  coluna_de_nuvem: {
    nome: "Coluna de nuvem", nivel: 10, recarga: 14000, icone: "nuvem", alvo: "inimigo", alcance: 5,
    dano: { tipo: "magia", mult: 0.6 }, status: { tipo: "atordoamento", duracao: 1500 },
    descricao: "Atordoa o alvo por 1,5 s (Êx 14:19-20).",
  },
  praga: {
    nome: "Praga", nivel: 12, recarga: 10000, icone: "gota", alvo: "inimigo", alcance: 5,
    dano: { tipo: "magia", mult: 0.6 }, status: { tipo: "veneno", dano: 5 },
    descricao: "Envenena o alvo (5 a cada 3 s). Com sangramento, infecciona.",
  },
  fogo_do_ceu: {
    nome: "Fogo do céu", nivel: 15, recarga: 14000, icone: "raio", alvo: "inimigo", alcance: 5,
    dano: { tipo: "magia", mult: 1.2, area: 1 },
    descricao: "Dano mágico de 120% no alvo e em quem estiver ao lado (1 Rs 18:38).",
  },
  juizo: {
    nome: "Juízo", nivel: 20, recarga: 12000, icone: "balanca", alvo: "inimigo", alcance: 5,
    dano: { tipo: "magia", mult: 1 }, bonus: { status: ["medo", "atordoamento"], mult: 2.5, consome: true },
    descricao: "100% de dano mágico; 250% em quem está com medo ou atordoado (o status acaba).",
  },
  mar_aberto: {
    nome: "Mar aberto", nivel: 25, recarga: 30000, icone: "onda", alvo: "si",
    dano: { tipo: "magia", mult: 0.6, area: 2 }, movimento: { repelir: 2 }, status: { tipo: "atordoamento", duracao: 1000 },
    descricao: "Empurra as criaturas a até 2 casas para longe e as atordoa por 1 s (Êx 14:21).",
  },
  profecia: {
    nome: "Profecia", nivel: 50, recarga: 45000, icone: "olho", alvo: "si",
    dano: { tipo: "magia", mult: 0.5, area: 3 }, status: { tipo: "medo", duracao: 4000 },
    descricao: "Todas as criaturas a até 3 casas ficam com medo por 4 s.",
  },
  carro_de_fogo: {
    nome: "Carro de fogo", nivel: 50, recarga: 45000, icone: "carro", alvo: "inimigo", alcance: 5,
    dano: { tipo: "magia", mult: 2.2, area: 2 },
    descricao: "Dano mágico de 220% em todas as criaturas a até 2 casas do alvo (2 Rs 2:11).",
  },

  // ----- Pastor: invocador (cão e ovelhas) -----
  chamar_o_cao: {
    nome: "Chamar o cão", nivel: 8, recarga: 20000, icone: "cao", alvo: "si",
    invocar: { tipo: "cao", quantidade: 1 },
    descricao: "O cão pastor vem por 60 s: segue você e morde o seu alvo.",
  },
  cajado: {
    nome: "Cajado", nivel: 8, recarga: 6000, icone: "cajado", alvo: "inimigo", alcance: 1,
    dano: { tipo: "corpo", mult: 1.4 }, movimento: { repelir: 1 },
    descricao: "140% do dano corpo a corpo e empurra o alvo 1 casa (Sl 23:4).",
  },
  ovelha_isca: {
    nome: "Ovelha de isca", nivel: 10, recarga: 18000, icone: "ovelha", alvo: "si",
    invocar: { tipo: "ovelha", quantidade: 1 },
    descricao: "Uma ovelha surge ao seu lado: as criaturas a até 4 casas a atacam em vez de você, por 12 s.",
  },
  mordida: {
    nome: "Mordida", nivel: 12, recarga: 10000, icone: "presa", alvo: "inimigo", alcance: 6,
    cao: { mult: 2, status: { tipo: "sangramento" } },
    descricao: "O cão morde o alvo com o dobro da força e o faz sangrar.",
  },
  rebanho: {
    nome: "Rebanho", nivel: 15, recarga: 30000, icone: "rebanho", alvo: "si",
    invocar: { tipo: "ovelha", quantidade: 3 },
    descricao: "Três ovelhas em volta de você, por 12 s.",
  },
  vara_e_cajado: {
    nome: "Vara e cajado", nivel: 20, recarga: 35000, icone: "vara", alvo: "si",
    buff: { duracao: 8000, dano: 1.3, aliados: 1.3, reducao: 0.2 },
    descricao: "Você e o cão causam +30% e você recebe 20% menos dano, por 8 s.",
  },
  bom_pastor: {
    nome: "Bom pastor", nivel: 25, recarga: 30000, icone: "cura", alvo: "si",
    cura: { vida: 0.25, aliados: true }, invocar: { tipo: "cao", quantidade: 1 },
    descricao: "Recupera 25% da vida (sua e dos aliados) e chama o cão de volta (Jo 10:11).",
  },
  matilha_fiel: {
    nome: "Matilha fiel", nivel: 50, recarga: 45000, icone: "cao", alvo: "si",
    invocar: { tipo: "cao", quantidade: 2 },
    descricao: "Dois cães pastores vêm por 60 s.",
  },
  aprisco: {
    nome: "Aprisco", nivel: 50, recarga: 45000, icone: "aprisco", alvo: "si",
    invocar: { tipo: "ovelha", quantidade: 4 }, buff: { duracao: 8000, reducao: 0.3 },
    descricao: "Quatro ovelhas em volta de você e 30% menos dano por 8 s.",
  },
};

// Vocações. habilidades: as 7 da vocação, em ordem (a barra segue esta ordem); passivo: bônus permanentes
// (vida: fração a mais de vida máxima; defesa: somada; dano: { corpo, distancia, magia } multiplicadores;
// critico: { corpo, distancia } em % somado; cura: × suas curas; aliados: × dano dos aliados);
// especializacoes: duas, escolhidas no nível 50, cada uma com um passivo a mais e uma habilidade própria (a 8ª).
// arma: item entregue ao escolher a vocação (se você ainda não tiver).
const VOCACOES = {
  guerreiro: {
    nome: "Guerreiro",
    titulo: "Valente de Davi",
    papel: "Tanque · corpo a corpo",
    descricao: "Aguenta os golpes, segura as criaturas e as derruba de perto (2 Sm 23:8).",
    passivo: { vida: 0.15, defesa: 2 },
    textoPassivo: "+15% de vida máxima e +2 de defesa.",
    habilidades: ["golpe_firme", "escudo_erguido", "grito_de_guerra", "golpe_de_escudo", "investida_do_valente", "redemoinho", "ultimo_bastiao"],
    especializacoes: {
      valente: { nome: "Valente", passivo: { dano: { corpo: 1.15 } }, textoPassivo: "+15% de dano corpo a corpo.", habilidade: "furia_de_davi" },
      guardiao: { nome: "Guardião", passivo: { defesa: 6 }, textoPassivo: "+6 de defesa.", habilidade: "muralha" },
    },
  },
  fundibulario: {
    nome: "Fundibulário",
    titulo: "Benjamita",
    papel: "Dano à distância · funda",
    descricao: "Acerta de longe com a funda, sem gastar flechas, e não deixa as criaturas chegarem (Jz 20:16).",
    arma: "funda",
    passivo: { critico: { distancia: 5 }, dano: { distancia: 1.1 } },
    textoPassivo: "+10% de dano e +5% de crítico à distância.",
    habilidades: ["pedra_certeira", "pedra_na_testa", "recuo_agil", "chuva_de_pedras", "pedra_afiada", "mao_esquerda", "olho_de_aguia"],
    especializacoes: {
      atirador: { nome: "Atirador", passivo: { dano: { distancia: 1.15 } }, textoPassivo: "+15% de dano à distância.", habilidade: "pedra_de_golias" },
      escaramucador: { nome: "Escaramuçador", passivo: { critico: { distancia: 10 } }, textoPassivo: "+10% de crítico à distância.", habilidade: "saraivada" },
    },
  },
  levita: {
    nome: "Levita",
    titulo: "Servo do santuário",
    papel: "Cura e suporte",
    descricao: "Cura, protege e tira os males; luta com a luz, de longe (Nm 3:6).",
    passivo: { cura: 1.2, dano: { magia: 1.05 } },
    textoPassivo: "+20% nas curas e +5% de dano mágico.",
    habilidades: ["bencao", "luz_do_candelabro", "incenso", "purificacao", "toque_do_shofar", "escudo_da_fe", "bencao_sacerdotal"],
    especializacoes: {
      sumo_sacerdote: { nome: "Sumo sacerdote", passivo: { cura: 1.25 }, textoPassivo: "+25% nas curas.", habilidade: "expiacao" },
      cantor: { nome: "Cantor do templo", passivo: { dano: { magia: 1.2 } }, textoPassivo: "+20% de dano mágico.", habilidade: "salmo" },
    },
  },
  profeta: {
    nome: "Profeta",
    titulo: "Voz no deserto",
    papel: "Controle e dano mágico",
    descricao: "Assusta, prende e julga: o controle abre caminho para o dano (Is 40:3).",
    passivo: { dano: { magia: 1.1 } },
    textoPassivo: "+10% de dano mágico.",
    habilidades: ["palavra_de_fogo", "repreensao", "coluna_de_nuvem", "praga", "fogo_do_ceu", "juizo", "mar_aberto"],
    especializacoes: {
      vidente: { nome: "Vidente", passivo: { critico: { distancia: 10 } }, textoPassivo: "+10% de crítico mágico.", habilidade: "profecia" },
      profeta_de_fogo: { nome: "Profeta de fogo", passivo: { dano: { magia: 1.2 } }, textoPassivo: "+20% de dano mágico.", habilidade: "carro_de_fogo" },
    },
  },
  pastor: {
    nome: "Pastor",
    titulo: "Guardião do rebanho",
    papel: "Invocador · cão e ovelhas",
    descricao: "Luta junto do cão pastor e protege-se com as ovelhas, que atraem as criaturas (Sl 23).",
    passivo: { aliados: 1.2, vida: 0.05 },
    textoPassivo: "+20% de dano dos aliados e +5% de vida máxima.",
    habilidades: ["chamar_o_cao", "cajado", "ovelha_isca", "mordida", "rebanho", "vara_e_cajado", "bom_pastor"],
    especializacoes: {
      mestre_dos_caes: { nome: "Mestre dos cães", passivo: { aliados: 1.25 }, textoPassivo: "+25% de dano dos aliados.", habilidade: "matilha_fiel" },
      guarda_do_aprisco: { nome: "Guarda do aprisco", passivo: { vida: 0.1 }, textoPassivo: "+10% de vida máxima.", habilidade: "aprisco" },
    },
  },
};
