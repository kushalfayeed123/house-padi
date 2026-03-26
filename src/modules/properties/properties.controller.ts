import {
  Controller,
  Get,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { Property } from './entities/property.entity';
import { GetUser } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';

@ApiTags('Properties')
@ApiBearerAuth() // <--- Add this!
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all properties' })
  async findAll(): Promise<Property[]> {
    return this.propertiesService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new property' })
  @ApiResponse({
    status: 201,
    description: 'The property has been successfully created.',
    type: Property,
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @GetUser('userId') userId: string, // Automatically gets the UUID from the JWT
    @Body() createPropertyDto: CreatePropertyDto,
  ): Promise<Property> {
    // No more 'as any'! TypeORM works natively with your DTOs and Entities.
    return await this.propertiesService.create(createPropertyDto, userId);
  }
}
