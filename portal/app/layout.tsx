import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { NavLink } from './nav-link';
import { getSession } from '@/lib/api';
import { signOut } from '@/lib/actions';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'NEU Network — Creators',
  description: 'Tasks, publishing and earnings for NEU Network creators.',
};

// Nothing here may be cached: briefs, live state and earnings all change from
// outside this app.
export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/publish', label: 'Publish' },
];

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
                <span className="brand-tv">CREATORS</span>
              </div>
              <div className="brand-sub">Creators Portal</div>
            </div>

            <nav className="nav">
              {LINKS.map((link) => (
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
                <div className="who-role">{user.role === 'creator' ? 'Creator' : user.role}</div>
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
