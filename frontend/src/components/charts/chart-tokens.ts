export const chartColors = {
  brand: "#106b65",
  brandLight: "#20a296",
  brandFaint: "#a8e8dd",
  accent: "#6b5bd2",
  slate: "#94a3b8",
  grid: "#e5ecef",
  axis: "#6e8090",
  tooltipBorder: "#dde6ea",
  ink: "#0b1c2c",
} as const;

export const bandColors = [
  chartColors.brand,
  chartColors.brandLight,
  chartColors.accent,
  chartColors.slate,
] as const;
