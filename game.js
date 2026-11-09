const MEU_ID = "jogador1";
const TEMPO_RESPAWN_LOBO = 5000;

class Cena extends Phaser.Scene {
  create() {
    this.teclas = this.input.keyboard.createCursorKeys();

    this.teclaE = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.E
    );

    this.teclaAtaque = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    this.teclaPocao = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.H
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

    const personagem = Mundo.entrar(MEU_ID);

    this.movendo = false;
    this.respawnAgendado = false;
    this.loboVisual = null;

    this.sprite = this.add.rectangle(
      personagem.x * TILE + TILE / 2,
      personagem.y * TILE + TILE / 2,
      TILE - 8,
      TILE - 8,
      0xffd700
    );

    // Desenha Eliabe.
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

    if (Mundo.obterVidaInimigo(MEU_ID, "lobo1") > 0) {
      this.loboVisual = this.desenharLobo();
    } else {
      this.agendarRespawnLobo();
    }

    this.statusVida = this.add
      .text(12, 10, "", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { x: 6, y: 4 },
      })
      .setDepth(10);

    this.statusLobo = this.add
      .text(788, 10, "", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(1, 0)
      .setDepth(10);

    this.statusPocoes = this.add
      .text(400, 10, "", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    this.add
      .rectangle(400, 548, 790, 48, 0x111111, 0.9)
      .setScrollFactor(0)
      .setDepth(10);

    this.dialogo = this.add
      .text(
        16,
        531,
        "Setas: andar | E: conversar | Espaço: atacar | H: usar poção",
        {
          fontFamily: "Arial",
          fontSize: "16px",
          color: "#ffffff",
          wordWrap: { width: 760 },
        }
      )
      .setScrollFactor(0)
      .setDepth(11);

    this.atualizarStatus();
  }

  desenharLobo() {
    const lobo = inimigos.lobo1;
    const loboX = lobo.x * TILE + TILE / 2;
    const loboY = lobo.y * TILE + TILE / 2;

    const corpo = this.add.circle(0, 0, 12, 0xb53030);
    const olhoEsq = this.add.circle(-4, -2, 2, 0xffffff);
    const olhoDir = this.add.circle(4, -2, 2, 0xffffff);

    const nome = this.add
      .text(0, -30, lobo.nome, {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);

    const grupo = this.add.container(loboX, loboY, [
      corpo,
      olhoEsq,
      olhoDir,
      nome,
    ]);

    grupo.setDepth(5);
    return grupo;
  }

  agendarRespawnLobo() {
    if (this.respawnAgendado) {
      return;
    }

    this.respawnAgendado = true;

    this.time.delayedCall(TEMPO_RESPAWN_LOBO, () => {
      this.respawnAgendado = false;

      const reapareceu = Mundo.reaparecerInimigo(MEU_ID, "lobo1");

      if (reapareceu) {
        this.loboVisual = this.desenharLobo();
        this.dialogo.setText("O lobo reapareceu!");
        this.atualizarStatus();
      }
    });
  }

  atualizarStatus() {
    const personagem = Mundo.jogadores[MEU_ID];
    const vidaLobo = Mundo.obterVidaInimigo(MEU_ID, "lobo1");
    const quantidadePocoes = Mundo.contarItem(MEU_ID, "pocao");

    this.statusVida.setText(
      `Vida: ${personagem.vida}/${VIDA_MAXIMA_JOGADOR}`
    );

    this.statusPocoes.setText(`Poções: ${quantidadePocoes}`);

    if (vidaLobo > 0) {
      this.statusLobo.setText(
        `Lobo: ${vidaLobo}/${inimigos.lobo1.vidaMaxima}`
      );
    } else {
      this.statusLobo.setText("Lobo: aguardando respawn");
    }
  }

  update() {
    // Atualiza perseguição, ataques inimigos e regeneração.
    const eventos = Mundo.atualizar(MEU_ID, Date.now());

    for (const evento of eventos) {
      if (evento.tipo === "inimigoMoveu" && this.loboVisual) {
        const lobo = inimigos[evento.id];

        this.tweens.add({
          targets: this.loboVisual,
          x: lobo.x * TILE + TILE / 2,
          y: lobo.y * TILE + TILE / 2,
          duration: 250,
        });
      }

      if (evento.tipo === "jogadorAtingido") {
        this.dialogo.setText(evento.mensagem);
      }

      if (evento.tipo === "renasceu") {
        const personagem = Mundo.jogadores[MEU_ID];
        const lobo = inimigos.lobo1;

        this.dialogo.setText(evento.mensagem);

        this.tweens.killTweensOf(this.sprite);
        this.movendo = false;

        this.sprite.setPosition(
          personagem.x * TILE + TILE / 2,
          personagem.y * TILE + TILE / 2
        );

        if (this.loboVisual) {
          this.tweens.killTweensOf(this.loboVisual);
          this.loboVisual.setPosition(
            lobo.x * TILE + TILE / 2,
            lobo.y * TILE + TILE / 2
          );
        }
      }
    }

    if (eventos.length > 0) {
      this.atualizarStatus();
    }

    // Conversa com Eliabe.
    if (Phaser.Input.Keyboard.JustDown(this.teclaE)) {
      const resultado = Mundo.executar(MEU_ID, {
        tipo: "interagir",
        alvoId: "viajante1",
      });

      if (resultado.mensagem) {
        this.dialogo.setText(resultado.mensagem);
      }
    }

    // Ataca o lobo com Espaço.
    if (Phaser.Input.Keyboard.JustDown(this.teclaAtaque)) {
      const resultado = Mundo.executar(MEU_ID, {
        tipo: "atacar",
        alvoId: "lobo1",
      });

      if (resultado.mensagem) {
        this.dialogo.setText(resultado.mensagem);
      }

      if (resultado.derrotado && this.loboVisual) {
        this.tweens.killTweensOf(this.loboVisual);
        this.loboVisual.destroy();
        this.loboVisual = null;
        this.agendarRespawnLobo();
      }

      this.atualizarStatus();
    }

    // Usa uma poção com H.
    if (Phaser.Input.Keyboard.JustDown(this.teclaPocao)) {
      const resultado = Mundo.executar(MEU_ID, {
        tipo: "usarPocao",
      });

      if (resultado.mensagem) {
        this.dialogo.setText(resultado.mensagem);
      }

      this.atualizarStatus();
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