import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { fullName: true, email: true, role: true, preferredLanguage: true },
  })

  if (!user) {
    redirect('/login')
  }

  const cookieStore = await cookies()
  const cookieLang = cookieStore.get('lang')?.value
  const lang = (cookieLang || user.preferredLanguage || 'en') as 'en' | 'fr' | 'rw'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar
        role={user.role}
        lang={lang}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          user={{ id: session.id, role: user.role, email: user.email, fullName: user.fullName }} 
          lang={lang}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
