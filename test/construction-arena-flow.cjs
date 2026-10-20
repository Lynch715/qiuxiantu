// 演武补读/接口失败恢复经过真实 runTurn，只提交一次时间和熟练收益。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {env,BASE,UP}=require('./xjv2-env.cjs'),file=process.argv[2]||path.join(__dirname,'../index.html'),html=fs.readFileSync(file,'utf8');
function setup(){
 const e=env(file,31);e.run(BASE);e.run(UP);
 e.run(`S.player.realm=parseRealm('大罗金仙中期');S.player.money=1e6;S.player.faction=S.world.factions[1].name;S.sect={name:S.player.faction,contrib:30};S.player.arts=[normArt({name:'旧剑诀',style:'攻伐',level:41})];S.player.items.其他=Array.from({length:120},(_,i)=>({name:'旧物'+i,desc:'师门旧约与赠予原文，不得删除。'.repeat(30)}));constructionStart('array',{source:'personal'});var rec=constructionSectRecord(constructionSect());rec.project=null;rec.levels={array:0,library:0,arena:5};S.estates.rev++;S.scene.location='本界仙域·'+rec.location.replace(/山门$/,'')+'·演武场·东台';Date.now=()=>1000000;S.runId='arena-flow';`);
 e.run(html.slice(html.indexOf('async function runTurn('),html.indexOf('async function gameOverFlow(')));
 e.run(`globalThis.liveChapter=null;globalThis.lastEngineNews=null;setBusy=()=>{};beginChapter=()=>{};updateChapterNarrative=()=>{};finishChapter=()=>{};renderPanel=()=>{};renderOptions=()=>{};checkAchievements=()=>{};setDot=()=>{};foldHistory=()=>{};refreshManagementActions=()=>{};styleFix=()=>({redo:null});var calls=0,forecasts=0,settles=0;const originalForecast=forecastTurn,originalSettle=settleTurnOnce;forecastTurn=(...args)=>{forecasts++;return originalForecast(...args);};settleTurnOnce=(...args)=>{settles++;return originalSettle(...args);};var initialDays=S.elapsedDays,initialTurn=S.turn,itemsBefore=JSON.stringify(S.player.items);`);
 return e;
}
(async()=>{
 for(const mode of ['success','failure-then-retry']){
  const e=setup();e.run(`callLLMOnce=async()=>{calls++;lastFinish='stop';if(calls===1)return '{"needsItemDetails":["*"]}';if(${JSON.stringify(mode)}==='failure-then-retry'&&calls===2)throw Error('接口调用失败（HTTP 401：测试失败）');return JSON.stringify({narrative:'他在演武场练习旧剑诀，一个月里逐式校正运转，最后将旧物原件收好。',summary:'演练旧剑诀',scene:{location:S.scene.location,present:[],unresolved:[]},playerChanges:{artsTrain:[{name:'旧剑诀',level:4}]},options:[]});};`);
  await e.run(`runTurn('在演武场修炼《旧剑诀》一个月，演练已学功法',{months:1,cult:'闭关',fate:10,check:null})`);
  if(mode==='failure-then-retry'){
   assert.equal(e.run('S.elapsedDays'),e.run('initialDays'));assert.equal(e.run('S.player.arts[0].level'),41);assert.equal(e.run('settles'),0);assert.equal(e.run('S.pending.forecast.time.constructionTraining'),3);
   await e.run(`runTurn('在演武场修炼《旧剑诀》一个月，演练已学功法',{months:1,cult:'闭关',fate:10,check:null})`);
  }
  assert.equal(e.run('forecasts'),1);assert.equal(e.run('settles'),1);assert.equal(e.run('S.elapsedDays-initialDays'),30);assert.equal(e.run('S.turn-initialTurn'),1);assert.equal(e.run('S.player.arts[0].level'),57);assert.equal(e.run('JSON.stringify(S.player.items)'),e.run('itemsBefore'));assert(!e.run('!!S.pending'));
  console.log('✓ '+mode+'：补读/重试只结算30天及一次300%演武收益，旧物原文不变');
 }
 console.log('2 arena flow regressions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
