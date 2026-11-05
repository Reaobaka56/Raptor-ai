// `white`, `black` and the `gray` scale are driven by CSS variables (defined in
// src/index.css) so the in-app shell can switch to a light theme without
// touching every page. In dark mode the variables equal Tailwind's defaults,
// so dark output is unchanged.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        white: v('--c-white'),
        black: v('--c-black'),
        gray: {
          50: v('--c-gray-50'),
          100: v('--c-gray-100'),
          200: v('--c-gray-200'),
          300: v('--c-gray-300'),
          400: v('--c-gray-400'),
          500: v('--c-gray-500'),
          600: v('--c-gray-600'),
          700: v('--c-gray-700'),
          800: v('--c-gray-800'),
          900: v('--c-gray-900'),
          950: v('--c-gray-950'),
        },
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
