import axios from 'axios';
import * as cheerio from 'cheerio';
import 'dotenv/config';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { New } from 'src/parser/parser.service';

const httpAgent = new HttpProxyAgent(process.env.PROXY_URL);
const httpsAgent = new HttpsProxyAgent(process.env.PROXY_URL);

const axiosInstance = axios.create({
  httpAgent: httpAgent,
  httpsAgent: httpsAgent,
});

const baseUrl = 'https://bolid.ru/about/news/';

(async () => {
  const pagesCount: number = await axiosInstance
    .get('https://bolid.ru/about/news/?curPos=100000')
    .then((response) => {
      const page = cheerio.load(response.data);
      const pagesCount = page('.listing_page')
        .find('.listing_page_list')
        .find('a')
        .last()
        .text();
      return Number(pagesCount);
    });

  let allHrefsArr: string[] = [];
  for (let i = 1; i < pagesCount; i++) {
    const hrefsInPage = await axiosInstance
      .get(`${baseUrl}?curPos=${i * 10}`)
      .then((response) => {
        const page = cheerio.load(response.data);
        const hrefsInPage = page('.cont_inner_right')
          .find('.news_page')
          .find('.news_text')
          .find('a')
          .map((index, element) => page(element).attr('href'));
        hrefsInPage.map((index, element) => {
          console.log(`element: ${i}`, element);
          allHrefsArr.push(element);
        });
      });
  }

  for (let i = 0; i < allHrefsArr.length; i++) {
    const newPageInfo = await axiosInstance
      .get(`https://bolid.ru/${allHrefsArr[i]}`)
      .then((response) => {
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
        };
      });
  }
})();
