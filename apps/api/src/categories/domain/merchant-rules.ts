/**
 * Global merchant rules: Indian merchants and UPI handles → system category key.
 * Patterns are in merchantKey() form and match whole words anywhere in the merchant name or
 * narration. Brands beat generic words ("FASTAG RECHARGE" is Transport), and within each group
 * longer patterns are tried first ("AMAZON PRIME" before "AMAZON").
 * Grows from the category_corrections log: the most-corrected merchants get added here.
 */
export interface MerchantRuleEntry {
  category: string;
  /** Brand names and UPI handles; always tried before any generic word. */
  patterns: string[];
  /** Generic words ("PHARMACY", "RECHARGE"), used only when no brand matched. */
  generic?: string[];
}

export const MERCHANT_RULES: readonly MerchantRuleEntry[] = [
  {
    category: 'food_dining',
    patterns: [
      'SWIGGY', 'ZOMATO', 'EATSURE', 'DOMINOS', 'DOMINO S', 'PIZZA HUT', 'KFC', 'MCDONALDS', 'MC DONALDS', 'BURGER KING',
      'SUBWAY', 'STARBUCKS', 'CAFE COFFEE DAY', 'CCD', 'CHAAYOS', 'THIRD WAVE', 'BLUE TOKAI', 'HALDIRAM', 'HALDIRAMS',
      'BARBEQUE NATION', 'WOW MOMO', 'FAASOS', 'BEHROUZ', 'BOX8', 'FRESHMENU', 'CHAI POINT', 'BIRYANI BLUES', 'PARADISE',
      'MAGICPIN', 'DINEOUT', 'EAZYDINER', 'BASKIN ROBBINS', 'NATURALS ICE CREAM', 'THEOBROMA',
    ],
    generic: ['RESTAURANT', 'DHABA'],
  },
  {
    category: 'groceries',
    patterns: [
      'BLINKIT', 'GROFERS', 'ZEPTO', 'BIGBASKET', 'BIG BASKET', 'BB NOW', 'SWIGGY INSTAMART', 'INSTAMART', 'DMART', 'D MART',
      'AVENUE SUPERMARTS', 'JIOMART', 'RELIANCE FRESH', 'RELIANCE SMART', 'MORE RETAIL', 'MORE SUPERMARKET', 'SPENCERS',
      'NATURES BASKET', 'STAR BAZAAR', 'LICIOUS', 'FRESHTOHOME', 'COUNTRY DELIGHT', 'MILKBASKET', 'DUNZO', 'RATNADEEP', 'FLIPKART MINUTES',
    ],
    generic: ['KIRANA', 'SUPERMARKET'],
  },
  {
    category: 'transport',
    patterns: [
      'UBER', 'OLA', 'OLACABS', 'ANI TECHNOLOGIES', 'RAPIDO', 'BLUSMART', 'NAMMA YATRI', 'YULU', 'BOUNCE', 'METRO RAIL',
      'DMRC', 'BMRCL', 'MMRDA', 'FASTAG', 'NETC', 'INDIAN OIL', 'IOCL', 'BHARAT PETROLEUM', 'BPCL', 'HPCL',
      'HINDUSTAN PETROLEUM', 'SHELL', 'QUICKRIDE',
    ],
    generic: ['PETROL', 'FUEL', 'PARKING'],
  },
  {
    category: 'shopping',
    patterns: [
      'AMAZON', 'AMZN', 'FLIPKART', 'MYNTRA', 'AJIO', 'MEESHO', 'NYKAA', 'TATA CLIQ', 'SNAPDEAL', 'SHOPPERS STOP',
      'LIFESTYLE', 'PANTALOONS', 'WESTSIDE', 'ZARA', 'H M', 'UNIQLO', 'DECATHLON', 'IKEA', 'CROMA', 'RELIANCE DIGITAL',
      'VIJAY SALES', 'LENSKART', 'FIRSTCRY', 'PEPPERFRY', 'URBAN LADDER', 'BOAT', 'TANISHQ', 'TITAN', 'PURPLLE', 'MAX FASHION',
    ],
  },
  {
    category: 'bills_utilities',
    patterns: [
      'BESCOM', 'TATA POWER', 'ADANI ELECTRICITY', 'MSEDCL', 'BSES', 'TNEB', 'TANGEDCO', 'CESC', 'KSEB', 'TSSPDCL', 'APSPDCL', 'AIRTEL', 'JIO', 'RELIANCE JIO', 'VODAFONE', 'VI', 'BSNL', 'ACT FIBERNET', 'ACT', 'HATHWAY', 'TATA PLAY',
      'DISH TV', 'D2H', 'SUN DIRECT', 'MAHANAGAR GAS', 'IGL', 'INDRAPRASTHA GAS', 'GUJARAT GAS', 'BHARATGAS', 'INDANE', 'HP GAS', 'BWSSB',
    ],
    generic: ['ELECTRICITY', 'WATER BOARD', 'BROADBAND', 'RECHARGE', 'BBPS', 'BILLDESK'],
  },
  {
    category: 'rent',
    patterns: ['NOBROKER', 'NESTAWAY', 'HOUSING COM', 'STANZA LIVING', 'ZOLO', 'COLIVE'],
  },
  {
    category: 'entertainment',
    patterns: [
      'NETFLIX', 'SPOTIFY', 'AMAZON PRIME', 'PRIME VIDEO', 'HOTSTAR', 'DISNEY', 'JIOCINEMA', 'JIOHOTSTAR', 'SONYLIV', 'ZEE5',
      'YOUTUBE', 'GOOGLE PLAY', 'APPLE COM BILL', 'APPLE MEDIA', 'GAANA', 'JIOSAAVN', 'WYNK', 'BOOKMYSHOW', 'PVR', 'INOX',
      'CINEPOLIS', 'DISTRICT', 'PAYTM INSIDER', 'STEAM', 'PLAYSTATION', 'XBOX', 'DREAM11', 'AUDIBLE',
    ],
  },
  {
    category: 'health',
    patterns: [
      'APOLLO', 'APOLLO PHARMACY', 'PHARMEASY', 'NETMEDS', 'TATA 1MG', '1MG', 'MEDPLUS', 'WELLNESS FOREVER', 'PRACTO',
      'CULT FIT', 'CULTFIT', 'CURE FIT', 'HEALTHIFYME', 'FORTIS', 'MANIPAL HOSPITAL', 'MAX HEALTHCARE', 'NARAYANA',
      'DR LAL PATHLABS', 'THYROCARE', 'METROPOLIS',
    ],
    generic: ['PHARMACY', 'MEDICAL', 'HOSPITAL', 'CLINIC', 'DIAGNOSTIC'],
  },
  {
    category: 'education',
    patterns: [
      'BYJUS', 'UNACADEMY', 'VEDANTU', 'PHYSICSWALLAH', 'UPGRAD', 'COURSERA', 'UDEMY', 'SIMPLILEARN', 'GREAT LEARNING',
      'SCALER', 'DUOLINGO',
    ],
    generic: ['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'TUITION'],
  },
  {
    category: 'travel',
    patterns: [
      'IRCTC', 'MAKEMYTRIP', 'MAKE MY TRIP', 'GOIBIBO', 'CLEARTRIP', 'YATRA', 'EASEMYTRIP', 'IXIGO', 'REDBUS', 'ABHIBUS',
      'INDIGO', 'INTERGLOBE', 'AIR INDIA', 'AKASA', 'SPICEJET', 'VISTARA', 'OYO', 'AIRBNB', 'BOOKING COM', 'AGODA',
      'TAJ HOTELS', 'TREEBO', 'FABHOTELS', 'ZOOMCAR',
    ],
  },
  {
    category: 'transfers',
    patterns: ['CRED', 'CC BILL', 'CREDIT CARD BILL', 'CARD PAYMENT', 'SELF TRANSFER', 'OWN ACCOUNT'],
  },
];
