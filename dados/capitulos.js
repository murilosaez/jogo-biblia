// =====================================================================
// dados/capitulos.js — capítulos da campanha (em ordem)
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// =====================================================================

// missao: id em dados/missoes.js (líder, inimigo, capítulo anterior, falas e recompensa
// vêm dela); mestre: quem ensina a Oração depois do capítulo; painelMestre: texto do
// painel após a conclusão, antes e depois de aprender a Oração ({mestre} = nome do mestre).
const DADOS_CAPITULOS = [
  { chave: "egito", nome: "Egito", missao: "egito" },
  { chave: "marVermelho", nome: "Mar Vermelho", missao: "marVermelho" },
  { chave: "sinai", nome: "Monte Sinai", missao: "sinai" },
  {
    chave: "galileia",
    nome: "Galileia",
    missao: "galileia",
    mestre: "jesusGalileia",
    painelMestre: {
      antes: "Converse com {mestre} para aprender a Oração.",
      depois: "Oração aprendida — F1 para orar.",
    },
  },
];
