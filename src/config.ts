/** Set a deployed backend URL here when ready; null uses the static demo. */
export const siteConfig: { chatEndpoint: string | null } = {
  chatEndpoint: ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? '/api/chat' : null,
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
