import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

console.log('[E2E] DATABASE_URL host:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]);