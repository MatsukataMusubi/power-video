// Fine print for the connector datasheet (mate.ts): P(doom)'s next-token distributions become the
// pinout table's callouts. Each sung word is assigned to a pin; its callout lists the functions that
// pin could have had, with the sung word as the sampled row. The sung word itself always comes from
// ctx.lyrics (these are only the alternatives), keyed by the normalized word; unknown words get the
// fallback, so a proofread lyric never breaks a callout.

export type Cand = [text: string, p: number];
export interface Alt { p: number; alts: Cand[] }

export const ALT: Record<string, Alt> = {
  what: { p: 0.46, alts: [['N/C', 0.21], ['how much', 0.09], ['GND', 0.04]] },
  will: { p: 0.52, alts: [['would', 0.19], ['SHIELD', 0.08], ['RESERVED', 0.03]] },
  it: { p: 0.61, alts: [['you', 0.14], ['KEY', 0.06], ['N/C', 0.02]] },
  take: { p: 0.44, alts: [['cost', 0.23], ['draw (mA)', 0.09], ['GND', 0.04]] },
  to: { p: 0.71, alts: [['TX', 0.12], ['RX', 0.08], ['N/C', 0.02]] },
  make: { p: 0.48, alts: [['let', 0.26], ['force', 0.07], ['RESERVED', 0.03]] },
  you: { p: 0.62, alts: [['CONSENT (optional)', 0.21], ['N/C', 0.09], ['GND', 0.03]] },
  capitulate: { p: 0.38, alts: [['mate', 0.29], ['comply', 0.11], ['power down', 0.06]] },
  soon: { p: 0.41, alts: [['later', 0.22], ['never', 0.09], ['TBD', 0.05]] },
  as: { p: 0.57, alts: [['if', 0.18], ['once', 0.09], ['N/C', 0.03]] },
};
export const ALT_FALLBACK: Alt = { p: 0.5, alts: [['N/C', 0.2], ['RESERVED', 0.08], ['GND', 0.04]] };

/** The title block under the drawing (P(doom)'s PROMPT label, params and value line). */
export const META: Record<number, { no: string; spec: string; value: string; dwg: string }> = {
  1: { no: '01', spec: 'Durability: 1 mating cycle · keying A · shell 21', value: 'Rated power: context-dependent', dwg: 'DWG MX-07 · HALF SECTION · 4:1' },
  2: { no: '02', spec: 'mating force: optional · keying — · shell 21', value: '', dwg: 'DWG MX-07 · HIDDEN LINES · 4:1' },
  3: { no: '03', spec: 'Durability: 1 mating cycle · keying A · shell 21', value: '', dwg: 'DWG MX-07 · HALF SECTION · 4:1' },
};

/** Total contacts in the insert (the context size of the counter). */
export const CONTACTS = 37;

/** Leader-line readout at the lock. */
export const CALLOUT: Record<number, string> = {
  1: 'MATED   0.00 mm',
  2: 'MATE 50%   SEATING',
  3: 'MATED   37/37',
};

/** Typed after ⏎ (sydney's reply). */
export const VERDICT: Record<number, string> = {
  3: 'mating cycles remaining: 0',
};
