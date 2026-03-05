import * as THREE from 'three';

import maplibregl from 'maplibre-gl';

interface ArrowLayerOptions {
  readonly lat: number;
  readonly lng: number;
}

/** Compute initial geodesic bearing (forward azimuth) from point A to point B in degrees [0,360). */
export function geodesicBearing(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): number {
  const toRad = Math.PI / 180;
  const lat1 = fromLat * toRad;
  const lat2 = toLat * toRad;
  const dLng = (toLng - fromLng) * toRad;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = Math.atan2(y, x) * (180 / Math.PI);
  return ((brng % 360) + 360) % 360;
}

export interface ArrowLayer extends maplibregl.CustomLayerInterface {
  /** Fade in and animate rotation to the target bearing over durationMs. */
  reveal(targetBearing: number, durationMs?: number): void;
  /** Instantly hide the arrow (for next round). */
  hide(): void;
}

interface CustomLayerRenderParams {
  readonly defaultProjectionData: {
    readonly mainMatrix: ArrayLike<number>;
  };
}

const REVEAL_DURATION_MS = 1500;
const FADE_IN_PORTION = 0.3; // first 30% of animation is fade-in

export function createArrowLayer(options: ArrowLayerOptions): ArrowLayer {
  const { lat, lng } = options;

  const layerId = 'three-arrow-layer';

  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;
  let map: maplibregl.Map | null = null;
  let arrowMesh: THREE.Mesh | null = null;
  let arrowMaterial: THREE.MeshPhysicalMaterial | null = null;
  let envMap: THREE.Texture | null = null;
  let keyLight: THREE.DirectionalLight | null = null;
  let fillLight: THREE.DirectionalLight | null = null;
  let rimLight: THREE.DirectionalLight | null = null;
  let groundMesh: THREE.Mesh | null = null;

  // Animation state
  let animating = false;
  let animStartTime = 0;
  let animDuration = REVEAL_DURATION_MS;
  let animStartQ = new THREE.Quaternion();
  let animEndQ = new THREE.Quaternion();

  const HOVER_ALTITUDE_METERS = 15;
  const modelOrigin = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], HOVER_ALTITUDE_METERS);
  const modelScale = modelOrigin.meterInMercatorCoordinateUnits();

  /** Generate a procedural environment map for realistic reflections. */
  function buildEnvMap(rendererInstance: THREE.WebGLRenderer): THREE.Texture {
    const pmrem = new THREE.PMREMGenerator(rendererInstance);
    pmrem.compileCubemapShader();

    const envScene = new THREE.Scene();

    // Sky-blue gradient hemisphere
    const skyColor = new THREE.Color(0x88ccff);
    const groundColor = new THREE.Color(0xddeeff);
    envScene.add(new THREE.HemisphereLight(skyColor, groundColor, 1.0));

    // Bright sun-like source for specular highlights
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(5, 10, 7);
    envScene.add(sunLight);

    // Warm bounce
    const bounceLight = new THREE.DirectionalLight(0xffeedd, 0.5);
    bounceLight.position.set(-3, 2, -5);
    envScene.add(bounceLight);

    const envTexture = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();

    return envTexture;
  }

  function buildArrow(): THREE.Mesh {
    // Single continuous profile revolved around Y — no internal faces
    // Profile: bottom cap center → shaft wall → cone base → tip
    const SHAFT_R = 0.8;
    const CONE_R = 2;
    const SHAFT_H = 10;
    const TOTAL_H = 15;
    const SEGMENTS = 32;

    const profile = [
      new THREE.Vector2(0, 0),          // bottom center
      new THREE.Vector2(SHAFT_R, 0),    // bottom edge
      new THREE.Vector2(SHAFT_R, SHAFT_H), // shaft top
      new THREE.Vector2(CONE_R, SHAFT_H),  // cone base
      new THREE.Vector2(0, TOTAL_H),    // cone tip
    ];

    const geo = new THREE.LatheGeometry(profile, SEGMENTS);
    geo.computeVertexNormals();

    // Apply vertex colors — shaft vertices get darker color, cone gets brighter
    const posAttr = geo.getAttribute('position');
    const totalVerts = posAttr.count;
    const colors = new Float32Array(totalVerts * 3);
    const shaftColor = new THREE.Color(0xcc0000);
    const coneColor = new THREE.Color(0xff3333);

    for (let i = 0; i < totalVerts; i++) {
      const y = posAttr.getY(i);
      const c = y <= SHAFT_H ? shaftColor : coneColor;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    arrowMaterial = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.25,
      metalness: 0.3,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      reflectivity: 0.9,
      transparent: false,
      depthWrite: true,
      opacity: 1,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, arrowMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;

    return mesh;
  }

  /** Compute the flat-on-map quaternion for a given bearing. */
  function bearingQuaternion(bearingDeg: number): THREE.Quaternion {
    const qTilt = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), Math.PI,
    );
    const qBearing = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(bearingDeg),
    );
    return new THREE.Quaternion().multiplyQuaternions(qBearing, qTilt);
  }

  function setOpacity(opacity: number) {
    if (arrowMaterial) {
      arrowMaterial.opacity = opacity;
    }
  }

  /** Smooth ease-out cubic */
  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  const layer: ArrowLayer = {
    id: layerId,
    type: 'custom' as const,
    renderingMode: '3d',

    reveal(targetBearing: number, durationMs?: number) {
      if (!arrowMesh || !map) return;

      animDuration = durationMs ?? REVEAL_DURATION_MS;
      animStartTime = performance.now();

      // Start from a random bearing so the rotation is interesting each time
      const randomStart = Math.random() * 360;
      animStartQ = bearingQuaternion(randomStart);
      animEndQ = bearingQuaternion(targetBearing);

      arrowMesh.quaternion.copy(animStartQ);
      arrowMesh.visible = true;
      setOpacity(1);
      animating = true;
      map.triggerRepaint();
    },

    hide() {
      if (!arrowMesh) return;
      animating = false;
      arrowMesh.visible = false;
      setOpacity(0);
      map?.triggerRepaint();
    },

    onAdd(mapInstance: maplibregl.Map, gl: WebGL2RenderingContext) {
      map = mapInstance;

      camera = new THREE.Camera();

      scene = new THREE.Scene();

      // Lighting — 3-point setup with hemisphere fill
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);

      const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x666666, 1.0);
      scene.add(hemiLight);

      // Key light — main shadow caster (positions set dynamically in render)
      keyLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.bias = -0.001;
      keyLight.shadow.normalBias = 0.02;
      scene.add(keyLight);

      // Fill light — softer, opposite side (position set dynamically in render)
      fillLight = new THREE.DirectionalLight(0xc4d8f0, 1.0);
      scene.add(fillLight);

      // Rim / back light — edge highlights (position set dynamically in render)
      rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
      scene.add(rimLight);

      // Ground plane for shadow — PlaneGeometry lies in XY facing +Z, which is
      // already the map surface in mercator space. No rotation needed.
      const groundGeom = new THREE.PlaneGeometry(1, 1);
      const groundMat = new THREE.ShadowMaterial({ opacity: 0.4, side: THREE.DoubleSide });
      groundMesh = new THREE.Mesh(groundGeom, groundMat);
      groundMesh.position.z = -HOVER_ALTITUDE_METERS * modelScale;
      groundMesh.receiveShadow = true;
      scene.add(groundMesh);

      // Arrow
      arrowMesh = buildArrow();
      scene.add(arrowMesh);

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.8;

      // Generate environment map and assign to material for reflections
      envMap = buildEnvMap(renderer);
      if (arrowMaterial) {
        arrowMaterial.envMap = envMap;
        arrowMaterial.needsUpdate = true;
      }
    },

    render(gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomLayerRenderParams) {
      if (!renderer || !scene || !camera || !map) return;

      // Clear MapLibre's depth buffer so the arrow renders on top of map tiles,
      // while keeping depth testing enabled for correct ordering between arrow parts
      gl.clear(gl.DEPTH_BUFFER_BIT);

      // Animate reveal
      if (animating && arrowMesh) {
        const elapsed = performance.now() - animStartTime;
        const rawT = Math.min(elapsed / animDuration, 1);
        const t = easeOutCubic(rawT);

        // Slerp rotation
        arrowMesh.quaternion.slerpQuaternions(animStartQ, animEndQ, t);

        if (rawT >= 1) {
          animating = false;
          arrowMesh.quaternion.copy(animEndQ);
        } else {
          map.triggerRepaint();
        }
      }

      // Scale arrow relative to zoom so it's always a consistent visual size
      if (arrowMesh) {
        const zoom = map.getZoom();
        // At zoom 16 the arrow should be ~30m; halve/double for each zoom step
        const metersAtZoom = 30 * Math.pow(2, 16 - zoom);
        const scale = modelScale * metersAtZoom;
        arrowMesh.scale.set(scale, scale, scale);

        // Scale lights, shadow camera, and ground plane to match arrow size
        // ls = approximate arrow height in scene units
        const ls = scale * 15;

        if (keyLight) {
          keyLight.position.set(1.5 * ls, 4 * ls, 3 * ls);
          keyLight.shadow.camera.left = -3 * ls;
          keyLight.shadow.camera.right = 3 * ls;
          keyLight.shadow.camera.top = 3 * ls;
          keyLight.shadow.camera.bottom = -3 * ls;
          keyLight.shadow.camera.near = 0.01 * ls;
          keyLight.shadow.camera.far = 20 * ls;
          keyLight.shadow.camera.updateProjectionMatrix();
        }
        if (fillLight) {
          fillLight.position.set(-2 * ls, 1.7 * ls, -1.3 * ls);
        }
        if (rimLight) {
          rimLight.position.set(0, -2 * ls, 4 * ls);
        }
        if (groundMesh) {
          const groundSize = scale * 150;
          groundMesh.scale.set(groundSize, groundSize, 1);
        }
      }

      const mvpMatrix = new THREE.Matrix4()
        .fromArray(args.defaultProjectionData.mainMatrix as number[]);

      const translateMatrix = new THREE.Matrix4().makeTranslation(
        modelOrigin.x,
        modelOrigin.y,
        modelOrigin.z ?? 0,
      );

      camera.projectionMatrix = mvpMatrix.multiply(translateMatrix);

      renderer.resetState();
      renderer.render(scene, camera);
    },

    onRemove() {
      animating = false;
      if (renderer) {
        renderer.dispose();
        renderer = null;
      }
      if (scene) {
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (obj.material instanceof THREE.Material) {
              obj.material.dispose();
            }
          }
        });
        scene = null;
      }
      camera = null;
      map = null;
      arrowMesh = null;
      arrowMaterial = null;
      keyLight = null;
      fillLight = null;
      rimLight = null;
      groundMesh = null;
      if (envMap) {
        envMap.dispose();
        envMap = null;
      }
    },
  };

  return layer;
}
