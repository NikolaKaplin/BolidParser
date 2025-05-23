import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import * as cheerio from 'cheerio';
import 'dotenv/config';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as path from 'path';
import { prisma } from 'prisma/prisma-client';

@Injectable()
export class ParserService {
  private httpAgent = new HttpProxyAgent(process.env.PROXY_URL, {
    keepAlive: false,
  });
  private httpsAgent = new HttpsProxyAgent(process.env.PROXY_URL, {
    keepAlive: false,
  });
  private axiosInstance = axios.create({
    httpAgent: this.httpAgent,
    httpsAgent: this.httpsAgent,
  });
  private baseUrl = 'https://bolid.ru/about/news/';
  private outDir = path.join(path.join(process.cwd(), 'output'), 'data.json');

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
    for (let i = 0; i < pagesCount; i++) {
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
    }
    return allHrefsArr;
  }

  getHelloWorld(): string {
    return 'hello world';
  }

  async getAllNews(): Promise<New[]> {
    const fileExists = await prisma.newsRecords.findMany();
    if (fileExists) return fileExists;

    const pagesCount = await this.getPagesCount();
    const allHrefsArr = await this.getAllHrefs(pagesCount);

    let allRecords: New[] = [];
    for (let i = 0; i < allHrefsArr.length; i++) {
      const start = Date.now();
      const newPageInfo = await this.axiosInstance
        .get(`https://bolid.ru/${allHrefsArr[i]}`, {
          validateStatus: () => true,
        })
        .then((response) => {
          if (response.status === 404) return null;
          const page = cheerio.load(response.data)('.cont_inner_right');
          const records: New = {
            slug: allHrefsArr[i].split('/').reverse()[0],
            date: page.find('.state_date').html(),
            title: page.find('h1').first().html(),
            shortTitle: page.find('h1').first().html(),
            announcement: page.find('h1').first().html(),
            description: page.find('.content_news').find('h4').first().html(),
            shortDescription: page
              .find('.content_news')
              .find('h4')
              .first()
              .html(),
            newsData: page.find('.content_news').html(),
            imageUrl: page.find('.content_news').find('img').attr('src'),
            type: 'NEWS',
            imagePreviewName: page
              .find('.content_news')
              .find('img')
              .attr('alt'),
          };
          console.log(`page ${i} parsed as ${Date.now() - start}ms`);
          return records;
        });
      if (!newPageInfo) continue;
      allRecords.push(newPageInfo);
    }
    await prisma.$transaction(async (prisma) => {
      for (let i = 0; i < allRecords.length; i++) {
        await prisma.newsRecords.create({
          data: {
            slug: allRecords[i].slug ? allRecords[i].slug : '',
            date: allRecords[i].date ? allRecords[i].date : '',
            title: allRecords[i].title ? allRecords[i].title : '',
            shortTitle: allRecords[i].shortTitle
              ? allRecords[i].shortTitle
              : '',
            announcement: allRecords[i].announcement
              ? allRecords[i].announcement
              : '',
            description: allRecords[i].description
              ? allRecords[i].description
              : '',
            shortDescription: allRecords[i].shortDescription
              ? allRecords[i].shortDescription
              : '',
            newsData: allRecords[i].newsData ? allRecords[i].newsData : '',
            imageUrl: allRecords[i].imageUrl ? allRecords[i].imageUrl : '',
            type: 'NEWS',
            imagePreviewName: allRecords[i].imagePreviewName
              ? allRecords[i].imagePreviewName
              : '',
          },
        });
        console.log(`record ${i} writed`);
      }
    });
    return allRecords;
  }

  private async CheckUpdates() {
    const fileExists = await prisma.newsRecords.findMany();
    if (!fileExists) await this.getAllNews();
    const localNews: New[] = await prisma.newsRecords.findMany();
    const lastPostLocal: New = localNews[0];
    const lastPostWeb: New = await this.axiosInstance
      .get(`${this.baseUrl}?curPos=0`)
      .then(async (response) => {
        const lastPostWebUrl = cheerio
          .load(response.data)('.cont_inner_right')
          .find('.news_page')
          .find('.news_text')
          .find('a')
          .first()
          .attr('href');
        const lastPostWebInfo = await this.axiosInstance
          .get(`https://bolid.ru${lastPostWebUrl}`)
          .then((response) => {
            const page = cheerio.load(response.data)('.cont_inner_right');
            const record: New = {
              slug: lastPostWebUrl.split('/').reverse()[0],
              date: page.find('.state_date').html(),
              title: page.find('h1').first().html(),
              shortTitle: page.find('h1').first().html(),
              announcement: page.find('h1').first().html(),
              description: page.find('.content_news').find('h4').first().html(),
              shortDescription: page
                .find('.content_news')
                .find('h4')
                .first()
                .html(),
              newsData: page.find('.content_news').html(),
              imageUrl: page.find('.content_news').find('img').attr('src'),
              type: 'NEWS',
              imagePreviewName: page
                .find('.content_news')
                .find('img')
                .attr('alt'),
            };
            return record;
          });
        return lastPostWebInfo;
      });

    if ((lastPostLocal.slug, lastPostWeb.slug)) {
      return 'Not updates';
    } else {
      await prisma.newsRecords.create({
        data: lastPostWeb,
      });
      return 'Updated and file rewritten';
    }
  }

  @Cron('0 10 * * *')
  async handleCron() {
    console.log(`cron task started at ${Date.now()}`);
    await this.CheckUpdates();
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
