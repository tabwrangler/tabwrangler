import AsyncLock from "async-lock";

export const ASYNC_LOCK = new AsyncLock();

export async function mutateStorageSyncPersist({
  key,
  value,
}: {
  key: string;
  value: unknown;
}): Promise<void> {
  return ASYNC_LOCK.acquire("persist:settings", async () => {
    const data = await chrome.storage.sync.get({ "persist:settings": {} });
    return chrome.storage.sync.set({
      "persist:settings": { ...data["persist:settings"], [key]: value },
    });
  });
}

export async function mutateStorageSync({
  key,
  value,
}: {
  key: string;
  value: unknown;
}): Promise<void> {
  return chrome.storage.sync.set({ [key]: value });
}
