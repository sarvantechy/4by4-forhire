export const colors = {
  danger: '#B42318',
  ink: '#171A1F',
  line: '#DFE3DC',
  muted: '#667078',
  paper: '#F5F7F3',
  signal: '#FFC928',
  surface: '#FFFFFF',
  teal: '#087F75',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

/** Distinct accent color per catalog category slug, used for chips, badges, and icon tiles. */
export const categoryColors: Record<string, string> = {
  'tools-repair': '#F97316',
  'construction-labour': '#EF4444',
  'cleaning-home': '#06B6D4',
  'garden-farm': '#22C55E',
  'events-functions': '#A855F7',
  'electronics-photography': '#3B82F6',
  'travel-outdoor': '#14B8A6',
  'home-office': '#6366F1',
  'fashion-accessories': '#EC4899',
  'labour-work-services': '#F59E0B',
};

export function categoryColor(slug: string | null | undefined): string {
  if (slug && categoryColors[slug]) return categoryColors[slug];
  return colors.teal;
}
