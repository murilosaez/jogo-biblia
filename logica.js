const TILE = 32;
const COLS = 25;
const ROWS = 18;
const VERSAO_SAVE = 1;
const VIDA_MAXIMA_JOGADOR = 100;

// Mapa: 1 = obstáculo, 0 = chão
const mapa = [];

for (let y = 0; y < ROWS; y++) {
  mapa[y] = [];

  for (let x = 0; x < COLS; x++) {
    const borda =
      x === 0 ||
      y === 0 ||
      x === COLS - 1 ||
      y === ROWS - 1;

    const obstaculo = x % 6 === 3 && y % 4 === 2;
    mapa[y][x] = borda || obstaculo ? 1 : 0;
  }
}

// Dados do NPC
const npcs = {
  viajante1: {
    id: "viajante1",
    nome: "Eliabe",
    x: 2,
    y: 5,
  },
};

// Configuração dos inimigos
const inimigos = {
  lobo1: {
    id: "lobo1",
    nome: "Lobo",
    x: 6,
    y: 5,
    vidaMaxima: 50,
    danoDoAtaque: 25,
    danoContraJogador: 15,
  },
};

const Mundo = {
  jogadores: {},

  entrar(id) {
    let personagem = Storage.carregar(id);

    if (!personagem) {
      personagem = {
        versao: VERSAO_SAVE,
        id,
        x: 2,
        y: 2,
        vida: VIDA_MAXIMA_JOGADOR,
        inventario: [],
        inimigosDerrotados: [],
        vidaInimigos: {},
      };
    }

    if (!Array.isArray(personagem.inimigosDerrotados)) {
      personagem.inimigosDerrotados = [];
    }

    if (
      !personagem.vidaInimigos ||
      typeof personagem.vidaInimigos !== "object"
    ) {
      personagem.vidaInimigos = {};
    }

    if (
      typeof personagem.vida !== "number" ||
      !Number.isFinite(personagem.vida)
    ) {
      personagem.vida = VIDA_MAXIMA_JOGADOR;
    }

    personagem.vida = Math.max(
      0,
      Math.min(personagem.vida, VIDA_MAXIMA_JOGADOR)
    );

    if (personagem.vida <= 0) {
      personagem.x = 2;
      personagem.y = 2;
      personagem.vida = VIDA_MAXIMA_JOGADOR;
    }

    personagem.versao = VERSAO_SAVE;

    for (const inimigo of Object.values(inimigos)) {
      const vidaSalva = personagem.vidaInimigos[inimigo.id];

      if (personagem.inimigosDerrotados.includes(inimigo.id)) {
        personagem.vidaInimigos[inimigo.id] = 0;
      } else if (
        typeof vidaSalva !== "number" ||
        !Number.isFinite(vidaSalva)
      ) {
        personagem.vidaInimigos[inimigo.id] = inimigo.vidaMaxima;
      } else {
        personagem.vidaInimigos[inimigo.id] = Math.max(
          0,
          Math.min(vidaSalva, inimigo.vidaMaxima)
        );
      }
    }

    this.jogadores[id] = personagem;
    Storage.salvar(personagem);

    return personagem;
  },

  obterVidaInimigo(idJogador, idInimigo) {
    const personagem = this.jogadores[idJogador];
    const inimigo = inimigos[idInimigo];

    if (!personagem || !inimigo) {
      return null;
    }

    if (personagem.inimigosDerrotados.includes(idInimigo)) {
      return 0;
    }

    return personagem.vidaInimigos[idInimigo];
  },

  reaparecerInimigo(idJogador, idInimigo) {
    const personagem = this.jogadores[idJogador];
    const inimigo = inimigos[idInimigo];

    if (!personagem || !inimigo) {
      return false;
    }

    const indice = personagem.inimigosDerrotados.indexOf(idInimigo);

    // Só reaparece se estiver marcado como derrotado.
    if (indice === -1) {
      return false;
    }

    personagem.inimigosDerrotados.splice(indice, 1);
    personagem.vidaInimigos[idInimigo] = inimigo.vidaMaxima;

    Storage.salvar(personagem);
    return true;
  },

  executar(id, comando) {
    const personagem = this.jogadores[id];

    if (!personagem || !comando || typeof comando.tipo !== "string") {
      return { ok: false };
    }

    if (comando.tipo === "mover") {
      const dx = Number(comando.dx);
      const dy = Number(comando.dy);

      if (
        !Number.isInteger(dx) ||
        !Number.isInteger(dy) ||
        Math.abs(dx) + Math.abs(dy) !== 1
      ) {
        return { ok: false };
      }

      const novoX = personagem.x + dx;
      const novoY = personagem.y + dy;

      if (!mapa[novoY] || mapa[novoY][novoX] !== 0) {
        return { ok: false };
      }

      const npcOcupandoCasa = Object.values(npcs).some(
        (npc) => npc.x === novoX && npc.y === novoY
      );

      const inimigoOcupandoCasa = Object.values(inimigos).some((inimigo) => {
        const vivo =
          !personagem.inimigosDerrotados.includes(inimigo.id) &&
          personagem.vidaInimigos[inimigo.id] > 0;

        return vivo && inimigo.x === novoX && inimigo.y === novoY;
      });

      if (npcOcupandoCasa || inimigoOcupandoCasa) {
        return { ok: false };
      }

      personagem.x = novoX;
      personagem.y = novoY;
      Storage.salvar(personagem);

      return { ok: true };
    }

    if (comando.tipo === "interagir") {
      const npc = npcs[comando.alvoId];

      if (!npc) {
        return {
          ok: false,
          mensagem: "Não encontrei esse personagem.",
        };
      }

      const distancia =
        Math.abs(personagem.x - npc.x) +
        Math.abs(personagem.y - npc.y);

      if (distancia > 1) {
        return {
          ok: false,
          mensagem: "Chegue mais perto para conversar.",
        };
      }

      return {
        ok: true,
        mensagem:
          `${npc.nome}: Paz, viajante! Nossa jornada começa no princípio. ` +
          "Explore com atenção e procure aprender com as histórias.",
      };
    }

    if (comando.tipo === "atacar") {
      const inimigo = inimigos[comando.alvoId];

      if (!inimigo) {
        return {
          ok: false,
          mensagem: "Não encontrei esse inimigo.",
        };
      }

      if (personagem.inimigosDerrotados.includes(inimigo.id)) {
        return {
          ok: false,
          mensagem: "Esse inimigo já foi derrotado.",
        };
      }

      const distancia =
        Math.abs(personagem.x - inimigo.x) +
        Math.abs(personagem.y - inimigo.y);

      if (distancia !== 1) {
        return {
          ok: false,
          mensagem: "Chegue ao lado do lobo para atacá-lo.",
        };
      }

      const vidaAtualInimigo = personagem.vidaInimigos[inimigo.id];

      if (vidaAtualInimigo <= 0) {
        if (!personagem.inimigosDerrotados.includes(inimigo.id)) {
          personagem.inimigosDerrotados.push(inimigo.id);
        }

        Storage.salvar(personagem);

        return {
          ok: true,
          derrotado: true,
          mensagem: "Você derrotou o lobo!",
        };
      }

      const novaVidaInimigo = Math.max(
        0,
        vidaAtualInimigo - inimigo.danoDoAtaque
      );

      personagem.vidaInimigos[inimigo.id] = novaVidaInimigo;

      if (novaVidaInimigo === 0) {
        if (!personagem.inimigosDerrotados.includes(inimigo.id)) {
          personagem.inimigosDerrotados.push(inimigo.id);
        }

        Storage.salvar(personagem);

        return {
          ok: true,
          derrotado: true,
          vidaJogador: personagem.vida,
          vidaInimigo: 0,
          mensagem: "Você derrotou o lobo! Ele reaparecerá em 5 segundos.",
        };
      }

      // O lobo contra-ataca se sobreviver ao golpe.
      personagem.vida = Math.max(
        0,
        personagem.vida - inimigo.danoContraJogador
      );

      if (personagem.vida === 0) {
        personagem.x = 2;
        personagem.y = 2;
        personagem.vida = VIDA_MAXIMA_JOGADOR;
        Storage.salvar(personagem);

        return {
          ok: true,
          derrotado: false,
          renasceu: true,
          vidaJogador: personagem.vida,
          vidaInimigo: novaVidaInimigo,
          mensagem:
            "O lobo contra-atacou e você foi nocauteado. " +
            "Você voltou ao início com a vida restaurada.",
        };
      }

      Storage.salvar(personagem);

      return {
        ok: true,
        derrotado: false,
        vidaJogador: personagem.vida,
        vidaInimigo: novaVidaInimigo,
        mensagem:
          `Você acertou o lobo! Vida dele: ` +
          `${novaVidaInimigo}/${inimigo.vidaMaxima}. ` +
          `O lobo contra-atacou! Sua vida: ` +
          `${personagem.vida}/${VIDA_MAXIMA_JOGADOR}.`,
      };
    }

    return { ok: false };
  },
};