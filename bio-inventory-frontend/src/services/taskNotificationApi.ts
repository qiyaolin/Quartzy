import { buildApiUrl } from '../config/api';

export interface NotificationSettings {
    email_notifications: boolean;
    reminder_days: number;
    daily_digest: boolean;
    overdue_alerts: boolean;
}

export interface TaskNotification {
    id: number;
    task_id: number;
    task_name: string;
    user_id: number;
    notification_type: 'assignment' | 'reminder' | 'overdue' | 'completion_required';
    scheduled_date: string;
    sent_date?: string;
    status: 'pending' | 'sent' | 'failed';
    email_subject: string;
    email_content: string;
    created_at: string;
}

export interface TaskNotificationApi {
    // Get user notification settings
    getUserNotificationSettings: (token: string, userId?: number) => Promise<NotificationSettings>;
    
    // Update user notification settings
    updateNotificationSettings: (token: string, settings: NotificationSettings) => Promise<NotificationSettings>;
    
    // Get user's notifications
    getUserNotifications: (token: string, params?: {
        status?: 'pending' | 'sent' | 'failed';
        type?: string;
        limit?: number;
        offset?: number;
    }) => Promise<{
        count: number;
        results: TaskNotification[];
    }>;
    
    // Mark notification as read
    markNotificationAsRead: (token: string, notificationId: number) => Promise<void>;
    
    // Send immediate notification
    sendTaskNotification: (token: string, data: {
        task_id: number;
        user_ids: number[];
        notification_type: string;
        custom_message?: string;
    }) => Promise<void>;
    
    // Test email notification
    testEmailNotification: (token: string, email: string) => Promise<void>;
}

export const taskNotificationApi: TaskNotificationApi = {
    async getUserNotificationSettings(token: string, userId?: number): Promise<NotificationSettings> {
        const url = userId 
            ? `schedule/notifications/settings/${userId}/`
            : 'schedule/notifications/settings/';
            
        const response = await fetch(buildApiUrl(url), {
            method: 'GET',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get notification settings: ${response.statusText}`);
        }

        return await response.json();
    },

    async updateNotificationSettings(token: string, settings: NotificationSettings): Promise<NotificationSettings> {
        const response = await fetch(buildApiUrl('schedule/notifications/settings/'), {
            method: 'PUT',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings),
        });

        if (!response.ok) {
            throw new Error(`Failed to update notification settings: ${response.statusText}`);
        }

        return await response.json();
    },

    async getUserNotifications(token: string, params: {
        status?: 'pending' | 'sent' | 'failed';
        type?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<{ count: number; results: TaskNotification[] }> {
        const queryParams = new URLSearchParams();
        
        if (params.status) queryParams.append('status', params.status);
        if (params.type) queryParams.append('type', params.type);
        if (params.limit) queryParams.append('limit', params.limit.toString());
        if (params.offset) queryParams.append('offset', params.offset.toString());

        const url = `schedule/notifications/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        
        const response = await fetch(buildApiUrl(url), {
            method: 'GET',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get notifications: ${response.statusText}`);
        }

        return await response.json();
    },

    async markNotificationAsRead(token: string, notificationId: number): Promise<void> {
        const response = await fetch(buildApiUrl(`schedule/notifications/${notificationId}/mark-read/`), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to mark notification as read: ${response.statusText}`);
        }
    },

    async sendTaskNotification(token: string, data: {
        task_id: number;
        user_ids: number[];
        notification_type: string;
        custom_message?: string;
    }): Promise<void> {
        const response = await fetch(buildApiUrl('schedule/notifications/send/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`Failed to send notification: ${response.statusText}`);
        }
    },

    async testEmailNotification(token: string, email: string): Promise<void> {
        const response = await fetch(buildApiUrl('schedule/notifications/test-email/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            throw new Error(`Failed to send test email: ${response.statusText}`);
        }
    },
};

// Notification utilities
export const notificationUtils = {
    // Generate notification templates
    generateTaskAssignmentEmail(taskName: string, dueDate: string, assignedBy: string): {
        subject: string;
        content: string;
    } {
        return {
            subject: `Task Assignment: ${taskName}`,
            content: `
Hello,

You have been assigned to the following laboratory task:

Task: ${taskName}
Due Date: ${dueDate}
Assigned By: ${assignedBy}

Please complete this task by the due date. If you have any questions or need to request a swap, please contact the task coordinator.

Thank you,
Laboratory Management System
            `.trim()
        };
    },

    generateTaskReminderEmail(taskName: string, dueDate: string, daysUntilDue: number): {
        subject: string;
        content: string;
    } {
        const urgency = daysUntilDue <= 1 ? 'URGENT: ' : '';
        const timePhrase = daysUntilDue === 0 ? 'today' : 
                          daysUntilDue === 1 ? 'tomorrow' : 
                          `in ${daysUntilDue} days`;

        return {
            subject: `${urgency}Task Reminder: ${taskName} is due ${timePhrase}`,
            content: `
Hello,

This is a reminder that you have a laboratory task due ${timePhrase}:

Task: ${taskName}
Due Date: ${dueDate}

${daysUntilDue <= 1 ? 'This task is due very soon. Please complete it as soon as possible.' : 'Please plan to complete this task on time.'}

If you need assistance or have any questions, please contact the laboratory coordinator.

Best regards,
Laboratory Management System
            `.trim()
        };
    },

    generateOverdueTaskEmail(taskName: string, dueDate: string, daysPastDue: number): {
        subject: string;
        content: string;
    } {
        return {
            subject: `OVERDUE: ${taskName} was due ${daysPastDue} day(s) ago`,
            content: `
Hello,

Your assigned laboratory task is now overdue:

Task: ${taskName}
Original Due Date: ${dueDate}
Days Overdue: ${daysPastDue}

Please complete this task immediately. Overdue tasks can affect laboratory operations and safety protocols.

If there are any issues preventing you from completing this task, please contact the laboratory coordinator immediately.

Urgent regards,
Laboratory Management System
            `.trim()
        };
    },

    generateTaskCompletionNotificationEmail(taskName: string, completedBy: string, completedDate: string): {
        subject: string;
        content: string;
    } {
        return {
            subject: `Task Completed: ${taskName}`,
            content: `
Hello,

The following laboratory task has been successfully completed:

Task: ${taskName}
Completed By: ${completedBy}
Completion Date: ${completedDate}

Thank you for maintaining our laboratory standards.

Best regards,
Laboratory Management System
            `.trim()
        };
    },

    // Notification status helpers
    getNotificationStatusColor(status: string): string {
        switch (status) {
            case 'sent':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'failed':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    },

    getNotificationTypeLabel(type: string): string {
        switch (type) {
            case 'assignment':
                return 'Task Assignment';
            case 'reminder':
                return 'Due Date Reminder';
            case 'overdue':
                return 'Overdue Alert';
            case 'completion_required':
                return 'Completion Required';
            default:
                return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    },

    // Calculate notification scheduling
    calculateReminderDates(dueDate: string, reminderDays: number[]): string[] {
        const due = new Date(dueDate);
        return reminderDays.map(days => {
            const reminderDate = new Date(due);
            reminderDate.setDate(due.getDate() - days);
            return reminderDate.toISOString().split('T')[0];
        });
    },

    // Validate notification settings
    validateNotificationSettings(settings: NotificationSettings): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (settings.reminder_days < 0 || settings.reminder_days > 30) {
            errors.push('Reminder days must be between 0 and 30');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
};

export default taskNotificationApi;