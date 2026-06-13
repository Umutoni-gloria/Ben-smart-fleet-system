const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: 'postgresql://postgres.bvdxcirakhykcrttkxag:BenFleet2024@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => {
    console.log('Connected to PG successfully');
    return client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'User'");
  })
  .then(res => {
    console.log('Query result:', res.rows);
  })
  .catch(err => {
    console.error('PG Error:', err.message || err);
  })
  .finally(() => {
    client.end();
  });
