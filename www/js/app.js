// =========================================================
// DroneLab — логика приложения
// Здесь: каталог деталей, 3D-дрон, подсчёт цены и массы,
// кнопки и "Поделиться конфигурацией".
// =========================================================

// Подключаем библиотеку three.js (3D-графика) из нашей папки libs.
// Раньше она грузилась из интернета — теперь лежит рядом и работает офлайн.
import * as THREE from "../libs/three/three.module.js";
// OrbitControls — готовый модуль, который даёт крутить камеру пальцем/мышкой.
import { OrbitControls } from "../libs/three/OrbitControls.js";

const $ = id => document.getElementById(id);

$("year").textContent = new Date().getFullYear();

// Данные демонстрационного каталога.
const catalog = {
  frame: [
    { name: "Carbon Pro 5″", price: 90, weight: 120, size: 1.0 },
    { name: "Long Range 7″", price: 145, weight: 180, size: 1.3 },
    { name: "Compact 3″", price: 65, weight: 75, size: .72 }
  ],
  motors: [
    { name: "Performance 2207", price: 120, weight: 132 },
    { name: "Efficiency 2004", price: 105, weight: 100 },
    { name: "Power 2806.5", price: 160, weight: 180 }
  ],
  fc: [
    { name: "F7 Advanced", price: 110, weight: 18 },
    { name: "H7 Pro", price: 165, weight: 20 },
    { name: "F405 Standard", price: 75, weight: 16 }
  ],
  battery: [
    { name: "LiPo 6S 1300 mAh", price: 55, weight: 210, flight: 15 },
    { name: "LiPo 6S 1500 mAh", price: 70, weight: 240, flight: 17 },
    { name: "Li-ion Long Range", price: 115, weight: 360, flight: 25 }
  ],
  camera: [
    { name: "HD Digital", price: 180, weight: 35 },
    { name: "Analog FPV", price: 45, weight: 15 },
    { name: "Action Camera Setup", price: 320, weight: 130 }
  ],
  radio: [
    { name: "Digital Link", price: 95, weight: 25 },
    { name: "ExpressLRS", price: 35, weight: 8 },
    { name: "Long Range Link", price: 125, weight: 30 }
  ]
};

const defaults = {
  frame: 0, motors: 0, fc: 0,
  battery: 0, camera: 0, radio: 0
};

let config = { ...defaults };
let spinEnabled = true;
let propsEnabled = true;
const drones = [];

function makeMaterial(color, metalness = .45, roughness = .32) {
  return new THREE.MeshStandardMaterial({
    color, metalness, roughness
  });
}

function createDrone(container, hero = false) {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(5.6, 4.6, 6.5);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xb8d7ff, 0x18112e, 2.1));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3);
  keyLight.position.set(4, 8, 5);
  scene.add(keyLight);

  const cyanLight = new THREE.PointLight(0x42e8ff, 28, 14);
  cyanLight.position.set(-4, 2, 3);
  scene.add(cyanLight);

  const purpleLight = new THREE.PointLight(0x9b72ff, 25, 14);
  purpleLight.position.set(3, 1, -4);
  scene.add(purpleLight);

  // Светящиеся кольца под моделью.
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x765aff, transparent: true, opacity: .36,
    side: THREE.DoubleSide
  });

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, .008, 8, 100),
    ringMaterial
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -.45;
  scene.add(ring);

  const drone = new THREE.Group();
  scene.add(drone);

  const frameMat = makeMaterial(0x252d43, .8, .3);
  const topMat = makeMaterial(0x42e8ff, .55, .23);
  const darkMat = makeMaterial(0x111521, .7, .28);
  const motorMat = makeMaterial(0xb6c3dc, .8, .24);
  const purpleMat = makeMaterial(0x9b72ff, .45, .25);

  function cylinder(radiusTop, radiusBottom, height, material, parent, x, y, z) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 24),
      material
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function box(w, h, d, material, parent, x, y, z, bevel = false) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Центральная электроника и защитные пластины.
  box(.86, .16, .65, darkMat, drone, 0, 0, 0);
  box(.64, .08, .48, topMat, drone, 0, .11, 0);
  box(.43, .12, .35, purpleMat, drone, 0, .19, 0);
  box(.32, .09, .27, darkMat, drone, 0, .27, 0);

  // Камера спереди.
  const frontCamera = cylinder(.12, .12, .14, motorMat, drone, 0, .03, .48);
  frontCamera.rotation.x = Math.PI / 2;
  const lens = cylinder(.072, .072, .035, topMat, drone, 0, .03, .56);
  lens.rotation.x = Math.PI / 2;

  // Четыре луча, мотора и пропеллера.
  const armPoints = [
    [-1, 1], [1, 1], [-1, -1], [1, -1]
  ];

  const propellers = [];
  const motorPositions = [];

  for (const [sx, sz] of armPoints) {
    const x = sx * .95;
    const z = sz * .95;

    const arm = box(.14, .10, 1.42, frameMat, drone, 0, -.015, 0);
    arm.position.set(x * .48, -.015, z * .48);
    arm.rotation.y = Math.atan2(sx, sz);

    // Небольшая цветная вставка на луче.
    const accent = box(.15, .025, .34, topMat, drone, x * .55, .05, z * .55);
    accent.rotation.y = Math.atan2(sx, sz);

    cylinder(.12, .14, .09, darkMat, drone, x, .01, z);
    cylinder(.095, .11, .16, motorMat, drone, x, .12, z);
    cylinder(.07, .07, .035, purpleMat, drone, x, .22, z);

    const prop = new THREE.Group();
    prop.position.set(x, .25, z);
    drone.add(prop);

    // Две лопасти для наглядной визуализации.
    const blade1 = box(.78, .022, .105, topMat, prop, 0, 0, 0);
    blade1.rotation.y = .12;

    const blade2 = box(.78, .022, .105, purpleMat, prop, 0, .008, 0);
    blade2.rotation.y = Math.PI / 2 + .12;

    cylinder(.065, .065, .035, motorMat, prop, 0, .02, 0);

    propellers.push(prop);
    motorPositions.push({ x, z });
  }

  // Декоративная задняя антенна.
  cylinder(.025, .035, .28, purpleMat, drone, 0, .23, -.36);

  // Плоскость-сетка внизу.
  const grid = new THREE.GridHelper(12, 24, 0x423d8a, 0x29294c);
  grid.position.y = -.48;
  grid.material.transparent = true;
  grid.material.opacity = .35;
  scene.add(grid);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .055;
  controls.enablePan = false;
  controls.minDistance = 3.5;
  controls.maxDistance = 12;
  controls.target.set(0, 0, 0);

  if (hero) {
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.3;
    controls.enableZoom = false;

    // Дрон на главном экране просто сам крутится — трогать его не нужно.
    // Отключаем управление пальцем. Иначе на телефоне страница не листается,
    // если начать вести пальцем прямо по этому дрону (а он занимает полэкрана).
    // Автовращение при этом продолжает работать.
    controls.disconnect();
  }

  const droneView = {
    container, scene, camera, renderer, controls, drone,
    propellers, hero, ring, grid, resizeObserver: null
  };

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  droneView.resizeObserver = observer;
  resize();

  drones.push(droneView);
  return droneView;
}

const heroDrone = createDrone($("heroCanvas"), true);
const builderDrone = createDrone($("builderCanvas"), false);

// Исправление: кнопка изначально пишет "Остановить вращение",
// значит дрон в конструкторе должен сразу крутиться.
// Раньше этой строки не было — дрон стоял, и первое нажатие на кнопку
// как будто ничего не делало.
builderDrone.controls.autoRotate = spinEnabled;

function updateModel() {
  const frame = catalog.frame[config.frame];
  const scale = frame.size;

  // Масштабируем модель в соответствии с выбранной рамой.
  builderDrone.drone.scale.setScalar(scale);

  // Цвет центра меняется с выбранной комплектацией.
  const top = builderDrone.drone.children.find(
    obj => obj.isMesh && Math.abs(obj.position.y - .11) < .01
  );

  $("heroConfig").textContent = frame.name.toUpperCase();

  builderDrone.propellers.forEach((prop, i) => {
    prop.visible = propsEnabled;
    prop.scale.setScalar(scale);
  });

  // Декоративный свет подстраивается под выбранный размер.
  builderDrone.ring.scale.setScalar(scale);
}

function getSelection(key) {
  return catalog[key][config[key]];
}

function updateSummary() {
  let total = 0;
  let weight = 180; // Провода, крепёж и мелкие детали: условная оценка.

  for (const key of Object.keys(catalog)) {
    const item = getSelection(key);
    total += item.price;
    weight += item.weight;
  }

  const battery = getSelection("battery");
  const frame = getSelection("frame");

  // Упрощённая иллюстративная оценка, не физическая симуляция.
  const estimate = Math.max(
    5,
    Math.round(battery.flight * 850 / Math.max(weight, 500))
  );

  $("totalCost").textContent =
    "$" + total.toLocaleString("en-US");

  $("weight").textContent = weight.toLocaleString("ru-RU") + " г";
  $("flight").textContent = Math.max(4, estimate - 2) +
    "–" + (estimate + 3) + " мин";

  $("className").textContent =
    frame.size > 1.1 ? "LR" : frame.size < .8 ? "MINI" : "PRO";

  updateModel();
}

for (const key of Object.keys(catalog)) {
  $(key).addEventListener("change", event => {
    config[key] = Number(event.target.value);
    updateSummary();
  });
}

$("resetView").addEventListener("click", () => {
  builderDrone.controls.reset();
  builderDrone.camera.position.set(5.6, 4.6, 6.5);
  builderDrone.controls.target.set(0, 0, 0);
  builderDrone.camera.lookAt(0, 0, 0);
  builderDrone.controls.update();
});

$("toggleSpin").addEventListener("click", event => {
  spinEnabled = !spinEnabled;
  builderDrone.controls.autoRotate = spinEnabled;
  event.currentTarget.textContent = spinEnabled
    ? "Ⅱ Остановить вращение"
    : "▶ Включить вращение";
});

$("toggleProps").addEventListener("click", event => {
  propsEnabled = !propsEnabled;
  event.currentTarget.textContent = propsEnabled
    ? "◉ Пропеллеры: вкл."
    : "◉ Пропеллеры: выкл.";
  updateModel();
});

// ---------- Поделиться конфигурацией ----------

// Узнаём, где запущена страница: внутри приложения на телефоне
// или в обычном браузере на компьютере.
// window.Capacitor появляется благодаря файлу libs/capacitor.js.
const isApp = window.Capacitor && window.Capacitor.isNativePlatform();

// Плагины Capacitor — это "пульты" к функциям телефона:
//   Filesystem — сохранить файл в память телефона,
//   Share      — открыть системное окно "Поделиться".
// registerPlugin просто достаёт нужный плагин по его имени.
let Filesystem = null;
let Share = null;

if (isApp) {
  Filesystem = window.Capacitor.registerPlugin("Filesystem");
  Share = window.Capacitor.registerPlugin("Share");
} else {
  // В обычном браузере "Поделиться" не нужно — там файл просто скачивается.
  $("saveConfig").textContent = "↓ Скачать конфигурацию";
}

// Собираем текст конфигурации (что выбрано, цена, масса).
function makeConfigText() {
  const lines = [
    "DRONELAB — КОНФИГУРАЦИЯ ДРОНА",
    "Дата: " + new Date().toLocaleDateString("ru-RU"),
    "",
    ...Object.keys(catalog).map(key =>
      key.toUpperCase() + ": " + getSelection(key).name +
      " — $" + getSelection(key).price
    ),
    "",
    "Итого: " + $("totalCost").textContent,
    "Расчётная масса: " + $("weight").textContent,
    "Оценка полёта: " + $("flight").textContent,
    "",
    "ВНИМАНИЕ: демонстрационные цены и расчёты.",
    "Проверьте совместимость компонентов перед покупкой."
  ];

  return lines.join("\n");
}

// В приложении: сохраняем файл и открываем окно "Поделиться".
async function shareInApp(text) {
  // Шаг 1. Записываем текст во временный файл.
  // "CACHE" — это временная папка приложения (как "черновики").
  const result = await Filesystem.writeFile({
    path: "dronelab-config.txt",
    data: text,
    directory: "CACHE",
    encoding: "utf8"
  });

  // Шаг 2. Открываем системное окно "Поделиться" с этим файлом.
  // result.uri — адрес файла внутри телефона.
  await Share.share({
    title: "Конфигурация DroneLab",
    dialogTitle: "Поделиться конфигурацией",
    files: [result.uri]
  });
}

// В браузере: старый способ — просто скачиваем файл.
function downloadInBrowser(text) {
  const blob = new Blob([text], {
    type: "text/plain;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dronelab-config.txt";
  a.click();
  URL.revokeObjectURL(url);
}

$("saveConfig").addEventListener("click", async () => {
  const text = makeConfigText();

  if (!isApp) {
    downloadInBrowser(text);
    return;
  }

  try {
    await shareInApp(text);
  } catch (error) {
    // Если человек просто закрыл окно "Поделиться" — это не ошибка.
    const message = String(error && error.message);
    if (message.toLowerCase().includes("cancel")) return;

    console.error(error);
    alert("Не получилось поделиться: " + message);
  }
});

// Единый цикл анимации для обеих 3D-сцен.
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .05);

  for (const view of drones) {
    view.controls.update();

    if (propsEnabled) {
      for (let i = 0; i < view.propellers.length; i++) {
        const direction = i % 2 === 0 ? 1 : -1;
        view.propellers[i].rotation.y += delta * 18 * direction;
      }
    }

    if (view.hero) {
      view.drone.position.y = Math.sin(clock.elapsedTime * .8) * .08;
      view.ring.rotation.z += delta * .12;
    }

    view.renderer.render(view.scene, view.camera);
  }
}

updateSummary();
animate();

// Сообщение об ошибке загрузки WebGL.
window.addEventListener("error", event => {
  if (String(event.message).includes("WebGL")) {
    console.error("Не удалось запустить 3D-сцену. Проверь поддержку WebGL.");
  }
});
