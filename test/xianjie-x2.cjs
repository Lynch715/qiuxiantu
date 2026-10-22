// 仙界扩展 X2：双界架构。用法：node test/xianjie-x2.cjs
// 1) 当前提示词的下界约束；长期演化检查时间及两界隔离；2) 换界、后台跑、信匣、牵挂、迁移；3) 两界连跑 3000 个月计时
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const NEW=path.join(__dirname,'../index.html');
function env(file,seed0){
  const html=fs.readFileSync(file,'utf8');
  const src=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n').split('/* ================= 界面事件 ================= */')[0];
  const el=()=>({classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll:()=>[],querySelector:()=>el(),appendChild(){},remove(){},innerHTML:'',textContent:'',value:''});
  let seed=seed0||12345;const math=Object.create(Math);math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
  const c=vm.createContext({console,window:{addEventListener(){}},document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){},createElement:el},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>0,clearTimeout(){},Math:math,AbortController});
  vm.runInContext(src,c);
  const run=s=>vm.runInContext(s,c), val=s=>JSON.parse(JSON.stringify(run(s)));
  return {run,val};
}
const FIX=`saveGame=()=>{};S=newStateShell();S.freedom='mid';S.player={name:'韩七',gender:'男',age:60,hp:100,money:1000,attributes:{谈吐:50},声望:0,凶名:0,faction:'青云宗',status:[],arts:[{name:'长春功',style:'护体',level:20,grade:'黄阶中品'}],items:{法器:[],玉简:[],丹药:[],符箓:[],毒药:[],灵材:[],其他:[]},skills:{},personality:['谨慎'],backstory:'药农人家出身'};
xianAttach(S.player);S.player.tags=['谨小慎微'];S.player.realm=parseRealm('金丹中期');syncPower(S.player);
S.world={factions:[],ranking:[],events:[]};
for(let i=0;i<6;i++) S.world.factions.push({name:'宗门'+i,alignment:i%3?'正派':'邪道',power:30+i*8,leader:'宗主'+i,desc:'一座有些年头的宗门'});
for(let i=0;i<10;i++) S.world.ranking.push({name:'榜人'+i,gender:'男',faction:'宗门'+(i%6),'武功':80-i,realm:{major:3,minor:1},note:'一手剑诀',alive:true,age:200});
worldState(); S.sect={name:'宗门1',contrib:120,joined:1};
for(let i=0;i<24;i++) S.npcs.push(normNpc({name:'人物'+i,gender:i%2?'女':'男',age:30+i,realm:['筑基中期','金丹初期','元婴初期','大乘后期'][i%4],identity:'宗门弟子',faction:'宗门'+(i%6),secret:'有个秘密',personality:['谨慎'],appearance:'寻常',relation:i===0?'妻子':(i===1?'女儿':'同门'),'好感度':60,alive:true}));
relSet('韩七','人物0','夫妻','结为夫妻'); S.npcs[1].parents={father:'韩七',mother:'人物0'};
for(let i=0;i<4;i++) S.quests.push({title:'心愿'+i,desc:'一桩要花好些年才办得成的事',status:'进行中',progress:30});
for(let i=0;i<12;i++){S.turn++;S.history.push({turn:S.turn,action:'去坊市'+i,summary:'买了丹药'+i,narrative:'他走了一趟坊市。'.repeat(20)});}
S.scene={location:'坊市',present:['人物2','人物3'],unresolved:['还人情']};S.date=dateStr();`;
const PROMPTS=`(convo={npc:S.npcs[2],msgs:[{role:'me',text:'道友近来可好'},{role:'npc',text:'还过得去。'}],gains:[]},[styleSystem(),turnPrompt('去坊市逛逛',{fate:10,months:1,check:null}),convoPrompt(S.npcs[2],'近来可好',null,null)].join('\\n#####\\n'))`;
let n=0; const t=(name,fn)=>{fn();n++;console.log('✓ '+name);};

t('飞升前：当前提示词只含下界人物、规则和时间',()=>{
  const B=env(NEW,777);B.run(FIX);
  for(const months of [0,24]){
    if(months)B.run(`S.player.cultMode='闭关';advanceTime(${months});S.turn++;S.date=dateStr();`);
    const p=B.run(PROMPTS);assert(!/【仙庭】|【天人五衰】|【仙界规矩】/.test(p));assert(p.includes('【事实与结算约束】'));assert(p.includes('宗门3'));assert(p.includes('人物2'));assert.equal(B.val('S.plane===undefined&&S.planes===undefined'),true);
  }
  assert.equal(B.val('S.elapsedDays'),720);assert.equal(B.val('S.player.age'),62);

});

const {run,val}=env(NEW,4242);
const toXian=`run0=null; S.player.realm=parseRealm('地仙初期');S.player.lingli=0;syncPower(S.player); switchPlane('仙界'); S.world={factions:[{name:'太微仙宗',alignment:'正派',power:70,leader:'某仙君',desc:'仙界大宗'}],ranking:[{name:'玄霄',gender:'男',faction:'太微仙宗','武功':90,realm:{major:13,minor:1},note:'仙榜第一',alive:true,age:90000}],events:[]}; worldState(); S.scene={location:'飞升台',present:[],unresolved:[]};`;
t('换界：本界整套封存，仙界从空白起；换回来原样还原',()=>{
  run(FIX); const before=val('({w:S.world.factions.length,n:S.npcs.length,sect:S.sect,f:S.player.faction,scene:S.scene})');
  run(toXian);
  assert.equal(val('curPlane()'),'仙界'); assert.equal(val('S.npcs.length'),0); assert.equal(val('S.sect'),null); assert.equal(val('S.player.faction'),'散修');
  assert.equal(val('S.planes.下界.npcs.length'),24); assert.equal(val('S.planes.下界.sect.name'),'宗门1'); assert.equal(val('S.planes.下界.playerFaction'),'青云宗');
  run(`S.npcs.push(normNpc({name:'白瑶',gender:'女',age:5000,realm:'天仙初期',identity:'接引殿仙吏',faction:'仙庭',secret:'无',personality:['冷淡'],appearance:'白衣',relation:'萍水相逢','好感度':30,alive:true}))`);
  run(`switchPlane('下界')`); const back=val('({w:S.world.factions.length,n:S.npcs.length,sect:S.sect,f:S.player.faction,scene:S.scene})');
  assert.deepEqual(back,before); assert.equal(val('S.planes.仙界.npcs[0].name'),'白瑶');
  run(`switchPlane('仙界')`); assert.equal(val('S.npcs[0].name'),'白瑶'); assert.equal(val('S.scene.location'),'飞升台');
});
t('后台跑：下界的人照样长岁数、修炼；风闻进下界信匣，不进本回合',()=>{
  run(FIX); run(toXian);
  const age0=val('S.planes.下界.npcs[5].age'), m0=val('S.player.money');
  run(`S.player.cultMode='闭关';S.engineNews=[];advanceTime(120)`);
  assert.equal(val('S.planes.下界.npcs[5].age'),age0+10);
  assert.equal(val('S.npcs.length'),0,'下界的人不会跑到仙界人物表里');
  assert.ok(val('S.planes.下界.mail.length')>0,'下界信匣有消息');
  const cur=val('S.engineNews'), mail=val('S.planes.下界.mail');
  for(const x of cur) assert.ok(!mail.includes(x)||/开山收徒/.test(x)===false,'本回合风闻混进了下界的事：'+x);
  assert.ok(!cur.some(x=>/人物\d/.test(x)&&!/^下界来信：/.test(x)),'本回合风闻里出现了下界的人（下界来信除外）：'+cur.join('；'));
  assert.ok(val('S.player.money')<=m0,'下界宗门月例、礼物不该进主角腰包');
  assert.equal(val('S.player.faction'),'散修'); assert.equal(val('curPlane()'),'仙界'); assert.equal(val('!!S._bg'),false);
});
t('后台跑：下界的道侣不会怀上主角的孩子，主角也不会收到下界的礼',()=>{
  run(FIX); run(`S.npcs[0]['爱恋值']=90; S.npcs.forEach(x=>x['好感度']=95);`); run(toXian);
  run(`S.player.cultMode='闭关';S.player.items['丹药']=[];S.player.items['灵材']=[];advanceTime(600)`);
  assert.ok(!val(`S.planes.下界.npcs.some(x=>x.preg&&x.preg.with==='韩七')`)); assert.equal(val(`S.planes.下界.npcs[0].preg?1:0`),0);
  assert.equal(val(`(S.player.items['丹药']||[]).length+(S.player.items['灵材']||[]).length`),0);
});
t('仙界提示词：只装仙界的人和格局；下界至亲只给一小段牵挂',()=>{
  run(FIX); run(toXian); run(`S.npcs.push(normNpc({name:'白瑶',gender:'女',age:5000,realm:'天仙初期',identity:'接引殿仙吏',faction:'仙庭',secret:'无',personality:['冷淡'],appearance:'白衣',relation:'萍水相逢','好感度':30,alive:true}));S.scene.present=['白瑶'];`);
  const p=run(`turnPrompt('四处看看',{fate:10,months:1,check:null})`);
  assert.ok(p.includes('白瑶')); assert.ok(p.includes('太微仙宗')); assert.ok(!p.includes('宗门3')&&!p.includes('榜人0'),'下界的势力、榜单漏进来了');
  assert.ok(p.includes('【下界牵挂（')); const blk=p.slice(p.indexOf('【下界牵挂（'),p.indexOf('【下界牵挂（')+600);
  assert.ok(blk.includes('人物0')&&blk.includes('人物1')); assert.ok(!p.includes('人物5'),'不亲近的下界人漏进来了');
  assert.ok(!/人物2[^0-9]/.test(p));
});
t('把人挪到另一界：飞升上来的人进仙界人物表，下界表里没了',()=>{
  run(FIX); run(toXian); run(`moveNpcToPlane(S.planes.下界.npcs.find(x=>x.name==='人物0'),'仙界')`);
  assert.ok(val(`S.npcs.some(x=>x.name==='人物0')`)); assert.ok(!val(`S.planes.下界.npcs.some(x=>x.name==='人物0')`));
  run(`moveNpcToPlane(findNpc('人物0'),'下界')`); assert.ok(val(`S.planes.下界.npcs.some(x=>x.name==='人物0')`)); assert.ok(!val(`S.npcs.some(x=>x.name==='人物0')`));
});
t('存档：两界都能存能读；旧档里「已飞升」的迁成地仙初期并挂上待飞升',()=>{
  run(FIX); run(toXian); const js=run('JSON.stringify(S)'); run(`S=JSON.parse(${JSON.stringify(js)});migrate(S)`);
  assert.equal(val('curPlane()'),'仙界'); assert.equal(val('S.planes.下界.npcs.length'),24);
  run(FIX); run(`S.v=12;S.player.realm={major:7,minor:3,perfect:false,ascended:true};S.npcs[3].realm={major:7,minor:3,perfect:false,ascended:true};migrate(S)`);
  assert.equal(val('realmText(S.player.realm)'),'地仙初期'); assert.equal(val('S.pendingAscend'),true); assert.equal(val('realmText(S.npcs[3].realm)'),'地仙初期'); assert.equal(val('S.v'),val('SAVE_VERSION'));
});
t('两界连跑 3000 个月：不报错，记下耗时',()=>{
  run(FIX); run(`for(let i=0;i<16;i++) S.npcs.push(normNpc({name:'下界人'+i,gender:i%2?'女':'男',age:20+i,realm:'炼气五阶',identity:'散修',faction:'散修',secret:'无',personality:['谨慎'],appearance:'寻常',relation:'相识','好感度':40,alive:true}))`);
  run(toXian); run(`for(let i=0;i<15;i++) S.npcs.push(normNpc({name:'仙人'+i,gender:i%2?'女':'男',age:3000+i*100,realm:['地仙中期','天仙初期','真仙后期'][i%3],identity:'仙宗弟子',faction:'太微仙宗',secret:'无',personality:['冷淡'],appearance:'寻常',relation:'相识','好感度':30,alive:true}))`);
  run(`S.player.cultMode='闭关'`);
  const t0=Date.now(); for(let k=0;k<25;k++) run('advanceTime(120)'); const ms=Date.now()-t0;
  console.log(`   3000 个月耗时 ${ms} ms（每月 ${(ms/3000).toFixed(2)} ms）；下界存活 ${val('S.planes.下界.npcs.filter(x=>x.alive!==false).length')} 人，仙界存活 ${val('S.npcs.filter(x=>x.alive!==false).length')} 人`);
  assert.equal(val('curPlane()'),'仙界'); assert.ok(ms<30000,'太慢：'+ms);
});
console.log(`\n${n} 项通过`);
