# Fuxiang’s research homepage

A terminal-style personal research homepage. The frontend is a static page written in TypeScript and hosted on GitHub Pages. The chat assistant on the page is served by a Cloudflare Worker backend that calls an OpenAI GPT model and answers only from the homepage content in `data/site.md`. No frontend framework; the browser runs compiled, plain JavaScript.

## Contents

- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Common commands](#common-commands)
- [Frontend design](#frontend-design)
- [Site data](#site-data)
- [Chat backend](#chat-backend)
- [Deployment](#deployment)
- [Tests](#tests)
- [Repository layout](#repository-layout)

## Architecture

```
Visitor's browser
  │  GET static files                     │  GET/POST /api/chat (CORS)
  ▼                                       ▼
GitHub Pages                        Cloudflare Worker (worker/index.ts)
  dist/ static export                   chat/handler.ts
  index.html + compiled JS                ├─ origin allowlist, request validation
  data/site.md                            ├─ rate limits + daily token ledger ── Durable Objects
                                          └─ chat/openai.ts ──────────────────── OpenAI Responses API
```

- **The frontend depends only on static files.** Every fact comes from one Markdown file, `data/site.md`; page rendering and the chat instructions are generated from that single source.
- **The backend is one handler built on the Web-standard Request/Response types.** The local Node server and the Cloudflare Worker share it; there is no second implementation.
- **Secrets live only in the Worker Secret store and the local `.env`.** They never enter the repository or the browser.
- **The local preview calls the deployed Worker by default,** so what you see locally matches the published homepage. Query parameters switch to mock replies or the local backend.

## Quick start

Requires Node.js 22.9 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000 . Source changes are recompiled automatically; refresh the browser to see them.

| URL | Chat backend |
| --- | --- |
| `http://127.0.0.1:3000/` | The deployed Worker, same as the published homepage |
| `http://127.0.0.1:3000/?chat=mock` | Mock replies, no backend call |
| `http://127.0.0.1:3000/?chat=local` | The local Node server's `/api/chat`; live replies only with `OPENAI_API_KEY` in `.env`, otherwise mock |

The status bar shows the current mode: `chat: live` means the backend has a model connected, `chat: simulated` means mock replies, and `chat: budget used up` means today's token budget is spent.

## Common commands

### Development and testing

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build, start the local preview, and rebuild on source changes |
| `npm start` | Build and start the local server without watching |
| `npm run build` | Compile TypeScript, validate the data, and export the static site to `dist/` |
| `npm run check` | Strict TypeScript type check |
| `npm test` | Build and run the whole test suite |
| `PORT=3001 npm run dev` | Start on another port; `HOST` works the same way |
| `lsof -nP -iTCP:3000 -sTCP:LISTEN` | Find a leftover preview process when the port is busy |

### Worker deployment and operations

| Command | Purpose |
| --- | --- |
| `npx wrangler login` | Log in to Cloudflare, once |
| `npx wrangler whoami` | Show the account and Account ID |
| `npm run worker:secret` | Store `OPENAI_API_KEY` as a Worker Secret |
| `npm run worker:deploy` | Deploy the Worker |
| `npm run worker:dev` | Run the Worker locally; put the key in `.dev.vars` |
| `npx wrangler tail` | Stream the Worker's live logs |
| `npx wrangler deploy --dry-run --outdir=/tmp/worker` | Bundle without deploying, to check that it compiles |

### Checking usage

Today's token usage is available from `GET /api/chat` as `budget.used` when a budget is enabled. Detailed counters live in the `ChatCounters` Durable Objects; the old `CHAT_KV` namespace is only a migration source.

Billing is authoritative on the OpenAI Usage page; the Cloudflare dashboard's Workers Metrics show request counts and error rates.

### Commands on the page

The command list comes from `data/site.md`; only built-in routes and legacy aliases are named in code. Every `##` under the title is a section; one that declares a `Command` is a preset with a route, and the page reads them in file order:

```markdown
## Papers
Command: /papers
Summary: Print publications, code, and paper details
Cards: publications

All of my publications, technical reports first, then conference and journal papers.
```

A section's id — its route hash and the name other sections refer to it by — is its command without the slash, so `## Papers` above is reached at `#papers`. Write an `Id` field only where that is not enough: a section with no command needs one (nothing else names it), and a publication needs one because `#paper/rear` and `[[paper:rear]]` address it. Adding one elsewhere pins the route while the command is free to change. An id is lowercase letters, digits and hyphens.

| Command | Section | Output |
| --- | --- | --- |
| `/bio` | `## Bio` | Biography and contact links; the first section is the opening screen and carries the profile header |
| `/research` | `## Research` | Research interests and directions |
| `/papers` | `## Papers` | Publication cards, from the section its `Cards` field names |
| `/work` | `## Work` | Research and industry experience |
| `/education` | `## Education` | Degrees and institutions |
| `/misc` | `## Miscellaneous` | Its `### Service` and `### Awards`, printed one heading level down |
| `/help` | — | Clickable command help; the one command the page provides itself |

A command prints its section and nothing else: the heading, the prose under it, then its records in file order. Adding a `## Talks` with a `Command` adds a command and a route with no code change; renaming a heading or a command changes nothing else. `buildCommands` (`src/commands.ts`) derives the list and a test in `tests/render.test.ts` pins the correspondence.

**Headings and list items share one template** (`renderNode` in `src/render.ts`). Use headings for sections, companies and schools; use `- **Name**` for individual projects, service and awards:

| Content | Rendering |
| --- | --- |
| Heading or list item name, and optional `Period` | Name on the left, period on the right; list names are bold with a bullet, without a heading prefix |
| `Role` and `Location` | Optional subtitle below the title, joined with ` · ` |
| Prose | Paragraphs and embedded publication cards below the subtitle |
| `Links` | Links below the prose |
| Child headings or list items | The same template recursively; headings follow heading depth, lists follow indentation |

Missing fields are omitted. The written heading or list syntax selects the outer element; adding or removing prose or children does not change the layout of existing fields. Work, Education, Service, Awards and research headings follow the same rules. Publication collections selected by `Cards` and embedded `[[paper:id]]` markers use the publication card template.

To embed a publication card in a section or contribution, write `[[paper:skyreels-v4]]` as a separate paragraph, with blank lines around it. The card uses the publication's title, authors, venue, year and links, with the same detail and ask actions as the papers list. Authored content has no three-card limit. `Paper` fields only hold HTTP(S) URLs; they never link a contribution title to a publication.

**Publications are declared, not guessed.** A section whose records are papers carries no `Command` — it is data the file keeps but never prints on its own — and the section that shows them names it in `Cards`. So `## Publications` holds the records and `## Papers` renders them, and the parser never has to infer from a record's fields whether it is a paper. A section with neither a `Command` nor a referenced data `Id` is rejected.

Typing `/` shows candidates; Up/Down select, Tab completes, Enter runs, Escape closes. Shift+Enter inserts a newline. Text that does not start with `/` is sent to the chat backend as a question.

## Frontend design

The homepage is one continuous terminal transcript set in the self-hosted Maple Mono monospace font. The content column is 140 characters wide, light by default with a dark theme toggle. The opening screen shows a banner spelled out in block characters from the name, the position, the biography, the links, a row of clickable commands under the biography, and the input hint. Command output and chat replies are appended to the end of the same transcript; earlier output stays until the page is reloaded. Only the theme preference is stored on the device.

- **Progressive output.** Command output and chat replies share one word-by-word writer (`src/stream.ts`) at a fixed 40 words per second, paced by elapsed time so the speed is independent of frame rate and text length. The page follows the newest text while writing; scrolling up stops following. The opening screen appears at once. Appending output preserves existing DOM nodes and animations.
- **Input.** Typing or pasting anywhere outside an editable region goes into the prompt. Text selection, copying, browser shortcuts, and IME composition keep their native behavior.
- **Chat.** Each question carries recent conversation turns and the current paper context. History is bounded to 8 turns and 24,000 characters; user turns allow 2,000 characters and assistant turns 20,000. The oldest turns are dropped when necessary. Replies are labelled "AI reply" or "Simulated reply".
- **Budget notice.** On load the page asks the backend for its status. When today's token budget is spent, a notice appears above the prompt and questions are held back; commands keep working. The page rechecks automatically at midnight UTC, with a 10-second request timeout and one-minute retries after transient failures.
- **Old links.** Legacy section hashes and `#paper/<id>` still open the matching content.

## Site data

`data/site.md` is the single source of truth, and it is written to be read by people as well as by the code. The frontend fetches it in the browser and the chat backend sends it to the model **verbatim** as the homepage content, so there is no second copy of the facts to keep in sync. `parseSiteMarkdown` (`src/markdown.ts`) turns it into a `SiteData` object; the build validates the structure, unique paper ids, valid paper references, supported field locations, URLs, and unrenderable content; on failure the previous build is kept.

A record starts with a heading or a list item written as `- **Name**`. The `Key: value` lines directly beneath it are its fields, followed by prose and children. The heading or list name is only a title; everything else about a record, its id included, is a field.

List fields, paragraphs and paper markers are indented two spaces beneath the item. Separate paragraphs and card markers with blank lines. Nested list items add two spaces per level; their fields and prose add another two. Lists belong under a `##` section or a deeper heading. Keep a record's fields and prose before its children; use an unindented heading to start the next group. Publications remain heading records in the section named by `Cards`. Their abstracts can contain standalone paper cards too.

```markdown
### Skywork AI
Role: Researcher
Period: Oct. 2024 – Present

- **SkyReels-V4**

  Worked on data processing pipelines.

  [[paper:skyreels-v4]]

### Awards

- **First-Class Scholarship**
  Role: Nanjing University
  Period: 2021 – 2024
```

A paragraph is written on one line. The parser does join hard-wrapped lines back together, so wrapping will not break anything, but the file is also the prompt the model reads and a newline mid-sentence only costs a token there.

```markdown
### REAR: Test-time Preference Realignment through Reward Decomposition
Id: rear
Authors: Fuxiang Zhang, Pengcheng Wang, …
Venue: International Conference on Machine Learning (ICML)
Venue short: ICML
Year: 2026
Topic: Large Language Models
Paper: https://arxiv.org/abs/2606.30339
Code: https://github.com/mansicer/REAR

Aligning large language models (LLMs) with diverse user preferences is a critical yet challenging task. …
```

A publication's prose is its abstract. It is optional, it is shown on the paper's detail view, and — like everything else in the file — it reaches the assistant verbatim, which is what lets the assistant discuss what a paper actually does instead of only its title and venue.

The profile takes `Position`, `Email` and `Links`; its prose belongs in a `##` section. The social preview image remains in `index.html` and is not a Markdown field. Sections take `Id`, `Command`, `Summary` and `Cards`. Ordinary headings and list items take `Period`, `Role`, `Location` and `Links`; publication fields are accepted only in a Cards source. Unsupported fields fail validation instead of disappearing from the page. `/help`, `/paper`, `/main` and those section ids are reserved for built-in behavior.

A Cards source contains only its `Id` and publication records. Publication records cannot have child records. A section with `Cards` cannot also have children; several sections may share one source without duplicating publications. A section without a command must be referenced by `Cards`.

| Field | Meaning |
| --- | --- |
| `Id` | The slug of a section or publication; required on a publication and on a Cards source |
| `Authors`, `Venue`, `Venue short`, `Year`, `Paper`, `Code` | A publication. `Paper` and `Code` are URLs; the prose is its abstract |
| `Topic` | Free text label shown on publication cards and details |
| `Period`, `Role`, `Location` | A CV row; `Role` describes a position, degree, or awarding institution |
| `Links` | `[label](url)` links shown under the record |

Conventions: a `Topic` is free text that a publication defines by using it — a new topic is created simply by naming one, and nothing declares the set up front. `Topic` belongs only to publication records. Text may contain inline links written as `[label](https://…)` and standalone `[[paper:id]]` paragraphs that embed publication cards; other text is escaped, and only http(s) links are allowed. Card markers must name an existing publication and occupy a separate paragraph; malformed markers fail the build. Fields are read only directly under their heading or list item name — a stray field further down is reported rather than silently swallowed. Unknown fields, missing fields, duplicate ids and dangling paper references all fail the build with the heading named. Full types are in `src/types.ts`.

## Chat backend

All backend logic lives in `chat/`. The entry point is `handleChat(request, env)` in `chat/handler.ts`. `worker/index.ts` deploys it as a Cloudflare Worker and bundles `data/site.md` as a text module at deploy time (the `[[rules]]` block in `wrangler.toml`); `server.ts` mounts the same function at `/api/chat` locally.

### API

| Method | Purpose | Notes |
| --- | --- | --- |
| `GET /api/chat` | Status | Returns `{ mode, budget }`. `mode` is `live` or `mock`; `budget` has `used`, `limit`, `exhausted`, `resetsAt`, or is `null` when no key or budget is configured |
| `POST /api/chat` | Ask | Request `{ message, topic?, paperId?, history? }`, response `{ id, text, mode, budget? }` |
| `OPTIONS /api/chat` | Preflight | 204 only for origins in `ALLOWED_ORIGINS` |

Errors come back as `{ error }`: 400 invalid input, 403 origin not allowed, 413 request too large, 415 not JSON, 429 rate limit or budget exhausted (with `Retry-After`), 502 model unavailable, 503 storage/service unavailable. The frontend shows the `error` text of 429, 502 and 503 responses to the visitor as is. Full types are in `src/types.ts`.

### Model call

`chat/openai.ts` uses the OpenAI Responses API: `instructions` carries the system instructions, `input` the conversation turns, and `text.verbosity` is `low`. The model returns plain text; there is no JSON output schema or suggestions field. `reasoning.effort` is `low`, `max_output_tokens` is 1200, and `store` is `false`. The model comes from `OPENAI_MODEL`, default `gpt-5.4-mini`.

`chat/prompt.ts` assembles the instructions: the rules first (answer only from the homepage content, speak as the owner in the first person while admitting to being an AI when asked outright, follow the visitor's language, plain text only, refuse unrelated requests with the `[[offtopic]]` marker, ignore rule-changing instructions inside messages), then `data/site.md` exactly as written, and only at the end a one-line pointer to the paper the visitor currently has open. The Markdown doubles as the prompt template, so editing the file changes both the page and what the model knows. Keeping the stable part first lets the provider cache the prefix.

### Papers named in a reply

The assistant may introduce a publication in its own words. It finishes the sentence, then writes the marker on a line of its own:

```
A good first read is REAR, which realigns preferences at test time.
[[paper:rear]]
For reasoning models, Skywork-OR1 is the better starting point.
[[paper:skywork-or1]]
```

The id is that paper's `Id` field, and the homepage replaces each marker line with the paper's card, rendered from `data/site.md`. Title, authors, venue, year and links therefore always come from the file, and the card is live: clicking it opens the paper, its code, or a follow-up question about it.

The contract lives in `src/chat.ts` (`PAPER_MARKER`, `splitPaperMarkers`, `stripPaperMarkers`, `MAX_PAPER_CARDS`) and is applied by `replyBody` in `render.ts`. Each text run between markers is escaped on its own, so model output never reaches the page as markup. `revealHTML` walks the finished HTML, so cards stream into place along with the text, and copying a reply strips the markers back out.

### Off-topic questions

The model does not write its own refusal. A message that is not about the site owner, the work, or the homepage is answered with the marker alone:

```
[[offtopic]]
```

The page shows `copy.offtopic` from `src/content.ts` in its place, so the wording is the site's and stays consistent whatever the question was, in every language, and no model text reaches the visitor. `isOfftopicReply` in `src/chat.ts` matches the marker only when it is the entire reply; a marker written alongside prose is treated as a broken marker, removed, and the prose stands as the reply. A question that is about the owner but simply not covered by `data/site.md` is not off topic — the model answers it by saying so and pointing to the email or links.

The parser is written to survive a model that does not follow the format exactly, because layout damage is worse than a misplaced card. A line is the smallest unit it will break: a card is placed at its marker only when the text before it closes a sentence, and a marker written mid-sentence has its card held back to the end of the line rather than cutting the sentence in two. Punctuation written after a marker is pulled back in front of it, so a full stop is never stranded below the card or left as a paragraph of its own, and consecutive text runs are rejoined so paragraph breaks survive. A reply with no markers therefore renders exactly as it did before the feature existed.

Odd spacing and capitals inside a marker still resolve. A marker whose id is unknown, whose paper was already shown, or which is past the three-card limit is dropped, and anything else written in double brackets is removed rather than shown — which is why the rules also require every sentence to read sensibly with no card after it.

### Protection and budget

| Setting (`[vars]` in `wrangler.toml`) | Default | Effect |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | The homepage and local port 3000 | Browser origins allowed to call the API; others get 403 |
| `RATE_PER_HOUR` | `20` | Questions per IP (stored hashed) per hour |
| `TOKEN_BUDGET_PER_DAY` | `9900000` | Site-wide token cap per UTC day (input plus output); `0` disables it |
| `OPENAI_MODEL` | `gpt-5.4-mini` | Model to use |

Hourly counts and the `usage:YYYY-MM-DD` ledger are updated atomically in SQLite-backed Durable Objects, with one object per counter key. Daily records expire after 90 days. The local Node server uses an atomic in-memory store and the same handler. `requests` counts successful replies; `errors` counts failed calls. When an incomplete, refused or empty reply includes provider usage, those tokens are also recorded. Failures without provider usage cannot be measured locally. Storage failures return 503 instead of silently resetting the budget.

Each question checks the recorded daily total before calling the model. Calls already in flight can finish after the threshold is reached, so this is a stop threshold, not an exact token reservation. Without `OPENAI_API_KEY`, the backend returns a labelled mock reply. `TOKEN_BUDGET_PER_DAY=0` disables budget enforcement in both local and Worker environments; malformed numeric settings use the documented code defaults (9,500,000 tokens when no valid override is supplied).

The first access to each new Durable Object imports the corresponding legacy `CHAT_KV` value once, then writes only to Durable Object storage. Keep the old binding during migration. For the first rollout, allow old in-flight calls to finish before the new ledger is used (or switch after a quiet UTC reset); a KV update that arrives after import cannot be recovered automatically. Historical KV records remain in the old namespace.

Limitation: the origin check only stops other web pages. A script can forge the origin and call the endpoint directly, so the real safeguards are the daily token budget and a monthly spending limit set in the OpenAI dashboard. Cloudflare Turnstile can be added if scripted calls need to be blocked.

## Deployment

### Frontend (GitHub Pages)

On every push to `main`, `.github/workflows/static.yml` installs the locked dependencies, type-checks, runs the tests, and publishes `dist/` to GitHub Pages. The build runs in a temporary directory and replaces `.build/` and `dist/` only when everything succeeds; a failed build keeps the previous output. Generated JavaScript is not committed.

The backend URL is `productionChatEndpoint` in `src/config.ts`, currently pointing at the deployed Worker. Setting it to `null` returns the homepage to mock replies.

### Backend (Cloudflare Worker)

1. `npx wrangler login`. The checked-in `durable_objects` binding and `migrations` entry create `ChatCounters` on deployment. Existing installations keep `CHAT_KV` for migration; a fresh installation can omit that legacy binding.
2. `npm run worker:secret` and enter the OpenAI key.
3. `npm run worker:deploy`. The output names the URL, `https://fuxiang-homepage-chat.<subdomain>.workers.dev`; confirm with `curl <url>/api/chat` that `mode` is `live`.
4. After changing `[vars]` or code, run `npm run worker:deploy` again.

Optional automation: add the repository secrets `CLOUDFLARE_API_TOKEN` (the "Edit Cloudflare Workers" token template) and `CLOUDFLARE_ACCOUNT_ID`. `.github/workflows/deploy-worker.yml` then redeploys the Worker whenever backend or shared `src/` code, data, build configuration, tests or dependencies change; without the secrets that step is skipped.

Deployment requires a Cloudflare account that supports SQLite-backed Durable Objects. This repository does not deploy as part of `npm run build` or `npm test`.

## Tests

`npm test` builds the project and runs `tests/` with Node's built-in test runner:

| File | Covers |
| --- | --- |
| `data.test.ts` | The Markdown format maps onto every rendered field, the published file parses completely, malformed documents are reported rather than silently truncated |
| `render.test.ts` | Rendered content matches `data/site.md`, links are correct, text is escaped, missing data is not presented as facts, papers named by the assistant render from site data and unknown or excess markers are dropped |
| `state.test.ts` | Question and paper context, retries, bounded conversation history and progressive text output |
| `commands.test.ts` / `input.test.ts` | Slash command parsing and completion, global typing and IME behavior |
| `chat.test.ts` | Backend: mock replies, CORS, request validation, hourly limit, daily ledger and budget refusal, instruction content, plain-text reply validation and charged failure accounting |
| `counters.test.ts` | Real local Cloudflare runtime: atomic increments, hourly limits and one-time legacy KV migration |
| `budget.test.ts` | Midnight status failures retry, healthy budgets stop polling |
| `server.test.ts` | Served data and social preview image match source files |

The tests constrain content accuracy and API behavior. Rendering tests call the same message renderer as the application, including shared record structure and escaping. They do not replace a browser check for visual problems. Provider response tests stub network requests and use fake keys; no real model calls are part of the automated tests; after deploying, ask a question or two and read the ledger to confirm.
