import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  Settings, 
  HelpCircle, 
  LogOut,
  Package,
  Users
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from "@/components/ui/button";

const Sidebar = ({ className }) => {
  const { logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: PlusCircle, label: 'New Report', path: '/new-report' },
    { icon: FileText, label: 'Reports', path: '/reports' },
    { icon: Package, label: 'Shipments', path: '/shipments' },
    { icon: Users, label: 'Customers', path: '/customers' },
    { icon: Settings, label: 'Profile', path: '/profile' },
    { icon: HelpCircle, label: 'Support', path: '/support' },
  ];

  return (
    <div className={cn("flex flex-col h-full bg-card dark:bg-[#0F172A] border-e border-border text-foreground transition-colors duration-300", className)}>
      {/* Logo Area */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#42C0B9] to-[#114B5F] flex items-center justify-center shadow-lg shadow-teal-500/20">
            <span className="font-heading font-bold text-white text-lg">T</span>
          </div>
          <span className="font-heading font-bold text-xl tracking-tight">Tariff.ai</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} />
              <span className="font-medium">{item.label}</span>
              {isActive && (
                // פס סימון - משתמש ב-ms-auto כדי לעבור לצד השני אוטומטית ב-RTL
                <div className="ms-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Area */}
      <div className="p-4 border-t border-border bg-muted/30">
        <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2 px-2"
            onClick={() => logout()}
        >
          <LogOut className="h-4 w-4 rtl:rotate-180" /> 
          <span>Sign Out</span>
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
