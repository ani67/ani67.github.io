# Blog Post Images

Place your blog post images in this directory.

## Directory Structure

```
public/images/
├── welcome.jpg                    # Featured image for welcome.md post
├── getting-started-with-nextjs.jpg # Featured image for post
└── posts/                         # Images used INSIDE posts
    ├── welcome-screenshot.jpg
    ├── welcome-design.png
    └── nextjs-demo.gif
```

## Usage

### 1. Featured Images (Post Thumbnails)

**Option A: Specify in frontmatter**
```markdown
---
title: "My Post"
date: "2025-01-15"
description: "Post description"
image: "/images/custom-image.jpg"
---
```

**Option B: Automatic slug-based naming**
- `welcome.md` → `/images/welcome.jpg`
- `getting-started-with-nextjs.md` → `/images/getting-started-with-nextjs.jpg`

### 2. Images Inside Post Content

Use standard markdown image syntax:

```markdown
# My Post

Here's a screenshot:

![Alt text](/images/posts/my-screenshot.jpg)

You can also add captions:

![Design mockup](/images/posts/design.png)
*Figure 1: Initial design mockup*
```

## Examples

See `content/posts/welcome.md` for examples of:
- Featured image in frontmatter: `image: "/images/welcome.jpg"`
- Inline images: `![Screenshot](/images/posts/welcome-screenshot.jpg)`

## Supported Formats

- `.jpg` / `.jpeg`
- `.png`
- `.webp`
- `.gif`
- `.svg`

## Recommended Sizes

### Featured Images (Post Thumbnails)
- **Aspect ratio**: 16:9
- **Dimensions**: 1600x900px or larger
- **File size**: Keep under 500KB

### In-Post Images
- **Width**: 800-1600px (will auto-scale)
- **File size**: Keep under 1MB
- Use `.webp` for best compression
