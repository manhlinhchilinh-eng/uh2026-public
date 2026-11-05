import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, initializeFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { resolveFirebaseConfig, useEmulator } from './firebaseEnv';

const env = import.meta.env as unknown as Record<string, string | boolean | undefined>;
const firebaseConfig = resolveFirebaseConfig(env);

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
// ignoreUndefinedProperties: trường để trống (undefined) bị bỏ qua thay vì làm hỏng cả lần lưu
// (vd. ô "Tiết PPCT" trống từng khiến lưu tiết báo lỗi "Unsupported field value: undefined").
function createDb(): Firestore {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app); // đã khởi tạo trước đó (HMR)
  }
}
export const db = createDb();

// CHỈ bản dev: cho script E2E (tools/e2e) đăng nhập bằng custom token do Admin SDK của project dev cấp.
// import.meta.env.DEV là hằng số lúc build → bị loại khỏi bản production.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __umsDevSignIn?: (token: string) => Promise<unknown> }).__umsDevSignIn = (token: string) =>
    import('firebase/auth').then(({ signInWithCustomToken }) => signInWithCustomToken(auth, token));
}

if (useEmulator(env)) {
  // Cổng mặc định 9099/8080; đổi qua VITE_EMULATOR_AUTH_PORT / VITE_EMULATOR_FIRESTORE_PORT khi nhiều worktree chạy emulator cùng lúc
  const authPort = Number(env.VITE_EMULATOR_AUTH_PORT) || 9099;
  const fsPort = Number(env.VITE_EMULATOR_FIRESTORE_PORT) || 8080;
  connectAuthEmulator(auth, `http://127.0.0.1:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', fsPort);
}
