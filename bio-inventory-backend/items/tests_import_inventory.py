from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from items.import_inventory_parsing import (
    infer_item_type,
    parse_available,
    split_locations,
    split_quantity_for_locations,
)
from items.models import Item, ItemType, Location


class InventoryParsingTests(SimpleTestCase):
    def test_parse_available_numeric_with_open(self):
        parsed = parse_available("1+1 open box")
        self.assertEqual(parsed.quantity, Decimal("2.00"))
        self.assertEqual(parsed.unit, "box")

    def test_parse_available_last_box(self):
        parsed = parse_available("last box open")
        self.assertEqual(parsed.quantity, Decimal("1.00"))
        self.assertEqual(parsed.unit, "box")

    def test_parse_available_half_bottle(self):
        parsed = parse_available("Half bottle, open, expired")
        self.assertEqual(parsed.quantity, Decimal("0.50"))
        self.assertEqual(parsed.unit, "bottle")

    def test_parse_available_mixed_unit_defaults_to_item(self):
        parsed = parse_available("1 full box + 5 units")
        self.assertEqual(parsed.quantity, Decimal("6.00"))
        self.assertEqual(parsed.unit, "item")
        self.assertTrue(parsed.warning)

    def test_split_locations(self):
        result = split_locations("main lab + cell culture room (under sinks)")
        self.assertEqual(result, ["main lab", "cell culture room (under sinks)"])

    def test_split_quantity_preserves_total(self):
        split = split_quantity_for_locations(Decimal("1.00"), 3)
        self.assertEqual(sum(split), Decimal("1.00"))
        self.assertEqual(split, [Decimal("0.34"), Decimal("0.33"), Decimal("0.33")])

    def test_infer_item_type(self):
        self.assertEqual(infer_item_type("DMEM"), "Media")
        self.assertEqual(infer_item_type("Hygromycin B Pure Gold"), "Chemical")
        self.assertEqual(infer_item_type("EndoGro media kits"), "Media")
        self.assertEqual(infer_item_type("5 mL serological pipettes"), "Consumable")


class ImportInventoryCommandTests(TestCase):
    def setUp(self):
        User.objects.create_user(username="admin", password="pass")

    def test_dry_run_does_not_persist(self):
        with TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "data.csv"
            csv_path.write_text(
                "Product,Available,Location\n"
                "Test Pipette,2 boxes,main lab\n",
                encoding="utf-8",
            )
            call_command("import_inventory_csv", "--file", str(csv_path))

        self.assertEqual(Item.objects.count(), 0)
        self.assertEqual(ItemType.objects.count(), 0)
        self.assertEqual(Location.objects.count(), 0)

    def test_execute_creates_and_splits_multi_location(self):
        with TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "data.csv"
            csv_path.write_text(
                "Product,Available,Location\n"
                "Test Pipette,2 boxes,main lab + hallway closet\n",
                encoding="utf-8",
            )
            call_command("import_inventory_csv", "--execute", "--file", str(csv_path))

        items = list(Item.objects.order_by("location__name"))
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].quantity, Decimal("1.00"))
        self.assertEqual(items[1].quantity, Decimal("1.00"))
        self.assertEqual({i.location.name for i in items}, {"main lab", "hallway closet"})

    def test_execute_updates_existing_name_and_location(self):
        owner = User.objects.get(username="admin")
        item_type = ItemType.objects.create(name="Consumable")
        location = Location.objects.create(name="main lab")
        item = Item.objects.create(
            name="Test Pipette",
            item_type=item_type,
            quantity=Decimal("1.00"),
            unit="box",
            location=location,
            owner=owner,
            properties={"seeded": True},
        )

        with TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "data.csv"
            csv_path.write_text(
                "Product,Available,Location\n"
                "Test Pipette,3 boxes,main lab\n",
                encoding="utf-8",
            )
            call_command("import_inventory_csv", "--execute", "--file", str(csv_path))

        item.refresh_from_db()
        self.assertEqual(item.quantity, Decimal("3.00"))
        self.assertEqual(item.unit, "box")
        self.assertEqual(Item.objects.count(), 1)
