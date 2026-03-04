import re
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP


TYPE_KEYWORD_MAP = {
    "Media": ("dmem", "opti", "media", "pbs", "endogro", "fluorobrite"),
    "Chemical": (
        "g418",
        "hygromycin",
        "blasticidin",
        "zeocin",
        "puromycin",
        "ethanol",
        "bleach",
        "trypsin",
    ),
    "Kit": ("kit", "kits"),
}

UNIT_PATTERNS = (
    (r"box(?:es)?", "box"),
    (r"bottles?", "bottle"),
    (r"bags?", "bag"),
    (r"packets?", "packet"),
    (r"kits?", "kit"),
    (r"tubes?", "tube"),
    (r"units?", "unit"),
)


@dataclass(frozen=True)
class ParsedAvailable:
    quantity: Decimal
    unit: str
    notes: tuple[str, ...]
    warning: str | None = None


def clean_text(value):
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() in {"nan", "none"}:
        return ""
    return " ".join(text.split())


def infer_item_type(product_name):
    product_lower = clean_text(product_name).lower()
    for item_type, keywords in TYPE_KEYWORD_MAP.items():
        if any(keyword in product_lower for keyword in keywords):
            return item_type
    return "Consumable"


def split_locations(raw_location):
    text = clean_text(raw_location)
    if not text:
        return []

    parts = [clean_text(part.strip(" ,")) for part in text.split("+")]
    result = []
    seen = set()
    for part in parts:
        key = part.lower()
        if part and key not in seen:
            result.append(part)
            seen.add(key)
    return result


def infer_unit(available_text):
    text = clean_text(available_text).lower()
    units = []
    for pattern, canonical in UNIT_PATTERNS:
        if re.search(rf"\b{pattern}\b", text):
            units.append(canonical)

    unique_units = list(dict.fromkeys(units))
    if not unique_units:
        return "item", "No explicit unit found; defaulted to 'item'."
    if len(unique_units) > 1:
        return "item", f"Mixed units detected ({', '.join(unique_units)}); defaulted to 'item'."
    return unique_units[0], None


def parse_available(raw_available):
    text = clean_text(raw_available)
    if not text:
        return ParsedAvailable(
            quantity=Decimal("1.00"),
            unit="item",
            notes=(),
            warning="Empty Available value; defaulted quantity to 1.",
        )

    lower = text.lower()
    notes = []
    warning = None
    quantities = []

    special = re.search(r"(\d+(?:\.\d+)?)\s+small\s+boxes?\s+in\s+\d+(?:\.\d+)?\s+big\s+box", lower)
    if special:
        quantities.append(Decimal(special.group(1)))
        notes.append("Interpreted 'small boxes in big box' by counting small boxes only.")
    else:
        for num in re.findall(r"\d+(?:\.\d+)?", lower):
            quantities.append(Decimal(num))

    if "half" in lower:
        quantities.append(Decimal("0.5"))
        notes.append("Included half-unit wording as +0.5.")

    # e.g. "2 + Open"
    if re.search(r"(?:\+|and)\s*open\b", lower) and not re.search(r"\d+(?:\.\d+)?\s*open\b", lower):
        quantities.append(Decimal("1"))
        notes.append("Standalone open segment counted as +1.")

    if not quantities:
        if any(keyword in lower for keyword in ("last", "open", "brand new", "closed")):
            quantities.append(Decimal("1"))
            notes.append("No numeric quantity found; stock-status wording counted as 1.")
        else:
            quantities.append(Decimal("1"))
            warning = "Unable to parse quantity precisely; defaulted to 1."

    quantity = sum(quantities, Decimal("0"))
    quantity = quantity.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    unit, unit_warning = infer_unit(text)
    if unit_warning:
        warning = f"{warning}; {unit_warning}" if warning else unit_warning

    return ParsedAvailable(
        quantity=quantity,
        unit=unit,
        notes=tuple(notes),
        warning=warning,
    )


def split_quantity_for_locations(total_quantity, location_count):
    if location_count <= 0:
        return []

    total = Decimal(total_quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total_cents = int((total * 100).to_integral_value(rounding=ROUND_HALF_UP))
    base = total_cents // location_count
    remainder = total_cents % location_count

    quantities = []
    for idx in range(location_count):
        cents = base + (1 if idx < remainder else 0)
        quantities.append((Decimal(cents) / Decimal("100")).quantize(Decimal("0.01")))
    return quantities
