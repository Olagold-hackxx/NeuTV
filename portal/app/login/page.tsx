import { redirect } from 'next/navigation';
import { getSession } from '@/lib/api';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect('/');

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
        <LoginForm />
        <p className="hint" style={{ marginTop: 18 }}>
          Sign in with your NEU Passport. Creator standing is granted by the
          network; the dashboard explains where you are in that process.
        </p>
      </div>
    </div>
  );
}
