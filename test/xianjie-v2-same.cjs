// 仙界第二版：当前提示词、长期演化时间和两界隔离。用法：node test/xianjie-v2-same.cjs
const assert=require('node:assert/strict'),path=require('path'),fs=require('fs');
const {env}=require('./xjv2-env.cjs');
const NEW=path.join(__dirname,'../index.html');
const x2=fs.readFileSync(path.join(__dirname,'xianjie-x2.cjs'),'utf8');
const FIX=eval(x2.match(/const FIX=(`[\s\S]*?`);\n/)[1]);
const PROMPTS=eval(x2.match(/const PROMPTS=(`[\s\S]*?`);\n/)[1]);
let n=0; const t=(name,fn)=>{fn();n++;console.log('✓ '+name);};

for(const fr of ['mid','strict','free']) t(`飞升前（${fr}）：二十年及寿元末期仍保留下界人物和隔离规则`,()=>{
  const B=env(NEW,777);
  B.run(FIX+`S.freedom='${fr}';`);
  const p=B.run(PROMPTS);for(const word of ['宗门3','人物2','【事实与结算约束】','objectiveUpdates'])assert(p.includes(word));
  B.run(`S.player.cultMode='闭关';advanceTime(120);advanceTime(120);S.turn++;S.date=dateStr();`);
  assert.equal(B.val('S.player.age'),80);assert.equal(B.val('S.elapsedDays'),7200);
  assert(!/【仙庭】|【天人五衰】|【仙界规矩】/.test(B.run(PROMPTS)));
  const age=B.val('Math.floor(lifespanOf(S.player)*0.95)');B.run(`S.player.age=${age};advanceTime(12);S.turn++;S.date=dateStr();`);
  assert.equal(B.val('S.player.age'),age+1);assert.equal(B.val('S.elapsedDays'),7560);
  assert(!/【仙庭】|【天人五衰】|【仙界规矩】/.test(B.run(PROMPTS)));
  assert.equal(B.val('S.plane===undefined&&S.planes===undefined&&!S.xianJiePending&&!S.court'),true);
});
console.log(`\n${n} 项通过`);
