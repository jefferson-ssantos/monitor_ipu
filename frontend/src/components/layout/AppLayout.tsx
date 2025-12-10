import { useState, createContext, useContext, useMemo, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { UserDropdown } from "./UserDropdown";
import { GlobalSearch } from "../../../GlobalSearch";

interface AppLayoutProps {
  children: React.ReactNode;
}

interface PageHeaderContextType {
  setHeader: (header: React.ReactNode) => void;
}

const PageHeaderContext = createContext<PageHeaderContextType | undefined>(
  undefined,
);

export function usePageHeader(header: React.ReactNode) {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error("usePageHeader must be used within a AppLayout");
  }
  useEffect(() => {
    context.setHeader(header);
    // Limpa o cabeçalho quando o componente é desmontado
    return () => {
      context.setHeader(null);
    };
  }, [header, context.setHeader]);
}

export function AppLayout({ children }: AppLayoutProps) {
  const [headerContent, setHeaderContent] = useState<React.ReactNode>(null);

  const headerContextValue = useMemo(() => ({
    setHeader: setHeaderContent,
  }), []);

  return (
    <SidebarProvider>
      <PageHeaderContext.Provider value={headerContextValue}>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          
          <div className="flex-1 flex flex-col">
            {/* Top Header - Fixed */}
            <header className="sticky top-0 z-50 h-16 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
              <div className="flex items-center justify-between h-full px-6">
                <div className="flex items-center gap-4">{headerContent}</div>
                <div className="flex items-center gap-3">
                  <GlobalSearch />

                  {/* Notifications */}
                  <NotificationsDropdown />

                  {/* User Menu */}
                  <UserDropdown />
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </PageHeaderContext.Provider>
    </SidebarProvider>
  );
}