import { hasWitusSso } from '@/lib/env';
import { SignInForm } from './SignInForm';

// Server component: reads the server-only `hasWitusSso` flag so the "Sign in with
// WitUS" button only renders once the OIDC client is provisioned. The interactive
// form + its status states live in the client SignInForm.
export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Stream.WitUS</h1>
          <p className="text-sm text-neutral-400">Sign in with a magic link.</p>
        </div>

        <SignInForm witusSsoEnabled={hasWitusSso} />
      </div>
    </main>
  );
}
