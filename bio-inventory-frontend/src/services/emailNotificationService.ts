// Email Notification Service for Group Meetings
// This service integrates with the existing email notification system in the project

import { EASTERN_TIME_ZONE } from '../utils/timezone.ts';

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    html_content: string;
    text_content: string;
    variables: string[];
}

export interface EmailNotification {
    id: number;
    recipient_email: string;
    recipient_name: string;
    subject: string;
    content: string;
    template_id?: string;
    scheduled_for?: string;
    sent_at?: string;
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
    error_message?: string;
    context: Record<string, any>;
}

export interface NotificationSchedule {
    meeting_id: number;
    reminder_type: 'presenter_assignment' | 'materials_submission' | 'pre_meeting' | 'materials_overdue';
    scheduled_for: string;
    recipients: string[];
    template_id: string;
    context: Record<string, any>;
}

// Email Templates for Group Meetings
export const EMAIL_TEMPLATES = {
    PRESENTER_ASSIGNMENT: {
        id: 'presenter_assignment',
        name: 'Presenter Assignment Notification',
        subject: 'You\'ve been assigned to present at {{meeting_title}}',
        html_content: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Presentation Assignment</h2>
                <p>Dear {{presenter_name}},</p>
                <p>You have been assigned to present at the upcoming group meeting:</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #374151;">{{meeting_title}}</h3>
                    <p><strong>Topic:</strong> {{topic}}</p>
                    <p><strong>Date:</strong> {{meeting_date}}</p>
                    <p><strong>Time:</strong> {{meeting_time}}</p>
                    <p><strong>Location:</strong> {{location}}</p>
                </div>
                
                {{#if is_journal_club}}
                <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #92400e;">📚 Journal Club Requirements</h4>
                    <p>Please submit your materials (article URL or file) by <strong>{{materials_deadline}}</strong>.</p>
                    <p>You can upload materials through the scheduling system or email them directly.</p>
                </div>
                {{/if}}
                
                <p>If you have any conflicts or need to make changes, please contact the meeting organizer as soon as possible.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        This is an automated notification from the Laboratory Schedule Management System.
                    </p>
                </div>
            </div>
        `,
        text_content: `
            Presentation Assignment
            
            Dear {{presenter_name}},
            
            You have been assigned to present at the upcoming group meeting:
            
            {{meeting_title}}
            Topic: {{topic}}
            Date: {{meeting_date}}
            Time: {{meeting_time}}
            Location: {{location}}
            
            {{#if is_journal_club}}
            Journal Club Requirements:
            Please submit your materials (article URL or file) by {{materials_deadline}}.
            You can upload materials through the scheduling system or email them directly.
            {{/if}}
            
            If you have any conflicts or need to make changes, please contact the meeting organizer as soon as possible.
            
            ---
            This is an automated notification from the Laboratory Schedule Management System.
        `,
        variables: ['presenter_name', 'meeting_title', 'topic', 'meeting_date', 'meeting_time', 'location', 'is_journal_club', 'materials_deadline']
    },

    MATERIALS_SUBMISSION_REMINDER: {
        id: 'materials_submission_reminder',
        name: 'Materials Submission Reminder',
        subject: 'Reminder: Submit materials for {{meeting_title}}',
        html_content: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">📄 Materials Submission Reminder</h2>
                <p>Dear {{presenter_name}},</p>
                <p>This is a reminder to submit your materials for the upcoming Journal Club session:</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #374151;">{{meeting_title}}</h3>
                    <p><strong>Topic:</strong> {{topic}}</p>
                    <p><strong>Meeting Date:</strong> {{meeting_date}} at {{meeting_time}}</p>
                    <p><strong>Materials Deadline:</strong> <span style="color: #dc2626; font-weight: bold;">{{materials_deadline}}</span></p>
                </div>
                
                <div style="background-color: {{#if is_overdue}}#fef2f2{{else}}#fffbeb{{/if}}; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    {{#if is_overdue}}
                    <h4 style="margin-top: 0; color: #dc2626;">⚠️ Materials Overdue</h4>
                    <p style="color: #dc2626;">Your materials submission is overdue. Please submit them as soon as possible.</p>
                    {{else}}
                    <h4 style="margin-top: 0; color: #d97706;">⏰ Deadline Approaching</h4>
                    <p style="color: #d97706;">Please submit your materials before the deadline to ensure team members have time to review.</p>
                    {{/if}}
                </div>
                
                <div style="margin: 30px 0;">
                    <h4>How to Submit:</h4>
                    <ul>
                        <li>Log into the Laboratory Schedule Management System</li>
                        <li>Navigate to your assigned meeting</li>
                        <li>Upload files or provide article URLs</li>
                        <li>Click "Submit Materials" when ready</li>
                    </ul>
                </div>
                
                <p>If you have any questions or technical issues, please contact the lab administrator.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        This reminder will be sent daily until materials are submitted.
                    </p>
                </div>
            </div>
        `,
        text_content: `
            Materials Submission Reminder
            
            Dear {{presenter_name}},
            
            This is a reminder to submit your materials for the upcoming Journal Club session:
            
            {{meeting_title}}
            Topic: {{topic}}
            Meeting Date: {{meeting_date}} at {{meeting_time}}
            Materials Deadline: {{materials_deadline}}
            
            {{#if is_overdue}}
            ⚠️ Your materials submission is overdue. Please submit them as soon as possible.
            {{else}}
            ⏰ Please submit your materials before the deadline to ensure team members have time to review.
            {{/if}}
            
            How to Submit:
            1. Log into the Laboratory Schedule Management System
            2. Navigate to your assigned meeting
            3. Upload files or provide article URLs
            4. Click "Submit Materials" when ready
            
            If you have any questions or technical issues, please contact the lab administrator.
            
            ---
            This reminder will be sent daily until materials are submitted.
        `,
        variables: ['presenter_name', 'meeting_title', 'topic', 'meeting_date', 'meeting_time', 'materials_deadline', 'is_overdue']
    },

    PRE_MEETING_REMINDER: {
        id: 'pre_meeting_reminder',
        name: 'Pre-Meeting Reminder',
        subject: 'Meeting reminder: {{meeting_title}} in 1 hour',
        html_content: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">🔔 Meeting Reminder</h2>
                <p>Dear Team,</p>
                <p>This is a reminder that we have a group meeting starting in <strong>1 hour</strong>:</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #374151;">{{meeting_title}}</h3>
                    <p><strong>Topic:</strong> {{topic}}</p>
                    <p><strong>Time:</strong> {{meeting_time}}</p>
                    <p><strong>Location:</strong> {{location}}</p>
                    {{#if presenter_name}}
                    <p><strong>Presenter:</strong> {{presenter_name}}</p>
                    {{/if}}
                </div>
                
                {{#if is_journal_club}}
                {{#if materials_available}}
                <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #065f46;">📚 Materials Available</h4>
                    <p>Materials for this Journal Club session have been provided. Please review them before the meeting.</p>
                </div>
                {{else}}
                <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #92400e;">⚠️ Materials Pending</h4>
                    <p>Materials for this Journal Club session are still pending. The presenter will provide updates during the meeting.</p>
                </div>
                {{/if}}
                {{/if}}
                
                <p>See you there!</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        This is an automated reminder from the Laboratory Schedule Management System.
                    </p>
                </div>
            </div>
        `,
        text_content: `
            Meeting Reminder
            
            Dear Team,
            
            This is a reminder that we have a group meeting starting in 1 hour:
            
            {{meeting_title}}
            Topic: {{topic}}
            Time: {{meeting_time}}
            Location: {{location}}
            {{#if presenter_name}}
            Presenter: {{presenter_name}}
            {{/if}}
            
            {{#if is_journal_club}}
            {{#if materials_available}}
            📚 Materials for this Journal Club session have been provided. Please review them before the meeting.
            {{else}}
            ⚠️ Materials for this Journal Club session are still pending. The presenter will provide updates during the meeting.
            {{/if}}
            {{/if}}
            
            See you there!
            
            ---
            This is an automated reminder from the Laboratory Schedule Management System.
        `,
        variables: ['meeting_title', 'topic', 'meeting_time', 'location', 'presenter_name', 'is_journal_club', 'materials_available']
    },

    SWAP_REQUEST_NOTIFICATION: {
        id: 'swap_request_notification',
        name: 'Swap Request Notification',
        subject: 'Swap request: {{from_presenter_name}} wants to swap with you',
        html_content: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">🔄 Swap Request</h2>
                <p>Dear {{to_presenter_name}},</p>
                <p>You have received a presentation swap request from <strong>{{from_presenter_name}}</strong>:</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #374151;">Swap Details</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                        <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px;">
                            <h4 style="margin-top: 0; color: #dc2626;">{{from_presenter_name}}'s Meeting</h4>
                            <p><strong>Date:</strong> {{from_meeting_date}}</p>
                            <p><strong>Topic:</strong> {{from_meeting_topic}}</p>
                        </div>
                        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px;">
                            <h4 style="margin-top: 0; color: #16a34a;">Your Meeting</h4>
                            <p><strong>Date:</strong> {{to_meeting_date}}</p>
                            <p><strong>Topic:</strong> {{to_meeting_topic}}</p>
                        </div>
                    </div>
                </div>
                
                {{#if reason}}
                <div style="background-color: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #d97706;">Reason for Swap</h4>
                    <p style="font-style: italic;">"{{reason}}"</p>
                </div>
                {{/if}}
                
                <div style="margin: 30px 0;">
                    <h4>Next Steps:</h4>
                    <p>This request requires admin approval. You will be notified of the decision once it has been reviewed.</p>
                    <p>If you have any concerns about this swap request, please contact the lab administrator.</p>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        Request submitted on {{request_date}}
                    </p>
                </div>
            </div>
        `,
        text_content: `
            Swap Request
            
            Dear {{to_presenter_name}},
            
            You have received a presentation swap request from {{from_presenter_name}}:
            
            Swap Details:
            
            {{from_presenter_name}}'s Meeting:
            Date: {{from_meeting_date}}
            Topic: {{from_meeting_topic}}
            
            Your Meeting:
            Date: {{to_meeting_date}}
            Topic: {{to_meeting_topic}}
            
            {{#if reason}}
            Reason for Swap:
            "{{reason}}"
            {{/if}}
            
            Next Steps:
            This request requires admin approval. You will be notified of the decision once it has been reviewed.
            If you have any concerns about this swap request, please contact the lab administrator.
            
            ---
            Request submitted on {{request_date}}
        `,
        variables: ['to_presenter_name', 'from_presenter_name', 'from_meeting_date', 'from_meeting_topic', 'to_meeting_date', 'to_meeting_topic', 'reason', 'request_date']
    },

    SWAP_APPROVED_NOTIFICATION: {
        id: 'swap_approved_notification',
        name: 'Swap Request Approved',
        subject: 'Approved: Your swap request with {{other_presenter_name}}',
        html_content: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #16a34a;">✅ Swap Request Approved</h2>
                <p>Dear {{presenter_name}},</p>
                <p>Your presentation swap request has been <strong>approved</strong>!</p>
                
                <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #374151;">New Assignment</h3>
                    <p>You are now scheduled to present:</p>
                    <p><strong>Date:</strong> {{new_meeting_date}}</p>
                    <p><strong>Topic:</strong> {{new_meeting_topic}}</p>
                    <p><strong>Time:</strong> {{new_meeting_time}}</p>
                    <p><strong>Location:</strong> {{new_meeting_location}}</p>
                </div>
                
                {{#if admin_notes}}
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #374151;">Admin Notes</h4>
                    <p>{{admin_notes}}</p>
                </div>
                {{/if}}
                
                <p>Please update your calendar accordingly. If you have any questions, contact the lab administrator.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        Approved on {{approval_date}}
                    </p>
                </div>
            </div>
        `,
        text_content: `
            Swap Request Approved
            
            Dear {{presenter_name}},
            
            Your presentation swap request has been approved!
            
            New Assignment:
            Date: {{new_meeting_date}}
            Topic: {{new_meeting_topic}}
            Time: {{new_meeting_time}}
            Location: {{new_meeting_location}}
            
            {{#if admin_notes}}
            Admin Notes:
            {{admin_notes}}
            {{/if}}
            
            Please update your calendar accordingly. If you have any questions, contact the lab administrator.
            
            ---
            Approved on {{approval_date}}
        `,
        variables: ['presenter_name', 'other_presenter_name', 'new_meeting_date', 'new_meeting_topic', 'new_meeting_time', 'new_meeting_location', 'admin_notes', 'approval_date']
    },

    MATERIALS_SUBMITTED_NOTIFICATION: {
        id: 'materials_submitted_notification',
        name: 'Materials Submitted Notification',
        subject: 'Materials available for {{meeting_title}}',
        html_content: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #16a34a;">📚 Materials Available</h2>
                <p>Dear Team,</p>
                <p>Materials for the upcoming Journal Club session have been submitted:</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #374151;">{{meeting_title}}</h3>
                    <p><strong>Topic:</strong> {{topic}}</p>
                    <p><strong>Date:</strong> {{meeting_date}} at {{meeting_time}}</p>
                    <p><strong>Presenter:</strong> {{presenter_name}}</p>
                </div>
                
                <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #065f46;">📖 Please Review</h4>
                    <p>The materials are now available in the scheduling system. Please review them before the meeting to facilitate discussion.</p>
                </div>
                
                <p>Access the materials through the Laboratory Schedule Management System or check your email for direct links.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        Materials submitted on {{submission_date}}
                    </p>
                </div>
            </div>
        `,
        text_content: `
            Materials Available
            
            Dear Team,
            
            Materials for the upcoming Journal Club session have been submitted:
            
            {{meeting_title}}
            Topic: {{topic}}
            Date: {{meeting_date}} at {{meeting_time}}
            Presenter: {{presenter_name}}
            
            📖 Please review the materials before the meeting to facilitate discussion.
            
            Access the materials through the Laboratory Schedule Management System or check your email for direct links.
            
            ---
            Materials submitted on {{submission_date}}
        `,
        variables: ['meeting_title', 'topic', 'meeting_date', 'meeting_time', 'presenter_name', 'submission_date']
    }
};

// Notification Service Class
export class GroupMeetingNotificationService {
    private baseUrl: string;
    private token: string;

    constructor(baseUrl: string, token: string) {
        this.baseUrl = baseUrl;
        this.token = token;
    }

    // Send immediate notification
    async sendNotification(
        templateId: string,
        recipients: string[],
        context: Record<string, any>
    ): Promise<EmailNotification[]> {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }

        const response = await fetch(`${this.baseUrl}/notifications/send/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                template_id: templateId,
                recipients,
                context,
                subject: this.renderTemplate(template.subject, context),
                html_content: this.renderTemplate(template.html_content, context),
                text_content: this.renderTemplate(template.text_content, context)
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to send notification: ${response.statusText}`);
        }

        return response.json();
    }

    // Schedule notification for future delivery
    async scheduleNotification(
        templateId: string,
        recipients: string[],
        context: Record<string, any>,
        scheduledFor: string
    ): Promise<EmailNotification[]> {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }

        const response = await fetch(`${this.baseUrl}/notifications/schedule/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                template_id: templateId,
                recipients,
                context,
                scheduled_for: scheduledFor,
                subject: this.renderTemplate(template.subject, context),
                html_content: this.renderTemplate(template.html_content, context),
                text_content: this.renderTemplate(template.text_content, context)
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to schedule notification: ${response.statusText}`);
        }

        return response.json();
    }

    // Schedule all notifications for a meeting
    async scheduleMeetingNotifications(
        meetingId: number,
        meetingData: {
            title: string;
            topic: string;
            date: string;
            start_time: string;
            location: string;
            meeting_type: string;
            presenter: { name: string; email: string };
            materials_deadline?: string;
            team_emails: string[];
        }
    ): Promise<NotificationSchedule[]> {
        const schedules: NotificationSchedule[] = [];
        const meetingDateTime = new Date(`${meetingData.date}T${meetingData.start_time}`);

        // 1. Presenter assignment notification (immediate)
        await this.sendNotification('presenter_assignment', [meetingData.presenter.email], {
            presenter_name: meetingData.presenter.name,
            meeting_title: meetingData.title,
            topic: meetingData.topic,
            meeting_date: this.formatDate(meetingData.date),
            meeting_time: meetingData.start_time,
            location: meetingData.location,
            is_journal_club: meetingData.meeting_type === 'journal_club',
            materials_deadline: meetingData.materials_deadline ? this.formatDate(meetingData.materials_deadline) : null
        });

        // 2. Materials submission reminders (for journal club)
        if (meetingData.meeting_type === 'journal_club' && meetingData.materials_deadline) {
            const deadlineDate = new Date(meetingData.materials_deadline);
            
            // Reminder 1 week before deadline
            const weekBeforeDeadline = new Date(deadlineDate);
            weekBeforeDeadline.setDate(deadlineDate.getDate() - 7);
            
            schedules.push({
                meeting_id: meetingId,
                reminder_type: 'materials_submission',
                scheduled_for: weekBeforeDeadline.toISOString(),
                recipients: [meetingData.presenter.email],
                template_id: 'materials_submission_reminder',
                context: {
                    presenter_name: meetingData.presenter.name,
                    meeting_title: meetingData.title,
                    topic: meetingData.topic,
                    meeting_date: this.formatDate(meetingData.date),
                    meeting_time: meetingData.start_time,
                    materials_deadline: this.formatDate(meetingData.materials_deadline),
                    is_overdue: false
                }
            });

            // Daily reminders starting 3 days before deadline
            for (let i = 3; i >= 1; i--) {
                const reminderDate = new Date(deadlineDate);
                reminderDate.setDate(deadlineDate.getDate() - i);
                
                schedules.push({
                    meeting_id: meetingId,
                    reminder_type: 'materials_submission',
                    scheduled_for: reminderDate.toISOString(),
                    recipients: [meetingData.presenter.email],
                    template_id: 'materials_submission_reminder',
                    context: {
                        presenter_name: meetingData.presenter.name,
                        meeting_title: meetingData.title,
                        topic: meetingData.topic,
                        meeting_date: this.formatDate(meetingData.date),
                        meeting_time: meetingData.start_time,
                        materials_deadline: this.formatDate(meetingData.materials_deadline),
                        is_overdue: false
                    }
                });
            }
        }

        // 3. Pre-meeting reminder (1 hour before)
        const preMeetingReminder = new Date(meetingDateTime);
        preMeetingReminder.setHours(preMeetingReminder.getHours() - 1);
        
        schedules.push({
            meeting_id: meetingId,
            reminder_type: 'pre_meeting',
            scheduled_for: preMeetingReminder.toISOString(),
            recipients: meetingData.team_emails,
            template_id: 'pre_meeting_reminder',
            context: {
                meeting_title: meetingData.title,
                topic: meetingData.topic,
                meeting_time: meetingData.start_time,
                location: meetingData.location,
                presenter_name: meetingData.presenter.name,
                is_journal_club: meetingData.meeting_type === 'journal_club',
                materials_available: false // This would be updated when materials are submitted
            }
        });

        // Schedule all notifications
        for (const schedule of schedules) {
            await this.scheduleNotification(
                schedule.template_id,
                schedule.recipients,
                schedule.context,
                schedule.scheduled_for
            );
        }

        return schedules;
    }

    // Send swap request notifications
    async sendSwapNotifications(swapRequest: {
        from_presenter: { name: string; email: string };
        to_presenter: { name: string; email: string };
        from_meeting: { date: string; topic: string };
        to_meeting: { date: string; topic: string };
        reason?: string;
        requested_at: string;
    }): Promise<void> {
        await this.sendNotification('swap_request_notification', [swapRequest.to_presenter.email], {
            to_presenter_name: swapRequest.to_presenter.name,
            from_presenter_name: swapRequest.from_presenter.name,
            from_meeting_date: this.formatDate(swapRequest.from_meeting.date),
            from_meeting_topic: swapRequest.from_meeting.topic,
            to_meeting_date: this.formatDate(swapRequest.to_meeting.date),
            to_meeting_topic: swapRequest.to_meeting.topic,
            reason: swapRequest.reason,
            request_date: this.formatDate(swapRequest.requested_at)
        });
    }

    // Send materials submitted notification
    async sendMaterialsSubmittedNotification(
        teamEmails: string[],
        meetingData: {
            title: string;
            topic: string;
            date: string;
            start_time: string;
            presenter_name: string;
            submitted_at: string;
        }
    ): Promise<void> {
        await this.sendNotification('materials_submitted_notification', teamEmails, {
            meeting_title: meetingData.title,
            topic: meetingData.topic,
            meeting_date: this.formatDate(meetingData.date),
            meeting_time: meetingData.start_time,
            presenter_name: meetingData.presenter_name,
            submission_date: this.formatDate(meetingData.submitted_at)
        });
    }

    // Utility methods
    private getTemplate(templateId: string): EmailTemplate | null {
        const templateKey = Object.keys(EMAIL_TEMPLATES).find(
            key => EMAIL_TEMPLATES[key as keyof typeof EMAIL_TEMPLATES].id === templateId
        );
        return templateKey ? EMAIL_TEMPLATES[templateKey as keyof typeof EMAIL_TEMPLATES] : null;
    }

    private renderTemplate(template: string, context: Record<string, any>): string {
        // Simple template rendering - in a real implementation, use a proper template engine like Handlebars
        let rendered = template;
        
        // Replace simple variables
        Object.keys(context).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            rendered = rendered.replace(regex, context[key] || '');
        });

        // Handle conditional blocks (basic implementation)
        rendered = rendered.replace(/{{#if (\w+)}}([\s\S]*?){{\/if}}/g, (match, variable, content) => {
            return context[variable] ? content : '';
        });

        rendered = rendered.replace(/{{#unless (\w+)}}([\s\S]*?){{\/unless}}/g, (match, variable, content) => {
            return !context[variable] ? content : '';
        });

        return rendered;
    }

    private formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('en-US', {
            timeZone: EASTERN_TIME_ZONE,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// Helper functions for easy integration
export const createNotificationService = (baseUrl: string, token: string) => {
    return new GroupMeetingNotificationService(baseUrl, token);
};

export const getAvailableTemplates = () => {
    return Object.values(EMAIL_TEMPLATES);
};

export const validateTemplateContext = (templateId: string, context: Record<string, any>): { isValid: boolean; missingVariables: string[] } => {
    const template = Object.values(EMAIL_TEMPLATES).find(t => t.id === templateId);
    if (!template) {
        return { isValid: false, missingVariables: ['Template not found'] };
    }

    const missingVariables = template.variables.filter(variable => 
        context[variable] === undefined || context[variable] === null
    );

    return {
        isValid: missingVariables.length === 0,
        missingVariables
    };
};