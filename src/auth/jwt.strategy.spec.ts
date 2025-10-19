import { UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Repository } from 'typeorm'
import { User } from '../users/entities/user.entity'
import { JwtStrategy } from './jwt.strategy'
import { JwtPayload } from './interfaces/jwt-payload.interface'

describe('JwtStrategy', () => {
  const payload: JwtPayload = {
    sub: 'user-123',
    email: 'user@example.com'
  }

  const createStrategy = (user: User | null) => {
    const configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue: unknown) => {
        if (key === 'JWT_SECRET') {
          return 'secret'
        }
        return defaultValue
      })
    } as unknown as ConfigService

    const usersRepository = {
      findOne: jest.fn().mockResolvedValue(user)
    } as unknown as Repository<User>

    const strategy = new JwtStrategy(configService, usersRepository)
    return { strategy, usersRepository }
  }

  it('returns user info when user exists', async () => {
    const { strategy } = createStrategy({ id: 'user-123', email: 'user@example.com' } as User)
    await expect(strategy.validate(payload)).resolves.toEqual({
      userId: 'user-123',
      email: 'user@example.com'
    })
  })

  it('throws when user not found', async () => {
    const { strategy } = createStrategy(null)
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
