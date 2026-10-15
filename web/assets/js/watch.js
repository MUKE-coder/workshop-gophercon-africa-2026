// "Watch it move": finds free videos of the species on Wikimedia Commons
// and plays them on the sighting's page. Nothing here comes from our own
// data, so every value is treated as text.
(() => {
	const section = document.querySelector("[data-watch]");
	if (!section) return;

	const player = section.querySelector("[data-watch-player]");
	const status = section.querySelector("[data-watch-status]");
	const list = section.querySelector("[data-watch-list]");
	const scientific = section.dataset.scientific || "";
	const name = section.dataset.name || "";

	const API = "https://commons.wikimedia.org/w/api.php";

	const search = async (query) => {
		const params = new URLSearchParams({
			action: "query",
			generator: "search",
			gsrsearch: `filetype:video ${query}`,
			gsrnamespace: "6",
			gsrlimit: "6",
			prop: "imageinfo",
			iiprop: "url|mime|extmetadata",
			iiurlwidth: "960",
			iiextmetadatafilter: "Artist|LicenseShortName",
			format: "json",
			origin: "*",
		});
		const res = await fetch(`${API}?${params}`);
		if (!res.ok) throw new Error(`commons: ${res.status}`);
		const data = await res.json();
		return Object.values(data.query?.pages || {})
			.sort((a, b) => (a.index || 0) - (b.index || 0))
			.map((p) => {
				const info = p.imageinfo?.[0] || {};
				const meta = info.extmetadata || {};
				return {
					title: p.title.replace(/^File:/, "").replace(/\.(webm|ogv|ogg|mp4)$/i, ""),
					src: info.url,
					mime: info.mime || "",
					poster: info.thumburl,
					page: info.descriptionurl,
					artist: textOnly(meta.Artist?.value || ""),
					licence: textOnly(meta.LicenseShortName?.value || ""),
				};
			})
			.filter((v) => v.src && v.mime.startsWith("video/"));
	};

	// Artist names come back as HTML; keep only the words.
	function textOnly(html) {
		return new DOMParser().parseFromString(html, "text/html").body.textContent.trim().replace(/\s+/g, " ");
	}

	const play = (v, items) => {
		player.replaceChildren();
		const video = document.createElement("video");
		video.controls = true;
		video.muted = true;
		video.loop = true;
		video.playsInline = true;
		video.preload = "metadata";
		if (v.poster) video.poster = v.poster;
		const source = document.createElement("source");
		source.src = v.src;
		source.type = v.mime;
		video.append(source);

		const caption = document.createElement("p");
		caption.className = "watch__credit";
		const link = document.createElement("a");
		link.href = v.page;
		link.rel = "noopener";
		link.target = "_blank";
		link.textContent = v.title;
		caption.append(link, document.createTextNode([v.artist && ` by ${v.artist}`, v.licence && ` (${v.licence})`].filter(Boolean).join("")));
		player.append(video, caption);
		video.play().catch(() => {});

		list.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.src === v.src)));
	};

	const show = (items) => {
		if (!items.length) {
			status.textContent = `No videos of ${name} on Wikimedia Commons yet. The photos above will have to do.`;
			return;
		}
		play(items[0], items);
		list.replaceChildren();
		if (items.length < 2) return;
		items.forEach((v, i) => {
			const li = document.createElement("li");
			const b = document.createElement("button");
			b.type = "button";
			b.dataset.src = v.src;
			b.setAttribute("aria-label", `Play video ${i + 1}: ${v.title}`);
			if (v.poster) {
				const img = document.createElement("img");
				img.src = v.poster;
				img.alt = "";
				img.loading = "lazy";
				b.append(img);
			}
			const t = document.createElement("span");
			t.textContent = v.title;
			b.append(t);
			b.addEventListener("click", () => play(v, items));
			li.append(b);
			list.append(li);
		});
		list.querySelector("button")?.setAttribute("aria-pressed", "true");
	};

	const find = async () => {
		try {
			let items = scientific ? await search(`"${scientific}"`) : [];
			if (!items.length && name) items = await search(name);
			show(items);
		} catch (e) {
			status.textContent = "Couldn't reach Wikimedia Commons. Check the internet connection and refresh.";
		}
	};

	// Only go looking once the section is close to the screen.
	new IntersectionObserver(
		(entries, obs) => {
			if (entries[0].isIntersecting) {
				obs.disconnect();
				find();
			}
		},
		{ rootMargin: "300px" },
	).observe(section);
})();
