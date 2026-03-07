import { create } from 'zustand';
import { Graph } from '../services/routing';

type GraphStore = {
  graph: Graph | null;
  setGraph: (graph: Graph) => void;
};

export const useGraphStore = create<GraphStore>((set) => ({
  graph: null,
  setGraph: (graph) => set({ graph }),
}));
