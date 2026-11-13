import type { MotionLayer } from './types';

export function moveLayer(layer: MotionLayer, startMs: number): MotionLayer {
  const delta = startMs - layer.startMs;
  return { ...layer, startMs, endMs: layer.endMs + delta,
    keyframes: Object.fromEntries(Object.entries(layer.keyframes).map(([key, frames]) =>
      [key, frames.map(frame => ({ ...frame, timeMs: frame.timeMs + delta }))])) };
}

export function trimLayer(layer: MotionLayer, startMs: number, endMs: number): MotionLayer {
  const media = layer.kind === 'video' || layer.kind === 'audio';
  const start = media ? Math.max(startMs, layer.startMs - (layer.sourceOffsetMs ?? 0)) : startMs;
  return { ...layer, startMs: start, endMs: Math.max(start + 1, endMs),
    sourceOffsetMs: media ? (layer.sourceOffsetMs ?? 0) + start - layer.startMs : layer.sourceOffsetMs };
}

export function duplicateLayer(layer: MotionLayer): MotionLayer {
  const copy = moveLayer(structuredClone(layer), layer.endMs);
  copy.id = crypto.randomUUID();
  copy.name += ' cópia';
  copy.effects.forEach(effect => { effect.id = crypto.randomUUID(); });
  Object.values(copy.keyframes).flat().forEach(frame => { frame.id = crypto.randomUUID(); });
  return copy;
}
