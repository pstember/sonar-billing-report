/**
 * Sonar Brand Guidelines
 * Based on official Sonar brand identity: https://www.sonarsource.com/brand-identity/
 */

export const SonarColors = {
  // Primary Colors
  blue: {
    primary: '#126ED3',      // Primary Blue
    secondary: '#0C5DB5',    // Secondary Blue (hover states)
    light: '#B7D3F2',        // Light Blue (disabled states)
  },

  // Purple
  purple: {
    primary: '#290042',      // Dark Purple (primary text, headings)
    dark: '#1a0029',         // Darker purple for hover states
  },

  // Accent Colors
  teal: '#1B998B',          // Teal accent (badges, "New" indicators)

  // Background Colors
  background: {
    light: '#EEFCFC',        // Main background
    white: '#FFFFFF',        // Card backgrounds
  },

  // Text Colors
  text: {
    primary: '#290042',      // Primary text (purple)
    secondary: '#69809B',    // Secondary text
  },
} as const;

export const SonarFonts = {
  // Font Families
  primary: 'Poppins, ui-sans-serif, system-ui, -apple-system, sans-serif',
  secondary: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',

  // Font Weights
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Font Sizes
  sizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '48px',
  },
} as const;

export const SonarSpacing = {
  // Based on Tailwind's spacing scale but aligned with Sonar's design
  borderRadius: {
    sm: '0.375rem',     // 6px
    md: '0.5rem',       // 8px
    lg: '0.75rem',      // 12px
    xl: '1rem',         // 16px
    '2xl': '1.5rem',    // 24px
  },

  borders: {
    thin: '1px',
    medium: '2px',
    thick: '4px',
  },
} as const;

export const SonarAnimations = {
  // Transition durations
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },

  // Easing functions
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// Component-specific styles
export const SonarComponents = {
  button: {
    primary: {
      background: SonarColors.blue.primary,
      hover: SonarColors.blue.secondary,
      text: '#FFFFFF',
    },
    secondary: {
      background: SonarColors.purple.primary,
      hover: SonarColors.purple.dark,
      text: '#FFFFFF',
    },
  },

  input: {
    border: '#D1D5DB',
    focusBorder: SonarColors.blue.primary,
    background: '#FFFFFF',
  },
} as const;

// Usage Examples:
// import { SonarColors, SonarFonts } from '@/styles/brand';
//
// // In Tailwind: text-sonar-blue
// // In CSS: color: ${SonarColors.blue.primary}
// // In styled-components: color: ${SonarColors.blue.primary}
