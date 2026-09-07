/** @type {import('tailwindcss').Config} */

// Deep Navy Blue (#083459) shade ramp — replaces every blue used across the app
const navy = {
  50: '#ecf6fd',
  100: '#d5eafb',
  200: '#a2d0f6',
  300: '#60aff0',
  400: '#168ae9',
  500: '#0f5e9f',
  600: '#083459',
  700: '#072946',
  800: '#052138',
  900: '#04192a',
  950: '#020e17',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: navy,
        sky: navy,
        blue: navy,
      },
      spacing: {
        '1': '0.2rem',
        '2': '0.4rem',
        '3': '0.6rem',
        '4': '0.8rem',
        '5': '1rem',
        '6': '1.2rem',
        '8': '1.6rem',
        '10': '2rem',
        '12': '2.4rem',
        '16': '3.2rem',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],     // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }], // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],    // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }], // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],  // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],     // 24px
      }
    },
  },
  plugins: [],
};