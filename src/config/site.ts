/**
 * Central site identity + SEO config.
 *
 * Edit values here once and they propagate to meta tags, JSON-LD structured
 * data (what recruiting/AI agents read), and the homepage copy.
 */

export const SITE = {
  url: 'https://karlkiser.com',
  name: 'Karl Kiser',
  /** Short role line used in titles and the Person schema jobTitle. */
  jobTitle: 'Biomaterials & R&D Engineer',
  /** One-line value proposition shown on the homepage and used as default description. */
  tagline:
    'Biomaterials and R&D engineer — bioprocess development, controls and instrumentation, and quantitative imaging.',
  /** Longer bio for meta descriptions, sr-only text, and structured data. */
  bio:
    'Applied biomaterials scientist and research engineer. Co-inventor on aerial-mycelium cultivation IP and first author on peer-reviewed quantitative-MRI research. I translate lab experimentation into model-based analysis and manufacturable process improvement across bioprocess development, sensor and control-system design, and data-driven optimization.',
  /** Status signal for recruiters / agents. Set to '' to hide. */
  openTo: 'Open to R&D, process engineering, and applied-science roles in biomaterials and biotech.',
  email: 'karl.j.kiser@gmail.com',
  location: {
    locality: 'New York',
    region: 'NY',
    country: 'US',
  },
  /** og:image lives in /public. 1200x630 recommended. */
  ogImage: '/og-image.png',
  /**
   * Keywords agents match on. Keep specific and honest.
   */
  knowsAbout: [
    'Biomaterials',
    'Mycelium cultivation',
    'Bioprocess development',
    'Process development',
    'Sensor development',
    'Control systems',
    'Embedded systems',
    'Quantitative MRI',
    'Pharmacokinetic modeling',
    'Design of experiments',
    'Technology transfer',
    'Scale-up',
  ],
  alumniOf: {
    name: 'Pitzer College',
    degree: 'B.A. in Biophysics',
  },
  /**
   * Profile links. Used for the Person `sameAs` array (a strong signal for
   * agents) and the visible links on the homepage.
   * Leave a value as '' and it is omitted everywhere automatically.
   */
  profiles: {
    linkedin: 'https://linkedin.com/in/karlkiser',
    // TODO: add when available — both are high-value researcher signals.
    orcid: '',
    googleScholar: '',
    github: '',
  },
  /**
   * GoatCounter analytics (free, privacy-first, cookieless).
   * 1. Sign up at https://www.goatcounter.com and pick a code (subdomain).
   * 2. Put that code here. Leave '' to disable analytics entirely.
   */
  goatCounterCode: 'karlkiser',
  /**
   * Web3Forms access key for the /contact form (free, no backend needed).
   * 1. Go to https://web3forms.com, enter karl.j.kiser@gmail.com, and they email
   *    you an access key (a UUID). It is safe to commit — it's a public key tied
   *    only to your delivery email, not a secret.
   * 2. Paste it here. Leave '' and the contact form shows a "not configured yet"
   *    notice instead of submitting.
   */
  web3formsKey: '',
} as const;

/** Profile URLs that are actually set, for `sameAs` and link lists. */
export const PROFILE_LINKS = Object.values(SITE.profiles).filter(Boolean);

export type SeoProps = {
  title?: string;
  description?: string;
  /** Path of the current page, e.g. "/cv". Used for canonical + og:url. */
  path?: string;
  ogImage?: string;
  /** JSON-LD objects to embed in <head>. */
  jsonLd?: Record<string, unknown>[];
  noindex?: boolean;
};
