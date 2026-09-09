export const SCHEMA_VERSION = 9;
export const PROMPT_VERSION = 'v9.0';

export const DEFAULT_SETTINGS = {
  practice_open: true,
  formal_round1_open: false,
  formal_round2_open: false,
  formal_round_count: 2,
  max_chat_minutes: 25,
  test_repeat_count: 3,
  enable_self_verification: true,
  shared_rules_of_thumb: '',
};

export const CONDITIONS = ['scaffold', 'regular', 'unassigned'];

export const PARACHUTE_CONTEXT = {
  title: '模型降落伞设计学习',
  goal: '在统一材料、载荷与投放条件下，设计能够可靠展开、较稳定下降并尽可能延长下降时间的模型降落伞。',
  test_rules: ['统一投放高度', '统一载荷', '统一操作方法', '采用统一有效测试规则'],
  science: ['重力', '空气阻力', '公平测试', '控制变量'],
};

export const SHOPPING_BAG_CASE = {
  title: 'Shopping Bag Failure Practice',
  note: '这是平台操作练习，不参与正式研究统计。',
  background: '一个纸质购物袋接受统一承重测试。测试后，一侧提手从袋身连接处脱开；袋身其他部位基本保持完整。',
  evidence: [
    '一侧提手从袋身连接处脱开。',
    '袋身其他位置没有出现同样程度的破坏。',
    '测试条件保持一致；平台只提供可观察到的失效现象，不直接给出原因和修改答案。',
  ],
};

export function sharedTaskContext(settings = DEFAULT_SETTINGS) {
  return [
    `【任务目标】\n${PARACHUTE_CONTEXT.goal}`,
    `【测试规则】\n${PARACHUTE_CONTEXT.test_rules.map(x => `- ${x}`).join('\n')}`,
    `【共同科学知识】\n${PARACHUTE_CONTEXT.science.map(x => `- ${x}`).join('\n')}`,
    `【全班共同设计规律】\n${String(settings.shared_rules_of_thumb || '').trim() || '暂未填写。'}`,
  ].join('\n\n');
}
