// Local-only browser harness: synthetic save and SSE responses, no external model or credentials.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),env=require('./power-scale-env.cjs');
const root=path.join(__dirname,'..'),e=env(),save=e.val('S');let retryPending=true;
const harness=`<div class="mbtnrow"><button type="button" id="cacheKnown">模拟面谈</button><button type="button" id="cacheUnknown">模拟无统计</button><button type="button" id="cacheRetry">模拟网络重试</button></div><p id="cacheFixtureResult" class="note">本地模拟响应，不连接外部模型</p>`;
http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/chat/completions'){
  let data='';req.on('data',c=>data+=c);req.on('end',()=>{
   const body=JSON.parse(data),prompt=body.messages.at(-1).content;
   if(prompt==='retry'&&retryPending){retryPending=false;res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":{"message":"fixture retry"}}');return;}
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
   res.write('data: '+JSON.stringify({choices:[{delta:{content:'{"reply":"已收到。"}'},finish_reason:null}]})+'\n\n');
   res.end('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}],...(prompt==='unknown'?{}:{usage:{prompt_tokens:1000,completion_tokens:12,prompt_cache_hit_tokens:800,prompt_cache_miss_tokens:200}})})+'\n\ndata: [DONE]\n\n');
  });return;
 }
 if(pathname==='/'){
  let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const boot='async function boot(){';
  html=html.replace('<div id="llmMetrics" aria-live="polite"></div>',harness+'<div id="llmMetrics" aria-live="polite"></div>');
  if(!html.includes(boot))throw new Error('浏览器模拟入口需要更新');
  html=html.replace(boot,boot+`  S=migrate(${JSON.stringify(save)});storageProtected=false;cfg={base:'http://127.0.0.1:8982',key:'local-fixture-only',model:'fixture-model',think:false};showGame();openSettings();
    for(const [id,prompt,kind] of [['cacheKnown','known','talk'],['cacheUnknown','unknown','classify'],['cacheRetry','retry','turn']])$(id).onclick=async()=>{try{const raw=await callLLM(prompt,null,{kind});$('cacheFixtureResult').textContent='模拟响应完成：'+raw;}catch(e){$('cacheFixtureResult').textContent=e.message;}};if(window.xianStartup)window.xianStartup.ready();return;`);
  res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end(html);return;
 }
 if(/^\/avatars\/[\w.-]+\.png$/.test(pathname)){const file=path.join(root,pathname);if(fs.existsSync(file)){res.writeHead(200,{'Content-Type':'image/png'});fs.createReadStream(file).pipe(res);return;}}
 res.writeHead(404);res.end();
}).listen(8982,'127.0.0.1',()=>console.log('Cache browser QA http://127.0.0.1:8982/'));
