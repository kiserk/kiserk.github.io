export interface JournalArticle {
  title: string;
  authors: string[];
  journal: string;
  volume: string;
  year: number;
  doi: string;
  firstAuthor: boolean;
  thumbnail?: string;
  thumbnailAlt?: string;
}

export interface ConferenceAbstract {
  title: string;
  authors: string[];
  year: number;
  firstAuthor: boolean;
}

export const journalArticles: JournalArticle[] = [
  {
    title: 'Evaluation of cellular water exchange in a mouse glioma model using dynamic contrast-enhanced MRI with two flip angles',
    authors: ['Karl Kiser', 'Jin Zhang', 'Ayesha Bharadwaj Das', 'James A. Tranos', 'Youssef Zaim Wadghiri', 'Sungheon Gene Kim'],
    journal: 'Scientific Reports',
    volume: '13(1), 3007',
    year: 2023,
    doi: 'https://doi.org/10.1038/s41598-023-29991-1',
    firstAuthor: true,
    thumbnail: '/images/cellular-water-exchange-thumbnail.png',
    thumbnailAlt: 'Fused PET/MRI sagittal view of a mouse glioma with an arrow marking the tumor',
  },
  {
    title: 'Textural Features of Mouse Glioma Models Measured by Dynamic Contrast-Enhanced MR Images with 3D Isotropic Resolution',
    authors: ['Karl Kiser', 'Jin Zhang', 'Sungheon Gene Kim'],
    journal: 'Tomography',
    volume: '9(2), 721–735',
    year: 2023,
    doi: 'https://doi.org/10.3390/tomography9020058',
    firstAuthor: true,
    thumbnail: '/images/tomography-thumbnail.png',
    thumbnailAlt: 'Volumetric DCE-MRI intracellular water lifetime (tau_i) map of a mouse glioma at 3D isotropic resolution',
  },
  {
    title: 'Simultaneous estimation of the cellular water exchange rate, intracellular volume fraction, and longitudinal relaxation rate in cancer cells',
    authors: ['Karl Kiser', 'Jin Zhang', 'Sawwal Qayyum', 'W. C. Bracken', 'Sungheon Gene Kim'],
    journal: 'NMR in Biomedicine',
    volume: '36(7), e4914',
    year: 2023,
    doi: 'https://doi.org/10.1002/nbm.4914',
    firstAuthor: true,
  },
  {
    title: 'Assessment of tumor treatment response using active contrast encoding (ACE)-MRI: Comparison with conventional DCE-MRI',
    authors: ['Jin Zhang', 'Kerryanne Winters', 'Karl Kiser', 'Mehran Baboli', 'Sungheon Gene Kim'],
    journal: 'PLoS ONE',
    volume: '15(6), e0234520',
    year: 2020,
    doi: 'https://doi.org/10.1371/journal.pone.0234520',
    firstAuthor: false,
    thumbnail: '/images/treatment-response-thumbnail.png',
    thumbnailAlt: 'Pre-treatment and post-treatment parameter maps of a tumor showing treatment response',
  },
];

export const conferenceAbstracts: ConferenceAbstract[] = [
  {
    title: 'Tumor intracellular water residence time measured by DCE-MRI negatively correlates with the standard uptake value of 18F-FDG-PET',
    authors: ['Karl Kiser', 'Jin Zhang', 'S. Gene Kim'],
    year: 2021,
    firstAuthor: true,
  },
  {
    title: 'Significance of 3D Isotropic Resolution for Image Texture Analysis of Pharmacokinetic Model Parametric Maps',
    authors: ['Karl Kiser', 'Jin Zhang', 'S. Gene Kim'],
    year: 2021,
    firstAuthor: true,
  },
  {
    title: 'Whole tumor pharmacokinetic model analysis with 3D isotropic high resolution using 3D-UTE-GRASP sequence at 7T',
    authors: ['Jin Zhang', 'Karl Kiser', 'Chongda Zhang', 'Ayesha Bharadwaj Das', 'Sungheon Gene Kim'],
    year: 2020,
    firstAuthor: false,
  },
  {
    title: 'Fast 3D T1 mapping with isotropic high resolution using ultrashort TE MRI',
    authors: ['Jin Zhang', 'Karl Kiser', 'Sungheon Gene Kim'],
    year: 2020,
    firstAuthor: false,
  },
  {
    title: 'Comparison of tumor cellular-interstitial water exchange rates measured by DCE-MRI and diffusion time-dependent diffusion kurtosis imaging',
    authors: ['Jin Zhang', 'Karl Kiser', 'Ayesha Bharadwaj Das', 'Chongda Zhang', 'Sungheon Gene Kim'],
    year: 2020,
    firstAuthor: false,
  },
  {
    title: 'Repeatability of contrast kinetic parameters of whole tumor with isotropic resolution measured by 3D-UTE-GRASP method',
    authors: ['Jin Zhang', 'Ayesha Bharadwaj Das', 'James Tranos', 'Karl Kiser', 'Youssef Zaim Wadghiri', 'Gene Kim'],
    year: 2021,
    firstAuthor: false,
  },
  {
    title: 'Simultaneous estimation of longitudinal relaxation time and intracellular water lifetime using Active Contrast Encoding MRI',
    authors: ['Jin Zhang', 'Karl Kiser', 'Ayesha Bharadwaj Das', 'Sawwal Qayyum', 'Gene Kim'],
    year: 2022,
    firstAuthor: false,
  },
  {
    title: 'Assessment of subtle BBB disruption using Focused Ultrasound: comparison between the contrast agent exchange rate and the water exchange rate',
    authors: ['Jonghyun Bae', 'Jin Zhang', 'Mihaela Stavarache', 'Ayesha Das', 'Sawwal Qayyum', 'Karl Kiser', 'Sungheon Gene Kim'],
    year: 2022,
    firstAuthor: false,
  },
];

export function formatAuthors(authors: string[]): string {
  return authors
    .map((name) =>
      name === 'Karl Kiser'
        ? `<strong style="color: var(--ink); font-weight: 600;">${name}</strong>`
        : name
    )
    .join(', ');
}

export const articleSchemas = journalArticles.map((pub) => ({
  '@context': 'https://schema.org',
  '@type': 'ScholarlyArticle',
  headline: pub.title,
  name: pub.title,
  author: pub.authors.map((name) => ({ '@type': 'Person', name })),
  isPartOf: { '@type': 'Periodical', name: pub.journal },
  datePublished: String(pub.year),
  ...(pub.doi ? { sameAs: pub.doi, identifier: pub.doi } : {}),
  ...(pub.thumbnail ? { image: new URL(pub.thumbnail, 'https://karlkiser.com').href } : {}),
}));
