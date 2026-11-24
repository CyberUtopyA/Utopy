import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

for (let index = 1; index <= 27; index++) {
  const number = String(index).padStart(3, '0');
  if (process.argv.includes('--note') && process.argv[process.argv.indexOf('--note') + 1] !== number) continue;
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(new URL(`../official/NT${number}.pdf`, import.meta.url))), useSystemFonts: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map(item => item.str).join(' ').replace(/\s+/g, ' '));
  }
  const text = pages.join(' ');
  console.log(JSON.stringify({ note: number, pages: pdf.numPages, text: process.argv.includes('--full') ? text : text.slice(0, 1400) }));
}
