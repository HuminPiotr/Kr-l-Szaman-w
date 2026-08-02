#!/bin/sh
# Wszystkie testy logiki, które da się uruchomić bez kamery.
#   sh tools/test-wszystko.sh
#
# NIE zastępują sprawdzenia na żywym ciele - wejściem gry jest strumień
# z kamery. Pilnują tego, co jest czystą logiką: progów, stanów, ciągłości
# wyników i odporności na zepsute dane.
status=0
for t in "$(dirname "$0")"/test-*.mjs; do
    printf '%-26s ' "$(basename "$t")"
    if out=$(node "$t" 2>&1); then
        echo '✓'
    else
        echo '✗'
        echo "$out" | sed 's/^/    /'
        status=1
    fi
done
exit $status
