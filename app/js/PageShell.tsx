import NavBar, { NavBarTabID } from "./NavBar";
import { UndoProvider } from "./UndoContext";
import { register } from "timeago.js";
import timeagoLocale from "./timeagoLocale";
import { useEffect } from "react";
import { useStorageSyncPersistQuery } from "./storage";

interface PageShellProps {
  activeTabId: NavBarTabID;
  children: React.ReactNode;
  isOptionsPage: boolean;
  onClickTab: (tabId: NavBarTabID) => void;
}

export default function PageShell({
  activeTabId,
  children,
  isOptionsPage,
  onClickTab,
}: PageShellProps) {
  useTheme();
  useEffect(() => {
    const uiLanguage = chrome.i18n.getUILanguage();
    register(uiLanguage, timeagoLocale[uiLanguage]);
  }, []);

  return (
    <UndoProvider>
      <NavBar activeTabId={activeTabId} isOptionsPage={isOptionsPage} onClickTab={onClickTab} />
      <div className="tab-content container-fluid">{children}</div>
    </UndoProvider>
  );
}

function useTheme() {
  const { data: storageSyncPersistData } = useStorageSyncPersistQuery();
  useEffect(() => {
    function setTheme(prefersDark: boolean) {
      const storedTheme = storageSyncPersistData?.theme;

      let theme;
      if (storedTheme != null && storedTheme !== "system") theme = storedTheme;
      else theme = prefersDark ? "dark" : "light";

      if (theme === "light" || theme === "dark")
        document.documentElement.setAttribute("data-bs-theme", theme);
      else document.documentElement.removeAttribute("data-bs-theme");
    }

    function handlePrefersDarkChange(event: MediaQueryListEvent) {
      setTheme(event.matches);
    }

    const prefersDarkQL = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(prefersDarkQL.matches);
    prefersDarkQL.addEventListener("change", handlePrefersDarkChange);
    return () => {
      prefersDarkQL.removeEventListener("change", handlePrefersDarkChange);
    };
  }, [storageSyncPersistData?.theme]);
}
