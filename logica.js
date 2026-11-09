const TILE = 32;
const COLS = 25;
const ROWS = 18;
const VERSAO_SAVE = 1;

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

// Dados do NPC: ficam na lógica do jogo, não no desenho.
const npcs = {
  viajante1: {
    id: "viajante1",
    nome: "Eliabe",
    x: 2,
    y: 5,
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
        vida: 100,
        inventario: [],
      };
    }

    this.jogadores[id] = personagem;
    return personagem;
  },

  executar(id, comando) {
    const personagem = this.jogadores[id];

    if (!personagem) {
      return { ok: false };
    }

    if (comando.tipo === "mover") {
      const novoX = personagem.x + comando.dx;
      const novoY = personagem.y + comando.dy;

      if (!mapa[novoY] || mapa[novoY][novoX] !== 0) {
        return { ok: false };
      }

      const npcOcupandoCasa = Object.values(npcs).some(
        (npc) => npc.x === novoX && npc.y === novoY
      );

      if (npcOcupandoCasa) {
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
        return { ok: false, mensagem: "Não encontrei esse personagem." };
      }

      const distancia =
        Math.abs(personagem.x - npc.x) +
        Math.abs(personagem.y - npc.y);

      if (distancia > 1) {
        return { ok: false, mensagem: "Chegue mais perto para conversar." };
      }

      return {
        ok: true,
        mensagem:
          `${npc.nome}: Paz, viajante! Nossa jornada começa no princípio. ` +
          "Explore com atenção e procure aprender com as histórias.",
      };
    }

    return { ok: false };
  },
};