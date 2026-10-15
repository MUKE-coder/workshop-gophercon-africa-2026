// The two-country face-off: searchable country pickers, a swap button,
// a little celebration for the winner, and the visitor's saved comparisons.
(() => {
	const form = document.querySelector("[data-versus-form]");
	if (!form) return;

	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const flagURL = (code) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
	const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

	// Searchable pickers ------------------------------------------------------
	//
	// Each <select> stays in the form (it's what gets submitted) but is hidden
	// behind a text box that filters the countries as you type.

	let uid = 0;
	form.querySelectorAll("select[data-combobox]").forEach((select) => {
		const id = `combo-${++uid}`;
		const options = [...select.options].map((o) => ({ value: o.value, label: o.textContent.trim(), count: +o.dataset.count || 0 }));

		const wrap = document.createElement("div");
		wrap.className = "combo";
		const flag = document.createElement("img");
		flag.className = "combo__flag";
		flag.alt = "";
		flag.width = 28;
		flag.height = 21;
		flag.addEventListener("error", () => (flag.style.visibility = "hidden"));
		flag.addEventListener("load", () => (flag.style.visibility = ""));

		const input = document.createElement("input");
		input.type = "text";
		input.className = "combo__input";
		input.autocomplete = "off";
		input.spellcheck = false;
		input.placeholder = "Search a country";
		input.setAttribute("role", "combobox");
		input.setAttribute("aria-expanded", "false");
		input.setAttribute("aria-controls", id);
		input.setAttribute("aria-autocomplete", "list");

		const chevron = document.createElement("span");
		chevron.className = "combo__chevron";
		chevron.setAttribute("aria-hidden", "true");

		const list = document.createElement("ul");
		list.className = "combo__list";
		list.id = id;
		list.setAttribute("role", "listbox");
		list.hidden = true;

		wrap.append(flag, input, chevron, list);
		select.after(wrap);
		select.hidden = true;
		select.tabIndex = -1;

		let shown = [];
		let active = -1;

		const current = () => options.find((o) => o.value === select.value);
		const showCurrent = () => {
			const o = current();
			input.value = o ? o.label : "";
			if (o) flag.src = flagURL(o.value);
		};

		const render = () => {
			const q = fold(input.value.trim());
			const sel = current();
			// Show everything when the box still holds the chosen country.
			shown = !q || (sel && fold(sel.label) === q) ? options : options.filter((o) => fold(o.label).includes(q) || o.value.toLowerCase() === q);
			list.replaceChildren();
			if (!shown.length) {
				const li = document.createElement("li");
				li.className = "combo__empty";
				li.textContent = "No country matches. Try another spelling.";
				list.append(li);
				return;
			}
			shown.forEach((o, i) => {
				const li = document.createElement("li");
				li.id = `${id}-${i}`;
				li.className = "combo__option";
				li.setAttribute("role", "option");
				li.setAttribute("aria-selected", String(o.value === select.value));
				const img = document.createElement("img");
				img.src = flagURL(o.value);
				img.alt = "";
				img.loading = "lazy";
				img.width = 24;
				img.height = 18;
				img.addEventListener("error", () => (img.style.visibility = "hidden"));
				const name = document.createElement("span");
				name.textContent = o.label;
				const count = document.createElement("small");
				count.textContent = `${o.count} ${o.count === 1 ? "sighting" : "sightings"}`;
				li.append(img, name, count);
				li.addEventListener("mousedown", (e) => {
					e.preventDefault();
					choose(o);
				});
				list.append(li);
			});
			highlight(Math.max(0, shown.findIndex((o) => o.value === select.value)));
		};

		const highlight = (i) => {
			const items = list.querySelectorAll(".combo__option");
			items.forEach((el) => el.classList.remove("is-active"));
			active = Math.min(Math.max(i, 0), items.length - 1);
			const el = items[active];
			if (!el) return;
			el.classList.add("is-active");
			input.setAttribute("aria-activedescendant", el.id);
			el.scrollIntoView({ block: "nearest" });
		};

		const open = () => {
			if (!list.hidden) return;
			list.hidden = false;
			wrap.classList.add("is-open");
			input.setAttribute("aria-expanded", "true");
			render();
			if (window.gsap && !reduceMotion) gsap.fromTo(list, { y: -8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: "power2.out" });
		};

		const close = () => {
			list.hidden = true;
			wrap.classList.remove("is-open");
			input.setAttribute("aria-expanded", "false");
			input.removeAttribute("aria-activedescendant");
			showCurrent();
		};

		const choose = (o) => {
			select.value = o.value;
			close();
			select.dispatchEvent(new Event("change", { bubbles: true }));
		};

		input.addEventListener("focus", () => {
			open();
			input.select();
		});
		input.addEventListener("click", open);
		input.addEventListener("input", () => {
			open();
			render();
		});
		input.addEventListener("blur", close);
		input.addEventListener("keydown", (e) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				open();
				highlight(active + 1);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				highlight(active - 1);
			} else if (e.key === "Enter") {
				if (!list.hidden && shown[active]) {
					e.preventDefault();
					choose(shown[active]);
				}
			} else if (e.key === "Escape") {
				close();
			}
		});
		select.addEventListener("tazama:sync", showCurrent);

		showCurrent();
	});

	// Swap -------------------------------------------------------------------

	form.querySelector("[data-swap]")?.addEventListener("click", (e) => {
		const [a, b] = form.querySelectorAll("select[data-combobox]");
		if (!a || !b) return;
		[a.value, b.value] = [b.value, a.value];
		a.dispatchEvent(new Event("tazama:sync"));
		b.dispatchEvent(new Event("tazama:sync"));
		if (window.gsap && !reduceMotion) gsap.fromTo(e.currentTarget, { rotate: 0 }, { rotate: 180, duration: 0.5, ease: "back.out(2)" });
	});

	// Saved comparisons --------------------------------------------------------
	//
	// Kept in this browser only, so a visitor can come back to the match-ups
	// they ran. Only comparisons the visitor chose are saved, not the default.

	const KEY = "tazama-comparisons";
	const load = () => {
		try {
			const v = JSON.parse(localStorage.getItem(KEY) || "[]");
			return Array.isArray(v) ? v : [];
		} catch (e) {
			return [];
		}
	};
	const store = (items) => {
		try {
			localStorage.setItem(KEY, JSON.stringify(items));
		} catch (e) {}
	};

	const versus = document.querySelector("[data-versus]");
	const params = new URLSearchParams(location.search);
	if (versus && params.get("a") && params.get("b")) {
		const entry = {
			a: versus.dataset.a,
			b: versus.dataset.b,
			aName: versus.dataset.aName,
			bName: versus.dataset.bName,
			winner: versus.dataset.winner || "",
			at: Date.now(),
		};
		const same = (x) => (x.a === entry.a && x.b === entry.b) || (x.a === entry.b && x.b === entry.a);
		store([entry, ...load().filter((x) => !same(x))].slice(0, 8));
	}

	const saved = document.querySelector("[data-saved]");
	const savedList = document.querySelector("[data-saved-list]");
	const renderSaved = () => {
		if (!saved || !savedList) return;
		const items = load();
		saved.hidden = items.length === 0;
		savedList.replaceChildren();
		items.forEach((it, i) => {
			const li = document.createElement("li");
			li.className = "saved__item";
			const link = document.createElement("a");
			link.href = `/?a=${encodeURIComponent(it.a)}&b=${encodeURIComponent(it.b)}#compare`;
			const title = document.createElement("strong");
			title.textContent = `${it.aName} vs ${it.bName}`;
			const note = document.createElement("small");
			const when = new Date(it.at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
			note.textContent = it.winner ? `${it.winner} won, ${when}` : `A draw, ${when}`;
			link.append(title, note);
			const remove = document.createElement("button");
			remove.type = "button";
			remove.className = "saved__remove";
			remove.setAttribute("aria-label", `Remove ${it.aName} vs ${it.bName}`);
			remove.textContent = "×";
			remove.addEventListener("click", () => {
				const next = load();
				next.splice(i, 1);
				store(next);
				renderSaved();
			});
			li.append(link, remove);
			savedList.append(li);
		});
	};
	document.querySelector("[data-saved-clear]")?.addEventListener("click", () => {
		store([]);
		renderSaved();
	});
	renderSaved();

	// Animals in common ------------------------------------------------------------
	//
	// Tapping one opens its head-to-head card and lights up its row in both
	// columns. Tapping it again, or another, closes it.

	const chips = [...document.querySelectorAll("[data-shared-chip]")];
	const close = () => {
		chips.forEach((c) => c.setAttribute("aria-expanded", "false"));
		document.querySelectorAll("[data-shared-card]").forEach((card) => (card.hidden = true));
		document.querySelectorAll(".side__row.is-picked").forEach((r) => r.classList.remove("is-picked"));
	};
	chips.forEach((chip) => {
		chip.addEventListener("click", () => {
			const open = chip.getAttribute("aria-expanded") === "true";
			close();
			if (open) return;

			chip.setAttribute("aria-expanded", "true");
			const card = document.querySelector(`[data-shared-card="${chip.dataset.sharedChip}"]`);
			if (card) {
				card.hidden = false;
				if (window.gsap && !reduceMotion) {
					gsap.fromTo(card, { y: -10, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" });
					gsap.from(card.querySelectorAll(".tug span"), { flexGrow: 0.001, duration: 0.9, ease: "power3.out", delay: 0.1 });
				}
			}
			document.querySelectorAll(".side__name[data-name]").forEach((el) => {
				if (el.dataset.name === chip.dataset.name) el.closest(".side__row")?.classList.add("is-picked");
			});
		});
	});
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && chips.some((c) => c.getAttribute("aria-expanded") === "true")) close();
	});

	// The winner's moment ------------------------------------------------------

	const verdict = document.querySelector("[data-verdict]");
	if (!verdict || !window.gsap || reduceMotion) return;

	const celebrate = () => {
		gsap.from(verdict, { scale: 0.85, opacity: 0, duration: 0.7, ease: "back.out(1.8)" });
		gsap.from(".rounds tbody tr", { y: 14, opacity: 0, duration: 0.5, stagger: 0.12, delay: 0.3, ease: "power3.out" });
		gsap.from(".side--winner .side__crown", { y: -30, rotate: -20, opacity: 0, duration: 0.8, delay: 0.6, ease: "bounce.out" });
		if (!versus?.dataset.winner) return;

		// A burst of confetti from the trophy.
		const r = verdict.querySelector(".verdict__trophy").getBoundingClientRect();
		const colours = ["#d4f06a", "#ffffff", "#9fd18a", "#f5c542"];
		for (let i = 0; i < 46; i++) {
			const bit = document.createElement("span");
			bit.className = "confetti";
			bit.style.left = r.left + r.width / 2 + "px";
			bit.style.top = r.top + r.height / 2 + "px";
			bit.style.background = colours[i % colours.length];
			document.body.append(bit);
			const angle = Math.random() * Math.PI * 2;
			const dist = 80 + Math.random() * 220;
			gsap.timeline({ onComplete: () => bit.remove() })
				.to(bit, { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 60, rotate: Math.random() * 720, duration: 0.9, ease: "power3.out" })
				.to(bit, { y: "+=160", opacity: 0, duration: 1.1, ease: "power1.in" });
		}
	};

	new IntersectionObserver(
		(entries, obs) => {
			if (entries[0].isIntersecting) {
				obs.disconnect();
				celebrate();
			}
		},
		{ threshold: 0.4 },
	).observe(verdict);
})();
