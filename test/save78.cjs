// T/turn 辅助函数验证最后一道宽松校验后的安全结算；严格退回路径另有明确断言。
// 10-09 夜：第 78 回存档体检修的几处——高人当面相赠、入门定位阶、按名认致敬物、宗门散了门人改散修、灵石上限写进流水账、关系一栏、定论簿。
// 用法：node test/save78.cjs     不调模型、不开浏览器。
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
const setRealm=(run,t)=>run(`S.player.realm=parseRealm('${t}');syncPower(S.player);`);

t('高人当面相赠：普通回合里元婴天师传的玄阶玉简，不压',()=>{const {run,val}=mk();setRealm(run,'筑基中期');add(run,{name:'张天师',gender:'男',age:384,realm:'元婴中期',faction:'青云宗',relation:'师父'});run(`S.scene.present=['张天师']`);
  T(run,`{narrative:'张天师从袖里取出一枚玉简，亲传给他。',summary:'s',playerChanges:{itemsAdd:{玉简:[{name:'龙虎雷印',grade:'玄阶下品',style:'攻伐'}]}}}`,'拜见张天师');assert.equal(val(`S.player.items['玉简'].find(x=>x.name==='龙虎雷印').grade`),'玄阶下品');});
t('10-10：没人送、随手捡到的，也照实记',()=>{const {run,val}=mk();setRealm(run,'筑基中期');add(run,{name:'张天师',gender:'男',age:384,realm:'元婴中期'});
  T(run,`{narrative:'他在山道边捡到一枚玉简。张天师远远看了一眼。',summary:'s',playerChanges:{itemsAdd:{玉简:[{name:'龙虎雷印',grade:'玄阶下品',style:'攻伐'}]}}}`,'下山');assert.equal(val(`S.player.items['玉简'].find(x=>x.name==='龙虎雷印').grade`),'玄阶下品');});
t('入门定位阶：正文写内门，贡献给到内门',()=>{const {run,val}=mk();T(run,`{narrative:'他拜入青云宗，录为内门弟子。',summary:'s',playerChanges:{faction:'青云宗'}}`,'拜入青云宗');assert.equal(val('S.sect.contrib'),40);});
t('入门定位阶：拜金丹以上的人为师，至少内门',()=>{const {run,val}=mk();add(run,{name:'张天师',gender:'男',age:384,realm:'元婴中期',faction:'青云宗'});T(run,`{narrative:'张天师收他为徒。',summary:'s',playerChanges:{faction:'青云宗'},npcUpdates:[{name:'张天师',relation:'师父'}]}`,'拜入青云宗，拜张天师为师');assert.equal(val('S.sect.contrib'),40);assert.equal(val('S.npcs[0].relation'),'师父');});
t('入门定位阶：正文没说，照旧从头算；入门之后不再改',()=>{const {run,val}=mk();T(run,`{narrative:'他拜入青云宗。',summary:'s',playerChanges:{faction:'青云宗'}}`,'拜入青云宗');const c0=val('S.player.linggen.mult')>=1.5?12:0;assert.equal(val('S.sect.contrib'),c0);run('S.turn++');T(run,`{narrative:'他成了内门弟子。',summary:'s'}`,'修炼');assert.equal(val('S.sect.contrib'),c0);});
t('按名认致敬物：地摊上买的《炼神口诀》就是那件致敬物',()=>{const {run,val}=mk();T(run,`{narrative:'他在地摊上买下《炼神口诀》。',summary:'s',playerChanges:{money:-60,itemsAdd:{玉简:[{name:'《炼神口诀》',grade:'黄阶上品'}]}}}`,'买玉简');assert.ok(run(`relicHas(S.player,'mindsong')`));assert.ok(run(`relicSeen().includes('mindsong')`));
  T(run,`{narrative:'又买了一本。',summary:'s',playerChanges:{itemsAdd:{玉简:[{name:'炼神口诀',grade:'黄阶上品'}]}}}`,'再买');assert.equal(val(`S.player.items['玉简'].filter(x=>x.relic==='mindsong').length`),1);});
t('按名认致敬物：不是功法的，模型写进功法栏不收',()=>{const {run,val}=mk();T(run,`{narrative:'他参透了炼神口诀。',summary:'s',playerChanges:{artsAdd:[{name:'炼神口诀',style:'神通',level:30}]}}`,'参悟');assert.ok(!val('S.player.arts').some(a=>a.name==='炼神口诀'));});
t('宗门散了：门人改成散修，身份注明原门派',()=>{const {run,val}=mk();run(`S.world.factions.push({name:'七玄门',alignment:'正派',power:1,base:20,low:5,leader:'王某',desc:''});ensureFactionMeta(S.world.factions[S.world.factions.length-1]);S.world.factions[S.world.factions.length-1].low=5;`);add(run,{name:'孙杂役',gender:'男',faction:'七玄门',identity:'七玄门药圃杂役'});
  for(let i=0;i<5&&run(`S.world.factions.some(f=>f.name==='七玄门')`);i++) run('factionYear()');assert.ok(!run(`S.world.factions.some(f=>f.name==='七玄门')`));assert.equal(val('S.npcs[0].faction'),'散修');assert.match(val('S.npcs[0].identity'),/^原七玄门/);assert.match(val('S.npcs[0].notes'),/七玄门已散/);});
t('灵石按上限入账：流水账写明以哪个为准',()=>{const {run,val}=mk();T(run,`{narrative:'清货得了三千四百块。',summary:'清货',playerChanges:{money:3400}}`,'清货');const h=val('S.history.slice(-1)[0]');assert.match(h.summary,/引擎结算：下品灵石只入账/);assert.ok(val('S.player.money')<1000+3400);});
t('关系一栏：一句话只留头一个词，后面进备注',()=>{const {run,val}=mk();add(run,{name:'甘平',relation:'萍水相逢'});T(run,`{narrative:'甘平点头。',summary:'s',npcUpdates:[{name:'甘平',relation:'朋友，丹铺的房东'}]}`);assert.equal(val('S.npcs[0].relation'),'朋友');assert.match(val('S.npcs[0].notes'),/丹铺的房东/);
  T(run,`{narrative:'x',summary:'s',newNpcs:[{name:'邢九',gender:'男',age:40,realm:'筑基初期',relation:'萍水相逢，丹铺的买主'}]}`);assert.equal(val(`S.npcs.find(n=>n.name==='邢九').relation`),'萍水相逢');});
t('定论簿：「遇到一老乞丐(元婴)」不当人名',()=>{const {run,val}=mk();run(`decreeRecord(S,'遇到一老乞丐(元婴)，又见陆雪琪(女，16岁)',1)`);const r=val('S.decrees.map(e=>e.raw)');assert.ok(!r.some(x=>/乞丐/.test(x)));assert.ok(r.some(x=>/陆雪琪$/.test(x)));});

t('性格写成一句话也不崩：入册时拆成词，老存档读档时也拆',()=>{const {run,val}=mk();T(run,`{narrative:'林木点头。',summary:'s',newNpcs:[{name:'林木',gender:'男',age:30,realm:'炼气五阶',personality:'木讷、认死理'}]}`);assert.deepEqual(val(`S.npcs.find(n=>n.name==='林木').personality`),['木讷','认死理']);run(`S.npcs.push({name:'石头',gender:'男',age:30,realm:parseRealm('炼气三阶'),alive:true,personality:'手稳，话少'})`);run(`migrate(S)`);assert.deepEqual(val(`S.npcs.find(n=>n.name==='石头').personality`),['手稳','话少']);run(`turnPrompt('打坐',{fate:10,months:1,check:null})`);});
console.log(`\n${n} 项通过`);
})().catch(e=>{console.error(e);process.exit(1);});
