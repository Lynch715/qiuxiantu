// 建设回归。REAL_SAVE 只读取本地副本，不把用户资料写入仓库。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const {env,BASE,UP}=require('./xjv2-env.cjs');
const current=process.argv[2]||path.join(__dirname,'../index.html');
let baseline=process.env.CONSTRUCTION_BASELINE||path.join(__dirname,'../_backup/index-before-construction-20261017.html');
if(!fs.existsSync(baseline)&&!process.env.CONSTRUCTION_BASELINE){const tmp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'xian-construction-baseline-'));baseline=path.join(tmp,'index.html');fs.writeFileSync(baseline,require('node:child_process').execFileSync('git',['show','1b8a829:index.html'],{cwd:path.join(__dirname,'..'),maxBuffer:5*1024*1024}));process.on('exit',()=>fs.rmSync(tmp,{recursive:true,force:true}));}
const approvedText=fs.readFileSync(path.join(__dirname,'../洞府与宗门建设_第一版设计方案_v0.1.md'),'utf8');
const approved={};for(const [plane,title,unit] of [['下界','人界','灵石'],['仙界','仙界','仙晶']]){const section=approvedText.split('### '+title+'价格与工期')[1].split('\n##')[0];approved[plane]=section.split('\n').filter(line=>/^\| [一二三四五]级 \|/.test(line)).map(line=>line.split('|').slice(2,-1).map(cell=>{const m=cell.trim().match(new RegExp('^(\\d+)'+unit+' / (\\d+)个月$'));assert(m,'公开方案价目格式');return {cost:Number(m[1]),days:Number(m[2])*30};}));assert.equal(approved[plane].length,5);}
const results=[];let passed=0;
const clone=x=>JSON.parse(JSON.stringify(x)),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function test(name,fn){const t=performance.now();fn();passed++;console.log('✓ '+name);results.push({name,ms:Math.round(performance.now()-t)});}
function setup(plane='下界',file=current){const e=env(file,31);if(file===baseline)require('./player-family-policy.cjs')(e);e.run(BASE);if(plane==='仙界')e.run(UP);e.run(`S.player.money=1e8;S.player.age=30;S.player.lifeBonus=1e6;S.player.cultMode='闭关';S.player.lingli=0;`);return e;}
function install(e,levels=[5,5,5,5]){
  e.run(`constructionStart('home',{site:'sect'});var home=constructionRealm(curPlane()).home,rec=constructionRealm(curPlane()).sects[0];home.project=null;home.level=${levels[0]};rec.levels={array:${levels[1]},library:${levels[2]},arena:${levels[3]}};S.scene.location=home.location;S.estates.rev++;`);
}
function originalRate(e){return e.run(`monthlyLingli(S.player,{mode:'闭关',gongfa:gongfaMult(S.player)*(num(S.player.cultMul)||1),aura:auraOf(),partner:partnerMul(S.player)})`);}
for(const plane of ['下界','仙界']){
 test(plane+'：全部20项费用与工期逐级付款，不能跳级，满级封顶',()=>{
  const e=setup(plane);if(plane==='仙界')e.run(`S.sect={name:S.world.factions[1].name,contrib:20};S.player.faction=S.sect.name;S.player.realm=parseRealm('大罗金仙中期');`);
  e.run(`S.world.factions.forEach(f=>f.power=100);`);
  for(const kind of ['home','array','library','arena'])for(let i=0;i<5;i++){
   e.run(`var q=constructionQuote('${kind}',{site:'sect',source:'personal'});`);assert(e.run('q.ok'));
   assert.equal(e.run('q.target'),i+1);const expected=approved[plane][i][['home','array','library','arena'].indexOf(kind)];assert.equal(e.run('q.cost'),expected.cost);assert.equal(e.run('q.days'),expected.days);
   const money=e.run('S.player.money');assert(e.run(`constructionStart('${kind}',{site:'sect',source:'personal'},q).ok`));assert.equal(money-e.run('S.player.money'),e.run('q.cost'));
   assert(!e.run(`constructionQuote('${kind}',{source:'personal'}).ok`));e.run(`S.elapsedDays+=q.days;S.months=Math.floor(S.elapsedDays/30);constructionComplete(S.elapsedDays);`);
  }
  assert(!e.run(`constructionQuote('home').ok`));assert.equal(e.run(`S.estates.history.filter(x=>x.event==='完工').length`),20);
 });
}
test('报价/面板读取不修改旧档、不消费随机数；不足和不安全地点无副作用',()=>{
 const a=setup(),e=setup(),before=e.run('JSON.stringify(S)');e.run(`constructionQuote('home',{site:'sect'});constructionFrame(curPlane());constructionBlock();`);assert.equal(e.run('JSON.stringify(S)'),before);assert.equal(e.run('Math.random()'),a.run('Math.random()'));
 e.run(`S.player.money=0;`);const snap=e.run('JSON.stringify(S)');assert(!e.run(`constructionStart('home',{site:'sect'}).ok`));assert.equal(e.run('JSON.stringify(S)'),snap);
 e.run(`S.player.money=1e8;S.scene.location='秘境战场';`);assert(!e.run(`constructionQuote('home',{site:'current'}).ok`));assert(!e.run('!!S.estates'));
});
test('开工仅改变工程、扣款与归属关联；原物品、人物、关系和历史完整不变',()=>{
 const e=setup();const before=e.val('S'),money=before.player.money;e.run(`var q=constructionQuote('home',{site:'sect'});constructionStart('home',{site:'sect'},q);`);const after=e.val('S');delete after.estates;for(const f of after.world.factions)delete f.buildKey;after.player.money=money;assert.deepEqual(after,before);
});
test('普通门人个人赞建不夺掌门、不添贡献；公共工程不能并行',()=>{
 const e=setup(),leader=e.run('S.world.factions[0].leader'),contrib=e.run('S.sect.contrib');assert(e.run(`constructionStart('array',{source:'personal'}).ok`));assert.equal(e.run('S.world.factions[0].leader'),leader);assert.equal(e.run('S.sect.contrib'),contrib);assert(!e.run(`constructionStart('library',{source:'personal'}).ok`));
 assert(!e.run(`constructionQuote('library',{source:'treasury'}).ok`));
});
test('自创公账不足不得暗扣个人；混合付款正确且重复确认只付一次',()=>{
 const e=setup();e.run(`S.clan={name:S.sect.name,treasury:200,base:'青云宗山门',disciples:[]};`);const old=e.run('S.player.money');assert(!e.run(`constructionQuote('array',{source:'treasury'}).ok`));assert.equal(e.run('S.player.money'),old);
 e.run(`var q=constructionQuote('array',{source:'mixed'});var r=constructionStart('array',{source:'mixed'},q);`);assert(e.run('r.ok'));assert.equal(e.run('S.clan.treasury'),0);assert.equal(e.run('S.player.money'),old-400);e.run(`constructionStart('array',{source:'mixed'},q);`);assert.equal(e.run('S.player.money'),old-400);assert.equal(e.run(`S.estates.history.filter(x=>x.event==='开工').length`),1);
});
test('报价失效、推演中与战斗中不启动、不扣款',()=>{
 const e=setup();e.run(`var q=constructionQuote('home',{site:'sect'});S.elapsedDays++;`);assert(!e.run(`constructionStart('home',{site:'sect'},q).ok`));assert(!e.run('!!S.estates'));
 e.run(`S.pending={id:'pending'};`);assert(!e.run(`constructionStart('home',{site:'sect'}).ok`));e.run(`S.pending=null;S.duelState={};`);assert(!e.run(`constructionQuote('home').ok`));
});
test('第30日完工不倒算第一个月；第二个月才有8%洞府收益',()=>{
 const e=setup();e.run(`constructionStart('home',{site:'sect'});S.scene.location=constructionRealm(curPlane()).home.location;`);const g=originalRate(e);e.run('advanceTime(1)');near(e.run('S.player.lingli'),g);assert.equal(e.run('constructionRealm(curPlane()).home.level'),1);e.run('advanceTime(1)');near(e.run('S.player.lingli'),g*(1+1.08));
});
test('升级中旧级继续生效，暂停/恢复不二次收费，完成消息只登记一次',()=>{
 const e=setup();e.run(`constructionStart('home',{site:'sect'});advanceTime(.5);constructionPause('home');`);const money=e.run('S.player.money');e.run(`advanceTime(2);`);assert.equal(e.run('constructionRealm(curPlane()).home.level'),0);assert.equal(e.run('constructionRealm(curPlane()).home.project.remaining'),15);
 const resumeMoney=e.run('S.player.money');e.run(`constructionPause('home');`);assert.equal(e.run('S.player.money'),resumeMoney);e.run(`advanceTime(.5);constructionComplete(S.elapsedDays);constructionComplete(S.elapsedDays);`);assert.equal(e.run('constructionRealm(curPlane()).home.level'),1);assert.equal(e.run(`S.estates.history.filter(x=>x.event==='完工').length`),1);assert.equal(e.run(`S.estates.history.filter(x=>x.event==='开工').length`),1);
 e.run(`constructionStart('home',{site:'sect'});S.scene.location=constructionRealm(curPlane()).home.location;S.player.lingli=0;`);const g=originalRate(e);e.run(`advanceTime(4);`);near(e.run('S.player.lingli'),g*(3*1.08+1.14));
});
test('先逐段封顶再按天数加权，月中离山所得25%不是27.5%',()=>{
 const e=setup();install(e);const g=originalRate(e);assert.equal(e.run('constructionFrame(curPlane()).player'),.5);e.run(`advanceTime(.5);S.scene.location='远方山谷';advanceTime(.5);`);near(e.run('S.player.lingli'),g*1.25);
});
test('设施地点不沿用三字前缀：同名仙域、宗门外与远处不算在山',()=>{
 const e=setup();assert(!e.run(`constructionHere('紫霄仙域·接引城','紫霄仙庭山门')`));assert(!e.run(`constructionHere('青云宗山门外·坊市','青云宗山门')`));assert(!e.run(`constructionHere('青云宗山门途中','青云宗山门')`));assert(e.run(`constructionHere('紫霄仙域·紫霄仙庭·正院','紫霄仙庭山门')`));assert(e.run(`constructionHere('青云宗山门·演武场','青云宗山门')`));
 install(e);e.run(`S.scene.location='青云宗山门外·坊市';`);assert.equal(e.run('constructionFrame(curPlane()).player'),0);
});
test('两界独立保存工程，离界仍完工；仙人不能借人界设施加速仙元',()=>{
 const e=setup();e.run(`constructionStart('home',{site:'sect'});`);const id=e.run('constructionRealm(curPlane()).home.id');e.run(UP);e.run(`advanceTime(2);`);assert.equal(e.run(`constructionRealm('下界').home.level`),1);assert.equal(e.run(`constructionRealm('下界').home.id`),id);assert.equal(e.run(`constructionRealm('仙界')`),null);
 e.run(`switchPlane('下界');S.scene.location=constructionRealm(curPlane()).home.location;`);assert.equal(e.run('constructionFrame(curPlane()).player'),0);
});
test('离界工程完工只追加消息，不截掉原有信件与工程历史',()=>{
 const e=setup();e.run(`constructionStart('home',{site:'sect'});`);e.run(UP);e.run(`var packet=constructionPacket('下界');packet.mail=Array.from({length:45},(_,i)=>'旧信'+i);var oldMail=JSON.stringify(packet.mail);S.elapsedDays+=30;constructionComplete(S.elapsedDays);`);assert.equal(e.run('packet.mail.length'),46);assert.equal(e.run('JSON.stringify(packet.mail.slice(0,45))'),e.run('oldMail'));assert.equal(e.run(`S.estates.history.filter(x=>x.event==='完工').length`),1);
});
test('聚灵阵与藏经阁作用于真实NPC，演武仅修炼岗位，同人两本账不重复',()=>{
 const e=setup();install(e);e.run(`S.npcs=[normNpc({name:'门人甲',realm:'筑基初期',age:30,faction:S.sect.name,location:'青云宗山门',lingli:0})];var n=S.npcs[0];n.lingli=0;n.tags=[];n.breakCD=0;S.clan={name:S.sect.name,disciples:[{id:'d1',name:n.name,npcName:n.name,alive:true,job:'修炼',武功:n.武功,talent:5,prog:0}],treasury:1000};`);
 assert.equal(e.run(`constructionFrame(curPlane()).npc[n.entityId||n.name]`),.6);assert.equal(e.run(`constructionFrame(curPlane()).disc.d1||0`),0);
 const g=e.run(`monthlyLingli(n,{mode:'闭关'})*.7`);e.run('npcCultivateMonth(n,[])');near(e.run('n.lingli'),g*1.6);e.run(`S.clan.disciples[0].job='授艺';`);near(e.run(`constructionFrame(curPlane()).npc[n.entityId||n.name]`),.4);
 e.run(`S.clan.disciples[0].job='云游';`);assert.equal(e.run(`constructionFrame(curPlane()).npc[n.entityId||n.name]||0`),0);
});
test('抽象弟子使用独立培养入口，资质上限和原训练分工保留',()=>{
 const e=setup();install(e);e.run(`S.clan={name:S.sect.name,disciples:[{id:'d0',name:'抽象弟子',alive:true,job:'修炼',武功:20,talent:5,prog:0}],treasury:1000};`);assert.equal(e.run(`constructionFrame(curPlane()).disc.d0`),.6);e.run(`S.clan.disciples[0].job='护山';`);near(e.run(`constructionFrame(curPlane()).disc.d0`),.4);
});
test('月中补齐NPC身份标识后，前后两个时段的培养收益仍属于同一个人',()=>{
 const e=setup();install(e,[0,1,0,0]);e.run(`S.npcs=[normNpc({name:'新门人',realm:'筑基初期',age:30,faction:S.sect.name,location:'青云宗山门'})];var n=S.npcs[0];n.lingli=0;n.breakCD=0;n.tags=[];`);
 const g=e.run(`monthlyLingli(n,{mode:'闭关'})*.7`);e.run(`advanceTime(.5);syncKnownEntities(S);advanceTime(.5);`);near(e.run('n.lingli'),g*1.05);
});
test('藏经阁只减已持功法参悟难度，不减方谱与突破，不改变骰点',()=>{
 const e=setup();install(e);e.run(`S.scene.location=rec.location+'·藏经阁';`);assert.equal(e.run(`constructionStudyBonus({recipe:''})`),5);assert.equal(e.run(`constructionStudyBonus({recipe:'炼丹'})`),0);
 const a=e.force(.5,()=>e.val(`studyRoll({need:85,recipe:''})`));e.run(`S.scene.location='远方山谷';`);const b=e.force(.5,()=>e.val(`studyRoll({need:85,recipe:''})`));assert.equal(b.dc-a.dc,5);assert.equal(a.roll,b.roll);
});
test('演武场熟练额外小数累计，不每次向上取整，场外不生效',()=>{
 const e=setup();install(e);e.run(`var art={name:'旧剑诀',style:'攻伐',level:20};`);assert.deepEqual(e.val(`[constructionTrainDelta(art,1,.25),constructionTrainDelta(art,1,.25),constructionTrainDelta(art,1,.25),constructionTrainDelta(art,1,.25)]`),[1,1,1,2]);
 e.run(`S.scene.location=rec.location+'·演武场';`);assert.equal(e.run(`constructionFrame(curPlane()).train`),3);e.run(`S.scene.location='远方山谷';`);assert.equal(e.run(`constructionFrame(curPlane()).train`),0);
});
test('存读档恢复月中分段、暂停和工程，不丢历史物品且不重复付款',()=>{
 const e=setup();install(e,[4,4,4,4]);e.run(`advanceTime(.5);constructionStart('home',{site:'sect'});constructionPause('home');var exported=JSON.stringify(S);S=JSON.parse(exported);migrate(S);`);assert(e.run('constructionRealm(curPlane()).home.project.paused'));assert.equal(e.run('S.estates.history[0].event'),'开工');assert(e.run(`S.player.items&&S.npcs.length>0`));
});
if(fs.existsSync(baseline))for(const pl of ['下界','仙界'])test(pl+'：零级未建设：统一主动生育规则后一年预演/RNG与发布版相同',()=>{
 const a=setup(pl,baseline),b=setup(pl,current),expr=`JSON.stringify(forecastTurn(S,{months:12,cult:'闭关',fate:10},'闭关一年'))`;assert.equal(b.run(expr),a.run(expr));assert.equal(b.run('Math.random()'),a.run('Math.random()'));assert(!b.run('!!S.estates'));
});
if(process.env.REAL_SAVE){
 const bytes=fs.readFileSync(process.env.REAL_SAVE),save=JSON.parse(bytes),beforeHash=hash(bytes);
 const real=(file=current,seed=31)=>{const e=env(file,seed);if(file===baseline)require('./player-family-policy.cjs')(e);e.run('v=>Object.assign(globalThis,v)')({privateSave:clone(save)});e.run('S=privateSave;saveGame=()=>{};toast=()=>{};migrate(S);');return e;};
 for(const months of [12,3600])test('用户存档未建设：'+months+'个月完整预演/RNG与原发布版一致',()=>{
  const a=real(baseline),b=real(),expr=`JSON.stringify(forecastTurn(S,{months:${months},cult:'闭关',fate:10},'闭关'))`,ta=performance.now(),x=a.run(expr),beforeMs=performance.now()-ta,tb=performance.now(),y=b.run(expr),afterMs=performance.now()-tb;assert.equal(y,x);assert.equal(b.run('Math.random()'),a.run('Math.random()'));results.push({actualSave:true,months,beforeMs,afterMs,hash:hash(y),sameStateAndRandom:true});
 });
 test('用户仙界存档：洞府、三项赞建及原始记忆/物品不被工程操作改动',()=>{
  const e=real();const facts=e.val(`[S.player.items,S.npcs,S.rels,S.history,S.quests,S.volumes,S.knowledge]`);for(const k of ['home','array','library','arena']){e.run(`var q=constructionQuote('${k}',{site:'sect',source:'personal'});`);assert(e.run('q.ok'));e.run(`constructionStart('${k}',{site:'sect',source:'personal'},q);S.elapsedDays+=q.days;S.months=Math.floor(S.elapsedDays/30);constructionComplete(S.elapsedDays);`);}assert.deepEqual(e.val(`[S.player.items,S.npcs,S.rels,S.history,S.quests,S.volumes,S.knowledge]`),facts);results.push({actualSave:true,plane:'仙界',constructionRetainsRecords:true});
 });
 test('用户人界存档副本：切回人界建设四项，仙人无错用人界加成',()=>{
  const e=real();e.run(`switchPlane('下界');S.pending=null;S.player.faction=S.world.factions[0].name;S.sect={name:S.player.faction,contrib:20};S.player.money=1e6;S.scene={location:S.player.faction+'山门',present:[],unresolved:[]};`);const items=e.run('JSON.stringify(S.player.items)');for(const k of ['home','array','library','arena']){e.run(`var q=constructionQuote('${k}',{site:'sect',source:'personal'});`);assert(e.run('q.ok'));e.run(`constructionStart('${k}',{site:'sect',source:'personal'},q);S.elapsedDays+=q.days;S.months=Math.floor(S.elapsedDays/30);constructionComplete(S.elapsedDays);`);}assert.equal(e.run('JSON.stringify(S.player.items)'),items);e.run(`S.scene.location=constructionRealm(curPlane()).home.location;`);assert.equal(e.run('constructionFrame(curPlane()).player'),0);results.push({actualSave:true,plane:'下界',derivedMembershipForCoverage:true,noImmortalBonus:true});
 });
 assert.equal(hash(fs.readFileSync(process.env.REAL_SAVE)),beforeHash);
}
console.log(passed+' construction regressions passed');
if(process.env.CONSTRUCTION_RESULT)fs.writeFileSync(process.env.CONSTRUCTION_RESULT,JSON.stringify({passed,results},null,2));
