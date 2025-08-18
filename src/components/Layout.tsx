import { PropsWithChildren } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function Layout({ children }: PropsWithChildren) {
  const { user, signOut } = useAuth();
  return (
    <SidebarProvider defaultOpen={false}>
      <header className="h-12 flex items-center border-b px-3 gap-3">
        <SidebarTrigger />
      </header>
      <div className="flex min-h-[calc(100vh-3rem)] w-full">
        <AppSidebar />
        <main className="flex-1 p-4 transition-all duration-200 ease-linear mx-auto max-w-7xl">{children}</main>
      </div>
    </SidebarProvider>
  );
}
