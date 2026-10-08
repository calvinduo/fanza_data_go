const fs = require('fs').promises;

async function fetchAllMakers() {
  const url = "https://api.video.dmm.co.jp/graphql";
  
  // 保持基础 Headers
  const headers = {
    "accept": "application/graphql-response+json, application/graphql+json, application/json, text/event-stream, multipart/mixed",
    "accept-language": "zh-CN,zh;q=0.9,ja;q=0.8",
    "content-type": "application/json",
    "fanza-device": "BROWSER",
    "origin": "https://video.dmm.co.jp",
    "referer": "https://video.dmm.co.jp/"
  };

  // 我们删除了 syllabary 参数，让 API 返回所有的片商，暴露 limit 和 offset 以便分页
  const query = `query SvodMakerPage($channels: [SVODChannelType!]!, $limit: Int!, $offset: Int!) {
    svodMakers(
      channels: $channels
      sort: NAME_ASC
      limit: $limit
      offset: $offset
    ) {
      items {
        id
        name
      }
    }
  }`;

  let allMakers = [];
  let offset = 0;
  const limit = 500; // 官方支持的最大单页片商数量

  console.log("🚀 开始分页获取全量片商列表...");

  // 使用 while(true) 不断翻页，直到拿不到数据为止
  while (true) {
    const variables = {
      "channels": ["DELUXE"],
      "limit": limit,
      "offset": offset
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          operationName: "SvodMakerPage", // 对应网页版的片商列表页面
          query: query,
          variables: variables
        })
      });

      if (!response.ok) {
        console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        break;
      }

      const data = await response.json();
      
      if (data.errors) {
        console.error("❌ GraphQL Error:", JSON.stringify(data.errors, null, 2));
        break;
      }

      const items = data?.data?.svodMakers?.items || [];
      
      // 如果本页没有数据了，说明已经翻到了最后一页，退出循环
      if (items.length === 0) {
        console.log("✅ 所有片商获取完毕，没有更多数据了！");
        break;
      }

      allMakers = allMakers.concat(items);
      console.log(`📥 成功获取 offset: ${offset} ~ ${offset + items.length}，当前已收集: ${allMakers.length} 个片商`);

      // 准备请求下一页
      offset += limit;

      // 礼貌性延迟 1.5 秒，防止短时间内高频请求触发风控封禁
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error) {
      console.error("❌ 请求过程中发生异常:", error.message);
      break;
    }
  }

  console.log(`🎉 抓取结束！最终成功获取到 ${allMakers.length} 个片商的信息！`);
  
  if (allMakers.length > 0) {
    // 保存到本地文件
    await fs.writeFile("makers.json", JSON.stringify(allMakers, null, 2), "utf-8");
    console.log("💾 数据已成功保存到 makers.json");
    console.log("🔍 前 3 个片商示例:", allMakers.slice(0, 3));
  }
}

fetchAllMakers();
