import Image from 'next/image';

/**
 * The NEU TV mark.
 *
 * neu-brand-banner.png is the finished lockup: the N-E-U cube tiles over the
 * "NEW ECONOMY UNVEIL NETWORK" bar. It is used whole rather than rebuilt from
 * the individual tiles, because a supplied lockup already has its spacing and
 * proportions decided and re-typesetting it is how brands drift.
 *
 *
 * The file used is neu-brand-banner-alpha.png, derived from the supplied
 * neu-brand-banner.png. The original is 100% opaque with a black field baked
 * in, which would show as a black rectangle against the #0B1220 surface. The
 * derived version thresholds that field to transparency and leaves the artwork
 * at full strength. The original is kept in frontend/assets/logos untouched.
 *
 * Two sizes, and only two, because the banner carries a tagline that stops
 * being legible below roughly 110px wide:
 *
 *   full     the banner, wherever there is horizontal room
 *   compact  the N tile alone, for the 72px collapsed rail and anywhere the
 *            banner would be too small to read
 */

const BANNER = { src: '/logos/neu-brand-banner-alpha.png', width: 410, height: 180 };
const RATIO = BANNER.width / BANNER.height; // 2.28

export function Logo({
  width = 150,
  compact = false,
  priority = false,
  className = '',
}: {
  width?: number;
  compact?: boolean;
  priority?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <Image
        src="/logos/neu-cube-n.png"
        alt="NEU TV"
        width={28}
        height={28}
        priority={priority}
        className={`block rounded-[5px] ${className}`}
        style={{ width: 28, height: 28 }}
      />
    );
  }

  const height = Math.round(width / RATIO);

  return (
    <Image
      src={BANNER.src}
      alt="NEU TV"
      width={width}
      height={height}
      priority={priority}
      className={`block ${className}`}
      style={{ width, height }}
    />
  );
}
