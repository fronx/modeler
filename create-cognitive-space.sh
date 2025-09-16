#!/bin/bash

# create-cognitive-space.sh
# Creates a new cognitive modeling space with optional name
# Usage: ./create-cognitive-space.sh [optional-name]
# Returns: Path to the created space.ts file

set -e

# Generate timestamp in the expected format
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S-3NZ)

# Determine space ID
if [ -n "$1" ]; then
    SPACE_ID="$1-$TIMESTAMP"
else
    SPACE_ID="$TIMESTAMP"
fi

# Create space directory
SPACE_DIR="data/spaces/$SPACE_ID"
mkdir -p "$SPACE_DIR"

# Generate space.ts with proper boilerplate
cat > "$SPACE_DIR/space.ts" << 'EOF'
import { Space } from '../../../src/lib/thought-system';

const space = new Space(
  'SPACE_ID_PLACEHOLDER',
  'Cognitive Space',
  'A space for persistent thought modeling'
);

// Example:
// space.thought('ConceptName')
//   .means('What this concept represents')
//   .hasValue('property', 0.8)
//   .supports('OtherConcept', 'supports', 0.9);
//
// TIP: Run `npx tsc --noEmit space.ts` to check syntax before saving

// Always end with serialization for execution
if (require.main === module) {
  console.log(JSON.stringify(space.serialize(), null, 2));
}
EOF

# Replace placeholder with actual space ID
sed -i '' "s/SPACE_ID_PLACEHOLDER/$SPACE_ID/g" "$SPACE_DIR/space.ts"

# Return the path to the created file
echo "$PWD/$SPACE_DIR/space.ts"