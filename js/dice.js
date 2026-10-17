// Dice notation: "1d20+5", "2d6 + 1d4 + 3", "d8-1". Advantage/disadvantage applies to a single d20.

const rnd = sides => {
  const a = new Uint32Array(1);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  return (a[0] % sides) + 1;
};

export function parse(expr) {
  const s = String(expr || '').replace(/\s+/g, '').toLowerCase().replace(/−/g, '-');
  if (!s) return null;
  const terms = [];
  const re = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g;
  let m, used = 0;
  while ((m = re.exec(s))) {
    if (m.index !== used) return null;
    used = re.lastIndex;
    if (m[3]) {
      const count = m[2] === '' ? 1 : +m[2], sides = +m[3];
      if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
      terms.push({ kind: 'dice', sign: m[1] === '-' ? -1 : 1, count, sides });
    } else terms.push({ kind: 'flat', sign: m[4] === '-' ? -1 : 1, value: +m[5] });
  }
  return used === s.length && terms.length ? terms : null;
}

// mode: 'normal' | 'adv' | 'dis'
export function roll(expr, mode = 'normal') {
  const terms = parse(expr);
  if (!terms) return null;
  const singleD20 = terms.filter(t => t.kind === 'dice').length === 1 && terms.some(t => t.kind === 'dice' && t.sides === 20 && t.count === 1);
  let total = 0; const parts = []; let nat = null; let dropped = null;
  for (const t of terms) {
    if (t.kind === 'flat') { total += t.sign * t.value; parts.push({ flat: t.sign * t.value }); continue; }
    const rolls = [];
    for (let i = 0; i < t.count; i++) rolls.push(rnd(t.sides));
    if (singleD20 && t.sides === 20 && mode !== 'normal') {
      const second = rnd(20); const pair = [rolls[0], second];
      const keep = mode === 'adv' ? Math.max(...pair) : Math.min(...pair);
      dropped = keep === pair[0] ? pair[1] : pair[0];
      rolls[0] = keep;
    }
    if (singleD20 && t.sides === 20) nat = rolls[0];
    const sum = rolls.reduce((a, b) => a + b, 0);
    total += t.sign * sum;
    parts.push({ sides: t.sides, sign: t.sign, rolls });
  }
  return { expr: String(expr), mode: singleD20 ? mode : 'normal', total, parts, nat, dropped, crit: nat === 20, fumble: nat === 1, at: Date.now() };
}

export const withBonus = (base, bonus) => bonus ? `${base}${bonus >= 0 ? '+' : ''}${bonus}` : base;
