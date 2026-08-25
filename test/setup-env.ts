process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.API_PREFIX = 'api/v1';
process.env.DATABASE_URL =
  'postgresql://alira:secret@localhost:5432/alira_test';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.SWAGGER_ENABLED = 'false';
