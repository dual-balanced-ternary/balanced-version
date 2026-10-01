// Positional DBT arithmetic. Each digit encodes (fixes, features); radix is 3.
export const DIGITS = Object.freeze({
  1: [0, 1], 2: [-1, -1], 3: [1, 0], 4: [1, -1], 5: [0, 0],
  6: [-1, 1], 7: [-1, 0], 8: [1, 1], 9: [0, -1],
});
const symbols = new Map(Object.entries(DIGITS).map(([digit, pair]) => [pair.join(','), digit]));
const power = p => 3n ** BigInt(p);

export function coordinate(x, y, precision = 0) {
  if (!Number.isInteger(precision) || precision < 0 || precision > 12) throw new Error('精度必须在 0–12 位之间。');
  if ([x, y].some(n => typeof n === 'number' && !Number.isSafeInteger(n))) throw new Error('坐标必须是安全整数；更大的整数请使用 BigInt。');
  x = BigInt(x); y = BigInt(y);
  while (precision > 0 && x % 3n === 0n && y % 3n === 0n) { x /= 3n; y /= 3n; precision--; }
  return Object.freeze({ x, y, precision });
}

export function parse(input) {
  if (typeof input !== 'string') throw new Error('请输入 DBT 版本号。');
  const raw = input.trim().replace(/^&/, '');
  if (!/^[1-9]+(?:\.[1-9]+)?$/.test(raw)) throw new Error('只使用数字 1–9，以及至多一个小数点，例如 &14.8。');
  const [whole, fractional = ''] = raw.split('.');
  if (whole.length > 48 || fractional.length > 12) throw new Error('整数最多 48 位，小数最多 12 位。');
  let x = 0n, y = 0n;
  for (const digit of whole + fractional) { const [dx, dy] = DIGITS[digit]; x = x * 3n + BigInt(dx); y = y * 3n + BigInt(dy); }
  return coordinate(x, y, fractional.length);
}

function balanced(value) {
  const digits = [];
  while (value !== 0n) {
    let remainder = ((value % 3n) + 3n) % 3n;
    if (remainder === 2n) remainder = -1n;
    digits.push(Number(remainder)); value = (value - remainder) / 3n;
  }
  return digits;
}

export function format(value) {
  const v = coordinate(value.x, value.y, value.precision);
  const x = balanced(v.x), y = balanced(v.y);
  const length = Math.max(x.length, y.length, v.precision + 1);
  let result = '';
  for (let i = length - 1; i >= 0; i--) {
    result += symbols.get(`${x[i] || 0},${y[i] || 0}`);
    if (v.precision && i === v.precision) result += '.';
  }
  return `&${result}`;
}

export function add(a, b) {
  const p = Math.max(a.precision, b.precision);
  return coordinate(a.x * power(p - a.precision) + b.x * power(p - b.precision), a.y * power(p - a.precision) + b.y * power(p - b.precision), p);
}
export function step(digit, precision = 0) {
  if (!(digit in DIGITS)) throw new Error('未知 DBT 方向。');
  const [x, y] = DIGITS[digit]; return coordinate(x, y, precision);
}
export function equals(a, b) { return format(a) === format(b); }
export function dominates(a, b) {
  const p = Math.max(a.precision, b.precision);
  return a.x * power(p - a.precision) >= b.x * power(p - b.precision) && a.y * power(p - a.precision) >= b.y * power(p - b.precision);
}
export function fraction(value, axis) {
  const n = value[axis], denominator = power(value.precision);
  if (n % denominator === 0n) return String(n / denominator);
  let numerator = n, divisor = denominator;
  while (divisor > 1n && numerator % 3n === 0n) { numerator /= 3n; divisor /= 3n; }
  return `${numerator}/${divisor}`;
}
export function numeric(value, axis) { return Number(value[axis]) / Number(power(value.precision)); }
export function serialize(value) { return { version: format(value), features: fraction(value, 'y'), fixes: fraction(value, 'x') }; }
