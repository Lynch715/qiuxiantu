// T/turn 辅助函数验证最后一道宽松校验后的安全结算；严格退回路径另有明确断言。
// 10-09 剧情游戏性回补：选项兜底、结尾提醒、人物谱缓存、判定改结尾、面谈和文风重写、人物资料不瞎猜、人脉与师门的闸。
// 用法：node test/replot.cjs     不调模型、不开浏览器。
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

(async()=>{
let n=0;const t=(name,fn)=>{fn();n++;console.log('✓ '+name);};const ta=async(name,fn)=>{await fn();n++;console.log('✓ '+name);};
const mk=o=>{const e=env(o);e.run(`S.world={factions:[{name:'青云宗',alignment:'正派',power:60,leader:'苏长青',desc:''},{name:'合欢宗',alignment:'邪道',power:50,leader:'柳媚',desc:''}],ranking:[],events:[]};worldState();S.player.items={法器:[],玉简:[],丹药:[],符箓:[],毒药:[],灵材:[],其他:[]};toast=()=>{};`);return e;};
const T=(r,body,action,judge)=>r(`(()=>{const j=${judge||'{fate:10,months:0}'};const d=validateTurn(${body},${JSON.stringify(action||'办事')},j,S,{lenient:true});applyTurn(d,${JSON.stringify(action||'办事')},j);return d;})()`);
const add=(r,o)=>r(`S.npcs.push(normNpc(${JSON.stringify(Object.assign({gender:'女',age:20,realm:'炼气三阶',identity:'散修',secret:'s',好感度:50,alive:true},o))}));S.origRel=S.origRel||{};S.origRel[${JSON.stringify(o.name)}]=${JSON.stringify(o.relation||'')};`);
const J={fate:10,months:1,check:null};

// 选项
t('选项全是 normal：有人在场补 talk',()=>{const {run,val}=mk();add(run,{name:'沈清'});const d=val(`validateTurn({narrative:'x'.repeat(300),summary:'s',scene:{present:['沈清']},options:[{text:'走'},{text:'留'},{text:'看'}]},'走',{fate:10},S)`);assert.equal(d.options.length,4);assert.equal(d.options[3].type,'talk');assert.equal(d.options[3].target,'沈清');});
t('选项全是 normal：没人在场补 rest；五个满了替掉最后一个',()=>{const {val}=mk();const d=val(`validateTurn({narrative:'x'.repeat(300),summary:'s',options:[1,2,3,4,5].map(i=>({text:'走'+i}))},'走',{fate:10},S)`);assert.equal(d.options.length,5);assert.equal(d.options[4].type,'rest');});
t('选项已有两种类型：不动',()=>{const {val}=mk();const d=val(`validateTurn({narrative:'x'.repeat(300),summary:'s',options:[{text:'走'},{text:'赌',type:'check',check:{attr:'谈吐',need:55}}]},'走',{fate:10},S)`);assert.equal(d.options.length,2);});
t('规则：选项软配额、新人物上限 3、人物和师门不许改',()=>{const {run}=mk();const p=run(`turnPrompt('打坐',${JSON.stringify(J)})`);for(const w of ['至少两种类型','最多3人','血亲和旧日来历谁也改不了','【本回合要点','必写：narrative、summary、scene']) assert.ok(p.includes(w),w);assert.match(p,/拜访、做客[^\n]*都不算/);assert.ok(p.trim().endsWith('只输出那一个JSON对象。'));});

// 人物谱
t('人物名册+人物谱：不在场的人资料给全（性格进名册，秘密、备注进人物谱），排在流水账前面',()=>{const {run}=mk();add(run,{name:'沈清',relation:'师妹',personality:['嘴硬'],secret:'她是卧底',notes:'欠主角一条命'});run(`S.npcs[0].lastSeen=S.turn`);
  const p=run(`turnPrompt('打坐',${JSON.stringify(J)})`);const cen=p.match(/【人物名册[^】]*】\n([\s\S]*?)\n【/)[1];const ros=p.match(/【人物谱[^】]*】\n([\s\S]*?)\n【/)[1];assert.match(cen,/沈清｜女｜20岁｜炼气三阶.*师妹｜嘴硬/);assert.match(ros,/她是卧底/);assert.match(ros,/欠主角一条命/);assert.ok(p.indexOf('【人物谱')<p.indexOf('【流水账'));assert.ok(p.indexOf('【人物名册')<p.indexOf('【人物谱'));});
t('名册和人物谱：好感、心情变了，一字不动（缓存命中得上）',()=>{const {run}=mk();for(const nm of ['沈清','林月','赵四']) add(run,{name:nm,relation:'朋友'});run(`S.npcs.forEach(n=>n.lastSeen=S.turn)`);
  const pick=()=>run(`turnPrompt('打坐',${JSON.stringify(J)})`).match(/【人物名册[^】]*】\n([\s\S]*?)\n【修真界格局/)[0];const a=pick();run(`S.npcs[0]['好感度']+=9;S.npcs[1].mood='恼火';S.turn++`);assert.equal(pick(),a);});
t('名册：新认识的人接在最后，前面的人不挪位',()=>{const {run}=mk();add(run,{name:'沈清',relation:'朋友'});run(`S.npcs[0].lastSeen=S.turn`);const pick=()=>run(`turnPrompt('打坐',${JSON.stringify(J)})`).match(/【人物名册[^】]*】\n([\s\S]*?)\n【/)[1];const a=pick();add(run,{name:'林月',relation:'朋友'});run(`S.npcs[1].lastSeen=S.turn;S.scene.present=['林月']`);const b=pick();assert.ok(b.startsWith(a));assert.match(b,/林月/);});
t('名册：没定的项写「未定」，人物谱写还缺哪几样',()=>{const {run}=mk();run(`S.npcs.push(normNpc({name:'王五',gender:'男',age:30,realm:'炼气三阶',stub:true,stubG:true,alive:true}));S.npcs[0].lastSeen=S.turn`);const p=run(`turnPrompt('打坐',${JSON.stringify(J)})`);const cen=p.match(/【人物名册[^】]*】\n([\s\S]*?)\n【/)[1];assert.match(cen,/王五｜男｜年龄未定｜境界未定/);assert.match(p.match(/【人物谱[^】]*】\n([\s\S]*?)\n【/)[1],/还缺 age、realm、personality、appearance、secret/);});
t('师门名册：没入门写明没有师父；入了门列出师父和同门',()=>{const {run}=mk();let p=run(`turnPrompt('打坐',${JSON.stringify(J)})`);assert.match(p,/【师门】主角尚无师门，也没有师父/);
  run(`S.player.faction='青云宗';syncSect();`);add(run,{name:'苏长老',relation:'师父',faction:'青云宗',realm:'金丹初期'});add(run,{name:'沈清',relation:'师妹',faction:'青云宗'});p=run(`turnPrompt('打坐',${JSON.stringify(J)})`);assert.match(p,/【师门名册[^】]*】青云宗；师父：苏长老/);assert.match(p,/沈清（师妹/);});

// 判定、面谈、文风
await ta('判定没成、正文写成了：标记改结尾，改完换正文和摘要',async()=>{const {run,val}=mk();run(`updateChapterNarrative=()=>{};callLLM=async()=>JSON.stringify({narrative:'掌柜摇了摇头，把灵石推了回来，说什么也不卖。'.repeat(4),summary:'没买成'});`);
  await run(`(async()=>{const j={fate:10,check:{success:false,attr:'谈吐',kind:'说服',need:70,roll:3}};window.__d=validateTurn({narrative:'掌柜被他说动，把丹卖给了他。'.repeat(4),summary:'买到了',check:{success:true}},'说服掌柜',j,S);await fixCheckText(window.__d);})()`);
  assert.equal(val('window.__d.checkFix'),true);assert.match(val('window.__d.narrative'),/推了回来/);assert.equal(val('window.__d.summary'),'没买成');});
await ta('判定改结尾：模型回得太短就保留原文',async()=>{const {run,val}=mk();run(`updateChapterNarrative=()=>{};callLLM=async()=>JSON.stringify({narrative:'没成。'});`);await run(`(async()=>{window.__d={narrative:'掌柜被他说动，把丹卖给了他。'.repeat(4),summary:'s',checkFix:true};await fixCheckText(window.__d);})()`);assert.match(val('window.__d.narrative'),/说动/);});
await ta('面谈成败写反：打回重写，第二份对了就收',async()=>{const {run,val}=mk();add(run,{name:'沈清'});run(`var k=0;callLLM=async()=>{k++;return JSON.stringify(k===1?{reply:'行，借你。',attempt:{success:true}}:{reply:'不借。',attempt:{success:false}});};`);
  const d=await run(`llmJSON('x',null,{validate:(d,o)=>validateConvo(d,S.npcs[0],{type:'讨要',attr:'谈吐',need:55,roll:2,total:20,success:false},o)})`);assert.equal(run('k'),2);assert.equal(d.reply,'不借。');});
await ta('文风：禁用词由程序删掉，不重写（10-09）',async()=>{const {run}=mk();const bw=run('styleBanned().filter(w=>w.length>=2).slice(0,3)');run(`var k=0;callLLM=async()=>{k++;return JSON.stringify({narrative:(${JSON.stringify(bw.join('，'))}+'。他走到门口，看了看天色，又回身把灯拨亮。').repeat(12),summary:'s'});};`);const d=await run(`llmJSON('x',null,{style:{field:'narrative',kind:'turn'}})`);assert.equal(run('k'),1);for(const w of bw) assert.ok(!d.narrative.includes(w),w);});

// 人物资料
t('补面板不掷骰：同一段剧情换随机种子，结果一样',()=>{const out=[];for(const seed of [1,99,12345]){const {val}=mk({seed});out.push(val(`validateTurn({narrative:'王五拱了拱手。',summary:'s',npcUpdates:[{name:'王五',好感度:3}]},'问路',{fate:10},S).newNpcs[0]`));}assert.deepEqual(out[0],out[1]);assert.deepEqual(out[1],out[2]);assert.equal(out[0].stub,true);assert.equal(out[0].stubR,false);assert.equal(out[0].stubA,false);});
t('补面板有证据就用：写了「十六岁」「筑基初期」「她」',()=>{const {val}=mk();const o=val(`validateTurn({narrative:'陆雪琪今年十六岁，已是筑基初期，她冷着脸不说话。',summary:'s',npcUpdates:[{name:'陆雪琪'}]},'走',{fate:10},S).newNpcs[0]`);assert.equal(o.age,16);assert.equal(o.realm,'筑基初期');assert.equal(o.gender,'女');assert.ok(o.stubG&&o.stubA&&o.stubR);});
t('模型的 newNpcs 漏写境界：标未定，面板显示未知',()=>{const {run,val}=mk();T(run,`{narrative:'李铁匠递过一把刀。',summary:'s',newNpcs:[{name:'李铁匠',gender:'男',age:40,identity:'铁匠'}]}`);const n=val(`S.npcs.find(n=>n.name==='李铁匠')`);assert.equal(n.stub,false);assert.equal(val(`realmText(S.npcs.find(n=>n.name==='李铁匠').realm)`),'凡人');/* 铁匠是凡人字眼，算证据 */
  T(run,`{narrative:'孙道人点点头。',summary:'s',newNpcs:[{name:'孙道人',gender:'男',age:50,identity:'云游客'}]}`);const m=val(`S.npcs.find(n=>n.name==='孙道人')`);assert.equal(m.stub,true);assert.equal(m.stubR,false);assert.equal(run(`unkOf(S.npcs.find(n=>n.name==='孙道人'),'R')`),true);});
t('玩家括号写明的关系，模型再改不收；改成道侣可以',()=>{const {run,val}=mk();T(run,`{narrative:'陆雪琪跟了上来。',summary:'s',newNpcs:[{name:'陆雪琪',gender:'女',age:20,realm:'筑基初期',identity:'散修',relation:'师妹'}]}`,'带上陆雪琪(20岁，女，筑基初期，师妹)');
  T(run,`{narrative:'陆雪琪笑了。',summary:'s',npcUpdates:[{name:'陆雪琪',relation:'表妹'}]}`);assert.equal(val(`S.npcs.find(n=>n.name==='陆雪琪').relation`),'师妹');
  T(run,`{narrative:'陆雪琪与他结为道侣。',summary:'s',npcUpdates:[{name:'陆雪琪',relation:'道侣'}]}`);assert.equal(val(`S.npcs.find(n=>n.name==='陆雪琪').relation`),'妻子');});
t('玩家括号写明的境界，模型再往上改不收',()=>{const {run,val}=mk();T(run,`{narrative:'陆雪琪跟了上来。',summary:'s',newNpcs:[{name:'陆雪琪',gender:'女',age:16,realm:'筑基初期',identity:'散修'}]}`,'带上陆雪琪(16岁，女，筑基初期)');T(run,`{narrative:'陆雪琪突破了。',summary:'s',npcUpdates:[{name:'陆雪琪',realm:'筑基中期'}]}`);assert.equal(val(`realmText(S.npcs.find(n=>n.name==='陆雪琪').realm)`),'筑基初期');});

// 人脉
t('人脉：娘改不成师父',()=>{const {run,val}=mk();add(run,{name:'韩母',relation:'母亲',age:45,realm:'凡人'});T(run,`{narrative:'韩母收他为徒，行了拜师礼。',summary:'s',npcUpdates:[{name:'韩母',relation:'师父'}]}`);assert.equal(val(`S.npcs[0].relation`),'母亲');assert.match(val('lastDeltas["修正"]'),/血亲/);});
t('人脉：路人改不成青梅竹马、旧识',()=>{const {run,val}=mk();add(run,{name:'沈清',relation:'萍水相逢'});T(run,`{narrative:'沈清笑道我们小时候见过。',summary:'s',npcUpdates:[{name:'沈清',relation:'青梅竹马'}]}`);assert.equal(val(`S.npcs[0].relation`),'萍水相逢');T(run,`{narrative:'x',summary:'s',npcUpdates:[{name:'沈清',relation:'旧识'}]}`);assert.equal(val(`S.npcs[0].relation`),'萍水相逢');});
t('人脉：路人变朋友、仇人可以',()=>{const {run,val}=mk();add(run,{name:'沈清',relation:'萍水相逢'});T(run,`{narrative:'两人喝了顿酒。',summary:'s',npcUpdates:[{name:'沈清',relation:'朋友'}]}`);assert.equal(val(`S.npcs[0].relation`),'朋友');T(run,`{narrative:'翻脸了。',summary:'s',npcUpdates:[{name:'沈清',relation:'仇人'}]}`);assert.equal(val(`S.npcs[0].relation`),'仇人');});
t('人脉：没有拜师经过，不能变师父；行动里拜师了就可以',()=>{const {run,val}=mk();add(run,{name:'孙道人',relation:'萍水相逢',gender:'男'});T(run,`{narrative:'孙道人指点了几句。',summary:'s',npcUpdates:[{name:'孙道人',relation:'师父'}]}`,'向孙道人请教');assert.equal(val(`S.npcs[0].relation`),'萍水相逢');T(run,`{narrative:'孙道人受了他三个头。',summary:'s',npcUpdates:[{name:'孙道人',relation:'师父'}]}`,'跪下拜孙道人为师');assert.equal(val(`S.npcs[0].relation`),'师父');});
t('人脉：别人的宗门不乱改；正文写了他改投就改',()=>{const {run,val}=mk();add(run,{name:'沈清',faction:'青云宗',identity:'青云宗弟子'});T(run,`{narrative:'沈清陪他逛坊市。',summary:'s',npcUpdates:[{name:'沈清',faction:'合欢宗',identity:'合欢宗弟子'}]}`);assert.equal(val(`S.npcs[0].faction`),'青云宗');assert.equal(val(`S.npcs[0].identity`),'青云宗弟子');
  T(run,`{narrative:'沈清叛出青云宗，改投合欢宗。',summary:'s',npcUpdates:[{name:'沈清',faction:'合欢宗',identity:'合欢宗弟子'}]}`);assert.equal(val(`S.npcs[0].faction`),'合欢宗');});

// 师门
t('师门：拜访长老时模型把主角写进门下，不收；原有宗门也不算叛出',()=>{const {run,val}=mk();T(run,`{narrative:'苏长老将他收入门下。',summary:'s',playerChanges:{faction:'青云宗'}}`,'去青云宗拜访苏长老');assert.equal(val('S.player.faction'),'散修');assert.equal(val('S.sect'),null);assert.match(val('lastDeltas["修正"]'),/没有拜师入门的经过/);
  run(`S.player.faction='青云宗';syncSect();`);T(run,`{narrative:'他在合欢宗做客，被收为弟子。',summary:'s',playerChanges:{faction:'合欢宗'}}`,'去合欢宗做客');assert.equal(val('S.player.faction'),'青云宗');assert.equal(val('S.sect.name'),'青云宗');});
t('师门：行动里写了拜入，就收',()=>{const {run,val}=mk();T(run,`{narrative:'入了青云宗。',summary:'s',playerChanges:{faction:'青云宗'}}`,'拜入青云宗');assert.equal(val('S.player.faction'),'青云宗');});
t('师门：编出来的宗门不进势力表',()=>{const {run,val}=mk();T(run,`{narrative:'他成了天剑阁弟子。',summary:'s',playerChanges:{faction:'天剑阁'}}`,'在山里打猎');assert.ok(!val('S.world.factions.map(f=>f.name)').includes('天剑阁'));});

// 读档补救
t('读档：模型改掉的关系，玩家括号写明过的改回来',()=>{const {run,val}=mk();run(`(()=>{const s=JSON.parse(JSON.stringify(S));s.npcs=[normNpc({name:'陆雪琪',gender:'女',age:16,realm:'筑基初期',relation:'旧识',alive:true})];s.history=[{turn:1,action:'带上陆雪琪(16岁，女，筑基初期，师妹)',summary:'x'}];delete s.decreeFix1;delete s.relFix1;delete s.origRel;migrate(s);window.__s=s;})()`);assert.equal(val('window.__s.npcs[0].relation'),'师妹');assert.equal(val('window.__s.origRel["陆雪琪"]'),'师妹');});

console.log(`\n${n} 项通过`);
})().catch(e=>{console.error(e);process.exit(1);});
