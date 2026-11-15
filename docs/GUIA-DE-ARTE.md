# Guia de arte — Jornada · RPG Bíblico

Toda a arte do jogo é pixel art **original, gerada em código**, de tema bíblico (fauna, trajes e arquitetura
do antigo Israel e do Egito). O alvo de qualidade é o dos MMORPGs 2D clássicos de vista oblíqua: personagem
alto que transborda a casa, chão denso, objetos altos, um efeito por golpe. Nenhum sprite, criatura, ícone ou
interface de outro jogo é copiado.

Onde mora cada coisa:

| Arquivo | O que desenha |
| --- | --- |
| `sprites.js` | motor (`Arte.motor`), tabelas (paleta, biomas, cfgs dos humanos, equipamento), portais, balões, sombras e a reserva |
| `arte/quadrupede.js`, `arte/ave-serpente.js`, `arte/artropode.js` | as 21 criaturas não humanas e os 2 aliados |
| `arte/humano.js`, `arte/humano-equip.js` | o esqueleto humano e os 36 acessórios, armaduras e trajes |
| `arte/montado.js` | jogador montado (4 montarias), prévias da loja e o barco |
| `arte/flora.js` | árvores, rochas, muretas, marcos, tendas, bancas, poço e decoração |
| `arte/terreno.js` | pintores do tileset (chão de reserva, água, costa, borda, moldura) |
| `arte/efeitos.js`, `arte/itens.js`, `arte/icones.js` | efeitos (`Arte.FX`), itens e glifos |
| `cenario.js` | chão contínuo, prédios onde se entra, muros, portas e móveis (motor `Tela`) |

Capturas de referência em `docs/capturas/` (geradas por `tools/capturar.js`, ver a seção 10).

## 1. Resolução e unidades

- **32 px de arte por casa**; 1 px de arte = 1 px de mundo. `Arte.RES = 2`, `Arte.PX = 2`, `TAM = 32`.
- `def.w` e `def.h` são em **unidades de 2 px** (1/16 de casa): célula de 48 × 64 px é `w: 24, h: 32`.
  As coordenadas de desenho (`g.fino`, `retF`, `elipF`, `linF`) são em px de arte.
- O desenho é **px a px**. Em `arte/*.js` são proibidas as primitivas de bloco 2 × 2 (`g.p`, `g.ret`,
  `g.lin`, `g.elip`, `g.carimbar`, `pin.set`, `pin.encher`); os testes `arte/motor` e `68b` recusam pelo texto.
- Câmera: zoom **inteiro** por px de arte, o mais perto de 15 × 11 casas (deitada) ou 9 × 13 (em pé) e nunca
  menos que o `devicePixelRatio` (`pixelsPorPixelDeArte` em `game.js`). Medido: 2× em 1366 × 768
  (17,1 × 8,4 casas), 1600 × 900 (20,7 × 10,4) e 1920 × 1080 (25,7 × 13,3) — casa de 64 px de tela; no
  celular de 390 × 844 com DPR 3, 4 px de tela por px de arte (9,1 × 16,1 casas). `+`/`−` e a roda ajustam.

## 2. Células e quadros

| Família | Célula (px de arte) | Quadros |
| --- | --- | --- |
| Humano (`pj_*`, `in_*` humanos, jogador) | 48 × 64, pés na linha 62, corpo de 55 a 57 px (≈ 1,75 casa) | 3 vistas × 8 |
| Jogador montado | 72 × 96 | 3 vistas × 8 |
| Prévia de montaria (`mt_*`) | 64 × 64 | 1 |
| Criatura pequena (rã, escorpião, caranguejo, corvo) | 40 × 40 | 3 vistas × 8 |
| Criatura média (cão, ovelha, lobo, chacal, hiena, cabra, javali, víbora, naja, abutre, águia, enxames) | 48 × 48 | 3 vistas × 8 |
| Criatura grande (leão, urso, leopardo, crocodilo) | 64 × 64 | 3 vistas × 8 |
| Barco (`mk_barco`) | 64 × 64 | 3 vistas × 4 |
| Árvore alta (oliveira, acácia, tamareira, figueira) | 64 × 96 (acácia do Sinai e ilhota 64 × 80) | 1 a 3 variantes |
| Coluna, estandarte | 48 × 88 | 1 |
| Rocha, basalto, granito | 48 × 40; penedo e rochedo 64 × 56 | 2 a 3 variantes |
| Arbusto, mureta, jarros, coral | 40 × 40 ou 40 × 44 | 1 a 2 variantes |
| Casa, tenda, banca, poço (`es_*`, as que não se entra) | 104 × 104, 104 × 88, 104 × 92, 40 × 56 | 4, 4, 2, 1 variantes |
| Item | 32 × 32, origem `[0.5, 0.75]` | 1 (moeda: 4) |
| Glifo `ui_*` | 16 × 16 (`ui_rosa` 32 × 32) | 1 |
| Glifo `hb_*`, `of_*` | 32 × 32 | 1 |
| Efeito `fx_*` | 32 × 32; impacto e morte 48 × 48; fogo 32 × 48 | tira, ver `Arte.FX` |

Os tamanhos dos glifos estão em `Arte.TAM_ICONE` (`{ ui: 16, hb: 32, of: 32, rosa: 32 }`).

**Vistas e quadros** (contrato de toda def com `direcoes: 3, quadrosPorVista: 8`):

- `vista = Math.floor(quadro / 8)`: 0 de lado virado para a **direita** (a esquerda é `setFlipX`), 1 de frente,
  2 de costas.
- `quadro % 8`: 0 parado, 1 respirar, 2 contato A, 3 passagem A, 4 contato B, 5 passagem B, 6 antecipação do
  golpe, 7 golpe. A def declara `ciclo: [2, 3, 4, 5]` e `quadroAcao: [6, 7]`.
- `sombra: { w, h }` em px (o jogo põe `fx_sombra_<w>x<h>` no chão; o desenho não cola sombra ao corpo),
  `alturaCabeca` em px de mundo acima dos pés (onde vão a barra e o nome) e, nos humanos, `busto`
  (`[6, 2, 11, 11]` em unidades) e `retratoQuadro`.
- Criaturas nunca levam `humano: true`. Raros nomeados usam `variante(porte, tinta)` da def
  (`Arte.garantirVariante` registra `<chave>~v:<tinta>.<porte × 100>`).
- Efeitos são tiras simples: `Arte.FX[chave] = { quadros, ms, laco }` (corte 5 × 45 ms, impacto 5 × 50 ms,
  sangue 5 × 60 ms, morte 6 × 90 ms, fogueira 6 × 110 ms em laço; projéteis com 3 orientações + espelho).

## 3. Luz, cor e contorno

- **Luz de cima e da esquerda** em tudo (sprites e `cenario.js`): realce em cima/esquerda, sombra
  embaixo/direita, sombra projetada para a direita e para baixo.
- **Rampa de 6 tons** por material (`rampa6(base, tipo)`; tipos: pano, pele, pelo, couro, madeira, pedra,
  folha, metal): a base fica no índice 3, a luz puxa ao creme quente e a sombra ao púrpura-sépia.
  `sombrear(rampa, l, X, Y)` devolve o tom para `l` de −1 a 1 e só usa o pontilhado Bayer 4 × 4 na faixa de
  transição entre dois tons. `esferaPx` e `panoPx` são atalhos para volume e pano.
- **Limite de cores do miolo**: 64 por sprite, 16 nos `ui_`, 24 nos `hb_`/`of_`, sem limite nos `fx_`.
  Passou do limite, o motor funde as cores mais raras.
- **Contorno** de 1 px automático e colorido: a cor do vizinho preenchido escurecida e puxada ao sépia
  `#2a1a14` (amigos, itens, cenário) ou ao carmim `#4a1416` (hostis), mais clara no lado da luz.
  `contorno: null` desliga (efeitos, enxames, glifos que desenham a própria borda). Arte sombreada com
  `rampa6` declara `acabamento: false`. `contornoLegado: true` (traço de cor única) ainda existe no motor e
  só é usado por teste.
- Sem `Math.random()`: toda variação vem de `hash2(x, y, semente)`; o desenho é igual a cada geração.

## 4. Humanos

- Proporção adulta em vista oblíqua: cabeça de 9 a 11 px, ombros, tronco, pernas e pés visíveis; 48 × 64 px.
- Moldes: `manto` (veste longa), `curta` (túnica curta, pernas à mostra), `veu` (veste longa com véu) e
  porte `grande`. Cores por letra (`coresHumano`): H cabelo, S/s pele, B barba, R/r/d tronco, P/p/q parte de
  baixo, A cinto e detalhes, F sandálias, V/W véu.
- A cfg de cada humano fica em `sprites.js` (`humano("pj_…", { molde, cores, barba, cabelo, acessorios… })`,
  guardada em `Arte.motor.HUMANOS`); o desenho é a spec de `arte/humano-equip.js`, ativada por
  `definirHumano(spec)`. O equipamento do jogador vira acessório (`LAMINAS`, `CORES_ESCUDO`, `ARCOS`) e
  armadura (`ARMADURAS`); a chave da textura é `pj_jogador|arma|arco|escudo|armadura|traje|montaria[|c:…]`.
- Passo: um ciclo de 4 fases por casa, sincronizado à fração do deslize; golpe em 2 tempos (antecipação e
  golpe) com investida de 4 px.

### Cosméticos e cores do visual

- O jogador pinta 4 partes — **cabeça** (cabelo ou o pano da cabeça do traje; o elmo é metal e fica),
  **tronco**, **pernas** e **detalhe** (cinto, gola e barra) — com as 24 cores de `CORES_VISUAL`
  (`dados/cosmeticos.js`). No save: `p.cosmeticos.cores = { cabeca, tronco, pernas, detalhe }`. As cores
  entram na chave da textura e valem por cima dos trajes.
- Trajes (`TRAJES[id].visual`) usam o mesmo esqueleto: molde, cores, gola, cabelo e acessórios que não são
  arma nem escudo. Com traje, a armadura vestida não aparece (a defesa continua).
- Montarias (jumento, cavalo, camelo, carro com parelha): o cavaleiro é o humano novo sobre o esqueleto de
  `arte/quadrupede.js`, com arreios próprios; cores em `MONTARIAS_ARTE`. Só aparência.

## 5. Criaturas, itens e ícones

- Cada espécie tem esqueleto e silhueta próprios nas 3 vistas (o teste 50 exige um sprite por espécie; o 68
  confere contrato, célula e base). Quadrúpedes: `arte/quadrupede.js` (anatomia por espécie em `A.largo`,
  pernas em pares diagonais); aves voam acima do chão com a sombra separada; serpentes rastejam; enxames são
  pontos soltos sem contorno.
- Itens: 32 × 32 px, sombra de apoio suave, leitura pela silhueta. A lista de chaves são as chamadas
  `item("…")` de `sprites.js` (os testes as procuram lá); o desenho é de `arte/itens.js`.
- Glifos: idem com `glifo("…")` e `arte/icones.js`. A interface usa `Arte.TAM_ICONE` para não reduzir um
  glifo de 32 px a 16.

## 6. Cenário

- **Chão contínuo** (`cenario.js`): pintado por pedaços de 16 × 16 casas (512 × 512 px) a partir das
  coordenadas do mundo, sem azulejo repetido — relva e areia em duas escalas de ruído, estrada de terra de
  beira irregular, rua de pedra nas vilas, chão pisado em volta de portas e poços, areia molhada na beira da
  água. A pintura é **fatiada** (`Cenario.pintarFatia`, 4 ms por quadro) e os pedaços longe da câmera são
  liberados; na troca de área as texturas de chão e de prédio da área anterior saem da memória.
- **Tileset** (`Arte.gerarTileset`, pintores de `arte/terreno.js`): 8 × 15 casas por região para água animada
  (4 fases, reenviada a cada 250 ms), costa, borda e moldura.
- **Alturas (só visuais)**: parede de prédio com **64 px** (2 casas, `Cenario.ALTURA_PAREDE`), muro com
  **34 px** (`ALTURA_MURO`), árvores de até 3 casas. Colisão, pegadas, interior e linha de visão continuam
  na grade de `logica.js`.
- **Prédios onde se entra**: chão, parede de dentro, fachada com o terraço (teto plano, como nas casas do
  antigo Israel e do Egito) e sombra projetada; porta de 26 × 56 px que abre com o jogador a uma casa.
  Materiais (`MATERIAIS_PREDIO`): adobe, pedra de Canaã, basalto da Galileia, tijolo do Egito, tenda grande.
- **Quem fica atrás**: objeto alto que cobre o corpo do jogador, de um NPC ou de uma criatura a até 4 casas
  fica a meio alfa (`registrarAlto`, `atualizarTranslucidez`). Jogador dentro do prédio: o telhado some;
  jogador nas 2 fileiras ao norte: telhado a meio alfa; NPC ou criatura atrás de um telhado ganha uma cópia
  translúcida por cima dele.
- **Orla e muros**: a borda do mapa vira mata, palmeiral ou pedregal do bioma; muros e muretas emendam com os
  vizinhos (máscara N/L/S/O).
- **Dia e noite** (`CICLO_DIA`): 40 min por dia, noite até 70% em azul profundo com luz nas fogueiras,
  candeias, interiores e portais. Só aparência.

## 7. Nomes, barras, números e movimento

- Todo personagem na tela tem **nome pequeno** (13 px de tela, com contorno) e **barra de vida** de 26 × 4 px
  de mundo com borda escura de 1 px (chefes 34 × 5), a 3 px da cabeça, na cor da vida. Personagem dentro de
  prédio de telhado fechado não mostra nome nem barra.
- **Números de dano** são texto com contorno, cor por tipo; nascem 17 px acima da cabeça (logo acima do nome),
  sobem 13 px em arco e somem em 820 ms.
- **Movimento**: sem tween de passo. Cada entidade guarda `{ x0, y0, x1, y1, t0, dur }` e é posicionada por
  interpolação linear a cada quadro. Jogador: 140 ms por casa (180 ms na diagonal); criatura: o intervalo
  medido entre dois passos dela (250 a 700 ms). A câmera segue um alvo invisível; o recuo do golpe é um
  deslocamento visual à parte.

## 8. Layout da interface

- **Cliente** (a partir de 761 px de largura): topo de 32 px; palco à esquerda com moldura de 4 px e, por
  baixo dele, a faixa de ação de 48 px (habilidades e atalhos) e o console (Geral, NPCs, Servidor); **uma**
  coluna à direita de 248 px (232 px até 1023 px) com janelinhas de barra de título de 20 px: Mapa, Estado,
  Equipamento, Batalha, Mochila, Bolsa, Missão, Caçada. Cada janela minimiza, fecha, muda de altura e de
  ordem; o estado fica em `localStorage`. O palco ocupa 61,5% da janela em 1600 × 900.
- **Celular** (até 760 px): palco em tela cheia, caixa de vida, botões de toque e abas inferiores.
- Skin própria: couro, pergaminho e bronze.

## 9. Paleta por região

Cada região usa só as cores abaixo no chão, nas manchas, nos caminhos, na borda e na decoração (os
obstáculos e estruturas derivam delas). Fonte: `BIOMAS` em `sprites.js`.

### canaan — Terra de oliveiras e pastores

Obstáculos: oliveira, muro, rocha.

| Papel | Cores |
|---|---|
| Chão | `#8fa34e` `#7b9042` `#a6b862` `#c3c873` |
| Mancha | `#7d9145` `#6a7e3a` |
| Caminho | `#c7a066` `#a98450` `#ddb97c` `#8c6a40` |
| Borda (sebe) | `#34401f` `#4a5a2a` `#6a7a3a` `#8a9a4a` |
| Decoração | anemona `#c8402f`, flor_branca `#efe6cf`, flor_amarela `#e9d36a`, tufo `#6e8a3a`, pedrinha `#b8ab8a` |
| Luz | `#ffd08a` (screen, 0.1) · vinheta `#1a2410` |

### deserto — Areias e acampamentos

Obstáculos: rocha, acacia, retama.

| Papel | Cores |
|---|---|
| Chão | `#e2c07c` `#cfa863` `#efd598` `#c4955a` |
| Mancha | `#d6b06c` `#c49a58` |
| Caminho | `#c9a16a` `#b08a58` `#d9b47e` `#a37e50` |
| Borda (duna) | `#9a7040` `#b88a50` `#d8b070` `#ecc890` |
| Decoração | pedrinha `#a8845a`, tufo_seco `#9a8550`, ondulacao `#cfa863`, pegadas `#b08a58` |
| Luz | `#ffbf6a` (screen, 0.12) · vinheta `#3a2410` |

### mar — Águas entre os portos

Obstáculos: ilhota, rochedo, recife.

| Papel | Cores |
|---|---|
| Chão | `#2f7f8c` `#276a78` `#3f98a0` `#bfe6d6` |
| Mancha | `#3f98a0` `#4fa3a5` |
| Caminho | `#358a96` `#2f7f8c` `#3f98a0` `#358a96` |
| Borda (mar_profundo) | `#163e4a` `#1d4f5c` `#245e6a` `#2f7680` |
| Água | `#1d4f5c` `#2f7f8c` `#276a78` `#3f98a0` `#bfe6d6` `#e8f2e0` |
| Decoração | cardume `#245e6a` |
| Luz | `#ffd9a0` (screen, 0.07) · vinheta `#0a2030` |

### egito — Às margens do Nilo

Obstáculos: tamareira, tijolos, coluna, jarros.

| Papel | Cores |
|---|---|
| Chão | `#9a8650` `#857344` `#b09c62` `#6f7a3a` |
| Mancha | `#7f6e3e` `#6a5c34` |
| Caminho | `#e6d3a0` `#cdb77f` `#f2e4bc` `#b09a68` |
| Borda (muro_tijolo) | `#6a3c22` `#87502f` `#a8683f` `#c8865a` |
| Água | `#1f5a5a` `#2c6e6e` `#245e5e` `#3a8a88` `#6aaaa0` `#e8f2e0` |
| Decoração | caco `#b5663a`, junco `#7a9a3a`, broto `#6f7a3a` |
| Luz | `#ffcc66` (screen, 0.12) · vinheta `#2a1a08` |

### marVermelho — A travessia

Obstáculos: granito, coral, destrocos.

| Papel | Cores |
|---|---|
| Chão | `#c49a72` `#a8866a` `#dcb48a` `#f0e0d0` |
| Mancha | `#a08868` `#8a7458` |
| Caminho | `#b89a78` `#9c8060` `#ccb090` `#8a7458` |
| Borda (praia_granito) | `#5a2a20` `#7a3426` `#a5503a` `#c87a58` |
| Água | `#153f52` `#215a6e` `#1b4d60` `#2a6f86` `#3f8aa0` `#e8f2e0` |
| Decoração | concha `#f0e0d0`, alga `#6a7a4a`, poca `#7a9aa0` |
| Luz | `#ff9f78` (screen, 0.12) · vinheta `#3a2238` |

### sinai — Onde o caminho sobe

Obstáculos: penedo, arbusto, marco, acacia.

| Papel | Cores |
|---|---|
| Chão | `#a08266` `#896d59` `#b89b7c` `#ccb294` |
| Mancha | `#8a6e5e` `#6a5248` |
| Caminho | `#c2a888` `#a08a6c` `#d4bea0` `#7a6450` |
| Borda (paredao) | `#2e2430` `#3a2a44` `#5a4a4a` `#7a6a62` |
| Decoração | seixo `#7a6a5a`, liquen `#9aa070`, tufo `#7a7f4a` |
| Luz | `#c8d0f0` (screen, 0.08) · vinheta `#10101e` |

### galileia — À beira do lago

Obstáculos: figueira, basalto_muro, basalto, barco.

| Papel | Cores |
|---|---|
| Chão | `#7ea05a` `#6a8c4c` `#97b86e` `#b8d080` |
| Mancha | `#74965a` `#62844a` |
| Caminho | `#8a7a62` `#6e604c` `#a8987c` `#5a4e3e` |
| Borda (muro_basalto) | `#262422` `#363432` `#4c4a48` `#6e6a64` |
| Água | `#2f6a7a` `#3a7688` `#336e80` `#4a8fa0` `#6aaab8` `#e8f2e0` |
| Decoração | anemona `#d8443a`, mostarda `#e2c044`, lirio `#b8a0d0`, tufo `#5e7e40` |
| Luz | `#ffe0a0` (screen, 0.08) · vinheta `#1a1408` |


## 10. Como escrever ou mexer num `arte/*.js`

- O arquivo é uma IIFE que começa por `(function (global) {`, não toca `document` nem `canvas` na carga (os
  testes rodam numa `vm` sem DOM) e registra **tudo na carga** com `Arte.motor.registrar(chave, def)`.
  Registrar com a mesma chave troca o desenho e apaga os caches daquela chave.
- Para manter os campos que o jogo lê (origem, `obstaculo`, `alto`, `quadros`), parta da def de reserva:
  `registrar(chave, Object.assign({}, PIXEL_PATTERNS[chave], { w, h, desenhar }))`.
- `sprites.js` guarda, para cada chave redesenhada, só um **marcador de reserva** (`reserva`, `item`,
  `glifo`, `obstaculo`) com esses campos; o boneco e a montaria de reserva são o que
  `definirHumano(null)` / `definirMontado(null)` devolvem. Nada disso aparece com os arquivos de arte
  carregados (o teste 68 confere que nenhuma chave ficou no marcador).
- Motor (`Arte.motor`): `Grade`, `registrar`, `pixels`, `rampa6`, `sombrear`, `esferaPx`, `panoPx`, `prim`
  (`retF`, `elipF`, `linF`, `bastao`, `pintarMascara`), `hash2`, `ruido`, `misturar`, `comAlfa`,
  `definirHumano`, `definirMontado`, `garantirSombra`, `garantirVariante`, `pintores`, `limparTilesets`.
- Ordem dentro de `pixels()`: `desenhar` → textura automática (só se pedida) → contorno → acabamento →
  `depois` (pinta por cima do contorno) → fusão de cores até o limite.
- Deixe 1 px livre nas bordas da célula (o contorno ocupa 1 px por fora da silhueta).
- Cada arquivo tem o seu teste em `tests/arte/<nome>.test.js` (nome do teste começa por `arte/<nome>:`).

Conferir:

```
node tools/capturar.js <pasta> --so-folhas --familia in_,al_     # folhas de contato, segundos
node tools/capturar.js <pasta> --tudo                            # jogo inteiro, tamanhos, deslize, combate, atrás, carga
node tools/capturar.js --comparar <pastaA> <pastaB> <saida>      # pares lado a lado
node tools/capturar.js <pasta> --tudo --hora 0.75                # a mesma captura à noite (padrão 0.1 = manhã; "real" = relógio)
node tests/logica.test.js 68                                     # contrato da arte
node tests/logica.test.js arte/                                  # testes de cada arquivo de arte
node tests/logica.test.js                                        # suíte inteira (~4 min)
```

Aceite: `relatorio.json` com `erros: []`, `validar.problemas: 0`, geração de todos os quadros abaixo de 3 s
e nenhum quadro acima de 50 ms ao andar 30 casas (`desempenho`); `carga` traz a troca de área, o primeiro
encontro de cada espécie, a memória de texturas e o reenvio da água; `desempenhoCelular` repete o percurso
em 390 × 844 com DPR 3 emulado.

Capturas em `docs/capturas/`: `inicio-1600x900.jpg`, `celular-390x844.jpg`, `tela-1366x768.jpg`,
`tela-1920x1080.jpg`, `regiao-<area>.jpg` e `regiao-canaan-zoom.jpg`, `combate.jpg`, `combate-golpe.jpg`,
`passo.jpg`, `atras-arvore.jpg`, `atras-casa.jpg`, `dentro-de-casa.jpg`, `folha-humanos.jpg`,
`folha-criaturas.jpg`, `folha-flora.jpg`, `folha-itens.jpg`, `folha-icones.jpg`, `folha-efeitos.jpg`,
`folha-montarias.jpg`, `antes-depois-inicio.jpg`, `antes-depois-combate.jpg`, `antes-depois-celular.jpg`.
