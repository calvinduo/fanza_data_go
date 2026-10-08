const fs = require('fs').promises;

async function fetchMakers() {
  const url = "https://api.video.dmm.co.jp/graphql";
  
  // 保持和浏览器请求完全一致的 Headers
  const headers = {
    "accept": "application/graphql-response+json, application/graphql+json, application/json, text/event-stream, multipart/mixed",
    "accept-language": "zh-CN,zh;q=0.9,ja;q=0.8",
    "content-type": "application/json",
    "fanza-device": "BROWSER",
    "origin": "https://video.dmm.co.jp",
    "referer": "https://video.dmm.co.jp/"
  };

  // GraphQL Query 保持原生结构
  const query = `query SvodListPage($input: SVODContentSearchInput!, $floor: PPVFloor!, $hasFloor: Boolean!, $canonicalId: ID!, $hasGenreId: Boolean!, $hasActressId: Boolean!, $hasSeriesId: Boolean!, $hasMakerId: Boolean!, $hasLabelId: Boolean!, $hasHistrionId: Boolean!, $hasDirectorId: Boolean!, $selectedGenreIds: [ID!]!, $isSelectedGenreIds: Boolean!, $selectedActressIds: [ID!]!, $isSelectedActressIds: Boolean!, $selectedSeriesIds: [ID!]!, $isSelectedSeriesIds: Boolean!, $selectedMakerIds: [ID!]!, $isSelectedMakerIds: Boolean!, $selectedLabelIds: [ID!]!, $isSelectedLabelIds: Boolean!, $selectedHistrionIds: [ID!]!, $isSelectedHistrionIds: Boolean!, $selectedDirectorIds: [ID!]!, $isSelectedDirectorIds: Boolean!) {
    svodContentSearch(input: $input) {
      facet {
        makers {
          id
          name
          count
        }
      }
    }
  }`;

  // 这里的核心是修改 variables 里的 input 参数
  const variables = {
    "canonicalId": "",
    "floor": "AV",
    "hasActressId": false,
    "hasDirectorId": false,
    "hasFloor": false,
    "hasGenreId": false,
    "hasHistrionId": false,
    "hasLabelId": false,
    "hasMakerId": false,
    "hasSeriesId": false,
    "input": {
      "channel": { "channels": ["DELUXE"] },
      "deliveryStatus": "ACTIVE",
      "excludeForeignUnavailable": false,
      "limit": 1, // 我们不需要获取具体的影片(items)，设为1节省带宽
      "offset": 0,
      "sort": "DELIVERY_START_DATE_DESC",
      "makerFacet": { "limit": 5000 } // 【核心改动】一次性拉取最多 5000 个片商
    },
    "isSelectedActressIds": false,
    "isSelectedDirectorIds": false,
    "isSelectedGenreIds": false,
    "isSelectedHistrionIds": false,
    "isSelectedLabelIds": false,
    "isSelectedMakerIds": false,
    "isSelectedSeriesIds": false,
    "selectedActressIds": [],
    "selectedDirectorIds": [],
    "selectedGenreIds": [],
    "selectedHistrionIds": [],
    "selectedLabelIds": [],
    "selectedMakerIds": [],
    "selectedSeriesIds": []
  };

  console.log("🚀 开始请求 DMM SVOD 片商数据...");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        operationName: "SvodListPage",
        query: query,
        variables: variables
      })
    });

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errText = await response.text();
      console.error("❌ 原始返回信息:", errText);
      return;
    }

    const data = await response.json();
    
    // 提取片商列表
    const makers = data?.data?.svodContentSearch?.facet?.makers;

    if (!makers || makers.length === 0) {
      console.warn("⚠️ 没有获取到片商数据，可能被拦截或者返回格式变更。");
      console.log("返回体:", JSON.stringify(data, null, 2));
      return;
    }

    console.log(`✅ 成功获取到 ${makers.length} 个片商的信息！`);
    
    // 输出前几个验证一下
    console.log("🔍 前 5 个片商示例:");
    console.table(makers.slice(0, 5));

    // 保存到本地文件，方便下一步读取使用
    await fs.writeFile("makers.json", JSON.stringify(makers, null, 2), "utf-8");
    console.log("💾 数据已成功保存到 makers.json");

  } catch (error) {
    console.error("❌ 请求过程中发生异常:", error.message);
  }
}

fetchMakers();
