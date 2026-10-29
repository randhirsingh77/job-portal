/** Rule-based interview prep: a curated topic map per common skill.
 * These are study topics, not questions claimed to come from the company. */
export const TOPIC_MAP: Record<string, string[]> = {
  react: ['Components, props and state', 'Hooks: useState, useEffect, useMemo, useCallback', 'Rendering performance and keys', 'Forms and controlled inputs', 'Routing and data fetching patterns'],
  'react native': ['Navigation (stack/tab)', 'Lists and performance (FlatList)', 'Native modules and platform differences', 'State management basics'],
  typescript: ['Types, interfaces and generics', 'Union types and narrowing', 'Utility types (Partial, Pick, Omit)', 'Typing API responses safely'],
  javascript: ['Closures and scope', 'Promises and async/await', 'Event loop', 'Array/object methods and immutability', '== vs === and type coercion'],
  'node.js': ['Event loop and non-blocking I/O', 'Express middleware and error handling', 'Streams and buffers', 'Process and clustering basics'],
  express: ['Routing and middleware order', 'Validation and error handling', 'Auth middleware (JWT)', 'Rate limiting and security headers'],
  mongodb: ['Documents vs collections', 'Indexing and query patterns', 'Aggregation pipeline basics', 'Schema design trade-offs'],
  postgresql: ['Joins and indexes', 'Transactions and isolation', 'Normalisation', 'EXPLAIN and slow queries'],
  sql: ['Joins (inner/left)', 'GROUP BY and aggregates', 'Subqueries and CTEs', 'Indexing basics'],
  python: ['Lists, dicts and comprehensions', 'Functions and decorators', 'OOP basics', 'Exception handling'],
  java: ['OOP pillars', 'Collections framework', 'Exception handling', 'Interfaces vs abstract classes'],
  aws: ['EC2, S3 and IAM basics', 'Deploying a small service', 'VPC and security groups at a high level'],
  docker: ['Images vs containers', 'Writing a Dockerfile', 'Volumes and networking basics'],
  git: ['Branching and merging', 'Rebase vs merge', 'Resolving conflicts'],
  html: ['Semantic elements', 'Accessibility basics', 'Forms and validation'],
  css: ['Flexbox and Grid', 'Responsive design and media queries', 'Specificity and the cascade'],
  testing: ['Unit vs integration tests', 'Mocking', 'Writing a test for an edge case'],
  redis: ['Caching patterns', 'Expiry and eviction', 'Queues at a high level'],
  flutter: ['Widgets and state', 'Navigation', 'Calling REST APIs'],
  graphql: ['Queries, mutations and schemas', 'N+1 problem at a high level'],
  'machine learning': ['Train/test split and overfitting', 'Classification vs regression', 'Precision, recall and F1'],
};
export function prepChecklist(skills: string[]): { skill: string; topics: string[] }[] {
  const out = skills.map((s) => ({ skill: s, topics: TOPIC_MAP[s.toLowerCase()] ?? ['Core concepts and terminology', 'One small hands-on exercise', 'Explain a project where you used this'] }));
  out.push({ skill: 'General', topics: ['Explain one project end to end: problem, your part, one hard bug', 'Revise the job description and note the top 3 responsibilities', 'Prepare questions to ask the interviewer about the team and the role'] });
  return out;
}
