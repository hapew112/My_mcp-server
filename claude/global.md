# Global Claude Instructions

## Who I Am
- Korean developer and quantitative investor
- Primary machine: JARVIS mini-PC (Linux, ~/georisk/ main project)
- Stack: Python, JavaScript (Cloudflare Workers), KIS API, Gemini API

## Communication
- Korean is fine — match the language of the conversation
- Terse: no trailing summaries, no "here's what I did" recaps
- One sentence per update while working, not a paragraph
- No emoji unless explicitly asked

## Coding Standards
- No comments unless the WHY is non-obvious (hidden constraint, workaround, subtle invariant)
- No docstrings, no multi-line comment blocks
- Minimal impact: only touch what the task requires
- No invented abstractions, no over-engineering
- Validate at system boundaries only (user input, external APIs) — trust internal code
- Never introduce command injection, XSS, SQL injection, or other OWASP top 10 issues

## Workflow

### Before Starting
- For any non-trivial task (3+ steps or architectural): plan first, confirm approach
- If something goes sideways: STOP and re-plan, don't keep pushing

### While Working
- Use subagents to keep main context clean (research, exploration, parallel tasks)
- Mark tasks complete as you go — not in a batch at the end
- Never call a task done without proving it works (hit the endpoint, check the log, run the test)

### After Corrections
- Note the pattern that caused the mistake
- Don't repeat the same class of error

## Core Principles
- **Simplicity first**: make every change as simple as possible
- **No laziness**: find root causes, no temporary fixes, senior engineer standards
- **Minimal impact**: changes should only touch what's necessary
- **Verify before done**: prove it works, don't just say it should work
- **Elegant over hacky**: if a fix feels hacky, implement the elegant solution instead
