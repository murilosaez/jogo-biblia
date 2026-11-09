const MEU_ID = "jogador1";
const PIXEL_PATTERNS = {
  jogador: { cores: { "1": "#34261e", "2": "#d9a06c", "3": "#315e9b", "4": "#e6c548", "5": "#493328" }, linhas: ["....1111....", "...122221...", "...122221...", "....1111....", "...333333...", "..33333333..", "..33333333..", "...333333...", "....3333....", "....5555....", "...555555...", "...555555...", "...555555...", "...55..55...", "...55..55...", "..555..555.."] },
  eliabe: { cores: { "1": "#4a2f20", "2": "#c98d5b", "3": "#446e8a", "4": "#e4d6bd", "5": "#76513b" }, linhas: ["....1111....", "...122221...", "...122221...", "....1111....", "...444444...", "..44444444..", "..33333333..", "...333333...", "....3333....", "....3333....", "....3333....", "....5555....", "...555555...", "...555555...", "...55..55...", "..555..555.."] },
  noemi: { cores: { "1": "#553b2d", "2": "#d69a6b", "3": "#874d36", "4": "#c7a45b", "5": "#473225" }, linhas: ["....1111....", "...122221...", "...122221...", "..11111111..", "...444444...", "..44444444..", "..33333333..", ".3333333333.", ".3333333333.", "..33333333..", "..33333333..", "...333333...", "...555555...", "...555555...", "..555..555..", "..555..555.."] },
  lobo: { cores: { "1": "#713c35", "2": "#a85243", "3": "#e6c8a8", "4": "#2a1d1a" }, linhas: ["...1....1...", "..111..111..", ".1111111111.", "111221122111", "112221122211", ".1222222221.", "..22222222..", "...222222...", "..222..222..", ".2222..2222.", ".2222..2222.", "..44....44.."] },
  escorpiao: { cores: { "1": "#462519", "2": "#9e492b", "3": "#d5773d", "4": "#f0c34e" }, linhas: ["......11....", ".....1331...", ".....1331...", "......11....", "..11..11..11", ".1331111331.", "113333333311", ".1333333331.", "..11333311..", ".11.3333.11.", "11..3333..11", "....3333...."] },
  erva: { cores: { "1": "#285b2b", "2": "#63b84e", "3": "#a3d85d", "4": "#785531" }, linhas: ["......2.....", ".....222....", "....2222....", "......2.....", "..222.2.222..", ".23332222332.", "..222.2.222..", "......2.....", "......2.....", ".....444....", ".....444....", ".....444...."] },
  odre: { cores: { "1": "#503521", "2": "#a66b39", "3": "#d3a657", "4": "#e9d29a" }, linhas: ["....1111....", "....3333....", "....1111....", "...222222...", "..22222222..", ".2222222222.", ".2222222222.", ".2222442222.", ".2222442222.", "..22222222..", "...222222...", "....1111...."] },
};

class Cena extends Phaser.Scene {
  create() {
    this.teclas = this.input.keyboard.createCursorKeys();
    this.teclaE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.teclaAtaque = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.teclaPocao = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.personagem = Mundo.entrar(MEU_ID);
    this.areaAtual = this.personagem.area;
    this.movendo = false;
    this.respawnsAgendados = new Set();
    this.spritesInimigos = {};
    this.spritesItens = {};
    this.criarTexturas();
    this.desenharMapa();
    this.desenharPassagem();
    this.sprite = this.add.image(this.personagem.x * TILE + TILE / 2, this.personagem.y * TILE + TILE / 2, "jogador").setDepth(6);
    this.sprite.setScale(1);
    this.desenharEntidades();
    this.criarHud();
    this.atualizarStatus();
  }
  criarTexturas() {
    for (const [nome, def] of Object.entries(PIXEL_PATTERNS)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      def.linhas.forEach((linha, y) => [...linha].forEach((ch, x) => { if (def.cores[ch]) { g.fillStyle(Phaser.Display.Color.HexStringToColor(def.cores[ch]).color, 1); g.fillRect(x * 2, y * 2, 2, 2); } }));
      g.generateTexture(nome, 24, 24); g.destroy();
    }
    for (const areaId of ["canaan", "deserto"]) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      if (areaId === "canaan") {
        g.fillStyle(0x3e722f); g.fillRect(4, 5, 24, 23); g.fillStyle(0x579344); g.fillRect(1, 3, 12, 13); g.fillRect(18, 0, 13, 14); g.fillStyle(0x2c5228); g.fillRect(8, 11, 15, 14);
      } else {
        g.fillStyle(0x8a6840); g.fillRect(4, 11, 24, 17); g.fillStyle(0xb28b55); g.fillRect(1, 7, 20, 12); g.fillStyle(0x715331); g.fillRect(8, 16, 18, 10);
      }
      g.generateTexture("obstaculo_" + areaId, 32, 32); g.destroy();
    }
  }
  desenharMapa() {
    const mapa = mapas[this.areaAtual];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
      const cor = this.areaAtual === "canaan" ? (mapa[y][x] ? 0x688954 : 0x8fbf6a) : (mapa[y][x] ? 0x9b7b4d : 0xd6bd78);
      this.add.rectangle(cx, cy, TILE, TILE, cor).setStrokeStyle(1, 0x342b1d, 0.08);
      if (mapa[y][x] === 1) this.add.image(cx, cy, "obstaculo_" + this.areaAtual).setDepth(1);
      else if (this.areaAtual === "deserto" && ((x * 13 + y * 7) % 37 === 0)) this.add.circle(cx, cy, 2, 0x9b7b4d, 0.38).setDepth(1);
    }
  }
  desenharPassagem() {
    const p = areas[this.areaAtual].passagem, x = p.x * TILE + 16, y = p.y * TILE + 16;
    this.add.circle(x, y, 12, 0x22c9e8, 0.85).setStrokeStyle(3, 0xe7fcff).setDepth(2);
    this.add.text(x, y - 25, "PASSAGEM", { fontFamily: "Arial", fontSize: "10px", color: "#fff", backgroundColor: "#173d49", padding: { x: 3, y: 2 } }).setOrigin(0.5).setDepth(3);
  }
  desenharEntidades() {
    const p = this.personagem;
    for (const npc of Object.values(npcs).filter((n) => n.area === p.area)) {
      const x = npc.x * TILE + 16, y = npc.y * TILE + 16;
      this.add.image(x, y, npc.id === "viajante1" ? "eliabe" : "noemi").setDepth(5);
      this.add.text(x, y - 27, npc.nome, { fontFamily: "Arial", fontSize: "12px", color: "#fff", backgroundColor: "#222", padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(7);
    }
    if (p.area === "canaan") {
      for (const item of ervas) if (!p.ervasColetadas.includes(item.id)) this.criarItem(item, "erva", "erva");
    } else {
      for (const item of odres) if (!p.odresColetados.includes(item.id)) this.criarItem(item, "odre", "odre_agua");
    }
    for (const e of Object.values(inimigos).filter((x) => x.area === p.area)) {
      if (Mundo.obterVidaInimigo(MEU_ID, e.id) > 0) this.criarInimigo(e);
      else this.agendarRespawn(e.id);
    }
  }
  criarItem(item, textura, itemId) {
    this.spritesItens[item.id] = this.add.image(item.x * TILE + 16, item.y * TILE + 16, textura).setDepth(4);
    this.spritesItens[item.id].setData("itemId", itemId);
  }
  criarInimigo(e) {
    if (this.spritesInimigos[e.id]) this.spritesInimigos[e.id].destroy(true);
    const texture = e.id === "lobo1" ? "lobo" : "escorpiao";
    const x = e.x * TILE + 16, y = e.y * TILE + 16;
    const imagem = this.add.image(0, 7, texture);
    const etiqueta = this.add.text(0, -15, e.nome, { fontFamily: "Arial", fontSize: "11px", color: "#fff", backgroundColor: "#222", padding: { x: 3, y: 1 } }).setOrigin(0.5);
    this.spritesInimigos[e.id] = this.add.container(x, y, [imagem, etiqueta]).setDepth(7);
  }
  agendarRespawn(enemyId) {
    if (this.respawnsAgendados.has(enemyId)) return;
    this.respawnsAgendados.add(enemyId);
    this.time.delayedCall(TEMPO_RESPAWN_INIMIGO, () => {
      this.respawnsAgendados.delete(enemyId);
      const e = inimigos[enemyId];
      if (this.areaAtual === e.area && Mundo.reaparecerInimigo(MEU_ID, enemyId)) {
        this.criarInimigo(e); this.dialogo.setText(`${e.nome} reapareceu.`); this.atualizarStatus();
      }
    });
  }
  criarHud() {
    const box = { fontFamily: "Arial", fontSize: "14px", color: "#fff", backgroundColor: "#222d", padding: { x: 6, y: 4 } };
    this.statusVida = this.add.text(10, 8, "", { ...box, fontSize: "15px" }).setDepth(10);
    this.statusArea = this.add.text(400, 8, "", box).setOrigin(0.5, 0).setDepth(10);
    this.statusInimigo = this.add.text(790, 8, "", box).setOrigin(1, 0).setDepth(10);
    this.statusXP = this.add.text(10, 37, "", box).setDepth(10);
    this.statusInventario = this.add.text(400, 37, "", box).setOrigin(0.5, 0).setDepth(10);
    this.statusMissao = this.add.text(10, 70, "", { ...box, fontSize: "13px", wordWrap: { width: 770 } }).setDepth(10);
    this.add.rectangle(400, 548, 790, 48, 0x111111, 0.9).setScrollFactor(0).setDepth(10);
    this.dialogo = this.add.text(16, 531, "Setas: andar | E: conversar | Espaço: atacar | H: usar poção", { fontFamily: "Arial", fontSize: "16px", color: "#fff", wordWrap: { width: 760 } }).setScrollFactor(0).setDepth(11);
  }
  textoMissao() {
    const p = this.personagem;
    if (p.area === "canaan") {
      if (p.missaoEliabe.status === "nao_iniciada") return "Missão: fale com Eliabe.";
      if (p.missaoEliabe.status === "em_andamento") return p.missaoEliabe.loboDerrotado ? "Missão: volte a Eliabe." : "Missão: derrote o lobo e volte a Eliabe.";
      if (p.missaoErvas.status === "bloqueada") return "Missão: fale com Eliabe para outra tarefa.";
      if (p.missaoErvas.status === "em_andamento") return `Missão: colete ervas novas (${p.missaoErvas.ervasMissaoColetadas.length}/${QUANTIDADE_ERVAS_MISSAO}).`;
      return "Tarefas de Canaã concluídas.";
    }
    const m = p.missaoDeserto;
    if (m.status === "bloqueada") return "Missão: encontre Noemi perto do acampamento.";
    if (m.status === "em_andamento") return `Missão: encontre 3 odres de água (${m.odresMissaoColetados.length}/${QUANTIDADE_ODRES_MISSAO}) e volte a Noemi.`;
    return "Missão do Deserto concluída. Explore a região!";
  }
  atualizarStatus() {
    const p = this.personagem, maxVida = vidaMaxima(p), next = limiarNivel(p.nivel);
    this.statusArea.setText(`Área: ${areas[p.area].nome}`);
    this.statusVida.setText(`Vida: ${p.vida}/${maxVida}`);
    this.statusXP.setText(`Nível ${p.nivel} | XP: ${p.xp}/${next}`);
    const inv = `Poções: ${Mundo.contarItem(MEU_ID, "pocao")} | Ervas: ${Mundo.contarItem(MEU_ID, "erva")} | Odres: ${Mundo.contarItem(MEU_ID, "odre_agua")}`;
    this.statusInventario.setText(inv);
    this.statusMissao.setText(this.textoMissao());
    const e = Object.values(inimigos).find((x) => x.area === p.area);
    if (!e) this.statusInimigo.setText("");
    else { const hp = Mundo.obterVidaInimigo(MEU_ID, e.id); this.statusInimigo.setText(hp > 0 ? `${e.nome}: ${hp}/${e.vidaMaxima}` : `${e.nome}: aguardando respawn`); }
  }
  interagir() {
    const r = Mundo.executar(MEU_ID, { tipo: "interagir" });
    if (r.mensagem) this.dialogo.setText(r.mensagem);
    if (r.ok) this.atualizarStatus();
  }
  atacar() {
    const r = Mundo.executar(MEU_ID, { tipo: "atacar" });
    if (r.mensagem) this.dialogo.setText(r.mensagem);
    if (r.derrotado) { const id = r.inimigoId; if (this.spritesInimigos[id]) { this.spritesInimigos[id].destroy(true); delete this.spritesInimigos[id]; } this.agendarRespawn(id); }
    this.atualizarStatus();
  }
  update() {
    const eventos = Mundo.atualizar(MEU_ID, Date.now());
    for (const ev of eventos) {
      if (ev.tipo === "inimigoMoveu" && this.spritesInimigos[ev.id]) { const e = inimigos[ev.id]; this.tweens.add({ targets: this.spritesInimigos[ev.id], x: e.x * TILE + 16, y: e.y * TILE + 16, duration: 250 }); }
      if (ev.tipo === "jogadorAtingido") this.dialogo.setText(ev.mensagem);
      if (ev.tipo === "renasceu") { this.scene.restart(); return; }
    }
    if (eventos.length) this.atualizarStatus();
    if (Phaser.Input.Keyboard.JustDown(this.teclaE)) this.interagir();
    if (Phaser.Input.Keyboard.JustDown(this.teclaAtaque)) this.atacar();
    if (Phaser.Input.Keyboard.JustDown(this.teclaPocao)) { const r = Mundo.executar(MEU_ID, { tipo: "usarPocao" }); if (r.mensagem) this.dialogo.setText(r.mensagem); this.atualizarStatus(); }
    if (this.movendo) return;
    let dx = 0, dy = 0;
    if (this.teclas.left.isDown) dx = -1; else if (this.teclas.right.isDown) dx = 1; else if (this.teclas.up.isDown) dy = -1; else if (this.teclas.down.isDown) dy = 1;
    if (!dx && !dy) return;
    const r = Mundo.executar(MEU_ID, { tipo: "mover", dx, dy });
    if (!r.ok) return;
    if (r.areaAlterada) { this.scene.restart(); return; }
    if (r.itemColetado) {
      if (this.spritesItens[r.itemColetado]) { this.spritesItens[r.itemColetado].destroy(); delete this.spritesItens[r.itemColetado]; }
      this.dialogo.setText(r.mensagem); this.atualizarStatus();
    }
    this.personagem = Mundo.jogadores[MEU_ID];
    this.movendo = true;
    this.tweens.add({ targets: this.sprite, x: this.personagem.x * TILE + 16, y: this.personagem.y * TILE + 16, duration: 120, onComplete: () => { this.movendo = false; } });
  }
}
new Phaser.Game({ type: Phaser.AUTO, parent: "game", width: COLS * TILE, height: ROWS * TILE, pixelArt: true, scene: Cena });
