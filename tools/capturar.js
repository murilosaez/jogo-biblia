#!/usr/bin/env node
// =====================================================================
// tools/capturar.js — capturas de tela e medidas para conferir a arte, o layout e o movimento do jogo.
//
// Uso:
//   node tools/capturar.js [pasta-de-saida] [opções]
//   node tools/capturar.js --comparar <pastaA> <pastaB> [pasta-de-saida]
//
// Pasta de saída: se não for dada, cada execução cria uma pasta nova e só dela (capturas-XXXXXX em
// $CAPTURAR_BASE ou na pasta temporária do sistema). Vários agentes podem rodar ao mesmo tempo: o servidor
// HTTP usa uma porta livre qualquer e cada execução abre o seu navegador.
//
// Opções:
//   --so-folhas          só as folhas de contato (página leve, sem Phaser nem jogo: segundos)
//   --familia <lista>    só estas famílias nas folhas (separadas por vírgula, pode repetir):
//                        in_ al_ pj_ pv_ mt_ ob_ es_ dc_ mk_ fx_ ui_ hb_ of_ itens (= sem prefixo)
//                        e também: tilesets cenario
//   --com-portais        inclui mk_portal_* na folha mk_ (fora por padrão)
//   --tamanhos           tela inteira em 1366x768, 1600x900, 1920x1080 e 390x844 (toque emulado) + medidas
//   --deslize            anda 10 casas em linha reta e 6 na diagonal e observa uma criatura: amostra a
//                        posição do sprite a cada quadro desenhado; 6 instantâneos de um passo
//   --combate            vai até um inimigo, ataca: 6 quadros do golpe e 2 depois da morte
//   --atras              jogador ao norte de uma árvore alta, ao norte de uma casa e dentro de uma casa
//   --tudo               = --tamanhos --deslize --combate --atras
//   --sem-regioes        não percorre as regiões
//   --sem-desempenho     não mede o intervalo entre quadros ao andar 30 casas
//   --largura N --altura N   viewport da execução principal (padrão 1600x900)
//   --raiz <pasta>       serve o jogo desta pasta (ex.: uma cópia de `git archive HEAD`) em vez do repositório
//   --cache <pasta>      onde guardar a cópia local do Phaser (padrão: cache-capturar ao lado da saída)
//   --estrito            sai com código 2 se houver erro de página ou problema em Arte.validar()
//
// Arquivos gravados:
//   01-inicio.png, 02-apos-andar.png, 02b-andando.png          tela inteira
//   03-folha-<familia>[-N].png   folhas de contato: escala pelo tamanho do sprite, rótulo com a chave e,
//                                quando a def tem `direcoes`, uma linha por vista com todos os quadros
//   03-folha-tilesets.png        o tileset de cada região
//   03-folha-cenario[-N].png     texturas de cenario.js: prédios, muros, portas, móveis e chão por região
//   04-regiao-<area>[-zoom].png  tela inteira em cada região e o centro ampliado 3×
//   05-deslize-*.png             (--deslize) 6 instantâneos de um passo, a tira deles e a criatura andando
//   06-combate-*.png             (--combate) 6 quadros do golpe, 2 depois da morte, as tiras e a tela
//   07-atras-*.png               (--atras) tela e centro ampliado nas três posições
//   08-tela-<LxA>.png            (--tamanhos)
//   relatorio.json               o que foi gravado, erros da página, Arte.validar(), medidas dos sprites
//                                (tamanho, quadros, cores, tempo de geração), tempos do chão, layout por
//                                tamanho de tela, deslize, combate e desempenho
//
// O Phaser vem de CDN: a ferramenta intercepta o pedido e serve uma cópia local (baixada com curl na
// primeira vez), então funciona atrás de proxy e sem rede depois da 1ª execução.
// Não altera nenhum arquivo do jogo.
// =====================================================================
"use strict";
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const URL_PHASER = "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js";
const TAMANHOS = [
  { nome: "1366x768", w: 1366, h: 768 },
  { nome: "1600x900", w: 1600, h: 900 },
  { nome: "1920x1080", w: 1920, h: 1080 },
  { nome: "390x844", w: 390, h: 844, toque: true, dpr: 3 },
];
const PREFIXOS = ["in_", "al_", "pj_", "pv_", "mt_", "ob_", "es_", "dc_", "mk_", "fx_", "ui_", "hb_", "of_"];

// ---------- argumentos ----------
const args = process.argv.slice(2);
const opc = {
  largura: 1600, altura: 900, regioes: true, desempenho: true, cache: null, raiz: null, soFolhas: false, familias: [],
  portais: false, tamanhos: false, deslize: false, combate: false, atras: false, comparar: null, estrito: false,
};
const soltos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--largura") opc.largura = Number(args[++i]);
  else if (a === "--altura") opc.altura = Number(args[++i]);
  else if (a === "--sem-regioes") opc.regioes = false;
  else if (a === "--sem-desempenho") opc.desempenho = false;
  else if (a === "--cache") opc.cache = args[++i];
  else if (a === "--raiz") opc.raiz = args[++i];
  else if (a === "--so-folhas") opc.soFolhas = true;
  else if (a === "--familia") opc.familias.push(...String(args[++i] || "").split(",").map((s) => s.trim()).filter(Boolean));
  else if (a === "--com-portais") opc.portais = true;
  else if (a === "--tamanhos") opc.tamanhos = true;
  else if (a === "--deslize") opc.deslize = true;
  else if (a === "--combate") opc.combate = true;
  else if (a === "--atras") opc.atras = true;
  else if (a === "--tudo") opc.tamanhos = opc.deslize = opc.combate = opc.atras = true;
  else if (a === "--estrito") opc.estrito = true;
  else if (a === "--comparar") { opc.comparar = [args[++i], args[++i]]; }
  else if (a === "-h" || a === "--help") {
    const txt = fs.readFileSync(__filename, "utf8").split("\n");
    console.log(txt.slice(1, txt.findIndex((l) => l.startsWith('"use strict"')) - 1).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    process.exit(0);
  } else if (a.startsWith("--")) { console.error("opção desconhecida:", a); process.exit(1); } else soltos.push(a);
}
// "itens" e "in" valem como "itens" e "in_"
opc.familias = opc.familias.map((f) => (PREFIXOS.includes(f + "_") ? f + "_" : f));
if (opc.comparar && (!opc.comparar[0] || !opc.comparar[1])) { console.error("uso: --comparar <pastaA> <pastaB> [pasta-de-saida]"); process.exit(1); }

const RAIZ = path.resolve(opc.raiz || path.join(__dirname, ".."));
function pastaPropria() {
  const base = path.resolve(process.env.CAPTURAR_BASE || os.tmpdir());
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, opc.comparar ? "comparacao-" : "capturas-"));
}
const SAIDA = soltos[0] ? path.resolve(soltos[0]) : pastaPropria();
const CACHE = path.resolve(opc.cache || process.env.CAPTURAR_CACHE || path.join(path.dirname(SAIDA), "cache-capturar"));
fs.mkdirSync(SAIDA, { recursive: true });

const { chromium } = require("playwright");

// ---------- servidor estático (porta livre; rotas extras só desta execução) ----------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8" };
// Scripts locais do index.html, na ordem (sem o Phaser, que é de CDN).
function scriptsDoIndex() {
  const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  return [...html.matchAll(/<script\s+[^>]*src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s));
}
// Página leve para as folhas: dados, lógica, sprites.js, arte/*.js e cenario.js — sem Phaser, game.js nem
// interface.js. Um <script> que falhe (arquivo de outro pacote a meio caminho) não derruba os demais.
function paginaDeArte() {
  const scripts = scriptsDoIndex().filter((s) => !/(^|\/)(game|interface)\.js(\?|$)/.test(s));
  return `<!doctype html><meta charset="utf-8"><title>arte</title><body style="margin:0;background:#1c1210">\n` +
    scripts.map((s) => `<script src="${s}"></script>`).join("\n") + `\n<script>window.__arteCarregada = true;</script>`;
}
function servidor(montagens = {}) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      let rel;
      try { rel = decodeURIComponent(req.url.split("?")[0]); } catch (e) { res.writeHead(400); res.end("400"); return; }
      if (rel === "/__arte.html") { res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" }); res.end(paginaDeArte()); return; }
      if (rel === "/__branco.html") { res.writeHead(200, { "Content-Type": MIME[".html"] }); res.end("<!doctype html><meta charset=utf-8><body></body>"); return; }
      if (rel === "/") rel = "/index.html";
      let raiz = RAIZ;
      for (const [prefixo, pasta] of Object.entries(montagens)) if (rel.startsWith(prefixo)) { raiz = pasta; rel = "/" + rel.slice(prefixo.length); }
      const arq = path.join(raiz, path.normalize(rel));
      if (!arq.startsWith(raiz + path.sep) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); res.end("404"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(arq)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(arq).pipe(res);
    });
    s.listen(0, "127.0.0.1", () => ok(s));
  });
}

function phaserLocal() {
  fs.mkdirSync(CACHE, { recursive: true });
  const arq = path.join(CACHE, "phaser-3.80.1.min.js");
  if (!fs.existsSync(arq) || fs.statSync(arq).size < 500000) {
    // baixa para um nome só desta execução e renomeia: duas execuções ao mesmo tempo não se atropelam
    const tmp = `${arq}.${process.pid}.tmp`;
    console.log("baixando o Phaser para", arq);
    execFileSync("curl", ["-sSfL", "-o", tmp, URL_PHASER], { stdio: "inherit" });
    fs.renameSync(tmp, arq);
  }
  return arq;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const arred = (n, casas = 1) => (Number.isFinite(n) ? Number(n.toFixed(casas)) : null);

// =====================================================================
// Código que roda DENTRO da página
// =====================================================================

// Folhas de contato e medidas dos sprites (página leve ou do jogo). Devolve { folhas: {nome: [dataURL]}, ... }.
function naPaginaFolhas(o) {
  const A = window.Arte, PP = A.PIXEL_PATTERNS;
  const avisos = [];
  // variantes do jogador e humanos gerados sob demanda
  try {
    for (const eq of [{}, { arma: "espada_madeira" }, { arma: "espada_ferro", escudo: "escudo_bronze", armadura: "armadura_couro" }, { arma: "espada_temperada", escudo: "escudo_ferro", armadura: "couraca_escamas" }]) A.garantirJogador(eq, {});
  } catch (e) { avisos.push("garantirJogador: " + e.message); }
  try { for (const fonte of [A.VISUAL_NPC, A.VISUAL_INIMIGO]) for (const id of Object.keys(fonte || {})) A.visualDe && A.visualDe(id); } catch (e) { avisos.push("visualDe: " + e.message); }

  const familiaDe = (k) => o.prefixos.find((p) => k.startsWith(p)) || "itens";
  const quer = (f) => !o.familias.length || o.familias.includes(f);
  const chaves = Object.keys(PP).sort();

  // ---- tempo de geração (a frio: nada foi desenhado ainda nesta página) e cores por sprite ----
  const medidas = {}, tempoFamilia = {}, erros = [];
  const t0 = performance.now();
  let totalQuadros = 0;
  for (const k of chaves) {
    const d = PP[k], n = d.quadros || 1, f = familiaDe(k);
    const ta = performance.now();
    let w = 0, h = 0, res = d.res || 1, cores = 0, falhou = null;
    for (let q = 0; q < n; q++) {
      try {
        const px = A.pixels(k, { quadro: q });
        if (q === 0) { w = px.w; h = px.h; res = px.res || res; }
        if (px.data && typeof px.data.length === "number") {
          const s = new Set();
          for (let i = 0; i < px.data.length; i++) if (px.data[i]) s.add(px.data[i]);
          cores = Math.max(cores, s.size);
        }
      } catch (e) { falhou = falhou || `quadro ${q}: ${e.message}`; }
    }
    const ms = performance.now() - ta;
    totalQuadros += n;
    tempoFamilia[f] = (tempoFamilia[f] || 0) + ms;
    medidas[k] = { w, h, res, quadros: n, cores, ms: Number(ms.toFixed(2)) };
    if (d.direcoes) { medidas[k].vistas = Number(d.direcoes) || 3; medidas[k].quadrosPorVista = d.quadrosPorVista || 5; }
    if (falhou) { medidas[k].erro = falhou; erros.push(`${k}: ${falhou}`); }
  }
  const geracao = {
    msTotal: Number((performance.now() - t0).toFixed(1)), sprites: chaves.length, quadros: totalQuadros,
    msPorFamilia: Object.fromEntries(Object.entries(tempoFamilia).map(([f, v]) => [f, Number(v.toFixed(1))])),
    maisLentos: chaves.map((k) => [k, medidas[k].ms]).sort((a, b) => b[1] - a[1]).slice(0, 12),
    maisCores: chaves.map((k) => [k, medidas[k].cores]).sort((a, b) => b[1] - a[1]).slice(0, 12),
  };
  let validar = null;
  try { validar = A.validar(); } catch (e) { validar = ["Arte.validar() lançou: " + e.message]; }

  // ---- folhas ----
  const FUNDO = "#3a4a2c", FUNDO2 = "#465837", FUNDO3 = "#52653f", TEXTO = "#f3e4c0", FRACO = "#c9d3a8";
  const NOME_VISTA = ["lado", "frente", "costas"];
  // px de tela por px de arte, pelo tamanho do sprite (um quadro fica com cerca de 100 a 200 px de largura)
  const zoomDe = (w) => (w <= 16 ? 6 : w <= 24 ? 5 : w <= 40 ? 4 : w <= 64 ? 3 : w <= 128 ? 2 : 1);
  function bloco(k) {
    const d = PP[k], m = medidas[k];
    if (!m.w) return null;
    const z = zoomDe(m.w), n = m.quadros;
    const porLinha = d.direcoes ? (d.quadrosPorVista || 5) : Math.min(n, 12);
    const linhas = [];
    for (let q = 0; q < n; q += porLinha) {
      const cs = [];
      for (let i = q; i < Math.min(n, q + porLinha); i++) { try { cs.push(A.canvas(k, { quadro: i, escala: z * m.res })); } catch (e) { cs.push(null); } }
      linhas.push(cs);
    }
    const qw = m.w * z, qh = m.h * z, MARGEM = d.direcoes ? 44 : 0;
    return { k, d, m, z, linhas, qw, qh, MARGEM, w: Math.max(MARGEM + porLinha * (qw + 3), 150), h: linhas.length * (qh + 3) + 16 };
  }
  function folha(titulo, lista) {
    const blocos = lista.map(bloco).filter(Boolean);
    if (!blocos.length) return [];
    const LARG = 2400, PAD = 8, ALT_MAX = 2600;
    // prateleiras; quando passa de ALT_MAX começa outra página
    const paginas = [[]];
    let x = PAD, y = 36, hLinha = 0;
    for (const b of blocos) {
      if (x + b.w > LARG - PAD && x > PAD) { x = PAD; y += hLinha + PAD; hLinha = 0; }
      if (y + b.h > ALT_MAX && y > 36) { paginas.push([]); x = PAD; y = 36; hLinha = 0; }
      paginas[paginas.length - 1].push({ b, x, y });
      x += b.w + PAD; hLinha = Math.max(hLinha, b.h);
    }
    return paginas.map((pos, i) => {
      const c = document.createElement("canvas");
      c.width = LARG; c.height = Math.max(...pos.map((p) => p.y + p.b.h)) + PAD;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.fillStyle = FUNDO; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = TEXTO; g.font = "bold 18px sans-serif"; g.textBaseline = "top";
      g.fillText(`${titulo} — ${blocos.length} sprites${paginas.length > 1 ? ` (página ${i + 1}/${paginas.length})` : ""} · escala pelo tamanho (no rótulo)`, PAD, 8);
      for (const { b, x: X, y: Y } of pos) {
        b.linhas.forEach((cs, li) => {
          const ly = Y + li * (b.qh + 3);
          if (b.MARGEM) { g.fillStyle = FRACO; g.font = "10px sans-serif"; g.fillText(NOME_VISTA[li] || `v${li}`, X, ly + 2); g.fillText(`${li * cs.length}–${li * cs.length + cs.length - 1}`, X, ly + 14); }
          cs.forEach((q, qi) => {
            const cx = X + b.MARGEM + qi * (b.qw + 3);
            g.fillStyle = (qi + li) % 2 ? FUNDO3 : FUNDO2; g.fillRect(cx, ly, b.qw, b.qh);
            if (q) g.drawImage(q, cx, ly); else { g.fillStyle = "#c03030"; g.fillRect(cx, ly, b.qw, 3); }
          });
        });
        g.fillStyle = TEXTO; g.font = "11px sans-serif";
        g.fillText(`${b.k}  ${b.m.w}×${b.m.h} px · ${b.m.quadros}q · ${b.m.cores} cores · ${b.z}×`, X, Y + b.h - 14);
      }
      return c.toDataURL("image/png");
    });
  }
  const TITULO = {
    in_: "Inimigos (in_): criaturas e humanos hostis", al_: "Aliados (al_)", pj_: "Jogador e NPCs (pj_)", pv_: "Prévias (pv_), ainda não ativadas",
    mt_: "Montarias (mt_)", ob_: "Obstáculos por região (ob_)", es_: "Estruturas (es_)", dc_: "Decoração (dc_)", mk_: "Marcos (mk_)",
    fx_: "Efeitos (fx_)", ui_: "Glifos de interface (ui_)", hb_: "Habilidades (hb_)", of_: "Ofícios (of_)", itens: "Itens (sem prefixo)",
  };
  const grupos = {};
  for (const k of chaves) {
    const f = familiaDe(k);
    if (!quer(f)) continue;
    if (f === "mk_" && !o.portais && k.startsWith("mk_portal_")) continue;
    (grupos[f] = grupos[f] || []).push(k);
  }
  const folhas = {}, contagem = {};
  for (const [f, lista] of Object.entries(grupos)) {
    contagem[f] = lista.length;
    try { folhas[f.replace(/_$/, "")] = folha(TITULO[f] || f, lista); } catch (e) { erros.push(`folha ${f}: ${e.message}`); }
  }

  // ---- tilesets ----
  let tilesets = null;
  if (quer("tilesets")) {
    const areas = Object.keys(A.BIOMAS), ms = {};
    const tiles = areas.map((a) => { try { const t = A.gerarTileset(a); ms[a] = Number((t.ms || 0).toFixed(1)); return { a, c: t.canvas }; } catch (e) { erros.push(`tileset ${a}: ${e.message}`); return null; } }).filter(Boolean);
    if (tiles.length) {
      const Z = 2, PADT = 10;
      const c = document.createElement("canvas");
      c.width = tiles.reduce((s, t) => s + t.c.width * Z + PADT, PADT);
      c.height = Math.max(...tiles.map((t) => t.c.height)) * Z + 40;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.fillStyle = "#1c1210"; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = TEXTO; g.font = "bold 16px sans-serif"; g.textBaseline = "top";
      let x = PADT;
      for (const t of tiles) { g.fillText(`ts_${t.a} ${t.c.width}×${t.c.height}`, x, 8); g.drawImage(t.c, x, 32, t.c.width * Z, t.c.height * Z); x += t.c.width * Z + PADT; }
      tilesets = { url: c.toDataURL("image/png"), ms };
    }
  }
  return { folhas, contagem, medidas, geracao, validar, tilesets, erros, avisos, res: A.RES, px: A.PX, versao: A.versao };
}

// Folha das texturas de cenario.js. Usa a cena do jogo (window.gameScene) quando existe; na página leve usa
// um gerenciador de texturas de mentira com a mesma interface que cenario.js chama.
function naPaginaCenario() {
  const C = window.Cenario;
  if (!C) return { erro: "window.Cenario não existe" };
  const mapa = new Map();
  const cena = window.gameScene || {
    textures: {
      exists: (k) => mapa.has(k),
      addCanvas: (k, c) => { mapa.set(k, c); return { add() {}, refresh() {} }; },
      get: (k) => ({ getSourceImage: () => mapa.get(k), refresh() {} }),
    },
  };
  const origem = window.gameScene ? "cena do jogo" : "página leve (texturas de mentira)";
  const itens = [], erros = [], tempos = {};
  const tenta = (grupo, rotulo, f) => {
    try {
      const t0 = performance.now(), chave = f(), ms = performance.now() - t0;
      const lista = typeof chave === "string" ? [[rotulo, chave]] : Object.entries(chave).map(([n, k]) => [`${rotulo} · ${n}`, k]);
      for (const [r, k] of lista) {
        const img = cena.textures.get(k).getSourceImage();
        if (img && img.width) itens.push({ grupo, rotulo: r, chave: k, img, ms });
        else erros.push(`${r}: textura ${k} vazia`);
      }
      return ms;
    } catch (e) { erros.push(`${rotulo}: ${e.message}`); return null; }
  };
  // prédios onde se entra: um de cada (tipo, variante, tamanho), no máximo 14
  const vistos = new Set(), variantes = new Set([0]), moveis = new Map();
  const estruturas = typeof estruturasPorArea !== "undefined" ? estruturasPorArea : {};
  for (const [area, lista] of Object.entries(estruturas)) for (const e of lista) {
    if (!e.entrar) continue;
    variantes.add(e.variante || 0);
    for (const m of e.moveis || []) if (!moveis.has(m.tipo)) moveis.set(m.tipo, e.variante || 0);
    const id = `${e.tipo}|${e.variante || 0}|${e.largura}x${e.altura}`;
    if (vistos.has(id) || vistos.size >= 14) continue;
    vistos.add(id);
    tenta("prédios", `${area} ${e.tipo} v${e.variante || 0} ${e.largura}×${e.altura}`, () => C.texturasPredio(cena, e));
  }
  for (const tipo of Object.keys(C.MUROS || {})) for (const [nome, mask] of [["L-O", 10], ["N-S", 5], ["canto", 6], ["cruz", 15], ["ponta L", 2], ["ponta S", 4]])
    tenta("muros", `muro ${tipo} ${nome}`, () => C.texturaMuro(cena, tipo, mask, 0));
  for (const v of [...variantes].sort()) for (const aberta of [false, true])
    tenta("portas", `porta v${v} ${aberta ? "aberta" : "fechada"}`, () => C.texturaPorta(cena, v, aberta));
  for (const [tipo, v] of moveis) {
    tenta("móveis", `móvel ${tipo}`, () => C.texturaMovel(cena, tipo, v, {}, 0));
    if (tipo === "balcao") tenta("móveis", "móvel balcao (meio)", () => C.texturaMovel(cena, tipo, v, { esq: true, dir: true }, 1));
  }
  // um pedaço de chão por região: o da chegada (o tempo é o da pintura a frio do pedaço)
  const lado = C.LADO_PEDACO || 16;
  for (const area of Object.keys(window.Arte.BIOMAS)) {
    if (area === "mar") continue;
    const a = (typeof areas !== "undefined" && areas[area]) || {}, c = a.chegadaViagem || a.inicio || { x: 24, y: 24 };
    let bx = Math.floor(c.x / lado), by = Math.floor(c.y / lado);
    // se a cena do jogo já pintou esse pedaço, mede num vizinho ainda não pintado
    for (let i = 0; i < 4 && cena.textures.exists(`chao_${area}_${bx}_${by}`); i++) bx += 1;
    const ms = tenta("chão", `chão ${area} pedaço ${bx},${by}`, () => C.texturaPedacoChao(cena, area, bx, by));
    if (ms != null) tempos[area] = Number(ms.toFixed(1));
  }
  if (!itens.length) return { erro: "nenhuma textura de cenário", erros, origem };
  // empacota em prateleiras, com páginas
  const zoomDe = (w) => (w <= 64 ? 3 : w <= 220 ? 2 : 1);
  const LARG = 2400, PAD = 10, ALT_MAX = 2600;
  const paginas = [[]];
  let x = PAD, y = 36, hLinha = 0;
  for (const it of itens) {
    it.z = zoomDe(it.img.width);
    const w = Math.max(it.img.width * it.z, 170), h = it.img.height * it.z + 16;
    if (x + w > LARG - PAD && x > PAD) { x = PAD; y += hLinha + PAD; hLinha = 0; }
    if (y + h > ALT_MAX && y > 36) { paginas.push([]); x = PAD; y = 36; hLinha = 0; }
    paginas[paginas.length - 1].push({ it, x, y, h });
    x += w + PAD; hLinha = Math.max(hLinha, h);
  }
  const urls = paginas.map((pos, i) => {
    const c = document.createElement("canvas");
    c.width = LARG; c.height = Math.max(...pos.map((p) => p.y + p.h)) + PAD;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#3a4a2c"; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#f3e4c0"; g.font = "bold 18px sans-serif"; g.textBaseline = "top";
    g.fillText(`Cenário (cenario.js) — ${itens.length} texturas${paginas.length > 1 ? ` (página ${i + 1}/${paginas.length})` : ""} · ${origem}`, PAD, 8);
    g.font = "11px sans-serif";
    for (const { it, x: X, y: Y } of pos) {
      const w = it.img.width * it.z, h = it.img.height * it.z;
      g.fillStyle = "#465837"; g.fillRect(X, Y, w, h);
      g.drawImage(it.img, X, Y, w, h);
      g.fillStyle = "#f3e4c0";
      g.fillText(`${it.rotulo}  ${it.img.width}×${it.img.height} · ${it.z}×`, X, Y + h + 2);
    }
    return c.toDataURL("image/png");
  });
  return { urls, erros, origem, contagem: itens.length, msPedacoChao: tempos, texturas: itens.map((it) => ({ grupo: it.grupo, rotulo: it.rotulo, chave: it.chave, w: it.img.width, h: it.img.height })) };
}

// Ferramentas instaladas na página do jogo (window.__cap): amostragem por quadro desenhado, recortes do
// canvas do jogo, busca de casas e teleporte pela lógica. Só lê o estado; quem age é a lógica do jogo.
function naPaginaInstalar() {
  if (window.__cap) return;
  const cena = () => window.gameScene;
  const T = typeof TAM !== "undefined" ? TAM : 32;
  let am = null;
  // Recorte do canvas do jogo, centrado num ponto do mundo, com `cw` × `ch` casas.
  function recorte(wx, wy, cw, ch) {
    const s = cena(), cam = s.cameras.main, z = cam.zoom, src = s.game.canvas;
    const w = Math.round(cw * T * z), h = Math.round(ch * T * z);
    const sx = Math.round((wx - cam.worldView.x) * z - w / 2), sy = Math.round((wy - cam.worldView.y) * z - h / 2);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.fillStyle = "#1c1210"; g.fillRect(0, 0, w, h);
    g.drawImage(src, sx, sy, w, h, 0, 0, w, h);
    return c;
  }
  function aoDesenhar() {
    const s = cena();
    if (!am || !s || !s.jogador || !s.jogador.active) return;
    const t = performance.now(), j = s.jogador;
    const a = { t, x: j.x, y: j.y, lx: s.p.x, ly: s.p.y, q: j.frame ? j.frame.name : null };
    if (am.o.ents) {
      a.e = {};
      for (const ent of Object.values(s.entidades || {})) if (ent.tipo === "inimigo" && ent.sprite && ent.sprite.active) a.e[ent.id] = [ent.sprite.x, ent.sprite.y, ent.dados.x, ent.dados.y];
    }
    if (am.ult && (a.lx !== am.ult.lx || a.ly !== am.ult.ly)) am.passos++;
    am.ult = a;
    const cp = am.o.passo;
    if (cp && am.passos >= cp.de && am.passos < cp.ate && am.quadros.length < 80) am.quadros.push({ t, passo: am.passos, c: recorte(j.x, j.y - T / 2, cp.casas[0], cp.casas[1]) });
    // gatilho da morte: no quadro em que a vida do inimigo observado zera, agenda os recortes pedidos,
    // centrados entre o jogador e o último lugar em que a criatura foi vista
    if (am.morte && Mundo.obterVidaInimigo(s.p.id, am.morte.id) <= 0) {
      const u = am.morte.ultimo || [j.x, j.y];
      am.t0 = t;
      am.agenda = am.morte.lista.map((g) => ({ ...g, x: (j.x + u[0]) / 2, y: (j.y + u[1]) / 2 - T / 2 }));
      am.morte = null;
    } else if (am.morte) {
      const ent = (s.entidades || {})[am.morte.id];
      if (ent && ent.sprite && ent.sprite.active) am.morte.ultimo = [ent.sprite.x, ent.sprite.y];
    }
    while (am.agenda.length && t - am.t0 >= am.agenda[0].ms) {
      const g = am.agenda.shift();
      am.quadros.push({ t: t - am.t0, pedido: g.ms, nome: g.nome, c: recorte(g.x, g.y, g.casas[0], g.casas[1]) });
    }
    am.dados.push(a);
  }
  let ligado = null;
  function ligar() {
    const g = cena().game;
    if (ligado === g) return;
    ligado = g;
    if (g.events && g.events.on) g.events.on("postrender", aoDesenhar);
    else { const laco = () => { aoDesenhar(); requestAnimationFrame(laco); }; requestAnimationFrame(laco); }
  }
  window.__cap = {
    T,
    iniciar(o = {}) { ligar(); am = { o, dados: [], quadros: [], agenda: [], passos: 0, ult: null, t0: 0 }; },
    // agenda recortes a `ms` depois de agora, centrados em (x, y) do mundo
    agendar(lista) { if (!am) return; am.t0 = performance.now(); am.agenda = lista.slice().sort((a, b) => a.ms - b.ms); },
    temAgenda() { return !!(am && am.agenda.length); },
    aoMorrer(id, lista) { if (am) am.morte = { id, lista, ultimo: null }; },
    pendentes() { return am ? am.agenda.length + (am.morte ? am.morte.lista.length : 0) : 0; },
    parar() {
      const r = am; am = null;
      if (!r) return null;
      return { dados: r.dados, passos: r.passos, quadros: r.quadros.map((q) => ({ t: q.t, passo: q.passo, pedido: q.pedido, nome: q.nome, url: q.c.toDataURL("image/png") })) };
    },
    // junta imagens (dataURL) numa tira horizontal com rótulos
    async tira(urls, rotulos = [], titulo = "") {
      const imgs = [];
      for (const u of urls) { const i = new Image(); i.src = u; await i.decode(); imgs.push(i); }
      const PAD = 6, TOPO = titulo ? 24 : 4;
      const c = document.createElement("canvas");
      c.width = imgs.reduce((s, i) => s + i.width + PAD, PAD); c.height = Math.max(...imgs.map((i) => i.height)) + TOPO + 20;
      const g = c.getContext("2d");
      g.fillStyle = "#1c1210"; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = "#f3e4c0"; g.textBaseline = "top"; g.font = "bold 14px sans-serif";
      if (titulo) g.fillText(titulo, PAD, 5);
      g.font = "12px sans-serif";
      let x = PAD;
      imgs.forEach((i, n) => { g.drawImage(i, x, TOPO); g.fillText(rotulos[n] || String(n + 1), x + 2, TOPO + i.height + 3); x += i.width + PAD; });
      return c.toDataURL("image/png");
    },
    estado() {
      const s = cena();
      return { x: s.p.x, y: s.p.y, area: s.p.area, sx: s.jogador.x, sy: s.jogador.y, vida: s.p.vida };
    },
    teleportar(area, x, y) {
      const s = cena(), p = Mundo.jogadores[s.p.id] || s.p;
      Mundo.mudarDeArea(p, area, x, y, null);
      s.trocarArea(null);
      return true;
    },
    // casas livres para o jogador pisar (sem transição de área) e inimigos vivos da área
    _livre(x, y) {
      const s = cena();
      if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) return false;
      if (!Mundo.casaLivre(x, y, s.p, true)) return false;
      if (Mundo.casaParaFicar && !Mundo.casaParaFicar(s.p.area, x, y)) return false;
      try { if (s.casasDeTransicao().has(y * COLS + x)) return false; } catch (e) { /* cena sem a função */ }
      return true;
    },
    _vivos() {
      const s = cena();
      return Object.values(inimigos).filter((e) => e.area === s.areaAtual && Mundo.obterVidaInimigo(s.p.id, e.id) > 0);
    },
    // Corredor de n+2 casas livres na direção (dx, dy), a céu aberto, o mais longe possível de inimigos
    // (para ninguém interromper) e, entre os bons, o mais perto do jogador.
    corredor(n, dx, dy) {
      const s = cena(), vivos = this._vivos(), area = s.areaAtual;
      const ceu = (x, y) => pisos[area][y][x] !== PISO.INTERIOR && pisos[area][y][x] !== PISO.PORTA;
      let melhor = null;
      for (let y = 2; y < ROWS - 2; y++) for (let x = 2; x < COLS - 2; x++) {
        let ok = true;
        for (let i = 0; i <= n + 1 && ok; i++) {
          const cx = x + i * dx, cy = y + i * dy;
          ok = this._livre(cx, cy) && ceu(cx, cy);
          if (ok && dx && dy) ok = this._livre(cx + dx, cy) && this._livre(cx, cy + dy);
        }
        if (!ok) continue;
        let perto = 99;
        for (const e of vivos) for (let i = 0; i <= n; i += 2) perto = Math.min(perto, Math.max(Math.abs(e.x - (x + i * dx)), Math.abs(e.y - (y + i * dy))));
        const nota = Math.min(perto, 9) * 1000 - Math.max(Math.abs(x - s.p.x), Math.abs(y - s.p.y));
        if (!melhor || nota > melhor.nota) melhor = { x, y, nota, inimigoMaisPerto: perto };
      }
      return melhor;
    },
    // casa livre a `dist` casas (Chebyshev) de um inimigo vivo comum; devolve { id, x, y }
    pertoDeInimigo(dist, criterio = "fraco") {
      const s = cena();
      let melhor = null;
      for (const e of this._vivos()) {
        if (e.nomeado) continue;
        const ficha = Mundo.fichaInimigo ? Mundo.fichaInimigo(s.p.id, e.id) : null;
        if (ficha && (ficha.campeao || ficha.nomeado)) continue;
        const vida = Mundo.vidaMaximaInimigo ? Mundo.vidaMaximaInimigo(s.p.id, e.id) : Mundo.obterVidaInimigo(s.p.id, e.id);
        const outros = this._vivos().filter((o) => o.id !== e.id && Math.max(Math.abs(o.x - e.x), Math.abs(o.y - e.y)) <= 5).length;
        // de preferência à esquerda do inimigo (o golpe sai de lado), depois abaixo, acima, à direita
        for (const [dx, dy] of [[-1, 0], [0, 1], [0, -1], [1, 0], [-1, 1], [-1, -1], [1, 1], [1, -1]]) {
          const x = e.x + dx * dist, y = e.y + dy * dist;
          if (!this._livre(x, y)) continue;
          if (dist > 1 && Mundo.linhaDeTiroLivre && !Mundo.linhaDeTiroLivre({ x, y, area: s.areaAtual }, e)) continue;
          const nota = criterio === "fraco" ? -vida * 10 - outros * 25 : -outros * 25 - vida;
          if (!melhor || nota > melhor.nota) melhor = { id: e.id, nome: e.nome, x, y, ex: e.x, ey: e.y, vidaMaxima: vida, vizinhos: outros, nota };
          break;
        }
      }
      return melhor;
    },
    // posições para --atras na área atual
    atras() {
      const s = cena(), area = s.areaAtual, out = {};
      const dist = (x, y) => Math.max(Math.abs(x - s.p.x), Math.abs(y - s.p.y));
      // árvore alta com casa livre logo ao norte
      let m = null;
      for (let y = 3; y < ROWS - 2; y++) for (let x = 2; x < COLS - 2; x++) {
        if (!mapas[area][y][x] || pisos[area][y][x] === PISO.AGUA || pisos[area][y][x] >= PISO.ESTRUTURA) continue;
        let tipo = null;
        try { tipo = Arte.tipoObstaculo(area, x, y); } catch (e) { /* sem obstáculo */ }
        if (!tipo || !tipo.alto || !this._livre(x, y - 1)) continue;
        if (!m || dist(x, y) < m.d) m = { x, y: y - 1, d: dist(x, y), chave: tipo.chave, arvore: { x, y } };
      }
      if (m) out.arvore = m;
      const predios = ((typeof estruturasPorArea !== "undefined" && estruturasPorArea[area]) || []).filter((e) => e.entrar);
      let c = null, d = null;
      for (const e of predios) {
        const meio = e.x + (e.largura >> 1);
        if (!c || dist(e.x, e.y) < c.d) for (const x of [meio, meio - 1, meio + 1]) if (this._livreFora(x, e.y - 1)) { c = { x, y: e.y - 1, d: dist(e.x, e.y), predio: { tipo: e.tipo, x: e.x, y: e.y, largura: e.largura, altura: e.altura } }; break; }
        if (!d || dist(e.x, e.y) < d.d) {
          const moveis = new Set((e.moveis || []).map((mv) => `${mv.x},${mv.y}`));
          const cx = e.x + (e.largura >> 1), cy = e.y + (e.altura >> 1), opcoes = [];
          for (let y = e.y; y < e.y + e.altura; y++) for (let x = e.x; x < e.x + e.largura; x++)
            if (pisos[area][y][x] === PISO.INTERIOR && !moveis.has(`${x},${y}`) && Mundo.casaLivre(x, y, s.p, true)) opcoes.push({ x, y, k: Math.abs(x - cx) + Math.abs(y - cy) });
          opcoes.sort((a, b) => a.k - b.k);
          if (opcoes[0]) d = { x: opcoes[0].x, y: opcoes[0].y, d: dist(e.x, e.y), predio: { tipo: e.tipo, x: e.x, y: e.y, largura: e.largura, altura: e.altura } };
        }
      }
      if (c) out.casa = c;
      if (d) out.dentro = d;
      return out;
    },
    _livreFora(x, y) { return this._livre(x, y); },
    // renderizador do Phaser e quadros por segundo medidos em 1,5 s
    renderizador() {
      const g = cena().game;
      return new Promise((ok) => {
        let n = 0; const f = () => n++;
        g.events.on("postrender", f);
        setTimeout(() => { g.events.off("postrender", f); ok({ tipo: g.config.renderType === 2 ? "webgl" : "canvas", quadrosPorSegundo: Number((n / 1.5).toFixed(1)) }); }, 1500);
      });
    },
    // medidas do palco e da câmera
    layout() {
      const s = cena(), cam = s.cameras.main, raiz = document.getElementById("game-root"), mundo = document.getElementById("mundo");
      const ret = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
      const r = ret(raiz), vw = window.innerWidth, vh = window.innerHeight;
      const zCss = cam.zoom * (s.scale.zoom || 1);
      return {
        janela: [vw, vh], devicePixelRatio: window.devicePixelRatio, gameRoot: r, mundo: ret(mundo), canvas: [s.scale.width, s.scale.height],
        zoomCamera: cam.zoom, zoomDoCanvas: s.scale.zoom, pxDeTelaPorPxDeArte: cam.zoom, pxCssPorPxDeArte: Number(zCss.toFixed(3)), casaEmPxCss: Number((T * zCss).toFixed(1)),
        casasVisiveis: { colunas: Number((cam.worldView.width / T).toFixed(2)), linhas: Number((cam.worldView.height / T).toFixed(2)) },
        palcoSobreJanela: r ? Number(((r.w * r.h) / (vw * vh)).toFixed(3)) : null,
      };
    },
  };
}

// =====================================================================
// Contas feitas no Node sobre as amostras
// =====================================================================
// pts: [{ t, x, y }] por quadro desenhado. Velocidade em px de mundo por segundo (32 px = 1 casa).
function estatisticaDeMovimento(pts, tam = 32) {
  const d = [];
  for (let i = 1; i < pts.length; i++) d.push({ i, dist: Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y), dt: pts[i].t - pts[i - 1].t });
  const mov = d.filter((s) => s.dist > 0);
  if (!mov.length) return { moveu: false, quadros: pts.length };
  const ini = mov[0].i, fim = mov[mov.length - 1].i;
  const meio = d.filter((s) => s.i >= ini && s.i <= fim);
  const vel = meio.map((s) => (s.dt > 0 ? (s.dist / s.dt) * 1000 : 0));
  const velMov = meio.filter((s) => s.dist > 0 && s.dt > 0).map((s) => (s.dist / s.dt) * 1000);
  let parados = 0, pausas = 0, maiorPausa = 0, corrida = 0, somaPausas = 0;
  for (const s of meio) {
    if (s.dist === 0) { parados++; corrida += s.dt; } else if (corrida) { pausas++; somaPausas += corrida; maiorPausa = Math.max(maiorPausa, corrida); corrida = 0; }
  }
  const total = pts[fim].t - pts[ini - 1].t, dist = meio.reduce((s, x) => s + x.dist, 0);
  const casas = Math.max(Math.abs(pts[fim].x - pts[ini - 1].x), Math.abs(pts[fim].y - pts[ini - 1].y)) / tam;
  return {
    moveu: true, quadrosNoPercurso: meio.length, tempoTotalMs: arred(total), casas: arred(casas, 2), distanciaPx: arred(dist),
    msPorCasa: casas ? arred(total / casas) : null,
    velocidadePxPorS: { minima: arred(Math.min(...vel)), minimaEmMovimento: arred(Math.min(...velMov)), media: arred((dist / total) * 1000), maxima: arred(Math.max(...vel)) },
    quadrosParadosNoMeio: parados, pausas, maiorPausaMs: arred(maiorPausa), pausaMediaMs: pausas ? arred(somaPausas / pausas) : 0,
    fracaoDoTempoParado: arred(somaPausas / total, 3),
  };
}
function estatisticaDeQuadros(dados) {
  const dt = [];
  for (let i = 1; i < dados.length; i++) dt.push(dados[i].t - dados[i - 1].t);
  if (!dt.length) return null;
  const ord = dt.slice().sort((a, b) => a - b);
  return { quadros: dados.length, mediaMs: arred(dt.reduce((s, x) => s + x, 0) / dt.length, 2), p95Ms: arred(ord[Math.floor(ord.length * 0.95)], 2), maiorMs: arred(ord[ord.length - 1], 2), acimaDe33Ms: dt.filter((x) => x > 33.4).length, acimaDe50Ms: dt.filter((x) => x > 50).length };
}

// =====================================================================
// --comparar
// =====================================================================
async function comparar() {
  const [A, B] = opc.comparar.map((p) => path.resolve(p));
  const nomes = fs.readdirSync(A).filter((n) => /\.png$/i.test(n) && fs.existsSync(path.join(B, n))).sort();
  const soA = fs.readdirSync(A).filter((n) => /\.png$/i.test(n) && !fs.existsSync(path.join(B, n)));
  const soB = fs.readdirSync(B).filter((n) => /\.png$/i.test(n) && !fs.existsSync(path.join(A, n)));
  const srv = await servidor({ "/__a/": A, "/__b/": B });
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  await page.goto(base + "__branco.html");
  const feitos = [];
  for (const nome of nomes) {
    const r = await page.evaluate(async ({ nome, ra, rb }) => {
      const carregar = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i; };
      const a = await carregar("/__a/" + encodeURIComponent(nome)), b = await carregar("/__b/" + encodeURIComponent(nome));
      // lado a lado; imagens muito largas (folhas de contato) vão uma sobre a outra
      const empilhar = a.width + b.width > 3900, PAD = 8, TOPO = 26;
      const c = document.createElement("canvas");
      c.width = empilhar ? Math.max(a.width, b.width) + PAD * 2 : a.width + b.width + PAD * 3;
      c.height = empilhar ? a.height + b.height + TOPO * 2 + PAD : Math.max(a.height, b.height) + TOPO + PAD;
      const g = c.getContext("2d");
      g.fillStyle = "#101010"; g.fillRect(0, 0, c.width, c.height);
      g.font = "bold 15px sans-serif"; g.textBaseline = "top";
      const bx = empilhar ? PAD : a.width + PAD * 2, by = empilhar ? a.height + TOPO * 2 : TOPO;
      g.fillStyle = "#f0b0a0"; g.fillText(`A: ${ra}/${nome}  ${a.width}×${a.height}`, PAD, 5);
      g.fillStyle = "#a8e0a0"; g.fillText(`B: ${rb}/${nome}  ${b.width}×${b.height}`, bx, by - TOPO + 5);
      g.drawImage(a, PAD, TOPO); g.drawImage(b, bx, by);
      // quanto mudou (só quando têm o mesmo tamanho)
      let diferentes = null;
      if (a.width === b.width && a.height === b.height) {
        const t = document.createElement("canvas"); t.width = a.width; t.height = a.height;
        const tg = t.getContext("2d", { willReadFrequently: true });
        tg.drawImage(a, 0, 0); const da = tg.getImageData(0, 0, a.width, a.height).data;
        tg.clearRect(0, 0, a.width, a.height); tg.drawImage(b, 0, 0); const db = tg.getImageData(0, 0, a.width, a.height).data;
        let n = 0;
        for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3]) n++;
        diferentes = Number((n / (a.width * a.height)).toFixed(4));
      }
      return { url: c.toDataURL("image/png"), a: [a.width, a.height], b: [b.width, b.height], fracaoDePixelsDiferentes: diferentes, empilhado: empilhar };
    }, { nome, ra: path.basename(A), rb: path.basename(B) }).catch((e) => ({ erro: e.message }));
    if (r.url) { fs.writeFileSync(path.join(SAIDA, nome), Buffer.from(r.url.split(",")[1], "base64")); delete r.url; console.log("gravou", path.join(SAIDA, nome)); }
    feitos.push({ arquivo: nome, ...r });
  }
  const rel = { comparacao: { a: A, b: B }, saida: SAIDA, arquivos: feitos, soEmA: soA, soEmB: soB };
  fs.writeFileSync(path.join(SAIDA, "comparacao.json"), JSON.stringify(rel, null, 2));
  console.log(`\n${feitos.filter((f) => !f.erro).length} comparações em ${SAIDA}` + (soA.length || soB.length ? ` (só em A: ${soA.length}; só em B: ${soB.length})` : ""));
  await browser.close();
  srv.close();
}

// =====================================================================
// Execução principal
// =====================================================================
async function principal() {
  const inicio = Date.now();
  const srv = await servidor();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const relatorio = {
    base, raiz: RAIZ, saida: SAIDA, opcoes: { ...opc, comparar: undefined }, viewport: [opc.largura, opc.altura], quando: new Date().toISOString(),
    arquivos: [], erros: [], avisos: [],
  };
  const registrarArquivo = (nome, descricao) => { relatorio.arquivos.push({ arquivo: path.join(SAIDA, nome), descricao }); console.log("gravou", path.join(SAIDA, nome)); };
  const gravarURL = (nome, url, descricao) => { fs.writeFileSync(path.join(SAIDA, nome), Buffer.from(url.split(",")[1], "base64")); registrarArquivo(nome, descricao); };
  const escreverRelatorio = () => { relatorio.duracaoS = arred((Date.now() - inicio) / 1000); fs.writeFileSync(path.join(SAIDA, "relatorio.json"), JSON.stringify(relatorio, null, 2)); };
  const etapa = async (nome, f) => {
    const t0 = Date.now();
    try { await f(); } catch (e) { relatorio.avisos.push(`etapa ${nome} falhou: ${e.message.split("\n")[0]}`); console.error(`etapa ${nome} falhou:`, e.message); }
    (relatorio.tempoDasEtapasS = relatorio.tempoDasEtapasS || {})[nome] = arred((Date.now() - t0) / 1000);
    escreverRelatorio();
  };
  const ouvir = (page, rotulo) => {
    page.on("pageerror", (e) => relatorio.erros.push(`${rotulo}pageerror: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") relatorio.erros.push(`${rotulo}console: ${m.text()}`); });
    page.on("requestfailed", (r) => relatorio.avisos.push(`${rotulo}falhou: ${r.url().slice(0, 120)}`));
  };

  // ---------- folhas de contato e medidas (página leve) ----------
  const ctxArte = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  const pArte = await ctxArte.newPage();
  ouvir(pArte, "[arte] ");
  await etapa("folhas", async () => {
    await pArte.goto(base + "__arte.html", { waitUntil: "load" });
    await pArte.waitForFunction(() => window.__arteCarregada && window.Arte, null, { timeout: 30000 });
    const r = await pArte.evaluate(naPaginaFolhas, { familias: opc.familias, portais: opc.portais, prefixos: PREFIXOS });
    relatorio.sprites = { contagem: r.contagem, res: r.res, px: r.px, geracao: r.geracao, medidas: r.medidas };
    relatorio.validar = { problemas: (r.validar || []).length, lista: (r.validar || []).slice(0, 60) };
    for (const e of r.erros) relatorio.erros.push("[arte] " + e);
    for (const a of r.avisos) relatorio.avisos.push("[arte] " + a);
    for (const [nome, urls] of Object.entries(r.folhas)) urls.forEach((url, i) => gravarURL(`03-folha-${nome}${urls.length > 1 ? `-${i + 1}` : ""}.png`, url,
      `Folha de contato da família ${nome}${urls.length > 1 ? ` (página ${i + 1} de ${urls.length})` : ""}: todos os quadros, uma linha por vista quando há direcoes; escala pelo tamanho do sprite.`));
    if (r.tilesets) { gravarURL("03-folha-tilesets.png", r.tilesets.url, "Tileset de cada região lado a lado, 2×."); relatorio.tilesets = { msDeGeracao: r.tilesets.ms }; }
  });
  const folhaCenario = async (page) => {
    const r = await page.evaluate(naPaginaCenario);
    if (r.erro) { relatorio.avisos.push("folha do cenário: " + r.erro); for (const e of r.erros || []) relatorio.avisos.push("[cenário] " + e); return; }
    for (const e of r.erros) relatorio.avisos.push("[cenário] " + e);
    r.urls.forEach((url, i) => gravarURL(`03-folha-cenario${r.urls.length > 1 ? `-${i + 1}` : ""}.png`, url, `Texturas de cenario.js (${r.origem}): prédios, muros, portas, móveis e um pedaço de chão por região.`));
    relatorio.cenario = { origem: r.origem, texturas: r.contagem, msPedacoChao: r.msPedacoChao, lista: r.texturas };
  };
  const querCenario = !opc.familias.length || opc.familias.includes("cenario");
  if (opc.soFolhas) {
    if (querCenario) await etapa("cenario", () => folhaCenario(pArte));
    await ctxArte.close();
    return fim();
  }
  await ctxArte.close();

  // ---------- jogo ----------
  const arqPhaser = phaserLocal();
  const abrirJogo = async (o, rotulo, nav = browser) => {
    const ctx = await nav.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: o.dpr || 1, hasTouch: !!o.toque, isMobile: !!o.toque });
    const page = await ctx.newPage();
    ouvir(page, rotulo);
    await page.route("**/phaser@3.80.1/dist/phaser.min.js", (r) => r.fulfill({ path: arqPhaser, contentType: "text/javascript" }));
    await page.goto(base + "index.html", { waitUntil: "load" });
    return { ctx, page };
  };
  const principalAberta = await abrirJogo({ w: opc.largura, h: opc.altura }, "");
  const ctx = principalAberta.ctx;
  let page = principalAberta.page; // as etapas de medida trocam para a página do navegador sem WebGL
  const gravar = async (nome, descricao, o = {}, pg = page) => { await pg.screenshot({ path: path.join(SAIDA, nome), ...o }); registrarArquivo(nome, descricao); };
  const prontoNaCena = async (pg = page) => {
    await pg.waitForFunction(() => window.Jogo && window.Jogo.pronto && window.gameScene && !window.gameScene.trocando && window.gameScene.jogador, null, { timeout: 60000 });
    await espera(1200); // fade de entrada, fontes e primeira atualização da interface
  };
  // Fecha o que estiver por cima do mundo (diálogo de boas-vindas, janelas) sem mexer nas regras.
  const fecharJanelas = async (pg = page) => { for (let i = 0; i < 3; i++) { await pg.keyboard.press("Escape"); await espera(120); } };
  const estado = () => page.evaluate(() => window.__cap.estado());
  const andar = async (tecla, ms) => { await page.keyboard.down(tecla); await espera(ms); await page.keyboard.up(tecla); };
  const teleportar = async (area, x, y) => {
    await page.evaluate(([a, X, Y]) => window.__cap.teleportar(a, X, Y), [area, x, y]);
    await espera(500);
    await prontoNaCena();
    await fecharJanelas();
    const e = await estado();
    if (e.area !== area || e.x !== x || e.y !== y) relatorio.avisos.push(`teleporte: pedi ${area} ${x},${y} e fiquei em ${e.area} ${e.x},${e.y}`);
    return e;
  };
  // centro do canvas do jogo ampliado 3× sem suavizar (para ver o pixel)
  const gravarZoom = async (nome, descricao) => {
    const zoom = await page.evaluate(() => {
      const cv = document.querySelector("#game-root canvas");
      if (!cv) return null;
      const r = cv.getBoundingClientRect();
      const w = Math.min(480, Math.floor(r.width)), h = Math.min(300, Math.floor(r.height));
      return { x: Math.max(0, Math.round(r.left + r.width / 2 - w / 2)), y: Math.max(0, Math.round(r.top + r.height / 2 - h / 2 - 16)), w, h };
    });
    if (!zoom) return;
    const buf = await page.screenshot({ clip: { x: zoom.x, y: zoom.y, width: zoom.w, height: zoom.h } });
    const url = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width * 3; c.height = img.height * 3;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/png");
    }, buf.toString("base64"));
    gravarURL(nome, url, descricao);
  };
  const tira = (urls, rotulos, titulo) => page.evaluate(([u, r, t]) => window.__cap.tira(u, r, t), [urls, rotulos, titulo]);

  // ---------- (1) início ----------
  await etapa("inicio", async () => {
    await prontoNaCena();
    await page.evaluate(naPaginaInstalar);
    relatorio.layout = { [`${opc.largura}x${opc.altura}`]: await page.evaluate(() => window.__cap.layout()) };
    relatorio.renderizador = { capturas: await page.evaluate(() => window.__cap.renderizador()) };
    await gravar("01-inicio.png", "Tela inteira logo no início (save novo), como o jogador vê ao abrir.");
    await fecharJanelas();
  });
  const instalado = await page.evaluate(() => !!window.__cap).catch(() => false);
  if (!instalado) { relatorio.erros.push("o jogo não ficou pronto: sem capturas de tela"); await ctx.close(); return fim(); }

  // ---------- (2) andar ----------
  await etapa("andar", async () => {
    const p0 = await estado();
    // tenta as 4 direções: alguma estará livre
    for (const t of ["ArrowDown", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "ArrowRight"]) await andar(t, 650);
    await page.keyboard.down("ArrowRight");
    await espera(330);
    await gravar("02b-andando.png", "Tela inteira no meio de um passo para a direita (ciclo de andar e deslize).");
    await espera(400);
    await page.keyboard.up("ArrowRight");
    await andar("ArrowDown", 500);
    await espera(500);
    const p1 = await estado();
    relatorio.andou = { de: { x: p0.x, y: p0.y, area: p0.area }, para: { x: p1.x, y: p1.y, area: p1.area } };
    if (p0.x === p1.x && p0.y === p1.y) relatorio.avisos.push("o jogador não saiu do lugar com as setas");
    await gravar("02-apos-andar.png", `Tela inteira depois de andar (de ${p0.x},${p0.y} para ${p1.x},${p1.y}), virado para baixo, parado.`);
  });

  // ---------- folha do cenário com a cena do jogo ----------
  if (querCenario) await etapa("cenario", () => folhaCenario(page));

  // ---------- --combate ----------
  if (opc.combate) await etapa("combate", async () => {
    const T = await page.evaluate(() => window.__cap.T);
    const area0 = (await estado()).area;
    const alvo = await page.evaluate(() => window.__cap.pertoDeInimigo(1, "fraco"));
    if (!alvo) { relatorio.avisos.push("combate: nenhum inimigo com casa livre ao lado"); return; }
    await teleportar(area0, alvo.x, alvo.y);
    const cx = ((alvo.x + alvo.ex) / 2 + 0.5) * T, cy = ((alvo.y + alvo.ey) / 2 + 0.2) * T;
    const TEMPOS = [0, 50, 110, 180, 280, 420];
    relatorio.combate = { inimigo: alvo.id, nome: alvo.nome, vidaMaxima: alvo.vidaMaxima, jogador: { x: alvo.x, y: alvo.y }, criatura: { x: alvo.ex, y: alvo.ey }, golpes: [] };
    // um golpe pela mesma função da barra de espaço; devolve o resultado da lógica
    const golpear = (agenda) => page.evaluate(([id, ag]) => {
      const s = window.gameScene;
      if (s.alvoId !== id) s.selecionarAlvo(id);
      s.perseguir = false;
      if (ag) window.__cap.agendar(ag);
      const r = s.atacarAlvo(false, true) || {};
      return { ok: !!r.ok, emRecarga: !!r.emRecarga, recarga: r.recargaRestante || 0, dano: r.danoAplicado || 0, critico: !!r.critico, derrotado: !!r.derrotado, mensagem: r.mensagem || "", vida: Mundo.obterVidaInimigo(s.p.id, id) };
    }, [alvo.id, agenda]);
    const agenda = (tempos, prefixo) => tempos.map((ms, i) => ({ ms, nome: `${prefixo}${i + 1}`, x: cx, y: cy, casas: [7, 5] }));
    const esperarAgenda = async (ms) => { await espera(ms); await page.waitForFunction(() => window.__cap.pendentes() === 0, null, { timeout: 5000 }).catch(() => {}); };
    const esperarGolpe = () => page.waitForFunction(() => !window.__cap.temAgenda(), null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => window.__cap.iniciar({ ents: true }));
    await espera(200);
    // 1º golpe que acerta a lógica: 6 quadros em sequência
    let r = null;
    for (let i = 0; i < 8; i++) {
      r = await golpear(agenda(TEMPOS, "golpe"));
      if (r.ok) break;
      await espera(Math.min(2500, (r.recarga || 400) + 60));
    }
    if (!r || !r.ok) { relatorio.avisos.push("combate: o ataque não saiu: " + (r && r.mensagem)); await page.evaluate(() => window.__cap.parar()); return; }
    relatorio.combate.golpes.push(r);
    await espera(120);
    await gravar("06-combate-tela.png", `Tela inteira logo depois do golpe em ${alvo.nome} (número de dano, barra de vida, painel de batalha).`);
    await esperarGolpe();
    // Daí em diante é o próprio jogo que luta (perseguição e autoataque do alvo escolhido). Os 2 recortes
    // "depois da morte" disparam no quadro em que a vida da criatura chega a zero. Se a luta passar de 14 s,
    // a criatura fica com 1 de vida (só no save desta captura).
    await page.evaluate(([id, lista]) => { window.__cap.aoMorrer(id, lista); window.gameScene.perseguir = true; }, [alvo.id, [{ ms: 250, nome: "morte1", casas: [7, 5] }, { ms: 800, nome: "morte2", casas: [7, 5] }]]);
    const morreuEm = (ms) => page.waitForFunction((id) => Mundo.obterVidaInimigo(window.gameScene.p.id, id) <= 0, alvo.id, { timeout: ms }).then(() => true, () => false);
    let morte = await morreuEm(14000), ajudou = false;
    if (!morte) {
      ajudou = await page.evaluate((id) => { const s = window.gameScene, p = Mundo.jogadores[s.p.id]; if (p && p.vidaInimigos && p.vidaInimigos[id] > 1) { p.vidaInimigos[id] = 1; return true; } return false; }, alvo.id);
      await page.evaluate((id) => { const s = window.gameScene; if (s.alvoId !== id) s.selecionarAlvo(id); s.perseguir = true; }, alvo.id);
      morte = await morreuEm(25000);
    }
    relatorio.combate.vidaReduzidaPelaFerramenta = ajudou;
    if (morte) { await esperarAgenda(1000); await gravar("06-combate-apos-morte-tela.png", `Tela inteira depois da morte de ${alvo.nome} (saque no chão, XP).`); } else relatorio.avisos.push("combate: a criatura não morreu em 39 s");
    const am = await page.evaluate(() => window.__cap.parar());
    const doGolpe = am.quadros.filter((q) => /^golpe/.test(q.nome || "")).slice(-6);
    const daMorte = am.quadros.filter((q) => /^morte/.test(q.nome || "")).slice(0, 2);
    doGolpe.forEach((q, i) => gravarURL(`06-combate-${i + 1}.png`, q.url, `Golpe, quadro ${i + 1}/6 (+${Math.round(q.t)} ms depois do ataque): recorte de 7×5 casas entre o jogador e a criatura.`));
    daMorte.forEach((q, i) => gravarURL(`06-combate-morte-${i + 1}.png`, q.url, `Depois da morte, quadro ${i + 1}/2 (+${Math.round(q.t)} ms depois do golpe final).`));
    if (doGolpe.length) gravarURL("06-combate-tira.png", await tira(doGolpe.map((q) => q.url), doGolpe.map((q) => `+${Math.round(q.t)} ms`), `Golpe em ${alvo.nome}`), "Os 6 quadros do golpe lado a lado.");
    if (daMorte.length) gravarURL("06-combate-morte-tira.png", await tira(daMorte.map((q) => q.url), daMorte.map((q) => `+${Math.round(q.t)} ms`), `Morte de ${alvo.nome}`), "Os 2 quadros depois da morte lado a lado.");
    relatorio.combate.quadrosDoGolpeMs = doGolpe.map((q) => Math.round(q.t));
    relatorio.combate.quadrosDaMorteMs = daMorte.map((q) => Math.round(q.t));
    relatorio.combate.morreu = !!morte;
    relatorio.combate.vidaDoJogadorNoFim = (await estado()).vida;
    if (doGolpe.length < 6) relatorio.avisos.push(`combate: só ${doGolpe.length} quadros do golpe`);
    if (morte && daMorte.length < 2) relatorio.avisos.push(`combate: só ${daMorte.length} quadros depois da morte`);
    await page.evaluate(() => window.gameScene && window.gameScene.selecionarAlvo(null));
  });

  // ---------- --atras ----------
  if (opc.atras) await etapa("atras", async () => {
    const area0 = (await estado()).area;
    const pos = await page.evaluate(() => window.__cap.atras());
    relatorio.atras = {};
    const fazer = async (nome, p, texto, virar = true) => {
      if (!p) { relatorio.avisos.push(`atras: não achei posição para "${nome}" em ${area0}`); return; }
      await teleportar(area0, p.x, p.y);
      if (virar) await andar("ArrowDown", 60); // vira de frente (a casa ao sul está ocupada: não sai do lugar)
      await espera(700);
      const e = await estado();
      relatorio.atras[nome] = { ...p, d: undefined, nota: undefined, ficouEm: { x: e.x, y: e.y } };
      await gravar(`07-atras-${nome}.png`, `Tela inteira: ${texto} (${area0} ${e.x},${e.y}).`);
      await gravarZoom(`07-atras-${nome}-zoom.png`, `Centro ampliado 3×: ${texto}.`);
    };
    await fazer("arvore", pos.arvore, "jogador logo ao norte de uma árvore alta" + (pos.arvore ? ` (${pos.arvore.chave})` : ""));
    await fazer("casa", pos.casa, "jogador logo ao norte de uma casa");
    await fazer("dentro", pos.dentro, "jogador dentro de uma casa", false);
  });

  // ---------- (4) uma por região ----------
  if (opc.regioes) await etapa("regioes", async () => {
    const destinos = await page.evaluate(() => {
      // áreas da lógica: usa os dados globais (dados/mundo.js) e cai para os biomas da arte
      const fontes = [];
      try { fontes.push(DADOS_AREAS_BASE); } catch (e) { /* nome mudou */ }
      try { fontes.push(DADOS_AREAS_CAPITULOS); } catch (e) { /* nome mudou */ }
      const out = [];
      for (const f of fontes) for (const [id, a] of Object.entries(f)) { const c = a.chegadaViagem || a.inicio; if (c) out.push({ id, nome: a.nome || id, x: c.x, y: c.y }); }
      return out;
    });
    relatorio.regioes = destinos;
    for (const d of destinos) {
      try {
        await page.evaluate(([a, X, Y]) => window.__cap.teleportar(a, X, Y), [d.id, d.x, d.y]);
        await espera(500);
        await prontoNaCena();
      } catch (e) { relatorio.avisos.push(`região ${d.id} não ficou pronta: ${e.message.split("\n")[0]}`); continue; }
      const onde = await estado();
      if (onde.area !== d.id) { relatorio.avisos.push(`pedi ${d.id} e caí em ${onde.area}`); continue; }
      await fecharJanelas();
      await andar("ArrowDown", 260); // vira o boneco de frente e mexe a cena
      await espera(700);
      await gravar(`04-regiao-${d.id}.png`, `Tela inteira na região ${d.nome} (${d.id}) em ${onde.x},${onde.y}.`);
      await gravarZoom(`04-regiao-${d.id}-zoom.png`, `Centro do viewport de ${d.nome} ampliado 3× (jogador e arredores).`);
    }
  });
  await ctx.close();

  // ---------- medidas de movimento: navegador sem WebGL ----------
  // O WebGL por software do Chromium sem cabeça desenha este jogo a cerca de 10 quadros por segundo, o que
  // estraga qualquer medida de deslize. Sem WebGL o Phaser cai para o renderizador Canvas e roda a 60 q/s.
  // As capturas de arte acima continuam em WebGL (o que o jogador vê); só as medidas e os instantâneos do
  // passo saem daqui (no Canvas as tintas de sprite — raros, clarão do golpe — não aparecem).
  if (opc.deslize || opc.desempenho) {
    const navMedida = await chromium.launch({ args: ["--disable-gpu", "--disable-webgl", "--disable-3d-apis"] });
    try {
      const m = await abrirJogo({ w: opc.largura, h: opc.altura }, "[medida] ", navMedida);
      page = m.page;
      let pronto = false;
      await etapa("medida-inicio", async () => {
        await prontoNaCena();
        await page.evaluate(naPaginaInstalar);
        await fecharJanelas();
        relatorio.renderizador = { ...(relatorio.renderizador || {}), medidas: await page.evaluate(() => window.__cap.renderizador()) };
        pronto = true;
      });
      if (pronto) {
  // ---------- --deslize ----------
  if (opc.deslize) await etapa("deslize", async () => {
    const T = await page.evaluate(() => window.__cap.T);
    const area0 = (await estado()).area;
    relatorio.deslize = {};
    // anda `n` casas com a tecla presa, amostrando o sprite a cada quadro desenhado
    const percurso = async (nome, n, dx, dy, tecla, passo) => {
      const c = await page.evaluate(([N, DX, DY]) => window.__cap.corredor(N, DX, DY), [n, dx, dy]);
      if (!c) { relatorio.avisos.push(`deslize ${nome}: não achei ${n} casas livres em linha`); return null; }
      await teleportar(area0, c.x, c.y);
      await espera(300);
      await page.evaluate((o) => window.__cap.iniciar(o), passo ? { passo } : {});
      await espera(150);
      await page.keyboard.down(tecla);
      await page.waitForFunction(([X, Y, N]) => Math.max(Math.abs(window.gameScene.p.x - X), Math.abs(window.gameScene.p.y - Y)) >= N, [c.x, c.y, n], { timeout: 15000 }).catch(() => relatorio.avisos.push(`deslize ${nome}: não completou ${n} casas em 15 s`));
      await page.keyboard.up(tecla);
      await espera(500);
      const r = await page.evaluate(() => window.__cap.parar());
      const est = estatisticaDeMovimento(r.dados, T);
      relatorio.deslize[nome] = { inicio: { x: c.x, y: c.y }, inimigoMaisPertoCasas: c.inimigoMaisPerto, casasPelaLogica: r.passos, ...est, quadros: estatisticaDeQuadros(r.dados) };
      return r;
    };
    const reta = await percurso("reta10", 10, 1, 0, "ArrowRight", { de: 3, ate: 6, casas: [5, 4] });
    if (reta && reta.quadros.length) {
      // 6 instantâneos de UM passo (o 4º): do quadro em que a lógica mudou de casa até o seguinte
      let doPasso = reta.quadros.filter((q) => q.passo === 3);
      if (doPasso.length < 6) doPasso = reta.quadros;
      const escolhidos = [];
      for (let i = 0; i < 6; i++) escolhidos.push(doPasso[Math.min(doPasso.length - 1, Math.round((i * (doPasso.length - 1)) / 5))]);
      const t0 = escolhidos[0].t;
      escolhidos.forEach((q, i) => gravarURL(`05-deslize-passo-${i + 1}.png`, q.url, `Instantâneo ${i + 1}/6 de um passo para a direita (+${Math.round(q.t - t0)} ms), recorte de 5×4 casas em volta do jogador.`));
      gravarURL("05-deslize-passo-tira.png", await tira(escolhidos.map((q) => q.url), escolhidos.map((q) => `+${Math.round(q.t - t0)} ms`), "Um passo para a direita, quadro a quadro"), "Os 6 instantâneos do passo lado a lado.");
      relatorio.deslize.reta10.instantaneos = { quadrosDoPasso: doPasso.length, temposMs: escolhidos.map((q) => Math.round(q.t - t0)) };
    } else relatorio.avisos.push("deslize: sem instantâneos do passo");
    await percurso("diagonal6", 6, 1, 1, "c");

    // criatura andando: fica a 5 casas de um inimigo (ele vem) e amostra todas as criaturas por 8 s
    const alvo = await page.evaluate(() => window.__cap.pertoDeInimigo(5, "sozinho") || window.__cap.pertoDeInimigo(4, "sozinho") || window.__cap.pertoDeInimigo(3, "sozinho"));
    if (!alvo) { relatorio.avisos.push("deslize: nenhum inimigo com casa livre por perto para observar"); return; }
    await teleportar(area0, alvo.x, alvo.y);
    await page.evaluate(() => window.__cap.iniciar({ ents: true }));
    await espera(2500);
    await gravar("05-deslize-criatura.png", `Tela inteira com a criatura ${alvo.nome} (${alvo.id}) vindo até o jogador.`);
    await espera(5500);
    const r = await page.evaluate(() => window.__cap.parar());
    // a criatura que mais andou (pela lógica)
    const series = {};
    for (const a of r.dados) for (const [id, v] of Object.entries(a.e || {})) (series[id] = series[id] || []).push({ t: a.t, x: v[0], y: v[1], lx: v[2], ly: v[3] });
    let melhor = null;
    for (const [id, s] of Object.entries(series)) {
      const passos = [];
      for (let i = 1; i < s.length; i++) if (s[i].lx !== s[i - 1].lx || s[i].ly !== s[i - 1].ly) passos.push(s[i].t);
      if (!melhor || passos.length > melhor.passos.length) melhor = { id, s, passos };
    }
    if (!melhor || !melhor.passos.length) { relatorio.avisos.push("deslize: nenhuma criatura andou em 8 s"); relatorio.deslize.criatura = { observada: alvo.id, moveu: false }; return; }
    const entre = [];
    for (let i = 1; i < melhor.passos.length; i++) entre.push(melhor.passos[i] - melhor.passos[i - 1]);
    // só o trecho entre o primeiro e o último passo, mais o deslize do último
    const est = estatisticaDeMovimento(melhor.s, T);
    relatorio.deslize.criatura = {
      id: melhor.id, passosPelaLogica: melhor.passos.length,
      intervaloEntrePassosMs: entre.length ? { minimo: arred(Math.min(...entre)), medio: arred(entre.reduce((a, b) => a + b, 0) / entre.length), maximo: arred(Math.max(...entre)) } : null,
      ...est, quadros: estatisticaDeQuadros(r.dados),
    };
  });

  // ---------- desempenho: maior intervalo entre quadros ao andar 30 casas ----------
  if (opc.desempenho) await etapa("desempenho", async () => {
    const T = await page.evaluate(() => window.__cap.T);
    await fecharJanelas();
    await page.evaluate(() => window.__cap.iniciar({}));
    const como = await page.evaluate(() => {
      const s = window.gameScene, x0 = s.p.x, y0 = s.p.y;
      if (typeof s.calcularRota !== "function" || typeof s.iniciarRota !== "function") return { rota: false };
      // a primeira casa a 30 casas daqui (a busca em largura garante um caminho de pelo menos 30 passos)
      const objetivo = (x, y) => Math.max(Math.abs(x - x0), Math.abs(y - y0)) >= 30;
      const passos = s.calcularRota(objetivo, 20000);
      if (!passos || !passos.length) return { rota: false };
      s.selecionarAlvo(null);
      s.iniciarRota(objetivo, null, null);
      return { rota: true, passos: passos.length };
    });
    if (como.rota) await page.waitForFunction(() => !window.gameScene.rota, null, { timeout: 30000 }).catch(() => {});
    else { for (const t of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) await andar(t, 1200); }
    await espera(400);
    const r = await page.evaluate(() => window.__cap.parar());
    const mov = estatisticaDeMovimento(r.dados, T);
    relatorio.desempenho = { modo: como.rota ? "rota por clique (30 casas)" : "setas (sem rota)", passosDaRota: como.passos || null, casasPelaLogica: r.passos, intervaloEntreQuadros: estatisticaDeQuadros(r.dados), movimento: mov };
    if (r.passos < 30) relatorio.avisos.push(`desempenho: andou só ${r.passos} casas (pedi 30)`);
  });

      }
      await m.ctx.close();
    } finally { page = null; await navMedida.close(); }
  }

  // ---------- --tamanhos ----------
  if (opc.tamanhos) await etapa("tamanhos", async () => {
    relatorio.layout = relatorio.layout || {};
    for (const t of TAMANHOS) {
      let aberto = null;
      try {
        aberto = await abrirJogo(t, `[${t.nome}] `);
        await prontoNaCena(aberto.page);
        await aberto.page.evaluate(naPaginaInstalar);
        await fecharJanelas(aberto.page);
        await espera(400);
        const m = await aberto.page.evaluate(() => window.__cap.layout());
        m.toque = !!t.toque;
        relatorio.layout[t.nome] = m;
        await gravar(`08-tela-${t.nome}.png`, `Tela inteira em ${t.nome}${t.toque ? ` com toque emulado (devicePixelRatio ${t.dpr})` : ""}: palco ${m.gameRoot && m.gameRoot.w}×${m.gameRoot && m.gameRoot.h} px, zoom ${m.zoomCamera}, ${m.casasVisiveis.colunas}×${m.casasVisiveis.linhas} casas.`, {}, aberto.page);
      } catch (e) { relatorio.avisos.push(`tamanho ${t.nome} falhou: ${e.message.split("\n")[0]}`); }
      if (aberto) await aberto.ctx.close();
    }
  });
  return fim();

  async function fim() {
    escreverRelatorio();
    console.log(`\n${relatorio.arquivos.length} imagens em ${SAIDA} (${relatorio.duracaoS} s)`);
    if (relatorio.validar) console.log(`Arte.validar(): ${relatorio.validar.problemas} problemas`);
    if (relatorio.erros.length) console.log("erros da página:", relatorio.erros.slice(0, 10));
    if (relatorio.avisos.length) console.log("avisos:", relatorio.avisos.slice(0, 12));
    await browser.close();
    srv.close();
    if (opc.estrito && (relatorio.erros.length || (relatorio.validar && relatorio.validar.problemas))) process.exitCode = 2;
  }
}

(opc.comparar ? comparar() : principal()).catch((e) => { console.error(e); process.exit(1); });
