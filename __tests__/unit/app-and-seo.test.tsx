import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import manifest from '@/app/manifest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import ErrorPage from '@/app/error';
import NotFound from '@/app/not-found';
import { JsonLd } from '@/app/json-ld';
import ToolPage from '@/app/page';
import { cn } from '@/lib/utils';
import { generateJsonLd, generateToolMetadata } from '@/lib/seo';
import toolConfig from '@/tool/tool.config';
import { getPublicSiteUrl, templateMetadata } from '@/tool/template-metadata';
import { chmodTool } from '@/tool/tool-definition';
import { defaultState, toNumeric } from '@/tool/chmod-logic';
import { ToolCanvas } from '@/tool/components/tool-canvas';
import { ToolSidebar } from '@/tool/components/tool-sidebar';
import { ToolToolbar } from '@/tool/components/tool-toolbar';
import type { ExporterLoader } from '@itsjust/core';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/tool-client-wrapper', () => ({
  default: () => <div data-testid="tool-client-wrapper">tool-client-wrapper</div>,
}));

describe('app and seo', () => {
  const getOgImageUrl = (
    images: NonNullable<NonNullable<ReturnType<typeof generateToolMetadata>['openGraph']>['images']>
  ): string | undefined => {
    const list = Array.isArray(images) ? images : [images];
    const first = list[0];
    if (!first) return undefined;
    if (typeof first === 'string') return first;
    if (first instanceof URL) return first.toString();
    return String(first.url);
  };

  it('builds metadata and json-ld values', () => {
    const metadata = generateToolMetadata(toolConfig);
    const jsonLd = generateJsonLd(toolConfig);

    expect(metadata.creator).toBe(toolConfig.name);
    expect(metadata.metadataBase?.toString()).toBe('http://localhost:3000/');
    const ogUrl = metadata.openGraph?.images ? getOgImageUrl(metadata.openGraph.images) : undefined;
    expect(ogUrl).toContain('/og.svg');
    expect(jsonLd.url).toBe('http://localhost:3000');
    expect(jsonLd.featureList.length).toBeGreaterThan(0);
  });

  it('returns site manifest, robots and sitemap', () => {
    const man = manifest();
    const rob = robots();
    const sm = sitemap();
    expect(man.name).toBe(toolConfig.name);
    const rules = (rob.rules ?? []) as unknown[];
    expect(rules.length).toBeGreaterThan(0);
    expect(sm.length).toBeGreaterThan(0);
  });

  it('renders error and not-found pages', () => {
    render(<ErrorPage error={new Error('boom')} reset={() => {}} />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    render(<NotFound />);
  });

  it('renders the tool page shell', () => {
    render(<ToolPage />);
    expect(screen.getByTestId('tool-client-wrapper')).toBeInTheDocument();
  });

  it('renders JsonLd component', () => {
    render(<JsonLd config={toolConfig} />);
  });

  it('covers tool definition and helper exports', async () => {
    expect(cn('a', undefined, 'b', false, null, 'c')).toBe('a b c');
    expect(getPublicSiteUrl()).toBe('http://localhost:3000');
    expect(chmodTool.deserialize(null)).toEqual({
      success: false,
      error: 'Invalid data format: expected valid chmod state',
    });
    expect(chmodTool.deserialize('nope')).toEqual({
      success: false,
      error: 'Invalid data format: expected valid chmod state',
    });
    expect(typeof chmodTool.serialize(defaultState())).toBe('string');
    const exporters = (chmodTool as { exporters?: Array<{ loader: ExporterLoader }> }).exporters ?? [];
    expect(exporters).toHaveLength(4);
    const first = exporters[0];
    expect(first).toBeDefined();
    if (!first) throw new Error('missing exporter');
    const png = await (first.loader as ExporterLoader)();
    const resolved = 'default' in png ? png.default : png.exporter;
    expect(resolved.format).toBe('png');
  });

  it('renders tool components', () => {
    const state = defaultState();
    render(
      <>
        <ToolToolbar />
        <ToolSidebar state={state} onChange={() => {}} />
        <ToolCanvas state={state} onChange={() => {}} />
      </>
    );

    expect(screen.getByRole('link', { name: 'Open help page' })).toBeInTheDocument();
    expect(screen.getByTestId('numeric-output').textContent).toBe(toNumeric(state));
    expect(screen.getByRole('application', { name: 'Chmod calculator canvas' })).toBeInTheDocument();
  });
});
