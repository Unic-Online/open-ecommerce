import RecoverClient from './RecoverClient';

// Recovery URL handler. Client-rendered because cookies().set() and
// localStorage writes both need to happen on the user's device. The actual
// verification + cart lookup + cookie setting lives in
// /api/cart/recover/[token], which the client wrapper calls on mount.

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function RecoverPage({ params }: PageProps) {
  const { token } = await params;
  return <RecoverClient token={token} cartPath="/cart" loadingText="Restoring your basket…" />;
}
