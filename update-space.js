const { Pool } = require('pg');

async function updateSpace() {
  const pool = new Pool({
    host: '127.0.0.1',
    port: 54322,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    const spaceId = '2025-09-18T16-50-48-687Z';

    // First, get the current space
    const currentResult = await pool.query('SELECT * FROM spaces WHERE id = $1', [spaceId]);
    if (currentResult.rows.length === 0) {
      console.error('Space not found');
      return;
    }

    const currentSpace = currentResult.rows[0];
    console.log('Current space:', JSON.stringify(currentSpace.data, null, 2));

    // Create the updated space structure following the guide
    const updatedThoughtSpace = {
      nodes: {
        "Human creativity": {
          id: "Human creativity",
          meanings: [{"content": "Intuitive, emotional, and experientially grounded creative expression", "confidence": 0.9, "timestamp": Date.now()}],
          values: {},
          relationships: [
            {"type": "conflicts-with", "target": "AI efficiency", "strength": 0.7},
            {"type": "supports", "target": "Authentic expression", "strength": 0.9}
          ],
          resolutions: [],
          focus: 1.0,
          semanticPosition: -0.8,
          history: []
        },
        "AI efficiency": {
          id: "AI efficiency",
          meanings: [{"content": "Systematic, scalable, and consistent creative output", "confidence": 0.9, "timestamp": Date.now()}],
          values: {},
          relationships: [
            {"type": "conflicts-with", "target": "Human creativity", "strength": 0.7},
            {"type": "supports", "target": "Productive output", "strength": 0.8}
          ],
          resolutions: [],
          focus: 1.0,
          semanticPosition: 0.8,
          history: []
        },
        "Collaborative synthesis": {
          id: "Collaborative synthesis",
          meanings: [{"content": "Leveraging both human insight and AI capabilities for enhanced creativity", "confidence": 0.8, "timestamp": Date.now()}],
          values: {},
          relationships: [
            {"type": "supports", "target": "Human creativity", "strength": 0.6},
            {"type": "supports", "target": "AI efficiency", "strength": 0.6}
          ],
          resolutions: [],
          focus: 1.0,
          semanticPosition: 0.0,
          history: []
        },
        "Creative authenticity": {
          id: "Creative authenticity",
          meanings: [{"content": "Maintaining genuine artistic voice and intent in AI-assisted work", "confidence": 0.9, "timestamp": Date.now()}],
          values: {"importance": 0.9},
          relationships: [
            {"type": "supports", "target": "Human creativity", "strength": 0.9},
            {"type": "conflicts-with", "target": "AI efficiency", "strength": 0.5}
          ],
          resolutions: [],
          focus: -1.0,
          semanticPosition: -0.5,
          history: []
        },
        "Workflow integration": {
          id: "Workflow integration",
          meanings: [{"content": "Seamlessly incorporating AI tools into creative processes", "confidence": 0.8, "timestamp": Date.now()}],
          values: {"complexity": 0.7},
          relationships: [
            {"type": "supports", "target": "AI efficiency", "strength": 0.8},
            {"type": "supports", "target": "Collaborative synthesis", "strength": 0.7}
          ],
          resolutions: [],
          focus: -1.0,
          semanticPosition: 0.5,
          history: []
        }
      },
      globalHistory: [
        ...currentSpace.data.globalHistory,
        `Populated with AI-Human Creative Collaboration thoughts: ${new Date().toISOString()}`
      ]
    };

    // Update the space
    await pool.query(`
      UPDATE spaces
      SET data = $1, updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(updatedThoughtSpace), spaceId]);

    console.log('Space updated successfully');
    console.log('Updated thought space:', JSON.stringify(updatedThoughtSpace, null, 2));

  } catch (error) {
    console.error('Error updating space:', error);
  } finally {
    await pool.end();
  }
}

updateSpace();