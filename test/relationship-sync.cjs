// 关系同步专项：使用真实面谈提交、回合、迁移和面板生成；不调用模型。
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const environment=require('./power-scale-env.cjs'),file=process.argv[2];
function setup(relation='相识'){
  const e=environment(file);
  e.run(`S.player.name='韩七';S.player.age=35;S.player.realm=parseRealm('筑基初期');S.freedom='mid';
    S.npcs=[normNpc({name:'柳宁',gender:'女',age:36,realm:'金丹初期',relation:${JSON.stringify(relation)},identity:'散修',faction:'散修',好感度:90,爱恋值:80,alive:true})];
    S.npcs[0].memory=['原记忆'];S.npcs[0].life=[{day:1,date:'旧年',text:'原履历'}];S.npcs[0].notes='原备注';
    S.rels=[];S.origRel={'柳宁':'相识'};S.clan=null;S.sect=null;S.pending=null;S.lastTurn=null;S.convoState=null;convo=null;busy=false;
    S.history=[{turn:1,action:'旧日相逢',summary:'旧约',narr:'原正文'}];S.chronFix1=true;S.player.items.其他=[{name:'旧玉牌',desc:'赠物经历原文'}];
    S.scene={location:'山中洞府',present:['柳宁'],unresolved:[]};S.elapsedDays=100;S.date=dateStr();`);
  return e;
}
function talk(e,relation,action,reply,id='talk-sync'){
  return e.run(`commitConvoOnce(S,'柳宁',{reply:${JSON.stringify(reply)},effects:{relation:${JSON.stringify(relation)}},favor:0},null,${JSON.stringify(action)},${JSON.stringify(id)})`);
}
function edge(e){return e.run(`(relOf(S.player.name,'柳宁')||{}).type`)||null;}
const preserved=`JSON.stringify([S.player,S.npcs.map(n=>[n.name,n.relation,n.memory,n.life,n.notes,n.parents,n.items,n.preg]),S.history,S.elapsedDays,S.months,S.turn,S.clan])`;
function main(){let passed=0;
function test(name,fn){fn();passed++;console.log('✓ '+name);}

test('七种妾室、五种恋人称谓经过真实面谈入账并进入家室',()=>{
  for(const [rels,type,act,reply] of [
    [['妾室','侍妾','侧室','偏房','姨娘','小妾','男妾'],'妾室','纳柳宁为妾','柳宁答应了，你纳柳宁为妾。'],
    [['恋人','情人','心上人','相好','意中人'],'恋人','与柳宁相恋','柳宁与你两情相悦，答应从此相恋。']
  ])for(const rel of rels){const e=setup();talk(e,rel,act,reply);assert.equal(edge(e),type,rel);assert(e.run(`familyPartnerCards().includes('柳宁')`),rel);}
});
test('未婚妻与未婚夫均是婚约，谈到来年成亲也不登记已婚或产生孕期',()=>{
  for(const rel of ['未婚妻','未婚夫']){const e=setup();if(rel==='未婚夫')e.run(`S.player.gender='女';S.npcs[0].gender='男';`);
    talk(e,rel,'与柳宁订下婚约，今后再成亲','柳宁答应订下婚约，待来年再成亲。');
    assert.equal(edge(e),'恋人');assert.equal(e.run('spouseOf(S.player.name)'),null);assert.equal(e.run('S.npcs[0].relation'),rel);
    assert(!e.run(`familyPartnerCards().includes('family-role">正室')`));assert(e.run(`familyPartnerCards().includes('family-role">婚约')`));assert(!e.run('!!S.npcs[0].preg||!!S.player.preg'));assert.match(e.run('relationActions(S.npcs[0])[0].label'),/婚约/);
  }
});
test('问候不能把恋人变成婚约，模型也不能把已有妻妾降回未婚',()=>{
  for(const rel of ['恋人','妻子','妾室']){const e=setup(rel);e.run(`syncPlayerRel(S.npcs[0],'相识');var old=JSON.stringify(relOf(S.player.name,'柳宁'));`);
    talk(e,'未婚妻','问候近况','柳宁说起山中近况。');assert.equal(e.run('S.npcs[0].relation'),rel);assert.equal(e.run(`JSON.stringify(relOf(S.player.name,'柳宁'))`),e.run('old'));
  }
});
test('师父六种称谓、弟子九种称谓均入师徒边，师父同时进入师门名册',()=>{
  for(const rel of ['师父','师尊','师傅','恩师','授业恩师','主角的师父']){const e=setup();talk(e,rel,'拜柳宁为师','柳宁收你为徒，你行过拜师礼。');assert.equal(edge(e),'师徒',rel);assert.match(e.run('sectRosterLine()'),/师父：柳宁/,rel);}
  for(const rel of ['徒弟','徒儿','弟子','亲传弟子','记名弟子','入室弟子','嫡传弟子','关门弟子','大弟子']){const e=setup();talk(e,rel,'收柳宁为徒','你收柳宁为徒，柳宁行过拜师礼。');assert.equal(edge(e),'师徒',rel);assert(e.run(`relationActions(S.npcs[0]).some(a=>a.kind==='mentorship')`),rel);assert(!e.run(`sectRosterLine().includes('师父：柳宁')`));assert.equal(e.run('S.clan'),null);}
});
test('问候、回忆、否定和未来计划不能凭修饰称谓缔结师徒',()=>{
  for(const rel of ['师父','授业恩师','亲传弟子','关门弟子'])for(const [act,reply] of [
    ['问候近况','柳宁说起山中灵草的长势。'],['回忆当年拜师','柳宁想起当年的拜师礼。'],
    ['不要收柳宁为徒','柳宁并未拜师。'],['准备将来收柳宁为徒','柳宁打算明年拜师。']
  ]){const e=setup();talk(e,rel,act,reply);assert.equal(edge(e),null,rel+act);assert.equal(e.run('S.npcs[0].relation'),'相识');}
});
test('师父同义称谓使用原好感与境界门槛，已有老师不会因后来修为较低被抹去',()=>{
  for(const rel of ['师父','师尊','师傅','恩师','授业恩师','主角的师父']){
    const e=setup();e.run(`S.player.realm=parseRealm('金丹初期');S.npcs[0].realm=parseRealm('炼气三阶');S.npcs[0].好感度=0;S.npcs[0].爱恋值=null;`);
    talk(e,rel,'拜柳宁为师','柳宁收你为徒，你行过拜师礼。');assert.equal(edge(e),null,rel);
  }
  const e=setup('师父');e.run(`syncPlayerRel(S.npcs[0],'相识');S.player.realm=parseRealm('元婴初期');S.npcs[0].好感度=0;S.npcs[0].爱恋值=null;var old=JSON.stringify(relOf(S.player.name,'柳宁'));`);
  talk(e,'授业恩师','向柳宁问好','柳宁与你聊起近况。');assert.equal(e.run('S.npcs[0].relation'),'授业恩师');assert.equal(e.run(`JSON.stringify(relOf(S.player.name,'柳宁'))`),e.run('old'));
});
test('师徒换称谓、重复提交不重办仪式、不重复履历、不丢旧关系历史',()=>{
  const e=setup('师父');e.run(`syncPlayerRel(S.npcs[0],'相识');var r=relOf(S.player.name,'柳宁');r.history=Array.from({length:40},(_,i)=>({day:i,date:'旧年',text:'原关系历史'+i}));var before=JSON.stringify([r.history,S.npcs[0].life,S.npcs[0].memory,S.history,S.elapsedDays]);`);
  for(const rel of ['师尊','授业恩师','主角的师父','师父'])talk(e,rel,'问候柳宁','柳宁与你聊了近况。','alias-'+rel);
  assert.equal(e.run(`JSON.stringify([relOf(S.player.name,'柳宁').history,S.npcs[0].life,S.npcs[0].memory,S.history,S.elapsedDays])`),e.run('before'));
});
test('面谈解除师徒同步清边与退出凭据，读档后不恢复，原记忆和历史保留',()=>{
  const e=setup('关门弟子');e.run(`syncPlayerRel(S.npcs[0],'相识');decreeRecord(S,'柳宁（弟子）',0,true);var old=JSON.stringify(S.history);`);
  talk(e,'相识','与柳宁解除师徒关系','你与柳宁解除了师徒关系，往后各自修行。');assert.equal(edge(e),'相识');assert(e.run('!!S.npcs[0].relationshipExits.mentorship'));
  e.run('S=migrate(S);');assert.equal(edge(e),'相识');assert.equal(e.run('mentorshipRel(S.npcs[0].relation)'),false);
  assert(e.run(`S.npcs[0].memory.includes('原记忆')`));assert(e.run(`S.npcs[0].life.some(h=>h.text==='原履历')`));assert.equal(e.run('JSON.stringify(S.history)'),e.run('old'));
});
test('否定、回忆或将来解除关系，不会把当前师徒清掉',()=>{
  for(const [act,reply] of [['不要解除师徒关系','柳宁继续指点功课。'],['回忆当年解除师徒关系','柳宁想起当年解除师徒关系的往事。'],['准备明年解除师徒关系','柳宁打算明年解除师徒关系。']]){
    const e=setup('徒弟');e.run(`syncPlayerRel(S.npcs[0],'相识');`);talk(e,'相识',act,reply);assert.equal(edge(e),'师徒',act);assert.equal(e.run('S.npcs[0].relation'),'徒弟');
  }
});
test('旧档已改成相识但遗留师徒边时，明确结束并重复相同称谓也能清边',()=>{
  const e=setup('徒弟');e.run(`syncPlayerRel(S.npcs[0],'相识');S.npcs[0].relation='相识';`);
  talk(e,'相识','与柳宁解除师徒关系','你与柳宁解除了师徒关系。');assert.equal(edge(e),'相识');assert(e.run('!!S.npcs[0].relationshipExits.mentorship'));
});
test('面谈结束妾室、恋人和婚约均清正式边，保留旧记忆、子女与孕期',()=>{
  for(const [rel,act] of [['妾室','与柳宁解除妾室关系'],['恋人','与柳宁结束恋情'],['未婚妻','与柳宁解除婚约']]){
    const e=setup(rel);e.run(`syncPlayerRel(S.npcs[0],'相识');S.npcs[0].preg={with:S.player.name,since:0,due:300};S.npcs.push(normNpc({name:'旧日子女',gender:'女',age:3,parents:{father:S.player.name,mother:'柳宁'},alive:true}));worldState();var old=JSON.stringify([S.npcs[0].preg,S.npcs[1],S.player.items,S.history,S.elapsedDays]);`);
    talk(e,'相识',act,act.replace('与柳宁','你与柳宁')+'，双方各自生活。');assert.equal(edge(e),'相识');assert(e.run('!!S.npcs[0].relationshipExits.romance'));assert.equal(e.run('JSON.stringify([S.npcs[0].preg,S.npcs[1],S.player.items,S.history,S.elapsedDays])'),e.run('old'));
  }
});
test('模型回复明确说解除了关系时，不要求玩家逐字输入固定按钮名称',()=>{
  for(const [rel,reply] of [['妾室','你与柳宁解除了妾室关系。'],['恋人','你与柳宁结束了恋情。'],['未婚妻','你与柳宁解除了婚约。']]){const e=setup(rel);e.run(`syncPlayerRel(S.npcs[0],'相识');`);talk(e,'相识','我们各自生活吧',reply);assert.equal(edge(e),'相识',rel);assert(e.run('!!S.npcs[0].relationshipExits.romance'));}
});
test('关门弟子解除后不被普通面谈、回忆或迁移恢复，明确重新收徒才可恢复',()=>{
  const e=setup('关门弟子');e.run(`syncPlayerRel(S.npcs[0],'相识');endPlayerRelation('柳宁','mentorship');`);
  talk(e,'关门弟子','与柳宁叙旧','你曾经收柳宁为徒，柳宁想起当年的拜师礼。');assert.equal(edge(e),'相识');
  e.run('S=migrate(S);');assert.equal(edge(e),'相识');talk(e,'关门弟子','重新收柳宁为徒','你重新收柳宁为徒，柳宁行过拜师礼。','restore');assert.equal(edge(e),'师徒');assert(!e.run('!!S.npcs[0].relationshipExits.mentorship'));
});
test('旧档补妾室、恋人、婚约与师徒缺边，原称谓和所有原文不变且幂等',()=>{
  for(const rel of ['妾室','侧室','恋人','情人','未婚妻','未婚夫','师父','授业恩师','亲传弟子','关门弟子']){
    const e=setup(rel);e.run('var before='+preserved+';repairPlayerSpouseAliases(S);var once=JSON.stringify(S);repairPlayerSpouseAliases(S);');assert.equal(edge(e),rel.includes('弟子')||rel.includes('师')?'师徒':/妾|侧室/.test(rel)?'妾室':'恋人',rel);assert.equal(e.run(preserved),e.run('before'));assert.equal(e.run('JSON.stringify(S)'),e.run('once'));
  }
});
test('重复报相同称谓也能补已保存的正式关系，不编成新事件',()=>{
  for(const rel of ['侧室','恋人','师父','关门弟子']){const e=setup(rel);e.run('var old='+preserved+';');talk(e,rel,'问候近况','柳宁说起山中近况。');assert.equal(edge(e),rel==='侧室'?'妾室':rel==='恋人'?'恋人':'师徒');assert.equal(e.run(preserved),e.run('old'));}
});
test('旧档中解除、血亲、矛盾正式边和含混称呼都不自动补关系',()=>{
  for(const [rel,prep] of [['恋人',`S.npcs[0].relationshipExits={romance:{label:'结束恋情'}}`],['关门弟子',`S.npcs[0].relationshipExits={mentorship:{label:'解除师徒关系'}}`],['妾室',`S.origRel['柳宁']='母亲'`],['恋人',`relSet(S.player.name,'柳宁','亲属')`],['关门弟子',`relSet(S.player.name,'柳宁','相识','两人解除了师徒关系')`],['恋人',`relSet(S.player.name,'柳宁','师徒')`],['小爹',''],['心上人',''],['同门弟子','']]){
    const e=setup(rel);e.run(prep+';var old=JSON.stringify(S);repairPlayerSpouseAliases(S);');assert.equal(e.run('JSON.stringify(S)'),e.run('old'),rel+prep);
  }
});
test('跨界与待提交快照分别补齐，处理外部状态不污染当前局',()=>{
  const e=setup('关门弟子');e.run(`var other=JSON.parse(JSON.stringify(S));other.plane='仙界';other.planes={下界:{npcs:other.npcs,origRel:other.origRel}};other.npcs=[];other.pending={forecast:{state:JSON.parse(JSON.stringify(other))}};var old=JSON.stringify(S);migrate(other);`);
  assert.equal(e.run('JSON.stringify(S)'),e.run('old'));for(const expr of ['other','other.pending.forecast.state'])assert(e.run(`${expr}.rels.some(r=>r.type==='师徒'&&(r.a==='柳宁'||r.b==='柳宁'))`));
});
test('跨界同名旧副本不覆盖当前人物，不复活已结束的约定',()=>{
  const e=setup('故人');e.run(`S.npcs[0].relationshipExits={mentorship:{label:'解除师徒关系'}};S.planes={仙界:{npcs:[Object.assign({},S.npcs[0],{relation:'关门弟子',relationshipExits:{}})]}};var old=JSON.stringify(S);repairPlayerSpouseAliases(S);`);assert.equal(e.run('JSON.stringify(S)'),e.run('old'));assert.equal(edge(e),null);
});
test('关系补齐不消耗随机数、不推进时间、不给宗门增员或加成',()=>{
  const a=setup('关门弟子'),b=setup('关门弟子');a.run('var old='+preserved+';repairPlayerSpouseAliases(S);');assert.equal(a.run(preserved),a.run('old'));assert.equal(a.run('Math.random()'),b.run('Math.random()'));assert.equal(a.run('S.clan'),null);
});
test('已有四十条记忆和历史的明确解除只追加，不裁剪旧记录',()=>{
  const e=setup('师父');e.run(`syncPlayerRel(S.npcs[0],'相识');S.npcs[0].memory=Array.from({length:40},(_,i)=>'原记忆'+i);S.npcs[0].life=Array.from({length:40},(_,i)=>({text:'原履历'+i}));relOf(S.player.name,'柳宁').history=Array.from({length:40},(_,i)=>({text:'原关系'+i}));var before=JSON.stringify([S.npcs[0].memory,S.npcs[0].life,relOf(S.player.name,'柳宁').history]);endPlayerRelation('柳宁','mentorship');`);
  assert.equal(e.run(`JSON.stringify([S.npcs[0].memory.slice(0,40),S.npcs[0].life.slice(0,40),relOf(S.player.name,'柳宁').history.slice(0,40)])`),e.run('before'));
});
test('正式回合的关门弟子成立和解除使用同一边表，同一回合不会重复结算',()=>{
  const e=setup();e.run(`var opt={months:0,fate:10},act='收柳宁为徒',body={narrative:'你收柳宁为徒，柳宁行过拜师礼，成为关门弟子。',summary:'收徒',npcUpdates:[{name:'柳宁',relation:'关门弟子'}],playerChanges:{},options:[]};var accepted=validateTurn(body,act,opt,S);S=settleTurnOnce(S,accepted,act,opt,'rel-turn-1');var old=JSON.stringify(S);S=settleTurnOnce(S,accepted,act,opt,'rel-turn-1');`);
  assert.equal(edge(e),'师徒');assert.equal(e.run('JSON.stringify(S)'),e.run('old'));
  e.run(`var act='与柳宁解除师徒关系',body={narrative:'你与柳宁解除师徒关系，此后各自修行。',summary:'解除师徒',npcUpdates:[{name:'柳宁',relation:'相识'}],playerChanges:{},options:[]};S=settleTurnOnce(S,validateTurn(body,act,opt,S),act,opt,'rel-turn-2');`);assert.equal(edge(e),'相识');assert(e.run('!!S.npcs[0].relationshipExits.mentorship'));
});
test('面谈中途失败不会留下半条新关系或半次解除，重试才提交一次',()=>{
  for(const ending of [false,true]){const e=setup(ending?'关门弟子':'相识');if(ending)e.run(`syncPlayerRel(S.npcs[0],'相识')`);
    e.run(`continuityState(S);var before=JSON.stringify(S),oldFacts=commitFactUpdates;commitFactUpdates=()=>{throw Error('模拟提交中断')};`);
    const rel=ending?'相识':'关门弟子',act=ending?'与柳宁解除师徒关系':'收柳宁为徒',reply=ending?'你与柳宁解除师徒关系。':'你收柳宁为徒，柳宁行过拜师礼。';
    assert.throws(()=>talk(e,rel,act,reply),/模拟提交中断/);assert.equal(e.run('JSON.stringify(S)'),e.run('before'));e.run('commitFactUpdates=oldFacts;');talk(e,rel,act,reply);assert.equal(edge(e),ending?'相识':'师徒');
  }
});
if(process.env.REAL_SAVE)test('用户石昊旧档迁移前后全部数据一致，原文件未变',()=>{
  const bytes=fs.readFileSync(process.env.REAL_SAVE),e=environment(file);e.run('v=>{S=v;migrate(S);}')(JSON.parse(bytes));
  e.run('var old=JSON.stringify(S);repairPlayerSpouseAliases(S);');assert.equal(e.run('JSON.stringify(S)'),e.run('old'));
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(process.env.REAL_SAVE)).digest('hex'),crypto.createHash('sha256').update(bytes).digest('hex'));
});
console.log(passed+' relationship sync regressions passed');
}
if(require.main===module)main();
module.exports={setup,talk};
