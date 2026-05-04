#!/bin/bash
# Claude Code configuration installer
# Usage: git clone ... && cd My_mcp-server && ./install.sh

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Claude Config Installer ==="

# Global CLAUDE.md
mkdir -p "$HOME/.claude"
ln -sf "$REPO_DIR/claude/global.md" "$HOME/.claude/CLAUDE.md"
echo "✓ ~/.claude/CLAUDE.md → $REPO_DIR/claude/global.md"

# Project-level CLAUDE.md (있는 프로젝트만)
for project_file in "$REPO_DIR/claude/projects/"*.md; do
    project=$(basename "$project_file" .md)
    target="$HOME/$project/CLAUDE.md"
    if [ -d "$HOME/$project" ]; then
        ln -sf "$project_file" "$target"
        echo "✓ $target → $project_file"
    else
        echo "  skip: ~/$project/ 없음"
    fi
done

echo ""
echo "Done. 수정은 $REPO_DIR/claude/ 에서 하면 자동 반영됩니다."
