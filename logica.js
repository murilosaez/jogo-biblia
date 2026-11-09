const TILE = 32;
const COLS = 80;
const ROWS = 60;
const VERSAO_SAVE = 5;
const VIDA_BASE = 100;
const TEMPO_REGEN = 10000;
const INTERVALO_MOVIMENTO = 600;
const INTERVALO_ATAQUE = 1200;
const INTERVALO_AUTO_ATAQUE = 2000;
const TEMPO_RESPAWN_INIMIGO = 5000;
const TEMPO_RESPAWN_COLETAVEL = 18000;
const TEMPO_RESPAWN_PESCA = 12000;
const CURA_POCAO = 30;
const QUANTIDADE_POCOES_INICIAIS = 3;
const QUANTIDADE_ERVAS_MISSAO = 3;
const QUANTIDADE_ODRES_MISSAO = 3;
const RECOMPENSA_MISSAO_POCOES = 2;
const XP_NIVEIS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];
const CARGA_BASE = 50;
const CARGA_POR_NIVEL = 10;
const ITENS = {
  pocao: { nome: "Poção de vida", peso: 1, tipo: "consumivel" },
  pocao_fe: { nome: "Poção de fé", peso: 1, tipo: "consumivel" },
  erva: { nome: "Erva medicinal", peso: 0.5, tipo: "recurso" },
  odre_agua: { nome: "Odre de água", peso: 3, tipo: "recurso" },
  espada_madeira: { nome: "Espada de madeira", peso: 6, tipo: "arma", bonus: 5 },
  espada_ferro: { nome: "Espada de ferro", peso: 10, tipo: "arma", bonus: 12 },
  escudo_madeira: { nome: "Escudo de madeira", peso: 5, tipo: "escudo", defesa: 3 },
  tunica_pano: { nome: "Túnica de pano", peso: 4, tipo: "armadura", defesa: 2 },
  armadura_couro: { nome: "Armadura de couro", peso: 8, tipo: "armadura", defesa: 5 },
  arco_madeira: { nome: "Arco de madeira", peso: 7, tipo: "arma_distancia", bonus: 10 },
  flecha: { nome: "Flecha", peso: 0.1, tipo: "municao" },
  pele_lobo: { nome: "Pele de lobo", peso: 2, tipo: "recurso" },
  veneno_escorpiao: { nome: "Veneno de escorpião", peso: 0.5, tipo: "recurso" },
  insignia_bandido: { nome: "Insígnia do bando", peso: 0.5, tipo: "recurso" },
  peixe: { nome: "Peixe fresco", peso: 1, tipo: "recurso" },
};
const SLOTS_EQUIPAMENTO = { arma: "arma", arco: "arma_distancia", escudo: "escudo", armadura: "armadura" };
const PRECOS_LOJA = { pocao: 12, pocao_fe: 18, flechas: 8, escudo_madeira: 35, armadura_couro: 65, arco_madeira: 80 };
const VALORES_VENDA = { pele_lobo: 5, erva: 2, odre_agua: 3, peixe: 6 };
function nomeItem(id) { return ITENS[id]?.nome || id; }
function pesoItem(id) { return ITENS[id]?.peso ?? 1; }
function capacidadeCarga(p) { return CARGA_BASE + Math.max(0, (p.nivel || 1) - 1) * CARGA_POR_NIVEL; }
function pesoCarregado(p) {
  const pesoBolsa = p.inventario.reduce((soma, item) => soma + pesoItem(item), 0);
  const pesoEquipado = Object.values(p.equipamento || {}).reduce((soma, item) => soma + (item ? pesoItem(item) : 0), 0);
  return Math.round((pesoBolsa + pesoEquipado) * 10) / 10;
}
function defesaEquipamento(p) {
  return Object.values(p.equipamento || {}).reduce((soma, item) => soma + (item ? (ITENS[item]?.defesa || 0) : 0), 0);
}
function bonusArma(p) { const item = p.equipamento?.arma; return item ? (ITENS[item]?.bonus || 0) : 0; }
function bonusArco(p) { const item = p.equipamento?.arco; return item ? (ITENS[item]?.bonus || 0) : 0; }
function bonusHabilidade(p, chave) { const n=p.habilidades?.[chave]||0; return Math.floor(n*(chave==="defesa"?.3:chave==="distancia"?.4:.5)); }
function defesaTotal(p) { return defesaEquipamento(p) + bonusHabilidade(p, "defesa"); }

function vidaMaxima(personagem) { return VIDA_BASE + Math.max(0, (personagem.nivel || 1) - 1) * 10; }
function limiarNivel(nivel) {
  if (nivel < XP_NIVEIS.length) return XP_NIVEIS[nivel];
  return XP_NIVEIS[XP_NIVEIS.length - 1] + (nivel - XP_NIVEIS.length + 1) * 650;
}
function adicionarXP(personagem, quantidade) {
  personagem.xp = Math.max(0, (personagem.xp || 0) + quantidade);
  const niveis = [];
  while (personagem.nivel < 100 && personagem.xp >= limiarNivel(personagem.nivel)) {
    personagem.nivel += 1;
    personagem.vida = vidaMaxima(personagem);
    niveis.push(personagem.nivel);
  }
  return niveis;
}

const areas = {
  canaan: { id: "canaan", nome: "Canaã", passagem: { x: 77, y: 56 }, chegada: { x: 75, y: 56 }, cais: { x: 40, y: 2 } },
  deserto: { id: "deserto", nome: "Deserto", passagem: { x: 2, y: 56 }, chegada: { x: 4, y: 56 }, cais: { x: 40, y: 2 } },
  mar: { id: "mar", nome: "Mar das Rotas", caisCanaa: { x: 2, y: 30 }, caisDeserto: { x: 77, y: 30 } },
};

function criarMapa(areaId) {
  const mapa = [];
  for (let y = 0; y < ROWS; y++) {
    mapa[y] = [];
    for (let x = 0; x < COLS; x++) {
      const borda = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      let obstaculo = false;
      if (areaId === "canaan") obstaculo = x % 6 === 3 && y % 4 === 2;
      else if (areaId === "deserto") {
        obstaculo = (x * 7 + y * 11) % 23 === 0;
        if (y === ROWS - 4 && x >= 1 && x <= 5) obstaculo = false;
      } else {
        obstaculo = x > 7 && x < COLS - 8 && y > 4 && y < ROWS - 5 && (x * 17 + y * 23) % 41 === 0;
        if (y === 30) obstaculo = false;
      }
      mapa[y][x] = borda || obstaculo ? 1 : 0;
    }
  }
  return mapa;
}
const mapas = { canaan: criarMapa("canaan"), deserto: criarMapa("deserto"), mar: criarMapa("mar") };
const npcs = {
  viajante1: { id: "viajante1", nome: "Eliabe", area: "canaan", x: 2, y: 5 },
  noemi1: { id: "noemi1", nome: "Noemi", area: "deserto", x: 68, y: 8 },
  mercador1: { id: "mercador1", nome: "Azarias, mercador", area: "deserto", x: 72, y: 10 },
  guia_canaa: { id: "guia_canaa", nome: "Micael, guia de caravanas", area: "canaan", x: 5, y: 5 },
  guia_deserto: { id: "guia_deserto", nome: "Tamar, guia de caravanas", area: "deserto", x: 66, y: 12 },
};
const pontosPesca = [{ id: "pesca1", x: 18, y: 15 }, { id: "pesca2", x: 40, y: 42 }, { id: "pesca3", x: 62, y: 18 }, { id: "pesca4", x: 49, y: 32 }];
const ervas = [
  { id: "erva1", x: 13, y: 12 }, { id: "erva2", x: 41, y: 31 }, { id: "erva3", x: 71, y: 49 },
];
const odres = [
  { id: "odre1", x: 11, y: 48 }, { id: "odre2", x: 39, y: 34 }, { id: "odre3", x: 70, y: 15 },
];
const inimigos = {
  lobo1: { id: "lobo1", nome: "Lobo", area: "canaan", x: 6, y: 5, inicioX: 6, inicioY: 5, vidaMaxima: 50, danoDoAtaque: 25, danoContraJogador: 8, raioPercepcao: 6, xpRecompensa: 40, proximoMovimento: 0, proximoAtaque: 0 },
  escorpiao1: { id: "escorpiao1", nome: "Escorpião", area: "deserto", x: 16, y: 9, inicioX: 16, inicioY: 9, vidaMaxima: 70, danoDoAtaque: 20, danoContraJogador: 12, raioPercepcao: 5, xpRecompensa: 60, proximoMovimento: 0, proximoAtaque: 0 },
  bandido1: { id: "bandido1", nome: "Chefe dos saqueadores", area: "deserto", x: 49, y: 46, inicioX: 49, inicioY: 46, vidaMaxima: 100, danoDoAtaque: 26, danoContraJogador: 15, raioPercepcao: 6, xpRecompensa: 100, proximoMovimento: 0, proximoAtaque: 0 },
};
// Espaços garantidamente transitáveis para personagens, inimigos, itens e passagens.
for (const npc of Object.values(npcs)) mapas[npc.area][npc.y][npc.x] = 0;
for (const inimigo of Object.values(inimigos)) mapas[inimigo.area][inimigo.y][inimigo.x] = 0;
for (const item of [...ervas, ...odres]) mapas[item.id.startsWith("erva") ? "canaan" : "deserto"][item.y][item.x] = 0;
// Trilhas terrestres contínuas e acessos aos cais.
for (let x = 2; x <= 77; x++) { mapas.canaan[56][x] = 0; mapas.deserto[56][x] = 0; }
for (let y = 2; y <= 56; y++) { mapas.canaan[y][2] = 0; mapas.deserto[y][40] = 0; }
for (let x = 2; x <= 77; x++) mapas.canaan[2][x] = 0;
for (let x = 40; x <= 77; x++) mapas.deserto[2][x] = 0;
for (let x = 1; x <= 78; x++) mapas.mar[30][x] = 0;
for (const point of pontosPesca) mapas.mar[point.y][point.x] = 0;
for (const [areaId, area] of Object.entries(areas)) {
  if (area.passagem) { mapas[areaId][area.passagem.y][area.passagem.x] = 0; mapas[areaId][area.chegada.y][area.chegada.x] = 0; }
  if (area.cais) { mapas[areaId][area.cais.y][area.cais.x] = 0; mapas[areaId][area.cais.y + 1][area.cais.x] = 0; }
}
mapas.mar[30][2] = 0; mapas.mar[30][77] = 0;
mapas.canaan[2][2] = 0; mapas.canaan[5][5] = 0; mapas.deserto[12][66] = 0;

function missaoEliabeNova() { return { status: "nao_iniciada", loboDerrotado: false, recompensaRecebida: false }; }
function missaoErvasNova() { return { status: "bloqueada", recompensaRecebida: false, ervasMissaoColetadas: [] }; }
function missaoDesertoNova() { return { status: "bloqueada", etapa: 0, recompensaRecebida: false, odresMissaoColetados: [], venenosMissaoColetados: [], insigniasMissaoColetadas: [] }; }

const Mundo = {
  jogadores: {}, estado: {},
  entrar(id) {
    let p = Storage.carregar(id);
    if (!p || typeof p !== "object") p = { id, area: "canaan", x: 2, y: 2, vida: VIDA_BASE, inventario: [], itensIniciaisEntregues: false, inimigosDerrotados: [], vidaInimigos: {}, ervasColetadas: [], odresColetados: [], ervasRespawn: {}, odresRespawn: {}, pescaRespawn: {}, xp: 0, nivel: 1, moedas: 30, economiaInicialEntregue: true, habilidades: { corpo: 0, distancia: 0, defesa: 0 }, mortes: 0 };
    p.id = id;
    if (!Array.isArray(p.inventario)) p.inventario = [];
    if (!p.economiaInicialEntregue) { p.moedas = Math.max(0, Number(p.moedas) || 0) + 30; p.economiaInicialEntregue = true; }
    p.moedas = Number.isFinite(p.moedas) ? Math.max(0, Math.floor(p.moedas)) : 30;
    p.mortes = Number.isInteger(p.mortes) ? Math.max(0, p.mortes) : 0;
    if (!p.habilidades || typeof p.habilidades !== "object") p.habilidades = { corpo: 0, distancia: 0, defesa: 0 };
    for (const habilidade of ["corpo", "distancia", "defesa"]) p.habilidades[habilidade] = Number.isInteger(p.habilidades[habilidade]) ? Math.max(0, p.habilidades[habilidade]) : 0;
    if (!p.equipamento || typeof p.equipamento !== "object") p.equipamento = { arma: null, arco: null, escudo: null, armadura: null };
    for (const slot of Object.keys(SLOTS_EQUIPAMENTO)) if (!(slot in p.equipamento)) p.equipamento[slot] = null;
    if (!Array.isArray(p.hotkeys)) p.hotkeys = ["pocao", null, null, null, null, null];
    p.hotkeys = Array.from({ length: 6 }, (_, i) => p.hotkeys[i] || null);
    if (!Array.isArray(p.saqueNoChao)) p.saqueNoChao = [];
    p.saqueNoChao = p.saqueNoChao.filter((s) => s && typeof s.id === "string" && areas[s.area] && Number.isInteger(s.x) && Number.isInteger(s.y) && (Number.isInteger(s.moedas) || ITENS[s.item]));
    for (const [slot, tipo] of Object.entries(SLOTS_EQUIPAMENTO)) {
      const item = p.equipamento[slot];
      if (item && ITENS[item]?.tipo !== tipo) p.equipamento[slot] = null;
    }
    // Se um save antigo tiver espada e arco equipados, mantém a espada e guarda o arco sem perder o item.
    if (p.equipamento.arma && p.equipamento.arco) {
      p.inventario.push(p.equipamento.arco);
      p.equipamento.arco = null;
    }
    for (const chave of ["inimigosDerrotados", "ervasColetadas", "odresColetados"]) if (!Array.isArray(p[chave])) p[chave] = [];
    if (!p.ervasRespawn || typeof p.ervasRespawn !== "object") p.ervasRespawn = {};
    if (!p.odresRespawn || typeof p.odresRespawn !== "object") p.odresRespawn = {};
    if (!p.pescaRespawn || typeof p.pescaRespawn !== "object") p.pescaRespawn = {};
    if (!p.vidaInimigos || typeof p.vidaInimigos !== "object") p.vidaInimigos = {};
    if (!areas[p.area]) { p.area = "canaan"; p.x = 2; p.y = 2; }
    p.nivel = Number.isInteger(p.nivel) ? Math.max(1, Math.min(100, p.nivel)) : 1;
    p.xp = Number.isFinite(p.xp) ? Math.max(0, p.xp) : 0;
    const maxVida = vidaMaxima(p);
    p.vida = Number.isFinite(p.vida) ? Math.max(0, Math.min(p.vida, maxVida)) : maxVida;
    if (p.vida <= 0) { p.area = "canaan"; p.x = 2; p.y = 2; p.vida = maxVida; }
    if (!p.itensIniciaisEntregues) { for (let i = 0; i < QUANTIDADE_POCOES_INICIAIS; i++) p.inventario.push("pocao"); p.itensIniciaisEntregues = true; }
    if (!p.equipamentoInicialEntregue) {
      p.inventario.push("espada_madeira", "escudo_madeira", "tunica_pano");
      p.equipamentoInicialEntregue = true;
    }
    if (!p.missaoEliabe || typeof p.missaoEliabe !== "object") p.missaoEliabe = missaoEliabeNova();
    if (!p.missaoErvas || typeof p.missaoErvas !== "object") p.missaoErvas = missaoErvasNova();
    if (!p.missaoDeserto || typeof p.missaoDeserto !== "object") p.missaoDeserto = missaoDesertoNova();
    const statuses = { missaoEliabe: ["nao_iniciada", "em_andamento", "concluida"], missaoErvas: ["bloqueada", "em_andamento", "concluida"], missaoDeserto: ["bloqueada", "em_andamento", "concluida"] };
    for (const [key, allowed] of Object.entries(statuses)) if (!allowed.includes(p[key].status)) p[key].status = key === "missaoEliabe" ? "nao_iniciada" : "bloqueada";
    for (const [key, fallback] of [["missaoEliabe", missaoEliabeNova], ["missaoErvas", missaoErvasNova], ["missaoDeserto", missaoDesertoNova]]) {
      const fresh = fallback();
      for (const [field, value] of Object.entries(fresh)) if (!(field in p[key])) p[key][field] = value;
    }
    if (typeof p.missaoEliabe.loboDerrotado !== "boolean") p.missaoEliabe.loboDerrotado = false;
    for (const m of [p.missaoEliabe, p.missaoErvas, p.missaoDeserto]) if (typeof m.recompensaRecebida !== "boolean") m.recompensaRecebida = false;
    if (!Array.isArray(p.missaoErvas.ervasMissaoColetadas)) p.missaoErvas.ervasMissaoColetadas = [];
    if (!Number.isInteger(p.missaoDeserto.etapa)) p.missaoDeserto.etapa = p.missaoDeserto.status === "concluida" ? 4 : p.missaoDeserto.status === "em_andamento" ? 1 : 0;
    if (!Array.isArray(p.missaoDeserto.odresMissaoColetados)) p.missaoDeserto.odresMissaoColetados = [];
    if (!Array.isArray(p.missaoDeserto.venenosMissaoColetados)) p.missaoDeserto.venenosMissaoColetados = [];
    if (!Array.isArray(p.missaoDeserto.insigniasMissaoColetadas)) p.missaoDeserto.insigniasMissaoColetadas = [];
    // Saves antigos que já concluíram a missão recebem a nova recompensa de distância uma única vez.
    if (p.missaoDeserto.status === "concluida" && !p.atualizacaoDistanciaEntregue) {
      if (!p.equipamento.arco && !p.inventario.includes("arco_madeira")) this.adicionarItem(p, "arco_madeira");
      for (let i = 0; i < 8; i++) if (!this.adicionarItem(p, "flecha")) break;
      p.atualizacaoDistanciaEntregue = true;
      p.avisoAtualizacao = "Nova recompensa: Arco de madeira e flechas. Abra a mochila (I), equipe o arco com 4 e use R para atirar.";
    }
    p.versao = VERSAO_SAVE;
    for (const e of Object.values(inimigos)) {
      const hp = p.vidaInimigos[e.id];
      p.vidaInimigos[e.id] = p.inimigosDerrotados.includes(e.id) ? 0 : (Number.isFinite(hp) ? Math.max(0, Math.min(hp, e.vidaMaxima)) : e.vidaMaxima);
      e.x = e.inicioX; e.y = e.inicioY; e.proximoMovimento = 0; e.proximoAtaque = 0;
    }
    this.jogadores[id] = p;
    this.estado[id] = { proximaRegen: Date.now() + TEMPO_REGEN };
    Storage.salvar(p);
    return p;
  },
  inimigoVivo(p, enemyId) { return !p.inimigosDerrotados.includes(enemyId) && p.vidaInimigos[enemyId] > 0; },
  obterVidaInimigo(id, enemyId) { const p = this.jogadores[id], e = inimigos[enemyId]; return p && e ? (p.inimigosDerrotados.includes(enemyId) ? 0 : p.vidaInimigos[enemyId]) : null; },
  contarItem(id, item) { const p = this.jogadores[id]; return p ? p.inventario.filter((x) => x === item).length : 0; },
  coletavelDisponivel(id, area, itemId) {
    const p = this.jogadores[id];
    if (!p) return false;
    const tempos = area === "canaan" ? p.ervasRespawn : p.odresRespawn;
    return !tempos?.[itemId] || Date.now() >= tempos[itemId];
  },
  pescaDisponivel(id, pontoId) { const p = this.jogadores[id]; return !!p && (!p.pescaRespawn?.[pontoId] || Date.now() >= p.pescaRespawn[pontoId]); },
  coletarSaque(id, saqueId) {
    const p = this.jogadores[id], s = p?.saqueNoChao.find((x) => x.id === saqueId && x.area === p.area);
    if (!s) return { ok: false, mensagem: "Esse saque não está mais no chão." };
    if (Math.max(Math.abs(p.x - s.x), Math.abs(p.y - s.y)) > 1) return { ok: false, mensagem: "Chegue ao lado do item para pegá-lo." };
    if (s.moedas) { p.moedas += s.moedas; p.saqueNoChao = p.saqueNoChao.filter((x) => x.id !== s.id); Storage.salvar(p); return { ok: true, moedas: s.moedas, itemColetado: s.id, mensagem: `Você pegou ${s.moedas} moedas.` }; }
    if (!this.adicionarItem(p, s.item)) return { ok: false, mensagem: `Mochila cheia (${pesoCarregado(p)}/${capacidadeCarga(p)} kg). Libere espaço para pegar o item.` };
    p.saqueNoChao = p.saqueNoChao.filter((x) => x.id !== s.id);
    const m = p.missaoDeserto;
    if (m.status === "em_andamento" && m.etapa === 2 && s.item === "veneno_escorpiao" && !m.venenosMissaoColetados.includes(s.id)) m.venenosMissaoColetados.push(s.id);
    if (m.status === "em_andamento" && m.etapa === 3 && s.item === "insignia_bandido" && !m.insigniasMissaoColetadas.includes(s.id)) m.insigniasMissaoColetadas.push(s.id);
    Storage.salvar(p); return { ok: true, itemColetado: s.id, mensagem: `Você pegou: ${nomeItem(s.item)}.` };
  },
  comprarItem(id, item) {
    const p = this.jogadores[id], n = npcs.mercador1;
    if (!p || p.area !== n.area || Math.abs(p.x-n.x)+Math.abs(p.y-n.y)>1) return { ok:false, mensagem:"Aproxime-se do mercador para comprar." };
    const preco = PRECOS_LOJA[item]; if (!preco) return { ok:false, mensagem:"Esse item não está à venda." };
    const lista = item === "flechas" ? Array(5).fill("flecha") : [item];
    if (p.moedas < preco) return { ok:false, mensagem:`Você precisa de ${preco} moedas.` };
    if (!this.podeReceberComRemocao(p, lista)) return { ok:false, mensagem:"A mochila está cheia." };
    p.moedas -= preco; for (const x of lista) this.adicionarItem(p,x); Storage.salvar(p);
    return {ok:true,mensagem:`Compra realizada: ${item === "flechas" ? "5 flechas" : nomeItem(item)} por ${preco} moedas.`};
  },
  venderItem(id,item) {
    const p=this.jogadores[id], n=npcs.mercador1, valor=VALORES_VENDA[item];
    if(!p||p.area!==n.area||Math.abs(p.x-n.x)+Math.abs(p.y-n.y)>1) return {ok:false,mensagem:"Aproxime-se do mercador para vender."};
    const i=p.inventario.indexOf(item); if(!valor||i<0) return {ok:false,mensagem:"O mercador não compra esse item ou você não o tem."};
    p.inventario.splice(i,1); p.moedas+=valor; Storage.salvar(p); return {ok:true,mensagem:`Você vendeu ${nomeItem(item)} por ${valor} moedas.`};
  },
  equiparItem(id, itemId, slot) {
    const p = this.jogadores[id], tipo = SLOTS_EQUIPAMENTO[slot];
    if (!p || !tipo || ITENS[itemId]?.tipo !== tipo) return { ok: false, mensagem: "Esse item não serve neste espaço." };
    const indice = p.inventario.indexOf(itemId);
    if (indice < 0) return { ok: false, mensagem: "O item não está na mochila." };
    const slotIncompativel = slot === "arma" ? "arco" : slot === "arco" ? "arma" : null;
    if (slotIncompativel && p.equipamento[slotIncompativel]) {
      p.inventario.push(p.equipamento[slotIncompativel]);
      p.equipamento[slotIncompativel] = null;
    }
    const anterior = p.equipamento[slot];
    p.inventario.splice(indice, 1);
    if (anterior) p.inventario.push(anterior);
    p.equipamento[slot] = itemId;
    Storage.salvar(p);
    return { ok: true, mensagem: `${nomeItem(itemId)} equipado. ${nomeItem(itemId)}: ${ITENS[itemId].bonus ? `+${ITENS[itemId].bonus} de bônus` : `+${ITENS[itemId].defesa || 0} de defesa`}.` };
  },
  desequiparItem(id, slot) {
    const p = this.jogadores[id], item = p?.equipamento?.[slot];
    if (!item) return { ok: false };
    p.inventario.push(item); p.equipamento[slot] = null; Storage.salvar(p);
    return { ok: true, mensagem: `${nomeItem(item)} voltou para a mochila.` };
  },
  atribuirHotkey(id, indice, item) {
    const p = this.jogadores[id];
    if (!p || indice < 0 || indice > 5) return { ok: false };
    if (item && (ITENS[item]?.tipo !== "consumivel" || !p.inventario.includes(item))) return { ok: false, mensagem: "A hotkey aceita consumíveis que estejam na mochila." };
    p.hotkeys[indice] = item || null; Storage.salvar(p); return { ok: true };
  },
  adicionarItem(p, item) {
    if (!ITENS[item] || pesoCarregado(p) + pesoItem(item) > capacidadeCarga(p) + 0.0001) return false;
    p.inventario.push(item); return true;
  },
  podeReceberComRemocao(p, recompensas, remocoes = []) {
    let peso = pesoCarregado(p);
    for (const [item, quantidade] of remocoes) peso -= pesoItem(item) * quantidade;
    for (const item of recompensas) peso += pesoItem(item);
    return peso <= capacidadeCarga(p) + 0.0001;
  },
  reaparecerInimigo(id, enemyId) {
    const p = this.jogadores[id], e = inimigos[enemyId];
    if (!p || !e) return false;
    const i = p.inimigosDerrotados.indexOf(enemyId);
    if (i < 0) return false;
    p.inimigosDerrotados.splice(i, 1); p.vidaInimigos[enemyId] = e.vidaMaxima;
    e.x = e.inicioX; e.y = e.inicioY; e.proximoMovimento = 0; e.proximoAtaque = 0;
    Storage.salvar(p); return true;
  },
  casaLivre(x, y, p, ignorarJogador = false) {
    if (!mapas[p.area][y] || mapas[p.area][y][x] !== 0) return false;
    if (!ignorarJogador && p.x === x && p.y === y) return false;
    if (Object.values(npcs).some((n) => n.area === p.area && n.x === x && n.y === y)) return false;
    return !Object.values(inimigos).some((e) => e.area === p.area && this.inimigoVivo(p, e.id) && e.x === x && e.y === y);
  },
  passoInimigo(e, alvoX, alvoY, p) {
    const dx = alvoX - e.x, dy = alvoY - e.y;
    const tentativas = Math.abs(dx) >= Math.abs(dy) ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) }] : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx), y: 0 }];
    for (const d of tentativas) if ((d.x || d.y) && this.casaLivre(e.x + d.x, e.y + d.y, p)) { e.x += d.x; e.y += d.y; return true; }
    return false;
  },
  atualizar(id, agora) {
    const p = this.jogadores[id], estado = this.estado[id], eventos = [];
    if (!p || !estado) return eventos;
    for (const e of Object.values(inimigos).filter((x) => x.area === p.area)) {
      if (!this.inimigoVivo(p, e.id)) continue;
      const distancia = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
      if (distancia === 1) {
        if (agora >= e.proximoAtaque) {
          e.proximoAtaque = agora + INTERVALO_ATAQUE; estado.proximaRegen = agora + TEMPO_REGEN;
          p.habilidades.defesa++;
          const defesaTotalAtual = defesaTotal(p);
          const danoReal = Math.max(1, e.danoContraJogador - defesaTotalAtual);
          p.vida = Math.max(0, p.vida - danoReal);
          if (p.vida === 0) {
            const moedasPerdidas = Math.floor(p.moedas * 0.10); p.moedas -= moedasPerdidas; p.mortes++;
            p.area = "canaan"; p.x = 2; p.y = 2; p.vida = vidaMaxima(p);
            for (const outro of Object.values(inimigos)) if (this.inimigoVivo(p, outro.id)) { outro.x = outro.inicioX; outro.y = outro.inicioY; outro.proximoAtaque = 0; outro.proximoMovimento = 0; p.vidaInimigos[outro.id] = outro.vidaMaxima; }
            Storage.salvar(p); eventos.push({ tipo: "renasceu", mensagem: `Você foi derrotado e voltou a Canaã. Penalidade: ${moedasPerdidas} moedas (10% do que carregava). Nível, inventário e missões foram preservados.` }); return eventos;
          }
          Storage.salvar(p); eventos.push({ tipo: "jogadorAtingido", dano: danoReal, defesaBloqueada: Math.max(0, e.danoContraJogador - danoReal), mensagem: `${e.nome} atingiu você por ${danoReal} de dano! Vida: ${p.vida}/${vidaMaxima(p)}.` });
        }
        continue;
      }
      if (agora < e.proximoMovimento) continue;
      e.proximoMovimento = agora + INTERVALO_MOVIMENTO;
      let tx = e.inicioX, ty = e.inicioY;
      if (distancia <= e.raioPercepcao) { tx = p.x; ty = p.y; }
      else if (e.x === e.inicioX && e.y === e.inicioY) continue;
      if (this.passoInimigo(e, tx, ty, p)) { e.proximoAtaque = Math.max(e.proximoAtaque, agora + 600); eventos.push({ tipo: "inimigoMoveu", id: e.id }); }
    }
    if (p.vida < vidaMaxima(p) && agora >= estado.proximaRegen) { p.vida += 1; estado.proximaRegen = agora + TEMPO_REGEN; Storage.salvar(p); eventos.push({ tipo: "regenerou" }); }
    return eventos;
  },
  executar(id, comando) {
    const p = this.jogadores[id];
    if (!p || !comando || typeof comando.tipo !== "string") return { ok: false };
    if (comando.tipo === "mover") {
      const dx = Number(comando.dx), dy = Number(comando.dy);
      if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) > 1 || Math.abs(dy) > 1 || (!dx && !dy)) return { ok: false };
      const nx = p.x + dx, ny = p.y + dy;
      if (!mapas[p.area][ny] || mapas[p.area][ny][nx] !== 0) return { ok: false };
      if (Object.values(npcs).some((n) => n.area === p.area && n.x === nx && n.y === ny) || Object.values(inimigos).some((e) => e.area === p.area && this.inimigoVivo(p, e.id) && e.x === nx && e.y === ny)) return { ok: false };
      p.x = nx; p.y = ny;
      if (p.area === "mar") {
        if (nx === areas.mar.caisCanaa.x && ny === areas.mar.caisCanaa.y) { p.area = "canaan"; p.x = 40; p.y = 3; Storage.salvar(p); return { ok: true, areaAlterada: true, mensagem: "O barco chegou ao cais de Canaã." }; }
        if (nx === areas.mar.caisDeserto.x && ny === areas.mar.caisDeserto.y) { p.area = "deserto"; p.x = 40; p.y = 3; Storage.salvar(p); return { ok: true, areaAlterada: true, mensagem: "O barco chegou ao cais do Deserto." }; }
      } else {
        const passage = areas[p.area].passagem;
        if (passage && nx === passage.x && ny === passage.y) {
          const next = p.area === "canaan" ? "deserto" : "canaan";
          p.area = next; p.x = areas[next].chegada.x; p.y = areas[next].chegada.y; Storage.salvar(p);
          return { ok: true, areaAlterada: true, mensagem: `Você percorreu a trilha terrestre e chegou a ${areas[next].nome}.` };
        }
        const cais = areas[p.area].cais;
        if (cais && nx === cais.x && ny === cais.y) {
          const origem = p.area; p.area = "mar"; p.x = origem === "canaan" ? 3 : 76; p.y = 30; Storage.salvar(p);
          return { ok: true, areaAlterada: true, mensagem: "Você embarcou no cais. Navegue até o marcador Canaã ou Deserto para desembarcar." };
        }
      }
      const saqueNoPiso = p.saqueNoChao.find((s) => s.area === p.area && s.x === nx && s.y === ny);
      if (saqueNoPiso) return this.coletarSaque(id, saqueNoPiso.id);
      if (p.area === "canaan") {
        const item = ervas.find((x) => x.x === nx && x.y === ny && this.coletavelDisponivel(id, "canaan", x.id));
        if (item) {
          if (!this.adicionarItem(p, "erva")) return { ok: true, mensagem: `Mochila cheia (${pesoCarregado(p)}/${capacidadeCarga(p)} kg). Libere espaço para coletar a erva.` };
          p.ervasColetadas.push(item.id);
          p.ervasRespawn[item.id] = Date.now() + TEMPO_RESPAWN_COLETAVEL;
          if (p.missaoErvas.status === "em_andamento" && !p.missaoErvas.ervasMissaoColetadas.includes(item.id)) p.missaoErvas.ervasMissaoColetadas.push(item.id);
          Storage.salvar(p); return { ok: true, itemColetado: item.id, mensagem: "Você coletou uma erva medicinal." };
        }
      } else {
        const item = odres.find((x) => x.x === nx && x.y === ny && this.coletavelDisponivel(id, "deserto", x.id));
        if (item) {
          if (!this.adicionarItem(p, "odre_agua")) return { ok: true, mensagem: `Mochila cheia (${pesoCarregado(p)}/${capacidadeCarga(p)} kg). Libere espaço para pegar o odre.` };
          p.odresColetados.push(item.id);
          p.odresRespawn[item.id] = Date.now() + TEMPO_RESPAWN_COLETAVEL;
          if (p.missaoDeserto.status === "em_andamento" && p.missaoDeserto.etapa === 1 && !p.missaoDeserto.odresMissaoColetados.includes(item.id)) p.missaoDeserto.odresMissaoColetados.push(item.id);
          Storage.salvar(p); return { ok: true, itemColetado: item.id, mensagem: "Você encontrou um odre de água." };
        }
      }
      Storage.salvar(p); return { ok: true };
    }
    if (comando.tipo === "coletarSaque") return this.coletarSaque(id, comando.saqueId);
    if (comando.tipo === "comprar") return this.comprarItem(id, comando.item);
    if (comando.tipo === "pescar") {
      if (p.area !== "mar") return { ok: false, mensagem: "A pesca só é possível no mar, a partir do barco." };
      const ponto = pontosPesca.find((x) => Math.max(Math.abs(p.x-x.x), Math.abs(p.y-x.y)) <= 1);
      if (!ponto) return { ok: false, mensagem: "Aproxime o barco de um ponto de pesca marcado com o peixe e pressione P." };
      if (!this.pescaDisponivel(id, ponto.id)) return { ok: false, mensagem: "Esse ponto está descansando. Tente outro local ou volte em alguns instantes." };
      if (!this.adicionarItem(p, "peixe")) return { ok: false, mensagem: `Mochila cheia (${pesoCarregado(p)}/${capacidadeCarga(p)} kg). Libere espaço antes de pescar.` };
      p.pescaRespawn[ponto.id] = Date.now() + TEMPO_RESPAWN_PESCA; Storage.salvar(p);
      return { ok: true, mensagem: "Você pescou um peixe fresco! Azarias compra cada peixe por 6 moedas." };
    }
    if (comando.tipo === "viajar") {
      const guia = Object.values(npcs).find((n) => n.id.startsWith("guia_") && n.area === p.area && Math.abs(p.x-n.x)+Math.abs(p.y-n.y) <= 1);
      const destino = comando.areaDestino;
      if (!guia) return { ok: false, mensagem: "Aproxime-se de um guia de caravanas para usar a viagem rápida." };
      if (!["canaan", "deserto"].includes(destino) || destino === p.area) return { ok: false, mensagem: "Destino indisponível." };
      p.area = destino; p.x = destino === "canaan" ? 6 : 65; p.y = destino === "canaan" ? 5 : 12; Storage.salvar(p);
      return { ok: true, areaAlterada: true, mensagem: `Viagem rápida para ${areas[destino].nome}. A trilha terrestre continua disponível para viajar a pé.` };
    }
    if (comando.tipo === "vender") return this.venderItem(id, comando.item);
    if (comando.tipo === "interagir") {
      const npc = comando.alvoId ? npcs[comando.alvoId] : Object.values(npcs).find((n) => n.area === p.area && Math.abs(p.x - n.x) + Math.abs(p.y - n.y) <= 1);
      if (!npc || npc.area !== p.area) return { ok: false, mensagem: "Não há ninguém por perto para conversar." };
      if (Math.abs(p.x - npc.x) + Math.abs(p.y - npc.y) > 1) return { ok: false, mensagem: "Chegue mais perto para conversar." };
      if (npc.id === "viajante1") return this.interagirEliabe(id);
      if (npc.id === "noemi1") return this.interagirNoemi(id);
      if (npc.id === "mercador1") return { ok:true, abrirLoja:true, mensagem:"Azarias: Tenho provisões, flechas e equipamentos para vender." };
      if (npc.id === "guia_canaa" || npc.id === "guia_deserto") return { ok:true, abrirViagem:true, mensagem:`${npc.nome}: Posso levar você rapidamente entre Canaã e o Deserto. A viagem é gratuita; também há uma trilha terrestre para caminhar.` };
    }
    if (comando.tipo === "alternarEquipamento") {
      const slot = comando.slot;
      const tipo = SLOTS_EQUIPAMENTO[slot];
      if (!tipo) return { ok: false, mensagem: "Espaço de equipamento inválido." };
      const atual = p.equipamento[slot];
      const candidatos = p.inventario.filter((item) => ITENS[item]?.tipo === tipo);
      candidatos.sort((a, b) => (ITENS[b].bonus || ITENS[b].defesa || 0) - (ITENS[a].bonus || ITENS[a].defesa || 0));
      if (atual && candidatos.length) {
        const escolhido = candidatos[0], indice = p.inventario.indexOf(escolhido);
        p.inventario[indice] = atual; p.equipamento[slot] = escolhido;
        Storage.salvar(p); return { ok: true, mensagem: `Equipado: ${nomeItem(escolhido)}. ${nomeItem(atual)} foi para a mochila.` };
      }
      if (atual) {
        p.inventario.push(atual); p.equipamento[slot] = null;
        Storage.salvar(p); return { ok: true, mensagem: `Você guardou ${nomeItem(atual)} na mochila.` };
      }
      if (!candidatos.length) return { ok: false, mensagem: `Você não tem item para equipar no espaço: ${slot}.` };
      const escolhido = candidatos[0];
      const slotIncompativel = slot === "arma" ? "arco" : slot === "arco" ? "arma" : null;
      if (slotIncompativel && p.equipamento[slotIncompativel]) {
        p.inventario.push(p.equipamento[slotIncompativel]);
        p.equipamento[slotIncompativel] = null;
      }
      p.inventario.splice(p.inventario.indexOf(escolhido), 1); p.equipamento[slot] = escolhido;
      Storage.salvar(p); return { ok: true, mensagem: `Equipado: ${nomeItem(escolhido)}.${slotIncompativel ? " Espada e arco não podem ser usados ao mesmo tempo; o outro foi para a mochila." : ""}` };
    }
    if (comando.tipo === "usarPocao") {
      const i = p.inventario.indexOf("pocao");
      if (i < 0) return { ok: false, mensagem: "Você não tem poções." };
      if (p.vida >= vidaMaxima(p)) return { ok: false, mensagem: "Sua vida já está cheia. A poção não foi consumida." };
      p.inventario.splice(i, 1); const antes = p.vida; p.vida = Math.min(vidaMaxima(p), p.vida + CURA_POCAO);
      this.estado[id].proximaRegen = Date.now() + TEMPO_REGEN; Storage.salvar(p);
      return { ok: true, mensagem: `Você usou uma poção e recuperou ${p.vida - antes} de vida. Vida: ${p.vida}/${vidaMaxima(p)}.` };
    }
    if (comando.tipo === "atacarDistancia") {
      if (!p.equipamento.arco) return { ok: false, mensagem: "Equipe um arco na mochila antes de atacar à distância." };
      const flechaIndex = p.inventario.indexOf("flecha");
      if (flechaIndex < 0) return { ok: false, mensagem: "Você não tem flechas." };
      const alvos = Object.values(inimigos).filter((e) => {
        if (comando.alvoId && e.id !== comando.alvoId) return false;
        if (e.area !== p.area || !this.inimigoVivo(p, e.id)) return false;
        const deltaX = Math.abs(e.x - p.x), deltaY = Math.abs(e.y - p.y);
        const mesmaLinha = e.y === p.y, mesmaColuna = e.x === p.x;
        const diagonal = deltaX === deltaY;
        const distancia = Math.max(deltaX, deltaY);
        if ((!mesmaLinha && !mesmaColuna && !diagonal) || distancia < 1 || distancia > 8) return false;
        const dx = Math.sign(e.x - p.x), dy = Math.sign(e.y - p.y);
        for (let passo = 1; passo < distancia; passo++) if (mapas[p.area][p.y + dy * passo][p.x + dx * passo] !== 0) return false;
        return true;
      }).sort((a, b) => (Math.abs(a.x - p.x) + Math.abs(a.y - p.y)) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)));
      const e = alvos[0];
      if (!e) return { ok: false, mensagem: "Nenhum inimigo alinhado e desimpedido até 8 casas. Posicione-se na mesma linha, coluna ou diagonal." };
      p.inventario.splice(flechaIndex, 1);
      this.estado[id].proximaRegen = Date.now() + TEMPO_REGEN;
      p.habilidades.distancia++;
      const dano = 15 + (p.nivel - 1) * 4 + bonusArco(p) + bonusHabilidade(p, "distancia");
      const r = this.resolverDano(id, e, dano);
      r.mensagem = r.derrotado
        ? `Você atingiu ${e.nome.toLowerCase()} com uma flecha! ${r.mensagem}`
        : `Você atingiu ${e.nome.toLowerCase()} à distância (${dano} de dano). ${r.mensagem}`;
      Storage.salvar(p);
      return r;
    }
    if (comando.tipo === "atacar") {
      const e = comando.alvoId ? inimigos[comando.alvoId] : Object.values(inimigos).find((x) => x.area === p.area && this.inimigoVivo(p, x.id) && Math.abs(p.x - x.x) + Math.abs(p.y - x.y) === 1);
      if (!e || e.area !== p.area) return { ok: false, mensagem: "Não há inimigos por perto." };
      if (!this.inimigoVivo(p, e.id)) return { ok: false, mensagem: "Esse inimigo já foi derrotado." };
      if (Math.max(Math.abs(p.x - e.x), Math.abs(p.y - e.y)) !== 1) return { ok: false, mensagem: `Chegue ao lado de ${e.nome.toLowerCase()} para atacá-lo.` };
      this.estado[id].proximaRegen = Date.now() + TEMPO_REGEN;
      p.habilidades.corpo++;
      const dano = 10 + (p.nivel - 1) * 4 + bonusArma(p) + bonusHabilidade(p, "corpo");
      return this.resolverDano(id, e, dano);
    }
    return { ok: false };
  },
  interagirEliabe(id) {
    const p = this.jogadores[id], m1 = p.missaoEliabe, m2 = p.missaoErvas;
    if (m1.status === "nao_iniciada") { m1.status = "em_andamento"; Storage.salvar(p); return { ok: true, mensagem: "Eliabe: Um lobo ameaça os viajantes. Derrote-o e volte para falar comigo." }; }
    if (m1.status === "em_andamento" && m1.loboDerrotado && !m1.recompensaRecebida) {
      const recompensas = ["pocao", "pocao", "espada_ferro"];
      if (!this.podeReceberComRemocao(p, recompensas)) return { ok: true, mensagem: "Eliabe: Sua mochila está cheia. Libere espaço para receber 2 poções e uma espada de ferro." };
      for (const item of recompensas) this.adicionarItem(p, item);
      m1.recompensaRecebida = true; m1.status = "concluida"; const niveis = adicionarXP(p, 50); Storage.salvar(p);
      return { ok: true, mensagem: `Eliabe: Obrigado! Receba 2 poções, uma espada de ferro (+12 dano) e 50 XP. Missão concluída!${niveis.length ? ` Você subiu para o nível ${p.nivel}!` : ""}` };
    }
    if (m1.status === "em_andamento") return { ok: true, mensagem: "Eliabe: Ainda precisamos derrotar o lobo. Encontre-o e volte quando conseguir." };
    if (m2.status === "bloqueada") {
      m2.status = "em_andamento"; m2.ervasMissaoColetadas = [];
      // Esta missão pede três ervas novas; as plantas reaparecem, sem apagar as ervas do inventário.
      p.ervasColetadas = [];
      for (const planta of ervas) p.ervasRespawn[planta.id] = Date.now();
      Storage.salvar(p); return { ok: true, missaoErvasIniciada: true, mensagem: "Eliabe: Preciso de 3 ervas medicinais. As folhas foram repostas; colete três e volte." };
    }
    if (m2.status === "em_andamento") {
      const count = m2.ervasMissaoColetadas.length;
      if (count >= QUANTIDADE_ERVAS_MISSAO) {
        const recompensas = ["pocao", "pocao"];
        if (!this.podeReceberComRemocao(p, recompensas, [["erva", QUANTIDADE_ERVAS_MISSAO]])) return { ok: true, mensagem: "Eliabe: Sua mochila está cheia. Libere espaço para receber as poções." };
        this.removerItens(p, "erva", QUANTIDADE_ERVAS_MISSAO); for (const item of recompensas) this.adicionarItem(p, item);
        m2.recompensaRecebida = true; m2.status = "concluida"; const niveis = adicionarXP(p, 80); Storage.salvar(p);
        return { ok: true, mensagem: `Eliabe: Excelente! Receba 2 poções e 80 XP. Missão concluída!${niveis.length ? ` Você subiu para o nível ${p.nivel}!` : ""}` };
      }
      return { ok: true, mensagem: `Eliabe: Ainda faltam ervas. Você coletou ${count}/${QUANTIDADE_ERVAS_MISSAO} para esta missão.` };
    }
    return { ok: true, mensagem: "Eliabe: Obrigado por ajudar os viajantes. Você concluiu as tarefas de Canaã." };
  },
  interagirNoemi(id) {
    const p = this.jogadores[id], m = p.missaoDeserto;
    if (m.status === "bloqueada") {
      m.status = "em_andamento"; m.etapa = 1; m.odresMissaoColetados = [];
      p.odresColetados = [];
      for (const odre of odres) p.odresRespawn[odre.id] = Date.now();
      Storage.salvar(p); return { ok:true, missaoDesertoIniciada:true, mensagem:"Noemi: A caravana precisa de água. Encontre 3 odres espalhados pelo deserto e traga-os para mim." };
    }
    if (m.status === "em_andamento" && m.etapa === 1) {
      const count=m.odresMissaoColetados.length;
      if(count<3) return {ok:true,mensagem:`Noemi: Ainda faltam odres. Você encontrou ${count}/3.`};
      const recompensas=["pocao","pocao","armadura_couro","arco_madeira",...Array(8).fill("flecha")];
      if(!this.podeReceberComRemocao(p,recompensas,[["odre_agua",3]])) return {ok:true,mensagem:"Noemi: Sua mochila está cheia. Libere espaço para receber poções, armadura, arco e flechas."};
      this.removerItens(p,"odre_agua",3); for(const item of recompensas)this.adicionarItem(p,item);
      m.etapa=2;m.venenosMissaoColetados=[];const niveis=adicionarXP(p,100);Storage.salvar(p);
      return {ok:true,mensagem:`Noemi: A água salvou a caravana! Receba 2 poções, armadura, arco, 8 flechas e 100 XP. Agora derrote o escorpião e traga 2 amostras do veneno. Próxima etapa!${niveis.length?` Nível ${p.nivel}!`:""}`};
    }
    if(m.status==="em_andamento"&&m.etapa===2){
      const count=m.venenosMissaoColetados.length;
      if(count<2)return {ok:true,mensagem:`Noemi: Encontre o escorpião e pegue o veneno que ele deixa. Amostras: ${count}/2.`};
      this.removerItens(p,"veneno_escorpiao",2);m.etapa=3;m.insigniasMissaoColetadas=[];p.moedas+=25;const niveis=adicionarXP(p,100);Storage.salvar(p);
      return {ok:true,mensagem:`Noemi: Ótimo trabalho. Receba 25 moedas e 100 XP. Os saqueadores ameaçam o acampamento: derrote o chefe e traga a insígnia dele. Etapa final!${niveis.length?` Nível ${p.nivel}!`:""}`};
    }
    if(m.status==="em_andamento"&&m.etapa===3){
      const count=m.insigniasMissaoColetadas.length;
      if(count<1)return {ok:true,mensagem:"Noemi: Encontre o chefe dos saqueadores no deserto, derrote-o e traga a insígnia que ele deixar."};
      this.removerItens(p,"insignia_bandido",1);m.etapa=4;m.status="concluida";m.recompensaRecebida=true;p.moedas+=100;const niveis=adicionarXP(p,180);Storage.salvar(p);
      return {ok:true,mensagem:`Noemi: A caravana está segura! Receba 100 moedas e 180 XP. Capítulo do Deserto concluído!${niveis.length?` Nível ${p.nivel}!`:""}`};
    }
    return {ok:true,mensagem:"Noemi: A caravana está segura graças a você. Obrigada, viajante."};
  },
  removerItens(p, item, quantidade) {
    let restante = quantidade;
    p.inventario = p.inventario.filter((x) => { if (x === item && restante > 0) { restante--; return false; } return true; });
  },
  criarSaque(p, e) {
    const agora=Date.now(), itens=e.id==="lobo1"?["pele_lobo"]:e.id==="escorpiao1"?["veneno_escorpiao"]:e.id==="bandido1"?["insignia_bandido"]:[];
    const moedas=e.id==="lobo1"?4:e.id==="escorpiao1"?8:15;
    for(let i=0;i<itens.length;i++)p.saqueNoChao.push({id:`saque_${e.id}_${agora}_${i}`,area:e.area,x:e.x,y:e.y,item:itens[i]});
    p.saqueNoChao.push({id:`saque_${e.id}_${agora}_moedas`,area:e.area,x:e.x,y:e.y,moedas});
    return [...itens,`${moedas} moedas`];
  },
  resolverDano(id, e, dano) {
    const p = this.jogadores[id];
    p.vidaInimigos[e.id] = Math.max(0, p.vidaInimigos[e.id] - dano);
    if (p.vidaInimigos[e.id] === 0) {
      if (!p.inimigosDerrotados.includes(e.id)) p.inimigosDerrotados.push(e.id);
      if (e.id === "lobo1" && p.missaoEliabe.status === "em_andamento") p.missaoEliabe.loboDerrotado = true;
      const niveis = adicionarXP(p, e.xpRecompensa);
      const saque = this.criarSaque(p, e);
      Storage.salvar(p);
      const up = niveis.length ? ` Você subiu para o nível ${p.nivel}! Vida máxima: ${vidaMaxima(p)}.` : "";
      const textoSaque = saque.length ? ` Saque no chão: ${saque.join(", ")}. Clique no saque ao lado ou caminhe sobre ele para pegá-lo.` : "";
      return { ok: true, derrotado: true, danoAplicado: dano, inimigoId: e.id, saques: p.saqueNoChao.filter((s) => s.area === p.area && s.x === e.x && s.y === e.y).map((s) => s.id), mensagem: `Você derrotou ${e.nome.toLowerCase()}! +${e.xpRecompensa} XP.${up}${textoSaque} Ele reaparecerá em 5 segundos.` };
    }
    Storage.salvar(p);
    return { ok: true, derrotado: false, danoAplicado: dano, inimigoId: e.id, mensagem: `Você acertou ${e.nome.toLowerCase()}! Vida dele: ${p.vidaInimigos[e.id]}/${e.vidaMaxima}.` };
  },
};
