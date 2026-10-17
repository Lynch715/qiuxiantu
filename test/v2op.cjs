// 第二意见整改：规则冲突、截断不收、正文与账面、重试预算、省输出与找对人。
// 用法：node test/v2op.cjs     不调模型、不开浏览器。
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const src=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n').split('/* ================= 界面事件 ================= */')[0];
function env(opt){
  opt=opt||{};
  const el=()=>({classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll:()=>[],querySelector:()=>el(),appendChild(){},remove(){},innerHTML:'',textContent:'',value:''});
  let seed=opt.seed||12345;const math=Object.create(Math);math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
  const c=vm.createContext({console,window:{addEventListener(){}},document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){},createElement:el},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:(f)=>{Promise.resolve().then(f);return 0;},clearTimeout(){},Math:math,AbortController});
  vm.runInContext(src,c);
  const run=s=>vm.runInContext(s,c), val=s=>JSON.parse(JSON.stringify(run(s)));
  run(`saveGame=()=>{};S=newStateShell();S.freedom='${opt.freedom||'mid'}';S.difficulty='${opt.difficulty||'normal'}';S.player={name:'韩七',gender:'男',age:20,hp:100,money:1000,attributes:{谈吐:50},声望:0,凶名:0,faction:'散修',status:[],arts:[{name:'长春功',style:'护体',level:20,grade:'黄阶下品',element:'木'}],items:{法器:[],玉简:[],丹药:[],符箓:[],毒药:[],灵材:[],其他:[]},skills:{},personality:[]};xianAttach(S.player);S.player.tags=[];S.player.realm={major:0,minor:1,perfect:false,ascended:false};S.player.lingli=0;for(const k of ['体魄','神识','心性','谈吐','悟性'])S.player.attributes[k]=50;S.scene={location:'坊市',present:[],unresolved:[]};S.date=dateStr();worldState();`);
  return {run,val,setRandom:f=>{math.random=f;}};
}


let n=0;const t=(name,fn)=>{fn();n++;console.log('✓ '+name);};const ta=async(name,fn)=>{await fn();n++;console.log('✓ '+name);};
(async()=>{
const J={fate:10,months:1,check:null};
t('A1 规则冲突清掉了',()=>{const {run}=env();const p=run(`turnPrompt('打坐',${JSON.stringify(J)})`)+run('styleSystem()');for(const w of ['自行设定难度','至少1个有风险','打回重写','也不要把它们再当成选项']) assert.ok(!p.includes(w),w);});
await ta('A2 截断：正文写完了，丢掉正在写的最后一个字段，起居注有说明',async()=>{const {run}=env();run(`toast=()=>{};var k=0;callLLMOnce=async()=>{k++;lastFinish='length';return '{"narrative":"他把丹收进袖里。","summary":"s","playerChanges":{"itemsAdd":{"丹药":[{"name":"回春丹","count":3}]}},"options":[{"text":"走"},{"text":"留';};`);
  const d=await run(`llmJSON('x',null,{validate:(d,o)=>validateTurn(d,'走',{fate:10},S,o)})`);assert.equal(run('k'),1);assert.equal(d.options.length,0);assert.equal(d.playerChanges.itemsAdd.丹药[0].count,3);assert.match(d.fixNotes.join(),/截断/);});
await ta('A2 截断：正文没写完就重来',async()=>{const {run}=env();run(`toast=()=>{};var k=0;callLLMOnce=async()=>{k++;if(k===1){lastFinish='length';return '{"narrative":"他把丹收进';}lastFinish='stop';return '{"narrative":"他把丹收进袖里。","summary":"s"}';};`);
  const d=await run(`llmJSON('x',null,{validate:(d,o)=>validateTurn(d,'走',{fate:10},S,o)})`);assert.equal(run('k'),2);assert.equal(d.narrative,'他把丹收进袖里。');});
await ta('A3 判定失败的回合，前情提要和最近剧情带引擎结算',async()=>{const {run,val}=env();run(`(()=>{const j={fate:10,months:0,check:{success:false,attr:'谈吐',need:70,roll:3}};const d=validateTurn({narrative:'说服了掌柜。',summary:'说服掌柜',check:{success:true}},'说服',j,S);applyTurn(d,'说服',j);})()`);
  assert.match(val('S.history.slice(-1)[0].summary'),/引擎结算：此事没成/);assert.match(val('S.recent.slice(-1)[0].narrative'),/以此为准/);});
await ta('A3 写死主角：标记改结尾，改完只换正文',async()=>{const {run,val}=env();run(`toast=()=>{};updateChapterNarrative=()=>{};callLLM=async()=>JSON.stringify({narrative:'他倒在血泊里，却被路过的老道一把拎起，还剩一口气。'.repeat(3)});`);
  const d=run(`validateTurn({narrative:'他倒在血泊里，就此身死。'.repeat(3),summary:'死',gameOver:true,playerChanges:{hp:-200}},'打听',{fate:10},S)`);assert.equal(d.deathFix,true);
  await run(`(async()=>{window.__d=validateTurn({narrative:'他倒在血泊里，就此身死。'.repeat(3),summary:'死',gameOver:true},'打听',{fate:10},S);await fixDeathText(window.__d);})()`);assert.match(val('window.__d.narrative'),/还剩一口气/);assert.equal(val('window.__d.gameOver'),false);});
await ta('A4 网络一直坏：最多 3 次请求就报错，留着重试',async()=>{const {run}=env();run(`toast=()=>{};var k=0;callLLMOnce=async()=>{k++;throw new Error('接口调用失败（HTTP 503：busy）');};`);await assert.rejects(()=>run(`llmJSON('x',null,{})`));assert.ok(run('k')<=4);});
await ta('A4 一直给坏格式：最多 4 次请求',async()=>{const {run}=env();run(`toast=()=>{};var k=0;callLLMOnce=async()=>{k++;lastFinish='stop';return '这不是JSON也没有大括号';};`);await assert.rejects(()=>run(`llmJSON('x',null,{})`),/判定不会重掷/);assert.equal(run('k'),4);});
await ta('A4 网络错和坏格式交替：合起来不超过 4 次',async()=>{const {run}=env();run(`toast=()=>{};var k=0;callLLMOnce=async()=>{k++;if(k%2)throw new Error('接口调用失败（HTTP 503：busy）');lastFinish='stop';return '坏';};`);await assert.rejects(()=>run(`llmJSON('x',null,{})`));assert.ok(run('k')<=4,String(run('k')));});
t('A5 输出格式（10-09 起放回完整骨架，必写项写明）',()=>{const {run}=env();const p=run(`turnPrompt('打坐',${JSON.stringify(J)})`);assert.ok(p.includes('必写：narrative、summary、scene'));assert.ok(p.includes('"npcUpdates":[{"name":"名册上的全名"'));assert.ok(!p.includes('"playerChanges":{"age":null或新年龄'));});
t('A5 行动里点名的人排在要紧人物第一位、资料给全',()=>{const {run}=env();run(`for(let i=0;i<14;i++)S.npcs.push(normNpc({name:'路人'+'甲乙丙丁戊己庚辛壬癸子丑寅卯'[i],gender:'男',age:30,realm:'炼气三阶',identity:'散修',secret:'s',好感度:70,alive:true,relation:'师父'}));S.npcs.push(normNpc({name:'沈清',gender:'女',age:22,realm:'炼气五阶',identity:'药铺掌柜',secret:'她是卧底',好感度:40,alive:true}));S.scene={location:'坊市',present:[],unresolved:[]};`);
  const p=run(`turnPrompt('去找沈清问问药价',${JSON.stringify(J)})`);const nb=JSON.parse(p.match(/【眼下要紧的人[^】]*】(\[.*\])\n/)[1]);assert.equal(nb[0].name,'沈清');const profiles=require("./context-stage2.cjs").unpack(p.match(/【人物谱[^】]*】\n([\s\S]*?)\n【/)[1]);assert.equal(profiles.find(n=>n.name==="沈清").secret,"她是卧底");});
console.log(`\n${n} 项通过`);
})().catch(e=>{console.error(e);process.exit(1);});
