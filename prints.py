"""
NOVEX FINANCE — Atalho raiz para execução de captura de prints e auditoria visual E2E.
Executa scripts/prints.py
"""
import sys
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).resolve().parent / "scripts"
sys.path.insert(0, str(_SCRIPTS_DIR))

import prints

if __name__ == "__main__":
    prints.main()
