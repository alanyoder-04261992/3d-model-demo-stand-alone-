# Static illustrations from exact lesson mesh data, not browser screenshots.
# From the repository: node tools/export-joist-render-data.mjs
# Then: python tools/render-joist-picture.py [--font FONT.ttf] [--font-bold BOLD.ttf]
# Development-only dependencies: python -m pip install Pillow numpy
# Reads test/out/joist-render-data.json; writes images/floor-joists.png and
# images/floor-joist-connection.png and images/floor-end-backing.png.
# Pass --deck to both the Node exporter and this script to write only
# images/flooring.png, flooring-closeup.png and flooring-layout.png from flooring-render-data.json.
# Windows Segoe UI preserves the original
# layout; other fonts can change text metrics. No website runtime dependencies.
import argparse, json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Render exact floor-lesson meshes as annotated PNGs.')
parser.add_argument('--deck',action='store_true',help='Read flooring-render-data.json and render flooring overview and layout only.')
parser.add_argument('--wall',action='store_true',help='Render the side wall study, plate/double-stud detail and wall-end setback close-up.')
parser.add_argument('--end-wall',action='store_true',help='Render the end wall study and upper-plate setback close-up.')
parser.add_argument('--gable',action='store_true',help='Render the 2x6 along the end-wall upper plate and its measured connection.')
parser.add_argument('--truss',action='store_true',help='Render the measured truss fit preview and upper-plate projection detail.')
parser.add_argument('--window',help='Render an adjustable window example exported as WIDTHxHEIGHT.')
parser.add_argument('--header',action='store_true',help='Render the loft window header and outside ledge from header-render-data.json.')
parser.add_argument('--window-plate',action='store_true',help='Render the flat window plate and supporting studs from window-plate-render-data.json.')
parser.add_argument('--doorway',choices=['loft','flat','to-plate'],help='Render one learned doorway arrangement from its exact mesh.')
parser.add_argument('--utility',choices=['window','door'],help='Render the utility top window plate or doorway from exact mesh data.')
parser.add_argument('--font',help='Regular TrueType font path; defaults to Windows Segoe UI, then DejaVu Sans.')
parser.add_argument('--font-bold',help='Bold TrueType font path; otherwise uses --font when provided.')
args=parser.parse_args()
source='utility-'+args.utility if args.utility else 'doorway-'+args.doorway if args.doorway else 'window-plate' if args.window_plate else 'header' if args.header else 'window-'+args.window if args.window else 'truss' if args.truss else 'gable' if args.gable else 'end-wall' if args.end_wall else 'side-wall' if args.wall else 'flooring' if args.deck else 'joist'
data=json.loads((ROOT/f'test/out/{source}-render-data.json').read_text(encoding='utf-8'))
W,H=1200,940
NAVY='#173b56'
textures={name:np.frombuffer((ROOT/'test/out'/spec['file']).read_bytes(),dtype=np.uint8).reshape(spec['height'],spec['width'],4)
          for name,spec in data.get('textures',{}).items()}
flooring_mips={}
for name,tex in textures.items():
    if not name.startswith('lessonFlooring-'): continue
    levels=[tex]
    while min(levels[-1].shape[:2])>1:
        h,w=levels[-1].shape[:2]
        levels.append(np.asarray(Image.fromarray(levels[-1]).resize((max(1,w//2),max(1,h//2)),Image.Resampling.BOX)))
    flooring_mips[name]=levels

def sample_flooring(name,mapped,uv,s):
    # Match the browser's mipmapped linear sampling: very fine ribs become
    # quiet at overview scale instead of aliasing into broad false bands.
    levels=flooring_mips[name]
    derivatives=np.linalg.solve(np.array([s[1]-s[0],s[2]-s[0]]),np.array([uv[1]-uv[0],uv[2]-uv[0]]))
    texels=derivatives*np.array([levels[0].shape[1],levels[0].shape[0]])
    lod=max(0,min(len(levels)-1,math.log2(max(1,np.linalg.norm(texels[0]),np.linalg.norm(texels[1])))))
    def bilinear(tex):
        h,w=tex.shape[:2]
        x=(mapped[...,0]%1)*w-.5;y=(mapped[...,1]%1)*h-.5
        ix=np.floor(x).astype(int);iy=np.floor(y).astype(int)
        fx=(x-ix)[...,None];fy=(y-iy)[...,None]
        return ((1-fx)*(1-fy)*tex[iy%h,ix%w,:3]+fx*(1-fy)*tex[iy%h,(ix+1)%w,:3]
                +(1-fx)*fy*tex[(iy+1)%h,ix%w,:3]+fx*fy*tex[(iy+1)%h,(ix+1)%w,:3])/255
    low=math.floor(lod);high=min(low+1,len(levels)-1);blend=lod-low
    return bilinear(levels[low])*(1-blend)+bilinear(levels[high])*blend
def font(size,bold=False):
    override=(args.font_bold or args.font) if bold else args.font
    if override:
        return ImageFont.truetype(override,size)
    for name in ['C:/Windows/Fonts/segoeui'+('b' if bold else '')+'.ttf',
                 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf']:
        try:
            return ImageFont.truetype(name,size)
        except OSError:
            pass
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()

def scene(target=None,extent=None,yaw=.78,pitch=.70):
    bg=np.full((H,W,3),[237,242,246],dtype=np.uint8)
    depth=np.full((H,W),-np.inf)
    cam=np.array([math.sin(yaw)*math.cos(pitch),math.sin(pitch),math.cos(yaw)*math.cos(pitch)])
    right=np.array([math.cos(yaw),0,-math.sin(yaw)])
    up=np.cross(cam,right)
    points=np.array([v for g in data['groups'] for t in g['triangles'] for v in t['positions']])
    if target is None:
        px=points@right; py=points@up
        scale=min(1040/(px.max()-px.min()),490/(py.max()-py.min()))
        midx=(px.max()+px.min())/2; midy=(py.max()+py.min())/2
    else:
        midx=np.dot(target,right);midy=np.dot(target,up);scale=1000/extent
    def project(p):
        p=np.asarray(p)
        return np.array([600+(np.dot(p,right)-midx)*scale,420-(np.dot(p,up)-midy)*scale])
    light=cam+np.array([.0,1,.2]);light/=np.linalg.norm(light)
    for g in data['groups']:
        tint=np.array(g['material']['tint'])
        rgb=np.where(tint<=.0031308,tint*12.92,1.055*tint**(1/2.4)-.055)*255
        for t in g['triangles']:
            p=np.array(t['positions']); normal=np.array(t['normals'][0])
            if np.dot(normal,cam)<1e-8:continue
            s=np.array([project(v) for v in p]); z=p@cam
            x0=max(25,math.floor(s[:,0].min()));x1=min(W-26,math.ceil(s[:,0].max()))
            y0=max(145,math.floor(s[:,1].min()));y1=min(705,math.ceil(s[:,1].max()))
            if x1<x0 or y1<y0:continue
            a,b,c=s
            den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(den)<1e-9:continue
            yy,xx=np.mgrid[y0:y1+1,x0:x1+1];xx=xx+.5;yy=yy+.5
            u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
            v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
            w=1-u-v;zz=u*z[0]+v*z[1]+w*z[2]
            sl=depth[y0:y1+1,x0:x1+1]
            mask=(u>=-1e-7)&(v>=-1e-7)&(w>=-1e-7)&(zz>sl)
            if not mask.any():continue
            tex=textures.get(g['material']['texture'])
            grain=np.ones((*u.shape,3))
            if tex is not None:
                uv=np.array(t['uv'])
                mapped=u[...,None]*uv[0]+v[...,None]*uv[1]+w[...,None]*uv[2]
                if g['material']['texture'] in flooring_mips:
                    grain=sample_flooring(g['material']['texture'],mapped,uv,s)
                else:
                    tx=np.floor((mapped[...,0]%1)*tex.shape[1]).astype(int)
                    ty=np.floor((mapped[...,1]%1)*tex.shape[0]).astype(int)
                    grain=tex[ty,tx,:3]/255.0
            shade=.64+.43*max(0,float(np.dot(normal,light)))
            color=np.clip(rgb[None,None,:]*shade*grain,0,255).astype(np.uint8)
            bg[y0:y1+1,x0:x1+1][mask]=color[mask];sl[mask]=zz[mask]
    return Image.fromarray(bg),project

def leader(d,point,box,title,lines,via=None):
    x,y,width,height=box
    endpoint=(x+width/2,y if point[1]<y else y+height)
    path=[tuple(point)]+(via or [])+[endpoint]
    d.line(path,fill='white',width=8)
    d.line(path,fill=NAVY,width=3)
    d.ellipse((point[0]-6,point[1]-6,point[0]+6,point[1]+6),fill=NAVY,outline='white',width=2)
    d.rounded_rectangle((x,y,x+width,y+height),radius=12,fill='white',outline='#bdccd8',width=2)
    d.text((x+20,y+12),title,font=font(28,True),fill=NAVY)
    for i,line in enumerate(lines): d.text((x+20,y+53+i*31),line,font=font(24),fill=NAVY)

def title(d,main,sub):
    d.rectangle((0,0,W,128),fill='#0a2c49')
    d.text((38,22),main,font=font(44,True),fill='white')
    d.text((40,80),sub,font=font(25),fill='#d5e5f0')

def dimension(d,project,p,q,label,offset=(0,0)):
    p=project(p);q=project(q);off=np.array(offset);a=p+off;b=q+off
    for start,end in [(p,a),(q,b),(a,b)]:
        d.line([tuple(start),tuple(end)],fill='white',width=7)
        d.line([tuple(start),tuple(end)],fill=NAVY,width=2)
    along=(b-a)/np.linalg.norm(b-a);cross=np.array([-along[1],along[0]])*7
    for point in [a,b]:d.line([tuple(point-cross),tuple(point+cross)],fill=NAVY,width=3)
    middle=(a+b)/2;f=font(23,True);box=d.textbbox((0,0),label,font=f)
    width=box[2]-box[0]+22
    d.rounded_rectangle((middle[0]-width/2,middle[1]-19,middle[0]+width/2,middle[1]+23),radius=5,fill='white')
    d.text((middle[0]-width/2+11,middle[1]-15),label,font=f,fill=NAVY)

def render_doorway():
    m=data['metadata']['doorway'];s=m['study'];bottom=m['plateMembers'][0]['bounds']
    mode=s['headerMode'];z=s['outsideZFt']
    target=[(s['x0Ft']+s['x1Ft'])/2,(bottom['y0Ft']+m['plateMembers'][-1]['bounds']['y1Ft'])/2,z+s['depthFt']/2]
    im,project=scene(target,13.5,yaw=3.02,pitch=.14);d=ImageDraw.Draw(im)
    names={'loft':'Doorway · loft header','flat':'Doorway · two flat header boards','to-plate':'Doorway · king studs to top plate'}
    title(d,names[mode],'Your shop terms · nominal 2×4 · actual 1½ × 3½ in')
    stud=m['studMembers'][1];king=m['kingMembers'][1]
    leader(d,project(stud['center']),(30,155,360,110),'Stud',['Full-height next to king stud'])
    if mode=='to-plate':
        point=[s['x1Ft']+s['thicknessFt']/2,s['studTopYFt'],z]
        leader(d,project(point),(790,155,380,143),'Top plate',['King studs touch its underside','No separate header below it'])
    else:
        header=m['headerMembers'][0]
        lines=['Two on edge on one flat board','5 in total height'] if mode=='loft' else ['Two flat 2×4s stacked','3 in total height']
        leader(d,project(header['center']),(790,155,380,143),'Header',lines)
        dimension(d,project,[s['x0Ft']-s['thicknessFt'],s['headerTopYFt'],z],
                  [s['x1Ft']+s['thicknessFt'],s['headerTopYFt'],z],f"{s['headerCutIn']:g} in · header cut",(0,-43))
    leader(d,project(king['center']),(30,737,460,110),'King stud',[f"{s['kingCutIn']:g} in cut · on the bottom plate"])
    leader(d,project([s['x0Ft']-s['thicknessFt']/2,s['studBottomYFt'],z]),(660,737,510,110),'Bottom plate',['The height starts at its top'])
    dimension(d,project,[s['x0Ft'],s['studBottomYFt'],z],[s['x1Ft'],s['studBottomYFt'],z],
              f"{s['widthIn']:g} in · opening",(0,38))
    # Draw only the butt seams, without inserting physical gaps.
    for record in m['kingMembers']:
        p=record['bounds'];edge=p['x1Ft'] if p['x0Ft']>0 else p['x0Ft']
        d.line([tuple(project([edge,p['y0Ft'],z])),tuple(project([edge,p['y1Ft'],z]))],fill='#78694f',width=1)
    for record in m['plateMembers'][1:]+m['headerMembers']:
        p=record['bounds']
        d.line([tuple(project([p['x0Ft'],p['y0Ft'],p['z0Ft']])),
                tuple(project([p['x1Ft'],p['y0Ft'],p['z0Ft']]))],fill='#78694f',width=1)
    if mode=='to-plate':
        footer=f"Example wall: {s['kingCutIn']:g} in from bottom-plate top to top-plate underside."
    else:
        footer=f"Header cut = {s['widthIn']:g} + {s['bearingEachEndIn']:g} + {s['bearingEachEndIn']:g} = {s['headerCutIn']:g} in. Width and height vary."
    d.text((35,883),footer,font=font(24),fill=NAVY)
    im.save(ROOT/f"images/doorway-{mode}.png")

def render_utility():
    if args.utility=='window':
        m=data['metadata']['utilityWindow'];s=m['study'];z=s['outsideZFt']
        top=m['plateMembers'][0];upper=m['plateMembers'][1]
        im,project=scene([(s['x0Ft']+s['x1Ft'])/2,(s['bottomYFt']+upper['bounds']['y1Ft'])/2,z+s['depthFt']/2],5.2,yaw=2.9,pitch=.2)
        d=ImageDraw.Draw(im)
        title(d,'Utility · top window plate','89-inch wall studs · one flat 2×4 · studs fill the space above')
        leader(d,project(top['center']),(30,155,385,110),'Top plate',['Stud tops meet its underside'])
        leader(d,project(upper['center']),(785,155,385,110),'Upper plate',['Separate board above top plate'])
        leader(d,project(m['plate']['center']),(30,737,530,110),'Top window plate',['Flat · 1½ in high × 3½ in deep'])
        stud=m['studMembers'][len(m['studMembers'])//2]
        leader(d,project(stud['center']),(670,737,500,110),'Studs above',[f"{m['studLengthIn']:g} in cut · vertical grain"])
        dimension(d,project,[s['x0Ft'],s['bottomYFt'],z],[s['x1Ft'],s['bottomYFt'],z],f"{s['lengthIn']:g} in · example plate cut",(0,42))
        dimension(d,project,[s['x0Ft'],s['topYFt'],z],[s['x0Ft'],s['studTopYFt'],z],f"{s['gapAboveIn']:g} in gap",(155,0))
        d.text((35,883),f"Plate top: {m['topPlateBottomAboveFloorIn']:g} − {s['gapAboveIn']:g} = {s['openingTopAboveFloorIn']+s['thicknessFt']*12:g} in above flooring. Upper studs: {m['studLengthIn']:g} in.",font=font(23),fill=NAVY)
        im.save(ROOT/'images/utility-window-top.png')
    else:
        m=data['metadata']['doorway'];s=m['study'];z=s['outsideZFt'];bottom=m['plateMembers'][0]['bounds']
        im,project=scene([(s['x0Ft']+s['x1Ft'])/2,(bottom['y0Ft']+m['plateMembers'][-1]['bounds']['y1Ft'])/2,z+s['depthFt']/2],16.5,yaw=3.02,pitch=.14)
        d=ImageDraw.Draw(im)
        title(d,'Utility doorway · studs above header','89-inch wall studs · example 80-inch king studs · 5-inch header')
        leader(d,project(m['studMembers'][1]['center']),(30,155,385,110),'Stud',['89 in cut · full height'])
        leader(d,project(m['aboveStudMembers'][0]['center']),(760,155,410,143),'Studs above header',[f"{m['gapAboveHeaderIn']:g} in cut · fill the gap",'Header top to top plate'])
        leader(d,project(m['kingMembers'][1]['center']),(30,737,510,110),'King stud',[f"{s['kingCutIn']:g} in cut · on bottom plate"])
        leader(d,project(m['headerMembers'][0]['center']),(670,737,500,110),'Header',[f"{s['headerCutIn']:g} in cut · {s['headerHeightIn']:g} in total height"])
        dimension(d,project,[s['x0Ft'],s['studBottomYFt'],z],[s['x1Ft'],s['studBottomYFt'],z],f"{s['widthIn']:g} in · example opening",(0,40))
        d.text((35,883),f"Studs above: 89 − {s['kingCutIn']:g} − {s['headerHeightIn']:g} = {m['gapAboveHeaderIn']:g} in. Header: opening + 1½ in at each end.",font=font(24),fill=NAVY)
        im.save(ROOT/'images/utility-doorway.png')

def render_window_plate():
    m=data['metadata']['windowPlate'];s=m['study'];b=m['bottomPlate']['bounds']
    assert abs(m['studLengthIn']-32.5)<1e-8 and s['clearHeightIn']==36, 'Refresh example labels if its inputs change.'
    target=[(s['x0Ft']+s['x1Ft'])/2,(s['topYFt']+b['y0Ft'])/2+.20,s['outsideZFt']+s['depthFt']/2]
    im,project=scene(target,8.4,yaw=.20,pitch=.20);d=ImageDraw.Draw(im)
    title(d,'Window plate and the studs below it','Lofted wall · studs stand on the bottom plate · same wall layout')
    z=s['outsideZFt']+s['depthFt']
    p=m['plate']['bounds'];stud=m['studMembers'][-1]['bounds']
    leader(d,project([s['x0Ft']+.18,s['topYFt'],z]),(30,150,420,110),'Window plate · flat 2×4',['1½ in tall · 3½ in deep'])
    dimension(d,project,[stud['x1Ft'],s['studBottomYFt'],z],[stud['x1Ft'],s['bottomYFt'],z],
              '32½ in · stud cut',(190,0))
    leader(d,project([s['x0Ft']+.12,(b['y0Ft']+b['y1Ft'])/2,z]),(30,737,455,110),
           'Bottom plate',['The studs sit directly on top'])
    leader(d,project(m['studMembers'][0]['center']),(665,150,505,110),
           'Original wall layout',['Double stud at the 4-ft mark'])
    leader(d,project([stud['x0Ft'],s['bottomYFt'],z]),(590,737,580,110),
           'Stud tops touch the window plate',['Their lengths change with window height'])
    # The 48-inch mark is the pair's joint, not either stud's center.
    marks=sorted(set(r['member']['meta']['markXFt'] for r in m['studMembers']))
    if len(marks)>1:
        dimension(d,project,[marks[0],s['studBottomYFt'],z],
                  [marks[1],s['studBottomYFt'],z],'16 in · layout marks',(0,44))
    d.text((35,886),'Example: 71½ − 36 − 1½ − 1½ = 32½ in. Window height is adjustable.',font=font(24),fill=NAVY)
    im.save(ROOT/'images/window-plate-studs.png')

def render_header():
    m=data['metadata']['header'];s=m['study']
    x=s['centerXFt']+s['lengthFt']/2;y=s['bottomYFt'];z=s['outsideZFt']
    t=s['thicknessFt'];dep=s['depthFt'];ledge=s['ledgeFt'];top=s['topYFt']
    # End view: only the three header boards. Use their exact exported
    # triangles, omit the two plate portions by height, and face the end.
    saved=data['groups']
    data['groups']=[dict(g,triangles=[tri for tri in g['triangles']
        if max(p[1] for p in tri['positions'])<=top+1e-8
        and min(p[1] for p in tri['positions'])<top-1e-8]) for g in saved]
    im,project=scene([x,(y+top)/2,z+dep/2],.94,yaw=math.pi/2,pitch=0)
    d=ImageDraw.Draw(im)
    title(d,'Loft window header · end view','Three 2×4s · 1½ × 3½ in actual · ½-in ledge OUTSIDE')
    # A fine cut boundary distinguishes the touching boards without a gap.
    for a,b in [([x,y+t,z+ledge],[x,y+t,z+dep]),
                ([x,y+t,z+ledge+t],[x,top,z+ledge+t])]:
        d.line([tuple(project(a)),tuple(project(b))],fill='#776951',width=2)
    dimension(d,project,[x,y,z],[x,top,z],'5 in tall',(210,0))
    dimension(d,project,[x,y,z],[x,y,z+dep],'3½ in wide',(0,55))
    leader(d,project([x,y+t,z+ledge/2]),(775,590,385,108),'Outside ledge',['½ in left uncovered'])
    leader(d,project([x,y+t+0.12,z+ledge+t]),(35,155,400,143),'Two boards on edge',['Touching side by side','Each is 1½ × 3½ in'])
    leader(d,project([x,y+t/2,z+dep/2]),(35,740,570,110),'Flat board under the header',['1½ in tall · 3½ in deep'])
    d.text((335,660),'INSIDE',font=font(23,True),fill=NAVY)
    d.text((635,660),'OUTSIDE',font=font(23,True),fill=NAVY)
    d.text((40,890),'Inside faces are flush. This flat board is part of the header.',font=font(24),fill=NAVY)
    im.save(ROOT/'images/window-header-section.png')
    data['groups']=saved
    # Along the front/outside and right cut end; include real plate datums.
    im,project=scene([s['centerXFt'],top-.02,z+dep/2],3.75,yaw=2.30,pitch=.40)
    d=ImageDraw.Draw(im)
    title(d,'Window header against the top plate','Loft header · top plate touches the two boards on edge')
    leader(d,project([.55,top+t*1.5,z]),(30,150,420,110),'Upper plate',['Portion shown above top plate'])
    leader(d,project([.6,top+t/2,z]),(735,150,435,110),'Top plate',['Header touches its underside'])
    leader(d,project([-.5,top-.13,z+ledge]),(40,735,540,110),'Window header · 5 in tall',['Two on edge, on one flat 2×4'])
    leader(d,project([.6,y+t,z+ledge/2]),(640,735,520,110),'Outside of wall',['½-in ledge on the flat board'])
    d.text((35,883),'36-in sample cut length only; window width and support details vary.',font=font(24),fill=NAVY)
    im.save(ROOT/'images/window-header-fit.png')

def render_truss():
    m=data['metadata']['truss'];g=data['metadata']['gable'];a=m['anchors']
    board=g['board']['bounds'];plate=g['upperPlate']['bounds']
    assert abs(m['upperLengthFt']*12-54)<1e-7
    assert abs(m['lowerLengthFt']*12-37.75)<1e-7
    assert abs(m['peakRiseFt']*12-48)<1e-7
    assert abs(abs(a['leftTip'][0]-a['leftPlateCut'][0])*12-6.25)<1e-7
    target=[a['peak'][0],a['upperPlateTop'][1]+1.8,a['gableTop'][2]]
    im,project=scene(target,12.8,yaw=.12,pitch=.05);d=ImageDraw.Draw(im)
    title(d,'Truss and gable studs','2×4 truss · measured lengths · 4 ft from upper plate to peak')
    dimension(d,project,a['upperLeftStart'],a['upperLeftEnd'],'54 in · upper piece',(-10,-30))
    dimension(d,project,a['lowerLeftStart'],a['lowerLeftEnd'],'37¾ in · lower piece',(-65,0))
    dimension(d,project,a['upperPlateTop'],a['peak'],'48 in · 4 ft',(455,0))
    centers=a['studCenters']
    if len(centers)>1:
        pair=sorted(centers,key=lambda p:abs(p[0]))[:2]
        dimension(d,project,pair[0],pair[1],'24 in on center',(0,55))
    stud=min(m['studMembers'],key=lambda r:r['center'][0])
    leader(d,project(stud['center']),(35,748,545,111),'Gable studs',['Wide face outward · on the gable board'])
    leader(d,project([2,board['y0Ft']+.22,board['z1Ft']]),(620,748,545,111),'Gable board · 2×6',['118 in · nailed to the upper plate'])
    d.text((35,895),'Fit preview · first-center interpretation, mirrored ends and top joints to check.',font=font(23),fill='#526879')
    im.save(ROOT/'images/truss-framing.png')

    # Backing close-up uses the same solid members and exact plate-top datum.
    backing=m['backingMembers']
    if backing:
        assert len(backing)==5
        piece=backing[len(backing)//2];b=piece['bounds'];z=piece['z1Ft']
        assert abs((b['y0Ft']-plate['y1Ft'])*12-11)<1e-8
        assert abs(piece['lengthFt']*12-20.5)<1e-8
        target=[piece['center'][0],plate['y1Ft']+.83,z]
        im,project=scene(target,12.8,yaw=.04,pitch=.10);d=ImageDraw.Draw(im)
        title(d,'Gable backing','Horizontal 2×4 · bottom 11 in above the top of the upper plate')
        dimx=2.55
        dimension(d,project,[dimx,plate['y1Ft'],z],[dimx,b['y0Ft'],z],'11 in · to bottom',(0,0))
        dimension(d,project,[b['x0Ft'],b['y1Ft'],z],[b['x1Ft'],b['y1Ft'],z],'20½ in clear length',(0,-37))
        leader(d,project([backing[0]['center'][0],backing[0]['center'][1],z]),(35,150,475,110),
               'Gable backing · 2×4',['Supports the siding at its seams'])
        leader(d,project([2.65,plate['y1Ft'],plate['z1Ft']]),(620,748,545,111),
               'Upper plate',['Measure from its TOP to backing bottom'])
        outer=backing[0]
        leader(d,project([outer['bounds']['x0Ft']+.12,outer['bounds']['y0Ft']+.10,z]),(35,748,545,111),
               'Backing reaches the outer truss',['Both outer bays included · five pieces'])
        d.text((35,895),'No window or fake window · three internal cuts: 20½ in · outer cuts follow truss',font=font(23),fill='#526879')
        im.save(ROOT/'images/gable-backing.png')

    # A straight-on view makes the end-wall datum and stud center marks clear.
    target=[a['peak'][0],a['upperPlateTop'][1]+1.8,a['gableTop'][2]]
    im,project=scene(target,12.8,yaw=0,pitch=0);d=ImageDraw.Draw(im)
    title(d,'Gable studs · end-wall layout','2×4 · 3½ in face outward · centers measured from outside wall edge')
    layout_y=a['gableTop'][1];layout_z=centers[0][2]
    origin=a['wallLayoutOrigin'];origin_witness=[origin[0],layout_y,layout_z]
    d.line([tuple(project(origin)),tuple(project(origin_witness))],fill=NAVY,width=2)
    marks=[origin_witness]+centers
    for i in range(len(marks)-1):
        label=f'{abs(marks[i+1][0]-marks[i][0])*12:g} in'
        dimension(d,project,marks[i],marks[i+1],label,(0,83))
    for center,distance in zip(centers,m['studWallDistancesFt']):
        point=project([center[0],layout_y+.3,center[2]])
        label=f'{distance*12:g} in'
        f=font(22,True);bbox=d.textbbox((0,0),label,font=f);width=bbox[2]-bbox[0]+18
        d.rounded_rectangle((point[0]-width/2,point[1]-16,point[0]+width/2,point[1]+19),radius=4,fill='white')
        d.text((point[0]-width/2+9,point[1]-13),label,font=f,fill=NAVY)
    leader(d,project(origin),(35,748,545,111),'Outside end-wall edge',['Hook tape here · measurements locate centers'])
    outer_stud=max(m['studMembers'],key=lambda member:member['center'][0])
    outer_point=project(outer_stud['center'])
    leader(d,outer_point,(620,748,545,111),'Gable studs · 2×4',
           ['Wide face outward · seated on gable board'],via=[(1100,outer_point[1]),(1100,730)])
    d.text((35,895),'First center shown at 24 in: interpretation of “centered” · top joints remain a preview.',font=font(22),fill='#526879')
    im.save(ROOT/'images/gable-stud-layout.png')

    tip=a['leftTip'];cut=a['leftPlateCut']
    target=[(tip[0]+cut[0])/2+.10,board['y0Ft']+.22,board['z1Ft']+.10]
    im,project=scene(target,2.5,yaw=-.48,pitch=.32);d=ImageDraw.Draw(im)
    title(d,'Truss tip to upper plate','Your marked measurement · 6¼ in outward from the plate’s cut end')
    # Horizontal witness points retain the different elevations of the actual anchors.
    projection_y=a['upperPlateTop'][1]-.25;z=tip[2]
    tip_witness=[tip[0],projection_y,z];cut_witness=[cut[0],projection_y,z]
    for actual,witness in [(tip,tip_witness),(cut,cut_witness)]:
        d.line([tuple(project(actual)),tuple(project(witness))],fill=NAVY,width=2)
    dimension(d,project,tip_witness,cut_witness,'6¼ in · from upper plate',(0,62))
    lower_point=[.85*p+.15*q for p,q in zip(a['lowerLeftStart'],a['lowerLeftEnd'])]
    leader(d,project(lower_point),(35,150,420,110),'Truss · 2×4',['In front of the gable board'])
    leader(d,project([plate['x0Ft'],(plate['y0Ft']+plate['y1Ft'])/2,plate['z1Ft']]),(630,748,535,111),'Upper plate cut end',['Start of the 6¼-inch measurement'])
    leader(d,project([board['x0Ft']+.5,board['y1Ft']-.22,board['z1Ft']]),(730,150,435,142),'Gable board',['Extends 2½ in past','this same plate cut'])
    d.text((35,895),'Whole bottom cut level with gable-board bottom · peak 48 in above upper plate.',font=font(22),fill='#526879')
    im.save(ROOT/'images/truss-connection.png')

def render_gable():
    wall=data['metadata']['wall'];gable=data['metadata']['gable']
    board=gable['board'];b=board['bounds'];upper=wall['plates']['upper'];p=upper['bounds']
    top=wall['plates']['top'];t=top['bounds']
    # The physical edge and Alan's corrected ledge names are separate inputs.
    near=(p['x0Ft']-b['x0Ft'])*12;far=(b['x1Ft']-p['x1Ft'])*12
    opposite_ledge=(p['z1Ft']-b['z1Ft'])*12
    wall_line_ledge=(b['z0Ft']-p['z0Ft'])*12;length=(b['x1Ft']-b['x0Ft'])*12
    assert abs(near-2.5)<1e-8 and abs(far-2.5)<1e-8
    assert abs(wall_line_ledge-.5)<1e-8 and abs(opposite_ledge-1.5)<1e-8 and abs(length-118)<1e-8
    assert gable['ledgeEdge']=='wall-line' and gable['ledgeSide']=='inside'
    assert abs(gable['innerLedgeFt']*12-.5)<1e-8 and abs(gable['outerLedgeFt']*12-1.5)<1e-8
    assert abs(b['y0Ft']-p['y1Ft'])<1e-8
    assert abs((b['y1Ft']-b['y0Ft'])*12-5.5)<1e-8
    assert abs((b['z1Ft']-b['z0Ft'])*12-1.5)<1e-8
    def face(box,x,y):return [x,y,box['z1Ft']]
    im,project=scene(yaw=.32,pitch=.35);d=ImageDraw.Draw(im)
    title(d,'End wall · gable board','2×6 standing on edge, nailed to the upper plate')
    leader(d,project(face(b,-1.8,(b['y0Ft']+b['y1Ft'])/2)),(35,150,480,110),
           'Gable board',['2×6 · 1½ × 5½ in actual · on edge'])
    leader(d,project(face(p,2.2,(p['y0Ft']+p['y1Ft'])/2)),(840,300,325,110),
           'Upper plate',['9 ft 5 in · underneath'])
    dimension(d,project,face(b,b['x0Ft'],b['y1Ft']),face(b,b['x1Ft'],b['y1Ft']),
              '118 in · 9 ft 10 in',(0,-43))
    leader(d,project(face(b,b['x0Ft']+.05,b['y0Ft']+.06)),(35,748,545,111),
           '2½ in past each cut end',['Measured from the upper plate’s end'])
    leader(d,project([1.5,p['y1Ft'],(p['z1Ft']+b['z1Ft'])/2]),(620,748,545,111),
           '1½ in outside ledge',['½ in inside ledge on the other edge'])
    d.text((35,895),'Calculated length: 113 + 2½ + 2½ = 118 in. The end wall remains 120 in.',font=font(22),fill='#526879')
    (ROOT/'images').mkdir(exist_ok=True)
    im.save(ROOT/'images/gable-framing.png')

    # Show the selected physical face to expose the ledge Alan calls inside.
    def selected_face(box,x,y):return [x,y,box['z0Ft']]
    target=[p['x1Ft']-.48,p['y1Ft']+.10,p['z0Ft']]
    im,project=scene(target,1.7,yaw=math.pi-.62,pitch=.62);d=ImageDraw.Draw(im)
    title(d,'Gable board · new position','½ in inside ledge · 1½ in outside · 2½ in past the plate cut')
    leader(d,project(selected_face(b,p['x1Ft']-.78,b['y1Ft']-.19)),(675,150,490,110),
           'Gable board · 2×6',['Bottom rests on the upper plate'])
    leader(d,project(selected_face(p,p['x1Ft']-.52,p['y0Ft']+.055)),(35,748,540,111),
           'Upper plate',['2×4 · 1½ × 3½ in actual'])
    # The extension is lengthwise. Both endpoints use the same selected face.
    dimension(d,project,selected_face(b,b['x1Ft'],b['y0Ft']),selected_face(b,p['x1Ft'],b['y0Ft']),
              '2½ in past cut',(-38,45))
    x=p['x1Ft']-.86
    dimension(d,project,[x,p['y1Ft'],b['z0Ft']],[x,p['y1Ft'],p['z0Ft']],
              '½ in inside ledge',(95,80))
    # Place the section-height dimension at the visible cut end of the 2x6.
    dimension(d,project,selected_face(b,b['x1Ft'],b['y0Ft']),selected_face(b,b['x1Ft'],b['y1Ft']),
              '5½ in',(-50,-8))
    d.rounded_rectangle((620,748,1165,859),radius=12,fill='white',outline='#bdccd8',width=2)
    d.text((640,760),'Same projection at both ends',font=font(27,True),fill=NAVY)
    d.text((640,801),'2×6 length: 9 ft 5 in + 5 in = 9 ft 10 in',font=font(23),fill=NAVY)
    d.text((35,895),'The 2½ in is measured lengthwise past the upper plate’s cut end.',font=font(22),fill='#526879')
    im.save(ROOT/'images/gable-board-detail.png')

def render_wall():
    wall=data['metadata']['wall'];members=wall['members'];bounds=wall['bounds']
    end=args.end_wall;along=0 if end else 2;face=2 if end else 0
    studs=[m for m in members if m['member']['kind']=='stud']
    plates={m['member']['kind']:m for m in members if 'plate' in m['member']['kind']}
    bottom=plates['bottom-plate'];top=plates['top-plate'];upper=plates['upper-plate']
    assert abs((bounds['y1Ft']-bounds['y0Ft'])*12-79.5)<1e-8
    assert all(abs(s['lengthFt']*12-75)<1e-8 for s in studs)
    assert abs(bottom['lengthFt']*12-(120 if end else 185))<1e-8
    assert abs(top['lengthFt']-bottom['lengthFt'])<1e-8
    assert abs(upper['lengthFt']*12-(113 if end else 192))<1e-8
    def cut_label(record):
        inches=round(record['lengthFt']*12,8);feet=int(inches//12);remaining=inches-feet*12
        return f'{feet} ft'+(f' {remaining:g} in' if remaining else '')
    def low(record):return record['bounds']['x0Ft'] if end else record['bounds']['z0Ft']
    def high(record):return record['bounds']['x1Ft'] if end else record['bounds']['z1Ft']
    inside=bounds['z1Ft'] if end else bounds['x0Ft']
    def front(record,height=None,along_value=None):
        p=record['center'].copy();p[face]=inside
        if height is not None:p[1]=height
        if along_value is not None:p[along]=along_value
        return p
    def board_edges(im,project,detail=False):
        overlay=Image.new('RGBA',im.size);od=ImageDraw.Draw(overlay)
        for record in members:
            b=record['bounds'];a0=b['x0Ft'] if end else b['z0Ft'];a1=b['x1Ft'] if end else b['z1Ft']
            points=[front(record,y,a) for a,y in [(a0,b['y0Ft']),(a1,b['y0Ft']),(a1,b['y1Ft']),(a0,b['y1Ft'])]]
            od.line([tuple(project(p)) for p in points+[points[0]]],fill=(113,94,65,165 if detail else 100),width=2 if detail else 1)
        crop=overlay.crop((25,145,W-25,706));im.paste(crop,(25,145),crop)
    yaw=.42 if end else -1.02
    im,project=scene(yaw=yaw,pitch=.4)
    board_edges(im,project);d=ImageDraw.Draw(im)
    name='End wall' if end else 'Side wall';span=10 if end else 16
    title(d,f'{name} · {span} ft','2×4 framing · 75 in studs · 16 in on center · doubled every 4 ft')
    stud=sorted(studs,key=lambda m:abs(m['center'][along]+1.25))[0]
    leader(d,project(front(upper,along_value=-2)),(35,150,335,106),'Upper plate',[cut_label(upper)+(' · cut back' if end else ' · full length')])
    leader(d,project(front(top,along_value=2)),(840,150,325,106),'Top plate',[cut_label(top)+(' · full length' if end else ' · cut back')])
    leader(d,project(front(stud)),(35,748,530,111),'Stud · 75 in cut length',['2×4 nominal · 1½ × 3½ in actual'])
    leader(d,project(front(bottom,along_value=2)),(620,748,545,111),'Bottom plate',[cut_label(bottom)+' · rests on the flooring'])
    start=front(bottom,bottom['bounds']['y0Ft'],low(bottom));finish=front(bottom,bottom['bounds']['y0Ft'],high(bottom))
    dimension(d,project,start,finish,cut_label(bottom)+' frame',(0,35))
    height_at=max(low(bottom),low(upper))
    outer=front(bottom,bounds['y0Ft'],height_at);outer_top=front(upper,bounds['y1Ft'],height_at)
    dimension(d,project,outer,outer_top,'79½ in overall',(-38,0))
    end_rule='Upper plate back 3½ in at each end; bottom and top plates stay 10 ft.' if end else 'Frame back 3½ in at each end; the upper plate stays the full 16 ft.'
    d.text((35,895),end_rule,font=font(22),fill='#526879')
    (ROOT/'images').mkdir(exist_ok=True)
    im.save(ROOT/('images/end-wall-framing.png' if end else 'images/wall-framing.png'))

    # Exact end geometry: side frame stops short under the full upper plate;
    # end-wall upper plate stops short above the full top plate.
    near_stud=min(studs,key=low)
    assert abs(low(near_stud)-low(bottom))<1e-8
    assert abs(abs(low(upper)-low(top))*12-3.5)<1e-8
    assert abs(abs(high(upper)-high(top))*12-3.5)<1e-8
    target=front(top,top['bounds']['y1Ft']-.17,min(low(top),low(upper))+.5)
    im,project=scene(target,2.35,yaw=-.6 if end else -2.17,pitch=.33)
    board_edges(im,project,detail=True);d=ImageDraw.Draw(im)
    title(d,f'{name} · 3½-inch end detail',
          'Upper plate shortened at both ends · wall frame stays full width' if end else
          'Frame shortened at both ends · upper plate stays full length')
    leader(d,project(front(upper,along_value=low(upper)+.62)),(35,150,440,110),'Upper plate',
           [cut_label(upper)+(' · 3½ in back each end' if end else ' · uncut length')])
    leader(d,project(front(top,along_value=low(top)+.77)),(740,150,425,110),'Top plate',
           [cut_label(top)+(' · full width' if end else ' · frame length')])
    y=top['bounds']['y1Ft']
    p=front(top,y,low(top));q=front(upper,y,low(upper))
    dimension(d,project,p,q,'3½ in',(-25,-72))
    leader(d,project(front(near_stud,near_stud['bounds']['y1Ft']-.48)),(35,748,535,111),'End stud',
           ['At the full-width frame end' if end else 'Set back 3½ in with the frame'])
    d.rounded_rectangle((620,748,1165,859),radius=12,fill='white',outline='#bdccd8',width=2)
    d.text((640,760),'Same cut at the other end',font=font(28,True),fill=NAVY)
    d.text((640,801),('Upper plate: 120 − 3½ − 3½ = 113 in' if end else 'Frame plates: 192 − 3½ − 3½ = 185 in'),font=font(24),fill=NAVY)
    d.text((35,895),'Bottom plate follows the top plate’s length; all studs remain 75 in tall.',font=font(22),fill='#526879')
    im.save(ROOT/('images/end-wall-plate-detail.png' if end else 'images/wall-end-detail.png'))
    if end:return

    ordered=sorted(studs,key=lambda m:m['center'][along]);pair=None
    for a,c in zip(ordered,ordered[1:]):
        if abs(c['center'][along]-a['center'][along]-.125)<1e-8:
            pair=[a,c];break
    assert pair is not None
    joint=(pair[0]['center'][along]+pair[1]['center'][along])/2
    target=front(top,top['bounds']['y0Ft']-.25,joint)
    im,project=scene(target,2.35,yaw=-1.3,pitch=.24)
    board_edges(im,project,detail=True);d=ImageDraw.Draw(im)
    title(d,'Top plates + double stud','The 4-foot mark falls between the two touching studs')
    leader(d,project(front(upper,along_value=joint-.18)),(35,150,335,106),'Upper plate',['Second board on top'])
    leader(d,project(front(top,along_value=joint+.2)),(840,150,325,106),'Top plate',['Board touching the studs'])
    y=top['bounds']['y0Ft']-.65
    leader(d,project(front(pair[0],y)),(35,748,530,111),'Double stud',['Two touching 2×4 studs'])
    leader(d,project(front(pair[0],y,joint)),(620,748,545,111),'4-foot mark',['Between the two studs'])
    d.text((35,895),'Each board: 1½ × 3½ in actual · 75 + 1½ + 1½ + 1½ = 79½ in wall height',font=font(22),fill='#526879')
    im.save(ROOT/'images/wall-framing-detail.png')

def render_flooring():
    deck=data['metadata']['deck'];b=deck['bounds'];rows=deck['rows']
    assert len(deck['sheets'])==7 and len(rows)==3
    assert abs(deck['thicknessFt']*12-.625)<1e-9
    assert abs(b['x1Ft']-b['x0Ft']-10)<1e-9 and abs(b['z1Ft']-b['z0Ft']-16)<1e-9
    assert [[round(s['alongFt'],6) for s in row['sheets']] for row in rows]==[[8,8],[4,8,4],[8,8]]
    assert [round(row['widthFt'],6) for row in rows]==[4,4,2]
    (ROOT/'images').mkdir(exist_ok=True)
    im,project=scene()
    d=ImageDraw.Draw(im)
    title(d,'Flooring · 10 × 16','4 × 8 ft sheets · ⅝ in thick · tongue and groove')
    def seam_lines(im,project):
        edges={};overlay=Image.new('RGBA',im.size);od=ImageDraw.Draw(overlay)
        for s in deck['sheets']:
            y=s['bounds']['y1Ft']
            points=[(x,y,z) for x,z in [(s['x0Ft'],s['z0Ft']),(s['x1Ft'],s['z0Ft']),
                     (s['x1Ft'],s['z1Ft']),(s['x0Ft'],s['z1Ft'])]]
            for a,c in zip(points,points[1:]+points[:1]):
                axis=0 if a[0]!=c[0] else 2;fixed=2 if axis==0 else 0
                key=(axis,a[fixed],y)
                edges.setdefault(key,[]).append(sorted((a[axis],c[axis])))
        # Staggered panels share partial long edges. Merge their intervals,
        # not just identical segments, to keep every seam the same faint tone.
        for (axis,fixed,y),intervals in edges.items():
            merged=[]
            for lo,hi in sorted(intervals):
                if merged and lo<=merged[-1][1]+1e-9:merged[-1][1]=max(merged[-1][1],hi)
                else:merged.append([lo,hi])
            for lo,hi in merged:
                a=(lo,y,fixed) if axis==0 else (fixed,y,lo)
                c=(hi,y,fixed) if axis==0 else (fixed,y,hi)
                od.line([tuple(project(a)),tuple(project(c))],fill=(85,80,70,90),width=1)
        crop=overlay.crop((25,145,W-25,706));im.paste(crop,(25,145),crop)
    seam_lines(im,project)
    yt=b['y1Ft']
    dimension(d,project,[b['x0Ft'],yt,b['z0Ft']],[b['x0Ft'],yt,b['z1Ft']],'16 ft',(-20,-30))
    dimension(d,project,[b['x0Ft'],yt,b['z1Ft']],[b['x1Ft'],yt,b['z1Ft']],'10 ft',(0,38))
    dimension(d,project,[b['x1Ft'],b['y0Ft'],b['z0Ft']],[b['x1Ft'],yt,b['z0Ft']],'⅝ in',(35,0))
    for i,row in enumerate(rows):
        x=(row['x0Ft']+row['x1Ft'])/2
        point=project([x,yt,0 if i!=1 else 2])
        texts=[('Row 1 · 4 ft wide',['8 ft + 8 ft']),('Row 2 · staggered',['4 ft + 8 ft + 4 ft']),
               ('Row 3 · trimmed',['2 ft wide · 8 ft + 8 ft'])]
        label,lines=texts[i]
        leader(d,point,(40+i*390,748,355,110),label,lines)
    d.text((40,890),'Fine ribbed surface from your photo reference · subtle sheet joints',font=font(23),fill='#526879')
    im.save(ROOT/'images/flooring.png')

    im,project=scene([-1,b['y1Ft'],-4],1.65,yaw=.18,pitch=1.04)
    seam_lines(im,project);d=ImageDraw.Draw(im)
    title(d,'Flooring · surface close-up','Fine parallel ribs · matte taupe-brown finish · quieter seams')
    leader(d,project([-.78,b['y1Ft'],-3.95]),(620,748,540,110),'Fine ribbed texture',['Based on your close-up photo'])
    leader(d,project([-1,b['y1Ft'],-4.18]),(40,748,530,110),'Tight sheet joint',['Hairline drawn at the real sheet edge'])
    d.text((40,890),'Surface detail is illustrative; the sheet sizes and ⅝ in thickness are unchanged.',font=font(22),fill='#526879')
    im.save(ROOT/'images/flooring-closeup.png')

    # Orthographic plan drawn directly from the same seven measured sheet rectangles.
    plan=Image.new('RGB',(1200,1080),'#edf2f6');d=ImageDraw.Draw(plan)
    title(d,'Flooring · staggered seams','Top view · each rectangle is one laid piece · dimensions in feet')
    left,top,scale=125,260,59
    def point(x,z):
        return (left+(z-b['z0Ft'])*scale,top+(x-b['x0Ft'])*scale)
    colors=['#d9bd89','#e5cca3','#cae0df']
    def centered(text,x,y,size=29,bold=True,color=NAVY):
        d.text((x,y),text,font=font(size,bold),fill=color,anchor='mm')
    for row in rows:
        i=row['row']
        for s in row['sheets']:
            a=point(s['x0Ft'],s['z0Ft']);c=point(s['x1Ft'],s['z1Ft'])
            d.rectangle((*a,*c),fill=colors[i],outline='#827965',width=1)
            cx=(a[0]+c[0])/2;cy=(a[1]+c[1])/2
            centered(f"{s['acrossFt']:g} × {s['alongFt']:g} ft",cx,cy-14,31)
            centered('Trimmed width' if row['trimmed'] else ('Half sheet' if s['alongFt']==4 else 'Full sheet'),cx,cy+24,23,False)
        y=(point(row['x0Ft'],b['z0Ft'])[1]+point(row['x1Ft'],b['z0Ft'])[1])/2
        centered(f"Row {i+1}",64,y-20,22)
        centered(f"{row['widthFt']:g} ft",64,y+13,25)
    # Highlight only the sheet end joints, so their alternating positions read clearly.
    for joint in deck['endJoints']:
        a=point(joint['x0Ft'],joint['zFt']);c=point(joint['x1Ft'],joint['zFt'])
        d.line([a,c],fill='#827965',width=2)
    d.line([(left,218),(left+16*scale,218)],fill=NAVY,width=2)
    for ft in [0,4,8,12,16]:
        x=left+ft*scale
        d.line([(x,207),(x,230)],fill=NAVY,width=3)
        centered(f'{ft} ft',x,186,25)
    d.line([(left+16*scale+37,top),(left+16*scale+37,top+10*scale)],fill=NAVY,width=2)
    for y in [top,top+10*scale]:d.line([(left+16*scale+27,y),(left+16*scale+47,y)],fill=NAVY,width=3)
    centered('10 ft',1122,top+5*scale,23)
    d.rounded_rectangle((40,885,1160,1000),radius=12,fill='white',outline='#bdccd8',width=2)
    d.text((62,902),'Staggered = the next row’s end seams move over.',font=font(29,True),fill=NAVY)
    d.text((62,948),'Row 2: 4 + 8 + 4 ft. Final row width: 10 − 4 − 4 = 2 ft.',font=font(27),fill=NAVY)
    d.text((40,1030),'⅝ in tongue-and-groove flooring · 7 laid pieces · colors distinguish the rows',font=font(23),fill='#526879')
    plan.save(ROOT/'images/flooring-layout.png')

if args.utility:
    render_utility()
    print('Saved exact-mesh utility picture: '+args.utility)
    sys.exit(0)

if args.doorway:
    render_doorway()
    print('Saved exact-mesh doorway picture: '+args.doorway)
    sys.exit(0)

if args.window_plate:
    render_window_plate()
    sys.exit(0)

if args.header:
    render_header()
    sys.exit(0)

if args.window:
    m=data['metadata']['truss'];o=m['windowOpening'];a=m['anchors']
    bottom=next(b for b in m['windowMembers'] if b['side']=='bottom')
    top=next(b for b in m['windowMembers'] if b['side']=='top')
    x0=bottom['bounds']['x0Ft'];x1=bottom['bounds']['x1Ft'];y0=bottom['bounds']['y1Ft'];y1=top['bounds']['y0Ft'];z=bottom['z1Ft']
    im,project=scene([(x0+x1)/2,(y0+y1)/2,z],max(6,(o['widthIn']+35)/12),yaw=.08,pitch=.04);d=ImageDraw.Draw(im)
    title(d,'Gable window box',f'Changeable example · {o["widthIn"]:g} × {o["heightIn"]:g} in clear opening')
    dimension(d,project,[x0,y0,z],[x1,y0,z],f'{o["widthIn"]:g} in clear width',(0,30))
    dimension(d,project,[x1,y0,z],[x1,y1,z],f'{o["heightIn"]:g} in clear height',(60,0))
    side=next(s for s in m['studMembers'] if abs(s['bounds']['x1Ft']-x0)<1e-7)
    leader(d,project([x0-.14,(y0+y1)/2,z]),(35,150,440,110),'Gable stud',['Moves to the window side'])
    leader(d,project(top['center']),(640,150,525,110),'Top and bottom · 2×4',['3½ in wide faces outward'])
    leader(d,project([x0+.12,bottom['center'][1],z]),(35,748,540,110),'Horizontal pieces resize',[f'{o["widthIn"]:g} in each · between-stud preview joint'])
    d.text((35,895),'Size and auto-fit height are examples. The same rule follows each selected opening.',font=font(22),fill='#526879')
    im.save(ROOT/f'images/gable-window-{args.window}.png')
    print('Saved adjustable gable-window example.')
    sys.exit(0)
if args.truss:
    render_truss()
    print('Saved exact-mesh truss fit preview and connection PNGs.')
    sys.exit(0)
if args.gable:
    render_gable()
    print('Saved exact-mesh gable board overview and connection PNGs.')
    sys.exit(0)
if args.wall or args.end_wall:
    render_wall()
    print('Saved exact-mesh wall study PNGs.')
    sys.exit(0)
if args.deck:
    render_flooring()
    print('Saved exact-mesh flooring overview, surface close-up and measured sheet-layout PNGs.')
    sys.exit(0)

joint=data['metadata']['joint']; j=joint['joist']; skid=joint['skid']; notch=joint['notch']
frame=data['metadata']['frame']; bounds=frame['bounds']
ends=frame['endBoards'];outer=frame['outerBoards']
double=[m for m in ends if m['member']['meta']['endRebate']=='negative']
single=[m for m in ends if m['member']['meta']['endRebate']=='positive']
assert len(double)==2 and len(single)==1
assert abs(j['lengthFt']*12-117)<1e-8
assert abs((bounds['x1Ft']-bounds['x0Ft'])*12-120)<1e-8
im,project=scene()
d=ImageDraw.Draw(im)
title(d,'Floor joists + outer boards','10 ft overall width · treated wood · different grain and knots on each board')
# Exact top-face seams show the two touching end boards as separate pieces.
for m in frame['members']:
    b=m['bounds'];y=b['y1Ft']
    polygon=[project([x,y,z]) for x,z in [(b['x0Ft'],b['z0Ft']),(b['x1Ft'],b['z0Ft']),(b['x1Ft'],b['z1Ft']),(b['x0Ft'],b['z1Ft'])]]
    d.line([tuple(p) for p in polygon+[polygon[0]]],fill='#78694f',width=1)
leader(d,project([0,double[0]['bounds']['y1Ft'],double[0]['center'][2]]),(790,150,370,100),'Two end boards',['Together: 3 in thick'])
leader(d,project([0,single[0]['bounds']['y1Ft'],single[0]['center'][2]]),(40,152,325,100),'One end board',['1½ in thick'])
near=next(m for m in outer if m['center'][0]>0)
leader(d,project([near['center'][0],near['bounds']['y1Ft'],1.7]),(790,580,370,100),'Outer board',['1½ in thick each side'])
leader(d,project([1,j['bounds']['y1Ft'],j['center'][2]]),(40,730,515,124),'Floor joist · 9 ft 9 in',['2×6 nominal · 1½ × 5½ in actual','16 in on center'])
dimension(d,project,[bounds['x0Ft'],j['bounds']['y1Ft'],bounds['z1Ft']],[bounds['x1Ft'],j['bounds']['y1Ft'],bounds['z1Ft']],'10 ft outside to outside',(0,42))
d.rounded_rectangle((590,730,1160,854),radius=12,fill='white',outline='#bdccd8',width=2)
d.text((610,742),'Why the joist is 3 inches shorter',font=font(27,True),fill=NAVY)
d.text((610,786),'120 in − 1½ in − 1½ in = 117 in',font=font(26),fill=NAVY)
d.text((40,884),'First joist position and skid count still to confirm · end names not assigned',font=font(23),fill='#526879')
(ROOT/'images').mkdir(exist_ok=True)
im.save(ROOT/'images/floor-joists.png')

target=[skid['xFt'],.48,j['center'][2]]
im,project=scene(target,3.35,yaw=.9,pitch=.52)
d=ImageDraw.Draw(im)
title(d,'Joist in the skid notch','Treated floor joist · 9 ft 9 in long · seated 1 inch into the skid')
leader(d,project([skid['xFt']+.55,j['bounds']['y1Ft'],j['center'][2]]),(40,152,385,115),'Floor joist',['1½ in thick × 5½ in tall'])
edge=[skid['x1Ft'],notch['seatYFt'],notch['z1Ft']]
leader(d,project(edge),(670,736,490,115),'Notch · 1 in deep',['The joist rests on this seat'])
leader(d,project([skid['x1Ft'],.20,notch['z1Ft']+.32]),(40,736,480,115),'Skid',['Treated wood'])
p=project(edge);q=project([edge[0],notch['topYFt'],edge[2]])
off=np.array([82,0]);a=p+off;b=q+off
d.line([tuple(p),tuple(a)],fill=NAVY,width=3);d.line([tuple(q),tuple(b)],fill=NAVY,width=3)
d.line([tuple(a),tuple(b)],fill=NAVY,width=3)
for t in [a,b]:d.line([(t[0]-8,t[1]),(t[0]+8,t[1])],fill=NAVY,width=3)
d.rounded_rectangle((a[0]+10,(a[1]+b[1])/2-20,a[0]+77,(a[1]+b[1])/2+20),radius=5,fill='white')
d.text((a[0]+18,(a[1]+b[1])/2-18),'1 in',font=font(24,True),fill=NAVY)
d.text((40,884),'Exact model geometry · adjoining joists remain at 16 in on center',font=font(23),fill='#526879')
im.save(ROOT/'images/floor-joist-connection.png')

backing=frame.get('backing')
if backing:
    bb=backing['bounds'];z=backing['center'][2]
    im,project=scene([skid['xFt'],.48,z],3.4,yaw=.82,pitch=.70)
    d=ImageDraw.Draw(im)
    title(d,'Board the mule hooks onto','Flat treated 2×4 · 93 in (7 ft 9 in) long · rests on the skids')
    edge_layer=Image.new('RGBA',(W,H),(0,0,0,0));edge_draw=ImageDraw.Draw(edge_layer)
    for m in double:
        b=m['bounds'];yt=b['y1Ft']
        pts=[project([x,yt,zz]) for x,zz in [(b['x0Ft'],b['z0Ft']),(b['x1Ft'],b['z0Ft']),(b['x1Ft'],b['z1Ft']),(b['x0Ft'],b['z1Ft'])]]
        edge_draw.line([tuple(p) for p in pts+[pts[0]]],fill='#78694f',width=2)
    edge_crop=edge_layer.crop((25,145,W-25,706));im.paste(edge_crop,(25,145),edge_crop)
    d=ImageDraw.Draw(im)
    leader(d,project([skid['xFt']+.35,double[-1]['bounds']['y1Ft'],double[-1]['center'][2]]),(790,152,370,115),'Two end boards',['Standing on edge'])
    leader(d,project([skid['xFt']+.35,bb['y1Ft'],z]),(600,736,560,115),'Board the mule hooks onto',['Treated 2×4 · 3½ in wide × 1½ in tall'])
    leader(d,project([skid['x1Ft'],bb['y0Ft']-.09,bb['z1Ft']+.22]),(40,736,510,115),'Skid',['The flat 2×4 rests on its top'])
    edgeX=skid['xFt']+.7
    dimension(d,project,[edgeX,bb['y0Ft'],bb['z1Ft']],[edgeX,bb['y1Ft'],bb['z1Ft']],'1½ in',(45,10))
    assert abs(backing['lengthFt']*12-93)<1e-8
    d.text((40,884),'93 in cut length confirmed · shown centered; side-to-side position still to confirm',font=font(23),fill='#526879')
    im.save(ROOT/'images/floor-end-backing.png')
print('Saved exact-mesh floor overview and connection PNGs.')
