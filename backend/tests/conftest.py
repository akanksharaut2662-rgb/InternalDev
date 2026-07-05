import sys
import os

# Make backend service modules importable from tests/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'validation_service'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'policy_service'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))
sys.path.insert(0, os.path.dirname(__file__))
