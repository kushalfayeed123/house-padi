/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/properties/properties.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Delete,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CreatePropertyDto } from './dto/create-property.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { SearchPropertyDto } from './dto/search-property.dto';
import { PropertiesService } from './services/properties.service';

@ApiTags('Properties')
@ApiBearerAuth()
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List a new property' })
  async create(
    @Body() dto: CreatePropertyDto,
    @GetUser('userId') ownerId: string,
  ) {
    return this.propertiesService.create(dto, ownerId);
  }

  @Get()
  @ApiOperation({ summary: 'Browse properties' })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(@Query('limit') limit?: number) {
    return this.propertiesService.findAll(limit);
  }

  @Get('my-listings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Owners view their own properties' })
  async getMyListings(@GetUser('userId') ownerId: string) {
    return this.propertiesService.findByOwner(ownerId);
  }

  @Get('search')
  @ApiOperation({ summary: 'AI-Powered Hybrid Search' })
  async search(@Query() query: SearchPropertyDto) {
    let tagArray: string[] = [];

    if (query.tags) {
      // Handle cases where tags might already be an array or a comma-separated string
      tagArray = Array.isArray(query.tags)
        ? query.tags
        : query.tags
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t !== '');
    }

    return this.propertiesService.findAiRecommended({
      ...query,
      tags: tagArray, // Now TypeScript is happy because 'tags' accepts string[]
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a single property' })
  async findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a property listing' })
  async update(
    @Param('id') id: string,
    @GetUser('userId') ownerId: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, ownerId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a property listing' })
  async remove(@Param('id') id: string, @GetUser('userId') ownerId: string) {
    return this.propertiesService.remove(id, ownerId);
  }
}
