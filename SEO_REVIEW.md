# SEO review — implementation updated 8 September 2026

The code recommendations below are now implemented: page-specific metadata and canonicals, main headings, a clearer homepage identity, populated Person profile links, and a sitemap without invented modification dates. Five project pages and a selected-project index now complement the existing articles and playable pages. Gallery links expose these URLs to crawlers while normal clicks retain the fullscreen viewer.

The original one-second intro delay and pixel animation are retained at the user's request. A no-JavaScript fallback and an eight-second CSS fail-safe prevent a failed hydration from permanently covering the page. Gallery breakpoint geometry is computed before render and selected with CSS, removing the post-hydration repacking step.

`npm run verify:export` checks the generated sitemap pages for titles, descriptions, canonicals, social URLs and main headings. Browser checks passed at 390, 768 and 1440 pixels, including gallery-to-project navigation and a no-JavaScript visit. One unthrottled local desktop observation recorded CLS 0.0125; that is a lab observation, not field data or a mobile performance score. Search Console rankings and real-user Core Web Vitals still require post-deployment field data.

The following is the original audit and rationale, retained for context.

The site presents a distinctive personal portfolio, with a stronger foundation for searches about Ani Dalal and his writing than for discovering individual projects. This is an assessment of the implementation, not a measurement of rankings.

I reviewed the source and freshly exported HTML, checked local HTTP responses, and consulted Google Search Central. The web tool retrieved the live homepage, but could not reliably retrieve the live blog, robots file or sitemap. Those retrieval failures are not evidence that the live pages are down. I did not have Search Console, backlink data, field performance data, or a browser rendering audit.

**What is working**

- The blog exports full article content as HTML, with unique titles, descriptions and self-referencing canonicals. It does not require a content API to display the articles.
- The export contains 13 post pages. The sitemap lists these posts plus home, blog and about, and robots.txt points to it.
- Articles emit `BlogPosting` structured data, and the root layout emits `Person` data. The about page provides named employers, education and exhibitions that help explain the author's background.
- The homepage uses ordinary links for gallery entries, has descriptive image alt text, and uses responsive Cloudinary thumbnails with automatic format/quality selection. All 44 images in the exported homepage had nonempty alt text.
- The local static preview returns 200 for the main pages, robots.txt, sitemap.xml and the poetry project, 404 for nonexistent paths and development APIs, and a redirect for `/blog` to `/blog/`.

Google recommends prerendered content, crawlable links, and distinct page metadata. The blog already follows much of this guidance. [Google's JavaScript SEO documentation](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)

**The largest opportunity is making each project a searchable document**

The manifest contains 48 entries, including one hidden entry and 42 collections. Gallery links look like `/?piece=…`; the selected piece opens through a client-side overlay. These variants receive the same exported homepage title, description and canonical. Most project descriptions are not presented in the initial visible homepage markup, and collection data is fetched only when opened.

Query parameters are not inherently bad for SEO. The problem here is shared document identity and content that appears only after JavaScript resolves the selected piece. Google may render this content, but the implementation sends inconsistent signals about whether each piece deserves its own search result. A canonical is a strong preference signal, not a directive Google must follow. [Google's canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

Recommended next step: give important projects stable pages such as `/work/dashtoon/`, with server-rendered text, relevant images, unique title/description, self-canonical and sitemap inclusion. Keep the gallery overlay as an interaction, and link to the full project page from it. For work already covered by a blog case study, strengthen the existing page rather than creating a near-duplicate. Start with the projects most relevant to the work you want to attract; there is no need to create a thin page for every collection iteration.

**Verified metadata and content gaps**

| Page or feature | Observed in the export | Recommended change |
| --- | --- | --- |
| Homepage | Title is only `Ani Dalal`; headline describes a designer, artist and builder but is a paragraph, with no H1 | Use a descriptive title such as `Ani Dalal — Product Designer & Generative Artist`; make the principal headline a semantic H1 |
| Blog and about | Correct self-canonicals and descriptions; no H1; inherited Open Graph title and URL describe the homepage | Add page-specific headings and social metadata |
| Instrument | Has its own title and description, but canonical points to `/`; absent from sitemap | Give it a self-canonical, include it in the sitemap, and add a short introduction describing the instrument |
| Canvas | Inherits homepage title, description and canonical; absent from sitemap | Decide whether this is a discoverable project or utility; give it appropriate metadata and explanatory text if it should be discoverable |
| Person structured data | `sameAs` is empty even though the masthead links to social profiles | Reuse the existing verified profile URLs |
| Sitemap dates | Home, blog and about use build time for `lastModified`; posts use publication date | Supply genuine modification dates, or omit them when unavailable |

Missing an H1 alone does not establish a ranking penalty. The practical concern is that the main subject and hierarchy are less explicit. Descriptive titles and a clear main heading also help searchers understand the result. [Google's title guidance](https://developers.google.com/search/docs/appearance/title-link)

The homepage copy communicates personality and a current role well. For someone searching for a product designer for AI tools, it gives less specific evidence before opening projects. A concise introduction explaining the kind of products you design, alongside clearly described case studies showing your role and outcomes, would improve that match. This is an editorial recommendation, not a promise of higher rankings.

**Performance needs measurement**

The initial full-screen cover deliberately waits one second before revealing the page, then uses an animated dissolve on desktop. It is removed by JavaScript and has no no-script fallback. The gallery also repacks its layout after hydration on narrower screens. These are plausible usability and visual-stability concerns, but I did not measure LCP, INP or CLS and cannot claim they fail Core Web Vitals.

Measure mobile field data in Search Console or PageSpeed Insights before choosing performance changes. Reduce the intro delay and make content accessible when JavaScript fails; test gallery layout stability and image loading on a slow connection. Google uses Core Web Vitals in its ranking systems, but good scores do not guarantee good rankings. [Google's Core Web Vitals guidance](https://developers.google.com/search/docs/appearance/core-web-vitals)

**Suggested order**

1. Correct the standalone tool canonicals and basic page metadata.
2. Create substantive project pages for the strongest work, retaining the gallery experience.
3. Make the homepage's professional focus more explicit through its title, heading and short introduction.
4. Measure mobile performance and inspect representative URLs in Search Console after deployment.

Implementation status is recorded at the top of this document. The original recommendations are retained here as the rationale for the changes.
