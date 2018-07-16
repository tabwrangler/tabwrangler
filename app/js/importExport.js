/* @flow */

import {
  setSavedTabs,
  setTotalTabsRemoved,
  setTotalTabsUnwrangled,
  setTotalTabsWrangled,
} from './actions/localStorageActions';
import FileSaver from 'file-saver';
import typeof tabManagerType from './tabmanager';

/**
 * Import the backup of saved tabs and the accounting information.
 * If any of the required keys in the backup object is missing, the backup will abort without
 * importing the data.
 *
 * @param store is needed to restore the accounting information
 * @param tabManager is required to initialize it with the imported saved tabs
 * @param event contains the path of the backup file
 */
function importData(
  store: Object,
  tabManager: tabManagerType,
  event: SyntheticInputEvent<HTMLInputElement>
): Promise<void> {
  const files = event.target.files;

  if (files[0]) {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        try {
          const json = JSON.parse(String(fileReader.result));
          if (Object.keys(json).length < 4) {
            reject(new Error('Invalid backup'));
          } else {
            const savedTabs = json.savedTabs;
            const totalTabsRemoved = json.totalTabsRemoved;
            const totalTabsUnwrangled = json.totalTabsUnwrangled;
            const totalTabsWrangled = json.totalTabsWrangled;

            store.dispatch(setTotalTabsRemoved(totalTabsRemoved));
            store.dispatch(setTotalTabsUnwrangled(totalTabsUnwrangled));
            store.dispatch(setTotalTabsWrangled(totalTabsWrangled));
            store.dispatch(setSavedTabs(savedTabs));
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      };

      fileReader.onerror = arg => {
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
 * @param store to retrieve all the accounting information
 */
function exportData(store: Object) {
  const { localStorage } = store.getState();
  const exportObject = {
    savedTabs: localStorage.savedTabs,
    totalTabsRemoved: localStorage.totalTabsRemoved,
    totalTabsUnwrangled: localStorage.totalTabsUnwrangled,
    totalTabsWrangled: localStorage.totalTabsWrangled,
  };
  const exportData = JSON.stringify(exportObject);
  const blob = new Blob([exportData], {
    type: 'application/json;charset=utf-8',
  });
  FileSaver.saveAs(blob, exportFileName(new Date(Date.now())));
}

const exportFileName = (date: Date) => {
  const localeDateString = date.toLocaleDateString('en-US').replace(/\//g, '-');
  return `TabWranglerExport-${localeDateString}.json`;
};

export { importData, exportData, exportFileName };
