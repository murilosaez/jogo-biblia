// =====================================================================
// interface.js — INTERFACE (DOM): painéis, barras, mochila, equipamento,
// atalhos, lista de batalha, missão, avisos, registro, diálogo, modais
// (loja, viagem, oração, ajuda), minimapa (posição), controles de toque.
//
// Guia de estilo §9 ("Iluminura viva"). Toda imagem vem de sprites.js
// (window.Arte / window.iconeItemURL). Nenhum emoji: sem Arte, os
// espaços mostram as duas primeiras letras do nome.
//
// Contrato:
//   consome  window.Jogo (game.js), Mundo/ITENS/... (logica.js, expansao.js)
//   expõe    window.UI + apelidos antigos (atualizarInterface, mostrarMensagem,
//            abrirLoja, abrirViagem, abrirOracao, alternarMinimapa)
// =====================================================================
(function () {
  "use strict";

  const ID = typeof MEU_ID !== "undefined" ? MEU_ID : "jogador1";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mm = (q) => typeof matchMedia === "function" && matchMedia(q).matches;
  const reduzMovimento = () => mm("(prefers-reduced-motion: reduce)");
  const jogador = () => (typeof Mundo !== "undefined" && Mundo.jogadores ? Mundo.jogadores[ID] : null) || null;
  const temArte = () => typeof Arte !== "undefined" && !!Arte;
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const inicioSessao = Date.now();

  // ------------------------------------------------------------------
  // Arte (com proteção: a UI funciona sem sprites.js, sem emoji)
  // ------------------------------------------------------------------
  function glifoURL(chave, escala = 2) {
    try { return temArte() ? Arte.iconeURL(chave, escala) || "" : ""; } catch (e) { return ""; }
  }
  function itemURL(id, escala = 2) {
    try { return typeof window.iconeItemURL === "function" ? window.iconeItemURL(id, escala) || "" : ""; } catch (e) { return ""; }
  }
  function silhuetaURL(id) {
    try { return temArte() ? Arte.silhuetaURL(id, "#2a1a14", 2) || "" : ""; } catch (e) { return ""; }
  }
  function retratoURL(chave, opcoes) {
    try { return temArte() && chave ? Arte.retratoURL(chave, opcoes) || "" : ""; } catch (e) { return ""; }
  }
  function visualDe(id) {
    try { return temArte() ? Arte.visualDe(id) : ""; } catch (e) { return ""; }
  }
  function nomeCurto(nome) {
    if (temArte() && Arte.nomeCurto) return Arte.nomeCurto(nome || "");
    return String(nome || "").split(/[,·]/)[0].trim();
  }
  const imgGlifo = (chave, cls = "px g16", alt = "") => {
    const url = glifoURL(chave, 2);
    return url ? `<img class="${cls}" src="${url}" alt="${esc(alt)}">` : "";
  };
  // Ícone de item: <img> pixelado, ou duas letras do nome (nunca emoji).
  function htmlItem(id, tam = 32) {
    const url = itemURL(id, 2);
    const nome = nomeDoItem(id);
    if (url) return `<img class="px" src="${url}" width="${tam}" height="${tam}" alt="${esc(nome)}">`;
    return `<span class="letras" aria-label="${esc(nome)}">${esc(nome.slice(0, 2))}</span>`;
  }
  function nomeDoItem(id) {
    if (id === "flechas") return `${typeof FLECHAS_POR_PACOTE !== "undefined" ? FLECHAS_POR_PACOTE : 5} flechas`;
    return typeof nomeItem === "function" ? nomeItem(id) : id;
  }

  function preencherGlifos(raiz = document) {
    for (const img of $$("img[data-glifo]", raiz)) {
      if (img.dataset.ok) continue;
      const url = glifoURL(img.dataset.glifo, Number(img.dataset.escala || 2));
      if (url) { img.src = url; img.dataset.ok = "1"; }
      if (img.dataset.rot) img.style.transform = `rotate(${img.dataset.rot}deg)`;
    }
    for (const img of $$("img[data-item]", raiz)) {
      if (img.dataset.ok) continue;
      const url = itemURL(img.dataset.item, 2);
      if (url) { img.src = url; img.dataset.ok = "1"; }
    }
  }

  function aplicarTexturas() {
    if (!temArte()) return;
    const raiz = document.documentElement.style;
    try {
      raiz.setProperty("--tex-couro", `url(${Arte.texturaURL("couro")})`);
      raiz.setProperty("--tex-perg", `url(${Arte.texturaURL("pergaminho")})`);
      raiz.setProperty("--moldura-bronze", `url(${Arte.molduraURL("bronze")})`);
    } catch (e) { /* mantém as cores sólidas de reserva */ }
  }

  // ------------------------------------------------------------------
  // Descrição de itens (dica, loja)
  // ------------------------------------------------------------------
  const NOME_TIPO = {
    consumivel: "Consumível", recurso: "Recurso", arma: "Arma corpo a corpo", arma_distancia: "Arco",
    escudo: "Escudo", armadura: "Armadura", municao: "Munição",
  };
  const ROTULO_SLOT = { arma: "Arma", arco: "Arco", escudo: "Escudo", armadura: "Armadura" };
  const SILHUETA_SLOT = { arma: "espada_ferro", arco: "arco_madeira", escudo: "escudo_madeira", armadura: "armadura_couro" };
  const slotDoTipo = (tipo) => {
    const mapa = typeof SLOTS_EQUIPAMENTO !== "undefined" ? SLOTS_EQUIPAMENTO : { arma: "arma", arco: "arma_distancia", escudo: "escudo", armadura: "armadura" };
    return Object.keys(mapa).find((s) => mapa[s] === tipo) || null;
  };

  function atributoItem(id, p = jogador()) {
    if (id === "flechas") return "munição para o arco";
    const d = typeof ITENS !== "undefined" ? ITENS[id] : null;
    if (!d) return "";
    if (d.bonus) return `+${d.bonus} de dano`;
    if (d.defesa) return `+${d.defesa} de defesa`;
    if (id === "pocao") return `cura ${p && typeof curaPocao === "function" ? curaPocao(p) : 30} de vida`;
    if (id === "pocao_fe") return `+${typeof CURA_POCAO_FE !== "undefined" ? CURA_POCAO_FE : 40} de fé`;
    if (d.tipo === "municao") return "munição para o arco";
    if (typeof VALORES_VENDA !== "undefined" && VALORES_VENDA[id]) return `Azarias compra por ${VALORES_VENDA[id]}`;
    return NOME_TIPO[d.tipo] || "";
  }

  function atributoCurto(id) {
    const d = typeof ITENS !== "undefined" ? ITENS[id] : null;
    if (!d) return "";
    if (d.bonus) return `+${d.bonus} dano`;
    if (d.defesa) return `+${d.defesa} def`;
    return "";
  }

  function htmlDica(id, origem) {
    const d = typeof ITENS !== "undefined" ? ITENS[id] : null;
    if (!d) return "";
    const partes = [NOME_TIPO[d.tipo] || "Item", atributoItem(id), `${typeof pesoItem === "function" ? pesoItem(id) : d.peso} kg`].filter(Boolean);
    let acao = "";
    if (origem === "equip") acao = "Arraste para a mochila, ou dê duplo clique, para guardar.";
    else if (slotDoTipo(d.tipo)) acao = "Duplo clique equipa. Também pode arrastar ou tocar e escolher o espaço.";
    else if (d.tipo === "consumivel") acao = "Duplo clique usa. Arraste para uma tecla de atalho.";
    else if (typeof VALORES_VENDA !== "undefined" && VALORES_VENDA[id]) acao = "Venda ao mercador Azarias, no Deserto.";
    return `<h4>${esc(nomeDoItem(id))}</h4><p>${esc([...new Set(partes)].join(" · "))}</p>${acao ? `<p class="acao">${esc(acao)}</p>` : ""}`;
  }

  // ------------------------------------------------------------------
  // Barras
  // ------------------------------------------------------------------
  function definirBarra(el, atual, max, texto, extra) {
    if (!el) return;
    const pct = max > 0 ? Math.max(0, Math.min(100, (100 * atual) / max)) : 0;
    const i = el.firstElementChild, b = el.querySelector("b");
    if (i) i.style.width = pct.toFixed(1) + "%";
    if (b && b.textContent !== texto) b.textContent = texto;
    el.setAttribute("aria-valuenow", String(Math.round(atual)));
    el.setAttribute("aria-valuemax", String(max));
    el.setAttribute("aria-valuetext", texto);
    if (extra) for (const [k, v] of Object.entries(extra)) el.classList.toggle(k, !!v);
  }

  function xpDoNivel(p) {
    const nivel = p.nivel || 1;
    if (typeof limiarNivel !== "function") return { atual: 0, total: 1 };
    const base = nivel > 1 ? limiarNivel(nivel - 1) : 0;
    const topo = limiarNivel(nivel);
    return { atual: Math.max(0, (p.xp || 0) - base), total: Math.max(1, topo - base) };
  }

  function atualizarBarras(p) {
    const max = typeof vidaMaxima === "function" ? vidaMaxima(p) : 100;
    const baixa = p.vida / max < 0.25;
    const feMax = typeof FE_MAXIMA !== "undefined" ? FE_MAXIMA : 100;
    const xp = xpDoNivel(p);
    const travada = !p.oracaoDesbloqueada;
    const vidaTxt = `${p.vida}/${max}`;
    const feTxt = travada ? "aprenda na Galileia" : `${p.fe || 0}/${feMax}`;
    const xpTxt = `${xp.atual}/${xp.total} XP`;
    definirBarra($("#barraVida"), p.vida, max, vidaTxt, { baixa });
    definirBarra($("#barraFe"), travada ? 0 : p.fe || 0, feMax, feTxt, { travada });
    definirBarra($("#barraXp"), xp.atual, xp.total, xpTxt);
    definirBarra($("#hudVida"), p.vida, max, vidaTxt, { baixa });
    definirBarra($("#hudFe"), travada ? 0 : p.fe || 0, feMax, feTxt, { travada });
    definirBarra($("#hudXp"), xp.atual, xp.total, xpTxt);
    $("#hudVidaTxt").textContent = vidaTxt;
    $("#hudFeTxt").textContent = travada ? "—" : `${p.fe || 0}`;
    $("#hudXpTxt").textContent = `Nv ${p.nivel}`;
    const env = (p.envenenadoAte || 0) > Date.now();
    document.body.classList.toggle("envenenado", env);
  }

  // ------------------------------------------------------------------
  // Personagem
  // ------------------------------------------------------------------
  let assinaturaRetrato = "";
  function atualizarPersonagem(p) {
    $("#seloNivel").textContent = p.nivel;
    $("#fichaNivel").textContent = `Nível ${p.nivel}`;
    const eq = p.equipamento || {};
    const ass = JSON.stringify(eq);
    if (ass !== assinaturaRetrato && temArte()) {
      assinaturaRetrato = ass;
      let chave = "pj_jogador";
      try { chave = Arte.garantirJogador ? Arte.garantirJogador(eq) : chave; } catch (e) { chave = "pj_jogador"; }
      const url = retratoURL(chave, { escala: 3, recorte: "busto" }) || retratoURL("pj_jogador", { escala: 3 });
      if (url) $("#retratoJogador").src = url;
    }
    if (typeof estatisticasCombate !== "function") return;
    const s = estatisticasCombate(p);
    const h = s.habilidades || {};
    const nh = (k, rot) => {
      const x = h[k];
      return x ? `<span title="${esc(x.nome)}: ${x.maximo ? "máximo" : `${x.xp}/${x.necessario} XP para o próximo nível`}">${rot} ${x.nivel}</span>` : "";
    };
    const hab = [nh("corpo", "Corpo"), nh("distancia", "Arco"), nh("defesa", "Defesa"), nh("oracao", "Oração")].filter(Boolean).join(" · ");
    const el = $("#habilidades");
    if (el.innerHTML !== hab) el.innerHTML = hab;
    const peso = typeof pesoCarregado === "function" ? pesoCarregado(p) : 0;
    const cap = typeof capacidadeCarga === "function" ? capacidadeCarga(p) : 0;
    const linhas = [
      ["Dano corpo", s.danoCorpo],
      ["Dano arco", s.temArco ? s.danoDistancia : "—"],
      ["Defesa", `${s.defesa} (−${s.reducaoDano}%)`],
      ["Crítico", `${s.critico}%`],
      ["Flechas", s.flechas],
      ["Carga", `${peso}/${cap}`],
    ];
    const html = linhas.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    const dl = $("#atributos");
    if (dl.innerHTML !== html) dl.innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Missão
  // ------------------------------------------------------------------
  function atualizarMissao(p) {
    const texto = typeof textoMissaoAtual === "function" ? textoMissaoAtual(p) : "";
    const i = texto.indexOf(" · ");
    const area = i >= 0 ? texto.slice(0, i) : (typeof areas !== "undefined" && areas[p.area]?.nome) || "";
    const objetivo = i >= 0 ? texto.slice(i + 3) : texto;
    let titulo = area;
    if (typeof CAPITULOS !== "undefined" && CAPITULOS[p.area] && typeof ORDEM_CAPITULOS !== "undefined") {
      titulo = `${CAPITULOS[p.area].nome} · capítulo ${ORDEM_CAPITULOS.indexOf(p.area) + 1} de ${ORDEM_CAPITULOS.length}`;
    }
    const prog = objetivo.match(/(\d+)\s*\/\s*(\d+)(?!.*\d+\s*\/\s*\d+)/);
    $("#missaoCapitulo").textContent = titulo;
    $("#missaoObjetivo").textContent = objetivo;
    const pr = $("#missaoProgresso");
    pr.hidden = !prog;
    if (prog) pr.textContent = `${prog[1]}/${prog[2]}`;
    $("#missaoLinhaTxt").textContent = objetivo;
    $("#missaoLinhaProg").textContent = prog ? `${prog[1]}/${prog[2]}` : "";
  }

  // ------------------------------------------------------------------
  // Mochila, bolsa, equipamento e atalhos (redesenha só quando muda)
  // ------------------------------------------------------------------
  let selecao = null; // {origem:"item", id} | {origem:"equip", slot}
  let assinaturaItens = "";
  const ehMochila = (tipo) => ["arma", "arma_distancia", "escudo", "armadura", "municao"].includes(tipo);

  function contar(lista) {
    const g = new Map();
    for (const id of lista || []) g.set(id, (g.get(id) || 0) + 1);
    return g;
  }

  function htmlSlotItem(id, qtd) {
    const nome = nomeDoItem(id);
    const sel = selecao && selecao.origem === "item" && selecao.id === id ? " selecionado" : "";
    return `<button type="button" class="slot cheio${sel}" role="listitem" draggable="true" data-item="${esc(id)}" data-dica="${esc(id)}" aria-label="${esc(nome)}${qtd > 1 ? `, ${qtd} unidades` : ""}">${htmlItem(id)}${qtd > 1 ? `<span class="qtd">${qtd}</span>` : ""}</button>`;
  }

  function atualizarItens(p, forcar) {
    const ass = JSON.stringify([p.inventario, p.equipamento, p.hotkeys, selecao]);
    if (!forcar && ass === assinaturaItens) return;
    assinaturaItens = ass;
    const g = contar(p.inventario);
    const mochila = [], bolsa = [];
    for (const [id, qtd] of g) {
      const d = typeof ITENS !== "undefined" ? ITENS[id] : null;
      if (!d) continue;
      (ehMochila(d.tipo) ? mochila : bolsa).push(htmlSlotItem(id, qtd));
    }
    const vazio = '<span class="slot vazio" role="listitem" aria-hidden="true"></span>';
    const encher = (arr, n) => { while (arr.length < n) arr.push(vazio); return arr.join(""); };
    $("#gradeMochila").innerHTML = encher(mochila, 15);
    $("#gradeBolsa").innerHTML = encher(bolsa, 15);
    const peso = typeof pesoCarregado === "function" ? pesoCarregado(p) : 0;
    const cap = typeof capacidadeCarga === "function" ? capacidadeCarga(p) : 0;
    $("#pesoTexto").textContent = `${Number(peso).toFixed(1)} / ${cap} kg`;

    // Equipamento
    const eq = p.equipamento || {};
    $("#gradeEquip").innerHTML = Object.keys(ROTULO_SLOT).map((slot) => {
      const id = eq[slot];
      const sel = selecao && selecao.origem === "equip" && selecao.slot === slot ? " selecionado" : "";
      if (id && ITENS[id]) {
        return `<button type="button" class="equip cheio${sel}" draggable="true" data-equip-slot="${slot}" data-dica="${esc(id)}" data-dica-origem="equip" aria-label="${ROTULO_SLOT[slot]}: ${esc(nomeDoItem(id))}">
          <span class="slot">${htmlItem(id)}</span><span class="equip-txt"><small>${ROTULO_SLOT[slot]}</small><em>${esc(atributoCurto(id))}</em></span></button>`;
      }
      const sil = silhuetaURL(SILHUETA_SLOT[slot]);
      return `<button type="button" class="equip vazio${sel}" data-equip-slot="${slot}" aria-label="Espaço de ${ROTULO_SLOT[slot].toLowerCase()} vazio">
        <span class="slot">${sil ? `<img class="px silhueta" src="${sil}" width="32" height="32" alt="">` : ""}</span><span class="equip-txt"><small>${ROTULO_SLOT[slot]}</small><em>vazio</em></span></button>`;
    }).join("");

    // Atalhos
    const hk = p.hotkeys || [];
    let html = "";
    for (let i = 0; i < 6; i++) {
      const id = hk[i];
      const qtd = id ? g.get(id) || 0 : 0;
      const nome = id ? nomeDoItem(id) : "";
      html += `<button type="button" class="atalho${id && !qtd ? " esgotado" : ""}" data-atalho="${i}" ${id ? `data-dica="${esc(id)}"` : ""}
        aria-label="Atalho ${i + 1}: ${id ? `${esc(nome)}, ${qtd} restantes` : "vazio"}" title="${id ? `${esc(nome)} · tecla ${i + 1} · botão direito limpa` : `Solte um consumível · tecla ${i + 1}`}">
        <span class="tecla-n">${i + 1}</span>${id ? htmlItem(id) : ""}${id ? `<span class="qtd">${qtd}</span>` : ""}</button>`;
    }
    $("#atalhos").innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Lista de batalha e quadro de alvo
  // ------------------------------------------------------------------
  let assinaturaBatalha = "";
  const ehChefe = (id) => temArte() && Arte.CHEFES && Arte.CHEFES.has && Arte.CHEFES.has(id);
  const alvoAtual = () => (window.Jogo && typeof Jogo.alvoAtual === "function" ? Jogo.alvoAtual() : window.gameScene?.alvoId) || null;

  function inimigosVivos(p) {
    if (typeof inimigos === "undefined" || typeof Mundo === "undefined") return [];
    return Object.values(inimigos).filter((e) => e.area === p.area && Mundo.obterVidaInimigo(ID, e.id) > 0);
  }

  function atualizarBatalha(p) {
    const alvo = alvoAtual();
    const vivos = inimigosVivos(p);
    const ass = JSON.stringify([alvo, vivos.map((e) => [e.id, Mundo.obterVidaInimigo(ID, e.id)])]);
    if (ass === assinaturaBatalha) return;
    assinaturaBatalha = ass;
    const caixa = $("#linhasBatalha");
    if (!vivos.length) {
      caixa.innerHTML = '<p class="vazio-txt">Nenhum inimigo por perto nesta região.</p>';
    } else {
      caixa.innerHTML = vivos.map((e) => {
        const vida = Mundo.obterVidaInimigo(ID, e.id);
        const pct = Math.max(0, Math.min(100, (100 * vida) / e.vidaMaxima));
        const curto = nomeCurto(e.nome);
        const mini = retratoURL(visualDe(e.id), { escala: 2, recorte: "busto" });
        const marcas = (ehChefe(e.id) ? imgGlifo("ui_estrela_chefe", "px g16", "chefe") : "") + (e.veneno ? imgGlifo("ui_gota", "px g16", "venenoso") : "");
        return `<button type="button" role="listitem" class="linha-inimigo${alvo === e.id ? " selecionada" : ""}" data-alvo="${esc(e.id)}" aria-pressed="${alvo === e.id}" aria-label="${esc(curto)}, vida ${vida} de ${e.vidaMaxima}${ehChefe(e.id) ? ", chefe" : ""}">
          <span class="mini">${mini ? `<img class="px" src="${mini}" alt="">` : ""}</span>
          <span class="nome">${esc(curto)}${marcas}</span>
          <span class="vida"><span class="mini-barra"><i style="width:${pct}%"></i></span><b>${vida}/${e.vidaMaxima}</b></span></button>`;
      }).join("");
    }
    desenharQuadroAlvo(alvo);
  }

  let alvoDesenhado = undefined;
  function desenharQuadroAlvo(alvo) {
    const caixas = [$("#quadroAlvo"), $("#hudAlvo")];
    const e = alvo && typeof inimigos !== "undefined" ? inimigos[alvo] : null;
    if (alvo !== alvoDesenhado) {
      alvoDesenhado = alvo;
      for (const c of caixas) {
        if (!c) continue;
        if (!e) { c.innerHTML = ""; c.classList.remove("ativo"); continue; }
        const mini = retratoURL(visualDe(e.id), { escala: 2, recorte: "busto" });
        c.innerHTML = `<span class="mini">${mini ? `<img class="px" src="${mini}" alt="">` : ""}</span>
          <span class="alvo-info"><strong>${ehChefe(e.id) ? imgGlifo("ui_estrela_chefe", "px g16") : ""}${esc(nomeCurto(e.nome))}</strong>
          <span class="alvo-barra"><i></i></span><span class="alvo-recarga" title="Recarga do autoataque"><i></i></span></span>
          <span class="alvo-vida"></span>`;
        c.classList.add("ativo");
        c.setAttribute("aria-label", `Alvo: ${nomeCurto(e.nome)}`);
      }
    }
    document.body.classList.toggle("com-alvo", !!e);
    if (e) atualizarVidaAlvo(e);
  }

  function atualizarVidaAlvo(e) {
    const vida = Mundo.obterVidaInimigo(ID, e.id);
    for (const c of [$("#quadroAlvo"), $("#hudAlvo")]) {
      if (!c || !c.classList.contains("ativo")) continue;
      const i = c.querySelector(".alvo-barra i"), t = c.querySelector(".alvo-vida");
      if (i) i.style.width = `${Math.max(0, Math.min(100, (100 * vida) / e.vidaMaxima))}%`;
      if (t) t.textContent = `${vida}/${e.vidaMaxima}`;
    }
  }

  // Arco de recarga do autoataque (barrinha que enche em 2 s).
  function laçoRecarga() {
    const alvo = alvoDesenhado;
    if (alvo) {
      const s = window.gameScene;
      const intervalo = typeof INTERVALO_AUTO_ATAQUE !== "undefined" ? INTERVALO_AUTO_ATAQUE : 2000;
      let f = 1;
      if (s && s.proximoAutoAtaque) f = 1 - Math.max(0, s.proximoAutoAtaque - Date.now()) / intervalo;
      const w = `${Math.max(0, Math.min(1, f)) * 100}%`;
      for (const i of $$(".alvo-recarga i")) i.style.width = w;
    }
    requestAnimationFrame(laçoRecarga);
  }

  // ------------------------------------------------------------------
  // Avisos (toasts), registro e classificação (§9.8)
  // ------------------------------------------------------------------
  const TIPOS = {
    perigo: { cor: "var(--vida-2)", glifo: "ui_coracao", nome: "perigo" },
    combate: { cor: "var(--vida-2)", glifo: "ui_espadas", nome: "combate" },
    saque: { cor: "var(--moeda)", glifo: "ui_moeda", nome: "saque" },
    missao: { cor: "var(--fe-2)", glifo: "ui_pergaminho", nome: "missão" },
    sistema: { cor: "var(--tinta-suave)", glifo: "ui_losango", nome: "sistema" },
    fala: { cor: "var(--bronze-500)", glifo: "ui_falar", nome: "fala" },
  };
  // "Nome: fala" só é fala quando o nome é de um personagem conhecido.
  function ehFala(t) {
    const m = t.match(/^([A-ZÀ-Ú][^:]{1,30}):/);
    if (!m || typeof npcs === "undefined") return false;
    return Object.values(npcs).some((n) => n.nome === m[1] || nomeCurto(n.nome) === nomeCurto(m[1]));
  }
  function classificar(t) {
    if (ehFala(t)) return "fala";
    if (/envenen|derrotad[oa] você|caiu|morreu|sem flechas|sem poç/i.test(t)) return "perigo";
    if (/dano|golpe|ataca|derrot|crític/i.test(t)) return "combate";
    if (/pegou|coletou|recebeu|moedas|\+\d/i.test(t)) return "saque";
    if (/missão|capítulo|recompensa|tarefa|rota/i.test(t)) return "missao";
    return "sistema";
  }
  const glifoDoTipo = (tipo, texto) => (tipo === "perigo" && /veneno|envenen/i.test(texto) ? "ui_gota" : (TIPOS[tipo] || TIPOS.sistema).glifo);

  const registro = [];
  function registrar(texto, tipo) {
    const s = Math.floor((Date.now() - inicioSessao) / 1000);
    const hora = `${String(Math.floor(s / 60) % 100).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    registro.unshift({ texto, tipo, hora });
    if (registro.length > 30) registro.length = 30;
    const li = document.createElement("li");
    li.innerHTML = `<span class="marca-tipo" style="--cor:${(TIPOS[tipo] || TIPOS.sistema).cor}">${imgGlifo(glifoDoTipo(tipo, texto), "px g16", (TIPOS[tipo] || TIPOS.sistema).nome)}</span><time>${hora}</time><span>${esc(texto)}</span>`;
    const ol = $("#listaRegistro");
    ol.prepend(li);
    while (ol.children.length > 30) ol.lastElementChild.remove();
    $("#registroQtd").textContent = String(registro.length);
  }

  function aviso(texto, tipo) {
    const caixa = $("#avisos");
    const ultimo = caixa.lastElementChild;
    if (ultimo && ultimo.dataset.texto === texto && !ultimo.classList.contains("saindo")) {
      const n = Number(ultimo.dataset.rep || 1) + 1;
      ultimo.dataset.rep = n;
      let r = ultimo.querySelector(".rep");
      if (!r) { r = document.createElement("span"); r.className = "rep"; ultimo.appendChild(r); }
      r.textContent = `x${n}`;
      agendarSaida(ultimo);
      return;
    }
    const t = TIPOS[tipo] || TIPOS.sistema;
    const el = document.createElement("div");
    el.className = "aviso";
    el.dataset.texto = texto;
    el.style.setProperty("--cor", t.cor);
    el.innerHTML = `${imgGlifo(glifoDoTipo(tipo, texto), "px", t.nome)}<span>${esc(texto)}</span>`;
    el.addEventListener("mouseenter", () => { clearTimeout(el._t); });
    el.addEventListener("mouseleave", () => agendarSaida(el));
    caixa.appendChild(el);
    while (caixa.children.length > 3) caixa.firstElementChild.remove();
    agendarSaida(el);
  }
  function agendarSaida(el) {
    clearTimeout(el._t);
    const dur = Math.min(8000, 3000 + 35 * (el.dataset.texto || "").length);
    el._t = setTimeout(() => {
      el.classList.add("saindo");
      setTimeout(() => el.remove(), reduzMovimento() ? 0 : 300);
    }, dur);
  }

  let falaPendente = null;
  function mensagem(texto, tipo) {
    if (!texto) return;
    texto = String(texto);
    tipo = TIPOS[tipo] ? tipo : classificar(texto);
    registrar(texto, tipo);
    if (tipo === "fala") {
      // O MUNDO chama UI.dialogo logo depois de uma fala; se não chamar, vira aviso.
      falaPendente = texto;
      setTimeout(() => { if (falaPendente === texto) { falaPendente = null; aviso(texto, "fala"); } }, 0);
      return;
    }
    aviso(texto, tipo);
  }

  // ------------------------------------------------------------------
  // Diálogo com retrato (máquina de escrever a 40 caracteres/s)
  // ------------------------------------------------------------------
  const PAPEIS = {
    viajante1: "pastor", guia_canaa: "guia de caravanas", guia_deserto: "guia de caravanas", mercador1: "mercador",
    noemi1: "do acampamento", moisesEgito: "líder do povo", aaronEgito: "irmão de Moisés", araoMar: "irmão de Moisés",
    josueSinai: "comandante", pedroGalileia: "pescador", jesusGalileia: "Médico dos médicos",
  };
  const dlg = { id: null, texto: "", mostrado: 0, timer: null, fechar: null, npc: null };

  function textoSemPrefixo(nome, texto) {
    const m = String(texto).match(/^([^:]{1,40}):\s+/);
    if (!m) return texto;
    const curto = nomeCurto(nome);
    if (nome.startsWith(m[1]) || m[1].startsWith(curto)) return texto.slice(m[0].length);
    return texto;
  }

  function dialogo({ id, nome, papel, texto }) {
    if (falaPendente === texto) falaPendente = null;
    const caixa = $("#dialogo");
    const corpo = textoSemPrefixo(nome || "", texto || "");
    // Mesmo NPC e mesma fala: completa e, depois, fecha (clique ou F).
    if (caixa.classList.contains("aberto") && dlg.id === id && dlg.texto === corpo) {
      if (dlg.mostrado < corpo.length) completarDialogo();
      else fecharDialogo();
      return;
    }
    dlg.id = id;
    dlg.texto = corpo;
    dlg.npc = typeof npcs !== "undefined" ? npcs[id] : null;
    $("#dlgNome").textContent = nomeCurto(nome || dlg.npc?.nome || "");
    $("#dlgPapel").textContent = PAPEIS[id] || (papel === "loja" ? "mercador" : papel === "guia" ? "guia de caravanas" : "");
    const url = retratoURL(visualDe(id), { escala: 3, recorte: "busto" });
    const img = $("#dlgRetrato");
    if (url) img.src = url; else img.removeAttribute("src");
    img.alt = `Retrato de ${nomeCurto(nome || "")}`;
    caixa.classList.add("aberto");
    clearInterval(dlg.timer);
    clearTimeout(dlg.fechar);
    if (reduzMovimento()) completarDialogo();
    else {
      dlg.mostrado = 0;
      $("#dlgTexto").textContent = "";
      dlg.timer = setInterval(() => {
        dlg.mostrado = Math.min(corpo.length, dlg.mostrado + 2);
        $("#dlgTexto").textContent = corpo.slice(0, dlg.mostrado);
        if (dlg.mostrado >= corpo.length) completarDialogo();
      }, 50);
    }
    dlg.fechar = setTimeout(fecharDialogo, 9000 + corpo.length * 45);
  }
  function completarDialogo() {
    clearInterval(dlg.timer);
    dlg.mostrado = dlg.texto.length;
    $("#dlgTexto").textContent = dlg.texto;
  }
  function fecharDialogo() {
    clearInterval(dlg.timer);
    clearTimeout(dlg.fechar);
    $("#dialogo").classList.remove("aberto");
    dlg.id = null;
  }

  // ------------------------------------------------------------------
  // Modais (componente único, foco preso, Esc/véu/fechar)
  // ------------------------------------------------------------------
  let modalAberto = null, focoOrigem = null;
  function teclado(ligado) {
    const kb = window.gameScene?.input?.keyboard;
    if (!kb) return;
    try { kb.enabled = ligado; if (!ligado && kb.resetKeys) kb.resetKeys(); } catch (e) { /* cena trocando */ }
  }
  function abrirModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    if (modalAberto && modalAberto !== m) fecharModal(false);
    if (!modalAberto) focoOrigem = document.activeElement;
    modalAberto = m;
    m.classList.add("aberto");
    m.setAttribute("aria-hidden", "false");
    esconderDica();
    teclado(false);
    if (window.Jogo) Jogo.entrada = { dx: 0, dy: 0 };
    preencherGlifos(m);
    const foco = m.querySelector("[data-foco-inicial]") || m.querySelector(".modal-corpo button:not([disabled]), .btn-fechar");
    const corpo = m.querySelector(".modal-corpo");
    setTimeout(() => { foco?.focus({ preventScroll: true }); if (corpo) corpo.scrollTop = 0; }, 0);
  }
  function fecharModal(devolverFoco = true) {
    if (!modalAberto) return;
    modalAberto.classList.remove("aberto");
    modalAberto.setAttribute("aria-hidden", "true");
    modalAberto = null;
    teclado(true);
    if (devolverFoco && focoOrigem && document.contains(focoOrigem)) focoOrigem.focus?.();
    else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
  }
  function prenderFoco(e) {
    if (!modalAberto || e.key !== "Tab") return;
    const foc = $$('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])', modalAberto).filter((x) => x.offsetParent !== null);
    if (!foc.length) return;
    const pri = foc[0], ult = foc[foc.length - 1];
    if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
    else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
  }

  // Comandos que afetam o mundo passam por Jogo.executar (efeitos + mensagem).
  function executar(comando) {
    if (window.Jogo && window.gameScene) return Jogo.executar(comando);
    const r = Mundo.executar(ID, comando);
    if (r && r.mensagem) mensagem(r.mensagem);
    atualizar();
    return r;
  }

  // ----- Loja -----
  let abaLoja = "comprar", falaLoja = "";
  function abrirLoja() {
    const merc = typeof npcs !== "undefined" ? Object.values(npcs).find((n) => n.papel === "loja") : null;
    $("#lojaTitulo").textContent = nomeCurto(merc?.nome || "Mercador");
    const url = retratoURL(visualDe(merc?.id || "mercador1"), { escala: 3, recorte: "busto" });
    if (url) $("#lojaRetrato").src = url;
    falaLoja = dlg.id === merc?.id ? dlg.texto : "";
    if (dlg.id === merc?.id) fecharDialogo();
    desenharLoja();
    abrirModal("modalLoja");
  }
  function desenharLoja() {
    const p = jogador();
    if (!p) return;
    const corpo = $("#lojaCorpo");
    const g = contar(p.inventario);
    const moeda = imgGlifo("ui_moeda", "px g16");
    let lista = "";
    if (abaLoja === "comprar") {
      for (const [id, preco] of Object.entries(typeof PRECOS_LOJA !== "undefined" ? PRECOS_LOJA : {})) {
        const falta = preco - p.moedas;
        lista += `<li class="item-loja"><span class="icone">${htmlItem(id)}</span><span><strong>${esc(nomeDoItem(id))}</strong><span>${esc(atributoItem(id, p))}</span></span>
          <button type="button" class="btn primario" data-comprar="${esc(id)}" ${falta > 0 ? `disabled title="Faltam ${falta} moedas"` : ""} aria-label="Comprar ${esc(nomeDoItem(id))} por ${preco} moedas${falta > 0 ? `; faltam ${falta}` : ""}">${falta > 0 ? `faltam ${falta}` : `${preco} ${moeda}`}</button></li>`;
      }
    } else {
      for (const [id, valor] of Object.entries(typeof VALORES_VENDA !== "undefined" ? VALORES_VENDA : {})) {
        const n = g.get(id) || 0;
        if (!n) continue;
        lista += `<li class="item-loja"><span class="icone">${htmlItem(id)}</span><span><strong>${esc(nomeDoItem(id))}</strong><span>Você tem ${n}</span></span>
          <button type="button" class="btn primario" data-vender="${esc(id)}" aria-label="Vender um ${esc(nomeDoItem(id))} por ${valor} moedas">+${valor} ${moeda}</button></li>`;
      }
      if (!lista) lista = '<li class="vazio-txt" style="color:var(--tinta-suave)">Você não tem nada que o mercador compre. Ele aceita pele de lobo, erva, odre de água e peixe.</li>';
    }
    corpo.innerHTML = `${falaLoja ? `<p class="fala-modal">${esc(falaLoja)}</p>` : ""}
      <div class="saldo">${moeda}<span>${p.moedas} moedas</span></div>
      <div class="abas-modal" role="tablist">
        <button type="button" class="aba-modal" role="tab" data-aba-loja="comprar" aria-selected="${abaLoja === "comprar"}">Comprar</button>
        <button type="button" class="aba-modal" role="tab" data-aba-loja="vender" aria-selected="${abaLoja === "vender"}">Vender</button>
      </div>
      <ul class="lista-loja" role="tabpanel">${lista}</ul>
      <p class="nota" style="color:var(--tinta-suave)">Flechas são vendidas em lotes de ${typeof FLECHAS_POR_PACOTE !== "undefined" ? FLECHAS_POR_PACOTE : 5}. Fique ao lado do mercador para negociar.</p>`;
  }

  // ----- Viagem -----
  const DESTINOS = [
    { area: "canaan", x: 44, y: 34 },
    { area: "deserto", x: 116, y: 66 },
  ];
  function abrirViagem() {
    const p = jogador();
    if (!p) return;
    const guia = typeof npcs !== "undefined" ? Object.values(npcs).find((n) => n.papel === "guia" && n.area === p.area) : null;
    const url = retratoURL(visualDe(guia?.id || "guia_canaa"), { escala: 3, recorte: "busto" });
    if (url) $("#viagemRetrato").src = url;
    $("#viagemTitulo").textContent = guia ? `Viagem com ${nomeCurto(guia.nome)}` : "Viagem rápida";
    const fala = guia && dlg.id === guia.id ? dlg.texto : "";
    if (fala) fecharDialogo();
    const nomeA = (a) => (typeof areas !== "undefined" && areas[a]?.nome) || a;
    $("#viagemCorpo").innerHTML = `${fala ? `<p class="fala-modal">${esc(fala)}</p>` : "<p>Escolha o destino. A viagem é gratuita; a trilha no extremo sul também liga as regiões a pé.</p>"}
      <div class="mapa-antigo"><canvas width="160" height="100" id="mapaViagem" aria-hidden="true"></canvas>
      ${DESTINOS.map((d) => `<button type="button" class="btn primario destino" style="left:${(d.x / 160) * 100}%;top:${(d.y / 100) * 100}%" data-viajar="${d.area}"
        ${d.area === p.area ? 'disabled title="Você está aqui"' : ""} aria-label="${d.area === p.area ? `${nomeA(d.area)}: você está aqui` : `Viajar para ${nomeA(d.area)}`}">${esc(nomeA(d.area))}${d.area === p.area ? " · aqui" : ""}</button>`).join("")}
      </div>`;
    desenharMapaViagem(p);
    abrirModal("modalViagem");
  }
  function desenharMapaViagem(p) {
    const c = $("#mapaViagem");
    const ctx = c && c.getContext("2d");
    if (!ctx) return;
    const W = 160, H = 100;
    const h = (x, y) => (temArte() && Arte.hash2 ? Arte.hash2(x, y, 11) : ((x * 7 + y * 13) % 10) / 10);
    // pergaminho com manchas
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = h(x >> 2, y >> 2);
      ctx.fillStyle = n > 0.8 ? "#d9bd84" : n < 0.15 ? "#f0dfb6" : "#e6cf9c";
      ctx.fillRect(x, y, 1, 1);
    }
    // mar das rotas (entre os portos)
    ctx.fillStyle = "#9fc4b8";
    for (let y = 40; y < 64; y++) for (let x = 56; x < 104; x++) if (h(x, y) > 0.25 || (x > 60 && x < 100 && y > 43 && y < 61)) ctx.fillRect(x, y, 1, 1);
    // trilha tracejada entre os destinos
    const [a, b] = DESTINOS;
    ctx.fillStyle = "#2a1a14";
    const passos = 60;
    for (let i = 0; i <= passos; i++) {
      if (Math.floor(i / 3) % 2) continue;
      const t = i / passos;
      const x = Math.round(a.x + (b.x - a.x) * t), y = Math.round(a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 18);
      ctx.fillRect(x, y, 1, 1);
    }
    // selos dos destinos na cor do chão do bioma
    for (const d of DESTINOS) {
      let cor = "#8fa34e";
      try { cor = Arte.minimapaCores(d.area).chao; } catch (e) { /* reserva */ }
      ctx.fillStyle = "#2a1a14"; ctx.fillRect(d.x - 4, d.y - 4, 9, 9);
      ctx.fillStyle = cor; ctx.fillRect(d.x - 3, d.y - 3, 7, 7);
      if (d.area === p.area) { ctx.fillStyle = "#3b5a9a"; ctx.fillRect(d.x - 1, d.y - 1, 3, 3); }
    }
    // rosa-dos-ventos (glifo ui_rosa)
    const rosa = new Image();
    rosa.onload = () => { ctx.imageSmoothingEnabled = false; ctx.drawImage(rosa, 140, 4, 16, 16); };
    const url = glifoURL("ui_rosa", 2);
    if (url) rosa.src = url;
    // moldura de tinta
    ctx.strokeStyle = "#5a3a24"; ctx.lineWidth = 1; ctx.strokeRect(2.5, 2.5, W - 5, H - 5);
  }

  // ----- Oração -----
  const ORACOES = [
    { acao: "vida", glifo: "ui_coracao", texto: "Restaura parte da sua vida." },
    { acao: "veneno", glifo: "ui_gota", texto: "Remove o veneno do corpo." },
    { acao: "area", glifo: "ui_losango", texto: "Cura você e a área 3×3 ao redor." },
    { acao: "milagre", glifo: "ui_estrela_chefe", texto: "Vida cheia e veneno removido." },
  ];
  function abrirOracao() {
    const p = jogador();
    if (!p) return;
    if (!p.oracaoDesbloqueada) {
      mensagem("A Oração será aprendida na Galileia, em conversa com Jesus.", "missao");
      return;
    }
    desenharOracao();
    abrirModal("modalOracao");
  }
  function desenharOracao() {
    const p = jogador();
    if (!p) return;
    const nivelOr = typeof estatisticasCombate === "function" ? estatisticasCombate(p).habilidades.oracao?.nivel || 0 : 0;
    const feMax = typeof FE_MAXIMA !== "undefined" ? FE_MAXIMA : 100;
    $("#oracaoSub").textContent = `Oração nível ${nivelOr} · fé ${p.fe}/${feMax}`;
    const nomes = typeof NOMES_ORACAO !== "undefined" ? NOMES_ORACAO : {};
    const custos = typeof CUSTO_ORACAO !== "undefined" ? CUSTO_ORACAO : {};
    const niveis = typeof NIVEL_ORACAO !== "undefined" ? NIVEL_ORACAO : {};
    const cartoes = ORACOES.map((o) => {
      const custo = custos[o.acao] ?? 0, req = niveis[o.acao] ?? 0;
      const travado = nivelOr < req, falta = custo - (p.fe || 0);
      const desab = travado || falta > 0;
      const motivo = travado ? `Oração nível ${req}` : falta > 0 ? `faltam ${falta} de fé` : "";
      return `<button type="button" class="cartao" data-orar="${o.acao}" aria-disabled="${desab}" ${motivo ? `title="${esc(motivo)}"` : ""}
        aria-label="${esc(nomes[o.acao] || o.acao)}, custa ${custo} de fé${motivo ? `; ${esc(motivo)}` : ""}">
        ${imgGlifo(o.glifo, "px g24")}<strong>${esc(nomes[o.acao] || o.acao)}</strong><span>${esc(o.texto)}</span>
        ${travado ? `<span class="trava">${imgGlifo("ui_cadeado", "px g16")}nível ${req}</span>` : `<span class="custo">${imgGlifo("ui_candeia", "px g16")}${custo} de fé${falta > 0 ? ` · faltam ${falta}` : ""}</span>`}</button>`;
    }).join("");
    $("#oracaoCorpo").innerHTML = `<div class="linha-barra" style="margin:0 0 10px">${imgGlifo("ui_candeia", "px g16", "Fé")}<div class="barra fe" id="oracaoFe"><i style="width:${(100 * (p.fe || 0)) / feMax}%"></i><b>${p.fe}/${feMax}</b></div></div>
      <div class="cartoes">${cartoes}</div>
      <p class="nota" style="color:var(--tinta-suave)">O jogo é solo: a cura em área cura você e mostra o efeito 3×3. As poções de vida e de fé continuam disponíveis.</p>`;
  }

  // ----- Ajuda -----
  function abrirAjuda() {
    const p = jogador();
    const regra = p && typeof descreverRegraMorte === "function" ? descreverRegraMorte(p.nivel) : "";
    const k = (...t) => t.map((x) => `<kbd>${esc(x)}</kbd>`).join("");
    const linhas = [
      [k("W", "A", "S", "D") + " " + k("setas"), "Andar"],
      [k("Q", "E", "Z", "C"), "Andar na diagonal"],
      [k("F"), "Ação ao lado: falar, embarcar, desembarcar ou seguir a rota"],
      ["Clique no inimigo", "Escolhe o alvo e ataca sozinho a cada 2 s"],
      [k("Espaço"), "Golpe corpo a corpo no alvo (também na diagonal)"],
      [k("R"), "Flecha no alvo, se houver arco equipado e flechas"],
      [k("H"), "Usar poção de vida"],
      [k("1", "–", "6"), "Usar o atalho"],
      [k("P"), "Pescar (no mar, ao lado do ponto de pesca)"],
      [k("F1"), "Oração (depois de aprender com Jesus, na Galileia)"],
      [k("I"), "Mostrar ou ocultar mochila e bolsa"],
      [k("M"), "Mostrar ou ocultar o mapa"],
      [k("Alt"), "Segure para ver o nome de todos"],
      [k("?"), "Esta ajuda"],
      [k("Esc"), "Fechar janelas e conversas"],
    ];
    const forcado = document.body.classList.contains("toque-forcado");
    $("#ajudaCorpo").innerHTML = `
      <h3>Teclado e mouse</h3>
      <table class="teclas"><tbody>${linhas.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table>
      <h3>Itens</h3>
      <p>Arraste um item para o espaço de equipamento ou para uma tecla de atalho. Ou toque no item e depois no destino. Duplo clique equipa armas e usa poções. Para guardar, arraste o equipamento de volta para a mochila. Botão direito numa tecla de atalho a esvazia.</p>
      <h3>Toque</h3>
      <p>O direcional, à esquerda, anda nas 8 direções. À direita: atacar, flecha, poção, oração e o botão de ação, que muda conforme o que está ao lado (falar, cais, pesca, rota). Os painéis abrem pela barra inferior. Toque longo num item mostra a descrição.</p>
      <h3>Regras</h3>
      <p>As habilidades (corpo, arco, defesa e oração) melhoram com o uso. Fora de combate, a vida volta aos poucos. ${esc(regra)}</p>
      <p>Viagem rápida: fale com Micael em Canaã ou Tamar no Deserto. A trilha no extremo sul liga as regiões a pé. Os capítulos (Egito, Mar Vermelho, Sinai, Galileia) abrem em ordem. Azarias, no Deserto, vende provisões e compra recursos. No mar, pesque nos pontos com ondulação.</p>
      <div class="acoes-modal">
        <button type="button" class="btn secundario" data-alternar-toque aria-pressed="${forcado}">${forcado ? "Ocultar" : "Mostrar"} controles de toque</button>
        <button type="button" class="btn secundario" data-tela-cheia>${imgGlifo("ui_tela_cheia", "px g16")}Tela cheia</button>
        <button type="button" class="btn primario" data-fechar data-foco-inicial>Entendi</button>
      </div>`;
    abrirModal("modalAjuda");
  }

  // ------------------------------------------------------------------
  // Minimapa (o MUNDO desenha no #miniMap; a UI decide onde ele fica)
  // ------------------------------------------------------------------
  function alternarMinimapa() {
    if (modo === "estreito") document.body.classList.toggle("mapa-visivel-cel");
    else document.body.classList.toggle("mapa-oculto");
    const visivel = modo === "estreito" ? document.body.classList.contains("mapa-visivel-cel") : !document.body.classList.contains("mapa-oculto");
    $("#btnMapa").setAttribute("aria-pressed", String(visivel));
  }

  // ------------------------------------------------------------------
  // Layout responsivo: distribui os painéis (largo / médio / estreito)
  // ------------------------------------------------------------------
  let modo = null, abaMedia = "mochila", folhaAtual = null;
  const ABAS_MEDIO = {
    personagem: { rotulo: "Personagem", glifo: "ui_personagem", paineis: ["pPersonagem"] },
    // Equipamento junto da mochila: dá para arrastar de um para o outro.
    mochila: { rotulo: "Mochila", glifo: "ui_mochila", paineis: ["pEquip", "pMochila", "pBolsa"] },
    batalha: { rotulo: "Batalha", glifo: "ui_espadas", paineis: ["pBatalha", "pRegistro"] },
  };
  const FOLHAS = {
    mochila: { titulo: "Mochila e bolsa", paineis: ["pEquip", "pMochila", "pBolsa"] },
    equip: { titulo: "Personagem", paineis: ["pPersonagem", "pEquip"] },
    batalha: { titulo: "Batalha", paineis: ["pBatalha"] },
    missao: { titulo: "Missão", paineis: ["pMissao"] },
    registro: { titulo: "Registro", paineis: ["pRegistro"] },
  };
  const calcModo = () => (mm("(min-width: 1280px)") ? "largo" : mm("(max-width: 760px)") ? "estreito" : "medio");
  const painel = (id) => document.getElementById(id);

  function abrirRegistro(aberto) {
    const p = painel("pRegistro");
    p.dataset.aberto = String(aberto);
    $("#btnRegistro").setAttribute("aria-expanded", String(aberto));
  }

  function montar() {
    const novo = calcModo();
    if (novo === modo) return;
    modo = novo;
    const dep = $("#deposito");
    for (const id of ["pMissao", "pMochila", "pBolsa", "pRegistro", "pMapa", "pPersonagem", "pEquip", "pBatalha"]) dep.appendChild(painel(id));
    $("#colEsq").innerHTML = "";
    $("#colDir").innerHTML = "";
    fecharFolha();
    const moldura = $("#mapaMoldura");
    if (modo === "largo") {
      for (const id of ["pMissao", "pMochila", "pBolsa", "pRegistro"]) $("#colEsq").appendChild(painel(id));
      for (const id of ["pMapa", "pPersonagem", "pEquip", "pBatalha"]) $("#colDir").appendChild(painel(id));
      $("#mapaCasa").appendChild(moldura);
      abrirRegistro(true);
    } else if (modo === "medio") {
      $("#colDir").appendChild(painel("pMissao"));
      const nav = document.createElement("div");
      nav.className = "abas";
      nav.setAttribute("role", "tablist");
      nav.setAttribute("aria-label", "Painéis");
      nav.innerHTML = Object.entries(ABAS_MEDIO).map(([k, a]) =>
        `<button type="button" class="aba" role="tab" id="aba-${k}" data-aba="${k}" aria-controls="painelAba" aria-selected="${k === abaMedia}">${imgGlifo(a.glifo)}${a.rotulo}</button>`).join("");
      $("#colDir").appendChild(nav);
      const caixa = document.createElement("div");
      caixa.className = "painel-aba";
      caixa.id = "painelAba";
      caixa.setAttribute("role", "tabpanel");
      $("#colDir").appendChild(caixa);
      mostrarAbaMedia(abaMedia);
      $("#mapaSobre").appendChild(moldura);
      abrirRegistro(true);
    } else {
      $("#mapaSobre").appendChild(moldura);
      abrirRegistro(true);
    }
    const visivel = modo === "estreito" ? document.body.classList.contains("mapa-visivel-cel") : !document.body.classList.contains("mapa-oculto");
    $("#btnMapa").setAttribute("aria-pressed", String(visivel));
    medirRodape();
  }

  function mostrarAbaMedia(k) {
    abaMedia = k;
    const caixa = $("#painelAba");
    if (!caixa) return;
    const dep = $("#deposito");
    for (const el of Array.from(caixa.children)) dep.appendChild(el);
    for (const id of ABAS_MEDIO[k].paineis) caixa.appendChild(painel(id));
    caixa.setAttribute("aria-labelledby", `aba-${k}`);
    for (const b of $$("[data-aba]")) b.setAttribute("aria-selected", String(b.dataset.aba === k));
  }

  function abrirFolha(k) {
    if (modo !== "estreito") return;
    if (folhaAtual === k) { fecharFolha(); return; }
    const dep = $("#deposito"), cont = $("#folhaConteudo");
    for (const el of Array.from(cont.children)) dep.appendChild(el);
    for (const id of FOLHAS[k].paineis) cont.appendChild(painel(id));
    folhaAtual = k;
    $("#folhaTitulo").textContent = FOLHAS[k].titulo;
    const f = $("#folha");
    f.classList.add("aberta");
    f.setAttribute("aria-hidden", "false");
    for (const b of $$("#abasCel [data-folha]")) b.setAttribute("aria-expanded", String(b.dataset.folha === k));
    medirRodape();
  }
  function fecharFolha() {
    const f = $("#folha");
    if (!f) return;
    f.classList.remove("aberta");
    f.setAttribute("aria-hidden", "true");
    folhaAtual = null;
    for (const b of $$("#abasCel [data-folha]")) b.setAttribute("aria-expanded", "false");
  }
  function medirRodape() {
    const r = $("#rodape");
    if (r) document.documentElement.style.setProperty("--altura-rodape", `${r.offsetHeight}px`);
  }

  // A tecla I do MUNDO alterna body.hideBags; no médio/estreito isso abre a mochila.
  function observarMochila() {
    let antes = document.body.classList.contains("hideBags");
    new MutationObserver(() => {
      const agora = document.body.classList.contains("hideBags");
      if (agora === antes) return;
      antes = agora;
      if (modo === "medio") mostrarAbaMedia(abaMedia === "mochila" ? "personagem" : "mochila");
      else if (modo === "estreito") abrirFolha("mochila");
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  // ------------------------------------------------------------------
  // Itens: arrastar, tocar-para-equipar, duplo clique, dica
  // ------------------------------------------------------------------
  function selecionar(nova, aviso) {
    selecao = nova;
    const p = jogador();
    if (p) atualizarItens(p, true);
    if (nova && aviso) mensagem(aviso, "sistema");
  }

  function equipar(id, slot) {
    const r = Mundo.equiparItem(ID, id, slot);
    if (r && r.mensagem) mensagem(r.mensagem, r.ok ? "sistema" : "perigo");
    window.gameScene?.atualizarVisualJogador?.();
    selecao = null;
    atualizar();
    return r;
  }
  function desequipar(slot) {
    const r = Mundo.desequiparItem(ID, slot);
    if (r && r.mensagem) mensagem(r.mensagem, "sistema");
    window.gameScene?.atualizarVisualJogador?.();
    selecao = null;
    atualizar();
  }
  function definirAtalho(i, id) {
    const r = Mundo.atribuirHotkey(ID, i, id);
    if (r && r.mensagem) mensagem(r.mensagem, r.ok ? "sistema" : "perigo");
    else if (r && r.ok && id) mensagem(`${nomeDoItem(id)} na tecla ${i + 1}.`, "sistema");
    selecao = null;
    atualizar();
  }
  function usarItem(id) {
    const d = ITENS[id];
    if (!d) return;
    if (id === "pocao") return window.Jogo ? Jogo.acao("pocao") : executar({ tipo: "usarPocao" });
    if (id === "pocao_fe") return window.Jogo ? Jogo.acao("pocaoFe") : executar({ tipo: "usarPocaoFe" });
    const slot = slotDoTipo(d.tipo);
    if (slot) return equipar(id, slot);
    mensagem(`${nomeDoItem(id)}: ${atributoItem(id) || "recurso"}.`, "sistema");
  }

  function ligarItens() {
    const doc = document;
    doc.addEventListener("dragstart", (e) => {
      const it = e.target.closest?.("[data-item]");
      const eq = e.target.closest?.(".equip.cheio");
      esconderDica();
      if (it) { e.dataTransfer.setData("text/item", it.dataset.item); e.dataTransfer.effectAllowed = "move"; }
      else if (eq) { e.dataTransfer.setData("text/equip", eq.dataset.equipSlot); e.dataTransfer.effectAllowed = "move"; }
    });
    const alvoSoltar = (e) => e.target.closest?.("[data-equip-slot], [data-atalho], .zona-soltar");
    doc.addEventListener("dragover", (e) => {
      const z = alvoSoltar(e);
      if (!z) return;
      e.preventDefault();
      for (const x of $$(".alvo-soltar")) if (x !== z) x.classList.remove("alvo-soltar");
      z.classList.add("alvo-soltar");
    });
    doc.addEventListener("dragleave", (e) => { const z = alvoSoltar(e); if (z && !z.contains(e.relatedTarget)) z.classList.remove("alvo-soltar"); });
    doc.addEventListener("dragend", () => { for (const x of $$(".alvo-soltar")) x.classList.remove("alvo-soltar"); });
    doc.addEventListener("drop", (e) => {
      const z = alvoSoltar(e);
      for (const x of $$(".alvo-soltar")) x.classList.remove("alvo-soltar");
      if (!z) return;
      e.preventDefault();
      const item = e.dataTransfer.getData("text/item"), slotEq = e.dataTransfer.getData("text/equip");
      if (z.dataset.equipSlot && item) equipar(item, z.dataset.equipSlot);
      else if (z.dataset.atalho !== undefined && item) definirAtalho(Number(z.dataset.atalho), item);
      else if (z.classList.contains("zona-soltar") && slotEq) desequipar(slotEq);
    });

    // Clique: tocar-para-equipar / usar atalho / escolher alvo
    doc.addEventListener("click", (e) => {
      if (suprimirClique) { suprimirClique = false; e.preventDefault(); return; }
      const t = e.target;
      const it = t.closest("[data-item]");
      const eq = t.closest("[data-equip-slot]");
      const hk = t.closest("[data-atalho]");
      const zona = t.closest(".zona-soltar");
      const linha = t.closest("[data-alvo]");
      if (linha) { window.Jogo?.selecionarAlvo(linha.dataset.alvo === alvoAtual() ? null : linha.dataset.alvo); atualizar(); return; }
      if (it) {
        const id = it.dataset.item;
        if (selecao && selecao.origem === "item" && selecao.id === id) return selecionar(null);
        const d = ITENS[id];
        const dica = slotDoTipo(d.tipo) ? "Toque num espaço de equipamento para equipar." : d.tipo === "consumivel" ? "Toque numa tecla de atalho para guardar ali." : `${nomeDoItem(id)} selecionado.`;
        return selecionar({ origem: "item", id }, dica);
      }
      if (eq) {
        const slot = eq.dataset.equipSlot;
        if (selecao && selecao.origem === "item") return equipar(selecao.id, slot);
        if (selecao && selecao.origem === "equip" && selecao.slot === slot) return selecionar(null);
        if (eq.classList.contains("cheio")) return selecionar({ origem: "equip", slot }, "Toque na mochila para guardar o equipamento.");
        return;
      }
      if (hk) {
        const i = Number(hk.dataset.atalho);
        if (selecao && selecao.origem === "item") return definirAtalho(i, selecao.id);
        hk.classList.remove("usado"); void hk.offsetWidth; hk.classList.add("usado");
        return window.Jogo ? Jogo.usarAtalho(i) : null;
      }
      if (zona && selecao && selecao.origem === "equip") return desequipar(selecao.slot);
      // Trocar de aba/folha mantém a seleção (tocar-para-equipar entre painéis).
      if (selecao && !t.closest(".modal, #dicaItem, [data-folha], [data-aba], #folhaFechar, #folhaAlca, .painel-cab")) selecionar(null);
    });
    doc.addEventListener("dblclick", (e) => {
      const it = e.target.closest("[data-item]");
      const eq = e.target.closest(".equip.cheio");
      if (it) { selecao = null; usarItem(it.dataset.item); }
      else if (eq) desequipar(eq.dataset.equipSlot);
    });
    doc.addEventListener("contextmenu", (e) => {
      const hk = e.target.closest("[data-atalho]");
      if (hk && jogador()?.hotkeys?.[Number(hk.dataset.atalho)]) { e.preventDefault(); definirAtalho(Number(hk.dataset.atalho), null); }
    });

    // Dica (ponteiro em cima, foco de teclado, toque longo)
    doc.addEventListener("mouseover", (e) => { const d = e.target.closest?.("[data-dica]"); if (d) mostrarDica(d); });
    doc.addEventListener("mouseout", (e) => { const d = e.target.closest?.("[data-dica]"); if (d && !d.contains(e.relatedTarget)) esconderDica(); });
    doc.addEventListener("focusin", (e) => { const d = e.target.closest?.("[data-dica]"); if (d && e.target.matches(":focus-visible")) mostrarDica(d); });
    doc.addEventListener("focusout", () => esconderDica());
    let toqueLongo = null;
    doc.addEventListener("pointerdown", (e) => {
      const d = e.target.closest?.("[data-dica]");
      if (!d || e.pointerType === "mouse") return;
      const x0 = e.clientX, y0 = e.clientY;
      toqueLongo = { t: setTimeout(() => { mostrarDica(d); suprimirClique = true; }, 450), x0, y0 };
    });
    const cancelar = (e) => {
      if (!toqueLongo) return;
      if (e.type === "pointermove" && Math.hypot(e.clientX - toqueLongo.x0, e.clientY - toqueLongo.y0) < 8) return;
      clearTimeout(toqueLongo.t);
      toqueLongo = null;
      if (e.type === "pointerup") setTimeout(esconderDica, 1500);
    };
    doc.addEventListener("pointermove", cancelar);
    doc.addEventListener("pointerup", cancelar);
    doc.addEventListener("pointercancel", cancelar);
  }
  let suprimirClique = false;

  function mostrarDica(el) {
    const id = el.dataset.dica;
    const html = htmlDica(id, el.dataset.dicaOrigem);
    if (!html) return;
    const d = $("#dicaItem");
    d.innerHTML = html;
    d.classList.add("visivel");
    const r = el.getBoundingClientRect(), w = d.offsetWidth, h = d.offsetHeight;
    let x = r.right + 8, y = r.top;
    if (x + w > innerWidth - 8) x = r.left - w - 8;
    if (x < 8) x = Math.max(8, Math.min(innerWidth - w - 8, r.left));
    if (y + h > innerHeight - 8) y = innerHeight - h - 8;
    if (x === r.left || (x < r.right && x + w > r.left)) y = r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8;
    d.style.left = `${Math.round(x)}px`;
    d.style.top = `${Math.round(Math.max(8, y))}px`;
  }
  function esconderDica() { $("#dicaItem").classList.remove("visivel"); }

  // ------------------------------------------------------------------
  // Controles de toque (direcional + ações)
  // ------------------------------------------------------------------
  function ligarToque() {
    const dpad = $("#dpad");
    let ativo = null;
    const zerar = () => {
      if (window.Jogo) Jogo.entrada = { dx: 0, dy: 0 };
      for (const s of $$("#dpad span")) s.classList.remove("ativo");
      ativo = null;
    };
    const ler = (e) => {
      const r = dpad.getBoundingClientRect();
      const col = Math.max(0, Math.min(2, Math.floor(((e.clientX - r.left) / r.width) * 3)));
      const lin = Math.max(0, Math.min(2, Math.floor(((e.clientY - r.top) / r.height) * 3)));
      const dx = col - 1, dy = lin - 1;
      if (window.Jogo) Jogo.entrada = { dx, dy };
      const chave = `${dx},${dy}`;
      if (chave !== ativo) {
        ativo = chave;
        for (const s of $$("#dpad span")) s.classList.toggle("ativo", s.dataset.d === chave);
      }
    };
    dpad.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { dpad.setPointerCapture(e.pointerId); } catch (erro) { /* ponteiro sintético */ }
      ler(e);
    });
    dpad.addEventListener("pointermove", (e) => { if (ativo !== null) ler(e); });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) dpad.addEventListener(ev, zerar);
    dpad.addEventListener("contextmenu", (e) => e.preventDefault());

    for (const b of $$("#acoes [data-acao]")) {
      b.addEventListener("click", () => {
        const acao = b.dataset.acao === "interagir" && b.dataset.tipo === "pesca" ? "pescar" : b.dataset.acao;
        if (acao === "orar") return abrirOracao();
        window.Jogo?.acao(acao);
      });
    }
  }

  const GLIFO_INTERACAO = { npc: "ui_falar", cais: "ui_ancora", pesca: "ui_peixe", portal: "ui_dpad_seta" };
  let interacaoAnterior = "";
  function atualizarToque(p) {
    const b = $("#tInteragir");
    const r = window.Jogo?.podeInteragir?.() || null;
    const chave = r ? `${r.tipo}|${r.rotulo}` : "";
    if (chave !== interacaoAnterior) {
      interacaoAnterior = chave;
      b.hidden = !r;
      if (r) {
        b.dataset.tipo = r.tipo;
        const img = b.querySelector("img");
        const url = glifoURL(GLIFO_INTERACAO[r.tipo] || "ui_falar", 2);
        if (url) img.src = url;
        img.style.transform = r.tipo === "portal" ? "rotate(90deg)" : "";
        b.querySelector(".rot").textContent = r.rotulo;
        b.setAttribute("aria-label", r.rotulo);
      }
    }
    $("#tOrar").hidden = !p.oracaoDesbloqueada;
  }

  // ------------------------------------------------------------------
  // Atualização geral
  // ------------------------------------------------------------------
  function atualizar() {
    const p = jogador();
    if (!p) return;
    $("#moedasValor").textContent = String(p.moedas);
    atualizarBarras(p);
    atualizarPersonagem(p);
    atualizarMissao(p);
    atualizarItens(p);
    atualizarBatalha(p);
    $("#mapaCoord").textContent = `${p.x}, ${p.y}`;
    if (modalAberto?.id === "modalLoja") desenharLoja();
  }

  function areaMudou(area) {
    const nome = (typeof areas !== "undefined" && areas[area]?.nome) || area;
    $("#areaNome").textContent = nome;
    $("#areaTopo").textContent = nome;
    $("#areaSub").textContent = (temArte() && Arte.SUBTITULOS && Arte.SUBTITULOS[area]) || "";
    try { document.documentElement.style.setProperty("--bioma", Arte.minimapaCores(area).chao); } catch (e) { /* reserva */ }
    document.body.dataset.area = area;
    fecharDialogo();
    // Loja e viagem dependem de estar ao lado do NPC; oração e ajuda não.
    if (modalAberto && (modalAberto.id === "modalLoja" || modalAberto.id === "modalViagem")) fecharModal(false);
    alvoDesenhado = undefined;
    assinaturaBatalha = "";
    atualizar();
  }

  // Laço leve a 4 Hz: fé regenerando, veneno, botão de ação, distância do diálogo.
  function tique() {
    const p = jogador();
    if (!p) return;
    atualizarBarras(p);
    atualizarToque(p);
    atualizarBatalha(p);
    if (alvoDesenhado && typeof inimigos !== "undefined" && inimigos[alvoDesenhado]) atualizarVidaAlvo(inimigos[alvoDesenhado]);
    if (dlg.id && dlg.npc && Math.max(Math.abs(p.x - dlg.npc.x), Math.abs(p.y - dlg.npc.y)) > 2) fecharDialogo();
    if (modalAberto?.id === "modalOracao") {
      const b = $("#oracaoFe");
      if (b) definirBarra(b, p.fe || 0, typeof FE_MAXIMA !== "undefined" ? FE_MAXIMA : 100, `${p.fe}/${typeof FE_MAXIMA !== "undefined" ? FE_MAXIMA : 100}`);
    }
  }

  // ------------------------------------------------------------------
  // Botões, teclado da UI e eventos gerais
  // ------------------------------------------------------------------
  async function telaCheia() {
    try {
      if (!document.fullscreenElement) await $("#app").requestFullscreen();
      else await document.exitFullscreen();
    } catch (e) { mensagem("O navegador não permitiu ativar a tela cheia.", "sistema"); }
  }

  function ligarBotoes() {
    $("#btnMapa").addEventListener("click", alternarMinimapa);
    $("#btnTelaCheia").addEventListener("click", telaCheia);
    $("#btnAjuda").addEventListener("click", abrirAjuda);
    $("#btnMenu").addEventListener("click", abrirAjuda);
    $("#btnRegistro").addEventListener("click", () => abrirRegistro(painel("pRegistro").dataset.aberto !== "true"));
    $("#dialogo").addEventListener("click", () => (dlg.mostrado < dlg.texto.length ? completarDialogo() : fecharDialogo()));
    $("#missaoLinha").addEventListener("click", () => {
      const b = $("#missaoLinha");
      b.setAttribute("aria-expanded", String(b.getAttribute("aria-expanded") !== "true"));
    });
    // Abas do médio e folhas do celular
    document.addEventListener("click", (e) => {
      const aba = e.target.closest("[data-aba]");
      if (aba) mostrarAbaMedia(aba.dataset.aba);
      const folha = e.target.closest("[data-folha]");
      if (folha) abrirFolha(folha.dataset.folha);
    });
    $("#folhaFechar").addEventListener("click", fecharFolha);
    // arrastar a alça para baixo fecha a folha
    const alca = $("#folhaAlca");
    let y0 = null;
    alca.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      y0 = e.clientY;
      try { alca.setPointerCapture(e.pointerId); } catch (erro) { /* ignora */ }
    });
    alca.addEventListener("pointermove", (e) => { if (y0 !== null && e.clientY - y0 > 50) { y0 = null; fecharFolha(); } });
    alca.addEventListener("pointerup", () => { y0 = null; });

    // Modais: fechar, véu, ações internas
    for (const m of $$(".modal")) {
      m.addEventListener("click", (e) => {
        if (e.target === m || e.target.closest("[data-fechar]")) { fecharModal(); return; }
        const comprar = e.target.closest("[data-comprar]");
        if (comprar && !comprar.disabled) { executar({ tipo: "comprar", item: comprar.dataset.comprar }); desenharLoja(); return; }
        const vender = e.target.closest("[data-vender]");
        if (vender) { executar({ tipo: "vender", item: vender.dataset.vender }); desenharLoja(); $("#lojaCorpo [data-aba-loja=vender]")?.focus(); return; }
        const abaL = e.target.closest("[data-aba-loja]");
        if (abaL) { abaLoja = abaL.dataset.abaLoja; desenharLoja(); $(`#lojaCorpo [data-aba-loja=${abaLoja}]`)?.focus(); return; }
        const viajar = e.target.closest("[data-viajar]");
        if (viajar && !viajar.disabled) {
          fecharModal(false);
          executar({ tipo: "viajar", areaDestino: viajar.dataset.viajar });
          return;
        }
        const orar = e.target.closest("[data-orar]");
        if (orar) {
          if (orar.getAttribute("aria-disabled") === "true") { mensagem(orar.title || "Ainda não disponível.", "sistema"); return; }
          const r = executar({ tipo: "orar", acao: orar.dataset.orar });
          if (r && r.ok) fecharModal(); else desenharOracao();
          return;
        }
        if (e.target.closest("[data-alternar-toque]")) {
          document.body.classList.toggle("toque-forcado");
          document.body.classList.remove("toque-desligado");
          abrirAjuda();
          return;
        }
        if (e.target.closest("[data-tela-cheia]")) telaCheia();
      });
    }

    document.addEventListener("keydown", (e) => {
      prenderFoco(e);
      if (e.key === "Escape") {
        if (modalAberto) { e.preventDefault(); fecharModal(); return; }
        if ($("#dicaItem").classList.contains("visivel")) { esconderDica(); return; }
        if (selecao) { selecionar(null); return; }
        if (dlg.id) { fecharDialogo(); return; }
        if (folhaAtual) { fecharFolha(); return; }
        return;
      }
      if (e.key === "F1") { e.preventDefault(); if (modalAberto?.id === "modalOracao") fecharModal(); else abrirOracao(); return; }
      if (modalAberto) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if ((e.key === "m" || e.key === "M") && !e.repeat) { e.preventDefault(); alternarMinimapa(); return; }
      if (e.key === "?") { e.preventDefault(); abrirAjuda(); return; }
      if (/^[1-6]$/.test(e.key) && !e.repeat) {
        const i = Number(e.key) - 1;
        const hk = $(`#atalhos [data-atalho="${i}"]`);
        if (hk) { hk.classList.remove("usado"); void hk.offsetWidth; hk.classList.add("usado"); }
        window.Jogo?.usarAtalho(i);
      }
    });
    // O Phaser também escuta "mousedown"/"touchstart" na janela e faria o clique
    // num botão da UI (modal, diálogo, HUD) atravessar até o NPC desenhado embaixo.
    // Só o próprio canvas repassa o toque/clique para o mundo.
    for (const tipo of ["mousedown", "touchstart", "pointerdown"]) {
      document.addEventListener(tipo, (e) => {
        if (!(e.target instanceof Element) || !e.target.closest("#game-root")) e.stopPropagation();
      }, { passive: true });
    }
    // Ao clicar no mundo, tira o foco de botões da UI (as teclas voltam ao jogo).
    $("#game-root").addEventListener("pointerdown", () => {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
      esconderDica();
    });
  }

  // ------------------------------------------------------------------
  // Início
  // ------------------------------------------------------------------
  function iniciar() {
    aplicarTexturas();
    preencherGlifos();
    montar();
    ligarBotoes();
    ligarItens();
    ligarToque();
    observarMochila();
    const re = () => { montar(); medirRodape(); };
    for (const q of ["(min-width: 1280px)", "(max-width: 760px)"]) {
      const mq = matchMedia(q);
      (mq.addEventListener ? mq.addEventListener("change", re) : mq.addListener(re));
    }
    addEventListener("resize", medirRodape);
    setInterval(tique, 250);
    requestAnimationFrame(laçoRecarga);
    atualizar();
    if (!temArte()) console.warn("[interface] sprites.js ausente: ícones substituídos por letras.");
  }

  window.UI = {
    atualizar,
    mensagem,
    dialogo,
    abrirLoja,
    abrirViagem,
    abrirOracao,
    abrirAjuda,
    alternarMinimapa,
    atualizarMinimapa() { /* o MUNDO desenha o minimapa no #miniMap (game.js) */ },
    areaMudou,
    registro: () => registro.slice(),
  };
  // Compatibilidade com o código antigo
  window.atualizarInterface = () => UI.atualizar();
  window.mostrarMensagem = (t) => UI.mensagem(t);
  window.abrirLoja = () => UI.abrirLoja();
  window.abrirViagem = () => UI.abrirViagem();
  window.abrirOracao = () => UI.abrirOracao();
  window.alternarMinimapa = () => UI.alternarMinimapa();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
