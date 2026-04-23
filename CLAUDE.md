@AGENTS.md

## UI/UX Design System

This project includes the **UI/UX Pro Max** skill for design decisions.

Location: `.claude/skills/ui-ux-pro-max/`

### How to use it

Before making any UI changes, run the design system generator:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "CRM SaaS dashboard dark premium" --design-system -p "TuContador CRM"
```

Search specific domains:

```bash
# Styles / effects
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "glassmorphism dark" --domain style

# UX guidelines
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "animation accessibility" --domain ux

# Typography
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "premium modern" --domain typography

# Next.js stack guidelines
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "layout responsive" --stack nextjs

# shadcn/ui patterns
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "components forms" --stack shadcn
```

### Established design decisions

- **Theme:** Dark OLED (`oklch(0.072 0.012 265)` background)
- **Primary:** Indigo (`oklch(0.62 0.24 264)`)
- **Style:** Glassmorphism + subtle glows + `backdrop-filter: blur`
- **Radius:** `rounded-xl` (14px) as default
- **Active nav:** `nav-active-bar` class (inset left bar + gradient bg)
- **Cards:** `premium-card` class or inline `oklch(0.105 0.013 265)` bg
- **Fonts:** System sans-serif (DM Sans / Geist recommended)
- **Icons:** Lucide React exclusively — no emojis as icons

Full skill documentation: `.claude/skills/ui-ux-pro-max/SKILL.md`
