import defaultMdxComponents from "fumadocs-ui/mdx";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import type { MDXComponents } from "mdx/types";
import { CodeFromFile } from "@/components/CodeFromFile";
import { EugineDemo } from "@/components/EugineDemo";
import { PackageTable } from "@/components/PackageTable";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Available in every page without an import.
    Callout,
    Card,
    Cards,
    CodeFromFile,
    EugineDemo,
    PackageTable,
    ...components,
  };
}

export const useMDXComponents = getMDXComponents;
