// Leaflet maps: the big map of every sighting, and the small one on a
// sighting's page. Map tiles need the internet; everything else is local.
(() => {
	if (!window.L) return;

	L.Icon.Default.imagePath = "/assets/vendor/leaflet/images/";

	const tiles = () =>
		L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		});

	const pin = (hue) =>
		L.divIcon({ className: "", html: `<div class="pin pin--${hue}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });

	const popup = (p) => {
		const el = document.createElement("div");
		el.className = "popup";
		if (p.img) {
			const img = document.createElement("img");
			img.src = p.img;
			img.alt = p.name;
			img.loading = "lazy";
			el.append(img);
		}
		const body = document.createElement("div");
		body.className = "popup__body";
		const name = document.createElement("strong");
		name.textContent = p.name;
		const meta = document.createElement("span");
		meta.textContent = `${p.place}, ${p.date}`;
		const link = document.createElement("a");
		link.href = "/sightings/" + p.id;
		link.textContent = "Open sighting";
		body.append(name, meta, link);
		el.append(body);
		return el;
	};

	// Big map ----------------------------------------------------------------

	const big = document.querySelector("[data-bigmap]");
	const dataEl = document.getElementById("map-points");
	if (big && dataEl) {
		const points = JSON.parse(dataEl.textContent || "[]");
		const map = L.map(big, { worldCopyJump: true, minZoom: 2 }).setView([0, 37], 3);
		tiles().addTo(map);

		const group = L.markerClusterGroup
			? L.markerClusterGroup({
					showCoverageOnHover: false,
					maxClusterRadius: 50,
					iconCreateFunction: (cluster) => {
						const n = cluster.getChildCount();
						const size = n < 10 ? 34 : n < 50 ? 42 : 52;
						return L.divIcon({ className: "", html: `<div class="cluster">${n}</div>`, iconSize: [size, size] });
					},
				})
			: L.layerGroup();

		points.forEach((p) => {
			L.marker([p.lat, p.lng], { icon: pin(p.hue), title: p.name }).bindPopup(() => popup(p)).addTo(group);
		});
		map.addLayer(group);
		if (points.length) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [30, 30] });
	}

	// Tips ---------------------------------------------------------------------
	//
	// Shown on a first visit, then tucked behind the "How to use the map"
	// button. Remembered in this browser.

	const tips = document.querySelector("[data-tips]");
	if (tips) {
		const KEY = "tazama-map-tips-seen";
		const opener = document.querySelector("[data-tips-open]");
		const setOpen = (on) => {
			tips.classList.toggle("is-open", on);
			tips.setAttribute("aria-hidden", String(!on));
			opener?.setAttribute("aria-expanded", String(on));
			if (on) tips.querySelector("[data-tips-close]")?.focus({ preventScroll: true });
		};
		let seen = false;
		try {
			seen = localStorage.getItem(KEY) === "1";
		} catch (e) {}
		setOpen(!seen);
		tips.querySelectorAll("[data-tips-close]").forEach((b) =>
			b.addEventListener("click", () => {
				setOpen(false);
				try {
					localStorage.setItem(KEY, "1");
				} catch (e) {}
				opener?.focus({ preventScroll: true });
			}),
		);
		opener?.addEventListener("click", () => setOpen(!tips.classList.contains("is-open")));
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && tips.classList.contains("is-open")) setOpen(false);
		});
	}

	// Mini map --------------------------------------------------------------

	document.querySelectorAll("[data-minimap]").forEach((el) => {
		const lat = parseFloat(el.dataset.lat);
		const lng = parseFloat(el.dataset.lng);
		if (Number.isNaN(lat) || Number.isNaN(lng)) return;
		const map = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView([lat, lng], 7);
		tiles().addTo(map);
		L.marker([lat, lng], { icon: pin(el.dataset.hue || "marigold") }).addTo(map);
	});
})();
