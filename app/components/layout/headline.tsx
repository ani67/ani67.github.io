/**
 * The site's headline, in one place.
 *
 * It appears on the homepage, /blog, /about and in three kinds of metadata, so
 * it lived in five files and drifted. Two exports keep them in step: `Headline`
 * for the rendered version, where the break between the identity and the role
 * is deliberate rather than left to the wrap; `HEADLINE_TEXT` for the flat
 * string that search, social cards and llms.txt need.
 */
export const HEADLINE_LEAD = 'Designer, artist, builder.';
export const HEADLINE_ROLE =
  'Currently at Frameo.AI, setting the design direction & owning the product side of GTM.';

export const HEADLINE_TEXT = `${HEADLINE_LEAD} ${HEADLINE_ROLE}`;

export function Headline() {
  return (
    <>
      <span className="block">{HEADLINE_LEAD}</span>
      <span className="block">{HEADLINE_ROLE}</span>
    </>
  );
}
