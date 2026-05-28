# Experience Builder — Build Log

## Package Installation

- `@aws-sdk/client-bedrock-runtime` — installed
- `@xyflow/react` — installed
- `amazon-connect-rtc-js` — NOT FOUND on npm registry (404)
- `amazon-connect-streams` — installed as fallback (provides CCP/WebRTC integration)

## BLOCKERS

### B1: `amazon-connect-rtc-js` package not found on npm
The package `amazon-connect-rtc-js` does not exist on the npm registry. The real Amazon Connect RTC library is accessed via `amazon-connect-streams`, but it exposes `connect.RTCSession` as a global on `window` (not an ES module import). The WebRTCTester component accesses `window.connect.RTCSession` at call time and surfaces a clear error if it's not present, with instructions to load the library as a script tag.

### B2: `@xyflow/react` named export only
`@xyflow/react` v12+ does not have a default export. `ReactFlow` is available as a named export: `import { ReactFlow } from "@xyflow/react"`. Fixed in FlowCanvas.tsx.

---

## Phase Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 — Packages | COMPLETE | |
| Phase 1 — Foundation | COMPLETE | Build passes, 0 new lint errors |
| Phase 2 — Flow Discovery | COMPLETE | Build passes, 0 new lint errors |
| Phase 3 — Experience Builder | COMPLETE | Build passes, 0 new lint errors |
| Phase 4 — WebRTC Tester | COMPLETE | Build passes, 0 new lint errors |
| Phase 5 — Nav + Dashboard | COMPLETE | Build passes, 0 new lint errors |

**Final build status: PASS** (`npm run build` succeeds, all 17 routes compile)

**Lint status:** 63 errors / 5 warnings — all pre-existing from original codebase. Zero new errors introduced.

---

## Phase 1 — Foundation

**Files created/modified:**
- `src/types/project.ts` — added `connectRegion`, `connectInstanceUrl`, `flowAssistantModelId` to `AwsSettings`
- `src/lib/config/defaults.ts` — added defaults for 3 new fields
- `src/lib/aws/connectClient.ts` — new file, thin wrappers for 7 Connect commands
- `src/lib/aws/bedrockClient.ts` — new file, Converse + ConverseStream wrappers
- `src/app/api/aws/connect/flows/route.ts` — GET, filters to CONTACT_FLOW type, paginated
- `src/app/api/aws/connect/flows/[id]/route.ts` — GET, Next.js 16 async params
- `src/app/api/aws/connect/instance/route.ts` — GET, derives instanceUrl from alias
- `src/app/api/aws/connect/queues/route.ts` — GET, STANDARD queues, paginated
- `src/app/api/aws/connect/phone-numbers/route.ts` — GET, tries V2 then falls back to V1
- `src/components/SettingsForm.tsx` — added Experience Builder Settings section with 3 new fields

## Phase 2 — Flow Discovery

**Files created:**
- `src/types/flowSchema.ts` — DiscoveredBlockSchema, BlockSchemaLibrary, ParsedAction, ParsedFlow
- `src/lib/flow/schemaParser.ts` — parseFlowContent, extractBlockSchemas, detectConnectAssistantBlock
- `src/store/schemaStore.ts` — Zustand + persist, mergeSchemas, clearSchemas, hasConnectAssistantSchema
- `src/components/BlockSchemaCard.tsx` — collapsible JSON preview card
- `src/app/flow-discovery/page.tsx` — two-panel discovery UI, manual import, library summary

## Phase 3 — Experience Builder

**Files created:**
- `src/types/experience.ts` — RoutingRule, JourneyConfig, ExperienceConfig, GenerationResult, VerificationResult
- `src/store/experienceStore.ts` — Zustand + persist, full CRUD
- `src/lib/flow/flowGenerator.ts` — generateFlow (with retry), verifyFlow
- `src/lib/flow/flowVisualizer.ts` — flowJsonToGraph with BFS layout
- `src/app/api/experience/generate/route.ts` — POST
- `src/app/api/experience/verify/route.ts` — POST
- `src/components/FlowCanvas.tsx` — @xyflow/react read-only canvas, custom node types
- `src/components/JourneyConfigurator.tsx` — welcome message, entry agent, routing rules, fallback queue
- `src/components/RoutingRuleRow.tsx` — inline routing rule editor
- `src/app/experience/page.tsx` — full experience builder page

## Phase 4 — WebRTC Tester

**Files created:**
- `src/app/api/aws/connect/webrtc/route.ts` — POST, StartWebRTCContactCommand
- `src/components/WebRTCTester.tsx` — connects via window.connect.RTCSession with graceful error handling
- `src/app/experience/page.tsx` — Voice Test collapsible panel added

## Phase 5 — Nav + Dashboard

**Files modified:**
- `src/components/Layout.tsx` — added Experience section with divider, Flow Discovery + Experience Builder links
- `src/app/page.tsx` — added Experience Builder heading + 2-card grid with purple accent
