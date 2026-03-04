import csv
from dataclasses import dataclass, field
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from items.import_inventory_parsing import (
    clean_text,
    infer_item_type,
    parse_available,
    split_locations,
    split_quantity_for_locations,
)
from items.models import Item, ItemType, Location


@dataclass
class ImportStats:
    rows_processed: int = 0
    rows_skipped: int = 0
    item_types_created: int = 0
    locations_created: int = 0
    items_created: int = 0
    items_updated: int = 0
    items_unchanged: int = 0
    errors: list[str] = field(default_factory=list)


class Command(BaseCommand):
    help = "Import inventory data from data.csv into items, with quantity parsing and multi-location split."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default=None,
            help="Path to CSV file. Defaults to repo root/data.csv",
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
            "--owner",
            type=str,
            default=None,
            help="Owner username for imported records. Default: auto admin -> testuser fallback.",
        )
        parser.add_argument(
            "--match-mode",
            type=str,
            default="name+location",
            choices=["name+location"],
            help="Matching strategy for update-or-create behavior.",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Print line-level create/update details.",
        )

    def handle(self, *args, **options):
        execute = options["execute"]
        force_dry_run = options["dry_run"]
        if execute and force_dry_run:
            raise CommandError("Use either --execute or --dry-run, not both.")
        dry_run = not execute or force_dry_run

        csv_path = self._resolve_csv_path(options.get("file"))
        rows = self._read_csv_rows(csv_path)
        owner = self._resolve_owner(options.get("owner"))
        verbose = options.get("verbose", False)

        self._item_type_cache = {}
        self._location_cache = {}
        stats = ImportStats()

        with transaction.atomic():
            self._import_rows(
                rows=rows,
                owner=owner,
                match_mode=options["match_mode"],
                stats=stats,
                verbose=verbose,
            )
            if dry_run:
                transaction.set_rollback(True)

        self._print_summary(stats=stats, dry_run=dry_run, csv_path=csv_path, owner=owner)
        if stats.errors:
            raise CommandError("Import completed with errors. See summary above.")

    def _resolve_csv_path(self, arg_path):
        if arg_path:
            path = Path(arg_path).expanduser().resolve()
        else:
            path = (Path(__file__).resolve().parents[4] / "data.csv").resolve()

        if not path.exists():
            raise CommandError(f"CSV file not found: {path}")
        return path

    def _read_csv_rows(self, csv_path):
        with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        if not rows:
            raise CommandError("CSV has no data rows.")

        required_columns = ["Product", "Available", "Location"]
        missing = [col for col in required_columns if col not in rows[0]]
        if missing:
            raise CommandError(f"CSV missing required columns: {', '.join(missing)}")
        return rows

    def _resolve_owner(self, owner_arg):
        if owner_arg:
            owner = User.objects.filter(username__iexact=owner_arg).first()
            if not owner:
                raise CommandError(f"Owner user not found: {owner_arg}")
            return owner

        owner = User.objects.filter(username__iexact="admin").first()
        if owner:
            return owner

        owner = User.objects.filter(username__iexact="testuser").first()
        if owner:
            return owner

        raise CommandError("Default owner not found. Create 'admin' or 'testuser', or pass --owner.")

    def _import_rows(self, rows, owner, match_mode, stats, verbose):
        for line_no, row in enumerate(rows, start=2):
            try:
                self._import_single_row(
                    row=row,
                    line_no=line_no,
                    owner=owner,
                    match_mode=match_mode,
                    stats=stats,
                    verbose=verbose,
                )
                stats.rows_processed += 1
            except Exception as exc:
                stats.rows_skipped += 1
                stats.errors.append(f"Line {line_no}: {exc}")
                if verbose:
                    self.stderr.write(self.style.ERROR(f"Line {line_no}: {exc}"))

    def _import_single_row(self, row, line_no, owner, match_mode, stats, verbose):
        product = clean_text(row.get("Product"))
        if not product:
            raise ValueError("Product is empty.")

        available_raw = clean_text(row.get("Available"))
        location_raw = clean_text(row.get("Location"))
        parsed = parse_available(available_raw)
        item_type = self._get_or_create_item_type(infer_item_type(product), stats)
        locations = split_locations(location_raw)

        if locations:
            split_quantities = split_quantity_for_locations(parsed.quantity, len(locations))
            for location_name, quantity in zip(locations, split_quantities):
                location = self._get_or_create_location(location_name, stats)
                self._upsert_item_record(
                    product=product,
                    item_type=item_type,
                    owner=owner,
                    quantity=quantity,
                    unit=parsed.unit,
                    location=location,
                    available_raw=available_raw,
                    location_raw=location_raw,
                    line_no=line_no,
                    parsed=parsed,
                    match_mode=match_mode,
                    stats=stats,
                    verbose=verbose,
                )
        else:
            self._upsert_item_record(
                product=product,
                item_type=item_type,
                owner=owner,
                quantity=parsed.quantity,
                unit=parsed.unit,
                location=None,
                available_raw=available_raw,
                location_raw=location_raw,
                line_no=line_no,
                parsed=parsed,
                match_mode=match_mode,
                stats=stats,
                verbose=verbose,
            )

    def _upsert_item_record(
        self,
        product,
        item_type,
        owner,
        quantity,
        unit,
        location,
        available_raw,
        location_raw,
        line_no,
        parsed,
        match_mode,
        stats,
        verbose,
    ):
        if match_mode != "name+location":
            raise ValueError(f"Unsupported match mode: {match_mode}")

        query = Item.objects.filter(name=product, is_archived=False)
        if location is None:
            query = query.filter(location__isnull=True)
        else:
            query = query.filter(location=location)
        existing = query.order_by("id").first()

        now_iso = timezone.now().isoformat()
        import_props = {
            "available_raw": available_raw,
            "location_raw": location_raw,
            "import_source": "data.csv",
            "import_line": line_no,
            "imported_at": now_iso,
        }

        notes = list(parsed.notes)
        if notes:
            import_props["stock_notes"] = "; ".join(dict.fromkeys(notes))
        if parsed.warning:
            import_props["parse_warning"] = parsed.warning

        if existing is None:
            Item.objects.create(
                name=product,
                item_type=item_type,
                quantity=quantity,
                unit=unit,
                location=location,
                owner=owner,
                properties=import_props,
            )
            stats.items_created += 1
            if verbose:
                location_label = location.name if location else "NO_LOCATION"
                self.stdout.write(f"[CREATE] {product} @ {location_label} qty={quantity} {unit}")
            return

        existing_props = existing.properties if isinstance(existing.properties, dict) else {}
        merged_props = dict(existing_props)
        merged_props.update(import_props)

        if "stock_notes" in existing_props:
            existing_notes = [n.strip() for n in str(existing_props["stock_notes"]).split(";") if n.strip()]
            if notes:
                merged_props["stock_notes"] = "; ".join(dict.fromkeys(existing_notes + notes))

        if parsed.warning:
            merged_props["parse_warning"] = parsed.warning
        elif "parse_warning" in merged_props:
            merged_props.pop("parse_warning")

        changed = False
        updates = {
            "item_type": item_type,
            "quantity": quantity,
            "unit": unit,
            "owner": owner,
            "properties": merged_props,
        }
        for field_name, field_value in updates.items():
            if getattr(existing, field_name) != field_value:
                setattr(existing, field_name, field_value)
                changed = True

        if changed:
            existing.save()
            stats.items_updated += 1
            if verbose:
                location_label = location.name if location else "NO_LOCATION"
                self.stdout.write(f"[UPDATE] {product} @ {location_label} qty={quantity} {unit}")
        else:
            stats.items_unchanged += 1

    def _get_or_create_item_type(self, item_type_name, stats):
        cache_key = item_type_name.lower()
        if cache_key in self._item_type_cache:
            return self._item_type_cache[cache_key]

        item_type = ItemType.objects.filter(name__iexact=item_type_name).first()
        if not item_type:
            item_type = ItemType.objects.create(name=item_type_name)
            stats.item_types_created += 1
        self._item_type_cache[cache_key] = item_type
        return item_type

    def _get_or_create_location(self, location_name, stats):
        cache_key = location_name.lower()
        if cache_key in self._location_cache:
            return self._location_cache[cache_key]

        location = Location.objects.filter(name__iexact=location_name).order_by("id").first()
        if not location:
            location = Location.objects.create(name=location_name)
            stats.locations_created += 1
        self._location_cache[cache_key] = location
        return location

    def _print_summary(self, stats, dry_run, csv_path, owner):
        mode = "DRY RUN (rolled back)" if dry_run else "EXECUTE (committed)"
        self.stdout.write(self.style.SUCCESS(f"\nImport mode: {mode}"))
        self.stdout.write(f"CSV: {csv_path}")
        self.stdout.write(f"Owner: {owner.username}")
        self.stdout.write(f"Rows processed: {stats.rows_processed}")
        self.stdout.write(f"Rows skipped: {stats.rows_skipped}")
        self.stdout.write(f"Item types created: {stats.item_types_created}")
        self.stdout.write(f"Locations created: {stats.locations_created}")
        self.stdout.write(f"Items created: {stats.items_created}")
        self.stdout.write(f"Items updated: {stats.items_updated}")
        self.stdout.write(f"Items unchanged: {stats.items_unchanged}")
        if stats.errors:
            self.stdout.write(self.style.ERROR("Errors:"))
            for err in stats.errors[:20]:
                self.stdout.write(f"- {err}")
            if len(stats.errors) > 20:
                self.stdout.write(f"... {len(stats.errors) - 20} more errors")
