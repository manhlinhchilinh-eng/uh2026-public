import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Danh sách lớp/HS THẬT (data/class_data.json, ngoài git) chỉ dùng cho dữ liệu mẫu ở dev/test/offline demo.
      // Bản build (production) thay bằng file rỗng để họ tên + mã HS không lọt vào JS công khai (lộ trên LIVE tới 23/10/2026).
      ...(command === 'build'
        ? [{ find: /^.*\/data\/class_data\.json$/, replacement: path.resolve(__dirname, './src/data/class_data.build.json') }]
        : []),
    ],
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: true,
  },
}));
