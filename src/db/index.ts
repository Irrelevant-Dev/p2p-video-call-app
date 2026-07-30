import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('DATABASE_URL is not defined in environment variables.');
}

const pool = new Pool({
  connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/p2p_video',
});

export const db = drizzle(pool, { schema });
