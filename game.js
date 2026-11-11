// =====================================================================
// game.js — MUNDO: cena Phaser (mapa, entidades, efeitos), entrada de
// teclado do mundo, fachada window.Jogo e boot.
//
// A arte vem de sprites.js (window.Arte). Toda a UI DOM (painéis,
// modais, atalhos, toque) fica em interface.js (window.UI).
// =====================================================================
const MEU_ID = "jogador1";

// ---------------------------------------------------------------------
// Constantes visuais
// ---------------------------------------------------------------------
const TAM = 32; // tile em px de mundo
const MOLDURA = 4; // tiles de cenário fora do mapa
const FONTE_PIXEL = '"Pixelify Sans", ui-monospace, monospace';
const FONTE_TITULO = '"Cinzel", Georgia, serif';
const FONTE_TEXTO = '"Alegreya Sans", system-ui, sans-serif';

const PROF = {
  moldura: -10, chao: 0, deco: 1, sombraContato: 2, marcadorChao: 3, sombra: 5,
  entidade: 10000, barra: 19000, rotulo: 20000, numero: 21000, luz: 29000, cartao: 30000,
};

const ESTILO_NUM = {
  dano: ["#f6e6bd", 14], critico: ["#ffd24a", 20], recebido: ["#ff7a5c", 14], cura: ["#8fd16a", 14],
  fe: ["#7fa3e0", 13], xp: ["#f2cf6a", 12], moeda: ["#e8b94a", 12], veneno: ["#a8c84a", 12],
  bloqueio: ["#b9c6d6", 11], errou: ["#b9a27a", 11],
};

const COR = {
  amigo: "#f3e4c0", hostil: "#ef6a5e", saida: "#b98ad0", agua: "#6fd0d0", tinta: "#1c1210",
  fechada: "#b9a27a", // portal de capítulo ainda não liberado
};

const reduzMovimento = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const centroX = (x) => x * TAM + TAM / 2;
const baseY = (y) => y * TAM + TAM - 1;
const hexNum = (h) => parseInt(h.replace("#", "").slice(0, 6), 16);

// ---------------------------------------------------------------------
// Cena
// ---------------------------------------------------------------------
class Cena extends Phaser.Scene {
  constructor() {
    super("mundo");
  }

  // ===== criação ======================================================
  create() {
    this.p = Mundo.entrar(MEU_ID);
    this.areaAtual = this.p.area;
    this.bio = Arte.BIOMAS[this.areaAtual] || Arte.BIOMAS.canaan;
    this.trocando = false;
    this.proximoPasso = 0;
    this.proximoAutoAtaque = 0;
    this.ultimoAutoAtaque = 0;
    this.alvoId = null;
    this.hoverId = null;
    this.respawns = new Set();
    this.entidades = {}; // id → {tipo, dados, sprite, sombra, rotulo, balao, ...}
    this.spritesItens = {};
    this.copas = [];
    this.animados = [];
    this.marcadores = [];
    this.proximaAtualizacaoColetaveis = 0;
    this.proximoMinimapa = 0;
    this.proximosRotulos = 0;
    this.proximoBalao = 0;
    this.nivelAnterior = this.p.nivel;
    this.vidaBaixa = false;

    Arte.registrarTexturas(this);
    this.criarTecladoEPonteiro();
    this.criarChao();
    this.criarObstaculos();
    this.criarDecoracaoHubs();
    this.criarMarcadores();
    this.desenharColetaveis();
    if (this.areaAtual === "mar") this.desenharPontosPesca();
    this.criarSaques();
    this.criarNpcs();
    for (const e of Object.values(inimigos).filter((e) => e.area === this.areaAtual)) {
      if (Mundo.obterVidaInimigo(MEU_ID, e.id) > 0) this.criarInimigo(e);
      else this.agendarRespawn(e.id);
    }
    this.criarJogador();
    this.criarEfeitosDeMundo();
    this.criarCamera();
    this.criarAtmosfera();
    this.criarAmbiente();

    window.gameScene = this;
    if (window.Jogo) window.Jogo.pronto = true;
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.aoRedimensionar, this);
      if (window.gameScene === this) window.gameScene = null;
    });

    // Fade de entrada e cartão de título quando a área muda.
    const cam = this.cameras.main;
    cam.fadeIn(400, 28, 18, 16);
    const ultima = this.registry.get("ultimaArea");
    if (ultima !== this.areaAtual) this.mostrarCartao();
    this.registry.set("ultimaArea", this.areaAtual);
    window.UI?.areaMudou?.(this.areaAtual);
    window.atualizarInterface?.();

    // Mensagens: a pendente (morte, viagem) tem prioridade; depois os avisos da lógica.
    const pendente = this.registry.get("mensagemPendente");
    this.registry.set("mensagemPendente", null);
    if (pendente) this.mensagem(pendente);
    else if (!ultima) this.mensagem("Bem-vindo! Arraste os itens para os espaços de equipamento.");
    // Cada aviso da lógica só é consumido na hora de aparecer: se a cena
    // reiniciar antes (troca de área, morte, viagem), o relógio dela descarta
    // o timer e o aviso segue pendente no save para o próximo create.
    const proximoAviso = (atraso) => this.time.delayedCall(atraso, () => {
      const texto = Mundo.consumirAviso?.(MEU_ID);
      if (!texto) return;
      this.mensagem(texto);
      proximoAviso(3200);
    });
    proximoAviso(pendente ? 2600 : 1800);
    if (window.Arte && typeof console !== "undefined")
      console.debug(`[mundo] ${this.areaAtual}: ${this.children.list.length} objetos; tileset ${Arte.gerarTileset(this.areaAtual).ms.toFixed(1)} ms`);
  }

  criarTecladoEPonteiro() {
    // F1 é tratado só pelo keydown do documento (UI); aqui não é registrado.
    this.teclas = this.input.keyboard.addKeys({
      w: "W", a: "A", s: "S", d: "D", q: "Q", e: "E", z: "Z", c: "C", f: "F", p: "P", space: "SPACE", r: "R", h: "H", i: "I",
      up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT", alt: "ALT",
    });
    this.input.keyboard.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE", "ALT"]);
  }

  // ===== chão: 3 camadas de Tilemap (chão+borda+moldura, decoração, sombras)
  criarChao() {
    const { chave, ts } = Arte.registrarTileset(this, this.areaAtual);
    this.tileset = ts;
    const W = COLS + MOLDURA * 2, H = ROWS + MOLDURA * 2;
    const proibido = this.casasProibidasParaDeco();
    const chao = [], deco = [], sombra = [];
    for (let y = 0; y < H; y++) {
      const a = [], b = [], c = [];
      for (let x = 0; x < W; x++) {
        const mx = x - MOLDURA, my = y - MOLDURA;
        a.push(ts.indice(mx, my));
        b.push(ts.indiceDeco(mx, my, proibido));
        c.push(ts.indiceSombra(mx, my));
      }
      chao.push(a); deco.push(b); sombra.push(c);
    }
    const off = -MOLDURA * TAM;
    const camada = (dados, prof) => {
      const mapa = this.make.tilemap({ data: dados, tileWidth: TAM, tileHeight: TAM });
      const tiles = mapa.addTilesetImage("ts", chave, TAM, TAM, 0, 0);
      return mapa.createLayer(0, tiles, off, off).setDepth(prof);
    };
    this.camadaChao = camada(chao, PROF.chao);
    camada(deco, PROF.deco);
    camada(sombra, PROF.sombraContato);
  }

  casasProibidasParaDeco() {
    const set = new Set();
    const marca = (x, y, r = 0) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) set.add(`${x + dx},${y + dy}`); };
    for (const n of Object.values(npcs)) if (n.area === this.areaAtual) marca(n.x, n.y);
    for (const e of Object.values(inimigos)) if (e.area === this.areaAtual) marca(e.x, e.y);
    for (const c of coletaveisDaArea(this.areaAtual)) marca(c.x, c.y);
    for (const p of PORTAIS) if (p.area === this.areaAtual) marca(p.x, p.y, 1);
    const a = areas[this.areaAtual];
    for (const k of ["passagem", "cais", "caisCanaa", "caisDeserto"]) if (a?.[k]) marca(a[k].x, a[k].y, 1);
    for (const h of this.bio.hubs) marca(h.x, h.y, 1);
    return (x, y) => set.has(`${x},${y}`);
  }

  // ===== obstáculos: um Image por casa bloqueada do interior (y-sort)
  criarObstaculos() {
    const mapa = mapas[this.areaAtual];
    for (let y = 1; y < ROWS - 1; y++)
      for (let x = 1; x < COLS - 1; x++) {
        if (!mapa[y][x]) continue;
        const tipo = Arte.tipoObstaculo(this.areaAtual, x, y);
        if (!tipo || !this.textures.exists(tipo.chave)) continue;
        const def = PIXEL_PATTERNS[tipo.chave];
        const variante = tipo.animado ? 0 : Math.floor(Arte.hash2(x, y, 4) * def.quadros);
        const desloc = tipo.animado ? 0 : (Math.floor(Arte.hash2(x, y, 5) * 3) - 1) * 2;
        const img = this.add.image(centroX(x) + desloc, y * TAM + TAM + (def.obstaculo ? 2 * Arte.PX : 0), tipo.chave, variante)
          .setOrigin(0.5, 1)
          .setDepth(PROF.entidade + y * TAM + TAM - 2);
        if (!def.obstaculo) img.y = y * TAM + TAM; // fogueira etc.
        if (tipo.alto) this.copas.push({ img, x, y });
        if (tipo.animado) this.animados.push({ img, quadros: tipo.animado, fps: 6 });
      }
  }

  criarDecoracaoHubs() {
    const plano = (chave, x, y) => {
      if (mapas[this.areaAtual][y]?.[x] !== 0 || !this.textures.exists(chave)) return;
      this.add.image(centroX(x), y * TAM + TAM / 2, chave).setDepth(PROF.deco);
    };
    const a = this.areaAtual;
    if (a === "canaan") plano("dc_fogo_apagado", 7, 7);
    if (a === "deserto") plano("dc_tapete", 73, 11);
    if (a === "egito") plano("dc_esteira", 11, 53);
    if (a === "galileia") plano("dc_rede", 11, 53);
    // Jesus: luz quente e sutil no chão (sem auréola, nada sobre o corpo).
    const jesus = npcs.jesusGalileia;
    if (jesus && jesus.area === a) {
      const luz = this.add.image(centroX(jesus.x), baseY(jesus.y) - 2, "fx_luz_quente").setDepth(PROF.sombra - 1).setAlpha(0.1).setBlendMode(Phaser.BlendModes.ADD);
      if (!reduzMovimento()) this.tweens.add({ targets: luz, alpha: 0.18, duration: 3000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  // ===== marcadores: portais, trilha, cais, pesca (família única)
  criarMarcadores() {
    const a = this.areaAtual, area = areas[a];
    const rotulo = (texto, x, y, cor = COR.saida) => {
      const t = this.textoRotulo(texto, cor);
      this.marcadores.push({ x, y, rotulo: t, dy: -54 });
      return t;
    };
    const setas = (x, y, paraOeste, fechado) => {
      const s = this.add.sprite(centroX(x), y * TAM + TAM / 2, "mk_setas", fechado ? 3 : 0).setDepth(PROF.marcadorChao).setFlipX(paraOeste);
      if (!fechado) this.animados.push({ img: s, quadros: 3, fps: 5 });
      return s;
    };
    // Portais entre regiões. Guardados em this.portais para que
    // atualizarPortais() os abra quando o capítulo anterior for concluído
    // sem trocar de área (ex.: falar com Moisés depois de vencer o alvo).
    this.portais = [];
    for (const p of PORTAIS.filter((x) => x.area === a)) {
      const fechado = this.portalFechado(p);
      const chave = Arte.garantirTextura(this, `mk_portal_${a}_${p.destino}`);
      const img = this.add.sprite(centroX(p.x), p.y * TAM + TAM + 2, chave, fechado ? 4 : 0).setOrigin(0.5, 1).setDepth(PROF.entidade + p.y * TAM + TAM - 3);
      if (!fechado) this.animados.push({ img, quadros: 4, fps: 6 });
      const oeste = p.x < COLS / 2;
      const s = setas(p.x + (oeste ? 1 : -1), p.y, oeste, fechado);
      this.add.image(centroX(p.x) + 6, baseY(p.y) - 1, "fx_sombra_g").setDepth(PROF.sombra);
      const t = rotulo(fechado ? `${p.texto} · fechada` : p.texto, p.x, p.y, fechado ? COR.fechada : COR.saida);
      this.portais.push({ dados: p, img, setas: s, rotulo: t, fechado });
    }
    // Trilha terrestre Canaã ↔ Deserto
    if (area?.passagem) {
      const p = area.passagem, oeste = p.x < COLS / 2;
      this.add.image(centroX(p.x), p.y * TAM + TAM + 2, "mk_trilha").setOrigin(0.5, 1).setDepth(PROF.entidade + p.y * TAM + TAM - 3);
      setas(p.x + (oeste ? 1 : -1), p.y, oeste, false);
      rotulo(a === "canaan" ? "Trilha para o Deserto" : "Trilha para Canaã", p.x, p.y);
    }
    // Cais (Canaã e Deserto): píer que entra na enseada ao norte
    if (area?.cais) {
      const c = area.cais;
      const s = this.add.sprite(centroX(c.x), c.y * TAM + TAM + 2, "mk_cais", 0).setOrigin(0.5, 1).setDepth(PROF.marcadorChao);
      this.animados.push({ img: s, quadros: 2, fps: 2 });
      const barco = this.add.sprite(centroX(c.x) + 30, -10, "mk_barco", 0).setOrigin(0.5, 1).setDepth(PROF.marcadorChao + 1);
      this.animados.push({ img: barco, quadros: 2, fps: 1.5 });
      rotulo("Cais · Mar das Rotas", c.x, c.y, COR.agua);
    }
    // Mar: cais de desembarque nas duas margens
    if (a === "mar") {
      for (const [c, nome, ang] of [[area.caisCanaa, "Desembarcar · Canaã", -90], [area.caisDeserto, "Desembarcar · Deserto", 90]]) {
        const x = ang < 0 ? c.x * TAM - TAM / 2 : c.x * TAM + TAM * 1.5;
        const s = this.add.sprite(x, c.y * TAM + TAM / 2, "mk_cais", 0).setAngle(ang).setDepth(PROF.marcadorChao);
        this.animados.push({ img: s, quadros: 2, fps: 2 });
        rotulo(nome, c.x, c.y, COR.agua);
      }
    }
  }

  // ===== coletáveis e saques ==========================================
  addItemVisual(id, x, y, textura, quadro = 0) {
    const chave = Arte.aliasItem(textura);
    const tex = this.textures.exists(chave) ? chave : "pele_lobo";
    const px = centroX(x), py = y * TAM + 24;
    const sombra = this.add.image(px + 2, y * TAM + 27, "fx_sombra").setDepth(PROF.sombra).setScale(0.8, 1);
    const s = this.add.sprite(px, py, tex, quadro).setOrigin(0.5, 0.75).setDepth(PROF.entidade + y * TAM + 20);
    s.sombraItem = sombra;
    if (!reduzMovimento()) this.tweens.add({ targets: s, y: py - 2, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * 600 });
    if (tex === "moeda") this.animados.push({ img: s, quadros: 4, fps: 6 });
    const destruir = s.destroy.bind(s);
    s.destroy = (...args) => { sombra.destroy(); this.animados = this.animados.filter((a) => a.img !== s); destruir(...args); };
    this.spritesItens[id] = s;
    return s;
  }
  desenharColetaveis() {
    for (const it of coletaveisDaArea(this.areaAtual))
      if (Mundo.coletavelDisponivel(MEU_ID, this.areaAtual, it.id) && !this.spritesItens[it.id]) this.addItemVisual(it.id, it.x, it.y, it.textura);
  }
  atualizarColetaveis() {
    this.p = Mundo.jogadores[MEU_ID];
    for (const it of coletaveisDaArea(this.areaAtual)) {
      const disponivel = Mundo.coletavelDisponivel(MEU_ID, this.areaAtual, it.id), visual = this.spritesItens[it.id];
      if (disponivel && !visual) {
        const s = this.addItemVisual(it.id, it.x, it.y, it.textura);
        s.setAlpha(0);
        this.tweens.add({ targets: s, alpha: 1, duration: 300 });
      } else if (!disponivel && visual) {
        visual.destroy();
        delete this.spritesItens[it.id];
      }
    }
  }
  criarSaques(pular = false) {
    for (const s of this.p.saqueNoChao || []) {
      if (s.area !== this.areaAtual || this.spritesItens[s.id]) continue;
      const textura = s.moedas ? (s.moedas >= 10 ? "moeda_pilha" : "moeda") : s.item;
      const sprite = this.addItemVisual(s.id, s.x, s.y, textura);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => this.pegarSaque(s.id));
      if (pular && !reduzMovimento()) {
        sprite.x += (Math.random() - 0.5) * 10;
        this.tweens.add({ targets: sprite, scaleY: 1.15, duration: 120, yoyo: true });
      }
    }
  }
  pegarSaque(id) {
    const r = Mundo.executar(MEU_ID, { tipo: "coletarSaque", saqueId: id });
    this.mensagem(r.mensagem);
    if (r.ok) {
      const s = this.spritesItens[id];
      if (s && r.moedas) this.numero(s.x, s.y - 16, `+${r.moedas}`, "moeda");
      s?.destroy();
      delete this.spritesItens[id];
      this.p = Mundo.jogadores[MEU_ID];
      window.atualizarInterface?.();
    }
  }

  // ===== pesca ========================================================
  desenharPontosPesca() {
    this.pesca = [];
    for (const ponto of pontosPesca) {
      const s = this.add.sprite(centroX(ponto.x), ponto.y * TAM + TAM / 2, "mk_pesca", 0).setDepth(PROF.marcadorChao).setInteractive({ useHandCursor: true });
      s.on("pointerdown", () => this.pescar());
      this.pesca.push({ ponto, s });
      this.marcadores.push({ x: ponto.x, y: ponto.y, rotulo: this.textoRotulo("Pesca", COR.agua), dy: -18 });
    }
  }
  pescar() {
    const r = Mundo.executar(MEU_ID, { tipo: "pescar" });
    this.mensagem(r.mensagem);
    if (r.ok) {
      this.p = Mundo.jogadores[MEU_ID];
      const ponto = pontosPesca.find((x) => cheb(this.p, x) <= 1);
      if (ponto && !reduzMovimento()) {
        const peixe = this.add.image(centroX(ponto.x), ponto.y * TAM + 16, "peixe").setDepth(PROF.numero - 1);
        this.tweens.add({ targets: peixe, x: this.jogador.x, duration: 600 });
        this.tweens.add({ targets: peixe, y: peixe.y - 30, duration: 300, yoyo: true, ease: "Quad.easeOut", onComplete: () => peixe.destroy() });
      }
      window.atualizarInterface?.();
    }
  }

  // ===== entidades ====================================================
  portalFechado(p) {
    return !!p.capitulo && typeof capituloAnteriorConcluido === "function" && !capituloAnteriorConcluido(this.p, p.capitulo);
  }
  // Abre (quadro, animação e rótulo) os portais cujo capítulo anterior acabou
  // de ser concluído nesta mesma cena.
  atualizarPortais() {
    for (const portal of this.portais || []) {
      if (!portal.fechado || this.portalFechado(portal.dados)) continue;
      portal.fechado = false;
      portal.img.setFrame(0);
      portal.setas.setFrame(0);
      this.animados.push({ img: portal.img, quadros: 4, fps: 6 }, { img: portal.setas, quadros: 3, fps: 5 });
      portal.rotulo.setText(portal.dados.texto).setColor(COR.saida);
      this.particulasSimples(portal.img.x, portal.img.y - 24, "#f2d27a", 10, { subir: true, dur: 800 });
    }
  }
  textoRotulo(texto, cor) {
    return this.add.text(0, 0, texto, { fontFamily: FONTE_PIXEL, fontSize: "11px", color: cor, stroke: COR.tinta, strokeThickness: 3, resolution: 2 })
      .setOrigin(0.5, 1).setDepth(PROF.rotulo).setAlpha(0);
  }

  criarEntidade(tipo, dados, chave) {
    const def = PIXEL_PATTERNS[chave];
    const quadrupede = def && def.w === 20;
    const x = centroX(dados.x), y = baseY(dados.y);
    const sombra = this.add.image(x + 3, y - 1, quadrupede ? "fx_sombra_lobo" : Arte.CHEFES.has(dados.id) ? "fx_sombra_g" : "fx_sombra").setDepth(PROF.sombra);
    const sprite = this.add.sprite(x, y, chave, 0).setOrigin(0.5, 1).setDepth(PROF.entidade + y);
    sprite.setInteractive({ useHandCursor: true });
    const nome = Arte.nomeCurto(dados.nome);
    const ent = {
      id: dados.id, tipo, dados, chave, sprite, sombra, quadrupede,
      rotulo: this.textoRotulo(nome, tipo === "inimigo" ? COR.hostil : COR.amigo),
      fase: Math.random() * 1200, acaoAte: 0, andandoAte: 0, feridoAte: 0,
      alturaCabeca: quadrupede ? 22 : def.h * Arte.PX - 8,
      vidaFantasma: tipo === "inimigo" ? Mundo.obterVidaInimigo(MEU_ID, dados.id) : 0,
      fantasmaDesde: 0,
    };
    sprite.on("pointerover", () => { this.hoverId = dados.id; });
    sprite.on("pointerout", () => { if (this.hoverId === dados.id) this.hoverId = null; });
    this.entidades[dados.id] = ent;
    return ent;
  }

  criarNpcs() {
    for (const n of Object.values(npcs).filter((n) => n.area === this.areaAtual)) {
      const ent = this.criarEntidade("npc", n, Arte.visualDe(n.id));
      ent.balao = this.add.image(ent.sprite.x, 0, "mk_balao_missao").setOrigin(0.5, 1).setDepth(PROF.barra).setVisible(false);
      ent.sprite.on("pointerdown", () => this.interagir(n.id));
    }
    this.atualizarBaloes();
  }

  criarInimigo(e) {
    this.entidades[e.id] && this.destruirEntidade(e.id);
    const ent = this.criarEntidade("inimigo", e, Arte.visualDe(e.id));
    ent.sprite.on("pointerdown", () => this.selecionarAlvo(e.id));
    return ent;
  }

  destruirEntidade(id) {
    const ent = this.entidades[id];
    if (!ent) return;
    for (const k of ["sprite", "sombra", "rotulo", "balao"]) ent[k]?.destroy();
    delete this.entidades[id];
    if (this.hoverId === id) this.hoverId = null;
  }

  // Balões: !, ?, …, loja, guia (§6.8)
  estadoBalao(npc, p) {
    try {
      if (npc.papel === "loja") return "loja";
      if (npc.papel === "guia") return "guia";
      // Missões, capítulos e o Mestre: regra única em logica.js (motor de missões).
      if (typeof estadoMissaoNpc === "function") return estadoMissaoNpc(p, npc.id);
    } catch (e) {
      return null;
    }
    return null;
  }
  atualizarBaloes() {
    for (const ent of Object.values(this.entidades)) {
      if (ent.tipo !== "npc") continue;
      const estado = this.estadoBalao(ent.dados, this.p);
      ent.estadoBalao = estado;
      if (!estado) ent.balao.setVisible(false);
      else ent.balao.setTexture("mk_balao_" + estado).setVisible(true);
    }
  }

  // ===== jogador ======================================================
  chaveJogador() {
    if (this.areaAtual === "mar") return "mk_barco";
    const chave = Arte.garantirJogador(this.p.equipamento || {});
    return Arte.garantirTextura(this, chave);
  }
  criarJogador() {
    const x = centroX(this.p.x), y = baseY(this.p.y);
    this.chaveAtualJogador = this.chaveJogador();
    this.sombraJogador = this.add.image(x + 3, y - 1, this.areaAtual === "mar" ? "fx_sombra_g" : "fx_sombra").setDepth(PROF.sombra);
    if (this.areaAtual === "mar") this.sombraJogador.setVisible(false);
    this.jogador = this.add.sprite(x, y + (this.areaAtual === "mar" ? 6 : 0), this.chaveAtualJogador, 0).setOrigin(0.5, 1).setDepth(PROF.entidade + y + 1);
    this.estadoJogador = { andandoAte: 0, acaoAte: 0, fase: 0 };
    this.sprite = this.jogador; // compatibilidade
  }
  atualizarVisualJogador() {
    const chave = this.chaveJogador();
    if (chave && chave !== this.chaveAtualJogador) {
      this.chaveAtualJogador = chave;
      this.jogador.setTexture(chave, 0);
    }
  }

  // ===== efeitos reutilizáveis ========================================
  criarEfeitosDeMundo() {
    this.anel = this.add.sprite(0, 0, "fx_anel", 0).setDepth(PROF.marcadorChao).setVisible(false);
    this.anelAmigo = this.add.image(0, 0, "fx_anel_amigo").setDepth(PROF.marcadorChao).setVisible(false);
    this.gBarras = this.add.graphics().setDepth(PROF.barra);
    this.gRecarga = this.add.graphics().setDepth(PROF.marcadorChao + 0.5);
    this.estrelaChefe = this.add.image(0, 0, "ui_estrela_chefe").setDepth(PROF.barra + 1).setVisible(false);
    this.dica = this.add.text(0, 0, "", { fontFamily: FONTE_PIXEL, fontSize: "11px", color: "#2a1a14", backgroundColor: "#ead6a6", padding: { x: 4, y: 1 }, resolution: 2 })
      .setOrigin(0.5, 0).setDepth(PROF.rotulo + 1).setVisible(false);
    this.brilhoItem = this.add.sprite(0, 0, "fx_brilho", 0).setDepth(PROF.numero - 2).setVisible(false);
    this.proximoBrilho = 0;
    // pontos da elipse do anel (para o arco de recarga), em ordem angular
    this.pontosAnel = [];
    for (let i = 0; i < 40; i++) {
      const t = -Math.PI / 2 + (i / 40) * Math.PI * 2;
      this.pontosAnel.push([Math.round(Math.cos(t) * 8) * 2, Math.round(Math.sin(t) * 3.4) * 2]);
    }
  }

  // Número flutuante único (§8.5)
  numero(x, y, txt, tipo = "dano") {
    const [cor, fs] = ESTILO_NUM[tipo] || ESTILO_NUM.dano, reduz = reduzMovimento();
    this._lado = -(this._lado || 6);
    const t = this.add.text(x + this._lado, y, txt, { fontFamily: FONTE_PIXEL, fontSize: fs + "px", color: cor, stroke: COR.tinta, strokeThickness: 3, resolution: 2 })
      .setOrigin(0.5, 1).setDepth(PROF.numero);
    if (tipo === "moeda") {
      const ic = this.add.image(-t.width / 2 - 8, 0, "ui_moeda").setOrigin(0.5, 1);
      const c = this.add.container(t.x, t.y, [t.setPosition(0, 0), ic]).setDepth(PROF.numero);
      this.tweens.add({ targets: c, y: y - 26, duration: 700, ease: "Cubic.easeOut" });
      this.tweens.add({ targets: c, alpha: 0, delay: 450, duration: 300, onComplete: () => c.destroy() });
      return;
    }
    if (!reduz) {
      t.setScale(tipo === "critico" ? 1.6 : 1.3);
      this.tweens.add({ targets: t, scale: 1, duration: 160, ease: "Back.easeOut" });
    }
    if (tipo === "critico" && !reduz) this.cameras.main.shake(80, 0.003);
    this.tweens.add({ targets: t, y: y - 26, duration: 700, ease: "Cubic.easeOut" });
    this.tweens.add({ targets: t, alpha: 0, delay: 450, duration: 300, onComplete: () => t.destroy() });
  }
  efeitoQuadro(chave, x, y, quadros, ms, opts = {}) {
    const s = this.add.sprite(x, y, chave, 0).setDepth(opts.depth || PROF.numero - 1);
    if (opts.flipX) s.setFlipX(true);
    if (opts.angle) s.setAngle(opts.angle);
    let q = 0;
    this.time.addEvent({ delay: ms, repeat: quadros - 1, callback: () => { q++; if (q >= quadros) s.destroy(); else s.setFrame(q); } });
    return s;
  }
  particulasSimples(x, y, cor, n, { subir = false, dur = 400, espalha = 10 } = {}) {
    if (reduzMovimento()) return;
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, "fx_pixel").setScale(2).setTint(hexNum(cor)).setDepth(PROF.numero - 1);
      const ang = Math.random() * Math.PI * 2;
      this.tweens.add({
        targets: p, x: x + Math.cos(ang) * espalha, y: subir ? y - 20 - Math.random() * 20 : y + Math.sin(ang) * espalha * 0.5 - 4,
        alpha: 0, duration: dur + Math.random() * 200, onComplete: () => p.destroy(),
      });
    }
  }

  // ===== câmera, luz e vinheta ========================================
  criarCamera() {
    const cam = this.cameras.main;
    cam.setBackgroundColor("#1c1210");
    cam.setBounds(-MOLDURA * TAM, -MOLDURA * TAM, (COLS + MOLDURA * 2) * TAM, (ROWS + MOLDURA * 2) * TAM);
    cam.startFollow(this.jogador, true, 1, 1, 0, 16);
    cam.setRoundPixels(true);
    this.scale.on("resize", this.aoRedimensionar, this);
    this.aoRedimensionar();
  }
  zoomIdeal(w, h) {
    return Math.min(3, Math.max(1, Math.floor(Math.min(w / 800, h / 576) * 2) / 2));
  }
  // Converte coordenadas de tela para objetos com scrollFactor 0 (compensa o zoom).
  naTela(obj, sx, sy, escala = true) {
    const cam = this.cameras.main, z = cam.zoom;
    obj.setPosition((sx - cam.width / 2) / z + cam.width / 2, (sy - cam.height / 2) / z + cam.height / 2);
    if (escala) obj.setScale(1 / z);
    return obj;
  }
  aoRedimensionar() {
    const cam = this.cameras.main, w = this.scale.width, h = this.scale.height;
    cam.setSize(w, h);
    cam.setZoom(this.zoomIdeal(w, h));
    for (const o of this.sobreposicoes || []) o();
    this.minimapaEstatico = null;
  }
  criarAtmosfera() {
    const cam = this.cameras.main, bio = this.bio;
    this.sobreposicoes = [];
    // luz (tela cheia)
    const luz = this.add.rectangle(0, 0, 10, 10, hexNum(bio.luz.cor), bio.luz.alfa).setScrollFactor(0).setDepth(PROF.luz)
      .setBlendMode(bio.luz.modo === "multiply" ? Phaser.BlendModes.MULTIPLY : Phaser.BlendModes.SCREEN);
    const cobrir = (o) => () => { const z = cam.zoom; o.setPosition(cam.width / 2, cam.height / 2).setDisplaySize(cam.width / z + 2, cam.height / z + 2); };
    luz.setOrigin(0.5);
    this.sobreposicoes.push(cobrir(luz));
    // gradiente de baixo no Sinai
    if (this.areaAtual === "sinai") {
      const chave = "fx_grad_sinai";
      if (!this.textures.exists(chave)) {
        const c = this.textures.createCanvas(chave, 4, 64), ctx = c.getContext();
        const g = ctx.createLinearGradient(0, 0, 0, 64);
        g.addColorStop(0, "rgba(58,42,68,0)"); g.addColorStop(1, "rgba(58,42,68,0.18)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 64); c.refresh();
      }
      const gr = this.add.image(0, 0, chave).setScrollFactor(0).setDepth(PROF.luz).setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.sobreposicoes.push(cobrir(gr));
    }
    // vinheta do bioma + vinheta de vida baixa
    const vinheta = (chave, cor, forca) => {
      if (!this.textures.exists(chave)) {
        const c = this.textures.createCanvas(chave, 256, 256), ctx = c.getContext();
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
        const gr = ctx.createRadialGradient(128, 128, 128 * 0.55, 128, 128, 182);
        gr.addColorStop(0, `rgba(${r},${g},${b},0)`); gr.addColorStop(1, `rgba(${r},${g},${b},${forca})`);
        ctx.fillStyle = gr; ctx.fillRect(0, 0, 256, 256); c.refresh();
      }
      const im = this.add.image(0, 0, chave).setScrollFactor(0).setDepth(PROF.luz + 1);
      this.sobreposicoes.push(cobrir(im));
      return im;
    };
    vinheta("fx_vinheta_" + this.areaAtual, bio.vinheta.cor, bio.vinheta.forca);
    this.vinhetaVida = vinheta("fx_vinheta_vida", "#8e2a1f", 0.9).setAlpha(0);
    for (const f of this.sobreposicoes) f();
  }
  pulsoVinheta(alfa = 0.35, ms = 150) {
    if (!this.vinhetaVida || this.vidaBaixa) return;
    this.vinhetaVida.setAlpha(alfa);
    this.tweens.add({ targets: this.vinhetaVida, alpha: 0, duration: ms * 2, delay: ms });
  }

  // Cartão de título (§8.7)
  mostrarCartao() {
    const cam = this.cameras.main;
    const nome = areas[this.areaAtual]?.nome || "";
    const sub = Arte.SUBTITULOS[this.areaAtual] || "";
    const faixa = this.add.image(0, 0, "fx_faixa");
    const titulo = this.add.text(0, -6, nome, { fontFamily: FONTE_TITULO, fontStyle: "700", fontSize: "26px", color: "#2a1a14", resolution: 2 }).setOrigin(0.5);
    const subt = this.add.text(0, 18, sub, { fontFamily: FONTE_TEXTO, fontStyle: "italic", fontSize: "14px", color: "#5a3a24", resolution: 2 }).setOrigin(0.5);
    const larg = Math.max(titulo.width, subt.width) / 2 + 22;
    const l1 = this.add.image(-larg, -6, "ui_losango").setScale(1.5), l2 = this.add.image(larg, -6, "ui_losango").setScale(1.5);
    const c = this.add.container(0, 0, [faixa, titulo, subt, l1, l2]).setScrollFactor(0).setDepth(PROF.cartao).setAlpha(0);
    const yAlvo = Math.round(cam.height * 0.22);
    this.naTela(c, cam.width / 2, yAlvo);
    const yFinal = c.y;
    if (reduzMovimento()) {
      this.tweens.chain({ targets: c, tweens: [{ alpha: 1, duration: 300 }, { alpha: 0, delay: 1600, duration: 300, onComplete: () => c.destroy() }] });
      return;
    }
    c.y = yFinal - 12 / cam.zoom;
    this.tweens.chain({
      targets: c,
      tweens: [
        { alpha: 1, y: yFinal, duration: 400, ease: "Cubic.easeOut" },
        { alpha: 0, y: yFinal - 8 / cam.zoom, delay: 1600, duration: 500, ease: "Cubic.easeIn", onComplete: () => c.destroy() },
      ],
    });
  }

  // Partículas ambiente e pequenas vidas (≤ 30; desligadas com reduced-motion)
  criarAmbiente() {
    if (reduzMovimento()) return;
    const p = this.bio.particulas, cam = this.cameras.main;
    const zona = {
      getRandomPoint: (pt) => {
        const v = cam.worldView;
        if (p.tipo === "respingo") {
          const norte = Math.random() < 0.5;
          pt.x = v.x + Math.random() * v.width;
          pt.y = norte ? TAM + Math.random() * 8 : (ROWS - 1) * TAM - Math.random() * 8;
          return pt;
        }
        pt.x = v.x + Math.random() * v.width;
        pt.y = v.y + Math.random() * v.height;
        return pt;
      },
    };
    const base = { emitZone: { type: "random", source: zona }, maxAliveParticles: p.max, tint: hexNum(p.cor) };
    const cfg = {
      polen: { lifespan: 4000, speedX: { min: -6, max: 6 }, speedY: { min: -10, max: -3 }, scale: 2, alpha: { start: 0.9, end: 0 }, frequency: 220 },
      poeira: { lifespan: 3500, speedX: { min: 4, max: 14 }, speedY: { min: -6, max: 2 }, scale: 2, alpha: { start: 0.8, end: 0 }, frequency: 200 },
      areia: { lifespan: 1400, speedX: { min: 70, max: 130 }, speedY: { min: -4, max: 4 }, scaleX: 4, scaleY: 2, alpha: { start: 0.7, end: 0 }, frequency: 90 },
      brilho: { lifespan: 700, speed: 0, scale: 2, alpha: { start: 1, end: 0 }, frequency: 90 },
      respingo: { lifespan: 600, speedY: { min: -30, max: -10 }, speedX: { min: -10, max: 10 }, gravityY: 60, scale: 2, alpha: { start: 1, end: 0 }, frequency: 70 },
      nevoa: { lifespan: 9000, speedX: { min: 4, max: 10 }, speedY: 0, scaleX: 40, scaleY: 10, alpha: { start: 0.0, end: 0.15, ease: "Sine.easeInOut" }, frequency: 700 },
      borboleta: { lifespan: 3000, speedX: { min: -8, max: 8 }, speedY: { min: 2, max: 8 }, scale: 2, alpha: { start: 0.9, end: 0 }, frequency: 400, tint: 0xd8a0b8 },
    }[p.tipo];
    if (cfg) {
      this.ambiente = this.add.particles(0, 0, "fx_pixel", Object.assign({}, base, cfg)).setDepth(p.tipo === "nevoa" ? PROF.rotulo - 1 : PROF.barra - 1);
    }
    // borboletas (Canaã e Galileia)
    if (this.areaAtual === "canaan" || this.areaAtual === "galileia") {
      for (let i = 0; i < 3; i++) {
        const b = this.add.sprite(centroX(this.p.x) + (i - 1) * 120, baseY(this.p.y) - 60, "fx_borboleta", 0).setDepth(PROF.barra - 2);
        this.animados.push({ img: b, quadros: 2, fps: 8 });
        const voar = () => {
          if (!b.active) return;
          const v = cam.worldView;
          this.tweens.add({ targets: b, x: v.x + Math.random() * v.width, y: v.y + Math.random() * v.height, duration: 4000 + Math.random() * 3000, ease: "Sine.easeInOut", onComplete: voar });
        };
        voar();
      }
    }
  }

  // ===== interação, combate e movimento ===============================
  mensagem(t, tipo) {
    if (!t) return;
    if (window.UI?.mensagem) window.UI.mensagem(t, tipo);
    else window.mostrarMensagem?.(t);
  }

  interagir(alvoId) {
    // Com a fala deste NPC aberta, F (ou clicar nele) só completa e depois
    // fecha a caixa, como diz a dica "clique ou F". Falar de novo avançaria
    // a missão e trocaria a fala (briefing, recompensa) pela seguinte.
    const npcAlvo = alvoId ? npcs[alvoId] : Mundo.npcProximo?.(this.p);
    if (npcAlvo && window.UI?.avancarDialogo?.(npcAlvo.id)) return { ok: true };
    const r = Mundo.executar(MEU_ID, alvoId ? { tipo: "interagir", alvoId } : { tipo: "interagir" });
    this.mensagem(r.mensagem, r.ok ? "fala" : undefined);
    if (r.ok) {
      const npc = alvoId ? npcs[alvoId] : Mundo.npcProximo?.(this.p);
      const ent = npc && this.entidades[npc.id];
      if (ent) {
        ent.acaoAte = this.time.now + 400;
        ent.sprite.setFlipX(this.p.x < npc.x);
        if (window.UI?.dialogo) window.UI.dialogo({ id: npc.id, nome: npc.nome, papel: npc.papel, texto: r.mensagem });
      }
    }
    if (r.abrirLoja) (window.UI?.abrirLoja || window.abrirLoja)?.();
    if (r.abrirViagem) (window.UI?.abrirViagem || window.abrirViagem)?.();
    if (r.missaoErvasIniciada || r.missaoDesertoIniciada) this.atualizarColetaveis();
    if (r.capituloConcluido || r.oracaoAprendida) this.particulasSimples(this.jogador.x, this.jogador.y - 20, "#f2d27a", 12, { subir: true, dur: 800 });
    this.p = Mundo.jogadores[MEU_ID];
    if (r.capituloConcluido) this.atualizarPortais();
    this.atualizarBaloes();
    this.verificarNivel();
    this.atualizarVisualJogador();
    window.atualizarInterface?.();
    return r;
  }

  // O que está ao alcance do jogador (para a dica "F · Falar" e o botão de toque).
  podeInteragir() {
    const p = this.p;
    if (!p) return null;
    let melhor = null;
    for (const n of Object.values(npcs)) if (n.area === this.areaAtual && cheb(p, n) <= 1) return { tipo: "npc", id: n.id, rotulo: "Falar", x: n.x, y: n.y, tecla: "F" };
    const a = areas[this.areaAtual];
    const alvos = [];
    if (this.areaAtual === "mar") {
      for (const c of [a.caisCanaa, a.caisDeserto]) alvos.push({ tipo: "cais", id: "cais", rotulo: "Desembarcar", x: c.x, y: c.y, tecla: "F" });
      for (const pt of pontosPesca) alvos.push({ tipo: "pesca", id: pt.id, rotulo: "Pescar", x: pt.x, y: pt.y, tecla: "P" });
    } else {
      if (a?.cais) alvos.push({ tipo: "cais", id: "cais", rotulo: "Embarcar", x: a.cais.x, y: a.cais.y, tecla: "F" });
      if (a?.passagem) alvos.push({ tipo: "portal", id: "trilha", rotulo: "Seguir rota", x: a.passagem.x, y: a.passagem.y, tecla: "F" });
      for (const t of PORTAIS) if (t.area === this.areaAtual) alvos.push({ tipo: "portal", id: "portal", rotulo: "Seguir rota", x: t.x, y: t.y, tecla: "F" });
    }
    for (const alvo of alvos) {
      const d = cheb(p, alvo);
      if (d <= 1 && !(alvo.x === p.x && alvo.y === p.y) && (!melhor || d < cheb(p, melhor))) melhor = alvo;
    }
    return melhor;
  }
  acaoContextual() {
    const alvo = this.podeInteragir();
    if (!alvo || alvo.tipo === "npc") return this.interagir();
    if (alvo.tipo === "pesca") return this.pescar();
    // cais/portal: um passo até a casa do marcador
    this.mover(Math.sign(alvo.x - this.p.x), Math.sign(alvo.y - this.p.y));
  }

  atacarAlvo(distancia = false, auto = false) {
    let id = this.alvoId;
    if (!id) {
      const e = Object.values(inimigos).find((x) => x.area === this.areaAtual && Mundo.obterVidaInimigo(MEU_ID, x.id) > 0 && cheb(this.p, x) <= 1);
      if (e) id = e.id;
    }
    const r = Mundo.executar(MEU_ID, { tipo: distancia ? "atacarDistancia" : "atacar", alvoId: id });
    if (!r.ok) {
      if (!(auto && r.emRecarga)) this.mensagem(r.mensagem);
      return r;
    }
    this.mensagem(r.mensagem, "combate");
    this.efeitoAtaque(r, r.inimigoId || id, r.tipoAtaque === "distancia" || distancia);
    this.aposAtaque(r);
    return r;
  }
  efeitoAtaque(r, id, distancia) {
    const ent = this.entidades[id];
    const e = inimigos[id];
    if (!e) return;
    const tx = ent ? ent.sprite.x : centroX(e.x), ty = ent ? ent.sprite.y - ent.alturaCabeca / 2 : baseY(e.y) - 16;
    this.estadoJogador.acaoAte = this.time.now + 120;
    if (this.areaAtual !== "mar") this.jogador.setFlipX(e.x < this.p.x);
    const mostrar = () => {
      if (r.danoAplicado) this.numero(tx, ty - 14, r.critico ? `${r.danoAplicado}!` : `${r.danoAplicado}`, r.critico ? "critico" : "dano");
      else this.numero(tx, ty - 14, "errou", "errou");
      this.efeitoQuadro("fx_faisca", tx, ty, 3, 60);
      if (ent && ent.sprite.active) {
        ent.feridoAte = this.time.now + 4000;
        ent.sprite.setTintFill(0xfff1d0);
        this.time.delayedCall(60, () => ent.sprite.active && ent.sprite.clearTint());
        if (!reduzMovimento()) {
          const dx = Math.sign(e.x - this.p.x) * 2, dy = Math.sign(e.y - this.p.y) * 2;
          ent.sprite.x += dx; ent.sprite.y += dy;
          this.time.delayedCall(80, () => { if (ent.sprite.active) { ent.sprite.x -= dx; ent.sprite.y -= dy; } });
        }
      }
    };
    if (distancia) {
      const ang = Phaser.Math.Angle.Between(this.jogador.x, this.jogador.y - 20, tx, ty);
      const f = this.add.image(this.jogador.x, this.jogador.y - 20, "flecha").setDepth(PROF.numero - 1).setRotation(ang + Math.PI / 4);
      this.tweens.add({ targets: f, x: tx, y: ty, duration: 150, onComplete: () => { f.destroy(); mostrar(); } });
    } else {
      const ang = Phaser.Math.Angle.Between(this.jogador.x, this.jogador.y - 18, tx, ty);
      this.efeitoQuadro("fx_corte", this.jogador.x + Math.cos(ang) * 18, this.jogador.y - 18 + Math.sin(ang) * 18, 2, 60, { angle: Phaser.Math.RadToDeg(ang) });
      mostrar();
    }
  }
  autoAtacar() {
    const e = inimigos[this.alvoId];
    if (!e || Mundo.obterVidaInimigo(MEU_ID, e.id) <= 0) {
      this.alvoId = null;
      window.atualizarInterface?.();
      return;
    }
    const dx = Math.abs(e.x - this.p.x), dy = Math.abs(e.y - this.p.y);
    const alinhado = dx === 0 || dy === 0 || dx === dy, dist = Math.max(dx, dy);
    // Também a 1 casa: espada e arco são exclusivos, então com o arco nas
    // mãos o golpe corpo a corpo sairia sem arma (a lógica aceita o tiro
    // a partir de 1 casa).
    const podeAtirar = this.p.equipamento.arco && Mundo.contarItem(MEU_ID, "flecha") > 0 && alinhado && dist <= ALCANCE_ARCO;
    this.ultimoAutoAtaque = this.time.now;
    this.atacarAlvo(!!podeAtirar, true);
  }
  aposAtaque(r) {
    if (r.derrotado) {
      const id = r.inimigoId;
      this.animarMorte(id);
      this.agendarRespawn(id);
      this.alvoId = null;
      const e = inimigos[id];
      if (e) this.time.delayedCall(200, () => this.numero(centroX(e.x), baseY(e.y) - 40, `+${e.xpRecompensa} XP`, "xp"));
    }
    this.p = Mundo.jogadores[MEU_ID];
    this.time.delayedCall(r.derrotado ? 250 : 0, () => this.criarSaques(true));
    this.verificarNivel();
    this.atualizarBaloes();
    window.atualizarInterface?.();
  }
  animarMorte(id) {
    const ent = this.entidades[id];
    if (!ent) return;
    delete this.entidades[id];
    const { sprite, sombra, rotulo } = ent;
    rotulo?.destroy();
    sprite.disableInteractive();
    const cor = this.bio.chao.escuro;
    let n = 0;
    this.time.addEvent({ delay: 60, repeat: 3, callback: () => { if (!sprite.active) return; if (n++ % 2 === 0) sprite.setTintFill(0xffffff); else sprite.clearTint(); } });
    this.tweens.add({ targets: [sprite, sombra], alpha: 0, y: "+=4", delay: 240, duration: 300, onComplete: () => { sprite.destroy(); sombra.destroy(); } });
    this.particulasSimples(sprite.x, sprite.y - 4, cor, 6, { espalha: 14 });
  }
  agendarRespawn(id) {
    if (this.respawns.has(id)) return;
    this.respawns.add(id);
    this.time.delayedCall(TEMPO_RESPAWN_INIMIGO, () => {
      this.respawns.delete(id);
      const e = inimigos[id];
      if (this.areaAtual === e.area && Mundo.reaparecerInimigo(MEU_ID, id)) {
        const ent = this.criarInimigo(e);
        ent.sprite.setAlpha(0); ent.sombra.setAlpha(0);
        this.tweens.add({ targets: [ent.sprite, ent.sombra], alpha: 1, duration: 400 });
        this.mensagem(`${e.nome} reapareceu.`);
        window.atualizarInterface?.();
      }
    });
  }
  selecionarAlvo(id) {
    if (!id) { this.alvoId = null; window.atualizarInterface?.(); return; }
    if (!inimigos[id] || Mundo.obterVidaInimigo(MEU_ID, id) <= 0) return;
    const novo = this.alvoId !== id;
    this.alvoId = id;
    this.proximoAutoAtaque = Date.now() + INTERVALO_AUTO_ATAQUE;
    this.ultimoAutoAtaque = this.time.now;
    if (novo && !reduzMovimento()) {
      this.anel.setScale(1.3);
      this.tweens.add({ targets: this.anel, scale: 1, duration: 120 });
    }
    window.atualizarInterface?.();
    this.mensagem(`${inimigos[id].nome} selecionado; autoataque a cada 2 segundos.`);
  }
  usarPocao() {
    const r = Mundo.executar(MEU_ID, { tipo: "usarPocao" });
    this.mensagem(r.mensagem);
    if (r.ok && r.cura) this.efeitoCura(r.cura);
    window.atualizarInterface?.();
    return r;
  }
  usarPocaoFe() {
    const r = Mundo.executar(MEU_ID, { tipo: "usarPocaoFe" });
    this.mensagem(r.mensagem);
    if (r.ok && r.feCurada) this.numero(this.jogador.x, this.jogador.y - 46, `+${r.feCurada} fé`, "fe");
    window.atualizarInterface?.();
    return r;
  }
  efeitoCura(cura) {
    this.numero(this.jogador.x, this.jogador.y - 46, `+${cura}`, "cura");
    this.particulasSimples(this.jogador.x, this.jogador.y - 16, "#8fd16a", 6, { subir: true, dur: 600 });
  }
  usarHotkey(i) {
    const id = this.p.hotkeys?.[i];
    if (id === "pocao") return this.usarPocao();
    if (id === "pocao_fe") return this.usarPocaoFe();
    if (id) this.mensagem("Este item não é utilizável no momento.");
  }
  verificarNivel() {
    const p = Mundo.jogadores[MEU_ID];
    if (!p) return;
    if (p.nivel > this.nivelAnterior) {
      const x = this.jogador.x, y = this.jogador.y;
      this.particulasSimples(x, y - 10, "#ffe08a", 16, { subir: true, dur: 1000, espalha: 8 });
      const t = this.add.text(x, y - 56, `NÍVEL ${p.nivel}`, { fontFamily: FONTE_TITULO, fontStyle: "700", fontSize: "20px", color: "#ffe08a", stroke: COR.tinta, strokeThickness: 4, resolution: 2 })
        .setOrigin(0.5, 1).setDepth(PROF.numero);
      this.tweens.add({ targets: t, y: y - 80, alpha: 0, delay: 600, duration: 600, onComplete: () => t.destroy() });
    }
    this.nivelAnterior = p.nivel;
  }

  mover(dx, dy) {
    if (this.trocando) return;
    const r = Mundo.executar(MEU_ID, { tipo: "mover", dx, dy });
    if (!r.ok) return;
    if (r.areaAlterada) return this.trocarArea(r.mensagem);
    this.p = Mundo.jogadores[MEU_ID];
    // Pilha de saque: a lógica recolhe tudo o que couber (itensColetados);
    // r.itemColetado sozinho vem dos coletáveis (erva, odre).
    const coletados = r.itensColetados || (r.itemColetado ? [r.itemColetado] : []);
    if (coletados.length) {
      if (r.moedas) this.numero(centroX(this.p.x), this.p.y * TAM + 8, `+${r.moedas}`, "moeda");
      for (const id of coletados) {
        this.spritesItens[id]?.destroy();
        delete this.spritesItens[id];
      }
      this.mensagem(r.mensagem, "saque");
      this.atualizarBaloes();
    } else if (r.mensagem) this.mensagem(r.mensagem);
    if (this.areaAtual !== "mar" && dx) this.jogador.setFlipX(dx < 0);
    if (this.areaAtual === "mar" && dx) this.jogador.setFlipX(dx < 0);
    const nx = centroX(this.p.x), ny = baseY(this.p.y) + (this.areaAtual === "mar" ? 6 : 0);
    this.estadoJogador.andandoAte = this.time.now + 140;
    this.tweens.add({ targets: this.jogador, x: nx, y: ny, duration: 130 });
    if (this.areaAtual === "mar" && !reduzMovimento()) this.particulasSimples(this.jogador.x - dx * 20, this.jogador.y - 4, "#e8f2e0", 2, { espalha: 6, dur: 500 });
    window.atualizarInterface?.();
  }
  trocarArea(mensagem) {
    this.trocando = true;
    this.registry.set("mensagemPendente", mensagem || null);
    const cam = this.cameras.main;
    cam.once("camerafadeoutcomplete", () => this.scene.restart());
    cam.fadeOut(220, 28, 18, 16);
  }

  // Executa um comando vindo da UI, com os efeitos visuais do resultado.
  executarComando(comando) {
    if (!comando) return { ok: false };
    if (comando.tipo === "mover") { this.mover(comando.dx, comando.dy); return { ok: true }; }
    if (comando.tipo === "interagir") return this.interagir(comando.alvoId);
    if (comando.tipo === "atacar") return this.atacarAlvo(false);
    if (comando.tipo === "atacarDistancia") return this.atacarAlvo(true);
    if (comando.tipo === "pescar") { this.pescar(); return { ok: true }; }
    if (comando.tipo === "usarPocao") return this.usarPocao();
    if (comando.tipo === "usarPocaoFe") return this.usarPocaoFe();
    const r = Mundo.executar(MEU_ID, comando);
    if (r.mensagem) this.mensagem(r.mensagem);
    if (r.areaAlterada) { this.trocarArea(null); return r; }
    if (comando.tipo === "orar" && r.ok) {
      if (r.cura) this.efeitoCura(r.cura);
      this.particulasSimples(this.jogador.x, this.jogador.y - 10, "#f2d27a", 10, { subir: true, dur: 800 });
      if (comando.acao === "milagre" && !reduzMovimento()) this.cameras.main.flash(300, 255, 224, 138);
    }
    this.p = Mundo.jogadores[MEU_ID];
    this.atualizarVisualJogador();
    window.atualizarInterface?.();
    return r;
  }

  // ===== laço =========================================================
  update(time) {
    if (!this.jogador) return;
    const agora = Date.now();
    if (time >= this.proximoMinimapa) {
      this.proximoMinimapa = time + 250;
      this.p = Mundo.jogadores[MEU_ID] || this.p;
      this.desenharMinimapa();
      this.atualizarMapaSobre();
      Arte.animarAgua(this, this.areaAtual, time / 250);
      this.atualizarVisualJogador();
    }
    if (time >= this.proximaAtualizacaoColetaveis) {
      this.proximaAtualizacaoColetaveis = time + 500;
      this.atualizarColetaveis();
      if (this.pesca) for (const { ponto, s } of this.pesca) s.setData("esgotado", !Mundo.pescaDisponivel(MEU_ID, ponto.id));
    }
    if (time >= this.proximoBalao) {
      this.proximoBalao = time + 500;
      this.atualizarBaloes();
      this.atualizarPortais(); // também cobre conclusões vindas de fora do diálogo
    }

    if (!this.trocando) this.lerTeclas(time, agora);
    if (this.trocando) return;

    const ev = Mundo.atualizar(MEU_ID, agora);
    for (const x of ev) {
      if (x.tipo === "inimigoMoveu") this.moverInimigo(x.id);
      else if (x.tipo === "jogadorAtingido") this.jogadorAtingido(x);
      else if (x.tipo === "veneno") this.mensagem(x.mensagem, "perigo");
      else if (x.tipo === "venenoTerminou") this.mensagem(x.mensagem);
      else if (x.tipo === "saqueExpirou") for (const id of x.ids || []) { this.spritesItens[id]?.destroy(); delete this.spritesItens[id]; }
      else if (x.tipo === "renasceu") {
        this.alvoId = null;
        this.trocando = true;
        this.registry.set("mensagemPendente", x.mensagem);
        this.registry.set("ultimaArea", "canaan"); // na morte, só fade (sem cartão)
        const cam = this.cameras.main;
        cam.once("camerafadeoutcomplete", () => this.scene.restart());
        cam.fadeOut(300, 28, 18, 16);
        return;
      }
    }
    if (ev.length) window.atualizarInterface?.();

    this.animar(time);
  }

  lerTeclas(time, agora) {
    const JD = Phaser.Input.Keyboard.JustDown, t = this.teclas;
    if (JD(t.f)) this.acaoContextual();
    if (JD(t.space)) this.atacarAlvo(false);
    if (JD(t.r)) this.atacarAlvo(true);
    if (JD(t.h)) this.usarPocao();
    if (JD(t.p)) this.pescar();
    if (JD(t.i)) document.body.classList.toggle("hideBags");
    if (this.alvoId && agora >= this.proximoAutoAtaque) {
      this.proximoAutoAtaque = agora + INTERVALO_AUTO_ATAQUE;
      this.autoAtacar();
    }
    if (time < this.proximoPasso || this.trocando) return;
    let dx = 0, dy = 0;
    if (t.a.isDown || t.left.isDown) dx = -1;
    else if (t.d.isDown || t.right.isDown) dx = 1;
    if (t.w.isDown || t.up.isDown) dy = -1;
    else if (t.s.isDown || t.down.isDown) dy = 1;
    if (t.q.isDown) { dx = -1; dy = -1; } else if (t.e.isDown) { dx = 1; dy = -1; } else if (t.z.isDown) { dx = -1; dy = 1; } else if (t.c.isDown) { dx = 1; dy = 1; }
    if (!dx && !dy && window.Jogo?.entrada) { dx = Math.sign(window.Jogo.entrada.dx || 0); dy = Math.sign(window.Jogo.entrada.dy || 0); }
    if (dx || dy) {
      this.proximoPasso = time + 140;
      this.mover(dx, dy);
    }
  }

  moverInimigo(id) {
    const ent = this.entidades[id], e = inimigos[id];
    if (!ent || !e) return;
    const nx = centroX(e.x), ny = baseY(e.y);
    if (nx !== ent.sprite.x) ent.sprite.setFlipX(nx < ent.sprite.x);
    ent.andandoAte = this.time.now + 220;
    this.tweens.add({ targets: ent.sprite, x: nx, y: ny, duration: 200 });
  }

  jogadorAtingido(x) {
    const jx = this.jogador.x, jy = this.jogador.y - 46;
    if (x.veneno) {
      this.numero(jx, jy, `−${x.dano}`, "veneno");
      this.jogador.setTint(0xa8c84a);
      this.time.delayedCall(120, () => this.jogador.active && this.jogador.clearTint());
      this.particulasSimples(jx, this.jogador.y - 20, "#a8c84a", 2, { subir: true, dur: 500, espalha: 4 });
      return;
    }
    this.mensagem(x.mensagem, "combate");
    this.numero(jx, jy, `−${x.dano}`, "recebido");
    if (x.defesaBloqueada > 0) {
      // BLOQ sai do lado oposto ao atacante, ao lado do corpo, para não
      // atravessar o rótulo do inimigo (que fica sobre a cabeça dele).
      const atacante = inimigos[x.inimigoId];
      const lado = atacante && atacante.x > this.p.x ? -1 : 1;
      const by = atacante && atacante.y > this.p.y ? jy : jy + 24;
      this.time.delayedCall(120, () => this.numero(jx + lado * 36, by, `BLOQ ${x.defesaBloqueada}`, "bloqueio"));
    }
    this.jogador.setTint(0xff7a5c);
    this.time.delayedCall(100, () => this.jogador.active && this.jogador.clearTint());
    this.pulsoVinheta(0.35, 150);
    const ent = this.entidades[x.inimigoId], e = inimigos[x.inimigoId];
    if (ent) {
      ent.acaoAte = this.time.now + 120;
      ent.sprite.setFlipX(this.p.x < e.x);
    }
    if (e && !reduzMovimento()) {
      const dx = Math.sign(this.p.x - e.x) * 2, dy = Math.sign(this.p.y - e.y) * 2;
      this.jogador.x += dx; this.jogador.y += dy;
      this.time.delayedCall(90, () => { this.jogador.x -= dx; this.jogador.y -= dy; });
    }
  }

  // Quadros, rótulos, barras, anel, copas e dica — tudo por quadro, sem alocação.
  animar(time) {
    const reduz = reduzMovimento();
    // jogador
    const ej = this.estadoJogador, j = this.jogador;
    if (this.areaAtual === "mar") j.setFrame(Math.floor(time / 600) % 2);
    else if (ej.acaoAte > time) j.setFrame(4);
    else if (ej.andandoAte > time) j.setFrame(2 + (Math.floor(time / 125) % 2));
    else j.setFrame(reduz ? 0 : Math.floor(time / 600) % 2);
    j.setDepth(PROF.entidade + j.y + 1);
    this.sombraJogador.setPosition(j.x + 3, j.y - 1);

    // entidades
    for (const ent of Object.values(this.entidades)) {
      const s = ent.sprite;
      let q;
      if (ent.acaoAte > time) q = 4;
      else if (ent.andandoAte > time) q = 2 + (Math.floor(time / 125) % 2);
      else q = reduz ? 0 : Math.floor((time + ent.fase) / 600) % 2;
      if (ent.dados.id === "jesusGalileia" && q === 4 && ent.acaoAte - time > 400) q = 0;
      s.setFrame(q);
      s.setDepth(PROF.entidade + s.y);
      ent.sombra.setPosition(s.x + 3, s.y - 1);
      if (ent.tipo === "npc" && ent.acaoAte < time && this.p.x !== ent.dados.x && cheb(this.p, ent.dados) <= 3) s.setFlipX(this.p.x < ent.dados.x);
      if (ent.balao && ent.balao.visible) this.posicionarBalao(ent, reduz ? 0 : Math.floor(time / 500) % 2 ? -2 : 0);
    }

    // animações simples por quadro
    for (const a of this.animados) if (a.img.active) a.img.setFrame(Math.floor((time / 1000) * a.fps) % a.quadros);
    if (this.pesca) for (const { s } of this.pesca) s.setFrame(s.getData("esgotado") ? 3 : Math.floor(time / 530) % 3);

    // copas ficam translúcidas quando o jogador está logo acima/ao lado
    for (const c of this.copas) {
      const perto = this.p.y >= c.y - 1 && this.p.y <= c.y - 1 && Math.abs(this.p.x - c.x) <= 1;
      c.img.setAlpha(perto ? 0.55 : 1);
    }

    this.desenharAlvoEBarras(time);
    if (time >= this.proximosRotulos) {
      this.proximosRotulos = time + 100;
      this.atualizarRotulos();
      this.atualizarDica();
    }

    // brilho ocasional sobre itens no chão
    if (time >= this.proximoBrilho && !reduz) {
      this.proximoBrilho = time + 2000 + Math.random() * 1000;
      const itens = Object.values(this.spritesItens).filter((s) => s.active && this.cameras.main.worldView.contains(s.x, s.y));
      if (itens.length) {
        const s = itens[Math.floor(Math.random() * itens.length)];
        this.brilhoItem.setPosition(s.x + 6, s.y - 12).setVisible(true).setFrame(0);
        this.brilhoAte = time + 300;
      }
    }
    if (this.brilhoItem.visible) {
      const r = this.brilhoAte - time;
      if (r <= 0) this.brilhoItem.setVisible(false);
      else this.brilhoItem.setFrame(r > 200 ? 0 : r > 100 ? 1 : 2);
    }

    // vida baixa: a vinheta pulsa em vermelhão
    const p = this.p, baixa = p.vida / vidaMaxima(p) < 0.25;
    if (baixa !== this.vidaBaixa) {
      this.vidaBaixa = baixa;
      this.tweens.killTweensOf(this.vinhetaVida);
      if (baixa) this.tweens.add({ targets: this.vinhetaVida, alpha: { from: 0, to: 0.25 }, duration: 500, yoyo: true, repeat: -1 });
      else this.vinhetaVida.setAlpha(0);
    }
  }

  desenharAlvoEBarras(time) {
    const g = this.gBarras, gr = this.gRecarga;
    g.clear();
    gr.clear();
    this.estrelaChefe.setVisible(false);
    const alvo = this.alvoId && this.entidades[this.alvoId];
    if (alvo) {
      const s = alvo.sprite;
      this.anel.setVisible(true).setPosition(s.x, s.y - 3).setFrame(Math.floor(time / 125) % 4);
      // arco de recarga do autoataque
      const frac = Math.min(1, (time - this.ultimoAutoAtaque) / INTERVALO_AUTO_ATAQUE);
      const n = Math.floor(frac * this.pontosAnel.length);
      gr.fillStyle(0xffe08a, 0.9);
      for (let i = 0; i < n; i++) { const [dx, dy] = this.pontosAnel[i]; gr.fillRect(s.x + dx - 1, s.y - 3 + dy + 6, 2, 2); }
    } else this.anel.setVisible(false);
    // anel amigo sob o NPC com o ponteiro
    const hover = this.hoverId && this.entidades[this.hoverId];
    if (hover && hover.tipo === "npc") this.anelAmigo.setVisible(true).setPosition(hover.sprite.x, hover.sprite.y - 3);
    else this.anelAmigo.setVisible(false);

    for (const ent of Object.values(this.entidades)) {
      if (ent.tipo !== "inimigo") continue;
      const vida = Mundo.obterVidaInimigo(MEU_ID, ent.id), max = ent.dados.vidaMaxima;
      // fantasma: segmento que encolhe em 400 ms
      if (vida < ent.vidaFantasma) {
        if (!ent.fantasmaDesde) ent.fantasmaDesde = time;
        const t = (time - ent.fantasmaDesde) / 400;
        if (t >= 1) { ent.vidaFantasma = vida; ent.fantasmaDesde = 0; }
      } else { ent.vidaFantasma = vida; ent.fantasmaDesde = 0; }
      const chefe = Arte.CHEFES.has(ent.id);
      const visivel = chefe || ent.id === this.alvoId || ent.id === this.hoverId || ent.feridoAte > time;
      if (!visivel) continue;
      const w = chefe ? 32 : 24, h = chefe ? 5 : 4, s = ent.sprite;
      const x = Math.round(s.x - w / 2), y = Math.round(s.y - ent.alturaCabeca - 12);
      g.fillStyle(0x1c1210, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle(0x3a1f1c, 1).fillRect(x, y, w, h);
      let fantasma = ent.vidaFantasma;
      if (ent.fantasmaDesde) fantasma = ent.vidaFantasma - (ent.vidaFantasma - vida) * Math.min(1, (time - ent.fantasmaDesde) / 400);
      const wv = Math.round((w * vida) / max), wf = Math.round((w * fantasma) / max);
      if (wf > wv) g.fillStyle(0xffe08a, 1).fillRect(x + wv, y, wf - wv, h);
      g.fillStyle(0xc2452d, 1).fillRect(x, y, wv, h);
      g.fillStyle(0xe2774f, 1).fillRect(x, y, wv, 1);
      if (chefe) this.estrelaChefe.setVisible(true).setPosition(x - 10, y + 2);
    }
  }

  // Retângulo do sprite do jogador (base no meio dos pés). O jogador é a
  // prioridade visual nº 1 (§1.8): rótulos e balões não passam por cima dele.
  retanguloJogador() {
    const j = this.jogador;
    return { x: j.x, y: j.y, w: 28, h: j.displayHeight - 4 };
  }
  // Balão (!, ?, loja, guia) sobre a cabeça do NPC; se cruzar o jogador
  // (NPC logo abaixo dele), vai para o lado oposto ao jogador.
  posicionarBalao(ent, quique) {
    const s = ent.sprite, b = ent.balao, corpo = this.retanguloJogador();
    let x = s.x;
    const y = s.y - ent.alturaCabeca - 4 + quique;
    const cruza = Math.abs(corpo.x - x) < (corpo.w + b.displayWidth) / 2 && y > corpo.y - corpo.h && y - b.displayHeight < corpo.y;
    if (cruza) x = corpo.x + (s.x >= corpo.x ? 1 : -1) * ((corpo.w + b.displayWidth) / 2 + 2);
    b.setPosition(x, y);
  }

  // Rótulos: proximidade, ponteiro, alvo ou Alt; anti-sobreposição (§8.2)
  // entre rótulos e contra o sprite do jogador.
  atualizarRotulos() {
    const todos = this.teclas.alt.isDown;
    const visiveis = [];
    for (const ent of Object.values(this.entidades)) {
      const mostra = todos || ent.id === this.hoverId || ent.id === this.alvoId || cheb(this.p, ent.dados) <= 2;
      if (!mostra) { this.desvanecer(ent.rotulo, false); continue; }
      const barra = ent.tipo === "inimigo" && (Arte.CHEFES.has(ent.id) || ent.id === this.alvoId || ent.id === this.hoverId || ent.feridoAte > this.time.now);
      const balao = ent.balao && ent.balao.visible;
      const y = ent.sprite.y - ent.alturaCabeca - 4 - (barra ? 14 : 0) - (balao ? 22 : 0);
      visiveis.push({ t: ent.rotulo, x: ent.sprite.x, y });
    }
    for (const m of this.marcadores) {
      const mostra = todos || cheb(this.p, m) <= 3;
      if (!mostra) { this.desvanecer(m.rotulo, false); continue; }
      visiveis.push({ t: m.rotulo, x: centroX(m.x), y: m.y * TAM + TAM + m.dy });
    }
    visiveis.sort((a, b) => a.y - b.y);
    // Retângulos com base em y (rótulos têm origem embaixo, 12 px de altura).
    const bate = (r, x, y, w, h) => Math.abs(r.x - x) < (r.w + w) / 2 + 2 && y > r.y - r.h && y - h < r.y;
    // Rótulo que cairia sobre o jogador (NPC logo abaixo dele) fica oculto:
    // o jogador vem primeiro (§1.8) e, ao lado, o aviso "F · Falar" já marca
    // o NPC; o nome aparece no quadro de diálogo.
    const corpo = this.retanguloJogador();
    const colocados = [];
    for (const v of visiveis) {
      const w = v.t.width, h = 12;
      if (bate(corpo, v.x, v.y, w, h)) { this.desvanecer(v.t, false); continue; }
      let y = v.y, ok = false;
      for (let k = 0; k < 3; k++) {
        if (!colocados.some((r) => bate(r, v.x, y, w, h)) && !bate(corpo, v.x, y, w, h)) { ok = true; break; }
        y -= 12;
      }
      if (!ok) { this.desvanecer(v.t, false); continue; }
      colocados.push({ x: v.x, y, w, h });
      v.t.setPosition(Math.round(v.x), Math.round(y));
      this.desvanecer(v.t, true);
    }
  }
  desvanecer(t, mostrar) {
    if (!t) return;
    const alvo = mostrar ? 1 : 0;
    if (t._alvo === alvo) return;
    t._alvo = alvo;
    this.tweens.killTweensOf(t);
    if (reduzMovimento()) t.setAlpha(alvo);
    else this.tweens.add({ targets: t, alpha: alvo, duration: 150 });
  }
  atualizarDica() {
    const alvo = this.podeInteragir();
    this.interacaoAtual = alvo;
    if (!alvo || (window.matchMedia && matchMedia("(pointer: coarse)").matches)) { this.dica.setVisible(false); return; }
    const texto = `${alvo.tecla} · ${alvo.rotulo}`;
    if (this.dica.text !== texto) this.dica.setText(texto);
    const ent = alvo.tipo === "npc" && this.entidades[alvo.id];
    let x = ent ? ent.sprite.x : centroX(alvo.x), y = (ent ? ent.sprite.y : baseY(alvo.y)) + 4;
    // Alvo logo ao norte: a pílula (origem no topo) cairia sobre o tronco
    // do jogador. Nesse caso ela vai para baixo dos pés dele (§1.8).
    const corpo = this.retanguloJogador(), w = this.dica.width, h = this.dica.height;
    const cruza = Math.abs(corpo.x - x) < (corpo.w + w) / 2 && y < corpo.y && y + h > corpo.y - corpo.h;
    if (cruza) { x = corpo.x; y = corpo.y + 4; }
    this.dica.setPosition(Math.round(x), Math.round(y)).setVisible(true);
  }

  // ===== minimapa (DOM; mesmas cores do mundo) ========================
  // Minimapa sobre o mundo (médio, celular e largo em tela baixa): ele não
  // recebe cliques (pointer-events:none no CSS, o clique chega ao canvas) e
  // fica translúcido quando o jogador, um inimigo ou um NPC passa por baixo.
  atualizarMapaSobre() {
    const caixa = document.getElementById("mapaSobre"), canvas = this.game.canvas;
    if (!caixa || !canvas) return;
    const m = caixa.getBoundingClientRect();
    let coberto = false;
    if (m.width && m.height) {
      const c = canvas.getBoundingClientRect(), cam = this.cameras.main, v = cam.worldView;
      const kx = c.width / this.scale.width, ky = c.height / this.scale.height;
      const tela = (s) => [c.left + (cam.x + (s.x - v.x) * cam.zoom) * kx, c.top + (cam.y + (s.y - v.y) * cam.zoom) * ky];
      const sprites = [this.jogador, ...Object.values(this.entidades).map((e) => e.sprite)];
      coberto = sprites.some((s) => {
        if (!s || !s.visible) return false;
        const [x, y] = tela(s), meiaL = (s.displayWidth * cam.zoom * kx) / 2, alt = s.displayHeight * cam.zoom * ky;
        return x + meiaL > m.left && x - meiaL < m.right && y > m.top && y - alt < m.bottom;
      });
    }
    caixa.classList.toggle("encoberto", coberto);
  }
  desenharMinimapa() {
    const canvas = document.querySelector("#miniMap"), ctx = canvas?.getContext("2d");
    if (!ctx || !this.p) return;
    const W = canvas.width, H = canvas.height, sx = W / COLS, sy = H / ROWS;
    if (!this.minimapaEstatico) {
      const cores = Arte.minimapaCores(this.areaAtual);
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const g = c.getContext("2d"), m = mapas[this.areaAtual], ts = this.tileset;
      const noMar = this.areaAtual === "mar";
      g.fillStyle = cores.fundo; g.fillRect(0, 0, W, H);
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++) {
          const borda = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
          const idx = ts.indice(x, y);
          // No mar toda casa usa um índice de água (o "chão" já é água);
          // ali valem borda, ilhas/rochedos e a rota da linha 30.
          const agua = !noMar && idx >= Arte.ID_TILE.COSTA && idx < Arte.ID_TILE.BORDA;
          let cor = cores.chao;
          if (agua) cor = cores.agua;
          else if (borda) cor = cores.borda;
          else if (m[y][x]) cor = cores.obstaculo;
          else if (noMar ? y === 30 : ts.ehCaminho(x, y)) cor = cores.caminho;
          g.fillStyle = cor;
          g.fillRect(Math.floor(x * sx), Math.floor(y * sy), Math.ceil(sx), Math.ceil(sy));
        }
      this.minimapaEstatico = c;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.minimapaEstatico, 0, 0);
    const ponto = (x, y, cor, t = 2) => {
      ctx.fillStyle = "#2a1a14";
      ctx.fillRect(Math.round((x + 0.5) * sx - t / 2) - 1, Math.round((y + 0.5) * sy - t / 2) - 1, t + 2, t + 2);
      ctx.fillStyle = cor;
      ctx.fillRect(Math.round((x + 0.5) * sx - t / 2), Math.round((y + 0.5) * sy - t / 2), t, t);
    };
    const a = areas[this.areaAtual];
    for (const t of PORTAIS) if (t.area === this.areaAtual) ponto(t.x, t.y, "#b98ad0", 3);
    if (a?.passagem) ponto(a.passagem.x, a.passagem.y, "#b98ad0", 3);
    if (a?.cais) ponto(a.cais.x, a.cais.y, "#6fd0d0", 3);
    if (this.areaAtual === "mar") {
      for (const c of [a.caisCanaa, a.caisDeserto]) ponto(c.x, c.y, "#6fd0d0", 3);
      for (const pt of pontosPesca) ponto(pt.x, pt.y, "#6fd0d0", 2);
    }
    for (const ent of Object.values(this.entidades)) {
      const d = ent.tipo === "inimigo" ? inimigos[ent.id] : ent.dados;
      if (ent.tipo === "npc") ponto(d.x, d.y, ent.estadoBalao === "missao" || ent.estadoBalao === "entregar" ? "#f2d27a" : "#e8b94a", ent.estadoBalao === "missao" || ent.estadoBalao === "entregar" ? 4 : 3);
      else ponto(d.x, d.y, "#ef6a5e", 3);
    }
    const v = this.cameras.main.worldView;
    ctx.strokeStyle = "#2a1a14cc";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(v.x * sx / TAM) + 0.5, Math.round(v.y * sy / TAM) + 0.5, Math.round(v.width * sx / TAM), Math.round(v.height * sy / TAM));
    if (Math.floor(this.time.now / 400) % 2 === 0 || reduzMovimento()) ponto(this.p.x, this.p.y, "#f3e4c0", 4);
    else ponto(this.p.x, this.p.y, "#3b5a9a", 4);
  }
}

// ---------------------------------------------------------------------
// Fachada para a interface (§2.3)
// ---------------------------------------------------------------------
window.Jogo = {
  pronto: false,
  entrada: { dx: 0, dy: 0 },
  executar(comando) {
    const s = window.gameScene;
    if (s) return s.executarComando(comando);
    return Mundo.executar(MEU_ID, comando);
  },
  selecionarAlvo(id) { window.gameScene?.selecionarAlvo(id || null); },
  acao(nome) {
    const s = window.gameScene;
    if (!s) return null;
    switch (nome) {
      case "atacar": return s.atacarAlvo(false);
      case "flecha": return s.atacarAlvo(true);
      case "interagir": return s.acaoContextual();
      case "pescar": return s.pescar();
      case "orar": return (window.UI?.abrirOracao || window.abrirOracao)?.();
      case "pocao": return s.usarPocao();
      case "pocaoFe": return s.usarPocaoFe();
      default: return null;
    }
  },
  usarAtalho(i) { return window.gameScene?.usarHotkey(i); },
  alvoAtual() { return window.gameScene?.alvoId || null; },
  podeInteragir() {
    const r = window.gameScene?.podeInteragir();
    return r ? { tipo: r.tipo, id: r.id, rotulo: r.rotulo } : null;
  },
};

// ---------------------------------------------------------------------
// Boot: espera as fontes (no máximo 1,5 s) e cria o jogo em Scale.RESIZE.
// ---------------------------------------------------------------------
function iniciarJogo() {
  const raiz = document.getElementById("game-root");
  if (raiz) {
    raiz.style.position = "relative";
    raiz.style.overflow = "hidden";
  }
  const fontes = document.fonts
    ? Promise.all(['14px "Pixelify Sans"', '700 28px "Cinzel"', '14px "Alegreya Sans"'].map((f) => document.fonts.load(f).catch(() => null)))
    : Promise.resolve();
  Promise.race([fontes, new Promise((r) => setTimeout(r, 1500))])
    .catch(() => {})
    .then(() => {
      const jogo = new Phaser.Game({
        type: Phaser.AUTO,
        parent: "game-root",
        pixelArt: true,
        roundPixels: true,
        backgroundColor: "#1c1210",
        scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
        scene: Cena,
      });
      jogo.events.once("ready", () => {
        const c = jogo.canvas;
        if (c) { c.style.position = "absolute"; c.style.left = "0"; c.style.top = "0"; }
      });
    });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciarJogo);
else iniciarJogo();
