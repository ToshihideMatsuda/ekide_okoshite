import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = '@wakeup_ad_state_v1';

type PersistedState = {
  completedSessionsCount: number; // 目的地到着で完了したセッション数
  hasRated: boolean;              // 評価済みフラグ
};

type AdStore = PersistedState & {
  isLoaded: boolean;
  loadAdState: () => Promise<void>;
  incrementCompletedSessions: () => Promise<void>;
  setHasRated: () => Promise<void>;
};

async function persist(state: PersistedState) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 保存失敗は無視
  }
}

export const useAdStore = create<AdStore>((set, get) => ({
  completedSessionsCount: 0,
  hasRated: false,
  isLoaded: false,

  loadAdState: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Partial<PersistedState> = JSON.parse(raw);
        set({
          completedSessionsCount: parsed.completedSessionsCount ?? 0,
          hasRated: parsed.hasRated ?? false,
          isLoaded: true,
        });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  incrementCompletedSessions: async () => {
    const next = get().completedSessionsCount + 1;
    set({ completedSessionsCount: next });
    await persist({ completedSessionsCount: next, hasRated: get().hasRated });
  },

  setHasRated: async () => {
    set({ hasRated: true });
    await persist({ completedSessionsCount: get().completedSessionsCount, hasRated: true });
  },
}));
