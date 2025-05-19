import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import 'dotenv/config';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

@Injectable()
export class ParserService {
  private httpAgent = new HttpProxyAgent(process.env.PROXY_URL);
  private httpsAgent = new HttpsProxyAgent(process.env.PROXY_URL);
  private axiosInstance = axios.create({
    httpAgent: this.httpAgent,
    httpsAgent: this.httpsAgent,
  });
  private baseUrl = 'https://bolid.ru/about/news/';

  private async getPagesCount(): Promise<number> {
    const pagesCount: number = await this.axiosInstance
      .get(`${this.baseUrl}?curPos=100000`)
      .then((response) => {
        const page = cheerio.load(response.data);
        const pagesCount = page('.listing_page')
          .find('.listing_page_list')
          .find('a')
          .last()
          .text();
        return Number(pagesCount);
      });
    return pagesCount;
  }

  private async getAllHrefs(pagesCount: number): Promise<string[]> {
    let allHrefsArr: string[] = [];
    for (let i = 1; i < pagesCount; i++) {
      const hrefsInPage = await this.axiosInstance
        .get(`${this.baseUrl}?curPos=${i * 10}`)
        .then((response) => {
          const page = cheerio.load(response.data);
          const hrefsInPage = page('.cont_inner_right')
            .find('.news_page')
            .find('.news_text')
            .find('a')
            .map((index, element) => page(element).attr('href'));
          hrefsInPage.map((index, element) => {
            allHrefsArr.push(element);
          });
        });
      return allHrefsArr;
    }
  }

  private async getNewPageInfo(allHrefs: string[]) {}
  async getAllNews(): New[] {
    const pagesCount = await this.getPagesCount();
    const allHrefs = await this.getAllHrefs(pagesCount);
  }
}

export type New = {
  slug: string;
  date: string;
  title: string;
  shortTitle: string;
  newsData: string;
  announcement: string;
  description: string;
  shortDescription: string;
  pdfFileUrl?: string;
  type: 'NEWS' | 'ARTICLE' | 'ARTICLE_PDF_LINK' | 'ARTICLE_PDF_FILE';
  imageUrl: string;
  imagePreviewName: string;
};
