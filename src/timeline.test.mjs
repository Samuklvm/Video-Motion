import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveLayer, trimLayer, duplicateLayer } from './timeline.ts';

const clip = () => ({ id: 'clip', name: 'Vídeo', kind: 'video', startMs: 1000, endMs: 6000,
  sourceOffsetMs: 2000, effects: [], keyframes: { x: [{ id: 'key', timeMs: 3000, value: 42, easing: 'linear' }] } });

test('moving preserves source time, duration, and animation relative to clip', () => {
  const source = clip(); const moved = moveLayer(source, 4000);
  assert.equal(moved.endMs, 9000);
  assert.equal(moved.sourceOffsetMs, 2000);
  assert.equal(moved.keyframes.x[0].timeMs, 6000);
  assert.equal(source.keyframes.x[0].timeMs, 3000);
});

test('trimming keeps the same source frame at any retained timeline instant', () => {
  const source = clip(); const trimmed = trimLayer(source, 3500, 5500);
  const sourceTime = (layer, t) => t - layer.startMs + (layer.sourceOffsetMs ?? 0);
  assert.equal(sourceTime(source, 4000), sourceTime(trimmed, 4000));
  assert.equal(trimmed.sourceOffsetMs, 4500);
  assert.equal(trimmed.keyframes.x[0].timeMs, 3000);
});

test('extending left cannot seek before the beginning of media', () => {
  const trimmed = trimLayer({ ...clip(), sourceOffsetMs: 0 }, 0, 6000);
  assert.equal(trimmed.startMs, 1000);
  assert.equal(trimmed.sourceOffsetMs, 0);
});

test('duplicate preserves duration and source while remapping independent keyframes', () => {
  const source = clip(); const copy = duplicateLayer(source);
  assert.equal(copy.startMs, source.endMs);
  assert.equal(copy.endMs - copy.startMs, 5000);
  assert.equal(copy.sourceOffsetMs, 2000);
  assert.equal(copy.keyframes.x[0].timeMs, 8000);
  assert.notEqual(copy.id, source.id);
  assert.notEqual(copy.keyframes.x[0].id, source.keyframes.x[0].id);
});
