import { redirect } from 'next/navigation';
import { getSession } from '@/lib/api';
import { LoginForm } from './login-form';
import { Logo } from '../logo';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getSession();
  if (user?.role === 'admin') redirect('/');

  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <div style={{ marginBottom: 22 }}>
          <Logo width={112} />
          <div className="brand-sub" style={{ paddingLeft: 0 }}>Back Office</div>
        </div>
        <LoginForm />
        <p className="hint" style={{ marginTop: 18 }}>
          Back-office access is granted by deployment, not by signing up: the
          account&apos;s email must be listed in <code>NEUTV_ADMIN_EMAILS</code> on
          the API server.
        </p>
      </div>
    </div>
  );
}
