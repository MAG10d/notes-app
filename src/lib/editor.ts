export const htmlToPlainText = (html: string): string => {
  if (!html) return '';
  const normalized = html
    .replace(new RegExp('<\\s*br\\s*/?>', 'gi'), '\n')
    .replace(new RegExp('<\\s*/(p|div|li|tr|h1|h2|h3|h4|h5|h6|blockquote|pre|section|article|header|footer|nav|aside|main)\\s*>', 'gi'), '\n')
    .replace(new RegExp('<\\s*/(td|th)\\s*>', 'gi'), ' ');
  const container = document.createElement('div');
  container.innerHTML = normalized;
  const text = container.textContent || container.innerText || '';
  return text;
};