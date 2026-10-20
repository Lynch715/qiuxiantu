// 正常当值的功绩节奏、时间结算和旧档兼容；不读用户存档，不调用外部模型。
const assert=require('node:assert/strict');
const xj=require('./xjv2-env.cjs');
let passed=0;
function env(){const e=xj.env();e.run(xj.BASE+xj.UP+`courtJoin();S.court.nextDuty=1e9;S.player.cultMode='日常';S.player.money=1000;`);return e;}
function test(name,fn){fn(env());passed++;console.log('✓ '+name);}
test('真实时间推进一年当值得24功绩和功德，俸禄照原规则发放',({run})=>{
  run(`S.courtPay=0;advanceTime(12);`);assert.equal(run('S.court.merit'),24);assert.equal(run('S.court.gongde'),24);assert.equal(run('S.courtPay'),2);
});
test('任职30个月攒够60功绩，达到天仙境界可升仙官',({run})=>{
  run(`S.player.realm=parseRealm('天仙初期');for(let i=0;i<29;i++){S.months++;courtTick();}`);assert.equal(run('S.court.merit'),58);assert.equal(run('courtRank()'),'仙吏');
  run('S.months++;courtTick()');assert.equal(run('S.court.merit'),60);assert.equal(run('courtRank()'),'仙官');
});
test('功绩够了仍须达到官阶境界要求',({run})=>{
  run(`for(let i=0;i<30;i++){S.months++;courtTick();}`);assert.equal(run('S.court.merit'),60);assert.equal(run('courtRank()'),'仙吏');assert.equal(run('courtNext().realm'),'天仙');
});
test('闭关一年不记当值功绩，俸禄减半且差事期限顺延',({run})=>{
  run(`S.court.merit=40;S.court.gongde=40;S.court.dutyAcc=.75;S.courtPay=0;S.player.cultMode='闭关';S.court.duty={id:'wait',type:'镇守',text:'镇守',due:S.months+2};var due=S.court.duty.due;advanceTime(12);`);
  assert.equal(run('S.court.merit'),40);assert.equal(run('S.court.gongde'),40);assert.equal(run('S.court.dutyAcc'),.75);assert.equal(run('S.courtPay'),1);assert.equal(run('S.court.duty.due-due'),12);
});
test('旧档功绩、已花余额、功德与零头均保留，新月份才按新速率增长',({run,val})=>{
  run(`S.court.merit=45;S.court.spent=12;S.court.gongde=80;S.court.dutyAcc=.75;var old=JSON.stringify(S.court);S=migrate(JSON.parse(JSON.stringify(S)));`);assert.equal(run('JSON.stringify(S.court)'),run('old'));
  run('S.months++;courtTick()');assert.equal(run('S.court.merit'),47);assert.equal(run('S.court.spent'),12);assert.equal(run('S.court.gongde'),82);assert.equal(run('S.court.dutyAcc'),.75);assert.equal(run('courtAvail()'),35);
});
test('辞官、下凡、后台模拟均不产生当值功绩',({run})=>{
  run(`var merit=S.court.merit;S.court.active=false;courtTick();S.court.active=true;S.plane='下界';courtTick();S.plane='仙界';S._bg=true;courtTick();`);assert.equal(run('S.court.merit'),run('merit'));
});
test('时间预演不提前记功，正式提交只记一次',({run})=>{
  run(`var judge={fate:10,months:12,cult:'日常',check:null};var forecast=forecastTurn(S,judge,'在仙庭当值一年');`);assert.equal(run('S.court.merit'),0);assert.equal(run('forecast.state.court.merit'),24);
  run(`var d={narrative:'他在仙庭当值一年，按期交接文书。',summary:'当值一年',playerChanges:{},options:[]};S=settleTurnOnce(S,d,'在仙庭当值一年',judge,'merit-year',forecast);S=settleTurnOnce(S,d,'在仙庭当值一年',judge,'merit-year',forecast);`);
  assert.equal(run('S.court.merit'),24);assert.equal(run('S.court.gongde'),24);
});
test('正常当值与差事奖励分别结算，不放大原差事奖励',({run})=>{
  run(`S.court.duty={id:'watch',type:'镇守',text:'镇守南天门一年',due:S.months+24,taken:true};advanceTime(12);applyCourt({courtDuty:'watch'});`);assert.equal(run('S.court.merit'),44);assert.equal(run('S.court.gongde'),44);
});
test('仙庭面板明确显示每月和全年当值功绩',({run})=>{
  assert.match(run('courtHtml()'),/正常当值每月 \+2 功绩（全年 \+24）/);assert.match(run('courtHtml()'),/闭关告假不记当值功绩/);
});
console.log(`${passed} court merit regressions passed`);
