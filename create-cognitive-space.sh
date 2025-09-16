#!/bin/bash

# create-cognitive-space.sh
# Creates a new cognitive modeling session with optional name
# Usage: ./create-cognitive-space.sh [optional-name]
# Returns: Path to the created session.ts file

set -e

# Generate timestamp in the expected format
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S-3NZ)

# Determine session ID
if [ -n "$1" ]; then
    SESSION_ID="$1-$TIMESTAMP"
else
    SESSION_ID="$TIMESTAMP"
fi

# Create space directory
SPACE_DIR="data/spaces/$SESSION_ID"
mkdir -p "$SPACE_DIR"

# Generate space.ts with proper boilerplate
cat > "$SPACE_DIR/space.ts" << 'EOF'
import { Session } from '../../../src/lib/thought-system';

const space = new Session(
  'SESSION_ID_PLACEHOLDER',
  'Cognitive Space',
  'A space for persistent thought modeling'
);

// Add your thoughts here using the fluent API
// Example:
// space.thought('ConceptName')
//   .means('What this concept represents')
//   .hasValue('property', 0.8)
//   .relatesTo('OtherConcept', 'supports', 0.9);

// Always end with serialization for execution
if (require.main === module) {
  console.log(JSON.stringify(space.serialize(), null, 2));
}
EOF

# Replace placeholder with actual session ID
sed -i '' "s/SESSION_ID_PLACEHOLDER/$SESSION_ID/g" "$SPACE_DIR/space.ts"

# Return the path to the created file
echo "$PWD/$SPACE_DIR/space.ts"