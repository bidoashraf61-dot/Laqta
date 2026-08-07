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
        'dusty-olive': 'hsl(var(--dusty-olive))',
        olive: 'hsl(var(--olive))',
        'olive-deep': 'hsl(var(--olive-deep))',
        'olive-line': 'hsl(var(--olive-line))',
        chrome: 'hsl(var(--chrome))',
        sand: 'hsl(var(--sand))',
        clay: 'hsl(var(--clay))',
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
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
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
        headline: ['clamp(1.6rem, 2.8vw, 2.375rem)', { lineHeight: '1.18', letterSpacing: '0.01em' }],
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
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
