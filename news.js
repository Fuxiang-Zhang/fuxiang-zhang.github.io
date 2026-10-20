// Announcements in newest-first order. One short record per conference.
const announcements = [
  "<li><p>Oct 14, 2026 · <strong>Open source</strong>: <a href=\"https://github.com/mansicer/MaaPilot\">MaaPilot</a>, Arknights account orchestration built on MAA (in development).</p>\n</li>",
  "<li><p>Oct 13, 2026 · <strong>Open source</strong>: <a href=\"https://github.com/mansicer/tsuji\">tsuji</a>, live bilingual subtitles in the browser with OpenAI Realtime speech recognition and GPT translation.</p>\n</li>",
  "<li><p>Sep 25, 2026 · <strong>NeurIPS 2026</strong>: <a href=\"/#card/negative-only-policy-optimization\">NOPO</a> &amp; <a href=\"/#card/width-limited-tree-search\">WLTS</a> (Spotlight), <a href=\"/#card/dr-mas\">Dr. MAS</a>. Thanks to all the co-authors!</p>\n</li>",
  "<li><p>Aug 21, 2026 · <strong>EMNLP 2026 Findings</strong>: <a href=\"/#card/two-stage-test-generation\">TCS</a> accepted. Thanks to all the co-authors!</p>\n</li>"
];
for (const feed of document.querySelectorAll('[data-news-feed]')) {
  const limit = Number(feed.dataset.newsLimit) || announcements.length;
  feed.innerHTML = announcements.slice(0, limit).join('');
}
