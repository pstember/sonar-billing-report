# Sonar Brand Colors - Quick Reference

Visual reference for Sonar brand colors used in the application.

## Primary Colors

### Sonar Blue
```
█████████████████████████
█████████████████████████  #126ED3
█████████████████████████  RGB(18, 110, 211)
█████████████████████████
█████████████████████████  Primary Blue
                           Buttons, links, active states
```

### Sonar Purple
```
█████████████████████████
█████████████████████████  #290042
█████████████████████████  RGB(41, 0, 66)
█████████████████████████
█████████████████████████  Dark Purple
                           Headings, primary text
```

## Secondary Colors

### Secondary Blue
```
█████████████████████████
█████████████████████████  #0C5DB5
█████████████████████████  RGB(12, 93, 181)
█████████████████████████
█████████████████████████  Secondary Blue
                           Hover states for primary blue
```

### Light Blue
```
█████████████████████████
█████████████████████████  #B7D3F2
█████████████████████████  RGB(183, 211, 242)
█████████████████████████
█████████████████████████  Light Blue
                           Disabled states, subtle backgrounds
```

### Purple Dark
```
█████████████████████████
█████████████████████████  #1A0029
█████████████████████████  RGB(26, 0, 41)
█████████████████████████
█████████████████████████  Darker Purple
                           Hover states for purple
```

## Accent Colors

### Teal
```
█████████████████████████
█████████████████████████  #1B998B
█████████████████████████  RGB(27, 153, 139)
█████████████████████████
█████████████████████████  Teal
                           Badges, "New" indicators
```

### Background
```
█████████████████████████
█████████████████████████  #EEFCFC
█████████████████████████  RGB(238, 252, 252)
█████████████████████████
█████████████████████████  Background Light
                           Main page background
```

---

## Usage Examples

### In JSX/TSX Components

```jsx
// Background colors
<div className="bg-sonar-blue">Primary Blue Background</div>
<div className="bg-sonar-purple">Purple Background</div>
<div className="bg-sonar-background">Page Background</div>

// Text colors
<h1 className="text-sonar-purple">Purple Heading</h1>
<a className="text-sonar-blue">Blue Link</a>

// Border colors
<div className="border-sonar-blue border-t-4">Blue Top Border</div>

// Hover states
<button className="bg-sonar-blue hover:bg-sonar-blue-secondary">
  Hover Me
</button>
```

### In CSS Variables

```css
/* Use the CSS variables directly */
.custom-button {
  background-color: var(--color-sonar-blue);
  color: white;
}

.custom-button:hover {
  background-color: var(--color-sonar-blue-secondary);
}
```

### In brand.ts Constants

```typescript
import { SonarColors } from '@/styles/brand';

// Access colors programmatically
const primaryColor = SonarColors.blue.primary; // '#126ED3'
const purpleColor = SonarColors.purple.primary; // '#290042'
```

---

## Color Combinations

### Recommended Pairings

✅ **High Contrast (Best for readability)**
- White text on Sonar Purple (#290042) - 14.2:1
- White text on Sonar Blue (#126ED3) - 4.6:1
- Sonar Purple (#290042) on White - 14.2:1
- Sonar Blue (#126ED3) on White - 4.6:1

✅ **Good Contrast**
- Sonar Purple on Light Blue (#B7D3F2)
- Sonar Blue on Background (#EEFCFC)

⚠️ **Use with Caution**
- Light Blue on White (low contrast)
- Teal on Light Blue (verify contrast)

---

## Component-Specific Usage

### Buttons

**Primary (Call to Action)**
```
Background: Sonar Blue (#126ED3)
Hover: Secondary Blue (#0C5DB5)
Text: White (#FFFFFF)
```

**Secondary**
```
Background: Sonar Purple (#290042)
Hover: Purple Dark (#1A0029)
Text: White (#FFFFFF)
```

**Disabled**
```
Background: Light Blue (#B7D3F2)
Text: Gray (#6B7280)
```

### Inputs

**Default**
```
Border: Gray (#D1D5DB)
Background: White (#FFFFFF)
```

**Focus**
```
Border: Sonar Blue (#126ED3)
Ring: Sonar Blue 10% opacity
```

**Error**
```
Border: Red (#DC2626)
Text: Red (#DC2626)
```

### Cards

**Default**
```
Background: White (#FFFFFF)
Border Top: Sonar Blue (#126ED3) 4px
Shadow: Gray
```

### Navigation

**Active Tab**
```
Border Bottom: Sonar Blue (#126ED3) 2px
Text: Sonar Blue (#126ED3)
```

**Inactive Tab**
```
Border: Transparent
Text: Gray (#6B7280)
```

**Hover**
```
Text: Sonar Purple (#290042)
Border: Light Blue (#B7D3F2)
```

---

## Typography Pairing

### Headings (Poppins) with Purple
```html
<h1 className="text-sonar-purple font-sans font-bold">
  Main Heading
</h1>
```

### Body Text (Inter)
```html
<p className="text-gray-600 font-body">
  Body text uses Inter font family
</p>
```

### Labels (Inter) with Purple
```html
<label className="text-sonar-purple font-body font-medium">
  Form Label
</label>
```

---

## Accessibility Compliance

All color combinations meet **WCAG 2.1 Level AA** standards:

| Foreground | Background | Ratio | Grade |
|------------|------------|-------|-------|
| White | Sonar Blue | 4.6:1 | AA ✅ |
| White | Sonar Purple | 14.2:1 | AAA ✅ |
| Sonar Purple | White | 14.2:1 | AAA ✅ |
| Sonar Blue | White | 4.6:1 | AA ✅ |
| Sonar Purple | Light Blue | 8.1:1 | AAA ✅ |

---

## Color Psychology

**Sonar Blue (#126ED3)**
- Trust, reliability, professionalism
- Technology, innovation
- Clarity, communication

**Sonar Purple (#290042)**
- Sophistication, premium
- Creativity, wisdom
- Security, quality

**Teal (#1B998B)**
- Fresh, modern
- Balance, stability
- Growth, renewal

---

## Export Formats

### For Design Tools

**HEX**
- Sonar Blue: `#126ED3`
- Sonar Purple: `#290042`
- Secondary Blue: `#0C5DB5`
- Light Blue: `#B7D3F2`
- Teal: `#1B998B`
- Background: `#EEFCFC`

**RGB**
- Sonar Blue: `rgb(18, 110, 211)`
- Sonar Purple: `rgb(41, 0, 66)`
- Secondary Blue: `rgb(12, 93, 181)`
- Light Blue: `rgb(183, 211, 242)`
- Teal: `rgb(27, 153, 139)`
- Background: `rgb(238, 252, 252)`

**HSL**
- Sonar Blue: `hsl(211, 84%, 45%)`
- Sonar Purple: `hsl(277, 100%, 13%)`
- Secondary Blue: `hsl(211, 88%, 38%)`
- Light Blue: `hsl(211, 66%, 83%)`
- Teal: `hsl(175, 70%, 35%)`
- Background: `hsl(180, 64%, 96%)`

---

*Color palette from official Sonar brand guidelines*
*Last updated: March 16, 2026*
