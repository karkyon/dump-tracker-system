#!/usr/bin/env python3
# SystemSettings.tsx の未使用 Link2 import を削除
import os
path = os.path.expanduser("~/projects/dump-tracker/frontend/cms/src/pages/SystemSettings.tsx")
with open(path, 'r') as f:
    c = f.read()
old = "import { AlertTriangle, Building2, Link2, Save, Settings, Trash2, Upload, Download } from 'lucide-react';"
new = "import { AlertTriangle, Building2, Save, Settings, Trash2, Upload, Download } from 'lucide-react';"
if old in c:
    with open(path, 'w') as f:
        f.write(c.replace(old, new, 1))
    print("OK: Link2 removed")
else:
    print("NOT FOUND - check manually")
