from django.http import JsonResponse, HttpResponseForbidden, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

from schedule.services import MeetingNotificationService


def _is_authorized(request) -> bool:
    """Authorize by App Engine Cron header or admin token in header/query.

    - Allow if X-Appengine-Cron header is present (GAE Cron)
    - Or if Authorization: Token <ADMIN_MANAGE_TOKEN> matches
    - Or if ?token=<ADMIN_MANAGE_TOKEN> matches
    """
    # App Engine Cron header
    if request.META.get('HTTP_X_APPENGINE_CRON') == 'true':
        return True

    # Configurable admin token (do not hardcode here)
    admin_token = getattr(settings, 'ADMIN_MANAGE_TOKEN', None)
    if not admin_token:
        return False

    auth_header = request.headers.get('Authorization', '')
    if auth_header == f"Token {admin_token}":
        return True

    query_token = request.GET.get('token')
    if query_token and query_token == admin_token:
        return True

    return False


@csrf_exempt
def send_meeting_reminders(request):
    """HTTP endpoint for cron to trigger meeting reminders aggregation.

    Note: This endpoint currently aggregates deadlines/reminders/overdue data
    and returns counts. Actual email dispatch should be invoked by the
    management command or extended here if needed.
    """
    if request.method not in ['GET', 'POST']:
        return HttpResponseNotAllowed(['GET', 'POST'])

    if not _is_authorized(request):
        return HttpResponseForbidden('Forbidden')

    service = MeetingNotificationService()

    deadlines = service.get_journal_club_deadlines()
    reminders = service.get_meeting_reminders()
    overdue = service.get_overdue_submissions()

    return JsonResponse({
        'ok': True,
        'journal_club_deadlines': len(deadlines),
        'meeting_24h_reminders': len(reminders),
        'overdue_submissions': len(overdue),
    })


