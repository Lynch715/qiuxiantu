// 宗主、榜单和人脉同人同境界；仅虚构夹具，不读用户存档、不调用模型。
const assert=require('node:assert/strict');
const env=require('./power-scale-env.cjs');
let passed=0;
function setup(plane='仙界'){
  const e=env();e.seed(91);
  e.run(`S.plane=${JSON.stringify(plane)};S.npcs=[];S.world={factions:[{name:'测试剑宗',leader:'岑照川',power:80,lRealm:parseRealm('化神中期'),lAge:200,lGender:'女'}],ranking:[{name:'岑照川',gender:'男',age:8000,realm:parseRealm('${plane==='仙界'?'金仙中期':'合体中期'}'),alive:true,faction:'测试剑宗'}],tianjiao:[],hidden:[],events:[]};syncPower(S.world.ranking[0]);S.continuity=null;`);
  return e;
}
function test(name,fn){fn();passed++;console.log('✓ '+name);}
test('旧档未结识宗主立即按仙榜修复，保留玩家进度与宗门势力',()=>{
  const {run,val}=setup();const before=val('[S.player,S.world.factions[0].power]');
  run('S=JSON.parse(JSON.stringify(S));worldState();');
  assert.equal(run('realmText(S.world.factions[0].lRealm)'),'金仙中期');
  assert.equal(run('S.world.factions[0].lAge'),8000);assert.equal(run('S.world.factions[0].lGender'),'男');
  assert.deepEqual(val('[S.player,S.world.factions[0].power]'),before);
  const once=val('S');run('worldState()');assert.deepEqual(val('S'),once);
});
test('ensureFactionMeta 可直接修复已有旧境界，下界也保持一致',()=>{
  for(const plane of ['仙界','下界']){const {run}=setup(plane);run('ensureFactionMeta(S.world.factions[0])');assert.equal(run('realmText(S.world.factions[0].lRealm)'),plane==='仙界'?'金仙中期':'合体中期');}
});
test('新结识榜上宗主不会被旧势力副本压低境界',()=>{
  const {run}=setup();run(`var newcomer=normNpc({name:'岑照川',realm:'炼气一阶',gender:'女',age:20});worldSeed(S,newcomer);S.npcs.push(newcomer);worldBackSync(S);worldState();`);
  assert.equal(run('realmText(newcomer.realm)'),'金仙中期');assert.equal(run('realmText(S.world.ranking[0].realm)'),'金仙中期');
});
test('已结识宗主以人脉实时修为为准，不被榜单覆盖',()=>{
  const {run}=setup();run(`S.npcs.push(normNpc({name:'岑照川',realm:'太乙金仙初期',age:9000,gender:'男'}));worldState();`);
  assert.equal(run('realmText(S.world.factions[0].lRealm)'),'太乙金仙初期');assert.equal(run('realmText(S.world.ranking[0].realm)'),'太乙金仙初期');
  run('S.world.factions[0].lRealm.minor=3');assert.equal(run('S.npcs[0].realm.minor'),1);
});
test('年度榜上宗主不重复衰老、不另掷坐化与突破',()=>{
  const {run}=setup();run(`worldState();S.world.factions[0].lAge=999999;Math.random=()=>0.005;npcYearTick();factionYear();`);
  assert.equal(run('S.world.factions[0].leader'),'岑照川');assert.equal(run('S.world.factions[0].lAge'),8001);
  assert.equal(run('realmText(S.world.factions[0].lRealm)'),'金仙中期');
});
test('榜单离榜后仍有隐修记录的宗主继续同步',()=>{
  const {run}=setup();run(`S.world.hidden=S.world.ranking;S.world.ranking=[];worldState();`);
  assert.equal(run('realmText(S.world.factions[0].lRealm)'),'金仙中期');
});
test('任命榜上高手当宗主直接采用榜上资料',()=>{
  const {run}=setup();run(`S.world.factions[0].leader='前任';facSetLeader(S.world.factions[0],'岑照川',parseRealm('金丹初期'),'女');`);
  assert.equal(run('realmText(S.world.factions[0].lRealm)'),'金仙中期');assert.equal(run('S.world.factions[0].lAge'),8000);
});
test('相似姓名不会把另一位人脉人物认作宗主',()=>{
  const {run}=setup();run(`S.npcs.push(normNpc({name:'岑照',realm:'筑基初期',age:40}));ensureFactionMeta(S.world.factions[0]);factionYear();`);
  assert.equal(run('realmText(S.world.factions[0].lRealm)'),'金仙中期');
});
test('仙界榜外宗主和继任者使用仙界境界，下界保留原规则',()=>{
  for(const plane of ['仙界','下界']){const {run}=setup(plane);run(`S.world.ranking=[];delete S.world.factions[0].lRealm;ensureFactionMeta(S.world.factions[0]);`);assert.equal(run('isXianRealm(S.world.factions[0].lRealm)'),plane==='仙界');run(`facSucceed(S.world.factions[0],'宗主退位');`);assert.equal(run('isXianRealm(S.world.factions[0].lRealm)'),plane==='仙界');}
});
test('闭关成功写回真实宗主与榜单，再同步不会回退',()=>{
  for(const known of [false,true]){const {run}=setup();if(known)run(`S.npcs.push(normNpc({name:'岑照川',realm:'金仙中期',age:8000}));`);
    run(`facResolve({fx:{kind:'seclude',A:'测试剑宗',L:'岑照川'}},'宗主突破出关');worldState();`);
    assert.equal(run('realmText(S.world.factions[0].lRealm)'),'太乙金仙初期');assert.equal(run('realmText(S.world.ranking[0].realm)'),'太乙金仙初期');assert.equal(run('S.world.ranking[0].武功'),run('powerFromRealm(S.world.ranking[0].realm)'));
    if(known)assert.equal(run('realmText(S.npcs[0].realm)'),'太乙金仙初期');
  }
});
test('榜上宗主死亡仍正常继任，死者不会复活',()=>{
  const {run}=setup();run('S.world.ranking[0].alive=false;worldState();');assert.notEqual(run('S.world.factions[0].leader'),'岑照川');assert.equal(run('S.world.ranking[0].alive'),false);
});
test('显式旧档与两界同名人物各取本界，不误改当前局',()=>{
  const {run,val}=setup();const before=val('S');run(`var other=JSON.parse(JSON.stringify(S));other.plane='下界';other.world.ranking[0].realm=parseRealm('合体后期');worldState(other);`);
  assert.equal(run('realmText(other.world.factions[0].lRealm)'),'合体后期');assert.deepEqual(val('S'),before);
  run(`S.planes={下界:planeFresh()};S.planes.下界.world=other.world;withPlane('下界',()=>worldState());worldState();`);
  assert.equal(run('realmText(S.world.factions[0].lRealm)'),'金仙中期');assert.equal(run('realmText(S.planes.下界.world.factions[0].lRealm)'),'合体后期');
});
test('天下实际渲染先同步，两处文字和提示词保持同境界',()=>{
  const {run,elements}=setup();run(`renderWorld();`);
  assert.match(elements.get('wFactions').innerHTML,/金仙中期/);assert.doesNotMatch(elements.get('wFactions').innerHTML,/化神中期/);assert.match(elements.get('wRanking').innerHTML,/金仙中期/);
  assert.match(run(`stateBlocks('巡视宗门')`),/首领岑照川\[男,8000岁,金仙中期\]/);
});
console.log(`${passed} faction realm regressions passed`);
