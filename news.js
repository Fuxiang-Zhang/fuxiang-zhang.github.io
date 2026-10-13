// Announcements in newest-first order. One short record per conference.
const announcements = [
  "<li><p>Sep 25, 2026 · <strong>NeurIPS 2026</strong>: <a href=\"/#card/negative-only-policy-optimization\">Negative-Only</a> &amp; <a href=\"/#card/width-limited-tree-search\">Width-Limited Search</a> (Spotlight), <a href=\"/#card/dr-mas\">Dr. MAS</a> (Poster).</p>\n</li>",
  "<li><p>Aug 21, 2026 · <strong>EMNLP 2026 Findings</strong>: <a href=\"/#card/two-stage-test-generation\">Two-Stage Test Generation</a> accepted.</p>\n</li>"
];
for (const feed of document.querySelectorAll('[data-news-feed]')) {
  const limit = Number(feed.dataset.newsLimit) || announcements.length;
  feed.innerHTML = announcements.slice(0, limit).join('');
}
