import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AppSidebar } from './AppSidebar';
import { TopStatusBar } from './TopStatusBar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Initialize based on stored state or default to true
    const stored = sessionStorage.getItem('sidebarCollapsed');
    return stored ? JSON.parse(stored) : true;
  });
  const mouseXRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseXRef.current = e.clientX;
      
      // Trigger zone: Only expand if mouse is within collapsed sidebar width (0-64px) and sidebar is collapsed
      // Keep expanded zone: If already expanded, keep it open while within full sidebar width (0-256px)
      if (sidebarCollapsed) {
        // Only expand if mouse is very close to the collapsed sidebar (within 64px)
        if (e.clientX <= 64 && e.clientX >= 0) {
          setSidebarCollapsed(false);
          sessionStorage.setItem('sidebarCollapsed', 'false');
        }
      } else {
        // If expanded, collapse only when mouse leaves the full expanded area (256px)
        if (e.clientX > 256) {
          setSidebarCollapsed(true);
          sessionStorage.setItem('sidebarCollapsed', 'true');
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [sidebarCollapsed]);

  const handleMouseEnter = () => {
    setSidebarCollapsed(false);
  };

  const handleMouseLeave = () => {
    // The global mousemove handler will take care of collapsing
  };

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      <TopStatusBar sidebarCollapsed={sidebarCollapsed} />
      
      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'pl-16' : 'pl-64'
        )}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
