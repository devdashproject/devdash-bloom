import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Bloom — twilight meadow: deep indigo night, warm bioluminescence, vivid petals.
        petal: { pink: '#ff7eb6', gold: '#ffd166', coral: '#ff8c6b', violet: '#c08bff', sky: '#7fd1ff' },
        leaf: { 300: '#8ef5c0', 400: '#46e8a0', 500: '#22c98a', 600: '#16a974' },
        dusk: { 900: '#0b1026', 800: '#141a3a', 700: '#22264f', 600: '#3a3b6b' },
        glow: '#ffe9a8',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        bloom: '0 10px 40px rgba(192, 139, 255, 0.25)',
        firefly: '0 0 24px rgba(255, 233, 168, 0.6)',
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'breathe': 'breathe 4s ease-in-out infinite',
        'drift': 'drift 9s ease-in-out infinite',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        breathe: { '0%,100%': { opacity: '0.8', transform: 'scale(1)' }, '50%': { opacity: '1', transform: 'scale(1.04)' } },
        drift: { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-12px)' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
