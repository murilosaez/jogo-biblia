const MEU_ID = "jogador1";

class Cena extends Phaser.Scene {
  create() {
    this.teclas = this.input.keyboard.createCursorKeys();
    this.teclaE = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.E
    );

    // Desenha o mapa.
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cor = mapa[y][x] === 1 ? 0x2d5a27 : 0x8fbf6a;

        this.add
          .rectangle(
            x * TILE + TILE / 2,
            y * TILE + TILE / 2,
            TILE,
            TILE,
            cor
          )
          .setStrokeStyle(1, 0x000000, 0.1);
      }
    }

    // Entra no mundo e desenha o jogador.
    const personagem = Mundo.entrar(MEU_ID);

    this.movendo = false;
    this.sprite = this.add.rectangle(
      personagem.x * TILE + TILE / 2,
      personagem.y * TILE + TILE / 2,
      TILE - 8,
      TILE - 8,
      0xffd700
    );

    // Desenha Eliabe usando formas simples, sem baixar imagens.
    const npc = npcs.viajante1;
    const npcX = npc.x * TILE + TILE / 2;
    const npcY = npc.y * TILE + TILE / 2;

    this.add.circle(npcX, npcY - 7, 7, 0xf1c27d);
    this.add.rectangle(npcX, npcY + 7, 18, 18, 0x446e8a);

    this.add
      .text(npcX, npcY - 31, npc.nome, {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);

    // Caixa de instrução e diálogo.
    this.add
      .rectangle(400, 548, 790, 48, 0x111111, 0.9)
      .setScrollFactor(0)
      .setDepth(10);

    this.dialogo = this.add
      .text(16, 531, "Fale com Eliabe: aproxime-se e pressione E.", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        wordWrap: { width: 760 },
      })
      .setScrollFactor(0)
      .setDepth(11);
  }

  update() {
    // Interação com o NPC: o comando vai para a lógica do jogo.
    if (Phaser.Input.Keyboard.JustDown(this.teclaE)) {
      const resultado = Mundo.executar(MEU_ID, {
        tipo: "interagir",
        alvoId: "viajante1",
      });

      if (resultado.mensagem) {
        this.dialogo.setText(resultado.mensagem);
      }
    }

    if (this.movendo) {
      return;
    }

    let dx = 0;
    let dy = 0;

    if (this.teclas.left.isDown) {
      dx = -1;
    } else if (this.teclas.right.isDown) {
      dx = 1;
    } else if (this.teclas.up.isDown) {
      dy = -1;
    } else if (this.teclas.down.isDown) {
      dy = 1;
    }

    if (!dx && !dy) {
      return;
    }

    const resultado = Mundo.executar(MEU_ID, {
      tipo: "mover",
      dx,
      dy,
    });

    if (!resultado.ok) {
      return;
    }

    const personagem = Mundo.jogadores[MEU_ID];
    this.movendo = true;

    this.tweens.add({
      targets: this.sprite,
      x: personagem.x * TILE + TILE / 2,
      y: personagem.y * TILE + TILE / 2,
      duration: 120,
      onComplete: () => {
        this.movendo = false;
      },
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: COLS * TILE,
  height: ROWS * TILE,
  scene: Cena,
});