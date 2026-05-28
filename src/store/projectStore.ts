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
      version: 1,
      partialize: (state) => ({
        projectConfig: state.projectConfig,
        activeProfileId: state.activeProfileId,
      }),
    }
  )
);
