# Architecture Overview

This document describes the system architecture at C4 levels 1–3.

---

## Level 1 — System Context

Who uses the system and what external systems does it talk to.

```mermaid
C4Context
    title System Context — Connect AI Agent Demo Builder

    Person(operator, "Demo Operator", "Configures AI agents, generates contact flows, and tests them via the local tool")
    Person(customer, "Test Customer", "Places a test voice or chat call through Amazon Connect during live testing")

    System(builder, "Demo Builder", "Local Next.js app. Configures Q Connect AI Agents, generates Contact Flows via Bedrock, and provides live WebRTC/chat test surfaces")

    System_Ext(qconnect, "Amazon Q in Connect", "Hosts AI Prompts and AI Agents (CustomerIntentRouter, LostCard)")
    System_Ext(connect, "Amazon Connect", "Hosts Contact Flows. Routes inbound calls/chats to Q Connect AI Agents or human queues")
    System_Ext(bedrock, "Amazon Bedrock", "Runs Claude (or other models) to generate and verify Contact Flow JSON")
    System_Ext(lex, "Amazon Lex V2", "Bridges Amazon Connect to Q Connect during an active voice/chat contact")

    Rel(operator, builder, "Uses browser", "HTTP")
    Rel(builder, qconnect, "Creates prompts, agents, versions", "AWS SDK / HTTPS")
    Rel(builder, connect, "Lists flows, queues, phone numbers; starts WebRTC/chat contacts", "AWS SDK / HTTPS")
    Rel(builder, bedrock, "Generates & verifies Contact Flow JSON", "AWS SDK / HTTPS")
    Rel(customer, connect, "Calls or chats in", "Voice / WebRTC / Chat")
    Rel(connect, lex, "Delegates AI conversation", "Lex V2 integration")
    Rel(lex, qconnect, "Runs Q Connect AI Agent session", "Q Connect session ARN")
```

---

## Level 2 — Containers

The major deployable/runnable units inside the Demo Builder.

```mermaid
C4Container
    title Container Diagram — Demo Builder

    Person(operator, "Demo Operator")

    System_Boundary(app, "Demo Builder (Next.js 16 — single process)") {
        Container(browser, "Browser UI", "React 19 + Tailwind + Zustand", "All pages and components. State persisted to localStorage. No backend session.")
        Container(api, "Next.js API Routes", "Node.js (server-side)", "Thin proxy layer between the browser and AWS. All AWS SDK calls originate here to keep credentials server-side.")
    }

    ContainerDb(ls, "localStorage", "Browser", "Three persisted Zustand stores:\n• projectStore (agent config)\n• experienceStore (journey + generated flow)\n• schemaStore (discovered block schemas)")

    System_Ext(qconnect, "Amazon Q in Connect")
    System_Ext(connect, "Amazon Connect")
    System_Ext(bedrock, "Amazon Bedrock")

    Rel(operator, browser, "Uses", "HTTPS :3000")
    Rel(browser, ls, "Reads / writes", "Zustand persist middleware")
    Rel(browser, api, "Calls", "fetch() / HTTPS")
    Rel(api, qconnect, "Creates prompts & agents", "AWS SDK")
    Rel(api, connect, "Manages flows, starts contacts", "AWS SDK")
    Rel(api, bedrock, "Invokes Claude for flow gen/verify", "AWS SDK")
```

---

## Level 3 — Components

### 3a — Browser Layer (React)

```mermaid
C4Component
    title Component Diagram — Browser Layer

    Container_Boundary(browser, "Browser UI") {

        Component(pages, "Pages (App Router)", "Next.js page.tsx files", "Seven routes:\n/ Dashboard\n/settings AWS + Experience settings\n/agents Prompt editor for both Q Connect agents\n/preview Generated payload viewer\n/deploy Deploy to AWS + manifest\n/flow-discovery Discover Connect block schemas\n/experience Journey config + flow gen + live test")

        Component(stores, "Zustand Stores", "Zustand + persist", "projectStore — ProjectConfig (agents, AWS settings)\nexperienceStore — ExperienceConfig[] (journeys + flow JSON)\nschemaStore — BlockSchemaLibrary (discovered block types)\nlogStore — ephemeral log entries (not persisted)")

        Component(components, "UI Components", "React + Tailwind", "AgentConfigCard, PromptEditor, ValidationPanel\nJourneyConfigurator, RoutingRuleRow\nFlowCanvas (@xyflow/react — read-only flow visualisation)\nWebRTCTester (window.connect.RTCSession via amazon-connect-streams)\nConnectChatTester (StartChatContact + ConnectParticipant)\nDeploymentStepper, PayloadViewer, LogsSidebar\nLayout (nav with Experience section)")
    }

    Rel(pages, stores, "Reads & writes")
    Rel(pages, components, "Renders")
    Rel(components, stores, "Reads & writes")
```

### 3b — API Route Layer (Server)

```mermaid
C4Component
    title Component Diagram — API Route Layer

    Container_Boundary(api, "Next.js API Routes") {

        Component(qc_api, "Q Connect API", "route.ts files", "POST /api/validate-prompt\nPOST /api/build-payloads\nPOST /api/deploy\nGET  /api/smoke-test\nPOST /api/generate-prompt")

        Component(exp_api, "Experience API", "route.ts files", "POST /api/experience/generate → flowGenerator.generateFlow()\nPOST /api/experience/verify  → flowGenerator.verifyFlow()")

        Component(connect_api, "Connect Proxy API", "route.ts files", "GET  flows, flows/[id], instance, queues, phone-numbers, lex-bots\nPOST chat/start, chat/message, participant-connection\nGET  chat/transcript\nPOST webrtc, dtmf")

        Component(discovery_api, "Discovery API", "route.ts files", "GET /api/aws/discovery      — list Connect instances + Q Connect assistants\nGET /api/aws/models         — list Bedrock models\nGET /api/aws/bedrock/test-model\nPOST /api/aws/bedrock/chat  — streaming Bedrock chat\nGET /api/aws/qconnect/ai-agents\nGET /api/aws/agents")
    }

    Component(lib, "Core Lib", "TypeScript modules", "See §3c below")

    Rel(qc_api, lib, "Calls")
    Rel(exp_api, lib, "Calls")
    Rel(connect_api, lib, "Calls")
    Rel(discovery_api, lib, "Calls")
```

### 3c — Core Lib Layer

```mermaid
C4Component
    title Component Diagram — Core Lib

    Container_Boundary(lib, "src/lib/") {

        Component(qc_client, "qconnectClient.ts", "AWS SDK wrapper", "Thin wrappers for CreateAIPrompt, CreateAIAgent,\nListAIPrompts, ListAIAgents, etc.")
        Component(connect_client, "connectClient.ts", "AWS SDK wrapper", "Wrappers for ListContactFlows, DescribeContactFlow,\nListQueues, StartWebRTCContact, StartChatContact,\nCreateContactFlow, ListBots, DeleteContactFlow, etc.")
        Component(bedrock_client, "bedrockClient.ts", "AWS SDK wrapper", "converseWithModel() — single-shot Bedrock call\nconverseStreamWithModel() — streaming Bedrock call")

        Component(deploy, "deployService.ts", "Deployment orchestration", "deployProject():\n1. Duplicate detection (list before create)\n2. createPrompt → createPromptVersion (×2)\n3. createAgent → createAgentVersion (×2)\nReturns DeploymentManifest")

        Component(flow_gen, "flowGenerator.ts", "AI flow generation", "generateFlow():\n  Build system prompt from JourneyConfig +\n  BlockSchemaLibrary + agent context → Bedrock →\n  parse JSON → auto-retry on failure\nverifyFlow():\n  Ask Bedrock to review & return issues/suggestions")

        Component(schema_parser, "schemaParser.ts", "Flow schema extraction", "parseFlowContent() — parse Connect flow JSON\nextractBlockSchemas() — build DiscoveredBlockSchema records")
        Component(flow_viz, "flowVisualizer.ts", "Flow visualisation", "flowJsonToGraph() — BFS layout → @xyflow/react nodes/edges")

        Component(payload_builder, "buildPayloads.ts", "AWS payload builder", "buildPayloads() → CreateAIPromptCommandInput\n+ CreateAIAgentCommandInput from ProjectConfig")
        Component(validate, "validatePrompt.ts", "YAML validation", "Checks system, messages, {{$.conversationHistory}},\n{{$.toolConfigurationList}}, <message>, no TODO")

        Component(defaults, "config/defaults.ts", "Default config", "defaultProjectConfig — reads env vars at module load")
        Component(name_utils, "config/nameUtils.ts", "Name formatting", "computeDeployedName() — applies nameSuffixMode\n(none | environment | timestamp | environment_and_timestamp)")
    }

    Rel(deploy, qc_client, "Uses")
    Rel(flow_gen, bedrock_client, "Uses")
    Rel(schema_parser, flow_viz, "Data flows to")
```

---

## Key Data Flows

### Flow 1 — Deploy Q Connect Agents

```
Operator clicks "Deploy to AWS"
  → Browser POST /api/deploy
    → deployService.deployProject()
      → qconnectClient.listAIPrompts()       [duplicate check]
      → qconnectClient.createAIPrompt()      [CustomerIntentRouter]
      → qconnectClient.createAIPromptVersion()
      → qconnectClient.createAIPrompt()      [LostCard]
      → qconnectClient.createAIPromptVersion()
      → qconnectClient.createAIAgent()       [CustomerIntentRouter, injects prompt version ID]
      → qconnectClient.createAIAgentVersion()
      → qconnectClient.createAIAgent()       [LostCard]
      → qconnectClient.createAIAgentVersion()
      → returns DeploymentManifest (IDs, ARNs, versions)
  → Browser stores manifest in projectStore
```

### Flow 2 — Generate Contact Flow (Experience Builder)

```
Operator configures JourneyConfig + selects Q Connect AI Agent
  → Browser POST /api/experience/generate
    → flowGenerator.generateFlow()
      → buildGenerationSystemPrompt()
          Injects: schemaLibrary + journeyConfig + agent ARNs + routing rules
          + agent system prompt (so Bedrock understands the agent's tools/signals)
      → bedrockClient.converseWithModel()    [Claude via Bedrock Converse API]
      → Parse JSON response
        if fail → one automatic retry with correction prompt
      → returns GenerationResult { flowJson, logs }
  → Browser stores flowJson in experienceStore
  → FlowCanvas renders via flowVisualizer.flowJsonToGraph()
```

### Flow 3 — Verify + Regenerate

```
Operator clicks "Verify"
  → Browser POST /api/experience/verify
    → flowGenerator.verifyFlow()
      → bedrockClient.converseWithModel()    [ask Bedrock to review the JSON]
      → parse { explanation, issues, suggestions }
  → Browser stores VerificationResult in experienceStore
  → Operator clicks "Regenerate with feedback"
    → same as Flow 2 but verificationFeedback is injected into the generation prompt
```

### Flow 4 — Schema Discovery

```
Operator opens /flow-discovery, clicks "Fetch Flows"
  → Browser GET /api/aws/connect/flows
    → connectClient.listContactFlows()
  → Operator selects a flow → GET /api/aws/connect/flows/[id]
    → connectClient.describeContactFlow()
  → Browser: schemaParser.parseFlowContent()
           → schemaParser.extractBlockSchemas()
           → schemaStore.mergeSchemas()       [persisted to localStorage]
```

### Flow 5 — Live WebRTC Test

```
Operator clicks "Start Voice Test" in /experience
  → WebRTCTester: Browser POST /api/aws/connect/webrtc
    → connectClient.startWebRTCContact()
    → returns { ContactId, ConnectionData }
  → WebRTCTester: window.connect.RTCSession(connectionData)
    [amazon-connect-streams loaded from public/connect-streams.js]
  → Two-way audio via WebRTC between operator browser and Connect
  → The active contact flow runs, invokes Lex → Q Connect AI Agent
```

---

## AWS Resource Dependencies

```
Amazon Connect instance
  └── Contact Flow (generated by Experience Builder)
        ├── Lex V2 Bot (bridges Connect ↔ Q Connect)
        └── Q Connect Assistant
              ├── AI Prompt: CustomerIntentRouter
              ├── AI Agent:  CustomerIntentRouter (references prompt version)
              ├── AI Prompt: LostCard
              └── AI Agent:  LostCard (references prompt version)

Amazon Bedrock
  └── Claude model (cross-region inference, us.* prefix)
        Used for: flow generation, flow verification, agent prompt generation
```
