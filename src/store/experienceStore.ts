"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ExperienceConfig } from "@/types/experience";

interface ExperienceState {
  experiences: ExperienceConfig[];
  activeExperienceId: string | null;
  addExperience: (config: ExperienceConfig) => void;
  updateExperience: (id: string, patch: Partial<ExperienceConfig>) => void;
  removeExperience: (id: string) => void;
  setActiveExperience: (id: string | null) => void;
  getActiveExperience: () => ExperienceConfig | undefined;
}

export const useExperienceStore = create<ExperienceState>()(
  persist(
    (set, get) => ({
      experiences: [],
      activeExperienceId: null,

      addExperience: (config) =>
        set((state) => ({ experiences: [...state.experiences, config] })),

      updateExperience: (id, patch) =>
        set((state) => ({
          experiences: state.experiences.map((e) =>
            e.id === id ? { ...e, ...patch } : e
          ),
        })),

      removeExperience: (id) =>
        set((state) => ({
          experiences: state.experiences.filter((e) => e.id !== id),
          activeExperienceId: state.activeExperienceId === id ? null : state.activeExperienceId,
        })),

      setActiveExperience: (id) => set({ activeExperienceId: id }),

      getActiveExperience: () => {
        const { experiences, activeExperienceId } = get();
        return experiences.find((e) => e.id === activeExperienceId);
      },
    }),
    {
      name: "connect-ai-agent-demo-builder:experiences:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
