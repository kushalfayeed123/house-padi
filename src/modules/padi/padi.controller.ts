// src/modules/padi/controllers/padi.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { PadiChatDto } from './dto/padi-chat.dto';
import { PadiOrchestrator } from './padi.orchesrator';
import { GetUser } from '../../common/decorators/user.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-auth.guard';

@ApiTags('Padi AI Orchestrator')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard)
@Controller('padi')
export class PadiController {
  constructor(private readonly orchestrator: PadiOrchestrator) {}

  @Post('chat')
  @UseGuards(OptionalJwtAuthGuard) // Added: This makes the @GetUser decorator work
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Universal Padi Entry Point',
    description:
      'Handles property search, listing creation, and lease status via natural language.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successful interaction with Padi.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Valid JWT required.',
  })
  async chat(@GetUser('userId') userId: string, @Body() dto: PadiChatDto) {
    const response = await this.orchestrator.execute(userId, dto.message);

    return {
      success: true,
      reply: response,
      timestamp: new Date().toISOString(),
    };
  }
}
