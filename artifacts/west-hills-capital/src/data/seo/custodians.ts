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
        a: "Strata Trust charges annual custodial fees and may charge asset-based fees. Contact Strata Trust directly for their current fee schedule — fees vary by account type and value.",
      },
      {
        q: "Does Strata Trust allow Solo 401(k) accounts for precious metals?",
        a: "Yes. Strata Trust offers Solo 401(k) accounts for self-employed individuals, which can also hold IRS-approved precious metals.",
      },
    ],
  },
  {
    slug: "kingdom-trust",
    name: "Kingdom Trust",
    shortName: "Kingdom Trust",
    location: "Murray, Kentucky",
    founded: 2009,
    description:
      "Kingdom Trust is a self-directed IRA custodian based in Murray, Kentucky, administering billions in alternative assets for clients across the country. They offer a range of self-directed account types and work with major depositories for physical precious metals storage.",
    howWeWork:
      "Clients with Kingdom Trust accounts work with West Hills Capital the same way they would with any custodian. Once your account is funded, Kingdom Trust issues a purchase direction, we confirm the trade at live pricing, and coordinate direct shipment to the designated depository. Our transparent pricing applies regardless of which custodian you use.",
    accountTypes: [
      "Traditional Self-Directed IRA",
      "Roth Self-Directed IRA",
      "SEP IRA",
      "Health Savings Account (HSA)",
    ],
    setupSteps: [
      {
        step: 1,
        title: "Establish Your Kingdom Trust Account",
        description:
          "Open a self-directed IRA through Kingdom Trust's application process. They support online and paper applications for most account types.",
      },
      {
        step: 2,
        title: "Fund the Account",
        description:
          "Transfer existing IRA funds or initiate a rollover from a 401(k) or other qualified plan. Kingdom Trust manages the incoming transfer.",
      },
      {
        step: 3,
        title: "Direct the Purchase",
        description:
          "Kingdom Trust issues a direction of investment to West Hills Capital. We confirm pricing and execute the purchase at current market rates.",
      },
      {
        step: 4,
        title: "Depository Confirmation",
        description:
          "Metal ships directly to the IRS-approved depository and is held in your name. Kingdom Trust updates your account upon confirmed receipt.",
      },
    ],
    faqs: [
      {
        q: "Does Kingdom Trust charge based on asset value?",
        a: "Kingdom Trust uses a fee structure that may include both flat annual fees and asset-based components. Contact Kingdom Trust directly for current pricing — fees change periodically.",
      },
      {
        q: "Which depositories does Kingdom Trust work with?",
        a: "Kingdom Trust typically works with Delaware Depository and Brinks. Clients may have a choice of depository — confirm options when setting up your account.",
      },
      {
        q: "Is Kingdom Trust regulated?",
        a: "Yes. Kingdom Trust is a South Dakota-chartered trust company and is subject to regulatory oversight. They are a qualified custodian under IRS rules for self-directed IRAs.",
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
    ],
  },
  {
    slug: "midland-ira",
    name: "Midland IRA",
    shortName: "Midland IRA",
    location: "Fort Myers, Florida",
    founded: 2002,
    description:
      "Midland IRA is a Florida-based self-directed IRA custodian with a broad range of alternative asset offerings, including physical precious metals. They are known for responsive customer service and a straightforward account setup process.",
    howWeWork:
      "West Hills Capital works with clients who hold their self-directed accounts at Midland IRA. Once the account is funded and a buy direction issued, we confirm the trade at current pricing and arrange direct delivery to the depository. Midland's responsive team makes coordination efficient.",
    accountTypes: [
      "Traditional Self-Directed IRA",
      "Roth Self-Directed IRA",
      "SEP IRA",
      "SIMPLE IRA",
      "Coverdell ESA",
    ],
    setupSteps: [
      {
        step: 1,
        title: "Apply for a Midland IRA Self-Directed Account",
        description:
          "Submit Midland IRA's account application. They support most common IRA types and can guide you on which is right for your situation.",
      },
      {
        step: 2,
        title: "Transfer Funds to Your New Account",
        description:
          "Initiate a rollover or direct transfer from your existing retirement account. Midland manages the incoming transfer process.",
      },
      {
        step: 3,
        title: "Authorize West Hills Capital as Dealer",
        description:
          "Midland issues a direction of investment to West Hills Capital. We confirm pricing and execute the purchase.",
      },
      {
        step: 4,
        title: "Metal Ships to Depository",
        description:
          "Metal ships directly to the IRS-approved depository designated by Midland. The depository confirms receipt and Midland updates your account.",
      },
    ],
    faqs: [
      {
        q: "Is Midland IRA based in Florida?",
        a: "Yes. Midland IRA is headquartered in Fort Myers, Florida, though they serve clients nationwide.",
      },
      {
        q: "Can Midland IRA hold other alternative assets besides precious metals?",
        a: "Yes. Midland IRA supports a wide range of alternative assets including real estate, private equity, and notes. However, for precious metals, the same IRS-approved custodian rules apply.",
      },
      {
        q: "How does Midland IRA handle required minimum distributions (RMDs)?",
        a: "Midland IRA calculates and coordinates RMDs for traditional IRA accounts. For precious metals, an RMD can be satisfied by taking a distribution in metal (an in-kind distribution) or by liquidating and distributing cash.",
      },
    ],
  },
];

export function getCustodianBySlug(slug: string): Custodian | undefined {
  return CUSTODIANS.find((c) => c.slug === slug);
}
