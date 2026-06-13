'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'

export default function QRScanner() {
  const [code, setCode] = useState('')
  const router = useRouter()

  const handleManualScan = () => {
    if (code) router.push(`/equipment/${code}`) // Navigate straight to main equipment details
  }

  return (
    <div className="h-full flex flex-col items-center justify-center space-y-6 pt-10">
       <div className="w-64 h-64 border-2 border-orange-600 border-dashed rounded-3xl flex items-center justify-center bg-orange-50/50 animate-pulse relative">
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-600 rounded-tr-3xl" />
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-600 rounded-tl-3xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-600 rounded-br-3xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-600 rounded-bl-3xl" />

          <div className="text-center flex flex-col items-center">
             <Camera className="w-12 h-12 text-orange-600" />
             <p className="text-xs text-orange-600 mt-3 font-medium">Initializing Camera...</p>
          </div>
       </div>
       <p className="text-sm text-slate-500 font-medium">Point at equipment QR code</p>

       <div className="w-full max-w-xs mt-8">
          <div className="relative">
             <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
             <div className="relative flex justify-center">
                <span className="bg-slate-50 px-4 text-xs text-slate-400 uppercase font-semibold">Or enter manually</span>
             </div>
          </div>
          
          <div className="mt-6 flex flex-col gap-3">
            <input 
              value={code} onChange={e => setCode(e.target.value)}
              placeholder="e.g. UUID or Code"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none shadow-sm focus:ring-2 focus:ring-orange-600 text-slate-900"
            />
            <button onClick={handleManualScan} className="w-full bg-orange-600 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-md hover:bg-orange-700 active:scale-95 transition-all cursor-pointer">Submit Code</button>
          </div>
       </div>
    </div>
  )
}
