import FileSaver from 'file-saver'

const importData = (event) => {
  const files = event.target.files;

  if (files[0]) { 
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        try {
          chrome.storage.local.set(JSON.parse(fileReader.result));
          resolve();
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
    console.log('Nothing to import');

    return Promise.resolve();
  }
}

const exportData = () => {
  // since there is storageLocal, I don't know if it would be better to put
  // that function call there
  chrome.storage.local.get('savedTabs', (savedTabs) => {
    const result = JSON.stringify(savedTabs);

    const blob = new Blob([result], {
      type: 'application/json;charset=utf-8',
    });
    FileSaver.saveAs(blob, exportFileName(new Date(Date.now())));
  })
}

const exportFileName = (date) => {
  const localeDateString = date.toLocaleDateString().replace(/\//g, '-')
  return `TabWranglerExport-${localeDateString}.json`
}

export {
  importData,
  exportData,
  exportFileName,
}