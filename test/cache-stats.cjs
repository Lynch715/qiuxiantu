const assert=require('node:assert/strict'),env=require('./power-scale-env.cjs');
const tests=[],test=(n,f)=>tests.push([n,f]);
function setup(){
 const e=env(),store=new Map(),calls=[];let clock=0,queue=[];
 const inject=e.run('values=>Object.assign(globalThis,values)');
 inject({TextDecoder,performance:{now:()=>clock},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},setTimeout:(fn,ms)=>{if(ms===1500||ms===4000)queueMicrotask(fn);return 0;},fetch:async(url,options)=>{calls.push(JSON.parse(options.body));const next=queue.shift();if(next instanceof Error)throw next;return next;}});
 e.run("cfg.key='TEST_KEY_MUST_NOT_PERSIST';cfg.base='https://example.invalid';cfg.model='deepseek-test';");
 const stream=(chunks)=>({ok:true,body:{getReader:()=>{let i=0;return {read:async()=>{clock+=100;return i<chunks.length?{value:new TextEncoder().encode(chunks[i++]),done:false}:{done:true};}};}}});
 const chunk=(content,usage,finish)=>'data: '+JSON.stringify({choices:[{delta:{content},finish_reason:finish||null}],...(usage?{usage}:{})})+'\n\n';
 return {...e,store,calls,inject,chunk,stream,enqueue:r=>queue.push(r),send:async(options={})=>e.run('options=>callLLMOnce("PROMPT_MUST_NOT_PERSIST",null,options)')(options),rows:()=>e.val('llmMetrics()')};
}
test('DeepSeek 末包用量和分片正文完整保留，首字不算思考片段',async()=>{const e=setup();e.enqueue(e.stream(['data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n',e.chunk('{"reply":"你好"}'),e.chunk('',{prompt_tokens:100,completion_tokens:10,prompt_cache_hit_tokens:80,prompt_cache_miss_tokens:20},'stop')]));assert.equal(await e.send({kind:'talk'}),'{"reply":"你好"}');assert.deepEqual(e.rows().map(r=>[r.hit,r.miss,r.firstTextMs,r.durationMs,r.status]),[[80,20,200,400,'returned']]);assert.equal(e.run('lastFinish'),'stop');assert.equal(e.calls.length,1);assert.equal(e.calls[0].stream_options,undefined);assert.equal(e.calls[0].temperature,e.run('styleTemp()'));assert.equal(e.calls[0].messages.length,2);});
test('兼容独立 usage 包、跨网络分片和没有末尾换行',async()=>{const e=setup(),text=e.chunk('中文')+'data: '+JSON.stringify({choices:[],usage:{prompt_tokens:200,completion_tokens:8,prompt_tokens_details:{cached_tokens:100}}});e.enqueue(e.stream([text.slice(0,19),text.slice(19,71),text.slice(71)]));assert.equal(await e.send(),'中文');assert.equal(e.rows()[0].hit,100);assert.equal(e.rows()[0].miss,100);});
test('缺少统计是 null，明确零命中是 0',async()=>{const e=setup();for(const usage of [undefined,{prompt_tokens:90,completion_tokens:2},{prompt_tokens:100,prompt_cache_hit_tokens:0,prompt_cache_miss_tokens:100}]){e.enqueue(e.stream([e.chunk('{}',usage)]));await e.send();}assert.deepEqual(e.rows().map(r=>r.hit),[null,null,0]);const s=e.val('llmMetricSummary(llmMetrics())');assert.equal(s.reported,1);assert.equal(s.ratio,0);});
test('最终用量覆盖重复包而不累加，忽略 null usage',async()=>{const e=setup();e.enqueue(e.stream([e.chunk('{}',{prompt_tokens:10,prompt_cache_hit_tokens:5}),e.chunk('',{prompt_tokens:20,prompt_cache_hit_tokens:15}),'data: {"choices":[],"usage":null}\n']));await e.send();assert.equal(e.rows()[0].input,20);assert.equal(e.rows()[0].hit,15);});
test('非法、负数、矛盾统计不伪造命中率',()=>{const e=setup();for(const u of [{prompt_tokens:10,prompt_cache_hit_tokens:11},{prompt_tokens:10,prompt_cache_hit_tokens:8,prompt_cache_miss_tokens:9},{prompt_cache_hit_tokens:-1},{prompt_cache_hit_tokens:'4'},{prompt_cache_hit_tokens:2.5}]){const r=e.run('u=>llmUsage(u)')(u);assert.equal(r.hit,null);}assert.equal(e.run('llmUsage({input_tokens:8,input_tokens_details:{cached_tokens:3}}).miss'),5);});
test('零 token 报告不产生 NaN 或虚构百分比',()=>{const e=setup();e.run("recordLlmMetric({at:1,input:0,hit:0,miss:0});");assert.equal(e.run('llmMetricSummary(llmMetrics()).ratio'),null);});
test('加权统计只使用完整报告，区分网络与校验重试',()=>{const e=setup();e.run("recordLlmMetric({at:1,input:100,hit:90,miss:10});recordLlmMetric({at:2,input:900,hit:90,miss:810,networkAttempt:2});recordLlmMetric({at:3,input:200,formatAttempt:2});");const s=e.val('llmMetricSummary(llmMetrics())');assert.equal(s.ratio,.18);assert.equal(s.reported,2);assert.equal(s.retries,2);});
test('网络重试仍按原预算执行，每次只记一次',async()=>{const e=setup();e.enqueue({ok:false,status:503,json:async()=>({error:{message:'unavailable'}})});e.enqueue(e.stream([e.chunk('{}')]));assert.equal(await e.run("callLLM('test',null,{kind:'turn',budget:{left:4,until:Date.now()+30000}})"),'{}');assert.deepEqual(e.rows().map(r=>[r.status,r.networkAttempt]),[['failed',1],['returned',2]]);});
test('格式重试仍使用原校验器，提示修正追加尾部',async()=>{const e=setup();e.enqueue(e.stream([e.chunk('not JSON')]));e.enqueue(e.stream([e.chunk('{"ok":true}')]));assert.equal((await e.run("llmJSON('fixed prompt',null,{kind:'talk',noRetry:true})")).ok,true);assert.deepEqual(e.rows().map(r=>r.formatAttempt),[1,2]);assert(e.calls[1].messages[1].content.startsWith(e.calls[0].messages[1].content));});
test('取消与超时不吞异常，不写原始错误信息',async()=>{const e=setup(),ac=new AbortController();e.inject({fetch:async()=>{ac.abort();throw Object.assign(new Error('secret server message'),{name:'AbortError'});}});await assert.rejects(e.send({signal:ac.signal}),/请求已取消/);assert.equal(e.rows()[0].status,'cancelled');assert(!JSON.stringify(e.rows()).includes('secret'));});
test('空回复与 HTTP 失败分类，无正文则首字未知',async()=>{const e=setup();e.enqueue(e.stream([e.chunk('',{prompt_tokens:3,prompt_cache_hit_tokens:0})]));await e.send();e.enqueue({ok:false,status:401,json:async()=>({})});await assert.rejects(e.send(),/HTTP 401/);assert.deepEqual(e.rows().map(r=>[r.status,r.firstTextMs]),[['empty',null],['failed',null]]);});
test('落盘白名单不含密钥、提示词、正文、错误、URL',async()=>{const e=setup();e.enqueue(e.stream([e.chunk('BODY_MUST_NOT_PERSIST')]));await e.send();const stored=[...e.store.values()].join('');for(const t of ['TEST_KEY','PROMPT_MUST','BODY_MUST','example.invalid'])assert(!stored.includes(t));assert.equal(e.run('JSON.stringify(S).includes("xian_llm_metrics")'),false);});
test('容量 120 条、可恢复且损坏存储安全回退',()=>{const e=setup();e.run('for(let i=0;i<125;i++)recordLlmMetric({at:i});');assert.equal(e.rows().length,120);assert.equal(e.rows()[0].at,5);e.run('llmMetricRows=null');assert.equal(e.rows().length,120);e.store.set('xian_llm_metrics_v1','broken');e.run('llmMetricRows=null');assert.equal(e.rows().length,0);});
test('存储写满或统计 UI 异常不影响回复',async()=>{const e=setup();e.inject({localStorage:{getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('quota');}}});e.run("renderLlmMetrics=()=>{throw Error('ui');};$('settingsMask').classList.contains=()=>true;");e.enqueue(e.stream([e.chunk('{"ok":true}')]));assert.equal(await e.send(),'{"ok":true}');assert.equal(e.rows().length,1);});
test('统计不消费游戏随机数',async()=>{const a=setup(),b=setup();a.enqueue(a.stream([a.chunk('{}')]));await a.send();assert.equal(a.run('Math.random()'),b.run('Math.random()'));});
test('显示未知统计并转义模型名，统计面板不展示请求内容',()=>{const e=setup();e.run('renderLlmMetrics()');assert.match(e.elements.get('llmMetrics').innerHTML,/尚无请求/);e.run('recordLlmMetric({at:1,model:"<img src=x onerror=alert(1)>",kind:"talk",status:"returned"});renderLlmMetrics()');const html=e.elements.get('llmMetrics').innerHTML;assert.match(html,/未报告/);assert(!html.includes('<img'));assert.match(html,/&lt;img/);});
test('统计标签和重试计数不进入模型请求，原有参数及消息数量保留',async()=>{
 for(const options of [{kind:'turn'},{kind:'classify',noSystem:true,maxTokens:200,temperature:.2},{kind:'talk',maxTokens:2500,networkAttempt:2,formatAttempt:3}]){
  const a=setup(),b=setup(),{kind,networkAttempt,formatAttempt,...core}=options;
  a.run('cfg.think=true');b.run('cfg.think=true');a.enqueue(a.stream([a.chunk('{}')]));b.enqueue(b.stream([b.chunk('{}')]));
  await a.send(core);await b.send(options);assert.deepEqual(b.calls[0],a.calls[0]);
  assert.equal(b.calls[0].messages.length,options.noSystem?1:2);
  for(const key of ['kind','networkAttempt','formatAttempt','cache_control'])assert.equal(b.calls[0][key],undefined);
 }
});
test('混合网络与格式重试仍共用四次请求预算',async()=>{const e=setup();e.enqueue(new Error('Failed to fetch'));for(let i=0;i<3;i++)e.enqueue(e.stream([e.chunk('invalid JSON')]));await assert.rejects(e.run("llmJSON('test',null,{kind:'turn'})"));assert.equal(e.calls.length,4);assert.equal(e.rows().length,4);assert.deepEqual(e.rows().map(r=>[r.networkAttempt,r.formatAttempt]),[[1,1],[2,1],[1,2],[1,3]]);});
test('千问官方流式请求获取末包缓存用量，正文和预算不变，非官方接口不添加参数',async()=>{
 for(const base of ['https://dashscope.aliyuncs.com/compatible-mode/v1','https://dashscope-intl.aliyuncs.com/compatible-mode/v1','https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1','https://custom.invalid/v1']){
  const e=setup();e.run('base=>{cfg.base=base;cfg.model="qwen3.8-flash";}')(base);
  const text=e.chunk('{"reply":"正文完整保留。"}')+'data: '+JSON.stringify({choices:[],usage:{prompt_tokens:200,completion_tokens:8,prompt_tokens_details:{cached_tokens:100}}})+'\n\ndata: [DONE]\n';
  e.enqueue(e.stream([text.slice(0,31),text.slice(31)]));assert.equal(await e.send(),'{"reply":"正文完整保留。"}');
  const body=e.calls[0];assert.equal(body.max_tokens,7000);assert.equal(body.temperature,e.run('styleTemp()'));assert.equal(body.cache_control,undefined);
  assert.equal(body.messages[1].content,'PROMPT_MUST_NOT_PERSIST');
  if(base.includes('custom.invalid'))assert.equal(body.stream_options,undefined);else assert.deepEqual(body.stream_options,{include_usage:true});
  assert.deepEqual([e.rows()[0].input,e.rows()[0].hit,e.rows()[0].miss],[200,100,100]);
 }
});
(async()=>{for(const [n,f] of tests){await f();console.log('✓ '+n);}console.log(tests.length+' cache statistics regressions passed');})().catch(e=>{console.error(e);process.exitCode=1;});
