// 势力消长：年度起伏、宗主更替、兴衰、大事落到真实宗门并结算、甲子冷却；附 1000 年模拟。
// 用法：node test/faction.cjs     不调模型、不开浏览器。
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


const {run,val}=env();
let count=0;function check(name,fn){fn();console.log('PASS '+name);count++;}
run(`S.player.name='韩立';S.player.age=33;S.player.gender='男';S.player.realm={major:3,minor:1,perfect:false,ascended:false};S.player.faction='七玄门';S.world.factions=[{name:'七玄门',power:53,alignment:'正派',leader:'前任'}];Math.random=()=>0;facSetLeader(S.world.factions[0],'韩立');`);
check('主角接任直接使用本人资料',()=>{assert.equal(val('realmText(S.world.factions[0].lRealm)'),'元婴初期');assert.equal(val('S.world.factions[0].lAge'),33);});
check('宗主境界副本不反向修改主角',()=>{run('S.world.factions[0].lRealm.major=2');assert.equal(val('S.player.realm.major'),3);});
check('旧数据通过世界状态修复，随后突破也同步',()=>{run(`S.world.factions[0].lAge=900;worldState();`);assert.equal(val('S.world.factions[0].lAge'),33);run(`S.player.realm.minor=2;worldState();`);assert.equal(val('realmText(S.world.factions[0].lRealm)'),'元婴中期');});
check('显式存档状态修复不误读当前全局状态',()=>{run(`var oldSave=JSON.parse(JSON.stringify(S));oldSave.player.realm={major:4,minor:1};oldSave.player.age=45;worldState(oldSave);`);assert.equal(val('realmText(oldSave.world.factions[0].lRealm)'),'化神初期');assert.equal(val('oldSave.world.factions[0].lAge'),45);assert.equal(val('S.player.age'),33);});
check('年度随机走火入魔不能替换玩家宗主',()=>{run(`S.months+=12;S.player.age=34;factionYear();`);assert.equal(val('S.world.factions[0].leader'),'韩立');assert.equal(val('S.world.factions[0].lAge'),34);assert.equal(val('S.player.realm.minor'),2);assert.ok(!val('S.engineNews.join()').includes('韩立走火入魔'));});
check('旧闭死关事件不能改写主角生死修为',()=>{run(`var oldEvent={fx:{kind:'seclude',A:'七玄门',L:'韩立'}};var autoText=facAutoResult(oldEvent);facResolve(oldEvent,'韩立坐化关中');`);assert.ok(!/坐化|破关而出/.test(val('autoText')));assert.equal(val('S.world.factions[0].leader'),'韩立');assert.equal(val('S.world.factions[0].lRealm.minor'),2);});
check('新闭死关事件排除玩家宗主',()=>{run(`S.world.factions=S.world.factions.slice(0,1);`);assert.equal(val(`fillWorldSeed(WORLD_EVENTS.findIndex(x=>x[2]==='seclude'))`),null);});
check('模型势力资料与主角实时资料一致',()=>{run(`S.world.ranking=[{name:'测试高手',realm:{major:4,minor:1},alive:true}];S.world.factions[0].lRealm={major:2,minor:1};`);const prompt=val(`stateBlocks('巡视宗门')`);assert.ok(prompt.includes('首领韩立[男,34岁,元婴中期]'));});
check('普通NPC宗主仍正常接任与死亡继位',()=>{run(`facSetLeader(S.world.factions[0],'苏长青',{major:2,minor:1},'男');S.npcs.push(normNpc({name:'苏长青',gender:'男',age:100,realm:'金丹初期',alive:false}));factionYear();`);assert.notEqual(val('S.world.factions[0].leader'),'苏长青');});
console.log(count+' checks passed');
