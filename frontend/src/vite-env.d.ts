/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override the API base path (defaults to the dev-server proxy at /api). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
