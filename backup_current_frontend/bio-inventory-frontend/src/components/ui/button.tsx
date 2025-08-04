import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  className = '', 
  onClick, 
  type = 'button',
  disabled = false,
  variant = 'default',
  size = 'default'
}) => {
  const baseClasses = 'font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
  
  const variantClasses = {
    default: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100',
    ghost: 'text-gray-700 hover:bg-gray-100 disabled:text-gray-400'
  };

  const sizeClasses = {
    default: 'px-4 py-2 rounded-lg',
    sm: 'px-3 py-1.5 text-sm rounded-md',
    lg: 'px-6 py-3 text-lg rounded-lg',
    icon: 'p-2 rounded-lg flex items-center justify-center'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};