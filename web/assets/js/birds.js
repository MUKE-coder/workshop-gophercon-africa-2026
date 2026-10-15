// The hero's birds: animated 3D flamingos, a macaw and storks flying across
// the page. They flap for real (the models carry their own wing animation)
// and swerve away from the pointer.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.querySelector("[data-birds]");
const hero = canvas?.closest(".hero");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas && hero && !reduceMotion) {
	try {
		start();
	} catch (err) {
		console.warn("birds: ", err);
	}
}

function start() {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
	camera.position.set(0, 0, 250);

	scene.add(new THREE.HemisphereLight(0xffffff, 0xffd9bf, 2.4));
	const sun = new THREE.DirectionalLight(0xffffff, 2);
	sun.position.set(-1, 1.75, 1).multiplyScalar(30);
	scene.add(sun);

	// Visible half-width and half-height at the z = 0 plane.
	let halfH = 1;
	let halfW = 1;
	const resize = () => {
		const w = hero.clientWidth;
		const h = hero.clientHeight;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
		halfW = halfH * camera.aspect;
	};
	resize();
	new ResizeObserver(resize).observe(hero);

	// Pointer, in normalised device coordinates.
	const pointer = new THREE.Vector2(9, 9);
	window.addEventListener("pointermove", (e) => {
		const r = canvas.getBoundingClientRect();
		pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
	});

	const species = [
		{ file: "Flamingo", count: 3, scale: [0.11, 0.15], speed: [26, 34], flap: 1 },
		{ file: "Parrot", count: 2, scale: [0.1, 0.13], speed: [36, 46], flap: 0.6 },
		{ file: "Stork", count: 2, scale: [0.1, 0.14], speed: [22, 30], flap: 1.1 },
	];

	const birds = [];
	const loader = new GLTFLoader();
	const rand = (a, b) => a + Math.random() * (b - a);

	species.forEach((sp) => {
		loader.load(`/assets/vendor/models/${sp.file}.glb`, (gltf) => {
			const model = gltf.scene.children[0];
			const clip = gltf.animations[0];
			for (let i = 0; i < sp.count; i++) {
				const mesh = model.clone();
				const s = rand(...sp.scale);
				mesh.scale.setScalar(s);
				scene.add(mesh);

				const mixer = new THREE.AnimationMixer(mesh);
				const action = mixer.clipAction(clip);
				action.setDuration(sp.flap).play();
				action.time = Math.random() * sp.flap;
				mixer.timeScale = rand(0.85, 1.2);

				const bird = { mesh, mixer, speed: rand(...sp.speed), swerve: new THREE.Vector2(), phase: Math.random() * 10 };
				spawn(bird, true);
				birds.push(bird);
			}
		});
	});

	// Birds enter from the right and leave on the left, at different heights
	// and depths. The first flight is staggered so they don't arrive at once.
	function spawn(bird, first) {
		const z = rand(-180, 20);
		const depthScale = (camera.position.z - z) / camera.position.z;
		bird.z = z;
		bird.baseY = rand(-0.1, 0.75) * halfH * depthScale;
		bird.mesh.position.set((halfW * depthScale + 60) * (first ? rand(1, 2.6) : rand(1, 1.4)), bird.baseY, z);
		bird.swerve.set(0, 0);
	}

	const projected = new THREE.Vector3();
	let visible = true;
	new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(hero);

	const clock = new THREE.Clock();
	const tick = () => {
		requestAnimationFrame(tick);
		const dt = Math.min(clock.getDelta(), 0.05);
		if (!visible) return;
		const t = clock.elapsedTime;

		for (const b of birds) {
			b.mixer.update(dt);
			const m = b.mesh;

			// Swerve: push away from the pointer when it gets close on screen.
			projected.copy(m.position).project(camera);
			const dx = projected.x - pointer.x;
			const dy = projected.y - pointer.y;
			const d = Math.hypot(dx * camera.aspect, dy);
			if (d < 0.35) {
				const push = (0.35 - d) * 220;
				b.swerve.x += (dx / (d || 1)) * push * dt;
				b.swerve.y += (dy / (d || 1)) * push * dt;
			}
			b.swerve.multiplyScalar(0.96);

			const vx = -b.speed + b.swerve.x * 10;
			const vy = Math.sin(t * 1.3 + b.phase) * 4 + b.swerve.y * 10;
			m.position.x += vx * dt;
			m.position.y += (b.baseY - m.position.y) * 0.5 * dt + vy * dt;

			// Face the way it's flying, banking a little into turns.
			m.rotation.y = Math.atan2(vx, 0) * 0.9;
			m.rotation.z = THREE.MathUtils.clamp(vy * 0.02, -0.4, 0.4);
			m.rotation.x = Math.sin(t * 1.3 + b.phase) * 0.06;

			const depthScale = (camera.position.z - b.z) / camera.position.z;
			if (m.position.x < -(halfW * depthScale + 80)) spawn(b, false);
		}

		renderer.render(scene, camera);
	};
	tick();
}
