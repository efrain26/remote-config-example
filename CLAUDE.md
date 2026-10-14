# remote-config-example

For setup, how the project works, adding flags or migrations: use the skill in `.claude/skills/remote-config-local/SKILL.md`.

- Node 22.18+ runs the `.ts` files directly (type stripping): no enums, no parameter properties, imports end in `.ts`.
- Never edit a migration that already ran; add a new file.
- Before finishing a change: `npm test` and `npm run typecheck`.
