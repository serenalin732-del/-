/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Inter"', 'system-ui', 'sans-serif']
      },
      colors: {
        fc: {
          black: '#1f2937',
          yellow: '#fde68a',
          'yellow-edge': '#eab308',
          blue: '#bfdbfe',
          'blue-edge': '#3b82f6',
          red: '#fecaca',
          'red-edge': '#ef4444',
          white: '#ffffff',
          'white-edge': '#d1d5db'
        }
      }
    }
  },
  plugins: []
}
