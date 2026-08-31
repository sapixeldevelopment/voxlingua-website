import Link from "next/link";

type Props = { searchParams: Promise<{ message?: string }> };

export default async function AuthCodeErrorPage({ searchParams }: Props) {
  const params = await searchParams;
  const message = params.message
    ? decodeURIComponent(params.message)
    : "The sign-in provider could not complete authentication.";

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link>
        <h1>Sign-in needs setup.</h1>
        <p>{message}</p>
        <p className="subtle" style={{ marginTop: 14 }}>
          If you manage this Dexlyy project, enable Discord in Supabase Auth Providers and try again.
        </p>
        <Link href="/login" className="btn btn-primary" style={{ display: "inline-flex", marginTop: 20 }}>
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
