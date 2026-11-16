// Teste do spike: dois clientes (WebSocket) contra a sala. Precisa do servidor rodando: npm run dev
// Mede latência, confere a presença dos dois e mostra o que quebra quando dois jogadores dividem um mundo.
const BASE = process.env.SPIKE_URL || "ws://127.0.0.1:8799/ws";
const SALA = `teste-${Date.now()}`;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (v, q) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };

class Cliente {
  constructor(id) { this.id = id; this.seq = 0; this.pend = new Map(); this.presenca = []; this.eventos = []; }
  conectar() {
    return new Promise((ok, falha) => {
      this.ws = new WebSocket(`${BASE}?sala=${SALA}`);
      this.ws.onopen = () => ok();
      this.ws.onerror = (e) => falha(new Error("falha ao conectar: " + (e.message || e.type)));
      this.ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === "presenca") this.presenca = m.jogadores;
        else if (m.t === "eventos") this.eventos.push(...m.eventos);
        else if (m.seq !== undefined && this.pend.has(m.seq)) { this.pend.get(m.seq)(m); this.pend.delete(m.seq); }
        else if (m.t === "entrou" && this.pend.has("entrou")) { this.pend.get("entrou")(m); this.pend.delete("entrou"); }
      };
    });
  }
  entrar() { return new Promise((ok) => { this.pend.set("entrou", ok); this.ws.send(JSON.stringify({ t: "entrar", id: this.id })); }); }
  pedir(msg) { const seq = ++this.seq; return new Promise((ok) => { this.pend.set(seq, ok); this.ws.send(JSON.stringify({ ...msg, seq })); }); }
  cmd(comando) { return this.pedir({ t: "cmd", comando }); }
  dbg(op, extra = {}) { return this.pedir({ t: "debug", op, ...extra }).then((m) => m.dados); }
  fechar() { this.ws.close(); }
}

const relatorio = {};
const A = new Cliente("jogadorA"), B = new Cliente("jogadorB");
await Promise.all([A.conectar(), B.conectar()]);

// 1. Entrar: o logica.js carrega no Durable Object e cada personagem é criado.
const ea = await A.entrar();
const eb = await B.entrar();
await espera(400);
relatorio["1. entrada"] = {
  A: ea.p, B: eb.p,
  tamanhoDoSaveBytes: ea.bytesSave,
  A_ve: A.presenca.map((j) => j.id), B_ve: B.presenca.map((j) => j.id),
};

// 2. Latência: 60 passos por jogador, um de cada vez, e depois os dois ao mesmo tempo.
async function passos(c, n) {
  const rtt = [];
  let aceitos = 0;
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    const m = await c.cmd({ tipo: "mover", dx: i % 2 === 0 ? 1 : -1, dy: 0 });
    rtt.push(performance.now() - t);
    if (m.r.ok) aceitos++;
  }
  return { rtt, aceitos };
}
const sozinho = await passos(A, 60);
const [pa, pb] = await Promise.all([passos(A, 60), passos(B, 60)]);
const resumoRtt = (v) => ({ medianaMs: +pct(v, 0.5).toFixed(2), p95Ms: +pct(v, 0.95).toFixed(2), maxMs: +Math.max(...v).toFixed(2) });
relatorio["2. latência local (ida e volta de um passo)"] = { um_jogador: resumoRtt(sozinho.rtt), dois_ao_mesmo_tempo: resumoRtt([...pa.rtt, ...pb.rtt]), passosAceitos: [sozinho.aceitos, pa.aceitos, pb.aceitos] };

// 3. Autoridade: o servidor limita a velocidade do passo? 100 passos em rajada, sem esperar a resposta.
const antes = (await A.cmd({ tipo: "mover", dx: 0, dy: 0 })).r;
const inicio = performance.now();
const rajada = await Promise.all(Array.from({ length: 100 }, (_, i) => A.cmd({ tipo: "mover", dx: i % 2 === 0 ? 1 : -1, dy: 0 })));
const dur = performance.now() - inicio;
relatorio["3. velocidade imposta pelo servidor"] = {
  passosEnviadosEmUmaRajada: 100, aceitos: rajada.filter((m) => m.r.ok).length, duracaoMs: Math.round(dur),
  passosPorSegundoObtidos: Math.round((rajada.filter((m) => m.r.ok).length * 1000) / dur),
  limiteDoJogoNivel1: "4 passos/s (velocidadeDoJogador)",
  passoMaiorQue1Casa: (await A.cmd({ tipo: "mover", dx: 30, dy: 0 })).r.ok ? "ACEITO (falha)" : "recusado",
};

// 4. Dividir um mundo: criaturas e vida por jogador.
const LOBO = "lobo1";
const l0 = await A.dbg("criatura", { criatura: LOBO });
// A leva o lobo para perto e o lobo se aproxima; depois B entra de novo (como um 3º jogador chegando).
await A.dbg("teleportar", { x: l0.x + 4, y: l0.y });
await espera(2500);
const lAntes = await A.dbg("criatura", { criatura: LOBO });
const C = new Cliente("jogadorC");
await C.conectar();
await C.entrar();
const lDepois = await A.dbg("criatura", { criatura: LOBO });
relatorio["4a. um jogador novo entra e a criatura volta ao início para todos"] = {
  inicioDoLobo: l0.inicio, antesDeCEntrar: [lAntes.x, lAntes.y], depoisDeCEntrar: [lDepois.x, lDepois.y],
  resetou: lAntes.x !== lDepois.x || lAntes.y !== lDepois.y,
};
C.fechar();

const kill = await A.dbg("derrubar", { criatura: LOBO });
const vistas = await A.dbg("criatura", { criatura: LOBO });
relatorio["4b. A derrota o lobo; B vê?"] = { A_derrotou: kill.derrotado, vidaDoLoboNaVisaoDeCada: vistas.vidaPorJogador };

// 4c. Os dois ao lado de outra criatura: quem leva o dano?
const L2 = "escorpiao1";
const e0 = await A.dbg("criatura", { criatura: L2 });
await A.dbg("teleportar", { id: "jogadorA", x: e0.x + 1, y: e0.y, area: "deserto" });
await A.dbg("teleportar", { id: "jogadorB", x: e0.x - 1, y: e0.y, area: "deserto" });
const v0 = await A.dbg("vidas");
await espera(6000);
const v1 = await A.dbg("vidas");
relatorio["4c. dois jogadores ao lado de uma criatura (6 s): vida antes → depois"] = {
  A: [v0.jogadorA, v1.jogadorA], B: [v0.jogadorB, v1.jogadorB],
  quemApanhou: v1.jogadorA < v0.jogadorA && v1.jogadorB < v0.jogadorB ? "os dois" : v1.jogadorA < v0.jogadorA ? "só A" : v1.jogadorB < v0.jogadorB ? "só B" : "ninguém",
};

// 5. Laço do mundo dentro do Durable Object.
relatorio["5. laço do mundo na sala"] = await A.dbg("stats");

console.log(JSON.stringify(relatorio, null, 2));
A.fechar(); B.fechar();
await espera(200);
process.exit(0);
