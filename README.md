# iterAI

> Building an AI agent CLI, one iteration at a time.

A minimal streaming CLI chat interface powered by Claude. Single file, no framework — a learning project that grows with each iteration.

---

## Prerequisites

- Node.js v18+
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env

# 3. Add your API key to .env
ANTHROPIC_API_KEY=

---

## Run

```bash
npm start
```

```
iterAI  |  /quit to exit  |  /history to inspect context

You: _
```

---

## Built-in commands

| Command | Description |
|---|---|
| `/quit` or `/exit` | Exit |
| `/history` | Print full conversation context as JSON |

---

## How it works

- **Stateless API, stateful array** — `history[]` holds every message and is sent in full on each request
- **Streaming** — uses `client.messages.stream()` so tokens print as they arrive
- **One file** — entire app lives in `index.js`

---

## Roadmap

This project evolves incrementally. Planned iterations:

- [ ] `/clear` command to reset conversation
- [ ] Persist sessions to disk
- [ ] Tool use (web search, file access)
- [ ] Multi-model support
- [ ] Agent loop

---

## Based on

[SimpleCLI](https://github.com/Zen-Open-Source/SimpleCLI) by Morgan Linton.
