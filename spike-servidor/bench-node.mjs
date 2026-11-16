// Custo de CPU do mundo do jogo. Dentro do workerd o relógio só avança em operações de I/O (proteção contra
// ataques de tempo), então não dá para cronometrar o cálculo lá: medimos aqui, no Node (mesmo motor V8).
import { criarJogo } from "./src/jogo.gerado.js";

const ms = (f) => { const t = performance.now(); f(); return performance.now() - t; };
const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;

// Partida a frio: criar o jogo (carregar ~490 KB de código e montar os mapas de 7 áreas).
const frio = [];
let jogo;
for (let i = 0; i < 5; i++) frio.push(ms(() => { jogo = criarJogo(new Map()); }));
console.log(`criarJogo (partida a frio): 1ª vez ${frio[0].toFixed(0)} ms, depois ~${media(frio.slice(1)).toFixed(0)} ms`);

const { Mundo, inimigos } = jogo;
const lista = Object.values(inimigos);
console.log(`criaturas no mundo: ${lista.length}`);

function cenario(n, ocupado) {
  const g = criarJogo(new Map());
  const { Mundo: M, inimigos: ini } = g;
  const vivos = Object.values(ini).filter((e) => !e.nomeado);
  const tEntrar = [];
  for (let i = 0; i < n; i++) tEntrar.push(ms(() => M.entrar(`j${i}`)));
  if (ocupado) {
    // cada jogador ao lado de uma criatura diferente (a IA de todas fica ativa e com alvo)
    for (let i = 0; i < n; i++) {
      const e = vivos[i % vivos.length];
      Object.assign(M.jogadores[`j${i}`], { area: e.area, x: e.x + 1, y: e.y, vida: 1e9 });
    }
  }
  const tick = [];
  let agora = Date.now();
  for (let k = 0; k < 400; k++) {
    agora += 250;
    tick.push(ms(() => { for (let i = 0; i < n; i++) M.atualizar(`j${i}`, agora); }));
  }
  tick.sort((a, b) => a - b);
  return { n, entrarMedioMs: +media(tEntrar).toFixed(2), tickMedioMs: +media(tick).toFixed(3), tickP99Ms: +tick[Math.floor(tick.length * 0.99)].toFixed(3), porJogadorUs: Math.round((media(tick) * 1000) / n) };
}

for (const ocupado of [false, true]) {
  console.log(`\n${ocupado ? "TODOS EM COMBATE (cada um ao lado de uma criatura)" : "OCIOSOS (parados no início)"} — um tick a cada 250 ms:`);
  for (const n of [1, 10, 25, 50, 100, 200]) {
    const r = cenario(n, ocupado);
    console.log(`  ${String(r.n).padStart(3)} jogadores: tick médio ${String(r.tickMedioMs).padStart(7)} ms (p99 ${String(r.tickP99Ms).padStart(7)} ms) = ${String(r.porJogadorUs).padStart(5)} µs/jogador · ${((r.tickMedioMs / 250) * 100).toFixed(1)}% de um núcleo`);
  }
}
