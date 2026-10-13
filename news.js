// Announcements in newest-first order. One record per conference.
const announcements = [
  "<li><strong>Three papers accepted to NeurIPS 2026</strong> <span class=\"news-year\">Sep 25, 2026</span><ul><li><p><a href=\"/#paper/negative-only-policy-optimization\">Negative-Only Policy Optimization for One-Sided Verifiable Rewards</a> — <strong>Spotlight</strong>.</p>\n</li><li><p><a href=\"/#paper/width-limited-tree-search\">Backtracking with Linear-in-Depth Search-Space Growth: Width-Limited Tree Search for Large Language Models</a> — <strong>Spotlight</strong>.</p>\n</li><li><p><a href=\"/#paper/dr-mas\">Dr. MAS: Stable Reinforcement Learning for Multi-Agent LLM Systems</a> — <strong>Poster</strong>.</p>\n</li></ul></li>",
  "<li><strong>One paper accepted to EMNLP 2026 Findings</strong> <span class=\"news-year\">Aug 21, 2026</span><p><a href=\"/#paper/two-stage-test-generation\">Two-Stage Reinforcement Learning for Sound and Adversarial Test Generation in Code LLMs</a> has been accepted to Findings of EMNLP 2026.</p>\n</li>"
];
for (const feed of document.querySelectorAll('[data-news-feed]')) {
  const limit = Number(feed.dataset.newsLimit) || announcements.length;
  feed.innerHTML = announcements.slice(0, limit).join('');
}
