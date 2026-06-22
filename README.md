# Single User Agent starter template

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fremiconnesson%2Feve-single-user-agent-starter&env=EVE_ACCESS_PASSWORD&envDescription=Choose%20a%20private%20password.&envLink=https%3A%2F%2Fgithub.com%2Fremiconnesson%2Feve-single-user-agent-starter%23deploy-your-agent)

This template is meant to be a starter you can customize.

On top of `eve`s amazing out of the box practicality, this starter adds an user-interface on top to make it ready to use out of the box for most people.

Install the skill and the vercel plugin so that your coding agents knows how to work with `eve`, then you can just ask it to customize this agent!

Customize it your way, the possibilities are endless:
- want to talk to your agents through telegram? ask for the [telegram channel](https://eve.dev/docs/channels/telegram)!
- want your agent to send you a report every morning? ask for a [schedule](https://eve.dev/docs/schedules)
- want you agent to orchestrate a fleet of specialist? ask for [subagents](https://eve.dev/docs/subagents)
- Want to connect to your Data Warehouse? ask your coding agent to help you do it!

## What you get

- A private, single-user chat app
- Web search through Vercel AI Gateway
- File uploads and a sandbox where the agent can work
- Image generation and downloadable files
- Conversation history in your browser
- A Next.js interface built with AI Elements

## Deploy your agent

You need GitHub and Vercel accounts.

1. Click **Deploy** above, at the top of the README.md
2. Choose where Vercel should create your copy of the repository.
3. Enter a long, unique value for `EVE_ACCESS_PASSWORD`.
4. Deploy the project, then open its production URL.
5. Sign in with the password you chose.

Vercel gives the agent access to AI Gateway, so you do not need to create or copy an AI provider key. Model, search, and image calls use your AI Gateway account.

## Try your first tasks

Start a conversation with one of these prompts:

- `Search the web for the latest news about eve and summarize the sources.`
- `Create an image of a small robot tending a rooftop garden.`
- Upload a document, then ask: `Summarize this file and list the decisions I need to make.`
- `Create a Markdown report from our conversation and give me the file.`

The agent shows its tool activity in the conversation. Generated images appear in the chat, and other files include a download action.

## Make the agent yours

Start by changing the agent's identity. Edit [`agent/instructions.md`](./agent/instructions.md), commit the change to GitHub, and Vercel will deploy it.

You can also use a coding agent with this prompt:

```text
Read AGENTS.md and the eve docs in node_modules/eve/docs. Turn this starter into
an agent for [describe your use case]. Keep the existing authentication, file
handling, chat history, and AI Elements interface. Run the repository's tests,
typecheck, and production build when you finish.
```

When you want to edit the project yourself, these are the main places to start:

| File | What it controls |
| --- | --- |
| [`agent/instructions.md`](./agent/instructions.md) | The agent's role and behavior |
| [`agent/agent.ts`](./agent/agent.ts) | The model the agent uses |
| [`agent/tools/`](./agent/tools) | Extra actions the agent can take |

Follow the [eve first-agent tutorial](https://eve.dev/docs/tutorial/first-agent) to learn how instructions, models, and tools work.

## Run it on your computer

Local development requires [Node.js 24](https://nodejs.org/en/download), [pnpm](https://pnpm.io/installation), and the [Vercel CLI](https://vercel.com/docs/cli).

```bash
pnpm install
vercel link
vercel env pull .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Local development does not require the application password.

## Keep your conversations private

The production site requires `EVE_ACCESS_PASSWORD`. Local development and Vercel Preview deployments do not use this password. Preview URLs may be public unless you enable Vercel Deployment Protection, so do not use Preview deployments for sensitive conversations or files.

Chat history stays in the current browser and does not sync across devices. Deleting a chat removes its browser record, but it does not delete the underlying eve workflow run.

## Learn more

- [eve documentation](https://eve.dev/docs)
- [eve source code](https://github.com/vercel/eve)
- [eve community](https://github.com/vercel/eve/discussions)
- [Implementation and maintenance notes](./AGENTS.md)
