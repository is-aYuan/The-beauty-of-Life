// 模块：首页标题生成。避免用“爷爷/奶奶”猜测称谓，让标题保持中性和稳妥。
export function buildMemoirTitle(userName) {
  const name = typeof userName === 'string' ? userName.trim() : '';
  return name ? `${name}的回忆录` : '我的回忆录';
}
