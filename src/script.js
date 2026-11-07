import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import GUI from 'lil-gui'

const CONFIG = {
    fogColor: 0x3b2c60,
    fogDensity: 0.016,
    moonLightIntensity: 3.0,
    hemiIntensity: 1.1,
    groundSize: 260,
    groundSegments: 160,
    crystalGlow: 2.8,
    roverSpeed: 6,
    roverTurnSpeed: 1.8,
    followRover: true,
    meteorGravity: 6,
    meteorFlightTime: 2.2,
    maxMeteors: 12,
    shipScale: 2.5,
    sparkCount: 120,
}

const canvas = document.querySelector('canvas.webgl')
const sizes = { width: window.innerWidth, height: window.innerHeight }
const pixelRatio = Math.min(window.devicePixelRatio, 2)

let seed = 7
function seededRandom() {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
}


// Положення на карті
const SHIP_YAW = 0.45
function shipPoint(along, side) {
    return {
        x: Math.cos(SHIP_YAW) * along + Math.sin(SHIP_YAW) * side,
        z: -Math.sin(SHIP_YAW) * along + Math.cos(SHIP_YAW) * side,
    }
}

function distanceToShipAxis(x, z) {
    const s = CONFIG.shipScale
    const dirX = Math.cos(SHIP_YAW)
    const dirZ = -Math.sin(SHIP_YAW)
    const along = THREE.MathUtils.clamp(x * dirX + z * dirZ, -7 * s, 8 * s)
    return Math.hypot(x - dirX * along, z - dirZ * along)
}

function isNearShip(x, z) {
    return distanceToShipAxis(x, z) < 4.8 * CONFIG.shipScale
}

function randomSpot(minRadius, maxRadius) {
    let x, z
    do {
        const angle = seededRandom() * Math.PI * 2
        const radius = minRadius + seededRandom() * (maxRadius - minRadius)
        x = Math.cos(angle) * radius
        z = Math.sin(angle) * radius
    } while (isNearShip(x, z))
    return { x, z }
}

// Сцена, камера, рендерер
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(CONFIG.fogColor, CONFIG.fogDensity)

const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 500)
camera.position.set(10.5, 2.5, 28)
scene.add(camera)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(pixelRatio)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.1
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(13.5, 2, 10)
controls.minDistance = 6
controls.maxDistance = 90
controls.maxPolarAngle = Math.PI * 0.49

// Небо та місяці
function createSkyTexture() {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 1024
    const ctx = c.getContext('2d')

    const gradient = ctx.createLinearGradient(0, 0, 0, c.height)
    gradient.addColorStop(0.0, '#0e0b26')
    gradient.addColorStop(0.3, '#201a48')
    gradient.addColorStop(0.47, '#5f4d86')
    gradient.addColorStop(0.5, '#7a5f96')
    gradient.addColorStop(0.52, '#3b2c60')
    gradient.addColorStop(1.0, '#3b2c60')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, c.width, c.height)

    for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + Math.random() * 0.6})`
        ctx.fillRect(Math.random() * c.width, Math.random() * c.height * 0.42, 1.5, 1.5)
    }

    const texture = new THREE.CanvasTexture(c)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 32),
    new THREE.MeshBasicMaterial({ map: createSkyTexture(), side: THREE.BackSide, fog: false })
)
scene.add(sky)

const bigMoon = new THREE.Mesh(
    new THREE.SphereGeometry(16, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8b496, fog: false })
)
bigMoon.position.set(60, 70, -200)
scene.add(bigMoon)

const smallMoon = new THREE.Mesh(
    new THREE.SphereGeometry(6, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xc9bcd8, fog: false })
)
smallMoon.position.set(-10, 45, -210)
scene.add(smallMoon)

// Освітлення
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.15
scene.add(new THREE.HemisphereLight(0x6a73d6, 0x2a1a40, CONFIG.hemiIntensity))

const moonLight = new THREE.DirectionalLight(0x9fb4ff, CONFIG.moonLightIntensity)
moonLight.castShadow = true
moonLight.shadow.mapSize.set(2048, 2048)
moonLight.shadow.radius = 4
moonLight.shadow.bias = -0.0005
moonLight.shadow.normalBias = 0.03
moonLight.shadow.camera.left = -45
moonLight.shadow.camera.right = 45
moonLight.shadow.camera.top = 45
moonLight.shadow.camera.bottom = -45
moonLight.shadow.camera.near = 1
moonLight.shadow.camera.far = 160
scene.add(moonLight, moonLight.target)

const moonLightOffset = new THREE.Vector3(30, 40, -35)

const fillLight = new THREE.DirectionalLight(0x4a5cc0, 0.5)
fillLight.position.set(-20, 15, 30)
scene.add(fillLight)

const composerTarget = new THREE.WebGLRenderTarget(sizes.width, sizes.height, {
    type: THREE.HalfFloatType,
    samples: 4,
})
const composer = new EffectComposer(renderer, composerTarget)
composer.setPixelRatio(pixelRatio)
composer.setSize(sizes.width, sizes.height)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new UnrealBloomPass(new THREE.Vector2(sizes.width, sizes.height), 0.35, 0.5, 0.75))
composer.addPass(new OutputPass())


// Рельєф
function craterShape(x, z, centerX, centerZ, radius, depth) {
    const k = Math.hypot(x - centerX, z - centerZ) / radius
    if (k < 1) return -depth * (1 - k * k)
    if (k < 1.4) return depth * 0.3 * Math.sin(((k - 1) / 0.4) * Math.PI)
    return 0
}

// Положення станції
const stationX = 72
const stationZ = -10
const STATION_FLAT_RADIUS = 27
const STATION_BLEND_RADIUS = 20

function getRawGroundHeight(x, z) {
    let h = Math.sin(x * 0.06) * Math.cos(z * 0.05) * 3.0

    h += Math.sin(x * 0.15 + z * 0.1) * 0.7
    h += Math.cos(z * 0.21 - x * 0.13) * 0.4

    h += craterShape(x, z, 0, 0, 30, 4)
    h += craterShape(x, z, -40, 28, 9, 2)
    h += craterShape(x, z, 35, -30, 12, 2.5)

    h += Math.max(0, Math.hypot(x, z) - 60) * 0.06
    return h
}

const STATION_PAD_Y = getRawGroundHeight(stationX, stationZ)

function getGroundHeight(x, z) {
    const raw = getRawGroundHeight(x, z)
    const d = Math.hypot(x - stationX, z - stationZ)
    if (d >= STATION_FLAT_RADIUS + STATION_BLEND_RADIUS) return raw

    let t = Math.max(0, Math.min(1, (d - STATION_FLAT_RADIUS) / STATION_BLEND_RADIUS))
    t = t * t * (3 - 2 * t)
    return STATION_PAD_Y + (raw - STATION_PAD_Y) * t
}

const groundGeo = new THREE.PlaneGeometry(CONFIG.groundSize, CONFIG.groundSize, CONFIG.groundSegments, CONFIG.groundSegments)
groundGeo.rotateX(-Math.PI / 2)

const groundPos = groundGeo.attributes.position

for (let i = 0; i < groundPos.count; i++) {
    const h = getGroundHeight(groundPos.getX(i), groundPos.getZ(i))
    groundPos.setY(i, h)
}
groundGeo.computeVertexNormals()

const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a3b7e,
    vertexColors: false,
    roughness: 0.95,
    metalness: 0.05,
})

const textureLoader = new THREE.TextureLoader()
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()

function loadPBRMaterial(pathPrefix, options = {}) {
    const repeatX = options.repeatX ?? 1
    const repeatY = options.repeatY ?? 1

    function loadMap(suffixes, isColorTexture) {
        if (!suffixes) return null

        const texture = new THREE.Texture()
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(repeatX, repeatY)
        texture.anisotropy = maxAnisotropy
        if (isColorTexture) texture.colorSpace = THREE.SRGBColorSpace

        function tryLoad(index) {
            if (index >= suffixes.length) {
                console.warn(`PBR-текстуру не знайдено: ${pathPrefix}${suffixes[0]}`)
                return
            }

            textureLoader.load(
                `${pathPrefix}${suffixes[index]}`,
                (loadedTexture) => {
                    texture.image = loadedTexture.image
                    texture.needsUpdate = true
                },
                undefined,
                () => tryLoad(index + 1)
            )
        }

        tryLoad(0)
        return texture
    }

    return {
        map: loadMap(['Color.jpg'], true),
        normalMap: loadMap(['NormalGL.jpg', 'Normal.jpg'], false),
        roughnessMap: loadMap(['Roughness.jpg'], false),
        metalnessMap: loadMap(options.metalness === false ? null : ['Metalness.jpg', 'Metallic.jpg'], false),
    }
}

Object.assign(
    groundMaterial,
    loadPBRMaterial(`${import.meta.env.BASE_URL}Earth/Ground069_1K-JPG/Ground069_1K-JPG_`, {
        repeatX: 24,
        repeatY: 24,
    })
)
groundMaterial.needsUpdate = true

const ground = new THREE.Mesh(groundGeo, groundMaterial)
ground.receiveShadow = true
scene.add(ground)

const mountainPBR = loadPBRMaterial(`${import.meta.env.BASE_URL}Earth/Rock032_1K-JPG/Rock032_1K-JPG_`, {
    repeatX: 6,
    repeatY: 12,
    metalness: false,
})
const mountainMat = new THREE.MeshStandardMaterial({
    ...mountainPBR,
    color: 0x251f3d,
    roughness: 0.95,
    flatShading: true,
})
const mountainData = [
    [-90, -100, 22, 50],
    [-45, -118, 16, 38],
    [25, -120, 24, 70],
    [70, -100, 18, 44],
    [105, -70, 20, 40],
    [-110, -60, 18, 36],
    [0, -125, 20, 45],
]
mountainData.forEach(([x, z, radius, height]) => {
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5, 1), mountainMat)
    mountain.position.set(x, height / 2 - 4, z)
    mountain.rotation.y = seededRandom() * Math.PI
    mountain.receiveShadow = true
    mountain.castShadow = true
    scene.add(mountain)
})

function addPart(geometry, material, x, y, z, parent) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
}


const obstacles = []
const ROVER_RADIUS = 0.5

function addObstacle(x, z, radius) {
    obstacles.push({ pos: new THREE.Vector3(x, 0, z), radius })
}

// Скелі
const ROCK_COUNT = 90
const rockPBR = loadPBRMaterial(`${import.meta.env.BASE_URL}Earth/Rock032_1K-JPG/Rock032_1K-JPG_`, {
    repeatX: 1,
    repeatY: 1,
    metalness: false,
})
const rockMaterial = new THREE.MeshStandardMaterial({
    map: rockPBR.map,
    normalMap: rockPBR.normalMap,
    roughnessMap: rockPBR.roughnessMap,
    color: 0x5a5268,
    roughness: 0.85,
    flatShading: true,
})
const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMaterial, ROCK_COUNT)
rocks.castShadow = true
rocks.receiveShadow = true
rocks.frustumCulled = false

const dummy = new THREE.Object3D()
const rockSpots = []

for (let i = 0; i < ROCK_COUNT; i++) {
    const isBig = i < 14
    const spot = isBig ? randomSpot(22, 85) : randomSpot(8, 70)
    const size = isBig ? 2 + seededRandom() * 2.5 : 0.3 + seededRandom() * 0.8

    dummy.scale.set(size * (0.8 + seededRandom() * 0.6), size * (0.6 + seededRandom() * 0.6), size * (0.8 + seededRandom() * 0.6))
    dummy.rotation.set(seededRandom() * 3, seededRandom() * 3, seededRandom() * 3)
    dummy.position.set(spot.x, getGroundHeight(spot.x, spot.z) + dummy.scale.y * 0.3, spot.z)
    dummy.updateMatrix()
    rocks.setMatrixAt(i, dummy.matrix)
    rockSpots.push({ x: spot.x, z: spot.z, size: Math.max(dummy.scale.x, dummy.scale.z), isBig })

    if (isBig) addObstacle(spot.x, spot.z, Math.max(dummy.scale.x, dummy.scale.z) * 0.8)

    const shade = 0.7 + seededRandom() * 0.6
    rocks.setColorAt(i, new THREE.Color(shade, shade, shade * 1.1))
}
scene.add(rocks)

// Трава
const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0x00a896,
    emissive: 0x004d40,
    emissiveIntensity: 0.08,
    roughness: 0.8,
    side: THREE.DoubleSide,
})

const GRASS_CELL = 0.55
const GRASS_LIMIT = 90
const GRASS_MIN_SCALE = 0.8
const GRASS_MAX_SCALE = 1.1
const GRASS_STATION_CLEAR = 27
const GRASS_STATION_FADE = 8
const GRASS_ANIMATE_RADIUS = 60

for (let c = 0; c < 1200; c++) {
    randomSpot(2, 105)
    for (let b = 0; b < 12 * 4; b++) seededRandom()
}

function makeRandom(startSeed) {
    let s = startSeed
    return () => {
        s = (s * 9301 + 49297) % 233280
        return s / 233280
    }
}
const grassRandom = makeRandom(20261104)

const TUFT_VARIANTS = [
    { bladeCount: 4, height: 0.34, width: 0.15, spread: 0.09, bend: 0.12 },
    { bladeCount: 6, height: 0.43, width: 0.12, spread: 0.12, bend: 0.18 },
    { bladeCount: 5, height: 0.3, width: 0.2, spread: 0.1, bend: 0.08 },
    { bladeCount: 7, height: 0.38, width: 0.1, spread: 0.17, bend: 0.22 },
]

function buildTuftGeometry(variant) {
    const positions = []
    const uvs = []
    const indices = []
    const sections = [0, 0.24, 0.5, 0.76, 1]

    for (let blade = 0; blade < variant.bladeCount; blade++) {
        const variation = Math.sin(blade * 12.9898 + variant.height * 73.1)
        const angle = (blade / variant.bladeCount) * Math.PI * 2 + variation * 0.16
        const dirX = Math.cos(angle)
        const dirZ = Math.sin(angle)
        const sideX = -dirZ
        const sideZ = dirX
        const leafHeight = variant.height * (0.82 + 0.18 * (variation + 1) * 0.5)
        const leafWidth = variant.width * (0.82 + 0.18 * (Math.cos(blade * 5.31 + variant.width * 19) + 1) * 0.5)
        const start = positions.length / 3

        for (let section = 0; section < sections.length; section++) {
            const t = sections[section]
            const widthProfile = section === sections.length - 1
                ? 0
                : Math.sin(Math.PI * (0.12 + t * 0.78)) * (1 - t * 0.35)
            const width = leafWidth * widthProfile * 0.5
            const curve = variant.spread * t + variant.bend * t * t
            const sideCurve = Math.sin(Math.PI * t) * variant.width * 0.16 * variation
            const centerX = dirX * curve + sideX * sideCurve
            const centerZ = dirZ * curve + sideZ * sideCurve
            const y = leafHeight * t

            positions.push(
                centerX - sideX * width, y, centerZ - sideZ * width,
                centerX + sideX * width, y, centerZ + sideZ * width
            )
            uvs.push(0, t, 1, t)
        }

        for (let section = 0; section < sections.length - 1; section++) {
            const left = start + section * 2
            const right = left + 1
            const nextLeft = left + 2
            const nextRight = left + 3
            indices.push(left, right, nextLeft, right, nextRight, nextLeft)
        }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
}

const tuftsByVariant = TUFT_VARIANTS.map(() => [])
for (let gx = -GRASS_LIMIT; gx < GRASS_LIMIT; gx += GRASS_CELL) {
    for (let gz = -GRASS_LIMIT; gz < GRASS_LIMIT; gz += GRASS_CELL) {
        const x = gx + grassRandom() * GRASS_CELL
        const z = gz + grassRandom() * GRASS_CELL
        if (Math.hypot(x, z) > GRASS_LIMIT) continue
        if (distanceToShipAxis(x, z) < 3) continue
        const dStation = Math.hypot(x - stationX, z - stationZ)
        if (dStation < GRASS_STATION_CLEAR) continue
        if (dStation < GRASS_STATION_CLEAR + GRASS_STATION_FADE) {
            if (grassRandom() > (dStation - GRASS_STATION_CLEAR) / GRASS_STATION_FADE) continue
        }
        const variantHash = (Math.imul(Math.floor(gx / GRASS_CELL), 73856093) ^
            Math.imul(Math.floor(gz / GRASS_CELL), 19349663)) >>> 0
        const variantIndex = variantHash % TUFT_VARIANTS.length
        tuftsByVariant[variantIndex].push({
            x,
            y: getGroundHeight(x, z),
            z,
            scale: GRASS_MIN_SCALE + grassRandom() * (GRASS_MAX_SCALE - GRASS_MIN_SCALE),
            yaw: grassRandom() * Math.PI * 2,
            tiltX: (grassRandom() - 0.5) * 0.15,
            tiltZ: (grassRandom() - 0.5) * 0.15,
            phase: grassRandom() * Math.PI * 2,
            shade: 0.88 + grassRandom() * 0.24,
        })
    }
}

const grassMeshes = tuftsByVariant.map((tufts, variantIndex) => {
    const mesh = new THREE.InstancedMesh(buildTuftGeometry(TUFT_VARIANTS[variantIndex]), bladeMaterial, tufts.length)
    mesh.frustumCulled = false
    mesh.castShadow = false
    const color = new THREE.Color()
    tufts.forEach((tuft, i) => {
        color.setHSL(0.49 + variantIndex * 0.009, 0.42, 0.76 * tuft.shade)
        mesh.setColorAt(i, color)
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    scene.add(mesh)
    return mesh
})

let grassFrame = 0
function updateGrass(elapsed) {
    grassFrame++
    const first = grassFrame === 1
    if (!first && grassFrame % 2 === 0) return

    const cx = controls.target.x
    const cz = controls.target.z
    const maxDist2 = GRASS_ANIMATE_RADIUS * GRASS_ANIMATE_RADIUS

    tuftsByVariant.forEach((tufts, variantIndex) => {
        const mesh = grassMeshes[variantIndex]
        for (let i = 0; i < tufts.length; i++) {
            const tuft = tufts[i]
            if (!first) {
                const dx = tuft.x - cx
                const dz = tuft.z - cz
                if (dx * dx + dz * dz > maxDist2) continue
            }
            const sway = Math.sin(elapsed * 1.5 + tuft.phase) * 0.09

            dummy.position.set(tuft.x, tuft.y, tuft.z)
            dummy.rotation.set(tuft.tiltX + sway, tuft.yaw, tuft.tiltZ + sway * 0.6)
            dummy.scale.setScalar(tuft.scale)
            dummy.updateMatrix()
            mesh.setMatrixAt(i, dummy.matrix)
        }
        mesh.instanceMatrix.needsUpdate = true
    })
}

// Космічний корабель
const textureBasePath = `${import.meta.env.BASE_URL}spaceship/`
const hullMat = new THREE.MeshStandardMaterial({
    ...loadPBRMaterial(`${textureBasePath}Metal061B_1K-JPG/Metal061B_1K-JPG_`, { repeatX: 2, repeatY: 2 }),
    metalness: 0.8,
    roughness: 0.3,
})
const darkMetalMat = new THREE.MeshStandardMaterial({
    ...loadPBRMaterial(`${textureBasePath}Metal063_1K-JPG/Metal063_1K-JPG_`, { repeatX: 2, repeatY: 2 }),
    metalness: 0.8,
    roughness: 0.3,
})
const tealGlowMat = new THREE.MeshStandardMaterial({ color: 0x0a2a30, emissive: 0x2fe8ff, emissiveIntensity: 2 })
const engineGlowMat = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff7a2a, emissiveIntensity: 2.5 })

const ship = new THREE.Group()
scene.add(ship)

addPart(new RoundedBoxGeometry(9, 2.6, 3.4, 4, 0.5), hullMat, 0, 0, 0, ship)

const noseGeo = new THREE.ConeGeometry(1.7, 3.5, 6)
noseGeo.rotateZ(-Math.PI / 2)
const nose = addPart(noseGeo, hullMat, 6.25, 0, 0, ship)
nose.scale.y = 0.8

addPart(new THREE.BoxGeometry(0.25, 2.75, 3.5), darkMetalMat, -3, 0, 0, ship)
addPart(new THREE.BoxGeometry(0.25, 2.75, 3.5), darkMetalMat, -0.5, 0, 0, ship)

addPart(new THREE.BoxGeometry(1.4, 0.35, 3.5), tealGlowMat, 3, 0.7, 0, ship)
addPart(new THREE.BoxGeometry(0.8, 0.08, 0.05), tealGlowMat, 1, -0.5, 1.72, ship)
addPart(new THREE.BoxGeometry(0.8, 0.08, 0.05), tealGlowMat, -1.5, -0.5, 1.72, ship)
addPart(new THREE.BoxGeometry(0.8, 0.08, 0.05), tealGlowMat, 1, -0.5, -1.72, ship)

const wingLeft = addPart(new THREE.BoxGeometry(3.2, 0.15, 2.4), darkMetalMat, -0.5, -0.2, 2.8, ship)
wingLeft.rotation.x = 0.2
const wingRight = addPart(new THREE.BoxGeometry(2.2, 0.15, 1.8), darkMetalMat, -0.5, -0.2, -2.5, ship)
wingRight.rotation.x = -0.5

addPart(new THREE.BoxGeometry(2, 1.4, 0.15), darkMetalMat, -3, 1.9, 0, ship)

const engineGeo = new THREE.CylinderGeometry(0.55, 0.7, 2, 16)
engineGeo.rotateZ(Math.PI / 2)
const nozzleGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16)
nozzleGeo.rotateZ(Math.PI / 2)

const nozzles = []
const enginePositions = [
    [-5.2, 0.6, -1.0],
    [-5.2, 0.6, 1.0],
    [-5.2, -0.6, 0],
]
enginePositions.forEach(([x, y, z]) => {
    addPart(engineGeo, darkMetalMat, x, y, z, ship)
    nozzles.push(addPart(nozzleGeo, engineGlowMat, x - 1.1, y, z, ship))
})

const shipLight = new THREE.PointLight(0x2fe8ff, 150, 40, 2)
shipLight.position.set(3, 1.8, 0)
ship.add(shipLight)

ship.scale.setScalar(CONFIG.shipScale)

ship.position.set(0, getGroundHeight(0, 0) + 1.2 * CONFIG.shipScale, 0)
ship.rotation.set(0.08, SHIP_YAW, -0.22)
ship.updateMatrixWorld(true)

function addShipSphere(part, lx, ly, lz, radius) {
    const p = part.localToWorld(new THREE.Vector3(lx, ly, lz))
    addObstacle(p.x, p.z, radius)
}

{
    const s = CONFIG.shipScale

    const hullZ = 1.3
    const sphereR = 1.0
    const hullStations = 19
    for (let i = 0; i < hullStations; i++) {
        const x = -6.0 + (10.5 * i) / (hullStations - 1)
        addShipSphere(ship, x, 0, hullZ, sphereR)
        addShipSphere(ship, x, 0, -hullZ, sphereR)
    }

    for (const z of [-0.65, 0, 0.65]) addShipSphere(ship, -6.0, 0, z, sphereR)

    addShipSphere(ship, 4.5, 0, 0, 1.2)
    addShipSphere(ship, 5.2, 0, 0, 1.0)
    addShipSphere(ship, 5.8, 0, 0, 0.8)
    for (const [x, z] of [[4.8, 1.1], [5.3, 0.85]]) {
        addShipSphere(ship, x, 0, z, 1.0)
        addShipSphere(ship, x, 0, -z, 1.0)
    }

    for (const x of [-1.3, -0.45, 0.45, 1.3]) {
        for (const z of [-0.85, 0, 0.85]) addShipSphere(wingLeft, x, 0, z, 1.2)
    }

    for (const x of [-0.7, 0, 0.7]) {
        for (const z of [-0.5, 0.5]) addShipSphere(wingRight, x, 0, z, 1.2)
    }
}

const sparkPositions = new Float32Array(CONFIG.sparkCount * 3)
const sparkColors = new Float32Array(CONFIG.sparkCount * 3)
const sparkVelocities = []
const sparkLife = []
const sparkMaxLife = []

const exhaustDir = new THREE.Vector3(-1, 0, 0).applyQuaternion(ship.quaternion)
const nozzleWorldPos = new THREE.Vector3()

function resetSpark(i) {
    const nozzle = nozzles[Math.floor(Math.random() * nozzles.length)]
    nozzle.getWorldPosition(nozzleWorldPos)
    sparkPositions[i * 3] = nozzleWorldPos.x
    sparkPositions[i * 3 + 1] = nozzleWorldPos.y
    sparkPositions[i * 3 + 2] = nozzleWorldPos.z

    const speed = (1 + Math.random() * 2) * CONFIG.shipScale
    sparkVelocities[i].set(
        exhaustDir.x * speed + (Math.random() - 0.5) * 1.6,
        exhaustDir.y * speed + (Math.random() - 0.5) * 1.6,
        exhaustDir.z * speed + (Math.random() - 0.5) * 1.6
    )

    sparkMaxLife[i] = 0.5 + Math.random()
    sparkLife[i] = sparkMaxLife[i]
}

for (let i = 0; i < CONFIG.sparkCount; i++) {
    sparkVelocities.push(new THREE.Vector3())
    resetSpark(i)
    sparkLife[i] *= Math.random()
}

const sparksGeo = new THREE.BufferGeometry()
sparksGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3))
sparksGeo.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3))

const sparks = new THREE.Points(
    sparksGeo,
    new THREE.PointsMaterial({
        size: 0.18 * CONFIG.shipScale,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        fog: false,
    })
)
sparks.frustumCulled = false
scene.add(sparks)

function updateSparks(dt) {
    for (let i = 0; i < CONFIG.sparkCount; i++) {
        sparkLife[i] -= dt
        if (sparkLife[i] <= 0) resetSpark(i)

        sparkVelocities[i].y -= 3 * dt
        sparkPositions[i * 3] += sparkVelocities[i].x * dt
        sparkPositions[i * 3 + 1] += sparkVelocities[i].y * dt
        sparkPositions[i * 3 + 2] += sparkVelocities[i].z * dt

        const fade = sparkLife[i] / sparkMaxLife[i]
        sparkColors[i * 3] = 1.0 * fade
        sparkColors[i * 3 + 1] = 0.55 * fade
        sparkColors[i * 3 + 2] = 0.15 * fade
    }
    sparksGeo.attributes.position.needsUpdate = true
    sparksGeo.attributes.color.needsUpdate = true
}

// Кристали
const crystalVertexShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPos;

    void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
`

const crystalFragmentShader = `
    uniform float uTime;
    uniform float uGlow;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    varying vec3 vNormal;
    varying vec3 vWorldPos;

    void main() {
        float phase = vWorldPos.x * 0.15 + vWorldPos.z * 0.15;
        float mixAmount = 0.5 + 0.5 * sin(uTime * 0.8 + phase);
        vec3 color = mix(uColorA, uColorB, mixAmount);

        float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + phase);
        float rim = 1.0 - abs(normalize(vNormal).z);

        float brightness = (0.5 + rim * 1.2) * pulse * uGlow;
        gl_FragColor = vec4(color * brightness, 1.0);
    }
`

const crystalUniforms = {
    uTime: { value: 0 },
    uGlow: { value: CONFIG.crystalGlow },
}

function createCrystalMaterial(colorA, colorB) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: crystalUniforms.uTime,
            uGlow: crystalUniforms.uGlow,
            uColorA: { value: new THREE.Color(colorA) },
            uColorB: { value: new THREE.Color(colorB) },
        },
        vertexShader: crystalVertexShader,
        fragmentShader: crystalFragmentShader,
    })
}

const crystalMats = {
    cyan: createCrystalMaterial(0x2fe8ff, 0x4a7bff),
    purple: createCrystalMaterial(0xb34dff, 0xff4fd8),
}

const crystalGeo = new THREE.OctahedronGeometry(1, 0)

function createCrystal(x, z, scale, tilt, material) {
    const crystal = new THREE.Mesh(crystalGeo, material)
    crystal.scale.set(scale * 0.45, scale * 1.8, scale * 0.45)
    crystal.position.set(x, getGroundHeight(x, z) + scale, z)
    crystal.rotation.z = tilt
    crystal.rotation.y = seededRandom() * Math.PI
    crystal.castShadow = true
    scene.add(crystal)

    addObstacle(x, z, THREE.MathUtils.clamp(scale * 0.45, 0.5, 0.8))
}

let crystalLightsLeft = 3
const STATION_CRYSTAL_CLEARANCE = 31

function createCrystalCluster(x, z, isCyan, size) {
    const dxS = x - stationX
    const dzS = z - stationZ
    const distS = Math.hypot(dxS, dzS)
    if (distS < STATION_CRYSTAL_CLEARANCE) {
        const k = STATION_CRYSTAL_CLEARANCE / Math.max(distS, 0.001)
        x = stationX + dxS * k
        z = stationZ + dzS * k
    }

    const material = isCyan ? crystalMats.cyan : crystalMats.purple
    createCrystal(x, z, size, (seededRandom() - 0.5) * 0.4, material)
    createCrystal(x + 0.7 * size, z + 0.3 * size, size * 0.6, 0.5, material)
    createCrystal(x - 0.5 * size, z - 0.5 * size, size * 0.5, -0.6, material)

    if (crystalLightsLeft > 0) {
        crystalLightsLeft--
        const light = new THREE.PointLight(isCyan ? 0x2fe8ff : 0xb34dff, 45, 9, 2)
        light.position.set(x, getGroundHeight(x, z) + 1.2, z)
        scene.add(light)
    }
}

const nearCrystalSpots = [
    { along: -8, side: 16, isCyan: true, size: 1.4 },
    { along: 6, side: -15, isCyan: false, size: 1.2 },
    { along: 16, side: 14, isCyan: true, size: 1.1 },
]
nearCrystalSpots.forEach((c) => {
    const p = shipPoint(c.along, c.side)
    createCrystalCluster(p.x, p.z, c.isCyan, c.size)
})

for (let i = 0; i < 22; i++) {
    const spot = randomSpot(20, 85)
    createCrystalCluster(spot.x, spot.z, i % 2 === 0, 0.8 + seededRandom() * 1.0)
}

// Ровер
const roverBodyMat = new THREE.MeshStandardMaterial({
    ...loadPBRMaterial(`${textureBasePath}Metal041A_1K-JPG/Metal041A_1K-JPG_`),
    metalness: 0.5,
    roughness: 0.4,
})
const roverDarkMat = new THREE.MeshStandardMaterial({
    ...loadPBRMaterial(`${textureBasePath}Metal063_1K-JPG/Metal063_1K-JPG_`),
    metalness: 0.8,
    roughness: 0.3,
})
const wheelMat = new THREE.MeshStandardMaterial({
    ...loadPBRMaterial(`${textureBasePath}Metal027_1K-JPG/Metal027_1K-JPG_`, { metalness: false }),
    metalness: 0.5,
    roughness: 0.7,
})
const lensMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xcfeaff, emissiveIntensity: 4 })

const rover = new THREE.Group()
rover.rotation.order = 'YZX'
scene.add(rover)

addPart(new RoundedBoxGeometry(1.6, 0.45, 1.1, 4, 0.1), roverBodyMat, 0, 0.55, 0, rover)
addPart(new RoundedBoxGeometry(0.8, 0.35, 0.8, 4, 0.08), roverDarkMat, -0.2, 0.95, 0, rover)
addPart(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), roverDarkMat, -0.5, 1.3, 0.25, rover)

// Фара
const lens = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), lensMat)
lens.position.set(0.85, 0.7, 0)
rover.add(lens)

const headlight = new THREE.SpotLight(0xcfeaff, 250, 45, 0.5, 0.6, 2)
headlight.position.set(0.9, 0.7, 0)
headlight.castShadow = true
headlight.shadow.mapSize.set(1024, 1024)
headlight.shadow.bias = -0.0005
rover.add(headlight)

headlight.target.position.set(10, 0, 0)
rover.add(headlight.target)

// Колеса
const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 20)
wheelGeo.rotateX(Math.PI / 2)
const wheels = []
for (const wx of [-0.55, 0.55]) {
    for (const wz of [-0.62, 0.62]) {
        wheels.push(addPart(wheelGeo, wheelMat, wx, 0.3, wz, rover))
    }
}

// Керування ровером
const keyMap = {
    KeyW: 'forward',
    ArrowUp: 'forward',
    KeyS: 'backward',
    ArrowDown: 'backward',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
}
const keys = { forward: false, backward: false, left: false, right: false }

window.addEventListener('keydown', (e) => {
    const action = keyMap[e.code]
    if (!action) return
    e.preventDefault()
    keys[action] = true
})

window.addEventListener('keyup', (e) => {
    const action = keyMap[e.code]
    if (action) keys[action] = false
})

window.addEventListener('blur', () => {
    for (const action in keys) keys[action] = false
})

let roverHeading = 2.9
let roverSpeedNow = 0
rover.position.set(14, getGroundHeight(14, 14), 14)

const MAP_LIMIT = 90
const currentPos = new THREE.Vector3()
const nextPos = new THREE.Vector3()

function isBlocked(from, to) {
    for (const obstacle of obstacles) {
        const minDistance = ROVER_RADIUS + obstacle.radius
        const distNext = to.distanceTo(obstacle.pos)
        if (distNext < minDistance && distNext < from.distanceTo(obstacle.pos)) {
            return true
        }
    }
    return false
}

function updateRover(dt) {
    if (keys.left) roverHeading += CONFIG.roverTurnSpeed * dt
    if (keys.right) roverHeading -= CONFIG.roverTurnSpeed * dt

    let targetSpeed = 0
    if (keys.forward) targetSpeed += CONFIG.roverSpeed
    if (keys.backward) targetSpeed -= CONFIG.roverSpeed * 0.6

    roverSpeedNow += (targetSpeed - roverSpeedNow) * Math.min(1, 4 * dt)

    const dirX = Math.cos(roverHeading)
    const dirZ = -Math.sin(roverHeading)

    currentPos.set(rover.position.x, 0, rover.position.z)
    nextPos.set(
        THREE.MathUtils.clamp(rover.position.x + dirX * roverSpeedNow * dt, -MAP_LIMIT, MAP_LIMIT),
        0,
        THREE.MathUtils.clamp(rover.position.z + dirZ * roverSpeedNow * dt, -MAP_LIMIT, MAP_LIMIT)
    )

    if (isBlocked(currentPos, nextPos)) {
        roverSpeedNow = 0
    } else {
        rover.position.x = nextPos.x
        rover.position.z = nextPos.z
    }

    const x = rover.position.x
    const z = rover.position.z
    const rightX = Math.sin(roverHeading)
    const rightZ = Math.cos(roverHeading)

    const hFront = getGroundHeight(x + dirX * 0.8, z + dirZ * 0.8)
    const hBack = getGroundHeight(x - dirX * 0.8, z - dirZ * 0.8)
    const hRight = getGroundHeight(x + rightX * 0.6, z + rightZ * 0.6)
    const hLeft = getGroundHeight(x - rightX * 0.6, z - rightZ * 0.6)

    rover.position.y = (hFront + hBack + hRight + hLeft) / 4

    const pitch = Math.atan2(hFront - hBack, 1.6)
    const roll = -Math.atan2(hRight - hLeft, 1.2)
    rover.rotation.set(roll, roverHeading, pitch)

    wheels.forEach((wheel) => {
        wheel.rotation.z -= (roverSpeedNow * dt) / 0.3
    })
}

const previousRoverPos = rover.position.clone()

function updateCameraFollow() {
    const delta = rover.position.clone().sub(previousRoverPos)
    previousRoverPos.copy(rover.position)

    if (CONFIG.followRover) {
        camera.position.add(delta)
        controls.target.add(delta)
    }
}

function updateMoonLight() {
    moonLight.target.position.copy(rover.position)
    moonLight.position.copy(rover.position).add(moonLightOffset)
}


// Пил з-під коліс
const ROVER_DUST_COUNT = 150
const ROVER_DUST_SPAWN_RATE = 70
const ROVER_DUST_BASE_SIZE = 0.22
const ROVER_DUST_GROWTH = 3.2
const ROVER_DUST_WHEEL_X = 0.55
const ROVER_DUST_WHEEL_Z = 0.62

const roverDustPositions = new Float32Array(ROVER_DUST_COUNT * 3)
const roverDustColors = new Float32Array(ROVER_DUST_COUNT * 3)
const roverDustAlphas = new Float32Array(ROVER_DUST_COUNT)
const roverDustSizes = new Float32Array(ROVER_DUST_COUNT)
const roverDustLife = new Float32Array(ROVER_DUST_COUNT)
const roverDustMaxLife = new Float32Array(ROVER_DUST_COUNT)
const roverDustVelocities = []

{
    const grayViolet = new THREE.Color(0x9a86b8)
    const teal = new THREE.Color(0x6fd3d0)
    const tmpColor = new THREE.Color()
    for (let i = 0; i < ROVER_DUST_COUNT; i++) {
        roverDustVelocities.push(new THREE.Vector3())
        tmpColor.copy(grayViolet).lerp(teal, Math.random())
        roverDustColors[i * 3] = tmpColor.r
        roverDustColors[i * 3 + 1] = tmpColor.g
        roverDustColors[i * 3 + 2] = tmpColor.b
        roverDustMaxLife[i] = 1
    }
}

const roverDustGeo = new THREE.BufferGeometry()
roverDustGeo.setAttribute('position', new THREE.BufferAttribute(roverDustPositions, 3).setUsage(THREE.DynamicDrawUsage))
roverDustGeo.setAttribute('aColor', new THREE.BufferAttribute(roverDustColors, 3))
roverDustGeo.setAttribute('aAlpha', new THREE.BufferAttribute(roverDustAlphas, 1).setUsage(THREE.DynamicDrawUsage))
roverDustGeo.setAttribute('aSize', new THREE.BufferAttribute(roverDustSizes, 1).setUsage(THREE.DynamicDrawUsage))

const roverDustMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uOpacity: { value: 0.4 },
        uScale: { value: sizes.height * pixelRatio * 0.5 },
    },
    vertexShader: `
        attribute vec3 aColor;
        attribute float aAlpha;
        attribute float aSize;
        uniform float uScale;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vColor = aColor;
            vAlpha = aAlpha;
            gl_PointSize = aSize * uScale / -mvPosition.z;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            float soft = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vColor, soft * vAlpha * uOpacity);
        }
    `,
    transparent: true,
    depthWrite: false,
})

const roverDust = new THREE.Points(roverDustGeo, roverDustMaterial)
roverDust.frustumCulled = false
scene.add(roverDust)

let roverDustCursor = 0
let roverDustSpawnAccum = 0
let roverDustSideToggle = false
const roverDustLocal = new THREE.Vector3()

function spawnRoverDust(wheelLocalX, wheelLocalZ) {
    const i = roverDustCursor
    roverDustCursor = (roverDustCursor + 1) % ROVER_DUST_COUNT

    roverDustLocal.set(wheelLocalX, 0.1, wheelLocalZ)
    rover.localToWorld(roverDustLocal)

    roverDustPositions[i * 3] = roverDustLocal.x + (Math.random() - 0.5) * 0.15
    roverDustPositions[i * 3 + 1] = roverDustLocal.y
    roverDustPositions[i * 3 + 2] = roverDustLocal.z + (Math.random() - 0.5) * 0.15

    const dirX = Math.cos(roverHeading)
    const dirZ = -Math.sin(roverHeading)
    const rightX = Math.sin(roverHeading)
    const rightZ = Math.cos(roverHeading)
    const moveSign = Math.sign(roverSpeedNow)
    const speedAbs = Math.abs(roverSpeedNow)

    const side = Math.sign(wheelLocalZ) * (0.3 + Math.random() * 0.7) + (Math.random() - 0.5) * 0.6
    roverDustVelocities[i].set(
        -dirX * moveSign * speedAbs * 0.2 + rightX * side,
        0.6 + Math.random() * 1.0,
        -dirZ * moveSign * speedAbs * 0.2 + rightZ * side
    )

    roverDustMaxLife[i] = 0.8 + Math.random() * 0.7
    roverDustLife[i] = roverDustMaxLife[i]
}

function updateRoverDust(dt) {
    roverDustMaterial.uniforms.uScale.value = sizes.height * pixelRatio * 0.5

    const speedAbs = Math.abs(roverSpeedNow)
    if (speedAbs > 0.5) {
        rover.updateMatrixWorld(true)
        const speedRatio = Math.min(1, speedAbs / Math.max(CONFIG.roverSpeed, 1))
        roverDustSpawnAccum += dt * ROVER_DUST_SPAWN_RATE * speedRatio

        const rearX = -Math.sign(roverSpeedNow) * ROVER_DUST_WHEEL_X
        while (roverDustSpawnAccum >= 1) {
            roverDustSpawnAccum -= 1
            roverDustSideToggle = !roverDustSideToggle
            spawnRoverDust(rearX, roverDustSideToggle ? ROVER_DUST_WHEEL_Z : -ROVER_DUST_WHEEL_Z)
        }
    } else {
        roverDustSpawnAccum = 0
    }

    const drag = Math.max(0, 1 - 1.8 * dt)
    for (let i = 0; i < ROVER_DUST_COUNT; i++) {
        if (roverDustLife[i] <= 0) {
            roverDustAlphas[i] = 0
            roverDustSizes[i] = 0
            continue
        }

        roverDustLife[i] -= dt
        if (roverDustLife[i] <= 0) {
            roverDustAlphas[i] = 0
            roverDustSizes[i] = 0
            continue
        }

        const v = roverDustVelocities[i]
        v.x *= drag
        v.z *= drag
        v.y = v.y * (1 - 0.8 * dt) + 0.3 * dt 

        roverDustPositions[i * 3] += v.x * dt
        roverDustPositions[i * 3 + 1] += v.y * dt
        roverDustPositions[i * 3 + 2] += v.z * dt

        const t = 1 - roverDustLife[i] / roverDustMaxLife[i]
        const fadeIn = Math.min(1, t * 10)
        const fadeOut = (1 - t) * (1 - t)
        roverDustAlphas[i] = fadeIn * fadeOut
        roverDustSizes[i] = ROVER_DUST_BASE_SIZE * (1 + t * ROVER_DUST_GROWTH)
    }

    roverDustGeo.attributes.position.needsUpdate = true
    roverDustGeo.attributes.aAlpha.needsUpdate = true
    roverDustGeo.attributes.aSize.needsUpdate = true
}

// Пил
const FLOATING_DUST_COUNT = 600
const FLOATING_DUST_AREA = { x: 120, y: 40, z: 120 }
const FLOATING_DUST_CENTER_Y = 18

const floatingDustBase = new Float32Array(FLOATING_DUST_COUNT * 3)
const floatingDustPositions = new Float32Array(FLOATING_DUST_COUNT * 3)

for (let i = 0; i < FLOATING_DUST_COUNT; i++) {
    floatingDustBase[i * 3] = (Math.random() - 0.5) * FLOATING_DUST_AREA.x
    floatingDustBase[i * 3 + 1] = FLOATING_DUST_CENTER_Y + (Math.random() - 0.5) * FLOATING_DUST_AREA.y
    floatingDustBase[i * 3 + 2] = (Math.random() - 0.5) * FLOATING_DUST_AREA.z
}
floatingDustPositions.set(floatingDustBase)

const floatingDustGeo = new THREE.BufferGeometry()
floatingDustGeo.setAttribute('position', new THREE.BufferAttribute(floatingDustPositions, 3).setUsage(THREE.DynamicDrawUsage))

const floatingDust = new THREE.Points(
    floatingDustGeo,
    new THREE.PointsMaterial({
        color: 0x88e5ff,
        size: 0.15,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
    })
)
floatingDust.frustumCulled = false
scene.add(floatingDust)

function updateFloatingDust(elapsed) {
    for (let i = 0; i < FLOATING_DUST_COUNT; i++) {
        const phase = elapsed * 0.5 + i
        floatingDustPositions[i * 3] = floatingDustBase[i * 3] + Math.cos(phase) * 1.2
        floatingDustPositions[i * 3 + 1] = floatingDustBase[i * 3 + 1] + Math.sin(phase) * 0.8
    }
    floatingDustGeo.attributes.position.needsUpdate = true
}

// Моноліт
const MONOLITH_POS = { x: -35, z: -70 }
const MONOLITH_YAW = Math.atan2(-MONOLITH_POS.x, -MONOLITH_POS.z)
const MONOLITH_GLOW_IDLE = 0.1
const MONOLITH_GLOW_ACTIVE = 3.5
const MONOLITH_GLOW_RADIUS = 20
const MONOLITH_BURY = 1.5

function monolithLocalToWorld(lx, lz) {
    const c = Math.cos(MONOLITH_YAW)
    const s = Math.sin(MONOLITH_YAW)
    return {
        x: MONOLITH_POS.x + c * lx + s * lz,
        z: MONOLITH_POS.z - s * lx + c * lz,
    }
}

const monolithGlowMat = new THREE.MeshStandardMaterial({
    color: 0x001122,
    emissive: 0x00f0ff,
    emissiveIntensity: MONOLITH_GLOW_IDLE,
})

const monolithGroup = new THREE.Group()
monolithGroup.position.set(MONOLITH_POS.x, getGroundHeight(MONOLITH_POS.x, MONOLITH_POS.z), MONOLITH_POS.z)
monolithGroup.rotation.y = MONOLITH_YAW
scene.add(monolithGroup)

function addGlowPart(geometry, x, y, z, parent) {
    const glow = addPart(geometry, monolithGlowMat, x, y, z, parent)
    glow.castShadow = false
    glow.receiveShadow = false
    return glow
}

function addMonolithColumn(localX, height, tilt) {
    const column = addPart(
        new THREE.BoxGeometry(1.6, height, 1.6),
        darkMetalMat,
        localX,
        height / 2 - MONOLITH_BURY,
        0,
        monolithGroup
    )
    column.rotation.z = tilt

    const stripGeo = new THREE.BoxGeometry(0.1, height * 0.8, 0.05)
    for (const sx of [-0.45, 0.45]) {
        for (const sz of [-1, 1]) {
            addGlowPart(stripGeo, sx, 0, sz * 0.81, column)
        }
    }

    const ringGeo = new THREE.BoxGeometry(1.66, 0.1, 1.66)
    for (const t of [-0.3, 0.05, 0.35]) {
        addGlowPart(ringGeo, 0, t * height, 0, column)
    }
    return column
}

// Дві колони
addMonolithColumn(-3.4, 13, -0.05)
addMonolithColumn(3.4, 9.5, 0.1)

const lintel = addPart(new THREE.BoxGeometry(5.2, 1.3, 1.9), darkMetalMat, -1.1, 12.1, 0, monolithGroup)
lintel.rotation.z = -0.12
addGlowPart(new THREE.BoxGeometry(4.2, 0.08, 0.05), -1.1, 11.4, 0.96, monolithGroup).rotation.z = -0.12

const fallenLintel = addPart(new THREE.BoxGeometry(2.8, 1.2, 1.7), darkMetalMat, 5.2, 0.5, 1.6, monolithGroup)
fallenLintel.rotation.set(0.1, 0.6, 0.3)
const fallenTop = addPart(new THREE.BoxGeometry(1.5, 1.1, 1.5), darkMetalMat, 4.6, 0.3, -1.8, monolithGroup)
fallenTop.rotation.set(0.3, 0.9, 0.2)

const rubbleGeo = new THREE.DodecahedronGeometry(1, 0)
for (const [rx, rz, rs] of [[-5.6, 1.4, 0.7], [-4.4, -1.6, 0.5], [1.2, 1.8, 0.45], [-1.8, 2.4, 0.6]]) {
    const rubble = addPart(rubbleGeo, rockMaterial, rx, 0.1, rz, monolithGroup)
    rubble.scale.setScalar(rs)
    rubble.rotation.set(seededRandom() * 3, seededRandom() * 3, seededRandom() * 3)
}

for (const [lx, lz, radius] of [[-3.4, 0, 1.3], [3.4, 0, 1.3], [5.2, 1.6, 1.2]]) {
    const p = monolithLocalToWorld(lx, lz)
    addObstacle(p.x, p.z, radius)
}

// Світлові смуги
function updateMonolith(dt) {
    const dx = rover.position.x - monolithGroup.position.x
    const dz = rover.position.z - monolithGroup.position.z
    const distance = Math.hypot(dx, dz)

    const target = distance < MONOLITH_GLOW_RADIUS ? MONOLITH_GLOW_ACTIVE : MONOLITH_GLOW_IDLE
    monolithGlowMat.emissiveIntensity = THREE.MathUtils.lerp(
        monolithGlowMat.emissiveIntensity,
        target,
        1 - Math.exp(-3 * dt)
    )
}

// Зламаний ровер
const brokenRover = new THREE.Group()
brokenRover.position.set(-25, getGroundHeight(-25, -58) + 0.3, -58)
brokenRover.rotation.set(0.28, 1.1, -0.35)
scene.add(brokenRover)

addPart(
    new RoundedBoxGeometry(2.2, 0.7, 1.4, 4, 0.12),
    darkMetalMat,
    0,
    0.25,
    0,
    brokenRover
)
addPart(
    new RoundedBoxGeometry(1.05, 0.5, 0.95, 4, 0.1),
    darkMetalMat,
    -0.15,
    0.78,
    0,
    brokenRover
)

const brokenAntenna = addPart(
    new THREE.CylinderGeometry(0.035, 0.055, 0.85, 8),
    darkMetalMat,
    -0.78,
    0.82,
    0.18,
    brokenRover
)
brokenAntenna.rotation.set(0.25, 0, 0.55)

for (const [x, z, tilt] of [
    [-0.72, 0.68, -0.2],
    [-0.72, -0.68, 0.18],
    [0.72, -0.68, -0.3],
]) {
    const wheel = addPart(wheelGeo, wheelMat, x, -0.05, z, brokenRover)
    wheel.rotation.x += tilt
}

const fallenWheelPosition = brokenRover.localToWorld(new THREE.Vector3(1.4, 0, -0.8))
const fallenWheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 20)
const fallenWheel = addPart(
    fallenWheelGeo,
    wheelMat,
    fallenWheelPosition.x,
    getGroundHeight(fallenWheelPosition.x, fallenWheelPosition.z) + 0.13,
    fallenWheelPosition.z,
    scene
)
fallenWheel.rotation.y = 0.4

addObstacle(-25, -58, 1.8)

// Науковий модуль
const researchStation = new THREE.Group()
researchStation.scale.setScalar(2.2)
researchStation.rotation.y = -Math.PI * 0.35
researchStation.position.set(stationX, STATION_PAD_Y, stationZ)
scene.add(researchStation)

const stationHullPBR = loadPBRMaterial(`${textureBasePath}Metal061B_1K-JPG/Metal061B_1K-JPG_`, { repeatX: 6, repeatY: 3 })
const stationHullMat = new THREE.MeshStandardMaterial({
    map: stationHullPBR.map,
    normalMap: stationHullPBR.normalMap,
    roughnessMap: stationHullPBR.roughnessMap,
    metalnessMap: stationHullPBR.metalnessMap,
    color: 0xd8e2ec,
    roughness: 0.45,
    metalness: 0.5,
})

const stationWindowMat = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xffaa00,
    emissiveIntensity: 3,
})

const HEX_APOTHEM = Math.cos(Math.PI / 6)

function addStationWindows(centerX, wallRadius, y, skipAngleDeg) {
    const apothem = wallRadius * HEX_APOTHEM
    for (let i = 0; i < 6; i++) {
        const deg = 30 + 60 * i
        if (deg === skipAngleDeg) continue
        const angle = (deg * Math.PI) / 180
        const dirX = Math.sin(angle)
        const dirZ = Math.cos(angle)

        const frame = addPart(
            new THREE.BoxGeometry(1.15, 0.8, 0.14),
            darkMetalMat,
            centerX + dirX * (apothem + 0.04),
            y,
            dirZ * (apothem + 0.04),
            researchStation
        )
        frame.rotation.y = angle

        const pane = addPart(
            new THREE.BoxGeometry(0.9, 0.55, 0.06),
            stationWindowMat,
            centerX + dirX * (apothem + 0.11),
            y,
            dirZ * (apothem + 0.11),
            researchStation
        )
        pane.rotation.y = angle
        pane.castShadow = false
    }
}

function addHexModule({ x, baseRadius, wallRadius, wallHeight, roofRadius }) {
    const baseH = 0.5
    const roofH = 0.5

    addPart(new THREE.CylinderGeometry(baseRadius - 0.1, baseRadius - 0.1, 2, 6), darkMetalMat, x, -0.5, 0, researchStation)
    addPart(new THREE.CylinderGeometry(baseRadius, baseRadius, baseH, 6), darkMetalMat, x, baseH / 2, 0, researchStation)

    addPart(new THREE.CylinderGeometry(wallRadius, wallRadius, wallHeight, 6), stationHullMat, x, baseH + wallHeight / 2, 0, researchStation)

    const beltR = wallRadius * 1.03
    addPart(new THREE.CylinderGeometry(beltR, beltR, 0.18, 6), darkMetalMat, x, baseH + 0.09, 0, researchStation)
    addPart(new THREE.CylinderGeometry(beltR, beltR, 0.22, 6), darkMetalMat, x, baseH + wallHeight - 0.11, 0, researchStation)

    const roofY = baseH + wallHeight + roofH / 2
    addPart(new THREE.CylinderGeometry(roofRadius, wallRadius, roofH, 6), stationHullMat, x, roofY, 0, researchStation)
    addPart(new THREE.CylinderGeometry(roofRadius * 0.98, roofRadius * 0.98, 0.14, 6), darkMetalMat, x, baseH + wallHeight + roofH + 0.07, 0, researchStation)

    return baseH + wallHeight + roofH + 0.14
}

const leftRoofY = addHexModule({ x: -6, baseRadius: 5.6, wallRadius: 5.0, wallHeight: 3.6, roofRadius: 3.7 })
addStationWindows(-6, 5.0, 2.5, 90)

const rightRoofY = addHexModule({ x: 6, baseRadius: 4.7, wallRadius: 4.0, wallHeight: 3.2, roofRadius: 2.9 })
addStationWindows(6, 4.0, 2.3, 270)

const solarPBR = loadPBRMaterial(`${import.meta.env.BASE_URL}Details/SolarPanel003_1K-JPG/SolarPanel003_1K-JPG_`, { repeatX: 2, repeatY: 1 })
const solarPanelMat = new THREE.MeshStandardMaterial({
    map: solarPBR.map,
    normalMap: solarPBR.normalMap,
    roughnessMap: solarPBR.roughnessMap,
    metalnessMap: solarPBR.metalnessMap,
    roughness: 0.25,
    metalness: 0.8,
})

const canisterPBR = loadPBRMaterial(`${import.meta.env.BASE_URL}Details/Metal047A_1K-JPG/Metal047A_1K-JPG_`)
const canisterMat = new THREE.MeshStandardMaterial({
    map: canisterPBR.map,
    normalMap: canisterPBR.normalMap,
    roughnessMap: canisterPBR.roughnessMap,
    metalnessMap: canisterPBR.metalnessMap,
    color: 0xff6600,
    roughness: 0.35,
    metalness: 0.7,
})

const cratePBR = loadPBRMaterial(`${import.meta.env.BASE_URL}Details/Metal021_1K-JPG/Metal021_1K-JPG_`)
const crateMat = new THREE.MeshStandardMaterial({
    map: cratePBR.map,
    normalMap: cratePBR.normalMap,
    roughnessMap: cratePBR.roughnessMap,
    metalnessMap: cratePBR.metalnessMap,
    color: 0x8a99a6,
    roughness: 0.45,
    metalness: 0.6,
})

// Сонячна панель
addPart(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 8), darkMetalMat, 6, rightRoofY + 0.45, 0, researchStation)
const solarPanel = addPart(
    new THREE.BoxGeometry(3.2, 0.12, 2.0),
    solarPanelMat,
    6,
    rightRoofY + 1.0,
    0,
    researchStation
)
solarPanel.rotation.set(-0.3, 0.25, 0)

// Тунель між модулями
addPart(new THREE.BoxGeometry(7.5, 2.9, 2.6), darkMetalMat, 0, 0.95, 0, researchStation)
addPart(new THREE.BoxGeometry(2.4, 2.9, 1.4), darkMetalMat, 0, 0.95, 1.5, researchStation)

// Двері
const doorPBR = loadPBRMaterial(`${import.meta.env.BASE_URL}laboratory%20station/Metal044A_1K-JPG/Metal044A_1K-JPG_`, { repeatX: 1, repeatY: 1 })
const doorMat = new THREE.MeshStandardMaterial({
    map: doorPBR.map,
    normalMap: doorPBR.normalMap,
    roughnessMap: doorPBR.roughnessMap,
    metalnessMap: doorPBR.metalnessMap,
    color: 0xc8d4e0,
    roughness: 0.35,
    metalness: 0.75,
})
addPart(new THREE.BoxGeometry(1.4, 1.7, 0.1), doorMat, 0, 1.0, 2.23, researchStation)
for (const x of [-0.8, 0.8]) {
    addPart(new THREE.BoxGeometry(0.16, 1.95, 0.18), darkMetalMat, x, 1.05, 2.24, researchStation)
}
addPart(new THREE.BoxGeometry(1.75, 0.16, 0.18), darkMetalMat, 0, 2.03, 2.24, researchStation)

const airlockLightMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 3,
})
addPart(new THREE.BoxGeometry(0.9, 0.12, 0.08), airlockLightMat, 0, 2.22, 2.25, researchStation).castShadow = false
const airlockLight = new THREE.PointLight(0x00e5ff, 25, 8)
airlockLight.position.set(0, 2.5, 2.8)
researchStation.add(airlockLight)

addPart(new THREE.BoxGeometry(2.2, 0.16, 1.2), darkMetalMat, 0, 0.08, 2.8, researchStation)

addPart(new THREE.CylinderGeometry(0.35, 0.45, 0.2, 8), darkMetalMat, -6, leftRoofY + 0.1, 0.8, researchStation)
addPart(new THREE.CylinderGeometry(0.08, 0.12, 1.6, 6), darkMetalMat, -6, leftRoofY + 0.9, 0.8, researchStation)
const dish = addPart(
    new THREE.CylinderGeometry(0.2, 1.05, 0.22, 8),
    darkMetalMat,
    -6,
    leftRoofY + 1.8,
    0.8,
    researchStation
)
dish.rotation.set(0.45, 0.2, 0)

const CRATE_SIZE = 0.7
for (const [x, z, rotation, level] of [
    [-1.6, 3.7, 0.25, 0],
    [-2.4, 3.9, -0.15, 0],
    [-1.9, 3.75, 0.5, 1],
    [1.7, 3.8, -0.3, 0],
    [2.5, 3.6, 0.2, 0],
    [0.2, 4.6, 0.1, 0],
]) {
    const crate = addPart(
        new THREE.BoxGeometry(CRATE_SIZE, CRATE_SIZE, CRATE_SIZE),
        crateMat,
        x,
        CRATE_SIZE / 2 + level * CRATE_SIZE,
        z,
        researchStation
    )
    crate.rotation.y = rotation
}

for (const [x, z] of [[-3.0, 5.2], [-3.7, 5.6], [3.0, 5.2], [3.7, 5.6]]) {
    addPart(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 10), canisterMat, x, 0.45, z, researchStation)
    addPart(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 8), darkMetalMat, x, 0.97, z, researchStation)
}

const stationLight = new THREE.PointLight(0xffaa44, 60, 30)
stationLight.position.set(0, 3.5, 0)
researchStation.add(stationLight)

const angle = -Math.PI * 0.35
const cosA = Math.cos(angle)
const sinA = Math.sin(angle)
addObstacle(stationX + (-6 * 2.2 * cosA), stationZ - (-6 * 2.2 * sinA), 11.5)
addObstacle(stationX + (6 * 2.2 * cosA), stationZ - (6 * 2.2 * sinA), 9.5)
addObstacle(stationX, stationZ, 6)

// Метеорити
const meteorGeo = new THREE.IcosahedronGeometry(1, 1)
const meteors = []

function spawnMeteor(target) {
    const velocity = new THREE.Vector3(
        -6 + (Math.random() - 0.5) * 2,
        -14 + (Math.random() - 0.5) * 2,
        -4 + (Math.random() - 0.5) * 2
    )

    const t = CONFIG.meteorFlightTime
    const g = CONFIG.meteorGravity
    const start = new THREE.Vector3(
        target.x - velocity.x * t,
        target.y - velocity.y * t + 0.5 * g * t * t,
        target.z - velocity.z * t
    )

    const meteorPBR = loadPBRMaterial(`${import.meta.env.BASE_URL}meteorite/Rock035_1K-JPG/Rock035_1K-JPG_`, {
        repeatX: 1,
        repeatY: 1,
        metalness: false,
    })

    const material = new THREE.MeshStandardMaterial({
        map: meteorPBR.map,
        normalMap: meteorPBR.normalMap,
        roughnessMap: meteorPBR.roughnessMap,
        color: 0x1c1921,
        roughness: 0.95,
        flatShading: true,
        emissive: 0xff3300,
        emissiveIntensity: 0.8,
    })
    const size = 0.6 + Math.random() * 0.5
    const mesh = new THREE.Mesh(meteorGeo, material)
    mesh.scale.set(
        size * (0.8 + Math.random() * 0.4),
        size * (0.7 + Math.random() * 0.5),
        size * (0.8 + Math.random() * 0.4)
    )
    mesh.position.copy(start)
    mesh.castShadow = true

    const flame = new THREE.Mesh(
        meteorGeo,
        new THREE.MeshBasicMaterial({
            color: 0xff7700,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
        })
    )
    flame.scale.setScalar(1.35)
    mesh.add(flame)
    scene.add(mesh)

    meteors.push({
        mesh,
        flame,
        velocity,
        radius: size * 0.9,
        spin: new THREE.Vector3(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2),
        landed: false,
        heat: 1,
    })

    if (meteors.length > CONFIG.maxMeteors) removeMeteor(meteors[0])
}

function removeMeteor(meteor) {
    scene.remove(meteor.mesh)
    meteor.mesh.material.dispose()
    meteor.flame.material.dispose()
    meteors.splice(meteors.indexOf(meteor), 1)
}

function clearMeteors() {
    while (meteors.length > 0) removeMeteor(meteors[0])
}

function dropRandomMeteor() {
    const x = rover.position.x + (Math.random() - 0.5) * 30
    const z = rover.position.z + (Math.random() - 0.5) * 30
    spawnMeteor(new THREE.Vector3(x, getGroundHeight(x, z), z))
}

function updateMeteors(dt) {
    for (const meteor of meteors) {
        if (!meteor.landed) {
            meteor.velocity.y -= CONFIG.meteorGravity * dt
            meteor.mesh.position.addScaledVector(meteor.velocity, dt)

            // Обертання в польоті
            meteor.mesh.rotation.x += meteor.spin.x * dt
            meteor.mesh.rotation.y += meteor.spin.y * dt
            meteor.mesh.rotation.z += meteor.spin.z * dt

            // Зіткнення із землею
            const groundY = getGroundHeight(meteor.mesh.position.x, meteor.mesh.position.z)
            if (meteor.mesh.position.y - meteor.radius <= groundY) {
                meteor.landed = true
                meteor.velocity.set(0, 0, 0)
                meteor.mesh.position.y = groundY + meteor.radius * 0.4
                meteor.flame.visible = false
            }
        } else {
            meteor.heat = Math.max(0, meteor.heat - dt * 0.25)
            meteor.mesh.material.emissiveIntensity = 0.3 + meteor.heat * 1.5
        }
    }
}

// Клік мишкою
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let pointerDownX = 0
let pointerDownY = 0

canvas.addEventListener('pointerdown', (e) => {
    pointerDownX = e.clientX
    pointerDownY = e.clientY
})

canvas.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) > 5) return
    pointer.x = (e.clientX / sizes.width) * 2 - 1
    pointer.y = -(e.clientY / sizes.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const hits = raycaster.intersectObject(ground)
    if (hits.length > 0) spawnMeteor(hits[0].point)
})

const gui = new GUI({ title: 'Панель керування' })

gui.add({ hint: 'WASD / стрілки' }, 'hint').name('Керування ровером').disable()
gui.add(CONFIG, 'roverSpeed', 0, 15, 0.5).name('Швидкість ровера')
gui.add(CONFIG, 'fogDensity', 0, 0.04, 0.001).name('Густина туману').onChange((v) => {
    scene.fog.density = v
})

gui.add(CONFIG, 'crystalGlow', 0, 4, 0.05).name('Яскравість кристалів').onChange((v) => {
    crystalUniforms.uGlow.value = v
})

gui.add(CONFIG, 'followRover')
    .name('Камера слідує за ровером')
    .onChange((enabled) => {
        if (enabled) {
            const offset = controls.target.clone().sub(rover.position)
            controls.target.copy(rover.position)
            camera.position.sub(offset)
        }
    })

function copyCameraPose() {
    const f = (v) => v.toFixed(1)
    const p = camera.position
    const t = controls.target
    const text = `camera.position.set(${f(p.x)}, ${f(p.y)}, ${f(p.z)})\ncontrols.target.set(${f(t.x)}, ${f(t.y)}, ${f(t.z)})`
    console.log(text)
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {})
}
gui.add({ copyCameraPose }, 'copyCameraPose').name('Копіювати ракурс камери')

gui.add({ dropRandomMeteor }, 'dropRandomMeteor').name('Скинути метеорит')
gui.add({ clearMeteors }, 'clearMeteors').name('Прибрати метеорити')

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    composer.setSize(sizes.width, sizes.height)
})

const clock = new THREE.Clock()

function animate() {
    const dt = Math.min(clock.getDelta(), 0.05)
    const elapsed = clock.elapsedTime

    shipLight.intensity = 100 + Math.sin(elapsed * 1.2) * 15
    tealGlowMat.emissiveIntensity = 2.0 + Math.sin(elapsed * 1.2) * 0.2
    updateRover(dt)
    updateCameraFollow()
    updateMoonLight()
    updateSparks(dt)
    updateRoverDust(dt)
    updateMeteors(dt)
    updateMonolith(dt)
    updateGrass(elapsed)
    updateFloatingDust(elapsed)
    crystalUniforms.uTime.value = elapsed
    controls.update()
    composer.render()
    requestAnimationFrame(animate)
}

animate()