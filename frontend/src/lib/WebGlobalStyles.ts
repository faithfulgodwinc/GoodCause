import { Platform } from "react-native";

let injected = false;

export function injectWebGlobalStyles() {
  if (Platform.OS === "web" && typeof document !== "undefined" && !injected) {
    const style = document.createElement("style");
    style.textContent = `
      input, textarea, select, button, [role="button"], a {
        outline: none !important;
      }
      /* Ensure focus states don't have default borders */
      input:focus, textarea:focus {
        outline: none !important;
      }
    `;
    document.head.append(style);
    injected = true;
  }
}
