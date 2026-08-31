import { createRelativeLink } from "fumadocs-ui/mdx";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { DocsReveal } from "@/components/DocsReveal";
import { source } from "@/lib/source";

interface PageParams {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page({ params }: PageParams) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <DocsReveal>
          <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
        </DocsReveal>
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  return { title: page.data.title, description: page.data.description };
}
