export interface IraRolloverType {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  keyFacts: string[];
  faqs: { q: string; a: string }[];
}

export const IRA_ROLLOVERS: IraRolloverType[] = [
  {
    slug: "401k",
    name: "401(k) to Precious Metals IRA",
    shortName: "401(k)",
    description:
      "A 401(k) rollover to a Precious Metals IRA is one of the most common ways investors gain exposure to physical gold and silver inside a tax-advantaged account. Funds move directly from your employer-sponsored plan to a self-directed IRA custodian — with no immediate tax event when done correctly.",
    keyFacts: [
      "Eligible after leaving an employer, reaching 59½, or through an in-service distribution (plan-dependent)",
      "Direct rollovers avoid mandatory 20% withholding that applies to indirect rollovers",
      "No IRS-imposed limit on the amount you can roll over",
      "Must complete the rollover within 60 days if taking an indirect distribution",
      "Preserves tax-deferred status — no taxes owed until you take distributions",
    ],
    faqs: [
      {
        q: "Can I roll over my 401(k) while still employed?",
        a: "Some plans allow in-service distributions after age 59½ or after a certain tenure. Check your specific plan documents or ask your HR department. Most rollovers happen after leaving an employer.",
      },
      {
        q: "How long does a 401(k) to Precious Metals IRA rollover take?",
        a: "Typically 2–4 weeks from initiation to funding. The custodian setup, distribution request, and fund clearing each add a few business days.",
      },
      {
        q: "Will I owe taxes on a direct rollover?",
        a: "No. A direct rollover — where funds move custodian-to-custodian — is not a taxable event. You report it on your tax return but owe nothing as long as the funds go directly to the new IRA.",
      },
    ],
  },
  {
    slug: "roth-ira",
    name: "Roth IRA to Precious Metals Roth IRA",
    shortName: "Roth IRA",
    description:
      "Existing Roth IRA funds can be transferred to a self-directed Roth IRA that holds physical precious metals. Because Roth accounts are funded with after-tax dollars, qualified distributions remain tax-free — meaning gold held in a Roth IRA can appreciate entirely free of federal tax.",
    keyFacts: [
      "Roth-to-Roth transfers preserve the tax-free growth benefit",
      "Contributions (not earnings) can be withdrawn any time without penalty",
      "No required minimum distributions (RMDs) during the owner's lifetime",
      "Transfer does not trigger a taxable event when done correctly",
      "IRS-approved coins and bars must meet purity standards (.995 gold, .999 silver)",
    ],
    faqs: [
      {
        q: "Can I convert a traditional IRA to a Roth Precious Metals IRA?",
        a: "Yes — this is called a Roth conversion. You would owe income tax on the converted amount in the year of conversion. West Hills Capital does not provide tax advice; consult a CPA to understand the tax implications.",
      },
      {
        q: "Are Roth Precious Metals IRA distributions truly tax-free?",
        a: "Qualified distributions — taken after age 59½ and after the account has been open at least 5 years — are federal income tax-free. State taxes vary.",
      },
      {
        q: "What metals can I hold in a Roth IRA?",
        a: "American Gold Eagles, Gold Buffalos, and Silver Eagles all qualify. IRS rules require gold to be .995 fine or better (Eagles are a statutory exception at .9167) and silver to be .999 fine or better.",
      },
    ],
  },
  {
    slug: "sep-ira",
    name: "SEP IRA to Precious Metals IRA",
    shortName: "SEP IRA",
    description:
      "A Simplified Employee Pension (SEP) IRA is a retirement account commonly used by self-employed individuals and small business owners. SEP IRA funds can be transferred to a self-directed precious metals IRA to hold physical gold and silver while preserving the tax-deferred growth benefits.",
    keyFacts: [
      "SEP IRAs accept employer contributions only — no employee elective deferrals",
      "Transfer to a self-directed IRA is treated the same as a traditional IRA transfer",
      "No limit on the amount transferred in a trustee-to-trustee transfer",
      "Distributions taxed as ordinary income (same as traditional IRA)",
      "RMDs begin at age 73 (as of current law)",
    ],
    faqs: [
      {
        q: "Can I continue contributing to a SEP IRA after rolling over to a Precious Metals IRA?",
        a: "Yes — you can maintain both accounts. The rollover moves existing funds; new SEP contributions go into your SEP IRA and can be transferred again in the future.",
      },
      {
        q: "Is a SEP IRA rollover different from a 401(k) rollover?",
        a: "The tax treatment is similar — both are tax-deferred accounts. The process differs in that SEP IRAs are already held at a financial institution, so the transfer request goes directly to that custodian.",
      },
      {
        q: "Do self-employed individuals have any special considerations?",
        a: "Not in terms of IRS rules for the metal itself. However, self-employed investors should confirm their business structure does not restrict certain transactions. A CPA familiar with self-employment retirement accounts is advisable.",
      },
    ],
  },
  {
    slug: "403b",
    name: "403(b) to Precious Metals IRA",
    shortName: "403(b)",
    description:
      "A 403(b) plan — used by teachers, healthcare workers, and employees of non-profit organizations — can be rolled over to a self-directed IRA holding physical precious metals after leaving employment or reaching age 59½. The process mirrors a 401(k) rollover.",
    keyFacts: [
      "Available to employees of public schools, 501(c)(3) non-profits, and hospitals",
      "Eligible for rollover upon separation from service, retirement, or at age 59½",
      "Direct rollover avoids immediate tax and mandatory withholding",
      "Some 403(b) plans have surrender charges or waiting periods — check your plan",
      "Rolled funds maintain tax-deferred status in the new self-directed IRA",
    ],
    faqs: [
      {
        q: "Can a 403(b) be rolled over while still teaching or employed?",
        a: "Generally only after reaching 59½ or separating from service. Some plans allow hardship distributions, but those are not rollover-eligible. Confirm with your plan administrator.",
      },
      {
        q: "Are there surrender charges on 403(b) annuity products?",
        a: "Many 403(b) accounts are invested in annuities, which may have surrender charge periods. If charges apply, it may be worth waiting until the surrender period ends. We can help you think through the timing.",
      },
      {
        q: "How is a 403(b) rollover reported to the IRS?",
        a: "Your plan administrator issues a 1099-R. Because it is a direct rollover, the distribution code indicates it is not taxable. You report the rollover on your Form 1040 but owe no taxes.",
      },
    ],
  },
  {
    slug: "tsp",
    name: "TSP to Precious Metals IRA",
    shortName: "TSP",
    description:
      "The Thrift Savings Plan (TSP) is the federal government's retirement savings program for military members and civilian federal employees. Upon separation from federal service or retirement, TSP funds can be rolled over to a self-directed IRA to hold physical gold and silver.",
    keyFacts: [
      "Available to federal civilian employees and uniformed service members",
      "Rollover eligible after separation from service, retirement, or at age 59½",
      "TSP requires a specific rollover election — funds are not automatically transferable",
      "Direct rollover to a traditional IRA preserves tax-deferred status",
      "Roth TSP funds can roll to a Roth IRA — preserving tax-free growth",
    ],
    faqs: [
      {
        q: "Can I roll over my TSP while still in federal service?",
        a: "Active federal employees are generally not eligible to roll over TSP funds. Separation from service — retirement, resignation, or end of military service — is typically required.",
      },
      {
        q: "Does the TSP allow partial rollovers?",
        a: "Yes. TSP allows partial distributions, meaning you can roll over a portion of your account to a self-directed IRA and keep the remainder in TSP.",
      },
      {
        q: "Is the rollover process different from a 401(k)?",
        a: "The TSP has its own withdrawal and rollover process through the TSP website. You initiate the rollover directly with TSP, designating the receiving IRA custodian. The underlying tax rules are the same as a 401(k) rollover.",
      },
    ],
  },
  {
    slug: "457b",
    name: "457(b) to Precious Metals IRA",
    shortName: "457(b)",
    description:
      "A 457(b) plan is a deferred compensation plan used by state and local government employees and some non-profit employees. Unlike 401(k) and 403(b) plans, 457(b) accounts have no 10% early withdrawal penalty — making them flexible for rollovers at any age after leaving employment.",
    keyFacts: [
      "No 10% early withdrawal penalty — a key advantage over 401(k) and 403(b)",
      "Eligible for rollover upon separation from service at any age",
      "Government 457(b) plans can roll to traditional IRAs, 401(k)s, and 403(b)s",
      "Non-governmental 457(b) plans have more restrictions — check eligibility carefully",
      "Rolled funds are subject to standard traditional IRA rules in the receiving account",
    ],
    faqs: [
      {
        q: "Can I roll a 457(b) to a Precious Metals IRA without penalty?",
        a: "Yes — government 457(b) plans have no early withdrawal penalty regardless of age. Once rolled to a traditional IRA, the receiving IRA rules apply for future distributions.",
      },
      {
        q: "What is the difference between a government and non-governmental 457(b)?",
        a: "Government 457(b) plans (state and local employees) can roll to IRAs and other qualified plans. Non-governmental 457(b) plans (some non-profits) typically cannot — distributions are more restricted.",
      },
      {
        q: "Do I have to wait until retirement age to roll over my 457(b)?",
        a: "No. Upon separation from service at any age, government 457(b) funds can be rolled over without penalty. This is one reason 457(b) plans are particularly flexible for investors who retire early.",
      },
    ],
  },
  {
    slug: "simple-ira",
    name: "SIMPLE IRA to Precious Metals IRA",
    shortName: "SIMPLE IRA",
    description:
      "A SIMPLE IRA (Savings Incentive Match Plan for Employees) is a retirement plan for small businesses with 100 or fewer employees. SIMPLE IRA funds can be rolled over to a self-directed precious metals IRA, but there is an important two-year waiting rule that applies after your first contribution.",
    keyFacts: [
      "Must have participated in the SIMPLE IRA for at least 2 years before rolling to a traditional IRA",
      "After the 2-year period, rollovers to traditional IRAs are permitted without penalty",
      "Within the 2-year period, funds can only be rolled to another SIMPLE IRA",
      "The 25% early withdrawal penalty (vs. standard 10%) applies within the 2-year window",
      "After the 2-year period, standard 10% early withdrawal rules apply if under 59½",
    ],
    faqs: [
      {
        q: "What happens if I roll over before the 2-year waiting period?",
        a: "If you withdraw or roll to a non-SIMPLE IRA within 2 years of first participating, the penalty is 25% (not the standard 10%). After 2 years, the standard early withdrawal rules apply.",
      },
      {
        q: "How do I know when my 2-year period ends?",
        a: "The 2-year clock starts on the date the first contribution was made to your SIMPLE IRA — not when you started employment. Check your first contribution date with your plan administrator.",
      },
      {
        q: "Can I roll over immediately if I leave my employer after the 2 years?",
        a: "Yes. Once the 2-year period has passed, leaving your employer makes the funds eligible for rollover to a traditional IRA without penalty (assuming you are not under 59½ — standard rules then apply).",
      },
    ],
  },
  {
    slug: "pension",
    name: "Pension to Precious Metals IRA",
    shortName: "Pension",
    description:
      "Some pension plans — particularly defined-benefit plans that offer a lump-sum payout option — allow participants to roll their distribution into a self-directed IRA holding physical precious metals. Pension rollovers require careful coordination with your plan administrator.",
    keyFacts: [
      "Only lump-sum pension distributions are eligible for rollover — annuity payments are not",
      "Must elect rollover within 60 days of receiving a distribution (or use a direct rollover)",
      "Direct rollovers avoid mandatory 20% withholding on the distribution",
      "Not all pension plans offer a lump-sum option — check your Summary Plan Description",
      "Federal and state government pensions have their own rules — confirm with your HR office",
    ],
    faqs: [
      {
        q: "Can I roll over monthly pension payments into a Precious Metals IRA?",
        a: "No. Required minimum distributions and periodic annuity payments are not eligible for rollover. Only lump-sum eligible distributions can be rolled over.",
      },
      {
        q: "How do I know if my pension offers a lump-sum option?",
        a: "Request your Summary Plan Description from your HR department or plan administrator. It will specify whether a lump-sum is available and at what point in your career or retirement.",
      },
      {
        q: "Will I owe taxes on a pension rollover?",
        a: "A direct rollover — where the funds go from your pension plan directly to the IRA custodian — is not a taxable event. You report it on your return but owe no taxes. Taking a distribution first triggers mandatory withholding.",
      },
    ],
  },
];

export function getRolloverBySlug(slug: string): IraRolloverType | undefined {
  return IRA_ROLLOVERS.find((r) => r.slug === slug);
}
