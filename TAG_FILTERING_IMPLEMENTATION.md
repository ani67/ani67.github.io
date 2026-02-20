# Tag Filtering Implementation

The left sidebar now displays the 4 most popular tags (by post count) and allows users to filter posts by clicking on them!

---

## ✅ What's Been Implemented

### 1. **Popular Tags Function**
**File**: `lib/posts.ts`

```typescript
getPopularTags(limit = 4): { tag: string; count: number }[]
```

- Counts posts per tag
- Returns top N tags sorted by count (descending)
- Default limit is 4 tags

### 2. **Dynamic Navigation Links**
**File**: `app/components/layout/NavigationLinks.tsx`

- **Replaced hardcoded links** with dynamic tag display
- Shows tag name + post count: `Next.js (3)`
- Active tag is **underlined** and **white**
- Inactive tags are **gray** with hover effect
- Last option is **"Show all"** to clear filters

### 3. **Tag Filtering Logic**
**File**: `app/components/HomePage.tsx`

- Added `selectedTag` state management
- Filters posts client-side using `useMemo`
- Shows helpful message when no posts match selected tag
- Passes filtering state through BlogLayout to navigation

### 4. **Component Updates**
**Files**: `BlogLayout.tsx`, `Sidebar.tsx`, `MobileMenu.tsx`

- All accept optional tag filtering props
- Props only passed from HomePage (not PostPage)
- Maintains flexibility for different layouts

---

## 🎯 How It Works

### User Flow

1. **User visits homepage** → Sees all posts
2. **Clicks "Next.js (3)"** in left sidebar → Sees only Next.js posts
3. **Clicks "Show all"** → Back to all posts
4. **Clicks different tag** → Filters update instantly

### Visual Indicators

- **Selected tag**: White text + underline
- **Unselected tags**: Gray text
- **Hover effect**: Changes to white
- **Post count**: Shown in smaller gray text `(3)`

---

## 📊 Example Display

**Left Sidebar:**
```
Popular Tags
━━━━━━━━━━━━━━━
Next.js (3)        ← Clickable, shows count
Web Development (2)
Tutorial (2)
React (1)
Show all           ← Always available
```

**When "Next.js" is selected:**
- Tag appears **white + underlined**
- Main content shows only posts with "Next.js" tag
- Other content stays the same

---

## 🔧 Technical Details

### Data Flow

```
app/page.tsx (Server)
  ↓ calls getPopularTags()
  ↓ passes to HomePage
  ↓
HomePage (Client)
  ↓ manages selectedTag state
  ↓ filters posts
  ↓ passes to BlogLayout
  ↓
BlogLayout → Sidebar/MobileMenu → WorkLinks
  ↓ renders clickable tags
```

### Performance

- **Memoized filtering**: Uses `useMemo` to prevent unnecessary recalculations
- **Client-side**: Instant filtering without server requests
- **Lightweight**: Only filters by tag (simple array filter)

---

## 🎨 Styling Details

### Active Tag
```css
text-white underline
```

### Inactive Tag
```css
text-gray-400 hover:text-white
```

### Tag Count
```css
text-xs text-gray-600
```

---

## 📝 Files Modified

1. **`lib/posts.ts`** - Added `getPopularTags()` function
2. **`app/page.tsx`** - Calls `getPopularTags()` and passes to HomePage
3. **`app/components/HomePage.tsx`** - Tag filtering logic
4. **`app/components/layout/NavigationLinks.tsx`** - Dynamic tag display
5. **`app/components/layout/BlogLayout.tsx`** - Pass-through props
6. **`app/components/layout/Sidebar.tsx`** - Accept filtering props
7. **`app/components/layout/MobileMenu.tsx`** - Accept filtering props

---

## 💡 Usage Examples

### Current Tags (from sample posts)

Based on your current posts:
- **Next.js**: 2 posts
- **Web Development**: 2 posts
- **Tutorial**: 1 post
- **React**: 1 post
- **Welcome**: 1 post
- **Portfolio**: 1 post
- **Beginner**: 1 post

Top 4 shown in sidebar: Next.js, Web Development, Tutorial, React

---

## 🚀 Future Enhancements

### 1. URL-Based Filtering
Make tags shareable via URL:
```typescript
// Use Next.js router
const router = useRouter();
const searchParams = useSearchParams();

// On tag select
router.push(`/?tag=${tag}`);

// Read on load
const selectedTag = searchParams.get('tag');
```

**Benefits**: Shareable links, browser back button works

### 2. Multiple Tag Selection
Allow filtering by multiple tags:
```typescript
const [selectedTags, setSelectedTags] = useState<string[]>([]);

// Filter posts that have ALL selected tags
const filteredPosts = posts.filter(post =>
  selectedTags.every(tag => post.tags.includes(tag))
);
```

### 3. Tag Search
Add a search box to find specific tags:
```typescript
const [searchQuery, setSearchQuery] = useState('');
const filteredTags = allTags.filter(tag =>
  tag.toLowerCase().includes(searchQuery.toLowerCase())
);
```

### 4. Animated Transitions
Add smooth transitions when filtering:
```typescript
// Using framer-motion
<motion.div
  key={selectedTag}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
>
  {/* Post content */}
</motion.div>
```

---

## 🐛 Troubleshooting

### Tags not showing in sidebar
- Check if posts have tags in frontmatter
- Verify `getPopularTags()` is called in `app/page.tsx`
- Check browser console for errors

### Clicking tags doesn't filter
- Ensure HomePage is a client component (`'use client'`)
- Check that `selectedTag` state is updating
- Verify `filteredPosts` is being used (not `posts`)

### "Show all" not working
- Clicking "Show all" should set `selectedTag` to `null`
- Check if `null` case is handled in filter logic

---

## ✅ Testing Checklist

- [x] Popular tags display in left sidebar
- [x] Tags show post counts
- [x] Clicking tag filters posts
- [x] Active tag is highlighted
- [x] "Show all" clears filter
- [x] Mobile menu also shows tags
- [x] Helpful message when no posts match tag
- [x] Works on PostPage (tags not shown, as intended)

---

## 📖 Related Documentation

- See `TAGS_IMPLEMENTATION.md` for basic tag functionality
- See `content/posts/README.md` for adding tags to posts
- See `CODE_REVIEW_FIXES.md` for overall code improvements

---

*Tag filtering implementation completed: 2025-01-16*
