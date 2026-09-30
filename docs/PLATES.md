# Plates: the approved imagery (Stage 3 spec)

Structure: P(doom)'s, entry for entry (`docs/PDOOM-STRUCTURE.md`, approved 2026-09-28). Imagery: the per-plate proposal the director approved on 2026-09-28, with its recommended options: the thread object is the blue dot that turns out to be a mitochondrion (reveal in world4), and the value is power in watts (20 W → 700 W → 150 MW → 1 GW → Kardashev).

Shared, read-only for plate files: `scenes/_power.ts` (the dot `dot2D`, `burst2D`, `VALUES`, `siW`, `fullW`, `HANDOFF` geometry). Each plate’s first frame starts from the previous plate’s last shape at the `HANDOFF` position below; nothing crossfades.

Rules (docs/TREATMENT.md): lyrics live on objects with an in-world cursor, never a caption; no persistent HUD; punchy (hard cuts, one maximal hit per plate); no P(doom), no orange; not ordinary, no vaporwave/neon look (neon: the accent only, at most three short moments in the film); no figurative body (no head, skeleton, body, hand, face, skull). Palette: ink/graphite, bone, and the one blue (`signal`); only the blue glows.

| # | entry | scene file | P(doom) structure | first frame | last frame |
|---|---|---|---|---|---|
| 1 | hook1 (口号 1) | `hook.ts` | hook.ts (n=1) + open.ts 的点火 | 第一帧：黑里点火（第一个强拍） | 蓝点落在 HANDOFF.climb（第一块岩点） |
| 2 | world1 (副歌 1 主体) | `climb.ts` | room.ts | 蓝点在 HANDOFF.climb | 蓝点停在 HANDOFF.pin（插头 1 号针脚的尖） |
| 3 | prompt1 (预副 2) | `mate.ts` | prompt.ts (chatgpt) | 蓝点在 HANDOFF.pin | 最后几帧整屏变成信号蓝，口号 2 的蓝底接着它 |
| 4 | hook2 (口号 2) | `hook.ts` | hook.ts (n=2) | 蓝底（全屏 signal） | 蓝底合成 HANDOFF.bus 那条横线，其余全黑 |
| 5 | world2 (副歌 2 主体) | `grid.ts` | ascent.ts | 黑底上 HANDOFF.bus 一条蓝线（母线） | 只剩 HANDOFF.jack 一个小窗口/插孔 |
| 6 | drop (副歌 2 drop) | `patch.ts` | shoggoth.ts 的 D、E 两段 | HANDOFF.jack 一个插孔 | 最后一盏灯拉成 HANDOFF.paperLine.y 的一条全宽横线 |
| 7 | verseA (主歌 2 上) | `patent.ts` | bureau.ts | 骨白纸上 HANDOFF.paperLine.y 的一条线 | 纸撕开掉进黑 |
| 8 | verseB (主歌 2 下) | `hall.ts` | leftturn.ts | 从黑里、从下方显出 | 只剩 HANDOFF.slot 一个机柜槽位 |
| 9 | bridgeA (桥段 上) | `tape.ts` | stack.ts | HANDOFF.slot 一个磁带槽位 | 普通硬切；“alive” 的标签最后一帧扫完 |
| 10 | bridgeB (桥段 下) | `platter.ts` | dense.ts | 普通硬切进来 | 画面停在 HANDOFF.roll 的滚转角 |
| 11 | prompt2 (预副 4) | `mate.ts` | prompt.ts (gato) | 画面带着 HANDOFF.roll 的滚转角，开始后摆正 | 只剩画面中央最后一个字母和光标，淡到黑 |
| 12 | hook3 (口号 3) | `hook.ts` | hook.ts (n=3) | 黑底中央的小字 | 只剩 HANDOFF.petri 一个蓝点 |
| 13 | world4 (副歌 4 主体) | `culture.ts` | paperclips.ts → fuse.ts | HANDOFF.petri 一个蓝点 | 最后半拍吸进蓝点，落在 HANDOFF.pin |
| 14 | prompt3 (预副 5) | `mate.ts` | prompt.ts (sydney) | 蓝点在 HANDOFF.pin | 砰地合上，全黑（口号 4 频闪开场） |
| 15 | hook4 (口号 4) | `hook.ts` | hook.ts (n=4) | 全黑，频闪开场 | HANDOFF.hypha.y 一条全宽线，蓝点在 HANDOFF.hypha.x |
| 16 | world5 (副歌 5 主体) | `mycel.ts` | loom.ts | HANDOFF.hypha 的线和尖端 | 一排褶就是 HANDOFF.pipes 的风琴管 |
| 17 | preach (preaching ×7) | `organ.ts` | dense.ts 的量化（每小节一个事件） | HANDOFF.pipes 的风琴管 | 风压收成 HANDOFF.spot 一个光点 |
| 18 | inst (器乐) | `exhibit.ts` | ilya.ts | HANDOFF.spot 一个聚光灯光点 | 收成 HANDOFF.clade 一个点 |
| 19 | outroV (Neanderthal) | `clade.ts` | leftturn.ts | HANDOFF.clade 一个点（分支图的根） | 只剩新蓝枝的端点，在 HANDOFF.summit |
| 20 | submit (submit) | `summit.ts` | outro.ts 前段 | HANDOFF.summit：第一帧引爆（全片最大的一下） | 同一个场景接尾巴 |
| 21 | tail (尾巴) | `summit.ts` | outro.ts 结尾卡（不倒带） | 接 submit | 开放结尾：线走出画框，数值还在跳；不倒带 |

## 1. hook1: 口号 1 (0.000–3.934 s) · `hook.ts`

- **P(doom) structure:** hook.ts (n=1) + open.ts 的点火; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 口号大字：Archivo 62/900，一词一砸 (口号字)
- **Subject:** 第一个强拍上，蓝点在黑里点火，这是全片第一下。然后 WE / APPRECIATE / POWER 一词一砸。两次 POWER 都落在第 3 拍，第二次最重。
- **Lyric and cursor:** 字本身就是画面。每个字从蓝点落下的位置砸出来，蓝点就是光标。
- **Maximal hit:** 第二个 POWER（1.3 拍）。
- **Exit:** 所有字内爆成蓝点，落在攀岩墙的第一块岩点上。
- **First / last frame:** 第一帧：黑里点火（第一个强拍） / 蓝点落在 HANDOFF.climb（第一块岩点）
- **Thread object:** 点火的火星。
- **Value:** POWER 之后读数出现：20 W。
- **Fine print (draft):** `20 W · typical adult human brain, at rest`
- **Light/dark:** 石墨底骨白字，第一帧白闪

## 2. world1: 副歌 1 主体 (3.934–13.378 s) · `climb.ts`

- **P(doom) structure:** room.ts; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 攀岩线路图（topo）+ 速度攀岩标准墙，3D 线框 (攀登)
- **Subject:** “Elevate the human race” 里的 race 是一场比赛。速度攀岩的标准墙高 15 米，左右两条线路一模一样。左道是手画的线路（人），右道是绘图仪照着复刻的同一条（机器）。“face” 是岩壁的 face。墙上没有人，只有那个蓝点在爬。
- **Lyric and cursor:** “Elevate the human race” 沿手画的线路写，笔尖是光标；“let it wake up on my face” 刻在岩壁表面；口号第二遍刻进 4 块岩点，每拍一块。
- **Maximal hit:** 高度读数第 10 次翻倍，冲出墙顶的那一下。
- **Exit:** POWER 从墙顶甩向镜头，正好落进接插件规格书的排版位置。
- **First / last frame:** 蓝点在 HANDOFF.climb / 蓝点停在 HANDOFF.pin（插头 1 号针脚的尖）
- **Thread object:** 在爬墙的那个点。
- **Value:** 终点计时牌上的换算：70 kg 爬 15 米用 5 秒，约 2 kW（很短暂）。
- **Fine print (draft):** `Route: IFSC standard · both lanes identical · left: drawn by hand · right: copied`
- **Light/dark:** 石墨，3D 线框
- **Pending proofread:** “wake up / make up on my face” 待校对，不影响画法。

## 3. prompt1: 预副 2 (13.378–17.823 s) · `mate.ts`

- **P(doom) structure:** prompt.ts (chatgpt); shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 接插件规格书：插头与插座的剖面图、针脚表 (接插件)
- **Subject:** “What will it take to make you capitulate?” 在这里是两半接插件要对上，capitulate 就是插到底。沿用现有的 dock.ts，但按 chatgpt 的结构重排。三次预副歌都是这张规格书。
- **Lyric and cursor:** “what will it take” 手写在插头外壳上，“to make you” 刻在插座上；CAPITULATE? 分在两个对插面上，插到底的那一瞬才拼完整。插头的前沿是光标。
- **Maximal hit:** ⏎：插头落在强拍上，被整个吞进插座。
- **Exit:** 蓝色闪光留下来，成为口号 2 的底色。
- **First / last frame:** 蓝点在 HANDOFF.pin / 最后几帧整屏变成信号蓝，口号 2 的蓝底接着它
- **Thread object:** 第 1 号针脚。
- **Value:** 规格表“额定功率”一栏：context-dependent。
- **Fine print (draft):** `Durability: 1 mating cycle · PIN 7: CONSENT (optional)`
- **Light/dark:** 石墨 → 蓝闪

## 4. hook2: 口号 2 (17.823–21.711 s) · `hook.ts`

- **P(doom) structure:** hook.ts (n=2); shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 反色：石墨字压在强调蓝底上 (口号字)
- **Subject:** 比第一次重。数值在第一个 POWER 上就开始滚。击打就是切点：第二个 POWER 一落就切。
- **Lyric and cursor:** 同口号 1。
- **Maximal hit:** 第二个 POWER，也就是切点。
- **Exit:** 数值压成一条横线，就是电网单线图上的母线（几何匹配）。
- **First / last frame:** 蓝底（全屏 signal） / 蓝底合成 HANDOFF.bus 那条横线，其余全黑
- **Thread object:** 数值里的小数点，压成母线。
- **Value:** 20 W → 700 W。
- **Fine print (draft):** `700 W · one datacentre GPU, rated`
- **Light/dark:** 强调蓝底色场

## 5. world2: 副歌 2 主体 (21.711–31.156 s) · `grid.ts`

- **P(doom) structure:** ascent.ts; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 电网四连：单线图 → 同步频率记录纸 → 夜间电网图 → 电度表 (电网)
- **Subject:** “cooperate”：同一张电网里，每台发电机都必须按同一个频率转（50 Hz），差一点就会被切出电网。在电网里，合作是物理要求。
- **Lyric and cursor:** ① 第一句沿母线走，每个词合上一个断路器；② 匹配剪辑到骨白记录纸上的 50 Hz 曲线，各机组的相位一格格对齐；③ 纸变黑，整张电网在夜里亮起；④ 收成一点白闪，口号第二遍落在电度表的计数轮上，一个轮子一个词。
- **Maximal hit:** 所有机组相位对齐的那一下。
- **Exit:** 最后一个计数轮的窗口，就是配线架上的第一个插孔。
- **First / last frame:** 黑底上 HANDOFF.bus 一条蓝线（母线） / 只剩 HANDOFF.jack 一个小窗口/插孔
- **Thread object:** 频率曲线上的同步点。
- **Value:** 电度表：0.7 kWh（700 W 走了一小时）。
- **Fine print (draft):** `50.000 Hz ± 0.2 · ALL UNITS IN SYNC`
- **Light/dark:** 石墨 / 骨白记录纸 / 黑 / 石墨
- **Pending proofread:** 这句 whisper 听成 “state of going to cooperate”，turbo 听成 “our grid to cooperate”。画法只依赖 cooperate。

## 6. drop: 副歌 2 drop (31.156–39.489 s) · `patch.ts`

- **P(doom) structure:** shoggoth.ts 的 D、E 两段; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 配线架正面图：插孔、指示灯、工业丝印 (接插件)
- **Subject:** 贝斯进来的 4 小节，一整面配线架正对镜头。
- **Lyric and cursor:** 器乐段，没有歌词。每盏灯旁边的丝印标签就是它的名字，对应 shoggoth 眼睛旁的标签。
- **Maximal hit:** drop 的第一个强拍：整面灯同时亮起。
- **Exit:** 灯先按 8 分、再按 16 分亮起，每个强拍推一次；再按 1、1、½、½、¼… 拍加速熄灭。最后一盏拉成一条横线，就是专利图纸上的第一条线。
- **First / last frame:** HANDOFF.jack 一个插孔 / 最后一盏灯拉成 HANDOFF.paperLine.y 的一条全宽横线
- **Thread object:** 最后那盏灯。
- **Value:** 面板负载标签：LOAD 0.7 kW。
- **Fine print (draft):** `DO NOT UNPATCH · HUMAN IN THE LOOP → (unlabelled)`
- **Light/dark:** 石墨

## 7. verseA: 主歌 2 上 (39.489–55.045 s) · `patent.ts`

- **P(doom) structure:** bureau.ts; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 专利图纸：骨白纸，Fig. 编号，引出线和参考编号，剖面线 (专利)
- **Subject:** 一份专利申请《用于欣赏功率的装置》，附图就是我们前面组装过的零件（沿用 _parts.ts）。“People like to say that we're insane” 对上审查意见：缺乏实用性。专利局真的这样驳回过永动机。
- **Lyric and cursor:** 第一句被打进权利要求（“1. A method wherein people like to say…”），打字机的字车是光标；第二句写在附图说明里。
- **Maximal hit:** 发明人一栏写着一个人名，下面还有一个 AI。一枚章砸下来：INVENTOR MUST BE A NATURAL PERSON（真实判例，Thaler v. Vidal，2022）。
- **Exit:** 纸撕开掉进黑，机房平面图从下方显出。
- **First / last frame:** 骨白纸上 HANDOFF.paperLine.y 的一条线 / 纸撕开掉进黑
- **Thread object:** 附图上引出线的端点。
- **Value:** 权利要求里：额定功率不小于 0.7 kW。
- **Fine print (draft):** `Sheet 1 of 3 · Examiner’s note: applicant states the apparatus “appreciates”. Clarify.`
- **Light/dark:** 骨白纸，全片最长的亮段（15.6 秒）
- **Pending proofread:** 第二句 “The AI with the reward of the rain” 待校对。

## 8. verseB: 主歌 2 下 (55.045–76.712 s) · `hall.ts`

- **P(doom) structure:** leftturn.ts; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 机房平面图 → 气流仿真网格（CFD），一张图纸不切 (机房)
- **Subject:** 一张数据中心平面图：一排排机柜、冷热通道，一扇柜门上挂着排行榜式的奖状。唱到 “Simulation”，平面图变成它自己的气流仿真网格：真实的机房本来就要先仿真冷风和热风怎么走。
- **Lyric and cursor:** 第一句沿冷通道的地板导流格写；“Simulation” 写成仿真网格的等值线标注；光标是仿真里的一个示踪粒子。
- **Maximal hit:** “computer” 落在奖状上：RANK #1 的章。
- **Exit:** 除了一个机柜槽位，全部排空；这个槽位就是磁带库的第一格。
- **First / last frame:** 从黑里、从下方显出 / 只剩 HANDOFF.slot 一个机柜槽位
- **Thread object:** 机柜的状态灯。
- **Value:** 平面图角标：IT LOAD 150 MW（剧透口号 3）。
- **Fine print (draft):** `Certificate valid until the next list (6 months)`
- **Light/dark:** 石墨底骨白线
- **Pending proofread:** 9.75 小节，比原版长一倍：句间多一块，冷通道里的风一格格走。

## 9. bridgeA: 桥段 上 (76.712–94.489 s) · `tape.ts`

- **P(doom) structure:** stack.ts; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 磁带库：看不到头的货架和机械手，3D (存储)
- **Subject:** “never die / plug in / not even alive / back up” 说的都是备份。机械手每拍移一格，镜头每拍往下掉一层货架。
- **Lyric and cursor:** 每个词印在一盘磁带的条码标签上；机械手的扫描光是光标。
- **Maximal hit:** “not even alive” 上的急停：机械手停在半空。最大的时刻是运动的缺席。
- **Exit:** 普通硬切；“alive” 的标签在最后一帧才扫完。
- **First / last frame:** HANDOFF.slot 一个磁带槽位 / 普通硬切；“alive” 的标签最后一帧扫完
- **Thread object:** 扫描光点。
- **Value:** 磁带的保存功耗：0 W（真实卖点：磁带放着不耗电）。
- **Fine print (draft):** `RETENTION: FOREVER · LAST RESTORE TEST: NEVER`
- **Light/dark:** 石墨，3D
- **Pending proofread:** “back / bomb … drive” 待校对。

## 10. bridgeB: 桥段 下 (94.489–110.601 s) · `platter.ts`

- **P(doom) structure:** dense.ts; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 硬盘盘片微距：磁道、扇区、读写头 (存储)
- **Subject:** 同样的 4 句第二遍，写在盘片的磁道上。每个底鼓，读写头寻道一次，磁道一次比一次密；唱到 “back, back, back on your drive” 时读写头撞盘。
- **Lyric and cursor:** 磁道就是行，读写头就是光标。
- **Maximal hit:** 撞盘（head crash）。
- **Exit:** 摇臂升到整张盘片的扇区图；之后每个底鼓盘片转一格、镜头滚一格，最后的角度直接交给预副 4。
- **First / last frame:** 普通硬切进来 / 画面停在 HANDOFF.roll 的滚转角
- **Thread object:** 读写头。
- **Value:** 盘片标签：≈ 7 W。
- **Fine print (draft):** `fly height: 3 nm · MTBF: 1,000,000 h (claimed)`
- **Light/dark:** 石墨，微距

## 11. prompt2: 预副 4 (110.601–115.601 s) · `mate.ts`

- **P(doom) structure:** prompt.ts (gato); shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 同一张接插件规格书，暗、静 (接插件)
- **Subject:** 没有贝斯的一段。不切，只有长缓动。针脚一根根飘开；⏎ 轻轻落在副歌 4 的强拍上，插头只插进一半。
- **Lyric and cursor:** 字母唱完就飘散，光标抓着最后一个字母。
- **Maximal hit:** 几乎没有：⏎ 只微微亮一下。
- **Exit:** 最后那个字母和光标留在画面中央，交给口号 3。
- **First / last frame:** 画面带着 HANDOFF.roll 的滚转角，开始后摆正 / 只剩画面中央最后一个字母和光标，淡到黑
- **Thread object:** 飘走的那根针脚。
- **Value:** （不露）
- **Fine print (draft):** `mating force: optional`
- **Light/dark:** 黑，只剩虚线轮廓
- **Pending proofread:** 这句 “soon as you capitulate” 待校对。

## 12. hook3: 口号 3 (115.601–119.489 s) · `hook.ts`

- **P(doom) structure:** hook.ts (n=3); shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 黑底发丝线小字，四周大片黑 (口号字)
- **Subject:** 所有响的参数归零：没有冲击帧，没有震屏，字很小，往上叠。数值慢慢滚，旧数值的残影留在后面。
- **Lyric and cursor:** 同口号 1。
- **Maximal hit:** 没有。
- **Exit:** 灯丝一根根烧断，最后只剩黑里一个蓝点，落进培养皿。
- **First / last frame:** 黑底中央的小字 / 只剩 HANDOFF.petri 一个蓝点
- **Thread object:** 最后那根灯丝。
- **Value:** 700 W → 150 MW。
- **Fine print (draft):** `150 MW · one 100,000-GPU cluster (est.)`
- **Light/dark:** 黑底发丝线

## 13. world4: 副歌 4 主体 (119.489–128.934 s) · `culture.ts`

- **P(doom) structure:** paperclips.ts → fuse.ts; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 培养皿俯视 → 贴着琼脂低飞（光线步进）→ 教科书细胞剖面雕版 (生物)
- **Subject:** 线索物在这里揭晓，位置和 P(doom) 揭晓导火索的 fuse 一样。蓝点落进骨白的菌落，每个 8 分翻一倍（1、2、4…64）；镜头从俯视摇到贴着琼脂低飞；盖子每拍往下压一格，压成一条线。镜头拉开：这个蓝点在一个细胞里，是线粒体。二十亿年前一个细菌钻进了另一个细胞，没有被消化，留了下来，成了细胞的发电站。
- **Lyric and cursor:** 第一句沿菌落的生长前沿长出来，前沿就是光标；口号第二遍印在培养皿盖子的标签上，每拍被压一次。
- **Maximal hit:** 揭晓的那一拉。
- **Exit:** 最后半拍吸进蓝点，落在预副 5 的插头针脚上。
- **First / last frame:** HANDOFF.petri 一个蓝点 / 最后半拍吸进蓝点，落在 HANDOFF.pin
- **Thread object:** 揭晓：它是线粒体。
- **Value:** 细胞标签：约 1 pW。
- **Fine print (draft):** `DO NOT OPEN · strain: unknown · host: consenting`
- **Light/dark:** 石墨 → 骨白细胞雕版
- **Pending proofread:** 这句 whisper 听成 “I'll invade the human race”，待校对。如果不是 invade，揭晓仍放在这里，只是少一个双关。

## 14. prompt3: 预副 5 (128.934–133.378 s) · `mate.ts`

- **P(doom) structure:** prompt.ts (sydney); shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 接插件规格书，最响的一次 (接插件)
- **Subject:** 词上切加网格上切，外壳每拍收紧一格（在拍的前 1/5 吸附到位），最后砰地插到底，CAPITULATE 拼完整。
- **Lyric and cursor:** 同预副 2。
- **Maximal hit:** 插到底的那一下。
- **Exit:** 砰合成黑条，口号 4 开在色场上。
- **First / last frame:** 蓝点在 HANDOFF.pin / 砰地合上，全黑（口号 4 频闪开场）
- **Thread object:** 第 1 号针脚，插到底。
- **Value:** （不露）
- **Fine print (draft):** `mating cycles remaining: 0`
- **Light/dark:** 石墨

## 15. hook4: 口号 4 (133.378–137.267 s) · `hook.ts`

- **P(doom) structure:** hook.ts (n=4); shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 频闪：三色按 8 分交替，6 层叠影 (口号字)
- **Subject:** 全部拉满：每拍重砸，APPRECIATE 每个 8 分重新起跳，震屏最大。数值到 1 GW 以后，每 18 毫秒补一个 0，数字越来越小。
- **Lyric and cursor:** 同口号 1。
- **Maximal hit:** 第二个 POWER。
- **Exit:** 一串 0 压成一根全屏宽的线，就是菌丝的第一根。
- **First / last frame:** 全黑，频闪开场 / HANDOFF.hypha.y 一条全宽线，蓝点在 HANDOFF.hypha.x
- **Thread object:** 补上去的那一串 0。
- **Value:** 150 MW → 1 GW → 1,000,000,000,000…
- **Fine print (draft):** `1 GW · one datacentre campus`
- **Light/dark:** 频闪：石墨 / 蓝 / 骨白

## 16. world5: 副歌 5 主体 (137.267–148.934 s) · `mycel.ts`

- **P(doom) structure:** loom.ts; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 菌根网络的植物学雕版：树根和菌丝交换养分的网 (生物)
- **Subject:** “our greats will cooperate”：绝大多数陆生植物都和真菌共生，根给糖，菌丝给矿物质。一条菌丝按词分叉，每个分叉旁边长出暗色的备选分支，对应 loom 的续写树。
- **Lyric and cursor:** ① 第一句沿菌丝写，尖端是光标；② 口号第二遍，拉远看到整片林下的网；③ 口号第三遍，德罗斯特下潜：根尖 → 细胞 → 线粒体 → 嵴。
- **Maximal hit:** 拉远时整张网同时亮一下。
- **Exit:** 下潜到线粒体内膜的褶（嵴），一排褶就是管风琴的管子。
- **First / last frame:** HANDOFF.hypha 的线和尖端 / 一排褶就是 HANDOFF.pipes 的风琴管
- **Thread object:** 菌丝尖端：蓝点在长。
- **Value:** （不露）
- **Fine print (draft):** `no single tree owns the network`
- **Light/dark:** 石墨底骨白雕版
- **Pending proofread:** “When others state, our greats will cooperate” 待校对。

## 17. preach: preaching ×7 (148.934–164.490 s) · `organ.ts`

- **P(doom) structure:** dense.ts 的量化（每小节一个事件）; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 管风琴正面 + 赞美诗号码牌，雕版 (信仰)
- **Subject:** “We are preaching power” 唱 7 遍。一座管风琴，每小节拉开一个音栓，多一排管子；墙上的赞美诗号码牌每小节换一个号。
- **Lyric and cursor:** 7 句依次插进号码牌的字槽（号码牌本来就是把字一块块插进去）；正在插进去的那块字牌是光标。
- **Maximal hit:** 第 7 次：最后一个音栓 Vox Machina 拉开，所有管子一起亮。
- **Exit:** 风压收成一个光点，变成空展厅的聚光灯。
- **First / last frame:** HANDOFF.pipes 的风琴管 / 风压收成 HANDOFF.spot 一个光点
- **Thread object:** 管子里的一个光点。
- **Value:** 号码牌上的号就是数值：每小节翻一倍，1 GW、2 GW、4 GW……
- **Fine print (draft):** `Vox Humana 8′（真实的音栓，“人声”）旁边多了一个：Vox Machina 8′`
- **Light/dark:** 暗，雕版

## 18. inst: 器乐 (164.490–177.267 s) · `exhibit.ts`

- **P(doom) structure:** ilya.ts; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 自然史展厅：一排工具展柜，白线雕刻 (展厅)
- **Subject:** 夜里的展厅：手斧、算盘、打孔卡、芯片……最后一个展柜是空的。
- **Lyric and cursor:** 器乐段，没有歌词；展签是唯一的字。
- **Maximal hit:** 强拍上展柜灯一盏盏亮；最后是空展柜的灯。
- **Exit:** 空展柜的聚光灯收成一点，尾声在同一点落笔。
- **First / last frame:** HANDOFF.spot 一个聚光灯光点 / 收成 HANDOFF.clade 一个点
- **Thread object:** 聚光灯的光点。
- **Value:** 展签上的功率一路往上：手斧 0 W … 芯片 … 空柜 “— W”。
- **Fine print (draft):** `EXHIBIT PENDING · lender: —`
- **Light/dark:** 暗，白线雕刻

## 19. outroV: Neanderthal (177.267–185.601 s) · `clade.ts`

- **P(doom) structure:** leftturn.ts; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 人属系统发育树（分支图），一张图纸 (生物)
- **Subject:** “Neanderthal to human being / evolution, kill the gene / biology is superficial / intelligence is artificial”。一棵人属的分支图：尼安德特人和智人分开以后，枝又连回来一次（很多人身上还有约 1–2% 的尼安德特人 DNA），所以这棵树本来就不纯。最后绘图仪从智人的枝上画出一根新的蓝枝。
- **Lyric and cursor:** 四句分别写在四根枝上，绘图笔是光标。
- **Maximal hit:** “artificial” 上新蓝枝落笔。
- **Exit:** 三次甩镜后排空，只剩新枝的端点，交给 submit 的第一帧。
- **First / last frame:** HANDOFF.clade 一个点（分支图的根） / 只剩新蓝枝的端点，在 HANDOFF.summit
- **Thread object:** 新枝的端点。
- **Value:** （不露）
- **Fine print (draft):** `introgression: yes · outgroup: —`
- **Light/dark:** 石墨底骨白线

## 20. submit: submit (185.601–204.490 s) · `summit.ts`

- **P(doom) structure:** outro.ts 前段; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 登山海拔剖面图，一座座假山顶 (攀登)
- **Subject:** “submit / summit”。第一帧按下 submit，全片最大的一下。之后每唱一次，剖面图上出现一座更高的峰，每座都标着 FALSE SUMMIT，真正的山顶一直没有到。回扣开头的攀岩墙。
- **Lyric and cursor:** 每个 submit / summit 写在一座峰顶的标注里；蓝点沿剖面线往上爬，它就是光标。
- **Maximal hit:** 第一帧。
- **Exit:** 最后一座峰没有画完。
- **First / last frame:** HANDOFF.summit：第一帧引爆（全片最大的一下） / 同一个场景接尾巴
- **Thread object:** 爬剖面线的蓝点。
- **Value:** 数值最后一段：每个 submit 一个值，沿卡尔达肖夫指数往上：全人类约 20 TW → I 型约 10¹⁶ W → 太阳 3.8×10²⁶ W → …
- **Fine print (draft):** `FALSE SUMMIT · summit (est.): —`
- **Light/dark:** 石墨，蓝

## 21. tail: 尾巴 (204.490–215.271 s) · `summit.ts`

- **P(doom) structure:** outro.ts 结尾卡（不倒带）; shot table in docs/PDOOM-STRUCTURE.md.
- **Drawing language:** 结尾卡：剖面线走出画框 (攀登)
- **Subject:** 到结尾卡为止，不倒带。剖面线继续往右上走出画框，数值还在跳。最后一帧说明事情还在继续。
- **Lyric and cursor:** 没有歌词。
- **Maximal hit:** 没有，逐渐安静。
- **Exit:** 开放结尾。
- **First / last frame:** 接 submit / 开放结尾：线走出画框，数值还在跳；不倒带
- **Thread object:** 走出画框的线。
- **Value:** 还在跳。
- **Fine print (draft):** `MATCH LINE — SEE SHEET 2（工程图纸续页的真实写法）`
- **Light/dark:** 石墨，蓝
