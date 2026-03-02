'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useEditor, EditorContent, NodeViewWrapper } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import NextLink from 'next/link';
import { BlogLayout } from './layout/BlogLayout';
import type { PostMetadata } from '@/lib/posts';
import { Bold, Italic, Type, Heading1, Heading2, Heading3, List, ListOrdered, Code2, Quote, Table2, Link2, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { getSvgPath } from 'figma-squircle';
import { ScrambleText } from './ScrambleText';
import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

// Image Node View Component
function ImageNodeView({ node, updateAttributes }: any) {
  const { src, alt, caption } = node.attrs;

  // Always render with caption wrapper so user can add captions
  return (
    <NodeViewWrapper className="image-with-caption">
      <img src={src} alt={alt || ''} contentEditable={false} />
      <textarea
        className="caption-text"
        placeholder="Add caption..."
        value={caption || ''}
        onChange={(e) => {
          updateAttributes({ caption: e.target.value });
        }}
        rows={4}
      />
    </NodeViewWrapper>
  );
}

// Custom Image extension with caption support
const CustomImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      caption: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.image-with-caption',
        priority: 100,
        getAttrs: (dom) => {
          const img = (dom as HTMLElement).querySelector('img');
          if (!img) return false;

          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') || '',
            caption: (dom as HTMLElement).getAttribute('data-caption') || '',
          };
        },
      },
      {
        tag: 'img[src]',
        priority: 50,
        getAttrs: (dom) => ({
          src: (dom as HTMLElement).getAttribute('src'),
          alt: (dom as HTMLElement).getAttribute('alt') || '',
          caption: '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, ...attrs } = HTMLAttributes;
    // Don't render textarea here - React node view handles it
    return [
      'div',
      { class: 'image-with-caption', 'data-caption': caption || '' },
      ['img', mergeAttributes(attrs)],
    ];
  },

  addCommands() {
    return {
      setImage: (options: { src: string; alt?: string; caption?: string }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    } as any;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

// YouTube URL parser — extracts video ID and returns embed URL
function getYouTubeEmbedUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}

// YouTube Node View Component
function YouTubeNodeView({ node, updateAttributes }: any) {
  const { src, caption } = node.attrs;

  return (
    <NodeViewWrapper className="video-with-caption">
      <iframe
        src={src}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        contentEditable={false}
      />
      <textarea
        className="caption-text"
        placeholder="Add caption..."
        value={caption || ''}
        onChange={(e) => {
          updateAttributes({ caption: e.target.value });
        }}
        rows={4}
      />
    </NodeViewWrapper>
  );
}

// Custom YouTube extension with caption support
const CustomYouTube = Node.create({
  name: 'youtube',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      caption: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.video-with-caption',
        priority: 110,
        getAttrs: (dom) => {
          const iframe = (dom as HTMLElement).querySelector('iframe');
          if (!iframe) return false;

          const captionDiv = (dom as HTMLElement).querySelector('.caption-text');
          const caption = captionDiv?.textContent || (dom as HTMLElement).getAttribute('data-caption') || '';

          return {
            src: iframe.getAttribute('src'),
            caption: caption,
          };
        },
      },
      {
        tag: 'iframe',
        priority: 60,
        getAttrs: (dom) => {
          const src = (dom as HTMLElement).getAttribute('src') || '';
          if (!src.includes('youtube.com/embed')) return false;
          return { src, caption: '' };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, ...attrs } = HTMLAttributes;
    return [
      'div',
      { class: 'video-with-caption', 'data-caption': caption || '' },
      ['iframe', mergeAttributes(attrs, {
        frameborder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: 'true',
      })],
    ];
  },

  addCommands() {
    return {
      setYouTube: (options: { src: string; caption?: string }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    } as any;
  },

  addNodeView() {
    return ReactNodeViewRenderer(YouTubeNodeView);
  },
});

// Video Node View Component
function VideoNodeView({ node, updateAttributes }: any) {
  const { src, caption } = node.attrs;

  // Always render with caption wrapper so user can add captions
  return (
    <NodeViewWrapper className="video-with-caption">
      <video src={src} controls contentEditable={false} />
      <textarea
        className="caption-text"
        placeholder="Add caption..."
        value={caption || ''}
        onChange={(e) => {
          updateAttributes({ caption: e.target.value });
        }}
        rows={4}
      />
    </NodeViewWrapper>
  );
}

// Custom Video extension with caption support
const CustomVideo = Node.create({
  name: 'video',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      caption: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.video-with-caption',
        priority: 100,
        getAttrs: (dom) => {
          const video = (dom as HTMLElement).querySelector('video');
          if (!video) return false;

          const captionDiv = (dom as HTMLElement).querySelector('.caption-text');
          const caption = captionDiv?.textContent || (dom as HTMLElement).getAttribute('data-caption') || '';

          return {
            src: video.getAttribute('src'),
            caption: caption,
          };
        },
      },
      {
        tag: 'video[src]',
        priority: 50,
        getAttrs: (dom) => ({
          src: (dom as HTMLElement).getAttribute('src'),
          caption: '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, ...attrs } = HTMLAttributes;
    // Don't render textarea here - React node view handles it
    return [
      'div',
      { class: 'video-with-caption', 'data-caption': caption || '' },
      ['video', mergeAttributes(attrs, { controls: true })],
    ];
  },

  addCommands() {
    return {
      setVideo: (options: { src: string; caption?: string }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    } as any;
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },
});

interface MarkdownEditorProps {
  posts?: PostMetadata[];
}

export default function MarkdownEditor({ posts = [] }: MarkdownEditorProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [, forceUpdate] = useState({});
  const [toolbarSize, setToolbarSize] = useState({ width: 0, height: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('vibes');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isPublished, setIsPublished] = useState(true);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Measure toolbar dimensions when it's shown
  useEffect(() => {
    if (showToolbar && toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      setToolbarSize({ width: rect.width, height: rect.height });
    }
  }, [showToolbar]);

  // Auto-resize textareas when content changes
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
  }, [title]);

  useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.style.height = 'auto';
      descriptionRef.current.style.height = descriptionRef.current.scrollHeight + 'px';
    }
  }, [description]);

  // Generate squircle clip-paths for smooth corners
  const buttonClipPath = useMemo(() => {
    const path = getSvgPath({
      width: 32,
      height: 32,
      cornerRadius: 8,
      cornerSmoothing: 1, // 100% smoothing
    });
    return `path('${path}')`;
  }, []);

  const toolbarClipPath = useMemo(() => {
    if (toolbarSize.width === 0 || toolbarSize.height === 0) return '';
    const path = getSvgPath({
      width: toolbarSize.width,
      height: toolbarSize.height,
      cornerRadius: 12,
      cornerSmoothing: 1, // 100% smoothing
    });
    return `path('${path}')`;
  }, [toolbarSize]);

  const handleLoadPost = async (slug: string) => {
    try {
      const response = await fetch(`/api/posts/${slug}`);
      const { content } = await response.json();

      // Set the current slug to track we're editing an existing post
      setCurrentSlug(slug);

      // Parse frontmatter and content
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (frontmatterMatch) {
        const frontmatterText = frontmatterMatch[1];
        const markdownContent = frontmatterMatch[2].trim();

        // Parse title, description, tags, and image from frontmatter
        const titleMatch = frontmatterText.match(/title:\s*"(.+?)"/) || frontmatterText.match(/title:\s*'(.+?)'/);
        const descriptionMatch = frontmatterText.match(/description:\s*"([\s\S]+?)"/) || frontmatterText.match(/description:\s*'([\s\S]+?)'/);
        const tagsMatch = frontmatterText.match(/tags:\s*\[(.*?)\]/);
        const imageMatch = frontmatterText.match(/image:\s*(?:["'](.+?)["']|null)/);
        const publishedMatch = frontmatterText.match(/published:\s*(true|false)/);

        if (titleMatch) setTitle(titleMatch[1]);
        setIsPublished(publishedMatch ? publishedMatch[1] === 'true' : true);
        if (descriptionMatch) setDescription(descriptionMatch[1]);

        // Parse tags - get first tag only
        if (tagsMatch && tagsMatch[1].trim()) {
          const parsedTags = tagsMatch[1]
            .split(',')
            .map((t: string) => t.trim().replace(/["']/g, ''))
            .filter((t: string) => t);
          // Use first tag or default to vibes
          const firstTag = parsedTags[0];
          if (firstTag === 'work' || firstTag === 'art' || firstTag === 'vibes') {
            setSelectedTag(firstTag);
          } else {
            setSelectedTag('vibes');
          }
        } else {
          setSelectedTag('vibes');
        }

        // Parse image URL
        if (imageMatch && imageMatch[1]) {
          setImageUrl(imageMatch[1]);
        } else {
          setImageUrl('');
        }
        // Convert markdown to HTML for Tiptap (simplified)
        let html = markdownContent
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          // Images with captions: ![alt](url "caption") - Don't include textarea in HTML, React node view will render it
          .replace(/!\[(.*?)\]\((.*?)\s+"(.*?)"\)/g, '<div class="image-with-caption" data-caption="$3"><img src="$2" alt="$1" /></div>')
          // Regular images: ![alt](url)
          .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" />')
          .split('\n\n')
          .map((para: string) => {
            if (para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol') || para.startsWith('<img') || para.startsWith('<video') || para.startsWith('<iframe') || para.startsWith('<div class="image-with-caption"') || para.startsWith('<div class="video-with-caption"')) {
              return para;
            }
            if (para.startsWith('- ')) {
              const items = para.split('\n').map((line: string) =>
                line.replace(/^- (.+)$/, '<li>$1</li>')
              ).join('');
              return `<ul>${items}</ul>`;
            }
            return `<p>${para}</p>`;
          })
          .join('\n');

        editor?.commands.setContent(html);
      }
    } catch (error) {
      console.error('Failed to load post:', error);
      alert('Failed to load post');
    }
  };

  const handleNewPost = () => {
    setTitle('');
    setDescription('');
    setCurrentSlug(null);
    setSelectedTag('vibes');
    setImageUrl('');
    setIsPublished(true);
    editor?.commands.setContent('<p></p>');
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing already...',
      }),
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      CustomImage,
      CustomYouTube,
      CustomVideo,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '<p></p>',
    onUpdate: () => {
      // Force React to re-render when editor state changes
      forceUpdate({});
    },
    editorProps: {
      attributes: {
        class: 'prose prose-xl lg:prose-2xl dark:prose-invert max-w-none focus:outline-none min-h-[600px] prose-headings:font-normal prose-headings:text-white prose-p:text-white/90 prose-a:text-white prose-a:underline hover:prose-a:text-white prose-strong:text-white prose-code:text-white/90 prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/10 prose-pre:border prose-pre:border-white/30 prose-ul:text-white/90 prose-ol:text-white/90 prose-li:text-white/90 prose-li:marker:text-white/90',
      },
      handleDOMEvents: {
        mouseup: () => {
          setTimeout(() => {
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) {
              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              setToolbarPosition({
                top: rect.top - 60,
                left: rect.left + rect.width / 2,
              });
              setShowToolbar(true);
            } else {
              setShowToolbar(false);
            }
          }, 10);
          return false;
        },
        keydown: (view, event) => {
          if (event.key === '/') {
            setTimeout(() => {
              const { from } = view.state.selection;
              const coords = view.coordsAtPos(from);
              setToolbarPosition({
                top: coords.top - 60,
                left: coords.left,
              });
              setShowToolbar(true);
            }, 50);
          }
          return false;
        },
      },
    },
  });

  const handleSave = async (options?: { published?: boolean }): Promise<boolean> => {
    if (!editor || !title || !description) {
      alert('Please enter a title and description before saving');
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    // Always generate slug from current title
    const newSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // If we're editing an existing post and the slug changed, delete the old file
    if (currentSlug && currentSlug !== newSlug) {
      try {
        await fetch('/api/delete-post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ slug: currentSlug }),
        });
      } catch (error) {
        console.error('Failed to delete old post file:', error);
      }
    }

    const pub = options?.published ?? isPublished;

    // Convert editor content to markdown
    const html = editor.getHTML();
    const markdown = htmlToMarkdown(html);

    const frontmatter = `---
title: "${title}"
date: "${today}"
description: "${description}"
tags: ["${selectedTag}"]
image: ${imageUrl ? `"${imageUrl}"` : 'null'}
published: ${pub}
---

${markdown}`;

    try {
      const response = await fetch('/api/save-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: newSlug,
          content: frontmatter,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setCurrentSlug(newSlug);
        const status = pub ? 'Published' : 'Draft';
        alert(`✅ Saved "${title}" (${status})`);
        return true;
      } else {
        alert(`❌ Error: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error('Failed to save post:', error);
      alert('❌ Failed to save post');
      return false;
    }
  };

  // Simple HTML to Markdown converter
  const htmlToMarkdown = (html: string): string => {
    let markdown = html;
    const videoPlaceholders: { [key: string]: string } = {};
    let videoCounter = 0;

    // FIRST: Replace YouTube iframes with placeholders to protect them from HTML cleanup
    markdown = markdown.replace(/<div class="video-with-caption" data-caption="([^"]*)">[\s\S]*?<iframe[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/div>/g, (match, caption, src) => {
      const placeholder = `___VIDEO_PLACEHOLDER_${videoCounter}___`;
      if (caption && caption.trim()) {
        videoPlaceholders[placeholder] = `<div class="video-with-caption"><iframe src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe><div class="caption-text">${caption.trim()}</div></div>`;
      } else {
        videoPlaceholders[placeholder] = `<iframe src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      }
      videoCounter++;
      return placeholder + '\n\n';
    });

    markdown = markdown.replace(/<iframe[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/g, (match, src) => {
      const placeholder = `___VIDEO_PLACEHOLDER_${videoCounter}___`;
      videoPlaceholders[placeholder] = `<iframe src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      videoCounter++;
      return placeholder + '\n\n';
    });

    // Replace regular videos with placeholders to protect them from HTML cleanup
    markdown = markdown.replace(/<div class="video-with-caption" data-caption="([^"]+)">[\s\S]*?<video[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/video>[\s\S]*?<\/div>/g, (match, caption, src) => {
      const placeholder = `___VIDEO_PLACEHOLDER_${videoCounter}___`;
      if (caption && caption.trim()) {
        videoPlaceholders[placeholder] = `<div class="video-with-caption"><video src="${src}" controls></video><div class="caption-text">${caption.trim()}</div></div>`;
      } else {
        videoPlaceholders[placeholder] = `<video src="${src}" controls></video>`;
      }
      videoCounter++;
      return placeholder + '\n\n';
    });

    markdown = markdown.replace(/<video[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/video>/g, (match, src) => {
      const placeholder = `___VIDEO_PLACEHOLDER_${videoCounter}___`;
      videoPlaceholders[placeholder] = `<video src="${src}" controls></video>`;
      videoCounter++;
      return placeholder + '\n\n';
    });

    // Links - MUST process before bold/italic to preserve link text formatting
    markdown = markdown.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)');

    // Headers
    markdown = markdown.replace(/<h1>(.*?)<\/h1>/g, '# $1\n');
    markdown = markdown.replace(/<h2>(.*?)<\/h2>/g, '## $1\n');
    markdown = markdown.replace(/<h3>(.*?)<\/h3>/g, '### $1\n');
    markdown = markdown.replace(/<h4>(.*?)<\/h4>/g, '#### $1\n');

    // Bold and italic
    markdown = markdown.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
    markdown = markdown.replace(/<b>(.*?)<\/b>/g, '**$1**');
    markdown = markdown.replace(/<em>(.*?)<\/em>/g, '*$1*');
    markdown = markdown.replace(/<i>(.*?)<\/i>/g, '*$1*');

    // Images with captions - extract from data-caption attribute
    markdown = markdown.replace(/<div class="image-with-caption"[^>]*data-caption="([^"]*)"[^>]*><img[^>]*src="([^"]*)"[^>]*>(?:<\/img>)?<\/div>/g, (match, caption, src) => {
      if (caption && caption.trim()) {
        // Use caption as both alt text and title attribute
        return `![${caption.trim()}](${src} "${caption.trim()}")\n\n`;
      }
      return `![](${src})\n\n`;
    });

    // Regular images without captions
    markdown = markdown.replace(/<img src="(.*?)"(?: alt="(.*?)")?(.*?)>/g, (match, src, alt) => {
      return `![${alt || ''}](${src})\n\n`;
    });

    // Lists
    markdown = markdown.replace(/<ul>(.*?)<\/ul>/gs, (match, content) => {
      const items = content.match(/<li>(.*?)<\/li>/g) || [];
      return items.map((item: string) => '- ' + item.replace(/<\/?li>/g, '')).join('\n') + '\n';
    });
    markdown = markdown.replace(/<ol>(.*?)<\/ol>/gs, (match, content) => {
      const items = content.match(/<li>(.*?)<\/li>/g) || [];
      return items.map((item: string, i: number) => `${i + 1}. ` + item.replace(/<\/?li>/g, '')).join('\n') + '\n';
    });

    // Code
    markdown = markdown.replace(/<code>(.*?)<\/code>/g, '`$1`');
    markdown = markdown.replace(/<pre><code>(.*?)<\/code><\/pre>/gs, '```\n$1\n```\n');

    // Blockquotes
    markdown = markdown.replace(/<blockquote>(.*?)<\/blockquote>/gs, (match, content) => {
      return content.split('\n').map((line: string) => '> ' + line).join('\n') + '\n';
    });

    // Paragraphs and line breaks
    markdown = markdown.replace(/<p>(.*?)<\/p>/g, '$1\n\n');
    markdown = markdown.replace(/<br\s*\/?>/g, '\n');

    // Clean up remaining HTML tags
    markdown = markdown.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    markdown = markdown.replace(/&nbsp;/g, ' ');
    markdown = markdown.replace(/&amp;/g, '&');
    markdown = markdown.replace(/&lt;/g, '<');
    markdown = markdown.replace(/&gt;/g, '>');
    markdown = markdown.replace(/&quot;/g, '"');

    // Restore video placeholders
    Object.keys(videoPlaceholders).forEach(placeholder => {
      markdown = markdown.replace(placeholder, videoPlaceholders[placeholder]);
    });

    return markdown.trim();
  };

  const handleDelete = async () => {
    if (!currentSlug) return;

    const confirmed = confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const response = await fetch('/api/delete-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug: currentSlug }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ Deleted: ${currentSlug}.md`);
        // Reset to new post state
        handleNewPost();
        // Reload the page to update the sidebar
        window.location.reload();
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('❌ Failed to delete post');
    }
  };

  const handleTogglePublish = () => {
    const newValue = !isPublished;
    setIsPublished(newValue);
    handleSave({ published: newValue });
  };

  if (!editor) {
    return null;
  }

  const rightSidebar = (
    <div className="sticky top-[200px] space-y-6">
      {/* Tags Section */}
      <div>
        <h3 className="text-xl text-white/40 mb-3 font-[family-name:var(--font-mondwest)]">
          Tag
        </h3>
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="w-full bg-transparent text-xl text-white focus:outline-none transition-colors cursor-pointer font-[family-name:var(--font-mondwest)]"
        >
          <option value="work" className="bg-black text-white">Work</option>
          <option value="art" className="bg-black text-white">Art</option>
          <option value="vibes" className="bg-black text-white">Vibes</option>
        </select>
      </div>

      {/* Image URL Section */}
      <div>
        <h3 className="text-xl text-white/40 mb-3 font-[family-name:var(--font-mondwest)]">
          Hero Image
        </h3>
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Enter image URL..."
          className="w-full bg-transparent text-xl text-white placeholder:text-white/30 focus:outline-none transition-colors font-[family-name:var(--font-mondwest)]"
        />
      </div>

      {/* Image Preview */}
      {imageUrl && (
        <div>
          <h3 className="text-xl text-white/40 mb-3 font-[family-name:var(--font-mondwest)]">
            Preview
          </h3>
          <div className="w-full aspect-video bg-white/10 rounded-lg overflow-hidden relative">
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <BlogLayout
      editorPosts={posts}
      onPostSelect={handleLoadPost}
      onNewPost={handleNewPost}
      rightSidebar={rightSidebar}
    >
      <div className="flex-1 px-6 pt-24 pb-24 md:px-0 md:pt-0 md:pb-32">
        {/* Header with Back, Editor mode, and Save */}
        <div className="flex items-center justify-between mb-8 md:mb-12">
          <div className="flex items-center gap-4">
            <NextLink
              href="/"
              className="text-xl text-white/50 hover:text-white transition-colors focus:outline-none"
            >
              <ScrambleText text="Back" />
            </NextLink>
            <span className="text-xl text-white font-[family-name:var(--font-mondwest)]">
              Editor mode
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDelete}
              disabled={!currentSlug}
              className={`text-xl transition-colors focus:outline-none ${
                currentSlug
                  ? 'text-white/50 hover:text-white cursor-pointer'
                  : 'text-white/20 cursor-not-allowed'
              }`}
            >
              Delete
            </button>
            <button
              onClick={handleTogglePublish}
              disabled={!currentSlug}
              className={`text-xl transition-colors focus:outline-none ${
                currentSlug
                  ? 'text-white/50 hover:text-white cursor-pointer'
                  : 'text-white/20 cursor-not-allowed'
              }`}
            >
              {isPublished ? 'Published' : 'Draft'}
            </button>
            <button
              onClick={() => handleSave()}
              className="text-xl text-white/50 hover:text-white transition-colors focus:outline-none"
            >
              {currentSlug ? 'Update' : 'Save'}
            </button>
          </div>
        </div>

        {/* Title and Description Inputs */}
        <div className="mb-8 md:mb-12">
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Start with a cool title"
            rows={1}
            className="w-full bg-transparent border-none text-3xl lg:text-5xl font-normal leading-tight text-white placeholder:text-white/30 focus:outline-none font-[family-name:var(--font-mondwest)] resize-none overflow-hidden break-words whitespace-normal"
          />
          <textarea
            ref={descriptionRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sum up your content in a line or two"
            rows={1}
            className="w-full bg-transparent border-none mt-4 lg:mt-6 text-xl lg:text-2xl text-white/50 placeholder:text-white/30 focus:outline-none resize-none overflow-hidden break-words whitespace-normal"
          />
        </div>

        {/* Rich Text Editor */}
        <div>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Floating Toolbar */}
      {showToolbar && (
        <div
          ref={toolbarRef}
          className="fixed z-50 shadow-2xl flex gap-0.5 items-center"
          style={{
            top: `${toolbarPosition.top}px`,
            left: `${toolbarPosition.left}px`,
            transform: 'translateX(-50%)',
            padding: '4px',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* H1, H2, H3, T */}
              <button
                onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()}
                className={`p-1.5 transition-colors ${
                  editor.isActive('heading', { level: 1 }) ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Heading 1"
              >
                <Heading1 className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
              <button
                onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}
                className={`p-1.5 transition-colors ${
                  editor.isActive('heading', { level: 2 }) ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Heading 2"
              >
                <Heading2 className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
              <button
                onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()}
                className={`p-1.5 transition-colors ${
                  editor.isActive('heading', { level: 3 }) ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Heading 3"
              >
                <Heading3 className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
              <button
                onClick={() => editor.chain().focus().setParagraph().run()}
                className={`p-1.5 transition-colors ${
                  !editor.isActive('heading') ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Regular"
              >
                <Type className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>

              <div className="w-px h-5 bg-white/30 mx-1"></div>

              {/* Bold & Italic */}
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 transition-colors ${
                  editor.isActive('bold') ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Bold"
              >
                <Bold className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 transition-colors ${
                  editor.isActive('italic') ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Italic"
              >
                <Italic className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>

              <div className="w-px h-5 bg-white/30 mx-1"></div>

              {/* Block Formats: List, Numbered, Code, Quote */}
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 transition-colors ${
                  editor.isActive('bulletList') ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Bullet List"
              >
                <List className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 transition-colors ${
                  editor.isActive('orderedList') ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Numbered List"
              >
                <ListOrdered className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`p-1.5 transition-colors ${
                  editor.isActive('codeBlock') ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Code Block"
              >
                <Code2 className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-1.5 transition-colors ${
                  editor.isActive('blockquote') ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Quote"
              >
                <Quote className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                }}
                className={`p-1.5 transition-colors ${
                  editor.isActive('table') ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Table"
              >
                <Table2 className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
              <button
                onClick={() => {
                  const url = prompt('Enter link URL:');
                  if (url) {
                    editor.chain().focus().setLink({ href: url }).run();
                  }
                }}
                className={`p-1.5 transition-colors ${
                  editor.isActive('link') ? 'bg-white/40' : 'hover:bg-white/20'
                }`}
                style={{ clipPath: buttonClipPath }}
                title="Link"
              >
                <Link2 className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
              <button
                onClick={() => {
                  const url = prompt('Enter image URL:');
                  if (url) {
                    // Insert image with empty caption - user can add caption in the UI textarea
                    (editor.chain().focus() as any).setImage({ src: url, alt: '', caption: '' }).run();
                  }
                }}
                className="p-1.5 transition-colors hover:bg-white/20"
                style={{ clipPath: buttonClipPath }}
                title="Image"
              >
                <ImageIcon className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
              <button
                onClick={() => {
                  const url = prompt('Enter video URL:');
                  if (url) {
                    const embedUrl = getYouTubeEmbedUrl(url);
                    if (embedUrl) {
                      (editor.chain().focus() as any).setYouTube({ src: embedUrl, caption: '' }).run();
                    } else {
                      (editor.chain().focus() as any).setVideo({ src: url, caption: '' }).run();
                    }
                  }
                }}
                className="p-1.5 transition-colors hover:bg-white/20"
                style={{ clipPath: buttonClipPath }}
                title="Video"
              >
                <VideoIcon className="w-5 h-5 text-white" strokeLinejoin="round" strokeLinecap="round" />
              </button>
        </div>
      )}

      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(255, 255, 255, 0.4);
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </BlogLayout>
  );
}
