// 聚灵阵/藏经阁增强，覆盖实际月结、参悟判定与行囊成算显示；无用户档/外部模型。
const assert=require('node:assert/strict'),{env,BASE,UP}=require('./xjv2-env.cjs');
let passed=0;
function near(a,b){assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);}
function setup(plane){const e=env();e.run(BASE);if(plane==='仙界')e.run(UP);e.run(`S.player.realm=parseRealm('${plane==='仙界'?'大罗金仙中期':'化神初期'}');syncPower(S.player);S.player.money=1e8;S.player.lingli=0;S.player.age=100;S.player.lifeBonus=1e6;S.player.cultMode='闭关';S.player.faction=S.world.factions[${plane==='仙界'?1:0}].name;S.sect={name:S.player.faction,contrib:30};constructionStart('home',{site:'sect'});var h=constructionRealm(curPlane()).home,rec=constructionSectRecord(constructionSect());h.project=null;h.level=0;rec.levels={array:0,library:0,arena:0};S.estates.rev++;S.scene.location=rec.location;S.npcs=[normNpc({name:'测试门人',realm:'${plane==='仙界'?'地仙初期':'筑基初期'}',age:30,faction:S.player.faction,location:rec.location,alive:true})];var n=S.npcs[0];n.lingli=0;n.wx={悟性:50,心性:50};n.tags=[];n.breakCD=0;n.activity='修炼';`);return e;}
function test(name,fn){fn();passed++;console.log('✓ '+name);}
for(const plane of ['下界','仙界']){
 test(plane+'：聚灵阵逐级给主角与门人25/50/75/100/150%收益',()=>{
  const {run}=setup(plane),p=[],n=[];for(let lv=0;lv<=5;lv++){run(`rec.levels.array=${lv};`);p.push(run('constructionFrame(curPlane()).player'));n.push(run('constructionFrame(curPlane()).npc[S.npcs[0].name]'));}
  assert.deepEqual(p,[0,.25,.5,.75,1,1.5]);assert.deepEqual(n,p);
 });
 test(plane+'：藏经阁培养逐级增强，主角不叠加门人倍率，只领取功法减难',()=>{
  const {run}=setup(plane),bonus=[],npc=[];run(`S.scene.location=rec.location+'·藏经阁';`);
  for(let lv=0;lv<=5;lv++){run(`rec.levels.library=${lv}`);bonus.push(run('constructionStudyBonus({})'));npc.push(run('constructionFrame(curPlane()).npc[n.name]'));assert.equal(run('constructionFrame(curPlane()).player'),0);}
  assert.deepEqual(bonus,[0,5,10,15,20,25]);assert.deepEqual(npc,[0,.25,.5,.75,1,1.5]);
 });
 test(plane+'：实际一个月满级洞府加阵为2.8倍，门人三项全满为7倍',()=>{
  const {run}=setup(plane);run(`h.level=5;rec.levels={array:5,library:5,arena:5};S.estates.rev++;S.scene.location=h.location;var pBase=monthlyLingli(S.player,{mode:'闭关',gongfa:gongfaMult(S.player)*(num(S.player.cultMul)||1),aura:auraOf(),partner:partnerMul(S.player)});var nBase=monthlyLingli(n,{mode:'闭关'})*.7;advanceTime(1);`);
  near(run('S.player.lingli'),run('pBase')*2.8);near(run('n.lingli'),run('nBase')*7);
 });
 test(plane+'：藏经阁真实判定与行囊难度共用结果，方谱不减难度',()=>{
  const e=setup(plane),{run}=e;run(`rec.levels.library=5;S.scene.location=rec.location+'·藏经阁';var manual={name:'验收功法玉简',meta:{art:'验收诀',style:'攻伐',need:85,months:1,grade:'黄阶下品',recipe:'',element:''}};var m=manual.meta;`);
  const inside=e.force(.5,()=>e.val('studyRoll(m)'));assert.match(run('manualHtml([manual])'),new RegExp('难度 '+inside.dc+'（藏经阁 −25）'));
  run(`S.scene.location=rec.location+'·藏经阁外';`);const outside=e.force(.5,()=>e.val('studyRoll(m)'));assert.equal(outside.dc-inside.dc,25);assert.equal(outside.roll,inside.roll);assert.doesNotMatch(run('manualHtml([manual])'),/藏经阁 −25/);
  run(`S.scene.location=rec.location+'·藏经阁';m.recipe='炼丹';`);assert.equal(e.force(.5,()=>e.run('studyRoll(m).dc')),outside.dc);
 });
 test(plane+'：藏经阁仍要求到场、有效宗门与相应界别，不保证参透',()=>{
  const e=setup(plane),{run}=e;run(`rec.levels.library=5;S.scene.location=rec.location+'·藏经阁';`);
  assert.equal(e.force(0,()=>e.run('studyRoll({need:20}).success')),false);assert.equal(e.force(.5,()=>e.run('studyRoll({need:20}).dc')),20);
  run(`S.inRealm={name:'秘境'};`);assert.equal(run('constructionStudyBonus({})'),0);run(`S.inRealm=null;S.player.faction='散修';`);assert.equal(run('constructionStudyBonus({})'),0);
 });
}
test('旧档等级原样保留；月中升级不补发前半月聚灵阵收益',()=>{
 const {run}=setup('下界');run(`advanceTime(.5);S=JSON.parse(JSON.stringify(S));migrate(S);rec=constructionSectRecord(constructionSect());rec.levels.array=5;S.estates.rev++;var observed=-1,original=cultivateMonth;cultivateMonth=()=>{observed=constructionMonthRate(S.player);return original();};advanceTime(.5);`);near(run('observed'),.75);assert.equal(run('rec.levels.array'),5);
});
test('面板写明新效果及上限，读取完整状态和随机数均不变',()=>{
 const e=setup('仙界'),{run}=e;run(`rec.levels={array:5,library:5,arena:5};var before=JSON.stringify(S);`);
 const rng=e.math.random;e.math.random=()=>{throw Error('读取效果不应消耗随机数');};
 assert.match(run(`constructionEffectText('array',5)`),/\+150%/);assert.match(run(`constructionEffectText('library',5)`),/门人培养 \+150%.*难度 −25/);
 assert.equal(run('BUILD_NPC_CAP'),6);assert.equal(run('BUILD_PLAYER_CAP'),1.8);assert.equal(run('JSON.stringify(S)'),run('before'));e.math.random=rng;
});
console.log(`${passed} array/library regressions passed`);
