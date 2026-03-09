# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install   # install dependencies
npm start     # run the CLI chat interface
```

No build step, no test suite — this is a single-file Node.js ESM project.

## Setup

Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. Optionally set `ANTHROPIC_BASE_URL` for a custom/proxy endpoint.

### Proxy / Charles 抓包

在 `.env` 中设置以下变量即可通过 Charles 抓包：

```
HTTPS_PROXY=http://127.0.0.1:8889
NODE_EXTRA_CA_CERTS=~/charles-ssl-proxying-certificate.pem
```

## Architecture

Everything lives in `index.js`. The app is a recursive async REPL:

1. `loop()` prompts the user via `readline`
2. Built-in commands (`/quit`, `/exit`, `/history`) are handled inline
3. All other input goes to `chat()`, which pushes the user message to `history[]`, streams a response from Claude via `client.messages.stream()`, collects the full text, then pushes the assistant reply to `history[]`
4. `loop()` calls itself after each turn

Key design decisions:
- **`history[]`** is the sole source of conversational state — it's sent in full on every API call
- **Streaming** uses `stream.on("text")` for token-by-token output with `stream.finalMessage()` to await completion
- **ESM** (`"type": "module"` in package.json) — use `import`, not `require`
- Model is hardcoded to `claude-sonnet-4-6` with `max_tokens: 1024`
