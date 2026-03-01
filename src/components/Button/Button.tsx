import React from 'react'
import './Button.css'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'cta' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  icon?: React.ReactNode
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`wo-btn wo-btn--${variant} wo-btn--${size} ${isLoading ? 'wo-btn--loading' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <span className="wo-btn__spinner" />}
      {!isLoading && icon && <span className="wo-btn__icon">{icon}</span>}
      {children && <span className="wo-btn__label">{children}</span>}
    </button>
  )
}

export default Button
