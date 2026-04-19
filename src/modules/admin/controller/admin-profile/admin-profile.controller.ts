// src/modules/admin/admin-profile.controller.ts
import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AdminProfileService } from '../../service/admin-profile/admin-profile.service';
import { JwtAuthGuard } from '../../../auth/auth.guard';
import { KycStatus } from '../../../profile/enums/kyc-status.enum';

@Controller('api/v1/admin/profiles')
@UseGuards(JwtAuthGuard)
export class AdminProfileController {
  constructor(private readonly adminService: AdminProfileService) {}

  @Get('kyc/pending')
  getPending() {
    return this.adminService.getPendingVerifications();
  }

  @Patch('kyc/:userId/verify')
  async verifyKyc(
    @Param('userId') userId: string,
    @Body() body: { status: KycStatus; reason: string },
  ) {
    return this.adminService.verifyUserKyc(userId, body.status, body.reason);
  }
}
