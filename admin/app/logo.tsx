import Image from 'next/image';

/**
 * The NEU Network mark: the supplied brand banner, used whole.
 *
 * Same lockup as the viewer app. The back office is a different surface, not a
 *
 * The file used is neu-brand-banner-alpha.png, derived from the supplied
 * neu-brand-banner.png. The original is 100% opaque with a black field baked
 * in, which would show as a black rectangle against the #0B1220 surface. The
 * derived version thresholds that field to transparency and leaves the artwork
 * at full strength. The original is kept in frontend/assets/logos untouched.
 *
 * `compact` falls back to the N tile for places too narrow
 * for the tagline to be legible.
 */

const RATIO = 410 / 180;

export function Logo({ width = 150, compact = false }: { width?: number; compact?: boolean }) {
  if (compact) {
    return (
      <Image
        src="/logos/neu-cube-n.png"
        alt="NEU Network"
        width={28}
        height={28}
        priority
        style={{ width: 28, height: 28, display: 'block', borderRadius: 5 }}
      />
    );
  }

  const height = Math.round(width / RATIO);
  return (
    <Image
      src="/logos/neu-brand-banner-alpha.png"
      alt="NEU Network"
      width={width}
      height={height}
      priority
      style={{ width, height, display: 'block' }}
    />
  );
}
