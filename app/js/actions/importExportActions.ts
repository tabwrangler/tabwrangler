/**
 * Import the backup of saved tabs and the accounting information.
 * If any of the required keys in the backup object is missing, the backup will abort without
 * importing the data.
 *
 * @param event contains the path of the backup file
 */
function importData(event: React.FormEvent<HTMLInputElement>): Promise<void> {
  const files = (event.target as HTMLInputElement).files;
  if (files != null && files[0]) {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        try {
          const json = JSON.parse(String(fileReader.result));
          if (Object.keys(json).length < 4) {
            reject(new Error("Invalid backup"));
          } else {
            const savedTabs = json.savedTabs;
            const totalTabsRemoved = json.totalTabsRemoved;
            const totalTabsUnwrangled = json.totalTabsUnwrangled;
            const totalTabsWrangled = json.totalTabsWrangled;
            chrome.storage.local
              .get("persist:localStorage")
              .then((data) =>
                chrome.storage.local.set({
                  "persist:localStorage": {
                    ...data["persist:localStorage"],
                    savedTabs,
                    totalTabsRemoved,
                    totalTabsUnwrangled,
                    totalTabsWrangled,
                  },
                })
              )
              .then(resolve);
          }
        } catch (e) {
          reject(e);
        }
      };

      fileReader.onerror = (arg) => {
        reject(arg);
      };
      fileReader.readAsText(files[0], "utf-8");
    });
  } else {
    return Promise.reject("Nothing to import");
  }
}

/**
 * Export all saved tabs and some accounting information in one object. The object has 4 keys:
 *
 * - savedTabs
 * - totalTabsRemoved
 * - totalTabsUnwrangled
 * - totalTabsWrangled
 *
 * `savedTabs` is acquired by reading it directly from the Store.
 */
async function exportData(): Promise<unknown> {
  const data = await chrome.storage.local.get("persist:localStorage");
  const localStorage = data["persist:localStorage"];
  const exportObject = {
    savedTabs: localStorage.savedTabs,
    totalTabsRemoved: localStorage.totalTabsRemoved,
    totalTabsUnwrangled: localStorage.totalTabsUnwrangled,
    totalTabsWrangled: localStorage.totalTabsWrangled,
  };
  const exportData = JSON.stringify(exportObject);
  const blob = new Blob([exportData], {
    type: "application/json;charset=utf-8",
  });
  return Promise.resolve(blob);
}

const exportFileName = (date: Date): string => {
  // Use a format like YYYY-MM-DD, which is the first 10 characters of the ISO string format.
  const localeDateString = date.toISOString().substr(0, 10);
  return `TabWranglerExport-${localeDateString}.json`;
};

export { importData, exportData, exportFileName };
