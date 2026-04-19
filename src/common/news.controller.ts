/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Get } from '@nestjs/common';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('housing')
  async getNews() {
    return await this.newsService.getHousingNews();
  }
}
