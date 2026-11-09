/**
 * The site header's and footer's link lists, kept out of the components so tests can pin them.
 *
 * Only routes that exist in src/app are listed. Public: Episodes (All The Spoilers show notes) and
 * Book clubs (public ReadWitUS clubs). Signed in: the two dashboard sections (Media, Clubs) and,
 * for admins only, Admin. /shelf is left out of the header because it 404s while the
 * `public_profiles_enabled` flag is off.
 */

export interface NavItem {
  href: string;
  label: string;
}

/** Shared UI rule: the header's sign-in link reads exactly this. Never rename it. */
export const SIGN_IN_LABEL = "Sign in";
export const SIGN_IN_HREF = "/signin";

const PUBLIC_NAV: NavItem[] = [
  { href: "/episodes", label: "Episodes" },
  { href: "/clubs", label: "Book clubs" },
];

const SIGNED_IN_NAV: NavItem[] = [
  { href: "/dashboard/media", label: "My media" },
  { href: "/dashboard/clubs", label: "My clubs" },
];

const ADMIN_NAV: NavItem = { href: "/dashboard/admin", label: "Admin" };

/** The header's primary navigation for this visitor. */
export function primaryNav({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }): NavItem[] {
  if (!signedIn) return PUBLIC_NAV;
  return [...SIGNED_IN_NAV, ...PUBLIC_NAV, ...(isAdmin ? [ADMIN_NAV] : [])];
}

/**
 * True when `href` is the current section. Exact match for the home page; prefix match on a path
 * segment boundary otherwise, so /dashboard/media/123 marks "My media" but /clubs does not mark
 * /clubsfoo.
 */
export function isCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The footer's "Stream.WitUS" column. Every entry is a real route in src/app. */
export function footerAppLinks(signedIn: boolean): NavItem[] {
  return [
    { href: "/", label: "Home" },
    { href: "/episodes", label: "Episodes" },
    { href: "/clubs", label: "Book clubs" },
    { href: "/connect", label: "Be on the show" },
    { href: "/pitch", label: "Pitch your media" },
    { href: "/feed/episodes.xml", label: "Episodes RSS feed" },
    signedIn ? { href: "/dashboard/media", label: "My media" } : { href: SIGN_IN_HREF, label: SIGN_IN_LABEL },
  ];
}

/**
 * Sibling products, from the ecosystem footer recipe (witus public/brand/footer-recipe.md, with its
 * 2026-08 correction: Wanderlearn is now Wanderlust). Keep in step with gemini/witus lib/products.ts.
 */
export const SIBLING_PRODUCTS: NavItem[] = [
  { label: "WitUS.online", href: "https://witus.online" },
  { label: "WitUS Inbox", href: "https://inbox.witus.online" },
  { label: "CentenarianOS", href: "https://centenarianos.com" },
  { label: "Work.WitUS", href: "https://work.witus.online" },
  { label: "Tour Manager OS", href: "https://tour.witus.online" },
  { label: "Wanderlust", href: "https://wanderlust.witus.online" },
  { label: "Fly.WitUS", href: "https://fly.witus.online" },
  { label: "FlashLearnAI", href: "https://flashlearnai.witus.online" },
  { label: "Learn.WitUS", href: "https://learn.witus.online" },
  { label: "AwesomeWebStore", href: "https://awesomewebstore.com" },
];

/** Who to ask about access, from the same recipe's Contact link. */
export const CONTACT_HREF = "mailto:bam@awews.com";
