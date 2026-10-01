import { add, coordinate, format, step, serialize } from './dbt.mjs';

export const ACTIONS = {
  feature: { label: '功能增加', digit: '1', color: 'feature', description: '沿功能轴向上，增加一次选定尺度的功能迭代。' },
  fix: { label: 'Bug 修复', digit: '3', color: 'fix', description: '沿修复轴向右，记录一次选定尺度的修复。' },
  preview: { label: '实验版本', digit: '7', color: 'preview', description: '沿 7 方向引入不稳定功能，完成验证后再计入稳定功能。' },
  promote: { label: '转为稳定', digit: '8', color: 'feature', description: '完成测试与发布验证后，撤销 7 偏移，再沿 1 方向计入稳定功能；这是功能成熟，不是一次独立修复。' },
};

export function propose(current, action, precision) {
  if (!ACTIONS[action] || !Number.isInteger(precision) || precision < 0 || precision > 3) throw new Error('无效的迭代设置。');
  if (current.channel === 'preview') {
    if (action !== 'promote') throw new Error('请先验证实验版本并到达目标稳定版。');
    return { value: current.target, channel: 'stable', target: null, action, precision: current.precision };
  }
  if (action === 'promote') throw new Error('当前已经是稳定版本。');
  if (action === 'preview') {
    const target = add(current.value, step('1', precision));
    return { value: add(current.value, step('7', precision)), channel: 'preview', target, action, precision };
  }
  return { value: add(current.value, step(ACTIONS[action].digit, precision)), channel: 'stable', target: null, action, precision };
}

export function initialReleases() {
  const history = [{ id: 1, value: coordinate(0, 0), channel: 'stable', target: null, action: 'origin', precision: 0, title: '从原点开始', date: '09.18', note: '建立项目，功能与修复坐标均为零。' }];
  const examples = [
    ['feature', 0, '第一个可用功能', '09.19', '建立基础版本管理流程。'],
    ['feature', 0, '加入二维版本轨迹', '09.22', '新增坐标视图；平衡三进制自动进位。'],
    ['fix', 0, '修复版本解析', '09.24', '校正数字映射与进位边界。'],
    ['feature', 1, '增加小规模迭代', '09.27', '进入小数第一位，以 1/3 的尺度增加功能。'],
    ['fix', 1, '改善小数显示', '09.30', '保留精确分数，规范化无意义的零位。'],
  ];
  for (const [action, precision, title, date, note] of examples) history.push({ ...propose(history.at(-1), action, precision), id: history.length + 1, title, date, note });
  return history;
}

export function releaseDocument(releases) {
  return {
    schema: 'balanced-version/v2', axes: { stableFeatures: '1', fixes: '3', unstableFeatures: '7', backwardCompatibility: '9' }, radix: 3,
    releases: releases.map(r => ({ id: r.id, action: r.action, ...serialize(r.value), channel: r.channel, target: r.target ? format(r.target) : null, precision: r.precision, title: r.title, note: r.note })),
  };
}
