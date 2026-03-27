import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Post,
  Put,
  Req,
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
import { GetUser } from 'src/common/decorators/user.decorator';
import { CompleteKycDto } from './dto/complete-kyc.dto';
import { UpdateBankDetailsDto } from './dto/update-bank-details.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

export interface ActiveUser {
  id: string;
  email: string;
  role: string;
}

export interface RequestWithUser extends Request {
  user: ActiveUser;
}

@ApiTags('Profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@GetUser('userId') userId: string) {
    console.log(userId);
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
    @Req() req: RequestWithUser,
    @Body() dto: UpdateBankDetailsDto,
  ) {
    return this.profilesService.updateBankDetails(req.user.id, dto);
  }

  @Post('kyc')
  @UseInterceptors(FileInterceptor('idImage')) // 'idImage' is the key from your Flutter form
  @ApiOperation({ summary: 'Submit ID and image for KYC' })
  @ApiConsumes('multipart/form-data') // <--- Crucial for Swagger
  async submitKyc(
    @Req() req: RequestWithUser,
    @Body() dto: CompleteKycDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = (req.user ?? '').id;
    return this.profilesService.submitKyc(userId, dto, file);
  }
}
