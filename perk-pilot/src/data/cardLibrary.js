// Starter library of popular US cards and their headline perks.
//
// IMPORTANT: Issuers change benefits often, and there is no official public API
// for them. This is a *curated, versioned* catalog (approximate public info as
// of the date below) — not a live scrape. The app lets the user edit/add/remove
// benefits freely, and when this catalog is updated (a new app release bumps
// `version` on a card), the app shows the user a diff and asks, item by item,
// whether to apply each change. Nothing is ever changed without confirmation.
// Always verify against the issuer's official site.

// Bump when any template changes so clients can detect updates.
export const CATALOG_VERSION = 1
export const CARD_LIBRARY_AS_OF = '2026-05'

export const ISSUERS = [
  'American Express',
  'Capital One',
  'Chase',
  'Citi',
  'Bank of America',
  'U.S. Bank',
  'Wells Fargo',
  'Other'
]

export const CARD_TYPES = ['personal', 'business', 'cobranded']

// Benefit shape:
//   { key, name, value, cadence, resetBasis, trackingMode, category, note }
//   key:          stable slug, unique within a card — used to diff across versions
//   cadence:      monthly|quarterly|semiannual|annual|one_time
//   resetBasis:   calendar|anniversary
//   trackingMode: amount (partial $ tracking) | check (used / not)
const A = 'American Express'

export const CARD_LIBRARY = [
  {
    id: 'amex-platinum',
    issuer: A,
    name: 'The Platinum Card',
    type: 'personal',
    network: 'Amex',
    annualFee: 695,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Flights booked direct / Amex Travel', rate: 5 },
      { category: 'Prepaid hotels via Amex Travel', rate: 5 },
      { category: 'Everything else', rate: 1 }
    ],
    benefits: [
      { key: 'uber-cash', name: 'Uber Cash', value: 15, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'travel', note: '$15/mo + $20 bonus in December (US Uber/Uber Eats)' },
      { key: 'digital-ent', name: 'Digital Entertainment credit', value: 20, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'entertainment', note: 'Select services (Disney+, Hulu, NYT, etc.)' },
      { key: 'walmart-plus', name: 'Walmart+ membership', value: 12.95, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'retail' },
      { key: 'airline-fee', name: 'Airline fee credit', value: 200, cadence: 'annual', resetBasis: 'calendar', trackingMode: 'amount', category: 'travel', note: 'Incidental fees on one selected airline' },
      { key: 'hotel-credit', name: 'Hotel credit (FHR / THC)', value: 200, cadence: 'annual', resetBasis: 'calendar', trackingMode: 'amount', category: 'travel', note: 'Prepaid Fine Hotels + Resorts / The Hotel Collection (2+ nights)' },
      { key: 'saks', name: 'Saks Fifth Avenue credit', value: 50, cadence: 'semiannual', resetBasis: 'calendar', trackingMode: 'amount', category: 'retail', note: '$50 Jan–Jun and $50 Jul–Dec' },
      { key: 'clear', name: 'CLEAR Plus credit', value: 209, cadence: 'annual', resetBasis: 'calendar', trackingMode: 'amount', category: 'travel' },
      { key: 'equinox', name: 'Equinox credit', value: 300, cadence: 'annual', resetBasis: 'calendar', trackingMode: 'amount', category: 'wellness' }
    ]
  },
  {
    id: 'amex-gold',
    issuer: A,
    name: 'American Express Gold Card',
    type: 'personal',
    network: 'Amex',
    annualFee: 325,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Restaurants worldwide', rate: 4 },
      { category: 'U.S. supermarkets (up to $25k/yr)', rate: 4 },
      { category: 'Flights booked direct / Amex Travel', rate: 3 },
      { category: 'Everything else', rate: 1 }
    ],
    benefits: [
      { key: 'dining', name: 'Dining credit', value: 10, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'dining', note: 'Grubhub, Cheesecake Factory, Goldbelly, Wine.com, Five Guys, etc.' },
      { key: 'uber-cash', name: 'Uber Cash', value: 10, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'travel' },
      { key: 'dunkin', name: 'Dunkin credit', value: 7, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'dining' },
      { key: 'resy', name: 'Resy dining credit', value: 50, cadence: 'semiannual', resetBasis: 'calendar', trackingMode: 'amount', category: 'dining' }
    ]
  },
  {
    id: 'amex-green',
    issuer: A,
    name: 'American Express Green Card',
    type: 'personal',
    network: 'Amex',
    annualFee: 150,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Travel (incl. transit)', rate: 3 },
      { category: 'Restaurants worldwide', rate: 3 },
      { category: 'Everything else', rate: 1 }
    ],
    benefits: [
      { key: 'clear', name: 'CLEAR Plus credit', value: 209, cadence: 'annual', resetBasis: 'calendar', trackingMode: 'amount', category: 'travel' }
    ]
  },
  {
    id: 'amex-blue-cash-preferred',
    issuer: A,
    name: 'Blue Cash Preferred',
    type: 'personal',
    network: 'Amex',
    annualFee: 95,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'U.S. supermarkets (up to $6k/yr)', rate: 6 },
      { category: 'Select U.S. streaming', rate: 6 },
      { category: 'U.S. gas & transit', rate: 3 },
      { category: 'Everything else', rate: 1 }
    ],
    benefits: [
      { key: 'disney-bundle', name: 'Disney Bundle credit', value: 7, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'entertainment', note: 'After $9.99+ Disney Bundle auto-renewal' }
    ]
  },
  {
    id: 'amex-biz-platinum',
    issuer: A,
    name: 'Business Platinum Card',
    type: 'business',
    network: 'Amex',
    annualFee: 695,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Flights & prepaid hotels via Amex Travel', rate: 5 },
      { category: 'Purchases $5k+ (up to $2M/yr)', rate: 1.5 },
      { category: 'Everything else', rate: 1 }
    ],
    benefits: [
      { key: 'dell', name: 'Dell credit', value: 200, cadence: 'semiannual', resetBasis: 'calendar', trackingMode: 'amount', category: 'retail', note: '$200 Jan–Jun and $200 Jul–Dec' },
      { key: 'wireless', name: 'Wireless / phone credit', value: 10, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'statement_credit' },
      { key: 'indeed', name: 'Indeed credit', value: 90, cadence: 'quarterly', resetBasis: 'calendar', trackingMode: 'amount', category: 'business' },
      { key: 'adobe', name: 'Adobe credit', value: 150, cadence: 'annual', resetBasis: 'calendar', trackingMode: 'amount', category: 'business' },
      { key: 'clear', name: 'CLEAR Plus credit', value: 209, cadence: 'annual', resetBasis: 'calendar', trackingMode: 'amount', category: 'travel' }
    ]
  },
  {
    id: 'amex-biz-gold',
    issuer: A,
    name: 'Business Gold Card',
    type: 'business',
    network: 'Amex',
    annualFee: 375,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Top 2 eligible categories (up to $150k/yr)', rate: 4 },
      { category: 'Flights & prepaid hotels via Amex Travel', rate: 3 },
      { category: 'Everything else', rate: 1 }
    ],
    benefits: [
      { key: 'flexible-biz', name: 'FedEx / office / shipping credit', value: 20, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'business' },
      { key: 'walmart-plus', name: 'Walmart+ membership', value: 12.95, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'retail' }
    ]
  },
  {
    id: 'amex-marriott-brilliant',
    issuer: A,
    name: 'Marriott Bonvoy Brilliant',
    type: 'cobranded',
    network: 'Amex',
    annualFee: 650,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Marriott Bonvoy hotels', rate: 6 },
      { category: 'Restaurants & flights booked direct', rate: 3 },
      { category: 'Everything else', rate: 2 }
    ],
    benefits: [
      { key: 'dining', name: 'Dining credit', value: 25, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'dining' },
      { key: 'free-night', name: 'Free Night Award (up to 85k pts)', value: 0, cadence: 'annual', resetBasis: 'anniversary', trackingMode: 'check', category: 'free_night', note: 'After card renewal each year' }
    ]
  },
  {
    id: 'amex-delta-reserve',
    issuer: A,
    name: 'Delta SkyMiles Reserve',
    type: 'cobranded',
    network: 'Amex',
    annualFee: 650,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Delta purchases', rate: 3 },
      { category: 'Everything else', rate: 1 }
    ],
    benefits: [
      { key: 'resy', name: 'Resy dining credit', value: 20, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'dining' },
      { key: 'rideshare', name: 'Rideshare credit', value: 10, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'travel' },
      { key: 'companion', name: 'Companion Certificate', value: 0, cadence: 'annual', resetBasis: 'anniversary', trackingMode: 'check', category: 'travel', note: 'Domestic First / Comfort+ / Main Cabin' }
    ]
  },
  {
    id: 'capone-venture-x',
    issuer: 'Capital One',
    name: 'Venture X',
    type: 'personal',
    network: 'Visa',
    annualFee: 395,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Hotels & rental cars via Capital One Travel', rate: 10 },
      { category: 'Flights via Capital One Travel', rate: 5 },
      { category: 'Everything else', rate: 2 }
    ],
    benefits: [
      { key: 'travel-credit', name: 'Travel credit (Capital One Travel)', value: 300, cadence: 'annual', resetBasis: 'anniversary', trackingMode: 'amount', category: 'travel' },
      { key: 'anniversary-miles', name: 'Anniversary bonus miles (10,000)', value: 0, cadence: 'annual', resetBasis: 'anniversary', trackingMode: 'check', category: 'points', note: '≈ $100 in miles' }
    ]
  },
  {
    id: 'capone-venture',
    issuer: 'Capital One',
    name: 'Venture Rewards',
    type: 'personal',
    network: 'Visa',
    annualFee: 95,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Hotels & rental cars via Capital One Travel', rate: 5 },
      { category: 'Everything else', rate: 2 }
    ],
    benefits: [
      { key: 'global-entry', name: 'TSA PreCheck / Global Entry credit', value: 120, cadence: 'one_time', resetBasis: 'calendar', trackingMode: 'amount', category: 'travel', note: 'Up to $120 every 4 years' }
    ]
  },
  {
    id: 'capone-savor',
    issuer: 'Capital One',
    name: 'Savor Rewards',
    type: 'personal',
    network: 'Mastercard',
    annualFee: 0,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Dining & entertainment', rate: 3 },
      { category: 'Grocery stores', rate: 3 },
      { category: 'Streaming', rate: 3 },
      { category: 'Everything else', rate: 1 }
    ],
    benefits: []
  },
  {
    id: 'chase-sapphire-reserve',
    issuer: 'Chase',
    name: 'Sapphire Reserve',
    type: 'personal',
    network: 'Visa',
    annualFee: 550,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Travel & dining via Chase Travel', rate: 5 },
      { category: 'Travel (general)', rate: 3 },
      { category: 'Dining', rate: 3 },
      { category: 'Everything else', rate: 1 }
    ],
    benefits: [
      { key: 'travel-credit', name: 'Travel credit', value: 300, cadence: 'annual', resetBasis: 'anniversary', trackingMode: 'amount', category: 'travel', note: 'Auto-applies to first $300 of travel each cardmember year' },
      { key: 'global-entry', name: 'Global Entry / TSA PreCheck credit', value: 100, cadence: 'one_time', resetBasis: 'calendar', trackingMode: 'amount', category: 'travel', note: 'Up to $100 every 4 years' }
    ]
  },
  {
    id: 'chase-sapphire-preferred',
    issuer: 'Chase',
    name: 'Sapphire Preferred',
    type: 'personal',
    network: 'Visa',
    annualFee: 95,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Travel via Chase Travel', rate: 5 },
      { category: 'Dining', rate: 3 },
      { category: 'Online grocery & streaming', rate: 3 },
      { category: 'Everything else', rate: 1 }
    ],
    benefits: [
      { key: 'hotel-credit', name: 'Hotel credit (Chase Travel)', value: 50, cadence: 'annual', resetBasis: 'anniversary', trackingMode: 'amount', category: 'travel' },
      { key: 'anniversary-points', name: 'Anniversary points bonus (10%)', value: 0, cadence: 'annual', resetBasis: 'anniversary', trackingMode: 'check', category: 'points' }
    ]
  },
  {
    id: 'chase-marriott-boundless',
    issuer: 'Chase',
    name: 'Marriott Bonvoy Boundless',
    type: 'cobranded',
    network: 'Visa',
    annualFee: 95,
    version: 1,
    dataAsOf: '2026-05',
    multipliers: [
      { category: 'Marriott Bonvoy hotels', rate: 6 },
      { category: 'Grocery / gas / dining (up to $6k/yr)', rate: 3 },
      { category: 'Everything else', rate: 2 }
    ],
    benefits: [
      { key: 'free-night', name: 'Free Night Award (up to 35k pts)', value: 0, cadence: 'annual', resetBasis: 'anniversary', trackingMode: 'check', category: 'free_night' }
    ]
  }
]

export function findTemplate(id) {
  return CARD_LIBRARY.find((c) => c.id === id) || null
}
