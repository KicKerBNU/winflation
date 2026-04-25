---
name: learn
description: >
  A global slash command skill triggered when the user types /learn. Performs two actions in sequence:
  (1) Reads the current Claude Code session history, extracts key decisions, patterns, tech context, and
  resolved problems, then does a FULL REWRITE of the project's CLAUDE.md at the git root with updated context.
  (2) Analyzes the session for reusable patterns (repeated 2+ times OR clearly reusable once) and proposes
  new skills that COULD be created — without creating them automatically. Always use this skill when the
  user types /learn, regardless of project or context.
---

# /learn Skill

Triggered by the user typing `/learn`. Always run both steps in order.

---

## Step 1 — Update CLAUDE.md

### 1.1 Find the project root

```bash
git rev-parse --show-toplevel
```

This is where CLAUDE.md lives (or will be created).

### 1.2 Read the current CLAUDE.md (if it exists)

```bash
cat <project-root>/CLAUDE.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

Note existing sections — you'll use these as a schema reference for the rewrite.

### 1.3 Read the session transcript

Use the session history available in your context window. Extract:

- **Project identity**: name, purpose, domain, target users
- **Tech stack**: languages, frameworks, libraries, tooling, config files seen
- **Architecture decisions**: patterns chosen, patterns rejected and why
- **Key problems solved**: bugs fixed, approaches that worked, ones that didn't
- **Conventions established**: naming, file structure, code style, testing approach
- **External integrations**: APIs, services, databases, third-party tools
- **Current focus / WIP**: what is actively being built right now
- **Known issues / TODOs**: things explicitly flagged as unresolved

### 1.4 Write the new CLAUDE.md

**Full rewrite** — do not append. Replace the entire file with a clean, structured document.

Use this structure (adapt sections based on what's actually known — omit sections with no content):

```markdown
# CLAUDE.md — [Project Name]

> Last updated: [date] via /learn

## Project Overview
[1-3 sentences: what this is, who it's for, what problem it solves]

## Tech Stack
[Bulleted list: language, framework, build tool, styling, testing, deployment]

## Architecture
[Key structural decisions, folder conventions, important patterns in use]

## Development Conventions
[Naming conventions, component patterns, commit style, anything established in sessions]

## Key Problems Solved
[Short entries: problem → solution. Only include things that took real effort or are non-obvious]

## External Integrations
[APIs, services, env vars needed, auth patterns]

## Current Focus
[What's actively being worked on as of this session]

## Known Issues / TODOs
[Explicitly flagged items only — don't invent]
```

**Rules for the rewrite:**
- Be factual — only include things actually established in the session or existing CLAUDE.md
- Be concise — this file is read at the start of every Claude Code session; keep it tight
- Do not add aspirational content or things "to consider" — only confirmed decisions
- If existing CLAUDE.md has context not covered in this session, preserve it (merge from old into new)

---

## Step 2 — Skill Detection

### 2.1 Analyze the session for patterns

Scan the full session history. Flag a pattern as **skill-worthy** if it meets either condition:

- **Repeated**: The same type of task was done 2+ times (e.g. "created a new API route" twice, "wrote a migration" twice)
- **Reusable**: Even if done once, the workflow is clearly generalizable beyond this project (e.g. a complex multi-step setup, a non-obvious debugging approach, a specific code generation pattern)

### 2.2 For each candidate pattern, evaluate

Ask yourself:
- Would this save meaningful time if it were a skill?
- Is there enough structure to write reliable instructions?
- Is it specific enough to be actionable (not just "write good code")?

If yes to all three → it's a skill candidate.

### 2.3 Present candidates to the user

Do NOT auto-create skills. Present a list like this:

---

**🧠 Skill candidates found in this session:**

**1. `[skill-name]`**
- **What it does**: [1 sentence]
- **Trigger**: When the user [phrase or context]
- **Why it qualifies**: [repeated N times / reusable pattern because...]
- **Estimated value**: [High / Medium] — [one line reason]

**2. `[skill-name]`**
...

---
*Reply with the number(s) of skills you want created, or "none" to skip.*

---

## Output format for the user

After both steps, report back concisely:

```
✅ CLAUDE.md updated at <path>
   → X sections written, Y items carried over from previous version

🔍 Session analysis complete
   → Found N skill candidate(s) [listed above]
   → No candidates found [if none]
```

---

## Edge cases

- **No git repo found**: Tell the user, ask them to specify a path manually
- **CLAUDE.md doesn't exist yet**: Create it from scratch using only session context
- **Empty / very short session**: Update CLAUDE.md with whatever is known, report "Session too short to detect skill patterns"
- **Ambiguous patterns**: Only flag if you're confident it's reusable — when in doubt, leave it out
