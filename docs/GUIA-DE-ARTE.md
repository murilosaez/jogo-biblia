# Guia de arte — Jornada · RPG Bíblico

Toda a arte é pixel art **original**, gerada em código por `sprites.js` (nenhum sprite copiado de outro jogo,
nenhuma imagem externa). Este guia descreve as regras de desenho desde a versão 16 (JGB-48, JGB-27 e JGB-12),
com os personagens, as cores do visual e as montarias da JGB-49, e documenta a paleta de cada região.

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
- Os botões das janelas laterais (menu de três pontos, minimizar e restaurar) são desenhados no CSS em
  pixels inteiros (`.ic-menu`, `.ic-min` no `index.html`), sem curva nem borrão; fechar usa o glifo
  `ui_fechar`. O destino da rota aparece no minimapa como uma cruz de ouro `#ffe9a8` de 7 px com contorno
  sépia `#2a1a14` (presa na borda quando o destino está fora do recorte), e no chão como o quadrado de ouro.

## 2. Luz, contorno e acabamento

- Luz de cima e da esquerda: realce em cima/esquerda, sombra embaixo/direita, sombra projetada à direita.
- Contorno automático de **1 px de arte**: sépia `#2a1a14` (amigos, itens, cenário com volume) e carmim
  `#4a1416` (inimigos). Chão e decoração rasteira não têm contorno.
- Acabamento automático por dentro do contorno: 1 px mais claro nas bordas viradas para a luz e 1 px mais
  escuro nas viradas para baixo/direita.
- Criaturas e montarias ganham a textura fina (traços de 2 px de pelo, escama ou couro), espalhada por hash,
  nunca em "ruído de TV".
- Até 24 cores por sprite (o contorno não entra na fusão das cores raras).

## 3. Personagens (humanos) — proporção de MMORPG clássico (JGB-49)

Vale para o jogador, os NPCs e os inimigos humanos (todos saem de `humano(chave, cfg)` em `sprites.js`).
Capturas: `docs/capturas/humanos-antes-depois.jpg` e `docs/capturas/passos-3vistas.jpg`.

- Célula de **40 × 48 px** (20 × 24 unidades), pés na linha 45, contorno de 1 px por fora. O boneco é
  atarracado e lê de longe: **cabeça de 16 × 15 px** (linhas 7–21, colunas 12–27, orelhas de 1 px para fora),
  **tronco de 16 px** (linhas 22–30) com o cinto em 31–32, **braços de 4 px** de cada lado (24 px de ombro a
  ombro, ombro arredondado), pernas curtas (saia até a linha 37 e pernas de 4 px na túnica curta; veste até a
  42 no manto), **mãos de 4 × 3 px** e sandálias de 5 px (6 px de lado, com a tira e a sola). Altura total
  ~40 px: a cabeça é ~38% do corpo.
- Rosto de frente: sobrancelha de 3 px, olho de 2 × 2 (pálpebra escura em cima; embaixo o branco para fora e
  a pupila para dentro), nariz de luz e sombra, bochecha rosada de 1 px e boca de 2 px. Barba cheia do bigode
  até 2 px abaixo do queixo, com mechas e a boca aberta no meio. Cabelo curto com franja recortada e
  costeletas; `longo` cai atrás dos ombros; `careca` mostra o brilho do crânio. Véu (`molde: "veu"` ou
  `capuz`) enquadra o rosto e cai sobre os ombros (de costas, até o meio das costas).
- **4 tons por material** (`rampaDe`, ou as letras R/r/d + uma sombra funda): realce, base, sombra e sombra
  funda, com a luz de cima e da esquerda. A sombra puxa para o púrpura-sépia e a luz para o creme quente (nada
  de cinza). Pano em faixas (`tomPano`): realce nas 2 colunas da esquerda, sombra na direita; dobras
  verticais no manto, pregas na túnica curta, a veste dobra 1 px escuro sobre o cinto. Braços, pernas e mãos
  são máscaras pintadas com a rampa (`pintarMascara`: realce em cima/esquerda, sombra embaixo/direita).
- Cores por letra: H cabelo, S/s pele e sombra, B barba, R/r/d tronco (claro, médio, escuro), **P/p/q parte
  de baixo** (sem elas, a do tronco), A cinto e detalhes, F sandálias, V/W véu. Opções: `cabelo` (curto,
  longo, careca), `porte: "grande"` (+1 px de cada lado), `gola`, `capuz`, `mangaCor` (braço nu ou de outra
  cor), `barra` (barra da veste na cor do cinto), `armadura`, `acessorios`, `extraCorpo` e `extra`.
- **15 quadros**: 0–4 de lado (virado para a direita; a esquerda é o espelho), 5–9 de frente e 10–14 de
  costas. Em cada vista: 0 parado (é também a passagem do passo), 1 respirar (tronco desce 1 px), 2 contato A,
  3 contato B, 4 ação/fala. **Andando, `game.js` toca 2 → 0 → 3 → 0** (`CICLO_PASSO`, 110 ms por quadro):
  no contato as pernas abrem (de lado, um pé 5 px à frente e o outro 6 px atrás; de frente/costas, o pé de
  trás sobe 1 px e a barra balança), o tronco e a cabeça descem 1 px e os braços balançam ao contrário das
  pernas (de lado, o braço de longe aparece atrás do corpo). As criaturas continuam alternando 2 e 3.
- Âncoras da pose para acessórios: `T` topo da cabeça, `yT` ombros, `yC` cinto, `maoArma` e `maoEscudo`
  (centro da mão; a mão ocupa x−2..x+1). Acessórios desenham nas 3 vistas, em camadas (`fundo`, `meio`,
  `frente`): cajados, lanças, espadas (de frente e de costas a lâmina sai do punho para fora do corpo; de
  lado vai baixa, apontando para a frente), porrete, escudos (redondo, alto, oval), arco nas costas e na mão,
  capas, turbante, elmo, faixa, bandana, nemes, colar, peitoral, alforje com a alça cruzando o peito, odre,
  saco, jarro, fardo, corda, rede, shofar, pele de leopardo, estola, brilho de feitiço, funda (no cinto e na
  mão), remo e as peças do boneco: capacete de couro, grevas, botas e saiote.
- Equipamento visível no jogador (boneco, com uma mão para a arma): na mão da arma, espada (madeira, ferro,
  temperada), arco na mão (o arco usa as duas mãos, então nunca aparece com escudo) ou funda na mão (as duas
  cordas caem do punho até a bolsa com a pedra; no golpe, gira no alto); escudo (madeira, bronze, ferro);
  armadura (túnica de pano, armadura de couro com ombreiras, couraça de escamas com ombreiras — as ombreiras
  ficam por cima dos braços); cabeça (turbante de linho, capacete de couro com costura e aba, elmo de bronze);
  pernas (saiote de tiras de couro com ponta de bronze; grevas de bronze na canela) e pés (botas de viagem,
  de cano até o meio da canela). Grevas, botas e saiote não têm desenho próprio por quadro: recolorem a pele
  (ou a saia) só nas linhas da perna, então seguem o passo e as 3 vistas; usam poucas cores novas (2 tons de
  bronze; o couro das sandálias que o boneco já tem). Colar, anel e sandálias são pequenos demais para o
  mundo: aparecem só no painel. Com traje, as peças do corpo não aparecem (como a armadura).

## 4. Cosméticos (JGB-27) e cores do visual (JGB-49)

- **Cores do visual**: o jogador pinta 4 partes do boneco — **cabeça** (cabelo, ou o pano da cabeça do traje:
  turbante, faixa, bandana, nemes, véu; o elmo é metal e fica), **tronco** (veste de cima, R/r/d),
  **pernas** (parte de baixo, P/p/q) e **detalhe** (cinto A, gola e barra) — com a paleta fixa de 24 cores de
  `CORES_VISUAL` (`dados/cosmeticos.js`: tintas e fibras da época e tons de cabelo). Cada cor vira a rampa
  de 4 tons. No save: `p.cosmeticos.cores = { cabeca, tronco, pernas, detalhe }` com o id da cor ou `null`
  (= a cor do traje, ou a do boneco sem traje); a carga normaliza (sem cores, ou cor fora da paleta → `null`)
  e não precisou de versão nova do save. Comando: `{ tipo: "definirCores", cores: { parte: id | null } }`.
  As cores entram na chave da textura (`pj_jogador|…|c:cabeca.tronco.pernas.detalhe`) e valem por cima dos
  trajes; a túnica de pano (que é pano) toma a cor do tronco. Captura: `docs/capturas/cores-do-visual.jpg`.
- Janela Visual (tecla U), aba **Cores**: prévia do boneco de frente, de lado e de costas (3 px de tela por px
  de arte) e uma fileira de amostras por parte, com a amostra listrada "Cor do traje" e o botão "Voltar às
  cores do traje". Captura: `docs/capturas/janela-visual-cores.jpg`.
- Trajes (`TRAJES[id].visual`) usam o mesmo boneco: molde, cores, gola, cabelo e acessórios que não são
  arma nem escudo. Com traje, a armadura vestida não aparece (a defesa continua).
- **Montarias**: jumento (cinzento, focinho claro, cruz escura no lombo, orelhas compridas), camelo (uma
  corcova, pernas compridas de joelho grosso e patas largas, tapete listrado com borlas), cavalo (castanho,
  crina e cauda escuras, mancha na testa, meia branca) e carro (caixa de vime, roda de raios e o cavalo menor
  no varal), em célula de **56 × 64 px** (28 × 32 unidades), chão na linha 61, nas 3 vistas e com passo
  (pernas em pares diagonais, corpo desce 1 px). Manta com franja de ouro, sela de couro com o loro do
  estribo, cabeçada e rédeas com folga até as mãos do cavaleiro. De frente, a cabeça comprida (orelhas,
  olhos dos lados, narinas, frontal colorido) e as patas da frente ficam por cima do cavaleiro; de costas, a
  garupa, a cauda e as patas de trás. O cavaleiro é o boneco do jogador montado (`cfg.montado`): de lado a
  coxa vai para a frente e a canela desce; de frente e de costas as pernas abrem para os lados; as mãos
  seguram as rédeas (o escudo fica pendurado do lado). No carro ele vai de pé. Prévia da loja:
  `mt_<montaria>`. Captura: `docs/capturas/montarias-antes-depois.jpg`.
- Nenhum cosmético (nem as cores) muda dano, defesa, vida, carga, velocidade, XP ou saque.

## 5. Criaturas e itens

- Criaturas mantêm a silhueta de cada espécie (o teste 50 exige um sprite por espécie). O quadrúpede
  genérico (cão, ovelha, lobo, chacal, javali, urso, leão, hiena, cabra, leopardo) tem coxa e canela
  finas, patas ou cascos, peito e quadril, pescoço, focinho afilado, olho com íris e brilho, orelhas com o
  dentro rosado e pelagem em traços. Aves têm rêmiges uma a uma e bico curvo; serpentes, corpo em tubo com
  o desenho do dorso.
- Itens: célula de 16 × 16 unidades (32 × 32 px), arte de até 24 × 24 px apoiada na linha 28, contorno
  sépia de 1 px e sombra de apoio suave. Peças do boneco: turbante (voltas do pano em diagonal e a ponta
  caindo), capacete de couro (calota com costura, aba e orelheiras), elmo de bronze (testeira, abas do rosto
  e nasal), colar de contas de cornalina (a conta maior no meio), saiote (cinto com fivela e tiras com ponta
  de bronze), grevas (placa da canela, larga no joelho, com 2 correias), sandálias, botas de viagem (de
  perfil, cano dobrado e atilhos), anel de selo (chapa oval com a marca) e a mochila do boneco (aba, fivela
  e alças), com luz de cima e da esquerda e 3 a 4 tons por material.
- Painel Equipamento (boneco): o espaço vazio mostra o contorno do item que vai nele (`silhueta` em
  ESPACOS_BONECO, dados/itens.js), apagado; a mão do escudo presa pelo arco mostra o arco apagado sobre um
  fundo riscado. A figura ao lado é o corpo inteiro do jogador em escala 4 (2 px por pixel de arte).
- Item que o jogador jogou fora (`game.js` desenharPilha): fica parado no chão (só o saque novo flutua) e, em
  pilha, o mesmo desenho do item se repete atrás dele, deslocado em pixels inteiros (−5, +2) a partir de 2
  unidades e (+5, +3) a partir de 5, como um montinho; sem número escrito no mundo (a quantidade aparece no
  menu do item e na mensagem).

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

### 6.1 Casas e lojas onde se entra, chão contínuo e muros (`cenario.js`)

- **Prédios** (`DADOS_ESTRUTURAS` com `entrar: true`): a casa (6 × 5 casas) e a loja (7 × 6) são feitas de
  cinco imagens por prédio. Por fora: o terraço (placas de barro batido, parapeito de 7 px com a face de
  dentro mais escura, forno de barro, jarros, esteira de figos e a escada encostada) e a fachada (32 px) com
  pontas das vigas, janelas de treliça com luz quente, porta aberta em arco e, na loja, o toldo listrado e a
  placa com a balança. Por dentro: a parede do fundo alta (reboco claro; prateleiras com jarros, tecidos e
  frutas na loja; nicho com a candeia e réstia de ervas na casa), as paredes dos lados e da frente cortadas
  e finas (12 px, como numa planta) e o piso: tábuas na loja, lajotas (pedra e basalto), barro batido
  (adobe e tijolo) ou areia com tapete (tenda grande). Móveis: balcão (emenda com os vizinhos, com
  mercadoria em cima), barris, caixotes, sacos, esteira de dormir, jarros e mesa baixa.
- O telhado some quando o jogador passa pela porta e volta quando ele sai; com o jogador logo atrás do
  prédio, fica translúcido. Materiais (`MATERIAIS_PREDIO`, a variante do prédio): 0 adobe, 1 pedra de Canaã,
  2 basalto da Galileia, 3 tijolo do Egito, 4 tenda grande (lona listrada em duas águas).
- **Chão contínuo**: o chão é pintado por pedaços de 16 × 16 casas a partir das coordenadas do mundo (nada
  de azulejo repetido). Relva e areia variam em duas escalas de ruído com pontilhado ordenado (Bayer 4 × 4);
  a estrada de terra tem a beira irregular (amostra deslocada por ruído, ±9 px) com um fio escuro e tufos;
  dentro das vilas o caminho é rua de pedra (fiadas de 8 px, junta escura, luz em cima/esquerda); em volta
  das portas, poços, tendas e moradores o chão fica pisado; a beira da água é areia molhada.
- **Portas**: a folha da porta é uma imagem à parte (`texturaPorta`): fechada (tábuas com ferragens e argola;
  na tenda, a aba de pano baixada) e aberta (encostada à esquerda). Abre sozinha com o jogador a uma casa dela.
- **Orla**: a borda do mapa e as 4 casas de fora viram mata, palmeiral ou pedregal do bioma (`ORLAS`), com o
  chão da região por baixo e as peças mais escuras para fora, no lugar da faixa chapada. Água e muralha da
  borda continuam no Tilemap. Árvores e pedras de todo o mapa saem da grade (deslocamento e espelho por casa).
- **Dia e noite** (`CICLO_DIA` em `game.js`): um dia dura 40 min de relógio; a noite escurece até 70% em azul
  profundo, com buracos de luz suaves no jogador, nas fogueiras, nas candeias das portas, nos interiores
  (com o telhado aberto) e nos portais, e um brilho quente por cima. Nomes, barras e números ficam acima da
  noite. Só aparência.
- **Muros contínuos**: o muro da vila e as muretas de pedra (`muro`, `tijolos`) emendam com os vizinhos
  (máscara N/L/S/O): topo de pedras de cobertura e face de 20 px onde o muro não continua para o sul.

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

