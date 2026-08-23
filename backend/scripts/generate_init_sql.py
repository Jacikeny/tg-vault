#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[2]
schema = root / 'backend' / 'src' / 'db' / 'schema.sql'
init = root / 'init.sql'
expected = '-- GENERATED FROM backend/src/db/schema.sql; DO NOT EDIT init.sql DIRECTLY.\n' + schema.read_text()
if '--check' in sys.argv:
    if not init.exists() or init.read_text() != expected:
        print('init.sql is not synchronized with canonical schema.sql', file=sys.stderr)
        raise SystemExit(1)
else:
    init.write_text(expected)
    print(f'generated {init}')
