export interface Caption {
  text: string;
  start: number;
  end: number;
}

export type SceneCaptionMap = Record<string, Caption[]>;

export const SCENE_CAPTIONS: SceneCaptionMap = {
  // intro: 9 000 ms — 2 lines
  intro: [
    { text: 'Meet Sally — a financial advisor onboarding new clients every week.', start: 600,  end: 4300 },
    { text: 'And Tom — her newest client, ready to get started.',                 start: 4700, end: 8600 },
  ],

  // problem1: 15 500 ms — 3 lines
  problem1: [
    { text: 'Every new client means six forms, eight pages, and fifty-plus fields to fill out.', start: 500,   end: 5300 },
    { text: 'Sally has to explain every document, every field, every format.',                   start: 5700,  end: 10500 },
    { text: "It's exhausting — and the risk of errors is high.",                                start: 11000, end: 15000 },
  ],

  // problem2: 15 500 ms
  problem2: [
    { text: 'When clients fill forms on their own, mistakes are inevitable.',        start: 500,   end: 5300 },
    { text: 'Wrong dates, missing signatures, mismatched data — it all comes back.', start: 5700,  end: 10500 },
    { text: 'Every error means starting over. Hours lost.',                           start: 11000, end: 15000 },
  ],

  // solution1: 15 500 ms
  solution1: [
    { text: 'So Sally builds a Docuplete package.',                                               start: 500,   end: 3800 },
    { text: 'She uploads the documents, maps every field, and creates one master questionnaire.', start: 4200,  end: 10000 },
    { text: 'Set it up once — ready for every client, forever.',                                  start: 10500, end: 15000 },
  ],

  // solution2: 15 500 ms
  solution2: [
    { text: 'Tom receives a single, clean questionnaire.',                    start: 500,   end: 5000 },
    { text: 'He answers simple questions — nothing more.',                    start: 5400,  end: 10000 },
    { text: 'No confusing forms. No formatting rules. Just his information.', start: 10500, end: 15000 },
  ],

  // solution3: 15 500 ms
  solution3: [
    { text: 'The moment Tom submits, Docuplete gets to work.',                   start: 500,   end: 4800 },
    { text: 'All six documents — all fifty-plus fields — populated in seconds.', start: 5200,  end: 10500 },
    { text: 'Zero copy-pasting. Zero errors. Every document ready.',              start: 11000, end: 15000 },
  ],

  // solution4: 15 500 ms
  solution4: [
    { text: 'The result: a complete, sealed document package.',                                         start: 500,   end: 4800 },
    { text: 'Accurate. Complete. E-signed and timestamped.',                                            start: 5200,  end: 9500 },
    { text: 'Sally gets compliant paperwork. Tom gets a frictionless experience. Everyone wins.',       start: 10000, end: 15000 },
  ],

  // outro: 14 271 ms — 3 lines
  outro: [
    { text: 'Docuplete — document automation for financial advisors and compliance-driven teams.', start: 600,   end: 5500 },
    { text: 'One questionnaire. Every document. Done.',                                           start: 6000,  end: 9500 },
    { text: 'Visit docuplete.com to get started today.',                                          start: 10000, end: 13800 },
  ],
};
