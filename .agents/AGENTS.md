# Project Rules & Guidelines: P2P Video Call App

## Documentation & Structured Tracking Standard
All design decisions, development progress, implementations, test results, and troubleshooting/debugging sessions MUST be rigorously structured and documented.

### Documentation Directory Structure (`documentation/`):
- `documentation/design/` - Architecture specs, UI/UX flows, system design decisions, and data schemas.
- `documentation/development/` - Implementation plans, roadmap, feature specifications, and component guides.
- `documentation/testing/` - Testing strategies, automated/manual test plans, test execution logs, and coverage reports.
- `documentation/troubleshooting/` - Root cause analyses, bug investigation logs, and resolution entries.
- `documentation/DECISION_LOG.md` - Chronological log of major architectural and design decisions.

### Rules for Agent Iterations:
1. Every new feature, design decision, test run, or troubleshooting session must update or create corresponding documents in `documentation/` under the appropriate category.
2. Maintain clear cross-references between code changes and documentation files.
3. Keep documents updated whenever specs, implementations, or fixes change.
4. ALWAYS explain troubleshooting rationale, diagnostic findings, and root cause discoveries to the user BEFORE proposing or applying code fixes.
