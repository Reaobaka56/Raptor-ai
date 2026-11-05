# Agent system

An **agent** is a configured LLM worker (provider, model, system prompt, tools, permissions).
A **task** is a unit of work assigned to an agent. Running a task either gets a plain completion,
or - when the agent is attached to a running sandbox and has executable tools - a bounded
**tool loop** whose every action is authorized against the agent's configuration.

Code: `services/agent_service.py`, `services/task_service.py`, `services/agent_runtime.py`,
`task_router.py` (`/api/tasks/{id}/execute`), `agent_router.py`.

## Agent configuration

| Field | Notes |
|---|---|
| `name`, `role`, `description` | `name` 1-120 chars |
| `provider`, `model` | provider in `openai, anthropic, google/gemini, mistral, groq, deepseek, xai, openrouter` run today; `cohere, local, custom` are accepted but fail at run time with a clear message |
| `system_prompt` | max 20k chars |
| `tools` | subset of `file_read, file_write, command_exec, git_ops, install_deps, run_tests, lint, build, commit_changes` (executable) plus `network, start_dev_server, inspect_logs` (accepted, **not executable**). Unknown names are rejected |
| `permissions` | see below |
| `sandbox_id` | set by attaching the agent to a sandbox session |

### Permissions (all enforced in `agent_runtime.authorize`)

| Key | Default | Effect |
|---|---|---|
| `allowed_paths` | none (all) | file tools only touch matching paths. Entries: `dir/` prefix, `*.md`-style globs, exact names |
| `blocked_paths` | none | always denied, wins over `allowed_paths`; also rejected if named in a shell command |
| `can_commit` | `false` | needed for `git commit` / `commit_changes` (also blocks `git commit` inside `command_exec`) |
| `can_push` | `false` | `git push`/remote operations are denied regardless in the sandbox (no network) |
| `requires_approval` | `true` | a run that changed files or ran commands finishes in **`review`**, not `done` |
| `max_steps` | 12 (`AGENT_MAX_STEPS`) | tool-loop turns |
| `max_file_changes` | 20 | distinct files written per run |
| `max_commands` | 40 | commands per run |

Always-on limits: paths must be workspace-relative (no `..`, no absolute), writes <= 200 KB, tool
output fed back to the model is truncated to 4 KB, and the sandbox's own path/command policy
(`.env`, keys, metadata endpoints, destructive commands) still applies underneath.

## Task lifecycle

```
backlog -> assigned -> in_progress -> done
                           │  └────-> review --(human approves)--> done
                           └───────-> failed
```

* `POST /api/tasks/{id}/execute` validates, checks **dependencies are `done`**, then atomically
  claims the task (`claim_task`) and the agent (`claim_agent`). Double-start or a busy agent -> `409`.
  A run stuck `in_progress` longer than 15 min (crash/restart) can be claimed again.
* The run happens in a background task. No DB connection is held while the LLM runs.
* Failures store a JSON entry in `errors`; the agent is released to `idle`. Timeouts:
  `AGENT_LLM_TIMEOUT_SECONDS` (120) per LLM call, `AGENT_RUN_TIMEOUT_SECONDS` (600) per tool run.
* Activity (`task_assigned`, `file_modified`, `command_run`, `task_completed`, `error`) goes to
  `agent_activity_log` (`GET /api/agents/{id}/activity`).

Agent status machine (`VALID_STATUS_TRANSITIONS`) is compare-and-set, so racing transitions can't
both succeed.

## The tool loop (`agent_runtime.run_agent_loop`)

Provider-agnostic protocol - the model replies with exactly one JSON object per turn:

```json
{"tool": "file_write", "args": {"path": "docs/a.md", "content": "..."}}
{"final": "summary of what I did"}
```

Each turn: parse -> `authorize()` -> execute via `SandboxToolBackend` -> append the result wrapped
in `<tool_output>` (labelled untrusted data) -> next turn. A denial is reported to the model and
counted; more than 5 denials aborts the run. Two malformed replies are tolerated, the third aborts.
If the step limit is hit with no `final`, the task fails (`incomplete`) rather than pretending success.

### Adding a tool

1. Add the name to `ALL_TOOLS` (`agent_service.py`) and `EXECUTABLE_TOOLS` + `TOOL_HELP` (`agent_runtime.py`).
2. Add its argument validation and policy to `authorize()` - **deny by default**; return normalized args.
3. Add its execution to `_execute()` (go through the `ToolBackend`, never call subprocess directly).
4. Add unit tests in `tests/unit/test_agent_runtime.py` (allowed, denied, malformed) and an
   end-to-end case in `tests/integration/test_agent_tool_run.py`.

## Provider keys and quotas

Keys resolve BYOK-first (`google` keys may be stored as `google` or `gemini`), then the platform
key **for the same provider only** - a missing key never silently switches provider. Runs on the
platform key are capped per user per UTC day (`AGENT_PLATFORM_DAILY_LIMIT`, default 25; Redis,
fail-open). A user's non-Google key is never sent to Gemini.

## Known limitations

* Tool use requires the agent to be attached to a **running sandbox**; otherwise it is a plain completion.
* `network`, `start_dev_server`, `inspect_logs` are not executable. `install_deps` needs network
  (`SANDBOX_DOCKER_NETWORK=bridge`, or the local backend).
* Isolation level depends on the sandbox backend - read [SANDBOX.md](SANDBOX.md) before enabling
  tools for untrusted users.
* Runs are in-process (no queue): a restart abandons in-flight runs (recoverable after 15 min).
