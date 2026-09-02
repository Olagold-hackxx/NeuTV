import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
      <h1 style={{ marginBottom: 8 }}>Not found</h1>
      <p className="page-sub" style={{ margin: '0 auto 20px' }}>
        That page or record does not exist.
      </p>
      <Link href="/" className="btn btn-primary">Back to the dashboard</Link>
    </div>
  );
}
