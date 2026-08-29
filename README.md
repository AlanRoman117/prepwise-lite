# PrepWise Lite

Smart pantry tracking and recipe management, built privacy-first: no backend,
no accounts, no network calls, no build step. Everything runs from a folder,
works offline forever, and your data stays in your browser in `localStorage`.

Built for the **OpenAI WebMCP Challenge**. PrepWise registers its own
functions as [WebMCP](https://github.com/webmachinelearning/webmcp) tools, so
an AI agent open in the same browser tab — Chrome with WebMCP enabled, or
ChatGPT's in-app browser — can read your pantry and shopping list directly,
or propose changes (add items from a photo, write up a recipe with step
timers) without any server ever seeing your data. See
[WebMCP tools](#webmcp-agent-tools) below for how that works and why writes
are staged rather than applied automatically.

## Why WebMCP fits this app

A conventional MCP server can't do this: PrepWise's pantry lives in the
browser's `localStorage`, and no server process ever sees it — that's the
whole privacy pitch. WebMCP lets the agent call into the page itself, so the
"smart" part of a smart pantry app can finally talk to an assistant without
opening a backend, an account system, or a network call to do it.

## Getting Started

**Serve locally** (a local server is required — the `file://` protocol
disables some browser features PrepWise depends on):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Any other static server works too (`npx serve .`, VS Code Live Server, etc.).

**Try it instantly:** open **Settings → Try Sample Data** and load the demo
kitchen (17 staples, 3 recipes, a shopping list, an expired item, and a
couple of step timers) — or import `prepwise-demo-backup.json` directly via
**Settings → Import Data**.

**Try the agent tools:** open PrepWise in Chrome with `chrome://flags/#enable-webmcp-testing`
enabled (or ChatGPT's in-app browser), go to **Settings → Share with an AI
Assistant**, and turn the toggle on. It's off by default — an app whose pitch
is "nothing leaves your device" shouldn't open a door for agents without you
choosing to.

## WebMCP (agent tools)

`assets/js/webmcp.js` registers PrepWise's own functions as tools an agent in
the browser can call. A few things it deliberately does:

- **Reads are answered directly; writes are staged, never applied.** An
  agent can hallucinate a count from a photo, or misread a label. Proposing
  new inventory or a new recipe builds a backup-shaped object, runs it
  through the same validation and sanitization a real backup file gets, and
  opens the same import preview for you to confirm — an agent gets no
  shortcut a hostile file wouldn't get.
- **Reads go beyond a plain pantry dump.** `get_expiring_items` ranks what's
  expiring soonest; `get_recipe_gaps` reports exactly what a recipe is short
  on — with amounts — so an agent can ground a substitution in what's
  actually on the shelf instead of guessing; `get_meal_plan_candidates` ranks
  saved recipes for weekly planning, prioritising ones that use up an
  ingredient before it's wasted; `get_recipe_timings` batches several
  recipes' timing in one call so an agent can sequence them across limited
  stovetop, oven or air-fryer capacity — PrepWise doesn't model appliances at
  all, that's the agent's job; `get_disruption_snapshot` hands over a full
  pantry-and-recipe snapshot for planning around a power outage or storm,
  with a built-in disclaimer that PrepWise tracks no temperature or nutrition
  data, so any spoilage or nutritional-gap judgment is the agent's own, not a
  PrepWise calculation; `check_recipe_against_allergies` flags whether a
  recipe conflicts with an allergy you've actually recorded, never how
  severe.
- **Proposed inventory writes are merge-only.** A misread photo may add the
  wrong item; it may never empty your pantry. The replace option is hidden
  for agent-sourced proposals, and the merge choice is enforced independently
  of anything the UI shows.
- **Proposing a recipe cannot touch the pantry.** The recipe proposal payload
  has no path to inventory at all — restocking your kitchen is something you
  do by writing a recipe yourself, not something an assistant does for you.
- **Off until you switch it on**, in Settings. Registering tools reveals
  nothing but tool names and descriptions, but an app that promises to hold
  your allergy data and let nothing out shouldn't open a second door on your
  behalf by default.
- **Allergy severity is never disclosed** to an agent, and every response is
  capped in size and marked as untrusted content, since pantry names are
  user-typed and can come from an imported file.

## Project Structure

```
prepwise-lite/
├── index.html                 # All views and modals
├── assets/
│   ├── css/styles.css         # Theme tokens + utility classes
│   ├── fonts/                 # Inter variable font, vendored (woff2)
│   └── js/
│       ├── app.js             # Application state, rendering, storage
│       ├── display.js         # Per-device theme/text-scale prefs (loaded in <head>)
│       ├── timers.js          # Kitchen timers + Timers view
│       ├── simple-entry.js    # Bulk text entry for inventory
│       ├── webmcp.js          # WebMCP tool registration for AI agents
│       └── sample-data.js     # Embedded demo kitchen
├── prepwise-demo-backup.json  # The demo kitchen as an importable file
└── LICENSE                    # MIT
```

## Features

- **Inventory management** with expiration tracking, smart alerts, and an
  A–Z rail for jumping around a long pantry
- **Recipe management**, from either direction — write a recipe before you
  have the ingredients, tick off what you already own, and the rest becomes
  your shopping list automatically
- **Cook Mode**: tick ingredients as you use them; "Recipe completed" shows
  an exact before/after deduction plan before touching your pantry
- **Allergy alerts** against the FDA Top 9 allergens, with recipe filtering
- **Kitchen timers** that store an absolute end time, so they survive a
  reload or a closed tab
- **Full JSON backup/restore**, plus recipe, shopping-list, and AI-friendly
  Markdown exports
- **Light/dark theme** ("Kitchen Garden") that follows the system by default
- **WCAG 2.1 AA accessible**: full keyboard operability, managed dialog
  focus, and screen-reader-friendly controls throughout

## Technology

Vanilla HTML5, CSS3, and JavaScript — no framework, no bundler, zero runtime
dependencies. A strict Content-Security-Policy (`connect-src 'none'`) means
the app cannot make a network call even if it wanted to; every WebMCP tool
handler runs in-page against the same `state` the UI already renders.

## License

MIT — see [LICENSE](LICENSE).
