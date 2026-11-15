"use strict";
// arte/montado.js (pacote M1): jogador montado no contrato novo, prévias da loja e o barco.
module.exports = function ({ teste, carregarJogo, carregarArte, assert, igual }) {
  const nova = () => { const j = carregarJogo(); const Arte = carregarArte(j.ctx); return { j, Arte, PP: j.ctx.PIXEL_PATTERNS, M: Arte.motor }; };
  const caixa = (px) => {
    let x0 = px.w, x1 = -1, y0 = px.h, y1 = -1, n = 0;
    for (let i = 0; i < px.data.length; i++) {
      const c = px.data[i];
      if (!c || c.length > 7) continue; // sombra e espuma (com alfa) não contam
      const x = i % px.w, y = (i / px.w) | 0;
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { x0, x1, y0, y1, n };
  };
  // maior ilha de px ligados (8 vizinhos) sobre o total: "sem partes soltas"
  const maiorIlha = (px) => {
    const cheio = (i) => !!px.data[i] && px.data[i].length <= 7, visto = new Uint8Array(px.data.length);
    let total = 0, maior = 0;
    for (let i = 0; i < px.data.length; i++) {
      if (!cheio(i)) continue;
      total++;
      if (visto[i]) continue;
      let n = 0; const pilha = [i]; visto[i] = 1;
      while (pilha.length) {
        const k = pilha.pop(), x = k % px.w, y = (k / px.w) | 0; n++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= px.w || Y >= px.h) continue;
          const m = Y * px.w + X;
          if (!visto[m] && cheio(m)) { visto[m] = 1; pilha.push(m); }
        }
      }
      if (n > maior) maior = n;
    }
    return maior / total;
  };

  teste("arte/montado: as 4 montarias no contrato novo (3 vistas × 8 quadros), cavaleiro assentado", () => {
    const { Arte, PP, M } = nova();
    assert.ok(M.montadoNovo && M.novoHumano && M.humanoEquipado && typeof M.animal === "function", "montado novo ativo");
    const nu = Arte.pixels(Arte.garantirJogador({}), { quadro: 8 });
    for (const m of ["jumento", "cavalo", "camelo", "carro"]) {
      const chave = Arte.garantirJogador({}, { montaria: m }), def = PP[chave];
      igual(chave, "pj_jogador||||||" + m, "a chave composta não muda");
      igual([def.direcoes, def.quadrosPorVista, def.quadros, def.humano, def.montado], [3, 8, 24, true, m], m);
      igual([def.ciclo.join(), def.quadroAcao.join()], ["2,3,4,5", "6,7"], m);
      assert.ok(def.w * 2 >= 72 && def.h * 2 >= 80 && def.sombra && def.sombra.w > 0, `${m}: célula ${def.w * 2}×${def.h * 2}`);
      const vistas = [0, 8, 16].map((q) => Arte.pixels(chave, { quadro: q }));
      for (const px of vistas) igual([px.w, px.h], [def.w * 2, def.h * 2], m);
      const t = vistas.map((px) => px.data.join());
      assert.ok(t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2], `${m}: vistas diferentes`);
      for (let v = 0; v < 3; v++) {
        const parado = Arte.pixels(chave, { quadro: v * 8 }).data.join();
        // o passo (montaria ou rodas) e o golpe (cavaleiro) mudam o quadro; o ciclo tem 4 fases distintas
        const fases = new Set([2, 3, 4, 5].map((q) => Arte.pixels(chave, { quadro: v * 8 + q }).data.join()));
        igual(fases.size, 4, `${m} vista ${v}: 4 fases do passo`);
        assert.ok(!fases.has(parado), `${m} vista ${v}: andar difere de parado`);
        assert.notStrictEqual(Arte.pixels(chave, { quadro: v * 8 + 7 }).data.join(), parado, `${m} vista ${v}: golpe`);
        for (let q = 0; q < 8; q++) {
          const px = Arte.pixels(chave, { quadro: v * 8 + q }), c = caixa(px);
          // pés perto do fim da célula, nada cortado embaixo, e o conjunto num bloco só
          assert.ok(c.y1 >= px.h - 9 && c.y1 <= px.h - 1, `${m} q${v * 8 + q}: base em ${c.y1}`);
          assert.ok(c.y1 - c.y0 >= 56, `${m} q${v * 8 + q}: altura ${c.y1 - c.y0}`);
          assert.ok(maiorIlha(px) > 0.97, `${m} q${v * 8 + q}: partes soltas (${maiorIlha(px).toFixed(3)})`);
        }
      }
      // o cavaleiro é o boneco novo: as cores de pele e de cabelo do jogador a pé aparecem no montado
      const cores = new Set(nu.data.filter(Boolean)), em = new Set(vistas[1].data.filter(Boolean));
      let comuns = 0; for (const c of cores) if (em.has(c)) comuns++;
      assert.ok(comuns >= 12, `${m}: ${comuns} cores do boneco a pé no montado`);
    }
    // o equipamento chega ao cavaleiro e a montaria é guardada: a segunda chave reaproveita o animal
    const a = Arte.garantirJogador({ arma: "espada_ferro", escudo: "escudo_bronze" }, { montaria: "cavalo" });
    assert.notStrictEqual(Arte.pixels(a, { quadro: 8 }).data.join(), Arte.pixels("pj_jogador||||||cavalo", { quadro: 8 }).data.join(), "equipamento muda o montado");
    igual(Arte.validar(), []);
  });

  teste("arte/montado: prévias mt_* (64 × 64 px) e barco em 3 vistas × 4 quadros", () => {
    const { Arte, PP } = nova();
    const previas = ["jumento", "cavalo", "camelo", "carro"].map((m) => {
      const def = PP["mt_" + m], px = Arte.pixels("mt_" + m), c = caixa(px);
      igual([def.quadros, px.w, px.h, def.res], [1, 64, 64, 2], "mt_" + m);
      assert.ok(c.n > 500 && c.x0 >= 1 && c.x1 <= 62 && c.y0 >= 1 && c.y1 <= 62, `mt_${m}: cabe na célula com margem (${JSON.stringify(c)})`);
      assert.ok(maiorIlha(px) > 0.97, `mt_${m}: partes soltas`);
      return px.data.join();
    });
    igual(new Set(previas).size, 4, "prévias diferentes");
    const def = PP.mk_barco;
    igual([def.direcoes, def.quadrosPorVista, def.quadros, def.ciclo.join()], [3, 4, 12, "0,1,2,3"]);
    const quadros = [];
    for (let q = 0; q < 12; q++) {
      const px = Arte.pixels("mk_barco", { quadro: q }), c = caixa(px);
      igual([px.w, px.h], [def.w * 2, def.h * 2]);
      assert.ok(px.w >= 64 && px.h >= 56, "célula do barco");
      assert.ok(c.n > 600 && maiorIlha(px) > 0.97, `barco q${q}: casco, mastro e vela num bloco só`);
      // a espuma (px com alfa, pintados depois do contorno) existe em todo quadro
      assert.ok(px.data.some((x) => x && x.length > 7 && /^#(f4fbf8|cfeae6|9fd0cf)/.test(x)), `barco q${q}: espuma`);
      quadros.push(px.data.join());
    }
    igual(new Set(quadros).size, 12, "12 quadros diferentes (3 vistas × 4 de balanço)");
  });
};
