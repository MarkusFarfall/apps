#!/usr/bin/env bash
# Сквозная проверка «Знакомой воды»: закрытый доступ → регистрация → сохранения → уловы → рейтинги → друзья → вход → выход.
# Гостевого режима нет: без аккаунта данные игрока недоступны (это проверяется первым делом).
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
PID=""
STRANGER="$(node -e 'console.log(crypto.randomUUID())')"

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
    curl -sS --retry 2 --retry-delay 1 --retry-all-errors -b "$COOKIES" -c "$COOKIES" -X "$1" "$BASE_URL$2" -H 'content-type: application/json' -d "$3"
  else
    curl -sS --retry 2 --retry-delay 1 --retry-all-errors -b "$COOKIES" -c "$COOKIES" -X "$1" "$BASE_URL$2"
  fi
}
status() { curl -sS --retry 2 --retry-delay 1 --retry-all-errors -b "$COOKIES" -o /dev/null -w '%{http_code}' "$@"; }

SAVE_SMALL='{"version":3,"name":"Тест","money":1500,"xp":300,"codex":{"turbot":{"count":2,"maxWeight":3.2,"firstDay":2,"variants":[]}},"achievements":["first"],"stats":{"playSeconds":420,"totalCaught":7,"totalEarned":1500,"linesSnapped":1,"escaped":2,"nightCatches":1,"stormCatches":0,"releases":0,"jumps":0,"maxDepthCaught":18,"perfectHooks":0,"biggest":null}}'
SAVE_BIG='{"version":3,"name":"Тест","money":4200,"xp":900,"codex":{"turbot":{"count":3,"maxWeight":4.1,"firstDay":2,"variants":["trophy"]},"goby":{"count":5,"maxWeight":0.2,"firstDay":1,"variants":[]}},"achievements":["first","night"],"stats":{"playSeconds":1800,"totalCaught":19,"totalEarned":5200,"linesSnapped":2,"escaped":3,"nightCatches":4,"stormCatches":1,"releases":1,"jumps":2,"maxDepthCaught":26,"perfectHooks":1,"biggest":{"fishId":"turbot","weight":4.1}}}'

echo "Проверяю $BASE_URL"
echo "── 1. гостевой доступ закрыт"
check "" "$(api GET /api/auth/me | json_field user)" "без входа /api/auth/me не отдаёт пользователя"
check "403" "$(status -X PUT "$BASE_URL/api/save" -H 'content-type: application/json' -H "Origin: $BASE_URL" -d "{\"playerId\":\"$STRANGER\",\"name\":\"Тест\",\"data\":$SAVE_SMALL}")" "запись чужого профиля → 403"
check "403" "$(status "$BASE_URL/api/save?playerId=$STRANGER")" "чтение чужого профиля → 403"

echo "── 2. регистрация"
RESP="$(api POST /api/auth/register "{\"username\":\"$USERNAME\",\"password\":\"$PASS\"}")"
PID="$(printf '%s' "$RESP" | json_field playerId)"
check "непусто" "$(if [ -n "$PID" ]; then echo непусто; else echo пусто; fi)" "учётная запись создана, профиль выдан"
check "!$USERNAME" "$(api POST /api/auth/register "{\"username\":\"$USERNAME\",\"password\":\"$PASS\"}" | json_field error)" "повторная регистрация того же имени отклонена"

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

echo "── 8а. накрутка сохранения не проходит"
HACK='{"version":3,"name":"Тест","money":999999999999,"xp":999999999,"codex":{"turbot":{"count":1,"maxWeight":9999,"firstDay":1,"variants":[]},"ne_suschestvuet":{"count":5,"maxWeight":1,"firstDay":1,"variants":[]}},"achievements":["first","first"],"stats":{"playSeconds":999999999,"totalCaught":999999,"totalEarned":1,"linesSnapped":0,"escaped":0,"nightCatches":0,"stormCatches":0,"releases":0,"jumps":0,"maxDepthCaught":0,"perfectHooks":0,"biggest":null}}'
api PUT /api/save "{\"playerId\":\"$PID\",\"name\":\"Тест\",\"data\":$HACK,\"force\":true}" > /dev/null
check "100000000" "$(api GET "/api/save?playerId=$PID" | json_field save.money)" "невозможные монеты срезаны"
check "2000000" "$(api GET "/api/save?playerId=$PID" | json_field save.xp)" "невозможный опыт срезан"
check "1" "$(api GET "/api/save?playerId=$PID" | node -e 'let r="";process.stdin.on("data",c=>r+=c).on("end",()=>{const x=JSON.parse(r).save.codex;console.log(Object.keys(x).length)})')" "несуществующий вид выброшен из кодекса"
# у тюрбо максимум вида 6 кг, значит допустимый предел с запасом на трофей — 6.3
HACKW="$(api GET "/api/save?playerId=$PID" | node -e 'let r="";process.stdin.on("data",c=>r+=c).on("end",()=>{const w=JSON.parse(r).save.codex.turbot.maxWeight;console.log(Math.abs(w-6.3)<0.01?"ограничен по виду":"НЕ ОГРАНИЧЕН: "+w)})')"
check "ограничен по виду" "$HACKW" "вес рыбы ограничен максимумом вида"

echo "── 8б. друзья: заявка, принятие, профиль, приватность"
FRIEND_USER="friend_${STAMP}"
NOBODY="z${STAMP}"
COOKIES2="$(mktemp)"
api2() { # то же, что api, но со своей банкой cookie — ходит вторым игроком
  if [ "$#" -ge 3 ]; then
    curl -sS --retry 2 --retry-delay 1 --retry-all-errors -b "$COOKIES2" -c "$COOKIES2" -X "$1" "$BASE_URL$2" -H 'content-type: application/json' -d "$3"
  else
    curl -sS --retry 2 --retry-delay 1 --retry-all-errors -b "$COOKIES2" -c "$COOKIES2" -X "$1" "$BASE_URL$2"
  fi
}
status2() { curl -sS --retry 2 --retry-delay 1 --retry-all-errors -b "$COOKIES2" -o /dev/null -w '%{http_code}' "$@"; }
# сохранение со снимком мира: мыс, место «Каменная арка», катер (класс 2), дождь, игровой день 3
SAVE_FRIEND='{"version":3,"name":"Друг","money":1500,"xp":300,"location":"cape","spot":"cape_arch","boat":2,"port":"home","atPort":false,"weather":"rain","minutes":2900,"codex":{"turbot":{"count":1,"maxWeight":3.2,"firstDay":2,"variants":[]}},"achievements":["first"],"stats":{"playSeconds":600,"totalCaught":4,"totalEarned":900,"linesSnapped":0,"escaped":0,"nightCatches":0,"stormCatches":0,"releases":0,"jumps":0,"maxDepthCaught":22,"perfectHooks":0,"biggest":{"fishId":"turbot","weight":3.2}}}'

check "401" "$(curl -sS --retry 2 --retry-delay 1 --retry-all-errors -o /dev/null -w '%{http_code}' "$BASE_URL/api/friends")" "список друзей без входа закрыт"
RESP2="$(api2 POST /api/auth/register "{\"username\":\"$FRIEND_USER\",\"password\":\"$PASS\"}")"
PID2="$(printf '%s' "$RESP2" | json_field playerId)"
UID2="$(printf '%s' "$RESP2" | json_field user.id)"
check "непусто" "$(if [ -n "$PID2" ] && [ -n "$UID2" ]; then echo непусто; else echo пусто; fi)" "второй игрок зарегистрирован"
check '{"ok":true}' "$(api2 PUT /api/save "{\"playerId\":\"$PID2\",\"name\":\"Друг\",\"data\":$SAVE_FRIEND}")" "сохранение со снимком мира принято"
check '{"ok":true}' "$(api2 POST /api/catches "{\"playerId\":\"$PID2\",\"fishId\":\"turbot\",\"weight\":3.2,\"locationId\":\"cape\",\"gameDay\":3}")" "улов второго игрока записан"

check "$USERNAME" "$(api2 GET "/api/users?q=$USERNAME" | json_field results.0.username)" "поиск находит игрока по имени"
check "none" "$(api2 GET "/api/users?q=$USERNAME" | json_field results.0.relation)" "до заявки отношение — «не знакомы»"
check "Игрок с таким именем не найден" "$(api POST /api/friends "{\"action\":\"request\",\"username\":\"$NOBODY\"}" | json_field error)" "заявка несуществующему игроку отклонена"
check "Себя добавить нельзя" "$(api POST /api/friends "{\"action\":\"request\",\"username\":\"$USERNAME\"}" | json_field error)" "заявка самому себе отклонена"
check "true" "$(api2 POST /api/friends "{\"action\":\"request\",\"username\":\"$USERNAME\"}" | json_field ok)" "заявка в друзья отправлена"
check "$UID2" "$(api GET /api/friends | json_field incoming.0.userId)" "входящая заявка видна получателю"
check "outgoing" "$(api2 GET /api/friends | json_field outgoing.0.direction)" "отправитель видит её как исходящую"
check "true" "$(api POST /api/friends "{\"action\":\"accept\",\"userId\":\"$UID2\"}" | json_field ok)" "заявка принята"
check "Вы уже друзья" "$(api POST /api/friends "{\"action\":\"request\",\"username\":\"$FRIEND_USER\"}" | json_field error)" "повторная заявка отклонена"
check "Скалистый мыс" "$(api GET /api/friends | json_field friends.0.where.locationName)" "друг видит последнюю локацию"
check "Каменная арка" "$(api GET /api/friends | json_field friends.0.where.spotName)" "и место лова"
check "2" "$(api GET /api/friends | json_field friends.0.where.boat)" "и его судно (класс 2)"
check "rain" "$(api GET /api/friends | json_field friends.0.where.weather)" "и погоду на точке"
check "$FRIEND_USER" "$(api GET "/api/friends/$UID2" | json_field profile.username)" "профиль друга отдаётся"
check "3.2" "$(api GET "/api/friends/$UID2" | json_field profile.best.0.weight)" "в профиле видны лучшие уловы"
check "Скалистый мыс" "$(api GET "/api/friends/$UID2" | json_field profile.favoriteLocation.name)" "и излюбленная акватория"
check "true" "$(api2 POST /api/friends "{\"action\":\"privacy\",\"hideLocation\":true}" | json_field hideLocation)" "игрок скрыл своё местоположение"
check "true" "$(api GET /api/friends | json_field friends.0.where.hidden)" "друг видит, что локация скрыта"
check "" "$(api GET /api/friends | json_field friends.0.where.location)" "и не видит саму локацию"
check '{"ok":true}' "$(api POST /api/friends "{\"action\":\"remove\",\"userId\":\"$UID2\"}")" "удаление из друзей"
check "403" "$(status "$BASE_URL/api/friends/$UID2")" "после удаления профиль недоступен"
STRANGER_ID="usr_00000000000000000000000000000000"
check "403" "$(status2 "$BASE_URL/api/friends/$STRANGER_ID")" "профиль игрока, с которым нет дружбы, недоступен"
check "400" "$(status2 "$BASE_URL/api/friends/usr_zz")" "профиль по malformed-идентификатору → 400"
rm -f "$COOKIES2"

echo "── 9. выход и закрытый доступ"
check "200" "$(status -X POST "$BASE_URL/api/auth/logout")" "logout"
check "" "$(api GET /api/auth/me | json_field user)" "сессия закрыта"
check "401" "$(status "$BASE_URL/api/save?playerId=$PID")" "после выхода прогресс недоступен"
check "401" "$(status -X POST "$BASE_URL/api/catches" -H 'content-type: application/json' -H "Origin: $BASE_URL" -d "{\"playerId\":\"$PID\",\"fishId\":\"turbot\",\"weight\":2,\"locationId\":\"bay\"}")" "улов без входа отклонён"

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
if [ -n "${FRIEND_USER:-}" ]; then
  if ! node scripts/reset-test-data.mjs "$FRIEND_USER" "${PID2:-}"; then
    echo "! удалить вручную: node scripts/reset-test-data.mjs $FRIEND_USER ${PID2:-}"
  fi
fi

exit "$FAILS"
