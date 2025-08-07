# Required Email Templates for Periodic Task Management System

This document lists all the email templates that need to be manually created for the periodic task management system. These templates should be created in the `bio-inventory-backend/templates/notifications/emails/` directory.

## Template Directory Structure

```
bio-inventory-backend/templates/notifications/emails/
├── task_assignment_notification.html
├── task_reminder.html
├── task_overdue_reminder.html
├── task_completion_notification.html
├── swap_request_notification.html
├── swap_approved_notification.html
├── swap_rejected_notification.html
├── public_pool_notification.html
└── admin_task_notification.html
```

## 1. Task Assignment Notification
**File**: `task_assignment_notification.html`  
**Sent to**: Assigned users when a new task is created  
**Context variables**:
- `user`: User object
- `task`: PeriodicTaskInstance object
- `template`: TaskTemplate object
- `partners`: List of other assigned users
- `task_url`: Link to task details
- `execution_window`: Dict with start_date and end_date

**Subject**: `New Task Assignment: {{ template.name }}`

**Required content**:
- Welcome message with user's name
- Task name and description
- Execution period and window
- List of assigned partners
- Estimated hours (if available)
- Instructions for task completion
- Link to task details page
- Instructions for swap requests if needed

## 2. Task Reminder
**File**: `task_reminder.html`  
**Sent to**: Assigned users when execution window starts  
**Context variables**:
- `user`: User object
- `task`: PeriodicTaskInstance object
- `days_remaining`: Number of days left in execution window
- `task_url`: Link to task details

**Subject**: `Task Reminder: {{ task.template_name }} - {{ task.scheduled_period }}`

**Required content**:
- Reminder that execution window has started
- Task details and execution window
- Days remaining to complete
- Instructions for marking task as complete
- Link to task details page

## 3. Task Overdue Reminder
**File**: `task_overdue_reminder.html`  
**Sent to**: Assigned users and admins when task becomes overdue  
**Context variables**:
- `user`: User object
- `task`: PeriodicTaskInstance object
- `days_overdue`: Number of days past deadline
- `task_url`: Link to task details

**Subject**: `OVERDUE: {{ task.template_name }} - {{ task.scheduled_period }}`

**Required content**:
- Urgent notice that task is overdue
- Task details and original deadline
- Number of days overdue
- Instructions for immediate completion
- Contact information for admin assistance

## 4. Task Completion Notification
**File**: `task_completion_notification.html`  
**Sent to**: Admins when a task is completed  
**Context variables**:
- `task`: PeriodicTaskInstance object
- `completed_by`: User who completed the task
- `completion_data`: Dict with notes, duration, rating, etc.
- `task_url`: Link to task details

**Subject**: `Task Completed: {{ task.template_name }} - {{ task.scheduled_period }}`

**Required content**:
- Notification that task has been completed
- Who completed the task and when
- Completion details (duration, notes, rating)
- Link to task details for review

## 5. Swap Request Notification
**File**: `swap_request_notification.html`  
**Sent to**: Target user when someone requests a task swap  
**Context variables**:
- `user`: Target user
- `swap_request`: TaskSwapRequest object
- `from_user`: User requesting the swap
- `task`: PeriodicTaskInstance object
- `reason`: Reason for swap request
- `approve_url`: Link to approve request
- `reject_url`: Link to reject request

**Subject**: `Task Swap Request from {{ from_user.username }}`

**Required content**:
- Notification of incoming swap request
- Task details and requester information
- Reason for swap request
- Instructions for approving or rejecting
- Links to approve/reject the request
- Deadline for response if applicable

## 6. Swap Approved Notification
**File**: `swap_approved_notification.html`  
**Sent to**: Both users when a swap is approved and executed  
**Context variables**:
- `user`: Recipient user
- `swap_request`: TaskSwapRequest object
- `task`: PeriodicTaskInstance object
- `other_user`: The other user involved in swap
- `task_url`: Link to task details

**Subject**: `Task Swap Confirmed: {{ task.template_name }}`

**Required content**:
- Confirmation that swap has been approved
- Updated task assignment details
- New partner information if applicable
- Link to updated task details
- Thank you message for cooperation

## 7. Swap Rejected Notification
**File**: `swap_rejected_notification.html`  
**Sent to**: Requesting user when swap is rejected  
**Context variables**:
- `user`: Requesting user
- `swap_request`: TaskSwapRequest object
- `task`: PeriodicTaskInstance object
- `rejection_reason`: Reason for rejection (if provided)
- `task_url`: Link to task details

**Subject**: `Task Swap Request Declined`

**Required content**:
- Notification that swap request was declined
- Original task details (still assigned)
- Rejection reason if provided
- Alternative suggestions (public pool, admin contact)
- Link to original task

## 8. Public Pool Notification
**File**: `public_pool_notification.html`  
**Sent to**: All eligible users when a task is posted to public swap pool  
**Context variables**:
- `user`: Recipient user
- `task`: PeriodicTaskInstance object
- `requesting_user`: User who posted to pool
- `reason`: Reason for swap request
- `claim_url`: Link to claim the task
- `pool_url`: Link to view all pool requests

**Subject**: `Task Available in Swap Pool: {{ task.template_name }}`

**Required content**:
- Notification of task available for swap
- Task details and original assignee
- Reason for posting to pool
- Instructions for claiming the task
- Link to claim the task
- Link to view all available tasks

## 9. Admin Task Notification
**File**: `admin_task_notification.html`  
**Sent to**: Admins for various administrative notifications  
**Context variables**:
- `notification_type`: Type of admin notification
- `task`: PeriodicTaskInstance object (if applicable)
- `user`: Related user (if applicable)
- `details`: Additional details dict
- `action_url`: Link for admin action

**Subject**: `[Admin] {{ notification_type }}: Task System Update`

**Required content**:
- Administrative notification header
- Type of notification and details
- Related task and user information
- Required admin actions (if any)
- Link to admin dashboard or specific action

## Template Implementation Notes

### Common Variables Available in All Templates:
- `site_name`: Name of the lab/organization
- `site_url`: Base URL of the application
- `support_email`: Admin contact email
- `current_date`: Current date when email is sent

### Styling Guidelines:
- Use consistent branding with existing email templates
- Include lab logo if available
- Use clear, professional formatting
- Ensure mobile-friendly responsive design
- Include unsubscribe options where appropriate

### Localization:
- Templates should be in English as specified
- Date formats should use standard format (YYYY-MM-DD)
- Time formats should include timezone information

### Security Considerations:
- Never include sensitive information in email templates
- Use secure links with proper authentication
- Include warning about phishing if links are provided
- Add disclaimer about automated emails

## Integration with Django Email System

These templates will be used by the notification system in the Django application. The system will:

1. Load the appropriate template based on notification type
2. Render the template with the provided context variables
3. Send the email using Django's email backend
4. Log the notification in the NotificationRecord model

## Testing Templates

After creating the templates, test them using Django's email testing features:

```python
# In Django shell or test script
from django.template.loader import render_to_string
from django.core.mail import send_mail

# Test template rendering
html_content = render_to_string('notifications/emails/task_assignment_notification.html', {
    'user': user_instance,
    'task': task_instance,
    'template': template_instance,
    # ... other context variables
})

# Send test email
send_mail(
    subject='Test Task Assignment',
    message='',
    from_email='test@lab.example.com',
    recipient_list=['admin@lab.example.com'],
    html_message=html_content
)
```

This completes the documentation for all required email templates for the periodic task management system.