// src/modules/renting/renting.controller.ts
import {
  Controller,
  UseGuards,
  Post,
  Body,
  Req,
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

interface RequestWithUser extends Request {
  user: {
    id: string;
    // add other fields if needed, e.g., role: string;
  };
}

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
    @Req() req: RequestWithUser,
  ) {
    return await this.tourService.createApplication(
      body.propertyId,
      req.user.id,
      body.tourDate,
    );
  }

  @Patch('application/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusDto, // Ensure this uses the DTO class
    @Req() req: RequestWithUser,
  ) {
    // Pass body.status (the string), not the whole body (the object)
    return this.tourService.updateApplicationStatus(
      id,
      body.status,
      req.user.id,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard) // Added missing guard
  @Post('application/:id/generate-lease')
  async initiateLease(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.leaseService.prepareLease(id, req.user.id);
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
  async getMyApplications(@Req() req: RequestWithUser) {
    return this.tourService.getUserApplications(req.user.id);
  }

  // Fetch all applications received for a specific property (as an Owner)
  @Get('property/:propertyId/applications')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Landlord: Get all applications for a specific listing',
  })
  getPropertyApplications(
    @Param('propertyId') propertyId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.tourService.getPropertyApplications(propertyId, req.user.id);
  }

  // Fetch lease agreements for the user (to sign or view)
  @Get('my-leases')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all lease agreements (signed and pending)' })
  async getMyLeases(@Req() req: RequestWithUser) {
    return this.leaseService.getUserLeases(req.user.id);
  }

  // Decline a lease agreement
  @Delete('lease/:id/decline')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Decline/Cancel a lease agreement before payment' })
  async declineLease(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.leaseService.declineLease(id, req.user.id);
  }
}
