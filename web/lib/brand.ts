// Per-product brand theming, ported from the CDN app's getCommunityBrandTheme.
// The spotlight cards and community rail take their accent from the product
// they belong to.

export type BrandTheme = {
  borderColor: string;
  accentText: string;
  bannerBg: string;
  shadowGlow: string;
};

const THEMES: Record<string, BrandTheme> = {
  worldstreet: {
    borderColor: 'border-[#FFC700]',
    accentText: 'text-[#FFC700]',
    bannerBg: 'bg-[#FFC700]',
    shadowGlow: 'shadow-[0_0_35px_rgba(255,199,0,0.5)]',
  },
  ark: {
    borderColor: 'border-[#A855F7]',
    accentText: 'text-[#A855F7]',
    bannerBg: 'bg-[#A855F7]',
    shadowGlow: 'shadow-[0_0_35px_rgba(168,85,247,0.5)]',
  },
  market: {
    borderColor: 'border-white',
    accentText: 'text-white',
    bannerBg: 'bg-white',
    shadowGlow: 'shadow-[0_0_35px_rgba(255,255,255,0.4)]',
  },
  tsioncars: {
    borderColor: 'border-[#FF2A38]',
    accentText: 'text-[#FF2A38]',
    bannerBg: 'bg-[#FF2A38]',
    shadowGlow: 'shadow-[0_0_35px_rgba(255,42,56,0.5)]',
  },
  linkpay: {
    borderColor: 'border-[#00D68F]',
    accentText: 'text-[#00D68F]',
    bannerBg: 'bg-[#00D68F]',
    shadowGlow: 'shadow-[0_0_35px_rgba(0,214,143,0.5)]',
  },
};

const DEFAULT_THEME: BrandTheme = {
  borderColor: 'border-white',
  accentText: 'text-white',
  bannerBg: 'bg-white',
  shadowGlow: 'shadow-[0_0_25px_rgba(255,255,255,0.3)]',
};

export function brandTheme(productId: string | undefined): BrandTheme {
  return (productId && THEMES[productId]) || DEFAULT_THEME;
}
