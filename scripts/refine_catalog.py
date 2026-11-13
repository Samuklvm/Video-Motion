"""Resolve recovered labels against supplied Android strings; never guess an image match."""
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('strings', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
catalog = root / 'public/catalog/effects.json'
labels = {n.get('name'): ''.join(n.itertext()) for n in ET.parse(args.strings).getroot()}
rows = json.loads(catalog.read_text(encoding='utf-8'))
aliases = {'irridescence': 'irrid', 'irridescence2': 'irrid', 'fractalwarp': 'fractwarp', 'fractalwarp2': 'fractwarp'}
fallbacks = {'difference':'Diferença', 'facemotion':'Movimento facial', 'outline':'Contorno', 'outline-basic':'Contorno básico', 'outline-bad':'Contorno experimental', 'shadow':'Sombra', 'fractalwarp':'Distorção fractal', 'fractalwarp2':'Distorção fractal'}
previews = {'counter':'count_up_down.webp', 'irridescence':'iridescence.webp', 'irridescence2':'iridescence.webp', 's3d-hexprism':'hexagonal_prism.webp', 's3d-plus':'three_axis_cross.webp', 's3d-triprism':'triangular_prism.webp', 's3d-triprism2':'triangular_prism.webp', 'fractalwarp':'fractal_warp.webp', 'fractalwarp2':'fractal_warp.webp'}
blend = {'color-burn':'Superexposição de cores', 'color-dodge':'Subexposição de cores', 'color':'Cor', 'darken':'Escurecer', 'darker-color':'Cor mais escura', 'diff':'Diferença', 'divide':'Dividir', 'exclusion':'Exclusão', 'hard-light':'Luz forte', 'hue':'Matiz', 'lighten':'Clarear', 'lighter-color':'Cor mais clara', 'linear-burn':'Superexposição linear', 'linear-dodge':'Subexposição linear', 'linear-light':'Luz linear', 'luminance':'Luminosidade', 'overlay':'Sobrepor', 'pin-light':'Luz pontual', 'saturation':'Saturação', 'soft-light':'Luz suave', 'soft-overlay':'Sobreposição suave', 'subtract':'Subtrair', 'vivid-light':'Luz vívida'}
renamed = linked = 0
for row in rows:
    stem = Path(row['file']).stem
    row['internal'] = stem.startswith(('internal-', 'test', 'layernorm')) or stem == 'outline-bad'
    if row['name'] in ('Nome', 'Name', ''):
        key = 'effect_' + aliases.get(stem, stem.replace('-', '_')) + '_name'
        name = labels.get(key) or fallbacks.get(stem) or ('Interno · ' + stem if row['internal'] else stem.replace('-', ' ').capitalize())
        row['name'] = name
        row['name_source'] = key if key in labels else 'editor fallback'
        renamed += 1
    if stem.startswith('blend-'):
        row['name'] = blend.get(stem[6:], stem[6:].replace('-', ' ').capitalize())
        row['category'] = 'blend'
        row['name_source'] = 'editor translation'
    if not row['preview'] and stem in previews:
        candidate = previews[stem]
        if (root / 'public/previews/effects' / candidate).is_file():
            row['preview'] = candidate
            row['preview_match'] = 'explicit semantic alias'
            linked += 1
    if row['preview'] and not (root / 'public/previews/effects' / row['preview']).is_file():
        raise ValueError('Missing preview: ' + row['preview'])
    row['search'] = ' '.join(str(row.get(k,'')) for k in ('name','description','category','tags','id')).lower()
catalog.write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'renamed':renamed, 'new_preview_links':linked, 'total':len(rows), 'internal':sum(r['internal'] for r in rows), 'with_preview':sum(bool(r['preview']) for r in rows)}))
