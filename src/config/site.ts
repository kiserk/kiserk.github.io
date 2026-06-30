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
  jobTitle: 'Biomaterials & Bioprocess Engineer',
  /** One-line value proposition shown on the homepage and used as default description. */
  tagline:
    'I build controlled biological systems — turning experimental biology into reliable, manufacturable processes across biomaterials, cultivation, custom sensing, and closed-loop control.',
  /** Longer bio for meta descriptions, sr-only text, and structured data. */
  bio:
    'I turn experimental biology into manufacturable processes. Co-inventor on aerial-mycelium cultivation IP and first author on peer-reviewed research, I design and build custom sensors and closed-loop control, develop cultivation processes, and transfer them to partner facilities in the U.S., Canada, and the Netherlands — taking direct control of partner lines during start-up and bringing material to commercial spec. Earlier, first-author quantitative-MRI research. Based in New York.',
  /** Status signal for recruiters / agents. Set to '' to hide. */
  openTo: 'Open to R&D and process-engineering roles building controlled biological systems — biomaterials, cultivation, sensing, and scale-up.',
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
    'Closed-loop control',
    'Cultivation systems',
    'Microcontroller programming',
    'Data pipelines',
    'Pilot-scale process development',
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
