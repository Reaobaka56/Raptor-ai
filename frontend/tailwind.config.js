export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        critical: '#dc2626',
        high: '#ea580c',
        medium: '#ca8a04',
        low: '#2563eb',
        security: '#dc2626',
        performance: '#ea580c',
        quality: '#ca8a04',
        design: '#2563eb',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'border-default': 'rgb(var(--border) / <alpha-value>)',
        primary: 'rgb(var(--text-primary) / <alpha-value>)',
        secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
        muted: 'rgb(var(--text-muted) / <alpha-value>)',
      }
    },
  },
  plugins: [],
}
