/**
 * The deployed chat backend: the Cloudflare Worker (worker/index.ts). Both the
 * published homepage and the local preview call it by default, so the local
 * preview exercises the real backend. Set to null to fall back to mock replies.
 */
export const productionChatEndpoint: string | null = 'https://fuxiang-homepage-chat.fuxiang-homepage.workers.dev/api/chat';
/**
 * Local testing switch, read from the page URL:
 *   ?chat=mock   labelled mock replies, no backend call
 *   ?chat=local  the local Node server's /api/chat (live only with OPENAI_API_KEY in .env)
 * Anything else, including no parameter, uses the worker.
 */
const chatOverride = new URLSearchParams(location.search).get('chat');
const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export const siteConfig: { chatEndpoint: string | null } = {
  chatEndpoint: chatOverride === 'mock' ? null : chatOverride === 'local' && isLocalHost ? '/api/chat' : productionChatEndpoint,
};

declare global { interface Window { dataLayer?: unknown[][] } }
if (location.hostname === 'fuxiang-zhang.github.io') {
  window.dataLayer ??= [];
  window.dataLayer.push(['js', new Date()], ['config', 'G-YN1PYBS8J3']);
  const analytics = document.createElement('script');
  analytics.async = true;
  analytics.src = 'https://www.googletagmanager.com/gtag/js?id=G-YN1PYBS8J3';
  document.head.appendChild(analytics);
}
