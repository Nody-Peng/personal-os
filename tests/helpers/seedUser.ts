import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
}

/** The test user has a weak password: never create it outside the local database. */
function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? ''
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error('Refusing to seed the test user: DATABASE_URL is not a local database.')
  }
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  assertLocalDatabase()
  const payload = await getPayload({ config })

  // Delete existing test user if any
  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })

  // Create fresh test user
  await payload.create({
    collection: 'users',
    data: testUser,
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  assertLocalDatabase()
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
