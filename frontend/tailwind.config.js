/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#14181c',
        surface: '#191e25',
        'surface-alt': '#2c3440',
        accent: '#00e054',
        'accent-purple': '#a855f7',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        display: ['Pacifico', 'cursive'],
      },
      blur: {
        '3xl': '64px',
      },
    },
  },
  plugins: [],
}
