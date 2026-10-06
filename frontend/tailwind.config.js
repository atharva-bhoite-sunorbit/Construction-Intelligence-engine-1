/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#36aaf6',
          500: '#0c8ee6',
          600: '#0171c4',
          700: '#025a9e',
          800: '#064d82',
          900: '#0b416d',
          950: '#072a49',
        },
        construction: {
          amber: '#f59e0b',
          orange: '#ea580c',
          steel: '#475569',
          concrete: '#64748b',
          safety: '#eab308'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
