import React from 'react';
import { X, Command, Keyboard, Zap } from 'lucide-react';

interface KeyboardShortcut {
    key: string;
    description: string;
    category: 'navigation' | 'actions' | 'general';
}

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
    isOpen,
    onClose
}) => {
    const shortcuts: KeyboardShortcut[] = [
        // Navigation
        { key: 'Ctrl + 1', description: 'Go to Dashboard', category: 'navigation' },
        { key: 'Ctrl + 2', description: 'Go to Calendar', category: 'navigation' },
        { key: 'Ctrl + 3', description: 'Go to Equipment', category: 'navigation' },
        { key: 'Ctrl + 4', description: 'Go to Meetings', category: 'navigation' },
        { key: 'Ctrl + 5', description: 'Go to Tasks', category: 'navigation' },
        { key: 'Ctrl + 6', description: 'Go to My Schedule', category: 'navigation' },
        
        // Actions
        { key: 'Ctrl + N', description: 'Create New Event', category: 'actions' },
        { key: 'Ctrl + B', description: 'Quick Book Equipment', category: 'actions' },
        { key: 'Ctrl + M', description: 'Schedule Meeting', category: 'actions' },
        { key: 'Ctrl + T', description: 'Create Task', category: 'actions' },
        { key: 'Ctrl + R', description: 'Refresh Data', category: 'actions' },
        
        // General
        { key: 'Ctrl + ?', description: 'Show This Help', category: 'general' },
        { key: 'Escape', description: 'Close Modals', category: 'general' },
        { key: 'Ctrl + F', description: 'Search/Filter', category: 'general' }
    ];

    const groupedShortcuts = {
        navigation: shortcuts.filter(s => s.category === 'navigation'),
        actions: shortcuts.filter(s => s.category === 'actions'),
        general: shortcuts.filter(s => s.category === 'general')
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Keyboard className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Keyboard Shortcuts</h2>
                            <p className="text-sm text-gray-600">Speed up your workflow with these shortcuts</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="space-y-6">
                        {/* Navigation Shortcuts */}
                        <div>
                            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                                <Command className="w-5 h-5 text-blue-600" />
                                Navigation
                            </h3>
                            <div className="grid gap-2">
                                {groupedShortcuts.navigation.map((shortcut, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">{shortcut.description}</span>
                                        <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded-md shadow-sm">
                                            {shortcut.key}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Shortcuts */}
                        <div>
                            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                                <Zap className="w-5 h-5 text-green-600" />
                                Quick Actions
                            </h3>
                            <div className="grid gap-2">
                                {groupedShortcuts.actions.map((shortcut, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">{shortcut.description}</span>
                                        <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded-md shadow-sm">
                                            {shortcut.key}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* General Shortcuts */}
                        <div>
                            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                                <Keyboard className="w-5 h-5 text-purple-600" />
                                General
                            </h3>
                            <div className="grid gap-2">
                                {groupedShortcuts.general.map((shortcut, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">{shortcut.description}</span>
                                        <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded-md shadow-sm">
                                            {shortcut.key}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Pro Tip */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-3">
                            <div className="p-1 bg-blue-100 rounded-full">
                                <Zap className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900 mb-1">Pro Tip</h4>
                                <p className="text-sm text-gray-600">
                                    Use <kbd className="px-1 py-0.5 text-xs bg-white border rounded">Ctrl + ?</kbd> anytime to see this shortcuts reference.
                                    Most shortcuts work across all tabs for consistent navigation.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcutsModal;