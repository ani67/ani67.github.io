# Blog Posts

This directory contains all your blog posts in Markdown format.

## Creating a New Post

1. Create a new `.md` file in this directory
2. Add frontmatter at the top with required fields
3. Write your content in markdown below the frontmatter

## Frontmatter Format

```markdown
---
title: "Your Post Title"
date: "2025-01-15"
description: "A brief description of your post"
image: "/images/your-image.jpg"
tags:
  - Tag1
  - Tag2
  - Tag3
---

# Your content here

Write your post content in markdown...
```

## Required Fields

- **title**: The post title (string, required)
- **date**: Publication date in YYYY-MM-DD format (required)
- **description**: Brief description for SEO and post preview (required)

## Optional Fields

- **image**: Path to featured image (e.g., `/images/post-name.jpg`)
- **tags**: Array of tags for categorizing posts

## Tags

Tags help organize and categorize your blog posts. They appear as clickable badges on both the homepage and individual post pages.

### How to Add Tags

Use YAML array syntax in the frontmatter:

```yaml
tags:
  - Next.js
  - Tutorial
  - React
  - Web Development
```

### Tag Best Practices

- Use **2-5 tags** per post
- Be consistent with capitalization (e.g., always use "Next.js" not "nextjs")
- Use general categories that can apply to multiple posts
- Common tag examples:
  - Technology: Next.js, React, TypeScript, Tailwind
  - Content type: Tutorial, Guide, Opinion, Case Study
  - Topic: Web Development, Design, Performance, SEO
  - Level: Beginner, Intermediate, Advanced

### Available Tag Functions

The codebase provides these functions for working with tags:

```typescript
// Get all unique tags from all posts
getAllTags(): string[]

// Get all posts with a specific tag
getPostsByTag(tag: string): PostMetadata[]
```

## Example Post

```markdown
---
title: "Building a Blog with Next.js"
date: "2025-01-15"
description: "Learn how to create a modern blog using Next.js, TypeScript, and Markdown"
image: "/images/nextjs-blog.jpg"
tags:
  - Next.js
  - Tutorial
  - Markdown
  - TypeScript
---

# Building a Blog with Next.js

In this tutorial, we'll build a modern blog using Next.js...

## Prerequisites

- Basic React knowledge
- Node.js installed
- A code editor

## Step 1: Setup

...your content here...
```

## Images in Posts

Reference images using relative paths:

```markdown
![Alt text](/images/posts/my-image.jpg)
```

For image grids, use HTML:

```html
<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
  <img src="/images/posts/image1.jpg" alt="Image 1" style="width: 100%; border-radius: 8px;" />
  <img src="/images/posts/image2.jpg" alt="Image 2" style="width: 100%; border-radius: 8px;" />
</div>
```

## File Naming

Use lowercase with hyphens for filenames:
- ✅ `my-awesome-post.md`
- ✅ `getting-started-with-nextjs.md`
- ❌ `My Awesome Post.md`
- ❌ `MyAwesomePost.md`

The filename becomes the URL slug: `my-awesome-post.md` → `/posts/my-awesome-post`

## Tips

- Use clear, descriptive titles
- Keep descriptions under 160 characters for SEO
- Add alt text to all images for accessibility
- Use heading hierarchy properly (h1 → h2 → h3)
- Preview posts at `/editor` before publishing
