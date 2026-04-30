import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from '../entities/chat-message.entity';

@Injectable()
export class ChatHistoryService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
  ) {}

  async saveMessage(
    userId: string | null,
    role: 'user' | 'assistant',
    content: string,
  ) {
    if (!userId) return;

    // Use insert() to skip the entity "load-and-check" logic of save()
    await this.chatRepo.insert({
      userId,
      role,
      content,
    });
  }

  async getRecentContext(userId: string | null, limit = 6) {
    if (!userId) return [];

    const messages = await this.chatRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    // Reverse to get chronological order: [oldest -> newest]
    return messages.reverse().map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }
}
