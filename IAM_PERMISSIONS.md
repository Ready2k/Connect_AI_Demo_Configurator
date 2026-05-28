# IAM Permissions

The application relies on the host machine's default AWS credential chain (profile, environment variables, or instance role). The IAM identity must have the following permissions.

The full policy is in `iam-policy.json` in this directory.

---

## Statements

### `QConnectAI` — Amazon Q in Connect (unchanged)

Covers all agent and prompt operations for the existing agent builder workflow.

| Action | Used for |
|---|---|
| `wisdom:CreateAIPrompt` / `CreateAIPromptVersion` | Deploy prompts |
| `wisdom:CreateAIAgent` / `CreateAIAgentVersion` | Deploy agents |
| `wisdom:GetAIPrompt` | Fetch prompt text for import |
| `wisdom:DeleteAIPrompt` | Cleanup during redeploy |
| `wisdom:ListAIPrompts` / `ListAIAgents` | Duplicate detection; Fetch from AWS |
| `wisdom:ListModels` | Model picker in settings |
| `wisdom:GetAssistant` / `ListAssistants` | Validate assistant ID |
| `wisdom:TagResource` | Apply project tags on create |

---

### `ConnectRead` — Connect read operations

Covers discovery and flow schema extraction.

| Action | Used for | New in |
|---|---|---|
| `connect:ListInstances` | Validate instance ID in settings | Existing |
| `connect:DescribeInstance` | Derive instance alias / URL | Existing |
| `connect:ListQueues` / `DescribeQueue` | Queue picker in journey configurator | Existing |
| `connect:ListContactFlows` | Flow Discovery page — list all flows | Existing |
| `connect:DescribeContactFlow` | Retrieve flow content JSON for schema extraction | Existing |
| `connect:ListPhoneNumbers` | Phone number picker in experience builder | **v1 new** |
| `connect:ListPhoneNumbersV2` | Paginated phone number listing (newer API) | **v1 new** |
| `connect:DescribePhoneNumber` | Get full DID details | **v1 new** |

---

### `ConnectWrite` — Connect write operations

These exist for future use. **Not called in v1** of the Experience Builder (flows are preview + export only).

| Action | Used for | Status |
|---|---|---|
| `connect:UpdateContactFlowContent` | Update an existing flow's JSON content | v2 |
| `connect:UpdateContactFlowMetadata` | Rename / update flow description | v2 |
| `connect:AssociateBot` | Wire a Lex bot to a Connect instance | Existing, unused |

---

### `ConnectWebRTC` — Voice testing *(new in v1)*

Required for the WebRTC test call feature (simulate an inbound call without a PSTN DID).

| Action | Used for |
|---|---|
| `connect:StartWebRTCContact` | Initiate a browser-to-Connect WebRTC call through a selected contact flow |

> **Region note:** `StartWebRTCContact` is confirmed available in `us-east-1` and `us-west-2`. Verify availability in other regions before changing `connectRegion` in settings.

---

### `BedrockInference` — Bedrock model access *(new in v1)*

Required for AI-assisted flow generation and verification via the configured Claude model.

| Action | Used for |
|---|---|
| `bedrock:InvokeModel` | Call Claude synchronously via the Converse API |
| `bedrock:InvokeModelWithResponseStream` | Streaming variant (used for verify / chat responses) |
| `bedrock:GetInferenceProfile` | Resolve cross-region inference profile before invoking |
| `bedrock:ListInferenceProfiles` | Populate model picker with available profiles |

> Cross-region inference is enabled. The app uses `us.*` prefixed profile IDs (e.g. `us.anthropic.claude-sonnet-4-6-20250514-v1:0`) so calls are routed to whichever US region has capacity. Ensure your IAM identity has Bedrock access in the relevant regions.

---

## v2 additions (not yet required)

These will be needed when flow deployment is added.

```json
{
    "Sid": "ConnectFlowDeploy",
    "Effect": "Allow",
    "Action": [
        "connect:CreateContactFlow",
        "connect:AssociatePhoneNumberContactFlow",
        "connect:DisassociatePhoneNumberContactFlow"
    ],
    "Resource": "*"
}
```

| Action | Purpose |
|---|---|
| `connect:CreateContactFlow` | Create the generated flow in Connect |
| `connect:AssociatePhoneNumberContactFlow` | Assign a claimed DID to the deployed flow |
| `connect:DisassociatePhoneNumberContactFlow` | Remove a DID assignment (cleanup / reassign) |

---

## Minimal scope note

All statements currently use `"Resource": "*"`. For production hardening, scope `Resource` to the specific Connect instance ARN and assistant ARN:

```
arn:aws:connect:us-west-2:{account-id}:instance/{instance-id}/*
arn:aws:wisdom:{region}:{account-id}:assistant/{assistant-id}
```

This tool is intended for local demo use — the broad resource scope is acceptable in that context.
