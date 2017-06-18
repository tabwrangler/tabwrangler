import FileSaver from 'file-saver'

/**
 * Import the backup of saved tabs and the accounting information.
 * If any of the required keys in the backup object is missing, the backup will abort without
 * importing the data.
 * @param {storageLocal} storageLocal is needed to restore the accounting information
 * @param {tabManager} tabManager is required to initialize it with the imported saved tabs
 * @param {Event} event contains the path of the backup file
 */
const importData = (storageLocal, tabManager, event) => {
  const files = event.target.files;

  if (files[0]) {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        try {
          const json = JSON.parse(fileReader.result);
          if(Object.keys(json).length < 4) {
            reject(new Error('Invalid backup'));
          } else {
            const savedTabs = json.savedTabs;
            const totalTabsRemoved = json.totalTabsRemoved;
            const totalTabsUnwrangled = json.totalTabsUnwrangled;
            const totalTabsWrangled = json.totalTabsWrangled;

            storageLocal.setValue('totalTabsRemoved', totalTabsRemoved);
            storageLocal.setValue('totalTabsUnwrangled', totalTabsUnwrangled);
            storageLocal.setValue('totalTabsWrangled', totalTabsWrangled);

            chrome.storage.local.set({savedTabs});
            // re-read the wrangled tabs
            tabManager.closedTabs.init();
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      };

      fileReader.onerror = (arg) => {
        reject(arg);
      };

      fileReader.readAsText(files[0], 'utf-8');
    });
  } else {
    return Promise.reject('Nothing to import');
  }
}
/**
 * Export all saved tabs and some accounting information in one object. The object has 4 keys
 * - savedTabs
 * - totalTabsRemoved
 * - totalTabsUnwrangled
 * - totalTabsWrangled
 *
 * savedTabs is acquired by reading it directly from localstorage.
 *
 * @param {storageLocal} storageLocal to retrieve all the accounting information
 */
const exportData = (storageLocal) => {
  chrome.storage.local.get('savedTabs', (savedTabs) => {
    savedTabs['totalTabsRemoved'] = storageLocal.get('totalTabsRemoved');
    savedTabs['totalTabsUnwrangled'] = storageLocal.get('totalTabsUnwrangled');
    savedTabs['totalTabsWrangled'] = storageLocal.get('totalTabsWrangled');

    const exportData = JSON.stringify(savedTabs);

    const blob = new Blob([exportData], {
      type: 'application/json;charset=utf-8',
    });
    FileSaver.saveAs(blob, exportFileName(new Date(Date.now())));
  });
}

const exportFileName = (date) => {
  const localeDateString = date.toLocaleDateString().replace(/\//g, '-')
  return `TabWranglerExport-${localeDateString}.json`;
}

export {
  importData,
  exportData,
  exportFileName,
}
