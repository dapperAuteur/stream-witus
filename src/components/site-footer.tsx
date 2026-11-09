import Link from "next/link";
import { CONTACT_HREF, SIBLING_PRODUCTS, footerAppLinks } from "@/lib/site-nav";

// WitUS ecosystem footer for stream.witus.online, built from the shared recipe
// (gemini/witus public/brand/footer-recipe.md; reference fly-witus/shop-witus site-footer.tsx):
// product line, Rise Wellness callout, three columns (Ecosystem, this app, Partners & Legal),
// copyright. Palette is Stream's own: dark neutral surfaces with fuchsia accents. On these dark
// surfaces the muted pair is inverted (neutral-400 text, about 7:1 on neutral-950).

const linkClasses =
  "inline-flex items-center min-h-7 rounded text-neutral-400 hover:text-fuchsia-300 hover:underline transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400";

export function SiteFooter({ signedIn }: { signedIn: boolean }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-800 bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <p className="text-lg font-extrabold tracking-tight text-white">
            Stream<span className="text-fuchsia-400">.WitUS</span>
          </p>
          <p className="text-xs text-neutral-400">
            Books, movies and TV, the All The Spoilers podcast, and the ReadWitUS book club
          </p>
        </div>

        <RiseWellnessCallout />

        <div className="grid grid-cols-1 gap-8 text-sm sm:grid-cols-3">
          <div>
            <p className="mb-2 font-semibold text-white">Ecosystem</p>
            <ul className="space-y-1">
              {SIBLING_PRODUCTS.map((p) => (
                <li key={p.href}>
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className={linkClasses}>
                    {p.label}
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 font-semibold text-white">Stream.WitUS</p>
            <ul className="space-y-1">
              {footerAppLinks(signedIn).map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClasses}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 font-semibold text-white">Partners &amp; Legal</p>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://www.centenarianos.com/safety#rise-wellness"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClasses}
                >
                  Rise Wellness
                  <span className="sr-only"> (mental-health partner, opens in new tab)</span>
                </a>
                <p className="text-xs leading-tight text-neutral-400">Mental-health partner</p>
              </li>
              <li className="pt-2">
                <a href="https://witus.online/terms" target="_blank" rel="noopener noreferrer" className={linkClasses}>
                  Terms
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </li>
              <li>
                <a href="https://witus.online/privacy" target="_blank" rel="noopener noreferrer" className={linkClasses}>
                  Privacy
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </li>
              <li>
                <a href={CONTACT_HREF} className={linkClasses}>
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-neutral-800 pt-6 text-center text-xs text-neutral-400">
          <p>
            © {year} B4C LLC. An{" "}
            <a
              href="https://awesomewebstore.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded text-neutral-300 hover:text-fuchsia-300 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
            >
              AwesomeWebStore.com
              <span className="sr-only"> (opens in new tab)</span>
            </a>{" "}
            brand.
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Rise Wellness callout, the recipe's canonical copy. Only the container and color classes are
 * swapped for Stream's palette and the app-name token (two places) reads Stream.WitUS. The
 * non-affiliation disclaimer is partner-vetted: do not edit its wording.
 */
function RiseWellnessCallout() {
  const accentLink =
    "inline-flex items-center min-h-7 rounded font-medium text-fuchsia-300 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400";

  return (
    <section
      aria-labelledby="rise-wellness-heading"
      className="mb-8 rounded-lg border border-fuchsia-900/60 bg-fuchsia-950/20 p-5 text-sm"
    >
      <header className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300">
          Mental health support
        </p>
        <h2 id="rise-wellness-heading" className="text-base font-semibold text-white">
          Rise Wellness of Indiana
        </h2>
        <p className="mt-0.5 text-xs text-neutral-400">
          Independent mental health provider · Not affiliated with Stream.WitUS
        </p>
      </header>

      <p className="leading-relaxed text-neutral-300">
        Rise Wellness of Indiana provides compassionate, personalized,
        holistic mental health care: evidence-based medicine, trauma-informed
        care, and a whole-person approach to help you heal, grow, and thrive
        in mind, body, and spirit.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Services</p>
          <ul className="space-y-0.5 text-xs text-neutral-300">
            <li>ADHD testing &amp; management (in-person and from home)</li>
            <li>Anxiety &amp; depression</li>
            <li>Maternal mental health</li>
            <li>Medication management</li>
            <li>GeneSight® genetic testing</li>
            <li>Behavioral therapy &amp; coaching</li>
            <li>Routine lab testing</li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Visit or call</p>
          <address className="text-xs not-italic leading-relaxed text-neutral-300">
            320 North Meridian Street<br />
            Indianapolis, IN 46204<br />
            Mon–Sat by appointment · Sun closed
          </address>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs">
            <a href="tel:+13179650299" className={accentLink}>
              317-965-0299
            </a>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <a href="https://risewellnessofindiana.com" target="_blank" rel="noopener noreferrer" className={accentLink}>
              risewellnessofindiana.com
              <span className="sr-only"> (opens in new tab)</span>
            </a>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <a
              href="https://www.centenarianos.com/safety#rise-wellness"
              target="_blank"
              rel="noopener noreferrer"
              className={accentLink}
            >
              Full safety page
              <span className="sr-only"> on centenarianos.com (opens in new tab)</span>
            </a>
          </div>
        </div>
      </div>

      <blockquote className="mt-4 border-l-2 border-fuchsia-700 pl-3 text-xs italic text-neutral-300">
        &ldquo;At Rise Wellness, we believe everyone has the capacity to rise
        above challenges and live a fulfilling, healthy life. Our care is
        guided by the belief that healing is personal, holistic, and rooted
        in compassion.&rdquo;
        <span className="mt-1 block not-italic text-neutral-400">
          Rise Wellness of Indiana
        </span>
      </blockquote>

      {/* === NON-NEGOTIABLE DISCLAIMER === Edit ONLY the app name token. */}
      <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
        Rise Wellness of Indiana is an independent organization. They are
        not affiliated with, employed by, or endorsed by Stream.WitUS,
        CentenarianOS, B4C LLC, AwesomeWebStore.com, or Anthony McDonald.
        We are grateful for their collaboration on mental health safety
        resources for our community.
      </p>
    </section>
  );
}
