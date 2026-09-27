/* Local folder access is granted explicitly by the browser's directory picker. */
const treatmentFiles = (() => {
  let folder = null;
  let settingsDB = null;
  const supported = typeof window.showDirectoryPicker === 'function';
  const status = () => document.querySelector('#folder-status');
  function update(message) {
    status().textContent = message || (folder
      ? `${folder.name}/ → finished HTML · ${folder.name}/backup/ → editable backups`
      : 'Choose camera/Treatment once to save exports and backups there.');
  }
  async function init() {
    document.querySelector('#choose-folder').addEventListener('click', connect);
    if (!supported) {
      update('Folder saving is unavailable in this browser. Use Chrome or Edge, or save downloads manually.');
      document.querySelector('#choose-folder').disabled = true;
      return;
    }
    try {
      settingsDB = await new Promise((resolve, reject) => {
        const request = indexedDB.open('cn-treatment-folders', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('settings');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      folder = await new Promise((resolve, reject) => {
        const request = settingsDB.transaction('settings').objectStore('settings').get('folder');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      update();
    } catch {
      update('Choose camera/Treatment. This browser may not remember the folder next time.');
    }
  }
  async function connect() {
    try {
      // Invoke the picker directly from the click to preserve user activation.
      const selected = await window.showDirectoryPicker({id:'cn-treatment-folder',mode:'readwrite'});
      folder = selected;
      if (settingsDB) {
        try {
          await new Promise((resolve,reject) => {
            const tx = settingsDB.transaction('settings','readwrite');
            tx.objectStore('settings').put(selected,'folder');
            tx.oncomplete=resolve;
            tx.onerror=()=>reject(tx.error);
            tx.onabort=()=>reject(tx.error);
          });
        } catch {
          update(`Connected to ${folder.name} for this visit; the browser could not remember it.`);
          return;
        }
      }
      update();
    } catch (error) {
      if (error.name !== 'AbortError') update('Folder access was not granted. Try Choose save folder again.');
    }
  }
  async function save(data, type, baseName, backup = false) {
    if (!folder) {
      if (supported) {
        toast('Choose your camera/Treatment save folder first.');
        return false;
      }
      download(data, type, baseName);
      toast('Downloaded using browser settings. Move the file to camera/Treatment'+(backup?'/backup.':'.'));
      return false;
    }
    try {
      if (await folder.queryPermission({mode:'readwrite'}) !== 'granted' &&
          await folder.requestPermission({mode:'readwrite'}) !== 'granted') {
        update('Folder permission is needed. Choose save folder to reconnect.');
        return false;
      }
      const destination = backup ? await folder.getDirectoryHandle('backup',{create:true}) : folder;
      // Keep each export distinct rather than replacing a previous delivery or backup.
      const dot = baseName.lastIndexOf('.');
      const stamp = new Date().toISOString().replace(/[:.]/g,'-');
      const name = `${baseName.slice(0,dot)}-${stamp}-${crypto.randomUUID().slice(0,8)}${baseName.slice(dot)}`;
      const file = await destination.getFileHandle(name,{create:true});
      const stream = await file.createWritable();
      try {
        await stream.write(new Blob([data],{type}));
        await stream.close();
      } catch (error) {
        try { await stream.abort(); } catch {}
        throw error;
      }
      update();
      toast(`Saved to ${folder.name}/${backup?'backup/':''}${name}`);
      return true;
    } catch {
      update('File could not be saved. Check folder access and available disk space, then retry.');
      toast('Not saved. Your draft is still in the editor.');
      return false;
    }
  }
  return {init,save};
})();
