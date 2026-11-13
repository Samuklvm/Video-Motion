import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parameterDefault, parameterBound, clampParameter, colorParts, packColor } from './effectParameters.ts';
const parameter = (kind, value, min='', max='') => ({kind,default:value,min,max});
test('recovered vector defaults retain nonzero components',()=>{
  assert.deepEqual(parameterDefault(parameter('point','1.0, 1.0')),[1,1]);
  assert.deepEqual(parameterDefault(parameter('xyz','0.,100.,600.')),[0,100,600]);
  assert.deepEqual(parameterDefault(parameter('hue-disc','60,1,0')),[60,1,0]);
});
test('axis-specific bounds do not produce NaN',()=>{
  const p=parameter('point','1,1','0.01,0.02','10,20');
  assert.equal(clampParameter(-4,p,1),.02);
  assert.equal(clampParameter(30,p,1),20);
  assert.equal(parameterBound(''),undefined);
});
test('Android alpha-first colors survive color edits',()=>{
  const c=colorParts('#8088CCEE');
  assert.equal(c.rgb,'#88CCEE');
  assert.equal(c.alpha,128/255);
  assert.equal(packColor('#112233',c.alpha),'#80112233');
  assert.equal(parameterDefault(parameter('color','#FF88CCEE')),'#FF88CCEE');
});
test('switch defaults preserve false rather than string truthiness',()=>{
  assert.equal(parameterDefault(parameter('switch','false')),false);
  assert.equal(parameterDefault(parameter('switch','true')),true);
});
test('every recovered parameter initializes without nonfinite numeric values',()=>{
  const rows=JSON.parse(readFileSync(new URL('../public/catalog/effects.json',import.meta.url),'utf8'));
  for(const row of rows) for(const p of JSON.parse(row.parameters_json)) {
    const value=parameterDefault(p);
    if(typeof value==='number') assert.ok(Number.isFinite(value),row.file+':'+p.id);
    if(Array.isArray(value)) assert.ok(value.every(Number.isFinite),row.file+':'+p.id);
  }
});
