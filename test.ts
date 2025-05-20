import axios from 'axios';
import * as cheerio from 'cheerio';
import 'dotenv/config';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import path from 'path';
import { prisma } from 'prisma/prisma-client';
import { New } from 'src/parser/parser.service';
const httpAgent = new HttpProxyAgent(process.env.PROXY_URL, {
  keepAlive: false,
});
const httpsAgent = new HttpsProxyAgent(process.env.PROXY_URL, {
  keepAlive: false,
});

const axiosInstance = axios.create({
  httpAgent: httpAgent,
  httpsAgent: httpsAgent,
});

const baseUrl = 'https://bolid.ru/about/news/';
const outDir = path.join(path.join(process.cwd(), 'output'), 'data.json');

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

  let allRecords: New[] = [];
  for (let i = 0; i < allHrefsArr.length; i++) {
    const start = Date.now();
    const newPageInfo = await axiosInstance
      .get(`https://bolid.ru/${allHrefsArr[i]}`, { validateStatus: () => true })
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
          imagePreviewName: page.find('.content_news').find('img').attr('alt'),
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
          shortTitle: allRecords[i].shortTitle ? allRecords[i].shortTitle : '',
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
  console.log('успех');
})();

// async function CheckUpdates() {
//   const fileExists = await fs
//     .access(outDir)
//     .then(() => true)
//     .catch(() => false);
//   if (!fileExists) console.log('fetch all news');
//   const localNews = await fs.readFile(outDir, 'utf8');
//   const lastPostLocal: New = JSON.parse(localNews)[0];
//   const lastPostWeb: New = await axiosInstance
//     .get(`https://bolid.ru/about/news/?curPos=0`)
//     .then(async (response) => {
//       const lastPostWebUrl = cheerio
//         .load(response.data)('.cont_inner_right')
//         .find('.news_page')
//         .find('.news_text')
//         .find('a')
//         .first()
//         .attr('href');
//       console.log(lastPostWebUrl);
//       const lastPostWebInfo = await axiosInstance
//         .get(`https://bolid.ru${lastPostWebUrl}`)
//         .then((response) => {
//           const page = cheerio.load(response.data)('.cont_inner_right');
//           const record: New = {
//             slug: lastPostWebUrl.split('/').reverse()[0],
//             date: page.find('.state_date').html(),
//             title: page.find('h1').first().html(),
//             shortTitle: page.find('h1').first().html(),
//             announcement: page.find('h1').first().html(),
//             description: page.find('.content_news').find('h4').first().html(),
//             shortDescription: page
//               .find('.content_news')
//               .find('h4')
//               .first()
//               .html(),
//             newsData: page.find('.content_news').html(),
//             imageUrl: page.find('.content_news').find('img').attr('src'),
//             type: 'NEWS',
//             imagePreviewName: page
//               .find('.content_news')
//               .find('img')
//               .attr('alt'),
//           };
//           return record;
//         });
//       return lastPostWebInfo;
//     });

//   if ((lastPostLocal.slug, lastPostWeb.slug)) {
//     return 'Not updates';
//   } else {
//     JSON.parse(localNews).unshift(lastPostWeb);
//     await fs.writeFile(outDir, localNews, 'utf8');
//     return 'Updated and file rewritten';
//   }
// }
