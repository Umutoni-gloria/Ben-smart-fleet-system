'use client'

import { useEffect, useRef, useState } from 'react'
import { Printer, FileText, FileSpreadsheet, Wrench, Fuel, Clock, Calendar, BarChart3 } from 'lucide-react'

type Equipment = { id: string; name: string }

type ReportData = {
  period: { from: string; to: string }
  maintenance: {
    totalCost: number
    preventiveCost: number
    correctiveCost: number
    totalLogs: number
    byMonth: Record<string, { preventive: number; corrective: number; total: number }>
    topEquipment: { name: string; cost: number; count: number }[]
    logs: {
      id: string
      type: string
      totalCost: number
      laborCost: number
      partsCost: number
      serviceDate: string
      downtimeHours: number | null
      description: string
      equipmentId: string
      equipment: { name: string; type: string }
      technician: { fullName: string } | null
    }[]
  }
  fuel: {
    totalLiters: number
    totalCost: number
    totalLogs: number
    byMonth: Record<string, { liters: number; cost: number }>
    topEquipment: { name: string; liters: number; cost: number }[]
    logs: {
      id: string
      liters: number
      costPerLiter: number
      totalCost: number
      fuelDate: string
      odometer: number
      projectSite: string | null
      notes: string | null
      equipmentId: string
      equipment: { name: string; type: string }
      loggedBy: { fullName: string } | null
    }[]
  }
  usage: {
    totalHours: number
    totalShifts: number
    topEquipment: { name: string; hours: number; shifts: number }[]
    logs: {
      id: string
      totalHours: number
      startHours: number
      endHours: number
      idleHours: number
      shiftDate: string
      projectSite: string
      equipmentId: string
      equipment: { name: string; type: string }
      operator: { fullName: string } | null
    }[]
  }
  scheduleCompliance: {
    total: number
    completed: number
    overdue: number
    upcoming: number
    dueSoon: number
    urgent: number
    complianceRate: number
  }
}

function BarChart({ data, valueKey, label, color }: {
  data: Record<string, Record<string, number>>
  valueKey: string
  label: string
  color: string
}) {
  const entries = Object.entries(data)
  if (entries.length === 0) return (
    <div className="flex items-center justify-center h-24 text-sm text-gray-400">No data available</div>
  )
  const max = Math.max(...entries.map(([, v]) => v[valueKey] || 0))
  return (
    <div className="space-y-2">
      {entries.map(([month, values]) => {
        const value = values[valueKey] || 0
        const width = max > 0 ? (value / max) * 100 : 0
        return (
          <div key={month} className="flex items-center gap-3">
            <p className="text-xs text-gray-500 w-20 shrink-0">{month}</p>
            <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
              <div className="h-full rounded-full flex items-center px-2 transition-all duration-500"
                style={{ width: `${width}%`, backgroundColor: color, minWidth: value > 0 ? '40px' : '0' }}>
                {value > 0 && (
                  <p className="text-xs text-white font-medium truncate">
                    {value > 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(1)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <p className="text-xs text-gray-400 text-right">{label}</p>
    </div>
  )
}

function ComplianceGauge({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#22c55e' : rate >= 60 ? '#f97316' : '#ef4444'
  const circumference = 2 * Math.PI * 40
  const stroke = (rate / 100) * circumference
  return (
    <div className="relative">
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="14" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={`${stroke} ${circumference}`} strokeLinecap="round"
          transform="rotate(-90 50 50)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-bold" style={{ color }}>{rate}%</p>
        <p className="text-xs text-gray-400">compliance</p>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [exporting, setExporting] = useState(false)
  const [activeSection, setActiveSection] = useState('all')
  const reportRef = useRef<HTMLDivElement>(null)

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]
  const defaultTo = now.toISOString().split('T')[0]

  const [filters, setFilters] = useState({
    from: defaultFrom,
    to: defaultTo,
    equipmentId: '',
    reportType: 'all',
  })

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.success) setCurrentUser(d.user)
    })
    fetch('/api/equipment').then(r => r.json()).then(d => {
      if (d.success) setEquipment(d.data)
    })
    fetchReport()
  }, [])

  async function fetchReport() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.append('from', filters.from)
      params.append('to', filters.to)
      if (filters.equipmentId) params.append('equipment', filters.equipmentId)
      const res = await fetch(`/api/reports?${params.toString()}`)
      const json = await res.json()
      if (json.success) setData(json.data)
      else setError(json.error || 'Failed to load report')
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function exportPDF() {
    if (!data) return
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const PAGE_W = 210
      const MARGIN = 14
      const CONTENT_W = PAGE_W - MARGIN * 2

      // ── Load real logo as base64 ──────────────────────────────────
      let logoDataUrl: string | null = null
      try {
        const resp = await fetch('/logo.png')
        const blob = await resp.blob()
        logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch { /* logo optional */ }

      // ── Helper: draw page header ──────────────────────────────────
      const drawHeader = () => {
        // Dark navy blue background bar for header
        doc.setFillColor(22, 30, 49)
        doc.rect(MARGIN, 8, CONTENT_W, 18, 'F')

        if (logoDataUrl) {
          doc.addImage(logoDataUrl, 'PNG', MARGIN + 4, 9, 16, 16)
        }

        // Title and branding
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('BEN SUPPLY LTD', MARGIN + 24, 15)

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(200, 200, 200)
        doc.text('Kigali, Rwanda | Equipment Maintenance Department', MARGIN + 24, 21)

        // Generated date and time on right
        doc.setTextColor(200, 200, 200)
        doc.setFontSize(7.5)
        doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, PAGE_W - MARGIN - 4, 15, { align: 'right' })
        doc.text(new Date().toLocaleTimeString('en-GB'), PAGE_W - MARGIN - 4, 20, { align: 'right' })
      }

      // Draw header on Page 1
      drawHeader()
      let y = 32

      // Title
      doc.setTextColor(15, 23, 42)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      const reportTitle =
        activeSection === 'all' ? 'Fleet Management Report'
        : activeSection === 'maintenance' ? 'Maintenance Operations Report'
        : activeSection === 'fuel' ? 'Fuel Consumption Report'
        : activeSection === 'usage' ? 'Equipment Utilization Report'
        : 'Service Schedule Compliance Report'
      doc.text(reportTitle.toUpperCase() + ' — COMPLETED RECORDS', PAGE_W / 2, y, { align: 'center' })
      y += 5

      y += 8

      // Table theme (Teal header background, compact padding)
      const tableTheme = {
        headStyles: {
          fillColor: [6, 182, 212] as [number, number, number], // beautiful teal
          textColor: [255, 255, 255] as [number, number, number],
          fontStyle: 'bold' as const,
          fontSize: 8.5,
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
          textColor: [30, 30, 30] as [number, number, number],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] as [number, number, number],
        },
        styles: {
          lineColor: [226, 232, 240] as [number, number, number],
          lineWidth: 0.2,
          overflow: 'linebreak' as const,
        },
        tableLineColor: [203, 213, 225] as [number, number, number],
        tableLineWidth: 0.3,
        margin: { left: MARGIN, right: MARGIN },
      }

      // Helper function for adding pages safely
      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > 275) {
          doc.addPage()
          drawHeader()
          y = 32
        }
      }

      // Draw Maintenance Logs Table
      if (activeSection === 'all' || activeSection === 'maintenance') {
        checkPageBreak(30)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text('MAINTENANCE COMPLETED ORDERS LOG', MARGIN, y)
        y += 4

        autoTable(doc, {
          startY: y,
          head: [['#', 'Completion Date', 'Task / Order Title', 'Equipment Target', 'Assigned Tech', 'Time (H)']],
          body: data.maintenance.logs.map((log, idx) => [
            (idx + 1).toString(),
            new Date(log.serviceDate).toLocaleDateString('en-GB'),
            log.description,
            log.equipment.name,
            log.technician?.fullName || 'N/A',
            log.downtimeHours != null ? log.downtimeHours.toFixed(1) : '0.0'
          ]),
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 24, halign: 'center' },
            2: { cellWidth: 65 },
            3: { cellWidth: 43 },
            4: { cellWidth: 28 },
            5: { cellWidth: 12, halign: 'center' }
          },
          ...tableTheme
        })
        y = (doc as any).lastAutoTable.finalY + 10
      }

      // Draw Fuel Logs Table
      if (activeSection === 'all' || activeSection === 'fuel') {
        checkPageBreak(30)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text('FUEL TRANSACTION LOGS', MARGIN, y)
        y += 4

        autoTable(doc, {
          startY: y,
          head: [['#', 'Date', 'Equipment', 'Operator', 'Liters', 'Cost (RWF)', 'Odometer (km)']],
          body: data.fuel.logs.map((log, idx) => [
            (idx + 1).toString(),
            new Date(log.fuelDate).toLocaleDateString('en-GB'),
            log.equipment.name,
            log.loggedBy?.fullName || 'N/A',
            `${log.liters.toLocaleString()} L`,
            log.totalCost.toLocaleString(),
            log.odometer.toLocaleString()
          ]),
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 22, halign: 'center' },
            2: { cellWidth: 40 },
            3: { cellWidth: 35 },
            4: { cellWidth: 20, halign: 'center' },
            5: { cellWidth: 30, halign: 'right' },
            6: { cellWidth: 25, halign: 'right' }
          },
          ...tableTheme
        })
        y = (doc as any).lastAutoTable.finalY + 10
      }

      // Draw Usage Logs Table
      if (activeSection === 'all' || activeSection === 'usage') {
        checkPageBreak(30)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text('EQUIPMENT SHIFT UTILIZATION LOGS', MARGIN, y)
        y += 4

        autoTable(doc, {
          startY: y,
          head: [['#', 'Date', 'Equipment', 'Operator', 'Start Hours', 'End Hours', 'Total Hours']],
          body: data.usage.logs.map((log, idx) => [
            (idx + 1).toString(),
            new Date(log.shiftDate).toLocaleDateString('en-GB'),
            log.equipment.name,
            log.operator?.fullName || 'N/A',
            log.startHours.toFixed(1),
            log.endHours.toFixed(1),
            log.totalHours.toFixed(1)
          ]),
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 22, halign: 'center' },
            2: { cellWidth: 45 },
            3: { cellWidth: 35 },
            4: { cellWidth: 23, halign: 'right' },
            5: { cellWidth: 23, halign: 'right' },
            6: { cellWidth: 24, halign: 'right' }
          },
          ...tableTheme
        })
        y = (doc as any).lastAutoTable.finalY + 10
      }

      // Draw Compliance Overview Table
      if (activeSection === 'all' || activeSection === 'compliance') {
        checkPageBreak(30)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text('SERVICE SCHEDULE COMPLIANCE OVERVIEW', MARGIN, y)
        y += 4

        autoTable(doc, {
          startY: y,
          head: [['Status', 'Count', 'Share (%)']],
          body: [
            ['Completed', data.scheduleCompliance.completed,
              data.scheduleCompliance.total > 0
                ? `${Math.round((data.scheduleCompliance.completed / data.scheduleCompliance.total) * 100)}%` : '0%'],
            ['Upcoming', data.scheduleCompliance.upcoming,
              data.scheduleCompliance.total > 0
                ? `${Math.round((data.scheduleCompliance.upcoming / data.scheduleCompliance.total) * 100)}%` : '0%'],
            ['Due Soon', data.scheduleCompliance.dueSoon,
              data.scheduleCompliance.total > 0
                ? `${Math.round((data.scheduleCompliance.dueSoon / data.scheduleCompliance.total) * 100)}%` : '0%'],
            ['Urgent', data.scheduleCompliance.urgent,
              data.scheduleCompliance.total > 0
                ? `${Math.round((data.scheduleCompliance.urgent / data.scheduleCompliance.total) * 100)}%` : '0%'],
            ['Overdue', data.scheduleCompliance.overdue,
              data.scheduleCompliance.total > 0
                ? `${Math.round((data.scheduleCompliance.overdue / data.scheduleCompliance.total) * 100)}%` : '0%'],
            ['Overall Compliance Rate', '—', `${data.scheduleCompliance.complianceRate}%`],
          ],
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 40, halign: 'center', fontStyle: 'bold' },
          },
          ...tableTheme
        })
        y = (doc as any).lastAutoTable.finalY + 10
      }

      // Draw Signature block
      checkPageBreak(30)
      y += 4
      doc.setFontSize(9)
      doc.setTextColor(30, 41, 59)
      doc.setFont('helvetica', 'bold')
      doc.text('Approved By:', MARGIN, y)
      doc.setFont('helvetica', 'normal')
      
      const approverName = currentUser?.fullName || 'System Administrator'
      const approverRole = currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Admin'
      doc.text(`${approverName} (${approverRole})`, MARGIN, y + 5)

      doc.setDrawColor(203, 213, 225)
      doc.setLineWidth(0.2)
      doc.line(MARGIN, y + 15, MARGIN + 60, y + 15) // Signature line
      doc.line(PAGE_W - MARGIN - 60, y + 15, PAGE_W - MARGIN, y + 15) // Date line

      doc.setFontSize(7.5)
      doc.setTextColor(148, 163, 184)
      doc.text('Signature', MARGIN, y + 19)
      doc.text('Date', PAGE_W - MARGIN - 60, y + 19)

      // Add standard footer to all pages
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.3)
        doc.line(MARGIN, 285, PAGE_W - MARGIN, 285)
        
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(148, 163, 184)
        doc.text(
          `Ben Supply Ltd  |  Fleet Management System  |  Generated ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`,
          MARGIN, 290
        )
        doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, 290, { align: 'right' })
      }

      doc.save(`BenSupply_FleetReport_${filters.from}_to_${filters.to}.pdf`)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('Failed to export PDF')
    } finally {
      setExporting(false)
    }
  }

  async function exportExcel() {
    if (!data) return
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // Summary sheet
      const summaryData = [
        ['Ben Supply Ltd — Fleet Report'],
        [`Period: ${new Date(filters.from).toLocaleDateString()} to ${new Date(filters.to).toLocaleDateString()}`],
        [],
        ['EXECUTIVE SUMMARY'],
        ['Metric', 'Value'],
        ['Total Maintenance Cost', `RWF ${data.maintenance.totalCost.toLocaleString()}`],
        ['Preventive Cost', `RWF ${data.maintenance.preventiveCost.toLocaleString()}`],
        ['Corrective Cost', `RWF ${data.maintenance.correctiveCost.toLocaleString()}`],
        ['Total Fuel Cost', `RWF ${data.fuel.totalCost.toLocaleString()}`],
        ['Total Fuel Liters', `${data.fuel.totalLiters.toLocaleString()} L`],
        ['Total Usage Hours', `${data.usage.totalHours.toLocaleString()} hrs`],
        ['Schedule Compliance', `${data.scheduleCompliance.complianceRate}%`],
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

      // Detailed Maintenance Logs Sheet
      if (data.maintenance.logs.length > 0) {
        const maintData = [
          ['#', 'Date', 'Type', 'Equipment', 'Technician', 'Description', 'Downtime (H)', 'Total Cost (RWF)'],
          ...data.maintenance.logs.map((log, idx) => [
            idx + 1,
            new Date(log.serviceDate).toLocaleDateString('en-GB'),
            log.type,
            log.equipment.name,
            log.technician?.fullName || 'N/A',
            log.description,
            log.downtimeHours || 0,
            log.totalCost
          ])
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(maintData), 'Maintenance Logs')
      }

      // Detailed Fuel Logs Sheet
      if (data.fuel.logs.length > 0) {
        const fuelData = [
          ['#', 'Date', 'Equipment', 'Operator', 'Liters', 'Cost/Liter (RWF)', 'Total Cost (RWF)', 'Odometer (km)'],
          ...data.fuel.logs.map((log, idx) => [
            idx + 1,
            new Date(log.fuelDate).toLocaleDateString('en-GB'),
            log.equipment.name,
            log.loggedBy?.fullName || 'N/A',
            log.liters,
            log.costPerLiter,
            log.totalCost,
            log.odometer
          ])
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fuelData), 'Fuel Logs')
      }

      // Detailed Usage Logs Sheet
      if (data.usage.logs.length > 0) {
        const usageData = [
          ['#', 'Date', 'Equipment', 'Operator', 'Start Hours', 'End Hours', 'Total Hours', 'Project Site'],
          ...data.usage.logs.map((log, idx) => [
            idx + 1,
            new Date(log.shiftDate).toLocaleDateString('en-GB'),
            log.equipment.name,
            log.operator?.fullName || 'N/A',
            log.startHours,
            log.endHours,
            log.totalHours,
            log.projectSite
          ])
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(usageData), 'Usage Logs')
      }

      // Schedule compliance
      const complianceData = [
        ['Status', 'Count'],
        ['Completed', data.scheduleCompliance.completed],
        ['Upcoming', data.scheduleCompliance.upcoming],
        ['Due Soon', data.scheduleCompliance.dueSoon],
        ['Urgent', data.scheduleCompliance.urgent],
        ['Overdue', data.scheduleCompliance.overdue],
        ['Compliance Rate', `${data.scheduleCompliance.complianceRate}%`],
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(complianceData), 'Schedule Compliance')

      XLSX.writeFile(wb, `BenSupply_FleetReport_${filters.from}_to_${filters.to}.xlsx`)
    } catch (err) {
      console.error('Excel export error:', err)
      alert('Failed to export Excel')
    } finally {
      setExporting(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  const sections = [
    { id: 'all', label: 'Full Report' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'fuel', label: 'Fuel' },
    { id: 'usage', label: 'Usage' },
    { id: 'compliance', label: 'Compliance' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">
              Fleet performance overview for Ben Supply Ltd
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportPDF} disabled={!data || exporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium bg-red-500 hover:bg-red-600 disabled:opacity-50 cursor-pointer transition-colors shadow-sm">
              <FileText size={16} />
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button onClick={exportExcel} disabled={!data || exporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 cursor-pointer transition-colors shadow-sm">
              <FileSpreadsheet size={16} />
              Export Excel
            </button>
            <button onClick={handlePrint} disabled={!data}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-gray-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 cursor-pointer">
              <Printer size={16} />
              Print
            </button>
          </div>
        </div>

        {/* Print Header — only shows when printing */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold">Ben Supply Ltd — Fleet Report</h1>
          <p className="text-sm text-gray-500">Smart Fleet & Equipment Maintenance Management System</p>
          <p className="text-sm text-gray-500">
            Period: {new Date(filters.from).toLocaleDateString()} — {new Date(filters.to).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Generated on {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5 print:hidden">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Filters</p>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From Date</label>
              <input type="date" value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To Date</label>
              <input type="date" value={filters.to} max={defaultTo}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Equipment</label>
              <select value={filters.equipmentId}
                onChange={e => setFilters(f => ({ ...f, equipmentId: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 bg-white">
                <option value="">All Equipment</option>
                {equipment.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Report Type</label>
              <select value={filters.reportType}
                onChange={e => setFilters(f => ({ ...f, reportType: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 bg-white">
                <option value="all">All Sections</option>
                <option value="maintenance">Maintenance Only</option>
                <option value="fuel">Fuel Only</option>
                <option value="usage">Usage Only</option>
                <option value="compliance">Compliance Only</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={fetchReport}
                className="px-5 py-2 rounded-xl text-white text-sm font-medium bg-orange-500 hover:bg-orange-600 transition-colors shadow-sm cursor-pointer">
                Apply Filters
              </button>
            </div>
            <div className="flex items-end">
              <button onClick={() => {
                setFilters({ from: defaultFrom, to: defaultTo, equipmentId: '', reportType: 'all' })
              }}
                className="px-5 py-2 rounded-xl border border-slate-200 text-sm font-medium text-gray-600 hover:bg-slate-50 transition-colors cursor-pointer bg-white">
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2 mb-5 print:hidden overflow-x-auto">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeSection === s.id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-slate-50 border border-slate-200'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-24 text-center">
            <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-pulse" />
            <p className="text-sm text-gray-400">Generating report...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-sm px-6 py-16 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={fetchReport} className="mt-3 text-sm text-orange-500 cursor-pointer">Try again</button>
          </div>
        ) : data ? (
          <div ref={reportRef} className="space-y-6 bg-white p-8 rounded-2xl shadow-md border border-gray-100 max-w-5xl mx-auto">
            
            {/* Visual Guide Header Band (matching screenshots style) */}
            <div className="bg-[#16213e] rounded-xl p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain bg-white rounded-lg p-1" onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }} />
                <div>
                  <h2 className="text-lg font-bold tracking-wide">BEN SUPPLY LTD</h2>
                  <p className="text-xs text-gray-300">Kigali, Rwanda | Equipment Maintenance Department</p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-300">
                <p>Generated: {new Date().toLocaleDateString('en-GB')}</p>
                <p className="mt-1">{new Date().toLocaleTimeString('en-GB')}</p>
              </div>
            </div>

            {/* Centered Report Title */}
            <div className="text-center py-2">
              <h1 className="text-xl font-extrabold text-gray-800 tracking-tight">
                {activeSection === 'all' ? 'FLEET MANAGEMENT REPORT'
                  : activeSection === 'maintenance' ? 'MAINTENANCE OPERATIONS REPORT'
                  : activeSection === 'fuel' ? 'FUEL CONSUMPTION REPORT'
                  : activeSection === 'usage' ? 'EQUIPMENT UTILIZATION REPORT'
                  : 'SERVICE SCHEDULE COMPLIANCE REPORT'}
                {' — COMPLETED RECORDS'}
              </h1>
            </div>

            {/* Maintenance Completed Log */}
            {(activeSection === 'all' || activeSection === 'maintenance') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Wrench size={16} className="text-slate-500" />
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Maintenance Completed Orders Log</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-[#06B6D4] text-white uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2 px-3 text-center border border-slate-200">#</th>
                        <th className="py-2 px-3 border border-slate-200">Completion Date</th>
                        <th className="py-2 px-3 border border-slate-200">Task / Order Title</th>
                        <th className="py-2 px-3 border border-slate-200">Equipment Target</th>
                        <th className="py-2 px-3 border border-slate-200">Assigned Tech</th>
                        <th className="py-2 px-3 border border-slate-200 text-center">Time (H)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {data.maintenance.logs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-400 bg-slate-50">No maintenance records found for the selected filters.</td>
                        </tr>
                      ) : (
                        data.maintenance.logs.map((log, idx) => (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors odd:bg-slate-50/50">
                            <td className="py-1.5 px-3 text-center font-bold text-gray-400 border border-slate-200">{idx + 1}</td>
                            <td className="py-1.5 px-3 whitespace-nowrap border border-slate-200">{new Date(log.serviceDate).toLocaleDateString('en-GB')}</td>
                            <td className="py-1.5 px-3 border border-slate-200 font-medium">{log.description}</td>
                            <td className="py-1.5 px-3 border border-slate-200 text-slate-900">{log.equipment.name}</td>
                            <td className="py-1.5 px-3 border border-slate-200">{log.technician?.fullName || 'N/A'}</td>
                            <td className="py-1.5 px-3 border border-slate-200 text-center font-semibold text-slate-900">{log.downtimeHours != null ? log.downtimeHours.toFixed(1) : '0.0'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Fuel Logs Table */}
            {(activeSection === 'all' || activeSection === 'fuel') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Fuel size={16} className="text-slate-500" />
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Fuel Transaction Logs</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-[#06B6D4] text-white uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2 px-3 text-center border border-slate-200">#</th>
                        <th className="py-2 px-3 border border-slate-200">Date</th>
                        <th className="py-2 px-3 border border-slate-200">Equipment</th>
                        <th className="py-2 px-3 border border-slate-200">Operator</th>
                        <th className="py-2 px-3 border border-slate-200 text-center">Liters</th>
                        <th className="py-2 px-3 border border-slate-200 text-right">Cost (RWF)</th>
                        <th className="py-2 px-3 border border-slate-200 text-right">Odometer (km)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {data.fuel.logs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-400 bg-slate-50">No fuel logs found for the selected filters.</td>
                        </tr>
                      ) : (
                        data.fuel.logs.map((log, idx) => (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors odd:bg-slate-50/50">
                            <td className="py-1.5 px-3 text-center font-bold text-gray-400 border border-slate-200">{idx + 1}</td>
                            <td className="py-1.5 px-3 border border-slate-200">{new Date(log.fuelDate).toLocaleDateString('en-GB')}</td>
                            <td className="py-1.5 px-3 border border-slate-200 text-slate-900 font-medium">{log.equipment.name}</td>
                            <td className="py-1.5 px-3 border border-slate-200">{log.loggedBy?.fullName || 'N/A'}</td>
                            <td className="py-1.5 px-3 border border-slate-200 text-center text-slate-900 font-semibold">{log.liters.toLocaleString()} L</td>
                            <td className="py-1.5 px-3 border border-slate-200 text-right text-slate-950 font-bold">{log.totalCost.toLocaleString()}</td>
                            <td className="py-1.5 px-3 border border-slate-200 text-right">{log.odometer.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Usage Logs Table */}
            {(activeSection === 'all' || activeSection === 'usage') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Clock size={16} className="text-slate-500" />
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Equipment Shift Utilization Logs</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-[#06B6D4] text-white uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2 px-3 text-center border border-slate-200">#</th>
                        <th className="py-2 px-3 border border-slate-200">Date</th>
                        <th className="py-2 px-3 border border-slate-200">Equipment</th>
                        <th className="py-2 px-3 border border-slate-200">Operator</th>
                        <th className="py-2 px-3 border border-slate-200 text-right">Start Hours</th>
                        <th className="py-2 px-3 border border-slate-200 text-right">End Hours</th>
                        <th className="py-2 px-3 border border-slate-200 text-right">Total Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {data.usage.logs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-400 bg-slate-50">No usage logs found for the selected filters.</td>
                        </tr>
                      ) : (
                        data.usage.logs.map((log, idx) => (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors odd:bg-slate-50/50">
                            <td className="py-1.5 px-3 text-center font-bold text-gray-400 border border-slate-200">{idx + 1}</td>
                            <td className="py-1.5 px-3 border border-slate-200">{new Date(log.shiftDate).toLocaleDateString('en-GB')}</td>
                            <td className="py-1.5 px-3 border border-slate-200 text-slate-900 font-medium">{log.equipment.name}</td>
                            <td className="py-1.5 px-3 border border-slate-200">{log.operator?.fullName || 'N/A'}</td>
                            <td className="py-1.5 px-3 border border-slate-200 text-right">{log.startHours.toFixed(1)}</td>
                            <td className="py-1.5 px-3 border border-slate-200 text-right">{log.endHours.toFixed(1)}</td>
                            <td className="py-1.5 px-3 border border-slate-200 text-right text-slate-900 font-semibold">{log.totalHours.toFixed(1)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Compliance Overview Table */}
            {(activeSection === 'all' || activeSection === 'compliance') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Calendar size={16} className="text-slate-500" />
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Service Schedule Compliance Overview</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-6 items-center bg-slate-50/50 border border-slate-100 rounded-xl p-5">
                  <div className="flex justify-center">
                    <ComplianceGauge rate={data.scheduleCompliance.complianceRate} />
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Completed', value: data.scheduleCompliance.completed, color: 'bg-green-500', text: 'text-green-700' },
                      { label: 'Upcoming', value: data.scheduleCompliance.upcoming, color: 'bg-gray-300', text: 'text-gray-600' },
                      { label: 'Due Soon', value: data.scheduleCompliance.dueSoon, color: 'bg-blue-400', text: 'text-blue-700' },
                      { label: 'Urgent', value: data.scheduleCompliance.urgent, color: 'bg-orange-400', text: 'text-orange-700' },
                      { label: 'Overdue', value: data.scheduleCompliance.overdue, color: 'bg-red-500', text: 'text-red-700' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                        <p className="text-xs text-gray-600 w-20 font-medium">{item.label}</p>
                        <div className="flex-1 bg-slate-200/60 rounded-full h-2">
                          <div className={`h-2 rounded-full ${item.color}`}
                            style={{ width: `${data.scheduleCompliance.total > 0 ? (item.value / data.scheduleCompliance.total) * 100 : 0}%` }} />
                        </div>
                        <p className={`text-xs font-bold ${item.text} w-6 text-right`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Signature Block (dynamic according to logged-in account) */}
            <div className="pt-8 border-t border-slate-100 mt-8 flex flex-col items-start text-sm">
              <span className="font-bold text-slate-800">Approved By:</span>
              <span className="font-medium text-slate-600 mt-1 capitalize">
                {currentUser?.fullName || 'System Administrator'} ({currentUser?.role || 'Admin'})
              </span>
              <div className="w-full flex justify-between gap-12 mt-10">
                <div className="w-64 border-t border-slate-300 pt-1">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Signature</span>
                </div>
                <div className="w-48 border-t border-slate-300 pt-1">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Date</span>
                </div>
              </div>
            </div>

          </div>
        ) : null}

      </div>
    </div>
  )
}