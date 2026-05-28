"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BlockSchemaLibrary, DiscoveredBlockSchema } from "@/types/flowSchema";

interface SchemaState {
  library: BlockSchemaLibrary;
  mergeSchemas: (newSchemas: Record<string, DiscoveredBlockSchema>) => void;
  clearSchemas: () => void;
  hasConnectAssistantSchema: () => boolean;
}

export const useSchemaStore = create<SchemaState>()(
  persist(
    (set, get) => ({
      library: { schemas: {}, lastUpdated: "" },

      mergeSchemas: (newSchemas) =>
        set((state) => {
          const merged = { ...state.library.schemas };
          for (const [key, schema] of Object.entries(newSchemas)) {
            const existing = merged[key];
            if (!existing || schema.discoveredAt > existing.discoveredAt) {
              merged[key] = schema;
            }
          }
          return { library: { schemas: merged, lastUpdated: new Date().toISOString() } };
        }),

      clearSchemas: () =>
        set({ library: { schemas: {}, lastUpdated: "" } }),

      hasConnectAssistantSchema: () => {
        const { library } = get();
        return "Connect Assistant" in library.schemas;
      },
    }),
    {
      name: "connect-ai-agent-demo-builder:schemas:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
