# Asset production pipeline

Every character, prop or environmental standee goes through the same recorded pipeline:

```text
source/reference -> generate or import -> background removal -> crop -> alpha bounds
-> transparent padding -> mask -> compression -> light/dark inspection -> manifest/provenance
```

The page surface is a separate `page-art` asset with `surfacePolicy: ground-only`. Do not flatten a foreground character, landmark or readable building into it to make a spread look fuller.

## Manifest record

Schema v2 standees carry:

- `file`: final transparent local asset;
- `maskFile`: audited grayscale mask or alpha diagnostic;
- `alphaBounds`: normalized visible bounds `[x, y, width, height]`;
- `role`: background environment, midground character, foreground prop, and so on;
- `identityReference`: the reference that preserves subject identity. Source it from this world's own
  atom cover — a character cover for a character standee, a location cover for a landmark standee.
  See `world-recon.md`. Never invent an identity description when the world already carries the
  subject.
- `provenance`: `{sourceType, sourceRef, notes}`;
- optional `sourceImageSize`, `cropRect`, `finalImageSize`, `maxWorldWidth`, `maxWorldHeight`.

`identityReference` and `provenance` are different records. The former explains what the subject should look like and is sourced from this world's atom cover; the latter explains where the delivered pixels came from.

## Intake checks

Inspect every output over both light and dark paper. Reject clipped limbs, lost tails/roots, rectangular alpha residue, words/watermarks, malformed anatomy, accidental framing, or a crop that leaves too little transparent padding for the cut edge. Re-measure alpha bounds after any service that reframes a sheet.

Create a contact sheet with at least:

- source/reference;
- final cutout on light paper;
- final cutout on dark paper;
- mask/alpha bounds;
- in-scene scale preview.

A successful background-removal request is not an accepted asset. The production record is only complete after visual inspection and a manifest audit.

## Reproducibility

Keep generation prompts/model metadata outside credentials and store a short provenance reference in the manifest. Keep the final local files alongside the book so a future validator does not depend on a remote URL. Use stable asset ids; replacing pixels must not silently rename scene items or passage ids.

Run:

```bash
node scripts/audit-assets.cjs data/book.json --production --root=.
```

This checks paths, masks, bounds, provenance and scale metadata. It does not replace human alpha inspection or alpha-contour collision proof.
