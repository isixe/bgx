const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bgx', {
  saveImages: (files, title) => ipcRenderer.invoke('batch-save-images', { files, title }),
});
