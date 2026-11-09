const Storage = {
  salvar(personagem) {
    localStorage.setItem("save_" + personagem.id, JSON.stringify(personagem));
  },
  carregar(id) {
    const dados = localStorage.getItem("save_" + id);
    return dados ? JSON.parse(dados) : null;
  },
};