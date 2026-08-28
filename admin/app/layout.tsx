import type { Metadata } from 'next';
import './globals.css';
import { NavLink } from './nav-link';
import { getSession } from '@/lib/api';
import { signOut } from '@/lib/actions';

export const metadata: Metadata = {
  title: 'NEU TV — Back Office',
  description: 'Video library, programming and CRM for the NEU TV network.',
};

// Nothing here may be cached: the roster, the queue and what is on air all
// change from outside this app.
export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/videos', label: 'Videos' },
  { href: '/programme', label: 'Programme' },
  { href: '/viewers', label: 'Viewers' },
  { href: '/moderation', label: 'Moderation' },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();

  // The login page renders its own shell. Without a session there is no nav to
  // draw, so the layout gets out of the way.
  if (!user) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div>
              <div className="brand">
                <span className="brand-neu gradient-text">NEU</span>
                <span className="brand-tv">TV</span>
              </div>
              <div className="brand-sub">Back Office</div>
            </div>

            <nav className="nav">
              {LINKS.map((link) => (
                <NavLink key={link.href} href={link.href}>{link.label}</NavLink>
              ))}
            </nav>

            <div className="sidebar-foot">
              <div className="who">
                <div className="who-name">{user.name}</div>
                <div className="who-role">{user.role}</div>
              </div>
              <form action={signOut}>
                <button type="submit" className="btn btn-sm" style={{ width: '100%' }}>Sign out</button>
              </form>
            </div>
          </aside>

          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
