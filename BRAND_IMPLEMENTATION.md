# Sonar Brand Implementation

This document describes how the Sonar brand guidelines have been implemented in the SonarCloud Billing Report application.

## Brand Guidelines Source

Based on the official Sonar brand identity guide:
- **Official Guide**: https://www.sonarsource.com/brand-identity/
- **Zeroheight Guide**: https://zeroheight.com/718590635/p/2593ae-external-sonar-brand-guide

## Brand Colors

### Primary Colors
- **Primary Blue**: `#126ED3` - Used for primary actions, links, and active states
- **Dark Purple**: `#290042` - Used for headings, primary text, and brand presence
- **Secondary Blue**: `#0C5DB5` - Used for hover states on primary blue elements

### Accent Colors
- **Light Blue**: `#B7D3F2` - Used for disabled states and subtle backgrounds
- **Teal**: `#1B998B` - Used for badges and "New" indicators
- **Background**: `#EEFCFC` - Main page background color

### Usage in Tailwind

The colors are available as Tailwind utilities:

```jsx
// Primary Blue
<button className="bg-sonar-blue hover:bg-sonar-blue-secondary">

// Purple
<h1 className="text-sonar-purple">

// Background
<div className="bg-sonar-background">

// Light Blue
<div className="bg-sonar-blue-light">

// Teal
<span className="text-sonar-teal">
```

## Typography

### Font Families

**Primary Font: Poppins**
- Used for: Headings, buttons, navigation
- Weights: 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold)
- Loaded from: Google Fonts

**Secondary Font: Inter**
- Used for: Body text, labels, inputs, paragraphs
- Weights: 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold)
- Loaded from: Google Fonts

**Monospace Font: System Mono**
- Used for: Code snippets, technical content
- System fonts: `ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`

### Usage in Tailwind

```jsx
// Poppins (default sans)
<h1 className="font-sans">

// Inter for body text
<p className="font-body">

// Monospace
<code className="font-mono">
```

### Font Sizes

Following Sonar's typography scale:
- **Headings**: 32px-48px (text-3xl to text-4xl)
- **Body**: 16px-20px (text-base to text-xl)
- **Small**: 12px-14px (text-xs to text-sm)

## Component Styling

### Buttons

**Primary Button** (Sonar Blue):
```jsx
<button className="bg-sonar-blue hover:bg-sonar-blue-secondary text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg">
  Click Me
</button>
```

Or use the utility class:
```jsx
<button className="btn-sonar-primary px-4 py-2">
  Click Me
</button>
```

**Secondary Button** (Sonar Purple – use sparingly):
```jsx
<button className="btn-sonar-secondary px-4 py-2">
  Click Me
</button>
```

**Outline Button** (Blue border + text – Cancel, Clear, neutral/completed actions):
```jsx
<button className="btn-sonar-outline px-4 py-2 rounded-lg">
  Cancel
</button>
```

**Danger Button** (Destructive: Logout, Delete, Remove – semantic red):
```jsx
<button className="btn-sonar-danger px-4 py-2 rounded-lg">
  Logout
</button>
```

**Selection Buttons** (Context-dependent styling for selection state):
```jsx
{/* Unselected: Green outline (call to action) */}
<button className="px-3 py-1.5 text-xs font-medium rounded-lg border-2 border-green-600 text-green-600 hover:bg-green-50">
  + Select
</button>

{/* Selected: Gray outline (de-emphasized/completed) */}
<button className="px-3 py-1.5 text-xs font-medium rounded-lg border-2 border-gray-300 text-gray-600 bg-gray-50">
  ✓ Selected
</button>
```

**Summary – which button to use**
| Role | Class | Example |
|------|--------|--------|
| Primary CTA (All actions: Save, Export, Add, Open) | `btn-sonar-primary` | Export to CSV, Save, Add Cost Center, Open, Continue to Dashboard |
| Neutral/Cancel (Cancel, Clear) | `btn-sonar-outline` | Cancel, Clear |
| Selection Available (Add to selection) | Green outline + text | + Select (in Enterprise Overview) |
| Selection Active (Remove from selection) | Gray outline + background | ✓ Selected (de-emphasized) |
| Destructive (Logout, Delete, Remove) | `btn-sonar-danger` | Logout, Delete, Remove |
| Text links (Edit) | `text-sonar-blue hover:text-sonar-blue-secondary` | Edit cost center |

**Note on button consistency:** As of March 2026, all action buttons use `btn-sonar-primary` (blue) for consistency. The previous `btn-sonar-accent` (teal) is no longer used. Selection state buttons use semantic green (available) and gray (selected) for intuitive status indication.

### Inputs

**Branded Input:**
```jsx
<input className="input-sonar w-full px-4 py-3" />
```

Full example:
```jsx
<input
  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-sonar-blue focus:border-sonar-blue font-body transition-all"
  type="text"
/>
```

### Cards

**Branded Card:**
```jsx
<div className="card-sonar p-6">
  <h2 className="text-2xl font-bold text-sonar-purple mb-4">Title</h2>
  <p className="text-gray-600 font-body">Content</p>
</div>
```

## Design Principles

### Transitions

All interactive elements use smooth transitions:
- **Duration**: 200ms (normal), 150ms (fast), 300ms (slow)
- **Easing**: cubic-bezier(0.4, 0, 0.2, 1)

Example:
```jsx
<button className="transition-all duration-200">
```

### Borders

- **Thin**: 1px - Subtle dividers
- **Medium**: 2px - Input fields, focus states
- **Thick**: 4px - Accent borders on cards

Example:
```jsx
<div className="border-t-4 border-sonar-blue">
```

### Border Radius

- **Small**: 0.375rem (6px)
- **Medium**: 0.5rem (8px)
- **Large**: 0.75rem (12px)
- **XL**: 1rem (16px)
- **2XL**: 1.5rem (24px)

Example:
```jsx
<button className="rounded-lg"> // 0.5rem
```

### Shadows

Using Tailwind's shadow utilities enhanced with hover states:
```jsx
<div className="shadow-md hover:shadow-lg">
```

## Files Modified

### Configuration Files

1. **`tailwind.config.js`**
   - Added Sonar brand colors to theme
   - Configured Poppins and Inter fonts
   - Extended color palette with `sonar.*` utilities

2. **`index.html`**
   - Added Google Fonts preconnect
   - Loaded Poppins and Inter fonts
   - Updated page title

3. **`src/index.css`**
   - Applied base font families
   - Created reusable component classes
   - Set up typography hierarchy

### Component Files

1. **`src/App.tsx`**
   - Updated loading screen colors
   - Applied Sonar brand background
   - Updated spinner color to Sonar blue

2. **`src/components/Auth/TokenInput.tsx`**
   - Applied Sonar colors throughout
   - Updated button styles
   - Enhanced input focus states
   - Added border accent to card

3. **`src/components/Billing/BillingDashboard.tsx`**
   - Updated header with Sonar purple
   - Applied Sonar blue to active tabs
   - Enhanced button styles
   - Updated card styling

### Brand Assets

1. **`src/styles/brand.ts`**
   - Centralized brand constants
   - Color definitions
   - Typography specifications
   - Component styling presets
   - Animation timings

## Tailwind Configuration

```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      sonar: {
        blue: {
          DEFAULT: '#126ED3',
          light: '#B7D3F2',
          secondary: '#0C5DB5',
        },
        purple: {
          DEFAULT: '#290042',
          dark: '#1a0029',
        },
        teal: '#1B998B',
        background: '#EEFCFC',
      },
    },
    fontFamily: {
      sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      body: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
    },
  },
}
```

## Usage Examples

### Login Page

```jsx
<div className="bg-gradient-to-br from-sonar-background to-sonar-blue-light">
  <div className="card-sonar">
    <h1 className="text-sonar-purple">SonarCloud Billing</h1>
    <input className="input-sonar" />
    <button className="btn-sonar-primary">Connect</button>
  </div>
</div>
```

### Dashboard Header

```jsx
<header className="bg-white shadow-md border-b-2 border-sonar-blue/10">
  <h1 className="text-sonar-purple">Dashboard</h1>
  <button className="bg-sonar-blue hover:bg-sonar-blue-secondary">
    Action
  </button>
</header>
```

### Navigation Tabs

```jsx
<nav>
  <button className={`
    border-b-2 font-semibold font-body transition-all
    ${active
      ? 'border-sonar-blue text-sonar-blue'
      : 'border-transparent text-gray-500 hover:text-sonar-purple hover:border-sonar-blue-light'
    }
  `}>
    Tab Name
  </button>
</nav>
```

## Accessibility

All color combinations meet WCAG 2.1 AA contrast requirements:
- ✅ Sonar Blue (#126ED3) on White - 4.6:1
- ✅ Sonar Purple (#290042) on White - 14.2:1
- ✅ White text on Sonar Blue - 4.6:1
- ✅ White text on Sonar Purple - 14.2:1

## Validating that brand colors are loaded

If buttons or text using brand colors appear unstyled (e.g. no background or wrong color), the CSS variables may not be resolving. Use these checks:

### 1. Inspect `:root` in DevTools

1. Open the app in the browser and open DevTools (F12 or right‑click → Inspect).
2. Go to the **Elements** (or **Inspector**) tab.
3. Select the `<html>` element (or `:root` in the styles panel).
4. In the **Styles** panel, look for a rule that sets variables on `:root`. You should see:
   - `--color-sonar-blue: #126ED3`
   - `--color-sonar-purple: #290042`
   - `--color-sonar-purple-dark: #1a0029`
   - (and other `--color-sonar-*` variables).

If these are missing, the main `index.css` (and its `:root` block in `@layer base`) may not be loading or may be overridden.

### 2. Check a brand button’s computed style

1. Right‑click the **Add cost center** button (or any `btn-sonar-secondary` / `btn-sonar-primary` button) → Inspect.
2. In **Styles**, find the `.btn-sonar-secondary` (or `.btn-sonar-primary`) rule and confirm:
   - `background-color: var(--color-sonar-purple)` (or `var(--color-sonar-blue)` for primary).
3. In the **Computed** tab, find `background-color`. Its final value should be the actual color (e.g. `rgb(41, 0, 66)` for purple), not “invalid” or empty.

If `background-color` is empty or not the expected color, `var(--color-sonar-purple)` is not resolving — ensure `index.css` is imported (e.g. in `main.tsx`) and that the `:root` block in `src/index.css` defines `--color-sonar-purple` and related variables.

### 3. Quick console check

In the browser console, run:

```js
getComputedStyle(document.documentElement).getPropertyValue('--color-sonar-purple')
```

Expected: `" #290042"` (with a leading space) or `"#290042"`. If the result is an empty string, the variable is not set on `:root`.

## Shared Components

### LOCTooltip
Reusable tooltip component that explains "LOC = Lines of Code" with a hover tooltip.

**Location:** `src/components/Shared/LOCTooltip.tsx`

**Usage:**
```jsx
import { LOCTooltip } from '../Shared/LOCTooltip';

<div className="flex items-center gap-1">
  <LOCTooltip />
</div>
```

Displays "LOC" with a "?" icon. Hovering shows: "LOC = Lines of Code - Non-comment, non-blank lines in your private projects"

### HelpIcon
Contextual help icon with hover tooltip for inline help text.

**Location:** `src/components/Shared/HelpIcon.tsx`

**Usage:**
```jsx
import { HelpIcon } from '../Shared/HelpIcon';

<div className="flex items-center gap-1">
  <span>Reserved</span>
  <HelpIcon content="In reserved mode, each organisation has its own separate LOC limit." />
</div>
```

Displays a small "?" button with custom tooltip content on hover.

### Toast
Toast notification component for user feedback (prepared for future use).

**Location:** `src/components/Shared/Toast.tsx`

**Usage:**
```jsx
import { Toast } from '../Shared/Toast';

<Toast
  message="Cost center created successfully!"
  variant="success"
  onClose={() => setShowToast(false)}
/>
```

Variants: `success`, `info`, `warning`, `error`

### useKeyboardShortcuts
React hook for keyboard shortcut handling (prepared for future use).

**Location:** `src/hooks/useKeyboardShortcuts.ts`

**Usage:**
```jsx
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

useKeyboardShortcuts([
  { key: '1', ctrlOrCmd: true, action: () => applyViewMode('single') },
  { key: '2', ctrlOrCmd: true, action: () => applyViewMode('multi') },
  { key: '3', ctrlOrCmd: true, action: () => applyViewMode('all') },
]);
```

Supports Cmd (Mac) / Ctrl (Windows/Linux) modifier keys.

## Future Improvements

- [x] Implement branded tooltips (LOCTooltip, HelpIcon)
- [x] Button consistency (all actions use btn-sonar-primary)
- [ ] Add Sonar logo to header
- [ ] Implement dark mode with Sonar brand colors
- [ ] Add more chart color variants from brand palette
- [ ] Create branded loading states
- [ ] Add branded error/success states
- [ ] Keyboard shortcuts (hook prepared, implementation pending)

## Resources

- [Sonar Brand Identity](https://www.sonarsource.com/brand-identity/)
- [Sonar Brand Guide (Zeroheight)](https://zeroheight.com/718590635/p/2593ae-external-sonar-brand-guide)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Google Fonts - Poppins](https://fonts.google.com/specimen/Poppins)
- [Google Fonts - Inter](https://fonts.google.com/specimen/Inter)

## Support

For brand guidelines questions, refer to the official Sonar brand documentation or contact the Sonar brand team.
