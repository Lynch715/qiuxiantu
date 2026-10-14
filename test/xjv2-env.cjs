// 仙界第二版（X7–X10）无头测试共用：把 index.html 的引擎部分装进 vm，给一个已飞升的局
const fs=require('fs'),vm=require('vm'),path=require('path');
function env(file,seed0){
  const html=fs.readFileSync(file||path.join(__dirname,'../index.html'),'utf8');
  const src=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n').split('/* ================= 界面事件 ================= */')[0];
  const el=()=>({classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll:()=>[],querySelector:()=>el(),appendChild(){},remove(){},innerHTML:'',textContent:'',value:'',style:{},dataset:{}});
  let seed=seed0||31;const math=Object.create(Math);math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
  const c=vm.createContext({console,window:{addEventListener(){}},document:{getElementById:el,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},createElement:el,body:{appendChild(){}}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>0,clearTimeout(){},Math:math,AbortController});
  vm.runInContext(src,c);
  const run=s=>vm.runInContext(s,c), val=s=>{ const v=run(s); return v===undefined?null:JSON.parse(JSON.stringify(v)); };
  run('if(typeof toast==="undefined") globalThis.toast=function(){};');
  // 让下一次 Math.random() 返回定值（用完恢复）
  const force=(v,fn)=>{ const old=math.random; math.random=()=>v; try{ return fn(); } finally{ math.random=old; } };
  return {run,val,force,math};
}
const NPC=(name,realm,rel,fav,age,extra)=>`normNpc(Object.assign({name:'${name}',gender:'女',age:${age||600},realm:'${realm}',identity:'修士',faction:'青云宗',secret:'无',personality:['温和'],appearance:'青衣',relation:'${rel}','好感度':${fav},alive:true},${extra||'{}'}))`;
const BASE=`saveGame=()=>{};renderPanel=()=>{};renderOptions=()=>{};S=newStateShell();S.freedom='mid';S.player={name:'韩七',gender:'男',age:1900,hp:100,money:20000,attributes:{谈吐:50},声望:30,凶名:0,faction:'青云宗',status:[],arts:[],items:{法器:[],玉简:[],丹药:[],符箓:[],毒药:[],灵材:[],其他:[]},skills:{},personality:['谨慎'],backstory:'药农人家出身'};
xianAttach(S.player);S.player.tags=[];S.player.attributes['心性']=50;S.player.attributes['悟性']=50;S.player.realm=parseRealm('大乘后期');syncPower(S.player);
S.world={factions:[{name:'青云宗',alignment:'正派',power:70,leader:'某',desc:''}],ranking:[],events:[]};worldState();S.sect={name:'青云宗',contrib:500,joined:1};
S.npcs.push(${NPC('沈清','化神中期','妻子',90)});S.npcs.push(${NPC('路人乙','筑基初期','相识',30,60)});
relSet('韩七','沈清','夫妻','结为夫妻');S.scene={location:'青云宗后山',present:[],unresolved:[]};S.date=dateStr();`;
// 飞升到仙界：落在一个有仙庭、有两家仙宗的仙界
const XW=`{land:{name:'太玄仙域',desc:'仙气浓'},arrival:{place:'接引城',desc:'飞升台'},factions:[{name:'紫霄仙庭',alignment:'中立',power:95,leader:'昊明',desc:'统御四方'},{name:'太微仙宗',alignment:'正派',power:82,leader:'云中君',desc:'剑道'},{name:'玄都仙府',alignment:'正派',power:74,leader:'玄都子',desc:'丹道'},{name:'幽冥魔域',alignment:'邪道',power:75,leader:'血河',desc:'魔仙'}],ranking:[{name:'昊明',realm:'太乙金仙初期',faction:'紫霄仙庭'},{name:'云中君',realm:'金仙后期',faction:'太微仙宗'},{name:'血河老祖',realm:'金仙中期',faction:'幽冥魔域'},{name:'玄都子',realm:'金仙初期',faction:'玄都仙府'},{name:'白素',realm:'玄仙后期',faction:'太微仙宗'}],events:['仙庭清查飞升者']}`;
const UP=`S.player.realm=parseRealm('地仙初期');syncPower(S.player);S.pendingAscend=true;performAscension(${XW},null);S.player.items['法器']=[];`;
module.exports={env,NPC,BASE,UP,XW};
