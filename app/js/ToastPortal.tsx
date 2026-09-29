import { createContext, useContext, useState } from "react";
import ToastContainer from "react-bootstrap/ToastContainer";
import { createPortal } from "react-dom";

const ToastContainerContext = createContext<HTMLDivElement | null | undefined>(undefined);

export function ToastPortalProvider({ children }: { children: React.ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <ToastContainerContext.Provider value={container}>
      {children}
      <ToastContainer
        className="p-3"
        containerPosition="fixed"
        position="bottom-start"
        ref={setContainer}
      />
    </ToastContainerContext.Provider>
  );
}

/**
 * Renders toasts into the page's single shared container so toasts from different components
 * stack instead of overlap.
 */
export function ToastPortal({ children }: { children: React.ReactNode }) {
  const container = useContext(ToastContainerContext);
  if (container === undefined) {
    throw new Error("ToastPortal must be rendered within a ToastPortalProvider");
  }
  // `null` until the provider's container has mounted
  return container == null ? null : createPortal(children, container);
}
