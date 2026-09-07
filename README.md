# Ani Dalal — Blog & Portfolio

Personal blog and portfolio site for Ani Dalal, built with Next.js, TypeScript, and Markdown.

## Features

- Markdown-based blog with rich text editor (TipTap)
- YouTube video embeds and image/video captions
- Theme system with multiple color modes (dawn, day, night)
- Custom fonts (Gambarino, PP Mondwest, Geist, Inter)
- Static export for fast, edge-deployable builds
- Reading time estimation and tag-based filtering
- Responsive design with Tailwind CSS v4

## Getting Started

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

### Adding Posts

Create a `.md` file in `content/posts/` with frontmatter:

```markdown
---
title: "Your Post Title"
date: "2025-01-15"
description: "A brief description"
tags: ["vibes"]
image: null
published: true
---

Your content here...
```

Or use the built-in editor at `/editor` during development.

### Build

```bash
npm run build
npm start
```

The build creates an isolated production tree, excludes development APIs, and exports to `out/` with the poetry project, custom domain, and `.nojekyll` included. It leaves local source files intact. `npm start` previews this static output on localhost:3000. GitHub Pages runs the same build.

Run `npm run lint`, `npm run typecheck`, and `npm test` before shipping. After building, `npm run verify:export` validates the exported SEO metadata and sitemap.

The `/work/` index links to selected project pages, existing case studies and playable tools. New project stories are authored in `lib/work.ts`; `lib/work-links.ts` maps gallery cards to their canonical pages. Card clicks retain the fullscreen gallery, while opening a link in a new tab reaches its project page.

## Interplanetary Racers

The homepage game card opens the gallery viewer and links to `/interplanetary-racers/`. The standalone game and its designers are included in the same static export. See [hosting and update notes](docs/interplanetary-racers.md).

## Project Structure

```
app/
  page.tsx           # Gallery homepage (content/gallery.json)
  blog/              # Blog index
  instrument/        # Musical instrument
  canvas/            # Drawing canvas
  components/        # Shared components (PostPage, MarkdownEditor, ScrambleText, etc.)
  components/layout/ # Layout components (Sidebar, BlogLayout, MobileHeader)
  posts/[slug]/      # Dynamic blog post pages
  about/             # About page
  editor/            # Rich text editor (dev only)
  api/               # API routes (dev only)
content/posts/       # Markdown blog posts
lib/posts.ts         # Post loading, validation (gray-matter + zod), sorting
public/fonts/        # Local font files (Gambarino, PP Mondwest)
```

## Tech Stack

- **Framework**: Next.js 16 (App Router, static export)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 with @tailwindcss/typography
- **Editor**: TipTap
- **Content**: Markdown with gray-matter + zod validation
- **Rendering**: MDX (next-mdx-remote)

## License

The **source code** in this repository is licensed under the [MIT License](https://opensource.org/licenses/MIT) — feel free to use, modify, and learn from it.

All **content** (blog posts, images, artwork, and custom fonts) is **All Rights Reserved** and may not be reproduced or distributed without permission.
