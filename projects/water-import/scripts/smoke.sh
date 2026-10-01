#!/usr/bin/env bash
# Сквозная проверка «Знакомой воды»: гость → регистрация → сохранения → уловы → рейтинги → вход.
# Запуск:  BASE_URL=http://localhost:3000 bash scripts/smoke.sh
# В конце тестовые данные удаляются автоматически (scripts/reset-test-data.mjs, нужен DATABASE_URL).
set -u

# работаем из корня проекта: тогда пути к scripts/ и .env.local всегда верны
cd "$(dirname "$0")/.." || exit 1

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIES="$(mktemp)"
FAILS=0

# уникальные имена на каждый прогон, чтобы не упираться в «имя занято»
STAMP="$(date +%s)"
USERNAME="test_${STAMP}"
PASS="more2026sol"
GUEST="$(node -e 'console.log(crypto.randomUUID())')"
PID=""

json_field() { node -e '
  let raw = "";
  process.stdin.on("data", (c) => (raw += c)).on("end", () => {
    try {
      const v = process.argv[1].split(".").reduce((a, k) => (a == null ? a : a[k]), JSON.parse(raw));
      console.log(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v);
    } catch { console.log(""); }
  });
' "$1"; }

check() { # check <ожидаемое|!неожиданное> <полученное> <описание>
  local want="$1" got="$2" name="$3" ok=0
  if [ "${want#!}" != "$want" ]; then [ "$got" != "${want#!}" ] && ok=1; else [ "$got" = "$want" ] && ok=1; fi
  if [ "$ok" = 1 ]; then printf '  ✓ %s\n' "$name"; else printf '  ✗ %s — получено: %s\n' "$name" "$got"; FAILS=$((FAILS + 1)); fi
}

api() { # api <method> <path> [json]
  if [ "$#" -ge 3 ]; then
    curl -sS -b "$COOKIES" -c "$COOKIES" -X "$1" "$BASE_URL$2" -H 'content-type: application/json' -d "$3"
  else
    curl -sS -b "$COOKIES" -c "$COOKIES" -X "$1" "$BASE_URL$2"
  fi
}
status() { curl -sS -b "$COOKIES" -o /dev/null -w '%{http_code}' "$@"; }

SAVE_SMALL='{"version":3,"name":"Тест","money":1500,"xp":300,"codex":{"turbot":{"count":2,"maxWeight":3.2,"firstDay":2,"variants":[]}},"achievements":["first"],"stats":{"playSeconds":420,"totalCaught":7,"totalEarned":1500,"linesSnapped":1,"escaped":2,"nightCatches":1,"stormCatches":0,"releases":0,"jumps":0,"maxDepthCaught":18,"perfectHooks":0,"biggest":null}}'
SAVE_BIG='{"version":3,"name":"Тест","money":4200,"xp":900,"codex":{"turbot":{"count":3,"maxWeight":4.1,"firstDay":2,"variants":["trophy"]},"goby":{"count":5,"maxWeight":0.2,"firstDay":1,"variants":[]}},"achievements":["first","night"],"stats":{"playSeconds":1800,"totalCaught":19,"totalEarned":5200,"linesSnapped":2,"escaped":3,"nightCatches":4,"stormCatches":1,"releases":1,"jumps":2,"maxDepthCaught":26,"perfectHooks":1,"biggest":{"fishId":"turbot","weight":4.1}}}'

echo "Проверяю $BASE_URL"
echo "── 1. гостевое сохранение (без аккаунта)"
check '{"ok":true}' "$(api PUT /api/save "{\"playerId\":\"$GUEST\",\"name\":\"Тест\",\"data\":$SAVE_SMALL}")" "PUT /api/save (гость)"
GOT="$(api GET "/api/save?playerId=$GUEST" | json_field save.money)"
check "1500" "$GOT" "GET /api/save → монет 1500"

echo "── 2. регистрация с переносом гостевого прогресса"
RESP="$(api POST /api/auth/register "{\"username\":\"$USERNAME\",\"password\":\"$PASS\",\"guestId\":\"$GUEST\"}")"
PID="$(printf '%s' "$RESP" | json_field playerId)"
check "$GUEST" "$PID" "гостевой профиль принят аккаунтом"

echo "── 3. сессия и облачное сохранение"
check "$USERNAME" "$(api GET /api/auth/me | json_field user.username)" "GET /api/auth/me"
check '{"ok":true}' "$(api PUT /api/save "{\"playerId\":\"$PID\",\"name\":\"Тест\",\"data\":$SAVE_BIG}")" "PUT /api/save (аккаунт)"
check "4200" "$(api GET "/api/save?playerId=$PID" | json_field save.money)" "прогресс прочитан из базы"

echo "── 4. защита от перезаписи старым сохранением"
CODE="$(status -X PUT "$BASE_URL/api/save" -H 'content-type: application/json' -d "{\"playerId\":\"$PID\",\"name\":\"Тест\",\"data\":$SAVE_SMALL}")"
check "409" "$CODE" "старое сохранение отклонено (409)"

echo "── 5. уловы и мировые рекорды"
check '{"ok":true}' "$(api POST /api/catches "{\"playerId\":\"$PID\",\"fishId\":\"turbot\",\"weight\":4.1,\"variant\":\"trophy\",\"locationId\":\"bay\",\"gameDay\":3}")" "POST /api/catches"
check "bad catch" "$(api POST /api/catches "{\"playerId\":\"$PID\",\"fishId\":\"turbot\",\"weight\":99,\"locationId\":\"bay\"}" | json_field error)" "слишком тяжёлый улов отклонён"
check "4.1 кг" "$(api GET /api/catches | node -e 'let r="";process.stdin.on("data",c=>r+=c).on("end",()=>{const x=JSON.parse(r).records.find(v=>v.fishId==="turbot");console.log(x?x.weight+" кг":"нет")})')" "рекорд по видам"

echo "── 6. рейтинг"
check "непусто" "$(api GET '/api/leaderboard?scope=all' | node -e 'let r="";process.stdin.on("data",c=>r+=c).on("end",()=>{const l=JSON.parse(r).leaders;console.log(l.length?"непусто":"пусто")})')" "рейтинг отдаётся"

echo "── 7. негативные проверки"
check "401" "$(status -X POST "$BASE_URL/api/auth/login" -H 'content-type: application/json' -d "{\"login\":\"$USERNAME\",\"password\":\"неверный123\"}")" "неверный пароль → 401"
check "400" "$(status -X POST "$BASE_URL/api/auth/register" -H 'content-type: application/json' -d '{"username":"Короткий","password":"123"}')" "слабый пароль → 400"
check "403" "$(status -X POST "$BASE_URL/api/auth/login" -H 'content-type: application/json' -H 'Origin: https://evil.example' -d '{"login":"x","password":"y"}')" "чужой Origin → 403"

echo "── 8. вход с другого устройства"
rm -f "$COOKIES"
check "$USERNAME" "$(api POST /api/auth/login "{\"login\":\"$USERNAME\",\"password\":\"$PASS\"}" | json_field user.username)" "вход по паролю"
check "4200" "$(api GET "/api/save?playerId=$PID" | json_field save.money)" "прогресс доступен со второго устройства"

echo "── 9. выход"
check "200" "$(status -X POST "$BASE_URL/api/auth/logout")" "logout"
check "" "$(api GET /api/auth/me | json_field user)" "сессия закрыта"

rm -f "$COOKIES"
if [ "$FAILS" -eq 0 ]; then
  echo "✓ все проверки пройдены"
else
  echo "✗ неудачных проверок: $FAILS"
fi

echo
echo "── уборка тестовых данных"
if ! node scripts/reset-test-data.mjs "$USERNAME" "$PID"; then
  echo "! удалить вручную: node scripts/reset-test-data.mjs $USERNAME $PID"
fi

exit "$FAILS"
