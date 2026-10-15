// Tazama: theme, lightbox, page transitions and the GSAP motion.
(() => {
	const root = document.documentElement;
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const finePointer = window.matchMedia("(pointer: fine)").matches;

	// Theme ------------------------------------------------------------------

	const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
	const currentTheme = () => root.dataset.theme || (prefersDark() ? "dark" : "light");

	document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const next = currentTheme() === "dark" ? "light" : "dark";
			const apply = () => {
				root.dataset.theme = next;
				try {
					localStorage.setItem("tazama-theme", next);
				} catch (e) {}
				document.dispatchEvent(new CustomEvent("tazama:theme", { detail: next }));
			};
			// Where supported, the new theme spreads out from the button.
			if (!document.startViewTransition || reduceMotion) return apply();
			const r = btn.getBoundingClientRect();
			rememberClick(r.left + r.width / 2, r.top + r.height / 2);
			const vt = document.startViewTransition(apply);
			vt.ready.then(() => revealFrom(popClick()));
		});
	});

	// Page transitions -------------------------------------------------------
	//
	// Browsers with cross-page view transitions get them from the CSS and the
	// pagereveal script in layout.templ: we only remember where the click was.
	// Others get the same burst, drawn with GSAP.

	function rememberClick(x, y) {
		try {
			sessionStorage.setItem("tazama-click", JSON.stringify({ x, y }));
		} catch (e) {}
	}

	function popClick() {
		try {
			const p = JSON.parse(sessionStorage.getItem("tazama-click") || "null");
			sessionStorage.removeItem("tazama-click");
			return p;
		} catch (e) {
			return null;
		}
	}

	function revealFrom(p) {
		const x = p ? p.x : innerWidth / 2;
		const y = p ? p.y : innerHeight / 2;
		const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
		root.animate(
			{ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
			{ duration: 650, easing: "cubic-bezier(0.7, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
		);
	}

	const isPageLink = (a, e) =>
		a &&
		a.origin === location.origin &&
		!a.hasAttribute("download") &&
		a.target !== "_blank" &&
		!e.metaKey &&
		!e.ctrlKey &&
		!e.shiftKey &&
		!e.altKey &&
		e.button === 0 &&
		!(a.pathname === location.pathname && a.hash) &&
		!a.closest("[data-lightbox]");

	const nativeTransitions = "onpagereveal" in window;

	document.addEventListener("click", (e) => {
		const a = e.target.closest("a[href]");
		if (!isPageLink(a, e)) return;
		rememberClick(e.clientX, e.clientY);
		if (nativeTransitions || reduceMotion || !window.gsap) return;

		e.preventDefault();
		const burst = document.createElement("div");
		burst.className = "burst";
		burst.style.left = e.clientX + "px";
		burst.style.top = e.clientY + "px";
		document.body.append(burst);
		const scale = (Math.hypot(innerWidth, innerHeight) / 20) * 1.1;
		gsap.to(burst, {
			scale,
			duration: 0.55,
			ease: "power3.in",
			onComplete: () => {
				try {
					sessionStorage.setItem("tazama-curtain", "1");
				} catch (err) {}
				location.href = a.href;
			},
		});
	});

	// Arriving after a fallback burst: lift the curtain from the click point.
	if (!nativeTransitions && window.gsap && !reduceMotion) {
		let curtain = false;
		try {
			curtain = sessionStorage.getItem("tazama-curtain") === "1";
			sessionStorage.removeItem("tazama-curtain");
		} catch (e) {}
		if (curtain) {
			const p = popClick() || { x: innerWidth / 2, y: innerHeight / 2 };
			const el = document.createElement("div");
			el.className = "curtain";
			document.body.append(el);
			const r = Math.hypot(innerWidth, innerHeight);
			gsap.fromTo(
				el,
				{ clipPath: `circle(${r}px at ${p.x}px ${p.y}px)` },
				{ clipPath: `circle(0px at ${p.x}px ${p.y}px)`, duration: 0.7, ease: "power3.inOut", onComplete: () => el.remove() },
			);
		}
	}

	// Lightbox -----------------------------------------------------------------

	const dialog = document.querySelector("[data-lightbox-dialog]");
	if (dialog) {
		const img = dialog.querySelector("img");
		const caption = dialog.querySelector("figcaption");
		let items = [];
		let index = 0;
		let opener = null;

		const show = (i) => {
			index = (i + items.length) % items.length;
			const link = items[index];
			img.src = link.href;
			img.alt = link.querySelector("img")?.alt || "";
			caption.textContent = link.dataset.credit || "";
			dialog.querySelectorAll(".lightbox__nav").forEach((b) => (b.hidden = items.length < 2));
		};

		const open = (links, i, from) => {
			items = links;
			opener = from;
			show(i);
			dialog.hidden = false;
			document.body.style.overflow = "hidden";
			dialog.querySelector(".lightbox__close").focus();
			if (window.gsap && !reduceMotion) {
				gsap.fromTo(img, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "power3.out" });
			}
		};

		const close = () => {
			dialog.hidden = true;
			document.body.style.overflow = "";
			img.removeAttribute("src");
			opener?.focus();
		};

		document.querySelectorAll("[data-lightbox]").forEach((gallery) => {
			const links = [...gallery.querySelectorAll(".gallery__open")];
			links.forEach((link, i) =>
				link.addEventListener("click", (e) => {
					e.preventDefault();
					open(links, i, link);
				}),
			);
		});

		dialog.querySelector(".lightbox__close").addEventListener("click", close);
		dialog.querySelector(".lightbox__nav--prev").addEventListener("click", () => show(index - 1));
		dialog.querySelector(".lightbox__nav--next").addEventListener("click", () => show(index + 1));
		dialog.addEventListener("click", (e) => {
			if (e.target === dialog) close();
		});
		document.addEventListener("keydown", (e) => {
			if (dialog.hidden) return;
			if (e.key === "Escape") close();
			if (e.key === "ArrowLeft") show(index - 1);
			if (e.key === "ArrowRight") show(index + 1);
		});
	}

	// Motion -------------------------------------------------------------------

	if (!window.gsap || reduceMotion) return;
	if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

	// Hero: the headline rises line by line, the photo melts in from the
	// right, then the floating cards drift into place.
	if (document.querySelector(".hero")) {
		gsap.timeline({ defaults: { ease: "power4.out" } })
			.from(".hero .badge", { y: 12, opacity: 0, duration: 0.7 }, 0)
			.from(".hero__title .line__inner", { yPercent: 105, duration: 1.1, stagger: 0.12 }, 0.1)
			.from(".hero__lede", { y: 16, opacity: 0, filter: "blur(6px)", duration: 0.9 }, 0.45)
			.from(".hero__actions > *", { y: 16, opacity: 0, duration: 0.8, stagger: 0.08 }, 0.55)
			.from(".stat", { y: 24, opacity: 0, duration: 0.8, stagger: 0.07 }, 0.65)
			.from(".hero__scene", { xPercent: 8, opacity: 0, duration: 1.6, ease: "power2.out" }, 0.1)
			.from(".floater", { x: 60, opacity: 0, duration: 1, stagger: 0.12 }, 0.8)
			.add(() => {
				// Then they bob gently, each on its own rhythm.
				document.querySelectorAll(".floater").forEach((el, i) => {
					gsap.to(el, { y: i % 2 ? 8 : -8, duration: 3 + i * 0.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
				});
			});
	}

	// Hero slideshow: crossfade between photos, each one drifting slowly so
	// the scene feels alive rather than frozen.
	const slides = [...document.querySelectorAll("[data-slide]")];
	if (slides.length) {
		let current = 0;
		const drift = (slide) => {
			const img = slide.querySelector("img");
			const dir = Math.random() > 0.5 ? 1 : -1;
			gsap.fromTo(img, { scale: 1.16, xPercent: 3 * dir, yPercent: 2 }, { scale: 1.02, xPercent: -2 * dir, yPercent: -1, duration: 9, ease: "none" });
		};
		drift(slides[0]);
		if (slides.length > 1) {
			setInterval(() => {
				if (document.hidden) return;
				slides[current].classList.remove("is-active");
				current = (current + 1) % slides.length;
				slides[current].classList.add("is-active");
				drift(slides[current]);
			}, 6000);
		}
	}

	// Living photo on a sighting's page: a slow breath in and out, starting
	// once the photo has finished flying in from its card.
	document.querySelectorAll("[data-living]").forEach((img) => {
		gsap.to(img, { scale: 1.07, duration: 12, delay: 0.9, ease: "sine.inOut", yoyo: true, repeat: -1 });
	});

	// Cards: tilt towards the pointer, with the photo sliding the other way
	// inside its frame, so each one reads like a window onto the scene.
	if (finePointer) {
		document.querySelectorAll(".card__photo").forEach((frame) => {
			const img = frame.querySelector("img");
			gsap.set(frame, { transformPerspective: 900 });
			const rx = gsap.quickTo(frame, "rotationX", { duration: 0.6, ease: "power3.out" });
			const ry = gsap.quickTo(frame, "rotationY", { duration: 0.6, ease: "power3.out" });
			const ix = img && gsap.quickTo(img, "xPercent", { duration: 0.8, ease: "power3.out" });
			const iy = img && gsap.quickTo(img, "yPercent", { duration: 0.8, ease: "power3.out" });
			frame.addEventListener("pointermove", (e) => {
				const r = frame.getBoundingClientRect();
				const px = (e.clientX - r.left) / r.width - 0.5;
				const py = (e.clientY - r.top) / r.height - 0.5;
				rx(-py * 8);
				ry(px * 8);
				ix?.(-px * 5);
				iy?.(-py * 5);
			});
			frame.addEventListener("pointerleave", () => {
				rx(0);
				ry(0);
				ix?.(0);
				iy?.(0);
			});
		});
	}

	if (window.ScrollTrigger) {
		// Cards rise into view in small batches as you scroll.
		ScrollTrigger.batch(".grid > li", {
			start: "top 92%",
			once: true,
			onEnter: (els) => gsap.from(els, { y: 50, opacity: 0, duration: 0.9, stagger: 0.08, ease: "power3.out" }),
		});

		// Bars grow when they scroll into view, so the comparison reads as a race.
		document.querySelectorAll(".chart").forEach((chart) => {
			const bars = chart.querySelectorAll(".bar__fill");
			const cols = chart.querySelectorAll(".column__fill");
			const trigger = { trigger: chart, start: "top 80%", once: true };
			if (bars.length) gsap.from(bars, { width: 0, duration: 1.1, stagger: 0.06, ease: "power3.out", scrollTrigger: trigger });
			if (cols.length) gsap.from(cols, { scaleY: 0, duration: 1, stagger: 0.05, ease: "power3.out", scrollTrigger: trigger });
		});

		// The face-off: rows slide in from each side, bars grow, and the
		// shared count ticks up.
		const versus = document.querySelector("[data-versus]");
		if (versus) {
			const trigger = { trigger: versus, start: "top 75%", once: true };
			gsap.from(".side--left .side__row", { x: -40, opacity: 0, duration: 0.7, stagger: 0.05, ease: "power3.out", scrollTrigger: trigger });
			gsap.from(".side--right .side__row", { x: 40, opacity: 0, duration: 0.7, stagger: 0.05, ease: "power3.out", scrollTrigger: trigger });
			gsap.from(".side__bar span", { width: 0, duration: 1.1, stagger: 0.04, ease: "power3.out", scrollTrigger: trigger });
			gsap.from(".chip", { scale: 0.6, opacity: 0, duration: 0.5, stagger: 0.04, ease: "back.out(2)", scrollTrigger: trigger });
			const count = versus.querySelector(".versus__shared-count strong");
			if (count) {
				const n = { v: 0 };
				const end = parseInt(count.textContent, 10) || 0;
				gsap.to(n, { v: end, duration: 1.2, ease: "power2.out", scrollTrigger: trigger, onUpdate: () => (count.textContent = Math.round(n.v)) });
			}
		}
	}
})();
