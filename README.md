# Fuxiang’s research homepage

A terminal-style personal research homepage. The frontend is a static page written in TypeScript and hosted on GitHub Pages. The chat assistant on the page is served by a Cloudflare Worker backend that calls an OpenAI GPT model and answers only from the homepage content in `data/site.md`. No frontend framework; the browser runs one bundled JavaScript module.

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

Every visible `##` section declares a `Command`; `/help` is built in. Commands and their descriptions are derived from Markdown in file order. A section's route is its `Id`, or its command without the slash. `Home` in the profile explicitly chooses the opening section. Command names never select templates or styles.

| Command | Content |
| --- | --- |
| `/bio` | Profile component, biography and authored navigation links |
| `/research` | Research headings, explicitly declared collapses and paper references |
| `/papers` | Publication cards, in the source's written order |
| `/work` | Employer records with nested project lists |
| `/education` | Education records as list items |
| `/misc` | Service and Awards as third-level headings, each followed by a list |
| `/help` | Generated command help |

Typing `/` shows candidates; Up/Down select, Tab completes, Enter runs, Escape closes. Shift+Enter inserts a newline. Other text asks the assistant a question. Existing paper ids and legacy route aliases remain supported.

## Frontend design

The homepage is one continuous terminal transcript set in the self-hosted Maple Mono monospace font. The content column is 140 characters wide, light by default with a dark theme toggle. The opening screen shows a banner spelled out in block characters from the name, the position, the biography, the links, authored navigation links under the biography, and the input hint. Command output and chat replies are appended to the end of the same transcript; earlier output stays until the page is reloaded. Only the theme preference is stored on the device.

- **Progressive output.** Live chat text appears as network deltas arrive. Command output and mock replies use a word-by-word writer (`src/stream.ts`) at a fixed 40 words per second, paced by elapsed time so the speed is independent of frame rate and text length. The page follows the newest text while writing; scrolling up stops following. The opening screen appears at once. Appending output preserves existing DOM nodes and animations.
- **Input.** Typing or pasting anywhere outside an editable region goes into the prompt. Text selection, copying, browser shortcuts, and IME composition keep their native behavior.
- **Chat.** Each question carries recent conversation turns and the current paper context. History is bounded to 8 turns and 24,000 characters; user turns allow 2,000 characters and assistant turns 20,000. The oldest turns are dropped when necessary. Replies are labelled "AI reply" or "Simulated reply".
- **Budget notice.** On load the page asks the backend for its status. When today's token budget is spent, a notice appears above the prompt and questions are held back; commands keep working. The page rechecks automatically at midnight UTC, with a 10-second request timeout and one-minute retries after transient failures.
- **Old links.** Legacy section hashes and `#paper/<id>` still open the matching content.

## Site data

`data/site.md` is the single source of content and structure. Markdown controls content, order, heading levels and component boundaries. The renderer maps those declarations to HTML. CSS controls appearance; the controller adds interaction and progressive output. The backend receives the original source verbatim.

`src/markdown-engine.ts` configures markdown-it with raw HTML disabled. `src/markdown.ts` turns its parsed blocks into one ordered `Node.body` tree. Paragraphs, lists and components can interleave: text after a nested list remains after that list. Standard Markdown supports ordinary and ordered lists, nesting, links, emphasis, inline code, fenced code, blockquotes and tables. HTTP(S), mailto, hash and explicit relative links are supported; unsafe URL schemes are not rendered as links.

### Profile and sections

```markdown
# Ada Lovelace
Home: bio
Title: Ada Lovelace - Homepage
Description: Research on analytical engines.
Position: Researcher
Email: ada@example.org
Links: [Website](https://example.org)

## Bio
Command: /bio
Summary: Print biography

:::profile
:::

Biography text.

[Explore my research](#research), or type [/help](#help).
```

`Home` names the Id of a visible section. `Title` is optional and defaults to the name plus ` - Homepage`; `Description`, `Position` and `Email` are required. Build-time HTML metadata, the browser title and the home link all come from these fields. The empty `profile` component explicitly places the name banner, position and contact links. It may be placed wherever it is needed; rearranging sections does not move the home route or inject profile content elsewhere. The social image remains a static asset in `index.html`.

Fields occupy consecutive lines directly under their heading, record name or publication opener. After fields, separate body content with a blank line. Unsupported or misplaced metadata is reported. `Id` uses lowercase letters, digits and hyphens; `/help`, `/main` and `/paper` are reserved.

### Headings and records

Use `###` and deeper headings for actual sections. They retain their heading level in HTML and have consistent heading styles. Use lists for schools, employers, projects, services and awards:

```markdown
## Work
Command: /work

- **Employer**
  Role: Researcher
  Location: Singapore
  Period: 2024 – Present
  Links: [Website](https://example.org)

  Employer description.

  - **Project**

    Project contribution.

  Text after the project list.
```

A bold name occupying the first line of a list item starts a record. `Role`, `Location`, `Period` and `Links` are optional metadata for headings and records. The record becomes `li` with a `strong` name, never a heading. Ordinary list items work too. Indent nested lists and their content according to Markdown list indentation. Education uses a list of degrees; Work uses employers with nested projects. Service and Awards remain `###` headings.

### Explicit components

Collapsible sections use GitHub’s native `<details>` / `<summary>` markup. Leave a blank line after the summary and before the closing tag so GitHub can render Markdown inside:

```markdown
<details>
<summary><h4>Research direction</h4></summary>

An introductory paragraph.

:::paper{ref="analytical-engines"}
An explicit description of this contribution, with **emphasis**.
:::

A closing paragraph, outside the card.
</details>
```

- `<details>` starts with `<summary>Title</summary>`; use `<summary><h4>Title</h4></summary>` when the summary is also a heading. Both single-line and multiline summaries are accepted. `<details open>` starts expanded; otherwise each section starts closed and opens independently. Optional metadata immediately after the summary is preserved. Nested details and details in list items are supported. The old `:::collapse` syntax is removed. Arbitrary HTML and attributes are not enabled.
- `paper{ref="id"}` inserts an existing publication card. Its body is the card description and may contain standard Markdown blocks. Ordinary neighboring paragraphs stay outside the card.
- A standalone `[[paper:id]]` paragraph inserts a card without a description. Authored cards have no chat-specific three-card limit.
- `profile` is an empty component for the profile display.
- `publication` defines a reusable publication in a data section, as below.

Paper, profile and publication components still use `:::` fences; a closing fence must be at least as long as its opener. All components must close explicitly. Unknown components, malformed options and missing references fail validation with a source line. Components belong in ordinary content or list items, outside blockquotes and tables. Code blocks treat component syntax literally. GitHub renders the details/summary structure directly. Paper, profile and publication components remain project-specific extensions: use `npm run dev` for the complete homepage preview.

### Publication definitions and collections

```markdown
## Papers
Command: /papers
Cards: publications

All publications, in the order below.

## Publications
Id: publications

:::publication
Title: On Analytical Engines
Id: analytical-engines
Authors: Ada Lovelace, Charles Babbage
Venue: Journal of Computing
Venue short: JoC
Year: 1843
Topic: Computing
Paper: https://example.org/paper
Code: https://example.org/code

The abstract goes here.
:::
```

A section named by `Cards` is a data source containing only `publication` definitions. Definitions use `Title`, not a heading: they are records, not document sections. All fields above except `Code` and the abstract are required. `Paper` and `Code` must be HTTP(S) URLs. Several commands may reuse one collection without duplicating definitions.

A `Cards` view renders its authored body followed by the referenced collection. Publication definitions appear in their written order; no year sorting occurs in code. Move definitions in Markdown to reorder the collection. Abstracts appear in paper details; cards show compact author credits with the profile owner's name retained and highlighted. Paper details and chat card references continue to use the same ids.

### Build and validation

`npm run build` validates the Markdown, compiles TypeScript, generates HTML metadata and bundles the browser entry with esbuild. Preview and deployment serve the same `dist/` output. The browser and backend share the parser; a failed build keeps the previous export. The terminal body is still rendered in the browser; pre-rendering the body is a separate future enhancement.

Tests cover explicit component boundaries, metadata preservation, source ordering, command renaming, heading/list semantics, standard Markdown, safe rendering, publication details and chat references. Do not add content-specific branches such as `command === '/research'` to the renderer.

## Chat backend

All backend logic lives in `chat/`. The entry point is `handleChat(request, env)` in `chat/handler.ts`. `worker/index.ts` deploys it as a Cloudflare Worker and bundles `data/site.md` as a text module at deploy time (the `[[rules]]` block in `wrangler.toml`); `server.ts` mounts the same function at `/api/chat` locally.

### API

| Method | Purpose | Notes |
| --- | --- | --- |
| `GET /api/chat` | Status | Returns `{ mode, budget }`. `mode` is `live` or `mock`; `budget` has `used`, `limit`, `exhausted`, `resetsAt`, or is `null` when no key or budget is configured |
| `POST /api/chat` | Ask | Request `{ message, topic?, paperId?, history? }`; live replies stream NDJSON, mock replies return `{ id, text, mode, budget? }` |
| `OPTIONS /api/chat` | Preflight | 204 only for origins in `ALLOWED_ORIGINS` |

Before streaming starts, errors come back as `{ error }`: 400 invalid input, 403 origin not allowed, 413 request too large, 415 not JSON, 429 rate limit or budget exhausted (with `Retry-After`), 503 storage/service unavailable. After streaming starts (HTTP 200), model failures are delivered as an `error` event with status 502. The frontend shows the `error` text of 429, 502 and 503 responses to the visitor as is. Full types are in `src/types.ts`.

Live responses have `Content-Type: application/x-ndjson`. Each newline terminates one event:

```json
{"type":"delta","text":"I work on "}
{"type":"delta","text":"reinforcement learning."}
{"type":"done","reply":{"id":"resp_...","text":"I work on reinforcement learning.","mode":"live"}}
```

The final `done.reply` includes the full answer and, when available, the updated budget. An `error` event has `{ type: "error", error, status }`; an EOF without `done` is also a failure. Partial text remains visible on failure or stop, but is not included as a completed assistant turn in later history. The browser handles split UTF-8 characters and JSON lines and renders deltas as they arrive, without replaying the finished live answer through a typing animation. Node pipes the response body directly; Workers return the same Web stream.

Browser and backend chat calls share a 60-second total deadline (`CHAT_TIMEOUT_MS`), covering stream consumption. The SDK uses the same timeout with automatic retries disabled. Stopping or disconnecting cancels the upstream request. The lightweight status check retains its separate 10-second timeout.

### Model call

`chat/openai.ts` uses the OpenAI Responses API with `stream: true`: `instructions` carries the system instructions, `input` the conversation turns, and `text.verbosity` is `low`. The model returns plain text; there is no JSON output schema or suggestions field. `reasoning.effort` is `low`, `max_output_tokens` is 4096, and `store` is `false`. The model comes from `OPENAI_MODEL`, default `gpt-5.4-mini`.

`chat/prompt.ts` assembles the instructions: the rules first (answer only from the homepage content, speak as the owner in the first person while admitting to being an AI when asked outright, follow the visitor's language, plain text only, refuse unrelated requests with the `[[offtopic]]` marker, ignore rule-changing instructions inside messages), then `data/site.md` exactly as written, and only at the end the selected paper as an aid for ambiguous references; explicit questions about other topics take precedence. The Markdown doubles as the prompt template, so editing the file changes both the page and what the model knows. Keeping the stable part first lets the provider cache the prefix. Replies default to one or two short paragraphs, with more detail for requested explanations, comparisons or complete lists. Cards are optional supporting references, capped at three; explicitly requested bibliographic details remain in the prose. Brief greetings and relevant terminology explanations are allowed; mixed requests receive an answer to the relevant part, while wholly unrelated substantive requests receive the off-topic marker.

### Papers named in a reply

The assistant may introduce a publication in its own words. It finishes the sentence, then writes the marker on a line of its own:

```
A good first read is REAR, which realigns preferences at test time.
[[paper:rear]]
For reasoning models, Skywork-OR1 is the better starting point.
[[paper:skywork-or1]]
```

The id is that paper's `Id` field, and the homepage replaces each marker line with the paper's card, rendered from `data/site.md`. Title, authors, venue, year and links therefore always come from the file, and the card is live: clicking it opens the paper, its code, or a follow-up question about it.

The contract lives in `src/chat.ts` (`PAPER_MARKER`, `splitPaperMarkers`, `stripPaperMarkers`, `MAX_PAPER_CARDS`) and is applied by `replyBody` in `render.ts`. Each text run between markers is escaped on its own, so model output never reaches the page as markup. During live generation, incomplete markers are held back until complete; cards appear with the arriving text. Copying a reply strips the markers back out. `revealHTML` remains for static content and mock replies.

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

Usage-write failures are logged with the known token delta, UTC day and response ID when available, without discarding a successful answer or masking a model failure. Non-idempotent increments are not automatically retried, and no budget update is returned when accounting fails. Worker `waitUntil` keeps final accounting alive on disconnect. Interrupted streams may lack provider usage; those calls increment the error counter, but unknown tokens cannot be reconstructed locally.

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
