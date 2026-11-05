// Chọn cấu hình Firebase theo môi trường.
// - Bản build production (MODE=production): mặc định trỏ vào project thật `sodaubai`.
// - `npm run dev` (MODE=development): BẮT BUỘC có VITE_FIREBASE_* trong `.env.development.local`
//   (project `sodaubai-dev`) hoặc bật emulator. Không bao giờ tự rơi về `sodaubai`
//   trừ khi đặt VITE_ALLOW_PROD_IN_DEV=true.

export const PROD_PROJECT_ID = 'sodaubai';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export type FirebaseEnv = Record<string, string | boolean | undefined>;

const PROD_CONFIG: FirebaseWebConfig = {
  apiKey: 'AIzaSyCRxZCOp3cY9J_9vBsX2ETuqo5gIofldaw',
  authDomain: 'sodaubai.firebaseapp.com',
  projectId: PROD_PROJECT_ID,
  storageBucket: 'sodaubai.firebasestorage.app',
  messagingSenderId: '45833159572',
  appId: '1:45833159572:web:c74e4233bbaef94da0c581',
};

const str = (v: string | boolean | undefined): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;

export function useEmulator(env: FirebaseEnv): boolean {
  return str(env.VITE_USE_FIREBASE_EMULATOR) === 'true';
}

export function resolveFirebaseConfig(env: FirebaseEnv): FirebaseWebConfig {
  const fromEnv = (key: string, fallback: string) => str(env[key]) ?? fallback;
  const isDevServer = env.MODE === 'development';
  const emulator = useEmulator(env);

  if (isDevServer && !emulator && !str(env.VITE_FIREBASE_PROJECT_ID)) {
    throw new Error(
      '[firebase] npm run dev cần cấu hình project dev: tạo ums-logbook/.env.development.local ' +
        '(xem .env.example) hoặc đặt VITE_USE_FIREBASE_EMULATOR=true. Không tự kết nối project thật "sodaubai".'
    );
  }

  const config: FirebaseWebConfig = {
    apiKey: fromEnv('VITE_FIREBASE_API_KEY', emulator ? 'demo-api-key' : PROD_CONFIG.apiKey),
    authDomain: fromEnv('VITE_FIREBASE_AUTH_DOMAIN', PROD_CONFIG.authDomain),
    projectId: fromEnv('VITE_FIREBASE_PROJECT_ID', emulator ? 'demo-sodaubai' : PROD_CONFIG.projectId),
    storageBucket: fromEnv('VITE_FIREBASE_STORAGE_BUCKET', PROD_CONFIG.storageBucket),
    messagingSenderId: fromEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', PROD_CONFIG.messagingSenderId),
    appId: fromEnv('VITE_FIREBASE_APP_ID', PROD_CONFIG.appId),
  };

  if (isDevServer && config.projectId === PROD_PROJECT_ID && str(env.VITE_ALLOW_PROD_IN_DEV) !== 'true') {
    throw new Error(
      '[firebase] npm run dev đang trỏ vào project thật "sodaubai". Đổi VITE_FIREBASE_PROJECT_ID sang "sodaubai-dev" ' +
        'hoặc đặt VITE_ALLOW_PROD_IN_DEV=true nếu thật sự cần.'
    );
  }

  return config;
}
