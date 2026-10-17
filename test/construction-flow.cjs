// 在建工程经过真实 runTurn/补读/失败重试，验证时间和完工只提交一次。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {env,BASE,UP}=require('./xjv2-env.cjs'),file=process.argv[2]||path.join(__dirname,'../index.html'),html=fs.readFileSync(file,'utf8');
function setup(){
 const e=env(file,31);e.run(BASE);e.run(UP);
 e.run(`S.player.realm=parseRealm('大罗金仙中期');S.player.money=1e6;S.player.faction=S.world.factions[1].name;S.sect={name:S.player.faction,contrib:30};S.player.items.其他=Array.from({length:120},(_,i)=>({name:'旧物'+i,desc:'原物原文，师门旧约与赠予经历，不得删除。'.repeat(30)}));constructionStart('home',{site:'sect'});S.scene.location=constructionRealm(curPlane()).home.location;Date.now=()=>1000000;S.runId='build-flow';`);
 e.run(html.slice(html.indexOf('async function runTurn('),html.indexOf('async function gameOverFlow(')));
 e.run(`globalThis.liveChapter=null;globalThis.lastEngineNews=null;setBusy=()=>{};beginChapter=()=>{};updateChapterNarrative=()=>{};finishChapter=()=>{};renderPanel=()=>{};renderOptions=()=>{};checkAchievements=()=>{};setDot=()=>{};foldHistory=()=>{};refreshManagementActions=()=>{};styleFix=()=>({redo:null});
 var calls=0,forecasts=0,settles=0;const originalForecast=forecastTurn,originalSettle=settleTurnOnce;forecastTurn=(...args)=>{forecasts++;return originalForecast(...args);};settleTurnOnce=(...args)=>{settles++;return originalSettle(...args);};var initialDays=S.elapsedDays,initialTurn=S.turn,itemsBefore=JSON.stringify(S.player.items),initialProject=constructionRealm(curPlane()).home.project.id;`);
 return e;
}
(async()=>{
 for(const mode of ['success','failure-then-retry']){
  const e=setup();e.run(`callLLMOnce=async()=>{calls++;lastFinish='stop';if(calls===1)return '{"needsItemDetails":["*"]}';if(${JSON.stringify(mode)}==='failure-then-retry'&&calls===2)throw Error('接口调用失败（HTTP 401：测试失败）');return JSON.stringify({narrative:'他翻看旧物，将原件一一收好。',summary:'核对旧物',scene:{location:S.scene.location,present:[],unresolved:[]},playerChanges:{},options:[]});};`);
  await e.run(`runTurn('闭关一年，核对旧物',{months:12,cult:'闭关',fate:10,check:null})`);
  if(mode==='failure-then-retry'){
   assert.equal(e.run('S.elapsedDays'),e.run('initialDays'));assert.equal(e.run('constructionRealm(curPlane()).home.level'),0);assert(e.run('!!S.pending.forecast'));assert.equal(e.run('settles'),0);
   await e.run(`runTurn('闭关一年，核对旧物',{months:12,cult:'闭关',fate:10,check:null})`);
  }
  assert.equal(e.run('forecasts'),1);assert.equal(e.run('settles'),1);assert.equal(e.run('S.elapsedDays-initialDays'),360);assert.equal(e.run('S.turn-initialTurn'),1);assert.equal(e.run('constructionRealm(curPlane()).home.level'),1);assert.equal(e.run(`S.estates.history.filter(x=>x.event==='开工').length`),1);assert.equal(e.run(`S.estates.history.filter(x=>x.event==='完工').length`),1);assert.equal(e.run('JSON.stringify(S.player.items)'),e.run('itemsBefore'));assert(!e.run('!!S.pending'));
  console.log('✓ '+mode+'：补读及失败恢复只预演一次、提交一次，工程与旧物完整保留');
 }
 console.log('2 construction flow regressions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
