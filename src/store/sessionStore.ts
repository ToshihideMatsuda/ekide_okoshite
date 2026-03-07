import { create } from 'zustand';
import { Session, Station, SoundType } from '../types';
import {
    saveSession,
    getAllSessions,
    updateSessionStatus,
    updateSessionSettings,
    deleteSession as dbDeleteSession,
} from '../services/stationDb';
import { registerSessionGeofences, unregisterSessionGeofences } from '../services/geofence';
import { DEFAULT_DETECTION_RADIUS, DEFAULT_VOLUME, SESSION_DURATION_MS } from '../constants/config';
import { t } from '../i18n';
import { stopAlarmSound, cancelAllNotifications } from '../services/notification';

function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

type SessionStore = {
    activeSession: Session | null;
    sessions: Session[];
    isLoading: boolean;
    error: string | null;
    /** フォアグラウンドでジオフェンスが発火したときに設定される到着駅名。active.tsx が監視して arrived 画面へ遷移する */
    arrivedStationName: string | null;

    loadSessions: () => Promise<void>;
    startSession: (params: {
        originStation: Station;
        destinationStation: Station;
        route: Station[];
        allStations?: Station[];
        detectionRadius: number;
        soundType: SoundType;
        soundUri?: string;
        volume: number;
        isFromMyRoute?: boolean;
    }) => Promise<Session>;
    completeSession: (id: string) => Promise<void>;
    cancelSession: (id: string) => Promise<void>;
    updateActiveSessionSettings: (soundType: SoundType, detectionRadius: number) => Promise<void>;
    updateActiveSessionRoute: (route: Station[], allStations: Station[]) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    clearError: () => void;
    /** フォアグラウンドでジオフェンスが発火したときに到着駅名をセットする */
    triggerArrival: (stationName: string) => void;
    /** arrived 画面遷移後にリセットする */
    clearArrival: () => void;
};

export const useSessionStore = create<SessionStore>((set, get) => ({
    activeSession: null,
    sessions: [],
    isLoading: false,
    error: null,
    arrivedStationName: null,

    loadSessions: async () => {
        set({ isLoading: true, error: null });
        try {
            const sessions = await getAllSessions();
            let active = sessions.find((s) => s.status === 'active') ?? null;

            // アプリが kill された状態でセッションが期限切れになると CLMonitor のジオフェンスが
            // 残留したままになるため、期限切れのアクティブセッションを起動時にクリアする
            if (active) {
                const elapsed = Date.now() - new Date(active.startedAt).getTime();
                if (elapsed >= SESSION_DURATION_MS) {
                    await updateSessionStatus(active.id, 'cancelled', new Date().toISOString());
                    await unregisterSessionGeofences();
                    sessions.forEach((s) => {
                        if (s.id === active!.id) s.status = 'cancelled';
                    });
                    active = null;
                }
            }

            set({ sessions, activeSession: active, isLoading: false });
        } catch (err) {
            set({ error: t('error.loadSessions'), isLoading: false });
            console.error(err);
        }
    },

    startSession: async ({ originStation, destinationStation, route, allStations, detectionRadius, soundType, soundUri, volume, isFromMyRoute }) => {
        const newSession: Session = {
            id: generateId(),
            originStation,
            destinationStation,
            route,
            allStations,
            detectionRadius,
            soundType,
            soundUri,
            volume,
            isFromMyRoute,
            status: 'active',
            startedAt: new Date().toISOString(),
        };

        try {
            await saveSession(newSession);
            await registerSessionGeofences(newSession);
            const sessions = [newSession, ...get().sessions];
            set({ activeSession: newSession, sessions });
            return newSession;
        } catch (err) {
            set({ error: t('error.startSession') });
            console.error(err);
            throw err;
        }
    },

    completeSession: async (id) => {
        const completedAt = new Date().toISOString();
        try {
            await updateSessionStatus(id, 'completed', completedAt);
            await unregisterSessionGeofences();
            const sessions = get().sessions.map((s) =>
                s.id === id ? { ...s, status: 'completed' as const, completedAt } : s
            );
            set({ activeSession: null, sessions });
        } catch (err) {
            set({ error: t('error.completeSession') });
            console.error(err);
            throw err;
        }
    },

    cancelSession: async (id) => {
        const completedAt = new Date().toISOString();
        try {
            await updateSessionStatus(id, 'cancelled', completedAt);
            await unregisterSessionGeofences();
            await stopAlarmSound();
            await cancelAllNotifications();
            const sessions = get().sessions.map((s) =>
                s.id === id ? { ...s, status: 'cancelled' as const, completedAt } : s
            );
            set({ activeSession: null, sessions });
        } catch (err) {
            set({ error: t('error.cancelSession') });
            console.error(err);
            throw err;
        }
    },

    updateActiveSessionSettings: async (soundType, detectionRadius) => {
        const { activeSession } = get();
        if (!activeSession) return;
        try {
            await updateSessionSettings(activeSession.id, soundType, detectionRadius);
            const updatedSession = { ...activeSession, soundType, detectionRadius };
            // 検出半径が変わった場合はジオフェンスを再登録
            if (detectionRadius !== activeSession.detectionRadius) {
                await unregisterSessionGeofences();
                await registerSessionGeofences(updatedSession);
            }
            const sessions = get().sessions.map((s) =>
                s.id === activeSession.id ? updatedSession : s
            );
            set({ activeSession: updatedSession, sessions });
        } catch (err) {
            console.error('セッション設定の更新に失敗しました:', err);
        }
    },

    updateActiveSessionRoute: async (route, allStations) => {
        const { activeSession } = get();
        if (!activeSession) return;
        const updatedSession = { ...activeSession, route, allStations };
        try {
            await unregisterSessionGeofences();
            await registerSessionGeofences(updatedSession);
        } catch (err) {
            console.error('ジオフェンス再登録に失敗しました:', err);
        }
        const sessions = get().sessions.map((s) =>
            s.id === activeSession.id ? updatedSession : s
        );
        set({ activeSession: updatedSession, sessions });
    },

    deleteSession: async (id) => {
        try {
            await dbDeleteSession(id);
            set({ sessions: get().sessions.filter((s) => s.id !== id) });
        } catch (err) {
            set({ error: t('error.deleteSession') });
            console.error(err);
        }
    },

    clearError: () => set({ error: null }),

    triggerArrival: (stationName: string) => set({ arrivedStationName: stationName }),
    clearArrival: () => set({ arrivedStationName: null }),
}));
