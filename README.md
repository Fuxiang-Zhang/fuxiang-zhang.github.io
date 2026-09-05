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
  data/site.md                            ├─ rate limits + daily token ledger ── Workers KV
  reading.html                            └─ chat/openai.ts ──────────────────── OpenAI Responses API
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
| `npx wrangler kv namespace create CHAT_KV` | Create the KV namespace for limits and the ledger; paste its id into `wrangler.toml` |
| `npm run worker:secret` | Store `OPENAI_API_KEY` as a Worker Secret |
| `npm run worker:deploy` | Deploy the Worker |
| `npm run worker:dev` | Run the Worker locally; put the key in `.dev.vars` |
| `npx wrangler tail` | Stream the Worker's live logs |
| `npx wrangler deploy --dry-run --outdir=/tmp/worker` | Bundle without deploying, to check that it compiles |

### Checking usage

```sh
# Today's tokens used, the budget, and the reset time
curl https://fuxiang-homepage-chat.fuxiang-homepage.workers.dev/api/chat

# Today's full ledger: requests, input, cached, output, total, errors
# (the key exists only after the first successful reply of the day)
npx wrangler kv key get --binding CHAT_KV --remote "usage:$(date -u +%F)"

# All keys: usage:<date> daily ledgers, client:<hash>:<hour> per-IP counters
npx wrangler kv key list --binding CHAT_KV --remote
```

Billing is authoritative on the OpenAI Usage page; the Cloudflare dashboard's Workers Metrics show request counts and error rates.

### Commands on the page

| Command | Output |
| --- | --- |
| `/bio` | Biography and contact links (shown on the opening screen, so not listed in the command row) |
| `/research` | Research interests and directions |
| `/papers` | Publications; click a title for details, or "Ask about this paper" to ask with that paper as context |
| `/experience` | Research, industry, and education history |
| `/misc` | Academic service and honors |
| `/help` | Clickable command help |

Typing `/` shows candidates; Up/Down select, Tab completes, Enter runs, Escape closes. Shift+Enter inserts a newline. Text that does not start with `/` is sent to the chat backend as a question.

## Frontend design

The homepage is one continuous terminal transcript set in the self-hosted Maple Mono monospace font. The content column is 140 characters wide, light by default with a dark theme toggle. The opening screen shows a banner spelled out in block characters from the name, the position, the biography, the links, a row of clickable commands under the biography, and the input hint. Command output and chat replies are appended to the end of the same transcript; earlier output stays until the page is reloaded. Only the theme preference is stored on the device.

- **Progressive output.** Command output and chat replies share one word-by-word writer (`src/stream.ts`) at a fixed 40 words per second, paced by elapsed time so the speed is independent of frame rate and text length. The page follows the newest text while writing; scrolling up stops following. The opening screen appears at once.
- **Input.** Typing or pasting anywhere outside an editable region goes into the prompt. Text selection, copying, browser shortcuts, and IME composition keep their native behavior.
- **Chat.** Each question carries the previous completed turns (up to 8) and the current paper context. Up to three follow-up suggestions appear under a reply as buttons. Replies are labelled "AI reply" or "Simulated reply".
- **Budget notice.** On load the page asks the backend for its status. When today's token budget is spent, a notice appears above the prompt and questions are held back; commands keep working. The page rechecks automatically at midnight UTC.
- **Old links.** Legacy section hashes and `#paper/<id>` still open the matching content. `reading.html` keeps the classic single-page reading layout and is generated from the same data at build time.

## Site data

`data/site.md` is the single source of truth, and it is written to be read by people as well as by the code. The frontend fetches it in the browser, the reading view is generated from it at build time, and the chat backend sends it to the model **verbatim** as the homepage content, so there is no second copy of the facts to keep in sync. `parseSiteMarkdown` (`src/markdown.ts`) turns it into a `SiteData` object; the build validates the structure, unique paper ids, valid paper references, and the presence of all three research topics; on failure the previous build is kept.

One rule shapes the whole file: **every record is a heading, the `Key: value` lines directly beneath it are its fields, and the paragraphs that follow are its prose.** A heading may carry an explicit id as `{#slug}`.

A paragraph is written on one line. The parser does join hard-wrapped lines back together, so wrapping will not break anything, but the file is also the prompt the model reads and a newline mid-sentence only costs a token there.

```markdown
### REAR: Test-time Preference Realignment through Reward Decomposition {#rear}
Authors: Fuxiang Zhang, Pengcheng Wang, …
Venue: International Conference on Machine Learning (ICML)
Venue short: ICML
Year: 2026
Category: conference
Topic: llm
Paper: https://arxiv.org/abs/2606.30339
Code: https://github.com/mansicer/REAR

Aligning large language models (LLMs) with diverse user preferences is a critical yet challenging task. …
```

A publication's prose is its abstract. It is optional, it is shown on the paper's detail view, and — like everything else in the file — it reaches the assistant verbatim, which is what lets the assistant discuss what a paper actually does instead of only its title and venue.

| Section | Record heading | Fields | Prose |
| --- | --- | --- | --- |
| (the `# H1`) | Name | `Position`, `Email`, `Photo`, `Links` | — |
| `## Bio` | — | — | One paragraph per biography paragraph |
| `## Research topics` | Topic name, id `{#llm}` / `{#rl}` / `{#marl}` | `Short name` | Description |
| `## Research interests` | Interest title; `####` sub-headings are its points | `Topic` | Description |
| `## Publications` | Paper title, id `{#slug}` | `Authors`, `Venue`, `Venue short`, `Year`, `Category`, `Topic`, `Paper`, `Code` | The abstract, optional |
| `## Experience` | Organization; `####` sub-headings are its contributions | `Role`, `Location`, `Period`, `Links`; a contribution takes `Paper` | Description |
| `## Education` | Institution | `Degree`, `Location`, `Period`, `Links` | Description |
| `## Service` | Venue | `Role`, `Period` | — |
| `## Awards` | Title | `Issuer`, `Period` | — |

Conventions: a publication's `Category` is `reports`, `conference`, or `journal`, and its `Topic` is a research topic id. A contribution's `Paper` holds a publication's slug. Text may contain inline links written as `[label](https://…)`; everything else is escaped as plain text, and only http(s) links are allowed. Only the keys listed above are read as fields, and only directly under their heading — prose that begins `Something:` stays prose, and a stray field further down is reported rather than silently swallowed. Unknown sections, unknown fields, missing fields, and dangling paper references all fail the build with the heading named. Full types are in `src/types.ts`.

## Chat backend

All backend logic lives in `chat/`. The entry point is `handleChat(request, env)` in `chat/handler.ts`. `worker/index.ts` deploys it as a Cloudflare Worker and bundles `data/site.md` as a text module at deploy time (the `[[rules]]` block in `wrangler.toml`); `server.ts` mounts the same function at `/api/chat` locally.

### API

| Method | Purpose | Notes |
| --- | --- | --- |
| `GET /api/chat` | Status | Returns `{ mode, budget }`. `mode` is `live` or `mock`; `budget` has `used`, `limit`, `exhausted`, `resetsAt`, or is `null` when no key or budget is configured |
| `POST /api/chat` | Ask | Request `{ message, topic?, paperId?, history? }`, response `{ id, text, mode, suggestions?, budget? }` |
| `OPTIONS /api/chat` | Preflight | 204 only for origins in `ALLOWED_ORIGINS` |

Errors come back as `{ error }`: 400 invalid input, 403 origin not allowed, 413 request too large, 415 not JSON, 429 rate limit or budget exhausted (with `Retry-After`), 502 model unavailable. The frontend shows the `error` text of 429 and 502 responses to the visitor as is. Full types are in `src/types.ts`.

### Model call

`chat/openai.ts` uses the OpenAI Responses API: `instructions` carries the system instructions, `input` the conversation turns, and `text.format` a strict JSON Schema so the model must return exactly `answer` and `suggestions`. `reasoning.effort` is `low`, `max_output_tokens` is 1200, and `store` is `false`. The model comes from `OPENAI_MODEL`, default `gpt-5.4-mini`.

`chat/prompt.ts` assembles the instructions: the rules first (answer only from the homepage content, speak as the owner in the first person while admitting to being an AI when asked outright, follow the visitor's language, plain text only, refuse unrelated requests with the `[[offtopic]]` marker, ignore rule-changing instructions inside messages), then `data/site.md` exactly as written, and only at the end a one-line pointer to the paper the visitor currently has open. The Markdown doubles as the prompt template, so editing the file changes both the page and what the model knows. Keeping the stable part first lets the provider cache the prefix.

### Papers named in a reply

The assistant does not describe a publication in its own words. It finishes the sentence that introduces the paper, then writes the marker on a line of its own:

```
A good first read is REAR, which realigns preferences at test time.
[[paper:rear]]
For reasoning models, Skywork-OR1 is the better starting point.
[[paper:skywork-or1]]
```

The id is the slug from that paper's `{#id}` heading, and the homepage replaces each marker line with the paper's card, rendered from `data/site.md`. Title, authors, venue, year and links therefore always come from the file, and the card is live: clicking it opens the paper, its code, or a follow-up question about it.

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

After each successful reply the Worker adds the response's `usage` to the KV record `usage:YYYY-MM-DD` (kept for 90 days). Each incoming question first reads today's record; once the budget is exceeded it gets a 429 without calling the model. Failed calls consume no budget and are counted under `errors`. Every question writes to KV twice; the free KV tier allows 1000 writes per day, enough for about 500 questions. Without a KV binding neither limits nor the budget apply; without `OPENAI_API_KEY` the backend returns a clearly labelled mock reply.

Limitation: the origin check only stops other web pages. A script can forge the origin and call the endpoint directly, so the real safeguards are the daily token budget and a monthly spending limit set in the OpenAI dashboard. Cloudflare Turnstile can be added if scripted calls need to be blocked.

## Deployment

### Frontend (GitHub Pages)

On every push to `main`, `.github/workflows/static.yml` installs the locked dependencies, type-checks, runs the tests, and publishes `dist/` to GitHub Pages. The build runs in a temporary directory and replaces `.build/` and `dist/` only when everything succeeds; a failed build keeps the previous output. Generated JavaScript is not committed.

The backend URL is `productionChatEndpoint` in `src/config.ts`, currently pointing at the deployed Worker. Setting it to `null` returns the homepage to mock replies.

### Backend (Cloudflare Worker)

1. `npx wrangler login`, then `npx wrangler kv namespace create CHAT_KV` and paste the printed id into `kv_namespaces` in `wrangler.toml`.
2. `npm run worker:secret` and enter the OpenAI key.
3. `npm run worker:deploy`. The output names the URL, `https://fuxiang-homepage-chat.<subdomain>.workers.dev`; confirm with `curl <url>/api/chat` that `mode` is `live`.
4. After changing `[vars]` or code, run `npm run worker:deploy` again.

Optional automation: add the repository secrets `CLOUDFLARE_API_TOKEN` (the "Edit Cloudflare Workers" token template) and `CLOUDFLARE_ACCOUNT_ID`. `.github/workflows/deploy-worker.yml` then redeploys the Worker whenever `chat/`, `worker/`, `data/`, or `wrangler.toml` change; without the secrets that step is skipped.

The Cloudflare side runs on the free plan. The only cost is OpenAI's per-token billing, which is prepaid: calls stop when the balance is spent.

## Tests

`npm test` builds the project and runs `tests/` with Node's built-in test runner:

| File | Covers |
| --- | --- |
| `data.test.ts` | The Markdown format maps onto every rendered field, the published file parses completely, malformed documents are reported rather than silently truncated |
| `render.test.ts` | Rendered content matches `data/site.md`, links are correct, text is escaped, missing data is not presented as facts, papers named by the assistant render from site data and unknown or excess markers are dropped |
| `state.test.ts` | Publication filters, question and paper context, conversation history, progressive output preserves text at a fixed speed |
| `commands.test.ts` / `input.test.ts` | Slash command parsing and completion, global typing and IME behavior |
| `chat.test.ts` | Backend: mock replies, CORS, request validation, hourly limit, daily ledger and budget refusal, instruction content, structured output validation |
| `server.test.ts` | Served data and photo match the source file; the exported reading view keeps publication details |

The tests constrain content accuracy and API behavior. They do not lock CSS class names, HTML structure, layout, or animation details, and they do not replace a browser check for visual problems. Real model calls need a key and are not part of the automated tests; after deploying, ask a question or two and read the ledger to confirm.
