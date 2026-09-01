import { Blocks } from "lucide-react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Eugine",
    },
    githubUrl: "https://github.com/blackbrv/euginejs",
    // Renders as an icon link in the sidebar footer, alongside the GitHub
    // icon githubUrl above generates automatically — see
    // node_modules/fumadocs-ui/dist/layouts/shared/index.js's
    // resolveLinkItems(), which appends the GitHub icon after whatever is
    // in `links` here, so this one lands to its left.
    links: [
      {
        type: "icon",
        url: "/playground",
        icon: <Blocks />,
        text: "Playground",
        label: "Open the playground",
      },
    ],
  };
}
