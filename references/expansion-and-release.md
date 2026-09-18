# Expansion and release rules

Large books are expanded in approved slices, not by cloning one spread pattern until the manifest is full.

## Chapter expansion

1. Baseline the existing book: spread ids, passage ids, bookmark schema and final thumbnails.
2. Get the creator to approve one representative chapter with its composition boards, 2D reconstruction proofs, visual and mechanical pattern. Agent QA is not that approval.
3. Give each new chapter at least one chapter-specific focal asset and one chapter-specific environmental or distant asset unless the source deliberately calls for reuse.
4. Keep new ids namespaced by chapter. Never renumber old spreads, passages or assets to make a list look contiguous.
5. Regenerate a chapter contact sheet and inspect repeated poses, reused empty grounds, scale drift and chapter rhythm.
6. Run chapter QA, then ask the creator before starting the next chapter: keep this chapter / open the next (named region or legend). Do not start the next chapter in the same turn.

Reuse is a production choice, not a validator loophole. A reused background is acceptable when the composition, lighting or event makes the reuse legible; record the reason in the storyboard.

## Release checklist

Before publishing an existing Work:

- validate the final manifest and every local file;
- run asset audit for schema v2/v3 books;
- for schema v3, run 2D reconstruction for every changed spread and confirm the approved board source is unchanged;
- run adjacent-turn, endpoint and page-depth QA at the scope implied by the changed files;
- regenerate directory and Work thumbnails from the final layout; a failed thumbnail blocks release;
- verify the published iframe, not only the local static server;
- confirm returned status is `ready`, chapter/spread counts match, and the last spread is reachable;
- record residual risks: sampled collision limits, untested hardware, missing narration/music, or known browser limitations.

Publication metadata is not a substitute for a browser verification. A local pass does not prove the published iframe received the same build. Browser timeouts, incomplete shutdown and stale thumbnails are failed evidence, not successful release with warnings.
