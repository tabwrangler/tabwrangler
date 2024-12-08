import settings from "../settings";
import { useStorageSyncPersistQuery, useStorageSyncQuery } from "../storage";
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
            chrome.storage.local
              .get("persist:localStorage")
              .then((data) =>
                chrome.storage.local.set({
                  "persist:localStorage": {
                    ...data["persist:localStorage"],
                    savedTabs: json.savedTabs,
                    totalTabsRemoved: json.totalTabsRemoved,
                    totalTabsUnwrangled: json.totalTabsUnwrangled,
                    totalTabsWrangled: json.totalTabsWrangled,
                  },
                }),
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
 */
async function exportData(): Promise<Blob> {
  const data = await chrome.storage.local.get("persist:localStorage");
  const localStorage = data["persist:localStorage"];
  const exportData = JSON.stringify({
    savedTabs: localStorage.savedTabs,
    totalTabsRemoved: localStorage.totalTabsRemoved,
    totalTabsUnwrangled: localStorage.totalTabsUnwrangled,
    totalTabsWrangled: localStorage.totalTabsWrangled,
  });
  return new Blob([exportData], {
    type: "application/json;charset=utf-8",
  });
}

function initialiseApp(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.set({
        "persist:settings": {
          minTabs: settings.get("minTabs"),
          maxTabs: settings.get("maxTabs"),
          minutesInactive: settings.get("minutesInactive"),
          secondsInactive: settings.get("secondsInactive"),
          whitelist: settings.get("whitelist"),
          targetTitles: settings.get("targetTitles"),
        },
      })
        .then(resolve);
    } catch (e) {
      reject(e);
    }
  });
}

async function exportSettings(): Promise<Blob> {
  const exportData = JSON.stringify({
    minTabs: settings.get("minTabs"),
    maxTabs: settings.get("maxTabs"),
    minutesInactive: settings.get("minutesInactive"),
    secondsInactive: settings.get("secondsInactive"),
    whitelist: settings.get("whitelist"),
    targetTitles: settings.get("targetTitles"),
  });
  return new Blob([exportData], {
    type: "application/json;charset=utf-8",
  });
}

function importSettings(event: React.FormEvent<HTMLInputElement>): Promise<void> {
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
            settings.setValue("minTabs", json.minTabs);
            settings.setValue("maxTabs", json.maxTabs);
            settings.setValue("minutesInactive", json.minutesInactive);
            settings.setValue("secondsInactive", json.secondsInactive);
            settings.setValue("whitelist", json.whitelist);
            settings.setValue("targetTitles", json.targetTitles);
            Promise.resolve("Settings imported");
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

const exportFileName = (date: Date): string => {
  // Use a format like YYYY-MM-DD, which is the first 10 characters of the ISO string format.
  const localeDateString = date.toISOString().substr(0, 10);
  return `TabWranglerExport-${localeDateString}.json`;
};

export { importData, exportData, importSettings, exportSettings, exportFileName, initialiseApp };
