# Split Text Web Component

Lightweight text-reveal web component. Splits text into words, characters, or detected lines, then animates each unit with a CSS-driven stagger. Eight built-in effects — rise, drop, slide, bloom, two 3D spins, and a per-character magnetic scatter — plus a registry for writing your own. No dependencies. No framework. ~2.7 KB gzipped (JS) + 0.9 KB (CSS).

A small alternative to GSAP SplitText / Splitting.js when you don't need the rest of those libraries.

[**Live Demo**](https://magic-spells.github.io/split-text/demo/)

## Features

- Three split modes: `words`, `chars`, `lines` (auto-detected from layout)
- Eight effects: `rise` (default), `drop`, `slide-right`, `slide-left`, `bloom`, `spin-x`, `spin-y`, `magnetic`
- [Custom effects](#custom-effects) are just CSS — add a keyframe, get a new `effect` value
- CSS-only animation — `transform`, `opacity`, and `filter`, GPU-accelerated
- Triggers when scrolled into view by default (configurable: `load`, `manual`)
- Preserves inline markup (`<em>`, `<strong>`, `<a>`, `<br>`) inside the host
- Emoji-safe character splitting via `Intl.Segmenter`
- Honors `prefers-reduced-motion`
- After animation, wrappers swap to `display: contents` so text reflows naturally on resize
- Self-registers; safe to import multiple times

## Installation

```bash
npm install @magic-spells/split-text
```

```js
import '@magic-spells/split-text';
```

Or include directly:

```html
<script src="https://unpkg.com/@magic-spells/split-text"></script>
<link rel="stylesheet" href="https://unpkg.com/@magic-spells/split-text/css/min" />
```

## Usage

```html
<split-text>The quick brown fox jumps over the lazy dog.</split-text>
```

That's it. The element splits on words by default and animates as soon as it scrolls into view.

### Modes

```html
<!-- Words (default) -->
<split-text split="words">Each word slides up independently</split-text>

<!-- Characters -->
<split-text split="chars">Letter by letter</split-text>

<!-- Lines (auto-detected from layout) -->
<split-text split="lines">
  This longer paragraph wraps onto multiple lines, and each line
  animates as a unit. Resize the window before scrolling to it and
  the line groups recalculate to match the new layout.
</split-text>
```

### Effects

```html
<!-- rise (default) — slides up from below -->
<split-text>Rises into view.</split-text>

<!-- drop — falls in from above -->
<split-text effect="drop">Falls into place.</split-text>

<!-- slide-right / slide-left — sweeps in horizontally -->
<split-text effect="slide-right" split="chars">Sliding in from the right.</split-text>
<split-text effect="slide-left" split="chars">And from the left.</split-text>

<!-- bloom — blur + scale pop, no translate -->
<split-text effect="bloom" split="chars">Comes into focus.</split-text>

<!-- spin-x — rotateX flip (origin: bottom by default) -->
<split-text effect="spin-x" split="chars">Stands up from baseline.</split-text>

<!-- spin-y — rotateY flip (origin: left by default) -->
<split-text effect="spin-y" split="chars">Swings open like a door.</split-text>

<!-- magnetic — per-character random scatter, snaps into place -->
<split-text effect="magnetic" split="chars">Pulled into place.</split-text>
```

The 3D spin effects rely on `perspective: 2000px` set on the host by default. Override with `--split-text-perspective`, and shift the pivot with `--split-text-origin`. The bloom effect's starting state is tunable via `--split-text-blur` and `--split-text-scale`.

The `magnetic` effect is built for `split="chars"`. Each character starts shifted to the right by a random distance at a random height, blurred and transparent, then accelerates home on an ease-in curve (override with `easing`). The per-unit offsets are randomized in JS — replaying via `.split()` reshuffles them. Pieces are intentionally not clipped, so they travel outside their box; the starting blur is shared with bloom via `--split-text-blur`.

### Timing

```html
<split-text delay="200" stagger="50" duration="900">
  Wait 200ms, then 50ms between each word, 900ms per word.
</split-text>
```

### Triggers

```html
<!-- Default: animate when scrolled into view (waits until 100% visible) -->
<split-text trigger="visible">…</split-text>

<!-- Animate immediately on load -->
<split-text trigger="load">…</split-text>

<!-- Manual trigger -->
<split-text id="hero" trigger="manual">…</split-text>
<script>
  document.querySelector('#hero').reveal();
</script>
```

### Adjusting the trigger position

`offset` shifts the trigger line up from the bottom of the viewport. The default is `"20%"` — text animates once the element has scrolled into the bottom fifth of the viewport, rather than the instant it peeks in.

```html
<!-- Default — 20% of viewport height above the bottom -->
<split-text>…</split-text>

<!-- Custom: 200px above the bottom of the viewport -->
<split-text offset="200px">…</split-text>

<!-- Disable the offset — fire on first intersection -->
<split-text offset="0">…</split-text>
```

### Custom Easing

```html
<split-text easing="cubic-bezier(0.34, 1.56, 0.64, 1)">
  A spring overshoot for that playful feel.
</split-text>
```

## Custom Effects

An effect is CSS. Write a resting state, bind a keyframe to `[data-state="revealing"]`, and
you have a new `effect` value — no JavaScript required. The built-ins are written exactly
this way, and your effect inherits the same `delay` / `stagger` / `duration` / `easing`
plumbing for free.

```css
/* 1. Resting state — how each unit looks before the reveal. Match your
      keyframe's `from` frame or you'll see a flash of the wrong pose. */
split-text[effect='ember'] .split-text-word-inner,
split-text[effect='ember'] .split-text-char-inner {
  transform: translateY(0.6em) scale(0.6) rotate(var(--ember-tilt, 0deg));
  filter: blur(6px);
  opacity: 0;
  will-change: transform, opacity, filter;
}

/* 2. Optional — units that leave their box (blur halos, scale-ups, long
      travel) need the wrapper's mask lifted, or they get clipped. */
split-text[effect='ember'] .split-text-word,
split-text[effect='ember'] .split-text-char {
  overflow: visible;
}

/* 3. Bind the keyframe. Set only `animation-name` — duration, easing,
      delay, and the stagger calc all come from the shared rule. */
split-text[effect='ember'][data-state='revealing'] .split-text-word-inner,
split-text[effect='ember'][data-state='revealing'] .split-text-char-inner {
  animation-name: ember;
}

@keyframes ember {
  from {
    transform: translateY(0.6em) scale(0.6) rotate(var(--ember-tilt, 0deg));
    filter: blur(6px);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1) rotate(0deg);
    filter: blur(0);
    opacity: 1;
  }
}
```

```html
<split-text effect="ember" split="chars">Caught the light.</split-text>
```

Nothing else is required. Once the reveal finishes the component's `[data-revealed]`
rest state pins `transform: none; filter: none; opacity: 1` over your resting rule — that
rule is written at a specificity high enough to win against the selector shape above, so
your effect cleans up like a built-in. (Writing a resting rule at a *higher* specificity
than `split-text[effect='x'] .split-text-char-inner` is fine, but then scope it with
`:not([data-revealed])` or it will keep applying after the reveal.) `prefers-reduced-motion`
short-circuits the whole thing before any splitting happens, so there's nothing to handle
there either.

### Registering behavior

Two things CSS can't express on its own: a default easing curve for the effect, and a
per-unit randomized start. `SplitText.registerEffect()` adds both — and only those.

```js
import { SplitText } from '@magic-spells/split-text';

SplitText.registerEffect('ember', {
  // default `--split-text-easing` for this effect —
  // an explicit `easing` attribute still wins
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',

  // called once per split unit, right after splitting
  perUnit(inner, index, total) {
    // a random tilt this effect's keyframe reads
    inner.style.setProperty('--ember-tilt', `${(Math.random() * 24 - 12).toFixed(1)}deg`);
    // and a random timing offset, in stagger steps
    inner.style.setProperty('--split-text-jitter', Math.random().toFixed(2));
  },
});
```

| Key       | Type                                   | Description                                                                    |
| --------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| `easing`  | `string`                               | Default easing for this effect. Optional; falls back to the global default.     |
| `perUnit` | `(inner, index, total) => void`         | Runs per split unit. `inner` is the animating span. Optional.                   |

Both keys are optional — an effect with no JavaScript side never needs to be registered
at all. Registering the same name again replaces the previous config.

**Order doesn't matter.** The element self-registers when the module is imported, so
`<split-text>` tags in the initial HTML upgrade before your `registerEffect()` call can
run. `registerEffect()` handles that: it re-applies the easing and re-runs `perUnit` on
any matching element that's already on the page and hasn't revealed yet. Call it whenever
is convenient.

### Per-unit timing jitter

`--split-text-jitter` is a unitless multiplier of one stagger step, added to that unit's
`animation-delay`. It works on every effect, built-ins included:

```js
SplitText.registerEffect('rise', {
  perUnit: (inner) => inner.style.setProperty('--split-text-jitter', (Math.random() * 2).toFixed(2)),
});
```

`0` (the default) is a perfectly even stagger. `1.5` pushes that unit one and a half steps
later. Negative values pull a unit earlier; the total delay is clamped at `0ms`, so a unit
can never start mid-animation.

### Why there's no `css` option

`registerEffect()` deliberately takes no stylesheet — no `css` string, no injected
`<style>` tag. Injected CSS arrives with the JavaScript chunk, which is always after first
paint, so the effect's resting state wouldn't be applied yet and the text would flash in
its unstyled pose before dropping back to animate. That's exactly the flash the
`split-text:not(:defined) { visibility: hidden }` rule exists to prevent. Resting states
stay in your stylesheet, where the browser has them before it paints. Registration carries
JavaScript behavior only.

### Inline Markup

Inline tags inside the host are preserved. Links remain clickable, emphasis still styles, line breaks force new lines:

```html
<split-text split="lines">
  Built with <em>care</em> and <a href="/about">a few good ideas</a>.<br>
  Try resizing the window before scrolling here.
</split-text>
```

## Attributes

| Attribute     | Default                         | Description                                          |
| ------------- | ------------------------------- | ---------------------------------------------------- |
| `split`       | `words`                         | `words`, `chars`, or `lines`                         |
| `effect`      | `rise`                          | `rise`, `drop`, `slide-right`, `slide-left`, `bloom`, `spin-x`, `spin-y`, `magnetic` |
| `delay`       | `0`                             | Initial delay before animation starts (ms)           |
| `stagger`     | `30`                            | Delay between each unit (ms)                         |
| `duration`    | `800`                           | Animation duration per unit (ms)                     |
| `easing`      | `cubic-bezier(0.16, 1, 0.3, 1)` | CSS easing function                                  |
| `trigger`     | `visible`                       | `visible`, `load`, or `manual`                       |
| `offset`      | `20%`                           | Distance above bottom of viewport before firing (px or %; set `0` to disable) |

## CSS Custom Properties

Override these for theming. They're already wired through the CSS — set them on the host or any ancestor.

| Property                    | Default                         | Description                                                                  |
| --------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| `--split-text-duration`     | `800ms`                         | Animation duration                                                           |
| `--split-text-easing`       | `cubic-bezier(0.16, 1, 0.3, 1)` | Animation easing                                                             |
| `--split-text-distance`     | `100%`                          | Travel distance for `rise` / `drop` / `slide-*` (try `40%` for subtler)      |
| `--split-text-stagger`      | `30ms`                          | Delay between units                                                          |
| `--split-text-delay`        | `0ms`                           | Initial delay                                                                |
| `--split-text-perspective`  | `2000px`                        | 3D camera distance — applies to `spin-x` / `spin-y`                          |
| `--split-text-origin`       | _per-effect_                    | `transform-origin` for spin (defaults: `bottom` for spin-x, `left` for spin-y) |
| `--split-text-blur`         | `2px`                           | Starting blur radius (`bloom` & `magnetic`)                                  |
| `--split-text-scale`        | `0.7`                           | Bloom starting scale                                                         |
| `--split-text-jitter`       | `0`                             | Per-unit timing offset, in stagger steps (see [Custom Effects](#custom-effects)) |

```css
split-text {
  --split-text-easing: ease-out;
  --split-text-distance: 60%;
}
```

## Methods

```js
const el = document.querySelector('split-text');

el.reveal();  // trigger animation manually (when trigger="manual")
el.split();   // reset and re-split (call after changing innerHTML)
```

And one static method on the class, for [custom effects](#custom-effects):

```js
import { SplitText } from '@magic-spells/split-text';

SplitText.registerEffect(name, { easing, perUnit });
```

## Events

Both events bubble.

```js
el.addEventListener('split-text:start', (e) => {
  console.log(e.detail); // { split: "words", count: 12 }
});

el.addEventListener('split-text:complete', (e) => {
  console.log('done', e.detail);
});
```

## How it works

The script walks the host's text nodes, wraps each word (or grapheme, in chars mode) in two nested spans — an outer mask with `overflow: hidden` and an inner element that animates from a pre-reveal state to its final position. Each inner span gets a `--i` index; CSS computes `animation-delay` from it. The `effect` attribute selects which keyframe runs — duration, easing, and stagger are shared across every effect, so [adding your own](#custom-effects) is a matter of writing one more keyframe. (The `magnetic` effect is the one built-in that needs JavaScript: its pieces fly in from outside the box, so the wrapper is set to `overflow: visible`, and a registered `perUnit` hook stamps each inner span with a random `--split-text-mx` / `--split-text-my` start offset. It goes through the same public registry any custom effect uses.)

For lines mode, the script splits into words first, measures each word's `getBoundingClientRect().top` after layout, groups consecutive words by their top position (with tolerance for sub-pixel rendering), and assigns every word in a line the same `--i`. Words are never re-parented, so any inline markup inside (links, emphasis, etc.) survives the split.

Once animation completes, the host gets `data-revealed` and CSS sets every internal wrapper to `display: contents`. Layout becomes identical to the original markup — text reflows naturally on resize, with no JS work and no `innerHTML` thrash.

## Accessibility

- The host's `aria-label` is set to the original plain text, so screen readers announce the sentence once instead of wrapper-by-wrapper.
- Generated word wrappers are marked `aria-hidden="true"` to prevent the AT from re-reading the same text the `aria-label` already covers.
- Per the ARIA spec, `aria-hidden` is **skipped on wrappers inside interactive ancestors** (`<a>`, `<button>`, `<summary>`, form controls, `[role="button"]`, focusable `[tabindex]`, etc.). Nested links and buttons retain their accessible names.
- `prefers-reduced-motion: reduce` disables the animation entirely; content shows immediately.

## Browser Support

Modern browsers with custom elements + `IntersectionObserver` support (Chrome, Firefox, Safari, Edge). `Intl.Segmenter` is used when available for grapheme-correct character splitting; older Safari falls back to spread iterator (handles emoji correctly, just not full grapheme clusters).

## License

MIT

---

<p align="center">
  Made by <a href="https://github.com/coryschulz">Cory Schulz</a>
</p>
