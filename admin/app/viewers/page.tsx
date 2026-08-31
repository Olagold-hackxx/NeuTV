import { getViewers } from '@/lib/api';
import { coins, timestamp } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ViewersPage() {
  const { viewers } = await getViewers();
  const spenders = viewers.filter((v) => v.coinsSpent > 0).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Viewers</h1>
          <p className="page-sub">
            Everyone with a NEU Passport, joined to what they have spent. Every
            wallet opens at zero — there is no sign-up bonus anywhere in the system.
          </p>
        </div>
        <div className="mono">{viewers.length} accounts, {spenders} have spent</div>
      </div>

      <div className="panel">
        {viewers.length === 0 ? (
          <div className="empty">No accounts yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Account</th><th>Product</th><th>Role</th><th>Sign-in</th>
                <th className="num-col">Coins spent</th>
                <th className="num-col">Gifts</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {viewers.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="stack">
                      <span style={{ fontWeight: 600 }}>{v.name}</span>
                      <span className="mono">{v.badge}</span>
                    </div>
                  </td>
                  <td className="mono">{v.productId}</td>
                  <td>
                    {v.role === 'admin'
                      ? <span className="pill pill-admin">admin</span>
                      : <span className="pill">{v.role}</span>}
                  </td>
                  <td>
                    <span className="pill">{v.authMethod}</span>
                    {/* An SSO badge currently means the viewer typed a name: the
                        provider handshake is another team's work and is not built
                        yet. Saying so here stops the badge being read as proof. */}
                    {v.authMethod === 'sso' ? (
                      <span className="mono" style={{ marginLeft: 6 }} title="The ecosystem SSO gateway is not built yet, so this badge is self-asserted.">
                        unverified
                      </span>
                    ) : null}
                  </td>
                  <td className="num num-col">{coins(v.coinsSpent)}</td>
                  <td className="num num-col">{v.gifts || '—'}</td>
                  <td className="mono">{timestamp(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
