import './split-text.css';

const DEFAULTS = {
	split: 'words',
	delay: 0,
	stagger: 30,
	duration: 800,
	easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
	trigger: 'visible',
	threshold: 0.1,
};

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
 *   threshold — IntersectionObserver threshold, 0–1 (default 0.1)
 */
class SplitText extends HTMLElement {
	#originalHTML;
	#abortController;
	#observer;
	#initialized = false;
	#revealed = false;
	#splitMode;
	#units = [];
	#lineCount = 0;

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

			_.#splitMode = _.getAttribute('split') || DEFAULTS.split;

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
		_.style.setProperty('--split-text-easing', _.getAttribute('easing') || DEFAULTS.easing);
	}

	#setupTrigger() {
		const _ = this;
		const trigger = _.getAttribute('trigger') || DEFAULTS.trigger;

		if (trigger === 'manual') return;

		if (trigger === 'load') {
			queueMicrotask(() => _.#reveal());
			return;
		}

		// Default: trigger="visible"
		const threshold = Math.min(1, Math.max(0, _.#numericAttr('threshold', DEFAULTS.threshold)));
		_.#observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						_.#observer?.disconnect();
						_.#observer = null;
						_.#reveal();
						break;
					}
				}
			},
			{ threshold }
		);
		_.#observer.observe(_);
	}

	async #reveal() {
		const _ = this;
		if (_.#revealed) return;
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
			_.#splitLines();
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

			const totalMs =
				_.#numericAttr('delay', DEFAULTS.delay) +
				_.#numericAttr('stagger', DEFAULTS.stagger) * Math.max(0, _.#units.length - 1) +
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
			const fragment = document.createDocumentFragment();
			let cursor = 0;
			let match;
			wordRegex.lastIndex = 0;
			while ((match = wordRegex.exec(text)) !== null) {
				if (match.index > cursor) {
					fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
				}
				fragment.appendChild(_.#wrapWord(match[0], index++));
				cursor = match.index + match[0].length;
			}
			if (cursor < text.length) {
				fragment.appendChild(document.createTextNode(text.slice(cursor)));
			}
			textNode.parentNode.replaceChild(fragment, textNode);
		}
	}

	#wrapWord(text, index) {
		const _ = this;
		const outer = document.createElement('span');
		outer.className = 'split-text-word';
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

if (!customElements.get('split-text')) {
	customElements.define('split-text', SplitText);
}

export { SplitText };
