/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        song: ['"Songti SC"', '"SimSun"', '"STSong"', 'serif'],
      },
      width: { mobile: '375px' },
      animation: {
        'fade-out': 'fadeOut 1.5s ease-out forwards',
        'heart-bounce': 'heartBounce 0.3s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-glow': 'pulseGlow 0.8s ease-in-out infinite',
      },
      keyframes: {
        fadeOut: {
          '0%': { opacity: '1' },
          '80%': { opacity: '0.3' },
          '100%': { opacity: '0' },
        },
        heartBounce: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.4)' },
          '100%': { transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(40px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(255,45,85,0.4)' },
          '50%': { boxShadow: '0 0 20px rgba(255,45,85,0.8)' },
        },
      },
    },
  },
  plugins: [],
};
