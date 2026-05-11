export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center"
      style={{ height: 'calc(100vh - 57px)' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
    </div>
  )
}
