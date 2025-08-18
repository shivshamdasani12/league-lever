import { Home, UserPlus, Download, LogOut } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const items = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Import from Sleeper", url: "/import/sleeper", icon: Download },
  { title: "Join League", url: "/join", icon: UserPlus },
];

export function AppSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;
  const { signOut } = useAuth();

  return (
    <div className="h-full w-full flex flex-col bg-background border-r">
      <div className="flex-1 p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Main</h3>
            <div className="space-y-1">
              {items.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                      isActive 
                        ? "bg-muted text-primary font-medium" 
                        : "text-foreground hover:bg-muted/50"
                    }`
                  }
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              ))}
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <button
              onClick={() => signOut()}
              className="flex items-center w-full px-3 py-2 text-sm text-foreground hover:bg-muted/50 rounded-md transition-colors"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
