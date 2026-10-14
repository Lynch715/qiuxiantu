// 修仙版假模型：按提示词类型返回对应 JSON，字段照《求仙途》新的输出格式
function npc(name,rel,id,realm,align,fac,extra){
  return Object.assign({name,gender:'男',age:40,identity:id,faction:fac||'散修',alignment:align||'中立',realm,linggen:'火土双灵根',tags:['孤僻'],
    personality:['寡言'],appearance:'普通',谈吐:50,signature:'烈火诀',relation:rel,好感度:30,爱恋值:null,mood:'平静',alive:true,
    secret:'他欠着坊市一笔灵石',notes:''},extra||{});
}
let turnNo=0, aftNo=0;
const LOC=['青石镇','落云坊市','青云宗外门','后山洞府','黑木林'];
function pickBody(prompt){
  if(prompt.includes('请为这片修真大陆铸造当世格局')) return {
    land:{name:'苍澜洲',desc:'群山连绵，灵脉多在北边'},
    factions:[{name:'青云宗',alignment:'正派',power:72,leader:'云中岳',desc:'剑修'},
              {name:'百草谷',alignment:'正派',power:55,leader:'林素问',desc:'丹道'},
              {name:'血煞门',alignment:'邪道',power:60,leader:'厉无咎',desc:'魔修'},
              {name:'孟家',alignment:'中立',power:40,leader:'孟老祖',desc:'修仙世家'}],
    mortal:[{name:'大燕国',desc:'凡人王朝'}],
    ranking:[{name:'云中岳',gender:'男',faction:'青云宗',realm:'化神初期',note:'一剑开山'},
             {name:'林素问',gender:'女',faction:'百草谷',realm:'元婴后期',note:'丹道第一'},
             {name:'厉无咎',gender:'男',faction:'血煞门',realm:'元婴中期',note:'血河大法'},
             {name:'孟老祖',gender:'男',faction:'孟家',realm:'金丹大圆满',note:'活了二百多年'}],
    events:['青云宗三月后开山收徒','黑木林里有妖兽出没','落云坊市灵石涨价']};
  if(prompt.includes('现在请生成这位主角并开局')) return {
    player:{name:'韩七',gender:'男',orientation:'异性恋',appearance:'黑瘦，手上有老茧',personality:['谨慎','寡言'],
      backgroundType:'药农人家',backstory:'父亲进山采药，三年没回来。',attributes:{谈吐:40,武功:80,颖悟:99},
      声望:2,凶名:0,money:6,faction:'凡人',skills:{'采药':{level:40,desc:'认得几十种灵草'}},
      arts:[{name:'长春功',desc:'最粗浅的吐纳法门',style:'护体',level:20}],
      items:{法器:[{name:'青钢短剑',desc:'镇上铁匠打的',grade:'黄阶下品'}],玉简:[],丹药:[{name:'聚气散',desc:'一小包'}],符箓:[{name:'火球符',desc:'两张'}],灵材:[],其他:[]},
      status:[]},
    npcs:[npc('韩母','母亲','药农的遗孀','凡人','中立','凡人',{gender:'女',age:44,linggen:'无'}),
          npc('柳青','青梅竹马','镇上郎中的女儿','炼气二阶','中立','凡人',{gender:'女',age:17,tags:['众生相']}),
          npc('赵坤','仇人','孟家外围子弟','炼气七阶','中立','孟家',{age:26})],
    quests:[{title:'拜入青云宗',desc:'三个月后收徒'},{title:'找到父亲的下落',desc:'他进了黑木林'}],
    opening:'天还没亮，韩七把背篓里的草药又数了一遍。\n柳青隔着篱笆叫他，他没应。',
    scene:{location:'青石镇',unresolved:['父亲的下落']},
    rumors:['青云宗要收徒了'],
    options:[{text:'去落云坊市卖掉草药',hint:'稳妥',type:'normal',days:3},
             {text:'回屋打坐吐纳',hint:'耗时',type:'rest',months:2},
             {text:'去找赵坤讨回被抢的灵草',hint:'凶险',type:'duel',duel:{opponent:'赵坤',lethal:false}},
             {text:'和柳青说说话',hint:'',type:'talk',target:'柳青'}]};
  if(prompt.includes('请把这场斗法写出来')) return {
    narrative:'火光一闪，两人各自退开。\n赵坤捂着胳膊，没再上前。',summary:'和赵坤动了一回手',
    scene:{location:'青石镇',unresolved:[]},check:null,
    playerChanges:{attributes:{},fame:{声望:1,凶名:0},money:0,skills:{},artsAdd:[],artsTrain:[{name:'长春功',level:1}],statusAdd:[],statusRemove:[],itemsAdd:{},itemsRemove:[]},
    npcUpdates:[{name:'赵坤',好感度:-5}],newNpcs:[],npcEvents:[],rumors:[],newVendettas:[],questUpdates:[],newQuests:[],rankingUpdates:[],rankingAdd:[],factionUpdates:[],duel:null,
    options:[{text:'回家把伤养好',hint:'',type:'rest',months:1},{text:'去坊市看看',hint:'',type:'normal',days:3}],
    gameOver:false,ending:null};
  if(/【玩家本回合行动】与.{1,10}谈过之后/.test(prompt)){ aftNo++; return {
    narrative:'话说完了，院里只剩风声。\n'+'柳青把一包干粮塞给他，转身进了屋，门没关严，灯一直亮到后半夜。'.repeat(6),summary:'谈完之后',
    scene:{location:'青石镇',unresolved:['父亲的下落']},check:null,playerChanges:{},
    npcUpdates:[],newNpcs:[],npcEvents:[],rumors:[],newVendettas:[],questUpdates:[],newQuests:[],rankingUpdates:[],rankingAdd:[],factionUpdates:[],duel:null,
    options:[{text:'去黑木林边上看看'+aftNo,hint:'',type:'normal',days:2},{text:'回屋打坐',hint:'',type:'rest',months:1},{text:'去坊市'+aftNo,hint:'',type:'normal',days:3}],
    gameOver:false,ending:null}; }
  if(prompt.includes('请推演本回合')){
    turnNo++;
    const t=turnNo;
    const body={
      narrative:`第${t}回的日子。\n`+'韩七把灵石数了一遍，揣回怀里。屋外有人敲了两下门，他没应声，等脚步声走远了才起身。'.repeat(6),summary:'第'+t+'回的事',
      scene:{location:LOC[t%LOC.length],unresolved:['父亲的下落'],present:[]},check:null,
      // 武功、悟性的增减引擎应当不收；体魄可以小涨；lingli 是奇遇灵力
      playerChanges:{attributes:{武功:30,悟性:10,体魄:1},lingli:t%7===0?5000:0,lingliReason:'吞了一颗朱果',hp:t%3?-3:5,fame:{声望:1,凶名:0},money:4,contrib:t>10?6:0,
        skills:{},artsAdd:[],artsTrain:[{name:'长春功',level:2}],statusAdd:[],statusRemove:[],
        itemsAdd:t===5?{法器:[{name:'玄铁飞剑',desc:'坊市淘来的',grade:'玄阶中品'}]}:{},itemsRemove:[]},
      npcUpdates:[{name:'柳青',好感度:2,realm:t===8?'炼气三阶':null},{name:'赵坤',realm:t===9?'金丹后期':null}],
      newNpcs:t===4?[npc('周管事','萍水相逢','落云坊市丹铺管事','筑基中期','中立','百草谷',{linggen:'木灵根'})]:(t===6?[npc('老药农','萍水相逢','山里的采药人','凡人','中立','凡人')]:[]),
      npcEvents:[],rumors:t%5===0?['黑木林又有人失踪']:[],
      newVendettas:[],questUpdates:[{title:'拜入青云宗',progress:3,status:'进行中'}],newQuests:[],
      rankingUpdates:[],rankingAdd:[],factionUpdates:[],duel:null,
      options:[{text:'回洞府闭关',hint:'',type:'rest',months:6},
               {text:'去坊市打听消息'+t,hint:'',type:'normal',days:3},
               {text:'试着画一张符',hint:'',type:'check',days:5,check:{attr:'神识',need:55}}],
      gameOver:false,ending:null};
    if(t===3) body.playerChanges.faction='青云宗';
    return body;
  }
  if(prompt.includes('你现在扮演修真界中的人物')) return {
    reply:'（她把药篓放下）「你又要进山？」',innerThought:'他瘦了',mood:'担心',favor:3,
    attempt:null,revealSecret:false,endTalk:false,
    effects:{money:3,give:[{cat:'丹药',name:'止血散',desc:'她自己配的'}],info:'黑木林北边有人见过你爹'},
    summary:'和柳青说了几句'};
  if(prompt.includes('请把它压成一段')) return {text:'早年在青石镇采药，与柳青交好，与赵坤结怨。'};
  if(prompt.includes('墓志铭')) return {biography:'韩七一生……',epitaph:'采药人',verdict:'谨慎'};
  return {narrative:'（未知提示）',summary:'',options:[]};
}
function sse(obj){
  const s=JSON.stringify(obj); const chunks=[];
  for(let i=0;i<s.length;i+=400) chunks.push(s.slice(i,i+400));
  return chunks.map(c=>'data: '+JSON.stringify({choices:[{delta:{content:c}}]})+'\n\n').join('')
    +'data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';
}
module.exports={pickBody,sse};
