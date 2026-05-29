# Connect AI Agent Demo Builder

A local Next.js web app for configuring, previewing, deploying, and live-testing an Amazon Q in Connect AI agent demo.

## What it does

The tool manages a two-agent Amazon Q in Connect setup for a banking lost-card scenario:

| Agent | Role |
|---|---|
| **CustomerIntentRouter** | Captures the customer's reason for calling, classifies intent, and routes to the specialist journey |
| **LostCard** | Self-service agent for lost, stolen, damaged, or ATM-retained cards — attempts controlled servicing, then hands off safely with context |

Beyond configuring and deploying those agents, the tool also includes an **Experience Builder** that generates Amazon Connect Contact Flows using Claude via Amazon Bedrock, then lets you test them live via WebRTC or chat — all from the same UI.

## Features

- **Agent prompt editor** — Edit the YAML prompts for both Q Connect agents with live validation
- **Payload preview** — See the exact AWS SDK payloads before pushing anything to AWS
- **Deployment** — Sequential create-prompt → version → create-agent → version, with duplicate detection
- **Flow Discovery** — Parse real Contact Flows from your Connect instance to build a block schema library
- **Experience Builder** — Configure a journey (welcome message, routing rules, Lex bot) and generate a Contact Flow JSON via Bedrock Claude, with AI-assisted verification and regeneration
- **Live testing** — WebRTC voice test and chat test surfaces embedded in the Experience Builder
- **Local persistence** — All config in `localStorage`; export/import as JSON for portability

## Setup

```bash
npm install
cp .env.example .env.local    # fill in AWS_REGION, CONNECT_Q_ASSISTANT_ID, CONNECT_INSTANCE_ID
npm run dev                   # http://localhost:3000
```

See `.env.example` for all available env vars. The app uses the default AWS credential chain — no access keys in config files.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `AWS_REGION` | Yes | Region for Q Connect operations |
| `CONNECT_Q_ASSISTANT_ID` | Yes (deploy) | Q Connect assistant ID |
| `CONNECT_INSTANCE_ID` | Yes (live test) | Amazon Connect instance ID |
| `CONNECT_REGION` | No | Connect region if different from `AWS_REGION` (defaults to `us-west-2`) |
| `CONNECT_INSTANCE_URL` | No | CCP URL for the amazon-connect-streams integration |
| `FLOW_ASSISTANT_MODEL_ID` | No | Bedrock model for flow generation (default: `us.amazon.nova-pro-v1:0`) |
| `DEFAULT_VISIBILITY_STATUS` | No | `SAVED` or `PUBLISHED` (default: `SAVED`) |

## IAM permissions

See [`IAM_PERMISSIONS.md`](./IAM_PERMISSIONS.md) for the full policy. The key permission groups are:

- **QConnectAI** — create/list/get AI prompts and agents
- **ConnectRead** — list flows, queues, phone numbers; describe instance
- **ConnectWebRTC** — `connect:StartWebRTCContact` for voice testing
- **BedrockInference** — `bedrock:InvokeModel` + `InvokeModelWithResponseStream` for flow generation

## Pages

| Route | Purpose |
|---|---|
| `/` | Dashboard |
| `/settings` | AWS settings, deployment mode, Experience Builder model config |
| `/agents` | Edit Q Connect agent prompts; validate YAML |
| `/preview` | View generated SDK payloads |
| `/deploy` | Deploy to AWS with dry-run option |
| `/flow-discovery` | Browse Connect flows; extract block schemas for the flow generator |
| `/experience` | Configure a journey, generate a Contact Flow via Bedrock, verify, and live-test |

## Documentation

| Doc | Contents |
|---|---|
| [`docs/prerequisites.md`](./docs/prerequisites.md) | AWS resources to set up before running the tool |
| [`docs/architecture.md`](./docs/architecture.md) | C4-level diagrams: system context, containers, components, data flows |
| [`docs/troubleshooting.md`](./docs/troubleshooting.md) | Common failures and fixes |
| [`IAM_PERMISSIONS.md`](./IAM_PERMISSIONS.md) | Full IAM policy with per-action rationale |

## Security

- AWS credentials are never stored in config — the app uses the host environment's credential chain
- Configuration lives in `localStorage` and never leaves the browser except when deploying to AWS
- Do not enter real customer PII into any prompt or payload field
