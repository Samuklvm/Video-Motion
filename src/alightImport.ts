import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type { ImportedAsset, MotionEffect, MotionLayer, VideoProject } from './types';

type XmlObject = Record<string, any>;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, trimValues: false, isArray: (name) => ['shape', 'text', 'audio', 'effect', 'property', 'kf', 'media', 'bookmark'].includes(name) });
const array = <T,>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const attr = (value: XmlObject | undefined, key: string, fallback = ''): string => String(value?.[`@_${key}`] ?? fallback);
const number = (value: unknown, fallback = 0): number => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};
const uuid = () => crypto.randomUUID();
const splitNumbers = (value: string, fallback: number[]) => {
  const values = value.split(',').map(Number).filter(Number.isFinite);
  return values.length ? values : fallback;
};
const colorToCss = (value: string) => {
  if (/^#[\da-f]{8}$/i.test(value)) return `#${value.slice(3)}`;
  return /^#[\da-f]{6}$/i.test(value) ? value : '#d8d8d8';
};

function mapPropertyValue(value: string, type: string): boolean | number | string | number[] {
  if (type === 'vec2' || type === 'vec3' || type === 'color') return splitNumbers(value, []);
  if (type === 'bool') return value === 'true' || value === '1';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function mapLayer(node: XmlObject, kind: 'shape' | 'text' | 'audio', mediaMap: Map<string, string>, durationMs: number, projectWidth: number, projectHeight: number): MotionLayer {
  const startMs = number(attr(node, 'startTime'), 0);
  const endMs = Math.max(startMs + 1, number(attr(node, 'endTime'), durationMs));
  const transform = node.transform || {};
  const location = splitNumbers(attr(transform.location, 'value', '0,0'), [0, 0]);
  const scale = splitNumbers(attr(transform.scale, 'value', '1,1'), [1, 1]);
  const fillType = attr(node, 'fillType');
  const fillImage = attr(node, 'fillImage');
  const mediaPath = mediaMap.get(fillImage) || mediaMap.get(fillImage.split('/').pop() || '');
  const mappedKind = kind === 'text' ? 'text' : kind === 'audio' || attr(node, 'type') === 'audio' ? 'audio' : fillType === 'media' ? (/\.(mp4|mov|mkv|webm)(?:$|\?)/i.test(fillImage) || mediaPath?.match(/\.(mp4|mov|mkv|webm)$/i) ? 'video' : 'image') : kind === 'shape' ? 'shape' : 'image';
  const effects = array<XmlObject>(node.effect).map((effect): MotionEffect => {
    const effectId = attr(effect, 'id', 'unknown.effect');
    const rawParameters: Record<string, string | number | boolean | number[]> = {};
    for (const property of array<XmlObject>(effect.property)) {
      const key = attr(property, 'name', 'parameter');
      rawParameters[key] = mapPropertyValue(attr(property, 'value'), attr(property, 'type'));
    }
    return { id: uuid(), effectId, name: effectId.split('.').pop() || effectId, parameters: rawParameters, enabled: true, compatibility: 'metadata-only' };
  });

  const keyframes: MotionLayer['keyframes'] = {};
  const properties = array<XmlObject>(node.property);
  for (const effect of array<XmlObject>(node.effect)) properties.push(...array<XmlObject>(effect.property));
  for (const property of properties) {
    const name = attr(property, 'name');
    const kfs = array<XmlObject>(property.kf);
    if (!name || !kfs.length) continue;
    keyframes[name] = kfs.map((kf) => ({ id: uuid(), timeMs: startMs + number(attr(kf, 't')) * (endMs - startMs), value: mapPropertyValue(attr(kf, 'v'), attr(property, 'type')), easing: 'linear' }));
  }

  const transformProperties: Array<[string, XmlObject | undefined]> = [['location', transform.location], ['scale', transform.scale], ['rotation', transform.rotation], ['opacity', transform.opacity]];
  for (const [sourceName, property] of transformProperties) {
    if (!property) continue;
    const frames = array<XmlObject>(property.kf);
    if (!frames.length) continue;
    const components = sourceName === 'location' ? ['x', 'y'] : sourceName === 'scale' ? ['scaleX', 'scaleY'] : [sourceName];
    for (const [index, component] of components.entries()) {
      keyframes[component] = frames.map((kf) => {
        const frameValue = attr(kf, 'v');
        const value = components.length > 1 ? splitNumbers(frameValue, [0, 1])[index] : number(frameValue, 0);
        return { id: uuid(), timeMs: startMs + number(attr(kf, 't')) * (endMs - startMs), value, easing: 'linear' };
      });
    }
  }

  const rawText = String(node.string?.['#text'] ?? node.string ?? node['#text'] ?? '');
  return {
    id: uuid(), name: attr(node, 'label', `${mappedKind} ${attr(node, 'id', '')}`), kind: mappedKind, startMs, endMs,
    ...(mediaPath ? { assetPath: mediaPath } : fillImage ? { sourceUri: fillImage } : {}),
    ...(kind === 'text' ? { text: rawText || attr(node, 'text', 'Texto importado') } : {}),
    fillColor: colorToCss(attr(node.fillColor, 'value', attr(node, 'fillColor', '#FFD8D8D8'))),
    transform: { x: location[0] - projectWidth / 2, y: location[1] - projectHeight / 2, scaleX: scale[0], scaleY: scale[1] || scale[0], rotation: number(attr(transform.rotation, 'value')), opacity: number(attr(transform.opacity, 'value', '1'), 1) },
    keyframes, effects, audio: { volume: number(attr(node, 'volume', '1'), 1), muted: false },
    importedAttributes: Object.fromEntries(Object.entries(node).filter(([key]) => key.startsWith('@_'))),
  };
}

function buildProject(scene: XmlObject, fileName: string, mediaMap: Map<string, string>): VideoProject {
  const root: XmlObject = scene.scene || scene;
  const width = number(attr(root, 'width'), 1080);
  const height = number(attr(root, 'height'), 1920);
  const durationMs = Math.max(1000, number(attr(root, 'totalTime'), 10000));
  const layers: MotionLayer[] = [];
  for (const [tag, kind] of [['shape', 'shape'], ['text', 'text'], ['audio', 'audio']] as const) {
    for (const node of array<XmlObject>(root[tag])) layers.push(mapLayer(node, kind, mediaMap, durationMs, width, height));
  }
  const now = new Date().toISOString();
  return {
    format: 'VideoMotionProject', formatVersion: 1, id: uuid(), title: attr(root, 'title', fileName.replace(/\.(amproj|xml|zip)$/i, '')),
    width, height, fps: number(attr(root, 'fps'), 30), durationMs, backgroundColor: colorToCss(attr(root, 'bgcolor', '#FF101116')),
    layers: layers.sort((a, b) => a.startMs - b.startMs),
    compatibility: { imports: [{ source: fileName, importedAt: now, warnings: ['A importação preserva os dados de efeitos originais, mas este protótipo ainda não renderiza todos os efeitos/shaders do Alight Motion.'], originalXml: '' }] },
    createdAt: now, updatedAt: now,
  };
}

export async function parseAlightTransfer(fileName: string, base64: string): Promise<{ project: VideoProject; assets: ImportedAsset[] }> {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const assets: ImportedAsset[] = [];
  let xmlText = '';
  const mediaMap = new Map<string, string>();
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip && /\.(amproj|zip)$/i.test(fileName)) {
    const archive = await JSZip.loadAsync(bytes);
    const xmlEntry = Object.values(archive.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith('.xml'));
    if (!xmlEntry) throw new Error('O pacote não contém um XML de projeto reconhecido.');
    xmlText = await xmlEntry.async('text');
    const parsed = parser.parse(xmlText) as XmlObject;
    const root = parsed.scene || parsed;
    const media = array<XmlObject>(root.media);
    const entries = Object.values(archive.files).filter((entry) => !entry.dir && !entry.name.toLowerCase().endsWith('.xml'));
    for (const item of media) {
      const sourceUri = attr(item, 'uri');
      const candidates = [attr(item, 'filename'), attr(item, 'sig'), sourceUri.split('/').pop() || ''].filter(Boolean).map((value) => value.toLowerCase());
      const match = entries.find((entry) => candidates.some((candidate) => entry.name.toLowerCase().endsWith(candidate) || entry.name.toLowerCase().includes(candidate.replace(/\.[^.]+$/, ''))));
      if (match) {
        const rawBase64 = await match.async('base64');
        const fileNameInArchive = match.name.split('/').pop() || 'imported-media.bin';
        const referenceKeys = [sourceUri, attr(item, 'filename'), attr(item, 'sig')].filter(Boolean);
        assets.push({ fileName: fileNameInArchive, base64: rawBase64, referenceKeys });
        for (const key of referenceKeys) mediaMap.set(key, `__imported__/${assets.length - 1}`);
      }
    }
  } else {
    xmlText = new TextDecoder().decode(bytes);
  }
  const parsed = parser.parse(xmlText) as XmlObject;
  const project = buildProject(parsed, fileName, mediaMap);
  project.compatibility.imports[0].originalXml = xmlText;
  project.compatibility.imports[0].warnings.push(`${project.layers.length} camada(s) reconhecida(s); ${assets.length} arquivo(s) de mídia correspondente(s) encontrado(s) no pacote.`);
  return { project, assets };
}
