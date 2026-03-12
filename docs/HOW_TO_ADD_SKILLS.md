# How to Load Open Source Skills into Claude Code

## What Are Skills for Claude Code?

Claude Code reads a `CLAUDE.md` file in your project root (and subdirectories) 
automatically at the start of every session. This is how you give Claude persistent 
expert-level knowledge about your project, coding standards, and domain.

## Best Open Source Skill Resources

### 1. Awesome Claude Code (GitHub)
https://github.com/anthropics/claude-code

The official repo has community-contributed CLAUDE.md templates for:
- React/Next.js projects
- Supabase projects
- TypeScript strict mode
- Accessibility-first development
- Testing conventions

### 2. Community CLAUDE.md Templates
Search GitHub for:
  - `filename:CLAUDE.md` — browse real projects' Claude configs
  - `awesome-claude-code` — curated lists
  - `claude-code-skills` — specialist knowledge files

### 3. High-Value Skill Areas to Find/Build

**UX/UI Expert Skill**
Teach Claude about:
- Gestalt principles
- Mobile-first patterns  
- Animation timing functions
- Accessible color contrast
- Touch target sizing
Search: "CLAUDE.md design system" or "CLAUDE.md tailwind UI patterns"

**Database Design Expert Skill**
Teach Claude about:
- PostgreSQL indexing strategies
- Supabase RLS patterns
- Query optimization
- Schema normalization
Search: "CLAUDE.md supabase" or "CLAUDE.md postgresql"

**Next.js App Router Expert**
Search: "CLAUDE.md nextjs app router" on GitHub

## How to Install a Skill

### Method 1: Root CLAUDE.md (global for all sessions)
Place in: `/CLAUDE.md` (repo root)
Claude reads this automatically every session.

### Method 2: Subdirectory CLAUDE.md (module-specific)
Place in: `/app/admin/CLAUDE.md`
Claude reads when working in that directory.

### Method 3: @import in CLAUDE.md
```markdown
# CLAUDE.md
@docs/claude/BRAND.md
@docs/claude/DATA_MODEL.md
@docs/claude/MODULES.md
```
Claude follows the @import and reads all referenced files.

## Recommended Root CLAUDE.md for This Project

Your `/CLAUDE.md` should contain:
```markdown
@docs/claude/BRAND.md
@docs/claude/DATA_MODEL.md  
@docs/claude/MODULES.md
@docs/claude/STACK.md
@docs/claude/UX_PATTERNS.md
@docs/claude/SECURITY.md
```

This gives Claude full BAM context on every Claude Code session automatically.

## Building Custom Skills

For BAM, consider building these additional skill files:

### Ballet Domain Knowledge Skill
`/docs/claude/BALLET_DOMAIN.md`
- Level progression terminology
- Age-appropriate class structures  
- Ballet vocabulary (barre, centre, allegro, etc.)
- Performance types and roles
- Competition circuit knowledge

### Email & Marketing Skill
`/docs/claude/MARKETING.md`
- Klaviyo flow structures
- Email subject line patterns that work for dance studio parents
- Lead nurture timing strategies
- SEO content patterns for ballet keywords

### Video/Streaming Skill
`/docs/claude/STREAMING.md`
- Cloudflare Stream API patterns
- Live stream embed code
- Video upload flows
- Recording and playback patterns
