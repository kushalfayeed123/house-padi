import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

  async findAll(): Promise<Property[]> {
    return await this.propertyRepository.find();
  }

  async create(createPropertyDto: CreatePropertyDto): Promise<Property> {
    const newProperty = this.propertyRepository.create({
      ...createPropertyDto,
      price: createPropertyDto.price,
    });

    return await this.propertyRepository.save(newProperty);
  }
}
