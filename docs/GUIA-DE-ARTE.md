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
  armadura (`ARMADURAS`); a chave da textura é `pj_jogador|arma||escudo|armadura|traje|montaria[|e:cabeça.pernas.pés][|c:…]` (o arco e a funda vão em `arma`).
- Equipamento visível no jogador (boneco, com uma mão para a arma): na mão da arma, espada (madeira, ferro,
  temperada), arco na mão (o arco usa as duas mãos, então nunca aparece com escudo) ou funda na mão (as duas
  cordas caem do punho até a bolsa com a pedra; no golpe, gira no alto); escudo (madeira, bronze, ferro);
  armadura (túnica de pano, armadura de couro com ombreiras, couraça de escamas com ombreiras — as ombreiras
  ficam por cima dos braços); cabeça (turbante de linho, capacete de couro com costura e aba, elmo de bronze);
  pernas (saiote de tiras de couro com ponta de bronze; grevas de bronze na canela) e pés (botas de viagem,
  de cano até o meio da canela). Grevas, botas e saiote seguem o passo e as 3 vistas e usam poucas cores novas (2 tons de
  bronze; o couro das sandálias que o boneco já tem). Colar, anel e sandálias são pequenos demais para o
  mundo: aparecem só no painel. Com traje, as peças do corpo não aparecem (como a armadura).
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
- Peças do boneco (ícones dos itens): turbante (voltas do pano em diagonal e a ponta
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

## 6. Cenário

- **Chão contínuo** (`cenario.js`): pintado por pedaços de 16 × 16 casas (512 × 512 px) a partir das
  coordenadas do mundo, sem azulejo repetido — relva e areia em duas escalas de ruído, estrada de terra de
  beira irregular, rua de pedra nas vilas, chão pisado em volta de portas e poços; a beira da água tem raso,
  espuma, areia molhada e areia seca. Paleta curta e beiras nítidas: ver 6.1. A pintura é **fatiada** (`Cenario.pintarFatia`, 4 ms por quadro) e os pedaços longe da câmera são
  liberados; na troca de área as texturas de chão e de prédio da área anterior saem da memória.
- **Tileset** (`Arte.gerarTileset`, pintores de `arte/terreno.js`): 8 × 15 casas por região para água animada
  (4 fases, em px de arte, reenviada a cada 250 ms), costa, borda e moldura.
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

### 6.1 Mundo no estilo de MMORPG clássico em 2D (revisão da arte do mundo)

Direção: pixel art de MMORPG clássico visto de cima, mundo em casas, paleta curta e rica, bordas nítidas, sem
anti-serrilhado nem 3D, ambiente do antigo Oriente Próximo. Tudo é original e gerado em código: segue só as
convenções do gênero (escala das árvores, contorno escuro, luz de cima e da esquerda), sem copiar sprites,
ícones, layouts ou paletas de jogo nenhum. Capturas: `docs/capturas/arte-antes-depois.jpg` (antes e depois em
cada região) e `docs/capturas/arte-regioes.jpg` (as 6 regiões, de dia e de noite).

Flora, rochas e terreno têm dois conjuntos de desenho no código: o de `arte/flora.js` e `arte/terreno.js`
(seções 2 e 10) e o desta revisão, em `sprites.js` e `cenario.js`. Os dois seguem a mesma escala (1 px de arte
por px de mundo) e a mesma luz (de cima e da esquerda); os props das vilas e a vegetação rasteira em moitas
existem só nesta revisão.

O que aparece no jogo, por elemento: árvores, arbustos, rochas, estruturas (`es_`) e decorações (`dc_`) usam o
desenho de `arte/flora.js`; o tileset é o de `arte/terreno.js` e o chão é o fatiado de `cenario.js`, com as
moitas desta revisão por cima (nas áreas com `vegetacao`, a decoração rasteira do tileset fica desligada). Os
props das vilas (barril, caixotes, carroça, jarros, lenha, cocho e cerca) são os desta revisão, registrados no
fim de `arte/flora.js`, sem espelho e sem deslocamento. O segundo desenho continua no código:
`Arte.MUNDO_DA_MAIN` (um `Set` em `sprites.js`, vazio por padrão) lista as chaves `ob_`/`es_`/`dc_` que devem
usar o desenho guardado em `Arte.motor.mundoAlternativo`, e `Cenario.usarChao("main" | "fatiado")` troca o
chão inteiro em execução.

- **Escala de pixel**: 1 px de arte = 1 px de mundo em tudo o que fica no chão e em pé (árvores, pedras, props,
  decorações do chão, poço, tendas, bancas, a mureta solta, água, a muralha de água do Mar Vermelho e o chão;
  o teste 78 mede as decorações, o ponto de pesca, o poço, a tenda e a banca). Ficam de fora, de propósito, os
  sinais e efeitos (setas do portal `mk_setas`, anel de alvo, faíscas e golpes `fx_*`), em traço de 2 px para
  ler de longe, e o `es_casa`, que não aparece no mundo (as casas onde se entra vêm de `cenario.js`). A câmera segue um alvo em px inteiros e, a cada quadro, quem anda (personagens, barras, nomes,
  números) vai para px inteiros (`pixelsInteiros` em `game.js`): nada fica a meio pixel de arte do chão, em
  qualquer zoom. Os ícones da interface usam `image-rendering: pixelated`.
- **Árvores em escala de MMORPG** (`arvore`, `Copa`, `moldeCopa` em `sprites.js`): a árvore é maior que a casa —
  a copa (56–68 px) transborda para cima e um pouco para os lados, o tronco fica na casa que bloqueia (a colisão
  não muda). A copa é feita de cachos de folhas (bolhas recortadas em lobos) sombreados um a um em 5 tons, com
  a borda escura onde um cacho cai sobre outro, folhas em grupos de 2 px, contorno verde-escuro e a sombra no
  chão para a direita. 3 variantes por espécie (com espelho e deslocamento por casa): oliveira (dois troncos
  que se enroscam, copa prateada com azeitonas), acácia (copa chata em guarda-chuva; no Sinai, rala), tamareira
  (tronco em escamas, folhas que caem com o peso, tâmaras) e figueira (copa larga e fechada, figos).
- **Arbustos** (`arbustoOb`, `retamaOb`): de uma casa, em cachos com os mesmos 5 tons das árvores; o do Sinai é
  seco, com os galhos à mostra; a retama do deserto é uma moita de varas finas com as pontas claras e flores
  amarelas. **Coral** do Mar Vermelho (`coralOb`): galhos grossos que se bifurcam (3, 2 e 1 px) sobre uma laje.
- **Rochas facetadas** (`rochaArte`, `pedregulho`): contorno de polígono irregular (7 a 10 lados) com a base reta
  no chão; cada lado é uma face que sobe até o pico (um pouco à esquerda e acima do meio). A luz de cada face
  mistura a direção dela com o volume da pedra e cai em 4 tons; o plano de cima fica sempre na luz, as cristas
  viradas para a luz ganham 1 px de realce e as dobras, 1 px escuro; contorno e sombra para a direita.
  Material por região: calcário com musgo (Canaã), arenito em estratos (deserto), granito com pintas (Mar
  Vermelho e Sinai), basalto em colunas (Galileia) e o rochedo do mar com a espuma em volta.
- **Chão** (`pintarPedacoChao` em `cenario.js`, pedaços de 16 × 16 casas): paleta curta por região — o chão
  quase todo no tom de base, manchas grandes de 1 tom acima e (as manchas do bioma) 1 tom abaixo, de beira
  nítida, sem pontilhado. Por cima, os motivos em grupos limpos de 2–3 px (folhinhas de relva com a ponta clara
  e o pé escuro, grãos de areia), juntos em touceiras (um ruído largo decide onde ficam densos) e com chão calmo
  entre elas. Estrada de terra: tom de base com manchas menores clara e escura, a fileira de fora escura com
  pontas de relva por cima e a segunda 1 tom abaixo. Seixos claros e raros na relva. Custo: 25–45 ms por pedaço
  de 512 × 512 px no navegador (antes 90–150 ms), com no máximo 2 pedaços novos por quadro.
- **Beira da água** (a função `beira`): a linha da água fica sempre dentro da casa de água (a "terra" é
  interpolada entre os centros das casas e a linha passa em 0,3 ± ruído), então a margem nunca é o degrau reto
  entre duas casas. Da água para a terra: o raso (2 faixas por cima da água animada), a espuma em px soltos, a
  fileira escura da areia molhada (a beira definida), a areia molhada, a areia seca (seixos de basalto na
  Galileia) e 1 px de relva escura onde a relva começa. No canto de uma casa de água cercada de terra, o chão
  continua.
- **Água** (`pintarAgua`, tileset animado em 4 fases): base, 5 ondulações de 1 px por casa (vale escuro de 4 a
  7 px e a crista clara 1 px acima) que derivam 1 px a cada 2 fases, e um brilho de 2 px de vez em quando.
- **Vegetação rasteira em moitas** (não bloqueia; `PECAS`, `PECAS_MOITA`, `pintarMoitas` em `cenario.js`): pintada
  no próprio pedaço do chão, em moitas de 2 a 6 peças, como num mapa feito à mão — tufo de capim (5 a 8 folhas
  de 4 a 10 px, pé escuro e ponta clara), flor (haste, folhas e corola em cruz ou cheia, com o miolo; as cores
  das flores vêm de `BIOMAS[area].deco`), arbusto baixo (14 a 20 px, 4 tons, contorno e sombra), pedra (topo
  claro, aresta, face escura, contorno e sombra; com líquen no Sinai), seixos, conchas, cacos de cerâmica e
  brotos do plantio. Na beira da água: juncos com taboas (Canaã, deserto, Galileia), papiro com a umbela em
  leque (Nilo) e algas (Mar Vermelho). Os tipos, os pesos e a densidade de cada região ficam em
  `DADOS_MAPAS[area].vegetacao` (`dados/mapas.js`). As moitas ficam longe das ruas e estradas (9 px, contados da
  caixa inteira da peça, com contorno e sombra: `CAIXA_PECA`), da água, do chão pisado, dos personagens, portais, cais, decorações e pontos de extração; o sorteio é pela posição do
  mundo e a peça que passa da borda do pedaço é terminada pelo vizinho (sem emenda). Onde o chão contínuo pinta
  a vegetação, a decoração antiga em azulejos (`indiceDeco`) não aparece.
- **Props das vilas** (`PROPS_VILA`, `DESENHO_PROP` em `sprites.js`): barril de aduelas com aros, caixotes de
  tábuas com a trave em X, carroça de duas rodas (com sacos ou feno), jarros de barro, lenha empilhada (toras de
  ponta com os anéis), cocho com água e cerca (postes a cada 16 px e travessas de ponta a ponta: emenda com a
  vizinha; a última da fileira, sem cerca à direita, usa o quadro de fecho com o poste na ponta). Um desenho por região, `ob_<área>_<tipo>`, com a madeira, o barro e a pedra de lá
  (`MATERIAL_PROPS`). São marcos de `dados/mapas.js` (bloqueiam a casa, ficam no lugar, sem deslocamento
  sorteado); o teste 76 confere que ficam dentro das vilas, fora das ruas, da frente das portas e da clareira
  dos personagens, e que não fecham casa nenhuma.
- **Cenas leves**: a arte dos obstáculos e dos props é gerada só para a área atual (`garantirTextura`), e as
  imagens do cenário entram em blocos de 16 × 16 casas que ligam e desligam com a câmera (`noBloco`).

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

- **Largo e médio** (a partir de 761 px de largura): o mundo fica no meio, com as **janelas laterais** nas
  colunas dos lados (Missão, Personagem, Equipamento, Batalha, Mochila, Bolsa, Caçada e Mapa) e o **dock de
  baixo** de uma ponta à outra (console com as abas Geral, NPCs e Servidor; atalhos e barra de habilidades à
  direita). Cada janela tem o cabeçalho como alça: arrasta para a outra coluna ou posição, minimiza e fecha; o
  menu Janelas reabre, escolhe o lugar da conversa e restaura o layout, que fica em `localStorage`
  (`jornada_janelas`). Uma coluna sem janelas sai e o mundo fica mais largo; nada flutua sobre o mundo. O
  zoom do mundo é inteiro, e a altura do dock é escolhida para não derrubá-lo. Os padrões por tamanho de tela
  estão no LEIA-ME.txt ("Janelas laterais" e "Console").
- **Celular** (até 760 px): palco em tela cheia, caixa de vida, botões de toque e abas inferiores.
- Skin própria: couro, pergaminho e bronze.
- Os botões das janelas laterais (menu de três pontos, minimizar e restaurar) são desenhados no CSS em
  pixels inteiros (`.ic-menu`, `.ic-min` no `index.html`), sem curva nem borrão; fechar usa o glifo
  `ui_fechar`. O destino da rota aparece no minimapa como uma cruz de ouro `#ffe9a8` de 7 px com contorno
  sépia `#2a1a14` (presa na borda quando o destino está fora do recorte), e no chão como o quadrado de ouro.
  O minimapa tem 3 níveis de zoom: os botões + e − e o de centralizar ficam ao lado dele, com a rosa dos
  ventos, e a roda do mouse sobre o minimapa também troca o nível; o clique que traça a rota vale em qualquer nível.
- A pega da alça do dock de baixo é uma fileira de pontos de 2 px em bronze (ouro com o ponteiro ou o foco)
  numa plaquinha de couro de 30 × 6 px; as caixas e os rádios dos menus de janela são quadrados (o rádio tem o
  miolo de 6 px, a caixa de 8 px), e as teclas dos menus usam a mesma capa de tecla das outras janelas.

## 9. Paleta por região

Cada região usa só as cores abaixo no chão, nas manchas, nos caminhos, na borda e na decoração (os
obstáculos e estruturas derivam delas). Fonte: `BIOMAS` em `sprites.js`. As peças da vegetação rasteira
(capim, arbusto, pedra, junco) têm 3 a 5 tons por região em `TONS_MOITA` (`cenario.js`) e os props, a madeira,
o barro e a pedra de cada região em `MATERIAL_PROPS` (`sprites.js`).

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
