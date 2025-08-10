# Laboratory Task Management System - Implementation Guide

## Overview

This document outlines the completely refactored Laboratory Task Management system that provides a clean separation between **Recurring Tasks** and **One-Time Tasks** with comprehensive workflows for both scenarios.

## Key Features

### 1. Task Type Separation
- **Recurring Tasks**: Automated laboratory maintenance tasks (e.g., cell culture room cleaning)
- **One-Time Tasks**: Ad-hoc tasks that can be claimed by lab members (e.g., picking up deliveries)

### 2. User Scenarios Supported

#### Recurring Task Example: Cell Culture Room Cleaning
- **Setup**: Monthly recurring task with specific assignee group
- **Assignment**: Rotate between 2 people from designated list
- **Notifications**: Email reminders during final week of each month
- **Completion**: Assigned users confirm task completion

#### One-Time Task Example: Lab Supply Pickup
- **Creation**: Admin posts a task with deadline
- **Notification**: Email sent to all eligible lab members
- **Claiming**: First person to claim gets the task (status: In Progress)
- **Completion**: Claimer confirms completion when done

## Architecture

### Frontend Components

```
src/components/
├── ImprovedTaskManager.tsx          # Main task management interface
├── TaskCreationModal.tsx           # Comprehensive task creation wizard
└── AuthContext.tsx                 # Authentication context

src/modals/
└── TaskCreationModal.tsx           # Step-by-step task creation modal

src/services/
└── taskNotificationApi.ts          # Notification and email services
```

### Backend Models

```
bio-inventory-backend/schedule/
└── task_models.py                  # Enhanced task management models
```

## Implementation Details

### 1. Frontend Components

#### ImprovedTaskManager Component
- **Purpose**: Main interface for task management
- **Features**:
  - Tabbed interface (Active Tasks, My Tasks, Task Templates)
  - Quick statistics dashboard
  - Available one-time tasks for claiming
  - Task completion workflows
- **Integration**: Replaces existing RecurringTaskManager in SchedulePage.tsx

#### TaskCreationModal Component
- **Purpose**: Multi-step wizard for creating both task types
- **Features**:
  - Step 1: Basic Information (name, description, priority)
  - Step 2: Scheduling (frequency for recurring, execution window for one-time)
  - Step 3: Assignment Configuration (people requirements, eligible users)
  - Step 4: Additional Settings (recurring only - notifications, auto-assignment)
- **Validation**: Client-side validation with real-time error feedback

### 2. Backend Models

#### TaskTemplate Model
```python
# Core template for both recurring and one-time tasks
class TaskTemplate(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField()
    task_type = models.CharField(choices=[('recurring', 'Recurring'), ('one_time', 'One-Time')])
    priority = models.CharField(choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High')])
    # ... additional fields
```

#### TaskInstance Model
```python
# Individual task instances created from templates
class TaskInstance(models.Model):
    template = models.ForeignKey(TaskTemplate, on_delete=models.CASCADE)
    status = models.CharField(choices=[('scheduled', 'Scheduled'), ('pending', 'Pending'), ...])
    current_assignees = models.ManyToManyField(User)
    execution_start_date = models.DateField()
    execution_end_date = models.DateField()
    # ... completion tracking fields
```

### 3. Notification System

#### Features
- Email notifications for task assignments
- Reminder emails based on configurable schedules
- Overdue task alerts
- Task completion confirmations

#### Templates
```python
# Example notification templates
generateTaskAssignmentEmail(taskName, dueDate, assignedBy)
generateTaskReminderEmail(taskName, dueDate, daysUntilDue)
generateOverdueTaskEmail(taskName, dueDate, daysPastDue)
```

## User Workflows

### Creating a Recurring Task (Admin)

1. **Click "New Recurring Task"**
2. **Step 1 - Basic Info**:
   - Enter task name (e.g., "Cell Culture Room Weekly Cleaning")
   - Add detailed description with instructions
   - Set priority level

3. **Step 2 - Scheduling**:
   - Select frequency (weekly, monthly, quarterly)
   - Set start date and optional end date
   - Configure interval (every N periods)

4. **Step 3 - Assignment**:
   - Set min/max people requirements (e.g., 2 people)
   - Select eligible lab members from checklist
   - Preview assignment rotation

5. **Step 4 - Settings**:
   - Set estimated hours
   - Configure reminder schedule (e.g., 1 day before)
   - Enable auto-assignment and email notifications

### Creating a One-Time Task (Admin)

1. **Click "New One-Time Task"**
2. **Step 1 - Basic Info**:
   - Enter task name (e.g., "Pick up lab supplies from main office")
   - Add specific instructions and location details
   - Set priority level

3. **Step 2 - Execution Window**:
   - Set "Available From" date (when task can be claimed)
   - Set "Must Complete By" date (deadline)

4. **Step 3 - Assignment**:
   - Set people requirements (typically 1 person)
   - Select eligible claimants
   - Task will be available for claiming by selected users

### Claiming a One-Time Task (Lab Member)

1. **View Available Tasks**: Check "Available Tasks to Claim" section
2. **Review Details**: See task description, deadline, estimated time
3. **Claim Task**: Click "Claim Task" button
4. **Status Change**: Task moves to "In Progress" status
5. **Complete Task**: Mark as complete when finished

### Managing Recurring Tasks

1. **View Task Templates**: Admin can see all configured recurring tasks
2. **Edit Participants**: Update who can be assigned to tasks
3. **Auto-Generation**: System creates monthly task instances automatically
4. **Assignment Rotation**: System rotates assignments among eligible users
5. **Reminder System**: Automated email reminders before due dates

## Integration with Existing System

### SchedulePage.tsx Changes
```typescript
// Replace existing RecurringTaskManager with ImprovedTaskManager
{activeTab === 'tasks' && (
    <ImprovedTaskManager />
)}
```

### API Compatibility
- Uses existing Django REST Framework patterns
- Compatible with current authentication system
- Leverages existing user management
- Integrates with current notification system

### Database Integration
- New models complement existing schedule models
- Uses existing User model for assignments
- Maintains data consistency with foreign keys
- Includes proper indexing for performance

## Configuration

### Email Templates
Location: `bio-inventory-backend/templates/notifications/emails/`
- `task_assignment_notification.html`
- `task_upcoming_reminder.html` 
- `task_overdue_reminder.html`
- `one_time_task_created.html`
- `one_time_task_claimed.html`

### API Endpoints
```
/api/schedule/task-templates/         # Task template CRUD
/api/schedule/periodic-tasks/         # Task instance management
/api/schedule/periodic-tasks/{id}/claim/      # Claim one-time task
/api/schedule/periodic-tasks/{id}/complete/   # Complete task
/api/schedule/notifications/          # Notification management
```

## Testing and Validation

### Frontend Testing
1. **Component Rendering**: Verify all components render correctly
2. **Task Creation**: Test both recurring and one-time task creation flows
3. **Task Claiming**: Verify one-time task claiming workflow
4. **Task Completion**: Test task completion functionality
5. **Notification Settings**: Verify user notification preferences

### Backend Testing
1. **Model Validation**: Test all model constraints and validations
2. **API Endpoints**: Verify CRUD operations for all entities
3. **Rotation Logic**: Test assignment rotation for recurring tasks
4. **Notification Scheduling**: Verify email scheduling and delivery
5. **Permission Checking**: Ensure proper access controls

### Integration Testing
1. **End-to-End Workflows**: Test complete user journeys
2. **Cross-Component Communication**: Verify component interactions
3. **Database Consistency**: Ensure data integrity across operations
4. **Email Delivery**: Test actual email sending (in staging)

## Deployment Considerations

### Database Migrations
```bash
python manage.py makemigrations schedule
python manage.py migrate
```

### Static Files
```bash
python manage.py collectstatic
```

### Email Configuration
Ensure SMTP settings are properly configured for notification delivery.

### Monitoring
- Set up monitoring for email delivery rates
- Monitor task completion rates
- Track user engagement with the new system

## Future Enhancements

### Potential Improvements
1. **Mobile App Integration**: Extend to mobile interface
2. **Calendar Integration**: Sync with external calendar systems
3. **Advanced Rotation Algorithms**: More sophisticated assignment logic
4. **Reporting Dashboard**: Analytics on task completion and user activity
5. **Slack/Teams Integration**: Alternative notification channels
6. **QR Code Integration**: Link tasks to physical equipment/locations

### Scalability Considerations
1. **Caching**: Implement Redis caching for frequently accessed data
2. **Background Jobs**: Move email sending to background task queue
3. **API Rate Limiting**: Prevent abuse of API endpoints
4. **Database Optimization**: Add more indexes as usage grows

## Conclusion

This refactored task management system provides a comprehensive solution for laboratory task management with clear separation of concerns, intuitive user interfaces, and robust backend support. The implementation follows Django best practices and integrates seamlessly with the existing Quartzy system architecture.

The system successfully addresses the original requirements:
- ✅ Clean separation of recurring vs one-time tasks
- ✅ Automated rotation for recurring tasks with email reminders
- ✅ One-time task claiming system with status tracking
- ✅ Comprehensive notification system
- ✅ Admin controls for task configuration
- ✅ User-friendly interfaces for all workflows

This implementation provides a solid foundation for laboratory task management that can scale with the organization's needs.