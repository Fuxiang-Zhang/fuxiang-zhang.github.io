# Terminal homepage

Implementation details and the current data grammar are maintained in [README.md](../README.md). Preview: <http://127.0.0.1:3000/>.

## Direction

Following the latest review, the typography and layout reference is <https://jiangyy.github.io/>, using the same self-hosted Maple Mono monospace font. The page uses a column of about 140 characters, one font size and line height, plain-text links, and an in-app `›` prompt. The avatar area, sidebar, Sessions, and permanent section navigation are removed. Publication cards remain in the terminal output. Light theme by default, with a dark theme toggle.

The Bio shows `FUXIANG ZHANG` spelled out in `█` block characters: words side by side on wide screens, one word per line on narrow screens. A normal text heading with the name stays in place for screen readers, and the banner is generated from `profile.name`, so there is no second copy of the name.

## Interaction

The whole page is one continuous terminal transcript. The clickable commands in the Bio, the commands in the `/help` output, and typed input go through the same handler. Every execution appends the preset content at the end, including repeated commands; nothing switches pages or clears earlier output.

| Command | Output |
| --- | --- |
| `/bio` | Name banner, position, contact links, biography, and the command row |
| `/research` | Full research directions |
| `/papers` | Full publication list; clicking a title appends its details |
| `/work` | Work history |
| `/education` | Education history |
| `/misc` | Academic service and honors |
| `/help` | Clickable command reference |

Typing `/` shows candidates; Up/Down select, Tab completes, Enter runs, Escape closes. Plain text is sent to the chat backend (a Cloudflare Worker calling the OpenAI Responses API; see "Chat backend" in the README) and, when no backend is configured, answered with a labelled mock reply; either way the reply is appended to the same transcript. Asking about a paper sets the paper as input context. The prompt is fixed at the bottom, highlighted with a background and shadow, while the transcript scrolls independently above it. The title bar reads `Fuxiang Zhang - Homepage`. Typing or pasting anywhere outside an editable region goes into the prompt; text selection, copying, browser shortcuts, and keyboard navigation are preserved. On desktop, clicking ordinary text returns focus to the prompt; on phones, tapping the input still opens the keyboard. Legacy section hashes and `#paper/<id>` open the matching content directly.

## Files

- `src/banner.ts`: generates the five-line block banner from the name.
- `src/commands.ts`: preset commands and parsing.
- `src/render.ts`: presets, banner, and terminal message output.
- `src/app.ts`: single-transcript interaction, completion, global typing, theme, and questions.
- `src/input.ts`: distinguishes text keys, composition input, and native shortcuts.
- `styles.css`: all-monospace terminal styles, shared CV rows, lists, and publication cards.
- `assets/fonts/maple-mono.woff2`, `maple-mono-OFL.txt`: the local font and its license.

Content still comes from `data/site.md`.

## Acceptance

Reload the preview and check, in order: the Bio banner, the font, whether clicking `/research` and `/papers` appends output, `/help`, repeated commands, a natural-language question, the theme toggle, and a narrow viewport.

The build and automated checks run before delivery. No browser was connected during development, so actual screenshots and the on-screen keyboard on phones still need visual review.

Restart the preview:

```sh
npm run build
node .build/server.js
```
