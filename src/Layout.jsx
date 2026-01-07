import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from '@/components/LanguageContext';

const Layout = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <LanguageProvider>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
          
          {/* Desktop Sidebar - Hidden on Mobile */}
          <aside className="hidden md:flex w-64 flex-col z-20">
            <Sidebar className="h-full w-full" />
          </aside>

          {/* Main Content Area */}
          <div className="flex flex-col flex-1 h-full overflow-hidden relative">
            
            {/* Mobile Header - Visible only on Mobile */}
            <header className="md:hidden h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-4 justify-between z-30 sticky top-0">
              <div className="flex items-center gap-2">
                 <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#42C0B9] to-[#114B5F] flex items-center justify-center">
                    <span className="font-heading font-bold text-white text-lg">T</span>
                 </div>
                 <span className="font-heading font-bold text-lg">Tariff.ai</span>
              </div>

              {/* Mobile Sidebar Trigger (Hamburger) */}
              <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle Menu</span>
                  </Button>
                </SheetTrigger>
                {/* התפריט הנשלף - side="start" מבטיח פתיחה מהצד הנכון ב-RTL/LTR */}
                <SheetContent side="left" className="p-0 w-72 border-e border-border">
                  <Sidebar className="h-full border-none" />
                </SheetContent>
              </Sheet>
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background/50 p-4 md:p-8 scroll-smooth">
              <div className="max-w-7xl mx-auto w-full">
                <Outlet />
              </div>
            </main>
          </div>
          
          <Toaster />
        </div>
      </ThemeProvider>
    </LanguageProvider>
  );
};

export default Layout;
