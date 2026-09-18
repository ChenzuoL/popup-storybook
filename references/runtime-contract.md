# Pop-Up Storybook runtime contract v2

A production renderer may choose its own Three.js architecture, but it must expose a small deterministic QA surface in `window.__neta` or an adapter with equivalent methods. A renderer may implement the case-study names (`window.bookQA.read`, `fold`, `seek`, `collisions`, `mechanismBounds`) internally, but the production adapter must normalize them to the names below.

## Required state

```js
current() // { spreadId, chapterId, index, count, phase, turning, ready }
turn(direction) // locks input until a settled state
seekTurn(progress) // freeze the active turn at normalized [0,1] for QA only
settled() // true only after attachments have returned to page-owned parents
open(targetIndex) // open from closed state to a specific spread, preparing textures before animation
close() // close from current spread to closed state, cancel narration, restore gate overlay
```

`seekTurn` is a test hook. It must not change the reader's settled bookmark or call audio/page completion handlers.

`open(targetIndex)` must prepare the destination spread's textures (both pages) before starting the binding animation, so the book opens directly to the bookmarked spread without flashing through the first page.

`close()` must animate the binding frame from the current open angle back to closed (vertical), hide the turning leaf, cancel any active narration, and restore the gate overlay with bookmark-aware messaging. The cover art remains visible throughout closure. After reaching the closed state, persist the current spread index as a bookmark.

## Required ownership

For a forward turn from `low` to `high`:

- static left surface remains `low.left` until the leaf has landed;
- static right surface reveals `high.right` only after the moving leaf has cleared it;
- moving leaf front is `low.right`;
- moving leaf back is `high.left`;
- outgoing right-page and incoming left-page attachments travel with the leaf;
- outgoing left-page and incoming right-page attachments remain page-owned.

For a backward turn, use the same `low` / `high` rule. Do not derive texture ownership from the direction alone. In particular, the current right page must not repaint to the previous spread before the leaf lands on it.

At an endpoint, never leave static and moving surfaces coplanar and visible together. Hide the covered static surface through the endpoint epsilon, then restore exactly one settled surface and remove the carrier transform.

## Required attachment state

Every scene item exposes or internally retains:

- stable asset id and scene id;
- `boardItemId` and the approved source board region when using schema v3;
- page side and layer;
- normalized anchor and visible alpha bounds;
- mechanism (`hinge`, `rise`, `accordion`, or `static`);
- fold/reveal amount;
- page-frame transform and settled home transform;
- support and crease visibility.

A page may use one shared deployment amount for all attachments on a spread. Per-item delays are allowed only when documented as a deliberate stagger; they must not create accidental unsynchronised motion.

## Required QA hooks

The renderer should expose:

```js
window.__neta = {
  state,
  seekTurn,
  collisions,
  standeeStates,
  pageSurfaceAudit
}
```

`pageSurfaceAudit()` should report static-surface visibility, moving-leaf visibility, render order/depth settings and current low/high ownership. A page-depth test must compare the printed page pixels with and without the page blocks/boards at several camera angles; a nonblank canvas check is not sufficient.

`collisions()` samples visible cut-out/support edges against visible page surfaces and the moving leaf. It must record pair, direction, normalized progress, asset id, support id and hit surface. A finite pass is evidence, never a proof of no intersection.

## Audit shapes

The reusable `scripts/runtime-contract-check.cjs` expects the following stable fields:

```js
pageSurfaceAudit() {
  return {
    lowId, highId,
    static: { left: { assetId }, right: { assetId } },
    leaf: { visible: true, frontAssetId, backAssetId },
    coplanarVisible: false,
    occlusions: []
  };
}

attachmentSnapshot() {
  return [{ id, ownerSpread, position, quaternion, fold, supportVisible }];
}
```

The checker runs every adjacent pair in both directions, freezes the turn at seven progress values, checks backward page-image ownership, enforces a configurable same-spread fold synchrony tolerance, rejects sampled collision hits and compares the `.999` attachment snapshot with the settled snapshot. For schema v3, run the 2D board reconstruction before invoking this runtime checker; runtime QA cannot prove that a wrong asset was placed against the wrong board region. Invoke it with a renderer adapter and production book manifest:

```bash
node scripts/runtime-contract-check.cjs \
  --adapter=/absolute/path/to/runtime-adapter.cjs \
  --book=/absolute/path/to/data/book.json \
  --out=/absolute/path/to/qa/runtime-report.json
```
