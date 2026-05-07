# Split Text Web Component

Lightweight text-reveal web component. Slides text into view from below an invisible line — by word, character, or detected line — with a CSS-driven stagger. No dependencies. No framework. ~2 KB gzipped.

A small alternative to GSAP SplitText / Splitting.js when you don't need the rest of those libraries.

[**Live Demo**](https://magic-spells.github.io/split-text/demo/)

## Features

- Three modes: `words`, `chars`, `lines` (auto-detected from layout)
- CSS-only animation — `transform` and `opacity` only, GPU-accelerated
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

### Timing

```html
<split-text delay="200" stagger="50" duration="900">
  Wait 200ms, then 50ms between each word, 900ms per word.
</split-text>
```

### Triggers

```html
<!-- Default: animate when scrolled into view -->
<split-text trigger="visible" threshold="0.25">…</split-text>

<!-- Animate immediately on load -->
<split-text trigger="load">…</split-text>

<!-- Manual trigger -->
<split-text id="hero" trigger="manual">…</split-text>
<script>
  document.querySelector('#hero').reveal();
</script>
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

| Attribute   | Default                              | Description                                     |
| ----------- | ------------------------------------ | ----------------------------------------------- |
| `split`     | `words`                              | `words`, `chars`, or `lines`                    |
| `delay`     | `0`                                  | Initial delay before animation starts (ms)      |
| `stagger`   | `30`                                 | Delay between each unit (ms)                    |
| `duration`  | `800`                                | Animation duration per unit (ms)                |
| `easing`    | `cubic-bezier(0.16, 1, 0.3, 1)`      | CSS easing function                             |
| `trigger`   | `visible`                            | `visible`, `load`, or `manual`                  |
| `threshold` | `0.1`                                | IntersectionObserver threshold (0–1)            |

## CSS Custom Properties

Override these for theming. They're already wired through the CSS — set them on the host or any ancestor.

| Property                  | Default                         | Description                                  |
| ------------------------- | ------------------------------- | -------------------------------------------- |
| `--split-text-duration`   | `800ms`                         | Animation duration                           |
| `--split-text-easing`     | `cubic-bezier(0.16, 1, 0.3, 1)` | Animation easing                             |
| `--split-text-distance`   | `100%`                          | Translation distance (try `40%` for subtler) |
| `--split-text-stagger`    | `30ms`                          | Delay between units                          |
| `--split-text-delay`      | `0ms`                           | Initial delay                                |

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

The script walks the host's text nodes, wraps each word (or grapheme, in chars mode) in two nested spans — an outer mask with `overflow: hidden` and an inner element that translates from `translateY(100%)` to `translateY(0)`. Each inner span gets a `--i` index; CSS computes `animation-delay` from it.

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
