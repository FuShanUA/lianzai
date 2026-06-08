---
name: WritingStyle
description: Defines the author's core writing style, constraints, preferences, and tone to ensure generated or edited text sounds human and authentic. Use this skill whenever drafting, translating, or polishing articles, blogs, or other content for this user.
---

# WritingStyle Skill (Workflow)

This skill manages the **workflow** for applying the user's stylistic preferences to content generation and editing tasks.

## Note: Deterministic tasks—like replacing specific sensitive words, fixing English colons, or stripping out AI translationese (e.g., "赋能", "总而言之")—have been moved to the centralized hard-constraint dictionary at `/Users/shanfu/cc/Library/Tools/common/HARD_CONSTRAINTS.md`. The LLM should focus entirely on achieving the desired **vibe, structure, and readability** defined below.

## Step 1: Initialize Knowledge
Before performing any writing or translation task, you MUST load and internalize the following:

1.  **Stylistic Knowledge**: Read [README.md](README.md) in the skill directory. This contains the Role, Audience, and Declarative Style Rules (心法)。
2.  **Hard Constraints**: Read [HARD_CONSTRAINTS.md](file:////Users/shanfu/cc/Library/Tools/common/HARD_CONSTRAINTS.md). This contains mechanical word bans and regex replacement rules (剑法)。

## Step 2: Execution
Perform the task (Drafting, Translating, or Polishing) while ensuring:
- The **Vibe** matches the Role and Audience in `README.md`.
- No **Hard Ban** words from `HARD_CONSTRAINTS.md` are used.
- All **Declarative Rules** (e.g., Negative Parallelism, Slang Filtering) are followed.

## Step 3: Knowledge Evolution
This skill is a living system. Proactively update the knowledge base during the following events:

- **User Correction**: If the user corrects your output or rewrites a sentence, extract the pattern.
    - If it's a **judgment call** or stylistic preference: Add a "Good/Bad" example to `README.md`.
    - If it's a **mechanical word ban**: Add it to the absolute ban list in `HARD_CONSTRAINTS.md`.
- **New Pattern Recognition**: If you find a recurring "AI flavor" in your draft that the user consistently removes (e.g., redundant emphasis), document it in `README.md`.

## Step 4: Standalone Usage (Independent Polishing)
You can use this skill independently to polish any text file (articles, blogs, emails):

```powershell
python style.py input.md --out output.md
```

- **Input**: Any text file.
- **Rules applied**: Automatically combines `README.md` (Style) and `HARD_CONSTRAINTS.md` (Bans).

---
*Last updated: 2026-03-08 (Decoupled Architecture with Standalone CLI)*