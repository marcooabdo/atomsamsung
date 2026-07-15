/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'pulse-subtle': 'pulse-subtle 2.5s ease-in-out infinite',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(239,68,68,0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(239,68,68,0.35)' },
        },
      },
    },
  },
  plugins: [],
};
