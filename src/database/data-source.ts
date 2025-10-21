import 'dotenv/config'
import { DataSource } from 'typeorm'
import { join } from 'path'
import { User } from '../users/entities/user.entity'
import { LoginToken } from '../auth/entities/login-token.entity'

const databasePath = process.env.DATABASE_URL ?? './data/app.db'

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: databasePath,
  entities: [User, LoginToken],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true'
})
