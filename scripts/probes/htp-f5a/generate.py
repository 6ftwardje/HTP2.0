"""Synthetic fixtures only. Run using the bundled Python runtime with ReportLab/Pillow."""
from pathlib import Path
from io import BytesIO
import random,json
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.pdfencrypt import StandardEncryption
out=Path('output/playwright/htp-f5a/fixtures');out.mkdir(parents=True,exist_ok=True)
rng=random.Random(250018)
images=[]
for i in range(12):
 image=Image.frombytes('RGB',(640,640),rng.randbytes(640*640*3));buf=BytesIO();image.save(buf,format='PNG');images.append(ImageReader(BytesIO(buf.getvalue())))
def make(name,pages,heavy=False,encrypt=None):
 c=canvas.Canvas(str(out/(name+'.pdf')),pagesize=(595,842),encrypt=encrypt,pageCompression=1)
 for n in range(1,pages+1):
  c.setTitle('Synthetische HTP PDF-proef');c.setFont('Helvetica-Bold',22);c.drawString(45,790,'Een rustig handelsplan')
  c.setFont('Helvetica',11);c.drawString(45,764,f'Synthetische testinhoud - pagina {n} van {pages}')
  for j,line in enumerate(['Dit document bevat geen cursusinhoud of echte marktgegevens.','Bepaal vooraf je scenario, risico en moment van evaluatie.','Een plan maakt keuzes zichtbaar, maar biedt geen rendementsgarantie.']):c.drawString(45,720-j*19,line)
  c.setStrokeColorRGB(.25,.35,.5)
  for x in range(60,550,25):c.line(x,410+rng.randrange(80),x,510+rng.randrange(90))
  c.setFont('Helvetica',12);c.drawString(45,360,'1. Wat is het scenario?');c.drawString(45,337,'2. Wanneer vervalt het scenario?');c.drawString(45,314,'3. Hoe groot is het vooraf bepaalde risico?')
  if heavy:c.drawImage(images[(n-1)%12],45,60,200,200)
  c.setFont('Helvetica',10);c.drawRightString(550,30,str(n));c.showPage()
 c.save()
make('one',1);make('large',120,True);make('encrypted',2,encrypt=StandardEncryption('synthetic-only',ownerPassword='synthetic-owner'))
(out/'broken.pdf').write_bytes(b'%PDF-1.7\nsynthetic malformed file\n%%EOF')
print(json.dumps({p.name:p.stat().st_size for p in out.glob('*.pdf')}))
