// 提示词第二阶段：只读投影逐字段还原、亲属称呼、状态/随机数与结算对照。
// REAL_SAVE 可选，只在本地读取；不会把存档或接口配置写入仓库。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),current=process.argv[2]||path.join(root,'index.html');
function engine(file,seed=31){
  const html=fs.readFileSync(file,'utf8'),src=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n').split('/* ================= 界面事件 ================= */')[0];
  const el=()=>({classList:{toggle(){},add(){},remove(){},contains(){return false;}},style:{},dataset:{},addEventListener(){},querySelectorAll:()=>[],querySelector:()=>el(),appendChild(){},remove(){},innerHTML:'',textContent:'',value:''});
  const math=Object.create(Math);math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  return new Function('document','localStorage','Math','window','setTimeout','clearTimeout','AbortController','performance',src+`\nfunction toast(){};saveGame=()=>{};renderPanel=()=>{};renderOptions=()=>{};return {run:code=>eval(code),load:st=>{S=st;migrate(S);},snapshot:()=>JSON.stringify(S),nextRandom:()=>Math.random()};`)(
    {getElementById:el,querySelectorAll:()=>[],querySelector:()=>null,createElement:el,addEventListener(){},body:{appendChild(){}}},
    {getItem:()=>null,setItem(){},removeItem(){}},math,{addEventListener(){}},()=>0,()=>{},AbortController,performance);
}
const clone=v=>JSON.parse(JSON.stringify(v)),hash=v=>crypto.createHash('sha256').update(v).digest('hex');
function unpack(text){
  let data;try{data=JSON.parse(text);}catch{return text.split('\n').filter(Boolean).map(JSON.parse);}
  if(Array.isArray(data))return data;
  if(!Array.isArray(data.rows)||!Array.isArray(data.columns))return [data];
  return data.rows.map(row=>Object.assign(Object.fromEntries(data.columns.slice(0,-1).map((k,i)=>[k,row[i]])),row[row.length-1]));
}
function profile(text){return text.match(/【人物谱[^】]*】\n([\s\S]*?)\n【流水账/)[1];}
function familyRoundTrip(block){
  if(!block.includes('（表格每行依子女列读取'))return block;
  const start=block.indexOf('（表格每行依子女列读取'),a=block.indexOf('{',start),end=block.lastIndexOf('}')+1,d=JSON.parse(block.slice(a,end));
  const kids=d.子女.map(r=>`${r[0]}（${r[1]}，${r[2]}岁，${r[3]}${r[4]?'，已故':''}${r[5]==='未测灵根'?'，未测灵根':'，'+r[5]}${r[6]?'，'+r[6]:''}；${d.称呼组[r[7]-1].map(o=>`称${o.姓名}为「${o.完整称呼}」`).join('，')}）`).join('；');
  return block.slice(0,start)+kids+block.slice(end);
}
async function main(){
  let baseline=process.env.CONTEXT_BASELINE||path.join(root,'_backup/index-before-context-stage2-20261017.html');
  if(!fs.existsSync(baseline)){
    const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'xian-context-baseline-'));baseline=path.join(dir,'index.html');
    fs.writeFileSync(baseline,require('node:child_process').execFileSync('git',['show','94e33bf:index.html'],{cwd:root,maxBuffer:5e6}));process.on('exit',()=>fs.rmSync(dir,{recursive:true,force:true}));
  }
  let passed=0;const results=[];
  async function test(name,fn){await fn();passed++;console.log('✓ '+name);}
  const {BASE,UP}=require('./xjv2-env.cjs');
  const setup=file=>{const e=engine(file);e.run(BASE);e.run(UP);return e;};
  await test('提示词压缩边界保留；建设、生育及关系同步仅改动明确列出的函数',()=>{
    const a=setup(baseline),b=setup(current),promptChanges=['familyBlock','stateBlocksCore','turnPrompt','questContext'],constructionHooks=['advanceTime','advanceTimeCore','cultivateMonth','npcCultivateMonth','clanMonth','studyRoll','applyTurn','openClose','cultHtml','renderPanel'],familyHooks=['refreshManagementActions','familyMonthCore','renderFamily','judgeBlock','validateTurnCore','forecastTurn','makeJudge','act','runTurn','migrate','applyInit','relKindOf','relationEventEvidence','npcGuard','syncPlayerRel','mentorshipRel','relationActions','relationRestoreRequested','recordRelationshipExit','endPlayerRelation','sectRosterLine','applyConvoEffects'],allowed=new Set([...promptChanges,...constructionHooks,...familyHooks]),changed=[];
    for(const [,name]of fs.readFileSync(baseline,'utf8').matchAll(/^(?:async )?function (\w+)\(/gm)){
      let old,now;try{old=a.run(name+'.toString()');now=b.run(name+'.toString()');}catch{continue;}
      if(old!==now){changed.push(name);assert(allowed.has(name),'unexpected change: '+name);}
    }
    assert.deepEqual(changed.filter(n=>promptChanges.includes(n)).sort(),promptChanges.slice().sort());assert.deepEqual(changed.filter(n=>!promptChanges.includes(n)).sort(),[...constructionHooks.filter(n=>n!=='renderPanel'),...familyHooks].sort());results.push({changedExistingFunctions:changed});
  });
  await test('三种自由度的世界规则、选项协议、风格与谈话抬头逐字一致',()=>{
    for(const freedom of ['free','mid','strict']){const a=setup(baseline),b=setup(current);for(const e of [a,b])e.run(`S.freedom=${JSON.stringify(freedom)};`);
      for(const expr of ['worldRules()','worldHead()','styleSystem()','WORLD_STATE_RULES','QUEST_RULES','CONTINUITY_RULES','OPTIONS_RULE','NPC_SCHEMA','JSON_RULE','tailReminder()'])assert.equal(b.run(expr),a.run(expr),freedom+'/'+expr);
    }
  });
  await test('共用表头可精确还原空值、false、0、秘密、异文与未识别的嵌套字段',()=>{
    const e=setup(current),rows=Array.from({length:20},(_,i)=>({name:'同名人物',secret:'尚未公开的秘密'+i,secretKnown:i%2===0,appearance:i===0?null:'',notes:'旧事原文'.repeat(12),progress:0,其余原字段:{nested:[null,false,0,'同名异文'+i]},...(i===0?{extra:{unexpected:'不能丢'}}:{})}));
    const text=e.run('rows=>promptRecords(rows,["name","secret","secretKnown","appearance","notes","progress"])')(rows);
    assert.deepEqual(unpack(text),rows);assert(text.length<JSON.stringify(rows).length);assert.deepEqual(rows[0].其余原字段.nested,[null,false,0,'同名异文0']);
  });
  await test('空表、小表与稀疏可选字段不强制扩容，不混同未填与null',()=>{
    const e=setup(current);for(const rows of [[],[{name:'甲',secret:null}],[{name:'甲',secret:undefined},{name:'乙',secret:null,secretKnown:false}]]){
      const text=e.run('rows=>promptRecords(rows,["name","secret","secretKnown"])')(rows);assert.deepEqual(unpack(text),clone(rows));assert(text.length<=JSON.stringify(rows).length);
    }
  });
  await test('人物私密资料保留逐人具名对象，已知与未知状态都显式给出',()=>{
    const e=setup(current);e.run(`S.npcs=[];S.roster=[];S.rosterAt=S.turn;for(let i=0;i<20;i++){const n=normNpc({name:'旧识'+i,gender:'男',age:100,realm:'筑基初期',alive:true,secret:'只有此人知道的旧事'+i,notes:'与主角的往事原文'+i,好感度:60});n.secretKnown=i===0;S.npcs.push(n);S.roster.push(n.name);}worldState();`);
    const before=e.snapshot(),text=e.run("stateBlocks('回忆旧识')"),people=unpack(profile(text));
    assert(!profile(text).includes('"columns"'));assert.equal(people.length,20);
    for(let i=0;i<20;i++){const n=people.find(n=>n.name==='旧识'+i);assert.equal(n.secret,'只有此人知道的旧事'+i);assert.equal(n.secretKnown,i===0);assert.equal(n.notes,'与主角的往事原文'+i);}
    assert(text.includes('secretKnown为false的秘密主角尚不知道'));assert.equal(e.run('JSON.stringify(S.npcs)'),JSON.stringify(JSON.parse(before).npcs));
  });
  for(const gender of ['男','女'])await test('父母与正室/妾室、已故子女、未测灵根和例外称呼可逐字还原 '+gender,()=>{
    const a=setup(baseline),b=setup(current),edit=`S.player.gender='${gender}';S.npcs=[];S.rels=[];for(const [name,g,type]of [['长房','女','夫妻'],['旁房','女','妾室'],['别家长辈','男','夫妻']]){S.npcs.push(normNpc({name,gender:g,age:100,realm:'筑基初期',alive:true}));if(name!=='别家长辈')relSet(S.player.name,name,type,'旧关系');}relSet('别家长辈','长房','夫妻','另一家');for(let i=0;i<24;i++){const n=normNpc({name:'子女'+i,gender:i%2?'男':'女',age:18+i,realm:'炼气一阶',alive:i!==2});n.parents=i===3?{father:'别家长辈',mother:S.player.name}:{father:S.player.name,mother:'旁房'};n.legit=i%2?'嫡':'庶';n.lgHidden=i%3===0;S.npcs.push(n);}S.npcs[1].preg={with:S.player.name};`;
    a.run(edit);b.run(edit);const before=b.snapshot(),old=a.run('familyBlock()'),now=b.run('familyBlock()');assert.deepEqual(clone(JSON.parse(b.snapshot())),clone(JSON.parse(a.snapshot())));assert.equal(familyRoundTrip(now),old);assert(now.length<=old.length);assert.equal(b.snapshot(),before);assert.equal(b.nextRandom(),a.nextRandom());
  });
  await test('无子女、无婚姻与只有配偶时的家室原样保留',()=>{for(const edit of ['S.npcs=[];S.rels=[];','S.npcs=[];S.rels=[];relSet(S.player.name,"远方伴侣","夫妻");']){const a=setup(baseline),b=setup(current);a.run(edit);b.run(edit);assert.equal(b.run('familyBlock()'),a.run('familyBlock()'));}});
  for(const status of ['进行中','完成','失败','已放弃'])await test('心愿原条件/ID/对手/证据/里程碑全部保留 '+status,()=>{
    const e=setup(current);e.run(`S.quests=[initQuest({title:'旧约',desc:'原始说明',completion:'原有最终条件',objectives:[{id:'a',text:'使用旧功法',kind:'artUse',target:'长春功',opponent:'陆衡',value:3},{id:'b',text:'已发生的旧事',kind:'story',value:1}]})];S.quests[0].status='${status}';S.quests[0].objectives[0].proof='原证据不可删';S.quests[0].objectives[1].done=true;S.quests[0].milestones=['早年的成果'];`);
    const t=e.run('JSON.parse(JSON.stringify(S.quests[0]))'),before=e.snapshot(),text=e.run('questContext(S.quests[0])');assert(text.includes(status));assert(text.includes('原有最终条件'));
    if(status==='已放弃')assert(text.includes('不再推进、补计划、领奖或换标题重建'));
    else{const encoded=text.split('；条件清单：')[1].split('（columns')[0],decoded=unpack(encoded),old=t.objectives.map(o=>JSON.parse(JSON.stringify({id:o.id,text:o.text,kind:o.kind,target:o.target,value:o.value,relation:o.relation,opponent:o.opponent,progress:o.progress,done:!!o.done,proof:o.proof})));assert.deepEqual(decoded.map(o=>{delete o.账面进度;return o;}),old);assert(text.includes('早年的成果'));}
    assert.equal(e.snapshot(),before);
  });
  await test('原文相同的说明/结愿条件只引用一次，旧档未列条件仍要求补plan',()=>{
    const e=setup(current);e.run(`S.quests=[{title:'旧约',status:'进行中',desc:'原文目标',completion:'原文目标',progress:0,milestones:[],objectives:[]}];`);const text=e.run('questContext(S.quests[0])');assert.equal(text.split('原文目标').length-1,1);assert(text.includes('plan'));assert(text.includes('不提高要求'));
  });
  if(process.env.REAL_SAVE){
    const saveBytes=fs.readFileSync(process.env.REAL_SAVE),save=JSON.parse(saveBytes),originalHash=hash(saveBytes);
    const real=(file,seed=31)=>{const e=engine(file,seed);if(file===baseline)require('./player-family-policy.cjs')(e);e.load(clone(save));return e;};
    await test('第964回存档：69人物谱逐字段、92子女逐字还原，全部20心愿仍在',()=>{
      const a=real(baseline),b=real(current),old=a.run("stateBlocks('静坐')"),now=b.run("stateBlocks('静坐')");
      assert.deepEqual(unpack(profile(now)),unpack(profile(old)).map(o=>({...o,secretKnown:o.secretKnown||false})));assert(!profile(now).includes("\"columns\""));assert(unpack(profile(now)).every(row=>Object.hasOwn(row,"secretKnown")));assert(now.includes("不得借回忆、听说或推断写成已知"));assert.equal(familyRoundTrip(b.run('familyBlock()')),a.run('familyBlock()'));
      for(const q of save.quests)assert(now.includes(q.title));assert.equal(b.snapshot(),a.snapshot());assert.equal(b.nextRandom(),a.nextRandom());
      const replace=t=>t.replace(/【人物谱[^】]*】\n[\s\S]*?\n【流水账/,'【人物谱替位】\n【流水账').replace(/【心愿】\n[\s\S]*?\n【眼下要紧的人/,'【心愿替位】\n【眼下要紧的人').replace(/【家室】[^\n]*/,'【家室替位】');
      assert.equal(replace(now),replace(old));
      results.push({realSave:true,profileCount:unpack(profile(now)).length,childCount:b.run('S.npcs.filter(n=>n.parents&&(n.parents.father===playerName()||n.parents.mother===playerName())).length'),questCount:save.quests.length,beforeChars:old.length,afterChars:now.length});
    });
    for(const seed of [7,31,91])await test('真实存档一年预演完整状态与下一随机数一致 seed='+seed,()=>{
      const a=real(baseline,seed),b=real(current,seed),expr="JSON.stringify(forecastTurn(S,{months:12,cult:'闭关',fate:10},'闭关一年，潜心修炼'))",x=a.run(expr),y=b.run(expr);assert.equal(x,y);assert.equal(b.nextRandom(),a.nextRandom());assert.equal(b.snapshot(),a.snapshot());results.push({months:12,seed,forecastHash:hash(y),sameStateAndRandom:true});
    });
    await test('真实存档三百年预演完整状态、人物历史和下一随机数一致',()=>{
      const a=real(baseline),b=real(current),expr="JSON.stringify(forecastTurn(S,{months:3600,cult:'闭关',fate:10},'闭关三百年，潜心修炼'))",x=a.run(expr),y=b.run(expr);assert.equal(x,y);assert.equal(b.nextRandom(),a.nextRandom());assert.equal(b.snapshot(),a.snapshot());results.push({months:3600,seed:31,forecastHash:hash(y),sameStateAndRandom:true});
    });
    await test('真实存档零时间回忆的完整结算和下一随机数一致',()=>{
      const a=real(baseline),b=real(current);for(const e of [a,b])e.run(`Date.now=()=>1000000;S.runId='context-regression';var d=validateTurn({narrative:'他核对旧物，收好原件。',summary:'核对旧物',scene:{location:S.scene.location,present:[],unresolved:[]},options:[],playerChanges:{}},'核对旧物',{months:0,fate:10},S);S=settleTurnOnce(S,d,'核对旧物',{months:0,fate:10},'context-test');`);assert.equal(b.snapshot(),a.snapshot());assert.equal(b.nextRandom(),a.nextRandom());
    });
    assert.equal(hash(fs.readFileSync(process.env.REAL_SAVE)),originalHash);results.push({originalSaveHash:originalHash,saveFileUnchanged:true});
  }
  console.log(passed+' context stage2 regressions passed');if(process.env.CONTEXT_RESULT)fs.writeFileSync(process.env.CONTEXT_RESULT,JSON.stringify({passed,results},null,2));
}
module.exports={engine,unpack,familyRoundTrip};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
