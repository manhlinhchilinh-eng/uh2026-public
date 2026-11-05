/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
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
          700: '#8B1A4A', // PRIMARY BRAND COLOR (WCAG AAA contrast on white: 8.5:1)
          800: '#74173F',
          900: '#611736',
          950: '#3C081E',
          DEFAULT: '#8B1A4A',
        },
        attendance: {
          present: {
            bg: '#F0FDF4',
            text: '#15803D',
            border: '#BBF7D0',
          },
          excused: { // P - Vắng có phép
            bg: '#ECFDF5',
            text: '#047857',
            border: '#A7F3D0',
          },
          unexcused: { // K - Vắng không phép
            bg: '#FEF2F2',
            text: '#B91C1C',
            border: '#FECACA',
          },
          late: { // Muộn
            bg: '#FFFBEB',
            text: '#B45309',
            border: '#FDE68A',
          },
          early: { // Về sớm
            bg: '#EFF6FF',
            text: '#1D4ED8',
            border: '#BFDBFE',
          }
        },
        behavior: {
          positive: {
            bg: '#F0FDF4',
            text: '#166534',
            badge: '#22C55E',
          },
          negative: {
            bg: '#FEF2F2',
            text: '#991B1B',
            badge: '#EF4444',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
        subtle: '0 2px 8px 0 rgba(139, 26, 74, 0.06)',
      }
    },
  },
  plugins: [],
}
