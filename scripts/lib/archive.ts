/**
 * Turns a Hacker Newsletter archive page (Buttondown) into the text a paste
 * from an email client gives: one line per block, links as markdown
 * `[text](href)`. `parseIssue` reads either.
 */
import { parseHTML } from 'linkedom';

export const archiveUrl = (number: number) =>
  `https://buttondown.com/hacker-newsletter/archive/${number}/`;

const BLOCK = new Set([
  'P',
  'DIV',
  'BR',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'TR',
  'TABLE',
  'HR',
]);
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'TEMPLATE', 'SVG']);

export function archiveHtmlToPaste(html: string): string {
  const { document } = parseHTML(html);
  let out = '';

  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      out += node.textContent;
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (SKIP.has(el.tagName)) return;
    const block = BLOCK.has(el.tagName);
    if (block) out += '\n';
    if (el.tagName === 'A' && el.getAttribute('href')) {
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      out += text ? `[${text}](${el.getAttribute('href')})` : '';
    } else {
      el.childNodes.forEach(walk);
    }
    if (block) out += '\n';
  };
  walk(document.body ?? document.documentElement);

  const lines = out.split('\n').map((line) => line.replace(/\s+/g, ' ').trim());
  // The page breaks before the comments link; an email paste keeps it on the `//domain` line.
  const joined: string[] = [];
  for (const line of lines) {
    const previous = joined.findLastIndex((l) => l !== '');
    if (/^\[comments/i.test(line) && previous >= 0) {
      joined[previous] += ` ${line}`;
      joined.length = previous + 1;
    } else {
      joined.push(line);
    }
  }
  return joined
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n')
    .trim();
}
