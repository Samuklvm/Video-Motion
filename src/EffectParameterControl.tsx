import type { EffectParameter } from './types';
import { parameterDefault, parameterBound, clampParameter, vectorValue, colorParts, packColor, type ParameterValue } from './effectParameters';

export function EffectParameterControl({ parameter: p, value, onChange }: { parameter: EffectParameter; value: ParameterValue; onChange: (value: ParameterValue) => void }) {
  const current = value ?? parameterDefault(p);
  const label = p.label || p.id;
  const min = parameterBound(p.min); const max = parameterBound(p.max);
  const step = Number(p.step) > 0 ? Number(p.step) : .01;
  const numeric = Number.isFinite(Number(current)) ? Number(current) : 0;
  const numberInput = (number: number, axis?: number) => <input aria-label={axis === undefined ? label : `${label} ${['X','Y','Z'][axis]}`} type="number" value={number} min={parameterBound(p.min,axis)} max={parameterBound(p.max,axis)} step={step} onChange={event => {
    if (event.target.value === '') return;
    const next = Number(event.target.value); if (!Number.isFinite(next)) return;
    if (axis === undefined) onChange(clampParameter(next,p));
    else { const vector = vectorValue(current,p.kind === 'point' ? 2 : 3); vector[axis] = clampParameter(next,p,axis); onChange(vector); }
  }}/>;
  let control;
  if (p.kind === 'switch') control = <input aria-label={label} className="parameter-switch" type="checkbox" checked={current === true || current === 'true' || current === 1 || current === '1'} onChange={event => onChange(event.target.checked)}/>;
  else if (p.kind === 'selector') control = <select aria-label={label} value={String(current)} onChange={event => onChange(Number.isFinite(Number(event.target.value)) ? Number(event.target.value) : event.target.value)}>{!p.choices.some(choice => choice.slice(choice.lastIndexOf('=')+1) === String(current)) && <option value={String(current)}>{String(current)}</option>}{p.choices.map(choice => { const i=choice.lastIndexOf('='); const text=i<0 ? choice : choice.slice(0,i); const val=i<0 ? choice : choice.slice(i+1); return <option key={val} value={val}>{text}</option>; })}</select>;
  else if (['point','xyz','orient','hue-disc'].includes(p.kind)) control = <div className="parameter-vector">{vectorValue(current,p.kind === 'point' ? 2 : 3).map((n,i) => <label key={i}><small>{p.kind === 'hue-disc' ? ['Matiz','Componente 2','Componente 3'][i] : ['X','Y','Z'][i]}</small>{numberInput(n,i)}</label>)}</div>;
  else if (p.kind === 'color') { const color=colorParts(current); control=<div className="parameter-color"><input aria-label={label} type="color" value={color.rgb} onChange={event => onChange(packColor(event.target.value,color.alpha))}/><code>{String(current)}</code><label>Alpha<input aria-label={`${label} alpha`} type="range" min="0" max="1" step="0.01" value={color.alpha} onChange={event => onChange(packColor(color.rgb,Number(event.target.value)))}/></label></div>; }
  else control = <div className="parameter-number">{numberInput(numeric)}{min !== undefined && max !== undefined && max > min && <input aria-label={`${label} controle deslizante`} type="range" min={min} max={max} step={step} value={Math.max(min,Math.min(max,numeric))} onChange={event => onChange(Number(event.target.value))}/>}</div>;
  return <div className="parameter-card"><header><span>{label}</span><button title={`Restaurar ${label}`} aria-label={`Restaurar ${label}`} onClick={() => onChange(parameterDefault(p))}>↺</button></header>{control}</div>;
}
