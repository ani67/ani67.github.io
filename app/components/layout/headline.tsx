/**
 * The site's headline, in one place.
 *
 * It appears on the homepage and in three kinds of metadata, so
 * it lived in five files and drifted. Two exports keep them in step: `Headline`
 * for the rendered version, which runs as one line and wraps naturally;
 * `HEADLINE_TEXT` for the flat string that search, social cards and
 * llms.txt need.
 */
export const HEADLINE_LEAD = 'Designer, generative artist, builder.';
export const HEADLINE_ROLE = 'Currently building Frameo.AI.';

export const HEADLINE_TEXT = `${HEADLINE_LEAD} ${HEADLINE_ROLE}`;

export function Headline() {
  return <>{HEADLINE_TEXT}</>;
}
