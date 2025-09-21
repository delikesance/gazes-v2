export const CARD_SIZES = {
  sm: {
    width: 'w-[170px]',
    widthPx: 170,
  },
  md: {
    width: 'w-[200px]',
    widthPx: 200,
  },
  lg: {
    width: 'w-[240px]',
    widthPx: 240,
  },
} as const

export const CAROUSEL_CONFIG = {
  gap: 20, // gap-5 = 1.25rem = 20px
  scrollMultiplier: 3,
  edgeFadeWidth: 'w-20',
  padding: {
    horizontal: 'px-20',
    left: 'pl-20',
    right: 'pr-20',
    scrollLeft: 'scroll-pl-20',
    scrollRight: 'scroll-pr-20',
  },
} as const

export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

export const TYPOGRAPHY = {
  sizes: {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
    '5xl': 'text-5xl',
    '6xl': 'text-6xl',
  },
  weights: {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    extrabold: 'font-extrabold',
    black: 'font-black',
  },
} as const

export const ANIMATION = {
  transition: 'transition-colors',
  duration: {
    fast: 'duration-150',
    normal: 'duration-200',
    slow: 'duration-300',
  },
  ease: {
    out: 'ease-out',
    in: 'ease-in',
    inOut: 'ease-in-out',
  },
} as const

export const SPACING = {
  section: 'py-6 md:py-8',
  container: 'px-5 md:px-20',
  gap: {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  },
} as const

export const useDesignSystem = () => {
  const getCardSize = (size: keyof typeof CARD_SIZES = 'md') => CARD_SIZES[size]

  const getCarouselScrollStep = (cardSize: keyof typeof CARD_SIZES = 'md') => {
    const cardWidth = CARD_SIZES[cardSize].widthPx
    return (cardWidth + CAROUSEL_CONFIG.gap) * CAROUSEL_CONFIG.scrollMultiplier
  }

  const getResponsiveSizes = (size: keyof typeof CARD_SIZES = 'md') => {
    const baseWidth = CARD_SIZES[size].widthPx
    return {
      sm: `${baseWidth + 20}px`,
      md: `${baseWidth + 40}px`,
      lg: `${baseWidth + 60}px`,
    }
  }

  return {
    CARD_SIZES,
    CAROUSEL_CONFIG,
    BREAKPOINTS,
    TYPOGRAPHY,
    ANIMATION,
    SPACING,
    getCardSize,
    getCarouselScrollStep,
    getResponsiveSizes,
  }
}

export type CardSize = keyof typeof CARD_SIZES
export type TypographySize = keyof typeof TYPOGRAPHY.sizes
export type TypographyWeight = keyof typeof TYPOGRAPHY.weights
