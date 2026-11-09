const Storage = {
  salvar(personagem) {
    localStorage.setItem("save_" + personagem.id, JSON.stringify(personagem));

    // Cópia de segurança do progresso das missões, separada do save principal.
    const missoes = {
      missaoEliabe: personagem.missaoEliabe,
      missaoErvas: personagem.missaoErvas,
    };
    localStorage.setItem(
      "save_" + personagem.id + "_missoes",
      JSON.stringify(missoes)
    );
  },

  carregar(id) {
    const dados = localStorage.getItem("save_" + id);

    if (!dados) {
      return null;
    }

    let personagem;

    try {
      personagem = JSON.parse(dados);
    } catch (erro) {
      return null;
    }

    // Recupera os estados mais recentes das missões, se houver uma cópia salva.
    const dadosMissoes = localStorage.getItem("save_" + id + "_missoes");

    if (dadosMissoes) {
      try {
        const missoes = JSON.parse(dadosMissoes);

        if (missoes && typeof missoes === "object") {
          if (missoes.missaoEliabe && typeof missoes.missaoEliabe === "object") {
            personagem.missaoEliabe = missoes.missaoEliabe;
          }

          if (missoes.missaoErvas && typeof missoes.missaoErvas === "object") {
            personagem.missaoErvas = missoes.missaoErvas;
          }
        }
      } catch (erro) {
        // Se a cópia estiver inválida, o save principal continua utilizável.
      }
    }

    return personagem;
  },
};
