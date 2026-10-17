// 主动同房经过真实 runTurn/补读/接口失败恢复，仅受孕判定一次、推进一天。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {env,BASE,UP}=require('./xjv2-env.cjs'),file=process.argv[2]||path.join(__dirname,'../index.html'),html=fs.readFileSync(file,'utf8');
function setup(){
 const e=env(file,31);e.run(BASE);
 e.run(`S.player.age=30;S.player.realm=parseRealm('筑基初期');S.player.money=1e6;S.player.fert=1;S.player.hp=100;var wife=findNpc('沈清');wife.age=30;wife.realm=parseRealm('筑基初期');wife.location=S.scene.location;wife.fert=1;S.elapsedDays=17;S.months=0;S.player.items.其他=Array.from({length:120},(_,i)=>({name:'旧物'+i,desc:'原物原文，师门旧约与赠予经历，不得删除。'.repeat(30)}));Date.now=()=>1000000;S.runId='intimacy-flow';var intimacyDraws=0;const originalIntimacy=resolveIntimacy;resolveIntimacy=(name)=>{intimacyDraws++;const old=Math.random;Math.random=()=>0;try{return originalIntimacy(name);}finally{Math.random=old;}};`);
 e.run(html.slice(html.indexOf('async function runTurn('),html.indexOf('async function gameOverFlow(')));
 e.run(`globalThis.liveChapter=null;globalThis.lastEngineNews=null;setBusy=()=>{};beginChapter=()=>{};updateChapterNarrative=()=>{};finishChapter=()=>{};renderPanel=()=>{};renderOptions=()=>{};checkAchievements=()=>{};setDot=()=>{};foldHistory=()=>{};refreshManagementActions=()=>{};styleFix=()=>({redo:null});
 var calls=0,forecasts=0,settles=0;const originalForecast=forecastTurn,originalSettle=settleTurnOnce;forecastTurn=(...args)=>{forecasts++;return originalForecast(...args);};settleTurnOnce=(...args)=>{settles++;return originalSettle(...args);};var initialDays=S.elapsedDays,initialTurn=S.turn,itemsBefore=JSON.stringify(S.player.items);`);
 return e;
}
(async()=>{
 for(const mode of ['success','failure-then-retry']){
  const e=setup();e.run(`callLLMOnce=async()=>{calls++;lastFinish='stop';if(calls===1)return '{"needsItemDetails":["*"]}';if(${JSON.stringify(mode)}==='failure-then-retry'&&calls===2)throw Error('接口调用失败（HTTP 401：测试失败）');return JSON.stringify({narrative:'他翻看旧物，将原件一一收好。',summary:'核对旧物',scene:{location:S.scene.location,present:[],unresolved:[]},playerChanges:{},options:[]});};`);
  await e.run(`runTurn('今夜与沈清同房，次晨核对旧物',{months:1/30,cult:'日常',fate:10,check:null,intimacy:'沈清'})`);
  if(mode==='failure-then-retry'){
   assert.equal(e.run('S.elapsedDays'),e.run('initialDays'));assert(!e.run(`!!findNpc('沈清').preg`));assert(e.run('!!S.pending.forecast'));assert.equal(e.run('settles'),0);
   await e.run(`runTurn('今夜与沈清同房，次晨核对旧物',{months:1/30,cult:'日常',fate:10,check:null,intimacy:'沈清'})`);
  }
  assert.equal(e.run('forecasts'),1);assert.equal(e.run('settles'),1);assert.equal(e.run('S.elapsedDays-initialDays'),1);assert.equal(e.run('S.turn-initialTurn'),1);assert(e.run(`!!findNpc('沈清').preg`));assert.equal(e.run(`findNpc('沈清').preg.due-S.elapsedDays`),300);assert.equal(e.run('S.intimacyLog.length'),1);assert.equal(e.run('intimacyDraws'),1);assert.equal(e.run('JSON.stringify(S.player.items)'),e.run('itemsBefore'));assert(!e.run('!!S.pending'));
  console.log('✓ '+mode+'：补读及失败恢复只预演一次、提交一次，单次受孕与旧物完整保留');
 }
 console.log('2 intimacy flow regressions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
