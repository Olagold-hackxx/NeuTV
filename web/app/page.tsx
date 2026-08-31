import { loadAppData } from '@/lib/server-api';
import { App } from '@/components/app';
import { Offline } from '@/components/offline';

// The one screen. Everything on it comes from the API on every request; there
// is no bundled fallback catalog, so an unreachable backend renders as an
// honest error with a retry, never as stale fixtures.
export default async function Page() {
  const data = await loadAppData();
  if (!data) return <Offline />;
  return <App data={data} />;
}
