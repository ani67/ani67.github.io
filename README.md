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
```

## Project Structure

```
app/
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
