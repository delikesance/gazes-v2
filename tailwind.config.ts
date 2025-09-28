import type { Config } from 'tailwindcss'

export default <Partial<Config>>({
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        border: 'var(--border)',
        text: 'var(--text)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        accent: {
          DEFAULT: 'var(--accent)',
          600: 'var(--accent-600)'
        }
      },
      container: {
        center: true,
        padding: '1rem'
      },
      borderRadius: {
        'xl': '12px',
      }
    }
  },
  plugins: []
})