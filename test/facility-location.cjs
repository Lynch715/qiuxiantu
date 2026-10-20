// 洞府/聚灵阵/藏经阁统一地点路径，以及按实际天数计长闭关收益。
const path=require('node:path'),assert=require('node:assert/strict');
const {env,BASE,UP}=require('./xjv2-env.cjs'),file=process.argv[2]||path.join(__dirname,'../index.html');let passed=0;
function test(name,fn){fn();passed++;console.log('✓ '+name);}
function setup(plane){const e=env(file,31);e.run(BASE);if(plane==='仙界')e.run(UP);e.run(`S.player.realm=parseRealm('${plane==='仙界'?'大罗金仙中期':'化神初期'}');S.player.age=100;S.player.lifeBonus=1e6;S.player.money=1e8;S.player.lingli=0;S.player.cultMode='闭关';S.player.faction=S.world.factions[${plane==='仙界'?1:0}].name;S.sect={name:S.player.faction,contrib:30};constructionStart('home',{site:'sect'});var h=constructionRealm(curPlane()).home,rec=constructionSectRecord(constructionSect());h.project=null;h.level=5;rec.levels={array:5,library:5,arena:5};S.estates.rev++;S.scene.location=h.location;`);e.run('migrate(S)');return e;}
for(const plane of ['下界','仙界']){
 test(plane+'：洞府加前缀、山门别名、分隔符和静室后，洞府/聚灵阵仍生效并封顶180%',()=>{
  const e=setup(plane);for(const expr of ['h.location','"本界·"+h.location+"·静室"','"本界／"+h.location.replace(/山门/g,"").replace(/·/g,"／")+"／静室"','"本界 > "+h.location.replace(/·/g," > ")+" > 静室"']){e.run('S.scene.location='+expr);assert(e.run('constructionHomeHere(h)'));const f=e.val('constructionFrame(curPlane())');assert.equal(f.home,.30);assert.equal(f.array,1.5);assert.equal(f.player,1.8);}
 });
 test(plane+'：洞府外、他人洞府、三字前缀同地、路上/秘境/退宗不能领取私人洞府收益',()=>{
  const e=setup(plane);for(const expr of ['h.location+"外"','rec.location+"·别人洞府"','"远方·石昊洞府"','h.location+"·途中"']){e.run('S.scene.location='+expr);assert(!e.run('constructionHomeHere(h)'));assert.equal(e.run('constructionFrame(curPlane()).home'),0);}
  e.run('S.scene.location=h.location;S.inRealm={name:"秘境"};');assert(!e.run('constructionHomeHere(h)'));e.run('S.inRealm=null;S.player.faction="散修";');assert(!e.run('constructionHomeHere(h)'));assert.equal(e.run('constructionFrame(curPlane()).player'),0);
  assert(!e.run(`constructionHere('紫霄仙域·石昊洞府','紫霄仙庭山门·石昊洞府')`));
 });
 test(plane+'：藏经阁只减功法玉简难度；普通闭关不额外给主角150%门人收益',()=>{
  const e=setup(plane);e.run(`S.scene.location='上级仙域／'+rec.location.replace(/山门$/,'')+'／藏经阁／静室';`);assert.equal(e.run('constructionStudyBonus({})'),25);assert.equal(e.run('constructionStudyBonus({recipe:"炼丹"})'),0);assert.equal(e.run('constructionFrame(curPlane()).player'),1.5);e.run(`S.scene.location=rec.location+'·藏经阁外';`);assert.equal(e.run('constructionStudyBonus({})'),0);
 });
 test(plane+'：月中离开洞府，再回藏经阁参悟，实际日数加权不重复叠加',()=>{
  const e=setup(plane);e.run(`advanceTime(.5);S.scene.location='本界／'+rec.location.replace(/山门$/,'')+'／藏经阁';var observed=-1;const original=cultivateMonth;cultivateMonth=()=>{observed=constructionMonthRate(S.player);return original();};advanceTime(.5);`);assert(Math.abs(e.run('observed')-1.65)<1e-9);
 });
 test(plane+'：3600个月闭关逐月核对180%设施上限与实际灵力，瓶颈不溢出且同种子一致',()=>{
  const a=setup(plane),b=setup(plane);
  for(const e of [a,b])e.run(`S.scene.location='本界／'+h.location.replace(/山门/g,'').replace(/·/g,'／')+'／静室';var checked=0;const original=cultivateMonth;cultivateMonth=function(){assertRate();const p=S.player,before=p.lingli,need=lingliNeed(p.realm),rate=constructionMonthRate(p),base=monthlyLingli(p,{mode:p.hp<30?'重伤':p.cultMode,gongfa:gongfaMult(p)*(num(p.cultMul)||1),aura:auraOf(),partner:partnerMul(p)}),got=original();if(Math.abs(got-Math.max(0,Math.min(need-before,base*(1+rate))))>1e-6)throw Error('逐月灵力有误');checked++;return got;};function assertRate(){if(Math.abs(constructionMonthRate(S.player)-1.8)>1e-9)throw Error('逐月设施未生效');}`);
  // 原有境界闭关上限照旧：按上限分段，合计验证三百年。
  for(const e of [a,b]){let left=3600;while(left){const n=Math.min(left,e.run('closeMaxMonths()'));e.run('advanceTime('+n+')');left-=n;}assert.equal(e.run('checked'),3600);assert(e.run('S.player.lingli<=lingliNeed(S.player.realm)'));}
  assert.equal(a.run('JSON.stringify(S)'),b.run('JSON.stringify(S)'));assert.equal(a.run('Math.random()'),b.run('Math.random()'));
 });
 test(plane+'：月中完工后才给收益，升级不倒补整月，存读档保留待结算分段',()=>{
  const a=setup(plane),b=setup(plane);for(const e of [a,b])e.run(`h.level=0;rec.levels.array=0;S.estates.rev++;S.elapsedDays=15;S.months=0;S.scene.location='上级·'+h.location+'·静室';constructionStart('home',{site:'sect'});h.project.end=30;advanceTime(1);`);
  b.run('S=JSON.parse(JSON.stringify(S));migrate(S);');for(const e of [a,b])e.run('advanceTime(.5)');assert.equal(a.run('JSON.stringify(S)'),b.run('JSON.stringify(S)'));assert.equal(a.run(`S.estates.history.filter(x=>x.event==='完工').length`),1);assert.equal(a.run('Math.random()'),b.run('Math.random()'));
 });
}
test('人界设施不能增加仙元；离界后的在山NPC仍按原培养规则享受阵/阁收益',()=>{
 const e=setup('下界');e.run(`S.player.realm=parseRealm('地仙初期');`);assert.equal(e.run('constructionFrame(curPlane()).player'),0);
 e.run(`S.npcs=[normNpc({name:'在山门人',age:30,realm:'筑基初期',faction:S.player.faction,location:'前缀／'+rec.location.replace(/山门$/,'')+'／静室'})];S.npcs[0].lingli=0;S.npcs[0].breakCD=0;S.npcs[0].tags=[];`);assert(Math.abs(e.run('constructionFrame(curPlane()).npc[S.npcs[0].entityId||S.npcs[0].name]')-3)<1e-9);
 e.run(UP);assert(Math.abs(e.run(`constructionFrame('下界').npc[planeNpcs('下界')[0].entityId||planeNpcs('下界')[0].name]`)-3)<1e-9);
});
console.log(passed+' facility location regressions passed');
