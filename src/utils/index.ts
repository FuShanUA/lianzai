export const normalizePaths = (content: string) => {
  if (!content) return '';
  return content
    .replace(/\/project-assets\/Issue_[^/]+\/assets\//g, 'assets/')
    .replace(/\/project-assets\/assets\//g, 'assets/')
    .replace(/assets\/[^"\s]*?cover[^"\s]*?\.(\w+)/gi, 'assets/cover/cover.$1')
    .replace(/assets\/[^"\s]*?infographic[^"\s]*?\.(\w+)/gi, (match, ext) => {
      const infographicMatch = match.match(/infographic_(\d+)/i);
      const index = infographicMatch ? infographicMatch[1] : '1';
      return `assets/infographic_${index}/infographic.${ext}`;
    });
};

export const cleanTitle = (rawTitle: string) => {
  if (!rawTitle) return '';
  let text = rawTitle.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\*{2,}/g, '');
  text = text.replace(/#/g, '');
  text = text.replace(/《[^》]+》[\s\-\:]*/g, '');
  text = text.replace(/^(?:连载|第)\s*[一二三四五六七八九十\d]+\s*(?:期|篇|讲|章)?[\-\:：\s]*/g, '');
  text = text.split(/[-—~|]/)[0].trim();
  return text;
};

export const extractFirstImage = (content: string) => {
  if (!content) return null;
  const match = content.match(/!\[.*?\]\((.*?)\)/);
  return match ? match[1] : null;
};

export const cleanMarkdown = (text: string) => {
  if (!text) return '';
  return text
    .replace(/[#*`~_>\-]/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
};

export const safeJsonParse = (raw: string) => {
  try {
    let jsonStr = raw.trim();
    if (jsonStr.startsWith('```')) {
      const lines = jsonStr.split('\n');
      jsonStr = lines.slice(1, -1).join('\n').trim();
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(raw.substring(start, end + 1)); } catch (e2) {}
    }
    const startObj = raw.indexOf('{');
    const endObj = raw.lastIndexOf('}');
    if (startObj !== -1 && endObj !== -1) {
      try { return JSON.parse(raw.substring(startObj, endObj + 1)); } catch (e2) {}
    }
    throw e;
  }
};