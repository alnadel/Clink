/** Injected by vite.config.ts `define`. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Build-time address of the analytics collector; unset means production sends nothing. */
  readonly VITE_ANALYTICS_URL?: string;
}
