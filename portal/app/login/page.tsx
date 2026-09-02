import { redirect } from 'next/navigation';
import { getProducts, getSession } from '@/lib/api';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect('/');
  // The SSO tab needs the product list; an unreachable API falls back to an
  // empty list and the email tab still works.
  const products = await getProducts().then((r) => r.products).catch(() => []);

  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <div style={{ marginBottom: 22 }}>
          <div className="brand" style={{ paddingLeft: 0 }}>
            <span className="brand-neu gradient-text">NEU</span>
            <span className="brand-tv">CREATORS</span>
          </div>
          <div className="brand-sub" style={{ paddingLeft: 0 }}>Creators Portal</div>
        </div>
        <LoginForm products={products} />
        <p className="hint" style={{ marginTop: 18 }}>
          Sign in with your NEU Passport. Creator standing is granted by the
          network; the dashboard explains where you are in that process.
        </p>
      </div>
    </div>
  );
}
