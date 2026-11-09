// Extensão de capítulos, progressão e Oração. Carregado após logica.js.
const CAPITULOS = {
  egito: { nome:"Egito", anterior:"deserto", inimigo:"soldadoEgito1", npc:"moisesEgito" },
  marVermelho: { nome:"Mar Vermelho", anterior:"egito", inimigo:"perseguidorMar1", npc:"araoMar" },
  sinai: { nome:"Monte Sinai", anterior:"marVermelho", inimigo:"guardiaoSinai1", npc:"josueSinai" },
  galileia: { nome:"Galileia", anterior:"sinai", inimigo:"ameaçaGalileia1", npc:"pedroGalileia" },
};
const PORTAIS = [
  {area:"deserto",x:77,y:56,destino:"egito",chegada:{x:4,y:56},capitulo:"egito",texto:"Rota para o Egito"},
  {area:"egito",x:2,y:56,destino:"deserto",chegada:{x:75,y:56},texto:"Volta ao Deserto"},
  {area:"egito",x:77,y:56,destino:"marVermelho",chegada:{x:4,y:56},capitulo:"marVermelho",texto:"Travessia do Mar Vermelho"},
  {area:"marVermelho",x:2,y:56,destino:"egito",chegada:{x:75,y:56},texto:"Volta ao Egito"},
  {area:"marVermelho",x:77,y:56,destino:"sinai",chegada:{x:4,y:56},capitulo:"sinai",texto:"Caminho do Sinai"},
  {area:"sinai",x:2,y:56,destino:"marVermelho",chegada:{x:75,y:56},texto:"Volta ao Mar Vermelho"},
  {area:"sinai",x:77,y:56,destino:"galileia",chegada:{x:4,y:56},capitulo:"galileia",texto:"Rota para a Galileia"},
  {area:"galileia",x:2,y:56,destino:"sinai",chegada:{x:75,y:56},texto:"Volta ao Sinai"},
];
const NOVAS_AREAS = {
  egito:{id:"egito",nome:"Egito",bioma:"nilo"},
  marVermelho:{id:"marVermelho",nome:"Mar Vermelho",bioma:"costa"},
  sinai:{id:"sinai",nome:"Monte Sinai",bioma:"montanha"},
  galileia:{id:"galileia",nome:"Galileia",bioma:"galileia"},
};
for(const [id,a] of Object.entries(NOVAS_AREAS)){
  areas[id]=a; mapas[id]=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>{
    const border=x===0||y===0||x===COLS-1||y===ROWS-1;
    const obstacle=id==="egito"?(x*13+y*17)%29===0:id==="marVermelho"?(x*11+y*19)%37===0:id==="sinai"?(x*7+y*13)%17===0:(x*5+y*23)%31===0;
    return border||obstacle?1:0;
  }));
  for(let x=1;x<COLS-1;x++)mapas[id][56][x]=0;
}
for(const a of Object.values(areas)) if(a.id==="egito"||a.id==="marVermelho"||a.id==="sinai"||a.id==="galileia") for(let x=2;x<78;x++) mapas[a.id][30][x]=0;
for(const portal of PORTAIS) mapas[portal.area][portal.y][portal.x]=0;
const NOVOS_NPCS={
  moisesEgito:{id:"moisesEgito",nome:"Moisés",area:"egito",x:10,y:10,capitulo:"egito"},
  aaronEgito:{id:"aaronEgito",nome:"Arão",area:"egito",x:12,y:10,capitulo:"egito"},
  araoMar:{id:"araoMar",nome:"Arão",area:"marVermelho",x:10,y:10,capitulo:"marVermelho"},
  josueSinai:{id:"josueSinai",nome:"Josué",area:"sinai",x:10,y:10,capitulo:"sinai"},
  pedroGalileia:{id:"pedroGalileia",nome:"Pedro",area:"galileia",x:10,y:10,capitulo:"galileia"},
  jesusGalileia:{id:"jesusGalileia",nome:"Jesus · Médico dos médicos",area:"galileia",x:14,y:10,capitulo:"galileia"},
};
Object.assign(npcs,NOVOS_NPCS);
const NOVOS_INIMIGOS={
  soldadoEgito1:{id:"soldadoEgito1",nome:"Guarda egípcio",area:"egito",x:34,y:31,inicioX:34,inicioY:31,vidaMaxima:90,danoDoAtaque:18,danoContraJogador:15,defesa:8,raioPercepcao:6,xpRecompensa:80,proximoMovimento:0,proximoAtaque:0},
  perseguidorMar1:{id:"perseguidorMar1",nome:"Perseguidor da retaguarda",area:"marVermelho",x:36,y:31,inicioX:36,inicioY:31,vidaMaxima:100,danoDoAtaque:20,danoContraJogador:18,defesa:8,raioPercepcao:7,xpRecompensa:100,proximoMovimento:0,proximoAtaque:0},
  guardiaoSinai1:{id:"guardiaoSinai1",nome:"Guarda do desfiladeiro",area:"sinai",x:39,y:31,inicioX:39,inicioY:31,vidaMaxima:115,danoDoAtaque:24,danoContraJogador:20,defesa:12,raioPercepcao:7,xpRecompensa:130,proximoMovimento:0,proximoAtaque:0},
  ameaçaGalileia1:{id:"ameaçaGalileia1",nome:"Ameaça na estrada",area:"galileia",x:38,y:31,inicioX:38,inicioY:31,vidaMaxima:130,danoDoAtaque:25,danoContraJogador:22,defesa:12,raioPercepcao:7,xpRecompensa:160,proximoMovimento:0,proximoAtaque:0},
};
Object.assign(inimigos,NOVOS_INIMIGOS);
inimigos.lobo1.defesa=2;inimigos.escorpiao1.defesa=5;inimigos.bandido1.danoContraJogador=25;inimigos.bandido1.defesa=12;
for(const e of Object.values(NOVOS_INIMIGOS)) mapas[e.area][e.y][e.x]=0;
for(const n of Object.values(NOVOS_NPCS)) mapas[n.area][n.y][n.x]=0;

const PRAYER_FAITH_MAX=100;
const PRAYER_REGEN_MS=3000;
const PRAYER_COST={vida:20,veneno:40,area:60,milagre:100};
const MISSIONS={egito:"Derrote o guarda egípcio e volte a Moisés.",marVermelho:"Proteja o povo: derrote o perseguidor e volte a Arão.",sinai:"Abra o caminho: derrote o guarda do desfiladeiro e volte a Josué.",galileia:"Ajude os viajantes na estrada e fale com Pedro; depois, converse com Jesus para aprender a Oração."};
function capituloAnteriorConcluido(p,key){
  if(key==="egito")return p.missaoDeserto?.status==="concluida";
  const prev=CAPITULOS[key]?.anterior;
  return prev==="deserto"?p.missaoDeserto?.status==="concluida":p.capitulos?.[prev]?.status==="concluida";
}
function salvar(p){p.versao=5;Storage.salvar(p)}
function iniciarCapitulo(p,key){p.capitulos[key].status="em_andamento";p.capitulos[key].alvo=false;salvar(p)}
function nivelHabilidade(p,key){return Math.max(0,Math.min(100,Number(p.habilidades?.[key])||0))}
function xpParaSkill(nivel){return Math.max(50,(nivel||0)*50)}
function ganharSkill(p,key,xp){if(!p.habilidades[key])p.habilidades[key]=0;if(!p.skillXp[key])p.skillXp[key]=0;p.skillXp[key]+=xp;let ups=0;while(p.habilidades[key]<100&&p.skillXp[key]>=xpParaSkill(p.habilidades[key])){p.skillXp[key]-=xpParaSkill(p.habilidades[key]);p.habilidades[key]++;ups++}return ups}
function defesaP(p){return defesaEquipamento(p)+Math.min(30,Math.floor(nivelHabilidade(p,"defesa")*.3))}
const _entrar=Mundo.entrar.bind(Mundo);
Mundo.entrar=function(id){const p=_entrar(id);p.capitulos=p.capitulos&&typeof p.capitulos==="object"?p.capitulos:{};for(const key of Object.keys(CAPITULOS))if(!p.capitulos[key])p.capitulos[key]={status:"bloqueado",alvo:false};p.habilidades=p.habilidades||{corpo:0,distancia:0,defesa:0};for(const key of ["corpo","distancia","defesa","oracao"])if(!Number.isFinite(p.habilidades[key]))p.habilidades[key]=0;p.skillXp=p.skillXp||{corpo:0,distancia:0,defesa:0,oracao:0};for(const key of ["corpo","distancia","defesa","oracao"])if(!Number.isFinite(p.skillXp[key]))p.skillXp[key]=0;p.fe=Number.isFinite(p.fe)?Math.max(0,Math.min(PRAYER_FAITH_MAX,p.fe)):PRAYER_FAITH_MAX;p.oracaoDesbloqueada=!!p.oracaoDesbloqueada;p.envenenadoAte=Number.isFinite(p.envenenadoAte)?p.envenenadoAte:0;p.proximoDanoVeneno=Number.isFinite(p.proximoDanoVeneno)?p.proximoDanoVeneno:0;if(!Array.isArray(p.saqueNoChao))p.saqueNoChao=[];p.versao=5;Storage.salvar(p);return p};

const _resolver=Mundo.resolverDano.bind(Mundo);
Mundo.resolverDano=function(id,e,dano){const p=this.jogadores[id],kind=p?._tipoAtaque||"corpo",level=Math.max(0,nivelHabilidade(p,kind)-1);const weapon=kind==="distancia"?(p.equipamento.arco?ITENS[p.equipamento.arco]?.bonus||8:8):(p.equipamento.arma?ITENS[p.equipamento.arma]?.bonus||3:3);const base=kind==="distancia"?Math.min(30,8+(weapon-10)*.2):Math.min(30,weapon);const mult=kind==="distancia"?.4:.5;let raw=base+level*mult;const critical=Math.random()<(Math.min(25,5+level/50)/100);if(critical)raw*=2;const defense=Math.max(0,e.defesa||0);const final=Math.max(1,Math.floor(raw-defense));const r=_resolver(id,e,final);r.critico=critical;r.defesaAlvo=defense;if(critical)r.mensagem="CRÍTICO! "+r.mensagem;return r};
const _executar=Mundo.executar.bind(Mundo);
Mundo.executar=function(id,c){const p=this.jogadores[id];if(!p)return _executar(id,c);
 if(c?.tipo==="usarPocaoFe"){const i=p.inventario.indexOf("pocao_fe");if(i<0)return{ok:false,mensagem:"Você não tem poções de fé."};if(p.fe>=PRAYER_FAITH_MAX)return{ok:false,mensagem:"Sua fé já está cheia; a poção não foi consumida."};p.inventario.splice(i,1);const before=p.fe;p.fe=Math.min(PRAYER_FAITH_MAX,p.fe+40);salvar(p);return{ok:true,feCurada:p.fe-before,mensagem:`Poção de fé: +${p.fe-before} de fé. Fé ${p.fe}/${PRAYER_FAITH_MAX}.`}}
 if(c?.tipo==="orar")return this.orar(id,c.acao);
 if(c?.tipo==="interagir"){const npc=c.alvoId?NOVOS_NPCS[c.alvoId]:Object.values(NOVOS_NPCS).find(n=>n.area===p.area&&Math.abs(p.x-n.x)+Math.abs(p.y-n.y)<=1);if(npc){if(npc.area!==p.area||Math.abs(p.x-npc.x)+Math.abs(p.y-npc.y)>1)return{ok:false,mensagem:"Chegue mais perto para conversar."};return this.interagirCapitulo(id,npc.id)}}
 const oldSkill=c?.tipo==="atacar"?"corpo":c?.tipo==="atacarDistancia"?"distancia":null;const oldLevel=oldSkill?nivelHabilidade(p,oldSkill):0;if(oldSkill)p._tipoAtaque=oldSkill;
 const oldArea=p.area;const r=_executar(id,c);if(oldSkill){delete p._tipoAtaque;p.habilidades[oldSkill]=oldLevel;if(r?.danoAplicado){const ups=ganharSkill(p,oldSkill,1);if(ups)r.mensagem+=` Habilidade ${oldSkill}: nível ${p.habilidades[oldSkill]}.`;r.skillLevel=p.habilidades[oldSkill];salvar(p)}}
 if(r?.derrotado){const e=inimigos[r.inimigoId];if(e){const key=e.capitulo;if(key&&p.capitulos[key]?.status==="em_andamento"){p.capitulos[key].alvo=true;r.mensagem+=` Objetivo concluído: volte a ${NOVOS_NPCS[CAPITULOS[key].npc].nome}.`;}const item=e.dropItem;if(item){const drop={id:`saque_${e.id}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,area:e.area,x:e.x,y:e.y,item};p.saqueNoChao.push(drop);r.mensagem+=` Saque: ${nomeItem(item)}.`;}salvar(p)}}
 if(c?.tipo==="mover"&&!r?.areaAlterada){const portal=PORTAIS.find(x=>x.area===p.area&&x.x===p.x&&x.y===p.y);if(portal){if(portal.capitulo&&!capituloAnteriorConcluido(p,portal.capitulo)){r.mensagem=`O caminho ainda está bloqueado. Conclua o capítulo anterior antes de seguir para ${areas[portal.destino].nome}.`;return r}p.area=portal.destino;p.x=portal.chegada.x;p.y=portal.chegada.y;salvar(p);return{ok:true,areaAlterada:true,mensagem:`Você chegou a ${areas[p.area].nome}. Explore e fale com os personagens para iniciar o capítulo.`}}}
 if(c?.tipo==="mover"&&oldArea!==p.area)r.areaAlterada=true;return r};
Mundo.orar=function(id,acao){const p=this.jogadores[id];if(!p.oracaoDesbloqueada)return{ok:false,mensagem:"A Oração ainda não foi aprendida. Avance até a Galileia e converse com Jesus."};const level=nivelHabilidade(p,"oracao");if(acao==="vida"){if(p.fe<PRAYER_COST.vida)return{ok:false,mensagem:"Fé insuficiente. Use uma poção de fé ou aguarde a regeneração."};if(p.vida>=vidaMaxima(p))return{ok:false,mensagem:"Sua vida já está cheia."};p.fe-=PRAYER_COST.vida;const before=p.vida,heal=20+(level>=10?5:0);p.vida=Math.min(vidaMaxima(p),p.vida+heal);ganharSkill(p,"oracao",2);salvar(p);return{ok:true,cura:p.vida-before,mensagem:`Oração: recuperou ${p.vida-before} de vida. Fé ${p.fe}/${PRAYER_FAITH_MAX}.`}}
 if(acao==="veneno"){if(level<25)return{ok:false,mensagem:"Remover veneno desbloqueia no nível 25 de Oração."};if(Date.now()>=p.envenenadoAte)return{ok:false,mensagem:"Você não está envenenado."};if(p.fe<PRAYER_COST.veneno)return{ok:false,mensagem:"Fé insuficiente."};p.fe-=PRAYER_COST.veneno;p.envenenadoAte=0;p.proximoDanoVeneno=0;ganharSkill(p,"oracao",2);salvar(p);return{ok:true,mensagem:"O veneno foi removido pela Oração."}}
 if(acao==="area"){if(level<50)return{ok:false,mensagem:"Cura em área desbloqueia no nível 50 de Oração."};if(p.fe<PRAYER_COST.area)return{ok:false,mensagem:"Fé insuficiente."};if(p.vida>=vidaMaxima(p))return{ok:false,mensagem:"Sua vida já está cheia."};p.fe-=PRAYER_COST.area;const before=p.vida;p.vida=Math.min(vidaMaxima(p),p.vida+30);ganharSkill(p,"oracao",2);salvar(p);return{ok:true,cura:p.vida-before,mensagem:`Oração em área 3×3: você recuperou ${p.vida-before} de vida. O sistema atual é solo; aliados próximos receberão cura quando houver companheiros no jogo.`}}
 if(acao==="milagre"){if(level<100)return{ok:false,mensagem:"Milagre desbloqueia no nível 100 de Oração."};if(p.fe<PRAYER_COST.milagre)return{ok:false,mensagem:"Fé insuficiente."};p.fe=0;p.vida=vidaMaxima(p);p.envenenadoAte=0;ganharSkill(p,"oracao",2);salvar(p);return{ok:true,cura:vidaMaxima(p),mensagem:"Milagre: vida restaurada por completo e veneno removido."}}
 if(acao==="aliado")return{ok:false,mensagem:"Ainda não há grupo ou companheiros controláveis. A cura de aliados será habilitada quando o sistema de grupo existir."};return{ok:false,mensagem:"Escolha uma forma de Oração."}};
Mundo.interagirCapitulo=function(id,npcId){const p=this.jogadores[id],npc=NOVOS_NPCS[npcId],key=npc.capitulo,stage=p.capitulos[key];if(!capituloAnteriorConcluido(p,key))return{ok:true,mensagem:`${npc.nome}: conclua primeiro o capítulo anterior para chegar a esta etapa.`};if(key==="galileia"&&npcId==="jesusGalileia"){if(!stage.status||stage.status==="bloqueado")stage.status="em_andamento";p.oracaoDesbloqueada=true;salvar(p);return{ok:true,mensagem:"Jesus: Aprenda a cuidar dos viajantes com compaixão. A Oração foi aprendida: pressione F1 para escolher uma cura. Poções de vida e de fé também continuam disponíveis."}}
 if(stage.status==="bloqueado"){iniciarCapitulo(p,key);return{ok:true,mensagem:`${npc.nome}: ${MISSIONS[key]}`}}
 if(stage.status==="em_andamento"&&!stage.alvo)return{ok:true,mensagem:`${npc.nome}: ${MISSIONS[key]}`};
 if(stage.status==="em_andamento"&&stage.alvo){stage.status="concluida";const xp={egito:120,marVermelho:150,sinai:180,galileia:200}[key];const leveis=adicionarXP(p,xp);p.moedas+=(key==="egito"?30:key==="marVermelho"?40:key==="sinai"?50:60);if(key==="galileia")p.oracaoDesbloqueada=true;salvar(p);return{ok:true,mensagem:`${npc.nome}: obrigado pela ajuda! +${xp} XP e moedas de recompensa.${leveis.length?` Você subiu ao nível ${p.nivel}.`:""}${key==="galileia"?" Converse com Jesus para aprender a Oração.":" Próxima região liberada."}`}}
 return{ok:true,mensagem:key==="galileia"?"Pedro: Fale com Jesus para aprender a Oração." : `${npc.nome}: obrigado por proteger o povo.`};};
const _atualizar=Mundo.atualizar.bind(Mundo);
Mundo.atualizar=function(id,agora){const p=this.jogadores[id];if(!p)return _atualizar(id,agora);const coins=p.moedas,loc={area:p.area,x:p.x,y:p.y},beforeDeaths=p.mortes,events=_atualizar(id,agora);if(p.mortes>beforeDeaths){const lvl=p.nivel;const rate=lvl<=10?0:.10;p.moedas=Math.max(0,coins-Math.floor(coins*rate));let note=lvl<=10?"Sem penalidade de morte até o nível 10.":`${Math.floor(coins*rate)} moedas perdidas.`;if(lvl>=26){const key=Object.keys(p.skillXp).sort((a,b)=>p.skillXp[b]-p.skillXp[a])[0];const loss=Math.floor((p.skillXp[key]||0)*(lvl>=51?.10:.05));p.skillXp[key]=Math.max(0,p.skillXp[key]-loss);note+=` ${loss} XP de ${key} perdidos.`}if(lvl>=51&&p.inventario.length&&Math.random()<.30){const ix=Math.floor(Math.random()*p.inventario.length),item=p.inventario.splice(ix,1)[0];p.saqueNoChao.push({id:`morte_${Date.now()}`,area:loc.area,x:loc.x,y:loc.y,item});note+=` Um item caiu: ${nomeItem(item)}.`}events[0].mensagem+=` Regra de morte: ${note}`;Storage.salvar(p)}if(p.envenenadoAte>agora&&agora>=p.proximoDanoVeneno){p.proximoDanoVeneno=agora+3000;p.vida=Math.max(0,p.vida-3);if(p.vida===0){p.envenenadoAte=0;p.area="canaan";p.x=2;p.y=2;p.vida=vidaMaxima(p);p.mortes++;events.push({tipo:"renasceu",mensagem:"O veneno foi fatal; você voltou a Canaã."})}else events.push({tipo:"jogadorAtingido",dano:3,defesaBloqueada:0,mensagem:"O veneno causa 3 de dano."});Storage.salvar(p)}if(p.oracaoDesbloqueada&&p.fe<PRAYER_FAITH_MAX&&agora>=(p.proximaRegenFe||0)){p.fe=Math.min(PRAYER_FAITH_MAX,p.fe+1);p.proximaRegenFe=agora+PRAYER_REGEN_MS;Storage.salvar(p)}return events};
// Apply faith and poison effects from the scorpion after its ordinary hit resolves.
const _updateWithPoison=Mundo.atualizar.bind(Mundo);
Mundo.atualizar=function(id,agora){const p=this.jogadores[id],before=p?.vida,defBefore=p?.habilidades?.defesa||0,events=_updateWithPoison(id,agora);if(p&&(p.habilidades.defesa||0)>defBefore){const gained=p.habilidades.defesa-defBefore;p.habilidades.defesa=defBefore;ganharSkill(p,"defesa",gained);salvar(p)}if(p&&before!==undefined&&p.vida<before&&p.area==="deserto"&&Object.values(inimigos).some(e=>e.id==="escorpiao1"&&e.area===p.area&&Math.max(Math.abs(e.x-p.x),Math.abs(e.y-p.y))<=1)&&!p.envenenadoAte){p.envenenadoAte=agora+15000;p.proximoDanoVeneno=agora+3000;events.push({tipo:"veneno",mensagem:"O escorpião envenenou você. A Oração poderá remover o veneno a partir do nível 25."});salvar(p)}return events};
