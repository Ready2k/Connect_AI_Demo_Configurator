# AWS Prerequisites

Everything that must exist in AWS before you run the Demo Builder. Set these up once; you can reuse them across multiple demo runs.

---

## 1. AWS Credentials (local machine)

The app uses the default AWS credential chain — no keys in config files. Any of these will work:

| Method | How |
|---|---|
| AWS SSO | `aws sso login --profile <profile>` then `export AWS_PROFILE=<profile>` |
| Named profile | `~/.aws/credentials` with `[profile-name]` and `export AWS_PROFILE=profile-name` |
| Environment vars | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_SESSION_TOKEN` |
| IAM instance role | Automatic if running on EC2/ECS |

The identity must have the permissions in [`IAM_PERMISSIONS.md`](../IAM_PERMISSIONS.md). Apply `iam-policy.json` with the `{region}` and `{account-id}` placeholders substituted.

---

## 2. Amazon Connect Instance

You need an existing Connect instance. The app reads from it but does not create instances.

**Required:** Instance ID (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)  
**Where to find it:** Connect console → your instance → Instance ARN → the UUID at the end

Set `CONNECT_INSTANCE_ID=` in `.env.local`.

Also set `CONNECT_REGION=` to the region your Connect instance is in. Connect regions differ from Q Connect regions in some deployments (e.g. Connect in `us-west-2`, Q Connect assistant in `eu-west-2`).

---

## 3. Amazon Q in Connect (Wisdom)

Q in Connect must be enabled on your Connect instance and a **Q Connect Assistant** must exist.

### Check it's enabled

Connect console → your instance → Amazon Q → verify Q in Connect is enabled (not just Contact Lens).

### Find your Assistant ID

```bash
aws wisdom list-assistants --region <your-q-connect-region>
```

Copy the `assistantId` from the response. It looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

Set `CONNECT_Q_ASSISTANT_ID=` in `.env.local` and enter the same value in **Settings → Q Connect Assistant ID** inside the app.

### Verify model access

The `/settings` page has a **List Models** button that calls `wisdom:ListModels`. If it returns an empty list, the assistant exists but has no approved model. Contact your AWS account team to enable Claude models for Q in Connect in your region.

---

## 4. Amazon Bedrock Model Access (for Experience Builder)

The Experience Builder generates Contact Flow JSON by calling Claude via Bedrock. You need:

1. **Model access enabled** in your AWS account for the Claude model you want to use.  
   Bedrock console → Model access → request access for `Anthropic Claude` models.

2. **Cross-region inference profiles** — the app defaults to `us.amazon.nova-pro-v1:0` for flow generation, which routes calls across US regions. If you want to use a Claude model, the profile ID format is `us.anthropic.claude-*`.  
   Check available profiles: Bedrock console → Cross-region inference.

3. **Correct region** — Bedrock calls use the `AWS_REGION` from `.env.local`, not the Connect region. Ensure your IAM identity has `bedrock:InvokeModel` in that region.

You can override the default model in **Settings → Flow Assistant Model ID**.

---

## 5. Amazon Lex V2 Bot (for Experience Builder)

The generated Contact Flow uses a Lex V2 bot as the bridge between Amazon Connect and the Q Connect AI Agent. The bot itself does minimal NLU — its real job is to hand the conversation to Q Connect.

### What you need

- A Lex V2 bot **associated with your Connect instance**
- The bot's **Alias ARN** (format: `arn:aws:lex:<region>:<account>:bot-alias/<BotId>/<AliasId>`)

### Create a minimal Lex bot for Q Connect

If you don't have one, create a blank Lex V2 bot and associate it:

1. Lex V2 console → Create bot → "Start with an example" → pick any → finish wizard
2. Build the bot (required before associating)
3. Create an alias (e.g. `QConnectAlias`) pointing to a bot version
4. Connect console → your instance → Amazon Lex → Associate bot → select your bot and alias
5. Copy the **Alias ARN** from the Lex bot alias detail page

You will paste this ARN into the **Lex Bot Alias ARN** field in the Experience Builder Journey Configurator.

> **Note:** The Lex bot does not need any intents or slot types configured. Q Connect takes over the conversation via the session ARN injected into `LexSessionAttributes`.

---

## 6. Connect Queues

You need at least one queue for the fallback routing path in generated flows. Any existing queue in your Connect instance will work.

Find queue IDs/ARNs:

```bash
aws connect list-queues \
  --instance-id <your-instance-id> \
  --queue-types STANDARD \
  --region <connect-region>
```

Or use the queue picker in the Experience Builder — it fetches queues live from your instance.

---

## 7. Contact Flows (for Schema Discovery)

The Flow Discovery page extracts block schemas from your **existing** Contact Flows to build a schema library used by the flow generator. You should have at least a few real flows in your Connect instance before using Flow Discovery.

If your instance is fresh and has no custom flows, the built-in sample flows (e.g. `Default agent whisper`, `Default customer queue`) are sufficient to bootstrap the schema library.

> For best results, run Flow Discovery on any existing flow that uses a **Connect Assistant** block (`CreateWisdomSession`). The generator requires this schema to be present before it can produce a valid flow. The Flow Discovery page shows a warning if this schema is missing.

---

## Summary checklist

| Item | Where used | Config |
|---|---|---|
| AWS credentials | All AWS calls | Credential chain |
| Connect instance ID | Connect API, WebRTC/chat test | `CONNECT_INSTANCE_ID` / Settings |
| Connect region | Connect API calls | `CONNECT_REGION` / Settings |
| Q Connect assistant ID | Q Connect API, model list | `CONNECT_Q_ASSISTANT_ID` / Settings |
| Q Connect region | Q Connect API calls | `AWS_REGION` / Settings |
| Bedrock model access | Flow generation, verification | `FLOW_ASSISTANT_MODEL_ID` / Settings |
| Lex V2 bot alias ARN | Experience Builder | Journey Configurator field |
| At least one queue | Experience Builder routing rules | Journey Configurator picker |
| Existing contact flows | Flow Discovery schema extraction | Flow Discovery page |
