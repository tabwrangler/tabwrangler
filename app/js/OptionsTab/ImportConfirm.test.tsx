import { fireEvent, render, screen } from "@testing-library/react";
import ImportConfirm from "./ImportConfirm";
import type { ParsedImport } from "../actions/importExportActions";

const CLOSED_TABS = {
  savedTabs: [{ id: 1 }, { id: 2 }, { id: 3 }] as unknown as chrome.tabs.Tab[],
};

function parsedImport(fields: Partial<ParsedImport>): ParsedImport {
  return { closedTabs: null, settings: {}, skippedSettings: [], theme: null, ...fields };
}

function renderConfirm(
  fields: Partial<ParsedImport>,
  { closedTabCount = 87, error = null }: { closedTabCount?: number; error?: Error | null } = {},
) {
  const onCancel = jest.fn();
  const onChooseFile = jest.fn();
  const onImport = jest.fn();
  const confirm = (parsed: ParsedImport) => (
    <ImportConfirm
      closedTabCount={closedTabCount}
      error={error}
      fileName="TabWranglerExport-2026-11-18.json"
      onCancel={onCancel}
      onChooseFile={onChooseFile}
      onExited={jest.fn()}
      onImport={onImport}
      parsed={parsed}
      show
    />
  );
  const { rerender } = render(confirm(parsedImport(fields)));
  return {
    chooseFile: (nextFields: Partial<ParsedImport>) => rerender(confirm(parsedImport(nextFields))),
    onCancel,
    onChooseFile,
    onImport,
  };
}

const replaceLabel = "options_importExport_confirm_replaceClosedTabs";

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
    expect(
      screen.getByText("options_importExport_confirm_replaceClosedTabs_help:87,3"),
    ).toBeTruthy();

    fireEvent.click(screen.getByLabelText(replaceLabel));
    fireEvent.click(screen.getByText("options_importExport_import"));

    expect(onImport).toHaveBeenCalledWith({ replaceClosedTabs: true });
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

  test("asks for another file and starts the replace choice off again for it", () => {
    const { chooseFile, onChooseFile, onImport } = renderConfirm({ closedTabs: CLOSED_TABS });
    fireEvent.click(screen.getByLabelText(replaceLabel));

    fireEvent.click(screen.getByText("options_importExport_confirm_chooseFile"));
    expect(onChooseFile).toHaveBeenCalled();

    chooseFile({ closedTabs: CLOSED_TABS, settings: { minTabs: 3 } });
    expect((screen.getByLabelText(replaceLabel) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByText("options_importExport_import"));
    expect(onImport).toHaveBeenCalledWith({ replaceClosedTabs: false });
  });

  test("shows why a file cannot be imported instead of what it holds", () => {
    renderConfirm(
      { closedTabs: CLOSED_TABS, settings: { minTabs: 3 } },
      { error: new Error("Not an export file") },
    );
    expect(screen.getByText("Not an export file")).toBeTruthy();
    expect(screen.queryByText("options_importExport_confirm_settings")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect((screen.getByText("options_importExport_import") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  test("cancels without importing", () => {
    const { onCancel, onImport } = renderConfirm({ settings: { minTabs: 3 } });
    fireEvent.click(screen.getByText("options_importExport_cancel"));
    expect(onCancel).toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });
});
