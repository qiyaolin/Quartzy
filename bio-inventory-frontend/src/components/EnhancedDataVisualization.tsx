import React, { useState, useMemo } from 'react';
import { 
    BarChart3, 
    PieChart, 
    TrendingUp, 
    TrendingDown, 
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    Target,
    Zap,
    DollarSign,
    Package,
    AlertTriangle,
    CheckCircle,
    Clock
} from 'lucide-react';

// Stats Card Component
const StatsCard = ({ title, value, change, changeType, icon: Icon, gradient, subtitle }) => {
    return (
        <div className="relative group">
            <div className={`card p-6 ${gradient} border-0 text-white overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl`}>
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-2xl bg-white/20 backdrop-blur-sm`}>
                            <Icon className="w-6 h-6 text-white" />
                        </div>
                        {change && (
                            <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${
                                changeType === 'increase' 
                                    ? 'bg-white/20 text-white' 
                                    : 'bg-white/20 text-white'
                            }`}>
                                {changeType === 'increase' ? (
                                    <ArrowUpRight className="w-4 h-4" />
                                ) : (
                                    <ArrowDownRight className="w-4 h-4" />
                                )}
                                <span>{change}</span>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-white">{value}</h3>
                        <p className="text-white/80 text-sm font-medium">{title}</p>
                        {subtitle && (
                            <p className="text-white/60 text-xs">{subtitle}</p>
                        )}
                    </div>
                </div>
                
                {/* Decorative background */}
                <div className="absolute top-0 right-0 -translate-y-4 translate-x-4 opacity-10">
                    <div className="w-32 h-32 rounded-full bg-white"></div>
                </div>
                <div className="absolute bottom-0 left-0 translate-y-4 -translate-x-4 opacity-5">
                    <div className="w-24 h-24 rounded-full bg-white"></div>
                </div>
            </div>
        </div>
    );
};

// Progress Ring Component
const ProgressRing = ({ percentage, size = 120, strokeWidth = 8, color = "#3b82f6", label, value }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(229, 231, 235, 0.3)"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                </div>
            </div>
        </div>
    );
};

// Mini Chart Component
const MiniChart = ({ data, type = 'line', color = '#3b82f6' }) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((d.value - minValue) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="h-16 w-full">
            <svg viewBox="0 0 100 100" className="w-full h-full">
                {type === 'line' && (
                    <>
                        <polyline
                            points={points}
                            fill="none"
                            stroke={color}
                            strokeWidth="2"
                            className="drop-shadow-sm"
                        />
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
                                <stop offset="100%" stopColor={color} stopOpacity="0.05"/>
                            </linearGradient>
                        </defs>
                        <polyline
                            points={`0,100 ${points} 100,100`}
                            fill="url(#gradient)"
                        />
                    </>
                )}
                {type === 'bar' && data.map((d, i) => (
                    <rect
                        key={i}
                        x={i * (100 / data.length)}
                        y={100 - ((d.value - minValue) / range) * 100}
                        width={100 / data.length - 2}
                        height={((d.value - minValue) / range) * 100}
                        fill={color}
                        opacity="0.8"
                        className="transition-all duration-300 hover:opacity-100"
                    />
                ))}
            </svg>
        </div>
    );
};

// Activity Feed Component
const ActivityFeed = ({ activities = [] }) => {
    return (
        <div className="space-y-4">
            {activities.map((activity, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 hover:bg-gray-50 rounded-xl transition-colors duration-200">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        activity.type === 'success' ? 'bg-success-100' :
                        activity.type === 'warning' ? 'bg-warning-100' :
                        activity.type === 'error' ? 'bg-danger-100' :
                        'bg-primary-100'
                    }`}>
                        {activity.type === 'success' && <CheckCircle className="w-5 h-5 text-success-600" />}
                        {activity.type === 'warning' && <AlertTriangle className="w-5 h-5 text-warning-600" />}
                        {activity.type === 'error' && <AlertTriangle className="w-5 h-5 text-danger-600" />}
                        {activity.type === 'info' && <Activity className="w-5 h-5 text-primary-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                        <p className="text-sm text-gray-500 mt-1">{activity.description}</p>
                        <div className="flex items-center mt-2 space-x-4 text-xs text-gray-400">
                            <div className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {activity.timestamp}
                            </div>
                            {activity.user && (
                                <span>by {activity.user}</span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Enhanced Metric Display
const MetricDisplay = ({ 
    title, 
    metrics = [], 
    showChart = false, 
    chartData = [], 
    type = 'grid' 
}) => {
    return (
        <div className="card-body">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                {showChart && (
                    <div className="flex space-x-2">
                        <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                            <BarChart3 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                            <PieChart className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                )}
            </div>

            {type === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {metrics.map((metric, index) => (
                        <div key={index} className="group">
                            <div className="p-4 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-gray-600">{metric.label}</span>
                                    {metric.trend && (
                                        <div className={`flex items-center space-x-1 text-xs ${
                                            metric.trend > 0 ? 'text-success-600' : 'text-danger-600'
                                        }`}>
                                            {metric.trend > 0 ? (
                                                <TrendingUp className="w-3 h-3" />
                                            ) : (
                                                <TrendingDown className="w-3 h-3" />
                                            )}
                                            <span>{Math.abs(metric.trend)}%</span>
                                        </div>
                                    )}
                                </div>
                                <div className="text-2xl font-bold text-gray-900 mb-2">
                                    {metric.value}
                                </div>
                                {metric.chartData && (
                                    <MiniChart data={metric.chartData} color={metric.color} />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {type === 'list' && (
                <div className="space-y-4">
                    {metrics.map((metric, index) => (
                        <div key={index} className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-colors duration-200">
                            <div className="flex items-center space-x-4">
                                {metric.icon && (
                                    <div className={`p-2 rounded-xl ${metric.iconBg || 'bg-gray-100'}`}>
                                        <metric.icon className={`w-5 h-5 ${metric.iconColor || 'text-gray-600'}`} />
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium text-gray-900">{metric.label}</p>
                                    {metric.subtitle && (
                                        <p className="text-sm text-gray-500">{metric.subtitle}</p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-bold text-gray-900">{metric.value}</div>
                                {metric.change && (
                                    <div className={`text-xs flex items-center ${
                                        metric.changeType === 'increase' ? 'text-success-600' : 'text-danger-600'
                                    }`}>
                                        {metric.changeType === 'increase' ? (
                                            <ArrowUpRight className="w-3 h-3 mr-1" />
                                        ) : (
                                            <ArrowDownRight className="w-3 h-3 mr-1" />
                                        )}
                                        {metric.change}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showChart && chartData.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <MiniChart data={chartData} type="line" />
                </div>
            )}
        </div>
    );
};

export {
    StatsCard,
    ProgressRing,
    MiniChart,
    ActivityFeed,
    MetricDisplay
};