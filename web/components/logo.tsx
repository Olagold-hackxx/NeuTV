import Image from 'next/image';

/**
 * The NEU TV mark.
 *
 * Three cube tiles spelling N-E-U, followed by TV. These are the brand's actual
 * letterforms — the mark the original app booted with — not type styled to look
 * like them. They were sitting unused in public/logos while the app drew
 * gradient text instead.
 *
 * The tiles are ~128px square PNGs, so they are requested at 2x the rendered
 * box and rely on Next's optimiser to serve the right size. `priority` on the
 * header instance keeps the mark from popping in after first paint.
 */

const CUBES = [
  { src: '/logos/neu-cube-n.png', letter: 'N' },
  { src: '/logos/neu-cube-e.png', letter: 'E' },
  { src: '/logos/neu-cube-u.png', letter: 'U' },
];

type Size = 'sm' | 'md' | 'lg';

const BOX: Record<Size, number> = { sm: 20, md: 26, lg: 34 };
const TV: Record<Size, string> = {
  sm: 'text-[10px] ml-1.5',
  md: 'text-xs ml-2',
  lg: 'text-sm ml-2.5',
};

export function Logo({
  size = 'md',
  showTv = true,
  priority = false,
  className = '',
}: {
  size?: Size;
  showTv?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const box = BOX[size];

  return (
    // One accessible name for the whole lockup. The tiles themselves are
    // decorative once the group is labelled, so a screen reader says "NEU TV"
    // rather than spelling it out letter by letter.
    <span className={`inline-flex items-center ${className}`} role="img" aria-label="NEU TV">
      <span className="flex items-center gap-[3px]" aria-hidden>
        {CUBES.map((cube) => (
          <Image
            key={cube.letter}
            src={cube.src}
            alt=""
            width={box}
            height={box}
            priority={priority}
            className="block rounded-[4px]"
            style={{ width: box, height: box }}
          />
        ))}
      </span>
      {showTv ? (
        <span
          className={`font-extrabold uppercase tracking-[0.18em] text-sky ${TV[size]}`}
          aria-hidden
        >
          TV
        </span>
      ) : null}
    </span>
  );
}
