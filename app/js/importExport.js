import FileSaver from 'file-saver';

const importData = () => {

}

const exportData = () => {
  // since there is storageLocal, I don't know if it would be better to put
  // that function call there
  chrome.storage.local.get('savedTabs', (savedTabs) => {
    const result = JSON.stringify(savedTabs);

    const blob = new Blob([result], {type: 'application/json;charset=utf-8'});
    FileSaver.saveAs(blob, exportFileName(new Date(Date.now())));
  });
}

const exportFileName = (date) => {
  const localeDateString = date.toLocaleDateString().replace(/\//g, '-');
  return `TabWranglerExport-${localeDateString}.json`;
}

export {
  importData,
  exportData,
  exportFileName,
}
