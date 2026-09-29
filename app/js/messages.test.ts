import { requestUnwrangleTabs } from "./messages";

describe("requestUnwrangleTabs", () => {
  const sessionTabs = [
    { session: undefined, tab: { url: "https://example.com" } as chrome.tabs.Tab },
  ];

  test("sends the tabs to the background", async () => {
    const sendMessageMock = jest.fn(() => Promise.resolve({ ok: true }));
    Object.assign(chrome.runtime, { sendMessage: sendMessageMock });
    await requestUnwrangleTabs(sessionTabs);
    expect(sendMessageMock).toHaveBeenCalledWith({ sessionTabs, type: "unwrangleTabs" });
  });

  test("rejects when the background reports a failure", async () => {
    Object.assign(chrome.runtime, {
      sendMessage: jest.fn(() => Promise.resolve({ error: "boom", ok: false })),
    });
    await expect(requestUnwrangleTabs(sessionTabs)).rejects.toThrow("boom");
  });

  test("rejects when the background sends no response", async () => {
    Object.assign(chrome.runtime, { sendMessage: jest.fn(() => Promise.resolve(undefined)) });
    await expect(requestUnwrangleTabs(sessionTabs)).rejects.toThrow("No response");
  });

  test("rejects when the message channel closes", async () => {
    Object.assign(chrome.runtime, {
      sendMessage: jest.fn(() =>
        Promise.reject(new Error("The message port closed before a response was received.")),
      ),
    });
    await expect(requestUnwrangleTabs(sessionTabs)).rejects.toThrow("message port closed");
  });
});
