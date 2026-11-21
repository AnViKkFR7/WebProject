"""Rebuild the illustrated guide. Sources and layout are deliberately page-based."""
from pathlib import Path
import html
import json
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfdoc import PDFString
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'docs/manual-assets'
OUT = ROOT / 'output/pdf/manual-uso-facturacion.pdf'
DATA = ROOT / 'docs/manual-panel.json'
W, H = 595.276, 841.89
M = 48
INK, BLUE, SKY, PAPER, MUTED, LINE = '#00051e', '#1f63cc', '#82daff', '#fcfbf7', '#585b6a', '#e5e5e8'
for name, file in [('Sans','arial.ttf'),('SansBold','arialbd.ttf'),('Serif','georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / file)))
pdfmetrics.registerFontFamily('Sans',normal='Sans',bold='SansBold',italic='Sans',boldItalic='SansBold')

def text(c, value, x, top, width, size=10.5, font='Sans', color=INK, leading=None):
    p = Paragraph(value, ParagraphStyle('p',fontName=font,fontSize=size,leading=leading or size*1.5,textColor=HexColor(color)))
    _, height = p.wrap(width, 2000)
    assert top + height < H-50, (c.getPageNumber(), value[:70], top+height)
    p.drawOn(c,x,H-top-height)
    return top+height

def rect(c,x,y,w,h,color,r=0):
    c.setFillColor(HexColor(color))
    if r: c.roundRect(x,H-y-h,w,h,r,stroke=0,fill=1)
    else: c.rect(x,H-y-h,w,h,stroke=0,fill=1)

def base(c, label):
    rect(c,0,0,W,H,PAPER)
    text(c,'moira<font color="'+BLUE+'">ordo</font>',M,23,200,19,'Serif')
    c.setStrokeColor(HexColor(LINE)); c.line(M, H-58,W-M,H-58)
    c.setFont('Sans',7.5); c.setFillColor(HexColor(MUTED))
    c.drawString(M,30,'GUÍA DEL PANEL  /  OCTUBRE 2026')
    c.drawRightString(W-M,30,f'{c.getPageNumber():02d}')
    c.linkRect('', 'indice', (M,23,M+230,42),relative=0,thickness=0)

def header(c,n,title,desc):
    rect(c,M,78,W-2*M,112,INK,12)
    text(c,f'CAPÍTULO {n:02d}',M+22,95,390,8,'SansBold',SKY)
    text(c,title,M+22,115,455,24,'Serif',PAPER,28)
    text(c,desc,M+22,155,455,9.5,'Sans','#c7ccda',14)

def image(c,file,x,top,width,maxh=340):
    path=ASSETS / (file+'.jpg')
    im=Image.open(path)
    ratio=min(width/im.width,maxh/im.height)
    iw,ih=im.width*ratio,im.height*ratio
    rect(c,x-3,top-3,iw+6,ih+6,'#e5e5e8',5)
    c.drawImage(str(path),x,H-top-ih,width=iw,height=ih)
    manifest=json.loads((ASSETS/'desktop-manifest.json').read_text(encoding='utf-8'))
    for marker in manifest.get(file,{}).get('markers',[]):
        mx=x+max(25,min(im.width-25,(marker['x']-12)*im.width/1600))*ratio
        my=top+max(25,min(im.height-25,(marker['y']+marker['h']/2)*im.height/1000))*ratio
        c.setStrokeColor(HexColor('#ffffff'));c.setLineWidth(1.5)
        c.setFillColor(HexColor(BLUE));c.circle(mx,H-my,8.5,stroke=1,fill=1)
        c.setFillColor(HexColor('#ffffff'));c.setFont('SansBold',9)
        c.drawCentredString(mx,H-my-3,marker['label'])
    return top+ih

def note(c,title,body,top):
    p=Paragraph(body,ParagraphStyle('n',fontName='Sans',fontSize=10,leading=15,textColor=HexColor(INK)))
    _,h=p.wrap(W-2*M-34,1000)
    assert top+h+50<H-50, (c.getPageNumber(), top, h, title)
    rect(c,M,top,W-2*M,h+49,'#e9f2ff',7)
    rect(c,M,top,3,h+49,BLUE)
    text(c,title,M+17,top+12,W-2*M-34,10,'SansBold',BLUE)
    p.drawOn(c,M+17,H-top-33-h)
    return top+h+49

def steps(c,items,x,top,width):
    y=top
    for i,item in enumerate(items,1):
        c.setFillColor(HexColor(BLUE)); c.circle(x+8,H-y-9,8,stroke=0,fill=1)
        c.setFillColor(HexColor('#ffffff'));c.setFont('SansBold',8);c.drawCentredString(x+8,H-y-12,str(i))
        y=text(c,item,x+26,y,width-26,size=9.5,leading=14)+10
    return y

def build():
    pages=json.loads(DATA.read_text(encoding='utf-8'))
    export_markdown(pages)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
    c.setTitle('Tu día a día, en el panel. | Manual de uso MoiraOrdo')
    c.setAuthor('MoiraOrdo');c.setSubject('Guía ilustrada del panel de administración')
    c._doc.Catalog.Lang=PDFString('es-ES')
    base(c,'Portada')
    rect(c,M,85,W-2*M,151,INK,12)
    text(c,'moira<font color="'+SKY+'">ordo</font>',M+26,107,400,38,'Serif',PAPER)
    text(c,'TU NEGOCIO, CON PERSPECTIVA',M+28,170,400,8,'Sans',SKY)
    text(c,'GUÍA PARA EL EQUIPO',M,276,440,9,'SansBold',BLUE)
    text(c,'Tu día a día,<br/>en el panel<font color="'+BLUE+'">.</font>',M,305,480,53,'Serif',INK,58)
    text(c,'Todo en su sitio. Cada paso, más claro.',M,455,470,18,'Serif')
    text(c,'Cómo gestionar contenido, atender solicitudes, preparar presupuestos y facturas, organizar el trabajo y consultar la actividad de tu empresa.',M,505,440,13,leading=21)
    rect(c,M,624,W-2*M,107,'#e9f2ff',8)
    text(c,'UNA GUÍA PARA USAR, NO PARA DESCIFRAR',M+20,643,440,8,'SansBold',BLUE)
    text(c,'Pasos detallados · Capturas de escritorio numeradas<br/>Edición 4 / 28 de octubre de 2026',M+20,667,440,11)
    c.showPage()
    base(c,'Índice');c.bookmarkPage('indice');c.addOutlineEntry('Contenido','indice',0)
    text(c,'CONTENIDO',M,86,440,8,'SansBold',BLUE)
    text(c,'Encuentra tu próximo paso.',M,111,490,31,'Serif')
    text(c,'Pulsa un capítulo para abrirlo. El pie de cada página vuelve aquí.',M,158,490,10,color=MUTED)
    y=205
    start=3
    for i,p in enumerate(pages,1):
        text(c,f'{i:02d}',M,y,35,13,'Serif',BLUE)
        text(c,html.escape(p['title']),M+42,y,400,11,'SansBold')
        count=len(p.get('sections',[p]));end=start+count-1
        c.setFont('Sans',10);c.setFillColor(HexColor(BLUE));c.drawRightString(W-M,H-y-12,str(start) if count==1 else f'{start}-{end}')
        c.linkRect('',f'cap{i}',(M,H-y-25,W-M,H-y+3),relative=0,thickness=0)
        c.setStrokeColor(HexColor(LINE));c.line(M,H-y-28,W-M,H-y-28)
        y+=34
        start=end+1
    c.showPage()
    for i,p in enumerate(pages,1):
        for j,s in enumerate(p.get('sections',[p])):
            base(c,p['title'])
            if j==0:
                c.bookmarkPage(f'cap{i}');c.addOutlineEntry(f'{i:02d} · {p["title"]}',f'cap{i}',0)
            if p.get('sections'):
                key=f'cap{i}-{j}';c.bookmarkPage(key);c.addOutlineEntry(s['title'],key,1)
            header(c,i,s.get('title',p['title']),s.get('desc',p['desc']))
            y=215
            if s.get('image'):
                y=image(c,s['image'],M,y,W-2*M,312)+10
                text(c,'ESCRITORIO 1600 × 1000 · WatchEcommerceDemo · Datos ficticios de demostración',M,y,W-2*M,7,color=MUTED)
                y+=23
            legends=s.get('legend',[])
            if legends:
                yy=[y,y]
                for k,line in enumerate(legends):
                    col=k%2
                    yy[col]=text(c,f'<font color="{BLUE}"><b>{k+1}</b></font>  {line}',M+col*258,yy[col],240,9,leading=13)+7
                y=max(yy)+7
            if s.get('steps'):
                yy=[y,y]
                for k,line in enumerate(s['steps']):
                    col=k%2
                    yy[col]=text(c,line,M+col*258,yy[col],240,9.5,leading=14)+9
                y=max(yy)+6
            for title,body in s.get('blocks',[]):
                y=text(c,title,M,y,W-2*M,14,'Serif')+5
                y=text(c,body,M,y,W-2*M,size=9.5,leading=14)+10
            if s.get('note'):note(c,*s['note'],y)
            c.showPage()
    c.save()
    print(f'{OUT} ({2+sum(len(p.get("sections",[p])) for p in pages)} páginas)')

def export_markdown(pages):
    import re
    def md(value):
        return re.sub(r'</?b>','**',value).replace('<br/>','\n\n')
    lines=['# Tu día a día, en el panel.','','Manual MoiraOrdo · Edición 4 · 28/10/2026','',
           'Fuente: `docs/manual-panel.json`. Regenerar: `python scripts/generate_admin_manual.py`. Capturas de escritorio con puntos de referencia numerados. Los datos visibles son ficticios y pertenecen a WatchEcommerceDemo.','', '## Índice','']
    start=3
    for i,p in enumerate(pages,1):
        count=len(p.get('sections',[p]));end=start+count-1
        lines.append(f'{i}. {p["title"]} · páginas {start}-{end}' if count>1 else f'{i}. {p["title"]} · página {start}')
        start=end+1
    for i,p in enumerate(pages,1):
        lines+=['',f'## {i:02} · {p["title"]}','']
        for s in p.get('sections',[p]):
            if p.get('sections'):lines+=['',f'### {s["title"]}','']
            lines+=[s.get('desc',p['desc']),'']
            if s.get('image'):lines += [f'![{s.get("title",p["title"])}](manual-assets/{s["image"]}.jpg)','']
            for n,line in enumerate(s.get('legend',[]),1):lines.append(f'{n}. {md(line)}')
            lines+=['']+['- '+md(line) for line in s.get('steps',[])]
            for title,body in s.get('blocks',[]):lines+=['',f'**{title}**','',md(body)]
            if s.get('note'):lines+=['',f'**{s["note"][0]}**','',md(s['note'][1])]
    (ROOT/'docs/manual-facturacion.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')

if __name__=='__main__':build()

