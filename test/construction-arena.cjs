// 演武场解锁、地点别名、设施行动与重试回归。REAL_SAVE 只读取本地文件。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {env,BASE,UP}=require('./xjv2-env.cjs');
const file=process.argv[2]||path.join(__dirname,'../index.html'),html=fs.readFileSync(file,'utf8');
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('✓ '+name);};
function setup(plane){
 const e=env(file,31);e.run(BASE);if(plane==='仙界')e.run(UP);
 e.run(`S.player.realm=parseRealm('${plane==='仙界'?'大罗金仙中期':'化神初期'}');S.player.faction=S.world.factions[${plane==='仙界'?1:0}].name;S.sect={name:S.player.faction,contrib:30};S.player.money=1e7;S.player.arts=[normArt({name:'旧剑诀',style:'攻伐',level:41})];S.player.age=100;S.player.lifeBonus=1e6;constructionStart('array',{source:'personal'});var rec=constructionSectRecord(constructionSect());rec.project=null;rec.levels={array:0,library:5,arena:5};S.estates.rev++;S.scene.location=rec.location+'·演武场';`);
 return e;
}
function ui(e){
 e.run(html.slice(html.indexOf('function openConstruction(mode)'),html.indexOf('function openConstructionConfirm(')));
 e.run(html.slice(html.indexOf('function makeJudge(opt,action)'),html.indexOf('/* ================= 自由输入：先定方案')));
 e.run(`var uiElements={},uiBody='',uiAction=null,uiToasts=[];document.getElementById=id=>uiElements[id]||(uiElements[id]={value:'0',classList:{remove(){}}});xModal=(title,sub,body)=>{uiBody=body;};toast=x=>uiToasts.push(x);act=(action,opt)=>{uiAction={action,opt};};busy=false;`);
}
for(const plane of ['下界','仙界']){
 test(plane+'：驻地全名、去山门别名、地名前缀和设施内子地点均能演练并领取原加成',()=>{
  const e=setup(plane);
  for(const loc of ['rec.location+"·演武场"','rec.location.replace(/山门$/,"")+"·演武场"','"本界仙域·"+rec.location.replace(/山门$/,"")+"·演武场·东台"','rec.location+"／演武场"','rec.location+" · 演武场"']){
   e.run('S.scene.location='+loc);assert.equal(e.run('constructionTrainingReason()'),'');assert.equal(e.run('constructionFrame(curPlane()).train'),.25);
  }
 });
 test(plane+'：场外、路上、别宗、只有宗门和秘境不放行，不偷领加成',()=>{
  const e=setup(plane);
  for(const loc of ['rec.location','rec.location+"·演武场外"','rec.location+"·演武场途中"','"别宗山门·演武场"','"演武场"','"别宗·演武场·"+rec.location','rec.location+"外·演武场"']){
   e.run('S.scene.location='+loc);assert(e.run('constructionTrainingReason()'));assert.equal(e.run('constructionFrame(curPlane()).train'),0);
  }
  e.run('S.scene.location=rec.location+"·演武场";S.inRealm={name:"秘境"};');assert(e.run('constructionTrainingReason()'));assert.equal(e.run('constructionFrame(curPlane()).train'),0);
 });
 test(plane+'：演武场零级仍可普通演练；面板说明随地点、等级变化',()=>{
  const e=setup(plane);ui(e);e.run(`rec.levels.arena=0;openConstruction('sect');`);assert(!e.run('uiBody').match(/id="buildTrain" disabled/));assert(e.run('uiBody').includes('可正常演练'));
  e.run(`rec.levels.arena=5;S.scene.location='本界·'+rec.location.replace(/山门$/,'')+'·演武场·东台';openConstruction('sect');`);assert(!e.run('uiBody').match(/id="buildTrain" disabled/));assert(e.run('uiBody').includes('额外 +25%'));
  e.run(`S.scene.location=rec.location;openConstruction('sect');`);assert(e.run('uiBody').match(/id="buildTrain" disabled/));assert(e.run('uiBody').includes('需先到本门演武场'));
 });
 test(plane+'：藏经阁共享明确地点路径判定，方谱和阁外仍不减难度',()=>{
  const e=setup(plane);e.run(`S.scene.location='本界·'+rec.location.replace(/山门$/,'')+'·藏经阁·静室';`);assert.equal(e.run('constructionStudyBonus({})'),5);assert.equal(e.run('constructionStudyBonus({recipe:"炼丹"})'),0);e.run(`S.scene.location=rec.location+'·藏经阁外';`);assert.equal(e.run('constructionStudyBonus({})'),0);
 });
 test(plane+'：前往设施只指定已登记终点，正常行动与原耗时保留',()=>{
  const e=setup(plane);ui(e);e.run(`openConstruction('sect');uiElements.buildGoArena.onclick();var j=makeJudge(uiAction.opt,uiAction.action);`);assert.equal(e.run('j.destination'),e.run(`rec.location+'·演武场'`));assert.equal(e.run('j.months'),1/30);
  e.run(`var d=validateTurn({narrative:'他走进演武场，在场边安顿下来。',summary:'前往设施',scene:{location:'模型另写的空地',present:[],unresolved:[]},playerChanges:{},options:[]},uiAction.action,j,S);`);assert.equal(e.run('d.scene.location'),e.run('j.destination'));
  assert.equal(e.run(`constructionTravelDestination('别宗山门·演武场')`),'');
  e.run(`uiElements.buildGoLibrary.onclick();j=makeJudge(uiAction.opt,uiAction.action);`);assert.equal(e.run('j.destination'),e.run(`rec.location+'·藏经阁'`));
 });
 test(plane+'：一个月只按实际在场天数计25%熟练加成，结算与重放不重复',()=>{
  const e=setup(plane);e.run(`S.scene.location='本界·'+rec.location.replace(/山门$/,'')+'·演武场·东台';var days=S.elapsedDays,action='在演武场修炼《旧剑诀》一个月，演练已学功法',j={months:1,cult:'闭关',fate:10},f=forecastTurn(S,j,action);`);assert.equal(e.run('f.time.days'),30);assert.equal(e.run('f.time.constructionTraining'),.25);
  e.run(`var d=validateTurn({narrative:'他在演武场反复练习旧剑诀，逐式校正运转中的滞涩。',summary:'演练旧剑诀',scene:{location:S.scene.location,present:[],unresolved:[]},playerChanges:{artsTrain:[{name:'旧剑诀',level:4}]},options:[]},action,j,f.state);S=settleTurnOnce(S,d,action,j,'arena-once',f);var once=JSON.stringify(S);S=settleTurnOnce(S,d,action,j,'arena-once',f);`);
  assert.equal(e.run('S.elapsedDays-days'),30);assert.equal(e.run('S.player.arts[0].level'),46);assert.equal(e.run('JSON.stringify(S)'),e.run('once'));
 });
 test(plane+'：已打开面板在忙碌、待重试或离场后不能绕过检查',()=>{
  const e=setup(plane);ui(e);e.run(`openConstruction('sect');busy=true;uiElements.buildTrain.onclick();`);assert.equal(e.run('uiAction'),null);
  e.run(`busy=false;S.pending={id:'pending'};uiElements.buildTrain.onclick();`);assert.equal(e.run('uiAction'),null);
  e.run(`S.pending=null;S.scene.location=rec.location;uiElements.buildTrain.onclick();`);assert.equal(e.run('uiAction'),null);
  e.run(`S.scene.location=rec.location+'·演武场';uiElements.buildTrain.onclick();`);assert.equal(e.run('uiAction.opt.months'),1);assert(e.run('uiAction.action').includes('旧剑诀'));
 });
}
test('仙人不能使用人界演武加成，退宗后不能继续使用旧入口',()=>{
 const e=setup('下界');e.run(`S.player.realm=parseRealm('地仙初期');`);assert(e.run('constructionTrainingReason()'));assert.equal(e.run('constructionFrame(curPlane()).train'),0);e.run(`S.player.realm=parseRealm('化神初期');S.player.faction='散修';`);assert(e.run('constructionTrainingReason()'));assert.equal(e.run('constructionFrame(curPlane()).train'),0);
});
if(process.env.REAL_SAVE)test('用户存档副本：人仙两界读取设施与面板均不改物品、人物、记忆、历史或随机数',()=>{
 const bytes=fs.readFileSync(process.env.REAL_SAVE),save=JSON.parse(bytes);
 for(const plane of ['仙界','下界']){
  const e=env(file,31);e.run('v=>{S=v;saveGame=()=>{};migrate(S)}')(JSON.parse(JSON.stringify(save)));
  if(plane==='下界')e.run(`switchPlane('下界');S.player.realm=parseRealm('化神初期');S.player.faction=S.world.factions[0].name;S.sect={name:S.player.faction,contrib:20};S.player.money=1e7;`);
  e.run(`S.pending=null;constructionStart('array',{source:'personal'});var rec=constructionSectRecord(constructionSect());rec.levels.arena=5;S.scene.location='本界·'+rec.location.replace(/山门$/,'')+'·演武场·东台';`);ui(e);
  const before=e.run('JSON.stringify(S)'),rng=e.math.random;e.math.random=()=>{throw Error('只读面板不应消耗随机数');};assert.equal(e.run('constructionTrainingReason()'),'');assert.equal(e.run('constructionFrame(curPlane()).train'),.25);e.run(`openConstruction('sect')`);assert.equal(e.run('JSON.stringify(S)'),before);e.math.random=rng;
 }
 assert.equal(fs.readFileSync(process.env.REAL_SAVE).compare(bytes),0);
});
console.log(passed+' arena regressions passed');
