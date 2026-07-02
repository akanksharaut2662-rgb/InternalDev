"""S3 helpers for uploading ZIPs and generating pre-signed download URLs."""

import os

import boto3

_BUCKET = os.environ.get("ARTIFACTS_BUCKET", "idp-artifacts")
_s3_client = boto3.client("s3")


def upload_zip(key: str, body: bytes) -> dict:
    """Upload a ZIP file to the artifacts bucket.

    Args:
        key: S3 object key (e.g., 'generated/abc123/payment-service-api.zip').
        body: ZIP file contents as bytes.

    Returns:
        S3 put_object response.
    """
    return _s3_client.put_object(
        Bucket=_BUCKET,
        Key=key,
        Body=body,
        ContentType="application/zip",
    )


def get_presigned_url(key: str, expires_in: int = 900) -> str:
    """Generate a pre-signed URL for downloading a ZIP.

    Args:
        key: S3 object key.
        expires_in: URL expiry in seconds (default 15 minutes).

    Returns:
        Pre-signed URL string.
    """
    return _s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": _BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )


def check_object_exists(key: str) -> bool:
    """Check if an object exists in the artifacts bucket."""
    try:
        _s3_client.head_object(Bucket=_BUCKET, Key=key)
        return True
    except _s3_client.exceptions.ClientError:
        return False
