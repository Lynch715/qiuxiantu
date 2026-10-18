// 所有伴侣统一约30%的主动同房平衡；NPC月度、旧孕期和历史数据不改。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {env,BASE}=require('./xjv2-env.cjs'),file=process.argv[2]||path.join(__dirname,'../index.html');let passed=0;
const near=(a,b)=>assert(Math.abs(a-b)<1e-12,a+' != '+b),test=(name,fn)=>{fn();passed++;console.log('✓ '+name);};
function setup(){const e=env(file,31);e.run(BASE);e.run(`S.player.age=30;S.player.realm=parseRealm('筑基初期');S.player.fert=1;S.player.hp=100;S.player.money=1e8;S.player.lifeBonus=1e6;S.npcs=S.npcs.filter(n=>n.name==='沈清');var wife=S.npcs[0];wife.age=30;wife.realm=parseRealm('筑基初期');wife.fert=1;wife['爱恋值']=80;wife.location=S.scene.location;wife.tags=[];S.player.tags=[];`);return e;}
test('主动同房统一28%–32%，差异仅小幅影响；NPC仍为原月度概率',()=>{
 const e=setup();near(e.run(`intimacyChance('沈清',true)`),.3111764705882353);near(e.run('pregChance(relOf(S.player.name,wife.name))'),.02*1.06*.5);
 e.run(`S.player.realm=parseRealm('大罗金仙中期');wife.realm=parseRealm('大罗金仙初期');`);near(e.run(`intimacyChance('沈清',true)`),.30058252427184466);
 e.run(`wife['爱恋值']=0;S.player.fert=.55;wife.fert=.52;`);near(e.run(`intimacyChance('沈清',true)`),.2850043744531933);
 e.run(`wife.fert=0;`);near(e.run(`intimacyChance('沈清',true)`),0);
});
test('同宅不同院落与实际同房不再多打四折，恋人主动安排也无月度偶遇折扣',()=>{
 const e=setup();e.run(`S.player.realm=parseRealm('化神初期');wife.realm=parseRealm('化神初期');S.scene.location='接引城·听雷居·正院';wife.location='接引城·听雷居·西厢';`);const p=e.run(`intimacyChance('沈清',true)`);e.run(`wife.location=S.scene.location;`);near(e.run(`intimacyChance('沈清',true)`),p);e.run(`relSet(S.player.name,wife.name,'恋人');`);near(e.run(`intimacyChance('沈清',true)`),p);
});
test('凡人至仙人、低高体质和感情统一落在28%–32%，概率随原有条件单调变化',()=>{
 const e=setup();e.run(`var cases=0;for(const major of [-1,0,1,2,4,12])for(const fert of [.01,.5,1,1.5,10])for(const love of [0,50,100]){S.player.realm={major,minor:1};wife.realm={major,minor:1};S.player.fert=wife.fert=fert;wife['爱恋值']=love;const p=intimacyChance(wife.name,true);if(!(p>=.28&&p<=.32))throw Error('概率越界 '+p);cases++;}`);assert.equal(e.run('cases'),90);
 e.run(`S.player.realm=wife.realm=parseRealm('大罗金仙初期');S.player.fert=wife.fert=1;wife['爱恋值']=0;var low=intimacyChance(wife.name,true);wife['爱恋值']=100;var high=intimacyChance(wife.name,true);`);assert(e.run('high>low'));
});
test('任意更名不改变概率，正式受孕逻辑没有石昊/沈清漪专属判断',()=>{
 const e=setup(),before=e.run(`intimacyChance('沈清',true)`);e.run(`S.player.name='任意甲';wife.name='任意乙';S.rels=[];relSet(S.player.name,wife.name,'夫妻');`);near(e.run(`intimacyChance('任意乙',true)`),before);
 for(const name of ['pregChance','intimacyChance','resolveIntimacy'])assert(!/石昊|沈清漪/.test(e.run(name+'.toString()')));
});
test('未成年、孕期、产后、超生育年龄、异地、重伤、亲属和同性仍为零',()=>{
 for(const edit of ['wife.age=17','wife.preg={with:S.player.name,due:999}','wife.lastBirthDay=S.elapsedDays','wife.age=200','wife.location="远方"','wife.hp=10','wife.parents={father:S.player.name}','wife.gender="男"']){const e=setup();e.run(edit);assert.equal(e.run(`intimacyChance('沈清',true)`),0,edit);}
});
test('概率与家室面板只读；缺省个体率不掷骰、不补写，未知时不显示虚假精确概率',()=>{
 const a=setup(),b=setup();for(const e of [a,b])e.run(`delete S.player.fert;delete wife.fert;`);const before=b.run('JSON.stringify(S)');b.run(`intimacyChance('沈清',true);familyPartnerCards();`);assert.equal(b.run('JSON.stringify(S)'),before);assert(!b.run('familyPartnerCards()').includes('本次受孕率约'));assert.equal(b.run('Math.random()'),a.run('Math.random()'));
 const e=setup();e.run(`S.player.fert=.55;wife.fert=.52;wife['爱恋值']=0;S.player.realm=parseRealm('大罗金仙中期');wife.realm=parseRealm('大罗金仙初期');`);assert(e.run('familyPartnerCards()').includes('本次受孕率约 28.5%'));
});
test('随机阈值确实使用新概率，失败不补偿、不清历史；读档保留已有日志和孕期',()=>{
 const e=setup();e.run(`S.player.fert=.55;wife.fert=.52;wife['爱恋值']=0;S.player.realm=parseRealm('大罗金仙中期');wife.realm=parseRealm('大罗金仙初期');wife.memory=['原记忆'];wife.life=['原经历'];S.intimacyLog=[{day:0,with:'沈清',conceived:false}];`);
 assert.equal(e.force(.29,()=>e.run(`resolveIntimacy('沈清')`)).conceived,false);assert.equal(e.force(.28,()=>e.run(`resolveIntimacy('沈清')`)).conceived,true);assert.equal(e.run('wife.preg.due-wife.preg.since'),300);assert.equal(e.run('S.intimacyLog.length'),3);assert.equal(e.run('wife.memory[0]'),'原记忆');assert.equal(e.run('wife.life[0]'),'原经历');
 const preg=e.run('JSON.stringify(wife.preg)'),logs=e.run('JSON.stringify(S.intimacyLog)');e.run('S=JSON.parse(JSON.stringify(S));migrate(S);wife=findNpc("沈清");');assert.equal(e.run('JSON.stringify(wife.preg)'),preg);assert.equal(e.run('JSON.stringify(S.intimacyLog)'),logs);
});
test('十万次独立阈值抽样符合约28.5%，不会把30%再乘成几个百分点',()=>{
 const e=setup();e.run(`S.player.fert=.55;wife.fert=.52;wife['爱恋值']=0;S.player.realm=parseRealm('大罗金仙中期');wife.realm=parseRealm('大罗金仙初期');var chance=intimacyChance('沈清',true),hits=0;for(let i=0;i<100000;i++)if(Math.random()<chance)hits++;`);assert(Math.abs(e.run('hits/100000')-.2850043744531933)<.004);console.log('  抽样受孕率 '+(e.run('hits/100000')*100).toFixed(3)+'%');
});
if(process.env.REAL_SAVE)test('石昊旧档：沈清漪同宅不同院约28.5%，现有记忆、人物、物品、孕期与日志完整保留',()=>{
 const bytes=fs.readFileSync(process.env.REAL_SAVE),e=env(file,31);e.run('v=>{S=v;saveGame=()=>{};migrate(S)}')(JSON.parse(bytes));const before=e.run('JSON.stringify(S)');near(e.run(`intimacyChance('沈清漪',true)`),.2850043744531933);assert(e.run('familyPartnerCards()').includes('本次受孕率约 28.5%'));assert.equal(e.run('JSON.stringify(S)'),before);assert.equal(fs.readFileSync(process.env.REAL_SAVE).compare(bytes),0);
});
console.log(passed+' intimacy chance regressions passed');
