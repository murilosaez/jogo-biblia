const TILE = 32;
const COLS = 25;
const ROWS = 18;
const VERSAO_SAVE = 2;
const VIDA_BASE = 100;
const TEMPO_REGEN = 10000;
const INTERVALO_MOVIMENTO = 600;
const INTERVALO_ATAQUE = 1200;
const TEMPO_RESPAWN_INIMIGO = 5000;
const CURA_POCAO = 30;
const QUANTIDADE_POCOES_INICIAIS = 3;
const QUANTIDADE_ERVAS_MISSAO = 3;
const QUANTIDADE_ODRES_MISSAO = 3;
const RECOMPENSA_MISSAO_POCOES = 2;
const XP_NIVEIS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];

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
  canaan: { id: "canaan", nome: "Canaã", passagem: { x: 22, y: 15 }, chegada: { x: 21, y: 15 } },
  deserto: { id: "deserto", nome: "Deserto", passagem: { x: 2, y: 15 }, chegada: { x: 3, y: 15 } },
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
        if (y === 15 && x >= 1 && x <= 5) obstaculo = false;
      }
      mapa[y][x] = borda || obstaculo ? 1 : 0;
    }
  }
  return mapa;
}
const mapas = { canaan: criarMapa("canaan"), deserto: criarMapa("deserto") };
const npcs = {
  viajante1: { id: "viajante1", nome: "Eliabe", area: "canaan", x: 2, y: 5 },
  noemi1: { id: "noemi1", nome: "Noemi", area: "deserto", x: 20, y: 4 },
};
const ervas = [
  { id: "erva1", x: 9, y: 4 }, { id: "erva2", x: 14, y: 9 }, { id: "erva3", x: 20, y: 13 },
];
const odres = [
  { id: "odre1", x: 7, y: 5 }, { id: "odre2", x: 13, y: 8 }, { id: "odre3", x: 18, y: 12 },
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
    if (!p || typeof p !== "object") p = { id, area: "canaan", x: 2, y: 2, vida: VIDA_BASE, inventario: [], itensIniciaisEntregues: false, inimigosDerrotados: [], vidaInimigos: {}, ervasColetadas: [], odresColetados: [], xp: 0, nivel: 1 };
    p.id = id;
    if (!Array.isArray(p.inventario)) p.inventario = [];
    for (const chave of ["inimigosDerrotados", "ervasColetadas", "odresColetados"]) if (!Array.isArray(p[chave])) p[chave] = [];
    if (!p.vidaInimigos || typeof p.vidaInimigos !== "object") p.vidaInimigos = {};
    if (!areas[p.area]) { p.area = "canaan"; p.x = 2; p.y = 2; }
    p.nivel = Number.isInteger(p.nivel) ? Math.max(1, Math.min(20, p.nivel)) : 1;
    p.xp = Number.isFinite(p.xp) ? Math.max(0, p.xp) : 0;
    const maxVida = vidaMaxima(p);
    p.vida = Number.isFinite(p.vida) ? Math.max(0, Math.min(p.vida, maxVida)) : maxVida;
    if (p.vida <= 0) { p.area = "canaan"; p.x = 2; p.y = 2; p.vida = maxVida; }
    if (!p.itensIniciaisEntregues) { for (let i = 0; i < QUANTIDADE_POCOES_INICIAIS; i++) p.inventario.push("pocao"); p.itensIniciaisEntregues = true; }
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
          p.vida = Math.max(0, p.vida - e.danoContraJogador);
          if (p.vida === 0) {
            p.area = "canaan"; p.x = 2; p.y = 2; p.vida = vidaMaxima(p);
            for (const outro of Object.values(inimigos)) if (this.inimigoVivo(p, outro.id)) { outro.x = outro.inicioX; outro.y = outro.inicioY; outro.proximoAtaque = 0; outro.proximoMovimento = 0; p.vidaInimigos[outro.id] = outro.vidaMaxima; }
            Storage.salvar(p); eventos.push({ tipo: "renasceu", mensagem: "Você foi derrotado e voltou ao início de Canaã com a vida restaurada. Seu nível, inventário e missões foram preservados." }); return eventos;
          }
          Storage.salvar(p); eventos.push({ tipo: "jogadorAtingido", mensagem: `${e.nome} atingiu você! Vida: ${p.vida}/${vidaMaxima(p)}.` });
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
      if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1) return { ok: false };
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
      if (p.area === "canaan") {
        const item = ervas.find((x) => x.x === nx && x.y === ny && !p.ervasColetadas.includes(x.id));
        if (item) {
          p.ervasColetadas.push(item.id); p.inventario.push("erva");
          if (p.missaoErvas.status === "em_andamento" && !p.missaoErvas.ervasMissaoColetadas.includes(item.id)) p.missaoErvas.ervasMissaoColetadas.push(item.id);
          Storage.salvar(p); return { ok: true, itemColetado: item.id, mensagem: "Você coletou uma erva medicinal." };
        }
      } else {
        const item = odres.find((x) => x.x === nx && x.y === ny && !p.odresColetados.includes(x.id));
        if (item) {
          p.odresColetados.push(item.id); p.inventario.push("odre_agua");
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
    if (comando.tipo === "usarPocao") {
      const i = p.inventario.indexOf("pocao");
      if (i < 0) return { ok: false, mensagem: "Você não tem poções." };
      if (p.vida >= vidaMaxima(p)) return { ok: false, mensagem: "Sua vida já está cheia. A poção não foi consumida." };
      p.inventario.splice(i, 1); const antes = p.vida; p.vida = Math.min(vidaMaxima(p), p.vida + CURA_POCAO);
      this.estado[id].proximaRegen = Date.now() + TEMPO_REGEN; Storage.salvar(p);
      return { ok: true, mensagem: `Você usou uma poção e recuperou ${p.vida - antes} de vida. Vida: ${p.vida}/${vidaMaxima(p)}.` };
    }
    if (comando.tipo === "atacar") {
      const e = comando.alvoId ? inimigos[comando.alvoId] : Object.values(inimigos).find((x) => x.area === p.area && this.inimigoVivo(p, x.id) && Math.abs(p.x - x.x) + Math.abs(p.y - x.y) === 1);
      if (!e || e.area !== p.area) return { ok: false, mensagem: "Não há inimigos por perto." };
      if (!this.inimigoVivo(p, e.id)) return { ok: false, mensagem: "Esse inimigo já foi derrotado." };
      if (Math.abs(p.x - e.x) + Math.abs(p.y - e.y) !== 1) return { ok: false, mensagem: `Chegue ao lado de ${e.nome.toLowerCase()} para atacá-lo.` };
      this.estado[id].proximaRegen = Date.now() + TEMPO_REGEN;
      const dano = e.danoDoAtaque + (p.nivel - 1) * 5;
      p.vidaInimigos[e.id] = Math.max(0, p.vidaInimigos[e.id] - dano);
      if (p.vidaInimigos[e.id] === 0) {
        if (!p.inimigosDerrotados.includes(e.id)) p.inimigosDerrotados.push(e.id);
        if (e.id === "lobo1" && p.missaoEliabe.status === "em_andamento") p.missaoEliabe.loboDerrotado = true;
        const niveis = adicionarXP(p, e.xpRecompensa);
        Storage.salvar(p);
        const up = niveis.length ? ` Você subiu para o nível ${p.nivel}! Vida máxima: ${vidaMaxima(p)}.` : "";
        return { ok: true, derrotado: true, inimigoId: e.id, mensagem: `Você derrotou ${e.nome.toLowerCase()}! +${e.xpRecompensa} XP.${up} Ele reaparecerá em 5 segundos.` };
      }
      Storage.salvar(p); return { ok: true, derrotado: false, inimigoId: e.id, mensagem: `Você acertou ${e.nome.toLowerCase()}! Vida dele: ${p.vidaInimigos[e.id]}/${e.vidaMaxima}.` };
    }
    return { ok: false };
  },
  interagirEliabe(id) {
    const p = this.jogadores[id], m1 = p.missaoEliabe, m2 = p.missaoErvas;
    if (m1.status === "nao_iniciada") { m1.status = "em_andamento"; Storage.salvar(p); return { ok: true, mensagem: "Eliabe: Um lobo ameaça os viajantes. Derrote-o e volte para falar comigo." }; }
    if (m1.status === "em_andamento" && m1.loboDerrotado && !m1.recompensaRecebida) {
      for (let i = 0; i < RECOMPENSA_MISSAO_POCOES; i++) p.inventario.push("pocao");
      m1.recompensaRecebida = true; m1.status = "concluida"; const niveis = adicionarXP(p, 50); Storage.salvar(p);
      return { ok: true, mensagem: `Eliabe: Obrigado! Receba 2 poções e 50 XP. Missão concluída!${niveis.length ? ` Você subiu para o nível ${p.nivel}!` : ""}` };
    }
    if (m1.status === "em_andamento") return { ok: true, mensagem: "Eliabe: Ainda precisamos derrotar o lobo. Encontre-o e volte quando conseguir." };
    if (m2.status === "bloqueada") {
      m2.status = "em_andamento"; m2.ervasMissaoColetadas = [];
      // Esta missão pede três ervas novas; as plantas reaparecem, sem apagar as ervas do inventário.
      p.ervasColetadas = p.ervasColetadas.filter((idErva) => !ervas.some((x) => x.id === idErva));
      Storage.salvar(p); return { ok: true, mensagem: "Eliabe: Preciso de 3 ervas medicinais. As plantas reapareceram pelo caminho; colete três novas e volte." };
    }
    if (m2.status === "em_andamento") {
      const count = m2.ervasMissaoColetadas.length;
      if (count >= QUANTIDADE_ERVAS_MISSAO) {
        this.removerItens(p, "erva", QUANTIDADE_ERVAS_MISSAO); for (let i = 0; i < RECOMPENSA_MISSAO_POCOES; i++) p.inventario.push("pocao");
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
      Storage.salvar(p); return { ok: true, mensagem: "Noemi: A caravana precisa de água. Encontre 3 odres pelo deserto e traga-os para mim." };
    }
    if (m.status === "em_andamento") {
      const count = m.odresMissaoColetados.length;
      if (count >= QUANTIDADE_ODRES_MISSAO) {
        this.removerItens(p, "odre_agua", QUANTIDADE_ODRES_MISSAO); for (let i = 0; i < RECOMPENSA_MISSAO_POCOES; i++) p.inventario.push("pocao");
        m.status = "concluida"; m.recompensaRecebida = true; const niveis = adicionarXP(p, 100); Storage.salvar(p);
        return { ok: true, mensagem: `Noemi: Água para a caravana! Receba 2 poções e 100 XP. Missão concluída!${niveis.length ? ` Você subiu para o nível ${p.nivel}!` : ""}` };
      }
      return { ok: true, mensagem: `Noemi: Ainda faltam odres. Você encontrou ${count}/${QUANTIDADE_ODRES_MISSAO}.` };
    }
    return { ok: true, mensagem: "Noemi: Obrigada por ajudar a caravana. A água será bem aproveitada." };
  },
  removerItens(p, item, quantidade) {
    let restante = quantidade;
    p.inventario = p.inventario.filter((x) => { if (x === item && restante > 0) { restante--; return false; } return true; });
  },
};
