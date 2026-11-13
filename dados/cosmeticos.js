// =====================================================================
// dados/cosmeticos.js — trajes (outfits) e montarias (JGB-27)
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
//
// Cosméticos só mudam a aparência: nenhum dá dano, defesa, vida, carga, velocidade, saque ou XP
// (Decisão 4 do plano: monetização começa com cosméticos e compra única, sem vender poder).
// Os ids ficam no save (p.cosmeticos.possui): para tirar um cosmético da loja, use oculto: true.
// =====================================================================

// Regras da loja.
//   pagamento: meio de pagamento da compra única. null = ainda a definir: a loja mostra os cosméticos e
//     o preço ("a definir"), mas não vende; quem já possui (ou os gratuitos) pode usar normalmente.
//   textoSemPagamento: o que a loja diz ao tentar comprar sem meio de pagamento.
const REGRAS_COSMETICOS = {
  pagamento: null,
  textoSemPagamento: "Compra em breve: o meio de pagamento ainda está sendo definido. Nenhum cosmético dá vantagem em combate.",
};

// Trajes: nome, vocacao (só quem tem essa vocação veste; null = qualquer um), gratuito (todos já
// possuem), preco (null = a definir), descricao e visual (o boneco em sprites.js: molde "curta",
// "manto" ou "veu", cores H/S/s/R/r/d/A/F/V/W, gola, cabelo e acessórios que não são arma nem escudo).
const TRAJES = {
  peregrino: {
    nome: "Peregrino", vocacao: null, gratuito: true, preco: null,
    descricao: "Manto de viagem cor de terra, faixa na cabeça e o alforje ao ombro.",
    visual: {
      molde: "manto", cores: { H: "#4a2f20", R: "#c8a878", r: "#a8885a", d: "#7d6440", A: "#8e2a1f", F: "#5a3a24" },
      acessorios: [["faixa", ["#8e2a1f"]], ["saco", ["#a8916a", "#d4bf8f"]]],
    },
  },
  armadura_de_davi: {
    nome: "Couraça de Davi", vocacao: "guerreiro", gratuito: false, preco: null,
    descricao: "Túnica carmesim, capa de lã e elmo de bronze, como os valentes de Davi.",
    visual: {
      molde: "curta", cores: { H: "#3a2418", R: "#b0402e", r: "#8e2a1f", d: "#5e1a14", A: "#e8b94a", F: "#4f3220" }, gola: "#e8b94a",
      acessorios: [["capa", ["#5e1a14", "#8e2a1f"]], ["elmo", ["#b07a38", "#f2d27a"]]],
    },
  },
  pastor_de_belem: {
    nome: "Pastor de Belém", vocacao: "fundibulario", gratuito: false, preco: null,
    descricao: "Túnica listrada de pastor, a bolsa das pedras e o turbante de linho.",
    visual: {
      molde: "curta", cores: { H: "#6a3e26", R: "#e0d0a8", r: "#b8a07a", d: "#7d6440", A: "#3b5a9a", F: "#5a3a24" },
      acessorios: [["turbante", ["#eadcb6", "#3b5a9a"]], ["bolsa", ["#7a4a30", "#a8703a"]], ["odre", ["#a66b39", "#c98a52"]]],
    },
  },
  linho_do_templo: {
    nome: "Linho do Templo", vocacao: "levita", gratuito: false, preco: null,
    descricao: "Veste de linho fino, cinto azul e o turbante branco dos levitas.",
    visual: {
      molde: "manto", cores: { H: "#2e1f18", R: "#f6efdc", r: "#e0d4b8", d: "#b8a888", A: "#3b5a9a", F: "#8a6a42" }, gola: "#3b5a9a",
      acessorios: [["turbante", ["#f6efdc", "#3b5a9a", "#e8b94a"]], ["colar", ["#e8b94a", "#3b5a9a"]]],
    },
  },
  manto_de_elias: {
    nome: "Manto de Elias", vocacao: "profeta", gratuito: false, preco: null,
    descricao: "Manto de pelos e cinto de couro, como o do profeta de Tisbé.",
    visual: {
      molde: "manto", cabelo: "longo", cores: { H: "#5a4636", B: "#5a4636", R: "#7a5a3e", r: "#5e4430", d: "#3e2c20", A: "#3a2418", F: "#3a2418" },
      acessorios: [["capa", ["#4a3626", "#6e5440"]]],
    },
  },
  manto_listrado: {
    nome: "Manto listrado", vocacao: "pastor", gratuito: false, preco: null,
    descricao: "Manto listrado de lã de ovelha e o fardo nas costas, para longas jornadas com o rebanho.",
    visual: {
      molde: "manto", cores: { H: "#4a2f20", R: "#eadcb6", r: "#8e4a2a", d: "#5e3018", A: "#55642c", F: "#5a3a24" },
      acessorios: [["faixa", ["#55642c"]], ["fardo", ["#a8916a", "#7d6a4a"]]],
    },
  },
};

// Montarias: só visuais (a velocidade de andar é a mesma a pé ou montado). preco null = a definir.
const MONTARIAS = {
  jumento: { nome: "Jumento", gratuito: false, preco: null, descricao: "Manso e firme nas trilhas de pedra." },
  camelo: { nome: "Camelo", gratuito: false, preco: null, descricao: "O navio do deserto, com a sela de tapete." },
  cavalo: { nome: "Cavalo", gratuito: false, preco: null, descricao: "Corcel castanho de crina escura." },
  carro: { nome: "Carro", gratuito: false, preco: null, descricao: "Carro de duas rodas puxado por um cavalo." },
};
