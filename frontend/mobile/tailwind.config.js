/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Hiragino Sans', 'Yu Gothic UI', 'system-ui', 'sans-serif'],
      },
      screens: {
        'mobile': {'max': '414px'},
      },
    },
  },
  plugins: [],
}