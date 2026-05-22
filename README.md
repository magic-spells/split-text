# Split Text Web Component

Lightweight text-reveal web component. Splits text into words, characters, or detected lines, then animates each unit with a CSS-driven stagger. Eight built-in effects — rise, drop, slide, bloom, two 3D spins, and a per-character magnetic scatter. No dependencies. No framework. ~2.7 KB gzipped (JS) + 0.9 KB (CSS).

A small alternative to GSAP SplitText / Splitting.js when you don't need the rest of those libraries.

[**Live Demo**](https://magic-spells.github.io/split-text/demo/)

## Features

- Three split modes: `words`, `chars`, `lines` (auto-detected from layout)
- Eight effects: `rise` (default), `drop`, `slide-right`, `slide-left`, `bloom`, `spin-x`, `spin-y`, `magnetic`
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

The script walks the host's text nodes, wraps each word (or grapheme, in chars mode) in two nested spans — an outer mask with `overflow: hidden` and an inner element that animates from a pre-reveal state to its final position. Each inner span gets a `--i` index; CSS computes `animation-delay` from it. The `effect` attribute selects which keyframe runs — duration, easing, and stagger are shared across every effect. (The `magnetic` effect is the one exception to the `overflow: hidden` mask: its pieces fly in from outside the box, so the wrapper is set to `overflow: visible`, and JS stamps each inner span with a random `--split-text-mx` / `--split-text-my` start offset.)

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
