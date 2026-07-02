"""Artifact assembler: parses LLM output into individual files and creates a ZIP archive.

Expected LLM output format:
    ### FILE: relative/path/to/file
    ```
    file content here
    ```
    ### FILE: another/file.py
    ```python
    more content
    ```
"""

import io
import re
import zipfile
from typing import Optional

from shared.logger import get_logger

logger = get_logger("artifact-assembler")

# Regex to match: ### FILE: <path>\n```[optional_lang]\n<content>\n```
FILE_PATTERN = re.compile(
    r"### FILE:\s*(.+?)\s*\n"      # File path
    r"```[a-zA-Z]*\n"              # Opening fence (with optional language)
    r"(.*?)"                        # File content (non-greedy)
    r"\n```",                       # Closing fence
    re.DOTALL,
)


def parse_llm_output(raw_output: str) -> dict[str, str]:
    """Parse the LLM's output into a dict of filepath -> content.

    Args:
        raw_output: The raw text output from the LLM.

    Returns:
        Dict mapping relative file paths to their content.

    Raises:
        ValueError: If no files could be parsed from the output.
    """
    files: dict[str, str] = {}

    matches = FILE_PATTERN.findall(raw_output)

    if not matches:
        # Fallback: try to find any fenced code blocks and use numbered filenames
        logger.warning("No ### FILE: markers found in LLM output; attempting fallback parse")
        fallback_pattern = re.compile(r"```[a-zA-Z]*\n(.*?)\n```", re.DOTALL)
        fallback_matches = fallback_pattern.findall(raw_output)
        if fallback_matches:
            for i, content in enumerate(fallback_matches):
                files[f"generated_file_{i + 1}.txt"] = content
        else:
            raise ValueError("Could not parse any files from LLM output")
    else:
        for path, content in matches:
            # Clean up the path
            clean_path = path.strip().strip("`").strip()
            # Remove leading slashes
            clean_path = clean_path.lstrip("/")
            files[clean_path] = content

    logger.info(f"Parsed {len(files)} files from LLM output: {list(files.keys())}")
    return files


def create_zip(files: dict[str, str], service_name: Optional[str] = None) -> bytes:
    """Create a ZIP archive from parsed files.

    Args:
        files: Dict mapping relative file paths to their content.
        service_name: Optional service name to use as the root directory in the ZIP.

    Returns:
        ZIP archive as bytes.
    """
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        root = service_name or "generated-service"
        for filepath, content in files.items():
            # Ensure the file is nested under the service name directory
            full_path = f"{root}/{filepath}"
            zf.writestr(full_path, content)
            logger.info(f"Added to ZIP: {full_path} ({len(content)} bytes)")

    zip_bytes = buffer.getvalue()
    logger.info(f"ZIP created: {len(zip_bytes)} bytes, {len(files)} files")
    return zip_bytes


def get_file_list(files: dict[str, str]) -> list[dict[str, any]]:
    """Get a summary list of files for the results dashboard.

    Args:
        files: Dict mapping relative file paths to their content.

    Returns:
        List of dicts with file metadata.
    """
    file_list = []
    for filepath, content in files.items():
        file_list.append({
            "path": filepath,
            "size": len(content),
            "lines": content.count("\n") + 1,
            "type": _detect_file_type(filepath),
        })
    return file_list


def _detect_file_type(filepath: str) -> str:
    """Detect file type from extension."""
    ext_map = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".java": "java",
        ".go": "go",
        ".rs": "rust",
        ".rb": "ruby",
        ".yml": "yaml",
        ".yaml": "yaml",
        ".json": "json",
        ".toml": "toml",
        ".md": "markdown",
        ".txt": "text",
        ".sh": "shell",
        ".bash": "shell",
    }
    for ext, file_type in ext_map.items():
        if filepath.lower().endswith(ext):
            return file_type

    basename = filepath.split("/")[-1].lower()
    if basename == "dockerfile":
        return "dockerfile"
    if basename == "makefile":
        return "makefile"
    if basename == ".gitignore":
        return "gitignore"

    return "text"
