// ==============================================================================
// File: tailwind.config.js
// Description: Tailwind CSS Design Tokens & Theme Configuration.
// Purpose: Configures custom dark glassmorphic styling, neon accent colors,
//          subtle gradients, and interactive animations for the dashboard.
// ==============================================================================

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        warehouse: {
          dark: '#0b0f19',
          card: '#111827',
          border: '#1f2937',
          accent: '#3b82f6',
          danger: '#ef4444',
          warning: '#f59e0b',
          success: '#10b981',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
