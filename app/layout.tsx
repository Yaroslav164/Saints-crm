import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { themeInitScript } from "@/lib/theme-storage";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AFF SAINTS CRM",
    template: "%s · AFF SAINTS CRM",
  },
  description:
    "Bundle tracking CRM for an affiliate marketing team: tests, budgets, ROI and history.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before the first paint. suppressHydrationWarning
            covers the class and color-scheme this script writes. System fonts are
            used on purpose, so there is no font to preload. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
