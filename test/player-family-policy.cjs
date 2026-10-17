// 历史优化测试的对照适配：仅屏蔽旧版“每月自动给主角受孕”这一项已获批准的玩法变更。
// 原公式、NPC之间的生育、已有孕期及其余状态/RNG仍用各自原引擎；不替换任何演化函数。
module.exports=function playerFamilyPolicy(engine){engine.run(`{const passivePregChance=pregChance;pregChance=function(r){return r.a===playerName()||r.b===playerName()?0:passivePregChance(r);};}`);return engine;};
