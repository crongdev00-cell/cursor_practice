const fs = require('fs');
const path = require('path');

const PROMPT_DIR = path.join(__dirname, '..', 'prompt');
const DEFAULT_PROMPT_FILE = 'news-analysis.md';

const templateCache = new Map();

function getPromptFilePath(name = DEFAULT_PROMPT_FILE) {
  return path.join(PROMPT_DIR, name);
}

function loadPromptTemplate(name = DEFAULT_PROMPT_FILE) {
  const filePath = getPromptFilePath(name);
  const stat = fs.statSync(filePath);
  const cacheKey = `${name}:${stat.mtimeMs}`;
  const cached = templateCache.get(name);

  if (cached && cached.key === cacheKey) {
    return cached.text;
  }

  const text = fs.readFileSync(filePath, 'utf-8');
  templateCache.set(name, { key: cacheKey, text });
  return text;
}

function formatNewsItems(items, label) {
  if (!items?.length) {
    return `${label}: (검색 결과 없음)`;
  }

  return `${label}:\n${items
    .slice(0, 8)
    .map((item, i) => {
      const title = item.title || '제목 없음';
      const snippet = String(item.snippet || item.description || '').slice(0, 200);
      const source = item.source || item.url || '';
      return `${i + 1}. [${title}] ${snippet} (출처: ${source})`;
    })
    .join('\n')}`;
}

function buildAnalysisPrompt(query, globalNews, domesticNews, templateName = DEFAULT_PROMPT_FILE) {
  const template = loadPromptTemplate(templateName);

  return template
    .replace(/\{\{QUERY\}\}/g, query)
    .replace(/\{\{GLOBAL_NEWS\}\}/g, formatNewsItems(globalNews, '국외 뉴스'))
    .replace(/\{\{DOMESTIC_NEWS\}\}/g, formatNewsItems(domesticNews, '국내 뉴스'));
}

module.exports = {
  buildAnalysisPrompt,
  formatNewsItems,
  loadPromptTemplate,
  DEFAULT_PROMPT_FILE,
};
