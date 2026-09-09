export const DEFAULT_SETTINGS = {
  practice_open: true,
  formal_v2_open: false,
  ai_stage_open: false,
  v3_submission_open: false,
  number_of_test_trials: 3,
  max_chat_minutes: 25,
  shared_rules_of_thumb: '',
};

export const PARACHUTE_CONTEXT = {
  title: '模型降落伞设计学习',
  goal: '在统一材料、载荷与投放条件下，设计能够可靠展开、较稳定下降并尽可能延长下降时间的模型降落伞。',
  test_rules: ['统一投放高度', '统一载荷', '统一操作方法', '采用统一有效测试规则'],
  science: ['重力', '空气阻力', '公平测试', '控制变量'],
};

export const SHOPPING_BAG_CASE = {
  title: 'Shopping Bag Failure Practice',
  note: '这是平台操作练习，不影响后面的正式任务。',
  evidence: [
    '一个购物袋在承重测试中，提手连接处首先出现明显拉长和撕裂。',
    '袋身其他位置没有出现同样程度的破坏。',
    '已知条件：本案例使用同一承重测试条件，当前只提供失败位置与现象，不额外给出原因。',
    '请只根据当前案例证据先形成自己的判断，再与AI讨论。',
  ],
};

export const GROUPS = ['structured', 'autonomous', 'unassigned'];

// 研究者人工评分字段。Q2是V2产品设计质量；GEHI不计算总分。
export const SCORE_FIELDS = ['Q2','G0','E0','H0','I0','G1','E1','H1','I1'];
export const Q2_ALLOWED_VALUES = [0, 2.5, 5, 7.5, 10];

export function sharedTaskContext(settings = DEFAULT_SETTINGS) {
  return [
    `【任务目标】\n${PARACHUTE_CONTEXT.goal}`,
    `【测试规则】\n${PARACHUTE_CONTEXT.test_rules.map(x => `- ${x}`).join('\n')}`,
    `【共同科学知识】\n${PARACHUTE_CONTEXT.science.map(x => `- ${x}`).join('\n')}`,
    `【全班共同设计规律】\n${settings.shared_rules_of_thumb?.trim() || '暂未填写。'}`,
  ].join('\n\n');
}
