export type LayerKind = 'video' | 'image' | 'audio' | 'text' | 'shape';
export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'step' | 'cubic-bezier';

export interface Keyframe {
  id: string;
  timeMs: number;
  value: number | string | boolean | number[];
  easing: Easing;
  bezier?: [number, number, number, number];
}

export interface MotionEffect {
  id: string;
  effectId: string;
  name: string;
  preview?: string;
  parameters: Record<string, string | number | boolean | number[]>;
  enabled: boolean;
  compatibility: 'native' | 'metadata-only';
}

export interface MotionLayer {
  id: string;
  name: string;
  kind: LayerKind;
  startMs: number;
  endMs: number;
  sourceOffsetMs?: number;
  assetPath?: string;
  assetKey?: string;
  sourceUri?: string;
  text?: string;
  fillColor?: string;
  transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number; opacity: number };
  keyframes: Record<string, Keyframe[]>;
  effects: MotionEffect[];
  audio: { volume: number; muted: boolean };
  importedAttributes?: Record<string, unknown>;
}

export interface VideoProject {
  format: 'VideoMotionProject';
  formatVersion: number;
  id: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  backgroundColor: string;
  layers: MotionLayer[];
  compatibility: { imports: Array<{ source: string; importedAt: string; warnings: string[]; originalXml?: string }> };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  updatedAt: string;
  layerCount: number;
  thumbnailColor: string;
  filePath: string;
}

export interface ImportedAsset {
  fileName: string;
  base64: string;
  referenceKeys: string[];
}

export interface EffectParameter {
  kind: string;
  id: string;
  label: string;
  default: string;
  min: string;
  max: string;
  step: string;
  choices: string[];
}

export interface EffectDefinition {
  internal?: boolean;
  id: string;
  file: string;
  name: string;
  description: string;
  category: string;
  tags: string;
  preview: string;
  preview_animated: boolean;
  parameters_json: string;
}

declare global {
  interface Window {
    videoMotion: {
      listProjects(): Promise<ProjectSummary[]>;
      readProject(id: string): Promise<VideoProject>;
      saveProject(project: VideoProject): Promise<ProjectSummary>;
      createProject(title: string, width: number, height: number, fps: number): Promise<ProjectSummary>;
      renameProject(id: string, title: string): Promise<ProjectSummary>;
      deleteProject(id: string): Promise<boolean>;
      importProjectFile(): Promise<{ fileName: string; base64: string } | null>;
      saveImportedProject(project: VideoProject, assets: ImportedAsset[]): Promise<ProjectSummary>;
      importMedia(id: string): Promise<Array<{ assetPath: string; title: string; kind: LayerKind; bytes: number }>>;
      readAsset(id: string, relativePath: string): Promise<string>;
      readAssetData(id: string, relativePath: string): Promise<string>;
      appVersion(): Promise<string>;
      checkForUpdates(): Promise<{ state: string; message?: string }>;
      downloadUpdate(): Promise<boolean>;
      installUpdate(): Promise<boolean>;
      openExternal(url: string): Promise<void>;
      onUpdateStatus(callback: (status: UpdateStatus) => void): () => void;
    };
  }
}

export interface UpdateStatus {
  state: 'checking' | 'available' | 'current' | 'downloading' | 'downloaded' | 'error' | 'dev';
  version?: string;
  percent?: number;
  message?: string;
}
