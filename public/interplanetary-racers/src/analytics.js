// Standalone game pages do not inherit the portfolio's Next.js layout.
// Keep local development visits out of the production property.
(() => {
  if (!['anidalal.com', 'www.anidalal.com', 'ani67.github.io'].includes(location.hostname)) return;
  if (window.racingAnalyticsLoaded) return;
  window.racingAnalyticsLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-5F61ZX6857', {
    page_title: document.title,
    page_location: location.origin + location.pathname,
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-5F61ZX6857';
  document.head.appendChild(script);
})();
