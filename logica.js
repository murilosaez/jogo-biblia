const TILE = 32;
const COLS = 25;
const ROWS = 18;
const VERSAO_SAVE = 1;

// Mapa: 1 = obstáculo, 0 = chão
const mapa = [];
for (let y = 0; y < ROWS; y++) {
  mapa[y] = [];
  for (let x = 0; x < COLS; x++) {
    const borda = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
    const obstaculo = x % 6 === 3 && y % 4 === 2;
    mapa[y][x] = borda || obstaculo ? 1 : 0;
  }
}

const Mundo = {
  jogadores: {}, // guardados por ID

  // Carrega o save ou cria um personagem novo
  entrar(id) {
    let p = Storage.carregar(id);
    if (!p) {
      p = { versao: VERSAO_SAVE, id: id, x: 2, y: 2, vida: 100, inventario: [] };
    }
    this.jogadores[id] = p;
    return p;
  },

  // Toda ação do jogador entra aqui como um comando
  executar(id, comando) {
    const p = this.jogadores[id];
    if (!p) return { ok: false };

    if (comando.tipo === "mover") {
      const nx = p.x + comando.dx;
      const ny = p.y + comando.dy;
      if (mapa[ny] === undefined || mapa[ny][nx] !== 0) return { ok: false };
      p.x = nx;
      p.y = ny;
      Storage.salvar(p);
      return { ok: true };
    }

    return { ok: false };
  },
};