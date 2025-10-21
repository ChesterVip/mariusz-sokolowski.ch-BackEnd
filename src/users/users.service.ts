import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existing = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('Użytkownik z takim e-mailem już istnieje.');
    }

    const user = this.usersRepository.create({
      email: normalizedEmail,
      firstName: dto.firstName?.trim(),
      lastName: dto.lastName?.trim(),
      preferredLanguage: dto.preferredLanguage?.trim(),
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new NotFoundException('Użytkownik nie istnieje.');
    }

    return user;
  }
}
