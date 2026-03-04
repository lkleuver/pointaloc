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
  let arrowGroup: THREE.Group | null = null;
  let arrowMaterials: THREE.MeshStandardMaterial[] = [];

  // Animation state
  let animating = false;
  let animStartTime = 0;
  let animDuration = REVEAL_DURATION_MS;
  let animStartQ = new THREE.Quaternion();
  let animEndQ = new THREE.Quaternion();

  const HOVER_ALTITUDE_METERS = 15;
  const modelOrigin = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], HOVER_ALTITUDE_METERS);
  const modelScale = modelOrigin.meterInMercatorCoordinateUnits();

  function buildArrow(): THREE.Group {
    const group = new THREE.Group();

    const blue = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      roughness: 0.3,
      metalness: 0.4,
      transparent: true,
      opacity: 0,
    });
    const darkBlue = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.25,
      metalness: 0.5,
      transparent: true,
      opacity: 0,
    });
    arrowMaterials = [blue, darkBlue];

    // Shaft — cylinder
    const shaftGeom = new THREE.CylinderGeometry(0.5, 0.5, 12, 24);
    const shaft = new THREE.Mesh(shaftGeom, darkBlue);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    shaft.position.y = 6;
    group.add(shaft);

    // Cone tip
    const coneGeom = new THREE.ConeGeometry(2, 6, 24);
    const cone = new THREE.Mesh(coneGeom, blue);
    cone.castShadow = true;
    cone.receiveShadow = true;
    cone.position.y = 15;
    group.add(cone);

    // Start hidden
    group.visible = false;

    return group;
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
    for (const mat of arrowMaterials) {
      mat.opacity = opacity;
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
      if (!arrowGroup || !map) return;

      animDuration = durationMs ?? REVEAL_DURATION_MS;
      animStartTime = performance.now();

      // Start from a random bearing so the rotation is interesting each time
      const randomStart = Math.random() * 360;
      animStartQ = bearingQuaternion(randomStart);
      animEndQ = bearingQuaternion(targetBearing);

      arrowGroup.quaternion.copy(animStartQ);
      arrowGroup.visible = true;
      setOpacity(0);
      animating = true;
      map.triggerRepaint();
    },

    hide() {
      if (!arrowGroup) return;
      animating = false;
      arrowGroup.visible = false;
      setOpacity(0);
      map?.triggerRepaint();
    },

    onAdd(mapInstance: maplibregl.Map, gl: WebGL2RenderingContext) {
      map = mapInstance;

      camera = new THREE.Camera();

      scene = new THREE.Scene();

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);

      const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.5);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
      keyLight.position.set(30, 80, 60);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.camera.near = 0.1;
      keyLight.shadow.camera.far = 500;
      keyLight.shadow.camera.left = -100;
      keyLight.shadow.camera.right = 100;
      keyLight.shadow.camera.top = 100;
      keyLight.shadow.camera.bottom = -100;
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
      fillLight.position.set(-40, 20, -30);
      scene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
      rimLight.position.set(0, -40, 80);
      scene.add(rimLight);

      // Ground plane for shadow
      const groundGeom = new THREE.PlaneGeometry(200, 200);
      const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
      const ground = new THREE.Mesh(groundGeom, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.z = -HOVER_ALTITUDE_METERS * modelScale;
      ground.receiveShadow = true;
      scene.add(ground);

      // Arrow
      arrowGroup = buildArrow();

      const arrowHeight = 30;
      const scale = modelScale * arrowHeight;
      arrowGroup.scale.set(scale, scale, scale);

      scene.add(arrowGroup);

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    },

    render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomLayerRenderParams) {
      if (!renderer || !scene || !camera || !map) return;

      // Animate reveal
      if (animating && arrowGroup) {
        const elapsed = performance.now() - animStartTime;
        const rawT = Math.min(elapsed / animDuration, 1);
        const t = easeOutCubic(rawT);

        // Fade in during first portion
        const fadeT = Math.min(rawT / FADE_IN_PORTION, 1);
        setOpacity(fadeT);

        // Slerp rotation
        arrowGroup.quaternion.slerpQuaternions(animStartQ, animEndQ, t);

        if (rawT >= 1) {
          animating = false;
          setOpacity(1);
          arrowGroup.quaternion.copy(animEndQ);
        } else {
          map.triggerRepaint();
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
      arrowGroup = null;
      arrowMaterials = [];
    },
  };

  return layer;
}
