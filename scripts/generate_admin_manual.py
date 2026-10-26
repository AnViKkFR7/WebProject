"""Generate the Spanish admin guide PDF from docs/manual-facturacion.md."""
from pathlib import Path
import html
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs' / 'manual-facturacion.md'
OUTPUT = ROOT / 'output' / 'pdf' / 'manual-uso-facturacion.pdf'
FONT_DIR = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('Arial', str(FONT_DIR / 'arial.ttf')))
pdfmetrics.registerFont(TTFont('Arial-Bold', str(FONT_DIR / 'arialbd.ttf')))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold', italic='Arial', boldItalic='Arial-Bold')

INK = colors.HexColor('#17324f')
ACCENT = colors.HexColor('#bf6a16')
MUTED = colors.HexColor('#63758b')
GRID = colors.HexColor('#d4deea')
PALE = colors.HexColor('#eaf0f6')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='ManualTitle', fontName='Arial-Bold', fontSize=24, leading=29, textColor=INK, spaceAfter=9))
styles.add(ParagraphStyle(name='ManualH2', fontName='Arial-Bold', fontSize=15.5, leading=18, textColor=INK, spaceBefore=9, spaceAfter=4, keepWithNext=True))
styles.add(ParagraphStyle(name='ManualH3', fontName='Arial-Bold', fontSize=11.2, leading=13, textColor=ACCENT, spaceBefore=6, spaceAfter=3, keepWithNext=True))
styles.add(ParagraphStyle(name='ManualBody', fontName='Arial', fontSize=9, leading=12, textColor=colors.HexColor('#25364a'), spaceAfter=3.5))
styles.add(ParagraphStyle(name='ManualList', parent=styles['ManualBody'], leftIndent=12, firstLineIndent=-8, spaceAfter=4))
styles.add(ParagraphStyle(name='ManualCell', fontName='Arial', fontSize=8, leading=10, textColor=colors.HexColor('#25364a')))
styles.add(ParagraphStyle(name='ManualCellHead', fontName='Arial-Bold', fontSize=8, leading=10, textColor=INK))
styles.add(ParagraphStyle(name='ManualCaption', fontName='Arial', fontSize=8, leading=11, textColor=MUTED, spaceAfter=6))
styles.add(ParagraphStyle(name='ManualQuote', parent=styles['ManualBody'], borderColor=ACCENT, borderWidth=1, borderPadding=7, backColor=colors.HexColor('#fff8e9')))

def inline(text):
    text = html.escape(text.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-').replace('\u2212', '-'), quote=False)
    text = re.sub(r'`([^`]+)`', r'<font name="Courier">\1</font>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    return re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: f'<link href="{html.escape(m.group(2), quote=True)}" color="#1764a0"><u>{m.group(1)}</u></link>', text)

def parse_table(lines, width):
    rows = []
    for row_index, line in enumerate(lines):
        cells = [cell.strip() for cell in line.strip().strip('|').split('|')]
        if cells and all(re.fullmatch(r':?-{3,}:?', cell.replace(' ', '')) for cell in cells):
            continue
        style = 'ManualCellHead' if row_index == 0 else 'ManualCell'
        rows.append([Paragraph(inline(cell), styles[style]) for cell in cells])
    count = max(len(row) for row in rows)
    rows = [row + [Paragraph('', styles['ManualCell'])] * (count-len(row)) for row in rows]
    fractions = [0.24, 0.52, 0.24] if count == 3 else [1/count]*count
    table = Table(rows, colWidths=[width*fraction for fraction in fractions], repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),PALE), ('GRID',(0,0),(-1,-1),0.45,GRID),
        ('VALIGN',(0,0),(-1,-1),'TOP'), ('LEFTPADDING',(0,0),(-1,-1),6),
        ('RIGHTPADDING',(0,0),(-1,-1),6), ('TOPPADDING',(0,0),(-1,-1),5),
        ('BOTTOMPADDING',(0,0),(-1,-1),5),
    ]))
    return table

def page_chrome(canvas, doc):
    canvas.saveState()
    width, height = A4
    if doc.page > 1:
        canvas.setFont('Arial-Bold', 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(doc.leftMargin, height-15*mm, 'MANUAL DE USO · PANEL DE ADMINISTRACIÓN')
        canvas.setStrokeColor(GRID)
        canvas.line(doc.leftMargin, height-17*mm, width-doc.rightMargin, height-17*mm)
    canvas.setStrokeColor(GRID)
    canvas.line(doc.leftMargin, 13*mm, width-doc.rightMargin, 13*mm)
    canvas.setFont('Arial', 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 8.5*mm, 'Guía local · 26/10/2026')
    canvas.drawRightString(width-doc.rightMargin, 8.5*mm, str(doc.page))
    canvas.restoreState()

def build_story():
    lines = SOURCE.read_text(encoding='utf-8').splitlines()
    story = []
    width = A4[0] - 34*mm
    index = 0
    while index < len(lines):
        raw = lines[index].strip()
        if not raw:
            index += 1
            continue
        if raw.startswith('![') and '](' in raw:
            match = re.search(r'!\[[^\]]*\]\(([^)]+)\)', raw)
            image_path = (SOURCE.parent / match.group(1)).resolve() if match else None
            if image_path and image_path.exists():
                image = Image(str(image_path), width=100*mm, height=60*mm, kind='proportional')
                image.hAlign = 'CENTER'
                story.extend([Spacer(1, 3), image, Spacer(1, 3)])
            index += 1
            continue
        if raw.startswith('|'):
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith('|'):
                table_lines.append(lines[index].strip())
                index += 1
            story.extend([parse_table(table_lines, width), Spacer(1, 5)])
            continue
        if raw.startswith('# '):
            story.append(Paragraph(inline(raw[2:]), styles['ManualTitle']))
            index += 1
            continue
        if raw.startswith('## '):
            story.append(Paragraph(inline(raw[3:]), styles['ManualH2']))
            index += 1
            continue
        if raw.startswith('### '):
            story.append(Paragraph(inline(raw[4:]), styles['ManualH3']))
            index += 1
            continue
        if raw.startswith('> '):
            story.append(Paragraph(inline(raw[2:]), styles['ManualQuote']))
            index += 1
            continue
        if re.match(r'\d+\.\s', raw):
            match = re.match(r'(\d+)\.\s+(.*)', raw)
            story.append(Paragraph(inline(match.group(2)), styles['ManualList'], bulletText=f'{match.group(1)}.'))
            index += 1
            continue
        if raw.startswith('- '):
            story.append(Paragraph(inline(raw[2:]), styles['ManualList'], bulletText='-'))
            index += 1
            continue
        paragraph = [raw]
        index += 1
        while index < len(lines):
            next_line = lines[index].strip()
            if not next_line or next_line.startswith(('#','|','![','>','- ')) or re.match(r'\d+\.\s', next_line):
                break
            paragraph.append(next_line)
            index += 1
        story.append(Paragraph(inline(' '.join(paragraph)), styles['ManualBody']))
    return story

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=17*mm, leftMargin=17*mm, topMargin=24*mm, bottomMargin=20*mm, title='Manual de uso del panel de administración', author='Regiamare', subject='Guía integral de uso del panel')
doc.build(build_story(), onFirstPage=page_chrome, onLaterPages=page_chrome)
print(OUTPUT)
