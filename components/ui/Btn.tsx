'use client'

type BtnProps = {
  variant?: 'primary' | 'ghost' | 'danger'
  onClick?: () => void
  children: React.ReactNode
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

const styles = {
  primary: {
    background: '#3fb950',
    color: '#080b0f',
    border: '1px solid #3fb950',
  },
  ghost: {
    background: 'transparent',
    color: '#e6edf3',
    border: '1px solid #1a2332',
  },
  danger: {
    background: 'transparent',
    color: '#f85149',
    border: '1px solid #f85149',
  },
}

export default function Btn({
  variant = 'primary',
  onClick,
  children,
  type = 'button',
  disabled,
}: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded text-sm font-medium transition-opacity disabled:opacity-50 cursor-pointer"
      style={styles[variant]}
    >
      {children}
    </button>
  )
}
