#!/bin/bash

# install-agent.sh
# Installs the cognitive-modeler agent to the user's global Claude config
# Usage: ./install-agent.sh

set -e

AGENT_SOURCE="./agents/cognitive-modeler.md"
CLAUDE_AGENTS_DIR="$HOME/.claude/agents"
AGENT_DEST="$CLAUDE_AGENTS_DIR/cognitive-modeler.md"

echo "🧠 Installing cognitive-modeler agent..."

# Check if source agent file exists
if [ ! -f "$AGENT_SOURCE" ]; then
    echo "❌ Error: Agent file not found at $AGENT_SOURCE"
    echo "   Make sure you're running this script from the modeler repository root."
    exit 1
fi

# Create Claude agents directory if it doesn't exist
mkdir -p "$CLAUDE_AGENTS_DIR"

# Copy the agent file
cp "$AGENT_SOURCE" "$AGENT_DEST"

echo "✅ Successfully installed cognitive-modeler agent to $AGENT_DEST"
echo ""
echo "📋 The agent is now available in Claude Code. You can use it by:"
echo "   1. Starting a conversation in Claude Code"
echo "   2. Asking it to use the 'cognitive-modeler' agent for thought modeling tasks"
echo ""
echo "🔧 Example usage:"
echo "   'I want to model the relationship between trust and collaboration'"
echo "   'Help me think through this design decision with competing factors'"
echo ""
echo "🎯 The agent will automatically:"
echo "   - Navigate to the modeler repository"
echo "   - Create cognitive spaces with proper structure"
echo "   - Validate TypeScript syntax"
echo "   - Execute and update the dashboard"
echo ""
echo "For more info, see: README.md"