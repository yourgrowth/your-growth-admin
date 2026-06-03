export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-64 rounded mb-2" style={{ background: '#1a2332' }} />
        <div className="h-4 w-80 rounded" style={{ background: '#1a2332' }} />
      </div>

      {[...Array(4)].map((_, i) => (
        <div key={i} className="mb-10">
          <div className="h-4 w-52 rounded mb-4" style={{ background: '#1a2332' }} />
          <div className="rounded-lg" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
            <div className="h-10 border-b" style={{ borderColor: '#1a2332' }} />
            {[...Array(4)].map((_, j) => (
              <div
                key={j}
                className="h-12 border-b last:border-b-0"
                style={{ borderColor: '#1a2332', background: '#080b0f' }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
