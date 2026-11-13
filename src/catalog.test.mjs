import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../public/catalog/effects.json',import.meta.url),'utf8'));
test('catalog preserves all definitions with useful display names',()=>{
  assert.equal(catalog.length,303);
  for(const effect of catalog) {
    assert.ok(effect.id);
    assert.ok(!['Nome','Name',''].includes(effect.name),effect.file);
    assert.ok(existsSync(new URL('../public/effect-definitions/'+effect.file,import.meta.url)),effect.file);
  }
});
test('every linked preview exists and parameters retain their identities',()=>{
  for(const effect of catalog) {
    if(effect.preview) assert.ok(existsSync(new URL('../public/previews/effects/'+effect.preview,import.meta.url)),effect.preview);
    const parameters=JSON.parse(effect.parameters_json);
    for(const parameter of parameters) assert.ok(parameter.id,effect.file);
  }
});
test('internal and experimental entries remain available but are distinguished',()=>{
  assert.equal(catalog.filter(effect=>effect.internal).length,13);
  assert.ok(catalog.filter(effect=>!effect.internal).every(effect=>!effect.file.startsWith('internal-')));
});
