const TILE = 32;
const COLS = 80;
const ROWS = 60;
const VERSAO_SAVE = 3;
const VIDA_BASE = 100;
const TEMPO_REGEN = 10000;
const INTERVALO_MOVIMENTO = 600;
const INTERVALO_ATAQUE = 1200;
const INTERVALO_AUTO_ATAQUE = 2000;
const TEMPO_RESPAWN_INIMIGO = 5000;
const TEMPO_RESPAWN_COLETAVEL = 18000;
const CURA_POCAO = 30;
const QUANTIDADE_POCOES_INICIAIS = 3;
const QUANTIDADE_ERVAS_MISSAO = 3;
const QUANTIDADE_ODRES_MISSAO = 3;
const RECOMPENSA_MISSAO_POCOES = 2;
const XP_NIVEIS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];
const CARGA_BASE = 50;
const CARGA_POR_NIVEL = 10;
const ITENS = {
  pocao: { nome: "Poção", peso: 1, tipo: "consumivel" },
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
};
const SLOTS_EQUIPAMENTO = { arma: "arma", arco: "arma_distancia", escudo: "escudo", armadura: "armadura" };
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

function vidaMaxima(personagem) { return VIDA_BASE + Math.max(0, (personagem.nivel || 1) - 1) * 10; }
function limiarNivel(nivel) {
  if (nivel < XP_NIVEIS.length) return XP_NIVEIS[nivel];
  return XP_NIVEIS[XP_NIVEIS.length - 1] + (nivel - XP_NIVEIS.length + 1) * 650;
}
function adicionarXP(personagem, quantidade) {
  personagem.xp = Math.max(0, (personagem.xp || 0) + quantidade);
  const niveis = [];
  while (personagem.nivel < 20 && personagem.xp >= limiarNivel(personagem.nivel)) {
    personagem.nivel += 1;
    personagem.vida = vidaMaxima(personagem);
    niveis.push(personagem.nivel);
  }
  return niveis;
}

const areas = {
  canaan: { id: "canaan", nome: "Canaã", passagem: { x: 77, y: 56 }, chegada: { x: 75, y: 56 } },
  deserto: { id: "deserto", nome: "Deserto", passagem: { x: 2, y: 56 }, chegada: { x: 4, y: 56 } },
};

function criarMapa(areaId) {
  const mapa = [];
  for (let y = 0; y < ROWS; y++) {
    mapa[y] = [];
    for (let x = 0; x < COLS; x++) {
      const borda = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      let obstaculo = false;
      if (areaId === "canaan") obstaculo = x % 6 === 3 && y % 4 === 2;
      else {
        obstaculo = (x * 7 + y * 11) % 23 === 0;
        if (y === ROWS - 4 && x >= 1 && x <= 5) obstaculo = false;
      }
      mapa[y][x] = borda || obstaculo ? 1 : 0;
    }
  }
  return mapa;
}
const mapas = { canaan: criarMapa("canaan"), deserto: criarMapa("deserto") };
const npcs = {
  viajante1: { id: "viajante1", nome: "Eliabe", area: "canaan", x: 2, y: 5 },
  noemi1: { id: "noemi1", nome: "Noemi", area: "deserto", x: 68, y: 8 },
};
const ervas = [
  { id: "erva1", x: 13, y: 12 }, { id: "erva2", x: 41, y: 31 }, { id: "erva3", x: 71, y: 49 },
];
const odres = [
  { id: "odre1", x: 11, y: 48 }, { id: "odre2", x: 39, y: 34 }, { id: "odre3", x: 70, y: 15 },
];
const inimigos = {
  lobo1: { id: "lobo1", nome: "Lobo", area: "canaan", x: 6, y: 5, inicioX: 6, inicioY: 5, vidaMaxima: 50, danoDoAtaque: 25, danoContraJogador: 8, raioPercepcao: 6, xpRecompensa: 40, proximoMovimento: 0, proximoAtaque: 0 },
  escorpiao1: { id: "escorpiao1", nome: "Escorpião", area: "deserto", x: 16, y: 9, inicioX: 16, inicioY: 9, vidaMaxima: 70, danoDoAtaque: 20, danoContraJogador: 12, raioPercepcao: 5, xpRecompensa: 60, proximoMovimento: 0, proximoAtaque: 0 },
};
// Espaços garantidamente transitáveis para personagens, inimigos, itens e passagens.
for (const npc of Object.values(npcs)) mapas[npc.area][npc.y][npc.x] = 0;
for (const inimigo of Object.values(inimigos)) mapas[inimigo.area][inimigo.y][inimigo.x] = 0;
for (const item of [...ervas, ...odres]) mapas[item.id.startsWith("erva") ? "canaan" : "deserto"][item.y][item.x] = 0;
for (const [areaId, area] of Object.entries(areas)) {
  mapas[areaId][area.passagem.y][area.passagem.x] = 0;
  mapas[areaId][area.chegada.y][area.chegada.x] = 0;
}
mapas.canaan[2][2] = 0;

function missaoEliabeNova() { return { status: "nao_iniciada", loboDerrotado: false, recompensaRecebida: false }; }
function missaoErvasNova() { return { status: "bloqueada", recompensaRecebida: false, ervasMissaoColetadas: [] }; }
function missaoDesertoNova() { return { status: "bloqueada", recompensaRecebida: false, odresMissaoColetados: [] }; }

const Mundo = {
  jogadores: {}, estado: {},
  entrar(id) {
    let p = Storage.carregar(id);
    if (!p || typeof p !== "object") p = { id, area: "canaan", x: 2, y: 2, vida: VIDA_BASE, inventario: [], itensIniciaisEntregues: false, inimigosDerrotados: [], vidaInimigos: {}, ervasColetadas: [], odresColetados: [], ervasRespawn: {}, odresRespawn: {}, xp: 0, nivel: 1 };
    p.id = id;
    if (!Array.isArray(p.inventario)) p.inventario = [];
    if (!p.equipamento || typeof p.equipamento !== "object") p.equipamento = { arma: null, arco: null, escudo: null, armadura: null };
    for (const slot of Object.keys(SLOTS_EQUIPAMENTO)) if (!(slot in p.equipamento)) p.equipamento[slot] = null;
    if (!Array.isArray(p.hotkeys)) p.hotkeys = ["pocao", null, null, null, null, null];
    p.hotkeys = Array.from({ length: 6 }, (_, i) => p.hotkeys[i] || null);
    if (!Array.isArray(p.saqueNoChao)) p.saqueNoChao = [];
    p.saqueNoChao = p.saqueNoChao.filter((s) => s && typeof s.id === "string" && areas[s.area] && Number.isInteger(s.x) && Number.isInteger(s.y) && ITENS[s.item]);
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
    if (!p.vidaInimigos || typeof p.vidaInimigos !== "object") p.vidaInimigos = {};
    if (!areas[p.area]) { p.area = "canaan"; p.x = 2; p.y = 2; }
    p.nivel = Number.isInteger(p.nivel) ? Math.max(1, Math.min(20, p.nivel)) : 1;
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
    if (!Array.isArray(p.missaoDeserto.odresMissaoColetados)) p.missaoDeserto.odresMissaoColetados = [];
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
          const defesaTotal = defesaEquipamento(p);
          const danoReal = Math.max(1, e.danoContraJogador - defesaTotal);
          p.vida = Math.max(0, p.vida - danoReal);
          if (p.vida === 0) {
            p.area = "canaan"; p.x = 2; p.y = 2; p.vida = vidaMaxima(p);
            for (const outro of Object.values(inimigos)) if (this.inimigoVivo(p, outro.id)) { outro.x = outro.inicioX; outro.y = outro.inicioY; outro.proximoAtaque = 0; outro.proximoMovimento = 0; p.vidaInimigos[outro.id] = outro.vidaMaxima; }
            Storage.salvar(p); eventos.push({ tipo: "renasceu", mensagem: "Você foi derrotado e voltou ao início de Canaã com a vida restaurada. Seu nível, inventário e missões foram preservados." }); return eventos;
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
      const passage = areas[p.area].passagem;
      if (nx === passage.x && ny === passage.y) {
        const next = p.area === "canaan" ? "deserto" : "canaan";
        p.area = next; p.x = areas[next].chegada.x; p.y = areas[next].chegada.y; Storage.salvar(p);
        return { ok: true, areaAlterada: true, mensagem: `Você chegou a ${areas[next].nome}.` };
      }
      const saqueNoPiso = p.saqueNoChao.find((s) => s.area === p.area && s.x === nx && s.y === ny);
      if (saqueNoPiso) {
        if (!this.adicionarItem(p, saqueNoPiso.item)) return { ok: true, mensagem: `Mochila cheia (${pesoCarregado(p)}/${capacidadeCarga(p)} kg). O saque continua no chão.` };
        p.saqueNoChao = p.saqueNoChao.filter((s) => s.id !== saqueNoPiso.id);
        Storage.salvar(p);
        return { ok: true, itemColetado: saqueNoPiso.id, mensagem: `Você pegou: ${nomeItem(saqueNoPiso.item)}.` };
      }
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
          if (p.missaoDeserto.status === "em_andamento" && !p.missaoDeserto.odresMissaoColetados.includes(item.id)) p.missaoDeserto.odresMissaoColetados.push(item.id);
          Storage.salvar(p); return { ok: true, itemColetado: item.id, mensagem: "Você encontrou um odre de água." };
        }
      }
      Storage.salvar(p); return { ok: true };
    }
    if (comando.tipo === "interagir") {
      const npc = comando.alvoId ? npcs[comando.alvoId] : Object.values(npcs).find((n) => n.area === p.area && Math.abs(p.x - n.x) + Math.abs(p.y - n.y) <= 1);
      if (!npc || npc.area !== p.area) return { ok: false, mensagem: "Não há ninguém por perto para conversar." };
      if (Math.abs(p.x - npc.x) + Math.abs(p.y - npc.y) > 1) return { ok: false, mensagem: "Chegue mais perto para conversar." };
      if (npc.id === "viajante1") return this.interagirEliabe(id);
      if (npc.id === "noemi1") return this.interagirNoemi(id);
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
        if ((!mesmaLinha && !mesmaColuna && !diagonal) || distancia < 1 || distancia > 5) return false;
        const dx = Math.sign(e.x - p.x), dy = Math.sign(e.y - p.y);
        for (let passo = 1; passo < distancia; passo++) if (mapas[p.area][p.y + dy * passo][p.x + dx * passo] !== 0) return false;
        return true;
      }).sort((a, b) => (Math.abs(a.x - p.x) + Math.abs(a.y - p.y)) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)));
      const e = alvos[0];
      if (!e) return { ok: false, mensagem: "Nenhum inimigo alinhado e desimpedido até 5 casas. Posicione-se na mesma linha, coluna ou diagonal." };
      p.inventario.splice(flechaIndex, 1);
      this.estado[id].proximaRegen = Date.now() + TEMPO_REGEN;
      const dano = 15 + (p.nivel - 1) * 5 + bonusArco(p);
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
      const dano = e.danoDoAtaque + (p.nivel - 1) * 5 + bonusArma(p);
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
      m.status = "em_andamento"; m.odresMissaoColetados = [];
      p.odresColetados = [];
      for (const odre of odres) p.odresRespawn[odre.id] = Date.now();
      Storage.salvar(p); return { ok: true, missaoDesertoIniciada: true, mensagem: "Noemi: A caravana precisa de água. Encontre 3 odres pelo deserto e traga-os para mim." };
    }
    if (m.status === "em_andamento") {
      const count = m.odresMissaoColetados.length;
      if (count >= QUANTIDADE_ODRES_MISSAO) {
        const recompensas = ["pocao", "pocao", "armadura_couro", "arco_madeira", ...Array(8).fill("flecha")];
        if (!this.podeReceberComRemocao(p, recompensas, [["odre_agua", QUANTIDADE_ODRES_MISSAO]])) return { ok: true, mensagem: "Noemi: Sua mochila está cheia. Libere espaço para receber as poções, armadura, arco e flechas." };
        this.removerItens(p, "odre_agua", QUANTIDADE_ODRES_MISSAO); for (const item of recompensas) this.adicionarItem(p, item);
        m.status = "concluida"; m.recompensaRecebida = true; p.atualizacaoDistanciaEntregue = true; const niveis = adicionarXP(p, 100); Storage.salvar(p);
        return { ok: true, mensagem: `Noemi: Água para a caravana! Receba 2 poções, armadura de couro (+5 defesa), arco de madeira (+10 dano à distância), 8 flechas e 100 XP. Missão concluída!${niveis.length ? ` Você subiu para o nível ${p.nivel}!` : ""}` };
      }
      return { ok: true, mensagem: `Noemi: Ainda faltam odres. Você encontrou ${count}/${QUANTIDADE_ODRES_MISSAO}.` };
    }
    return { ok: true, mensagem: "Noemi: Obrigada por ajudar a caravana. A água será bem aproveitada." };
  },
  removerItens(p, item, quantidade) {
    let restante = quantidade;
    p.inventario = p.inventario.filter((x) => { if (x === item && restante > 0) { restante--; return false; } return true; });
  },
  criarSaque(p, e) {
    const itens = e.id === "lobo1" ? ["pele_lobo"] : e.id === "escorpiao1" ? ["flecha", "flecha"] : [];
    const agora = Date.now();
    for (let i = 0; i < itens.length; i++) {
      p.saqueNoChao.push({ id: `saque_${e.id}_${agora}_${i}`, area: e.area, x: e.x, y: e.y, item: itens[i] });
    }
    return itens;
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
      const textoSaque = saque.length ? ` Saque no chão: ${saque.map(nomeItem).join(", ")}.` : "";
      return { ok: true, derrotado: true, danoAplicado: dano, inimigoId: e.id, saques: p.saqueNoChao.filter((s) => s.area === p.area && s.x === e.x && s.y === e.y).map((s) => s.id), mensagem: `Você derrotou ${e.nome.toLowerCase()}! +${e.xpRecompensa} XP.${up}${textoSaque} Ele reaparecerá em 5 segundos.` };
    }
    Storage.salvar(p);
    return { ok: true, derrotado: false, danoAplicado: dano, inimigoId: e.id, mensagem: `Você acertou ${e.nome.toLowerCase()}! Vida dele: ${p.vidaInimigos[e.id]}/${e.vidaMaxima}.` };
  },
};
