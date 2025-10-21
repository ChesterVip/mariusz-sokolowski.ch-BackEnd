import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'login_tokens' })
export class LoginToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index()
  code!: string;

  @Column()
  expiresAt!: Date;

  @Column({ nullable: true })
  consumedAt?: Date;

  @Column({ default: false })
  revoked!: boolean;

  @Column()
  userId!: string;

  @ManyToOne(() => User, (user) => user.loginTokens, { onDelete: 'CASCADE' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
