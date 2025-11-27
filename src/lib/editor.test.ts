// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { htmlToPlainText } from './editor';

describe('htmlToPlainText', () => {
  it('should extract simple text', () => {
    expect(htmlToPlainText('<div>Hello</div>')).toBe('Hello\n');
  });

  it('should handle breaks', () => {
    expect(htmlToPlainText('Line 1<br>Line 2')).toBe('Line 1\nLine 2');
  });

  it('should separate paragraphs', () => {
    expect(htmlToPlainText('<p>P1</p><p>P2</p>')).toBe('P1\nP2\n');
  });

  it('should separate table cells with space', () => {
    // Current bug: concatenation "Cell 1Cell 2"
    const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>';
    const text = htmlToPlainText(html);
    // We expect "Cell 1 Cell 2\n" or "Cell 1\tCell 2\n" or similar separation
    expect(text).toContain('Cell 1 Cell 2');
  });

  it('should separate blockquotes', () => {
     const html = '<blockquote>Q1</blockquote><blockquote>Q2</blockquote>';
     expect(htmlToPlainText(html)).toBe('Q1\nQ2\n');
  });
});
