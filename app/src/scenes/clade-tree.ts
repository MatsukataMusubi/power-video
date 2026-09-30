// outroV (clade.ts): the sheet's geometry. A rectangular chronogram of the genus Homo on a log time axis
// (time runs right, the present at x = 0), laid out as a comb: the sapiens lineage is the straight backbone
// (y = 0) from the root, every other lineage hangs off it on its own row. The Neanderthal branch sits above
// the backbone and joins it again once (the reticulation at ~47 ka); the Denisovans hang between the two.
// Ages are rounded textbook values; branch lengths approximate (the figure says so).
import { lerp } from '../engine/util';

/** World units per decade of time (log axis). */
export const A = 1000;
/** Log offset (Ma): the axis reaches the present at x = 0. */
export const T0 = 0.0001;
/** x of an age in Ma (0 = present, the past to the left). */
export const X = (ma: number) => -A * Math.log10((ma + T0) / T0);
/** Age in Ma at x (inverse of X). */
export const ageAt = (x: number) => T0 * Math.pow(10, -x / A) - T0;

export const AGE = { root: 2.8, NS: 0.6, ND: 0.45, retic: 0.047, newNode: 0.00008 } as const;

export const ROW = { N: -1350, D: -675, S: 0, naledi: 300, erectus: 600, habilis: 900 } as const;

export interface Taxon {
  key: string;
  name: string;       // printed label (italic)
  range: string;      // mono fine print under it
  row: number;        // y of the lineage
  x0: number;         // node (where it leaves its parent)
  x1: number;         // tip (last appearance; 0 = extant)
  parentY: number;    // y of the parent lineage at the node
  extinct: boolean;
  labelAbove?: boolean;
  /** Fossil range (x0, x1): drawn as a bar; the rest of the lineage is inferred. */
  fossil?: [number, number];
  nodeAge?: string;
}

export const TAXA: Taxon[] = [
  { key: 'habilis', name: 'Homo habilis', range: '2.3–1.6 Ma', row: ROW.habilis, x0: X(2.4), x1: X(1.6), parentY: 0, extinct: true, fossil: [X(2.3), X(1.6)] },
  { key: 'erectus', name: 'Homo erectus', range: '1.9–0.11 Ma', row: ROW.erectus, x0: X(1.95), x1: X(0.11), parentY: 0, extinct: true, fossil: [X(1.9), X(0.11)], nodeAge: '1.95 Ma' },
  { key: 'naledi', name: 'Homo naledi', range: '0.34–0.24 Ma', row: ROW.naledi, x0: X(1.0), x1: X(0.236), parentY: 0, extinct: true, fossil: [X(0.335), X(0.236)], nodeAge: '~1 Ma' },
  { key: 'N', name: 'Homo neanderthalensis', range: '0.43–0.04 Ma', row: ROW.N, x0: X(AGE.NS), x1: X(0.04), parentY: 0, extinct: true, fossil: [X(0.43), X(0.04)], nodeAge: '~600 ka' },
  { key: 'D', name: 'Denisovans', range: 'no binomial', row: ROW.D, x0: X(AGE.ND), x1: X(0.06), parentY: ROW.N, extinct: true, labelAbove: true, fossil: [X(0.2), X(0.06)], nodeAge: '~450 ka' },
];

export const ROOT = { x: X(AGE.root), y: 0 };
/** The sapiens fossil range on the backbone. */
export const SAP_RANGE: [number, number] = [X(0.3), 0];
export const NS = { x: X(AGE.NS), y: 0 };          // the Neanderthal / sapiens split on the backbone
export const RET = { x: X(AGE.retic), y0: ROW.N, y1: 0 }; // the reticulation: from N down to the backbone
export const NEW_NODE = { x: X(AGE.newNode), y: 0 };
/** The new branch: straight, up and to the right, out of the grammar of the rest of the sheet. */
export const NEW_ANG = (30 * Math.PI) / 180;
export const NEW_DIR = { x: Math.cos(NEW_ANG), y: -Math.sin(NEW_ANG) };

/** The time axis. */
export const AXIS = { y: 1150, x0: X(3.0), x1: 0 };
export const PRESENT = { x: 0, y0: -1900, y1: AXIS.y };

/** The magnified reticulation edge (DETAIL A) and its short sequence bar (the gene). */
export const DET = {
  x0: -2560, x1: -880, y0: 470, y1: 1090, // frame
  bandY: 830, bandH: 104, bx0: -2480, bx1: -960, // the edge at 10⁶:1
  gx0: -2200, gx1: -1260, // the gene (sequence bar)
  circle: { x: RET.x, y: -1010, r: 110 }, // marker on the reticulation (between the Neanderthal and Denisovan rows)
};

/** Sheet frame and title block. */
export const SHEET = { x0: -4900, x1: 2750, y0: -2150, y1: 1620 };
export const TITLE = { x: 420, y: 900, w: 2200, h: 480 };

/** Short age label for chainage stamps: 31 ka, 850 yr. */
export function ageLabel(ma: number) {
  const ka = ma * 1000;
  if (ka >= 10) return `${Math.round(ka)} ka`;
  if (ka >= 1) return `${ka.toFixed(1)} ka`;
  return `${Math.max(10, Math.round((ka * 1000) / 10) * 10)} yr`;
}

export type P = { x: number; y: number };
export const lerpP = (a: P, b: P, k: number): P => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
