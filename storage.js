// =====================================================================
// storage.js — persistência em localStorage (chave "save_<id>").
//
// Storage.salvar(p) apenas marca o personagem como pendente; a gravação
// real acontece no máximo ATRASO_GRAVACAO ms depois (agrupando dezenas de
// chamadas por passo/golpe numa única escrita). Ao fechar, ocultar ou trocar
// de aba, tudo que estiver pendente é gravado na hora (flush).
// =====================================================================
const Storage = {
  PREFIXO: "save_",
  ATRASO_GRAVACAO: 1000,
  pendentes: {},
  temporizador: null,

  chave(id) {
    return this.PREFIXO + id;
  },

  // Agenda a gravação. Mantém a assinatura antiga: retorna true/false.
  salvar(personagem) {
    if (!personagem || personagem.id === undefined || personagem.id === null) return false;
    this.pendentes[personagem.id] = personagem;
    if (typeof setTimeout !== "function") return this.gravarPendentes();
    if (this.temporizador === null) {
      this.temporizador = setTimeout(() => {
        this.temporizador = null;
        this.gravarPendentes();
      }, this.ATRASO_GRAVACAO);
    }
    return true;
  },

  // Grava imediatamente um personagem (e descarta a pendência dele).
  salvarAgora(personagem) {
    if (!personagem) return false;
    delete this.pendentes[personagem.id];
    return this.gravar(personagem);
  },

  gravar(personagem) {
    try {
      localStorage.setItem(this.chave(personagem.id), JSON.stringify(personagem));
      return true;
    } catch (erro) {
      console.error("Não foi possível salvar o jogo:", erro);
      return false;
    }
  },

  // Grava tudo o que estiver pendente.
  gravarPendentes() {
    if (this.temporizador !== null && typeof clearTimeout === "function") clearTimeout(this.temporizador);
    this.temporizador = null;
    let ok = true;
    for (const [id, personagem] of Object.entries(this.pendentes)) {
      delete this.pendentes[id];
      ok = this.gravar(personagem) && ok;
    }
    return ok;
  },

  flush() {
    return this.gravarPendentes();
  },

  temPendencias() {
    return Object.keys(this.pendentes).length > 0;
  },

  carregar(id) {
    if (this.pendentes[id]) this.gravarPendentes();
    try {
      const dados = localStorage.getItem(this.chave(id));
      return dados ? JSON.parse(dados) : null;
    } catch (erro) {
      console.error("O save não pôde ser lido; um novo será criado:", erro);
      return null;
    }
  },

  // Garante a gravação ao sair da página, trocar de aba ou minimizar.
  instalarGatilhos() {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const gravar = () => this.gravarPendentes();
    window.addEventListener("beforeunload", gravar);
    window.addEventListener("pagehide", gravar);
    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") gravar();
      });
    }
  },
};

Storage.instalarGatilhos();
