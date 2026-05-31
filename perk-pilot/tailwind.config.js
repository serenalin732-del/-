/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // A calm "fintech at night" palette: deep slate + teal accent + gold for value
        ink: '#0b1120',
        slate: '#1e293b',
        steel: '#334155',
        mist: '#e2e8f0',
        teal: '#0f766e',
        tealLight: '#5eead4',
        gold: '#f4c430',
        rose: '#fb7185',
        good: '#34d399'
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans SC"', 'system-ui', 'sans-serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
}
