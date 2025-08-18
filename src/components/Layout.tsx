import { PropsWithChildren, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";

export default function Layout({ children }: PropsWithChildren) {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="min-h-screen w-full">
      <header className="h-12 flex items-center border-b px-3 gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-7 w-7"
        >
          <PanelLeft className="h-4 w-4" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      </header>
      <div className="flex min-h-[calc(100vh-3rem)] w-full">
        {sidebarOpen && (
          <div className="w-64 border-r bg-background flex-shrink-0">
            <AppSidebar />
          </div>
        )}
        <main className={`flex-1 p-4 transition-all duration-200 ease-linear ${sidebarOpen ? 'ml-0' : 'mx-auto'} max-w-7xl`}>
          {children}
        </main>
      </div>
    </div>
  );
}
