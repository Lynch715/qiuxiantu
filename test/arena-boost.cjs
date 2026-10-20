// 演武场主角收益分档增强；不读取用户存档、不调用外部模型。
const assert=require('node:assert/strict'),{env,BASE,UP}=require('./xjv2-env.cjs');
let passed=0;
function setup(plane='仙界'){
 const e=env();e.run(BASE);if(plane==='仙界')e.run(UP);
 e.run(`S.player.realm=parseRealm('${plane==='仙界'?'大罗金仙中期':'化神初期'}');S.player.age=100;S.player.lifeBonus=1e6;S.player.money=1e8;S.player.tags=[];S.player.faction=S.world.factions[${plane==='仙界'?1:0}].name;S.sect={name:S.player.faction,contrib:30};S.player.arts=[normArt({name:'演练剑诀',style:'攻伐',level:40})];constructionStart('arena',{source:'personal'});var rec=constructionSectRecord(constructionSect());rec.project=null;rec.levels.arena=5;S.estates.rev++;S.scene.location=rec.location+'·演武场';`);return e;
}
function test(name,fn){fn();passed++;console.log('✓ '+name);}
for(const plane of ['下界','仙界']){
 test(plane+'：零至五级加成0/50/100/150/200/300%，四点基础演练变4/6/8/10/12/16',()=>{
  const {run,val}=setup(plane);const rates=[],gains=[];
  for(let level=0;level<=5;level++){run(`rec.levels.arena=${level};`);rates.push(run('constructionFrame(curPlane()).train'));gains.push(run('constructionTrainDelta(S.player.arts[0],4,constructionFrame(curPlane()).train)'));}
  assert.deepEqual(rates,[0,.5,1,1.5,2,3]);assert.deepEqual(gains,[4,6,8,10,12,16]);
 });
 test(plane+'：训练岗位门人仍为原25%培养加成，其他设施与费用工期不变',()=>{
  const {run}=setup(plane);run(`S.npcs=[normNpc({name:'训练门人',realm:'${plane==='仙界'?'地仙初期':'筑基初期'}',faction:S.player.faction,location:rec.location,activity:'修炼'})];S.npcs[0].activity='修炼';`);
  assert.equal(run('constructionFrame(curPlane()).npc[S.npcs[0].entityId||S.npcs[0].name]'),.25);
  assert.equal(run('constructionFrame(curPlane()).player'),0);
  assert.match(run(`constructionEffectText('arena',5)`),/主角演武熟练增长 \+300%.*门人培养 \+25%/);
 });
}
test('旧档0.75小数不丢失，一级两次一点训练按1/2累计',()=>{
 const {run}=setup();run(`S.estates.artRemainders={'仙界|演练剑诀|攻伐':.75};S=JSON.parse(JSON.stringify(S));migrate(S);var a=S.player.arts[0];`);
 assert.equal(run(`S.estates.artRemainders['仙界|演练剑诀|攻伐']`),.75);
 assert.equal(run('constructionTrainDelta(a,1,.5)'),2);assert.equal(run(`S.estates.artRemainders['仙界|演练剑诀|攻伐']`),.25);
 assert.equal(run('constructionTrainDelta(a,1,.5)'),1);assert.equal(run(`S.estates.artRemainders['仙界|演练剑诀|攻伐']`),.75);
});
test('月中完工仅完工后半月获增强加成，不倒补前半月',()=>{
 const {run}=setup();run(`rec.levels.arena=0;rec.project={id:'arena-mid',kind:'arena',to:5,end:S.elapsedDays+15};S.estates.rev++;var result=advanceTime(1);`);
 assert.equal(run('result.constructionTraining'),1.5);
});
test('熟练封顶100，起居注只记实际增长且不训练其他功法',()=>{
 const {run}=setup();run(`S.player.arts[0].level=95;S.player.arts.push(normArt({name:'未练功法',style:'护体',level:40}));var action='在演武场修炼《演练剑诀》一个月，演练已学功法',j={months:1,cult:'日常',fate:10,check:null},f=forecastTurn(S,j,action);var d=validateTurn({narrative:'他在演武场练习演练剑诀，逐式修正运转。',summary:'演练功法',playerChanges:{artsTrain:[{name:'演练剑诀',level:4}]},options:[]},action,j,f.state);S=settleTurnOnce(S,d,action,j,'arena-cap',f);`);
 assert.equal(run('S.player.arts[0].level'),100);assert.equal(run(`lastDeltas['功法·演练剑诀']`),5);assert.equal(run('S.player.arts[1].level'),40);
});
test('场外演练不领加成，已有满级功法不消耗小数余量',()=>{
 const {run}=setup();run(`S.scene.location=rec.location+'·演武场外';var a=S.player.arts[0];`);assert.equal(run('constructionFrame(curPlane()).train'),0);
 run(`a.level=100;var before=JSON.stringify(S.estates);`);assert.equal(run('constructionTrainDelta(a,4,3)'),4);assert.equal(run('JSON.stringify(S.estates)'),run('before'));
});
console.log(`${passed} arena boost regressions passed`);
