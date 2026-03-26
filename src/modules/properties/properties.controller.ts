import {
  Controller,
  Get,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { Property } from './entities/property.entity';

@ApiTags('Properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all properties' })
  @ApiResponse({
    status: 200,
    description: 'Return all properties from the public schema.',
    type: [Property], // Swagger will now show the actual model structure
  })
  async findAll(): Promise<Property[]> {
    return this.propertiesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new property' })
  @ApiResponse({
    status: 201,
    description: 'The property has been successfully created.',
    type: Property,
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Body() createPropertyDto: CreatePropertyDto,
  ): Promise<Property> {
    // No more 'as any'! TypeORM works natively with your DTOs and Entities.
    return await this.propertiesService.create(createPropertyDto);
  }
}
