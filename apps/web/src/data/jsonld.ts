import { faq } from './faq';
import { apk } from './release';

/** Structured data (schema.org). No ratings or prices until they exist. */
export function softwareApplication(site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Altus',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Android 7.0 or later',
    description:
      'An expense tracker app for India that reads your bank SMS and statements, counts every payment once, shows what you can spend today, and splits bills with friends.',
    url: site.toString(),
    downloadUrl: new URL('/download', site).toString(),
    ...(apk.versionName ? { softwareVersion: apk.versionName } : {}),
    featureList: [
      'Bank SMS capture for HDFC, ICICI, SBI and Axis, read on the phone',
      'CSV, Excel and PDF statement import, including password-protected PDFs',
      'Duplicate detection across SMS, statements and manual entries',
      'Daily spending allowance, budgets and savings goals',
      'Split expenses with friends, equally or by exact amounts',
    ],
  };
}

export function organization(site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Altus',
    url: site.toString(),
    logo: new URL('/apple-touch-icon.png', site).toString(),
  };
}

export function faqPage() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

export function breadcrumbs(site: URL, name: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', site).toString() },
      { '@type': 'ListItem', position: 2, name, item: new URL(path, site).toString() },
    ],
  };
}
