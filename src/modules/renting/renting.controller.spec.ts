import { Test, TestingModule } from '@nestjs/testing';
import { RentingController } from './renting.controller';

describe('RentingController', () => {
  let controller: RentingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RentingController],
    }).compile();

    controller = module.get<RentingController>(RentingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
