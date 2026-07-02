"""DynamoDB helpers for the IDP single-table design.

Table schema:
  PK (String) — Partition key
  SK (String) — Sort key

Key patterns:
  Policy profile:     PK=POLICY#default        SK=PROFILE
  Generation request: PK=REQUEST#<requestId>    SK=META
  Request artifacts:  PK=REQUEST#<requestId>    SK=ARTIFACT#<name>
  Validation result:  PK=REQUEST#<requestId>    SK=VALIDATION

GSI1:
  GSI1PK=STATUS#<status>  GSI1SK=<createdAt>
"""

import os
from typing import Any, Optional

import boto3
from boto3.dynamodb.conditions import Key

_TABLE_NAME = os.environ.get("TABLE_NAME", "idp-table")
_dynamodb = boto3.resource("dynamodb")
_table = _dynamodb.Table(_TABLE_NAME)


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------

def put_item(item: dict) -> dict:
    """Put an item into the table."""
    return _table.put_item(Item=item)


def get_item(pk: str, sk: str) -> Optional[dict]:
    """Get a single item by PK/SK. Returns None if not found."""
    resp = _table.get_item(Key={"PK": pk, "SK": sk})
    return resp.get("Item")


def update_item(pk: str, sk: str, updates: dict[str, Any]) -> dict:
    """Update specific attributes on an item.

    Args:
        pk: Partition key value.
        sk: Sort key value.
        updates: Dict of attribute_name -> new_value.

    Returns:
        DynamoDB update_item response.
    """
    expr_parts = []
    expr_names = {}
    expr_values = {}

    for i, (attr, value) in enumerate(updates.items()):
        alias = f"#attr{i}"
        placeholder = f":val{i}"
        expr_parts.append(f"{alias} = {placeholder}")
        expr_names[alias] = attr
        expr_values[placeholder] = value

    return _table.update_item(
        Key={"PK": pk, "SK": sk},
        UpdateExpression="SET " + ", ".join(expr_parts),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )


def query_pk(pk: str, sk_prefix: Optional[str] = None) -> list[dict]:
    """Query all items under a PK, optionally filtering by SK prefix."""
    key_expr = Key("PK").eq(pk)
    if sk_prefix:
        key_expr = key_expr & Key("SK").begins_with(sk_prefix)
    resp = _table.query(KeyConditionExpression=key_expr)
    return resp.get("Items", [])


def query_gsi1(gsi1pk: str, scan_forward: bool = False, limit: int = 50) -> list[dict]:
    """Query GSI1 by GSI1PK, ordered by GSI1SK."""
    resp = _table.query(
        IndexName="GSI1",
        KeyConditionExpression=Key("GSI1PK").eq(gsi1pk),
        ScanIndexForward=scan_forward,
        Limit=limit,
    )
    return resp.get("Items", [])


def delete_item(pk: str, sk: str) -> dict:
    """Delete an item by PK/SK."""
    return _table.delete_item(Key={"PK": pk, "SK": sk})


# ---------------------------------------------------------------------------
# Domain-specific helpers
# ---------------------------------------------------------------------------

def get_policy_profile() -> Optional[dict]:
    """Retrieve the active (default) company policy profile."""
    return get_item("POLICY#default", "PROFILE")


def save_policy_profile(profile_data: dict) -> dict:
    """Save/update the company policy profile."""
    item = {
        "PK": "POLICY#default",
        "SK": "PROFILE",
        **profile_data,
    }
    return put_item(item)


def get_request(request_id: str) -> Optional[dict]:
    """Retrieve a generation request by ID."""
    return get_item(f"REQUEST#{request_id}", "META")


def save_request(request_id: str, data: dict) -> dict:
    """Save a new generation request."""
    item = {
        "PK": f"REQUEST#{request_id}",
        "SK": "META",
        **data,
    }
    return put_item(item)


def update_request_status(request_id: str, status: str, **extra) -> dict:
    """Update the status of a generation request."""
    updates = {"status": status, **extra}
    return update_item(f"REQUEST#{request_id}", "META", updates)


def save_validation_results(request_id: str, results: list[dict]) -> dict:
    """Save governance validation results for a request."""
    item = {
        "PK": f"REQUEST#{request_id}",
        "SK": "VALIDATION",
        "results": results,
    }
    return put_item(item)


def get_validation_results(request_id: str) -> Optional[dict]:
    """Retrieve validation results for a request."""
    return get_item(f"REQUEST#{request_id}", "VALIDATION")


def list_requests(limit: int = 50) -> list[dict]:
    """List recent generation requests via GSI1 scan (all statuses)."""
    # Scan the table filtering for request META items
    resp = _table.scan(
        FilterExpression=Key("SK").eq("META") & Key("PK").begins_with("REQUEST#"),
        Limit=limit,
    )
    items = resp.get("Items", [])
    # Sort by createdAt descending
    items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return items
