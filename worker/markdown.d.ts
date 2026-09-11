/** wrangler bundles Markdown as a text module; see the [[rules]] block in wrangler.toml. */
declare module '*.md' {
  const content: string;
  export default content;
}
