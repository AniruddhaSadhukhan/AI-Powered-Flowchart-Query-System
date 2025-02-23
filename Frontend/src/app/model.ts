import { Edge as VisEdge, Node as VisNode } from 'vis-network/standalone/esm/vis-network';

export interface Graph {
  nodes: Node[];
  relationships: Relationship[];
}

export interface VisGraph {
  nodes: VisNode[];
  edges: VisEdge[];
}

interface Node {
  context: string[];
  imageSources: string[];
  name: string;
}

interface Relationship {
  from: string;
  to: string;
  imageSources: string[];
  name: string;
  context: string[];
}

export interface ChatResponse {
  response: string;
  image_names: string[];
}
