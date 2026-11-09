const TILE = 32;
const COLS = 25;
const ROWS = 18;
const VERSAO_SAVE = 1;
const VIDA_MAXIMA_JOGADOR = 100;

// Parâmetros provisórios para teste.
const TEMPO_REGEN = 10000;
const INTERVALO_MOVIMENTO = 600;
const INTERVALO_ATAQUE = 1200;
const CURA_POCAO = 30;
const QUANTIDADE_POCOES_INICIAIS = 3;
const QUANTIDADE_ERVAS_MISSAO = 3;
const RECOMPENSA_MISSAO_POCOES = 2;

const areas = {
  canaan: {
    id: "canaan",
    nome: "Canaã",
    passagem: { x: 22, y: 15 },
    chegada: { x: 21, y: 15 },
  },
  deserto: {
    id: "deserto",
    nome: "Deserto",
    passagem: { x: 2, y: 15 },
    chegada: { x: 3, y: 15 },
  },
};

function criarMapa(areaId) {
  const resultado = [];

  for (let y = 0; y < ROWS; y++) {
    resultado[y] = [];

    for (let x = 0; x < COLS; x++) {
      const borda =
        x === 0 ||
        y === 0 ||
        x === COLS - 1 ||
        y === ROWS - 1;

      let obstaculo = false;

      if (areaId === "canaan") {
        obstaculo = x % 6 === 3 && y % 4 === 2;
      } else {
        // Obstáculos diferentes para dar aparência própria ao Deserto.
        obstaculo = (x * 7 + y * 11) % 19 === 0;

        // Caminho livre até a passagem do Deserto.
        if (y === 15 && x >= 1 && x <= 5) {
          obstaculo = false;
        }
      }

      resultado[y][x] = borda || obstaculo ? 1 : 0;
    }
  }

  return resultado;
}

const mapas = {
  canaan: criarMapa("canaan"),
  deserto: criarMapa("deserto"),
};

const npcs = {
  viajante1: {
    id: "viajante1",
    nome: "Eliabe",
    x: 2,
    y: 5,
  },
};

const ervas = [
  { id: "erva1", x: 9, y: 4 },
  { id: "erva2", x: 14, y: 9 },
  { id: "erva3", x: 20, y: 13 },
];

const inimigos = {
  lobo1: {
    id: "lobo1",
    nome: "Lobo",
    x: 6,
    y: 5,
    inicioX: 6,
    inicioY: 5,
    vidaMaxima: 50,
    danoDoAtaque: 25,
    danoContraJogador: 8,
    raioPercepcao: 6,
    proximoMovimento: 0,
    proximoAtaque: 0,
  },
};

const Mundo = {
  jogadores: {},
  estado: {},

  entrar(id) {
    let personagem = Storage.carregar(id);

    if (!personagem) {
      personagem = {
        versao: VERSAO_SAVE,
        id,
        area: "canaan",
        x: 2,
        y: 2,
        vida: VIDA_MAXIMA_JOGADOR,
        inventario: [],
        itensIniciaisEntregues: false,
        inimigosDerrotados: [],
        vidaInimigos: {},
        ervasColetadas: [],
        missaoEliabe: null,
        missaoErvas: null,
      };
    }

    if (!Array.isArray(personagem.inventario)) {
      personagem.inventario = [];
    }

    if (!Array.isArray(personagem.inimigosDerrotados)) {
      personagem.inimigosDerrotados = [];
    }

    if (
      !personagem.vidaInimigos ||
      typeof personagem.vidaInimigos !== "object"
    ) {
      personagem.vidaInimigos = {};
    }

    if (!Array.isArray(personagem.ervasColetadas)) {
      personagem.ervasColetadas = [];
    }

    if (!areas[personagem.area]) {
      personagem.area = "canaan";
      personagem.x = 2;
      personagem.y = 2;
    }

    if (
      typeof personagem.vida !== "number" ||
      !Number.isFinite(personagem.vida)
    ) {
      personagem.vida = VIDA_MAXIMA_JOGADOR;
    }

    personagem.vida = Math.max(
      0,
      Math.min(personagem.vida, VIDA_MAXIMA_JOGADOR)
    );

    if (personagem.vida <= 0) {
      personagem.area = "canaan";
      personagem.x = 2;
      personagem.y = 2;
      personagem.vida = VIDA_MAXIMA_JOGADOR;
    }

    if (!personagem.itensIniciaisEntregues) {
      for (let i = 0; i < QUANTIDADE_POCOES_INICIAIS; i++) {
        personagem.inventario.push("pocao");
      }

      personagem.itensIniciaisEntregues = true;
    }

    if (
      !personagem.missaoEliabe ||
      typeof personagem.missaoEliabe !== "object"
    ) {
      personagem.missaoEliabe = {
        status: "nao_iniciada",
        loboDerrotado: false,
        recompensaRecebida: false,
      };
    }

    if (
      !personagem.missaoErvas ||
      typeof personagem.missaoErvas !== "object"
    ) {
      personagem.missaoErvas = {
        status: "bloqueada",
        recompensaRecebida: false,
        progresso: 0,
      };
    }

    const statusMissao1 = [
      "nao_iniciada",
      "em_andamento",
      "concluida",
    ];

    if (!statusMissao1.includes(personagem.missaoEliabe.status)) {
      personagem.missaoEliabe.status = "nao_iniciada";
    }

    if (typeof personagem.missaoEliabe.loboDerrotado !== "boolean") {
      personagem.missaoEliabe.loboDerrotado = false;
    }

    if (typeof personagem.missaoEliabe.recompensaRecebida !== "boolean") {
      personagem.missaoEliabe.recompensaRecebida = false;
    }

    const statusMissao2 = ["bloqueada", "em_andamento", "concluida"];

    if (!statusMissao2.includes(personagem.missaoErvas.status)) {
      personagem.missaoErvas.status = "bloqueada";
    }

    if (typeof personagem.missaoErvas.recompensaRecebida !== "boolean") {
      personagem.missaoErvas.recompensaRecebida = false;
    }

    if (
      !Number.isInteger(personagem.missaoErvas.progresso) ||
      personagem.missaoErvas.progresso < 0
    ) {
      personagem.missaoErvas.progresso = 0;
    }

    personagem.missaoErvas.progresso = Math.min(
      personagem.missaoErvas.progresso,
      QUANTIDADE_ERVAS_MISSAO
    );

    personagem.versao = VERSAO_SAVE;

    for (const inimigo of Object.values(inimigos)) {
      const vidaSalva = personagem.vidaInimigos[inimigo.id];

      if (personagem.inimigosDerrotados.includes(inimigo.id)) {
        personagem.vidaInimigos[inimigo.id] = 0;
      } else if (
        typeof vidaSalva !== "number" ||
        !Number.isFinite(vidaSalva)
      ) {
        personagem.vidaInimigos[inimigo.id] = inimigo.vidaMaxima;
      } else {
        personagem.vidaInimigos[inimigo.id] = Math.max(
          0,
          Math.min(vidaSalva, inimigo.vidaMaxima)
        );
      }

      inimigo.x = inimigo.inicioX;
      inimigo.y = inimigo.inicioY;
      inimigo.proximoMovimento = 0;
      inimigo.proximoAtaque = 0;
    }

    this.jogadores[id] = personagem;
    this.estado[id] = {
      proximaRegen: Date.now() + TEMPO_REGEN,
    };

    Storage.salvar(personagem);
    return personagem;
  },

  inimigoVivo(personagem, idInimigo) {
    return (
      !personagem.inimigosDerrotados.includes(idInimigo) &&
      personagem.vidaInimigos[idInimigo] > 0
    );
  },

  obterVidaInimigo(idJogador, idInimigo) {
    const personagem = this.jogadores[idJogador];
    const inimigo = inimigos[idInimigo];

    if (!personagem || !inimigo) {
      return null;
    }

    if (personagem.inimigosDerrotados.includes(idInimigo)) {
      return 0;
    }

    return personagem.vidaInimigos[idInimigo];
  },

  contarItem(idJogador, idItem) {
    const personagem = this.jogadores[idJogador];

    if (!personagem || !Array.isArray(personagem.inventario)) {
      return 0;
    }

    return personagem.inventario.filter((item) => item === idItem).length;
  },

  reaparecerInimigo(idJogador, idInimigo) {
    const personagem = this.jogadores[idJogador];
    const inimigo = inimigos[idInimigo];

    if (!personagem || !inimigo) {
      return false;
    }

    const indice = personagem.inimigosDerrotados.indexOf(idInimigo);

    if (indice === -1) {
      return false;
    }

    personagem.inimigosDerrotados.splice(indice, 1);
    personagem.vidaInimigos[idInimigo] = inimigo.vidaMaxima;

    inimigo.x = inimigo.inicioX;
    inimigo.y = inimigo.inicioY;
    inimigo.proximoMovimento = 0;
    inimigo.proximoAtaque = 0;

    Storage.salvar(personagem);
    return true;
  },

  casaLivreParaInimigo(x, y, personagem) {
    const mapaAtual = mapas[personagem.area];

    if (!mapaAtual[y] || mapaAtual[y][x] !== 0) {
      return false;
    }

    if (personagem.x === x && personagem.y === y) {
      return false;
    }

    const npcAli = Object.values(npcs).some(
      (npc) => npc.x === x && npc.y === y
    );

    if (npcAli) {
      return false;
    }

    const outroInimigo = Object.values(inimigos).some(
      (outro) =>
        this.inimigoVivo(personagem, outro.id) &&
        outro.x === x &&
        outro.y === y
    );

    return !outroInimigo;
  },

  passoInimigo(inimigo, alvoX, alvoY, personagem) {
    const difX = alvoX - inimigo.x;
    const difY = alvoY - inimigo.y;
    const tentativas = [];

    if (Math.abs(difX) >= Math.abs(difY)) {
      if (difX !== 0) tentativas.push({ dx: Math.sign(difX), dy: 0 });
      if (difY !== 0) tentativas.push({ dx: 0, dy: Math.sign(difY) });
    } else {
      if (difY !== 0) tentativas.push({ dx: 0, dy: Math.sign(difY) });
      if (difX !== 0) tentativas.push({ dx: Math.sign(difX), dy: 0 });
    }

    for (const passo of tentativas) {
      const novoX = inimigo.x + passo.dx;
      const novoY = inimigo.y + passo.dy;

      if (this.casaLivreParaInimigo(novoX, novoY, personagem)) {
        inimigo.x = novoX;
        inimigo.y = novoY;
        return true;
      }
    }

    return false;
  },

  atualizar(id, agora) {
    const personagem = this.jogadores[id];
    const estado = this.estado[id];
    const eventos = [];

    if (!personagem || !estado) {
      return eventos;
    }

    // O lobo e a regeneração de combate só atuam em Canaã.
    if (personagem.area === "canaan") {
      for (const inimigo of Object.values(inimigos)) {
        if (!this.inimigoVivo(personagem, inimigo.id)) {
          continue;
        }

        const distancia =
          Math.abs(personagem.x - inimigo.x) +
          Math.abs(personagem.y - inimigo.y);

        if (distancia === 1) {
          if (agora >= inimigo.proximoAtaque) {
            inimigo.proximoAtaque = agora + INTERVALO_ATAQUE;
            estado.proximaRegen = agora + TEMPO_REGEN;

            personagem.vida = Math.max(
              0,
              personagem.vida - inimigo.danoContraJogador
            );

            if (personagem.vida === 0) {
              const missaoEliabePreservada = {
                ...personagem.missaoEliabe,
              };
              const missaoErvasPreservada = {
                ...personagem.missaoErvas,
              };

              personagem.area = "canaan";
              personagem.x = 2;
              personagem.y = 2;
              personagem.vida = VIDA_MAXIMA_JOGADOR;

              for (const outro of Object.values(inimigos)) {
                if (this.inimigoVivo(personagem, outro.id)) {
                  outro.x = outro.inicioX;
                  outro.y = outro.inicioY;
                  outro.proximoAtaque = 0;
                  outro.proximoMovimento = 0;
                  personagem.vidaInimigos[outro.id] =
                    outro.vidaMaxima;
                }
              }

              personagem.missaoEliabe = missaoEliabePreservada;
              personagem.missaoErvas = missaoErvasPreservada;
              Storage.salvar(personagem);

              eventos.push({
                tipo: "renasceu",
                mensagem:
                  "O lobo derrubou você! Você voltou ao início " +
                  "de Canaã com a vida restaurada.",
              });

              return eventos;
            }

            Storage.salvar(personagem);

            eventos.push({
              tipo: "jogadorAtingido",
              mensagem:
                `O lobo mordeu você! Sua vida: ` +
                `${personagem.vida}/${VIDA_MAXIMA_JOGADOR}.`,
            });
          }

          continue;
        }

        if (agora < inimigo.proximoMovimento) {
          continue;
        }

        inimigo.proximoMovimento = agora + INTERVALO_MOVIMENTO;

        let alvoX = inimigo.inicioX;
        let alvoY = inimigo.inicioY;

        if (distancia <= inimigo.raioPercepcao) {
          alvoX = personagem.x;
          alvoY = personagem.y;
        } else if (
          inimigo.x === inimigo.inicioX &&
          inimigo.y === inimigo.inicioY
        ) {
          continue;
        }

        if (this.passoInimigo(inimigo, alvoX, alvoY, personagem)) {
          inimigo.proximoAtaque = Math.max(
            inimigo.proximoAtaque,
            agora + 600
          );

          eventos.push({
            tipo: "inimigoMoveu",
            id: inimigo.id,
          });
        }
      }
    }

    if (
      personagem.vida < VIDA_MAXIMA_JOGADOR &&
      agora >= estado.proximaRegen
    ) {
      personagem.vida += 1;
      estado.proximaRegen = agora + TEMPO_REGEN;
      Storage.salvar(personagem);

      eventos.push({ tipo: "regenerou" });
    }

    return eventos;
  },

  executar(id, comando) {
    const personagem = this.jogadores[id];

    if (!personagem || !comando || typeof comando.tipo !== "string") {
      return { ok: false };
    }

    if (comando.tipo === "mover") {
      const dx = Number(comando.dx);
      const dy = Number(comando.dy);

      if (
        !Number.isInteger(dx) ||
        !Number.isInteger(dy) ||
        Math.abs(dx) + Math.abs(dy) !== 1
      ) {
        return { ok: false };
      }

      const novoX = personagem.x + dx;
      const novoY = personagem.y + dy;
      const mapaAtual = mapas[personagem.area];

      if (!mapaAtual[novoY] || mapaAtual[novoY][novoX] !== 0) {
        return { ok: false };
      }

      if (personagem.area === "canaan") {
        const npcOcupandoCasa = Object.values(npcs).some(
          (npc) => npc.x === novoX && npc.y === novoY
        );

        const inimigoOcupandoCasa = Object.values(inimigos).some(
          (inimigo) =>
            this.inimigoVivo(personagem, inimigo.id) &&
            inimigo.x === novoX &&
            inimigo.y === novoY
        );

        if (npcOcupandoCasa || inimigoOcupandoCasa) {
          return { ok: false };
        }
      }

      personagem.x = novoX;
      personagem.y = novoY;

      // Ao pisar na passagem, troca de área e salva a chegada.
      const passagemAtual = areas[personagem.area].passagem;

      if (novoX === passagemAtual.x && novoY === passagemAtual.y) {
        const novaArea =
          personagem.area === "canaan" ? "deserto" : "canaan";

        personagem.area = novaArea;
        personagem.x = areas[novaArea].chegada.x;
        personagem.y = areas[novaArea].chegada.y;

        Storage.salvar(personagem);

        return {
          ok: true,
          areaAlterada: true,
          mensagem: `Você chegou a ${areas[novaArea].nome}.`,
        };
      }

      if (personagem.area === "canaan") {
        const erva = ervas.find(
          (item) =>
            item.x === novoX &&
            item.y === novoY &&
            !personagem.ervasColetadas.includes(item.id)
        );

        if (erva) {
          personagem.ervasColetadas.push(erva.id);
          personagem.inventario.push("erva");

          if (
            personagem.missaoErvas.status === "em_andamento" &&
            personagem.missaoErvas.progresso < QUANTIDADE_ERVAS_MISSAO
          ) {
            personagem.missaoErvas.progresso++;
          }

          Storage.salvar(personagem);

          return {
            ok: true,
            ervaColetada: erva.id,
            mensagem: "Você coletou uma erva medicinal.",
          };
        }
      }

      Storage.salvar(personagem);
      return { ok: true };
    }

    if (comando.tipo === "interagir") {
      if (personagem.area !== "canaan") {
        return {
          ok: false,
          mensagem: "Não há ninguém por perto para conversar.",
        };
      }

      const npc = npcs[comando.alvoId];

      if (!npc) {
        return {
          ok: false,
          mensagem: "Não encontrei esse personagem.",
        };
      }

      const distancia =
        Math.abs(personagem.x - npc.x) +
        Math.abs(personagem.y - npc.y);

      if (distancia > 1) {
        return {
          ok: false,
          mensagem: "Chegue mais perto para conversar.",
        };
      }

      const missao1 = personagem.missaoEliabe;
      const missao2 = personagem.missaoErvas;

      if (missao1.status === "nao_iniciada") {
        missao1.status = "em_andamento";
        Storage.salvar(personagem);

        return {
          ok: true,
          mensagem:
            "Eliabe: Um lobo ameaça os viajantes. Derrote-o e " +
            "volte para falar comigo.",
        };
      }

      if (
        missao1.status === "em_andamento" &&
        missao1.loboDerrotado &&
        !missao1.recompensaRecebida
      ) {
        for (let i = 0; i < RECOMPENSA_MISSAO_POCOES; i++) {
          personagem.inventario.push("pocao");
        }

        missao1.recompensaRecebida = true;
        missao1.status = "concluida";
        Storage.salvar(personagem);

        return {
          ok: true,
          mensagem:
            `Eliabe: Obrigado por ajudar! Aqui estão ` +
            `${RECOMPENSA_MISSAO_POCOES} poções. Primeira missão concluída!`,
        };
      }

      if (missao1.status === "em_andamento") {
        return {
          ok: true,
          mensagem:
            "Eliabe: Ainda precisamos derrotar o lobo. " +
            "Encontre-o e volte quando conseguir.",
        };
      }

      if (missao2.status === "bloqueada") {
        missao2.status = "em_andamento";
        missao2.progresso = 0;
        // As ervas já coletadas antes da missão voltam a ficar disponíveis
        // para que a tarefa possa ser concluída sem contar o inventário antigo.
        personagem.ervasColetadas = [];
        Storage.salvar(personagem);

        return {
          ok: true,
          missaoErvasIniciada: true,
          mensagem:
            "Eliabe: Agora preciso de 3 ervas medicinais. " +
            "Procure-as pelo caminho e volte com elas.",
        };
      }

      if (missao2.status === "em_andamento") {
        const quantidadeErvas = missao2.progresso;

        if (quantidadeErvas >= QUANTIDADE_ERVAS_MISSAO) {
          let paraRemover = QUANTIDADE_ERVAS_MISSAO;

          personagem.inventario = personagem.inventario.filter((item) => {
            if (item === "erva" && paraRemover > 0) {
              paraRemover--;
              return false;
            }

            return true;
          });

          for (let i = 0; i < RECOMPENSA_MISSAO_POCOES; i++) {
            personagem.inventario.push("pocao");
          }

          missao2.recompensaRecebida = true;
          missao2.status = "concluida";
          Storage.salvar(personagem);

          return {
            ok: true,
            mensagem:
              "Eliabe: Excelente! Essas ervas vão ajudar os viajantes. " +
              `Receba ${RECOMPENSA_MISSAO_POCOES} poções. Missão concluída!`,
          };
        }

        return {
          ok: true,
          mensagem:
            `Eliabe: Ainda faltam ervas. Você tem ` +
            `${quantidadeErvas}/${QUANTIDADE_ERVAS_MISSAO}.`,
        };
      }

      return {
        ok: true,
        mensagem:
          "Eliabe: Obrigado por ajudar os viajantes. " +
          "Você já concluiu as missões de teste.",
      };
    }

    if (comando.tipo === "usarPocao") {
      const indicePocao = personagem.inventario.indexOf("pocao");

      if (indicePocao === -1) {
        return { ok: false, mensagem: "Você não tem poções." };
      }

      if (personagem.vida >= VIDA_MAXIMA_JOGADOR) {
        return {
          ok: false,
          mensagem: "Sua vida já está cheia. A poção não foi consumida.",
        };
      }

      personagem.inventario.splice(indicePocao, 1);

      const vidaAnterior = personagem.vida;
      personagem.vida = Math.min(
        VIDA_MAXIMA_JOGADOR,
        personagem.vida + CURA_POCAO
      );

      this.estado[id].proximaRegen = Date.now() + TEMPO_REGEN;
      Storage.salvar(personagem);

      return {
        ok: true,
        mensagem:
          `Você usou uma poção e recuperou ` +
          `${personagem.vida - vidaAnterior} de vida. ` +
          `Vida: ${personagem.vida}/${VIDA_MAXIMA_JOGADOR}.`,
      };
    }

    if (comando.tipo === "atacar") {
      if (personagem.area !== "canaan") {
        return {
          ok: false,
          mensagem: "Não há inimigos nesta área de teste.",
        };
      }

      const inimigo = inimigos[comando.alvoId];

      if (!inimigo) {
        return {
          ok: false,
          mensagem: "Não encontrei esse inimigo.",
        };
      }

      if (!this.inimigoVivo(personagem, inimigo.id)) {
        return {
          ok: false,
          mensagem: "Esse inimigo já foi derrotado.",
        };
      }

      const distancia =
        Math.abs(personagem.x - inimigo.x) +
        Math.abs(personagem.y - inimigo.y);

      if (distancia !== 1) {
        return {
          ok: false,
          mensagem: "Chegue ao lado do lobo para atacá-lo.",
        };
      }

      this.estado[id].proximaRegen = Date.now() + TEMPO_REGEN;

      const novaVidaInimigo = Math.max(
        0,
        personagem.vidaInimigos[inimigo.id] -
          inimigo.danoDoAtaque
      );

      personagem.vidaInimigos[inimigo.id] = novaVidaInimigo;

      if (novaVidaInimigo === 0) {
        if (!personagem.inimigosDerrotados.includes(inimigo.id)) {
          personagem.inimigosDerrotados.push(inimigo.id);
        }

        if (personagem.missaoEliabe.status === "em_andamento") {
          personagem.missaoEliabe.loboDerrotado = true;
        }

        Storage.salvar(personagem);

        return {
          ok: true,
          derrotado: true,
          mensagem:
            "Você derrotou o lobo! Volte até Eliabe se estiver " +
            "fazendo a missão. O lobo reaparecerá em 5 segundos.",
        };
      }

      Storage.salvar(personagem);

      return {
        ok: true,
        derrotado: false,
        mensagem:
          `Você acertou o lobo! Vida dele: ` +
          `${novaVidaInimigo}/${inimigo.vidaMaxima}.`,
      };
    }

    return { ok: false };
  },
};