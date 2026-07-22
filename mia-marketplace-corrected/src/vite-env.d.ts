/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;

  readonly VITE_ADMIN_EMAIL: string;

  readonly VITE_ALGOLIA_APP_ID: string;
  readonly VITE_ALGOLIA_SEARCH_KEY: string;
  readonly VITE_ALGOLIA_INDEX_NAME: string;

  readonly VITE_CHARIOW_CHECKOUT_URL: string;
  readonly VITE_CHARIOW_MIN_AMOUNT: string;

  readonly VITE_APP_NAME: string;
  readonly VITE_APP_URL: string;
  readonly VITE_COMMISSION_RATE: string;
  readonly VITE_SUPPORTED_COUNTRIES: string;
  readonly VITE_SUPPORTED_LANGUAGES: string;

  readonly VITE_GOOGLE_TRANSLATE_ENABLED: string;
  readonly VITE_PWA_ENABLED: string;

  readonly VITE_FEATURE_MIA_COACH: string;
  readonly VITE_FEATURE_MOBILE_MONEY: string;
  readonly VITE_FEATURE_DELIVERY_TRACKING: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
