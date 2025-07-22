import React, { useState } from 'react';
import { 
    ChevronRight, 
    MoreVertical, 
    ExternalLink, 
    Heart,
    Share2,
    Bookmark,
    Eye,
    Calendar,
    MapPin,
    Tag,
    Star,
    TrendingUp,
    Zap
} from 'lucide-react';

// Enhanced Card Component
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

// Product Card Component
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
            className="group relative bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer transform hover:scale-[1.02]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
        >
            {/* Image Section */}
            <div className="relative overflow-hidden bg-gray-100 aspect-square">
                {image ? (
                    <img 
                        src={image} 
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <div className="w-16 h-16 bg-gray-300 rounded-2xl flex items-center justify-center">
                            <Zap className="w-8 h-8 text-gray-500" />
                        </div>
                    </div>
                )}
                
                {/* Overlay Actions */}
                <div className={`absolute top-3 right-3 flex space-x-2 transition-all duration-300 ${
                    isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                }`}>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onFavorite && onFavorite();
                        }}
                        className={`p-2.5 rounded-2xl backdrop-blur-md transition-all duration-200 ${
                            isFavorited 
                                ? 'bg-danger-500 text-white shadow-lg' 
                                : 'bg-white/90 text-gray-600 hover:bg-white hover:text-danger-500'
                        }`}
                    >
                        <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onShare && onShare();
                        }}
                        className="p-2.5 rounded-2xl bg-white/90 backdrop-blur-md text-gray-600 hover:bg-white hover:text-primary-500 transition-all duration-200"
                    >
                        <Share2 className="w-4 h-4" />
                    </button>
                </div>

                {/* Badge */}
                {badge && (
                    <div className="absolute top-3 left-3">
                        <span className="px-3 py-1.5 bg-primary-500 text-white text-xs font-semibold rounded-full shadow-lg">
                            {badge}
                        </span>
                    </div>
                )}

                {/* Category Tag */}
                {category && (
                    <div className="absolute bottom-3 left-3">
                        <span className="px-3 py-1 bg-white/90 backdrop-blur-md text-gray-700 text-xs font-medium rounded-full">
                            {category}
                        </span>
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="p-5 space-y-3">
                {/* Rating */}
                {rating && (
                    <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                            {[...Array(5)].map((_, i) => (
                                <Star 
                                    key={i}
                                    className={`w-3.5 h-3.5 ${
                                        i < Math.floor(rating) 
                                            ? 'text-warning-400 fill-current' 
                                            : 'text-gray-300'
                                    }`}
                                />
                            ))}
                        </div>
                        {reviews && (
                            <span className="text-xs text-gray-500">({reviews})</span>
                        )}
                    </div>
                )}

                {/* Title & Description */}
                <div>
                    <h3 className="font-semibold text-gray-900 text-lg leading-tight mb-1 group-hover:text-primary-600 transition-colors duration-200">
                        {title}
                    </h3>
                    {description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
                    )}
                </div>

                {/* Price */}
                {price && (
                    <div className="flex items-center space-x-2">
                        <span className="text-lg font-bold text-gray-900">${price}</span>
                        {originalPrice && (
                            <span className="text-sm text-gray-500 line-through">${originalPrice}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Hover Effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/0 to-black/0 group-hover:from-primary-500/10 group-hover:to-transparent transition-all duration-500 pointer-events-none"></div>
        </div>
    );
};

// Info Card Component
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
                        <div className="w-32 h-32 rounded-full bg-white"></div>
                    </div>
                    <div className="absolute bottom-0 left-0 translate-y-4 -translate-x-4 opacity-5">
                        <div className="w-24 h-24 rounded-full bg-white"></div>
                    </div>
                </>
            )}

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                        {Icon && (
                            <div className={`p-3 rounded-2xl ${
                                variant === 'default' 
                                    ? 'bg-gray-100' 
                                    : 'bg-white/20 backdrop-blur-sm'
                            }`}>
                                <Icon className={`w-6 h-6 ${
                                    variant === 'default' ? 'text-gray-600' : 'text-white'
                                }`} />
                            </div>
                        )}
                        <div>
                            <h3 className={`text-xl font-bold ${textColor}`}>{title}</h3>
                            {subtitle && (
                                <p className={`text-sm ${subtitleColor} mt-1`}>{subtitle}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Description */}
                {description && (
                    <p className={`${descriptionColor} mb-6 leading-relaxed`}>
                        {description}
                    </p>
                )}

                {/* Action */}
                {action && (
                    <button 
                        onClick={action}
                        className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                            variant === 'default' 
                                ? 'text-primary-600 hover:bg-primary-50 hover:text-primary-700' 
                                : 'text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm'
                        } group-hover:transform group-hover:translate-x-1`}
                    >
                        <span>{actionLabel}</span>
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                )}
            </div>
        </EnhancedCard>
    );
};

// Feature Card Component
const FeatureCard = ({ 
    title, 
    description, 
    icon: Icon, 
    features = [],
    highlighted = false,
    onClick 
}) => {
    return (
        <div className={`relative p-6 rounded-3xl border-2 transition-all duration-300 group cursor-pointer ${
            highlighted 
                ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-primary-100 shadow-lg shadow-primary-500/25' 
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
        }`}
        onClick={onClick}
        >
            {highlighted && (
                <div className="absolute -top-3 left-6">
                    <span className="px-3 py-1 bg-primary-500 text-white text-sm font-semibold rounded-full shadow-lg">
                        Popular
                    </span>
                </div>
            )}

            <div className="text-center space-y-4">
                {Icon && (
                    <div className={`w-16 h-16 mx-auto rounded-3xl flex items-center justify-center ${
                        highlighted 
                            ? 'bg-primary-500 text-white' 
                            : 'bg-gray-100 text-gray-600 group-hover:bg-primary-100 group-hover:text-primary-600'
                    } transition-all duration-300`}>
                        <Icon className="w-8 h-8" />
                    </div>
                )}

                <div>
                    <h3 className={`text-xl font-bold mb-2 ${
                        highlighted ? 'text-primary-900' : 'text-gray-900'
                    }`}>
                        {title}
                    </h3>
                    <p className={`text-sm leading-relaxed ${
                        highlighted ? 'text-primary-700' : 'text-gray-600'
                    }`}>
                        {description}
                    </p>
                </div>

                {features.length > 0 && (
                    <ul className="space-y-2 text-sm">
                        {features.map((feature, index) => (
                            <li key={index} className={`flex items-center justify-center space-x-2 ${
                                highlighted ? 'text-primary-700' : 'text-gray-600'
                            }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                    highlighted ? 'bg-primary-500' : 'bg-gray-400'
                                }`}></div>
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

// Metric Card Component
const MetricCard = ({ 
    title, 
    value, 
    change, 
    changeType, 
    icon: Icon, 
    trend = [],
    color = 'primary' 
}) => {
    const colors = {
        primary: {
            bg: 'bg-primary-50',
            icon: 'text-primary-600',
            text: 'text-primary-900',
            change: changeType === 'increase' ? 'text-success-600' : 'text-danger-600'
        },
        success: {
            bg: 'bg-success-50',
            icon: 'text-success-600',
            text: 'text-success-900',
            change: changeType === 'increase' ? 'text-success-600' : 'text-danger-600'
        },
        warning: {
            bg: 'bg-warning-50',
            icon: 'text-warning-600',
            text: 'text-warning-900',
            change: changeType === 'increase' ? 'text-success-600' : 'text-danger-600'
        },
        danger: {
            bg: 'bg-danger-50',
            icon: 'text-danger-600',
            text: 'text-danger-900',
            change: changeType === 'increase' ? 'text-success-600' : 'text-danger-600'
        }
    };

    return (
        <EnhancedCard className="relative overflow-hidden group hover:shadow-xl">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${colors[color].bg}`}>
                    <Icon className={`w-6 h-6 ${colors[color].icon}`} />
                </div>
                {change && (
                    <div className={`flex items-center space-x-1 ${colors[color].change}`}>
                        <TrendingUp className={`w-4 h-4 ${changeType === 'decrease' ? 'rotate-180' : ''}`} />
                        <span className="text-sm font-medium">{change}</span>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <h3 className={`text-3xl font-bold ${colors[color].text}`}>
                    {value}
                </h3>
                <p className="text-gray-600 font-medium">{title}</p>
            </div>

            {/* Trend visualization */}
            {trend.length > 0 && (
                <div className="mt-4 h-8">
                    <svg viewBox="0 0 100 20" className="w-full h-full">
                        <polyline
                            points={trend.map((value, index) => 
                                `${(index / (trend.length - 1)) * 100},${20 - (value / Math.max(...trend)) * 15}`
                            ).join(' ')}
                            fill="none"
                            stroke={colors[color].icon.replace('text-', '').replace('-600', '')}
                            strokeWidth="2"
                            className="opacity-50"
                        />
                    </svg>
                </div>
            )}

            {/* Hover effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-gray-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
        </EnhancedCard>
    );
};

export {
    EnhancedCard,
    ProductCard,
    InfoCard,
    FeatureCard,
    MetricCard
};