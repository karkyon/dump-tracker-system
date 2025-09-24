/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_APP_ENV: string
  readonly VITE_DEBUG: string
  readonly VITE_GPS_UPDATE_INTERVAL: string
  readonly VITE_OFFLINE_DATA_RETENTION: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly NODE_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}