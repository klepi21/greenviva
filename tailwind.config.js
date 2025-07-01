/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#10B981', // Emerald-500 for our green theme
        secondary: '#064E3B', // Emerald-900
        background: '#F9FAFB', // Gray-50
      },
    },
  },
  plugins: [],
} 