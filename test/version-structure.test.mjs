import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, numeric } from '../src/dbt.mjs';
import { addressCells, nestedGrid } from '../src/nested-grid.mjs';
import { compareAddresses, compareReleaseSequence } from '../src/version-compare.mjs';
import { initialReleases, propose } from '../src/version-model.mjs';

test('nested prefixes locate the same point as positional DBT, including fractional and negative addresses',()=>{
  for(const text of ['&14.8','&7','&5.7','&82.439','&555','&1.555555555551']) {
    const value=parse(text), cells=addressCells(value,3), point=cells.at(-1);
    assert(Math.abs(point.x-numeric(value,'x'))<1e-12);
    assert(Math.abs(point.y-numeric(value,'y'))<1e-12);
    for(let i=1;i<cells.length;i++) {
      assert(Math.abs(cells[i].x-cells[i-1].x)+cells[i].size/2<=cells[i-1].size/2+1e-12);
      assert(Math.abs(cells[i].y-cells[i-1].y)+cells[i].size/2<=cells[i-1].size/2+1e-12);
    }
  }
  const history=initialReleases(), candidate=propose(history.at(-1),'feature',1);
  const svg=nestedGrid(history,history.at(-1),candidate,'feature');
  assert(!svg.includes('NaN'));
  assert(svg.includes('小数第 1 位'));
});
test('partial order and optional display order stay distinct, with exact fractional comparisons',()=>{
  assert.deepEqual(compareAddresses('&1','&3'),{relation:'incomparable',order:1});
  assert.deepEqual(compareAddresses('&3','&1'),{relation:'incomparable',order:-1});
  assert.deepEqual(compareAddresses('&14.8','&55514.855'),{relation:'equal',order:0});
  assert.deepEqual(compareAddresses('&19','&1'),{relation:'greater',order:1});
  assert.deepEqual(compareAddresses('&7','&5'),{relation:'less',order:-1});
  assert.deepEqual(compareAddresses('&5.555555555551','&5'),{relation:'greater',order:1});
  assert.deepEqual(compareAddresses('&3.7','&3'),{relation:'less',order:-1});
  assert.throws(()=>compareAddresses('&0','&1'));
});
test('chronological release ordering is exact, scoped to project and line, and independent of address',()=>{
  const a={project:'app',line:'main',sequence:'9007199254740993',address:'&1'};
  const b={...a,sequence:'9007199254740994',address:'&7'};
  assert.equal(compareReleaseSequence(a,b),-1);
  assert.equal(compareReleaseSequence(b,a),1);
  assert.equal(compareReleaseSequence(a,{...a}),0);
  assert.equal(compareReleaseSequence(a,{...b,line:'next'}),null);
  assert.equal(compareReleaseSequence(a,{...b,project:'other'}),null);
  for(const sequence of ['01','-1','1.2',1])assert.throws(()=>compareReleaseSequence(a,{...a,sequence}));
});
