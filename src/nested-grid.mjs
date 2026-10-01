import { DIGITS, format, parse, numeric } from './dbt.mjs';
const order = [6,1,8,7,5,3,2,9,4];
const escape = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

// A prefix selects a square; the next balanced digit selects its third.
export function addressCells(value, integerDigits) {
  const [whole, fractional=''] = format(value).slice(1).split('.');
  const digits = whole.padStart(integerDigits,'5') + fractional;
  let x=0, y=0, size=3 ** integerDigits;
  return [...digits].map((digit,index) => {
    size /= 3;
    x += DIGITS[digit][0] * size; y += DIGITS[digit][1] * size;
    return { digit, x, y, size, exponent: integerDigits-index-1 };
  });
}

export function nestedGrid(releases, selected, candidate, color) {
  const values = [...releases.map(r=>r.value),candidate.value,...(candidate.target?[candidate.target]:[])];
  const length = Math.max(2,...values.map(v=>format(v).slice(1).split('.')[0].length));
  const extent = 3 ** length, side=342, left=20, top=40;
  const px = v => left+side/2+numeric(v,'x')/extent*side;
  const py = v => top+side/2-numeric(v,'y')/extent*side;
  let cells='';
  function draw(x,y,size,depth,prefix='') {
    for(const digit of order) {
      const [dx,dy]=DIGITS[digit], child=size/3, cx=x+dx*child, cy=y-dy*child;
      cells+=`<rect x="${cx-child/2}" y="${cy-child/2}" width="${child}" height="${child}" class="nested-cell level-${depth}"/><text x="${depth===0?cx:cx-child/2+5}" y="${depth===0?cy+15:cy-child/2+13}" text-anchor="${depth===0?'middle':'start'}" class="nested-label level-${depth}">${digit}</text>`;
      if(depth===0) draw(cx,cy,child,1,prefix+digit);
    }
  }
  draw(left+side/2,top+side/2,side,0);
  const path=addressCells(selected.value,length);
  const highlight=path.slice(0,length).map((c,i)=>`<rect x="${left+side/2+(c.x-c.size/2)/extent*side}" y="${top+side/2-(c.y+c.size/2)/extent*side}" width="${c.size/extent*side}" height="${c.size/extent*side}" class="address-region region-${i}"/>`).join('');
  const trajectories=releases.slice(1).map((r,i)=>`<path d="M${px(releases[i].value)} ${py(releases[i].value)}L${px(r.value)} ${py(r.value)}" class="trajectory ${r.action==='origin'?'feature':r.channel==='preview'?'preview':r.action==='fix'?'fix':'feature'}"/>`).join('');
  const dots=releases.map(r=>`<g data-select="${r.id}" role="button" tabindex="0" class="map-point" aria-label="选择版本 ${escape(format(r.value))}"><title>${escape(format(r.value))} · ${escape(r.title)}</title><circle cx="${px(r.value)}" cy="${py(r.value)}" r="${r.id===selected.id?7:4}" class="point ${r.channel}"/></g>`).join('');
  const whole=format(selected.value).slice(1).split('.')[0], center=parse(whole);
  const ix=v=>438+78+(numeric(v,'x')-numeric(center,'x'))*156;
  const iy=v=>101+78-(numeric(v,'y')-numeric(center,'y'))*156;
  let inset='';
  for(const digit of order){const [dx,dy]=DIGITS[digit],x=438+(dx+1)*52,y=101+(1-dy)*52;inset+=`<rect x="${x}" y="${y}" width="52" height="52" class="nested-cell level-0"/><text x="${x+6}" y="${y+17}" class="nested-label level-0">${digit}</text>`;for(const d of order){const [sx,sy]=DIGITS[d];inset+=`<rect x="${x+(sx+1)*52/3}" y="${y+(1-sy)*52/3}" width="${52/3}" height="${52/3}" class="nested-cell level-1"/>`;}}
  let focus='';let fx=0,fy=0,unit=156;
  for(const digit of format(selected.value).split('.')[1]||''){unit/=3;fx+=DIGITS[digit][0]*unit;fy-=DIGITS[digit][1]*unit;if(unit<4)break;focus+=`<rect x="${516+fx-unit/2}" y="${179+fy-unit/2}" width="${unit}" height="${unit}" class="address-region"/>`;}
  const crumbs=path.map(c=>`<span><b>${c.digit}</b><small>3<sup>${c.exponent}</sup></small></span>`).join('');
  return `<div class="nested-planes"><svg class="nested-chart" viewBox="0 0 390 425" role="img" aria-label="递归九宫格：每格按 6 1 8、7 5 3、2 9 4 再分九格；高位选区域，小数位继续细分"><text x="20" y="21" class="grid-heading">整数区域 · 首位权重 3^${length-1}</text>${cells}${highlight}${trajectories}<path d="M${px(releases.at(-1).value)} ${py(releases.at(-1).value)}L${px(candidate.value)} ${py(candidate.value)}" class="candidate-line ${color}"/>${dots}<circle cx="${px(candidate.value)}" cy="${py(candidate.value)}" r="6" class="candidate-point ${color}"/><text x="20" y="402" class="grid-caption">边框：逐位区域 · 圆点：版本 · 空心点：下一步</text><text x="20" y="419" class="grid-caption">选中地址的区域，在放大图继续细分小数位</text></svg><svg class="fractional-chart" viewBox="420 40 190 280" role="img" aria-label="${escape('&'+whole)} 区域的小数位九宫格放大"><text x="438" y="70" class="grid-heading">${escape('&'+whole)} 区域放大</text><text x="438" y="88" class="grid-caption">小数第 1 位 → 第 2 位</text>${inset}${focus}<circle cx="${ix(selected.value)}" cy="${iy(selected.value)}" r="4" class="point"/><text x="438" y="284" class="grid-caption">每层边长缩小为 1/3</text><text x="438" y="303" class="grid-caption">5 留在中心，1 向上，3 向右</text></svg></div><div class="address-path"><code>${escape(format(selected.value))}</code><span class="path-label">逐位寻址</span>${crumbs}</div>`;
}
