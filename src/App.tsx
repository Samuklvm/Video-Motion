import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  Activity, ArrowDownToLine, AudioLines, Bell, ChevronDown, ChevronLeft,
  CircleHelp, Copy, Download, Film, FolderOpen, Grid2X2, Image, Layers3, MoreHorizontal,
  Pause, Play, Plus, Search, Settings2, Shapes, SkipBack, SkipForward,
  Sparkles, Star, Type, Upload, Video, WandSparkles, X, ZoomIn, ZoomOut,
  Undo2, Redo2, Diamond, Scissors, Trash2, RotateCcw, Maximize2, Eye,
} from 'lucide-react';
import { parseAlightTransfer } from './alightImport';
import JSZip from 'jszip';
import { EffectParameterControl } from './EffectParameterControl';
import { parameterDefault } from './effectParameters';
import { AudioPreview } from './AudioPreview';
import { CurveEditor } from './CurveEditor';
import { cubicBezier } from './bezier';
import { moveLayer, trimLayer, duplicateLayer } from './timeline';
import type { EffectDefinition, EffectParameter, Keyframe, MotionEffect, MotionLayer, ProjectSummary, UpdateStatus, VideoProject } from './types';

const desktop = window.videoMotion;
const makeId = () => crypto.randomUUID();
const durations = (project: VideoProject) => Math.max(5, Math.ceil(project.durationMs / 1000));
const formatClock = (ms: number, fps = 30) => {
  const safeFps = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(0, Math.floor(ms / 1000 * safeFps));
  const seconds = Math.floor(totalFrames / safeFps);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}:${String(totalFrames % safeFps).padStart(2, '0')}`;
};
const nameForKind = (kind: MotionLayer['kind']) => ({ video: 'Vídeo', image: 'Imagem', audio: 'Áudio', text: 'Texto', shape: 'Forma' })[kind];
const initialTransform = () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 });

function newLayer(kind: MotionLayer['kind'], timeMs: number, durationMs: number, title?: string, assetPath?: string): MotionLayer {
  return {
    id: makeId(), name: title || `${nameForKind(kind)} ${Date.now().toString().slice(-4)}`, kind,
    startMs: Math.max(0, timeMs), endMs: Math.max(timeMs + 1000, Math.min(durationMs, timeMs + 5000)), assetPath,
    text: kind === 'text' ? 'Seu texto aqui' : undefined, fillColor: kind === 'shape' ? '#7c5cff' : '#ffffff',
    transform: { ...initialTransform(), x: 0, y: 0 }, keyframes: {}, effects: [], audio: { volume: 1, muted: false },
  };
}

function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<VideoProject | null>(null);
  const [undoStack, setUndoStack] = useState<VideoProject[]>([]);
  const [redoStack, setRedoStack] = useState<VideoProject[]>([]);
  const [screen, setScreen] = useState<'library' | 'editor'>('library');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState('');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [version, setVersion] = useState('');
  const [catalog, setCatalog] = useState<EffectDefinition[]>([]);
  const [effectSearch, setEffectSearch] = useState('');
  const [panel, setPanel] = useState<'media' | 'effects' | 'text' | 'layers'>('effects');
  const [zoom, setZoom] = useState(1);
  const [showKeyframes, setShowKeyframes] = useState(false);
  const [linkScale, setLinkScale] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const [previewStageSize, setPreviewStageSize] = useState({ width: 0, height: 0 });
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const saveTimer = useRef<number | undefined>(undefined);
  const lastHistoryAt = useRef(0);

  const commitProject = (next: VideoProject) => {
    if (project) {
      const now = Date.now();
      if (now - lastHistoryAt.current > 250) setUndoStack((stack) => [...stack.slice(-79), structuredClone(project)]);
      lastHistoryAt.current = now;
      setRedoStack([]);
    }
    setProject(next);
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous || !project) return;
    setRedoStack((stack) => [...stack.slice(-79), structuredClone(project)]);
    setUndoStack((stack) => stack.slice(0, -1));
    lastHistoryAt.current = 0;
    setProject(previous);
  };

  const redo = () => {
    const next = redoStack.at(-1);
    if (!next || !project) return;
    setUndoStack((stack) => [...stack.slice(-79), structuredClone(project)]);
    setRedoStack((stack) => stack.slice(0, -1));
    lastHistoryAt.current = 0;
    setProject(next);
  };

  const refreshProjects = useCallback(async () => {
    if (!desktop) return;
    try { setProjects(await desktop.listProjects()); }
    catch (error) { setNotice(`Não consegui carregar os projetos: ${String(error)}`); }
  }, []);

  useEffect(() => {
    void refreshProjects();
    void desktop?.appVersion().then(setVersion);
    const unsubscribe = desktop?.onUpdateStatus(setUpdate);
    fetch('./catalog/effects.json').then((response) => response.ok ? response.json() : []).then((items: EffectDefinition[]) => setCatalog(items)).catch(() => setCatalog([]));
    return unsubscribe;
  }, [refreshProjects]);

  useEffect(() => {
    if (!project || !desktop) return;
    setSaveState('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void desktop.saveProject(project).then(() => { setSaveState('saved'); void refreshProjects(); }).catch((error) => { setSaveState('error'); setNotice(`Falha ao salvar: ${String(error)}`); });
    }, 450);
    return () => window.clearTimeout(saveTimer.current);
  }, [project, refreshProjects]);

  useEffect(() => {
    const stage = previewStageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setPreviewStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(stage);
    return () => observer.disconnect();
  }, [screen, project?.id]);

  useEffect(() => {
    if (!playing || !project) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(); const elapsed = now-last; last = now;
      setPlayhead(current => {
        const next = current+elapsed;
        if (next >= project.durationMs) { setPlaying(false); return 0; }
        return next;
      });
    }, 1000 / project.fps);
    return () => window.clearInterval(timer);
  }, [playing, project]);

  const selectedLayer = project?.layers.find((layer) => layer.id === selectedLayerId) || null;
  const filteredProjects = projects.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
  const effectList = useMemo(() => catalog.filter((effect) => !effect.internal && `${effect.name} ${effect.category} ${effect.tags} ${effect.description}`.toLowerCase().includes(effectSearch.toLowerCase())), [catalog, effectSearch]);

  const openProject = async (id: string) => {
    if (!desktop) return setNotice('Abra Video Motion no aplicativo para acessar arquivos locais.');
    try {
      const loaded = await desktop.readProject(id);
      setUndoStack([]); setRedoStack([]); lastHistoryAt.current = 0;
      setProject(loaded); setSelectedLayerId(loaded.layers[0]?.id || null); setPlayhead(0); setScreen('editor');
    } catch (error) { setNotice(`Não consegui abrir o projeto: ${String(error)}`); }
  };

  const createProject = async (title: string, width: number, height: number, fps: number) => {
    if (!desktop) return setNotice('Abra Video Motion no aplicativo para criar projetos.');
    const summary = await desktop.createProject(title, width, height, fps);
    await refreshProjects(); await openProject(summary.id); setNewProjectOpen(false);
  };

  const importAlight = async () => {
    if (!desktop) return setNotice('A importação de arquivos funciona no aplicativo Video Motion.');
    setImportBusy(true);
    try {
      const source = await desktop.importProjectFile();
      if (!source) return;
      const converted = await parseAlightTransfer(source.fileName, source.base64);
      const summary = await desktop.saveImportedProject(converted.project, converted.assets);
      await refreshProjects(); await openProject(summary.id);
      setNotice(`${converted.project.layers.length} camadas reconhecidas. A compatibilidade visual de todos os efeitos ainda está em desenvolvimento.`);
    } catch (error) { setNotice(`Não consegui importar o projeto: ${String(error)}`); }
    finally { setImportBusy(false); }
  };

  const addLayer = (kind: MotionLayer['kind'], title?: string, assetPath?: string) => {
    if (!project) return;
    const layer = newLayer(kind, playhead, project.durationMs, title, assetPath);
    commitProject({ ...project, layers: [...project.layers, layer] }); setSelectedLayerId(layer.id);
  };

  const updateLayer = (id: string, updateFn: (layer: MotionLayer) => MotionLayer) => {
    if (!project) return;
    commitProject({ ...project, layers: project.layers.map((layer) => layer.id === id ? updateFn(layer) : layer) });
  };

  const changeTransform = (key: keyof MotionLayer['transform'], value: number) => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, layer => {
      const before = animatedTransform(layer, playhead);
      const ratio = before[key] === 0 ? 1 : value / before[key];
      const keys = linkScale && (key === 'scaleX' || key === 'scaleY') ? ['scaleX', 'scaleY'] as const : [key];
      const next = structuredClone(layer);
      for (const property of keys) {
        const adjusted = property === key ? value : before[property] * ratio;
        next.transform[property] = adjusted;
        if (next.keyframes[property]?.length) {
          const existing = next.keyframes[property].find(frame => Math.abs(frame.timeMs-playhead) < 1);
          if (existing) existing.value = adjusted;
          else next.keyframes[property].push({ id: makeId(), timeMs: playhead, value: adjusted, easing: 'linear' });
        }
      }
      return next;
    });
  };

  const toggleKeyframe = (property: keyof MotionLayer['transform']) => {
    if (!selectedLayer) return;
    const keys = linkScale && (property === 'scaleX' || property === 'scaleY') ? ['scaleX', 'scaleY'] as const : [property];
    const current = animatedTransform(selectedLayer, playhead);
    const remove = selectedLayer.keyframes[property]?.some(frame => Math.abs(frame.timeMs-playhead) < 1);
    updateLayer(selectedLayer.id, layer => {
      const keyframes = { ...layer.keyframes };
      for (const key of keys) {
        const frames = (keyframes[key] || []).filter(frame => Math.abs(frame.timeMs-playhead) >= 1);
        keyframes[key] = remove ? frames : [...frames, { id: makeId(), timeMs: playhead, value: current[key], easing: 'linear' as const }].sort((a,b) => a.timeMs-b.timeMs);
      }
      return { ...layer, keyframes };
    });
  };

  const addEffect = (definition: EffectDefinition) => {
    if (!selectedLayer) { setNotice('Selecione uma camada antes de adicionar um efeito.'); return; }
    const parameters = parseEffectParameters(definition);
    const effect: MotionEffect = { id: makeId(), effectId: definition.id, name: definition.name, preview: definition.preview, parameters, enabled: true, compatibility: isNativeCssEffect(definition.id) ? 'native' : 'metadata-only' };
    updateLayer(selectedLayer.id, (layer) => ({ ...layer, effects: [...layer.effects, effect] }));
    setNotice(effect.compatibility === 'native' ? `${definition.name} aplicado à prévia.` : `${definition.name} foi adicionado. Renderização desse shader ainda não está implementada.`);
  };

  const importMedia = async () => {
    if (!project || !desktop) return;
    try {
      const imported = await desktop.importMedia(project.id);
      if (!imported.length) return;
      const newLayers = imported.map((asset, index) => newLayer(asset.kind, playhead + index * 1000, project.durationMs, asset.title, asset.assetPath));
      commitProject({ ...project, layers: [...project.layers, ...newLayers] });
      setSelectedLayerId(newLayers.at(-1)?.id || null);
    } catch (error) { setNotice(`Erro ao adicionar mídia: ${String(error)}`); }
  };

  const exportProjectFile = () => {
    if (!project) return;
    void exportPortableProject(project).catch(error => setNotice(`Falha ao exportar cópia: ${String(error)}`));
  };

  const removeSelected = () => {
    if (!project || !selectedLayer) return;
    commitProject({ ...project, layers: project.layers.filter((layer) => layer.id !== selectedLayer.id) });
    setSelectedLayerId(null);
  };

  const splitSelected = () => {
    if (!project || !selectedLayer || playhead <= selectedLayer.startMs || playhead >= selectedLayer.endMs) {
      setNotice('Posicione o playhead dentro de um clipe selecionado para dividi-lo.');
      return;
    }
    const transformAtCut = animatedTransform(selectedLayer, playhead);
    const leftKeyframes = Object.fromEntries(Object.entries(selectedLayer.keyframes).map(([property, frames]) => [property, frames.filter((frame) => frame.timeMs < playhead)]));
    const rightKeyframes = Object.fromEntries(Object.entries(selectedLayer.keyframes).map(([property, frames]) => [property, frames.filter((frame) => frame.timeMs > playhead).map((frame) => ({ ...frame, id: makeId() }))]));
    for (const property of Object.keys(selectedLayer.transform) as Array<keyof MotionLayer['transform']>) {
      const frames = selectedLayer.keyframes[property];
      if (!frames?.length) continue;
      const atCut: Keyframe = { id: makeId(), timeMs: playhead, value: transformAtCut[property], easing: 'linear' };
      leftKeyframes[property] = [...(leftKeyframes[property] || []), atCut];
      rightKeyframes[property] = [{ ...atCut, id: makeId() }, ...(rightKeyframes[property] || [])];
    }
    const left = { ...selectedLayer, endMs: playhead, keyframes: leftKeyframes };
    const right = { ...trimLayer(selectedLayer, playhead, selectedLayer.endMs), id: makeId(), name: `${selectedLayer.name} (2)`, keyframes: rightKeyframes };
    commitProject({ ...project, layers: project.layers.map((layer) => layer.id === selectedLayer.id ? left : layer).concat(right) });
    setSelectedLayerId(right.id);
  };

  if (screen === 'library' || !project) {
    return <>
      <main className="library-shell">
        <header className="library-topbar">
          <div className="brand-mark"><Activity size={21} /><span>video motion</span><b>beta</b></div>
          <div className="library-top-actions">
            <button className="icon-button" title="Atualizações" onClick={() => void desktop?.checkForUpdates()}><Bell size={17} /></button>
            <button className="icon-button" title="Ajuda" onClick={() => void desktop?.openExternal('https://github.com/Samuklvm/Video-Motion')}><CircleHelp size={17} /></button>
            <div className="profile-dot">V</div>
          </div>
        </header>
        <section className="library-main">
          <div className="library-heading">
            <div><span className="eyebrow">ESPAÇO DE TRABALHO</span><h1>Seus projetos</h1><p>Crie uma edição nova ou continue de onde parou.</p></div>
            <button className="primary-button" onClick={() => setNewProjectOpen(true)}><Plus size={18} /> Novo projeto</button>
          </div>
          <div className="library-toolbar">
            <div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projetos" /></div>
            <button className="secondary-button" onClick={() => void importAlight()} disabled={importBusy}><ArrowDownToLine size={16} /> {importBusy ? 'Importando…' : 'Importar XML / .amproj'}</button>
            <button className="secondary-button" onClick={() => fileInput.current?.click()}><FolderOpen size={16} /> Abrir projeto</button>
            <input ref={fileInput} className="hidden-input" type="file" accept=".vmproj,application/json" onChange={(event) => void openProjectFromFile(event, desktop, refreshProjects, openProject, setNotice)} />
          </div>
          {filteredProjects.length ? <div className="project-grid">
            {filteredProjects.map((item) => <ProjectCard key={item.id} summary={item} onOpen={() => void openProject(item.id)} onRename={async () => { const name = window.prompt('Nome do projeto', item.title); if (name?.trim() && desktop) { await desktop.renameProject(item.id, name.trim()); await refreshProjects(); } }} onDelete={async () => { if (desktop && window.confirm(`Excluir “${item.title}”?`)) { await desktop.deleteProject(item.id); await refreshProjects(); } }} />)}
            <button className="project-create-card" onClick={() => setNewProjectOpen(true)}><span className="create-plus"><Plus size={22} /></span><strong>Criar projeto</strong><small>Escolha uma proporção e comece do zero</small></button>
          </div> : <div className="empty-projects"><div className="empty-art"><Film size={34} /><span><Play size={14} fill="currentColor" /></span></div><h2>{query ? 'Nenhum projeto encontrado' : 'Seu próximo vídeo começa aqui'}</h2><p>{query ? 'Tente outro termo de busca.' : 'Crie um projeto novo ou importe um XML exportado do Alight Motion.'}</p><div className="empty-actions"><button className="primary-button" onClick={() => setNewProjectOpen(true)}><Plus size={17} /> Novo projeto</button><button className="secondary-button" onClick={() => void importAlight()}><ArrowDownToLine size={16} /> Importar projeto</button></div></div>}
        </section>
        <footer className="library-footer"><span>Video Motion <small>{version ? `v${version}` : 'beta'}</small></span><span>Projetos salvos neste computador</span></footer>
      </main>
      {newProjectOpen && <NewProjectDialog onClose={() => setNewProjectOpen(false)} onCreate={(...args) => void createProject(...args)} />}
      <UpdateToast update={update} onDownload={() => void desktop?.downloadUpdate()} onInstall={() => void desktop?.installUpdate()} onClose={() => setUpdate(null)} />
      <Notice message={notice} onClose={() => setNotice('')} />
    </>;
  }

  const seconds = durations(project);
  const pxPerSecond = 72 * zoom;
  const timelineWidth = seconds * pxPerSecond;

  return <main className="editor-shell">
    <header className="editor-topbar">
      <button className="back-button" onClick={async () => { setPlaying(false); window.clearTimeout(saveTimer.current); try { await desktop?.saveProject(project); setProject(null); setScreen('library'); await refreshProjects(); } catch (error) { setNotice(`Falha ao salvar: ${String(error)}`); } }}><ChevronLeft size={18} /><span>Projetos</span></button>
      <div className="topbar-divider" />
      <div className="project-name"><strong>{project.title}</strong><ChevronDown size={14} /></div>
      <span className={`save-state ${saveState}`}><span className="save-dot" /> {saveState === 'saving' ? 'Salvando…' : saveState === 'error' ? 'Erro ao salvar' : 'Salvo'}</span>
      <div className="topbar-spacer" />
      <button className="icon-button" title="Desfazer" onClick={undo} disabled={!undoStack.length}><Undo2 size={17} /></button><button className="icon-button" title="Refazer" onClick={redo} disabled={!redoStack.length}><Redo2 size={17} /></button>
      <button className="secondary-button compact" onClick={exportProjectFile}><Download size={16} /> Salvar cópia</button>
      <button className="primary-button compact" onClick={() => setNotice('A exportação de vídeo ainda está sendo construída; o projeto local está salvo e já pode ser exportado como .vmproj.')}><Upload size={15} /> Exportar</button>
    </header>

    <div className="editor-workspace">
      <aside className="tool-rail">
        <button className={panel === 'media' ? 'active' : ''} onClick={() => setPanel('media')} title="Mídia"><Film size={19} /><span>Mídia</span></button>
        <button className={panel === 'effects' ? 'active' : ''} onClick={() => setPanel('effects')} title="Efeitos"><WandSparkles size={19} /><span>Efeitos</span></button>
        <button className={panel === 'text' ? 'active' : ''} onClick={() => setPanel('text')} title="Texto"><Type size={19} /><span>Texto</span></button>
        <button className={panel === 'layers' ? 'active' : ''} onClick={() => setPanel('layers')} title="Camadas"><Layers3 size={19} /><span>Camadas</span></button>
      </aside>

      <section className="asset-panel">
        <div className="panel-title"><div><span className="eyebrow">BIBLIOTECA</span><h2>{panelTitle(panel)}</h2></div><button className="icon-button small" title="Ajustes da biblioteca"><MoreHorizontal size={17} /></button></div>
        {panel === 'effects' && <>
          <div className="search-box panel-search"><Search size={15} /><input value={effectSearch} onChange={(event) => setEffectSearch(event.target.value)} placeholder="Buscar efeitos" /></div>
          <div className="effect-list">
            {effectList.map((effect) => <button className="effect-row" key={effect.id} onClick={() => addEffect(effect)} title={`${effect.name}${effect.description ? ' — ' + effect.description : ''}`}>
              <span className="effect-thumb">{effect.preview ? <img loading="lazy" alt={`Prévia de ${effect.name}`} src={`./previews/effects/${effect.preview}`} /> : <Sparkles size={17} />}</span><span className="effect-copy"><strong>{effect.name}</strong><small>{categoryLabel(effect.category)} · {(safeParseParameters(effect.parameters_json)).length} controles</small></span><Plus size={15} className="effect-add" />
            </button>)}
          </div>
          <div className="panel-footnote">{catalog.length ? `${catalog.filter(effect => !effect.internal).length} efeitos · busca local` : 'Carregando catálogo de efeitos…'}<br /><small>Shader completo ainda não faz parte deste primeiro editor.</small></div>
        </>}
        {panel === 'media' && <div className="panel-empty"><div className="drop-icon"><Image size={23} /></div><h3>Traga sua mídia</h3><p>Imagem, vídeo e áudio são copiados para a pasta do projeto.</p><button className="secondary-button full-width" onClick={() => void importMedia()}><Plus size={16} /> Adicionar arquivos</button><div className="asset-list">{project.layers.filter((layer) => layer.assetPath).map((layer) => <div className="asset-list-item" key={layer.id}><FileTypeIcon kind={layer.kind} /><span>{layer.name}</span></div>)}</div></div>}
        {panel === 'text' && <div className="text-presets"><button className="text-preset" onClick={() => addLayer('text')}><span className="text-preset-icon">T</span><strong>Adicionar texto</strong><small>Crie uma camada editável</small></button><button className="text-preset" onClick={() => addLayer('shape', 'Título', undefined)}><span className="text-preset-icon gradient">Aa</span><strong>Título simples</strong><small>Texto centralizado</small></button></div>}
        {panel === 'layers' && <div className="asset-list layers-library">{project.layers.map((layer) => <button key={layer.id} className="asset-list-item" onClick={() => setSelectedLayerId(layer.id)}><FileTypeIcon kind={layer.kind} /><span>{layer.name}</span><small>{formatClock(layer.startMs)}</small></button>)}</div>}
      </section>

      <section className="center-workspace">
        <div className="preview-topbar"><div><span className="preview-label">PRÉVIA</span><span className="preview-quality"> · {project.width} × {project.height} · {project.fps} fps</span></div><div className="preview-tools"><button className="icon-button small" title="Tela cheia"><Maximize2 size={15} /></button><button className="icon-button small" title="Ajuste de prévia"><ChevronDown size={14} /></button></div></div>
        <div className="preview-stage-wrap"><div ref={previewStageRef} className="preview-stage" style={{ aspectRatio: `${project.width} / ${project.height}`, backgroundColor: project.backgroundColor }}>
          {project.layers.filter((layer) => layer.kind !== 'audio' && playhead >= layer.startMs && playhead <= layer.endMs).map((layer) => <PreviewLayer key={layer.id} layer={layer} projectId={project.id} playhead={playhead} playing={playing} projectWidth={project.width} projectHeight={project.height} stageWidth={previewStageSize.width} stageHeight={previewStageSize.height} selected={layer.id === selectedLayerId} filter={layer.effects.filter(effect => effect.enabled).map(cssFilterForEffect).filter(Boolean).join(' ') || 'none'} onClick={() => setSelectedLayerId(layer.id)} />)}
          {project.layers.filter(layer => layer.kind === 'audio' && playhead >= layer.startMs && playhead < layer.endMs).map(layer => <AudioPreview key={layer.id} layer={layer} projectId={project.id} playhead={playhead} playing={playing}/>)}
          {!project.layers.filter((layer) => layer.kind !== 'audio').length && <div className="preview-placeholder"><span className="placeholder-play"><Play size={18} fill="currentColor" /></span><strong>Prévia do projeto</strong><small>Adicione mídia, texto ou formas para começar</small><button onClick={() => void importMedia()}><Plus size={15} /> Adicionar mídia</button></div>}
        </div></div>
        <div className="preview-controls"><div className="preview-time"><strong>{formatClock(playhead, project.fps)}</strong><span>/ {formatClock(project.durationMs)}</span></div><div className="transport"><button onClick={() => setPlayhead(0)} title="Voltar ao início"><SkipBack size={17} /></button><button className="play-control" onClick={() => setPlaying(!playing)} title={playing ? 'Pausar' : 'Reproduzir'}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><button onClick={() => setPlayhead(Math.min(project.durationMs, playhead + 1000 / project.fps))} title="Próximo quadro"><SkipForward size={17} /></button></div><div className="preview-controls-end"><button className="icon-button small" onClick={() => setShowKeyframes(!showKeyframes)} title="Curvas e keyframes"><Activity size={16} /></button><button className="icon-button small" title="Visualização"><Grid2X2 size={15} /></button></div></div>
      </section>

      <aside className="inspector-panel">
        <div className="inspector-tabs"><button className="selected">{selectedLayer ? 'Propriedades' : 'Projeto'}</button><button onClick={() => setShowKeyframes(!showKeyframes)}>Animação</button><button title="Ajustes"><Settings2 size={15} /></button></div>
        {selectedLayer ? <>
          <div className="inspector-layer-heading"><FileTypeIcon kind={selectedLayer.kind} /><div><strong>{selectedLayer.name}</strong><small>{nameForKind(selectedLayer.kind)} · {formatClock(selectedLayer.startMs)} — {formatClock(selectedLayer.endMs)}</small></div><button className="icon-button small" title="Excluir camada" onClick={removeSelected}><Trash2 size={15} /></button></div>
          <div className="property-section"><div className="section-heading"><strong>Transformar</strong><button className="icon-button small"><RotateCcw size={14} /></button></div>
            <TransformField label="Posição X" value={animatedTransform(selectedLayer, playhead).x} suffix="px" onChange={(v) => changeTransform('x', v)} onKeyframe={() => toggleKeyframe('x')} active={Boolean(selectedLayer.keyframes.x?.some((keyframe) => Math.abs(keyframe.timeMs - playhead) < 1))} />
            <TransformField label="Posição Y" value={animatedTransform(selectedLayer, playhead).y} suffix="px" onChange={(v) => changeTransform('y', v)} onKeyframe={() => toggleKeyframe('y')} active={Boolean(selectedLayer.keyframes.y?.some((keyframe) => Math.abs(keyframe.timeMs - playhead) < 1))} />
            <div className="motion-size-panel"><header><strong>Tamanho</strong><button aria-pressed={linkScale} onClick={() => setLinkScale(!linkScale)}>{linkScale ? '🔗 Vinculado' : 'Desvinculado'}</button></header>{(['scaleX', 'scaleY'] as const).map((key, index) => <div key={key}><TransformField label={index === 0 ? 'Largura' : 'Altura'} value={animatedTransform(selectedLayer, playhead)[key] * 100} suffix="%" onChange={value => changeTransform(key, value / 100)} onKeyframe={() => toggleKeyframe(key)} active={Boolean(selectedLayer.keyframes[key]?.some(frame => Math.abs(frame.timeMs-playhead) < 1))}/><input aria-label={index === 0 ? 'Escala horizontal' : 'Escala vertical'} type="range" min="1" max="400" step="0.1" value={animatedTransform(selectedLayer, playhead)[key] * 100} onChange={event => changeTransform(key, Number(event.target.value)/100)}/></div>)}</div>
            <TransformField label="Rotação" value={animatedTransform(selectedLayer, playhead).rotation} suffix="°" onChange={(v) => changeTransform('rotation', v)} onKeyframe={() => toggleKeyframe('rotation')} active={Boolean(selectedLayer.keyframes.rotation?.some((keyframe) => Math.abs(keyframe.timeMs - playhead) < 1))} />
            <TransformField label="Opacidade" value={animatedTransform(selectedLayer, playhead).opacity * 100} suffix="%" onChange={(v) => changeTransform('opacity', v / 100)} onKeyframe={() => toggleKeyframe('opacity')} active={Boolean(selectedLayer.keyframes.opacity?.some((keyframe) => Math.abs(keyframe.timeMs - playhead) < 1))} />
          </div>
          {selectedLayer.kind === 'text' && <div className="property-section"><div className="section-heading"><strong>Texto</strong><Type size={14} /></div><textarea className="text-input" value={selectedLayer.text || ''} onChange={(event) => updateLayer(selectedLayer.id, (layer) => ({ ...layer, text: event.target.value }))} /><div className="text-style-row"><button className="secondary-button compact">Roboto <ChevronDown size={13} /></button><button className="secondary-button compact">24 px <ChevronDown size={13} /></button><button className="icon-button small"><Star size={15} /></button></div></div>}
          {selectedLayer.effects.length > 0 && <div className="property-section"><div className="section-heading"><strong>Efeitos</strong><span className="mini-count">{selectedLayer.effects.length}</span><button className="icon-button small" onClick={() => setPanel('effects')}><Plus size={14} /></button></div>{selectedLayer.effects.map((effect) => <EffectInspector key={effect.id} effect={effect} catalog={catalog} onChange={(next) => updateLayer(selectedLayer.id, (layer) => ({ ...layer, effects: layer.effects.map((item) => item.id === next.id ? next : item) }))} onRemove={() => updateLayer(selectedLayer.id, (layer) => ({ ...layer, effects: layer.effects.filter((item) => item.id !== effect.id) }))} />)}</div>}
          {(selectedLayer.kind === 'audio' || selectedLayer.kind === 'video') && <div className="property-section"><strong>Áudio</strong><label className="effect-parameter">Volume<input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={selectedLayer.audio.volume} onChange={event => updateLayer(selectedLayer.id, layer => ({ ...layer, audio: { ...layer.audio, volume: Number(event.target.value) } }))}/></label><label className="effect-parameter">Silenciar<input type="checkbox" checked={selectedLayer.audio.muted} onChange={event => updateLayer(selectedLayer.id, layer => ({ ...layer, audio: { ...layer.audio, muted: event.target.checked } }))}/></label></div>}
          {showKeyframes && <CurveEditor layer={selectedLayer} playhead={playhead} onSeek={setPlayhead} onChange={(property, id, bezier) => updateLayer(selectedLayer.id, layer => ({ ...layer, keyframes: { ...layer.keyframes, [property]: layer.keyframes[property].map(frame => frame.id === id ? { ...frame, easing: 'cubic-bezier', bezier } : frame) } }))} />}
        </> : <div className="project-inspector"><span className="large-project-icon"><Film size={22} /></span><h3>Configurações do projeto</h3><p>{project.width} × {project.height} · {project.fps} quadros/s</p><button className="secondary-button full-width" onClick={() => void importMedia()}><Plus size={16} /> Adicionar mídia</button><button className="secondary-button full-width" onClick={() => addLayer('text')}><Type size={16} /> Adicionar texto</button></div>}
      </aside>
    </div>

    <section className="timeline-area">
      <div className="timeline-toolbar"><div className="timeline-title"><Layers3 size={16} /><strong>Timeline</strong><span className="timeline-count">{project.layers.length} camadas</span></div><div className="timeline-actions"><button className="icon-button small" title="Dividir clipe no playhead" onClick={splitSelected} disabled={!selectedLayer || playhead <= selectedLayer.startMs || playhead >= selectedLayer.endMs}><Scissors size={15} /></button><button className="icon-button small" title="Duplicar selecionado" onClick={() => selectedLayer && commitProject({ ...project, durationMs: Math.max(project.durationMs, selectedLayer.endMs + selectedLayer.endMs - selectedLayer.startMs), layers: [...project.layers, duplicateLayer(selectedLayer)] })}><Copy size={15} /></button><button className="icon-button small" title="Adicionar marcador"><Diamond size={15} /></button><span className="timeline-separator" /><button className="icon-button small" title="Diminuir zoom" onClick={() => setZoom(Math.max(0.35, zoom - 0.1))}><ZoomOut size={15} /></button><input aria-label="Zoom da timeline" type="range" min="0.35" max="2" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><button className="icon-button small" title="Aumentar zoom" onClick={() => setZoom(Math.min(2, zoom + 0.1))}><ZoomIn size={15} /></button><button className="icon-button small" title="Opções"><MoreHorizontal size={16} /></button></div></div>
      <div className="timeline-scroll" onWheel={(event) => { if (event.ctrlKey) { event.preventDefault(); setZoom(Math.min(2, Math.max(0.35, zoom - event.deltaY / 1000))); } }}>
        <div className="timeline-content" style={{ width: `calc(204px + ${timelineWidth}px)` }}>
          <div className="timeline-ruler-row"><div className="track-label-ruler"><button className="secondary-button compact" onClick={() => void importMedia()}><Plus size={14} /> Faixa</button></div><div className="ruler" style={{ width: timelineWidth }} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setPlayhead(Math.max(0, Math.min(project.durationMs, (event.clientX - rect.left) / pxPerSecond * 1000))); }}>
            {Array.from({ length: seconds + 1 }, (_, index) => <span key={index} style={{ left: index * pxPerSecond }}>{index % 5 === 0 ? `${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}` : <i />}</span>)}
            <div className="ruler-playhead" style={{ left: playhead / 1000 * pxPerSecond }} />
          </div></div>
          <div className="track-list">
            {project.layers.length ? [...project.layers].reverse().map((layer) => <TimelineTrack key={layer.id} layer={layer} selected={layer.id === selectedLayerId} playhead={playhead} durationMs={project.durationMs} pxPerSecond={pxPerSecond} onSelect={() => setSelectedLayerId(layer.id)} onSeek={setPlayhead} onMove={(startMs) => updateLayer(layer.id, (item) => moveLayer(item, startMs))} onTrim={(startMs, endMs) => updateLayer(layer.id, (item) => trimLayer(item, startMs, endMs))} onDelete={() => { commitProject({ ...project, layers: project.layers.filter((item) => item.id !== layer.id) }); if (selectedLayerId === layer.id) setSelectedLayerId(null); }} />) : <div className="empty-track"><span>Arraste mídia para cá ou use <b>+</b> para adicionar uma camada</span><button onClick={() => void importMedia()}><Plus size={14} /> Mídia</button><button onClick={() => addLayer('text')}><Type size={14} /> Texto</button><button onClick={() => addLayer('shape')}><Shapes size={14} /> Forma</button></div>}
            <div className="timeline-playhead" style={{ left: `calc(204px + ${playhead / 1000 * pxPerSecond}px)` }} />
          </div>
        </div>
      </div>
      <div className="timeline-bottom"><span>{project.fps} fps</span><span>·</span><span>{formatClock(project.durationMs, project.fps)}</span><div className="timeline-bottom-spacer" /><button className="text-button" onClick={() => commitProject({ ...project, durationMs: project.durationMs + 5000 })}><Plus size={14} /> Aumentar duração</button></div>
    </section>
    <UpdateToast update={update} onDownload={() => void desktop?.downloadUpdate()} onInstall={() => void desktop?.installUpdate()} onClose={() => setUpdate(null)} />
    <Notice message={notice} onClose={() => setNotice('')} />
  </main>;
}

function ProjectCard({ summary, onOpen, onRename, onDelete }: { summary: ProjectSummary; onOpen: () => void; onRename: () => void; onDelete: () => void }) {
  const [menu, setMenu] = useState(false);
  return <article className="project-card" onDoubleClick={onOpen}>
    <button className="project-thumb" onClick={onOpen} style={{ '--thumb-color': summary.thumbnailColor } as CSSProperties}><div className="thumb-grid" /><div className="thumb-orb" /><span className="thumb-play"><Play size={16} fill="currentColor" /></span><span className="aspect-chip">{summary.width}:{summary.height}</span></button>
    <div className="project-card-meta"><button className="project-open" onClick={onOpen}><strong>{summary.title}</strong><span>{new Date(summary.updatedAt).toLocaleDateString('pt-BR')} · {summary.layerCount} camadas · {summary.fps} fps</span></button><div className="project-menu-wrap"><button className="icon-button small" onClick={() => setMenu(!menu)}><MoreHorizontal size={17} /></button>{menu && <div className="context-menu"><button onClick={() => { setMenu(false); onRename(); }}>Renomear</button><button className="danger-text" onClick={() => { setMenu(false); onDelete(); }}>Excluir</button></div>}</div></div>
  </article>;
}

function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string, width: number, height: number, fps: number) => void }) {
  const [title, setTitle] = useState('Meu novo vídeo');
  const [preset, setPreset] = useState('vertical');
  const presets = { vertical: [1080, 1920], landscape: [1920, 1080], square: [1080, 1080] } as const;
  const [fps, setFps] = useState(30);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-card"><div className="modal-head"><div><span className="eyebrow">NOVO PROJETO</span><h2>Vamos criar um vídeo</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><label className="form-label">Nome do projeto<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><span className="form-label">Proporção</span><div className="preset-options">{Object.entries(presets).map(([key, size]) => <button className={preset === key ? 'preset-option active' : 'preset-option'} key={key} onClick={() => setPreset(key)}><span className={`ratio-box ratio-${key}`} /><strong>{({ vertical: 'Vertical', landscape: 'Paisagem', square: 'Quadrado' } as const)[key as keyof typeof presets]}</strong><small>{size[0]} × {size[1]}</small></button>)}</div><label className="form-label">Quadros por segundo<select value={fps} onChange={(event) => setFps(Number(event.target.value))}><option value={24}>24 fps</option><option value={25}>25 fps</option><option value={30}>30 fps</option><option value={50}>50 fps</option><option value={60}>60 fps</option></select></label><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={() => { const [width, height] = presets[preset as keyof typeof presets]; onCreate(title.trim() || 'Meu novo vídeo', width, height, fps); }}><Plus size={17} /> Criar projeto</button></div></div></div>;
}

function TimelineTrack({ layer, selected, playhead, durationMs, pxPerSecond, onSelect, onSeek, onMove, onTrim, onDelete }: { layer: MotionLayer; selected: boolean; playhead: number; durationMs: number; pxPerSecond: number; onSelect: () => void; onSeek: (time: number) => void; onMove: (start: number) => void; onTrim: (start: number, end: number) => void; onDelete: () => void }) {
  const [drag, setDrag] = useState<{ x: number; start: number; end: number; mode: 'move' | 'left' | 'right' } | null>(null);
  const left = layer.startMs / 1000 * pxPerSecond;
  const width = Math.max(38, (layer.endMs - layer.startMs) / 1000 * pxPerSecond);
  const keyframes = Object.values(layer.keyframes).flat();
  return <div className="track-row"><div className="track-label"><FileTypeIcon kind={layer.kind} /><span>{layer.name}</span><button onClick={onDelete} title="Excluir camada"><X size={12} /></button></div><div className="track-canvas" style={{ width: durationMs / 1000 * pxPerSecond }} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onSeek((event.clientX - rect.left) / pxPerSecond * 1000); }}>
    <div className={`clip ${layer.kind} ${selected ? 'selected' : ''}`} style={{ left, width }} onPointerDown={(event) => { event.stopPropagation(); onSelect(); const mode = (event.target as HTMLElement).closest('.clip-handle')?.classList.contains('left') ? 'left' : (event.target as HTMLElement).closest('.clip-handle')?.classList.contains('right') ? 'right' : 'move'; setDrag({ x: event.clientX, start: layer.startMs, end: layer.endMs, mode }); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!drag) return; const delta = (event.clientX - drag.x) / pxPerSecond * 1000; if (drag.mode === 'move') onMove(Math.max(0, Math.min(durationMs - (drag.end - drag.start), drag.start + delta))); else if (drag.mode === 'left') onTrim(Math.max(0, Math.min(drag.end - 100, drag.start + delta)), drag.end); else onTrim(drag.start, Math.min(durationMs, Math.max(drag.start + 100, drag.end + delta))); }} onPointerUp={() => setDrag(null)}>
      <span className="clip-handle left" title="Arraste para aparar o início" /><span className="clip-label">{layer.name}</span><span className="clip-handle right" title="Arraste para aparar o fim" />
      {keyframes.map((keyframe) => <button key={keyframe.id} className="keyframe-diamond" style={{ left: `${Math.max(2, ((keyframe.timeMs - layer.startMs) / Math.max(1, layer.endMs - layer.startMs)) * 100)}%` }} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSeek(keyframe.timeMs); onSelect(); }} title={`${formatClock(keyframe.timeMs)} · ${keyframe.easing}`} />)}
    </div>
    <div className="track-grid" style={{ backgroundSize: `${pxPerSecond}px 100%` }} />
    {playhead <= durationMs && <div className="track-playhead" style={{ left: playhead / 1000 * pxPerSecond }} />}
  </div></div>;
}

function PreviewLayer({ layer, projectId, playhead, playing, projectWidth, projectHeight, stageWidth, stageHeight, selected, filter, onClick }: { layer: MotionLayer; projectId: string; playhead: number; playing: boolean; projectWidth: number; projectHeight: number; stageWidth: number; stageHeight: number; selected: boolean; filter: string; onClick: () => void }) {
  const [source, setSource] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true;
    if (layer.assetPath && desktop) void desktop.readAsset(projectId, layer.assetPath).then((url) => { if (active) setSource(url); }).catch(() => setSource(''));
    return () => { active = false; };
  }, [layer.assetPath, projectId]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, layer.audio.volume));
    video.muted = layer.audio.muted;
    const targetTime = Math.max(0, (playhead - layer.startMs + (layer.sourceOffsetMs ?? 0)) / 1000);
    if (Math.abs(video.currentTime - targetTime) > (playing ? 0.35 : 0.04)) video.currentTime = targetTime;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [playhead, playing, layer.startMs, layer.sourceOffsetMs, layer.audio.volume, layer.audio.muted, source]);
  const transform = animatedTransform(layer, playhead);
  const scaleX = stageWidth / Math.max(1, projectWidth); const scaleY = stageHeight / Math.max(1, projectHeight);
  const style: CSSProperties = { transform: `translate(-50%, -50%) translate(${transform.x * scaleX}px, ${transform.y * scaleY}px) scale(${transform.scaleX}, ${transform.scaleY}) rotate(${transform.rotation}deg)`, opacity: transform.opacity, filter };
  return <div className={`preview-layer ${selected ? 'selected' : ''}`} style={style} onClick={(event) => { event.stopPropagation(); onClick(); }}>
    {layer.kind === 'text' ? <span className="preview-text">{layer.text || layer.name}</span> : layer.kind === 'shape' ? <span className="preview-shape" style={{ background: layer.fillColor }} /> : layer.kind === 'audio' ? null : source ? layer.kind === 'video' ? <video ref={videoRef} src={source} muted={layer.audio.muted} playsInline /> : <img src={source} /> : <div className="missing-media"><Image size={20} /><small>{layer.name}</small></div>}
    {selected && <div className="selection-frame"><i /><i /><i /><i /></div>}
  </div>;
}

function TransformField({ label, value, suffix, onChange, onKeyframe, active }: { label: string; value: number; suffix: string; onChange: (value: number) => void; onKeyframe: () => void; active: boolean }) {
  return <label className="transform-row"><span>{label}</span><input type="number" value={Number.isInteger(value) ? value : Number(value.toFixed(3))} onChange={(event) => onChange(Number(event.target.value))} /><small>{suffix}</small><button type="button" className={active ? 'key-toggle active' : 'key-toggle'} onClick={onKeyframe} title="Adicionar/remover keyframe"><Diamond size={13} fill={active ? 'currentColor' : 'none'} /></button></label>;
}

function EffectInspector({ effect, catalog, onChange, onRemove }: { effect: MotionEffect; catalog: EffectDefinition[]; onChange: (effect: MotionEffect) => void; onRemove: () => void }) {
  const definition = catalog.find((item) => item.id === effect.effectId);
  const parameters = definition ? safeParseParameters(definition.parameters_json) : [];
  const preview = effect.preview || definition?.preview;
  return <div className="effect-inspector"><div className="effect-inspector-head"><span className="effect-mini-thumb">{preview ? <img loading="lazy" alt={`Prévia de ${effect.name}`} src={`./previews/effects/${preview}`} /> : <Sparkles size={13} />}</span><strong>{definition?.name || effect.name}</strong><button className="icon-button tiny" onClick={() => onChange({ ...effect, enabled: !effect.enabled })} title={effect.enabled ? 'Desativar efeito' : 'Ativar efeito'}><Eye size={13} /></button><button className="icon-button tiny" onClick={onRemove} title="Remover efeito"><X size={13} /></button></div>
    {definition?.description && <p className="effect-description">{definition.description}</p>}
    <button className="effect-reset-all" onClick={() => onChange({ ...effect, parameters: { ...effect.parameters, ...Object.fromEntries(parameters.map(parameter => [parameter.id, parameterDefault(parameter)])) } })}>↺ Restaurar ajustes do efeito</button>
    {parameters.map((parameter) => <EffectParameterControl key={parameter.id} parameter={parameter} value={effect.parameters[parameter.id]} onChange={(value) => onChange({ ...effect, parameters: { ...effect.parameters, [parameter.id]: value } })} />)}
    {effect.compatibility === 'native' && <div className="compatibility-note">Prévia aproximada no editor</div>}
    {effect.compatibility === 'metadata-only' && <div className="compatibility-note">Controle recuperado · renderização ainda indisponível</div>}
  </div>;
}

function UpdateToast({ update, onDownload, onInstall, onClose }: { update: UpdateStatus | null; onDownload: () => void; onInstall: () => void; onClose: () => void }) {
  if (!update || ['dev', 'current'].includes(update.state)) return null;
  return <div className="update-toast"><div className="update-icon"><Download size={16} /></div><div className="update-copy"><strong>{update.state === 'available' ? `Video Motion ${update.version} disponível` : update.state === 'downloaded' ? 'Atualização pronta para instalar' : update.state === 'downloading' ? `Baixando atualização ${update.percent || 0}%` : update.state === 'error' ? 'Falha ao verificar atualização' : 'Verificando atualizações…'}</strong><small>{update.message || (update.state === 'available' ? 'A versão está pronta para baixar.' : '')}</small></div>{update.state === 'available' && <button className="primary-button compact" onClick={onDownload}>Baixar</button>}{update.state === 'downloaded' && <button className="primary-button compact" onClick={onInstall}>Reiniciar</button>}<button className="icon-button tiny" onClick={onClose}><X size={13} /></button></div>;
}

function Notice({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { if (!message) return; const timer = window.setTimeout(onClose, 6500); return () => window.clearTimeout(timer); }, [message, onClose]);
  if (!message) return null;
  return <div className="notice-toast"><span>{message}</span><button onClick={onClose}><X size={15} /></button></div>;
}

function FileTypeIcon({ kind }: { kind: MotionLayer['kind'] }) {
  const Icon = { video: Video, image: Image, audio: AudioLines, text: Type, shape: Shapes }[kind];
  return <span className={`kind-icon ${kind}`}><Icon size={15} /></span>;
}

function parseEffectParameters(effect: EffectDefinition) {
  return Object.fromEntries(safeParseParameters(effect.parameters_json).map(parameter => [parameter.id, parameterDefault(parameter)]));
}
function safeParseParameters(raw: string): EffectParameter[] { try { return JSON.parse(raw || '[]') as EffectParameter[]; } catch { return []; } }
function animatedTransform(layer: MotionLayer, timeMs: number): MotionLayer['transform'] {
  const output = { ...layer.transform };
  for (const [property, frames] of Object.entries(layer.keyframes)) {
    if (!(property in output) || frames.length === 0) continue;
    const sorted = [...frames].sort((a, b) => a.timeMs - b.timeMs);
    if (timeMs <= sorted[0].timeMs) { output[property as keyof typeof output] = Number(sorted[0].value); continue; }
    if (timeMs >= sorted[sorted.length - 1].timeMs) { output[property as keyof typeof output] = Number(sorted[sorted.length - 1].value); continue; }
    const rightIndex = sorted.findIndex((keyframe) => keyframe.timeMs >= timeMs);
    const left = sorted[rightIndex - 1]; const right = sorted[rightIndex];
    if (timeMs === right.timeMs) { output[property as keyof typeof output] = Number(right.value); continue; }
    let amount = (timeMs - left.timeMs) / Math.max(1, right.timeMs - left.timeMs);
    if (left.easing === 'cubic-bezier' && left.bezier) amount = cubicBezier(amount, left.bezier);
    else if (left.easing === 'ease-in') amount = cubicBezier(amount, [.42,0,1,1]);
    else if (left.easing === 'ease-out') amount = cubicBezier(amount, [0,0,.58,1]);
    else if (left.easing === 'ease-in-out') amount = cubicBezier(amount, [.42,0,.58,1]);
    else if (left.easing === 'step') amount = 0;
    output[property as keyof typeof output] = Number(left.value) + (Number(right.value) - Number(left.value)) * amount;
  }
  return output;
}
function isNativeCssEffect(id: string) { return /blur|brightness|contrast|saturation|vibrance|hue|opacity|grayscale|greyscale|sepia|invert/i.test(id); }
function cssFilterForEffect(effect: MotionEffect) {
  if (!effect.enabled) return '';
  const name = effect.effectId.toLowerCase();
  const preferred = Object.entries(effect.parameters).find(([key, value]) => /amount|strength|value|radius|intensity|level/i.test(key) && typeof value === 'number')?.[1];
  const first = Number(preferred ?? Object.values(effect.parameters).find((value) => typeof value === 'number') ?? 1);
  if (name.includes('blur')) return `blur(${Math.max(0, first)}px)`;
  if (name.includes('brightness')) return `brightness(${Math.max(0, first)} )`;
  if (name.includes('contrast')) return `contrast(${Math.max(0, first)} )`;
  if (name.includes('saturation') || name.includes('vibrance')) return `saturate(${Math.max(0, first)} )`;
  if (name.includes('hue')) return `hue-rotate(${first}deg)`;
  if (name.includes('grayscale') || name.includes('greyscale')) return `grayscale(${Math.max(0, Math.min(1, first))})`;
  if (name.includes('sepia')) return `sepia(${Math.max(0, Math.min(1, first))})`;
  if (name.includes('invert')) return `invert(${Math.max(0, Math.min(1, first))})`;
  if (name.includes('opacity')) return `opacity(${Math.max(0, Math.min(1, first))})`;
  return '';
}
function panelTitle(panel: string) { return ({ effects: 'Efeitos', media: 'Mídia', text: 'Texto', layers: 'Camadas' } as Record<string, string>)[panel] || panel; }
function safeFileName(value: string) { return value.replace(/[<>:"/\\|?*]/g, '-').slice(0, 80) || 'projeto'; }
async function exportPortableProject(project: VideoProject) {
  const archive = new JSZip();
  const portable = structuredClone(project);
  archive.file('project.json', JSON.stringify(portable, null, 2));
  const seen = new Set<string>();
  for (const layer of project.layers) {
    if (!layer.assetPath || !desktop || seen.has(layer.assetPath)) continue;
    seen.add(layer.assetPath);
    try {
      const base64 = await desktop.readAssetData(project.id, layer.assetPath);
      archive.file(`assets/${layer.assetPath}`, base64, { base64: true });
    } catch { throw new Error(`Mídia indisponível: ${layer.name}. A cópia não foi gerada para evitar perda de arquivos.`); }
  }
  const blob = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${safeFileName(project.title)}.vmproj`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function openProjectFromFile(event: ChangeEvent<HTMLInputElement>, api: Window['videoMotion'], refresh: () => Promise<void>, open: (id: string) => Promise<void>, notify: (message: string) => void) {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file || !api) return;
  try {
    const archive = await JSZip.loadAsync(await file.arrayBuffer());
    const projectEntry = archive.file('project.json');
    if (!projectEntry) throw new Error('O arquivo não contém project.json.');
    const raw = JSON.parse(await projectEntry.async('text')) as VideoProject;
    const importedAssets = [];
    for (const entry of Object.values(archive.files)) {
      if (entry.dir || !entry.name.startsWith('assets/')) continue;
      const bytes = await entry.async('base64');
      const index = importedAssets.length;
      importedAssets.push({ fileName: entry.name.slice('assets/'.length), base64: bytes, referenceKeys: [] });
      for (const layer of raw.layers) if (layer.assetPath === entry.name.slice('assets/'.length)) layer.assetPath = `__imported__/${index}`;
    }
    const copy = { ...raw, id: makeId(), title: raw.title || file.name.replace(/\.vmproj$/i, ''), updatedAt: new Date().toISOString() };
    const summary = importedAssets.length ? await api.saveImportedProject(copy, importedAssets) : await api.saveProject(copy);
    await refresh(); await open(summary.id);
  } catch (error) { notify(`Arquivo .vmproj inválido: ${String(error)}`); }
}

export default App;

function categoryLabel(category: string) { return ({distort:'Distorção',blur:'Desfoque',color:'Cor e luz',procedural:'Procedural',transform:'Transformação',text:'Texto',drawing:'Desenho',matte:'Máscara',blend:'Mesclagem','3d':'3D'} as Record<string,string>)[category] || category || 'Geral'; }
