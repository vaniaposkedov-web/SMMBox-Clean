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
        admin: {
          bg: '#121212',
          card: '#1e1e1e',
          text: '#ffffff',
          accent: '#3b82f6'
        }
      }
    },
  },
  plugins: [],
}