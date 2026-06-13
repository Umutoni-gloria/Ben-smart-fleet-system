import { HardHat, Home, Camera, RefreshCw } from 'lucide-react'

export const metadata = {
  title: 'BenSupply Field Tech',
  manifest: '/manifest.json',
  themeColor: '#ea580c'
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 min-h-screen pb-20 relative max-w-md mx-auto shadow-2xl overflow-hidden ring-1 ring-slate-200">
      <div className="bg-orange-600 text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center">
        <h1 className="font-bold">BenSupply Field</h1>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <HardHat className="w-4 h-4 text-white" />
        </div>
      </div>
      
      <main className="p-4 h-[calc(100vh-130px)] overflow-y-auto w-full">
        {children}
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-200 flex justify-around p-3 z-50">
         <a href="/mobile" className="flex flex-col items-center text-slate-500 hover:text-orange-600 transition-colors">
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium">Home</span>
         </a>
         <a href="/mobile/scanner" className="flex flex-col items-center text-slate-500 hover:text-orange-600">
            <div className="bg-orange-600 text-white rounded-full w-12 h-12 flex items-center justify-center -mt-6 shadow-lg border-4 border-slate-50 transition-transform active:scale-95">
              <Camera className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-1 font-medium text-orange-600">Scan</span>
         </a>
         <a href="/api/sync" className="flex flex-col items-center text-slate-500 hover:text-orange-600 transition-colors">
            <RefreshCw className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium">Sync</span>
         </a>
      </nav>

      {/* SW Registration */}
      <script dangerouslySetInnerHTML={{ __html: `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', function() {
            navigator.serviceWorker.register('/sw.js').then(function(registration) {
              console.log('SW registered with scope:', registration.scope);
            }, function(err) {
              console.log('SW registration failed:', err);
            });
          });
        }
      `}} />
    </div>
  )
}
