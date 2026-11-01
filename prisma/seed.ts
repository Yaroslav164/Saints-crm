import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Demo password for every seeded account, documented in README.md. */
const DEMO_PASSWORD = "saints2026";

const USERS = [
  { email: "admin@saints.com", name: "Admin User", role: "ADMIN" },
  { email: "ivanov@saints.com", name: "Ivan Ivanov", role: "USER" },
  { email: "petrov@saints.com", name: "Petr Petrov", role: "USER" },
  { email: "sidorov@saints.com", name: "Sidor Sidorov", role: "USER" },
] as const;

const OFFERS = [
  { name: "Dating Smartlink US", url: "https://example.com/offers/dating-us", payoutUSD: 45, network: "CrakRevenue" },
  { name: "Crypto Exchange DE", url: "https://example.com/offers/crypto-de", payoutUSD: 150, network: "AdCombo" },
  { name: "Nutra Supplement FR", url: "https://example.com/offers/nutra-fr", payoutUSD: 35, network: "ClickDealer" },
  { name: "Gambling Casino CA", url: "https://example.com/offers/casino-ca", payoutUSD: 200, network: "Bongacams" },
  { name: "E-commerce Gadgets UK", url: "https://example.com/offers/gadgets-uk", payoutUSD: 25, network: "AdvOff" },
] as const;

const GEOS = [
  { code: "US", name: "United States" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "CA", name: "Canada" },
  { code: "UK", name: "United Kingdom" },
] as const;

const TAGS = [
  { name: "hot", color: "#ef4444" },
  { name: "warm", color: "#f97316" },
  { name: "new approach", color: "#3b82f6" },
  { name: "proven", color: "#10b981" },
  { name: "risky", color: "#eab308" },
] as const;

/**
 * A bundle is described by its funnel inputs instead of hard-coded money values:
 * revenue = conversions x offer payout x factor, spend = clicks x CPC. That keeps
 * CR, ROI and the daily rows consistent with each other.
 */
type SeedBundle = {
  name: string;
  offer: string;
  geos: readonly string[];
  angle: string;
  creative: string | null;
  buyer: string;
  status: "IDEA" | "TESTING" | "PROFIT" | "LOSS" | "DRAINED" | "SCALE";
  days: number;
  planned: number;
  clicks: number;
  conversions: number;
  factor: number;
  cpc: number;
  tags: readonly string[];
  notes: string | null;
};

const BUNDLES: readonly SeedBundle[] = [
  // 💡 Ideas — queued, barely spent
  {
    name: "Dating US - Native Feed v3 - TikTok",
    offer: "Dating Smartlink US",
    geos: ["US"],
    angle: "Fake notification feed leading to a dating signup",
    creative: "https://drive.google.com/drive/folders/native-feed-v3",
    buyer: "ivanov@saints.com",
    status: "IDEA",
    days: 4,
    planned: 300,
    clicks: 0,
    conversions: 0,
    factor: 1,
    cpc: 0,
    tags: ["new approach"],
    notes: "Waiting for the account warm-up to finish before the first $50 test.",
  },
  {
    name: "Crypto DE - Webinar Funnel - YouTube",
    offer: "Crypto Exchange DE",
    geos: ["DE"],
    angle: "Webinar on passive income, pre-land with a fake news block",
    creative: "https://drive.google.com/drive/folders/webinar-de",
    buyer: "petrov@saints.com",
    status: "IDEA",
    days: 6,
    planned: 800,
    clicks: 640,
    conversions: 0,
    factor: 1,
    cpc: 0.12,
    tags: ["hot", "risky"],
    notes: "White-hat pre-land approved by moderation, first budget on Friday.",
  },
  {
    name: "Nutra FR - Quiz Landing - Meta",
    offer: "Nutra Supplement FR",
    geos: ["FR"],
    angle: "Weight-loss quiz that recommends the supplement as the result",
    creative: null,
    buyer: "sidorov@saints.com",
    status: "IDEA",
    days: 2,
    planned: 250,
    clicks: 0,
    conversions: 0,
    factor: 1,
    cpc: 0,
    tags: ["warm"],
    notes: null,
  },

  // 🧪 Testing — live experiments with partial data
  {
    name: "Gambling CA - Free Spins Hook - TikTok",
    offer: "Gambling Casino CA",
    geos: ["CA"],
    angle: "Free-spins bonus with a 30-second countdown on the landing",
    creative: "https://drive.google.com/drive/folders/free-spins-ca",
    buyer: "ivanov@saints.com",
    status: "TESTING",
    days: 21,
    planned: 1500,
    clicks: 18400,
    conversions: 7,
    factor: 0.9,
    cpc: 0.09,
    tags: ["hot"],
    notes: "Registrations are cheap but FTDs are slow, waiting for postback attribution.",
  },
  {
    name: "Dating US - Video Story v1 - TikTok",
    offer: "Dating Smartlink US",
    geos: ["US"],
    angle: "POV dating-hack story, straight to the smartlink",
    creative: "https://drive.google.com/drive/folders/pov-story",
    buyer: "petrov@saints.com",
    status: "TESTING",
    days: 17,
    planned: 900,
    clicks: 12100,
    conversions: 17,
    factor: 0.85,
    cpc: 0.07,
    tags: ["new approach", "warm"],
    notes: null,
  },
  {
    name: "Crypto DE - Landing Page A - Facebook",
    offer: "Crypto Exchange DE",
    geos: ["DE", "AT"],
    angle: "Calculator lander: show the monthly profit before signup",
    creative: "https://drive.google.com/drive/folders/calculator-lander",
    buyer: "sidorov@saints.com",
    status: "TESTING",
    days: 25,
    planned: 1200,
    clicks: 6200,
    conversions: 7,
    factor: 1.05,
    cpc: 0.19,
    tags: ["proven"],
    notes: "DE traffic is expensive, AT is a bonus tier from the same creative.",
  },
  {
    name: "Nutra FR - Before/After - Instagram",
    offer: "Nutra Supplement FR",
    geos: ["FR", "BE"],
    angle: "Before/after photo carousel with a personal-diary pre-land",
    creative: "https://drive.google.com/drive/folders/before-after-fr",
    buyer: "ivanov@saints.com",
    status: "TESTING",
    days: 13,
    planned: 700,
    clicks: 9800,
    conversions: 19,
    factor: 0.75,
    cpc: 0.06,
    tags: ["risky"],
    notes: "Two ad accounts already banned, keep the budget under $60/day.",
  },
  {
    name: "E-commerce UK - UGC Unboxing - TikTok",
    offer: "E-commerce Gadgets UK",
    geos: ["UK"],
    angle: "Unboxing UGC with a price-drop offer",
    creative: "https://drive.google.com/drive/folders/unboxing-uk",
    buyer: "petrov@saints.com",
    status: "TESTING",
    days: 9,
    planned: 450,
    clicks: 7300,
    conversions: 27,
    factor: 0.8,
    cpc: 0.05,
    tags: ["warm", "new approach"],
    notes: null,
  },
  {
    name: "Gambling CA - Sports Bonus - Reddit",
    offer: "Gambling Casino CA",
    geos: ["CA"],
    angle: "Bet-with-a-friend mechanic pushed through sports subs",
    creative: null,
    buyer: "sidorov@saints.com",
    status: "TESTING",
    days: 11,
    planned: 600,
    clicks: 4100,
    conversions: 3,
    factor: 0.7,
    cpc: 0.14,
    tags: ["risky"],
    notes: "Subreddits rotate every week, the source is unstable.",
  },
  {
    name: "Dating DE - Chat Teaser - Push",
    offer: "Dating Smartlink US",
    geos: ["DE"],
    angle: "Push notification teaser with an unread-message lander",
    creative: "https://drive.google.com/drive/folders/push-teaser-de",
    buyer: "ivanov@saints.com",
    status: "TESTING",
    days: 30,
    planned: 1000,
    clicks: 21500,
    conversions: 21,
    factor: 0.6,
    cpc: 0.03,
    tags: ["proven", "warm"],
    notes: "Cheap clicks, but the lander CR dropped after the offer updated its PPA.",
  },
  {
    name: "Crypto UK - Explainer Reels - Instagram",
    offer: "Crypto Exchange DE",
    geos: ["UK"],
    angle: "60-second explainer reel, no presell, direct to registration",
    creative: "https://drive.google.com/drive/folders/explainer-uk",
    buyer: "petrov@saints.com",
    status: "TESTING",
    days: 7,
    planned: 500,
    clicks: 3900,
    conversions: 3,
    factor: 0.95,
    cpc: 0.11,
    tags: ["new approach"],
    notes: null,
  },

  // ✅ In profit
  {
    name: "Dating US - Smartlink - Video v2",
    offer: "Dating Smartlink US",
    geos: ["US", "UK", "CA"],
    angle: "Local-match lander with a swipe animation on entry",
    creative: "https://drive.google.com/drive/folders/local-match",
    buyer: "ivanov@saints.com",
    status: "PROFIT",
    days: 46,
    planned: 2500,
    clicks: 61200,
    conversions: 118,
    factor: 1.1,
    cpc: 0.06,
    tags: ["proven", "hot"],
    notes: "The reference bundle of the team: three TikTok accounts rotate the same lander.",
  },
  {
    name: "Gambling CA - Deposit Match - TikTok",
    offer: "Gambling Casino CA",
    geos: ["CA"],
    angle: "Deposit-match banner, casino lander with an instant-play demo",
    creative: "https://drive.google.com/drive/folders/deposit-match",
    buyer: "petrov@saints.com",
    status: "PROFIT",
    days: 38,
    planned: 3000,
    clicks: 27800,
    conversions: 33,
    factor: 1.2,
    cpc: 0.08,
    tags: ["hot"],
    notes: null,
  },
  {
    name: "Nutra FR - Diary Pre-land - Meta",
    offer: "Nutra Supplement FR",
    geos: ["FR"],
    angle: "Personal weight-loss diary in first person, then the order form",
    creative: "https://drive.google.com/drive/folders/diary-fr",
    buyer: "sidorov@saints.com",
    status: "PROFIT",
    days: 52,
    planned: 1800,
    clicks: 24600,
    conversions: 84,
    factor: 1.0,
    cpc: 0.05,
    tags: ["proven", "warm"],
    notes: "Stable for two months, only the creative refresh interval changed.",
  },
  {
    name: "E-commerce UK - Bundle Offer - Facebook",
    offer: "E-commerce Gadgets UK",
    geos: ["UK", "IE"],
    angle: "Three-item bundle discount with a countdown timer",
    creative: null,
    buyer: "ivanov@saints.com",
    status: "PROFIT",
    days: 33,
    planned: 1400,
    clicks: 19700,
    conversions: 96,
    factor: 0.95,
    cpc: 0.07,
    tags: ["warm"],
    notes: null,
  },
  {
    name: "Crypto DE - News Pre-land - YouTube",
    offer: "Crypto Exchange DE",
    geos: ["DE"],
    angle: "Fake financial-news teaser, then the exchange registration",
    creative: "https://drive.google.com/drive/folders/news-de",
    buyer: "petrov@saints.com",
    status: "PROFIT",
    days: 60,
    planned: 2200,
    clicks: 15300,
    conversions: 31,
    factor: 1.25,
    cpc: 0.13,
    tags: ["proven", "risky"],
    notes: "Highest payout per conversion in the portfolio, moderation is the only risk.",
  },

  // ⚠️ In loss
  {
    name: "Dating FR - Geo Popup - TikTok",
    offer: "Dating Smartlink US",
    geos: ["FR"],
    angle: "Geo-based 'girls near you' popup",
    creative: null,
    buyer: "sidorov@saints.com",
    status: "LOSS",
    days: 27,
    planned: 800,
    clicks: 22400,
    conversions: 22,
    factor: 0.55,
    cpc: 0.05,
    tags: ["risky"],
    notes: "Clicks are cheap but the traffic is bot-heavy, CR is a lie.",
  },
  {
    name: "Gambling UK - Roulette Clip - Instagram",
    offer: "Gambling Casino CA",
    geos: ["UK"],
    angle: "Roulette wheel clip promising a no-deposit bonus",
    creative: "https://drive.google.com/drive/folders/roulette-uk",
    buyer: "petrov@saints.com",
    status: "LOSS",
    days: 19,
    planned: 900,
    clicks: 11600,
    conversions: 7,
    factor: 0.6,
    cpc: 0.1,
    tags: ["hot", "risky"],
    notes: null,
  },

  // 🗑 Drained — killed
  {
    name: "Crypto FR - Fake Exchange App - TikTok",
    offer: "Crypto Exchange DE",
    geos: ["FR"],
    angle: "Demo of a fake exchange app with a deposit screen",
    creative: null,
    buyer: "sidorov@saints.com",
    status: "DRAINED",
    days: 41,
    planned: 700,
    clicks: 30100,
    conversions: 4,
    factor: 0.4,
    cpc: 0.04,
    tags: ["risky"],
    notes: "Two ad accounts lost for $50 of revenue. Archived, do not revisit.",
  },

  // 🚀 Scaling
  {
    name: "Dating US - Feed Native v2 - Reddit",
    offer: "Dating Smartlink US",
    geos: ["US"],
    angle: "Native feed posts in dating subs, comment-based lander",
    creative: "https://drive.google.com/drive/folders/feed-native-v2",
    buyer: "ivanov@saints.com",
    status: "SCALE",
    days: 68,
    planned: 6000,
    clicks: 84500,
    conversions: 171,
    factor: 1.15,
    cpc: 0.06,
    tags: ["proven", "hot"],
    notes: "Budget raised weekly, currently at $200/day with a stable ROI.",
  },
];

/** Deterministic PRNG so re-seeding produces the same shape of data. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20261031);

function dayOffset(daysAgo: number, hour = 10) {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  date.setHours(hour, Math.floor(random() * 55), 0, 0);
  return date;
}

/**
 * Day keys are normalised in UTC because BundleMetric.date is a Postgres DATE:
 * Prisma reads/writes that column in UTC, so a local midnight on a UTC+3 machine
 * would persist as the previous day.
 */
function dayStart(daysAgo: number) {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Splits a bundle's totals over its active days, newest-last, then corrects the
 * last day so the daily rows add up to the totals stored on the bundle.
 */
function spreadDays(total: number, days: number, integer = false) {
  const weights = Array.from({ length: days }, () => 0.25 + random() * 1.5);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const parts = weights.map((w) => (total * w) / sum);
  const last = parts.length - 1;
  parts[last] = integer
    ? Math.round(total - parts.slice(0, last).reduce((a, b) => a + b, 0))
    : round(total - parts.slice(0, last).reduce((a, b) => a + b, 0));
  return parts.map((p) => (integer ? Math.max(0, Math.round(p)) : Math.max(0, round(p))));
}

async function truncate() {
  // Child tables first: every FK points at bundles or users.
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.bundleChange.deleteMany();
  await prisma.bundleMetric.deleteMany();
  await prisma.bundle.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.geo.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await truncate();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds = new Map<string, string>();
  for (const user of USERS) {
    const created = await prisma.user.create({
      data: { ...user, passwordHash },
    });
    userIds.set(created.email, created.id);
  }

  const offerIds = new Map<string, string>();
  for (const offer of OFFERS) {
    const created = await prisma.offer.create({ data: { ...offer } });
    offerIds.set(created.name, created.id);
  }

  const geoIds = new Map<string, string>();
  for (const geo of GEOS) {
    const created = await prisma.geo.create({ data: { ...geo } });
    geoIds.set(created.code, created.id);
  }
  // A few bundles reference countries outside the five seed geos; keep the dictionary
  // honest by adding the extras instead of dropping them from the bundle.
  for (const extra of [
    { code: "AT", name: "Austria" },
    { code: "BE", name: "Belgium" },
    { code: "IE", name: "Ireland" },
  ]) {
    if (geoIds.has(extra.code)) continue;
    const created = await prisma.geo.create({ data: extra });
    geoIds.set(created.code, created.id);
  }

  const tagIds = new Map<string, string>();
  for (const tag of TAGS) {
    const created = await prisma.tag.create({ data: { ...tag } });
    tagIds.set(created.name, created.id);
  }

  await prisma.setting.createMany({
    data: [
      { key: "roiAlertThreshold", value: "-20" },
      { key: "defaultCurrency", value: "USD" },
    ],
  });

  const adminId = userIds.get("admin@saints.com")!;
  let createdCount = 0;

  for (const bundle of BUNDLES) {
    const payout = OFFERS.find((o) => o.name === bundle.offer)!.payoutUSD;
    const revenue = round(bundle.conversions * payout * bundle.factor);
    const spent = round(bundle.clicks * bundle.cpc);
    const createdAt = dayOffset(bundle.days, 9);

    const row = await prisma.bundle.create({
      data: {
        name: bundle.name,
        offerId: offerIds.get(bundle.offer)!,
        userId: userIds.get(bundle.buyer)!,
        angle: bundle.angle,
        creative: bundle.creative,
        status: bundle.status,
        budgetPlanned: bundle.planned,
        budgetSpent: spent,
        revenue,
        clicks: bundle.clicks,
        conversions: bundle.conversions,
        notes: bundle.notes,
        isArchived: bundle.status === "DRAINED",
        createdAt,
        updatedAt: dayOffset(Math.max(0, Math.floor(bundle.days / 3)), 18),
        geos: { connect: bundle.geos.map((code) => ({ id: geoIds.get(code)! })) },
        tags: { connect: bundle.tags.map((name) => ({ id: tagIds.get(name)! })) },
      },
    });
    createdCount++;

    // Daily history: ideas with no spend still get a single row when they have clicks.
    const activeDays = Math.max(1, Math.min(bundle.days, 30));
    const spentByDay = spreadDays(spent, activeDays);
    const revenueByDay = spreadDays(revenue, activeDays);
    const clicksByDay = spreadDays(bundle.clicks, activeDays, true);
    const convByDay = spreadDays(bundle.conversions, activeDays, true);

    await prisma.bundleMetric.createMany({
      data: Array.from({ length: activeDays }, (_, index) => ({
        bundleId: row.id,
        date: dayStart(activeDays - 1 - index),
        spent: spentByDay[index],
        revenue: revenueByDay[index],
        clicks: clicksByDay[index],
        conversions: convByDay[index],
      })),
    });

    // Timeline: creation, a status move, and usually a budget change.
    const changes: { field: string; oldValue: string | null; newValue: string; daysAgo: number }[] = [
      { field: "bundle", oldValue: null, newValue: "created", daysAgo: bundle.days },
    ];
    if (bundle.status !== "IDEA") {
      changes.push({
        field: "status",
        oldValue: "IDEA",
        newValue: "TESTING",
        daysAgo: Math.max(1, Math.round(bundle.days * 0.8)),
      });
    }
    if (["PROFIT", "SCALE", "LOSS", "DRAINED"].includes(bundle.status)) {
      changes.push({
        field: "status",
        oldValue: "TESTING",
        newValue: bundle.status,
        daysAgo: Math.max(1, Math.round(bundle.days * 0.35)),
      });
    }
    if (bundle.planned > 500) {
      changes.push({
        field: "budgetPlanned",
        oldValue: String(round(bundle.planned / 2)),
        newValue: String(bundle.planned),
        daysAgo: Math.max(1, Math.round(bundle.days * 0.5)),
      });
    }

    await prisma.bundleChange.createMany({
      data: changes.map((change) => ({
        bundleId: row.id,
        userId: row.userId,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        createdAt: dayOffset(change.daysAgo, 11 + Math.floor(random() * 8)),
      })),
    });

    if (bundle.notes) {
      await prisma.comment.create({
        data: {
          bundleId: row.id,
          userId: row.userId,
          text: bundle.notes,
          createdAt: dayOffset(Math.max(1, Math.round(bundle.days / 2)), 15),
        },
      });
    }

    const reviewerId = random() > 0.5 ? adminId : Array.from(userIds.values()).at(1 + Math.floor(random() * 3))!;
    await prisma.comment.create({
      data: {
        bundleId: row.id,
        userId: reviewerId,
        text: commentFor(bundle, revenue, spent),
        createdAt: dayOffset(Math.max(0, Math.round(bundle.days / 4)), 16),
      },
    });

    // The alert feature needs rows to show: flag every bundle under -20% ROI.
    const roi = spent > 0 ? ((revenue - spent) / spent) * 100 : 0;
    if (["LOSS", "DRAINED"].includes(bundle.status) || (roi < -20 && spent > 0)) {
      await prisma.notification.create({
        data: {
          userId: adminId,
          bundleId: row.id,
          type: "roi_alert",
          message: `Bundle "${row.name}" ROI is ${round(roi, 1)}% — below the -20% threshold.`,
        },
      });
    }
  }

  console.log(
    `Seeded ${USERS.length} users, ${OFFERS.length} offers, ${geoIds.size} geos, ${TAGS.length} tags, ${createdCount} bundles.`,
  );
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
}

function commentFor(bundle: SeedBundle, revenue: number, spent: number) {
  const roi = spent > 0 ? round(((revenue - spent) / spent) * 100, 1) : 0;
  switch (bundle.status) {
    case "IDEA":
      return "Approve the angle, but keep the first test under $50 until the lander is checked on mobile.";
    case "TESTING":
      return `Postback is mapped, watch CR for three more days before deciding. Current ROI ${roi}%.`;
    case "PROFIT":
      return `Good economics at ${roi}% ROI — refresh creatives twice a week and hold the budget.`;
    case "LOSS":
      return `Cut to $30/day and swap the pre-land; ${roi}% ROI is not coverable at this CPC.`;
    case "DRAINED":
      return "Not worth another dollar, the lander gets banned faster than it converts. Archived.";
    case "SCALE":
      return `Scaling looks safe at ${roi}% ROI. Add two more accounts and cap daily spend at $200.`;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
