export interface Caption {
  text: string;
  start: number;
  end: number;
}

export type SceneCaptionMap = Record<string, Caption[]>;

export const SCENE_CAPTIONS: SceneCaptionMap = {
  intro: [
    { text: 'Meet Sally — a financial advisor onboarding new clients every week.', start: 800, end: 3000 },
    { text: 'And Tom — her newest client, ready to get started.', start: 3000, end: 5500 },
  ],
  problem1: [
    { text: 'Every new client means six forms, eight pages, and fifty-plus fields to fill out.', start: 400, end: 3500 },
    { text: 'Sally has to explain every document, every field, every format.', start: 3800, end: 6500 },
    { text: "It's exhausting — and the risk of errors is high.", start: 6800, end: 8700 },
  ],
  problem2: [
    { text: 'When clients fill forms on their own, mistakes are inevitable.', start: 400, end: 3200 },
    { text: 'Wrong dates, missing signatures, mismatched data — it all comes back.', start: 3400, end: 6500 },
    { text: 'Every error means starting over. Hours lost.', start: 7000, end: 9500 },
  ],
  solution1: [
    { text: 'So Sally builds a Docuplete package.', start: 400, end: 2500 },
    { text: 'She uploads the documents, maps every field, and creates one master questionnaire.', start: 2700, end: 6000 },
    { text: 'Set it up once — ready for every client, forever.', start: 6300, end: 9500 },
  ],
  solution2: [
    { text: 'Tom receives a single, clean questionnaire.', start: 500, end: 2800 },
    { text: 'He answers simple questions — nothing more.', start: 3100, end: 5800 },
    { text: 'No confusing forms. No formatting rules. Just his information.', start: 6200, end: 9500 },
  ],
  solution3: [
    { text: 'The moment Tom submits, Docuplete gets to work.', start: 400, end: 3000 },
    { text: 'All six documents — all fifty-plus fields — populated in seconds.', start: 3300, end: 6800 },
    { text: 'Zero copy-pasting. Zero errors. Every document ready.', start: 7200, end: 9700 },
  ],
  solution4: [
    { text: 'The result: a complete, sealed document package.', start: 400, end: 2800 },
    { text: 'Accurate. Complete. E-signed and timestamped.', start: 3100, end: 5500 },
    { text: 'Sally gets compliant paperwork. Tom gets a frictionless experience. Everyone wins.', start: 5800, end: 9500 },
  ],
  outro: [
    { text: 'Docuplete — document automation for financial advisors and compliance-driven teams.', start: 500, end: 3500 },
    { text: 'One questionnaire. Every document. Done.', start: 3800, end: 6000 },
    { text: 'Visit docuplete.com to get started today.', start: 6200, end: 7800 },
  ],
};
