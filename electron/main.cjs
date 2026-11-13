const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const isDev = !app.isPackaged;
let mainWindow;
const PROJECTS_DIR = () => path.join(app.getPath('userData'), 'VideoMotion', 'projects');
const MEDIA_TYPES = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.mp3', '.wav', '.m4a', '.aac', '.flac', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

function sendUpdate(state, detail = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:status', { state, ...detail });
}

function emitUpdaterEvents() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate('checking'));
  autoUpdater.on('update-available', (info) => sendUpdate('available', { version: info.version }));
  autoUpdater.on('update-not-available', (info) => sendUpdate('current', { version: info.version }));
  autoUpdater.on('download-progress', (progress) => sendUpdate('downloading', { percent: Math.round(progress.percent) }));
  autoUpdater.on('update-downloaded', (info) => sendUpdate('downloaded', { version: info.version }));
  autoUpdater.on('error', (error) => sendUpdate('error', { message: error.message }));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#111318',
    title: 'Video Motion',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://github.com/Samuklvm/Video-Motion')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const local = isDev ? url.startsWith('http://127.0.0.1:5173') : url.startsWith('file://');
    if (!local) event.preventDefault();
  });
  if (isDev) mainWindow.loadURL('http://127.0.0.1:5173');
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = undefined; });
}

function safeId(value) {
  if (typeof value !== 'string' || !/^[\w-]{1,80}$/.test(value)) throw new Error('Invalid project id.');
  return value;
}

function projectPath(id) { return path.join(PROJECTS_DIR(), `${safeId(id)}.vmproj`); }

async function ensureProjectsDir() { await fs.mkdir(PROJECTS_DIR(), { recursive: true }); }

async function readProject(id) {
  return JSON.parse(await fs.readFile(projectPath(id), 'utf8'));
}

function summarizeProject(project, filePath) {
  return {
    id: project.id,
    title: project.title || 'Sem título',
    width: project.width || 1920,
    height: project.height || 1080,
    fps: project.fps || 30,
    updatedAt: project.updatedAt || new Date().toISOString(),
    layerCount: Array.isArray(project.layers) ? project.layers.length : 0,
    thumbnailColor: project.backgroundColor || '#181b25',
    filePath,
  };
}

async function saveProject(project) {
  if (!project || typeof project !== 'object') throw new Error('Invalid project document.');
  const id = safeId(project.id);
  await ensureProjectsDir();
  const clean = { ...project, updatedAt: new Date().toISOString(), formatVersion: 1 };
  const target = projectPath(id);
  const temp = `${target}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(clean, null, 2), 'utf8');
  await fs.rename(temp, target);
  return summarizeProject(clean, target);
}

async function pathInAssets(projectId, relativePath) {
  const root = path.resolve(PROJECTS_DIR(), safeId(projectId), 'assets');
  const resolved = path.resolve(root, relativePath);
  if (relativePath && !resolved.startsWith(root + path.sep)) throw new Error('Invalid asset path.');
  return { root, resolved };
}

function displayName(filePath) { return path.basename(filePath, path.extname(filePath)); }

app.whenReady().then(async () => {
  await ensureProjectsDir();
  emitUpdaterEvents();
  ipcMain.handle('projects:list', async () => {
    const entries = await fs.readdir(PROJECTS_DIR(), { withFileTypes: true });
    const projects = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.vmproj')) continue;
      const fullPath = path.join(PROJECTS_DIR(), entry.name);
      try { projects.push(summarizeProject(JSON.parse(await fs.readFile(fullPath, 'utf8')), fullPath)); }
      catch { /* Preserve corrupt documents on disk; let the user open or recover them manually. */ }
    }
    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });
  ipcMain.handle('projects:read', (_event, id) => readProject(id));
  ipcMain.handle('projects:save', (_event, project) => saveProject(project));
  ipcMain.handle('projects:create', async (_event, title, width, height, fps) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const project = { format: 'VideoMotionProject', formatVersion: 1, id, title: String(title || 'Novo projeto').slice(0, 120), width, height, fps, durationMs: 10000, backgroundColor: '#111318', layers: [], compatibility: { imports: [] }, createdAt: now, updatedAt: now };
    await fs.mkdir(path.join(PROJECTS_DIR(), id, 'assets'), { recursive: true });
    return saveProject(project);
  });
  ipcMain.handle('projects:rename', async (_event, id, title) => {
    const project = await readProject(id);
    project.title = String(title || 'Sem título').slice(0, 120);
    return saveProject(project);
  });
  ipcMain.handle('projects:delete', async (_event, id) => {
    await fs.rm(projectPath(id), { force: true });
    await fs.rm(path.join(PROJECTS_DIR(), safeId(id)), { recursive: true, force: true });
    return true;
  });
  ipcMain.handle('projects:import-file', async () => {
    const choice = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar projeto do Alight Motion',
      properties: ['openFile'],
      filters: [{ name: 'Projetos e cenas', extensions: ['amproj', 'xml', 'zip'] }, { name: 'Todos os arquivos', extensions: ['*'] }],
    });
    if (choice.canceled || !choice.filePaths[0]) return null;
    const filePath = choice.filePaths[0];
    const stat = await fs.stat(filePath);
    if (stat.size > 300 * 1024 * 1024) throw new Error('O arquivo ultrapassa o limite inicial de importação de 300 MB.');
    return { fileName: path.basename(filePath), base64: (await fs.readFile(filePath)).toString('base64') };
  });
  ipcMain.handle('projects:save-import', async (_event, project, importedAssets) => {
    const id = safeId(project?.id);
    const assetsRoot = path.join(PROJECTS_DIR(), id, 'assets');
    await fs.mkdir(assetsRoot, { recursive: true });
    const resolvedAssets = [];
    for (const asset of Array.isArray(importedAssets) ? importedAssets : []) {
      const ext = path.extname(String(asset.fileName || '')).toLowerCase();
      const safeExt = MEDIA_TYPES.has(ext) ? ext : '.bin';
      const fileName = `${crypto.randomUUID()}${safeExt}`;
      const target = path.join(assetsRoot, fileName);
      await fs.writeFile(target, Buffer.from(String(asset.base64 || ''), 'base64'));
      resolvedAssets.push({ fileName, referenceKeys: asset.referenceKeys || [] });
    }
    for (const layer of project.layers || []) {
      const marker = String(layer.assetPath || '').match(/^__imported__\/(\d+)$/);
      if (marker) layer.assetPath = resolvedAssets[Number(marker[1])]?.fileName;
    }
    return saveProject(project);
  });
  ipcMain.handle('projects:import-media', async (_event, id) => {
    const choice = await dialog.showOpenDialog(mainWindow, { title: 'Adicionar mídia', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Vídeo, áudio e imagem', extensions: [...MEDIA_TYPES].map((x) => x.slice(1)) }, { name: 'Todos os arquivos', extensions: ['*'] }] });
    if (choice.canceled) return [];
    const { root: assetsRoot } = await pathInAssets(id, '');
    await fs.mkdir(assetsRoot, { recursive: true });
    const imported = [];
    for (const source of choice.filePaths) {
      const ext = path.extname(source).toLowerCase();
      if (!MEDIA_TYPES.has(ext)) continue;
      const targetName = `${crypto.randomUUID()}${ext}`;
      await fs.copyFile(source, path.join(assetsRoot, targetName));
      const stat = await fs.stat(source);
      imported.push({ assetPath: targetName, title: displayName(source), kind: ['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext) ? 'video' : ['.mp3', '.wav', '.m4a', '.aac', '.flac'].includes(ext) ? 'audio' : 'image', bytes: stat.size });
    }
    return imported;
  });
  ipcMain.handle('projects:read-asset', async (_event, id, relativePath) => {
    const { root, resolved } = await pathInAssets(id, relativePath);
    if (!resolved.startsWith(root + path.sep)) throw new Error('Invalid asset path.');
    await fs.access(resolved);
    return pathToFileURL(resolved).href;
  });
  ipcMain.handle('updates:check', async () => {
    if (isDev) return { state: 'dev' };
    try { await autoUpdater.checkForUpdates(); return { state: 'checking' }; }
    catch (error) { sendUpdate('error', { message: error.message }); return { state: 'error', message: error.message }; }
  });
  ipcMain.handle('updates:download', async () => {
    if (!isDev) await autoUpdater.downloadUpdate();
    return true;
  });
  ipcMain.handle('updates:install', async () => { if (!isDev) autoUpdater.quitAndInstall(); return true; });
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:open-external', async (_event, url) => {
    const parsed = new URL(String(url));
    if (parsed.protocol === 'https:' && parsed.hostname === 'github.com') await shell.openExternal(parsed.toString());
  });

  createWindow();
  if (!isDev) setTimeout(() => autoUpdater.checkForUpdates().catch((error) => sendUpdate('error', { message: error.message })), 5000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
