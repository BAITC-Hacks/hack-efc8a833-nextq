"use client";

import { useEffect, useRef, useState } from "react";
import type { CityCase, CaseResult } from "@/domain/city-case";
import styles from "./scene/city-scene.module.css";

type Props = {
  city: CityCase["city"];
  result?: CaseResult;
  selectedDistrictId?: string;
  onDistrictSelect?: (id: string) => void;
};

export function CityScene({ city, result, selectedDistrictId, onDistrictSelect }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    import("three").then((THREE) => {
      if (disposed || !mount.current) return;
      const host = mount.current;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", { antialias: true, alpha: true });
      if (!context) {
        setUnavailable(true);
        return;
      }
      const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0xeaf2ec, 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-13, 13, 9, -9, 0.1, 100);
      camera.position.set(18, 21, 24);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x809783, 2.4));
      const light = new THREE.DirectionalLight(0xffefd8, 3);
      light.position.set(-7, 16, 12);
      scene.add(light);
      const geometries = new Set<InstanceType<typeof THREE.BufferGeometry>>();
      const materials = new Set<InstanceType<typeof THREE.Material>>();
      const targets: InstanceType<typeof THREE.Mesh>[] = [];

      function box(width: number, height: number, depth: number, color: number, x: number, y: number, z: number) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
        geometries.add(geometry);
        materials.add(material);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        return mesh;
      }

      box(21, 0.35, 16, 0xc3d4bf, 0, -0.55, 0);
      box(22, 0.08, 1.75, 0x64aebe, 0, -0.32, 0);
      box(1.1, 0.22, 3.2, 0xf1eadd, -6.5, -0.13, 0);
      box(1.1, 0.22, 3.2, 0xf1eadd, 6.5, -0.13, 0);

      city.districts.forEach((district, index) => {
        const x = (index % 3 - 1) * 6.5;
        const z = index < 3 ? -4.2 : 4.2;
        const evaluated = result?.districts.find((item) => item.districtId === district.id);
        const indicators = evaluated?.final ?? district.indicators;
        const quality = evaluated?.quality ?? Object.values(indicators).reduce((total, value) => total + value, 0) / 10;
        const selected = district.id === selectedDistrictId;
        const base = box(5.8, 0.22, 5.8, selected ? 0xc1dca6 : 0xe3e4cf, x, -0.2, z);
        base.userData.districtId = district.id;
        targets.push(base);
        box(5.4, 0.08, 0.48, indicators.T1 > 55 ? 0x799d89 : 0x9eaaa6, x, -0.02, z + 0.5);
        box(0.42, 0.08, 5.3, 0xaab3a8, x + 0.45, -0.01, z);
        const count = Math.min(7, Math.max(3, Math.round(district.populationShare * 30)));
        for (let building = 0; building < count; building++) {
          const bx = x - 1.95 + (building % 3) * 1.6;
          const bz = z - 1.75 + Math.floor(building / 3) * 1.7;
          const height = 0.6 + district.populationShare * 5 + ((building * 3 + index) % 4) * 0.35;
          const color = quality >= 58 ? 0x91b5a5 : quality >= 45 ? 0xb8b9a6 : 0xc8a995;
          const buildingMesh = box(0.95, height, 0.85, color, bx, height / 2, bz);
          buildingMesh.userData.districtId = district.id;
          targets.push(buildingMesh);
          box(1.02, 0.08, 0.92, 0xf5eedc, bx, height + 0.02, bz);
          for (let floor = 0; floor < Math.floor(height / 0.42); floor++) {
            box(0.58, 0.09, 0.015, 0xe0ece4, bx, 0.3 + floor * 0.42, bz + 0.43);
          }
        }
        const trees = Math.round(indicators.E1 / 15);
        for (let tree = 0; tree < trees; tree++) {
          const tx = x - 2.1 + tree * 0.75;
          const tz = z + 2.1;
          box(0.1, 0.5, 0.1, 0x87745b, tx, 0.22, tz);
          const geometry = new THREE.IcosahedronGeometry(0.36, 0);
          const material = new THREE.MeshStandardMaterial({ color: tree % 2 ? 0x71936a : 0x4f826b, roughness: 1 });
          geometries.add(geometry);
          materials.add(material);
          const canopy = new THREE.Mesh(geometry, material);
          canopy.position.set(tx, 0.63, tz);
          scene.add(canopy);
        }
      });

      function render() {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        const aspect = width / height;
        camera.left = -Math.max(13.5, 10 * aspect);
        camera.right = -camera.left;
        camera.top = -camera.left / aspect;
        camera.bottom = -camera.top;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        renderer.render(scene, camera);
      }

      const observer = new ResizeObserver(render);
      observer.observe(host);
      render();
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const select = (event: MouseEvent) => {
        const bounds = canvas.getBoundingClientRect();
        pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(targets)[0];
        if (hit) onDistrictSelect?.(hit.object.userData.districtId as string);
      };
      const lost = (event: Event) => {
        event.preventDefault();
        setUnavailable(true);
      };
      canvas.addEventListener("click", select);
      canvas.addEventListener("webglcontextlost", lost);
      cleanup = () => {
        observer.disconnect();
        canvas.removeEventListener("click", select);
        canvas.removeEventListener("webglcontextlost", lost);
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      };
    }).catch(() => {
      if (!disposed) setUnavailable(true);
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [city, result, selectedDistrictId, onDistrictSelect]);

  return (
    <figure className={styles.figure} aria-label="Условная трёхмерная схема пяти районов">
      {unavailable ? <p className={styles.fallback}>3D недоступно в этом браузере. Выберите район в списке ниже.</p> : <div className={styles.viewport} ref={mount} />}
      <div className={styles.districts}>
        {city.districts.map((district, index) => (
          <button type="button" key={district.id} aria-pressed={selectedDistrictId === district.id} onClick={() => onDistrictSelect?.(district.id)}>
            <span>{String(index + 1).padStart(2, "0")}</span>{district.name}
          </button>
        ))}
      </div>
      <figcaption className={styles.caption}>Условная схема, не карта Астаны. Высота зданий отражает население района, зелень — показатель озеленения. Расчёт не зависит от 3D.</figcaption>
    </figure>
  );
}
