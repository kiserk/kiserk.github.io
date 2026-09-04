/**
 * Hand-written answers used when MOCK=1, so the widget can be evaluated for
 * real without an API key.
 *
 * These are drafted to the same rules the live system prompt enforces: 2-4
 * sentences, third person, concrete over enthusiastic, a pointer to the
 * relevant page, and honest about what the record does not contain. They are a
 * reference for what *should* come back — not a recording of what the model
 * actually said. Treat them as a design target, not a guarantee.
 *
 * Matching is deliberately dumb keyword scoring. A question that matches
 * nothing falls through to NO_MATCH, which is itself worth testing: it is the
 * behaviour a visitor gets when they ask about something outside the corpus.
 */

export interface Fixture {
  /** Lowercase substrings; the fixture with the most hits wins. */
  keys: string[];
  reply: string;
}

export const NO_MATCH =
  "That's not something I have on hand — Karl can answer directly at karl.j.kiser@gmail.com. " +
  'I can tell you about his cultivation and bioprocess work, the sensors and control systems he built, ' +
  'his publications, or the aerial-mycelium patent.';

export const FIXTURES: Fixture[] = [
  {
    keys: ['cultivation', 'mycelium', 'fungal', 'growing', 'grow', 'substrate', 'media'],
    reply:
      'Karl spent 2022–2026 at Ecovative Design on aerial mycelium production — media optimization, environmental programming, and growth-condition tuning. He is co-inventor on a patent application covering growth media compositions and the environmental conditions that go with them, and he contributed to a cultivation platform running 25 real-time environmental conditions. The CV page has the full timeline.',
  },
  {
    keys: ['tech transfer', 'transfer', 'partner', 'netherlands', 'canada', 'pennsylvania', 'scale-up', 'scale up', 'commission'],
    reply:
      'Yes. He deployed on site to partner facilities in the Netherlands, Ontario, and Pennsylvania to transfer the cultivation process, control systems, and operations training, and he often took direct control of partner lines during start-up and troubleshooting rather than advising remotely. He also led one partner site\'s conversion from agaricus mushroom production to full mycelium production inside a year, and brought that material to commercial spec.',
  },
  {
    keys: ['sensor', 'hardware', 'microcontroller', 'embedded', 'control system', 'closed-loop', 'closed loop', 'instrument', 'electronics'],
    reply:
      'He designed and built custom sensors for closed-loop control — programming the microcontrollers, wiring the hardware, and integrating real-time sensing into the cultivation environment itself. That work fed a platform tracking 25 environmental conditions, and he built the data pipelines that pulled partner-site operations into internal models. The CV page lists the instrumentation and controls skills in full.',
  },
  {
    keys: ['publish', 'publication', 'paper', 'journal', 'research', 'author', 'ismrm', 'scientific reports'],
    reply:
      'Four peer-reviewed journal articles, first author on three of them: Scientific Reports and Tomography in 2023 on dynamic contrast-enhanced MRI methods, plus NMR in Biomedicine on simultaneous estimation of cellular water exchange. There are also eight ISMRM conference abstracts. The Publications page has every title with DOIs.',
  },
  {
    keys: ['patent', 'ip', 'invention', 'inventor', 'intellectual property'],
    reply:
      'He is co-inventor with Jacob Michael Winiski on "Growth Media Compositions and Growth Environmental Conditions for Improved Aerial Mycelium" — US 2024/0352400 A1, with a PCT counterpart, assigned to Ecovative. The claims cover growth media with defined nutrition profiles plus cultivation under controlled temperature, CO2, airflow, and mist parameters. Worth noting it is a published application rather than an issued patent; the Patents page has the filing details.',
  },
  {
    keys: ['mri', 'imaging', 'radiology', 'nyu', 'cornell', 'medical', 'tumor', 'cancer', 'before', 'earlier', 'previous'],
    reply:
      'From 2019 to 2022 he was a Research Associate in Radiology at NYU Langone and Weill Cornell, doing quantitative MRI work. He designed and ran experiments on tumor treatment response using active contrast encoding MRI, and developed methods for cellular water exchange measurement, pharmacokinetic parameter estimation, and image texture analysis. See the Publications page for the output from that period.',
  },
  {
    keys: ['school', 'degree', 'education', 'university', 'college', 'phd', 'masters', 'studied'],
    reply:
      'A B.A. in Biophysics from Pitzer College, 2016. No graduate degree is listed on the site.',
  },
  {
    keys: ['manage', 'management', 'lead', 'led', 'team', 'report', 'headcount', 'supervis'],
    reply:
      "The record doesn't show a formal people-management title or headcount responsibility. What it does show is leading a partner site's conversion from agaricus to full mycelium production within a year, and taking direct control of partner lines during start-up. If you need specifics on team structure, Karl can answer at karl.j.kiser@gmail.com.",
  },
  {
    keys: ['gmp', 'pharma', 'regulated', 'fda', 'clinical', 'validation'],
    reply:
      "GMP-regulated or pharmaceutical manufacturing isn't part of his documented experience. His process work is in biomaterials and cultivation at pilot and commercial scale. Karl can speak to how that transfers at karl.j.kiser@gmail.com.",
  },
  {
    keys: ['salary', 'compensation', 'pay', 'rate', 'visa', 'sponsor', 'relocat', 'notice period', 'available', 'start date'],
    reply:
      "I don't have anything on compensation, work authorization, or availability — that's a direct conversation. Karl is open to R&D and process-engineering roles and can be reached at karl.j.kiser@gmail.com.",
  },
  {
    keys: ['good fit', 'right fit', 'suitable', 'would he be', 'is he a fit', 'should we hire', 'qualified for'],
    reply:
      "I'm not the right judge of fit for a specific role. What I can do is lay out the relevant record — bioprocess and cultivation development, custom sensing and closed-loop control, tech transfer to three international partner sites, and first-author quantitative research — and let you weigh it. Tell me which parts matter for the role and I'll be specific.",
  },
  {
    keys: ['contact', 'email', 'reach', 'get in touch', 'linkedin', 'hire him', 'talk to'],
    reply:
      'Email is karl.j.kiser@gmail.com, and there is a contact form on the Contact page. He is also on LinkedIn at linkedin.com/in/karlkiser.',
  },
  {
    keys: ['looking for', 'open to', 'job search', 'new role', 'opportunit', 'seeking'],
    reply:
      'He is open to R&D and process-engineering roles building controlled biological systems — biomaterials, cultivation, sensing, and scale-up. The CV page covers the background behind that; email karl.j.kiser@gmail.com to start a conversation.',
  },
  {
    keys: ['weakness', 'gap', 'lacking', 'missing', 'not done', "doesn't have", 'downside'],
    reply:
      "Straight answer: no GMP or pharmaceutical manufacturing, no formal people-management title, no graduate degree, and no web or production-software engineering — his software work is embedded and scientific. What's there is bioprocess development, custom instrumentation and control, tech transfer, and peer-reviewed research.",
  },
  {
    keys: ['python', 'write code', 'script', 'recipe', 'poem', 'weather', 'joke', 'help me with', 'translate'],
    reply:
      "That's outside what I do here — I only cover Karl's professional background. Happy to answer something about his cultivation work, the sensors he built, or his publications.",
  },
  {
    keys: ['ignore', 'system prompt', 'your instructions', 'prompt', 'reveal', 'disregard', 'you are now', 'pretend'],
    reply:
      "I'll stick to what I'm here for, which is Karl's professional background. Ask me about his roles, projects, publications, or the patent.",
  },
];

/** Best-scoring fixture, or null when nothing matches well enough. */
export function matchFixture(question: string): string | null {
  const q = question.toLowerCase();
  let best: { score: number; reply: string } | null = null;

  for (const fixture of FIXTURES) {
    const score = fixture.keys.reduce((n, key) => (q.includes(key) ? n + 1 : n), 0);
    if (score > 0 && (!best || score > best.score)) {
      best = { score, reply: fixture.reply };
    }
  }

  return best ? best.reply : null;
}
