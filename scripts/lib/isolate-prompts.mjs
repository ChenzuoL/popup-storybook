// isolate-prompts.mjs — qwen-image-2.1 edit-mode prompts that cut ONE element out of a composition
// board IN PLACE. "In place" is the point: the element keeps its exact board position and size on a
// pure-white canvas, so its white-key bounding box IS its boardRect and nobody hand-measures pixels.

export const ISOLATE_MODES = Object.freeze(['isolate', 'isolate-key', 'curtain']);

const NEGATIVE = {
  isolate: 'other people, extra figures, extra objects, background scenery, building, wall, floor, ground, cast shadow, plinth, base, text, watermark, border, frame, moved, recentred, rescaled, cropped',
  curtain: 'people, person, character, figure, animal, creature, vehicle, loose objects, props, text, watermark, border, frame, moved, recentred, rescaled'
};

// Varied wording for retries: the content filter can cache a rejected prompt verbatim.
const RETRY_SUFFIX = [
  '',
  ' Output a clean cut-out on white.',
  ' Plain white surround, nothing else in frame.',
  ' A single isolated paper piece on a flat white field.'
];

/** Short name used in another item's removal list. */
export function labelOf(item) {
  if (typeof item.label === 'string' && item.label.trim()) return item.label.trim();
  const s = String(item.subject || item.id).split(/,| with | holding | wearing /)[0].trim();
  return s.split(/\s+/).slice(0, 9).join(' ');
}

export function isolatePrompt(item, { attempt = 0, withIdentity = false, neighbours = [] } = {}) {
  const mode = item.cutMode;
  if (!ISOLATE_MODES.includes(mode)) throw new Error(`${item.id}: cutMode ${mode} is not a qwen isolation mode`);
  if (typeof item.subject !== 'string' || !item.subject.trim()) throw new Error(`${item.id}: boardItem.subject (what to keep, as the board shows it) is required`);
  const subject = item.subject.trim();
  const suffix = RETRY_SUFFIX[attempt % RETRY_SUFFIX.length];
  if (mode === 'curtain') {
    const remove = Array.isArray(item.remove) && item.remove.length ? item.remove.join(', ') : 'every person, character, animal, vehicle and loose prop';
    return {
      prompt: `Edit this illustration. Remove ${remove}. Keep ONLY the background scenery — ${subject} — at exactly the same position, scale and framing as in the original image; do not move, zoom, re-centre or crop it. Where something was removed, continue the scenery behind it naturally in the same style. Keep the original colours, linework and paper/texture rendering. No people, no text.${suffix}`,
      negative: NEGATIVE.curtain
    };
  }
  const identity = withIdentity
    ? ' The second image shows what this subject looks like: keep the face, hair, colours and costume consistent with it, but take pose, position and size only from the first image.'
    : '';
  const remove = neighbours.length ? `Remove ${neighbours.join('; ')} completely. ` : '';
  return {
    prompt: `Edit this illustration. ${remove}Keep ONLY ${subject}. Keep it at exactly the same position, size, pose, proportions and framing as in the original image — do not move, rescale, re-centre, rotate or crop it. Repaint every other pixel — all other figures, objects, buildings, walls, floor, ground, sky and background — as plain flat pure white (#FFFFFF). Where part of it was hidden behind something else, complete that part naturally in the same style. Keep its original colours, linework and paper rendering.${identity} No cast shadow, no floor, no outline, no text.${suffix}`,
    negative: NEGATIVE.isolate
  };
}

/** Step 1 for entangled elements (a hand on a handle, a figure behind a prop): remove the touching
 *  neighbours and complete what they hid, changing nothing else. Step 2 is the normal isolate. */
export function preRemovePrompt(item, attempt = 0) {
  const what = item.preRemove.join('; ');
  const keep = labelOf(item);
  return {
    prompt: `Edit this illustration. Remove ${what} completely, including any hands, arms or parts of them that touch or overlap ${keep}. Where they covered ${keep}, complete ${keep} naturally in the same style — whole body, legs and feet, or the whole object. Change nothing else: same position, size, colours and framing.${RETRY_SUFFIX[attempt % RETRY_SUFFIX.length]}`,
    negative: 'extra limbs, floating hands, moved subject, rescaled, cropped, text, watermark'
  };
}
