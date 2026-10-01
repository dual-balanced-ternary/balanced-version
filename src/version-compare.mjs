import { parse } from './dbt.mjs';

// Align fractional scales with integers; never compare characters or floats.
export function compareAddresses(left, right) {
  const a = typeof left === 'string' ? parse(left) : left;
  const b = typeof right === 'string' ? parse(right) : right;
  const p = Math.max(a.precision, b.precision);
  const scale = v => 3n ** BigInt(p - v.precision);
  const dx = a.x * scale(a) - b.x * scale(b);
  const dy = a.y * scale(a) - b.y * scale(b);
  const sign = n => n === 0n ? 0 : n > 0n ? 1 : -1;
  const relation = dx === 0n && dy === 0n ? 'equal' : dx >= 0n && dy >= 0n ? 'greater' : dx <= 0n && dy <= 0n ? 'less' : 'incomparable';
  return { relation, order: sign(dy) || sign(dx) };
}

export function compareReleaseSequence(a, b) {
  for (const r of [a,b]) {
    if (typeof r.project !== 'string' || !r.project || typeof r.line !== 'string' || !r.line || !/^(0|[1-9][0-9]*)$/.test(r.sequence) || typeof r.sequence !== 'string') throw new Error('发布记录需要 project、line 与规范十进制字符串 sequence。');
  }
  if (a.project !== b.project || a.line !== b.line) return null;
  const left=BigInt(a.sequence), right=BigInt(b.sequence);
  return left===right?0:left<right?-1:1;
}
