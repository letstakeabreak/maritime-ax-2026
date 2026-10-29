#!/bin/sh
# Preview 배포의 /api/tariff로 부산 출발 주요 구간의 공표운임 응답을 모은다. 사용: sh tariff-coverage.sh <배포 URL>
for pod in USLAX USNYC NLRTM DEHAM ITGOA CNSHA JPTYO SGSIN VNSGN; do
  vercel curl "/api/tariff?pol=KRPUS&pod=$pod" --deployment "$1" 2>/dev/null
  echo
done
