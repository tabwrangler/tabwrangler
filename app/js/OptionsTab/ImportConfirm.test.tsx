import { fireEvent, render, screen } from "@testing-library/react";
import ImportConfirm from "./ImportConfirm";
import type { ParsedImport } from "../actions/importExportActions";

const CLOSED_TABS = {
  savedTabs: [{ id: 1 }, { id: 2 }, { id: 3 }] as unknown as chrome.tabs.Tab[],
};

function renderConfirm(fields: Partial<ParsedImport>, closedTabCount = 87) {
  const onCancel = jest.fn();
  const onImport = jest.fn();
  render(
    <ImportConfirm
      closedTabCount={closedTabCount}
      onCancel={onCancel}
      onImport={onImport}
      parsed={{ closedTabs: null, settings: {}, skippedSettings: [], theme: null, ...fields }}
    />,
  );
  return { onCancel, onImport };
}

const replaceLabel = "options_importExport_confirm_replaceClosedTabs:87,3";

beforeEach(() => {
  Object.assign(chrome.i18n, {
    getMessage: (key: string, substitutions?: string[]) =>
      substitutions == null ? key : `${key}:${substitutions.join(",")}`,
  });
});

describe("ImportConfirm", () => {
  test("imports settings without replacing closed tabs unless asked to", () => {
    const { onImport } = renderConfirm({ closedTabs: CLOSED_TABS, settings: { minTabs: 3 } });
    expect(screen.getByText("options_importExport_confirm_settings")).toBeTruthy();
    expect((screen.getByLabelText(replaceLabel) as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByText("options_importExport_import"));

    expect(onImport).toHaveBeenCalledWith({ replaceClosedTabs: false });
  });

  test("replaces closed tabs when its box is ticked, showing how many each side has", () => {
    const { onImport } = renderConfirm({ closedTabs: CLOSED_TABS, settings: { minTabs: 3 } });

    fireEvent.click(screen.getByLabelText(replaceLabel));
    fireEvent.click(screen.getByText("options_importExport_import"));

    expect(onImport).toHaveBeenCalledWith({ replaceClosedTabs: true });
  });

  test.each<[string, ParsedImport["closedTabs"]]>([
    ["no closed tabs", null],
    ["an empty list of closed tabs", { savedTabs: [] }],
  ])("does not offer to replace closed tabs from a file with %s", (_label, closedTabs) => {
    renderConfirm({ closedTabs, theme: "dark" });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  test("imports nothing from a file with only closed tabs until replacing them is chosen", () => {
    const { onImport } = renderConfirm({ closedTabs: CLOSED_TABS });
    const importButton = screen.getByText("options_importExport_import") as HTMLButtonElement;
    expect(screen.getByText("options_importExport_confirm_noSettings")).toBeTruthy();
    expect(importButton.disabled).toBe(true);

    fireEvent.click(importButton);
    expect(onImport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(replaceLabel));
    expect(importButton.disabled).toBe(false);
  });

  test("lists settings this version cannot use", () => {
    renderConfirm({ settings: { minTabs: 3 }, skippedSettings: ["fromTheFuture", "theme"] });
    expect(
      screen.getByText("options_importExport_confirm_skipped:fromTheFuture, theme"),
    ).toBeTruthy();
  });

  test("cancels without importing", () => {
    const { onCancel, onImport } = renderConfirm({ settings: { minTabs: 3 } });
    fireEvent.click(screen.getByText("options_importExport_cancel"));
    expect(onCancel).toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });
});
