import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
const run=(...args)=>execFileSync(process.env.BALANCED_QUERY_CLI||'calcit',args,{encoding:'utf8',maxBuffer:10*1024*1024,stdio:['ignore','pipe','pipe']});
const q=(...args)=>JSON.parse(run('query',...args,'--format','json')).data;
mkdirSync('acceptance',{recursive:true});
function inventory(){
  const defs=[];
  for(const ns of q('ns').namespaces){
    const names=run('query','defs',ns).split('\n').filter(l=>/^  \S/.test(l)).map(l=>l.trim().split(' ')[0]);
    assert.equal(names.length,q('ns',ns).definition_count);
    for(const name of names)defs.push(q('def',`${ns}/${name}`));
  }
  assert.equal(defs.length,8);assert.equal(defs.reduce((n,d)=>n+d.tests.length,0),0);return defs;
}
if(process.argv[2]==='inventory'){
  writeFileSync('acceptance/reviewed.json',JSON.stringify(inventory(),null,2));process.exit(0);
}
assert.equal(run('-v').trim(),'0.30.1');run('docs','agents','--full');
const before=inventory(),config=q('config');assert.deepEqual(before,JSON.parse(readFileSync('acceptance/reviewed.json','utf8')));
const expected=structuredClone(before),target=expected.find(d=>d.id==='app.main/mount-target');
assert.deepEqual(target.code,['defn','mount-target',[],['option:unwrap',['query-selector','|.app']]]);
const shown=JSON.parse(run('tree','show',target.id,'--path','@3.0','--format','json'));
assert.ok(JSON.stringify(shown).includes('option:unwrap'));
target.code[3][0]='.unwrap';
const ops=[['tree','replace',target.id,'--path','@3.0','--input-format','cirru','--code','quote .unwrap','--expect','quote option:unwrap']];
writeFileSync('acceptance/before.json',JSON.stringify(before,null,2));writeFileSync('acceptance/operations.json',JSON.stringify(ops,null,2));
const args=['edit','transaction','--file','acceptance/operations.json','--format','json'];const preview=JSON.parse(run(...args,'--dry-run'));assert.ok(preview.scoped_revision);
writeFileSync('acceptance/preview.json',JSON.stringify(preview,null,2));writeFileSync('acceptance/applied.json',run(...args,'--expect-revision',preview.scoped_revision));
assert.deepEqual(inventory(),expected);assert.deepEqual(q('config'),config);
writeFileSync('acceptance/after.json',JSON.stringify(expected,null,2));writeFileSync('acceptance/snapshot-blob.txt',execFileSync('git',['hash-object','calcit.cirru'],{encoding:'utf8'}));
console.log('8 full views: only one Option unwrap head changed; HUD, schema, FFI, examples, tests and config preserved');
