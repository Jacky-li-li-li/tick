/// <reference types="vite/client" />

import type { TickApi } from "../preload/index";

declare global {
  interface Window {
    tick: TickApi;
  }
}

export {};
