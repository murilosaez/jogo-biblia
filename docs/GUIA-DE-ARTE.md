# Guia de arte — Jornada · RPG Bíblico

Toda a arte é pixel art **original**, gerada em código por `sprites.js` (nenhum sprite copiado de outro jogo,
nenhuma imagem externa). Este guia descreve as regras de desenho desde a versão 16 (JGB-48, JGB-27 e JGB-12)
e documenta a paleta de cada região.

## 1. Resolução

- **32 px de arte por casa** (`Arte.RES = 2` px de arte por unidade). A casa tem 32 × 32 px de mundo, e
  1 px de arte = 1 px de mundo. A câmera mostra cerca de 15 × 11 casas na tela deitada (9 × 13 em pé), e
  cada px de arte ocupa um número **inteiro** de px da tela (`PIXELS_ARTE_POR_CASA = 32` em `game.js`;
  a roda do mouse e as teclas + e − mudam o zoom de 1 em 1).
- As coordenadas dos desenhos continuam em **unidades de 1/16 de casa** (as do desenho antigo, de 16 px por
  casa). A `Grade` guarda em 2× e calcula elipses, linhas e sombras em cada px de arte, então as curvas e o
  sombreado ficam finos sem reescrever cada número. Para detalhe de 1 px de arte use `g.pf`, `g.linf` e
  `g.retf` (aceitam meia unidade) ou `g.fino(X, Y)` em px de arte.
- Os glifos da interface (`ui_`, `hb_`, `of_`) ficam em 1 px por unidade: são ícones de botão, não arte do
  mundo.

## 2. Luz, contorno e acabamento

- Luz de cima e da esquerda: realce em cima/esquerda, sombra embaixo/direita, sombra projetada à direita.
- Contorno automático de **1 px de arte**: sépia `#2a1a14` (amigos, itens, cenário com volume) e carmim
  `#4a1416` (inimigos). Chão e decoração rasteira não têm contorno.
- Acabamento automático por dentro do contorno: 1 px mais claro nas bordas viradas para a luz e 1 px mais
  escuro nas viradas para baixo/direita.
- Criaturas e montarias ganham a textura fina (traços de 2 px de pelo, escama ou couro), espalhada por hash,
  nunca em "ruído de TV".
- Até 24 cores por sprite (o contorno não entra na fusão das cores raras).

## 3. Personagens (humanos)

- Célula de **40 × 48 px** (20 × 24 unidades), pés na linha 45, corpo de ~28 × 40 px (cabeça de 12 × 12).
- **15 quadros**: 0–4 de lado (virado para a direita; a esquerda é o espelho), 5–9 de frente e 10–14 de
  costas. Em cada vista: 0 parado, 1 respirar, 2 e 3 passos, 4 ação/fala. `game.js` escolhe a vista pelo
  último passo ou pelo alvo (`virar`): lado se o passo for mais horizontal.
- Moldes: `manto` (veste longa), `curta` (túnica curta, pernas à mostra) e `veu` (veste longa com véu).
  Cores por letra: H cabelo, S/s pele e sombra, B barba, R/r/d veste clara/média/escura, A cinto,
  F sandálias, V/W véu. Opções: `cabelo` (curto, longo, careca), `porte: "grande"`, `gola`, `capuz`,
  `mangaCor`, `armadura` e `acessorios`.
- Acessórios desenham nas 3 vistas, em camadas (`fundo`, `meio`, `frente`): cajados, lanças, espadas,
  porrete, escudos (redondo, alto, oval), arco nas costas e na mão, capas, turbante, elmo, faixa, bandana,
  nemes, colar, peitoral, bolsa, odre, saco, jarro, fardo, corda, rede, shofar, pele de leopardo, estola,
  brilho de feitiço e funda.
- Equipamento visível no jogador: espada (madeira, ferro, temperada), escudo (madeira, bronze, ferro),
  arco ou funda nas costas e armadura (túnica de pano, armadura de couro, couraça de escamas).

## 4. Cosméticos (JGB-27)

- Trajes (`dados/cosmeticos.js`, `TRAJES[id].visual`) usam o mesmo boneco: molde, cores, gola, cabelo e
  acessórios que não são arma nem escudo. Com traje, a armadura vestida não aparece (a defesa continua).
- Montarias: jumento, camelo, cavalo e carro, em célula de **48 × 56 px** (24 × 28 unidades), chão na linha
  53, nas 3 vistas. O cavaleiro é o boneco do jogador montado (`cfg.montado`), desenhado entre as partes de
  trás e da frente da montaria; no carro ele vai de pé. Prévia da loja: `mt_<montaria>`.
- Nenhum cosmético muda dano, defesa, vida, carga, velocidade, XP ou saque.

## 5. Criaturas e itens

- Criaturas mantêm a silhueta de cada espécie (o teste 50 exige um sprite por espécie). O quadrúpede
  genérico (cão, ovelha, lobo, chacal, javali, urso, leão, hiena, cabra, leopardo) tem coxa e canela
  finas, patas ou cascos, peito e quadril, pescoço, focinho afilado, olho com íris e brilho, orelhas com o
  dentro rosado e pelagem em traços. Aves têm rêmiges uma a uma e bico curvo; serpentes, corpo em tubo com
  o desenho do dorso.
- Itens: célula de 16 × 16 unidades (32 × 32 px), arte de até 24 × 24 px apoiada na linha 28, contorno
  sépia de 1 px e sombra de apoio suave.

## 6. Cenário (JGB-12)

- Tileset de 8 × 15 casas de 32 × 32 px por região (`gerarTileset`). O `Pincel` pinta em unidades e
  `detalharChao` acrescenta o detalhe em px de arte: folhinhas de relva de 1 × 2 px com a ponta clara,
  grãos de areia e terra, seixos de 2–3 px nos caminhos.
- Casas de terraço (teto plano, como as casas do antigo Israel e do Egito — por isso não há telhado
  inclinado nem chaminé): adobe claro, pedra de Canaã, basalto da Galileia e tijolo de barro do Egito;
  porta em arco de tábuas com cravos e verga de madeira, janela de treliça com persianas, reboco gasto,
  escada externa e, no terraço, o forno de barro (tabun) com um fio de fumaça e um vaso de planta.
- Tendas (pano cru, listras vermelhas, listras índigo, pelo de cabra), bancas com toldo listrado e poço.
- Água animada (4 fases), costa com espuma e a muralha de água do Mar Vermelho.

## 7. Paleta por região

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
| Chão | `#8f735a` `#7a6050` `#a68a6c` `#bca084` |
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

