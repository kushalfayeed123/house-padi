// src/modules/renting/renting.controller.ts
import {
  Controller,
  UseGuards,
  Post,
  Body,
  Patch,
  Param,
  Get,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { InterestDto } from './dto/interest.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { LeaseService } from './services/lease/lease.service';
import { TourService } from './services/tour/tour.service';
import { PaymentCompleteDto } from './dto/payment-complete.dto';
import { GetUser } from '../../common/decorators/user.decorator';
@ApiTags('Renting')
@ApiBearerAuth()
@Controller('renting')
export class RentingController {
  constructor(
    private readonly tourService: TourService,
    private readonly leaseService: LeaseService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('interest')
  async expressInterest(
    @Body() body: InterestDto, // Use DTO
    @GetUser('userId') renterId: string,
  ) {
    return await this.tourService.createApplication(
      body.propertyId ?? '',
      renterId,
      body.tourDate,
    );
  }

  @Patch('application/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusDto,
    @GetUser('userId') ownerId: string,
  ) {
    return this.tourService.updateApplicationStatus(id, body.status, ownerId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('application/:id/generate-lease/:renterId')
  async initiateLease(
    @Param('id') id: string,
    @Param('renterId') renterId: string,
  ) {
    return this.leaseService.prepareLease(id, renterId);
  }

  @Post('webhook/payment-complete')
  @ApiOperation({ summary: 'Finalize rental after successful payment' })
  async finalize(
    @Body() body: PaymentCompleteDto, // Now Swagger will show the fields
  ) {
    return this.leaseService.completeRental(
      body.leaseId,
      body.reference,
      body.userId,
    );
  }

  @Get('my-applications')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all house applications sent by the user' })
  async getMyApplications(@GetUser('userId') renterId: string) {
    return this.tourService.getUserApplications(renterId);
  }

  // Fetch all applications received for a specific property (as an Owner)
  @Get('property/:propertyId/applications')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Landlord: Get all applications for a specific listing',
  })
  getPropertyApplications(
    @Param('propertyId') propertyId: string,
    @GetUser('userId') ownerId: string,
  ) {
    return this.tourService.getPropertyApplications(propertyId, ownerId);
  }

  // Fetch lease agreements for the user (to sign or view)
  @Get('my-leases')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all lease agreements (signed and pending)' })
  async getMyLeases(@GetUser('userId') userId: string) {
    return this.leaseService.getUserLeases(userId);
  }

  // Decline a lease agreement
  @Delete('lease/:id/decline')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Decline/Cancel a lease agreement before payment' })
  async declineLease(
    @Param('id') id: string,
    @GetUser('userId') ownerId: string,
  ) {
    return this.leaseService.declineLease(id, ownerId);
  }

  @Get('received-applications')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Landlord: Get all applications for all properties owned by the current user',
  })
  async getReceivedApplications(@GetUser('userId') ownerId: string) {
    return this.tourService.getOwnerDashboardApplications(ownerId);
  }
}
