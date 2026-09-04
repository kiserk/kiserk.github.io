/**
 * Everything the bot is allowed to know about Karl.
 *
 * Two halves, on purpose:
 *
 *  - Publications and identity/status are IMPORTED from the site's own data
 *    modules (`src/data/publications.ts`, `src/config/site.ts`). Those files
 *    have no Astro dependencies, so the Worker bundler can pull them in
 *    directly. Edit the site, redeploy the worker, the bot is current. In
 *    particular SITE.openTo — the single most recruiter-relevant field — can
 *    never go stale.
 *
 *  - NARRATIVE below is hand-authored, written *for the bot* rather than for
 *    display: Q&A-shaped, with explicit statements about what Karl has NOT
 *    done so the model has something concrete to say instead of guessing.
 *    Its sources are src/components/sections/CvSection.astro and
 *    src/components/sections/PatentsSection.astro. UPDATE IT WHEN THOSE CHANGE.
 */

import { journalArticles, conferenceAbstracts } from '../../src/data/publications';
import { SITE } from '../../src/config/site';

const NARRATIVE = `
## Who Karl is

Karl Kiser is a ${SITE.jobTitle} based in ${SITE.location.locality}, ${SITE.location.region}.
He builds controlled biological systems: taking experimental biology and turning it
into manufacturable, reproducible processes. His work spans biomaterials, cultivation
process development, custom sensing hardware, and closed-loop environmental control.
Before that he did first-author quantitative-MRI research. He describes himself as a
translator between lab experimentation, model-based analysis, and reliable production.

Contact: ${SITE.email}. LinkedIn: ${SITE.profiles.linkedin}.

## Current status

${SITE.openTo}

## Senior Scientist / Research Engineer — Ecovative Design, Green Island, NY (2022–2026)

- Co-inventor on a patent application covering growth media compositions and
  environmental conditions for improved aerial mycelium cultivation.
- Process development for aerial mycelium production: media optimization,
  environmental programming, and growth-condition tuning.
- Designed and built novel sensors for closed-loop system control — programming
  microcontrollers, wiring custom hardware, and integrating real-time sensing
  into the cultivation environment itself. This is hands-on hardware work, not
  just specifying instruments someone else builds.
- Contributed to a cultivation platform supporting 25 real-time environmental
  conditions and AI-model-informed process decisions.
- Deployed on site to domestic and international partner facilities — the
  Netherlands, Ontario (Canada), and Kennett Square, Pennsylvania — to transfer
  the cultivation process, control systems, and operations training. He often took
  direct control of partner production lines during start-up and troubleshooting
  rather than advising from a distance.
- Led the conversion of a partner site from agaricus mushroom production to full
  mycelium production within a year. Built data pipelines that fed partner
  operations into internal models, and brought the material to commercial spec.

## Research Associate — Department of Radiology, NYU Langone Health & Weill Cornell Medical College, New York, NY (2019–2022)

- First-author publications in Scientific Reports, Tomography, and NMR in
  Biomedicine on dynamic contrast-enhanced (DCE) MRI methods.
- Designed and ran quantitative experiments on tumor treatment response using
  active contrast encoding (ACE) MRI.
- Developed methods for cellular water exchange measurement, pharmacokinetic
  parameter estimation, and image texture analysis.
- Presented at ISMRM (International Society for Magnetic Resonance in Medicine)
  annual meetings.

## Education

${SITE.alumniOf.degree}, ${SITE.alumniOf.name} — Claremont, CA, 2016.

## Patent

"Growth Media Compositions and Growth Environmental Conditions for Improved
Aerial Mycelium." US publication 2024/0352400 A1 (application 18/642,656);
international WO 2024/226467 A1 (PCT). Priority applications 63/498,003,
63/505,675, 63/516,425. Filed April 22, 2024; published October 24, 2024.
Inventors: Jacob Michael Winiski and Karl John Kiser. Assignee: Ecovative LLC
(formerly Ecovative Design LLC), Green Island, NY.

The claims center on preparing mycelium growth media with defined nutrition
profiles and cultivating aerial mycelium under controlled temperature, CO2,
airflow, mist rate, mist composition, and related parameters. It covers both
pre-colonization and aerial-growth-phase optimization. The problem it addresses
is making aerial mycelium production more controllable, reproducible, and
scalable. It is a published application; note that a published application is
not the same as an issued patent.

## Skills, grouped as Karl groups them

Biomaterials and cultivation: aerial mycelium cultivation, fungal growth
optimization, media design, substrate optimization, environmental programming,
controlled-environment experimentation, pilot-scale process development.

Quantitative and analytical: experimental design (DOE), statistical analysis,
pharmacokinetic modeling, image texture analysis, data-driven process
optimization, reproducibility analysis.

Instrumentation and controls: sensor development, microcontroller programming,
hardware integration, closed-loop control, embedded systems, real-time data
acquisition.

Research and communication: scientific writing, peer-reviewed publication,
patent documentation, conference presentation, cross-functional collaboration,
technical translation.

## Scope boundaries — what the record does NOT show

These are here so you can answer honestly instead of guessing. If asked about
any of them, say plainly that it is not part of his documented experience, and
offer his email for anything the record does not cover.

- No GMP-regulated or pharmaceutical manufacturing experience is documented.
- No formal people-management or headcount-responsibility title is documented.
  His leadership shows up as leading a site conversion and running partner
  start-ups, not as a management title.
- Degrees: a B.A. in Biophysics. No graduate degree is listed.
- The site does not state salary expectations, visa or work-authorization
  status, notice period, or willingness to relocate.
- No public GitHub, ORCID, or Google Scholar profile is listed on the site.
- Software work shown is scientific and embedded — microcontrollers, data
  pipelines, analysis. There is no record of web, application, or
  production-software engineering.

## Where things live on the site

- / — homepage overview
- /cv — full CV and timeline, with a PDF download
- /projects — selected projects
- /publications — journal articles and conference abstracts
- /patents — the patent above, in full
- /contact — a contact form
`.trim();

function publicationsSection(): string {
  const journals = journalArticles
    .map(
      (p) =>
        `- ${p.firstAuthor ? '[first author] ' : ''}"${p.title}" — ${p.journal} ${p.volume}, ${p.year}. Authors: ${p.authors.join(', ')}. DOI: ${p.doi}`
    )
    .join('\n');

  const abstracts = conferenceAbstracts
    .map(
      (a) =>
        `- ${a.firstAuthor ? '[first author] ' : ''}"${a.title}" — ISMRM ${a.year}. Authors: ${a.authors.join(', ')}`
    )
    .join('\n');

  return [
    `## Peer-reviewed journal articles (${journalArticles.length})`,
    journals,
    '',
    `## Conference abstracts, ISMRM (${conferenceAbstracts.length})`,
    abstracts,
  ].join('\n');
}

function keywordsSection(): string {
  return ['## Keywords Karl lists for himself', SITE.knowsAbout.join(', ') + '.'].join('\n');
}

export const CORPUS = [NARRATIVE, '', publicationsSection(), '', keywordsSection()].join('\n');
