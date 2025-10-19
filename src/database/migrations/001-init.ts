import { MigrationInterface, QueryRunner } from 'typeorm'

export class Init001 implements MigrationInterface {
  name = 'Init001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" varchar PRIMARY KEY NOT NULL,
        "email" varchar NOT NULL UNIQUE,
        "firstName" varchar,
        "lastName" varchar,
        "preferredLanguage" varchar,
        "createdAt" datetime DEFAULT (datetime('now')) NOT NULL,
        "updatedAt" datetime DEFAULT (datetime('now')) NOT NULL
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "login_tokens" (
        "id" varchar PRIMARY KEY NOT NULL,
        "code" varchar NOT NULL UNIQUE,
        "expiresAt" datetime NOT NULL,
        "consumedAt" datetime,
        "revoked" boolean NOT NULL DEFAULT 0,
        "userId" varchar NOT NULL,
        "createdAt" datetime DEFAULT (datetime('now')) NOT NULL,
        "updatedAt" datetime DEFAULT (datetime('now')) NOT NULL,
        CONSTRAINT "FK_login_tokens_user" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `)

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_login_tokens_code" ON "login_tokens" ("code")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_login_tokens_userId" ON "login_tokens" ("userId")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_login_tokens_code"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_login_tokens_userId"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "login_tokens"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`)
  }
}
