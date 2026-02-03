/**
 * Mari8X Community Edition - Backend Server
 */

import express from 'express';
import { createYoga } from 'graphql-yoga';
import cors from 'cors';
import { schema } from './schema/index.js';

const app = express();
const PORT = process.env.PORT || 4001;

// CORS
app.use(cors());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    edition: 'community',
  });
});

// GraphQL endpoint
const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  landingPage: true,
});

app.use('/graphql', yoga);

// Start server
app.listen(PORT, () => {
  console.log(`🚢 Mari8X Community Edition`);
  console.log(`📡 GraphQL API: http://localhost:${PORT}/graphql`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});
