```markdown
# Design System Document: The Editorial Monolith

## 1. Overview & Creative North Star
**Creative North Star: "The Curated Gallery"**
This design system rejects the "web-standard" container-based layout in favor of a high-end editorial experience. It is inspired by boutique physical media—luxury lookbooks and architectural journals. 

To break the "template" look, designers must embrace **intentional asymmetry** and **tonal depth**. Rather than boxing content into grids, treat the screen as a canvas where elements breathe. Use large-scale typography as a structural element and leverage subtle color shifts to define hierarchy. The goal is a digital environment that feels "silent" yet authoritative, where the absence of lines creates a more sophisticated presence than their inclusion ever could.

---

## 2. Colors: The Champagne & Slate Palette
Our palette moves away from harsh digital whites and grays toward a warm, organic spectrum.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders (`#outline`) for sectioning or containment. Boundaries must be defined solely through background color shifts.
*   **Example:** A `surface-container-low` (#f5f4e8) section sitting directly on a `surface` (#fbfaee) background.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine heavy-stock paper.
*   **Base Layer:** `surface` (#fbfaee) - Use for the majority of the background.
*   **Receded Layer:** `surface-container-low` (#f5f4e8) - Use for secondary content areas.
*   **Prominent Layer:** `surface-container-highest` (#e4e3d7) - Use for navigation bars or highlighted sidebars.

### The "Glass & Gradient" Rule
To add visual "soul," use **Glassmorphism** for floating elements (modals, dropdowns). Apply `surface-container-lowest` at 80% opacity with a `20px` backdrop-blur. 
For Primary CTAs, avoid flat fills; use a subtle linear gradient from `primary` (#7a542c) to `primary-container` (#966c42) at a 135-degree angle to mimic the sheen of brushed bronze.

---

## 3. Typography: The Manrope Scale
We use **Manrope** exclusively. Its geometric yet humanist qualities provide a modern, "tech-meets-tailoring" aesthetic.

*   **Display (lg/md/sm):** Use for hero moments. Set with `-0.04em` letter spacing. These are not just titles; they are the visual anchor of the page.
*   **Headline (lg/md/sm):** Use for section headers. Ensure there is significant `16` (5.5rem) spacing above headlines to allow the "Editorial" feel to manifest.
*   **Body (lg/md):** Our primary reading weight. Use `on_surface_variant` (#50453b) for body text to reduce harsh contrast against the champagne background, enhancing the "warmth."
*   **Label (md/sm):** Use `on_secondary_fixed_variant` (#3c475a) for metadata or small captions.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are largely replaced by **Tonal Layering**.

*   **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f5f4e8) section to create a soft, natural lift.
*   **Ambient Shadows:** If a "floating" effect is required (e.g., a floating Action Button), the shadow must be: `Y: 20px, Blur: 40px, Color: rgba(27, 28, 21, 0.06)`. This mimics soft, ambient light.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility (e.g., input fields), use `outline-variant` (#d4c4b7) at **15% opacity**. Never use 100% opaque borders.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary-container`). Roundedness: `md` (0.375rem). Text: `on_primary` (#ffffff) in `label-md`.
*   **Secondary:** No fill. `Ghost Border` (15% opacity `outline-variant`). Text: `primary` (#7a542c).
*   **Tertiary:** Text only in `primary`. Underline on hover using a 1px `primary` offset by `2px`.

### Cards & Lists
*   **Constraint:** Forbid the use of divider lines.
*   **Separation:** Use `spacing-8` (2.75rem) or `spacing-10` (3.5rem) to separate list items. If items must be grouped, use a `surface-container-low` background for the entire group.

### Input Fields
*   **Background:** `surface-container-lowest` (#ffffff).
*   **Border:** `Ghost Border` (15% opacity `outline-variant`). 
*   **Active State:** Transition border to 100% opacity `primary` (#7a542c).

### Signature Component: The "Editorial Masthead"
A layout-level component using `display-lg` typography that overlaps a `surface-container-highest` image container. The text should be positioned asymmetrically to create a "custom" look rather than a centered hero.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use white space as a structural tool. If a section feels crowded, double the spacing rather than adding a border.
*   **Do** use `secondary` (#545f73) for interactive elements that are not the primary path (e.g., "Sort" or "Filter").
*   **Do** lean into asymmetry. A text block on the left with a smaller, offset image on the right feels more "premium" than a split 50/50 grid.

### Don’t
*   **Don't** use pure black (#000000). Always use `on_background` (#1b1c15) for maximum contrast.
*   **Don't** use standard Material Design elevation shadows. Stick to the Tonal Layering or Ambient Shadow rules.
*   **Don't** use generic icons. If icons are used, ensure they are thin-stroke (1px or 1.5px) to match the Manrope weight.

---

## 7. Spacing & Rhythm
The spacing scale is non-linear to encourage "breathing room."
*   **Standard Padding:** Use `spacing-5` (1.7rem) for internal container padding.
*   **Section Gaps:** Use `spacing-16` (5.5rem) to separate major content themes. 
*   **Micro-spacing:** Use `spacing-1` (0.35rem) for label-to-input relationships.```