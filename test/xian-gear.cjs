// 仙界法宝：合成局，验证实际生成/购买/赠礼路径，不读取真实存档。
const assert=require('node:assert/strict'),env=require('./power-scale-env.cjs');
let count=0;function test(name,f){f(env());count++;console.log('✓ '+name);}
const xian=`S.plane='仙界';S.player.realm=parseRealm('地仙初期');S.player.money=100;S.player.egg=null;S.player.items.法器=[];`;
test('二十一种原型从灵宝到道宝连续覆盖，各有器形与来路',({run,val})=>{
  const defs=val('XIAN_GEAR');assert.equal(defs.length,21);assert.equal(new Set(defs.map(d=>d.name)).size,21);
  assert.deepEqual(defs.map(d=>d.g),Array.from({length:21},(_,i)=>i+13));
  for(const d of defs){const it=val(`xianGearItem(${d.g},'测试秘境')`);assert.equal(it.name,d.name);assert.equal(it.bonus,d.g);assert.equal(run(`gradeIndex('${it.grade}')`),d.g);assert(it.desc.includes('测试秘境'));assert(d.source);}
});
test('仙人手中的下界法宝仍有强弱，天阶上品略低于入门灵宝，零品无加成',({run,val})=>{
  run(xian);const scores=val('Array.from({length:14},(_,g)=>gradePow(g,S.player))');
  assert.equal(scores[0],0);for(let i=1;i<scores.length;i++)assert(scores[i]>scores[i-1]);
  assert.equal(scores[12],0.5);assert(scores[13]-scores[12]<0.1);
  assert.equal(run(`weaponPower(normWeapon({grade:'天阶上品'}))`),5);assert.equal(run('weaponPower(xianGearItem(13))'),6);
  assert.equal(run(`gradePow(12,{realm:parseRealm('大乘后期')})`),12);
});
test('越级宝物发挥受限，多件法宝逐件叠加；普通旧宝迁移后不升品',({run})=>{
  run(xian+`S.player.items.法器=[normWeapon({name:'祖传剑',grade:'天阶上品'})];S=migrate(S);`);
  assert.equal(run('S.player.items.法器[0].grade'),'天阶上品');
  assert(run('gradePow(33,S.player)')<run('gradePow(33,{realm:parseRealm("大罗金仙后期")})'));
  run(`S.player.items.法器=[xianGearItem(13),xianGearItem(15)]`);assert.equal(run('weaponBonus(S.player)'),run('weaponPower(S.player.items.法器[0])+weaponPower(S.player.items.法器[1])'));
});
test('仙市实际付款入囊、年度限购；缺钱和重复购买不扣钱、不发物',({run,val})=>{
  run(xian);assert.equal(run(`marketBuy('青罡仙剑').ok`),true);assert.equal(run('S.player.money'),92);
  assert.equal(run('S.player.items.法器[0].grade'),'灵宝下品');assert.equal(run('S.player.items.法器[0].bonus'),13);
  let before=val('[S.player.money,S.player.items]');assert.equal(run(`marketBuy('青罡仙剑').ok`),false);assert.deepEqual(val('[S.player.money,S.player.items]'),before);
  run('S.player.money=0');before=val('[S.player.money,S.player.items]');assert.equal(run(`marketBuy('镇岳仙印').ok`),false);assert.deepEqual(val('[S.player.money,S.player.items]'),before);
});
test('旧货单补新增法宝，已售罄货物保留；换年后重新进货',({run})=>{
  run(xian+`S.market={year:Math.floor(S.months/12),stock:{聚仙丹:false,青罡仙剑:false}};marketStock();`);
  assert.equal(run('S.market.stock.聚仙丹'),false);assert.equal(run('S.market.stock.青罡仙剑'),false);assert.equal(run('S.market.stock.流云护元衣'),true);
  run('S.months+=12;marketStock()');assert.equal(run('S.market.stock.青罡仙剑'),true);
});
test('宗门兑换法宝进入法器栏，扣贡献余额；失败不改变资产',({run,val})=>{
  run(xian+`S.sect={name:'清微仙宗',contrib:300,spent:0};var pills=S.player.items.丹药.length;`);
  assert.equal(run(`sectBuy('镇岳仙印').ok`),true);assert.equal(run('S.sect.spent'),280);assert.equal(run('S.sect.contrib'),300);
  assert.equal(run('S.player.items.法器[0].bonus'),15);assert.equal(run('S.player.items.丹药.length'),run('pills'));
  const before=val('[S.sect,S.player.items]');assert.equal(run(`sectBuy('青罡仙剑').ok`),false);assert.deepEqual(val('[S.sect,S.player.items]'),before);
});
test('下界商店不能买入或兑换仙界法宝，仙市不能购买道宝',({run,val})=>{
  run(`S.plane='下界';S.sect={name:'青云宗',contrib:1000,spent:0};S.player.money=10000;`);
  const before=val('[S.player.money,S.player.items,S.sect]');assert.equal(run(`marketBuy('青罡仙剑').ok`),false);assert.equal(run(`sectBuy('青罡仙剑').ok`),false);assert.deepEqual(val('[S.player.money,S.player.items,S.sect]'),before);
  run(xian);assert.equal(run(`marketBuy('太初道图').ok`),false);
});
test('三档仙境实际掉落使用预设库且不超秘境档次，下界仍用原物品池',({run,val})=>{
  run(xian);
  for(const [key,lo,hi,major] of [['xsmall',13,18,8],['xmid',19,24,10],['xlarge',25,33,14]]){
    run(`S.player.realm.major=${major}`);let found=0;
    for(let i=0;i<200;i++){const b=val(`realmBeat({key:'${key}',name:'试炼仙府'},20)`),got=b.got||(b.foe&&b.foe.got);if(got&&got.cat==='法器'){found++;assert(got.item.xianTemplate);assert(got.item.bonus>=lo&&got.item.bonus<=hi);}}
    assert(found>20);
  }
  run(`S.plane='下界';S.player.realm=parseRealm('金丹初期')`);let found=0;
  for(let i=0;i<200;i++){const b=val(`realmBeat({key:'small',name:'试炼山谷'},20)`),got=b.got||(b.foe&&b.foe.got);if(got&&got.cat==='法器'){found++;assert(!got.item.xianTemplate);assert(got.item.bonus<=6);}}
  assert(found>20);
});
test('仙界炼器熟人赠礼采用其境界对应原型，原有赠礼节奏保留',({run})=>{
  run(xian+`S.npcs=[normNpc({name:'方炉',age:5000,realm:'天仙初期',identity:'炼器师',好感度:90})];Math.random=()=>0;npcGiftMonth([]);`);
  assert.equal(run('S.player.items.法器.length'),1);assert.equal(run('S.player.items.法器[0].bonus'),16);assert.equal(run('S.player.items.法器[0].name'),'霆光玄剑');
  run('npcGiftMonth([])');assert.equal(run('S.player.items.法器.length'),1);
});
test('预设物漏填品阶时按原型补齐，已有重炼品阶不被覆盖',({run})=>{
  assert.equal(run(`normWeapon({name:'归墟道尺'}).bonus`),31);
  assert.equal(run(`normWeapon({name:'青罡仙剑',grade:'玄宝中品'}).bonus`),17);
  assert.equal(run(`normWeapon({name:'普通飞剑'}).bonus`),4);
});
test('真实商店渲染与模型规则覆盖宝录、价格、来源和无额外被动约束',({run})=>{
  run(xian+`var modalBody='';xModal=(title,subtitle,body)=>{modalBody=body};openShop();`);
  for(const t of ['仙界宝录','青罡仙剑','太初道图','灵宝下品','地仙','大罗金仙','8 仙晶'])assert(run('modalBody').includes(t),t);
  const prompt=run('xianRulesText()');for(const t of ['不会因飞升自动升品','已有成长标记','不得重复发放','不虚构额外','青罡仙剑','8、16、28'])assert(prompt.includes(t),t);
});
console.log(`\n${count} xian gear regressions passed`);
