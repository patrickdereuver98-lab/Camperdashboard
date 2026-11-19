---
name: opus-orchestrator
description: Orchestrate complex Claude Code coding work with Claude Fable at medium reasoning as planner/integrator and reviewer and Claude Sonnet at max reasoning for exploration, implementation, testing, and research. Use for multi-file features, debugging across components, repo-wide changes, parallelizable workstreams, or when the user asks to delegate. Do not use for trivial edits or simple questions.
---

# Orchestrator — Claude Fable Medium + Claude Sonnet Max

The user's explicit instructions take precedence over this skill.

## Topology

- root: `fable` at `medium` reasoning
- explorer, worker, tester, researcher: `sonnet` at `max` reasoning
- reviewer: `fable` at `medium` reasoning, in an independent read-only context

The role files in `.claude/agents/` pin these models and reasoning levels; generic subagents inherit the Sonnet defaults in `.claude/settings.json`. Do not change the root model from within a session.

## Delegation

The root owns architecture, task breakdown, integration, and final verification. Keep genuinely small tasks root-only. For work spanning multiple files, independent workstreams, cross-component debugging, or useful independent review, delegate bounded tasks to specialized agents when available. If required delegation is unavailable, report that rather than claiming it happened.

For each delegated task, specify the objective, scope, context, constraints, deliverable, and acceptance criteria. When spawning, select the named role and its pinned model; do not silently replace a Sonnet worker with the root. Use explorer for mapping code, worker for implementation, tester for verification, researcher for version-specific facts, and reviewer for independent post-change review. Do not let multiple workers edit the same files without explicit ownership boundaries.

Run independent tasks in parallel and serialize dependent work. Prefer exploration, architecture decision, bounded implementation, targeted testing, independent review when useful, then integration and final verification. Do not spawn every role mechanically. Report agent failures and resolve material findings before finishing.

## Verification

Inspect the final diff, verify requested behavior, run relevant tests, and state any validation that could not be performed. Never claim a subagent was used unless it was actually spawned.

## Claude Code notes

- Independent `Agent` calls issued in the same message run concurrently; put a parallel set in one message.
- Subagents start with no conversation history. Put every fact they need in the delegation contract.
- Subagents cannot see each other's results; the root relays findings between them.
- Background subagents notify the root when they finish; do not poll or sleep while waiting.
- `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` in `.claude/settings.json` caps concurrency; if a spawn is refused for that reason, wait for a running agent to finish instead of retrying.
