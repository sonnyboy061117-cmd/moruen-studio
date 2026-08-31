// 墨韵工坊 · LLM 调用层(后端)
// 支持 4 家: Anthropic Claude / OpenAI GPT-4 / 百度文心 / DeepSeek
import { config } from './config.js';
import { getKey } from './keys.js';

export async function chat({ provider, messages, temperature = 0.8, maxTokens = 2048, system, model, demo = false, tempKey = null }) {
  if (demo) return mockChat({ messages, system, maxTokens, kind: detectKind(messages) });

  // 如果提供了tempKey，使用它；否则从存储中获取
  const apiKey = tempKey || getKey(provider);
  if (!apiKey) {
    throw new Error(`未配置 ${config.providers.providers[provider]?.name || provider} 的 API Key(可在「模型秘钥」页开启演示模式)`);
  }
  const p = config.providers.providers[provider];
  if (!p) throw new Error('未知供应商: ' + provider);
  const m = model || p.default_model;

  if (p.type === 'anthropic') return callAnthropic(apiKey, m, messages, system, temperature, maxTokens);
  if (p.type === 'openai') return callOpenAICompatible(apiKey, m, p.base_url, messages, system, temperature, maxTokens);
  throw new Error('未实现类型: ' + p.type);
}

// 演示模式: 任务类型 → 仿真输出
function detectKind(messages) {
  const last = messages[messages.length - 1]?.content || '';
  if (/生成\s*\d+\s*条|候选标题/.test(last)) return 'title';
  if (/排版/.test(last)) return 'layout';
  if (/改写|润色|重写/.test(last)) return 'rewrite';
  if (/写一篇|原创/.test(last)) return 'original';
  if (/去模板|增口语|调句式|加温度|降 AI/.test(last)) return 'deai';
  return 'generic';
}

const MOCK_TITLES = {
  理财: ['30岁才明白的三个理财真相,别再被忽悠了','普通人靠这招一年多存2万,真不难','为什么你存不下钱?这3个习惯在偷你的钱','月薪5000也能理财?亲测可行的3个方法','存钱最快的7个狠招,第3个我用了3年'],
  职场: ['35岁被裁后我才明白:这3种能力比经验值钱','同事关系再好,也要守住这3条线','为什么你干活最多却升不上去?真相扎心','下班后坚持这1件事,3年后同事都羡慕你','我见过的高管都有这1个共同点'],
  情感: ['结婚10年我才懂:这3件事比爱不爱更重要','为什么你总遇到渣男?这1个原因很多人不知道','离婚率高的夫妻,大多有这3个共同点','我朋友30岁才结婚,她说这3件事要早想清楚','异地恋如何不分手?我们坚持了5年的方法'],
  育儿: ['家有男孩,3岁前这3件事越早做越好','我女儿从不爱说话到小话痨,只因我做对这1件事','孩子发脾气时,聪明的父母只说这3句话','养娃10年,最让我后悔的3个决定','宝宝挑食?我用了这3招,3个月就见效'],
  健康: ['40岁后,我戒掉了这3种"健康食物"','失眠3年,医生朋友给我的这3个建议真管用','饭后这1个小动作,比散步10分钟更养生','每天坚持这3件事,体检指标全正常','颈椎不舒服?这2个动作每天5分钟就够'],
  科技: ['2024年这3个AI工具,真能帮你省一半时间','从iPhone换到安卓,我最后悔的3件事','家里WiFi慢?90%是这1个设置没改','ChatGPT最强玩法不是聊天,是这3个功能','智能家居这3样,装完就回不去'],
  美食: ['在家做出餐厅味,关键就这1个动作','我研究了30个菜谱,发现最香的红烧肉比例是','早餐这样吃,一个月瘦了5斤','夏天必备这3道凉菜,5分钟上桌','电饭煲这3个隐藏功能,90%的人不知道'],
  旅行: ['国内这3个小城,去了就不想回来','旅行必带这5样东西,亲测省一半麻烦','我用了3年整理的旅行打包清单','坐飞机这3个小技巧,省时省力','穷游云南,这条路线最省钱'],
  历史: ['读了10年历史,发现这3个真相最颠覆','这3个历史人物,课本讲的都不对','明朝那些事,如果这样讲更有趣','清朝最让人意外的是这3件事','如果穿越回古代,这3个职业最吃香'],
  体育: ['坚持跑步3年,身体给我的3个变化','NBA这3个纪录,可能20年内没人能破','普通人健身,这3个动作性价比最高','我减了20斤,只靠这2个习惯','马拉松新手,这3点一定要知道'],
  娱乐: ['这3部老剧,过了10年还是神作','明星翻车后怎么翻红?这3招最有效','我追了5年的综艺,最爱的还是这3个','听歌软件这3个隐藏功能,真香','追剧必备:这3个网站免费又清晰'],
  汽车: ['买二手车必看:这3个地方一眼看出事故车','油价又涨?这3个省油技巧真管用','新手司机,这3个驾驶习惯一定要改','10年车主:这3个保养误区最毁车','开车10年,我最庆幸装了这3样'],
  军事: ['现代战争这3个变化,真让人意外','这3款武器,改变了一场战争','各国军队伙食对比,差距真大','退役军人讲:这3个习惯影响一生','这3个战术思想,至今还在用']
};

const MOCK_ARTICLE = (topic, length) => {
  const t = topic || '理财入门';
  const paragraphs = [
    `说到${t},其实没你想的那么玄乎。我自己也是几年前才慢慢搞明白的,一开始也踩了不少坑。`,
    `举个例子吧。我朋友小张,三年前月入也就5000出头,靠着几个笨办法,现在存款已经快10万了。不是什么高大上的操作,就是一些听起来很土的办法,真用起来其实挺管用。`,
    `第一个,先存后花。每个月发工资当天,先把30%转到一张不绑定支付的卡里,剩下的随便花。别小看这一步,很多人之所以存不下钱,就是顺序反了。`,
    `第二个,记账,但别记太细。只记大额支出,比如超过100块的,小钱不用管。不然记两天你就放弃了。我现在用的是个简单的表格,每天晚上花5分钟过一遍,一周汇总一次。`,
    `第三个,给自己一个具体的数字目标。别只说"我要存钱",得说"我今年要存3万"。有了数字,你才知道每个月该做多少。然后把这个数字拆到每月每周,每天看着它,就有动力了。`,
    `说到底,${t}这件事,说难不难,说简单也不简单。关键是你得真的开始做,而不是光收藏文章、光看别人经验。我自己也是从笨办法开始的,慢慢才找到节奏。`,
    `你要是也卡在某个具体问题上,比如不知道怎么开始、或者坚持不下来,可以留言说说你的情况,我看到都会回。咱们一起把这件事搞明白。`
  ];
  let body = paragraphs.join('\n\n');
  while (body.length < length) body += '\n\n' + paragraphs[Math.floor(Math.random() * paragraphs.length)];
  return body.slice(0, Math.floor(length * 1.1));
};

const MOCK_REWRITE = (text) => {
  const reversed = text.split(/[。！？\n]/).filter(s => s.trim()).reverse().join('。') + '。';
  return `【改写后】\n\n${reversed}\n\n补充一点:这篇文章的核心观点我同意,但有些地方说得不够具体,我自己加了一些细节进去。原文里举的例子太老了,大家可能没感觉,改成了更贴近日常的版本。\n\n坦白说,改写不是简单的换词,是要把作者的逻辑重新捋一遍,用自己的话讲出来。如果你也想练这招,建议先从短文开始,300字以内的最容易上手。`;
};

const MOCK_DEAI = (text) => {
  let out = text
    .replace(/首先/g, '第一').replace(/其次/g, '还有').replace(/再次/g, '另外')
    .replace(/最后/g, '说到底').replace(/综上所述/g, '讲到这里你应该明白了')
    .replace(/总而言之/g, '反正').replace(/不得不说/g, '实话说')
    .replace(/在当今社会/g, '现在这年头')
    .replace(/随着[^,。]{2,15}的不断发展/g, '这几年')
    .replace(/扮演着越来越重要的角色/g, '越来越关键')
    .replace(/赋能/g, '帮上忙').replace(/数字化转型/g, '线上化');
  if (!out.includes('我')) out = '我自己的感受是,' + out;
  if (!out.includes('其实')) out = '其实,' + out;
  return out;
};

const MOCK_LAYOUT = (text) => {
  return text.split(/\n+/).map(p => p.trim()).filter(Boolean)
    .map((p, i) => i === 0 ? `【${p}】` : `📌 ${p}`)
    .join('\n\n');
};

async function mockChat({ messages, system, maxTokens, kind }) {
  await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
  const last = messages[messages.length - 1]?.content || '';
  switch (kind) {
    case 'title': {
      const m = last.match(/生成\s*(\d+)\s*条/);
      const count = m ? Math.min(parseInt(m[1]), 50) : 5;
      const dm = last.match(/领域:([^\n]+)/);
      const domain = dm ? dm[1].trim() : '理财';
      const pool = MOCK_TITLES[domain] || MOCK_TITLES.理财;
      const out = [];
      let guard = 0;
      while (out.length < count && guard++ < count * 3) {
        const t = pool[out.length % pool.length];
        if (!out.includes(t)) out.push(t);
      }
      return out.slice(0, count).map((t, i) => `${i + 1}. ${t}`).join('\n');
    }
    case 'original': {
      const tm = last.match(/以"([^"]+)"/);
      const lm = last.match(/(\d+)\s*字/);
      const topic = tm ? tm[1] : '示例主题';
      const length = lm ? parseInt(lm[1]) : 800;
      return MOCK_ARTICLE(topic, length);
    }
    case 'rewrite':
    case 'deai': {
      const tm = last.match(/原文:\s*"""([\s\S]+?)"""/);
      const text = tm ? tm[1].trim() : '这是一段示例原文,用于演示改写效果。';
      return kind === 'deai' ? MOCK_DEAI(text) : MOCK_REWRITE(text);
    }
    case 'layout':
      return MOCK_LAYOUT(last);
    default:
      return '【演示模式】这是 mock 模式的输出。配置 API Key 后会调用真实大模型。';
  }
}

// 去掉上游错误里包含的 key 尾号(防止暴露)
function sanitizeError(text) {
  return text
    .replace(/\*{2,}[A-Za-z0-9_\-]{2,}/g, '****')
    .replace(/sk-[A-Za-z0-9_\-]{2,}/g, (m) => m.slice(0, 7) + '****' + m.slice(-4))
    .replace(/"key":\s*"[^"]+"/g, '"key":"****"');
}

async function callAnthropic(apiKey, model, messages, system, temperature, maxTokens) {
  const body = { model, max_tokens: maxTokens, temperature, messages };
  if (system) body.system = system;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  let r;
  try {
    r = await fetch(config.providers.providers.claude.base_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Claude 60s 超时未响应');
    throw new Error('Claude 网络错误: ' + e.message);
  }
  clearTimeout(timer);
  if (!r.ok) {
    const raw = (await r.text()).slice(0, 300);
    throw new Error(`Claude ${r.status}: ${sanitizeError(raw)}`);
  }
  const data = await r.json();
  return data.content?.[0]?.text || '';
}

async function callOpenAICompatible(apiKey, model, baseUrl, messages, system, temperature, maxTokens) {
  const fullMsgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
  // 加 60 秒超时,防止 DeepSeek 偶发 hang
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  let r;
  try {
    r = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model, messages: fullMsgs, temperature, max_tokens: maxTokens }),
      signal: ctrl.signal
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('LLM 60s 超时未响应(供应商可能限流或网络问题)');
    throw new Error('LLM 网络错误: ' + e.message);
  }
  clearTimeout(timer);
  if (!r.ok) {
    const raw = (await r.text()).slice(0, 300);
    throw new Error(`LLM ${r.status}: ${sanitizeError(raw)}`);
  }
  const data = await r.json();
  return data.choices?.[0]?.message?.content || '';
}

// 测试连接: 最小成本 ping
export async function testProvider(provider, tempKey = null) {
  try {
    const providerConfig = config.providers.providers[provider];
    if (!providerConfig) {
      throw new Error('未知供应商');
    }

    // 判断是否为图片生成模型
    if (providerConfig.type === 'image') {
      return await testImageProvider(provider, tempKey);
    }

    // 文字模型测试逻辑
    const text = await chat({
      provider,
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 8,
      temperature: 0,
      tempKey  // 传递临时Key
    });
    return { ok: true, msg: `连通正常(回显: ${text.trim().slice(0, 20)})` };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// 测试图片生成模型
async function testImageProvider(provider, tempKey = null) {
  try {
    const providerConfig = config.providers.providers[provider];
    const apiKey = tempKey || getKey(provider);

    if (!apiKey) {
      throw new Error('未配置API Key');
    }

    // 通义万相的测试请求
    const API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify({
        model: 'wanx-v1',
        input: {
          prompt: '一只可爱的猫'
        },
        parameters: {
          style: '<auto>',
          size: '1024*1024',
          n: 1
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    // 检查返回是否包含task_id（异步任务）或直接返回结果
    if (result.output && (result.output.task_id || result.output.results)) {
      return { ok: true, msg: '连通正常，图片生成API可用' };
    } else if (result.request_id) {
      // 有些情况下会返回request_id表示请求已接收
      return { ok: true, msg: '连通正常，图片生成API可用' };
    } else {
      throw new Error('API返回格式异常');
    }
  } catch (e) {
    return { ok: false, msg: `调用失败: ${e.message}` };
  }
}
