// 演武场门人培养：真实NPC、抽象弟子、分工、两界、月中收益和旧档。
const assert=require('node:assert/strict'),{env,BASE,UP}=require('./xjv2-env.cjs');
let passed=0;
function setup(plane='下界'){
 const e=env();e.run(BASE);if(plane==='仙界')e.run(UP);
 e.run(`S.player.realm=parseRealm('${plane==='仙界'?'大罗金仙中期':'化神初期'}');syncPower(S.player);S.player.age=100;S.player.lifeBonus=1e6;S.player.money=1e8;S.player.faction=S.world.factions[${plane==='仙界'?1:0}].name;S.sect={name:S.player.faction,contrib:30};constructionStart('arena',{source:'personal'});var rec=constructionSectRecord(constructionSect());rec.project=null;rec.levels={array:0,library:0,arena:5};S.estates.rev++;S.npcs=[normNpc({name:'训练门人',realm:'${plane==='仙界'?'地仙初期':'筑基初期'}',age:30,faction:S.player.faction,location:rec.location,alive:true})];var n=S.npcs[0];n.activity='修炼';n.lingli=0;n.tags=[];n.wx={悟性:50,心性:50};n.breakCD=0;S.scene.location=rec.location;`);return e;
}
function test(name,fn){fn();passed++;console.log('✓ '+name);}
function near(a,b){assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);}
for(const plane of ['下界','仙界']){
 test(plane+'：NPC培养逐级50/100/150/200/300%，叠加阵阁最高600%',()=>{
  const {run}=setup(plane);const rates=[];for(let lv=0;lv<=5;lv++){run(`rec.levels.arena=${lv}`);rates.push(run('constructionFrame(curPlane()).npc[n.entityId||n.name]'));}
  assert.deepEqual(rates,[0,.5,1,1.5,2,3]);run('rec.levels.array=5;rec.levels.library=5;');near(run('constructionFrame(curPlane()).npc[n.entityId||n.name]'),6);
 });
 test(plane+'：真实月度修炼收益由1.25倍变4倍，满阵阁为7倍，不只改显示',()=>{
  const {run}=setup(plane);const base=run(`monthlyLingli(n,{mode:'闭关'})*.7`);run('npcCultivateMonth(n,[])');near(run('n.lingli'),base*4);
  run('n.lingli=0;rec.levels.array=5;rec.levels.library=5;npcCultivateMonth(n,[])');near(run('n.lingli'),base*7);
 });
 test(plane+'：修炼分工含演武收益，授艺/护山/经商仅阵阁300%，云游不领取',()=>{
  const {run}=setup(plane);run(`rec.levels.array=5;rec.levels.library=5;S.clan={name:S.player.faction,disciples:[{id:'linked',name:n.name,npcName:n.name,alive:true,job:'修炼',talent:1,武功:20}],treasury:10000};var d=S.clan.disciples[0];`);
  near(run('constructionFrame(curPlane()).npc[n.entityId||n.name]'),6);assert.equal(run('constructionFrame(curPlane()).disc.linked||0'),0);
  for(const job of ['授艺','护山','经商']){run(`d.job='${job}'`);near(run('constructionFrame(curPlane()).npc[n.entityId||n.name]'),3);}
  run(`d.job='云游'`);assert.equal(run('constructionFrame(curPlane()).npc[n.entityId||n.name]||0'),0);
 });
 test(plane+'：抽象弟子逐级加成与真实月结同步，资质上限仍有效',()=>{
  const {run}=setup(plane);run(`S.npcs=[];S.clan={name:S.player.faction,alignment:'正派',power:50,fame:50,disciples:[{id:'plain',name:'抽象门人',alive:true,job:'修炼',talent:1,武功:20,prog:0,loyalty:80,hurt:0}],treasury:100000};var d=S.clan.disciples[0];rec.levels.arena=0;var baseCap=discCap(d);clanMonth();var baseProg=d.prog;d.prog=0;rec.levels.arena=5;clanMonth();`);
  near(run('d.prog+d.武功-20'),run('baseProg')*4);assert.equal(run('discCap(d)'),run('baseCap'));assert(run('d.武功<discCap(d)'));
  run('rec.levels.array=5;rec.levels.library=5');near(run('constructionFrame(curPlane()).disc.plain'),6);
 });
 test(plane+'：离山、异宗、死亡、界别不符及无训练活动均不会偷领演武加成',()=>{
  const {run}=setup(plane);
  for(const code of [`n.location='远方山谷'`,`n.faction='别宗'`,`n.alive=false`,`n.realm=parseRealm('${plane==='仙界'?'筑基初期':'地仙初期'}')`]){
   run(`var old={location:n.location,faction:n.faction,alive:n.alive,realm:n.realm};${code}`);assert.equal(run('constructionFrame(curPlane()).npc[n.entityId||n.name]||0'),0);run('Object.assign(n,old)');
  }
  run(`n.activity='经商';n.mood='平静'`);assert.equal(run('constructionFrame(curPlane()).npc[n.entityId||n.name]'),0);
 });
}
test('月中升级不倒补；存读档后前半月300%与后半月600%合为450%',()=>{
 const {run}=setup();run(`rec.levels={array:5,library:5,arena:0};advanceTime(.5);S=JSON.parse(JSON.stringify(S));migrate(S);rec=constructionSectRecord(constructionSect());rec.levels.arena=5;S.estates.rev++;var observed=-1,original=npcCultivateMonth;npcCultivateMonth=function(n,q){if(n.name==='训练门人')observed=constructionMonthRate(n);return original(n,q);};advanceTime(.5);`);
 near(run('observed'),4.5);
});
test('后台另一界的在山门人也按600%培养，不改主角修炼收益与上次300%演练',()=>{
 const {run}=setup();run(`rec.levels.array=5;rec.levels.library=5;var before=JSON.stringify(S.player);var oldName=n.name;switchPlane('仙界');var frame=constructionFrame('下界');`);
 near(run('frame.npc[oldName]'),6);run(`switchPlane('下界');S.scene.location=rec.location+'·演武场';`);assert.equal(run('constructionFrame(curPlane()).train'),3);assert.equal(run('constructionFrame(curPlane()).player'),1.5);
});
test('旧档设施等级、物品、历史与人物属性在读取新效果时原样保留',()=>{
 const {run}=setup();run(`var before=JSON.stringify(S);constructionFrame(curPlane());constructionEffectText('arena',5);`);assert.equal(run('JSON.stringify(S)'),run('before'));
 assert.match(run(`constructionEffectText('arena',5)`),/门人培养 \+300%/);
});
console.log(`${passed} arena NPC regressions passed`);
