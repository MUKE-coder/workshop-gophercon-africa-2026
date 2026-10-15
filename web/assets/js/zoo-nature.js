// The zoo's landscape: rolling hills, trees of a few African kinds, palms,
// bushes, reeds, flowers and grass, all swaying a little in the wind.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// The wind: every swaying material shares this clock.
const wind = { value: 0 };

export function createNature({ rand, isFree, enclosures }) {
	const group = new THREE.Group();

	// Ground ---------------------------------------------------------------------
	//
	// Flat where the park is, rolling into hills beyond it, with patchy
	// colour so the grass doesn't read as one sheet of green.

	const heightAt = (x, z) => {
		const r = Math.hypot(x, z);
		const hills = Math.sin(x * 0.031) * 4 + Math.sin(z * 0.027 + 1.3) * 5 + Math.sin((x + z) * 0.018) * 6 + Math.sin(x * 0.07 - z * 0.05) * 1.5;
		return Math.max(0, hills + 8) * smooth(80, 170, r);
	};

	const terrainGeo = new THREE.PlaneGeometry(620, 620, 150, 150);
	terrainGeo.rotateX(-Math.PI / 2);
	const pos = terrainGeo.attributes.position;
	const colors = [];
	const grassA = new THREE.Color(0x8fbf5a);
	const grassB = new THREE.Color(0x6fa848);
	const grassC = new THREE.Color(0xa9c76a);
	const c = new THREE.Color();
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const z = pos.getZ(i);
		pos.setY(i, heightAt(x, z) - 0.02);
		const n = (Math.sin(x * 0.11) + Math.sin(z * 0.13 + 2) + Math.sin((x - z) * 0.07)) / 3;
		c.copy(grassA).lerp(n > 0 ? grassB : grassC, Math.abs(n) * 0.9);
		colors.push(c.r, c.g, c.b);
	}
	terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
	terrainGeo.computeVertexNormals();
	const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
	terrain.receiveShadow = true;
	group.add(terrain);

	// Materials ---------------------------------------------------------------------

	const leaf = swaying(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), 0.012, "leaf");
	const frond = swaying(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true, side: THREE.DoubleSide }), 0.02, "frond");
	const grass = swaying(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), 0.12, "grass");
	const bark = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
	const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, flatShading: true });

	const greens = [0x3f7d3a, 0x4a8a3c, 0x2f6b34, 0x5b9440, 0x36703a, 0x6a9a3a];
	const tint = (hex, spread = 0.08) => new THREE.Color(hex).offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * spread, (rand() - 0.5) * spread);

	// Geometry for each kind of plant, a few variants of each.
	const broadleafCrowns = [0, 1, 2].map(() => crownBroadleaf(rand, 2.6));
	const acaciaCrowns = [0, 1].map(() => crownAcacia(rand, 3.4));
	const broadleafTrunk = trunkBroadleaf();
	const acaciaTrunk = trunkAcacia();
	const palm = palmParts(rand);
	const bushGeo = [0, 1].map(() => crownBroadleaf(rand, 0.9, 3));
	const tuftGeo = grassTuft();
	const reedGeo = reedClump(rand);
	const flowerGeo = new THREE.IcosahedronGeometry(0.16, 0);
	flowerGeo.translate(0, 0.3, 0);

	// Collect where each plant goes, then build one instanced mesh per kind.
	const plan = { broadleaf: [[], [], []], acacia: [[], []], palm: [], bush: [[], []], tuft: [], reed: [], flower: [] };
	const at = (x, z, s = 1, ry = rand() * Math.PI * 2, lean = 0) => ({ x, y: heightAt(x, z), z, s, ry, lean });

	// Trees around and beyond the park.
	for (let k = 0; k < 420 && plan.broadleaf.flat().length + plan.acacia.flat().length < 260; k++) {
		const r = 36 + rand() * 210;
		const a = rand() * Math.PI * 2;
		const x = Math.cos(a) * r;
		const z = Math.sin(a) * r;
		if (!isFree(new THREE.Vector3(x, 0, z), 3)) continue;
		const s = 0.75 + rand() * 0.8;
		if (rand() < 0.3) plan.acacia[k % 2].push(at(x, z, s * 1.1, undefined, (rand() - 0.5) * 0.12));
		else plan.broadleaf[k % 3].push(at(x, z, s, undefined, (rand() - 0.5) * 0.08));
	}

	// Bushes along the path and between enclosures.
	for (let k = 0; k < 700 && plan.bush.flat().length < 240; k++) {
		const r = 31.5 + rand() * 60;
		const a = rand() * Math.PI * 2;
		const x = Math.cos(a) * r;
		const z = Math.sin(a) * r;
		if (!isFree(new THREE.Vector3(x, 0, z), 0.8)) continue;
		plan.bush[k % 2].push(at(x, z, 0.7 + rand() * 0.9));
	}

	// Grass tufts and flowers, thickest near the walkways.
	for (let k = 0; k < 9000 && plan.tuft.length < 3200; k++) {
		const r = 12 + rand() * 120;
		const a = rand() * Math.PI * 2;
		const x = Math.cos(a) * r;
		const z = Math.sin(a) * r;
		if (!isFree(new THREE.Vector3(x, 0, z), 0.2)) continue;
		plan.tuft.push(at(x, z, 0.7 + rand() * 0.9));
		if (rand() < 0.12 && r < 70) plan.flower.push(at(x + rand() - 0.5, z + rand() - 0.5, 0.8 + rand() * 0.6));
	}

	// Palms round the fountain.
	for (let k = 0; k < 4; k++) {
		const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
		plan.palm.push(at(Math.cos(a) * 9.5, Math.sin(a) * 9.5, 0.85 + rand() * 0.2, undefined, 0.15));
	}

	// Habitat plants inside and around each enclosure.
	const baobabs = [];
	enclosures.forEach((e, i) => {
		const { center, dir, ground, fence } = e;
		const side = new THREE.Vector3(-dir.z, 0, dir.x);
		const inside = (along, across) => center.clone().add(dir.clone().multiplyScalar(along)).add(side.clone().multiplyScalar(across));

		if (ground === "savanna") {
			[[4, -7], [5, 7.5], [9, 1]].forEach(([al, ac], k) => {
				const p = inside(al, ac);
				plan.acacia[k % 2].push({ x: p.x, y: 0, z: p.z, s: 0.9 + rand() * 0.3, ry: rand() * 6, lean: 0.05 });
			});
			for (let k = 0; k < 140; k++) {
				const a = rand() * Math.PI * 2;
				const r = rand() * (fence - 1);
				plan.tuft.push({ x: center.x + Math.cos(a) * r, y: 0.05, z: center.z + Math.sin(a) * r, s: 0.9 + rand() * 0.8, ry: rand() * 6, lean: 0, golden: true });
			}
		}
		if (ground === "jungle") {
			for (let k = 0; k < 5; k++) {
				const a = (k / 5) * Math.PI * 2 + rand();
				const r = 4 + rand() * 5;
				plan.palm.push({ x: center.x + Math.cos(a) * r, y: 0, z: center.z + Math.sin(a) * r, s: 0.6 + rand() * 0.25, ry: rand() * 6, lean: (rand() - 0.5) * 0.4 });
			}
			for (let k = 0; k < 18; k++) {
				const a = rand() * Math.PI * 2;
				const r = 2 + rand() * (fence - 3);
				plan.bush[k % 2].push({ x: center.x + Math.cos(a) * r, y: 0, z: center.z + Math.sin(a) * r, s: 0.8 + rand() * 0.8, ry: rand() * 6, lean: 0 });
			}
		}
		if (ground === "water" || ground === "beach") {
			const lake = ground === "water" ? fence * 0.72 : fence * 0.5;
			const lakeCenter = ground === "beach" ? center.clone().add(dir.clone().multiplyScalar(4)) : center;
			for (let k = 0; k < 26; k++) {
				const a = rand() * Math.PI * 2;
				const r = lake + (rand() - 0.3) * 1.2;
				plan.reed.push({ x: lakeCenter.x + Math.cos(a) * r, y: 0, z: lakeCenter.z + Math.sin(a) * r, s: 0.7 + rand() * 0.6, ry: rand() * 6, lean: 0 });
			}
			// Palms outside the back of the fence.
			[-1, 1].forEach((sgn) => {
				const p = inside(fence + 3, sgn * 6);
				plan.palm.push({ x: p.x, y: heightAt(p.x, p.z), z: p.z, s: 0.95 + rand() * 0.2, ry: rand() * 6, lean: sgn * 0.2 });
			});
		}

		// A baobab between this enclosure and the next, by the path.
		const a = ((i + 0.5) / enclosures.length) * Math.PI * 2 - Math.PI / 2;
		baobabs.push(new THREE.Vector3(Math.cos(a) * 40, 0, Math.sin(a) * 40));
	});

	// Build ----------------------------------------------------------------------------

	const m4 = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const e = new THREE.Euler();
	const v = new THREE.Vector3();
	const sc = new THREE.Vector3();

	const instanced = (geo, material, spots, colour, { shadow = true, scaleY = 1 } = {}) => {
		if (!spots.length) return null;
		const mesh = new THREE.InstancedMesh(geo, material, spots.length);
		spots.forEach((p, k) => {
			e.set(p.lean, p.ry, p.lean * 0.6);
			q.setFromEuler(e);
			sc.set(p.s, p.s * scaleY, p.s);
			m4.compose(v.set(p.x, p.y, p.z), q, sc);
			mesh.setMatrixAt(k, m4);
			mesh.setColorAt(k, typeof colour === "function" ? colour(p) : tint(colour));
		});
		mesh.castShadow = shadow;
		mesh.receiveShadow = true;
		group.add(mesh);
		return mesh;
	};

	plan.broadleaf.forEach((spots, k) => {
		instanced(broadleafTrunk, bark, spots, 0x7a5236);
		instanced(broadleafCrowns[k], leaf, spots, () => tint(greens[Math.floor(rand() * greens.length)]));
	});
	plan.acacia.forEach((spots, k) => {
		instanced(acaciaTrunk, bark, spots, 0x6b4a32);
		instanced(acaciaCrowns[k], leaf, spots, () => tint(rand() < 0.5 ? 0x6f8f2f : 0x5d8a34));
	});
	instanced(palm.trunk, bark, plan.palm, 0x9a7a55);
	instanced(palm.fronds, frond, plan.palm, () => tint(rand() < 0.5 ? 0x3f8a3a : 0x4f9a3c));
	plan.bush.forEach((spots, k) => instanced(bushGeo[k], leaf, spots, () => tint(greens[Math.floor(rand() * greens.length)], 0.12)));
	instanced(tuftGeo, grass, plan.tuft, (p) => tint(p.golden ? 0xc9b25a : rand() < 0.5 ? 0x7fb04a : 0x9cc35c, 0.1), { shadow: false });
	instanced(reedGeo, grass, plan.reed, () => tint(0x7a9a40), { shadow: false });
	instanced(flowerGeo, flowerMat, plan.flower, () => new THREE.Color([0xffffff, 0xffd84a, 0xff8fb1, 0xc79bff, 0xff7a4a][Math.floor(rand() * 5)]), { shadow: false });

	baobabs.forEach((p) => group.add(baobab(rand, p, bark, leaf)));

	return {
		group,
		heightAt,
		update(t) {
			wind.value = t;
		},
	};
}

// Plant shapes -----------------------------------------------------------------------

// A leafy crown: several lumpy blobs clustered together.
function crownBroadleaf(rand, r, blobs = 5) {
	const parts = [];
	for (let k = 0; k < blobs; k++) {
		const g = new THREE.IcosahedronGeometry(r * (0.5 + rand() * 0.4), 1);
		g.translate((rand() - 0.5) * r * 1.1, r * (0.2 + rand() * 0.6), (rand() - 0.5) * r * 1.1);
		parts.push(g);
	}
	const geo = lumpy(merged(parts), r * 0.12, rand);
	geo.translate(0, 3.6, 0);
	return geo;
}

// The flat, layered umbrella of an acacia.
function crownAcacia(rand, r) {
	const parts = [];
	for (let k = 0; k < 4; k++) {
		const g = new THREE.SphereGeometry(r * (0.55 + rand() * 0.35), 9, 5);
		g.scale(1, 0.26, 1);
		g.translate((rand() - 0.5) * r * 1.2, (rand() - 0.5) * 0.5, (rand() - 0.5) * r * 1.2);
		parts.push(g);
	}
	const geo = lumpy(merged(parts), r * 0.06, rand);
	geo.translate(0, 4.6, 0);
	return geo;
}

function trunkBroadleaf() {
	const trunk = new THREE.CylinderGeometry(0.28, 0.5, 3.8, 7);
	trunk.translate(0, 1.9, 0);
	const b1 = new THREE.CylinderGeometry(0.1, 0.18, 1.6, 5);
	b1.translate(0, 0.8, 0);
	b1.rotateZ(0.7);
	b1.translate(0.1, 2.6, 0);
	const b2 = b1.clone();
	b2.rotateY(2.4);
	return merged([trunk, b1, b2]);
}

// An acacia's trunk forks into two leaning limbs under the canopy.
function trunkAcacia() {
	const trunk = new THREE.CylinderGeometry(0.22, 0.38, 2.6, 6);
	trunk.translate(0, 1.3, 0);
	const fork = (angle, turn) => {
		const g = new THREE.CylinderGeometry(0.1, 0.2, 2.4, 5);
		g.translate(0, 1.2, 0);
		g.rotateZ(angle);
		g.rotateY(turn);
		g.translate(0, 2.4, 0);
		return g;
	};
	return merged([trunk, fork(0.45, 0), fork(0.5, 2.6), fork(0.3, 4.4)]);
}

// A palm: a gently curving trunk and drooping fronds.
function palmParts(rand) {
	const segs = [];
	let y = 0;
	let x = 0;
	for (let k = 0; k < 7; k++) {
		const g = new THREE.CylinderGeometry(0.22 - k * 0.01, 0.3 - k * 0.012, 1.15, 6);
		g.rotateZ(-0.05 * k);
		g.translate(x, y + 0.55, 0);
		segs.push(g);
		y += 1.1;
		x += 0.06 * k;
	}
	const top = new THREE.Vector3(x, y, 0);
	const fronds = [];
	for (let k = 0; k < 9; k++) {
		const g = new THREE.PlaneGeometry(0.9, 4.2, 1, 6);
		const p = g.attributes.position;
		for (let i = 0; i < p.count; i++) {
			const t = (p.getY(i) + 2.1) / 4.2; // 0 at the trunk, 1 at the tip
			const w = Math.sin(t * Math.PI) * (1 - t * 0.3);
			p.setX(i, p.getX(i) * w * 1.6);
			p.setZ(i, -t * t * 1.8 + Math.abs(p.getX(i)) * 0.3);
		}
		g.translate(0, 2.1, 0);
		g.rotateX(-Math.PI / 2 + 0.55 + rand() * 0.25);
		g.rotateY((k / 9) * Math.PI * 2 + rand() * 0.3);
		g.translate(top.x, top.y, top.z);
		fronds.push(g);
	}
	const fr = merged(fronds);
	return { trunk: merged(segs), fronds: fr };
}

function grassTuft() {
	const blades = [];
	for (let k = 0; k < 4; k++) {
		const g = new THREE.ConeGeometry(0.07, 0.9, 3);
		g.translate(0, 0.45, 0);
		g.rotateZ(0.25);
		g.rotateY((k / 4) * Math.PI * 2);
		blades.push(g);
	}
	return merged(blades);
}

function reedClump(rand) {
	const parts = [];
	for (let k = 0; k < 7; k++) {
		const h = 1.6 + rand() * 1.4;
		const g = new THREE.ConeGeometry(0.05, h, 3);
		g.translate(0, h / 2, 0);
		g.rotateZ((rand() - 0.5) * 0.3);
		g.translate((rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.6);
		parts.push(g);
		const head = new THREE.CylinderGeometry(0.09, 0.09, 0.4, 5);
		head.translate((rand() - 0.5) * 0.6, h * 0.8, (rand() - 0.5) * 0.6);
		parts.push(head);
	}
	return merged(parts);
}

// A baobab: a fat bottle trunk with stubby branches and small leaf clumps.
function baobab(rand, p, bark, leaf) {
	const g = new THREE.Group();
	const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 2.1, 7, 9), bark.clone());
	trunk.material.color.set(0x8f7a66);
	trunk.position.y = 3.5;
	g.add(trunk);
	for (let k = 0; k < 6; k++) {
		const a = (k / 6) * Math.PI * 2 + rand() * 0.4;
		const br = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 2.8, 5), trunk.material);
		br.position.set(Math.cos(a) * 0.9, 7.6, Math.sin(a) * 0.9);
		br.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
		g.add(br);
		const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + rand() * 0.4, 1), leaf);
		clump.position.set(Math.cos(a) * 2.2, 8.8 + rand() * 0.4, Math.sin(a) * 2.2);
		clump.scale.set(1, 0.6, 1);
		g.add(clump);
	}
	g.traverse((o) => {
		if (o.isMesh) {
			o.castShadow = true;
			o.receiveShadow = true;
		}
	});
	// The shared leaf material is tinted per instance; these clumps take a fixed green.
	g.children.filter((o) => o.material === leaf).forEach((o) => (o.material = new THREE.MeshStandardMaterial({ color: 0x5d8a34, roughness: 0.9, flatShading: true })));
	g.position.copy(p);
	g.scale.setScalar(0.9 + rand() * 0.3);
	return g;
}

// Helpers ----------------------------------------------------------------------------

function merged(geos) {
	const flat = geos.map((g) => {
		const n = g.index ? g.toNonIndexed() : g;
		n.deleteAttribute("uv");
		n.deleteAttribute("normal");
		return n;
	});
	const m = mergeGeometries(flat, false);
	m.computeVertexNormals();
	return m;
}

// Nudges vertices so shapes look hand-made. Points that share a position move
// together, so faces stay joined.
function lumpy(geo, amount, rand) {
	const p = geo.attributes.position;
	const moved = new Map();
	for (let i = 0; i < p.count; i++) {
		const key = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`;
		if (!moved.has(key)) moved.set(key, [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount]);
		const [dx, dy, dz] = moved.get(key);
		p.setXYZ(i, p.getX(i) + dx, p.getY(i) + dy, p.getZ(i) + dz);
	}
	geo.computeVertexNormals();
	return geo;
}

// Makes a material sway in the wind: the higher a vertex, the more it moves,
// and every instance moves on its own rhythm.
function swaying(material, strength, name) {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.uWind = wind;
		shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uWind;").replace(
			"#include <begin_vertex>",
			`#include <begin_vertex>
			#ifdef USE_INSTANCING
				vec2 seed = instanceMatrix[3].xz;
			#else
				vec2 seed = vec2(0.0);
			#endif
			float sway = max(position.y, 0.0) * ${strength.toFixed(3)};
			transformed.x += sin(uWind * 1.7 + seed.x * 0.37 + seed.y * 0.21) * sway;
			transformed.z += cos(uWind * 1.3 + seed.y * 0.29) * sway * 0.6;`,
		);
	};
	material.customProgramCacheKey = () => `sway-${name}`;
	return material;
}

function smooth(a, b, x) {
	const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
	return t * t * (3 - 2 * t);
}
