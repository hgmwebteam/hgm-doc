/**
 * The Untitled UI type scale, verbatim from src/styles/theme.css (spacing step = 4px):
 * Text xs→xl, Display xs→2xl, with each step's line-height and letter-spacing.
 * `min` is the mobile size — one display step down, the same `text-display-xs
 * md:text-display-sm` pattern the dashboard's own headings use; text sizes don't shrink.
 * `large` marks the steps a brand's second heading font takes over (see resolveRoles).
 *
 * Pure data + one formula, shared by the Brand Kit's on-screen scale and its CSS export
 * so the two can never disagree about a size.
 */
export type TypeStep = { label: string; px: number; lh: number; ls?: number; min: number; display?: boolean; large?: boolean };

export const TYPE_SCALE: TypeStep[] = [
    { label: "Display 2xl", px: 72, lh: 90, ls: -1.44, min: 60, display: true, large: true },
    { label: "Display xl", px: 60, lh: 72, ls: -1.2, min: 48, display: true, large: true },
    { label: "Display lg", px: 48, lh: 60, ls: -0.96, min: 36, display: true },
    { label: "Display md", px: 36, lh: 44, ls: -0.72, min: 30, display: true },
    { label: "Display sm", px: 30, lh: 38, min: 24, display: true },
    { label: "Display xs", px: 24, lh: 32, min: 20, display: true },
    { label: "Text xl", px: 20, lh: 30, min: 20 },
    { label: "Text lg", px: 18, lh: 28, min: 18 },
    { label: "Text md", px: 16, lh: 24, min: 16 },
    { label: "Text sm", px: 14, lh: 20, min: 14 },
    { label: "Text xs", px: 12, lh: 18, min: 12 },
];

/** Fluid size between a 360px and 1280px viewport; a step that doesn't shrink is just px. */
export const clampFor = (min: number, max: number): string => {
    if (min === max) return `${max}px`;
    const slope = (max - min) / (1280 - 360);
    const intercept = min - slope * 360;
    return `clamp(${min}px, ${intercept.toFixed(2)}px + ${(slope * 100).toFixed(2)}vw, ${max}px)`;
};

/** "Display 2xl" → "display-2xl", the token name the CSS export uses. */
export const typeStepToken = (label: string) => label.toLowerCase().replace(/\s+/g, "-");
