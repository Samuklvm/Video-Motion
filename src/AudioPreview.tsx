import { useEffect, useRef, useState } from 'react';
import type { MotionLayer } from './types';

export function AudioPreview({ layer, projectId, playhead, playing }: { layer: MotionLayer; projectId: string; playhead: number; playing: boolean }) {
  const [source, setSource] = useState('');
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    let active = true;
    setSource('');
    if (layer.assetPath) void window.videoMotion.readAsset(projectId, layer.assetPath).then(url => { if (active) setSource(url); }).catch(() => undefined);
    return () => { active = false; };
  }, [projectId, layer.assetPath]);
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    const sync = () => {
      const target = Math.max(0, (playhead-layer.startMs+(layer.sourceOffsetMs ?? 0))/1000);
      element.volume = Math.max(0, Math.min(1, layer.audio.volume));
      element.muted = layer.audio.muted;
      if (element.readyState && Math.abs(element.currentTime-target) > (playing ? .2 : .01)) element.currentTime = target;
      if (playing) void element.play().catch(() => undefined); else element.pause();
    };
    sync();
    element.addEventListener('loadedmetadata', sync);
    return () => element.removeEventListener('loadedmetadata', sync);
  }, [playhead, playing, source, layer.startMs, layer.sourceOffsetMs, layer.audio.volume, layer.audio.muted]);
  return source ? <audio ref={audio} src={source} preload="auto"/> : null;
}
