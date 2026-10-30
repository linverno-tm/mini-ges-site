# usage: lhlocal.sh TAG PORT RUNS  -> lh-TAG-N.json against http://localhost:PORT/
cd "${OUT:-.}"
for i in $(seq 1 $3); do npx -y lighthouse@12 "http://localhost:$2/" --only-categories=performance --form-factor=mobile --output=json --output-path="lh-$1-$i.json" --chrome-flags="--headless=new" --quiet; done
