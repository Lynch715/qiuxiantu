// No live credentials or player storage: exercise failure/retry and durable save contracts in a VM.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const env=require('./power-scale-env.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function setup(mode='ok'){
  const e=env(),timers=new Map(),ls=new Map(),data=new Map(),requests=[],connections=[];
  const state={mode,aborts:0,writes:0,closed:0};let timerId=0;
  const db={close(){state.closed++;},transaction(store,kind){
    const changes=[];let aborted=false;
    const tx={error:null,abort(){aborted=true;state.aborts++;queueMicrotask(()=>tx.onabort&&tx.onabort());},objectStore(){return {
      getAllKeys(){return {result:[...data.keys()]};},
      get(k){const r={result:data.get(k)};if(state.mode==='read-error')queueMicrotask(()=>{tx.error=new Error('read failure');tx.onerror();});return r;},
      put(v,k){changes.push(()=>{data.set(k,v);state.writes++;});return {result:k};},
      delete(k){changes.push(()=>data.delete(k));return {};},
      index(){return {getAll(){return {result:[]};}}}
    };}};
    if(!['tx-hang','read-error'].includes(state.mode))queueMicrotask(()=>{if(!aborted){changes.forEach(f=>f());tx.oncomplete();}});
    return tx;
  }};
  const indexedDB={open(name,version){
    assert.equal(version,1);db.name=name;const r={result:db,transaction:{abort(){state.aborts++;}}};requests.push(r);connections.push(name);
    if(state.mode==='blocked')queueMicrotask(()=>r.onblocked());
    else if(state.mode!=='open-hang')queueMicrotask(()=>r.onsuccess());
    return r;
  }};
  e.run('x=>Object.assign(globalThis,x)')({indexedDB,setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),localStorage:{getItem:k=>ls.get(k)||null,setItem:(k,v)=>ls.set(k,v),removeItem:k=>ls.delete(k)}});
  const fixture=e.val('S');e.run('S=null;');
  e.run('saveGame='+html.slice(html.indexOf('function saveGame(options)'),html.indexOf('async function saveDrain()')).replace('function saveGame(options)','function(options)'));
  e.run(html.slice(html.indexOf('let bootRunning=false'),html.lastIndexOf('\nboot();')));
  e.run("applyReadingSize=()=>{};showGame=()=>true;toast=()=>{};showDemo=()=>{$('story').innerHTML='demo';};openCreate=()=>{$('createMask').classList.add('on');};");
  const mask=e.run("$('storageBootMask')");mask.removed=false;mask.remove=()=>mask.removed=true;
  return {...e,ls,data,state,requests,connections,fixture,mask,expire:async()=>{await flush();for(const [id,t]of [...timers])if(t.ms===4000){timers.delete(id);t.fn();}await flush();},timers};
}
test('No remaining lookbehind, and all inline scripts compile',()=>{
  assert(!/\(\?<([!=])/.test(html));
  const vm=require('node:vm');for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
test('Fresh install finishes boot and shows demo',async()=>{const e=setup();await e.run('boot()');assert.equal(e.run("$('story').innerHTML"),'demo');assert(e.mask.removed);assert.equal(e.state.writes,0);});
test('Open timeout keeps all old saves/config and offers retry; late connection is closed',async()=>{
  const e=setup('open-hang');e.ls.set('xian_cfg','original-config');e.ls.set('xian_save_v1',JSON.stringify(e.fixture));e.ls.set('xian_slot_1','original-slot');e.data.set('main','unread-newer-save');const before=[...e.ls],disk=[...e.data];
  const p=e.run('boot()');await e.expire();await p;
  assert.match(e.mask.innerHTML,/存档暂时无法读取/);assert.equal(e.run('S'),null);assert.equal(e.state.writes,0);assert.deepEqual([...e.ls],before);assert.deepEqual([...e.data],disk);assert.equal(typeof e.elements.get('storageBootRetry').onclick,'function');
  e.requests[0].onsuccess();assert.equal(e.state.closed,1);assert.equal(e.run('sdbP'),null);
});
test('Blocked open never falls through to new game and retry recovers original main/slots',async()=>{
  const e=setup('blocked'),raw=JSON.stringify(e.fixture);e.data.set('main',raw);for(let i=1;i<=3;i++)e.data.set('slot'+i,raw);
  await e.run('boot()');assert.match(e.mask.innerHTML,/重试读取/);assert.equal(e.run('S'),null);assert.equal(e.state.writes,0);
  e.state.mode='ok';await e.elements.get('storageBootRetry').onclick();await flush();
  assert(e.mask.removed);assert.equal(e.run('S.player.name'),e.fixture.player.name);assert.equal(e.run('S.turn'),e.fixture.turn);for(let i=1;i<=3;i++)assert.equal(e.run('SLOTS['+i+']'),raw);
  const saved=JSON.parse(e.data.get('main'));assert.equal(saved.player.name,e.fixture.player.name);assert.deepEqual(saved.chapters,e.fixture.chapters);
});
test('Read transaction timeout aborts instead of showing a fresh game, retaining both copies',async()=>{
  const e=setup('tx-hang');e.data.set('main',JSON.stringify(e.fixture));const backup=JSON.stringify({...e.fixture,savedAt:1});e.ls.set('xian_save_v1',backup);const disk=[...e.data];const p=e.run('boot()');await e.expire();await p;
  assert.match(e.mask.innerHTML,/重试读取/);assert.equal(e.run('S'),null);assert(e.state.aborts>=1);assert.deepEqual([...e.data],disk);assert.equal(e.ls.get('xian_save_v1'),backup);assert.equal(e.run('sdbP'),null);
  e.state.mode='ok';await e.elements.get('storageBootRetry').onclick();await flush();assert.equal(e.run('S.player.name'),e.fixture.player.name);assert.equal(e.connections.length,2);
});
test('Explicit read error also keeps saves and displays recoverable error',async()=>{const e=setup('read-error');e.data.set('main','old');await e.run('boot()');assert.match(e.mask.innerHTML,/重试读取/);assert.equal(e.data.get('main'),'old');assert.equal(e.run('S'),null);});
test('Legacy localStorage main and all three slots remain readable without IndexedDB',async()=>{
  const e=setup();e.run('indexedDB=undefined');const raw=JSON.stringify(e.fixture);e.ls.set('xian_save_v1',raw);for(let i=1;i<=3;i++)e.ls.set('xian_slot_'+i,raw);
  await e.run('boot()');await flush();assert.equal(e.run('S.player.name'),e.fixture.player.name);for(let i=1;i<=3;i++){assert.equal(e.run('SLOTS['+i+']'),raw);assert.equal(e.ls.get('xian_slot_'+i),raw);}assert.equal(e.data.size,0);
});
test('Startup slot reading never deletes or migrates legacy copies',async()=>{const e=setup();e.ls.set('xian_slot_1','legacy-only');e.ls.set('xian_slot_2','legacy-backup');e.data.set('slot2','idb-slot');await e.run('slotsLoad()');assert.equal(e.run('SLOTS[1]'),'legacy-only');assert.equal(e.run('SLOTS[2]'),'idb-slot');assert.equal(e.ls.get('xian_slot_1'),'legacy-only');assert.equal(e.ls.get('xian_slot_2'),'legacy-backup');assert.equal(e.state.writes,0);});
test('When both main copies are readable, newest savedAt still wins',async()=>{const e=setup();e.data.set('main',JSON.stringify({...e.fixture,savedAt:20}));e.ls.set('xian_save_v1',JSON.stringify({...e.fixture,savedAt:30}));assert.equal((await e.run('readMain()')).savedAt,30);e.data.set('main',JSON.stringify({...e.fixture,savedAt:40}));assert.equal((await e.run('readMain()')).savedAt,40);});
test('Timed out writes abort and fall back without a late stale IDB overwrite',async()=>{
  const e=setup('tx-hang'),old=JSON.stringify(e.fixture);e.data.set('main',old);e.run('v=>S=v')({...e.fixture,turn:123});
  const p=e.run('saveGame({noSync:true})');await e.expire();await p;
  assert.equal(e.data.get('main'),old);assert.equal(JSON.parse(e.ls.get('xian_save_v1')).turn,123);assert.equal(e.run('saveBusy'),false);assert(e.state.aborts>=1);
});
test('Chapter writes/reads also finish on timeout and do not change stored data',async()=>{const e=setup('tx-hang');const p=e.run("bookPut({id:'a',run:'r',seq:1})");const rejected=assert.rejects(p);await e.expire();await rejected;assert.equal(e.data.size,0);assert(e.state.aborts);});
test('Version change closes cached connection and subsequent access reopens it',async()=>{const e=setup();const db=await e.run('sdb()');db.onversionchange();assert.equal(e.run('sdbP'),null);await e.run('sdb()');assert.equal(e.connections.length,2);assert.equal(e.state.closed,1);});
test('Repeated retry clicks share one boot attempt',async()=>{const e=setup('open-hang');const p=e.run('boot()');await e.run('boot()');assert.equal(e.connections.length,1);await e.expire();await p;assert.equal(e.run('bootRunning'),false);});
module.exports={setup,flush};
if(require.main===module)(async()=>{for(const [name,fn]of tests){await fn();console.log('✓ '+name);}console.log(tests.length+' iOS/storage regressions passed');})().catch(e=>{console.error(e);process.exitCode=1;});
