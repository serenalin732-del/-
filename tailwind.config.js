/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#fdfaf6',
        blush: '#f5d0c5',
        rose: '#e8a598',
        sage: '#a8b89e',
        ink: '#2d2a26',
        mist: '#efe8df'
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Inter"', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif SC"', '"Cormorant Garamond"', 'serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'sparkle': 'sparkle 1.2s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        sparkle: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' }
        }
      }
    }
  },
  plugins: []
}
