import csv
import hashlib
import re
from dataclasses import dataclass, field
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from funding.models import Fund, Transaction
from inventory_requests.models import Request, RequestHistory
from items.models import Item, ItemType, Vendor


DEFAULT_TOTAL_BUDGET = Decimal("1000000.00")
DEFAULT_ITEM_UNIT = "EA"
TEMP_PASSWORD = "HayerTemp@2026"
REQUEST_BARCODE_PREFIX = "REQCSV-"
ITEM_BARCODE_PREFIX = "ITMCSV-"
IMPORT_USER_EMAIL_DOMAIN = "hayer.local"


STATUS_MAP = {
    "NEW": Request.Status.NEW,
    "PENDING": Request.Status.NEW,
    "APPROVED": Request.Status.APPROVED,
    "ORDERED": Request.Status.ORDERED,
    "RECEIVED": Request.Status.RECEIVED,
    "REJECTED": Request.Status.REJECTED,
    "CANCELLED": Request.Status.CANCELLED,
    "CANCELED": Request.Status.CANCELLED,
    "BACKORDERED": Request.Status.ORDERED,
}


@dataclass
class ImportStats:
    users_created: int = 0
    funds_created: int = 0
    vendors_created: int = 0
    item_types_created: int = 0
    requests_created: int = 0
    requests_updated: int = 0
    items_created: int = 0
    items_updated: int = 0
    history_created: int = 0
    history_updated: int = 0
    transactions_created: int = 0
    transactions_updated: int = 0
    rows_processed: int = 0
    rows_skipped: int = 0
    reset_requests_deleted: int = 0
    reset_items_deleted: int = 0
    reset_transactions_deleted: int = 0
    errors: list[str] = field(default_factory=list)


class Command(BaseCommand):
    help = "Import and initialize local DB data from Hayer Lab's Order Requests CSV."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default=None,
            help="Path to CSV file. Defaults to repo root/Hayer Lab's Order Requests.csv",
        )
        parser.add_argument(
            "--execute",
            action="store_true",
            help="Persist changes. Default mode is dry-run.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate import and rollback all DB writes.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete previously imported rows (REQCSV-/ITMCSV-) before importing.",
        )

    def handle(self, *args, **options):
        execute = options["execute"]
        force_dry_run = options["dry_run"]
        if execute and force_dry_run:
            raise CommandError("Use either --execute or --dry-run, not both.")
        dry_run = not execute or force_dry_run

        csv_path = self._resolve_csv_path(options.get("file"))
        rows = self._read_csv_rows(csv_path)

        stats = ImportStats()
        with transaction.atomic():
            if options["reset"]:
                self._reset_imported_data(stats)
            self._import_rows(rows, stats)
            if dry_run:
                transaction.set_rollback(True)

        self._print_summary(stats, dry_run, csv_path)
        if stats.errors:
            raise CommandError("Import completed with errors. See summary above.")

    def _resolve_csv_path(self, arg_path):
        if arg_path:
            p = Path(arg_path).expanduser().resolve()
        else:
            # settings.BASE_DIR is backend root; CSV is one level above.
            backend_dir = Path(__file__).resolve().parents[3]
            p = (backend_dir.parent / "Hayer Lab's Order Requests.csv").resolve()
        if not p.exists():
            raise CommandError(f"CSV file not found: {p}")
        return p

    def _read_csv_rows(self, csv_path):
        with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        if not rows:
            raise CommandError("CSV has no data rows.")
        required_columns = [
            "Item Name",
            "Requested By",
            "Vendor",
            "Catalog #",
            "Type",
            "Qty",
            "Unit Price",
            "Status",
            "Date Requested",
        ]
        missing = [c for c in required_columns if c not in rows[0]]
        if missing:
            raise CommandError(f"CSV missing required columns: {', '.join(missing)}")
        return rows

    def _reset_imported_data(self, stats):
        imported_request_ids = list(
            Request.objects.filter(barcode__startswith=REQUEST_BARCODE_PREFIX).values_list("id", flat=True)
        )
        if imported_request_ids:
            deleted_tx, _ = Transaction.objects.filter(request_id__in=imported_request_ids).delete()
            stats.reset_transactions_deleted += deleted_tx

        deleted_items, _ = Item.objects.filter(barcode__startswith=ITEM_BARCODE_PREFIX).delete()
        deleted_requests, _ = Request.objects.filter(id__in=imported_request_ids).delete()

        stats.reset_items_deleted = deleted_items
        stats.reset_requests_deleted = deleted_requests

    def _import_rows(self, rows, stats):
        admin_user = self._ensure_admin_user(stats)
        user_map = self._ensure_users(rows, stats)
        fund_map = self._ensure_funds(rows, admin_user, stats)
        vendor_map = self._ensure_vendors(rows, stats)
        item_type_map = self._ensure_item_types(rows, stats)

        for line_no, row in enumerate(rows, start=2):
            try:
                self._import_single_row(
                    row,
                    line_no,
                    admin_user,
                    user_map,
                    fund_map,
                    vendor_map,
                    item_type_map,
                    stats,
                )
                stats.rows_processed += 1
            except Exception as exc:
                stats.errors.append(f"Line {line_no}: {exc}")
                stats.rows_skipped += 1

    def _import_single_row(
        self,
        row,
        line_no,
        admin_user,
        user_map,
        fund_map,
        vendor_map,
        item_type_map,
        stats,
    ):
        item_name = self._clean_text(row.get("Item Name"))
        requested_by_name = self._clean_name(row.get("Requested By"))
        vendor_name = self._clean_text(row.get("Vendor"))
        catalog_number = self._clean_text(row.get("Catalog #"))
        type_name = self._clean_text(row.get("Type")) or "General Supply"
        status = self._normalize_status(row.get("Status"))
        qty_int = self._parse_int(row.get("Qty"), required=True, field_name="Qty")
        unit_price = self._parse_decimal(row.get("Unit Price"), required=True, field_name="Unit Price")
        requested_date = self._parse_date(row.get("Date Requested"), required=True, field_name="Date Requested")
        approved_date = self._parse_date(row.get("Date Approved"))
        ordered_date = self._parse_date(row.get("Date Ordered"))
        received_date = self._parse_date(row.get("Date Received"))

        if not item_name:
            raise ValueError("Item Name is empty")
        if not requested_by_name:
            raise ValueError("Requested By is empty")

        requested_by = user_map.get(self._name_key(requested_by_name), admin_user)
        approved_by = user_map.get(self._name_key(row.get("Approved By")))
        ordered_by = user_map.get(self._name_key(row.get("Ordered By")))
        received_by = user_map.get(self._name_key(row.get("Received By")))

        vendor = vendor_map.get(self._vendor_key(vendor_name))
        item_type = item_type_map[self._type_key(type_name)]
        fund = fund_map.get(self._fund_key(row.get("Spend Tracking Code")))
        fund_id = fund.id if fund else None

        import_key = self._build_import_key(
            item_name=item_name,
            catalog_number=catalog_number,
            requested_by_name=requested_by_name,
            requested_date=requested_date,
            quantity=qty_int,
            unit_price=unit_price,
        )
        request_barcode = f"{REQUEST_BARCODE_PREFIX}{import_key}"
        item_barcode = f"{ITEM_BARCODE_PREFIX}{import_key}"

        request_notes = self._build_request_notes(row)
        request_obj = Request.objects.filter(barcode=request_barcode).first()
        if request_obj is None:
            request_obj = Request.objects.create(
                item_name=item_name,
                item_type=item_type,
                requested_by=requested_by,
                status=status,
                vendor=vendor,
                catalog_number=catalog_number or "",
                url=self._clean_text(row.get("URL")) or "",
                quantity=qty_int,
                unit_size=self._clean_text(row.get("Unit Size")) or "",
                unit_price=unit_price,
                fund_id=fund_id,
                barcode=request_barcode,
                notes=request_notes,
            )
            stats.requests_created += 1
        else:
            changed = self._update_model(
                request_obj,
                {
                    "item_name": item_name,
                    "item_type": item_type,
                    "requested_by": requested_by,
                    "status": status,
                    "vendor": vendor,
                    "catalog_number": catalog_number or "",
                    "url": self._clean_text(row.get("URL")) or "",
                    "quantity": qty_int,
                    "unit_size": self._clean_text(row.get("Unit Size")) or "",
                    "unit_price": unit_price,
                    "fund_id": fund_id,
                    "notes": request_notes,
                },
            )
            if changed:
                stats.requests_updated += 1

        self._sync_request_timestamps(request_obj, requested_date, approved_date, ordered_date, received_date)
        self._sync_request_history(
            request_obj=request_obj,
            approved_date=approved_date,
            ordered_date=ordered_date,
            received_date=received_date,
            requested_by=requested_by,
            approved_by=approved_by or requested_by,
            ordered_by=ordered_by or approved_by or requested_by,
            received_by=received_by or ordered_by or requested_by,
            row=row,
            stats=stats,
        )

        if status == Request.Status.RECEIVED:
            self._upsert_item_from_request(
                item_barcode=item_barcode,
                item_name=item_name,
                item_type=item_type,
                vendor=vendor,
                catalog_number=catalog_number or "",
                quantity=Decimal(qty_int),
                unit=self._clean_text(row.get("Unit Size")) or DEFAULT_ITEM_UNIT,
                owner=requested_by,
                price=unit_price,
                fund_id=fund_id,
                received_date=received_date,
                url=self._clean_text(row.get("URL")) or "",
                notes=request_notes,
                stats=stats,
            )

        if fund_id:
            self._upsert_transaction_for_request(request_obj, fund, requested_by, row, stats)

    def _ensure_admin_user(self, stats):
        admin_user = User.objects.filter(username="admin").first()
        if admin_user:
            return admin_user

        admin_user = User.objects.filter(is_superuser=True).first() or User.objects.first()
        if admin_user:
            return admin_user

        admin_user = User.objects.create_user(
            username="admin",
            email=f"admin@{IMPORT_USER_EMAIL_DOMAIN}",
            password=TEMP_PASSWORD,
            is_staff=True,
            is_superuser=True,
            is_active=True,
        )
        stats.users_created += 1
        return admin_user

    def _ensure_users(self, rows, stats):
        names = set()
        for row in rows:
            for col in ("Requested By", "Approved By", "Ordered By", "Received By"):
                val = self._clean_name(row.get(col))
                if val:
                    names.add(val)

        users_by_key = {}
        existing = list(User.objects.all())
        for u in existing:
            full = self._clean_name(f"{u.first_name} {u.last_name}")
            if full:
                users_by_key[self._name_key(full)] = u
            users_by_key[self._name_key(u.username)] = u
            if u.email:
                users_by_key[self._name_key(u.email)] = u

        for display_name in sorted(names):
            key = self._name_key(display_name)
            if key in users_by_key:
                continue

            first_name, last_name = self._split_name(display_name)
            username = self._make_unique_username(display_name)
            user = User.objects.create_user(
                username=username,
                email=f"{username}@{IMPORT_USER_EMAIL_DOMAIN}",
                password=TEMP_PASSWORD,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
            )
            users_by_key[key] = user
            stats.users_created += 1

        return users_by_key

    def _ensure_funds(self, rows, admin_user, stats):
        codes = {self._clean_text(row.get("Spend Tracking Code")) for row in rows}
        codes = {c for c in codes if c}
        fund_map = {}
        for code in sorted(codes):
            fund = Fund.objects.filter(name__iexact=code).first()
            if not fund:
                fund = Fund.objects.create(
                    name=code,
                    description=f"Seeded from Hayer CSV tracking code: {code}",
                    total_budget=DEFAULT_TOTAL_BUDGET,
                    funding_source="Imported CSV",
                    principal_investigator="Arnold Hayer",
                    created_by=admin_user,
                )
                stats.funds_created += 1
            fund_map[self._fund_key(code)] = fund
        return fund_map

    def _ensure_vendors(self, rows, stats):
        names = {self._clean_text(row.get("Vendor")) for row in rows}
        names = {n for n in names if n}
        vendor_map = {}
        for name in sorted(names):
            vendor = Vendor.objects.filter(name__iexact=name).first()
            if not vendor:
                vendor = Vendor.objects.create(name=name)
                stats.vendors_created += 1
            vendor_map[self._vendor_key(name)] = vendor
        return vendor_map

    def _ensure_item_types(self, rows, stats):
        names = {self._clean_text(row.get("Type")) or "General Supply" for row in rows}
        item_type_map = {}
        for name in sorted(names):
            item_type = ItemType.objects.filter(name__iexact=name).first()
            if not item_type:
                item_type = ItemType.objects.create(name=name)
                stats.item_types_created += 1
            item_type_map[self._type_key(name)] = item_type
        return item_type_map

    def _upsert_item_from_request(
        self,
        item_barcode,
        item_name,
        item_type,
        vendor,
        catalog_number,
        quantity,
        unit,
        owner,
        price,
        fund_id,
        received_date,
        url,
        notes,
        stats,
    ):
        item = Item.objects.filter(barcode=item_barcode).first()
        if item is None:
            Item.objects.create(
                name=item_name,
                item_type=item_type,
                vendor=vendor,
                catalog_number=catalog_number,
                quantity=quantity,
                unit=unit,
                owner=owner,
                price=price,
                fund_id=fund_id,
                received_date=received_date,
                url=url,
                barcode=item_barcode,
                storage_conditions=notes or "",
            )
            stats.items_created += 1
        else:
            changed = self._update_model(
                item,
                {
                    "name": item_name,
                    "item_type": item_type,
                    "vendor": vendor,
                    "catalog_number": catalog_number,
                    "quantity": quantity,
                    "unit": unit,
                    "owner": owner,
                    "price": price,
                    "fund_id": fund_id,
                    "received_date": received_date,
                    "url": url,
                    "storage_conditions": notes or "",
                    "is_archived": False,
                },
            )
            if changed:
                stats.items_updated += 1

    def _upsert_transaction_for_request(self, request_obj, fund, created_by, row, stats):
        amount = request_obj.unit_price * Decimal(request_obj.quantity)
        ref_number = self._clean_text(row.get("Invoice #")) or self._clean_text(row.get("PO #")) or None
        description = f"Imported purchase for {request_obj.item_name} (Request #{request_obj.id})"

        tx = Transaction.objects.filter(request_id=request_obj.id, transaction_type="purchase").first()
        if tx is None:
            Transaction.objects.create(
                fund=fund,
                amount=amount,
                transaction_type="purchase",
                item_name=request_obj.item_name,
                description=description,
                request_id=request_obj.id,
                reference_number=ref_number,
                created_by=created_by,
            )
            stats.transactions_created += 1
        else:
            changed = self._update_model(
                tx,
                {
                    "fund": fund,
                    "amount": amount,
                    "item_name": request_obj.item_name,
                    "description": description,
                    "reference_number": ref_number,
                    "created_by": created_by,
                },
            )
            if changed:
                stats.transactions_updated += 1

    def _sync_request_timestamps(self, request_obj, requested_date, approved_date, ordered_date, received_date):
        created_at = self._to_midday(requested_date)
        candidates = [d for d in [received_date, ordered_date, approved_date, requested_date] if d]
        updated_at = self._to_midday(candidates[0]) if candidates else created_at
        Request.objects.filter(pk=request_obj.pk).update(created_at=created_at, updated_at=updated_at)

    def _sync_request_history(
        self,
        request_obj,
        approved_date,
        ordered_date,
        received_date,
        requested_by,
        approved_by,
        ordered_by,
        received_by,
        row,
        stats,
    ):
        if approved_date:
            self._ensure_history(
                request_obj=request_obj,
                old_status=Request.Status.NEW,
                new_status=Request.Status.APPROVED,
                user=approved_by,
                history_date=approved_date,
                notes=self._clean_text(row.get("Approved Message")) or "",
                stats=stats,
            )

        if ordered_date:
            self._ensure_history(
                request_obj=request_obj,
                old_status=Request.Status.APPROVED,
                new_status=Request.Status.ORDERED,
                user=ordered_by,
                history_date=ordered_date,
                notes=self._clean_text(row.get("Ordered Message")) or "",
                stats=stats,
            )

        if received_date:
            self._ensure_history(
                request_obj=request_obj,
                old_status=Request.Status.ORDERED,
                new_status=Request.Status.RECEIVED,
                user=received_by,
                history_date=received_date,
                notes=self._clean_text(row.get("Received Message")) or "",
                stats=stats,
            )

        if not approved_date and request_obj.status in (Request.Status.APPROVED, Request.Status.ORDERED, Request.Status.RECEIVED):
            fallback_date = self._parse_date(row.get("Date Requested")) or timezone.now().date()
            self._ensure_history(
                request_obj=request_obj,
                old_status=Request.Status.NEW,
                new_status=Request.Status.APPROVED,
                user=approved_by or requested_by,
                history_date=fallback_date,
                notes="Auto-generated from imported terminal status.",
                stats=stats,
            )

    def _ensure_history(self, request_obj, old_status, new_status, user, history_date, notes, stats):
        history = RequestHistory.objects.filter(
            request=request_obj,
            old_status=old_status,
            new_status=new_status,
        ).first()

        if history is None:
            history = RequestHistory.objects.create(
                request=request_obj,
                user=user,
                old_status=old_status,
                new_status=new_status,
                notes=notes,
            )
            stats.history_created += 1
        else:
            changed = self._update_model(
                history,
                {
                    "user": user,
                    "notes": notes,
                },
            )
            if changed:
                stats.history_updated += 1

        RequestHistory.objects.filter(pk=history.pk).update(timestamp=self._to_midday(history_date))

    def _build_import_key(
        self,
        item_name,
        catalog_number,
        requested_by_name,
        requested_date,
        quantity,
        unit_price,
    ):
        raw = "||".join(
            [
                (item_name or "").strip().lower(),
                (catalog_number or "").strip().lower(),
                (requested_by_name or "").strip().lower(),
                requested_date.isoformat(),
                str(quantity),
                f"{unit_price:.2f}",
            ]
        )
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16].upper()

    def _build_request_notes(self, row):
        note_fields = [
            ("Other Details", row.get("Other Details")),
            ("Notes", row.get("Notes")),
            ("PO #", row.get("PO #")),
            ("Requisition #", row.get("Requisition #")),
            ("Confirmation #", row.get("Confirmation #")),
            ("Tracking #", row.get("Tracking #")),
            ("Bought From", row.get("Bought From")),
            ("Invoice #", row.get("Invoice #")),
            ("Invoice Total", row.get("Invoice Total")),
            ("Invoice Status", row.get("Invoice Status")),
        ]
        parts = []
        for label, value in note_fields:
            text = self._clean_text(value)
            if text:
                parts.append(f"{label}: {text}")
        return " | ".join(parts)

    def _update_model(self, instance, updates):
        changed = False
        for field_name, new_value in updates.items():
            if getattr(instance, field_name) != new_value:
                setattr(instance, field_name, new_value)
                changed = True
        if changed:
            instance.save()
        return changed

    def _normalize_status(self, value):
        key = self._clean_text(value).upper()
        return STATUS_MAP.get(key, Request.Status.NEW)

    def _parse_decimal(self, value, required=False, field_name="value"):
        text = self._clean_text(value)
        if not text:
            if required:
                raise ValueError(f"{field_name} is empty")
            return None
        cleaned = re.sub(r"[\$,£€¥,]", "", text)
        try:
            return Decimal(cleaned)
        except InvalidOperation as exc:
            raise ValueError(f"{field_name} is not a valid number: {text}") from exc

    def _parse_int(self, value, required=False, field_name="value"):
        dec = self._parse_decimal(value, required=required, field_name=field_name)
        if dec is None:
            return None
        return int(dec)

    def _parse_date(self, value, required=False, field_name="date"):
        text = self._clean_text(value)
        if not text:
            if required:
                raise ValueError(f"{field_name} is empty")
            return None
        for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue
        if required:
            raise ValueError(f"{field_name} has invalid format: {text}")
        return None

    def _to_midday(self, d):
        naive = datetime.combine(d, time(hour=12, minute=0, second=0))
        return timezone.make_aware(naive, timezone.get_current_timezone())

    def _clean_text(self, value):
        if value is None:
            return ""
        text = str(value).strip()
        if text.lower() in {"nan", "none"}:
            return ""
        return text

    def _clean_name(self, value):
        text = self._clean_text(value)
        if not text:
            return ""
        return " ".join(text.split())

    def _name_key(self, value):
        return self._clean_name(value).lower()

    def _vendor_key(self, value):
        return self._clean_text(value).lower()

    def _type_key(self, value):
        return self._clean_text(value).lower()

    def _fund_key(self, value):
        return self._clean_text(value).lower()

    def _split_name(self, display_name):
        parts = self._clean_name(display_name).split(" ")
        if len(parts) == 1:
            return parts[0].title(), ""
        first_name = parts[0].title()
        last_name = " ".join(parts[1:]).title()
        return first_name, last_name

    def _make_unique_username(self, display_name):
        first, last = self._split_name(display_name)
        if last:
            base = f"{first}.{last}".lower()
        else:
            base = first.lower()
        base = re.sub(r"[^a-z0-9]+", ".", base).strip(".") or "user"
        candidate = base
        suffix = 1
        while User.objects.filter(username=candidate).exists():
            suffix += 1
            candidate = f"{base}{suffix}"
        return candidate

    def _print_summary(self, stats, dry_run, csv_path):
        mode = "DRY RUN (rolled back)" if dry_run else "EXECUTE (committed)"
        self.stdout.write(self.style.SUCCESS(f"\nImport mode: {mode}"))
        self.stdout.write(f"CSV: {csv_path}")
        self.stdout.write(f"Rows processed: {stats.rows_processed}")
        self.stdout.write(f"Rows skipped: {stats.rows_skipped}")
        self.stdout.write(f"Users created: {stats.users_created}")
        self.stdout.write(f"Funds created: {stats.funds_created}")
        self.stdout.write(f"Vendors created: {stats.vendors_created}")
        self.stdout.write(f"Item types created: {stats.item_types_created}")
        self.stdout.write(f"Requests created: {stats.requests_created}")
        self.stdout.write(f"Requests updated: {stats.requests_updated}")
        self.stdout.write(f"Items created: {stats.items_created}")
        self.stdout.write(f"Items updated: {stats.items_updated}")
        self.stdout.write(f"History created: {stats.history_created}")
        self.stdout.write(f"History updated: {stats.history_updated}")
        self.stdout.write(f"Transactions created: {stats.transactions_created}")
        self.stdout.write(f"Transactions updated: {stats.transactions_updated}")
        if stats.reset_requests_deleted or stats.reset_items_deleted or stats.reset_transactions_deleted:
            self.stdout.write(
                f"Reset deleted - requests: {stats.reset_requests_deleted}, "
                f"items: {stats.reset_items_deleted}, transactions: {stats.reset_transactions_deleted}"
            )
        self.stdout.write(f"Imported user temp password: {TEMP_PASSWORD}")
        if stats.errors:
            self.stdout.write(self.style.ERROR("Errors:"))
            for err in stats.errors[:20]:
                self.stdout.write(f"- {err}")
            if len(stats.errors) > 20:
                self.stdout.write(f"... {len(stats.errors) - 20} more errors")
