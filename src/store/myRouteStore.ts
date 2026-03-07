import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { Station } from '../types';

const STORAGE_KEY = '@wakeup_my_routes_v1';

export type MyRoute = {
    id: string;
    name: string;              // "{origin} → {dest}"
    originStation: Station;
    destinationStation: Station;
    route: Station[];
    allStations?: Station[];
    savedAt: string;
};

type MyRouteStore = {
    routes: MyRoute[];
    isLoaded: boolean;
    loadRoutes: () => Promise<void>;
    saveRoute: (params: {
        originStation: Station;
        destinationStation: Station;
        route: Station[];
        allStations?: Station[];
    }) => Promise<void>;
    deleteRoute: (id: string) => Promise<void>;
};

function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

async function persist(routes: MyRoute[]) {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
    } catch {
        // 保存失敗は無視
    }
}

export const useMyRouteStore = create<MyRouteStore>((set, get) => ({
    routes: [],
    isLoaded: false,

    loadRoutes: async () => {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed: MyRoute[] = JSON.parse(raw);
                set({ routes: parsed, isLoaded: true });
            } else {
                set({ isLoaded: true });
            }
        } catch {
            set({ isLoaded: true });
        }
    },

    saveRoute: async ({ originStation, destinationStation, route, allStations }) => {
        const newRoute: MyRoute = {
            id: generateId(),
            name: `${originStation.name} → ${destinationStation.name}`,
            originStation,
            destinationStation,
            route,
            allStations,
            savedAt: new Date().toISOString(),
        };
        const next = [newRoute, ...get().routes];
        set({ routes: next });
        await persist(next);
    },

    deleteRoute: async (id) => {
        const next = get().routes.filter((r) => r.id !== id);
        set({ routes: next });
        await persist(next);
    },
}));
