import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-8" style={{ background: '#070a0e' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
