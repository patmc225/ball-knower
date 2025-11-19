/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0f172a',   // Slate 900 - Main background
        'card-bg': '#1e293b',   // Slate 800 - Card background
        'input-bg': '#334155',  // Slate 700 - Input background
        'brand-blue': '#3b82f6', // Blue 500 - Primary action
        'brand-pink': '#ec4899', // Pink 500 - Secondary action / Highlight
        'neon-green': '#10b981', // Emerald 500 - Success / Timer
        'neon-red': '#ef4444',   // Red 500 - Error / Danger
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Teko', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-short': 'bounce 1s infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      boxShadow: {
        'neon-blue': '0 0 5px #3b82f6, 0 0 20px rgba(59, 130, 246, 0.5)',
        'neon-pink': '0 0 5px #ec4899, 0 0 20px rgba(236, 72, 153, 0.5)',
      }
    },
  },
  plugins: [],
}
