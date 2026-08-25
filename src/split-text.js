import './split-text.css';

const DEFAULTS = {
	split: 'words',
	effect: 'rise',
	delay: 0,
	stagger: 30,
	duration: 800,
	easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
	trigger: 'visible',
	offset: '20%',
};

// Registered effects, keyed by the value of the `effect` attribute. An effect
// is CSS first — resting state, `animation-name` binding, and `@keyframes` all
// live in the consumer's stylesheet so they exist at first paint. Registration
// only carries the two things CSS can't express: a default easing curve and a
// per-unit hook for stamping randomized custom properties.
//
// Deliberately no `css` option: injected CSS would arrive with the JS chunk,
// after first paint, so an effect's resting state wouldn't be applied yet and
// the flash `split-text:not(:defined)` prevents would come right back.
const EFFECTS = new Map();

// Under Node (SSG / SSR prerender) there is no HTMLElement to extend, and
// `class X extends undefined` throws at module scope. Fall back to a plain base
// so importing the package is inert instead of fatal — nothing else in the
// class runs without a custom-element upgrade, which only happens in a browser.
const BaseElement = typeof HTMLElement === 'undefined' ? class {} : HTMLElement;

/**
 * Custom element that splits its text content into words, characters, or lines
 * and animates each unit with a CSS-driven slide-up + fade-in stagger.
 *
 * Attributes:
 *   split     — "words" (default) | "chars" | "lines"
 *   delay     — initial delay before the first unit animates, in ms (default 0)
 *   stagger   — delay between units, in ms (default 30)
 *   duration  — animation duration, in ms (default 800)
 *   easing    — CSS easing function (default cubic-bezier(0.16, 1, 0.3, 1))
 *   trigger   — "visible" (default, IntersectionObserver) | "load" | "manual"
 *   offset    — distance from bottom of viewport before firing (default "20%"; set "0" to disable)
 *   effect    — "rise" (default) | "drop" | "slide-right" | "slide-left" | "bloom" | "spin-x" | "spin-y" | "magnetic"
 *               (or any name passed to SplitText.registerEffect)
 */
class SplitText extends BaseElement {
	#originalHTML;
	#abortController;
	#observer;
	#initialized = false;
	#revealed = false;
	#splitMode;
	#effect;
	#units = [];
	#lineCount = 0;

	/**
	 * Register a custom effect. The visual side of an effect is authored in CSS
	 * (resting state + `[data-state="revealing"] { animation-name }` + keyframes);
	 * this only adds the parts CSS can't do.
	 *
	 * @param {string} name — matches the host's `effect` attribute
	 * @param {object} [config]
	 * @param {string} [config.easing] — default `--split-text-easing` for this
	 *   effect; an explicit `easing` attribute still wins.
	 * @param {(inner: HTMLElement, index: number, total: number) => void} [config.perUnit]
	 *   — called once per split unit; set CSS custom properties on `inner`
	 *   (e.g. `--split-text-jitter`) to give each unit its own start state.
	 */
	static registerEffect(name, config = {}) {
		if (typeof name !== 'string' || name.trim() === '') {
			throw new TypeError('SplitText.registerEffect: name must be a non-empty string');
		}
		if (config === null || typeof config !== 'object') {
			throw new TypeError('SplitText.registerEffect: config must be an object');
		}
		EFFECTS.set(name, config);

		// The element is defined at module scope, so anything already in the DOM
		// upgraded before this call could run. Re-apply to live instances that
		// haven't revealed yet, so registration order doesn't matter.
		if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
		const escaped = name.replace(/["\\]/g, '\\$&');
		let selector = `split-text[effect="${escaped}"]`;
		// Hosts with no `effect` attribute run the default effect
		if (name === DEFAULTS.effect) selector += ', split-text:not([effect])';
		for (const element of document.querySelectorAll(selector)) {
			if (element instanceof SplitText) element.#refreshEffect();
		}
	}

	connectedCallback() {
		const _ = this;
		if (_.#revealed) return;

		if (!_.#initialized) {
			_.#initialized = true;

			_.#originalHTML = _.innerHTML;

			// Use the plain text as the host's accessible name so screen readers
			// read the sentence once instead of one wrapped span at a time
			const labelText = _.textContent.replace(/\s+/g, ' ').trim();
			if (labelText && !_.hasAttribute('aria-label')) {
				_.setAttribute('aria-label', labelText);
			}

			const splitAttr = _.getAttribute('split');
			_.#splitMode = splitAttr === 'chars' || splitAttr === 'lines' ? splitAttr : 'words';
			_.#effect = _.getAttribute('effect') || DEFAULTS.effect;

			if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
				_.#markRevealed();
				return;
			}

			_.#applyTimingProperties();

			// Words and chars don't depend on layout — split eagerly so the
			// pre-animation state is correct before paint.
			// Lines depends on measured layout, so defer to reveal time.
			if (_.#splitMode === 'words') _.#splitWords();
			else if (_.#splitMode === 'chars') _.#splitChars();
			_.#stampEffectVars();
		} else {
			// Reconnecting before reveal — re-check reduced-motion and re-apply
			// timing in case the user adopted us into a new document.
			if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
				_.#markRevealed();
				return;
			}
			_.#applyTimingProperties();
		}

		// Lines mode defers wrapping until reveal — mask the host so the raw
		// text doesn't flash before measurement.
		if (_.#splitMode === 'lines') _.setAttribute('data-state', 'splitting');

		_.#abortController = new AbortController();
		_.#setupTrigger();
	}

	disconnectedCallback() {
		const _ = this;
		_.#abortController?.abort();
		_.#abortController = null;
		_.#observer?.disconnect();
		_.#observer = null;
	}

	/**
	 * Trigger the reveal animation manually.
	 */
	reveal() {
		this.#reveal();
	}

	/**
	 * Re-run splitting. Smart behavior:
	 * - If the DOM is currently in its split/wrapped state (post-reveal or
	 *   between renders), the original snapshot is restored and re-split —
	 *   useful for replaying the animation.
	 * - If the user has replaced innerHTML with fresh content, that content
	 *   becomes the new source.
	 */
	split() {
		const _ = this;
		_.#observer?.disconnect();
		_.#observer = null;
		_.#abortController?.abort();
		_.#abortController = null;
		_.#units = [];
		_.#lineCount = 0;
		_.#initialized = false;
		_.#revealed = false;
		_.removeAttribute('data-state');
		_.removeAttribute('data-revealed');

		const isWrapped = _.querySelector('.split-text-word, .split-text-char') !== null;
		if (isWrapped) {
			if (_.#originalHTML !== undefined) _.innerHTML = _.#originalHTML;
		} else {
			_.#originalHTML = _.innerHTML;
		}
		_.connectedCallback();
	}

	// Hand one split unit to the registered effect's perUnit hook, if it has one.
	// The hook stamps CSS custom properties the effect's keyframes read, so each
	// unit can start from its own randomized state — the one thing CSS can't do.
	#applyEffectVars(inner, index, total) {
		const perUnit = EFFECTS.get(this.#effect)?.perUnit;
		if (typeof perUnit !== 'function') return;
		try {
			perUnit(inner, index, total);
		} catch (error) {
			// A broken hook must not strand a half-split (and, in lines mode,
			// still-hidden) host — log and keep splitting.
			console.error(`split-text: perUnit hook for effect "${this.#effect}" threw`, error);
		}
	}

	// Run the perUnit hook across every unit once splitting has finished, so the
	// hook sees a correct `total`.
	#stampEffectVars() {
		const _ = this;
		if (typeof EFFECTS.get(_.#effect)?.perUnit !== 'function') return;
		const total = _.#units.length;
		for (let index = 0; index < total; index++) {
			_.#applyEffectVars(_.#units[index], index, total);
		}
	}

	// An effect registered after this instance upgraded: re-apply its easing and
	// re-stamp per-unit vars on units that already exist. No-op once revealed —
	// including the reduced-motion short-circuit, which marks revealed up front.
	#refreshEffect() {
		const _ = this;
		if (!_.#initialized || _.#revealed) return;
		_.#applyTimingProperties();
		_.#stampEffectVars();
	}

	#numericAttr(name, fallback) {
		const raw = this.getAttribute(name);
		if (raw === null) return fallback;
		const value = Number(raw);
		return Number.isFinite(value) && value >= 0 ? value : fallback;
	}

	#applyTimingProperties() {
		const _ = this;
		_.style.setProperty('--split-text-delay', `${_.#numericAttr('delay', DEFAULTS.delay)}ms`);
		_.style.setProperty('--split-text-stagger', `${_.#numericAttr('stagger', DEFAULTS.stagger)}ms`);
		_.style.setProperty(
			'--split-text-duration',
			`${_.#numericAttr('duration', DEFAULTS.duration)}ms`
		);
		const defaultEasing = EFFECTS.get(_.#effect)?.easing ?? DEFAULTS.easing;
		_.style.setProperty('--split-text-easing', _.getAttribute('easing') || defaultEasing);
	}

	#setupTrigger() {
		const _ = this;
		const trigger = _.getAttribute('trigger') || DEFAULTS.trigger;

		if (trigger === 'manual') return;

		if (trigger === 'load') {
			queueMicrotask(() => _.#reveal());
			return;
		}

		// Default: trigger="visible". Fire only when 100% of the element is
		// within the (possibly offset-shrunken) viewport — so users never see
		// the text animate while still partially below the fold.
		const observerOptions = { threshold: 1 };

		// `offset` shifts the trigger line up from the bottom of the viewport so
		// the text starts animating after the element has scrolled meaningfully
		// into view. Accepts a bare number (px), "Npx", or "N%" — other units
		// are ignored. Set "0" (or "0%"/"0px") to disable and fire on first
		// intersection. Defaults to "20%".
		const offsetAttr = _.getAttribute('offset');
		const offset = offsetAttr ?? DEFAULTS.offset;
		const match = offset.trim().match(/^(\d*\.?\d+)(px|%)?$/);
		if (match) {
			const value = parseFloat(match[1]);
			const isPercent = match[2] === '%';
			if (Number.isFinite(value) && value > 0) {
				observerOptions.rootMargin = isPercent
					? `0px 0px -${value}% 0px`
					: `0px 0px -${value}px 0px`;
			}
		}

		_.#observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					_.#observer?.disconnect();
					_.#observer = null;
					_.#reveal();
					break;
				}
			}
		}, observerOptions);
		_.#observer.observe(_);
	}

	async #reveal() {
		const _ = this;
		if (_.#revealed) return;
		// Bail if a queued microtask (trigger="load") fires after disconnect, or
		// if reveal() was called before connectedCallback set up the controller.
		if (!_.isConnected || !_.#abortController) return;
		const controller = _.#abortController;
		_.#revealed = true;

		// Lines mode splits lazily so it sees the actual rendered layout
		if (_.#splitMode === 'lines') {
			if (document.fonts?.ready) {
				try {
					await document.fonts.ready;
				} catch {
					// fonts API rejected — proceed with current layout
				}
			}
			// Disconnect or .split() during the await replaces/aborts the
			// controller — bail so we don't mutate stale or detached DOM.
			if (controller.signal.aborted || _.#abortController !== controller) return;
			_.#splitLines();
			_.#stampEffectVars();
		}

		if (_.#units.length === 0) {
			_.#markRevealed();
			return;
		}

		const count = _.#splitMode === 'lines' ? _.#lineCount : _.#units.length;

		_.dispatchEvent(
			new CustomEvent('split-text:start', {
				bubbles: true,
				detail: { split: _.#splitMode, count },
			})
		);

		// Listen for animationend on the unit with the highest --i so we know
		// when the entire reveal is done. Also listen for animationcancel and
		// a fallback timeout so author CSS that disables the animation can't
		// strand the host in `data-state="revealing"`.
		const lastUnit = _.#lastAnimatingUnit();
		if (lastUnit && _.#abortController) {
			const finish = (event) => {
				if (event && event.target !== lastUnit) return;
				_.#markRevealed();
			};
			lastUnit.addEventListener('animationend', finish, {
				once: true,
				signal: _.#abortController.signal,
			});
			lastUnit.addEventListener('animationcancel', finish, {
				once: true,
				signal: _.#abortController.signal,
			});

			// In lines mode, units share --i values per line — use line count so a
			// 100-word / 4-line paragraph doesn't wait for 100 stagger steps.
			const stepCount = _.#splitMode === 'lines' ? _.#lineCount : _.#units.length;
			const totalMs =
				_.#numericAttr('delay', DEFAULTS.delay) +
				_.#numericAttr('stagger', DEFAULTS.stagger) * Math.max(0, stepCount - 1) +
				_.#numericAttr('duration', DEFAULTS.duration) +
				100;
			const fallback = setTimeout(() => _.#markRevealed(), totalMs);
			_.#abortController.signal.addEventListener('abort', () => clearTimeout(fallback));
		}

		_.setAttribute('data-state', 'revealing');
	}

	#lastAnimatingUnit() {
		const _ = this;
		// In lines mode, several units share the same --i (one line = one delay).
		// Pick the last unit in document order with the highest --i so the
		// animationend listener fires after every unit has settled.
		let best = null;
		let bestIndex = -1;
		for (const unit of _.#units) {
			const value = Number(unit.style.getPropertyValue('--i')) || 0;
			if (value >= bestIndex) {
				bestIndex = value;
				best = unit;
			}
		}
		return best;
	}

	#markRevealed() {
		const _ = this;
		if (_.hasAttribute('data-revealed')) return;
		_.removeAttribute('data-state');
		_.setAttribute('data-revealed', '');
		const count = _.#splitMode === 'lines' ? _.#lineCount : _.#units.length;
		_.dispatchEvent(
			new CustomEvent('split-text:complete', {
				bubbles: true,
				detail: { split: _.#splitMode, count },
			})
		);
	}

	// Per ARIA spec, aria-hidden must not be on or contain focusable elements.
	// We add aria-hidden to generated word wrappers to prevent AT from
	// double-reading (host's aria-label already provides the accessible name),
	// but skip wrappers whose text sits inside any interactive ancestor —
	// either inside the host (links/buttons in the source) or outside it
	// (split-text wrapped in an <a>/<button>) — so we don't strip the
	// accessible name from those interactive elements.
	#isInsideInteractive(element) {
		if (!element) return false;
		const interactive = element.closest(
			'a[href], button, summary, label, input, select, textarea, [contenteditable=""], [contenteditable="true"], [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="tab"], [tabindex]:not([tabindex="-1"])'
		);
		return Boolean(interactive) && interactive !== this;
	}

	#collectTextNodes() {
		const _ = this;
		const nodes = [];
		const walker = document.createTreeWalker(_, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) =>
				node.nodeValue && node.nodeValue.trim()
					? NodeFilter.FILTER_ACCEPT
					: NodeFilter.FILTER_REJECT,
		});
		let node;
		while ((node = walker.nextNode())) nodes.push(node);
		return nodes;
	}

	#splitWords() {
		const _ = this;
		const wordRegex = /\S+/g;
		let index = 0;

		for (const textNode of _.#collectTextNodes()) {
			const text = textNode.nodeValue;
			const insideInteractive = _.#isInsideInteractive(textNode.parentElement);
			const fragment = document.createDocumentFragment();
			let cursor = 0;
			let match;
			wordRegex.lastIndex = 0;
			while ((match = wordRegex.exec(text)) !== null) {
				if (match.index > cursor) {
					fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
				}
				fragment.appendChild(_.#wrapWord(match[0], index++, insideInteractive));
				cursor = match.index + match[0].length;
			}
			if (cursor < text.length) {
				fragment.appendChild(document.createTextNode(text.slice(cursor)));
			}
			textNode.parentNode.replaceChild(fragment, textNode);
		}
	}

	#wrapWord(text, index, insideInteractive) {
		const _ = this;
		const outer = document.createElement('span');
		outer.className = 'split-text-word';
		if (!insideInteractive) outer.setAttribute('aria-hidden', 'true');
		const inner = document.createElement('span');
		inner.className = 'split-text-word-inner';
		inner.style.setProperty('--i', index);
		inner.textContent = text;
		outer.appendChild(inner);
		_.#units.push(inner);
		return outer;
	}

	#splitChars() {
		const _ = this;
		const segmenter =
			typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
				? new Intl.Segmenter(navigator.language || 'en', { granularity: 'grapheme' })
				: null;

		const wordRegex = /\S+/g;
		let index = 0;

		for (const textNode of _.#collectTextNodes()) {
			const text = textNode.nodeValue;
			const insideInteractive = _.#isInsideInteractive(textNode.parentElement);
			const fragment = document.createDocumentFragment();
			let cursor = 0;
			let match;
			wordRegex.lastIndex = 0;
			while ((match = wordRegex.exec(text)) !== null) {
				if (match.index > cursor) {
					fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
				}

				const wordOuter = document.createElement('span');
				wordOuter.className = 'split-text-word';
				if (!insideInteractive) wordOuter.setAttribute('aria-hidden', 'true');

				const graphemes = segmenter
					? Array.from(segmenter.segment(match[0]), (s) => s.segment)
					: Array.from(match[0]);

				for (const grapheme of graphemes) {
					const charOuter = document.createElement('span');
					charOuter.className = 'split-text-char';
					const charInner = document.createElement('span');
					charInner.className = 'split-text-char-inner';
					charInner.style.setProperty('--i', index++);
					charInner.textContent = grapheme;
					charOuter.appendChild(charInner);
					wordOuter.appendChild(charOuter);
					_.#units.push(charInner);
				}

				fragment.appendChild(wordOuter);
				cursor = match.index + match[0].length;
			}
			if (cursor < text.length) {
				fragment.appendChild(document.createTextNode(text.slice(cursor)));
			}
			textNode.parentNode.replaceChild(fragment, textNode);
		}
	}

	#splitLines() {
		const _ = this;
		_.#units = [];
		_.#lineCount = 0;
		_.#splitWords();

		const wordSpans = Array.from(_.querySelectorAll('.split-text-word'));
		if (wordSpans.length === 0) return;

		// <br> in source HTML forces a new line group regardless of measured top
		const breakBefore = new Set();
		const elementWalker = document.createTreeWalker(_, NodeFilter.SHOW_ELEMENT);
		let pendingBreak = false;
		let elementNode;
		while ((elementNode = elementWalker.nextNode())) {
			if (elementNode.tagName === 'BR') {
				pendingBreak = true;
			} else if (elementNode.classList.contains('split-text-word')) {
				if (pendingBreak) breakBefore.add(elementNode);
				pendingBreak = false;
			}
		}

		const lineHeightPx = parseFloat(getComputedStyle(_).lineHeight);
		const tolerance = (Number.isFinite(lineHeightPx) ? lineHeightPx : 16) / 2;

		// Group consecutive words by their bounding rect top, then assign every
		// word in a group the same --i (line index) so they animate together.
		// Keeping words in their original DOM positions preserves nested inline
		// markup (<em>, <strong>, <a>) — we never reparent.
		let lineIndex = 0;
		let currentTop = null;
		const newUnits = [];
		for (const span of wordSpans) {
			const top = span.getBoundingClientRect().top;
			if (currentTop === null) {
				currentTop = top;
			} else if (breakBefore.has(span) || Math.abs(top - currentTop) > tolerance) {
				lineIndex++;
				currentTop = top;
			}
			const inner = span.querySelector('.split-text-word-inner');
			if (inner) {
				inner.style.setProperty('--i', lineIndex);
				newUnits.push(inner);
			}
		}
		_.#units = newUnits;
		_.#lineCount = newUnits.length === 0 ? 0 : lineIndex + 1;
	}
}

// The one built-in effect that needs more than CSS, registered through the same
// public API a consumer would use. Each piece starts shifted right by a random
// distance (20–110px) at a random height (±100px) — CSS can't randomize — and
// defaults to an ease-in curve so it drifts, then snaps home like a filing to a
// magnet. The rest of the effect (resting state, keyframes, the unclipped
// wrapper) lives in split-text.css alongside every other built-in.
SplitText.registerEffect('magnetic', {
	easing: 'cubic-bezier(0.5, 0, 1, 1)',
	perUnit(inner) {
		const x = 20 + Math.random() * 90;
		const y = Math.random() * 200 - 100;
		inner.style.setProperty('--split-text-mx', `${x.toFixed(1)}px`);
		inner.style.setProperty('--split-text-my', `${y.toFixed(1)}px`);
	},
});

// Guarded so the module stays importable under Node (SSG / SSR consumers).
if (typeof customElements !== 'undefined' && !customElements.get('split-text')) {
	customElements.define('split-text', SplitText);
}

export { SplitText };
