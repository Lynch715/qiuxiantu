// 独立虚构局：禁止模型请求，不读写线上或用户存档。UI 验收使用真实人物、斗法、死亡结算。
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),env=require('./power-scale-env.cjs');
const root=path.resolve(__dirname,'..'),htmlFile=process.env.XIAN_HTML||path.join(root,'index.html'),e=env(htmlFile);
e.run(`S.pending=null;S.lastTurn=null;S.duelState=null;S.war=null;S.over=false;S.npcs=[];S.world.ranking=[];S.world.tianjiao=[];S.world.hidden=[];S.world.factions=[];S.world.fallen=[];S.vendettas=[];S.continuity=null;S.quests=[];S.history=[];S.recent=[];S.stats.kills=0;S.player.name='验收修士';S.player.realm=parseRealm('金丹中期');syncPower(S.player);S.scene={location:'验收山谷',present:['周试敌'],unresolved:[]};S.npcs.push(normNpc({name:'周试敌',gender:'男',age:35,realm:'筑基初期',faction:'试敌门',alignment:'中立',relation:'仇敌',location:'验收山谷',personality:['稳重'],alive:true,好感度:0}));S.world.ranking.push({name:'周试敌',realm:S.npcs[0].realm,alive:true});addVendetta('周试敌','虚构旧仇',true,90);`);
const fixture=e.val('S'),boot="  if(await loadGame()){ saveGame(); toast('已载入上次进度'); return; }";
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:18884');
 if(url.pathname==='/'){
  let html=fs.readFileSync(htmlFile,'utf8');if(!html.includes(boot))throw Error('启动标记不存在');
  html=html.replace(boot,`  saveGame=()=>{};S=migrate(${JSON.stringify(fixture)});showGame();return;`);
  html=html.replace('</body>',`<script>
    const base=${JSON.stringify(fixture)};const qa=document.createElement('div');qa.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:2000;background:#f7f1e4;border:1px solid #777;padding:8px;font-size:13px';
    qa.innerHTML='<button id="qaReset">重置虚构局</button> <button id="qaNpc">查看仇敌</button> <button id="qaYield">验收：对手认输</button> <button id="qaRestore">验收：保存并恢复</button> <button id="qaStory">验收：正文斩杀</button><div id="qaResult"></div>';document.body.append(qa);
    const result=()=>{if(!S)return;const n=findNpc('周试敌'),rank=S.world.ranking.find(x=>x.name===n.name);document.getElementById('qaResult').textContent='周试敌：'+(n.alive?'存活':'已故')+'；击杀 '+S.stats.kills+'；仇家 '+S.vendettas.length+'；榜单 '+(rank?(rank.alive===false?'已故':'存活'):'已移出')+'；死亡凭据 '+!!S.continuity?.dead[continuityKey(S,n.name)];};
    document.getElementById('qaReset').onclick=()=>{duelStop();duel=null;S=migrate(JSON.parse(JSON.stringify(base)));for(const id of ['duelMask','npcMask'])document.getElementById(id).classList.remove('on');renderPanel();result();};
    document.getElementById('qaNpc').onclick=()=>showNpc(findNpc('周试敌'));
    document.getElementById('qaYield').onclick=()=>{if(duel&&!duel.over)endDuel('oppYield');result();};
    document.getElementById('qaRestore').onclick=()=>{S=migrate(JSON.parse(JSON.stringify(S)));restoreDuel();result();};
    document.getElementById('qaStory').onclick=()=>{const j={months:0,fate:10};const d=validateTurn({narrative:'周试敌被你当场斩杀，尸身坠地。',playerChanges:{},npcUpdates:[],options:[]},'找周试敌报仇',j,S);S=settleTurnOnce(S,d,'找周试敌报仇',j,'qa-story-'+S.turn);renderPanel();result();};
    qa.addEventListener('pointerenter',result);document.addEventListener('click',()=>setTimeout(result,0));result();
  </script></body>`);
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"connect-src 'self'"});res.end(html);return;
 }
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':'application/octet-stream'});res.end(data);});
}).listen(18884,'127.0.0.1',()=>console.log('仇敌击杀验收：http://127.0.0.1:18884'));
