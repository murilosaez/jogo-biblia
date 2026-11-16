# Spike do servidor (descartável)

Teste técnico: o `logica.js` do jogo rodando **sem alterações** dentro de um Durable Object da Cloudflare, com
WebSocket. Não faz parte do jogo e não altera nenhum arquivo dele. Roda só local (sem conta, sem deploy).

## Como rodar

```
cd spike-servidor
npm install            # só aqui dentro (wrangler)
npm run dev            # gera src/jogo.gerado.js e sobe o wrangler em :8799
npm run teste          # em outro terminal: dois clientes contra a sala
node bench-node.mjs    # custo de CPU do mundo (no Node: o relógio do workerd não avança durante o cálculo)
node --expose-gc bench-memoria.mjs
```

`build.mjs` junta `storage.js`, `dados/*.js` e `logica.js` (na ordem do `index.html`) numa função `criarJogo()` e
troca o `localStorage` por uma `Map`. Os originais só são lidos.

## Resultados

| Pergunta | Resposta |
|---|---|
| O `logica.js` roda no workerd? | Sim, sem nenhuma mudança (módulo ES estrito, sem `eval`). Só precisou do `localStorage` trocado por uma Map. |
| Custo de CPU do laço | ~20–40 µs por jogador por tick (250 ms). 200 jogadores em combate ≈ 2,5% de um núcleo. Não é o gargalo. |
| Partida a frio | `criarJogo` leva ~70–100 ms. |
| Memória | ~3,7 MB por mundo (cada mundo recarrega todos os dados e mapas). 30 mundos ≈ 110 MB. |
| Latência | ~0,6 ms por passo, mas é localhost: só mostra que o custo do servidor é desprezível. A latência real será a da rede. |

## O que quebra com dois jogadores no mesmo mundo (já visto no teste)

1. **A velocidade não é limitada pelo servidor.** 100 passos em rajada foram todos aceitos (~2.000 passos/s contra
   os 4 do nível 1). Hoje quem segura o ritmo é o cliente. Passo maior que 1 casa já é recusado.
2. **Entrar zera as criaturas de todos.** `Mundo.entrar` reposiciona as 120 criaturas: um jogador novo
   "teletransporta" as criaturas que já estavam perseguindo outro.
3. **A vida da criatura é por jogador.** A derrotou o lobo; para B ele continua vivo com 70 de vida.
4. **O dano vai para um só.** Dois jogadores ao lado de uma criatura: só um apanhou (a criatura é única e o
   ataque dela fica no relógio compartilhado).

Os itens 2 a 4 confirmam que um grupo na mesma instância exige separar o **estado do mundo** (criaturas, saques,
vida) do **estado do jogador**. O item 1 pede validação de ritmo no servidor.
