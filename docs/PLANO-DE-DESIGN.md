# Jornada · Plano de design (rumo a MMORPG de mundo aberto)

## Pilares
1. **Evoluir sempre** — toda sessão de 10 min deixa o jogador visivelmente mais forte/rico/perto de uma meta.
2. **Viver a história** — o jogador é um peregrino atravessando a narrativa bíblica; a história é o mapa.
3. **Força e virtude** — além de poder, o personagem cresce em caráter (Frutos do Espírito).
4. **Juntos é melhor** — solo viável, grupo mais recompensador.

Dopamina **ética**: sem loot box paga, sem pay-to-win, sem punir quem não joga todo dia.

## Ciclos de recompensa
| Escala | Ciclo | Recompensa |
|---|---|---|
| Segundos | atacar → dano/crítico → morte → saque | números, brilho do saque, chance de raro |
| Minutos | caçar → nível/habilidade → equipamento | barra de XP, "SUBIU DE NÍVEL!" |
| Horas | missão → capítulo → região nova | chefe, título, recompensa grande |
| Dias | diárias, semanais, temporadas, guilda | sequência, ranking, cosméticos |

Metas: 1º nível < 2 min; recompensa a cada 30–60 s; item/habilidade nova a cada ~15 min no início; drops raros (1%, 0,1%) anunciados; progresso "quase lá" sempre visível.

## Progressão
- Nível 1→200 (curva suave até 30 ≈ 15 h).
- **Vocações** (nível 8; especialização no 50): Guerreiro/Valente de Davi (tanque), Fundibulário/Benjamita (funda e arco), Levita (cura), Profeta (controle/magia), Pastor (invocador com cão e ovelhas). Feito (JGB-20): `dados/vocacoes.js` com 7 habilidades por vocação (recarga, combinações com os status do JGB-16) e 2 especializações com a 8ª habilidade; barra nas teclas 1–8 (itens em Shift + 1–6); troca com Jetro em Canaã (1ª grátis); cão e ovelhas do Pastor como aliados no mapa; simulação por vocação (teste 63e).
- **Árvore de talentos** (3 ramos por vocação). Feito (JGB-21): `TALENTOS` em `dados/vocacoes.js`, 1 ponto por nível desde o 8, 4 fileiras por ramo (0/3/6/10 pontos), requisitos, um ápice por personagem, efeitos por grau (passivos, recarga, dano/cura de uma habilidade), reset pago (50 + 5 por ponto) e aba Talentos na janela Vocação; testes 64 a 64d.
- **Frutos do Espírito**: 9 medidores de virtude que sobem por comportamento (curar outros → amor; ajudar novatos → bondade; caçar sem morrer → paciência; não acumular maná → domínio próprio). Dão passivos e títulos; todos no máximo desbloqueiam fim de jogo.
- **Armadura de Deus (Efésios 6)**: conjunto lendário de 6 peças, cada uma de uma masmorra/raid, bônus em 2/4/6 peças.

## Mundo (ordem bíblica)
| Ato | Regiões | Níveis |
|---|---|---|
| I Patriarcas | Ur (tutorial), Canaã, Berseba | 1–15 |
| II Êxodo | Egito, Mar Vermelho, Deserto, Sinai | 15–40 |
| III Conquista | Jericó, Vale de Elá, Filístia | 40–70 |
| IV Reino | **Jerusalém (capital)**, Tiro, Líbano | 70–100 |
| V Exílio | Nínive, Babilônia, Susã | 100–140 |
| VI Evangelhos | Galileia, Mar da Galileia, Judeia | 140–170 |
| VII Atos | Mediterrâneo, Malta, Éfeso, Roma | 170–200 |

Exploração: XP de descoberta, pergaminhos (versículos) colecionáveis, atalhos, clima (sede no deserto, tempestade no mar), viagem rápida só após visitar.

## Criaturas (meta ~120)
Cada inimigo: família, tier (normal/elite/campeão/raro/chefe), comportamento, tabela de saque.
- Canaã: lobo, chacal, urso, javali, leão (elite). Deserto: escorpião, víbora, hiena, abutre, enxame de gafanhotos.
- Egito: crocodilo, naja, guardas, feiticeiro da corte. Mar: tubarão, polvo, piratas, **Leviatã** (chefe de mundo).
- Sinai: cabra, águia, amalequitas. Vale de Elá: filisteus, **Golias** (ideal vencer com funda). Babilônia: leões, caldeus.
- IA: matilha que cerca, fuga e retorno com reforço, arqueiro que mantém distância, curandeiro inimigo, investida telegrafada, fúria < 30%, status (veneno, sangramento, atordoar, medo). Feito (JGB-7 e JGB-8): cada comportamento tem simulação própria (teste 55). Status unificados com o medo (JGB-16): um motor para jogador e criaturas, com acúmulo (renova, pilhas), imunidade e combinações (atordoado → crítico, medo → +25%, veneno + sangramento → +50% nos tiques); testes 62, 62b e 62c.
- **Campeão** (5%, nome dourado, modificadores), **raro nomeado** anunciado no chat, **chefe de mundo** com horário.

## Caçadas
- Áreas catalogadas por região com faixa de nível, densidade e XP/h e saque/h estimados.
- **Analisador de caçada** (XP/h, saque/h, lucro, tempo até o próximo nível). Feito (JGB-10).
- **Mural de tarefas de caça** ("mate 150 escorpiões") → pontos trocáveis por itens/montarias.
- **Bestiário** em 3 estágios (10/100/1000 abates) → revela fraquezas e dá amuletos (+5% contra a família). Feito (JGB-9).
- Bônus de grupo (+10% por membro, mais com vocações diferentes); no MMO, instâncias ou crédito por dano.
- **XP de descanso (Sábado)**: offline acumula XP em dobro. Feito (JGB-11).

## Missões
História principal; cadeias secundárias; 3 diárias + 3 semanais; **maná diário** (estraga se acumulado, Êx 16); escolta de caravana; **Muralhas de Neemias** (defesa em ondas); **Arca de Noé** (coletar pares); **Jericó** (7 voltas no ritmo); escolhas morais (alimentam Frutos); eventos sazonais (Páscoa, Pentecostes, Tabernáculos, Natal).

## Masmorras e raids
Ventre do grande peixe (solo), Templo de Dagom (grupo, enigma de pilares), Cova dos leões (sobrevivência), Fornalha ardente (desvio), Pirâmides (labirinto que muda), **Torre de Babel** (andares infinitos + ranking semanal), raids de 10: exército de Senaqueribe, Leviatã.

## Combate e estratégia
6–8 habilidades por vocação com recarga e combinações; ameaça (tanque/dano/cura); posicionamento (costas +dano, terreno alto +alcance, água lenta); consumíveis táticos (comida 30 min, óleo na arma, incenso); PvP só opcional e não letal (arenas, torneios, duelos).

## Itens e economia
Raridades (comum, incomum, raro, épico, relíquia) com cor/brilho/som; atributos aleatórios; **12 pedras do peitoral** (Êx 28) para engastar; forja +1 a +10 (falha consome material, nunca destrói o item); ofícios (ferreiro, carpinteiro, pescador, oleiro, tecelão, perfumista); bazar de Jerusalém com taxa; drenos de moeda (reparo, taxas, forja, casas); montarias (jumento, camelo, cavalo, carro).

## Social
**12 tribos** como facções (nível 20, competição cooperativa semanal); guildas com banco e salão; **mentoria** veterano→novato com recompensa mútua; grupo, chat, amigos; moradia com troféus.

## Metas de longo prazo
Conquistas e títulos, coleções, rankings, passe de temporada (trilha gratuita completa; paga só cosmética), **Jubileu** a cada 50 dias.

## Roteiro técnico
| Fase | Entrega |
|---|---|
| v0.2 Solo rico | conteúdo em JSON (monstros, itens, missões), mapas no Tiled, 30+ criaturas, raridades, tarefas de caça, bestiário, maná diário |
| v0.3 Vocações | 5 vocações, barra de habilidades, talentos, 2 masmorras, ofícios básicos |
| v0.4 Nuvem | login, save no servidor, ranking (Supabase/Postgres) |
| v0.5 Multiplayer alfa | servidor autoritativo (Node + WebSocket, ex. Colyseus) rodando a lógica do `Mundo`; ver outros jogadores, chat, grupo |
| v0.6 Social | guildas, mercado, tribos, eventos de mundo |
| v1.0 | Atos I–IV, Torre de Babel, raids, temporada 1 |

Base: servidor decide tudo (o cliente já só envia comandos via `Mundo.executar`); cada jogador recebe só o que está perto; telemetria (XP/h, mortes por região, abandono); `tests/logica.test.js` valida cada região nova.

## Métricas
Retenção D1 40% / D7 20% / D30 8%; sessão 25–40 min; 1º nível < 2 min; 1º raro na 1ª hora; funil por capítulo.

## Backlog v0.2 (ordem sugerida)
1. ~~Extrair `ITENS`, inimigos, NPCs e missões para arquivos de dados~~ — feito (JGB-1): `dados/*.js`. Missões de Eliabe, Noemi e dos capítulos movidas para `dados/missoes.js`, com motor de missões genérico em `logica.js` — feito (JGB-42).
2. ~~Raridades + atributos aleatórios + brilho/cor do saque no chão~~ — feito (JGB-4): comum, incomum, raro, épico e relíquia em `dados/itens.js` (cor, brilho, som, melhoria e atributos de dano, defesa, crítico, vida e carga); o item com raridade é um texto que se descreve sozinho no save.
3. ~~Tabela de saque por inimigo com chances (comum/raro/muito raro) e anúncio de raro~~ — feito (JGB-5): tabela por criatura em `dados/criaturas.js` com drops de 1% e 0,1% (pedras do peitoral), som, pilar de luz e anúncio no Registro; teste de simulação da frequência.
4. ~~Campeões (5%, modificadores) e mais 2–3 criaturas por região existente com comportamentos novos (matilha, fuga, à distância)~~ — feito (JGB-6 e JGB-7): 24 criaturas novas (31 espécies) com tier, comportamento (matilha, fuga, à distância, investida, fúria), status (veneno, sangramento, atordoamento), tabela de saque e sprite próprio; campeões a 5% com modificadores no nome; um raro nomeado por região com janela de aparição e anúncio; simulação de balanceamento por criatura.
5. ~~Mural de tarefas de caça + pontos de tarefa~~ — feito (JGB-3): um atalaia por região com rondas (20 h) e grandes caçadas (164 h), alvo por criatura, espécie ou família (`dados/tarefas.js`), entrega em qualquer atalaia e troca de pontos por alforjes, escudo de ferro e couraça; save v8.
6. ~~Bestiário com estágios e amuletos~~ — feito (JGB-9): 3 estágios por espécie (10/100/1000 abates: ficha; fraquezas e saque; chances), fraquezas vindas dos comportamentos e status (`REGRAS_BESTIARIO` em `dados/criaturas.js`), amuleto por família (+5% de dano com todas as espécies no estágio 2, sem os raros nomeados); tecla B; save v10.
7. ~~Analisador de caçada (painel XP/h, saque/h)~~ — feito (JGB-10): painel Caçada com XP, saque, lucro (menos poções, flechas e perdas na morte), abates e mortes por sessão e por hora e tempo até o próximo nível; relógio a partir do 1º golpe, zerável; tecla X.
8. ~~Maná diário e XP de descanso~~ — feito (JGB-11): maná em `REGRAS_MANA` (`dados/mundo.js`) — colheita 1×/dia do amanhecer ao amanhecer, 3 porções, 6 na sexta, nada no sábado; cada porção cura 50% da vida e 30 de fé; o guardado estraga no amanhecer seguinte (o da sexta dura o Sábado). Descanso em `REGRAS_DESCANSO`: a ausência de sexta 18 h a sábado 18 h vira reserva de XP (1 nível por Sábado, limite 1,5), gasta dobrando o XP dos abates; tecla N; save v11. Relógio do navegador com travas contra relógio mexido até o servidor (v0.5).
9. Estender a simulação de balanceamento para cada novidade.

## Decisões do dono do jogo (registradas)
1. **Público-alvo:** jovens e adultos cristãos → dificuldade média/alta, PvP opcional permitido, chat aberto com moderação e filtro.
2. **Plataforma principal:** navegador no PC → teclado e mouse são prioridade; o toque fica como secundário.
3. **Escala do multiplayer:** dezenas de jogadores no início → um único servidor Node + WebSocket, sem sharding; instâncias só para masmorras.
4. **Monetização:** começar com cosméticos e compra única; **RMT (comércio com dinheiro real) no futuro**. Antes de liberar RMT, desenhar a economia para não virar pay-to-win: itens de poder só obtidos jogando, RMT restrito a cosméticos/moeda premium trocável, e proteção contra bots e farm.
5. **Revisor teológico:** dispensado — os textos não levam marcação de revisão pendente.
