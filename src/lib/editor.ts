export const htmlToPlainText = (html: string): string => {
  if (!html) return '';
  const normalized = html
    .replace(new RegExp('<\\s*br\\s*/?>', 'gi'), '\n')
    .replace(new RegExp('<\\s*/(p|div|li|tr|h1|h2|h3|h4|h5|h6)\\s*>', 'gi'), '\n');
  const container = document.createElement('div');
  container.innerHTML = normalized;
  const text = container.textContent || container.innerText || '';
  return text;
};