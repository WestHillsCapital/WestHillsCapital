export interface Caption {
  text: string;
  start: number;
  end: number;
}

export type SceneCaptionMap = Record<string, Caption[]>;

export const SCENE_CAPTIONS: SceneCaptionMap = {
  // intro: 9 s — 2 lines, ~4.5 s each
  intro: [
    { text: 'Meet Sally — a financial advisor onboarding new clients every week.', start: 600,  end: 4200 },
    { text: 'And Tom — her newest client, ready to get started.',                 start: 4600, end: 8600 },
  ],

  // problem1: 15 s — 3 lines, ~4.5 s each
  problem1: [
    { text: 'Every new client means six forms, eight pages, and fifty-plus fields to fill out.', start: 500,  end: 5000 },
    { text: 'Sally has to explain every document, every field, every format.',                   start: 5400, end: 10000 },
    { text: "It's exhausting — and the risk of errors is high.",                                start: 10500, end: 14500 },
  ],

  // problem2: 15 s
  problem2: [
    { text: 'When clients fill forms on their own, mistakes are inevitable.',       start: 500,  end: 5000 },
    { text: 'Wrong dates, missing signatures, mismatched data — it all comes back.', start: 5400, end: 10000 },
    { text: 'Every error means starting over. Hours lost.',                          start: 10500, end: 14500 },
  ],

  // solution1: 15 s
  solution1: [
    { text: 'So Sally builds a Docuplete package.',                                                    start: 500,  end: 3500 },
    { text: 'She uploads the documents, maps every field, and creates one master questionnaire.',      start: 4000, end: 9500 },
    { text: 'Set it up once — ready for every client, forever.',                                       start: 10000, end: 14500 },
  ],

  // solution2: 15 s
  solution2: [
    { text: 'Tom receives a single, clean questionnaire.',          start: 500,  end: 4500 },
    { text: 'He answers simple questions — nothing more.',          start: 5000, end: 9500 },
    { text: 'No confusing forms. No formatting rules. Just his information.', start: 10000, end: 14500 },
  ],

  // solution3: 15 s
  solution3: [
    { text: 'The moment Tom submits, Docuplete gets to work.',                  start: 500,  end: 4500 },
    { text: 'All six documents — all fifty-plus fields — populated in seconds.', start: 5000, end: 10000 },
    { text: 'Zero copy-pasting. Zero errors. Every document ready.',             start: 10500, end: 14500 },
  ],

  // solution4: 15 s
  solution4: [
    { text: 'The result: a complete, sealed document package.',                                         start: 500,  end: 4500 },
    { text: 'Accurate. Complete. E-signed and timestamped.',                                            start: 5000, end: 9000 },
    { text: 'Sally gets compliant paperwork. Tom gets a frictionless experience. Everyone wins.',       start: 9500, end: 14500 },
  ],

  // outro: 12 s — 3 lines
  outro: [
    { text: 'Docuplete — document automation for financial advisors and compliance-driven teams.', start: 600,  end: 5000 },
    { text: 'One questionnaire. Every document. Done.',                                           start: 5500, end: 8500 },
    { text: 'Visit docuplete.com to get started today.',                                          start: 9000, end: 11500 },
  ],
};
