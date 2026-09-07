import { z } from 'zod';

export const PostFrontmatterSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'Date must be in YYYY-MM-DD or YYYY-MM-DDTHH:mm format'),
  description: z.string().min(1, 'Description is required'),
  image: z.string().nullish(),
  tags: z.array(z.string()).optional().default([]),
  published: z.boolean().optional().default(true),
});
