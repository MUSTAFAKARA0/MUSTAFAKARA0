#!/usr/bin/env bash
# KARAYS · Storage → R2 aktarım sondası (Backup #43: media-originals aktarımında çok sayıda HTTP 501 NotImplemented).
#
# Amaç: 501'in HANGİ S3 işleminde (HEAD/GET/PUT/…) ve HANGİ tarafta (Supabase kaynağı / R2 hedefi) oluştuğunu ölçmek ve
# aday çözümü (güncel sabit rclone, --s3-no-head) küçük, yalıtılmış bir aktarımla doğrulamak.
#
#   A kaynak (salt okuma)  supa:media-originals'tan en çok PROBE_SOURCE_LIMIT nesne yalnız çalıştırıcıya indirilir ve atılır;
#                          hiçbir yere yüklenmez, içerik ve yol yazılmaz. (rclone 1.60.1 ve varsa 1.75.2)
#   B hedef (sentetik)     rastgele baytlardan "original" adlı (uzantısız, application/octet-stream) iki dosya (1 MiB, 12 MiB)
#                          diagnostics/<tag>/ altına yüklenir; bir İKİNCİ uzak ad üzerinden S3→S3 akışla kopyalanır
#                          (yedekteki gibi sunucu tarafı değil), kopya indirilir ve SHA-256 karşılaştırılır, sonra YALNIZ
#                          diagnostics/<tag>/ altındaki bu dosyalar silinir. Matris: rclone {1.60.1, 1.75.2} × {varsayılan, --s3-no-head}.
#
# Günlük güvenliği: rclone --dump headers çıktısı yalnız geçici dosyaya yazılır ve SADECE şu özet basılır:
#   taraf (supabase|r2) · HTTP yöntemi · durum kodu · sayı; 501 alan isteklerin yalnız BAŞLIK ADLARI (değerleri değil).
# Nesne yolu, kurum kimliği, uç nokta, anahtar ve ham hata metni yazılmaz. Mevcut yedeklere (db/, storage/) dokunulmaz.
set -uo pipefail

SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/null}
RUN_TAG=${RUN_TAG:-local}
LIMIT=${PROBE_SOURCE_LIMIT:-25}
WORK=$(mktemp -d)
TAG="probe-${RUN_TAG}-$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"
PREFIX="diagnostics/$TAG"
FAILED=0
trap 'cleanup; rm -rf "$WORK"' EXIT

say() { printf '%s\n' "$*"; }
md() { printf '%s\n' "$*" >> "$SUMMARY"; }

# Sürüm listesi: RCLONE_BINS="1.60.1=/usr/bin/rclone 1.75.2=/opt/rclone-1.75.2/rclone" (yoksa yalnız PATH'teki)
read -r -a BINS <<< "${RCLONE_BINS:-current=$(command -v rclone)}"

# Uç noktaların yalnız alan adları; özetlerde taraf adıyla değiştirilir (asla basılmaz)
host_of() { local r="${1#*://}"; printf '%s' "${r%%/*}"; }
SUPA_HOST=$(host_of "${SUPABASE_S3_ENDPOINT:-}")
R2_HOST=$(host_of "${BACKUP_S3_ENDPOINT:-}")

export RCLONE_CONFIG_SUPA_TYPE=s3 RCLONE_CONFIG_SUPA_PROVIDER=Other RCLONE_CONFIG_SUPA_FORCE_PATH_STYLE=true
export RCLONE_CONFIG_SUPA_ENDPOINT="${SUPABASE_S3_ENDPOINT:-}" RCLONE_CONFIG_SUPA_REGION="${SUPABASE_S3_REGION:-}"
export RCLONE_CONFIG_SUPA_ACCESS_KEY_ID="${SUPABASE_S3_ACCESS_KEY_ID:-}" RCLONE_CONFIG_SUPA_SECRET_ACCESS_KEY="${SUPABASE_S3_SECRET_ACCESS_KEY:-}"
for r in R2A R2B; do # aynı R2, iki ayrı uzak ad: kopya sunucu tarafı değil, yedekteki gibi akış olur
  export "RCLONE_CONFIG_${r}_TYPE=s3" "RCLONE_CONFIG_${r}_PROVIDER=${BACKUP_S3_PROVIDER:-Cloudflare}"
  export "RCLONE_CONFIG_${r}_ENDPOINT=${BACKUP_S3_ENDPOINT:-}" "RCLONE_CONFIG_${r}_REGION=${BACKUP_S3_REGION:-}"
  export "RCLONE_CONFIG_${r}_ACCESS_KEY_ID=${BACKUP_S3_ACCESS_KEY_ID:-}" "RCLONE_CONFIG_${r}_SECRET_ACCESS_KEY=${BACKUP_S3_SECRET_ACCESS_KEY:-}"
done

# --dump headers günlüğünden güvenli özet: "taraf YÖNTEM DURUM" satırları (+ 501 isteklerinin başlık adları)
summarize_dump() { # günlük → stdout
  awk -v supa="$SUPA_HOST" -v r2="$R2_HOST" '
    function side(h) { return (supa != "" && index(h, supa)) ? "supabase" : ((r2 != "" && index(h, r2)) ? "r2" : "diğer") }
    /HTTP REQUEST \(req /   { match($0, /req 0x[0-9a-f]+/); id = substr($0, RSTART + 4, RLENGTH - 4); mode = "req"; next }
    /HTTP RESPONSE \(req /  { match($0, /req 0x[0-9a-f]+/); id = substr($0, RSTART + 4, RLENGTH - 4); mode = "resp"; next }
    mode == "req" && /(GET|HEAD|PUT|POST|DELETE) [^ ]+ HTTP\/1\.1/ {
      match($0, /(GET|HEAD|PUT|POST|DELETE) /); method[id] = substr($0, RSTART, RLENGTH - 1)
      q = ($0 ~ /\?(uploads|partNumber|uploadId)/) ? "+multipart" : ""; method[id] = method[id] q; next }
    mode == "req" && /^[^ ]*Host: / { h = $0; sub(/.*Host: /, "", h); sub(/\r$/, "", h); host[id] = h; next }
    mode == "req" && /^[A-Za-z0-9-]+: / { n = $0; sub(/:.*/, "", n); hdrs[id] = hdrs[id] " " tolower(n); next }
    mode == "resp" && /HTTP\/[0-9.]+ [0-9][0-9][0-9]/ {
      # HTTP/1.1 ve HTTP/2.0 (Supabase HTTP/2 yanıt verir; teşhis 5 kaynak özeti bu yüzden boştu)
      match($0, /HTTP\/[0-9.]+ [0-9][0-9][0-9]/); st = substr($0, RSTART, RLENGTH); code = substr(st, length(st) - 2, 3)
      key = side(host[id]) " " method[id] " " code; count[key]++
      if (code == "501") { n501[side(host[id]) " " method[id]] = hdrs[id] }
      mode = ""; next }
    END {
      for (k in count) printf "%s ×%d\n", k, count[k]
      for (k in n501) printf "501 başlık adları (%s):%s\n", k, n501[k]
    }' "$1" | sort
}

cleanup() {
  [ -n "${CLEAN_BIN:-}" ] || return 0
  # Yalnız bu sondanın önekindeki dosyalar (tek tek, tam adla)
  for p in src/small/original src/large/original; do "$CLEAN_BIN" deletefile "R2A:$BACKUP_BUCKET/$PREFIX/$p" --s3-no-check-bucket >/dev/null 2>&1 || true; done
  for d in "${DST_KEYS[@]:-}"; do [ -n "$d" ] && "$CLEAN_BIN" deletefile "R2A:$BACKUP_BUCKET/$d" --s3-no-check-bucket >/dev/null 2>&1 || true; done
  left=$("$CLEAN_BIN" lsf -R "R2A:$BACKUP_BUCKET/$PREFIX/" --files-only --s3-no-check-bucket 2>/dev/null | wc -l)
  if [ "${left:-0}" != 0 ]; then
    say "::warning title=Sonda dosyası kaldı::Önek: $PREFIX/ ($left dosya; yalnız sentetik test verisi)"
    md ""; md "**Kalan sentetik dosyalar (yalnız önek):** \`$PREFIX/\`"
  fi
}

md "### Storage → R2 aktarım sondası"; md ""
DST_KEYS=()

# --- A: kaynak (salt okuma) -----------------------------------------------------------------------------------------
md "#### A · Kaynak (Supabase, salt okuma, en çok $LIMIT nesne)"; md ""
first_bin="${BINS[0]#*=}"
"$first_bin" lsf -R "supa:media-originals" --files-only >"$WORK/src.list" 2>/dev/null || true
total=$(wc -l < "$WORK/src.list" | tr -d ' ')
md "media-originals nesne sayısı (yalnız sayı): $total"; say "A: kaynakta $total nesne"
head -n "$LIMIT" "$WORK/src.list" > "$WORK/src.sample"
for entry in "${BINS[@]}"; do
  ver="${entry%%=*}"; bin="${entry#*=}"
  : > "$WORK/a-$ver.log"; ok=0; bad=0
  while IFS= read -r obj; do
    if "$bin" cat "supa:media-originals/$obj" --dump headers --log-level DEBUG --log-file "$WORK/a-$ver.log" > /dev/null 2>>"$WORK/a-$ver.err"; then ok=$((ok + 1)); else bad=$((bad + 1)); fi
  done < "$WORK/src.sample"
  md ""; md "rclone $ver: indirme başarılı $ok, başarısız $bad"; md '```'; summarize_dump "$WORK/a-$ver.log" >> "$SUMMARY"; md '```'
  say "A rclone $ver: başarılı $ok, başarısız $bad"; summarize_dump "$WORK/a-$ver.log"
done

# --- B: hedef (sentetik) --------------------------------------------------------------------------------------------
md ""; md "#### B · Hedef (R2, sentetik dosya, S3→S3 akış kopyası, SHA-256 doğrulaması)"; md ""
md "| rclone | seçenek | boyut | sonuç | HTTP özeti |"; md "|---|---|---|---|---|"
CLEAN_BIN="$first_bin"
head -c 1048576 /dev/urandom > "$WORK/small"; head -c 12582912 /dev/urandom > "$WORK/large"
for size in small large; do
  if ! "$first_bin" copyto "$WORK/$size" "R2A:$BACKUP_BUCKET/$PREFIX/src/$size/original" --s3-no-check-bucket >/dev/null 2>&1; then
    md "| — | — | $size | HAZIRLIK HATASI (kaynak sentetik dosya yüklenemedi) | — |"; FAILED=1
  fi
done
for entry in "${BINS[@]}"; do
  ver="${entry%%=*}"; bin="${entry#*=}"
  for opt in default no-head; do
    flags=(--s3-no-check-bucket); [ "$opt" = no-head ] && flags+=(--s3-no-head)
    for size in small large; do
      dst="$PREFIX/dst/$ver/$opt/$size/original"; DST_KEYS+=("$dst")
      log="$WORK/b-$ver-$opt-$size.log"
      if "$bin" copyto "R2A:$BACKUP_BUCKET/$PREFIX/src/$size/original" "R2B:$BACKUP_BUCKET/$dst" "${flags[@]}" \
           --dump headers --log-level DEBUG --log-file "$log" >/dev/null 2>&1 \
         && "$first_bin" cat "R2A:$BACKUP_BUCKET/$dst" --s3-no-check-bucket 2>/dev/null | sha256sum | cut -d' ' -f1 > "$WORK/got" \
         && [ "$(cat "$WORK/got")" = "$(sha256sum "$WORK/$size" | cut -d' ' -f1)" ]; then
        res="TAMAM (SHA-256 aynı)"
      else
        res="HATA"; FAILED=1
      fi
      sum=$(summarize_dump "$log" | tr '\n' ';' | sed 's/;$//; s/;/; /g')
      md "| $ver | $opt | $size | $res | ${sum:-—} |"; say "B $ver $opt $size: $res · $sum"
      "$first_bin" deletefile "R2A:$BACKUP_BUCKET/$dst" --s3-no-check-bucket >/dev/null 2>&1 || true
    done
  done
done

md ""
if [ "$FAILED" = 1 ]; then md "Sonuç: **en az bir sentetik aktarım başarısız** (tabloya bakın)."; say "SONUÇ: başarısız aktarım var"; exit 1; fi
md "Sonuç: **sentetik aktarımların hepsi TAMAM**."; say "SONUÇ: TAMAM"
