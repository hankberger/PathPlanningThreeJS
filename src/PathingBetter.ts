//@ts-nocheck
import { Vector3 } from 'three';
import {getBarrelPositions, visualizePath} from './main';
import { pointInCircleList,rayCircleListIntersect} from './collision';

class MinHeap {
    private heap: [number, number][] = []; // [cost, nodeId]

    push(cost: number, nodeId: number) {
        this.heap.push([cost, nodeId]);
        this._bubbleUp(this.heap.length - 1);
    }

    pop(): [number, number] | undefined {
        if (this.heap.length === 0) return undefined;
        const min = this.heap[0];
        const last = this.heap.pop()!;
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this._sinkDown(0);
        }
        return min;
    }

    get size() { return this.heap.length; }

    private _bubbleUp(i: number) {
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.heap[i][0] >= this.heap[parent][0]) break;
            [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
            i = parent;
        }
    }

    private _sinkDown(i: number) {
        const n = this.heap.length;
        while (true) {
            let smallest = i;
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            if (left < n && this.heap[left][0] < this.heap[smallest][0]) smallest = left;
            if (right < n && this.heap[right][0] < this.heap[smallest][0]) smallest = right;
            if (smallest === i) break;
            [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
            i = smallest;
        }
    }
}

export default class Pathing {
    private obstacles: Vector3[];
    private nodePos: Vector3[];
    private start: Vector3;
    private goal: Vector3;
    private radius: number;
    private neighbors: number[][];
    private numberOfNodes: number;
    private visited: boolean[];
    private parent: number[];

    constructor(){
        this.numberOfNodes = 200;
        this.radius = .6;
        this.neighbors = new Array(this.numberOfNodes).fill([]);
        this.start = new Vector3();
        this.goal = new Vector3();
        this.obstacles = [];

        this.nodePos = [];

        this.visited = [];
        this.parent = [];
    }

    public getPath(start: Vector3, goal: Vector3): Vector3[]{

      this.start = start;
      this.goal = goal;
      this.obstacles = getBarrelPositions();

      // Cache centers once — obstacles are already Vector3[], so just reference them
      const centers = this.obstacles;
      const numObstacles = this.obstacles.length;

        this.generateRandomNodes(this.numberOfNodes, centers, numObstacles);

        this.connectNeighbors(centers, this.radius, numObstacles, this.nodePos, this.numberOfNodes);

        const startID = this.closestNode(this.start, this.nodePos, this.numberOfNodes, centers, this.radius, numObstacles);
        const goalID = this.closestNode(this.goal, this.nodePos, this.numberOfNodes, centers, this.radius, numObstacles);
        console.log("start:", startID, "goalid:", goalID)

        const nodeOrder = this.runUCS(this.nodePos, this.numberOfNodes, startID, goalID);



        if(nodeOrder.length === 0){
          console.log("case 1");
          return [this.nodePos[startID], this.nodePos[goalID]];
        }

        if(nodeOrder[0] === -1){
          console.log("case 2: no path found");
          return [];
        }

        const retPath = [];
        console.log(nodeOrder);
        for(let i = 0; i < nodeOrder.length; i++){
          retPath.push(this.nodePos[nodeOrder[i]])
        }

        retPath.push(this.goal);

        visualizePath(this.nodePos, this.neighbors, retPath);
        return retPath;

    }

    private generateRandomNodes(numNodes: number, circleCenters: Vector3[], numObstacles: number){
        for (let i = 0; i < numNodes; i++){
          let randPos = new Vector3(Math.random() * 16 - 8, 0, Math.random()* 16 - 8);
          let insideAnyCircle = pointInCircleList(circleCenters, this.radius, numObstacles, randPos,.2);
          let attempts = 0;
          while (insideAnyCircle && attempts < 1000){
            randPos = new Vector3(Math.random() * 16 - 8, 0, Math.random()* 16 - 8);
            insideAnyCircle = pointInCircleList(circleCenters, this.radius, numObstacles, randPos,.2);
            attempts++;
          }
          this.nodePos[i] = randPos;
        }
    }

    private connectNeighbors(centers: Vector3[], radii: number, numObstacles: number, nodePos: Vector3[], numNodes: number){
      const MAX_NEIGHBOR_DIST = 5;
      for (let i = 0; i < numNodes; i++){
          this.neighbors[i] = [];
          for (let j = 0; j < numNodes; j++){
          if (i == j) continue;
          const distBetween = nodePos[i].distanceTo(nodePos[j]);
          if (distBetween > MAX_NEIGHBOR_DIST) continue;
          let dir = new Vector3();
          dir.subVectors(nodePos[j], nodePos[i]).normalize();
          const circleListCheck = rayCircleListIntersect(centers, radii, numObstacles, nodePos[i], dir, distBetween);
          if (!circleListCheck.hit){
              this.neighbors[i].push(j);
          }
          }
      }
  }

  private closestNode(point: Vector3, nodePos: Vector3[], numNodes: number,
    centers: Vector3[], radii: number, numObstacles: number): number {
    let closestID = -1;
    let minDist = 999999;
    for (let i = 0; i < numNodes; i++){

      const queryNode = nodePos[i];

      const dist = queryNode.distanceTo(point);
      if (dist < minDist){
        closestID = i;
        minDist = dist;
      }
    }
    return closestID;
}

  private runUCS(nodePos: Vector3[], numNodes: number, startID: number, goalID: number): number[]{
    const fringe = new MinHeap();
    const path: number[] = [];
    for (let i = 0; i < numNodes; i++) {
      this.visited[i] = false;
      this.parent[i] = -1;
    }

    this.visited[startID] = true;
    fringe.push(0, startID);

    let goalFound = false;
    while (fringe.size > 0){
      const [currentCost, minNode] = fringe.pop()!;

      if (minNode == goalID){
        goalFound = true;
        break;
      }

      for (let i = 0; i < this.neighbors[minNode].length; i++){
        const neighborNode = this.neighbors[minNode][i];
        if (!this.visited[neighborNode]){
          this.visited[neighborNode] = true;
          this.parent[neighborNode] = minNode;
          const edgeCost = nodePos[neighborNode].distanceTo(nodePos[minNode]);
          fringe.push(currentCost + edgeCost, neighborNode);
        }
      }
    }

    if (!goalFound){
      path.unshift(-1);
      return path;
    }

    let prevNode = this.parent[goalID];
    path.unshift(goalID);
    while (prevNode >= 0){
      path.unshift(prevNode);
      prevNode = this.parent[prevNode];
    }

    console.log("path", path);

    return path;
  }
}
