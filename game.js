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

    const personagem = Mundo.entrar(MEU_ID);
    this.areaAtual = personagem.area;
    this.movendo = false;
    this.respawnAgendado = false;
    this.loboVisual = null;
    this.ervasVisuais = {};

    this.desenharMapa();
    this.desenharPassagem();

    this.sprite = this.add.rectangle(
      personagem.x * TILE + TILE / 2,
      personagem.y * TILE + TILE / 2,
      TILE - 8,
      TILE - 8,
      0xffd700
    );

    if (this.areaAtual === "canaan") {
      this.desenharEliabe();
      this.desenharErvas();

      if (Mundo.obterVidaInimigo(MEU_ID, "lobo1") > 0) {
        this.loboVisual = this.desenharLobo();
      } else {
        this.agendarRespawnLobo();
      }
    }

    this.statusArea = this.add
      .text(400, 10, "", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

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

    this.statusInventario = this.add
      .text(400, 35, "", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    this.statusMissao = this.add
      .text(12, 40, "", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { x: 6, y: 4 },
      })
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

  desenharMapa() {
    const mapaAtual = mapas[this.areaAtual];

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        let cor;

        if (this.areaAtual === "canaan") {
          cor = mapaAtual[y][x] === 1 ? 0x2d5a27 : 0x8fbf6a;
        } else {
          cor = mapaAtual[y][x] === 1 ? 0x80643b : 0xd6bd78;
        }

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
  }

  desenharPassagem() {
    const passagem = areas[this.areaAtual].passagem;
    const x = passagem.x * TILE + TILE / 2;
    const y = passagem.y * TILE + TILE / 2;

    this.add
      .circle(x, y, 13, 0x22c9e8, 0.85)
      .setStrokeStyle(3, 0xe7fcff, 1)
      .setDepth(2);

    this.add
      .text(x, y - 25, "PASSAGEM", {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#ffffff",
        backgroundColor: "#173d49",
        padding: { x: 3, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(3);
  }

  desenharEliabe() {
    const npc = npcs.viajante1;
    const x = npc.x * TILE + TILE / 2;
    const y = npc.y * TILE + TILE / 2;

    this.add.circle(x, y - 7, 7, 0xf1c27d);
    this.add.rectangle(x, y + 7, 18, 18, 0x446e8a);

    this.add
      .text(x, y - 31, npc.nome, {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);
  }

  desenharErvas() {
    const personagem = Mundo.jogadores[MEU_ID];

    for (const erva of ervas) {
      if (personagem.ervasColetadas.includes(erva.id)) {
        continue;
      }

      const x = erva.x * TILE + TILE / 2;
      const y = erva.y * TILE + TILE / 2;

      this.ervasVisuais[erva.id] = [
        this.add.circle(x, y, 7, 0x2b7a36),
        this.add.circle(x - 5, y + 4, 4, 0x7ee36a),
        this.add.circle(x + 5, y + 4, 4, 0x7ee36a),
        this.add.rectangle(x, y + 8, 3, 8, 0x5b3a1e),
      ];
    }
  }

  atualizarVisualErvas() {
    for (const partes of Object.values(this.ervasVisuais)) {
      partes.forEach((parte) => parte.destroy());
    }

    this.ervasVisuais = {};
    this.desenharErvas();
  }

  desenharLobo() {
    const lobo = inimigos.lobo1;
    const x = lobo.x * TILE + TILE / 2;
    const y = lobo.y * TILE + TILE / 2;

    const grupo = this.add.container(x, y, [
      this.add.circle(0, 0, 12, 0xb53030),
      this.add.circle(-4, -2, 2, 0xffffff),
      this.add.circle(4, -2, 2, 0xffffff),
      this.add
        .text(0, -30, lobo.nome, {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#ffffff",
          backgroundColor: "#222222",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5),
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

      if (
        this.areaAtual === "canaan" &&
        Mundo.reaparecerInimigo(MEU_ID, "lobo1")
      ) {
        this.loboVisual = this.desenharLobo();
        this.dialogo.setText("O lobo reapareceu!");
        this.atualizarStatus();
      }
    });
  }

  textoObjetivoMissao() {
    const personagem = Mundo.jogadores[MEU_ID];

    if (personagem.area !== "canaan") {
      return "Explore a área e encontre a passagem para voltar.";
    }

    const missao1 = personagem.missaoEliabe;
    const missao2 = personagem.missaoErvas;
    const quantidadeErvas = missao2.progresso || 0;

    if (missao1.status === "nao_iniciada") {
      return "Missão: fale com Eliabe para começar.";
    }

    if (
      missao1.status === "em_andamento" &&
      missao1.loboDerrotado
    ) {
      return "Missão: volte até Eliabe para concluir.";
    }

    if (missao1.status === "em_andamento") {
      return "Missão: derrote o lobo e volte até Eliabe.";
    }

    if (missao2.status === "bloqueada") {
      return "Missão: fale com Eliabe para receber outra tarefa.";
    }

    if (missao2.status === "em_andamento") {
      return (
        `Missão: colete ervas e volte até Eliabe ` +
        `(${quantidadeErvas}/${QUANTIDADE_ERVAS_MISSAO}).`
      );
    }

    return "Missões de teste concluídas.";
  }

  atualizarStatus() {
    const personagem = Mundo.jogadores[MEU_ID];
    const vidaLobo = Mundo.obterVidaInimigo(MEU_ID, "lobo1");
    const pocoes = Mundo.contarItem(MEU_ID, "pocao");
    const quantidadeErvas = Mundo.contarItem(MEU_ID, "erva");

    this.statusArea.setText(`Área: ${areas[personagem.area].nome}`);
    this.statusVida.setText(
      `Vida: ${personagem.vida}/${VIDA_MAXIMA_JOGADOR}`
    );
    this.statusInventario.setText(
      `Poções: ${pocoes} | Ervas: ${quantidadeErvas}`
    );
    this.statusMissao.setText(this.textoObjetivoMissao());

    if (personagem.area !== "canaan") {
      this.statusLobo.setText("");
    } else if (vidaLobo > 0) {
      this.statusLobo.setText(
        `Lobo: ${vidaLobo}/${inimigos.lobo1.vidaMaxima}`
      );
    } else {
      this.statusLobo.setText("Lobo: aguardando respawn");
    }
  }

  update() {
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

        this.dialogo.setText(evento.mensagem);
        this.scene.restart();
        return;
      }
    }

    if (eventos.length > 0) {
      this.atualizarStatus();
    }

    if (Phaser.Input.Keyboard.JustDown(this.teclaE)) {
      const resultado = Mundo.executar(MEU_ID, {
        tipo: "interagir",
        alvoId: "viajante1",
      });

      if (resultado.mensagem) {
        this.dialogo.setText(resultado.mensagem);
      }

      if (resultado.missaoErvasIniciada) {
        this.atualizarVisualErvas();
      }

      this.atualizarStatus();
    }

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

    if (resultado.areaAlterada) {
      this.scene.restart();
      return;
    }

    if (resultado.ervaColetada) {
      const partes = this.ervasVisuais[resultado.ervaColetada];

      if (partes) {
        partes.forEach((parte) => parte.destroy());
        delete this.ervasVisuais[resultado.ervaColetada];
      }

      this.dialogo.setText(resultado.mensagem);
      this.atualizarStatus();
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