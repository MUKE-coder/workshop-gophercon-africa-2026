// The Tazama zoo: a small 3D park of the animals in our sightings.
//
// Enclosures sit in a ring around a plaza. Zebras gallop, flamingos circle
// their lagoon and macaws loop inside an aviary; the other enclosures play
// real footage from Wikimedia Commons on big screens. Real sighting photos
// stand on boards. The camera tours between enclosures and offers wide,
// close-up, overhead and ride-along views.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const root = document.querySelector("[data-zoo]");
const canvas = root?.querySelector("[data-zoo-canvas]");
const dataEl = document.getElementById("zoo-data");

if (root && canvas && dataEl) {
	if (!webglAvailable()) {
		fail("no WebGL");
	} else {
		try {
			start(JSON.parse(dataEl.textContent || "[]"));
		} catch (err) {
			fail(err);
		}
	}
}

function webglAvailable() {
	try {
		const c = document.createElement("canvas");
		return !!(c.getContext("webgl2") || c.getContext("webgl"));
	} catch (e) {
		return false;
	}
}

function fail(err) {
	console.error("zoo: ", err);
	root.querySelector("[data-zoo-loading]")?.remove();
	root.querySelector("[data-zoo-fallback]")?.removeAttribute("hidden");
}

function start(exhibits) {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const gsap = window.gsap;
	const rand = mulberry(7);

	// Renderer, scene, camera ---------------------------------------------------

	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 900);
	camera.position.set(-170, 130, 240);

	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.dampingFactor = 0.08;
	controls.maxPolarAngle = Math.PI / 2 - 0.06;
	controls.minDistance = 3;
	controls.maxDistance = 220;
	controls.target.set(0, 0, 0);

	const hemi = new THREE.HemisphereLight(0xdff2ff, 0x6b8f3e, 1.6);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight(0xfff3dc, 2.6);
	sun.position.set(-60, 90, 40);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 300 });
	sun.shadow.bias = -0.0005;
	sun.shadow.camera.updateProjectionMatrix();
	scene.add(sun);

	// Day or night follows the site's theme.
	const lamps = [];
	const applyTheme = () => {
		const t = document.documentElement.dataset.theme;
		const dark = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
		const sky = new THREE.Color(dark ? 0x0d1a22 : 0xd9eef5);
		scene.background = sky;
		scene.fog = new THREE.Fog(sky, 140, 420);
		hemi.intensity = dark ? 0.45 : 1.6;
		sun.intensity = dark ? 0.35 : 2.6;
		sun.color.set(dark ? 0x9fb8ff : 0xfff3dc);
		lamps.forEach((l) => (l.material.emissiveIntensity = dark ? 2.2 : 0));
	};
	document.addEventListener("tazama:theme", applyTheme);
	window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

	const resize = () => {
		const w = root.clientWidth;
		const h = root.clientHeight;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	};
	resize();
	new ResizeObserver(resize).observe(root);

	// Materials ------------------------------------------------------------------

	const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true, ...extra });
	const M = {
		grass: mat(0x8fbf5a),
		path: mat(0xe9dcbc),
		paving: mat(0xd8d2c4),
		savanna: mat(0xd8c27a),
		jungle: mat(0x5e8f3e),
		beach: mat(0xf0e4c4),
		water: new THREE.MeshStandardMaterial({ color: 0x4fb3c8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 }),
		wood: mat(0x8a5a3b),
		fence: mat(0x6e4a2f),
		leaf: mat(0x3f7d3a),
		leafDark: mat(0x2f6b34),
		acacia: mat(0x6f8f2f),
		rock: mat(0x9a948a),
		frame: mat(0x1f2a24, { roughness: 0.6 }),
		forest: mat(0x1f4d3a),
		lime: mat(0xd4f06a),
		lamp: new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd27a, emissiveIntensity: 0 }),
	};

	const shadowed = (m, cast = true) => {
		m.castShadow = cast;
		m.receiveShadow = true;
		return m;
	};

	// Layout ----------------------------------------------------------------------
	//
	// Enclosures sit on a ring of radius RING, each fenced at radius FENCE.
	// A sandy path runs inside them, around a paved plaza with a fountain.

	const RING = 48;
	const FENCE = 13;
	const n = exhibits.length;

	const ground = shadowed(new THREE.Mesh(new THREE.CircleGeometry(260, 64), M.grass), false);
	ground.rotation.x = -Math.PI / 2;
	scene.add(ground);

	const path = shadowed(new THREE.Mesh(new THREE.RingGeometry(24, 30, 96), M.path), false);
	path.rotation.x = -Math.PI / 2;
	path.position.y = 0.02;
	scene.add(path);

	const plaza = shadowed(new THREE.Mesh(new THREE.CircleGeometry(12, 48), M.paving), false);
	plaza.rotation.x = -Math.PI / 2;
	plaza.position.y = 0.03;
	scene.add(plaza);

	// Fountain in the plaza.
	const basin = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 1, 32), M.paving));
	basin.position.y = 0.5;
	scene.add(basin);
	const pool = new THREE.Mesh(new THREE.CircleGeometry(4.6, 32), M.water);
	pool.rotation.x = -Math.PI / 2;
	pool.position.y = 1.02;
	scene.add(pool);
	const spout = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3.2, 12), M.paving));
	spout.position.y = 2.1;
	scene.add(spout);
	const jet = new THREE.Mesh(
		new THREE.ConeGeometry(1.4, 3.5, 16, 1, true),
		new THREE.MeshStandardMaterial({ color: 0xbfe8f2, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
	);
	jet.position.y = 4.8;
	jet.rotation.x = Math.PI;
	scene.add(jet);

	const dirOf = (i) => {
		const a = (i / n) * Math.PI * 2 - Math.PI / 2;
		return new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
	};

	// Trees: low-poly trunks and canopies, scattered outside the enclosures.
	const treeSpots = [];
	for (let k = 0; k < 220; k++) {
		const r = 34 + rand() * 150;
		const a = rand() * Math.PI * 2;
		const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
		const nearEnclosure = exhibits.some((_, i) => p.distanceTo(dirOf(i).multiplyScalar(RING)) < FENCE + 4);
		const onSpoke = exhibits.some((_, i) => {
			const d = dirOf(i);
			const along = p.dot(d);
			return along > 28 && along < RING && p.clone().sub(d.clone().multiplyScalar(along)).length() < 4;
		});
		if (!nearEnclosure && !onSpoke) treeSpots.push(p);
	}
	const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
	const crownGeo = new THREE.IcosahedronGeometry(2.4, 0);
	const trunks = new THREE.InstancedMesh(trunkGeo, M.wood, treeSpots.length);
	const crowns = new THREE.InstancedMesh(crownGeo, M.leaf, treeSpots.length);
	const m4 = new THREE.Matrix4();
	treeSpots.forEach((p, k) => {
		const s = 0.8 + rand() * 0.9;
		m4.compose(p.clone().setY(1.5 * s), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
		trunks.setMatrixAt(k, m4);
		m4.compose(p.clone().setY(4.2 * s), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(), rand() * 3, 0)), new THREE.Vector3(s, s * 1.15, s));
		crowns.setMatrixAt(k, m4);
	});
	shadowed(trunks);
	shadowed(crowns);
	scene.add(trunks, crowns);

	// Lamp posts around the path, lit at night.
	for (let k = 0; k < 14; k++) {
		const a = (k / 14) * Math.PI * 2;
		const p = new THREE.Vector3(Math.cos(a) * 31, 0, Math.sin(a) * 31);
		const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 4.5, 6), M.frame));
		pole.position.copy(p).setY(2.25);
		const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), M.lamp.clone());
		bulb.position.copy(p).setY(4.7);
		lamps.push(bulb);
		scene.add(pole, bulb);
	}
	applyTheme();

	// Enclosures --------------------------------------------------------------------

	const textureLoader = new THREE.TextureLoader();
	const stations = new Map();

	exhibits.forEach((ex, i) => {
		try {
			buildEnclosure(ex, i);
		} catch (err) {
			console.error(`zoo: building the ${ex.key} enclosure: `, err);
		}
	});

	function buildEnclosure(ex, i) {
		const dir = dirOf(i);
		const center = dir.clone().multiplyScalar(RING);
		const facePath = Math.atan2(-dir.x, -dir.z);
		const side = new THREE.Vector3(-dir.z, 0, dir.x);
		const group = new THREE.Group();
		group.position.copy(center);
		scene.add(group);

		// Spoke from the ring path to the gate.
		const spoke = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(4.5, RING - FENCE - 29), M.path), false);
		spoke.rotation.x = -Math.PI / 2;
		spoke.rotation.z = facePath;
		spoke.position.copy(dir.clone().multiplyScalar((29 + RING - FENCE) / 2)).setY(0.025);
		scene.add(spoke);

		// Ground inside the fence.
		const floorMat = { savanna: M.savanna, water: M.beach, jungle: M.jungle, beach: M.beach }[ex.ground] || M.savanna;
		const floor = shadowed(new THREE.Mesh(new THREE.CircleGeometry(FENCE, 48), floorMat), false);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = 0.04;
		group.add(floor);

		if (ex.ground === "water" || ex.ground === "beach") {
			const lake = new THREE.Mesh(new THREE.CircleGeometry(ex.ground === "water" ? FENCE * 0.72 : FENCE * 0.5, 40), M.water);
			lake.rotation.x = -Math.PI / 2;
			lake.position.set(ex.ground === "beach" ? dir.x * 4 : 0, 0.07, ex.ground === "beach" ? dir.z * 4 : 0);
			group.add(lake);
		}

		// Fence: posts and two rails.
		const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 5), M.fence, 64);
		for (let k = 0; k < 64; k++) {
			const a = (k / 64) * Math.PI * 2;
			m4.makeTranslation(Math.cos(a) * FENCE, 0.7, Math.sin(a) * FENCE);
			posts.setMatrixAt(k, m4);
		}
		group.add(shadowed(posts));
		[0.55, 1.2].forEach((y) => {
			const rail = shadowed(new THREE.Mesh(new THREE.TorusGeometry(FENCE, 0.06, 4, 96), M.fence));
			rail.rotation.x = Math.PI / 2;
			rail.position.y = y;
			group.add(rail);
		});

		// Scenery by habitat.
		if (ex.ground === "savanna") {
			for (let k = 0; k < 2; k++) {
				const at = side.clone().multiplyScalar(k ? 7 : -7).add(dir.clone().multiplyScalar(4));
				group.add(acacia(at));
			}
			if (ex.key === "lion") {
				for (let k = 0; k < 4; k++) {
					const rock = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + rand() * 1.6, 0), M.rock));
					rock.position.copy(dir.clone().multiplyScalar(2 + rand() * 4).add(side.clone().multiplyScalar((rand() - 0.5) * 10))).setY(0.6);
					rock.rotation.set(rand(), rand(), rand());
					group.add(rock);
				}
			}
		}
		if (ex.ground === "jungle") {
			// The aviary: a wire dome over a little jungle.
			const dome = new THREE.LineSegments(
				new THREE.EdgesGeometry(new THREE.SphereGeometry(FENCE - 1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2)),
				new THREE.LineBasicMaterial({ color: 0x2b3a30, transparent: true, opacity: 0.55 }),
			);
			group.add(dome);
			for (let k = 0; k < 6; k++) {
				const a = rand() * Math.PI * 2;
				const r = 3 + rand() * 6;
				const t = shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.6, 5 + rand() * 3, 7), M.leafDark));
				t.position.set(Math.cos(a) * r, 2.8, Math.sin(a) * r);
				group.add(t);
			}
		}

		// The sign at the gate, facing the path.
		const sign = new THREE.Group();
		const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.7), new THREE.MeshStandardMaterial({ map: signTexture(ex) }));
		board.position.y = 2.6;
		const back = shadowed(new THREE.Mesh(new THREE.BoxGeometry(6.3, 2, 0.15), M.forest));
		back.position.set(0, 2.6, -0.09);
		[-2.6, 2.6].forEach((x) => {
			const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), M.wood));
			post.position.set(x, 1.3, -0.1);
			sign.add(post);
		});
		sign.add(board, back);
		sign.position.copy(dir.clone().multiplyScalar(-(FENCE + 1.6)));
		sign.rotation.y = facePath;
		group.add(sign);

		// Real sighting photos on boards along the front of the enclosure.
		const boards = (ex.photos || []).filter((p) => p.board).slice(0, 3);
		boards.forEach((p, k) => {
			const frame = new THREE.Group();
			const photo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
			// A separate address from the panel's <img>, so the browser fetches a
			// copy with CORS headers instead of reusing the cached one without.
			const src = p.img + (p.img.includes("?") ? "&" : "?") + "zoo3d=1";
			textureLoader.load(src, (tex) => {
				tex.colorSpace = THREE.SRGBColorSpace;
				photo.material.map = tex;
				photo.material.needsUpdate = true;
			});
			photo.position.y = 2.4;
			const backing = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.45, 2.65, 0.12), M.wood));
			backing.position.set(0, 2.4, -0.08);
			const leg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 5), M.wood));
			leg.position.set(0, 0.6, -0.1);
			frame.add(photo, backing, leg);
			const offset = (k - (boards.length - 1) / 2) * 4.2;
			frame.position.copy(dir.clone().multiplyScalar(-(FENCE - 2.6)).add(side.clone().multiplyScalar(offset)));
			frame.rotation.y = facePath + (k - (boards.length - 1) / 2) * -0.25;
			group.add(frame);
		});

		// Screens play real footage of the animals that have no 3D model.
		let screen = null;
		if (ex.kind === "screen") {
			screen = new THREE.Group();
			const frameBox = shadowed(new THREE.Mesh(new THREE.BoxGeometry(13, 7.6, 0.5), M.frame));
			const picture = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 6.86), new THREE.MeshBasicMaterial({ map: placeholderTexture(ex), toneMapped: false }));
			picture.position.z = 0.27;
			[-4.5, 4.5].forEach((x) => {
				const leg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 0.5), M.frame));
				leg.position.set(x, -5.5, -0.1);
				screen.add(leg);
			});
			screen.add(frameBox, picture);
			screen.position.copy(dir.clone().multiplyScalar(3.5)).setY(7.5);
			screen.rotation.y = facePath;
			screen.userData.picture = picture;
			group.add(screen);
		}

		stations.set(ex.key, { ex, i, dir, center, side, screen, animals: [], video: null, showUntil: 0 });
	}

	// Views ------------------------------------------------------------------------

	const views = {
		overview: () => ({ pos: new THREE.Vector3(0, 95, 125), target: new THREE.Vector3(0, 0, 0) }),
	};
	const viewFor = (st, angle) => {
		const c = st.center;
		const d = st.dir;
		const lookAt = st.screen ? st.screen.getWorldPosition(new THREE.Vector3()) : c.clone().setY(2);
		switch (angle) {
			case "close":
				return st.screen
					? { pos: lookAt.clone().sub(d.clone().multiplyScalar(13)).setY(lookAt.y - 0.5), target: lookAt }
					: { pos: c.clone().sub(d.clone().multiplyScalar(14)).add(st.side.clone().multiplyScalar(4)).setY(st.ex.kind === "herd" ? 4 : 6), target: c.clone().setY(st.ex.kind === "herd" ? 2.5 : 4) };
			case "top":
				return { pos: c.clone().sub(d.clone().multiplyScalar(4)).setY(40), target: c.clone() };
			default:
				return { pos: c.clone().sub(d.clone().multiplyScalar(27)).setY(12), target: lookAt.clone().setY(Math.min(lookAt.y, 4)) };
		}
	};

	let current = "overview";
	let angle = "wide";
	let riding = null;
	const rideHint = root.querySelector("[data-ride-hint]");

	const fly = (to, duration = 2.2) => {
		if (!gsap || reduceMotion) {
			camera.position.copy(to.pos);
			controls.target.copy(to.target);
			return;
		}
		gsap.killTweensOf(camera.position);
		gsap.killTweensOf(controls.target);
		gsap.to(camera.position, { x: to.pos.x, y: to.pos.y, z: to.pos.z, duration, ease: "power3.inOut" });
		gsap.to(controls.target, { x: to.target.x, y: to.target.y, z: to.target.z, duration, ease: "power3.inOut" });
	};

	const showPanel = (key) => {
		root.querySelectorAll("[data-panel]").forEach((p) => {
			const on = p.dataset.panel === key || (key === "overview" && p.dataset.panel === "welcome");
			p.hidden = !on;
			p.classList.toggle("is-active", on);
		});
		root.querySelectorAll(".zoo__map [data-go]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.go === key)));
		root.querySelector(`.zoo__map [data-go="${key}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
		const panel = root.querySelector(`[data-panel="${key === "overview" ? "welcome" : key}"]`);
		if (panel && gsap && !reduceMotion) gsap.fromTo(panel, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
	};

	const setAngleButtons = (key, a) => {
		root.querySelectorAll(`[data-panel="${key}"] [data-angle]`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.angle === a)));
	};

	const stopRiding = () => {
		riding = null;
		controls.enabled = true;
		rideHint.hidden = true;
	};

	const go = (key, a = "wide") => {
		stopRiding();
		current = key;
		angle = a;
		if (key === "overview") {
			fly(views.overview());
		} else {
			const st = stations.get(key);
			if (!st) return;
			if (a === "ride" && st.animals.length) {
				riding = st.animals[0];
				controls.enabled = false;
				rideHint.hidden = false;
			} else {
				fly(viewFor(st, a));
			}
			setAngleButtons(key, a);
			playFootage(st);
		}
		showPanel(key);
		// Keep the address in step, so an enclosure can be shared as /zoo#zebra.
		history.replaceState(null, "", key === "overview" ? location.pathname : `#${key}`);
		stations.forEach((st) => {
			if (st.video && st.ex.key !== key) st.video.pause();
		});
	};

	const keys = ["overview", ...exhibits.map((e) => e.key)];
	const step = (by) => {
		const idx = keys.indexOf(current);
		go(keys[(idx + by + keys.length) % keys.length]);
	};

	root.addEventListener("click", (e) => {
		const t = e.target.closest("button");
		if (!t || !root.contains(t)) return;
		if (t.dataset.go) go(t.dataset.go);
		else if (t.dataset.step) step(+t.dataset.step);
		else if (t.dataset.angle) go(current, t.dataset.angle);
		else if ("show" in t.dataset) showtime(stations.get(current));
		else if ("zooFullscreen" in t.dataset) {
			if (document.fullscreenElement) document.exitFullscreen();
			else root.requestFullscreen?.().catch(() => {});
		}
	});
	document.addEventListener("keydown", (e) => {
		if (e.target.closest("input, select, textarea")) return;
		if (e.key === "ArrowRight") step(1);
		if (e.key === "ArrowLeft") step(-1);
		if (e.key === "Escape" && riding) go(current, "wide");
	});

	// Footage --------------------------------------------------------------------------

	async function findVideo(scientific, name) {
		const search = async (q) => {
			const params = new URLSearchParams({
				action: "query",
				generator: "search",
				gsrsearch: `filetype:video ${q}`,
				gsrnamespace: "6",
				gsrlimit: "5",
				prop: "imageinfo",
				iiprop: "url|mime|extmetadata",
				iiextmetadatafilter: "Artist|LicenseShortName",
				format: "json",
				origin: "*",
			});
			const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
			const data = await res.json();
			return Object.values(data.query?.pages || {})
				.sort((a, b) => (a.index || 0) - (b.index || 0))
				.map((p) => ({ p, info: p.imageinfo?.[0] || {} }))
				.filter(({ info }) => info.url && (info.mime || "").startsWith("video/"));
		};
		let hits = await search(`"${scientific}"`);
		if (!hits.length) hits = await search(name);
		if (!hits.length) return null;
		const { p, info } = hits[0];
		const meta = info.extmetadata || {};
		const text = (html) => new DOMParser().parseFromString(html || "", "text/html").body.textContent.trim().replace(/\s+/g, " ");
		return {
			src: info.url,
			title: p.title.replace(/^File:/, "").replace(/\.\w+$/, ""),
			artist: text(meta.Artist?.value),
			licence: text(meta.LicenseShortName?.value),
			page: info.descriptionurl,
		};
	}

	async function playFootage(st) {
		if (!st.screen) return;
		if (st.video) {
			st.video.play().catch(() => {});
			return;
		}
		const credit = root.querySelector(`[data-credit="${st.ex.key}"]`);
		try {
			const v = await findVideo(st.ex.scientific, st.ex.animal);
			if (!v) {
				if (credit) credit.textContent = "No footage of these on Wikimedia Commons yet, so the photos will have to do.";
				return;
			}
			const video = document.createElement("video");
			video.crossOrigin = "anonymous";
			video.muted = true;
			video.loop = true;
			video.playsInline = true;
			video.src = v.src;
			st.video = video;
			const tex = new THREE.VideoTexture(video);
			tex.colorSpace = THREE.SRGBColorSpace;
			video.addEventListener(
				"playing",
				() => {
					st.screen.userData.picture.material.map = tex;
					st.screen.userData.picture.material.needsUpdate = true;
				},
				{ once: true },
			);
			if (current === st.ex.key) video.play().catch(() => {});
			if (credit) {
				credit.replaceChildren();
				const a = document.createElement("a");
				a.href = v.page;
				a.target = "_blank";
				a.rel = "noopener";
				a.textContent = v.title;
				credit.append("On screen: ", a, [v.artist && ` by ${v.artist}`, v.licence && ` (${v.licence})`].filter(Boolean).join(""));
			}
		} catch (e) {
			if (credit) credit.textContent = "Couldn't reach Wikimedia Commons for footage. Check the internet connection.";
		}
	}

	// Animals --------------------------------------------------------------------------

	const manager = new THREE.LoadingManager();
	const loader = new GLTFLoader(manager);
	const bar = root.querySelector("[data-zoo-progress]");
	manager.onProgress = (_, loaded, total) => {
		const pct = Math.round((loaded / total) * 100);
		bar?.setAttribute("aria-valuenow", String(pct));
		bar?.querySelector("span")?.style.setProperty("width", pct + "%");
	};
	manager.onLoad = () => openGates();
	manager.onError = () => openGates();

	const animals = [];
	const load = (file) => new Promise((resolve) => loader.load(`/assets/vendor/models/${file}.glb`, resolve, undefined, () => resolve(null)));

	// One animal: a clone of the model with its own animation, moving on a
	// circle around its enclosure.
	const spawn = (gltf, { size, station, radius, height, speed, flap, material }) => {
		const model = gltf.scene.children[0];
		const box = new THREE.Box3().setFromObject(model);
		const dims = box.getSize(new THREE.Vector3());
		const mesh = model.clone();
		if (material) mesh.material = material;
		mesh.scale.setScalar(size / Math.max(dims.x, dims.z, 0.001));
		mesh.frustumCulled = false;
		mesh.castShadow = true;
		scene.add(mesh);
		const mixer = new THREE.AnimationMixer(mesh);
		mixer.clipAction(gltf.animations[0]).setDuration(flap).play();
		mixer.setTime(rand() * flap);
		const a = {
			mesh,
			mixer,
			center: station ? station.center.clone() : new THREE.Vector3(),
			radius,
			height,
			speed,
			baseSpeed: speed,
			angle: rand() * Math.PI * 2,
			dir: rand() > 0.5 ? 1 : -1,
			bob: rand() * 10,
			station,
			lift: 0,
		};
		mesh.userData.animal = a;
		animals.push(a);
		station?.animals.push(a);
		return a;
	};

	// Zebras are the horse model with stripes painted on in the shader.
	const zebraMaterial = (geometry) => {
		geometry.computeBoundingBox();
		const bb = geometry.boundingBox;
		const size = bb.getSize(new THREE.Vector3());
		const axis = size.x >= size.z ? 0 : 2;
		const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
		m.onBeforeCompile = (shader) => {
			shader.uniforms.uMin = { value: axis === 0 ? bb.min.x : bb.min.z };
			shader.uniforms.uLen = { value: axis === 0 ? size.x : size.z };
			shader.uniforms.uHeight = { value: size.y };
			shader.vertexShader = shader.vertexShader
				.replace("#include <common>", "#include <common>\nvarying vec3 vPos;")
				.replace("#include <morphtarget_vertex>", "#include <morphtarget_vertex>\nvPos = transformed;");
			shader.fragmentShader = shader.fragmentShader
				.replace("#include <common>", "#include <common>\nvarying vec3 vPos;\nuniform float uMin;\nuniform float uLen;\nuniform float uHeight;")
				.replace(
					"#include <color_fragment>",
					`#include <color_fragment>
					float along = (${axis === 0 ? "vPos.x" : "vPos.z"} - uMin) / uLen;
					float wobble = sin(vPos.y / uHeight * 9.0) * 0.012;
					float band = fract(along * 16.0 + wobble);
					float stripe = smoothstep(0.42, 0.5, band) * (1.0 - smoothstep(0.92, 1.0, band));
					diffuseColor.rgb = mix(vec3(0.96, 0.95, 0.92), vec3(0.06, 0.06, 0.07), stripe);`,
				);
		};
		return m;
	};

	Promise.all([load("Horse"), load("Flamingo"), load("Parrot"), load("Stork")]).then(([horse, flamingo, parrot, stork]) => {
		const zebra = stations.get("zebra");
		if (horse && zebra) {
			const stripes = zebraMaterial(horse.scene.children[0].geometry);
			for (let k = 0; k < 3; k++) {
				spawn(horse, { size: 7, station: zebra, radius: 4 + k * 2.6, height: 0, speed: 4.5 + rand() * 1.2, flap: 0.9, material: stripes });
			}
		}
		const lagoon = stations.get("flamingo");
		if (flamingo && lagoon) {
			for (let k = 0; k < 6; k++) {
				spawn(flamingo, { size: 5, station: lagoon, radius: 3 + rand() * 5, height: 2.5 + rand() * 2.5, speed: 3.5 + rand(), flap: 1.1 });
			}
		}
		const aviary = stations.get("macaw");
		if (parrot && aviary) {
			for (let k = 0; k < 5; k++) {
				spawn(parrot, { size: 3.6, station: aviary, radius: 3 + rand() * 5, height: 3.5 + rand() * 4, speed: 5 + rand() * 1.5, flap: 0.55 });
			}
		}
		if (stork) {
			for (let k = 0; k < 4; k++) {
				spawn(stork, { size: 8, station: null, radius: 60 + rand() * 40, height: 32 + rand() * 10, speed: 9, flap: 1.2 });
			}
		}
	});

	// Showtime ---------------------------------------------------------------------------

	function showtime(st) {
		if (!st) return;
		const now = performance.now();
		st.showUntil = now + 7000;
		if (st.screen && st.video) {
			st.video.muted = false;
			st.video.currentTime = 0;
			st.video.play().catch(() => {});
			fly(viewFor(st, "close"), 1.6);
			setAngleButtons(st.ex.key, "close");
			return;
		}
		st.animals.forEach((a, k) => {
			a.speed = a.baseSpeed * (st.ex.kind === "herd" ? 2.4 : 1.8);
			a.mixer.timeScale = 1.9;
			if (gsap && !reduceMotion) {
				if (st.ex.kind === "herd") {
					// Leaps, one after another.
					gsap.to(a, { lift: 1.6, duration: 0.35, ease: "power2.out", yoyo: true, repeat: 7, delay: k * 0.15 });
				} else {
					gsap.to(a, { lift: st.ex.kind === "lagoon" ? 7 : 3.5, duration: 1.2, ease: "power2.inOut", yoyo: true, repeat: 3, delay: k * 0.1 });
				}
			}
		});
	}

	// Clicking an animal starts its show.
	const ray = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	let down = null;
	canvas.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
	canvas.addEventListener("pointerup", (e) => {
		if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
		const r = canvas.getBoundingClientRect();
		pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
		ray.setFromCamera(pointer, camera);
		const hit = ray.intersectObjects(animals.map((a) => a.mesh), false)[0];
		const a = hit?.object.userData.animal;
		if (a?.station) {
			if (current !== a.station.ex.key) go(a.station.ex.key, "close");
			showtime(a.station);
		}
	});

	// Opening the gates -----------------------------------------------------------------

	let opened = false;
	function openGates() {
		if (opened) return;
		opened = true;
		const loading = root.querySelector("[data-zoo-loading]");
		if (gsap && !reduceMotion) {
			gsap.to(loading, { opacity: 0, duration: 0.6, onComplete: () => loading?.remove() });
			arrive(3.2);
			gsap.from(".zoo__panel.is-active, .zoo__map, .zoo__top", { y: 24, opacity: 0, duration: 0.9, stagger: 0.12, delay: 1.6, ease: "power3.out" });
		} else {
			loading?.remove();
			arrive(0);
		}
	}

	// Land on the enclosure named in the address, or take in the whole park.
	function arrive(duration) {
		const key = decodeURIComponent(location.hash.slice(1));
		if (stations.has(key)) {
			const a = ["wide", "close", "top"].includes(new URLSearchParams(location.search).get("angle")) ? new URLSearchParams(location.search).get("angle") : "wide";
			if (duration && gsap && !reduceMotion) {
				gsap.delayedCall(0.01, () => go(key, a));
			} else {
				go(key, a);
			}
			return;
		}
		fly(views.overview(), duration || undefined);
	}
	setTimeout(openGates, 12000);

	// Loop ------------------------------------------------------------------------------

	const clock = new THREE.Clock();
	const ahead = new THREE.Vector3();
	const tick = () => {
		requestAnimationFrame(tick);
		if (document.hidden) return;
		const dt = Math.min(clock.getDelta(), 0.05);
		const t = clock.elapsedTime;
		const now = performance.now();

		for (const a of animals) {
			if (a.station && a.station.showUntil && now > a.station.showUntil) {
				a.speed = a.baseSpeed;
				a.mixer.timeScale = 1;
			}
			a.mixer.update(dt);
			a.angle += ((a.speed * dt) / a.radius) * a.dir;
			const x = Math.cos(a.angle) * a.radius;
			const z = Math.sin(a.angle) * a.radius;
			const y = a.height + a.lift + (a.height ? Math.sin(t * 1.5 + a.bob) * 0.4 : 0);
			a.mesh.position.set(a.center.x + x, y, a.center.z + z);
			// Face along the circle (the models look down +z).
			const tx = -Math.sin(a.angle) * a.dir;
			const tz = Math.cos(a.angle) * a.dir;
			a.mesh.rotation.set(0, Math.atan2(tx, tz), a.height ? -0.25 * a.dir : 0);
		}

		if (riding) {
			const m = riding.mesh;
			const fwd = new THREE.Vector3(Math.sin(m.rotation.y), 0, Math.cos(m.rotation.y));
			const want = m.position.clone().sub(fwd.clone().multiplyScalar(10)).add(new THREE.Vector3(0, 4.5, 0));
			camera.position.lerp(want, 0.08);
			ahead.copy(m.position).add(fwd.multiplyScalar(6)).add(new THREE.Vector3(0, 2, 0));
			controls.target.lerp(ahead, 0.12);
			camera.lookAt(controls.target);
		} else {
			controls.update();
		}

		jet.scale.y = 1 + Math.sin(t * 6) * 0.06;
		M.water.opacity = 0.88 + Math.sin(t * 1.3) * 0.04;
		renderer.render(scene, camera);
	};
	tick();

	// Helpers ---------------------------------------------------------------------------

	function acacia(at) {
		const g = new THREE.Group();
		const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 4, 6), M.wood));
		trunk.position.y = 2;
		const top = shadowed(new THREE.Mesh(new THREE.SphereGeometry(3, 8, 5), M.acacia));
		top.scale.set(1, 0.32, 1);
		top.position.y = 4.3;
		g.add(trunk, top);
		g.position.copy(at);
		return g;
	}

	function signTexture(ex) {
		const c = document.createElement("canvas");
		c.width = 1024;
		c.height = 290;
		const ctx = c.getContext("2d");
		const draw = () => {
			ctx.fillStyle = "#1f4d3a";
			ctx.fillRect(0, 0, c.width, c.height);
			ctx.fillStyle = "#d4f06a";
			ctx.fillRect(0, c.height - 18, c.width, 18);
			ctx.fillStyle = "#ffffff";
			ctx.font = "600 92px Geist, system-ui, sans-serif";
			ctx.textBaseline = "middle";
			ctx.fillText(ex.title, 56, 118);
			const w = ctx.measureText(ex.title + " ").width;
			ctx.fillStyle = "#d4f06a";
			ctx.font = "700 100px Kalam, cursive";
			ctx.fillText(ex.script, 56 + w, 112);
			ctx.fillStyle = "rgba(255,255,255,0.75)";
			ctx.font = "500 48px Geist, system-ui, sans-serif";
			ctx.fillText(ex.animal, 58, 210);
			tex.needsUpdate = true;
		};
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 4;
		draw();
		document.fonts?.ready.then(draw);
		return tex;
	}

	function placeholderTexture(ex) {
		const c = document.createElement("canvas");
		c.width = 1024;
		c.height = 576;
		const ctx = c.getContext("2d");
		const grad = ctx.createLinearGradient(0, 0, 0, c.height);
		grad.addColorStop(0, "#1f4d3a");
		grad.addColorStop(1, "#0f2a20");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, c.width, c.height);
		ctx.fillStyle = "#d4f06a";
		ctx.font = "700 72px Kalam, cursive";
		ctx.textAlign = "center";
		ctx.fillText(ex.animal, c.width / 2, c.height / 2);
		ctx.fillStyle = "rgba(255,255,255,0.7)";
		ctx.font = "500 34px Geist, system-ui, sans-serif";
		ctx.fillText("Visit this enclosure to start the film", c.width / 2, c.height / 2 + 70);
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}
}

// A small seeded random number generator, so the park looks the same on
// every visit.
function mulberry(seed) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
