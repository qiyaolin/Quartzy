import React, { useState, useEffect, useContext } from 'react';
import { 
    Sparkles, X, Play, ArrowRight, Calendar, Monitor, 
    Users, CheckCircle, Clock, TrendingUp
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';

interface SmartWelcomeBannerProps {
    onStartTour: () => void;
    onDismiss: () => void;
}

interface WelcomeStats {
    isNewUser: boolean;
    totalEvents: number;
    completedTasks: number;
    equipmentBookings: number;
    lastLoginDays: number;
}

const SmartWelcomeBanner: React.FC<SmartWelcomeBannerProps> = ({
    onStartTour,
    onDismiss
}) => {
    const authContext = useContext(AuthContext);
    const { user } = authContext || {};
    
    const [welcomeStats, setWelcomeStats] = useState<WelcomeStats | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Check if banner was previously dismissed
        const dismissed = localStorage.getItem('welcomeBannerDismissed');
        if (dismissed) {
            setIsDismissed(true);
            return;
        }

        // Simulate fetching user statistics to determine welcome message
        const fetchWelcomeStats = async () => {
            try {
                // In a real app, this would be an API call
                const stats: WelcomeStats = {
                    isNewUser: true, // This would be determined by user registration date
                    totalEvents: 0,
                    completedTasks: 0,
                    equipmentBookings: 0,
                    lastLoginDays: 0
                };
                
                setWelcomeStats(stats);
                
                // Show banner for new users or returning users after a week
                if (stats.isNewUser || stats.lastLoginDays > 7 || stats.totalEvents === 0) {
                    setIsVisible(true);
                }
            } catch (error) {
                console.error('Failed to fetch welcome stats:', error);
            }
        };

        fetchWelcomeStats();
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        setIsDismissed(true);
        localStorage.setItem('welcomeBannerDismissed', 'true');
        onDismiss();
    };

    const handleStartTour = () => {
        handleDismiss();
        onStartTour();
    };

    if (!isVisible || isDismissed || !welcomeStats) {
        return null;
    }

    const getWelcomeMessage = () => {
        if (welcomeStats.isNewUser) {
            return {
                title: `Welcome to Lab Schedule Management, ${user?.first_name || 'there'}! 🎉`,
                subtitle: "Let's get you started with managing your lab activities efficiently.",
                actionText: "Take Quick Tour",
                benefits: [
                    "Book equipment instantly",
                    "Never miss a meeting",
                    "Track all your tasks"
                ]
            };
        } else if (welcomeStats.lastLoginDays > 7) {
            return {
                title: `Welcome back, ${user?.first_name || 'there'}! 👋`,
                subtitle: "Here's what's new since your last visit.",
                actionText: "What's New",
                benefits: [
                    "Improved mobile experience",
                    "New quick actions",
                    "Enhanced notifications"
                ]
            };
        } else {
            return {
                title: "Ready to boost your productivity? ⚡",
                subtitle: "Discover advanced features to streamline your lab workflow.",
                actionText: "Explore Features",
                benefits: [
                    "Smart task automation",
                    "Team collaboration tools",
                    "Advanced scheduling"
                ]
            };
        }
    };

    const welcomeContent = getWelcomeMessage();

    return (
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg">
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-white rounded-full animate-pulse"></div>
                <div className="absolute top-1/2 -left-8 w-16 h-16 bg-white rounded-full animate-bounce"></div>
                <div className="absolute bottom-4 right-1/4 w-8 h-8 bg-white rounded-full animate-ping"></div>
            </div>

            <div className="relative p-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        {/* Main Content */}
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-white mb-2">
                                    {welcomeContent.title}
                                </h3>
                                <p className="text-blue-100 mb-4">
                                    {welcomeContent.subtitle}
                                </p>

                                {/* Benefits */}
                                <div className="flex flex-wrap gap-4 mb-6">
                                    {welcomeContent.benefits.map((benefit, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-300" />
                                            <span className="text-sm text-blue-100">{benefit}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={handleStartTour}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                    >
                                        <Play className="w-4 h-4" />
                                        {welcomeContent.actionText}
                                    </button>
                                    
                                    <button
                                        onClick={handleDismiss}
                                        className="inline-flex items-center gap-2 px-4 py-3 text-white bg-white bg-opacity-20 rounded-lg font-medium hover:bg-opacity-30 transition-all duration-200 backdrop-blur-sm"
                                    >
                                        Maybe Later
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats for Returning Users */}
                        {!welcomeStats.isNewUser && (
                            <div className="mt-6 pt-4 border-t border-white border-opacity-20">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-white">
                                            <Calendar className="w-4 h-4" />
                                            <span className="font-bold">{welcomeStats.totalEvents}</span>
                                        </div>
                                        <p className="text-xs text-blue-100">Events</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-white">
                                            <Monitor className="w-4 h-4" />
                                            <span className="font-bold">{welcomeStats.equipmentBookings}</span>
                                        </div>
                                        <p className="text-xs text-blue-100">Bookings</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-white">
                                            <CheckCircle className="w-4 h-4" />
                                            <span className="font-bold">{welcomeStats.completedTasks}</span>
                                        </div>
                                        <p className="text-xs text-blue-100">Tasks</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={handleDismiss}
                        className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        aria-label="Dismiss welcome message"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Progress indicator for new users */}
            {welcomeStats.isNewUser && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white bg-opacity-20">
                    <div className="h-full bg-white bg-opacity-60 animate-pulse"></div>
                </div>
            )}
        </div>
    );
};

export default SmartWelcomeBanner;