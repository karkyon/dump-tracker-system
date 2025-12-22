// frontend/cms/src/types/google-maps.d.ts
// Google Maps JavaScript API の型定義

/// <reference types="google.maps" />

declare global {
  interface Window {
    google: typeof google;
  }
}

export {};