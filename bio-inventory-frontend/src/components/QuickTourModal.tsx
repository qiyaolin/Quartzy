import React, { useState } from 'react';
import { 
    X, ChevronLeft, ChevronRight, Calendar, Monitor, Users, 
    ClipboardList, CalendarDays, User, Check, ArrowRight
} from 'lucide-react';

interface TourStep {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<any>;
    tab?: string;
    tips: string[];
}

interface QuickTourModalProps {
    onClose: () => void;
    activeTab: string;
    onNavigateToTab: (tab: string) => void;
}

const QuickTourModal: React.FC<QuickTourModalProps> = ({
    onClose,
    activeTab,
    onNavigateToTab
}) => {
    const [currentStep, setCurrentStep] = useState(0);

    const tourSteps: TourStep[] = [
        {
            id: 'welcome',
            title: 'Welcome to Lab Schedule Management',
            description: 'Let\'s take a quick tour of the main features to help you get started.',
            icon: CalendarDays,
            tips: [
                'Manage all lab activities in one place',
                'Book equipment and schedule meetings',
                'Track tasks and personal schedules'
            ]
        },
        {
            id: 'dashboard',
            title: 'Dashboard Overview',
            description: 'Your central hub showing today\'s events, upcoming meetings, and pending tasks.',
            icon: CalendarDays,
            tab: 'dashboard',
            tips: [
                'See all activities at a glance',
                'Quick stats and metrics',
                'Pending actions that need attention'
            ]
        },
        {
            id: 'equipment',
            title: 'Equipment Management',
            description: 'Book lab equipment, check availability, and manage QR code check-ins.',
            icon: Monitor,
            tab: 'equipment',
            tips: [
                'View real-time equipment availability',
                'Book equipment for specific time slots',
                'Use QR codes for check-in/check-out'
            ]
        },
        {
            id: 'meetings',
            title: 'Group Meetings',
            description: 'Schedule team meetings, manage presenter rotations, and handle journal club sessions.',
            icon: Users,
            tab: 'meetings',
            tips: [
                'Automatic presenter rotation system',
                'Journal club paper submissions',
                'Meeting swap requests and approvals'
            ]
        },
        {
            id: 'tasks',
            title: 'Recurring Tasks',
            description: 'Manage lab maintenance tasks with automatic assignment and rotation.',
            icon: ClipboardList,
            tab: 'tasks',
            tips: [
                'Monthly lab maintenance assignments',
                'Task completion tracking',
                'Automated team rotation'
            ]
        },
        {
            id: 'calendar',
            title: 'Calendar Views',
            description: 'Comprehensive calendar with day, week, and month views for all activities.',
            icon: Calendar,
            tab: 'calendar',
            tips: [
                'Multiple view modes (day/week/month)',
                'Filter by event type or status',
                'Personal vs. team schedule views'
            ]
        },
        {
            id: 'complete',
            title: 'You\'re All Set!',
            description: 'Start managing your lab schedule efficiently with these powerful features.',
            icon: Check,
            tips: [
                'Use the floating + button for quick actions',
                'Check the dashboard regularly for updates',
                'Explore each tab to discover more features'
            ]
        }
    ];

    const currentTourStep = tourSteps[currentStep];
    const isLastStep = currentStep === tourSteps.length - 1;
    const isFirstStep = currentStep === 0;

    const handleNext = () => {
        if (currentTourStep.tab && currentTourStep.tab !== activeTab) {
            onNavigateToTab(currentTourStep.tab);
        }
        
        if (isLastStep) {
            onClose();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSkip = () => {
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <currentTourStep.icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                {currentTourStep.title}
                            </h2>
                            <p className="text-sm text-gray-500">
                                Step {currentStep + 1} of {tourSteps.length}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 pt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-700 mb-6 leading-relaxed">
                        {currentTourStep.description}
                    </p>

                    {/* Tips */}
                    <div className="space-y-3 mb-6">
                        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            Key Features:
                        </h4>
                        <ul className="space-y-2">
                            {currentTourStep.tips.map((tip, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <ArrowRight className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-sm text-gray-600">{tip}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                    <button
                        onClick={handleSkip}
                        className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        Skip Tour
                    </button>
                    
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrevious}
                            disabled={isFirstStep}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                        </button>
                        
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            {isLastStep ? 'Get Started' : 'Next'}
                            {!isLastStep && <ChevronRight className="w-4 h-4" />}
                            {isLastStep && <Check className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickTourModal;