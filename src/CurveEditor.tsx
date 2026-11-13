import { useState } from 'react';
import type { Keyframe, MotionLayer } from './types';

type Curve = [number, number, number, number];
const presets: Array<[string, Curve]> = [['Linear', [0,0,1,1]], ['Entrada', [.42,0,1,1]], ['Saída', [0,0,.58,1]], ['Suave', [.42,0,.58,1]]];
export function CurveEditor({ layer, playhead, onSeek, onChange }: { layer: MotionLayer; playhead: number; onSeek: (time: number) => void; onChange: (property: string, id: string, curve: Curve) => void }) {
  const properties = Object.keys(layer.transform).filter(key => (layer.keyframes[key]?.length ?? 0) >= 2);
  const [property, setProperty] = useState('x');
  const active = properties.includes(property) ? property : properties[0];
  const frames = [...(layer.keyframes[active] || [])].sort((a,b) => a.timeMs-b.timeMs);
  const index = Math.max(0, Math.min(frames.length-2, frames.reduce((result, frame, i) => frame.timeMs <= playhead ? i : result, 0)));
  const frame: Keyframe | undefined = frames[index];
  const curve: Curve = frame?.bezier ?? (frame?.easing === 'ease-in' ? [.42,0,1,1] : frame?.easing === 'ease-out' ? [0,0,.58,1] : frame?.easing === 'ease-in-out' ? [.42,0,.58,1] : [0,0,1,1]);
  const [drag, setDrag] = useState<number | null>(null);
  const update = (value: Curve) => { if (frame) onChange(active, frame.id, value); };
  return <section className="motion-curve-panel">
    <header><strong>Curva de velocidade</strong><span>◆</span></header>
    {!frame || frames.length < 2 ? <p>Adicione dois keyframes à mesma propriedade para editar a curva entre eles.</p> : <>
      <div className="curve-navigation"><button disabled={index === 0} onClick={() => onSeek(frames[index-1].timeMs)}>‹</button><select aria-label="Propriedade animada" value={active} onChange={event => setProperty(event.target.value)}>{properties.map(key => <option key={key}>{key}</option>)}</select><button disabled={index >= frames.length-2} onClick={() => onSeek(frames[index+1].timeMs)}>›</button></div>
      <svg className="bezier-workspace" viewBox="0 0 240 240" aria-label="Editor de curva Bézier" onPointerMove={event => {
        if (drag === null) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const next = [...curve] as Curve;
        next[drag*2] = Math.max(0, Math.min(1, ((event.clientX-rect.left)/rect.width*240-20)/200));
        next[drag*2+1] = Math.max(0, Math.min(1, 1-((event.clientY-rect.top)/rect.height*240-20)/200));
        update(next);
      }} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
        {[0,1,2,3,4].map(n => <g key={n}><line x1={20+n*50} y1="20" x2={20+n*50} y2="220" className="curve-grid"/><line x1="20" y1={20+n*50} x2="220" y2={20+n*50} className="curve-grid"/></g>)}
        <path d={`M20 220 C${20+curve[0]*200} ${220-curve[1]*200} ${20+curve[2]*200} ${220-curve[3]*200} 220 20`} className="curve-path"/>
        {[0,1].map(handle => <g key={handle}><line x1={handle ? 220 : 20} y1={handle ? 20 : 220} x2={20+curve[handle*2]*200} y2={220-curve[handle*2+1]*200} className="curve-arm"/><circle cx={20+curve[handle*2]*200} cy={220-curve[handle*2+1]*200} r="9" className="curve-handle" onPointerDown={event => { event.preventDefault(); setDrag(handle); event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId); }}/></g>)}
      </svg>
      <div className="curve-values">{curve.map((value,i) => <label key={i}>{['X₁','Y₁','X₂','Y₂'][i]}<input aria-label={['X1','Y1','X2','Y2'][i]} type="number" min="0" max="1" step="0.01" value={Number(value.toFixed(3))} onChange={event => { const next = [...curve] as Curve; next[i] = Math.max(0, Math.min(1, Number(event.target.value))); update(next); }}/></label>)}</div>
      <div className="curve-presets">{presets.map(([label,value]) => <button key={label} onClick={() => update(value)}>{label}</button>)}</div>
      <small>{(frames[index].timeMs/1000).toFixed(2)} s → {(frames[index+1].timeMs/1000).toFixed(2)} s</small>
    </>}
  </section>;
}
