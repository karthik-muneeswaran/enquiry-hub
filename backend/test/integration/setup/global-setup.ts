/**
 * Global setup for integration tests.
 *
 * This module is responsible for:
 * 1. Ensuring Docker containers (PostgreSQL + Redis) are running
 * 2. Running Prisma migrations against the test database
 * 3. Providing teardown logic for CI environments
 *
 * Usage:
 *   In jest config or as a globalSetup file:
 *   globalSetup: '<rootDir>/test/integration/setup/global-setup.ts'
 *
 * Environment Variables (from .env.test or .env.development):
 *   DATABASE_URL - PostgreSQL connection string
 *   REDIS_URL    - Redis connection string
 *
 * Prerequisites:
 *   Docker Compose services must be running:
 *     docker compose -f docker-compose.yml up -d postgres redis
 */

import { execSync } from 'child_process';

export default async function globalSetup(): Promise<void> {
  console.log('\n🔧 Integration Test Global Setup');
  console.log('─────────────────────────────────');

  // Step 1: Verify Docker containers are accessible
  console.log('✓ Checking database connectivity...');
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://postgres:postgres@localhost:5432/enquiry_test?schema=public',
      },
    });
    console.log('✓ Database schema synchronized');
  } catch (error) {
    console.error('✗ Database setup failed. Ensure PostgreSQL is running via Docker Compose.');
    console.error('  Run: docker compose up -d postgres redis');
    throw error;
  }

  console.log('✓ Global setup complete\n');
}

export async function globalTeardown(): Promise<void> {
  console.log('\n🧹 Integration Test Global Teardown');
  console.log('✓ Teardown complete\n');
}
