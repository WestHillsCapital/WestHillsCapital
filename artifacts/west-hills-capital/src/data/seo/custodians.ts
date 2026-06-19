export interface Custodian {
  slug: string;
  name: string;
  shortName: string;
  location: string;
  founded?: number;
  description: string;
  howWeWork: string;
  accountTypes: string[];
  setupSteps: { step: number; title: string; description: string }[];
  faqs: { q: string; a: string }[];
}

export const CUSTODIANS: Custodian[] = [
  {
    slug: "equity-trust",
    name: "Equity Trust Company",
    shortName: "Equity Trust",
    location: "Westlake, Ohio",
    founded: 1974,
    description:
      "Equity Trust Company is one of the largest self-directed IRA custodians in the United States, with decades of experience administering alternative asset IRAs. They are a popular choice for investors seeking to hold physical precious metals in a self-directed account, offering a streamlined account setup process and established relationships with major depositories.",
    howWeWork:
      "West Hills Capital has coordinated numerous IRA transactions through Equity Trust. Once your account is established and funded, we receive a purchase direction from the custodian, confirm the trade at current pricing, and arrange direct shipment to your designated depository. Our role is to source the metal and execute the transaction — Equity Trust handles all custodial administration.",
    accountTypes: [
      "Traditional Self-Directed IRA",
      "Roth Self-Directed IRA",
      "SEP IRA",
      "SIMPLE IRA",
      "Inherited IRA",
    ],
    setupSteps: [
      {
        step: 1,
        title: "Open Your Equity Trust Account",
        description:
          "Complete Equity Trust's new account application, selecting a self-directed IRA. The process can be done online and typically takes a few business days to approve.",
      },
      {
        step: 2,
        title: "Fund via Rollover or Transfer",
        description:
          "Initiate a rollover from your existing 401(k), IRA, or other qualified plan. Equity Trust coordinates with your current custodian to move funds directly.",
      },
      {
        step: 3,
        title: "Issue a Buy Direction to West Hills Capital",
        description:
          "Once funds are cleared, Equity Trust issues a buy direction letter authorizing West Hills Capital to execute your purchase. We confirm pricing at this point.",
      },
      {
        step: 4,
        title: "Metal Delivered to Depository",
        description:
          "We ship the metal directly to the IRS-approved depository chosen by Equity Trust (typically Delaware Depository or Brinks). The depository confirms receipt and updates your account.",
      },
    ],
    faqs: [
      {
        q: "How long does it take to open an Equity Trust account?",
        a: "Account approval typically takes 2–5 business days. Once approved, the rollover or transfer process adds another 1–3 weeks depending on your existing custodian's speed.",
      },
      {
        q: "What does Equity Trust charge for a precious metals IRA?",
        a: "Equity Trust uses an asset-based annual maintenance fee: $350/yr for accounts under $50,000, scaling to $2,500/yr for accounts over $1,000,000. Setup is $50 online or $75 by paper. Precious metals storage runs $110/yr (non-segregated) or $160/yr (segregated), billed by the depository. In-kind distributions are $50/transaction.",
      },
      {
        q: "Does West Hills Capital have a fee relationship with Equity Trust?",
        a: "No. We do not receive referral fees from custodians. We mention custodians by name because clients ask, and we want to be transparent about the firms we have worked with.",
      },
      {
        q: "Can I choose a different depository with Equity Trust?",
        a: "Equity Trust works with several approved depositories. We coordinate delivery to wherever your account is set up. Common choices include Delaware Depository and Brinks Global Services.",
      },
    ],
  },
  {
    slug: "strata-trust",
    name: "Strata Trust Company",
    shortName: "Strata Trust",
    location: "Waco, Texas",
    founded: 2008,
    description:
      "Strata Trust Company (formerly Self Directed IRA Services) is a Texas-based self-directed IRA custodian focused exclusively on alternative asset accounts. Their specialization in self-directed accounts means their staff is experienced in handling physical metals transactions and the associated depository coordination.",
    howWeWork:
      "West Hills Capital coordinates precious metals purchases for clients who use Strata Trust as their custodian. The purchase direction comes from Strata Trust once funds are cleared, we confirm the trade, and arrange direct delivery to the client's designated depository. The entire process is transparent — clients know exactly what they are buying and at what price before any metal ships.",
    accountTypes: [
      "Traditional Self-Directed IRA",
      "Roth Self-Directed IRA",
      "SEP IRA",
      "SIMPLE IRA",
      "Solo 401(k)",
    ],
    setupSteps: [
      {
        step: 1,
        title: "Open Your Strata Trust Self-Directed IRA",
        description:
          "Complete Strata Trust's account application. As a specialized self-directed custodian, their onboarding is designed for alternative assets from the start.",
      },
      {
        step: 2,
        title: "Transfer or Roll Over Existing Funds",
        description:
          "Initiate a direct transfer or rollover from your current retirement account. Strata Trust will contact your existing custodian to request the transfer.",
      },
      {
        step: 3,
        title: "Receive and Execute Buy Direction",
        description:
          "Strata Trust sends a buy direction to West Hills Capital authorizing the purchase. We lock in pricing and confirm the trade with you verbally.",
      },
      {
        step: 4,
        title: "Secure Depository Storage",
        description:
          "Metal ships directly to an IRS-approved depository. Strata Trust coordinates the acceptance confirmation and updates your account statement.",
      },
    ],
    faqs: [
      {
        q: "Is Strata Trust a good choice for a first-time self-directed IRA?",
        a: "Yes. Strata Trust focuses exclusively on self-directed accounts and their staff is experienced with physical metals. They tend to be responsive and straightforward in their communications.",
      },
      {
        q: "What fees does Strata Trust charge?",
        a: "For a Precious Metals IRA, Strata Trust charges a $50 account setup fee (waived for online opening) and a $125 annual account fee. Precious metals storage is $100/yr commingled or $175/yr segregated. Purchase and sale transactions carry a $40 processing fee. Outgoing wires are $35. Fee schedule is effective January 1, 2024.",
      },
      {
        q: "Does Strata Trust allow Solo 401(k) accounts for precious metals?",
        a: "Yes. Strata Trust offers Solo 401(k) accounts for self-employed individuals, which can also hold IRS-approved precious metals.",
      },
    ],
  },
  {
    slug: "kingdom-trust",
    name: "Choice IRA (formerly Kingdom Trust)",
    shortName: "Choice IRA",
    location: "Murray, Kentucky",
    founded: 2009,
    description:
      "Kingdom Trust has rebranded as Choice IRA (choiceapp.io). We are confirming whether Choice IRA continues to accept new precious metals IRA clients under its current platform — this page will be updated once that is verified. Existing Kingdom Trust clients should contact Choice IRA directly to confirm their account status.",
    howWeWork:
      "West Hills Capital is verifying whether Choice IRA (formerly Kingdom Trust) still supports precious metals IRA transactions. If you have an existing Kingdom Trust account and want to purchase metals through West Hills Capital, contact us directly and we will confirm the current process with Choice IRA.",
    accountTypes: [],
    setupSteps: [],
    faqs: [
      {
        q: "Is Kingdom Trust still accepting precious metals IRA clients?",
        a: "Kingdom Trust has rebranded as Choice IRA (choiceapp.io). We are confirming whether precious metals IRAs are still supported under the new platform. Contact us or Choice IRA directly for the most current information.",
      },
      {
        q: "What happens to my existing Kingdom Trust precious metals IRA?",
        a: "Existing accounts should remain intact through the rebrand. Contact Choice IRA directly at choiceapp.io to confirm your account status and any changes to their fee schedule or service offerings.",
      },
      {
        q: "Does West Hills Capital still work with Choice IRA?",
        a: "We are in the process of confirming Choice IRA's current precious metals IRA policies. We will update this page once we have verified their current offerings.",
      },
    ],
  },
  {
    slug: "goldstar-trust",
    name: "GoldStar Trust Company",
    shortName: "GoldStar Trust",
    location: "Canyon, Texas",
    founded: 1989,
    description:
      "GoldStar Trust Company has been a specialist in self-directed precious metals IRAs since 1989. Based in Canyon, Texas, GoldStar focuses almost exclusively on precious metals IRA accounts, making them one of the most experienced custodians specifically for this asset class.",
    howWeWork:
      "GoldStar's specialization in precious metals means the coordination process is well-established. Once your account is funded and a buy direction is issued, West Hills Capital confirms the trade and ships metal directly to the client's designated depository. GoldStar's long track record in precious metals administration means fewer surprises in the process.",
    accountTypes: [
      "Traditional Self-Directed IRA (Precious Metals)",
      "Roth Self-Directed IRA (Precious Metals)",
      "SEP IRA",
    ],
    setupSteps: [
      {
        step: 1,
        title: "Open a GoldStar Precious Metals IRA",
        description:
          "Complete GoldStar's account application. Because they specialize in precious metals IRAs, the application is designed specifically for this account type.",
      },
      {
        step: 2,
        title: "Fund via Transfer or Rollover",
        description:
          "Transfer from an existing IRA or roll over from a 401(k) or qualified plan. GoldStar manages incoming transfer requests.",
      },
      {
        step: 3,
        title: "Purchase Direction to West Hills Capital",
        description:
          "GoldStar sends a purchase authorization to West Hills Capital. We lock pricing verbally and confirm all details with the client before executing.",
      },
      {
        step: 4,
        title: "Depository Delivery",
        description:
          "Metal ships to the client's designated depository — typically Delaware Depository. GoldStar updates the account record upon depository confirmation.",
      },
    ],
    faqs: [
      {
        q: "Why choose a specialized custodian like GoldStar over a general self-directed IRA firm?",
        a: "Specialization means GoldStar's staff is deeply familiar with the precious metals IRA process. They deal with buy directions, depository coordination, and metals-specific IRS rules every day — which tends to make the process smoother.",
      },
      {
        q: "Does GoldStar work with all IRS-approved depositories?",
        a: "GoldStar primarily works with Delaware Depository. Confirm depository options when opening your account.",
      },
      {
        q: "How long has GoldStar been in business?",
        a: "GoldStar Trust Company was founded in 1989, making it one of the longer-tenured precious metals IRA custodians in the country.",
      },
      {
        q: "What does GoldStar Trust charge for a precious metals account?",
        a: "GoldStar's IRA fee schedule shows a $50 establishment fee and a $90 annual maintenance fee for precious metals accounts (lower than their $150 rate for other asset types). Commingled depository storage is $125/yr; segregated storage starts at $225/yr minimum with no maximum — accounts over $125,000 in metals value are charged at $1.80 per $1,000 (18 basis points). There is no fee to buy, sell, or exchange metals. Outgoing wires are $50.",
      },
    ],
  },
  {
    slug: "advanta-ira",
    name: "Advanta IRA",
    shortName: "Advanta IRA",
    location: "Lake Mary, Florida",
    founded: 2004,
    description:
      "Advanta IRA is a self-directed IRA administrator headquartered in Lake Mary, Florida, with additional offices serving clients nationwide. They specialize in self-directed retirement accounts holding alternative assets — including physical precious metals — and are known for their educational resources and client-focused approach to account administration.",
    howWeWork:
      "West Hills Capital coordinates precious metals purchases for clients who use Advanta IRA as their administrator. Once your account is funded and Advanta IRA issues a direction of investment, we confirm current pricing and execute the purchase. Metal ships directly to the IRS-approved depository designated by your account — Advanta IRA handles all administrative and reporting functions.",
    accountTypes: [
      "Traditional Self-Directed IRA",
      "Roth Self-Directed IRA",
      "SEP IRA",
      "SIMPLE IRA",
      "Solo 401(k)",
      "Health Savings Account (HSA)",
    ],
    setupSteps: [
      {
        step: 1,
        title: "Open Your Advanta IRA Account",
        description:
          "Complete Advanta IRA's account application for a self-directed IRA. They offer Traditional, Roth, SEP, and other account types — choose based on your current tax situation and goals.",
      },
      {
        step: 2,
        title: "Fund via Transfer or Rollover",
        description:
          "Initiate a direct transfer from your existing IRA or a rollover from a 401(k) or other qualified plan. Advanta IRA manages the incoming transfer process and coordinates with your current custodian.",
      },
      {
        step: 3,
        title: "Issue Direction of Investment",
        description:
          "Once funds are cleared, Advanta IRA issues a direction of investment to West Hills Capital authorizing your purchase. We confirm current pricing and execute the trade.",
      },
      {
        step: 4,
        title: "Metal Delivered to Depository",
        description:
          "We ship the metal directly to your designated IRS-approved depository. The depository confirms receipt and Advanta IRA updates your account statement.",
      },
    ],
    faqs: [
      {
        q: "Is Advanta IRA a custodian or an administrator?",
        a: "Advanta IRA operates as a self-directed IRA administrator working under an IRS-approved custodian. This structure is common in the self-directed IRA industry and does not affect the IRS approval status of your account or the metals held within it.",
      },
      {
        q: "Does Advanta IRA have educational resources for new investors?",
        a: "Yes. Advanta IRA is known for providing educational materials and events about self-directed IRAs and alternative asset investing. For precious metals specifically, West Hills Capital provides guidance on eligible metals, pricing, and the purchase process.",
      },
      {
        q: "What does Advanta IRA charge for a precious metals account?",
        a: "Advanta IRA charges a one-time $50 account opening fee. Annual recordkeeping can be billed two ways: per-asset ($250/yr per precious metals depository) or by account value (ranging from $200/yr for accounts under $15,000 to $1,850/yr for accounts over $750,000, billed quarterly). Depository storage fees are separate. Transactions are $95–$145 per purchase or sale. Outgoing wires are $30.",
      },
      {
        q: "What depositories does Advanta IRA work with for precious metals?",
        a: "Advanta IRA coordinates with IRS-approved depositories for precious metals storage. Common options include Delaware Depository and International Depository Services. Confirm current depository options when setting up your account.",
      },
    ],
  },
];

export function getCustodianBySlug(slug: string): Custodian | undefined {
  return CUSTODIANS.find((c) => c.slug === slug);
}
