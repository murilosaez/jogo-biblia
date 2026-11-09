const Storage = {
  salvar(personagem) {
    try {
      localStorage.setItem("save_" + personagem.id, JSON.stringify(personagem));
      return true;
    } catch (erro) {
      console.error("Não foi possível salvar o jogo:", erro);
      return false;
    }
  },
  carregar(id) {
    try {
      const dados = localStorage.getItem("save_" + id);
      return dados ? JSON.parse(dados) : null;
    } catch (erro) {
      console.error("O save não pôde ser lido; um novo será criado:", erro);
      return null;
    }
  },
};
