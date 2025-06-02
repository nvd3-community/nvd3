import zipfile
from xml.etree import ElementTree as ET
import json
import os

FILE = os.path.join(os.path.dirname(__file__), 'Results_v2 3.xlsx')

ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def parse_xlsx(path):
    zf = zipfile.ZipFile(path)
    strings = []
    if 'xl/sharedStrings.xml' in zf.namelist():
        ss = ET.fromstring(zf.read('xl/sharedStrings.xml'))
        strings = [t.text or '' for t in ss.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')]
    sheet = ET.fromstring(zf.read('xl/worksheets/sheet1.xml'))
    rows = sheet.findall('.//s:sheetData/s:row', ns)

    def get_value(c):
        v = c.find('s:v', ns)
        val = v.text if v is not None else ''
        if c.get('t') == 's' and val.isdigit():
            idx = int(val)
            if idx < len(strings):
                val = strings[idx]
        return val

    headers = [get_value(c) for c in rows[0].findall('s:c', ns)]

    def col_index(col):
        idx = 0
        for ch in col:
            idx = idx * 26 + (ord(ch) - 64)
        return idx - 1

    data = []
    for r in rows[1:1001]:
        row_vals = [''] * len(headers)
        for c in r.findall('s:c', ns):
            ref = c.get('r')
            col = ''.join(filter(str.isalpha, ref))
            i = col_index(col)
            if i < len(headers):
                row_vals[i] = get_value(c)
        data.append(row_vals)
    return headers, data

def infer_type(values):
    numeric = True
    date_like = True
    has_val = False
    for v in values:
        if v == '' or v is None:
            continue
        has_val = True
        if not str(v).isdigit():
            date_like = False
        try:
            float(v)
        except Exception:
            numeric = False
    if not has_val:
        return 'category'
    if date_like and len(str(values[0])) >= 5:
        return 'date'
    if numeric:
        return 'numeric'
    return 'category'

def main():
    headers, sample = parse_xlsx(FILE)
    cols = list(zip(*sample)) if sample else [[] for _ in headers]
    structure = []
    for name, col in zip(headers, cols):
        col_type = infer_type(col)
        structure.append({'name': name, 'type': col_type})
    out_path = os.path.join(os.path.dirname(__file__), 'structure.json')
    with open(out_path, 'w') as f:
        json.dump(structure, f, indent=2)
    print('Wrote', out_path)

if __name__ == '__main__':
    main()
