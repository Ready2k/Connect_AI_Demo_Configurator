"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProjectConfig } from "@/types/project";
import { defaultProjectConfig } from "@/lib/config/defaults";

interface ProjectState {
  projectConfig: ProjectConfig;
  activeProfileId: string;
  setProjectConfig: (config: ProjectConfig) => void;
  updateProjectConfig: (patch: Partial<ProjectConfig>) => void;
  resetProjectConfig: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projectConfig: defaultProjectConfig,
      activeProfileId: "default",

      setProjectConfig: (config) =>
        set({
          projectConfig: config,
        }),

      updateProjectConfig: (patch) =>
        set((state) => ({
          projectConfig: {
            ...state.projectConfig,
            ...patch,
          },
        })),

      resetProjectConfig: () =>
        set({
          projectConfig: defaultProjectConfig,
          activeProfileId: "default",
        }),
    }),
    {
      name: "connect-ai-agent-demo-builder:v1",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version === 1) {
          // Migrate agents from object to array
          const oldConfig = persistedState.projectConfig;
          if (oldConfig && oldConfig.agents && !Array.isArray(oldConfig.agents)) {
            const arr = [];
            if (oldConfig.agents.customerIntentRouter) {
              arr.push({ ...oldConfig.agents.customerIntentRouter, id: "customerIntentRouter" });
            }
            if (oldConfig.agents.lostCard) {
              arr.push({ ...oldConfig.agents.lostCard, id: "lostCard" });
            }
            oldConfig.agents = arr;
          }
        }
        return persistedState;
      },
      partialize: (state) => ({
        projectConfig: state.projectConfig,
        activeProfileId: state.activeProfileId,
      }),
    }
  )
);
