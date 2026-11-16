// =====================================================================
// storage.js — persistência em localStorage (chave "save_<id>").
//
// Storage.salvar(p) apenas marca o personagem como pendente; a gravação
// real acontece no máximo ATRASO_GRAVACAO ms depois (agrupando dezenas de
// chamadas por passo/golpe numa única escrita). Ao fechar, ocultar ou trocar
// de aba, tudo que estiver pendente é gravado na hora (flush).
//
// Exportar/importar: o save vai num envelope JSON ({ formato, versaoFormato,
// exportadoEm, personagem }) para levar o progresso a outro dispositivo e,
// mais tarde, para o banco de dados (o mesmo envelope serve de payload).
// =====================================================================
const Storage = {
  PREFIXO: "save_",
  ATRASO_GRAVACAO: 1000,
  FORMATO_EXPORTACAO: "jornada-save",
  VERSAO_EXPORTACAO: 1,
  pendentes: {},
  temporizador: null,
  // Depois de importar, nada mais grava até a página recarregar: senão o personagem antigo,
  // ainda na memória, sobrescreveria o importado no próximo passo ou ao sair da página.
  bloqueado: false,

  chave(id) {
    return this.PREFIXO + id;
  },

  // Agenda a gravação. Mantém a assinatura antiga: retorna true/false.
  salvar(personagem) {
    if (this.bloqueado) return false;
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
    if (this.bloqueado) return false;
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

  // ----- Exportar / importar -----
  // Devolve o envelope (objeto) com o save atual, já com as pendências gravadas; null se não há save.
  envelope(id) {
    this.gravarPendentes();
    const personagem = this.carregar(id);
    if (!personagem) return null;
    return {
      formato: this.FORMATO_EXPORTACAO,
      versaoFormato: this.VERSAO_EXPORTACAO,
      exportadoEm: new Date().toISOString(),
      personagem,
    };
  },

  // O envelope em texto (o conteúdo do arquivo exportado).
  exportar(id) {
    const env = this.envelope(id);
    return env ? JSON.stringify(env) : null;
  },

  // Lê o texto de um arquivo exportado e devolve o envelope; lança Error com mensagem para o jogador.
  // Aceita também o save cru (o valor de "save_<id>" copiado do localStorage).
  lerExportacao(texto) {
    let dados;
    try {
      dados = JSON.parse(String(texto || "").replace(/^\uFEFF/, ""));
    } catch (erro) {
      throw new Error("O arquivo não é um progresso exportado do jogo (JSON inválido).");
    }
    const objeto = (v) => !!v && typeof v === "object" && !Array.isArray(v);
    if (!objeto(dados)) throw new Error("O arquivo não é um progresso exportado do jogo.");
    let env;
    if (dados.formato !== undefined) {
      if (dados.formato !== this.FORMATO_EXPORTACAO) throw new Error("O arquivo não é um progresso exportado do jogo.");
      if (!(Number(dados.versaoFormato) <= this.VERSAO_EXPORTACAO)) {
        throw new Error("O arquivo foi exportado por uma versão mais nova do jogo. Atualize a página e tente de novo.");
      }
      env = dados;
    } else {
      env = { formato: this.FORMATO_EXPORTACAO, versaoFormato: this.VERSAO_EXPORTACAO, exportadoEm: null, personagem: dados };
    }
    const p = env.personagem;
    if (!objeto(p) || !Array.isArray(p.inventario) || !Number.isFinite(Number(p.nivel))) {
      throw new Error("O arquivo não traz um personagem válido.");
    }
    return env;
  },

  // Substitui o save do jogador pelo personagem importado e bloqueia novas gravações
  // (quem chama recarrega a página para o jogo entrar com o save novo e migrá-lo).
  importar(id, personagem) {
    if (this.temporizador !== null && typeof clearTimeout === "function") clearTimeout(this.temporizador);
    this.temporizador = null;
    this.pendentes = {};
    const copia = JSON.parse(JSON.stringify(personagem));
    copia.id = id;
    const ok = this.gravar(copia);
    if (ok) this.bloqueado = true;
    return ok;
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
