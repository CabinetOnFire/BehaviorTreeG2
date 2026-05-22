import { useEffect, useCallback } from "react";
import type { ExtMsg, WebMsg } from "../../../shared/messaging";

// VS Code webview API (injected at runtime)
declare const acquireVsCodeApi: () => {
  postMessage: (msg: WebMsg) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

// Singleton vscode API handle
let _vscode: ReturnType<typeof acquireVsCodeApi> | null = null;
function getVscode() {
  if (!_vscode) {
    _vscode = acquireVsCodeApi();
  }
  return _vscode;
}

/**
 * Subscribe to messages from the extension host.
 * Returns a `postMessage` function to send messages back.
 */
export function useVsCodeMessage(onMessage: (msg: ExtMsg) => void) {
  const postMessage = useCallback((msg: WebMsg) => {
    getVscode().postMessage(msg);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      onMessage(event.data as ExtMsg);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMessage]);

  return { postMessage };
}
