import { AppProvider } from "@/components/AppContext";
import { Shell } from "@/components/Shell";

/** The app (dashboard and tools) lives inside the sidebar / tab-bar shell and its data context; the landing page does not. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
