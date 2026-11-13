import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cubicBezier } from './bezier.ts';
test('linear curve preserves progress, including endpoints', () => {
  for (const t of [0,.1,.25,.5,.75,.99,1]) assert.ok(Math.abs(cubicBezier(t,[0,0,1,1])-t)<1e-7);
});
test('time is solved from X before evaluating Y', () => {
  assert.ok(cubicBezier(.5,[.42,0,1,1]) < .5);
  assert.ok(cubicBezier(.5,[0,0,.58,1]) > .5);
  assert.ok(Math.abs(cubicBezier(.5,[.42,0,.58,1])-.5)<1e-7);
});
