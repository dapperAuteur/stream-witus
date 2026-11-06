"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import SignOutButton, { SignOutEverywhereButton } from "@/components/SignOutButton";
import { SIGN_IN_HREF, SIGN_IN_LABEL, isCurrent, primaryNav } from "@/lib/site-nav";

/**
 * Stream.WitUS site header, mounted once in the root layout so every page (404 and the error
 * boundary included) has it. Shape follows shop-witus's site-header (brand left, nav and auth
 * right, 44px targets); colors follow Stream's own dark neutral + fuchsia pages.
 *
 * Sign-in control (witus docs/shared-ui-ux-dx.md): signed out, a link named exactly "Sign in" to
 * /signin is visible at every width, outside the mobile menu. Signed in, the slot becomes an
 * Account menu holding "Sign out" (this app only) and "Sign out of WitUS everywhere" with its help
 * text, the same controls and semantics as src/lib/sign-out.ts. `signedIn` comes from the server
 * and falls back to false when the session lookup fails, so the control never disappears.
 *
 * Below md the primary nav folds into a Menu disclosure: a real button with aria-expanded and
 * aria-controls, Escape closes it and returns focus to the button, and it closes on navigation.
 */

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400";

const NAV_LINK = `inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5 hover:text-white ${FOCUS_RING}`;

const NAV_LINK_CURRENT = "text-white underline decoration-fuchsia-400 decoration-2 underline-offset-8";

export function SiteHeader({
  signedIn,
  email,
  isAdmin,
  endSessionUrl,
}: {
  signedIn: boolean;
  email: string | null;
  isAdmin: boolean;
  /** Server-resolved IdP logout URL; null hides "Sign out of WitUS everywhere". */
  endSessionUrl: string | null;
}) {
  const pathname = usePathname();
  const items = primaryNav({ signedIn, isAdmin });
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the mobile menu when the route changes (adjusting state during render, not in an effect).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (menuOpen) setMenuOpen(false);
  }

  const closeMenu = () => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <header className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-1">
        <Link
          href="/"
          className={`inline-flex min-h-11 shrink-0 items-center rounded-md text-base font-bold tracking-tight text-white ${FOCUS_RING}`}
        >
          Stream<span className="text-fuchsia-400">.WitUS</span>
        </Link>

        <nav aria-label="Primary" className="hidden min-w-0 items-center gap-1 md:flex">
          {items.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`${NAV_LINK} ${current ? NAV_LINK_CURRENT : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {signedIn ? (
            <AccountMenu email={email} endSessionUrl={endSessionUrl} />
          ) : (
            <Link
              href={SIGN_IN_HREF}
              className={`inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 text-sm font-semibold text-white transition-colors hover:border-fuchsia-500 hover:bg-white/5 ${FOCUS_RING}`}
            >
              {SIGN_IN_LABEL}
            </Link>
          )}
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-neutral-200 hover:bg-white/5 md:hidden ${FOCUS_RING}`}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            <span className="sr-only">Menu</span>
          </button>
        </div>
      </div>

      <div
        id={menuId}
        hidden={!menuOpen}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeMenu();
        }}
        className="border-t border-neutral-800 md:hidden"
      >
        <nav aria-label="Primary" className="mx-auto flex max-w-5xl flex-col px-4 py-2">
          {items.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={`${NAV_LINK} ${current ? "text-white" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/**
 * Signed-in account disclosure: who is signed in, "Sign out", and "Sign out of WitUS everywhere".
 * Escape or a click outside closes it; Escape returns focus to the trigger.
 */
function AccountMenu({ email, endSessionUrl }: { email: string | null; endSessionUrl: string | null }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-neutral-700 px-3 text-sm font-medium text-white hover:bg-white/5 ${FOCUS_RING}`}
      >
        Account
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      <div
        id={panelId}
        hidden={!open}
        // Below md the panel spans the viewport (fixed, 16px gutters) so it can never push the page
        // sideways at 320px; from md up it drops down under the button.
        className="fixed inset-x-4 top-14 z-50 space-y-2 rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-72"
      >
        {email ? (
          <p className="truncate text-xs text-neutral-400">
            Signed in as <span className="text-neutral-200">{email}</span>
          </p>
        ) : null}
        <SignOutButton />
        <SignOutEverywhereButton endSessionUrl={endSessionUrl} />
      </div>
    </div>
  );
}
