1	# P(doom) storyboard structure (reference for the rebuild)
2	
3	Status: Stage 1 of the rebuild plan ("learn first"). Director's instruction, 2026-09-28: keep P(doom)'s structure completely and swap only the imagery for ours. The mapping at the end was **approved by the director on 2026-09-28**, with an open ending instead of the loop.
4	
5	A companion report with the reference frames was made alongside the director's own P(doom) breakdown (not in the repo; the frames can be re-rendered from upstream, see below).
6	
7	Sources: upstream `mexicat/pdoom-video` at `bdbad53` (scene file:line references below point there). Times are recomputed from the scenes' own rules over `data/lyrics.json` and `data/audio.json`; the 22 windows were checked against the app's exported timeline (all equal). Bar.beat counts from the first downbeat (0.238 s), 132 BPM, bar = 1.818 s; a third field is the percentage into the beat. Reference stills: `out/ref/pdoom/shots/` (one per shot, at 40% of its duration) and `out/ref/pdoom/handoffs/` (1/60 s before and at each cut), rendered from the local checkout with 1 sample per frame.
8	
9	## Rules to carry over
10	
11	1. **Cuts follow the phrasing, not the bar.** A plate starts on the last beat at or before its line's first word (`timeline.ts:17-20`), so a cut is never late and always on a beat. 7 of 22 land on a downbeat, 10 on beat 2. Exceptions: `dense` widens the tolerance to 50 ms ("Post" is 32 ms early); `outro` starts at the audio section.
12	2. **Every cut is designed; no crossfades.** Windows touch, so the engine's crossfade never runs. Of 21 cuts, 13 are shape relays (the last shape of one plate is the first of the next), 6 are treated (white flash, slam, tear, burn-out, ink/paper flip, cut mid-move), 2 are plain. The outro loops back to frame 1.
13	3. **Density.** 4–16 camera states per plate, 0.7–1.8 s each (170 over 156.65 s, mean 0.92 s). Reframes land on sung words or on the grid.
14	4. **Exactly one maximal hit per plate.** Shake, flash and punch frames are saved for it; otherwise 2–4 % beat punches. Sometimes the hit is the absence of motion (stack's dead stop).
15	5. **Energy ramps by subdivision:** beats → 8ths → 16ths → 32nds (room, shoggoth, paperclips, open).
16	6. **Camera grammar:** outExpo for snaps and whips, springs for roll, inCubic for dives and exits; shake only on the hit.
17	7. **Light only at chorus entries and one paper stretch** (hook1 bone, hook2 orange field, hook4 strobe; ascent B/C and bureau), then ~75 s dark with the signal colour as the only light.
18	8. **Picture energy follows the arrangement:** drums out = quiet plates; bass stops on every hook pickup; the valley is the breakdown chorus; the peak is hook 4; the biggest single hit is the outro's first frame.
19	9. **Recurring things escalate:** prompt ×3 (word cuts → word + grid cuts → glides only) and hook ×4 (loud → heavier, inverted field → zeroed hairlines → strobe).
20	
21	## Song-form treatment
22	
23	| section type | treatment | plates |
24	|---|---|---|
25	| verse | one "instrument" per plate, a 2D camera over a flat document; the lyric written into it | open, loss, spacetime, bureau, leftturn |
26	| pre-chorus | always the prompt template: tokens on words, ⏎ on the grid | prompt ×3 |
27	| chorus | hook slam (1 bar), a 3D "world" plate (~1 bar per line), a tail plate into the next section | hook → room / ascent / paperclips / loom → shoggoth / bureau / fuse / ilya |
28	| breakdown chorus | the same templates in their quietest variant | prompt3, hook3, paperclips, fuse |
29	| bridge | mechanical, quantised: a block per beat, a compression per kick | stack, dense |
30	| final chorus | recursion and a dive, then the camera calms (orbit, locked-off theatre) | loom, ilya |
31	| outro | static frame, a graphic cut per beat, loop to frame 1 | outro |
32	
33	## The 22 entries
34	
35	| # | id | window (s) | bars | kind | shots | mean shot (s) | max hit (s) |
36	|---|---|---|---|---|---|---|---|
37	| 1 | open | 0.000–9.328 | 5.13 | verse | 12 | 0.78 | 0.238 |
38	| 2 | loss | 9.328–16.601 | 4.00 | verse | 6 | 1.21 | 11.175 |
39	| 3 | prompt1 | 16.601–22.509 | 3.25 | prompt (chatgpt) | 5 | 1.18 | 22.055 |
40	| 4 | hook1 | 22.509–24.328 | 1.00 | hook 1 | 7 | 0.26 | 23.866 |
41	| 5 | room | 24.328–29.782 | 3.00 | chorus world | 6 | 0.91 | 25.577 |
42	| 6 | shoggoth | 29.782–38.418 | 4.75 | chorus tail | 6 | 1.44 | 31.140 |
43	| 7 | spacetime | 38.418–52.508 | 7.75 | verse | 9 | 1.57 | 41.599 |
44	| 8 | prompt2 | 52.508–58.871 | 3.50 | prompt (sydney) | 8 | 0.80 | 58.750 |
45	| 9 | hook2 | 58.871–60.235 | 0.75 | hook 2 | 6 | 0.23 | 60.180 |
46	| 10 | ascent | 60.235–69.780 | 5.25 | chorus world | 9 | 1.06 | 62.020 |
47	| 11 | bureau | 69.780–81.143 | 6.25 | verse | 16 | 0.71 | 71.120 |
48	| 12 | leftturn | 81.143–88.870 | 4.25 | verse | 10 | 0.77 | 82.960 |
49	| 13 | prompt3 | 88.870–95.233 | 3.50 | prompt (gato) | 5 | 1.27 | 94.778 |
50	| 14 | hook3 | 95.233–96.596 | 0.75 | hook 3 | 6 | 0.23 | 96.560 |
51	| 15 | paperclips | 96.596–102.051 | 3.00 | chorus world | 8 | 0.68 | 100.641 |
52	| 16 | fuse | 102.051–109.778 | 4.25 | chorus tail | 9 | 0.86 | 105.687 |
53	| 17 | stack | 109.778–115.232 | 3.00 | bridge | 4 | 1.36 | 114.323 |
54	| 18 | dense | 115.232–124.322 | 5.00 | bridge | 6 | 1.52 | 118.413 |
55	| 19 | hook4 | 124.322–126.140 | 1.00 | hook 4 | 6 | 0.30 | 125.660 |
56	| 20 | loom | 126.140–131.595 | 3.00 | chorus world | 8 | 0.68 | 127.540 |
57	| 21 | ilya | 131.595–140.230 | 4.75 | chorus tail | 8 | 1.08 | 132.958 |
58	| 22 | outro | 140.230–156.651 | 9.03 | outro | 10 | 1.64 | 140.230 |
59	
60	## Hand-offs
61	
62	| # | from → to | at (s) | type | how |
63	|---|---|---|---|---|
64	| 1 | open → loss | 9.328 | object hand-off | spark (the pen) moved to loss's first-frame pixel; crop marks fly out |
65	| 2 | loss → prompt1 | 16.601 | hard cut mid-move | cut out of the 180° roll + dive on "boss", on the pre-chorus downbeat |
66	| 3 | prompt1 → hook1 | 22.509 | white flash | ⏎ rush + white flash, held as hook1's bone field until "I'M" |
67	| 4 | hook1 → room | 24.328 | object hand-off | P(DOOM) implodes to a spark; its outline bursts out and room shatters it |
68	| 5 | room → shoggoth | 29.782 | object hand-off + roll | SHROOMS flung at the lens into the exact layout shoggoth picks up |
69	| 6 | shoggoth → spacetime | 38.418 | shape match | CRT collapse to one orange line = the scope's "stable training run" |
70	| 7 | spacetime → prompt2 | 52.508 | foreshadowing only | atoms re-form as a paperclip (foreshadowing, no geometric match) |
71	| 8 | prompt2 → hook2 | 58.871 | slam shut → colour field | bars slam shut; hook2 opens on an orange field |
72	| 9 | hook2 → ascent | 60.235 | geometric match | orange field closes like eyelids onto the basilisk eye's glowing seam |
73	| 10 | ascent → bureau | 69.780 | ink → paper flip | dark odometer to bone paper: the only full ink-to-paper flip |
74	| 11 | bureau → leftturn | 81.143 | page tear | page rips and falls to black; leftturn fades up in 0.12 s |
75	| 12 | leftturn → prompt3 | 88.870 | shape match | empty CDR slot becomes gato's caret at the same screen position |
76	| 13 | prompt3 → hook3 | 95.233 | object hand-off | "go" + cursor left alone at centre |
77	| 14 | hook3 → paperclips | 96.596 | burn-out | filaments burn out; the spark re-ignites on black and bends into the first clip |
78	| 15 | paperclips → fuse | 102.051 | graphic match | ceiling closes to one orange horizon line = fuse's far hairline |
79	| 16 | fuse → stack | 109.778 | inhale into the spark | last half beat: camera inhales into the spark, lands on the tower axis |
80	| 17 | stack → dense | 115.232 | plain hard cut | "disobey" backwards wipe finishes on stack's last frame |
81	| 18 | dense → hook4 | 124.322 | camera-angle hand-off | roll ends at −0.12 rad, hook4's opening angle; snaps straight on "I'M" |
82	| 19 | hook4 → loom | 126.140 | shape match | the 9-string squashes into loom's weft line, shuttle spark at (300, 629) |
83	| 20 | loom → ilya | 131.595 | dive lands on the next first frame | the Droste recursion bottoms out in ilya's room; the dive lands on its first frame |
84	| 21 | ilya → outro | 140.230 | collapse to a point | curtain seam collapses to a centred spark; the outro detonates there |
85	| 22 | outro → open | 156.651 → 0 | loop to frame 1 | Regenerate: plates rewind, the opening plays backwards and parks on frame 1 |
86	
87	## Shot tables
88	
89	Per shot: start, bar.beat, duration, trigger, camera, picture/lyric, sync/exit. Hook rows are summarised from the hook comparison. Rows marked ↑ share the previous row's description (one table row covered several shots).
90	
91	### open (0.000 → 9.328, verse)
92	
93	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
94	|---|---|---|---|---|---|---|---|
95	| 1 | 0.000 | pre | 0.24 | key `K(0)` and `K(B(0))` :208-209 | static, very tight (z 560), tilted 0.34 rad | black; the spark alone | holds for the first downbeat |
96	| 2 | 0.238 | 0.1 | 0.43 **HIT** | `B(0)` :210, :327-361 | pull-back z 560→236, roll 0.34→0.07, **outExpo** | ignition: axes and 30° rays shoot out, ticks cascade, TikZ prompt types | flash + shake 9 + 700-particle burst on the downbeat (:709-712) |
97	| 3 | 0.672 | 0.2 | 0.61 | `B(1)`, `B(2)` :211, :364-389 | settles z 214, inOutQuad | compass sweeps r=2 with protractor ticks; ellipse bounding box on `B(2)` | one primitive per beat |
98	| 4 | 1.287 | 0.3.30 | 0.74 | `I.start ± 0.12` :212-213 | **whip** to the "I" (z 200→380, roll −0.035, inOutCubic), then push to z 470 | "I" plotted as a TikZ rectangle with type-specimen metrics | pen draws the I on the sung word (1.407) |
99	| 5 | 2.026 | 0.4.93 | 1.62 | `B(4)+0.34` :215 | snap pull-out to wide z 112, **outExpo**, landing on the downbeat | unicorn built from primitives; "I see sparks of" in the column | body on 1.1; **legs one per 16th** from 1.2; tail on 1.3; neck/head on the 8th; mane on 1.4 (:420-444). Zoom punches: 1.6% on downbeats, 0.7% on beats 2–4 (:706-707) |
100	| 6 | 3.647 | 1.4.49 | 0.69 | `AGI.start+0.26` :216-217 | **snap** onto horn + AGI (z 118→200, roll −0.065, outExpo) | horn streaks into a giant "AGI" | horn on AGI syllable 1, hatching on syllable 2, "spiral" note on syllable 3 (:447-459); punch 2.2%, shake 4 |
101	| 7 | 4.335 | 2.2 | 0.43 | `agi[2]` :218-220 | reframe on the "I" of AGI (z 236, outExpo) | — | "in your" |
102	| 8 | 4.769 | 2.3 | 1.10 | `eyes.start` :221 | **dive** across to the eye (z 244→372, inOutCubic) | eye drawn as a spiral dot, then an `r = 0.08` callout | lands exactly on "eyes" (5.263) |
103	| 9 | 5.870 | 3.1.39 | 0.28 | `Your.start+0.34` :222-223 | snap out to wide z 108 (outExpo) | strokes re-route into PCB traces | current pulses run along the traces **on every 8th** (:912-933) |
104	| 10 | 6.147 | 3.2 | 1.50 | `tCk2`, `tCk3` (nearest beat) :127-128, :224-227 | two small **step-ins** z 110→114→119 (outExpo, 0.18 s each) | checkpoints 2 (five legs) and 3 morph in | one step per beat. Tremor on "nervous" (7.04): shake up to 12, CA +5, **peaking on the 4.1 downbeat** (7.51) (:592-597) |
105	| 11 | 7.650 | 4.1.30 | 0.77 | `thats.start+0.3` :228-229 | **whip** left (cx 3.35→−3.95, outExpo) | "that's no surprise"; surprisal readout rolls to 0.00 nats | — |
106	| 12 | 8.419 | 4.3 | 0.91 | `tExit` = beat before the last one (:130), :230-231 | creep z 116→121 (inQuad) | crop marks fly out (`frame`, inOutCubic, :716); sheet fades (:598); the pen makes plotter pen-up moves to **loss's first-frame spark position**, computed by replaying loss's camera (`lossHandoff` :140-148, :561-575) | **Out:** the spark is handed across a hard cut on 5.1. "surprise" finishes its wipe just before the cut (:1087) |
107	
108	### loss (9.328 → 16.601, verse)
109	
110	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
111	|---|---|---|---|---|---|---|---|
112	| 1 | 9.328 | 5.1 | 1.33 | plate start | static chart, slow creep (z −0.5); **push-in** at `tPush` = 10.237 / 5.3 (beat nearest "sudden"), z 21.5→18, recentred on the cliff, outExpo 0.42 s (:521-526) | hairline log chart draws in (0.3 s outExpo). The spark sprints from the axis and then rides the write-head; "There was a sudden" sits on the curve | target jolts and shake 7 on "sudden" (:525, :598) |
113	| 2 | 10.660 | 5.3.92 | 0.52 | "drop" | swoop down after the falling spark, through the torn chart floor, onto the terrain (inOutCubic, fov 30→32) (:535-543) | cliff; the spark free-falls on a parabola timed to land on "in"; contour landscape revealed radially | floor tears at +0.2 s (outExpo) |
114	| 3 | 11.175 | 6.1.06 | 0.88 **HIT** | "in" (lands on the bar-6 downbeat) | orbit swing from overhead to the canyon side (yaw 0.35→1.2, pitch 1.02→0.66, inOutCubic 0.55 s) (:549-557) | "in your training loss," along the canyon floor | impact: **shake 12**, flash, ripple (:598, :665) |
115	| 4 | 12.055 | 6.3 | 0.91 | `tCut1` = beat nearest "in"+0.8 (:262) | **hard reframe**: low and close, looking down the canyon; from 12.55 pulls back toward the basin (:558-565) | spark accelerates toward the pit | — |
116	| 5 | 12.965 | 7.1 | 2.73 | `tCut2` = downbeat between the lines (:264-265) | **hard cut** to an oblique view over the basin, slow drift (:566-576) | "NOW I'M YOUR" typed; **SERVANT** slams at 13.719 (250 px, drops 50 px, outCubic 0.12 s) (:990-1020); the spark spirals 3 turns into the pit | cut: shake 9 + flash |
117	| 6 | 15.692 | 8.3 | 0.91 | `tRoll` = beat nearest "boss" (:266) | **roll 180°** in 0.45 s (inOutCubic), then a 0.13 rad overrun, plus a **dive** into the minimum (inCubic: distance 15.5→1.6, pitch→1.42, fov 34→64) (:570-590) | BOSS widens 62→125 and grows 120→270 px, coming upright; SERVANT condenses | contour pulses on **8ths, then 16ths** on the last beat (:618-619); **3% punch every beat**; shake/vignette/CA ramp (:597, :667). **Out: hard cut mid-dive** on the 9.1 downbeat |
118	
119	### prompt1 (16.601 → 22.509, prompt (chatgpt))
120	
121	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
122	|---|---|---|---|---|---|---|---|
123	| 1 | 16.601 | 9.1 | 2.48 | "ChatGPT," (held; tokens Chat / G / P / T, at 16.60, 17.24, 17.92, 18.36) | caret close-up, z 2.25, push 3%/s |  |  |
124	| 2 | 19.082 | 10.2.45 | 1.19 | "please" | cut to z 1.5 "typed", rot −0.018 |  |  |
125	| 3 | 20.270 | 11.1.07 | 1.08 | "eat" | cut to z 2.0 caret, rot +0.014; contraction wave runs down the throat (:261-262) |  |  |
126	| 4 | 21.350 | 11.3.44 | 0.70 | "alive" | cut to z 1.08, whole field |  |  |
127	| 5 | 22.055 | 12.1 | 0.45 **HIT** | ⏎ | the prompt is **swallowed**: zoom ×(1−0.93k) with inCubic k, rotation +0.9k², pulled to centre (:224-231); rings rush (camZ +16·rush^2.2), zoom-blur, shake up to 9, CA; **flash 0.9 in the last 0.1 s** (:308-314) → hook1 opens on a bone (white) field |  |  |
128	
129	### hook1 (22.509 → 24.328, hook 1)
130	
131	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
132	|---|---|---|---|---|---|---|---|
133	| 1 | 22.509 | 12.2 | 0.25 |  |  | pre-roll: bone white-out held over from prompt1 |  |
134	| 2 | 22.760 | 12.2.55 | 0.24 |  |  | I'M slams (bone on ink, shake 7) |  |
135	| 3 | 23.000 | 12.3.07 | 0.38 |  |  | UPPING slams, rises |  |
136	| 4 | 23.380 | 12.3.91 | 0.22 |  |  | MY |  |
137	| 5 | 23.600 | 12.4.40 | 0.27 |  |  | P(  |  |
138	| 6 | 23.866 | 13.1 | 0.17 **HIT** |  |  | DOOM on the downbeat: shake 10, +4% zoom; number rolls 0.02→0.15 after it |  |
139	| 7 | 24.035 | 13.1.35 | 0.29 |  |  | instrument implodes to a spark at room's root; P(DOOM) outline bursts out (outBack) → room shatters it |  |
140	
141	### room (24.328 → 29.782, chorus world)
142	
143	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
144	|---|---|---|---|---|---|---|---|
145	| 1 | 24.328 | 13.2 | 1.82 **HIT** | "'cause" (= plate start) | one 2D shot. **Exponential pull-back**, zoom 1.75→0.72 on a power curve, rot −0.07; **+8% punch on FOOM** (:321-326) | hook1's P(DOOM) outline shatters into debris; the spark splits once per generation, 1→2→…→1024 (10 generations) | generations **on 8ths** (24.33, 24.56, 24.78, 25.01, 25.24, 25.46), then **on 16ths after FOOM** (25.69–26.03) (:204-210). FOOM (25.577) steps through 6 widths (62→125), one per 16th (:496-500); shake 16, exposure +0.9, CA 2.5. Plate **burns out** (exposure ×6 over the last 0.12 s) (:475) → hard cut |
146	| 2 | 26.146 | 14.2 | 0.45 | beat nearest "Trapped" (:190) | **crash dolly** through the blown door, from behind the door: z ZF+0.55→−1.15, focal 520→900, ease 0.8·outCubic + 0.2·linear; dutch roll −0.5→−0.02 on a **spring** (:648) | library aisle, lights flickering (:780-787) | cut: flash 0.9, shake 12 (:918-925) |
147	| 3 | 26.600 | 14.3 | 0.46 | beat | **snap** in 0.13 s (outExpo from the previous shot), dutch 0.14, linear tracking down the aisle, roll wobble 0.05 (:650, :734-741) | "in the" stamped on the hanging board | every lyric word stamps: shake 5, +1.2% zoom (:921-927) |
148	| 4 | 27.055 | 14.4 | 0.45 | beat | snap 0.12 s, **low hero angle** from the left, roll −0.16 (:652) | 我不懂 cards fire from the slot | cards **on kicks** (:704) |
149	| 5 | 27.509 | 15.1 | 0.46 | downbeat | snap 0.09 s, **punch-in** on the board, focal 1150→1250, outCubic (:654) | "room," | books slide out **on hi-hats** (:717-719) |
150	| 6 | 27.964 | 15.2 | 1.82 | beat ("with") | **whip up** (snap 0.16 s) into a high **orbit** round the desk, accelerating (phi 0.78→−0.8) (:656, :660-676) | board flips on the snare (spring from 27.85) (:842); bag lands at 28.873 (15.4), shrooms at 29.124 (acid colour, mycelium, warp and echo trails) | punch-in + shake 14 on the landing; focal "breathes" ±14% per beat (:668, :675); rulebook riffles on 8ths, then 16ths; slot also fires off-beat 8ths. From 29.277 the orbit **tips into a roll to −1.15 rad** (inCubic) with warp +30 (:671, :778). **SHROOMS tears off the board toward the lens** (29.224→end) into the exact layout shoggoth picks up (:1407-1419) |
151	
152	### shoggoth (29.782 → 38.418, chorus tail)
153	
154	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
155	|---|---|---|---|---|---|---|---|
156	| 1 | 29.782 | 16.2 | 0.12 | plate start | **rush-in** from far: distance 7.5→0.95, inCubic (:217) | mask; room's SHROOMS letters finish in place (hangover, :750) | continuous with room's fling |
157	| 2 | 29.907 | 16.2.27 | 1.23 | "See" | locked close-up on the mask, slow push 0.95→0.9 (:216) | "see through the" on the mask's forehead; the X-ray band sweeps R→L on "through" (30.007), then L→R on "shoggoth's" (30.576), revealing the engraved creature | the band *is* the karaoke cursor |
158	| 3 | 31.140 | 17.1 | 1.82 **HIT** | "lies," | camera **yanked back** with the mask, outExpo 0.75 s, roll −0.05, then a drift (:231-238) | the mask snaps opaque and is snatched away by a tentacle; the full mass is revealed; LIES, engraved | shake 8 (:423). LIES, stretches **one width step per beat** through the held note (:461-465) |
159	| 4 | 32.963 | 18.1 | 0.44 | first downbeat after lies+0.8 (:167) | **hard reframe**: low angle from the left, roll 0.12, creeping in (outCubic) (:239-241) | the mass | cut: exposure +0.6, shake 5, zoom 3% (:424-432) |
160	| 5 | 33.400 | 18.2 | 4.56 | "with" | **hard cut** to a frontal view, slow push (inOutQuad) to the collapse; **0.1 push-kick on each downbeat** (34.78, 36.60) (:242-249) | 12 eyes open with ML detection boxes; shinigami tags on the left, wired to the eyes (with→1 eye, your→1, SHINIGAMI→4, EYES→all) (:605-614); P(doom) detector box at 35.691 (19.3); a full-frame "YOU" box at 36.145 (19.4) (:723-741) | eyes open **on 8ths, then 16ths** (33.42→35.24) (:175-179); throb every beat; shake on snares. Eyes then **close in an accelerating sequence**, spaced 1, 1, ½, ½, ¼, ¼, ⅛, ⅛, 1/16… beats, from 36.145 to 37.963 (:181-185) |
161	| 6 | 37.963 | 20.4 | 0.46 | last beat before the end (:171-172) | locked | CRT collapse into **one orange horizontal line** at mid-height (`flatK` 0.08–0.26 s, body off by +0.3 s) (:408-409) | **Out:** hard cut; spacetime starts from the same flatline, still white-hot (`spacetime.ts:296`) |
162	
163	### spacetime (38.418 → 52.508, verse)
164	
165	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
166	|---|---|---|---|---|---|---|---|
167	| 1 | 38.418 | 21.1 | 2.92 | plate start | **locked-off**, one imperceptible push (scale 1→1.06, drift −18 px, sine in-out to `tNow`) (:265-268) | phosphor scope under glass; the handed-over flatline cools (:296); lyric written by the beam | **beam sweeps once per beat** (:287); waveform drifts 1/16 of a wavelength per beat (:283-286); no punches |
168	| 2 | 41.340 | 22.3.42 | 0.26 | "But" | same | trace collapses to a point (CRT-off squeeze, inCubic) (:277) | — |
169	| 3 | 41.599 | 22.4 | 0.46 **HIT** | beat nearest "now" (:142) | handheld; roll kicked, then a spring back (:450) | black hole born as the O of NOW (outBack) | shake 16, CA +4, flash (:660-666) |
170	| 4 | 42.054 | 23.1 | 1.82 | downbeat (`tPlunge` :154) | **plunge through the O**: Z 1.06→2.05, outExpo 0.45 s; roll snap 0.16, then a dutch drift (:441-451) | BUT/NOW/THE fly apart; SINGULARITY'S wraps the photon ring | **4% crash zoom on every beat** (:444-446); shake 12 |
171	| 5 | 43.872 | 24.1 | 1.00 | next downbeat (`tDb2`) | **slam**: Z ×1.12 and the plane pitches back 0.72 (outExpo), roll −0.1 (:443, :464) | "begun" bends under the hole | shake 7 |
172	| 6 | 44.876 | 24.3.20 | 0.36 | before `tM3` | **fall through the horizon**: Rs→1500, inExpo (:453-455) | the frame goes black | — |
173	| 7 | 45.236 | 24.4 | 2.27 | beat of "And" (:144) | cut (render switch), then a **corkscrew crane** out of the throat: yaw −1.6→−0.5, pitch 1.45→0.72, distance 7.5→18.5, roll −0.9→−0.06, fov 50→34, outExpo 1 s (:711-715) | 3D spacetime sheet, streamlines, words orbiting on a ring | emerge shake 7; **flow speed ×1.2 per beat**, stepped with outExpo (:679-685); fov −1.8 punch each beat (:728-729) |
174	| 8 | 47.508 | 26.1 | 1.82 | downbeat nearest "accelerating" (:167) | **hard cut** to a low orbit, creeping in (:716-719) | "accelerating," stretches | shake 6 |
175	| 9 | 49.326 | 27.1 | 3.18 | downbeat (`tTop` :168) | **hard cut** straight down into the vortex (pitch 1.5), settle outExpo 0.5 s, slow corkscrew (roll −0.2 −0.45·t) and creep (:720-726) | "I feel my atoms rearranging" as dots; they detach from 51.38 and **re-form as a paperclip** drawn by the spark (51.78→52.408) (:242-258, :940-960) | **Out:** hard cut on 28.4 into prompt2 (paperclip foreshadowing, no geometric match) |
176	
177	### prompt2 (52.508 → 58.871, prompt (sydney))
178	
179	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
180	|---|---|---|---|---|---|---|---|
181	| 1 | 52.508 | 28.4 | 0.32 | plate start | z 1.9 caret |  |  |
182	| 2 | 52.825 | 28.4.69 | 1.50 | "Sydney," | z 1.6 caret |  |  |
183	| 3 | 54.326 | 29.4 | 0.91 | beat grid | z 2.5 caret, rot −0.03, dy 30 |  |  |
184	| 4 | 55.235 | 30.2 | 0.74 | beat grid | z 1.25 typed |  |  |
185	| 5 | 55.980 | 30.3.63 | 1.16 | "please" | z 1.32 typed |  |  |
186	| 6 | 57.140 | 31.2.19 | 0.63 | "me" | z 1.75 caret |  |  |
187	| 7 | 57.769 | 31.3.57 | 0.19 | "free" | z 1.05 field |  |  |
188	| 8 | 57.962 | 31.4 | 0.91 **HIT** | ⏎, 2 beats before the hook (:98) | z 0.92, a 0.25 s blend (the only one), dy 150 |  |  |
189	
190	### hook2 (58.871 → 60.235, hook 2)
191	
192	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
193	|---|---|---|---|---|---|---|---|
194	| 1 | 58.871 | 32.2 | 0.26 |  |  | pre-roll: signal-orange field, hairline grows from centre |  |
195	| 2 | 59.130 | 32.2.56 | 0.23 |  |  | I'M slams, ink on orange (shake 13) |  |
196	| 3 | 59.360 | 32.3.07 | 0.38 |  |  | UPPING |  |
197	| 4 | 59.740 | 32.3.91 | 0.22 |  |  | MY |  |
198	| 5 | 59.960 | 32.4.39 | 0.22 |  |  | P(: number starts rolling early |  |
199	| 6 | 60.180 | 32.4.87 | 0.06 **HIT** |  |  | DOOM = the cut: number squashes to a line, ink eyelids close onto ascent's eye seam |  |
200	
201	### ascent (60.235 → 69.780, chorus world)
202	
203	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
204	|---|---|---|---|---|---|---|---|
205	| 1 | 60.235 | 33.1 | 1.78 | plate start (matches hook2's lid framing, `hook.ts:36`) | **step-in ×1.075 per sung word** (outExpo 0.2 s) with alternating leans (:105-117) | closed engraved eye, light leaking through the seam; "I HEAR THE BASILISK" on the seam | leak pulses per beat (:159); raking light rotates in beat steps (:161-165); hairline lid cracks on the syllables of "basilisk" |
206	| 2 | 62.020 | 33.4.92 | 0.49 **HIT** | "boom" (≈34.1) | +0.18 zoom (outExpo), then **push ×3.2 into the pupil** (inCubic) (:119-120) | eye **snaps open** (outExpo 0.12 s), shockwave; pupil contracts to a white-hot slit (:144-158) | **shake 30/22**, flash 0.2, CA +7 (:236-241): the biggest hit in this set |
207	| 3 | 62.507 | 34.2 | 0.18 | snap("NVDA") (:62) | **match cut** from the slit to the vertical price line, then a zoom-out from ×8 to 0.8 (outExpo) (:297-305) | candle chart on banknote paper (a bright plate) | flash 0.3 on the cut |
208	| 4 | 62.690 | 34.2.40 | 0.72 | "V" syllable | **chase camera** following the price 35 ms late, tilting up (:307-314) | price climbs one step per NVDA syllable (62.54 / 62.70 / 62.94 / 63.22) (:276-291) | each syllable punches through a ceiling: zoom +2.5%, shake (:584-588) |
209	| 5 | 63.410 | 34.4 | 0.69 | "to"+0.05 | ease (outCubic) onto the moon framing, then a slow 1.0→1.06 push (:315-318) | price accelerates into the moon's south edge; guilloché moon | impact on "moon" (63.82): flash, shake |
210	| 6 | 64.100 | 35.1.50 | 2.04 | "The" (not snapped) | in-camera **pan** to centre the moon (inOutCubic), with +10% zoom (:598-600) | **paper turns black** in 0.12 s (`dark` :612); 180 rays converge on a white-hot point; lyric in Cormorant italic shrinking exponentially into it | a ring of light lands on the point **on every beat**; heat pulses run down rays per beat; the aperture turns one click per word (:623-663). Collapse in the last 0.2 s plus a **white flash** into D (:604, :697) |
211	| 7 | 66.144 | 36.2 | 1.36 | snap("One") | tight on the first drum (zoom 3.0), then from "thirty" (66.52) a **pull-out** to 0.97 tracking the rolling front (inOutCubic) (:748-756) | 31-drum odometer; "1 E 30 FLOP /s" tokens pop on each word (:787-817) | each token slams on its word |
212	| 8 | 67.507 | 37.1 | 0.91 | snap("second") | hold | drums lock at 10^30; wave of zeros settles left to right (:731-744) | "thunk": shake 18, flash (:849-853) |
213	| 9 | 68.416 | 37.3 | 1.36 | first beat ≥ lock+0.6 (:751) | **hard reframe on the beat**: zoom 2.25, tracking along the zeros toward the 1 (:757-762) | footnotes type out: "¹ …Rounded down, for safety." then "² P(doom) …" | sheen sweeps once per beat (:771). **Out:** hard cut on 38.2 to `bureau` |
214	
215	### bureau (69.780 → 81.143, verse)
216	
217	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
218	|---|---|---|---|---|---|---|---|
219	| 1 | 69.780 | 38.2 | 1.34 | plate start | Settles in (outExpo 0.6 s) from z 1.75 to 1.55, roll −0.06 → −0.035; tracks the typewriter carriage; carriage-return move at 70.890 (inOutCubic 0.17 s) | Form 7-B on bone paper; "That was safe enough," typed into FINDINGS, "we reckoned" into CONCLUSION | 1.8 px micro-shake per keystroke |
220	| 2 | 71.120 | 39.1 | 0.93 **HIT** | "reckoned" | **Hard cut** to wide, z 0.95 → 0.985, with a 5% zoom pulse | Orange SAFE ENOUGH stamp slams (scale 1.07 → 1); the P(doom) field is typed below | **30 px shake**, the plate's biggest hit |
221	| 3 | 72.052 | 39.3 | 0.91 | nearest beat to the midpoint | Snap zoom (outExpo 0.3 s) to the signature, z 1.42 → 1.5 | "We" signed in script | on the snare |
222	| 4 | 72.961 | 40.1 | 0.65 | next downbeat ≥ stamp + 1.4 | Reframe to wide z 0.9, easing *into* the downbeat (inOutCubic, last 0.2 s) | FILED stamp | 11 px shake, 1.8% zoom pulse |
223	| 5 | 73.606 | 40.2.41 | 0.45 | = "Forward" − 1 beat | **Whip-pan** down the page (inOutExpo) with directional motion blur (bureau.ts:458-469) | perforation, then Annex B | lands on the word |
224	| 6 | 74.060 | 40.3.41 | 0.78 | "Forward" | Tight on the input layer, z 1.42, slow 4% pull | MLP schematic; "Forward" printed left to right; the pulse starts | – |
225	| 7 | 74.840 | 41.1.13 | 0.40 | / 75.244 / 75.660 (41.1.13 / 41.2.02 / 41.2.94) syllables M, L, P | Three snap zoom-outs (outExpo 0.22 s): z 1.25, 1.12, 0.99 | M, L, P pop over h1, h2, ŷ; the pulse advances one layer per syllable | 5 px shake per syllable |
226	| 8 | 75.244 | 41.2 | 0.42 | ↑ | ↑ | ↑ | ↑ |
227	| 9 | 75.660 | 41.3 | 0.46 | ↑ | ↑ | ↑ | ↑ |
228	| 10 | 76.120 | 41.4 | 0.72 | "backward" | Dolly right to left with counter-roll (inOutCubic) | "backward," set mirrored, right to left; the pulse runs back | – |
229	| 11 | 76.845 | 42.1.54 | 0.88 | "repeat" | **Three hard-cut stutters** replaying the backward sweep in remapped time (bureau.ts:342-351) | "repeat" re-stamped each time; epoch counter 42 → 45 | 9 px per retrigger |
230	| 12 | 77.720 | 42.3.46 | 1.34 | "Now" | **Hard cut** to Appendix C, tight (z 1.7), tracking right as the heading prints | "Now von Neumann's" printed word by word | fetch-decode-execute cycle, one stage per beat (1057, 1082) |
231	| 13 | 79.065 | 43.2.42 | 0.71 | fallback: no downbeat in the window, so neumann + 20% | Reveal wide (outExpo 0.38 s), z 0.9 | textbook von Neumann figure | – |
232	| 14 | 79.779 | 43.4 | 0.26 | nearest beat | Punch-in to z 0.99, then +3% creep | – | on beat 4 |
233	| 15 | 80.043 | 43.4.58 | 0.70 | "obsolete" | +4% / +3% zoom pulses | Orange strike 1; "obsolete" hand-written; strike 2 at 80.263 (44.1.06) | 14 px, then 9 px |
234	| 16 | 80.743 | 44.2.12 | 0.40 | = obsolete + 0.3, clamped | Page rips (0.13 s) and the two halves hinge and tumble away | HUD flips from paper back to ink | Blackout in the last 0.04 s, then **tear-to-black cut** |
235	
236	### leftturn (81.143 → 88.870, verse)
237	
238	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
239	|---|---|---|---|---|---|---|---|
240	| 1 | 81.143 | 44.3 | 0.66 | start | 0.12 s fade from black; drawing revealed from the south; chase cam behind the spark, zoom 0.78 → 0.86 | Dark drafting sheet: SRR · PDR · CDR · TRR · LAUNCH roadmap; lyric painted as road markings | "PASSED" at SRR on "Sharp" (81.21) and at PDR on the beat 81.597 (44.4) |
241	| 2 | 81.800 | 44.4.44 | 0.92 | "left" | **Whip**: 90° rotation in 0.26 s (inOutCubic); zoom 1.0 → 1.12 → 0.95; multi-tap motion blur up to 16 taps | The spark swerves off the plan | 10 px shake, +4 CA, 3% post zoom |
242	| 3 | 82.720 | 45.2.47 | 0.76 **HIT** | → 82.960 (45.2.47 → 45.3) "and" → "there" | Spark brakes (Hermite curve); on "there" a **landing punch** of +32% (outExpo 0.3 s), then a creep | Crater hit; survey marker drops, shock ring, contours ripple | 16 px shake; kick pulses of 3% zoom; the eye flares on kicks |
243	| 4 | 83.480 | 45.4.14 | 0.84 | "you" → lands on the 83.870 (46.1) downbeat | **Crane out** with a quarter-turn back to north-up (power-3 ease), zoom to 0.43 | Reveal: the terrain is the mask. YOU / ARE stamped as map labels (ARE at 83.93); the second eye lights | Contour ripples on every beat |
244	| 5 | 84.324 | 46.2 | 0.42 | beat after "are" | Tighter reframe, +17% (outExpo) with an outBack roll | "UNPLANNED OBJECT · not on roadmap" callout | on the snare |
245	| 6 | 84.749 | 46.3 | 0.25 | beat before "Without" | **Whip north** with a mid-move zoom dip (−45%·sin) | onto the review schedule on the same sheet | – |
246	| 7 | 85.000 | 46.3.48 | 1.43 | "Without" | Tracks the playhead (the spark) along the Gantt | Words as Gantt bars filled as sung | SRR stamp 85.233 (46.4), PDR stamp 85.688 (47.1): 5–6% punches, outBack roll, 6 px |
247	| 8 | 86.429 | 47.2.63 | 1.53 | "CDR" | Snap into the slot (outExpo 0.2 s), z 2.1; punches per syllable: D 87.28 (+16%), R 87.66 (+18%); snare rolls in between | Empty dashed CDR diamond, "STATUS: NOT HELD" | 7 px per syllable |
248	| 9 | 87.961 | 48.2 | 0.45 | beat after R + 0.1 | Wide on the whole schedule (outExpo 0.43 s) | Zips past TRR (SKIPPED) to LAUNCH (AHEAD OF SCHEDULE) | 6 px |
249	| 10 | 88.415 | 48.3 | 0.46 | beat before end | Push (inOutCubic) into the slot; the sheet drains to black | Only the slot remains and morphs into the caret | **Match cut**: the slot becomes gato's caret |
250	
251	### prompt3 (88.870 → 95.233, prompt (gato))
252	
253	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
254	|---|---|---|---|---|---|---|---|
255	| 1 | 88.870 | 48.4 | 0.41 | plate start | z 1.6 caret |  |  |
256	| 2 | 89.280 | 48.4.90 | 3.18 | "Gato," | z 1.45 |  |  |
257	| 3 | 92.460 | 50.3.89 | 0.86 | "don't" | z 1.2 typed |  |  |
258	| 4 | 93.320 | 51.1.79 | 0.98 | "me" | z 1.0 field |  |  |
259	| 5 | 94.300 | 51.4 | 0.93 **HIT** | "go" | z 0.9 field, dy −20 |  |  |
260	
261	### hook3 (95.233 → 96.596, hook 3)
262	
263	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
264	|---|---|---|---|---|---|---|---|
265	| 1 | 95.233 | 52.2 | 0.24 |  |  | pre-roll: prompt3's "go" + cursor alone, fading |  |
266	| 2 | 95.470 | 52.2.52 | 0.25 |  |  | I'M: 54 px hairline, no punch, no shake |  |
267	| 3 | 95.720 | 52.3.07 | 0.38 |  |  | UPPING (stacking upward in black) |  |
268	| 4 | 96.100 | 52.3.90 | 0.22 |  |  | MY |  |
269	| 5 | 96.320 | 52.4.39 | 0.24 |  |  | P(: slow inOutCubic roll, ghost of the old value |  |
270	| 6 | 96.560 | 52.4.92 | 0.04 **HIT** |  |  | DOOM: burns out filament by filament → paperclips on black |  |
271	
272	### paperclips (96.596 → 102.051, chorus world)
273	
274	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
275	|---|---|---|---|---|---|---|---|
276	| 1 | 96.596 | 53.1 | 0.46 | start | Top-down overhead, roll −0.07 drifting | The spark draws a lead-in on black and bends into a Gem clip; "as paperclips fill the room" top-left, light Archivo with a wipe | – |
277	| 2 | 97.051 | 53.2 | 0.45 | first beat at "paperclips" | Slow push, 1.08 → 1.0 | The clip "inflates" (outBack) and cools to steel | – |
278	| 3 | 97.505 | 53.3 | 0.90 | → 98.642 (53.3 → 54.1.5) | Height pulls back around each split (±0.2 s ease) | Clips double on every **8th**: 1 → 64; the lattice floods at 98.742 | 6 splits on 8ths |
279	| 4 | 98.400 | 54.1 | 0.47 | = Killswitch − 0.42 | – | Out-of-office card slides in (outExpo 0.5 s); "Killswitch guy's on PTO" typed as sung | – |
280	| 5 | 98.869 | 54.2 | 1.77 | = 4 beats after the clip | **Crane / swing-down** from overhead to a 10° low glide (inOutCubic), then a forward glide | Raymarched endless lattice floor, fog, lamp | Lamp brightens on the snare |
281	| 6 | 100.641 | 55.1.89 | 0.50 **HIT** | "Now" − 0.08 | Levels off into the slot | Ceiling slams from 150 to 32; the card is crushed flat; the lyric is squeezed into the horizon slot | 14 px decaying shake |
282	| 7 | 101.142 | 55.3 | 0.56 | , 101.596 (55.4) | Locked in the slot | Ceiling slams to 18, then 10 | one slam per beat |
283	| 8 | 101.700 | 55.4.22 | 0.35 | ~101.70 → 102.051 (56.1) | – | Everything outside the slot goes dark; one orange line at the horizon | **Graphic match** into fuse's hairline |
284	
285	### fuse (102.051 → 109.778, chorus tail)
286	
287	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
288	|---|---|---|---|---|---|---|---|
289	| 1 | 102.051 | 56.1 | 1.57 | start | Push-in from a far hairline into the cord, z 0.42 → 1.12 (inOutCubic), following the burn | Engraved braided fuse; "Too late now, we lit the" rides the cord; each word ignites at its start and chars to ash | Sputter bursts on every beat (647-657) |
290	| 2 | 103.619 | 56.4.45 | 1.16 |  | Slow push onto the burning word, z 1.75 (inOutQuad) | Held "fuse" burns letter by letter | – |
291	| 3 | 104.778 | 57.3 | 0.91 | nearest beat (no downbeat fits) | **Hard cut to macro**, z 3.3 → 3.9, roll −0.11, drifting | Macro of the burning front | 3 px shake |
292	| 4 | 105.687 | 58.1 | 0.27 **HIT** | → 106.060 | **Tilt down** by one frame height (inOutCubic); the spark stays continuous | The fuse world slides up and the chart arrives | on the downbeat |
293	| 5 | 105.960 | 58.1.60 | 0.64 | "Orthogonality" | Close on the axis, z 1.5 | Spark draws INTELLIGENCE →; the line is set along it | – |
294	| 6 | 106.596 | 58.3 | 0.45 |  | Pull back to the whole plane (outExpo 0.55 s) | GOALS ↑ shoots up; a scatter of "minds" nods on the beats | – |
295	| 7 | 107.050 | 58.4 | 1.52 | → 107.505 (59.1) "blues" | Push in on the string (z 1.36, outExpo) and ride the octave bend | Flat regression line (r = 0.00) bent by the singer's pitch; vibrato; +12 bend | Sync to the vocal pitch |
296	| 8 | 108.570 | 59.3.34 | 0.98 | → 109.323 (60.1) | Settle back out (inOutCubic) | ♭ blue note | – |
297	| 9 | 109.551 | 60.1.50 | 0.23 | last half beat | **Inhale**: accelerating push (+22%, inCubic) into the spark; chart dims 60% | – | Lands on stack's tower axis (`HANDOFF`) |
298	
299	### stack (109.778 → 115.232, bridge)
300	
301	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
302	|---|---|---|---|---|---|---|---|
303	| 1 | 109.778 | 60.2 | 2.73 | start | Opens looking straight down the shaft (pitch 0.98, fov 40), cranes to 3/4 by 110.28 (inOutCubic); drops 4 blocks (outExpo 0.42 s); +60% exposure pulse; during "transformers" a slow +0.8 yaw orbit | Infinite transformer-block tower; "“JUST" on block 4, TRANSFORMERS on block 5, with echo ghosts on the blocks below | Falls **one block per beat** from 110.687 (60.4); the beat at 110.232 is skipped so "Just" stays in frame; spring step with 0.22 anticipation; landing shake; the spark runs up each block's main path; the full band returns at 111.141 (61.1) |
304	| 2 | 112.505 | 61.4 | 0.91 | "all the" | **Cut** to a high steep angle, off-axis (pitch 0.95, yaw 0.42, dist 30 closing, roll 0.05) | ALL THE, WAY!” | per-beat drops 112.959 (62.1) |
305	| 3 | 113.414 | 62.2 | 0.91 | "Till you" | **Cut** to a low near-horizontal angle (pitch 0.22, dolly in) | TILL YOU, then LEARNED TO at 113.868 (62.3) | per-beat drops |
306	| 4 | 114.323 | 62.4 | 0.91 **HIT** | beat nearest "disobey" | **Dead stop** (a linear-accelerating landing that ends exactly on the beat), then a cut to a flat telephoto elevation (fov 19), push-in 41 → 35 | One block swings out of alignment 114.443 → 114.777 (63.1, outBack); DISOBEY highlighted **right to left**; letters break rank; the spark is stuck and sputtering | Hard cut on 63.2 |
307	
308	### dense (115.232 → 124.322, bridge)
309	
310	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
311	|---|---|---|---|---|---|---|---|
312	| 1 | 115.232 | 63.2 | 1.82 |  | Static frame; in-scene punch of 3% | POST-CHINCHILLA, SUPER-DENSE packed into TITLE SAFE 90%; TOKENS/PARAM 20 → 20,000 | **Four kick compressions**: 115.232, 115.686, 116.141, 116.595 (63.2–64.1); spring; trembles before the break |
313	| 2 | 117.050 | 64.2 | 1.73 **HIT** | "Breaking" | Static; hit-scaled shake | Fences break: title-safe (117.050), action-safe on "through" (117.504, 64.3), frame under load on "safety" (117.959, 64.4), frame edge snaps on "fence" (118.413, **65.1**); FENCE overshoots; QC log | 30 × 20 px × hit weights (dense-press.ts:156-161) |
314	| 3 | 118.775 | 65.1.79 | 0.09 | → 118.868 | **Dive** into a stem of FENCE, ×5 zoom, −0.35 roll | – | **Match cut** to the GPU macro |
315	| 4 | 118.868 | 65.2 | 1.36 | "Hundred" | **Crane up**: exponential zoom 46 → 4.62 (outCubic by 119.168) with 0.35 rad unroll | 400 × 250 GPU grid spelling HUNDRED THOUSAND GPU; counter 100 → 100,000 | +2% zoom pulse per beat; flicker waves |
316	| 5 | 120.232 | 66.1 | 0.45 |  | Dutch roll in (inCubic) to 0.07 | – | Hand-off angle into movement 6 |
317	| 6 | 120.686 | 66.2 | 3.64 | "RLHF" | Stepped roll per kick, each step caught by a spring: 0.115 (121.141), 0.16 on "goes" (121.595), 0.19 on "askew" (122.050, 67.1), RLHF correction to 0.085 (122.504), slip 0.23 (122.959), edge 0.30 (123.413), **whip** to −0.12 (123.868, 68.1); zooms out to keep the corners in frame | Tilting table: the mask rolls downhill and lands upside down; reward 0.99 → 0.41 → 0.99; ASKEW leans a little more each beat | Punches on slips; 22 × 16 px × hit; cut at 68.2 **still rolled** into hook4 |
318	
319	### hook4 (124.322 → 126.140, hook 4)
320	
321	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
322	|---|---|---|---|---|---|---|---|
323	| 1 | 124.322 | 68.2 | 0.20 |  |  | pre-roll: still rolled −0.12 rad from dense, outlines pulse in, zoom 1.08 |  |
324	| 2 | 124.520 | 68.2.43 | 0.26 |  |  | I'M: snaps straight; strobe ink/signal/bone on 8ths, 6 outline echoes |  |
325	| 3 | 124.780 | 68.3 | 0.42 |  |  | UPPING relaunched every 8th; re-slam every beat |  |
326	| 4 | 125.200 | 68.3.93 | 0.20 |  |  | MY (shake 20) |  |
327	| 5 | 125.400 | 68.4.37 | 0.26 |  |  | P( |  |
328	| 6 | 125.660 | 69.1 | 0.48 **HIT** |  |  | DOOM: shake 26; 0.99 then a 9 appended every 18 ms → squashes into loom's weft thread |  |
329	
330	### loom (126.140 → 131.595, chorus world)
331	
332	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
333	|---|---|---|---|---|---|---|---|
334	| 1 | 126.140 | 69.2 | 0.46 | start | Rides the tip of the spark (follow 0.38 s) | Hook 4's thread becomes the tree root; "Just as" written token by token | – |
335	| 2 | 126.595 | 69.3 | 0.45 |  | Snaps out a notch, 1 → 0.8 (outExpo 0.28 s) | "foretold"; dim alternative branches sprout | – |
336	| 3 | 127.049 | 69.4 | 0.91 **HIT** |  | Pull back to the whole multiverse (inOutCubic 0.44 s); +3.5% settle on 127.504 (70.1) | "Loom" sampled at 127.54 in Cormorant italic | Bloom swell, +1.2% push; tiny flash on each downbeat |
337	| 4 | 127.958 | 70.2 | 1.36 | "From" | **Hard cut**; slow push 1.0 → 1.03 | Pre-training page; "From masked pre-training days" in [MASK] blocks that wipe as sung | Corpus scrolls one line per beat; masks re-roll per beat |
338	| 5 | 129.322 | 71.1 | 0.45 | downbeat | Snap reframe onto row 2 (×1.06, tilt −0.012, outExpo 0.23 s) | – | – |
339	| 6 | 129.776 | 71.2 | 0.91 | "To" | **Hard cut** to the Droste; the hole opens (outExpo 0.4 s); **one level per beat** (130.231, 130.686) | The plate nests inside itself, each level tagged SELF v n.0; "TO RECURSIVE SELF-UPGRADE" stays crisp | Kick-driven 1.2% zoom |
340	| 7 | 130.686 | 71.4 | 0.45 | "self-upgrade" | Spiral twist | – | 0.12 flash |
341	| 8 | 131.140 | 72.1 | 0.46 | → 131.595 | Untwists on the downbeat; **dives** down to level 5 (inOutCubic) | The bottom level is ilya's room, live | Lands exactly on the cut |
342	
343	### ilya (131.595 → 140.230, chorus tail)
344	
345	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
346	|---|---|---|---|---|---|---|---|
347	| 1 | 131.595 | 72.2 | 0.93 |  | Behind the lid, slow orbit; laptop right of centre | Dark room; screen glow; stickers; "What did" in Cormorant italic, top left | – |
348	| 2 | 132.524 | 72.4 | 0.86 **HIT** | "Ilya" → 132.958 (73.1) | **Whip-orbit** around the left side to a front 3/4 view (inOutCubic), radius 0.86 → 0.62 | Screen REDACTED bar slams on the **73.1** downbeat | 7 px shake |
349	| 3 | 133.380 | 73.1.92 | 1.85 | / 133.880 / 134.340 "We'll / never / know" | Squares up to dead front and sinks toward the lid's lip | Lid pushed down word by word; slit at **74.1** (134.776) | – |
350	| 4 | 135.231 | 74.2 | 1.82 |  | Pushes to the sleep light | Point of light; WITHHELD bar over "know" on the **75.1** downbeat (136.594) | Light "breathes" once |
351	| 5 | 137.049 | 75.2 | 0.33 |  | – | A beat of true black | – |
352	| 6 | 137.380 | 75.2.72 | 1.77 | "Was" | **Locked-off** wide from the house, imperceptible dolly (z 14.2 → 12.4) | Spotlight thunks on (1.25 / 0.55 / 1.0 flicker) over an empty stage; the question lettered on the proscenium | 0.018 flash; this is the song's stop bar (drums out 138.41–140.23) |
353	| 7 | 139.149 | 76.2.62 | 0.88 | "for" → meet 139.776 (76.4) | Same shot | Curtains close | – |
354	| 8 | 140.027 | 76.4.55 | 0.20 | "show?" | Same shot | Seam collapses to the centre (inQuart): the spark | **Detonation cut** on 77.1 |
355	
356	### outro (140.230 → 156.651, outro)
357	
358	| # | start | bar.beat | dur | trigger | camera | picture / lyric | sync / exit |
359	|---|---|---|---|---|---|---|---|
360	| 1 | 140.230 | 77.1 | 1.82 **HIT** | , beat 0 | Static | **Detonation** at the centre: 2600 streaks; P(DOOM) 1.00 huge | Flash 1.2; 14 px shake; shockwave ring on each of 4 beats |
361	| 2 | 142.049 | 78.1 | 1.82 | , beat 4 | Backs off as the bar grows | Readout breaks its end cap: 1.01 / 1.1 / 1.5 / 2.00; Kolmogorov footnote | One value per beat; 0.04 flash on beat 1; per-beat shake |
362	| 3 | 143.867 | 79.1 | 1.82 | , beat 8 | Ruler flies past | Log ruler: 3.14 / 10 / 42 / 1,000 | per beat, with speed lines |
363	| 4 | 145.685 | 80.1 | 1.82 | , beat 12 | Static | Walls of zeros: 1e9 / 1e30 / 1e100 / 1e1000 | per beat |
364	| 5 | 147.503 | 81.1 | 0.91 | , beat 16 | Static | Spark traces ∞ | – |
365	| 6 | 148.412 | 81.3 | 0.91 | , beat 18 | Jump-cut positions | Recap of the climb in 16th notes, landing on ∞ | **16th strobe** |
366	| 7 | 149.321 | 82.1 | 4.54 | , beat 20 | Slow push with punches on beats 3, 4, 6, 7, 8 | End card: "I'm upping my" one word per beat; P(doom) traced (150.684); "=" slams (83.1); ∞ → 8 (152.048); 0/0 (152.503) | NaN¹ on **84.1** (152.957), where the drums stop |
367	| 8 | 153.866 | 84.3 | 1.42 | , beat 30 | Frame closes back in | Card implodes to the spark; "↻ Regenerate" appears; cursor glides in | Click at 155.230 (85.2), 0.8 flash |
368	| 9 | 155.285 | 85.2.12 | 0.54 |  | – | 13 plate images rewind, accelerating | CA 6 |
369	| 10 | 155.820 | 85.3.29 | 0.83 | → 156.593 (86.1) | – | Opening plays backwards, braking; parks on frame 1 | **Loop** |
370	
371	## Mapping onto We Appreciate Power (edit A, 215.27 s) — approved 2026-09-28
372	
373	Cut points computed with P(doom)'s rule over our alignment (`data/lyrics.json`, edit time). Structure is copied in beats and bars, not seconds: 108 BPM, bar = 2.222 s (22 % slower than P(doom)). Energy is the mean of our envelopes (0–1). Lyric cues are kept to a few words.
374	
375	Why it fits: our edit has 4 choruses (1, 2, 4, 5) = hook ×4, and 3 pre-choruses singing the same line = prompt ×3. Chorus 4 has no bass and is our quietest chorus = P(doom)'s breakdown chorus 3, so gato and hook3 go before it. The bridge sings the same four lines twice: stack the first time, dense the second.
376	
377	| ours | window (s) | bars | lines | rms / bass | inherits | structure to carry over |
378	|---|---|---|---|---|---|---|
379	| hook1 | 0.000–3.934 | 1.77 | 0 | 0.74 / 0.56 | open (frame 1) + hook1 | Frame 1 is open's ignition on the first downbeat ("We" lands on it). Then hook1: a slam per word; both POWERs land on beat 3, the heaviest on the second; cut on the beat before the next line; exit by imploding the slogan to a point. |
380	| world1 | 3.934–13.378 | 4.25 | 1–2 | 0.68 / 0.49 | room | Exponential opening shot (splits on 8ths, then 16ths), four one-beat shots, an accelerating orbit with a roll; one maximal hit; a word flung at the lens into the pre-chorus. |
381	| prompt1 | 13.378–17.823 | 2.00 | 3 | 0.59 / 0.00 | prompt / chatgpt | Hard cuts on sung words, background accelerating inward; ⏎ on the downbeat, swallowed, white flash held into hook 2. |
382	| hook2 | 17.823–21.711 | 1.75 | 4 | 0.62 / 0.00 | hook2 | Inverted: dark type on an accent field. The hit is the cut: after the second POWER the shape becomes the next plate's first frame. |
383	| world2 | 21.711–31.156 | 4.25 | 5–6 | 0.53 / 0.00 | ascent | Four short movements, each a new material, joined by a match cut, an ink/paper flip and a collapse-to-point flash; each steps up per word and releases on one impact. Two lines, so two movements per line. |
384	| drop | 31.156–39.489 | 3.75 | — | 0.73 / 0.54 | shoggoth (tail) | One frontal long shot carries the 4-bar drop: 8ths then 16ths, a push per downbeat, an accelerating close, collapse to one line. |
385	| verseA | 39.489–55.045 | 7.00 | 7–8 | 0.59 / 0.22 | bureau | One continuous document, ~16 camera states split by a few hard cuts, one block per line moving down the page; one stamp-like maximal hit; instrumental bars escalate (single hit, per syllable, triple stutter); tear to black. |
386	| verseB | 55.045–76.712 | 9.75 | 9–10 | 0.61 / 0.46 | leftturn | One sheet, no hard cut, 3 whips into three blocks; one landing hit; drain to one shape that becomes the bridge's first object. 9.75 bars, over twice the original: an extra block or longer gaps. |
387	| bridgeA | 76.712–94.489 | 8.00 | 11–14 | 0.67 / 0.70 | stack | Quantised motion, one step per beat, a set-up change per phrase; the biggest moment is a dead stop on the key word. |
388	| bridgeB | 94.489–110.601 | 7.25 | 15–18 | 0.75 / 0.67 | dense | The same four lines again, one level up: a compression per kick, an event per beat, rupture, crane, a roll step per kick that hands its angle to pre4. |
389	| prompt2 | 110.601–115.601 | 2.25 | 19 | 0.59 / 0.06 | prompt / gato | No cuts, long glides only; letters drift, the cursor holds the last one; a dim ⏎ lands on chorus 4's downbeat. |
390	| hook3 | 115.601–119.489 | 1.75 | 20 | 0.61 / 0.00 | hook3 | Every loud parameter at zero: hairline type, no punch frames, no shake; burns out filament by filament. |
391	| world4 | 119.489–128.934 | 4.25 | 21–22 | 0.54 / 0.00 | paperclips → fuse | 8th-note doubling, crane down, a slam per beat, collapse to one line; an inhale push across the cut. |
392	| prompt3 | 128.934–133.378 | 2.00 | 23 | 0.73 / 0.62 | prompt / sydney | Cuts on words and on the grid, a squeeze per beat, a slam shut into hook 4's field. |
393	| hook4 | 133.378–137.267 | 1.75 | 24 | 0.73 / 0.54 | hook4 | Everything up: 8th-note strobe, a re-slam every beat, the biggest shake; exits squashed into one line. |
394	| world5 | 137.267–148.934 | 5.25 | 25–27 | 0.71 / 0.50 | loom | One movement per line: pull back, reframe, infinite dive; two hard cuts on beat 2; the dive lands on the next plate's first frame. |
395	| preach | 148.934–164.490 | 7.00 | 28–34 | 0.62 / 0.00 | dense-style ×7 | Seven bars, one line per bar, one quantised event per line, the same action heavier each time (hook ×4's escalation shrunk to a bar). |
396	| inst | 164.490–177.267 | 5.75 | — | 0.64 / 0.00 | ilya | Deflation: one orbit, long holds, hits on downbeats, collapse to a point handed to the ending. |
397	| outroV | 177.267–185.601 | 3.75 | 35–38 | 0.67 / 0.00 | leftturn-style sheet (open) | P(doom)'s outro has no vocals; ours has four lines. Draft: a document page; or fold into submit's value-per-beat. Open. |
398	| submit | 185.601–204.490 | 8.50 | 39–47 | 0.61 / 0.00 | outro (front) | The first frame is the film's biggest hit; the camera then stays still and each "submit" is one graphic cut. |
399	| tail | 204.490–215.271 | 4.85 | — | 0.34 / 0.00 | outro (tail) | End card, then no rewind: the film ends open (director, 2026-09-28). |
400	
401	Where a 1:1 copy breaks:
402	
403	- Our hook line is 1.75 bars with two POWERs and recurs inside each chorus; P(doom)'s hook is one bar and DOOM appears once per chorus. The repeat lives in the chorus "world" plate.
404	- Verse 2 and the bridge are about twice P(doom)'s length (verse 2: 16 bars, 4 lines, long instrumental gaps).
405	- P(doom)'s outro is instrumental; ours has four "Neanderthal" lines and eight "submit"s.
406	- We cold-open on a chorus, so the ignition is only frame 1.
407	- Our song is more compressed (rms 0.34–0.75 vs 0.27–0.70): light/dark and quiet must be designed, not read off loudness.
408	
409	Approved 2026-09-28: the mapping; that there is a thread object; a drawing language per plate; an escalating value across the hooks; an open ending (no loop). Still to choose: the thread object (our "spark", handed across every cut, revealed about two thirds in); a drawing language per plate (P(doom) changes it every plate, held together by one palette, type system, grain and deadpan humour); whether a value escalates across the hooks (P(doom)'s number is full-screen only on hooks, and otherwise shows up once per plate in that plate's own idiom — not a persistent HUD).
410	

[End of file.]