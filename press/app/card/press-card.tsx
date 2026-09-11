'use client';

// The e-card: an ID the size of a card, front and back, printable. The
// machine-readable strip is the card id rendered as a bar pattern - a door
// scanner reads the id; the desk verifies it against the record.

type PressCardProps = {
  cardId: string;
  name: string;
  handle: string;
  avatar?: string;
  outlet: string;
  title: string;
  beat: string;
  issuedAt: number;
  expiresAt: number;
  valid: boolean;
};

const dateOf = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

// Deterministic bar widths from the id: the same card always draws the same
// strip, so a photo of it matches the screen.
function bars(id: string) {
  const out: number[] = [];
  for (const ch of id.replace(/[^A-Z0-9]/g, '')) {
    const code = ch.charCodeAt(0);
    out.push(1 + (code % 3), 1 + ((code >> 2) % 2));
  }
  return out;
}

export function PressCard(props: PressCardProps) {
  const { cardId, name, handle, avatar, outlet, title, beat, issuedAt, expiresAt, valid } = props;
  const initial = name.replace(/^[@$]/, '').slice(0, 1).toUpperCase();

  return (
    <div className="stack-loose">
      <div className={`press-card ${valid ? '' : 'press-card-expired'}`} role="img" aria-label={`NEU PRESS card ${cardId} for ${name}, ${outlet}`}>
        <div className="press-card-head">
          <div className="brand" style={{ paddingLeft: 0 }}>
            <span className="brand-neu gradient-text">NEU</span>
            <span className="brand-tv">PRESS</span>
          </div>
          <span className={`pill ${valid ? 'pill-published' : 'pill-block'}`}>{valid ? 'Valid' : 'Expired'}</span>
        </div>

        <div className="press-card-body">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="press-card-photo" />
          ) : (
            <div className="press-card-photo press-card-initial">{initial}</div>
          )}
          <div className="press-card-who">
            <div className="press-card-name">{name.replace(/^[@$]/, '')}</div>
            <div className="press-card-line">{title}{beat ? `, ${beat}` : ''}</div>
            <div className="press-card-outlet">{outlet}</div>
            <div className="mono">@{handle.replace(/^@/, '')}</div>
          </div>
        </div>

        <div className="press-card-foot">
          <div>
            <div className="stat-label">Card id</div>
            <div className="press-card-id num">{cardId}</div>
          </div>
          <div>
            <div className="stat-label">Issued</div>
            <div className="num">{dateOf(issuedAt)}</div>
          </div>
          <div>
            <div className="stat-label">Valid through</div>
            <div className="num">{dateOf(expiresAt)}</div>
          </div>
        </div>

        <div className="press-card-strip" aria-hidden>
          {bars(cardId).map((w, i) => (
            <span key={i} style={{ width: w * 2, background: i % 2 ? 'transparent' : 'currentColor' }} />
          ))}
        </div>
        <div className="press-card-note">
          Admits the named holder to NEU Network events. Verify at the desk against {cardId}.
        </div>
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
    </div>
  );
}
