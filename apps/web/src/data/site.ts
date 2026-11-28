/**
 * Site-wide facts in one place. Anything in [BRACKETS] is a placeholder the owner fills in before
 * launch; a production build fails while any is left (scripts/check-dist.mjs).
 */
export const site = {
  name: 'Altus',
  tagline: 'Track your month. Split the rest. An expense tracker for how India pays.',
  contactEmail: '[CONTACT EMAIL]',
  supportEmail: '[SUPPORT EMAIL]',
  pressEmail: '[PRESS EMAIL]',
  /** Stable short link the QR codes encode; a CloudFront Function sends it to the latest APK. */
  getPath: '/get',
  androidPackage: 'in.altus.app',
} as const;

export const nav = [
  { href: '/features', label: 'Features' },
  { href: '/compare', label: 'Compare' },
  { href: '/about', label: 'About' },
  { href: '/download', label: 'Download' },
] as const;

export const footerColumns = [
  {
    title: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/features#together', label: 'Split with friends' },
      { href: '/compare', label: 'Compare' },
      { href: '/compare#splitwise', label: 'Altus vs Splitwise' },
      { href: '/download', label: 'Download' },
      { href: '/download#iphone', label: 'iPhone waitlist' },
    ],
  },
  { title: 'Company', links: [{ href: '/about', label: 'About' }, { href: '/about#contact', label: 'Contact' }] },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms' },
      { href: '/sms-policy', label: 'SMS permission policy' },
      { href: '/account-deletion', label: 'Delete your account' },
    ],
  },
  { title: 'Help', links: [{ href: '/download#faq', label: 'FAQ' }] },
] as const;

/** Every indexable page, for the sitemap and the CloudFront routes list. */
export const pages = ['/', '/features', '/compare', '/about', '/download', '/privacy', '/terms', '/sms-policy', '/account-deletion'] as const;

/** Set PUBLIC_PRELAUNCH=1 to keep search engines out (robots Disallow and noindex) before launch. */
export const prelaunch = import.meta.env.PUBLIC_PRELAUNCH === '1';
