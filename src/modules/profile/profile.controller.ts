import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profile.service';
import { CompleteKycDto } from './dto/complete-kyc.dto';
import { UpdateBankDetailsDto } from './dto/update-bank-details.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetUser } from '../../common/decorators/user.decorator';

@ApiTags('Profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@GetUser('userId') userId: string) {
    return this.profilesService.findOne(userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(
    @GetUser('userId') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.profilesService.update(userId, updateProfileDto);
  }

  @Put('bank-details')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update owner payout bank details' })
  async updateBank(
    @GetUser('userId') userId: string,
    @Body() dto: UpdateBankDetailsDto,
  ) {
    return this.profilesService.updateBankDetails(userId, dto);
  }

  @Post('kyc')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('idImage'))
  @ApiOperation({ summary: 'Submit ID and image for KYC' })
  @ApiConsumes('multipart/form-data')
  async submitKyc(
    @GetUser('userId') userId: string,
    @Body() dto: CompleteKycDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profilesService.submitKyc(userId, dto, file);
  }
}
