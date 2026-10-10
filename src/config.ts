import dotenv from 'dotenv';

  dotenv.config();

  export const PORT = Number(process.env.PORT || 3000);
  export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
  export const NODE_ENV = process.env.NODE_ENV || 'development';
  export const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  export const ZIVOPAL_CORE_URL = process.env.ZIVOPAL_CORE_URL || '';
  export const ZIVOPAL_SERVICE_KEY = process.env.ZIVOPAL_SERVICE_KEY || '';

  export const DATABASE_URL = process.env.DATABASE_URL || '';
  export const ASSESS_DB_SCHEMA = process.env.ASSESS_DB_SCHEMA || 'public';
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(ASSESS_DB_SCHEMA)) {
    throw new Error('ASSESS_DB_SCHEMA must be a lowercase PostgreSQL identifier');
  }

export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  