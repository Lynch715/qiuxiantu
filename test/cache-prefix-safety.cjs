// 核对资料完整性、实时更新和随机数；可传发布前 HTML 比较共同前缀字符数。
const assert=require('node:assert/strict'),path=require('node:path'),env=require('./power-scale-env.cjs');
const baseline=process.argv[2]&&path.resolve(process.argv[2]);
function setup(file,freedom,memLong){
 const e=env(file);e.run(`S.runId='prefix-safety';S.turn=9;S.elapsedDays=3;S.freedom=${JSON.stringify(freedom)};S.memLong=${memLong};
 S.player.backstory='在青峰村长大，后来拜入宗门。';S.volumes=[{from:1,to:8,text:'归还旧宅，与友人一起修好山路。'}];S.ledgerOld=['旧宅已经归还原主。'];
 S.history=[{turn:9,action:'查看旧卷',summary:'确认山路已经修好',narr:'你和旧友在青峰洞核对旧卷。',led:['旧宅归还']}];
 S.recent=[{turn:9,action:'查看旧卷',narrative:'你和旧友在青峰洞核对旧卷。'}];S.ledger=['已获温脉丹一枚。'];S.ledgerPending=['刚修好一段山路。'];
 continuityState(S).facts=[{id:'a',subject:'青峰洞',key:'归属',value:'已归还原主',plane:'下界'},{id:'b',subject:'白云谷',key:'通路',value:'山路已经修好',plane:'下界'}];
 convo={msgs:[{role:'me',text:'旧案怎么样了？'},{role:'npc',text:'旧卷有了下落。'}],gains:['已获温脉丹一枚']};`);
 return e;
}
const prefix=(a,b)=>{let i=0;while(i<Math.min(a.length,b.length)&&a[i]===b[i])i++;return i;};
const lines=s=>s.split('\n').filter(x=>x.trim()).sort();
const scenarios=[
 ['turnAppend',false,"S.history.push({turn:10,action:'探查白云谷',summary:'又找到一块旧碑',narr:'你在白云谷找到一块旧碑。'});S.recent.push({turn:10,action:'探查白云谷',narrative:'你在白云谷找到一块旧碑。'});S.turn++;"],
 ['turnWorld',false,"S.world.factions[0].power+=1;S.world.events.push('清河坊新开了一家铺子。');"],
 ['talkAppend',true,"convo.msgs.push({role:'me',text:'我记下了，明日继续。'});S.npcs[0].memory.push('答应明日继续查案');S.npcs[0].mood='高兴';S.npcs[0].好感度+=2;"],
 ['talkFact',true,"continuityState(S).facts.push({id:'c',subject:'青峰洞',key:'钥匙',value:'已交给原主',plane:'下界'});convo.msgs.push({role:'me',text:'钥匙已交还。'});"],
 ['talkInventory',true,"S.player.items['玉简'].push({name:'长春功玉简',desc:'原主留下的功法'});S.player.money-=3;convo.gains.push('付出三块灵石');"],
 ['talkRelation',true,"S.npcs[0].relation='义兄';S.npcs[0].secretKnown=true;S.npcs[0].mood='郑重';"]
];
const report=[];let checks=0;
for(const freedom of ['free','mid','strict'])for(const memLong of [true,false])for(const [name,talk,mutation] of scenarios){
 const a=setup(baseline,freedom,memLong),b=setup(undefined,freedom,memLong);
 const expr=talk?"convoPrompt(S.npcs[0],'去青峰洞查案',null,null)":"turnPrompt('去青峰洞查案',{months:0,fate:3,check:{attr:'神识',success:false,need:80,val:30,roll:2}})";
 a.run(expr);b.run(expr); // 允许原有 roster/ledAt/worldState 首次补齐。
 const project=e=>{for(let i=0;i<4;i++){const snap=e.run('JSON.stringify(S)'),c=e.run('JSON.stringify(convo)'),p=e.run(expr);if(e.run('JSON.stringify(S)')===snap&&e.run('JSON.stringify(convo)')===c)return p;}assert.fail('已有状态投影补齐后仍持续写入');};
 const beforeA=project(a),beforeB=project(b);assert.deepEqual(lines(beforeB),lines(beforeA));
 assert.equal(b.run('styleSystem()'),a.run('styleSystem()'));
 a.run(mutation);b.run(mutation);const afterA=project(a),afterB=project(b);
 assert.deepEqual(lines(afterB),lines(afterA),name+' 输入资料或规则发生变化');
 assert.deepEqual(b.val('S'),a.val('S'));assert.deepEqual(b.val('convo'),a.val('convo'));
 assert.equal(b.run('Math.random()'),a.run('Math.random()'));assert.notEqual(afterB,beforeB,name+' 没有反映最新资料');
 if(name==='talkFact'){assert(afterB.includes('已交给原主'));assert(!beforeB.includes('已交给原主'));}
 if(name==='talkAppend'){assert(afterB.includes('明日继续'));assert(afterB.includes('高兴'));}
 if(name==='talkInventory')assert(afterB.includes('长春功玉简'));
 const oldPrefix=prefix(beforeA,afterA),newPrefix=prefix(beforeB,afterB);
 if(baseline&&['turnAppend','talkAppend','talkFact'].includes(name))assert(newPrefix>oldPrefix,name+' 没有增长稳定前缀');
 report.push({freedom,memLong,scenario:name,before:oldPrefix,after:newPrefix,total:afterB.length});checks++;
}
console.log(JSON.stringify({checks,metric:'common prefix characters, not actual cached tokens',baselineCompared:!!baseline,results:report},null,2));
