// =====================================================================
// dados/mapas.js — desenho dos mapas de cada região
// Dados puros (sem regras). Carregado antes de logica.js pelo index.html.
// O gerador (gerarMapa, em logica.js) lê este arquivo e monta a grade de colisão (mapas), o piso
// (chão, caminho, água, estrutura) e os obstáculos de tipo fixo. Nenhuma coordenada fica no código.
// =====================================================================

// Tamanho de todos os mapas, em casas (a casa 0 e a última de cada lado são a borda).
const DADOS_TAMANHO_MAPA = { colunas: 160, linhas: 120 };

// Estruturas de várias casas. largura × altura: pegada em casas (bloqueia a passagem); x, y no mapa
// são o canto de cima à esquerda da pegada. O desenho vem de sprites.js (es_<tipo>); variante escolhe
// o quadro (cores e materiais).
//   casa:  0 adobe claro · 1 pedra de Canaã · 2 basalto da Galileia · 3 tijolo de barro do Egito
//   tenda: 0 pano cru · 1 listras vermelhas · 2 listras índigo · 3 pelo de cabra escuro
//   banca: 0 com mercadorias · 1 vazia (espaço reservado para uma loja futura)
//   poco:  0 pedra
const DADOS_ESTRUTURAS = {
  casa: { nome: "Casa", largura: 3, altura: 2 },
  tenda: { nome: "Tenda", largura: 3, altura: 2 },
  banca: { nome: "Banca", largura: 3, altura: 2 },
  poco: { nome: "Poço", largura: 1, altura: 1 },
};

// Desenho de cada região:
// terreno: obstáculos espalhados no resto do mapa. Ruído de baixa frequência (escala em casas) forma
//   bosques e pedregais onde passa do limiar; ali cada casa vira obstáculo com a chance densidade.
//   salpico: chance de um obstáculo solto em qualquer casa. semente: muda o desenho do ruído.
// regioes: retângulos ou elipses (forma "elipse": x, y = centro, raioX, raioY) desenhados em ordem.
//   densidade: chance de obstáculo em cada casa (0 abre uma clareira); tipo: o obstáculo que nasce ali
//   (oliveira, rocha... conforme o bioma, em sprites.js); sem tipo, o bioma sorteia.
// aguas: lagos, rios e poças (bloqueiam a passagem), retângulos ou elipses.
// vilas: área aberta com o nome da vila; muro: tipo do obstáculo que cerca a vila (os caminhos abrem
//   os portões). A decoração do chão fica mais densa dentro da vila.
// caminhos: estradas e ruas. pontos: [x, y] em sequência (cada trecho anda primeiro na horizontal, depois
//   na vertical); largura em casas. O caminho abre a passagem e é desenhado como estrada.
// estruturas: casas, tendas, bancas e poços (DADOS_ESTRUTURAS). npc: quem atende ali (a tenda ou banca
//   fica logo atrás dele); reservada: loja futura prevista para a banca vazia.
// marcos: obstáculos de uma casa com tipo fixo (fogueira, estandarte, barco, jarros...).
// decoracoes: enfeites planos no chão (dc_tapete, dc_esteira, dc_rede, dc_fogo_apagado).
// zonasColeta: onde ervas (Canaã) e odres (Deserto) brotam de novo depois de coletados (x, y, raio).
const DADOS_MAPAS = {
  canaan: {
    terreno: { escala: 7, limiar: 0.6, densidade: 0.45, salpico: 0.012, semente: 11 },
    regioes: [
      { x: 92, y: 10, largura: 60, altura: 38, densidade: 0.32, tipo: "oliveira" },
      { x: 98, y: 76, largura: 54, altura: 30, densidade: 0.26, tipo: "rocha" },
      { forma: "elipse", x: 70, y: 52, raioX: 22, raioY: 18, densidade: 0.025 },
      { x: 44, y: 8, largura: 24, altura: 18, densidade: 0.03 },
      { x: 30, y: 74, largura: 30, altura: 24, densidade: 0.04 },
    ],
    aguas: [{ forma: "elipse", x: 124, y: 62, raioX: 8, raioY: 5 }],
    vilas: [{ id: "vila_canaa", nome: "Vila de Canaã", x: 9, y: 7, largura: 33, altura: 27, muro: "muro" }],
    caminhos: [
      { largura: 2, pontos: [[3, 3], [156, 3]] },
      { largura: 2, pontos: [[3, 3], [3, 112]] },
      { largura: 2, pontos: [[3, 112], [157, 112]] },
      { largura: 2, pontos: [[3, 20], [88, 20], [88, 112]] },
      { largura: 2, pontos: [[25, 3], [25, 112]] },
      { largura: 1, pontos: [[88, 40], [140, 40], [140, 112]] },
      { largura: 1, pontos: [[120, 3], [120, 40]] },
    ],
    estruturas: [
      { tipo: "casa", x: 12, y: 9, variante: 1 },
      { tipo: "casa", x: 17, y: 9, variante: 1 },
      { tipo: "casa", x: 30, y: 9, variante: 1 },
      { tipo: "casa", x: 35, y: 9, variante: 1 },
      { tipo: "tenda", x: 12, y: 15, variante: 1, npc: "guia_canaa" },
      { tipo: "banca", x: 17, y: 15, variante: 1, reservada: "ferreiro" },
      { tipo: "banca", x: 29, y: 15, variante: 1, reservada: "curandeiro" },
      { tipo: "tenda", x: 34, y: 15, variante: 2, npc: "atalaia_canaa" },
      { tipo: "poco", x: 21, y: 24 },
      { tipo: "casa", x: 11, y: 27, variante: 1 },
      { tipo: "casa", x: 16, y: 27, variante: 1 },
      { tipo: "casa", x: 30, y: 27, variante: 1 },
      { tipo: "casa", x: 35, y: 27, variante: 1 },
    ],
    marcos: [],
    decoracoes: [{ chave: "dc_fogo_apagado", x: 31, y: 23 }],
    zonasColeta: [
      { x: 56, y: 15, raio: 9 },
      { x: 44, y: 84, raio: 12 },
      { x: 110, y: 58, raio: 10 },
      { x: 124, y: 96, raio: 10 },
    ],
  },
  deserto: {
    terreno: { escala: 6, limiar: 0.62, densidade: 0.35, salpico: 0.018, semente: 23 },
    regioes: [
      { x: 18, y: 52, largura: 54, altura: 7, densidade: 0.45, tipo: "rocha" },
      { forma: "elipse", x: 40, y: 32, raioX: 24, raioY: 20, densidade: 0.03 },
      { forma: "elipse", x: 100, y: 80, raioX: 13, raioY: 12, densidade: 0.55, tipo: "rocha" },
      { forma: "elipse", x: 100, y: 80, raioX: 9, raioY: 8, densidade: 0 },
      { x: 116, y: 6, largura: 40, altura: 30, densidade: 0.02 },
      { forma: "elipse", x: 147, y: 13, raioX: 9, raioY: 6, densidade: 0.35, tipo: "acacia" },
    ],
    aguas: [{ forma: "elipse", x: 147, y: 12, raioX: 5, raioY: 3 }],
    vilas: [{ id: "acampamento_noemi", nome: "Acampamento de Noemi", x: 118, y: 8, largura: 36, altura: 24 }],
    caminhos: [
      { largura: 2, pontos: [[2, 112], [157, 112]] },
      { largura: 2, pontos: [[80, 3], [150, 3]] },
      { largura: 2, pontos: [[80, 3], [80, 112]] },
      { largura: 2, pontos: [[132, 3], [132, 112]] },
      { largura: 1, pontos: [[80, 80], [92, 80]] },
      { largura: 1, pontos: [[80, 40], [24, 40]] },
    ],
    estruturas: [
      { tipo: "tenda", x: 120, y: 10, variante: 3 },
      { tipo: "tenda", x: 125, y: 10, variante: 0 },
      { tipo: "tenda", x: 135, y: 12, variante: 1, npc: "noemi1" },
      { tipo: "banca", x: 141, y: 17, variante: 0, npc: "mercador1" },
      { tipo: "tenda", x: 127, y: 18, variante: 0, npc: "guia_deserto" },
      { tipo: "tenda", x: 138, y: 22, variante: 2, npc: "atalaia_deserto" },
      { tipo: "banca", x: 146, y: 22, variante: 1, reservada: "ferreiro" },
      { tipo: "tenda", x: 120, y: 25, variante: 3 },
      { tipo: "tenda", x: 125, y: 27, variante: 0 },
    ],
    marcos: [{ tipo: "fogueira", x: 135, y: 19 }],
    decoracoes: [{ chave: "dc_tapete", x: 144, y: 20 }],
    zonasColeta: [
      { x: 56, y: 76, raio: 12 },
      { x: 110, y: 48, raio: 12 },
      { x: 30, y: 96, raio: 10 },
      { x: 100, y: 20, raio: 9 },
    ],
  },
  mar: {
    terreno: { escala: 9, limiar: 0.72, densidade: 0.18, salpico: 0.004, semente: 37 },
    regioes: [
      { forma: "elipse", x: 76, y: 28, raioX: 18, raioY: 10, densidade: 0.16, tipo: "ilhota" },
      { forma: "elipse", x: 52, y: 92, raioX: 16, raioY: 9, densidade: 0.16, tipo: "rochedo" },
      { forma: "elipse", x: 122, y: 84, raioX: 16, raioY: 10, densidade: 0.16, tipo: "recife" },
      { x: 1, y: 56, largura: 158, altura: 9, densidade: 0 },
    ],
    aguas: [],
    vilas: [],
    caminhos: [{ largura: 1, pontos: [[1, 60], [158, 60]] }],
    estruturas: [],
    marcos: [],
    decoracoes: [],
    zonasColeta: [],
  },
  egito: {
    terreno: { escala: 7, limiar: 0.62, densidade: 0.4, salpico: 0.012, semente: 41 },
    regioes: [
      { x: 44, y: 12, largura: 30, altura: 20, densidade: 0.3, tipo: "tamareira" },
      { x: 118, y: 22, largura: 32, altura: 28, densidade: 0.22, tipo: "coluna" },
      { forma: "elipse", x: 84, y: 60, raioX: 24, raioY: 18, densidade: 0.05, tipo: "tijolos" },
      { x: 120, y: 80, largura: 30, altura: 24, densidade: 0.25, tipo: "tamareira" },
    ],
    aguas: [
      { x: 1, y: 1, largura: 158, altura: 5 },
      { forma: "elipse", x: 40, y: 6, raioX: 12, raioY: 4 },
      { forma: "elipse", x: 108, y: 6, raioX: 16, raioY: 5 },
    ],
    vilas: [{ id: "gosen", nome: "Gósen", x: 8, y: 86, largura: 31, altura: 22, muro: "tijolos" }],
    caminhos: [
      { largura: 2, pontos: [[2, 112], [157, 112]] },
      { largura: 2, pontos: [[4, 60], [155, 60]] },
      { largura: 2, pontos: [[24, 60], [24, 112]] },
      { largura: 1, pontos: [[120, 60], [120, 112]] },
    ],
    estruturas: [
      { tipo: "casa", x: 11, y: 88, variante: 3 },
      { tipo: "casa", x: 16, y: 88, variante: 3 },
      { tipo: "casa", x: 29, y: 88, variante: 3 },
      { tipo: "casa", x: 34, y: 88, variante: 3 },
      { tipo: "tenda", x: 31, y: 97, variante: 0, npc: "atalaia_egito" },
      { tipo: "poco", x: 20, y: 101 },
      { tipo: "casa", x: 11, y: 103, variante: 3 },
      { tipo: "casa", x: 30, y: 103, variante: 3 },
    ],
    marcos: [
      { tipo: "jarros", x: 12, y: 96 },
      { tipo: "jarros", x: 13, y: 97 },
    ],
    decoracoes: [{ chave: "dc_esteira", x: 22, y: 98 }],
    zonasColeta: [],
  },
  marVermelho: {
    terreno: { escala: 7, limiar: 0.62, densidade: 0.4, salpico: 0.012, semente: 53 },
    regioes: [
      { x: 120, y: 36, largura: 32, altura: 44, densidade: 0.12, tipo: "destrocos" },
      { forma: "elipse", x: 84, y: 60, raioX: 24, raioY: 18, densidade: 0.03 },
      { forma: "elipse", x: 56, y: 26, raioX: 14, raioY: 9, densidade: 0.3, tipo: "coral" },
      { forma: "elipse", x: 120, y: 98, raioX: 14, raioY: 8, densidade: 0.3, tipo: "coral" },
    ],
    aguas: [
      { forma: "elipse", x: 60, y: 26, raioX: 4, raioY: 3 },
      { forma: "elipse", x: 118, y: 98, raioX: 5, raioY: 3 },
    ],
    vilas: [{ id: "acampamento_mar", nome: "Acampamento à beira-mar", x: 8, y: 86, largura: 31, altura: 22 }],
    caminhos: [
      { largura: 2, pontos: [[2, 112], [157, 112]] },
      { largura: 2, pontos: [[4, 60], [155, 60]] },
      { largura: 2, pontos: [[22, 60], [22, 112]] },
    ],
    estruturas: [
      { tipo: "tenda", x: 10, y: 88, variante: 3 },
      { tipo: "tenda", x: 15, y: 88, variante: 0 },
      { tipo: "tenda", x: 27, y: 88, variante: 1 },
      { tipo: "tenda", x: 32, y: 88, variante: 3 },
      { tipo: "tenda", x: 29, y: 95, variante: 2, npc: "atalaia_mar" },
      { tipo: "tenda", x: 10, y: 103, variante: 0 },
      { tipo: "tenda", x: 15, y: 103, variante: 3 },
      { tipo: "tenda", x: 30, y: 104, variante: 1 },
    ],
    marcos: [],
    decoracoes: [],
    zonasColeta: [],
  },
  sinai: {
    terreno: { escala: 6, limiar: 0.6, densidade: 0.45, salpico: 0.016, semente: 67 },
    regioes: [
      { forma: "elipse", x: 122, y: 24, raioX: 30, raioY: 18, densidade: 0.5, tipo: "penedo" },
      { forma: "elipse", x: 122, y: 24, raioX: 6, raioY: 4, densidade: 0.9, tipo: "penedo" },
      { forma: "elipse", x: 84, y: 60, raioX: 24, raioY: 18, densidade: 0.04 },
      { x: 48, y: 18, largura: 24, altura: 16, densidade: 0.2, tipo: "acacia" },
      { x: 110, y: 84, largura: 40, altura: 20, densidade: 0.25, tipo: "arbusto" },
    ],
    aguas: [],
    vilas: [{ id: "refidim", nome: "Acampamento de Refidim", x: 8, y: 86, largura: 31, altura: 22 }],
    caminhos: [
      { largura: 2, pontos: [[2, 112], [157, 112]] },
      { largura: 2, pontos: [[4, 60], [155, 60]] },
      { largura: 2, pontos: [[22, 60], [22, 112]] },
    ],
    estruturas: [
      { tipo: "tenda", x: 10, y: 88, variante: 3 },
      { tipo: "tenda", x: 15, y: 88, variante: 3 },
      { tipo: "tenda", x: 27, y: 88, variante: 0 },
      { tipo: "tenda", x: 32, y: 88, variante: 3 },
      { tipo: "tenda", x: 29, y: 95, variante: 2, npc: "atalaia_sinai" },
      { tipo: "tenda", x: 10, y: 103, variante: 0 },
      { tipo: "tenda", x: 15, y: 103, variante: 3 },
      { tipo: "tenda", x: 30, y: 104, variante: 0 },
    ],
    marcos: [{ tipo: "estandarte", x: 17, y: 95 }],
    decoracoes: [],
    zonasColeta: [],
  },
  galileia: {
    terreno: { escala: 7, limiar: 0.62, densidade: 0.4, salpico: 0.012, semente: 79 },
    regioes: [
      { x: 112, y: 82, largura: 40, altura: 24, densidade: 0.3, tipo: "figueira" },
      { forma: "elipse", x: 88, y: 66, raioX: 24, raioY: 16, densidade: 0.03 },
      { x: 6, y: 16, largura: 52, altura: 36, densidade: 0.02 },
      { x: 120, y: 34, largura: 34, altura: 20, densidade: 0.22, tipo: "basalto" },
    ],
    aguas: [{ forma: "elipse", x: 92, y: 0, raioX: 62, raioY: 26 }],
    vilas: [{ id: "cafarnaum", nome: "Cafarnaum", x: 6, y: 18, largura: 39, altura: 31 }],
    caminhos: [
      { largura: 2, pontos: [[2, 112], [157, 112]] },
      { largura: 2, pontos: [[4, 60], [155, 60]] },
      { largura: 2, pontos: [[22, 24], [22, 112]] },
      { largura: 1, pontos: [[22, 24], [60, 24], [60, 34], [150, 34]] },
    ],
    estruturas: [
      { tipo: "casa", x: 9, y: 21, variante: 2 },
      { tipo: "casa", x: 14, y: 21, variante: 2 },
      { tipo: "casa", x: 27, y: 20, variante: 2 },
      { tipo: "banca", x: 31, y: 26, variante: 0, npc: "joel_galileia" },
      { tipo: "casa", x: 9, y: 31, variante: 2 },
      { tipo: "casa", x: 14, y: 31, variante: 2 },
      { tipo: "casa", x: 32, y: 31, variante: 2 },
      { tipo: "tenda", x: 36, y: 38, variante: 0 },
      { tipo: "tenda", x: 13, y: 38, variante: 2, npc: "atalaia_galileia" },
      { tipo: "poco", x: 27, y: 36 },
      { tipo: "casa", x: 9, y: 44, variante: 2 },
      { tipo: "casa", x: 14, y: 44, variante: 2 },
      { tipo: "casa", x: 28, y: 44, variante: 2 },
      { tipo: "casa", x: 33, y: 44, variante: 2 },
    ],
    marcos: [
      { tipo: "barco", x: 46, y: 18 },
      { tipo: "barco", x: 50, y: 20 },
      { tipo: "barco", x: 54, y: 21 },
    ],
    decoracoes: [
      { chave: "dc_rede", x: 39, y: 19 },
      { chave: "dc_rede", x: 48, y: 22 },
      { chave: "dc_esteira", x: 34, y: 29 },
    ],
    zonasColeta: [],
  },
};
