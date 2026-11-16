// Memória de cada "mundo" (uma instância de caçada ou masmorra carregaria o seu). Rode com: node --expose-gc bench-memoria.mjs
import { criarJogo } from "./src/jogo.gerado.js";
const mb = () => { global.gc(); return process.memoryUsage().heapUsed / 1048576; };
const base = mb();
const jogos = [];
for (let i = 1; i <= 30; i++) {
  const j = criarJogo(new Map());
  j.Mundo.entrar("a"); // um jogador dentro
  jogos.push(j);
  if ([1, 5, 10, 20, 30].includes(i)) console.log(`${String(i).padStart(2)} mundos: ${(mb() - base).toFixed(1)} MB no total · ${((mb() - base) / i).toFixed(2)} MB por mundo`);
}
