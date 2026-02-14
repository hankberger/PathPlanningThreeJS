//@ts-nocheck
import * as THREE from 'three'
import { AnimationMixer, Color, Object3D, Vector2, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader';
import Pathing from './PathingBetter';
import { pointInCircleList } from './collision';

// ── Bottom Sheet ──
const sheet = document.getElementById('sheet')!;
const sheetHandle = document.getElementById('sheetHandle')!;
const backdrop = document.getElementById('sheetBackdrop')!;

let sheetOpen = false;
let dragging = false;
let dragStartY = 0;
let sheetStartOffset = 0;
const sheetHeight = () => sheet.offsetHeight;

function openSheet() {
  sheetOpen = true;
  sheet.classList.add('open');
  backdrop.classList.add('visible');
}

function closeSheet() {
  sheetOpen = false;
  sheet.classList.remove('open');
  sheet.style.transform = '';
  backdrop.classList.remove('visible');
}

function onDragStart(clientY: number) {
  dragging = true;
  dragStartY = clientY;
  const current = new DOMMatrix(getComputedStyle(sheet).transform);
  sheetStartOffset = current.m42; // current translateY
  sheet.classList.add('dragging');
}

function onDragMove(clientY: number) {
  if (!dragging) return;
  const dy = clientY - dragStartY;
  const minTranslate = 0;
  const maxTranslate = sheetHeight() - 90;
  const newY = Math.max(minTranslate, Math.min(maxTranslate, sheetStartOffset + dy));
  sheet.style.transform = `translateY(${newY}px)`;
  backdrop.style.opacity = String(1 - newY / maxTranslate);
}

function onDragEnd(clientY: number) {
  if (!dragging) return;
  dragging = false;
  sheet.classList.remove('dragging');
  sheet.style.transform = '';
  backdrop.style.opacity = '';

  const dy = clientY - dragStartY;
  // If dragged down more than 30% of sheet or fast flick down → close, else open
  if (sheetOpen && dy > sheetHeight() * 0.3) {
    closeSheet();
  } else if (!sheetOpen && dy < -40) {
    openSheet();
  } else if (sheetOpen) {
    openSheet();
  } else {
    closeSheet();
  }
}

// Touch events
sheetHandle.addEventListener('touchstart', (e) => {
  onDragStart(e.touches[0].clientY);
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (dragging) onDragMove(e.touches[0].clientY);
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (dragging) onDragEnd(e.changedTouches[0].clientY);
});

// Mouse events (for desktop testing)
sheetHandle.addEventListener('mousedown', (e) => {
  onDragStart(e.clientY);
});
document.addEventListener('mousemove', (e) => {
  if (dragging) onDragMove(e.clientY);
});
document.addEventListener('mouseup', (e) => {
  if (dragging) onDragEnd(e.clientY);
});

// Tap handle to toggle
sheetHandle.addEventListener('click', () => {
  if (!dragging) sheetOpen ? closeSheet() : openSheet();
});

// Tap backdrop to close
backdrop.addEventListener('click', closeSheet);

let path = new Pathing();

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xADD8E6);

// CAMERA
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 5;
camera.position.z = 5;
camera.position.x = 0;

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement);

// CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true
orbitControls.minDistance = 5
orbitControls.maxDistance = 15
orbitControls.enablePan = false
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05
orbitControls.update();

//MOVEMENT
let movements: Vector3[] = [];
let barrelPositions: Vector3[] = [];
let barrelMesh: THREE.InstancedMesh | null = null;
let dummy: THREE.Object3D;
let rotationSet = false;
const speed = .04;

// Reusable objects for InstancedMesh matrix updates
const _tempMatrix = new THREE.Matrix4();
const _tempPosition = new THREE.Vector3();
const _tempQuaternion = new THREE.Quaternion();
const _tempScale = new THREE.Vector3(1, 1, 1);

function updateBarrelInstance(index: number, x: number, y: number, z: number, rotationY: number = 0) {
  if(!barrelMesh) return;
  _tempPosition.set(x, y, z);
  _tempQuaternion.setFromAxisAngle(new Vector3(0, 1, 0), rotationY);
  _tempMatrix.compose(_tempPosition, _tempQuaternion, _tempScale);
  barrelMesh.setMatrixAt(index, _tempMatrix);
}

//OBSTACLES
const numObstacles = 60;
const goalGeo = new THREE.CylinderGeometry( 5, 5, 20, 32 );
const goalMat = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
const goal = new THREE.Mesh( goalGeo, goalMat );

function generateGoal(){
  const freeSpace = setFreeLocation(0, barrelPositions);
  goal.position.set(freeSpace.x, 0, freeSpace.z);
  goal.scale.set(.1, .01, .1);
  goal.material.transparent = true;
  goal.material.opacity = .65
  scene.add( goal );
}



function setFreeLocation(numNodes: number, circleCenters: Vector3[]): Vector3{
    let randPos = new Vector3(Math.random() * 16 - 8, 0, Math.random()* 16 - 8);
    let insideAnyCircle = pointInCircleList(circleCenters, .5, circleCenters.length, randPos,.5);
    let attempts = 0;
    while (insideAnyCircle && attempts < 1000){
      randPos = new Vector3(Math.random() * 16 - 8, 0, Math.random()* 16 - 8);
      insideAnyCircle = pointInCircleList(circleCenters, .5, circleCenters.length, randPos,.5);
      attempts++;
    }

    return randPos;
}

const axesHelper = new THREE.AxesHelper( 5 );
axesHelper.setColors( new Color(0, 0, 255), new Color(255, 0,0), new Color(0, 255, 0));
axesHelper.position.set(-8, 0 , -8);
scene.add( axesHelper );


function move(agent: Object3D, destination: Vector3, dt: number){
    if(!destination){
      console.log("No path found, will retry.");
      movements = [];
      return;
    }

    let curPos = new Vector2(agent.position.x, agent.position.z);
    let goalPos = new Vector2(destination.x, destination.z)

    let dir = new Vector2();
    dir.subVectors(goalPos, curPos);

    let goalRotation = Math.atan2(dir.x, dir.y);



    if(Math.abs((agent.rotation.y) - goalRotation) < .15){
      //Do nothing
    } else if(agent.rotation.y < (agent.rotation.y + goalRotation) / 2){
      agent.rotation.y += .1;
    } else {
      agent.rotation.y -= .1;
    }

    if(dir.length() < .25){
      movements.shift();
      rotationSet = false;
      return;
    }

    if(!((speed*dt) > dir.length())){
      dir.normalize();
    } else {
      agent.position.x = destination.x;
      agent.position.z = destination.z;
    }

    const vel = dir.multiplyScalar(speed);
    agent.position.add(new Vector3(vel.x, 0, vel.y));
    return;
}

let mixer: AnimationMixer;
//Load Model
new GLTFLoader().load('scalefix.gltf', function (gltf) {
    const model = gltf.scene;
    model.castShadow = true;
    model.traverse(c=>{
          c.castShadow = true;
    });
    const dummyposx = Math.random()*16 - 8;
    const dummyposz = Math.random()*16 - 8;
    model.position.x = dummyposx;
    model.position.z = dummyposz;

    dummy = model;

    orbitControls.target = dummy.position;
    orbitControls.update();

    const gltfAnimations: THREE.AnimationClip[] = gltf.animations;
    mixer = new THREE.AnimationMixer(model);
    const animationsMap: Map<string, THREE.AnimationAction> = new Map();
    console.log(animationsMap);
    gltfAnimations.filter(a => a.name != 'TPose').forEach((a: THREE.AnimationClip) => {
        animationsMap.set(a.name, mixer.clipAction(a))
    })
    let anim = animationsMap.get('animation_0');
    console.log(anim);
    anim?.play();
    scene.add(model);

    // Start moving immediately
    const path = new Pathing();
    movements = path.getPath();
});

// Load barrel FBX and create InstancedMesh
const MAX_BARRELS = 60;

new FBXLoader().load('darkblue.fbx', function(fbx){
  fbx.scale.setScalar(0.004);
  fbx.position.set(0, 0, 0);
  fbx.updateMatrixWorld(true);

  let sourceGeometry: THREE.BufferGeometry | null = null;
  let sourceMaterial: THREE.Material | null = null;

  fbx.traverse((child) => {
    if (child.isMesh && !sourceGeometry) {
      sourceGeometry = child.geometry.clone();
      sourceMaterial = child.material;
      // Bake the child's world matrix (includes parent scale) into the geometry
      sourceGeometry.applyMatrix4(child.matrixWorld);
    }
  });

  if (!sourceGeometry || !sourceMaterial) return;

  barrelMesh = new THREE.InstancedMesh(sourceGeometry, sourceMaterial, MAX_BARRELS);
  barrelMesh.count = 0;
  barrelMesh.castShadow = true;
  barrelMesh.receiveShadow = true;
  scene.add(barrelMesh);

  createObstacles();
});

// RESIZE HANDLER
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

function generateFloor() {
    // TEXTURE
    const textureLoader = new THREE.TextureLoader();
    const floorColor = textureLoader.load('/gridbox.png');

    const WIDTH = 80
    const LENGTH = 80

    const geometry = new THREE.PlaneGeometry(WIDTH, LENGTH, 1, 1);
    const material = new THREE.MeshStandardMaterial(
        {
           map: floorColor
        })

        wrapAndRepeatTexture(material.map);

    const floor = new THREE.Mesh(geometry, material)
    floor.receiveShadow = true
    floor.rotation.x = - Math.PI / 2
    scene.add(floor)
}

generateFloor();

function wrapAndRepeatTexture (map: THREE.Texture) {
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.x = map.repeat.y = 10
}

function light() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))

    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(- 60, 100, - 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = - 50;
    dirLight.shadow.camera.left = - 50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);
}

light();

function createObstacles(){
  for(let i = 0; i < numObstacles; i++){
    const posx = Math.random()*16 - 8;
    const posz = Math.random()*16 - 8;
    const rotation = Math.random() * 360;
    const index = barrelPositions.length;
    barrelPositions.push(new Vector3(posx, 0.5, posz));
    updateBarrelInstance(index, posx, 0.5, posz, rotation);
  }

  if(barrelMesh){
    barrelMesh.count = barrelPositions.length;
    barrelMesh.instanceMatrix.needsUpdate = true;
  }

  generateGoal();
}



//Pathing Helper functions
export function getBarrelPositions(): Vector3[]{
  return barrelPositions;
}

export function getStart(){
  console.log(dummy.position);
  return dummy.position;
}

export function getGoal(){
  return goal.position;
}

let nodeVisualzation: Object3D[] = [];
export function visuzlizeNodes(nodes: Vector3[]){
  for(let i of nodeVisualzation){
    scene.remove(i);
  }
  nodeVisualzation = [];
  const geometry = new THREE.CylinderGeometry(.1, .1, .2, 8);
  const material = new THREE.MeshPhongMaterial( {color: 0xffffff} );


  for(let node of nodes){
    const AAA = new THREE.Mesh(geometry, material);
    AAA.position.x = node.x;
    AAA.position.y = .05;
    AAA.position.z = node.z;

    nodeVisualzation.push(AAA);
    scene.add( AAA );
  }

  return;
}

export function visualizeNeighbors(nodes: Vector3[], neighbors: number[][]){
  const material = new THREE.LineBasicMaterial({
    color: 0x0000ff
  });
  for(let i = 0; i < nodes.length; i++){
    for(let j = 0; j < neighbors[i].length; j++){
      const points = [];
      points.push(nodes[i]);
      points.push(nodes[neighbors[i][j]]);
      const geometry = new THREE.BufferGeometry().setFromPoints( points );
      const line = new THREE.Line( geometry, material );
      scene.add(line);
    }
  }
}


export function visualizePath(nodes: Vector3[], neighbors: number[][], path: Vector3[]){
  const material = new THREE.LineBasicMaterial({
    color: 0x0000ff
  });
  visuzlizeNodes(path);

  for(let i = 0; i < path.length - 1; i++){
    const points = [];
    points.push(path[i]);
    points.push(path[i+1]);
    console.log(path, points);
    if(points.length === 0) return;
    const geometry = new THREE.BufferGeometry().setFromPoints( points );
    const line = new THREE.Line( geometry, material );

    scene.add(line);
    nodeVisualzation.push(line);
  }


}

const clock = new THREE.Clock();
var render = function () {
    requestAnimationFrame( render );

    renderer.render(scene, camera);

    if ( movements.length > 0 ) {
      if(mixer){
        mixer.update(clock.getDelta());
      }
      move( dummy, movements[ 0 ], clock.getDelta());
      orbitControls.target = dummy.position;
      orbitControls.update();
    }

    // Agent reached the goal or path failed — randomize and re-path
    if (movements.length === 0 && dummy) {
      generateGoal();
      const path = new Pathing();
      movements = path.getPath();
    }
  };

render();
