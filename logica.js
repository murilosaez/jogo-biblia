const TILE = 32;
const COLS = 25;
const ROWS = 18;
const VERSAO_SAVE = 1;
const VIDA_MAXIMA_JOGADOR = 100;

// Valores provisórios para testar as mecânicas.
const TEMPO_REGEN = 10000;
const INTERVALO_MOVIMENTO = 600;
const INTERVALO_ATAQUE = 1200;
const CURA_POCAO = 30;
const QUANTIDADE_POCOES_INICIAIS = 3;

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

// Personagens não controlados pelo jogador.
const npcs = {
  viajante1: {
    id: "viajante1",
    nome: "Eliabe",
    x: 2,
    y: 5,
  },
};

// Valores provisórios para testar o comportamento dos inimigos.
const inimigos = {
  lobo1: {
    id: "lobo1",
    nome: "Lobo",
    x: 6,
    y: 5,
    inicioX: 6,
    inicioY: 5,
    vidaMaxima: 50,
    danoDoAtaque: 25,
    danoContraJogador: 8,
    raioPercepcao: 6,
    proximoMovimento: 0,
    proximoAtaque: 0,
  },
};

const Mundo = {
  jogadores: {},
  estado: {},

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
        itensIniciaisEntregues: false,
        inimigosDerrotados: [],
        vidaInimigos: {},
      };
    }

    if (!Array.isArray(personagem.inventario)) {
      personagem.inventario = [];
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

    // Dá 3 poções uma única vez, inclusive em saves antigos.
    if (!personagem.itensIniciaisEntregues) {
      for (let i = 0; i < QUANTIDADE_POCOES_INICIAIS; i++) {
        personagem.inventario.push("pocao");
      }

      personagem.itensIniciaisEntregues = true;
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

      inimigo.x = inimigo.inicioX;
      inimigo.y = inimigo.inicioY;
      inimigo.proximoMovimento = 0;
      inimigo.proximoAtaque = 0;
    }

    this.jogadores[id] = personagem;
    this.estado[id] = {
      proximaRegen: Date.now() + TEMPO_REGEN,
    };

    Storage.salvar(personagem);
    return personagem;
  },

  inimigoVivo(personagem, idInimigo) {
    return (
      !personagem.inimigosDerrotados.includes(idInimigo) &&
      personagem.vidaInimigos[idInimigo] > 0
    );
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

  contarItem(idJogador, idItem) {
    const personagem = this.jogadores[idJogador];

    if (!personagem || !Array.isArray(personagem.inventario)) {
      return 0;
    }

    return personagem.inventario.filter((item) => item === idItem).length;
  },

  reaparecerInimigo(idJogador, idInimigo) {
    const personagem = this.jogadores[idJogador];
    const inimigo = inimigos[idInimigo];

    if (!personagem || !inimigo) {
      return false;
    }

    const indice = personagem.inimigosDerrotados.indexOf(idInimigo);

    if (indice === -1) {
      return false;
    }

    personagem.inimigosDerrotados.splice(indice, 1);
    personagem.vidaInimigos[idInimigo] = inimigo.vidaMaxima;

    inimigo.x = inimigo.inicioX;
    inimigo.y = inimigo.inicioY;
    inimigo.proximoMovimento = 0;
    inimigo.proximoAtaque = 0;

    Storage.salvar(personagem);
    return true;
  },

  casaLivreParaInimigo(x, y, personagem) {
    if (!mapa[y] || mapa[y][x] !== 0) {
      return false;
    }

    if (personagem.x === x && personagem.y === y) {
      return false;
    }

    const npcAli = Object.values(npcs).some(
      (npc) => npc.x === x && npc.y === y
    );

    if (npcAli) {
      return false;
    }

    const outroInimigo = Object.values(inimigos).some(
      (outro) =>
        this.inimigoVivo(personagem, outro.id) &&
        outro.x === x &&
        outro.y === y
    );

    return !outroInimigo;
  },

  passoInimigo(inimigo, alvoX, alvoY, personagem) {
    const difX = alvoX - inimigo.x;
    const difY = alvoY - inimigo.y;

    const passoX = { dx: Math.sign(difX), dy: 0 };
    const passoY = { dx: 0, dy: Math.sign(difY) };
    const tentativas = [];

    if (Math.abs(difX) >= Math.abs(difY)) {
      if (passoX.dx !== 0) tentativas.push(passoX);
      if (passoY.dy !== 0) tentativas.push(passoY);
    } else {
      if (passoY.dy !== 0) tentativas.push(passoY);
      if (passoX.dx !== 0) tentativas.push(passoX);
    }

    for (const passo of tentativas) {
      const novoX = inimigo.x + passo.dx;
      const novoY = inimigo.y + passo.dy;

      if (this.casaLivreParaInimigo(novoX, novoY, personagem)) {
        inimigo.x = novoX;
        inimigo.y = novoY;
        return true;
      }
    }

    return false;
  },

  atualizar(id, agora) {
    const personagem = this.jogadores[id];
    const estado = this.estado[id];
    const eventos = [];

    if (!personagem || !estado) {
      return eventos;
    }

    for (const inimigo of Object.values(inimigos)) {
      if (!this.inimigoVivo(personagem, inimigo.id)) {
        continue;
      }

      const distancia =
        Math.abs(personagem.x - inimigo.x) +
        Math.abs(personagem.y - inimigo.y);

      // Se estiver ao lado, o inimigo pode atacar.
      if (distancia === 1) {
        if (agora >= inimigo.proximoAtaque) {
          inimigo.proximoAtaque = agora + INTERVALO_ATAQUE;
          estado.proximaRegen = agora + TEMPO_REGEN;

          personagem.vida = Math.max(
            0,
            personagem.vida - inimigo.danoContraJogador
          );

          if (personagem.vida === 0) {
            personagem.x = 2;
            personagem.y = 2;
            personagem.vida = VIDA_MAXIMA_JOGADOR;

            for (const outro of Object.values(inimigos)) {
              if (this.inimigoVivo(personagem, outro.id)) {
                outro.x = outro.inicioX;
                outro.y = outro.inicioY;
                outro.proximoAtaque = 0;
                outro.proximoMovimento = 0;
                personagem.vidaInimigos[outro.id] =
                  outro.vidaMaxima;
              }
            }

            Storage.salvar(personagem);

            eventos.push({
              tipo: "renasceu",
              mensagem:
                "O lobo derrubou você! Você voltou ao início " +
                "com a vida restaurada.",
            });

            return eventos;
          }

          Storage.salvar(personagem);

          eventos.push({
            tipo: "jogadorAtingido",
            mensagem:
              `O lobo mordeu você! Sua vida: ` +
              `${personagem.vida}/${VIDA_MAXIMA_JOGADOR}.`,
          });
        }

        continue;
      }

      if (agora < inimigo.proximoMovimento) {
        continue;
      }

      inimigo.proximoMovimento = agora + INTERVALO_MOVIMENTO;

      let alvoX = inimigo.inicioX;
      let alvoY = inimigo.inicioY;

      if (distancia <= inimigo.raioPercepcao) {
        alvoX = personagem.x;
        alvoY = personagem.y;
      } else if (
        inimigo.x === inimigo.inicioX &&
        inimigo.y === inimigo.inicioY
      ) {
        continue;
      }

      if (this.passoInimigo(inimigo, alvoX, alvoY, personagem)) {
        inimigo.proximoAtaque = Math.max(
          inimigo.proximoAtaque,
          agora + 600
        );

        eventos.push({
          tipo: "inimigoMoveu",
          id: inimigo.id,
        });
      }
    }

    // Recupera 1 ponto a cada 10 segundos fora de batalha.
    if (
      personagem.vida < VIDA_MAXIMA_JOGADOR &&
      agora >= estado.proximaRegen
    ) {
      personagem.vida += 1;
      estado.proximaRegen = agora + TEMPO_REGEN;
      Storage.salvar(personagem);

      eventos.push({ tipo: "regenerou" });
    }

    return eventos;
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

      const inimigoOcupandoCasa = Object.values(inimigos).some(
        (inimigo) =>
          this.inimigoVivo(personagem, inimigo.id) &&
          inimigo.x === novoX &&
          inimigo.y === novoY
      );

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

    if (comando.tipo === "usarPocao") {
      const indicePocao = personagem.inventario.indexOf("pocao");

      if (indicePocao === -1) {
        return {
          ok: false,
          mensagem: "Você não tem poções.",
        };
      }

      if (personagem.vida >= VIDA_MAXIMA_JOGADOR) {
        return {
          ok: false,
          mensagem: "Sua vida já está cheia. A poção não foi consumida.",
        };
      }

      personagem.inventario.splice(indicePocao, 1);

      const vidaAnterior = personagem.vida;
      personagem.vida = Math.min(
        VIDA_MAXIMA_JOGADOR,
        personagem.vida + CURA_POCAO
      );

      // Usar uma poção durante a batalha reinicia o tempo de regeneração.
      this.estado[id].proximaRegen = Date.now() + TEMPO_REGEN;

      Storage.salvar(personagem);

      return {
        ok: true,
        mensagem:
          `Você usou uma poção e recuperou ` +
          `${personagem.vida - vidaAnterior} de vida. ` +
          `Vida: ${personagem.vida}/${VIDA_MAXIMA_JOGADOR}.`,
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

      if (!this.inimigoVivo(personagem, inimigo.id)) {
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

      this.estado[id].proximaRegen = Date.now() + TEMPO_REGEN;

      const novaVidaInimigo = Math.max(
        0,
        personagem.vidaInimigos[inimigo.id] -
          inimigo.danoDoAtaque
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
          mensagem: "Você derrotou o lobo! Ele reaparecerá em 5 segundos.",
        };
      }

      Storage.salvar(personagem);

      return {
        ok: true,
        derrotado: false,
        mensagem:
          `Você acertou o lobo! Vida dele: ` +
          `${novaVidaInimigo}/${inimigo.vidaMaxima}.`,
      };
    }

    return { ok: false };
  },
};