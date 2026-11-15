#!/usr/bin/env python3
"""金融危機11燈 V1.1 — recompute + archive snapshot for week-over-week compare."""
import csv, json, os
from datetime import datetime

COLOR={0:'綠',1:'黃',2:'紅'}; TONE={0:'success',1:'warning',2:'danger'}
NAMES={'L01':'殖利率曲線','L02':'SOFR 利差','L03':'Fed 流動性','L04':'高收益債利差','L05':'金融壓力','L06':'VIX','L07':'美元趨勢','L08':'薩姆規則','L09':'初領失業金','L10':'實質薪資','L11':'標普回撤'}

def load(path):
    rows=[]
    with open(path) as f:
        r=csv.DictReader(f); col=[c for c in r.fieldnames if c!='observation_date'][0]
        for row in r:
            v=row[col]
            if v in ('','.',None): continue
            rows.append((row['observation_date'], float(v)))
    return rows

def band(total):
    if total<=3: return 'GREEN','正常','success'
    if total<=7: return 'YELLOW','留意','warning'
    if total<=12: return 'ORANGE','警戒','warning'
    return 'RED','危機','danger'

def compute():
    lights=[]
    # L01
    d,v=load('T10Y2Y.csv')[-1]; sc=0 if v>0.20 else (1 if v>=0 else 2)
    lights.append(dict(id='L01',name=NAMES['L01'],series='T10Y2Y',date=d,raw=v,display=f'{v:+.2f}%',color=COLOR[sc],score=sc,tone=TONE[sc]))
    # L02
    so=dict(load('SOFR.csv')); ef=dict(load('EFFR.csv')); dd=sorted(set(so)&set(ef))[-1]; sp=(so[dd]-ef[dd])*100
    sc=0 if sp<5 else (1 if sp<=15 else 2)
    lights.append(dict(id='L02',name=NAMES['L02'],series='SOFR−EFFR',date=dd,raw=sp,display=f'{sp:.1f} bps',color=COLOR[sc],score=sc,tone=TONE[sc]))
    # L03
    d,v=load('WLCFLPCL.csv')[-1]; b=v/1000; sc=0 if b<5 else (1 if b<=25 else 2)
    lights.append(dict(id='L03',name=NAMES['L03'],series='WLCFLPCL',date=d,raw=b,display=f'${b:.2f}B',note='WLCFOCL→WLCFLPCL',color=COLOR[sc],score=sc,tone=TONE[sc]))
    # L04
    d,v=load('BAMLH0A0HYM2.csv')[-1]; sc=0 if v<4.5 else (1 if v<=6 else 2)
    lights.append(dict(id='L04',name=NAMES['L04'],series='BAMLH0A0HYM2',date=d,raw=v,display=f'{v:.2f}%',color=COLOR[sc],score=sc,tone=TONE[sc]))
    # L05
    d,v=load('STLFSI4.csv')[-1]; sc=0 if v<0 else (1 if v<=1 else 2)
    lights.append(dict(id='L05',name=NAMES['L05'],series='STLFSI4',date=d,raw=v,display=f'{v:+.4f}'.rstrip('0').rstrip('.'),color=COLOR[sc],score=sc,tone=TONE[sc]))
    # L06
    d,v=load('VIXCLS.csv')[-1]; sc=0 if v<20 else (1 if v<=30 else 2)
    lights.append(dict(id='L06',name=NAMES['L06'],series='VIXCLS',date=d,raw=v,display=f'{v:.2f}',color=COLOR[sc],score=sc,tone=TONE[sc]))
    # L07 raw MA20 20d rise
    dx=load('DTWEXAFEGS.csv'); ma=[]
    for i in range(19,len(dx)):
        ma.append((dx[i][0], sum(x[1] for x in dx[i-19:i+1])/20))
    i=len(ma)-1; mt,ma_t=ma[i]; ma0=ma[i-20]; rise=(ma_t/ma0[1]-1)*100
    sc=0 if rise<1.0 else (1 if rise<=2.5 else 2)
    lights.append(dict(id='L07',name=NAMES['L07'],series='DTWEXAFEGS',date=mt,raw=rise,display=f'{rise:+.2f}%',
        formula='(MA20_t/MA20_{t-20}-1)*100 不年化',thresholds='G<1 Y1-2.5 R>2.5',
        ma20_today=ma_t,ma20_ago=ma0[1],ago_date=ma0[0],color=COLOR[sc],score=sc,tone=TONE[sc]))
    # L08
    d,v=load('SAHMCURRENT.csv')[-1]; sc=0 if v<0.3 else (1 if v<0.5 else 2)
    lights.append(dict(id='L08',name=NAMES['L08'],series='SAHMCURRENT',date=d,raw=v,display=f'{v:.2f}%',color=COLOR[sc],score=sc,tone=TONE[sc]))
    # L09
    ic=load('ICSA.csv'); vals=[a[1] for a in ic]; maa=[sum(vals[i-3:i+1])/4 for i in range(3,len(vals))]
    cur=maa[-1]; low=min(maa[-27:-1]); g=(cur/low-1)*100; sc=0 if g<10 else (1 if g<=20 else 2)
    lights.append(dict(id='L09',name=NAMES['L09'],series='ICSA',date=ic[-1][0],raw=g,display=f'{g:+.1f}%',cur_ma4=cur,low_ma4=low,color=COLOR[sc],score=sc,tone=TONE[sc]))
    # L10 monthly real AHE
    ahe=load('CES0500000003.csv'); cpi=load('CPIAUCSL.csv')
    def ym(d): return d[:7]
    ahe_m={ym(d):(d,v) for d,v in ahe}; cpi_m={ym(d):(d,v) for d,v in cpi}
    months=sorted(set(ahe_m)&set(cpi_m))
    real=[(max(ahe_m[m][0],cpi_m[m][0]), m, ahe_m[m][1]/cpi_m[m][1]) for m in months]
    idx={m:i for i,(_,m,_) in enumerate(real)}; yoy_series=[]
    for i,(dt,m,rv) in enumerate(real):
        y,mo=int(m[:4]),int(m[5:7]); m2=f'{y-1:04d}-{mo:02d}'
        if m2 in idx:
            prev=real[idx[m2]][2]; yoy_series.append((dt,m,(rv/prev-1)*100,rv,prev))
    dt,m,yoy,rv,prev=yoy_series[-1]; sc=0 if yoy>0.5 else (1 if yoy>=-0.5 else 2)
    lights.append(dict(id='L10',name=NAMES['L10'],series='CES0500000003/CPIAUCSL',date=dt,raw=yoy,display=f'{yoy:+.2f}%',
        formula='AHE/CPI YoY%',thresholds='G>0.5 Y-0.5..0.5 R<-0.5',month=m,level=rv,prev_level=prev,
        note='V1.1 月頻',color=COLOR[sc],score=sc,tone=TONE[sc]))
    # L11
    sp=load('SP500.csv'); vals=[a[1] for a in sp][-252:]; peak=max(vals); lastp=vals[-1]; ddn=(1-lastp/peak)*100
    sc=0 if ddn<10 else (1 if ddn<=20 else 2)
    lights.append(dict(id='L11',name=NAMES['L11'],series='SP500',date=sp[-1][0],raw=ddn,display=f'{ddn:.1f}%',peak=peak,last=lastp,color=COLOR[sc],score=sc,tone=TONE[sc]))
    return lights

def main():
    lights=compute(); total=sum(L['score'] for L in lights)
    be,bz,bt=band(total); asof=max(L['date'] for L in lights); report_date=datetime.now().strftime('%Y-%m-%d')
    prev=None
    if os.path.exists('summary.json'):
        prev=json.load(open('summary.json'))
        # archive previous
        arch=f"summary_{prev.get('report_date','prev')}_prev.json"
        if not os.path.exists(arch):
            json.dump(prev, open(arch,'w'), ensure_ascii=False, indent=2)
        else:
            json.dump(prev, open(f"summary_{prev.get('report_date','prev')}_{datetime.now().strftime('%H%M%S')}_prev.json",'w'), ensure_ascii=False, indent=2)
        pc={L['id']:L['color'] for L in prev['lights']}; pd={L['id']:L['display'] for L in prev['lights']}
        changes=[]; 
        for L in lights:
            if pc.get(L['id']) and pc[L['id']]!=L['color']:
                changes.append(f"{L['id']} {L['name']} {pc[L['id']]}→{L['color']}（{pd.get(L['id'],'?')} → {L['display']}）")
                L['vs_prev']=f"{pc[L['id']]}→{L['color']}"
            else:
                L['vs_prev']='→'
        prev_total=prev['total']; delta=total-prev_total
        previous=dict(asof=prev.get('asof'),report_date=prev.get('report_date'),total=prev_total,band_zh=prev.get('band_zh'),band_en=prev.get('band_en'))
    else:
        changes=[]; delta=0; previous=None; prev_total=None
        for L in lights: L['vs_prev']='—'
    summary=dict(version='V1.1',asof=asof,report_date=report_date,total=total,adjusted=total,missing=0,
        band_en=be,band_zh=bz,band_tone=bt,lights=lights,weekly=True,previous=previous,delta=delta,color_changes=changes,
        calibration=dict(L07='raw 20d MA20 rise %; G<1 Y1-2.5 R>2.5',L10='CES0500000003/CPIAUCSL YoY; G>0.5 Y-0.5..0.5 R<-0.5'))
    json.dump(summary, open('summary.json','w'), ensure_ascii=False, indent=2)
    json.dump(summary, open(f'summary_{report_date}_v11.json','w'), ensure_ascii=False, indent=2)
    print(json.dumps(dict(total=total,band=bz,delta=delta,changes=changes,asof=asof),ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
