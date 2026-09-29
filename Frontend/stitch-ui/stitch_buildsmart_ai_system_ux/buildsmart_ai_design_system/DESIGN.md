---
name: BuildSmart AI Design System
colors:
  surface: '#effcf7'
  surface-dim: '#d0ddd8'
  surface-bright: '#effcf7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eaf7f1'
  surface-container: '#e4f1eb'
  surface-container-high: '#deebe6'
  surface-container-highest: '#d8e5e0'
  on-surface: '#131e1b'
  on-surface-variant: '#414944'
  inverse-surface: '#27332f'
  inverse-on-surface: '#e7f4ee'
  outline: '#717974'
  outline-variant: '#c0c8c3'
  surface-tint: '#3c6756'
  primary: '#184436'
  on-primary: '#ffffff'
  primary-container: '#315c4c'
  on-primary-container: '#a4d2be'
  inverse-primary: '#a2d0bc'
  secondary: '#416658'
  on-secondary: '#ffffff'
  secondary-container: '#c0e9d7'
  on-secondary-container: '#456a5c'
  tertiary: '#353f3c'
  on-tertiary: '#ffffff'
  tertiary-container: '#4c5653'
  on-tertiary-container: '#c1cbc7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#beedd8'
  primary-fixed-dim: '#a2d0bc'
  on-primary-fixed: '#002116'
  on-primary-fixed-variant: '#234e3f'
  secondary-fixed: '#c3ecda'
  secondary-fixed-dim: '#a7cfbe'
  on-secondary-fixed: '#002117'
  on-secondary-fixed-variant: '#294e41'
  tertiary-fixed: '#dbe5e1'
  tertiary-fixed-dim: '#bfc9c5'
  on-tertiary-fixed: '#141d1b'
  on-tertiary-fixed-variant: '#3f4946'
  background: '#effcf7'
  on-background: '#131e1b'
  surface-variant: '#d8e5e0'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-technical:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  max-width: 1440px
---

## Brand & Style
The design system is rooted in the precision of architectural drafting and the reliability of structural engineering. It targets professionals in AEC (Architecture, Engineering, Construction) who value clarity over decoration. 

The aesthetic is **Modern Architectural**, characterized by a rigorous adherence to grid systems, ample whitespace, and a high-contrast palette that prioritizes legibility. It avoids the fleeting trends of "tech" aesthetics (like vibrant neon gradients or heavy glassmorphism) in favor of a timeless, tactile professionalism. The goal is to evoke an emotional response of organized intelligence and absolute trust.

## Colors
This design system utilizes a sophisticated, nature-inspired palette that mirrors architectural materials like slate, charcoal, and forest greenery.

- **Primary Action**: Architectural Green (#315C4C) is the signature color for focus and primary intent.
- **Surface Strategy**: The primary background uses a warm "Paper" white (#FAFAF8) to reduce eye strain during long technical sessions, while Slate-50 (#F6F7F7) provides a clear secondary tier for sidebars and utility panels.
- **Typography**: High-contrast Charcoal (#17201E) ensures maximum readability for technical specs, while a softer Slate (#4B5753) is used for metadata and helper text.
- **Footer**: A solid Charcoal anchor provides a heavy visual "foundation" to the application interface.

## Typography
The system relies exclusively on **Inter** to maintain a clean, systematic appearance that mimics the technical clarity of blueprints. 

- **Hierarchy**: Headlines use tighter letter spacing and heavier weights to command attention. 
- **Labels**: Small labels use uppercase styling with increased letter spacing (0.05em) for a "draftsman" look on technical tags and metadata.
- **Readability**: Body text maintains a generous line height to ensure that dense architectural data remains digestible.

## Layout & Spacing
The design system employs a **strict 8px grid system**, ensuring all elements align with mathematical precision. 

- **Grid Model**: A 12-column fluid grid is used for main content areas, with 24px gutters.
- **Breakpoints**: 
  - **Mobile (<640px)**: 4 columns, 16px margins. 
  - **Tablet (640px - 1024px)**: 8 columns, 24px margins.
  - **Desktop (>1024px)**: 12 columns, 48px margins, 1440px max content width.
- **Rhythm**: Vertical spacing between logical sections should always be a multiple of 8 (e.g., 40px or 80px) to maintain structural integrity.

## Elevation & Depth
Depth is communicated through **Tonal Layering** and minimal shadows, reflecting the flat, stacked nature of architectural drawings.

- **Shadows**: Only one shadow style is permitted: `0 4px 12px rgba(23, 32, 30, 0.05)`. This is reserved for elevated cards, dropdowns, and modals to provide a gentle separation from the base surface without appearing "floating."
- **Outlines**: Most depth is achieved through 1px solid borders using Soft Slate (#DDE2E0). This reinforces the feeling of a drafted plan.
- **Overlays**: Modals and menus utilize a subtle backdrop blur (8px) combined with a semi-transparent white tint to maintain context of the underlying "blueprint."

## Shapes
Shapes are disciplined and deliberate. The system uses "Moderate" roundedness to soften the technical edge while remaining professional.

- **Standard (8px)**: Used for buttons, input fields, and small UI controls.
- **Large (12px)**: Used for content cards and secondary containers.
- **Extra Large (14px)**: Reserved exclusively for modals and large fly-out panels.
- **Interactive States**: Hover states should never change the border radius, only the background color or border intensity.

## Components

### Buttons
- **Primary**: Solid Architectural Green (#315C4C) with White text. Hover state shifts to Deep Green (#264B3E).
- **Secondary**: Outlined Charcoal (#17201E) with 1px border. No background fill unless hovered (Light Slate-50 fill).
- **Tertiary**: Ghost style with Charcoal text; used for low-emphasis actions.

### Technical Inputs
- **Fields**: White background, 1px Soft Slate border, 8px radius. 
- **Focus State**: 1px solid Architectural Green border with a subtle 2px outer glow of the same color at 10% opacity.
- **Labels**: Always positioned above the input in Charcoal (#17201E) using `body-sm` bold.

### Cards & Containers
- **Default**: White background, 1px Soft Slate border, 12px radius. 
- **Interactive**: Adds the subtle 0.05 opacity shadow on hover to indicate clickability.

### Navigation
- **Top Bar**: Sticky positioning, Warm White (#FAFAF8) background with a 1px bottom border in Soft Slate. 
- **Side Navigation**: Slate-50 (#F6F7F7) background to differentiate from the main canvas.

### Status Badges
- **General**: Small, semi-pill shape (uppercase `label-md`). 
- **Success**: #2F6B50 text on 10% opacity green background.
- **Warning**: #A66A00 text on 10% opacity amber background.
- **Error**: #B42318 text on 10% opacity red background.