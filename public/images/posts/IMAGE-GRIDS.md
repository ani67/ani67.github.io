# Creating Image Grids in Markdown

You can create beautiful image grids using HTML within your markdown files!

## 2-Column Grid

```html
<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin: 2rem 0;">
  <img src="/images/posts/image1.jpg" alt="Image 1" style="width: 100%; border-radius: 8px;" />
  <img src="/images/posts/image2.jpg" alt="Image 2" style="width: 100%; border-radius: 8px;" />
</div>
```

## 3-Column Grid

```html
<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 2rem 0;">
  <img src="/images/posts/image1.jpg" alt="Image 1" style="width: 100%; border-radius: 8px;" />
  <img src="/images/posts/image2.jpg" alt="Image 2" style="width: 100%; border-radius: 8px;" />
  <img src="/images/posts/image3.jpg" alt="Image 3" style="width: 100%; border-radius: 8px;" />
</div>
```

## Responsive Gallery (Auto-fit)

This layout automatically adjusts the number of columns based on screen size:

```html
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 2rem 0;">
  <img src="/images/posts/photo1.jpg" alt="Photo 1" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px;" />
  <img src="/images/posts/photo2.jpg" alt="Photo 2" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px;" />
  <img src="/images/posts/photo3.jpg" alt="Photo 3" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px;" />
  <img src="/images/posts/photo4.jpg" alt="Photo 4" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px;" />
</div>
```

## Mixed Layout (Featured + Grid)

```html
<!-- Featured large image -->
![Main image](/images/posts/featured.jpg)

<!-- Supporting images in grid -->
<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin: 1rem 0;">
  <img src="/images/posts/detail1.jpg" alt="Detail 1" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px;" />
  <img src="/images/posts/detail2.jpg" alt="Detail 2" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px;" />
  <img src="/images/posts/detail3.jpg" alt="Detail 3" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px;" />
</div>
```

## Tips

- **`gap`**: Controls spacing between images (1rem = 16px)
- **`border-radius`**: Adds rounded corners
- **`object-fit: cover`**: Crops images to fit the container
- **`aspect-ratio`**: Keeps images square or other ratio
- **Responsive**: Use `repeat(auto-fit, minmax(200px, 1fr))` for automatic columns

## Test Your Grids

Go to `/editor` to test your image grids with live preview!
