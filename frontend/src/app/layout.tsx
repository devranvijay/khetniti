import type { Metadata, Viewport } from "next";
import { Hind, Inter, Sora } from "next/font/google";
import { AppProvider } from "@/components/AppContext";
import { Shell } from "@/components/Shell";
import "./globals.css";

// SF Pro is used on Apple devices via the system stack; Inter is the fallback elsewhere.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["400", "700"] });
const hind = Hind({ variable: "--font-hind", subsets: ["devanagari", "latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "KHETNITI · खेतनीति",
  description: "Smart Decisions. Better Harvests. Weather, mandi prices and selling economics for Indian farmers.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} ${hind.variable}`}>
      <body>
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
