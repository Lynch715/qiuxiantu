// 不调用真实模型：核对服务商请求契约、密钥隔离、旧配置与存档不变。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const env=require('./power-scale-env.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const ui=html.slice(html.indexOf('function renderApiPreset(){'),html.indexOf('function applyFreedomChange(){'));
const tests=[],test=(name,fn)=>tests.push([name,fn]);
function setup(){
  const e=env(),store=new Map(),calls=[];
  e.run('v=>Object.assign(globalThis,v)')({TextDecoder,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},fetch:async(url,options)=>{
    calls.push({url,headers:options.headers,body:JSON.parse(options.body)});
    let done=false;
    return {ok:true,body:{getReader:()=>({read:async()=>{
      if(done)return {done:true};done=true;
      return {done:false,value:new TextEncoder().encode('data: {"choices":[{"delta":{"reasoning_content":"不展示思考"}}]}\n\ndata: {"choices":[{"delta":{"content":"{\\"ok\\":true}"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n')};
    }})}};
  }});
  e.run(ui+'\n'+html.slice(html.indexOf('function memNote(){'),html.indexOf("$('cfgMem').addEventListener('change'")));
  for(const id of ['cfgRegister','cfgGetKey']){
    e.run(`$('${id}')`);
    const el=e.elements.get(id);el.attrs={};el.setAttribute=(k,v)=>el.attrs[k]=v;el.removeAttribute=k=>delete el.attrs[k];
  }
  e.run("$('settingsMask').classList.contains=()=>true;openSettings();");
  return {...e,store,calls,send:()=>e.run('callLLMOnce("测试 JSON 输出",null,{})')};
}
test('旧 DeepSeek 配置打开设置不被预设覆盖',()=>{
  const e=setup();e.run("cfg={base:'https://api.deepseek.com/v1',key:'old-key',model:'deepseek-v4-pro',think:true,fontSize:20};openSettings();");
  assert.equal(e.run("$('cfgProvider').value"),'deepseek');
  assert.equal(e.run("$('cfgBase').value"),'https://api.deepseek.com/v1');
  assert.equal(e.run("$('cfgModel').value"),'deepseek-v4-pro');
  assert.equal(e.run("$('cfgKey').value"),'old-key');
});
test('切换平台自动填写预设、清除旧密钥并保存无密钥配置',()=>{
  const e=setup();e.run("cfg.key='deepseek-only';openSettings();$('cfgProvider').value='glm';applyApiPreset();");
  assert.deepEqual(e.val('cfg'),{base:'https://open.bigmodel.cn/api/paas/v4',key:'',model:'glm-4.7-flash',think:false,fontSize:16});
  assert.equal(JSON.parse(e.store.get('xian_cfg')).key,'');
  e.run("$('cfgKey').value='glm-only';saveCfgFromFields();$('cfgProvider').value='qwen';applyApiPreset();");
  assert.equal(e.run('cfg.key'),'');assert.equal(e.run('cfg.model'),'qwen-flash');
  assert.equal(e.run("$('cfgThink').disabled"),true);
});
test('手动修改接口到其他域名也清除密钥，同域路径编辑保留密钥',()=>{
  const e=setup();e.run("cfg.key='old-key';openSettings();$('cfgBase').value='https://api.deepseek.com/v1';saveCfgFromFields();");
  assert.equal(e.run('cfg.key'),'old-key');
  e.run("$('cfgBase').value='https://another.invalid/v1';saveCfgFromFields();");assert.equal(e.run('cfg.key'),'');
});
test('自定义接口原地址、模型、密钥和字号保留，隐藏无关官方入口',()=>{
  const e=setup(),custom={base:'http://127.0.0.1:9999/v1',model:'my-model',key:'custom-key',think:false,fontSize:22};
  e.run('v=>cfg=v')(custom);e.run('openSettings();saveCfgFromFields();');
  assert.deepEqual(e.val('cfg'),custom);assert.equal(e.run("$('cfgProvider').value"),'custom');
  assert.equal(e.run("$('cfgProviderLinks').hidden"),true);assert.equal(e.elements.get('cfgRegister').attrs.href,undefined);
});
test('空地址和模型使用当前预设默认值，千问旧思考配置也归一为关闭',()=>{
  const e=setup();e.run("$('cfgProvider').value='glm';applyApiPreset();$('cfgBase').value='';$('cfgModel').value='';saveCfgFromFields();");
  assert.equal(e.run('cfg.model'),'glm-4.7-flash');assert.equal(e.run('cfg.base'),'https://open.bigmodel.cn/api/paas/v4');
  e.run("cfg={...API_PRESETS.qwen,key:'qwen-key',think:true};openSettings();saveCfgFromFields();");
  assert.equal(e.run('cfg.think'),false);assert.equal(e.run("$('cfgThink').value"),'off');
});
test('千问地域与业务空间域名可识别，仿冒域名和 Coding 地址不误认',()=>{
  const e=setup();for(const base of ['https://dashscope-intl.aliyuncs.com/compatible-mode/v1/','https://workspace-123.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'])assert.equal(e.run('apiProvider')(base),'qwen');
  for(const base of ['https://open.bigmodel.cn.evil.invalid/api/paas/v4','https://open.bigmodel.cn/api/coding/paas/v4','https://dashscope.aliyuncs.com.evil.invalid/compatible-mode/v1'])assert.equal(e.run('apiProvider')(base),'custom');
});
test('GLM 关闭与开启思考均发送官方参数，输出预算正确且流式正文完整',async()=>{
  const e=setup();for(const think of [false,true]){
    e.run('think=>cfg={...API_PRESETS.glm,key:"glm-fixture",think}')(think);
    assert.equal(await e.send(),'{"ok":true}');const req=e.calls.at(-1);
    assert.equal(req.url,'https://open.bigmodel.cn/api/paas/v4/chat/completions');
    assert.equal(req.headers.Authorization,'Bearer glm-fixture');assert.equal(req.body.model,'glm-4.7-flash');
    assert.deepEqual(req.body.thinking,{type:think?'enabled':'disabled'});assert.equal(req.body.enable_thinking,undefined);
    assert.equal(req.body.max_tokens,think?15000:7000);assert.equal(req.body.response_format.type,'json_object');
  }
});
test('千问始终关闭思考、不额外扩充输出预算，分类请求保留低 token 上限',async()=>{
  const e=setup();e.run('cfg={...API_PRESETS.qwen,key:"qwen-fixture",think:true}');
  assert.equal(await e.send(),'{"ok":true}');const req=e.calls[0];
  assert.equal(req.url,'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(req.body.enable_thinking,false);assert.equal(req.body.thinking,undefined);assert.equal(req.body.max_tokens,7000);
  await e.run('callLLMOnce("只输出分类",null,{noSystem:true,maxTokens:200,temperature:.2})');
  const cls=e.calls[1].body;assert.equal(cls.messages.length,1);assert.match(cls.messages[0].content,/JSON/);assert.equal(cls.max_tokens,200);
});
test('预设变化不改游戏存档，不消耗游戏随机数，密钥不会写入用量统计',async()=>{
  const e=setup(),control=setup(),before=e.run('JSON.stringify(S)');
  for(const id of ['glm','qwen','deepseek']){
    e.run('id=>{$("cfgProvider").value=id;applyApiPreset();if(id==="qwen"){$("cfgQwenRegion").value="ap-southeast-1";applyQwenRegion();}$("cfgKey").value="fixture-private-key";saveCfgFromFields();}')(id);
    await e.send();assert.equal(e.run('JSON.stringify(S)'),before);
  }
  assert.equal(e.run('Math.random()'),control.run('Math.random()'));
  assert(!e.store.get('xian_llm_metrics_v1').includes('fixture-private-key'));
  assert(!e.store.has('xian_save_v1'));
});
test('官方链接按服务商更新，并使用新页面和 noreferrer',()=>{
  const e=setup();for(const id of ['glm','qwen','deepseek']){
    e.run('id=>{$("cfgProvider").value=id;applyApiPreset();}')(id);
    const preset=e.val(id==='qwen'?"qwenLinks($('cfgQwenRegion').value)":`API_PRESETS.${id}`);assert.equal(e.elements.get('cfgRegister').attrs.href,preset.register);assert.equal(e.elements.get('cfgGetKey').attrs.href,preset.keyPage);
  }
  for(const id of ['cfgRegister','cfgGetKey'])assert.match(html,new RegExp(`id="${id}" target="_blank" rel="noopener noreferrer"`));
});
test('新选千问不强行默认北京，未选地域/地址时不会发送请求',async()=>{
  const e=setup();e.run("$('cfgProvider').value='qwen';applyApiPreset();$('cfgKey').value='fixture';saveCfgFromFields();openSettings();");
  assert.equal(e.run("$('cfgProvider').value"),'qwen');assert.equal(e.run("$('cfgQwenRegion').value"),'');assert.equal(e.run('cfg.base'),'');
  await assert.rejects(e.send(),/选择服务地域/);assert.equal(e.calls.length,0);
});
test('六个官方地域分别保存地址、匹配密钥入口与登录回调，请求不回退北京',async()=>{
  const e=setup();for(const [id,r] of Object.entries(e.val('QWEN_REGIONS'))){
    e.run('id=>{$("cfgProvider").value="qwen";applyApiPreset();$("cfgQwenRegion").value=id;applyQwenRegion();}')(id);
    const base=r.base||`https://workspace-test.${id}.maas.aliyuncs.com/compatible-mode/v1`;
    e.run('base=>{$("cfgBase").value=base;saveCfgFromFields();$("cfgKey").value="region-fixture";saveCfgFromFields();openSettings();}')(base);
    assert.equal(e.run("$('cfgQwenRegion').value"),id);assert.equal(e.run('cfg.base'),base);
    const keyPage=`https://bailian.console.aliyun.com/${id}/model/settings/api-key`;
    assert.equal(e.elements.get('cfgGetKey').attrs.href,keyPage);
    assert.equal(new URL(e.elements.get('cfgRegister').attrs.href).searchParams.get('oauth_callback'),keyPage);
    assert.equal(await e.send(),'{"ok":true}');assert.equal(e.calls.at(-1).url,base+'/chat/completions');assert.equal(e.calls.at(-1).body.enable_thinking,false);
  }
});
test('切换百炼地域清空旧密钥，东京/德国未填专属地址的草稿可恢复',()=>{
  const e=setup();e.run("cfg={...API_PRESETS.qwen,key:'beijing-only',think:false};openSettings();$('cfgQwenRegion').value='ap-southeast-1';applyQwenRegion();");
  assert.equal(e.run('cfg.key'),'');assert.match(e.run('cfg.base'),/dashscope-intl/);
  for(const id of ['ap-northeast-1','eu-central-1']){
    e.run('id=>{$("cfgQwenRegion").value=id;applyQwenRegion();openSettings();}')(id);
    assert.equal(e.run("$('cfgProvider').value"),'qwen');assert.equal(e.run("$('cfgQwenRegion').value"),id);assert.equal(e.run('cfg.base'),'');
  }
});
test('已有国际区/专属域名配置按真实地址识别，原模型和密钥不覆盖',()=>{
  const e=setup();for(const base of ['https://dashscope-intl.aliyuncs.com/compatible-mode/v1','https://workspace.eu-central-1.maas.aliyuncs.com/compatible-mode/v1']){
    e.run('base=>{cfg={base,model:"qwen-plus",key:"existing-regional-key",think:false};openSettings();}')(base);
    assert.equal(e.run("$('cfgProvider').value"),'qwen');assert.equal(e.run("$('cfgQwenRegion').value"),base.includes('intl')?'ap-southeast-1':'eu-central-1');
    assert.equal(e.run("$('cfgKey').value"),'existing-regional-key');assert.equal(e.run("$('cfgModel').value"),'qwen-plus');
  }
});
test('其他地域专属域名不受枚举地域限制，支持手填地址与非思考参数',async()=>{
  const e=setup();e.run("$('cfgProvider').value='qwen';applyApiPreset();$('cfgQwenRegion').value='custom';applyQwenRegion();$('cfgBase').value='https://workspace.other-region.maas.aliyuncs.com/compatible-mode/v1';saveCfgFromFields();$('cfgKey').value='fixture';saveCfgFromFields();openSettings();");
  assert.equal(e.run("$('cfgQwenRegion').value"),'custom');assert.equal(e.run('apiProvider(cfg.base)'),'qwen');
  await e.send();assert.match(e.calls[0].url,/other-region/);assert.equal(e.calls[0].body.enable_thinking,false);
});
(async()=>{for(const [name,fn]of tests){await fn();console.log('✓ '+name);}console.log(`${tests.length} API preset regressions passed`);})().catch(err=>{console.error(err);process.exitCode=1;});
