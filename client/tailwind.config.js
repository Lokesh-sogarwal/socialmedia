/** Colors resolve to CSS variables in src/styles/tokens.css so the palette is changed in one place. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: v('color-background'),
        surface: v('color-surface'),
        blush: v('color-soft-pink'),
        rose: { DEFAULT: v('color-rose'), deep: v('color-rose-deep') },
        charcoal: v('color-charcoal'),
        muted: v('color-muted'),
        line: v('color-border'),
        danger: v('color-danger'),
      },
      fontFamily: { sans: ['var(--font-sans)'] },
      borderRadius: { card: 'var(--radius-card)', control: 'var(--radius-control)' },
      boxShadow: { card: 'var(--shadow-card)', pop: 'var(--shadow-pop)' },
      transitionDuration: { DEFAULT: 'var(--transition-fast)' },
      maxWidth: { feed: 'var(--width-feed)' },
      width: { sidebar: 'var(--width-sidebar)', rail: 'var(--width-rail)' },
      screens: { xs: '420px' },
    },
  },
  plugins: [],
};
