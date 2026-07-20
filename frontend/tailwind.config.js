/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#020617',
          panel: '#0f172a',
          accent: '#22d3ee',
        },
      },
      borderRadius: {
        '2xl': '0.75rem',
      },
    },
  },
  plugins: [],
};