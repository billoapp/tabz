# 🛠️ Development Tools Organization

This folder contains development and debugging tools that are not part of the production codebase.

## Directory Structure

```
dev-tools/
├── scripts/     # JavaScript test scripts and utilities
├── sql/         # Database migrations and queries  
├── docs/        # Documentation and guides
├── debug/       # HTML test files and debug assets
└── tests/       # Test files (when needed)
```

## File Placement Rules

### ✅ DO place in dev-tools:
- **JavaScript files** → `dev-tools/scripts/`
- **SQL files** → `dev-tools/sql/`
- **Markdown docs** → `dev-tools/docs/`
- **HTML test files** → `dev-tools/debug/`
- **Test assets** → `dev-tools/debug/`

### ❌ DO NOT place in root:
- No `.js` files (except build scripts)
- No `.sql` files
- No `.md` files (except `README.md`)
- No `.html` files

## Examples

```bash
# ✅ Correct
mv test-script.js dev-tools/scripts/
mv migration.sql dev-tools/sql/
mv guide.md dev-tools/docs/

# ❌ Wrong - will be blocked by pre-commit hook
git add test-script.js  # ❌ Blocked
git add migration.sql   # ❌ Blocked
git add guide.md        # ❌ Blocked
```

## Git Hook Protection

A pre-commit hook automatically enforces these rules and will:
- Block commits with files in wrong locations
- Show helpful move commands
- Prevent root directory clutter

## Why This Matters

- **Clean repository** - Only essential files in root
- **Better organization** - Easy to find development tools
- **Git history** - Cleaner, more meaningful commits
- **Team collaboration** - Consistent structure for everyone

## Usage

These tools are for development purposes only and are gitignored to keep the main repository clean.