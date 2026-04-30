import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Profile } from '../../profile/entities/profile.entity';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ nullable: true })
  userId?: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 20 })
  role: 'user' | 'assistant' = 'user';

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  user: Profile = new Profile();
}
