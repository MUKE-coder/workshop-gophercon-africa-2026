// The home page globe: every sighting as a dot on a spinning Earth.
// Drag to spin it, hover a dot to see what it is, click to open it.
import * as THREE from "three";

const host = document.querySelector("[data-globe]");
const canvas = host?.querySelector("canvas");
const label = host?.querySelector("[data-globe-label]");
const dataEl = document.getElementById("globe-points");

if (host && canvas && dataEl) {
	try {
		start(JSON.parse(dataEl.textContent || "[]"));
	} catch (err) {
		// No WebGL: the CSS globe behind the canvas stays in place.
		console.warn("globe: ", err);
	}
}

function start(points) {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const COLOURS = { marigold: 0xe0a43a, hibiscus: 0xe0485f, leaf: 0x3c9a63, lagoon: 0x3a92c0 };
	const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	const R = 1;

	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
	camera.position.set(0, 0, 4.4);

	const globe = new THREE.Group();
	scene.add(globe);

	// Ocean: a deep indigo sphere, lit from the upper left.
	const ocean = new THREE.Mesh(
		new THREE.SphereGeometry(R, 64, 64),
		new THREE.MeshPhongMaterial({ color: 0xf3f3f1, shininess: 8 }),
	);
	globe.add(ocean);

	scene.add(new THREE.AmbientLight(0xffffff, 1.1));
	const sun = new THREE.DirectionalLight(0xffffff, 1.1);
	sun.position.set(-3, 2, 4);
	scene.add(sun);

	// Atmosphere: a lagoon-coloured rim glow.
	const glow = new THREE.Mesh(
		new THREE.SphereGeometry(R * 1.14, 64, 64),
		new THREE.ShaderMaterial({
			transparent: true,
			side: THREE.BackSide,
			depthWrite: false,
			uniforms: { colour: { value: new THREE.Color(0xffd2b0) } },
			vertexShader: `
				varying vec3 vNormal;
				void main() {
					vNormal = normalize(normalMatrix * normal);
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}`,
			fragmentShader: `
				uniform vec3 colour;
				varying vec3 vNormal;
				void main() {
					float rim = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
					gl_FragColor = vec4(colour, 1.0) * rim;
				}`,
		}),
	);
	scene.add(glow);

	// Graticule: faint lines of latitude and longitude.
	const gratMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.07 });
	const landMat = new THREE.LineBasicMaterial({ color: 0x1d1d1d, transparent: true, opacity: 0.85 });
	for (let lat = -60; lat <= 60; lat += 30) {
		const ring = [];
		for (let lng = -180; lng <= 180; lng += 4) ring.push(toVec(lat, lng, R * 1.001));
		globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), gratMat));
	}
	for (let lng = -180; lng < 180; lng += 30) {
		const ring = [];
		for (let lat = -90; lat <= 90; lat += 4) ring.push(toVec(lat, lng, R * 1.001));
		globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), gratMat));
	}

	// Follow the page theme: the colours live in CSS custom properties.
	const applyTheme = () => {
		ocean.material.color.set(css("--globe-ocean") || "#f3f3f1");
		landMat.color.set(css("--globe-land") || "#1d1d1d");
		gratMat.color.set(css("--globe-grat") || "#000000");
		glow.material.uniforms.colour.value.set(css("--globe-glow") || "#ffd2b0");
		halo.material.color.set(css("--globe-land") || "#1d1d1d");
	};
	document.addEventListener("tazama:theme", applyTheme);
	window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

	// Coastlines, drawn as fine ink lines.
	if (window.topojson) {
		fetch("/assets/vendor/land-110m.json")
			.then((r) => r.json())
			.then((topo) => {
				const land = window.topojson.feature(topo, topo.objects.land);
				for (const feature of land.features) {
					const polys = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
					for (const poly of polys) {
						for (const ring of poly) {
							const pts = ring.map(([lng, lat]) => toVec(lat, lng, R * 1.002));
							globe.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), landMat));
						}
					}
				}
			})
			.catch(() => {});
	}

	// Sightings: one instanced dot each, coloured by species.
	const dotGeo = new THREE.SphereGeometry(0.016, 10, 10);
	const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
	const dots = new THREE.InstancedMesh(dotGeo, dotMat, Math.max(points.length, 1));
	const m = new THREE.Matrix4();
	const colour = new THREE.Color();
	points.forEach((p, i) => {
		m.setPosition(toVec(p.lat, p.lng, R * 1.01));
		dots.setMatrixAt(i, m);
		dots.setColorAt(i, colour.setHex(COLOURS[p.hue] ?? 0xffffff));
	});
	dots.count = points.length;
	globe.add(dots);

	// A ring that pulses around the hovered dot.
	const halo = new THREE.Mesh(
		new THREE.RingGeometry(0.03, 0.042, 32),
		new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide }),
	);
	halo.visible = false;
	globe.add(halo);
	applyTheme();

	// Face Kenya first: that's where we are.
	globe.rotation.y = -((37 + 90) * Math.PI) / 180;
	globe.rotation.x = 0.18;
	glow.rotation.copy(globe.rotation);

	// Sizing ----------------------------------------------------------------

	const resize = () => {
		const size = host.clientWidth;
		renderer.setSize(size, size, false);
		camera.aspect = 1;
		camera.updateProjectionMatrix();
	};
	resize();
	new ResizeObserver(resize).observe(host);

	// Interaction -----------------------------------------------------------

	const ray = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	let dragging = false;
	let moved = 0;
	let last = { x: 0, y: 0 };
	let velocity = { x: 0, y: 0 };
	let idleUntil = 0;
	let hovered = -1;

	const setPointer = (e) => {
		const rect = canvas.getBoundingClientRect();
		pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
		return rect;
	};

	const pick = () => {
		ray.setFromCamera(pointer, camera);
		const hit = ray.intersectObjects([ocean, dots], false)[0];
		return hit && hit.object === dots ? hit.instanceId : -1;
	};

	const showLabel = (i, rect) => {
		hovered = i;
		if (i < 0) {
			label.hidden = true;
			halo.visible = false;
			canvas.style.cursor = "";
			return;
		}
		const p = points[i];
		const pos = toVec(p.lat, p.lng, R * 1.012);
		halo.position.copy(pos);
		halo.lookAt(globe.localToWorld(pos.clone().multiplyScalar(2)));
		halo.visible = true;

		const screen = pos.clone().applyMatrix4(globe.matrixWorld).project(camera);
		label.style.left = ((screen.x + 1) / 2) * rect.width + "px";
		label.style.top = ((1 - screen.y) / 2) * rect.height + "px";
		label.replaceChildren();
		const strong = document.createElement("strong");
		strong.textContent = p.name;
		label.append(strong, document.createTextNode(`${p.place}, ${p.date}`));
		label.hidden = false;
		canvas.style.cursor = "pointer";
	};

	canvas.addEventListener("pointerdown", (e) => {
		dragging = true;
		moved = 0;
		last = { x: e.clientX, y: e.clientY };
		velocity = { x: 0, y: 0 };
		canvas.setPointerCapture(e.pointerId);
	});

	canvas.addEventListener("pointermove", (e) => {
		const rect = setPointer(e);
		if (dragging) {
			const dx = e.clientX - last.x;
			const dy = e.clientY - last.y;
			moved += Math.abs(dx) + Math.abs(dy);
			last = { x: e.clientX, y: e.clientY };
			velocity = { x: dx * 0.005, y: dy * 0.005 };
			globe.rotation.y += velocity.x;
			globe.rotation.x = clamp(globe.rotation.x + velocity.y, -1.1, 1.1);
			showLabel(-1);
			return;
		}
		showLabel(pick(), rect);
	});

	const release = (e) => {
		if (!dragging) return;
		dragging = false;
		idleUntil = performance.now() + 2500;
		if (moved < 6) {
			setPointer(e);
			const i = pick();
			if (i >= 0) window.location.href = "/sightings/" + points[i].id;
		}
	};
	canvas.addEventListener("pointerup", release);
	canvas.addEventListener("pointercancel", release);
	canvas.addEventListener("pointerleave", () => !dragging && showLabel(-1));

	// Render loop -----------------------------------------------------------

	let visible = true;
	let introduced = false;
	const intro = { scale: 1 };
	new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (visible && !introduced && window.gsap && !reduceMotion) {
			introduced = true;
			gsap.fromTo(intro, { scale: 0.6 }, { scale: 1, duration: 1.6, ease: "elastic.out(1, 0.6)" });
			gsap.from(globe.rotation, { y: globe.rotation.y + 2.4, duration: 2.2, ease: "power3.out" });
		}
	}).observe(host);

	const clock = new THREE.Clock();
	let rendered = false;
	const tick = () => {
		requestAnimationFrame(tick);
		// Off screen there's nothing to see, but always draw the first frame
		// so the CSS stand-in can step aside.
		if (!visible && rendered) return;
		const t = clock.getElapsedTime();

		if (!dragging) {
			// Let a flick coast to a stop, then drift on.
			velocity.x *= 0.94;
			velocity.y *= 0.94;
			globe.rotation.y += velocity.x;
			globe.rotation.x = clamp(globe.rotation.x + velocity.y, -1.1, 1.1);
			if (!reduceMotion && hovered < 0 && performance.now() > idleUntil) globe.rotation.y += 0.0016;
		}

		globe.scale.setScalar(intro.scale);
		glow.scale.setScalar(intro.scale);
		if (halo.visible) halo.scale.setScalar(1 + Math.sin(t * 6) * 0.25);

		renderer.render(scene, camera);
		if (!rendered) {
			rendered = true;
			host.classList.add("is-live");
		}
	};
	tick();
}

function toVec(lat, lng, r) {
	const phi = ((90 - lat) * Math.PI) / 180;
	const theta = ((lng + 180) * Math.PI) / 180;
	return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function clamp(n, lo, hi) {
	return Math.min(hi, Math.max(lo, n));
}
