# We Appreciate Power: treatment & style bible (v2.1: direction A, no figurative body, 2026-09-28)
> **2026-09-28:** P(doom)'s structure is followed completely, with only the imagery ours. The approved mapping in `docs/PDOOM-STRUCTURE.md` replaces the plates table below (plate imagery: `docs/PLATES.md`); the rules and palette here stay. New: a thread object across every cut, a drawing language per plate, an escalating value on the hooks, an open ending.

The counterpart to P(doom): that video was about humans being ended by AI; this one is about
humans and AI **living together**. Same engine and craft, the opposite argument. (The counterpoint
lives in the concept only: nothing on screen names P(doom).)

Times are in edit time: edit A with a cold open (`analysis/edit.json`, 215.3 s), starting on
the first chorus for social feeds. 108.00 BPM, 4/4, bar = 2.222 s, first downbeat 0.045 s ("We"
lands on it). Look lines up by content through the `Lyrics` API, never hard-code times. The full
lyric text lives only in the local, gitignored `lyrics/`.

## The idea

**An assembly sequence**: something is being built, part by part, by two makers working together.
The human draws: bone-white, by hand, outlines that wobble and boil. The machine places, measures,
etches and locks: one vivid accent colour, exact, quantised. Every plate is a stage of the build
(parts locking around a datum, a connector that has to mate, a constellation of parts related by
dimension lines…), and every stage needs both makers. **What is being built is never shown as a
recognisable thing**: no head, no spine, no body (see rule 6). The machine
starts out misreading the human (misassembled blocks, pins that miss their sockets) and learns
over the song; the song's surrender ("submit") ends as a merge of the two, the way Ghost in the
Shell ends with two minds choosing to merge.

The look comes from research into the 1995 film's art direction (see DECISIONS): a muted,
grey-green palette where only one colour is vivid; bone-white parts assembled by machine; hectic
numerals as in its opening titles; weight and restraint rather than flash. Our own imagery
throughout: none of the film's shots, characters or logos.

## Rules the director has set (keep to them in every plate)

1. **The lyric is never a caption.** Every line lives on an object of the scene (built from
   blocks on the grid, handwritten along a contour, laser-etched into a part, split across two
   mating faces…) and has an in-world cursor (the gantry, the pen, the laser, the sweep across a
   seam). No centred, left-to-right subtitle.
2. **No persistent HUD or overlay.** Information appears only when something happens and stays
   attached to the thing it describes: a numeral flash of ~7 frames on a hard cut, a leader-line
   readout beside a part as it locks, gone within half a second. No readout columns, meters,
   waveforms or status bars that sit on screen.
3. **Punchy.** Hard cuts on words and downbeats, parts that lock on the hit, kicks that punch the
   camera, 70 ms slides; no soft easing between states.
4. **No P(doom)** on screen: no readout, no orange.
5. **Not ordinary:** no vaporwave, no neon look (see Neon), no stock "AI" imagery.
6. **No figurative body.** Code draws geometry, typography and measurement well and organic
   wholes badly, so nothing on screen depicts a head, a skeleton or a body. Break the assembly
   into parts (plates, bars, rings, blocks) scattered as an exploded view; relate them
   conceptually, through dimension lines, datum axes, part numbers and the shared grid, never by
   joining them into a figure. The pre-chorus connector is a part, not a body, and stays.

## Palette

- Ground: graphite grey-green (`#0C0E0E` → `#1A1E1D`) with a faint engineering grid (60/240 px).
- Parts: bone `#E8E6DF` with graphite seams; machine parts graphite `#1F2322`–`#3A403E`.
- **Accent: submit blue `#2F5BFF`** (the machine; the word being sung). Only the accent glows.
  The accent is a scene param: a 1995-style data green was compared and is available.
- No orange, no other hues.

## Typography

- Archivo 62/900 (tall, condensed, machined): the hook words, built, etched, stamped.
- IBM Plex Mono: the machine's stencil text and its readouts.
- Single-stroke script (`hscript`): anything the human writes.

## Glitch: misunderstanding, not decoration

A glitch happens only when the two makers misread each other: slice displacement (bands of rows
read from the side), misplaced blocks, pins scraping a face. On snares and hits, a few frames,
seeded by `frameIdx(t)`. Heaviest at the start, fading as they learn, none after the merge.

## Neon: one subtle accent (director's call)

Only the accent, only on a machine part, at most three short moments, flicker only on snares.
Never a neon environment.

## Ban list

- Neon or vaporwave as a look; rainy streets, holographic billboards, stacked signage, code rain,
  hex HUDs; persistent HUD overlays.
- Symbiosis clichés: a robot hand touching a human hand, half-human half-circuit faces, glowing
  brains, binary DNA.
- Ghost in the Shell imagery or characters (no Section 9, Major, Laughing Man, Tachikoma, no copied
  shell-assembly shot).
- No likeness of the singer or any real person; no logos or real product UIs.

## Plates

Built (✓) and proposed. Proposals are one-liners to be designed like the built ones before building.

| section | window (edit s) | plate |
|---|---|---|
| ✓ chorus1 | 0 → 13.4 | `shell.ts`. The hook built from blocks on the grid (WE / APPRECIATE / POWER, asymmetric, a gantry as cursor), the machine's misread copy resolving into the letterforms and a hand's outline; six parts fly in and lock around a datum on 8ths while the hand draws a datum arc and writes "elevate the human race" along it; "let it wake up on my face" laser-etched down a rail, an aperture at the datum opening on "wake", a raster scan on "on my face"; the hook laser-etched into three of the parts in hard-cut close-ups, then the whole assembly. |
| ✓ pre2 | 13.4 → 17.8 | `dock.ts` n=1. Two halves of a connector close one step per beat; "what will it take" handwritten on the human half, "TO MAKE YOU" etched on the machine half; CAPITULATE? split across the faces, appearing on the slam. The pins miss: the halves jam, the word stays broken. |
| ✓ chorus2 | 17.8 → 40.1 | `field.ts`. Each hook word a part (plate / bar / ring / block) locking into a scattered constellation on three parallax planes, related by dimension lines with readouts; the "cooperate" line etched along a bent rail fitted between two rings; at the first bass drop the whole constellation, the accent surging through the dimension network, a framing per bar, a pulse per kick. |
| verse2 | 40.1 → 75.6 | (proposal) "The world's most powerful computer": a lattice of identical blocks (racks) filling in on the grid, addressed by row/column readouts; on "simulation" the lattice flips to its own wireframe and the hand redraws it. |
| bridge | 75.6 → 111.2 | (proposal) "plug in", "not even alive", "backed up on the drive": the parts built so far copied one by one onto a second constellation (the backup), each copy verified by a dimension line between original and copy; a flatline glitch on "not even alive" that the copy brings back. |
| pre4 / pre5 | 111.2 / 128.9 | `dock.ts` n=2 (half-lock, "MATE 50%") and n=3 (full lock, the word whole). |
| chorus4 | 115.6 → 128.9 | (proposal) The constellation from chorus 2 revisited denser: parts locking between the existing ones, the hook etched across several at once. |
| chorus5 | 133.4 → 164.5 | (proposal) The widest chorus: the densest constellation, every dimension line closed; the one neon moment on POWER. |
| instrumental | 164.5 → 177.8 | (proposal) The two makers' parts (bone and graphite) interleave into one lattice; the camera drifts through it. |
| outro | 177.8 → 186.7 | (proposal) "Neanderthal to human being…": a phylogenetic tree drawn as an assembly drawing, hominid and machine branches converging. |
| submit | 186.7 → 204.5 | (proposal) A git graph: a human branch and a machine branch, a commit per sung "submit", ending in a merge commit; the glitch drops to zero. |
| tail | 204.5 → 215.3 | (proposal) One line runs on off the frame. No loop: it continues. |

## Karaoke rules

Every line readable and synced per word (highlight at `start`, complete by `end`); anticipation
only as a faint guide; the sung word in the accent. See rule 1 for where the words live.

## Open points

1. **Lyrics:** whisper disagrees with itself on many lines; verse 2 and the bridge depend on the
   proofread text (`lyrics/PROOFREAD.md`).
2. **Accent:** blue (default) vs data green.

## Technical conventions

See `docs/ENGINE.md`: deterministic (every frame a function of song time), per-word sync,
beat-synced motion, hard cuts on downbeats. Shared kit for direction A: `scenes/_shell.ts`.
