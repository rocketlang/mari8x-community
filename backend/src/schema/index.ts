/**
 * GraphQL Schema - Community Edition
 */

import { builder } from './builder.js';

// Import type definitions
import './types/vessel.js';
import './types/port.js';
import './types/routing.js';
import './types/agent.js';
import './types/bl.js';

// Build and export schema
export const schema = builder.toSchema();
