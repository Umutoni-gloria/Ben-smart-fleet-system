import { ClipboardList, CheckCircle2 } from 'lucide-react'

export default function MobileDashboard() {
  return (
    <div className="space-y-4">
       <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 rounded-2xl text-white shadow-lg border border-slate-800">
          <p className="text-white/60 text-sm">Hello, Technician</p>
          <p className="text-2xl font-bold mt-1">Ready for the field!</p>
       </div>

       <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
             <ClipboardList className="w-8 h-8 text-blue-500 mb-2" />
             <p className="font-bold text-slate-900 text-xl">4</p>
             <p className="text-xs text-slate-400 font-medium">Pending Tasks</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
             <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
             <p className="font-bold text-slate-900 text-xl">12</p>
             <p className="text-xs text-slate-400 font-medium">Completed</p>
          </div>
       </div>

       <h2 className="font-bold text-slate-900 mt-6 mb-3">Today's Schedule</h2>
       <div className="space-y-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-rose-500">
             <div className="flex justify-between items-start">
               <div>
                  <p className="font-bold text-slate-900">Excavator EX-102</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Hydraulic Fluid Change</p>
               </div>
               <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-1 rounded-md">OVERDUE</span>
             </div>
             <a href="/schedules" className="block text-center mt-3 w-full bg-slate-50 text-slate-900 hover:bg-slate-100 font-medium text-sm py-2 rounded-xl transition-colors border border-slate-100">View Details</a>
          </div>
          
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex justify-between items-start">
               <div>
                  <p className="font-bold text-slate-900">Bulldozer BD-05</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Engine Oil Check</p>
               </div>
               <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">UPCOMING</span>
             </div>
             <a href="/schedules" className="block text-center mt-3 w-full bg-slate-50 text-slate-900 hover:bg-slate-100 font-medium text-sm py-2 rounded-xl transition-colors border border-slate-100">Start Job</a>
          </div>
       </div>
    </div>
  )
}
