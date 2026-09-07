/**
 * JSON strings are valid YAML scalars and safely preserve quotes and newlines.
 * @param {{title: string, date: string, description: string, tags: string[], image: string | null, published: boolean}} metadata
 * @param {string} markdown
 */
export function serializePost(metadata, markdown) {
  return `---\n${Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n${markdown}`;
}
