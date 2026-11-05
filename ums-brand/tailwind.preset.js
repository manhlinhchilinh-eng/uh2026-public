/**
 * UMS+ Ecosystem — Shared Tailwind CSS Preset
 * Dùng chung cho ums-logbook, umseng9practice, umseng9grading, umseng9hub, umshomeroom9.
 *
 * Cách dùng trong tailwind.config.js:
 *   import umsPreset from '../ums-brand/tailwind.preset.js';
 *   export default { presets: [umsPreset], ... }
 */

/** @type {import('tailwindcss').Config} */
const umsTailwindPreset = {
  theme: {
    extend: {
      colors: {
        ums: {
          50: '#FDF2F6',
          100: '#FCE7F0',
          200: '#FACFE2',
          300: '#F6A5C8',
          400: '#EE6FA4',
          500: '#DF3B7E',
          600: '#B91C5C',
          700: '#8B1A4A', // Primary Brand Crimson
          800: '#74173F',
          900: '#611736', // Deep Crimson
          950: '#3C081E',
          DEFAULT: '#8B1A4A',
          amber: '#F59E0B', // Accent Amber
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
        subtle: '0 2px 8px 0 rgba(139, 26, 74, 0.06)',
      },
    },
  },
};

export default umsTailwindPreset;
