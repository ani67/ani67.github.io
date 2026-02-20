# Blog & Portfolio

A modern, SEO-friendly blog and portfolio built with Next.js, TypeScript, and Markdown.

## Features

- 📝 Markdown-based content management
- 🎨 Clean, responsive design with Tailwind CSS
- ⚡ Fast performance with Next.js App Router
- 🔍 SEO optimized with metadata
- 📖 Reading time estimation
- 🌙 Dark mode support

## Getting Started

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

### Adding New Posts

1. Create a new `.md` file in `content/posts/`
2. Add frontmatter with required fields:

```markdown
---
title: "Your Post Title"
date: "2025-01-15"
description: "A brief description of your post"
---

# Your content here

Write your post content in markdown...
```

3. The post will automatically appear on the home page

### Build for Production

```bash
npm run build
npm start
```

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Vercel will auto-detect Next.js and deploy
5. Done! Your site will auto-deploy on every push

### Alternative: Cloudflare Pages or Netlify

Both support Next.js and offer free tiers similar to Vercel.

## Project Structure

```
blog-portfolio/
├── app/
│   ├── layout.tsx       # Root layout with SEO metadata
│   ├── page.tsx         # Home page with post listings
│   └── posts/
│       └── [slug]/
│           └── page.tsx # Individual post pages
├── content/
│   └── posts/           # Your markdown blog posts
├── lib/
│   └── posts.ts         # Utility functions for reading posts
└── public/              # Static assets
```

## Customization

- **Site title & description**: Edit `app/layout.tsx`
- **Styling**: Modify Tailwind classes or `app/globals.css`
- **Your name**: Update the author in `app/layout.tsx`

## Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Content**: Markdown with gray-matter
- **Rendering**: MDX (next-mdx-remote)
- **Hosting**: Vercel (free tier)

## Cost

- **Development**: Free
- **Hosting**: Free on Vercel (100GB bandwidth/month)
- **Domain** (optional): ~$12/year

## License

MIT
