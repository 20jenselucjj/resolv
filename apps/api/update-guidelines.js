const { Pool } = require('pg');
const fs = require('fs');

(async () => {
  const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/resolv' });
  const guidelines = JSON.parse(fs.readFileSync('../../updated_guidelines.json', 'utf8'));
  
  const result = await pool.query(
    'UPDATE ai_config SET guidelines = $1, updated_at = NOW()',
    [JSON.stringify(guidelines)]
  );
  
  console.log(`Updated ${result.rowCount} row(s)`);
  console.log('Guidelines updated successfully');
  
  await pool.end();
})();
