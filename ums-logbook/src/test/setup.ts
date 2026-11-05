import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Polyfill window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Polyfill window.crypto.subtle in jsdom test environment from Node's globalThis.crypto.subtle
if (typeof window !== 'undefined' && globalThis.crypto?.subtle && !window.crypto?.subtle) {
  Object.defineProperty(window.crypto, 'subtle', {
    value: globalThis.crypto.subtle,
    writable: true,
  });
}

afterEach(() => {
  cleanup();
});
