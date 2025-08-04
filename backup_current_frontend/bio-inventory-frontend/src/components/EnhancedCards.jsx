import React, { useState } from 'react';
import {
    Heart,
    Share2,
    Star,
    Eye,
    ShoppingCart,
    MapPin,
    Tag,
    TrendingUp,
    Zap
} from 'lucide-react';

// Enhanced Card Component - JavaScript Style
const EnhancedCard = ({ 
    children, 
    className = '', 
    variant = 'default',
    size = 'medium',
    interactive = false,
    gradient = false,
    glass = false,
    onClick
}) => {
    const variants = {
        default: 'bg-white border border-gray-200 shadow-sm hover:shadow-lg',
        elevated: 'bg-white border border-gray-200 shadow-lg hover:shadow-xl',
        outlined: 'bg-white border-2 border-gray-200 hover:border-gray-300',
        ghost: 'bg-gray-50/50 border border-transparent hover:bg-gray-100/50',
        gradient: 'bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-sm'
    };

    const sizes = {
        small: 'p-4',
        medium: 'p-6',
        large: 'p-8'
    };

    const baseClasses = `rounded-2xl transition-all duration-300 ${sizes[size]} ${variants[variant]}`;
    const interactiveClasses = interactive ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : '';
    const glassClasses = glass ? 'backdrop-blur-md bg-white/80' : '';
    
    return (
        <div 
            className={`${baseClasses} ${interactiveClasses} ${glassClasses} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

// Product Card Component - JavaScript Style
const ProductCard = ({ 
    title, 
    description, 
    image, 
    price, 
    originalPrice,
    rating,
    reviews,
    badge,
    category,
    onFavorite,
    onShare,
    onClick,
    isFavorited = false
}) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div 
            className="relative group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <EnhancedCard 
                variant="elevated" 
                className="relative overflow-hidden group cursor-pointer"
                onClick={onClick}
            >
                {/* Image Section */}
                <div className="relative mb-4 rounded-xl overflow-hidden bg-gray-50">
                    {image ? (
                        <img 
                            src={image} 
                            alt={title}
                            className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-48 flex items-center justify-center">
                            <ShoppingCart className="w-12 h-12 text-gray-400" />
                        </div>
                    )}
                    
                    {/* Badge */}
                    {badge && (
                        <div className="absolute top-3 left-3 bg-primary-500 text-white px-2 py-1 text-xs font-medium rounded-full">
                            {badge}
                        </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className={`absolute top-3 right-3 flex gap-2 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onFavorite && onFavorite(); }}
                            className={`p-2 rounded-full transition-colors ${isFavorited ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-700 hover:bg-red-500 hover:text-white'}`}
                        >
                            <Heart className="w-4 h-4" fill={isFavorited ? 'currentColor' : 'none'} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onShare && onShare(); }}
                            className="p-2 rounded-full bg-white/90 text-gray-700 hover:bg-primary-500 hover:text-white transition-colors"
                        >
                            <Share2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-3">
                    {/* Category */}
                    {category && (
                        <div className="flex items-center gap-1 text-xs text-primary-600 font-medium">
                            <Tag className="w-3 h-3" />
                            {category}
                        </div>
                    )}
                    
                    {/* Title */}
                    <h3 className="font-semibold text-gray-900 text-lg leading-tight group-hover:text-primary-600 transition-colors">
                        {title}
                    </h3>
                    
                    {/* Description */}
                    <p className="text-gray-600 text-sm line-clamp-2">
                        {description}
                    </p>
                    
                    {/* Rating */}
                    {rating && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                    <Star 
                                        key={i} 
                                        className={`w-4 h-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                                    />
                                ))}
                            </div>
                            <span className="text-sm text-gray-600">
                                {rating} {reviews && `(${reviews})`}
                            </span>
                        </div>
                    )}
                    
                    {/* Price */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-gray-900">${price}</span>
                            {originalPrice && originalPrice > price && (
                                <span className="text-sm text-gray-500 line-through">${originalPrice}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                            <TrendingUp className="w-3 h-3" />
                            Popular
                        </div>
                    </div>
                </div>
            </EnhancedCard>
        </div>
    );
};

// Info Card Component - JavaScript Style
const InfoCard = ({ 
    title, 
    subtitle,
    description, 
    icon: Icon, 
    action,
    actionLabel = "Learn More",
    variant = 'default',
    size = 'medium'
}) => {
    const variants = {
        default: 'bg-white border border-gray-200',
        primary: 'bg-gradient-to-br from-primary-500 to-primary-600 text-white border-0',
        success: 'bg-gradient-to-br from-success-500 to-success-600 text-white border-0',
        warning: 'bg-gradient-to-br from-warning-500 to-warning-600 text-white border-0',
        danger: 'bg-gradient-to-br from-danger-500 to-danger-600 text-white border-0'
    };

    const textColor = variant === 'default' ? 'text-gray-900' : 'text-white';
    const subtitleColor = variant === 'default' ? 'text-gray-600' : 'text-white/80';
    const descriptionColor = variant === 'default' ? 'text-gray-600' : 'text-white/70';

    return (
        <EnhancedCard 
            variant={variant === 'default' ? 'elevated' : 'default'} 
            className={`${variants[variant]} relative overflow-hidden group`}
            size={size}
        >
            {/* Background Decoration */}
            {variant !== 'default' && (
                <>
                    <div className="absolute top-0 right-0 -translate-y-4 translate-x-4 opacity-10">
                        <Icon className="w-24 h-24" />
                    </div>
                    <div className="absolute bottom-0 left-0 translate-y-4 -translate-x-4 opacity-5">
                        <Zap className="w-32 h-32" />
                    </div>
                </>
            )}
            
            {/* Content */}
            <div className="relative z-10 space-y-4">
                {/* Header */}
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${variant === 'default' ? 'bg-primary-50 text-primary-600' : 'bg-white/20 text-white'}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className={`font-semibold text-lg ${textColor}`}>
                            {title}
                        </h3>
                        {subtitle && (
                            <p className={`text-sm ${subtitleColor}`}>
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
                
                {/* Description */}
                <p className={`${descriptionColor} leading-relaxed`}>
                    {description}
                </p>
                
                {/* Action */}
                {action && (
                    <button 
                        onClick={action}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            variant === 'default' 
                                ? 'bg-primary-500 text-white hover:bg-primary-600' 
                                : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                    >
                        {actionLabel}
                        <Eye className="w-4 h-4" />
                    </button>
                )}
            </div>
        </EnhancedCard>
    );
};

export { EnhancedCard, ProductCard, InfoCard };