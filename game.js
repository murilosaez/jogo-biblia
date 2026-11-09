const MEU_ID = "jogador1";

class Cena extends Phaser.Scene {
  create() {
    this.teclas = this.input.keyboard.createCursorKeys();

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cor = mapa[y][x] === 1 ? 0x2d5a27 : 0x8fbf6a;
        this.add
          .rectangle(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE, TILE, cor)
          .setStrokeStyle(1, 0x000000, 0.1);
      }
    }

    const eu = Mundo.entrar(MEU_ID);
    this.movendo = false;
    this.sprite = this.add.rectangle(
      eu.x * TILE + TILE / 2,
      eu.y * TILE + TILE / 2,
      TILE - 8, TILE - 8, 0xffd700
    );
  }

  update() {
    if (this.movendo) return;

    let dx = 0, dy = 0;
    if (this.teclas.left.isDown) dx = -1;
    else if (this.teclas.right.isDown) dx = 1;
    else if (this.teclas.up.isDown) dy = -1;
    else if (this.teclas.down.isDown) dy = 1;
    if (!dx && !dy) return;

    const r = Mundo.executar(MEU_ID, { tipo: "mover", dx, dy });
    if (!r.ok) return;

    const eu = Mundo.jogadores[MEU_ID];
    this.movendo = true;
    this.tweens.add({
      targets: this.sprite,
      x: eu.x * TILE + TILE / 2,
      y: eu.y * TILE + TILE / 2,
      duration: 120,
      onComplete: () => (this.movendo = false),
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: COLS * TILE,
  height: ROWS * TILE,
  scene: Cena,
});