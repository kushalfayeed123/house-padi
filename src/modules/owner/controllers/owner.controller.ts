// src/modules/owner/controllers/owner.controller.ts
import { Controller, Get, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express'; // Fixes the 'any' type error
import { OwnerService } from '../services/owner.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
  };
}

@ApiTags('Owner')
@ApiBearerAuth()
@Controller('owner')
@UseGuards(JwtAuthGuard)
export class OwnerController {
  constructor(private readonly ownerService: OwnerService) {}

  @Get('dashboard')
  async getDashboard(@Req() req: AuthenticatedRequest) {
    return await this.ownerService.getOwnerDashboard(req.user.id);
  }
}
