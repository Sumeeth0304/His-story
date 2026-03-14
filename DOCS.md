# His-story — Interactive Bible Network Graph

A visually immersive website that presents the entire Bible as a living, physics-driven network. Each node is a Bible story. Stories are connected not just chronologically but thematically — prophecy to fulfillment, sacrifice to atonement, exile to return. The result looks like a neural network made of scripture.

---

## What It Does

- **Explore the Bible as a web** — every story is a glowing node; every connection is a thread of meaning
- **Click any node** — a side panel slides in with the story summary and an AI scholar you can chat with
- **Deep Dive** — clicking a node spawns a cloud button; clicking the cloud takes you to a focused view of that story surrounded by everything it connects to
- **Two views** — switch between the full neural network (Interconnect View) and a chronological line that opens as a heart shape and morphs into a timeline (Sequential View)
- **Live physics** — drag any node and the whole network responds; drop it and it stays pinned; double-click to release

---

## The Two Views

### Interconnect View
The default view. All 48 stories float freely, pulled together by their thematic and narrative connections. The denser the connections, the more the graph resembles a brain. This is the "big picture" — how the whole Bible breathes as one story.

### Sequential View
A chronological walk through scripture. When you switch to it, the stories first arrange themselves into a heart shape, then slowly morph into a horizontal timeline from Genesis to Revelation. The physics stay alive throughout — you can still drag and explore.

---

## The Stories

48 key stories across 7 eras:

| Era | Stories |
|-----|---------|
| Creation | Creation, The Fall, Cain & Abel, Noah's Ark, Tower of Babel |
| Patriarchs | Abraham's Calling, Sodom & Gomorrah, Isaac & the Sacrifice, Jacob & Esau, Joseph & His Brothers |
| Exodus | Moses & the Burning Bush, The Ten Plagues, Crossing the Red Sea, Ten Commandments, Wilderness Wandering |
| Conquest & Judges | Battle of Jericho, Deborah the Judge, Gideon's 300, Samson, Ruth & Boaz |
| Kingdom | Samuel & the First King, King Saul's Downfall, David & Goliath, David & Bathsheba, Solomon's Temple, The Kingdom Divided |
| Prophets & Exile | Elijah, Elisha, Isaiah, Jonah, Fall of Israel, Jeremiah, Fall of Jerusalem, Daniel, Esther, Ezra, Nehemiah |
| New Testament | Birth of Jesus, Baptism & Temptation, Sermon on the Mount, Miracles, The Transfiguration, The Last Supper, Crucifixion, Resurrection, Pentecost, Paul's Mission, Revelation |

---

## The Connections

Connections span eras and follow thematic threads, not just narrative order:

| Thread | Example |
|--------|---------|
| Prophecy → Fulfillment | Isaiah connects to the Birth, Crucifixion, and Resurrection of Jesus |
| Sacrifice & Atonement | Cain & Abel, Isaac, and the Passover all connect to the Crucifixion |
| Covenant Chain | Creation → Noah → Abraham → Ten Commandments → Jeremiah → Last Supper |
| Water & Rebirth | Noah's flood and the Red Sea both connect to Jesus' Baptism |
| Languages Scattered & Restored | Tower of Babel connects to Pentecost |
| Law & Grace | Moses and the Ten Commandments connect to the Sermon on the Mount |
| Elijah Figures | Elijah appears at the Transfiguration and foreshadows John the Baptist |
| Mirrored Names | King Saul's fall connects to Paul's conversion — same name, opposite arc |
| Alpha & Omega | Creation and Revelation are linked as the bookends of all scripture |
| Women of Courage | Deborah and Esther; Ruth is an ancestor of Jesus |
| Small Defeats Great | Gideon's 300 connects to David & Goliath |
| Death Brings Victory | Samson connects to the Crucifixion |
| Visions of the End | Daniel connects to Revelation |

---

## The AI Scholar

Every story panel includes a chat interface powered by Claude AI. The scholar is given the full context of whichever story you're viewing — title, scripture, era, and summary — so its answers are always grounded in that specific story. You can ask about themes, history, theology, characters, or connections to other parts of the Bible.

The scholar is available in two places:
- **Main graph** — opens in the right panel when you click any node
- **Deep Dive page** — lives in the lower half of the right panel, always focused on the center story

---

## Deep Dive

When you click a node, a golden cloud floats up near it — below and to the side, so it never covers the node description. Clicking that cloud takes you to a dedicated page for that story — the selected story sits at the center of a radial graph, with every connected story arranged in a circle around it.

On the Deep Dive page:
- **Click any connection line** to see a short label explaining why those two stories are linked (e.g. "Suffering Servant", "Alpha & Omega", "3 Days & 3 Nights"). Every connection across all 48 stories has its own label. Click the line again or click the background to dismiss it.
- **Hover a surrounding node** to highlight it and reveal a button to deep dive into that story
- **AI Scholar** — the same chat interface from the main page is available here, always focused on the center story you're diving into
- **Back to Graph** — returns to the main network page
- **Previous Node** — steps back through your deep dive history, so you can retrace your path through connected stories

---

## Visual Theme

- Near-black background (`#0d0a06`) — like looking at stars
- Gold edges and accents (`#c4960a`) — like illuminated manuscript ink
- Each era has its own color: gold, amber, crimson, lime, royal blue, purple, teal
- EB Garamond font throughout — a serif typeface with an ancient manuscript feel
- Nodes glow; selected nodes pulse; the whole graph breathes with physics

---

## How View Switching Works (and What Was Fixed)

Switching between Interconnect View and Sequential View turned out to be the trickiest part of the project. Here is what goes on under the hood — explained simply — and the two bugs that had to be solved.

### The core problem with switching views

The physics engine (d3-force) does something sneaky: it takes the list of story connections you give it and quietly overwrites the connection data in-place. A connection that started as `"creation" → "noah"` gets replaced with a direct pointer to the live node objects. This happens invisibly, inside the simulation.

The problem: those connection objects are stored in a shared array. So after the first time the graph runs, that array is corrupted — the string ids are gone. The next time you switch views and the graph restarts, it receives already-mutated connections and can't figure out where to draw the lines. Nodes end up in one place, lines in another.

**The fix:** connection data is now stored as simple pairs of strings (`["creation", "noah"]`) in a format the physics engine never touches. Every time the graph needs connections, it creates fresh copies from those pairs. The physics engine mutates the copies, not the originals.

### The second problem: nodes resetting on every switch

Every time you switched back to Interconnect View, all the nodes were jumping back to the center of the screen and scattering again. This happened because the code was creating brand-new node objects on every switch — nodes with no position history. The physics engine had to re-spread them from scratch each time.

**The fix:** Interconnect View now reuses the same node objects across every switch. The physics engine writes position data directly onto those objects as the graph runs. When you switch away and come back, the nodes are exactly where you left them — because they were never replaced.

Sequential View intentionally gets fresh node objects every time you switch to it, so the heart animation always replays from the beginning.

### Preserving the right view state

A third issue: when you clicked a node to open the side panel, then closed it, the graph was resetting to its original unpositioned state. This was because the close action was pulling from a stale copy of the node list instead of the live one.

**The fix:** the graph now tracks a reference to the current live nodes at all times. Opening and closing the side panel reads from that live reference, so node positions are always preserved.

---

## Running the Project

```bash
npm run dev
# open http://localhost:3000
```

Requires an `ANTHROPIC_API_KEY` in `.env.local` for the AI chat to work.

---

## Mobile Layout

The site is fully usable on a phone. The layout adapts in the following ways:

**Main graph page:**
- The story list on the left is hidden by default to give the graph more room
- A hamburger button (☰) in the top-left corner opens the story list as an overlay; tapping any story or the dark backdrop closes it
- The header shrinks to fit the screen width
- When you tap a node, the story panel slides up from the bottom instead of in from the right

**Story panel on mobile:**
- The panel opens at 72% of the screen height, leaving the graph visible above it
- A drag handle at the top lets you resize the panel by pulling it up or down
- Releasing the handle snaps the panel to a compact size (35vh) or full size (72vh)
- Dragging it almost completely off the bottom of the screen closes it

**Deep Dive page on mobile:**
- The graph and the story panel stack vertically — graph on top (45vh), panel below (55vh)
- The "His-story" header is hidden on mobile to give the graph the full space it needs
- The navigation buttons (← Graph, ← Previous) stay pinned to the top-left

---

## Possible Next Steps

- Search / filter stories by name or theme
- Toggle entire eras on and off
- Text-to-speech narration of story summaries
- Expand beyond 48 stories to include Psalms, Proverbs, minor prophets, and more
