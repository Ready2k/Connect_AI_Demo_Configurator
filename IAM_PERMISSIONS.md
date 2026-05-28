# IAM Permissions

The application relies on the host machine's default AWS credential chain (profile, environment variables, or instance role). The IAM identity must have the following permissions.

The full policy is in `iam-policy.json` in this directory.

---

## Statements

### `QConnectAIList` — List assistants (resource `*`)

`wisdom:ListAssistants` cannot be scoped to a specific resource — it must remain `"Resource": "*"`.

### `QConnectAI` — Amazon Q in Connect (scoped to `arn:aws:wisdom:{region}:{account-id}:*`)

Covers all agent and prompt operations for the agent builder workflow.

| Action | Used for |
|---|---|
| `wisdom:CreateAIPrompt` / `CreateAIPromptVersion` | Deploy prompts |
| `wisdom:CreateAIAgent` / `CreateAIAgentVersion` | Deploy agents |
| `wisdom:GetAIPrompt` / `GetAIAgent` | Fetch resource details |
| `wisdom:DeleteAIPrompt` | Cleanup during redeploy |
| `wisdom:ListAIPrompts` / `ListAIAgents` | Duplicate detection; fetch from AWS |
| `wisdom:ListModels` | Model picker in settings |
| `wisdom:GetAssistant` | Validate assistant ID |
| `wisdom:TagResource` | Apply project tags on create |

---

### `ConnectListInstances` — List instances (resource `*`)

`connect:ListInstances` cannot be scoped to a specific instance — it must remain `"Resource": "*"`.

### `ConnectRead` — Connect read operations (scoped to `arn:aws:connect:{region}:{account-id}:*`)

Covers discovery and flow schema extraction.

| Action | Used for | New in |
|---|---|---|
| `connect:DescribeInstance` | Derive instance alias / URL | Existing |
| `connect:ListQueues` / `DescribeQueue` | Queue picker in journey configurator | Existing |
| `connect:ListContactFlows` | Flow Discovery page — list all flows | Existing |
| `connect:DescribeContactFlow` | Retrieve flow content JSON for schema extraction | Existing |
| `connect:ListPhoneNumbers` | Phone number picker in experience builder | **v1 new** |
| `connect:ListPhoneNumbersV2` | Paginated phone number listing (newer API) | **v1 new** |
| `connect:DescribePhoneNumber` | Get full DID details | **v1 new** |
| `connect:ListIntegrationAssociations` | Required for ORCHESTRATION AI Agent deployment — Q Connect calls this internally to verify the Connect–Q Connect integration before creating the agent | **v1 new** |

---

### `ConnectWrite` — Connect write operations (scoped to `arn:aws:connect:{region}:{account-id}:*`)

These exist for future use. **Not called in v1** of the Experience Builder (flows are preview + export only).

| Action | Used for | Status |
|---|---|---|
| `connect:UpdateContactFlowContent` | Update an existing flow's JSON content | v2 |
| `connect:UpdateContactFlowMetadata` | Rename / update flow description | v2 |
| `connect:AssociateBot` | Wire a Lex bot to a Connect instance | Existing, unused |

---

### `ConnectWebRTC` — Voice testing *(new in v1)* (scoped to `arn:aws:connect:{region}:{account-id}:*`)

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

## Resource scoping

`ListInstances` and `ListAssistants` must use `"Resource": "*"` (AWS does not support resource-level restrictions on list-all operations). All other statements are scoped to `{region}` and `{account-id}`.

Replace the placeholders in `iam-policy.json` before applying:

| Placeholder | Example |
|---|---|
| `{region}` | `us-west-2` |
| `{account-id}` | `123456789012` |

Bedrock remains `"Resource": "*"` — foundation model ARNs have no account ID component and cross-region inference profile ARNs vary; scoping further adds complexity without meaningful security benefit for a local demo tool.
