import type { EffectParameter, MotionEffect } from './types';
export type ParameterValue = MotionEffect['parameters'][string];
export function vectorValue(value: unknown, size: number): number[] {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
  return Array.from({ length: size }, (_, i) => Number.isFinite(Number(parts[i])) ? Number(parts[i]) : 0);
}
export function parameterDefault(parameter: EffectParameter): ParameterValue {
  const value = parameter.default;
  if (parameter.kind === 'switch') return value === 'true' || value === '1';
  if (parameter.kind === 'point') return vectorValue(value, 2);
  if (['xyz', 'orient', 'hue-disc'].includes(parameter.kind)) return vectorValue(value, 3);
  if (parameter.kind === 'color') return /^#[\da-f]{6}([\da-f]{2})?$/i.test(value) ? value : '#FFFFFFFF';
  return value !== '' && Number.isFinite(Number(value)) ? Number(value) : value || 0;
}
export function parameterBound(raw: string, axis = 0): number | undefined {
  if (!raw?.trim()) return undefined;
  const parts = raw.split(','); const result = Number(parts[Math.min(axis, parts.length-1)]);
  return Number.isFinite(result) ? result : undefined;
}
export function clampParameter(value: number, parameter: EffectParameter, axis = 0): number {
  return Math.max(parameterBound(parameter.min, axis) ?? -Infinity, Math.min(parameterBound(parameter.max, axis) ?? Infinity, value));
}
export function colorParts(value: unknown): { rgb: string; alpha: number } {
  const text = String(value);
  if (/^#[\da-f]{8}$/i.test(text)) return { rgb: '#' + text.slice(3), alpha: parseInt(text.slice(1,3),16)/255 };
  return { rgb: /^#[\da-f]{6}$/i.test(text) ? text : '#ffffff', alpha: 1 };
}
export function packColor(rgb: string, alpha: number): string {
  return '#' + Math.round(Math.max(0,Math.min(1,alpha))*255).toString(16).padStart(2,'0') + rgb.slice(1);
}
