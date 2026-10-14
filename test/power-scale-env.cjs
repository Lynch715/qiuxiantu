const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
module.exports=function environment(file=path.join(__dirname,'../index.html')){
  const html=fs.readFileSync(file,'utf8');
  const src=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n').split('/* ================= 界面事件 ================= */')[0];
  const elements=new Map(),el=()=>({classList:{toggle(){},add(){},remove(){},contains(){return false;}},addEventListener(){},querySelectorAll:()=>[],querySelector:()=>el(),appendChild(){},remove(){},innerHTML:'',textContent:'',value:'',style:{},dataset:{},focus(){},scrollIntoView(){},insertAdjacentHTML(){}});
  let seed=137;const math=Object.create(Math);math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const c=vm.createContext({console,Math:math,window:{addEventListener(){}},document:{getElementById:id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);},querySelectorAll:()=>[],addEventListener(){},createElement:el},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>0,clearTimeout(){},AbortController});
  vm.runInContext(src,c);
  const run=code=>vm.runInContext(code,c),val=code=>JSON.parse(JSON.stringify(run(code)));
  const mock=require('./xian-mock');
  run(`saveGame=()=>{};toast=()=>{};applyInit(${JSON.stringify(mock.pickBody('现在请生成这位主角并开局'))},{});applyWorld(${JSON.stringify(mock.pickBody('请为这片修真大陆铸造当世格局'))});S.player.tags=[];S.player.hp=100;S.player.scarPower=0;S.player.items['法器']=[];`);
  return {run,val,elements,seed:n=>seed=n};
};
