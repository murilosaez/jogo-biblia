// Spike: o logica.js do jogo rodando dentro de um Durable Object, com WebSocket.
// Uma "sala" = um Durable Object com o seu próprio mundo (um Mundo do jogo). Aqui só testamos a viabilidade.
//
// Protocolo (JSON):
//   cliente → { t: "entrar", id }                       entra na sala com esse personagem
//   cliente → { t: "cmd", seq, comando }                comando do jogo (mesmo formato de Mundo.executar)
//   cliente → { t: "debug", seq, op, ... }              SÓ PARA O TESTE (teleportar, inspecionar, derrubar...)
//   servidor → { t: "entrou", id, p, bytesSave }
//   servidor → { t: "res", seq, r }                     resultado do comando
//   servidor → { t: "presenca", jogadores: [...] }      posição de todos, a cada mudança
//   servidor → { t: "eventos", eventos: [...] }         o que o laço do mundo gerou para esse jogador
//   servidor → { t: "dbg", seq, dados }
import { DurableObject } from "cloudflare:workers";
import { criarJogo } from "./jogo.gerado.js";

const INTERVALO_TICK_MS = 250;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("Use WebSocket", { status: 426 });
      const sala = url.searchParams.get("sala") || "cidade-1";
      return env.SALA.get(env.SALA.idFromName(sala)).fetch(request);
    }
    return new Response("Spike do servidor do Jornada: conecte em /ws?sala=nome", { status: 200 });
  },
};

export class Sala extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.memoria = new Map(); // o "localStorage" do jogo
    this.jogo = criarJogo(this.memoria);
    this.conexoes = new Map(); // WebSocket → id do personagem
    this.timer = null;
    this.stats = { ticks: 0, eventos: 0, comandos: 0, aceitos: 0, danoRecebido: {}, ultimoTick: 0, intervalos: [] };
    this.ultimaPresenca = "";
  }

  async fetch() {
    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    servidor.accept();
    servidor.addEventListener("message", (e) => this.aoReceber(servidor, e.data));
    servidor.addEventListener("close", () => this.aoFechar(servidor));
    servidor.addEventListener("error", () => this.aoFechar(servidor));
    return new Response(null, { status: 101, webSocket: cliente });
  }

  enviar(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch { /* socket fechado */ }
  }

  aoReceber(ws, bruto) {
    let m;
    try { m = JSON.parse(bruto); } catch { return; }
    const { Mundo } = this.jogo;
    if (m.t === "entrar") {
      const id = String(m.id || "").slice(0, 40);
      if (!id) return;
      Mundo.entrar(id);
      this.conexoes.set(ws, id);
      const p = Mundo.jogadores[id];
      this.enviar(ws, { t: "entrou", id, p: this.resumo(p), bytesSave: JSON.stringify(p).length });
      this.iniciarTick();
      this.transmitirPresenca(true);
      return;
    }
    const id = this.conexoes.get(ws);
    if (!id) return;
    if (m.t === "cmd") {
      this.stats.comandos++;
      const r = Mundo.executar(id, m.comando) || {};
      if (r.ok) this.stats.aceitos++;
      const p = Mundo.jogadores[id];
      this.enviar(ws, { t: "res", seq: m.seq, r: { ok: !!r.ok, mensagem: r.mensagem, derrotado: r.derrotado, ...this.resumo(p) } });
      this.transmitirPresenca();
      return;
    }
    if (m.t === "debug") this.enviar(ws, { t: "dbg", seq: m.seq, dados: this.debug(id, m) });
  }

  aoFechar(ws) {
    const id = this.conexoes.get(ws);
    this.conexoes.delete(ws);
    if (id) delete this.jogo.Mundo.jogadores[id];
    if (!this.conexoes.size) this.pararTick();
    else this.transmitirPresenca(true);
  }

  resumo(p) {
    return p ? { x: p.x, y: p.y, area: p.area, vida: p.vida, nivel: p.nivel, moedas: p.moedas } : null;
  }

  iniciarTick() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), INTERVALO_TICK_MS);
  }

  pararTick() {
    clearInterval(this.timer);
    this.timer = null;
  }

  // O laço do mundo: um Mundo.atualizar por jogador conectado (como o navegador faz hoje, a cada quadro).
  tick() {
    const { Mundo } = this.jogo;
    const agora = Date.now();
    if (this.stats.ultimoTick) this.stats.intervalos.push(agora - this.stats.ultimoTick);
    this.stats.ultimoTick = agora;
    this.stats.ticks++;
    for (const [ws, id] of this.conexoes) {
      const eventos = Mundo.atualizar(id, agora) || [];
      if (!eventos.length) continue;
      this.stats.eventos += eventos.length;
      for (const ev of eventos) if (ev.tipo === "jogadorAtingido") this.stats.danoRecebido[id] = (this.stats.danoRecebido[id] || 0) + (ev.dano || 0);
      this.enviar(ws, { t: "eventos", eventos: eventos.map((ev) => ({ tipo: ev.tipo, dano: ev.dano, mensagem: ev.mensagem })) });
    }
    this.transmitirPresenca();
  }

  transmitirPresenca(forcar = false) {
    const { Mundo } = this.jogo;
    const jogadores = [...this.conexoes.values()].map((id) => ({ id, ...this.resumo(Mundo.jogadores[id]) }));
    const chave = JSON.stringify(jogadores);
    if (!forcar && chave === this.ultimaPresenca) return;
    this.ultimaPresenca = chave;
    for (const ws of this.conexoes.keys()) this.enviar(ws, { t: "presenca", jogadores });
  }

  // ---- SÓ PARA O TESTE ----
  debug(id, m) {
    const { Mundo, inimigos, distanciaChebyshev } = this.jogo;
    const ids = [...this.conexoes.values()];
    switch (m.op) {
      case "teleportar": {
        const p = Mundo.jogadores[m.id || id];
        Object.assign(p, { x: m.x, y: m.y, area: m.area || p.area });
        return this.resumo(p);
      }
      case "criatura": {
        const e = inimigos[m.criatura];
        const vida = {};
        for (const j of ids) vida[j] = Mundo.obterVidaInimigo(j, m.criatura);
        return { x: e.x, y: e.y, inicio: [e.inicioX, e.inicioY], vidaPorJogador: vida };
      }
      case "derrubar": {
        // Põe o jogador ao lado da criatura, deixa a vida dela em 1 e ataca uma vez.
        const e = inimigos[m.criatura];
        const p = Mundo.jogadores[id];
        Object.assign(p, { area: e.area, x: e.x + 1, y: e.y });
        p.vidaInimigos[m.criatura] = 1;
        const r = Mundo.executar(id, { tipo: "atacar", alvoId: m.criatura }) || {};
        return { ok: !!r.ok, derrotado: !!r.derrotado, mensagem: r.mensagem };
      }
      case "vidas":
        return Object.fromEntries(ids.map((j) => [j, Mundo.jogadores[j].vida]));
      case "perto": {
        const e = inimigos[m.criatura];
        return Object.fromEntries(ids.map((j) => [j, distanciaChebyshev(Mundo.jogadores[j], e)]));
      }
      case "stats": {
        const iv = this.stats.intervalos.slice(-100).sort((a, b) => a - b);
        return { ...this.stats, intervalos: undefined, intervaloMedioMs: iv.length ? Math.round(iv.reduce((s, x) => s + x, 0) / iv.length) : null, intervaloP95Ms: iv.length ? iv[Math.floor(iv.length * 0.95)] : null, criaturas: Object.keys(inimigos).length };
      }
      default:
        return { erro: "op desconhecida" };
    }
  }
}
