import { ConflictException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CreateUserDto } from './dto/create-user.dto'
import { User } from './entities/user.entity'
import { UsersService } from './users.service'

const createDto = (email: string): CreateUserDto => ({
  email,
  firstName: 'Jan',
  lastName: 'Kowalski'
})

describe('UsersService', () => {
  let service: UsersService
  let repository: jest.Mocked<Repository<User>>

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn()
          }
        }
      ]
    }).compile()

    service = moduleRef.get(UsersService)
    repository = moduleRef.get(getRepositoryToken(User))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('creates a user when email is not taken', async () => {
    repository.findOne.mockResolvedValue(null)
    repository.create.mockImplementation((entity) => entity as User)
    repository.save.mockImplementation(async (entity) => ({
      ...entity,
      id: 'user-id'
    }))

    const result = await service.create(createDto('USER@example.com'))

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { email: 'user@example.com' }
    })
    expect(repository.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      firstName: 'Jan',
      lastName: 'Kowalski',
      preferredLanguage: undefined
    })
    expect(result.id).toEqual('user-id')
    expect(result.email).toEqual('user@example.com')
  })

  it('throws when email already exists', async () => {
    repository.findOne.mockResolvedValue({ id: 'existing' } as User)

    await expect(service.create(createDto('duplicate@example.com'))).rejects.toBeInstanceOf(
      ConflictException
    )
    expect(repository.save).not.toHaveBeenCalled()
  })
})
