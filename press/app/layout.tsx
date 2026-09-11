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
  title: 'NEU Network — Press',
  description: 'Accreditation, the NEU PRESS e-card, and event access for journalists and outlets.',
};

// Nothing here may be cached: an application's status and what is on air
// both change from outside this app.
export const dynamic = 'force-dynamic';

// One desk, two states. An applicant sees where their application stands; a
// verified card holder sees the card and the events it opens.
const LINKS = {
  applicant: [
    { href: '/accreditation', label: 'Accreditation' },
  ],
  press: [
    { href: '/', label: 'Desk' },
    { href: '/accreditation', label: 'Accreditation' },
    { href: '/card', label: 'Press card' },
    { href: '/events', label: 'Events' },
  ],
};

const roleLabel: Record<Role, string> = { viewer: 'Applicant', creator: 'Applicant', press: 'Press', admin: 'Admin' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();

  if (!user) {
    return (
      <html lang="en" className={jakarta.variable}>
        <body>{children}</body>
      </html>
    );
  }

  const links = user.role === 'press' || user.role === 'admin' ? LINKS.press : LINKS.applicant;

  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div>
              <div className="brand">
                <span className="brand-neu gradient-text">NEU</span>
                <span className="brand-tv">PRESS</span>
              </div>
              <div className="brand-sub">Press Portal</div>
            </div>

            <nav className="nav">
              {links.map((link) => (
                <NavLink key={link.href} href={link.href}>{link.label}</NavLink>
              ))}
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
