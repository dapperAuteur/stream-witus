'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth-client';

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push('/signin');
      }}
      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
      aria-label="Sign out"
    >
      <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
    </button>
  );
}
