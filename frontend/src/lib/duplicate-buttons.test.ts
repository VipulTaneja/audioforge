import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('duplicate buttons detection', () => {
  const PROJECT_PAGE_PATH = path.join(process.cwd(), 'src/app/projects/[id]/page.tsx');

  it('should not have duplicate action buttons in asset list', () => {
    const content = fs.readFileSync(PROJECT_PAGE_PATH, 'utf-8');

    const actionHandlers = [
      'handleTrimAsset',
      'handleSeparateAsset',
      'handleDenoiseAsset',
      'handleConvertAsset',
    ];

    const lines = content.split('\n');

    const findings: string[] = [];

    actionHandlers.forEach((handler) => {
      const occurrences: number[] = [];

      lines.forEach((line, index) => {
        if (line.includes(handler)) {
          occurrences.push(index + 1);
        }
      });

      if (occurrences.length > 2) {
        findings.push(
          `${handler} appears ${occurrences.length} times (at lines: ${occurrences.join(', ')})`
        );
      }
    });

    expect(findings).toEqual([]);
  });

  it('should not have duplicate onClick handlers for same action in asset buttons', () => {
    const content = fs.readFileSync(PROJECT_PAGE_PATH, 'utf-8');

    const buttonPattern = /<button[^>]*onClick=\{[^}]*(handleTrimAsset|handleSeparateAsset|handleDenoiseAsset|handleConvertAsset)[^}]*\}[^>]*>/g;

    const buttonHandlers: { handler: string; count: number }[] = [];

    let match;
    while ((match = buttonPattern.exec(content)) !== null) {
      const handler = match[1];
      const existing = buttonHandlers.find((b) => b.handler === handler);
      if (existing) {
        existing.count++;
      } else {
        buttonHandlers.push({ handler, count: 1 });
      }
    }

    const duplicates = buttonHandlers.filter((b) => b.count > 1);

    expect(duplicates).toEqual([]);
  });
});
