# Blog Post Images

This folder contains images used **inside** your blog post content.

## Usage

When writing markdown in the editor or in your `.md` files, reference images like this:

```markdown
![Alt text description](/images/posts/your-image.jpg)
```

## Examples

```markdown
# My Blog Post

Here's a screenshot:

![App Screenshot](/images/posts/screenshot.png)

You can add captions below:

![Design mockup](/images/posts/design.jpg)
*Figure 1: Initial design concept*
```

## Folder Structure

```
public/
├── images/
│   ├── welcome.jpg              # Featured image for welcome.md
│   ├── getting-started.jpg      # Featured image for getting-started.md
│   └── posts/                   # ← You are here
│       ├── screenshot-1.png     # Used in post content
│       ├── diagram.svg          # Used in post content
│       └── demo.gif             # Used in post content
```

## How to Add Images

1. **Save your image** to this folder (`public/images/posts/`)
2. **Reference it** in your markdown: `![Description](/images/posts/filename.jpg)`
3. **Preview it** in the editor at `/editor`

## Supported Formats

- `.jpg` / `.jpeg` - Photos
- `.png` - Screenshots, graphics with transparency
- `.webp` - Best compression (recommended)
- `.gif` - Animations
- `.svg` - Vector graphics

## Tips

- Keep images under 1MB for fast loading
- Use descriptive filenames: `architecture-diagram.png` not `img1.png`
- Optimize images before uploading (use tools like TinyPNG, Squoosh, etc.)
- Use `.webp` format for best quality/size ratio
