/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  readonly VITE_CHARIOW_CHECKOUT_URL: string;
  readonly VITE_CHARIOW_MIN_AMOUNT: string;

  readonly VITE_APP_NAME: string;
  readonly VITE_APP_URL: string;
  readonly VITE_COMMISSION_RATE: string;
  readonly VITE_SUPPORTED_COUNTRIES: string;
  readonly VITE_SUPPORTED_LANGUAGES: string;

  readonly VITE_PWA_ENABLED: string;

  readonly VITE_FEATURE_MIA_COACH: string;
  readonly VITE_FEATURE_MOBILE_MONEY: string;
  readonly VITE_FEATURE_DELIVERY_TRACKING: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
