# Third-party Claude Code skills

The skills in `.claude/skills/` were vendored from these repositories (snapshot taken 2026-10-08):

| Source | Commit | License | What was copied |
|---|---|---|---|
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 1a2c459 | MIT | 7 skills from `.claude/skills/` (ui-ux-pro-max, design, design-system, brand, banner-design, slides, ui-styling) |
| [ancoleman/ai-design-components](https://github.com/ancoleman/ai-design-components) | 76551b7 | MIT | 76 skills from `skills/` |
| [HermeticOrmus/LibreUIUX-Claude-Code](https://github.com/HermeticOrmus/LibreUIUX-Claude-Code) | 41a968c | MIT | 74 skills from `plugins/*/skills/` (plugin agents/commands/hooks not included) |
| [ceorkm/mobile-app-ui-design](https://github.com/ceorkm/mobile-app-ui-design) | 4c67a0e | MIT (per README) | 1 skill: `mobile-app-ui-design` |
| [tomas-u/claude-skills](https://github.com/tomas-u/claude-skills) | fa6da38 | MIT | 6 skills: `ux`, `devops`, `technical`, `product-owner`, `security`, and `code-review` installed as **`pr-code-review`** (renamed so it doesn't shadow Claude Code's built-in `/code-review`) |
| [maxbogo/awesome-ai-tools-for-ui](https://github.com/maxbogo/awesome-ai-tools-for-ui) | 680b351 | none stated | Not a skill repo (curated link list); README saved as `awesome-ai-tools-for-ui.md` |

To update, re-clone the source and replace the corresponding skill directories.
