#!/usr/bin/env node

// ─── 1. IMPORTS ──────────────────────────────────────────────────────────────
// dotenv reads your .env file and puts values onto process.env
import "dotenv/config";

// readline is Node's built-in module for reading line-by-line from stdin
import readline from "readline";

// execSync lets us run shell commands synchronously
import { execSync } from "node:child_process";

// The official Anthropic SDK. Handles auth, retries, and the streaming protocol.
import Anthropic from "@anthropic-ai/sdk";

// Optional proxy support (reads HTTPS_PROXY / NODE_EXTRA_CA_CERTS from env)
import { getProxyOptions } from "./proxy.js";

// ─── 2. CLIENT SETUP ─────────────────────────────────────────────────────────
// Instantiating with no args: SDK auto-reads ANTHROPIC_API_KEY from process.env
// Optionally set ANTHROPIC_BASE_URL in .env to use a custom endpoint
const client = new Anthropic(getProxyOptions());

// ─── 3. CONVERSATION HISTORY ─────────────────────────────────────────────────
// The Claude API is stateless — it has no memory between calls.
// We manually track the full conversation and send it every time.
// Each message is { role: "user" | "assistant", content: string }
const history = [];

// ─── 4. SYSTEM PROMPT ────────────────────────────────────────────────────────
// This shapes Claude's personality and constraints for every turn.
// It's sent separately from the history, not as a message.
const SYSTEM = `You are a concise CLI assistant. Be direct and accurate. No fluff, tell it like it is.
You have a bash tool to execute commands on the user's machine when needed.
Working directory: ${process.cwd()}`;

// ─── 5. READLINE INTERFACE ───────────────────────────────────────────────────
// rl wraps stdin/stdout so we can prompt the user and read their input.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ─── 6. COLORS ───────────────────────────────────────────────────────────────
// ANSI escape codes. \x1b[Xm sets color, \x1b[0m resets it.
const dim   = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan  = (s) => `\x1b[36m${s}\x1b[0m`;
const gray  = (s) => `\x1b[90m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

// ─── 7. TOOLS ───────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "bash",
    description:
      "Execute a bash command on the user's machine. Use this to run shell commands, inspect files, install packages, etc.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The bash command to execute",
        },
      },
      required: ["command"],
    },
  },
];

// ─── 8. BASH EXECUTION ──────────────────────────────────────────────────────
function runBash(command) {
  try {
    const output = execSync(command, {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output;
  } catch (err) {
    const parts = [];
    if (err.stdout) parts.push(err.stdout);
    if (err.stderr) parts.push(err.stderr);
    parts.push(`Exit code: ${err.status ?? 1}`);
    return parts.join("\n");
  }
}

// ─── 9. COMMAND CONFIRMATION ────────────────────────────────────────────────
function confirmCommand(command) {
  return new Promise((resolve) => {
    rl.question(
      yellow(`  Run: ${command}\n`) + "  Confirm? [y/N] ",
      (answer) => resolve(answer.trim().toLowerCase() === "y"),
    );
  });
}

// ─── 10. CORE: SEND MESSAGE + STREAM RESPONSE ──────────────────────────────
async function chat(userInput) {
  // Add the user's message to history before sending
  history.push({ role: "user", content: userInput });

  // Tool-use loop: keeps going as long as Claude wants to call tools
  while (true) {
    // Print the assistant label before streaming starts
    process.stdout.write(cyan("Claude: "));

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM,
      messages: history,
      tools: TOOLS,
    });

    // Stream text chunks as they arrive
    stream.on("text", (chunk) => {
      process.stdout.write(chunk);
    });

    const response = await stream.finalMessage();
    process.stdout.write("\n\n");

    // Save Claude's full response to history (content as block array)
    history.push({ role: "assistant", content: response.content });

    // If Claude didn't request a tool call, we're done
    if (response.stop_reason !== "tool_use") break;

    // Process each tool_use block
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const { id, name, input } = block;
      if (name === "bash") {
        const confirmed = await confirmCommand(input.command);
        let result;
        if (confirmed) {
          result = runBash(input.command);
          // Show a truncated preview of the output
          const preview = result.length > 300 ? result.slice(0, 300) + "…" : result;
          console.log(dim(preview));
        } else {
          result = "User denied this command.";
          console.log(gray("  (denied)\n"));
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: id,
          content: result,
        });
      }
    }

    // Push tool results as a user message and loop back
    history.push({ role: "user", content: toolResults });
  }
}

// ─── 11. INPUT LOOP ──────────────────────────────────────────────────────────
// Recursive async function: prompt → chat → repeat.
// Recursion here is clean because each call awaits the previous one —
// the stack doesn't grow unbounded.
function loop() {
  rl.question(cyan("You: "), async (input) => {
    const trimmed = input.trim();

    // Exit commands
    if (!trimmed || trimmed === "/quit" || trimmed === "/exit") {
      console.log(gray("\nBye.\n"));
      rl.close();
      process.exit(0);
    }

    // Show history command — useful for debugging context
    if (trimmed === "/history") {
      console.log(dim(JSON.stringify(history, null, 2)));
      loop();
      return;
    }

    // Send to Claude, then loop again
    await chat(trimmed);
    loop();
  });
}

// ─── 12. ENTRY POINT ─────────────────────────────────────────────────────────
console.log(gray("\niterAI  |  /quit to exit  |  /history to inspect context\n"));
loop();
