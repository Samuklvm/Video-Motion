const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('videoMotion', {
  listProjects: () => ipcRenderer.invoke('projects:list'),
  readProject: (id) => ipcRenderer.invoke('projects:read', id),
  saveProject: (project) => ipcRenderer.invoke('projects:save', project),
  createProject: (title, width, height, fps) => ipcRenderer.invoke('projects:create', title, width, height, fps),
  renameProject: (id, title) => ipcRenderer.invoke('projects:rename', id, title),
  deleteProject: (id) => ipcRenderer.invoke('projects:delete', id),
  importProjectFile: () => ipcRenderer.invoke('projects:import-file'),
  saveImportedProject: (project, assets) => ipcRenderer.invoke('projects:save-import', project, assets),
  importMedia: (id) => ipcRenderer.invoke('projects:import-media', id),
  readAsset: (id, relativePath) => ipcRenderer.invoke('projects:read-asset', id, relativePath),
  appVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('updates:status', listener);
    return () => ipcRenderer.removeListener('updates:status', listener);
  },
});
