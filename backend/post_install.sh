#!/bin/bash
# Force reinstall pydantic v2 to override any conflicting v1 in the system venv
pip install 'pydantic>=2.0' --force-reinstall --no-deps
