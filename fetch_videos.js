const fs = require('fs').promises;

const URL = "https://api.video.dmm.co.jp/graphql";
const DELAY_BETWEEN_REQUESTS = 1500; // 1.5秒礼貌延迟，防风控
const MAX_RETRIES = 3; // 网络请求失败最大重试次数
const LIMIT = 120; // 官方单页最大数量

const HEADERS = {
  "accept": "application/graphql-response+json, application/graphql+json, application/json",
  "accept-language": "zh-CN,zh;q=0.9",
  "content-type": "application/json",
  "fanza-device": "BROWSER",
  "origin": "https://video.dmm.co.jp",
  "referer": "https://video.dmm.co.jp/"
};

// 精简版 Query，剔除了不需要的 facet 和其他无关统计实体，极大节省带宽和内存
const OPTIMIZED_QUERY = `query SvodListPage($input: SVODContentSearchInput!) {
  svodContentSearch(input: $input) {
    items {
      contentId
      title
      channel
      floor
      deliveryStartAt
      deliveryEndAt
      packageImage {
        mediumUrl
        largeUrl
      }
      actresses {
        id
        name
      }
      review {
        average
      }
    }
    pageInfo {
      totalCount
    }
  }
}`;

// 延迟函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 带重试机制的 fetch 请求
async function fetchWithRetry(makerId, offset, retries = MAX_RETRIES) {
  const variables = {
    input: {
      channel: { channels: ["DELUXE"] },
      limit: LIMIT,
      offset: offset,
      sort: "DELIVERY_START_DATE_DESC",
      maker: { ids: [makerId] }
    }
  };

  const body = JSON.stringify({
    operationName: "SvodListPage",
    query: OPTIMIZED_QUERY,
    variables: variables
  });

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(URL, {
        method: "POST",
        headers: HEADERS,
        body: body
      });

      if (!response.ok) {
        throw new Error(`HTTP Status: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL Errors: ${JSON.stringify(data.errors)}`);
      }

      return data;
    } catch (error) {
      console.warn(`⚠️ [片商 ${makerId} | Offset ${offset}] 请求失败 (尝试 ${i + 1}/${retries}): ${error.message}`);
      if (i === retries - 1) {
        console.error(`❌ 重试次数耗尽，跳过该页！`);
        return null; // 重试耗尽返回 null，不抛出异常以防中断整个大循环
      }
      // 失败后等待时间递增 (2s, 4s, 6s...)
      await sleep(2000 * (i + 1));
    }
  }
}

async function fetchAllVideos() {
  console.log("🚀 开始启动影片拉取任务...");

  // 1. 读取片商列表
  let makers = [];
  try {
    const makersData = await fs.readFile('makers.json', 'utf-8');
    makers = JSON.parse(makersData);
    console.log(`✅ 成功读取 makers.json，共计 ${makers.length} 个片商。`);
  } catch (err) {
    console.error("❌ 无法读取 makers.json，请先运行上一步的 fetch_makers.js 脚本！");
    return;
  }

  const allVideos = [];
  let totalProcessedMakers = 0;

  // 2. 遍历片商
  for (const maker of makers) {
    const makerId = maker.id;
    const makerName = maker.name;
    let offset = 0;
    let totalCountForMaker = 0;
    let fetchedCountForMaker = 0;

    console.log(`\n🎬 开始拉取片商: [${makerName}] (ID: ${makerId})`);

    // 3. 处理分页
    while (true) {
      const data = await fetchWithRetry(makerId, offset);
      
      // 如果发生网络不可逆错误，直接跳出本片商当前页的获取
      if (!data) break;

      const items = data.data?.svodContentSearch?.items || [];
      const pageInfo = data.data?.svodContentSearch?.pageInfo || {};
      
      totalCountForMaker = pageInfo.totalCount || 0;

      // 如果没有任何数据，说明该片商下没影片，或者翻页到底了
      if (items.length === 0) {
        break;
      }

      // 将本页影片推入总数组
      allVideos.push(...items);
      fetchedCountForMaker += items.length;

      console.log(`  └ 📥 成功拉取 ${items.length} 部影片，进度: ${fetchedCountForMaker}/${totalCountForMaker} (Offset: ${offset})`);

      // 如果已经拉取完当前片商的所有影片，提前结束分页循环
      if (fetchedCountForMaker >= totalCountForMaker) {
        break;
      }

      // 准备下一页
      offset += LIMIT;
      await sleep(DELAY_BETWEEN_REQUESTS);
    }

    totalProcessedMakers++;
    console.log(`✅ 片商 [${makerName}] 拉取完毕，共获取 ${fetchedCountForMaker} 部影片。整体进度: ${totalProcessedMakers}/${makers.length}`);
    
    // 礼貌延迟，切换片商时也休息一下
    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  console.log(`\n🎉 所有片商遍历结束！共计拉取到全量影片数量: ${allVideos.length}`);

  if (allVideos.length > 0) {
    console.log("💾 正在将数据保存至 videos.json，由于数据量较大，可能需要几秒钟...");
    // 43万部影片转JSON可能需要一定的内存，Node.js 默认内存上限支持，但写入时需稍等
    await fs.writeFile('videos.json', JSON.stringify(allVideos, null, 2), 'utf-8');
    console.log("✅ 影片数据已成功保存至 videos.json！");
  }
}

// 启动执行
fetchAllVideos();
