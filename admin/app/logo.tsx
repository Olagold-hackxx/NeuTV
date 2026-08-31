import Image from 'next/image';

/**
 * The NEU TV mark: three cube tiles spelling N-E-U, then TV.
 *
 * The same lockup the viewer app uses. The back office is a different surface,
 * not a different product, and it was drawing gradient type where the brand has
 * actual letterforms.
 */

const CUBES = [
  { src: '/logos/neu-cube-n.png', letter: 'N' },
  { src: '/logos/neu-cube-e.png', letter: 'E' },
  { src: '/logos/neu-cube-u.png', letter: 'U' },
];

export function Logo({ size = 24, showTv = true }: { size?: number; showTv?: boolean }) {
  return (
    // Labelled once for the whole lockup, so a screen reader says "NEU TV"
    // instead of spelling out three images.
    <span className="row" role="img" aria-label="NEU TV" style={{ gap: 3 }}>
      {CUBES.map((cube) => (
        <Image
          key={cube.letter}
          src={cube.src}
          alt=""
          width={size}
          height={size}
          priority
          style={{ width: size, height: size, display: 'block', borderRadius: 4 }}
        />
      ))}
      {showTv ? <span className="brand-tv" style={{ marginLeft: 4 }}>TV</span> : null}
    </span>
  );
}
