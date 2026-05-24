/**
 * Tuning systems registry.
 *
 * Each system is a (PitchGrid + Scale catalog + Labeler + pcToStep + ChordRule)
 * bundle. SYSTEMS is the source of truth; the picker reads SYSTEM_ORDER for
 * display.
 *
 * 18 systems total — modern Western (12-TET) and historical Western
 * (Pythagorean, JI, Meantone, Werckmeister), Indian classical (Hindustani,
 * Carnatic), Middle Eastern (Arab Maqam, Turkish, Persian), East Asian
 * (Chinese, Japanese), Southeast Asian (Thai, Gamelan Slendro + Pelog),
 * and experimental microtonal (19-EDO, 31-EDO, 53-EDO).
 */

import type { TuningSystem } from './types';
import { TWELVE_TET }     from './systems/12tet';
import { HINDUSTANI }     from './systems/hindustani';
import { CARNATIC }       from './systems/carnatic';
import { ARAB }           from './systems/arab';
import { TURKISH }        from './systems/turkish';
import { PERSIAN }        from './systems/persian';
import { PYTHAGOREAN }    from './systems/pythagorean';
import { JUST_5 }         from './systems/just5';
import { MEANTONE }       from './systems/meantone';
import { WERCKMEISTER }   from './systems/werckmeister';
import { THAI }           from './systems/thai';
import { SLENDRO }        from './systems/slendro';
import { PELOG }          from './systems/pelog';
import { CHINESE }        from './systems/chinese';
import { JAPANESE }       from './systems/japanese';
import { EDO19 }          from './systems/edo19';
import { EDO31 }          from './systems/edo31';
import { EDO53 }          from './systems/edo53';

export * from './types';
export * from './labelers';

export const SYSTEMS: Record<string, TuningSystem> = {
  [TWELVE_TET.id]:    TWELVE_TET,
  [HINDUSTANI.id]:    HINDUSTANI,
  [CARNATIC.id]:      CARNATIC,
  [ARAB.id]:          ARAB,
  [TURKISH.id]:       TURKISH,
  [PERSIAN.id]:       PERSIAN,
  [PYTHAGOREAN.id]:   PYTHAGOREAN,
  [JUST_5.id]:        JUST_5,
  [MEANTONE.id]:      MEANTONE,
  [WERCKMEISTER.id]:  WERCKMEISTER,
  [THAI.id]:          THAI,
  [SLENDRO.id]:       SLENDRO,
  [PELOG.id]:         PELOG,
  [CHINESE.id]:       CHINESE,
  [JAPANESE.id]:      JAPANESE,
  [EDO19.id]:         EDO19,
  [EDO31.id]:         EDO31,
  [EDO53.id]:         EDO53,
};

/**
 * Display order — flat scrollable list, no section headers (per user pick).
 * Roughly grouped: Western modern, Indian, Middle Eastern, Western historical,
 * East Asian + SE Asian, experimental.
 */
export const SYSTEM_ORDER: readonly string[] = [
  '12tet',
  'hindustani',
  'carnatic',
  'arab',
  'turkish',
  'persian',
  'pythagorean',
  'just5',
  'meantone',
  'werckmeister',
  'thai',
  'slendro',
  'pelog',
  'chinese',
  'japanese',
  'edo19',
  'edo31',
  'edo53',
];

export function lookupSystem(id: string): TuningSystem {
  return SYSTEMS[id] ?? SYSTEMS['12tet'];
}
