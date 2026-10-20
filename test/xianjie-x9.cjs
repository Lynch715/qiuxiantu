// 仙界第二版 X9：仙庭官职。用法：node test/xianjie-x9.cjs
const assert=require('node:assert/strict');
const {env,NPC,BASE,UP}=require('./xjv2-env.cjs');
const {run,val,force}=env();
let n=0; const t=(name,fn)=>{fn();n++;console.log('✓ '+name);};
const R=r=>`S.player.realm=parseRealm('${r}');syncPower(S.player);`;
const TICK=k=>`for(let i=0;i<${k};i++){ S.months++; courtTick(); }`;

t('入仕：人在仙界才能应募，只给仙吏；不能重复入仕；仙界没有仙庭就补一个',()=>{
  run(BASE); assert.ok(/不在仙界/.test(val('courtJoin().why')));
  run(UP); const r=val('courtJoin()'); assert.ok(r.ok); assert.equal(r.name,'紫霄仙庭');
  assert.equal(val('courtRank()'),'仙吏'); assert.equal(val('S.stats.court'),1); assert.ok(/已经在仙庭/.test(val('courtJoin().why')));
  assert.ok(val(`ACHIEVEMENTS.find(a=>a[0]==='court')[2](S)`));
  run(BASE); run(UP); run(`S.world.factions=S.world.factions.filter(f=>!/仙庭/.test(f.name));`); assert.ok(val('courtJoin().ok')); assert.ok(val(`S.world.factions.some(f=>f.name==='紫霄仙庭')`));
});
t('官阶要功绩和境界都够：功绩够了境界不够不升；修上去当月就升，报风闻',()=>{
  run(BASE); run(UP); run(`courtJoin();addMerit(80,'测试')`); assert.equal(val('courtRank()'),'仙吏'); assert.equal(val('courtNext().realm'),'天仙');
  run(R('天仙初期')+`S.engineNews=[];`+TICK(1)); assert.equal(val('courtRank()'),'仙官'); assert.ok(val('S.engineNews').some(x=>/升为仙官/.test(x)));
  run(R('太乙金仙初期')+`addMerit(2000)`); assert.equal(val('courtRank()'),'帝君'); assert.equal(val('S.stats.dijun'),1);
});
t('俸禄按月发仙晶（仙吏一年约两块半）；不闭关的月份当值记功（一月 2 点）；闭关算告假：俸禄减半、不派差、期限顺延',()=>{
  run(BASE); run(UP); run(`courtJoin();S.court.nextDuty=1e9;S.player.money=0;S.player.cultMode='日常';`+TICK(12));
  assert.equal(val('S.player.money'),2); assert.equal(val('Math.floor(S.court.merit)'),24); assert.equal(val('gongDe()'),24);
  run(`S.player.cultMode='闭关';S.player.money=0;`+TICK(12)); assert.equal(val('Math.floor(S.court.merit)'),24,'闭关不当值'); assert.equal(val('S.player.money'),1,'闭关告假，俸禄减半');
  run(`S.court.nextDuty=S.months;S.court.duty=null;`+TICK(24)); assert.equal(val('S.court.duty'),null,'闭关不派差');
  run(`S.court.duty={id:'c1',type:'镇守',text:'镇守',born:S.months,due:S.months+2};`+TICK(30)); assert.ok(val('S.court.duty')&&val('S.court.duty.due')>val('S.months'),'闭关时期限顺延');
});
t('派差：到期派一桩，期限两年；缉拿造出一个通缉的魔仙，选项里是生死斗法',()=>{
  run(BASE); run(UP); run(`courtJoin();S.court.nextDuty=S.months;S.engineNews=[];`);
  force(0.01,()=>run('courtTick()'));
  const d=val('S.court.duty'); assert.equal(d.type,'缉拿'); assert.equal(d.due-d.born,24); assert.ok(val('S.engineNews').some(x=>/派下差事：缉拿魔仙/.test(x)));
  const nn=val(`findNpc('${d.target}')`); assert.ok(nn&&nn.alignment==='邪道'&&nn.relation==='仙庭通缉的魔仙'); assert.ok(val(`isXianRealm(findNpc('${d.target}').realm)`));
  const o=val('engineOptions([{text:"随便走走",type:"normal"}])').find(x=>x.courtDuty); assert.equal(o.type,'duel'); assert.equal(o.duel.opponent,d.target); assert.ok(o.duel.lethal);
  const j=val(`makeJudge(${JSON.stringify(o)},${JSON.stringify(o.text)})`); assert.equal(j.courtDuty,d.id);
});
t('差事办成记功（按官阶放大），缉拿另给仙晶；没办成不记功也不算怠慢',()=>{
  run(BASE); run(UP); run(`courtJoin();S.court.nextDuty=S.months;`); force(0.01,()=>run('courtTick()'));
  run(`S.player.money=0;S._j={courtDuty:S.court.duty.id,dutyWin:true};applyCourt(S._j);`);
  assert.equal(val('Math.floor(S.court.merit)'),32,'当月当值2点、缉拿30点'); assert.equal(val('S.player.money'),2); assert.equal(val('S.court.duty'),null); assert.ok(val('S._j.dutyRes.ok'));
  assert.ok(run(`turnPrompt('缉拿',{fate:10,months:0,check:null,duel:true,dutyRes:S._j.dutyRes})`).includes('仙庭差事（缉拿）'));
  run(R('玄仙初期')+`S.court.merit=200;S.court.nextDuty=S.months;`); force(0.4,()=>run('courtTick()')); assert.equal(val('courtRank()'),'仙将');
  run(`S.court.duty={id:'x1',type:'巡查',text:'巡查东极',born:S.months,due:S.months+24,need:70};applyCourt({courtDuty:'x1',check:{success:false}})`);
  assert.equal(val('Math.floor(S.court.merit)'),202); assert.deepEqual(val('S.court.slack'),[]);
  run(`S.court.duty={id:'x2',type:'镇守',text:'镇守南天门一年',born:S.months,due:S.months+24};applyCourt({courtDuty:'x2'})`); assert.equal(val('Math.floor(S.court.merit)'),242,'仙将 ×2，另含当月当值2点');
});
t('查抄查到自己宗门：照办记功、宗门贡献 −60、同门记恨；遮掩功绩 −20、贡献 +20',()=>{
  run(BASE); run(UP); run(`S.sect={name:'太微仙宗',contrib:300,joined:1,own:false};S.player.faction='太微仙宗';S.npcs.push(${NPC('师兄','天仙初期','同门',60,3000)});findNpc('师兄').faction='太微仙宗';courtJoin();S.court.merit=100;`);
  run(`S.court.duty={id:'q1',type:'查抄',text:'查抄太微仙宗私开的一条仙矿',born:S.months,due:S.months+24,sect:'太微仙宗',own:true};`);
  const os=val('dutyOptions()'); assert.equal(os.length,2); assert.ok(/贡献 −60/.test(os[0].hint));
  run(`applyCourt({courtDuty:'q1',dutyChoice:'do'})`); assert.equal(val('S.sect.contrib'),240); assert.equal(val(`findNpc('师兄')['好感度']`),45); assert.equal(val('Math.floor(S.court.merit)'),130);
  run(`S.court.duty={id:'q2',type:'查抄',text:'查抄太微仙宗私开的一条仙矿',born:S.months,due:S.months+24,sect:'太微仙宗',own:true};applyCourt({courtDuty:'q2',dutyChoice:'spare'})`);
  assert.equal(val('Math.floor(S.court.merit)'),110); assert.equal(val('S.sect.contrib'),260);
});
t('逾期不办：功绩 −20 记怠慢；三年内两回贬一级；仙吏直接革职；通缉的魔仙撤掉',()=>{
  run(BASE); run(UP); run(R('天仙初期')+`courtJoin();S.court.merit=100;S.court.nextDuty=S.months;`); force(0.01,()=>run('courtTick()'));
  const tg=val('S.court.duty.target'); run(`S.court.nextDuty=1e9;S.months=S.court.duty.due+1;courtTick();`);
  assert.equal(val('Math.floor(S.court.merit)'),84,'两个月当值4点，逾期仍罚20点'); assert.equal(val('S.court.slack.length'),1); assert.equal(val(`findNpc('${tg}')`),null);
  run(`S.court.duty={id:'m2',type:'镇守',text:'镇守',born:S.months,due:S.months};S.months++;courtTick();`);
  assert.equal(val('courtRank()'),'仙吏'); assert.equal(val('S.court.merit'),0); assert.equal(val('courtOn()'),true);
  run(`S.court.duty={id:'m3',type:'镇守',text:'镇守',born:S.months,due:S.months};S.months++;courtTick();S.court.duty={id:'m4',type:'镇守',text:'镇守',born:S.months,due:S.months};S.months++;courtTick();`);
  assert.equal(val('courtOn()'),false); assert.ok(val('S.ledger').some(x=>/革职/.test(x)));
});
t('仙庭兑换：后三关仙丹、仙府闭关（仙官）、天兵护劫（仙将）、仙庭护劫（仙君）；花余额不降官阶',()=>{
  run(BASE); run(UP); run(R('天仙初期')+`courtJoin();S.court.merit=150;S.court.gongde=150;`);
  assert.ok(/可用功绩不够/.test(val(`courtBuy('金阙丹').why`)));
  assert.ok(val(`courtBuy('仙府闭关·真仙关').ok`)); assert.equal(val('prepState(S.player).xianFu'),true); assert.equal(val('courtAvail()'),50); assert.equal(val('courtRank()'),'仙官');
  assert.ok(/仙将以上/.test(val(`courtBuy('天兵护劫·金仙关').why`)));
  run(R('金仙初期')+`S.court.merit=1500;`); assert.ok(val(`courtBuy('天兵护劫·金仙关').ok`)); assert.equal(val('prepState(S.player).tianbing'),12);
  assert.ok(val(`courtBuy('仙庭护劫·仙劫').ok`)); assert.equal(val('prepState(S.player).xjCourt'),true);
  assert.ok(val(`courtBuy('金阙丹').ok`)); assert.ok(val(`S.player.items['丹药'].some(x=>x.name==='金阙丹')`));
  run(R('玄仙后期')+`S.player.lingli=lingliNeed(S.player.realm);`); assert.ok(val('prepOptions(S.player).list').find(o=>o.key==='tianbing').ok);
});
t('奉旨下凡：仙将以上才派；不花仙晶、不碰界壁冷却；限期一年、每月气血 −1；不能接引；回来复命记功',()=>{
  run(BASE); run(UP); run(R('玄仙初期')+`S.player.money=5;courtJoin();S.court.merit=200;S.court.gongde=200;S.court.nextDuty=S.months;`);
  force(0.99,()=>run('courtTick()')); assert.equal(val('S.court.duty.type'),'下凡公干');
  const o=val('dutyOptions()')[0]; assert.ok(o.officialDescent); assert.ok(/不花仙晶/.test(o.hint));
  const i=val('startDescent(true)'); assert.ok(i.ok&&i.official); assert.equal(val('curPlane()'),'下界'); assert.equal(val(`S.player.wallet['仙晶']`),5);
  assert.equal(val('S.descent.until-S.descent.since'),12); assert.equal(val('S.court'),null); assert.equal(val('S.planes.仙界.court.duty.taken'),true);
  assert.ok(val('gongDe()')>=200,'下凡时功德读仙界那份');
  run(`findNpc('沈清').realm=parseRealm('化神后期');S.jieyinCD=0;`); assert.ok(!val('engineOptions([])').some(x=>x.jieyin),'公差不能接引');
  assert.ok(run(`turnPrompt('镇压魔修',{fate:10,months:1,check:null})`).includes('奉仙庭之命下凡公干'));
  run(`S.player.hp=100;advanceTime(6)`); assert.equal(val('S.player.hp'),94);
  run(`var mission=officialMission();applyCourt({courtMission:mission.id,missionTarget:mission.target,duel:true,dutyWin:true});`);
  const r=val('endDescent()'); assert.ok(r.official); assert.equal(r.duty.res,'功绩 +80'); assert.equal(val('curPlane()'),'仙界'); assert.equal(val('Math.floor(S.court.merit)'),282,'出发前当月当值2点、公干80点');
  assert.equal(val('num(S.descentCD)'),0,'公差不碰界壁冷却');
  assert.ok(run(`planeTripBlock({returnUp:${JSON.stringify(r)}})`).includes('回仙庭复命'));
});
t('提示词：【仙庭】一行、官称、土著面上客气、仙界规矩里写明差事是引擎的账；入仕回合',()=>{
  run(BASE); run(UP); run(`S.npcs.push(${NPC('土著','天仙中期','相识',30,3000)});findNpc('土著').lastSeen=S.turn;S.scene.present=['土著'];`);
  let p=run(`turnPrompt('走走',{fate:10,months:1,check:null})`); assert.ok(!p.includes('【仙庭】')); assert.ok(p.includes('打心底瞧不起下界飞升上来的人：说话带刺'));
  run(R('天仙初期')+`courtJoin();S.court.merit=70;S.court.nextDuty=1e9;`); p=run(`turnPrompt('走走',{fate:10,months:1,check:null})`);
  assert.ok(p.includes('【仙庭】紫霄仙庭仙官，功绩70')); assert.ok(p.includes('称他「韩仙官」')); assert.ok(p.includes('面上还算客气')); assert.ok(p.includes('- 仙庭官职：仙吏、仙官、仙将、仙君、帝君'));
  p=run(`turnPrompt('应募',{fate:10,months:1,check:null,courtJoin:{name:'紫霄仙庭'}})`); assert.ok(p.includes('- 入仕：主角到紫霄仙庭应募'));
});
t('辞官：功德留着；再入仕从仙吏做起、功绩从零攒',()=>{
  run(BASE); run(UP); run(R('天仙初期')+`courtJoin();addMerit(150);`); assert.equal(val('courtRank()'),'仙官');
  assert.ok(val('courtResign().ok')); assert.equal(val('courtOn()'),false); assert.equal(val('gongDe()'),150);
  assert.ok(val('courtJoin().ok')); assert.equal(val('courtRank()'),'仙吏'); assert.equal(val('S.court.merit'),0); assert.equal(val('gongDe()'),150); assert.equal(val('S.court.times'),2);
});
t('仙庭随仙界封存：自己下凡时 S.court 换成下界的空值，回来还在',()=>{
  run(BASE); run(UP); run(R('金仙初期')+`S.player.money=50;courtJoin();addMerit(40);S.months+=2400;startDescent();`);
  assert.equal(val('S.court'),null); assert.equal(val('S.planes.仙界.court.merit'),40);
  run('endDescent()'); assert.equal(val('S.court.merit'),40);
});
t('领了差事的那一回合：一年的镇守跨过期限也不算怠慢；提示词里先写好结果',()=>{
  run(BASE); run(UP); run(`courtJoin();S.court.merit=10;S.court.nextDuty=1e9;S.court.duty={id:'k1',type:'镇守',text:'镇守南天门一年',born:S.months,due:S.months+2};S._f=forecastTurn(S,{fate:10,months:12,cult:'日常',courtDuty:'k1'},'去南天门当值');`);
  assert.equal(val('S._f.state.court.duty.id'),'k1'); assert.equal(val('S._f.state.court.duty.taken'),true); assert.deepEqual(val('S._f.state.court.slack'),[]);
  const p=run(`(()=>{ const o=S; S=S._f.state; try{ return turnPrompt('去南天门当值',{fate:10,months:12,check:null,courtDuty:'k1'}); } finally{ S=o; } })()`);
  assert.ok(p.includes('- 仙庭差事（镇守）：镇守南天门一年。引擎已判定【办成】，已落账：功绩 +20'));
});
console.log(`\n${n} 项通过`);
