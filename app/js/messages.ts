import { SessionTab } from "./types";

export interface UnwrangleTabsMessage {
  sessionTabs: SessionTab[];
  type: "unwrangleTabs";
}

export type RuntimeMessage = "reload" | UnwrangleTabsMessage;

export type UnwrangleTabsResponse = { ok: true } | { error: string; ok: false };

// Restores tabs from the background so the work finishes even if the popup closes mid-restore,
// which `chrome.sessions.restore` can cause on its own by focusing the restored tab.
export async function requestUnwrangleTabs(sessionTabs: SessionTab[]): Promise<void> {
  const message: UnwrangleTabsMessage = { sessionTabs, type: "unwrangleTabs" };
  const response: UnwrangleTabsResponse | undefined = await chrome.runtime.sendMessage(message);
  if (response == null) throw new Error("No response to unwrangleTabs message");
  if (!response.ok) throw new Error(response.error);
}
