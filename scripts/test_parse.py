# scripts/test_parse.py
import re

with open('scripts/import_41_zoy.py', 'r', encoding='utf-8') as f:
    content = f.read()

names_str = content.split('PAGE_1_TO_4_NAMES = """')[1].split('"""')[0].strip()
names_lines = [l.strip() for l in names_str.split('\n') if l.strip()]

pattern = re.compile(r"^(\d+)\s+(.+?)\s+([0-9]{1,2}/[0-9]{1,2}/[0-9]{4}|NA)$")

parsed_names = []
failed = []
for idx, line in enumerate(names_lines):
    m = pattern.match(line)
    if m:
        sr, task, b_start = m.groups()
        parsed_names.append((int(sr), task.strip(), b_start))
    else:
        failed.append((idx + 1, line))

print(f"Parsed successfully: {len(parsed_names)} / {len(names_lines)}")
if failed:
    print(f"Failed lines: {failed}")
else:
    print("All 154 names lines parsed perfectly!")
