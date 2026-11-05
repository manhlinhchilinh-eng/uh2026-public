import { describe, it, expect } from 'vitest';
import { resolveFirebaseConfig, PROD_PROJECT_ID } from '../config/firebaseEnv';

const devEnv = {
  VITE_FIREBASE_API_KEY: 'dev-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'sodaubai-dev.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'sodaubai-dev',
  VITE_FIREBASE_STORAGE_BUCKET: 'sodaubai-dev.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1',
  VITE_FIREBASE_APP_ID: '1:1:web:dev',
};

describe('resolveFirebaseConfig', () => {
  it('production build mặc định trỏ vào project thật', () => {
    expect(resolveFirebaseConfig({ MODE: 'production' }).projectId).toBe(PROD_PROJECT_ID);
  });

  it('dev server không có cấu hình thì báo lỗi, không rơi về sodaubai', () => {
    expect(() => resolveFirebaseConfig({ MODE: 'development' })).toThrow(/project dev/);
  });

  it('dev server dùng cấu hình sodaubai-dev từ env', () => {
    const cfg = resolveFirebaseConfig({ MODE: 'development', ...devEnv });
    expect(cfg.projectId).toBe('sodaubai-dev');
    expect(cfg.authDomain).toBe('sodaubai-dev.firebaseapp.com');
  });

  it('dev server trỏ vào sodaubai bị chặn trừ khi cho phép rõ ràng', () => {
    const env = { MODE: 'development', ...devEnv, VITE_FIREBASE_PROJECT_ID: 'sodaubai' };
    expect(() => resolveFirebaseConfig(env)).toThrow(/project thật/);
    expect(resolveFirebaseConfig({ ...env, VITE_ALLOW_PROD_IN_DEV: 'true' }).projectId).toBe('sodaubai');
  });

  it('emulator không cần cấu hình và không dùng project thật', () => {
    const cfg = resolveFirebaseConfig({ MODE: 'development', VITE_USE_FIREBASE_EMULATOR: 'true' });
    expect(cfg.projectId).toBe('demo-sodaubai');
  });

  it('bỏ qua giá trị env rỗng', () => {
    expect(() => resolveFirebaseConfig({ MODE: 'development', VITE_FIREBASE_PROJECT_ID: '  ' })).toThrow();
  });
});
