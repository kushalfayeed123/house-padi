/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios'; // Use this instead of @nestjs/common
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NewsService {
  constructor(
    private readonly httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async getHousingNews() {
    const apiKey = this.configService.get<string>('NEWSAPIKEY')!;
    // We use the "Smart Query" we built earlier
    const query = encodeURIComponent(
      '(Nigeria OR Lagos OR Abuja) AND (housing OR property OR "house prices" OR "rent prices") -sports -politics',
    );
    const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=relevancy&pageSize=4&apiKey=${apiKey}`;

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data.articles;
    } catch (error) {
      console.error('Error fetching news from backend:', error);
      return [];
    }
  }
}
