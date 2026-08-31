// 本文件组合四个业务 slice，并将它们分别持久化到 yida_ 前缀的 localStorage key。
import { create, type StoreApi } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { seedGarments, seedPosts, seedProfile } from '../data/seed';
import type { Garment, OutfitPlan, Post, UserProfile } from '../types';
import { isPublicDemo } from '../config';

const storagePrefix = isPublicDemo ? 'yida_public_demo_' : 'yida_';
const STORAGE_KEYS = {
  garments: `${storagePrefix}garments`,
  plans: `${storagePrefix}plans`,
  posts: `${storagePrefix}posts`,
  profile: `${storagePrefix}profile`,
} as const;

interface GarmentSlice {
  garments: Garment[];
  addGarment: (garment: Omit<Garment, 'id' | 'createdAt'>) => void;
  updateGarment: (id: string, patch: Partial<Garment>) => void;
  deleteGarment: (id: string) => void;
  markWorn: (id: string) => void;
}

interface PlanSlice {
  plans: OutfitPlan[];
  dailyRecommendation?: DailyRecommendation;
  savePlan: (plan: Omit<OutfitPlan, 'id' | 'createdAt'>) => void;
  togglePlanSaved: (id: string) => void;
  deletePlan: (id: string) => void;
  cacheDailyRecommendation: (recommendation: DailyRecommendation) => void;
}

export interface DailyRecommendation {
  provider?: string;
  date: string;
  scene: string;
  plans: OutfitPlan[];
  source: 'ai' | 'mock';
  error?: string;
}

interface PostSlice {
  posts: Post[];
  addPost: (post: Omit<Post, 'id'>) => void;
}

interface ProfileSlice {
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
}

export interface AppStore extends GarmentSlice, PlanSlice, PostSlice, ProfileSlice {
  clearAll: () => void;
}

type PersistedState = Pick<
  AppStore,
  'garments' | 'plans' | 'dailyRecommendation' | 'posts' | 'profile'
>;
type SliceSetter = StoreApi<AppStore>['setState'];

const cloneGarments = (): Garment[] =>
  seedGarments.map((garment) => ({
    ...garment,
    colors: [...garment.colors],
    seasons: [...garment.seasons],
    styles: [...garment.styles],
  }));

const clonePosts = (): Post[] =>
  seedPosts.map((post) => ({
    ...post,
    author: { ...post.author },
    images: [...post.images],
  }));

const cloneProfile = (): UserProfile => ({
  ...seedProfile,
  stylePrefs: [...seedProfile.stylePrefs],
  avoid: [...seedProfile.avoid],
  goal: [...seedProfile.goal],
});

const createId = (prefix: 'g' | 'o' | 'p'): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const getLocalDate = (): string => {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 10);
};

const createGarmentSlice = (set: SliceSetter): GarmentSlice => ({
  garments: cloneGarments(),
  addGarment: (garment) =>
    set((state) => ({
      garments: [
        ...state.garments,
        { ...garment, id: createId('g'), createdAt: new Date().toISOString() },
      ],
    })),
  updateGarment: (id, patch) =>
    set((state) => ({
      garments: state.garments.map((garment) =>
        garment.id === id ? { ...garment, ...patch, id: garment.id } : garment,
      ),
    })),
  deleteGarment: (id) =>
    set((state) => ({
      garments: state.garments.filter((garment) => garment.id !== id),
    })),
  markWorn: (id) =>
    set((state) => ({
      garments: state.garments.map((garment) =>
        garment.id === id
          ? { ...garment, wearCount: garment.wearCount + 1, lastWorn: getLocalDate() }
          : garment,
      ),
    })),
});

const createPlanSlice = (set: SliceSetter): PlanSlice => ({
  plans: [],
  dailyRecommendation: undefined,
  savePlan: (plan) =>
    set((state) => ({
      plans: [
        ...state.plans,
        { ...plan, id: createId('o'), createdAt: new Date().toISOString() },
      ],
    })),
  togglePlanSaved: (id) =>
    set((state) => ({
      plans: state.plans.map((plan) =>
        plan.id === id ? { ...plan, saved: !plan.saved } : plan,
      ),
    })),
  deletePlan: (id) =>
    set((state) => ({ plans: state.plans.filter((plan) => plan.id !== id) })),
  cacheDailyRecommendation: (recommendation) =>
    set({
      dailyRecommendation: {
        ...recommendation,
        plans: recommendation.plans.map((plan) => ({
          ...plan,
          itemIds: [...plan.itemIds],
          tags: [...plan.tags],
          pros: [...plan.pros],
          cons: [...plan.cons],
        })),
      },
    }),
});

const createPostSlice = (set: SliceSetter): PostSlice => ({
  posts: clonePosts(),
  addPost: (post) =>
    set((state) => ({
      posts: [{ ...post, id: createId('p') }, ...state.posts],
    })),
});

const createProfileSlice = (set: SliceSetter): ProfileSlice => ({
  profile: cloneProfile(),
  updateProfile: (patch) =>
    set((state) => ({ profile: { ...state.profile, ...patch } })),
});

const readSlice = <Key extends keyof PersistedState>(
  storageKey: string,
  sliceKey: Key,
  fallback: PersistedState[Key],
): PersistedState[Key] => {
  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) return fallback;

  try {
    const parsedValue = JSON.parse(rawValue) as StorageValue<Partial<PersistedState>>;
    return parsedValue.state[sliceKey] ?? fallback;
  } catch {
    return fallback;
  }
};

const readStoredVersion = (storageKey: string): number => {
  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) return 1;

  try {
    const parsedValue = JSON.parse(rawValue) as StorageValue<Partial<PersistedState>>;
    return typeof parsedValue.version === 'number' ? parsedValue.version : 1;
  } catch {
    return 1;
  }
};

// v2 只向旧衣橱补入本轮新增的十件 seed，保留用户已有单品与编辑结果。
const appendV2SeedGarments = (garments: Garment[]): Garment[] => {
  const existingIds = new Set(garments.map((garment) => garment.id));
  const newSeedGarments = cloneGarments()
    .slice(12)
    .filter((garment) => !existingIds.has(garment.id));
  return [...garments, ...newSeedGarments];
};

const writeSlice = <Key extends keyof PersistedState>(
  storageKey: string,
  sliceKey: Key,
  value: PersistedState[Key],
  version: number | undefined,
): void => {
  const storageValue: StorageValue<Pick<PersistedState, Key>> = {
    state: { [sliceKey]: value } as Pick<PersistedState, Key>,
    version,
  };
  window.localStorage.setItem(storageKey, JSON.stringify(storageValue));
};

const writePlanSlice = (
  plans: OutfitPlan[],
  dailyRecommendation: DailyRecommendation | undefined,
  version: number | undefined,
): void => {
  const storageValue: StorageValue<
    Pick<PersistedState, 'plans' | 'dailyRecommendation'>
  > = {
    state: { plans, dailyRecommendation },
    version,
  };
  window.localStorage.setItem(STORAGE_KEYS.plans, JSON.stringify(storageValue));
};

const clearStorageKeys = (): void => {
  if (typeof window === 'undefined') return;
  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
};

const partitionedStorage: PersistStorage<PersistedState> = {
  getItem: () => {
    if (typeof window === 'undefined') return null;

    const hasStoredState = Object.values(STORAGE_KEYS).some(
      (key) => window.localStorage.getItem(key) !== null,
    );
    if (!hasStoredState) return null;

    return {
      state: {
        garments: readSlice(STORAGE_KEYS.garments, 'garments', cloneGarments()),
        plans: readSlice(STORAGE_KEYS.plans, 'plans', []),
        dailyRecommendation: readSlice(
          STORAGE_KEYS.plans,
          'dailyRecommendation',
          undefined,
        ),
        posts: readSlice(STORAGE_KEYS.posts, 'posts', clonePosts()),
        profile: readSlice(STORAGE_KEYS.profile, 'profile', cloneProfile()),
      },
      version: readStoredVersion(STORAGE_KEYS.garments),
    };
  },
  setItem: (_name, value) => {
    if (typeof window === 'undefined') return;
    writeSlice(STORAGE_KEYS.garments, 'garments', value.state.garments, value.version);
    writePlanSlice(
      value.state.plans,
      value.state.dailyRecommendation,
      value.version,
    );
    writeSlice(STORAGE_KEYS.posts, 'posts', value.state.posts, value.version);
    writeSlice(STORAGE_KEYS.profile, 'profile', value.state.profile, value.version);
  },
  removeItem: clearStorageKeys,
};

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      ...createGarmentSlice(set),
      ...createPlanSlice(set),
      ...createPostSlice(set),
      ...createProfileSlice(set),
      clearAll: () => {
        set({
          garments: cloneGarments(),
          plans: [],
          dailyRecommendation: undefined,
          posts: clonePosts(),
          profile: cloneProfile(),
        });
        clearStorageKeys();
      },
    }),
    {
      name: STORAGE_KEYS.garments,
      storage: partitionedStorage,
      version: 2,
      partialize: ({ garments, plans, dailyRecommendation, posts, profile }) => ({
        garments,
        plans,
        dailyRecommendation,
        posts,
        profile,
      }),
      migrate: (persistedState, version) => {
        const state = persistedState as PersistedState;
        if (version >= 2) return state;

        return {
          ...state,
          garments: appendV2SeedGarments(
            Array.isArray(state.garments) ? state.garments : [],
          ),
          // 旧缓存来自未按场景分池的 mock，升级后需要重新生成。
          dailyRecommendation: undefined,
        };
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as PersistedState),
      }),
    },
  ),
);
