import { DIGITS, parse, format, fraction, step } from './dbt.mjs';
import { ACTIONS, initialReleases, propose, releaseDocument } from './version-model.mjs';
import './styles.css';
import { nestedGrid } from './nested-grid.mjs';
import { compareAddresses } from './version-compare.mjs';
import { specificationView } from './spec-view.mjs';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const gridLogo = '<span class="logo-grid" aria-hidden="true">' + [6,1,8,7,5,3,2,9,4].map(n => `<i class="d${n}"></i>`).join('') + '</span>';
const units = ['1', '1/3', '1/9', '1/27'];
const symbols = { feature: '↑', fix: '→', preview: '←', promote: '↗', origin: '·' };

class BalancedVersionPage extends HTMLElement {
  constructor() {
    super();
    this.releases = initialReleases(); this.action = 'feature'; this.precision = 1;
    this.selected = this.releases.at(-1).id; this.decoded = parse('&14.8'); this.inputValue = '&14.8';
    this.compareLeft = '&1'; this.compareRight = '&3'; this.compareError = '';
    this.error = ''; this.notice = ''; this.initialized = false;
  }
  connectedCallback() {
    if (!this.initialized) {
      this.addEventListener('click', event => this.handleClick(event));
      this.addEventListener('submit', event => this.handleSubmit(event));
      this.addEventListener('keydown', event => {
        const point = event.target.closest('[data-select]');
        if (point && ['Enter', ' '].includes(event.key)) { event.preventDefault(); this.select(Number(point.dataset.select)); }
      });
      this.initialized = true;
    }
    this.render();
  }
  get current() { return this.releases.at(-1); }
  get candidate() { return propose(this.current, this.action, this.precision); }
  select(id) { this.selected = id; this.render(); }
  async handleClick(event) {
    const control = event.target.closest('button, [data-select]');
    if (!control || control.disabled) return;
    if (control.dataset.select) return this.select(Number(control.dataset.select));
    if (control.dataset.action) { this.action = control.dataset.action; this.notice = ''; this.render(); }
    if (control.dataset.precision !== undefined) { this.precision = Number(control.dataset.precision); this.notice = ''; this.render(); }
    if (control.dataset.command === 'record') {
      const candidate = this.candidate;
      const release = { ...candidate, id: this.releases.at(-1).id + 1, title: ACTIONS[candidate.action].label, date: '刚刚', note: candidate.channel === 'preview' ? `目标 ${format(candidate.target)}；沿 7 方向引入不稳定功能；验证后计入稳定功能。` : `以 ${units[candidate.precision]} 的尺度记录${ACTIONS[candidate.action].label}。` };
      this.releases.push(release); this.selected = release.id;
      this.action = release.channel === 'preview' ? 'promote' : 'feature';
      this.notice = `已记录 ${format(release.value)} · ${release.channel === 'preview' ? '实验版本' : '稳定版本'}`;
      this.render();
    }
    if (control.dataset.command === 'reset') {
      this.releases = initialReleases(); this.selected = this.current.id; this.action = 'feature'; this.precision = 1;
      this.notice = '已恢复初始示例。'; this.render();
    }
    if (control.dataset.command === 'copy') {
      try { await navigator.clipboard.writeText(format(this.current.value)); this.notice = '版本号已复制。'; }
      catch { this.notice = `请复制当前版本：${format(this.current.value)}`; }
      this.render();
    }
    if (control.dataset.command === 'export') {
      const url = URL.createObjectURL(new Blob([JSON.stringify(releaseDocument(this.releases), null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'balanced-version.json'; link.click(); URL.revokeObjectURL(url);
      this.notice = '版本记录已导出。'; this.render();
    }
  }
  handleSubmit(event) {
    if (event.target.matches('[data-comparator]')) {
      event.preventDefault();
      const data = new FormData(event.target); this.compareLeft=data.get('left'); this.compareRight=data.get('right');
      try { compareAddresses(this.compareLeft,this.compareRight); this.compareError=''; }
      catch(error) { this.compareError=error.message; }
      this.render(); this.querySelector('[name="left"]').focus(); return;
    }
    if (!event.target.matches('[data-decoder]')) return;
    event.preventDefault(); this.inputValue = new FormData(event.target).get('version');
    try { this.decoded = parse(this.inputValue); this.error = ''; }
    catch (error) { this.error = error.message; }
    this.render(); this.querySelector('input[name="version"]').focus();
  }

  chart() {
    const selected=this.releases.find(r=>r.id===this.selected)||this.current;
    return nestedGrid(this.releases,selected,this.candidate,ACTIONS[this.action].color);
  }

  comparator() {
    let result='';
    if(this.compareError) result=`<p class="input-error">${escape(this.compareError)}</p>`;
    else {
      const c=compareAddresses(this.compareLeft,this.compareRight);
      const labels={equal:'相等',greater:'A 大于 B',less:'A 小于 B',incomparable:'不可比较 · 各有一个方向更大'};
      result=`<div class="comparison-results"><div><span>二维大小 · 偏序</span><strong>${labels[c.relation]}</strong></div><div><span>列表排序 · 先 F 再 B</span><strong>${c.order===0?'同一地址':c.order<0?'A 排在 B 前':'B 排在 A 前'}</strong></div></div><p class="decode-note">A：F=${fraction(parse(this.compareLeft),'y')}，B=${fraction(parse(this.compareLeft),'x')}　/　B：F=${fraction(parse(this.compareRight),'y')}，B=${fraction(parse(this.compareRight),'x')}。发布先后用同一发布线的 sequence；地址顺序不承诺兼容性。</p>`;
    }
    return `<section class="card comparator" id="comparison"><div class="card-header"><div><span class="eyebrow">COMPARE, WITH A RULE</span><h2>版本大小，如何比较？</h2></div></div><div class="compare-body"><p class="muted">二维地址可能不可比较；需要排成列表时，用精确的 (F,B) 数值键。</p><form data-comparator><label>A 版本<input name="left" value="${escape(this.compareLeft)}" autocomplete="off" spellcheck="false" aria-invalid="${Boolean(this.compareError)}" aria-describedby="comparison-result"></label><label>B 版本<input name="right" value="${escape(this.compareRight)}" autocomplete="off" spellcheck="false" aria-invalid="${Boolean(this.compareError)}" aria-describedby="comparison-result"></label><button type="submit">比较 ${arrow}</button></form><div id="comparison-result" aria-live="polite">${result}</div></div></section>`;
  }

  composer() {
    const c = this.candidate, experimental = this.current.channel === 'preview';
    return `<section class="card composer" aria-labelledby="composer-title"><div class="section-heading"><span class="eyebrow">VERSION COMPOSER</span><span class="small-tag">本地实验</span></div><h2 id="composer-title">下一次，往哪里走？</h2><p class="muted">每一次改变，都成为一个有方向的增量。</p>
      <div class="action-tabs" role="group" aria-label="迭代类型">${(experimental ? ['promote'] : ['feature','fix','preview']).map(a => `<button type="button" data-action="${a}" aria-pressed="${this.action===a}" class="action-tab ${this.action===a ? 'active '+ACTIONS[a].color : ''}"><span>${symbols[a]}</span>${ACTIONS[a].label}</button>`).join('')}</div>
      <div class="scale-heading"><label>迭代尺度</label><span>3 的负幂</span></div><div class="precision-controls" role="group" aria-label="小数精度">${units.map((u,p) => `<button type="button" data-precision="${p}" ${experimental?'disabled':''} aria-pressed="${this.precision===p}" class="${this.precision===p?'active':''}"><strong>${u}</strong><span>${p===0?'整数位':`小数第 ${p} 位`}</span></button>`).join('')}</div>
      <div class="formula"><code>${escape(format(this.current.value))}</code><span>+</span><code class="${ACTIONS[this.action].color}">${escape(format(step(ACTIONS[this.action].digit, experimental ? this.current.precision : this.precision)))}</code>${experimental?'<span class="formula-hint">3 撤销不稳定偏移 + 1 计入稳定功能</span>':''}</div>
      <div class="candidate-box ${c.channel}"><div class="candidate-top"><span>生成的版本</span><span class="status ${c.channel}">${c.channel==='preview'?'实验 · 未稳定':'稳定'}</span></div><div class="candidate-version">${escape(format(c.value))}</div><div class="candidate-coordinates"><span>功能 <b>${fraction(c.value,'y')}</b></span><span>修复 <b>${fraction(c.value,'x')}</b></span></div>${c.target?`<p class="preview-target">目标稳定版 <code>${escape(format(c.target))}</code><br>不稳定功能通过验证后，迁入 1 方向的稳定功能。</p>`:''}</div>
      <p class="action-explanation">${ACTIONS[this.action].description}</p><button type="button" class="primary-button" data-command="record">${experimental?'确认转为稳定':'记录这次迭代'} ${arrow}</button><p class="local-note">记录保存在当前页面，可导出为 JSON。</p>
    </section>`;
  }

  render() {
    const selected = this.releases.find(r => r.id===this.selected) || this.current;
    this.innerHTML = `<div class="app-shell">
      <aside class="sidebar"><a class="brand" href="#overview">${gridLogo}<span>balanced<span class="brand-bottom">version<span class="brand-dot">.</span></span></span></a><div class="sidebar-label">WORKSPACE</div><nav aria-label="主导航"><a class="nav-item active" href="#overview"><span>◈</span>版本实验室<span class="nav-count">01</span></a><a class="nav-item" href="#releases"><span>≋</span>迭代记录</a><a class="nav-item" href="#specification"><span>▦</span>版本规范</a></nav><div class="sidebar-note"><span class="tiny-grid">⠿</span><p>一个版本。<br>两个维度。<br>每次迭代都有方向。</p><a href="https://github.com/dual-balanced-ternary/dual_balanced_ternary.rs" target="_blank" rel="noreferrer">关于 DBT <span>↗</span></a></div><div class="sidebar-footer"><i></i>一个版本号的想象实验</div></aside>
      <div class="workspace"><header class="topbar"><div class="breadcrumb">工作空间 <span>/</span> <b>版本实验室</b></div><span class="topbar-note">DUAL BALANCED TERNARY <span class="tiny-status">0.1.0 草案</span></span></header>
      <main id="overview"><section class="intro"><div><div class="eyebrow intro-eyebrow"><span></span> SOFTWARE EVOLUTION, IN TWO DIMENSIONS</div><h1>让每次迭代，<br>都有自己的<span>方向。</span></h1><p>用双平衡三进制，让功能增长与问题修复在同一张坐标图上相遇。<br class="desktop-break">版本不再只有先后，也有它走过的路径。</p></div><div class="intro-compass" aria-hidden="true"><div class="compass-axis horizontal"></div><div class="compass-axis vertical"></div><span class="compass-top">1</span><span class="compass-left">7</span><span class="compass-center">5</span><span class="compass-right">3</span><span class="compass-bottom">9</span><div class="compass-caption">a version has a direction</div></div></section>
      <div class="stats"><section class="stat current-stat"><div class="stat-label">当前版本 <span class="status ${this.current.channel}">${this.current.channel==='preview'?'实验中':'稳定'}</span></div><div class="stat-value version-number">${escape(format(this.current.value))}<button type="button" class="copy-button" data-command="copy" aria-label="复制当前版本号"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="6" width="8" height="10" rx="2" stroke="currentColor"/><path d="M5 13H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1" stroke="currentColor"/></svg></button></div><span class="stat-subtitle">从 &amp;5 出发的第 ${this.releases.length-1} 次迭代</span></section><section class="stat"><div class="stat-label"><span class="direction-icon feature">↑</span>功能坐标 · 1 方向</div><div class="stat-value">${fraction(this.current.value,'y')}<span class="coordinate-name">F</span></div><span class="stat-subtitle">向上，扩展软件的能力</span></section><section class="stat"><div class="stat-label"><span class="direction-icon fix">→</span>修复坐标 · 3 方向</div><div class="stat-value">${fraction(this.current.value,'x')}<span class="coordinate-name">B</span></div><span class="stat-subtitle">向右，完成一次问题修复</span></section></div>
      <div class="main-grid"><section class="card chart-card" id="address-plane"><div class="card-header"><div><span class="eyebrow">RELEASE LANDSCAPE</span><h2>版本，逐位落进九宫格</h2></div><span class="grid-tag"><i></i>高位选区域 · 低位再细分</span></div>${this.chart()}<div class="chart-bottom"><div class="chart-legend"><span><i class="feature"></i>功能</span><span><i class="fix"></i>修复</span><span><i class="preview"></i>实验 / 下一步</span></div><span>点击节点，查看迭代</span></div><div class="selected-release"><span class="selected-icon ${selected.channel}">${selected.channel==='preview'?'←':'↗'}</span><div><strong><code>${escape(format(selected.value))}</code> ${escape(selected.title)}</strong><p>${escape(selected.note)}</p></div><span class="selected-date">${selected.date}</span></div></section>${this.composer()}</div>
      <div class="notice" role="status" aria-live="polite">${escape(this.notice)}</div>
      <div class="lower-grid"><section class="card history-card" id="releases"><div class="card-header"><div><span class="eyebrow">A TRACE OF PROGRESS</span><h2>每一步，都有迹可循</h2></div><button type="button" class="text-button" data-command="export">导出记录 ↗</button></div><div class="ledger-heading"><span>版本 / 迭代</span><span>方向</span><span>尺度</span><span>状态</span></div><div class="release-list">${[...this.releases].reverse().map(r => `<button type="button" data-select="${r.id}" class="release-row ${r.id===this.selected?'active':''}" aria-pressed="${r.id===this.selected}"><span class="release-name"><code>${escape(format(r.value))}</code><span>${escape(r.title)}</span></span><span class="release-direction ${r.action==='origin'?'origin':ACTIONS[r.action].color}">${symbols[r.action]} <small>${r.action==='origin'?'原点':ACTIONS[r.action].label}</small></span><span class="release-scale">${units[r.precision]}</span><span class="status ${r.channel}">${r.channel==='preview'?'实验':'稳定'}</span></button>`).join('')}</div><div class="ledger-footer"><span>${this.releases.length} 条记录 · 初始内容 + 你的迭代</span><button type="button" class="text-button" data-command="reset">重置示例</button></div></section>
      <section class="card digit-card"><span class="eyebrow">THE NINE DIGITS</span><h2>九个数字，递归成一个平面</h2><p class="muted">每个数字同时承载两个平衡三进制位。</p><div class="digit-grid">${[6,1,8,7,5,3,2,9,4].map(n => `<div class="digit-cell digit-${n}" title="修复 ${DIGITS[n][0]}，功能 ${DIGITS[n][1]}"><strong>${n}</strong><span>${n===1?'功能 +1':n===3?'修复 +1':n===7?'不稳定功能':n===9?'向后兼容':n===5?'原点':`(${DIGITS[n].join(', ')})`}</span></div>`).join('')}</div><div class="digit-caption"><span>← 修复坐标 B →</span><span>↑ 功能坐标 F</span></div><div class="digit-note"><b>5 是零，1 是单位。</b><p>每一位的权重是 3 的幂；坐标分别进位，不按字符大小排序。</p></div></section></div>
      <section class="principles" id="principles"><div class="principles-heading"><span class="eyebrow">RELEASE CONVENTIONS</span><h2>一种版本表达，三条使用约定</h2><p>DBT 负责坐标；软件迭代规则负责解释坐标。</p></div><div class="principle-grid"><article><span class="principle-index">01 / SCALE</span><h3>小数位，是迭代的尺度</h3><p>整数位一步为 1；小数第一位为 1/3，第二位为 1/9。增加小数位，继续表达更细的改动。</p><code>&amp;1 + &amp;5.1 = &amp;1.1</code></article><article><span class="principle-index">02 / STABILITY</span><h3>实验版，朝向明确的目标</h3><p>7 表示不稳定功能；成熟后撤销偏移，再沿 1 方向计入稳定功能。渠道单独记录，数字中出现 7 不自动意味着未稳定。</p><code>基线 &amp;5 → 实验 &amp;7 → 稳定 &amp;1</code></article><article><span class="principle-index">03 / COMPATIBILITY</span><h3>9 留给专门的向后兼容迭代</h3><p>9 表示高版本为旧接口或行为提供兼容适配，一般不用。普通修复仍沿 3；版本先后、兼容范围与支持期限单独记录。</p><code>方向是意图，不是工作量或兼容性保证</code></article></div></section>
      <section class="card decoder-card"><div class="decoder-heading"><span class="eyebrow">READ A VERSION</span><h2>读懂一个版本号</h2><p>试试输入 &amp;14.8、&amp;1.7，或自己的 DBT 数字。</p></div><div class="decoder-content"><form data-decoder><label class="sr-only" for="version-input">DBT 版本号</label><input id="version-input" name="version" value="${escape(this.inputValue)}" placeholder="&14.8" autocomplete="off" spellcheck="false" aria-describedby="decode-feedback" aria-invalid="${Boolean(this.error)}"><button type="submit">解码 ${arrow}</button></form><div id="decode-feedback" aria-live="polite">${this.error?`<p class="input-error">${escape(this.error)}</p>`:`<div class="decode-result"><code>${escape(format(this.decoded))}</code><span>功能 F = <b>${fraction(this.decoded,'y')}</b></span><span>修复 B = <b>${fraction(this.decoded,'x')}</b></span></div><p class="decode-note">坐标不代表渠道；是否稳定需要读取版本记录的 channel 与 target。</p>`}</div></div></section>
      ${this.comparator()}
      ${specificationView()}
      <footer><span>${gridLogo} BALANCED VERSION <span class="footer-separator">/</span> 用方向描述进步</span><a href="https://github.com/dual-balanced-ternary/dual_balanced_ternary.rs" target="_blank" rel="noreferrer">基于 Dual Balanced Ternary ↗</a></footer>
      </main></div></div>`;
  }
}

if (!customElements.get('balanced-version-app')) customElements.define('balanced-version-app', BalancedVersionPage);
