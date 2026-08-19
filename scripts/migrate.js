const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is missing.");
  process.exit(1);
}

const client = new Client({
  connectionString,
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'backend', 'migrations');

async function runMigrations() {
  try {
    await client.connect();
    console.log('Connected to database');

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.error(`Error: Migrations directory not found at ${MIGRATIONS_DIR}`);
      process.exit(1);
    }

    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
    console.log(`Found ${files.length} migration files`);

    for (const file of files) {
      console.log(`Executing ${file}...`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query(sql);
      console.log(`${file} executed successfully.`);
    }

    console.log('All migrations executed successfully.');
  } catch (err) {
    console.error('Error executing migrations:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
