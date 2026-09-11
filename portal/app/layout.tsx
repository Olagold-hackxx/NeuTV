import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { NavLink } from './nav-link';
import { getSession } from '@/lib/api';
import { signOut } from '@/lib/actions';
import type { Role } from '@/lib/types';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'NEU Network — Creators & Press',
  description: 'Tasks, publishing, channels and earnings for NEU Network creators; accreditation and event access for the press.',
};

// Nothing here may be cached: briefs, live state and earnings all change from
// outside this app.
export const dynamic = 'force-dynamic';

// The portal serves two standings on one passport. A creator sees the
// working desk; a press card holder sees the press desk; an account with
// neither sees where both paths start.
const LINKS: Record<'creator' | 'press' | 'none', { href: string; label: string }[]> = {
  creator: [
    { href: '/', label: 'Dashboard' },
    { href: '/tasks', label: 'Tasks' },
    { href: '/publish', label: 'Publish' },
    { href: '/channel', label: 'My channel' },
  ],
  press: [
    { href: '/', label: 'Dashboard' },
    { href: '/press', label: 'Accreditation' },
    { href: '/press/card', label: 'Press card' },
    { href: '/press/events', label: 'Events' },
  ],
  none: [
    { href: '/', label: 'Dashboard' },
    { href: '/press', label: 'Press accreditation' },
  ],
};

const roleLabel: Record<Role, string> = { viewer: 'Passport holder', creator: 'Creator', press: 'Press', admin: 'Admin' };

const linksFor = (role: Role) => {
  if (role === 'creator') return LINKS.creator;
  if (role === 'press') return LINKS.press;
  // Admins can walk both desks on a channel's behalf.
  if (role === 'admin') return [...LINKS.creator, ...LINKS.press.slice(1)];
  return LINKS.none;
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();

  if (!user) {
    return (
      <html lang="en" className={jakarta.variable}>
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div>
              <div className="brand">
                <span className="brand-neu gradient-text">NEU</span>
                <span className="brand-tv">{user.role === 'press' ? 'PRESS' : 'CREATORS'}</span>
              </div>
              <div className="brand-sub">{user.role === 'press' ? 'Press Desk' : 'Creators Portal'}</div>
            </div>

            <nav className="nav">
              {linksFor(user.role).map((link) => (
                <NavLink key={link.href} href={link.href}>{link.label}</NavLink>
              ))}
              {/* The creator community lives on WorldSpace, not here. */}
              <a href="https://www.tsionark.com" target="_blank" rel="noreferrer">
                Community <span className="mono">WorldSpace ↗</span>
              </a>
            </nav>

            <div className="sidebar-foot">
              <div className="who">
                <div className="who-name">{user.name}</div>
                <div className="who-role">{roleLabel[user.role] ?? user.role}</div>
              </div>
              <form action={signOut}>
                <button type="submit" className="btn btn-sm btn-block">Sign out</button>
              </form>
            </div>
          </aside>

          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
