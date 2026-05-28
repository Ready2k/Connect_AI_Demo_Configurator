# Connect AI Agent Demo Builder

This is a local Next.js web application designed to help configure, preview, and deploy a two-agent Amazon Connect Customer AI demo.

The tool generates the API payloads needed to provision:
1. **CustomerIntentRouter**: Orchestration agent for capturing intent and routing.
2. **LostCard**: Specialist self-service agent for lost, stolen, damaged, or retained cards.

## Features

- **Local Persistence**: Configuration is stored in your browser's local storage.
- **YAML Prompt Editing**: Built-in editor for managing agent prompts.
- **Validation**: Ensures prompts contain necessary placeholders (`{{$.conversationHistory}}`, `<message>`, etc.) and valid YAML.
- **Payload Preview**: See the exact JSON payloads that will be pushed to the Amazon Q Connect API.
- **Safe Deployment**: Dry-run preview and specific deployment steps to manage AWS changes.
- **Portability**: Import and export your configuration via JSON.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment variables example:
   ```bash
   cp .env.example .env.local
   ```

3. Update `.env.local` with your target AWS Region, Assistant ID, and (optionally) Connect Instance ID. **Never commit this file.**

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Security & Privacy

- **No Secrets Stored**: The application relies on the default AWS Credential chain of the environment running the server (e.g. your local AWS profile). It does not store access keys or secret keys in the codebase.
- **Local Config Only**: Your project configuration is saved locally to the browser's `localStorage` and never sent anywhere except to AWS during deployment.
- **Synthetic Data Only**: Do not enter real customer PII into the agent prompts or payload configurations.
