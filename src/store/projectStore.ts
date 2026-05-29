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
        // v0 and v1 both need the agents object→array migration
        if (version <= 1) {
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
          // Ensure nameSuffixMode is always present after migration
          if (oldConfig?.aws && !oldConfig.aws.nameSuffixMode) {
            oldConfig.aws.nameSuffixMode = "environment_and_timestamp";
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
