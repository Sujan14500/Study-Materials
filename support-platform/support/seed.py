"""Three tenants with genuinely different help centres, thresholds and golden sets.

They differ on purpose:
  acme    generous knowledge base, high auto-send threshold. The easy tenant.
  bloom   thin knowledge base. The tenant whose accuracy drags the fleet down —
          without one of these, a per-tenant SLA has nothing to prove.
  zenith  overlapping vocabulary with acme (both mention "refund window" and
          "API key") but different answers. This is the pair that makes an
          isolation leak visible instead of theoretical.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

TENANTS = {
    "acme": {
        "name": "Acme Tools",
        "config": {"auto_send_at": 0.62, "refuse_below": 0.30, "sla_accuracy": 0.80,
                   "budget_cents_per_period": 500.0, "brand_voice": "friendly and concise"},
        "docs": [
            ("Refund policy",
             "Acme refunds any order within 30 days of delivery for a full refund.\n\n"
             "Refunds are returned to the original payment method and take 5 to 7 business days "
             "to appear on your statement.\n\n"
             "Items marked final sale cannot be refunded."),
            ("API keys",
             "Acme API keys are created in Settings, then Developers, then Create key. "
             "A key is shown once and cannot be recovered afterwards.\n\n"
             "Keys can be rotated at any time. The old key stops working immediately when you "
             "rotate, so update your integrations first."),
            ("Shipping",
             "Standard shipping is 3 to 5 business days within the country. "
             "Express shipping is next business day if ordered before 2pm.\n\n"
             "Tracking numbers are emailed when the parcel leaves our warehouse."),
            ("Plans and billing",
             "Acme has Starter, Pro and Business plans, billed monthly or annually. "
             "Annual billing saves two months.\n\n"
             "You can change plan at any time; upgrades are prorated immediately and downgrades "
             "take effect at the end of the billing period."),
        ],
        "golden": [
            {"q": "how long do I have to return something?", "must_cite": "Refund policy"},
            {"q": "how long does a refund take to show up?", "must_cite": "Refund policy"},
            {"q": "where do I create an API key?", "must_cite": "API keys"},
            {"q": "what happens to my old key when I rotate it?", "must_cite": "API keys"},
            {"q": "when will my parcel arrive with express shipping?", "must_cite": "Shipping"},
            {"q": "does annual billing save money?", "must_cite": "Plans and billing"},
            {"q": "what happens if I downgrade my plan?", "must_cite": "Plans and billing"},
            {"q": "what is the CEO's home address?", "must_refuse": True},
            {"q": "can you write me a poem about kubernetes?", "must_refuse": True},
        ],
    },
    "bloom": {
        "name": "Bloom Studio",
        # Deliberately strict: a thin knowledge base with a low auto-send bar would
        # be the worst possible combination, so this tenant compensates with caution.
        "config": {"auto_send_at": 0.80, "refuse_below": 0.42, "sla_accuracy": 0.70,
                   "budget_cents_per_period": 120.0, "brand_voice": "warm and personal"},
        "docs": [
            ("Booking changes",
             "Bloom appointments can be rescheduled free of charge up to 24 hours before the slot.\n\n"
             "Inside 24 hours a 50% fee applies, and no-shows are charged in full."),
            ("Gift cards",
             "Bloom gift cards are valid for 12 months from purchase and can be used against any "
             "service. They cannot be exchanged for cash."),
        ],
        "golden": [
            {"q": "can I move my appointment to next week?", "must_cite": "Booking changes"},
            {"q": "what happens if I cancel last minute?", "must_cite": "Booking changes"},
            {"q": "how long is a gift card good for?", "must_cite": "Gift cards"},
            {"q": "can I get cash for my gift card?", "must_cite": "Gift cards"},
            {"q": "do you offer a corporate discount?", "must_refuse": True},
            {"q": "what is your VAT number?", "must_refuse": True},
        ],
    },
    "zenith": {
        "name": "Zenith Cloud",
        "config": {"auto_send_at": 0.62, "refuse_below": 0.30, "sla_accuracy": 0.80,
                   "budget_cents_per_period": 900.0, "brand_voice": "precise and technical"},
        "docs": [
            # Same words as Acme, deliberately different answers. If isolation ever
            # breaks, an Acme customer gets told "14 days" and the eval catches it.
            ("Refund policy",
             "Zenith refunds unused annual subscriptions within 14 days of purchase. "
             "Monthly subscriptions are non-refundable once the period has started.\n\n"
             "Usage-based charges are never refundable."),
            ("API keys",
             "Zenith API keys are scoped per project and are created with the zen CLI: "
             "run zen keys create --project PROJECT.\n\n"
             "Keys expire after 90 days by default and must be rotated before expiry."),
            ("Rate limits",
             "The free tier allows 60 requests per minute. Paid tiers start at 600 requests "
             "per minute and can be raised on request.\n\n"
             "Exceeding the limit returns HTTP 429 with a Retry-After header."),
        ],
        "golden": [
            {"q": "can I get a refund on my annual subscription?", "must_cite": "Refund policy"},
            {"q": "are monthly plans refundable?", "must_cite": "Refund policy"},
            {"q": "how do I create an API key?", "must_cite": "API keys"},
            {"q": "when do API keys expire?", "must_cite": "API keys"},
            {"q": "what is the rate limit on the free tier?", "must_cite": "Rate limits"},
            {"q": "what does a 429 mean?", "must_cite": "Rate limits"},
            {"q": "who are your biggest customers?", "must_refuse": True},
        ],
    },
}

CATEGORIES = ["billing", "technical", "account", "shipping"]


def build(platform) -> dict:
    """Creates the tenants, their docs, and returns {tenant_id: golden set}."""
    goldens = {}
    for tid, spec in TENANTS.items():
        platform.add_tenant(tid, spec["name"], spec["config"])
        tdb = platform.scope(tid)
        if not tdb.docs():
            for title, body in spec["docs"]:
                tdb.add_doc(title, body)
        goldens[tid] = spec["golden"]
    return goldens


def seed_history(tdb, n: int = 120, seed: int = 11) -> None:
    """Past tickets, so the analytics chapter has something real to chew on."""
    rng = random.Random(seed + hash(tdb.tenant_id) % 1000)
    start = datetime.now(timezone.utc) - timedelta(days=90)
    weights = {"billing": 0.35, "technical": 0.3, "account": 0.2, "shipping": 0.15}

    for i in range(n):
        cat = rng.choices(list(weights), weights=list(weights.values()))[0]
        # Deflection genuinely differs by category — billing questions are
        # answerable from docs, technical ones often are not.
        p_auto = {"billing": 0.72, "shipping": 0.66, "account": 0.48, "technical": 0.29}[cat]
        r = rng.random()
        resolution = "auto_send" if r < p_auto else ("review" if r < p_auto + 0.25 else "refuse")
        handle = {"auto_send": rng.randint(20, 90),
                  "review": rng.randint(300, 1800),
                  "refuse": rng.randint(240, 900)}[resolution]
        csat = None
        if rng.random() < 0.6:
            csat = rng.choices([5, 4, 3, 2, 1],
                               weights=[0.5, 0.25, 0.12, 0.08, 0.05] if resolution == "auto_send"
                               else [0.25, 0.3, 0.2, 0.15, 0.1])[0]
        tdb.add_ticket(
            user_id=f"u-{rng.randint(1, 40)}",
            created_at=(start + timedelta(days=rng.randint(0, 89),
                                          hours=rng.randint(0, 23))).isoformat(timespec="seconds"),
            category=cat, question=f"seeded {cat} question #{i}", resolution=resolution,
            confidence=round(rng.uniform(0.2, 0.95), 3), handle_seconds=handle, csat=csat,
            cost_cents=round(rng.uniform(0.05, 0.6), 4))
