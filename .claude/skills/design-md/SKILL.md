---
name: design-md
description: Collection of 80+ ready-made DESIGN.md design-system documents (colors, typography, spacing, components, tone) extracted from well-known sites such as Stripe, Linear, Vercel, Supabase, Notion, Airbnb, Revolut or Wise. Use when the user asks for a page or UI "in the style of" a known site, wants a DESIGN.md / design system file for the project, or wants visual inspiration and tokens to keep generated UI consistent.
metadata:
  source: https://github.com/VoltAgent/awesome-design-md
  license: MIT (see LICENSE)
---

# DESIGN.md collection

Each folder in `references/<site>/` holds a `DESIGN.md` (the design system: palette, type scale, spacing, radii, shadows, components, do's and don'ts) and a `README.md` (short description).

## How to use

1. List the available sites: `ls .claude/skills/design-md/references/`.
2. Pick the one(s) closest to what the user asked for (ask if it is ambiguous). Read its `DESIGN.md` in full before writing any UI.
3. Either follow it directly, or adapt it into a `DESIGN.md` at the project root that mixes the chosen inspirations with the project's own brand (name, colors, language). Never copy logos, brand names or trademarked assets: use the tokens and principles only.
4. Map the tokens onto the project's stack (here: Tailwind CSS 4 theme variables in `app/globals.css` and shadcn/ui components) rather than hard-coding values in components.

## Project rule (pronostic)

`CLAUDE.md` forbids any design work (colors, illustrations, animations, landing page) before the dedicated design phase, which starts from inspirations supplied by the project owner. Use this skill only during that phase or when the owner explicitly asks.
