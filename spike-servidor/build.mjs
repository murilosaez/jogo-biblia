// Empacota o jogo (storage.js + dados/*.js + logica.js, na ordem do index.html) num módulo ES para o Worker.
// Os arquivos originais NÃO são alterados: o build só lê e junta o texto numa função criarJogo(memoria), que
// fornece o localStorage (uma Map em memória, no lugar do navegador) e devolve o que o spike precisa.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..");

// A ordem vem do index.html, para não divergir do que o navegador carrega.
const html = readFileSync(join(raiz, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const ate = scripts.indexOf("logica.js");
if (ate < 0) throw new Error("index.html: logica.js não encontrado");
const arquivos = scripts.slice(0, ate + 1).filter((s) => !s.startsWith("http"));

const fontes = arquivos.map((f) => `// ===== ${f} =====\n${readFileSync(join(raiz, f), "utf8")}`).join("\n;\n");

const saida = `// GERADO por build.mjs — não edite. Arquivos: ${arquivos.join(", ")}
export function criarJogo(memoria) {
  // O jogo guarda saves no localStorage; no servidor ele aponta para uma Map (o spike ainda não grava no D1).
  const localStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => { memoria.set(k, String(v)); },
    removeItem: (k) => { memoria.delete(k); },
  };
${fontes}
  return { Mundo, Storage, inimigos, areas, mapas, npcs, COLS, ROWS, velocidadeDoJogador, distanciaChebyshev };
}
`;

mkdirSync(join(aqui, "src"), { recursive: true });
writeFileSync(join(aqui, "src", "jogo.gerado.js"), saida);
console.log(`jogo.gerado.js: ${(saida.length / 1024).toFixed(0)} KB, de ${arquivos.length} arquivos (${arquivos.join(", ")})`);
