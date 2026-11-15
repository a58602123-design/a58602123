#!/bin/bash
set -e
TMP=/tmp/fred-11lights-20261115
mkdir -p "$TMP"
SERIES="T10Y2Y SOFR EFFR WLCFLPCL BAMLH0A0HYM2 STLFSI4 VIXCLS DTWEXAFEGS SAHMCURRENT ICSA CES0500000003 CPIAUCSL SP500 LES1252881600Q"
ok=0
fail=0
for s in $SERIES; do
  url="https://fred.stlouisfed.org/graph/fredgraph.csv?id=${s}"
  out="$TMP/${s}.csv"
  code=$(curl -sL --retry 3 --retry-delay 2 -A "Mozilla/5.0 (compatible; 11lights-weekly/1.1; +https://fred.stlouisfed.org)" -o "$out" -w "%{http_code}" "$url")
  head=$(head -c 120 "$out" | tr '\n' ' ')
  lines=$(wc -l < "$out")
  if [ "$code" = "200" ] && head -1 "$out" | grep -q observation_date; then
    last=$(tail -1 "$out" | cut -d, -f1)
    echo "OK  $s  http=$code  lines=$lines  last=$last"
    ok=$((ok+1))
  else
    echo "FAIL $s http=$code lines=$lines head=$head"
    fail=$((fail+1))
  fi
done
echo "RESULT ok=$ok fail=$fail"
ls -la "$TMP"
