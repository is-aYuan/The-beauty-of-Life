// 模块：富主题换题提示前端展示。后端负责策略，前端只负责把提示转换成按钮文案与动作。
export function getTopicTransitionSecondaryAction(transition) {
  return transition?.nextTopicId ? "switch" : "review";
}

export function getTopicTransitionSecondaryLabel(transition) {
  return transition?.nextTopicId ? "换个话题" : "去回忆库看看";
}
