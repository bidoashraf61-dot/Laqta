import type { Config } from 'tailwindcss'

/**
 * Laqta design system.
 *
 * Tokens are declared as CSS custom properties in styles/globals.css and
 * referenced here, so a theme switch is a class swap rather than a rebuild.
 *
 * RTL: never author `left`/`right` utilities. Tailwind's logical utilities
 * (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`,
 * `text-end`, `border-s`, `border-e`, `rounded-s-*`, `rounded-e-*`) compile to
 * logical CSS properties and flip automatically with `dir`.
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './messages/**/*.json',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        // Brand palette lifted from the hero cinematic.
        gold: {
          DEFAULT: 'hsl(var(--gold))',
          foreground: 'hsl(var(--gold-foreground))',
          50: 'hsl(var(--gold-50))',
          100: 'hsl(var(--gold-100))',
          200: 'hsl(var(--gold-200))',
          400: 'hsl(var(--gold-400))',
          600: 'hsl(var(--gold-600))',
          800: 'hsl(var(--gold-800))',
        },
        ink: 'hsl(var(--ink))',
        'off-white': 'hsl(var(--off-white))',
        'ground-quiet': 'hsl(var(--ground-quiet))',
        'dusty-olive': 'hsl(var(--dusty-olive))',
        olive: 'hsl(var(--olive))',
        'olive-deep': 'hsl(var(--olive-deep))',
        'olive-line': 'hsl(var(--olive-line))',
        chrome: 'hsl(var(--chrome))',
        sand: 'hsl(var(--sand))',
        clay: 'hsl(var(--clay))',
        'clay-fill': 'hsl(var(--clay-fill))',
        oasis: 'hsl(var(--oasis))',
        paper: 'hsl(var(--paper))',

        // Semantic tokens — shadcn contract.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          // The hover fill, as a token rather than an alpha discount. See the
          // note beside `--primary-hover` in globals.css.
          hover: 'hsl(var(--primary-hover))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          hover: 'hsl(var(--secondary-hover))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          hover: 'hsl(var(--destructive-hover))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      /**
       * The design system tints at 8/12/15% — a gold fill that reads as a
       * state, not a colour. Those steps are not in Tailwind's default opacity
       * scale, and an out-of-scale modifier is silently DROPPED rather than
       * erroring, so `bg-gold/12` produced no rule at all until they were
       * declared here. 85 is the backdrop-blur ground on the sticky headers.
       */
      opacity: {
        8: '0.08',
        12: '0.12',
        15: '0.15',
        85: '0.85',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        subhead: ['var(--font-subhead)', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        // The reference sets display type with open letter-spacing; these are
        // the two steps the headline scale uses.
        headline: '0.015em',
        display: '0.03em',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        // Display type is now Sans and set OPEN, per the reference. Tracking is
        // slightly positive rather than the tight negative fit a serif needed.
        display: ['clamp(2.5rem, 5.4vw, 4.5rem)', { lineHeight: '1.06', letterSpacing: '0.005em' }],
        headline: [
          'clamp(1.6rem, 2.8vw, 2.375rem)',
          { lineHeight: '1.18', letterSpacing: '0.01em' },
        ],
        // The sub-headline step. Named rather than written as a literal at the
        // call site so it is one documented rung on the ramp, not a magic number
        // that drifts the next time someone nudges a section.
        subhead: ['clamp(1.5rem, 2.2vw, 1.75rem)', { lineHeight: '1.35' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        soft: '0 1px 2px hsl(var(--ink) / 0.06), 0 8px 24px -12px hsl(var(--ink) / 0.25)',
        lift: '0 2px 4px hsl(var(--ink) / 0.08), 0 20px 40px -16px hsl(var(--ink) / 0.4)',
        glow: '0 0 0 1px hsl(var(--gold) / 0.35), 0 12px 32px -12px hsl(var(--gold) / 0.45)',
      },
      /*
       * Motion. The curves and durations are CSS variables (styles/globals.css)
       * so the same vocabulary is available to hand-written CSS, to Radix data
       * attributes, and to a Tailwind class — one source, three consumers.
       *
       * Authoring rule: never write a bare `duration-300` or `ease-in-out`.
       * If a transition needs a timing, it needs one of these names; if none
       * fits, the system is missing a rung and DESIGN.md gets a new one.
       */
      transitionTimingFunction: {
        cut: 'var(--ease-cut)',
        lens: 'var(--ease-lens)',
        exit: 'var(--ease-exit)',
      },
      transitionDuration: {
        tap: 'var(--dur-tap)',
        hover: 'var(--dur-hover)',
        move: 'var(--dur-move)',
        panel: 'var(--dur-panel)',
        frame: 'var(--dur-frame)',
        exit: 'var(--dur-exit)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        /* The single entrance gesture. Everything that arrives uses this —
           a card, a section, a table row — so the page has one accent rather
           than a different flourish per component. */
        rise: {
          from: { opacity: '0', transform: 'translate3d(0, var(--rise), 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        /* Dialogs and sheets scale a hair as well as fade, because they are
           surfaces arriving in depth rather than content arriving in place. */
        'panel-in': {
          from: { opacity: '0', transform: 'translate3d(0, 8px, 0) scale(0.985)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0) scale(1)' },
        },
        'panel-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.985)' },
        },
        /* Route-change feedback. Indeterminate on purpose: the App Router
           cannot report real progress, and a fake percentage is a lie. */
        'route-sweep': {
          '0%': { transform: 'translate3d(-100%, 0, 0)' },
          '100%': { transform: 'translate3d(400%, 0, 0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down var(--dur-move) var(--ease-cut)',
        'accordion-up': 'accordion-up var(--dur-exit) var(--ease-exit)',
        rise: 'rise var(--dur-move) var(--ease-cut) both',
        'panel-in': 'panel-in var(--dur-panel) var(--ease-cut) both',
        'panel-out': 'panel-out var(--dur-exit) var(--ease-exit) both',
        'route-sweep': 'route-sweep 1.1s var(--ease-lens) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
