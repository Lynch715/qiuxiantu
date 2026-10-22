// 当前提示词的缓存布局回归：固定资料前置，变化内容实时可见，不锁定历史源码快照。
const assert=require('node:assert/strict'),env=require('./power-scale-env.cjs');
const setup=file=>{const e=env(file);e.run(`S.runId='cache-test';S.player.backstory='幼年在山村长大，后来拜入宗门。';S.elapsedDays=3;S.volumes=[{from:1,to:8,text:'与旧友徐客结识，一同找回失散亲人。'}];S.ledgerOld=['第1回：归还了旧宅地契。'];S.ledgerPending=['刚得一枚温脉丹。'];S.history=[{turn:9,action:'查看旧卷',summary:'确定旧案线索'}];S.recent=[{turn:9,action:'查看旧卷',narrative:'你与徐客翻阅旧卷，案情渐渐明朗。'}];S.ledger=['第9回：确认旧案线索。'];S.quests=[initQuest({title:'安顿家人',desc:'筹钱安家',completion:'攒够五百灵石并安顿家人',objectives:[{id:'o1',kind:'money',value:500,text:'攒够五百灵石'},{id:'o2',kind:'story',text:'安顿家人'}]})];continuityState(S).facts=[{id:'a',subject:'青峰洞',key:'归属',value:'已归还原主',plane:'下界'},{id:'b',subject:'白云谷',key:'通路',value:'山路已经修好',plane:'下界'}];convo={msgs:[{role:'me',text:'旧案怎么样了？'},{role:'npc',text:'旧卷有了下落。'}],gains:['已获温脉丹一枚']};`);return e;};
const prefix=(a,b)=>{let i=0;while(i<Math.min(a.length,b.length)&&a[i]===b[i])i++;return i;};
let count=0;
for(const freedom of ['free','mid','strict'])for(const memLong of [true,false])for(const mode of ['normal','gift','failed','secret','late']){
 const a=setup(),b=setup();
 const edit=`S.freedom='${freedom}';S.memLong=${memLong};`+(mode==='secret'?`S.npcs[0].secretKnown=true;S.npcs[0].fromPlayer=['长春功'];S.npcs[0].memory=['已说清旧事'];`:mode==='late'?`S.elapsedDays=720;S.player.money=799;S.npcs[0].mood='高兴';S.npcs[0].好感度=91;convo.msgs=Array.from({length:29},(_,i)=>({role:i%2?'npc':'me',text:'第'+i+'句'}));`:'');a.run(edit);b.run(edit);
 const line=mode==='gift'?'请收下':mode==='failed'?'说出秘密（请详细说清）':'去青峰洞查案';
 const roll=mode==='failed'?{type:'说服',success:false,need:80}:null,gift=mode==='gift'?{name:'温脉丹',desc:'温养经脉'}:null;
 for(const expr of [`stateBlocks(${JSON.stringify(line)})`,`turnPrompt(${JSON.stringify(line)},{months:0,fate:3,check:{attr:'神识',success:false,need:80,val:30,roll:2}})`,`convoPrompt(S.npcs[0],${JSON.stringify(line)},${JSON.stringify(roll)},${JSON.stringify(gift)})`]){
   // 首次投影允许补齐 roster/世界缓存；后续反复读取必须无写入且不耗随机数。
   a.run(expr);b.run(expr);const snapshot=b.run('JSON.stringify(S)'),text=b.run(expr);assert.equal(text,b.run(expr));assert.equal(b.run('JSON.stringify(S)'),snapshot);assert.equal(text,a.run(expr));
   for(const word of ['旧案','青峰洞','白云谷','温脉丹'])assert(text.includes(word),mode+'/'+word);
   assert(text.includes('【事实与结算约束】'));assert(text.includes('【人物名册'));
 }
 assert.deepEqual(b.val('S'),a.val('S'));assert.deepEqual(b.val("makeJudge({months:1},'查看旧卷')"),a.val("makeJudge({months:1},'查看旧卷')"));count++;
}
let checks=0;
for(const scenario of ['actionFacts','elapsedDay','talkNewFact','talkMood','talkAppend']){
 const e=setup(),talk=scenario.startsWith('talk');let expr=talk?"convoPrompt(S.npcs[0],'继续说',null,null)":"stateBlocks('前往青峰洞')";const first=e.run(expr);
 if(scenario==='actionFacts')expr="stateBlocks('前往白云谷')";
 if(scenario==='elapsedDay')e.run('S.elapsedDays=4');
 if(scenario==='talkNewFact')e.run("continuityState(S).facts.push({id:'c',subject:'新客栈',key:'所在',value:'北城',plane:'下界'})");
 if(scenario==='talkMood')e.run("S.npcs[0].mood='高兴';S.npcs[0].好感度+=2");
 if(scenario==='talkAppend')e.run("convo.msgs.push({role:'me',text:'我记下了。'});S.npcs[0].memory.push('已答应明日继续查案');");
 const second=e.run(expr);
 if(scenario==='talkNewFact'){assert(second.includes('新客栈'));assert(second.includes('北城'));assert(!first.includes('新客栈'));}
 if(scenario==='talkMood'){assert(second.includes('高兴'));assert(!first.includes('高兴'));}
 if(scenario==='talkAppend'){assert(second.includes('我记下了。'));assert(second.includes('已答应明日继续查案'));}
 // 身世/名册/规则等大块固定上下文应被完整复用，且变化确实出现在后段。
 assert(prefix(first,second)>Math.floor(first.length*.35),scenario+' fixed prefix');if(scenario!=='actionFacts')assert.notEqual(first,second,scenario+' freshness');checks++;
}
console.log(`${count} prompt scenarios + ${checks} cache layout regressions passed (90 prompt projections, state/RNG checks)`);
