/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ash: '#0c0a09',
        stone: {
          50: '#fafaf9',
          400: '#a8a29e',
          700: '#57534e',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
        sand: '#fafaf9',
        bhagwa: '#ea580c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
