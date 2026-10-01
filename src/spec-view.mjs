import spec from '../docs/version-spec.md?raw';
import specUrl from '../docs/version-spec.md?url';
const escape = s => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Only our bundled Markdown is rendered; HTML is escaped, never executed.
export function specificationView() {
  let code=false, html='';
  for(const line of spec.split('\n')) {
    if(line.startsWith('```')) { html+=code?'</code></pre>':'<pre><code>';code=!code;continue; }
    if(code){html+=escape(line)+'\n';continue;}
    if(line.startsWith('# '))continue;
    if(line.startsWith('## ')){html+=`<h3>${escape(line.slice(3))}</h3>`;continue;}
    if(line.trim())html+=`<p>${escape(line)}</p>`;
  }
  return `<section class="card specification" id="specification"><div class="card-header"><div><span class="eyebrow">BALANCED VERSION / 0.1.0 DRAFT</span><h2>版本使用规范</h2></div><a class="text-button" href="${specUrl}" download="balanced-version-spec.md">下载规范 ↗</a></div><p class="spec-intro">地址语法、发布生命周期、兼容性与比较规则。点击展开完整条款。</p><details><summary>阅读完整规范 · 10 节条款</summary><div class="spec-body">${html}<p><a href="https://semver.org/lang/zh-CN/" target="_blank" rel="noreferrer">参考：Semantic Versioning 2.0.0 ↗</a></p></div></details></section>`;
}
