// 推演稳定性：JSON 修复、网络重发、校验就地修、宽松收下、坏数据不让结算崩。
// 用法：node test/stab.cjs     不调模型、不开浏览器。
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
const {run,val}=env();
const P=x=>val(`parseJSONLoose(${JSON.stringify(x)})`);
t('JSON：字符串里直接换行',()=>{assert.equal(P('{"narrative":"第一行\n第二行","summary":"x"}').narrative,'第一行\n第二行');});
t('JSON：对白用了没转义的英文引号',()=>{assert.equal(P('{"narrative":"他说"走吧"，转身就走。","summary":"x"}').narrative,'他说"走吧"，转身就走。');});
t('JSON：结尾多逗号、中文冒号逗号',()=>{const d=P('{"narrative"："一段"，"options":[{"text":"走"},],}');assert.equal(d.narrative,'一段');assert.equal(d.options.length,1);});
t('JSON：代码块、思考标签、前后废话',()=>{assert.equal(P('<think>想一想{}</think>好的：\n```json\n{"narrative":"x","summary":"y"}\n```').summary,'y');});
t('JSON：被截断也能救回已写完的部分',()=>{const d=P('{"narrative":"写完了","summary":"y","options":[{"text":"走"},{"text":"留');assert.equal(d.narrative,'写完了');});
t('JSON：包在数组里',()=>{assert.equal(P('[{"narrative":"x","summary":"y"}]').narrative,'x');});
t('JSON：非法反斜杠',()=>{assert.equal(P('{"narrative":"灵石\\一块","summary":"y"}').narrative,'灵石\\一块');});

await ta('网络：503 两次后第三次成功，不报错',async()=>{const {run}=env();run(`toast=()=>{};var k=0;callLLMOnce=async()=>{k++;if(k<3)throw new Error('接口调用失败（HTTP 503：busy）');return '{"a":1}';};`);assert.equal(await run(`callLLM('x')`),'{"a":1}');assert.equal(run('k'),3);});
await ta('网络：超时、断网、空回复都重发',async()=>{for(const m of ['接口调用失败（等待超时，已中止）','接口调用失败（Failed to fetch）']){const {run}=env();run(`toast=()=>{};var k=0;callLLMOnce=async()=>{k++;if(k<2)throw new Error(${JSON.stringify(m)});return '{"a":1}';};`);await run(`callLLM('x')`);assert.equal(run('k'),2);}
  const {run}=env();run(`toast=()=>{};var k=0;callLLMOnce=async()=>{k++;return k<2?'  ':'{"a":1}';};`);await run(`callLLM('x')`);assert.equal(run('k'),2);});
await ta('网络：密钥错、余额不足不重发',async()=>{for(const c of [401,402,400]){const {run}=env();run(`toast=()=>{};var k=0;callLLMOnce=async()=>{k++;throw new Error('接口调用失败（HTTP ${c}：x）');};`);await assert.rejects(()=>run(`callLLM('x')`),/HTTP/);assert.equal(run('k'),1);}});
await ta('网络：玩家取消不重发',async()=>{const {run}=env();run(`toast=()=>{};var k=0;callLLMOnce=async()=>{k++;throw new Error('接口调用失败（请求已取消）');};`);await assert.rejects(()=>run(`callLLM('x')`));assert.equal(run('k'),1);});

await ta('校验：成败矛盾不重写，以引擎为准收下',async()=>{const {run}=env();run(`toast=()=>{};var k=0;callLLM=async()=>{k++;return JSON.stringify({narrative:'说服了他。'.repeat(40),summary:'说服',check:{success:true}});};`);const d=await run(`llmJSON('x',null,{validate:(d,o)=>validateTurn(d,'说服',{fate:10,check:{success:false,attr:'谈吐'}},S,o)})`);assert.equal(run('k'),1);assert.equal(d.check.success,false);});
await ta('校验：写死主角，不重写，改成重伤',async()=>{const {run}=env();run(`toast=()=>{};var k=0;callLLM=async()=>{k++;return JSON.stringify({narrative:'死了。'.repeat(80),summary:'死',gameOver:true});};`);const d=await run(`llmJSON('x',null,{validate:(d,o)=>validateTurn(d,'打听',{fate:10},S,o)})`);assert.equal(d.gameOver,false);});
await ta('校验：引用不存在的人、事件、对手，就地丢掉，一次过',async()=>{const {run}=env();run(`toast=()=>{};var k=0;callLLM=async()=>{k++;return JSON.stringify({narrative:'x'.repeat(300),summary:'s',npcUpdates:[{name:'鬼'}],worldUpdates:[{id:'nope',text:'?'}],duel:{opponent:'鬼'},scene:{present:['鬼'],location:5},newNpcs:[{name:'甲'},{name:'乙'},{name:'丙'}],options:[{text:''},{text:'走',months:'2'}]});};`);const d=await run(`llmJSON('x',null,{validate:(d,o)=>validateTurn(d,'走',{fate:10,destination:'青云山'},S,o)})`);assert.equal(run('k'),1);assert.equal(d.npcUpdates.length,0);assert.equal(d.worldUpdates.length,0);assert.equal(d.duel,null);assert.equal(d.scene.location,'青云山');assert.equal(d.newNpcs.length,3);assert.equal(d.options.length,2);assert.equal(d.options[0].months,2);assert.equal(d.options[1].type,'rest');});
await ta('校验：数字写成字符串',async()=>{const d=val(`validateTurn({narrative:'x',playerChanges:{money:'-30',hp:'＋5',attributes:{心性:'+2'}}},'走',{fate:10},S)`);assert.equal(d.playerChanges.money,-30);assert.equal(d.playerChanges.attributes.心性,2);assert.ok(d.summary);});
await ta('面谈：成败矛盾打回重写，最后一份以引擎为准',async()=>{const {run}=env();run(`toast=()=>{};S.npcs.push(normNpc({name:'沈清',gender:'女',age:20,realm:'炼气二阶',好感度:50,alive:true}));var k=0;callLLM=async()=>{k++;return JSON.stringify({reply:'行，借你。',attempt:{success:true},effects:{money:'50',give:'回春丹'}});};`);const d=await run(`llmJSON('x',null,{validate:(d,o)=>validateConvo(d,S.npcs[0],{type:'讨要',attr:'谈吐',need:55,roll:2,total:20,success:false},o)})`);assert.equal(d.attempt.success,false);assert.equal(d.effects.money,run('convoCaps(S.npcs[0]).money'));assert(d.fixNotes.some(x=>x.includes('最多')));assert.deepEqual(JSON.parse(JSON.stringify(d.effects.give)),['回春丹']);});

// 乱给数据：结算不能崩
t('乱数据 3000 回：校验后结算不抛错',()=>{
  const {run}=env();run(`S.npcs.push(normNpc({name:'沈清',gender:'女',age:20,realm:'炼气二阶',好感度:50,alive:true}));`);
  let seed=7;const R=()=>{seed=(seed*1103515245+12345)>>>0;return seed/4294967296;};
  const junk=()=>{const r=R();return r<.15?null:r<.3?'字':r<.45?7:r<.6?[]:r<.7?{}:r<.8?['甲',3]:r<.9?{name:'沈清',x:'1'}:[{name:'沈清',好感度:'+5',text:'t',title:'某事',level:'3',stage:'结束'}];};
  const keys=['npcUpdates','newNpcs','questUpdates','newQuests','rankingUpdates','rankingAdd','factionUpdates','newVendettas','options','taughtNpc','worldUpdates','newWorldEvents','resolvedInfo','npcEvents','rumors','scene','duel','check'];
  const pk=['attributes','fame','skills','itemsAdd','artsAdd','artsTrain','personalityAdd','statusAdd','statusRemove','itemsRemove','money','hp','lingli','contrib','age'];
  let bad=[];
  for(let i=0;i<3000;i++){
    const d={narrative:'一段正文',summary:'摘要',playerChanges:{}};
    for(const k of keys) if(R()<.4) d[k]=junk();
    for(const k of pk) if(R()<.3) d.playerChanges[k]=junk();
    if(R()<.1) d.playerChanges=junk();
    const js=JSON.stringify(d);
    try{ run(`(()=>{const snap=JSON.stringify(S);try{const j={fate:10,months:1};const d=validateTurn(${js},'走走',j,S);applyTurn(d,'走走',j);}finally{S=JSON.parse(snap);}})()`); }
    catch(e){ bad.push(e.message+' ← '+js.slice(0,200)); }
  }
  if(bad.length){ console.log([...new Set(bad.map(x=>x.split(' ← ')[0]))].slice(0,15).join('\n')); console.log(bad[0]); }
  assert.equal(bad.length,0);
});
t('乱数据（深一层字段）3000 回：结算不抛错',()=>{
  const {run}=env();run(`S.npcs.push(normNpc({name:'沈清',gender:'女',age:20,realm:'炼气二阶',好感度:50,alive:true}));`);
  let seed=99;const R=()=>{seed=(seed*1103515245+12345)>>>0;return seed/4294967296;};
  const leaf=()=>{const r=R();return r<.2?null:r<.4?'字':r<.55?'+5':r<.7?3:r<.8?[]:r<.9?{}:['甲'];};
  const sub=['name','title','text','id','stage','result','progress','status','level','style','grade','element','tags','personality','好感度','爱恋值','relation','realm','age','gender','identity','secret','faction','alive','opponent','lethal','location','present','unresolved','type','target','months','days','cause','desc','reason','heat','rank','notes','success','attr'];
  const obj=()=>{const o={};for(const k of sub) if(R()<.25) o[k]=leaf(); if(R()<.5) o.name='沈清'; return o;};
  const arr=()=>Array.from({length:1+Math.floor(R()*3)},()=>R()<.85?obj():leaf());
  const keys=['npcUpdates','newNpcs','questUpdates','newQuests','rankingUpdates','rankingAdd','factionUpdates','newVendettas','options','taughtNpc','worldUpdates','newWorldEvents','resolvedInfo','npcEvents','rumors'];
  let bad=[];
  for(let i=0;i<3000;i++){
    const d={narrative:'一段正文',summary:'摘要',playerChanges:{}};
    for(const k of keys) if(R()<.35) d[k]=arr();
    for(const k of ['scene','duel']) if(R()<.3) d[k]=obj();
    const pc=d.playerChanges;
    if(R()<.3) pc.artsAdd=arr(); if(R()<.3) pc.artsTrain=arr(); if(R()<.3) pc.itemsAdd={丹药:R()<.5?arr():leaf(),法器:arr()};
    if(R()<.3) pc.itemsRemove=arr(); if(R()<.3) pc.statusAdd=arr(); if(R()<.3) pc.personalityAdd=arr(); if(R()<.3) pc.attributes={体魄:leaf(),悟性:leaf()}; if(R()<.3) pc.fame={声望:leaf()};
    const js=JSON.stringify(d);
    try{ run(`(()=>{const snap=JSON.stringify(S);try{const j={fate:10,months:1};const d=validateTurn(${js},'走走',j,S);applyTurn(d,'走走',j);}finally{S=JSON.parse(snap);}})()`); }
    catch(e){ bad.push(e.message+' ← '+js.slice(0,300)); }
  }
  if(bad.length){ console.log(bad.length, [...new Set(bad.map(x=>x.split(' ← ')[0]))].slice(0,20).join('\n')); console.log(bad[0]); }
  assert.equal(bad.length,0);
});
console.log(`\n${n} 项通过`);
})().catch(e=>{console.error(e);process.exit(1);});
