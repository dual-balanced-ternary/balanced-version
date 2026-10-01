import test from 'node:test';
import assert from 'node:assert/strict';
import { DIGITS, coordinate, parse, format, add, step, equals, fraction, dominates } from '../src/dbt.mjs';
import { initialReleases, propose, releaseDocument } from '../src/version-model.mjs';

test('all nine digits preserve the Rust coordinate convention', () => {
  for (const [digit, [x,y]] of Object.entries(DIGITS)) {
    assert.deepEqual(parse(digit), coordinate(x,y));
    assert.equal(format(coordinate(x,y)), `&${digit}`);
  }
  assert.deepEqual(parse('&143'), coordinate(4,6));
});
test('carries operate on both balanced ternary axes, including negative values', () => {
  assert.equal(format(add(parse('&1'),parse('&1'))), '&19');
  assert.equal(format(add(parse('&3'),parse('&3'))), '&37');
  assert.equal(format(add(parse('&7'),parse('&7'))), '&73');
  assert.equal(format(add(parse('&8'),parse('&8'))), '&82');
  assert.equal(format(add(parse('&7'),parse('&3'))), '&5');
  for (let x=-40; x<=40; x++) for (let y=-40; y<=40; y++) assert.deepEqual(parse(format(coordinate(x,y))),coordinate(x,y));
});
test('fractional coordinates remain exact and zero padding is canonicalized', () => {
  assert.equal(fraction(parse('&14.8'),'y'), '7/3');
  assert.equal(fraction(parse('&14.8'),'x'), '4/3');
  assert.equal(format(parse('&55514.855')), '&14.8');
  assert.equal(format(parse('&5.555')), '&5');
  assert.equal(format(add(parse('&1.1'),step('1',1))), '&19.9');
  const tiny=step('7',12);
  assert.equal(fraction(tiny,'x'), '-1/531441');
  assert(equals(add(tiny, step('3',12)), coordinate(0,0)));
  const large=coordinate(9007199254740997n,-9007199254740999n,3);
  assert.deepEqual(parse(format(large)), large);
  assert.throws(()=>coordinate(Number.MAX_SAFE_INTEGER+2,0));
  assert.throws(()=>coordinate(.5,0));
});
test('decoder rejects malformed input instead of guessing or treating 0 as a DBT digit', () => {
  for (const input of ['', '&', '&0', '1..3', '.1', '&1.', '&1e3', '<script>', '1.1234567891234']) assert.throws(()=>parse(input));
  assert.equal(format(parse(' 18.8 ')), '&18.8');
});
test('feature and fix progress define a partial order, not character sorting', () => {
  assert(!dominates(parse('&1'),parse('&3')));
  assert(!dominates(parse('&3'),parse('&1')));
  assert(dominates(parse('&8'),parse('&1')));
  assert(dominates(parse('&19'),parse('&1')));
  assert(!dominates(parse('&1'),parse('&19')));
});
test('initialized releases and preview lifecycle preserve the target exactly', () => {
  const releases=initialReleases();
  assert.deepEqual(releases.map(r=>format(r.value)),['&5','&1','&19','&14','&14.1','&14.8']);
  for (let precision=0;precision<=3;precision++) {
    const preview=propose(releases.at(-1),'preview',precision);
    assert.equal(preview.channel,'preview');
    assert(equals(preview.value,add(releases.at(-1).value,step('7',precision))));
    assert(equals(preview.target,add(releases.at(-1).value,step('1',precision))));
    assert(equals(add(add(preview.value,step('3',precision)),step('1',precision)),preview.target));
    const promoted=propose(preview,'promote',precision);
    assert(equals(promoted.value,preview.target));
    assert.equal(promoted.channel,'stable');
    assert.equal(promoted.target,null);
    assert.throws(()=>propose(preview,'fix',precision));
  }
  assert.throws(()=>propose(releases.at(-1),'promote',1));
  assert.throws(()=>propose(releases.at(-1),'feature',4));
});
test('the numerical address cannot replace channel or chronological identity', () => {
  const start={value:parse('&5'),channel:'stable'};
  const preview=propose(start,'preview',0);
  const stable={value:parse('&7'),channel:'stable'};
  assert(equals(preview.value,stable.value));
  assert.notEqual(preview.channel,stable.channel);
  const document=releaseDocument(initialReleases());
  assert.doesNotThrow(()=>JSON.stringify(document));
  assert.equal(document.schema,'balanced-version-demo/1.0.0');
  assert.equal(document.radix,3);
  assert.deepEqual(document.axes,{stableFeatures:'1',fixes:'3',unstableFeatures:'7',backwardCompatibility:'9'});
  const previewExport=releaseDocument([{...preview,id:2,title:'实验',note:'待验证'}]).releases[0];
  assert.equal(previewExport.channel,'preview');
  assert.equal(previewExport.action,'preview');
  assert.equal(previewExport.target,'&1');
  assert.equal(previewExport.version,'&7');
  assert.equal(document.releases.at(-1).target,null);
  assert.equal(document.releases.at(-1).features,'7/3');
  assert.equal(document.releases.at(-1).fixes,'4/3');
});
