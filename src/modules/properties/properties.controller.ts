/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CreatePropertyDto } from './dto/create-property.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { SearchPropertyDto } from './dto/search-property.dto';
import { PropertiesService } from './services/properties.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { GetUser } from '../../common/decorators/user.decorator';

@ApiTags('Properties')
@ApiBearerAuth()
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 15))
  async create(
    @Body() dto: CreatePropertyDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 10 }), // 10MB limit
          new FileTypeValidator({ fileType: 'image/(jpeg|png|webp)' }),
        ],
      }),
    )
    files: Express.Multer.File[],
    @GetUser('userId') userId: string,
  ) {
    return this.propertiesService.create(dto, userId, files);
  }

  @Get()
  @ApiOperation({ summary: 'Browse properties' })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(@Query('limit') limit?: number) {
    return this.propertiesService.findAll(limit);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Browse featured properties' })
  @ApiQuery({ name: 'limit', required: false })
  async findFeatured(@Query('limit') limit?: number) {
    return this.propertiesService.findFeaured(limit);
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
      if (Array.isArray(query.tags)) {
        tagArray = query.tags;
      } else if (typeof query.tags === 'string') {
        // Handle JSON string like '["serviced", "2 bedroom"]' OR 'serviced, 2 bedroom'
        if (query.tags.startsWith('[') && query.tags.endsWith(']')) {
          try {
            tagArray = JSON.parse(query.tags);
          } catch {
            tagArray = query.tags.split(',');
          }
        } else {
          tagArray = query.tags.split(',');
        }
      }

      // Clean up: trim, lowercase, and remove empties
      tagArray = tagArray
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t !== '');
    }

    return this.propertiesService.findAiRecommended({
      ...query,
      tags: tagArray,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a single property' })
  async findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  // properties.controller.ts

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files')) // Add this to handle multipart updates
  async update(
    @Param('id') id: string,
    @GetUser('userId') ownerId: string,
    @Body() dto: UpdatePropertyDto,
    @UploadedFiles() files: Express.Multer.File[], // Capture new files
  ) {
    // Pass the files to the service logic
    return this.propertiesService.update(id, ownerId, dto, files);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a property listing' })
  async remove(@Param('id') id: string, @GetUser('userId') ownerId: string) {
    return this.propertiesService.remove(id, ownerId);
  }
}
