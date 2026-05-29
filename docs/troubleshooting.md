# Troubleshooting

Common failures, why they happen, and how to fix them.

---

## AWS Credentials

### "Could not load credentials from any providers"

The Next.js server process cannot see your AWS credentials.

- If you use AWS SSO: run `aws sso login --profile <profile>` and `export AWS_PROFILE=<profile>` **before** `npm run dev`. Environment variables set after the server starts are not picked up.
- If you use a named profile: verify `~/.aws/credentials` has the right profile and `AWS_PROFILE` is exported.
- Run `aws sts get-caller-identity` in the same terminal session to confirm the credential chain resolves before starting the app.

### "AccessDenied" on specific operations

The IAM identity is missing a specific permission. Check `IAM_PERMISSIONS.md` and match the failing operation to its required action. Common gaps:

| Error | Missing permission |
|---|---|
| `ListAssistants` fails | `wisdom:ListAssistants` on `*` |
| `ListContactFlows` fails | `connect:ListContactFlows` |
| `StartWebRTCContact` fails | `connect:StartWebRTCContact` |
| `InvokeModel` fails | `bedrock:InvokeModel` |

---

## Q Connect Agent Deployment

### "Duplicate name" error on deploy

A prompt or agent with the same computed name already exists in Q Connect. The app detects this before creating and throws with the colliding name.

**Fix:** Change `nameSuffixMode` in Settings to `timestamp` or `environment_and_timestamp` to generate a unique suffix, or manually delete the conflicting resource via the Q Connect console.

### "Assistant not found" / assistant ID errors

The assistant ID in Settings does not exist in the selected region.

- Verify with: `aws wisdom list-assistants --region <your-region>`
- Confirm `AWS_REGION` in `.env.local` matches the region where the assistant lives. Q Connect assistants are region-specific.

### Deployment succeeds but agents don't appear in Connect console

The agents are created in Q Connect but may need to be **published** (not just `SAVED`) and associated with your Connect instance before they appear in the routing UI. Change `visibilityStatus` in Settings to `PUBLISHED` and redeploy.

### "ListIntegrationAssociations" access error during agent creation

Q Connect validates the Connect–Q Connect integration internally when creating an `ORCHESTRATION` agent. Your IAM identity needs `connect:ListIntegrationAssociations` even though the app doesn't call it directly. Add it to the `ConnectRead` policy statement.

---

## Flow Generation (Experience Builder)

### Generation fails with "Missing lexBotAliasArn"

The Lex Bot Alias ARN field in the Journey Configurator is empty. This is required — the generator cannot build the `ConnectParticipantWithLexBot` block without a valid Lex bot ARN.

**Format:** `arn:aws:lex:<region>:<account-id>:bot-alias/<BotId>/<AliasId>`

### Generated flow fails to deploy: "InvalidContactFlowException"

The Connect API is strict about flow JSON structure. The app normalises generated JSON before deployment (`normalizeFlowContent` in `src/app/api/aws/connect/flows/route.ts`) but some hallucinated structures can slip through.

Common issues and what the normaliser handles automatically:

| LLM behaviour | Auto-fixed? | Notes |
|---|---|---|
| `BlockId`/`BlockType` instead of `Identifier`/`Type` | Yes | Module format variant |
| `NextBlockId` instead of `NextAction` | Yes | Nova Pro format |
| `GetUserInput` with a Lex bot | Yes | Rewritten to `ConnectParticipantWithLexBot` |
| `NoMatchingError` on a `Compare` block | Yes | Rewritten to `NoMatchingCondition` |
| `Errors` array on `UpdateFlowLoggingBehavior` | Yes | Stripped |
| `Transitions` block on `DisconnectParticipant` | Yes | Removed |
| `TransferToFlow` block type | Yes | Stubbed as `DisconnectParticipant` |
| `SessionState` in `ConnectParticipantWithLexBot` | Yes | Stripped (Connect rejects it) |
| Missing `Metadata.ActionMetadata` | Yes | Injected (Connect UI requires it) |
| `Version` not `"2019-10-30"` | Yes | Overwritten |
| Missing session ARN attribute before Lex block | Yes | `UpdateContactAttributes` block injected |

If deployment still fails after normalisation, the API response includes `sentContent` (the normalised JSON that was sent). Check it against the Connect flow JSON schema.

### "Flow generation returns manual_review status"

Bedrock returned a response that could not be parsed as JSON even after one automatic retry. The generation logs (visible in the LogsSidebar) will show the raw model output.

**Common causes:**
- The model is producing a narrative explanation instead of JSON — try a more capable model (e.g. Claude Sonnet instead of Nova Pro).
- The schema library is very large, pushing the system prompt past the model's context window — clear old schemas from `schemaStore` and re-discover only the Connect Assistant flow.

### "Missing wisdomAgentArn" error

The Journey Configurator requires a **Q Connect AI Agent ARN** to fill the `ConnectParticipantWithLexBot` block parameters. This is the ARN of the `CustomerIntentRouter` (or whichever agent handles the conversation).

**Where to get it:** After deploying the Q Connect agents via `/deploy`, the deployment manifest shows the agent ARN. Paste it into the **Q Connect Agent ARN** field in the Journey Configurator.

### Flow generates successfully but routing doesn't work in Connect

The Compare block routes on `$.Lex.SessionAttributes.AuthResult`. Verify that your Q Connect agent's tool names exactly match the routing rule conditions you configured. For example, if the agent signals `Complete` via a `RETURN_TO_CONTROL` tool, the routing rule condition must be the string `"Complete"` (case-sensitive).

The default agent config uses tools named `Complete` and `Escalate`.

---

## WebRTC Voice Testing

### "StartWebRTCContact is not available in this region"

`StartWebRTCContact` is confirmed available in `us-east-1` and `us-west-2`. If your Connect instance is in a different region, this feature will not work. Set `CONNECT_REGION=us-east-1` (or `us-west-2`) in Settings if your instance is accessible from those regions, or use the Chat Test instead.

### "Microphone access failed"

The browser blocked microphone access. Either:
- The user denied the permission prompt — click the lock icon in the browser address bar and allow microphone access, then reload.
- The app is being accessed over `http://` (not `https://`) from a remote host — browser security policies block `getUserMedia` on non-localhost non-HTTPS origins. Access the app via `http://localhost:3000`.

### Call connects but no audio / one-way audio

The WebRTC tester uses `amazon-chime-sdk-js` to establish the audio session via the Chime Meeting API returned by `StartWebRTCContact`. Issues:

- **No remote audio:** Check that the hidden `<audio>` element in the page is not muted by the browser. Some browsers auto-mute new audio elements — click anywhere on the page after the call connects to trigger the browser's autoplay permission.
- **No microphone audio reaching Connect:** Check that `realtimeMuteLocalAudio` has not been called — the mute button in the tester reflects this state.

### "Participant connection failed" / DTMF not working

The DTMF keypad requires a separate participant connection token obtained via `/api/aws/connect/participant-connection`. If this step fails (shown in the DTMF status badge), DTMF cannot be sent but the voice session itself still works.

---

## Chat Testing

### Chat starts but the AI agent doesn't respond

The chat contact must traverse the Contact Flow and reach the `ConnectParticipantWithLexBot` block. If it's stuck:
- The flow may be routing to a queue before reaching the Lex block — check the flow logic in the Connect console.
- The `connection.acknowledged` event may not have been sent. The chat start route (`/api/aws/connect/chat/start`) sends this automatically after creating the participant connection; if it errors, the Contact Flow remains blocked waiting for the participant to join.

### "Failed to retrieve ConnectionToken from CreateParticipantConnection"

The participant token from `StartChatContact` expired before being used. The token is valid for a short window (typically 5 minutes). If there is a long delay between starting the chat and establishing the participant connection, the token will be invalid.

---

## Flow Discovery

### "Fetch Flows" returns empty list

- Confirm `CONNECT_INSTANCE_ID` is set and matches an instance in `CONNECT_REGION`.
- The app only fetches flows of type `CONTACT_FLOW` (not modules or whisper flows) — if your instance has no flows of this type, the list will be empty.

### Schema library doesn't show "Connect Assistant" schema

The flow generator requires a block schema for `CreateWisdomSession`. This is only discovered if you select and parse a flow that contains a Connect Assistant block.

**Fix:** In your Connect instance, find a flow that uses the Q Connect / Connect Assistant integration and parse it in Flow Discovery. If no such flow exists yet, create a minimal one in the Connect console first.

---

## Settings

### Model list is empty ("No models found for this assistant")

The `/api/aws/models` route calls `wisdom:ListModels` with both the region and assistant ID. This fails silently with an empty list if:
- The assistant ID field in Settings is blank.
- The assistant exists but your AWS account does not have Claude models approved for Q Connect. Contact your AWS account team.

### "connectRegion" vs "region" confusion

The app has two region settings:
- **AWS Region** (`aws.region`) — used for Q Connect and Bedrock calls.
- **Connect Region** (`aws.connectRegion`) — used for all `@aws-sdk/client-connect` calls (flows, queues, WebRTC, chat).

If your Connect instance is in a different region from your Q Connect assistant, set both explicitly. They default to the same value (`AWS_REGION`) if only one env var is provided.
