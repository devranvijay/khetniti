import type { Metadata, Viewport } from "next";
import { Hind, Inter, Sora } from "next/font/google";
import { AppProvider } from "@/components/AppContext";
import { Shell } from "@/components/Shell";
import { Splash } from "@/components/Splash";
import "./globals.css";

// SF Pro is used on Apple devices via the system stack; Inter is the fallback elsewhere.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["400", "700"] });
const hind = Hind({ variable: "--font-hind", subsets: ["devanagari", "latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "KHETNITI · खेतनीति",
  description: "Smart Decisions. Better Harvests. Weather, mandi prices and selling economics for Indian farmers.",
  appleWebApp: { capable: true, title: "KHETNITI", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

/**
 * Runs before first paint:
 *  - applies the saved theme ("light" | "dark"; absent = follow the system)
 *  - hides the splash if it was already shown in this browser session
 */
const BOOT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("khetniti.theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t)}catch(e){}try{if(sessionStorage.getItem("khetniti.splash"))d.setAttribute("data-splash","seen")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} ${hind.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <Splash />
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
